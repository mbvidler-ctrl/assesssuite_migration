import {
  TSK_RUNNER_SPEC,
  buildTskFixture,
  validateAndScore as validateAndScoreTsk,
} from '../tsk17.js';
import {
  TEN_RM_RUNNER_SPEC,
  TEN_RM_LOAD_CONSTRAINTS,
  buildTenRmFixture,
  validateAndScore as validateAndScoreTenRm,
} from '../tenRm.js';
import {
  BIA_RUNNER_SPEC,
  BIA_NUMERIC_CONSTRAINTS,
  buildBiaFixture,
  validateAndScore as validateAndScoreBia,
} from '../bia.js';

export {
  TSK_RUNNER_SPEC,
  TEN_RM_RUNNER_SPEC,
  TEN_RM_LOAD_CONSTRAINTS,
  BIA_RUNNER_SPEC,
  BIA_NUMERIC_CONSTRAINTS,
  validateAndScoreTsk,
  validateAndScoreTenRm,
  validateAndScoreBia,
};

export const RUNNER_SPECS = Object.freeze([
  TSK_RUNNER_SPEC,
  TEN_RM_RUNNER_SPEC,
  BIA_RUNNER_SPEC,
]);

function normalizeKey(value) {
  const key = String(value || '').trim().toLowerCase();
  const aliases = {
    'tsk-17': 'tsk',
    'tampa scale for kinesiophobia (tsk)': 'tsk',
    'tampa scale for kinesiophobia': 'tsk',
    'ten repetition maximum (10rm)': '10rm',
    'bioelectrical impedance analysis (bia)': 'bia',
  };
  return aliases[key] || key;
}

export function buildFixture(canonicalOrRunnerKey) {
  switch (normalizeKey(canonicalOrRunnerKey)) {
    case 'tsk': return buildTskFixture();
    case '10rm': return buildTenRmFixture();
    case 'bia': return buildBiaFixture();
    default: throw new Error(`Unsupported class-D repaired scorer fixture: ${canonicalOrRunnerKey}`);
  }
}

export function validateAndScore(input, context = {}) {
  const scorerKey = normalizeKey(
    context.runnerKey
      || context.scoringKey
      || input?.runnerKey
      || input?.scoringKey
      || input?.runner_key
      || input?.scoring_key,
  );
  switch (scorerKey) {
    case 'tsk': return validateAndScoreTsk(input, context);
    case '10rm': return validateAndScoreTenRm(input, context);
    case 'bia': return validateAndScoreBia(input, context);
    default: throw new Error('Class-D repaired scorer requires runnerKey/scoringKey tsk, 10rm or bia');
  }
}
