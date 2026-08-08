import { CoreContractError } from './errors.mjs';
import { deepFreeze } from './json.mjs';
import {
  assertExactKeys,
  assertIsoTimestamp,
  assertMachineIdentifier,
  assertOpaqueId,
  assertPlainObject,
} from './values.mjs';

export const ARTIFACT_STATES = Object.freeze([
  'draft',
  'review',
  'approved',
  'rejected',
  'superseded',
  'withdrawn',
]);
export const RUN_STATES = Object.freeze(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
export const REVIEW_STATES = Object.freeze([
  'pending',
  'in_review',
  'changes_requested',
  'approved',
  'rejected',
  'cancelled',
]);
export const CONFIG_STATES = Object.freeze([
  'draft',
  'validated',
  'approved',
  'active',
  'superseded',
  'retired',
]);
export const CAPABILITY_STATES = Object.freeze([
  'registered',
  'sandbox_only',
  'validated',
  'approved_disabled',
  'production_active',
  'suspended',
  'retired',
]);
export const JOB_STATES = Object.freeze(['queued', 'leased', 'running', 'succeeded', 'failed', 'cancelled']);
export const AUDIT_EVENT_STATES = Object.freeze(['recorded']);

function freezeTransitionMap(map) {
  return deepFreeze(
    Object.fromEntries(
      Object.entries(map).map(([state, targets]) => [state, [...targets]]),
    ),
  );
}

export const ARTIFACT_TRANSITIONS = freezeTransitionMap({
  draft: ['review', 'withdrawn'],
  review: ['draft', 'approved', 'rejected', 'withdrawn'],
  approved: ['superseded', 'withdrawn'],
  rejected: ['draft', 'withdrawn'],
  superseded: [],
  withdrawn: [],
});

export const RUN_TRANSITIONS = freezeTransitionMap({
  queued: ['running', 'cancelled'],
  running: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
});

export const REVIEW_TRANSITIONS = freezeTransitionMap({
  pending: ['in_review', 'cancelled'],
  in_review: ['changes_requested', 'approved', 'rejected', 'cancelled'],
  changes_requested: ['in_review', 'cancelled'],
  approved: [],
  rejected: [],
  cancelled: [],
});

export const CONFIG_TRANSITIONS = freezeTransitionMap({
  draft: ['validated', 'retired'],
  validated: ['draft', 'approved', 'retired'],
  approved: ['draft', 'active', 'retired'],
  active: ['superseded', 'retired'],
  superseded: [],
  retired: [],
});

// There is deliberately no direct transition from registration, validation,
// or suspension to production_active. Activation must pass through an
// explicitly approved-but-disabled state and carry deployment authority.
export const CAPABILITY_TRANSITIONS = freezeTransitionMap({
  registered: ['sandbox_only', 'retired'],
  sandbox_only: ['validated', 'suspended', 'retired'],
  validated: ['sandbox_only', 'approved_disabled', 'suspended', 'retired'],
  approved_disabled: ['production_active', 'sandbox_only', 'suspended', 'retired'],
  production_active: ['approved_disabled', 'suspended', 'retired'],
  suspended: ['sandbox_only', 'approved_disabled', 'retired'],
  retired: [],
});

export const JOB_TRANSITIONS = freezeTransitionMap({
  queued: ['leased', 'cancelled'],
  leased: ['queued', 'running', 'failed', 'cancelled'],
  running: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
});

export const AUDIT_EVENT_TRANSITIONS = freezeTransitionMap({ recorded: [] });

function normalizeEvidence(evidence, allowed) {
  assertExactKeys(evidence, { field: 'transition evidence', allowed });
  return { ...evidence };
}

function requireId(evidence, key) {
  return assertOpaqueId(evidence[key], `transition evidence.${key}`);
}

function requireCode(evidence, key) {
  return assertMachineIdentifier(evidence[key], `transition evidence.${key}`);
}

function requireTime(evidence, key) {
  return assertIsoTimestamp(evidence[key], `transition evidence.${key}`);
}

function makeTransition(domain, transitions, currentState, nextState, evidence) {
  if (!Object.prototype.hasOwnProperty.call(transitions, currentState)) {
    throw new CoreContractError('CORE_INVALID_CURRENT_STATE', `${domain} current state is invalid`);
  }
  if (!Object.prototype.hasOwnProperty.call(transitions, nextState)) {
    throw new CoreContractError('CORE_INVALID_NEXT_STATE', `${domain} next state is invalid`);
  }
  if (!transitions[currentState].includes(nextState)) {
    throw new CoreContractError(
      'CORE_TRANSITION_DENIED',
      `${domain} transition is not allowed`,
      { httpStatus: 409 },
    );
  }
  return deepFreeze({ domain, fromState: currentState, toState: nextState, evidence });
}

export function transitionArtifactState(currentState, nextState, evidence = {}) {
  const normalized = normalizeEvidence(evidence, ['reviewId', 'successorArtifactId', 'reasonCode']);
  if (nextState === 'approved' || nextState === 'rejected') requireId(normalized, 'reviewId');
  if (nextState === 'draft' && currentState !== 'draft') requireId(normalized, 'reviewId');
  if (nextState === 'superseded') requireId(normalized, 'successorArtifactId');
  if (nextState === 'withdrawn') requireCode(normalized, 'reasonCode');
  return makeTransition('artifact', ARTIFACT_TRANSITIONS, currentState, nextState, normalized);
}

export function transitionRunState(currentState, nextState, evidence = {}) {
  const normalized = normalizeEvidence(evidence, [
    'contextSnapshotId',
    'configVersionId',
    'capabilityKey',
    'resultArtifactIds',
    'errorCode',
    'reasonCode',
    'completedAt',
  ]);
  if (nextState === 'running') {
    requireId(normalized, 'contextSnapshotId');
    requireId(normalized, 'configVersionId');
    requireCode(normalized, 'capabilityKey');
  }
  if (nextState === 'succeeded') {
    if (!Array.isArray(normalized.resultArtifactIds) || normalized.resultArtifactIds.length === 0) {
      throw new CoreContractError('CORE_RESULT_REQUIRED', 'a succeeded run requires result artifacts');
    }
    normalized.resultArtifactIds = normalized.resultArtifactIds.map((id, index) =>
      assertOpaqueId(id, `transition evidence.resultArtifactIds[${index}]`),
    );
    if (new Set(normalized.resultArtifactIds).size !== normalized.resultArtifactIds.length) {
      throw new CoreContractError('CORE_DUPLICATE_RESULT', 'result artifact identifiers must be unique');
    }
    requireTime(normalized, 'completedAt');
  }
  if (nextState === 'failed') {
    requireCode(normalized, 'errorCode');
    requireTime(normalized, 'completedAt');
  }
  if (nextState === 'cancelled') {
    requireCode(normalized, 'reasonCode');
    requireTime(normalized, 'completedAt');
  }
  return makeTransition('run', RUN_TRANSITIONS, currentState, nextState, normalized);
}

export function transitionReviewState(currentState, nextState, evidence = {}) {
  const normalized = normalizeEvidence(evidence, [
    'reviewerActorId',
    'decisionAt',
    'decisionCode',
    'reasonCode',
  ]);
  if (nextState === 'in_review') requireId(normalized, 'reviewerActorId');
  if (['changes_requested', 'approved', 'rejected'].includes(nextState)) {
    requireId(normalized, 'reviewerActorId');
    requireTime(normalized, 'decisionAt');
    requireCode(normalized, 'decisionCode');
  }
  if (nextState === 'cancelled') requireCode(normalized, 'reasonCode');
  return makeTransition('review', REVIEW_TRANSITIONS, currentState, nextState, normalized);
}

export function transitionConfigState(currentState, nextState, evidence = {}) {
  const normalized = normalizeEvidence(evidence, [
    'validationRef',
    'approvalRef',
    'deploymentAuthorityRef',
    'successorConfigVersionId',
    'reasonCode',
  ]);
  if (nextState === 'validated') requireId(normalized, 'validationRef');
  if (nextState === 'approved') requireId(normalized, 'approvalRef');
  if (nextState === 'active') {
    requireId(normalized, 'approvalRef');
    requireId(normalized, 'deploymentAuthorityRef');
  }
  if (nextState === 'superseded') requireId(normalized, 'successorConfigVersionId');
  if (nextState === 'retired') requireCode(normalized, 'reasonCode');
  return makeTransition('config', CONFIG_TRANSITIONS, currentState, nextState, normalized);
}

export function transitionCapabilityState(currentState, nextState, evidence = {}) {
  const normalized = normalizeEvidence(evidence, [
    'validationRef',
    'approvalRef',
    'deploymentAuthorityRef',
    'reasonCode',
  ]);
  if (nextState === 'validated') requireId(normalized, 'validationRef');
  if (nextState === 'approved_disabled') requireId(normalized, 'approvalRef');
  if (nextState === 'production_active') {
    requireId(normalized, 'validationRef');
    requireId(normalized, 'approvalRef');
    requireId(normalized, 'deploymentAuthorityRef');
  }
  if (nextState === 'suspended' || nextState === 'retired') requireCode(normalized, 'reasonCode');
  return makeTransition('capability', CAPABILITY_TRANSITIONS, currentState, nextState, normalized);
}

export function transitionJobState(currentState, nextState, evidence = {}) {
  const normalized = normalizeEvidence(evidence, [
    'leaseId',
    'workerId',
    'leaseExpiresAt',
    'completedAt',
    'errorCode',
    'reasonCode',
  ]);
  if (nextState === 'leased') {
    requireId(normalized, 'leaseId');
    requireId(normalized, 'workerId');
    requireTime(normalized, 'leaseExpiresAt');
  }
  if (nextState === 'running') {
    requireId(normalized, 'leaseId');
    requireId(normalized, 'workerId');
  }
  if (nextState === 'succeeded') requireTime(normalized, 'completedAt');
  if (nextState === 'failed') {
    requireCode(normalized, 'errorCode');
    requireTime(normalized, 'completedAt');
  }
  if (nextState === 'cancelled') {
    requireCode(normalized, 'reasonCode');
    requireTime(normalized, 'completedAt');
  }
  return makeTransition('job', JOB_TRANSITIONS, currentState, nextState, normalized);
}

export function transitionAuditEventState(currentState, nextState, evidence = {}) {
  assertPlainObject(evidence, 'transition evidence');
  return makeTransition('audit_event', AUDIT_EVENT_TRANSITIONS, currentState, nextState, evidence);
}
