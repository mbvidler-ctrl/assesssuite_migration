import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARTIFACT_TRANSITIONS,
  CAPABILITY_TRANSITIONS,
  CONFIG_TRANSITIONS,
  JOB_TRANSITIONS,
  REVIEW_TRANSITIONS,
  RUN_TRANSITIONS,
  transitionArtifactState,
  transitionAuditEventState,
  transitionCapabilityState,
  transitionConfigState,
  transitionJobState,
  transitionReviewState,
  transitionRunState,
} from '../../server/core/domainStates.mjs';

const NOW = '2026-08-08T01:00:00.000Z';

const evidence = {
  artifact: (from, to) => ({
    ...(['approved', 'rejected'].includes(to) || (to === 'draft' && from !== 'draft') ? { reviewId: 'review-001' } : {}),
    ...(to === 'superseded' ? { successorArtifactId: 'artifact-002' } : {}),
    ...(to === 'withdrawn' ? { reasonCode: 'operator_withdrawal' } : {}),
  }),
  run: (_from, to) => ({
    ...(to === 'running' ? {
      contextSnapshotId: 'snapshot-001',
      configVersionId: 'config-001',
      capabilityKey: 'assessment_discovery',
    } : {}),
    ...(to === 'succeeded' ? { resultArtifactIds: ['artifact-001'], completedAt: NOW } : {}),
    ...(to === 'failed' ? { errorCode: 'provider_failed', completedAt: NOW } : {}),
    ...(to === 'cancelled' ? { reasonCode: 'operator_cancelled', completedAt: NOW } : {}),
  }),
  review: (_from, to) => ({
    ...(to === 'in_review' ? { reviewerActorId: 'user-001' } : {}),
    ...(['changes_requested', 'approved', 'rejected'].includes(to) ? {
      reviewerActorId: 'user-001', decisionAt: NOW, decisionCode: `review_${to}`,
    } : {}),
    ...(to === 'cancelled' ? { reasonCode: 'review_cancelled' } : {}),
  }),
  config: (_from, to) => ({
    ...(to === 'validated' ? { validationRef: 'validation-001' } : {}),
    ...(to === 'approved' ? { approvalRef: 'approval-001' } : {}),
    ...(to === 'active' ? { approvalRef: 'approval-001', deploymentAuthorityRef: 'authority-001' } : {}),
    ...(to === 'superseded' ? { successorConfigVersionId: 'config-002' } : {}),
    ...(to === 'retired' ? { reasonCode: 'config_retired' } : {}),
  }),
  capability: (_from, to) => ({
    ...(to === 'validated' ? { validationRef: 'validation-001' } : {}),
    ...(to === 'approved_disabled' ? { approvalRef: 'approval-001' } : {}),
    ...(to === 'production_active' ? {
      validationRef: 'validation-001', approvalRef: 'approval-001', deploymentAuthorityRef: 'authority-001',
    } : {}),
    ...(['suspended', 'retired'].includes(to) ? { reasonCode: `capability_${to}` } : {}),
  }),
  job: (_from, to) => ({
    ...(to === 'leased' ? { leaseId: 'lease-001', workerId: 'worker-001', leaseExpiresAt: NOW } : {}),
    ...(to === 'running' ? { leaseId: 'lease-001', workerId: 'worker-001' } : {}),
    ...(to === 'succeeded' ? { completedAt: NOW } : {}),
    ...(to === 'failed' ? { errorCode: 'job_failed', completedAt: NOW } : {}),
    ...(to === 'cancelled' ? { reasonCode: 'job_cancelled', completedAt: NOW } : {}),
  }),
};

for (const [domain, transitions, transition] of [
  ['artifact', ARTIFACT_TRANSITIONS, transitionArtifactState],
  ['run', RUN_TRANSITIONS, transitionRunState],
  ['review', REVIEW_TRANSITIONS, transitionReviewState],
  ['config', CONFIG_TRANSITIONS, transitionConfigState],
  ['capability', CAPABILITY_TRANSITIONS, transitionCapabilityState],
  ['job', JOB_TRANSITIONS, transitionJobState],
]) {
  test(`${domain} state machine accepts every declared edge and rejects every undeclared edge`, () => {
    const states = Object.keys(transitions);
    for (const from of states) {
      for (const to of states) {
        if (transitions[from].includes(to)) {
          const result = transition(from, to, evidence[domain](from, to));
          assert.equal(result.fromState, from);
          assert.equal(result.toState, to);
          assert.equal(Object.isFrozen(result), true);
        } else {
          assert.throws(
            () => transition(from, to, evidence[domain](from, to)),
            (error) => error.code === 'CORE_TRANSITION_DENIED',
            `${domain}: ${from} -> ${to}`,
          );
        }
      }
    }
  });
}

test('capability activation cannot skip approval or deployment authority', () => {
  assert.throws(
    () => transitionCapabilityState('validated', 'production_active', {
      validationRef: 'validation-001', approvalRef: 'approval-001', deploymentAuthorityRef: 'authority-001',
    }),
    (error) => error.code === 'CORE_TRANSITION_DENIED',
  );
  assert.throws(
    () => transitionCapabilityState('approved_disabled', 'production_active', {
      validationRef: 'validation-001', approvalRef: 'approval-001',
    }),
    (error) => error.code === 'CORE_INVALID_ID',
  );
});

test('audit events have no state transitions', () => {
  assert.throws(
    () => transitionAuditEventState('recorded', 'recorded'),
    (error) => error.code === 'CORE_TRANSITION_DENIED',
  );
});
