const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SCORING_VERSION = 'extras-mobility-balance-ortho.v1';

export const RUNNER_KEYS = Object.freeze([
  'jta_icare', 'tug_full', 'sit_reach_test', 'chair_sit_reach', 'back_scratch_test',
  'functional_reach_test', 'single_leg_stance_test', 'sppb', 'tandem_stand', 'sebt',
  'ten_metre_walk', 'beighton', 'dual_task_gait', 'plank', 'standing_stork',
  'med_ball', 'purdue_peg', 'standing_long_jump', 'illinois', 't_test', '505',
  'hexagon', 'rsi', '10sec_jump', 'ckcuest_full', 'isometric_testing',
  'isokinetic_dyn', 'obers_test', 'slr_test', 'slump_test', 'lachman_test',
  'pivot_shift', 'mcmurrays_test', 'thessaly_test', 'apleys_compression', 'l_test',
  'figure8', 'visual_rom',
]);

const RUNNER_KEY_SET = new Set(RUNNER_KEYS);

function fail(message) {
  throw new Error(`Extras mobility/balance/orthopaedic scorer: ${message}`);
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

function text(value, field, { required = false, max = 8000 } = {}) {
  const normalized = String(value ?? '').trim();
  invariant(!required || normalized.length > 0, `${field} is required`);
  invariant(normalized.length <= max, `${field} must be ${max} characters or fewer`);
  return normalized;
}

function record(value, field) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), `${field} must be an object`);
  return value;
}

function array(value, field, { minItems = 0, maxItems = Infinity } = {}) {
  invariant(Array.isArray(value), `${field} must be an array`);
  invariant(value.length >= minItems && value.length <= maxItems, `${field} must contain ${minItems}-${maxItems} items`);
  return value;
}

function numericArray(value, field, { minItems = 1, maxItems = Infinity, min = -Infinity, max = Infinity } = {}) {
  return array(value, field, { minItems, maxItems }).map((entry, index) => (
    finiteNumber(entry, `${field}[${index}]`, { min, max })
  ));
}

function optionalBloodPressure(value, field) {
  if (!hasValue(value)) return null;
  const normalized = text(value, field, { max: 20 });
  invariant(/^\d{2,3}\s*\/\s*\d{2,3}$/.test(normalized), `${field} must use systolic/diastolic format`);
  return normalized.replace(/\s+/g, '');
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function mean(values) {
  invariant(values.length > 0, 'cannot calculate a mean without values');
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function notesFrom(input, context) {
  return text(context?.notes ?? input?.notes ?? input?.clinicalNotes ?? input?.globalNotes ?? '', 'notes');
}

function completedPayload(key, input, context, resultValue, soapText, additionalData, reportText = soapText) {
  const assessmentDate = String(context?.assessmentDate || input?.assessmentDate || input?.assessment_date || '').trim();
  invariant(LOCAL_DATE_PATTERN.test(assessmentDate), `${key} requires assessmentDate in YYYY-MM-DD format`);
  invariant(Number.isFinite(resultValue), `${key} result_value must be finite`);
  invariant(typeof soapText === 'string' && soapText.trim(), `${key} SOAP text is required`);
  invariant(typeof reportText === 'string' && reportText.trim(), `${key} report text is required`);
  const rawInput = clone(input);
  delete rawInput.assessmentDate;
  delete rawInput.assessment_date;
  delete rawInput.runnerKey;
  delete rawInput.runner_key;
  return {
    status: 'completed',
    result_value: resultValue,
    assessment_date: assessmentDate,
    notes: notesFrom(input, context),
    additional_data: {
      measurement_type: RUNNER_SPEC_BY_KEY[key].measurementType,
      scoring_key: key,
      scoring_version: SCORING_VERSION,
      raw_input: rawInput,
      soap_text: soapText,
      report_text: reportText,
      ...additionalData,
    },
  };
}

function option(label, value = label) {
  return { label, value };
}

const SEX_OPTIONS = [option('Male', 'male'), option('Female', 'female')];
const SIDE_OPTIONS = [option('Left', 'left'), option('Right', 'right')];
const YES_NO_OPTIONS = [option('Yes', 'Yes'), option('No', 'No')];

/**
 * @param {string} key
 * @param {string} label
 * @param {string} type
 * @param {boolean | string} [required]
 * @param {Record<string, unknown>} [extra]
 */
function field(key, label, type, required = true, extra = {}) {
  return { key, label, type, required, ...extra };
}

function numberListField(key, label, itemLabel, {
  required = true,
  minItems = 1,
  maxItems = 10,
  min = -Infinity,
  max = Infinity,
  integer: wholeNumber = false,
} = {}) {
  /** @type {Record<string, unknown>} */
  const itemLimits = {};
  if (Number.isFinite(min)) itemLimits.min = min;
  if (Number.isFinite(max)) itemLimits.max = max;
  return field(key, label, 'number[]', required, {
    minItems,
    maxItems,
    items: [field('value', itemLabel, wholeNumber ? 'integer' : 'number', true, itemLimits)],
  });
}

function choiceListField(key, label, itemLabel, options, {
  required = true,
  minItems = 0,
  maxItems = options.length,
} = {}) {
  return field(key, label, 'choice[]', required, {
    minItems,
    maxItems,
    items: [field('value', itemLabel, 'choice', true, { options })],
  });
}

function repeatedGroupField(key, label, items, {
  required = true,
  minItems = 1,
  maxItems = 10,
} = {}) {
  return field(key, label, 'object[]', required, { minItems, maxItems, items });
}

/**
 * @param {string} key
 * @param {string} label
 * @param {Array<Record<string, unknown>>} fields
 * @param {boolean | string} [required]
 * @param {string} [type]
 */
function groupField(key, label, fields, required = true, type = 'object') {
  return field(key, label, type, required, { fields });
}

function atomicSchemaKey(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  invariant(key && !/[.\[\]]/.test(key), `cannot derive an atomic schema key from ${value}`);
  return key;
}

function vitalsFields({ required = false } = {}) {
  return [
    field('systolic', 'Systolic blood pressure', 'integer', required, { min: 50, max: 300 }),
    field('diastolic', 'Diastolic blood pressure', 'integer', required, { min: 20, max: 200 }),
    field('heartRate', 'Heart rate', 'integer', required, { min: 20, max: 300 }),
  ];
}

function compactVitalsFields({ required = false } = {}) {
  return [
    field('heartRate', 'Heart rate', 'integer', required, { min: 20, max: 300 }),
    field('bloodPressure', 'Blood pressure', 'text', required, { pattern: '^\\d{2,3}\\s*/\\s*\\d{2,3}$' }),
  ];
}

function defineSpec({ runnerKey, name, measurementType, primaryField, unit, formula, fields }) {
  invariant(RUNNER_KEY_SET.has(runnerKey), `${runnerKey} is not in the B2 runner-key boundary`);
  invariant(fields.length > 0, `${runnerKey} requires fields`);
  return deepFreeze({
    schemaVersion: 1,
    kind: 'measurement',
    runnerKey,
    scoringKey: runnerKey,
    name,
    measurementType,
    fields,
    scoring: {
      version: SCORING_VERSION,
      formula,
      validation: 'Required fields, choice domains, trial cardinality and numeric bounds are enforced before scoring; invalid input throws and does not persist.',
    },
    result: {
      primaryField,
      unit,
      persistence: ['result_value', 'additional_data.raw_input', 'additional_data.soap_text', 'additional_data.report_text'],
    },
  });
}

export const VISUAL_ROM_JOINTS = deepFreeze([
  ['cervical', 'Cervical Spine', ['Flexion', 'Extension', 'Lat. Flexion (L)', 'Lat. Flexion (R)', 'Rotation (L)', 'Rotation (R)'], ['40-60°', '50-70°', '35-45°', '35-45°', '60-80°', '60-80°']],
  ['thoracic', 'Thoracic Spine', ['Rotation (L)', 'Rotation (R)', 'Extension', 'Lat. Flexion (L)', 'Lat. Flexion (R)'], ['30-35°', '30-35°', '15-20°', '15-20°', '15-20°']],
  ['lumbar', 'Lumbar Spine', ['Flexion', 'Extension', 'Lat. Flexion (L)', 'Lat. Flexion (R)', 'Rotation (L)', 'Rotation (R)'], ['40-60°', '20-35°', '20-30°', '20-30°', '5-15°', '5-15°']],
  ['shoulder_L', 'Shoulder (Left)', ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Ext. Rotation', 'Int. Rotation'], ['0-180°', '0-60°', '0-180°', '0-30°', '0-90°', '0-70°']],
  ['shoulder_R', 'Shoulder (Right)', ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Ext. Rotation', 'Int. Rotation'], ['0-180°', '0-60°', '0-180°', '0-30°', '0-90°', '0-70°']],
  ['elbow_L', 'Elbow (Left)', ['Flexion', 'Extension', 'Supination', 'Pronation'], ['0-150°', '0°', '0-80°', '0-80°']],
  ['elbow_R', 'Elbow (Right)', ['Flexion', 'Extension', 'Supination', 'Pronation'], ['0-150°', '0°', '0-80°', '0-80°']],
  ['wrist_L', 'Wrist (Left)', ['Flexion', 'Extension', 'Radial Dev.', 'Ulnar Dev.'], ['0-80°', '0-70°', '0-20°', '0-30°']],
  ['wrist_R', 'Wrist (Right)', ['Flexion', 'Extension', 'Radial Dev.', 'Ulnar Dev.'], ['0-80°', '0-70°', '0-20°', '0-30°']],
  ['hip_L', 'Hip (Left)', ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Int. Rotation', 'Ext. Rotation'], ['0-120°', '0-20°', '0-45°', '0-30°', '0-45°', '0-45°']],
  ['hip_R', 'Hip (Right)', ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Int. Rotation', 'Ext. Rotation'], ['0-120°', '0-20°', '0-45°', '0-30°', '0-45°', '0-45°']],
  ['knee_L', 'Knee (Left)', ['Flexion', 'Extension'], ['0-135°', '0°']],
  ['knee_R', 'Knee (Right)', ['Flexion', 'Extension'], ['0-135°', '0°']],
  ['ankle_L', 'Ankle (Left)', ['Dorsiflexion', 'Plantarflexion', 'Inversion', 'Eversion'], ['0-20°', '0-50°', '0-35°', '0-15°']],
  ['ankle_R', 'Ankle (Right)', ['Dorsiflexion', 'Plantarflexion', 'Inversion', 'Eversion'], ['0-20°', '0-50°', '0-35°', '0-15°']],
].map(([key, label, movements, normals]) => ({ key, label, movements, normals })));

const FREQUENCY_OPTIONS = [
  option('I - Infrequent (less than 20% of the time)', 'I'),
  option('F - Frequent (20-60% of the time)', 'F'),
  option('C - Constant (more than 60% of the time)', 'C'),
];

const JOB_PHYSICAL_SCHEMA_LABELS = {
  sitting: 'Sitting – seated position to perform tasks', standing: 'Standing – posture throughout activity',
  walking: 'Walking/Running – regularity and surface', sustained_posture: 'Sustained Posture – working in same posture for periods of time',
  bending: 'Bending – forward bending to perform tasks', trunk_twisting: 'Trunk Twisting – while sitting/standing to complete tasks',
  kneeling: 'Kneeling – posture to complete tasks', squatting: 'Squatting/Crouching – posture to complete tasks',
  climbing: 'Climbing (stairs/ladders/structures)', lifting: 'Lifting – overhead/forward extension',
  carrying: 'Carrying – overhead/forward extension', reaching: 'Reaching – forward reaching/overhead reaching',
  pushing: 'Pushing – move objects away from the body', pulling: 'Pulling – move objects toward the body',
  grasping: 'Grasping – fine motor skills, regular use of hands – tools, machinery',
  work_at_heights: 'Work at Heights – using ladders, footstools, scaffolding',
  driving: 'Driving – controlling the operation of a vehicle/Foot and Hand Controls',
};

const JOB_HAZARD_SCHEMA_LABELS = {
  dust: 'Dust – exposure', gases: 'Gases – exposure', fumes: 'Fumes – exposure',
  liquids: 'Liquids – working with/exposure', lighting: 'Lighting – darkness/eye strain',
  extreme_temps: 'Extreme Temperatures – temperatures are less than 15°C or more than 35°C',
  confined_spaces: 'Confined Spaces – areas where work is conducted that are not designed to be entered by a person',
  slippery_surfaces: 'Slippery or Uneven Surfaces',
  biological_hazards: 'Biological Hazards – contact with body fluids, bacteria, infectious diseases',
  ppe: 'Wearing of Personal Protective Equipment – administrative control for the recorded demands',
};

const TUG_DEVICE_OPTIONS = [
  option('None', 'none'), option('Single Point Cane', 'single_cane'), option('Quad Cane', 'quad_cane'),
  option('Walker', 'walker'), option('Rollator', 'rollator'), option('Crutches', 'crutches'),
];

const SPPB_SAFETY_SCHEMA = [
  ['safe_stand', 'Safe to stand independently'], ['safe_walk', 'Safe to ambulate'],
  ['no_dizziness', 'No acute dizziness'], ['no_cv', 'No unstable cardiovascular symptoms'],
  ['no_severe_pain', 'No severe pain limiting movement'], ['walking_aid', 'Walking aid required'],
  ['consent', 'Patient consent obtained'],
];

const SEBT_SCHEMA_DIRECTIONS = [
  'Anterior', 'Anterolateral', 'Lateral', 'Posterolateral',
  'Posterior', 'Posteromedial', 'Medial', 'Anteromedial',
];

const BEIGHTON_SCHEMA_ITEMS = [
  ['leftLittleFinger', 'Left little-finger passive dorsiflexion beyond 90°'],
  ['rightLittleFinger', 'Right little-finger passive dorsiflexion beyond 90°'],
  ['leftThumb', 'Left thumb apposition to forearm'], ['rightThumb', 'Right thumb apposition to forearm'],
  ['leftElbow', 'Left elbow hyperextension beyond 10°'], ['rightElbow', 'Right elbow hyperextension beyond 10°'],
  ['leftKnee', 'Left knee hyperextension beyond 10°'], ['rightKnee', 'Right knee hyperextension beyond 10°'],
  ['trunkFlexion', 'Forward trunk flexion with palms flat on floor'],
];

const STORK_OBSERVATION_SCHEMA = [
  ['loss_of_balance', 'Loss of balance'], ['excessive_sway', 'Excessive sway'],
  ['hip_drop', 'Hip drop'], ['required_guarding', 'Required guarding'],
];
const STORK_QUALITY_SCHEMA = [
  ['postural_control', 'Postural control'], ['stability', 'Overall stability'], ['tremor', 'Absence of tremor'],
];
const STORK_SAFETY_SCHEMA = [
  ['safe_standing', 'Patient can stand independently and safely'], ['no_dizziness', 'No acute dizziness or vertigo'],
  ['no_pain', 'No severe lower-limb pain'], ['no_recent_fall', 'No fall has occurred today'],
  ['weight_bear_ok', 'Full weight-bearing is safe'], ['aid_nearby', 'Walking aid or support available'],
  ['consent', 'Patient has consented to testing'],
];

const T_TEST_QUALITY_SCHEMA = [
  ['acceleration', 'Acceleration quality (A→B)'], ['deceleration', 'Deceleration control'],
  ['lateral_shuffle', 'Lateral shuffle technique'], ['foot_placement', 'Foot placement and cone contact'],
  ['cod_control', 'Change-of-direction control'], ['knee_valgus', 'Knee valgus control'],
  ['trunk_control', 'Dynamic trunk control'], ['arm_coordination', 'Arm coordination'],
  ['turning_efficiency', 'Turning efficiency'],
];
const T_TEST_SAFETY_SCHEMA = [
  ['cleared_running', 'Cleared for running and cutting activities'], ['no_acute_pain', 'No acute lower-limb pain'],
  ['no_instability', 'No knee instability or giving-way episodes'], ['no_swelling', 'No acute joint swelling'],
  ['warmup_done', 'Warm-up completed'], ['safe_footwear', 'Appropriate footwear worn'],
  ['safe_surface', 'Surface safe for sprinting'], ['consent', 'Patient consent obtained'],
];
const T_TEST_INVALID_REASONS = [
  'False start', 'Missed cone', 'Loss of balance', 'Slip / fall', 'Foot crossing during shuffle', 'Early stop',
];

const SLR_SCHEMA_SYMPTOMS = ['None', 'Hamstring tightness', 'Posterior thigh stretch', 'Sciatic pain', 'Burning', 'Tingling', 'Numbness', 'Lumbar pain', 'Glute pain', 'Calf pain'];
const SLR_SCHEMA_DISTRIBUTIONS = ['Back only', 'Buttock', 'Posterior thigh', 'Below knee', 'Foot/toes', 'Diffuse'];
const SLR_SCHEMA_END_FEELS = ['Soft tissue restriction', 'Neural tension', 'Pain limited', 'Guarding'];
const SLR_SCHEMA_MODIFIERS = [
  ['ankle_df', 'Ankle dorsiflexion (Bragard test)'], ['cervical_flex', 'Cervical flexion'],
  ['hip_add_ir', 'Hip adduction / internal rotation'], ['contralateral_slr', 'Contralateral SLR'],
  ['slump', 'Slump confirmation'],
];
const SLR_SCHEMA_RESPONSES = ['Symptoms increased', 'Symptoms unchanged', 'Symptoms decreased'];
const SLR_SCHEMA_SAFETY_FLAGS = [
  ['acute_injury', 'Acute lumbar injury (<72 hours)'], ['recent_surgery', 'Recent spinal or hip surgery'],
  ['severe_pain_flare', 'Severe pain flare (>8/10 at rest)'], ['fracture_suspicion', 'Fracture suspicion or osteoporosis risk'],
  ['cannot_supine', 'Unable to lie supine comfortably'], ['severe_neuro', 'Severe neurological deficit'],
  ['cauda_equina', 'Cauda equina red flags'],
];

const SLUMP_SCHEMA_LOCATIONS = ['Lumbar only', 'Buttock', 'Posterior thigh', 'Knee', 'Posterior calf', 'Foot/toes', 'Diffuse leg', 'Anterior thigh'];
const SLUMP_SCHEMA_SYMPTOMS = ['Hamstring stretch', 'Posterior thigh pain', 'Sciatic-type pain', 'Burning', 'Tingling', 'Numbness', 'Calf ache', 'Foot symptoms'];
const SLUMP_SCHEMA_RESPONSES = [option('Decreased', 'decreased'), option('Unchanged', 'unchanged'), option('Increased', 'increased')];
const SLUMP_SCHEMA_DIFF = [
  ['cervicalExtension', 'Cervical extension release'], ['plantarflexion', 'Ankle plantarflexion'],
  ['reducedSlump', 'Reduced slump position'], ['hipReposition', 'Hip repositioning'],
];
const SLUMP_SCHEMA_STAGES = [
  ['1', 'Thoracic / lumbar flexion'], ['2', 'Add cervical flexion'], ['3', 'Passive knee extension'],
  ['4', 'Add ankle dorsiflexion'], ['5', 'Cervical extension release'],
];
const SLUMP_SCHEMA_SAFETY = [
  ['no_acute_pain', 'No severe acute lumbar pain'], ['no_recent_surgery', 'No recent spinal surgery'],
  ['no_disc_flare', 'No acute disc flare'], ['no_cauda_equina', 'No cauda equina red flags'],
  ['no_severe_deficit', 'No severe progressive neurological deficit'],
  ['can_tolerate_sitting', 'Able to tolerate sustained sitting'], ['consent', 'Patient consent obtained'],
];

const ISOMETRIC_SCHEMA_MUSCLES = [
  ['grip_right', 'Grip Strength - Right'], ['grip_left', 'Grip Strength - Left'],
  ['elbow_flexion_right', 'Elbow Flexion - Right'], ['elbow_flexion_left', 'Elbow Flexion - Left'],
  ['elbow_extension_right', 'Elbow Extension - Right'], ['elbow_extension_left', 'Elbow Extension - Left'],
  ['shoulder_abduction_right', 'Shoulder Abduction - Right'], ['shoulder_abduction_left', 'Shoulder Abduction - Left'],
  ['shoulder_flexion_right', 'Shoulder Flexion - Right'], ['shoulder_flexion_left', 'Shoulder Flexion - Left'],
  ['hip_abduction_right', 'Hip Abduction - Right'], ['hip_abduction_left', 'Hip Abduction - Left'],
  ['hip_flexion_right', 'Hip Flexion - Right'], ['hip_flexion_left', 'Hip Flexion - Left'],
  ['knee_extension_right', 'Knee Extension - Right'], ['knee_extension_left', 'Knee Extension - Left'],
  ['ankle_dorsiflexion_right', 'Ankle Dorsiflexion - Right'], ['ankle_dorsiflexion_left', 'Ankle Dorsiflexion - Left'],
];

const ISOKINETIC_SCHEMA_SPEEDS = ['60°/s', '180°/s', '240°/s', '300°/s', 'Custom'];

const SPECS = {
  jta_icare: defineSpec({
    runnerKey: 'jta_icare', name: 'Job Task Analysis (iCare / WorkCover)', measurementType: 'job_task_analysis', primaryField: 'completed_top_tasks', unit: 'tasks',
    formula: 'Count of non-blank demanding tasks, retaining job profile, frequencies, hazards, observations and comments.',
    fields: [
      field('jobDate', 'Job analysis date', 'date'), field('role', 'Role', 'text'),
      field('roleDescription', 'Role description', 'textarea', false), field('hoursInShift', 'Hours per shift', 'number', false, { min: 0, max: 24 }),
      field('nightshift', 'Night shift', 'select', true, { options: YES_NO_OPTIONS }), field('rosterType', 'Roster type', 'text', false),
      field('daysPerWeek', 'Days per week', 'integer', false, { min: 0, max: 7 }), field('environment', 'Work environment', 'textarea', false),
      field('movementsRequired', 'Movements required', 'textarea', false), field('hazards', 'Hazards', 'textarea', false),
      field('equipmentNeeded', 'Equipment needed', 'textarea', false), field('basicNotes', 'Basic job notes', 'textarea', false),
      repeatedGroupField('topTasks', 'Three most demanding tasks', [
        field('task', 'Task', 'text', false), field('requirement', 'Physical requirement', 'textarea', false),
        field('weight', 'Weight or load', 'text', false), field('duration', 'Duration or frequency', 'text', false),
        field('supportAvailable', 'Suitable-duties support available', 'choice', true, { options: YES_NO_OPTIONS }),
      ], { minItems: 3, maxItems: 3 }),
      groupField('physicalFrequencies', 'Physical-demand frequencies', Object.entries(JOB_PHYSICAL_SCHEMA_LABELS).map(([key, label]) => field(key, label, 'choice', false, { options: FREQUENCY_OPTIONS })), true, 'choice-map'),
      groupField('hazardFrequencies', 'Hazard frequencies', Object.entries(JOB_HAZARD_SCHEMA_LABELS).map(([key, label]) => field(key, label, 'choice', false, { options: FREQUENCY_OPTIONS })), true, 'choice-map'),
      field('clinicalObservations', 'Clinical observations', 'textarea', false), field('otherComments', 'Additional comments', 'textarea', false),
    ],
  }),
  tug_full: defineSpec({
    runnerKey: 'tug_full', name: 'Timed Up and Go', measurementType: 'timed_up_and_go', primaryField: 'average_time', unit: 'seconds',
    formula: 'Arithmetic mean of valid trial times with four production mobility bands.',
    fields: [repeatedGroupField('trials', 'Timed trials with device, steps and observations', [
      field('time', 'Trial time', 'number', true, { min: 0.01, max: 300 }),
      field('assistiveDevice', 'Assistive device', 'choice', true, { options: TUG_DEVICE_OPTIONS }),
      field('steps', 'Step count', 'integer', false, { min: 0, max: 500 }),
      field('observations', 'Trial observations', 'textarea', false),
    ], { minItems: 1, maxItems: 10 })],
  }),
  sit_reach_test: defineSpec({ runnerKey: 'sit_reach_test', name: 'Sit and Reach Test', measurementType: 'flexibility_cm', primaryField: 'best_cm', unit: 'cm', formula: 'Maximum valid trial and optional age/sex ACSM production category.', fields: [numberListField('trials', 'Reach trials', 'Reach distance', { minItems: 1, maxItems: 10, min: -100, max: 200 }), field('boxOffset', 'Box footline position', 'number', true, { min: -100, max: 200 }), field('age', 'Age', 'integer', false, { min: 1, max: 130 }), field('gender', 'Sex used for reference comparison', 'select', false, { options: SEX_OPTIONS })] }),
  chair_sit_reach: defineSpec({ runnerKey: 'chair_sit_reach', name: 'Chair Sit and Reach Test', measurementType: 'chair_sit_and_reach', primaryField: 'best_cm', unit: 'cm', formula: 'Maximum valid trial and optional age/sex Senior Fitness Test category.', fields: [numberListField('trials', 'Reach trials', 'Reach distance', { minItems: 1, maxItems: 10, min: -100, max: 200 }), field('age', 'Age', 'integer', false, { min: 1, max: 130 }), field('gender', 'Sex used for reference comparison', 'select', false, { options: SEX_OPTIONS })] }),
  back_scratch_test: defineSpec({ runnerKey: 'back_scratch_test', name: 'Back Scratch Test', measurementType: 'back_scratch', primaryField: 'best_overall_cm', unit: 'cm', formula: 'Best valid result per side; overall result is the best recorded side with optional age/sex categories.', fields: [numberListField('leftTrials', 'Left-side trials', 'Left overlap or gap', { required: false, minItems: 0, maxItems: 10, min: -100, max: 100 }), numberListField('rightTrials', 'Right-side trials', 'Right overlap or gap', { required: false, minItems: 0, maxItems: 10, min: -100, max: 100 }), field('age', 'Age', 'integer', false, { min: 1, max: 130 }), field('gender', 'Sex used for reference comparison', 'select', false, { options: SEX_OPTIONS })] }),
  functional_reach_test: defineSpec({ runnerKey: 'functional_reach_test', name: 'Functional Reach Test', measurementType: 'Functional Reach', primaryField: 'average_reach', unit: 'cm', formula: 'Mean of at least three reach-distance trials; under 15 high risk, 15-25 moderate, over 25 low.', fields: [numberListField('trials', 'Reach-distance trials', 'Reach distance', { minItems: 3, maxItems: 10, min: 0, max: 200 })] }),
  single_leg_stance_test: defineSpec({ runnerKey: 'single_leg_stance_test', name: 'Single-Leg Stance Test', measurementType: 'Single-Leg Stance', primaryField: 'best_overall_time', unit: 'seconds', formula: 'Best valid trial per limb and overall maximum; an untested limb remains null.', fields: [numberListField('leftTrials', 'Left-leg trials', 'Left hold time', { required: false, minItems: 0, maxItems: 10, min: 0, max: 600 }), numberListField('rightTrials', 'Right-leg trials', 'Right hold time', { required: false, minItems: 0, maxItems: 10, min: 0, max: 600 })] }),
  sppb: defineSpec({
    runnerKey: 'sppb', name: 'Short Physical Performance Battery', measurementType: 'sppb', primaryField: 'total_score', unit: 'points',
    formula: 'Canonical 0-4 balance, gait and chair subscores summed to 0-12 with production interpretation and flags.',
    fields: [
      groupField('balance', 'Standing-balance domain', [
        field('sideBySide', 'Side-by-side stand completed', 'boolean'),
        field('semiTandem', 'Semi-tandem stand completed', 'boolean', 'conditional'),
        field('tandemResult', 'Tandem stand band', 'select', 'conditional', { options: [option('10 seconds or more', '10+'), option('3-9 seconds', '3-9'), option('Under 3 seconds', '<3')] }),
      ]),
      groupField('gait', 'Gait-speed domain', [
        field('walkDistance', 'Walk distance', 'choice', true, { options: [option('4 metres (standard)', 4), option('6 metres', 6), option('10 metres', 10)] }),
        field('trial1', 'Gait trial 1', 'number', false, { min: 0.01, max: 300 }),
        field('trial2', 'Gait trial 2', 'number', false, { min: 0.01, max: 300 }),
        field('aidUsed', 'Walking aid used during test', 'boolean', false),
        field('deviations', 'Gait deviations', 'string[]', false, { minItems: 0, maxItems: 50, items: [field('deviation', 'Gait deviation', 'text', true)] }),
      ]),
      groupField('chair', 'Chair-rise domain', [
        field('singleRiseAble', 'Able to complete one chair rise', 'boolean'),
        field('standTime', 'Five-chair-stand time', 'number', 'conditional', { min: 0.01, max: 300 }),
        field('stoppedEarly', 'Chair stand stopped early', 'boolean', 'conditional'),
      ]),
      groupField('setup', 'Safety, assistance and baseline setup', [
        field('assistiveDevice', 'Assistive device', 'choice', false, { options: [option('None', 'none'), option('Cane', 'cane'), option('Walker', 'walker'), option('Other', 'other')] }),
        field('shoesOff', 'Footwear', 'choice', false, { options: [option('Shoes off', 'off'), option('Shoes on', 'on')] }),
        field('surface', 'Surface', 'choice', false, { options: [option('Hard floor', 'floor'), option('Carpet', 'carpet'), option('Mat', 'mat')] }),
        field('baselinePain', 'Baseline pain', 'number', false, { min: 0, max: 10 }), field('baselineFatigue', 'Baseline fatigue', 'number', false, { min: 0, max: 10 }),
        groupField('safetyChecks', 'Safety checks', SPPB_SAFETY_SCHEMA.map(([key, label]) => field(key, label, 'boolean', false)), true, 'boolean-map'),
        field('safetyDone', 'Safety screen completed', 'boolean', true),
      ]),
      groupField('domainNotes', 'Balance, gait and chair notes', [field('balance', 'Balance notes', 'textarea', false), field('gait', 'Gait notes', 'textarea', false), field('chair', 'Chair-stand notes', 'textarea', false)], false),
    ],
  }),
  tandem_stand: defineSpec({ runnerKey: 'tandem_stand', name: 'Tandem Stand Balance Test', measurementType: 'tandem_stand_balance', primaryField: 'sppb_score', unit: 'points', formula: 'Best hold: >=10 seconds scores 4; >=3 scores 2; >0 scores 1; unable scores 0.', fields: [numberListField('trials', 'Hold-time trials', 'Hold time', { minItems: 1, maxItems: 10, min: 0, max: 10 })] }),
  sebt: defineSpec({ runnerKey: 'sebt', name: 'Star Excursion Balance Test', measurementType: 'star_excursion_balance', primaryField: 'composite_score', unit: 'percent', formula: 'Each reach normalized to limb length; Y-balance composite is mean of anterior, posteromedial and posterolateral normalized reaches.', fields: [field('legTested', 'Leg tested', 'select', true, { options: SIDE_OPTIONS }), field('legLength', 'Leg length', 'number', true, { min: 1, max: 200 }), groupField('reaches', 'Eight directional reach distances', SEBT_SCHEMA_DIRECTIONS.map((direction) => field(direction, `${direction} reach`, 'number', ['Anterior', 'Posteromedial', 'Posterolateral'].includes(direction), { min: 0.01, max: 300 })))] }),
  ten_metre_walk: defineSpec({ runnerKey: 'ten_metre_walk', name: '10-Metre Walk Test', measurementType: 'ten_metre_walk', primaryField: 'average_speed', unit: 'm/s', formula: 'Mean valid 10 m time then 10/time gait speed, production community-ambulation bands and optional normative percentage.', fields: [repeatedGroupField('trials', 'Timed trials', [field('time', '10-metre time', 'number', true, { min: 0.01, max: 600 })], { minItems: 1, maxItems: 4 }), field('pace', 'Walking pace', 'select', true, { options: [option('Comfortable', 'comfortable'), option('Maximal', 'maximal')] }), field('ageGroup', 'Normative age group', 'select', false, { options: ['20–29', '30–39', '40–49', '50–59', '60–69', '70–79', '80–89'].map((value) => option(value)) }), field('gender', 'Sex used for reference comparison', 'select', false, { options: SEX_OPTIONS })] }),
  beighton: defineSpec({ runnerKey: 'beighton', name: 'Beighton Hypermobility Score', measurementType: 'beighton_hypermobility', primaryField: 'total_score', unit: 'points', formula: 'Sum of nine binary joint-hypermobility items; >=5 likely, 4 borderline, <=3 below threshold.', fields: [groupField('scores', 'Nine Beighton item results', BEIGHTON_SCHEMA_ITEMS.map(([key, label]) => field(key, label, 'boolean')), true, 'boolean-map')] }),
  dual_task_gait: defineSpec({ runnerKey: 'dual_task_gait', name: 'Dual-Task Gait Assessment', measurementType: 'dual_task_gait_assessment', primaryField: 'dual_task_cost', unit: 'percent', formula: 'Dual-task cost = (dual time - single time) / single time x 100.', fields: [field('singleTaskTime', 'Single-task time', 'number', true, { min: 0.01 }), field('dualTaskTime', 'Dual-task time', 'number', true, { min: 0.01 }), field('cognitiveTask', 'Cognitive task', 'text')] }),
  plank: defineSpec({ runnerKey: 'plank', name: 'Plank Hold Test', measurementType: 'plank_hold_test', primaryField: 'best_attempt', unit: 'seconds', formula: 'Maximum valid attempt with optional production age/sex normative category.', fields: [numberListField('testAttempts', 'Plank-hold attempts', 'Hold time', { minItems: 1, maxItems: 10, min: 0.01, max: 3600 }), field('clientAge', 'Age', 'integer', false, { min: 1, max: 130 }), field('clientSex', 'Sex used for reference comparison', 'select', false, { options: SEX_OPTIONS })] }),
  standing_stork: defineSpec({
    runnerKey: 'standing_stork', name: 'Standing Stork Test', measurementType: 'standing_stork', primaryField: 'best_overall_time', unit: 'seconds',
    formula: 'Best valid trial per limb, percent bilateral asymmetry and optional age/eyes-condition classification.',
    fields: [
      ...['leftData', 'rightData'].map((key) => groupField(key, key === 'leftData' ? 'Left-leg trials, observations and quality' : 'Right-leg trials, observations and quality', [
        numberListField('trials', 'Hold-time trials', 'Hold time', { minItems: 1, maxItems: 3, min: 0, max: 600 }),
        field('best_time', 'Best hold time', 'number', false, { min: 0, max: 600, readOnly: true }),
        groupField('observations', 'Clinical observations', STORK_OBSERVATION_SCHEMA.map(([observationKey, label]) => field(observationKey, label, 'boolean', false)), false, 'boolean-map'),
        groupField('quality_scores', 'Balance-quality scores', STORK_QUALITY_SCHEMA.map(([qualityKey, label]) => field(qualityKey, label, 'integer', false, { min: 0, max: 4 })), false),
      ])),
      groupField('setup', 'Test setup', [
        field('shoes', 'Footwear', 'choice', true, { options: [option('Barefoot', 'off'), option('Shoes on', 'on')] }),
        field('surface', 'Surface', 'choice', true, { options: [option('Firm', 'firm'), option('Foam pad', 'foam')] }),
        field('eyes', 'Eyes condition', 'choice', true, { options: [option('Open', 'open'), option('Closed', 'closed')] }),
        field('dominant', 'Dominant leg', 'choice', false, { options: SIDE_OPTIONS }),
        field('confidence', 'Balance confidence', 'integer', false, { min: 0, max: 10 }),
        field('pain', 'Baseline pain', 'integer', false, { min: 0, max: 10 }),
        field('dizziness', 'Baseline dizziness', 'integer', false, { min: 0, max: 10 }),
      ]),
      field('clientAge', 'Age', 'integer', false, { min: 1, max: 130 }),
      groupField('safety', 'Safety confirmations', STORK_SAFETY_SCHEMA.map(([key, label]) => field(key, label, 'boolean')), false, 'boolean-map'),
    ],
  }),
  med_ball: defineSpec({ runnerKey: 'med_ball', name: 'Medicine Ball Throw', measurementType: 'medicine_ball_throw', primaryField: 'best_trial', unit: 'metres', formula: 'Maximum valid throw distance with arithmetic mean and retained pre/post vitals.', fields: [numberListField('trials', 'Throw-distance trials', 'Throw distance', { minItems: 1, maxItems: 10, min: 0.01, max: 100 }), groupField('preTestVitals', 'Pre-test vitals', vitalsFields(), false), groupField('postTestVitals', 'Post-test vitals', vitalsFields(), false)] }),
  purdue_peg: defineSpec({ runnerKey: 'purdue_peg', name: 'Purdue Pegboard Test', measurementType: 'dexterity_test', primaryField: 'total_value', unit: 'pieces', formula: 'Sum of all completed right, left, bilateral and assembly subtests; incomplete subtests remain null.', fields: [groupField('scores', 'Pegboard subtest scores', [field('rightHand', 'Right hand (30 seconds)', 'integer', false, { min: 0, max: 500 }), field('leftHand', 'Left hand (30 seconds)', 'integer', false, { min: 0, max: 500 }), field('bothHands', 'Both hands (30 seconds)', 'integer', false, { min: 0, max: 500 }), field('assembly', 'Assembly (60 seconds)', 'integer', false, { min: 0, max: 500 })]), field('clientAge', 'Age', 'integer', false, { min: 1, max: 130 }), field('clientSex', 'Sex', 'select', false, { options: SEX_OPTIONS })] }),
  standing_long_jump: defineSpec({ runnerKey: 'standing_long_jump', name: 'Standing Long Jump', measurementType: 'standing_long_jump', primaryField: 'best_jump', unit: 'cm', formula: 'Maximum valid distance with optional production age/sex classification.', fields: [numberListField('trials', 'Jump-distance trials', 'Jump distance', { minItems: 1, maxItems: 3, min: 0.01, max: 1000 }), field('gender', 'Sex used for reference comparison', 'select', false, { options: [option('Male'), option('Female')] }), field('age', 'Age', 'integer', false, { min: 1, max: 130 })] }),
  illinois: defineSpec({ runnerKey: 'illinois', name: 'Illinois Agility Test', measurementType: 'illinois_agility_test', primaryField: 'best_time', unit: 'seconds', formula: 'Minimum valid timed trial.', fields: [numberListField('trialTimes', 'Timed trials', 'Trial time', { minItems: 1, maxItems: 10, min: 0.01, max: 300 })] }),
  t_test: defineSpec({
    runnerKey: 't_test', name: 'T-Test Agility', measurementType: 'T_test_agility', primaryField: 'best_time', unit: 'seconds',
    formula: 'Best and mean valid trials, range-based consistency, nine-dimension quality mean, sex-specific production bands, RTS status and flags.',
    fields: [
      repeatedGroupField('trialResults', 'Valid and invalid timed trials', [
        field('time', 'Trial time', 'number', true, { min: 0.01, max: 300 }), field('invalid', 'Invalid trial', 'boolean'),
        field('invalidReason', 'Invalid-trial reasons', 'text', 'when-invalid', { options: T_TEST_INVALID_REASONS.map((value) => option(value)) }),
        field('trialNum', 'Trial number', 'integer', false, { min: 1, max: 3 }),
      ], { minItems: 1, maxItems: 3 }),
      groupField('quality', 'Nine movement-quality scores', T_TEST_QUALITY_SCHEMA.map(([key, label]) => field(key, label, 'integer', true, { min: 0, max: 4 }))),
      groupField('setup', 'Surface, footwear, laterality and pre-test status', [
        field('surface', 'Surface type', 'choice', true, { options: ['Indoor court', 'Outdoor grass', 'Synthetic turf', 'Gym floor', 'Concrete', 'Rubber'].map((value) => option(value)) }),
        field('footwear', 'Footwear', 'text', true), field('indoor', 'Indoor testing', 'boolean', true),
        field('dominantLeg', 'Dominant leg', 'choice', false, { options: ['Left', 'Right', 'Unknown'].map((value) => option(value)) }),
        field('injuredSide', 'Injured side', 'choice', true, { options: ['None', 'Left', 'Right'].map((value) => option(value)) }),
        field('testingSport', 'Testing sport or context', 'text', false), field('warmupDone', 'Warm-up completed', 'boolean', false),
        field('sprintConfidence', 'Sprint confidence', 'integer', true, { min: 0, max: 10 }), field('fatigueLevel', 'Pre-test fatigue', 'integer', true, { min: 0, max: 10 }),
      ]),
      groupField('safety', 'Safety confirmations', T_TEST_SAFETY_SCHEMA.map(([key, label]) => field(key, label, 'boolean', false)), false, 'boolean-map'),
      field('gender', 'Sex used for reference comparison', 'select', false, { options: SEX_OPTIONS }),
    ],
  }),
  '505': defineSpec({ runnerKey: '505', name: '505 Agility Test', measurementType: '505_agility_test', primaryField: 'best_time_overall', unit: 'seconds', formula: 'Minimum overall, left-turn and right-turn time; absolute left/right asymmetry in seconds.', fields: [repeatedGroupField('trials', 'Direction-tagged timed trials', [field('direction', 'Turn direction', 'choice', true, { options: [option('Left', 'Left'), option('Right', 'Right')] }), field('time', 'Trial time', 'number', true, { min: 0.01, max: 300 })], { minItems: 1, maxItems: 20 }), field('dominantLeg', 'Dominant leg', 'select', true, { options: [option('Left', 'Left'), option('Right', 'Right')] })] }),
  hexagon: defineSpec({ runnerKey: 'hexagon', name: 'Hexagon Agility Test', measurementType: 'agility_timed', primaryField: 'best_time', unit: 'seconds', formula: 'Minimum three-circuit trial with optional sex-specific production category.', fields: [numberListField('trials', 'Timed trials', 'Three-circuit time', { minItems: 1, maxItems: 10, min: 0.01, max: 300 }), field('gender', 'Sex used for reference comparison', 'select', false, { options: SEX_OPTIONS })] }),
  rsi: defineSpec({ runnerKey: 'rsi', name: 'Reactive Strength Index', measurementType: 'reactive_strength', primaryField: 'best_rsi', unit: 'ratio', formula: 'RSI = jump height in metres / ground contact time in seconds; maximum trial is primary.', fields: [repeatedGroupField('trials', 'Drop-jump trials', [field('jumpHeight', 'Jump height', 'number', true, { min: 0.01, max: 200 }), field('contactTime', 'Ground contact time', 'number', true, { min: 0.01, max: 5000 })], { minItems: 1, maxItems: 10 }), field('dropHeight', 'Drop height', 'number', true, { min: 0.1, max: 200 })] }),
  '10sec_jump': defineSpec({ runnerKey: '10sec_jump', name: '10-Second Repeated Jump Test', measurementType: '10_second_repeated_jump', primaryField: 'best_rsi', unit: 'ratio', formula: 'Per-jump RSI = flight ms/contact ms; best and mean RSI, mean timing and optional height fatigue index.', fields: [repeatedGroupField('jumps', 'Recorded jump cycles', [field('flight_time_ms', 'Flight time', 'number', true, { min: 0.01, max: 5000 }), field('contact_time_ms', 'Ground contact time', 'number', true, { min: 0.01, max: 5000 }), field('jump_height_cm', 'Jump height', 'number', false, { min: 0.01, max: 200 })], { minItems: 1, maxItems: 100 })] }),
  ckcuest_full: defineSpec({ runnerKey: 'ckcuest_full', name: 'Closed Kinetic Chain Upper Extremity Stability Test', measurementType: 'ckcuest', primaryField: 'average', unit: 'touches', formula: 'Arithmetic mean and maximum of one to three recorded touch-count trials.', fields: [numberListField('trials', 'Touch-count trials', 'Touch count', { minItems: 1, maxItems: 3, min: 1, max: 500, integer: true })] }),
  isometric_testing: defineSpec({ runnerKey: 'isometric_testing', name: 'Isometric Strength Testing', measurementType: 'isometric_strength_testing', primaryField: 'first_test_best', unit: 'N', formula: 'Best and mean valid force trials per muscle; paired left/right best-force ratio x 100.', fields: [repeatedGroupField('tests', 'Muscle-group force trials', [field('id', 'Test record identifier', 'integer', false, { min: 1 }), field('muscle', 'Muscle group and side', 'choice', true, { options: ISOMETRIC_SCHEMA_MUSCLES.map(([value, label]) => option(label, value)) }), field('trial1', 'Force trial 1', 'number', true, { min: 0.01, max: 100000 }), field('trial2', 'Force trial 2', 'number', false, { min: 0.01, max: 100000 }), field('trial3', 'Force trial 3', 'number', false, { min: 0.01, max: 100000 }), field('angle', 'Joint angle or test position', 'text', false)], { minItems: 1, maxItems: 100 })] }),
  isokinetic_dyn: defineSpec({ runnerKey: 'isokinetic_dyn', name: 'Isokinetic Dynamometry', measurementType: 'isokinetic_dynamometry', primaryField: 'maximum_peak_torque', unit: 'Nm', formula: 'Maximum peak torque across valid side/speed sets with all torque, work, power and repetition data retained.', fields: [field('joint', 'Joint or movement', 'text'), field('device', 'Dynamometer device', 'text', false), field('preHR', 'Pre-test heart rate', 'integer', false, { min: 20, max: 300 }), field('postHR', 'Post-test heart rate', 'integer', false, { min: 20, max: 300 }), repeatedGroupField('sets', 'Isokinetic sets', [field('side', 'Tested side', 'choice', true, { options: SIDE_OPTIONS }), field('speed', 'Angular velocity', 'choice', true, { options: ISOKINETIC_SCHEMA_SPEEDS.map((value) => option(value)) }), field('customSpeed', 'Custom angular velocity', 'number', 'when-custom', { min: 1, max: 1000 }), field('peakTorque', 'Peak torque', 'number', true, { min: 0.01, max: 100000 }), field('avgTorque', 'Average torque', 'number', false, { min: 0.01, max: 100000 }), field('work', 'Total work', 'number', false, { min: 0.01, max: 1000000 }), field('power', 'Power', 'number', false, { min: 0.01, max: 1000000 }), field('reps', 'Repetitions', 'integer', false, { min: 1, max: 10000 })], { minItems: 1, maxItems: 100 })] }),
  obers_test: defineSpec({ runnerKey: 'obers_test', name: "Ober's Test", measurementType: 'obers_test', primaryField: 'positive_count', unit: 'positive sides', formula: 'Count of bilateral sides recorded positive; pre/post vitals and side results retained.', fields: [groupField('bilateralResults', 'Left and right test results', [field('left', 'Left-side result', 'choice', true, { options: [option('Positive', 'positive'), option('Negative', 'negative')] }), field('right', 'Right-side result', 'choice', true, { options: [option('Positive', 'positive'), option('Negative', 'negative')] })]), groupField('preTestVitals', 'Pre-test vitals', vitalsFields({ required: true })), groupField('postTestVitals', 'Post-test vitals', vitalsFields({ required: true }))] }),
  slr_test: defineSpec({
    runnerKey: 'slr_test', name: 'Straight Leg Raise', measurementType: 'slr_neurodynamic', primaryField: 'maximum_rom', unit: 'degrees',
    formula: 'Maximum bilateral ROM with positive-side, symptom-distribution, asymmetry, modifier, interpretation and flag logic retained.',
    fields: [
      ...['left', 'right'].map((key) => groupField(key, key === 'left' ? 'Left-limb findings' : 'Right-limb findings', [
        field('onsetAngle', 'Symptom-onset angle', 'number', false, { min: 0, max: 180 }), field('maxAngle', 'Maximum straight-leg-raise angle', 'number', true, { min: 0, max: 180 }),
        choiceListField('symptomTypes', 'Symptom types', 'Symptom type', SLR_SCHEMA_SYMPTOMS.map((value) => option(value)), { minItems: 0, maxItems: SLR_SCHEMA_SYMPTOMS.length }),
        field('painSeverity', 'Pain severity', 'number', false, { min: 0, max: 10 }),
        choiceListField('painDistribution', 'Pain distribution', 'Pain distribution', SLR_SCHEMA_DISTRIBUTIONS.map((value) => option(value)), { minItems: 0, maxItems: SLR_SCHEMA_DISTRIBUTIONS.length }),
        field('familiarReproduced', 'Familiar symptoms reproduced', 'choice', false, { options: YES_NO_OPTIONS }),
        field('positive', 'Clinician-recorded SLR result', 'choice', true, { options: YES_NO_OPTIONS }),
        field('endFeel', 'End-feel', 'choice', false, { options: SLR_SCHEMA_END_FEELS.map((value) => option(value)) }),
      ])),
      groupField('modifiers', 'Neurodynamic modifiers', SLR_SCHEMA_MODIFIERS.map(([key, label]) => field(key, label, 'choice', false, { options: SLR_SCHEMA_RESPONSES.map((value) => option(value)) })), false, 'choice-map'),
      field('baselinePain', 'Baseline pain', 'number', false, { min: 0, max: 10 }),
      field('symptomaticSide', 'Symptomatic side', 'select', false, { options: [option('Left'), option('Right'), option('Bilateral'), option('None')] }),
      choiceListField('safetyFlags', 'Safety flags', 'Safety flag', SLR_SCHEMA_SAFETY_FLAGS.map(([value, label]) => option(label, value)), { required: false, minItems: 0, maxItems: SLR_SCHEMA_SAFETY_FLAGS.length }),
      groupField('setup', 'Consent and physical setup', [
        field('surface', 'Testing surface', 'choice', false, { options: ['Plinth', 'Mat table', 'Firm bed', 'Floor'].map((value) => option(value)) }),
        field('shoesOff', 'Footwear', 'choice', false, { options: [option('Shoes off'), option('Shoes on')] }),
        field('warmupDone', 'Warm-up completed', 'choice', false, { options: YES_NO_OPTIONS }),
        field('consentObtained', 'Consent obtained', 'boolean', false), field('safetyDone', 'Safety screen completed', 'boolean', false),
      ], false),
    ],
  }),
  slump_test: defineSpec({
    runnerKey: 'slump_test', name: 'Slump Test', measurementType: 'slump_test', primaryField: 'positive_side_count', unit: 'positive sides',
    formula: 'Bilateral positivity from clinician result or familiar below-knee symptoms relieved by cervical release; production interpretation and flags retained.',
    fields: [
      ...['leftData', 'rightData'].map((key) => groupField(key, key === 'leftData' ? 'Left-limb findings' : 'Right-limb findings', [
        field('kneeAngle', 'Knee-extension angle at symptom onset', 'number', false, { min: 0, max: 180 }), field('painSeverity', 'Pain severity', 'number', false, { min: 0, max: 10 }),
        choiceListField('symptomTypes', 'Symptom types', 'Symptom type', SLUMP_SCHEMA_SYMPTOMS.map((value) => option(value)), { minItems: 0, maxItems: SLUMP_SCHEMA_SYMPTOMS.length }),
        choiceListField('symptomLocations', 'Symptom locations', 'Symptom location', SLUMP_SCHEMA_LOCATIONS.map((value) => option(value)), { minItems: 0, maxItems: SLUMP_SCHEMA_LOCATIONS.length }),
        field('belowKnee', 'Symptoms extend below knee', 'boolean', false), field('familiarSymptoms', 'Familiar symptoms reproduced', 'boolean', false),
        field('cervicalResponse', 'Cervical release response', 'choice', false, { options: SLUMP_SCHEMA_RESPONSES }),
        field('positive', 'Clinician-recorded result', 'boolean', false), field('dorsiflex', 'Dorsiflexion response', 'choice', false, { options: SLUMP_SCHEMA_RESPONSES }),
      ])),
      field('symptomaticSide', 'Symptomatic side', 'select', false, { options: [option('Left', 'left'), option('Right', 'right'), option('Bilateral', 'bilateral'), option('None', 'none')] }),
      field('baselinePain', 'Baseline pain', 'number', false, { min: 0, max: 10 }), field('irritability', 'Symptom irritability', 'integer', false, { min: 0, max: 10 }),
      groupField('diffModifiers', 'Differentiation modifiers', SLUMP_SCHEMA_DIFF.map(([key, label]) => field(key, label, 'choice', false, { options: SLUMP_SCHEMA_RESPONSES })), false, 'choice-map'),
      groupField('stageCompleted', 'Guided stages completed', SLUMP_SCHEMA_STAGES.map(([key, label]) => field(key, label, 'boolean', false)), false, 'boolean-map'),
      groupField('stageSymptoms', 'Guided-stage symptoms', SLUMP_SCHEMA_STAGES.map(([key, label]) => field(key, `${label} symptoms`, 'textarea', false)), false),
      groupField('setup', 'Safety and surface setup', [
        field('surface', 'Testing surface', 'choice', false, { options: [option('Plinth', 'plinth'), option('Chair', 'chair'), option('Other', 'other')] }),
        field('safetyDone', 'Safety screen completed', 'boolean', false),
        groupField('safetyChecks', 'Safety checks', SLUMP_SCHEMA_SAFETY.map(([key, label]) => field(key, label, 'boolean', false)), false, 'boolean-map'),
      ], false),
    ],
  }),
  lachman_test: defineSpec({ runnerKey: 'lachman_test', name: 'Lachman Test', measurementType: 'LachmanTest', primaryField: 'laxity_value', unit: 'mm-equivalent', formula: 'Grade 1/2/3 maps to 0/5/10, plus 1 for a soft end-feel.', fields: [field('kneeFlexion', 'Knee flexion', 'number', true, { min: 0, max: 90 }), field('laxityGrade', 'Laxity grade', 'select', true, { options: [option('Grade 1 (0-5 mm)', '1'), option('Grade 2 (5-10 mm)', '2'), option('Grade 3 (>10 mm)', '3')] }), field('endFeel', 'End-feel', 'select', true, { options: [option('Firm', 'firm'), option('Soft', 'soft')] })] }),
  pivot_shift: defineSpec({ runnerKey: 'pivot_shift', name: 'Pivot Shift Test', measurementType: 'pivot_shift_test', primaryField: 'worst_grade', unit: 'grade', formula: 'Maximum of mandatory left and right ordinal grades 0-3.', fields: [field('leftGrade', 'Left grade', 'integer', true, { min: 0, max: 3 }), field('rightGrade', 'Right grade', 'integer', true, { min: 0, max: 3 })] }),
  mcmurrays_test: defineSpec({ runnerKey: 'mcmurrays_test', name: "McMurray's Test", measurementType: "McMurray's Test", primaryField: 'total_positive', unit: 'positive trials', formula: 'Count positive medial and lateral trials with bilateral test-series and pre/post vitals retained.', fields: [choiceListField('medialResults', 'Medial meniscus trials', 'Medial trial result', [option('Positive', 'positive'), option('Negative', 'negative')], { minItems: 1, maxItems: 100 }), choiceListField('lateralResults', 'Lateral meniscus trials', 'Lateral trial result', [option('Positive', 'positive'), option('Negative', 'negative')], { minItems: 1, maxItems: 100 }), groupField('preTestVitals', 'Pre-test vitals', vitalsFields({ required: true })), groupField('postTestVitals', 'Post-test vitals', vitalsFields({ required: true }))] }),
  thessaly_test: defineSpec({ runnerKey: 'thessaly_test', name: 'Thessaly Test', measurementType: 'thessaly_test', primaryField: 'positive_result', unit: 'binary', formula: 'Positive when either tested side records medial, lateral or bilateral joint-line pain; all side findings retained.', fields: ['leftData', 'rightData'].map((key) => groupField(key, key === 'leftData' ? 'Left-side joint-line, mechanical and pain findings' : 'Right-side joint-line, mechanical and pain findings', [field('joint_line_pain', 'Joint-line pain', 'choice', true, { options: [option('None', 'none'), option('Medial', 'medial'), option('Lateral', 'lateral'), option('Both', 'both')] }), field('mechanical_symptoms', 'Mechanical symptoms', 'choice', false, { options: [option('None', 'none'), option('Catching', 'catching'), option('Locking', 'locking'), option('Giving way', 'giving_way'), option('Multiple', 'multiple')] }), field('pain_intensity', 'Pain intensity', 'choice', false, { options: [option('None', 'none'), option('Mild', 'mild'), option('Moderate', 'moderate'), option('Severe', 'severe')] })], false)) }),
  apleys_compression: defineSpec({ runnerKey: 'apleys_compression', name: "Apley's Compression Test", measurementType: 'ApleysCompressionTest', primaryField: 'positive_trials', unit: 'positive trials', formula: 'Count trials with medial or lateral pain; no-pain trials and timestamps retained.', fields: [repeatedGroupField('trials', 'Pain-location trials', [field('painLocation', 'Pain location', 'choice', true, { options: [option('Medial', 'medial'), option('Lateral', 'lateral'), option('No pain', 'none')] }), field('timestamp', 'Trial timestamp', 'text', true, { format: 'date-time' })], { minItems: 1, maxItems: 100 })] }),
  l_test: defineSpec({ runnerKey: 'l_test', name: 'L Test of Functional Mobility', measurementType: 'LTestofFunctionalMobility', primaryField: 'best_time', unit: 'seconds', formula: 'Convert stored deciseconds to seconds; minimum is primary and arithmetic mean retained.', fields: [numberListField('trialTimesDeciseconds', 'Timed trials in deciseconds', 'Trial time in deciseconds', { minItems: 1, maxItems: 20, min: 0.1, max: 100000 }), groupField('preVitals', 'Pre-test vitals', compactVitalsFields({ required: true }), true), groupField('postVitals', 'Post-test vitals', compactVitalsFields(), false)] }),
  figure8: defineSpec({ runnerKey: 'figure8', name: 'Figure-of-Eight Walk Test', measurementType: 'Figure-of-Eight Walk Test', primaryField: 'average_time', unit: 'seconds', formula: 'Arithmetic mean of valid timed trial objects with production mobility bands and vitals retained.', fields: [repeatedGroupField('trialData', 'Timed trials', [field('time', 'Trial time', 'number', true, { min: 0.01, max: 1000 })], { minItems: 1, maxItems: 20 }), groupField('preVitals', 'Pre-test vitals', compactVitalsFields(), false), groupField('postVitals', 'Post-test vitals', compactVitalsFields(), false)] }),
  visual_rom: defineSpec({ runnerKey: 'visual_rom', name: 'Visual ROM Assessment', measurementType: 'visual_rom', primaryField: 'mean_rom_percent', unit: 'percent', formula: 'Arithmetic mean of every completed movement across selected joints; all selected movements must have ROM and pain recorded.', fields: [field('selectedJointKeys', 'Selected joints', 'multi-select', true, { minItems: 1, maxItems: VISUAL_ROM_JOINTS.length, options: VISUAL_ROM_JOINTS.map(({ key, label }) => option(label, key)) }), groupField('results', 'Joint and movement findings', VISUAL_ROM_JOINTS.map((joint) => groupField(joint.key, joint.label, joint.movements.map((movement, movementIndex) => field(atomicSchemaKey(movement), `${movement} (${joint.normals[movementIndex]} normal)`, 'object', 'when-selected', { sourceKey: movement, fields: [field('rom', 'Observed ROM percentage', 'choice', true, { options: [0, 10, 25, 50, 75, 100].map((value) => option(`${value}%`, value)) }), field('pain', 'Pain reported', 'boolean'), field('note', 'Movement note', 'textarea', false)] })), 'when-selected')))] }),
};

export const RUNNER_SPEC_BY_KEY = deepFreeze(SPECS);
export const RUNNER_SPECS = Object.freeze(RUNNER_KEYS.map((key) => RUNNER_SPEC_BY_KEY[key]));

const JOB_PHYSICAL_LABELS = deepFreeze({
  sitting: 'Sitting – seated position to perform tasks', standing: 'Standing – posture throughout activity',
  walking: 'Walking/Running – regularity and surface', sustained_posture: 'Sustained Posture – working in same posture for periods of time',
  bending: 'Bending – forward bending to perform tasks', trunk_twisting: 'Trunk Twisting – while sitting/standing to complete tasks',
  kneeling: 'Kneeling – posture to complete tasks', squatting: 'Squatting/Crouching – posture to complete tasks',
  climbing: 'Climbing (stairs/ladders/structures)', lifting: 'Lifting – overhead/forward extension',
  carrying: 'Carrying – overhead/forward extension', reaching: 'Reaching – forward reaching/overhead reaching',
  pushing: 'Pushing – move objects away from the body', pulling: 'Pulling – move objects toward the body',
  grasping: 'Grasping – fine motor skills, regular use of hands – tools, machinery',
  work_at_heights: 'Work at Heights – using ladders, footstools, scaffolding',
  driving: 'Driving – controlling the operation of a vehicle/Foot and Hand Controls',
});

const JOB_HAZARD_LABELS = deepFreeze({
  dust: 'Dust – exposure', gases: 'Gases – exposure', fumes: 'Fumes – exposure',
  liquids: 'Liquids – working with/exposure', lighting: 'Lighting – darkness/eye strain',
  extreme_temps: 'Extreme Temperatures – temperatures are less than 15°C or more than 35°C',
  confined_spaces: 'Confined Spaces – areas where work is conducted that are not designed to be entered by a person',
  slippery_surfaces: 'Slippery or Uneven Surfaces',
  biological_hazards: 'Biological Hazards – contact with body fluids, bacteria, infectious diseases',
  ppe: 'Wearing of Personal Protective Equipment – Administrative control for any of the above demands',
});

const SIT_REACH_NORMS = deepFreeze({
  male: [[15, 19, 39, 34, 29, 24], [20, 29, 40, 34, 30, 25], [30, 39, 38, 33, 28, 23], [40, 49, 35, 29, 24, 18], [50, 59, 35, 28, 24, 16], [60, 120, 33, 25, 20, 15]],
  female: [[15, 19, 43, 38, 34, 29], [20, 29, 41, 37, 33, 28], [30, 39, 41, 36, 32, 27], [40, 49, 38, 34, 30, 25], [50, 59, 39, 33, 30, 25], [60, 120, 35, 31, 27, 23]],
});

const CHAIR_REACH_NORMS = deepFreeze({
  male: [[60, 64, 12.7, 7.6, 2.5, -2.5], [65, 69, 12.7, 7.6, 2.5, -2.5], [70, 74, 11.4, 6.3, 1.3, -3.8], [75, 79, 10.2, 5.1, 0, -5.1], [80, 120, 8.9, 3.8, -1.3, -6.3]],
  female: [[60, 64, 16.5, 11.4, 6.3, 1.3], [65, 69, 16.5, 11.4, 6.3, 1.3], [70, 74, 15.2, 10.2, 5.1, 0], [75, 79, 15.2, 10.2, 5.1, 0], [80, 120, 14, 8.9, 3.8, -1.3]],
});

const BACK_SCRATCH_NORMS = deepFreeze({
  male: [[60, 64, 1.3, -3.8, -8.9, -14], [65, 69, 0, -5.1, -10.2, -15.2], [70, 74, -1.3, -6.3, -11.4, -16.5], [75, 79, -2.5, -7.6, -12.7, -17.8], [80, 120, -3.8, -8.9, -14, -19]],
  female: [[60, 64, 7.6, 2.5, -2.5, -7.6], [65, 69, 7.6, 2.5, -2.5, -7.6], [70, 74, 6.3, 1.3, -3.8, -8.9], [75, 79, 5.1, 0, -5.1, -10.2], [80, 120, 3.8, -1.3, -6.3, -11.4]],
});

function referenceCategory(score, age, gender, table, lowest = 'Poor') {
  if (age === null || gender === null) return null;
  const row = table[gender]?.find(([minAge, maxAge]) => age >= minAge && age <= maxAge);
  if (!row) return null;
  if (score >= row[2]) return 'Excellent';
  if (score >= row[3]) return 'Good';
  if (score >= row[4]) return 'Average';
  if (score >= row[5]) return 'Below Average';
  return lowest;
}

function normalizedFrequencies(value, fieldName, labels) {
  const source = record(value ?? {}, fieldName);
  const normalized = {};
  for (const [key, frequency] of Object.entries(source)) {
    invariant(Object.hasOwn(labels, key), `${fieldName} contains unsupported key ${key}`);
    if (!hasValue(frequency)) continue;
    normalized[key] = choice(frequency, `${fieldName}.${key}`, ['I', 'F', 'C']);
  }
  return normalized;
}

function scoreJobTaskAnalysis(input, context) {
  const jobDate = String(input.jobDate || '').trim();
  invariant(LOCAL_DATE_PATTERN.test(jobDate), 'jobDate must use YYYY-MM-DD format');
  const role = text(input.role, 'role', { required: true, max: 300 });
  const topTasks = array(input.topTasks, 'topTasks', { minItems: 3, maxItems: 3 }).map((task, index) => {
    const source = record(task, `topTasks[${index}]`);
    return {
      task: text(source.task, `topTasks[${index}].task`, { max: 500 }),
      requirement: text(source.requirement, `topTasks[${index}].requirement`, { max: 1000 }),
      weight: text(source.weight, `topTasks[${index}].weight`, { max: 100 }),
      duration: text(source.duration, `topTasks[${index}].duration`, { max: 100 }),
      supportAvailable: choice(source.supportAvailable, `topTasks[${index}].supportAvailable`, ['Yes', 'No']),
    };
  }).filter(({ task }) => task);
  const physicalFrequencies = normalizedFrequencies(input.physicalFrequencies, 'physicalFrequencies', JOB_PHYSICAL_LABELS);
  const hazardFrequencies = normalizedFrequencies(input.hazardFrequencies, 'hazardFrequencies', JOB_HAZARD_LABELS);
  const physicalSummary = Object.entries(physicalFrequencies).map(([key, frequency]) => `${JOB_PHYSICAL_LABELS[key]}: ${frequency}`).join('\n');
  const hazardSummary = Object.entries(hazardFrequencies).map(([key, frequency]) => `${JOB_HAZARD_LABELS[key]}: ${frequency}`).join('\n');
  const jobInfo = {
    role,
    date: jobDate,
    roleDescription: text(input.roleDescription, 'roleDescription'),
    hoursInShift: optionalNumber(input.hoursInShift, 'hoursInShift', { min: 0, max: 24 }),
    nightshift: choice(input.nightshift, 'nightshift', ['Yes', 'No']),
    rosterType: text(input.rosterType, 'rosterType', { max: 200 }),
    daysPerWeek: optionalInteger(input.daysPerWeek, 'daysPerWeek', { min: 0, max: 7 }),
    environment: text(input.environment, 'environment'),
    movementsRequired: text(input.movementsRequired, 'movementsRequired'),
    hazards: text(input.hazards, 'hazards'),
    equipmentNeeded: text(input.equipmentNeeded, 'equipmentNeeded'),
    basicNotes: text(input.basicNotes, 'basicNotes'),
  };
  const clinicalObservations = text(input.clinicalObservations, 'clinicalObservations');
  const otherComments = text(input.otherComments, 'otherComments');
  const soap = `• Job Task Analysis (JTA)\n  Role: ${role}\n  Date: ${jobDate}\n  Hours/Week: ${jobInfo.hoursInShift ?? 'Not specified'} hours × ${jobInfo.daysPerWeek ?? 'Not specified'} days\n\n  Role Description:\n    ${jobInfo.roleDescription || 'Not specified'}\n\n  Environment & Movements:\n    Environment: ${jobInfo.environment || 'Not specified'}\n    Movements: ${jobInfo.movementsRequired || 'Not specified'}\n    Hazards: ${jobInfo.hazards || 'Not specified'}\n    Equipment: ${jobInfo.equipmentNeeded || 'Not specified'}\n\n  Top 3 Physically Demanding Tasks:\n${topTasks.length ? topTasks.map((task, index) => `    ${index + 1}. ${task.task} (${task.duration || 'duration not specified'})\n       Requirement: ${task.requirement}\n       Suitable duties support: ${task.supportAvailable}`).join('\n') : 'None recorded'}\n\n  Physical Demands (Frequency):\n${physicalSummary || 'None recorded'}\n\n  Environmental Hazards (Frequency):\n${hazardSummary || 'None recorded'}\n\n  Clinical Observations:\n    ${clinicalObservations || 'None recorded'}\n\n  Additional Comments:\n    ${otherComments || 'None recorded'}`;
  return completedPayload('jta_icare', input, { ...context, assessmentDate: jobDate }, topTasks.length, soap, {
    completed_top_tasks: topTasks.length, job_info: jobInfo, topTasks, physicalFrequencies,
    hazardFrequencies, clinicalObservations, otherComments,
  });
}

function scoreTug(input, context) {
  const devices = ['none', 'single_cane', 'quad_cane', 'walker', 'rollator', 'crutches'];
  const trials = array(input.trials, 'trials', { minItems: 1, maxItems: 10 }).map((trial, index) => {
    const source = record(trial, `trials[${index}]`);
    return {
      time: finiteNumber(source.time, `trials[${index}].time`, { min: 0.01, max: 300 }),
      assistiveDevice: choice(source.assistiveDevice, `trials[${index}].assistiveDevice`, devices),
      steps: optionalInteger(source.steps, `trials[${index}].steps`, { min: 0, max: 500 }),
      observations: text(source.observations, `trials[${index}].observations`),
    };
  });
  const averageTime = round(mean(trials.map(({ time }) => time)), 2);
  const interpretation = averageTime <= 10 ? 'Normal mobility'
    : averageTime <= 20 ? 'Good mobility, mostly independent'
      : averageTime <= 30 ? 'Variable mobility, may require assistance'
        : 'Impaired mobility, high fall risk';
  const trialSummary = trials.map((trial, index) => `    Trial ${index + 1}: ${trial.time}s${trial.assistiveDevice !== 'none' ? ` | Device: ${trial.assistiveDevice.replace('_', ' ')}` : ''}${trial.steps !== null ? ` | Steps: ${trial.steps}` : ''}${trial.observations ? `\n      Observations: ${trial.observations}` : ''}`).join('\n');
  const soap = `• Timed Up and Go (TUG): ${averageTime}s (average of ${trials.length} trial${trials.length > 1 ? 's' : ''})\n  Interpretation: ${interpretation}\n  Assistive Device: ${trials[0].assistiveDevice.replace('_', ' ')}\n\n  Trial Details:\n${trialSummary}`;
  return completedPayload('tug_full', input, context, averageTime, soap, {
    trials, averageTime, interpretation, primaryAssistiveDevice: trials[0].assistiveDevice,
  });
}

function scoreSitReach(input, context) {
  const trials = numericArray(input.trials, 'trials', { minItems: 1, maxItems: 10, min: -100, max: 200 });
  const best = Math.max(...trials);
  const boxOffset = finiteNumber(input.boxOffset, 'boxOffset', { min: -100, max: 200 });
  const age = optionalInteger(input.age, 'age', { min: 1, max: 130 });
  const gender = optionalChoice(input.gender, 'gender', ['male', 'female']);
  const classification = referenceCategory(best, age, gender, SIT_REACH_NORMS);
  const soap = `• Sit and Reach Test (Standard Box Method)\n  Best Score: ${best} cm${classification ? ` — ${classification}` : ''}\n  Trials: ${trials.map((trial) => `${trial} cm`).join(', ')}\n  Box footline position: ${boxOffset} cm\n  Measures lower back and hamstring flexibility${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('sit_reach_test', input, context, best, soap, {
    best_cm: best, trials, box_offset_cm: boxOffset, classification, age, gender,
  });
}

function scoreChairReach(input, context) {
  const trials = numericArray(input.trials, 'trials', { minItems: 1, maxItems: 10, min: -100, max: 200 });
  const best = Math.max(...trials);
  const age = optionalInteger(input.age, 'age', { min: 1, max: 130 });
  const gender = optionalChoice(input.gender, 'gender', ['male', 'female']);
  const classification = referenceCategory(best, age, gender, CHAIR_REACH_NORMS, 'Low');
  const soap = `• Chair Sit and Reach Test (Senior Fitness Test)\n  Best Result: ${best} cm${classification ? ` — ${classification}` : ''}\n  Trials: ${trials.map((trial) => `${trial} cm`).join(', ')}${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}\n  Positive = fingertips beyond foot; Negative = fingertips short of foot`;
  return completedPayload('chair_sit_reach', input, context, best, soap, {
    trials, best_cm: best, classification, age, gender,
  });
}

function scoreBackScratch(input, context) {
  const leftTrials = numericArray(input.leftTrials ?? [], 'leftTrials', { minItems: 0, maxItems: 10, min: -100, max: 100 });
  const rightTrials = numericArray(input.rightTrials ?? [], 'rightTrials', { minItems: 0, maxItems: 10, min: -100, max: 100 });
  invariant(leftTrials.length + rightTrials.length > 0, 'at least one left or right trial is required');
  const bestLeft = leftTrials.length ? Math.max(...leftTrials) : null;
  const bestRight = rightTrials.length ? Math.max(...rightTrials) : null;
  const best = Math.max(...[bestLeft, bestRight].filter((value) => value !== null));
  const age = optionalInteger(input.age, 'age', { min: 1, max: 130 });
  const gender = optionalChoice(input.gender, 'gender', ['male', 'female']);
  const leftClassification = bestLeft === null ? null : referenceCategory(bestLeft, age, gender, BACK_SCRATCH_NORMS, 'Low');
  const rightClassification = bestRight === null ? null : referenceCategory(bestRight, age, gender, BACK_SCRATCH_NORMS, 'Low');
  const soap = `• Back Scratch Test (Senior Fitness Test)\n  Best Left: ${bestLeft === null ? 'N/A' : `${bestLeft} cm`}${leftClassification ? ` — ${leftClassification}` : ''}\n  Best Right: ${bestRight === null ? 'N/A' : `${bestRight} cm`}${rightClassification ? ` — ${rightClassification}` : ''}\n  Positive = overlap; Negative = gap${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('back_scratch_test', input, context, best, soap, {
    best_left_cm: bestLeft, best_right_cm: bestRight, best_overall_cm: best,
    left_trials: leftTrials, right_trials: rightTrials,
    left_classification: leftClassification, right_classification: rightClassification, age, gender,
  });
}

function scoreFunctionalReach(input, context) {
  const trials = numericArray(input.trials, 'trials', { minItems: 3, maxItems: 10, min: 0, max: 200 });
  const averageReach = mean(trials);
  const fallRisk = averageReach < 15 ? 'High' : averageReach <= 25 ? 'Moderate' : 'Low';
  const soap = `• Functional Reach Test\n  Average Reach: ${averageReach.toFixed(1)} cm — ${fallRisk} Fall Risk\n  Trials: ${trials.map((trial) => `${trial.toFixed(1)} cm`).join(', ')}`;
  return completedPayload('functional_reach_test', input, context, averageReach, soap, {
    trials, average_reach_cm: averageReach, fall_risk: fallRisk,
  });
}

function scoreSingleLegStance(input, context) {
  const leftTrials = numericArray(input.leftTrials ?? [], 'leftTrials', { minItems: 0, maxItems: 10, min: 0, max: 600 });
  const rightTrials = numericArray(input.rightTrials ?? [], 'rightTrials', { minItems: 0, maxItems: 10, min: 0, max: 600 });
  invariant(leftTrials.length + rightTrials.length > 0, 'at least one left or right trial is required');
  const bestLeft = leftTrials.length ? Math.max(...leftTrials) : null;
  const bestRight = rightTrials.length ? Math.max(...rightTrials) : null;
  const resultValue = Math.max(...[bestLeft, bestRight].filter((value) => value !== null));
  const lines = ['• Single-Leg Stance Test:'];
  if (bestLeft !== null) lines.push(`  Left Leg Trials: ${leftTrials.join(', ')}s (Best: ${bestLeft}s)`);
  if (bestRight !== null) lines.push(`  Right Leg Trials: ${rightTrials.join(', ')}s (Best: ${bestRight}s)`);
  lines.push(`  Overall Best Time: ${resultValue}s`);
  if (notesFrom(input, context)) lines.push(`  Notes: ${notesFrom(input, context)}`);
  return completedPayload('single_leg_stance_test', input, context, resultValue, lines.join('\n'), {
    trials: { left: leftTrials, right: rightTrials }, best_left: bestLeft, best_right: bestRight,
  });
}

function sppbBalanceScore(balance) {
  const sideBySide = boolean(balance.sideBySide, 'balance.sideBySide');
  if (!sideBySide) return 0;
  const semiTandem = boolean(balance.semiTandem, 'balance.semiTandem');
  if (!semiTandem) return 1;
  const tandem = choice(balance.tandemResult, 'balance.tandemResult', ['10+', '3-9', '<3']);
  return 2 + (tandem === '10+' ? 2 : tandem === '3-9' ? 1 : 0);
}

function sppbGaitScore(seconds, distance) {
  const t4 = distance === 4 ? seconds : (seconds / distance) * 4;
  if (t4 > 8.7) return 1;
  if (t4 >= 6.2) return 2;
  if (t4 >= 4.8) return 3;
  return 4;
}

function sppbChairScore(seconds) {
  if (seconds > 60) return 0;
  if (seconds > 16.7) return 1;
  if (seconds >= 13.7) return 2;
  if (seconds >= 11.2) return 3;
  return 4;
}

function sppbInterpretation(total) {
  if (total <= 3) return { level: 'Severe Limitation', narrative: `SPPB score of ${total}/12 indicates severe lower extremity functional limitation. Findings suggest very high falls risk, significant mobility impairment, and probable frailty. Urgent functional rehabilitation intervention is indicated.` };
  if (total <= 6) return { level: 'Moderate Impairment', narrative: `SPPB score of ${total}/12 suggests moderate lower extremity functional impairment. Reduced gait performance and/or impaired balance and chair stand ability indicate elevated falls risk and reduced mobility reserve. Structured exercise intervention is recommended.` };
  if (total <= 9) return { level: 'Mild Functional Limitation', narrative: `SPPB score of ${total}/12 indicates mild-to-moderate lower extremity functional limitation. Performance below expected norms for age suggests early functional decline with increased risk of disability progression. Targeted strength and balance training is recommended.` };
  return { level: 'High Functional Performance', narrative: `SPPB score of ${total}/12 reflects high lower extremity functional performance. Balance, gait speed, and chair stand performance are within expected norms. Continue current physical activity and reassess as part of routine monitoring.` };
}

function scoreSppb(input, context) {
  const balance = record(input.balance, 'balance');
  const gait = record(input.gait, 'gait');
  const chair = record(input.chair, 'chair');
  const balanceScore = sppbBalanceScore(balance);
  const walkDistance = choice(gait.walkDistance, 'gait.walkDistance', [4, 6, 10]);
  const gaitTrial1 = optionalNumber(gait.trial1, 'gait.trial1', { min: 0.01, max: 300 });
  const gaitTrial2 = optionalNumber(gait.trial2, 'gait.trial2', { min: 0.01, max: 300 });
  const gaitTimes = [gaitTrial1, gaitTrial2].filter((value) => value !== null);
  invariant(gaitTimes.length > 0, 'at least one gait trial is required');
  const fastestGait = Math.min(...gaitTimes);
  const gaitScore = sppbGaitScore(fastestGait, walkDistance);
  const gaitSpeed = round(walkDistance / fastestGait, 2);
  const singleRiseAble = boolean(chair.singleRiseAble, 'chair.singleRiseAble');
  const chairStoppedEarly = singleRiseAble ? boolean(chair.stoppedEarly, 'chair.stoppedEarly') : null;
  const chairStandTime = singleRiseAble ? finiteNumber(chair.standTime, 'chair.standTime', { min: 0.01, max: 300 }) : null;
  const chairScore = !singleRiseAble || chairStoppedEarly ? 0 : sppbChairScore(chairStandTime);
  const totalScore = balanceScore + gaitScore + chairScore;
  const interpretation = sppbInterpretation(totalScore);
  const flags = [];
  if (totalScore <= 6) flags.push('High falls risk', 'Frailty likely — refer for comprehensive frailty assessment');
  if (gaitScore <= 2) flags.push('Reduced gait speed — mobility intervention indicated');
  if (balanceScore <= 2) flags.push('Poor balance — targeted balance training recommended');
  if (!singleRiseAble) flags.push('Unable to perform single chair rise — strength deficit significant');
  if (chairScore <= 2) flags.push('Impaired chair stand performance — reduced lower limb power');
  if (totalScore <= 9) flags.push('Candidate for structured strength and balance program');
  if (totalScore <= 6) flags.push('Recommend further falls risk assessment (TUG, BBS)');
  if (gaitScore <= 2) flags.push('Sarcopenia screening trigger — consider SARC-F and grip strength');
  const setupSource = record(input.setup, 'setup');
  const setupSafetySource = record(setupSource.safetyChecks ?? {}, 'setup.safetyChecks');
  const permittedSafetyKeys = SPPB_SAFETY_SCHEMA.map(([key]) => key);
  invariant(Object.keys(setupSafetySource).every((key) => permittedSafetyKeys.includes(key)), 'setup.safetyChecks contains an unsupported key');
  const setupSafetyChecks = Object.fromEntries(Object.entries(setupSafetySource).map(([key, value]) => [key, boolean(value, `setup.safetyChecks.${key}`)]));
  const setup = {
    assistiveDevice: optionalChoice(setupSource.assistiveDevice, 'setup.assistiveDevice', ['none', 'cane', 'walker', 'other']),
    shoesOff: optionalChoice(setupSource.shoesOff, 'setup.shoesOff', ['off', 'on']),
    surface: optionalChoice(setupSource.surface, 'setup.surface', ['floor', 'carpet', 'mat']),
    baselinePain: optionalNumber(setupSource.baselinePain, 'setup.baselinePain', { min: 0, max: 10 }),
    baselineFatigue: optionalNumber(setupSource.baselineFatigue, 'setup.baselineFatigue', { min: 0, max: 10 }),
    safetyChecks: setupSafetyChecks,
    safetyDone: boolean(setupSource.safetyDone, 'setup.safetyDone'),
  };
  const gaitAidUsed = optionalBoolean(gait.aidUsed, 'gait.aidUsed');
  const soap = [
    '• Short Physical Performance Battery (SPPB)', '', '  Domain Scores:',
    `    Balance: ${balanceScore}/4`,
    `    Gait Speed: ${gaitScore}/4 (${gaitSpeed} m/s, fastest ${fastestGait}s over ${walkDistance}m)`,
    `    Chair Stand: ${!singleRiseAble ? '0 (unable single rise)' : `${chairScore}/4 (${chairStandTime}s)`}`,
    `    Total SPPB Score: ${totalScore}/12`, '', `  Interpretation: ${interpretation.level}`,
    `  ${interpretation.narrative}`, '', ...(flags.length ? ['  Clinical Flags:', ...flags.map((flag) => `    ⚑ ${flag}`)] : []),
    notesFrom(input, context) ? `  Clinician Notes: ${notesFrom(input, context)}` : null,
  ].filter((value) => value !== null).join('\n');
  return completedPayload('sppb', input, context, totalScore, soap, {
    balance_score: balanceScore, gait_score: gaitScore, chair_score: chairScore, total_score: totalScore,
    gait_speed_ms: gaitSpeed, gait_fastest_time: fastestGait, gait_distance: walkDistance,
    gait_trial_1: gaitTrial1, gait_trial_2: gaitTrial2, balance_side_by_side: balance.sideBySide,
    balance_semi_tandem: balance.semiTandem, balance_tandem: balance.tandemResult,
    chair_single_rise: singleRiseAble, chair_stand_time: chairStandTime,
    chair_stopped_early: chairStoppedEarly, baseline_pain: setup.baselinePain,
    assistive_device: setup.assistiveDevice,
    gait_aid_used: gaitAidUsed,
    gait_deviations: array(gait.deviations ?? [], 'gait.deviations', { maxItems: 50 }).map((entry, index) => text(entry, `gait.deviations[${index}]`, { required: true, max: 200 })),
    clinical_flags: flags, interpretation: interpretation.level, interpretation_narrative: interpretation.narrative,
    domain_notes: clone(input.domainNotes ?? {}), setup,
  });
}

function scoreTandemStand(input, context) {
  const trials = numericArray(input.trials, 'trials', { minItems: 1, maxItems: 10, min: 0, max: 10 });
  const bestTime = Math.max(...trials);
  const score = bestTime >= 10 ? 4 : bestTime >= 3 ? 2 : bestTime > 0 ? 1 : 0;
  const interpretation = score === 4 ? 'Low fall risk' : score === 2 ? 'Moderate — monitor closely' : score === 1 ? 'Increased fall risk' : 'High fall risk — unable to hold position';
  const soap = `• Tandem Stand Balance Test\n  Best Hold Time: ${bestTime.toFixed(2)}s | SPPB Score: ${score}/4\n  Interpretation: ${interpretation}\n  All Trials: ${trials.map((trial, index) => `Trial ${index + 1}: ${trial === 0 ? 'Unable' : `${trial.toFixed(2)}s`}`).join(', ')}${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('tandem_stand', input, context, score, soap, {
    best_time: bestTime, trials, sppb_score: score, interpretation,
  });
}

const SEBT_DIRECTIONS = Object.freeze(['Anterior', 'Anterolateral', 'Lateral', 'Posterolateral', 'Posterior', 'Posteromedial', 'Medial', 'Anteromedial']);

function scoreSebt(input, context) {
  const legTested = choice(input.legTested, 'legTested', ['left', 'right']);
  const legLength = finiteNumber(input.legLength, 'legLength', { min: 1, max: 200 });
  const sourceReaches = record(input.reaches, 'reaches');
  const reaches = {};
  for (const [direction, value] of Object.entries(sourceReaches)) {
    invariant(SEBT_DIRECTIONS.includes(direction), `reaches contains unsupported direction ${direction}`);
    if (!hasValue(value)) continue;
    reaches[direction] = finiteNumber(value, `reaches.${direction}`, { min: 0.01, max: 300 });
  }
  for (const direction of ['Anterior', 'Posteromedial', 'Posterolateral']) {
    invariant(Object.hasOwn(reaches, direction), `${direction} reach is required for the composite score`);
  }
  const normalizedReaches = Object.fromEntries(Object.entries(reaches).map(([direction, value]) => [direction, round((value / legLength) * 100, 1)]));
  const compositeScore = round(mean(['Anterior', 'Posteromedial', 'Posterolateral'].map((direction) => normalizedReaches[direction])), 1);
  const reachLines = SEBT_DIRECTIONS.filter((direction) => Object.hasOwn(reaches, direction)).map((direction) => `  ${direction}: ${reaches[direction]}cm (${normalizedReaches[direction]}%)`).join('\n');
  const soap = `• Star Excursion Balance Test (SEBT)\n  Leg: ${legTested} | Leg Length: ${legLength}cm\n  Composite Score: ${compositeScore}%\n${reachLines}${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('sebt', input, context, compositeScore, soap, {
    leg_tested: legTested, leg_length_cm: legLength, reach_distances: reaches,
    normalized_reaches: normalizedReaches, composite_score: compositeScore, y_balance_composite: compositeScore,
  });
}

const TEN_METRE_NORMS = deepFreeze({
  '20–29': { male: 1.46, female: 1.34 }, '30–39': { male: 1.43, female: 1.34 },
  '40–49': { male: 1.43, female: 1.39 }, '50–59': { male: 1.39, female: 1.31 },
  '60–69': { male: 1.36, female: 1.24 }, '70–79': { male: 1.26, female: 1.13 },
  '80–89': { male: 0.97, female: 0.94 },
});

function gaitSpeedCategory(speed) {
  if (speed >= 1.22) return 'Unlimited Community Ambulator';
  if (speed >= 1.0) return 'Community Ambulator';
  if (speed >= 0.8) return 'Limited Community Ambulator';
  if (speed >= 0.6) return 'Household Ambulator';
  return 'Physiological Ambulator';
}

function scoreTenMetreWalk(input, context) {
  const trials = array(input.trials, 'trials', { minItems: 1, maxItems: 4 }).map((trial, index) => {
    const source = record(trial, `trials[${index}]`);
    const time = finiteNumber(source.time, `trials[${index}].time`, { min: 0.01, max: 600 });
    return { time: round(time, 2), speed: round(10 / time, 3) };
  });
  const pace = choice(input.pace, 'pace', ['comfortable', 'maximal']);
  const ageGroup = optionalChoice(input.ageGroup, 'ageGroup', Object.keys(TEN_METRE_NORMS));
  const gender = optionalChoice(input.gender, 'gender', ['male', 'female']);
  const averageTime = round(mean(trials.map(({ time }) => time)), 2);
  const averageSpeed = round(10 / averageTime, 3);
  const classification = gaitSpeedCategory(averageSpeed);
  const normativeSpeed = ageGroup !== null && gender !== null ? TEN_METRE_NORMS[ageGroup][gender] : null;
  const pctOfNormative = normativeSpeed === null ? null : Math.round((averageSpeed / normativeSpeed) * 100);
  const trialLines = trials.map((trial, index) => `    Trial ${index + 1}: ${trial.time}s — ${trial.speed} m/s`).join('\n');
  const soap = [
    '• 10-Metre Walk Test (10MWT)', `  Pace: ${pace === 'maximal' ? 'Maximal' : 'Comfortable'}`,
    `  Average Time: ${averageTime}s | Average Gait Speed: ${averageSpeed} m/s`,
    `  Classification: ${classification}`,
    pctOfNormative !== null ? `  vs. Normative (${ageGroup} ${gender}): ${pctOfNormative}% of expected gait speed (${normativeSpeed} m/s)` : null,
    trialLines, '  MCID: 0.10 m/s | MDC: 0.13 m/s',
    notesFrom(input, context) ? `  Notes: ${notesFrom(input, context)}` : null,
  ].filter(Boolean).join('\n');
  return completedPayload('ten_metre_walk', input, context, averageSpeed, soap, {
    trials, avg_time: averageTime, avg_speed: averageSpeed, pace, classification,
    pct_of_normative: pctOfNormative, normative_speed: normativeSpeed, age_group: ageGroup, gender,
  });
}

const BEIGHTON_KEYS = Object.freeze([
  'leftLittleFinger', 'rightLittleFinger', 'leftThumb', 'rightThumb',
  'leftElbow', 'rightElbow', 'leftKnee', 'rightKnee', 'trunkFlexion',
]);

function scoreBeighton(input, context) {
  const source = record(input.scores, 'scores');
  const scores = Object.fromEntries(BEIGHTON_KEYS.map((key) => [key, boolean(source[key], `scores.${key}`)]));
  invariant(Object.keys(source).every((key) => BEIGHTON_KEYS.includes(key)), 'scores contains unsupported Beighton item');
  const total = Object.values(scores).filter(Boolean).length;
  const classification = total >= 5 ? 'Hypermobility Likely' : total === 4 ? 'Borderline' : 'Below Threshold';
  const positiveItems = Object.entries(scores).filter(([, positive]) => positive).map(([key]) => key.replace(/([A-Z])/g, ' $1').trim());
  const soap = [
    `• Beighton Hypermobility Score: ${total}/9 — ${classification}`,
    `  Positive items: ${positiveItems.length ? positiveItems.join(', ') : 'None'}`,
    notesFrom(input, context) ? `  Notes: ${notesFrom(input, context)}` : null,
  ].filter(Boolean).join('\n');
  return completedPayload('beighton', input, context, total, soap, {
    scores, positive_items: positiveItems, classification,
  });
}

function scoreDualTaskGait(input, context) {
  const singleTaskTime = finiteNumber(input.singleTaskTime, 'singleTaskTime', { min: 0.01, max: 600 });
  const dualTaskTime = finiteNumber(input.dualTaskTime, 'dualTaskTime', { min: 0.01, max: 600 });
  const cognitiveTask = text(input.cognitiveTask, 'cognitiveTask', { required: true, max: 1000 });
  const dualTaskCost = round(((dualTaskTime - singleTaskTime) / singleTaskTime) * 100, 2);
  const interpretation = dualTaskCost > 20
    ? 'Clinically significant (>20%) - increased fall risk'
    : dualTaskCost < 0 ? 'Paradoxical response (faster during dual-task) - unusual' : 'Within normal range (<20%)';
  const soap = `• Dual-Task Gait Assessment:\n  Single-Task Time: ${singleTaskTime} seconds\n  Dual-Task Time: ${dualTaskTime} seconds\n  Dual-Task Cost: ${dualTaskCost.toFixed(2)}%\n  Cognitive Task: ${cognitiveTask}\n  Interpretation: ${interpretation}${notesFrom(input, context) ? `\n\n  Clinician Notes:\n    ${notesFrom(input, context).replace(/\n/g, '\n    ')}` : ''}`;
  return completedPayload('dual_task_gait', input, context, dualTaskCost, soap, {
    single_task_time: singleTaskTime, dual_task_time: dualTaskTime, cognitive_task: cognitiveTask,
    dual_task_cost: dualTaskCost, interpretation,
  });
}

const PLANK_NORMS = deepFreeze({
  '20-30': { male: [240, 180, 120], female: [200, 150, 100] },
  '31-40': { male: [220, 160, 110], female: [180, 130, 90] },
  '41-50': { male: [200, 140, 100], female: [160, 110, 80] },
  '51-60': { male: [180, 120, 90], female: [140, 95, 70] },
  '60+': { male: [150, 100, 70], female: [120, 80, 55] },
});

function plankAgeGroup(age) {
  if (age <= 30) return '20-30';
  if (age <= 40) return '31-40';
  if (age <= 50) return '41-50';
  if (age <= 60) return '51-60';
  return '60+';
}

function plankCategory(duration, age, sex) {
  if (age === null || sex === null) return null;
  const thresholds = PLANK_NORMS[plankAgeGroup(age)][sex];
  if (duration >= thresholds[0]) return 'Excellent';
  if (duration >= thresholds[1]) return 'Good';
  if (duration >= thresholds[2]) return 'Fair';
  return 'Poor';
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function scorePlank(input, context) {
  const testAttempts = numericArray(input.testAttempts, 'testAttempts', { minItems: 1, maxItems: 10, min: 0.01, max: 3600 });
  const clientAge = optionalInteger(input.clientAge, 'clientAge', { min: 1, max: 130 });
  const clientSex = optionalChoice(input.clientSex, 'clientSex', ['male', 'female']);
  const bestAttempt = Math.max(...testAttempts);
  const normativeLevel = plankCategory(bestAttempt, clientAge, clientSex);
  const ageGroup = clientAge === null ? null : plankAgeGroup(clientAge);
  const soap = [
    '• Plank Hold Test (Core Endurance)',
    clientAge !== null ? `  Client Age: ${clientAge} years` : '  Client Age: Not recorded',
    clientSex !== null ? `  Client Sex: ${clientSex}` : '  Client Sex: Not recorded', '',
    '  Test Results:', `    Number of Attempts: ${testAttempts.length}`,
    `    Best Time: ${formatDuration(bestAttempt)}`, `    All Attempts: ${testAttempts.map(formatDuration).join(', ')}`,
    normativeLevel ? `  Normative Comparison (Age ${ageGroup}, ${clientSex}): ${normativeLevel}` : '  Normative comparison unavailable because age and/or sex were not recorded.',
    notesFrom(input, context) ? `  Clinical Notes: ${notesFrom(input, context)}` : null,
  ].filter(Boolean).join('\n');
  return completedPayload('plank', input, context, bestAttempt, soap, {
    client_age: clientAge, client_sex: clientSex, all_attempts: testAttempts,
    best_attempt: bestAttempt, normative_comparison: normativeLevel ? { level: normativeLevel, category: normativeLevel.toLowerCase() } : null,
    age_group: ageGroup,
  });
}

const STORK_NORMS = deepFreeze([
  [18, 39, '18–39 yrs', [45, 30, 15, 5], [25, 15, 8, 3]],
  [40, 49, '40–49 yrs', [38, 25, 12, 4], [20, 12, 6, 2]],
  [50, 59, '50–59 yrs', [28, 18, 9, 3], [15, 9, 4, 1]],
  [60, 69, '60–69 yrs', [20, 12, 6, 2], [10, 6, 3, 1]],
  [70, 120, '70+ yrs', [12, 7, 3, 1], [5, 3, 2, 0]],
]);

function storkClassification(time, age, eyes) {
  if (age === null) return { ageGroup: null, classification: null };
  const row = STORK_NORMS.find(([minAge, maxAge]) => age >= minAge && age <= maxAge);
  if (!row) return { ageGroup: null, classification: null };
  const thresholds = eyes === 'open' ? row[3] : row[4];
  const classification = time >= thresholds[0] ? 'Excellent' : time >= thresholds[1] ? 'Good' : time >= thresholds[2] ? 'Fair' : time >= thresholds[3] ? 'Poor' : 'High Risk';
  return { ageGroup: row[2], classification };
}

function normalizeStorkSide(value, fieldName) {
  const source = record(value, fieldName);
  const trials = numericArray(source.trials, `${fieldName}.trials`, { minItems: 1, maxItems: 3, min: 0.01, max: 600 });
  const observations = record(source.observations ?? {}, `${fieldName}.observations`);
  const observationKeys = STORK_OBSERVATION_SCHEMA.map(([key]) => key);
  invariant(Object.keys(observations).every((key) => observationKeys.includes(key)), `${fieldName}.observations contains an unsupported key`);
  for (const [key, observed] of Object.entries(observations)) boolean(observed, `${fieldName}.observations.${key}`);
  const qualityScores = record(source.quality_scores ?? {}, `${fieldName}.quality_scores`);
  const qualityKeys = STORK_QUALITY_SCHEMA.map(([key]) => key);
  invariant(Object.keys(qualityScores).every((key) => qualityKeys.includes(key)), `${fieldName}.quality_scores contains an unsupported key`);
  for (const [key, score] of Object.entries(qualityScores)) integer(score, `${fieldName}.quality_scores.${key}`, { min: 0, max: 4 });
  return { trials, best_time: Math.max(...trials), observations: clone(observations), quality_scores: clone(qualityScores) };
}

function scoreStandingStork(input, context) {
  const left = normalizeStorkSide(input.leftData, 'leftData');
  const right = normalizeStorkSide(input.rightData, 'rightData');
  const setup = record(input.setup, 'setup');
  const eyes = choice(setup.eyes, 'setup.eyes', ['open', 'closed']);
  const normalizedSetup = {
    shoes: optionalChoice(setup.shoes, 'setup.shoes', ['off', 'on']),
    surface: choice(setup.surface, 'setup.surface', ['firm', 'foam']),
    eyes,
    dominant: optionalChoice(setup.dominant, 'setup.dominant', ['left', 'right']),
    confidence: optionalInteger(setup.confidence, 'setup.confidence', { min: 0, max: 10 }),
    pain: optionalInteger(setup.pain, 'setup.pain', { min: 0, max: 10 }),
    dizziness: optionalInteger(setup.dizziness, 'setup.dizziness', { min: 0, max: 10 }),
  };
  const safetySource = record(input.safety ?? {}, 'safety');
  const safetyKeys = STORK_SAFETY_SCHEMA.map(([key]) => key);
  invariant(Object.keys(safetySource).every((key) => safetyKeys.includes(key)), 'safety contains an unsupported key');
  const safety = Object.fromEntries(Object.entries(safetySource).map(([key, value]) => [key, boolean(value, `safety.${key}`)]));
  const clientAge = optionalInteger(input.clientAge, 'clientAge', { min: 1, max: 130 });
  const asymmetry = round((Math.abs(left.best_time - right.best_time) / Math.max(left.best_time, right.best_time)) * 100, 0);
  const leftNorm = storkClassification(left.best_time, clientAge, eyes);
  const rightNorm = storkClassification(right.best_time, clientAge, eyes);
  const resultValue = Math.max(left.best_time, right.best_time);
  const soap = `• Standing Stork Test (Unipedal Stance)\n  Eyes: ${eyes === 'open' ? 'Open' : 'Closed'} | Surface: ${normalizedSetup.surface}\n  Left leg: ${left.best_time}s best (${left.trials.length} trials)${leftNorm.classification ? ` — ${leftNorm.classification}` : ''}\n  Right leg: ${right.best_time}s best (${right.trials.length} trials)${rightNorm.classification ? ` — ${rightNorm.classification}` : ''}\n  Asymmetry: ${asymmetry}%${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('standing_stork', input, context, resultValue, soap, {
    left_time: left.best_time, right_time: right.best_time, left_data: left, right_data: right,
    asymmetry, left_classification: leftNorm.classification, right_classification: rightNorm.classification,
    normative_group: leftNorm.ageGroup, client_age: clientAge, setup: normalizedSetup, safety,
  });
}

function normalizedVitals(value, fieldName, { required = false } = {}) {
  const source = record(value ?? {}, fieldName);
  const systolic = optionalInteger(source.systolic, `${fieldName}.systolic`, { min: 50, max: 300 });
  const diastolic = optionalInteger(source.diastolic, `${fieldName}.diastolic`, { min: 20, max: 200 });
  const heartRate = optionalInteger(source.heartRate, `${fieldName}.heartRate`, { min: 20, max: 300 });
  invariant((systolic === null) === (diastolic === null), `${fieldName} blood pressure requires both systolic and diastolic`);
  if (required) invariant(systolic !== null && diastolic !== null && heartRate !== null, `${fieldName} requires systolic, diastolic and heart rate`);
  return { systolic, diastolic, heartRate };
}

function scoreMedicineBall(input, context) {
  const trials = numericArray(input.trials, 'trials', { minItems: 1, maxItems: 10, min: 0.01, max: 100 });
  const bestTrial = Math.max(...trials);
  const averageTrial = round(mean(trials), 2);
  const preTestVitals = normalizedVitals(input.preTestVitals, 'preTestVitals');
  const postTestVitals = normalizedVitals(input.postTestVitals, 'postTestVitals');
  const vitalLines = [];
  if (preTestVitals.systolic !== null || preTestVitals.heartRate !== null) vitalLines.push(`  Pre-Test Vitals:${preTestVitals.systolic !== null ? ` BP ${preTestVitals.systolic}/${preTestVitals.diastolic}` : ''}${preTestVitals.heartRate !== null ? ` HR ${preTestVitals.heartRate}bpm` : ''}`);
  if (postTestVitals.systolic !== null || postTestVitals.heartRate !== null) vitalLines.push(`  Post-Test Vitals:${postTestVitals.systolic !== null ? ` BP ${postTestVitals.systolic}/${postTestVitals.diastolic}` : ''}${postTestVitals.heartRate !== null ? ` HR ${postTestVitals.heartRate}bpm` : ''}`);
  const soap = [`• Medicine Ball Throw Assessment:`, `  Trials: ${trials.map((trial) => `${trial}m`).join(', ')}`, `  Best Trial: ${bestTrial}m`, `  Average: ${averageTrial}m`, ...vitalLines, notesFrom(input, context) ? `  Notes: ${notesFrom(input, context)}` : null].filter(Boolean).join('\n');
  return completedPayload('med_ball', input, context, bestTrial, soap, {
    trials, best_trial: bestTrial, average_trial: averageTrial, pre_test_vitals: preTestVitals, post_test_vitals: postTestVitals,
  });
}

function scorePurduePeg(input, context) {
  const source = record(input.scores, 'scores');
  const keys = ['rightHand', 'leftHand', 'bothHands', 'assembly'];
  invariant(Object.keys(source).every((key) => keys.includes(key)), 'scores contains unsupported Purdue subtest');
  const scores = Object.fromEntries(keys.map((key) => [key, optionalInteger(source[key], `scores.${key}`, { min: 0, max: 500 })]));
  const completedScores = Object.values(scores).filter((value) => value !== null);
  invariant(completedScores.length > 0, 'at least one Purdue subtest score is required');
  const clientAge = optionalInteger(input.clientAge, 'clientAge', { min: 1, max: 130 });
  const clientSex = optionalChoice(input.clientSex, 'clientSex', ['male', 'female']);
  const ageGroup = clientAge === null ? null : clientAge < 30 ? '20-29' : clientAge < 40 ? '30-39' : clientAge < 50 ? '40-49' : clientAge < 60 ? '50-59' : '60+';
  const totalValue = completedScores.reduce((sum, value) => sum + value, 0);
  const soap = ['• Purdue Pegboard Test', `  Client Age: ${clientAge ?? 'Not recorded'}${ageGroup ? ` (${ageGroup})` : ''}`, `  Client Sex: ${clientSex ?? 'Not recorded'}`, '', '  Test Scores:', `    Right Hand (30 sec): ${scores.rightHand ?? 'Not completed'}`, `    Left Hand (30 sec): ${scores.leftHand ?? 'Not completed'}`, `    Both Hands (30 sec): ${scores.bothHands ?? 'Not completed'}`, `    Assembly (60 sec): ${scores.assembly ?? 'Not completed'}`, `  Total completed-subtest count: ${totalValue}`, notesFrom(input, context) ? `  Clinical Notes: ${notesFrom(input, context)}` : null].filter(Boolean).join('\n');
  return completedPayload('purdue_peg', input, context, totalValue, soap, {
    scores, client_age: clientAge, client_sex: clientSex, age_group: ageGroup, total_value: totalValue,
  });
}

const LONG_JUMP_THRESHOLDS = deepFreeze({
  Male: { '17–19': [251, 221, 191, 161], '20–29': [261, 231, 201, 171], '30–39': [241, 211, 181, 151], '40–49': [221, 191, 161, 131], '50+': [191, 161, 131, 101] },
  Female: { '17–19': [196, 166, 136, 106], '20–29': [196, 166, 136, 106], '30–39': [181, 151, 121, 91], '40–49': [161, 131, 101, 71], '50+': [141, 111, 81, 51] },
});

function standingLongJumpCategory(distance, gender, age) {
  if (gender === null || age === null) return null;
  const group = age <= 19 ? '17–19' : age <= 29 ? '20–29' : age <= 39 ? '30–39' : age <= 49 ? '40–49' : '50+';
  const thresholds = LONG_JUMP_THRESHOLDS[gender][group];
  if (distance >= thresholds[0]) return 'Excellent';
  if (distance >= thresholds[1]) return 'Good';
  if (distance >= thresholds[2]) return 'Average';
  if (distance >= thresholds[3]) return 'Below Average';
  return 'Poor';
}

function scoreStandingLongJump(input, context) {
  const trials = numericArray(input.trials, 'trials', { minItems: 1, maxItems: 3, min: 0.01, max: 1000 });
  const gender = optionalChoice(input.gender, 'gender', ['Male', 'Female']);
  const age = optionalInteger(input.age, 'age', { min: 1, max: 130 });
  const bestJump = Math.max(...trials);
  const classification = standingLongJumpCategory(bestJump, gender, age);
  const soap = `Standing Long Jump Assessment\n\nTrials:\n${trials.map((trial, index) => `  Trial ${index + 1}: ${trial} cm`).join('\n')}\n\nBest Result: ${bestJump} cm\nClassification: ${classification || 'N/A'} (${gender || 'sex not recorded'}, age ${age ?? 'not recorded'})\n\nNotes: ${notesFrom(input, context) || 'None'}`;
  return completedPayload('standing_long_jump', input, context, bestJump, soap, {
    trials, best_jump_cm: bestJump, classification, gender, age,
  });
}

function scoreIllinois(input, context) {
  const trials = numericArray(input.trialTimes, 'trialTimes', { minItems: 1, maxItems: 10, min: 0.01, max: 300 });
  const bestTime = Math.min(...trials);
  const soap = `• Illinois Agility Test:\n  Best Time: ${bestTime}s\n  All Trials: ${trials.join('s, ')}s${notesFrom(input, context) ? `\n  Clinical Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('illinois', input, context, bestTime, soap, { trials, best_time: bestTime });
}

const T_TEST_NORMS = deepFreeze({
  male: [[9.5, 'Elite / Excellent'], [10, 'Good'], [10.5, 'Average'], [11.5, 'Below Average'], [Infinity, 'Poor']],
  female: [[10.5, 'Elite / Excellent'], [11, 'Good'], [11.5, 'Average'], [12.5, 'Below Average'], [Infinity, 'Poor']],
});
const T_TEST_RTS = deepFreeze({ male: { clearance: 10.5, caution: 11.5 }, female: { clearance: 11.5, caution: 12.5 } });
const T_TEST_QUALITY_KEYS = Object.freeze(['acceleration', 'deceleration', 'lateral_shuffle', 'foot_placement', 'cod_control', 'knee_valgus', 'trunk_control', 'arm_coordination', 'turning_efficiency']);

function tTestClassification(time, gender) {
  return gender === null ? null : T_TEST_NORMS[gender].find(([maximum]) => time < maximum)[1];
}

function tTestRts(time, gender) {
  if (gender === null) return null;
  const threshold = T_TEST_RTS[gender];
  if (time <= threshold.clearance) return 'RTS — Cleared';
  if (time <= threshold.caution) return 'RTS — Caution / Progressive';
  return 'RTS — Not Cleared';
}

function scoreTTest(input, context) {
  const trialResults = array(input.trialResults, 'trialResults', { minItems: 1, maxItems: 3 }).map((trial, index) => {
    const source = record(trial, `trialResults[${index}]`);
    return {
      time: finiteNumber(source.time, `trialResults[${index}].time`, { min: 0.01, max: 300 }),
      invalid: boolean(source.invalid, `trialResults[${index}].invalid`),
      invalidReason: text(source.invalidReason, `trialResults[${index}].invalidReason`, { required: source.invalid, max: 1000 }),
      trialNum: optionalInteger(source.trialNum, `trialResults[${index}].trialNum`, { min: 1, max: 3 }) ?? index + 1,
    };
  });
  for (const [index, trial] of trialResults.entries()) {
    if (!trial.invalidReason) continue;
    const reasons = trial.invalidReason.split(',').map((reason) => reason.trim()).filter(Boolean);
    invariant(reasons.every((reason) => T_TEST_INVALID_REASONS.includes(reason)), `trialResults[${index}].invalidReason contains an unsupported reason`);
  }
  const validTrials = trialResults.filter(({ invalid }) => !invalid).map(({ time }) => time);
  invariant(validTrials.length > 0, 'at least one valid T-Test trial is required');
  const qualitySource = record(input.quality, 'quality');
  const quality = Object.fromEntries(T_TEST_QUALITY_KEYS.map((key) => [key, integer(qualitySource[key], `quality.${key}`, { min: 0, max: 4 })]));
  invariant(Object.keys(qualitySource).every((key) => T_TEST_QUALITY_KEYS.includes(key)), 'quality contains unsupported dimension');
  const setupSource = record(input.setup, 'setup');
  const setup = {
    surface: choice(setupSource.surface, 'setup.surface', ['Indoor court', 'Outdoor grass', 'Synthetic turf', 'Gym floor', 'Concrete', 'Rubber']),
    footwear: text(setupSource.footwear, 'setup.footwear', { required: true, max: 300 }),
    indoor: boolean(setupSource.indoor, 'setup.indoor'),
    dominantLeg: optionalChoice(setupSource.dominantLeg, 'setup.dominantLeg', ['Left', 'Right', 'Unknown']),
    injuredSide: choice(setupSource.injuredSide, 'setup.injuredSide', ['None', 'Left', 'Right']),
    testingSport: text(setupSource.testingSport, 'setup.testingSport', { max: 500 }),
    warmupDone: boolean(setupSource.warmupDone, 'setup.warmupDone'),
    sprintConfidence: integer(setupSource.sprintConfidence, 'setup.sprintConfidence', { min: 0, max: 10 }),
    fatigueLevel: integer(setupSource.fatigueLevel, 'setup.fatigueLevel', { min: 0, max: 10 }),
  };
  const safetySource = record(input.safety ?? {}, 'safety');
  const safetyKeys = T_TEST_SAFETY_SCHEMA.map(([key]) => key);
  invariant(Object.keys(safetySource).every((key) => safetyKeys.includes(key)), 'safety contains an unsupported key');
  const safety = Object.fromEntries(Object.entries(safetySource).map(([key, value]) => [key, boolean(value, `safety.${key}`)]));
  const gender = optionalChoice(input.gender, 'gender', ['male', 'female']);
  const bestTime = Math.min(...validTrials);
  const averageTime = round(mean(validTrials), 2);
  const trialVariability = validTrials.length > 1 ? round(Math.max(...validTrials) - Math.min(...validTrials), 2) : null;
  const consistency = trialVariability === null ? null : round(100 - ((trialVariability / averageTime) * 100), 1);
  const classification = tTestClassification(bestTime, gender);
  const rtsStatus = tTestRts(bestTime, gender);
  const averageQuality = round(mean(Object.values(quality)), 1);
  const qualityLabel = averageQuality >= 3.5 ? 'Excellent' : averageQuality >= 2.5 ? 'Good' : averageQuality >= 1.5 ? 'Fair' : 'Poor';
  const flags = [];
  if (gender !== null) {
    const threshold = T_TEST_RTS[gender];
    if (bestTime > threshold.caution) flags.push('Significantly reduced agility — RTS not indicated');
    else if (bestTime > threshold.clearance) flags.push('Reduced agility — progressive RTS programme recommended');
  }
  if (quality.knee_valgus <= 1) flags.push('Dynamic valgus collapse — ACL re-injury risk');
  else if (quality.knee_valgus === 2) flags.push('Mild knee valgus — monitor during loading progression');
  if (quality.deceleration <= 1) flags.push('Poor deceleration control — eccentric strengthening required');
  if (quality.cod_control <= 1) flags.push('Change-of-direction deficit — agility progression indicated');
  if (consistency !== null && consistency < 85) flags.push('Low performance consistency — consider fatigue or apprehension');
  if (validTrials.length > 1 && validTrials.at(-1) - validTrials[0] > 0.5) flags.push('Fatigue-related performance decline across trials');
  const fatigueLevel = setup.fatigueLevel;
  if (fatigueLevel !== null && fatigueLevel >= 6) flags.push('High pre-test fatigue — may compromise results');
  flags.push('Reassess at next RTS milestone', 'Correlate with LSI hop testing and quad strength');
  let interpretation = `T-Test Agility completed across ${validTrials.length} valid trial(s). Best time recorded was ${bestTime.toFixed(2)}s`;
  if (validTrials.length > 1) interpretation += `, with a mean of ${averageTime.toFixed(2)}s`;
  interpretation += `. Performance was classified as ${classification || 'not classified because sex was unavailable'}.`;
  if (rtsStatus) interpretation += ` Return-to-sport status: ${rtsStatus}.`;
  if (quality.knee_valgus <= 1) interpretation += ' Dynamic knee valgus was evident during directional changes, indicating potential neuromuscular control deficit and elevated ACL re-injury risk.';
  else if (quality.knee_valgus === 2) interpretation += ' Mild knee valgus was noted — monitor with progressive loading.';
  if (quality.deceleration <= 1) interpretation += ' Deceleration control was poor, suggesting deficits in eccentric lower-limb strength and braking mechanics.';
  if (quality.cod_control <= 1) interpretation += ' Change-of-direction control was significantly reduced.';
  if (consistency !== null && consistency < 90) interpretation += ` Performance consistency was reduced (${consistency}%), which may reflect fatigue, technique variability, or apprehension.`;
  interpretation += " Findings should be contextualised with the client's clinical history, rehabilitation stage, and sport-specific demands.";
  const soapLines = ['• T-Test Agility'];
  trialResults.forEach((trial) => soapLines.push(`  Trial ${trial.trialNum}: ${trial.time.toFixed(2)}s${trial.invalid ? ` [INVALID — ${trial.invalidReason}]` : ' [Valid]'}`));
  soapLines.push(`  Best Time: ${bestTime.toFixed(2)}s${classification ? ` — ${classification}` : ''}`);
  if (validTrials.length > 1) soapLines.push(`  Mean Time: ${averageTime.toFixed(2)}s`);
  if (consistency !== null) soapLines.push(`  Consistency: ${consistency}%`);
  if (rtsStatus) soapLines.push(`  Return-to-Sport Status: ${rtsStatus}`);
  soapLines.push(`  Movement Quality: ${qualityLabel} (avg score ${averageQuality}/4)`);
  if (notesFrom(input, context)) soapLines.push(`  Clinical Notes: ${notesFrom(input, context)}`);
  soapLines.push(`  Interpretation: ${interpretation}`);
  return completedPayload('t_test', input, context, bestTime, soapLines.join('\n'), {
    best_time_s: bestTime, mean_time_s: averageTime, consistency_pct: consistency,
    trial_variability_s: trialVariability, valid_trials: validTrials, all_trials: trialResults,
    classification, rts_status: rtsStatus, quality_scores: quality, avg_quality: averageQuality,
    quality_label: qualityLabel, setup, safety, flags, interpretation,
  });
}

function scoreFiveOFive(input, context) {
  const trials = array(input.trials, 'trials', { minItems: 1, maxItems: 20 }).map((trial, index) => {
    const source = record(trial, `trials[${index}]`);
    return {
      direction: choice(source.direction, `trials[${index}].direction`, ['Left', 'Right']),
      time: finiteNumber(source.time, `trials[${index}].time`, { min: 0.01, max: 300 }),
    };
  });
  const dominantLeg = choice(input.dominantLeg, 'dominantLeg', ['Left', 'Right']);
  const leftTimes = trials.filter(({ direction }) => direction === 'Left').map(({ time }) => time);
  const rightTimes = trials.filter(({ direction }) => direction === 'Right').map(({ time }) => time);
  const bestLeft = leftTimes.length ? Math.min(...leftTimes) : null;
  const bestRight = rightTimes.length ? Math.min(...rightTimes) : null;
  const bestOverall = Math.min(...trials.map(({ time }) => time));
  const asymmetry = bestLeft !== null && bestRight !== null ? round(Math.abs(bestLeft - bestRight), 2) : null;
  const lines = ['• 505 Agility Test:', `  Best Overall Time: ${bestOverall}s | Dominant Leg: ${dominantLeg}`];
  if (bestLeft !== null) lines.push(`  Best Left Turn: ${bestLeft.toFixed(2)}s`);
  if (bestRight !== null) lines.push(`  Best Right Turn: ${bestRight.toFixed(2)}s`);
  if (asymmetry !== null) lines.push(`  L/R Asymmetry: ${asymmetry}s${asymmetry > 0.1 ? ' (clinically significant >0.1s)' : ''}`);
  lines.push('', '  All Trials:');
  trials.forEach((trial, index) => lines.push(`    Trial ${index + 1} (Turn ${trial.direction}): ${trial.time.toFixed(2)}s`));
  if (notesFrom(input, context)) lines.push('', `  Clinical Notes: ${notesFrom(input, context)}`);
  return completedPayload('505', input, context, bestOverall, lines.join('\n'), {
    trials, best_time_overall: bestOverall, best_time_left: bestLeft, best_time_right: bestRight,
    asymmetry_seconds: asymmetry, dominant_leg: dominantLeg, total_trials: trials.length,
  });
}

const HEXAGON_NORMS = deepFreeze({
  male: [[11.2, 'Excellent'], [13.3, 'Good'], [15.5, 'Average'], [17.8, 'Below Average'], [Infinity, 'Poor']],
  female: [[12, 'Excellent'], [14.5, 'Good'], [17, 'Average'], [19.5, 'Below Average'], [Infinity, 'Poor']],
});

function scoreHexagon(input, context) {
  const trials = numericArray(input.trials, 'trials', { minItems: 1, maxItems: 10, min: 0.01, max: 300 });
  const gender = optionalChoice(input.gender, 'gender', ['male', 'female']);
  const bestTime = Math.min(...trials);
  const classification = gender === null ? null : HEXAGON_NORMS[gender].find(([maximum]) => bestTime < maximum)[1];
  const soap = `• Hexagon Agility Test\n  Best Time: ${bestTime}s (3 circuits, ~${(bestTime * 100 / 30.48).toFixed(0)}cm sides)${classification ? ` — ${classification}` : ''}\n  All Trials: ${trials.map((trial) => `${trial}s`).join(', ')}${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}\n  Assesses agility, speed, and lower limb coordination.`;
  return completedPayload('hexagon', input, context, bestTime, soap, {
    best_time_s: bestTime, trials, classification, gender,
  });
}

function rsiCategory(value) {
  if (value >= 2.5) return 'Elite';
  if (value >= 1.75) return 'Good';
  if (value >= 1.25) return 'Average';
  if (value >= 0.75) return 'Below Average';
  return 'Poor';
}

function scoreRsi(input, context) {
  const trials = array(input.trials, 'trials', { minItems: 1, maxItems: 10 }).map((trial, index) => {
    const source = record(trial, `trials[${index}]`);
    const jumpHeight = finiteNumber(source.jumpHeight, `trials[${index}].jumpHeight`, { min: 0.01, max: 200 });
    const contactTime = finiteNumber(source.contactTime, `trials[${index}].contactTime`, { min: 0.01, max: 5000 });
    return { jumpHeight, contactTime, rsi: round((jumpHeight / 100) / (contactTime / 1000), 3) };
  });
  const dropHeight = finiteNumber(input.dropHeight, 'dropHeight', { min: 0.1, max: 200 });
  const best = trials.reduce((current, trial) => trial.rsi > current.rsi ? trial : current);
  const classification = rsiCategory(best.rsi);
  const trialLines = trials.map((trial, index) => `  Trial ${index + 1}: Jump ${trial.jumpHeight}cm | GCT ${trial.contactTime}ms | RSI ${trial.rsi}`).join('\n');
  const soap = `• Reactive Strength Index (RSI) — Drop Jump\n  Best RSI: ${best.rsi} (${classification})\n  Jump Height: ${best.jumpHeight}cm | Ground Contact Time: ${best.contactTime}ms\n  Drop Height: ${dropHeight}cm\n\n  All Trials:\n${trialLines}${notesFrom(input, context) ? `\n\n  Notes: ${notesFrom(input, context)}` : ''}\n  RSI = Jump Height (m) ÷ Ground Contact Time (s)`;
  return completedPayload('rsi', input, context, best.rsi, soap, {
    best_rsi: best.rsi, best_jump_height_cm: best.jumpHeight, best_contact_time_ms: best.contactTime,
    drop_height_cm: dropHeight, trials, classification,
  });
}

function scoreTenSecondJump(input, context) {
  const jumps = array(input.jumps, 'jumps', { minItems: 1, maxItems: 100 }).map((jump, index) => {
    const source = record(jump, `jumps[${index}]`);
    const flightTime = finiteNumber(source.flight_time_ms, `jumps[${index}].flight_time_ms`, { min: 0.01, max: 5000 });
    const contactTime = finiteNumber(source.contact_time_ms, `jumps[${index}].contact_time_ms`, { min: 0.01, max: 5000 });
    const jumpHeight = optionalNumber(source.jump_height_cm, `jumps[${index}].jump_height_cm`, { min: 0.01, max: 200 });
    return { flight_time_ms: flightTime, contact_time_ms: contactTime, jump_height_cm: jumpHeight, rsi: round(flightTime / contactTime, 3) };
  });
  const rsiValues = jumps.map(({ rsi }) => rsi);
  const heights = jumps.map(({ jump_height_cm: height }) => height).filter((height) => height !== null);
  const averageFlightTime = Math.round(mean(jumps.map(({ flight_time_ms: value }) => value)));
  const averageContactTime = Math.round(mean(jumps.map(({ contact_time_ms: value }) => value)));
  const bestRsi = round(Math.max(...rsiValues), 3);
  const averageRsi = round(mean(rsiValues), 3);
  const fatigueIndex = heights.length > 1 ? round(((Math.max(...heights) - Math.min(...heights)) / Math.max(...heights)) * 100, 1) : null;
  const jumpLines = jumps.map((jump, index) => `    Jump ${index + 1}: Flight=${jump.flight_time_ms}ms, Contact=${jump.contact_time_ms}ms, RSI=${jump.rsi.toFixed(3)}${jump.jump_height_cm !== null ? `, Height=${jump.jump_height_cm}cm` : ''}`).join('\n');
  const soap = `• 10-Second Repeated Jump Test\n  Total Valid Jumps: ${jumps.length} | Best RSI: ${bestRsi.toFixed(3)} | Average RSI: ${averageRsi.toFixed(3)}\n  Avg Flight Time: ${averageFlightTime} ms | Avg Contact Time: ${averageContactTime} ms${fatigueIndex !== null ? ` | Fatigue Index: ${fatigueIndex.toFixed(1)}%` : ''}\n\n  Individual Jump Data:\n${jumpLines}${notesFrom(input, context) ? `\n\n  Clinical Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('10sec_jump', input, context, bestRsi, soap, {
    total_jumps: jumps.length, jumps, average_flight_time_ms: averageFlightTime,
    average_contact_time_ms: averageContactTime, best_rsi: bestRsi, average_rsi: averageRsi,
    jump_heights_cm: heights.length ? heights : null, fatigue_index: fatigueIndex,
  });
}

function scoreCkcuest(input, context) {
  const trials = array(input.trials, 'trials', { minItems: 1, maxItems: 3 }).map((trial, index) => (
    integer(trial, `trials[${index}]`, { min: 1, max: 500 })
  ));
  const average = round(mean(trials), 1);
  const best = Math.max(...trials);
  const padded = [...trials, null, null, null].slice(0, 3);
  const soap = `• Closed Kinetic Chain Upper Extremity Stability Test (CKCUEST)\n  Trial 1: ${padded[0] ?? 'Not completed'} touches | Trial 2: ${padded[1] ?? 'Not completed'} touches | Trial 3: ${padded[2] ?? 'Not completed'} touches\n  Average: ${average} touches | Best: ${best} touches`;
  return completedPayload('ckcuest_full', input, context, average, soap, {
    trial1: padded[0], trial2: padded[1], trial3: padded[2], trials, average, best,
  });
}

const ISOMETRIC_MUSCLES = deepFreeze([
  ['grip_right', 'Grip Strength - Right', 'right'], ['grip_left', 'Grip Strength - Left', 'left'],
  ['elbow_flexion_right', 'Elbow Flexion - Right', 'right'], ['elbow_flexion_left', 'Elbow Flexion - Left', 'left'],
  ['elbow_extension_right', 'Elbow Extension - Right', 'right'], ['elbow_extension_left', 'Elbow Extension - Left', 'left'],
  ['shoulder_abduction_right', 'Shoulder Abduction - Right', 'right'], ['shoulder_abduction_left', 'Shoulder Abduction - Left', 'left'],
  ['shoulder_flexion_right', 'Shoulder Flexion - Right', 'right'], ['shoulder_flexion_left', 'Shoulder Flexion - Left', 'left'],
  ['hip_abduction_right', 'Hip Abduction - Right', 'right'], ['hip_abduction_left', 'Hip Abduction - Left', 'left'],
  ['hip_flexion_right', 'Hip Flexion - Right', 'right'], ['hip_flexion_left', 'Hip Flexion - Left', 'left'],
  ['knee_extension_right', 'Knee Extension - Right', 'right'], ['knee_extension_left', 'Knee Extension - Left', 'left'],
  ['ankle_dorsiflexion_right', 'Ankle Dorsiflexion - Right', 'right'], ['ankle_dorsiflexion_left', 'Ankle Dorsiflexion - Left', 'left'],
].map(([value, label, side]) => ({ value, label, side })));
const ISOMETRIC_BY_VALUE = Object.fromEntries(ISOMETRIC_MUSCLES.map((muscle) => [muscle.value, muscle]));

function scoreIsometric(input, context) {
  const tests = array(input.tests, 'tests', { minItems: 1, maxItems: 100 }).map((test, index) => {
    const source = record(test, `tests[${index}]`);
    const muscle = choice(source.muscle, `tests[${index}].muscle`, ISOMETRIC_MUSCLES.map(({ value }) => value));
    const trial1 = finiteNumber(source.trial1, `tests[${index}].trial1`, { min: 0.01, max: 100000 });
    const trial2 = optionalNumber(source.trial2, `tests[${index}].trial2`, { min: 0.01, max: 100000 });
    const trial3 = optionalNumber(source.trial3, `tests[${index}].trial3`, { min: 0.01, max: 100000 });
    const trials = [trial1, trial2, trial3].filter((value) => value !== null);
    return {
      id: source.id ?? null, muscle, muscleLabel: ISOMETRIC_BY_VALUE[muscle].label,
      trial1, trial2, trial3, angle: text(source.angle, `tests[${index}].angle`, { max: 100 }) || 'default',
      average: round(mean(trials), 2), best: Math.max(...trials),
    };
  });
  const symmetryAnalysis = {};
  for (const right of tests.filter(({ muscle }) => ISOMETRIC_BY_VALUE[muscle].side === 'right')) {
    const base = right.muscle.replace(/_(right|left)$/, '');
    const left = tests.find(({ muscle }) => muscle === `${base}_left`);
    if (!left) continue;
    const ratio = round((left.best / right.best) * 100, 1);
    symmetryAnalysis[base] = { right: right.best, left: left.best, ratio, symmetrical: ratio >= 90 && ratio <= 110 };
  }
  const summaries = tests.map((test) => `${test.muscleLabel}: Trial 1=${test.trial1}N${test.trial2 !== null ? `, Trial 2=${test.trial2}N` : ''}${test.trial3 !== null ? `, Trial 3=${test.trial3}N` : ''}, Best=${test.best}N, Average=${test.average}N`);
  const symmetrySummary = Object.entries(symmetryAnalysis).map(([muscle, data]) => `${muscle}: L/R Symmetry ${data.ratio}% (${data.symmetrical ? 'symmetrical' : 'asymmetrical'})`);
  const soap = `Isometric Strength Testing:\n${summaries.join('\n')}${symmetrySummary.length ? `\n\nBilateral Symmetry Analysis:\n${symmetrySummary.join('\n')}` : ''}${notesFrom(input, context) ? `\n\nClinical Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('isometric_testing', input, context, tests[0].best, soap, {
    tests, symmetry_analysis: symmetryAnalysis,
  });
}

const ISOKINETIC_SPEEDS = Object.freeze(['60°/s', '180°/s', '240°/s', '300°/s', 'Custom']);

function scoreIsokinetic(input, context) {
  const joint = text(input.joint, 'joint', { required: true, max: 300 });
  const device = text(input.device, 'device', { max: 300 });
  const preHr = optionalInteger(input.preHR, 'preHR', { min: 20, max: 300 });
  const postHr = optionalInteger(input.postHR, 'postHR', { min: 20, max: 300 });
  const sets = array(input.sets, 'sets', { minItems: 1, maxItems: 100 }).map((set, index) => {
    const source = record(set, `sets[${index}]`);
    const side = choice(source.side, `sets[${index}].side`, ['right', 'left']);
    const speed = choice(source.speed, `sets[${index}].speed`, ISOKINETIC_SPEEDS);
    const speedDegPerSecond = speed === 'Custom'
      ? finiteNumber(source.customSpeed, `sets[${index}].customSpeed`, { min: 1, max: 1000 })
      : Number.parseInt(speed, 10);
    return {
      side, speed, speed_deg_per_s: speedDegPerSecond,
      peak_torque_nm: finiteNumber(source.peakTorque, `sets[${index}].peakTorque`, { min: 0.01, max: 100000 }),
      avg_torque_nm: optionalNumber(source.avgTorque, `sets[${index}].avgTorque`, { min: 0.01, max: 100000 }),
      work_j: optionalNumber(source.work, `sets[${index}].work`, { min: 0.01, max: 1000000 }),
      power_w: optionalNumber(source.power, `sets[${index}].power`, { min: 0.01, max: 1000000 }),
      reps: optionalInteger(source.reps, `sets[${index}].reps`, { min: 1, max: 10000 }),
    };
  });
  const maxPeak = Math.max(...sets.map(({ peak_torque_nm: value }) => value));
  const setLines = sets.map((set) => `  ${set.side} ${set.speed}${set.speed === 'Custom' ? ` (${set.speed_deg_per_s}°/s)` : ''}: Peak ${set.peak_torque_nm}Nm${set.avg_torque_nm !== null ? ` | Avg ${set.avg_torque_nm}Nm` : ''}${set.work_j !== null ? ` | Work ${set.work_j}J` : ''}${set.power_w !== null ? ` | Power ${set.power_w}W` : ''}${set.reps !== null ? ` | ${set.reps} reps` : ''}`).join('\n');
  const soap = `• Isokinetic Dynamometry — ${joint}\n  Device: ${device || 'Not specified'}\n  Pre-test HR: ${preHr ?? 'N/A'} bpm | Post-test HR: ${postHr ?? 'N/A'} bpm\n\n  Results:\n${setLines}${notesFrom(input, context) ? `\n\n  Notes: ${notesFrom(input, context)}` : ''}\n  Hamstring:Quadriceps ratio norms: 0.55–0.80 at 60°/s. <0.55 indicates increased injury risk.`;
  return completedPayload('isokinetic_dyn', input, context, maxPeak, soap, {
    joint, device, pre_hr: preHr, post_hr: postHr, sets, maximum_peak_torque: maxPeak,
  });
}

function scoreObers(input, context) {
  const bilateral = record(input.bilateralResults, 'bilateralResults');
  const left = choice(bilateral.left, 'bilateralResults.left', ['positive', 'negative']);
  const right = choice(bilateral.right, 'bilateralResults.right', ['positive', 'negative']);
  const preTestVitals = normalizedVitals(input.preTestVitals, 'preTestVitals', { required: true });
  const postTestVitals = normalizedVitals(input.postTestVitals, 'postTestVitals', { required: true });
  const positiveCount = Number(left === 'positive') + Number(right === 'positive');
  const interpretation = positiveCount === 2 ? 'Bilateral ITB tightness' : positiveCount === 1 ? 'Unilateral ITB tightness' : 'No ITB tightness detected';
  const soap = `• Ober's Test (ITB Tightness)\n  Left: ${left}\n  Right: ${right}\n  Interpretation: ${interpretation}`;
  return completedPayload('obers_test', input, context, positiveCount, soap, {
    left_result: left, right_result: right, positive_count: positiveCount, interpretation,
    pre_test_vitals: preTestVitals, post_test_vitals: postTestVitals,
  });
}

const SLR_SYMPTOM_TYPES = Object.freeze(['None', 'Hamstring tightness', 'Posterior thigh stretch', 'Sciatic pain', 'Burning', 'Tingling', 'Numbness', 'Lumbar pain', 'Glute pain', 'Calf pain']);
const SLR_PAIN_DISTRIBUTION = Object.freeze(['Back only', 'Buttock', 'Posterior thigh', 'Below knee', 'Foot/toes', 'Diffuse']);
const SLR_END_FEELS = Object.freeze(['Soft tissue restriction', 'Neural tension', 'Pain limited', 'Guarding']);
const SLR_MODIFIER_KEYS = Object.freeze(['ankle_df', 'cervical_flex', 'hip_add_ir', 'contralateral_slr', 'slump']);
const SLR_MODIFIER_RESPONSES = Object.freeze(['Symptoms increased', 'Symptoms unchanged', 'Symptoms decreased']);
const SLR_SAFETY_FLAGS = Object.freeze(['acute_injury', 'recent_surgery', 'severe_pain_flare', 'fracture_suspicion', 'cannot_supine', 'severe_neuro', 'cauda_equina']);

function choiceArray(value, fieldName, allowed, { maxItems = allowed.length } = {}) {
  const entries = array(value ?? [], fieldName, { minItems: 0, maxItems }).map((entry, index) => choice(entry, `${fieldName}[${index}]`, allowed));
  invariant(new Set(entries).size === entries.length, `${fieldName} must not contain duplicates`);
  return entries;
}

function normalizeSlrSide(value, fieldName) {
  const source = record(value, fieldName);
  const maxAngle = finiteNumber(source.maxAngle, `${fieldName}.maxAngle`, { min: 0, max: 180 });
  const onsetAngle = optionalNumber(source.onsetAngle, `${fieldName}.onsetAngle`, { min: 0, max: 180 });
  invariant(onsetAngle === null || onsetAngle <= maxAngle, `${fieldName}.onsetAngle cannot exceed maximum ROM`);
  const symptomTypes = choiceArray(source.symptomTypes, `${fieldName}.symptomTypes`, SLR_SYMPTOM_TYPES);
  invariant(!symptomTypes.includes('None') || symptomTypes.length === 1, `${fieldName}.symptomTypes cannot combine None with symptoms`);
  return {
    onsetAngle, maxAngle, symptomTypes,
    painSeverity: optionalNumber(source.painSeverity, `${fieldName}.painSeverity`, { min: 0, max: 10 }),
    painDistribution: choiceArray(source.painDistribution, `${fieldName}.painDistribution`, SLR_PAIN_DISTRIBUTION),
    familiarReproduced: optionalChoice(source.familiarReproduced, `${fieldName}.familiarReproduced`, ['Yes', 'No']),
    positive: choice(source.positive, `${fieldName}.positive`, ['Yes', 'No']),
    endFeel: optionalChoice(source.endFeel, `${fieldName}.endFeel`, SLR_END_FEELS),
  };
}

function scoreSlr(input, context) {
  const left = normalizeSlrSide(input.left, 'left');
  const right = normalizeSlrSide(input.right, 'right');
  const modifiersSource = record(input.modifiers ?? {}, 'modifiers');
  invariant(Object.keys(modifiersSource).every((key) => SLR_MODIFIER_KEYS.includes(key)), 'modifiers contains an unsupported neurodynamic modifier');
  const modifiers = Object.fromEntries(Object.entries(modifiersSource).filter(([, value]) => hasValue(value)).map(([key, value]) => [key, choice(value, `modifiers.${key}`, SLR_MODIFIER_RESPONSES)]));
  const baselinePain = optionalNumber(input.baselinePain, 'baselinePain', { min: 0, max: 10 });
  const symptomaticSide = optionalChoice(input.symptomaticSide, 'symptomaticSide', ['Left', 'Right', 'Bilateral', 'None']);
  const safetyFlags = choiceArray(input.safetyFlags, 'safetyFlags', SLR_SAFETY_FLAGS);
  const setupSource = record(input.setup ?? {}, 'setup');
  const setup = {
    surface: optionalChoice(setupSource.surface, 'setup.surface', ['Plinth', 'Mat table', 'Firm bed', 'Floor']),
    shoesOff: optionalChoice(setupSource.shoesOff, 'setup.shoesOff', ['Shoes off', 'Shoes on']),
    warmupDone: optionalChoice(setupSource.warmupDone, 'setup.warmupDone', ['Yes', 'No']),
    consentObtained: optionalBoolean(setupSource.consentObtained, 'setup.consentObtained'),
    safetyDone: optionalBoolean(setupSource.safetyDone, 'setup.safetyDone'),
  };
  const lPositive = left.positive === 'Yes';
  const rPositive = right.positive === 'Yes';
  const lBelowKnee = left.painDistribution.some((entry) => ['Below knee', 'Foot/toes'].includes(entry));
  const rBelowKnee = right.painDistribution.some((entry) => ['Below knee', 'Foot/toes'].includes(entry));
  const neuralSymptoms = ['Sciatic pain', 'Burning', 'Tingling', 'Numbness'];
  const lNeural = left.symptomTypes.some((entry) => neuralSymptoms.includes(entry));
  const rNeural = right.symptomTypes.some((entry) => neuralSymptoms.includes(entry));
  const diff = Math.abs(left.maxAngle - right.maxAngle);
  const flags = [];
  if (lPositive || rPositive) flags.push('Positive SLR — neural mechanosensitivity present');
  if (lPositive && rPositive) flags.push('Bilateral positive SLR — consider central sensitisation');
  if ((lBelowKnee || lNeural) && lPositive) flags.push('Left-sided lumbar radiculopathy suspected');
  if ((rBelowKnee || rNeural) && rPositive) flags.push('Right-sided lumbar radiculopathy suspected');
  if (left.maxAngle < 70 || right.maxAngle < 70) flags.push('Reduced SLR ROM — neural or hamstring restriction');
  if (diff > 10) flags.push(`Asymmetry > 10° (${diff}°) — unilateral pathology likely`);
  if (!lPositive && !rPositive && (left.maxAngle < 70 || right.maxAngle < 70)) flags.push('Hamstring restriction — no neural reproduction');
  if (lPositive || rPositive) flags.push('Recommend Slump Test for confirmation');
  if (lBelowKnee || rBelowKnee) flags.push('Below-knee symptom distribution — neurological screen recommended');
  let interpretation;
  if (lPositive && !rPositive) interpretation = `Positive left-sided SLR${left.onsetAngle !== null ? ` with symptom onset at ${left.onsetAngle}°` : ''}. ${lBelowKnee ? 'Familiar symptoms reproduced into posterior thigh and below knee, consistent with sciatic nerve mechanosensitivity and possible lumbar nerve root irritation (L4–S1).' : 'Symptoms reproduced in posterior thigh without below-knee radiation.'} Right SLR negative to ${right.maxAngle}°. Findings suggest unilateral left-sided neural tension.`;
  else if (rPositive && !lPositive) interpretation = `Positive right-sided SLR${right.onsetAngle !== null ? ` with symptom onset at ${right.onsetAngle}°` : ''}. ${rBelowKnee ? 'Familiar symptoms reproduced into posterior thigh and below knee, consistent with sciatic nerve mechanosensitivity and possible lumbar nerve root irritation (L4–S1).' : 'Symptoms reproduced in posterior thigh without below-knee radiation.'} Left SLR negative to ${left.maxAngle}°. Findings suggest unilateral right-sided neural tension.`;
  else if (lPositive && rPositive) interpretation = `Bilateral positive SLR findings. Left onset ${left.onsetAngle ?? 'N/A'}°, right onset ${right.onsetAngle ?? 'N/A'}°. Bilateral neural mechanosensitivity may reflect central sensitisation, diffuse lumbar pathology, or high neural irritability. Recommend Slump Test and comprehensive lumbar assessment.`;
  else if (left.maxAngle < 70 || right.maxAngle < 70) interpretation = `SLR bilaterally negative for neural symptom reproduction. Limitation present${left.maxAngle < 70 ? ` left (${left.maxAngle}°)` : ''}${right.maxAngle < 70 ? ` right (${right.maxAngle}°)` : ''}. Findings suggest muscular flexibility limitation (hamstring restriction) rather than radiculopathy.`;
  else interpretation = `SLR assessment bilaterally negative. Left ${left.maxAngle}°, Right ${right.maxAngle}°. No neural symptom provocation noted. ROM within or near normal limits.`;
  const sideDescription = (label, side, positive) => `${label} SLR: ${positive ? 'POSITIVE' : 'negative'} — max ROM ${side.maxAngle}°${side.onsetAngle !== null ? `, onset at ${side.onsetAngle}°` : ''}. ${side.symptomTypes.filter((entry) => entry !== 'None').join(', ') || 'No symptoms'}. Distribution: ${side.painDistribution.join(', ') || 'none'}.`;
  const modifierLines = Object.entries(modifiers).map(([key, value]) => `    - ${key}: ${value}`);
  const soap = ['• Straight Leg Raise (SLR) Assessment — Neurodynamic & Orthopedic Test', '', '  Bilateral Results:', `    ${sideDescription('Left', left, lPositive)}`, `    ${sideDescription('Right', right, rPositive)}`, `    Bilateral asymmetry: ${diff}°`, '', baselinePain !== null ? `  Baseline Pain: ${baselinePain}/10` : null, symptomaticSide ? `  Symptomatic Side: ${symptomaticSide}` : null, '', modifierLines.length ? '  Neurodynamic Modifiers:' : null, ...modifierLines, '', '  Clinical Interpretation:', `    ${interpretation}`, '', flags.length ? '  Clinical Flags:' : null, ...flags.map((flag) => `    ⚑ ${flag}`), '', notesFrom(input, context) ? `  Clinician Notes: ${notesFrom(input, context)}` : null].filter((value) => value !== null).join('\n');
  return completedPayload('slr_test', input, context, Math.max(left.maxAngle, right.maxAngle), soap, {
    left, right, bilateral_asymmetry: diff, left_positive: lPositive, right_positive: rPositive,
    symptom_modifiers: modifiers, baseline_pain: baselinePain, symptomatic_side: symptomaticSide,
    clinical_flags: flags, interpretation, safety_flags_noted: safetyFlags, setup,
  });
}

const SLUMP_SYMPTOM_LOCATIONS = Object.freeze(['Lumbar only', 'Buttock', 'Posterior thigh', 'Knee', 'Posterior calf', 'Foot/toes', 'Diffuse leg', 'Anterior thigh']);
const SLUMP_SYMPTOM_TYPES = Object.freeze(['Hamstring stretch', 'Posterior thigh pain', 'Sciatic-type pain', 'Burning', 'Tingling', 'Numbness', 'Calf ache', 'Foot symptoms']);
const SLUMP_RESPONSE_OPTIONS = Object.freeze(['decreased', 'unchanged', 'increased']);
const SLUMP_DIFF_KEYS = Object.freeze(['cervicalExtension', 'plantarflexion', 'reducedSlump', 'hipReposition']);

function normalizeSlumpLimb(value, fieldName) {
  const source = record(value, fieldName);
  const kneeAngle = optionalNumber(source.kneeAngle, `${fieldName}.kneeAngle`, { min: 0, max: 180 });
  const clinicianPositive = optionalBoolean(source.positive, `${fieldName}.positive`);
  invariant(kneeAngle !== null || clinicianPositive !== null, `${fieldName} requires knee angle or clinician result`);
  const familiarSymptoms = optionalBoolean(source.familiarSymptoms, `${fieldName}.familiarSymptoms`);
  const cervicalResponse = optionalChoice(source.cervicalResponse, `${fieldName}.cervicalResponse`, SLUMP_RESPONSE_OPTIONS);
  const belowKnee = optionalBoolean(source.belowKnee, `${fieldName}.belowKnee`);
  const derivedPositive = clinicianPositive === true || (familiarSymptoms === true && cervicalResponse === 'decreased' && belowKnee === true);
  return {
    kneeAngle, painSeverity: optionalNumber(source.painSeverity, `${fieldName}.painSeverity`, { min: 0, max: 10 }),
    symptomTypes: choiceArray(source.symptomTypes, `${fieldName}.symptomTypes`, SLUMP_SYMPTOM_TYPES),
    symptomLocations: choiceArray(source.symptomLocations, `${fieldName}.symptomLocations`, SLUMP_SYMPTOM_LOCATIONS),
    belowKnee, familiarSymptoms, cervicalResponse, clinicianPositive,
    positive: derivedPositive, dorsiflex: optionalChoice(source.dorsiflex, `${fieldName}.dorsiflex`, SLUMP_RESPONSE_OPTIONS),
  };
}

function scoreSlump(input, context) {
  const left = normalizeSlumpLimb(input.leftData, 'leftData');
  const right = normalizeSlumpLimb(input.rightData, 'rightData');
  const symptomaticSide = optionalChoice(input.symptomaticSide, 'symptomaticSide', ['left', 'right', 'bilateral', 'none']);
  const baselinePain = optionalNumber(input.baselinePain, 'baselinePain', { min: 0, max: 10 });
  const irritability = optionalInteger(input.irritability, 'irritability', { min: 0, max: 10 });
  const diffSource = record(input.diffModifiers ?? {}, 'diffModifiers');
  invariant(Object.keys(diffSource).every((key) => SLUMP_DIFF_KEYS.includes(key)), 'diffModifiers contains an unsupported modifier');
  const diffModifiers = Object.fromEntries(Object.entries(diffSource).filter(([, value]) => hasValue(value)).map(([key, value]) => [key, choice(value, `diffModifiers.${key}`, SLUMP_RESPONSE_OPTIONS)]));
  const stageCompletedSource = record(input.stageCompleted ?? {}, 'stageCompleted');
  const stageKeys = SLUMP_SCHEMA_STAGES.map(([key]) => key);
  invariant(Object.keys(stageCompletedSource).every((key) => stageKeys.includes(key)), 'stageCompleted contains an unsupported stage');
  const stageCompleted = Object.fromEntries(Object.entries(stageCompletedSource).map(([key, value]) => [key, boolean(value, `stageCompleted.${key}`)]));
  const stageSymptomsSource = record(input.stageSymptoms ?? {}, 'stageSymptoms');
  invariant(Object.keys(stageSymptomsSource).every((key) => stageKeys.includes(key)), 'stageSymptoms contains an unsupported stage');
  const stageSymptoms = Object.fromEntries(Object.entries(stageSymptomsSource).map(([key, value]) => [key, text(value, `stageSymptoms.${key}`)]));
  const setupSource = record(input.setup ?? {}, 'setup');
  const setup = {
    surface: optionalChoice(setupSource.surface, 'setup.surface', ['plinth', 'chair', 'other']),
    safetyDone: optionalBoolean(setupSource.safetyDone, 'setup.safetyDone'),
    safetyChecks: clone(record(setupSource.safetyChecks ?? {}, 'setup.safetyChecks')),
  };
  const slumpSafetyKeys = SLUMP_SCHEMA_SAFETY.map(([key]) => key);
  invariant(Object.keys(setup.safetyChecks).every((key) => slumpSafetyKeys.includes(key)), 'setup.safetyChecks contains an unsupported key');
  for (const [key, value] of Object.entries(setup.safetyChecks)) boolean(value, `setup.safetyChecks.${key}`);
  let interpretationLevel;
  let interpretation;
  const angleComparison = left.kneeAngle !== null && right.kneeAngle !== null
    ? Math.abs(left.kneeAngle - right.kneeAngle) > 10
      ? `${left.kneeAngle > right.kneeAngle ? 'Left' : 'Right'} limb demonstrated earlier symptom onset during knee extension (${Math.abs(left.kneeAngle - right.kneeAngle)}° asymmetry).`
      : 'Bilateral knee extension angles were comparable, suggesting symmetrical neural mobility.'
    : '';
  if (left.positive && right.positive) {
    interpretationLevel = 'Bilateral Positive Slump Test';
    interpretation = `Bilateral positive Slump Test with reproduction of familiar neural symptoms on both sides. ${angleComparison} Findings indicate bilateral sciatic neural mechanosensitivity. Comprehensive lumbar spine assessment and neurological screening is recommended.`;
  } else if (left.positive || right.positive) {
    const positiveSide = left.positive ? 'left' : 'right';
    const data = left.positive ? left : right;
    interpretationLevel = `Positive Slump Test — ${positiveSide[0].toUpperCase()}${positiveSide.slice(1)} Side`;
    interpretation = `Positive ${positiveSide}-sided Slump Test with reproduction of familiar symptoms into ${data.symptomLocations.length ? data.symptomLocations.join(', ').toLowerCase() : 'lower limb'}${data.belowKnee ? ', including below-knee distribution' : ''}. ${data.cervicalResponse === 'decreased' ? 'Symptoms reduced following cervical extension release, confirming neural mechanosensitivity.' : ''} ${angleComparison} Findings are consistent with ${positiveSide}-sided sciatic neural tension and possible lumbar nerve root irritation.`;
  } else {
    const onlyStretch = [...left.symptomTypes, ...right.symptomTypes].includes('Hamstring stretch');
    interpretationLevel = 'Negative Slump Test';
    interpretation = `Slump Test did not reproduce familiar neural symptoms bilaterally. ${onlyStretch ? 'Posterior thigh stretch sensation only was noted, which is a normal finding consistent with hamstring restriction rather than neurodynamic dysfunction. ' : ''}No symptom modification with cervical extension was observed. Findings do not support significant lumbar neural tension at this time.`;
  }
  const flags = [];
  if (left.positive || right.positive) flags.push('Sciatic neural mechanosensitivity identified');
  if (left.positive && right.positive) flags.push('Bilateral neural involvement — lumbar canal or central pathology to consider');
  if (left.belowKnee === true || right.belowKnee === true) flags.push('Below-knee symptom distribution — higher specificity for radiculopathy');
  if (left.familiarSymptoms === true || right.familiarSymptoms === true) flags.push('Familiar symptom reproduction — clinically meaningful finding');
  if (left.positive || right.positive) flags.push('Recommend SLR test comparison for convergent validity', 'Recommend lumbar neurological screen (myotomes, dermatomes, reflexes)');
  if (irritability !== null && irritability >= 7) flags.push('Elevated symptom irritability — proceed with caution in further testing');
  if (left.cervicalResponse === 'unchanged' || right.cervicalResponse === 'unchanged') flags.push('No cervical release effect — consider non-neural or central origin');
  const limbLines = (label, side) => [`  ${label} Side:`, `    Knee extension angle at onset: ${side.kneeAngle ?? '—'}°`, `    Pain severity: ${side.painSeverity ?? '—'}/10`, side.symptomLocations.length ? `    Distribution: ${side.symptomLocations.join(', ')}` : null, `    Below-knee symptoms: ${side.belowKnee === null ? '—' : side.belowKnee ? 'Yes' : 'No'}`, `    Familiar symptoms: ${side.familiarSymptoms === null ? '—' : side.familiarSymptoms ? 'Yes' : 'No'}`, `    Cervical release response: ${side.cervicalResponse ?? '—'}`, `    Result: ${side.positive ? 'POSITIVE' : 'Negative'}`, ''];
  const soap = ['• Slump Test — Neurodynamic Assessment', '', ...limbLines('Left', left), ...limbLines('Right', right), `  Interpretation: ${interpretationLevel}`, `  ${interpretation}`, '', flags.length ? '  Clinical Flags:' : null, ...flags.map((flag) => `    ⚑ ${flag}`), '', notesFrom(input, context) ? `  Notes: ${notesFrom(input, context)}` : null].filter((value) => value !== null).join('\n');
  return completedPayload('slump_test', input, context, Number(left.positive) + Number(right.positive), soap, {
    left, right, left_positive: left.positive, right_positive: right.positive,
    symptomatic_side: symptomaticSide, baseline_pain: baselinePain, irritability,
    differentiation_modifiers: diffModifiers, stage_completed: stageCompleted, stage_symptoms: stageSymptoms,
    interpretation: interpretationLevel, interpretation_narrative: interpretation, clinical_flags: flags, setup,
  });
}

function scoreLachman(input, context) {
  const kneeFlexion = finiteNumber(input.kneeFlexion, 'kneeFlexion', { min: 0, max: 90 });
  const laxityGrade = choice(String(input.laxityGrade), 'laxityGrade', ['1', '2', '3']);
  const endFeel = choice(input.endFeel, 'endFeel', ['firm', 'soft']);
  const gradeValues = { 1: 0, 2: 5, 3: 10 };
  const resultValue = gradeValues[laxityGrade] + Number(endFeel === 'soft');
  const gradeDescription = { 1: '0-5mm', 2: '5-10mm', 3: '>10mm' }[laxityGrade];
  const soap = `• Lachman Test:\n  Laxity Grade: ${laxityGrade} (${gradeDescription}) | End-Feel: ${endFeel === 'firm' ? 'Firm (ACL intact)' : 'Soft (ACL likely ruptured)'} | Knee Flexion: ${kneeFlexion}°${notesFrom(input, context) ? `\n  Notes: ${notesFrom(input, context)}` : ''}`;
  return completedPayload('lachman_test', input, context, resultValue, soap, {
    kneeFlexion, laxityGrade, endFeel, laxity_value: resultValue,
  });
}

const PIVOT_GRADE_LABELS = Object.freeze(['Grade 0 — Negative', 'Grade 1 — Glide', 'Grade 2 — Clunk', 'Grade 3 — Locking']);

function scorePivotShift(input, context) {
  const leftGrade = integer(input.leftGrade, 'leftGrade', { min: 0, max: 3 });
  const rightGrade = integer(input.rightGrade, 'rightGrade', { min: 0, max: 3 });
  const worstGrade = Math.max(leftGrade, rightGrade);
  const soap = `• Pivot Shift Test\n  Left: ${PIVOT_GRADE_LABELS[leftGrade]}\n  Right: ${PIVOT_GRADE_LABELS[rightGrade]}\n  Overall: ${PIVOT_GRADE_LABELS[worstGrade]}`;
  return completedPayload('pivot_shift', input, context, worstGrade, soap, {
    left_grade: leftGrade, right_grade: rightGrade, worst_grade: worstGrade,
  });
}

function scoreMcmurray(input, context) {
  const normalizeTrials = (value, fieldName) => array(value, fieldName, { minItems: 0, maxItems: 100 }).map((entry, index) => (
    choice(entry, `${fieldName}[${index}]`, ['positive', 'negative'])
  ));
  const medialResults = normalizeTrials(input.medialResults, 'medialResults');
  const lateralResults = normalizeTrials(input.lateralResults, 'lateralResults');
  invariant(medialResults.length > 0, 'medialResults requires at least one trial');
  invariant(lateralResults.length > 0, 'lateralResults requires at least one trial');
  const preTestVitals = normalizedVitals(input.preTestVitals, 'preTestVitals', { required: true });
  const postTestVitals = normalizedVitals(input.postTestVitals, 'postTestVitals', { required: true });
  const medialPositive = medialResults.filter((result) => result === 'positive').length;
  const lateralPositive = lateralResults.filter((result) => result === 'positive').length;
  const totalPositive = medialPositive + lateralPositive;
  const soap = `• McMurray's Test\n  Medial Meniscus: ${medialPositive}/${medialResults.length} positive\n  Lateral Meniscus: ${lateralPositive}/${lateralResults.length} positive\n  Total Positive: ${totalPositive}/${medialResults.length + lateralResults.length}`;
  return completedPayload('mcmurrays_test', input, context, totalPositive, soap, {
    medial_results: medialResults, lateral_results: lateralResults, medial_positive: medialPositive,
    lateral_positive: lateralPositive, total_positive: totalPositive,
    pre_test_vitals: preTestVitals, post_test_vitals: postTestVitals,
  });
}

const THESSALY_PAIN = Object.freeze(['none', 'medial', 'lateral', 'both']);
const THESSALY_MECHANICAL = Object.freeze(['none', 'catching', 'locking', 'giving_way', 'multiple']);
const THESSALY_INTENSITY = Object.freeze(['none', 'mild', 'moderate', 'severe']);

function normalizeThessalySide(value, fieldName) {
  if (value === null || value === undefined) return null;
  const source = record(value, fieldName);
  const jointLinePain = choice(source.joint_line_pain, `${fieldName}.joint_line_pain`, THESSALY_PAIN);
  const mechanicalSymptoms = optionalChoice(source.mechanical_symptoms, `${fieldName}.mechanical_symptoms`, THESSALY_MECHANICAL);
  const painIntensity = optionalChoice(source.pain_intensity, `${fieldName}.pain_intensity`, THESSALY_INTENSITY);
  const interpretation = jointLinePain === 'medial' || jointLinePain === 'both'
    ? 'Medial meniscal involvement suspected'
    : jointLinePain === 'lateral' ? 'Lateral meniscal involvement suspected' : 'Meniscal tear unlikely';
  return { joint_line_pain: jointLinePain, mechanical_symptoms: mechanicalSymptoms, pain_intensity: painIntensity, interpretation };
}

function scoreThessaly(input, context) {
  const leftData = normalizeThessalySide(input.leftData, 'leftData');
  const rightData = normalizeThessalySide(input.rightData, 'rightData');
  invariant(leftData !== null || rightData !== null, 'at least one Thessaly side is required');
  const isPositive = [leftData, rightData].some((side) => side && side.joint_line_pain !== 'none');
  const soap = ['• Thessaly Test', leftData ? `  Left: ${leftData.joint_line_pain} pain — ${leftData.interpretation}` : null, rightData ? `  Right: ${rightData.joint_line_pain} pain — ${rightData.interpretation}` : null, notesFrom(input, context) ? `  Notes: ${notesFrom(input, context)}` : null].filter(Boolean).join('\n');
  return completedPayload('thessaly_test', input, context, isPositive ? 1 : 0, soap, {
    left_data: leftData, right_data: rightData, positive_result: isPositive,
  });
}

function scoreApleys(input, context) {
  const trials = array(input.trials, 'trials', { minItems: 1, maxItems: 100 }).map((trial, index) => {
    const source = record(trial, `trials[${index}]`);
    const painLocation = choice(source.painLocation, `trials[${index}].painLocation`, ['medial', 'lateral', 'none']);
    const timestamp = text(source.timestamp, `trials[${index}].timestamp`, { required: true, max: 50 });
    invariant(Number.isFinite(Date.parse(timestamp)), `trials[${index}].timestamp must be an ISO date-time`);
    return { painLocation, timestamp };
  });
  const positiveTrials = trials.filter(({ painLocation }) => painLocation !== 'none').length;
  const soap = `• Apley's Compression Test\n  Positive Trials: ${positiveTrials}\n  Pain Locations: ${trials.map(({ painLocation }) => painLocation).join(', ')}`;
  return completedPayload('apleys_compression', input, context, positiveTrials, soap, {
    trials, positive_trials: positiveTrials,
  });
}

function normalizedCompactVitals(value, fieldName, { required = false } = {}) {
  const source = record(value ?? {}, fieldName);
  const heartRate = optionalInteger(source.heartRate, `${fieldName}.heartRate`, { min: 20, max: 300 });
  const bloodPressure = optionalBloodPressure(source.bloodPressure, `${fieldName}.bloodPressure`);
  if (required) invariant(heartRate !== null && bloodPressure !== null, `${fieldName} requires heart rate and blood pressure`);
  return { heartRate, bloodPressure };
}

function scoreLTest(input, context) {
  const trialTimesDeciseconds = numericArray(input.trialTimesDeciseconds, 'trialTimesDeciseconds', { minItems: 1, maxItems: 20, min: 0.1, max: 100000 });
  const trials = trialTimesDeciseconds.map((time) => round(time / 10, 2));
  const averageTime = round(mean(trials), 2);
  const bestTime = round(Math.min(...trials), 2);
  const preVitals = normalizedCompactVitals(input.preVitals, 'preVitals', { required: true });
  const postVitals = normalizedCompactVitals(input.postVitals, 'postVitals');
  const lines = ['• L Test of Functional Mobility:', `  Best Time: ${bestTime.toFixed(2)}s`, `  Average Time: ${averageTime.toFixed(2)}s over ${trials.length} trial(s)`, `  Individual Trials: ${trials.map((time, index) => `Trial ${index + 1}: ${time.toFixed(2)}s`).join(', ')}`, `  Pre-Test HR: ${preVitals.heartRate} bpm, BP: ${preVitals.bloodPressure}`];
  if (postVitals.heartRate !== null || postVitals.bloodPressure !== null) lines.push(`  Post-Test HR: ${postVitals.heartRate ?? '—'} bpm, BP: ${postVitals.bloodPressure ?? '—'}`);
  if (notesFrom(input, context)) lines.push(`  Clinical Notes: ${notesFrom(input, context)}`);
  return completedPayload('l_test', input, context, bestTime, lines.join('\n'), {
    trial_times_deciseconds: trialTimesDeciseconds, trials, best_time: bestTime, average_time: averageTime,
    pre_vitals: preVitals, post_vitals: postVitals,
  });
}

function scoreFigureEight(input, context) {
  const trialData = array(input.trialData, 'trialData', { minItems: 1, maxItems: 20 }).map((trial, index) => {
    const source = record(trial, `trialData[${index}]`);
    return { time: finiteNumber(source.time, `trialData[${index}].time`, { min: 0.01, max: 1000 }) };
  });
  const averageTime = round(mean(trialData.map(({ time }) => time)), 2);
  const interpretation = averageTime < 12 ? 'Normal dynamic balance' : averageTime < 16 ? 'Mild balance / turning deficit' : 'Significant deficit — elevated fall risk';
  const preVitals = normalizedCompactVitals(input.preVitals, 'preVitals');
  const postVitals = normalizedCompactVitals(input.postVitals, 'postVitals');
  const lines = ['• Figure of Eight Walk Test', `  Average Time: ${averageTime}s over ${trialData.length} trial(s)`, `  Interpretation: ${interpretation}`, ...trialData.map((trial, index) => `  Trial ${index + 1}: ${trial.time}s`)];
  if (preVitals.heartRate !== null || preVitals.bloodPressure !== null) lines.push(`  Pre-Test Vitals: HR ${preVitals.heartRate ?? '—'} bpm, BP ${preVitals.bloodPressure ?? '—'}`);
  if (postVitals.heartRate !== null || postVitals.bloodPressure !== null) lines.push(`  Post-Test Vitals: HR ${postVitals.heartRate ?? '—'} bpm, BP ${postVitals.bloodPressure ?? '—'}`);
  if (notesFrom(input, context)) lines.push(`  Notes: ${notesFrom(input, context)}`);
  return completedPayload('figure8', input, context, averageTime, lines.join('\n'), {
    trials: trialData, average_time: averageTime, interpretation, pre_vitals: preVitals, post_vitals: postVitals,
  });
}

const VISUAL_ROM_PERCENTAGES = Object.freeze([0, 10, 25, 50, 75, 100]);

function scoreVisualRom(input, context) {
  const selectedJointKeys = choiceArray(input.selectedJointKeys, 'selectedJointKeys', VISUAL_ROM_JOINTS.map(({ key }) => key));
  invariant(selectedJointKeys.length > 0, 'selectedJointKeys requires at least one joint');
  const sourceResults = record(input.results, 'results');
  invariant(Object.keys(sourceResults).every((key) => selectedJointKeys.includes(key)), 'results contains a joint that was not selected');
  const results = {};
  const completedValues = [];
  const soapLines = ['• Visual ROM Assessment', ''];
  for (const jointKey of selectedJointKeys) {
    const joint = VISUAL_ROM_JOINTS.find(({ key }) => key === jointKey);
    const jointSource = record(sourceResults[jointKey], `results.${jointKey}`);
    invariant(Object.keys(jointSource).every((movement) => joint.movements.includes(movement)), `results.${jointKey} contains an unsupported movement`);
    results[jointKey] = {};
    soapLines.push(`  ${joint.label}:`);
    joint.movements.forEach((movement, movementIndex) => {
      const source = record(jointSource[movement], `results.${jointKey}.${movement}`);
      const rom = finiteNumber(source.rom, `results.${jointKey}.${movement}.rom`, { min: 0, max: 100 });
      invariant(VISUAL_ROM_PERCENTAGES.includes(rom), `results.${jointKey}.${movement}.rom must use a production ROM band`);
      const pain = boolean(source.pain, `results.${jointKey}.${movement}.pain`);
      const note = text(source.note, `results.${jointKey}.${movement}.note`, { max: 2000 });
      results[jointKey][movement] = { rom, pain, note };
      completedValues.push(rom);
      soapLines.push(`    ${movement}: ${rom}% ROM (Normal: ${joint.normals[movementIndex]})${pain ? ' — PAIN reported' : ' — No pain'}${note ? ` | Note: ${note}` : ''}`);
    });
  }
  if (notesFrom(input, context)) soapLines.push('', `  Clinical Notes: ${notesFrom(input, context)}`);
  const meanRom = Math.round(mean(completedValues));
  return completedPayload('visual_rom', input, context, meanRom, soapLines.join('\n'), {
    results, joints_assessed: selectedJointKeys.map((key) => VISUAL_ROM_JOINTS.find((joint) => joint.key === key).label),
    selected_joint_keys: selectedJointKeys, completed_movements: completedValues.length, mean_rom_percent: meanRom,
  });
}

const SCORER_FUNCTIONS = Object.freeze({
  jta_icare: scoreJobTaskAnalysis,
  tug_full: scoreTug,
  sit_reach_test: scoreSitReach,
  chair_sit_reach: scoreChairReach,
  back_scratch_test: scoreBackScratch,
  functional_reach_test: scoreFunctionalReach,
  single_leg_stance_test: scoreSingleLegStance,
  sppb: scoreSppb,
  tandem_stand: scoreTandemStand,
  sebt: scoreSebt,
  ten_metre_walk: scoreTenMetreWalk,
  beighton: scoreBeighton,
  dual_task_gait: scoreDualTaskGait,
  plank: scorePlank,
  standing_stork: scoreStandingStork,
  med_ball: scoreMedicineBall,
  purdue_peg: scorePurduePeg,
  standing_long_jump: scoreStandingLongJump,
  illinois: scoreIllinois,
  t_test: scoreTTest,
  '505': scoreFiveOFive,
  hexagon: scoreHexagon,
  rsi: scoreRsi,
  '10sec_jump': scoreTenSecondJump,
  ckcuest_full: scoreCkcuest,
  isometric_testing: scoreIsometric,
  isokinetic_dyn: scoreIsokinetic,
  obers_test: scoreObers,
  slr_test: scoreSlr,
  slump_test: scoreSlump,
  lachman_test: scoreLachman,
  pivot_shift: scorePivotShift,
  mcmurrays_test: scoreMcmurray,
  thessaly_test: scoreThessaly,
  apleys_compression: scoreApleys,
  l_test: scoreLTest,
  figure8: scoreFigureEight,
  visual_rom: scoreVisualRom,
});

const FIXTURES = {
  jta_icare: {
    jobDate: '2026-08-22', role: 'Synthetic warehouse technician', roleDescription: 'Receives and dispatches equipment.',
    hoursInShift: 8, nightshift: 'No', rosterType: 'Weekdays', daysPerWeek: 5,
    environment: 'Indoor warehouse', movementsRequired: 'Walking, lifting and reaching', hazards: 'Uneven loads',
    equipmentNeeded: 'Trolley', basicNotes: 'Synthetic fixture',
    topTasks: [
      { task: 'Transfer crates', requirement: 'Lift and carry', weight: '12 kg', duration: '20 minutes', supportAvailable: 'Yes' },
      { task: 'Receive equipment', requirement: 'Stand and reach', weight: '4 kg', duration: '45 minutes', supportAvailable: 'No' },
      { task: 'Dispatch equipment', requirement: 'Push trolley', weight: '60 kg trolley load', duration: '30 minutes', supportAvailable: 'Yes' },
    ],
    physicalFrequencies: { walking: 'C', lifting: 'F' }, hazardFrequencies: { slippery_surfaces: 'I' },
    clinicalObservations: 'Controlled technique observed.', otherComments: 'No additional comments.',
  },
  tug_full: { trials: [{ time: 11.4, assistiveDevice: 'none', steps: 12, observations: 'Independent turn.' }, { time: 10.8, assistiveDevice: 'none', steps: 11, observations: 'Stable.' }] },
  sit_reach_test: { trials: [28, 31, 30], boxOffset: 23, age: 42, gender: 'female', notes: 'Knees maintained.' },
  chair_sit_reach: { trials: [3.5, 5, 4.5], age: 68, gender: 'male', notes: 'Right leg tested.' },
  back_scratch_test: { leftTrials: [-4, -2], rightTrials: [1, 2], age: 66, gender: 'female', notes: 'No pain.' },
  functional_reach_test: { trials: [26, 28, 27], notes: 'No stepping strategy.' },
  single_leg_stance_test: { leftTrials: [18, 21], rightTrials: [24, 22], notes: 'Eyes open.' },
  sppb: {
    balance: { sideBySide: true, semiTandem: true, tandemResult: '10+' },
    gait: { walkDistance: 4, trial1: 4.6, trial2: 4.3, aidUsed: false, deviations: ['Reduced arm swing'] },
    chair: { singleRiseAble: true, standTime: 12.4, stoppedEarly: false },
    setup: {
      assistiveDevice: 'none', shoesOff: 'off', surface: 'floor', baselinePain: 1, baselineFatigue: 2,
      safetyChecks: { safe_stand: true, safe_walk: true, no_dizziness: true, no_cv: true, no_severe_pain: true, walking_aid: false, consent: true },
      safetyDone: true,
    },
    domainNotes: { balance: 'Stable', gait: 'Independent', chair: 'Arms crossed' },
  },
  tandem_stand: { trials: [8.2, 10], notes: 'Second trial complete.' },
  sebt: { legTested: 'right', legLength: 92, reaches: { Anterior: 64, Anterolateral: 70, Lateral: 72, Posterolateral: 83, Posterior: 85, Posteromedial: 81, Medial: 69, Anteromedial: 66 }, notes: 'Foot maintained.' },
  ten_metre_walk: { trials: [{ time: 8.2 }, { time: 7.8 }], pace: 'comfortable', ageGroup: '40–49', gender: 'female', notes: 'No aid.' },
  beighton: { scores: { leftLittleFinger: true, rightLittleFinger: true, leftThumb: false, rightThumb: false, leftElbow: true, rightElbow: false, leftKnee: true, rightKnee: false, trunkFlexion: true }, notes: 'Bilateral comparison.' },
  dual_task_gait: { singleTaskTime: 8.2, dualTaskTime: 10.4, cognitiveTask: 'Count backwards by threes', notes: 'One cognitive error.' },
  plank: { testAttempts: [98, 112], clientAge: 46, clientSex: 'male', notes: 'Stopped for fatigue.' },
  standing_stork: {
    leftData: {
      trials: [18, 22],
      observations: { loss_of_balance: false, excessive_sway: true, hip_drop: false, required_guarding: false },
      quality_scores: { postural_control: 3, stability: 3, tremor: 3 },
    },
    rightData: {
      trials: [24, 26],
      observations: { loss_of_balance: false, excessive_sway: false, hip_drop: false, required_guarding: false },
      quality_scores: { postural_control: 4, stability: 4, tremor: 4 },
    },
    setup: { shoes: 'off', surface: 'firm', eyes: 'open', dominant: 'right', confidence: 5, pain: 0, dizziness: 0 },
    clientAge: 44,
    safety: { safe_standing: true, no_dizziness: true, no_pain: true, no_recent_fall: true, weight_bear_ok: true, aid_nearby: true, consent: true },
    notes: 'Hands on hips.',
  },
  med_ball: { trials: [4.2, 4.6, 4.4], preTestVitals: { systolic: 118, diastolic: 72, heartRate: 66 }, postTestVitals: { systolic: 132, diastolic: 76, heartRate: 96 }, notes: 'Seated chest throw.' },
  purdue_peg: { scores: { rightHand: 15, leftHand: 14, bothHands: 12, assembly: 32 }, clientAge: 39, clientSex: 'female', notes: 'No dropped pieces.' },
  standing_long_jump: { trials: [188, 196, 193], gender: 'Female', age: 27, notes: 'Stable landing.' },
  illinois: { trialTimes: [17.4, 16.9, 17.1], notes: 'Second trial best.' },
  t_test: {
    trialResults: [{ time: 10.8, invalid: false, invalidReason: '', trialNum: 1 }, { time: 10.5, invalid: false, invalidReason: '', trialNum: 2 }],
    quality: { acceleration: 3, deceleration: 3, lateral_shuffle: 4, foot_placement: 3, cod_control: 3, knee_valgus: 3, trunk_control: 4, arm_coordination: 3, turning_efficiency: 3 },
    setup: { surface: 'Indoor court', footwear: 'Trainers', indoor: true, dominantLeg: 'Right', injuredSide: 'None', testingSport: 'Synthetic field sport', warmupDone: true, sprintConfidence: 7, fatigueLevel: 2 },
    safety: { cleared_running: true, no_acute_pain: true, no_instability: true, no_swelling: true, warmup_done: true, safe_footwear: true, safe_surface: true, consent: true },
    gender: 'female', notes: 'Movement quality maintained.',
  },
  '505': { trials: [{ direction: 'Left', time: 2.52 }, { direction: 'Right', time: 2.38 }, { direction: 'Left', time: 2.44 }], dominantLeg: 'Right', notes: 'No slips.' },
  hexagon: { trials: [13.8, 13.2, 13.5], gender: 'male', notes: 'Three circuits complete.' },
  rsi: { trials: [{ jumpHeight: 38, contactTime: 190 }, { jumpHeight: 41, contactTime: 185 }], dropHeight: 30, notes: 'Drop landing controlled.' },
  '10sec_jump': { jumps: [{ flight_time_ms: 420, contact_time_ms: 230, jump_height_cm: 22 }, { flight_time_ms: 405, contact_time_ms: 240, jump_height_cm: 20 }, { flight_time_ms: 390, contact_time_ms: 245, jump_height_cm: 18 }], notes: 'Cadence maintained.' },
  ckcuest_full: { trials: [20, 22, 21], notes: 'Standard 36-inch spacing.' },
  isometric_testing: {
    tests: [
      { id: 1, muscle: 'knee_extension_right', trial1: 310, trial2: 325, trial3: 318, angle: '60°' },
      { id: 2, muscle: 'knee_extension_left', trial1: 296, trial2: 302, trial3: 300, angle: '60°' },
    ], notes: 'Handheld dynamometer fixed with strap.',
  },
  isokinetic_dyn: {
    joint: 'Knee Flexion/Extension', device: 'Synthetic dynamometer', preHR: 68, postHR: 102,
    sets: [
      { side: 'right', speed: '60°/s', customSpeed: '', peakTorque: 182, avgTorque: 156, work: 420, power: 310, reps: 5 },
      { side: 'left', speed: '180°/s', customSpeed: '', peakTorque: 168, avgTorque: 142, work: 390, power: 340, reps: 10 },
    ], notes: 'Gravity correction applied.',
  },
  obers_test: { bilateralResults: { left: 'positive', right: 'negative' }, preTestVitals: { systolic: 116, diastolic: 72, heartRate: 65 }, postTestVitals: { systolic: 120, diastolic: 74, heartRate: 70 }, notes: 'Pelvis stabilised.' },
  slr_test: {
    left: { onsetAngle: 48, maxAngle: 62, symptomTypes: ['Sciatic pain', 'Tingling'], painSeverity: 5, painDistribution: ['Posterior thigh', 'Below knee'], familiarReproduced: 'Yes', positive: 'Yes', endFeel: 'Neural tension' },
    right: { onsetAngle: null, maxAngle: 82, symptomTypes: ['None'], painSeverity: 0, painDistribution: [], familiarReproduced: 'No', positive: 'No', endFeel: 'Soft tissue restriction' },
    modifiers: { ankle_df: 'Symptoms increased', cervical_flex: 'Symptoms unchanged' }, baselinePain: 2,
    symptomaticSide: 'Left', safetyFlags: [], setup: { surface: 'Plinth', shoesOff: 'Shoes off', warmupDone: 'Yes', consentObtained: true, safetyDone: true }, notes: 'Left familiar symptoms reproduced.',
  },
  slump_test: {
    leftData: { kneeAngle: 35, painSeverity: 5, symptomTypes: ['Sciatic-type pain', 'Tingling'], symptomLocations: ['Posterior thigh', 'Posterior calf'], belowKnee: true, familiarSymptoms: true, cervicalResponse: 'decreased', positive: true, dorsiflex: 'increased' },
    rightData: { kneeAngle: 15, painSeverity: 1, symptomTypes: ['Hamstring stretch'], symptomLocations: ['Posterior thigh'], belowKnee: false, familiarSymptoms: false, cervicalResponse: 'unchanged', positive: false, dorsiflex: 'unchanged' },
    symptomaticSide: 'left', baselinePain: 2, irritability: 5,
    diffModifiers: { cervicalExtension: 'decreased', plantarflexion: 'decreased', reducedSlump: 'decreased', hipReposition: 'unchanged' },
    stageCompleted: { '1': true, '2': true, '3': true, '4': true, '5': true },
    stageSymptoms: { '1': 'No change', '2': 'Mild increase', '3': 'Familiar symptoms', '4': 'Increased', '5': 'Decreased' },
    setup: { surface: 'plinth', safetyDone: true, safetyChecks: { consent: true, can_tolerate_sitting: true } }, notes: 'Symptoms resolved on release.',
  },
  lachman_test: { kneeFlexion: 25, laxityGrade: '2', endFeel: 'soft', notes: 'Compared with contralateral side.' },
  pivot_shift: { leftGrade: 0, rightGrade: 2, notes: 'Right clunk reproduced.' },
  mcmurrays_test: { medialResults: ['positive', 'negative'], lateralResults: ['negative', 'negative'], preTestVitals: { systolic: 118, diastolic: 72, heartRate: 66 }, postTestVitals: { systolic: 122, diastolic: 74, heartRate: 72 }, notes: 'Medial click on first trial.' },
  thessaly_test: { leftData: { joint_line_pain: 'medial', mechanical_symptoms: 'catching', pain_intensity: 'moderate' }, rightData: { joint_line_pain: 'none', mechanical_symptoms: 'none', pain_intensity: 'none' }, notes: 'Tested at 20° flexion.' },
  apleys_compression: { trials: [{ painLocation: 'medial', timestamp: '2026-08-22T01:02:03.000Z' }, { painLocation: 'none', timestamp: '2026-08-22T01:02:10.000Z' }], notes: 'Medial pain with external rotation.' },
  l_test: { trialTimesDeciseconds: [215, 208, 212], preVitals: { heartRate: 68, bloodPressure: '118/72' }, postVitals: { heartRate: 91, bloodPressure: '132/76' }, notes: 'Independent with single-point stick.' },
  figure8: { trialData: [{ time: 12.8 }, { time: 12.2 }], preVitals: { heartRate: 66, bloodPressure: '116/70' }, postVitals: { heartRate: 78, bloodPressure: '124/72' }, notes: 'One extra step on first turn.' },
  visual_rom: {
    selectedJointKeys: ['cervical'],
    results: { cervical: {
      Flexion: { rom: 75, pain: false, note: '' }, Extension: { rom: 50, pain: true, note: 'End-range pain' },
      'Lat. Flexion (L)': { rom: 75, pain: false, note: '' }, 'Lat. Flexion (R)': { rom: 75, pain: false, note: '' },
      'Rotation (L)': { rom: 100, pain: false, note: '' }, 'Rotation (R)': { rom: 75, pain: false, note: '' },
    } },
    notes: 'Visual estimate recorded against listed reference ranges.',
  },
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
