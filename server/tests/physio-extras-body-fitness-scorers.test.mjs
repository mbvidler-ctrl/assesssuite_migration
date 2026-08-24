import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  RUNNER_SPECS,
  buildFixture,
  scoreBmi,
  scoreFvc,
  scoreHomeStep,
  scoreHydrostatic,
  scoreMet,
  scoreRsa,
  scoreSkinfold,
  scoreVo2Gxt,
  scoreWingate,
  validateAndScore,
} from '../../src/lib/clinical/scorers/extrasBodyFitness.js';
import { projectAssessmentResult } from '../../src/components/reports/assessmentResultProjection.js';

const FIXED_CONTEXT = Object.freeze({ assessmentDate: '2026-08-22' });
const EXPECTED_KEYS = Object.freeze([
  'bmi_full', 'whr_full', 'girth', 'body_fat_skinfold', 'home_step',
  '12min_walk', 'max_push', 'fvc', 'pefr', 'ymca_cycle', 'wingate',
  'rsa_generic', 'hydrostatic', 'rmr', 'rsa_6x30', 'rsa_10x20',
  'rsa_7x35', 'rsa_shuttle', 'vo2max_gxt_full', 'met_calc_full',
]);
const SIMPLE_FIELD_TYPES = new Set([
  'boolean', 'date', 'duration', 'integer', 'number', 'numeric', 'text', 'textarea', 'time',
]);
const CHOICE_FIELD_TYPES = new Set(['choice', 'radio', 'select', 'single_choice', 'yes_no']);
const COMPOUND_FIELD_TYPES = new Set([
  'array', 'boolean-map', 'choice-map', 'choice[]', 'multi-select', 'number[]', 'object', 'object[]',
  'repeatable_lap', 'repeatable_rest', 'side-measurement', 'side-result', 'string[]', 'vitals',
]);
const REPEATED_FIELD_TYPES = new Set([
  'array', 'choice[]', 'multi-select', 'number[]', 'object[]', 'repeatable_lap', 'repeatable_rest', 'string[]',
]);
const FIXTURE_CONTEXT_KEYS = new Set([
  'assessmentDate', 'assessment_date', 'clinicalNotes', 'globalNotes', 'notes', 'runnerKey', 'runner_key',
]);
const REOPENED_COMPOUND_FIELDS = Object.freeze({
  girth: Object.freeze(['selected_sites', 'measurements']),
  body_fat_skinfold: Object.freeze(['measurements']),
  max_push: Object.freeze(['trials']),
  fvc: Object.freeze(['trials']),
  pefr: Object.freeze(['trials', 'pre_test_vitals', 'post_test_vitals']),
  ymca_cycle: Object.freeze(['heart_rates', 'workloads']),
  wingate: Object.freeze(['interval_revolutions']),
  rsa_generic: Object.freeze(['sprint_times']),
  hydrostatic: Object.freeze(['underwater_weights_kg']),
  rsa_6x30: Object.freeze(['sprint_times']),
  rsa_10x20: Object.freeze(['sprint_times']),
  rsa_7x35: Object.freeze(['sprint_times']),
  rsa_shuttle: Object.freeze(['sprint_times']),
  met_calc_full: Object.freeze(['pre_test_vitals', 'post_test_vitals']),
});

function optionsAreComplete(options) {
  return Array.isArray(options)
    && options.length >= 2
    && options.every((option) => (
      option
      && typeof option === 'object'
      && String(option.label ?? '').trim().length > 0
      && option.value !== undefined
      && option.value !== null
    ));
}

function assertDeepFrozen(value, path = 'value', seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value), `${path} must be frozen`);
  for (const [key, child] of Object.entries(value)) assertDeepFrozen(child, `${path}.${key}`, seen);
}

function repeatedCardinalityIsComplete(field) {
  return Number.isInteger(field.minItems)
    && field.minItems >= 0
    && (
      (Number.isInteger(field.maxItems) && field.maxItems >= field.minItems)
      || field.unbounded === true
    );
}

function fieldCollectionIsComplete(fields) {
  return Array.isArray(fields)
    && fields.length > 0
    && new Set(fields.map(({ key }) => String(key))).size === fields.length
    && fields.every(fieldIsRecursivelyComplete);
}

function fieldIsRecursivelyComplete(field) {
  if (!field || typeof field !== 'object') return false;
  const key = String(field.key ?? '').trim();
  const label = String(field.label ?? '').trim();
  const type = String(field.type ?? '').trim().toLowerCase();
  if (!key || /[.\[\]]/.test(key) || !label || !type) return false;
  if (CHOICE_FIELD_TYPES.has(type)) return optionsAreComplete(field.options);
  if (SIMPLE_FIELD_TYPES.has(type)) return true;
  if (!COMPOUND_FIELD_TYPES.has(type)) return false;
  if (['choice-map', 'choice[]', 'multi-select'].includes(type) && optionsAreComplete(field.options)) {
    return !REPEATED_FIELD_TYPES.has(type) || repeatedCardinalityIsComplete(field);
  }
  if ([field.fields, field.entries, field.items].some(fieldCollectionIsComplete)) {
    return !REPEATED_FIELD_TYPES.has(type) || repeatedCardinalityIsComplete(field);
  }
  return Boolean(
    field.itemSchema
    && fieldIsRecursivelyComplete(field.itemSchema)
    && repeatedCardinalityIsComplete(field),
  );
}

function representedFixtureKeys(spec) {
  return new Set(spec.fields.map(({ key }) => String(key)));
}

function assertPersistenceInvariant(payload, runnerKey) {
  assert.equal(payload.status, 'completed');
  assert.ok(Number.isFinite(payload.result_value), `${runnerKey} must return a finite result`);
  assert.equal(payload.assessment_date, FIXED_CONTEXT.assessmentDate);
  assert.equal(payload.additional_data.scoring_key, runnerKey);
  assert.equal(payload.additional_data.scoring_version, `${runnerKey}.v1`);
  assert.ok(payload.additional_data.measurement_type);
  assert.ok(payload.additional_data.raw_input);
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

test('body/fitness RunnerSpecs expose exactly 20 frozen and serializable production routes', () => {
  assert.deepEqual(RUNNER_SPECS.map(({ runnerKey }) => runnerKey), EXPECTED_KEYS);
  assert.equal(new Set(EXPECTED_KEYS).size, 20);
  for (const spec of RUNNER_SPECS) {
    assertDeepFrozen(spec, spec.runnerKey);
    assert.equal(spec.schemaVersion, 1);
    assert.equal(spec.kind, 'measurement');
    assert.equal(spec.scoringKey, spec.runnerKey);
    assert.ok(spec.fields.length > 0);
    assert.equal(new Set(spec.fields.map(({ key }) => key)).size, spec.fields.length, `${spec.runnerKey} top-level field keys must be unique`);
    assert.ok(spec.fields.every(fieldIsRecursivelyComplete), `${spec.runnerKey} fields must be recursively complete`);
    assert.ok(spec.result.primaryField);
    assert.ok(spec.result.unit);
    assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec);

    const represented = representedFixtureKeys(spec);
    const unrepresented = Object.keys(buildFixture(spec.runnerKey))
      .filter((key) => !FIXTURE_CONTEXT_KEYS.has(key))
      .filter((key) => !represented.has(key));
    assert.deepEqual(unrepresented, [], `${spec.runnerKey} fixture inputs must all be represented by its frozen spec`);
  }
});

test('the fourteen reopened B3 routes expose atomic recursively complete production compounds', () => {
  assert.equal(Object.keys(REOPENED_COMPOUND_FIELDS).length, 14);
  for (const [runnerKey, expectedFields] of Object.entries(REOPENED_COMPOUND_FIELDS)) {
    const spec = RUNNER_SPECS.find((candidate) => candidate.runnerKey === runnerKey);
    assert.ok(spec, runnerKey);
    for (const key of expectedFields) {
      const field = spec.fields.find((candidate) => candidate.key === key);
      assert.ok(field, `${runnerKey} must expose ${key}`);
      assert.ok(COMPOUND_FIELD_TYPES.has(field.type), `${runnerKey}.${key} must remain a compound production input`);
      assert.ok(fieldIsRecursivelyComplete(field), `${runnerKey}.${key} must be recursively complete`);
    }
  }

  const field = (runnerKey, key) => RUNNER_SPECS.find((spec) => spec.runnerKey === runnerKey).fields.find((candidate) => candidate.key === key);
  assert.deepEqual([field('max_push', 'trials').minItems, field('max_push', 'trials').maxItems], [1, 20]);
  assert.deepEqual([field('fvc', 'trials').minItems, field('fvc', 'trials').maxItems], [1, 5]);
  assert.deepEqual([field('pefr', 'trials').minItems, field('pefr', 'trials').maxItems], [1, 10]);
  assert.deepEqual([field('wingate', 'interval_revolutions').minItems, field('wingate', 'interval_revolutions').maxItems], [6, 6]);
  assert.deepEqual([field('hydrostatic', 'underwater_weights_kg').minItems, field('hydrostatic', 'underwater_weights_kg').maxItems], [3, 5]);
  assert.deepEqual([field('rsa_6x30', 'sprint_times').minItems, field('rsa_6x30', 'sprint_times').maxItems], [6, 6]);
  assert.deepEqual([field('rsa_10x20', 'sprint_times').minItems, field('rsa_10x20', 'sprint_times').maxItems], [10, 10]);
  assert.deepEqual([field('rsa_7x35', 'sprint_times').minItems, field('rsa_7x35', 'sprint_times').maxItems], [7, 7]);
  assert.deepEqual([field('rsa_shuttle', 'sprint_times').minItems, field('rsa_shuttle', 'sprint_times').maxItems], [6, 6]);
  assert.deepEqual(field('rsa_generic', 'sprint_times').cardinalityByProtocol, { rsa_6x30: 6, rsa_7x35: 7, rsa_10x20: 10, rsa_shuttle: 6 });
});

test('VO2 fixture fields rejected by schema-v6 are explicit production fields', () => {
  const spec = RUNNER_SPECS.find(({ runnerKey }) => runnerKey === 'vo2max_gxt_full');
  const fieldKeys = new Set(spec.fields.map(({ key }) => key));
  for (const key of ['peak_hr', 'peak_rer', 'peak_rpe', 'ecg_findings', 'adverse_events']) {
    assert.ok(fieldKeys.has(key), `vo2max_gxt_full must expose ${key}`);
  }
});

test('all 20 deterministic fixtures run their real scorer and round-trip through persistence/SOAP/report projection', () => {
  for (const runnerKey of EXPECTED_KEYS) {
    const fixture = buildFixture(runnerKey);
    const payload = validateAndScore(fixture, { ...FIXED_CONTEXT, runnerKey, assessmentName: `Fixture ${runnerKey}` });
    assertPersistenceInvariant(payload, runnerKey);
  }
});

test('BMI and skinfold calculations preserve the production formula and accepted boundaries', () => {
  const bmi = scoreBmi({ height_cm: 200, weight_kg: 100 }, FIXED_CONTEXT);
  assert.equal(bmi.result_value, 25);
  assert.equal(bmi.additional_data.bmi_category, 'Overweight');

  const fourSite = scoreSkinfold({
    measurements: { biceps: 8, triceps: 12, subscapular: 14, suprailiac: 10 },
    age: 35,
    sex: 'male',
  }, FIXED_CONTEXT);
  assert.equal(fourSite.additional_data.equation, 'male-4-site');
  assert.equal(fourSite.additional_data.measurement_sites.length, 4);
  assert.ok(Number.isFinite(fourSite.result_value));

  const sevenSite = scoreSkinfold({
    measurements: { biceps: 8, triceps: 12, subscapular: 14, suprailiac: 10, chest: 9, abdominal: 15, thigh: 13 },
    age: 35,
    sex: 'female',
  }, FIXED_CONTEXT);
  assert.equal(sevenSite.additional_data.equation, 'female-7-site');
});

test('zero is preserved where valid while missing, NaN and out-of-range anthropometric values fail closed', () => {
  const step = scoreHomeStep({ age: 40, pre_hr: 100, pre_rpe: 0, post_hr: 100, post_rpe: 0 }, FIXED_CONTEXT);
  assert.equal(step.result_value, 0);
  assert.equal(step.additional_data.pre_test.rpe, 0);
  assert.equal(step.additional_data.post_test.rpe, 0);

  const met = scoreMet({ speed_mph: 4, grade_pct: 0 }, FIXED_CONTEXT);
  assert.ok(Number.isFinite(met.result_value));
  assert.equal(met.additional_data.grade_pct, 0);

  assert.throws(() => scoreBmi({ height_cm: '', weight_kg: 70 }, FIXED_CONTEXT), /Height is required/);
  assert.throws(() => scoreBmi({ height_cm: 170, weight_kg: Number.NaN }, FIXED_CONTEXT), /finite number/);
  assert.throws(() => scoreBmi({ height_cm: 0, weight_kg: 70 }, FIXED_CONTEXT), /30 to 300/);
  assert.throws(() => scoreSkinfold({ measurements: { biceps: 8 }, age: 35, sex: 'male' }, FIXED_CONTEXT), /Exactly four or seven/);
  assert.throws(() => validateAndScore({ distance_m: 400, age: 70, gender: 'female' }, { ...FIXED_CONTEXT, runnerKey: '12min_walk' }), /505 to 20000/);
});

test('FVC and hydrostatic paths reject incomplete trials, NaN and impossible finite inputs', () => {
  const fvc = scoreFvc({ trials: [{ fvc: 4.2, fev1: 3.5, pef: 520 }] }, FIXED_CONTEXT);
  assert.equal(fvc.result_value, 4.2);
  assert.equal(fvc.additional_data.fev1_fvc_ratio, 0.833);
  assert.equal('gold_stage' in fvc.additional_data, false);
  assert.throws(() => scoreFvc({ trials: [{ fvc: '', fev1: 3.5 }] }, FIXED_CONTEXT), /FVC is required/);
  assert.throws(() => scoreFvc({ trials: [{ fvc: Number.NaN }] }, FIXED_CONTEXT), /finite number/);
  assert.throws(() => scoreFvc({ trials: [{ fvc: 20.1 }] }, FIXED_CONTEXT), /0\.01 to 20/);

  assert.throws(() => scoreHydrostatic({ land_weight_kg: 75, underwater_weights_kg: [3, 3.1] }, FIXED_CONTEXT), /3 to 5 entries/);
  assert.throws(() => scoreHydrostatic({ land_weight_kg: 75, underwater_weights_kg: [75, 3, 3.1] }, FIXED_CONTEXT), /less than land weight/);
  assert.throws(() => scoreHydrostatic({ land_weight_kg: 75, underwater_weights_kg: [3, Number.NaN, 3.1] }, FIXED_CONTEXT), /finite number/);
});

test('Wingate accepts exactly six complete intervals or a complete manual trio and never a partial fallback', () => {
  const auto = scoreWingate(buildFixture('wingate'), FIXED_CONTEXT);
  assert.equal(auto.additional_data.interval_powers.length, 6);
  assert.ok(auto.additional_data.peak_power_w > auto.additional_data.mean_power_w);
  assert.ok(auto.additional_data.mean_power_w > auto.additional_data.min_power_w);

  const manual = scoreWingate({ body_mass_kg: 75, resistance_kp: 5.625, sport: 'General Population', gender: 'male', interval_revolutions: ['', '', '', '', '', ''], manual_peak_power_w: 800, manual_mean_power_w: 600, manual_min_power_w: 400 }, FIXED_CONTEXT);
  assert.equal(manual.result_value, 800);
  assert.equal('interval_powers' in manual.additional_data, false);
  assert.throws(() => scoreWingate({ ...buildFixture('wingate'), interval_revolutions: [12, 11, '', '', '', ''] }, FIXED_CONTEXT), /Interval 3 revolutions is required/);
  const zeroFatigue = scoreWingate({ body_mass_kg: 75, resistance_kp: 5, sport: 'General Population', gender: 'male', interval_revolutions: [10, 10, 10, 10, 10, 10] }, FIXED_CONTEXT);
  assert.equal(zeroFatigue.additional_data.fatigue_index_pct, 0);
  assert.equal(zeroFatigue.additional_data.validity_score, 80);
  assert.throws(() => scoreWingate({ body_mass_kg: 75, resistance_kp: 5, sport: 'General Population', gender: 'male', manual_peak_power_w: 500, manual_mean_power_w: 600, manual_min_power_w: 400 }, FIXED_CONTEXT), /peak ≥ mean ≥ minimum/);
  assert.throws(() => scoreWingate({ ...buildFixture('wingate'), body_mass_kg: Infinity }, FIXED_CONTEXT), /finite number/);
});

test('all RSA routes require the exact protocol sprint count and preserve zero-decrement results', () => {
  const equal = scoreRsa({ protocol_key: 'rsa_6x30', sprint_times: [4.5, 4.5, 4.5, 4.5, 4.5, 4.5] }, { ...FIXED_CONTEXT, runnerKey: 'rsa_6x30' });
  assert.equal(equal.additional_data.percentage_decrement, 0);
  assert.equal(equal.result_value, 4.5);
  assert.throws(() => scoreRsa({ protocol_key: 'rsa_6x30', sprint_times: [4.5] }, { ...FIXED_CONTEXT, runnerKey: 'rsa_6x30' }), /6 entries/);
  assert.throws(() => scoreRsa({ protocol_key: 'rsa_7x35', sprint_times: Array(7).fill(5) }, { ...FIXED_CONTEXT, runnerKey: 'rsa_6x30' }), /does not match/);
  assert.throws(() => scoreRsa({ protocol_key: 'rsa_6x30', sprint_times: [4.5, 4.5, 0, 4.5, 4.5, 4.5] }, { ...FIXED_CONTEXT, runnerKey: 'rsa_6x30' }), /0\.1 to 300/);
});

test('VO2 and MET modality routes retain their current formulas and reject ambiguous/malformed paths', () => {
  const treadmill = scoreVo2Gxt(buildFixture('vo2max_gxt_full'), FIXED_CONTEXT);
  assert.equal(treadmill.result_value, 35.2);
  assert.equal(treadmill.additional_data.vo2_formula_used, 'ACSM Treadmill');
  assert.equal(treadmill.additional_data.is_maximal, true);

  const cycle = scoreVo2Gxt({ modality: 'cycle', body_mass_kg: 75, client_age: 35, client_sex: 'female', peak_watts: 200 }, FIXED_CONTEXT);
  assert.equal(cycle.result_value, 35.8);
  assert.equal(cycle.additional_data.vo2_formula_used, 'ACSM Cycle');

  const manual = scoreVo2Gxt({ modality: 'treadmill', body_mass_kg: 75, client_age: 35, client_sex: 'male', manual_vo2_override: 42.5 }, FIXED_CONTEXT);
  assert.equal(manual.result_value, 42.5);
  assert.equal(manual.additional_data.vo2_formula_used, 'Manual');

  assert.throws(() => scoreVo2Gxt({ modality: 'cycle', body_mass_kg: 75, client_age: 35, client_sex: 'male' }, FIXED_CONTEXT), /Peak workload is required/);
  assert.throws(() => scoreVo2Gxt({ modality: 'treadmill', body_mass_kg: 75, client_age: 35, client_sex: 'male', peak_speed_kmh: 10, peak_grade_pct: Number.NaN }, FIXED_CONTEXT), /finite number/);
  assert.throws(() => scoreMet({ speed_mph: 4, grade_pct: 5, workload_watts: 100 }, FIXED_CONTEXT), /exactly one complete modality/);
  assert.throws(() => scoreMet({ speed_mph: 4 }, FIXED_CONTEXT), /requires both speed and grade/);
  assert.throws(() => scoreMet({}, FIXED_CONTEXT), /exactly one complete modality/);
});

test('router refuses unknown keys and every owned React runner calls the same pure production scorer', () => {
  assert.throws(() => buildFixture('not-a-runner'), /Unsupported/);
  assert.throws(() => validateAndScore({}, FIXED_CONTEXT), /requires one of/);

  const componentContracts = [
    ['BodyMassIndexBMIRunner.jsx', 'scoreBmi'],
    ['WaisttoHipRatioWHRRunner.jsx', 'scoreWhr'],
    ['GirthMeasurementsRunner.jsx', 'scoreGirth'],
    ['BodyFatPercentageSkinfoldsRunner.jsx', 'scoreSkinfold'],
    ['HomeStepTestRunner.jsx', 'scoreHomeStep'],
    ['12MinuteWalkRunTestCooperRunner.jsx', 'scoreCooper12Minute'],
    ['MaximalPushUpTestRunner.jsx', 'scoreMaxPush'],
    ['ForcedVitalCapacityFVCSpirometryRunner.jsx', 'scoreFvc'],
    ['PeakExpiratoryFlowRatePEFRRunner.jsx', 'scorePefr'],
    ['YMCACycleErgometerProtocolRunner.jsx', 'scoreYmcaCycle'],
    ['WingateAnaerobicTestRunner.jsx', 'scoreWingate'],
    ['RSARunner.jsx', 'scoreRsa'],
    ['HydrostaticWeighingRunner.jsx', 'scoreHydrostatic'],
    ['RestingMetabolicRateRMRTestingRunner.jsx', 'scoreRmr'],
    ['VO2maxGXTRunner.jsx', 'scoreVo2Gxt'],
    ['MetabolicEquivalentMETCalculationRunner.jsx', 'scoreMet'],
  ];
  for (const [filename, scorer] of componentContracts) {
    const source = fs.readFileSync(new URL(`../../src/components/assessments/${filename}`, import.meta.url), 'utf8');
    assert.match(source, /@\/lib\/clinical\/scorers\/extrasBodyFitness/);
    assert.match(source, new RegExp(`onSave\\(${scorer}\\(`));
  }

  const fvcSource = fs.readFileSync(new URL('../../src/components/assessments/ForcedVitalCapacityFVCSpirometryRunner.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(fvcSource, /scoreFvc\(\{ trials: trials\.filter/);
  const rsaSource = fs.readFileSync(new URL('../../src/components/assessments/RSARunner.jsx', import.meta.url), 'utf8');
  assert.match(rsaSource, /fixedProtocolName \? Array\(RSA_PROTOCOLS\[fixedProtocolName\]\.sprints\)\.fill\(''\) : null/);
  const ymcaSource = fs.readFileSync(new URL('../../src/components/assessments/YMCACycleErgometerProtocolRunner.jsx', import.meta.url), 'utf8');
  assert.match(ymcaSource, /age: vo2maxResult\.age, weight_kg: vo2maxResult\.weight, gender: vo2maxResult\.gender/);

  const extrasSource = fs.readFileSync(new URL('../../src/components/assessments/TestRunnerExtras.jsx', import.meta.url), 'utf8');
  for (const runnerKey of EXPECTED_KEYS) assert.match(extrasSource, new RegExp(`case '${runnerKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
});
