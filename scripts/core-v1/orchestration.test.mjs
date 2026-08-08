import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTOMATION_AUTHORITY,
  DEFAULT_IMPROVEMENT_POLICY,
  WORKFLOW_PLANS,
  createContentFreeTraceEvent,
  createWorkflowPlanEnvelope,
  createWorkflowRunEnvelope,
  resolveImprovementLoop,
  resolveNextWorkflowStep,
  validateWorkflowPlan,
} from '../../server/core/orchestration.mjs';

const NOW = '2026-08-08T01:02:03.000Z';

function errorCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}

function reportPlanEnvelope(providerAuthorization = null) {
  return createWorkflowPlanEnvelope({
    planId: 'report_composition.v1',
    capability: { key: 'core.report_composition', version: 1, state: 'validated' },
    config: { key: 'report_composition.default', version: 1 },
    schema: { key: 'core.report_artifact', version: 1 },
    tools: {
      'report_composition_engine.v1': 1,
      'draft_provider.v1': 1,
    },
    providerAuthorization,
  });
}

function reportRun(planEnvelope, outcomes = []) {
  return createWorkflowRunEnvelope({
    planEnvelope,
    runId: 'run.report.001',
    orgId: 'org.synthetic.001',
    requestId: 'request.synthetic.001',
    artifactId: 'artifact.synthetic.001',
    artifactAuthorActorId: 'actor.author.001',
    outcomes,
    createdAt: NOW,
  });
}

function outcome(stepId, actorId, decisionCode, status = 'succeeded') {
  return { stepId, outcome: status, actorId, completedAt: NOW, decisionCode };
}

test('registered plans are versioned, frozen, bounded, and disable runtime spawning', () => {
  assert.deepEqual(Object.keys(WORKFLOW_PLANS).sort(), [
    'artifact_review.v1',
    'assessment_discovery.v1',
    'protocol_assistance.v1',
    'report_composition.v1',
    'synthetic_evaluation.v1',
  ]);
  for (const plan of Object.values(WORKFLOW_PLANS)) {
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(plan.schemaVersion, 1);
    assert.equal(plan.planVersion, 1);
    assert.equal(plan.orchestration.runtimeAgentSpawning, false);
    assert.ok(plan.orchestration.maxActiveSpecialists <= 4);
    assert.equal(validateWorkflowPlan(plan), plan);
  }
  assert.ok(AUTOMATION_AUTHORITY.prohibited.includes('diagnose'));
  assert.ok(AUTOMATION_AUTHORITY.prohibited.includes('release'));
});

test('invalid clinical workflows cannot remove or merge human review and release control', () => {
  const missingGate = structuredClone(WORKFLOW_PLANS['assessment_discovery.v1']);
  missingGate.steps.pop();
  errorCode(() => validateWorkflowPlan(missingGate), 'CORE_ORCHESTRATION_CLINICAL_GATES_REQUIRED');

  const sameController = structuredClone(WORKFLOW_PLANS['assessment_discovery.v1']);
  sameController.steps[2].specialistRole = 'clinical_reviewer';
  errorCode(() => validateWorkflowPlan(sameController), 'CORE_ORCHESTRATION_CLINICAL_GATES_REQUIRED');

  const workAfterGate = structuredClone(WORKFLOW_PLANS['assessment_discovery.v1']);
  workAfterGate.steps.push({
    id: 'post_gate_draft', kind: 'deterministic_tool', actions: ['draft'],
    specialistRole: 'assessment_specialist', handoffRole: null,
    dependsOn: ['release_gate'], toolRef: 'post_gate_tool.v1', defaultEnabled: true,
  });
  errorCode(() => validateWorkflowPlan(workAfterGate), 'CORE_ORCHESTRATION_CLINICAL_GATES_REQUIRED');
});

test('plans cannot request prohibited clinical authority or autonomous runtime spawning', () => {
  const prescriber = structuredClone(WORKFLOW_PLANS['assessment_discovery.v1']);
  prescriber.steps[0].actions.push('prescribe');
  errorCode(() => validateWorkflowPlan(prescriber), 'CORE_ORCHESTRATION_AUTHORITY_DENIED');

  const spawning = structuredClone(WORKFLOW_PLANS['synthetic_evaluation.v1']);
  spawning.orchestration.runtimeAgentSpawning = true;
  errorCode(() => validateWorkflowPlan(spawning), 'CORE_ORCHESTRATION_RUNTIME_SPAWNING_DENIED');
});

test('draft provider stays disabled without complete explicit sandbox authority', () => {
  const plan = reportPlanEnvelope();
  const afterCompose = reportRun(plan, [outcome('compose_evidence_draft', 'actor.author.001', 'draft_created')]);
  assert.deepEqual(resolveNextWorkflowStep(plan, afterCompose), {
    state: 'disabled',
    reasonCode: 'provider_not_authorised',
    stepId: 'provider_draft_refinement',
    handoff: { fromRole: 'report_specialist', toRole: 'clinical_reviewer' },
  });
  errorCode(() => reportPlanEnvelope({
    capabilityKey: 'core.report_draft_provider',
    state: 'sandbox_only',
    privacyRef: 'privacy.review.001',
  }), 'CORE_REQUIRED_FIELD');
  errorCode(() => reportPlanEnvelope({
    capabilityKey: 'core.report_draft_provider',
    state: 'production_active',
    privacyRef: 'privacy.review.001',
    termsRef: 'terms.review.001',
  }), 'CORE_ORCHESTRATION_PROVIDER_NOT_SANDBOXED');
});

test('complete sandbox provider references may enable only the dormant draft step', () => {
  const plan = reportPlanEnvelope({
    capabilityKey: 'core.report_draft_provider',
    state: 'sandbox_only',
    privacyRef: 'privacy.review.001',
    termsRef: 'terms.review.001',
  });
  assert.ok(plan.enabledStepIds.includes('provider_draft_refinement'));
  assert.equal(Object.isFrozen(plan), true);
});

test('artifact authors cannot approve and reviewers cannot act as release controllers', () => {
  const plan = reportPlanEnvelope();
  const base = [
    outcome('compose_evidence_draft', 'actor.author.001', 'draft_created'),
    outcome('provider_draft_refinement', 'actor.system.001', 'provider_disabled', 'skipped'),
  ];
  errorCode(() => reportRun(plan, [
    ...base,
    outcome('clinical_review', 'actor.author.001', 'approved'),
  ]), 'CORE_ORCHESTRATION_SELF_APPROVAL_DENIED');
  errorCode(() => reportRun(plan, [
    ...base,
    outcome('clinical_review', 'actor.reviewer.001', 'approved'),
    outcome('release_gate', 'actor.reviewer.001', 'gate_passed'),
  ]), 'CORE_ORCHESTRATION_RELEASE_GATE_DENIED');
});

test('a failed prerequisite cannot acquire contradictory later review or gate evidence', () => {
  const plan = reportPlanEnvelope({
    capabilityKey: 'core.report_draft_provider',
    state: 'sandbox_only',
    privacyRef: 'privacy.review.001',
    termsRef: 'terms.review.001',
  });
  errorCode(() => reportRun(plan, [
    outcome('compose_evidence_draft', 'actor.author.001', 'compose_failed', 'failed'),
    outcome('provider_draft_refinement', 'actor.provider.001', 'draft_created'),
  ]), 'CORE_ORCHESTRATION_DEPENDENCY_FAILED');

  errorCode(() => reportRun(plan, [
    outcome('compose_evidence_draft', 'actor.author.001', 'draft_created'),
    outcome('provider_draft_refinement', 'actor.provider.001', 'provider_failed', 'failed'),
    outcome('clinical_review', 'actor.reviewer.001', 'approved'),
  ]), 'CORE_ORCHESTRATION_DEPENDENCY_FAILED');
});

test('locked-test evidence cannot tune a prompt or configuration', () => {
  errorCode(() => resolveImprovementLoop({
    policy: DEFAULT_IMPROVEMENT_POLICY,
    attempts: [],
    proposedAdjustment: {
      kind: 'config',
      basisPartitions: ['validation', 'locked_test'],
      defectLedgerEntryId: 'defect.core.001',
      nextConfigVersionId: 'config.core.002',
    },
  }), 'CORE_ORCHESTRATION_LOCKED_TEST_TUNING_DENIED');

  assert.deepEqual(resolveImprovementLoop({
    policy: DEFAULT_IMPROVEMENT_POLICY,
    attempts: [{
      attempt: 1, partition: 'locked_test', improvement: 0.5,
      defectLedgerEntryId: 'defect.core.locked.001', configVersionId: 'config.core.locked.001',
    }],
    proposedAdjustment: null,
  }), { state: 'halted', reasonCode: 'locked_test_complete', nextAttempt: null });
});

test('three consecutive no-improvement attempts halt and every attempt requires a defect entry', () => {
  const attempts = [1, 2, 3].map((attempt) => ({
    attempt,
    partition: attempt === 1 ? 'development' : 'validation',
    improvement: 0,
    defectLedgerEntryId: `defect.core.00${attempt}`,
    configVersionId: `config.core.00${attempt}`,
  }));
  assert.deepEqual(resolveImprovementLoop({ policy: DEFAULT_IMPROVEMENT_POLICY, attempts, proposedAdjustment: null }), {
    state: 'halted', reasonCode: 'three_no_improvement', nextAttempt: null,
  });
  delete attempts[0].defectLedgerEntryId;
  errorCode(() => resolveImprovementLoop({ policy: DEFAULT_IMPROVEMENT_POLICY, attempts, proposedAdjustment: null }), 'CORE_REQUIRED_FIELD');
});

test('valid deterministic report flow resolves explicit handoffs and completes only after both gates', () => {
  const plan = reportPlanEnvelope();
  let outcomes = [];
  let run = reportRun(plan, outcomes);
  assert.equal(resolveNextWorkflowStep(plan, run).stepId, 'compose_evidence_draft');

  outcomes = [...outcomes, outcome('compose_evidence_draft', 'actor.author.001', 'draft_created')];
  run = reportRun(plan, outcomes);
  assert.equal(resolveNextWorkflowStep(plan, run).state, 'disabled');

  outcomes = [...outcomes, outcome('provider_draft_refinement', 'actor.system.001', 'provider_disabled', 'skipped')];
  run = reportRun(plan, outcomes);
  assert.equal(resolveNextWorkflowStep(plan, run).stepId, 'clinical_review');

  outcomes = [...outcomes, outcome('clinical_review', 'actor.reviewer.001', 'approved')];
  run = reportRun(plan, outcomes);
  assert.equal(resolveNextWorkflowStep(plan, run).stepId, 'release_gate');

  outcomes = [...outcomes, outcome('release_gate', 'actor.controller.001', 'gate_passed')];
  run = reportRun(plan, outcomes);
  assert.deepEqual(resolveNextWorkflowStep(plan, run), {
    state: 'complete', reasonCode: 'workflow_complete', stepId: null, handoff: null,
  });
  assert.equal(Object.isFrozen(run), true);
  assert.equal(Object.isFrozen(run.outcomes), true);
});

test('trace events reject clinical content and retain content-free metadata only', () => {
  const input = {
    eventId: 'event.core.001', runId: 'run.report.001', planId: 'report_composition.v1',
    purpose: 'report_composition', stepId: 'clinical_review', stepKind: 'human_review',
    state: 'completed', reasonCode: 'approved', actorId: 'actor.reviewer.001',
    specialistRole: 'clinical_reviewer', occurredAt: NOW,
  };
  const event = createContentFreeTraceEvent(input);
  assert.equal(Object.isFrozen(event), true);
  assert.equal('prompt' in event, false);
  errorCode(() => createContentFreeTraceEvent({ ...input, prompt: 'synthetic but forbidden' }), 'CORE_UNKNOWN_FIELD');
});
