import { todayLocal } from '../localDate.js';

const GENDER_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Male', value: 'male' }),
  Object.freeze({ label: 'Female', value: 'female' }),
]);

const HYDRATION_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Euhydrated', value: 'euhydrated' }),
  Object.freeze({ label: 'Dehydrated', value: 'dehydrated' }),
  Object.freeze({ label: 'Overhydrated', value: 'overhydrated' }),
]);

const PLACEMENT_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Hand and foot', value: 'handFoot' }),
  Object.freeze({ label: 'Foot and foot', value: 'footFoot' }),
]);

export const BIA_NUMERIC_CONSTRAINTS = Object.freeze({
  height: Object.freeze({ min: 30, max: 300, step: 0.1 }),
  weight: Object.freeze({ min: 1, max: 1000, step: 0.1 }),
  age: Object.freeze({ min: 1, max: 130, step: 1 }),
  body_fat_pct: Object.freeze({ min: 0, max: 100, step: 0.1 }),
  fat_free_mass: Object.freeze({ min: 0, max: 1000, step: 0.1 }),
  total_body_water: Object.freeze({ min: 0, max: 1000, step: 0.1 }),
  skeletal_muscle_mass: Object.freeze({ min: 0, max: 1000, step: 0.1 }),
  visceral_fat_level: Object.freeze({ min: 0, max: 100, step: 1 }),
  bmi: Object.freeze({ min: 1, max: 200, step: 0.1 }),
  basal_metabolic_rate: Object.freeze({ min: 0, max: 20000, step: 1 }),
  resistance: Object.freeze({ min: 0, max: 10000, step: 0.1 }),
  reactance: Object.freeze({ min: 0, max: 5000, step: 0.1 }),
});

export const BIA_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'measurement',
  runnerKey: 'bia',
  scoringKey: 'bia',
  fields: Object.freeze([
    Object.freeze({ key: 'height', label: 'Height', type: 'number', required: true, ...BIA_NUMERIC_CONSTRAINTS.height, unit: 'cm' }),
    Object.freeze({ key: 'weight', label: 'Weight', type: 'number', required: true, ...BIA_NUMERIC_CONSTRAINTS.weight, unit: 'kg' }),
    Object.freeze({ key: 'age', label: 'Age', type: 'number', required: true, ...BIA_NUMERIC_CONSTRAINTS.age, unit: 'years' }),
    Object.freeze({ key: 'gender', label: 'Gender recorded by device', type: 'select', required: true, options: GENDER_OPTIONS }),
    Object.freeze({ key: 'body_fat_pct', label: 'Device-reported body fat', type: 'number', required: true, ...BIA_NUMERIC_CONSTRAINTS.body_fat_pct, unit: '%' }),
    Object.freeze({ key: 'fat_free_mass', label: 'Fat-free mass', type: 'number', required: false, ...BIA_NUMERIC_CONSTRAINTS.fat_free_mass, unit: 'kg' }),
    Object.freeze({ key: 'total_body_water', label: 'Total body water', type: 'number', required: false, ...BIA_NUMERIC_CONSTRAINTS.total_body_water, unit: 'L' }),
    Object.freeze({ key: 'skeletal_muscle_mass', label: 'Skeletal muscle mass', type: 'number', required: false, ...BIA_NUMERIC_CONSTRAINTS.skeletal_muscle_mass, unit: 'kg' }),
    Object.freeze({ key: 'visceral_fat_level', label: 'Visceral fat level', type: 'number', required: false, ...BIA_NUMERIC_CONSTRAINTS.visceral_fat_level }),
    Object.freeze({ key: 'bmi', label: 'Device-reported BMI', type: 'number', required: false, ...BIA_NUMERIC_CONSTRAINTS.bmi, unit: 'kg/m²' }),
    Object.freeze({ key: 'basal_metabolic_rate', label: 'Basal metabolic rate', type: 'number', required: false, ...BIA_NUMERIC_CONSTRAINTS.basal_metabolic_rate, unit: 'kcal/day' }),
    Object.freeze({ key: 'resistance', label: 'Resistance', type: 'number', required: false, ...BIA_NUMERIC_CONSTRAINTS.resistance, unit: 'Ω' }),
    Object.freeze({ key: 'reactance', label: 'Reactance', type: 'number', required: false, ...BIA_NUMERIC_CONSTRAINTS.reactance, unit: 'Ω' }),
    Object.freeze({ key: 'hydration_status', label: 'Hydration status', type: 'select', required: false, options: HYDRATION_OPTIONS }),
    Object.freeze({ key: 'electrode_placement', label: 'Electrode placement', type: 'select', required: false, options: PLACEMENT_OPTIONS }),
    Object.freeze({ key: 'notes', label: 'Clinical notes', type: 'textarea', required: false, maxLength: 4000 }),
  ]),
  scoring: Object.freeze({
    method: 'direct-device-reported-body-fat-percentage',
    version: 'bia.v1',
    requiredDeviceOutput: 'body_fat_pct',
  }),
  result: Object.freeze({
    primaryField: 'body_fat_pct',
    unit: '%',
    additionalDataFields: Object.freeze([
      'values',
      'body_fat_pct',
      'resistance',
      'reactance',
      'interpretation_summary',
      'soap_text',
      'soap_objective',
      'report_text',
    ]),
  }),
});

function requiredNumber(value, label, { min, max, integer = false }) {
  if (value === '' || value === null || value === undefined) throw new Error(`${label} is required`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
    throw new Error(`${label} must be ${integer ? 'a whole ' : 'a finite '}number from ${min} to ${max}`);
  }
  return number;
}

function optionalNumber(value, label, bounds) {
  if (value === '' || value === null || value === undefined) return undefined;
  return requiredNumber(value, label, bounds);
}

function optionalEnum(value, label, options) {
  if (value === '' || value === null || value === undefined) return undefined;
  const normalized = String(value);
  if (!options.some((option) => option.value === normalized)) throw new Error(`${label} is not a permitted option`);
  return normalized;
}

function optionalText(value, label, maxLength) {
  const normalized = String(value ?? '').trim();
  if (normalized.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer`);
  return normalized;
}

function assessmentDateFrom(context) {
  const supplied = String(context?.assessmentDate || '').trim();
  return supplied || todayLocal();
}

function includeDefined(target, key, value) {
  if (value !== undefined) target[key] = value;
}

export function validateAndScore(input, context = {}) {
  const height = requiredNumber(input?.height, 'Height', BIA_NUMERIC_CONSTRAINTS.height);
  const weight = requiredNumber(input?.weight, 'Weight', BIA_NUMERIC_CONSTRAINTS.weight);
  const age = requiredNumber(input?.age, 'Age', { ...BIA_NUMERIC_CONSTRAINTS.age, integer: true });
  const gender = optionalEnum(input?.gender, 'Gender recorded by device', GENDER_OPTIONS);
  if (!gender) throw new Error('Gender recorded by device is required');
  const bodyFatPct = requiredNumber(input?.body_fat_pct, 'Device-reported body fat percentage', BIA_NUMERIC_CONSTRAINTS.body_fat_pct);

  const values = { height, weight, age, gender, body_fat_pct: bodyFatPct };
  includeDefined(values, 'fat_free_mass', optionalNumber(input?.fat_free_mass, 'Fat-free mass', BIA_NUMERIC_CONSTRAINTS.fat_free_mass));
  includeDefined(values, 'total_body_water', optionalNumber(input?.total_body_water, 'Total body water', BIA_NUMERIC_CONSTRAINTS.total_body_water));
  includeDefined(values, 'skeletal_muscle_mass', optionalNumber(input?.skeletal_muscle_mass, 'Skeletal muscle mass', BIA_NUMERIC_CONSTRAINTS.skeletal_muscle_mass));
  includeDefined(values, 'visceral_fat_level', optionalNumber(input?.visceral_fat_level, 'Visceral fat level', BIA_NUMERIC_CONSTRAINTS.visceral_fat_level));
  includeDefined(values, 'bmi', optionalNumber(input?.bmi, 'Device-reported BMI', BIA_NUMERIC_CONSTRAINTS.bmi));
  includeDefined(values, 'basal_metabolic_rate', optionalNumber(input?.basal_metabolic_rate, 'Basal metabolic rate', BIA_NUMERIC_CONSTRAINTS.basal_metabolic_rate));
  includeDefined(values, 'resistance', optionalNumber(input?.resistance, 'Resistance', BIA_NUMERIC_CONSTRAINTS.resistance));
  includeDefined(values, 'reactance', optionalNumber(input?.reactance, 'Reactance', BIA_NUMERIC_CONSTRAINTS.reactance));
  includeDefined(values, 'hydration_status', optionalEnum(input?.hydration_status, 'Hydration status', HYDRATION_OPTIONS));
  includeDefined(values, 'electrode_placement', optionalEnum(input?.electrode_placement, 'Electrode placement', PLACEMENT_OPTIONS));
  const notes = optionalText(input?.notes ?? context?.notes, 'Clinical notes', 4000);

  if (!Number.isFinite(bodyFatPct)) throw new Error('BIA primary result must be finite');

  const hydrationLabels = { euhydrated: 'Euhydrated', dehydrated: 'Dehydrated', overhydrated: 'Overhydrated' };
  const placementLabels = { handFoot: 'Hand and foot', footFoot: 'Foot and foot' };
  const lineFor = (key, label, unit = '') => (
    values[key] === undefined ? null : `  ${label}: ${values[key]}${unit}`
  );
  const soapText = [
    '• Bioelectrical Impedance Analysis (BIA)',
    `  Device-reported body fat: ${bodyFatPct}%`,
    `  Height: ${height} cm | Weight: ${weight} kg | Age: ${age} years | Gender setting: ${gender}`,
    values.hydration_status ? `  Hydration status: ${hydrationLabels[values.hydration_status]}` : null,
    values.electrode_placement ? `  Electrode placement: ${placementLabels[values.electrode_placement]}` : null,
    lineFor('fat_free_mass', 'Fat-free mass', ' kg'),
    lineFor('total_body_water', 'Total body water', ' L'),
    lineFor('skeletal_muscle_mass', 'Skeletal muscle mass', ' kg'),
    lineFor('visceral_fat_level', 'Visceral fat level'),
    lineFor('bmi', 'Device-reported BMI', ' kg/m²'),
    lineFor('basal_metabolic_rate', 'Basal metabolic rate', ' kcal/day'),
    lineFor('resistance', 'Resistance', ' Ω'),
    lineFor('reactance', 'Reactance', ' Ω'),
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  const interpretationSummary = `BIA device-reported body fat: ${bodyFatPct}%.`;

  return {
    status: 'completed',
    result_value: bodyFatPct,
    assessment_date: assessmentDateFrom(context),
    additional_data: {
      measurement_type: 'bia',
      scoring_key: BIA_RUNNER_SPEC.scoringKey,
      scoring_version: BIA_RUNNER_SPEC.scoring.version,
      raw_input: { ...values, notes },
      values,
      ...values,
      interpretation: 'Device-reported body-fat percentage',
      interpretation_summary: interpretationSummary,
      soap_text: soapText,
      soap_objective: interpretationSummary,
      report_text: `${interpretationSummary}\n${soapText}`,
    },
    notes,
  };
}

export function buildBiaFixture() {
  return {
    height: 170,
    weight: 70,
    age: 45,
    gender: 'female',
    body_fat_pct: 22.5,
    resistance: 520,
    reactance: 65,
    hydration_status: 'euhydrated',
    electrode_placement: 'handFoot',
    notes: '',
  };
}
