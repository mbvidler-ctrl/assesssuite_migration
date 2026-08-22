import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  FIXTURE_BY_KEY,
  RUNNER_KEYS,
  RUNNER_SPECS,
  RUNNER_SPEC_BY_KEY,
  SCORERS_BY_KEY,
  VISUAL_ROM_JOINTS,
  buildFixture,
  validateAndScore,
} from '../../src/lib/clinical/scorers/extrasMobilityBalanceOrtho.js';
import { defineAssessmentScorer } from '../../src/lib/clinical/scorers/contract.js';
import { projectAssessmentResult } from '../../src/components/reports/assessmentResultProjection.js';

const FIXED_CONTEXT = Object.freeze({ assessmentDate: '2026-08-22' });
const EXPECTED_KEYS = Object.freeze([
  'jta_icare', 'tug_full', 'sit_reach_test', 'chair_sit_reach', 'back_scratch_test',
  'functional_reach_test', 'single_leg_stance_test', 'sppb', 'tandem_stand', 'sebt',
  'ten_metre_walk', 'beighton', 'dual_task_gait', 'plank', 'standing_stork',
  'med_ball', 'purdue_peg', 'standing_long_jump', 'illinois', 't_test', '505',
  'hexagon', 'rsi', '10sec_jump', 'ckcuest_full', 'isometric_testing',
  'isokinetic_dyn', 'obers_test', 'slr_test', 'slump_test', 'lachman_test',
  'pivot_shift', 'mcmurrays_test', 'thessaly_test', 'apleys_compression',
  'l_test', 'figure8', 'visual_rom',
]);

const COMPONENT_BY_KEY = Object.freeze({
  jta_icare: 'JobTaskAnalysisiCareforWorkCoverRunner.jsx',
  tug_full: 'TimedUpAndGoRunner.jsx',
  sit_reach_test: 'SitandReachTestRunner.jsx',
  chair_sit_reach: 'ChairSitandReachTestRunner.jsx',
  back_scratch_test: 'BackScratchTestRunner.jsx',
  functional_reach_test: 'FunctionalReachTestRunner.jsx',
  single_leg_stance_test: 'SingleLegStanceTestRunner.jsx',
  sppb: 'ShortPhysicalPerformanceBatterySPPBRunner.jsx',
  tandem_stand: 'TandemStandBalanceTestRunner.jsx',
  sebt: 'SEBTRunner.jsx',
  ten_metre_walk: 'TenMetreWalkTest10MWTRunner.jsx',
  beighton: 'BeightonHypermobilityScoreRunner.jsx',
  dual_task_gait: 'DualTaskGaitAssessmentRunner.jsx',
  plank: 'PlankHoldTestRunner.jsx',
  standing_stork: 'StandingStorkTestRunner.jsx',
  med_ball: 'MedicineBallThrowRunner.jsx',
  purdue_peg: 'PurduePegboardTestRunner.jsx',
  standing_long_jump: 'StandingLongJumpRunner.jsx',
  illinois: 'IllinoisAgilityTestRunner.jsx',
  t_test: 'TTestAgilityRunner.jsx',
  '505': '505AgilityTestRunner.jsx',
  hexagon: 'HexagonAgilityTestRunner.jsx',
  rsi: 'ReactiveStrengthIndexRSIRunner.jsx',
  '10sec_jump': '10SecondRepeatedJumpTestRunner.jsx',
  ckcuest_full: 'ClosedKineticChainUpperExtremityStabilityTestCKCUESTRunner.jsx',
  isometric_testing: 'IsometricStrengthTestingRunner.jsx',
  isokinetic_dyn: 'IsokineticDynamometryRunner.jsx',
  obers_test: 'ObersTestITBTightnessRunner.jsx',
  slr_test: 'StraightLegRaiseSLRRunner.jsx',
  slump_test: 'SlumpTestRunner.jsx',
  lachman_test: 'LachmanTestRunner.jsx',
  pivot_shift: 'PivotShiftTestRunner.jsx',
  mcmurrays_test: 'McMurraysTestRunner.jsx',
  thessaly_test: 'ThessalyRunner.jsx',
  apleys_compression: 'ApleysCompressionTestRunner.jsx',
  l_test: 'LTestofFunctionalMobilityRunner.jsx',
  figure8: 'FigureofEightWalkTestRunner.jsx',
  visual_rom: 'VisualROMAssessmentRunner.jsx',
});

const SIMPLE_TYPES = new Set(['boolean', 'date', 'duration', 'integer', 'number', 'numeric', 'text', 'textarea', 'time']);
const CHOICE_TYPES = new Set(['choice', 'radio', 'select', 'single_choice', 'yes_no']);
const COMPOUND_TYPES = new Set(['array', 'boolean-map', 'choice-map', 'choice[]', 'multi-select', 'number[]', 'object', 'object[]', 'repeatable_lap', 'repeatable_rest', 'side-measurement', 'side-result', 'string[]', 'vitals']);
const REPEATED_TYPES = new Set(['array', 'choice[]', 'multi-select', 'number[]', 'object[]', 'repeatable_lap', 'repeatable_rest', 'string[]']);

function optionsAreComplete(options) {
  return Array.isArray(options) && options.length >= 2 && options.every((option) => (
    option && typeof option === 'object' && String(option.label || '').trim() && option.value !== undefined && option.value !== null
  ));
}

function repeatedCardinalityIsComplete(field) {
  const minimum = Number(field.minItems);
  const maximum = Number(field.maxItems ?? field.length);
  return Number.isInteger(minimum) && minimum >= 0 && (
    (Number.isInteger(maximum) && maximum >= minimum) || field.unbounded === true
  );
}

function fieldIsComplete(field) {
  if (!field || typeof field !== 'object' || !String(field.key || '').trim() || !String(field.label || '').trim()) return false;
  const type = String(field.type || '').trim().toLowerCase();
  if (CHOICE_TYPES.has(type)) return optionsAreComplete(field.options);
  if (SIMPLE_TYPES.has(type)) return true;
  if (!COMPOUND_TYPES.has(type)) return false;
  if (['choice-map', 'choice[]', 'multi-select'].includes(type) && optionsAreComplete(field.options)) {
    return !REPEATED_TYPES.has(type) || repeatedCardinalityIsComplete(field);
  }
  const hasRecursiveShape = [field.fields, field.entries, field.items].some((collection) => (
    Array.isArray(collection) && collection.length > 0 && collection.every(fieldIsComplete)
  )) || Boolean(field.itemSchema && fieldIsComplete(field.itemSchema));
  return hasRecursiveShape && (!REPEATED_TYPES.has(type) || repeatedCardinalityIsComplete(field));
}

function assertDeepFrozen(value, path = 'value') {
  if (!value || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value), `${path} must be frozen`);
  for (const [key, nested] of Object.entries(value)) assertDeepFrozen(nested, `${path}.${key}`);
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

function assertPersistenceInvariant(payload, runnerKey) {
  assert.equal(payload.status, 'completed');
  assert.ok(Number.isFinite(payload.result_value));
  assert.equal(payload.assessment_date, FIXED_CONTEXT.assessmentDate);
  assert.equal(payload.additional_data.scoring_key, runnerKey);
  assert.equal(payload.additional_data.scoring_version, 'extras-mobility-balance-ortho.v1');
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
  assert.equal(projection.soap_text.trim(), payload.additional_data.soap_text.trim());
  assert.match(projection.report_text, new RegExp(`Fixture ${runnerKey}`));
}

test('mobility/balance/orthopaedic RunnerSpecs expose exactly 38 frozen, serializable and recursively complete production routes', () => {
  assert.deepEqual(RUNNER_KEYS, EXPECTED_KEYS);
  assert.deepEqual(RUNNER_SPECS.map(({ runnerKey }) => runnerKey), EXPECTED_KEYS);
  assert.deepEqual(new Set(Object.keys(RUNNER_SPEC_BY_KEY)), new Set(EXPECTED_KEYS));
  assert.deepEqual(new Set(Object.keys(FIXTURE_BY_KEY)), new Set(EXPECTED_KEYS));
  assert.deepEqual(new Set(Object.keys(SCORERS_BY_KEY)), new Set(EXPECTED_KEYS));
  assert.equal(new Set(EXPECTED_KEYS).size, 38);
  assert.equal(Object.keys(COMPONENT_BY_KEY).length, 38);
  assert.equal(RUNNER_SPECS.flatMap(({ fields }) => fields).length, 125);

  assertDeepFrozen(RUNNER_KEYS, 'RUNNER_KEYS');
  assertDeepFrozen(RUNNER_SPECS, 'RUNNER_SPECS');
  assertDeepFrozen(RUNNER_SPEC_BY_KEY, 'RUNNER_SPEC_BY_KEY');
  assertDeepFrozen(FIXTURE_BY_KEY, 'FIXTURE_BY_KEY');
  assertDeepFrozen(SCORERS_BY_KEY, 'SCORERS_BY_KEY');

  for (const spec of RUNNER_SPECS) {
    assert.equal(spec.schemaVersion, 1);
    assert.equal(spec.kind, 'measurement');
    assert.equal(spec.scoringKey, spec.runnerKey);
    assert.equal(spec.scoring.version, 'extras-mobility-balance-ortho.v1');
    assert.ok(spec.scoring.formula.length > 10);
    assert.ok(spec.fields.length > 0);
    assert.ok(spec.fields.every(fieldIsComplete), `${spec.runnerKey} fields must preserve recursive production content`);
    const visit = (fields) => {
      for (const field of fields) {
        assert.doesNotMatch(field.key, /[.\[\]]/, `${spec.runnerKey}.${field.key} must be an atomic schema key`);
        for (const collection of [field.fields, field.entries, field.items]) if (Array.isArray(collection)) visit(collection);
        if (field.itemSchema) visit([field.itemSchema]);
      }
    };
    visit(spec.fields);
    assert.ok(spec.result.primaryField);
    assert.ok(spec.result.unit);
    assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec);
    assert.doesNotThrow(() => defineAssessmentScorer({
      runnerSpec: spec,
      buildFixture: () => buildFixture(spec.runnerKey),
      validateAndScore: (input, context) => validateAndScore(input, { ...context, runnerKey: spec.runnerKey }),
    }));
  }
});

test('all 38 deterministic fixtures execute the actual scorer and round-trip through persistence, SOAP and report projection', () => {
  for (const runnerKey of EXPECTED_KEYS) {
    const fixture = buildFixture(runnerKey);
    const before = structuredClone(fixture);
    assert.notEqual(fixture, FIXTURE_BY_KEY[runnerKey]);
    const routed = validateAndScore(fixture, { ...FIXED_CONTEXT, runnerKey });
    const direct = SCORERS_BY_KEY[runnerKey].validateAndScore(buildFixture(runnerKey), FIXED_CONTEXT);
    assert.deepEqual(direct, routed, `${runnerKey} direct and routed scorers must be identical`);
    assert.deepEqual(fixture, before, `${runnerKey} scorer must not mutate input`);
    assertPersistenceInvariant(routed, runnerKey);
  }
});

test('all 38 fixtures preserve production formulas, trials, laterality, subscores, setup, observations and interpretations', () => {
  const scored = runFixtures();
  const expectedPrimary = {
    jta_icare: 3, tug_full: 11.1, sit_reach_test: 31, chair_sit_reach: 5, back_scratch_test: 2,
    functional_reach_test: 27, single_leg_stance_test: 24, sppb: 11, tandem_stand: 4, sebt: 82.6,
    ten_metre_walk: 1.25, beighton: 5, dual_task_gait: 26.83, plank: 112, standing_stork: 26,
    med_ball: 4.6, purdue_peg: 73, standing_long_jump: 196, illinois: 16.9, t_test: 10.5,
    505: 2.38, hexagon: 13.2, rsi: 2.216, '10sec_jump': 1.826, ckcuest_full: 21,
    isometric_testing: 325, isokinetic_dyn: 182, obers_test: 1, slr_test: 82, slump_test: 1,
    lachman_test: 6, pivot_shift: 2, mcmurrays_test: 1, thessaly_test: 1, apleys_compression: 1,
    l_test: 20.8, figure8: 12.5, visual_rom: 75,
  };
  assert.deepEqual(new Set(Object.keys(expectedPrimary)), new Set(EXPECTED_KEYS));
  for (const runnerKey of EXPECTED_KEYS) assert.equal(scored[runnerKey].result_value, expectedPrimary[runnerKey], runnerKey);

  assert.equal(scored.tug_full.additional_data.trials.length, 2);
  assert.equal(scored.sppb.additional_data.balance_score, 4);
  assert.equal(scored.sppb.additional_data.gait_score, 4);
  assert.equal(scored.sppb.additional_data.chair_score, 3);
  assert.equal(scored.sebt.additional_data.normalized_reaches.Anterior, 69.6);
  assert.equal(scored.beighton.additional_data.positive_items.length, 5);
  assert.equal(scored.standing_stork.additional_data.left_data.quality_scores.postural_control, 3);
  assert.equal(scored.t_test.additional_data.rts_status, 'RTS — Cleared');
  assert.equal(scored.t_test.additional_data.setup.surface, 'Indoor court');
  assert.equal(scored['505'].additional_data.best_time_left, 2.44);
  assert.equal(scored.rsi.additional_data.trials.length, 2);
  assert.equal(scored.isometric_testing.additional_data.symmetry_analysis.knee_extension.ratio, 92.9);
  assert.equal(scored.isokinetic_dyn.additional_data.sets.length, 2);
  assert.equal(scored.slr_test.additional_data.left_positive, true);
  assert.equal(scored.slump_test.additional_data.right_positive, false);
  assert.equal(scored.mcmurrays_test.additional_data.medial_positive, 1);
  assert.equal(scored.visual_rom.additional_data.completed_movements, 6);
});

const MISSING_CASES = Object.freeze([
  ['jta_icare', (f) => { delete f.role; }], ['tug_full', (f) => { f.trials = []; }],
  ['sit_reach_test', (f) => { delete f.boxOffset; }], ['chair_sit_reach', (f) => { f.trials = []; }],
  ['back_scratch_test', (f) => { f.leftTrials = []; f.rightTrials = []; }], ['functional_reach_test', (f) => { f.trials = []; }],
  ['single_leg_stance_test', (f) => { f.leftTrials = []; f.rightTrials = []; }], ['sppb', (f) => { delete f.balance.sideBySide; }],
  ['tandem_stand', (f) => { delete f.trials; }], ['sebt', (f) => { delete f.legLength; }],
  ['ten_metre_walk', (f) => { f.trials = []; }], ['beighton', (f) => { delete f.scores.leftLittleFinger; }],
  ['dual_task_gait', (f) => { delete f.cognitiveTask; }], ['plank', (f) => { f.testAttempts = []; }],
  ['standing_stork', (f) => { f.leftData.trials = []; }], ['med_ball', (f) => { f.trials = []; }],
  ['purdue_peg', (f) => { f.scores = {}; }], ['standing_long_jump', (f) => { f.trials = []; }],
  ['illinois', (f) => { f.trialTimes = []; }], ['t_test', (f) => { f.trialResults = []; }],
  ['505', (f) => { f.trials = []; }], ['hexagon', (f) => { f.trials = []; }],
  ['rsi', (f) => { f.trials = []; }], ['10sec_jump', (f) => { f.jumps = []; }],
  ['ckcuest_full', (f) => { f.trials = []; }], ['isometric_testing', (f) => { f.tests = []; }],
  ['isokinetic_dyn', (f) => { f.sets = []; }], ['obers_test', (f) => { delete f.bilateralResults.left; }],
  ['slr_test', (f) => { delete f.left.maxAngle; }], ['slump_test', (f) => { delete f.leftData.kneeAngle; delete f.leftData.positive; }],
  ['lachman_test', (f) => { delete f.kneeFlexion; }], ['pivot_shift', (f) => { delete f.leftGrade; }],
  ['mcmurrays_test', (f) => { f.medialResults = []; f.lateralResults = []; }], ['thessaly_test', (f) => { f.leftData = null; f.rightData = null; }],
  ['apleys_compression', (f) => { f.trials = []; }], ['l_test', (f) => { f.trialTimesDeciseconds = []; }],
  ['figure8', (f) => { f.trialData = []; }], ['visual_rom', (f) => { f.selectedJointKeys = []; }],
]);

const NON_FINITE_CASES = Object.freeze([
  ['jta_icare', (f) => { f.hoursInShift = Number.NaN; }], ['tug_full', (f) => { f.trials[0].time = Number.NaN; }],
  ['sit_reach_test', (f) => { f.trials[0] = Number.NaN; }], ['chair_sit_reach', (f) => { f.trials[0] = Number.NaN; }],
  ['back_scratch_test', (f) => { f.leftTrials[0] = Number.NaN; }], ['functional_reach_test', (f) => { f.trials[0] = Number.NaN; }],
  ['single_leg_stance_test', (f) => { f.leftTrials[0] = Number.NaN; }], ['sppb', (f) => { f.gait.trial1 = Number.NaN; }],
  ['tandem_stand', (f) => { f.trials[0] = Number.NaN; }], ['sebt', (f) => { f.legLength = Number.NaN; }],
  ['ten_metre_walk', (f) => { f.trials[0].time = Number.NaN; }], ['beighton', (f) => { f.scores.leftLittleFinger = Number.NaN; }],
  ['dual_task_gait', (f) => { f.singleTaskTime = Number.NaN; }], ['plank', (f) => { f.testAttempts[0] = Number.NaN; }],
  ['standing_stork', (f) => { f.leftData.trials[0] = Number.NaN; }], ['med_ball', (f) => { f.trials[0] = Number.NaN; }],
  ['purdue_peg', (f) => { f.scores.rightHand = Number.NaN; }], ['standing_long_jump', (f) => { f.trials[0] = Number.NaN; }],
  ['illinois', (f) => { f.trialTimes[0] = Number.NaN; }], ['t_test', (f) => { f.trialResults[0].time = Number.NaN; }],
  ['505', (f) => { f.trials[0].time = Number.NaN; }], ['hexagon', (f) => { f.trials[0] = Number.NaN; }],
  ['rsi', (f) => { f.trials[0].jumpHeight = Number.NaN; }], ['10sec_jump', (f) => { f.jumps[0].flight_time_ms = Number.NaN; }],
  ['ckcuest_full', (f) => { f.trials[0] = Number.NaN; }], ['isometric_testing', (f) => { f.tests[0].trial1 = Number.NaN; }],
  ['isokinetic_dyn', (f) => { f.sets[0].peakTorque = Number.NaN; }], ['obers_test', (f) => { f.preTestVitals.systolic = Number.NaN; }],
  ['slr_test', (f) => { f.left.maxAngle = Number.NaN; }], ['slump_test', (f) => { f.leftData.kneeAngle = Number.NaN; }],
  ['lachman_test', (f) => { f.kneeFlexion = Number.NaN; }], ['pivot_shift', (f) => { f.leftGrade = Number.NaN; }],
  ['mcmurrays_test', (f) => { f.preTestVitals.systolic = Number.NaN; }], ['thessaly_test', (f) => { f.leftData.joint_line_pain = Number.NaN; }],
  ['apleys_compression', (f) => { f.trials[0].painLocation = Number.NaN; }], ['l_test', (f) => { f.trialTimesDeciseconds[0] = Number.NaN; }],
  ['figure8', (f) => { f.trialData[0].time = Number.NaN; }], ['visual_rom', (f) => { f.results.cervical.Flexion.rom = Number.NaN; }],
]);

const OUT_OF_DOMAIN_CASES = Object.freeze([
  ['jta_icare', (f) => { f.hoursInShift = 25; }], ['tug_full', (f) => { f.trials[0].time = 0; }],
  ['sit_reach_test', (f) => { f.boxOffset = 201; }], ['chair_sit_reach', (f) => { f.trials[0] = 201; }],
  ['back_scratch_test', (f) => { f.leftTrials[0] = 101; }], ['functional_reach_test', (f) => { f.trials[0] = 201; }],
  ['single_leg_stance_test', (f) => { f.leftTrials[0] = 601; }], ['sppb', (f) => { f.gait.walkDistance = 5; }],
  ['tandem_stand', (f) => { f.trials[0] = 11; }], ['sebt', (f) => { f.legLength = 0; }],
  ['ten_metre_walk', (f) => { f.pace = 'sprint'; }], ['beighton', (f) => { f.scores.leftLittleFinger = 'yes'; }],
  ['dual_task_gait', (f) => { f.singleTaskTime = 0; }], ['plank', (f) => { f.testAttempts[0] = 3601; }],
  ['standing_stork', (f) => { f.setup.eyes = 'covered'; }], ['med_ball', (f) => { f.trials[0] = 101; }],
  ['purdue_peg', (f) => { f.scores.rightHand = 501; }], ['standing_long_jump', (f) => { f.trials[0] = 1001; }],
  ['illinois', (f) => { f.trialTimes[0] = 0; }], ['t_test', (f) => { f.setup.surface = 'Road'; }],
  ['505', (f) => { f.trials[0].direction = 'Forward'; }], ['hexagon', (f) => { f.trials[0] = 301; }],
  ['rsi', (f) => { f.dropHeight = 201; }], ['10sec_jump', (f) => { f.jumps[0].contact_time_ms = 5001; }],
  ['ckcuest_full', (f) => { f.trials[0] = 0; }], ['isometric_testing', (f) => { f.tests[0].muscle = 'unknown'; }],
  ['isokinetic_dyn', (f) => { f.sets[0].side = 'bilateral'; }], ['obers_test', (f) => { f.bilateralResults.left = 'unclear'; }],
  ['slr_test', (f) => { f.left.maxAngle = 181; }], ['slump_test', (f) => { f.leftData.painSeverity = 11; }],
  ['lachman_test', (f) => { f.kneeFlexion = 91; }], ['pivot_shift', (f) => { f.leftGrade = 4; }],
  ['mcmurrays_test', (f) => { f.medialResults[0] = 'unclear'; }], ['thessaly_test', (f) => { f.leftData.pain_intensity = 'extreme'; }],
  ['apleys_compression', (f) => { f.trials[0].painLocation = 'anterior'; }], ['l_test', (f) => { f.trialTimesDeciseconds[0] = 0; }],
  ['figure8', (f) => { f.trialData[0].time = 0; }], ['visual_rom', (f) => { f.results.cervical.Flexion.rom = 65; }],
]);

for (const [label, cases] of [
  ['missing required production inputs', MISSING_CASES],
  ['NaN and other non-finite values', NON_FINITE_CASES],
  ['out-of-range or out-of-domain values', OUT_OF_DOMAIN_CASES],
]) {
  test(`all 38 scorers fail closed for ${label}`, () => {
    assert.equal(cases.length, 38);
    assert.deepEqual(cases.map(([runnerKey]) => runnerKey), EXPECTED_KEYS);
    for (const [runnerKey, mutation] of cases) {
      assert.throws(
        () => validateAndScore(fixtureWith(runnerKey, mutation), { ...FIXED_CONTEXT, runnerKey }),
        Error,
        `${runnerKey} must reject ${label}`,
      );
    }
  });
}

test('router rejects unsupported keys and every owned React runner calls the exact shared scorer before onSave', () => {
  assert.throws(() => buildFixture('not-a-runner'), /unsupported runner fixture/);
  assert.throws(() => validateAndScore({}, FIXED_CONTEXT), /runnerKey must be one of/);
  assert.throws(() => validateAndScore(buildFixture('sppb'), { ...FIXED_CONTEXT, runnerKey: 'not-a-runner' }), /runnerKey must be one of/);

  for (const [runnerKey, filename] of Object.entries(COMPONENT_BY_KEY)) {
    const source = fs.readFileSync(new URL(`../../src/components/assessments/${filename}`, import.meta.url), 'utf8');
    assert.match(source, /@\/lib\/clinical\/scorers\/extrasMobilityBalanceOrtho/);
    assert.match(source, /validateMobilityOrtho\(/);
    assert.match(source, new RegExp(`runnerKey: ["']${runnerKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`));
    assert.doesNotMatch(source, /onSave\(\s*\{/s, `${filename} must not bypass the shared scorer`);
  }

  const visualSource = fs.readFileSync(new URL('../../src/components/assessments/VisualROMAssessmentRunner.jsx', import.meta.url), 'utf8');
  assert.match(visualSource, /VISUAL_ROM_JOINTS/);
  assert.doesNotMatch(visualSource, /const JOINTS = \[/);
  assert.equal(VISUAL_ROM_JOINTS.length, 15);

  const extrasSource = fs.readFileSync(new URL('../../src/components/assessments/TestRunnerExtras.jsx', import.meta.url), 'utf8');
  for (const [runnerKey, filename] of Object.entries(COMPONENT_BY_KEY)) {
    assert.match(extrasSource, new RegExp(`case ["']${runnerKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`));
    const routeComponentName = filename === 'ThessalyRunner.jsx' ? 'ThessalyTestRunner' : filename.replace(/\.jsx$/, '');
    assert.match(extrasSource, new RegExp(routeComponentName));
  }
});
