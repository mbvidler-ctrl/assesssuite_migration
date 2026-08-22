import { todayLocal } from '../../localDate.js';

const NOTES_MAX = 4000;
const SEX_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Male', value: 'male' }),
  Object.freeze({ label: 'Female', value: 'female' }),
]);
const YMCA_SEX_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Male', value: 'M' }),
  Object.freeze({ label: 'Female', value: 'F' }),
]);

export const GIRTH_SITES = Object.freeze([
  Object.freeze({ id: 'chest', name: 'Chest', bilateral: false }), Object.freeze({ id: 'waist', name: 'Waist', bilateral: false }), Object.freeze({ id: 'abdomen', name: 'Abdomen', bilateral: false }), Object.freeze({ id: 'hips', name: 'Hips', bilateral: false }),
  Object.freeze({ id: 'thigh_proximal', name: 'Proximal Thigh', bilateral: true }), Object.freeze({ id: 'thigh_mid', name: 'Mid-Thigh', bilateral: true }), Object.freeze({ id: 'thigh_distal', name: 'Distal Thigh', bilateral: true }), Object.freeze({ id: 'knee', name: 'Knee', bilateral: true }), Object.freeze({ id: 'calf', name: 'Calf', bilateral: true }), Object.freeze({ id: 'ankle', name: 'Ankle', bilateral: true }), Object.freeze({ id: 'arm_relaxed', name: 'Upper Arm (Relaxed)', bilateral: true }), Object.freeze({ id: 'arm_flexed', name: 'Upper Arm (Flexed)', bilateral: true }), Object.freeze({ id: 'forearm', name: 'Forearm', bilateral: true }), Object.freeze({ id: 'wrist', name: 'Wrist', bilateral: true }),
]);

const SKINFOLD_SITES = Object.freeze(['biceps', 'triceps', 'subscapular', 'suprailiac', 'chest', 'midaxillary', 'abdominal', 'thigh']);
const SKINFOLD_SITE_LABELS = Object.freeze({
  biceps: 'Biceps',
  triceps: 'Triceps',
  subscapular: 'Subscapular',
  suprailiac: 'Suprailiac',
  chest: 'Chest',
  midaxillary: 'Midaxillary',
  abdominal: 'Abdominal',
  thigh: 'Thigh',
});

/**
 * Deep-freeze the serializable runner contract so nested production fields,
 * collection item schemas and options cannot drift after registration.
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function createSpec({ runnerKey, scoringKey = runnerKey, fields, primaryField, unit, method, additionalDataFields }) {
  return deepFreeze({
    schemaVersion: 1,
    kind: 'measurement',
    runnerKey,
    scoringKey,
    fields,
    scoring: { method, version: `${scoringKey}.v1` },
    result: {
      primaryField,
      unit,
      additionalDataFields: [
        ...additionalDataFields,
        'raw_input',
        'soap_text',
        'report_text',
      ],
    },
  });
}

const notesField = () => ({ key: 'notes', label: 'Clinical notes', type: 'textarea', required: false, maxLength: NOTES_MAX });
const numberField = (key, label, min, max, unit, required = true, step = 0.1) => ({ key, label, type: 'number', required, min, max, step, ...(unit ? { unit } : {}) });
const integerField = (key, label, min, max, unit, required = true) => ({ key, label, type: 'integer', required, min, max, step: 1, ...(unit ? { unit } : {}) });
/**
 * @param {string} key
 * @param {string} label
 * @param {Array<Record<string, unknown>>} fields
 * @param {boolean | string} [required]
 * @param {Record<string, unknown>} [extra]
 */
const objectField = (key, label, fields, required = true, extra = {}) => ({ key, label, type: 'object', required, fields, ...extra });
const numberListField = (key, label, itemLabel, { required = true, minItems, maxItems, min, max, unit, integer = false, ...extra }) => ({
  key,
  label,
  type: 'number[]',
  required,
  minItems,
  maxItems,
  itemSchema: integer
    ? integerField('value', itemLabel, min, max, unit)
    : numberField('value', itemLabel, min, max, unit),
  ...extra,
});
const objectListField = (key, label, itemLabel, fields, { required = true, minItems, maxItems, ...extra }) => ({
  key,
  label,
  type: 'object[]',
  required,
  minItems,
  maxItems,
  itemSchema: objectField('item', itemLabel, fields),
  ...extra,
});
const vitalsField = (key, label, fields) => objectField(key, label, fields, false);

const PEFR_VITAL_FIELDS = [
  numberField('systolic', 'Systolic blood pressure', 40, 300, 'mmHg', false, 1),
  numberField('diastolic', 'Diastolic blood pressure', 20, 200, 'mmHg', false, 1),
  integerField('heartRate', 'Heart rate', 1, 300, 'bpm', false),
];
const MET_VITAL_FIELDS = [
  integerField('heartRate', 'Heart rate', 1, 300, 'bpm', false),
  { key: 'bloodPressure', label: 'Blood pressure', type: 'text', required: false, maxLength: 50, pattern: '^\\d{2,3}\\s*/\\s*\\d{2,3}$' },
];
const GIRTH_MEASUREMENT_FIELDS = GIRTH_SITES.map((site) => objectField(
  site.id,
  site.name,
  site.bilateral
    ? [
        numberField('left', `${site.name} left`, 0.1, 500, 'cm', false),
        numberField('right', `${site.name} right`, 0.1, 500, 'cm', false),
      ]
    : [numberField('center', site.name, 0.1, 500, 'cm')],
  'when-selected',
  site.bilateral ? { atLeastOneOf: ['left', 'right'] } : {},
));
const SKINFOLD_MEASUREMENT_FIELDS = SKINFOLD_SITES.map((site) => numberField(
  site,
  SKINFOLD_SITE_LABELS[site],
  0.1,
  100,
  'mm',
  false,
));

export const BMI_FULL_RUNNER_SPEC = createSpec({
  runnerKey: 'bmi_full',
  fields: [numberField('height_cm', 'Height', 30, 300, 'cm'), numberField('weight_kg', 'Weight', 1, 1000, 'kg'), notesField()],
  primaryField: 'bmi', unit: 'kg/m²', method: 'weight-divided-by-height-squared',
  additionalDataFields: ['height_cm', 'height_m', 'weight_kg', 'bmi', 'bmi_category', 'health_risk'],
});

export const WHR_FULL_RUNNER_SPEC = createSpec({
  runnerKey: 'whr_full',
  fields: [numberField('waist_cm', 'Waist circumference', 1, 500, 'cm'), numberField('hip_cm', 'Hip circumference', 1, 500, 'cm'), { key: 'gender', label: 'Sex', type: 'select', required: true, options: SEX_OPTIONS }, notesField()],
  primaryField: 'whr', unit: 'ratio', method: 'waist-divided-by-hip',
  additionalDataFields: ['waist_cm', 'hip_cm', 'gender', 'whr', 'risk'],
});

export const GIRTH_RUNNER_SPEC = createSpec({
  runnerKey: 'girth',
  fields: [
    {
      key: 'selected_sites',
      label: 'Selected measurement sites',
      type: 'choice[]',
      required: true,
      minItems: 1,
      maxItems: GIRTH_SITES.length,
      uniqueItems: true,
      options: GIRTH_SITES.map(({ id, name }) => ({ label: name, value: id })),
    },
    objectField('measurements', 'Site measurements', GIRTH_MEASUREMENT_FIELDS, true, { keyedBy: 'selected_sites' }),
    { key: 'observations', label: 'Observations', type: 'textarea', required: false, maxLength: NOTES_MAX },
  ],
  primaryField: 'selected_site_count', unit: 'sites', method: 'validated-site-measurement-count',
  additionalDataFields: ['sites', 'measurements', 'selected_site_count', 'observations'],
});

export const BODY_FAT_SKINFOLD_RUNNER_SPEC = createSpec({
  runnerKey: 'body_fat_skinfold',
  fields: [
    objectField('measurements', 'Skinfold measurements by site', SKINFOLD_MEASUREMENT_FIELDS, true, { requiredCounts: [4, 7] }),
    numberField('age', 'Age', 13, 130, 'years', true, 1),
    { key: 'sex', label: 'Sex', type: 'select', required: true, options: SEX_OPTIONS },
    notesField(),
  ],
  primaryField: 'body_fat_percentage', unit: '%', method: 'jackson-pollock-density-then-siri',
  additionalDataFields: ['measurements', 'measurement_map', 'measurement_records', 'measurement_sites', 'sum_of_skinfolds', 'body_density', 'body_fat_percentage', 'equation'],
});

export const HOME_STEP_RUNNER_SPEC = createSpec({
  runnerKey: 'home_step',
  fields: [numberField('age', 'Age', 1, 130, 'years', true, 1), numberField('pre_hr', 'Pre-test heart rate', 1, 300, 'bpm', true, 1), numberField('pre_rpe', 'Pre-test RPE', 0, 10, '/10', true, 1), numberField('post_hr', 'Post-test heart rate', 1, 300, 'bpm', true, 1), numberField('post_rpe', 'Post-test RPE', 0, 10, '/10', true, 1), notesField()],
  primaryField: 'result_percentage', unit: '%', method: 'heart-rate-recovery-divided-by-age-predicted-max',
  additionalDataFields: ['pre_test', 'post_test', 'age_predicted_max_hr', 'recovery_rate', 'result_percentage'],
});

export const TWELVE_MIN_WALK_RUNNER_SPEC = createSpec({
  runnerKey: '12min_walk',
  fields: [numberField('distance_m', 'Distance covered', 505, 20000, 'm'), numberField('age', 'Age', 13, 130, 'years', true, 1), { key: 'gender', label: 'Sex', type: 'select', required: true, options: SEX_OPTIONS }, notesField()],
  primaryField: 'vo2_max', unit: 'ml/kg/min', method: 'cooper-distance-estimate',
  additionalDataFields: ['distance_covered_m', 'vo2_max', 'fitness_category', 'client_age_at_test', 'client_gender'],
});

export const MAX_PUSH_RUNNER_SPEC = createSpec({
  runnerKey: 'max_push',
  fields: [
    objectListField('trials', 'Push-up trials', 'Push-up trial', [integerField('reps', 'Completed repetitions', 1, 1000, 'repetitions')], { minItems: 1, maxItems: 20 }),
    notesField(),
  ],
  primaryField: 'best_result', unit: 'repetitions', method: 'maximum-valid-trial',
  additionalDataFields: ['trials', 'best_result', 'trial_count'],
});

export const FVC_RUNNER_SPEC = createSpec({
  runnerKey: 'fvc',
  fields: [
    objectListField('trials', 'Spirometry trials', 'Spirometry trial', [
      numberField('fvc', 'Forced vital capacity', 0.01, 20, 'L'),
      numberField('fev1', 'Forced expiratory volume in one second', 0.01, 20, 'L', false),
      numberField('pef', 'Peak expiratory flow', 0.01, 2000, 'L/min', false),
    ], { minItems: 1, maxItems: 5 }),
    numberField('height_cm', 'Height', 30, 300, 'cm', false),
    numberField('predicted_fvc', 'Predicted FVC', 0.1, 20, 'L', false),
    numberField('predicted_fev1', 'Predicted FEV1', 0.1, 20, 'L', false),
    notesField(),
  ],
  primaryField: 'best_fvc_L', unit: 'L', method: 'best-valid-spirometry-trial',
  additionalDataFields: ['trials', 'height_cm', 'best_fvc_L', 'best_fev1_L', 'best_pef_L_per_min', 'fev1_fvc_ratio', 'fev1_pct_predicted', 'fvc_pct_predicted', 'gold_stage'],
});

export const PEFR_RUNNER_SPEC = createSpec({
  runnerKey: 'pefr',
  fields: [
    numberListField('trials', 'Peak flow trials', 'Peak flow result', { minItems: 1, maxItems: 10, min: 1, max: 2000, unit: 'L/min' }),
    vitalsField('pre_test_vitals', 'Pre-test vitals', PEFR_VITAL_FIELDS),
    vitalsField('post_test_vitals', 'Post-test vitals', PEFR_VITAL_FIELDS),
    notesField(),
  ],
  primaryField: 'best_result', unit: 'L/min', method: 'maximum-valid-trial',
  additionalDataFields: ['pre_test_vitals', 'post_test_vitals', 'trial_results', 'best_result'],
});

export const YMCA_CYCLE_RUNNER_SPEC = createSpec({
  runnerKey: 'ymca_cycle',
  fields: [
    numberField('age', 'Age', 13, 130, 'years', true, 1),
    numberField('weight_kg', 'Body mass', 1, 1000, 'kg'),
    { key: 'gender', label: 'Sex', type: 'select', required: true, options: YMCA_SEX_OPTIONS },
    numberListField('heart_rates', 'Stage heart rates', 'Stage heart rate', { minItems: 1, maxItems: 20, min: 1, max: 300, unit: 'bpm', integer: true, equalLengthWith: 'workloads' }),
    numberListField('workloads', 'Stage workloads', 'Stage workload', { minItems: 1, maxItems: 20, min: 0.1, max: 5000, unit: 'W', equalLengthWith: 'heart_rates' }),
    numberField('rpe', 'RPE', 0, 10, '/10', false, 1),
    { key: 'symptoms', label: 'Symptoms', type: 'textarea', required: false, maxLength: NOTES_MAX },
    notesField(),
  ],
  primaryField: 'vo2max', unit: 'ml/kg/min', method: 'last-workload-relative-vo2-estimate',
  additionalDataFields: ['vo2max', 'classification', 'heartRates', 'workloads', 'maxHeartRate', 'lastWorkload', 'rpe', 'symptoms'],
});

export const WINGATE_RUNNER_SPEC = createSpec({
  runnerKey: 'wingate',
  fields: [numberField('body_mass_kg', 'Body mass', 1, 1000, 'kg'), numberField('resistance_kp', 'Resistance', 0.01, 100, 'kp'), { key: 'sport', label: 'Sport profile', type: 'text', required: true }, { key: 'gender', label: 'Sex', type: 'select', required: true, options: SEX_OPTIONS }, numberListField('interval_revolutions', 'Six five-second revolution counts', 'Five-second revolution count', { required: false, minItems: 6, maxItems: 6, min: 0.01, max: 500, unit: 'revolutions' }), numberField('manual_peak_power_w', 'Manual peak power', 0.1, 10000, 'W', false), numberField('manual_mean_power_w', 'Manual mean power', 0.1, 10000, 'W', false), numberField('manual_min_power_w', 'Manual minimum power', 0.1, 10000, 'W', false), numberField('recovery_hr_1min', 'Recovery HR at 1 minute', 1, 300, 'bpm', false, 1), numberField('recovery_hr_2min', 'Recovery HR at 2 minutes', 1, 300, 'bpm', false, 1), numberField('recovery_hr_3min', 'Recovery HR at 3 minutes', 1, 300, 'bpm', false, 1), numberField('rpe', 'RPE', 6, 20, '/20', false, 1), notesField()],
  primaryField: 'peak_power_w', unit: 'W', method: 'monark-five-second-interval-power',
  additionalDataFields: ['peak_power_w', 'peak_power_w_per_kg', 'mean_power_w', 'mean_power_w_per_kg', 'min_power_w', 'total_work_j', 'fatigue_index_pct', 'interval_powers', 'classification_peak', 'classification_mean', 'fatigue_classification', 'validity_score'],
});

const RSA_PROTOCOL_SPECS = Object.freeze({
  rsa_6x30: Object.freeze({ name: '6 × 30 m (straight)', sprints: 6, distance: 30, recovery: '20-30', isShuttle: false }),
  rsa_7x35: Object.freeze({ name: '7 × 35 m (straight)', sprints: 7, distance: 35, recovery: '25-30', isShuttle: false }),
  rsa_10x20: Object.freeze({ name: '10 × 20 m (straight)', sprints: 10, distance: 20, recovery: '20-30', isShuttle: false }),
  rsa_shuttle: Object.freeze({ name: 'Shuttle 6 × (15 + 15 m)', sprints: 6, distance: 30, shuttleDistance: 15, recovery: '20-30', isShuttle: true }),
  rsa_generic: Object.freeze({ name: 'Protocol-selected RSA', sprints: null, distance: null, recovery: null, isShuttle: null }),
});

function rsaSpec(runnerKey) {
  const fixedSprintCount = RSA_PROTOCOL_SPECS[runnerKey].sprints;
  return createSpec({
    runnerKey,
    fields: [
      { key: 'protocol_key', label: 'RSA protocol', type: 'select', required: true, options: Object.keys(RSA_PROTOCOL_SPECS).filter((key) => key !== 'rsa_generic').map((value) => ({ label: RSA_PROTOCOL_SPECS[value].name, value })) },
      numberListField('sprint_times', 'Sprint times', 'Sprint time', {
        minItems: fixedSprintCount ?? 6,
        maxItems: fixedSprintCount ?? 10,
        min: 0.1,
        max: 300,
        unit: 's',
        ...(fixedSprintCount === null ? { cardinalityByProtocol: { rsa_6x30: 6, rsa_7x35: 7, rsa_10x20: 10, rsa_shuttle: 6 } } : {}),
      }),
      { key: 'surface_type', label: 'Surface', type: 'text', required: false },
      notesField(),
    ],
    primaryField: 'best_time', unit: 's', method: 'repeated-sprint-percentage-decrement',
    additionalDataFields: ['sprint_times', 'best_time', 'mean_time', 'total_time', 'percentage_decrement', 'number_of_sprints', 'distance', 'is_shuttle', 'surface_type', 'protocol'],
  });
}

export const RSA_GENERIC_RUNNER_SPEC = rsaSpec('rsa_generic');
export const RSA_6X30_RUNNER_SPEC = rsaSpec('rsa_6x30');
export const RSA_10X20_RUNNER_SPEC = rsaSpec('rsa_10x20');
export const RSA_7X35_RUNNER_SPEC = rsaSpec('rsa_7x35');
export const RSA_SHUTTLE_RUNNER_SPEC = rsaSpec('rsa_shuttle');

export const HYDROSTATIC_RUNNER_SPEC = createSpec({
  runnerKey: 'hydrostatic',
  fields: [numberField('land_weight_kg', 'Land weight', 1, 1000, 'kg'), numberListField('underwater_weights_kg', 'Underwater weight trials', 'Underwater weight', { minItems: 3, maxItems: 5, min: 0.01, max: 999, unit: 'kg' }), notesField()],
  primaryField: 'body_fat_percentage', unit: '%', method: 'hydrostatic-density-then-siri',
  additionalDataFields: ['landWeight', 'underwaterWeights', 'average_underwater_weight', 'bodyDensity', 'bodyFatPercentage'],
});

export const RMR_RUNNER_SPEC = createSpec({
  runnerKey: 'rmr',
  fields: [numberField('weight_kg', 'Weight', 1, 1000, 'kg'), numberField('height_cm', 'Height', 30, 300, 'cm'), numberField('age', 'Age', 1, 130, 'years', true, 1), { key: 'sex', label: 'Sex', type: 'select', required: true, options: SEX_OPTIONS }, notesField()],
  primaryField: 'estimated_bmr', unit: 'kcal/day', method: 'mifflin-st-jeor',
  additionalDataFields: ['weight', 'height', 'age', 'sex', 'estimated_bmr'],
});

export const VO2MAX_GXT_FULL_RUNNER_SPEC = createSpec({
  runnerKey: 'vo2max_gxt_full',
  fields: [{ key: 'modality', label: 'Modality', type: 'select', required: true, options: [{ label: 'Treadmill', value: 'treadmill' }, { label: 'Cycle ergometer', value: 'cycle' }] }, { key: 'protocol', label: 'Protocol', type: 'text', required: false }, { key: 'test_indication', label: 'Test indication', type: 'text', required: false }, numberField('test_duration_min', 'Test duration', 0.1, 180, 'min', false), numberField('body_mass_kg', 'Body mass', 1, 1000, 'kg'), numberField('client_age', 'Age', 20, 130, 'years', true, 1), { key: 'client_sex', label: 'Sex', type: 'select', required: true, options: SEX_OPTIONS }, numberField('peak_speed_kmh', 'Peak speed', 0.1, 50, 'km/h', false), numberField('peak_grade_pct', 'Peak grade', -40, 60, '%', false), numberField('peak_watts', 'Peak workload', 0.1, 5000, 'W', false), integerField('peak_hr', 'Peak heart rate', 1, 300, 'bpm', false), numberField('peak_rer', 'Peak respiratory exchange ratio', 0.5, 3, 'ratio', false), integerField('peak_rpe', 'Peak RPE', 6, 20, '/20', false), numberField('manual_vo2_override', 'Manual VO2 override', 0.1, 200, 'ml/kg/min', false), { key: 'vo2_plateau', label: 'VO2 plateau', type: 'select', required: false, options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] }, { key: 'ecg_findings', label: 'ECG findings', type: 'text', required: false, maxLength: 200 }, { key: 'adverse_events', label: 'Adverse events', type: 'textarea', required: false, maxLength: 500 }, notesField()],
  primaryField: 'peak_vo2_relative', unit: 'ml/kg/min', method: 'acsm-modality-equation-or-explicit-manual-value',
  additionalDataFields: ['is_maximal', 'modality', 'protocol', 'test_indication', 'test_duration_min', 'body_mass_kg', 'client_age', 'client_sex', 'vo2_formula_used', 'peak_vo2_relative', 'peak_vo2_absolute', 'peak_hr', 'peak_rer', 'peak_rpe', 'normative_category', 'maximal_criteria_met', 'risk_flags', 'ecg_findings', 'adverse_events', 'interpretation'],
});

export const MET_CALC_FULL_RUNNER_SPEC = createSpec({
  runnerKey: 'met_calc_full',
  fields: [numberField('speed_mph', 'Treadmill speed', 0.1, 30, 'mph', false), numberField('grade_pct', 'Treadmill grade', -40, 60, '%', false), numberField('workload_watts', 'Cycle workload', 0.1, 5000, 'W', false), vitalsField('pre_test_vitals', 'Pre-test vitals', MET_VITAL_FIELDS), vitalsField('post_test_vitals', 'Post-test vitals', MET_VITAL_FIELDS), notesField()],
  primaryField: 'mets', unit: 'METs', method: 'existing-treadmill-or-cycle-oxygen-cost-equation',
  additionalDataFields: ['modality', 'vo2', 'mets', 'capacity', 'pre_test_vitals', 'post_test_vitals'],
});

export const RUNNER_SPECS = Object.freeze([
  BMI_FULL_RUNNER_SPEC,
  WHR_FULL_RUNNER_SPEC,
  GIRTH_RUNNER_SPEC,
  BODY_FAT_SKINFOLD_RUNNER_SPEC,
  HOME_STEP_RUNNER_SPEC,
  TWELVE_MIN_WALK_RUNNER_SPEC,
  MAX_PUSH_RUNNER_SPEC,
  FVC_RUNNER_SPEC,
  PEFR_RUNNER_SPEC,
  YMCA_CYCLE_RUNNER_SPEC,
  WINGATE_RUNNER_SPEC,
  RSA_GENERIC_RUNNER_SPEC,
  HYDROSTATIC_RUNNER_SPEC,
  RMR_RUNNER_SPEC,
  RSA_6X30_RUNNER_SPEC,
  RSA_10X20_RUNNER_SPEC,
  RSA_7X35_RUNNER_SPEC,
  RSA_SHUTTLE_RUNNER_SPEC,
  VO2MAX_GXT_FULL_RUNNER_SPEC,
  MET_CALC_FULL_RUNNER_SPEC,
]);

const SPEC_BY_KEY = Object.freeze(Object.fromEntries(RUNNER_SPECS.map((spec) => [spec.runnerKey, spec])));

function requiredNumber(value, label, { min, max, integer = false }) {
  if (value === '' || value === null || value === undefined) throw new Error(`${label} is required`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${label} must be ${integer ? 'a whole ' : 'a finite '}number from ${min} to ${max}`);
  }
  return parsed;
}

function optionalNumber(value, label, bounds) {
  if (value === '' || value === null || value === undefined) return undefined;
  return requiredNumber(value, label, bounds);
}

function requiredEnum(value, label, allowed) {
  const normalized = String(value ?? '').trim();
  if (!allowed.includes(normalized)) throw new Error(`${label} is required and must be one of: ${allowed.join(', ')}`);
  return normalized;
}

function optionalText(value, label, maxLength = NOTES_MAX) {
  const normalized = String(value ?? '').trim();
  if (normalized.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer`);
  return normalized;
}

function requiredArray(value, label, { minLength = 1, maxLength = 100 } = {}) {
  if (!Array.isArray(value) || value.length < minLength || value.length > maxLength) {
    throw new Error(`${label} must contain ${minLength}${minLength === maxLength ? '' : ` to ${maxLength}`} entries`);
  }
  return value;
}

function round(value, digits) {
  const result = Number(Number(value).toFixed(digits));
  if (!Number.isFinite(result)) throw new Error('Calculated result must be finite');
  return result;
}

function compactObject(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function notesFrom(input, context) {
  return optionalText(input?.notes ?? context?.notes, 'Clinical notes');
}

/**
 * @returns {{status: string, result_value: number, assessment_date: string, notes: string, additional_data: Record<string, any>}}
 */
function finish({ spec, input, context, result, measurementType, additional, soapText, notes }) {
  if (!Number.isFinite(result)) throw new Error(`${spec.runnerKey} primary result must be finite`);
  const rawInput = typeof structuredClone === 'function' ? structuredClone(input) : JSON.parse(JSON.stringify(input));
  const reportText = `${context?.assessmentName || spec.runnerKey}\n${soapText}`;
  return {
    status: 'completed',
    result_value: result,
    assessment_date: String(context?.assessmentDate || '').trim() || todayLocal(),
    notes,
    additional_data: {
      measurement_type: measurementType,
      scoring_key: spec.scoringKey,
      scoring_version: spec.scoring.version,
      raw_input: rawInput,
      ...compactObject(additional),
      soap_text: soapText,
      report_text: reportText,
    },
  };
}

const BMI_CATEGORIES = Object.freeze([
  Object.freeze({ max: 18.5, label: 'Underweight', risk: 'Increased' }),
  Object.freeze({ max: 25, label: 'Healthy Weight', risk: 'Minimal' }),
  Object.freeze({ max: 30, label: 'Overweight', risk: 'Increased' }),
  Object.freeze({ max: 35, label: 'Obesity Class I', risk: 'Moderate' }),
  Object.freeze({ max: 40, label: 'Obesity Class II', risk: 'Severe' }),
  Object.freeze({ max: Number.MAX_VALUE, label: 'Obesity Class III', risk: 'Very Severe' }),
]);

export function scoreBmi(input, context = {}) {
  const heightCm = requiredNumber(input?.height_cm, 'Height', { min: 30, max: 300 });
  const weightKg = requiredNumber(input?.weight_kg, 'Weight', { min: 1, max: 1000 });
  const heightM = heightCm / 100;
  const bmi = round(weightKg / (heightM ** 2), 2);
  const category = BMI_CATEGORIES.find((entry) => bmi < entry.max) || BMI_CATEGORIES.at(-1);
  const notes = notesFrom(input, context);
  const soapText = `• Body Mass Index (BMI) Assessment\n  Height: ${heightCm} cm | Weight: ${weightKg} kg\n  BMI: ${bmi.toFixed(2)} kg/m²\n  Classification: ${category.label} (Health Risk: ${category.risk})${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({ spec: BMI_FULL_RUNNER_SPEC, input: { height_cm: heightCm, weight_kg: weightKg, notes }, context, result: bmi, measurementType: 'BMI', notes, soapText, additional: { height_cm: heightCm, height_m: heightM.toFixed(3), weight_kg: weightKg, bmi: bmi.toFixed(2), bmi_category: category.label, health_risk: category.risk, interpretation: `${category.label}; health risk ${category.risk}` } });
}

export function scoreWhr(input, context = {}) {
  const waist = requiredNumber(input?.waist_cm, 'Waist circumference', { min: 1, max: 500 });
  const hip = requiredNumber(input?.hip_cm, 'Hip circumference', { min: 1, max: 500 });
  const gender = requiredEnum(input?.gender, 'Sex', ['male', 'female']);
  const ratio = round(waist / hip, 3);
  const risk = gender === 'male'
    ? (ratio < 0.9 ? 'Low Risk' : ratio <= 0.99 ? 'Moderate Risk' : 'High Risk')
    : (ratio < 0.8 ? 'Low Risk' : ratio <= 0.84 ? 'Moderate Risk' : 'High Risk');
  const notes = notesFrom(input, context);
  const soapText = `• Waist-to-Hip Ratio (WHR)\n  WHR: ${ratio.toFixed(3)} — ${risk}\n  Waist: ${waist} cm | Hip: ${hip} cm\n  WHO Thresholds (Males): Low <0.90 | Moderate 0.90–0.99 | High ≥1.0\n  WHO Thresholds (Females): Low <0.80 | Moderate 0.80–0.84 | High ≥0.85${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({ spec: WHR_FULL_RUNNER_SPEC, input: { waist_cm: waist, hip_cm: hip, gender, notes }, context, result: ratio, measurementType: 'whr', notes, soapText, additional: { waist_cm: waist, hip_cm: hip, gender, whr: ratio.toFixed(3), risk, interpretation: risk } });
}

const GIRTH_SITE_BY_ID = Object.freeze(Object.fromEntries(GIRTH_SITES.map((site) => [site.id, site])));

export function scoreGirth(input, context = {}) {
  const selectedSites = requiredArray(input?.selected_sites, 'Selected sites', { minLength: 1, maxLength: GIRTH_SITES.length }).map(String);
  if (new Set(selectedSites).size !== selectedSites.length) throw new Error('Selected sites must not contain duplicates');
  const source = input?.measurements;
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Site measurements are required');
  const measurements = {};
  const lines = [];
  for (const siteId of selectedSites) {
    const site = GIRTH_SITE_BY_ID[siteId];
    if (!site) throw new Error(`Unsupported girth site: ${siteId}`);
    const values = source[siteId];
    if (!values || typeof values !== 'object') throw new Error(`${site.name} measurement is required`);
    if (site.bilateral) {
      const left = optionalNumber(values.left, `${site.name} left`, { min: 0.1, max: 500 });
      const right = optionalNumber(values.right, `${site.name} right`, { min: 0.1, max: 500 });
      if (left === undefined && right === undefined) throw new Error(`${site.name} requires at least one side`);
      measurements[siteId] = compactObject({ left, right });
      lines.push(`  ${site.name}: ${[left === undefined ? null : `L: ${left} cm`, right === undefined ? null : `R: ${right} cm`].filter(Boolean).join(', ')}`);
    } else {
      const center = requiredNumber(values.center, site.name, { min: 0.1, max: 500 });
      measurements[siteId] = { center };
      lines.push(`  ${site.name}: ${center} cm`);
    }
  }
  const observations = optionalText(input?.observations ?? context?.notes, 'Observations');
  const soapText = `• Girth Measurements:\n${lines.join('\n')}${observations ? `\n\n  Observations: ${observations}` : ''}`;
  return finish({ spec: GIRTH_RUNNER_SPEC, input: { selected_sites: selectedSites, measurements, observations }, context, result: selectedSites.length, measurementType: 'girth_measurements', notes: observations, soapText, additional: { sites: selectedSites, measurements, selected_site_count: selectedSites.length, observations } });
}

export function scoreSkinfold(input, context = {}) {
  const age = requiredNumber(input?.age, 'Age', { min: 13, max: 130, integer: true });
  const sex = requiredEnum(input?.sex, 'Sex', ['male', 'female']);
  if (!input?.measurements || typeof input.measurements !== 'object' || Array.isArray(input.measurements)) throw new Error('Skinfold measurements are required');
  const measurements = {};
  for (const site of SKINFOLD_SITES) {
    const value = optionalNumber(input.measurements[site], `${site} skinfold`, { min: 0.1, max: 100 });
    if (value !== undefined) measurements[site] = value;
  }
  const measurementSites = Object.keys(measurements);
  if (![4, 7].includes(measurementSites.length)) throw new Error('Exactly four or seven valid skinfold measurements are required');
  const values = Object.values(measurements);
  const sum = values.reduce((total, value) => total + value, 0);
  const seven = values.length === 7;
  let density;
  if (sex === 'male') density = seven ? 1.112 - (0.00043499 * sum) + (0.00000055 * (sum ** 2)) - (0.00028826 * age) : 1.10938 - (0.0008267 * sum) + (0.0000016 * (sum ** 2)) - (0.0002574 * age);
  else density = seven ? 1.097 - (0.00046971 * sum) + (0.00000056 * (sum ** 2)) - (0.00012828 * age) : 1.0994921 - (0.0009929 * sum) + (0.0000023 * (sum ** 2)) - (0.0001392 * age);
  if (!Number.isFinite(density) || density <= 0) throw new Error('Skinfold body density calculation was not finite');
  const bodyFat = round((495 / density) - 450, 2);
  if (bodyFat < 0 || bodyFat > 100) throw new Error('Calculated body-fat percentage is outside 0 to 100%');
  const notes = notesFrom(input, context);
  const equation = `${sex}-${seven ? '7-site' : '4-site'}`;
  const soapText = `• Body Fat Percentage (Skinfolds)\n  Result: ${bodyFat.toFixed(2)}%\n  Sum of Skinfolds: ${round(sum, 2)} mm\n  Body Density: ${density.toFixed(4)}\n  Sites: ${measurementSites.join(', ')}\n  Age: ${age} | Sex: ${sex}${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({ spec: BODY_FAT_SKINFOLD_RUNNER_SPEC, input: { measurements, age, sex, notes }, context, result: bodyFat, measurementType: 'skinfold', notes, soapText, additional: { measurements: values, measurement_map: measurements, measurement_records: measurementSites.map((site) => ({ site, value_mm: measurements[site] })), measurement_sites: measurementSites, sum_of_skinfolds: round(sum, 2), body_density: density.toFixed(4), body_fat_percentage: bodyFat.toFixed(2), equation } });
}

export function scoreHomeStep(input, context = {}) {
  const age = requiredNumber(input?.age, 'Age', { min: 1, max: 130, integer: true });
  const preHr = requiredNumber(input?.pre_hr, 'Pre-test heart rate', { min: 1, max: 300, integer: true });
  const preRpe = requiredNumber(input?.pre_rpe, 'Pre-test RPE', { min: 0, max: 10, integer: true });
  const postHr = requiredNumber(input?.post_hr, 'Post-test heart rate', { min: 1, max: 300, integer: true });
  const postRpe = requiredNumber(input?.post_rpe, 'Post-test RPE', { min: 0, max: 10, integer: true });
  const agePredictedMaxHr = 220 - age;
  if (agePredictedMaxHr <= 0) throw new Error('Age does not permit a finite age-predicted maximum heart rate');
  const recoveryRate = preHr - postHr;
  const resultPercentage = round((recoveryRate / agePredictedMaxHr) * 100, 2);
  const notes = notesFrom(input, context);
  const soapText = `• Home Step Test\n  Pre-test HR: ${preHr} bpm | RPE: ${preRpe}/10\n  Post-test HR: ${postHr} bpm | RPE: ${postRpe}/10\n  Recovery Rate: ${recoveryRate} bpm\n  Recovery Percentage: ${resultPercentage.toFixed(2)}%${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({ spec: HOME_STEP_RUNNER_SPEC, input: { age, pre_hr: preHr, pre_rpe: preRpe, post_hr: postHr, post_rpe: postRpe, notes }, context, result: resultPercentage, measurementType: 'HomeStepTest', notes, soapText, additional: { age, pre_test: { heart_rate: preHr, rpe: preRpe }, post_test: { heart_rate: postHr, rpe: postRpe }, age_predicted_max_hr: agePredictedMaxHr, recovery_rate: recoveryRate, result_percentage: resultPercentage.toFixed(2), interpretation: recoveryRate >= 0 ? 'Heart rate decreased from pre-test to post-test value' : 'Heart rate increased from pre-test to post-test value' } });
}

const COOPER_VO2_THRESHOLDS = Object.freeze({
  male: Object.freeze([
    Object.freeze({ maxAge: 19, fair: 35.5, good: 38.4, excellent: 45.2, superior: 51 }),
    Object.freeze({ maxAge: 29, fair: 33.1, good: 36.5, excellent: 42.5, superior: 46.5 }),
    Object.freeze({ maxAge: 39, fair: 31.6, good: 35.5, excellent: 41, superior: 45 }),
    Object.freeze({ maxAge: 49, fair: 30.3, good: 33.6, excellent: 39, superior: 43.8 }),
    Object.freeze({ maxAge: 59, fair: 26.2, good: 31, excellent: 35.8, superior: 41 }),
    Object.freeze({ maxAge: 130, fair: 20.6, good: 26.1, excellent: 32.3, superior: 36.5 }),
  ]),
  female: Object.freeze([
    Object.freeze({ maxAge: 19, fair: 25.1, good: 31, excellent: 35, superior: 39 }),
    Object.freeze({ maxAge: 29, fair: 23.7, good: 29, excellent: 33, superior: 37 }),
    Object.freeze({ maxAge: 39, fair: 22.9, good: 27, excellent: 31.5, superior: 35.7 }),
    Object.freeze({ maxAge: 49, fair: 21.1, good: 24.5, excellent: 29, superior: 32.9 }),
    Object.freeze({ maxAge: 59, fair: 20.3, good: 22.8, excellent: 27, superior: 31.5 }),
    Object.freeze({ maxAge: 130, fair: 17.6, good: 20.2, excellent: 24.5, superior: 30.3 }),
  ]),
});

function cooperCategory(vo2, gender, age) {
  const row = COOPER_VO2_THRESHOLDS[gender].find((entry) => age <= entry.maxAge);
  if (vo2 >= row.superior) return 'Superior';
  if (vo2 >= row.excellent) return 'Excellent';
  if (vo2 >= row.good) return 'Good';
  if (vo2 >= row.fair) return 'Fair';
  return 'Poor';
}

export function scoreCooper12Minute(input, context = {}) {
  const distance = requiredNumber(input?.distance_m, 'Distance covered', { min: 505, max: 20000 });
  const age = requiredNumber(input?.age, 'Age', { min: 13, max: 130, integer: true });
  const gender = requiredEnum(input?.gender, 'Sex', ['male', 'female']);
  const vo2 = round((distance - 504.9) / 44.73, 1);
  if (vo2 <= 0 || vo2 > 500) throw new Error('Calculated VO2 estimate must be positive and within the supported finite range');
  const category = cooperCategory(vo2, gender, age);
  const notes = notesFrom(input, context);
  const soapText = `• 12-Minute Walk/Run Test (Cooper)\n  Distance: ${distance} m\n  Estimated VO2max: ${vo2.toFixed(1)} ml/kg/min\n  Fitness Category: ${category} (${gender}, age ${age})${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({ spec: TWELVE_MIN_WALK_RUNNER_SPEC, input: { distance_m: distance, age, gender, notes }, context, result: vo2, measurementType: '12_minute_walk_run_test', notes, soapText, additional: { distance_covered_m: distance, vo2_max: vo2, fitness_category: category, client_age_at_test: age, client_gender: gender, interpretation: `${category} estimated aerobic fitness` } });
}

export function scoreMaxPush(input, context = {}) {
  const trials = requiredArray(input?.trials, 'Push-up trials', { minLength: 1, maxLength: 20 }).map((trial, index) => {
    const value = typeof trial === 'object' && trial !== null ? trial.reps : trial;
    return { reps: requiredNumber(value, `Trial ${index + 1} repetitions`, { min: 1, max: 1000, integer: true }) };
  });
  const best = Math.max(...trials.map(({ reps }) => reps));
  const notes = notesFrom(input, context);
  const soapText = `• Maximal Push-Up Test\n  Trials: ${trials.map(({ reps }, index) => `Trial ${index + 1}: ${reps}`).join(' | ')}\n  Best Result: ${best} repetitions${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({ spec: MAX_PUSH_RUNNER_SPEC, input: { trials, notes }, context, result: best, measurementType: 'maximal_push_up', notes, soapText, additional: { trials, best_result: best, trial_count: trials.length, interpretation: `Best of ${trials.length} valid trial${trials.length === 1 ? '' : 's'}` } });
}

function spirometryOptional(value, label, max) {
  return optionalNumber(value, label, { min: 0.01, max });
}

function goldStage(fev1Pct) {
  if (fev1Pct >= 80) return 'GOLD 1 — Mild';
  if (fev1Pct >= 50) return 'GOLD 2 — Moderate';
  if (fev1Pct >= 30) return 'GOLD 3 — Severe';
  return 'GOLD 4 — Very Severe';
}

export function scoreFvc(input, context = {}) {
  const sourceTrials = requiredArray(input?.trials, 'Spirometry trials', { minLength: 1, maxLength: 5 });
  const trials = sourceTrials.map((trial, index) => {
    if (!trial || typeof trial !== 'object') throw new Error(`Spirometry trial ${index + 1} must be an object`);
    const fvc = requiredNumber(trial.fvc, `Trial ${index + 1} FVC`, { min: 0.01, max: 20 });
    const fev1 = spirometryOptional(trial.fev1, `Trial ${index + 1} FEV1`, 20);
    const pef = spirometryOptional(trial.pef, `Trial ${index + 1} PEF`, 2000);
    return compactObject({ fvc, fev1, pef });
  });
  const height = optionalNumber(input?.height_cm, 'Height', { min: 30, max: 300 });
  const predictedFvc = optionalNumber(input?.predicted_fvc, 'Predicted FVC', { min: 0.1, max: 20 });
  const predictedFev1 = optionalNumber(input?.predicted_fev1, 'Predicted FEV1', { min: 0.1, max: 20 });
  const bestFvc = Math.max(...trials.map(({ fvc }) => fvc));
  const fev1Values = trials.map(({ fev1 }) => fev1).filter((value) => value !== undefined);
  const pefValues = trials.map(({ pef }) => pef).filter((value) => value !== undefined);
  const bestFev1 = fev1Values.length ? Math.max(...fev1Values) : undefined;
  const bestPef = pefValues.length ? Math.max(...pefValues) : undefined;
  const ratio = bestFev1 === undefined ? undefined : round(bestFev1 / bestFvc, 3);
  const fev1Pct = bestFev1 !== undefined && predictedFev1 !== undefined ? round((bestFev1 / predictedFev1) * 100, 1) : undefined;
  const fvcPct = predictedFvc !== undefined ? round((bestFvc / predictedFvc) * 100, 1) : undefined;
  const gold = ratio !== undefined && ratio < 0.7 && fev1Pct !== undefined ? goldStage(fev1Pct) : undefined;
  const notes = notesFrom(input, context);
  const trialLines = trials.map((trial, index) => `  Trial ${index + 1}: FVC ${trial.fvc}L${trial.fev1 === undefined ? '' : ` | FEV1 ${trial.fev1}L`}${trial.pef === undefined ? '' : ` | PEF ${trial.pef} L/min`}`).join('\n');
  const soapText = `• FVC Spirometry (ATS/ERS standards)\n  Best FVC: ${bestFvc}L${fvcPct === undefined ? '' : ` (${fvcPct}% predicted)`}\n  Best FEV1: ${bestFev1 ?? 'N/A'}L${fev1Pct === undefined ? '' : ` (${fev1Pct}% predicted)`}\n  FEV1/FVC Ratio: ${ratio ?? 'N/A'}\n  Best PEF: ${bestPef ?? 'N/A'} L/min${gold ? `\n  GOLD Classification: ${gold}` : ''}${ratio === undefined ? '' : `\n  ${ratio < 0.7 ? 'Obstructive pattern (FEV1/FVC <0.7)' : 'No obstruction detected (FEV1/FVC ≥0.7)'}`}\n  Trials:\n${trialLines}${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({ spec: FVC_RUNNER_SPEC, input: compactObject({ trials, height_cm: height, predicted_fvc: predictedFvc, predicted_fev1: predictedFev1, notes }), context, result: bestFvc, measurementType: 'spirometry', notes, soapText, additional: compactObject({ height_cm: height, best_fvc_L: bestFvc, best_fev1_L: bestFev1, best_pef_L_per_min: bestPef, fev1_fvc_ratio: ratio, fev1_pct_predicted: fev1Pct, fvc_pct_predicted: fvcPct, gold_stage: gold, trials, interpretation: ratio === undefined ? 'FVC result recorded' : ratio < 0.7 ? 'Obstructive pattern' : 'No obstruction detected' }) });
}

function normalizeVitals(input, label) {
  if (input === null || input === undefined || input === '') return undefined;
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error(`${label} must be an object`);
  const systolic = optionalNumber(input.systolic, `${label} systolic`, { min: 40, max: 300 });
  const diastolic = optionalNumber(input.diastolic, `${label} diastolic`, { min: 20, max: 200 });
  const heartRate = optionalNumber(input.heartRate ?? input.heart_rate, `${label} heart rate`, { min: 1, max: 300, integer: true });
  const bloodPressure = optionalText(input.bloodPressure ?? input.blood_pressure, `${label} blood pressure`, 50);
  return compactObject({ systolic, diastolic, heartRate, bloodPressure });
}

export function scorePefr(input, context = {}) {
  const sourceTrials = requiredArray(input?.trials, 'Peak flow trials', { minLength: 1, maxLength: 10 });
  const trials = sourceTrials.map((value, index) => requiredNumber(value, `Trial ${index + 1}`, { min: 1, max: 2000 }));
  const best = Math.max(...trials);
  const preVitals = normalizeVitals(input?.pre_test_vitals, 'Pre-test vitals');
  const postVitals = normalizeVitals(input?.post_test_vitals, 'Post-test vitals');
  const notes = notesFrom(input, context);
  const soapText = `• Peak Expiratory Flow Rate (PEFR)\n  Best Result: ${best} L/min\n  Trials: ${trials.join(', ')} L/min${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({ spec: PEFR_RUNNER_SPEC, input: compactObject({ trials, pre_test_vitals: preVitals, post_test_vitals: postVitals, notes }), context, result: best, measurementType: 'PEFR', notes, soapText, additional: compactObject({ pre_test_vitals: preVitals, post_test_vitals: postVitals, trial_results: trials, best_result: best, interpretation: `Best of ${trials.length} valid trial${trials.length === 1 ? '' : 's'}` }) });
}

function classifyYmca(vo2, age, gender) {
  if (age < 40) return gender === 'M'
    ? vo2 >= 52 ? 'Excellent' : vo2 >= 43 ? 'Good' : vo2 >= 34 ? 'Fair' : 'Poor'
    : vo2 >= 41 ? 'Excellent' : vo2 >= 35 ? 'Good' : vo2 >= 27 ? 'Fair' : 'Poor';
  return gender === 'M'
    ? vo2 >= 45 ? 'Excellent' : vo2 >= 38 ? 'Good' : vo2 >= 30 ? 'Fair' : 'Poor'
    : vo2 >= 35 ? 'Excellent' : vo2 >= 29 ? 'Good' : vo2 >= 23 ? 'Fair' : 'Poor';
}

export function scoreYmcaCycle(input, context = {}) {
  const age = requiredNumber(input?.age, 'Age', { min: 13, max: 130, integer: true });
  const weight = requiredNumber(input?.weight_kg, 'Body mass', { min: 1, max: 1000 });
  const gender = requiredEnum(input?.gender, 'Sex', ['M', 'F']);
  const heartRates = requiredArray(input?.heart_rates, 'Stage heart rates', { minLength: 1, maxLength: 20 }).map((value, index) => requiredNumber(value, `Stage ${index + 1} heart rate`, { min: 1, max: 300, integer: true }));
  const workloads = requiredArray(input?.workloads, 'Stage workloads', { minLength: 1, maxLength: 20 }).map((value, index) => requiredNumber(value, `Stage ${index + 1} workload`, { min: 0.1, max: 5000 }));
  if (heartRates.length !== workloads.length) throw new Error('Heart-rate and workload stage counts must match');
  const lastWorkload = workloads.at(-1);
  const vo2 = round(((lastWorkload * 10.8) / weight) + 7, 2);
  const classification = classifyYmca(vo2, age, gender);
  const maxHeartRate = 220 - age;
  const rpe = optionalNumber(input?.rpe, 'RPE', { min: 0, max: 10, integer: true });
  const symptoms = optionalText(input?.symptoms, 'Symptoms');
  const notes = notesFrom(input, context);
  const stageLines = workloads.map((workload, index) => `  Stage ${index + 1}: ${workload}W → ${heartRates[index]} bpm`).join('\n');
  const soapText = `• Allied Submaximal Cycle Ergometer VO2 Assessment\n  Age: ${age} years | Gender: ${gender === 'M' ? 'Male' : 'Female'} | Body Mass: ${weight} kg\n  Predicted Max HR: ${maxHeartRate} bpm | Final Workload: ${lastWorkload} W\n  HEART RATE RESPONSE BY STAGE:\n${stageLines}\n  Estimated VO2max: ${vo2.toFixed(2)} ml/kg/min\n  Classification: ${classification}${rpe === undefined ? '' : `\n  RPE: ${rpe}/10`}${symptoms ? `\n  Symptoms: ${symptoms}` : '\n  No adverse symptoms reported.'}${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({ spec: YMCA_CYCLE_RUNNER_SPEC, input: compactObject({ age, weight_kg: weight, gender, heart_rates: heartRates, workloads, rpe, symptoms, notes }), context, result: vo2, measurementType: 'allied_cycle_ergometer_vo2', notes, soapText, additional: compactObject({ vo2max: vo2.toFixed(2), classification, heartRates, workloads, maxHeartRate, lastWorkload, rpe, symptoms, interpretation: `${classification} cardiovascular fitness` }) });
}

const PEAK_POWER_NORMS = Object.freeze({
  male: Object.freeze([['Elite', 13], ['Excellent', 10], ['Good', 8.5], ['Average', 7], ['Below Average', 5.5], ['Poor', 0]]),
  female: Object.freeze([['Elite', 11], ['Excellent', 8.5], ['Good', 7], ['Average', 5.5], ['Below Average', 4], ['Poor', 0]]),
});
const MEAN_POWER_NORMS = Object.freeze({
  male: Object.freeze([['Elite', 9], ['Excellent', 7.5], ['Good', 6.5], ['Average', 5.5], ['Below Average', 4.5], ['Poor', 0]]),
  female: Object.freeze([['Elite', 7.5], ['Excellent', 6.5], ['Good', 5.5], ['Average', 4.5], ['Below Average', 3.5], ['Poor', 0]]),
});
const SPORT_PROFILES = Object.freeze(['General Population', 'Cyclist', 'Team Sport Athlete', 'Sprinter', 'Endurance Athlete', 'Recreational']);

function classifyPower(norms, value) {
  return norms.find(([, minimum]) => value >= minimum)?.[0] || 'Poor';
}

function classifyFatigue(value) {
  if (value <= 25) return 'Excellent anaerobic capacity maintenance';
  if (value <= 35) return 'Good anaerobic capacity';
  if (value <= 45) return 'Average fatigue resistance';
  if (value <= 60) return 'High fatigue — limited anaerobic endurance';
  return 'Very high fatigue — poor anaerobic capacity';
}

export function scoreWingate(input, context = {}) {
  const mass = requiredNumber(input?.body_mass_kg, 'Body mass', { min: 1, max: 1000 });
  const resistance = requiredNumber(input?.resistance_kp, 'Resistance', { min: 0.01, max: 100 });
  const gender = requiredEnum(input?.gender, 'Sex', ['male', 'female']);
  const sport = optionalText(input?.sport, 'Sport profile', 100) || 'General Population';
  if (!SPORT_PROFILES.includes(sport)) throw new Error(`Sport profile must be one of: ${SPORT_PROFILES.join(', ')}`);
  let intervalRevolutions;
  let intervalPowers;
  let peak;
  let mean;
  let minimum;
  const suppliedIntervals = Array.isArray(input?.interval_revolutions)
    ? input.interval_revolutions.filter((value) => value !== '' && value !== null && value !== undefined)
    : [];
  if (suppliedIntervals.length > 0) {
    if (!Array.isArray(input.interval_revolutions) || input.interval_revolutions.length !== 6) throw new Error('Wingate requires exactly six five-second interval revolution counts');
    intervalRevolutions = input.interval_revolutions.map((value, index) => requiredNumber(value, `Interval ${index + 1} revolutions`, { min: 0.01, max: 500 }));
    intervalPowers = intervalRevolutions.map((revolutions) => round(resistance * (revolutions * 12) * 0.98, 4));
    peak = Math.max(...intervalPowers);
    mean = intervalPowers.reduce((sum, value) => sum + value, 0) / intervalPowers.length;
    minimum = Math.min(...intervalPowers);
  } else {
    peak = requiredNumber(input?.manual_peak_power_w, 'Manual peak power', { min: 0.1, max: 10000 });
    mean = requiredNumber(input?.manual_mean_power_w, 'Manual mean power', { min: 0.1, max: 10000 });
    minimum = requiredNumber(input?.manual_min_power_w, 'Manual minimum power', { min: 0.1, max: 10000 });
  }
  if (!(peak >= mean && mean >= minimum)) throw new Error('Wingate power values must satisfy peak ≥ mean ≥ minimum');
  const peakW = round(peak, 1);
  const meanW = round(mean, 1);
  const minW = round(minimum, 1);
  const peakWkg = round(peak / mass, 3);
  const meanWkg = round(mean / mass, 3);
  const totalWork = round(mean * 30, 0);
  const fatigueIndex = round(((peak - minimum) / peak) * 100, 1);
  if (fatigueIndex < 0 || fatigueIndex > 100) throw new Error('Wingate fatigue index must be from 0 to 100%');
  const peakClassification = classifyPower(PEAK_POWER_NORMS[gender], peakWkg);
  const meanClassification = classifyPower(MEAN_POWER_NORMS[gender], meanWkg);
  const fatigueClassification = classifyFatigue(fatigueIndex);
  const optionalRecovery = {
    recovery_hr_1min: optionalNumber(input?.recovery_hr_1min, 'Recovery HR at 1 minute', { min: 1, max: 300, integer: true }),
    recovery_hr_2min: optionalNumber(input?.recovery_hr_2min, 'Recovery HR at 2 minutes', { min: 1, max: 300, integer: true }),
    recovery_hr_3min: optionalNumber(input?.recovery_hr_3min, 'Recovery HR at 3 minutes', { min: 1, max: 300, integer: true }),
    rpe: optionalNumber(input?.rpe, 'RPE', { min: 6, max: 20, integer: true }),
  };
  const validityScore = 80 + (peak > mean && mean > minimum ? 20 : 0);
  const notes = notesFrom(input, context);
  const soapText = [
    '• Wingate Anaerobic Test (WAnT) — 30-Second Maximal Cycle Sprint',
    `  Body Mass: ${mass} kg | Resistance: ${resistance} kp (${((resistance / mass) * 1000).toFixed(1)} g/kg)`,
    `  Sport Profile: ${sport}`,
    `  Peak Power: ${Math.round(peak)} W (${peakWkg.toFixed(2)} W/kg) — ${peakClassification}`,
    `  Mean Power: ${Math.round(mean)} W (${meanWkg.toFixed(2)} W/kg) — ${meanClassification}`,
    `  Minimum Power: ${Math.round(minimum)} W | Total Work: ${totalWork} J`,
    `  Fatigue Index: ${fatigueIndex.toFixed(1)}% — ${fatigueClassification}`,
    optionalRecovery.recovery_hr_1min || optionalRecovery.recovery_hr_2min || optionalRecovery.recovery_hr_3min ? `  Recovery HR: 1-min ${optionalRecovery.recovery_hr_1min ?? '—'} | 2-min ${optionalRecovery.recovery_hr_2min ?? '—'} | 3-min ${optionalRecovery.recovery_hr_3min ?? '—'} bpm` : null,
    optionalRecovery.rpe === undefined ? null : `  RPE: ${optionalRecovery.rpe}/20`,
    `  Test Validity Score: ${validityScore}/100`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  const normalizedInput = compactObject({ body_mass_kg: mass, resistance_kp: resistance, sport, gender, interval_revolutions: intervalRevolutions, manual_peak_power_w: intervalPowers ? undefined : peak, manual_mean_power_w: intervalPowers ? undefined : mean, manual_min_power_w: intervalPowers ? undefined : minimum, ...optionalRecovery, notes });
  return finish({ spec: WINGATE_RUNNER_SPEC, input: normalizedInput, context, result: peakW, measurementType: 'anaerobic_power', notes, soapText, additional: compactObject({ peak_power_w: Math.round(peak), peak_power_w_per_kg: peakWkg, mean_power_w: Math.round(mean), mean_power_w_per_kg: meanWkg, min_power_w: Math.round(minimum), total_work_j: totalWork, fatigue_index_pct: fatigueIndex, body_mass_kg: mass, resistance_kp: resistance, sport_profile: sport, gender, classification_peak: peakClassification, classification_mean: meanClassification, fatigue_classification: fatigueClassification, validity_score: validityScore, ...optionalRecovery, interval_revolutions: intervalRevolutions, interval_powers: intervalPowers, interpretation: `${peakClassification} peak power; ${fatigueClassification}` }) });
}

export function scoreRsa(input, context = {}) {
  const requestedKey = normalizeKey(context?.runnerKey || input?.runnerKey || input?.protocol_key || 'rsa_generic');
  const protocolKey = requestedKey === 'rsa_generic'
    ? requiredEnum(input?.protocol_key, 'RSA protocol', ['rsa_6x30', 'rsa_7x35', 'rsa_10x20', 'rsa_shuttle'])
    : requestedKey;
  const protocol = RSA_PROTOCOL_SPECS[protocolKey];
  if (!protocol || protocol.sprints === null) throw new Error(`Unsupported RSA protocol: ${protocolKey}`);
  if (input?.protocol_key && input.protocol_key !== protocolKey) throw new Error(`RSA protocol ${input.protocol_key} does not match runner ${requestedKey}`);
  const sprintTimes = requiredArray(input?.sprint_times, 'Sprint times', { minLength: protocol.sprints, maxLength: protocol.sprints }).map((value, index) => requiredNumber(value, `Sprint ${index + 1} time`, { min: 0.1, max: 300 }));
  const best = round(Math.min(...sprintTimes), 2);
  const total = round(sprintTimes.reduce((sum, value) => sum + value, 0), 2);
  const mean = round(total / sprintTimes.length, 2);
  const decrement = round((100 * (total / (best * sprintTimes.length))) - 100, 2);
  if (decrement < 0 || decrement > 1000) throw new Error('RSA percentage decrement is outside the supported finite range');
  const surface = optionalText(input?.surface_type, 'Surface type', 200);
  const notes = notesFrom(input, context);
  const soapText = [
    `• Repeated Sprint Ability Test (${protocol.name})`,
    `  Best Time: ${best.toFixed(2)}s | Mean Time: ${mean.toFixed(2)}s | Total Time: ${total.toFixed(2)}s`,
    `  Fatigue Index (%Decrement): ${decrement.toFixed(2)}% (lower = better sprint maintenance)`,
    `  Sprint Times: ${sprintTimes.map((time) => time.toFixed(2)).join(', ')}s`,
    surface ? `  Surface: ${surface}` : null,
    notes ? `  Clinical Notes: ${notes}` : null,
    '  Interpretation: FI <5% Excellent | 5-10% Good | >10% Significant fatigue',
  ].filter(Boolean).join('\n');
  const spec = SPEC_BY_KEY[requestedKey];
  return finish({ spec, input: { protocol_key: protocolKey, sprint_times: sprintTimes, surface_type: surface, notes }, context, result: best, measurementType: 'repeated_sprint_ability', notes, soapText, additional: { sprint_times: sprintTimes, best_time: best, mean_time: mean, total_time: total, percentage_decrement: decrement, number_of_sprints: sprintTimes.length, distance: protocol.distance, is_shuttle: protocol.isShuttle, surface_type: surface, protocol: protocol.name, protocol_key: protocolKey, interpretation: decrement < 5 ? 'Excellent sprint maintenance' : decrement <= 10 ? 'Good sprint maintenance' : 'Significant fatigue' } });
}

export function scoreHydrostatic(input, context = {}) {
  const landWeight = requiredNumber(input?.land_weight_kg, 'Land weight', { min: 1, max: 1000 });
  const underwaterWeights = requiredArray(input?.underwater_weights_kg, 'Underwater weight trials', { minLength: 3, maxLength: 5 }).map((value, index) => requiredNumber(value, `Underwater weight trial ${index + 1}`, { min: 0.01, max: 999 }));
  if (underwaterWeights.some((value) => value >= landWeight)) throw new Error('Every underwater weight must be less than land weight');
  const average = underwaterWeights.reduce((sum, value) => sum + value, 0) / underwaterWeights.length;
  const waterDensity = 0.9982;
  const residualVolume = 0.1;
  const bodyVolume = (landWeight - average) / waterDensity;
  const correctedVolume = bodyVolume - residualVolume;
  if (!Number.isFinite(correctedVolume) || correctedVolume <= 0) throw new Error('Hydrostatic body-volume calculation must be positive and finite');
  const density = landWeight / correctedVolume;
  const bodyFat = round((495 / density) - 450, 2);
  if (bodyFat < 0 || bodyFat > 100) throw new Error('Calculated body-fat percentage is outside 0 to 100%');
  const notes = notesFrom(input, context);
  const trialLines = underwaterWeights.map((weight, index) => `  • Trial ${index + 1}: ${weight.toFixed(2)} kg`).join('\n');
  const soapText = `Hydrostatic Weighing Assessment:\n\nMeasurements:\n  • Land Weight: ${landWeight.toFixed(2)} kg\n\nUnderwater Weights (${underwaterWeights.length} trials):\n${trialLines}\n  • Average Underwater Weight: ${average.toFixed(2)} kg\n\nCalculated Results:\n  • Body Density: ${density.toFixed(4)} g/cm³\n  • Body Fat Percentage: ${bodyFat.toFixed(2)}%${notes ? `\n\nClinical Notes: ${notes}` : ''}`;
  return finish({ spec: HYDROSTATIC_RUNNER_SPEC, input: { land_weight_kg: landWeight, underwater_weights_kg: underwaterWeights, notes }, context, result: bodyFat, measurementType: 'hydrostatic_weighing', notes, soapText, additional: { landWeight, underwaterWeights, average_underwater_weight: round(average, 4), bodyDensity: density, bodyFatPercentage: bodyFat, water_density: waterDensity, residual_volume: residualVolume, interpretation: `Calculated body-fat percentage ${bodyFat.toFixed(2)}%` } });
}

export function scoreRmr(input, context = {}) {
  const weight = requiredNumber(input?.weight_kg, 'Weight', { min: 1, max: 1000 });
  const height = requiredNumber(input?.height_cm, 'Height', { min: 30, max: 300 });
  const age = requiredNumber(input?.age, 'Age', { min: 1, max: 130, integer: true });
  const sex = requiredEnum(input?.sex, 'Sex', ['male', 'female']);
  const bmr = round((10 * weight) + (6.25 * height) - (5 * age) + (sex === 'male' ? 5 : -161), 2);
  if (bmr <= 0) throw new Error('Calculated resting metabolic rate must be positive');
  const notes = notesFrom(input, context);
  const soapText = `• Resting Metabolic Rate (RMR) Testing\n  Estimated BMR: ${bmr.toFixed(2)} kcal/day\n  Height: ${height}cm | Weight: ${weight}kg | Age: ${age}yrs | Sex: ${sex}${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({ spec: RMR_RUNNER_SPEC, input: { weight_kg: weight, height_cm: height, age, sex, notes }, context, result: bmr, measurementType: 'RMR', notes, soapText, additional: { weight, height, age, sex, estimated_bmr: bmr, equation: 'Mifflin-St Jeor', interpretation: `Estimated BMR ${bmr.toFixed(2)} kcal/day` } });
}

const VO2_GXT_NORMS = Object.freeze({
  male: Object.freeze({
    '20-29': Object.freeze([['Poor', 36], ['Fair', 43], ['Good', 51], ['Excellent', 55], ['Superior', Number.MAX_VALUE]]),
    '30-39': Object.freeze([['Poor', 34], ['Fair', 40], ['Good', 47], ['Excellent', 52], ['Superior', Number.MAX_VALUE]]),
    '40-49': Object.freeze([['Poor', 30], ['Fair', 36], ['Good', 44], ['Excellent', 48], ['Superior', Number.MAX_VALUE]]),
    '50-59': Object.freeze([['Poor', 26], ['Fair', 32], ['Good', 39], ['Excellent', 43], ['Superior', Number.MAX_VALUE]]),
    '60-69': Object.freeze([['Poor', 24], ['Fair', 30], ['Good', 37], ['Excellent', 41], ['Superior', Number.MAX_VALUE]]),
    '70+': Object.freeze([['Poor', 20], ['Fair', 26], ['Good', 32], ['Excellent', 36], ['Superior', Number.MAX_VALUE]]),
  }),
  female: Object.freeze({
    '20-29': Object.freeze([['Poor', 31], ['Fair', 37], ['Good', 44], ['Excellent', 49], ['Superior', Number.MAX_VALUE]]),
    '30-39': Object.freeze([['Poor', 28], ['Fair', 33], ['Good', 40], ['Excellent', 45], ['Superior', Number.MAX_VALUE]]),
    '40-49': Object.freeze([['Poor', 28], ['Fair', 34], ['Good', 40], ['Excellent', 45], ['Superior', Number.MAX_VALUE]]),
    '50-59': Object.freeze([['Poor', 24], ['Fair', 29], ['Good', 35], ['Excellent', 40], ['Superior', Number.MAX_VALUE]]),
    '60-69': Object.freeze([['Poor', 23], ['Fair', 28], ['Good', 32], ['Excellent', 37], ['Superior', Number.MAX_VALUE]]),
    '70+': Object.freeze([['Poor', 18], ['Fair', 23], ['Good', 28], ['Excellent', 32], ['Superior', Number.MAX_VALUE]]),
  }),
});

function vo2AgeBand(age) {
  if (age < 30) return '20-29';
  if (age < 40) return '30-39';
  if (age < 50) return '40-49';
  if (age < 60) return '50-59';
  if (age < 70) return '60-69';
  return '70+';
}

function classifyVo2Gxt(vo2, age, sex) {
  return VO2_GXT_NORMS[sex][vo2AgeBand(age)].find(([, max]) => vo2 < max)?.[0] || 'Superior';
}

function normalizeVo2Inputs(input) {
  const optional = (key, label, bounds) => optionalNumber(input?.[key], label, bounds);
  return compactObject({
    test_duration_min: optional('test_duration_min', 'Test duration', { min: 0.1, max: 180 }),
    baseline_hr: optional('baseline_hr', 'Baseline heart rate', { min: 1, max: 300, integer: true }),
    baseline_sbp: optional('baseline_sbp', 'Baseline systolic pressure', { min: 40, max: 300, integer: true }),
    baseline_dbp: optional('baseline_dbp', 'Baseline diastolic pressure', { min: 20, max: 200, integer: true }),
    peak_hr: optional('peak_hr', 'Peak heart rate', { min: 1, max: 300, integer: true }),
    peak_sbp: optional('peak_sbp', 'Peak systolic pressure', { min: 40, max: 350, integer: true }),
    peak_dbp: optional('peak_dbp', 'Peak diastolic pressure', { min: 20, max: 250, integer: true }),
    peak_rer: optional('peak_rer', 'Peak RER', { min: 0.5, max: 3 }),
    peak_rpe: optional('peak_rpe', 'Peak RPE', { min: 6, max: 20, integer: true }),
    peak_ve: optional('peak_ve', 'Peak ventilation', { min: 0.1, max: 1000 }),
    peak_ve_vco2: optional('peak_ve_vco2', 'VE/VCO2 slope', { min: 0.1, max: 200 }),
    ventilatory_threshold: optional('ventilatory_threshold', 'Ventilatory threshold', { min: 0.1, max: 200 }),
    rer_at_vt: optional('rer_at_vt', 'RER at ventilatory threshold', { min: 0.5, max: 3 }),
    recovery_hr_1min: optional('recovery_hr_1min', 'Recovery HR at 1 minute', { min: 1, max: 300, integer: true }),
    recovery_hr_2min: optional('recovery_hr_2min', 'Recovery HR at 2 minutes', { min: 1, max: 300, integer: true }),
    recovery_sbp: optional('recovery_sbp', 'Recovery systolic pressure', { min: 40, max: 350, integer: true }),
  });
}

export function scoreVo2Gxt(input, context = {}) {
  const modality = requiredEnum(input?.modality, 'Modality', ['treadmill', 'cycle']);
  const bodyMass = requiredNumber(input?.body_mass_kg, 'Body mass', { min: 1, max: 1000 });
  const age = requiredNumber(input?.client_age, 'Age', { min: 20, max: 130, integer: true });
  const sex = requiredEnum(input?.client_sex, 'Sex', ['male', 'female']);
  const manualVo2 = optionalNumber(input?.manual_vo2_override, 'Manual VO2 override', { min: 0.1, max: 200 });
  let computedVo2;
  let formula;
  let peakSpeed;
  let peakGrade;
  let peakWatts;
  if (manualVo2 !== undefined) {
    computedVo2 = manualVo2;
    formula = 'Manual';
    peakSpeed = optionalNumber(input?.peak_speed_kmh, 'Peak speed', { min: 0.1, max: 50 });
    peakGrade = optionalNumber(input?.peak_grade_pct, 'Peak grade', { min: -40, max: 60 });
    peakWatts = optionalNumber(input?.peak_watts, 'Peak workload', { min: 0.1, max: 5000 });
  } else if (modality === 'treadmill') {
    peakSpeed = requiredNumber(input?.peak_speed_kmh, 'Peak speed', { min: 0.1, max: 50 });
    peakGrade = requiredNumber(input?.peak_grade_pct, 'Peak grade', { min: -40, max: 60 });
    const speedMmin = (peakSpeed * 1000) / 60;
    computedVo2 = (speedMmin * 0.1) + (speedMmin * (peakGrade / 100) * 1.8) + 3.5;
    formula = 'ACSM Treadmill';
  } else {
    peakWatts = requiredNumber(input?.peak_watts, 'Peak workload', { min: 0.1, max: 5000 });
    computedVo2 = ((1.8 * (peakWatts * 6)) / bodyMass) + 7;
    formula = 'ACSM Cycle';
  }
  const peakVo2 = round(computedVo2, 1);
  if (peakVo2 <= 0 || peakVo2 > 200) throw new Error('Peak VO2 result must be from greater than 0 to 200 ml/kg/min');
  const peakVo2Absolute = round((peakVo2 * bodyMass) / 1000, 3);
  const optionalValues = normalizeVo2Inputs(input);
  const category = classifyVo2Gxt(peakVo2, age, sex);
  const plateau = input?.vo2_plateau === '' || input?.vo2_plateau === null || input?.vo2_plateau === undefined
    ? undefined
    : requiredEnum(input.vo2_plateau, 'VO2 plateau', ['yes', 'no']);
  const maxHr = 220 - age;
  const hrPct = optionalValues.peak_hr === undefined ? undefined : round((optionalValues.peak_hr / maxHr) * 100, 1);
  const oxygenPulse = optionalValues.peak_hr === undefined ? undefined : round((peakVo2Absolute * 1000) / optionalValues.peak_hr, 1);
  const criteria = [
    { label: 'RER ≥ 1.10', met: optionalValues.peak_rer === undefined ? null : optionalValues.peak_rer >= 1.1 },
    { label: 'HR ≥ 90% age-predicted max', met: hrPct === undefined ? null : hrPct >= 90 },
    { label: 'RPE ≥ 17/20', met: optionalValues.peak_rpe === undefined ? null : optionalValues.peak_rpe >= 17 },
    { label: 'VO2 plateau observed', met: plateau === undefined ? null : plateau === 'yes' },
  ];
  const criteriaMet = criteria.filter(({ met }) => met === true);
  const isMaximal = criteriaMet.length >= 2;
  const riskFlags = [];
  if (optionalValues.peak_sbp !== undefined && optionalValues.peak_sbp > 250) riskFlags.push('Hypertensive response');
  if (optionalValues.peak_sbp !== undefined && optionalValues.baseline_sbp !== undefined && optionalValues.baseline_sbp - optionalValues.peak_sbp > 10) riskFlags.push('Exertional hypotension');
  if (optionalValues.peak_rer !== undefined && optionalValues.peak_rer > 1.3) riskFlags.push('Very high RER (>1.30)');
  const ecgFindings = optionalText(input?.ecg_findings, 'ECG findings', 200) || 'normal';
  if (ecgFindings !== 'normal') riskFlags.push(`ECG: ${ecgFindings.replace(/_/g, ' ')}`);
  if (optionalValues.recovery_hr_1min !== undefined && optionalValues.peak_hr !== undefined && optionalValues.peak_hr - optionalValues.recovery_hr_1min < 12) riskFlags.push('Impaired HRR (1 min)');
  if (optionalValues.recovery_hr_2min !== undefined && optionalValues.peak_hr !== undefined && optionalValues.peak_hr - optionalValues.recovery_hr_2min < 22) riskFlags.push('Impaired HRR (2 min)');
  const protocol = optionalText(input?.protocol, 'Protocol', 200);
  const testIndication = optionalText(input?.test_indication, 'Test indication', 200);
  const recoverySymptoms = optionalText(input?.recovery_symptoms, 'Recovery symptoms');
  const terminationReason = optionalText(input?.termination_reason, 'Termination reason', 500);
  const adverseEvents = optionalText(input?.adverse_events, 'Adverse events', 500) || 'none';
  const notes = notesFrom(input, context);
  const criteriaNames = criteriaMet.map(({ label }) => label).join('; ') || 'None met';
  const interpretation = [
    `The client achieved a ${isMaximal ? 'maximal' : 'peak'} VO2 of ${peakVo2.toFixed(1)} ml/kg/min (${peakVo2Absolute.toFixed(2)} L/min) on a ${modality === 'treadmill' ? 'treadmill' : 'cycle ergometer'}${protocol ? ` using the ${protocol} protocol` : ''}.`,
    `This places the client in the ${category} category for age and sex.`,
    hrPct === undefined ? null : `Peak heart rate was ${hrPct.toFixed(0)}% of age-predicted maximum.`,
    optionalValues.peak_rer === undefined ? null : `Peak RER was ${optionalValues.peak_rer.toFixed(2)}${optionalValues.peak_rer >= 1.1 ? ', confirming maximal effort.' : ', which does not confirm true maximal effort.'}`,
    optionalValues.ventilatory_threshold === undefined ? null : `Ventilatory threshold occurred at ${optionalValues.ventilatory_threshold} ml/kg/min (${round((optionalValues.ventilatory_threshold / peakVo2) * 100, 0)}% of peak VO2).`,
    riskFlags.length ? `Clinical flags: ${riskFlags.join('; ')}.` : null,
    isMaximal ? null : 'Fewer than two maximal criteria were met; the result represents peak VO2 rather than true VO2max.',
  ].filter(Boolean).join(' ');
  const soapText = [
    `• CPET / VO2max GXT (${modality === 'treadmill' ? 'Treadmill' : 'Cycle Ergometer'}, ${protocol || 'Protocol not specified'})`,
    `  Result Type: ${isMaximal ? 'Maximal VO2max' : 'Peak VO2 (sub-maximal criteria)'}`,
    `  Peak VO2: ${peakVo2.toFixed(1)} ml/kg/min (${peakVo2Absolute.toFixed(2)} L/min)`,
    `  Normative Category: ${category} (age ${age}, ${sex})`,
    optionalValues.peak_hr === undefined ? null : `  Peak HR: ${optionalValues.peak_hr} bpm${hrPct === undefined ? '' : ` (${hrPct.toFixed(0)}% age-predicted max)`}`,
    optionalValues.peak_rer === undefined ? null : `  Peak RER: ${optionalValues.peak_rer}`,
    optionalValues.peak_rpe === undefined ? null : `  Peak RPE: ${optionalValues.peak_rpe}/20`,
    oxygenPulse === undefined ? null : `  O2 Pulse: ${oxygenPulse} mL/beat`,
    optionalValues.ventilatory_threshold === undefined ? null : `  Ventilatory Threshold: ${optionalValues.ventilatory_threshold} ml/kg/min`,
    optionalValues.peak_ve_vco2 === undefined ? null : `  VE/VCO2 slope: ${optionalValues.peak_ve_vco2}`,
    optionalValues.recovery_hr_1min === undefined ? null : `  HRR 1 min: ${optionalValues.recovery_hr_1min} bpm`,
    optionalValues.recovery_hr_2min === undefined ? null : `  HRR 2 min: ${optionalValues.recovery_hr_2min} bpm`,
    terminationReason ? `  Test Termination: ${terminationReason}` : null,
    ecgFindings !== 'normal' ? `  ECG: ${ecgFindings}` : null,
    riskFlags.length ? `  Risk Flags: ${riskFlags.join(', ')}` : null,
    `  Maximal Criteria Met: ${criteriaMet.length}/4 (${criteriaNames})`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  const normalizedInput = compactObject({ modality, protocol, test_indication: testIndication, body_mass_kg: bodyMass, client_age: age, client_sex: sex, peak_speed_kmh: peakSpeed, peak_grade_pct: peakGrade, peak_watts: peakWatts, manual_vo2_override: manualVo2, vo2_plateau: plateau, ...optionalValues, recovery_symptoms: recoverySymptoms, termination_reason: terminationReason, ecg_findings: ecgFindings, adverse_events: adverseEvents, notes });
  return finish({ spec: VO2MAX_GXT_FULL_RUNNER_SPEC, input: normalizedInput, context, result: peakVo2, measurementType: 'vo2max_gxt_cpet', notes, soapText, additional: compactObject({ is_maximal: isMaximal, modality, protocol, test_indication: testIndication, test_duration_min: optionalValues.test_duration_min, body_mass_kg: bodyMass, client_age: age, client_sex: sex, vo2_formula_used: formula, peak_vo2_relative: peakVo2, peak_vo2_absolute: peakVo2Absolute, normative_category: category, peak_hr: optionalValues.peak_hr, hr_pct_age_predicted: hrPct, peak_sbp: optionalValues.peak_sbp, peak_dbp: optionalValues.peak_dbp, peak_rer: optionalValues.peak_rer, peak_rpe: optionalValues.peak_rpe, peak_ve: optionalValues.peak_ve, ve_vco2: optionalValues.peak_ve_vco2, oxygen_pulse_ml_beat: oxygenPulse, ventilatory_threshold: optionalValues.ventilatory_threshold, rer_at_vt: optionalValues.rer_at_vt, recovery_hr_1min: optionalValues.recovery_hr_1min, recovery_hr_2min: optionalValues.recovery_hr_2min, recovery_sbp: optionalValues.recovery_sbp, recovery_symptoms: recoverySymptoms, maximal_criteria_met: criteriaMet.length, maximal_criteria: criteria, risk_flags: riskFlags, ecg_findings: ecgFindings, termination_reason: terminationReason, adverse_events: adverseEvents, interpretation }) });
}

export function scoreMet(input, context = {}) {
  const speed = optionalNumber(input?.speed_mph, 'Treadmill speed', { min: 0.1, max: 30 });
  const grade = optionalNumber(input?.grade_pct, 'Treadmill grade', { min: -40, max: 60 });
  const workload = optionalNumber(input?.workload_watts, 'Cycle workload', { min: 0.1, max: 5000 });
  const hasTreadmill = speed !== undefined || grade !== undefined;
  const hasCycle = workload !== undefined;
  if (hasTreadmill && (speed === undefined || grade === undefined)) throw new Error('Treadmill MET calculation requires both speed and grade');
  if (hasTreadmill === hasCycle) throw new Error('Enter exactly one complete modality: treadmill speed and grade, or cycle workload');
  let vo2;
  let modality;
  if (hasTreadmill) {
    const speedMps = speed * 0.44704;
    vo2 = (0.2 * speedMps) + (0.9 * speedMps * (grade / 100)) + 3.5;
    modality = 'treadmill';
  } else {
    vo2 = (workload * 6.12) + 3.5;
    modality = 'cycle';
  }
  const vo2Rounded = round(vo2, 4);
  const mets = round(vo2 / 3.5, 4);
  if (mets <= 0 || mets > 10000) throw new Error('Calculated MET result is outside the supported finite range');
  const capacity = mets < 5 ? 'Low' : mets <= 10 ? 'Moderate' : 'High';
  const preVitals = normalizeVitals(input?.pre_test_vitals, 'Pre-test vitals');
  const postVitals = normalizeVitals(input?.post_test_vitals, 'Post-test vitals');
  const notes = notesFrom(input, context);
  const sourceLine = modality === 'treadmill' ? `Speed: ${speed} mph | Grade: ${grade}%` : `Workload: ${workload} W`;
  const soapText = `• Metabolic Equivalent (MET) Calculation\n  Modality: ${modality === 'treadmill' ? 'Treadmill' : 'Cycle Ergometer'}\n  ${sourceLine}\n  Estimated oxygen cost: ${vo2Rounded} ml/kg/min\n  Result: ${mets.toFixed(2)} METs — ${capacity} Capacity${notes ? `\n  Notes: ${notes}` : ''}`;
  const normalizedInput = compactObject({ speed_mph: speed, grade_pct: grade, workload_watts: workload, pre_test_vitals: preVitals, post_test_vitals: postVitals, notes });
  return finish({ spec: MET_CALC_FULL_RUNNER_SPEC, input: normalizedInput, context, result: mets, measurementType: 'metabolic_equivalent', notes, soapText, additional: compactObject({ modality, speed_mph: speed, grade_pct: grade, workload_watts: workload, vo2: vo2Rounded, mets, capacity, pre_test_vitals: preVitals, post_test_vitals: postVitals, interpretation: `${capacity} capacity` }) });
}

function normalizeKey(value) {
  const key = String(value ?? '').trim().toLowerCase();
  const aliases = {
    bmi: 'bmi_full',
    whr: 'whr_full',
    skinfold: 'body_fat_skinfold',
    '12_min_walk': '12min_walk',
    '12-minute walk/run test': '12min_walk',
    push_up: 'max_push',
    spirometry: 'fvc',
    'vo2max gxt': 'vo2max_gxt_full',
    met: 'met_calc_full',
  };
  return aliases[key] || key;
}

const FIXTURES = Object.freeze({
  bmi_full: Object.freeze({ height_cm: 175, weight_kg: 75, notes: '' }),
  whr_full: Object.freeze({ waist_cm: 82, hip_cm: 99, gender: 'male', notes: '' }),
  girth: Object.freeze({ selected_sites: Object.freeze(['waist', 'calf']), measurements: Object.freeze({ waist: Object.freeze({ center: 82 }), calf: Object.freeze({ left: 36, right: 36.5 }) }), observations: '' }),
  body_fat_skinfold: Object.freeze({ measurements: Object.freeze({ biceps: 8, triceps: 12, subscapular: 14, suprailiac: 10 }), age: 35, sex: 'male', notes: '' }),
  home_step: Object.freeze({ age: 35, pre_hr: 110, pre_rpe: 4, post_hr: 82, post_rpe: 3, notes: '' }),
  '12min_walk': Object.freeze({ distance_m: 2400, age: 35, gender: 'male', notes: '' }),
  max_push: Object.freeze({ trials: Object.freeze([Object.freeze({ reps: 24 }), Object.freeze({ reps: 27 })]), notes: '' }),
  fvc: Object.freeze({ trials: Object.freeze([Object.freeze({ fvc: 4.2, fev1: 3.5, pef: 520 }), Object.freeze({ fvc: 4.3, fev1: 3.6, pef: 530 })]), height_cm: 175, predicted_fvc: 4.5, predicted_fev1: 3.8, notes: '' }),
  pefr: Object.freeze({ trials: Object.freeze([480, 510, 500]), pre_test_vitals: Object.freeze({ systolic: 120, diastolic: 80, heartRate: 72 }), post_test_vitals: Object.freeze({ systolic: 126, diastolic: 82, heartRate: 84 }), notes: '' }),
  ymca_cycle: Object.freeze({ age: 35, weight_kg: 75, gender: 'M', heart_rates: Object.freeze([118, 122]), workloads: Object.freeze([50, 75]), rpe: 5, symptoms: '', notes: '' }),
  wingate: Object.freeze({ body_mass_kg: 75, resistance_kp: 5.625, sport: 'General Population', gender: 'male', interval_revolutions: Object.freeze([12, 11, 10, 9, 8, 7]), recovery_hr_1min: 140, rpe: 18, notes: '' }),
  rsa_generic: Object.freeze({ protocol_key: 'rsa_6x30', sprint_times: Object.freeze([4.3, 4.4, 4.5, 4.6, 4.7, 4.8]), surface_type: 'Indoor track', notes: '' }),
  rsa_6x30: Object.freeze({ protocol_key: 'rsa_6x30', sprint_times: Object.freeze([4.3, 4.4, 4.5, 4.6, 4.7, 4.8]), surface_type: 'Indoor track', notes: '' }),
  rsa_10x20: Object.freeze({ protocol_key: 'rsa_10x20', sprint_times: Object.freeze([3.2, 3.25, 3.3, 3.35, 3.4, 3.45, 3.5, 3.55, 3.6, 3.65]), surface_type: 'Indoor court', notes: '' }),
  rsa_7x35: Object.freeze({ protocol_key: 'rsa_7x35', sprint_times: Object.freeze([5.1, 5.2, 5.25, 5.3, 5.35, 5.4, 5.45]), surface_type: 'Track', notes: '' }),
  rsa_shuttle: Object.freeze({ protocol_key: 'rsa_shuttle', sprint_times: Object.freeze([6.3, 6.4, 6.5, 6.6, 6.7, 6.8]), surface_type: 'Indoor court', notes: '' }),
  hydrostatic: Object.freeze({ land_weight_kg: 75, underwater_weights_kg: Object.freeze([3, 3.1, 3.05]), notes: '' }),
  rmr: Object.freeze({ weight_kg: 75, height_cm: 175, age: 35, sex: 'male', notes: '' }),
  vo2max_gxt_full: Object.freeze({ modality: 'treadmill', protocol: 'Bruce', body_mass_kg: 75, client_age: 35, client_sex: 'male', peak_speed_kmh: 10, peak_grade_pct: 5, peak_hr: 178, peak_rer: 1.15, peak_rpe: 18, vo2_plateau: 'yes', ecg_findings: 'normal', adverse_events: 'none', notes: '' }),
  met_calc_full: Object.freeze({ speed_mph: 4, grade_pct: 5, pre_test_vitals: Object.freeze({ heartRate: 72, bloodPressure: '120/80' }), post_test_vitals: Object.freeze({ heartRate: 110, bloodPressure: '138/82' }), notes: '' }),
});

export function buildFixture(canonicalOrRunnerKey) {
  const key = normalizeKey(canonicalOrRunnerKey);
  const fixture = FIXTURES[key];
  if (!fixture) throw new Error(`Unsupported Extras body/fitness scorer fixture: ${canonicalOrRunnerKey}`);
  return JSON.parse(JSON.stringify(fixture));
}

export function validateAndScore(input, context = {}) {
  const key = normalizeKey(context?.runnerKey || context?.scoringKey || input?.runnerKey || input?.scoringKey || input?.runner_key || input?.scoring_key);
  switch (key) {
    case 'bmi_full': return scoreBmi(input, context);
    case 'whr_full': return scoreWhr(input, context);
    case 'girth': return scoreGirth(input, context);
    case 'body_fat_skinfold': return scoreSkinfold(input, context);
    case 'home_step': return scoreHomeStep(input, context);
    case '12min_walk': return scoreCooper12Minute(input, context);
    case 'max_push': return scoreMaxPush(input, context);
    case 'fvc': return scoreFvc(input, context);
    case 'pefr': return scorePefr(input, context);
    case 'ymca_cycle': return scoreYmcaCycle(input, context);
    case 'wingate': return scoreWingate(input, context);
    case 'rsa_generic':
    case 'rsa_6x30':
    case 'rsa_10x20':
    case 'rsa_7x35':
    case 'rsa_shuttle': return scoreRsa(input, { ...context, runnerKey: key });
    case 'hydrostatic': return scoreHydrostatic(input, context);
    case 'rmr': return scoreRmr(input, context);
    case 'vo2max_gxt_full': return scoreVo2Gxt(input, context);
    case 'met_calc_full': return scoreMet(input, context);
    default: throw new Error(`Extras body/fitness scorer requires one of: ${RUNNER_SPECS.map(({ runnerKey }) => runnerKey).join(', ')}`);
  }
}
