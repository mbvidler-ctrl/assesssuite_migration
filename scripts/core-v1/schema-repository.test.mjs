import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { createAuditEvent } from '../../server/core/audit.mjs';
import { createContextSnapshot } from '../../server/core/contextSnapshot.mjs';
import {
  transitionArtifactState,
  transitionCapabilityState,
  transitionConfigState,
  transitionJobState,
  transitionReviewState,
  transitionRunState,
} from '../../server/core/domainStates.mjs';
import {
  createPendingIdempotencyRecord,
  fingerprintIdempotentRequest,
  hashIdempotencyKey,
} from '../../server/core/idempotency.mjs';
import { createCoreRepositories } from '../../server/core/repository.mjs';
import { deriveRequestContext } from '../../server/core/requestContext.mjs';
import { CORE_SCHEMA_VERSION, installCoreSchema } from '../../server/core/schema.mjs';

const T0 = '2026-08-08T01:00:00.000Z';
const T1 = '2026-08-08T01:01:00.000Z';
const T2 = '2026-08-08T01:02:00.000Z';
const T3 = '2026-08-08T01:03:00.000Z';

function makeContext(purpose, requestId) {
  return deriveRequestContext({
    requestId,
    sessionUser: { id: 'user-001', role: 'user', account_status: 'active' },
    authorisedOrgIds: ['org-alpha'],
    purpose,
    routeId: `core.${purpose}`,
    receivedAt: T0,
  });
}

test('Core schema is additive, idempotent and structurally default-deny', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const first = installCoreSchema(db);
    const second = installCoreSchema(db);
    assert.equal(first.version, CORE_SCHEMA_VERSION);
    assert.equal(first.installed, true);
    assert.equal(second.installed, false);
    const expectedTables = [
      'core_context_snapshot',
      'core_artifact',
      'core_artifact_source',
      'core_run',
      'core_review',
      'core_capability',
      'core_config_version',
      'core_job',
      'core_audit_event',
      'core_idempotency_key',
    ];
    const actual = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'core_%'
    `).all().map((row) => row.name);
    for (const table of expectedTables) assert.ok(actual.includes(table), table);

    assert.throws(
      () => db.prepare(`
        INSERT INTO core_capability (
          capability_key, state, state_version, created_at, updated_at
        ) VALUES ('unsafe', 'production_active', 0, ?, ?)
      `).run(T0, T0),
      /must start registered and disabled/,
    );
  } finally {
    db.close();
  }
});

test('additive install preserves legacy schema/data and permits rollback-era writes', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE entity_Client (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_date TEXT NOT NULL,
        updated_date TEXT NOT NULL,
        created_by TEXT
      );
    `);
    db.prepare(`
      INSERT INTO entity_Client (id, data, created_date, updated_date, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('legacy-client-001', '{"synthetic":true}', T0, T0, 'legacy-user');
    const legacySql = db.prepare(`
      SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'entity_Client'
    `).get().sql;

    installCoreSchema(db);
    assert.equal(
      db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'entity_Client'`).get().sql,
      legacySql,
    );
    assert.deepEqual(db.prepare('SELECT id, data FROM entity_Client ORDER BY id').all().map((row) => ({ ...row })), [
      { id: 'legacy-client-001', data: '{"synthetic":true}' },
    ]);
    // Simulates the retained binary continuing to use only its legacy table
    // after rollback; additive Core tables and FK enforcement do not intercept
    // or rewrite this contract.
    db.prepare(`
      INSERT INTO entity_Client (id, data, created_date, updated_date, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('legacy-client-002', '{"synthetic":true}', T1, T1, 'legacy-user');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM entity_Client').get().count, 2);
  } finally {
    db.close();
  }
});

test('repositories persist a complete synthetic run, review and audit lineage', () => {
  const db = new DatabaseSync(':memory:');
  installCoreSchema(db);
  const repositories = createCoreRepositories(db, { clock: () => new Date(T1) });
  const assessmentContext = makeContext('assessment_discovery', 'request-assessment-001');
  const reviewContext = makeContext('artifact_review', 'request-review-001');
  try {
    const snapshot = createContextSnapshot({
      requestContext: assessmentContext,
      subject: { type: 'client', id: 'synthetic-client-001' },
      sources: [{ sourceType: 'condition', sourceId: 'synthetic-condition-001', capturedAt: T0 }],
      context: { conditions: ['synthetic-condition'] },
      cutoffAt: T0,
      createdAt: T1,
      idFactory: () => 'snapshot-001',
    });
    repositories.contextSnapshots.insert(snapshot);

    let config = repositories.configs.create({
      configVersionId: 'config-001',
      orgId: null,
      configKey: 'assessment_discovery',
      version: 1,
      config: { maximumResults: 25, algorithm: 'deterministic_v1' },
      createdBy: 'user-001',
      createdAt: T0,
    });
    config = repositories.configs.transition({
      configVersionId: config.configVersionId,
      expectedStateVersion: config.stateVersion,
      transition: transitionConfigState('draft', 'validated', { validationRef: 'validation-001' }),
      updatedAt: T1,
    });
    assert.equal(config.state, 'validated');

    let capability = repositories.capabilities.register({
      capabilityKey: 'assessment_discovery',
      createdAt: T0,
    });
    capability = repositories.capabilities.transition({
      capabilityKey: capability.capabilityKey,
      expectedStateVersion: capability.stateVersion,
      transition: transitionCapabilityState('registered', 'sandbox_only'),
      updatedAt: T1,
    });
    assert.equal(capability.state, 'sandbox_only');

    const requestHash = fingerprintIdempotentRequest({
      requestContext: assessmentContext,
      payload: { conditions: ['synthetic-condition'] },
    });
    let run = repositories.runs.create({
      requestContext: assessmentContext,
      runId: 'run-001',
      runType: 'assessment_discovery',
      contextSnapshotId: snapshot.snapshotId,
      capabilityKey: capability.capabilityKey,
      configVersionId: config.configVersionId,
      requestHash,
      createdAt: T1,
    });
    run = repositories.runs.transition({
      requestContext: assessmentContext,
      runId: run.runId,
      expectedStateVersion: run.stateVersion,
      transition: transitionRunState('queued', 'running', {
        contextSnapshotId: snapshot.snapshotId,
        configVersionId: config.configVersionId,
        capabilityKey: capability.capabilityKey,
      }),
    });

    let artifact = repositories.artifacts.create({
      requestContext: assessmentContext,
      artifactId: 'artifact-001',
      artifactType: 'assessment_recommendation',
      contextSnapshotId: snapshot.snapshotId,
      runId: run.runId,
      configVersionId: config.configVersionId,
      content: { recommendations: [{ assessmentId: 'assessment-001', rank: 1 }] },
      createdAt: T2,
    });
    assert.equal(artifact.sources.length, 1);

    run = repositories.runs.transition({
      requestContext: assessmentContext,
      runId: run.runId,
      expectedStateVersion: run.stateVersion,
      transition: transitionRunState('running', 'succeeded', {
        resultArtifactIds: [artifact.artifactId],
        completedAt: T2,
      }),
    });
    assert.equal(run.state, 'succeeded');

    artifact = repositories.artifacts.transition({
      requestContext: assessmentContext,
      artifactId: artifact.artifactId,
      expectedStateVersion: artifact.stateVersion,
      transition: transitionArtifactState('draft', 'review'),
      updatedAt: T2,
    });
    let review = repositories.reviews.create({
      requestContext: reviewContext,
      reviewId: 'review-001',
      artifactId: artifact.artifactId,
      createdAt: T2,
    });
    review = repositories.reviews.transition({
      requestContext: reviewContext,
      reviewId: review.reviewId,
      expectedStateVersion: review.stateVersion,
      transition: transitionReviewState('pending', 'in_review', { reviewerActorId: 'user-001' }),
      updatedAt: T2,
    });
    review = repositories.reviews.transition({
      requestContext: reviewContext,
      reviewId: review.reviewId,
      expectedStateVersion: review.stateVersion,
      transition: transitionReviewState('in_review', 'approved', {
        reviewerActorId: 'user-001', decisionAt: T3, decisionCode: 'clinician_approved',
      }),
      updatedAt: T3,
    });
    artifact = repositories.artifacts.transition({
      requestContext: reviewContext,
      artifactId: artifact.artifactId,
      expectedStateVersion: artifact.stateVersion,
      transition: transitionArtifactState('review', 'approved', { reviewId: review.reviewId }),
      updatedAt: T3,
    });
    assert.equal(artifact.state, 'approved');

    const audit = createAuditEvent({
      eventId: 'event-001',
      eventType: 'core.artifact.transitioned',
      action: 'transition',
      outcome: 'succeeded',
      entityType: 'artifact',
      entityId: artifact.artifactId,
      orgId: assessmentContext.orgId,
      actorUserId: reviewContext.actor.userId,
      requestId: reviewContext.requestId,
      runId: run.runId,
      fromState: 'review',
      toState: 'approved',
      metadata: { artifactType: artifact.artifactType },
      occurredAt: T3,
    });
    repositories.audit.append(audit);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM core_audit_event').get().count, 1);
    const runSummaries = repositories.runs.listSummaries({ orgId: 'org-alpha' });
    const artifactSummaries = repositories.artifacts.listSummaries({ orgId: 'org-alpha' });
    const reviewSummaries = repositories.reviews.listSummaries({ orgId: 'org-alpha' });
    const configSummaries = repositories.configs.listSummaries({ orgId: 'org-alpha' });
    const capabilitySummaries = repositories.capabilities.listSummaries();
    const auditSummaries = repositories.audit.listSummaries({ orgId: 'org-alpha' });
    const filteredAuditSummaries = repositories.audit.listSummaries({
      orgId: 'org-alpha',
      eventType: 'core.artifact.transitioned',
    });
    assert.equal(runSummaries.length, 1);
    assert.equal('requestHash' in runSummaries[0], false);
    assert.equal(artifactSummaries.length, 1);
    assert.equal('content' in artifactSummaries[0], false);
    assert.equal(reviewSummaries.length, 1);
    assert.equal(configSummaries.length, 1);
    assert.equal('config' in configSummaries[0], false);
    assert.equal(capabilitySummaries.length, 1);
    assert.equal(auditSummaries.length, 1);
    assert.equal(filteredAuditSummaries.length, 1);
    assert.equal(filteredAuditSummaries[0].eventId, audit.eventId);
    assert.equal(repositories.audit.listSummaries({
      orgId: 'org-alpha',
      eventType: 'core.report.release_authorized',
    }).length, 0);
    assert.equal(Object.isFrozen(auditSummaries[0].metadata), true);
    assert.throws(
      () => repositories.artifacts.listSummaries({ orgId: 'org-alpha', limit: 101 }),
      (error) => error.code === 'CORE_INVALID_LIST_LIMIT',
    );
    assert.throws(
      () => db.prepare("UPDATE core_audit_event SET outcome = 'failed' WHERE id = 'event-001'").run(),
      /append-only/,
    );
    assert.throws(
      () => db.prepare("UPDATE core_context_snapshot SET purpose = 'report_composition' WHERE id = 'snapshot-001'").run(),
      /immutable/,
    );
  } finally {
    db.close();
  }
});

test('job concurrency and idempotency are bounded structurally', () => {
  const db = new DatabaseSync(':memory:');
  installCoreSchema(db);
  const repositories = createCoreRepositories(db, { clock: () => new Date(T1) });
  const context = makeContext('system_job', 'request-job-001');
  try {
    let first = repositories.jobs.create({ requestContext: context, jobId: 'job-001', jobType: 'compose_report' });
    let second = repositories.jobs.create({ requestContext: context, jobId: 'job-002', jobType: 'compose_report' });
    const jobSummaries = repositories.jobs.listSummaries({ orgId: 'org-alpha', limit: 1 });
    assert.equal(jobSummaries.length, 1);
    assert.equal(jobSummaries[0].jobId, 'job-002');
    first = repositories.jobs.transition({
      requestContext: context,
      jobId: first.jobId,
      expectedStateVersion: first.stateVersion,
      transition: transitionJobState('queued', 'leased', {
        leaseId: 'lease-001', workerId: 'worker-001', leaseExpiresAt: T3,
      }),
    });
    assert.equal(first.state, 'leased');
    assert.throws(
      () => repositories.jobs.transition({
        requestContext: context,
        jobId: second.jobId,
        expectedStateVersion: second.stateVersion,
        transition: transitionJobState('queued', 'leased', {
          leaseId: 'lease-002', workerId: 'worker-002', leaseExpiresAt: T3,
        }),
      }),
      /UNIQUE constraint failed/,
    );

    const requestHash = fingerprintIdempotentRequest({ requestContext: context, payload: { synthetic: true } });
    const pending = createPendingIdempotencyRecord({
      requestContext: context,
      idempotencyKey: 'job-request-key-001',
      requestHash,
      createdAt: T0,
      expiresAt: T3,
    });
    const firstClaim = repositories.idempotency.claim(pending);
    const secondClaim = repositories.idempotency.claim(pending);
    assert.equal(firstClaim.created, true);
    assert.equal(secondClaim.created, false);
    assert.equal(secondClaim.record.keyHash, hashIdempotencyKey('job-request-key-001'));
  } finally {
    db.close();
  }
});

test('production capability activation rejects unrelated or tenant-specific configs', () => {
  const db = new DatabaseSync(':memory:');
  installCoreSchema(db);
  const repositories = createCoreRepositories(db, { clock: () => new Date(T1) });
  try {
    let wrongConfig = repositories.configs.create({
      configVersionId: 'config-wrong-001',
      orgId: null,
      configKey: 'report_composition',
      version: 1,
      config: { mode: 'deterministic_v1' },
      createdBy: 'user-001',
      createdAt: T0,
    });
    wrongConfig = repositories.configs.transition({
      configVersionId: wrongConfig.configVersionId,
      expectedStateVersion: wrongConfig.stateVersion,
      transition: transitionConfigState('draft', 'validated', { validationRef: 'validation-wrong-001' }),
      updatedAt: T1,
    });
    wrongConfig = repositories.configs.transition({
      configVersionId: wrongConfig.configVersionId,
      expectedStateVersion: wrongConfig.stateVersion,
      transition: transitionConfigState('validated', 'approved', { approvalRef: 'approval-wrong-001' }),
      updatedAt: T2,
    });
    wrongConfig = repositories.configs.transition({
      configVersionId: wrongConfig.configVersionId,
      expectedStateVersion: wrongConfig.stateVersion,
      transition: transitionConfigState('approved', 'active', {
        approvalRef: 'approval-wrong-001',
        deploymentAuthorityRef: 'deployment-wrong-001',
      }),
      updatedAt: T3,
    });

    let capability = repositories.capabilities.register({
      capabilityKey: 'assessment_discovery',
      createdAt: T0,
    });
    capability = repositories.capabilities.transition({
      capabilityKey: capability.capabilityKey,
      expectedStateVersion: capability.stateVersion,
      transition: transitionCapabilityState('registered', 'sandbox_only'),
      updatedAt: T1,
    });
    capability = repositories.capabilities.transition({
      capabilityKey: capability.capabilityKey,
      expectedStateVersion: capability.stateVersion,
      transition: transitionCapabilityState('sandbox_only', 'validated', { validationRef: 'validation-cap-001' }),
      updatedAt: T2,
    });
    capability = repositories.capabilities.transition({
      capabilityKey: capability.capabilityKey,
      expectedStateVersion: capability.stateVersion,
      transition: transitionCapabilityState('validated', 'approved_disabled', { approvalRef: 'approval-cap-001' }),
      updatedAt: T3,
    });
    assert.throws(
      () => repositories.capabilities.transition({
        capabilityKey: capability.capabilityKey,
        expectedStateVersion: capability.stateVersion,
        transition: transitionCapabilityState('approved_disabled', 'production_active', {
          validationRef: 'validation-cap-001',
          approvalRef: 'approval-cap-001',
          deploymentAuthorityRef: 'deployment-cap-001',
        }),
        activeConfigVersionId: wrongConfig.configVersionId,
        updatedAt: T3,
      }),
      (error) => error.code === 'CORE_ACTIVE_CONFIG_REQUIRED',
    );
  } finally {
    db.close();
  }
});

test('audit accepts controlled Core error codes without accepting free text', () => {
  const event = createAuditEvent({
    eventId: 'event-error-001',
    eventType: 'core.request.failed',
    action: 'execute',
    outcome: 'failed',
    entityType: 'system',
    requestId: 'request-error-001',
    metadata: { errorCode: 'CORE_CAPABILITY_DISABLED', httpStatus: 403 },
    occurredAt: T3,
  });
  assert.equal(event.metadata.errorCode, 'CORE_CAPABILITY_DISABLED');
  assert.throws(
    () => createAuditEvent({
      eventId: 'event-error-002',
      eventType: 'core.request.failed',
      action: 'execute',
      outcome: 'failed',
      entityType: 'system',
      requestId: 'request-error-002',
      metadata: { errorCode: 'Patient name appeared here' },
      occurredAt: T3,
    }),
    (error) => error.code === 'CORE_INVALID_AUDIT_METADATA',
  );
});

test('release audit evidence accepts only controlled content-free fingerprints', () => {
  const event = createAuditEvent({
    eventId: 'event-release-001',
    eventType: 'core.report.release_authorized',
    action: 'authorize_release',
    outcome: 'succeeded',
    entityType: 'artifact',
    entityId: 'artifact-release-001',
    orgId: 'org-alpha',
    actorUserId: 'controller-001',
    requestId: 'request-release-001',
    fromState: 'approved',
    toState: 'release_authorized',
    metadata: {
      artifactType: 'report',
      policyVersion: 'core-report-release-v1',
      subjectType: 'client',
      subjectId: 'synthetic-client-001',
      contentFingerprint: 'fnv1a32:abcdef01',
      renderFingerprint: `sha256:${'a'.repeat(64)}`,
      compatibilityVersion: 'assesssuite.legacy-report-compatibility.v1',
    },
    occurredAt: T3,
  });
  assert.equal(event.metadata.contentFingerprint, 'fnv1a32:abcdef01');
  assert.equal(event.metadata.subjectType, 'client');
  assert.equal(event.metadata.subjectId, 'synthetic-client-001');
  for (const metadata of [
    { contentFingerprint: 'patient-name' },
    { renderFingerprint: 'sha256:not-a-digest' },
    { compatibilityVersion: 'free text' },
    { subjectType: 'Client Name' },
    { subjectId: 'not an opaque id' },
  ]) {
    assert.throws(
      () => createAuditEvent({
        eventId: `event-release-invalid-${Object.keys(metadata)[0]}`,
        eventType: 'core.report.release_authorized',
        action: 'authorize_release',
        outcome: 'succeeded',
        entityType: 'artifact',
        entityId: 'artifact-release-001',
        orgId: 'org-alpha',
        actorUserId: 'controller-001',
        requestId: 'request-release-invalid',
        fromState: 'approved',
        toState: 'release_authorized',
        metadata,
        occurredAt: T3,
      }),
      (error) => error.code === 'CORE_INVALID_AUDIT_METADATA',
    );
  }
});
