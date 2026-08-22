import {
  buildCompletedPayload,
  requireChoice,
  requireFiniteNumber,
  requireInteger,
} from './contract.js';

export const RUNNER_KEYS = Object.freeze([
  'range-of-motion',
  'manual-muscle-testing',
  'pain-scales',
  'single-leg-stance',
  'berg-balance',
  'hand-grip',
  'clinical-frailty-scale',
  'four-meter-gait-speed',
  'y-balance',
  'habitual-gait-speed',
  'fast-gait-speed',
  'four-stage-balance',
  'modified-thomas',
  'single-leg-hop',
  'one-minute-sit-to-stand',
  'groc',
  'four-square-step',
  'ctsib',
  'clock-drawing',
  'general-movement-screen',
  'tinetti',
  'six-minute-walk',
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`Core-A assessment scorer: ${message}`);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function round(value, digits = 2) {
  const result = Number(Number(value).toFixed(digits));
  invariant(Number.isFinite(result), 'calculated result must be finite');
  return result;
}

function field(key, label, type, required = true, extra = {}) {
  return { key, label, type, required, ...extra };
}

function options(entries) {
  return entries.map(([label, value]) => ({ label, value }));
}

function numberField(key, label, required = true, min = 0, max = 10000, step = 0.1, unit = '') {
  return field(key, label, 'number', required, { min, max, step, unit });
}

function choiceField(key, label, entries, required = true) {
  return field(key, label, 'select', required, { options: options(entries) });
}

function objectField(key, label, fields, required = true) {
  return field(key, label, 'object', required, { fields });
}

function arrayField(key, label, itemSchema, minItems, maxItems, required = true) {
  return field(key, label, 'array', required, { minItems, maxItems, itemSchema });
}

function defineSpec({ runnerKey, name, measurementType, primaryField, unit, formula, fields }) {
  return deepFreeze({
    schemaVersion: 1,
    kind: 'measurement',
    runnerKey,
    scoringKey: runnerKey,
    name,
    measurementType,
    fields,
    scoring: {
      method: 'pure-validated-runtime-scorer',
      version: `${runnerKey}.v1`,
      formula,
      validation: 'Every required value, nested field, choice, bound and protocol relationship is validated before persistence.',
    },
    result: {
      primaryField,
      unit,
      additionalDataFields: [
        'measurement_type', 'scoring_key', 'scoring_version', 'raw_input',
        'interpretation', 'soap_text', 'report_text',
      ],
    },
  });
}

function text(value, fieldName, { required = false, max = 4000 } = {}) {
  const result = String(value ?? '').trim();
  invariant(!required || result.length > 0, `${fieldName} is required`);
  invariant(result.length <= max, `${fieldName} must be ${max} characters or fewer`);
  return result;
}

function optionalNumber(value, fieldName, limits) {
  if (value === '' || value === null || value === undefined) return null;
  return requireFiniteNumber(value, fieldName, limits);
}

function requiredObject(value, fieldName) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), `${fieldName} must be an object`);
  return value;
}

function requiredArray(value, fieldName, min = 1, max = 100) {
  invariant(Array.isArray(value), `${fieldName} must be an array`);
  invariant(value.length >= min && value.length <= max, `${fieldName} must contain between ${min} and ${max} entries`);
  return value;
}

function contextFor(input, context, fallbackName) {
  return {
    ...context,
    assessmentName: context?.assessmentName || fallbackName,
    assessmentDate: context?.assessmentDate || input?.assessment_date,
    notes: context?.notes ?? input?.notes ?? '',
  };
}

function finish({ key, name, type, input, context, result, interpretation, soap, extra = {} }) {
  const report = `${name}\nResult: ${result}${RUNNER_SPEC_BY_KEY[key].result.unit ? ` ${RUNNER_SPEC_BY_KEY[key].result.unit}` : ''}\nInterpretation: ${interpretation}\n\n${soap}`;
  return buildCompletedPayload({
    context: contextFor(input, context, name),
    resultValue: result,
    measurementType: type,
    scoringKey: key,
    scoringVersion: `${key}.v1`,
    rawInput: input,
    soapText: soap,
    additionalData: { interpretation, report_text: report, ...extra },
  });
}

export const ROM_JOINTS = deepFreeze([
  ['cervical_spine', 'Cervical Spine', ['Flexion', 'Extension', 'Lateral Flexion (Left)', 'Lateral Flexion (Right)', 'Rotation (Left)', 'Rotation (Right)']],
  ['thoracic_spine', 'Thoracic Spine', ['Rotation (Left)', 'Rotation (Right)', 'Extension', 'Lateral Flexion (Left)', 'Lateral Flexion (Right)']],
  ['lumbar_spine', 'Lumbar Spine', ['Flexion', 'Extension', 'Lateral Flexion (Left)', 'Lateral Flexion (Right)', 'Rotation (Left)', 'Rotation (Right)']],
  ['shoulder', 'Shoulder (Glenohumeral)', ['Flexion', 'Extension', 'Abduction', 'Adduction', 'External Rotation (90° Abducted)', 'Internal Rotation (90° Abducted)', 'Hand Behind Back (HBB)', 'Hand Behind Head (HBH)']],
  ['elbow', 'Elbow & Forearm', ['Flexion', 'Extension', 'Supination', 'Pronation']],
  ['wrist', 'Wrist & Hand', ['Wrist Flexion', 'Wrist Extension', 'Radial Deviation', 'Ulnar Deviation', 'Finger MCP Flexion', 'Finger PIP Flexion', 'Finger DIP Flexion', 'Thumb CMC Abduction', 'Thumb MCP Flexion', 'Thumb IP Flexion']],
  ['hip', 'Hip', ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Internal Rotation', 'External Rotation']],
  ['knee', 'Knee', ['Flexion', 'Extension']],
  ['ankle', 'Ankle', ['Dorsiflexion', 'Plantarflexion', 'Inversion', 'Eversion']],
  ['foot_toes', 'Foot & Toes', ['1st MTP Extension (Dorsiflexion)', '1st MTP Flexion', 'Toe IP Flexion', 'Toe IP Extension']],
]);

const ROM_MOVEMENT_KEYS = deepFreeze(Object.fromEntries(ROM_JOINTS.map(([joint, , movements]) => [joint, movements])));
const ALL_ROM_MOVEMENTS = [...new Set(ROM_JOINTS.flatMap(([, , movements]) => movements))];
const ROM_MEASUREMENT_FIELDS = ALL_ROM_MOVEMENTS.map((movement) => objectField(
  movement,
  movement,
  [numberField('left', 'Left', false, -360, 360, 0.1, 'degrees'), numberField('right', 'Right', false, -360, 360, 0.1, 'degrees')],
  false,
));
const ROM_COMMENT_FIELDS = ALL_ROM_MOVEMENTS.map((movement) => field(movement, movement, 'textarea', false));

export const MMT_GRADES = deepFreeze([
  { value: 0, label: '0 - No contraction', description: 'No visible or palpable muscle contraction' },
  { value: 1, label: '1 - Trace', description: 'Slight contraction felt, no movement' },
  { value: 2, label: '2 - Poor', description: 'Full ROM with gravity eliminated' },
  { value: 3, label: '3 - Fair', description: 'Full ROM against gravity only' },
  { value: 4, label: '4 - Good', description: 'Full ROM against moderate resistance' },
  { value: 5, label: '5 - Normal', description: 'Full ROM against maximal resistance' },
]);

export const MMT_MUSCLE_GROUPS = deepFreeze({
  Shoulder: ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Internal Rotation', 'External Rotation'],
  Elbow: ['Flexion', 'Extension', 'Supination', 'Pronation'],
  Wrist: ['Flexion', 'Extension', 'Radial Deviation', 'Ulnar Deviation'],
  Hip: ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Internal Rotation', 'External Rotation'],
  Knee: ['Flexion', 'Extension'],
  Ankle: ['Dorsiflexion', 'Plantarflexion', 'Inversion', 'Eversion'],
  Trunk: ['Flexion', 'Extension', 'Lateral Flexion Left', 'Lateral Flexion Right', 'Rotation Left', 'Rotation Right'],
  Neck: ['Flexion', 'Extension', 'Lateral Flexion Left', 'Lateral Flexion Right', 'Rotation Left', 'Rotation Right'],
});

export const BERG_ITEMS = deepFreeze([
  'Sitting to Standing', 'Standing Unsupported', 'Sitting Unsupported', 'Standing to Sitting',
  'Transfers', 'Standing with Eyes Closed', 'Standing with Feet Together', 'Reaching Forward',
  'Retrieving Object from Floor', 'Turning to Look Behind', 'Turning 360 Degrees',
  'Placing Alternate Foot on Stool', 'Standing with One Foot in Front', 'Standing on One Foot',
].map((name, index) => ({ key: `item_${index + 1}`, id: index + 1, name })));

export const CLINICAL_FRAILTY_LEVELS = deepFreeze([
  [1, 'Very Fit', 'Robust, active, energetic, motivated and fit. These people commonly exercise regularly and are among the fittest for their age.'],
  [2, 'Well', 'No active disease symptoms, but less fit than level 1. Often exercises or very active occasionally.'],
  [3, 'Managing Well', 'Medical problems are well controlled, but not regularly active beyond routine walking.'],
  [4, 'Vulnerable', 'Not dependent on others, but symptoms often limit activities, commonly slowing down or fatigue.'],
  [5, 'Mildly Frail', 'More evident slowing and help needed with high-order instrumental activities of daily living.'],
  [6, 'Moderately Frail', 'Help needed with outside activities and keeping house; often problems with stairs and bathing.'],
  [7, 'Severely Frail', 'Completely dependent for personal care but otherwise stable.'],
  [8, 'Very Severely Frail', 'Completely dependent and approaching end of life; unlikely to recover from minor illness.'],
  [9, 'Terminally Ill', 'Approaching end of life with life expectancy under six months and not otherwise evidently frail.'],
].map(([score, label, description]) => ({ score, label, description })));

export const GROC_LEVELS = deepFreeze([
  [-7, 'A very great deal worse'], [-6, 'A great deal worse'], [-5, 'Quite a bit worse'],
  [-4, 'Moderately worse'], [-3, 'Somewhat worse'], [-2, 'A little worse'], [-1, 'A tiny bit worse'],
  [0, 'About the same (no change)'], [1, 'A tiny bit better'], [2, 'A little better'],
  [3, 'Somewhat better'], [4, 'Moderately better'], [5, 'Quite a bit better'],
  [6, 'A great deal better'], [7, 'A very great deal better'],
].map(([score, label]) => ({ score, label })));

export const CTSIB_CONDITIONS = deepFreeze([
  ['firm_eyes_open', 'Firm Surface, Eyes Open'],
  ['firm_eyes_closed', 'Firm Surface, Eyes Closed'],
  ['foam_eyes_open', 'Foam Surface, Eyes Open'],
  ['foam_eyes_closed', 'Foam Surface, Eyes Closed'],
]);

export const FOUR_STAGE_STAGES = deepFreeze([
  ['side_by_side', 'Side-by-Side Stance'], ['semi_tandem', 'Semi-Tandem Stance'],
  ['tandem', 'Tandem Stance'], ['single_leg', 'Single Leg Stance'],
]);

export const GMS_TESTS = deepFreeze([
  ['squat', 'Deep Squat'], ['hip_hinge', 'Hip Hinge'], ['lunge', 'Step & Lunge (L & R)'],
  ['single_leg_stand', 'Single Leg Stand (L & R)'], ['push_up', 'Push-Up'],
  ['shoulder_mob', 'Shoulder Mobility (L & R)'], ['trunk_rotation', 'Trunk Rotation (L & R)'],
  ['hip_mob', 'Hip Mobility / 4-Point Rock'], ['overhead_reach', 'Overhead Reach / Wall Angel'],
].map(([key, label]) => ({ key, label })));

export const CLOCK_SIMPLE_OPTIONS = deepFreeze([
  [5, 'Perfect clock: correct circle, numbers in correct order and placement, correct time shown'],
  [4, 'Minor spacing errors but numbers and time correct'],
  [3, 'Numbers correct but poorly spaced OR hands incorrect'],
  [2, 'Numbers missing, repeated, or severely misplaced'],
  [1, 'Very poor representation of a clock'], [0, 'No attempt or not recognizable as a clock'],
].map(([score, label]) => ({ score, label })));

export const CLOCK_TEN_POINT_ITEMS = deepFreeze([
  ['closedCircle', 'Closed circle drawn', 1], ['allNumbers', 'All numbers present', 1],
  ['numbersOrder', 'Numbers in correct order', 1], ['numbersPositioned', 'Numbers correctly positioned', 1],
  ['onlyOneToTwelve', 'Only numbers 1–12 used', 1], ['twoHands', 'Two hands drawn', 1],
  ['correctTime', 'Correct time shown', 2], ['hourMinuteDist', 'Hour/minute distinction correct', 1],
  ['handsCentered', 'Hands centered correctly', 1],
].map(([key, label, points]) => ({ key, label, points })));

export const CLOCK_ABNORMAL_PATTERNS = deepFreeze([
  'Numbers all on one side (visuospatial deficit)', 'Wrong time but good clock (executive function issue)',
  'Hands reversed or same length (conceptual deficit)', 'Random numbers or letters (delirium/severe dementia)',
  'Cannot start the task (executive dysfunction)',
]);

// The production UI consumes these exact definitions. The 10 scored balance
// entries represent the nine POMA balance tasks because turning 360 degrees
// has separate step-continuity and steadiness scores. This makes the declared
// balance maximum of 16 and total maximum of 28 reachable and deterministic.
export const TINETTI_BALANCE_ITEMS = deepFreeze([
  ['1. Sitting Balance', 'Observe the patient seated in a hard, armless chair. Watch for trunk lean, sliding, or loss of an unsupported upright position.', [['Leans or slides in chair', 0], ['Steady, safe', 1]]],
  ['2. Arises', 'Ask the patient to stand from the chair. Observe whether arm support is needed.', [['Unable without help', 0], ['Able, uses arms to help', 1], ['Able without using arms', 2]]],
  ['3. Attempts to Arise', 'Record whether the patient is unable without help, needs more than one attempt, or rises in one attempt.', [['Unable without help', 0], ['Able, requires more than one attempt', 1], ['Able to rise in one attempt', 2]]],
  ['4. Immediate Standing Balance (first 5 seconds)', 'Observe immediately after rising for staggering, foot movement, trunk sway, or use of support.', [['Unsteady (staggers, moves feet, trunk sway)', 0], ['Steady but uses walker or other support', 1], ['Steady without walker or other support', 2]]],
  ['5. Standing Balance', 'With the patient standing, observe steadiness, stance width, and use of a cane or other support.', [['Unsteady', 0], ['Steady but wide stance (medial heels more than 10 cm apart) and uses cane or other support', 1], ['Narrow stance without support', 2]]],
  ['6. Nudged — Sternal Push (×3)', 'Stand close. With the feet as close together as possible, push lightly on the sternum three times and observe the postural response.', [['Begins to fall', 0], ['Staggers, grabs, catches self', 1], ['Steady', 2]]],
  ['7. Eyes Closed (at position from item 6)', 'At the same standing position, ask the patient to close their eyes and observe steadiness.', [['Unsteady', 0], ['Steady', 1]]],
  ['8a. Turning 360° — Steps', 'Ask the patient to turn a full circle and observe whether the steps are discontinuous or continuous.', [['Discontinuous steps', 0], ['Continuous steps', 1]]],
  ['8b. Turning 360° — Steadiness', 'During the same turn, observe whether the patient grabs, staggers, or remains steady.', [['Unsteady (grabs, staggers)', 0], ['Steady', 1]]],
  ['9. Sitting Down', 'Observe the return to sitting for distance judgement, arm use, smoothness, and control.', [['Unsafe (misjudges distance, falls into chair)', 0], ['Uses arms or not a smooth motion', 1], ['Safe, smooth motion', 2]]],
].map(([name, tip, itemOptions], index) => ({ key: `balance_${index + 1}`, name, tip, options: options(itemOptions) })));

export const TINETTI_GAIT_ITEMS = deepFreeze([
  ["1. Gait Initiation (immediately after told to 'Go')", 'Ask the patient to begin walking at their normal pace. Observe hesitancy or multiple attempts to start.', [['Any hesitancy or multiple attempts to start', 0], ['No hesitancy, single fluid initiation', 1]]],
  ['2. Right Swing Foot — Step Length', 'Observe whether the right swing foot passes the left stance foot.', [['Does not pass left stance foot', 0], ['Passes left stance foot', 1]]],
  ['3. Right Swing Foot — Step Height (foot clearance)', 'Observe whether the right foot clears the floor completely during swing.', [['Right foot does not clear floor completely', 0], ['Right foot clears floor completely', 1]]],
  ['4. Left Swing Foot — Step Length', 'Observe whether the left swing foot passes the right stance foot.', [['Does not pass right stance foot', 0], ['Passes right stance foot', 1]]],
  ['5. Left Swing Foot — Step Height (foot clearance)', 'Observe whether the left foot clears the floor completely during swing.', [['Left foot does not clear floor completely', 0], ['Left foot clears floor completely', 1]]],
  ['6. Step Symmetry', 'Compare right and left step lengths throughout the walk.', [['Right and left step length not equal (asymmetrical)', 0], ['Right and left step length appears equal', 1]]],
  ['7. Step Continuity', 'Observe for stopping or discontinuity between steps.', [['Stopping or discontinuity between steps', 0], ['Steps appear continuous', 1]]],
  ['8. Path Deviation (observe over ~3 metres)', 'Observe excursion from a straight walking path and any use of a walking aid.', [['Marked deviation', 0], ['Mild/moderate deviation or uses assistive device', 1], ['Straight without assistive device', 2]]],
  ['9. Trunk Stability', 'Observe trunk sway, knee or back flexion, arm spreading, and use of a walking aid.', [['Marked sway or uses assistive device', 0], ['No sway but flexes knees/back or spreads arms while walking', 1], ['No sway, no assistive device, no compensatory movements', 2]]],
  ['10. Walking Stance (base width)', 'Observe heel separation while walking.', [['Heels apart (wide base)', 0], ['Heels almost touching while walking', 1]]],
].map(([name, tip, itemOptions], index) => ({ key: `gait_${index + 1}`, name, tip, options: options(itemOptions) })));

const YES_NO = [['Yes', true], ['No', false]];
const SIDE = [['Left', 'left'], ['Right', 'right']];
const ZERO_TO_FIVE = Array.from({ length: 6 }, (_, value) => [String(value), value]);
const ZERO_TO_TEN = Array.from({ length: 11 }, (_, value) => [String(value), value]);
const ZERO_TO_THREE = Array.from({ length: 4 }, (_, value) => [String(value), value]);
const BERG_SCORE_OPTIONS = [["4 - Independent", 4], ["3 - Minimal assistance", 3], ["2 - Moderate assistance", 2], ["1 - Maximal assistance", 1], ["0 - Unable", 0]];
const VITALS_FIELDS = [
  numberField('heart_rate', 'Heart rate', false, 20, 300, 1, 'bpm'),
  numberField('oxygen_saturation', 'Oxygen saturation', false, 0, 100, 1, '%'),
];

const SPECS = [
  defineSpec({
    runnerKey: 'range-of-motion', name: 'Range of Motion (Goniometry)', measurementType: 'rom_assessment',
    primaryField: 'measurement_count', unit: 'measurements', formula: 'Count of finite left/right joint movement measurements recorded.',
    fields: [
      choiceField('joint', 'Joint or region', ROM_JOINTS.map(([value, label]) => [label, value])),
      objectField('measurements', 'Movement measurements', ROM_MEASUREMENT_FIELDS),
      objectField('comments', 'Movement comments', ROM_COMMENT_FIELDS, false),
    ],
  }),
  defineSpec({
    runnerKey: 'manual-muscle-testing', name: 'Manual Muscle Testing', measurementType: 'manual_muscle_testing',
    primaryField: 'average_grade', unit: '/5', formula: 'Arithmetic mean of all recorded Oxford/MRC grades.',
    fields: [arrayField('tests', 'Muscle tests', objectField('test', 'Muscle test', [
      choiceField('region', 'Region', Object.keys(MMT_MUSCLE_GROUPS).map((value) => [value, value])),
      choiceField('movement', 'Movement', [...new Set(Object.values(MMT_MUSCLE_GROUPS).flat())].map((value) => [value, value])),
      choiceField('side', 'Side', SIDE), choiceField('grade', 'Grade', MMT_GRADES.map(({ label, value }) => [label, value])),
      field('notes', 'Test notes', 'textarea', false),
    ]), 1, 100), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'pain-scales', name: 'Pain Rating Scales', measurementType: 'pain_scales',
    primaryField: 'average_pain', unit: '/10', formula: 'Current pain, or mean of current/best/worst when both optional 24-hour values are recorded.',
    fields: [choiceField('scale_type', 'Scale', [['Numeric Pain Rating Scale (NPRS)', 'nprs'], ['Visual Analogue Scale (VAS)', 'vas']]),
      numberField('current_pain', 'Current pain', true, 0, 10, 1, '/10'), numberField('best_pain', 'Best pain in 24 hours', false, 0, 10, 1, '/10'),
      numberField('worst_pain', 'Worst pain in 24 hours', false, 0, 10, 1, '/10'), field('pain_location', 'Pain location', 'text', false), field('notes', 'Notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'single-leg-stance', name: 'Single Leg Stance Test', measurementType: 'single_leg_stance',
    primaryField: 'best_time', unit: 'seconds', formula: 'Best valid trial time across recorded side and vision conditions.',
    fields: [arrayField('trials', 'Trials', objectField('trial', 'Trial', [choiceField('side', 'Stance leg', SIDE),
      choiceField('eyes_open', 'Vision', [['Eyes open', true], ['Eyes closed', false]]), numberField('time', 'Time', true, 0, 60, 0.01, 'seconds')]), 1, 12), field('notes', 'Notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'berg-balance', name: 'Berg Balance Scale', measurementType: 'berg_balance',
    primaryField: 'total', unit: '/56', formula: 'Sum of 14 required item scores, each 0–4.',
    fields: [objectField('scores', 'Berg item scores', BERG_ITEMS.map(({ key, name }) => choiceField(key, name, BERG_SCORE_OPTIONS))), field('notes', 'Notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'hand-grip', name: 'Hand Grip Strength', measurementType: 'hand_grip_strength',
    primaryField: 'dominant_best', unit: 'kg', formula: 'Maximum of three dominant-hand trials; non-dominant best is retained.',
    fields: [choiceField('dominant_hand', 'Dominant hand', [['Right', 'right'], ['Left', 'left']]),
      ...[1, 2, 3].map((n) => numberField(`dominant_trial_${n}`, `Dominant trial ${n}`, true, 0, 200, 0.1, 'kg')),
      ...[1, 2, 3].map((n) => numberField(`non_dominant_trial_${n}`, `Non-dominant trial ${n}`, true, 0, 200, 0.1, 'kg')),
      field('notes', 'Notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'clinical-frailty-scale', name: 'Clinical Frailty Scale', measurementType: 'clinical_frailty_scale',
    primaryField: 'score', unit: '/9', formula: 'Selected Rockwood 1–9 level.',
    fields: [choiceField('score', 'Frailty level', CLINICAL_FRAILTY_LEVELS.map(({ score, label }) => [`${score} - ${label}`, score])), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  ...['four-meter-gait-speed', 'habitual-gait-speed', 'fast-gait-speed'].map((runnerKey) => defineSpec({
    runnerKey, name: runnerKey === 'four-meter-gait-speed' ? '4-Meter Gait Speed' : runnerKey === 'fast-gait-speed' ? 'Fast Gait Speed' : 'Habitual Gait Speed',
    measurementType: 'gait_speed', primaryField: 'average_speed', unit: 'm/s', formula: 'Mean of per-trial distance divided by elapsed time.',
    fields: [numberField('distance', 'Course distance', true, 1, 100, 0.1, 'm'), arrayField('trials', 'Trials', objectField('trial', 'Trial', [
      numberField('time', 'Elapsed time', true, 0.01, 600, 0.01, 'seconds'), numberField('distance', 'Distance', true, 1, 100, 0.1, 'm'),
    ]), 1, 20), field('notes', 'Notes', 'textarea', false)],
  })),
  defineSpec({
    runnerKey: 'y-balance', name: 'Y-Balance Test', measurementType: 'y_balance', primaryField: 'best_composite', unit: '%',
    formula: 'For each side: sum of three reaches / (3 × limb length) × 100; primary result is the larger composite.',
    fields: [numberField('limb_length_left', 'Left limb length', true, 1, 200, 0.1, 'cm'), numberField('limb_length_right', 'Right limb length', true, 1, 200, 0.1, 'cm'),
      ...['left_anterior', 'left_posteromedial', 'left_posterolateral', 'right_anterior', 'right_posteromedial', 'right_posterolateral'].map((key) => numberField(key, key.replaceAll('_', ' '), true, 0, 300, 0.1, 'cm')),
      field('notes', 'Notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'four-stage-balance', name: '4-Stage Balance Test', measurementType: 'four_stage_balance_test', primaryField: 'stage_achieved', unit: '/4',
    formula: 'Highest consecutively passed stage; later stages after a failed stage are rejected.',
    fields: [objectField('stages', 'Stages', FOUR_STAGE_STAGES.map(([key, label]) => objectField(key, label, [
      choiceField('passed', 'Result', [['Pass', true], ['Fail', false]]), numberField('time_seconds', 'Hold time', true, 0, 10, 0.1, 'seconds'), field('notes', 'Stage notes', 'textarea', false),
    ]))), field('notes', 'Clinician notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'modified-thomas', name: 'Modified Thomas Test', measurementType: 'modified_thomas', primaryField: 'positive', unit: 'binary',
    formula: '1 when either side has a positive finding; otherwise 0.',
    fields: [choiceField('left_result', 'Left result', [['Not tested', 'not_tested'], ['Negative (normal)', 'Negative (normal)'], ['Positive - hip flexor tightness', 'Positive - hip flexor tightness'], ['Positive - rectus femoris tightness', 'Positive - rectus femoris tightness'], ['Positive - both', 'Positive - both']], false),
      choiceField('right_result', 'Right result', [['Not tested', 'not_tested'], ['Negative (normal)', 'Negative (normal)'], ['Positive - hip flexor tightness', 'Positive - hip flexor tightness'], ['Positive - rectus femoris tightness', 'Positive - rectus femoris tightness'], ['Positive - both', 'Positive - both']], false), field('notes', 'Notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'single-leg-hop', name: 'Single Leg Hop Test Battery', measurementType: 'single_leg_hop', primaryField: 'mean_lsi', unit: '%',
    formula: 'Mean limb symmetry index across each enabled bilateral distance or timed hop test.',
    fields: [choiceField('injured_side', 'Injured side', [['Not specified', ''], ...SIDE], false), choiceField('dominant_side', 'Dominant side', [['Not specified', ''], ...SIDE], false),
      objectField('enabled_tests', 'Enabled tests', ['single', 'triple', 'crossover', 'timed'].map((key) => choiceField(key, key, YES_NO))),
      ...['single', 'triple', 'crossover'].flatMap((test) => ['left', 'right'].map((side) => arrayField(`${test}_${side}`, `${test} ${side} trials`, numberField('value', 'Distance', false, 0, 1000, 0.1, 'cm'), 0, 3, false))),
      ...['left', 'right'].map((side) => arrayField(`timed_${side}`, `Timed ${side} trials`, numberField('value', 'Time', false, 0.01, 60, 0.01, 'seconds'), 0, 2, false)),
      choiceField('brace_used', 'Brace used', YES_NO, false), numberField('baseline_pain', 'Baseline pain', false, 0, 10, 1, '/10'),
      numberField('confidence_level', 'Confidence', false, 0, 10, 1, '/10'), numberField('fatigue', 'Fatigue', false, 0, 10, 1, '/10'), field('notes', 'Notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'one-minute-sit-to-stand', name: '1-Minute Sit-to-Stand Test', measurementType: '1_minute_sit_to_stand', primaryField: 'repetitions', unit: 'repetitions',
    formula: 'Completed repetitions in 60 seconds.',
    fields: [numberField('repetitions', 'Repetitions', true, 0, 200, 1, 'repetitions'), numberField('chair_height_cm', 'Chair height', false, 20, 80, 0.1, 'cm'),
      choiceField('arm_position', 'Arm position', [['Crossed on chest', 'Crossed on chest'], ['Arms at sides', 'Arms at sides'], ['Hands on thighs', 'Hands on thighs'], ['Other', 'Other']]),
      choiceField('assistive_device', 'Assistive device', YES_NO), objectField('pre_test_vitals', 'Pre-test vitals', VITALS_FIELDS, false),
      objectField('post_test_vitals', 'Post-test observations', [...VITALS_FIELDS, numberField('rpe', 'RPE', false, 0, 10, 1, '/10'), numberField('breathlessness', 'Breathlessness', false, 0, 10, 1, '/10'), numberField('pain', 'Pain', false, 0, 10, 1, '/10')], false), field('notes', 'Notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'groc', name: 'Global Rating of Change Scale', measurementType: 'patient_reported', primaryField: 'score', unit: '-7 to +7',
    formula: 'Selected global change rating from −7 to +7.', fields: [choiceField('score', 'Overall change', GROC_LEVELS.map(({ score, label }) => [`${score > 0 ? '+' : ''}${score} - ${label}`, score])), field('notes', 'Notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'four-square-step', name: 'Four Square Step Test', measurementType: 'four_square_step', primaryField: 'best_time', unit: 'seconds',
    formula: 'Minimum of one or two valid completion times.', fields: [numberField('trial1', 'Trial 1', true, 0.01, 300, 0.01, 'seconds'), numberField('trial2', 'Trial 2', false, 0.01, 300, 0.01, 'seconds'), field('observations', 'Observations', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'ctsib', name: 'Clinical Test of Sensory Interaction in Balance', measurementType: 'ctsib', primaryField: 'shortest_time', unit: 'seconds',
    formula: 'Shortest of all four required 30-second condition times.', fields: [objectField('scores', 'Condition times', CTSIB_CONDITIONS.map(([key, label]) => numberField(key, label, true, 0, 30, 0.1, 'seconds'))), field('observations', 'Observations', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'clock-drawing', name: 'Clock Drawing Test', measurementType: 'clock_drawing', primaryField: 'last_attempt_score', unit: 'points',
    formula: 'Score from final attempt using either the 0–5 global method or 10-point item method.',
    fields: [arrayField('attempts', 'Attempts', objectField('attempt', 'Attempt', [choiceField('scoring_method', 'Scoring method', [['0–5 global method', 'simple'], ['10-point method', 'ten_point']]),
      numberField('simple_score', 'Global score', false, 0, 5, 1, 'points'), objectField('ten_point_items', '10-point criteria', CLOCK_TEN_POINT_ITEMS.map(({ key, label }) => choiceField(key, label, YES_NO)), false),
      arrayField('abnormal_patterns', 'Abnormal patterns', choiceField('pattern', 'Pattern', CLOCK_ABNORMAL_PATTERNS.map((value) => [value, value])), 0, 5, false), field('notes', 'Attempt notes', 'textarea', false)]), 1, 10), field('global_notes', 'General notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'general-movement-screen', name: 'General Movement Screen', measurementType: 'GeneralMovementScreen', primaryField: 'total', unit: '/27',
    formula: 'Sum of nine required movement scores, each 0–3.', fields: [objectField('scores', 'Movement scores', GMS_TESTS.map(({ key, label }) => choiceField(key, label, ZERO_TO_THREE))), field('notes', 'Notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'tinetti', name: 'Tinetti Performance Oriented Mobility Assessment', measurementType: 'tinetti', primaryField: 'total', unit: '/28',
    formula: 'Balance subtotal (0–16) plus gait subtotal (0–12).', fields: [objectField('balance_scores', 'Balance items', TINETTI_BALANCE_ITEMS.map(({ key, name, options: itemOptions }) => field(key, name, 'select', true, { options: itemOptions }))),
      objectField('gait_scores', 'Gait items', TINETTI_GAIT_ITEMS.map(({ key, name, options: itemOptions }) => field(key, name, 'select', true, { options: itemOptions }))), field('notes', 'Notes', 'textarea', false)],
  }),
  defineSpec({
    runnerKey: 'six-minute-walk', name: 'Six-Minute Walk Test', measurementType: '6mwt', primaryField: 'total_distance', unit: 'm',
    formula: 'Device- or clinician-recorded total distance walked during the timed protocol.', fields: [
      objectField('pre_test', 'Pre-test measures', [numberField('hr', 'Heart rate', false, 20, 300, 1, 'bpm'), numberField('bp_sys', 'Systolic blood pressure', false, 40, 300, 1, 'mmHg'), numberField('bp_dia', 'Diastolic blood pressure', false, 20, 200, 1, 'mmHg'), numberField('spo2', 'SpO2', false, 0, 100, 1, '%'), numberField('rpe', 'RPE', false, 0, 10, 1, '/10')], false),
      objectField('during_test', 'During-test measures', [numberField('laps', 'Laps', false, 0, 1000, 1, 'laps'), numberField('current_distance', 'Current distance', false, 0, 10000, 0.1, 'm'), arrayField('rests', 'Rest periods', objectField('rest', 'Rest period', [numberField('time', 'Elapsed time', true, 0, 360, 1, 'seconds'), field('reason', 'Reason', 'text', false), numberField('hr', 'Heart rate', false, 20, 300, 1, 'bpm'), numberField('spo2', 'SpO2', false, 0, 100, 1, '%')]), 0, 100, false)], false),
      objectField('post_test', 'Post-test measures', [numberField('total_distance', 'Total distance', true, 0, 10000, 0.1, 'm'), numberField('hr', 'Heart rate', false, 20, 300, 1, 'bpm'), numberField('spo2', 'SpO2', false, 0, 100, 1, '%'), numberField('rpe', 'RPE', false, 0, 10, 1, '/10'), numberField('dyspnea', 'Dyspnea', false, 0, 10, 1, '/10')]),
      numberField('test_duration_seconds', 'Test duration', true, 0, 360, 1, 'seconds'), field('termination_reason', 'Termination reason', 'text', false), field('notes', 'Notes', 'textarea', false),
    ],
  }),
];

export const RUNNER_SPECS = deepFreeze(RUNNER_KEYS.map((runnerKey) => {
  const spec = SPECS.find((entry) => entry.runnerKey === runnerKey);
  invariant(spec, `missing RunnerSpec for ${runnerKey}`);
  return spec;
}));
export const RUNNER_SPEC_BY_KEY = deepFreeze(Object.fromEntries(RUNNER_SPECS.map((spec) => [spec.runnerKey, spec])));

export function scoreRangeOfMotion(input, context = {}) {
  const joint = requireChoice(input?.joint, 'joint', ROM_JOINTS.map(([key]) => key));
  const measurements = requiredObject(input?.measurements, 'measurements');
  const comments = input?.comments === undefined ? {} : requiredObject(input.comments, 'comments');
  const movementNames = ROM_MOVEMENT_KEYS[joint];
  let count = 0;
  const normalized = {};
  const normalizedComments = {};
  for (const movement of movementNames) {
    const reading = measurements[movement];
    if (reading === undefined) continue;
    requiredObject(reading, `measurements.${movement}`);
    const left = optionalNumber(reading.left, `${movement} left`, { min: -360, max: 360 });
    const right = optionalNumber(reading.right, `${movement} right`, { min: -360, max: 360 });
    invariant(left !== null || right !== null, `${movement} requires a left or right measurement`);
    count += Number(left !== null) + Number(right !== null);
    normalized[movement] = { left, right };
    const note = text(comments[movement], `${movement} comment`);
    if (note) normalizedComments[movement] = note;
  }
  invariant(count > 0, 'at least one finite joint movement measurement is required');
  const jointLabel = ROM_JOINTS.find(([key]) => key === joint)[1];
  const lines = Object.entries(normalized).map(([movement, value]) => `${movement}: ${value.left === null ? '' : `L ${value.left}°`} ${value.right === null ? '' : `R ${value.right}°`}`.trim());
  return finish({ key: 'range-of-motion', name: 'Range of Motion (Goniometry)', type: 'rom_assessment', input, context, result: count,
    interpretation: `${count} finite measurement${count === 1 ? '' : 's'} recorded for ${jointLabel}`,
    soap: `• Range of Motion — ${jointLabel}\n  ${lines.join('\n  ')}`,
    extra: { joint, joint_name: jointLabel, measurements: normalized, comments: normalizedComments, measurement_count: count } });
}

export function scoreManualMuscleTesting(input, context = {}) {
  const tests = requiredArray(input?.tests, 'tests', 1, 100).map((entry, index) => {
    requiredObject(entry, `tests[${index}]`);
    const region = requireChoice(entry.region, `tests[${index}].region`, Object.keys(MMT_MUSCLE_GROUPS));
    const movement = requireChoice(entry.movement, `tests[${index}].movement`, MMT_MUSCLE_GROUPS[region]);
    const side = requireChoice(entry.side, `tests[${index}].side`, ['left', 'right']);
    const grade = requireInteger(entry.grade, `tests[${index}].grade`, { min: 0, max: 5 });
    return { region, movement, side, grade, notes: text(entry.notes, `tests[${index}].notes`) };
  });
  const average = round(tests.reduce((sum, entry) => sum + entry.grade, 0) / tests.length, 1);
  const interpretation = average >= 4 ? 'Good to normal average strength' : average >= 3 ? 'Fair average strength' : 'Reduced average strength';
  return finish({ key: 'manual-muscle-testing', name: 'Manual Muscle Testing', type: 'manual_muscle_testing', input, context, result: average, interpretation,
    soap: `• Manual Muscle Testing: average ${average}/5\n${tests.map((entry) => `  ${entry.region} ${entry.movement} (${entry.side}): ${entry.grade}/5`).join('\n')}`,
    extra: { tests, average_grade: average } });
}

export function scorePainScales(input, context = {}) {
  const scale = requireChoice(input?.scale_type, 'scale_type', ['nprs', 'vas']);
  const current = requireFiniteNumber(input?.current_pain, 'current_pain', { min: 0, max: 10 });
  const best = optionalNumber(input?.best_pain, 'best_pain', { min: 0, max: 10 });
  const worst = optionalNumber(input?.worst_pain, 'worst_pain', { min: 0, max: 10 });
  invariant((best === null) === (worst === null), 'best_pain and worst_pain must be supplied together');
  const average = round(best === null ? current : (current + best + worst) / 3, 1);
  const interpretation = current === 0 ? 'No current pain' : current <= 3 ? 'Mild current pain' : current <= 6 ? 'Moderate current pain' : 'Severe current pain';
  const location = text(input?.pain_location, 'pain_location');
  return finish({ key: 'pain-scales', name: 'Pain Rating Scales', type: 'pain_scales', input, context, result: average, interpretation,
    soap: `• Pain Rating (${scale.toUpperCase()}): current ${current}/10${best === null ? '' : `; best ${best}/10; worst ${worst}/10; mean ${average}/10`}${location ? `\n  Location: ${location}` : ''}`,
    extra: { scale_type: scale, current_pain: current, best_pain: best, worst_pain: worst, average_pain: average, pain_location: location } });
}

export function scoreSingleLegStance(input, context = {}) {
  const trials = requiredArray(input?.trials, 'trials', 1, 12).map((entry, index) => {
    requiredObject(entry, `trials[${index}]`);
    return { side: requireChoice(entry.side, `trials[${index}].side`, ['left', 'right']), eyes_open: requireChoice(entry.eyes_open, `trials[${index}].eyes_open`, [true, false]), time: requireFiniteNumber(entry.time, `trials[${index}].time`, { min: 0, max: 60 }) };
  });
  const bestTrial = trials.reduce((best, trial) => trial.time > best.time ? trial : best);
  const interpretation = bestTrial.eyes_open
    ? (bestTrial.time >= 30 ? 'Excellent eyes-open balance' : bestTrial.time >= 20 ? 'Good eyes-open balance' : bestTrial.time >= 10 ? 'Fair eyes-open balance' : 'Poor eyes-open balance')
    : (bestTrial.time >= 10 ? 'Excellent eyes-closed balance' : bestTrial.time >= 5 ? 'Good eyes-closed balance' : 'Fair to poor eyes-closed balance');
  return finish({ key: 'single-leg-stance', name: 'Single Leg Stance Test', type: 'single_leg_stance', input, context, result: bestTrial.time, interpretation,
    soap: `• Single Leg Stance: best ${bestTrial.time}s (${bestTrial.side}, ${bestTrial.eyes_open ? 'eyes open' : 'eyes closed'}) — ${interpretation}`,
    extra: { trials, best_time: bestTrial.time, best_trial: bestTrial } });
}

export function scoreBergBalance(input, context = {}) {
  const scores = requiredObject(input?.scores, 'scores');
  const normalized = {};
  for (const item of BERG_ITEMS) {
    const raw = scores[item.id] ?? scores[String(item.id)] ?? scores[item.key];
    normalized[item.key] = requireInteger(raw, `scores.${item.key}`, { min: 0, max: 4 });
  }
  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  const interpretation = total >= 45 ? 'Low fall risk' : total >= 21 ? 'Medium fall risk' : 'High fall risk';
  return finish({ key: 'berg-balance', name: 'Berg Balance Scale', type: 'berg_balance', input, context, result: total, interpretation,
    soap: `• Berg Balance Scale: ${total}/56 — ${interpretation}\n${BERG_ITEMS.map((item) => `  ${item.id}. ${item.name}: ${normalized[item.key]}/4`).join('\n')}`,
    extra: { scores: normalized, total } });
}

export function scoreHandGrip(input, context = {}) {
  const dominantHand = requireChoice(input?.dominant_hand, 'dominant_hand', ['left', 'right']);
  const dominant = [1, 2, 3].map((n) => requireFiniteNumber(input?.[`dominant_trial_${n}`], `dominant_trial_${n}`, { min: 0, max: 200 }));
  const nonDominant = [1, 2, 3].map((n) => requireFiniteNumber(input?.[`non_dominant_trial_${n}`], `non_dominant_trial_${n}`, { min: 0, max: 200 }));
  const best = Math.max(...dominant), nonBest = Math.max(...nonDominant);
  const interpretation = best === nonBest ? 'Equal best bilateral grip' : best > nonBest ? 'Dominant-hand best exceeds non-dominant best' : 'Non-dominant best exceeds dominant-hand best';
  return finish({ key: 'hand-grip', name: 'Hand Grip Strength', type: 'hand_grip_strength', input, context, result: best, interpretation,
    soap: `• Hand Grip Strength (${dominantHand} dominant): dominant best ${best} kg; non-dominant best ${nonBest} kg`,
    extra: { dominant_hand: dominantHand, dominant_trials: dominant, non_dominant_trials: nonDominant, dominant_best: best, non_dominant_best: nonBest } });
}

export function scoreClinicalFrailtyScale(input, context = {}) {
  const score = requireInteger(input?.score, 'score', { min: 1, max: 9 });
  const level = CLINICAL_FRAILTY_LEVELS.find((entry) => entry.score === score);
  const interpretation = score <= 3 ? 'Fit to managing well' : score === 4 ? 'Vulnerable' : score <= 6 ? 'Frail' : score <= 8 ? 'Severely frail' : 'Terminally ill';
  return finish({ key: 'clinical-frailty-scale', name: 'Clinical Frailty Scale', type: 'clinical_frailty_scale', input, context, result: score, interpretation,
    soap: `• Clinical Frailty Scale: ${score}/9 — ${level.label}\n  ${level.description}`, extra: { frailty_score: score, frailty_label: level.label, description: level.description } });
}

function scoreGait(input, context, key) {
  const expectedDistance = key === 'four-meter-gait-speed' ? 4 : null;
  const distance = requireFiniteNumber(input?.distance, 'distance', { min: 1, max: 100 });
  if (expectedDistance !== null) invariant(distance === expectedDistance, 'four-meter gait speed distance must equal 4 metres');
  const trials = requiredArray(input?.trials, 'trials', 1, 20).map((entry, index) => {
    requiredObject(entry, `trials[${index}]`);
    const trialDistance = requireFiniteNumber(entry.distance, `trials[${index}].distance`, { min: 1, max: 100 });
    invariant(trialDistance === distance, `trials[${index}].distance must equal course distance`);
    const time = requireFiniteNumber(entry.time, `trials[${index}].time`, { min: 0.01, max: 600 });
    return { distance: trialDistance, time, speed: round(trialDistance / time, 4) };
  });
  const average = round(trials.reduce((sum, trial) => sum + trial.speed, 0) / trials.length, 2);
  const fast = key === 'fast-gait-speed';
  const interpretation = fast
    ? (average >= 1.3 ? 'Normal fast gait speed' : average >= 1 ? 'Mildly impaired fast gait speed' : 'Impaired fast gait speed')
    : (average >= 1 ? 'Normal community gait speed' : average >= 0.8 ? 'Limited community gait speed' : average >= 0.4 ? 'Household gait speed' : 'Severely impaired gait speed');
  const name = key === 'four-meter-gait-speed' ? '4-Meter Gait Speed' : fast ? 'Fast Gait Speed' : 'Habitual Gait Speed';
  return finish({ key, name, type: 'gait_speed', input, context, result: average, interpretation,
    soap: `• ${name}: ${average} m/s across ${trials.length} trial${trials.length === 1 ? '' : 's'} over ${distance} m — ${interpretation}`,
    extra: { gait_type: fast ? 'fast' : key === 'four-meter-gait-speed' ? '4-meter' : 'habitual', distance_meters: distance, trials, average_speed_ms: average, speed_mps: average, average_time: round(trials.reduce((sum, trial) => sum + trial.time, 0) / trials.length, 2) } });
}

export const scoreFourMeterGaitSpeed = (input, context = {}) => scoreGait(input, context, 'four-meter-gait-speed');
export const scoreHabitualGaitSpeed = (input, context = {}) => scoreGait(input, context, 'habitual-gait-speed');
export const scoreFastGaitSpeed = (input, context = {}) => scoreGait(input, context, 'fast-gait-speed');

export function scoreYBalance(input, context = {}) {
  const ll = requireFiniteNumber(input?.limb_length_left, 'limb_length_left', { min: 1, max: 200 });
  const lr = requireFiniteNumber(input?.limb_length_right, 'limb_length_right', { min: 1, max: 200 });
  const values = Object.fromEntries(['left_anterior', 'left_posteromedial', 'left_posterolateral', 'right_anterior', 'right_posteromedial', 'right_posterolateral'].map((key) => [key, requireFiniteNumber(input?.[key], key, { min: 0, max: 300 })]));
  const left = round((values.left_anterior + values.left_posteromedial + values.left_posterolateral) / (3 * ll) * 100, 1);
  const right = round((values.right_anterior + values.right_posteromedial + values.right_posterolateral) / (3 * lr) * 100, 1);
  const best = Math.max(left, right);
  const asymmetry = round(Math.abs(values.left_anterior - values.right_anterior), 1);
  const interpretation = `Left composite ${left}%; right composite ${right}%; anterior asymmetry ${asymmetry} cm`;
  return finish({ key: 'y-balance', name: 'Y-Balance Test', type: 'y_balance', input, context, result: best, interpretation,
    soap: `• Y-Balance Test: L ${left}%, R ${right}%; anterior asymmetry ${asymmetry} cm`, extra: { ...values, limb_length_left: ll, limb_length_right: lr, left_composite: left, right_composite: right, anterior_asymmetry: asymmetry } });
}

export function scoreFourStageBalance(input, context = {}) {
  const stages = requiredObject(input?.stages, 'stages');
  const normalized = {};
  let stageAchieved = 0, previousPassed = true;
  for (const [index, [key]] of FOUR_STAGE_STAGES.entries()) {
    const entry = requiredObject(stages[key], `stages.${key}`);
    const passed = requireChoice(entry.passed, `stages.${key}.passed`, [true, false]);
    const time = requireFiniteNumber(entry.time_seconds, `stages.${key}.time_seconds`, { min: 0, max: 10 });
    invariant(!passed || time === 10, `stages.${key} passed requires a 10-second hold`);
    invariant(previousPassed || !passed, `stages.${key} cannot pass after a failed earlier stage`);
    if (passed) stageAchieved = index + 1;
    previousPassed = previousPassed && passed;
    normalized[key] = { passed, time_seconds: time, notes: text(entry.notes, `stages.${key}.notes`) };
  }
  const fallRisk = !normalized.tandem.passed;
  const interpretation = fallRisk ? 'Increased fall risk; tandem stance not held for 10 seconds' : 'Tandem stance criterion met';
  return finish({ key: 'four-stage-balance', name: '4-Stage Balance Test', type: 'four_stage_balance_test', input, context, result: stageAchieved, interpretation,
    soap: `• 4-Stage Balance Test: highest stage ${stageAchieved}/4 — ${interpretation}`, extra: { stages: normalized, stage_achieved: stageAchieved, fall_risk: fallRisk ? 'high' : 'low' } });
}

export function scoreModifiedThomas(input, context = {}) {
  const permitted = ['not_tested', 'Negative (normal)', 'Positive - hip flexor tightness', 'Positive - rectus femoris tightness', 'Positive - both'];
  const left = requireChoice(input?.left_result ?? 'not_tested', 'left_result', permitted);
  const right = requireChoice(input?.right_result ?? 'not_tested', 'right_result', permitted);
  invariant(left !== 'not_tested' || right !== 'not_tested', 'at least one side result is required');
  const lp = left.startsWith('Positive'), rp = right.startsWith('Positive');
  const interpretation = lp && rp ? 'Bilateral positive' : lp ? 'Left positive' : rp ? 'Right positive' : 'Tested sides negative';
  return finish({ key: 'modified-thomas', name: 'Modified Thomas Test', type: 'modified_thomas', input, context, result: lp || rp ? 1 : 0, interpretation,
    soap: `• Modified Thomas Test: left ${left}; right ${right} — ${interpretation}`, extra: { test_name: 'Thomas Test', left_result: left, right_result: right, positive: lp || rp } });
}

function cleanTrials(value, fieldName, max, upper) {
  const raw = requiredArray(value ?? [], fieldName, 0, max);
  return raw.filter((entry) => entry !== '' && entry !== null && entry !== undefined).map((entry, index) => requireFiniteNumber(entry, `${fieldName}[${index}]`, { min: 0.01, max: upper }));
}

export function scoreSingleLegHop(input, context = {}) {
  const injuredSide = requireChoice(input?.injured_side ?? '', 'injured_side', ['', 'left', 'right']);
  const dominantSide = requireChoice(input?.dominant_side ?? '', 'dominant_side', ['', 'left', 'right']);
  const enabled = requiredObject(input?.enabled_tests, 'enabled_tests');
  const results = {}, lsis = [];
  for (const test of ['single', 'triple', 'crossover', 'timed']) {
    const isEnabled = requireChoice(enabled[test], `enabled_tests.${test}`, [true, false]);
    const maxTrials = test === 'timed' ? 2 : 3;
    const upper = test === 'timed' ? 60 : 1000;
    const left = cleanTrials(input?.[`${test}_left`], `${test}_left`, maxTrials, upper);
    const right = cleanTrials(input?.[`${test}_right`], `${test}_right`, maxTrials, upper);
    if (!isEnabled) {
      continue;
    }
    invariant(left.length > 0 && right.length > 0, `${test} requires bilateral trials when enabled`);
    const leftBest = test === 'timed' ? Math.min(...left) : Math.max(...left);
    const rightBest = test === 'timed' ? Math.min(...right) : Math.max(...right);
    let lsi;
    if (test === 'timed') {
      const injured = injuredSide === 'left' ? leftBest : injuredSide === 'right' ? rightBest : Math.max(leftBest, rightBest);
      const uninjured = injuredSide === 'left' ? rightBest : injuredSide === 'right' ? leftBest : Math.min(leftBest, rightBest);
      lsi = round(uninjured / injured * 100, 1);
    } else {
      const injured = injuredSide === 'left' ? leftBest : injuredSide === 'right' ? rightBest : Math.min(leftBest, rightBest);
      const uninjured = injuredSide === 'left' ? rightBest : injuredSide === 'right' ? leftBest : Math.max(leftBest, rightBest);
      lsi = round(injured / uninjured * 100, 1);
    }
    results[test] = { left_trials: left, right_trials: right, left_best: leftBest, right_best: rightBest, lsi };
    lsis.push(lsi);
  }
  invariant(lsis.length > 0, 'at least one bilateral hop test must be enabled and completed');
  const mean = round(lsis.reduce((sum, value) => sum + value, 0) / lsis.length, 1);
  const interpretation = mean >= 90 ? 'Good symmetry' : mean >= 85 ? 'Borderline symmetry' : 'Significant asymmetry';
  return finish({ key: 'single-leg-hop', name: 'Single Leg Hop Test Battery', type: 'single_leg_hop', input, context, result: mean, interpretation,
    soap: `• Single Leg Hop Test Battery: mean LSI ${mean}% — ${interpretation}\n${Object.entries(results).map(([test, value]) => `  ${test}: L ${value.left_best}, R ${value.right_best}, LSI ${value.lsi}%`).join('\n')}`,
    extra: { injured_side: injuredSide, dominant_side: dominantSide, enabled_tests: clone(enabled), tests: results, mean_lsi: mean, baseline_pain: optionalNumber(input?.baseline_pain, 'baseline_pain', { min: 0, max: 10 }), confidence_level: optionalNumber(input?.confidence_level, 'confidence_level', { min: 0, max: 10 }), fatigue: optionalNumber(input?.fatigue, 'fatigue', { min: 0, max: 10 }), brace_used: input?.brace_used ?? null } });
}

export function scoreOneMinuteSitToStand(input, context = {}) {
  const repetitions = requireInteger(input?.repetitions, 'repetitions', { min: 0, max: 200 });
  const chair = optionalNumber(input?.chair_height_cm, 'chair_height_cm', { min: 20, max: 80 });
  const arm = requireChoice(input?.arm_position, 'arm_position', ['Crossed on chest', 'Arms at sides', 'Hands on thighs', 'Other']);
  const assistive = requireChoice(input?.assistive_device, 'assistive_device', [true, false]);
  const normalizeVitals = (value, fieldName, post = false) => {
    const raw = value === undefined ? {} : requiredObject(value, fieldName);
    const result = { heart_rate: optionalNumber(raw.heart_rate, `${fieldName}.heart_rate`, { min: 20, max: 300 }), oxygen_saturation: optionalNumber(raw.oxygen_saturation, `${fieldName}.oxygen_saturation`, { min: 0, max: 100 }) };
    if (post) Object.assign(result, { rpe: optionalNumber(raw.rpe, `${fieldName}.rpe`, { min: 0, max: 10 }), breathlessness: optionalNumber(raw.breathlessness, `${fieldName}.breathlessness`, { min: 0, max: 10 }), pain: optionalNumber(raw.pain, `${fieldName}.pain`, { min: 0, max: 10 }) });
    return result;
  };
  const pre = normalizeVitals(input?.pre_test_vitals, 'pre_test_vitals');
  const post = normalizeVitals(input?.post_test_vitals, 'post_test_vitals', true);
  const interpretation = repetitions >= 25 ? 'Above average' : repetitions >= 17 ? 'Average' : 'Below average';
  return finish({ key: 'one-minute-sit-to-stand', name: '1-Minute Sit-to-Stand Test', type: '1_minute_sit_to_stand', input, context, result: repetitions, interpretation,
    soap: `• 1-Minute Sit-to-Stand Test: ${repetitions} repetitions — ${interpretation}`, extra: { repetitions, chair_height_cm: chair, arm_position_used: arm, assistive_device_used: assistive, pre_test_vitals: pre, post_test_vitals: post } });
}

export function scoreGroc(input, context = {}) {
  const score = requireInteger(input?.score, 'score', { min: -7, max: 7 });
  const level = GROC_LEVELS.find((entry) => entry.score === score);
  const interpretation = score >= 2 ? 'Clinically meaningful improvement' : score <= -2 ? 'Clinically meaningful deterioration' : score === 0 ? 'No change' : 'Below threshold for meaningful change';
  return finish({ key: 'groc', name: 'Global Rating of Change Scale', type: 'patient_reported', input, context, result: score, interpretation,
    soap: `• Global Rating of Change: ${score > 0 ? '+' : ''}${score} — ${level.label}; ${interpretation}`, extra: { score, label: level.label, clinical_meaning: interpretation } });
}

export function scoreFourSquareStep(input, context = {}) {
  const t1 = requireFiniteNumber(input?.trial1, 'trial1', { min: 0.01, max: 300 });
  const t2 = optionalNumber(input?.trial2, 'trial2', { min: 0.01, max: 300 });
  const best = Math.min(t1, ...(t2 === null ? [] : [t2]));
  const interpretation = best >= 15 ? 'High fall risk' : best > 12 ? 'Increased fall risk' : 'Low fall risk';
  return finish({ key: 'four-square-step', name: 'Four Square Step Test', type: 'four_square_step', input, context, result: best, interpretation,
    soap: `• Four Square Step Test: best ${best}s — ${interpretation}`, extra: { trial1: t1, trial2: t2, best_time: best, observations: text(input?.observations, 'observations') } });
}

export function scoreCtsib(input, context = {}) {
  const scores = requiredObject(input?.scores, 'scores');
  const normalized = Object.fromEntries(CTSIB_CONDITIONS.map(([key]) => [key, requireFiniteNumber(scores[key], `scores.${key}`, { min: 0, max: 30 })]));
  const result = Math.min(...Object.values(normalized));
  const interpretation = Object.values(normalized).every((value) => value === 30) ? 'All four conditions held for 30 seconds' : 'At least one condition ended before 30 seconds';
  return finish({ key: 'ctsib', name: 'Clinical Test of Sensory Interaction in Balance', type: 'ctsib', input, context, result, interpretation,
    soap: `• CTSIB: shortest condition ${result}s — ${interpretation}\n${CTSIB_CONDITIONS.map(([key, label]) => `  ${label}: ${normalized[key]}s`).join('\n')}`,
    extra: { scores: normalized, conditions_completed: 4, shortest_time: result, observations: text(input?.observations, 'observations') } });
}

export function scoreClockDrawing(input, context = {}) {
  const attempts = requiredArray(input?.attempts, 'attempts', 1, 10).map((entry, index) => {
    requiredObject(entry, `attempts[${index}]`);
    const method = requireChoice(entry.scoring_method ?? entry.scoringMethod, `attempts[${index}].scoring_method`, ['simple', 'ten_point']);
    let score;
    const items = {};
    if (method === 'simple') score = requireInteger(entry.simple_score ?? entry.simpleScore, `attempts[${index}].simple_score`, { min: 0, max: 5 });
    else {
      const rawItems = requiredObject(entry.ten_point_items ?? entry.tenPointItems, `attempts[${index}].ten_point_items`);
      score = 0;
      for (const item of CLOCK_TEN_POINT_ITEMS) {
        const checked = requireChoice(rawItems[item.key] ?? false, `attempts[${index}].ten_point_items.${item.key}`, [true, false]);
        items[item.key] = checked;
        if (checked) score += item.points;
      }
    }
    const abnormal = requiredArray(entry.abnormal_patterns ?? entry.abnormalPatterns ?? [], `attempts[${index}].abnormal_patterns`, 0, 5);
    for (const pattern of abnormal) requireChoice(pattern, `attempts[${index}].abnormal_patterns`, CLOCK_ABNORMAL_PATTERNS);
    return { scoring_method: method, simple_score: method === 'simple' ? score : null, ten_point_items: items, abnormal_patterns: [...abnormal], notes: text(entry.notes, `attempts[${index}].notes`), score };
  });
  const last = attempts.at(-1);
  const max = last.scoring_method === 'simple' ? 5 : 10;
  const interpretation = last.scoring_method === 'simple' ? (last.score >= 4 ? 'Normal' : last.score === 3 ? 'Possible mild impairment' : 'Likely cognitive impairment') : (last.score >= 8 ? 'Normal' : last.score >= 6 ? 'Mild impairment' : 'Moderate–severe impairment');
  return finish({ key: 'clock-drawing', name: 'Clock Drawing Test', type: 'clock_drawing', input, context, result: last.score, interpretation,
    soap: `• Clock Drawing Test: final attempt ${last.score}/${max} — ${interpretation}`, extra: { attempts, last_attempt_score: last.score, global_notes: text(input?.global_notes, 'global_notes') } });
}

export function scoreGeneralMovementScreen(input, context = {}) {
  const scores = requiredObject(input?.scores, 'scores');
  const normalized = Object.fromEntries(GMS_TESTS.map(({ key }) => [key, requireInteger(scores[key], `scores.${key}`, { min: 0, max: 3 })]));
  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  const painTests = GMS_TESTS.filter(({ key }) => normalized[key] === 0).map(({ label }) => label);
  const interpretation = painTests.length ? `Pain or unsafe response recorded in ${painTests.length} movement${painTests.length === 1 ? '' : 's'}` : total >= 21 ? 'High-quality overall movement pattern' : total >= 14 ? 'Movement compensations present' : 'Substantial movement limitations present';
  return finish({ key: 'general-movement-screen', name: 'General Movement Screen', type: 'GeneralMovementScreen', input, context, result: total, interpretation,
    soap: `• General Movement Screen: ${total}/27 — ${interpretation}\n${GMS_TESTS.map(({ key, label }) => `  ${label}: ${normalized[key]}/3`).join('\n')}`, extra: { scores: normalized, total, pain_tests: painTests } });
}

export function scoreTinetti(input, context = {}) {
  const balanceRaw = requiredObject(input?.balance_scores, 'balance_scores');
  const gaitRaw = requiredObject(input?.gait_scores, 'gait_scores');
  const normalize = (items, raw, label) => Object.fromEntries(items.map(({ key, options: itemOptions }) => {
    const index = Number(key.split('_')[1]) - 1;
    const value = raw[key] ?? raw[index] ?? raw[String(index)];
    return [key, requireChoice(value, `${label}.${key}`, itemOptions.map((option) => option.value))];
  }));
  const balance = normalize(TINETTI_BALANCE_ITEMS, balanceRaw, 'balance_scores');
  const gait = normalize(TINETTI_GAIT_ITEMS, gaitRaw, 'gait_scores');
  const balanceScore = Object.values(balance).reduce((sum, value) => sum + value, 0);
  const gaitScore = Object.values(gait).reduce((sum, value) => sum + value, 0);
  const total = balanceScore + gaitScore;
  const interpretation = total >= 25 ? 'Low fall risk' : total >= 19 ? 'Medium fall risk' : 'High fall risk';
  return finish({ key: 'tinetti', name: 'Tinetti Performance Oriented Mobility Assessment', type: 'tinetti', input, context, result: total, interpretation,
    soap: `• Tinetti POMA: ${total}/28 — ${interpretation}\n  Balance ${balanceScore}/16; gait ${gaitScore}/12`, extra: { balance_score: balanceScore, gait_score: gaitScore, balance_responses: balance, gait_responses: gait, total } });
}

export function scoreSixMinuteWalk(input, context = {}) {
  const preRaw = input?.pre_test === undefined ? {} : requiredObject(input.pre_test, 'pre_test');
  const duringRaw = input?.during_test === undefined ? {} : requiredObject(input.during_test, 'during_test');
  const postRaw = requiredObject(input?.post_test, 'post_test');
  const pre = { hr: optionalNumber(preRaw.hr, 'pre_test.hr', { min: 20, max: 300 }), bp_sys: optionalNumber(preRaw.bp_sys, 'pre_test.bp_sys', { min: 40, max: 300 }), bp_dia: optionalNumber(preRaw.bp_dia, 'pre_test.bp_dia', { min: 20, max: 200 }), spo2: optionalNumber(preRaw.spo2, 'pre_test.spo2', { min: 0, max: 100 }), rpe: optionalNumber(preRaw.rpe, 'pre_test.rpe', { min: 0, max: 10 }) };
  const rests = requiredArray(duringRaw.rests ?? [], 'during_test.rests', 0, 100).map((entry, index) => { requiredObject(entry, `during_test.rests[${index}]`); return { time: requireFiniteNumber(entry.time, `during_test.rests[${index}].time`, { min: 0, max: 360 }), reason: text(entry.reason, `during_test.rests[${index}].reason`), hr: optionalNumber(entry.hr, `during_test.rests[${index}].hr`, { min: 20, max: 300 }), spo2: optionalNumber(entry.spo2, `during_test.rests[${index}].spo2`, { min: 0, max: 100 }) }; });
  const during = { laps: optionalNumber(duringRaw.laps, 'during_test.laps', { min: 0, max: 1000 }), current_distance: optionalNumber(duringRaw.current_distance ?? duringRaw.currentDistance, 'during_test.current_distance', { min: 0, max: 10000 }), rests };
  const post = { total_distance: requireFiniteNumber(postRaw.total_distance, 'post_test.total_distance', { min: 0, max: 10000 }), hr: optionalNumber(postRaw.hr, 'post_test.hr', { min: 20, max: 300 }), spo2: optionalNumber(postRaw.spo2, 'post_test.spo2', { min: 0, max: 100 }), rpe: optionalNumber(postRaw.rpe, 'post_test.rpe', { min: 0, max: 10 }), dyspnea: optionalNumber(postRaw.dyspnea, 'post_test.dyspnea', { min: 0, max: 10 }) };
  const duration = requireInteger(input?.test_duration_seconds, 'test_duration_seconds', { min: 0, max: 360 });
  const termination = text(input?.termination_reason, 'termination_reason');
  const interpretation = termination ? `Test terminated at ${duration} seconds: ${termination}` : duration === 360 ? 'Six-minute protocol completed' : `Protocol ended at ${duration} seconds`;
  return finish({ key: 'six-minute-walk', name: 'Six-Minute Walk Test', type: '6mwt', input, context, result: post.total_distance, interpretation,
    soap: `• Six-Minute Walk Test: ${post.total_distance} m in ${duration}s — ${interpretation}\n  Rest periods: ${rests.length}`, extra: { pre_test: pre, during_test: during, post_test: post, total_distance: post.total_distance, test_duration_seconds: duration, termination_reason: termination, rest_periods: rests.length } });
}

const FIXTURES = deepFreeze({
  'range-of-motion': { joint: 'shoulder', measurements: { Flexion: { left: 155, right: 160 }, Abduction: { left: 145, right: 150 } }, comments: { Flexion: 'End range measured without substitution.' }, notes: 'Fixture ROM' },
  'manual-muscle-testing': { tests: [{ region: 'Shoulder', movement: 'Flexion', side: 'left', grade: 4, notes: 'Mild weakness' }, { region: 'Shoulder', movement: 'Flexion', side: 'right', grade: 5, notes: '' }], notes: 'Fixture MMT' },
  'pain-scales': { scale_type: 'nprs', current_pain: 4, best_pain: 2, worst_pain: 7, pain_location: 'Right knee', notes: 'Fixture pain' },
  'single-leg-stance': { trials: [{ side: 'left', eyes_open: true, time: 22.4 }, { side: 'right', eyes_open: true, time: 25.1 }], notes: 'Fixture stance' },
  'berg-balance': { scores: Object.fromEntries(BERG_ITEMS.map(({ key }, index) => [key, index < 6 ? 4 : 3])), notes: 'Fixture Berg' },
  'hand-grip': { dominant_hand: 'right', dominant_trial_1: 34.2, dominant_trial_2: 36.1, dominant_trial_3: 35.5, non_dominant_trial_1: 31.8, non_dominant_trial_2: 32.4, non_dominant_trial_3: 32, notes: 'Fixture grip' },
  'clinical-frailty-scale': { score: 4, notes: 'Fixture frailty' },
  'four-meter-gait-speed': { distance: 4, trials: [{ time: 4, distance: 4 }, { time: 3.8, distance: 4 }], notes: 'Fixture 4m gait' },
  'y-balance': { limb_length_left: 90, limb_length_right: 91, left_anterior: 62, left_posteromedial: 70, left_posterolateral: 68, right_anterior: 64, right_posteromedial: 72, right_posterolateral: 70, notes: 'Fixture Y balance' },
  'habitual-gait-speed': { distance: 10, trials: [{ time: 10, distance: 10 }, { time: 9.5, distance: 10 }], notes: 'Fixture habitual gait' },
  'fast-gait-speed': { distance: 10, trials: [{ time: 7.5, distance: 10 }, { time: 7.2, distance: 10 }], notes: 'Fixture fast gait' },
  'four-stage-balance': { stages: { side_by_side: { passed: true, time_seconds: 10, notes: '' }, semi_tandem: { passed: true, time_seconds: 10, notes: '' }, tandem: { passed: true, time_seconds: 10, notes: '' }, single_leg: { passed: false, time_seconds: 6.5, notes: 'Stepped out' } }, notes: 'Fixture stages' },
  'modified-thomas': { left_result: 'Positive - hip flexor tightness', right_result: 'Negative (normal)', notes: 'Fixture Thomas' },
  'single-leg-hop': { injured_side: 'left', dominant_side: 'right', enabled_tests: { single: true, triple: true, crossover: false, timed: true }, single_left: [145, 148, 146], single_right: [160, 162, 159], triple_left: [420, 425, 422], triple_right: [455, 458, 450], crossover_left: [], crossover_right: [], timed_left: [2.2, 2.1], timed_right: [2, 1.95], brace_used: false, baseline_pain: 1, confidence_level: 8, fatigue: 2, notes: 'Fixture hop' },
  'one-minute-sit-to-stand': { repetitions: 21, chair_height_cm: 45, arm_position: 'Crossed on chest', assistive_device: false, pre_test_vitals: { heart_rate: 72, oxygen_saturation: 98 }, post_test_vitals: { heart_rate: 108, oxygen_saturation: 96, rpe: 5, breathlessness: 3, pain: 1 }, notes: 'Fixture sit to stand' },
  groc: { score: 3, notes: 'Fixture GROC' },
  'four-square-step': { trial1: 11.8, trial2: 11.2, observations: 'No contact with canes' },
  ctsib: { scores: { firm_eyes_open: 30, firm_eyes_closed: 30, foam_eyes_open: 28, foam_eyes_closed: 21.4 }, observations: 'Increased sway on foam' },
  'clock-drawing': { attempts: [{ scoring_method: 'simple', simple_score: 4, ten_point_items: {}, abnormal_patterns: [], notes: 'Minor spacing error' }, { scoring_method: 'ten_point', simple_score: null, ten_point_items: Object.fromEntries(CLOCK_TEN_POINT_ITEMS.map(({ key }, index) => [key, index !== 6])), abnormal_patterns: ['Wrong time but good clock (executive function issue)'], notes: 'Second attempt' }], global_notes: 'Fixture clock' },
  'general-movement-screen': { scores: { squat: 2, hip_hinge: 3, lunge: 2, single_leg_stand: 2, push_up: 3, shoulder_mob: 2, trunk_rotation: 2, hip_mob: 3, overhead_reach: 2 }, notes: 'Fixture movement screen' },
  tinetti: { balance_scores: Object.fromEntries(TINETTI_BALANCE_ITEMS.map(({ key, options: itemOptions }) => [key, itemOptions.at(-1).value])), gait_scores: Object.fromEntries(TINETTI_GAIT_ITEMS.map(({ key, options: itemOptions }) => [key, itemOptions.at(-1).value])), notes: 'Fixture Tinetti' },
  'six-minute-walk': { pre_test: { hr: 72, bp_sys: 122, bp_dia: 78, spo2: 98, rpe: 1 }, during_test: { laps: 12, current_distance: 540, rests: [{ time: 210, reason: 'Brief breathlessness', hr: 118, spo2: 94 }] }, post_test: { total_distance: 560, hr: 112, spo2: 95, rpe: 5, dyspnea: 4 }, test_duration_seconds: 360, termination_reason: '', notes: 'Fixture walk' },
});

export function buildFixture(runnerKey) {
  invariant(RUNNER_KEYS.includes(runnerKey), `unsupported runner key ${runnerKey}`);
  return clone(FIXTURES[runnerKey]);
}

const SCORERS = deepFreeze({
  'range-of-motion': scoreRangeOfMotion,
  'manual-muscle-testing': scoreManualMuscleTesting,
  'pain-scales': scorePainScales,
  'single-leg-stance': scoreSingleLegStance,
  'berg-balance': scoreBergBalance,
  'hand-grip': scoreHandGrip,
  'clinical-frailty-scale': scoreClinicalFrailtyScale,
  'four-meter-gait-speed': scoreFourMeterGaitSpeed,
  'y-balance': scoreYBalance,
  'habitual-gait-speed': scoreHabitualGaitSpeed,
  'fast-gait-speed': scoreFastGaitSpeed,
  'four-stage-balance': scoreFourStageBalance,
  'modified-thomas': scoreModifiedThomas,
  'single-leg-hop': scoreSingleLegHop,
  'one-minute-sit-to-stand': scoreOneMinuteSitToStand,
  groc: scoreGroc,
  'four-square-step': scoreFourSquareStep,
  ctsib: scoreCtsib,
  'clock-drawing': scoreClockDrawing,
  'general-movement-screen': scoreGeneralMovementScreen,
  tinetti: scoreTinetti,
  'six-minute-walk': scoreSixMinuteWalk,
});

export function validateAndScore(input, context = {}) {
  const runnerKey = context.runnerKey || input?.runnerKey;
  invariant(RUNNER_KEYS.includes(runnerKey), `unsupported runner key ${runnerKey}`);
  return SCORERS[runnerKey](input, context);
}
