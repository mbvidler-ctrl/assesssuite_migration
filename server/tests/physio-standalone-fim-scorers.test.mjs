import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildFimFixture,
  buildFourHundredMetreWalkFixture,
  buildSixMetreWalkFixture,
  buildSixMinuteStepFixture,
  buildEightFootUpGoFixture,
  FIM_ITEMS,
  FIM_RUNNER_SPEC,
  FIM_SCORE_LEVELS,
  FOUR_HUNDRED_METRE_WALK_RUNNER_SPEC,
  SIX_METRE_WALK_RUNNER_SPEC,
  SIX_METRE_WALK_TIMED_DISTANCE_M,
  SIX_MINUTE_STEP_RUNNER_SPEC,
  EIGHT_FOOT_UP_GO_RUNNER_SPEC,
  STANDALONE_AND_FIM_SCORERS,
  validateAndScoreFim,
  validateAndScoreFourHundredMetreWalk,
  validateAndScoreSixMetreWalk,
  validateAndScoreSixMinuteStep,
  validateAndScoreEightFootUpGo,
} from '../../src/lib/clinical/scorers/standaloneAndFim.js';
import {
  buildRegisteredAssessmentFixture,
  resolveRegisteredAssessmentScorer,
  validateAndScoreRegisteredAssessment,
} from '../../src/lib/clinical/assessmentScorerRegistry.js';

const CONTEXT = Object.freeze({ assessmentDate: '2026-08-22' });

function scoreWith(fn, input, assessmentName) {
  return fn(input, { ...CONTEXT, assessmentName });
}

test('all five standalone/FIM definitions are exact central-registry scorers', () => {
  assert.equal(STANDALONE_AND_FIM_SCORERS.length, 5);
  for (const definition of STANDALONE_AND_FIM_SCORERS) {
    const { runnerKey, scoringKey } = definition.runnerSpec;
    assert.equal(resolveRegisteredAssessmentScorer(scoringKey)?.runnerSpec, definition.runnerSpec);
    assert.equal(resolveRegisteredAssessmentScorer(runnerKey)?.runnerSpec, definition.runnerSpec);
    const payload = validateAndScoreRegisteredAssessment(
      scoringKey,
      buildRegisteredAssessmentFixture(scoringKey),
      { ...CONTEXT, assessmentName: runnerKey },
    );
    assert.equal(payload.status, 'completed');
    assert.ok(Number.isFinite(payload.result_value));
    assert.equal(payload.additional_data.scoring_key, scoringKey);
    assert.ok(payload.additional_data.soap_text.length > 0);
    assert.ok(payload.additional_data.report_text.length > 0);
  }
});

test('8-Foot Up-and-Go requires and scores the faster of exactly two trials', () => {
  const payload = scoreWith(
    validateAndScoreEightFootUpGo,
    { ...buildEightFootUpGoFixture(), trials: [{ time_s: 8.11 }, { time_s: 7.69 }] },
    '8-Foot Up-and-Go Test',
  );
  assert.equal(payload.result_value, 7.69);
  assert.equal(payload.additional_data.best_time_s, 7.69);
  assert.equal(payload.additional_data.average_time_s, 7.9);
  assert.equal(payload.additional_data.trials.length, 2);
  assert.match(payload.additional_data.interpretation, /age- and gender-matched/);
  assert.throws(
    () => scoreWith(
      validateAndScoreEightFootUpGo,
      { ...buildEightFootUpGoFixture(), trials: [{ time_s: 7.5 }] },
      '8-Foot Up-and-Go Test',
    ),
    /exactly 2 completed trials/,
  );
});

test('6-Metre Walk Test times the source middle four metres and requires all three trials', () => {
  assert.equal(SIX_METRE_WALK_TIMED_DISTANCE_M, 4);
  const payload = scoreWith(
    validateAndScoreSixMetreWalk,
    { ...buildSixMetreWalkFixture(), trials: [{ time_s: 5 }, { time_s: 4 }, { time_s: 2 }] },
    '6-Metre Walk Test',
  );
  assert.equal(payload.result_value, 2);
  assert.equal(payload.additional_data.timed_distance_m, 4);
  assert.deepEqual(
    payload.additional_data.trials.map(({ speed_ms }) => speed_ms),
    [0.8, 1, 2],
  );
  assert.equal(payload.additional_data.average_speed_ms, 1.267);
  assert.throws(
    () => scoreWith(
      validateAndScoreSixMetreWalk,
      { ...buildSixMetreWalkFixture(), trials: [{ time_s: 4 }, { time_s: 4 }] },
      '6-Metre Walk Test',
    ),
    /exactly 3 completed trials/,
  );
});

test('400-Metre Walk Test validates completion, elapsed time, distance and early-stop reason', () => {
  const completed = scoreWith(
    validateAndScoreFourHundredMetreWalk,
    { ...buildFourHundredMetreWalkFixture(), total_time_seconds: 420 },
    '400-Metre Walk Test',
  );
  assert.equal(completed.result_value, 420);
  assert.equal(completed.additional_data.completed, true);
  assert.match(completed.additional_data.interpretation, /At or below/);

  const stopped = scoreWith(validateAndScoreFourHundredMetreWalk, {
    ...buildFourHundredMetreWalkFixture(),
    total_time_seconds: 180.2,
    distance_covered_m: 200,
    completed: false,
    early_stop_reason: 'Client requested to stop.',
  }, '400-Metre Walk Test');
  assert.equal(stopped.result_value, 180.2);
  assert.equal(stopped.additional_data.completed, false);
  assert.equal(stopped.additional_data.stopped_early, true);
  assert.match(stopped.additional_data.interpretation, /not completed/);

  assert.throws(
    () => scoreWith(validateAndScoreFourHundredMetreWalk, {
      ...buildFourHundredMetreWalkFixture(),
      distance_covered_m: 200,
      completed: false,
      early_stop_reason: '',
    }, '400-Metre Walk Test'),
    /Early stop reason is required/,
  );
  assert.throws(
    () => scoreWith(validateAndScoreFourHundredMetreWalk, {
      ...buildFourHundredMetreWalkFixture(),
      distance_covered_m: 399,
      completed: true,
    }, '400-Metre Walk Test'),
    /must record 400 metres/,
  );
});

test('6-Minute Step Test preserves a real zero and distinguishes early stop from full duration', () => {
  const zero = scoreWith(
    validateAndScoreSixMinuteStep,
    { ...buildSixMinuteStepFixture(), step_count: 0 },
    '6-Minute Step Test',
  );
  assert.equal(zero.result_value, 0);
  assert.equal(zero.additional_data.test_completed, true);
  assert.equal(zero.additional_data.step_height, 20);

  const stopped = scoreWith(
    validateAndScoreSixMinuteStep,
    { ...buildSixMinuteStepFixture(), elapsed_seconds: 90, step_count: 31 },
    '6-Minute Step Test',
  );
  assert.equal(stopped.result_value, 31);
  assert.equal(stopped.additional_data.test_completed, false);
  assert.match(stopped.additional_data.interpretation, /Stopped at 90 seconds/);
  assert.throws(
    () => scoreWith(
      validateAndScoreSixMinuteStep,
      { ...buildSixMinuteStepFixture(), elapsed_seconds: 0 },
      '6-Minute Step Test',
    ),
    /Elapsed time must be between 1 and 360/,
  );
});

test('FIM retains all 18 ordered items, all seven fully worded levels, and exact subscale sums', () => {
  assert.equal(FIM_ITEMS.length, 18);
  assert.equal(FIM_RUNNER_SPEC.items.length, 18);
  assert.equal(FIM_SCORE_LEVELS.length, 7);
  for (const item of FIM_ITEMS) {
    assert.ok(item.prompt.length > item.label.length);
    assert.deepEqual(item.options, FIM_SCORE_LEVELS);
    assert.ok(item.options.every(({ label, description, value }) => (
      label.length > 0 && description.length > 0 && value >= 1 && value <= 7
    )));
  }

  const maximum = scoreWith(
    validateAndScoreFim,
    { scores: Object.fromEntries(FIM_ITEMS.map(({ key }) => [key, 7])), notes: '' },
    'Functional Independence Measure (FIM)',
  );
  assert.equal(maximum.result_value, 126);
  assert.equal(maximum.additional_data.motor_score, 91);
  assert.equal(maximum.additional_data.cognitive_score, 35);
  assert.equal(maximum.additional_data.responses.memory, 7);
  assert.equal(maximum.additional_data.sections.length, 6);

  const minimum = scoreWith(
    validateAndScoreFim,
    { scores: Array(18).fill(1), notes: '' },
    'Functional Independence Measure (FIM)',
  );
  assert.equal(minimum.result_value, 18);
  assert.equal(minimum.additional_data.motor_score, 13);
  assert.equal(minimum.additional_data.cognitive_score, 5);

  assert.throws(
    () => scoreWith(
      validateAndScoreFim,
      { scores: Array(17).fill(7), notes: '' },
      'Functional Independence Measure (FIM)',
    ),
    /Memory is required/,
  );
  assert.throws(
    () => scoreWith(
      validateAndScoreFim,
      { scores: Array(18).fill(8), notes: '' },
      'Functional Independence Measure (FIM)',
    ),
    /Eating must be between 1 and 7/,
  );
});

test('each production runner imports and invokes the exact shared scorer implementation', () => {
  const bindings = [
    ['8FootUpandGoRunner.jsx', 'validateAndScoreEightFootUpGo'],
    ['6MeterWalkTestRunner.jsx', 'validateAndScoreSixMetreWalk'],
    ['400MeterWalkTestRunner.jsx', 'validateAndScoreFourHundredMetreWalk'],
    ['SixMinuteStepTestRunner.jsx', 'validateAndScoreSixMinuteStep'],
    ['FunctionalIndependenceMeasureFIMRunner.jsx', 'validateAndScoreFim'],
  ];
  for (const [file, scorer] of bindings) {
    const source = fs.readFileSync(new URL(`../../src/components/assessments/${file}`, import.meta.url), 'utf8');
    assert.match(source, new RegExp(`import[\\s\\S]*${scorer}[\\s\\S]*standaloneAndFim`), file);
    assert.match(source, new RegExp(`${scorer}\\(`), file);
  }
});

test('standalone/FIM specs expose the complete expected field and item cardinalities', () => {
  assert.equal(EIGHT_FOOT_UP_GO_RUNNER_SPEC.fields.length, 5);
  assert.equal(SIX_METRE_WALK_RUNNER_SPEC.fields.length, 5);
  assert.equal(FOUR_HUNDRED_METRE_WALK_RUNNER_SPEC.fields.length, 11);
  assert.equal(SIX_MINUTE_STEP_RUNNER_SPEC.fields.length, 9);
  assert.equal(FIM_RUNNER_SPEC.items.length, 18);
  assert.deepEqual(
    EIGHT_FOOT_UP_GO_RUNNER_SPEC.fields.find(({ key }) => key === 'trials').items.map(({ key }) => key),
    ['time_s'],
  );
  assert.deepEqual(
    SIX_METRE_WALK_RUNNER_SPEC.fields.find(({ key }) => key === 'trials').items.map(({ key }) => key),
    ['time_s', 'speed_ms'],
  );
  for (const spec of [FOUR_HUNDRED_METRE_WALK_RUNNER_SPEC, SIX_MINUTE_STEP_RUNNER_SPEC]) {
    for (const key of ['pre_test', 'post_test']) {
      assert.deepEqual(
        spec.fields.find((field) => field.key === key).fields.map((field) => field.key),
        ['heart_rate', 'blood_pressure', 'spo2'],
      );
    }
  }
  assert.ok(FIM_RUNNER_SPEC.items.every((item) => (
    item.responseBinding.field === 'scores' && item.responseBinding.key === item.key
  )));
});
