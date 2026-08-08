import { CoreContractError } from './errors.mjs';
import { deepFreeze, sha256CanonicalJson } from './json.mjs';
import {
  assertEnum,
  assertExactKeys,
  assertIsoTimestamp,
  assertMachineIdentifier,
  assertOpaqueId,
  assertPlainObject,
} from './values.mjs';

export const ORCHESTRATION_SCHEMA_VERSION = 1;
export const WORKFLOW_PLAN_VERSION = 1;
export const STEP_KINDS = Object.freeze([
  'deterministic_tool',
  'draft_provider',
  'human_review',
  'release_gate',
]);
export const STEP_OUTCOMES = Object.freeze(['succeeded', 'failed', 'skipped']);
export const IMPROVEMENT_PARTITIONS = Object.freeze([
  'development',
  'validation',
  'locked_test',
]);

const CLINICAL_PURPOSES = new Set([
  'assessment_discovery',
  'protocol_assistance',
  'report_composition',
  'artifact_review',
]);
const PROHIBITED_AUTOMATION_ACTIONS = new Set([
  'diagnose',
  'prescribe',
  'create_clinical_authority',
  'write_clinical_record',
  'approve',
  'release',
  'export',
]);
const AUTOMATION_ACTIONS = new Set(['retrieve', 'score', 'structure', 'draft', 'propose', 'evaluate']);
const MAX_SPECIALIST_ROLES = 4;

export const AUTOMATION_AUTHORITY = deepFreeze({
  allowed: [...AUTOMATION_ACTIONS],
  prohibited: [...PROHIBITED_AUTOMATION_ACTIONS],
  humanReviewMustBeIndependent: true,
  releaseGateIsEligibilityOnly: true,
});

export const DEFAULT_IMPROVEMENT_POLICY = deepFreeze({
  schemaVersion: ORCHESTRATION_SCHEMA_VERSION,
  partitions: [...IMPROVEMENT_PARTITIONS],
  maxAttempts: 6,
  noImprovementLimit: 3,
  minimumImprovement: 0.000001,
  lockedTestMayTune: false,
  defectLedgerEntryRequired: true,
});

function step(id, kind, actions, specialistRole, handoffRole, options = {}) {
  return {
    id,
    kind,
    actions,
    specialistRole,
    handoffRole,
    dependsOn: options.dependsOn ?? [],
    toolRef: options.toolRef ?? null,
    defaultEnabled: options.defaultEnabled ?? true,
  };
}

function rawPlan(id, purpose, capabilityKey, specialists, steps) {
  return {
    schemaVersion: ORCHESTRATION_SCHEMA_VERSION,
    planVersion: WORKFLOW_PLAN_VERSION,
    id,
    purpose,
    capabilityKey,
    orchestration: {
      runtimeAgentSpawning: false,
      maxActiveSpecialists: Math.min(specialists.length, MAX_SPECIALIST_ROLES),
      specialists: specialists.map((role) => ({ role, maxConcurrent: 1 })),
    },
    steps,
  };
}

const RAW_WORKFLOW_PLANS = [
  rawPlan(
    'assessment_discovery.v1',
    'assessment_discovery',
    'core.assessment_discovery',
    ['assessment_specialist', 'clinical_reviewer', 'release_controller'],
    [
      step('rank_catalogue', 'deterministic_tool', ['retrieve', 'score', 'structure', 'propose'], 'assessment_specialist', 'clinical_reviewer', { toolRef: 'assessment_discovery_engine.v1' }),
      step('clinical_review', 'human_review', [], 'clinical_reviewer', 'release_controller', { dependsOn: ['rank_catalogue'] }),
      step('release_gate', 'release_gate', [], 'release_controller', null, { dependsOn: ['clinical_review'] }),
    ],
  ),
  rawPlan(
    'protocol_assistance.v1',
    'protocol_assistance',
    'core.protocol_assistance',
    ['protocol_specialist', 'clinical_reviewer', 'release_controller'],
    [
      step('search_governed_catalogue', 'deterministic_tool', ['retrieve', 'score', 'structure', 'propose'], 'protocol_specialist', 'clinical_reviewer', { toolRef: 'protocol_assistance_search.v1' }),
      step('clinical_review', 'human_review', [], 'clinical_reviewer', 'release_controller', { dependsOn: ['search_governed_catalogue'] }),
      step('release_gate', 'release_gate', [], 'release_controller', null, { dependsOn: ['clinical_review'] }),
    ],
  ),
  rawPlan(
    'report_composition.v1',
    'report_composition',
    'core.report_composition',
    ['report_specialist', 'clinical_reviewer', 'release_controller'],
    [
      step('compose_evidence_draft', 'deterministic_tool', ['retrieve', 'structure', 'draft', 'propose'], 'report_specialist', 'report_specialist', { toolRef: 'report_composition_engine.v1' }),
      step('provider_draft_refinement', 'draft_provider', ['draft', 'propose'], 'report_specialist', 'clinical_reviewer', { dependsOn: ['compose_evidence_draft'], toolRef: 'draft_provider.v1', defaultEnabled: false }),
      step('clinical_review', 'human_review', [], 'clinical_reviewer', 'release_controller', { dependsOn: ['compose_evidence_draft', 'provider_draft_refinement'] }),
      step('release_gate', 'release_gate', [], 'release_controller', null, { dependsOn: ['clinical_review'] }),
    ],
  ),
  rawPlan(
    'artifact_review.v1',
    'artifact_review',
    'core.artifact_review',
    ['review_coordinator', 'clinical_reviewer', 'release_controller'],
    [
      step('prepare_review_packet', 'deterministic_tool', ['retrieve', 'structure', 'propose'], 'review_coordinator', 'clinical_reviewer', { toolRef: 'artifact_review_packet.v1' }),
      step('clinical_review', 'human_review', [], 'clinical_reviewer', 'release_controller', { dependsOn: ['prepare_review_packet'] }),
      step('release_gate', 'release_gate', [], 'release_controller', null, { dependsOn: ['clinical_review'] }),
    ],
  ),
  rawPlan(
    'synthetic_evaluation.v1',
    'synthetic_evaluation',
    'core.synthetic_evaluation',
    ['evaluation_specialist', 'assurance_reviewer'],
    [
      step('run_frozen_evaluation', 'deterministic_tool', ['retrieve', 'score', 'structure', 'evaluate', 'propose'], 'evaluation_specialist', 'assurance_reviewer', { toolRef: 'frozen_evaluation_runner.v1' }),
      step('assurance_review', 'human_review', [], 'assurance_reviewer', null, { dependsOn: ['run_frozen_evaluation'] }),
    ],
  ),
];

function assertVersion(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new CoreContractError('CORE_ORCHESTRATION_INVALID_VERSION', `${field} must be a positive integer`);
  }
  return value;
}

function validateStep(value, index, specialistRoles) {
  const field = `workflowPlan.steps[${index}]`;
  assertExactKeys(value, {
    field,
    allowed: ['id', 'kind', 'actions', 'specialistRole', 'handoffRole', 'dependsOn', 'toolRef', 'defaultEnabled'],
    required: ['id', 'kind', 'actions', 'specialistRole', 'handoffRole', 'dependsOn', 'toolRef', 'defaultEnabled'],
  });
  assertMachineIdentifier(value.id, `${field}.id`);
  assertEnum(value.kind, STEP_KINDS, `${field}.kind`);
  assertMachineIdentifier(value.specialistRole, `${field}.specialistRole`);
  if (!specialistRoles.has(value.specialistRole)) {
    throw new CoreContractError('CORE_ORCHESTRATION_UNKNOWN_SPECIALIST', 'step specialist is not registered by the plan');
  }
  if (value.handoffRole !== null) {
    assertMachineIdentifier(value.handoffRole, `${field}.handoffRole`);
    if (!specialistRoles.has(value.handoffRole)) {
      throw new CoreContractError('CORE_ORCHESTRATION_UNKNOWN_HANDOFF', 'step handoff specialist is not registered by the plan');
    }
  }
  if (!Array.isArray(value.actions)) {
    throw new CoreContractError('CORE_ORCHESTRATION_INVALID_ACTIONS', 'step actions must be an array');
  }
  for (const action of value.actions) {
    assertMachineIdentifier(action, `${field}.actions`);
    if (PROHIBITED_AUTOMATION_ACTIONS.has(action)) {
      throw new CoreContractError('CORE_ORCHESTRATION_AUTHORITY_DENIED', 'workflow requests prohibited automation authority');
    }
    if (!AUTOMATION_ACTIONS.has(action)) {
      throw new CoreContractError('CORE_ORCHESTRATION_UNKNOWN_ACTION', 'workflow requests unregistered automation authority');
    }
  }
  if (!Array.isArray(value.dependsOn)) {
    throw new CoreContractError('CORE_ORCHESTRATION_INVALID_DEPENDENCY', 'step dependencies must be an array');
  }
  value.dependsOn.forEach((id) => assertMachineIdentifier(id, `${field}.dependsOn`));
  if (typeof value.defaultEnabled !== 'boolean') {
    throw new CoreContractError('CORE_ORCHESTRATION_INVALID_ACTIVATION', 'step activation must be boolean');
  }
  if (value.kind === 'deterministic_tool' || value.kind === 'draft_provider') {
    assertMachineIdentifier(value.toolRef, `${field}.toolRef`);
  } else if (value.toolRef !== null) {
    throw new CoreContractError('CORE_ORCHESTRATION_TOOL_FORBIDDEN', 'human and gate steps cannot invoke tools');
  }
  if ((value.kind === 'human_review' || value.kind === 'release_gate') && value.actions.length !== 0) {
    throw new CoreContractError('CORE_ORCHESTRATION_AUTHORITY_DENIED', 'review and gate steps cannot claim automation actions');
  }
  if (value.kind !== 'draft_provider' && !value.defaultEnabled) {
    throw new CoreContractError('CORE_ORCHESTRATION_REQUIRED_STEP_DISABLED', 'only draft-provider steps may be dormant');
  }
  if (value.kind === 'draft_provider' && value.defaultEnabled) {
    throw new CoreContractError('CORE_ORCHESTRATION_PROVIDER_DEFAULT_DENIED', 'draft providers must be dormant by default');
  }
}

export function validateWorkflowPlan(value) {
  assertExactKeys(value, {
    field: 'workflowPlan',
    allowed: ['schemaVersion', 'planVersion', 'id', 'purpose', 'capabilityKey', 'orchestration', 'steps'],
    required: ['schemaVersion', 'planVersion', 'id', 'purpose', 'capabilityKey', 'orchestration', 'steps'],
  });
  if (value.schemaVersion !== ORCHESTRATION_SCHEMA_VERSION || value.planVersion !== WORKFLOW_PLAN_VERSION) {
    throw new CoreContractError('CORE_ORCHESTRATION_PLAN_VERSION_UNSUPPORTED', 'workflow plan version is unsupported');
  }
  assertMachineIdentifier(value.id, 'workflowPlan.id');
  assertMachineIdentifier(value.purpose, 'workflowPlan.purpose');
  assertMachineIdentifier(value.capabilityKey, 'workflowPlan.capabilityKey');
  assertExactKeys(value.orchestration, {
    field: 'workflowPlan.orchestration',
    allowed: ['runtimeAgentSpawning', 'maxActiveSpecialists', 'specialists'],
    required: ['runtimeAgentSpawning', 'maxActiveSpecialists', 'specialists'],
  });
  if (value.orchestration.runtimeAgentSpawning !== false) {
    throw new CoreContractError('CORE_ORCHESTRATION_RUNTIME_SPAWNING_DENIED', 'runtime agent spawning is prohibited');
  }
  if (!Array.isArray(value.orchestration.specialists) || value.orchestration.specialists.length < 1 || value.orchestration.specialists.length > MAX_SPECIALIST_ROLES) {
    throw new CoreContractError('CORE_ORCHESTRATION_SPECIALIST_BOUND', 'workflow specialist count is outside the allowed bound');
  }
  const specialistRoles = new Set();
  for (const specialist of value.orchestration.specialists) {
    assertExactKeys(specialist, { field: 'workflowPlan.orchestration.specialist', allowed: ['role', 'maxConcurrent'], required: ['role', 'maxConcurrent'] });
    assertMachineIdentifier(specialist.role, 'workflowPlan.orchestration.specialist.role');
    if (specialist.maxConcurrent !== 1 || specialistRoles.has(specialist.role)) {
      throw new CoreContractError('CORE_ORCHESTRATION_SPECIALIST_BOUND', 'specialists must be unique and have concurrency one');
    }
    specialistRoles.add(specialist.role);
  }
  if (!Number.isInteger(value.orchestration.maxActiveSpecialists) || value.orchestration.maxActiveSpecialists < 1 || value.orchestration.maxActiveSpecialists > specialistRoles.size) {
    throw new CoreContractError('CORE_ORCHESTRATION_SPECIALIST_BOUND', 'active specialist bound is invalid');
  }
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 12) {
    throw new CoreContractError('CORE_ORCHESTRATION_STEP_BOUND', 'workflow must contain one to twelve steps');
  }
  value.steps.forEach((candidate, index) => validateStep(candidate, index, specialistRoles));
  const ids = value.steps.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new CoreContractError('CORE_ORCHESTRATION_DUPLICATE_STEP', 'workflow step identifiers must be unique');
  }
  const seen = new Set();
  for (const current of value.steps) {
    for (const dependency of current.dependsOn) {
      if (!seen.has(dependency)) {
        throw new CoreContractError('CORE_ORCHESTRATION_INVALID_DEPENDENCY', 'dependencies must reference an earlier step');
      }
    }
    seen.add(current.id);
  }
  if (CLINICAL_PURPOSES.has(value.purpose)) {
    const reviewIndexes = value.steps.map(({ kind }, index) => kind === 'human_review' ? index : -1).filter((index) => index >= 0);
    const gateIndexes = value.steps.map(({ kind }, index) => kind === 'release_gate' ? index : -1).filter((index) => index >= 0);
    const [reviewIndex] = reviewIndexes;
    const [gateIndex] = gateIndexes;
    if (reviewIndexes.length !== 1 || gateIndexes.length !== 1 || gateIndex <= reviewIndex || gateIndex !== value.steps.length - 1) {
      throw new CoreContractError('CORE_ORCHESTRATION_CLINICAL_GATES_REQUIRED', 'clinical workflows require human review followed by a release gate');
    }
    const review = value.steps[reviewIndex];
    const gate = value.steps[gateIndex];
    const prereleaseStepIds = value.steps.slice(0, reviewIndex).map(({ id }) => id);
    if (review.specialistRole === gate.specialistRole || !gate.dependsOn.includes(review.id) || !prereleaseStepIds.every((id) => review.dependsOn.includes(id))) {
      throw new CoreContractError('CORE_ORCHESTRATION_CLINICAL_GATES_REQUIRED', 'clinical review and release control must be distinct and ordered');
    }
  }
  return value;
}

export const WORKFLOW_PLANS = deepFreeze(
  Object.fromEntries(RAW_WORKFLOW_PLANS.map((plan) => {
    validateWorkflowPlan(plan);
    return [plan.id, plan];
  })),
);

function validateReference(value, field, { requireState = false } = {}) {
  assertExactKeys(value, {
    field,
    allowed: requireState ? ['key', 'version', 'state'] : ['key', 'version'],
    required: requireState ? ['key', 'version', 'state'] : ['key', 'version'],
  });
  assertMachineIdentifier(value.key, `${field}.key`);
  assertVersion(value.version, `${field}.version`);
  if (requireState) assertMachineIdentifier(value.state, `${field}.state`);
  return { ...value };
}

function validateProviderAuthorization(value) {
  if (value === null || value === undefined) return null;
  assertExactKeys(value, {
    field: 'providerAuthorization',
    allowed: ['capabilityKey', 'state', 'privacyRef', 'termsRef'],
    required: ['capabilityKey', 'state', 'privacyRef', 'termsRef'],
  });
  if (value.capabilityKey !== 'core.report_draft_provider' || value.state !== 'sandbox_only') {
    throw new CoreContractError('CORE_ORCHESTRATION_PROVIDER_NOT_SANDBOXED', 'draft provider requires the registered sandbox-only provider capability');
  }
  assertOpaqueId(value.privacyRef, 'providerAuthorization.privacyRef');
  assertOpaqueId(value.termsRef, 'providerAuthorization.termsRef');
  return { ...value };
}

export function createWorkflowPlanEnvelope(input) {
  assertExactKeys(input, {
    field: 'workflowPlanEnvelopeInput',
    allowed: ['planId', 'capability', 'config', 'schema', 'tools', 'providerAuthorization'],
    required: ['planId', 'capability', 'config', 'schema', 'tools'],
  });
  const { planId, capability, config, schema, tools, providerAuthorization = null } = input;
  const plan = WORKFLOW_PLANS[planId];
  if (!plan) throw new CoreContractError('CORE_ORCHESTRATION_PLAN_NOT_FOUND', 'workflow plan is not registered');
  const capabilityRef = validateReference(capability, 'capability', { requireState: true });
  if (capabilityRef.key !== plan.capabilityKey) {
    throw new CoreContractError('CORE_ORCHESTRATION_CAPABILITY_MISMATCH', 'workflow capability does not match its plan');
  }
  if (!['sandbox_only', 'validated', 'approved_disabled', 'production_active'].includes(capabilityRef.state)) {
    throw new CoreContractError('CORE_ORCHESTRATION_CAPABILITY_DISABLED', 'workflow capability is not executable');
  }
  const configRef = validateReference(config, 'config');
  const schemaRef = validateReference(schema, 'schema');
  assertPlainObject(tools, 'tools');
  const toolRefs = {};
  for (const current of plan.steps.filter(({ toolRef }) => toolRef !== null)) {
    const supplied = tools[current.toolRef];
    if (!Number.isInteger(supplied) || supplied < 1) {
      throw new CoreContractError('CORE_ORCHESTRATION_TOOL_VERSION_REQUIRED', 'every workflow tool requires an explicit version');
    }
    toolRefs[current.toolRef] = supplied;
  }
  for (const key of Object.keys(tools)) {
    if (!Object.prototype.hasOwnProperty.call(toolRefs, key)) {
      throw new CoreContractError('CORE_ORCHESTRATION_UNKNOWN_TOOL', 'workflow tool reference is not used by its plan');
    }
  }
  const providerRef = validateProviderAuthorization(providerAuthorization);
  const enabledStepIds = plan.steps
    .filter((current) => current.kind !== 'draft_provider' || providerRef !== null)
    .map(({ id }) => id);
  const envelope = {
    schemaVersion: ORCHESTRATION_SCHEMA_VERSION,
    plan,
    references: {
      purpose: plan.purpose,
      capability: capabilityRef,
      config: configRef,
      schema: schemaRef,
      tools: toolRefs,
      providerAuthorization: providerRef,
    },
    enabledStepIds,
  };
  return deepFreeze({ ...envelope, fingerprint: sha256CanonicalJson(envelope) });
}

function validateOutcome(value, index, plan) {
  assertExactKeys(value, {
    field: `workflowRun.outcomes[${index}]`,
    allowed: ['stepId', 'outcome', 'actorId', 'completedAt', 'decisionCode'],
    required: ['stepId', 'outcome', 'actorId', 'completedAt', 'decisionCode'],
  });
  const stepDefinition = plan.steps.find(({ id }) => id === value.stepId);
  if (!stepDefinition) throw new CoreContractError('CORE_ORCHESTRATION_UNKNOWN_STEP', 'outcome references an unknown step');
  assertEnum(value.outcome, STEP_OUTCOMES, 'workflowRun.outcome');
  assertOpaqueId(value.actorId, 'workflowRun.outcome.actorId');
  assertIsoTimestamp(value.completedAt, 'workflowRun.outcome.completedAt');
  assertMachineIdentifier(value.decisionCode, 'workflowRun.outcome.decisionCode');
  return stepDefinition;
}

export function createWorkflowRunEnvelope(input) {
  assertExactKeys(input, {
    field: 'workflowRunEnvelopeInput',
    allowed: ['planEnvelope', 'runId', 'orgId', 'requestId', 'artifactId', 'artifactAuthorActorId', 'outcomes', 'createdAt'],
    required: ['planEnvelope', 'runId', 'orgId', 'requestId', 'artifactId', 'artifactAuthorActorId', 'createdAt'],
  });
  const { planEnvelope, runId, orgId, requestId, artifactId, artifactAuthorActorId, outcomes = [], createdAt } = input;
  if (!Object.values(WORKFLOW_PLANS).includes(planEnvelope?.plan) || !Object.isFrozen(planEnvelope)) {
    throw new CoreContractError('CORE_ORCHESTRATION_PLAN_ENVELOPE_REQUIRED', 'a validated immutable plan envelope is required');
  }
  [runId, orgId, requestId, artifactId, artifactAuthorActorId].forEach((value, index) =>
    assertOpaqueId(value, ['runId', 'orgId', 'requestId', 'artifactId', 'artifactAuthorActorId'][index]),
  );
  assertIsoTimestamp(createdAt, 'createdAt');
  if (!Array.isArray(outcomes)) throw new CoreContractError('CORE_ORCHESTRATION_INVALID_OUTCOMES', 'outcomes must be an array');
  const seen = new Set();
  const completedOutcomes = new Map();
  let reviewerActorId = null;
  for (const [index, outcome] of outcomes.entries()) {
    const definition = validateOutcome(outcome, index, planEnvelope.plan);
    if (seen.has(outcome.stepId)) throw new CoreContractError('CORE_ORCHESTRATION_DUPLICATE_OUTCOME', 'a step may have only one terminal outcome');
    seen.add(outcome.stepId);
    for (const dependency of definition.dependsOn) {
      const dependencyOutcome = completedOutcomes.get(dependency);
      if (!dependencyOutcome) {
        throw new CoreContractError('CORE_ORCHESTRATION_STEP_ORDER', 'step outcome bypasses a dependency');
      }
      if (dependencyOutcome.outcome === 'failed') {
        throw new CoreContractError(
          'CORE_ORCHESTRATION_DEPENDENCY_FAILED',
          'step outcome cannot follow a failed dependency',
        );
      }
    }
    const enabled = planEnvelope.enabledStepIds.includes(outcome.stepId);
    if (!enabled && !(definition.kind === 'draft_provider' && outcome.outcome === 'skipped')) {
      throw new CoreContractError('CORE_ORCHESTRATION_DISABLED_STEP', 'disabled steps may only be recorded as skipped');
    }
    if (definition.kind !== 'draft_provider' && outcome.outcome === 'skipped') {
      throw new CoreContractError('CORE_ORCHESTRATION_SKIP_DENIED', 'required workflow steps cannot be skipped');
    }
    if (definition.kind === 'human_review' && outcome.outcome === 'succeeded') {
      if (outcome.decisionCode !== 'approved') {
        throw new CoreContractError('CORE_ORCHESTRATION_REVIEW_DECISION_DENIED', 'a successful human review must carry an approved decision');
      }
      if (outcome.actorId === artifactAuthorActorId) {
        throw new CoreContractError('CORE_ORCHESTRATION_SELF_APPROVAL_DENIED', 'artifact authors cannot approve their own artifact');
      }
      reviewerActorId = outcome.actorId;
    }
    if (definition.kind === 'release_gate' && outcome.outcome === 'succeeded') {
      if (outcome.decisionCode !== 'gate_passed') {
        throw new CoreContractError('CORE_ORCHESTRATION_RELEASE_GATE_DENIED', 'a successful release gate must carry a gate-passed decision');
      }
      if (reviewerActorId === null || outcome.actorId === artifactAuthorActorId || outcome.actorId === reviewerActorId) {
        throw new CoreContractError('CORE_ORCHESTRATION_RELEASE_GATE_DENIED', 'release gate requires distinct author, reviewer, and controller actors');
      }
    }
    completedOutcomes.set(outcome.stepId, outcome);
  }
  const envelope = {
    schemaVersion: ORCHESTRATION_SCHEMA_VERSION,
    runId,
    orgId,
    requestId,
    artifactId,
    artifactAuthorActorId,
    planFingerprint: planEnvelope.fingerprint,
    planId: planEnvelope.plan.id,
    purpose: planEnvelope.plan.purpose,
    references: planEnvelope.references,
    outcomes: outcomes.map((outcome) => ({ ...outcome })),
    createdAt,
  };
  return deepFreeze({ ...envelope, fingerprint: sha256CanonicalJson(envelope) });
}

export function resolveNextWorkflowStep(planEnvelope, runEnvelope) {
  if (runEnvelope.planFingerprint !== planEnvelope.fingerprint) {
    throw new CoreContractError('CORE_ORCHESTRATION_PLAN_RUN_MISMATCH', 'run and plan envelopes do not match');
  }
  const outcomes = new Map(runEnvelope.outcomes.map((outcome) => [outcome.stepId, outcome]));
  const failed = runEnvelope.outcomes.find(({ outcome }) => outcome === 'failed');
  if (failed) return deepFreeze({ state: 'halted', reasonCode: 'step_failed', stepId: failed.stepId, handoff: null });
  for (const current of planEnvelope.plan.steps) {
    if (outcomes.has(current.id)) continue;
    if (!planEnvelope.enabledStepIds.includes(current.id)) {
      return deepFreeze({ state: 'disabled', reasonCode: 'provider_not_authorised', stepId: current.id, handoff: { fromRole: current.specialistRole, toRole: current.handoffRole } });
    }
    const dependenciesComplete = current.dependsOn.every((id) => outcomes.get(id)?.outcome === 'succeeded' || outcomes.get(id)?.outcome === 'skipped');
    if (!dependenciesComplete) {
      return deepFreeze({ state: 'halted', reasonCode: 'dependency_not_satisfied', stepId: current.id, handoff: null });
    }
    return deepFreeze({ state: 'ready', reasonCode: 'next_step', stepId: current.id, kind: current.kind, specialistRole: current.specialistRole, handoff: { fromRole: current.specialistRole, toRole: current.handoffRole } });
  }
  return deepFreeze({ state: 'complete', reasonCode: 'workflow_complete', stepId: null, handoff: null });
}

export function validateImprovementPolicy(policy = DEFAULT_IMPROVEMENT_POLICY) {
  assertExactKeys(policy, {
    field: 'improvementPolicy',
    allowed: ['schemaVersion', 'partitions', 'maxAttempts', 'noImprovementLimit', 'minimumImprovement', 'lockedTestMayTune', 'defectLedgerEntryRequired'],
    required: ['schemaVersion', 'partitions', 'maxAttempts', 'noImprovementLimit', 'minimumImprovement', 'lockedTestMayTune', 'defectLedgerEntryRequired'],
  });
  if (policy.schemaVersion !== ORCHESTRATION_SCHEMA_VERSION || policy.lockedTestMayTune !== false || policy.defectLedgerEntryRequired !== true) {
    throw new CoreContractError('CORE_ORCHESTRATION_IMPROVEMENT_POLICY_DENIED', 'improvement safety controls cannot be relaxed');
  }
  if (JSON.stringify(policy.partitions) !== JSON.stringify(IMPROVEMENT_PARTITIONS)) {
    throw new CoreContractError('CORE_ORCHESTRATION_PARTITION_POLICY_DENIED', 'evaluation partitions must remain fixed');
  }
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1 || policy.maxAttempts > 12 || !Number.isInteger(policy.noImprovementLimit) || policy.noImprovementLimit !== 3 || typeof policy.minimumImprovement !== 'number' || policy.minimumImprovement < 0) {
    throw new CoreContractError('CORE_ORCHESTRATION_IMPROVEMENT_POLICY_DENIED', 'improvement attempt limits are invalid');
  }
  return policy;
}

export function resolveImprovementLoop({ policy = DEFAULT_IMPROVEMENT_POLICY, attempts, proposedAdjustment }) {
  validateImprovementPolicy(policy);
  if (!Array.isArray(attempts)) throw new CoreContractError('CORE_ORCHESTRATION_INVALID_ATTEMPTS', 'attempts must be an array');
  for (const [index, attempt] of attempts.entries()) {
    assertExactKeys(attempt, {
      field: `attempts[${index}]`,
      allowed: ['attempt', 'partition', 'improvement', 'defectLedgerEntryId', 'configVersionId'],
      required: ['attempt', 'partition', 'improvement', 'defectLedgerEntryId', 'configVersionId'],
    });
    if (attempt.attempt !== index + 1 || typeof attempt.improvement !== 'number' || !Number.isFinite(attempt.improvement)) {
      throw new CoreContractError('CORE_ORCHESTRATION_INVALID_ATTEMPT', 'improvement attempts must be sequential with finite scores');
    }
    assertEnum(attempt.partition, IMPROVEMENT_PARTITIONS, `attempts[${index}].partition`);
    assertOpaqueId(attempt.defectLedgerEntryId, `attempts[${index}].defectLedgerEntryId`);
    assertOpaqueId(attempt.configVersionId, `attempts[${index}].configVersionId`);
  }
  if (proposedAdjustment !== null && proposedAdjustment !== undefined) {
    assertExactKeys(proposedAdjustment, {
      field: 'proposedAdjustment',
      allowed: ['kind', 'basisPartitions', 'defectLedgerEntryId', 'nextConfigVersionId'],
      required: ['kind', 'basisPartitions', 'defectLedgerEntryId', 'nextConfigVersionId'],
    });
    assertEnum(proposedAdjustment.kind, ['prompt', 'config'], 'proposedAdjustment.kind');
    if (!Array.isArray(proposedAdjustment.basisPartitions) || proposedAdjustment.basisPartitions.length < 1) {
      throw new CoreContractError('CORE_ORCHESTRATION_INVALID_ADJUSTMENT_BASIS', 'adjustments require an evaluation basis');
    }
    proposedAdjustment.basisPartitions.forEach((partition) => assertEnum(partition, IMPROVEMENT_PARTITIONS, 'proposedAdjustment.basisPartitions'));
    if (proposedAdjustment.basisPartitions.includes('locked_test')) {
      throw new CoreContractError('CORE_ORCHESTRATION_LOCKED_TEST_TUNING_DENIED', 'locked-test results cannot tune prompts or configuration');
    }
    assertOpaqueId(proposedAdjustment.defectLedgerEntryId, 'proposedAdjustment.defectLedgerEntryId');
    assertOpaqueId(proposedAdjustment.nextConfigVersionId, 'proposedAdjustment.nextConfigVersionId');
  }
  if (attempts.at(-1)?.partition === 'locked_test') {
    return deepFreeze({ state: 'halted', reasonCode: 'locked_test_complete', nextAttempt: null });
  }
  if (attempts.length >= policy.maxAttempts) return deepFreeze({ state: 'halted', reasonCode: 'max_attempts', nextAttempt: null });
  const tail = attempts.slice(-policy.noImprovementLimit);
  if (tail.length === policy.noImprovementLimit && tail.every(({ improvement }) => improvement < policy.minimumImprovement)) {
    return deepFreeze({ state: 'halted', reasonCode: 'three_no_improvement', nextAttempt: null });
  }
  return deepFreeze({ state: 'continue', reasonCode: 'improvement_permitted', nextAttempt: attempts.length + 1 });
}

export function createContentFreeTraceEvent(input) {
  assertExactKeys(input, {
    field: 'traceEvent',
    allowed: ['eventId', 'runId', 'planId', 'purpose', 'stepId', 'stepKind', 'state', 'reasonCode', 'actorId', 'specialistRole', 'occurredAt', 'correlationId'],
    required: ['eventId', 'runId', 'planId', 'purpose', 'stepId', 'stepKind', 'state', 'reasonCode', 'actorId', 'specialistRole', 'occurredAt'],
  });
  const {
    eventId,
    runId,
    planId,
    purpose,
    stepId,
    stepKind,
    state,
    reasonCode,
    actorId,
    specialistRole,
    occurredAt,
    correlationId = null,
  } = input;
  const event = { eventId, runId, planId, purpose, stepId, stepKind, state, reasonCode, actorId, specialistRole, occurredAt, correlationId };
  assertOpaqueId(eventId, 'traceEvent.eventId');
  assertOpaqueId(runId, 'traceEvent.runId');
  assertMachineIdentifier(planId, 'traceEvent.planId');
  assertMachineIdentifier(purpose, 'traceEvent.purpose');
  assertMachineIdentifier(stepId, 'traceEvent.stepId');
  assertEnum(stepKind, STEP_KINDS, 'traceEvent.stepKind');
  assertMachineIdentifier(state, 'traceEvent.state');
  assertMachineIdentifier(reasonCode, 'traceEvent.reasonCode');
  assertOpaqueId(actorId, 'traceEvent.actorId');
  assertMachineIdentifier(specialistRole, 'traceEvent.specialistRole');
  assertIsoTimestamp(occurredAt, 'traceEvent.occurredAt');
  assertOpaqueId(correlationId, 'traceEvent.correlationId', { nullable: true });
  return deepFreeze({ schemaVersion: ORCHESTRATION_SCHEMA_VERSION, ...event });
}
