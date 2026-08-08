import { createHash } from 'node:crypto';

import { CoreContractError } from './errors.mjs';
import { deepFreeze, sha256CanonicalJson } from './json.mjs';
import { validateRequestContext } from './requestContext.mjs';
import {
  assertExactKeys,
  assertIsoTimestamp,
  assertMachineIdentifier,
  assertOpaqueId,
} from './values.mjs';

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,200}$/;
const SHA256_RE = /^sha256:[a-f0-9]{64}$/;
const IDEMPOTENCY_STATES = Object.freeze(['pending', 'completed']);

export function validateIdempotencyKey(value) {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_RE.test(value)) {
    throw new CoreContractError(
      'CORE_INVALID_IDEMPOTENCY_KEY',
      'idempotency key must be an opaque 8-200 character token',
    );
  }
  return value;
}

/** Only this digest, never the caller's raw key, is persisted. */
export function hashIdempotencyKey(value) {
  validateIdempotencyKey(value);
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

/**
 * Fingerprints request semantics without retaining the request body. The
 * caller may persist the digest; it must not persist or audit `payload`.
 */
export function fingerprintIdempotentRequest({ requestContext, payload }) {
  validateRequestContext(requestContext);
  return sha256CanonicalJson({
    schemaVersion: 1,
    orgId: requestContext.orgId,
    routeId: requestContext.routeId,
    purpose: requestContext.purpose,
    payload,
  });
}

export function createPendingIdempotencyRecord({
  requestContext,
  idempotencyKey,
  requestHash,
  createdAt = new Date().toISOString(),
  expiresAt,
}) {
  validateRequestContext(requestContext);
  if (!SHA256_RE.test(requestHash)) {
    throw new CoreContractError('CORE_INVALID_HASH', 'requestHash must be a SHA-256 digest');
  }
  assertIsoTimestamp(createdAt, 'createdAt');
  assertIsoTimestamp(expiresAt, 'expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(createdAt)) {
    throw new CoreContractError('CORE_INVALID_EXPIRY', 'idempotency expiry must follow creation');
  }
  return deepFreeze({
    schemaVersion: 1,
    orgId: requestContext.orgId,
    routeId: requestContext.routeId,
    keyHash: hashIdempotencyKey(idempotencyKey),
    requestHash,
    state: 'pending',
    responseRef: null,
    responseStatus: null,
    createdAt,
    expiresAt,
  });
}

export function completeIdempotencyRecord(record, {
  responseRef,
  responseStatus,
}) {
  validateIdempotencyRecord(record);
  if (record.state !== 'pending') {
    throw new CoreContractError(
      'CORE_IDEMPOTENCY_ALREADY_COMPLETED',
      'idempotency record is already completed',
      { httpStatus: 409 },
    );
  }
  assertOpaqueId(responseRef, 'responseRef');
  if (!Number.isInteger(responseStatus) || responseStatus < 200 || responseStatus > 599) {
    throw new CoreContractError('CORE_INVALID_RESPONSE_STATUS', 'responseStatus must be an HTTP status');
  }
  return deepFreeze({
    ...record,
    state: 'completed',
    responseRef,
    responseStatus,
  });
}

export function validateIdempotencyRecord(record) {
  assertExactKeys(record, {
    field: 'idempotencyRecord',
    allowed: [
      'schemaVersion',
      'orgId',
      'routeId',
      'keyHash',
      'requestHash',
      'state',
      'responseRef',
      'responseStatus',
      'createdAt',
      'expiresAt',
    ],
    required: [
      'schemaVersion',
      'orgId',
      'routeId',
      'keyHash',
      'requestHash',
      'state',
      'responseRef',
      'responseStatus',
      'createdAt',
      'expiresAt',
    ],
  });
  if (record.schemaVersion !== 1) {
    throw new CoreContractError('CORE_IDEMPOTENCY_VERSION_UNSUPPORTED', 'idempotency version is unsupported');
  }
  assertOpaqueId(record.orgId, 'idempotencyRecord.orgId');
  assertMachineIdentifier(record.routeId, 'idempotencyRecord.routeId');
  if (!SHA256_RE.test(record.keyHash) || !SHA256_RE.test(record.requestHash)) {
    throw new CoreContractError('CORE_INVALID_HASH', 'idempotency hashes must be SHA-256 digests');
  }
  if (!IDEMPOTENCY_STATES.includes(record.state)) {
    throw new CoreContractError('CORE_INVALID_STATE', 'idempotency state is invalid');
  }
  assertIsoTimestamp(record.createdAt, 'idempotencyRecord.createdAt');
  assertIsoTimestamp(record.expiresAt, 'idempotencyRecord.expiresAt');
  if (record.state === 'pending') {
    if (record.responseRef !== null || record.responseStatus !== null) {
      throw new CoreContractError('CORE_INVALID_IDEMPOTENCY_RECORD', 'pending record cannot have a response');
    }
  } else {
    assertOpaqueId(record.responseRef, 'idempotencyRecord.responseRef');
    if (!Number.isInteger(record.responseStatus) || record.responseStatus < 200 || record.responseStatus > 599) {
      throw new CoreContractError('CORE_INVALID_RESPONSE_STATUS', 'completed record needs an HTTP status');
    }
  }
  return record;
}

/**
 * Returns replay posture for an existing row without exposing stored content.
 */
export function resolveIdempotencyReplay(record, { requestHash, now = new Date().toISOString() }) {
  validateIdempotencyRecord(record);
  if (!SHA256_RE.test(requestHash)) {
    throw new CoreContractError('CORE_INVALID_HASH', 'requestHash must be a SHA-256 digest');
  }
  assertIsoTimestamp(now, 'now');
  if (Date.parse(record.expiresAt) <= Date.parse(now)) return deepFreeze({ action: 'replace_expired' });
  if (record.requestHash !== requestHash) {
    throw new CoreContractError(
      'CORE_IDEMPOTENCY_CONFLICT',
      'idempotency key was already used for a different request',
      { httpStatus: 409 },
    );
  }
  if (record.state === 'pending') return deepFreeze({ action: 'in_progress' });
  return deepFreeze({
    action: 'replay',
    responseRef: record.responseRef,
    responseStatus: record.responseStatus,
  });
}
