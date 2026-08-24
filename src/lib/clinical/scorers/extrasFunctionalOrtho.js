const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const RUNNER_KEYS = Object.freeze([
  'arm_curl',
  '30sec_sts',
  'triple_hop',
  'trendelenburg',
  'stair_climb',
  'two_min_step',
  'step_tap',
  'box_block_test',
  'mcgill',
  '60sec_sts',
  'distress_thermometer',
  'static_back',
  'rombergs_standing',
  'shoulder_tug',
  'gst',
  'timed_push_up',
  'static_squat',
  'squat',
  'ymca_bench',
  '5xsts',
  'fac',
  'modified_rankin',
  'nine_peg',
  'grooved_peg',
  'elys_test',
  'thomas_test',
  'anterior_drawer_knee',
  'noble_compression',
]);

const RUNNER_KEY_SET = new Set(RUNNER_KEYS);
const SCORING_VERSION = 'extras-functional-ortho.v1';

export const DISTRESS_PROBLEM_LIST = deepFreeze({
  'Practical Problems': [
    'Child care', 'Housing', 'Insurance/financial', 'Transportation', 'Work/school',
  ],
  'Family Problems': [
    'Dealing with children', 'Dealing with partner', 'Ability to have children', 'Family health issues',
  ],
  'Emotional Problems': [
    'Depression', 'Fears', 'Nervousness', 'Sadness', 'Worry', 'Loss of interest in usual activities',
  ],
  'Spiritual/Religious Concerns': [
    'Relating to God', 'Loss of faith', 'Spiritual/religious concerns',
  ],
  'Physical Problems': [
    'Appearance', 'Bathing/dressing', 'Breathing', 'Changes in urination', 'Constipation',
    'Diarrhoea', 'Eating', 'Fatigue', 'Feeling swollen', 'Fevers', 'Getting around',
    'Indigestion', 'Memory/concentration', 'Mouth sores', 'Nausea', 'Nose dry/congested',
    'Pain', 'Sexual', 'Skin dry/itchy', 'Sleep', 'Tingling in hands/feet',
  ],
});

function fail(message) {
  throw new Error(`Extras functional/orthopaedic scorer: ${message}`);
}

function invariant(condition, message) {
  if (!condition) fail(message);
}

function hasValue(value) {
  return value !== '' && value !== null && value !== undefined;
}

function finiteNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  invariant(hasValue(value), `${field} is required`);
  const number = Number(value);
  invariant(Number.isFinite(number), `${field} must be a finite number`);
  invariant(number >= min && number <= max, `${field} must be between ${min} and ${max}`);
  return number;
}

function optionalNumber(value, field, limits = {}) {
  return hasValue(value) ? finiteNumber(value, field, limits) : null;
}

function integer(value, field, limits = {}) {
  const number = finiteNumber(value, field, limits);
  invariant(Number.isInteger(number), `${field} must be a whole number`);
  return number;
}

function optionalInteger(value, field, limits = {}) {
  return hasValue(value) ? integer(value, field, limits) : null;
}

function choice(value, field, choices) {
  invariant(choices.includes(value), `${field} must be one of: ${choices.join(', ')}`);
  return value;
}

function optionalChoice(value, field, choices) {
  return hasValue(value) ? choice(value, field, choices) : null;
}

function boolean(value, field) {
  invariant(typeof value === 'boolean', `${field} must be true or false`);
  return value;
}

function optionalBoolean(value, field) {
  return value === null || value === undefined ? null : boolean(value, field);
}

function text(value, field, { required = false, max = 4000 } = {}) {
  const normalized = String(value ?? '').trim();
  invariant(!required || normalized.length > 0, `${field} is required`);
  invariant(normalized.length <= max, `${field} must be ${max} characters or fewer`);
  return normalized;
}

function bloodPressure(value, field) {
  if (!hasValue(value)) return null;
  const normalized = text(value, field, { max: 20 });
  invariant(/^\d{2,3}\s*\/\s*\d{2,3}$/.test(normalized), `${field} must use systolic/diastolic format`);
  return normalized.replace(/\s+/g, '');
}

function notesFrom(input, context) {
  return text(context?.notes ?? input?.notes ?? '', 'notes');
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function completedPayload(key, input, context, resultValue, soapText, additionalData, reportText = soapText) {
  const assessmentDate = String(context?.assessmentDate || input?.assessment_date || '').trim();
  invariant(LOCAL_DATE_PATTERN.test(assessmentDate), `${key} requires assessmentDate in YYYY-MM-DD format`);
  invariant(Number.isFinite(resultValue), `${key} result_value must be finite`);
  invariant(typeof soapText === 'string' && soapText.trim(), `${key} SOAP text is required`);
  invariant(typeof reportText === 'string' && reportText.trim(), `${key} report text is required`);

  const spec = RUNNER_SPEC_BY_KEY[key];
  const rawInput = clone(input);
  delete rawInput.assessment_date;
  delete rawInput.runnerKey;
  delete rawInput.runner_key;
  delete rawInput.scoringKey;
  delete rawInput.scoring_key;

  return {
    status: 'completed',
    result_value: resultValue,
    notes: notesFrom(input, context),
    assessment_date: assessmentDate,
    additional_data: {
      measurement_type: spec.measurementType,
      scoring_key: spec.scoringKey,
      scoring_version: spec.scoring.version,
      raw_input: rawInput,
      soap_text: soapText,
      report_text: reportText,
      ...additionalData,
    },
  };
}

const FIELD_LABELS = Object.freeze({
  testedSide: 'Tested side',
  rightReps: 'Right-arm repetitions',
  leftReps: 'Left-arm repetitions',
  weightKg: 'Test weight',
  age: 'Age',
  sex: 'Sex',
  completed: 'Test completed',
  standCount: 'Completed stands',
  handsUsed: 'Hands used for support',
  preHR: 'Pre-test heart rate',
  postHR: 'Post-test heart rate',
  side: 'Side tested',
  rightTrials: 'Right-side trials',
  leftTrials: 'Left-side trials',
  left: 'Left-side result',
  right: 'Right-side result',
  timeSeconds: 'Completion time',
  stairCount: 'Number of stairs',
  handrailUse: 'Handrail used',
  gaitStability: 'Gait stability',
  assistiveDevice: 'Assistive device',
  steps: 'Recorded steps',
  gender: 'Sex',
  reps: 'Repetitions',
  duration: 'Test duration',
  stepHeight: 'Step height',
  blocksMoved: 'Blocks moved',
  dominantHand: 'Dominant hand',
  'times.extensor': 'Trunk extensor hold time',
  'times.flexor': 'Trunk flexor hold time',
  'times.right_side': 'Right side-bridge hold time',
  'times.left_side': 'Left side-bridge hold time',
  score: 'Recorded score',
  checkedProblems: 'Distress problem checklist',
  finalTime: 'Recorded hold time',
  stopReason: 'Reason test stopped',
  'technique.qualityRating': 'Technique quality rating',
  'symptoms.postTestPain': 'Post-test pain',
  eyesOpenTime: 'Eyes-open stance time',
  eyesClosedTime: 'Eyes-closed stance time',
  assistanceNeeded: 'Assistance required',
  weight: 'Test load',
  pushUpCount: 'Completed push-ups',
  durationSeconds: 'Recorded test duration',
  preTest: 'Pre-test observations and vitals',
  postTest: 'Post-test observations and vitals',
  elapsed: 'Hold time',
  setup: 'Test setup',
  observations: 'Clinical observations',
  squatCount: 'Completed squats',
  testDuration: 'Test duration',
  bodyMass: 'Body mass',
  testWeight: 'Test weight',
  repetitions: 'Completed repetitions',
  trials: 'Recorded trials',
  selectedScore: 'Clinician-confirmed score',
  clinicalReasoning: 'Clinical reasoning',
  interview: 'Structured interview responses',
  dominantTime: 'Dominant-hand completion time',
  nonDominantTime: 'Non-dominant-hand completion time',
  dominantSide: 'Dominant side',
  assemblyPieces: 'Assembly pieces completed',
  kneeFlexionAngle: 'Knee flexion angle',
  hipFlexionObserved: 'Hip flexion observed',
  setupConfirmed: 'Setup checklist confirmed',
  testMode: 'Sides tested',
  translationGrade: 'Anterior translation grade',
  anteriorTranslation: 'Anterior translation distance',
  isPositive: 'Clinician-recorded test result',
  kneeAngle: 'Knee flexion angle at compression',
  painLevel: 'Pain intensity',
});

function choiceOptions(entries) {
  return entries.map(([label, value]) => ({ label, value }));
}

const SEX_OPTIONS = choiceOptions([['Male', 'male'], ['Female', 'female']]);
const SIDE_OPTIONS = choiceOptions([['Right', 'right'], ['Left', 'left']]);
const UPPER_SIDE_OPTIONS = choiceOptions([['Left', 'Left'], ['Right', 'Right'], ['Bilateral', 'Bilateral']]);
const GENDER_CODE_OPTIONS = choiceOptions([['Male', 'M'], ['Female', 'F']]);
const DISTRESS_PROBLEM_OPTIONS = Object.entries(DISTRESS_PROBLEM_LIST).flatMap(([group, problems]) => (
  problems.map((problem) => ({ label: problem, value: problem, group }))
));

const MRS_INTERVIEW_KEYS = Object.freeze([
  'walk_independently', 'needs_gait_aid', 'needs_dressing_help', 'needs_bathing_help',
  'needs_toileting_help', 'needs_meals_help', 'leave_home_independently', 'manage_medications',
  'manage_appointments', 'return_to_previous', 'needs_supervision', 'needs_constant_care',
]);

const MRS_OBSERVATIONS = Object.freeze([
  'Independent transfers observed', 'Ambulates independently', 'Uses gait aid', 'Requires verbal cueing',
  'Requires physical assistance', 'Communication impairment observed', 'Cognitive impairment observed',
  'Fatigue limits function', 'Balance impairment observed', 'Falls risk concern identified',
]);

const THOMAS_SIDE_CHOICES = deepFreeze({
  abduction: ['none', 'mild', 'moderate', 'marked'],
  externalRotation: ['none', 'mild', 'moderate', 'marked'],
  compensation: ['present', 'absent'],
  pain: ['yes', 'no'],
});

const TREND_SIGNS = deepFreeze({
  hip_drop: 'Contralateral Hip Drop',
  trunk_lurch: 'Trunk Lateral Lean / Compensatory Lurch',
  early_drop: 'Inability to Hold 30 Seconds',
  pelvic_obliquity: 'Pelvic Obliquity / Rotation',
});

function defineSpec({ runnerKey, name, kind = 'measurement', measurementType, primaryField, unit, formula, fields }) {
  const labelledFields = fields.map((field) => {
    const label = field.label || FIELD_LABELS[field.key];
    invariant(typeof label === 'string' && label.trim(), `${runnerKey}.${field.key} has no field label`);
    return { ...field, label };
  });
  return deepFreeze({
    schemaVersion: 1,
    kind,
    runnerKey,
    scoringKey: runnerKey,
    name,
    measurementType,
    fields: labelledFields,
    scoring: {
      version: SCORING_VERSION,
      formula,
      validation: 'Required fields, enumerations and numeric bounds are enforced before scoring; invalid inputs throw and do not persist.',
    },
    result: {
      primaryField,
      unit,
      persistence: ['result_value', 'additional_data.raw_input', 'additional_data.soap_text', 'additional_data.report_text'],
    },
  });
}

const SPECS = {
  arm_curl: defineSpec({
    runnerKey: 'arm_curl', name: '30-Second Seated Arm Curl Test', measurementType: 'arm_curl', primaryField: 'primary_side_reps', unit: 'repetitions',
    formula: 'Primary-side repetition count; absolute bilateral repetition difference; age/sex category from the existing Rikli-Jones table.',
    fields: [{ key: 'dominantSide', type: 'choice', required: true, options: SIDE_OPTIONS }, { key: 'testedSide', type: 'choice', required: true, options: SIDE_OPTIONS }, { key: 'rightReps', type: 'integer', required: false, min: 0 }, { key: 'leftReps', type: 'integer', required: false, min: 0 }, { key: 'weightKg', type: 'number', required: true, min: 0.1 }, { key: 'age', type: 'integer', required: false }, { key: 'sex', type: 'choice', required: true, options: SEX_OPTIONS }],
  }),
  '30sec_sts': defineSpec({
    runnerKey: '30sec_sts', name: '30-Second Sit-to-Stand Test', measurementType: '30-second sit-to-stand test', primaryField: 'standCount', unit: 'repetitions',
    formula: 'Count of completed stands during the completed 30-second interval.',
    fields: [
      { key: 'completed', type: 'boolean', required: true },
      { key: 'standCount', type: 'integer', required: true, min: 0, max: 300 },
      { key: 'handsUsed', type: 'boolean', required: true },
      { key: 'preHR', label: 'Pre-test heart rate', type: 'integer', required: true, min: 20, max: 300 },
      { key: 'postHR', label: 'Post-test heart rate', type: 'integer', required: false, min: 20, max: 300 },
      { key: 'symptoms', label: 'Symptoms during or after the test', type: 'text', required: false },
    ],
  }),
  triple_hop: defineSpec({
    runnerKey: 'triple_hop', name: 'Triple Hop Test for Distance', measurementType: 'triple_hop', primaryField: 'best_tested_side_cm', unit: 'cm',
    formula: 'Best valid trial per limb; LSI = tested-limb best / contralateral-limb best x 100, rounded to one decimal.',
    fields: [
      { key: 'side', type: 'choice', required: true, options: SIDE_OPTIONS },
      { key: 'rightTrials', type: 'number[]', required: false, minItems: 3, maxItems: 3, items: [{ key: 'distance', label: 'Right hop distance', type: 'number', required: false, min: 0.01, max: 10000 }] },
      { key: 'leftTrials', type: 'number[]', required: false, minItems: 3, maxItems: 3, items: [{ key: 'distance', label: 'Left hop distance', type: 'number', required: false, min: 0.01, max: 10000 }] },
    ],
  }),
  trendelenburg: defineSpec({
    runnerKey: 'trendelenburg', name: 'Trendelenburg Test', measurementType: 'Trendelenburg_Test', primaryField: 'overall_result', unit: 'binary',
    formula: 'Overall result is positive when either recorded side is positive; otherwise negative, with all side-specific signs retained.',
    fields: ['left', 'right'].map((key) => ({
      key,
      type: 'side-result',
      required: false,
      fields: [
        { key: 'result', label: 'Side result', type: 'choice', required: false, options: choiceOptions([['Positive', 'Positive'], ['Negative', 'Negative'], ['Equivocal', 'Equivocal']]) },
        {
          key: 'signs',
          label: 'Observed signs',
          type: 'boolean-map',
          required: false,
          fields: Object.entries(TREND_SIGNS).map(([signKey, label]) => ({ key: signKey, label, type: 'boolean', required: false })),
        },
      ],
    })),
  }),
  stair_climb: defineSpec({
    runnerKey: 'stair_climb', name: 'Stair Climb Test', measurementType: 'stair_climb_test', primaryField: 'timeSeconds', unit: 'seconds',
    formula: 'Recorded ascent time with current runner bands: under 6 excellent; 6-10 moderate; over 10 slow.',
    fields: [{ key: 'timeSeconds', type: 'number', required: true, min: 0.01 }, { key: 'stairCount', type: 'integer', required: true, min: 1 }, { key: 'handrailUse', type: 'boolean', required: true }, { key: 'gaitStability', type: 'choice', required: true, options: choiceOptions([['Stable', 'stable'], ['Cautious', 'cautious'], ['Unstable', 'unstable']]) }, { key: 'assistiveDevice', type: 'choice', required: true, options: choiceOptions([['None', 'none'], ['Cane', 'cane'], ['Frame', 'frame']]) }],
  }),
  two_min_step: defineSpec({
    runnerKey: 'two_min_step', name: '2-Minute Step Test', measurementType: 'two_min_step', primaryField: 'steps', unit: 'steps',
    formula: 'Right-knee step count with current age/sex Rikli-Jones category table.',
    fields: [
      { key: 'completed', type: 'boolean', required: true },
      { key: 'steps', type: 'integer', required: true, min: 0, max: 1000 },
      { key: 'age', type: 'integer', required: false, min: 1, max: 130 },
      { key: 'gender', type: 'choice', required: false, options: SEX_OPTIONS },
      { key: 'hrPre', label: 'Pre-test heart rate', type: 'integer', required: false, min: 20, max: 300 },
      { key: 'hrPost', label: 'Post-test heart rate', type: 'integer', required: false, min: 20, max: 300 },
      { key: 'bpPre', label: 'Pre-test blood pressure', type: 'text', required: false, pattern: '^\\d{2,3}/\\d{2,3}$' },
      { key: 'bpPost', label: 'Post-test blood pressure', type: 'text', required: false, pattern: '^\\d{2,3}/\\d{2,3}$' },
      { key: 'symptoms', label: 'Adverse symptoms during or after the test', type: 'textarea', required: false },
    ],
  }),
  step_tap: defineSpec({
    runnerKey: 'step_tap', name: 'Step Tap Test', measurementType: 'performance_timed', primaryField: 'taps', unit: 'taps',
    formula: 'Tap count and taps-per-second rate over the explicitly selected 15- or 30-second interval.',
    fields: [{ key: 'reps', type: 'integer', required: true, min: 0 }, { key: 'duration', type: 'choice', required: true, options: choiceOptions([['15 seconds', 15], ['30 seconds', 30]]) }, { key: 'stepHeight', type: 'number', required: true, min: 0.1 }],
  }),
  box_block_test: defineSpec({
    runnerKey: 'box_block_test', name: 'Box and Block Test', measurementType: 'box_and_block', primaryField: 'blocksMoved', unit: 'blocks',
    formula: 'Blocks moved in 60 seconds; current production comparison uses mean 80 and SD 10.',
    fields: [{ key: 'completed', type: 'boolean', required: true }, { key: 'blocksMoved', type: 'integer', required: true, min: 0 }, { key: 'age', type: 'integer', required: true }, { key: 'sex', type: 'choice', required: true, options: choiceOptions([['Male', 'male'], ['Female', 'female'], ['Other', 'other']]) }, { key: 'dominantHand', type: 'choice', required: true, options: SIDE_OPTIONS }],
  }),
  mcgill: defineSpec({
    runnerKey: 'mcgill', name: 'McGill Core Endurance Test Battery', measurementType: 'endurance_hold_battery', primaryField: 'extensor', unit: 'seconds',
    formula: 'Four hold times plus flexor/extensor, each side/extensor and side-symmetry ratios rounded to two decimals.',
    fields: [{
      key: 'times', label: 'Core endurance hold times', type: 'object', required: true,
      fields: [
        { key: 'extensor', label: 'Trunk extensor hold time', type: 'number', required: true, min: 0.1, max: 3600 },
        { key: 'flexor', label: 'Trunk flexor hold time', type: 'number', required: true, min: 0.1, max: 3600 },
        { key: 'right_side', label: 'Right side-bridge hold time', type: 'number', required: true, min: 0.1, max: 3600 },
        { key: 'left_side', label: 'Left side-bridge hold time', type: 'number', required: true, min: 0.1, max: 3600 },
      ],
    }],
  }),
  '60sec_sts': defineSpec({
    runnerKey: '60sec_sts', name: '60-Second Sit-to-Stand Test', measurementType: 'sixty_sec_sts', primaryField: 'reps', unit: 'repetitions',
    formula: 'Count of completed stands with current age/sex category table.',
    fields: [
      { key: 'completed', type: 'boolean', required: true },
      { key: 'reps', type: 'integer', required: true, min: 0, max: 300 },
      { key: 'handsUsed', type: 'boolean', required: true },
      { key: 'age', type: 'integer', required: false, min: 1, max: 130 },
      { key: 'gender', type: 'choice', required: false, options: SEX_OPTIONS },
      { key: 'hrPre', label: 'Pre-test heart rate', type: 'integer', required: false, min: 20, max: 300 },
      { key: 'bpPre', label: 'Pre-test blood pressure', type: 'text', required: false, pattern: '^\\d{2,3}/\\d{2,3}$' },
      { key: 'hrPost', label: 'Post-test heart rate', type: 'integer', required: false, min: 20, max: 300 },
      { key: 'bpPost', label: 'Post-test blood pressure', type: 'text', required: false, pattern: '^\\d{2,3}/\\d{2,3}$' },
    ],
  }),
  distress_thermometer: defineSpec({
    runnerKey: 'distress_thermometer', name: 'Distress Thermometer', measurementType: 'distress_thermometer', primaryField: 'score', unit: 'points',
    formula: 'Integer 0-10 score; 0-3 mild, 4-6 moderate and 7-10 severe; selected problem-list categories retained.',
    fields: [{ key: 'score', type: 'integer', required: true, min: 0, max: 10 }, { key: 'checkedProblems', type: 'choice-map', required: true, options: DISTRESS_PROBLEM_OPTIONS }],
  }),
  static_back: defineSpec({
    runnerKey: 'static_back', name: 'Static Back Extension (Biering-Sørensen Test)', measurementType: 'endurance_hold', primaryField: 'finalTime', unit: 'seconds',
    formula: 'Hold time plus existing age/sex z-score band, stop reason, technique, symptoms, flags and narrative interpretation.',
    fields: [
      { key: 'finalTime', type: 'number', required: true, min: 0.1, max: 3600 },
      { key: 'stopReason', type: 'choice', required: true, options: choiceOptions([['Fatigue', 'Fatigue'], ['Pain', 'Pain'], ['Loss of horizontal position', 'Loss of horizontal position'], ['>10° trunk drop', '>10° trunk drop'], ['Client requested stop', 'Client requested stop'], ['Safety concern', 'Safety concern'], ['Reached maximum / test ceiling', 'Reached maximum / test ceiling'], ['Other', 'Other']]) },
      { key: 'otherStopReason', label: 'Other stop-reason details', type: 'text', required: 'when-stop-reason-other' },
      { key: 'reachedMaxDuration', label: 'Reached maximum test duration', type: 'boolean', required: true },
      { key: 'age', label: 'Age at assessment', type: 'integer', required: false, min: 1, max: 130 },
      { key: 'gender', label: 'Sex used for reference comparison', type: 'choice', required: false, options: SEX_OPTIONS },
      {
        key: 'setup', label: 'Equipment, positioning and baseline setup', type: 'object', required: true,
        fields: [
          { key: 'equipment', label: 'Equipment used', type: 'text', required: false },
          { key: 'securing', label: 'Lower-body securing method', type: 'choice', required: true, options: choiceOptions([['Straps', 'straps'], ['Clinician stabilisation', 'clinician'], ['Straps and clinician', 'both'], ['Not secured', 'none'], ['Other', 'other']]) },
          { key: 'armsPosition', label: 'Arms position', type: 'choice', required: true, options: choiceOptions([['Crossed over chest', 'crossed'], ['Hands by sides', 'sides'], ['Modified position', 'modified']]) },
          { key: 'testModified', label: 'Test modified', type: 'boolean', required: true },
          { key: 'modificationNote', label: 'Modification details', type: 'textarea', required: 'when-test-modified' },
          { key: 'baselinePain', label: 'Baseline pain', type: 'number', required: true, min: 0, max: 10 },
        ],
      },
      {
        key: 'technique', label: 'Technique observations and quality', type: 'object', required: true,
        fields: [
          { key: 'maintainedHorizontal', label: 'Maintained horizontal trunk position', type: 'boolean', required: false },
          { key: 'excessiveLumbarExtension', label: 'Excessive lumbar extension observed', type: 'boolean', required: false },
          { key: 'hipPelvicRotation', label: 'Hip or pelvic rotation observed', type: 'boolean', required: false },
          { key: 'shoulderCompensation', label: 'Shoulder compensation observed', type: 'boolean', required: false },
          { key: 'breathHolding', label: 'Breath holding observed', type: 'boolean', required: false },
          { key: 'requiredVerbalCueing', label: 'Required verbal cueing', type: 'boolean', required: false },
          { key: 'qualityRating', label: 'Overall technique quality', type: 'choice', required: true, options: choiceOptions([['Poor', 'Poor'], ['Fair', 'Fair'], ['Good', 'Good'], ['Excellent', 'Excellent']]) },
        ],
      },
      {
        key: 'symptoms', label: 'Pain, symptom and exertion response', type: 'object', required: true,
        fields: [
          { key: 'painDuring', label: 'Pain during test', type: 'number', required: true, min: 0, max: 10 },
          { key: 'painLocations', label: 'Pain locations', type: 'multi-select', required: false, minItems: 0, maxItems: 6, options: ['Lumbar', 'Thoracic', 'Gluteal', 'Hamstring', 'Radicular leg symptoms', 'Other'].map((value) => ({ label: value, value })) },
          { key: 'symptomsIncreased', label: 'Symptoms increased from baseline', type: 'boolean', required: false },
          { key: 'neurologicalSymptoms', label: 'Neurological symptoms reported', type: 'boolean', required: false },
          { key: 'postTestPain', label: 'Post-test pain', type: 'number', required: true, min: 0, max: 10 },
          { key: 'rpeAfter', label: 'Post-test perceived exertion', type: 'number', required: true, min: 0, max: 10 },
        ],
      },
    ],
  }),
  rombergs_standing: defineSpec({
    runnerKey: 'rombergs_standing', name: "Romberg's Test of Standing Balance", measurementType: "Romberg's Test", primaryField: 'eyesClosedTime', unit: 'seconds',
    formula: 'Eyes-closed time when recorded, otherwise eyes-open time; current Romberg and falls-risk logic retained.',
    fields: [
      { key: 'surfaceType', label: 'Surface type', type: 'choice', required: false, options: choiceOptions([['Firm floor', 'Firm floor'], ['Foam pad', 'Foam pad'], ['Balance pad', 'Balance pad'], ['Uneven surface', 'Uneven surface'], ['Other', 'Other']]) },
      { key: 'footPosition', label: 'Foot position', type: 'choice', required: false, options: choiceOptions([['Feet together', 'Feet together'], ['Semi-tandem', 'Semi-tandem'], ['Tandem', 'Tandem'], ['Single leg', 'Single leg'], ['Other', 'Other']]) },
      { key: 'footwear', label: 'Footwear', type: 'choice', required: false, options: choiceOptions([['Shoes on', 'Shoes on'], ['Barefoot', 'Barefoot'], ['Orthotics', 'Orthotics'], ['Other', 'Other']]) },
      { key: 'assistanceLevel', label: 'Assistance level', type: 'choice', required: false, options: choiceOptions([['Independent', 'Independent'], ['Supervision only', 'Supervision only'], ['Contact guard', 'Contact guard'], ['Minimal assist', 'Minimal assist'], ['Moderate assist', 'Moderate assist'], ['Max assist', 'Max assist']]) },
      { key: 'eyesOpenTime', label: 'Eyes-open hold time', type: 'number', required: false, min: 0, max: 30 },
      { key: 'eoSwayObserved', label: 'Eyes-open sway observed', type: 'choice', required: false, options: choiceOptions([['Yes', 'Yes'], ['No', 'No']]) },
      { key: 'eoSwaySeverity', label: 'Eyes-open sway severity', type: 'choice', required: false, options: choiceOptions([['None', 'None'], ['Mild', 'Mild'], ['Moderate', 'Moderate'], ['Severe', 'Severe']]) },
      { key: 'eoSwayDirection', label: 'Eyes-open sway direction', type: 'choice', required: false, options: choiceOptions([['Anterior/posterior', 'Anterior/posterior'], ['Medial/lateral', 'Medial/lateral'], ['Multi-directional', 'Multi-directional'], ['Not observed', 'Not observed']]) },
      { key: 'eyesClosedTime', label: 'Eyes-closed hold time', type: 'number', required: false, min: 0, max: 30 },
      { key: 'ecSwayObserved', label: 'Eyes-closed sway observed', type: 'choice', required: false, options: choiceOptions([['Yes', 'Yes'], ['No', 'No']]) },
      { key: 'ecSwaySeverity', label: 'Eyes-closed sway severity', type: 'choice', required: false, options: choiceOptions([['None', 'None'], ['Mild', 'Mild'], ['Moderate', 'Moderate'], ['Severe', 'Severe']]) },
      { key: 'ecSwayDirection', label: 'Eyes-closed sway direction', type: 'choice', required: false, options: choiceOptions([['Anterior/posterior', 'Anterior/posterior'], ['Medial/lateral', 'Medial/lateral'], ['Multi-directional', 'Multi-directional'], ['Not observed', 'Not observed']]) },
      { key: 'completedFull', label: 'Completed full 30-second duration', type: 'choice', required: false, options: choiceOptions([['Yes', 'Yes'], ['No', 'No']]) },
      { key: 'lossOfBalance', label: 'Loss of balance', type: 'choice', required: false, options: choiceOptions([['Yes', 'Yes'], ['No', 'No']]) },
      { key: 'stepTaken', label: 'Step taken', type: 'choice', required: false, options: choiceOptions([['Yes', 'Yes'], ['No', 'No']]) },
      { key: 'requiresAssistance', label: 'Required clinician assistance', type: 'choice', required: false, options: choiceOptions([['Yes', 'Yes'], ['No', 'No']]) },
      { key: 'stopReason', label: 'Reason test stopped', type: 'choice', required: false, options: choiceOptions([['Completed full duration', 'Completed full duration'], ['Excessive sway', 'Excessive sway'], ['Stepped out', 'Stepped out'], ['Required assistance', 'Required assistance'], ['Client felt unsafe', 'Client felt unsafe'], ['Clinician stopped for safety', 'Clinician stopped for safety'], ['Other', 'Other']]) },
    ],
  }),
  shoulder_tug: defineSpec({
    runnerKey: 'shoulder_tug', name: "Shoulder Tug Test (Pastor's Test)", measurementType: 'shoulder_tug_test', primaryField: 'steps', unit: 'steps',
    formula: 'Recovery-step count with current four-band reactive-balance interpretation and assistance observation.',
    fields: [{ key: 'steps', type: 'integer', required: true, min: 0 }, { key: 'assistanceNeeded', type: 'boolean', required: true }],
  }),
  gst: defineSpec({
    runnerKey: 'gst', name: 'Grocery Shelving Test', measurementType: 'performance_timed', primaryField: 'reps', unit: 'items',
    formula: 'Items placed in 30 seconds; current bands are >=18 excellent, >=14 good, >=10 average, otherwise below average.',
    fields: [{ key: 'reps', type: 'integer', required: true, min: 0 }, { key: 'side', type: 'choice', required: true, options: choiceOptions([['Bilateral', 'bilateral'], ['Right', 'right'], ['Left', 'left']]) }, { key: 'weight', type: 'choice', required: true, options: choiceOptions([['400 g (standard)', '400g'], ['500 g', '500g'], ['800 g', '800g'], ['1 kg', '1kg']]) }],
  }),
  timed_push_up: defineSpec({
    runnerKey: 'timed_push_up', name: 'Timed Push-Up Test', measurementType: 'Timed Push-Up Test', primaryField: 'pushUpCount', unit: 'repetitions',
    formula: 'Correctly completed push-ups during the recorded interval with pre/post vitals and quality observations.',
    fields: [
      { key: 'completed', type: 'boolean', required: true },
      { key: 'pushUpCount', type: 'integer', required: true, min: 0 },
      { key: 'durationSeconds', type: 'number', required: true, min: 0, max: 60 },
      ...['preTest', 'postTest'].map((key) => ({
        key,
        type: 'vitals',
        required: true,
        fields: [
          { key: 'hr', label: 'Heart rate', type: 'integer', required: true, min: 20, max: 300 },
          { key: 'bp', label: 'Blood pressure', type: 'text', required: true, pattern: '^\\d{2,3}/\\d{2,3}$' },
          { key: 'spo2', label: 'Oxygen saturation', type: 'number', required: true, min: 0, max: 100 },
        ],
      })),
      { key: 'qualityNotes', label: 'Movement-quality observations', type: 'textarea', required: false },
    ],
  }),
  static_squat: defineSpec({
    runnerKey: 'static_squat', name: 'Static Squat Test (Wall Squat)', measurementType: 'static_squat', primaryField: 'elapsed', unit: 'seconds',
    formula: 'Hold time classified against the current age/sex table with setup, pain/fatigue, movement observations and flags retained.',
    fields: [
      { key: 'completed', type: 'boolean', required: true }, { key: 'elapsed', type: 'number', required: true, min: 0.1, max: 3600 }, { key: 'age', type: 'integer', required: true, min: 18, max: 120 }, { key: 'gender', type: 'choice', required: true, options: SEX_OPTIONS },
      {
        key: 'setup', type: 'object', required: true, fields: [
          { key: 'knee_angle', label: 'Knee flexion angle', type: 'integer', required: true, min: 60, max: 120 },
          { key: 'footwear', label: 'Footwear', type: 'choice', required: true, options: choiceOptions([['Barefoot', 'barefoot'], ['Shoes', 'shoes']]) },
          { key: 'surface', label: 'Support surface', type: 'choice', required: true, options: choiceOptions([['Wall-supported', 'wall'], ['Free-standing', 'free']]) },
          { key: 'back_contact', label: 'Back contact', type: 'choice', required: true, options: choiceOptions([['Full', 'full'], ['Partial', 'partial']]) },
          { key: 'feet_position', label: 'Feet position', type: 'choice', required: true, options: choiceOptions([['Shoulder width', 'shoulder_width'], ['Hip width', 'hip_width'], ['Narrow', 'narrow']]) },
          { key: 'pain_pre', label: 'Pre-test pain', type: 'number', required: true, min: 0, max: 10 },
          { key: 'fatigue_pre', label: 'Pre-test fatigue', type: 'number', required: true, min: 0, max: 10 },
          { key: 'dominant', label: 'Dominant side', type: 'choice', required: true, options: choiceOptions([['Right', 'right'], ['Left', 'left'], ['Bilateral', 'bilateral']]) },
          { key: 'symptomatic', label: 'Symptomatic side', type: 'choice', required: true, options: choiceOptions([['None', 'none'], ['Right', 'right'], ['Left', 'left'], ['Bilateral', 'bilateral']]) },
        ],
      },
      {
        key: 'observations', type: 'boolean-map', required: true, fields: [
          ['knee_valgus', 'Knee valgus'], ['heel_rise', 'Heel rise'], ['back_arch', 'Back arch'],
          ['trembling', 'Trembling'], ['pain_provoked', 'Pain provoked'], ['required_guarding', 'Guarding required'],
        ].map(([key, label]) => ({ key, label, type: 'boolean', required: true })),
      },
      { key: 'stopReason', label: 'Reason the test stopped', type: 'choice', required: true, options: choiceOptions([['Voluntary stop', 'Voluntary stop'], ['Pain — unable to continue', 'Pain — unable to continue'], ['Knee valgus collapse', 'Knee valgus collapse'], ['Heel rise', 'Heel rise'], ['Lost wall contact', 'Lost wall contact']]) },
      { key: 'painPost', label: 'Post-test pain', type: 'number', required: true, min: 0, max: 10 },
      { key: 'fatiguePost', label: 'Post-test fatigue', type: 'number', required: true, min: 0, max: 10 },
    ],
  }),
  squat: defineSpec({
    runnerKey: 'squat', name: 'Squat Test (Dynamic)', measurementType: 'dynamic_squat', primaryField: 'squatCount', unit: 'repetitions',
    formula: 'Repetition count in the fixed 60-second production protocol; current >=40/30/20/10 interpretation bands and five quality observations retained.',
    fields: [
      { key: 'squatCount', type: 'integer', required: true, min: 1 },
      { key: 'testDuration', type: 'integer', required: true, const: 60 },
      { key: 'age', label: 'Age at assessment', type: 'integer', required: false, min: 1, max: 130 },
      { key: 'bodyWeight', label: 'Body weight', type: 'number', required: false, min: 0.1, max: 1000 },
      {
        key: 'observations', type: 'boolean-map', required: true, fields: [
          ['chestUp', 'Maintained upright chest'], ['kneeTracking', 'Knees tracked over toes'],
          ['fullDepth', 'Achieved full squat depth'], ['noCompensation', 'No compensatory pattern'],
          ['consistentPace', 'Maintained consistent pace'],
        ].map(([key, label]) => ({ key, label, type: 'boolean', required: true })),
      },
      { key: 'preTestNotes', label: 'Pre-test notes', type: 'textarea', required: false },
      { key: 'postTestNotes', label: 'Post-test notes', type: 'textarea', required: false },
    ],
  }),
  ymca_bench: defineSpec({
    runnerKey: 'ymca_bench', name: 'Allied Upper Body Endurance Press Test', measurementType: 'allied_bench_press_endurance', primaryField: 'repetitions', unit: 'repetitions',
    formula: 'Repetition count using the current sex-specific endurance bands, with load, cadence, RPE and pain response retained.',
    fields: [
      { key: 'completed', type: 'boolean', required: true },
      { key: 'bodyMass', type: 'number', required: true, min: 0.1, max: 1000 },
      { key: 'gender', type: 'choice', required: true, options: GENDER_CODE_OPTIONS },
      { key: 'testWeight', type: 'number', required: true, min: 0.1, max: 1000 },
      { key: 'repetitions', type: 'integer', required: true, min: 0, max: 1000 },
      { key: 'cadenceBreakdown', label: 'Cadence breakdown', type: 'choice', required: true, options: choiceOptions([['No', 'no'], ['Yes', 'yes']]) },
      { key: 'rpe', label: 'Post-test perceived exertion', type: 'integer', required: false, min: 0, max: 10 },
      { key: 'painPresent', label: 'Pain present during test', type: 'choice', required: true, options: choiceOptions([['No', 'no'], ['Yes', 'yes']]) },
    ],
  }),
  '5xsts': defineSpec({
    runnerKey: '5xsts', name: 'Five Times Sit-to-Stand Test', measurementType: '5sts', primaryField: 'totalTime', unit: 'seconds',
    formula: 'Exactly five monotonically increasing cumulative stand timestamps; total is the fifth timestamp rounded to two decimals.',
    fields: [{ key: 'trials', type: 'number[]', required: true, minItems: 5, maxItems: 5, items: [{ key: 'cumulativeTime', label: 'Cumulative stand time', type: 'number', required: true, min: 0.01, max: 600 }] }],
  }),
  fac: defineSpec({
    runnerKey: 'fac', name: 'Functional Ambulation Categories', measurementType: 'ordinal_scale', primaryField: 'score', unit: 'points',
    formula: 'Selected integer FAC category from 0 to 5 with canonical label and description.',
    fields: [{ key: 'score', type: 'integer', required: true, min: 0, max: 5 }],
  }),
  modified_rankin: defineSpec({
    runnerKey: 'modified_rankin', name: 'Modified Rankin Scale', measurementType: 'modified_rankin', primaryField: 'selectedScore', unit: 'points',
    formula: 'Clinician-selected grade 0-6 with existing structured-interview suggestion, change and risk-flag logic.',
    fields: [
      { key: 'selectedScore', type: 'integer', required: true, min: 0, max: 6 },
      { key: 'clinicalReasoning', type: 'text', required: true },
      {
        key: 'interview', type: 'choice-map', required: false, fields: MRS_INTERVIEW_KEYS.map((key) => ({
          key,
          label: key.replace(/_/g, ' '),
          type: 'choice',
          required: false,
          options: choiceOptions([['Yes', 'yes'], ['No', 'no'], ['Unable to assess', 'unable']]),
        })),
      },
      {
        key: 'observations', type: 'string[]', required: true, minItems: 0, maxItems: MRS_OBSERVATIONS.length,
        items: [{ key: 'observation', label: 'Functional observation', type: 'choice', required: false, options: MRS_OBSERVATIONS.map((value) => ({ label: value, value })) }],
      },
      {
        key: 'clinicalContext', label: 'Clinical context', type: 'object', required: false,
        fields: [
          { key: 'diagnosis', label: 'Primary diagnosis or reason for assessment', type: 'text', required: false },
          { key: 'eventDate', label: 'Date of neurological event or stroke', type: 'date', required: false },
          { key: 'affectedSide', label: 'Affected side', type: 'text', required: false },
          { key: 'livingSituation', label: 'Living situation', type: 'text', required: false },
          { key: 'supports', label: 'Current supports or carers', type: 'text', required: false },
          { key: 'previousScore', label: 'Previous Modified Rankin Scale score', type: 'integer', required: false, min: 0, max: 6 },
          { key: 'previousScoreDate', label: 'Date of previous score', type: 'date', required: false },
        ],
      },
    ],
  }),
  nine_peg: defineSpec({
    runnerKey: 'nine_peg', name: 'Nine-Hole Peg Test', measurementType: 'nine_hole_peg_test', primaryField: 'dominantTime', unit: 'seconds',
    formula: 'Dominant-hand time is primary; optional non-dominant time and current sex/side z-score classifications retained.',
    fields: [{ key: 'dominantTime', type: 'number', required: true, min: 0.01 }, { key: 'nonDominantTime', type: 'number', required: false, min: 0.01 }, { key: 'dominantSide', type: 'choice', required: true, options: SIDE_OPTIONS }, { key: 'gender', type: 'choice', required: false, options: SEX_OPTIONS }],
  }),
  grooved_peg: defineSpec({
    runnerKey: 'grooved_peg', name: 'Grooved Pegboard Test', measurementType: 'grooved_pegboard_test', primaryField: 'dominantTime', unit: 'seconds',
    formula: 'Dominant-hand peg time is primary; non-dominant time, drops and 30-second assembly pieces retained.',
    fields: [{ key: 'dominantTime', type: 'number', required: true, min: 0.01, max: 300 }, { key: 'nonDominantTime', type: 'number', required: false, min: 0.01, max: 300 }, { key: 'assemblyPieces', type: 'integer', required: false, min: 0, max: 1000 }, { key: 'dominantDrops', label: 'Dominant-hand drops', type: 'integer', required: true, min: 0, max: 1000 }, { key: 'nonDominantDrops', label: 'Non-dominant-hand drops', type: 'integer', required: true, min: 0, max: 1000 }, { key: 'dominantHand', type: 'choice', required: true, options: SIDE_OPTIONS }],
  }),
  elys_test: defineSpec({
    runnerKey: 'elys_test', name: "Ely's Test", measurementType: 'angle', primaryField: 'kneeFlexionAngle', unit: 'degrees',
    formula: 'Positive when knee flexion is below 120 degrees or hip flexion is observed; otherwise negative.',
    fields: [{ key: 'kneeFlexionAngle', type: 'number', required: true, min: 0.1, max: 180 }, { key: 'hipFlexionObserved', type: 'boolean', required: true }],
  }),
  thomas_test: defineSpec({
    runnerKey: 'thomas_test', name: 'Thomas Test', measurementType: 'thomas_test', primaryField: 'primaryHipAngle', unit: 'degrees',
    formula: 'Primary-side hip angle plus existing iliopsoas, rectus femoris, TFL/ITB, rotation, compensation, pain, recommendation and red-flag logic.',
    fields: [
      { key: 'setupConfirmed', type: 'boolean', required: true },
      { key: 'testMode', type: 'choice', required: true, options: choiceOptions([['Right only', 'right'], ['Left only', 'left'], ['Bilateral', 'bilateral']]) },
      ...['right', 'left'].map((key) => ({
        key,
        type: 'side-measurement',
        required: 'mode-dependent',
        fields: [
          { key: 'hipAngle', label: 'Hip flexion angle above table', type: 'number', required: true, min: -30, max: 90 },
          { key: 'kneeAngle', label: 'Knee flexion angle', type: 'number', required: true, min: 0, max: 180 },
          { key: 'abduction', label: 'Hip abduction', type: 'choice', required: true, options: THOMAS_SIDE_CHOICES.abduction.map((value) => ({ label: value, value })) },
          { key: 'externalRotation', label: 'External rotation', type: 'choice', required: true, options: THOMAS_SIDE_CHOICES.externalRotation.map((value) => ({ label: value, value })) },
          { key: 'painPresent', label: 'Pain present', type: 'choice', required: true, options: choiceOptions([['Yes', 'yes'], ['No', 'no']]) },
          { key: 'painLocation', label: 'Pain location', type: 'text', required: 'when-pain-present' },
          { key: 'painSeverity', label: 'Pain severity', type: 'number', required: 'when-pain-present', min: 0, max: 10 },
          { key: 'pelvicCompensation', label: 'Pelvic compensation', type: 'choice', required: true, options: choiceOptions([['Present', 'present'], ['Absent', 'absent']]) },
          { key: 'lumbarExtension', label: 'Lumbar extension compensation', type: 'choice', required: true, options: choiceOptions([['Present', 'present'], ['Absent', 'absent']]) },
        ],
      })),
    ],
  }),
  anterior_drawer_knee: defineSpec({
    runnerKey: 'anterior_drawer_knee', name: 'Anterior Drawer Test (Knee)', measurementType: 'anterior_drawer_knee', primaryField: 'overallResult', unit: 'binary',
    formula: 'Positive for grade 2+/3+ or measured anterior translation over 5 mm; otherwise negative.',
    fields: [
      { key: 'side', type: 'choice', required: true, options: UPPER_SIDE_OPTIONS },
      { key: 'translationGrade', type: 'choice', required: false, options: choiceOptions([['Grade 0 – No laxity (<3 mm)', '0'], ['Grade 1+ – Mild laxity (3–5 mm)', '1+'], ['Grade 2+ – Moderate laxity (6–10 mm)', '2+'], ['Grade 3+ – Severe laxity (>10 mm)', '3+']]) },
      { key: 'anteriorTranslation', type: 'number', required: false, min: 0, max: 50 },
      { key: 'endFeel', label: 'End feel', type: 'choice', required: false, options: choiceOptions([['Firm/Normal (intact ACL)', 'Firm/Normal (intact ACL)'], ['Soft/Abnormal (ACL insufficiency)', 'Soft/Abnormal (ACL insufficiency)'], ['Hard/Bony', 'Hard/Bony'], ['Empty (pain limits full assessment)', 'Empty (pain limits full assessment)'], ['Absent end-feel (complete rupture suspected)', 'Absent end-feel (complete rupture suspected)']]) },
      { key: 'painOnTest', label: 'Pain reproduced on test', type: 'choice', required: false, options: choiceOptions([['No pain', 'No pain'], ['Mild pain (1–3/10)', 'Mild pain (1–3/10)'], ['Moderate pain (4–6/10)', 'Moderate pain (4–6/10)'], ['Severe pain (7–10/10)', 'Severe pain (7–10/10)']]) },
      { key: 'painLocation', label: 'Pain location', type: 'text', required: false },
      { key: 'comparedToContralateral', label: 'Comparison to contralateral side', type: 'text', required: false },
      { key: 'suspectedACLTear', label: 'Suspected ACL injury', type: 'choice', required: false, options: choiceOptions([['No – Test negative, ACL likely intact', 'No – Test negative, ACL likely intact'], ['Inconclusive – Further investigation recommended', 'Inconclusive – Further investigation recommended'], ['Yes – Positive test, partial ACL tear suspected', 'Yes – Positive test, partial ACL tear suspected'], ['Yes – Positive test, complete ACL rupture suspected', 'Yes – Positive test, complete ACL rupture suspected']]) },
      { key: 'additionalFindings', label: 'Additional findings', type: 'text', required: false },
    ],
  }),
  noble_compression: defineSpec({
    runnerKey: 'noble_compression', name: 'Noble Compression Test', measurementType: 'Noble Compression Test', primaryField: 'isPositive', unit: 'binary',
    formula: 'Clinician-recorded positive/negative result with side, knee angle and pain response retained.',
    fields: [
      { key: 'isPositive', type: 'boolean', required: true },
      { key: 'side', type: 'choice', required: true, options: SIDE_OPTIONS },
      { key: 'kneeAngle', type: 'number', required: true, min: 0, max: 180 },
      { key: 'reproduced', label: 'Pain reproduced at approximately 30 degrees flexion', type: 'boolean', required: false },
      { key: 'painLevel', type: 'number', required: false, min: 0, max: 10 },
      { key: 'painType', label: 'Pain quality or type', type: 'choice', required: false, options: choiceOptions([['Sharp', 'Sharp'], ['Burning', 'Burning'], ['Aching', 'Aching'], ['Stabbing', 'Stabbing'], ['Pressure', 'Pressure'], ['Tingling', 'Tingling'], ['None', 'None']]) },
      { key: 'painLocation', label: 'Pain location', type: 'choice', required: false, options: choiceOptions([['Lateral femoral condyle', 'Lateral femoral condyle'], ['Distal ITB', 'Distal ITB'], ["Gerdy's tubercle", "Gerdy's tubercle"], ['Along ITB tract', 'Along ITB tract'], ['Other', 'Other']]) },
    ],
  }),
};

export const RUNNER_SPEC_BY_KEY = deepFreeze(SPECS);
export const RUNNER_SPECS = Object.freeze(RUNNER_KEYS.map((key) => RUNNER_SPEC_BY_KEY[key]));

export const ARM_CURL_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.arm_curl;
export const THIRTY_SECOND_STS_RUNNER_SPEC = RUNNER_SPEC_BY_KEY['30sec_sts'];
export const TRIPLE_HOP_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.triple_hop;
export const TRENDELENBURG_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.trendelenburg;
export const STAIR_CLIMB_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.stair_climb;
export const TWO_MIN_STEP_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.two_min_step;
export const STEP_TAP_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.step_tap;
export const BOX_BLOCK_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.box_block_test;
export const MCGILL_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.mcgill;
export const SIXTY_SECOND_STS_RUNNER_SPEC = RUNNER_SPEC_BY_KEY['60sec_sts'];
export const DISTRESS_THERMOMETER_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.distress_thermometer;
export const STATIC_BACK_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.static_back;
export const ROMBERG_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.rombergs_standing;
export const SHOULDER_TUG_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.shoulder_tug;
export const GST_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.gst;
export const TIMED_PUSH_UP_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.timed_push_up;
export const STATIC_SQUAT_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.static_squat;
export const SQUAT_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.squat;
export const YMCA_BENCH_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.ymca_bench;
export const FIVE_X_STS_RUNNER_SPEC = RUNNER_SPEC_BY_KEY['5xsts'];
export const FAC_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.fac;
export const MODIFIED_RANKIN_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.modified_rankin;
export const NINE_PEG_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.nine_peg;
export const GROOVED_PEG_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.grooved_peg;
export const ELYS_TEST_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.elys_test;
export const THOMAS_TEST_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.thomas_test;
export const ANTERIOR_DRAWER_KNEE_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.anterior_drawer_knee;
export const NOBLE_COMPRESSION_RUNNER_SPEC = RUNNER_SPEC_BY_KEY.noble_compression;

const DISTRESS_PROBLEM_SET = new Set(Object.values(DISTRESS_PROBLEM_LIST).flat());

const FAC_LEVELS = deepFreeze([
  { score: 0, label: 'Non-functional', description: 'Cannot ambulate, or requires assistance of 2 or more people.' },
  { score: 1, label: 'Ambulatory — dependent Level II', description: 'Requires continuous manual contact from 1 person (support/balance).' },
  { score: 2, label: 'Ambulatory — dependent Level I', description: 'Requires continuous or intermittent touching by person (balance/guarding).' },
  { score: 3, label: 'Ambulatory — dependent supervision', description: 'Requires verbal cuing or supervisory presence without physical contact.' },
  { score: 4, label: 'Ambulatory — independent on level', description: 'Can walk independently on level surfaces only (not on stairs/ramps/uneven terrain).' },
  { score: 5, label: 'Ambulatory — independent', description: 'Can walk independently on level and non-level surfaces, stairs, and ramps.' },
]);

const MRS_GRADES = deepFreeze([
  { score: 0, label: 'No symptoms', description: 'No symptoms at all.' },
  { score: 1, label: 'No significant disability', description: 'No significant disability despite symptoms; able to carry out all usual duties and activities.' },
  { score: 2, label: 'Slight disability', description: 'Unable to carry out all previous activities, but able to look after own affairs without assistance.' },
  { score: 3, label: 'Moderate disability', description: 'Requiring some help, but able to walk without assistance.' },
  { score: 4, label: 'Moderately severe disability', description: 'Unable to walk without assistance and unable to attend to own bodily needs without assistance.' },
  { score: 5, label: 'Severe disability', description: 'Bedridden, incontinent, and requiring constant nursing care and attention.' },
  { score: 6, label: 'Dead', description: 'Deceased.' },
]);

const ARM_CURL_NORMS = deepFreeze([
  ['male', 60, 64, 16, 22], ['male', 65, 69, 15, 21], ['male', 70, 74, 14, 21],
  ['male', 75, 79, 13, 19], ['male', 80, 84, 13, 19], ['male', 85, 89, 11, 17],
  ['male', 90, 94, 10, 14], ['female', 60, 64, 13, 19], ['female', 65, 69, 12, 18],
  ['female', 70, 74, 12, 17], ['female', 75, 79, 11, 17], ['female', 80, 84, 10, 16],
  ['female', 85, 89, 10, 16], ['female', 90, 94, 8, 13],
]);

const TWO_MIN_STEP_NORMS = deepFreeze([
  [60, 64, [87, 115], [75, 107]], [65, 69, [86, 116], [73, 107]],
  [70, 74, [80, 110], [68, 101]], [75, 79, [73, 109], [68, 100]],
  [80, 84, [71, 103], [60, 91]], [85, 89, [59, 91], [55, 85]],
]);

const SIXTY_STS_NORMS = deepFreeze([
  [60, 69, [29, 37], [24, 33]], [70, 79, [24, 32], [20, 28]], [80, 89, [19, 27], [15, 22]],
]);

const STATIC_BACK_NORMS = deepFreeze({
  male: [[20, 29, 201, 58], [30, 39, 189, 53], [40, 49, 175, 52], [50, 59, 164, 56], [60, 79, 140, 51]],
  female: [[20, 29, 189, 60], [30, 39, 165, 56], [40, 49, 152, 58], [50, 59, 148, 60], [60, 79, 131, 53]],
});

const STATIC_SQUAT_NORMS = deepFreeze([
  [18, 29, '18–29 yrs', [100, 75, 50, 25], [90, 65, 45, 20]],
  [30, 39, '30–39 yrs', [90, 65, 45, 20], [80, 55, 38, 18]],
  [40, 49, '40–49 yrs', [75, 55, 35, 15], [65, 45, 30, 15]],
  [50, 59, '50–59 yrs', [60, 45, 28, 12], [55, 38, 24, 10]],
  [60, 69, '60–69 yrs', [50, 35, 20, 10], [45, 30, 18, 8]],
  [70, 120, '70+ yrs', [35, 22, 12, 5], [30, 18, 10, 4]],
]);

const NINE_PEG_NORMS = deepFreeze({
  male: { right: { mean: 19.0, sd: 3.2 }, left: { mean: 20.6, sd: 3.9 } },
  female: { right: { mean: 17.9, sd: 2.8 }, left: { mean: 19.6, sd: 3.4 } },
});

function normalizeTrials(values, field, { required = false, exactLength = 3, max = 10000 } = {}) {
  invariant(Array.isArray(values), `${field} must be an array`);
  invariant(values.length === exactLength, `${field} must contain exactly ${exactLength} trial slots`);
  const valid = [];
  values.forEach((value, index) => {
    if (!hasValue(value)) return;
    valid.push(finiteNumber(value, `${field}[${index}]`, { min: 0.01, max }));
  });
  invariant(!required || valid.length > 0, `${field} requires at least one recorded trial`);
  return valid;
}

function optionalVitals(input, prefix, { required = false } = {}) {
  const hr = optionalInteger(input?.hr, `${prefix}.hr`, { min: 20, max: 300 });
  const bp = bloodPressure(input?.bp, `${prefix}.bp`);
  const spo2 = optionalNumber(input?.spo2, `${prefix}.spo2`, { min: 0, max: 100 });
  if (required) invariant(hr !== null && bp !== null && spo2 !== null, `${prefix} heart rate, blood pressure and SpO2 are required`);
  return { hr, bp, spo2 };
}

function armCurlCategory(reps, age, sex) {
  if (age === null) return null;
  const norm = ARM_CURL_NORMS.find(([normSex, minAge, maxAge]) => normSex === sex && age >= minAge && age <= maxAge);
  if (!norm) return null;
  if (reps < norm[3]) return 'Below Average';
  if (reps <= norm[4]) return 'Average';
  return 'Above Average';
}

function scoreArmCurl(input, context) {
  const sex = choice(input.sex, 'sex', ['male', 'female']);
  const age = optionalInteger(input.age, 'age', { min: 1, max: 130 });
  const dominantSide = choice(input.dominantSide, 'dominantSide', ['right', 'left']);
  const testedSide = choice(input.testedSide, 'testedSide', ['right', 'left']);
  const weightKg = finiteNumber(input.weightKg, 'weightKg', { min: 0.1, max: 100 });
  const right = optionalInteger(input.rightReps, 'rightReps', { min: 0, max: 300 });
  const left = optionalInteger(input.leftReps, 'leftReps', { min: 0, max: 300 });
  const primary = testedSide === 'right' ? right : left;
  invariant(primary !== null, `${testedSide} repetitions are required for the tested side`);
  const category = armCurlCategory(primary, age, sex);
  const asymmetry = right !== null && left !== null ? Math.abs(right - left) : null;
  const soap = [
    '• 30-Second Seated Arm Curl Test',
    `  Right Arm: ${right ?? 'NR'} reps | Left Arm: ${left ?? 'NR'} reps`,
    `  Weight Used: ${weightKg} kg | Primary Side: ${testedSide} (${primary} reps)`,
    category ? `  Normative Category: ${category}` : null,
  ].filter(Boolean).join('\n');
  return completedPayload('arm_curl', input, context, primary, soap, {
    primary_side_reps: primary, right_arm_reps: right, left_arm_reps: left, asymmetry_reps: asymmetry,
    sex, age, dominant_side: dominantSide, tested_side_primary: testedSide, weight_used_kg: weightKg,
    normative_category: category, test_duration: 30,
  });
}

function scoreThirtySecondSts(input, context) {
  invariant(input.completed === true, '30sec_sts must be completed before saving');
  const stands = integer(input.standCount, 'standCount', { min: 0, max: 300 });
  const handsUsed = boolean(input.handsUsed, 'handsUsed');
  const preHR = integer(input.preHR, 'preHR', { min: 20, max: 300 });
  const postHR = optionalInteger(input.postHR, 'postHR', { min: 20, max: 300 });
  const symptoms = text(input.symptoms, 'symptoms');
  const soap = `• 30-Second Sit-to-Stand Test\n  Repetitions: ${stands}\n  Hands Used: ${handsUsed ? 'Yes' : 'No'}\n  Pre HR: ${preHR} bpm | Post HR: ${postHR ?? 'N/A'} bpm${symptoms ? `\n  Symptoms: ${symptoms}` : ''}`;
  return completedPayload('30sec_sts', input, context, stands, soap, {
    hands_used: handsUsed, pre_heart_rate: preHR, post_heart_rate: postHR, symptoms,
  });
}

function tripleHopCategory(lsi) {
  if (lsi === null) return null;
  if (lsi >= 90) return 'Symmetrical (≥90%) — RTS criteria met';
  if (lsi >= 80) return 'Mild asymmetry (80–89%) — monitor';
  return 'Significant asymmetry (<80%) — not RTS ready';
}

function scoreTripleHop(input, context) {
  const side = choice(input.side, 'side', ['right', 'left']);
  const rightTrials = normalizeTrials(input.rightTrials, 'rightTrials', { required: side === 'right' });
  const leftTrials = normalizeTrials(input.leftTrials, 'leftTrials', { required: side === 'left' });
  const bestRight = rightTrials.length ? Math.max(...rightTrials) : null;
  const bestLeft = leftTrials.length ? Math.max(...leftTrials) : null;
  const tested = side === 'right' ? bestRight : bestLeft;
  const contralateral = side === 'right' ? bestLeft : bestRight;
  invariant(tested !== null, 'tested-side hop distance is required');
  const lsi = contralateral !== null ? round((tested / contralateral) * 100, 1) : null;
  const category = tripleHopCategory(lsi);
  const soap = [
    '• Triple Hop Test for Distance',
    `  Tested limb: ${side === 'right' ? 'Right' : 'Left'}`,
    bestRight !== null ? `  Right — Best: ${bestRight} cm (trials: ${rightTrials.join(', ')} cm)` : null,
    bestLeft !== null ? `  Left — Best: ${bestLeft} cm (trials: ${leftTrials.join(', ')} cm)` : null,
    lsi !== null ? `  Limb Symmetry Index (LSI): ${lsi}%` : null,
    category ? `  Interpretation: ${category}` : null,
    notesFrom(input, context) ? `  Notes: ${notesFrom(input, context)}` : null,
    '  LSI ≥90% required for return-to-sport clearance (Noyes et al., 1991)',
  ].filter(Boolean).join('\n');
  return completedPayload('triple_hop', input, context, tested, soap, {
    tested_side: side, best_right_cm: bestRight, best_left_cm: bestLeft, lsi_percent: lsi,
    lsi_category: category, right_trials: rightTrials, left_trials: leftTrials,
  });
}

function normalizeTrendSide(side, field) {
  const source = side && typeof side === 'object' ? side : {};
  const result = optionalChoice(source.result, `${field}.result`, ['Positive', 'Negative', 'Equivocal']);
  const signs = source.signs && typeof source.signs === 'object' ? source.signs : {};
  for (const key of Object.keys(signs)) invariant(key in TREND_SIGNS, `${field}.signs contains unknown sign ${key}`);
  const selectedSigns = Object.entries(TREND_SIGNS).filter(([key]) => signs[key] === true).map(([, label]) => label);
  for (const key of Object.keys(TREND_SIGNS)) {
    if (signs[key] !== undefined) boolean(signs[key], `${field}.signs.${key}`);
  }
  invariant(!selectedSigns.length || result !== null, `${field}.result is required when signs are recorded`);
  return { result, signs: selectedSigns };
}

function scoreTrendelenburg(input, context) {
  const left = normalizeTrendSide(input.left, 'left');
  const right = normalizeTrendSide(input.right, 'right');
  invariant(left.result !== null || right.result !== null, 'at least one Trendelenburg side result is required');
  const overall = left.result === 'Positive' || right.result === 'Positive' ? 'Positive' : 'Negative';
  const soap = [
    '• Trendelenburg Test',
    `  Left: ${left.result || 'Not recorded'}${left.signs.length ? ` — Signs: ${left.signs.join(', ')}` : ''}`,
    `  Right: ${right.result || 'Not recorded'}${right.signs.length ? ` — Signs: ${right.signs.join(', ')}` : ''}`,
    `  Overall: ${overall}`,
    notesFrom(input, context) ? `  Notes: ${notesFrom(input, context)}` : null,
  ].filter(Boolean).join('\n');
  return completedPayload('trendelenburg', input, context, overall === 'Positive' ? 1 : 0, soap, {
    left_result: left.result, right_result: right.result, left_signs: left.signs, right_signs: right.signs,
    overall_result: overall,
  });
}

function scoreStairClimb(input, context) {
  const timeSeconds = finiteNumber(input.timeSeconds, 'timeSeconds', { min: 0.01, max: 3600 });
  const stairCount = integer(input.stairCount, 'stairCount', { min: 1, max: 500 });
  const handrailUse = boolean(input.handrailUse, 'handrailUse');
  const gaitStability = choice(input.gaitStability, 'gaitStability', ['stable', 'cautious', 'unstable']);
  const assistiveDevice = choice(input.assistiveDevice, 'assistiveDevice', ['none', 'cane', 'frame']);
  const interpretation = timeSeconds < 6 ? 'Excellent — independent, low fall risk' : timeSeconds <= 10 ? 'Moderate — minor limitations' : 'Slow — increased fall risk, requires monitoring';
  const soap = `• Stair Climb Test\n  Stairs: ${stairCount} steps | Time: ${timeSeconds}s | Handrail: ${handrailUse ? 'Yes' : 'No'} | Gait: ${gaitStability} | Device: ${assistiveDevice}\n  Interpretation: ${interpretation}${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('stair_climb', input, context, timeSeconds, soap, {
    time_seconds: timeSeconds, stair_count: stairCount, handrail_use: handrailUse,
    gait_stability: gaitStability, assistive_device: assistiveDevice, interpretation,
  });
}

function countInterpretation(value, age, gender, table, lowLabel = 'Below Average') {
  if (age === null || gender === null) return null;
  const row = table.find(([minAge, maxAge]) => age >= minAge && age <= maxAge);
  if (!row) return null;
  const range = gender === 'female' ? row[3] : row[2];
  if (value >= range[1]) return 'Above Average';
  if (value >= range[0]) return 'Average';
  return lowLabel;
}

function scoreTwoMinStep(input, context) {
  invariant(input.completed === true, 'two_min_step must be completed before saving');
  const steps = integer(input.steps, 'steps', { min: 0, max: 1000 });
  const age = optionalInteger(input.age, 'age', { min: 1, max: 130 });
  const gender = optionalChoice(input.gender, 'gender', ['male', 'female']);
  const hrPre = optionalInteger(input.hrPre, 'hrPre', { min: 20, max: 300 });
  const hrPost = optionalInteger(input.hrPost, 'hrPost', { min: 20, max: 300 });
  const bpPre = bloodPressure(input.bpPre, 'bpPre');
  const bpPost = bloodPressure(input.bpPost, 'bpPost');
  const symptoms = text(input.symptoms, 'symptoms');
  const interpretation = countInterpretation(steps, age, gender, TWO_MIN_STEP_NORMS);
  const soap = [
    '• 2-Minute Step Test', `  Right Knee Steps: ${steps}`,
    interpretation ? `  Performance: ${interpretation}` : null,
    hrPre !== null ? `  Pre-Test HR: ${hrPre} bpm` : null, bpPre ? `  Pre-Test BP: ${bpPre} mmHg` : null,
    hrPost !== null ? `  Post-Test HR: ${hrPost} bpm` : null, bpPost ? `  Post-Test BP: ${bpPost} mmHg` : null,
    symptoms ? `  Symptoms: ${symptoms}` : null, notesFrom(input, context) ? `  Notes: ${notesFrom(input, context)}` : null,
  ].filter(Boolean).join('\n');
  return completedPayload('two_min_step', input, context, steps, soap, {
    steps_right_knee: steps, hr_pre: hrPre, hr_post: hrPost, bp_pre: bpPre, bp_post: bpPost,
    symptoms: symptoms || null, client_age_at_test: age, client_gender: gender, interpretation,
  });
}

function scoreStepTap(input, context) {
  const taps = integer(input.reps, 'reps', { min: 0, max: 1000 });
  const duration = finiteNumber(input.duration, 'duration', { min: 15, max: 30 });
  invariant(duration === 15 || duration === 30, 'duration must be 15 or 30 seconds');
  const stepHeight = finiteNumber(input.stepHeight, 'stepHeight', { min: 0.1, max: 100 });
  const rate = round(taps / duration, 2);
  const soap = `• Step Tap Test\n  Taps: ${taps} in ${duration}s\n  Rate: ${rate} taps/sec\n  Step Height: ${stepHeight} cm${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}\n  Assesses lower limb agility, coordination, and dynamic balance\n  Reference: Lord SR et al. (2003). Balance, reaction time, and falls in older people. J Am Geriatr Soc.`;
  return completedPayload('step_tap', input, context, taps, soap, {
    taps, duration_s: duration, rate_per_sec: rate, step_height_cm: stepHeight,
  });
}

function scoreBoxBlock(input, context) {
  invariant(input.completed === true, 'box_block_test must be completed before saving');
  const blocks = integer(input.blocksMoved, 'blocksMoved', { min: 0, max: 1000 });
  const age = integer(input.age, 'age', { min: 1, max: 130 });
  const sex = choice(input.sex, 'sex', ['male', 'female', 'other', 'Male', 'Female', 'Other']).toLowerCase();
  const dominantHand = choice(input.dominantHand, 'dominantHand', ['right', 'left']);
  const comparison = blocks >= 90 ? 'Above average' : blocks >= 70 ? 'Average' : 'Below average';
  const soap = `• Box and Block Test:\n  Blocks Moved: ${blocks}\n  Dominant Hand: ${dominantHand}\n  Age: ${age}\n  Sex: ${sex}\n  Result: ${comparison}`;
  return completedPayload('box_block_test', input, context, blocks, soap, {
    blocks_moved: blocks, dominant_hand: dominantHand, age, sex, comparison,
    normative_mean: 80, normative_sd: 10,
  });
}

function scoreMcGill(input, context) {
  invariant(input.times && typeof input.times === 'object', 'times is required');
  const times = {
    extensor: finiteNumber(input.times.extensor, 'times.extensor', { min: 0.1, max: 3600 }),
    flexor: finiteNumber(input.times.flexor, 'times.flexor', { min: 0.1, max: 3600 }),
    right_side: finiteNumber(input.times.right_side, 'times.right_side', { min: 0.1, max: 3600 }),
    left_side: finiteNumber(input.times.left_side, 'times.left_side', { min: 0.1, max: 3600 }),
  };
  const ratios = {
    flexor_extensor: round(times.flexor / times.extensor, 2),
    right_side_extensor: round(times.right_side / times.extensor, 2),
    left_side_extensor: round(times.left_side / times.extensor, 2),
    side_symmetry: round(Math.min(times.right_side, times.left_side) / Math.max(times.right_side, times.left_side), 2),
  };
  const soap = `• McGill Core Endurance Test Battery\n\n  Hold Times:\n  Trunk Extensor: ${times.extensor}s\n  Trunk Flexor: ${times.flexor}s\n  Right Side Bridge: ${times.right_side}s\n  Left Side Bridge: ${times.left_side}s\n\n  Ratios:\n  Flexor:Extensor: ${ratios.flexor_extensor} (target <1.0)\n  Right Side:Extensor: ${ratios.right_side_extensor} (target 0.55–1.0)\n  Left Side:Extensor: ${ratios.left_side_extensor} (target 0.55–1.0)\n  Side Bridge Symmetry: ${ratios.side_symmetry} (target >0.95)${notesFrom(input, context) ? `\n\n  Notes: ${notesFrom(input, context)}` : ''}\n  Reference: McGill SM et al. (1999). Endurance times for low back stabilization exercises. Arch Phys Med Rehabil, 80(10):1157-62.`;
  return completedPayload('mcgill', input, context, times.extensor, soap, { times, ratios });
}

function scoreSixtySecondSts(input, context) {
  invariant(input.completed === true, '60sec_sts must be completed before saving');
  const reps = integer(input.reps, 'reps', { min: 0, max: 300 });
  const handsUsed = boolean(input.handsUsed, 'handsUsed');
  const age = optionalInteger(input.age, 'age', { min: 1, max: 130 });
  const gender = optionalChoice(input.gender, 'gender', ['male', 'female']);
  const hrPre = optionalInteger(input.hrPre, 'hrPre', { min: 20, max: 300 });
  const hrPost = optionalInteger(input.hrPost, 'hrPost', { min: 20, max: 300 });
  const bpPre = bloodPressure(input.bpPre, 'bpPre');
  const bpPost = bloodPressure(input.bpPost, 'bpPost');
  const interpretation = countInterpretation(reps, age, gender, SIXTY_STS_NORMS, 'Below Average — Elevated Fall Risk');
  const soap = [
    '• 60-Second Sit-to-Stand Test', `  Repetitions: ${reps}${handsUsed ? ' (hands used for support)' : ''}`,
    interpretation ? `  Performance: ${interpretation}` : null,
    hrPre !== null || bpPre ? `  Pre-Test: HR ${hrPre ?? 'N/A'} bpm | BP ${bpPre ?? 'N/A'} mmHg` : null,
    hrPost !== null || bpPost ? `  Post-Test: HR ${hrPost ?? 'N/A'} bpm | BP ${bpPost ?? 'N/A'} mmHg` : null,
    notesFrom(input, context) ? `  Clinical Notes: ${notesFrom(input, context)}` : null,
  ].filter(Boolean).join('\n');
  return completedPayload('60sec_sts', input, context, reps, soap, {
    repetitions: reps, hands_used: handsUsed, hr_pre: hrPre, bp_pre: bpPre, hr_post: hrPost,
    bp_post: bpPost, interpretation, client_age_at_test: age, client_gender: gender,
  });
}

function scoreDistress(input, context) {
  const score = integer(input.score, 'score', { min: 0, max: 10 });
  invariant(input.checkedProblems && typeof input.checkedProblems === 'object' && !Array.isArray(input.checkedProblems), 'checkedProblems must be an object');
  const selected = [];
  for (const [problem, checked] of Object.entries(input.checkedProblems)) {
    invariant(DISTRESS_PROBLEM_SET.has(problem), `checkedProblems contains unknown problem ${problem}`);
    boolean(checked, `checkedProblems.${problem}`);
    if (checked) selected.push(problem);
  }
  const byCategory = {};
  for (const [category, problems] of Object.entries(DISTRESS_PROBLEM_LIST)) {
    const matches = problems.filter((problem) => selected.includes(problem));
    if (matches.length) byCategory[category] = matches;
  }
  const interpretation = score <= 3 ? 'Mild / No clinical concern' : score <= 6 ? 'Moderate distress — consider follow-up' : 'Severe distress — further assessment recommended';
  const flagged = score >= 4;
  const problemLines = selected.length
    ? Object.entries(byCategory).map(([category, problems]) => `    ${category}: ${problems.join(', ')}`).join('\n')
    : '  No specific problems endorsed.';
  const soap = `• Distress Thermometer (NCCN):\n  Score: ${score}/10 — ${interpretation}\n${selected.length ? `  Reported problems:\n${problemLines}` : problemLines}`;
  return completedPayload('distress_thermometer', input, context, score, soap, {
    score, interpretation, flagged, problems_by_category: byCategory, selected_problems: selected,
  });
}

function staticBackNorm(age, gender) {
  if (age === null || gender === null) return null;
  const row = STATIC_BACK_NORMS[gender].find(([minAge, maxAge]) => age >= minAge && age <= maxAge);
  return row ? { mean: row[2], sd: row[3] } : null;
}

function staticBackClassification(seconds, norm) {
  if (!norm) return null;
  const z = (seconds - norm.mean) / norm.sd;
  if (z >= 1) return { label: 'Excellent', z };
  if (z >= 0) return { label: 'Above Average', z };
  if (z >= -1) return { label: 'Below Average', z };
  return { label: 'Low Endurance', z };
}

function formatSeconds(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function normalizeStaticBackSetup(value) {
  invariant(value && typeof value === 'object', 'setup is required');
  const normalized = {
    equipment: text(value.equipment, 'setup.equipment', { max: 250 }),
    securing: choice(value.securing, 'setup.securing', ['straps', 'clinician', 'both', 'none', 'other']),
    armsPosition: choice(value.armsPosition, 'setup.armsPosition', ['crossed', 'sides', 'modified']),
    testModified: boolean(value.testModified, 'setup.testModified'),
    modificationNote: text(value.modificationNote, 'setup.modificationNote', { max: 1000 }),
    baselinePain: finiteNumber(value.baselinePain, 'setup.baselinePain', { min: 0, max: 10 }),
  };
  invariant(!normalized.testModified || normalized.modificationNote, 'setup.modificationNote is required for a modified test');
  return normalized;
}

function normalizeStaticBackTechnique(value) {
  invariant(value && typeof value === 'object', 'technique is required');
  const normalized = {};
  for (const field of ['maintainedHorizontal', 'excessiveLumbarExtension', 'hipPelvicRotation', 'shoulderCompensation', 'breathHolding', 'requiredVerbalCueing']) {
    normalized[field] = optionalBoolean(value[field], `technique.${field}`);
  }
  normalized.qualityRating = choice(value.qualityRating, 'technique.qualityRating', ['Poor', 'Fair', 'Good', 'Excellent']);
  return normalized;
}

function normalizeStaticBackSymptoms(value) {
  invariant(value && typeof value === 'object', 'symptoms is required');
  const allowedLocations = ['Lumbar', 'Thoracic', 'Gluteal', 'Hamstring', 'Radicular leg symptoms', 'Other'];
  invariant(Array.isArray(value.painLocations), 'symptoms.painLocations must be an array');
  const locations = value.painLocations.map((location) => choice(location, 'symptoms.painLocations', allowedLocations));
  return {
    painDuring: finiteNumber(value.painDuring, 'symptoms.painDuring', { min: 0, max: 10 }),
    painLocations: [...new Set(locations)],
    symptomsIncreased: optionalBoolean(value.symptomsIncreased, 'symptoms.symptomsIncreased'),
    neurologicalSymptoms: optionalBoolean(value.neurologicalSymptoms, 'symptoms.neurologicalSymptoms'),
    postTestPain: finiteNumber(value.postTestPain, 'symptoms.postTestPain', { min: 0, max: 10 }),
    rpeAfter: finiteNumber(value.rpeAfter, 'symptoms.rpeAfter', { min: 0, max: 10 }),
  };
}

function scoreStaticBack(input, context) {
  const finalTime = finiteNumber(input.finalTime, 'finalTime', { min: 0.1, max: 3600 });
  const stopReason = choice(input.stopReason, 'stopReason', ['Fatigue', 'Pain', 'Loss of horizontal position', '>10° trunk drop', 'Client requested stop', 'Safety concern', 'Reached maximum / test ceiling', 'Other']);
  const otherStopReason = text(input.otherStopReason, 'otherStopReason', { max: 500 });
  invariant(stopReason !== 'Other' || otherStopReason, 'otherStopReason is required when stopReason is Other');
  const reachedMaxDuration = boolean(input.reachedMaxDuration, 'reachedMaxDuration');
  const setup = normalizeStaticBackSetup(input.setup);
  const technique = normalizeStaticBackTechnique(input.technique);
  const symptoms = normalizeStaticBackSymptoms(input.symptoms);
  const age = optionalInteger(input.age, 'age', { min: 1, max: 130 });
  const gender = optionalChoice(input.gender, 'gender', ['male', 'female']);
  const norm = staticBackNorm(age, gender);
  const classification = staticBackClassification(finalTime, norm);
  const stoppedBy = stopReason === 'Other' ? otherStopReason : stopReason;
  const flags = [];
  if (finalTime < 60) flags.push('Very low lumbar extensor endurance');
  else if (classification?.label === 'Low Endurance') flags.push('Reduced lumbar extensor endurance');
  if (stopReason === 'Pain' || symptoms.painDuring >= 4) flags.push('Pain-limited performance');
  if (symptoms.neurologicalSymptoms) flags.push('Neurological symptoms noted — review urgently');
  if (technique.qualityRating === 'Poor' || technique.excessiveLumbarExtension) flags.push('Technique limitations — reduced test validity');
  if (setup.testModified) flags.push('Modified test — interpret with caution');
  if (symptoms.symptomsIncreased) flags.push('Symptoms increased during testing');
  flags.push('Consider progressive trunk endurance training', 'Reassess after 6–8 week training block');
  const classText = classification ? ` — classified as ${classification.label}` : '';
  const normText = norm ? ` compared to an age/sex normative mean of ${norm.mean}s (±${norm.sd}s)` : '';
  const painText = symptoms.painDuring > 0
    ? ` Lumbar pain of ${symptoms.painDuring}/10 was reported during the test${symptoms.symptomsIncreased ? ', with symptoms increasing from baseline' : ''}.`
    : ' No significant pain was reported during the test.';
  const enduranceText = finalTime < 60
    ? ' Hold time below 60 seconds may indicate significant impairment in lumbar extensor endurance.'
    : !norm
      ? ' No age/sex normative comparison was generated because matching demographics were unavailable.'
      : finalTime < norm.mean
        ? ' Hold time is below the normative mean for this age and sex group, suggesting reduced lumbar extensor endurance.'
        : ' Hold time is within or above the normative range for this age and sex group.';
  const interpretation = `Biering-Sørensen Back Extension Test completed with a hold time of ${formatSeconds(finalTime)} (${finalTime}s)${classText}${normText}. Test was stopped due to ${stoppedBy}. Technique quality was rated as ${technique.qualityRating.toLowerCase()}.${painText}${symptoms.neurologicalSymptoms ? ' Neurological symptoms were noted and require clinical attention.' : ''}${enduranceText}${setup.testModified ? ' Note: Test was performed in a modified position; interpret results with caution.' : ''} Findings may inform progressive trunk endurance rehabilitation and should be interpreted alongside clinical presentation and functional goals.`;
  const soap = `• Biering-Sørensen Back Extension Test\n  Hold Time: ${finalTime}s (${formatSeconds(finalTime)})${classification ? ` (${classification.label})` : ''}${norm ? ` Normative mean (${gender}, ${age}yo): ${norm.mean}s.` : ''}\n  Stopped due to: ${stoppedBy}\n  Technique: ${technique.qualityRating}. ${symptoms.painDuring > 0 ? `Pain during: ${symptoms.painDuring}/10` : 'No pain during test'}.${symptoms.neurologicalSymptoms ? ' Neurological symptoms reported.' : ''}${setup.testModified ? '\n  Modified test — interpret with caution.' : ''}${notesFrom(input, context) ? `\n  Clinical Notes: ${notesFrom(input, context)}` : ''}\n  Interpretation: ${interpretation}`;
  return completedPayload('static_back', input, context, finalTime, soap, {
    hold_time_seconds: finalTime, hold_time_formatted: formatSeconds(finalTime), stop_reason: stoppedBy,
    reached_max_duration: reachedMaxDuration, classification: classification?.label ?? null,
    normative_mean: norm?.mean ?? null, normative_sd: norm?.sd ?? null, setup, technique, symptoms,
    flags, interpretation,
  });
}

function yesNo(value, field) {
  return optionalChoice(value, field, ['Yes', 'No']);
}

function scoreRomberg(input, context) {
  const eyesOpen = optionalNumber(input.eyesOpenTime, 'eyesOpenTime', { min: 0, max: 30 });
  const eyesClosed = optionalNumber(input.eyesClosedTime, 'eyesClosedTime', { min: 0, max: 30 });
  invariant(eyesOpen !== null || eyesClosed !== null, 'at least one Romberg time is required');
  const eoSwayObserved = yesNo(input.eoSwayObserved, 'eoSwayObserved');
  const ecSwayObserved = yesNo(input.ecSwayObserved, 'ecSwayObserved');
  const eoSwaySeverity = optionalChoice(input.eoSwaySeverity, 'eoSwaySeverity', ['None', 'Mild', 'Moderate', 'Severe']);
  const ecSwaySeverity = optionalChoice(input.ecSwaySeverity, 'ecSwaySeverity', ['None', 'Mild', 'Moderate', 'Severe']);
  const eoSwayDirection = text(input.eoSwayDirection, 'eoSwayDirection', { max: 100 });
  const ecSwayDirection = text(input.ecSwayDirection, 'ecSwayDirection', { max: 100 });
  const completedFull = yesNo(input.completedFull, 'completedFull');
  const lossOfBalance = yesNo(input.lossOfBalance, 'lossOfBalance');
  const stepTaken = yesNo(input.stepTaken, 'stepTaken');
  const requiresAssistance = yesNo(input.requiresAssistance, 'requiresAssistance');
  const severeEC = ecSwaySeverity === 'Moderate' || ecSwaySeverity === 'Severe';
  const positive = ecSwayObserved === 'Yes' && (severeEC || lossOfBalance === 'Yes' || stepTaken === 'Yes' || requiresAssistance === 'Yes');
  const fallsRisk = (eyesClosed !== null && eyesClosed < 30) || lossOfBalance === 'Yes' || stepTaken === 'Yes' || requiresAssistance === 'Yes' || severeEC;
  let summary = `Client maintained Romberg stance for ${eyesOpen !== null ? `${eyesOpen}s` : 'not recorded'} eyes open`;
  if (eyesClosed !== null) {
    summary += ` and ${eyesClosed}s eyes closed`;
    if (ecSwayObserved === 'Yes' && ecSwaySeverity) summary += `, with ${ecSwaySeverity.toLowerCase()} ${ecSwayDirection ? `${ecSwayDirection.toLowerCase()} ` : ''}sway`;
    if (stepTaken === 'Yes') summary += ' and step response';
    if (lossOfBalance === 'Yes') summary += ' and loss of balance';
    if (requiresAssistance === 'Yes') summary += ', requiring clinician assistance';
  }
  summary += '.';
  if (positive) summary += ` Findings are consistent with reduced sensory-dependent balance control${fallsRisk ? ' and increased falls risk' : ''}. Supervision is recommended for balance-based exercise progression.`;
  else if (eyesClosed !== null) summary += ' Balance was maintained with minimal sway under both visual and non-visual conditions.';
  const resultLabel = positive ? 'Positive Romberg' : 'Negative Romberg';
  const soap = [
    "• Romberg's Test of Standing Balance",
    input.surfaceType ? `  Surface: ${text(input.surfaceType, 'surfaceType', { max: 100 })}` : null,
    input.footPosition ? `  Foot Position: ${text(input.footPosition, 'footPosition', { max: 100 })}` : null,
    input.footwear ? `  Footwear: ${text(input.footwear, 'footwear', { max: 100 })}` : null,
    input.assistanceLevel ? `  Assistance Level: ${text(input.assistanceLevel, 'assistanceLevel', { max: 100 })}` : null,
    eyesOpen !== null ? `  Eyes Open: ${eyesOpen}s${eoSwaySeverity ? ` — sway: ${eoSwaySeverity}` : ''}${eoSwayDirection ? ` (${eoSwayDirection})` : ''}` : null,
    eyesClosed !== null ? `  Eyes Closed: ${eyesClosed}s${ecSwaySeverity ? ` — sway: ${ecSwaySeverity}` : ''}${ecSwayDirection ? ` (${ecSwayDirection})` : ''}` : null,
    lossOfBalance === 'Yes' ? '  Loss of Balance: Yes' : null, stepTaken === 'Yes' ? '  Step Response: Yes' : null,
    requiresAssistance === 'Yes' ? '  Required Assistance: Yes' : null,
    input.stopReason ? `  Reason Stopped: ${text(input.stopReason, 'stopReason', { max: 500 })}` : null,
    `  Result: ${resultLabel}`, fallsRisk ? '  ⚠ Increased Falls Risk Identified' : null,
    `\n  Interpretation: ${summary}`, notesFrom(input, context) ? `  Clinical Notes: ${notesFrom(input, context)}` : null,
  ].filter(Boolean).join('\n');
  return completedPayload('rombergs_standing', input, context, eyesClosed ?? eyesOpen, soap, {
    surface_type: text(input.surfaceType, 'surfaceType', { max: 100 }), foot_position: text(input.footPosition, 'footPosition', { max: 100 }),
    footwear: text(input.footwear, 'footwear', { max: 100 }), assistance_level: text(input.assistanceLevel, 'assistanceLevel', { max: 100 }),
    eyes_open_time: eyesOpen, eyes_open_sway_observed: eoSwayObserved, eyes_open_sway_severity: eoSwaySeverity,
    eyes_open_sway_direction: eoSwayDirection, eyes_closed_time: eyesClosed, eyes_closed_sway_observed: ecSwayObserved,
    eyes_closed_sway_severity: ecSwaySeverity, eyes_closed_sway_direction: ecSwayDirection,
    completed_full_duration: completedFull, loss_of_balance: lossOfBalance, step_taken: stepTaken,
    requires_assistance: requiresAssistance, stop_reason: text(input.stopReason, 'stopReason', { max: 500 }),
    romberg_result: resultLabel, falls_risk: fallsRisk, interpretation: summary,
  });
}

function shoulderTugInterpretation(steps, assistanceNeeded) {
  if (steps === 0 || steps === 1) return { level: 'Excellent Balance', risk: 'Low fall risk', description: 'Normal postural reaction; able to recover balance with minimal stepping' };
  if (steps === 2) return { level: 'Good Balance', risk: 'Low-moderate fall risk', description: 'Normal stepping response; appropriate recovery from perturbation' };
  if (steps >= 3 && !assistanceNeeded) return { level: 'Impaired Balance', risk: 'Moderate-high fall risk', description: 'Excessive stepping (>2 steps); impaired postural reaction' };
  return { level: 'Severely Impaired Balance', risk: 'High fall risk', description: 'Unable to recover without assistance; significant postural instability' };
}

function scoreShoulderTug(input, context) {
  const steps = integer(input.steps, 'steps', { min: 0, max: 100 });
  const assistance = boolean(input.assistanceNeeded, 'assistanceNeeded');
  const interpretation = shoulderTugInterpretation(steps, assistance);
  const soap = `• Shoulder Tug Test (Pastor's Test) - Reactive Balance Assessment\n\n  Measurement:\n    Steps Taken to Recover: ${steps}\n    Assistance Required: ${assistance ? 'Yes' : 'No'}\n\n  Interpretation: ${interpretation.level}\n    ${interpretation.description}\n    Fall Risk: ${interpretation.risk}${notesFrom(input, context) ? `\n\n  Clinical Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('shoulder_tug', input, context, steps, soap, {
    steps_taken: steps, assistance_needed: assistance, interpretation: interpretation.level,
    fall_risk: interpretation.risk,
  });
}

function scoreGst(input, context) {
  const reps = integer(input.reps, 'reps', { min: 0, max: 1000 });
  const side = choice(input.side, 'side', ['bilateral', 'right', 'left']);
  const weight = choice(input.weight, 'weight', ['400g', '500g', '800g', '1kg']);
  const classification = reps >= 18 ? 'Excellent' : reps >= 14 ? 'Good' : reps >= 10 ? 'Average' : 'Below Average';
  const soap = `• Grocery Shelving Test (GST)\n  Items Placed: ${reps} in 30s — ${classification}\n  Side: ${side} | Weight: ${weight}\n  The GST evaluates functional upper limb endurance and overhead task performance.${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('gst', input, context, reps, soap, {
    repetitions: reps, duration_s: 30, side, weight, classification,
  });
}

function scoreTimedPushUp(input, context) {
  invariant(input.completed === true, 'timed_push_up must be completed before saving');
  const count = integer(input.pushUpCount, 'pushUpCount', { min: 0, max: 300 });
  const duration = finiteNumber(input.durationSeconds, 'durationSeconds', { min: 0, max: 60 });
  const pre = optionalVitals(input.preTest, 'preTest', { required: true });
  const post = optionalVitals(input.postTest, 'postTest', { required: true });
  const quality = text(input.qualityNotes, 'qualityNotes');
  const soap = `• Timed Push-Up Test (Press-Up Test)\n  Repetitions: ${count}\n  Duration: ${duration}s\n  Pre-Test: HR ${pre.hr} bpm | BP ${pre.bp} mmHg | SpO2 ${pre.spo2}%\n  Post-Test: HR ${post.hr} bpm | BP ${post.bp} mmHg | SpO2 ${post.spo2}%${quality ? `\n  Quality Observations: ${quality}` : ''}${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('timed_push_up', input, context, count, soap, {
    duration_seconds: duration,
    pre_test: { restingHR: pre.hr, restingBP: pre.bp, restingSPO2: pre.spo2 },
    post_test: { postHR: post.hr, postBP: post.bp, postSPO2: post.spo2 },
    quality_observations: quality,
  });
}

function normalizeBooleanMap(value, field, keys) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), `${field} must be an object`);
  for (const key of Object.keys(value)) invariant(keys.includes(key), `${field} contains unknown field ${key}`);
  return Object.fromEntries(keys.map((key) => [key, boolean(value[key], `${field}.${key}`)]));
}

function staticSquatNorm(age, gender) {
  const row = STATIC_SQUAT_NORMS.find(([minAge, maxAge]) => age >= minAge && age <= maxAge);
  invariant(row, 'age is outside the static squat normative table range 18 to 120');
  const values = gender === 'male' ? row[3] : row[4];
  return { label: row[2], excellent: values[0], good: values[1], fair: values[2], poor: values[3] };
}

function staticSquatClassify(time, norm) {
  if (time >= norm.excellent) return 'Excellent';
  if (time >= norm.good) return 'Good';
  if (time >= norm.fair) return 'Fair';
  if (time >= norm.poor) return 'Poor';
  return 'Very Poor';
}

function scoreStaticSquat(input, context) {
  invariant(input.completed === true, 'static_squat must be completed before saving');
  const elapsed = finiteNumber(input.elapsed, 'elapsed', { min: 0.1, max: 3600 });
  const age = integer(input.age, 'age', { min: 18, max: 120 });
  const gender = choice(input.gender, 'gender', ['male', 'female']);
  invariant(input.setup && typeof input.setup === 'object', 'setup is required');
  const setup = {
    knee_angle: integer(input.setup.knee_angle, 'setup.knee_angle', { min: 60, max: 120 }),
    footwear: choice(input.setup.footwear, 'setup.footwear', ['barefoot', 'shoes']),
    surface: choice(input.setup.surface, 'setup.surface', ['wall', 'free']),
    back_contact: choice(input.setup.back_contact, 'setup.back_contact', ['full', 'partial']),
    feet_position: choice(input.setup.feet_position, 'setup.feet_position', ['shoulder_width', 'hip_width', 'narrow']),
    pain_pre: finiteNumber(input.setup.pain_pre, 'setup.pain_pre', { min: 0, max: 10 }),
    fatigue_pre: finiteNumber(input.setup.fatigue_pre, 'setup.fatigue_pre', { min: 0, max: 10 }),
    dominant: choice(input.setup.dominant, 'setup.dominant', ['right', 'left', 'bilateral']),
    symptomatic: choice(input.setup.symptomatic, 'setup.symptomatic', ['none', 'right', 'left', 'bilateral']),
  };
  const painPost = finiteNumber(input.painPost, 'painPost', { min: 0, max: 10 });
  const fatiguePost = finiteNumber(input.fatiguePost, 'fatiguePost', { min: 0, max: 10 });
  const observations = normalizeBooleanMap(input.observations, 'observations', ['knee_valgus', 'heel_rise', 'back_arch', 'trembling', 'pain_provoked', 'required_guarding']);
  const stopReason = choice(input.stopReason, 'stopReason', ['Voluntary stop', 'Pain — unable to continue', 'Knee valgus collapse', 'Heel rise', 'Lost wall contact']);
  const norm = staticSquatNorm(age, gender);
  const classification = staticSquatClassify(elapsed, norm);
  const observationLabels = Object.entries(observations).filter(([, selected]) => selected).map(([key]) => key.replace(/_/g, ' '));
  const flags = [];
  if (elapsed < norm.poor) flags.push('Hold time below age/gender threshold — lower limb endurance deficit suspected');
  if (observations.knee_valgus) flags.push('Knee valgus observed — potential hip abductor weakness or neuromuscular control deficit');
  if (observations.pain_provoked) flags.push('Pain provoked during testing — review loading tolerance before progressing');
  if (observations.required_guarding) flags.push('Guarding required — significant safety concern, reassess readiness');
  if (setup.pain_pre > 3) flags.push(`Baseline pain was ${setup.pain_pre}/10 — result interpretation may be limited by pain`);
  if (elapsed >= 120) flags.push('Hold time ≥ 120 seconds — consider progressing to more demanding loading protocols');
  const interpretationParts = [
    `Static Wall Squat Test completed at ${setup.knee_angle}° knee flexion on a ${setup.surface === 'wall' ? 'wall' : 'freestanding'} surface.`,
    `Hold time: ${elapsed}s (${formatSeconds(elapsed)}) — classified as ${classification} relative to ${norm.label} ${gender} normative data.`,
    stopReason !== 'Voluntary stop' ? `Test terminated due to: ${stopReason}.` : null,
    observationLabels.length ? `Observations during test: ${observationLabels.join(', ')}.` : null,
    elapsed < norm.poor ? 'Results indicate below-threshold lower limb isometric endurance. Targeted quadriceps and posterior chain strengthening is recommended.' : null,
    elapsed >= norm.good ? 'Lower limb isometric endurance is within or above normal limits. Maintenance or progressive overload may be appropriate.' : null,
  ].filter(Boolean);
  const interpretation = interpretationParts.join(' ');
  const soap = `• Static Squat Test (Wall Squat)\n  Knee Angle: ${setup.knee_angle}° | Footwear: ${setup.footwear} | Surface: ${setup.surface}\n  Hold Time: ${elapsed}s | Classification: ${classification}\n  Pre-test Pain: ${setup.pain_pre}/10 | Post-test Pain: ${painPost}/10\n  Pre-test Fatigue: ${setup.fatigue_pre}/10 | Post-test Fatigue: ${fatiguePost}/10${observationLabels.length ? `\n  Observations: ${observationLabels.join(', ')}` : ''}\n\n  Interpretation: ${interpretation}${flags.length ? `\n\n  Clinical Flags:\n${flags.map((flag) => `  • ${flag}`).join('\n')}` : ''}${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('static_squat', input, context, elapsed, soap, {
    knee_angle: setup.knee_angle, footwear: setup.footwear, surface: setup.surface, stop_reason: stopReason,
    observations, pain_pre: setup.pain_pre, pain_post: painPost, fatigue_pre: setup.fatigue_pre,
    fatigue_post: fatiguePost, classification, normative_group: norm.label, flags, interpretation, setup,
  });
}

function scoreSquat(input, context) {
  const count = integer(input.squatCount, 'squatCount', { min: 1, max: 1000 });
  const duration = integer(input.testDuration, 'testDuration', { min: 60, max: 60 });
  const observations = normalizeBooleanMap(input.observations, 'observations', ['chestUp', 'kneeTracking', 'fullDepth', 'noCompensation', 'consistentPace']);
  const age = optionalInteger(input.age, 'age', { min: 1, max: 130 });
  const bodyWeight = optionalNumber(input.bodyWeight, 'bodyWeight', { min: 0.1, max: 1000 });
  const interpretation = count >= 40 ? 'Excellent' : count >= 30 ? 'Good' : count >= 20 ? 'Fair' : count >= 10 ? 'Poor' : 'Very Poor';
  const qualityScore = Object.values(observations).filter(Boolean).length;
  const soap = `• Dynamic Squat Test - Lower Limb Strength & Muscular Endurance\n\n  Test Parameters:\n    Duration: ${duration} seconds\n    Squats Completed: ${count}${age !== null ? `\n    Age: ${age} years` : ''}${bodyWeight !== null ? `\n    Body Weight: ${bodyWeight} kg` : ''}\n\n  Clinical Interpretation: ${interpretation}\n    Score: ${count} squats in ${duration} seconds\n    Normative Comparison: ${interpretation}\n\n  Test Quality Observations (${qualityScore}/5):\n    ${observations.chestUp ? '✓ Maintained upright chest position' : '• Chest collapsed (poor form)'}\n    ${observations.kneeTracking ? '✓ Knees tracked over toes' : '• Knees valgus/varus (alignment issue)'}\n    ${observations.fullDepth ? '✓ Achieved full depth (thighs parallel or below)' : '• Shallow squats (reduced range)'}\n    ${observations.noCompensation ? '✓ No compensatory patterns observed' : '• Asymmetrical movement/compensations noted'}\n    ${observations.consistentPace ? '✓ Maintained consistent pace throughout' : '• Pace declined (fatigue evident)'}${text(input.preTestNotes, 'preTestNotes') ? `\n  Pre-Test Notes: ${text(input.preTestNotes, 'preTestNotes')}` : ''}${notesFrom(input, context) ? `\n  Additional Notes: ${notesFrom(input, context)}` : ''}${text(input.postTestNotes, 'postTestNotes') ? `\n  Post-Test Notes: ${text(input.postTestNotes, 'postTestNotes')}` : ''}`;
  return completedPayload('squat', input, context, count, soap, {
    testDuration: duration, squatCount: count, age, bodyWeight, qualityScore, observations, interpretation,
  });
}

function benchCategory(reps, gender) {
  if (gender === 'M') return reps >= 36 ? 'Excellent' : reps >= 29 ? 'Good' : reps >= 22 ? 'Average' : reps >= 10 ? 'Poor' : 'Very Poor';
  return reps >= 35 ? 'Excellent' : reps >= 27 ? 'Good' : reps >= 21 ? 'Average' : reps >= 10 ? 'Poor' : 'Very Poor';
}

function scoreYmcaBench(input, context) {
  invariant(input.completed === true, 'ymca_bench must be completed before saving');
  const bodyMass = finiteNumber(input.bodyMass, 'bodyMass', { min: 0.1, max: 1000 });
  const gender = choice(input.gender, 'gender', ['M', 'F']);
  const testWeight = finiteNumber(input.testWeight, 'testWeight', { min: 0.1, max: 1000 });
  const repetitions = integer(input.repetitions, 'repetitions', { min: 0, max: 1000 });
  const cadenceBreakdown = choice(input.cadenceBreakdown, 'cadenceBreakdown', ['yes', 'no']);
  const rpe = optionalInteger(input.rpe, 'rpe', { min: 0, max: 10 });
  const painPresent = choice(input.painPresent, 'painPresent', ['yes', 'no']);
  const category = benchCategory(repetitions, gender);
  const soap = `• Allied Upper Body Endurance Press Test\n  Body Mass: ${bodyMass} kg | Gender: ${gender === 'M' ? 'Male' : 'Female'}\n  Test Load: ${testWeight} kg | Cadence: 60 bpm\n  Repetitions Completed: ${repetitions}\n  Muscular Endurance Category: ${category}\n  Cadence Maintained: ${cadenceBreakdown === 'no' ? 'Yes' : 'No'}${rpe !== null ? `\n  Perceived Exertion (RPE): ${rpe}/10` : ''}\n  Pain During Test: ${painPresent === 'yes' ? 'Present' : 'None'}${notesFrom(input, context) ? `\n  Clinical Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('ymca_bench', input, context, repetitions, soap, {
    body_mass_kg: bodyMass, gender, test_weight_kg: testWeight, repetitions, category,
    cadence_breakdown: cadenceBreakdown === 'yes', rpe, pain_present: painPresent === 'yes',
  });
}

function scoreFiveXSts(input, context) {
  invariant(Array.isArray(input.trials), 'trials must be an array');
  invariant(input.trials.length === 5, 'trials must contain exactly five cumulative stand times');
  const trials = input.trials.map((value, index) => finiteNumber(value, `trials[${index}]`, { min: 0.01, max: 600 }));
  for (let index = 1; index < trials.length; index += 1) invariant(trials[index] > trials[index - 1], 'trials must be strictly increasing cumulative times');
  const total = round(trials[4], 2);
  const fallRisk = total >= 15 ? 'Elevated fall risk (≥15s)' : 'Lower fall risk (<15s)';
  const trialRecords = trials.map((time, index) => ({ stand: index + 1, time: round(time, 2) }));
  const soap = `Five Times Sit-to-Stand Test (5xSTS)\n\nTotal Time: ${total.toFixed(2)}s — ${fallRisk}\n\nIndividual Stands:\n${trialRecords.map((trial) => `  Stand ${trial.stand}: ${trial.time.toFixed(2)}s`).join('\n')}${notesFrom(input, context) ? `\n\nClinical Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('5xsts', input, context, total, soap, {
    trials: trialRecords, total_time: total, fall_risk: fallRisk,
  });
}

function scoreFac(input, context) {
  const score = integer(input.score, 'score', { min: 0, max: 5 });
  const level = FAC_LEVELS[score];
  const soap = `• Functional Ambulation Categories (FAC)\n  Score: ${score}/5 — ${level.label}\n  Description: ${level.description}${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}\n  FAC measures functional walking ability and dependence level.\n  Scores 0-2 = dependent; 3 = supervised; 4-5 = independent\n  MCID: 1 category point`;
  return completedPayload('fac', input, context, score, soap, { score, label: level.label, description: level.description });
}

function normalizeMrsInterview(value) {
  const source = value && typeof value === 'object' ? value : {};
  for (const key of Object.keys(source)) invariant(MRS_INTERVIEW_KEYS.includes(key), `interview contains unknown question ${key}`);
  return Object.fromEntries(Object.entries(source).map(([key, answer]) => [key, choice(answer, `interview.${key}`, ['yes', 'no', 'unable'])]));
}

function suggestMrsGrade(interview) {
  if (!MRS_INTERVIEW_KEYS.every((key) => hasValue(interview[key]))) return null;
  const yes = (key) => interview[key] === 'yes';
  const no = (key) => interview[key] === 'no';
  if (yes('needs_constant_care')) return 5;
  if (no('walk_independently') && yes('needs_bathing_help') && yes('needs_toileting_help')) return 4;
  if (yes('needs_gait_aid') || yes('needs_dressing_help') || yes('needs_bathing_help') || yes('needs_toileting_help') || yes('needs_supervision')) return 3;
  if (no('return_to_previous') && yes('walk_independently') && no('needs_bathing_help') && no('needs_dressing_help')) return 2;
  if (yes('walk_independently') && yes('return_to_previous') && no('needs_dressing_help') && no('needs_supervision')) return 1;
  if (yes('walk_independently') && yes('return_to_previous') && no('needs_gait_aid') && no('needs_dressing_help') && no('needs_bathing_help') && no('needs_toileting_help') && no('needs_supervision') && no('needs_constant_care')) return 0;
  return null;
}

function scoreModifiedRankin(input, context) {
  const score = integer(input.selectedScore, 'selectedScore', { min: 0, max: 6 });
  const clinicalReasoning = text(input.clinicalReasoning, 'clinicalReasoning', { required: true });
  const interview = normalizeMrsInterview(input.interview);
  invariant(Array.isArray(input.observations), 'observations must be an array');
  const observations = input.observations.map((observation) => choice(observation, 'observations', MRS_OBSERVATIONS));
  const clinicalContext = input.clinicalContext && typeof input.clinicalContext === 'object' ? {
    diagnosis: text(input.clinicalContext.diagnosis, 'clinicalContext.diagnosis', { max: 500 }),
    eventDate: text(input.clinicalContext.eventDate, 'clinicalContext.eventDate', { max: 20 }),
    affectedSide: text(input.clinicalContext.affectedSide, 'clinicalContext.affectedSide', { max: 100 }),
    livingSituation: text(input.clinicalContext.livingSituation, 'clinicalContext.livingSituation', { max: 500 }),
    supports: text(input.clinicalContext.supports, 'clinicalContext.supports', { max: 1000 }),
    previousScore: optionalInteger(input.clinicalContext.previousScore, 'clinicalContext.previousScore', { min: 0, max: 6 }),
    previousScoreDate: text(input.clinicalContext.previousScoreDate, 'clinicalContext.previousScoreDate', { max: 20 }),
  } : { diagnosis: '', eventDate: '', affectedSide: '', livingSituation: '', supports: '', previousScore: null, previousScoreDate: '' };
  const grade = MRS_GRADES[score];
  const suggested = suggestMrsGrade(interview);
  const change = clinicalContext.previousScore === null ? null : score - clinicalContext.previousScore;
  const changeLabel = change === null ? null : change < 0 ? 'Improved' : change > 0 ? 'Worsened' : 'Unchanged';
  const riskFlags = [];
  if (interview.needs_supervision === 'yes' || observations.includes('Falls risk concern identified') || observations.includes('Balance impairment observed')) riskFlags.push('⚠ Falls risk concern');
  if (interview.needs_dressing_help === 'yes' || interview.needs_bathing_help === 'yes' || interview.needs_toileting_help === 'yes') riskFlags.push('👤 Carer/support needs identified');
  if (observations.includes('Falls risk concern identified') || observations.includes('Balance impairment observed')) riskFlags.push('🏠 Home safety review may be required');
  if (observations.includes('Balance impairment observed') || observations.includes('Fatigue limits function') || interview.needs_gait_aid === 'yes') riskFlags.push('🩺 Physiotherapy/OT referral may be appropriate');
  const walk = interview.walk_independently === 'yes' ? 'walks independently' : interview.walk_independently === 'no' ? 'does not walk independently' : 'walking status unclear';
  const personalCareAnswers = ['needs_bathing_help', 'needs_dressing_help', 'needs_toileting_help'].map((key) => interview[key]);
  const care = personalCareAnswers.some((answer) => answer === 'yes')
    ? 'requires personal care assistance'
    : personalCareAnswers.every((answer) => answer === 'no')
      ? 'is independent in personal care'
      : 'personal care status is unclear';
  const supervision = interview.needs_supervision === 'yes'
    ? 'requires supervision for safety'
    : interview.needs_supervision === 'no'
      ? 'does not require supervision'
      : 'supervision requirements are unclear';
  const report = `Modified Rankin Scale score: ${score}/6. This indicates ${grade.label.toLowerCase()}. The client ${walk}, ${care}, and ${supervision}. Clinical reasoning: ${clinicalReasoning}`;
  const interviewSummary = Object.entries(interview).map(([key, answer]) => `    ${key.replace(/_/g, ' ')}: ${answer}`).join('\n') || '    Not completed';
  const soap = `• Modified Rankin Scale (mRS): Grade ${score}/6 — ${grade.label}\n  ${grade.description}${suggested !== null ? `\n  Suggested Grade (logic): ${suggested} — clinician confirmed: ${score}` : ''}${change !== null ? `\n  Change from previous score (${clinicalContext.previousScore}): ${change > 0 ? '+' : ''}${change} grade(s) — ${changeLabel}` : ''}\n\n  Structured Interview:\n${interviewSummary}\n\n  Observations:\n${observations.length ? observations.map((observation) => `    ✓ ${observation}`).join('\n') : '    None recorded'}${riskFlags.length ? `\n\n  Risk Flags:\n${riskFlags.map((flag) => `    ${flag}`).join('\n')}` : ''}\n\n  Clinical reasoning: ${clinicalReasoning}\n\n  Report: ${report}`;
  return completedPayload('modified_rankin', input, { ...context, notes: clinicalReasoning }, score, soap, {
    grade: score, label: grade.label, suggested_grade: suggested, previous_score: clinicalContext.previousScore,
    score_change: change, change_label: changeLabel, interview_responses: interview, observations,
    clinical_context: clinicalContext, clinical_reasoning: clinicalReasoning, risk_flags: riskFlags,
  }, report);
}

function pegClassification(time, gender, side) {
  if (!gender || time === null) return null;
  const norm = NINE_PEG_NORMS[gender][side];
  const z = (time - norm.mean) / norm.sd;
  if (z <= -1) return 'Above Average';
  if (z <= 1) return 'Average';
  if (z <= 2) return 'Below Average';
  return 'Significantly Below Average';
}

function scoreNinePeg(input, context) {
  const dominantTime = finiteNumber(input.dominantTime, 'dominantTime', { min: 0.01, max: 600 });
  const nonDominantTime = optionalNumber(input.nonDominantTime, 'nonDominantTime', { min: 0.01, max: 600 });
  const dominantSide = choice(input.dominantSide, 'dominantSide', ['right', 'left']);
  const nonDominantSide = dominantSide === 'right' ? 'left' : 'right';
  const gender = optionalChoice(input.gender, 'gender', ['male', 'female']);
  const dominantClassification = pegClassification(dominantTime, gender, dominantSide);
  const nonDominantClassification = pegClassification(nonDominantTime, gender, nonDominantSide);
  const soap = [
    '• Nine-Hole Peg Test (NHPT)',
    `  Dominant Hand (${dominantSide}): ${dominantTime}s${dominantClassification ? ` — ${dominantClassification}` : ''}`,
    nonDominantTime !== null ? `  Non-Dominant Hand (${nonDominantSide}): ${nonDominantTime}s${nonDominantClassification ? ` — ${nonDominantClassification}` : ''}` : null,
    gender ? `  Reference Norms (${gender}): Right ${NINE_PEG_NORMS[gender].right.mean}s ±${NINE_PEG_NORMS[gender].right.sd}, Left ${NINE_PEG_NORMS[gender].left.mean}s ±${NINE_PEG_NORMS[gender].left.sd}` : null,
  ].filter(Boolean).join('\n');
  return completedPayload('nine_peg', input, context, dominantTime, soap, {
    dominant_side: dominantSide, dominant_hand_time: dominantTime, non_dominant_hand_time: nonDominantTime,
    dominant_classification: dominantClassification, non_dominant_classification: nonDominantClassification,
  });
}

function scoreGroovedPeg(input, context) {
  const dominantTime = finiteNumber(input.dominantTime, 'dominantTime', { min: 0.01, max: 300 });
  const nonDominantTime = optionalNumber(input.nonDominantTime, 'nonDominantTime', { min: 0.01, max: 300 });
  const assemblyPieces = optionalInteger(input.assemblyPieces, 'assemblyPieces', { min: 0, max: 1000 });
  const dominantDrops = integer(input.dominantDrops, 'dominantDrops', { min: 0, max: 1000 });
  const nonDominantDrops = integer(input.nonDominantDrops, 'nonDominantDrops', { min: 0, max: 1000 });
  const dominantHand = choice(input.dominantHand, 'dominantHand', ['right', 'left']);
  const dominantLabel = dominantHand === 'right' ? 'Right' : 'Left';
  const nonDominantLabel = dominantHand === 'right' ? 'Left' : 'Right';
  const soap = `Grooved Pegboard Test\n\nPeg Only — Dominant Hand (${dominantLabel}): ${formatSeconds(dominantTime)}${dominantTime >= 300 ? ' (DNF)' : ''}${dominantDrops > 0 ? ` | Drops: ${dominantDrops}` : ''}\nPeg Only — Non-Dominant Hand (${nonDominantLabel}): ${nonDominantTime !== null ? `${formatSeconds(nonDominantTime)}${nonDominantTime >= 300 ? ' (DNF)' : ''}${nonDominantDrops > 0 ? ` | Drops: ${nonDominantDrops}` : ''}` : 'Not completed'}\n${assemblyPieces !== null ? `Assembly (Peg + Washer + Nut, 30s): ${assemblyPieces} pieces` : 'Assembly: Not completed'}${notesFrom(input, context) ? `\n\nNotes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('grooved_peg', input, context, Math.round(dominantTime), soap, {
    dominant_hand: dominantHand, dominant_hand_time_seconds: Math.round(dominantTime),
    non_dominant_hand_time_seconds: nonDominantTime === null ? null : Math.round(nonDominantTime),
    dominant_drops: dominantDrops, non_dominant_drops: nonDominantDrops, assembly_pieces: assemblyPieces,
  });
}

function scoreElys(input, context) {
  const angle = finiteNumber(input.kneeFlexionAngle, 'kneeFlexionAngle', { min: 0.1, max: 180 });
  const hipObserved = boolean(input.hipFlexionObserved, 'hipFlexionObserved');
  const interpretation = angle < 120 || hipObserved ? 'Positive (Rectus femoris tightness)' : 'Negative (Normal flexibility)';
  const soap = `• Ely's Test (Rectus Femoris Tightness)\n  Knee Flexion Angle: ${angle}°\n  Hip Flexion Observed: ${hipObserved ? 'Yes (Positive)' : 'No (Negative)'}\n  Interpretation: ${interpretation}\n  Normal: >120° knee flexion without hip flexion (buttock lifts from table)\n  Clinical Significance: Positive test suggests rectus femoris shortness/tightness`;
  return completedPayload('elys_test', input, context, angle, soap, {
    knee_flexion_angle: angle, hip_flexion_observed: hipObserved, interpretation,
  });
}

function normalizeThomasSide(value, field, required) {
  const source = value && typeof value === 'object' ? value : {};
  if (!required && !Object.values(source).some(hasValue)) return null;
  const hipAngle = finiteNumber(source.hipAngle, `${field}.hipAngle`, { min: -30, max: 90 });
  const kneeAngle = finiteNumber(source.kneeAngle, `${field}.kneeAngle`, { min: 0, max: 180 });
  const abduction = choice(source.abduction, `${field}.abduction`, THOMAS_SIDE_CHOICES.abduction);
  const externalRotation = choice(source.externalRotation, `${field}.externalRotation`, THOMAS_SIDE_CHOICES.externalRotation);
  const pelvicCompensation = choice(source.pelvicCompensation, `${field}.pelvicCompensation`, THOMAS_SIDE_CHOICES.compensation);
  const lumbarExtension = choice(source.lumbarExtension, `${field}.lumbarExtension`, THOMAS_SIDE_CHOICES.compensation);
  const painPresent = choice(source.painPresent, `${field}.painPresent`, THOMAS_SIDE_CHOICES.pain);
  const painLocation = text(source.painLocation, `${field}.painLocation`, { max: 500 });
  const painSeverity = painPresent === 'yes' ? finiteNumber(source.painSeverity, `${field}.painSeverity`, { min: 0, max: 10 }) : null;
  invariant(painPresent !== 'yes' || painLocation, `${field}.painLocation is required when pain is present`);
  return { hipAngle, kneeAngle, abduction, externalRotation, painPresent, painLocation, painSeverity, pelvicCompensation, lumbarExtension };
}

function thomasInterpretation(data) {
  const findings = [];
  const positiveStructures = [];
  const negativeStructures = [];
  if (data.hipAngle > 0) { positiveStructures.push('Iliopsoas / hip flexors'); findings.push(`Hip flexion of ${data.hipAngle}° above table — iliopsoas/hip flexor tightness.`); }
  else { negativeStructures.push('Iliopsoas'); findings.push('Thigh rests flat — iliopsoas within normal limits.'); }
  if (data.kneeAngle < 80) { positiveStructures.push('Rectus femoris'); findings.push(`Knee flexion ${data.kneeAngle}° (normal ≥80°) — rectus femoris tightness.`); }
  else { negativeStructures.push('Rectus femoris'); findings.push(`Knee flexion ${data.kneeAngle}° — rectus femoris within normal limits.`); }
  if (data.abduction !== 'none') { positiveStructures.push('TFL / ITB'); findings.push(`${data.abduction} hip abduction observed — indicates TFL/ITB tightness.`); }
  else negativeStructures.push('TFL / ITB');
  if (data.externalRotation !== 'none') positiveStructures.push('Sartorius / external rotators');
  if (data.pelvicCompensation === 'present') findings.push('Pelvic compensation observed — test validity may be reduced.');
  if (data.lumbarExtension === 'present') findings.push('Lumbar extension compensation observed — reassess with stricter pelvic control.');
  if (data.painPresent === 'yes') findings.push(`Pain provocation: ${data.painLocation} — severity ${data.painSeverity}/10.`);
  return { findings, positiveStructures, negativeStructures };
}

function thomasOverall(data) {
  const positiveCount = [data.hipAngle > 0, data.kneeAngle < 80, data.abduction !== 'none', data.externalRotation !== 'none'].filter(Boolean).length;
  return positiveCount === 0 ? 'Negative' : positiveCount === 1 ? 'Positive' : 'Mixed Findings';
}

function scoreThomas(input, context) {
  invariant(input.setupConfirmed === true, 'Thomas Test setup checklist must be confirmed');
  const testMode = choice(input.testMode, 'testMode', ['bilateral', 'right', 'left']);
  const right = normalizeThomasSide(input.right, 'right', testMode !== 'left');
  const left = normalizeThomasSide(input.left, 'left', testMode !== 'right');
  const primary = testMode === 'left' ? left : right;
  invariant(primary, 'primary Thomas Test side is required');
  const primaryInterpretation = thomasInterpretation(primary);
  const recommendations = [];
  if (primary.hipAngle > 0) recommendations.push('Iliopsoas stretching and lumbopelvic control training.');
  if (primary.kneeAngle < 80) recommendations.push('Rectus femoris stretching and progressive loading.');
  if (primary.abduction !== 'none') recommendations.push('TFL/ITB mobility and hip adductor strengthening.');
  if (primary.externalRotation !== 'none') recommendations.push('Consider hip internal-rotator strengthening and external-rotator mobility.');
  if (primary.pelvicCompensation === 'present' || primary.lumbarExtension === 'present') recommendations.push('Core stability and lumbopelvic control training.');
  recommendations.push('Reassess in 4–6 weeks following targeted intervention.');
  const redFlags = [];
  if (primary.painPresent === 'yes' && primary.painSeverity >= 7) redFlags.push('Strong pain provocation (≥7/10) — test validity compromised.');
  if (primary.pelvicCompensation === 'present' && primary.lumbarExtension === 'present') redFlags.push('Unable to maintain pelvic/lumbar neutral — result may be invalid.');
  const sideText = (label, data) => {
    if (!data) return null;
    const interpretation = thomasInterpretation(data);
    return `  ${label} Side:\n    Hip Flexion: ${data.hipAngle}°\n    Knee Flexion: ${data.kneeAngle}°\n    Hip Abduction: ${data.abduction}\n    External Rotation: ${data.externalRotation}\n    Pelvic Compensation: ${data.pelvicCompensation}\n    Lumbar Extension: ${data.lumbarExtension}\n    Pain: ${data.painPresent === 'yes' ? `Yes — ${data.painLocation} ${data.painSeverity}/10` : 'No'}${interpretation.positiveStructures.length ? `\n    Positive: ${interpretation.positiveStructures.join(', ')}` : ''}\n${interpretation.findings.map((finding) => `    → ${finding}`).join('\n')}`;
  };
  const soap = [
    '• Thomas Test (Hip Flexor Tightness Assessment)',
    `  Sides Tested: ${testMode === 'bilateral' ? 'Bilateral' : testMode === 'right' ? 'Right' : 'Left'}`,
    right ? sideText('Right', right) : null, left ? sideText('Left', left) : null,
    redFlags.length ? `  ⚠ Red Flags: ${redFlags.join('; ')}` : null,
    `  Clinical Recommendations: ${recommendations.slice(0, 3).join(' | ')}`,
    notesFrom(input, context) ? `  Notes: ${notesFrom(input, context)}` : null,
  ].filter(Boolean).join('\n');
  return completedPayload('thomas_test', input, context, primary.hipAngle, soap, {
    test_mode: testMode, right, left, setup_confirmed: true, overall_result: thomasOverall(primary),
    primary_findings: primaryInterpretation.findings, recommendations, red_flags: redFlags,
  });
}

function scoreAnteriorDrawer(input, context) {
  const side = choice(input.side, 'side', ['Left', 'Right', 'Bilateral']);
  const translation = optionalNumber(input.anteriorTranslation, 'anteriorTranslation', { min: 0, max: 50 });
  const grade = optionalChoice(input.translationGrade, 'translationGrade', ['0', '1+', '2+', '3+']);
  invariant(translation !== null || grade !== null, 'anterior translation measurement or laxity grade is required');
  const positive = grade === '2+' || grade === '3+' || (translation !== null && translation > 5);
  const overall = positive ? 'Positive' : 'Negative';
  const soap = [
    `• Anterior Drawer Test (Knee) — ${side} Side`, `  Overall Result: ${overall}`,
    translation !== null ? `  Anterior Translation: ${translation} mm` : null,
    grade ? `  Laxity Grade: ${grade}` : null,
    input.endFeel ? `  End Feel: ${text(input.endFeel, 'endFeel', { max: 250 })}` : null,
    input.painOnTest ? `  Pain on Test: ${text(input.painOnTest, 'painOnTest', { max: 100 })}` : null,
    input.painLocation ? `  Pain Location: ${text(input.painLocation, 'painLocation', { max: 500 })}` : null,
    input.comparedToContralateral ? `  Contralateral Comparison: ${text(input.comparedToContralateral, 'comparedToContralateral', { max: 500 })}` : null,
    input.suspectedACLTear ? `  Clinical Impression: ${text(input.suspectedACLTear, 'suspectedACLTear', { max: 500 })}` : null,
    input.additionalFindings ? `  Additional Findings: ${text(input.additionalFindings, 'additionalFindings')}` : null,
    notesFrom(input, context) ? `  Clinical Notes: ${notesFrom(input, context)}` : null,
  ].filter(Boolean).join('\n');
  return completedPayload('anterior_drawer_knee', input, context, positive ? 1 : 0, soap, {
    side, anterior_translation_mm: translation, translation_grade: grade,
    end_feel: text(input.endFeel, 'endFeel', { max: 250 }), pain_on_test: text(input.painOnTest, 'painOnTest', { max: 100 }),
    pain_location: text(input.painLocation, 'painLocation', { max: 500 }), compared_to_contralateral: text(input.comparedToContralateral, 'comparedToContralateral', { max: 500 }),
    suspected_acl_tear: text(input.suspectedACLTear, 'suspectedACLTear', { max: 500 }), additional_findings: text(input.additionalFindings, 'additionalFindings'),
    overall_result: overall,
  });
}

function scoreNoble(input, context) {
  const isPositive = boolean(input.isPositive, 'isPositive');
  const side = choice(input.side, 'side', ['right', 'left']);
  const kneeAngle = finiteNumber(input.kneeAngle, 'kneeAngle', { min: 0, max: 180 });
  const reproduced = optionalBoolean(input.reproduced, 'reproduced');
  const painLevel = optionalNumber(input.painLevel, 'painLevel', { min: 0, max: 10 });
  const painType = optionalChoice(input.painType, 'painType', ['Sharp', 'Burning', 'Aching', 'Stabbing', 'Pressure', 'Tingling', 'None']);
  const painLocation = optionalChoice(input.painLocation, 'painLocation', ['Lateral femoral condyle', 'Distal ITB', "Gerdy's tubercle", 'Along ITB tract', 'Other']);
  const result = isPositive ? 'Positive' : 'Negative';
  const soap = [
    `• Noble Compression Test: ${result}`, `  Side Tested: ${side.charAt(0).toUpperCase()}${side.slice(1)}`,
    `  Knee Flexion Angle at Compression: ${kneeAngle}°`,
    reproduced !== null ? `  Pain Reproduced at 30° Flexion: ${reproduced ? 'Yes' : 'No'}` : null,
    painLevel !== null ? `  Pain Intensity (NRS): ${painLevel}/10` : null,
    painType ? `  Pain Quality/Type: ${painType}` : null, painLocation ? `  Pain Location: ${painLocation}` : null,
    notesFrom(input, context) ? `  Additional Notes: ${notesFrom(input, context)}` : null,
  ].filter(Boolean).join('\n');
  return completedPayload('noble_compression', input, context, isPositive ? 1 : 0, soap, {
    result, side, knee_angle_degrees: kneeAngle, pain_reproduced_at_30deg: reproduced,
    pain_level: painLevel, pain_type: painType, pain_location: painLocation,
  });
}

const SCORER_FUNCTIONS = Object.freeze({
  arm_curl: scoreArmCurl,
  '30sec_sts': scoreThirtySecondSts,
  triple_hop: scoreTripleHop,
  trendelenburg: scoreTrendelenburg,
  stair_climb: scoreStairClimb,
  two_min_step: scoreTwoMinStep,
  step_tap: scoreStepTap,
  box_block_test: scoreBoxBlock,
  mcgill: scoreMcGill,
  '60sec_sts': scoreSixtySecondSts,
  distress_thermometer: scoreDistress,
  static_back: scoreStaticBack,
  rombergs_standing: scoreRomberg,
  shoulder_tug: scoreShoulderTug,
  gst: scoreGst,
  timed_push_up: scoreTimedPushUp,
  static_squat: scoreStaticSquat,
  squat: scoreSquat,
  ymca_bench: scoreYmcaBench,
  '5xsts': scoreFiveXSts,
  fac: scoreFac,
  modified_rankin: scoreModifiedRankin,
  nine_peg: scoreNinePeg,
  grooved_peg: scoreGroovedPeg,
  elys_test: scoreElys,
  thomas_test: scoreThomas,
  anterior_drawer_knee: scoreAnteriorDrawer,
  noble_compression: scoreNoble,
});

const FIXTURES = {
  arm_curl: { sex: 'female', age: 72, dominantSide: 'right', testedSide: 'right', weightKg: 2, rightReps: 18, leftReps: 17, notes: 'Controlled cadence.' },
  '30sec_sts': { completed: true, standCount: 14, handsUsed: false, preHR: 72, postHR: 96, symptoms: 'None', notes: 'Standard chair.' },
  triple_hop: { side: 'right', rightTrials: [430, 442, 438], leftTrials: [421, 425, 419], notes: 'Stable landings.' },
  trendelenburg: { left: { result: 'Negative', signs: { hip_drop: false, trunk_lurch: false, early_drop: false, pelvic_obliquity: false } }, right: { result: 'Positive', signs: { hip_drop: true, trunk_lurch: false, early_drop: false, pelvic_obliquity: false } }, notes: 'Right pelvic drop observed.' },
  stair_climb: { timeSeconds: 7.4, stairCount: 10, handrailUse: false, gaitStability: 'stable', assistiveDevice: 'none', notes: 'Step-over-step pattern.' },
  two_min_step: { completed: true, steps: 92, age: 72, gender: 'female', hrPre: 70, hrPost: 104, bpPre: '122/76', bpPost: '136/80', symptoms: 'None', notes: 'Target height maintained.' },
  step_tap: { reps: 24, duration: 15, stepHeight: 7.5, notes: 'Alternating taps.' },
  box_block_test: { completed: true, blocksMoved: 82, dominantHand: 'right', age: 48, sex: 'female', notes: 'No drops.' },
  mcgill: { times: { extensor: 130, flexor: 95, right_side: 78, left_side: 75 }, notes: 'Position maintained.' },
  '60sec_sts': { completed: true, reps: 26, handsUsed: false, age: 74, gender: 'female', hrPre: 68, bpPre: '120/74', hrPost: 102, bpPost: '134/78', notes: 'Full stands.' },
  distress_thermometer: { score: 5, checkedProblems: { 'Work/school': true, Fatigue: true, Pain: false }, notes: 'Discussed supports.' },
  static_back: { finalTime: 118.4, stopReason: 'Fatigue', otherStopReason: '', reachedMaxDuration: false, age: 45, gender: 'female', setup: { equipment: 'Treatment plinth', securing: 'straps', armsPosition: 'crossed', testModified: false, modificationNote: '', baselinePain: 1 }, technique: { maintainedHorizontal: true, excessiveLumbarExtension: false, hipPelvicRotation: false, shoulderCompensation: false, breathHolding: false, requiredVerbalCueing: true, qualityRating: 'Good' }, symptoms: { painDuring: 2, painLocations: ['Lumbar'], symptomsIncreased: false, neurologicalSymptoms: false, postTestPain: 2, rpeAfter: 7 }, notes: 'Stopped at fatigue.' },
  rombergs_standing: { surfaceType: 'Firm', footPosition: 'Feet together', footwear: 'Shoes', assistanceLevel: 'Standby', eyesOpenTime: 30, eoSwayObserved: 'No', eoSwaySeverity: 'None', eoSwayDirection: 'Not observed', eyesClosedTime: 24.5, ecSwayObserved: 'Yes', ecSwaySeverity: 'Mild', ecSwayDirection: 'Medial/lateral', completedFull: 'No', lossOfBalance: 'No', stepTaken: 'No', requiresAssistance: 'No', stopReason: 'Time recorded', notes: 'Mild sway.' },
  shoulder_tug: { steps: 3, assistanceNeeded: false, notes: 'Three recovery steps.' },
  gst: { reps: 16, side: 'bilateral', weight: '400g', notes: 'Cadence maintained.' },
  timed_push_up: { completed: true, pushUpCount: 22, durationSeconds: 60, preTest: { hr: 68, bp: '118/72', spo2: 98 }, postTest: { hr: 112, bp: '136/78', spo2: 97 }, qualityNotes: 'Neutral trunk.', notes: 'No pain.' },
  static_squat: { completed: true, elapsed: 52, age: 44, gender: 'female', stopReason: 'Voluntary stop', setup: { knee_angle: 90, footwear: 'shoes', surface: 'wall', back_contact: 'full', feet_position: 'shoulder_width', pain_pre: 1, fatigue_pre: 2, dominant: 'right', symptomatic: 'none' }, painPost: 2, fatiguePost: 7, observations: { knee_valgus: false, heel_rise: false, back_arch: false, trembling: true, pain_provoked: false, required_guarding: false }, notes: 'Good control.' },
  squat: { squatCount: 32, testDuration: 60, age: 42, bodyWeight: 78, observations: { chestUp: true, kneeTracking: true, fullDepth: true, noCompensation: true, consistentPace: false }, preTestNotes: 'Warm-up complete.', postTestNotes: 'Fatigue late.', notes: 'No pain.' },
  ymca_bench: { completed: true, bodyMass: 76, gender: 'M', testWeight: 36, repetitions: 30, cadenceBreakdown: 'no', rpe: 7, painPresent: 'no', notes: 'Cadence maintained.' },
  '5xsts': { trials: [1.9, 3.8, 5.8, 7.7, 9.8], notes: 'Arms crossed.' },
  fac: { score: 4, notes: 'Independent on level surface.' },
  modified_rankin: { selectedScore: 2, clinicalReasoning: 'Independent in personal care with reduced higher-level activity.', interview: { walk_independently: 'yes', needs_gait_aid: 'no', needs_dressing_help: 'no', needs_bathing_help: 'no', needs_toileting_help: 'no', needs_meals_help: 'no', leave_home_independently: 'yes', manage_medications: 'yes', manage_appointments: 'yes', return_to_previous: 'no', needs_supervision: 'no', needs_constant_care: 'no' }, observations: ['Independent transfers observed', 'Ambulates independently'], clinicalContext: { diagnosis: 'Synthetic neurological episode', eventDate: '2026-07-01', affectedSide: 'Left', livingSituation: 'Home', supports: 'Family', previousScore: 3, previousScoreDate: '2026-07-15' } },
  nine_peg: { dominantTime: 21.4, nonDominantTime: 23.1, dominantSide: 'right', gender: 'female', notes: 'No dropped pegs.' },
  grooved_peg: { dominantTime: 74.2, nonDominantTime: 82.8, assemblyPieces: 18, dominantDrops: 1, nonDominantDrops: 0, dominantHand: 'right', notes: 'One dominant-hand drop.' },
  elys_test: { kneeFlexionAngle: 112, hipFlexionObserved: true, notes: 'Pelvis stabilised.' },
  thomas_test: { setupConfirmed: true, testMode: 'bilateral', right: { hipAngle: 8, kneeAngle: 76, abduction: 'mild', externalRotation: 'none', painPresent: 'no', painLocation: '', painSeverity: '', pelvicCompensation: 'absent', lumbarExtension: 'absent' }, left: { hipAngle: 4, kneeAngle: 84, abduction: 'none', externalRotation: 'none', painPresent: 'no', painLocation: '', painSeverity: '', pelvicCompensation: 'absent', lumbarExtension: 'absent' }, notes: 'Bilateral comparison completed.' },
  anterior_drawer_knee: { side: 'Right', anteriorTranslation: 7, translationGrade: '2+', endFeel: 'Soft/Abnormal (ACL insufficiency)', painOnTest: 'Mild', painLocation: 'Anterior knee', comparedToContralateral: 'Increased translation', suspectedACLTear: 'Possible ACL insufficiency', additionalFindings: 'No guarding', notes: 'Compared bilaterally.' },
  noble_compression: { isPositive: true, side: 'right', kneeAngle: 30, reproduced: true, painLevel: 5, painType: 'Aching', painLocation: 'Lateral femoral condyle', notes: 'Symptoms reproduced.' },
};

export const FIXTURE_BY_KEY = deepFreeze(FIXTURES);

export function buildFixture(runnerKey) {
  const key = String(runnerKey || '').trim();
  invariant(RUNNER_KEY_SET.has(key), `unsupported runner fixture ${runnerKey}`);
  return clone(FIXTURE_BY_KEY[key]);
}

export function validateAndScore(input, context = {}) {
  invariant(input && typeof input === 'object' && !Array.isArray(input), 'input must be an object');
  const key = String(context.runnerKey || context.scoringKey || input.runnerKey || input.runner_key || input.scoringKey || input.scoring_key || '').trim();
  invariant(RUNNER_KEY_SET.has(key), `runnerKey must be one of: ${RUNNER_KEYS.join(', ')}`);
  return SCORER_FUNCTIONS[key](input, context);
}

export const SCORERS_BY_KEY = deepFreeze(Object.fromEntries(RUNNER_KEYS.map((key) => [key, {
  runnerSpec: RUNNER_SPEC_BY_KEY[key],
  fixture: FIXTURE_BY_KEY[key],
  validateAndScore(input, context = {}) {
    return SCORER_FUNCTIONS[key](input, { ...context, runnerKey: key });
  },
}])));
