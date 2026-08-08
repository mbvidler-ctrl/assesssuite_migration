import { randomUUID } from 'node:crypto';

import { CoreContractError } from './errors.mjs';
import { deepFreeze, normalizeJson, sha256CanonicalJson } from './json.mjs';
import { CORE_PURPOSES, validateRequestContext } from './requestContext.mjs';
import {
  assertExactKeys,
  assertIsoTimestamp,
  assertMachineIdentifier,
  assertOpaqueId,
} from './values.mjs';

const PURPOSE_SET = new Set(CORE_PURPOSES);
const CLINICAL_PURPOSES = new Set([
  'assessment_discovery',
  'protocol_assistance',
  'report_composition',
]);
const SHA256_RE = /^sha256:[a-f0-9]{64}$/;

function normalizeSubject(subject) {
  if (subject === null || subject === undefined) return null;
  assertExactKeys(subject, {
    field: 'subject',
    allowed: ['type', 'id'],
    required: ['type', 'id'],
  });
  return {
    type: assertMachineIdentifier(subject.type, 'subject.type', { maxLength: 48 }),
    id: assertOpaqueId(subject.id, 'subject.id'),
  };
}

function normalizeSource(source, index, cutoffAt) {
  const field = `sources[${index}]`;
  assertExactKeys(source, {
    field,
    allowed: ['sourceType', 'sourceId', 'version', 'contentHash', 'capturedAt'],
    required: ['sourceType', 'sourceId', 'capturedAt'],
  });
  const normalized = {
    sourceType: assertMachineIdentifier(source.sourceType, `${field}.sourceType`, { maxLength: 48 }),
    sourceId: assertOpaqueId(source.sourceId, `${field}.sourceId`),
    version:
      source.version === undefined || source.version === null
        ? null
        : assertOpaqueId(source.version, `${field}.version`),
    contentHash: source.contentHash ?? null,
    capturedAt: assertIsoTimestamp(source.capturedAt, `${field}.capturedAt`),
  };
  if (normalized.contentHash !== null && !SHA256_RE.test(normalized.contentHash)) {
    throw new CoreContractError('CORE_INVALID_HASH', `${field}.contentHash must be a SHA-256 digest`);
  }
  if (Date.parse(normalized.capturedAt) > Date.parse(cutoffAt)) {
    throw new CoreContractError('CORE_SOURCE_AFTER_CUTOFF', 'a source was captured after the snapshot cutoff');
  }
  return normalized;
}

function normalizeSources(sources, cutoffAt, purpose) {
  if (!Array.isArray(sources)) {
    throw new CoreContractError('CORE_INVALID_SOURCES', 'sources must be an array');
  }
  if (CLINICAL_PURPOSES.has(purpose) && sources.length === 0) {
    throw new CoreContractError(
      'CORE_SOURCE_REQUIRED',
      'clinical-purpose snapshots require at least one source reference',
    );
  }
  const normalized = sources.map((source, index) => normalizeSource(source, index, cutoffAt));
  normalized.sort((a, b) => {
    const left = [a.sourceType, a.sourceId, a.version ?? ''].join('\u0000');
    const right = [b.sourceType, b.sourceId, b.version ?? ''].join('\u0000');
    return left < right ? -1 : left > right ? 1 : 0;
  });
  const keys = normalized.map((source) =>
    [source.sourceType, source.sourceId, source.version ?? ''].join('\u0000'),
  );
  if (new Set(keys).size !== keys.length) {
    throw new CoreContractError('CORE_DUPLICATE_SOURCE', 'source references must be unique');
  }
  return normalized;
}

/**
 * Creates a frozen, purpose-bound runtime context snapshot.
 *
 * This is not an evaluation context packet. Locked in-silico evaluation
 * packets remain separately frozen research artefacts and must never be
 * populated from runtime patient records through this function.
 */
export function createContextSnapshot({
  requestContext,
  purpose = requestContext?.purpose,
  subject = null,
  sources,
  context,
  cutoffAt,
  createdAt = new Date().toISOString(),
  idFactory = randomUUID,
}) {
  validateRequestContext(requestContext, { expectedPurpose: purpose });
  if (!PURPOSE_SET.has(purpose)) {
    throw new CoreContractError('CORE_INVALID_PURPOSE', 'snapshot purpose is not registered');
  }
  assertIsoTimestamp(cutoffAt, 'cutoffAt');
  assertIsoTimestamp(createdAt, 'createdAt');
  if (Date.parse(cutoffAt) > Date.parse(createdAt)) {
    throw new CoreContractError('CORE_CUTOFF_IN_FUTURE', 'snapshot cutoff must not follow creation');
  }

  const normalizedSubject = normalizeSubject(subject);
  const normalizedSources = normalizeSources(sources, cutoffAt, purpose);
  const normalizedContext = normalizeJson(context);
  const snapshotId = assertOpaqueId(idFactory(), 'snapshotId');
  const hashEnvelope = {
    schemaVersion: 1,
    orgId: requestContext.orgId,
    purpose,
    subject: normalizedSubject,
    sources: normalizedSources,
    context: normalizedContext,
    cutoffAt,
  };

  return deepFreeze({
    schemaVersion: 1,
    snapshotId,
    orgId: requestContext.orgId,
    purpose,
    subject: normalizedSubject,
    sources: normalizedSources,
    context: normalizedContext,
    cutoffAt,
    createdBy: requestContext.actor.userId,
    createdAt,
    contentHash: sha256CanonicalJson(hashEnvelope),
  });
}

export function validateContextSnapshot(snapshot, { expectedPurpose, expectedOrgId } = {}) {
  assertExactKeys(snapshot, {
    field: 'contextSnapshot',
    allowed: [
      'schemaVersion',
      'snapshotId',
      'orgId',
      'purpose',
      'subject',
      'sources',
      'context',
      'cutoffAt',
      'createdBy',
      'createdAt',
      'contentHash',
    ],
    required: [
      'schemaVersion',
      'snapshotId',
      'orgId',
      'purpose',
      'subject',
      'sources',
      'context',
      'cutoffAt',
      'createdBy',
      'createdAt',
      'contentHash',
    ],
  });
  if (snapshot.schemaVersion !== 1) {
    throw new CoreContractError('CORE_SNAPSHOT_VERSION_UNSUPPORTED', 'snapshot version is unsupported');
  }
  assertOpaqueId(snapshot.snapshotId, 'contextSnapshot.snapshotId');
  assertOpaqueId(snapshot.orgId, 'contextSnapshot.orgId');
  if (!PURPOSE_SET.has(snapshot.purpose)) {
    throw new CoreContractError('CORE_INVALID_PURPOSE', 'snapshot purpose is not registered');
  }
  const subject = normalizeSubject(snapshot.subject);
  assertIsoTimestamp(snapshot.cutoffAt, 'contextSnapshot.cutoffAt');
  assertIsoTimestamp(snapshot.createdAt, 'contextSnapshot.createdAt');
  assertOpaqueId(snapshot.createdBy, 'contextSnapshot.createdBy');
  const sources = normalizeSources(snapshot.sources, snapshot.cutoffAt, snapshot.purpose);
  const context = normalizeJson(snapshot.context);
  if (!SHA256_RE.test(snapshot.contentHash)) {
    throw new CoreContractError('CORE_INVALID_HASH', 'snapshot contentHash must be a SHA-256 digest');
  }
  const expectedHash = sha256CanonicalJson({
    schemaVersion: 1,
    orgId: snapshot.orgId,
    purpose: snapshot.purpose,
    subject,
    sources,
    context,
    cutoffAt: snapshot.cutoffAt,
  });
  if (snapshot.contentHash !== expectedHash) {
    throw new CoreContractError('CORE_SNAPSHOT_HASH_MISMATCH', 'snapshot content hash does not match');
  }
  if (expectedPurpose !== undefined && snapshot.purpose !== expectedPurpose) {
    throw new CoreContractError('CORE_PURPOSE_MISMATCH', 'snapshot purpose does not match the operation');
  }
  if (expectedOrgId !== undefined && snapshot.orgId !== expectedOrgId) {
    throw new CoreContractError('CORE_ORG_MISMATCH', 'snapshot organisation does not match the operation');
  }
  return snapshot;
}
