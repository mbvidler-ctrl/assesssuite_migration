import { todayLocal } from '../../localDate.js';

const NOTES_MAX = 4000;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const RUNNER_KEYS = Object.freeze([
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

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function field(key, label, type, required = true, extra = {}) {
  return { key, label, type, required, ...extra };
}

function choiceOptions(entries) {
  return entries.map(([label, value]) => ({ label, value }));
}

const SEX_OPTIONS = choiceOptions([['Male', 'male'], ['Female', 'female']]);
const YES_NO_OPTIONS = choiceOptions([['Yes', 'yes'], ['No', 'no']]);
const STEP_VITAL_FIELDS = Object.freeze([
  field('hr', 'Heart rate', 'number', false),
  field('bp', 'Blood pressure', 'text', false),
  field('spo2', 'Oxygen saturation', 'number', false),
  field('rpe', 'RPE', 'number', false),
  field('dyspnea', 'Dyspnoea', 'number', false),
]);
const MODIFIED_BRUCE_STAGE_FIELDS = Object.freeze([
  field('stage', 'Stage number', 'integer'),
  field('speed', 'Treadmill speed', 'number'),
  field('grade', 'Treadmill grade', 'number'),
  field('duration', 'Stage duration', 'duration'),
  field('heartRate', 'Stage heart rate', 'number'),
  field('rpe', 'Stage RPE', 'number', false),
]);
const MODIFIED_BRUCE_PRE_VITAL_FIELDS = Object.freeze([
  field('heartRate', 'Heart rate', 'number'),
  field('bloodPressure', 'Blood pressure', 'text'),
  field('weight', 'Body weight', 'number', false),
  field('height', 'Height', 'number', false),
]);
const MODIFIED_BRUCE_POST_VITAL_FIELDS = Object.freeze([
  field('heartRate', 'Heart rate', 'number'),
  field('bloodPressure', 'Blood pressure', 'text'),
  field('reasonForStop', 'Reason for stopping', 'text', false),
]);

// Schema-v6 requires every value retained by a deterministic fixture/scorer to
// be represented by an explicit atomic RunnerSpec field. These additions are
// appended without changing scorer or production-runner behaviour.
const SPEC_COMPLETION_FIELDS = Object.freeze({
  aerobic_step: [
    field('age', 'Age', 'integer', false),
    field('sex', 'Sex', 'select', false, { options: SEX_OPTIONS }),
  ],
  eswt: [field('speed_reason', 'Speed-selection reason', 'text', false)],
  '1rm_testing': [
    field('assistive_considerations', 'Assistive considerations', 'textarea', false),
    field('rom_standard_used', 'Range-of-motion standard used', 'text', false),
    field('machine_settings', 'Machine settings', 'text', false),
    field('spotter_used', 'Spotter used', 'boolean', false),
  ],
  '20m_shuttle': [
    field('age', 'Age', 'integer', false),
    field('sex', 'Sex', 'select', false, { options: SEX_OPTIONS }),
  ],
});

function defineSpec({ runnerKey, name, measurementType, primaryField, unit, formula, fields }) {
  return deepFreeze({
    schemaVersion: 1,
    kind: 'measurement',
    runnerKey,
    scoringKey: runnerKey,
    name,
    measurementType,
    fields: [...fields, ...(SPEC_COMPLETION_FIELDS[runnerKey] || [])],
    scoring: {
      version: `${runnerKey}.v1`,
      formula,
      validation: 'Required values, units, enumerations, ranges, paired observations and finite derived results are enforced before persistence.',
    },
    result: {
      primaryField,
      unit,
      persistence: [
        'result_value',
        'additional_data.raw_input',
        'additional_data.soap_text',
        'additional_data.report_text',
        'additional_data.interpretation',
      ],
    },
  });
}

const SPECS = {
  heart_rate: defineSpec({
    runnerKey: 'heart_rate', name: 'Heart Rate (Pre/Post Exercise)', measurementType: 'heart_rate', primaryField: 'heart_rate_bpm', unit: 'bpm',
    formula: 'Direct heart-rate measurement; pre/post mode retains both observations and uses the pre-exercise value as the stable primary result.',
    fields: [field('mode', 'Measurement mode', 'select', true, { options: choiceOptions([['Single measurement', 'single'], ['Pre/post exercise', 'pre_post']]) }), field('heart_rate_bpm', 'Heart rate', 'number', false), field('pre_bpm', 'Pre-exercise heart rate', 'number', false), field('post_bpm', 'Post-exercise heart rate', 'number', false), field('additional_measurements', 'Additional post-exercise measurements', 'array', false, { minItems: 0, maxItems: 20, itemSchema: field('observation', 'Additional heart-rate observation', 'object', true, { fields: [field('label', 'Observation label', 'text'), field('hr', 'Heart rate', 'number')] }) }), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  'spo2-exercise': defineSpec({
    runnerKey: 'spo2-exercise', name: 'Oxygen Saturation (SpO2) Pre/Post Exercise', measurementType: 'spo2_exercise', primaryField: 'pre_percent', unit: '%',
    formula: 'Direct paired pulse-oximetry observations before and after exercise; the pre-exercise value is the stable primary result and the percentage-point change is retained.',
    fields: [field('pre_percent', 'Pre-exercise SpO2', 'number'), field('post_percent', 'Post-exercise SpO2', 'number'), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  'spo2-resting': defineSpec({
    runnerKey: 'spo2-resting', name: 'Resting Oxygen Saturation (SpO2)', measurementType: 'spo2_resting', primaryField: 'spo2_percent', unit: '%',
    formula: 'Direct resting pulse-oximetry measurement after a stable reading is obtained.',
    fields: [field('spo2_percent', 'Resting SpO2', 'number'), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  blood_pressure: defineSpec({
    runnerKey: 'blood_pressure', name: 'Blood Pressure', measurementType: 'blood_pressure', primaryField: 'systolic_mmhg', unit: 'mmHg',
    formula: 'Direct paired systolic and diastolic pressure measurement; systolic pressure is the numeric primary result.',
    fields: [field('systolic', 'Systolic pressure', 'number'), field('diastolic', 'Diastolic pressure', 'number'), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  ymca_3min_step: defineSpec({
    runnerKey: 'ymca_3min_step', name: 'YMCA 3-Minute Step Test', measurementType: 'allied_step_recovery_test', primaryField: 'recovery_hr', unit: 'bpm',
    formula: 'Recovery heart rate after the fixed three-minute step protocol, classified by the existing sex-specific bands.',
    fields: [field('age', 'Age', 'number'), field('sex', 'Sex', 'select', true, { options: choiceOptions([['Male', 'M'], ['Female', 'F']]) }), field('step_height_cm', 'Step height', 'number'), field('resting_hr', 'Resting heart rate', 'number'), field('recovery_hr', 'Recovery heart rate', 'number'), field('rpe', 'RPE', 'number', false), field('symptoms', 'Symptoms', 'textarea', false), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  aerobic_step: defineSpec({
    runnerKey: 'aerobic_step', name: 'Step Test (Aerobic Step Test)', measurementType: 'step_test', primaryField: 'recovery_hr_1min', unit: 'bpm',
    formula: 'Protocol-specific recovery-heart-rate outcome with YMCA classification, Queens VO2 estimate or Harvard Fitness Index where applicable.',
    fields: [field('protocol_key', 'Protocol', 'select', true, { options: choiceOptions([['YMCA 3-Minute Step Test', 'ymca'], ["Queen's College Step Test", 'queens'], ['Modified Older Adult Step Test', 'modified_older'], ['Harvard Step Test (Full)', 'harvard'], ['Custom Step Test', 'custom']]) }), field('duration_seconds', 'Completed duration', 'number'), field('completed_full_protocol', 'Full protocol completed', 'boolean'), field('stop_reason', 'Stop reason', 'text'), field('step_height_cm', 'Step height', 'number'), field('cadence_steps_per_min', 'Cadence', 'number'), field('pre_vitals', 'Pre-test vitals', 'object', false, { fields: STEP_VITAL_FIELDS }), field('post_vitals', 'Post-test vitals', 'object', true, { fields: STEP_VITAL_FIELDS }), field('recovery', 'Recovery observations', 'object', true, { fields: [field('hr1', 'One-minute recovery heart rate', 'number'), field('hr2', 'Two-minute recovery heart rate', 'number', false), field('hr3', 'Three-minute recovery heart rate', 'number', false), field('dyspnea', 'Recovery dyspnoea', 'number', false), field('fatigue', 'Recovery fatigue', 'number', false), field('dizziness', 'Dizziness in recovery', 'boolean'), field('chestDiscomfort', 'Chest discomfort in recovery', 'boolean')] }), field('during_symptoms', 'During-test symptoms', 'object', false, { fields: [field('rpe', 'During-test RPE', 'number', false), field('dyspnea', 'During-test dyspnoea', 'number', false), field('pain', 'During-test pain', 'number', false), field('symptoms', 'Symptoms noted', 'choice[]', false, { minItems: 0, maxItems: 8, options: choiceOptions([['Chest pain', 'Chest pain'], ['Palpitations', 'Palpitations'], ['Dizziness', 'Dizziness'], ['Leg fatigue', 'Leg fatigue'], ['Breathlessness', 'Breathlessness'], ['Nausea', 'Nausea'], ['Calf pain', 'Calf pain'], ['Other', 'Other']]) })] }), field('setup', 'Test setup', 'object', false, { fields: [field('stepHeight', 'Confirmed step height', 'number', false), field('cadence', 'Confirmed cadence', 'number', false), field('surface', 'Surface', 'select', true, { options: choiceOptions([['Firm floor', 'Firm floor'], ['Carpet', 'Carpet'], ['Gym mat', 'Gym mat'], ['Outdoor', 'Outdoor']]) }), field('shoesOn', 'Shoes on', 'boolean'), field('assistiveDeviceNearby', 'Assistive device nearby', 'boolean'), field('dominantLeg', 'Dominant leg', 'select', false, { options: choiceOptions([['Left', 'Left'], ['Right', 'Right'], ['Unknown', 'Unknown']]) }), field('balanceConcern', 'Balance concern noted', 'boolean'), field('baselinePain', 'Baseline pain', 'number'), field('baselineRPE', 'Baseline RPE', 'number'), field('baselineDyspnea', 'Baseline dyspnoea', 'number'), field('baselineFatigue', 'Baseline fatigue', 'number')] }), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  chester: defineSpec({
    runnerKey: 'chester', name: 'Chester Step Test', measurementType: 'chester_step', primaryField: 'final_stage_hr', unit: 'bpm',
    formula: 'Final valid stage heart rate from one to five ordered three-minute stages.',
    fields: [field('age', 'Age', 'number'), field('step_height_cm', 'Step height', 'number'), field('stages', 'Completed stages', 'array', true, { minItems: 1, maxItems: 5, itemSchema: field('stage', 'Chester stage observation', 'object', true, { fields: [field('stage', 'Stage number', 'integer'), field('hr', 'Stage heart rate', 'number'), field('rpe', 'Stage RPE', 'number')] }) }), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  eswt: defineSpec({
    runnerKey: 'eswt', name: 'Endurance Shuttle Walk Test (ESWT)', measurementType: 'eswt', primaryField: 'endurance_time_seconds', unit: 's',
    formula: 'Measured endurance time; estimated distance equals selected speed multiplied by elapsed hours.',
    fields: [field('time_elapsed_seconds', 'Endurance time', 'number'), field('selected_speed_kmh', 'Selected speed', 'number'), field('shuttles_completed', 'Shuttles completed', 'number'), field('stop_reason', 'Stop reason', 'text'), field('pre_test', 'Pre-test observations', 'object', false, { fields: [field('heart_rate', 'Resting heart rate', 'number', false), field('blood_pressure', 'Resting blood pressure', 'text', false), field('spo2', 'Resting oxygen saturation', 'number', false), field('dyspnoea', 'Baseline dyspnoea', 'number', false), field('leg_fatigue', 'Baseline leg fatigue', 'number', false), field('chest_pain', 'Chest pain', 'select', false, { options: YES_NO_OPTIONS }), field('dizziness', 'Dizziness', 'select', false, { options: YES_NO_OPTIONS }), field('recent_illness', 'Recent illness', 'select', false, { options: YES_NO_OPTIONS }), field('walking_aid', 'Walking aid', 'select', false, { options: YES_NO_OPTIONS }), field('oxygen_therapy', 'Oxygen therapy', 'select', false, { options: YES_NO_OPTIONS }), field('notes', 'Pre-test notes', 'textarea', false)] }), field('post_test', 'Post-test observations', 'object', false, { fields: [field('heart_rate', 'Post-test heart rate', 'number', false), field('blood_pressure', 'Post-test blood pressure', 'text', false), field('spo2', 'Post-test oxygen saturation', 'number', false), field('dyspnoea', 'Post-test dyspnoea', 'number', false), field('leg_fatigue', 'Post-test leg fatigue', 'number', false), field('adverse_events', 'Adverse events', 'textarea', false)] }), field('iswt', 'ISWT context', 'object', false, { fields: [field('completed', 'ISWT completed', 'select', true, { options: YES_NO_OPTIONS }), field('result_metres', 'ISWT result', 'number', false)] }), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  height_measurement: defineSpec({
    runnerKey: 'height_measurement', name: 'Height', measurementType: 'height', primaryField: 'height_cm', unit: 'cm',
    formula: 'Direct stadiometer height measurement.',
    fields: [field('height_cm', 'Height', 'number'), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  weight_measure: defineSpec({
    runnerKey: 'weight_measure', name: 'Weight', measurementType: 'weight', primaryField: 'adjusted_weight_kg', unit: 'kg',
    formula: 'Measured weight minus an explicitly recorded clothing adjustment, rounded to 0.1 kg.',
    fields: [field('measured_kg', 'Measured weight', 'number'), field('clothing_adjustment_kg', 'Clothing adjustment', 'number'), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  waist_circ: defineSpec({
    runnerKey: 'waist_circ', name: 'Waist Circumference', measurementType: 'waist_circumference', primaryField: 'waist_circumference_cm', unit: 'cm',
    formula: 'Direct waist circumference with the existing sex-specific risk-band mapping.',
    fields: [field('waist_circumference_cm', 'Waist circumference', 'number'), field('sex', 'Sex', 'select', true, { options: SEX_OPTIONS }), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  tri_arm: defineSpec({
    runnerKey: 'tri_arm', name: 'Tri-Level Arm Ergometer Test', measurementType: 'tri_level_arm_ergometer', primaryField: 'final_stage_hr', unit: 'bpm',
    formula: 'Last recorded heart rate across the fixed 25 W, 50 W and 75 W stages.',
    fields: [field('stage_heart_rates', 'Stage heart rates', 'number[]', true, { minItems: 3, length: 3, itemSchema: field('heart_rate', 'Stage heart rate', 'number', false) }), field('rpe', 'RPE', 'number', false), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  tecumseh: defineSpec({
    runnerKey: 'tecumseh', name: 'Tecumseh Step Test', measurementType: 'tecumseh_step', primaryField: 'recovery_hr', unit: 'bpm',
    formula: 'One-minute post-exercise recovery heart rate classified against the existing age-group and sex table.',
    fields: [field('pre_hr', 'Pre-exercise heart rate', 'number', false), field('recovery_hr', 'Recovery heart rate', 'number'), field('age_group', 'Age group', 'select', true, { options: choiceOptions([['20-29 years', '20-29'], ['30-39 years', '30-39'], ['40-49 years', '40-49'], ['50-59 years', '50-59'], ['60+ years', '60+']]) }), field('sex', 'Sex', 'select', true, { options: SEX_OPTIONS }), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  balke: defineSpec({
    runnerKey: 'balke', name: 'Balke-Ware Treadmill Test', measurementType: 'balke_ware', primaryField: 'total_time_minutes', unit: 'min',
    formula: 'Measured treadmill duration with the existing sex-specific Balke-Ware VO2 estimate.',
    fields: [field('total_seconds', 'Total duration', 'number'), field('sex', 'Sex', 'select', true, { options: SEX_OPTIONS }), field('client_age', 'Client age', 'number', false), field('pre_test', 'Pre-test observations', 'object', false, { fields: [field('heart_rate', 'Pre-test heart rate', 'number', false), field('blood_pressure', 'Pre-test blood pressure', 'text', false), field('rpe', 'Pre-test RPE', 'number', false)] }), field('body_weight_kg', 'Body weight', 'number', false), field('peak_rpe', 'Peak RPE', 'number', false), field('end_reason', 'End reason', 'text'), field('stage_heart_rates', 'Stage heart rates', 'object', false, { fields: Array.from({ length: 25 }, (_, index) => field(String(index + 1), `Minute ${index + 1} heart rate`, 'number', false)) }), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  modified_bruce: defineSpec({
    runnerKey: 'modified_bruce', name: 'Modified Bruce Protocol', measurementType: 'modified_bruce', primaryField: 'max_stage', unit: 'stage',
    formula: 'Highest completed Modified Bruce stage; total duration is the sum of recorded stage durations.',
    fields: [field('stage_data', 'Completed stage observations', 'array', true, { minItems: 1, maxItems: 9, itemSchema: field('stage', 'Modified Bruce stage observation', 'object', true, { fields: MODIFIED_BRUCE_STAGE_FIELDS }) }), field('pre_test_vitals', 'Pre-test vitals', 'object', true, { fields: MODIFIED_BRUCE_PRE_VITAL_FIELDS }), field('post_test_vitals', 'Post-test vitals', 'object', true, { fields: MODIFIED_BRUCE_POST_VITAL_FIELDS }), field('stop_reason', 'Stop reason', 'text'), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  '1rm_testing': defineSpec({
    runnerKey: '1rm_testing', name: '1-Repetition Maximum (1RM) Testing', measurementType: '1rm_testing', primaryField: 'one_rm_load', unit: 'recorded load unit',
    formula: 'Highest explicitly recorded successful one-repetition load; relative strength converts load and body mass to kilograms.',
    fields: [field('exercise_tested', 'Exercise tested', 'text'), field('equipment_type', 'Equipment', 'text'), field('units', 'Load unit', 'select', true, { options: choiceOptions([['Kilograms (kg)', 'kg'], ['Pounds (lb)', 'lb']]) }), field('one_rm_load', '1RM load', 'number'), field('body_mass', 'Body mass', 'number', false), field('body_mass_units', 'Body-mass unit', 'select', false, { options: choiceOptions([['kg', 'kg'], ['lb', 'lb']]) }), field('sex', 'Sex', 'select', false, { options: SEX_OPTIONS }), field('attempts', 'Attempt log', 'array', false, { minItems: 0, maxItems: 100, itemSchema: field('attempt', '1RM attempt', 'object', true, { fields: [field('attemptNumber', 'Attempt number', 'integer'), field('load', 'Attempt load', 'number'), field('success', 'Successful repetition', 'boolean'), field('techniqueOk', 'Technique acceptable', 'boolean'), field('notes', 'Attempt notes', 'textarea', false)] }) }), field('rpe_post', 'Post-test RPE', 'number', false), field('pain_post', 'Post-test pain', 'number', false), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  bruce_treadmill: defineSpec({
    runnerKey: 'bruce_treadmill', name: 'Bruce Treadmill Protocol', measurementType: 'bruce_treadmill', primaryField: 'total_time_seconds', unit: 's',
    formula: 'Measured total test duration with the existing cubic Bruce VO2 estimate.',
    fields: [field('total_time_seconds', 'Total duration', 'number'), field('stage_data', 'Stage observations', 'array', true, { minItems: 1, maxItems: 20, itemSchema: field('stage', 'Bruce stage observation', 'object', true, { fields: [field('stage', 'Stage identifier', 'number'), field('time', 'Elapsed stage time', 'duration'), field('heartRate', 'Stage heart rate', 'number'), field('systolic', 'Systolic pressure', 'number', false), field('diastolic', 'Diastolic pressure', 'number', false), field('rpe', 'Stage RPE', 'number', false)] }) }), field('current_stage_index', 'Current stage index', 'number'), field('current_heart_rate', 'Current heart rate', 'number', false), field('current_systolic', 'Current systolic pressure', 'number', false), field('termination_reason', 'Termination reason', 'text'), field('symptoms', 'Symptoms', 'textarea', false), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  '2min_walk': defineSpec({
    runnerKey: '2min_walk', name: '2-Minute Walk Test (2MWT)', measurementType: 'two_minute_walk', primaryField: 'distance_metres', unit: 'm',
    formula: 'Direct distance walked in two minutes with paired pre/post vital observations.',
    fields: [field('distance_metres', 'Distance', 'number'), field('pre_test_hr', 'Pre-test heart rate', 'number', false), field('pre_test_bp', 'Pre-test blood pressure', 'text', false), field('post_test_hr', 'Post-test heart rate', 'number'), field('post_test_bp', 'Post-test blood pressure', 'text'), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  '20m_shuttle': defineSpec({
    runnerKey: '20m_shuttle', name: '20-Meter Shuttle Run (Beep Test)', measurementType: 'twenty_metre_shuttle', primaryField: 'final_level', unit: 'level',
    formula: 'Final level plus completed shuttle fraction drives the existing Ramsbottom-style VO2 estimate.',
    fields: [field('final_level', 'Final level', 'number'), field('final_shuttle', 'Final shuttle', 'number'), field('total_shuttles_completed', 'Total shuttles', 'number', false), field('rpe', 'RPE', 'number'), field('termination_reason', 'Termination reason', 'text'), field('peak_hr', 'Peak heart rate', 'number', false), field('pre_test_hr', 'Pre-test heart rate', 'number', false), field('pre_test_bp', 'Pre-test blood pressure', 'text', false), field('symptoms', 'Symptoms', 'textarea', false), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  '3015_ift': defineSpec({
    runnerKey: '3015_ift', name: '30-15 Intermittent Fitness Test', measurementType: 'thirty_fifteen_ift', primaryField: 'vift_kmh', unit: 'km/h',
    formula: 'Clinician-confirmed final VIFT with interval targets at 100% and 130% of VIFT.',
    fields: [field('vift_kmh', 'Final VIFT', 'number'), field('total_stages', 'Total stages', 'number'), field('hr_pre', 'Pre-test heart rate', 'number', false), field('bp_pre', 'Pre-test blood pressure', 'text', false), field('hr_post', 'Post-test heart rate', 'number', false), field('rpe', 'RPE', 'number', false), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  fasting_glucose: defineSpec({
    runnerKey: 'fasting_glucose', name: 'Fasting Blood Glucose', measurementType: 'fasting_blood_glucose', primaryField: 'glucose_mmol_l', unit: 'mmol/L',
    formula: 'Direct fasting glucose result classified by the existing threshold bands.',
    fields: [field('glucose_mmol_l', 'Fasting glucose', 'number'), field('fasting_hours', 'Fasting duration', 'number'), field('method', 'Collection method', 'select', true, { options: choiceOptions([['Finger-prick glucometer', 'fingerprick'], ['Venous blood sample', 'venous'], ['Other', 'other']]) }), field('current_medications', 'Current medications', 'textarea', false), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  ogtt: defineSpec({
    runnerKey: 'ogtt', name: 'Oral Glucose Tolerance Test (OGTT)', measurementType: 'OGTT', primaryField: 'two_hour_glucose_mmol_l', unit: 'mmol/L',
    formula: 'Direct two-hour glucose result classified by the existing threshold bands; optional fasting value is retained.',
    fields: [field('fasting_glucose_mmol_l', 'Fasting glucose', 'number', false), field('two_hour_glucose_mmol_l', 'Two-hour glucose', 'number'), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  hba1c: defineSpec({
    runnerKey: 'hba1c', name: 'HbA1c (Glycated Hemoglobin)', measurementType: 'hba1c', primaryField: 'hba1c_percent', unit: '%',
    formula: 'Direct HbA1c percentage classified by the existing threshold bands.',
    fields: [field('hba1c_percent', 'HbA1c', 'number'), field('notes', 'Clinical notes', 'textarea', false)],
  }),
};

export const RUNNER_SPEC_BY_KEY = deepFreeze(SPECS);
export const RUNNER_SPECS = Object.freeze(RUNNER_KEYS.map((key) => RUNNER_SPEC_BY_KEY[key]));

function fail(message) {
  throw new Error(`Extras physiological scorer: ${message}`);
}

function invariant(condition, message) {
  if (!condition) fail(message);
}

function hasValue(value) {
  return value !== '' && value !== null && value !== undefined;
}

function requiredNumber(value, label, { min = -Infinity, max = Infinity, integer = false } = {}) {
  invariant(hasValue(value), `${label} is required`);
  const number = Number(value);
  invariant(Number.isFinite(number), `${label} must be a finite number`);
  invariant(number >= min && number <= max, `${label} must be between ${min} and ${max}`);
  invariant(!integer || Number.isInteger(number), `${label} must be a whole number`);
  return number;
}

function optionalNumber(value, label, limits = {}) {
  return hasValue(value) ? requiredNumber(value, label, limits) : null;
}

function requiredText(value, label, max = NOTES_MAX) {
  const normalized = String(value ?? '').trim();
  invariant(normalized.length > 0, `${label} is required`);
  invariant(normalized.length <= max, `${label} must be ${max} characters or fewer`);
  return normalized;
}

function optionalText(value, label, max = NOTES_MAX) {
  const normalized = String(value ?? '').trim();
  invariant(normalized.length <= max, `${label} must be ${max} characters or fewer`);
  return normalized;
}

function requiredChoice(value, label, allowed) {
  const normalized = String(value ?? '').trim();
  invariant(allowed.includes(normalized), `${label} must be one of: ${allowed.join(', ')}`);
  return normalized;
}

function requiredBoolean(value, label) {
  invariant(typeof value === 'boolean', `${label} must be true or false`);
  return value;
}

function requiredArray(value, label, { min = 1, max = 100 } = {}) {
  invariant(Array.isArray(value) && value.length >= min && value.length <= max,
    `${label} must contain ${min}${min === max ? '' : ` to ${max}`} entries`);
  return value;
}

function optionalObject(value, label) {
  if (value === null || value === undefined) return {};
  invariant(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function requiredObject(value, label) {
  const object = optionalObject(value, label);
  invariant(Object.keys(object).length > 0, `${label} is required`);
  return object;
}

function bloodPressure(value, label, { required = false } = {}) {
  if (!hasValue(value)) {
    invariant(!required, `${label} is required`);
    return null;
  }
  const normalized = String(value).trim().replace(/\s+/g, '');
  const match = /^(\d{2,3})\/(\d{2,3})$/.exec(normalized);
  invariant(match, `${label} must use systolic/diastolic format`);
  const systolic = requiredNumber(match[1], `${label} systolic`, { min: 40, max: 300, integer: true });
  const diastolic = requiredNumber(match[2], `${label} diastolic`, { min: 20, max: 200, integer: true });
  invariant(systolic > diastolic, `${label} systolic must exceed diastolic`);
  return `${systolic}/${diastolic}`;
}

function round(value, digits = 2) {
  const result = Number(Number(value).toFixed(digits));
  invariant(Number.isFinite(result), 'calculated result must be finite');
  return result;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined));
}

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function assertFiniteTree(value, path = 'payload') {
  if (typeof value === 'number') invariant(Number.isFinite(value), `${path} contains a non-finite number`);
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) assertFiniteTree(nested, `${path}.${key}`);
}

function notesFrom(input, context) {
  return optionalText(input?.notes ?? context?.notes, 'Clinical notes');
}

/**
 * @param {{
 *   key: string,
 *   input: Record<string, any>,
 *   context?: Record<string, any>,
 *   result: number,
 *   notes: string,
 *   soapText: string,
 *   interpretation: string,
 *   additional?: Record<string, any>,
 *   measurementType?: string | null,
 * }} value
 */
function finish({ key, input, context = {}, result, notes, soapText, interpretation, additional = {}, measurementType = null }) {
  const spec = RUNNER_SPEC_BY_KEY[key];
  invariant(spec, `unsupported runner key ${key}`);
  invariant(Number.isFinite(result), `${key} primary result must be finite`);
  invariant(typeof soapText === 'string' && soapText.trim(), `${key} SOAP text is required`);
  invariant(typeof interpretation === 'string' && interpretation.trim(), `${key} interpretation is required`);
  const assessmentDate = String(context.assessmentDate || input.assessment_date || todayLocal()).trim();
  invariant(LOCAL_DATE.test(assessmentDate), `${key} assessment date must use YYYY-MM-DD`);
  const rawInput = clone(input);
  for (const routingKey of ['runnerKey', 'runner_key', 'scoringKey', 'scoring_key', 'assessment_date']) {
    delete rawInput[routingKey];
  }
  const additionalData = {
    measurement_type: measurementType || spec.measurementType,
    scoring_key: spec.scoringKey,
    scoring_version: spec.scoring.version,
    raw_input: rawInput,
    ...compactObject(additional),
    interpretation,
    soap_text: soapText,
    report_text: `${context.assessmentName || spec.name}\n${soapText}`,
  };
  assertFiniteTree(additionalData);
  return {
    status: 'completed',
    result_value: result,
    notes,
    assessment_date: assessmentDate,
    additional_data: additionalData,
  };
}

function normalizeHeartRate(value, label, required = false) {
  return required
    ? requiredNumber(value, label, { min: 20, max: 300, integer: true })
    : optionalNumber(value, label, { min: 20, max: 300, integer: true });
}

function normalizeSpo2(value, label, required = false) {
  return required
    ? requiredNumber(value, label, { min: 1, max: 100, integer: true })
    : optionalNumber(value, label, { min: 1, max: 100, integer: true });
}

function heartRateInterpretation(value) {
  if (value < 40) return 'Severe Bradycardia';
  if (value < 60) return 'Bradycardia';
  if (value <= 100) return 'Normal';
  if (value <= 120) return 'Mild Tachycardia';
  return 'Tachycardia';
}

function spo2Interpretation(value) {
  if (value < 90) return 'Low (Hypoxemia)';
  if (value < 95) return 'Below Normal';
  return 'Normal';
}

function bloodPressureInterpretation(systolic, diastolic) {
  if (systolic < 90 || diastolic < 60) return 'Low (Hypotension)';
  if (systolic < 120 && diastolic < 80) return 'Normal';
  if (systolic < 130 && diastolic < 80) return 'Elevated';
  if (systolic < 140 || diastolic < 90) return 'Stage 1 Hypertension';
  if (systolic < 180 || diastolic < 120) return 'Stage 2 Hypertension';
  return 'Hypertensive Crisis';
}

export function scoreHeartRate(input, context = {}) {
  const mode = requiredChoice(input?.mode, 'Heart-rate mode', ['single', 'pre_post']);
  const notes = notesFrom(input, context);
  if (mode === 'single') {
    const heartRate = normalizeHeartRate(input?.heart_rate_bpm, 'Heart rate', true);
    const interpretation = heartRateInterpretation(heartRate);
    const soapText = `• Heart Rate\n  Heart Rate: ${heartRate} bpm — ${interpretation}${notes ? `\n  Clinical Notes: ${notes}` : ''}`;
    return finish({
      key: 'heart_rate', input: { mode, heart_rate_bpm: heartRate, notes }, context,
      result: heartRate, notes, soapText, interpretation,
      additional: { heart_rate: heartRate, heart_rate_bpm: heartRate },
    });
  }

  const pre = normalizeHeartRate(input?.pre_bpm, 'Pre-exercise heart rate');
  const post = normalizeHeartRate(input?.post_bpm, 'Post-exercise heart rate');
  invariant(pre !== null || post !== null, 'pre/post heart rate requires at least one observation');
  const additionalMeasurements = (input?.additional_measurements ?? []).map((entry, index) => {
    const object = requiredObject(entry, `Additional heart-rate observation ${index + 1}`);
    return {
      label: requiredText(object.label, `Additional heart-rate observation ${index + 1} label`, 80),
      hr: normalizeHeartRate(object.hr, `Additional heart-rate observation ${index + 1}`, true),
    };
  });
  invariant(additionalMeasurements.length <= 20, 'additional heart-rate observations must not exceed 20');
  const lines = [
    pre === null ? null : `  Pre-Exercise: ${pre} bpm — ${heartRateInterpretation(pre)}`,
    post === null ? null : `  Post-Exercise: ${post} bpm — ${heartRateInterpretation(post)}`,
    ...additionalMeasurements.map((entry) => `  ${entry.label}: ${entry.hr} bpm — ${heartRateInterpretation(entry.hr)}`),
    notes ? `  Clinical Notes: ${notes}` : null,
  ].filter(Boolean);
  const interpretation = pre !== null && post !== null
    ? `Heart rate changed by ${post - pre} bpm from pre- to post-exercise.`
    : `${pre !== null ? 'Pre' : 'Post'}-exercise heart rate recorded without its pair.`;
  const soapText = `• Heart Rate (Pre/Post Exercise)\n${lines.join('\n')}\n  Interpretation: ${interpretation}`;
  return finish({
    key: 'heart_rate', input: { mode, pre_bpm: pre, post_bpm: post, additional_measurements: additionalMeasurements, notes }, context,
    result: pre ?? post, notes, soapText, interpretation,
    additional: {
      heart_rate_pre: pre,
      heart_rate_post: post,
      pre_interpretation: pre === null ? null : heartRateInterpretation(pre),
      post_interpretation: post === null ? null : heartRateInterpretation(post),
      additional_post_measures: additionalMeasurements,
      change_bpm: pre !== null && post !== null ? post - pre : null,
    },
  });
}

function scoreSpo2Protocol(input, context, key) {
  const notes = notesFrom(input, context);
  if (key === 'spo2-resting') {
    const spo2 = normalizeSpo2(input?.spo2_percent, 'SpO2', true);
    const interpretation = spo2Interpretation(spo2);
    const soapText = `• Resting Oxygen Saturation (SpO2)\n  Resting SpO2: ${spo2}% — ${interpretation}${notes ? `\n  Clinical Notes: ${notes}` : ''}`;
    return finish({
      key, input: { spo2_percent: spo2, notes }, context,
      result: spo2, notes, soapText, interpretation,
      additional: { spo2, spo2_percent: spo2, protocol: 'resting' },
    });
  }
  invariant(key === 'spo2-exercise', `unsupported SpO2 protocol ${key}`);
  const pre = normalizeSpo2(input?.pre_percent, 'Pre-exercise SpO2', true);
  const post = normalizeSpo2(input?.post_percent, 'Post-exercise SpO2', true);
  const interpretation = `SpO2 changed by ${post - pre} percentage points from pre- to post-exercise.`;
  const soapText = [
    '• Oxygen Saturation (SpO2 Pre/Post Exercise)',
    `  Pre-Exercise: ${pre}% — ${spo2Interpretation(pre)}`,
    `  Post-Exercise: ${post}% — ${spo2Interpretation(post)}`,
    `  Interpretation: ${interpretation}`,
    notes ? `  Clinical Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key, input: { pre_percent: pre, post_percent: post, notes }, context,
    result: pre, notes, soapText, interpretation,
    additional: {
      spo2_pre: pre,
      spo2_post: post,
      pre_interpretation: spo2Interpretation(pre),
      post_interpretation: spo2Interpretation(post),
      change_percentage_points: post - pre,
      protocol: 'pre_post_exercise',
    },
  });
}

export function scoreSpo2Exercise(input, context = {}) {
  return scoreSpo2Protocol(input, context, 'spo2-exercise');
}

export function scoreSpo2Resting(input, context = {}) {
  return scoreSpo2Protocol(input, context, 'spo2-resting');
}

export function scoreBloodPressure(input, context = {}) {
  const systolic = requiredNumber(input?.systolic, 'Systolic pressure', { min: 40, max: 300, integer: true });
  const diastolic = requiredNumber(input?.diastolic, 'Diastolic pressure', { min: 20, max: 200, integer: true });
  invariant(systolic > diastolic, 'systolic pressure must exceed diastolic pressure');
  const notes = notesFrom(input, context);
  const interpretation = bloodPressureInterpretation(systolic, diastolic);
  const soapText = `• Blood Pressure\n  Blood Pressure: ${systolic}/${diastolic} mmHg — ${interpretation}${notes ? `\n  Clinical Notes: ${notes}` : ''}`;
  return finish({
    key: 'blood_pressure', input: { systolic, diastolic, notes }, context,
    result: systolic, notes, soapText, interpretation,
    additional: { systolic, diastolic, blood_pressure: `${systolic}/${diastolic}` },
  });
}

const YMCA_RECOVERY_BANDS = Object.freeze({
  M: Object.freeze([
    Object.freeze({ max: 76, label: 'Excellent' }),
    Object.freeze({ max: 84, label: 'Good' }),
    Object.freeze({ max: 96, label: 'Average' }),
    Object.freeze({ max: 104, label: 'Below Average' }),
    Object.freeze({ max: 300, label: 'Poor' }),
  ]),
  F: Object.freeze([
    Object.freeze({ max: 80, label: 'Excellent' }),
    Object.freeze({ max: 88, label: 'Good' }),
    Object.freeze({ max: 100, label: 'Average' }),
    Object.freeze({ max: 108, label: 'Below Average' }),
    Object.freeze({ max: 300, label: 'Poor' }),
  ]),
});

export function scoreYmcaThreeMinuteStep(input, context = {}) {
  const age = requiredNumber(input?.age, 'Age', { min: 13, max: 100, integer: true });
  const sex = requiredChoice(input?.sex, 'Sex', ['M', 'F']);
  const stepHeight = requiredNumber(input?.step_height_cm, 'Step height', { min: 5, max: 80 });
  const restingHr = normalizeHeartRate(input?.resting_hr, 'Resting heart rate', true);
  const recoveryHr = normalizeHeartRate(input?.recovery_hr, 'Recovery heart rate', true);
  const rpe = optionalNumber(input?.rpe, 'RPE', { min: 0, max: 10, integer: true });
  const symptoms = optionalText(input?.symptoms, 'Symptoms');
  const notes = notesFrom(input, context);
  const category = YMCA_RECOVERY_BANDS[sex].find((band) => recoveryHr <= band.max)?.label;
  invariant(category, 'recovery heart rate has no classification');
  const interpretation = `${category} recovery-heart-rate category for the recorded ${sex === 'M' ? 'male' : 'female'} protocol.`;
  const soapText = [
    '• YMCA 3-Minute Step Test',
    `  Age: ${age} | Sex: ${sex === 'M' ? 'Male' : 'Female'}`,
    `  Protocol: ${stepHeight} cm step | 96 bpm cadence | 3 minutes`,
    `  Resting HR: ${restingHr} bpm | Recovery HR: ${recoveryHr} bpm`,
    rpe === null ? null : `  RPE: ${rpe}/10`,
    symptoms ? `  Symptoms: ${symptoms}` : '  Symptoms: None reported',
    `  Interpretation: ${interpretation}`,
    notes ? `  Clinical Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'ymca_3min_step',
    input: { age, sex, step_height_cm: stepHeight, resting_hr: restingHr, recovery_hr: recoveryHr, rpe, symptoms, notes },
    context, result: recoveryHr, notes, soapText, interpretation,
    additional: {
      age, sex, step_height_cm: stepHeight, resting_hr: restingHr, recovery_hr: recoveryHr,
      fitness_category: category, rpe, symptoms, cadence_bpm: 96, duration_seconds: 180,
    },
  });
}

const AEROBIC_PROTOCOLS = Object.freeze({
  ymca: Object.freeze({ name: 'YMCA 3-Minute Step Test', duration: 180 }),
  queens: Object.freeze({ name: "Queen's College Step Test", duration: 180 }),
  modified_older: Object.freeze({ name: 'Modified Older Adult Step Test', duration: 120 }),
  harvard: Object.freeze({ name: 'Harvard Step Test (Full)', duration: 300 }),
  custom: Object.freeze({ name: 'Custom Step Test', duration: null }),
});

const AEROBIC_YMCA_LABELS = Object.freeze([
  'Excellent', 'Good', 'Above Average', 'Average', 'Below Average', 'Poor', 'Very Poor',
]);
const AEROBIC_YMCA_MAXIMA = Object.freeze({
  male: Object.freeze({
    '18-25': Object.freeze([79, 89, 99, 105, 116, 130, 300]),
    '26-35': Object.freeze([81, 89, 99, 107, 118, 128, 300]),
    '36-45': Object.freeze([83, 91, 101, 111, 119, 130, 300]),
    '46-55': Object.freeze([87, 95, 104, 113, 122, 132, 300]),
    '56-65': Object.freeze([86, 97, 108, 117, 126, 135, 300]),
  }),
  female: Object.freeze({
    '18-25': Object.freeze([85, 98, 108, 117, 126, 140, 300]),
    '26-35': Object.freeze([88, 99, 111, 119, 126, 138, 300]),
    '36-45': Object.freeze([90, 102, 110, 118, 128, 140, 300]),
    '46-55': Object.freeze([94, 104, 115, 120, 129, 140, 300]),
    '56-65': Object.freeze([95, 106, 118, 126, 135, 148, 300]),
  }),
});

function aerobicAgeGroup(age) {
  if (age < 26) return '18-25';
  if (age < 36) return '26-35';
  if (age < 46) return '36-45';
  if (age < 56) return '46-55';
  return '56-65';
}

function aerobicYmcaCategory(recoveryHr, age, sex) {
  if (age === null || !['male', 'female'].includes(sex)) return null;
  const maxima = AEROBIC_YMCA_MAXIMA[sex][aerobicAgeGroup(age)];
  const index = maxima.findIndex((maximum) => recoveryHr <= maximum);
  return index < 0 ? null : AEROBIC_YMCA_LABELS[index];
}

function normalizeStepVitals(value, label, { requireHeartRate = false } = {}) {
  const source = optionalObject(value, label);
  const hr = normalizeHeartRate(source.hr, `${label} heart rate`, requireHeartRate);
  const bp = bloodPressure(source.bp, `${label} blood pressure`);
  const spo2 = normalizeSpo2(source.spo2, `${label} SpO2`);
  const rpe = optionalNumber(source.rpe, `${label} RPE`, { min: 0, max: 10, integer: true });
  const dyspnea = optionalNumber(source.dyspnea, `${label} dyspnoea`, { min: 0, max: 10, integer: true });
  return { hr, bp, spo2, rpe, dyspnea };
}

export function scoreAerobicStep(input, context = {}) {
  const protocolKey = requiredChoice(input?.protocol_key, 'Step-test protocol', Object.keys(AEROBIC_PROTOCOLS));
  const protocol = AEROBIC_PROTOCOLS[protocolKey];
  const durationSeconds = requiredNumber(input?.duration_seconds, 'Completed duration', { min: 1, max: 1800, integer: true });
  const completedFull = requiredBoolean(input?.completed_full_protocol, 'Full-protocol status');
  if (completedFull && protocol.duration !== null) {
    invariant(durationSeconds === protocol.duration, 'completed protocol duration must equal the selected protocol duration');
  }
  const stopReason = requiredText(input?.stop_reason, 'Stop reason', 200);
  const stepHeight = requiredNumber(input?.step_height_cm, 'Step height', { min: 5, max: 80 });
  const cadence = requiredNumber(input?.cadence_steps_per_min, 'Cadence', { min: 20, max: 240, integer: true });
  const age = optionalNumber(input?.age, 'Age', { min: 13, max: 100, integer: true });
  const sex = hasValue(input?.sex) ? requiredChoice(input.sex, 'Sex', ['male', 'female']) : null;
  const preVitals = normalizeStepVitals(input?.pre_vitals, 'Pre-test vitals');
  const postVitals = normalizeStepVitals(input?.post_vitals, 'Post-test vitals', { requireHeartRate: true });
  const recoverySource = requiredObject(input?.recovery, 'Recovery observations');
  const recovery = {
    hr1: normalizeHeartRate(recoverySource.hr1, 'One-minute recovery heart rate', true),
    hr2: normalizeHeartRate(recoverySource.hr2, 'Two-minute recovery heart rate'),
    hr3: normalizeHeartRate(recoverySource.hr3, 'Three-minute recovery heart rate'),
    dyspnea: optionalNumber(recoverySource.dyspnea, 'Recovery dyspnoea', { min: 0, max: 10, integer: true }),
    fatigue: optionalNumber(recoverySource.fatigue, 'Recovery fatigue', { min: 0, max: 10, integer: true }),
    dizziness: recoverySource.dizziness === undefined ? false : requiredBoolean(recoverySource.dizziness, 'Recovery dizziness'),
    chestDiscomfort: recoverySource.chestDiscomfort === undefined ? false : requiredBoolean(recoverySource.chestDiscomfort, 'Recovery chest discomfort'),
  };
  const duringSource = optionalObject(input?.during_symptoms, 'During-test symptoms');
  const duringSymptoms = {
    rpe: optionalNumber(duringSource.rpe, 'During-test RPE', { min: 0, max: 10, integer: true }),
    dyspnea: optionalNumber(duringSource.dyspnea, 'During-test dyspnoea', { min: 0, max: 10, integer: true }),
    pain: optionalNumber(duringSource.pain, 'During-test pain', { min: 0, max: 10, integer: true }),
    symptoms: (duringSource.symptoms ?? []).map((value, index) => optionalText(value, `Symptom ${index + 1}`, 200)).filter(Boolean),
  };
  invariant(duringSymptoms.symptoms.length <= 30, 'during-test symptoms must not exceed 30 entries');
  const setup = clone(optionalObject(input?.setup, 'Test setup'));
  const notes = notesFrom(input, context);
  const hrRecovery = postVitals.hr - recovery.hr1;
  const ymcaCategory = ['ymca', 'modified_older'].includes(protocolKey)
    ? aerobicYmcaCategory(recovery.hr1, age, sex)
    : null;
  const vo2 = protocolKey === 'queens'
    ? round((sex === 'male' ? 111.33 - (0.42 * recovery.hr1) : 65.81 - (0.1847 * recovery.hr1)), 1)
    : null;
  if (protocolKey === 'queens') invariant(sex !== null, "Queen's protocol requires sex for the VO2 estimate");
  let harvardIndex = null;
  let harvardClass = null;
  if (protocolKey === 'harvard') {
    invariant(recovery.hr2 !== null && recovery.hr3 !== null,
      'Harvard protocol requires one-, two- and three-minute recovery heart rates');
    harvardIndex = round((durationSeconds * 100) / (2 * (recovery.hr1 + recovery.hr2 + recovery.hr3)), 1);
    harvardClass = harvardIndex > 96 ? 'Excellent' : harvardIndex >= 83 ? 'Good'
      : harvardIndex >= 68 ? 'High Average' : harvardIndex >= 54 ? 'Low Average' : 'Poor';
  }
  const flags = [
    !completedFull ? 'Incomplete protocol — reduced test validity' : null,
    ymcaCategory && ['Below Average', 'Poor', 'Very Poor'].includes(ymcaCategory)
      ? `Reduced aerobic fitness — ${ymcaCategory}` : null,
    hrRecovery < 12 ? 'Delayed HR recovery — impaired cardiovascular recovery' : null,
    duringSymptoms.dyspnea !== null && duringSymptoms.dyspnea >= 5 ? 'Dyspnoea-limited performance' : null,
    duringSymptoms.symptoms.includes('Chest pain') ? 'Chest pain during test — urgent review required' : null,
    setup.balanceConcern === true ? 'Balance limitation noted — falls risk consideration' : null,
    recovery.dizziness ? 'Dizziness in recovery — monitor closely' : null,
    recovery.chestDiscomfort ? 'Chest discomfort in recovery — urgent review' : null,
    vo2 !== null && vo2 < 35 ? `Low estimated VO2max (${vo2} mL/kg/min)` : null,
    'Review aerobic conditioning program',
  ].filter(Boolean);
  const scoreText = ymcaCategory ? ` Recovery HR classification: ${ymcaCategory}.`
    : vo2 !== null ? ` Estimated VO2max: ${vo2} mL/kg/min.`
      : harvardIndex !== null ? ` Harvard Fitness Index: ${harvardIndex} (${harvardClass}).` : '';
  const interpretation = `${protocol.name} ${completedFull ? 'completed for the full protocol duration' : `stopped after ${durationSeconds} seconds`} due to ${stopReason}.${scoreText} Heart-rate recovery was ${hrRecovery} bpm (${hrRecovery >= 12 ? 'adequate' : 'reduced'}).`;
  const soapText = [
    `• Step Test (Aerobic Step Test) — ${protocol.name}`,
    `  Duration: ${durationSeconds}s — ${completedFull ? 'Full protocol completed' : 'Early termination'}`,
    `  Stopped due to: ${stopReason}`,
    preVitals.hr === null ? null : `  Pre-test HR: ${preVitals.hr} bpm${preVitals.bp ? ` | BP: ${preVitals.bp}` : ''}${preVitals.spo2 === null ? '' : ` | SpO2: ${preVitals.spo2}%`}`,
    `  Post-test HR: ${postVitals.hr} bpm${postVitals.bp ? ` | BP: ${postVitals.bp}` : ''}${postVitals.spo2 === null ? '' : ` | SpO2: ${postVitals.spo2}%`}`,
    `  Recovery HR: 1-min ${recovery.hr1} bpm${recovery.hr2 === null ? '' : ` | 2-min ${recovery.hr2} bpm`}${recovery.hr3 === null ? '' : ` | 3-min ${recovery.hr3} bpm`}`,
    `  HR Recovery: ${hrRecovery} bpm`,
    ymcaCategory ? `  Aerobic Fitness Category: ${ymcaCategory}` : null,
    vo2 === null ? null : `  Estimated VO2max: ${vo2} mL/kg/min`,
    harvardIndex === null ? null : `  Harvard Fitness Index: ${harvardIndex} (${harvardClass})`,
    duringSymptoms.symptoms.length ? `  Symptoms during: ${duringSymptoms.symptoms.join(', ')}` : null,
    `  Interpretation: ${interpretation}`,
    notes ? `  Clinical Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'aerobic_step',
    input: { protocol_key: protocolKey, duration_seconds: durationSeconds, completed_full_protocol: completedFull, stop_reason: stopReason, step_height_cm: stepHeight, cadence_steps_per_min: cadence, age, sex, pre_vitals: preVitals, post_vitals: postVitals, recovery, during_symptoms: duringSymptoms, setup, notes },
    context, result: recovery.hr1, notes, soapText, interpretation,
    additional: { protocol: protocol.name, protocol_key: protocolKey, duration_completed: durationSeconds, completed_full_protocol: completedFull, stop_reason: stopReason, step_height_cm: stepHeight, cadence_steps_per_min: cadence, pre_vitals: preVitals, post_vitals: postVitals, recovery, hr_recovery_bpm: hrRecovery, during_symptoms: duringSymptoms, setup, classification: ymcaCategory, vo2max_estimated: vo2, harvard_index: harvardIndex, harvard_classification: harvardClass, flags },
  });
}

export function scoreChester(input, context = {}) {
  const age = requiredNumber(input?.age, 'Age', { min: 13, max: 100, integer: true });
  const stepHeight = requiredNumber(input?.step_height_cm, 'Step height', { min: 5, max: 80 });
  const sourceStages = requiredArray(input?.stages, 'Completed stages', { min: 1, max: 5 });
  const stages = sourceStages.map((entry, index) => {
    const source = requiredObject(entry, `Stage ${index + 1}`);
    const stage = requiredNumber(source.stage, `Stage ${index + 1} number`, { min: 1, max: 5, integer: true });
    invariant(stage === index + 1, 'Chester stages must be ordered and contiguous');
    return {
      stage,
      hr: normalizeHeartRate(source.hr, `Stage ${stage} heart rate`, true),
      rpe: requiredNumber(source.rpe, `Stage ${stage} RPE`, { min: 0, max: 20 }),
    };
  });
  const notes = notesFrom(input, context);
  const finalStage = stages.at(-1);
  const predictedMaxHr = 220 - age;
  invariant(predictedMaxHr > 0, 'age-predicted maximum heart rate must be positive');
  const targetRange = [round(predictedMaxHr * 0.7, 0), round(predictedMaxHr * 0.8, 0)];
  const interpretation = finalStage.hr >= targetRange[0]
    ? `Final-stage heart rate entered the 70–80% age-predicted target range (${targetRange[0]}–${targetRange[1]} bpm).`
    : `Final-stage heart rate remained below the 70% age-predicted target (${targetRange[0]} bpm).`;
  const soapText = [
    `• Chester Step Test (Step Height: ${stepHeight} cm)`,
    ...stages.map((stage) => `  Stage ${stage.stage}: HR ${stage.hr} bpm, RPE ${stage.rpe}`),
    `  Interpretation: ${interpretation}`,
    notes ? `  Clinical Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'chester', input: { age, step_height_cm: stepHeight, stages, notes }, context,
    result: finalStage.hr, notes, soapText, interpretation,
    additional: { stages, stepHeight, step_height_cm: stepHeight, predictedMaxHR: predictedMaxHr, predicted_max_hr: predictedMaxHr, target_hr_range: targetRange, stagesCompleted: stages.length, stages_completed: stages.length, final_stage_hr: finalStage.hr },
  });
}

function eswtEnduranceCategory(seconds) {
  if (seconds < 120) return 'Very low (<120s) — significant limitation';
  if (seconds < 300) return 'Reduced (120–300s) — mild-moderate limitation';
  if (seconds < 600) return 'Moderate (300–600s) — reasonable tolerance';
  return 'Better endurance (>600s) — improved functional tolerance';
}

export function scoreEswt(input, context = {}) {
  const timeElapsed = requiredNumber(input?.time_elapsed_seconds, 'Endurance time', { min: 1, max: 7200, integer: true });
  const speed = requiredNumber(input?.selected_speed_kmh, 'Selected speed', { min: 0.1, max: 20 });
  const shuttles = requiredNumber(input?.shuttles_completed, 'Shuttles completed', { min: 0, max: 10000, integer: true });
  const stopReason = requiredText(input?.stop_reason, 'Stop reason', 200);
  const preSource = optionalObject(input?.pre_test, 'Pre-test observations');
  const postSource = optionalObject(input?.post_test, 'Post-test observations');
  const preTest = {
    heart_rate: normalizeHeartRate(preSource.heart_rate, 'Pre-test heart rate'),
    blood_pressure: bloodPressure(preSource.blood_pressure, 'Pre-test blood pressure'),
    spo2: normalizeSpo2(preSource.spo2, 'Pre-test SpO2'),
    dyspnoea: optionalNumber(preSource.dyspnoea, 'Pre-test dyspnoea', { min: 0, max: 10 }),
    leg_fatigue: optionalNumber(preSource.leg_fatigue, 'Pre-test leg fatigue', { min: 0, max: 10 }),
    chest_pain: hasValue(preSource.chest_pain) ? requiredChoice(preSource.chest_pain, 'Pre-test chest pain', ['yes', 'no']) : null,
    dizziness: hasValue(preSource.dizziness) ? requiredChoice(preSource.dizziness, 'Pre-test dizziness', ['yes', 'no']) : null,
    recent_illness: hasValue(preSource.recent_illness) ? requiredChoice(preSource.recent_illness, 'Recent illness', ['yes', 'no']) : null,
    walking_aid: hasValue(preSource.walking_aid) ? requiredChoice(preSource.walking_aid, 'Walking aid', ['yes', 'no']) : null,
    oxygen_therapy: hasValue(preSource.oxygen_therapy) ? requiredChoice(preSource.oxygen_therapy, 'Oxygen therapy', ['yes', 'no']) : null,
    notes: optionalText(preSource.notes, 'Pre-test notes'),
  };
  const postTest = {
    heart_rate: normalizeHeartRate(postSource.heart_rate, 'Post-test heart rate'),
    blood_pressure: bloodPressure(postSource.blood_pressure, 'Post-test blood pressure'),
    spo2: normalizeSpo2(postSource.spo2, 'Post-test SpO2'),
    dyspnoea: optionalNumber(postSource.dyspnoea, 'Post-test dyspnoea', { min: 0, max: 10 }),
    leg_fatigue: optionalNumber(postSource.leg_fatigue, 'Post-test leg fatigue', { min: 0, max: 10 }),
    adverse_events: optionalText(postSource.adverse_events, 'Adverse events'),
  };
  const iswtSource = optionalObject(input?.iswt, 'ISWT context');
  const iswtCompleted = hasValue(iswtSource.completed)
    ? requiredChoice(iswtSource.completed, 'ISWT completion', ['yes', 'no']) : 'no';
  const iswtResult = iswtCompleted === 'yes'
    ? requiredNumber(iswtSource.result_metres, 'ISWT result', { min: 1, max: 10000 }) : null;
  const speedReason = optionalText(input?.speed_reason, 'Speed-selection reason', 500);
  const notes = notesFrom(input, context);
  const estimatedDistance = round(speed * (timeElapsed / 3600) * 1000, 0);
  const interpretation = eswtEnduranceCategory(timeElapsed);
  const minutes = Math.floor(timeElapsed / 60);
  const seconds = String(timeElapsed % 60).padStart(2, '0');
  const soapText = [
    '• Endurance Shuttle Walk Test (ESWT)',
    `  Selected Speed: ${speed} km/h${speedReason ? ` (${speedReason})` : ''}`,
    `  Duration: ${minutes}:${seconds} (${timeElapsed} seconds)`,
    `  Estimated Distance: ${estimatedDistance} m | Shuttles: ${shuttles}`,
    `  Stop Reason: ${stopReason}`,
    preTest.heart_rate === null ? null : `  Pre-Test HR: ${preTest.heart_rate} bpm${preTest.blood_pressure ? ` | BP: ${preTest.blood_pressure}` : ''}${preTest.spo2 === null ? '' : ` | SpO2: ${preTest.spo2}%`}`,
    postTest.heart_rate === null ? null : `  Post-Test HR: ${postTest.heart_rate} bpm${postTest.blood_pressure ? ` | BP: ${postTest.blood_pressure}` : ''}${postTest.spo2 === null ? '' : ` | SpO2: ${postTest.spo2}%`}`,
    postTest.adverse_events ? `  Adverse Events: ${postTest.adverse_events}` : '  Adverse Events: None recorded',
    `  Interpretation: ${interpretation}`,
    notes ? `  Clinical Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'eswt',
    input: { time_elapsed_seconds: timeElapsed, selected_speed_kmh: speed, shuttles_completed: shuttles, stop_reason: stopReason, speed_reason: speedReason, pre_test: preTest, post_test: postTest, iswt: { completed: iswtCompleted, result_metres: iswtResult }, notes },
    context, result: timeElapsed, notes, soapText, interpretation,
    additional: { endurance_time_seconds: timeElapsed, endurance_time_display: `${minutes}:${seconds}`, estimated_distance_metres: estimatedDistance, shuttles_completed: shuttles, iswt_completed: iswtCompleted, iswt_result: iswtResult, selected_speed: speed, selected_speed_kmh: speed, speed_reason: speedReason, stop_reason: stopReason, pre_test: preTest, post_test: postTest, post_hr: postTest.heart_rate, post_spo2: postTest.spo2, post_bp: postTest.blood_pressure, post_dyspnoea: postTest.dyspnoea, post_leg_fatigue: postTest.leg_fatigue, adverse_events: postTest.adverse_events },
  });
}

export function scoreHeight(input, context = {}) {
  const height = requiredNumber(input?.height_cm, 'Height', { min: 30, max: 300 });
  const notes = notesFrom(input, context);
  const interpretation = `Standing height recorded as ${height} cm.`;
  const soapText = `• Height Measurement\n  Result: ${height} cm${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({
    key: 'height_measurement', input: { height_cm: height, notes }, context,
    result: height, notes, soapText, interpretation,
    additional: {
      height_cm: height,
      protocol: ['Client removes shoes and bulky hair accessories.', 'Stand with heels together, back straight, eyes forward.', 'Lower headpiece to crown and record to nearest 0.1 cm.'],
      equipment: 'Stadiometer or wall-mounted measuring tape with right-angle headpiece',
    },
  });
}

export function scoreWeight(input, context = {}) {
  const measured = requiredNumber(input?.measured_kg, 'Measured weight', { min: 1, max: 1000 });
  const adjustment = requiredNumber(input?.clothing_adjustment_kg, 'Clothing adjustment', { min: 0, max: 50 });
  invariant(adjustment < measured, 'clothing adjustment must be less than measured weight');
  const adjusted = round(measured - adjustment, 1);
  invariant(adjusted > 0, 'adjusted weight must be positive');
  const notes = notesFrom(input, context);
  const interpretation = `Adjusted body weight is ${adjusted} kg after a ${adjustment} kg clothing deduction.`;
  const soapText = [
    '• Body Weight Measurement',
    `  Measured Weight: ${measured} kg`,
    adjustment > 0 ? `  Clothing Deduction: ${adjustment} kg` : null,
    `  Adjusted Weight: ${adjusted} kg`,
    `  Interpretation: ${interpretation}`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'weight_measure', input: { measured_kg: measured, clothing_adjustment_kg: adjustment, notes }, context,
    result: adjusted, notes, soapText, interpretation,
    additional: { weight_kg: adjusted, measured_kg: measured, clothing_adjustment_kg: adjustment, adjusted_weight_kg: adjusted },
  });
}

export function scoreWaistCircumference(input, context = {}) {
  const waist = requiredNumber(input?.waist_circumference_cm, 'Waist circumference', { min: 20, max: 300 });
  const sex = requiredChoice(input?.sex, 'Sex', ['male', 'female']);
  const notes = notesFrom(input, context);
  const risk = sex === 'male'
    ? waist >= 102 ? 'Substantially increased risk' : waist >= 94 ? 'Increased risk' : 'Normal risk'
    : waist >= 88 ? 'Substantially increased risk' : waist >= 80 ? 'Increased risk' : 'Normal risk';
  const interpretation = `${risk} for the recorded ${sex} threshold set.`;
  const soapText = `• Waist Circumference Measurement\n  Result: ${waist} cm\n  Risk Category: ${risk}${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({
    key: 'waist_circ', input: { waist_circumference_cm: waist, sex, notes }, context,
    result: waist, notes, soapText, interpretation,
    additional: { waist_circumference: waist, waist_circumference_cm: waist, sex, risk_category: risk },
  });
}

export function scoreTriLevelArm(input, context = {}) {
  const source = requiredArray(input?.stage_heart_rates, 'Stage heart rates', { min: 3, max: 3 });
  const stageHeartRates = source.map((value, index) =>
    normalizeHeartRate(value, `Stage ${index + 1} heart rate`));
  invariant(stageHeartRates.some((value) => value !== null), 'at least one stage heart rate is required');
  const lastRecorded = [...stageHeartRates].reverse().find((value) => value !== null);
  const average = round(stageHeartRates.filter((value) => value !== null)
    .reduce((total, value) => total + value, 0) / stageHeartRates.filter((value) => value !== null).length, 1);
  const rpe = optionalNumber(input?.rpe, 'RPE', { min: 6, max: 20, integer: true });
  const notes = notesFrom(input, context);
  const interpretation = `Final recorded stage heart rate was ${lastRecorded} bpm; mean recorded stage heart rate was ${average} bpm.`;
  const soapText = [
    '• Tri-Level Arm Ergometer Test',
    '  Protocol: 3 stages × 2 min | 25 W → 50 W → 75 W | 50 rpm',
    ...stageHeartRates.map((value, index) => `  Stage ${index + 1} HR: ${value === null ? 'Not recorded' : `${value} bpm`}`),
    rpe === null ? null : `  RPE (Borg 6–20): ${rpe}`,
    `  Interpretation: ${interpretation}`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'tri_arm', input: { stage_heart_rates: stageHeartRates, rpe, notes }, context,
    result: lastRecorded, notes, soapText, interpretation,
    additional: { stage1_hr: stageHeartRates[0], stage2_hr: stageHeartRates[1], stage3_hr: stageHeartRates[2], stage_heart_rates: stageHeartRates, average_stage_hr: average, final_stage_hr: lastRecorded, rpe },
  });
}

const TECUMSEH_NORMS = Object.freeze({
  '20-29': Object.freeze({ male: Object.freeze([78, 89, 99]), female: Object.freeze([82, 95, 109]) }),
  '30-39': Object.freeze({ male: Object.freeze([80, 91, 101]), female: Object.freeze([83, 97, 111]) }),
  '40-49': Object.freeze({ male: Object.freeze([84, 95, 106]), female: Object.freeze([90, 101, 113]) }),
  '50-59': Object.freeze({ male: Object.freeze([88, 100, 112]), female: Object.freeze([94, 106, 118]) }),
  '60+': Object.freeze({ male: Object.freeze([90, 102, 115]), female: Object.freeze([96, 109, 122]) }),
});

export function scoreTecumseh(input, context = {}) {
  const preHr = normalizeHeartRate(input?.pre_hr, 'Pre-exercise heart rate');
  const recoveryHr = normalizeHeartRate(input?.recovery_hr, 'Recovery heart rate', true);
  const ageGroup = requiredChoice(input?.age_group, 'Age group', Object.keys(TECUMSEH_NORMS));
  const sex = requiredChoice(input?.sex, 'Sex', ['male', 'female']);
  const notes = notesFrom(input, context);
  const [excellent, good, average] = TECUMSEH_NORMS[ageGroup][sex];
  const category = recoveryHr <= excellent ? 'Excellent' : recoveryHr <= good ? 'Good'
    : recoveryHr <= average ? 'Average' : 'Poor';
  const interpretation = `${category} aerobic-fitness category for ${ageGroup} ${sex} recovery-heart-rate bands.`;
  const soapText = [
    '• Tecumseh Step Test',
    '  Protocol: 20 cm step, 24 steps/min (96 bpm metronome), 3 minutes',
    `  Pre-Exercise HR: ${preHr === null ? 'Not recorded' : `${preHr} bpm`}`,
    `  Recovery HR: ${recoveryHr} bpm`,
    `  Age Group: ${ageGroup} | Sex: ${sex}`,
    `  Classification: ${category} aerobic fitness`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'tecumseh', input: { pre_hr: preHr, recovery_hr: recoveryHr, age_group: ageGroup, sex, notes }, context,
    result: recoveryHr, notes, soapText, interpretation,
    additional: { pre_hr: preHr, recovery_hr: recoveryHr, age_group: ageGroup, gender: sex, sex, classification: category },
  });
}

export function scoreBalke(input, context = {}) {
  const totalSeconds = requiredNumber(input?.total_seconds, 'Total duration', { min: 1, max: 3600, integer: true });
  const sex = requiredChoice(input?.sex, 'Sex', ['male', 'female']);
  const clientAge = optionalNumber(input?.client_age, 'Client age', { min: 13, max: 100, integer: true });
  const preSource = optionalObject(input?.pre_test, 'Pre-test observations');
  const preTest = {
    heart_rate: normalizeHeartRate(preSource.heart_rate, 'Pre-test heart rate'),
    blood_pressure: bloodPressure(preSource.blood_pressure, 'Pre-test blood pressure'),
    rpe: optionalNumber(preSource.rpe, 'Pre-test RPE', { min: 6, max: 20, integer: true }),
  };
  const bodyWeight = optionalNumber(input?.body_weight_kg, 'Body weight', { min: 1, max: 1000 });
  const peakRpe = optionalNumber(input?.peak_rpe, 'Peak RPE', { min: 6, max: 20, integer: true });
  const endReason = requiredText(input?.end_reason, 'End reason', 500);
  const sourceHeartRates = optionalObject(input?.stage_heart_rates, 'Stage heart rates');
  const stageHeartRates = {};
  for (const [minuteKey, value] of Object.entries(sourceHeartRates)) {
    const minute = requiredNumber(minuteKey, 'Stage minute', { min: 1, max: 25, integer: true });
    stageHeartRates[String(minute)] = normalizeHeartRate(value, `Minute ${minute} heart rate`, true);
  }
  const notes = notesFrom(input, context);
  const totalMinutes = round(totalSeconds / 60, 2);
  const vo2 = round(sex === 'female'
    ? (1.38 * totalMinutes) + 5.22
    : (1.387 * totalMinutes) + 10.833, 1);
  invariant(vo2 > 0, 'estimated VO2 must be positive');
  const agePredictedHrMax = clientAge === null ? null : 220 - clientAge;
  const lastStageCompleted = Math.floor(totalMinutes);
  const lastGrade = Math.min(lastStageCompleted, 25);
  const interpretation = `${totalMinutes.toFixed(2)} minutes completed with an estimated VO2max of ${vo2.toFixed(1)} mL/kg/min; test ended due to ${endReason}.`;
  const minutesDisplay = Math.floor(totalSeconds / 60);
  const secondsDisplay = String(totalSeconds % 60).padStart(2, '0');
  const soapText = [
    `• Balke-Ware Treadmill Test: ${totalMinutes.toFixed(2)} minutes (${minutesDisplay}:${secondsDisplay})`,
    clientAge === null ? null : `  Client Age: ${clientAge} years | Age-predicted HRmax: ${agePredictedHrMax} bpm`,
    preTest.heart_rate === null && !preTest.blood_pressure ? null : `  Pre-test: HR ${preTest.heart_rate ?? '—'} bpm, BP ${preTest.blood_pressure ?? '—'}${preTest.rpe === null ? '' : `, RPE ${preTest.rpe}/20`}`,
    bodyWeight === null ? null : `  Body Weight: ${bodyWeight} kg`,
    `  Estimated VO2max: ${vo2.toFixed(1)} mL/kg/min (${sex})`,
    `  Protocol: 3.3 mph, +1% grade/min, last grade ${lastGrade}%`,
    peakRpe === null ? null : `  Peak RPE: ${peakRpe}/20`,
    `  Test Stopped: ${endReason}`,
    ...Object.entries(stageHeartRates).map(([minute, heartRate]) => `  Minute ${minute} (${Math.min(Number(minute), 25)}% grade): ${heartRate} bpm`),
    `  Interpretation: ${interpretation}`,
    notes ? `  Clinical Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'balke',
    input: { total_seconds: totalSeconds, sex, client_age: clientAge, pre_test: preTest, body_weight_kg: bodyWeight, peak_rpe: peakRpe, end_reason: endReason, stage_heart_rates: stageHeartRates, notes },
    context, result: totalMinutes, notes, soapText, interpretation,
    additional: { total_time_minutes: totalMinutes, total_time_formatted: `${minutesDisplay}:${secondsDisplay}`, sex, client_age: clientAge, age_predicted_hrmax: agePredictedHrMax, pre_test_hr: preTest.heart_rate, pre_test_bp: preTest.blood_pressure, pre_test_rpe: preTest.rpe, body_weight_kg: bodyWeight, estimated_vo2max: vo2, peak_rpe: peakRpe, end_reason: endReason, stage_heart_rates: stageHeartRates, last_stage_completed: lastStageCompleted, last_grade_pct: lastGrade },
  });
}

function normalizeModifiedBruceVitals(value, label, { post = false } = {}) {
  const source = requiredObject(value, label);
  return {
    heartRate: normalizeHeartRate(source.heartRate ?? source.heart_rate, `${label} heart rate`, true),
    bloodPressure: bloodPressure(source.bloodPressure ?? source.blood_pressure, `${label} blood pressure`, { required: true }),
    ...(post ? {} : {
      weight: optionalNumber(source.weight, `${label} weight`, { min: 1, max: 1000 }),
      height: optionalNumber(source.height, `${label} height`, { min: 30, max: 300 }),
    }),
    ...(post ? { reasonForStop: optionalText(source.reasonForStop ?? source.reason_for_stop, `${label} reason for stop`, 500) } : {}),
  };
}

function normalizeModifiedBruceStages(value) {
  return requiredArray(value, 'Modified Bruce stages', { min: 1, max: 9 }).map((entry, index) => {
    const source = requiredObject(entry, `Modified Bruce stage ${index + 1}`);
    const stage = requiredNumber(source.stage, `Stage ${index + 1} number`, { min: 1, max: 9, integer: true });
    invariant(stage === index + 1, 'Modified Bruce stages must be ordered and contiguous');
    const rpe = source.rpe === '-' ? null : optionalNumber(source.rpe, `Stage ${stage} RPE`, { min: 0, max: 20 });
    return {
      stage,
      speed: requiredNumber(source.speed, `Stage ${stage} speed`, { min: 0.1, max: 15 }),
      grade: requiredNumber(source.grade, `Stage ${stage} grade`, { min: 0, max: 40 }),
      duration: requiredNumber(source.duration, `Stage ${stage} duration`, { min: 1, max: 1800, integer: true }),
      heartRate: normalizeHeartRate(source.heartRate ?? source.heart_rate, `Stage ${stage} heart rate`, true),
      rpe,
    };
  });
}

export function scoreModifiedBruce(input, context = {}) {
  const stageData = normalizeModifiedBruceStages(input?.stage_data);
  const preTestVitals = normalizeModifiedBruceVitals(input?.pre_test_vitals, 'Pre-test vitals');
  const postTestVitals = normalizeModifiedBruceVitals(input?.post_test_vitals, 'Post-test vitals', { post: true });
  const stopReason = requiredText(input?.stop_reason ?? postTestVitals.reasonForStop, 'Stop reason', 500);
  const notes = notesFrom(input, context);
  const totalTime = stageData.reduce((total, stage) => total + stage.duration, 0);
  const finalStage = stageData.at(-1);
  const recovery = Math.max(0, finalStage.heartRate - postTestVitals.heartRate);
  const tolerance = finalStage.stage >= 5 ? 'Good exercise tolerance achieved'
    : finalStage.stage >= 3 ? 'Moderate exercise tolerance' : 'Limited exercise tolerance';
  const interpretation = `${finalStage.stage}/9 stages completed; ${tolerance.toLowerCase()}; post-test heart-rate recovery was ${recovery} bpm.`;
  const stageLines = stageData.map((stage) =>
    `  Stage ${stage.stage}: ${stage.speed} mph @ ${stage.grade}% — HR ${stage.heartRate} bpm, Time ${stage.duration}s${stage.rpe === null ? '' : `, RPE ${stage.rpe}`}`);
  const soapText = [
    '• Modified Bruce Protocol Test',
    `  Total Duration: ${totalTime} seconds (${round(totalTime / 60, 1)} minutes)`,
    `  Stages Completed: ${finalStage.stage} of 9`,
    `  Stop Reason: ${stopReason}`,
    `  Pre-Test: HR ${preTestVitals.heartRate} bpm | BP ${preTestVitals.bloodPressure}${preTestVitals.weight === null ? '' : ` | Weight ${preTestVitals.weight} kg`}${preTestVitals.height === null ? '' : ` | Height ${preTestVitals.height} cm`}`,
    ...stageLines,
    `  Post-Test: HR ${postTestVitals.heartRate} bpm | BP ${postTestVitals.bloodPressure}`,
    `  Heart Rate Recovery: ${recovery} bpm`,
    `  Interpretation: ${interpretation}`,
    notes ? `  Additional Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'modified_bruce', input: { stage_data: stageData, pre_test_vitals: preTestVitals, post_test_vitals: postTestVitals, stop_reason: stopReason, notes },
    context, result: finalStage.stage, notes, soapText, interpretation,
    additional: { stageData, stage_data: stageData, preTestVitals, pre_test_vitals: preTestVitals, postTestVitals, post_test_vitals: postTestVitals, totalTime, total_time_seconds: totalTime, maxStage: finalStage.stage, max_stage: finalStage.stage, final_stage_hr: finalStage.heartRate, heart_rate_recovery: recovery, stop_reason: stopReason, tolerance },
  });
}

const ONE_RM_NORMS = Object.freeze({
  male: Object.freeze([
    Object.freeze({ min: 0, max: 1, label: 'Untrained' }),
    Object.freeze({ min: 1, max: 1.3, label: 'Novice' }),
    Object.freeze({ min: 1.3, max: 1.6, label: 'Intermediate' }),
    Object.freeze({ min: 1.6, max: Infinity, label: 'Advanced' }),
  ]),
  female: Object.freeze([
    Object.freeze({ min: 0, max: 0.7, label: 'Untrained' }),
    Object.freeze({ min: 0.7, max: 0.9, label: 'Novice' }),
    Object.freeze({ min: 0.9, max: 1.1, label: 'Intermediate' }),
    Object.freeze({ min: 1.1, max: Infinity, label: 'Advanced' }),
  ]),
});

function kilograms(value, unit) {
  return unit === 'lb' ? value * 0.453592 : value;
}

export function scoreOneRm(input, context = {}) {
  const exercise = requiredText(input?.exercise_tested, 'Exercise tested', 200);
  const equipment = requiredText(input?.equipment_type, 'Equipment type', 200);
  const units = requiredChoice(input?.units, 'Load unit', ['kg', 'lb']);
  const oneRmLoad = requiredNumber(input?.one_rm_load, '1RM load', { min: 0.1, max: 5000 });
  const bodyMass = optionalNumber(input?.body_mass, 'Body mass', { min: 1, max: 1000 });
  const bodyMassUnits = bodyMass === null ? (hasValue(input?.body_mass_units)
    ? requiredChoice(input.body_mass_units, 'Body-mass unit', ['kg', 'lb']) : null)
    : requiredChoice(input?.body_mass_units, 'Body-mass unit', ['kg', 'lb']);
  const sex = hasValue(input?.sex) ? requiredChoice(input.sex, 'Sex', ['male', 'female']) : null;
  const attempts = (input?.attempts ?? []).map((entry, index) => {
    const source = requiredObject(entry, `1RM attempt ${index + 1}`);
    return {
      attemptNumber: requiredNumber(source.attemptNumber ?? index + 1, `Attempt ${index + 1} number`, { min: 1, max: 100, integer: true }),
      load: requiredNumber(source.load, `Attempt ${index + 1} load`, { min: 0.1, max: 5000 }),
      success: requiredBoolean(source.success, `Attempt ${index + 1} success`),
      techniqueOk: requiredBoolean(source.techniqueOk, `Attempt ${index + 1} technique status`),
      notes: optionalText(source.notes, `Attempt ${index + 1} notes`, 1000),
    };
  });
  invariant(attempts.length <= 100, '1RM attempts must not exceed 100');
  const successfulLoads = attempts.filter((attempt) => attempt.success).map((attempt) => attempt.load);
  if (successfulLoads.length) {
    invariant(oneRmLoad === Math.max(...successfulLoads),
      '1RM load must equal the highest successful recorded attempt');
  }
  const relativeStrength = bodyMass === null ? null
    : round(kilograms(oneRmLoad, units) / kilograms(bodyMass, bodyMassUnits), 4);
  const normativeLabel = relativeStrength === null || sex === null
    ? 'Normative comparison unavailable (missing body mass and/or sex)'
    : ONE_RM_NORMS[sex].find((band) => relativeStrength >= band.min && relativeStrength < band.max)?.label
      ?? 'Outside normative range';
  const assistiveConsiderations = optionalText(input?.assistive_considerations, 'Assistive considerations');
  const romStandard = optionalText(input?.rom_standard_used, 'ROM standard', 1000);
  const machineSettings = optionalText(input?.machine_settings, 'Machine settings', 1000);
  const spotterUsed = input?.spotter_used === undefined ? false : requiredBoolean(input.spotter_used, 'Spotter used');
  const rpePost = optionalNumber(input?.rpe_post, 'Post-test RPE', { min: 0, max: 10 });
  const painPost = optionalNumber(input?.pain_post, 'Post-test pain', { min: 0, max: 10 });
  const notes = notesFrom(input, context);
  const interpretation = relativeStrength === null
    ? `1RM recorded for ${exercise}: ${oneRmLoad} ${units}. ${normativeLabel}.`
    : `1RM recorded for ${exercise}: ${oneRmLoad} ${units}. Relative strength: ${relativeStrength.toFixed(2)} × body mass. Classification: ${normativeLabel}.`;
  const soapText = [
    `• 1RM Testing — ${exercise} (${equipment})`,
    `  1RM: ${oneRmLoad} ${units}${relativeStrength === null ? '' : ` | Relative strength: ${relativeStrength.toFixed(2)} × BM`} | Classification: ${normativeLabel}`,
    romStandard ? `  ROM Standard: ${romStandard}` : null,
    machineSettings ? `  Machine Settings: ${machineSettings}` : null,
    spotterUsed ? '  Spotter used' : null,
    rpePost === null ? null : `  RPE: ${rpePost}/10`,
    painPost === null ? null : `  Pain: ${painPost}/10`,
    assistiveConsiderations ? `  Considerations: ${assistiveConsiderations}` : null,
    notes ? `  Notes: ${notes}` : null,
    `  Training Load Guide: 60–70% = ${round(oneRmLoad * 0.65, 1)} ${units} | 70–85% = ${round(oneRmLoad * 0.775, 1)} ${units} | 85–95% = ${round(oneRmLoad * 0.9, 1)} ${units}`,
  ].filter(Boolean).join('\n');
  const soapObjective = `1RM Testing - ${exercise}: ${oneRmLoad} ${units}.${relativeStrength === null ? '' : ` Relative strength: ${relativeStrength.toFixed(2)} × body mass.`} ${normativeLabel}.`;
  const soapPlan = `Use approximately 60–80% of 1RM (${round(oneRmLoad * 0.6, 1)}–${round(oneRmLoad * 0.8, 1)} ${units}) for general strength development; re-test as indicated.`;
  return finish({
    key: '1rm_testing',
    input: { exercise_tested: exercise, equipment_type: equipment, units, one_rm_load: oneRmLoad, body_mass: bodyMass, body_mass_units: bodyMassUnits, sex, attempts, assistive_considerations: assistiveConsiderations, rom_standard_used: romStandard, machine_settings: machineSettings, spotter_used: spotterUsed, rpe_post: rpePost, pain_post: painPost, notes },
    context, result: oneRmLoad, notes, soapText, interpretation,
    additional: { exercise_tested: exercise, equipment_type: equipment, units, body_mass: bodyMass, body_mass_units: bodyMassUnits, assistive_considerations: assistiveConsiderations, attempts, one_rm_load: oneRmLoad, relative_strength: relativeStrength, normative_label: normativeLabel, rom_standard_used: romStandard, machine_settings: machineSettings, spotter_used: spotterUsed, rpe_post: rpePost, pain_post: painPost, clinician_notes: notes, interpretation_summary: interpretation, soap_objective: soapObjective, soap_assessment: interpretation, soap_plan: soapPlan },
  });
}

function normalizeBruceStages(value) {
  return requiredArray(value, 'Bruce stage observations', { min: 1, max: 20 }).map((entry, index) => {
    const source = requiredObject(entry, `Bruce stage observation ${index + 1}`);
    const systolic = optionalNumber(source.systolic, `Stage ${index + 1} systolic pressure`, { min: 40, max: 300, integer: true });
    const diastolic = optionalNumber(source.diastolic, `Stage ${index + 1} diastolic pressure`, { min: 20, max: 200, integer: true });
    invariant((systolic === null) === (diastolic === null), `Stage ${index + 1} blood pressure must be paired`);
    if (systolic !== null) invariant(systolic > diastolic, `Stage ${index + 1} systolic must exceed diastolic`);
    return {
      stage: requiredNumber(source.stage, `Stage ${index + 1} identifier`, { min: 0, max: 20 }),
      time: requiredNumber(source.time, `Stage ${index + 1} time`, { min: 0, max: 120, integer: true }),
      heartRate: normalizeHeartRate(source.heartRate ?? source.heart_rate, `Stage ${index + 1} heart rate`, true),
      systolic,
      diastolic,
      rpe: optionalNumber(source.rpe, `Stage ${index + 1} RPE`, { min: 0, max: 20 }),
    };
  });
}

export function scoreBruceTreadmill(input, context = {}) {
  const totalTime = requiredNumber(input?.total_time_seconds, 'Total duration', { min: 1, max: 1800, integer: true });
  const stageData = normalizeBruceStages(input?.stage_data);
  const currentStageIndex = requiredNumber(input?.current_stage_index, 'Current stage index', { min: 0, max: 20, integer: true });
  const currentHeartRate = normalizeHeartRate(input?.current_heart_rate, 'Current heart rate');
  const currentSystolic = optionalNumber(input?.current_systolic, 'Current systolic pressure', { min: 40, max: 300, integer: true });
  const terminationReason = requiredText(input?.termination_reason, 'Termination reason', 500);
  const symptoms = optionalText(input?.symptoms, 'Symptoms');
  const notes = notesFrom(input, context);
  const peakHr = Math.max(...stageData.map((stage) => stage.heartRate), ...(currentHeartRate === null ? [] : [currentHeartRate]));
  const systolicValues = stageData.map((stage) => stage.systolic).filter((value) => value !== null);
  if (currentSystolic !== null) systolicValues.push(currentSystolic);
  const peakSystolic = systolicValues.length ? Math.max(...systolicValues) : null;
  const minutes = totalTime / 60;
  const vo2 = round(14.8 - (1.379 * minutes) + (0.451 * (minutes ** 2)) - (0.012 * (minutes ** 3)), 1);
  invariant(vo2 > 0, 'estimated Bruce VO2 must be positive');
  const stagesCompleted = currentStageIndex + 1;
  const interpretation = `${stagesCompleted} stages represented across ${totalTime} seconds; estimated VO2max ${vo2.toFixed(1)} mL/kg/min; terminated due to ${terminationReason}.`;
  const stageLines = stageData.map((stage) =>
    `  Stage ${stage.stage} (${stage.time} min): HR ${stage.heartRate} bpm${stage.systolic === null ? '' : `, BP ${stage.systolic}/${stage.diastolic} mmHg`}${stage.rpe === null ? '' : `, RPE ${stage.rpe}`}`);
  const soapText = [
    '• Bruce Protocol Treadmill Test',
    `  Total Time: ${Math.floor(totalTime / 60)}:${String(totalTime % 60).padStart(2, '0')} (${totalTime}s)`,
    `  Estimated VO2max: ${vo2.toFixed(1)} mL/kg/min`,
    `  Stages Completed: ${stagesCompleted}`,
    `  Peak HR: ${peakHr} bpm${peakSystolic === null ? '' : ` | Peak Systolic BP: ${peakSystolic} mmHg`}`,
    `  Termination: ${terminationReason}`,
    symptoms ? `  Symptoms: ${symptoms}` : null,
    ...stageLines,
    `  Interpretation: ${interpretation}`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'bruce_treadmill', input: { total_time_seconds: totalTime, stage_data: stageData, current_stage_index: currentStageIndex, current_heart_rate: currentHeartRate, current_systolic: currentSystolic, termination_reason: terminationReason, symptoms, notes },
    context, result: totalTime, notes, soapText, interpretation,
    additional: { protocol: 'Bruce', total_time_seconds: totalTime, stages_completed: stagesCompleted, stage_data: stageData, peak_heart_rate: peakHr, peak_systolic_bp: peakSystolic, estimated_vo2max: vo2, termination_reason: terminationReason, symptoms },
  });
}

export function scoreTwoMinuteWalk(input, context = {}) {
  const distance = requiredNumber(input?.distance_metres, 'Distance walked', { min: 0.1, max: 2000 });
  const preHr = normalizeHeartRate(input?.pre_test_hr, 'Pre-test heart rate');
  const preBp = bloodPressure(input?.pre_test_bp, 'Pre-test blood pressure');
  const postHr = normalizeHeartRate(input?.post_test_hr, 'Post-test heart rate', true);
  const postBp = bloodPressure(input?.post_test_bp, 'Post-test blood pressure', { required: true });
  const notes = notesFrom(input, context);
  const change = preHr === null ? null : postHr - preHr;
  const interpretation = change === null
    ? `${distance} metres completed; post-test heart rate was ${postHr} bpm.`
    : `${distance} metres completed; heart rate changed by ${change} bpm.`;
  const soapText = [
    '• 2-Minute Walk Test (2MWT)',
    `  Distance: ${distance} m`,
    `  Pre-Test: HR ${preHr === null ? 'Not recorded' : `${preHr} bpm`}, BP ${preBp ?? 'Not recorded'}`,
    `  Post-Test: HR ${postHr} bpm, BP ${postBp}`,
    `  Interpretation: ${interpretation}`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: '2min_walk', input: { distance_metres: distance, pre_test_hr: preHr, pre_test_bp: preBp, post_test_hr: postHr, post_test_bp: postBp, notes },
    context, result: distance, notes, soapText, interpretation,
    additional: { distance_metres: distance, pre_test_hr: preHr, pre_test_bp: preBp, post_test_hr: postHr, post_test_bp: postBp, heart_rate_change: change },
  });
}

const SHUTTLE_NORMS = Object.freeze({
  '14-16': Object.freeze({ male: Object.freeze([12.7, 1.5]), female: Object.freeze([10.9, 1.2]) }),
  '17-20': Object.freeze({ male: Object.freeze([12.12, 1.3]), female: Object.freeze([10.8, 1.1]) }),
  '21-30': Object.freeze({ male: Object.freeze([12.5, 1.4]), female: Object.freeze([10.5, 1.2]) }),
  '31-40': Object.freeze({ male: Object.freeze([11.8, 1.5]), female: Object.freeze([9.8, 1.3]) }),
  '41-50': Object.freeze({ male: Object.freeze([11.2, 1.6]), female: Object.freeze([9.2, 1.4]) }),
  '51-60': Object.freeze({ male: Object.freeze([10.4, 1.7]), female: Object.freeze([8.5, 1.5]) }),
  '61-70': Object.freeze({ male: Object.freeze([9.5, 1.8]), female: Object.freeze([7.8, 1.6]) }),
  '71-85': Object.freeze({ male: Object.freeze([8.6, 1.9]), female: Object.freeze([6.9, 1.7]) }),
});

function shuttleAgeGroup(age) {
  if (age <= 16) return '14-16';
  if (age <= 20) return '17-20';
  if (age <= 30) return '21-30';
  if (age <= 40) return '31-40';
  if (age <= 50) return '41-50';
  if (age <= 60) return '51-60';
  if (age <= 70) return '61-70';
  return '71-85';
}

function shuttleNormative(level, age, sex) {
  if (age === null || sex === null) return null;
  const [mean, standardDeviation] = SHUTTLE_NORMS[shuttleAgeGroup(age)][sex];
  const zScore = (level - mean) / standardDeviation;
  if (zScore >= 1.5) return 'well_above_average';
  if (zScore >= 0.5) return 'above_average';
  if (zScore >= -0.5) return 'average';
  if (zScore >= -1.5) return 'below_average';
  return 'well_below_average';
}

export function scoreTwentyMetreShuttle(input, context = {}) {
  const level = requiredNumber(input?.final_level, 'Final level', { min: 1, max: 21, integer: true });
  const shuttle = requiredNumber(input?.final_shuttle, 'Final shuttle', { min: 1, max: 20, integer: true });
  const totalShuttles = optionalNumber(input?.total_shuttles_completed, 'Total shuttles completed', { min: 1, max: 1000, integer: true });
  const rpe = requiredNumber(input?.rpe, 'RPE', { min: 6, max: 20, integer: true });
  const terminationReason = requiredText(input?.termination_reason, 'Termination reason', 500);
  const peakHr = normalizeHeartRate(input?.peak_hr, 'Peak heart rate');
  const preHr = normalizeHeartRate(input?.pre_test_hr, 'Pre-test heart rate');
  const preBp = bloodPressure(input?.pre_test_bp, 'Pre-test blood pressure');
  const symptoms = optionalText(input?.symptoms, 'Symptoms');
  const notes = notesFrom(input, context);
  const age = optionalNumber(input?.age, 'Age', { min: 14, max: 85, integer: true });
  const sex = hasValue(input?.sex) ? requiredChoice(input.sex, 'Sex', ['male', 'female']) : null;
  invariant((age === null) === (sex === null), 'normative comparison requires both age and sex or neither');
  const estimatedVo2 = round(3.46 * (level + (shuttle / 10)) + 12.2, 1);
  const normativeComparison = shuttleNormative(level, age, sex);
  const interpretation = `Level ${level}, shuttle ${shuttle} completed; estimated VO2max ${estimatedVo2.toFixed(1)} mL/kg/min${normativeComparison ? `; ${normativeComparison.replaceAll('_', ' ')}` : ''}.`;
  const soapText = [
    '• 20m Multi-Stage Shuttle Run (Beep Test)',
    `  Final Level: ${level} | Shuttle: ${shuttle}`,
    `  Estimated VO2max: ${estimatedVo2.toFixed(1)} mL/kg/min`,
    totalShuttles === null ? null : `  Total Shuttles: ${totalShuttles}`,
    `  RPE: ${rpe}/20 | Termination: ${terminationReason}`,
    peakHr === null ? null : `  Peak HR: ${peakHr} bpm`,
    preHr === null && !preBp ? null : `  Pre-Test: HR ${preHr ?? '—'} bpm | BP ${preBp ?? '—'}`,
    symptoms ? `  Symptoms: ${symptoms}` : null,
    `  Interpretation: ${interpretation}`,
    notes ? `  Notes/Deviation: ${notes}` : null,
  ].filter(Boolean).join('\n');
  const payload = finish({
    key: '20m_shuttle', input: { final_level: level, final_shuttle: shuttle, total_shuttles_completed: totalShuttles, rpe, termination_reason: terminationReason, peak_hr: peakHr, pre_test_hr: preHr, pre_test_bp: preBp, symptoms, age, sex, notes },
    context, result: level, notes, soapText, interpretation,
    additional: { final_level: level, final_shuttle: shuttle, estimated_vo2max: estimatedVo2, total_shuttles_completed: totalShuttles, rpe_6_20: rpe, termination_reason: terminationReason, symptoms_reported: symptoms || null, peak_hr_bpm: peakHr, notes_deviation: notes || null, msft_result_string: `Level ${level} Shuttle ${shuttle}`, pre_test_hr: preHr, pre_test_bp: preBp, age, sex, normative_comparison: normativeComparison },
  });
  return { ...payload, normative_comparison: normativeComparison };
}

export function scoreThirtyFifteenIft(input, context = {}) {
  const vift = requiredNumber(input?.vift_kmh, 'VIFT speed', { min: 8, max: 23 });
  invariant(Math.abs((vift * 2) - Math.round(vift * 2)) < 1e-9,
    'VIFT speed must use 0.5 km/h stage increments');
  const stages = requiredNumber(input?.total_stages, 'Total stages', { min: 1, max: 31, integer: true });
  const hrPre = normalizeHeartRate(input?.hr_pre, 'Pre-test heart rate');
  const hrPost = normalizeHeartRate(input?.hr_post, 'Post-test heart rate');
  const bpPre = bloodPressure(input?.bp_pre, 'Pre-test blood pressure');
  const rpe = optionalNumber(input?.rpe, 'RPE', { min: 6, max: 20, integer: true });
  const notes = notesFrom(input, context);
  const category = vift >= 19 ? 'Elite' : vift >= 14 ? 'High Fitness' : vift >= 10 ? 'Moderate Fitness' : 'Low Fitness';
  const trainingMin = round(vift, 1);
  const trainingMax = round(vift * 1.3, 1);
  const interpretation = `${category}; interval target ${trainingMin.toFixed(1)}–${trainingMax.toFixed(1)} km/h from a VIFT of ${vift.toFixed(1)} km/h.`;
  const soapText = [
    '• 30-15 Intermittent Fitness Test (30-15IFT)',
    `  VIFT (Final Speed): ${vift.toFixed(1)} km/h — ${category}`,
    `  Total Stages Completed: ${stages}`,
    `  Training Prescription: ${trainingMin.toFixed(1)}–${trainingMax.toFixed(1)} km/h interval target`,
    hrPre === null ? null : `  Pre-Test HR: ${hrPre} bpm`,
    bpPre ? `  Pre-Test BP: ${bpPre}` : null,
    hrPost === null ? null : `  Post-Test HR: ${hrPost} bpm`,
    rpe === null ? null : `  RPE: ${rpe}/20`,
    `  Interpretation: ${interpretation}`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  const payload = finish({
    key: '3015_ift', input: { vift_kmh: vift, total_stages: stages, hr_pre: hrPre, bp_pre: bpPre, hr_post: hrPost, rpe, notes },
    context, result: vift, notes, soapText, interpretation,
    additional: { vift_kmh: vift, total_stages: stages, hr_pre: hrPre, bp_pre: bpPre, hr_post: hrPost, rpe, training_min_kmh: trainingMin, training_max_kmh: trainingMax },
  });
  return { ...payload, vift_kmh: vift, total_stages: stages, rpe };
}

function fastingGlucoseClassification(value) {
  if (value < 3.9) return 'Hypoglycaemia';
  if (value <= 5.5) return 'Normal';
  if (value <= 6.9) return 'Impaired Fasting Glucose (Pre-diabetes)';
  if (value <= 11) return 'Diabetes Mellitus — Elevated';
  return 'Severely Elevated — Urgent Review';
}

export function scoreFastingGlucose(input, context = {}) {
  const glucose = requiredNumber(input?.glucose_mmol_l, 'Fasting glucose', { min: 0.1, max: 50 });
  const fastingHours = requiredNumber(input?.fasting_hours, 'Fasting duration', { min: 1, max: 72, integer: true });
  const method = requiredChoice(input?.method, 'Collection method', ['fingerprick', 'venous', 'other']);
  const medications = optionalText(input?.current_medications, 'Current medications');
  const notes = notesFrom(input, context);
  const classification = fastingGlucoseClassification(glucose);
  const interpretation = `${glucose} mmol/L — ${classification}.`;
  const methodLabel = method === 'fingerprick' ? 'Finger-prick glucometer'
    : method === 'venous' ? 'Venous blood sample' : 'Other';
  const soapText = [
    '• Fasting Blood Glucose',
    `  Result: ${glucose} mmol/L — ${classification}`,
    `  Fasting Duration: ${fastingHours} hours`,
    `  Method: ${methodLabel}`,
    medications ? `  Current Medications: ${medications}` : null,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'fasting_glucose', input: { glucose_mmol_l: glucose, fasting_hours: fastingHours, method, current_medications: medications, notes },
    context, result: glucose, notes, soapText, interpretation,
    additional: { glucose_mmol: glucose, glucose_mmol_l: glucose, fasting_hours: fastingHours, method, current_medications: medications, classification },
  });
}

function ogttInterpretation(value) {
  if (value < 7.8) return {
    classification: 'Normal Glucose Tolerance',
    clinicalMeaning: 'The two-hour plasma glucose is within the recorded normal range.',
    exerciseConsiderations: 'Standard exercise prescription can be followed with monitoring where otherwise indicated.',
  };
  if (value < 11.1) return {
    classification: 'Impaired Glucose Tolerance (Prediabetes)',
    clinicalMeaning: 'The recorded value is in the impaired glucose-tolerance range.',
    exerciseConsiderations: 'Structured aerobic and resistance exercise should reflect the wider clinical context.',
  };
  return {
    classification: 'Diabetes Range',
    clinicalMeaning: 'The recorded value is in the diabetes range.',
    exerciseConsiderations: 'Exercise planning should reflect follow-up, glucose monitoring and medication context.',
  };
}

export function scoreOgtt(input, context = {}) {
  const fasting = optionalNumber(input?.fasting_glucose_mmol_l, 'Fasting glucose', { min: 0.1, max: 50 });
  const twoHour = requiredNumber(input?.two_hour_glucose_mmol_l, 'Two-hour glucose', { min: 0.1, max: 50 });
  const notes = notesFrom(input, context);
  const result = ogttInterpretation(twoHour);
  const interpretation = `${twoHour} mmol/L — ${result.classification}.`;
  const soapText = [
    '• Oral Glucose Tolerance Test (OGTT)',
    '  Source: External pathology / medical practitioner result',
    fasting === null ? null : `  Fasting Blood Glucose: ${fasting} mmol/L`,
    `  Two-Hour Blood Glucose: ${twoHour} mmol/L`,
    `  Classification: ${result.classification}`,
    `  Clinical Meaning: ${result.clinicalMeaning}`,
    `  Exercise Considerations: ${result.exerciseConsiderations}`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'ogtt', input: { fasting_glucose_mmol_l: fasting, two_hour_glucose_mmol_l: twoHour, notes },
    context, result: twoHour, notes, soapText, interpretation,
    additional: { fasting_glucose: fasting, two_hour_glucose: twoHour, classification: result.classification, clinical_meaning: result.clinicalMeaning, exercise_considerations: result.exerciseConsiderations },
  });
}

export function scoreHba1c(input, context = {}) {
  const value = requiredNumber(input?.hba1c_percent, 'HbA1c', { min: 0, max: 20 });
  const notes = notesFrom(input, context);
  const category = value < 5.7 ? 'Normal' : value < 6.5 ? 'Pre-diabetes' : 'Diabetes';
  const interpretation = `${value}% — ${category}.`;
  const soapText = [
    `• HbA1c (Glycated Hemoglobin): ${value}%`,
    `  Interpretation: ${category}`,
    '  Reference Ranges: Normal <5.7% | Pre-diabetes 5.7–6.4% | Diabetes ≥6.5%',
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'hba1c', input: { hba1c_percent: value, notes }, context,
    result: value, notes, soapText, interpretation,
    additional: { hba1c_percent: value, category },
  });
}

const FIXTURES = deepFreeze({
  heart_rate: {
    mode: 'pre_post', pre_bpm: 72, post_bpm: 128,
    additional_measurements: [{ label: '1-minute recovery', hr: 96 }], notes: '',
  },
  'spo2-exercise': { pre_percent: 98, post_percent: 96, notes: '' },
  'spo2-resting': { spo2_percent: 97, notes: '' },
  blood_pressure: { systolic: 122, diastolic: 78, notes: '' },
  ymca_3min_step: { age: 35, sex: 'M', step_height_cm: 30, resting_hr: 72, recovery_hr: 92, rpe: 5, symptoms: '', notes: '' },
  aerobic_step: {
    protocol_key: 'queens', duration_seconds: 180, completed_full_protocol: true,
    stop_reason: 'Completed full protocol', step_height_cm: 41.3, cadence_steps_per_min: 96,
    age: 30, sex: 'male',
    pre_vitals: { hr: 72, bp: '122/78', spo2: 98, rpe: 1, dyspnea: 0 },
    post_vitals: { hr: 154, bp: '158/82', spo2: 96, rpe: 7, dyspnea: 4 },
    recovery: { hr1: 112, hr2: 94, hr3: 84, dyspnea: 2, fatigue: 3, dizziness: false, chestDiscomfort: false },
    during_symptoms: { rpe: 7, dyspnea: 4, pain: 0, symptoms: [] },
    setup: { surface: 'firm floor', balanceConcern: false }, notes: '',
  },
  chester: {
    age: 40, step_height_cm: 20,
    stages: [{ stage: 1, hr: 108, rpe: 8 }, { stage: 2, hr: 126, rpe: 11 }, { stage: 3, hr: 142, rpe: 14 }],
    notes: '',
  },
  eswt: {
    time_elapsed_seconds: 480, selected_speed_kmh: 4, shuttles_completed: 48,
    stop_reason: 'Unable to maintain pace', speed_reason: '80% of prior ISWT speed',
    pre_test: { heart_rate: 74, blood_pressure: '124/78', spo2: 97, dyspnoea: 1, leg_fatigue: 1, chest_pain: 'no', dizziness: 'no', recent_illness: 'no', walking_aid: 'no', oxygen_therapy: 'no', notes: '' },
    post_test: { heart_rate: 132, blood_pressure: '148/82', spo2: 94, dyspnoea: 5, leg_fatigue: 4, adverse_events: '' },
    iswt: { completed: 'yes', result_metres: 420 }, notes: '',
  },
  height_measurement: { height_cm: 172.4, notes: '' },
  weight_measure: { measured_kg: 78.4, clothing_adjustment_kg: 0.4, notes: '' },
  waist_circ: { waist_circumference_cm: 88, sex: 'male', notes: '' },
  tri_arm: { stage_heart_rates: [104, 120, 136], rpe: 14, notes: '' },
  tecumseh: { pre_hr: 72, recovery_hr: 94, age_group: '30-39', sex: 'male', notes: '' },
  balke: {
    total_seconds: 720, sex: 'male', client_age: 42,
    pre_test: { heart_rate: 72, blood_pressure: '122/78', rpe: 7 },
    body_weight_kg: 82, peak_rpe: 17, end_reason: 'Volitional fatigue',
    stage_heart_rates: { 1: 94, 6: 128, 12: 164 }, notes: '',
  },
  modified_bruce: {
    stage_data: [
      { stage: 1, speed: 1.7, grade: 0, duration: 180, heartRate: 96, rpe: 8 },
      { stage: 2, speed: 1.7, grade: 5, duration: 180, heartRate: 112, rpe: 10 },
      { stage: 3, speed: 1.7, grade: 10, duration: 180, heartRate: 132, rpe: 13 },
    ],
    pre_test_vitals: { heartRate: 72, bloodPressure: '122/78', weight: 78, height: 172 },
    post_test_vitals: { heartRate: 104, bloodPressure: '146/82', reasonForStop: 'Target workload reached' },
    stop_reason: 'Target workload reached', notes: '',
  },
  '1rm_testing': {
    exercise_tested: 'Leg Press (Machine)', equipment_type: 'Selectorised machine', units: 'kg',
    one_rm_load: 100, body_mass: 80, body_mass_units: 'kg', sex: 'male',
    attempts: [
      { attemptNumber: 1, load: 90, success: true, techniqueOk: true, notes: '' },
      { attemptNumber: 2, load: 100, success: true, techniqueOk: true, notes: '' },
      { attemptNumber: 3, load: 105, success: false, techniqueOk: false, notes: 'Unable to complete full repetition.' },
    ],
    assistive_considerations: '', rom_standard_used: 'Full available range', machine_settings: 'Seat 4',
    spotter_used: true, rpe_post: 9, pain_post: 1, notes: '',
  },
  bruce_treadmill: {
    total_time_seconds: 600, current_stage_index: 2, current_heart_rate: 168, current_systolic: 174,
    termination_reason: 'Volitional fatigue', symptoms: 'General fatigue', notes: '',
    stage_data: [
      { stage: 1, time: 3, heartRate: 118, systolic: 142, diastolic: 78, rpe: 9 },
      { stage: 2, time: 6, heartRate: 142, systolic: 158, diastolic: 80, rpe: 13 },
      { stage: 3, time: 9, heartRate: 164, systolic: 172, diastolic: 82, rpe: 17 },
    ],
  },
  '2min_walk': { distance_metres: 168, pre_test_hr: 74, pre_test_bp: '122/78', post_test_hr: 108, post_test_bp: '142/82', notes: '' },
  '20m_shuttle': { final_level: 9, final_shuttle: 6, total_shuttles_completed: 86, rpe: 17, termination_reason: 'Failed to reach line twice', peak_hr: 182, pre_test_hr: 76, pre_test_bp: '124/78', symptoms: 'General fatigue', age: 35, sex: 'male', notes: '' },
  '3015_ift': { vift_kmh: 15.5, total_stages: 16, hr_pre: 74, bp_pre: '122/78', hr_post: 184, rpe: 18, notes: '' },
  fasting_glucose: { glucose_mmol_l: 5.2, fasting_hours: 10, method: 'venous', current_medications: '', notes: '' },
  ogtt: { fasting_glucose_mmol_l: 5.1, two_hour_glucose_mmol_l: 8.4, notes: '' },
  hba1c: { hba1c_percent: 6.1, notes: '' },
});

function normalizeKey(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  const aliases = {
    'heart rate (pre/post exercise)': 'heart_rate',
    'oxygen saturation (spo2) pre/post exercise': 'spo2-exercise',
    'resting oxygen saturation (spo2)': 'spo2-resting',
    'ymca 3-minute step test': 'ymca_3min_step',
    '2-minute walk test (2mwt)': '2min_walk',
    '20-meter shuttle run': '20m_shuttle',
    '30-15 intermittent fitness test': '3015_ift',
    'hba1c (glycated hemoglobin)': 'hba1c',
  };
  return aliases[normalized] || normalized;
}

export function buildFixture(canonicalOrRunnerKey) {
  const key = normalizeKey(canonicalOrRunnerKey);
  const fixture = FIXTURES[key];
  if (!fixture) fail(`unsupported fixture key ${canonicalOrRunnerKey}`);
  return clone(fixture);
}

export function validateAndScore(input, context = {}) {
  const key = normalizeKey(
    context.runnerKey || context.scoringKey || input?.runnerKey || input?.scoringKey
      || input?.runner_key || input?.scoring_key,
  );
  switch (key) {
    case 'heart_rate': return scoreHeartRate(input, context);
    case 'spo2-exercise': return scoreSpo2Exercise(input, context);
    case 'spo2-resting': return scoreSpo2Resting(input, context);
    case 'blood_pressure': return scoreBloodPressure(input, context);
    case 'ymca_3min_step': return scoreYmcaThreeMinuteStep(input, context);
    case 'aerobic_step': return scoreAerobicStep(input, context);
    case 'chester': return scoreChester(input, context);
    case 'eswt': return scoreEswt(input, context);
    case 'height_measurement': return scoreHeight(input, context);
    case 'weight_measure': return scoreWeight(input, context);
    case 'waist_circ': return scoreWaistCircumference(input, context);
    case 'tri_arm': return scoreTriLevelArm(input, context);
    case 'tecumseh': return scoreTecumseh(input, context);
    case 'balke': return scoreBalke(input, context);
    case 'modified_bruce': return scoreModifiedBruce(input, context);
    case '1rm_testing': return scoreOneRm(input, context);
    case 'bruce_treadmill': return scoreBruceTreadmill(input, context);
    case '2min_walk': return scoreTwoMinuteWalk(input, context);
    case '20m_shuttle': return scoreTwentyMetreShuttle(input, context);
    case '3015_ift': return scoreThirtyFifteenIft(input, context);
    case 'fasting_glucose': return scoreFastingGlucose(input, context);
    case 'ogtt': return scoreOgtt(input, context);
    case 'hba1c': return scoreHba1c(input, context);
    default: fail(`runnerKey/scoringKey must be one of: ${RUNNER_KEYS.join(', ')}`);
  }
}
