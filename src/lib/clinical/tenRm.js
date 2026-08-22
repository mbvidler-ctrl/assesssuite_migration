import { todayLocal } from '../localDate.js';

const TEN_RM_UNIT_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Kilograms (kg)', value: 'kg' }),
  Object.freeze({ label: 'Pounds (lb)', value: 'lb' }),
]);

export const TEN_RM_LOAD_CONSTRAINTS = Object.freeze({ min: 0.1, max: 5000, step: 0.1 });

export const TEN_RM_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'measurement',
  runnerKey: '10rm',
  scoringKey: '10rm',
  fields: Object.freeze([
    Object.freeze({ key: 'exercise', label: 'Exercise tested', type: 'text', required: true, maxLength: 120 }),
    Object.freeze({ key: 'load', label: 'Ten-repetition maximum load', type: 'number', required: true, ...TEN_RM_LOAD_CONSTRAINTS, unit: 'selected' }),
    Object.freeze({ key: 'unit', label: 'Load unit', type: 'select', required: true, options: TEN_RM_UNIT_OPTIONS }),
    Object.freeze({ key: 'equipment', label: 'Equipment or setup', type: 'text', required: false, maxLength: 200 }),
    Object.freeze({ key: 'test_standard', label: 'Range-of-motion or technique standard', type: 'textarea', required: false, maxLength: 1000 }),
    Object.freeze({ key: 'notes', label: 'Clinical notes', type: 'textarea', required: false, maxLength: 4000 }),
  ]),
  scoring: Object.freeze({
    method: 'direct-10rm-load',
    version: '10rm.v1',
    repetitions: 10,
  }),
  result: Object.freeze({
    primaryField: 'ten_rm_load',
    unit: 'selected',
    additionalDataFields: Object.freeze([
      'exercise_tested',
      'ten_rm_load',
      'units',
      'equipment',
      'test_standard',
      'interpretation_summary',
      'soap_text',
      'soap_objective',
      'report_text',
    ]),
  }),
});

function requiredText(value, label, maxLength) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${label} is required`);
  if (normalized.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer`);
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

export function validateAndScore(input, context = {}) {
  const exercise = requiredText(input?.exercise, 'Exercise tested', 120);
  const rawLoad = input?.load;
  if (rawLoad === '' || rawLoad === null || rawLoad === undefined) {
    throw new Error('10RM load is required');
  }
  const tenRmLoad = Number(rawLoad);
  if (!Number.isFinite(tenRmLoad) || tenRmLoad < TEN_RM_LOAD_CONSTRAINTS.min || tenRmLoad > TEN_RM_LOAD_CONSTRAINTS.max) {
    throw new Error('10RM load must be a finite number from 0.1 to 5000');
  }
  const units = String(input?.unit || '').trim();
  if (!TEN_RM_UNIT_OPTIONS.some(({ value }) => value === units)) {
    throw new Error('10RM load unit must be kg or lb');
  }
  const equipment = optionalText(input?.equipment, 'Equipment or setup', 200);
  const testStandard = optionalText(input?.test_standard, 'Technique standard', 1000);
  const notes = optionalText(input?.notes ?? context?.notes, 'Clinical notes', 4000);
  const interpretationSummary = `10RM recorded for ${exercise}: ${tenRmLoad} ${units}.`;
  const soapLines = [
    `• Ten Repetition Maximum (10RM) — ${exercise}`,
    `  10RM load: ${tenRmLoad} ${units}`,
  ];
  if (equipment) soapLines.push(`  Equipment/setup: ${equipment}`);
  if (testStandard) soapLines.push(`  Technique standard: ${testStandard}`);
  if (notes) soapLines.push(`  Notes: ${notes}`);
  const soapText = soapLines.join('\n');

  return {
    status: 'completed',
    result_value: tenRmLoad,
    assessment_date: assessmentDateFrom(context),
    additional_data: {
      measurement_type: '10rm',
      scoring_key: TEN_RM_RUNNER_SPEC.scoringKey,
      scoring_version: TEN_RM_RUNNER_SPEC.scoring.version,
      raw_input: {
        exercise,
        load: tenRmLoad,
        unit: units,
        equipment,
        test_standard: testStandard,
        notes,
      },
      exercise_tested: exercise,
      repetitions: 10,
      ten_rm_load: tenRmLoad,
      units,
      equipment,
      test_standard: testStandard,
      interpretation: 'Direct ten-repetition maximum load',
      interpretation_summary: interpretationSummary,
      soap_text: soapText,
      soap_objective: interpretationSummary,
      report_text: `${interpretationSummary}\n${soapText}`,
    },
    notes,
  };
}

export function buildTenRmFixture() {
  return {
    exercise: 'Leg press',
    load: 80,
    unit: 'kg',
    equipment: 'Selectorised machine',
    test_standard: 'Ten repetitions completed through the recorded range.',
    notes: '',
  };
}
