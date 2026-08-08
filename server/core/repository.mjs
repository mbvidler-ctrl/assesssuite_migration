import { randomUUID } from 'node:crypto';

import { AUDIT_ENTITY_TYPES, validateContentFreeAuditPayload } from './audit.mjs';
import { validateContextSnapshot } from './contextSnapshot.mjs';
import {
  ARTIFACT_STATES,
  CAPABILITY_STATES,
  CONFIG_STATES,
  JOB_STATES,
  REVIEW_STATES,
  RUN_STATES,
  transitionArtifactState,
  transitionCapabilityState,
  transitionConfigState,
  transitionJobState,
  transitionReviewState,
  transitionRunState,
} from './domainStates.mjs';
import { CoreContractError } from './errors.mjs';
import {
  completeIdempotencyRecord,
  validateIdempotencyRecord,
} from './idempotency.mjs';
import { deepFreeze, normalizeJson, sha256CanonicalJson } from './json.mjs';
import { validateRequestContext } from './requestContext.mjs';
import {
  assertExactKeys,
  assertIsoTimestamp,
  assertMachineIdentifier,
  assertOpaqueId,
} from './values.mjs';

const SHA256_RE = /^sha256:[a-f0-9]{64}$/;
const EXECUTION_MODES = Object.freeze(['sandbox', 'production']);
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

function assertDatabase(db) {
  if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') {
    throw new CoreContractError('CORE_INVALID_DATABASE', 'a DatabaseSync-compatible handle is required');
  }
}

function assertHash(value, field) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    throw new CoreContractError('CORE_INVALID_HASH', `${field} must be a SHA-256 digest`);
  }
  return value;
}

function assertPositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new CoreContractError('CORE_INVALID_INTEGER', `${field} must be a positive integer`);
  }
  return value;
}

function assertNonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CoreContractError('CORE_INVALID_INTEGER', `${field} must be a non-negative integer`);
  }
  return value;
}

function boundedLimit(value = DEFAULT_LIST_LIMIT) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_LIST_LIMIT) {
    throw new CoreContractError(
      'CORE_INVALID_LIST_LIMIT',
      `list limit must be between 1 and ${MAX_LIST_LIMIT}`,
    );
  }
  return value;
}

function optionalState(value, allowed, field = 'state') {
  if (value === undefined || value === null) return null;
  if (!allowed.includes(value)) {
    throw new CoreContractError('CORE_INVALID_STATE', `${field} is invalid`);
  }
  return value;
}

function nullableId(value, field) {
  return value === undefined || value === null ? null : assertOpaqueId(value, field);
}

function expectChange(result, code, message) {
  if (Number(result?.changes || 0) !== 1) {
    throw new CoreContractError(code, message, { httpStatus: 409 });
  }
}

function parseJson(value, field) {
  try {
    return JSON.parse(value);
  } catch {
    throw new CoreContractError('CORE_STORED_JSON_INVALID', `${field} contains invalid JSON`, {
      httpStatus: 500,
    });
  }
}

function mapContextSnapshot(row) {
  if (!row) return null;
  const snapshot = {
    schemaVersion: 1,
    snapshotId: row.id,
    orgId: row.org_id,
    purpose: row.purpose,
    subject:
      row.subject_id === null
        ? null
        : { type: row.subject_type, id: row.subject_id },
    sources: parseJson(row.source_manifest_json, 'source_manifest_json'),
    context: parseJson(row.context_json, 'context_json'),
    contentHash: row.content_hash,
    cutoffAt: row.cutoff_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
  validateContextSnapshot(snapshot);
  return deepFreeze(snapshot);
}

function revalidateTransition(expectedDomain, transition) {
  if (!transition || transition.domain !== expectedDomain) {
    throw new CoreContractError('CORE_TRANSITION_DOMAIN_MISMATCH', 'transition domain is invalid');
  }
  const functions = {
    artifact: transitionArtifactState,
    capability: transitionCapabilityState,
    config: transitionConfigState,
    job: transitionJobState,
    review: transitionReviewState,
    run: transitionRunState,
  };
  return functions[expectedDomain](transition.fromState, transition.toState, transition.evidence);
}

/**
 * Synchronous repositories over the Core V1 relational schema.
 *
 * Every method is tenant-explicit. Repositories never derive identity from an
 * HTTP body, never log stored content, and use optimistic state versions for
 * transitions. Call `installCoreSchema(db)` before constructing this factory.
 */
export function createCoreRepositories(
  db,
  { clock = () => new Date(), idFactory = randomUUID } = {},
) {
  assertDatabase(db);
  let savepointCounter = 0;

  function nowIso() {
    const value = clock();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) {
      throw new CoreContractError('CORE_INVALID_CLOCK', 'Core repository clock returned an invalid date');
    }
    return date.toISOString();
  }

  function newId(field) {
    return assertOpaqueId(idFactory(), field);
  }

  function withTransaction(work) {
    if (typeof work !== 'function') {
      throw new CoreContractError('CORE_INVALID_TRANSACTION', 'transaction work must be a function');
    }
    if (work.constructor?.name === 'AsyncFunction') {
      throw new CoreContractError(
        'CORE_ASYNC_TRANSACTION_DENIED',
        'DatabaseSync transactions must complete synchronously',
      );
    }
    savepointCounter += 1;
    const savepoint = `core_v1_${savepointCounter}`;
    db.exec(`SAVEPOINT ${savepoint}`);
    try {
      const result = work();
      if (result && typeof result.then === 'function') {
        throw new CoreContractError(
          'CORE_ASYNC_TRANSACTION_DENIED',
          'DatabaseSync transactions must complete synchronously',
        );
      }
      db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      throw error;
    }
  }

  const contextSnapshots = Object.freeze({
    insert(snapshot) {
      validateContextSnapshot(snapshot);
      db.prepare(`
        INSERT INTO core_context_snapshot (
          id, org_id, purpose, subject_type, subject_id, source_manifest_json,
          context_json, content_hash, cutoff_at, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        snapshot.snapshotId,
        snapshot.orgId,
        snapshot.purpose,
        snapshot.subject?.type ?? null,
        snapshot.subject?.id ?? null,
        JSON.stringify(snapshot.sources),
        JSON.stringify(snapshot.context),
        snapshot.contentHash,
        snapshot.cutoffAt,
        snapshot.createdBy,
        snapshot.createdAt,
      );
      return snapshot;
    },

    get(snapshotId, orgId) {
      assertOpaqueId(snapshotId, 'snapshotId');
      assertOpaqueId(orgId, 'orgId');
      return mapContextSnapshot(
        db.prepare('SELECT * FROM core_context_snapshot WHERE id = ? AND org_id = ?').get(snapshotId, orgId),
      );
    },
  });

  const configs = Object.freeze({
    create({
      configVersionId = newId('configVersionId'),
      orgId = null,
      configKey,
      version,
      config,
      createdBy,
      createdAt = nowIso(),
    }) {
      nullableId(orgId, 'orgId');
      assertMachineIdentifier(configKey, 'configKey');
      assertPositiveInteger(version, 'version');
      assertOpaqueId(createdBy, 'createdBy');
      assertIsoTimestamp(createdAt, 'createdAt');
      const normalizedConfig = normalizeJson(config);
      const contentHash = sha256CanonicalJson(normalizedConfig);
      db.prepare(`
        INSERT INTO core_config_version (
          id, org_id, config_key, version, state, config_json, content_hash,
          state_version, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'draft', ?, ?, 0, ?, ?, ?)
      `).run(
        configVersionId,
        orgId,
        configKey,
        version,
        JSON.stringify(normalizedConfig),
        contentHash,
        createdBy,
        createdAt,
        createdAt,
      );
      return configs.get(configVersionId, orgId);
    },

    get(configVersionId, orgId = undefined) {
      assertOpaqueId(configVersionId, 'configVersionId');
      const row = orgId === undefined
        ? db.prepare('SELECT * FROM core_config_version WHERE id = ?').get(configVersionId)
        : db.prepare('SELECT * FROM core_config_version WHERE id = ? AND org_id IS ?').get(
            configVersionId,
            nullableId(orgId, 'orgId'),
          );
      if (!row) return null;
      return deepFreeze({
        configVersionId: row.id,
        orgId: row.org_id,
        configKey: row.config_key,
        version: row.version,
        state: row.state,
        config: parseJson(row.config_json, 'config_json'),
        contentHash: row.content_hash,
        validationRef: row.validation_ref,
        approvalRef: row.approval_ref,
        deploymentAuthorityRef: row.deployment_authority_ref,
        reasonCode: row.reason_code,
        stateVersion: row.state_version,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    },

    listSummaries({ orgId, includeGlobal = true, configKey = null, state = null, limit = DEFAULT_LIST_LIMIT }) {
      assertOpaqueId(orgId, 'orgId');
      if (typeof includeGlobal !== 'boolean') {
        throw new CoreContractError('CORE_INVALID_LIST_FILTER', 'includeGlobal must be boolean');
      }
      if (configKey !== null) assertMachineIdentifier(configKey, 'configKey');
      optionalState(state, CONFIG_STATES);
      const rows = db.prepare(`
        SELECT
          id, org_id, config_key, version, state, content_hash, validation_ref,
          approval_ref, deployment_authority_ref, reason_code, state_version,
          created_by, created_at, updated_at
        FROM core_config_version
        WHERE (org_id = ? OR (? = 1 AND org_id IS NULL))
          AND (? IS NULL OR config_key = ?)
          AND (? IS NULL OR state = ?)
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
      `).all(
        orgId,
        includeGlobal ? 1 : 0,
        configKey,
        configKey,
        state,
        state,
        boundedLimit(limit),
      );
      return deepFreeze(rows.map((row) => ({
        configVersionId: row.id,
        orgId: row.org_id,
        configKey: row.config_key,
        version: row.version,
        state: row.state,
        contentHash: row.content_hash,
        validationRef: row.validation_ref,
        approvalRef: row.approval_ref,
        deploymentAuthorityRef: row.deployment_authority_ref,
        reasonCode: row.reason_code,
        stateVersion: row.state_version,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));
    },

    transition({ configVersionId, expectedStateVersion, transition, updatedAt = nowIso() }) {
      assertOpaqueId(configVersionId, 'configVersionId');
      assertNonNegativeInteger(expectedStateVersion, 'expectedStateVersion');
      assertIsoTimestamp(updatedAt, 'updatedAt');
      const checked = revalidateTransition('config', transition);
      const current = configs.get(configVersionId);
      if (!current || current.state !== checked.fromState || current.stateVersion !== expectedStateVersion) {
        throw new CoreContractError('CORE_STALE_CONFIG', 'config state changed before transition', {
          httpStatus: 409,
        });
      }
      const evidence = checked.evidence;
      const result = db.prepare(`
        UPDATE core_config_version
        SET state = ?,
            validation_ref = COALESCE(?, validation_ref),
            approval_ref = COALESCE(?, approval_ref),
            deployment_authority_ref = COALESCE(?, deployment_authority_ref),
            reason_code = COALESCE(?, reason_code),
            state_version = state_version + 1,
            updated_at = ?
        WHERE id = ? AND state = ? AND state_version = ?
      `).run(
        checked.toState,
        evidence.validationRef ?? null,
        evidence.approvalRef ?? null,
        evidence.deploymentAuthorityRef ?? null,
        evidence.reasonCode ?? null,
        updatedAt,
        configVersionId,
        checked.fromState,
        expectedStateVersion,
      );
      expectChange(result, 'CORE_STALE_CONFIG', 'config state changed before transition');
      return configs.get(configVersionId);
    },
  });

  const capabilities = Object.freeze({
    register({ capabilityKey, createdAt = nowIso() }) {
      assertMachineIdentifier(capabilityKey, 'capabilityKey');
      assertIsoTimestamp(createdAt, 'createdAt');
      db.prepare(`
        INSERT OR IGNORE INTO core_capability (
          capability_key, state, state_version, created_at, updated_at
        ) VALUES (?, 'registered', 0, ?, ?)
      `).run(capabilityKey, createdAt, createdAt);
      return capabilities.get(capabilityKey);
    },

    get(capabilityKey) {
      assertMachineIdentifier(capabilityKey, 'capabilityKey');
      const row = db.prepare('SELECT * FROM core_capability WHERE capability_key = ?').get(capabilityKey);
      if (!row) return null;
      return deepFreeze({
        capabilityKey: row.capability_key,
        state: row.state,
        activeConfigVersionId: row.active_config_version_id,
        validationRef: row.validation_ref,
        approvalRef: row.approval_ref,
        deploymentAuthorityRef: row.deployment_authority_ref,
        reasonCode: row.reason_code,
        stateVersion: row.state_version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    },

    listSummaries({ state = null, limit = DEFAULT_LIST_LIMIT } = {}) {
      optionalState(state, CAPABILITY_STATES);
      const rows = db.prepare(`
        SELECT * FROM core_capability
        WHERE (? IS NULL OR state = ?)
        ORDER BY updated_at DESC, capability_key ASC
        LIMIT ?
      `).all(state, state, boundedLimit(limit));
      return deepFreeze(rows.map((row) => ({
        capabilityKey: row.capability_key,
        state: row.state,
        activeConfigVersionId: row.active_config_version_id,
        validationRef: row.validation_ref,
        approvalRef: row.approval_ref,
        deploymentAuthorityRef: row.deployment_authority_ref,
        reasonCode: row.reason_code,
        stateVersion: row.state_version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));
    },

    transition({
      capabilityKey,
      expectedStateVersion,
      transition,
      activeConfigVersionId = null,
      updatedAt = nowIso(),
    }) {
      assertMachineIdentifier(capabilityKey, 'capabilityKey');
      assertNonNegativeInteger(expectedStateVersion, 'expectedStateVersion');
      assertIsoTimestamp(updatedAt, 'updatedAt');
      const checked = revalidateTransition('capability', transition);
      const current = capabilities.get(capabilityKey);
      if (!current || current.state !== checked.fromState || current.stateVersion !== expectedStateVersion) {
        throw new CoreContractError('CORE_STALE_CAPABILITY', 'capability state changed before transition', {
          httpStatus: 409,
        });
      }
      if (checked.toState === 'production_active') {
        assertOpaqueId(activeConfigVersionId, 'activeConfigVersionId');
        const activeConfig = configs.get(activeConfigVersionId);
        if (
          !activeConfig ||
          activeConfig.state !== 'active' ||
          activeConfig.configKey !== capabilityKey ||
          activeConfig.orgId !== null
        ) {
          throw new CoreContractError(
            'CORE_ACTIVE_CONFIG_REQUIRED',
            'production activation requires the matching active global config version',
            { httpStatus: 409 },
          );
        }
      }
      const evidence = checked.evidence;
      const result = db.prepare(`
        UPDATE core_capability
        SET state = ?,
            active_config_version_id = CASE WHEN ? IS NULL THEN active_config_version_id ELSE ? END,
            validation_ref = COALESCE(?, validation_ref),
            approval_ref = COALESCE(?, approval_ref),
            deployment_authority_ref = COALESCE(?, deployment_authority_ref),
            reason_code = COALESCE(?, reason_code),
            state_version = state_version + 1,
            updated_at = ?
        WHERE capability_key = ? AND state = ? AND state_version = ?
      `).run(
        checked.toState,
        activeConfigVersionId,
        activeConfigVersionId,
        evidence.validationRef ?? null,
        evidence.approvalRef ?? null,
        evidence.deploymentAuthorityRef ?? null,
        evidence.reasonCode ?? null,
        updatedAt,
        capabilityKey,
        checked.fromState,
        expectedStateVersion,
      );
      expectChange(result, 'CORE_STALE_CAPABILITY', 'capability state changed before transition');
      return capabilities.get(capabilityKey);
    },
  });

  const runs = Object.freeze({
    create({
      requestContext,
      runId = newId('runId'),
      runType,
      executionMode = 'sandbox',
      contextSnapshotId,
      capabilityKey,
      configVersionId,
      requestHash,
      createdAt = nowIso(),
    }) {
      validateRequestContext(requestContext);
      assertOpaqueId(runId, 'runId');
      assertMachineIdentifier(runType, 'runType');
      if (!EXECUTION_MODES.includes(executionMode)) {
        throw new CoreContractError('CORE_INVALID_EXECUTION_MODE', 'executionMode is invalid');
      }
      assertOpaqueId(contextSnapshotId, 'contextSnapshotId');
      assertMachineIdentifier(capabilityKey, 'capabilityKey');
      assertOpaqueId(configVersionId, 'configVersionId');
      assertHash(requestHash, 'requestHash');
      assertIsoTimestamp(createdAt, 'createdAt');

      const snapshot = contextSnapshots.get(contextSnapshotId, requestContext.orgId);
      if (!snapshot || snapshot.purpose !== requestContext.purpose) {
        throw new CoreContractError('CORE_CONTEXT_NOT_FOUND', 'matching context snapshot was not found');
      }
      const capability = capabilities.get(capabilityKey);
      const config = configs.get(configVersionId);
      if (!capability || !config) {
        throw new CoreContractError('CORE_RUN_DEPENDENCY_MISSING', 'run dependency was not found');
      }
      if (config.orgId !== null && config.orgId !== requestContext.orgId) {
        throw new CoreContractError('CORE_CONFIG_OUTSIDE_SCOPE', 'config is outside the request organisation');
      }
      const allowedCapabilityStates = executionMode === 'production'
        ? ['production_active']
        : ['sandbox_only', 'validated', 'approved_disabled'];
      const allowedConfigStates = executionMode === 'production'
        ? ['active']
        : ['validated', 'approved', 'active'];
      if (!allowedCapabilityStates.includes(capability.state)) {
        throw new CoreContractError(
          'CORE_CAPABILITY_DISABLED',
          'capability is not enabled for the requested execution mode',
          { httpStatus: 403 },
        );
      }
      if (!allowedConfigStates.includes(config.state)) {
        throw new CoreContractError(
          'CORE_CONFIG_DISABLED',
          'config is not enabled for the requested execution mode',
          { httpStatus: 403 },
        );
      }
      if (executionMode === 'production' && capability.activeConfigVersionId !== configVersionId) {
        throw new CoreContractError(
          'CORE_CAPABILITY_CONFIG_MISMATCH',
          'capability is not activated with this config version',
          { httpStatus: 403 },
        );
      }

      db.prepare(`
        INSERT INTO core_run (
          id, org_id, run_type, purpose, execution_mode, context_snapshot_id,
          capability_key, config_version_id, state, request_hash,
          state_version, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, 0, ?, ?)
      `).run(
        runId,
        requestContext.orgId,
        runType,
        requestContext.purpose,
        executionMode,
        contextSnapshotId,
        capabilityKey,
        configVersionId,
        requestHash,
        requestContext.actor.userId,
        createdAt,
      );
      return runs.get(runId, requestContext.orgId);
    },

    get(runId, orgId) {
      assertOpaqueId(runId, 'runId');
      assertOpaqueId(orgId, 'orgId');
      const row = db.prepare('SELECT * FROM core_run WHERE id = ? AND org_id = ?').get(runId, orgId);
      if (!row) return null;
      return deepFreeze({
        runId: row.id,
        orgId: row.org_id,
        runType: row.run_type,
        purpose: row.purpose,
        executionMode: row.execution_mode,
        contextSnapshotId: row.context_snapshot_id,
        capabilityKey: row.capability_key,
        configVersionId: row.config_version_id,
        state: row.state,
        requestHash: row.request_hash,
        errorCode: row.error_code,
        stateVersion: row.state_version,
        createdBy: row.created_by,
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
      });
    },

    listSummaries({ orgId, state = null, runType = null, limit = DEFAULT_LIST_LIMIT }) {
      assertOpaqueId(orgId, 'orgId');
      optionalState(state, RUN_STATES);
      if (runType !== null) assertMachineIdentifier(runType, 'runType');
      const rows = db.prepare(`
        SELECT
          id, org_id, run_type, purpose, execution_mode, context_snapshot_id,
          capability_key, config_version_id, state, error_code, state_version,
          created_by, created_at, started_at, completed_at
        FROM core_run
        WHERE org_id = ?
          AND (? IS NULL OR state = ?)
          AND (? IS NULL OR run_type = ?)
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `).all(orgId, state, state, runType, runType, boundedLimit(limit));
      return deepFreeze(rows.map((row) => ({
        runId: row.id,
        orgId: row.org_id,
        runType: row.run_type,
        purpose: row.purpose,
        executionMode: row.execution_mode,
        contextSnapshotId: row.context_snapshot_id,
        capabilityKey: row.capability_key,
        configVersionId: row.config_version_id,
        state: row.state,
        errorCode: row.error_code,
        stateVersion: row.state_version,
        createdBy: row.created_by,
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
      })));
    },

    transition({ requestContext, runId, expectedStateVersion, transition }) {
      validateRequestContext(requestContext);
      assertOpaqueId(runId, 'runId');
      assertNonNegativeInteger(expectedStateVersion, 'expectedStateVersion');
      const checked = revalidateTransition('run', transition);
      const current = runs.get(runId, requestContext.orgId);
      if (!current || current.state !== checked.fromState || current.stateVersion !== expectedStateVersion) {
        throw new CoreContractError('CORE_STALE_RUN', 'run state changed before transition', {
          httpStatus: 409,
        });
      }
      if (checked.toState === 'running') {
        if (
          checked.evidence.contextSnapshotId !== current.contextSnapshotId ||
          checked.evidence.configVersionId !== current.configVersionId ||
          checked.evidence.capabilityKey !== current.capabilityKey
        ) {
          throw new CoreContractError('CORE_RUN_DEPENDENCY_MISMATCH', 'run transition dependencies changed');
        }
      }
      if (checked.toState === 'succeeded') {
        const placeholders = checked.evidence.resultArtifactIds.map(() => '?').join(', ');
        const count = db.prepare(`
          SELECT COUNT(*) AS count FROM core_artifact
          WHERE run_id = ? AND org_id = ? AND id IN (${placeholders})
        `).get(runId, requestContext.orgId, ...checked.evidence.resultArtifactIds)?.count;
        if (Number(count || 0) !== checked.evidence.resultArtifactIds.length) {
          throw new CoreContractError('CORE_RUN_RESULT_MISMATCH', 'result artifacts do not belong to this run');
        }
      }
      const startedAt = checked.toState === 'running' ? nowIso() : current.startedAt;
      const completedAt = checked.evidence.completedAt ?? null;
      const result = db.prepare(`
        UPDATE core_run
        SET state = ?,
            error_code = ?,
            started_at = COALESCE(started_at, ?),
            completed_at = COALESCE(?, completed_at),
            state_version = state_version + 1
        WHERE id = ? AND org_id = ? AND state = ? AND state_version = ?
      `).run(
        checked.toState,
        checked.evidence.errorCode ?? null,
        startedAt,
        completedAt,
        runId,
        requestContext.orgId,
        checked.fromState,
        expectedStateVersion,
      );
      expectChange(result, 'CORE_STALE_RUN', 'run state changed before transition');
      return runs.get(runId, requestContext.orgId);
    },
  });

  function sameSubject(left, right) {
    return (left?.type ?? null) === (right?.type ?? null)
      && (left?.id ?? null) === (right?.id ?? null);
  }

  function validateReportRecordIdentity({
    artifactId,
    artifactType,
    content,
    contextSnapshot,
    supersedesArtifactId,
    createdBy,
  }) {
    if (artifactType !== 'report') return;
    const contentSubject = content?.subject;
    const contentSubjectKeys = contentSubject && typeof contentSubject === 'object' && !Array.isArray(contentSubject)
      ? Object.keys(contentSubject).sort()
      : [];
    if (
      content?.artifactType !== 'report'
      || content?.artifactId !== artifactId
      || contentSubjectKeys.length !== 2
      || contentSubjectKeys[0] !== 'id'
      || contentSubjectKeys[1] !== 'type'
      || !contextSnapshot?.subject
      || !sameSubject(contentSubject, contextSnapshot.subject)
      || content?.lifecycle?.state !== 'draft'
      || !Number.isSafeInteger(content?.validation?.blockerCount)
      || content.validation.blockerCount < 0
      || !content?.template?.key
      || !content?.template?.purpose
      || !content?.template?.legacyReportType
      || !content?.version?.contentFingerprint
      || content?.version?.createdBy !== createdBy
      || (content?.version?.supersedesArtifactId ?? null) !== supersedesArtifactId
    ) {
      throw new CoreContractError(
        'CORE_REPORT_LINEAGE_INVALID',
        'report content is not bound to its immutable Core artifact lineage',
        { httpStatus: 409 },
      );
    }
  }

  function validateSupersessionRelationship({
    successorArtifactId,
    successorArtifactType,
    successorPurpose,
    successorSnapshot,
    successorContent,
    predecessor,
  }) {
    if (predecessor.state !== 'approved') {
      throw new CoreContractError(
        'CORE_PREDECESSOR_NOT_APPROVED',
        'a successor may supersede only an approved predecessor',
        { httpStatus: 409 },
      );
    }
    if (predecessor.artifactType !== successorArtifactType) {
      throw new CoreContractError(
        'CORE_PREDECESSOR_TYPE_MISMATCH',
        'predecessor and successor artifact types do not match',
        { httpStatus: 409 },
      );
    }
    if (predecessor.purpose !== successorPurpose) {
      throw new CoreContractError(
        'CORE_PREDECESSOR_PURPOSE_MISMATCH',
        'predecessor and successor purposes do not match',
        { httpStatus: 409 },
      );
    }
    const predecessorSnapshot = contextSnapshots.get(
      predecessor.contextSnapshotId,
      predecessor.orgId,
    );
    if (!predecessorSnapshot || !sameSubject(predecessorSnapshot.subject, successorSnapshot.subject)) {
      throw new CoreContractError(
        'CORE_PREDECESSOR_SUBJECT_MISMATCH',
        'predecessor and successor subjects do not match',
        { httpStatus: 409 },
      );
    }
    if (successorArtifactType === 'report') {
      const predecessorContent = predecessor.content;
      if (
        predecessorContent?.artifactType !== 'report'
        || predecessorContent?.artifactId !== predecessor.artifactId
        || predecessorContent?.version?.createdBy !== predecessor.createdBy
        || predecessorContent?.template?.key !== successorContent?.template?.key
        || predecessorContent?.template?.purpose !== successorContent?.template?.purpose
        || predecessorContent?.template?.legacyReportType !== successorContent?.template?.legacyReportType
        || successorContent?.artifactId !== successorArtifactId
        || successorContent?.version?.supersedesArtifactId !== predecessor.artifactId
      ) {
        throw new CoreContractError(
          'CORE_PREDECESSOR_REPORT_IDENTITY_MISMATCH',
          'predecessor and successor report identities do not match',
          { httpStatus: 409 },
        );
      }
    }
    return predecessor;
  }

  const artifacts = Object.freeze({
    create({
      requestContext,
      artifactId = newId('artifactId'),
      artifactType,
      contextSnapshotId,
      runId = null,
      configVersionId,
      content,
      supersedesArtifactId = null,
      createdAt = nowIso(),
    }) {
      validateRequestContext(requestContext);
      assertOpaqueId(artifactId, 'artifactId');
      assertMachineIdentifier(artifactType, 'artifactType');
      assertOpaqueId(contextSnapshotId, 'contextSnapshotId');
      nullableId(runId, 'runId');
      assertOpaqueId(configVersionId, 'configVersionId');
      nullableId(supersedesArtifactId, 'supersedesArtifactId');
      assertIsoTimestamp(createdAt, 'createdAt');
      const snapshot = contextSnapshots.get(contextSnapshotId, requestContext.orgId);
      if (!snapshot || snapshot.purpose !== requestContext.purpose) {
        throw new CoreContractError('CORE_CONTEXT_NOT_FOUND', 'matching context snapshot was not found');
      }
      const config = configs.get(configVersionId);
      if (!config || (config.orgId !== null && config.orgId !== requestContext.orgId)) {
        throw new CoreContractError('CORE_CONFIG_OUTSIDE_SCOPE', 'matching config version was not found');
      }
      if (runId !== null) {
        const run = runs.get(runId, requestContext.orgId);
        if (
          !run ||
          run.purpose !== requestContext.purpose ||
          run.contextSnapshotId !== contextSnapshotId ||
          run.configVersionId !== configVersionId
        ) {
          throw new CoreContractError('CORE_RUN_DEPENDENCY_MISMATCH', 'artifact does not match its run');
        }
      }
      const normalizedContent = normalizeJson(content);
      validateReportRecordIdentity({
        artifactId,
        artifactType,
        content: normalizedContent,
        contextSnapshot: snapshot,
        supersedesArtifactId,
        createdBy: requestContext.actor.userId,
      });
      if (supersedesArtifactId !== null) {
        const predecessor = artifacts.get(supersedesArtifactId, requestContext.orgId);
        if (!predecessor) {
          throw new CoreContractError('CORE_PREDECESSOR_NOT_FOUND', 'superseded artifact was not found');
        }
        validateSupersessionRelationship({
          successorArtifactId: artifactId,
          successorArtifactType: artifactType,
          successorPurpose: requestContext.purpose,
          successorSnapshot: snapshot,
          successorContent: normalizedContent,
          predecessor,
        });
      }
      const contentHash = sha256CanonicalJson(normalizedContent);
      return withTransaction(() => {
        db.prepare(`
          INSERT INTO core_artifact (
            id, org_id, artifact_type, purpose, context_snapshot_id, run_id,
            config_version_id, state, content_json, content_hash,
            supersedes_artifact_id, state_version, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, 0, ?, ?, ?)
        `).run(
          artifactId,
          requestContext.orgId,
          artifactType,
          requestContext.purpose,
          contextSnapshotId,
          runId,
          configVersionId,
          JSON.stringify(normalizedContent),
          contentHash,
          supersedesArtifactId,
          requestContext.actor.userId,
          createdAt,
          createdAt,
        );
        const sourceInsert = db.prepare(`
          INSERT INTO core_artifact_source (
            artifact_id, ordinal, source_type, source_id, source_version, source_hash, source_snapshot_id
          ) VALUES (?, ?, ?, ?, ?, ?, NULL)
        `);
        snapshot.sources.forEach((source, ordinal) => {
          sourceInsert.run(
            artifactId,
            ordinal,
            source.sourceType,
            source.sourceId,
            source.version,
            source.contentHash,
          );
        });
        return artifacts.get(artifactId, requestContext.orgId);
      });
    },

    get(artifactId, orgId) {
      assertOpaqueId(artifactId, 'artifactId');
      assertOpaqueId(orgId, 'orgId');
      const row = db.prepare('SELECT * FROM core_artifact WHERE id = ? AND org_id = ?').get(artifactId, orgId);
      if (!row) return null;
      const sources = db.prepare(`
        SELECT source_type, source_id, source_version, source_hash, source_snapshot_id
        FROM core_artifact_source WHERE artifact_id = ? ORDER BY ordinal ASC
      `).all(artifactId).map((source) => ({
        sourceType: source.source_type,
        sourceId: source.source_id,
        version: source.source_version,
        contentHash: source.source_hash,
        sourceSnapshotId: source.source_snapshot_id,
      }));
      return deepFreeze({
        artifactId: row.id,
        orgId: row.org_id,
        artifactType: row.artifact_type,
        purpose: row.purpose,
        contextSnapshotId: row.context_snapshot_id,
        runId: row.run_id,
        configVersionId: row.config_version_id,
        state: row.state,
        content: parseJson(row.content_json, 'content_json'),
        contentHash: row.content_hash,
        supersedesArtifactId: row.supersedes_artifact_id,
        sources,
        stateVersion: row.state_version,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    },

    listSummaries({ orgId, state = null, artifactType = null, runId = null, limit = DEFAULT_LIST_LIMIT }) {
      assertOpaqueId(orgId, 'orgId');
      optionalState(state, ARTIFACT_STATES);
      if (artifactType !== null) assertMachineIdentifier(artifactType, 'artifactType');
      if (runId !== null) assertOpaqueId(runId, 'runId');
      const rows = db.prepare(`
        SELECT
          id, org_id, artifact_type, purpose, context_snapshot_id, run_id,
          config_version_id, state, content_hash, supersedes_artifact_id,
          state_version, created_by, created_at, updated_at
        FROM core_artifact
        WHERE org_id = ?
          AND (? IS NULL OR state = ?)
          AND (? IS NULL OR artifact_type = ?)
          AND (? IS NULL OR run_id = ?)
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
      `).all(
        orgId,
        state,
        state,
        artifactType,
        artifactType,
        runId,
        runId,
        boundedLimit(limit),
      );
      return deepFreeze(rows.map((row) => ({
        artifactId: row.id,
        orgId: row.org_id,
        artifactType: row.artifact_type,
        purpose: row.purpose,
        contextSnapshotId: row.context_snapshot_id,
        runId: row.run_id,
        configVersionId: row.config_version_id,
        state: row.state,
        contentHash: row.content_hash,
        supersedesArtifactId: row.supersedes_artifact_id,
        stateVersion: row.state_version,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));
    },

    transition({ requestContext, artifactId, expectedStateVersion, transition, updatedAt = nowIso() }) {
      validateRequestContext(requestContext);
      assertOpaqueId(artifactId, 'artifactId');
      assertNonNegativeInteger(expectedStateVersion, 'expectedStateVersion');
      assertIsoTimestamp(updatedAt, 'updatedAt');
      const checked = revalidateTransition('artifact', transition);
      const current = artifacts.get(artifactId, requestContext.orgId);
      if (!current || current.state !== checked.fromState || current.stateVersion !== expectedStateVersion) {
        throw new CoreContractError('CORE_STALE_ARTIFACT', 'artifact state changed before transition', {
          httpStatus: 409,
        });
      }
      if (checked.toState === 'approved' && current.artifactType === 'report') {
        const contextSnapshot = contextSnapshots.get(
          current.contextSnapshotId,
          requestContext.orgId,
        );
        validateReportRecordIdentity({
          artifactId: current.artifactId,
          artifactType: current.artifactType,
          content: current.content,
          contextSnapshot,
          supersedesArtifactId: current.supersedesArtifactId,
          createdBy: current.createdBy,
        });
        if (
          current.content.validation.blockerCount !== 0
          || current.content.validation.status === 'blocked'
        ) {
          throw new CoreContractError(
            'CORE_REPORT_VALIDATION_BLOCKED',
            'a report with unresolved validation blockers cannot be approved',
            { httpStatus: 409 },
          );
        }
      }
      if (checked.evidence.reviewId) {
        const review = reviews.get(checked.evidence.reviewId, requestContext.orgId);
        if (!review || review.artifactId !== artifactId) {
          throw new CoreContractError('CORE_REVIEW_MISMATCH', 'review does not belong to this artifact');
        }
        const requiredReviewState = checked.toState === 'approved'
          ? 'approved'
          : checked.toState === 'rejected'
            ? 'rejected'
            : 'changes_requested';
        if (review.state !== requiredReviewState) {
          throw new CoreContractError('CORE_REVIEW_STATE_MISMATCH', 'review decision does not support transition');
        }
      }
      const result = db.prepare(`
        UPDATE core_artifact
        SET state = ?, state_version = state_version + 1, updated_at = ?
        WHERE id = ? AND org_id = ? AND state = ? AND state_version = ?
      `).run(
        checked.toState,
        updatedAt,
        artifactId,
        requestContext.orgId,
        checked.fromState,
        expectedStateVersion,
      );
      expectChange(result, 'CORE_STALE_ARTIFACT', 'artifact state changed before transition');
      return artifacts.get(artifactId, requestContext.orgId);
    },

    validatePredecessor({ requestContext, artifactId }) {
      validateRequestContext(requestContext);
      assertOpaqueId(artifactId, 'artifactId');
      const successor = artifacts.get(artifactId, requestContext.orgId);
      if (!successor) {
        throw new CoreContractError('CORE_ARTIFACT_NOT_FOUND', 'successor artifact was not found', {
          httpStatus: 404,
        });
      }
      if (successor.supersedesArtifactId === null) return null;
      const predecessor = artifacts.get(successor.supersedesArtifactId, requestContext.orgId);
      if (!predecessor) {
        throw new CoreContractError('CORE_PREDECESSOR_NOT_FOUND', 'superseded artifact was not found');
      }
      const successorSnapshot = contextSnapshots.get(
        successor.contextSnapshotId,
        requestContext.orgId,
      );
      if (!successorSnapshot) {
        throw new CoreContractError('CORE_CONTEXT_NOT_FOUND', 'successor context snapshot was not found');
      }
      return validateSupersessionRelationship({
        successorArtifactId: successor.artifactId,
        successorArtifactType: successor.artifactType,
        successorPurpose: successor.purpose,
        successorSnapshot,
        successorContent: successor.content,
        predecessor,
      });
    },
  });

  const reviews = Object.freeze({
    create({
      requestContext,
      reviewId = newId('reviewId'),
      artifactId,
      createdAt = nowIso(),
    }) {
      validateRequestContext(requestContext, { expectedPurpose: 'artifact_review' });
      assertOpaqueId(reviewId, 'reviewId');
      assertOpaqueId(artifactId, 'artifactId');
      assertIsoTimestamp(createdAt, 'createdAt');
      const artifact = artifacts.get(artifactId, requestContext.orgId);
      if (!artifact || artifact.state !== 'review') {
        throw new CoreContractError('CORE_ARTIFACT_NOT_REVIEWABLE', 'artifact is not in review state');
      }
      db.prepare(`
        INSERT INTO core_review (
          id, org_id, artifact_id, artifact_state_version, state, state_version,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)
      `).run(
        reviewId,
        requestContext.orgId,
        artifactId,
        artifact.stateVersion,
        requestContext.actor.userId,
        createdAt,
        createdAt,
      );
      return reviews.get(reviewId, requestContext.orgId);
    },

    get(reviewId, orgId) {
      assertOpaqueId(reviewId, 'reviewId');
      assertOpaqueId(orgId, 'orgId');
      const row = db.prepare('SELECT * FROM core_review WHERE id = ? AND org_id = ?').get(reviewId, orgId);
      if (!row) return null;
      return deepFreeze({
        reviewId: row.id,
        orgId: row.org_id,
        artifactId: row.artifact_id,
        artifactStateVersion: row.artifact_state_version,
        state: row.state,
        reviewerActorId: row.reviewer_actor_id,
        decisionCode: row.decision_code,
        stateVersion: row.state_version,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        decidedAt: row.decided_at,
      });
    },

    listSummaries({ orgId, state = null, artifactId = null, limit = DEFAULT_LIST_LIMIT }) {
      assertOpaqueId(orgId, 'orgId');
      optionalState(state, REVIEW_STATES);
      if (artifactId !== null) assertOpaqueId(artifactId, 'artifactId');
      const rows = db.prepare(`
        SELECT * FROM core_review
        WHERE org_id = ?
          AND (? IS NULL OR state = ?)
          AND (? IS NULL OR artifact_id = ?)
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
      `).all(orgId, state, state, artifactId, artifactId, boundedLimit(limit));
      return deepFreeze(rows.map((row) => ({
        reviewId: row.id,
        orgId: row.org_id,
        artifactId: row.artifact_id,
        artifactStateVersion: row.artifact_state_version,
        state: row.state,
        reviewerActorId: row.reviewer_actor_id,
        decisionCode: row.decision_code,
        stateVersion: row.state_version,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        decidedAt: row.decided_at,
      })));
    },

    transition({ requestContext, reviewId, expectedStateVersion, transition, updatedAt = nowIso() }) {
      validateRequestContext(requestContext, { expectedPurpose: 'artifact_review' });
      assertOpaqueId(reviewId, 'reviewId');
      assertNonNegativeInteger(expectedStateVersion, 'expectedStateVersion');
      assertIsoTimestamp(updatedAt, 'updatedAt');
      const checked = revalidateTransition('review', transition);
      const current = reviews.get(reviewId, requestContext.orgId);
      if (!current || current.state !== checked.fromState || current.stateVersion !== expectedStateVersion) {
        throw new CoreContractError('CORE_STALE_REVIEW', 'review state changed before transition', {
          httpStatus: 409,
        });
      }
      const evidence = checked.evidence;
      const result = db.prepare(`
        UPDATE core_review
        SET state = ?,
            reviewer_actor_id = COALESCE(?, reviewer_actor_id),
            decision_code = COALESCE(?, decision_code),
            decided_at = COALESCE(?, decided_at),
            state_version = state_version + 1,
            updated_at = ?
        WHERE id = ? AND org_id = ? AND state = ? AND state_version = ?
      `).run(
        checked.toState,
        evidence.reviewerActorId ?? null,
        evidence.decisionCode ?? evidence.reasonCode ?? null,
        evidence.decisionAt ?? null,
        updatedAt,
        reviewId,
        requestContext.orgId,
        checked.fromState,
        expectedStateVersion,
      );
      expectChange(result, 'CORE_STALE_REVIEW', 'review state changed before transition');
      return reviews.get(reviewId, requestContext.orgId);
    },
  });

  const jobs = Object.freeze({
    create({
      requestContext,
      jobId = newId('jobId'),
      jobType,
      runId = null,
      priority = 100,
      maxAttempts = 1,
      availableAt = nowIso(),
      createdAt = nowIso(),
    }) {
      validateRequestContext(requestContext);
      assertOpaqueId(jobId, 'jobId');
      assertMachineIdentifier(jobType, 'jobType');
      nullableId(runId, 'runId');
      if (!Number.isSafeInteger(priority) || priority < 0 || priority > 1000) {
        throw new CoreContractError('CORE_INVALID_PRIORITY', 'priority must be between 0 and 1000');
      }
      if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
        throw new CoreContractError('CORE_INVALID_ATTEMPTS', 'maxAttempts must be between 1 and 10');
      }
      assertIsoTimestamp(availableAt, 'availableAt');
      assertIsoTimestamp(createdAt, 'createdAt');
      if (runId !== null && !runs.get(runId, requestContext.orgId)) {
        throw new CoreContractError('CORE_RUN_NOT_FOUND', 'job run was not found');
      }
      db.prepare(`
        INSERT INTO core_job (
          id, org_id, job_type, purpose, run_id, state, priority, attempt,
          max_attempts, available_at, state_version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'queued', ?, 0, ?, ?, 0, ?, ?)
      `).run(
        jobId,
        requestContext.orgId,
        jobType,
        requestContext.purpose,
        runId,
        priority,
        maxAttempts,
        availableAt,
        createdAt,
        createdAt,
      );
      return jobs.get(jobId, requestContext.orgId);
    },

    get(jobId, orgId) {
      assertOpaqueId(jobId, 'jobId');
      assertOpaqueId(orgId, 'orgId');
      const row = db.prepare('SELECT * FROM core_job WHERE id = ? AND org_id = ?').get(jobId, orgId);
      if (!row) return null;
      return deepFreeze({
        jobId: row.id,
        orgId: row.org_id,
        jobType: row.job_type,
        purpose: row.purpose,
        runId: row.run_id,
        state: row.state,
        priority: row.priority,
        attempt: row.attempt,
        maxAttempts: row.max_attempts,
        availableAt: row.available_at,
        leaseId: row.lease_id,
        workerId: row.worker_id,
        leaseExpiresAt: row.lease_expires_at,
        errorCode: row.error_code,
        stateVersion: row.state_version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
      });
    },

    listSummaries({ orgId, state = null, jobType = null, limit = DEFAULT_LIST_LIMIT }) {
      assertOpaqueId(orgId, 'orgId');
      optionalState(state, JOB_STATES);
      if (jobType !== null) assertMachineIdentifier(jobType, 'jobType');
      const rows = db.prepare(`
        SELECT * FROM core_job
        WHERE org_id = ?
          AND (? IS NULL OR state = ?)
          AND (? IS NULL OR job_type = ?)
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `).all(orgId, state, state, jobType, jobType, boundedLimit(limit));
      return deepFreeze(rows.map((row) => ({
        jobId: row.id,
        orgId: row.org_id,
        jobType: row.job_type,
        purpose: row.purpose,
        runId: row.run_id,
        state: row.state,
        priority: row.priority,
        attempt: row.attempt,
        maxAttempts: row.max_attempts,
        availableAt: row.available_at,
        leaseId: row.lease_id,
        workerId: row.worker_id,
        leaseExpiresAt: row.lease_expires_at,
        errorCode: row.error_code,
        stateVersion: row.state_version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
      })));
    },

    transition({ requestContext, jobId, expectedStateVersion, transition, updatedAt = nowIso() }) {
      validateRequestContext(requestContext);
      assertOpaqueId(jobId, 'jobId');
      assertNonNegativeInteger(expectedStateVersion, 'expectedStateVersion');
      assertIsoTimestamp(updatedAt, 'updatedAt');
      const checked = revalidateTransition('job', transition);
      const current = jobs.get(jobId, requestContext.orgId);
      if (!current || current.state !== checked.fromState || current.stateVersion !== expectedStateVersion) {
        throw new CoreContractError('CORE_STALE_JOB', 'job state changed before transition', {
          httpStatus: 409,
        });
      }
      const evidence = checked.evidence;
      const attemptIncrement = checked.fromState === 'queued' && checked.toState === 'leased' ? 1 : 0;
      if (current.attempt + attemptIncrement > current.maxAttempts) {
        throw new CoreContractError('CORE_JOB_ATTEMPTS_EXHAUSTED', 'job attempt limit is exhausted', {
          httpStatus: 409,
        });
      }
      const result = db.prepare(`
        UPDATE core_job
        SET state = ?,
            attempt = attempt + ?,
            lease_id = CASE WHEN ? IS NULL THEN lease_id ELSE ? END,
            worker_id = CASE WHEN ? IS NULL THEN worker_id ELSE ? END,
            lease_expires_at = CASE WHEN ? IS NULL THEN lease_expires_at ELSE ? END,
            error_code = COALESCE(?, error_code),
            completed_at = COALESCE(?, completed_at),
            state_version = state_version + 1,
            updated_at = ?
        WHERE id = ? AND org_id = ? AND state = ? AND state_version = ?
      `).run(
        checked.toState,
        attemptIncrement,
        evidence.leaseId ?? null,
        evidence.leaseId ?? null,
        evidence.workerId ?? null,
        evidence.workerId ?? null,
        evidence.leaseExpiresAt ?? null,
        evidence.leaseExpiresAt ?? null,
        evidence.errorCode ?? null,
        evidence.completedAt ?? null,
        updatedAt,
        jobId,
        requestContext.orgId,
        checked.fromState,
        expectedStateVersion,
      );
      expectChange(result, 'CORE_STALE_JOB', 'job state changed before transition');
      return jobs.get(jobId, requestContext.orgId);
    },
  });

  const audit = Object.freeze({
    append(event) {
      validateContentFreeAuditPayload(event);
      db.prepare(`
        INSERT INTO core_audit_event (
          id, state, org_id, actor_user_id, request_id, run_id, event_type,
          entity_type, entity_id, action, outcome, from_state, to_state,
          reason_code, metadata_json, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.eventId,
        event.state,
        event.orgId,
        event.actorUserId,
        event.requestId,
        event.runId,
        event.eventType,
        event.entityType,
        event.entityId,
        event.action,
        event.outcome,
        event.fromState,
        event.toState,
        event.reasonCode,
        JSON.stringify(event.metadata),
        event.occurredAt,
      );
      return event;
    },

    listSummaries({
      orgId,
      eventType = null,
      entityType = null,
      entityId = null,
      runId = null,
      limit = DEFAULT_LIST_LIMIT,
    }) {
      assertOpaqueId(orgId, 'orgId');
      if (eventType !== null) assertMachineIdentifier(eventType, 'eventType');
      if (entityType !== null && !AUDIT_ENTITY_TYPES.includes(entityType)) {
        throw new CoreContractError('CORE_INVALID_AUDIT_ENTITY', 'audit entity type is invalid');
      }
      if (entityId !== null) assertOpaqueId(entityId, 'entityId');
      if (runId !== null) assertOpaqueId(runId, 'runId');
      const rows = db.prepare(`
        SELECT * FROM core_audit_event
        WHERE org_id = ?
          AND (? IS NULL OR event_type = ?)
          AND (? IS NULL OR entity_type = ?)
          AND (? IS NULL OR entity_id = ?)
          AND (? IS NULL OR run_id = ?)
        ORDER BY occurred_at DESC, id DESC
        LIMIT ?
      `).all(
        orgId,
        eventType,
        eventType,
        entityType,
        entityType,
        entityId,
        entityId,
        runId,
        runId,
        boundedLimit(limit),
      );
      return deepFreeze(rows.map((row) => {
        const event = {
          schemaVersion: 1,
          eventId: row.id,
          state: row.state,
          eventType: row.event_type,
          action: row.action,
          outcome: row.outcome,
          entityType: row.entity_type,
          entityId: row.entity_id,
          orgId: row.org_id,
          actorUserId: row.actor_user_id,
          requestId: row.request_id,
          runId: row.run_id,
          fromState: row.from_state,
          toState: row.to_state,
          reasonCode: row.reason_code,
          metadata: parseJson(row.metadata_json, 'metadata_json'),
          occurredAt: row.occurred_at,
        };
        validateContentFreeAuditPayload(event);
        return event;
      }));
    },
  });

  const idempotency = Object.freeze({
    claim(record) {
      validateIdempotencyRecord(record);
      const result = db.prepare(`
        INSERT OR IGNORE INTO core_idempotency_key (
          org_id, route_id, key_hash, request_hash, state, response_ref,
          response_status, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.orgId,
        record.routeId,
        record.keyHash,
        record.requestHash,
        record.state,
        record.responseRef,
        record.responseStatus,
        record.createdAt,
        record.expiresAt,
      );
      return deepFreeze({
        created: Number(result.changes || 0) === 1,
        record: idempotency.get(record.orgId, record.routeId, record.keyHash),
      });
    },

    get(orgId, routeId, keyHash) {
      assertOpaqueId(orgId, 'orgId');
      assertMachineIdentifier(routeId, 'routeId');
      assertHash(keyHash, 'keyHash');
      const row = db.prepare(`
        SELECT * FROM core_idempotency_key
        WHERE org_id = ? AND route_id = ? AND key_hash = ?
      `).get(orgId, routeId, keyHash);
      if (!row) return null;
      const record = {
        schemaVersion: 1,
        orgId: row.org_id,
        routeId: row.route_id,
        keyHash: row.key_hash,
        requestHash: row.request_hash,
        state: row.state,
        responseRef: row.response_ref,
        responseStatus: row.response_status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };
      validateIdempotencyRecord(record);
      return deepFreeze(record);
    },

    complete(record, response) {
      const completed = completeIdempotencyRecord(record, response);
      const result = db.prepare(`
        UPDATE core_idempotency_key
        SET state = 'completed', response_ref = ?, response_status = ?
        WHERE org_id = ? AND route_id = ? AND key_hash = ? AND state = 'pending' AND request_hash = ?
      `).run(
        completed.responseRef,
        completed.responseStatus,
        completed.orgId,
        completed.routeId,
        completed.keyHash,
        completed.requestHash,
      );
      expectChange(result, 'CORE_STALE_IDEMPOTENCY', 'idempotency record changed before completion');
      return idempotency.get(completed.orgId, completed.routeId, completed.keyHash);
    },

    removeExpired(record, now = nowIso()) {
      validateIdempotencyRecord(record);
      assertIsoTimestamp(now, 'now');
      if (Date.parse(record.expiresAt) > Date.parse(now)) return false;
      const result = db.prepare(`
        DELETE FROM core_idempotency_key
        WHERE org_id = ? AND route_id = ? AND key_hash = ? AND expires_at <= ?
      `).run(record.orgId, record.routeId, record.keyHash, now);
      return Number(result.changes || 0) === 1;
    },
  });

  return Object.freeze({
    withTransaction,
    contextSnapshots,
    configs,
    capabilities,
    runs,
    artifacts,
    reviews,
    jobs,
    audit,
    idempotency,
  });
}
