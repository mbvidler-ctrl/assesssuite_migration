import {
  BIA_RUNNER_SPEC,
  TEN_RM_RUNNER_SPEC,
  TSK_RUNNER_SPEC,
  buildFixture as buildClassDFixture,
  validateAndScoreBia,
  validateAndScoreTenRm,
  validateAndScoreTsk,
} from './scorers/classDRepairs.js';
import { defineAssessmentScorer } from './scorers/contract.js';
import {
  buildFixture as buildExtrasBodyFitnessFixture,
  RUNNER_SPECS as EXTRAS_BODY_FITNESS_RUNNER_SPECS,
  validateAndScore as validateAndScoreExtrasBodyFitness,
} from './scorers/extrasBodyFitness.js';
import {
  buildFixture as buildExtrasFunctionalOrthoFixture,
  RUNNER_SPECS as EXTRAS_FUNCTIONAL_ORTHO_RUNNER_SPECS,
  validateAndScore as validateAndScoreExtrasFunctionalOrtho,
} from './scorers/extrasFunctionalOrtho.js';
import {
  buildFixture as buildExtrasMobilityBalanceOrthoFixture,
  RUNNER_SPECS as EXTRAS_MOBILITY_BALANCE_ORTHO_RUNNER_SPECS,
  validateAndScore as validateAndScoreExtrasMobilityBalanceOrtho,
} from './scorers/extrasMobilityBalanceOrtho.js';
import {
  buildFixture as buildExtrasPhysiologicalFixture,
  RUNNER_SPECS as EXTRAS_PHYSIOLOGICAL_RUNNER_SPECS,
  validateAndScore as validateAndScoreExtrasPhysiological,
} from './scorers/extrasPhysiological.js';
import {
  buildFixture as buildExtrasPromNeuroFixture,
  RUNNER_SPECS as EXTRAS_PROM_NEURO_RUNNER_SPECS,
  validateAndScore as validateAndScoreExtrasPromNeuro,
} from './scorers/extrasPromNeuro.js';
import { MAINTAINED_PHYSIO_ADDITION_SCORERS } from './scorers/maintainedPhysioAdditions.js';
import {
  buildFixture as buildCoreBFixture,
  RUNNER_SPECS as CORE_B_RUNNER_SPECS,
  validateAndScore as validateAndScoreCoreB,
} from './scorers/coreB.js';
import {
  buildFixture as buildCoreAFixture,
  RUNNER_SPECS as CORE_A_RUNNER_SPECS,
  validateAndScore as validateAndScoreCoreA,
} from './scorers/coreA.js';
import { RESIDUAL_ASSESSMENT_SCORERS } from './scorers/residualAssessments.js';
import { STANDALONE_AND_FIM_SCORERS } from './scorers/standaloneAndFim.js';
import { buildTudsFixture, TUDS_RUNNER_SPEC, validateAndScoreTuds } from './tuds.js';

const DEFINITIONS = Object.freeze([
  defineAssessmentScorer({
    runnerSpec: TSK_RUNNER_SPEC,
    buildFixture: () => buildClassDFixture('tsk'),
    validateAndScore: validateAndScoreTsk,
  }),
  defineAssessmentScorer({
    runnerSpec: TEN_RM_RUNNER_SPEC,
    buildFixture: () => buildClassDFixture('10rm'),
    validateAndScore: validateAndScoreTenRm,
  }),
  defineAssessmentScorer({
    runnerSpec: BIA_RUNNER_SPEC,
    buildFixture: () => buildClassDFixture('bia'),
    validateAndScore: validateAndScoreBia,
  }),
  defineAssessmentScorer({
    runnerSpec: TUDS_RUNNER_SPEC,
    buildFixture: buildTudsFixture,
    validateAndScore: validateAndScoreTuds,
  }),
  ...MAINTAINED_PHYSIO_ADDITION_SCORERS.map(defineAssessmentScorer),
  ...EXTRAS_BODY_FITNESS_RUNNER_SPECS.map((runnerSpec) => defineAssessmentScorer({
    runnerSpec,
    buildFixture: () => buildExtrasBodyFitnessFixture(runnerSpec.runnerKey),
    validateAndScore: (input, context = {}) => validateAndScoreExtrasBodyFitness(
      input,
      { ...context, runnerKey: runnerSpec.runnerKey },
    ),
  })),
  ...EXTRAS_FUNCTIONAL_ORTHO_RUNNER_SPECS.map((runnerSpec) => defineAssessmentScorer({
    runnerSpec,
    buildFixture: () => buildExtrasFunctionalOrthoFixture(runnerSpec.runnerKey),
    validateAndScore: (input, context = {}) => validateAndScoreExtrasFunctionalOrtho(
      input,
      { ...context, runnerKey: runnerSpec.runnerKey },
    ),
  })),
  ...EXTRAS_MOBILITY_BALANCE_ORTHO_RUNNER_SPECS.map((runnerSpec) => defineAssessmentScorer({
    runnerSpec,
    buildFixture: () => buildExtrasMobilityBalanceOrthoFixture(runnerSpec.runnerKey),
    validateAndScore: (input, context = {}) => validateAndScoreExtrasMobilityBalanceOrtho(
      input,
      { ...context, runnerKey: runnerSpec.runnerKey },
    ),
  })),
  ...EXTRAS_PHYSIOLOGICAL_RUNNER_SPECS.map((runnerSpec) => defineAssessmentScorer({
    runnerSpec,
    buildFixture: () => buildExtrasPhysiologicalFixture(runnerSpec.runnerKey),
    validateAndScore: (input, context = {}) => validateAndScoreExtrasPhysiological(
      input,
      { ...context, runnerKey: runnerSpec.runnerKey },
    ),
  })),
  ...EXTRAS_PROM_NEURO_RUNNER_SPECS.map((runnerSpec) => defineAssessmentScorer({
    runnerSpec,
    buildFixture: () => buildExtrasPromNeuroFixture(runnerSpec.runnerKey),
    validateAndScore: (input, context = {}) => validateAndScoreExtrasPromNeuro(
      input,
      { ...context, runnerKey: runnerSpec.runnerKey },
    ),
  })),
  ...CORE_B_RUNNER_SPECS.map((runnerSpec) => defineAssessmentScorer({
    runnerSpec,
    buildFixture: () => buildCoreBFixture(runnerSpec.runnerKey),
    validateAndScore: (input, context = {}) => validateAndScoreCoreB(
      input,
      { ...context, runnerKey: runnerSpec.runnerKey },
    ),
  })),
  ...CORE_A_RUNNER_SPECS.map((runnerSpec) => defineAssessmentScorer({
    runnerSpec,
    buildFixture: () => buildCoreAFixture(runnerSpec.runnerKey),
    validateAndScore: (input, context = {}) => validateAndScoreCoreA(
      input,
      { ...context, runnerKey: runnerSpec.runnerKey },
    ),
  })),
  ...RESIDUAL_ASSESSMENT_SCORERS.map(defineAssessmentScorer),
  ...STANDALONE_AND_FIM_SCORERS.map(defineAssessmentScorer),
]);

const scorerByKey = new Map();
for (const definition of DEFINITIONS) {
  for (const key of [definition.runnerSpec.scoringKey, definition.runnerSpec.runnerKey]) {
    const existing = scorerByKey.get(key);
    if (existing && existing !== definition) {
      throw new Error(`Duplicate assessment scorer registry key: ${key}`);
    }
    scorerByKey.set(key, definition);
  }
}

export const REGISTERED_ASSESSMENT_SCORERS = DEFINITIONS;

export function resolveRegisteredAssessmentScorer(scoringOrRunnerKey) {
  return scorerByKey.get(String(scoringOrRunnerKey || '').trim()) || null;
}

export function buildRegisteredAssessmentFixture(scoringOrRunnerKey) {
  const definition = resolveRegisteredAssessmentScorer(scoringOrRunnerKey);
  if (!definition) throw new Error(`Assessment scorer is not registered: ${scoringOrRunnerKey}`);
  return definition.buildFixture();
}

export function validateAndScoreRegisteredAssessment(scoringOrRunnerKey, input, context) {
  const definition = resolveRegisteredAssessmentScorer(scoringOrRunnerKey);
  if (!definition) throw new Error(`Assessment scorer is not registered: ${scoringOrRunnerKey}`);
  return definition.validateAndScore(input, context);
}
