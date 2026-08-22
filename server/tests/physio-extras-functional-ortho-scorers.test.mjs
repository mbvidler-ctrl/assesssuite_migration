import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  DISTRESS_PROBLEM_LIST,
  FIXTURE_BY_KEY,
  RUNNER_KEYS,
  RUNNER_SPECS,
  RUNNER_SPEC_BY_KEY,
  SCORERS_BY_KEY,
  buildFixture,
  validateAndScore,
} from '../../src/lib/clinical/scorers/extrasFunctionalOrtho.js';
import { defineAssessmentScorer } from '../../src/lib/clinical/scorers/contract.js';
import { projectAssessmentResult } from '../../src/components/reports/assessmentResultProjection.js';

const FIXED_CONTEXT = Object.freeze({ assessmentDate: '2026-08-22' });
const FIXTURE_CONTEXT_KEYS = new Set([
  'assessmentDate', 'assessment_date', 'clinicalNotes', 'globalNotes', 'notes',
  'runnerKey', 'runner_key',
]);
const EXPECTED_KEYS = Object.freeze([
  'arm_curl', '30sec_sts', 'triple_hop', 'trendelenburg', 'stair_climb',
  'two_min_step', 'step_tap', 'box_block_test', 'mcgill', '60sec_sts',
  'distress_thermometer', 'static_back', 'rombergs_standing', 'shoulder_tug',
  'gst', 'timed_push_up', 'static_squat', 'squat', 'ymca_bench', '5xsts',
  'fac', 'modified_rankin', 'nine_peg', 'grooved_peg', 'elys_test',
  'thomas_test', 'anterior_drawer_knee', 'noble_compression',
]);

const COMPONENT_BY_KEY = Object.freeze({
  arm_curl: 'ArmCurlRunner.jsx',
  '30sec_sts': '30SecondSittoStandTestRunner.jsx',
  triple_hop: 'TripleHopTestRunner.jsx',
  trendelenburg: 'TrendelenburgTestRunner.jsx',
  stair_climb: 'StairClimbTestRunner.jsx',
  two_min_step: 'TwoMinuteStepTestRunner.jsx',
  step_tap: 'StepTapTestRunner.jsx',
  box_block_test: 'BoxandBlockTestRunner.jsx',
  mcgill: 'McGillCoreEnduranceTestBatteryRunner.jsx',
  '60sec_sts': '60SecondSittoStandTestRunner.jsx',
  distress_thermometer: 'DistressThermometerRunner.jsx',
  static_back: 'StaticBackExtensionBieringSrensenTestRunner.jsx',
  rombergs_standing: 'RombergsTestofStandingBalanceRunner.jsx',
  shoulder_tug: 'ShoulderTugTestPastorsTestRunner.jsx',
  gst: 'GroceryShelvingTestGSTRunner.jsx',
  timed_push_up: 'TimedPushUpTestPressUpTestRunner.jsx',
  static_squat: 'StaticSquatTestWallSquatRunner.jsx',
  squat: 'SquatTestDynamicRunner.jsx',
  ymca_bench: 'YMCABenchPressTestRunner.jsx',
  '5xsts': 'FiveTimesSittoStandTest5xSTSRunner.jsx',
  fac: 'FunctionalAmbulationCategoriesFACRunner.jsx',
  modified_rankin: 'ModifiedRankinScaleRunner.jsx',
  nine_peg: 'NineHolePegTestRunner.jsx',
  grooved_peg: 'GroovedPegboardTestRunner.jsx',
  elys_test: 'ElysTestRectusFemorisTightnessRunner.jsx',
  thomas_test: 'ThomasTestHipFlexorTightnessRunner.jsx',
  anterior_drawer_knee: 'AnteriorDrawerTestKneeRunner.jsx',
  noble_compression: 'NobleCompressionTestRunner.jsx',
});

const SIMPLE_TYPES = new Set(['boolean', 'date', 'duration', 'integer', 'number', 'numeric', 'text', 'textarea', 'time']);
const CHOICE_TYPES = new Set(['choice', 'radio', 'select', 'single_choice', 'yes_no']);
const COMPOUND_TYPES = new Set(['array', 'boolean-map', 'choice-map', 'choice[]', 'multi-select', 'number[]', 'object', 'object[]', 'repeatable_lap', 'repeatable_rest', 'side-measurement', 'side-result', 'string[]', 'vitals']);
const REPEATED_TYPES = new Set(['array', 'choice[]', 'multi-select', 'number[]', 'object[]', 'repeatable_lap', 'repeatable_rest', 'string[]']);

function optionsAreComplete(options) {
  return Array.isArray(options) && options.length >= 2 && options.every((option) => (
    option && typeof option === 'object' && String(option.label || '').trim()
      && option.value !== undefined && option.value !== null
  ));
}

function repeatedCardinalityIsComplete(field) {
  const minimum = Number(field.minItems);
  const maximum = Number(field.maxItems ?? field.length);
  return Number.isInteger(minimum) && minimum >= 0 && (
    (Number.isInteger(maximum) && maximum >= minimum) || field.unbounded === true
  );
}

function fieldCollectionIsComplete(fields) {
  return Array.isArray(fields) && fields.length > 0
    && fields.every(fieldIsComplete)
    && new Set(fields.map(({ key }) => key)).size === fields.length;
}

function fieldIsComplete(field) {
  if (
    !field
    || typeof field !== 'object'
    || !String(field.key || '').trim()
    || /[.\[\]]/.test(field.key)
    || !String(field.label || '').trim()
    || !String(field.type || '').trim()
  ) return false;
  const type = field.type.trim().toLowerCase();
  if (CHOICE_TYPES.has(type)) return optionsAreComplete(field.options);
  if (SIMPLE_TYPES.has(type)) return true;
  if (!COMPOUND_TYPES.has(type)) return false;
  if (['choice-map', 'choice[]', 'multi-select'].includes(type) && optionsAreComplete(field.options)) {
    return !REPEATED_TYPES.has(type) || repeatedCardinalityIsComplete(field);
  }
  const hasRecursiveShape = [field.fields, field.entries, field.items].some(fieldCollectionIsComplete)
    || Boolean(field.itemSchema && fieldIsComplete(field.itemSchema));
  return hasRecursiveShape && (!REPEATED_TYPES.has(type) || repeatedCardinalityIsComplete(field));
}

function visitFields(fields, visitor, parentPath = '') {
  for (const field of fields) {
    const path = parentPath ? `${parentPath}.${field.key}` : field.key;
    visitor(field, path);
    for (const collection of [field.fields, field.entries, field.items]) {
      if (Array.isArray(collection)) visitFields(collection, visitor, path);
    }
    if (field.itemSchema) visitFields([field.itemSchema], visitor, path);
  }
}

function assertDeepFrozen(value, path = 'value') {
  if (!value || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value), `${path} must be frozen`);
  for (const [key, nested] of Object.entries(value)) assertDeepFrozen(nested, `${path}.${key}`);
}

function assertPersistenceInvariant(payload, runnerKey) {
  assert.equal(payload.status, 'completed');
  assert.ok(Number.isFinite(payload.result_value), `${runnerKey} must return a finite result`);
  assert.equal(payload.assessment_date, FIXED_CONTEXT.assessmentDate);
  assert.equal(payload.additional_data.scoring_key, runnerKey);
  assert.equal(payload.additional_data.scoring_version, 'extras-functional-ortho.v1');
  assert.equal(payload.additional_data.measurement_type, RUNNER_SPEC_BY_KEY[runnerKey].measurementType);
  assert.ok(payload.additional_data.raw_input && typeof payload.additional_data.raw_input === 'object');
  assert.ok(payload.additional_data.soap_text.length > 20);
  assert.ok(payload.additional_data.report_text.length > 20);
  assert.doesNotMatch(JSON.stringify(payload), /NaN|Infinity/);

  const reloaded = JSON.parse(JSON.stringify(payload));
  assert.deepEqual(reloaded, payload);
  const projection = projectAssessmentResult({
    assessment: {
      canonical_id: `assessment:test:${runnerKey}`,
      name: `Fixture ${runnerKey}`,
      unit_of_measure: RUNNER_SPEC_BY_KEY[runnerKey].result.unit,
    },
    completedAssessment: reloaded,
  });
  assert.equal(projection.result_value, payload.result_value);
  assert.equal(projection.soap_text, payload.additional_data.soap_text);
  assert.match(projection.report_text, new RegExp(`Fixture ${runnerKey}`));
}

function fixtureWith(runnerKey, mutation) {
  const fixture = buildFixture(runnerKey);
  mutation(fixture);
  return fixture;
}

function runFixtures() {
  return Object.fromEntries(EXPECTED_KEYS.map((runnerKey) => [
    runnerKey,
    validateAndScore(buildFixture(runnerKey), { ...FIXED_CONTEXT, runnerKey }),
  ]));
}

test('functional/orthopaedic RunnerSpecs expose exactly 28 deeply frozen, serializable and recursively complete production routes', () => {
  assert.deepEqual(RUNNER_KEYS, EXPECTED_KEYS);
  assert.deepEqual(RUNNER_SPECS.map(({ runnerKey }) => runnerKey), EXPECTED_KEYS);
  assert.deepEqual(Object.keys(RUNNER_SPEC_BY_KEY), EXPECTED_KEYS);
  assert.deepEqual(Object.keys(FIXTURE_BY_KEY), EXPECTED_KEYS);
  assert.deepEqual(Object.keys(SCORERS_BY_KEY), EXPECTED_KEYS);
  assert.equal(new Set(EXPECTED_KEYS).size, 28);
  assert.equal(Object.keys(COMPONENT_BY_KEY).length, 28);
  assert.equal(RUNNER_SPECS.flatMap(({ fields }) => fields).length, 152);

  assertDeepFrozen(RUNNER_KEYS, 'RUNNER_KEYS');
  assertDeepFrozen(RUNNER_SPECS, 'RUNNER_SPECS');
  assertDeepFrozen(RUNNER_SPEC_BY_KEY, 'RUNNER_SPEC_BY_KEY');
  assertDeepFrozen(FIXTURE_BY_KEY, 'FIXTURE_BY_KEY');
  assertDeepFrozen(SCORERS_BY_KEY, 'SCORERS_BY_KEY');

  for (const spec of RUNNER_SPECS) {
    assert.equal(spec.schemaVersion, 1);
    assert.equal(spec.kind, 'measurement');
    assert.equal(spec.scoringKey, spec.runnerKey);
    assert.equal(spec.scoring.version, 'extras-functional-ortho.v1');
    assert.ok(spec.scoring.formula.length > 10);
    assert.ok(spec.fields.length > 0);
    assert.ok(fieldCollectionIsComplete(spec.fields), `${spec.runnerKey} fields must preserve recursive production content`);
    visitFields(spec.fields, (field, fieldPath) => {
      assert.doesNotMatch(field.key, /[.\[\]]/, `${spec.runnerKey}.${fieldPath} must use an atomic key`);
    });

    const representedKeys = new Set(spec.fields.map(({ key }) => key));
    const fixtureInputKeys = Object.keys(buildFixture(spec.runnerKey))
      .filter((key) => !FIXTURE_CONTEXT_KEYS.has(key));
    assert.deepEqual(
      fixtureInputKeys.filter((key) => !representedKeys.has(key)),
      [],
      `${spec.runnerKey} schema must represent every schema-v6 fixture input`,
    );
    assert.ok(spec.result.primaryField);
    assert.ok(spec.result.unit);
    assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec);
    assert.doesNotThrow(() => defineAssessmentScorer({
      runnerSpec: spec,
      buildFixture: () => buildFixture(spec.runnerKey),
      validateAndScore: (input, context) => validateAndScore(input, { ...context, runnerKey: spec.runnerKey }),
    }));
  }

  const distressSpec = RUNNER_SPEC_BY_KEY.distress_thermometer;
  const problemField = distressSpec.fields.find(({ key }) => key === 'checkedProblems');
  const renderedProblems = Object.values(DISTRESS_PROBLEM_LIST).flat();
  assert.equal(renderedProblems.length, 39);
  assert.deepEqual(problemField.options.map(({ value }) => value), renderedProblems);
  assert.deepEqual(problemField.options.map(({ group }) => group), Object.entries(DISTRESS_PROBLEM_LIST).flatMap(
    ([group, problems]) => problems.map(() => group),
  ));
});

test('all 28 deterministic fixtures execute their actual scorer and round-trip through persistence, SOAP and report projection', () => {
  for (const runnerKey of EXPECTED_KEYS) {
    const fixture = buildFixture(runnerKey);
    const before = structuredClone(fixture);
    assert.notEqual(fixture, FIXTURE_BY_KEY[runnerKey]);

    const routed = validateAndScore(fixture, { ...FIXED_CONTEXT, runnerKey });
    const direct = SCORERS_BY_KEY[runnerKey].validateAndScore(buildFixture(runnerKey), FIXED_CONTEXT);
    assert.deepEqual(direct, routed, `${runnerKey} direct and routed scorers must be identical`);
    assert.deepEqual(fixture, before, `${runnerKey} scorer must not mutate its input`);
    assertPersistenceInvariant(routed, runnerKey);
  }
});

test('all 28 fixtures preserve production formulas, laterality, trials, subscores, norms, observations and interpretations', () => {
  const scored = runFixtures();

  assert.equal(scored.arm_curl.result_value, 18);
  assert.equal(scored.arm_curl.additional_data.asymmetry_reps, 1);
  assert.equal(scored.arm_curl.additional_data.normative_category, 'Above Average');
  assert.equal(scored['30sec_sts'].additional_data.pre_heart_rate, 72);
  assert.equal(scored['30sec_sts'].additional_data.hands_used, false);
  assert.equal(scored.triple_hop.additional_data.best_right_cm, 442);
  assert.equal(scored.triple_hop.additional_data.lsi_percent, 104);
  assert.equal(scored.trendelenburg.additional_data.overall_result, 'Positive');
  assert.deepEqual(scored.trendelenburg.additional_data.right_signs, ['Contralateral Hip Drop']);
  assert.equal(scored.stair_climb.additional_data.interpretation, 'Moderate — minor limitations');
  assert.equal(scored.two_min_step.additional_data.interpretation, 'Average');
  assert.equal(scored.step_tap.additional_data.rate_per_sec, 1.6);
  assert.equal(scored.box_block_test.additional_data.comparison, 'Average');
  assert.equal(scored.box_block_test.additional_data.normative_mean, 80);
  assert.deepEqual(scored.mcgill.additional_data.times, { extensor: 130, flexor: 95, right_side: 78, left_side: 75 });
  assert.deepEqual(scored.mcgill.additional_data.ratios, { flexor_extensor: 0.73, right_side_extensor: 0.6, left_side_extensor: 0.58, side_symmetry: 0.96 });
  assert.equal(scored['60sec_sts'].additional_data.interpretation, 'Average');
  assert.equal(scored.distress_thermometer.additional_data.flagged, true);
  assert.deepEqual(scored.distress_thermometer.additional_data.selected_problems, ['Work/school', 'Fatigue']);
  assert.equal(scored.static_back.additional_data.classification, 'Below Average');
  assert.equal(scored.static_back.additional_data.normative_mean, 152);
  assert.equal(scored.static_back.additional_data.setup.securing, 'straps');
  assert.ok(scored.static_back.additional_data.flags.length >= 1);
  assert.equal(scored.rombergs_standing.result_value, 24.5);
  assert.equal(scored.rombergs_standing.additional_data.romberg_result, 'Negative Romberg');
  assert.equal(scored.rombergs_standing.additional_data.falls_risk, true);
  assert.equal(scored.shoulder_tug.additional_data.interpretation, 'Impaired Balance');
  assert.equal(scored.shoulder_tug.additional_data.fall_risk, 'Moderate-high fall risk');
  assert.equal(scored.gst.additional_data.classification, 'Good');
  assert.deepEqual(scored.timed_push_up.additional_data.pre_test, { restingHR: 68, restingBP: '118/72', restingSPO2: 98 });
  assert.equal(scored.timed_push_up.additional_data.quality_observations, 'Neutral trunk.');
  assert.equal(scored.static_squat.additional_data.classification, 'Good');
  assert.equal(scored.static_squat.additional_data.normative_group, '40–49 yrs');
  assert.equal(scored.static_squat.additional_data.observations.trembling, true);
  assert.equal(scored.squat.additional_data.qualityScore, 4);
  assert.equal(scored.squat.additional_data.interpretation, 'Good');
  assert.equal(scored.ymca_bench.additional_data.category, 'Good');
  assert.equal(scored['5xsts'].result_value, 9.8);
  assert.equal(scored['5xsts'].additional_data.trials.length, 5);
  assert.equal(scored['5xsts'].additional_data.fall_risk, 'Lower fall risk (<15s)');
  assert.equal(scored.fac.additional_data.label, 'Ambulatory — independent on level');
  assert.equal(scored.modified_rankin.additional_data.suggested_grade, 2);
  assert.equal(scored.modified_rankin.additional_data.score_change, -1);
  assert.equal(scored.modified_rankin.additional_data.change_label, 'Improved');
  assert.match(scored.modified_rankin.additional_data.report_text, /slight disability/);
  assert.equal(scored.nine_peg.additional_data.dominant_classification, 'Below Average');
  assert.equal(scored.nine_peg.additional_data.non_dominant_hand_time, 23.1);
  assert.equal(scored.grooved_peg.additional_data.dominant_hand_time_seconds, 74);
  assert.equal(scored.grooved_peg.additional_data.non_dominant_hand_time_seconds, 83);
  assert.equal(scored.grooved_peg.additional_data.dominant_drops, 1);
  assert.equal(scored.grooved_peg.additional_data.assembly_pieces, 18);
  assert.equal(scored.elys_test.additional_data.interpretation, 'Positive (Rectus femoris tightness)');
  assert.equal(scored.thomas_test.additional_data.right.hipAngle, 8);
  assert.equal(scored.thomas_test.additional_data.left.kneeAngle, 84);
  assert.equal(scored.thomas_test.additional_data.overall_result, 'Mixed Findings');
  assert.ok(scored.thomas_test.additional_data.primary_findings.length >= 3);
  assert.equal(scored.anterior_drawer_knee.additional_data.overall_result, 'Positive');
  assert.equal(scored.anterior_drawer_knee.additional_data.anterior_translation_mm, 7);
  assert.equal(scored.noble_compression.additional_data.result, 'Positive');
  assert.equal(scored.noble_compression.additional_data.pain_level, 5);
});

const MISSING_CASES = Object.freeze([
  ['arm_curl', (f) => { delete f.rightReps; }],
  ['30sec_sts', (f) => { delete f.preHR; }],
  ['triple_hop', (f) => { f.rightTrials = []; }],
  ['trendelenburg', (f) => { f.left = {}; f.right = {}; }],
  ['stair_climb', (f) => { delete f.timeSeconds; }],
  ['two_min_step', (f) => { delete f.steps; }],
  ['step_tap', (f) => { delete f.duration; }],
  ['box_block_test', (f) => { delete f.age; }],
  ['mcgill', (f) => { delete f.times.extensor; }],
  ['60sec_sts', (f) => { delete f.handsUsed; }],
  ['distress_thermometer', (f) => { delete f.checkedProblems; }],
  ['static_back', (f) => { delete f.technique.qualityRating; }],
  ['rombergs_standing', (f) => { f.eyesOpenTime = ''; f.eyesClosedTime = ''; }],
  ['shoulder_tug', (f) => { delete f.assistanceNeeded; }],
  ['gst', (f) => { delete f.side; }],
  ['timed_push_up', (f) => { delete f.preTest; }],
  ['static_squat', (f) => { delete f.age; }],
  ['squat', (f) => { delete f.observations; }],
  ['ymca_bench', (f) => { delete f.gender; }],
  ['5xsts', (f) => { delete f.trials; }],
  ['fac', (f) => { delete f.score; }],
  ['modified_rankin', (f) => { delete f.clinicalReasoning; }],
  ['nine_peg', (f) => { delete f.dominantTime; }],
  ['grooved_peg', (f) => { delete f.dominantTime; }],
  ['elys_test', (f) => { delete f.hipFlexionObserved; }],
  ['thomas_test', (f) => { f.setupConfirmed = false; }],
  ['anterior_drawer_knee', (f) => { f.anteriorTranslation = ''; f.translationGrade = ''; }],
  ['noble_compression', (f) => { delete f.isPositive; }],
]);

const NON_FINITE_CASES = Object.freeze([
  ['arm_curl', (f) => { f.rightReps = Number.NaN; }],
  ['30sec_sts', (f) => { f.preHR = Number.NaN; }],
  ['triple_hop', (f) => { f.rightTrials[0] = Number.NaN; }],
  ['trendelenburg', (f) => { f.left.signs.hip_drop = Number.NaN; }],
  ['stair_climb', (f) => { f.timeSeconds = Number.NaN; }],
  ['two_min_step', (f) => { f.steps = Number.NaN; }],
  ['step_tap', (f) => { f.reps = Number.NaN; }],
  ['box_block_test', (f) => { f.blocksMoved = Number.NaN; }],
  ['mcgill', (f) => { f.times.extensor = Number.NaN; }],
  ['60sec_sts', (f) => { f.reps = Number.NaN; }],
  ['distress_thermometer', (f) => { f.score = Number.NaN; }],
  ['static_back', (f) => { f.finalTime = Number.NaN; }],
  ['rombergs_standing', (f) => { f.eyesClosedTime = Number.NaN; }],
  ['shoulder_tug', (f) => { f.steps = Number.NaN; }],
  ['gst', (f) => { f.reps = Number.NaN; }],
  ['timed_push_up', (f) => { f.pushUpCount = Number.NaN; }],
  ['static_squat', (f) => { f.elapsed = Number.NaN; }],
  ['squat', (f) => { f.squatCount = Number.NaN; }],
  ['ymca_bench', (f) => { f.bodyMass = Number.NaN; }],
  ['5xsts', (f) => { f.trials[4] = Number.NaN; }],
  ['fac', (f) => { f.score = Number.NaN; }],
  ['modified_rankin', (f) => { f.selectedScore = Number.NaN; }],
  ['nine_peg', (f) => { f.dominantTime = Number.NaN; }],
  ['grooved_peg', (f) => { f.dominantTime = Number.NaN; }],
  ['elys_test', (f) => { f.kneeFlexionAngle = Number.NaN; }],
  ['thomas_test', (f) => { f.right.hipAngle = Number.NaN; }],
  ['anterior_drawer_knee', (f) => { f.anteriorTranslation = Number.NaN; }],
  ['noble_compression', (f) => { f.kneeAngle = Number.NaN; }],
]);

const OUT_OF_DOMAIN_CASES = Object.freeze([
  ['arm_curl', (f) => { f.weightKg = 101; }],
  ['30sec_sts', (f) => { f.preHR = 301; }],
  ['triple_hop', (f) => { f.rightTrials[0] = -1; }],
  ['trendelenburg', (f) => { f.left.result = 'Impossible'; }],
  ['stair_climb', (f) => { f.timeSeconds = 0; }],
  ['two_min_step', (f) => { f.steps = 1001; }],
  ['step_tap', (f) => { f.duration = 20; }],
  ['box_block_test', (f) => { f.age = 131; }],
  ['mcgill', (f) => { f.times.extensor = 3601; }],
  ['60sec_sts', (f) => { f.reps = 301; }],
  ['distress_thermometer', (f) => { f.score = 11; }],
  ['static_back', (f) => { f.finalTime = 3601; }],
  ['rombergs_standing', (f) => { f.eyesClosedTime = 31; }],
  ['shoulder_tug', (f) => { f.steps = -1; }],
  ['gst', (f) => { f.reps = -1; }],
  ['timed_push_up', (f) => { f.durationSeconds = 61; }],
  ['static_squat', (f) => { f.elapsed = 3601; }],
  ['squat', (f) => { f.squatCount = 0; }],
  ['ymca_bench', (f) => { f.bodyMass = 1001; }],
  ['5xsts', (f) => { f.trials[0] = 0; }],
  ['fac', (f) => { f.score = 6; }],
  ['modified_rankin', (f) => { f.selectedScore = 7; }],
  ['nine_peg', (f) => { f.dominantTime = 0; }],
  ['grooved_peg', (f) => { f.dominantTime = 301; }],
  ['elys_test', (f) => { f.kneeFlexionAngle = 181; }],
  ['thomas_test', (f) => { f.right.hipAngle = 91; }],
  ['anterior_drawer_knee', (f) => { f.anteriorTranslation = 51; }],
  ['noble_compression', (f) => { f.kneeAngle = 181; }],
]);

test('all 28 scorers fail closed for missing required production inputs', () => {
  assert.equal(MISSING_CASES.length, 28);
  assert.deepEqual(MISSING_CASES.map(([runnerKey]) => runnerKey), EXPECTED_KEYS);
  for (const [runnerKey, mutation] of MISSING_CASES) {
    assert.throws(
      () => validateAndScore(fixtureWith(runnerKey, mutation), { ...FIXED_CONTEXT, runnerKey }),
      Error,
      `${runnerKey} must reject missing required input`,
    );
  }
});

test('all 28 scorers reject NaN and other non-finite values without silent zero/default fallback', () => {
  assert.equal(NON_FINITE_CASES.length, 28);
  assert.deepEqual(NON_FINITE_CASES.map(([runnerKey]) => runnerKey), EXPECTED_KEYS);
  for (const [runnerKey, mutation] of NON_FINITE_CASES) {
    assert.throws(
      () => validateAndScore(fixtureWith(runnerKey, mutation), { ...FIXED_CONTEXT, runnerKey }),
      Error,
      `${runnerKey} must reject non-finite input`,
    );
  }
});

test('all 28 scorers reject out-of-range or out-of-domain values', () => {
  assert.equal(OUT_OF_DOMAIN_CASES.length, 28);
  assert.deepEqual(OUT_OF_DOMAIN_CASES.map(([runnerKey]) => runnerKey), EXPECTED_KEYS);
  for (const [runnerKey, mutation] of OUT_OF_DOMAIN_CASES) {
    assert.throws(
      () => validateAndScore(fixtureWith(runnerKey, mutation), { ...FIXED_CONTEXT, runnerKey }),
      Error,
      `${runnerKey} must reject out-of-domain input`,
    );
  }
});

test('demographic-sensitive scorers never fabricate age or sex defaults', () => {
  const twoMinuteInput = buildFixture('two_min_step');
  delete twoMinuteInput.age;
  delete twoMinuteInput.gender;
  const twoMinute = validateAndScore(twoMinuteInput, { ...FIXED_CONTEXT, runnerKey: 'two_min_step' });
  assert.equal(twoMinute.additional_data.client_age_at_test, null);
  assert.equal(twoMinute.additional_data.client_gender, null);
  assert.equal(twoMinute.additional_data.interpretation, null);
  assert.doesNotMatch(twoMinute.additional_data.report_text, /Performance:/);

  const sixtySecondInput = buildFixture('60sec_sts');
  delete sixtySecondInput.age;
  delete sixtySecondInput.gender;
  const sixtySecond = validateAndScore(sixtySecondInput, { ...FIXED_CONTEXT, runnerKey: '60sec_sts' });
  assert.equal(sixtySecond.additional_data.client_age_at_test, null);
  assert.equal(sixtySecond.additional_data.client_gender, null);
  assert.equal(sixtySecond.additional_data.interpretation, null);
  assert.doesNotMatch(sixtySecond.additional_data.report_text, /Performance:/);

  const staticBackInput = buildFixture('static_back');
  delete staticBackInput.age;
  delete staticBackInput.gender;
  const staticBack = validateAndScore(staticBackInput, { ...FIXED_CONTEXT, runnerKey: 'static_back' });
  assert.equal(staticBack.additional_data.classification, null);
  assert.equal(staticBack.additional_data.normative_mean, null);
  assert.equal(staticBack.additional_data.normative_sd, null);
  assert.match(staticBack.additional_data.report_text, /matching demographics were unavailable/);
  assert.doesNotMatch(staticBack.additional_data.report_text, /normative mean of 160/);

  const boxBlock = validateAndScore(
    { ...buildFixture('box_block_test'), sex: 'Other' },
    { ...FIXED_CONTEXT, runnerKey: 'box_block_test' },
  );
  assert.equal(boxBlock.additional_data.sex, 'other');

  assert.throws(
    () => validateAndScore(fixtureWith('arm_curl', (fixture) => { delete fixture.sex; }), { ...FIXED_CONTEXT, runnerKey: 'arm_curl' }),
    /sex must be one of/,
  );
});

test('optional structured context remains explicitly unknown instead of defaulting to independence', () => {
  const rankin = validateAndScore(
    { ...buildFixture('modified_rankin'), interview: {} },
    { ...FIXED_CONTEXT, runnerKey: 'modified_rankin' },
  );
  assert.match(rankin.additional_data.report_text, /personal care status is unclear/);
  assert.match(rankin.additional_data.report_text, /supervision requirements are unclear/);
  assert.doesNotMatch(rankin.additional_data.report_text, /is independent in personal care/);
  assert.doesNotMatch(rankin.additional_data.report_text, /does not require supervision/);
});

test('valid numeric zero is retained on zero-capable fields while incomplete cumulative trials fail', () => {
  const sitToStand = validateAndScore({ ...buildFixture('30sec_sts'), standCount: 0 }, { ...FIXED_CONTEXT, runnerKey: '30sec_sts' });
  assert.equal(sitToStand.result_value, 0);
  assert.equal(sitToStand.additional_data.raw_input.standCount, 0);

  const distress = validateAndScore({ score: 0, checkedProblems: {} }, { ...FIXED_CONTEXT, runnerKey: 'distress_thermometer' });
  assert.equal(distress.result_value, 0);
  assert.equal(distress.additional_data.flagged, false);

  const noble = validateAndScore({ ...buildFixture('noble_compression'), kneeAngle: 0, painLevel: 0 }, { ...FIXED_CONTEXT, runnerKey: 'noble_compression' });
  assert.equal(noble.additional_data.knee_angle_degrees, 0);
  assert.equal(noble.additional_data.pain_level, 0);

  assert.throws(
    () => validateAndScore({ trials: [1, 2, 3, 4, 4] }, { ...FIXED_CONTEXT, runnerKey: '5xsts' }),
    /strictly increasing/,
  );
});

test('router rejects unsupported keys and every owned React runner calls the exact shared scorer before onSave', () => {
  assert.throws(() => buildFixture('not-a-runner'), /unsupported runner fixture/);
  assert.throws(() => validateAndScore({}, FIXED_CONTEXT), /runnerKey must be one of/);
  assert.throws(
    () => validateAndScore(buildFixture('fac'), { ...FIXED_CONTEXT, runnerKey: 'not-a-runner' }),
    /runnerKey must be one of/,
  );

  for (const [runnerKey, filename] of Object.entries(COMPONENT_BY_KEY)) {
    const source = fs.readFileSync(new URL(`../../src/components/assessments/${filename}`, import.meta.url), 'utf8');
    assert.match(source, /@\/lib\/clinical\/scorers\/extrasFunctionalOrtho/);
    assert.match(source, /validateFunctionalOrtho\(/);
    assert.match(source, new RegExp(`runnerKey: ["']${runnerKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`));
    assert.doesNotMatch(source, /onSave\(\s*\{/s, `${filename} must not bypass the shared scorer`);
  }

  const staticSquatSource = fs.readFileSync(new URL('../../src/components/assessments/StaticSquatTestWallSquatRunner.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(staticSquatSource, /if \(!age\) return NORMATIVE_DATA\[0\]/);
  assert.doesNotMatch(staticSquatSource, /client\?\.gender === ["']male["'] \? ["']male["'] : ["']female["']/);
  assert.match(staticSquatSource, /Age and sex are required to generate the normative interpretation/);

  const staticBackSource = fs.readFileSync(new URL('../../src/components/assessments/StaticBackExtensionBieringSrensenTestRunner.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(staticBackSource, /normRow\?\.mean \?\? 160/);
  assert.match(staticBackSource, /matching demographics were unavailable/);

  const rankinSource = fs.readFileSync(new URL('../../src/components/assessments/ModifiedRankinScaleRunner.jsx', import.meta.url), 'utf8');
  assert.match(rankinSource, /personal care status is unclear/);
  assert.match(rankinSource, /supervision requirements are unclear/);

  const nineHoleSource = fs.readFileSync(new URL('../../src/components/assessments/NineHolePegTestRunner.jsx', import.meta.url), 'utf8');
  assert.match(nineHoleSource, /disabled=\{!dominantTime\}/);

  const distressSource = fs.readFileSync(new URL('../../src/components/assessments/DistressThermometerRunner.jsx', import.meta.url), 'utf8');
  assert.match(distressSource, /DISTRESS_PROBLEM_LIST/);
  assert.doesNotMatch(distressSource, /const PROBLEM_LIST\s*=/);

  const extrasSource = fs.readFileSync(new URL('../../src/components/assessments/TestRunnerExtras.jsx', import.meta.url), 'utf8');
  for (const [runnerKey, filename] of Object.entries(COMPONENT_BY_KEY)) {
    const escapedKey = runnerKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(extrasSource, new RegExp(`case ["']${escapedKey}["']`));
    assert.match(extrasSource, new RegExp(filename.replace(/\.jsx$/, '')));
  }
});
