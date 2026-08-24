import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  PROM_NEURO_RUNNER_KEYS,
  PROM_NEURO_SCORERS,
  RUNNER_SPECS,
  buildFixture,
  scoreDsq2,
  scoreHoos,
  scoreOdi,
  scorePromisFatigue,
  scoreStroop,
  scoreTardieu,
  validateAndScore,
} from '../../src/lib/clinical/scorers/extrasPromNeuro.js';
import { projectAssessmentResult } from '../../src/components/reports/assessmentResultProjection.js';

const FIXED_CONTEXT = Object.freeze({ assessmentDate: '2026-08-22' });
const EXPECTED_KEYS = Object.freeze([
  'odi', 'fma', 'sarc_f', 'ndi', 'k10_full', 'hoos_full', 'koos_full', 'fiqr', 'wpi', 'pcs',
  'dsq2', 'chalder_fatigue', 'sf36', 'fss', 'promis_fatigue', 'psqi', 'dgi_full', 'fga', 'parq', 'gas',
  'psfs', 'lefs', 'himat_full', 'aqol', 'spadi', 'breq', 'pase', 'qbpds', 'womac', 'stroop',
  'digit_span', 'mas', 'tardieu', 'barthel', 'abc_scale', 'mas_stroke', 'rivermead_mobility', 'roland', 'dash', 'faam',
  'ikdc', 'cat', 'ccq', 'lcq', 'cbm_full', 'bestest_full', 'fesi', 'ems_full', 'pcl5', 'isi',
  'pediatric_balance', 'ppt_full', 'phq9_full', 'gad7_full',
]);

const EXPECTED_ITEM_COUNTS = Object.freeze({
  odi: 10,
  sarc_f: 5,
  ndi: 10,
  k10_full: 10,
  hoos_full: 40,
  koos_full: 42,
  fiqr: 21,
  wpi: 24,
  pcs: 13,
  dsq2: 115,
  chalder_fatigue: 11,
  sf36: 36,
  fss: 9,
  psqi: 19,
  parq: 7,
  lefs: 20,
  aqol: 12,
  spadi: 13,
  breq: 19,
  pase: 14,
  womac: 24,
  barthel: 10,
  abc_scale: 16,
  roland: 24,
  dash: 30,
  faam: 29,
  ikdc: 14,
  cat: 8,
  ccq: 10,
  lcq: 19,
  fesi: 16,
  pcl5: 20,
  isi: 7,
  phq9_full: 9,
  gad7_full: 7,
});

const FIXTURE_CONTEXT_KEYS = new Set([
  'assessmentDate', 'assessment_date', 'clinicalNotes', 'globalNotes', 'notes', 'runnerKey', 'runner_key',
]);
const REQUIRED_SCHEMA_V6_FIELDS = Object.freeze({
  wpi: Object.freeze(['pain_regions']),
  parq: Object.freeze(['other_reasons']),
  womac: Object.freeze(['joint', 'side']),
  phq9_full: Object.freeze(['functional_impairment']),
  gad7_full: Object.freeze(['functional_impairment']),
});

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
const CHOICE_ITEM_TYPES = new Set(['choice', 'radio', 'select', 'single_choice', 'yes_no', 'multi-select']);
const OPEN_ITEM_TYPES = new Set(['date', 'duration', 'number', 'numeric', 'text', 'textarea', 'time']);

const CONTENT_COMPONENTS = Object.freeze([
  'AQoLRunner',
  'ActivitiesspecificBalanceConfidenceABCScaleRunner',
  'BarthelIndexRunner',
  'BESTestRunner',
  'BREQRunner',
  'ChalderFatigueScaleRunner',
  'ClinicalCOPDQuestionnaireCCQRunner',
  'CommunityBalanceMobilityScaleCBMRunner',
  'COPDAssessmentTestCATRunner',
  'DASHRunner',
  'DePaulSymptomQuestionnaireDSQ2Runner',
  'DynamicGaitIndexDGIRunner',
  'ElderlyMobilityScaleEMSRunner',
  'FallsEfficacyScaleInternationalFESIRunner',
  'FatigueSeverityScaleFSSRunner',
  'FibromyalgiaImpactQuestionnaireRevisedFIQRRunner',
  'FootandAnkleAbilityMeasureFAAMRunner',
  'FuglMeyerAssessmentFMARunner',
  'FunctionalGaitAssessmentFGARunner',
  'GAD7GeneralizedAnxietyDisorder7Runner',
  'GoalAttainmentScalingGASRunner',
  'HighLevelMobilityAssessmentToolHiMATRunner',
  'HipOutcomeScoreHOOSRunner',
  'InsomniaSeverityIndexISIRunner',
  'InternationalKneeDocumentationCommitteeIKDCRunner',
  'KesslerPsychologicalDistressScaleK10Runner',
  'KneeInjuryandOsteoarthritisOutcomeScoreKOOSRunner',
  'LEFSRunner',
  'LeicesterCoughQuestionnaireLCQRunner',
  'ModifiedAshworthScaleMASRunner',
  'MotorAssessmentScaleMASStrokeRunner',
  'NeckDisabilityIndexNDIRunner',
  'ODIRunner',
  'PainCatastrophizingScalePCSRunner',
  'PARQRunner',
  'PCL5Runner',
  'PediatricBalanceScaleRunner',
  'PHQ9PatientHealthQuestionnaire9Runner',
  'PhysicalActivityScalefortheElderlyPASERunner',
  'PhysicalPerformanceTestPPTRunner',
  'PittsburghSleepQualityIndexPSQIRunner',
  'PROMISFatigueScaleShortForm8aRunner',
  'PSFSRunner',
  'RivermadMobilityIndexRunner',
  'RolandMorrisDisabilityQuestionnaireRunner',
  'SARCFQuestionnaireRunner',
  'SF36HealthSurveyRunner',
  'SPADIRunner',
  'StroopTestRunner',
  'TardieuScaleRunner',
  'WidespreadPainIndexWPIandSymptomSeverityScaleSSSRunner',
  'WOMACRunner',
]);

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

function fieldKeysAreUnique(fields) {
  return Array.isArray(fields)
    && new Set(fields.map(({ key }) => String(key))).size === fields.length;
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
  const nestedCollections = [field.fields, field.entries, field.items]
    .filter((collection) => Array.isArray(collection) && collection.length > 0);
  if (nestedCollections.some((collection) => !fieldKeysAreUnique(collection))) return false;
  const nested = nestedCollections[0];
  if (nested?.every(fieldIsRecursivelyComplete)) {
    return !REPEATED_FIELD_TYPES.has(type) || repeatedCardinalityIsComplete(field);
  }
  return Boolean(
    field.itemSchema
    && fieldIsRecursivelyComplete(field.itemSchema)
    && repeatedCardinalityIsComplete(field),
  );
}

function itemIsComplete(item) {
  if (!item || typeof item !== 'object') return false;
  const key = String(item.key ?? '').trim();
  const prompt = String(item.prompt ?? '').trim();
  const type = String(item.type ?? '').trim().toLowerCase();
  if (!key || /[.\[\]]/.test(key) || !prompt || !type) return false;
  if (item.responseBinding !== undefined) {
    const binding = item.responseBinding;
    if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return false;
    if (!String(binding.field ?? '').trim() || /[.\[\]]/.test(String(binding.field))) return false;
    const hasIndex = Number.isInteger(binding.index) && binding.index >= 0;
    const hasKey = String(binding.key ?? '').trim().length > 0 && !/[.\[\]]/.test(String(binding.key));
    if (hasIndex === hasKey) return false;
  }
  if (OPEN_ITEM_TYPES.has(type)) return true;
  if (CHOICE_ITEM_TYPES.has(type) || Array.isArray(item.options)) {
    if (!optionsAreComplete(item.options)) return false;
    if (type === 'multi-select' && !repeatedCardinalityIsComplete(item)) return false;
    return true;
  }
  return false;
}

function fixtureHasItemPath(fixture, item) {
  const binding = item.responseBinding;
  if (binding) {
    if (!Object.hasOwn(fixture, binding.field)) return false;
    const responses = fixture[binding.field];
    const responseKey = binding.index ?? binding.key;
    return responses != null && Object.hasOwn(responses, responseKey);
  }
  return Object.hasOwn(fixture, item.key);
}

function representedFixtureKeys(spec) {
  const keys = new Set(spec.fields.map(({ key }) => String(key)));
  for (const item of spec.items || []) keys.add(String(item.responseBinding?.field || item.key));
  return keys;
}

function assertPersistenceInvariant(payload, runnerKey) {
  assert.equal(payload.status, 'completed');
  assert.ok(Number.isFinite(payload.result_value), `${runnerKey} must produce a finite result`);
  assert.equal(payload.assessment_date, FIXED_CONTEXT.assessmentDate);
  assert.equal(payload.additional_data.scoring_key, runnerKey);
  assert.equal(payload.additional_data.scoring_version, `${runnerKey}.v1`);
  assert.ok(payload.additional_data.measurement_type);
  assert.ok(payload.additional_data.raw_input);
  assert.ok(payload.additional_data.soap_text.length > 30);
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

function replaceFirstNumber(value, replacement) {
  if (!value || typeof value !== 'object') return false;
  for (const key of Object.keys(value)) {
    if (typeof value[key] === 'number') {
      value[key] = replacement;
      return true;
    }
    if (replaceFirstNumber(value[key], replacement)) return true;
  }
  return false;
}

test('PROM/neuro partition exposes exactly 54 frozen serializable RunnerSpecs and explicit scorers', () => {
  assert.deepEqual(PROM_NEURO_RUNNER_KEYS, EXPECTED_KEYS);
  assert.deepEqual(RUNNER_SPECS.map(({ runnerKey }) => runnerKey), EXPECTED_KEYS);
  assert.deepEqual(Object.keys(PROM_NEURO_SCORERS), EXPECTED_KEYS);
  assert.equal(new Set(EXPECTED_KEYS).size, 54);
  for (const spec of RUNNER_SPECS) {
    assertDeepFrozen(spec, spec.runnerKey);
    assert.equal(spec.schemaVersion, 1);
    assert.ok(['questionnaire', 'measurement'].includes(spec.kind));
    assert.equal(spec.scoringKey, spec.runnerKey);
    assert.ok(spec.fields.length > 0);
    assert.ok(fieldKeysAreUnique(spec.fields), `${spec.runnerKey} top-level field keys must be unique`);
    assert.ok(spec.fields.every(fieldIsRecursivelyComplete), `${spec.runnerKey} fields must be recursively complete`);
    assert.ok(spec.scoring.method);
    assert.equal(spec.scoring.version, `${spec.runnerKey}.v1`);
    assert.ok(spec.result.primaryField);
    assert.ok(spec.result.unit);
    assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec);
    const fixture = buildFixture(spec.runnerKey);
    const represented = representedFixtureKeys(spec);
    const unrepresented = Object.keys(fixture)
      .filter((key) => !FIXTURE_CONTEXT_KEYS.has(key))
      .filter((key) => !represented.has(key));
    assert.deepEqual(unrepresented, [], `${spec.runnerKey} fixture inputs must all be represented by its frozen spec`);
    if (spec.kind === 'questionnaire') {
      assert.equal(spec.items.length, EXPECTED_ITEM_COUNTS[spec.runnerKey], `${spec.runnerKey} ordered item count drifted`);
      assert.ok(spec.items.every(itemIsComplete), `${spec.runnerKey} has an incomplete ordered item`);
      assert.equal(new Set(spec.items.map(({ key }) => key)).size, spec.items.length, `${spec.runnerKey} item keys must be unique`);
      for (const item of spec.items.filter(({ required }) => required)) {
        assert.ok(fixtureHasItemPath(fixture, item), `${spec.runnerKey} fixture does not populate ${item.key}`);
      }
    } else {
      assert.equal(spec.items, undefined, `${spec.runnerKey} measurement must use recursive fields, not ordered items`);
    }
  }
  assert.deepEqual(
    Object.fromEntries(RUNNER_SPECS.filter(({ kind }) => kind === 'questionnaire').map(({ runnerKey, items }) => [runnerKey, items.length])),
    EXPECTED_ITEM_COUNTS,
  );
});

test('schema-v6 retains the five questionnaire companion inputs rejected by central preflight', () => {
  for (const [runnerKey, expectedFields] of Object.entries(REQUIRED_SCHEMA_V6_FIELDS)) {
    const spec = RUNNER_SPECS.find((candidate) => candidate.runnerKey === runnerKey);
    assert.ok(spec, runnerKey);
    const fieldKeys = new Set(spec.fields.map(({ key }) => key));
    for (const key of expectedFields) assert.ok(fieldKeys.has(key), `${runnerKey} must expose ${key}`);
  }

  const wpi = RUNNER_SPECS.find(({ runnerKey }) => runnerKey === 'wpi');
  const painRegions = wpi.fields.find(({ key }) => key === 'pain_regions');
  assert.equal(painRegions.type, 'choice[]');
  assert.equal(painRegions.minItems, 0);
  assert.equal(painRegions.maxItems, painRegions.options.length);
  assert.ok(optionsAreComplete(painRegions.options));

  const womac = RUNNER_SPECS.find(({ runnerKey }) => runnerKey === 'womac');
  assert.deepEqual(womac.fields.find(({ key }) => key === 'joint').options, [
    { label: 'Knee', value: 'knee' },
    { label: 'Hip', value: 'hip' },
  ]);
  assert.deepEqual(womac.fields.find(({ key }) => key === 'side').options, [
    { label: 'Right', value: 'right' },
    { label: 'Left', value: 'left' },
    { label: 'Bilateral', value: 'bilateral' },
  ]);
});

test('all 54 deterministic fixtures invoke their real scorer and round-trip through persistence, SOAP and report projection', () => {
  for (const runnerKey of EXPECTED_KEYS) {
    const fixture = buildFixture(runnerKey);
    const payload = validateAndScore(fixture, { ...FIXED_CONTEXT, runnerKey, assessmentName: `Fixture ${runnerKey}` });
    assertPersistenceInvariant(payload, runnerKey);
  }
});

test('every scorer fails closed when its primary required raw input is missing', () => {
  for (const spec of RUNNER_SPECS) {
    const fixture = buildFixture(spec.runnerKey);
    const firstRequiredItem = spec.items?.find(({ required }) => required);
    if (firstRequiredItem?.responseBinding) delete fixture[firstRequiredItem.responseBinding.field];
    else if (firstRequiredItem) delete fixture[firstRequiredItem.key];
    else {
      const firstRawKey = Object.keys(fixture).find((key) => !['runnerKey', 'notes'].includes(key));
      assert.ok(firstRawKey, `${spec.runnerKey} fixture must expose a primary raw input`);
      delete fixture[firstRawKey];
    }
    assert.throws(
      () => validateAndScore(fixture, { ...FIXED_CONTEXT, runnerKey: spec.runnerKey }),
      /required|must be|must contain|must include|raw score or explicit|cannot be completed|unsupported/i,
      `${spec.runnerKey} accepted a missing required raw input`,
    );
  }
});

test('all fixtures containing numbers reject NaN before scoring and non-numeric instruments reject malformed states', () => {
  let numericFixtures = 0;
  for (const runnerKey of EXPECTED_KEYS) {
    const fixture = buildFixture(runnerKey);
    if (!replaceFirstNumber(fixture, Number.NaN)) continue;
    numericFixtures += 1;
    assert.throws(() => validateAndScore(fixture, { ...FIXED_CONTEXT, runnerKey }), /non-finite|finite number/i, `${runnerKey} accepted NaN`);
  }
  assert.ok(numericFixtures >= 50);
  const parq = buildFixture('parq');
  parq.answers['0'] = 'maybe';
  assert.throws(() => validateAndScore(parq, { ...FIXED_CONTEXT, runnerKey: 'parq' }), /yes or no/);
  const roland = buildFixture('roland');
  roland.items_checked[0] = 'true';
  assert.throws(() => validateAndScore(roland, { ...FIXED_CONTEXT, runnerKey: 'roland' }), /true or false/);
});

test('valid zero and boundary results persist rather than becoming missing or fallback values', () => {
  assert.equal(scoreOdi({ section_scores: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [String(index), 0])) }, FIXED_CONTEXT).result_value, 0);
  assert.equal(scoreHoos({ responses: Object.fromEntries(Object.keys(buildFixture('hoos_full').responses).map((key) => [key, 4])) }, FIXED_CONTEXT).result_value, 0);
  assert.equal(scoreDsq2({ frequency_ratings: Array(56).fill(0), severity_ratings: Array(56).fill(null) }, FIXED_CONTEXT).result_value, 0);
  assert.equal(scoreTardieu({
    header: { side_tested: 'Right' },
    entries: [{
      muscle_group: 'Hamstrings',
      side: 'Right',
      position: 'Supine',
      v1: { tardieu_score: '0', r2_angle: 90, clonus_present: false },
      v2: { tardieu_score: '0', clonus_present: false },
      v3: { tardieu_score: '0', r1_angle: 90, clonus_present: false },
    }],
  }, FIXED_CONTEXT).result_value, 0);
  assert.equal(validateAndScore({ runnerKey: 'rivermead_mobility', individual_tasks: Object.fromEntries(Array.from({ length: 15 }, (_, index) => [String(index + 1), 0])) }, FIXED_CONTEXT).result_value, 0);
  assert.equal(validateAndScore({ runnerKey: 'roland', items_checked: Array(24).fill(false) }, FIXED_CONTEXT).result_value, 0);
  assert.equal(validateAndScore({
    runnerKey: 'ppt_full',
    version: '7-item',
    taskScores: Object.fromEntries(Object.keys(buildFixture('ppt_full').taskScores).map((key) => [key, 0])),
    taskTimes: {},
    taskNotes: {},
    gait_aid_used: false,
    safe_to_proceed: true,
    safety_concerns: [],
  }, FIXED_CONTEXT).result_value, 0);
  assert.equal(validateAndScore({ runnerKey: 'phq9_full', responses: Array(9).fill(0) }, FIXED_CONTEXT).result_value, 0);

  const wpi = buildFixture('wpi');
  wpi.pain_region_responses = Object.fromEntries(Object.keys(wpi.pain_region_responses).map((key) => [key, false]));
  wpi.pain_regions = [];
  wpi.sss_fatigue = 0;
  wpi.sss_waking = 0;
  wpi.sss_cognitive = 0;
  wpi.sss_somatic = 0;
  assert.equal(validateAndScore(wpi, { ...FIXED_CONTEXT, runnerKey: 'wpi' }).result_value, 0);

  const pase = buildFixture('pase');
  pase.leisure_responses = Object.fromEntries(Object.keys(pase.leisure_responses).map((key) => [key, 0]));
  pase.household_responses = Object.fromEntries(Object.keys(pase.household_responses).map((key) => [key, false]));
  pase.work_done = false;
  delete pase.work_hours;
  delete pase.work_type;
  assert.equal(validateAndScore(pase, { ...FIXED_CONTEXT, runnerKey: 'pase' }).result_value, 0);

  const psqi = validateAndScore(buildFixture('psqi'), { ...FIXED_CONTEXT, runnerKey: 'psqi' });
  assert.equal(psqi.result_value, 6);
  assert.deepEqual(psqi.additional_data.components, { c1: 1, c2: 1, c3: 1, c4: 1, c5: 1, c6: 0, c7: 1 });
  assert.equal(psqi.additional_data.sleep_efficiency_percent, 81.3);
});

test('representative questionnaire, subscale, timed and versioned paths reject out-of-range or inconsistent values', () => {
  const odi = buildFixture('odi');
  odi.section_scores['0'] = 6;
  assert.throws(() => validateAndScore(odi, { ...FIXED_CONTEXT, runnerKey: 'odi' }), /0 to 5/);

  const spadi = buildFixture('spadi');
  spadi.pain_scores['0'] = 11;
  assert.throws(() => validateAndScore(spadi, { ...FIXED_CONTEXT, runnerKey: 'spadi' }), /0 to 10/);

  const stroke = buildFixture('stroop');
  stroke.trial3.errors = stroke.trial3.completed + 1;
  assert.throws(() => scoreStroop(stroke, FIXED_CONTEXT), /0 to 20/);

  const ppt = buildFixture('ppt_full');
  ppt.taskScores.task_1_sentence = 5;
  assert.throws(() => validateAndScore(ppt, { ...FIXED_CONTEXT, runnerKey: 'ppt_full' }), /0 to 4/);

  const promis = buildFixture('promis_fatigue');
  promis.t_score = 70;
  assert.throws(() => scorePromisFatigue(promis, FIXED_CONTEXT), /must match raw-score lookup/);

  const faam = buildFixture('faam');
  faam.adl_responses[0] = 5;
  assert.throws(() => validateAndScore(faam, { ...FIXED_CONTEXT, runnerKey: 'faam' }), /0 to 4/);
});

test('legacy displayed results are ignored and recomputed from raw inputs by the same scorer used for persistence', () => {
  for (const runnerKey of EXPECTED_KEYS) {
    const fixture = buildFixture(runnerKey);
    const direct = validateAndScore(fixture, { ...FIXED_CONTEXT, runnerKey });
    const legacySubmission = {
      result_value: 999999,
      notes: 'fixture note',
      assessment_date: FIXED_CONTEXT.assessmentDate,
      additional_data: { ...fixture, ...(runnerKey === 'qbpds' ? {} : { total_score: 999999 }), soap_text: 'tampered legacy display' },
    };
    const normalized = validateAndScore(legacySubmission, { ...FIXED_CONTEXT, runnerKey });
    assert.equal(normalized.result_value, direct.result_value, `${runnerKey} trusted legacy result_value`);
    assert.notEqual(normalized.additional_data.soap_text, 'tampered legacy display');
    assert.equal(normalized.additional_data.scoring_key, runnerKey);
  }
});

test('selected complex formulas preserve the production implementations', () => {
  assert.equal(validateAndScore(buildFixture('sf36'), { ...FIXED_CONTEXT, runnerKey: 'sf36' }).result_value, 33);
  assert.equal(validateAndScore(buildFixture('fiqr'), { ...FIXED_CONTEXT, runnerKey: 'fiqr' }).result_value, 51);
  assert.equal(validateAndScore(buildFixture('breq'), { ...FIXED_CONTEXT, runnerKey: 'breq' }).result_value, -2);
  assert.equal(validateAndScore(buildFixture('pase'), { ...FIXED_CONTEXT, runnerKey: 'pase' }).result_value, 460);
  assert.equal(validateAndScore(buildFixture('ikdc'), { ...FIXED_CONTEXT, runnerKey: 'ikdc' }).result_value, 50);
  const ikdcMaximum = Object.fromEntries(Object.entries(buildFixture('ikdc').ikdc_responses).map(([key]) => [key, ({ q1_pain: 10, q2_stiffness: 4, q3_swelling: 10, q4_lock_catch: 2, q5_giving_way: 10 }[key] ?? 4)]));
  assert.equal(validateAndScore({ ikdc_responses: ikdcMaximum }, { ...FIXED_CONTEXT, runnerKey: 'ikdc' }).result_value, 100);
  assert.equal(validateAndScore(buildFixture('promis_fatigue'), { ...FIXED_CONTEXT, runnerKey: 'promis_fatigue' }).result_value, 57.5);
  assert.equal(validateAndScore(buildFixture('dash'), { ...FIXED_CONTEXT, runnerKey: 'dash' }).result_value, 50);
});

test('TestRunnerExtras binds every B1 route through the pure scorer and raw-retention repairs are present', () => {
  const extrasSource = fs.readFileSync(new URL('../../src/components/assessments/TestRunnerExtras.jsx', import.meta.url), 'utf8');
  assert.match(extrasSource, /validateAndScore as validateAndScorePromNeuro/);
  assert.match(extrasSource, /if \(hasPromNeuroScorer\(runnerKey\)\)/);
  assert.match(extrasSource, /data = validateAndScorePromNeuro\(submittedData/);
  for (const runnerKey of EXPECTED_KEYS) assert.match(extrasSource, new RegExp(`case '${runnerKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));

  const fma = fs.readFileSync(new URL('../../src/components/assessments/FuglMeyerAssessmentFMARunner.jsx', import.meta.url), 'utf8');
  const sf36 = fs.readFileSync(new URL('../../src/components/assessments/SF36HealthSurveyRunner.jsx', import.meta.url), 'utf8');
  const spadi = fs.readFileSync(new URL('../../src/components/assessments/SPADIRunner.jsx', import.meta.url), 'utf8');
  const faam = fs.readFileSync(new URL('../../src/components/assessments/FootandAnkleAbilityMeasureFAAMRunner.jsx', import.meta.url), 'utf8');
  const ppt = fs.readFileSync(new URL('../../src/components/assessments/PhysicalPerformanceTestPPTRunner.jsx', import.meta.url), 'utf8');
  const psfs = fs.readFileSync(new URL('../../src/components/assessments/PSFSRunner.jsx', import.meta.url), 'utf8');
  const psqi = fs.readFileSync(new URL('../../src/components/assessments/PittsburghSleepQualityIndexPSQIRunner.jsx', import.meta.url), 'utf8');
  const pediatric = fs.readFileSync(new URL('../../src/components/assessments/PediatricBalanceScaleRunner.jsx', import.meta.url), 'utf8');
  const wpi = fs.readFileSync(new URL('../../src/components/assessments/WidespreadPainIndexWPIandSymptomSeverityScaleSSSRunner.jsx', import.meta.url), 'utf8');
  const digitSpan = fs.readFileSync(new URL('../../src/components/assessments/DigitSpanTestRunner.jsx', import.meta.url), 'utf8');
  assert.match(fma, /item_scores: scores/);
  assert.match(sf36, /measurement_type: "sf36_survey",\s+responses,/);
  assert.match(spadi, /pain_scores: painScores,\s+disability_scores: disabilityScores/);
  assert.match(faam, /adl_responses: adls,\s+sports_responses: sports/);
  assert.match(ppt, /onCheckedChange=\{\(checked\) => setUsedGaitAid\(checked === true\)\}/);
  assert.match(ppt, /onCheckedChange=\{\(checked\) => setSafeToProc\(checked === true\)\}/);
  assert.match(ppt, /safe_to_proceed: safeToProc/);
  assert.match(psfs, /a\.name\.trim\(\) && a\.score !== ""/);
  assert.match(psqi, /bedtime,\s+wake_time: wakeTime,\s+bed_hours: Number\(bedHours\)/);
  assert.match(pediatric, /useState\(Array\(PEDIATRIC_BALANCE_ITEMS\.length\)\.fill\(null\)\)/);
  assert.doesNotMatch(pediatric, /PEDIATRIC_BALANCE_ITEMS\s*\|\|\s*\[/);
  assert.match(wpi, /pain_region_responses:/);
  assert.match(digitSpan, /forwardTrials\.length === 0 \|\| backwardTrials\.length === 0/);
});

test('production runner content is imported from the same scorer module used to build B1 specs', () => {
  for (const component of CONTENT_COMPONENTS) {
    const source = fs.readFileSync(new URL(`../../src/components/assessments/${component}.jsx`, import.meta.url), 'utf8');
    assert.match(source, /@\/lib\/clinical\/scorers\/extrasPromNeuro/, `${component} duplicates scorer/spec content`);
  }
});

test('unknown runner keys are rejected loudly', () => {
  assert.throws(() => buildFixture('not-a-runner'), /Unsupported/);
  assert.throws(() => validateAndScore({}, FIXED_CONTEXT), /requires one of/);
});
