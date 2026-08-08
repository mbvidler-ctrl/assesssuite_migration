import { CoreContractError } from './errors.mjs';
import { deepFreeze } from './json.mjs';
import {
  assertExactKeys,
  assertIsoTimestamp,
  assertMachineIdentifier,
  assertOpaqueId,
  assertPlainObject,
  optionalMachineIdentifier,
  uniqueOpaqueIds,
} from './values.mjs';

export const CORE_PURPOSES = Object.freeze([
  'assessment_discovery',
  'protocol_assistance',
  'report_composition',
  'artifact_review',
  'core_administration',
  'system_job',
  'synthetic_evaluation',
]);

const PURPOSE_SET = new Set(CORE_PURPOSES);

function normalizeActor(sessionUser) {
  assertPlainObject(sessionUser, 'sessionUser');
  const userId = assertOpaqueId(sessionUser.id, 'sessionUser.id');
  const role = assertMachineIdentifier(sessionUser.role, 'sessionUser.role', { maxLength: 48 });
  const accountStatus = optionalMachineIdentifier(
    sessionUser.account_status,
    'sessionUser.account_status',
  );
  const normalizedProfession = sessionUser.profession
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const profession = optionalMachineIdentifier(
    normalizedProfession || null,
    'sessionUser.profession',
  );

  // Email is intentionally not copied into Core context. The legacy router
  // may use it to derive memberships, but Core receives only the stable actor
  // id and server-derived authorisation result.
  return {
    userId,
    role,
    accountStatus,
    profession,
  };
}

/**
 * Builds the trusted boundary object for a Core request.
 *
 * Callers must derive `sessionUser` and `authorisedOrgIds` from the current
 * server session and membership repositories. Nothing in a request body or
 * unverified header may populate those arguments.
 */
export function deriveRequestContext({
  requestId,
  correlationId = null,
  sessionUser,
  authorisedOrgIds,
  selectedOrgId = null,
  purpose,
  routeId,
  receivedAt = new Date().toISOString(),
}) {
  const actor = normalizeActor(sessionUser);
  const orgIds = uniqueOpaqueIds(authorisedOrgIds, 'authorisedOrgIds');
  if (!PURPOSE_SET.has(purpose)) {
    throw new CoreContractError('CORE_INVALID_PURPOSE', 'purpose is not registered');
  }
  assertMachineIdentifier(routeId, 'routeId', { maxLength: 96 });
  assertOpaqueId(requestId, 'requestId');
  assertIsoTimestamp(receivedAt, 'receivedAt');
  if (correlationId !== null) assertOpaqueId(correlationId, 'correlationId');

  let orgId = selectedOrgId;
  if (orgId === null || orgId === undefined) {
    if (orgIds.length !== 1) {
      throw new CoreContractError(
        'CORE_ORG_REQUIRED',
        'an explicit organisation is required when more than one is authorised',
        { httpStatus: 403 },
      );
    }
    [orgId] = orgIds;
  } else {
    assertOpaqueId(orgId, 'selectedOrgId');
  }
  if (!orgIds.includes(orgId)) {
    throw new CoreContractError(
      'CORE_ORG_OUTSIDE_SCOPE',
      'selected organisation is outside the server-derived scope',
      { httpStatus: 403 },
    );
  }

  return deepFreeze({
    schemaVersion: 1,
    requestId,
    correlationId,
    orgId,
    actor,
    purpose,
    routeId,
    receivedAt,
  });
}

/** Rejects hand-built or mutated objects at service boundaries. */
export function validateRequestContext(value, { expectedPurpose, expectedRouteId } = {}) {
  assertExactKeys(value, {
    field: 'requestContext',
    allowed: [
      'schemaVersion',
      'requestId',
      'correlationId',
      'orgId',
      'actor',
      'purpose',
      'routeId',
      'receivedAt',
    ],
    required: ['schemaVersion', 'requestId', 'orgId', 'actor', 'purpose', 'routeId', 'receivedAt'],
  });
  if (value.schemaVersion !== 1) {
    throw new CoreContractError('CORE_CONTEXT_VERSION_UNSUPPORTED', 'request context version is unsupported');
  }
  assertOpaqueId(value.requestId, 'requestContext.requestId');
  assertOpaqueId(value.correlationId, 'requestContext.correlationId', { nullable: true });
  assertOpaqueId(value.orgId, 'requestContext.orgId');
  assertExactKeys(value.actor, {
    field: 'requestContext.actor',
    allowed: ['userId', 'role', 'accountStatus', 'profession'],
    required: ['userId', 'role', 'accountStatus', 'profession'],
  });
  assertOpaqueId(value.actor.userId, 'requestContext.actor.userId');
  assertMachineIdentifier(value.actor.role, 'requestContext.actor.role', { maxLength: 48 });
  optionalMachineIdentifier(value.actor.accountStatus, 'requestContext.actor.accountStatus');
  optionalMachineIdentifier(value.actor.profession, 'requestContext.actor.profession');
  if (!PURPOSE_SET.has(value.purpose)) {
    throw new CoreContractError('CORE_INVALID_PURPOSE', 'request context purpose is not registered');
  }
  assertMachineIdentifier(value.routeId, 'requestContext.routeId', { maxLength: 96 });
  assertIsoTimestamp(value.receivedAt, 'requestContext.receivedAt');
  if (expectedPurpose !== undefined && value.purpose !== expectedPurpose) {
    throw new CoreContractError('CORE_PURPOSE_MISMATCH', 'request context purpose does not match the operation');
  }
  if (expectedRouteId !== undefined && value.routeId !== expectedRouteId) {
    throw new CoreContractError('CORE_ROUTE_MISMATCH', 'request context route does not match the operation');
  }
  return value;
}
