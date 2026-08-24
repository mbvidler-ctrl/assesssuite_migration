import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  RUNNER_KEYS,
  RUNNER_SPECS,
  buildFixture,
  scoreBergBalance,
  scoreClockDrawing,
  scoreCtsib,
  scoreFourSquareStep,
  scoreHandGrip,
  scorePainScales,
  scoreRangeOfMotion,
  scoreSixMinuteWalk,
  scoreTinetti,
  scoreYBalance,
  validateAndScore,
} from '../../src/lib/clinical/scorers/coreA.js';
import { projectAssessmentResult } from '../../src/components/reports/assessmentResultProjection.js';

const FIXED_CONTEXT = Object.freeze({ assessmentDate: '2026-08-22' });
const EXPECTED_KEYS = Object.freeze([
  'range-of-motion', 'manual-muscle-testing', 'pain-scales', 'single-leg-stance',
  'berg-balance', 'hand-grip', 'clinical-frailty-scale', 'four-meter-gait-speed',
  'y-balance', 'habitual-gait-speed', 'fast-gait-speed', 'four-stage-balance',
  'modified-thomas', 'single-leg-hop', 'one-minute-sit-to-stand', 'groc',
  'four-square-step', 'ctsib', 'clock-drawing', 'general-movement-screen',
  'tinetti', 'six-minute-walk',
]);

const CHOICE_TYPES = new Set(['choice', 'radio', 'select', 'single_choice', 'yes_no']);
const SIMPLE_TYPES = new Set(['boolean', 'date', 'duration', 'integer', 'number', 'numeric', 'text', 'textarea', 'time']);
const COMPOUND_TYPES = new Set(['array', 'object']);

function assertFieldComplete(field, path) {
  assert.ok(field?.key && field?.label && field?.type, `${path} requires key, label and type`);
  assert.doesNotMatch(field.key, /[.\[\]]/, `${path} must use an atomic key`);
  const type = String(field.type).toLowerCase();
  if (CHOICE_TYPES.has(type)) {
    assert.ok(Array.isArray(field.options) && field.options.length >= 2, `${path} requires ordered options`);
    for (const option of field.options) {
      assert.equal(typeof option.label, 'string');
      assert.ok(option.label.length > 0);
      assert.notEqual(option.value, undefined);
      assert.notEqual(option.value, null);
    }
    return;
  }
  if (SIMPLE_TYPES.has(type)) return;
  assert.ok(COMPOUND_TYPES.has(type), `${path} uses unsupported type ${type}`);
  if (type === 'array') {
    assert.ok(Number.isInteger(field.minItems) && field.minItems >= 0, `${path} requires minItems`);
    assert.ok(Number.isInteger(field.maxItems) && field.maxItems >= field.minItems, `${path} requires maxItems`);
  }
  const nested = [field.fields, field.entries, field.items].find((entries) => Array.isArray(entries) && entries.length > 0);
  if (nested) {
    assert.equal(new Set(nested.map((entry) => entry.key)).size, nested.length, `${path} nested keys must be unique`);
    nested.forEach((entry) => assertFieldComplete(entry, `${path}.${entry.key}`));
    return;
  }
  assert.ok(field.itemSchema, `${path} requires recursive children or itemSchema`);
  assertFieldComplete(field.itemSchema, `${path}[]`);
}

function assertPayload(payload, key) {
  assert.equal(payload.status, 'completed');
  assert.ok(Number.isFinite(payload.result_value), `${key} primary result must be finite`);
  assert.equal(payload.assessment_date, FIXED_CONTEXT.assessmentDate);
  assert.equal(payload.additional_data.scoring_key, key);
  assert.equal(payload.additional_data.scoring_version, `${key}.v1`);
  assert.ok(payload.additional_data.measurement_type);
  assert.ok(payload.additional_data.raw_input);
  assert.ok(payload.additional_data.interpretation.length > 3);
  assert.ok(payload.additional_data.soap_text.length > 20);
  assert.ok(payload.additional_data.report_text.length > payload.additional_data.soap_text.length);
  assert.doesNotMatch(JSON.stringify(payload), /NaN|Infinity/);
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), payload);

  const projection = projectAssessmentResult({
    assessment: { canonical_id: `assessment:test:${key}`, name: `Fixture ${key}` },
    completedAssessment: payload,
  });
  assert.equal(projection.result_value, payload.result_value);
  assert.equal(projection.soap_text, payload.additional_data.soap_text);
  assert.match(projection.report_text, new RegExp(`Fixture ${key}`));
}

test('Core-A exposes exactly 22 frozen, recursive, schema-v6-safe measurement specs', () => {
  assert.deepEqual(RUNNER_KEYS, EXPECTED_KEYS);
  assert.deepEqual(RUNNER_SPECS.map(({ runnerKey }) => runnerKey), EXPECTED_KEYS);
  assert.equal(new Set(EXPECTED_KEYS).size, 22);
  for (const spec of RUNNER_SPECS) {
    assert.equal(spec.kind, 'measurement');
    assert.equal(spec.schemaVersion, 1);
    assert.equal(spec.scoringKey, spec.runnerKey);
    assert.equal(spec.scoring.version, `${spec.runnerKey}.v1`);
    assert.ok(Object.isFrozen(spec));
    assert.ok(Object.isFrozen(spec.scoring));
    assert.ok(Array.isArray(spec.fields) && spec.fields.length > 0);
    assert.equal(new Set(spec.fields.map(({ key }) => key)).size, spec.fields.length);
    spec.fields.forEach((entry) => assertFieldComplete(entry, `${spec.runnerKey}.${entry.key}`));
    assert.ok(spec.result.primaryField);
    assert.ok(spec.result.unit);
    assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec);
  }
});

test('all fixture top-level inputs are represented and all 22 scorers persist, reload, SOAP and report', () => {
  for (const key of EXPECTED_KEYS) {
    const spec = RUNNER_SPECS.find((entry) => entry.runnerKey === key);
    const fixture = buildFixture(key);
    const represented = new Set(spec.fields.map((entry) => entry.key));
    for (const fixtureKey of Object.keys(fixture).filter((entry) => !['notes', 'assessment_date'].includes(entry))) {
      assert.ok(represented.has(fixtureKey), `${key} fixture field ${fixtureKey} must be in RunnerSpec`);
    }
    const payload = validateAndScore(fixture, { ...FIXED_CONTEXT, runnerKey: key, assessmentName: `Fixture ${key}` });
    assertPayload(payload, key);
  }
});

test('every Core-A route fails closed for missing primary input', () => {
  const invalid = {
    'range-of-motion': { ...buildFixture('range-of-motion'), measurements: {} },
    'manual-muscle-testing': { ...buildFixture('manual-muscle-testing'), tests: [] },
    'pain-scales': { ...buildFixture('pain-scales'), current_pain: '' },
    'single-leg-stance': { ...buildFixture('single-leg-stance'), trials: [] },
    'berg-balance': { ...buildFixture('berg-balance'), scores: { ...buildFixture('berg-balance').scores, item_14: undefined } },
    'hand-grip': { ...buildFixture('hand-grip'), dominant_trial_1: '' },
    'clinical-frailty-scale': { ...buildFixture('clinical-frailty-scale'), score: '' },
    'four-meter-gait-speed': { ...buildFixture('four-meter-gait-speed'), trials: [] },
    'y-balance': { ...buildFixture('y-balance'), limb_length_left: '' },
    'habitual-gait-speed': { ...buildFixture('habitual-gait-speed'), distance: '' },
    'fast-gait-speed': { ...buildFixture('fast-gait-speed'), trials: [{ time: '', distance: 10 }] },
    'four-stage-balance': { ...buildFixture('four-stage-balance'), stages: { ...buildFixture('four-stage-balance').stages, tandem: undefined } },
    'modified-thomas': { left_result: 'not_tested', right_result: 'not_tested', notes: '' },
    'single-leg-hop': { ...buildFixture('single-leg-hop'), single_left: [] },
    'one-minute-sit-to-stand': { ...buildFixture('one-minute-sit-to-stand'), repetitions: '' },
    groc: { ...buildFixture('groc'), score: '' },
    'four-square-step': { ...buildFixture('four-square-step'), trial1: '' },
    ctsib: { ...buildFixture('ctsib'), scores: { ...buildFixture('ctsib').scores, foam_eyes_closed: undefined } },
    'clock-drawing': { attempts: [], global_notes: '' },
    'general-movement-screen': { ...buildFixture('general-movement-screen'), scores: { ...buildFixture('general-movement-screen').scores, squat: undefined } },
    tinetti: { ...buildFixture('tinetti'), gait_scores: { ...buildFixture('tinetti').gait_scores, gait_10: undefined } },
    'six-minute-walk': { ...buildFixture('six-minute-walk'), post_test: { ...buildFixture('six-minute-walk').post_test, total_distance: '' } },
  };
  assert.deepEqual(Object.keys(invalid), EXPECTED_KEYS);
  for (const [key, input] of Object.entries(invalid)) {
    assert.throws(() => validateAndScore(input, { ...FIXED_CONTEXT, runnerKey: key, assessmentName: `Fixture ${key}` }), /required|requires|must contain|must be|not a permitted|at least|unsupported|cannot pass/);
  }
});

test('NaN, infinity, out-of-range and inconsistent protocol data are rejected', () => {
  assert.throws(() => scorePainScales({ ...buildFixture('pain-scales'), current_pain: Number.NaN }, { ...FIXED_CONTEXT, assessmentName: 'Pain' }), /finite/);
  assert.throws(() => scoreHandGrip({ ...buildFixture('hand-grip'), dominant_trial_2: Infinity }, { ...FIXED_CONTEXT, assessmentName: 'Grip' }), /finite/);
  assert.throws(() => scoreYBalance({ ...buildFixture('y-balance'), left_anterior: 301 }, { ...FIXED_CONTEXT, assessmentName: 'Y Balance' }), /between/);
  assert.throws(() => validateAndScore({ ...buildFixture('four-meter-gait-speed'), distance: 10, trials: [{ distance: 10, time: 8 }] }, { ...FIXED_CONTEXT, runnerKey: 'four-meter-gait-speed', assessmentName: '4m' }), /must equal 4/);
  const invalidStages = buildFixture('four-stage-balance');
  invalidStages.stages.tandem = { passed: false, time_seconds: 6, notes: '' };
  invalidStages.stages.single_leg = { passed: true, time_seconds: 10, notes: '' };
  assert.throws(() => validateAndScore(invalidStages, { ...FIXED_CONTEXT, runnerKey: 'four-stage-balance', assessmentName: 'Stages' }), /cannot pass/);
  assert.throws(() => scoreSixMinuteWalk({ ...buildFixture('six-minute-walk'), test_duration_seconds: 361 }, { ...FIXED_CONTEXT, assessmentName: '6MWT' }), /between/);
});

test('zero and boundary values persist where zero is a legitimate observation', () => {
  const pain = scorePainScales({ scale_type: 'nprs', current_pain: 0, best_pain: 0, worst_pain: 0, pain_location: '', notes: '' }, { ...FIXED_CONTEXT, assessmentName: 'Pain' });
  assert.equal(pain.result_value, 0);
  assert.equal(pain.additional_data.current_pain, 0);

  const grip = scoreHandGrip({ dominant_hand: 'right', dominant_trial_1: 0, dominant_trial_2: 0, dominant_trial_3: 0, non_dominant_trial_1: 0, non_dominant_trial_2: 0, non_dominant_trial_3: 0, notes: '' }, { ...FIXED_CONTEXT, assessmentName: 'Grip' });
  assert.equal(grip.result_value, 0);
  assert.deepEqual(grip.additional_data.dominant_trials, [0, 0, 0]);

  const rom = scoreRangeOfMotion({ joint: 'knee', measurements: { Extension: { left: 0, right: 0 } }, comments: {}, notes: '' }, { ...FIXED_CONTEXT, assessmentName: 'ROM' });
  assert.equal(rom.result_value, 2);
  assert.deepEqual(rom.additional_data.measurements.Extension, { left: 0, right: 0 });

  const ctsib = scoreCtsib({ scores: { firm_eyes_open: 0, firm_eyes_closed: 0, foam_eyes_open: 0, foam_eyes_closed: 0 }, observations: '' }, { ...FIXED_CONTEXT, assessmentName: 'CTSIB' });
  assert.equal(ctsib.result_value, 0);

  const walk = scoreSixMinuteWalk({ pre_test: {}, during_test: { laps: 0, current_distance: 0, rests: [] }, post_test: { total_distance: 0 }, test_duration_seconds: 0, termination_reason: 'Unable to commence', notes: '' }, { ...FIXED_CONTEXT, assessmentName: '6MWT' });
  assert.equal(walk.result_value, 0);
  assert.equal(walk.additional_data.during_test.laps, 0);
});

test('focused formulas and subscales remain deterministic', () => {
  assert.equal(scoreBergBalance(buildFixture('berg-balance'), { ...FIXED_CONTEXT, assessmentName: 'Berg' }).result_value, 48);
  assert.equal(scoreFourSquareStep(buildFixture('four-square-step'), { ...FIXED_CONTEXT, assessmentName: 'FSST' }).result_value, 11.2);
  assert.equal(scoreClockDrawing(buildFixture('clock-drawing'), { ...FIXED_CONTEXT, assessmentName: 'Clock' }).result_value, 8);
  const tinetti = scoreTinetti(buildFixture('tinetti'), { ...FIXED_CONTEXT, assessmentName: 'Tinetti' });
  assert.equal(tinetti.result_value, tinetti.additional_data.balance_score + tinetti.additional_data.gait_score);
  assert.equal(tinetti.additional_data.balance_score, 16);
  assert.equal(tinetti.additional_data.gait_score, 12);
  assert.equal(tinetti.result_value, 28);
  const yBalance = scoreYBalance(buildFixture('y-balance'), { ...FIXED_CONTEXT, assessmentName: 'Y Balance' });
  assert.equal(yBalance.result_value, Math.max(yBalance.additional_data.left_composite, yBalance.additional_data.right_composite));
  assert.throws(() => validateAndScore({ runnerKey: 'not-a-route' }, FIXED_CONTEXT), /unsupported runner key/);
});

test('each production Core-A component imports and invokes its pure scorer', () => {
  const contracts = [
    ['ROMAssessmentRunner.jsx', 'scoreRangeOfMotion'],
    ['ManualMuscleTestRunner.jsx', 'scoreManualMuscleTesting'],
    ['PainScalesRunner.jsx', 'scorePainScales'],
    ['SingleLegStanceRunner.jsx', 'scoreSingleLegStance'],
    ['BergBalanceRunner.jsx', 'scoreBergBalance'],
    ['ClinicalFrailtyScaleRunner.jsx', 'scoreClinicalFrailtyScale'],
    ['GaitSpeedRunner.jsx', 'scoreFourMeterGaitSpeed'],
    ['GaitSpeedRunner.jsx', 'scoreHabitualGaitSpeed'],
    ['GaitSpeedRunner.jsx', 'scoreFastGaitSpeed'],
    ['FourStageBalanceRunner.jsx', 'scoreFourStageBalance'],
    ['SpecialTestsRunner.jsx', 'scoreModifiedThomas'],
    ['SingleLegHopTestsRunner.jsx', 'scoreSingleLegHop'],
    ['1MinuteSittoStandTestRunner.jsx', 'scoreOneMinuteSitToStand'],
    ['GlobalRatingofChangeScaleGROCRunner.jsx', 'scoreGroc'],
    ['FourSquareStepRunner.jsx', 'scoreFourSquareStep'],
    ['CTSIBRunner.jsx', 'scoreCtsib'],
    ['ClockDrawingTestRunner.jsx', 'scoreClockDrawing'],
    ['GeneralMovementScreenRunner.jsx', 'scoreGeneralMovementScreen'],
    ['TinettiRunner.jsx', 'scoreTinetti'],
    ['SixMinuteWalkRunner.jsx', 'scoreSixMinuteWalk'],
  ];
  for (const [filename, scorer] of contracts) {
    const source = fs.readFileSync(new URL(`../../src/components/assessments/${filename}`, import.meta.url), 'utf8');
    assert.match(source, /@\/lib\/clinical\/scorers\/coreA/);
    assert.match(source, new RegExp(`${scorer}\\(`));
  }
  const host = fs.readFileSync(new URL('../../src/components/assessments/TestRunner.jsx', import.meta.url), 'utf8');
  assert.match(host, /@\/lib\/clinical\/scorers\/coreA/);
  for (const scorer of ['scoreHandGrip', 'scoreYBalance', 'scorePainScales', 'scoreSingleLegStance']) {
    assert.match(host, new RegExp(`${scorer}\\(`));
  }
});

test('the TestRunner host restores and renders the standard completed Core-A payload', () => {
  const host = fs.readFileSync(new URL('../../src/components/assessments/TestRunner.jsx', import.meta.url), 'utf8');
  for (const key of [
    'range-of-motion', 'manual-muscle-testing', 'pain-scales', 'single-leg-stance',
    'berg-balance', 'clinical-frailty-scale',
    'four-meter-gait-speed', 'habitual-gait-speed', 'fast-gait-speed', 'four-stage-balance',
    'y-balance', 'modified-thomas', 'single-leg-hop', 'one-minute-sit-to-stand', 'groc',
    'four-square-step', 'ctsib', 'clock-drawing', 'general-movement-screen',
    'tinetti', 'six-minute-walk',
  ]) {
    assert.match(host, new RegExp(`restoredRunnerPayload\\([^\\n]*['"]${key}['"]`), `${key} must rehydrate from the completed assessment`);
  }
  assert.match(host, /restoredAdditionalData\.dominant_trials\?\.\[0\]/);
  assert.match(host, /restoredStanceTime\('left', true\)/);
  assert.match(host, /restoredAdditionalData\.left_composite|restoredAdditionalData\.left_anterior/);
  for (const nestedField of ['frailty_score', 'conditions_completed', 'best_time', 'stage_achieved', 'current_pain', 'test_duration_seconds']) {
    assert.match(host, new RegExp(`additional_data\\?\\.${nestedField}`), `${nestedField} must render from additional_data`);
  }
});
