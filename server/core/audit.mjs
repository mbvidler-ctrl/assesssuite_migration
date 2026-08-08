import { randomUUID } from 'node:crypto';

import { CoreContractError } from './errors.mjs';
import { deepFreeze } from './json.mjs';
import {
  assertExactKeys,
  assertIsoTimestamp,
  assertMachineIdentifier,
  assertOpaqueId,
  assertPlainObject,
} from './values.mjs';

export const AUDIT_OUTCOMES = Object.freeze(['succeeded', 'denied', 'failed', 'noop']);
export const AUDIT_ENTITY_TYPES = Object.freeze([
  'context_snapshot',
  'artifact',
  'run',
  'review',
  'config',
  'capability',
  'job',
  'idempotency',
  'system',
]);

const METADATA_VALIDATORS = Object.freeze({
  artifactType: (value) => assertMachineIdentifier(value, 'metadata.artifactType'),
  capabilityKey: (value) => assertMachineIdentifier(value, 'metadata.capabilityKey'),
  configKey: (value) => assertMachineIdentifier(value, 'metadata.configKey'),
  routeId: (value) => assertMachineIdentifier(value, 'metadata.routeId'),
  purpose: (value) => assertMachineIdentifier(value, 'metadata.purpose'),
  errorCode: (value) => assertControlledErrorCode(value, 'metadata.errorCode'),
  decisionCode: (value) => assertMachineIdentifier(value, 'metadata.decisionCode'),
  policyVersion: (value) => assertOpaqueId(value, 'metadata.policyVersion'),
  subjectType: (value) => assertAuditMachineIdentifier(value, 'metadata.subjectType'),
  subjectId: (value) => assertAuditOpaqueId(value, 'metadata.subjectId'),
  contentFingerprint: (value) => assertReportContentFingerprint(value, 'metadata.contentFingerprint'),
  renderFingerprint: (value) => assertSha256(value, 'metadata.renderFingerprint'),
  compatibilityVersion: (value) => assertCompatibilityVersion(value, 'metadata.compatibilityVersion'),
  httpStatus: (value) => {
    if (!Number.isInteger(value) || value < 100 || value > 599) {
      throw new CoreContractError('CORE_INVALID_AUDIT_METADATA', 'metadata.httpStatus is invalid');
    }
    return value;
  },
  itemCount: (value) => nonNegativeInteger(value, 'metadata.itemCount'),
  sourceCount: (value) => nonNegativeInteger(value, 'metadata.sourceCount'),
  attempt: (value) => nonNegativeInteger(value, 'metadata.attempt'),
  maxAttempts: (value) => nonNegativeInteger(value, 'metadata.maxAttempts'),
  sandbox: (value) => booleanValue(value, 'metadata.sandbox'),
  idempotentReplay: (value) => booleanValue(value, 'metadata.idempotentReplay'),
});

function assertAuditMachineIdentifier(value, field) {
  try {
    return assertMachineIdentifier(value, field);
  } catch {
    throw new CoreContractError('CORE_INVALID_AUDIT_METADATA', `${field} must be a machine identifier`);
  }
}

function assertAuditOpaqueId(value, field) {
  try {
    return assertOpaqueId(value, field);
  } catch {
    throw new CoreContractError('CORE_INVALID_AUDIT_METADATA', `${field} must be an opaque identifier`);
  }
}

function assertSha256(value, field) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw new CoreContractError('CORE_INVALID_AUDIT_METADATA', `${field} must be a SHA-256 digest`);
  }
  return value;
}

function assertReportContentFingerprint(value, field) {
  if (typeof value !== 'string' || !/^fnv1a32:[a-f0-9]{8}$/.test(value)) {
    throw new CoreContractError(
      'CORE_INVALID_AUDIT_METADATA',
      `${field} must be a deterministic report content fingerprint`,
    );
  }
  return value;
}

function assertCompatibilityVersion(value, field) {
  if (value !== 'assesssuite.legacy-report-compatibility.v1') {
    throw new CoreContractError(
      'CORE_INVALID_AUDIT_METADATA',
      `${field} must be the registered legacy compatibility contract`,
    );
  }
  return value;
}

function assertControlledErrorCode(value, field) {
  if (
    typeof value !== 'string' ||
    value.length > 96 ||
    !/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(value)
  ) {
    throw new CoreContractError(
      'CORE_INVALID_AUDIT_METADATA',
      `${field} must be a controlled uppercase error code`,
    );
  }
  return value;
}

function nonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CoreContractError('CORE_INVALID_AUDIT_METADATA', `${field} must be a non-negative integer`);
  }
  return value;
}

function booleanValue(value, field) {
  if (typeof value !== 'boolean') {
    throw new CoreContractError('CORE_INVALID_AUDIT_METADATA', `${field} must be boolean`);
  }
  return value;
}

function nullableId(value, field) {
  return value === undefined || value === null ? null : assertOpaqueId(value, field);
}

function nullableCode(value, field) {
  return value === undefined || value === null ? null : assertMachineIdentifier(value, field);
}

function normalizeMetadata(metadata = {}) {
  assertPlainObject(metadata, 'metadata');
  const normalized = {};
  for (const [key, value] of Object.entries(metadata)) {
    const validate = METADATA_VALIDATORS[key];
    if (!validate) {
      throw new CoreContractError(
        'CORE_AUDIT_CONTENT_FIELD_DENIED',
        'audit metadata contains a field outside the content-free allowlist',
      );
    }
    normalized[key] = validate(value);
  }
  return normalized;
}

/**
 * Creates an append-only operational audit event. The strict allowlist
 * intentionally excludes prompts, names, emails, URLs, queries, notes,
 * clinical content, document content and raw error messages.
 */
export function createAuditEvent({
  eventId,
  eventType,
  action,
  outcome,
  entityType,
  entityId = null,
  orgId = null,
  actorUserId = null,
  requestId = null,
  runId = null,
  fromState = null,
  toState = null,
  reasonCode = null,
  metadata = {},
  occurredAt = new Date().toISOString(),
  idFactory = randomUUID,
}) {
  const event = {
    schemaVersion: 1,
    eventId: assertOpaqueId(eventId ?? idFactory(), 'eventId'),
    state: 'recorded',
    eventType: assertMachineIdentifier(eventType, 'eventType'),
    action: assertMachineIdentifier(action, 'action'),
    outcome,
    entityType,
    entityId: nullableId(entityId, 'entityId'),
    orgId: nullableId(orgId, 'orgId'),
    actorUserId: nullableId(actorUserId, 'actorUserId'),
    requestId: nullableId(requestId, 'requestId'),
    runId: nullableId(runId, 'runId'),
    fromState: nullableCode(fromState, 'fromState'),
    toState: nullableCode(toState, 'toState'),
    reasonCode: nullableCode(reasonCode, 'reasonCode'),
    metadata: normalizeMetadata(metadata),
    occurredAt: assertIsoTimestamp(occurredAt, 'occurredAt'),
  };
  if (!AUDIT_OUTCOMES.includes(outcome)) {
    throw new CoreContractError('CORE_INVALID_AUDIT_OUTCOME', 'audit outcome is invalid');
  }
  if (!AUDIT_ENTITY_TYPES.includes(entityType)) {
    throw new CoreContractError('CORE_INVALID_AUDIT_ENTITY', 'audit entity type is invalid');
  }
  if (entityType !== 'system' && event.entityId === null) {
    throw new CoreContractError('CORE_AUDIT_ENTITY_REQUIRED', 'non-system audit events require entityId');
  }
  if (event.orgId === null && entityType !== 'system') {
    throw new CoreContractError('CORE_AUDIT_ORG_REQUIRED', 'non-system audit events require orgId');
  }
  return deepFreeze(event);
}

export function validateContentFreeAuditPayload(event) {
  assertExactKeys(event, {
    field: 'auditEvent',
    allowed: [
      'schemaVersion',
      'eventId',
      'state',
      'eventType',
      'action',
      'outcome',
      'entityType',
      'entityId',
      'orgId',
      'actorUserId',
      'requestId',
      'runId',
      'fromState',
      'toState',
      'reasonCode',
      'metadata',
      'occurredAt',
    ],
    required: [
      'schemaVersion',
      'eventId',
      'state',
      'eventType',
      'action',
      'outcome',
      'entityType',
      'entityId',
      'orgId',
      'actorUserId',
      'requestId',
      'runId',
      'fromState',
      'toState',
      'reasonCode',
      'metadata',
      'occurredAt',
    ],
  });
  if (event.schemaVersion !== 1 || event.state !== 'recorded') {
    throw new CoreContractError('CORE_INVALID_AUDIT_VERSION', 'audit event version or state is invalid');
  }
  // Rebuild through the creator's validators without generating an id. Any
  // added free-text field or widened metadata shape is rejected above.
  createAuditEvent({
    eventId: event.eventId,
    eventType: event.eventType,
    action: event.action,
    outcome: event.outcome,
    entityType: event.entityType,
    entityId: event.entityId,
    orgId: event.orgId,
    actorUserId: event.actorUserId,
    requestId: event.requestId,
    runId: event.runId,
    fromState: event.fromState,
    toState: event.toState,
    reasonCode: event.reasonCode,
    metadata: event.metadata,
    occurredAt: event.occurredAt,
  });
  return event;
}
