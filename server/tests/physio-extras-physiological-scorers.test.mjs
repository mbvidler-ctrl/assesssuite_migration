import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  RUNNER_SPECS,
  buildFixture,
  scoreBloodPressure,
  scoreEswt,
  scoreHba1c,
  scoreOneRm,
  scoreSpo2Exercise,
  scoreSpo2Resting,
  scoreWeight,
  validateAndScore,
} from '../../src/lib/clinical/scorers/extrasPhysiological.js';
import { projectAssessmentResult } from '../../src/components/reports/assessmentResultProjection.js';

const FIXED_CONTEXT = Object.freeze({ assessmentDate: '2026-08-22' });
const EXPECTED_KEYS = Object.freeze([
  'heart_rate',
  'spo2-exercise',
  'spo2-resting',
  'blood_pressure',
  'ymca_3min_step',
  'aerobic_step',
  'chester',
  'eswt',
  'height_measurement',
  'weight_measure',
  'waist_circ',
  'tri_arm',
  'tecumseh',
  'balke',
  'modified_bruce',
  '1rm_testing',
  'bruce_treadmill',
  '2min_walk',
  '20m_shuttle',
  '3015_ift',
  'fasting_glucose',
  'ogtt',
  'hba1c',
]);

const CHOICE_FIELD_TYPES = new Set(['choice', 'radio', 'select', 'single_choice', 'yes_no']);
const SIMPLE_FIELD_TYPES = new Set(['boolean', 'date', 'duration', 'integer', 'number', 'numeric', 'text', 'textarea', 'time']);
const COMPOUND_FIELD_TYPES = new Set(['array', 'boolean-map', 'choice-map', 'choice[]', 'multi-select', 'number[]', 'object', 'object[]', 'repeatable_lap', 'repeatable_rest', 'side-measurement', 'side-result', 'string[]', 'vitals']);

function assertFieldContentComplete(field, path) {
  assert.ok(field?.key && field?.label && field?.type, `${path} requires key, label and type`);
  const type = String(field.type).toLowerCase();
  if (CHOICE_FIELD_TYPES.has(type) || ['choice-map', 'choice[]', 'multi-select'].includes(type)) {
    assert.ok(Array.isArray(field.options) && field.options.length >= 2, `${path} requires ordered options`);
    for (const option of field.options) {
      assert.ok(option?.label, `${path} option requires label`);
      assert.notEqual(option?.value, undefined, `${path} option requires value`);
      assert.notEqual(option?.value, null, `${path} option requires value`);
    }
    if (['choice-map', 'choice[]', 'multi-select'].includes(type)) {
      assert.ok(Number.isInteger(field.minItems) && field.minItems >= 0, `${path} requires a finite minimum cardinality`);
      assert.ok(Number.isInteger(field.maxItems) && field.maxItems >= field.minItems, `${path} requires a finite maximum cardinality`);
    }
    return;
  }
  if (SIMPLE_FIELD_TYPES.has(type)) return;
  assert.ok(COMPOUND_FIELD_TYPES.has(type), `${path} uses unsupported type ${type}`);
  const nested = [field.fields, field.entries, field.items].find((entries) => Array.isArray(entries) && entries.length > 0);
  if (nested) {
    nested.forEach((entry, index) => assertFieldContentComplete(entry, `${path}.${entry.key || index}`));
    return;
  }
  const maximumItems = Number(field.maxItems ?? field.length);
  const minimumItems = Number(field.minItems);
  assert.ok(field.itemSchema, `${path} requires nested fields or an item schema`);
  assert.ok(Number.isInteger(minimumItems) && minimumItems >= 0, `${path} requires a finite minimum cardinality`);
  assert.ok(Number.isInteger(maximumItems) && maximumItems >= minimumItems, `${path} requires a finite maximum cardinality`);
  assertFieldContentComplete(field.itemSchema, `${path}[]`);
}

function assertPersistenceInvariant(payload, runnerKey) {
  assert.equal(payload.status, 'completed');
  assert.ok(Number.isFinite(payload.result_value), `${runnerKey} must return a finite primary result`);
  assert.equal(payload.assessment_date, FIXED_CONTEXT.assessmentDate);
  assert.equal(payload.additional_data.scoring_key, runnerKey);
  assert.equal(payload.additional_data.scoring_version, `${runnerKey}.v1`);
  assert.ok(payload.additional_data.measurement_type);
  assert.ok(payload.additional_data.raw_input);
  assert.ok(payload.additional_data.interpretation.length > 3);
  assert.ok(payload.additional_data.soap_text.length > 20);
  assert.ok(payload.additional_data.report_text.length > payload.additional_data.soap_text.length);
  assert.doesNotMatch(JSON.stringify(payload), /NaN|Infinity/);

  const reloaded = JSON.parse(JSON.stringify(payload));
  assert.deepEqual(reloaded, payload);
  const projection = projectAssessmentResult({
    assessment: { canonical_id: `assessment:test:${runnerKey}`, name: `Fixture ${runnerKey}` },
    completedAssessment: reloaded,
  });
  assert.equal(projection.result_value, payload.result_value);
  assert.equal(projection.soap_text, payload.additional_data.soap_text);
  assert.match(projection.report_text, new RegExp(`Fixture ${runnerKey}`));
}

test('physiological/cardiorespiratory RunnerSpecs expose 23 distinct frozen protocol routes', () => {
  assert.deepEqual(RUNNER_SPECS.map(({ runnerKey }) => runnerKey), EXPECTED_KEYS);
  assert.equal(new Set(EXPECTED_KEYS).size, 23);
  for (const spec of RUNNER_SPECS) {
    assert.ok(Object.isFrozen(spec));
    assert.ok(Object.isFrozen(spec.fields));
    assert.ok(Object.isFrozen(spec.scoring));
    assert.equal(spec.schemaVersion, 1);
    assert.equal(spec.kind, 'measurement');
    assert.equal(spec.scoringKey, spec.runnerKey);
    assert.equal(spec.scoring.version, `${spec.runnerKey}.v1`);
    assert.ok(spec.fields.length > 0);
    for (const field of spec.fields) {
      assertFieldContentComplete(field, `${spec.runnerKey}.${field.key}`);
    }
    assert.ok(spec.result.primaryField);
    assert.ok(spec.result.unit);
    assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec);
  }
});

test('all 23 non-boundary fixtures execute the real scorer and round-trip through persistence, SOAP and reports', () => {
  for (const runnerKey of EXPECTED_KEYS) {
    const payload = validateAndScore(buildFixture(runnerKey), {
      ...FIXED_CONTEXT,
      runnerKey,
      assessmentName: `Fixture ${runnerKey}`,
    });
    assertPersistenceInvariant(payload, runnerKey);
  }
});

test('resting and exercise SpO2 are independent protocol-specific routes and never one flexible mode', () => {
  const exercise = scoreSpo2Exercise({ pre_percent: 98, post_percent: 94, notes: 'Observed.' }, FIXED_CONTEXT);
  assert.equal(exercise.result_value, 98);
  assert.equal(exercise.additional_data.measurement_type, 'spo2_exercise');
  assert.equal(exercise.additional_data.protocol, 'pre_post_exercise');
  assert.equal(exercise.additional_data.change_percentage_points, -4);
  assert.deepEqual(exercise.additional_data.raw_input, { pre_percent: 98, post_percent: 94, notes: 'Observed.' });

  const resting = scoreSpo2Resting({ spo2_percent: 97, notes: 'Stable signal.' }, FIXED_CONTEXT);
  assert.equal(resting.result_value, 97);
  assert.equal(resting.additional_data.measurement_type, 'spo2_resting');
  assert.equal(resting.additional_data.protocol, 'resting');
  assert.equal('change_percentage_points' in resting.additional_data, false);
  assert.throws(() => scoreSpo2Exercise({ pre_percent: 98, post_percent: '' }, FIXED_CONTEXT), /Post-exercise SpO2 is required/);
  assert.throws(() => scoreSpo2Resting({ spo2_percent: '' }, FIXED_CONTEXT), /SpO2 is required/);
  assert.throws(() => validateAndScore({ mode: 'pre_post', pre_percent: 98, post_percent: 94 }, { ...FIXED_CONTEXT, runnerKey: 'spo2' }), /must be one of/);
});

test('paired values, stages, units and raw observations survive the exact production formulas', () => {
  const bloodPressure = scoreBloodPressure({ systolic: 126, diastolic: 82, notes: '' }, FIXED_CONTEXT);
  assert.equal(bloodPressure.result_value, 126);
  assert.equal(bloodPressure.additional_data.blood_pressure, '126/82');

  const weight = scoreWeight({ measured_kg: 81.4, clothing_adjustment_kg: 0.4, notes: '' }, FIXED_CONTEXT);
  assert.equal(weight.result_value, 81);
  assert.equal(weight.additional_data.measured_kg, 81.4);
  assert.equal(weight.additional_data.clothing_adjustment_kg, 0.4);

  const oneRm = scoreOneRm(buildFixture('1rm_testing'), FIXED_CONTEXT);
  assert.equal(oneRm.result_value, 100);
  assert.equal(oneRm.additional_data.attempts.length, 3);
  assert.equal(oneRm.additional_data.relative_strength, 1.25);
  assert.equal(oneRm.additional_data.units, 'kg');

  const modifiedBruce = validateAndScore(buildFixture('modified_bruce'), { ...FIXED_CONTEXT, runnerKey: 'modified_bruce' });
  assert.deepEqual(modifiedBruce.additional_data.stage_data.map(({ stage }) => stage), [1, 2, 3]);
  assert.equal(modifiedBruce.additional_data.total_time_seconds, 540);

  const shuttle = validateAndScore(buildFixture('20m_shuttle'), { ...FIXED_CONTEXT, runnerKey: '20m_shuttle' });
  assert.equal(shuttle.additional_data.final_level, 9);
  assert.equal(shuttle.additional_data.final_shuttle, 6);
  assert.equal(shuttle.additional_data.normative_comparison, 'well_below_average');
});

test('every route rejects a missing primary requirement rather than accepting a default', () => {
  const invalidByKey = {
    heart_rate: { mode: 'single', heart_rate_bpm: '' },
    'spo2-exercise': { pre_percent: 98, post_percent: '' },
    'spo2-resting': { spo2_percent: '' },
    blood_pressure: { systolic: 120, diastolic: '' },
    ymca_3min_step: { ...buildFixture('ymca_3min_step'), age: '' },
    aerobic_step: { ...buildFixture('aerobic_step'), duration_seconds: '' },
    chester: { ...buildFixture('chester'), stages: [] },
    eswt: { ...buildFixture('eswt'), time_elapsed_seconds: '' },
    height_measurement: { height_cm: '' },
    weight_measure: { measured_kg: '', clothing_adjustment_kg: 0 },
    waist_circ: { waist_circumference_cm: 88, sex: '' },
    tri_arm: { stage_heart_rates: [] },
    tecumseh: { ...buildFixture('tecumseh'), recovery_hr: '' },
    balke: { ...buildFixture('balke'), end_reason: '' },
    modified_bruce: { ...buildFixture('modified_bruce'), stage_data: [] },
    '1rm_testing': { ...buildFixture('1rm_testing'), one_rm_load: '' },
    bruce_treadmill: { ...buildFixture('bruce_treadmill'), stage_data: [] },
    '2min_walk': { ...buildFixture('2min_walk'), post_test_hr: '' },
    '20m_shuttle': { ...buildFixture('20m_shuttle'), rpe: '' },
    '3015_ift': { ...buildFixture('3015_ift'), total_stages: '' },
    fasting_glucose: { ...buildFixture('fasting_glucose'), glucose_mmol_l: '' },
    ogtt: { ...buildFixture('ogtt'), two_hour_glucose_mmol_l: '' },
    hba1c: { hba1c_percent: '' },
  };
  assert.deepEqual(Object.keys(invalidByKey), EXPECTED_KEYS);
  for (const [runnerKey, input] of Object.entries(invalidByKey)) {
    assert.throws(
      () => validateAndScore(input, { ...FIXED_CONTEXT, runnerKey }),
      /required|must contain|must be one of/,
      `${runnerKey} must reject its missing required value`,
    );
  }
});

test('NaN, Infinity, impossible ranges and silent zero defaults fail while explicitly valid zero persists', () => {
  assert.throws(() => validateAndScore({ ...buildFixture('height_measurement'), height_cm: Number.NaN }, { ...FIXED_CONTEXT, runnerKey: 'height_measurement' }), /finite number/);
  assert.throws(() => validateAndScore({ ...buildFixture('weight_measure'), measured_kg: Infinity }, { ...FIXED_CONTEXT, runnerKey: 'weight_measure' }), /finite number/);
  assert.throws(() => scoreBloodPressure({ systolic: 80, diastolic: 100 }, FIXED_CONTEXT), /must exceed/);
  assert.throws(() => validateAndScore({ ...buildFixture('3015_ift'), vift_kmh: 15.2 }, { ...FIXED_CONTEXT, runnerKey: '3015_ift' }), /0\.5 km\/h/);
  assert.throws(() => validateAndScore({ ...buildFixture('bruce_treadmill'), total_time_seconds: 0 }, { ...FIXED_CONTEXT, runnerKey: 'bruce_treadmill' }), /1 and 1800/);
  assert.throws(() => validateAndScore({ ...buildFixture('1rm_testing'), one_rm_load: 95 }, { ...FIXED_CONTEXT, runnerKey: '1rm_testing' }), /highest successful/);

  const zeroShuttles = scoreEswt({ ...buildFixture('eswt'), shuttles_completed: 0 }, FIXED_CONTEXT);
  assert.equal(zeroShuttles.additional_data.shuttles_completed, 0);
  const zeroHba1c = scoreHba1c({ hba1c_percent: 0, notes: '' }, FIXED_CONTEXT);
  assert.equal(zeroHba1c.result_value, 0);
  assert.equal(zeroHba1c.additional_data.raw_input.hba1c_percent, 0);
});

test('each owned production runner imports and invokes its exact pure scorer', () => {
  const componentContracts = [
    ['YMCA3MinuteStepTestRunner.jsx', 'scoreYmcaThreeMinuteStep'],
    ['StepTestAerobicStepTestRunner.jsx', 'scoreAerobicStep'],
    ['ChesterStepTestRunner.jsx', 'scoreChester'],
    ['EnduranceShuttleWalkTestESWTRunner.jsx', 'scoreEswt'],
    ['HeightRunner.jsx', 'scoreHeight'],
    ['WeightRunner.jsx', 'scoreWeight'],
    ['WaistCircumferenceRunner.jsx', 'scoreWaistCircumference'],
    ['TriLevelArmErgometerTestRunner.jsx', 'scoreTriLevelArm'],
    ['TecumsehStepTestRunner.jsx', 'scoreTecumseh'],
    ['BalkeWareTreadmillTestRunner.jsx', 'scoreBalke'],
    ['ModifiedBruceProtocolRunner.jsx', 'scoreModifiedBruce'],
    ['1RepetitionMaximum1RMTestingRunner.jsx', 'scoreOneRm'],
    ['BruceProtocolRunner.jsx', 'scoreBruceTreadmill'],
    ['2MinuteWalkTest2MWTRunner.jsx', 'scoreTwoMinuteWalk'],
    ['20MeterShuttleRunBeepTestRunner.jsx', 'scoreTwentyMetreShuttle'],
    ['3015IntermittentFitnessTestRunner.jsx', 'scoreThirtyFifteenIft'],
    ['FastingBloodGlucoseRunner.jsx', 'scoreFastingGlucose'],
    ['OralGlucoseToleranceTestOGTTRunner.jsx', 'scoreOgtt'],
    ['HbA1cRunner.jsx', 'scoreHba1c'],
  ];
  for (const [filename, scorer] of componentContracts) {
    const source = fs.readFileSync(new URL(`../../src/components/assessments/${filename}`, import.meta.url), 'utf8');
    assert.match(source, /@\/lib\/clinical\/scorers\/extrasPhysiological/);
    assert.match(source, new RegExp(`onSave\\(${scorer}\\(`));
    assert.doesNotMatch(source, /onSave\(\{/);
  }

  const vitalSource = fs.readFileSync(new URL('../../src/components/assessments/VitalSignsRunner.jsx', import.meta.url), 'utf8');
  for (const scorer of ['scoreHeartRate', 'scoreSpo2Exercise', 'scoreSpo2Resting', 'scoreBloodPressure']) {
    assert.match(vitalSource, new RegExp(`${scorer}\\(`));
  }
  assert.match(vitalSource, /runnerKey === 'spo2-exercise'/);
  assert.match(vitalSource, /scoreSpo2Resting\(\{ spo2_percent:/);
});

test('central extras handoff resolves both source SpO2 definitions by exact canonical ID and all owned runner cases remain reachable', () => {
  const extrasSource = fs.readFileSync(new URL('../../src/components/assessments/TestRunnerExtras.jsx', import.meta.url), 'utf8');
  assert.match(extrasSource, /assessment:ep-import:6876d96437f326610e5253c6': 'spo2-exercise'/);
  assert.match(extrasSource, /assessment:ep-import:6933ca483ef96a9f8b810bba': 'spo2-resting'/);
  assert.match(extrasSource, /throw new Error\(`Unsupported SpO2 assessment route:/);
  assert.match(extrasSource, /runnerKey=\{resolveSpo2RunnerKey\(assessment, testType\)\}/);

  const routeCases = EXPECTED_KEYS.filter((key) => !['spo2-exercise', 'spo2-resting'].includes(key));
  for (const runnerKey of routeCases) {
    assert.match(extrasSource, new RegExp(`case '${runnerKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }
  assert.match(extrasSource, /case 'spo2-exercise':/);
  assert.match(extrasSource, /case 'spo2-resting':/);
});
