import { todayLocal } from '../../localDate.js';

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NOTES_MAX = 4000;

export const RUNNER_KEYS = Object.freeze([
  'hads',
  'ebbeling',
  'harvard-step',
  'rockport-walk',
  'resting-heart-rate',
  'astrand',
  'vertical-jump',
  'ases',
  'constant-murley',
  'lysholm',
  'acl-rsi',
  'fabq',
  'drop-vertical-jump',
  'naughton',
  'sgrq',
  'dexa',
  'conley',
  'perceived-stress-scale',
  'heart-rate-recovery',
  'lipid-profile',
  'borg-rpe',
  'quickdash',
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`Core-B assessment scorer: ${message}`);
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

/** @param {Record<string, any>} extra */
function field(key, label, type, required = true, extra = {}) {
  return { key, label, type, required, ...extra };
}

/** @param {Array<[string, any]>} entries */
function options(entries) {
  return entries.map(([label, value]) => ({ label, value }));
}

function questionnaireItem(key, prompt, itemOptions, extra = {}) {
  return { key, label: prompt, prompt, type: 'single_choice', required: true, options: itemOptions, ...extra };
}

/**
 * @param {{runnerKey: string, name: string, kind?: string, measurementType: string, primaryField: string, unit: string, formula: string, fields?: any[], items?: any[]}} definition
 */
function defineSpec({ runnerKey, name, kind = 'measurement', measurementType, primaryField, unit, formula, fields, items }) {
  return deepFreeze({
    schemaVersion: 1,
    kind,
    runnerKey,
    scoringKey: runnerKey,
    name,
    measurementType,
    ...(kind === 'questionnaire' ? { items } : { fields }),
    scoring: {
      version: `${runnerKey}.v1`,
      formula,
      validation: 'All required values, enumerations, nested observations, finite ranges and protocol constraints are enforced before persistence.',
    },
    result: {
      primaryField,
      unit,
      persistence: [
        'result_value',
        'additional_data.raw_input',
        'additional_data.interpretation',
        'additional_data.soap_text',
        'additional_data.report_text',
      ],
    },
  });
}

const ZERO_TO_TEN = options(Array.from({ length: 11 }, (_, value) => [String(value), value]));
const ZERO_TO_SIX = options(Array.from({ length: 7 }, (_, value) => [String(value), value]));
const ZERO_TO_FOUR = options([
  ['Never', 0], ['Almost Never', 1], ['Sometimes', 2], ['Fairly Often', 3], ['Very Often', 4],
]);
const YES_NO = options([['Yes', true], ['No', false]]);

export const HADS_ITEMS = deepFreeze([
  ['q1', "I feel tense or 'wound up'", 'anxiety', [['Most of the time', 3], ['A lot of the time', 2], ['Time to time, occasionally', 1], ['Not at all', 0]]],
  ['q2', 'I still enjoy the things I used to enjoy', 'depression', [['Definitely as much', 0], ['Not quite so much', 1], ['Only a little', 2], ['Hardly at all', 3]]],
  ['q3', 'I get a sort of frightened feeling as if something awful is about to happen', 'anxiety', [['Very definitely and quite badly', 3], ['Yes, but not too badly', 2], ["A little, but it doesn't worry me", 1], ['Not at all', 0]]],
  ['q4', 'I can laugh and see the funny side of things', 'depression', [['As much as I always could', 0], ['Not quite so much now', 1], ['Definitely not so much now', 2], ['Not at all', 3]]],
  ['q5', 'Worrying thoughts go through my mind', 'anxiety', [['A great deal of the time', 3], ['A lot of the time', 2], ['From time to time but not too often', 1], ['Only occasionally', 0]]],
  ['q6', 'I feel cheerful', 'depression', [['Not at all', 3], ['Not often', 2], ['Sometimes', 1], ['Most of the time', 0]]],
  ['q7', 'I can sit at ease and feel relaxed', 'anxiety', [['Definitely', 0], ['Usually', 1], ['Not often', 2], ['Not at all', 3]]],
  ['q8', 'I feel as if I am slowed down', 'depression', [['Nearly all the time', 3], ['Very often', 2], ['Sometimes', 1], ['Not at all', 0]]],
  ['q9', "I get a sort of frightened feeling like 'butterflies' in the stomach", 'anxiety', [['Not at all', 0], ['Occasionally', 1], ['Quite often', 2], ['Very often', 3]]],
  ['q10', 'I have lost interest in my appearance', 'depression', [['Definitely', 3], ["I don't take as much care as I should", 2], ['I may not take quite as much care', 1], ['I take just as much care as ever', 0]]],
  ['q11', 'I feel restless as if I have to be on the move', 'anxiety', [['Very much indeed', 3], ['Quite a lot', 2], ['Not very much', 1], ['Not at all', 0]]],
  ['q12', 'I look forward with enjoyment to things', 'depression', [['As much as ever I did', 0], ['Rather less than I used to', 1], ['Definitely less than I used to', 2], ['Hardly at all', 3]]],
  ['q13', 'I get sudden feelings of panic', 'anxiety', [['Very often indeed', 3], ['Quite often', 2], ['Not very often', 1], ['Not at all', 0]]],
  ['q14', 'I can enjoy a good book or radio or TV program', 'depression', [['Often', 0], ['Sometimes', 1], ['Not often', 2], ['Very seldom', 3]]],
].map((entry) => {
  const [key, prompt, subscale, itemOptions] = /** @type {[string, string, string, Array<[string, number]>]} */ (entry);
  return questionnaireItem(key, prompt, options(itemOptions), { subscale, responseBinding: { field: 'scores', key } });
}));

export const LYSHOLM_ITEMS = deepFreeze([
  ['limp', 'Limp', [['None', 5], ['Slight or Periodic', 3], ['Severe and Constant', 0]]],
  ['support', 'Support', [['None', 5], ['Stick or Crutch', 2], ['Weight Bearing Impossible', 0]]],
  ['locking', 'Locking', [['No locking', 15], ['Catching sensation but no locking', 10], ['Locking occasionally', 6], ['Locking frequently', 2], ['Locked joint on examination', 0]]],
  ['instability', 'Giving Way', [['Never', 25], ['Rarely during athletics or severe exertion', 20], ['Frequently during athletics', 15], ['Occasionally in daily activities', 10], ['Often in daily activities', 5], ['With every step', 0]]],
  ['pain', 'Pain', [['None', 25], ['Inconstant and slight during severe exertion', 20], ['Marked during severe exertion', 15], ['Marked on or after walking more than 1 mile', 10], ['Marked on or after walking less than 1 mile', 5], ['Constant', 0]]],
  ['swelling', 'Swelling', [['None', 10], ['On giving way', 6], ['On ordinary exertion', 2], ['Constant', 0]]],
  ['stairs', 'Climbing Stairs', [['No problems', 10], ['Slightly impaired', 6], ['One step at a time', 2], ['Unable', 0]]],
  ['squatting', 'Squatting', [['No problems', 5], ['Slightly impaired', 4], ['Not past 90 degrees', 2], ['Unable', 0]]],
  ['range_of_motion', 'Range of Motion', [['Fully normal', 5], ['Slightly limited', 4], ['Flexion < 90 degrees or extension lag', 2], ['Flexion < 60 degrees', 0]]],
].map((entry) => {
  const [key, prompt, itemOptions] = /** @type {[string, string, Array<[string, number]>]} */ (entry);
  return questionnaireItem(key, prompt, options(itemOptions), { responseBinding: { field: 'responses', key } });
}));

export const ACL_RSI_QUESTIONS = deepFreeze([
  'Are you confident that you can perform at your previous level of sport?',
  'Do you think you are likely to re-injure your knee by participating in your sport?',
  'Are you nervous about playing your sport?',
  'Are you confident that your knee will not give way?',
  'Are you confident you could play your sport without concern for your knee?',
  'Do you find it frustrating to consider your knee with respect to sport?',
  'Are you fearful of re-injuring your knee by participating in your sport?',
  'Are you confident about your knee holding up under pressure?',
  'Are you afraid of accidentally injuring your knee?',
  'Do thoughts about your knee/surgery/rehabilitation prevent you from playing your sport?',
  'Are you confident about your ability to perform well at your sport?',
  'Do you feel relaxed about playing your sport?',
].map((prompt, index) => questionnaireItem(`q${index + 1}`, prompt, ZERO_TO_TEN, { responseBinding: { field: 'responses', index } })));

export const FABQ_QUESTIONS = deepFreeze([
  'My pain was caused by physical activity',
  'Physical activity makes my pain worse',
  'Physical activity might harm my back',
  'I should not do physical activities which might make my pain worse',
  'I cannot do physical activities which might make my pain worse',
  'My pain was caused by my work or by an accident at work',
  'My work aggravated my pain',
  'I have a claim for compensation for my pain',
  'My work is too heavy for me',
  'My work makes or would make my pain worse',
  'My work might harm my back',
  'I should not do my normal work with my present pain',
  'I cannot do my normal work with my present pain',
  'I cannot do my normal work till my pain is treated',
  'I do not think I will be back to normal work within 3 months',
  'I do not think I will ever be able to go back to work',
].map((prompt, index) => questionnaireItem(`q${index + 1}`, prompt, ZERO_TO_SIX, { responseBinding: { field: 'responses', index } })));

export const PSS_QUESTIONS = deepFreeze([
  ['In the last month, how often have you been upset because of something that happened unexpectedly?', false],
  ['In the last month, how often have you felt that you were unable to control the important things in your life?', false],
  ['In the last month, how often have you felt nervous and stressed?', false],
  ['In the last month, how often have you felt confident about your ability to handle your personal problems?', true],
  ['In the last month, how often have you felt that things were going your way?', true],
  ['In the last month, how often have you found that you could not cope with all the things that you had to do?', false],
  ['In the last month, how often have you been able to control irritations in your life?', true],
  ['In the last month, how often have you felt that you were on top of things?', true],
  ['In the last month, how often have you been angered because of things that were outside of your control?', false],
  ['In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?', false],
].map(([prompt, reversed], index) => questionnaireItem(`q${index + 1}`, prompt, ZERO_TO_FOUR, { reversed, responseBinding: { field: 'responses', index } })));

export const SGRQ_SYMPTOM_ITEMS = deepFreeze([
  ['s1', 'Over the last year, I have coughed:', false, [['Most days a week', 1.835], ['Several days a week', 1.1975], ['A few days a month', 0.6025], ['Only with respiratory infections', 0.335], ['Not at all', 0]]],
  ['s2', 'Over the last year, I have brought up phlegm (sputum):', false, [['Most days a week', 1.835], ['Several days a week', 1.1975], ['A few days a month', 0.6025], ['Only with respiratory infections', 0.335], ['Not at all', 0]]],
  ['s3', 'Over the last year, I have had shortness of breath:', false, [['Most days a week', 2.663], ['Several days a week', 2.1075], ['A few days a month', 1.085], ['Only with respiratory infections', 0.4025], ['Not at all', 0]]],
  ['s4', 'Over the last year, I have had attacks of wheezing:', false, [['Most days a week', 1.8375], ['Several days a week', 1.1975], ['A few days a month', 0.6025], ['Only with respiratory infections', 0.335], ['Not at all', 0]]],
  ['s5', 'During the last year, how many severe or very unpleasant attacks of chest trouble have you had?', false, [['More than 3 attacks', 2.35], ['3 attacks', 1.7325], ['2 attacks', 1.1975], ['1 attack', 0.4025], ['None', 0]]],
  ['s6', 'How long did the worst attack last? (Skip if no attacks)', true, [['A week or more', 2.35], ['3 or more days', 1.6775], ['1 or 2 days', 0.9325], ['Less than a day', 0.4025], ['No attacks / not applicable', 0]]],
  ['s7', 'Over the last year, in an average week, how many good days (with little chest trouble) have you had?', false, [['No good days', 3.59], ['1 or 2 good days', 2.8175], ['3 or 4 good days', 1.6025], ['Nearly every day is good', 0.8025], ['Every day is good', 0]]],
  ['s8', 'If you have a wheeze, is it worse in the morning?', false, [['Yes', 0.7025], ['No', 0]]],
].map((entry) => {
  const [key, prompt, optional, weightedOptions] = /** @type {[string, string, boolean, Array<[string, number]>]} */ (entry);
  return {
    key,
    prompt,
    type: 'single_choice',
    required: !optional,
    optional,
    options: weightedOptions.map(([label, weight], value) => ({ label, value, weight })),
  };
}));

export const SGRQ_ACTIVITY_ITEMS = deepFreeze([
  ['a1', 'Sitting or lying still', 1],
  ['a2', 'Washing or dressing yourself', 2.615],
  ['a3', 'Walking around the home', 2.615],
  ['a4', 'Walking outside on level ground', 3.22],
  ['a5', 'Walking up a flight of stairs or hills', 3.22],
  ['a6', 'Playing sports or games that are tiring', 4.015],
  ['a7', 'Strenuous sporting activities', 4.015],
].map(([key, label, weight]) => ({ key, label, weight })));

export const SGRQ_IMPACT_ITEMS = deepFreeze([
  ['i1', 'My cough or breathing is painful', 1.213],
  ['i2', 'My cough or breathing makes me tired', 1.397],
  ['i3', 'I am breathless when I talk', 2.64],
  ['i4', 'I am breathless when I bend over', 2.64],
  ['i5', 'My cough or breathing disturbs my sleep', 2.033],
  ['i6', 'I get exhausted easily', 1.84],
  ['i7', 'My chest condition affects me at home', 2.004],
  ['i8', 'My chest trouble is a nuisance to my family, friends or neighbours', 2.565],
  ['i9', 'I get afraid or panic when I cannot get my breath', 2.995],
  ['i10', 'I feel that I am not in control of my chest problem', 2.383],
  ['i11', 'I do not expect my chest to get any better', 1.34],
  ['i12', 'I have become frail or an invalid because of my chest', 2.427],
  ['i13', 'Exercise is not safe for me', 2.287],
  ['i14', 'Everything seems too much of an effort', 1.595],
  ['i15', 'My cough or breathing is embarrassing in public', 2.2],
  ['i16', 'My chest condition is a nuisance to others', 2.78],
  ['i17', 'My chest condition stops me doing what I would like', 2.86],
  ['i18', 'I cannot do sports or games', 3.21],
  ['i19', 'I cannot go out for entertainment or recreation', 3.52],
  ['i20', 'I cannot leave the house to do shopping', 4.03],
  ['i21', 'I cannot do household chores', 3.54],
  ['i22', 'I cannot climb stairs or hills', 3.485],
].map(([key, label, weight]) => ({ key, label, weight })));

const ASES_ADL_LABELS = deepFreeze([
  'Put on a coat',
  'Sleep on the affected side',
  'Wash your back/do up bra',
  'Manage toileting',
  'Comb your hair',
  'Reach a high shelf',
  'Lift 10lbs above your shoulder',
  'Throw a ball overhand',
  'Do your usual work',
  'Do your usual sport',
]);

const CONLEY_LABELS = deepFreeze({
  recent_fall: 'Fall within last 3 months',
  history_falls: 'History of falling',
  impaired_mobility: 'Impaired mobility',
  altered_elimination: 'Altered elimination (urgency/frequency/incontinence)',
  confusion: 'Confusion / disorientation / impulsivity',
  dizziness: 'Dizziness or vertigo',
  poor_judgment: 'Poor judgment / lack of awareness of limitations',
});

const N_AUGHTON_TERMINATION_OPTIONS = deepFreeze([
  'Patient requests to stop',
  'Moderate to severe angina or concerning chest symptoms',
  'Marked dyspnoea or severe fatigue',
  'Dizziness, near syncope, poor coordination, or signs of intolerance',
  'Abnormal BP response per site/medical protocol',
  'Serious rhythm or ECG concerns where monitored',
  'Equipment or gait safety issue',
  'Clinician concern for patient safety',
  'Completed all stages',
]);

const N_AUGHTON_PROTOCOLS = deepFreeze({
  classic_naughton: [
    [1, 2, 3.22, 0, 2.53], [2, 2, 3.22, 3.5, 3.5], [3, 2, 3.22, 7, 4.46],
    [4, 2, 3.22, 10.5, 5.43], [5, 2, 3.22, 14, 6.39], [6, 2, 3.22, 17.5, 7.36],
    [7, 2, 3.22, 21, 8.33],
  ],
  modified_naughton: [
    [1, 1, 1.61, 0, 1.52], [2, 1.5, 2.41, 0, 2.02], [3, 2, 3.22, 0, 2.53],
    [4, 2, 3.22, 3.5, 3.5], [5, 2, 3.22, 7, 4.46], [6, 2, 3.22, 10.5, 5.43],
    [7, 2, 3.22, 14, 6.39], [8, 2, 3.22, 17.5, 7.36],
  ],
});

const HEART_RATE_READING_FIELDS = deepFreeze([
  field('hr', 'Heart rate', 'number', true, { min: 20, max: 300, unit: 'bpm' }),
  field('rpe', 'Rating of perceived exertion', 'number', false, { min: 0, max: 20 }),
]);

const N_AUGHTON_STAGE_FIELDS = deepFreeze([
  field('stage', 'Stage number', 'integer', true, { min: 1, max: 8 }),
  field('timeSec', 'Elapsed test time', 'number', true, { min: 1, max: 960, unit: 's' }),
  field('heartRate', 'Stage heart rate', 'number', false, { min: 20, max: 300, unit: 'bpm' }),
  field('bp', 'Stage blood pressure', 'text', false),
  field('rpe', 'Stage RPE', 'number', false, { min: 0, max: 20 }),
  field('symptoms', 'Stage symptoms', 'textarea', false),
  field('speedMph', 'Stage speed', 'number', true, { min: 0.1, max: 10, unit: 'mph' }),
  field('speedKmh', 'Stage speed', 'number', true, { min: 0.1, max: 20, unit: 'km/h' }),
  field('grade', 'Stage grade', 'number', true, { min: 0, max: 30, unit: '%' }),
  field('mets', 'Estimated stage METs', 'number', true, { min: 0.1, max: 30, unit: 'MET' }),
]);

const SPECS = {
  hads: defineSpec({
    runnerKey: 'hads', name: 'Hospital Anxiety and Depression Scale (HADS)', kind: 'questionnaire',
    measurementType: 'hads', primaryField: 'total_score', unit: 'points',
    formula: 'Sum seven anxiety and seven depression item scores; total equals both subscales.',
    items: HADS_ITEMS,
  }),
  ebbeling: defineSpec({
    runnerKey: 'ebbeling', name: 'Ebbeling Single-Stage Treadmill Test', measurementType: 'ebbeling_sst', primaryField: 'estimated_vo2max', unit: 'mL/kg/min',
    formula: '15.1 + 21.8(speed mph) - 0.327(HR) - 0.263(speed mph × age) + 0.00504(HR × age) + 5.98(sex coefficient); steady-state HR is the rounded mean of minute 3 and 4.',
    fields: [
      field('age', 'Age', 'integer', true, { min: 15, max: 100, unit: 'years' }),
      field('gender', 'Sex', 'select', true, { options: options([['Male', 'male'], ['Female', 'female']]) }),
      field('resting_hr', 'Resting heart rate', 'number', false, { min: 20, max: 300, unit: 'bpm' }),
      field('warmup_speed', 'Walking speed', 'number', true, { min: 0.1, max: 30 }),
      field('warmup_speed_unit', 'Walking speed unit', 'select', true, { options: options([['Miles per hour', 'mph'], ['Kilometres per hour', 'kph']]) }),
      field('test_hr_readings', 'Minute-by-minute heart rate and RPE', 'object', true, {
        fields: ['min1', 'min2', 'min3', 'min4'].map((key, index) => field(key, `Minute ${index + 1}`, 'object', true, { fields: HEART_RATE_READING_FIELDS })),
      }),
      field('notes', 'Clinical notes', 'textarea', false),
    ],
  }),
  'harvard-step': defineSpec({
    runnerKey: 'harvard-step', name: 'Harvard Step Test', measurementType: 'harvard_step', primaryField: 'fitness_index', unit: 'index points',
    formula: 'Fitness Index = duration seconds × 100 ÷ (2 × sum of the three recovery pulse counts).',
    fields: [
      field('duration_completed', 'Completed duration', 'number', true, { min: 1, max: 300, unit: 's' }),
      field('hr_1min', 'Recovery pulse 1–2 minutes', 'number', true, { min: 20, max: 300, unit: 'bpm' }),
      field('hr_2min', 'Recovery pulse 2–3 minutes', 'number', true, { min: 20, max: 300, unit: 'bpm' }),
      field('hr_3min', 'Recovery pulse 3–4 minutes', 'number', true, { min: 20, max: 300, unit: 'bpm' }),
      field('reason_stopped', 'Reason stopped', 'text', false),
      field('observations', 'Clinical observations', 'textarea', false),
    ],
  }),
  'rockport-walk': defineSpec({
    runnerKey: 'rockport-walk', name: 'Rockport 1-Mile Walk Test', measurementType: 'rockport_walk', primaryField: 'estimated_vo2max', unit: 'mL/kg/min',
    formula: '132.853 - 0.0769(weight lb) - 0.3877(age) + 6.315(sex coefficient) - 3.2649(time minutes) - 0.1565(final heart rate).',
    fields: [
      field('age', 'Age', 'integer', true, { min: 13, max: 100, unit: 'years' }),
      field('gender', 'Sex', 'select', true, { options: options([['Male', 'male'], ['Female', 'female']]) }),
      field('walk_time_minutes', 'One-mile walk time', 'number', true, { min: 1, max: 60, unit: 'min' }),
      field('end_heart_rate', 'Final heart rate', 'number', true, { min: 20, max: 300, unit: 'bpm' }),
      field('weight_kg', 'Body weight', 'number', true, { min: 20, max: 400, unit: 'kg' }),
      field('rpe', 'Post-test RPE', 'number', false, { min: 6, max: 20 }),
      field('symptoms', 'Symptoms', 'textarea', false),
      field('notes', 'Clinical notes', 'textarea', false),
    ],
  }),
  'resting-heart-rate': defineSpec({
    runnerKey: 'resting-heart-rate', name: 'Resting Heart Rate', measurementType: 'resting_heart_rate', primaryField: 'heart_rate_bpm', unit: 'bpm',
    formula: 'Direct resting heart-rate measurement.',
    fields: [field('heart_rate_bpm', 'Resting heart rate', 'number', true, { min: 20, max: 300, unit: 'bpm' }), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  astrand: defineSpec({
    runnerKey: 'astrand', name: 'Åstrand-Rhyming Cycle Test', measurementType: 'astrand', primaryField: 'estimated_vo2max', unit: 'mL/kg/min',
    formula: 'Cycle workload is converted to kgm/min; ACSM cycle oxygen cost is scaled by predicted HRmax / steady-state HR and the recorded Åstrand age-correction factor.',
    fields: [
      field('sex', 'Sex', 'select', true, { options: options([['Male', 'male'], ['Female', 'female']]) }),
      field('age', 'Age', 'number', true, { min: 15, max: 80, unit: 'years' }),
      field('body_mass_kg', 'Body mass', 'number', true, { min: 20, max: 400, unit: 'kg' }),
      field('workload_watts', 'Cycle workload', 'number', true, { min: 1, max: 1000, unit: 'W' }),
      field('hr_minute4', 'Minute 4 heart rate', 'number', false, { min: 20, max: 300, unit: 'bpm' }),
      field('hr_minute5', 'Minute 5 heart rate', 'number', true, { min: 60, max: 170, unit: 'bpm' }),
      field('hr_minute6', 'Minute 6 heart rate', 'number', true, { min: 60, max: 170, unit: 'bpm' }),
      field('observations', 'Clinical observations', 'textarea', false),
    ],
  }),
  'vertical-jump': defineSpec({
    runnerKey: 'vertical-jump', name: 'Vertical Jump Test', measurementType: 'vertical_jump', primaryField: 'best_cm', unit: 'cm',
    formula: 'Maximum valid trial height; Sargent trials retain standing and jump reach alongside the derived height.',
    fields: [
      field('method', 'Measurement method', 'select', true, { options: options([['Jump mat / force plate', 'jump_mat'], ['Sargent reach method', 'sargent'], ['Other', 'other']]) }),
      field('trials', 'Vertical-jump trials', 'array', true, { minItems: 1, maxItems: 10, itemSchema: field('trial', 'Vertical-jump trial', 'object', true, { fields: [field('height_cm', 'Jump height', 'number', true, { min: 0.1, max: 200, unit: 'cm' }), field('method', 'Trial measurement method', 'select', true, { options: options([['Jump mat / force plate', 'jump_mat'], ['Sargent reach method', 'sargent'], ['Other', 'other']]) }), field('standing_reach_cm', 'Standing reach', 'number', false, { min: 1, max: 400, unit: 'cm' }), field('jump_reach_cm', 'Jump reach', 'number', false, { min: 1, max: 500, unit: 'cm' })] }) }),
      field('age', 'Age', 'integer', false, { min: 15, max: 120, unit: 'years' }),
      field('gender', 'Sex', 'select', false, { options: options([['Male', 'male'], ['Female', 'female']]) }),
      field('notes', 'Clinical notes', 'textarea', false),
    ],
  }),
  ases: defineSpec({
    runnerKey: 'ases', name: 'American Shoulder and Elbow Surgeons (ASES) Score', measurementType: 'ases', primaryField: 'total_score', unit: 'points',
    formula: '(10 - pain VAS) × 5 + (sum of ten ADL items ÷ 30) × 50.',
    fields: [
      field('pain_score', 'Pain VAS', 'integer', true, { min: 0, max: 10 }),
      field('adl_scores', 'Activities of daily living', 'array', true, { minItems: 10, maxItems: 10, length: 10, itemSchema: field('score', 'ADL difficulty score', 'integer', true, { min: 0, max: 3 }), entries: ASES_ADL_LABELS.map((label, index) => field(String(index), label, 'integer', true, { min: 0, max: 3 })) }),
      field('notes', 'Clinical notes', 'textarea', false),
    ],
  }),
  'constant-murley': defineSpec({
    runnerKey: 'constant-murley', name: 'Constant-Murley Score', measurementType: 'constant_murley', primaryField: 'total_score', unit: 'points',
    formula: 'Pain (15) + activities of daily living (20) + range of motion (40) + strength (25).',
    fields: [
      field('pain', 'Pain subscore', 'integer', true, { min: 0, max: 15 }),
      field('adl_scores', 'Activities of daily living subscores', 'object', true, { fields: [field('work', 'Work', 'integer', true, { min: 0, max: 4 }), field('leisure', 'Recreation / sport', 'integer', true, { min: 0, max: 4 }), field('sleep', 'Sleep', 'integer', true, { min: 0, max: 2 }), field('positioning', 'Hand positioning', 'integer', true, { min: 0, max: 10 })] }),
      field('range_of_motion', 'Range of motion observations', 'object', true, { fields: [field('flexion', 'Forward flexion', 'number', true, { min: 0, max: 180, unit: 'degrees' }), field('abduction', 'Abduction', 'number', true, { min: 0, max: 180, unit: 'degrees' }), field('external_rotation', 'External rotation', 'number', true, { min: 0, max: 180, unit: 'degrees' }), field('internal_rotation', 'Internal rotation landmark level', 'number', true, { min: 0, max: 10 })] }),
      field('strength', 'Abduction strength subscore', 'number', true, { min: 0, max: 25, unit: 'lb / points' }),
      field('notes', 'Clinical notes', 'textarea', false),
    ],
  }),
  lysholm: defineSpec({
    runnerKey: 'lysholm', name: 'Lysholm Knee Score', kind: 'questionnaire', measurementType: 'lysholm', primaryField: 'total_score', unit: 'points', formula: 'Sum the nine item scores.', items: LYSHOLM_ITEMS,
  }),
  'acl-rsi': defineSpec({
    runnerKey: 'acl-rsi', name: 'ACL Return to Sport after Injury (ACL-RSI)', kind: 'questionnaire', measurementType: 'aclrsi', primaryField: 'percentage_score', unit: '%', formula: 'Sum twelve 0–10 responses and divide by 120, then multiply by 100.', items: ACL_RSI_QUESTIONS,
  }),
  fabq: defineSpec({
    runnerKey: 'fabq', name: 'Fear-Avoidance Beliefs Questionnaire (FABQ)', kind: 'questionnaire', measurementType: 'fabq', primaryField: 'total_score', unit: 'points', formula: 'Sum all sixteen 0–6 responses; retain the existing first-five physical-activity and remaining-eleven work partitions.', items: FABQ_QUESTIONS,
  }),
  'drop-vertical-jump': defineSpec({
    runnerKey: 'drop-vertical-jump', name: 'Drop Vertical Jump', measurementType: 'drop_vertical_jump', primaryField: 'jump_height_cm', unit: 'cm',
    formula: 'Direct jump-height result with landing knee-flexion and knee-valgus angle observations retained.',
    fields: [field('jump_height_cm', 'Jump height', 'number', true, { min: 0.1, max: 200, unit: 'cm' }), field('knee_angle_degrees', 'Knee angle at landing', 'number', true, { min: -180, max: 180, unit: 'degrees' }), field('knee_valgus_degrees', 'Knee valgus angle', 'number', true, { min: -180, max: 180, unit: 'degrees' }), field('notes', 'Clinical notes', 'textarea', false)],
  }),
  naughton: defineSpec({
    runnerKey: 'naughton', name: 'Naughton Treadmill Protocol', measurementType: 'treadmill_protocol', primaryField: 'total_time_seconds', unit: 's',
    formula: 'Direct elapsed duration on the selected fixed two-minute-stage Naughton protocol; exact stage settings and observations are retained.',
    fields: [
      field('protocol_key', 'Protocol', 'select', true, { options: options([['Classic Naughton', 'classic_naughton'], ['Modified Naughton', 'modified_naughton']]) }),
      field('total_time_seconds', 'Total test time', 'integer', true, { min: 1, max: 960, unit: 's' }),
      field('current_stage_index', 'Final zero-based stage index', 'integer', true, { min: 0, max: 7 }),
      field('stage_data', 'Recorded stage observations', 'array', true, { minItems: 1, maxItems: 8, itemSchema: field('stage', 'Naughton stage observation', 'object', true, { fields: N_AUGHTON_STAGE_FIELDS }) }),
      field('termination_reason', 'Termination reason', 'select', true, { options: options(N_AUGHTON_TERMINATION_OPTIONS.map((entry) => [entry, entry])) }),
      field('notes', 'Clinical notes', 'textarea', false),
    ],
  }),
  sgrq: defineSpec({
    runnerKey: 'sgrq', name: "St George's Respiratory Questionnaire (SGRQ)", measurementType: 'sgrq', primaryField: 'total_score', unit: 'points',
    formula: 'Each domain is the selected weighted sum divided by the exact maximum domain weight × 100; total uses all three weighted sums over the combined maximum weight.',
    fields: [
      field('diagnosis', 'Primary respiratory diagnosis', 'text', false),
      field('smoking_status', 'Smoking status', 'select', false, { options: options([['Current smoker', 'Current smoker'], ['Ex-smoker', 'Ex-smoker'], ['Never smoked', 'Never smoked']]) }),
      field('oxygen_use', 'Supplemental oxygen use', 'select', false, { options: YES_NO }),
      field('exacerbations', 'Exacerbations in the last year', 'integer', false, { min: 0, max: 100 }),
      field('rehab', 'Currently in pulmonary rehabilitation', 'select', false, { options: YES_NO }),
      field('admin_mode', 'Administration mode', 'select', false, { options: options([['Clinician-administered', 'Clinician-administered'], ['Self-report', 'Self-report'], ['Caregiver-assisted', 'Caregiver-assisted']]) }),
      field('symptoms_responses', 'Symptoms domain responses', 'object', true, { fields: SGRQ_SYMPTOM_ITEMS.map((item) => field(item.key, item.prompt, 'select', item.required, { options: item.options })) }),
      field('activity_responses', 'Activity domain responses', 'object', true, { fields: SGRQ_ACTIVITY_ITEMS.map((item) => field(item.key, item.label, 'boolean', true, { weight: item.weight })) }),
      field('impact_responses', 'Impact domain responses', 'object', true, { fields: SGRQ_IMPACT_ITEMS.map((item) => field(item.key, item.label, 'boolean', true, { weight: item.weight })) }),
      field('notes', 'Clinical notes', 'textarea', false),
    ],
  }),
  dexa: defineSpec({
    runnerKey: 'dexa', name: 'DEXA Scan Results Interpretation', measurementType: 'dexa', primaryField: 'worst_t_score', unit: 'T-score',
    formula: 'The lowest recorded site T-score is the stable primary result; all site-specific T-scores, BMD and body-composition observations are retained.',
    fields: [
      field('t_scores', 'Site T-scores', 'object', true, { fields: [field('lumbarSpine', 'Lumbar Spine (L1-L4) T-score', 'number', false, { min: -10, max: 10 }), field('femoralNeck', 'Femoral Neck T-score', 'number', false, { min: -10, max: 10 }), field('totalHip', 'Total Hip T-score', 'number', false, { min: -10, max: 10 }), field('distalRadius', 'Distal Radius (1/3) T-score', 'number', false, { min: -10, max: 10 })] }),
      field('bmd_values', 'Site bone mineral density', 'object', false, { fields: [field('lumbarSpine', 'Lumbar Spine (L1-L4) BMD', 'number', false, { min: 0, max: 5, unit: 'g/cm²' }), field('femoralNeck', 'Femoral Neck BMD', 'number', false, { min: 0, max: 5, unit: 'g/cm²' }), field('totalHip', 'Total Hip BMD', 'number', false, { min: 0, max: 5, unit: 'g/cm²' }), field('distalRadius', 'Distal Radius (1/3) BMD', 'number', false, { min: 0, max: 5, unit: 'g/cm²' })] }),
      field('body_fat_percentage', 'Body fat', 'number', false, { min: 0, max: 100, unit: '%' }),
      field('visceral_adipose_tissue', 'Visceral adipose tissue', 'number', false, { min: 0, max: 1000, unit: 'cm²' }),
      field('lean_mass_kg', 'Lean mass', 'number', false, { min: 0, max: 400, unit: 'kg' }),
      field('notes', 'Clinical notes', 'textarea', false),
    ],
  }),
  conley: defineSpec({
    runnerKey: 'conley', name: 'Conley Scale (Falls Risk)', kind: 'questionnaire', measurementType: 'conley_scale', primaryField: 'total_score', unit: 'points',
    formula: 'Count the seven positive binary findings.',
    items: Object.entries(CONLEY_LABELS).map(([key, prompt]) => questionnaireItem(key, prompt, YES_NO, { responseBinding: { field: 'scores', key } })),
  }),
  'perceived-stress-scale': defineSpec({
    runnerKey: 'perceived-stress-scale', name: 'Perceived Stress Scale (PSS-10)', kind: 'questionnaire', measurementType: 'pss', primaryField: 'total_score', unit: 'points',
    formula: 'Sum ten 0–4 items after reversing items 4, 5, 7 and 8.',
    items: PSS_QUESTIONS,
  }),
  'heart-rate-recovery': defineSpec({
    runnerKey: 'heart-rate-recovery', name: 'Heart Rate Recovery (HRR)', measurementType: 'heart_rate_recovery', primaryField: 'hrr_1_minute', unit: 'bpm',
    formula: 'HRR at each time point equals peak exercise heart rate minus heart rate at that recovery time point.',
    fields: [
      field('peak_heart_rate', 'Peak exercise heart rate', 'integer', true, { min: 20, max: 300, unit: 'bpm' }),
      field('hr_1_minute', 'Heart rate at one minute', 'integer', true, { min: 20, max: 300, unit: 'bpm' }),
      field('hr_2_minute', 'Heart rate at two minutes', 'integer', false, { min: 20, max: 300, unit: 'bpm' }),
      field('additional_measurements', 'Additional recovery measurements', 'array', false, { minItems: 0, maxItems: 20, itemSchema: field('measurement', 'Recovery heart-rate observation', 'object', true, { fields: [field('timepoint', 'Recovery time point', 'number', false, { min: 0.1, max: 60, unit: 'min' }), field('label', 'Time-point label', 'text', false), field('hr', 'Heart rate', 'integer', true, { min: 20, max: 300, unit: 'bpm' })] }) }),
      field('recovery_mode', 'Recovery mode', 'select', true, { options: options([['Passive standing', 'passive_standing'], ['Passive seated', 'passive_seated'], ['Active walking', 'active_walking'], ['Supine', 'supine']]) }),
      field('preceding_test', 'Preceding exercise test', 'text', false),
      field('symptoms', 'Symptoms during recovery', 'textarea', false),
      field('notes', 'Clinical notes', 'textarea', false),
    ],
  }),
  'lipid-profile': defineSpec({
    runnerKey: 'lipid-profile', name: 'Lipid Profile', measurementType: 'lipid_profile', primaryField: 'total_cholesterol', unit: 'recorded unit',
    formula: 'Direct total cholesterol result with LDL, HDL, triglycerides, unit, conversions and category bands retained.',
    fields: [
      field('unit', 'Unit standard', 'select', true, { options: options([['USA (mg/dL)', 'mgdl'], ['Australian (mmol/L)', 'mmol']]) }),
      field('total_cholesterol', 'Total cholesterol', 'number', true, { min: 0, max: 2000 }),
      field('ldl', 'LDL cholesterol', 'number', false, { min: 0, max: 2000 }),
      field('hdl', 'HDL cholesterol', 'number', false, { min: 0, max: 1000 }),
      field('triglycerides', 'Triglycerides', 'number', false, { min: 0, max: 5000 }),
      field('notes', 'Clinical notes', 'textarea', false),
    ],
  }),
  'borg-rpe': defineSpec({
    runnerKey: 'borg-rpe', name: 'Borg Rating of Perceived Exertion', measurementType: 'borg_rpe', primaryField: 'rpe_value', unit: 'rating',
    formula: 'Direct rating on the explicitly selected Borg 6–20 or modified CR10 scale.',
    fields: [
      field('scale_type', 'Borg scale', 'select', true, { options: options([['Borg RPE (6–20)', 'borg_6_20'], ['Modified CR10 (0–10)', 'cr10']]) }),
      field('rpe_value', 'Perceived exertion rating', 'number'),
      field('activity_description', 'Activity being rated', 'text', false),
      field('notes', 'Clinical notes', 'textarea', false),
    ],
  }),
  quickdash: defineSpec({
    runnerKey: 'quickdash', name: 'QuickDASH', measurementType: 'questionnaire_external', primaryField: 'total_score', unit: 'points',
    formula: 'Externally administered QuickDASH score; when all eleven item scores are summed, score = ((raw sum ÷ 11) - 1) × 25.',
    fields: [
      field('raw_sum', 'Sum of eleven item scores', 'integer', false, { min: 11, max: 55 }),
      field('total_score', 'QuickDASH score', 'number', true, { min: 0, max: 100 }),
      field('assessor_name', 'Assessor name', 'text', false),
      field('assessment_date', 'Assessment date', 'date'),
      field('notes', 'Clinical notes', 'textarea', false),
    ],
  }),
};

export const RUNNER_SPECS = deepFreeze(RUNNER_KEYS.map((key) => SPECS[key]));
export const RUNNER_SPEC_BY_KEY = deepFreeze(Object.fromEntries(RUNNER_SPECS.map((spec) => [spec.runnerKey, spec])));

function present(value) {
  return value !== '' && value !== null && value !== undefined;
}

function requiredNumber(value, label, { min = -Infinity, max = Infinity, integer = false } = {}) {
  invariant(present(value), `${label} is required`);
  const number = Number(value);
  invariant(Number.isFinite(number), `${label} must be a finite number`);
  invariant(number >= min && number <= max, `${label} must be between ${min} and ${max}`);
  invariant(!integer || Number.isInteger(number), `${label} must be a whole number`);
  return number;
}

function optionalNumber(value, label, limits = {}) {
  return present(value) ? requiredNumber(value, label, limits) : null;
}

function requiredText(value, label, max = 500) {
  const text = String(value ?? '').trim();
  invariant(text, `${label} is required`);
  invariant(text.length <= max, `${label} must not exceed ${max} characters`);
  return text;
}

function optionalText(value, label, max = NOTES_MAX) {
  if (!present(value)) return '';
  const text = String(value).trim();
  invariant(text.length <= max, `${label} must not exceed ${max} characters`);
  return text;
}

function requiredChoice(value, label, permitted) {
  invariant(permitted.includes(value), `${label} must be one of ${permitted.join(', ')}`);
  return value;
}

function requiredBoolean(value, label) {
  invariant(typeof value === 'boolean', `${label} must be explicitly true or false`);
  return value;
}

function requiredObject(value, label) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function requiredArray(value, label, { min = 0, max = Infinity, length = null } = {}) {
  invariant(Array.isArray(value), `${label} must be an array`);
  if (length !== null) invariant(value.length === length, `${label} must contain exactly ${length} entries`);
  else invariant(value.length >= min && value.length <= max, `${label} must contain ${min} to ${max} entries`);
  return value;
}

function normalizeResponses(value, length, label) {
  const responses = requiredArray(value, label, { length });
  return responses;
}

function responseObject(input, items, label) {
  const source = requiredObject(input, label);
  const exactKeys = items.map(({ key }) => key);
  const observedKeys = Object.keys(source);
  invariant(observedKeys.length === exactKeys.length && exactKeys.every((key) => Object.hasOwn(source, key)), `${label} must contain every exact item`);
  return source;
}

function normalizeNotes(input, context) {
  return optionalText(input?.notes ?? context?.notes, 'Clinical notes');
}

function interpretationBand(score, bands) {
  for (const [maximum, label] of bands) if (score <= maximum) return label;
  return bands.at(-1)?.[1] || 'Recorded';
}

function assertFiniteTree(value, path = 'payload') {
  if (typeof value === 'number') invariant(Number.isFinite(value), `${path} contains a non-finite number`);
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) assertFiniteTree(nested, `${path}.${key}`);
}

function finish({ key, input, context = {}, result, notes, soapText, interpretation, additional = {} }) {
  const spec = RUNNER_SPEC_BY_KEY[key];
  invariant(spec, `unsupported runner key ${key}`);
  invariant(Number.isFinite(result), `${key} primary result must be finite`);
  invariant(typeof soapText === 'string' && soapText.trim(), `${key} SOAP text is required`);
  invariant(typeof interpretation === 'string' && interpretation.trim(), `${key} interpretation is required`);
  const runtimeContext = /** @type {Record<string, any>} */ (context);
  const assessmentDate = String(runtimeContext.assessmentDate || input?.assessment_date || todayLocal()).trim();
  invariant(LOCAL_DATE.test(assessmentDate), `${key} assessment date must use YYYY-MM-DD`);
  const rawInput = clone(input);
  for (const routeKey of ['runnerKey', 'runner_key', 'scoringKey', 'scoring_key']) delete rawInput[routeKey];
  const additionalData = {
    measurement_type: spec.measurementType,
    scoring_key: spec.scoringKey,
    scoring_version: spec.scoring.version,
    raw_input: rawInput,
    ...additional,
    interpretation,
    soap_text: soapText,
    report_text: `${runtimeContext.assessmentName || spec.name}\n${soapText}`,
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

function selectedLabel(item, value) {
  return item.options.find((option) => option.value === value)?.label || String(value);
}

function normalizedQuestionnaireArray(input, items, label, limits) {
  const raw = normalizeResponses(input?.responses, items.length, label);
  return raw.map((value, index) => {
    const number = requiredNumber(value, `${label} item ${index + 1}`, limits);
    invariant(items[index].options.some((option) => option.value === number), `${label} item ${index + 1} is not a permitted response`);
    return number;
  });
}

function hadsLevel(score, subscale) {
  if (score <= 7) return `Normal ${subscale}`;
  if (score <= 10) return `Borderline abnormal ${subscale}`;
  return `Abnormal ${subscale} - Clinical concern`;
}

export function scoreHads(input, context = {}) {
  const raw = requiredObject(input?.scores, 'HADS scores');
  const scores = {};
  for (const [index, item] of HADS_ITEMS.entries()) {
    const sourceValue = raw[item.key] ?? raw[String(index + 1)];
    const value = requiredNumber(sourceValue, `HADS item ${index + 1}`, { min: 0, max: 3, integer: true });
    invariant(item.options.some((option) => option.value === value), `HADS item ${index + 1} is not a permitted response`);
    scores[item.key] = value;
  }
  const anxietyScore = HADS_ITEMS.reduce((sum, item) => sum + (item.subscale === 'anxiety' ? scores[item.key] : 0), 0);
  const depressionScore = HADS_ITEMS.reduce((sum, item) => sum + (item.subscale === 'depression' ? scores[item.key] : 0), 0);
  const total = anxietyScore + depressionScore;
  const anxietyInterpretation = hadsLevel(anxietyScore, 'anxiety');
  const depressionInterpretation = hadsLevel(depressionScore, 'depression');
  const notes = normalizeNotes(input, context);
  const itemLines = HADS_ITEMS.map((item, index) => `  Q${index + 1}. ${item.prompt} [${item.subscale}]\n      Answer: ${selectedLabel(item, scores[item.key])} (Score: ${scores[item.key]})`);
  const soapText = [
    '• Hospital Anxiety and Depression Scale (HADS)',
    ...itemLines,
    `  Anxiety: ${anxietyScore}/21 — ${anxietyInterpretation}`,
    `  Depression: ${depressionScore}/21 — ${depressionInterpretation}`,
    `  Total HADS Score: ${total}/42`,
    notes ? `  Clinical Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'hads', input: { scores, notes }, context, result: total, notes, soapText,
    interpretation: `${anxietyInterpretation}; ${depressionInterpretation}`,
    additional: { anxiety_score: anxietyScore, depression_score: depressionScore, total_score: total, anxiety_interpretation: anxietyInterpretation, depression_interpretation: depressionInterpretation, item_scores: scores },
  });
}

const EBBELING_NORMS = deepFreeze({
  male: { 20: [38, 42, 51, 55], 30: [35, 39, 48, 52], 40: [32, 36, 45, 49], 50: [28, 32, 41, 45], 60: [24, 28, 37, 41] },
  female: { 20: [30, 34, 42, 46], 30: [27, 31, 39, 43], 40: [24, 28, 36, 40], 50: [21, 25, 33, 37], 60: [18, 22, 30, 34] },
});

function ebbelingInterpretation(vo2max, age, gender) {
  const ageGroup = Math.min(60, Math.max(20, Math.floor(age / 10) * 10));
  const [poor, fair, good, excellent] = EBBELING_NORMS[gender][ageGroup];
  if (vo2max >= excellent) return 'Excellent';
  if (vo2max >= good) return 'Good';
  if (vo2max >= fair) return 'Fair';
  if (vo2max >= poor) return 'Below Average';
  return 'Below Average';
}

export function scoreEbbeling(input, context = {}) {
  const age = requiredNumber(input?.age, 'Age', { min: 15, max: 100, integer: true });
  const gender = requiredChoice(input?.gender, 'Sex', ['male', 'female']);
  const restingHr = optionalNumber(input?.resting_hr, 'Resting heart rate', { min: 20, max: 300, integer: true });
  const speedUnit = requiredChoice(input?.warmup_speed_unit, 'Walking speed unit', ['mph', 'kph']);
  const warmupSpeed = requiredNumber(input?.warmup_speed, 'Walking speed', { min: 0.1, max: speedUnit === 'mph' ? 20 : 30 });
  const readingsObject = requiredObject(input?.test_hr_readings, 'Minute heart-rate readings');
  const readings = {};
  for (const [index, key] of ['min1', 'min2', 'min3', 'min4'].entries()) {
    const row = requiredObject(readingsObject[key], `Minute ${index + 1} reading`);
    const required = index >= 2;
    readings[key] = {
      hr: required ? requiredNumber(row.hr, `Minute ${index + 1} heart rate`, { min: 20, max: 300, integer: true }) : optionalNumber(row.hr, `Minute ${index + 1} heart rate`, { min: 20, max: 300, integer: true }),
      rpe: optionalNumber(row.rpe, `Minute ${index + 1} RPE`, { min: 0, max: 20 }),
    };
  }
  const steadyStateDifference = Math.abs(readings.min4.hr - readings.min3.hr);
  invariant(steadyStateDifference <= 5, `Minute 3 and 4 heart rates must be within 5 bpm for steady state (observed ${steadyStateDifference})`);
  const steadyStateHr = Math.round((readings.min3.hr + readings.min4.hr) / 2);
  const speedMph = speedUnit === 'kph' ? warmupSpeed * 0.621371 : warmupSpeed;
  const sexCoefficient = gender === 'male' ? 1 : 0;
  const vo2max = round(15.1 + (21.8 * speedMph) - (0.327 * steadyStateHr) - (0.263 * speedMph * age) + (0.00504 * steadyStateHr * age) + (5.98 * sexCoefficient), 1);
  const interpretation = ebbelingInterpretation(vo2max, age, gender);
  const notes = normalizeNotes(input, context);
  const readingLines = Object.entries(readings).map(([key, row], index) => `  Minute ${index + 1}: HR ${row.hr ?? '—'} bpm; RPE ${row.rpe ?? '—'}`);
  const soapText = [
    '• Ebbeling Single-Stage Treadmill Test',
    `  Estimated VO2max: ${vo2max} mL/kg/min — ${interpretation}`,
    `  Age: ${age} | Sex: ${gender}`,
    restingHr === null ? null : `  Resting HR: ${restingHr} bpm`,
    `  Walking speed: ${warmupSpeed} ${speedUnit} (${round(speedMph, 4)} mph) at 5% grade`,
    ...readingLines,
    `  Steady-state HR: ${steadyStateHr} bpm`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'ebbeling', input: { age, gender, resting_hr: restingHr, warmup_speed: warmupSpeed, warmup_speed_unit: speedUnit, test_hr_readings: readings, notes }, context,
    result: vo2max, notes, soapText, interpretation,
    additional: { age, gender, resting_hr: restingHr, hr_max: 220 - age, hr_target_50: Math.round((220 - age) * 0.5), hr_target_70: Math.round((220 - age) * 0.7), warmup_speed: warmupSpeed, warmup_speed_unit: speedUnit, speed_mph: round(speedMph, 6), test_hr_readings: readings, steady_state_hr: steadyStateHr, calculated_vo2max: vo2max },
  });
}

export function scoreHarvardStep(input, context = {}) {
  const duration = requiredNumber(input?.duration_completed, 'Completed duration', { min: 1, max: 300 });
  const heartRates = ['hr_1min', 'hr_2min', 'hr_3min'].map((key, index) => requiredNumber(input?.[key], `Recovery heart rate ${index + 1}`, { min: 20, max: 300 }));
  const denominator = 2 * heartRates.reduce((sum, value) => sum + value, 0);
  invariant(denominator > 0, 'Recovery heart-rate sum must be positive');
  const fitnessIndex = round((duration * 100) / denominator, 1);
  const interpretation = fitnessIndex >= 90 ? 'Excellent' : fitnessIndex >= 80 ? 'Good' : fitnessIndex >= 65 ? 'Average' : fitnessIndex >= 55 ? 'Below Average' : 'Poor';
  const reasonStopped = optionalText(input?.reason_stopped, 'Reason stopped', 500);
  const notes = optionalText(input?.observations ?? input?.notes ?? context?.notes, 'Clinical observations');
  const soapText = [
    '• Harvard Step Test',
    `  Duration: ${duration} s`,
    `  Recovery HRs: ${heartRates.join(', ')} bpm`,
    `  Fitness Index: ${fitnessIndex} — ${interpretation}`,
    reasonStopped ? `  Stopped: ${reasonStopped}` : null,
    notes ? `  Observations: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'harvard-step', input: { duration_completed: duration, hr_1min: heartRates[0], hr_2min: heartRates[1], hr_3min: heartRates[2], reason_stopped: reasonStopped, observations: notes }, context,
    result: fitnessIndex, notes, soapText, interpretation,
    additional: { duration_completed: duration, hr_1min: heartRates[0], hr_2min: heartRates[1], hr_3min: heartRates[2], fitness_index: fitnessIndex, reason_stopped: reasonStopped },
  });
}

function rockportCategory(vo2, age, gender) {
  const thresholds = gender === 'male'
    ? age < 40 ? [33, 38, 45, 52] : age < 60 ? [27, 32, 39, 46] : [20, 25, 31, 37]
    : age < 40 ? [27, 31, 38, 45] : age < 60 ? [21, 25, 31, 38] : [17, 21, 26, 32];
  if (vo2 >= thresholds[3]) return 'Excellent';
  if (vo2 >= thresholds[2]) return 'Good';
  if (vo2 >= thresholds[1]) return 'Average';
  if (vo2 >= thresholds[0]) return 'Fair';
  return 'Poor';
}

export function scoreRockportWalk(input, context = {}) {
  const age = requiredNumber(input?.age, 'Age', { min: 13, max: 100, integer: true });
  const gender = requiredChoice(input?.gender, 'Sex', ['male', 'female']);
  const walkTime = requiredNumber(input?.walk_time_minutes, 'Walk time', { min: 1, max: 60 });
  const endHr = requiredNumber(input?.end_heart_rate, 'Final heart rate', { min: 20, max: 300, integer: true });
  const weightKg = requiredNumber(input?.weight_kg, 'Body weight', { min: 20, max: 400 });
  const rpe = optionalNumber(input?.rpe, 'RPE', { min: 6, max: 20 });
  const symptoms = optionalText(input?.symptoms, 'Symptoms');
  const notes = normalizeNotes(input, context);
  const weightLb = weightKg * 2.20462;
  const vo2 = round(132.853 - (0.0769 * weightLb) - (0.3877 * age) + (6.315 * (gender === 'male' ? 1 : 0)) - (3.2649 * walkTime) - (0.1565 * endHr), 1);
  const interpretation = rockportCategory(vo2, age, gender);
  const soapText = [
    '• Rockport 1-Mile Walk Test',
    `  Walk Time: ${walkTime} min | Final HR: ${endHr} bpm | Weight: ${weightKg} kg`,
    `  Estimated VO2max: ${vo2} mL/kg/min — ${interpretation}`,
    rpe === null ? null : `  RPE: ${rpe}/20`,
    symptoms ? `  Symptoms: ${symptoms}` : null,
    notes ? `  Clinical Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'rockport-walk', input: { age, gender, walk_time_minutes: walkTime, end_heart_rate: endHr, weight_kg: weightKg, rpe, symptoms, notes }, context,
    result: vo2, notes, soapText, interpretation,
    additional: { age, gender, walk_time_minutes: walkTime, end_heart_rate: endHr, weight_kg: weightKg, weight_lb: round(weightLb, 4), estimated_vo2max: vo2, fitness_category: interpretation, rpe, symptoms },
  });
}

function heartRateInterpretation(value) {
  if (value < 40) return 'Severe Bradycardia';
  if (value < 60) return 'Bradycardia';
  if (value <= 100) return 'Normal';
  if (value <= 120) return 'Mild Tachycardia';
  return 'Tachycardia';
}

export function scoreRestingHeartRate(input, context = {}) {
  const heartRate = requiredNumber(input?.heart_rate_bpm, 'Resting heart rate', { min: 20, max: 300, integer: true });
  const interpretation = heartRateInterpretation(heartRate);
  const notes = normalizeNotes(input, context);
  const soapText = `• Resting Heart Rate\n  Heart Rate: ${heartRate} bpm — ${interpretation}${notes ? `\n  Clinical Notes: ${notes}` : ''}`;
  return finish({ key: 'resting-heart-rate', input: { heart_rate_bpm: heartRate, notes }, context, result: heartRate, notes, soapText, interpretation, additional: { heart_rate: heartRate, heart_rate_bpm: heartRate } });
}

function astrandAgeFactor(age) {
  if (age <= 24) return 1.1;
  if (age <= 34) return 1;
  if (age <= 44) return 0.87;
  if (age <= 54) return 0.83;
  if (age <= 64) return 0.78;
  return 0.75;
}

function astrandCategory(vo2, sex, age) {
  const rows = sex === 'male'
    ? [[29, 52, 43, 34], [39, 50, 41, 32], [49, 45, 38, 30], [59, 42, 35, 27], [200, 38, 31, 24]]
    : [[29, 41, 35, 27], [39, 39, 33, 25], [49, 36, 29, 22], [59, 34, 27, 20], [200, 30, 24, 17]];
  const [, excellent, good, fair] = rows.find(([maxAge]) => age <= maxAge);
  if (vo2 >= excellent) return 'Excellent';
  if (vo2 >= good) return 'Good';
  if (vo2 >= fair) return 'Fair';
  return 'Poor';
}

export function scoreAstrand(input, context = {}) {
  const sex = requiredChoice(input?.sex, 'Sex', ['male', 'female']);
  const age = requiredNumber(input?.age, 'Age', { min: 15, max: 80 });
  const bodyMass = requiredNumber(input?.body_mass_kg, 'Body mass', { min: 20, max: 400 });
  const watts = requiredNumber(input?.workload_watts, 'Workload', { min: 1, max: 1000 });
  const hr4 = optionalNumber(input?.hr_minute4, 'Minute 4 heart rate', { min: 20, max: 300 });
  const hr5 = requiredNumber(input?.hr_minute5, 'Minute 5 heart rate', { min: 60, max: 170 });
  const hr6 = requiredNumber(input?.hr_minute6, 'Minute 6 heart rate', { min: 60, max: 170 });
  const steadyDifference = Math.abs(hr6 - hr5);
  invariant(steadyDifference <= 5, `Minute 5 and 6 heart rates must be within 5 bpm for steady state (observed ${steadyDifference})`);
  const steadyStateHr = (hr5 + hr6) / 2;
  const predictedHrMax = 220 - age;
  const kgmMin = watts * 6.12;
  const vo2Submax = ((1.8 * kgmMin) / bodyMass) + 7;
  const vo2Uncorrected = vo2Submax * (predictedHrMax / steadyStateHr);
  const ageFactor = astrandAgeFactor(age);
  const vo2Final = round(vo2Uncorrected * ageFactor, 1);
  const interpretation = astrandCategory(vo2Final, sex, age);
  const warnings = [];
  if (steadyStateHr < 120) warnings.push('Average steady-state HR below 120 bpm');
  if (steadyStateHr > 0.85 * predictedHrMax) warnings.push('Average steady-state HR above 85% of predicted HRmax');
  if (hr4 !== null && Math.abs(hr4 - hr5) > 5) warnings.push('Minute 4 and 5 HR differ by more than 5 bpm');
  const notes = optionalText(input?.observations ?? input?.notes ?? context?.notes, 'Clinical observations');
  const soapText = [
    '• Åstrand-Rhyming Cycle Ergometer Test',
    `  Sex: ${sex} | Age: ${age} years | Body mass: ${bodyMass} kg`,
    `  Workload: ${watts} W (${round(kgmMin, 1)} kgm/min)`,
    `  HR: minute 5 ${hr5} bpm | minute 6 ${hr6} bpm${hr4 === null ? '' : ` | minute 4 ${hr4} bpm`}`,
    `  Steady-state HR: ${round(steadyStateHr, 1)} bpm | Predicted HRmax: ${round(predictedHrMax, 1)} bpm`,
    `  Estimated VO2max: ${vo2Final} mL/kg/min — ${interpretation}`,
    warnings.length ? `  Flags: ${warnings.join('; ')}` : null,
    notes ? `  Observations: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'astrand', input: { sex, age, body_mass_kg: bodyMass, workload_watts: watts, hr_minute4: hr4, hr_minute5: hr5, hr_minute6: hr6, observations: notes }, context,
    result: vo2Final, notes, soapText, interpretation,
    additional: { sex, age, body_mass_kg: bodyMass, workload_watts: watts, hr_minute4: hr4, hr_minute5: hr5, hr_minute6: hr6, steady_state_hr: round(steadyStateHr, 1), predicted_hrmax: round(predictedHrMax, 1), age_correction_factor: ageFactor, vo2_submax: round(vo2Submax, 1), vo2_uncorrected: round(vo2Uncorrected, 1), estimated_vo2max: vo2Final, category: interpretation, warnings, observations: notes },
  });
}

const VERTICAL_JUMP_NORMS = deepFreeze({
  male: [
    [19, 65, 55, 45, 35], [29, 70, 60, 50, 40], [39, 65, 55, 45, 35],
    [49, 60, 50, 40, 30], [120, 55, 45, 35, 25],
  ],
  female: [
    [19, 50, 40, 30, 20], [29, 55, 45, 35, 25], [39, 50, 40, 30, 20],
    [49, 45, 35, 25, 15], [120, 40, 30, 20, 10],
  ],
});

function verticalJumpCategory(height, age, gender) {
  if (age === null || gender === null) return 'Recorded without age/sex norm classification';
  const row = VERTICAL_JUMP_NORMS[gender].find(([maximumAge]) => age <= maximumAge);
  invariant(row, 'Vertical jump age is outside the available norm table');
  const [, excellent, good, average, fair] = row;
  if (height >= excellent) return 'Excellent';
  if (height >= good) return 'Good';
  if (height >= average) return 'Average';
  if (height >= fair) return 'Below Average';
  return 'Poor';
}

export function scoreVerticalJump(input, context = {}) {
  const method = requiredChoice(input?.method, 'Measurement method', ['jump_mat', 'sargent', 'other']);
  const rawTrials = requiredArray(input?.trials, 'Vertical-jump trials', { min: 1, max: 10 });
  const trials = rawTrials.map((rawTrial, index) => {
    const trial = requiredObject(rawTrial, `Vertical-jump trial ${index + 1}`);
    const trialMethod = requiredChoice(trial.method, `Vertical-jump trial ${index + 1} method`, ['jump_mat', 'sargent', 'other']);
    invariant(trialMethod === method, `Vertical-jump trial ${index + 1} method must match the selected assessment method`);
    const height = requiredNumber(trial.height_cm, `Vertical-jump trial ${index + 1} height`, { min: 0.1, max: 200 });
    const standingReach = optionalNumber(trial.standing_reach_cm, `Vertical-jump trial ${index + 1} standing reach`, { min: 1, max: 400 });
    const jumpReach = optionalNumber(trial.jump_reach_cm, `Vertical-jump trial ${index + 1} jump reach`, { min: 1, max: 500 });
    if (trialMethod === 'sargent') {
      invariant(standingReach !== null && jumpReach !== null, `Sargent trial ${index + 1} requires both reach measurements`);
      invariant(jumpReach > standingReach, `Sargent trial ${index + 1} jump reach must exceed standing reach`);
      invariant(Math.abs((jumpReach - standingReach) - height) <= 0.15, `Sargent trial ${index + 1} height must equal jump reach minus standing reach`);
    }
    return { height_cm: height, method: trialMethod, standing_reach_cm: standingReach, jump_reach_cm: jumpReach };
  });
  const age = optionalNumber(input?.age, 'Age', { min: 15, max: 120, integer: true });
  const gender = present(input?.gender) ? requiredChoice(input.gender, 'Sex', ['male', 'female']) : null;
  invariant((age === null) === (gender === null), 'Age and sex must either both be supplied for norm classification or both be omitted');
  const best = Math.max(...trials.map((trial) => trial.height_cm));
  const interpretation = verticalJumpCategory(best, age, gender);
  const notes = normalizeNotes(input, context);
  const soapText = [
    '• Vertical Jump Test',
    `  Best Height: ${best} cm — ${interpretation}`,
    `  Method: ${method}`,
    `  Trials: ${trials.map((trial, index) => `#${index + 1} ${trial.height_cm} cm${trial.method === 'sargent' ? ` (${trial.standing_reach_cm} to ${trial.jump_reach_cm} cm reach)` : ''}`).join('; ')}`,
    age === null ? null : `  Norm context: age ${age}, sex ${gender}`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({
    key: 'vertical-jump', input: { method, trials, age, gender, notes }, context, result: best, notes, soapText, interpretation,
    additional: { best_cm: best, trials, method, age, gender, classification: interpretation },
  });
}

function asesInterpretation(score) {
  if (score >= 90) return 'High shoulder function';
  if (score >= 70) return 'Moderate shoulder function';
  if (score >= 50) return 'Substantial shoulder limitation';
  return 'Severe shoulder limitation';
}

export function scoreAses(input, context = {}) {
  const pain = requiredNumber(input?.pain_score, 'Pain VAS', { min: 0, max: 10, integer: true });
  const adl = requiredArray(input?.adl_scores, 'ASES ADL scores', { length: 10 }).map((value, index) => requiredNumber(value, `ASES ADL item ${index + 1}`, { min: 0, max: 3, integer: true }));
  const adlTotal = adl.reduce((sum, value) => sum + value, 0);
  const painSubscore = (10 - pain) * 5;
  const adlSubscore = round((adlTotal / 30) * 50, 2);
  const total = Math.round(painSubscore + adlSubscore);
  const interpretation = asesInterpretation(total);
  const notes = normalizeNotes(input, context);
  const soapText = [
    '• American Shoulder and Elbow Surgeons (ASES) Score',
    `  Total: ${total}/100 — ${interpretation}`,
    `  Pain: ${pain}/10; pain subscore ${painSubscore}/50`,
    `  ADL total: ${adlTotal}/30; ADL subscore ${adlSubscore}/50`,
    ...ASES_ADL_LABELS.map((label, index) => `  ${label}: ${adl[index]}/3`),
    notes ? `  Clinical Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({ key: 'ases', input: { pain_score: pain, adl_scores: adl, notes }, context, result: total, notes, soapText, interpretation, additional: { pain_score: pain, pain_subscore: painSubscore, adl_scores: adl, total_adl_score: adlTotal, adl_subscore: adlSubscore, total_score: total } });
}

function constantRomBand(value, thresholds) {
  for (const [minimum, score] of thresholds) if (value >= minimum) return score;
  return 0;
}

function constantRomScore(rom) {
  return Math.min(40,
    constantRomBand(rom.flexion, [[150, 10], [120, 8], [90, 6], [60, 4], [30, 2]]) +
    constantRomBand(rom.abduction, [[150, 10], [120, 8], [90, 6], [60, 4], [30, 2]]) +
    constantRomBand(rom.external_rotation, [[90, 10], [60, 8], [45, 6], [30, 4], [15, 2]]) +
    constantRomBand(rom.internal_rotation, [[10, 10], [9, 8], [7, 6], [5, 4], [3, 2]]));
}

export function scoreConstantMurley(input, context = {}) {
  const pain = requiredNumber(input?.pain, 'Pain subscore', { min: 0, max: 15, integer: true });
  const rawAdl = requiredObject(input?.adl_scores, 'ADL subscores');
  const adl = {
    work: requiredNumber(rawAdl.work, 'Work subscore', { min: 0, max: 4, integer: true }),
    leisure: requiredNumber(rawAdl.leisure, 'Recreation subscore', { min: 0, max: 4, integer: true }),
    sleep: requiredNumber(rawAdl.sleep, 'Sleep subscore', { min: 0, max: 2, integer: true }),
    positioning: requiredNumber(rawAdl.positioning, 'Hand positioning subscore', { min: 0, max: 10, integer: true }),
  };
  const rawRom = requiredObject(input?.range_of_motion, 'Range-of-motion observations');
  const rom = {
    flexion: requiredNumber(rawRom.flexion, 'Forward flexion', { min: 0, max: 180 }),
    abduction: requiredNumber(rawRom.abduction, 'Abduction', { min: 0, max: 180 }),
    external_rotation: requiredNumber(rawRom.external_rotation, 'External rotation', { min: 0, max: 180 }),
    internal_rotation: requiredNumber(rawRom.internal_rotation, 'Internal rotation landmark level', { min: 0, max: 10 }),
  };
  const strength = requiredNumber(input?.strength, 'Abduction strength subscore', { min: 0, max: 25 });
  const adlTotal = Object.values(adl).reduce((sum, value) => sum + value, 0);
  const romScore = constantRomScore(rom);
  const total = round(pain + adlTotal + romScore + strength, 2);
  invariant(total <= 100, 'Constant-Murley total cannot exceed 100');
  const interpretation = total >= 85 ? 'Excellent' : total >= 70 ? 'Good' : total >= 56 ? 'Moderate' : 'Poor';
  const notes = normalizeNotes(input, context);
  const soapText = [
    `• Constant-Murley Score: ${total}/100 — ${interpretation}`,
    `  Pain: ${pain}/15 | ADL: ${adlTotal}/20 | ROM: ${romScore}/40 | Strength: ${strength}/25`,
    `  ADL — work ${adl.work}/4; recreation ${adl.leisure}/4; sleep ${adl.sleep}/2; positioning ${adl.positioning}/10`,
    `  ROM — flexion ${rom.flexion}°; abduction ${rom.abduction}°; external rotation ${rom.external_rotation}°; internal rotation level ${rom.internal_rotation}`,
    notes ? `  Clinical Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({ key: 'constant-murley', input: { pain, adl_scores: adl, range_of_motion: rom, strength, notes }, context, result: total, notes, soapText, interpretation, additional: { total_score: total, pain, adl_scores: adl, adl_total: adlTotal, range_of_motion: rom, rom_score: romScore, strength } });
}

export function scoreLysholm(input, context = {}) {
  const raw = responseObject(input?.responses, LYSHOLM_ITEMS, 'Lysholm responses');
  const responses = {};
  for (const item of LYSHOLM_ITEMS) {
    const value = requiredNumber(raw[item.key], `Lysholm ${item.prompt}`, { min: 0, max: 25, integer: true });
    invariant(item.options.some((option) => option.value === value), `Lysholm ${item.prompt} is not a permitted response`);
    responses[item.key] = value;
  }
  const total = Object.values(responses).reduce((sum, value) => sum + value, 0);
  invariant(total <= 100, 'Lysholm total cannot exceed 100');
  const interpretation = total >= 95 ? 'Excellent' : total >= 84 ? 'Good' : total >= 65 ? 'Fair' : 'Poor';
  const notes = normalizeNotes(input, context);
  const soapText = ['• Lysholm Knee Score', `  Total: ${total}/100 — ${interpretation}`, ...LYSHOLM_ITEMS.map((item) => `  ${item.prompt}: ${responses[item.key]} (${selectedLabel(item, responses[item.key])})`), notes ? `  Notes: ${notes}` : null].filter(Boolean).join('\n');
  return finish({ key: 'lysholm', input: { responses, notes }, context, result: total, notes, soapText, interpretation, additional: { total_score: total, grade: interpretation, responses } });
}

export function scoreAclRsi(input, context = {}) {
  const responses = normalizedQuestionnaireArray(input, ACL_RSI_QUESTIONS, 'ACL-RSI responses', { min: 0, max: 10, integer: true });
  const rawTotal = responses.reduce((sum, value) => sum + value, 0);
  const total = round((rawTotal / 120) * 100, 1);
  const interpretation = total >= 65 ? 'Higher psychological readiness' : total >= 50 ? 'Moderate psychological readiness' : 'Lower psychological readiness';
  const notes = normalizeNotes(input, context);
  const soapText = ['• ACL Return to Sport after Injury (ACL-RSI)', `  Score: ${total}% (${rawTotal}/120) — ${interpretation}`, ...responses.map((value, index) => `  Q${index + 1}: ${value}/10`), notes ? `  Notes: ${notes}` : null].filter(Boolean).join('\n');
  return finish({ key: 'acl-rsi', input: { responses, notes }, context, result: total, notes, soapText, interpretation, additional: { responses, total_score: rawTotal, percentage_score: total } });
}

export function scoreFabq(input, context = {}) {
  const responses = normalizedQuestionnaireArray(input, FABQ_QUESTIONS, 'FABQ responses', { min: 0, max: 6, integer: true });
  const physicalActivityScore = responses.slice(0, 5).reduce((sum, value) => sum + value, 0);
  const workScore = responses.slice(5).reduce((sum, value) => sum + value, 0);
  const total = physicalActivityScore + workScore;
  const interpretation = `${physicalActivityScore >= 15 ? 'Elevated' : 'Lower'} physical-activity fear avoidance; ${workScore >= 34 ? 'elevated' : 'lower'} work fear avoidance`;
  const notes = normalizeNotes(input, context);
  const soapText = ['• Fear-Avoidance Beliefs Questionnaire (FABQ)', `  Total: ${total}/96`, `  Physical Activity partition: ${physicalActivityScore}/30`, `  Work partition: ${workScore}/66`, ...responses.map((value, index) => `  Q${index + 1}: ${value}/6`), notes ? `  Notes: ${notes}` : null].filter(Boolean).join('\n');
  return finish({ key: 'fabq', input: { responses, notes }, context, result: total, notes, soapText, interpretation, additional: { responses, physical_activity_score: physicalActivityScore, work_score: workScore, total_score: total } });
}

export function scoreDropVerticalJump(input, context = {}) {
  const height = requiredNumber(input?.jump_height_cm, 'Jump height', { min: 0.1, max: 200 });
  const kneeAngle = requiredNumber(input?.knee_angle_degrees, 'Knee angle at landing', { min: -180, max: 180 });
  const kneeValgus = requiredNumber(input?.knee_valgus_degrees, 'Knee valgus angle', { min: -180, max: 180 });
  const interpretation = `Recorded landing angles: knee ${kneeAngle}°, valgus ${kneeValgus}°`;
  const notes = normalizeNotes(input, context);
  const soapText = `• Drop Vertical Jump\n  Jump Height: ${height} cm\n  Knee Angle at Landing: ${kneeAngle}°\n  Knee Valgus: ${kneeValgus}°${notes ? `\n  Notes: ${notes}` : ''}`;
  return finish({ key: 'drop-vertical-jump', input: { jump_height_cm: height, knee_angle_degrees: kneeAngle, knee_valgus_degrees: kneeValgus, notes }, context, result: height, notes, soapText, interpretation, additional: { jump_height_cm: height, knee_angle: kneeAngle, knee_valgus: kneeValgus } });
}

function nearlyEqual(left, right, tolerance = 0.011) {
  return Math.abs(left - right) <= tolerance;
}

export function scoreNaughton(input, context = {}) {
  const protocolKey = requiredChoice(input?.protocol_key, 'Naughton protocol', Object.keys(N_AUGHTON_PROTOCOLS));
  const protocol = N_AUGHTON_PROTOCOLS[protocolKey];
  const totalTime = requiredNumber(input?.total_time_seconds, 'Total test time', { min: 1, max: protocol.length * 120, integer: true });
  const stageIndex = requiredNumber(input?.current_stage_index, 'Final stage index', { min: 0, max: protocol.length - 1, integer: true });
  invariant(stageIndex === Math.min(protocol.length - 1, Math.floor(totalTime / 120)), 'Final stage index must match elapsed test time');
  const terminationReason = requiredChoice(input?.termination_reason, 'Termination reason', N_AUGHTON_TERMINATION_OPTIONS);
  const rawStages = requiredArray(input?.stage_data, 'Naughton stage observations', { min: 1, max: protocol.length });
  let previousStage = 0;
  let previousTime = 0;
  const stageData = rawStages.map((rawStage, index) => {
    const stage = requiredObject(rawStage, `Naughton stage observation ${index + 1}`);
    const stageNumber = requiredNumber(stage.stage, `Naughton stage ${index + 1} number`, { min: 1, max: protocol.length, integer: true });
    invariant(stageNumber > previousStage, 'Naughton stage observations must be unique and in ascending order');
    invariant(stageNumber <= stageIndex + 1, 'Naughton stage observation cannot be later than the final stage');
    const timeSec = requiredNumber(stage.timeSec, `Naughton stage ${stageNumber} elapsed time`, { min: 1, max: totalTime });
    invariant(timeSec >= previousTime, 'Naughton stage observation times must be ascending');
    const expected = protocol[stageNumber - 1];
    const speedMph = requiredNumber(stage.speedMph, `Naughton stage ${stageNumber} speed mph`, { min: 0.1, max: 10 });
    const speedKmh = requiredNumber(stage.speedKmh, `Naughton stage ${stageNumber} speed km/h`, { min: 0.1, max: 20 });
    const grade = requiredNumber(stage.grade, `Naughton stage ${stageNumber} grade`, { min: 0, max: 30 });
    const mets = requiredNumber(stage.mets, `Naughton stage ${stageNumber} METs`, { min: 0.1, max: 30 });
    invariant(nearlyEqual(speedMph, expected[1]) && nearlyEqual(speedKmh, expected[2]) && nearlyEqual(grade, expected[3]) && nearlyEqual(mets, expected[4]), `Naughton stage ${stageNumber} settings do not match ${protocolKey}`);
    previousStage = stageNumber;
    previousTime = timeSec;
    return {
      stage: stageNumber,
      timeSec,
      heartRate: optionalNumber(stage.heartRate, `Naughton stage ${stageNumber} heart rate`, { min: 20, max: 300 }),
      bp: optionalText(stage.bp, `Naughton stage ${stageNumber} blood pressure`, 100),
      rpe: optionalNumber(stage.rpe, `Naughton stage ${stageNumber} RPE`, { min: 0, max: 20 }),
      symptoms: optionalText(stage.symptoms, `Naughton stage ${stageNumber} symptoms`, 500),
      speedMph, speedKmh, grade, mets,
    };
  });
  const stagesCompleted = stageIndex + 1;
  const interpretation = stagesCompleted <= 2 ? 'Very low treadmill exercise tolerance demonstrated on this protocol' : stagesCompleted <= 5 ? 'Low to moderate treadmill exercise tolerance demonstrated on this protocol' : 'Higher exercise tolerance demonstrated within this low-workload treadmill protocol';
  const notes = normalizeNotes(input, context);
  const finalStage = protocol[stageIndex];
  const soapText = [
    `• Naughton Treadmill Protocol (${protocolKey})`,
    `  Total Time: ${totalTime} s | Final stage: ${stageIndex + 1}`,
    `  Final settings: ${finalStage[1]} mph / ${finalStage[2]} km/h / ${finalStage[3]}% grade / ${finalStage[4]} METs`,
    `  Termination: ${terminationReason}`,
    `  Interpretation: ${interpretation}`,
    ...stageData.map((stage) => `  Stage ${stage.stage} at ${stage.timeSec}s: HR ${stage.heartRate ?? '—'}; BP ${stage.bp || '—'}; RPE ${stage.rpe ?? '—'}; symptoms ${stage.symptoms || '—'}`),
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({ key: 'naughton', input: { protocol_key: protocolKey, total_time_seconds: totalTime, current_stage_index: stageIndex, stage_data: stageData, termination_reason: terminationReason, notes }, context, result: totalTime, notes, soapText, interpretation, additional: { protocol_key: protocolKey, total_time_seconds: totalTime, stages_completed: stagesCompleted, final_stage: finalStage[0], peak_speed_mph: finalStage[1], peak_speed_kmh: finalStage[2], peak_grade_percent: finalStage[3], peak_estimated_mets: finalStage[4], termination_reason: terminationReason, stage_data: stageData } });
}

function normalizeSgrqSymptoms(value) {
  const source = requiredObject(value, 'SGRQ symptoms responses');
  const permittedKeys = new Set(SGRQ_SYMPTOM_ITEMS.map((item) => item.key));
  invariant(Object.keys(source).every((key) => permittedKeys.has(key)), 'SGRQ symptoms responses contain an unknown item');
  const normalized = {};
  for (const item of SGRQ_SYMPTOM_ITEMS) {
    if (!present(source[item.key])) {
      invariant(!item.required, `SGRQ symptom ${item.key} is required`);
      continue;
    }
    const valueIndex = requiredNumber(source[item.key], `SGRQ symptom ${item.key}`, { min: 0, max: item.options.length - 1, integer: true });
    invariant(item.options[valueIndex], `SGRQ symptom ${item.key} is not a permitted response`);
    normalized[item.key] = valueIndex;
  }
  return normalized;
}

function normalizeBooleanDomain(value, items, label) {
  const source = responseObject(value, items, label);
  return Object.fromEntries(items.map((item) => [item.key, requiredBoolean(source[item.key], `${label} ${item.key}`)]));
}

function sgrqLevel(score) {
  if (score <= 25) return 'Mild Respiratory Impact';
  if (score <= 50) return 'Moderate Respiratory Impact';
  if (score <= 75) return 'High Respiratory Burden';
  return 'Severe Respiratory Impairment';
}

export function scoreSgrq(input, context = {}) {
  const symptoms = normalizeSgrqSymptoms(input?.symptoms_responses);
  const activity = normalizeBooleanDomain(input?.activity_responses, SGRQ_ACTIVITY_ITEMS, 'SGRQ activity responses');
  const impact = normalizeBooleanDomain(input?.impact_responses, SGRQ_IMPACT_ITEMS, 'SGRQ impact responses');
  const symptomWeighted = SGRQ_SYMPTOM_ITEMS.reduce((sum, item) => sum + (present(symptoms[item.key]) ? item.options[symptoms[item.key]].weight : 0), 0);
  const activityWeighted = SGRQ_ACTIVITY_ITEMS.reduce((sum, item) => sum + (activity[item.key] ? item.weight : 0), 0);
  const impactWeighted = SGRQ_IMPACT_ITEMS.reduce((sum, item) => sum + (impact[item.key] ? item.weight : 0), 0);
  const symptomMax = SGRQ_SYMPTOM_ITEMS.reduce((sum, item) => sum + Math.max(...item.options.map((option) => option.weight)), 0);
  const activityMax = SGRQ_ACTIVITY_ITEMS.reduce((sum, item) => sum + item.weight, 0);
  const impactMax = SGRQ_IMPACT_ITEMS.reduce((sum, item) => sum + item.weight, 0);
  const symptomsScore = Math.round((symptomWeighted / symptomMax) * 100);
  const activityScore = Math.round((activityWeighted / activityMax) * 100);
  const impactScore = Math.round((impactWeighted / impactMax) * 100);
  const total = Math.round(((symptomWeighted + activityWeighted + impactWeighted) / (symptomMax + activityMax + impactMax)) * 100);
  const diagnosis = optionalText(input?.diagnosis, 'Primary respiratory diagnosis', 500);
  const smokingStatus = present(input?.smoking_status) ? requiredChoice(input.smoking_status, 'Smoking status', ['Current smoker', 'Ex-smoker', 'Never smoked']) : null;
  const oxygenUse = present(input?.oxygen_use) ? requiredBoolean(input.oxygen_use, 'Supplemental oxygen use') : null;
  const exacerbations = optionalNumber(input?.exacerbations, 'Exacerbations', { min: 0, max: 100, integer: true });
  const rehab = present(input?.rehab) ? requiredBoolean(input.rehab, 'Pulmonary rehabilitation status') : null;
  const adminMode = present(input?.admin_mode) ? requiredChoice(input.admin_mode, 'Administration mode', ['Clinician-administered', 'Self-report', 'Caregiver-assisted']) : null;
  const interpretation = sgrqLevel(total);
  const notes = normalizeNotes(input, context);
  const soapText = [
    `• St George's Respiratory Questionnaire (SGRQ)`,
    `  Symptoms: ${symptomsScore}/100 | Activity: ${activityScore}/100 | Impact: ${impactScore}/100`,
    `  Total: ${total}/100 — ${interpretation}`,
    diagnosis ? `  Diagnosis: ${diagnosis}` : null,
    smokingStatus ? `  Smoking: ${smokingStatus}` : null,
    oxygenUse === null ? null : `  Oxygen use: ${oxygenUse ? 'Yes' : 'No'}`,
    exacerbations === null ? null : `  Exacerbations in last year: ${exacerbations}`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({ key: 'sgrq', input: { diagnosis, smoking_status: smokingStatus, oxygen_use: oxygenUse, exacerbations, rehab, admin_mode: adminMode, symptoms_responses: symptoms, activity_responses: activity, impact_responses: impact, notes }, context, result: total, notes, soapText, interpretation, additional: { symptoms_score: symptomsScore, activity_score: activityScore, impact_score: impactScore, total_score: total, weighted_scores: { symptoms: round(symptomWeighted, 6), activity: round(activityWeighted, 6), impact: round(impactWeighted, 6) }, symptoms_responses: symptoms, activity_responses: activity, impact_responses: impact, diagnosis, smoking_status: smokingStatus, oxygen_use: oxygenUse, exacerbations, rehab, admin_mode: adminMode } });
}

const DEXA_SITES = deepFreeze(['lumbarSpine', 'femoralNeck', 'totalHip', 'distalRadius']);

function dexaInterpretation(score) {
  if (score >= -1) return 'Normal';
  if (score >= -2.5) return 'Osteopenia';
  return 'Osteoporosis';
}

export function scoreDexa(input, context = {}) {
  const rawTScores = requiredObject(input?.t_scores, 'DEXA T-scores');
  const unknownSites = Object.keys(rawTScores).filter((key) => !DEXA_SITES.includes(key));
  invariant(unknownSites.length === 0, `DEXA T-scores contain unknown sites: ${unknownSites.join(', ')}`);
  const tScores = Object.fromEntries(DEXA_SITES.map((site) => [site, optionalNumber(rawTScores[site], `${site} T-score`, { min: -10, max: 10 })]));
  const recorded = Object.entries(tScores).filter(([, value]) => value !== null);
  invariant(recorded.length > 0, 'At least one DEXA T-score is required');
  const rawBmd = input?.bmd_values == null ? {} : requiredObject(input.bmd_values, 'DEXA BMD values');
  invariant(Object.keys(rawBmd).every((key) => DEXA_SITES.includes(key)), 'DEXA BMD values contain an unknown site');
  const bmdValues = Object.fromEntries(DEXA_SITES.map((site) => [site, optionalNumber(rawBmd[site], `${site} BMD`, { min: 0, max: 5 })]));
  const bodyFat = optionalNumber(input?.body_fat_percentage, 'Body fat percentage', { min: 0, max: 100 });
  const visceral = optionalNumber(input?.visceral_adipose_tissue, 'Visceral adipose tissue', { min: 0, max: 1000 });
  const leanMass = optionalNumber(input?.lean_mass_kg ?? input?.lean_mass, 'Lean mass', { min: 0, max: 400 });
  const worst = Math.min(...recorded.map(([, value]) => value));
  const interpretation = dexaInterpretation(worst);
  const notes = normalizeNotes(input, context);
  const soapText = [
    `• DEXA Scan Results: Worst T-Score ${worst} — ${interpretation}`,
    ...recorded.map(([site, value]) => `  ${site}: T-score ${value}${bmdValues[site] === null ? '' : `; BMD ${bmdValues[site]} g/cm²`} — ${dexaInterpretation(value)}`),
    bodyFat === null ? null : `  Body Fat: ${bodyFat}%`,
    visceral === null ? null : `  Visceral Adipose Tissue: ${visceral} cm²`,
    leanMass === null ? null : `  Lean Mass: ${leanMass} kg`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({ key: 'dexa', input: { t_scores: tScores, bmd_values: bmdValues, body_fat_percentage: bodyFat, visceral_adipose_tissue: visceral, lean_mass_kg: leanMass, notes }, context, result: worst, notes, soapText, interpretation, additional: { worst_t_score: worst, t_scores: tScores, bmd_values: bmdValues, body_fat_percentage: bodyFat, visceral_adipose_tissue: visceral, lean_mass_kg: leanMass, site_interpretations: Object.fromEntries(recorded.map(([site, value]) => [site, dexaInterpretation(value)])) } });
}

export function scoreConley(input, context = {}) {
  const raw = responseObject(input?.scores, Object.keys(CONLEY_LABELS).map((key) => ({ key })), 'Conley responses');
  const scores = Object.fromEntries(Object.keys(CONLEY_LABELS).map((key) => [key, requiredBoolean(raw[key], `Conley ${CONLEY_LABELS[key]}`)]));
  const total = Object.values(scores).filter(Boolean).length;
  const interpretation = total <= 1 ? 'Low Falls Risk' : 'High Falls Risk';
  const positiveFindings = Object.entries(scores).filter(([, value]) => value).map(([key]) => CONLEY_LABELS[key]);
  const notes = normalizeNotes(input, context);
  const soapText = ['• Conley Scale', `  Total: ${total}/7 — ${interpretation}`, ...Object.entries(scores).map(([key, value]) => `  ${CONLEY_LABELS[key]}: ${value ? 'Yes' : 'No'}`), positiveFindings.length ? `  Positive findings: ${positiveFindings.join('; ')}` : '  Positive findings: none', notes ? `  Notes: ${notes}` : null].filter(Boolean).join('\n');
  return finish({ key: 'conley', input: { scores, notes }, context, result: total, notes, soapText, interpretation, additional: { total_score: total, classification: interpretation, positive_findings: positiveFindings, scores } });
}

export function scorePerceivedStress(input, context = {}) {
  const responses = normalizedQuestionnaireArray(input, PSS_QUESTIONS, 'PSS-10 responses', { min: 0, max: 4, integer: true });
  const adjusted = responses.map((value, index) => PSS_QUESTIONS[index].reversed ? 4 - value : value);
  const total = adjusted.reduce((sum, value) => sum + value, 0);
  const interpretation = total <= 13 ? 'Low Stress' : total <= 26 ? 'Moderate Stress' : 'High Stress';
  const notes = normalizeNotes(input, context);
  const soapText = ['• Perceived Stress Scale (PSS-10)', `  Total: ${total}/40 — ${interpretation}`, ...responses.map((value, index) => `  Q${index + 1}: ${selectedLabel(PSS_QUESTIONS[index], value)}${PSS_QUESTIONS[index].reversed ? ` (reversed score ${adjusted[index]})` : ` (score ${adjusted[index]})`}`), notes ? `  Notes: ${notes}` : null].filter(Boolean).join('\n');
  return finish({ key: 'perceived-stress-scale', input: { responses, notes }, context, result: total, notes, soapText, interpretation, additional: { responses, adjusted_responses: adjusted, total_score: total, stress_level: interpretation } });
}

export function scoreHeartRateRecovery(input, context = {}) {
  const peak = requiredNumber(input?.peak_heart_rate, 'Peak exercise heart rate', { min: 20, max: 300, integer: true });
  const minute1 = requiredNumber(input?.hr_1_minute, 'One-minute recovery heart rate', { min: 20, max: 300, integer: true });
  const minute2 = optionalNumber(input?.hr_2_minute, 'Two-minute recovery heart rate', { min: 20, max: 300, integer: true });
  const mode = requiredChoice(input?.recovery_mode, 'Recovery mode', ['passive_standing', 'passive_seated', 'active_walking', 'supine']);
  const rawAdditional = input?.additional_measurements == null ? [] : requiredArray(input.additional_measurements, 'Additional recovery measurements', { min: 0, max: 20 });
  const additionalMeasurements = rawAdditional.map((rawMeasurement, index) => {
    const measurement = requiredObject(rawMeasurement, `Additional recovery measurement ${index + 1}`);
    const timepoint = optionalNumber(measurement.timepoint, `Additional recovery measurement ${index + 1} time point`, { min: 0.1, max: 60 });
    const label = optionalText(measurement.label, `Additional recovery measurement ${index + 1} label`, 100);
    invariant(timepoint !== null || label, `Additional recovery measurement ${index + 1} requires a time point or label`);
    const hr = requiredNumber(measurement.hr, `Additional recovery measurement ${index + 1} heart rate`, { min: 20, max: 300, integer: true });
    return { timepoint, label, hr, recovery: peak - hr };
  });
  const hrr1 = peak - minute1;
  const hrr2 = minute2 === null ? null : peak - minute2;
  const interpretation = hrr1 <= 12 ? 'Attenuated (≤12 bpm)' : hrr1 <= 15 ? 'Below optimal (13–15 bpm)' : 'Normal (>15 bpm)';
  const precedingTest = optionalText(input?.preceding_test, 'Preceding exercise test', 500);
  const symptoms = optionalText(input?.symptoms, 'Symptoms during recovery');
  const notes = normalizeNotes(input, context);
  const soapText = [
    '• Heart Rate Recovery Assessment',
    `  Peak HR: ${peak} bpm | 1 minute: ${minute1} bpm | HRR1: ${hrr1} bpm — ${interpretation}`,
    minute2 === null ? null : `  2 minutes: ${minute2} bpm | HRR2: ${hrr2} bpm`,
    `  Recovery mode: ${mode}`,
    precedingTest ? `  Preceding test: ${precedingTest}` : null,
    ...additionalMeasurements.map((measurement) => `  ${measurement.label || `${measurement.timepoint} min`}: ${measurement.hr} bpm (recovery ${measurement.recovery} bpm)`),
    symptoms ? `  Symptoms: ${symptoms}` : null,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({ key: 'heart-rate-recovery', input: { peak_heart_rate: peak, hr_1_minute: minute1, hr_2_minute: minute2, additional_measurements: additionalMeasurements, recovery_mode: mode, preceding_test: precedingTest, symptoms, notes }, context, result: hrr1, notes, soapText, interpretation, additional: { peak_heart_rate: peak, hr_1_minute: minute1, hr_2_minute: minute2, hrr_1_minute: hrr1, hrr_2_minute: hrr2, additional_measurements: additionalMeasurements, recovery_mode: mode, preceding_test: precedingTest, symptoms } });
}

function lipidInMgdl(value, unit) {
  return unit === 'mgdl' ? value : value * 38.67;
}

function cholesterolCategory(value, unit) {
  const converted = lipidInMgdl(value, unit);
  return converted < 200 ? 'Normal' : converted < 240 ? 'Borderline High' : 'High';
}

function ldlCategory(value, unit) {
  const converted = lipidInMgdl(value, unit);
  if (converted < 100) return 'Optimal';
  if (converted < 130) return 'Near Optimal';
  if (converted < 160) return 'Borderline High';
  if (converted < 190) return 'High';
  return 'Very High';
}

function hdlCategory(value, unit) {
  const converted = lipidInMgdl(value, unit);
  return converted < 40 ? 'Low' : converted >= 60 ? 'Protective' : 'Normal';
}

function triglycerideCategory(value, unit) {
  const converted = lipidInMgdl(value, unit);
  return converted < 150 ? 'Normal' : converted < 200 ? 'Borderline High' : converted < 500 ? 'High' : 'Very High';
}

function lipidConversion(value, unit) {
  return value === null ? null : unit === 'mgdl' ? round(value * 0.02586, 2) : round(value * 38.67, 0);
}

export function scoreLipidProfile(input, context = {}) {
  const unit = requiredChoice(input?.unit, 'Lipid unit', ['mgdl', 'mmol']);
  const total = requiredNumber(input?.total_cholesterol, 'Total cholesterol', { min: 0, max: 2000 });
  const ldl = optionalNumber(input?.ldl, 'LDL cholesterol', { min: 0, max: 2000 });
  const hdl = optionalNumber(input?.hdl, 'HDL cholesterol', { min: 0, max: 1000 });
  const triglycerides = optionalNumber(input?.triglycerides, 'Triglycerides', { min: 0, max: 5000 });
  const interpretation = cholesterolCategory(total, unit);
  const notes = normalizeNotes(input, context);
  const unitLabel = unit === 'mgdl' ? 'mg/dL' : 'mmol/L';
  const otherUnit = unit === 'mgdl' ? 'mmol/L' : 'mg/dL';
  const soapText = [
    `• Lipid Profile (${unitLabel})`,
    `  Total Cholesterol: ${total} ${unitLabel} (${lipidConversion(total, unit)} ${otherUnit}) — ${interpretation}`,
    ldl === null ? null : `  LDL: ${ldl} ${unitLabel} (${lipidConversion(ldl, unit)} ${otherUnit}) — ${ldlCategory(ldl, unit)}`,
    hdl === null ? null : `  HDL: ${hdl} ${unitLabel} (${lipidConversion(hdl, unit)} ${otherUnit}) — ${hdlCategory(hdl, unit)}`,
    triglycerides === null ? null : `  Triglycerides: ${triglycerides} ${unitLabel} (${lipidConversion(triglycerides, unit)} ${otherUnit}) — ${triglycerideCategory(triglycerides, unit)}`,
    notes ? `  Notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return finish({ key: 'lipid-profile', input: { unit, total_cholesterol: total, ldl, hdl, triglycerides, notes }, context, result: total, notes, soapText, interpretation, additional: { total_cholesterol: total, ldl, hdl, triglycerides, unit, conversions: { total_cholesterol: lipidConversion(total, unit), ldl: lipidConversion(ldl, unit), hdl: lipidConversion(hdl, unit), triglycerides: lipidConversion(triglycerides, unit) }, total_cholesterol_category: interpretation, ldl_category: ldl === null ? null : ldlCategory(ldl, unit), hdl_category: hdl === null ? null : hdlCategory(hdl, unit), triglycerides_category: triglycerides === null ? null : triglycerideCategory(triglycerides, unit) } });
}

const BORG_6_20_VALUES = deepFreeze([6, 7, 7.5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
const BORG_CR10_VALUES = deepFreeze(Array.from({ length: 11 }, (_, index) => index));

function borgInterpretation(value, scale) {
  if (scale === 'borg_6_20') {
    if (value <= 11) return 'Light intensity';
    if (value <= 14) return 'Moderate intensity';
    if (value <= 17) return 'Hard intensity';
    return 'Very hard to maximum';
  }
  if (value <= 1) return 'Very light';
  if (value <= 3) return 'Light';
  if (value <= 5) return 'Moderate';
  if (value <= 7) return 'Vigorous';
  if (value <= 9) return 'Very hard';
  return 'Maximum effort';
}

export function scoreBorgRpe(input, context = {}) {
  const scale = requiredChoice(input?.scale_type, 'Borg scale', ['borg_6_20', 'cr10']);
  const value = requiredNumber(input?.rpe_value, 'Perceived exertion rating', { min: scale === 'borg_6_20' ? 6 : 0, max: scale === 'borg_6_20' ? 20 : 10 });
  const permitted = scale === 'borg_6_20' ? BORG_6_20_VALUES : BORG_CR10_VALUES;
  invariant(permitted.includes(value), `Rating ${value} is not available on the selected Borg scale`);
  const activity = optionalText(input?.activity_description, 'Activity description', 500);
  const notes = normalizeNotes(input, context);
  const interpretation = borgInterpretation(value, scale);
  const soapText = ['• Borg RPE Scale Assessment', `  Scale: ${scale === 'borg_6_20' ? 'Borg RPE (6–20)' : 'Modified CR10 (0–10)'}`, `  Rating: ${value} — ${interpretation}`, activity ? `  Activity: ${activity}` : null, notes ? `  Notes: ${notes}` : null].filter(Boolean).join('\n');
  return finish({ key: 'borg-rpe', input: { scale_type: scale, rpe_value: value, activity_description: activity, notes }, context, result: value, notes, soapText, interpretation, additional: { scale_type: scale, rpe_value: value, activity_description: activity } });
}

export function scoreQuickDash(input, context = {}) {
  const rawSum = optionalNumber(input?.raw_sum, 'QuickDASH raw sum', { min: 11, max: 55, integer: true });
  const total = requiredNumber(input?.total_score, 'QuickDASH score', { min: 0, max: 100 });
  const derived = rawSum === null ? null : round(((rawSum / 11) - 1) * 25, 1);
  if (derived !== null) invariant(Math.abs(derived - total) <= 0.1, `QuickDASH score ${total} does not match raw sum ${rawSum} (expected ${derived})`);
  const assessor = optionalText(input?.assessor_name, 'Assessor name', 200);
  const assessmentDate = requiredText(input?.assessment_date ?? context.assessmentDate, 'Assessment date', 10);
  invariant(LOCAL_DATE.test(assessmentDate), 'QuickDASH assessment date must use YYYY-MM-DD');
  const interpretation = total <= 20 ? 'Minimal upper limb disability' : total <= 40 ? 'Mild disability' : total <= 60 ? 'Moderate disability' : 'Severe disability';
  const notes = normalizeNotes(input, context);
  const soapText = ['• QuickDASH (Disabilities of the Arm, Shoulder and Hand)', `  Assessment Date: ${assessmentDate}`, rawSum === null ? null : `  Sum of Item Scores: ${rawSum}/55`, `  QuickDASH Score: ${total}/100 — ${interpretation}`, assessor ? `  Assessor: ${assessor}` : null, notes ? `  Notes: ${notes}` : null].filter(Boolean).join('\n');
  return finish({ key: 'quickdash', input: { raw_sum: rawSum, total_score: total, assessor_name: assessor, assessment_date: assessmentDate, notes }, context: { ...context, assessmentDate }, result: total, notes, soapText, interpretation, additional: { raw_sum: rawSum, derived_score: derived, total_score: total, assessor_name: assessor } });
}

export const SCORERS = Object.freeze({
  hads: scoreHads,
  ebbeling: scoreEbbeling,
  'harvard-step': scoreHarvardStep,
  'rockport-walk': scoreRockportWalk,
  'resting-heart-rate': scoreRestingHeartRate,
  astrand: scoreAstrand,
  'vertical-jump': scoreVerticalJump,
  ases: scoreAses,
  'constant-murley': scoreConstantMurley,
  lysholm: scoreLysholm,
  'acl-rsi': scoreAclRsi,
  fabq: scoreFabq,
  'drop-vertical-jump': scoreDropVerticalJump,
  naughton: scoreNaughton,
  sgrq: scoreSgrq,
  dexa: scoreDexa,
  conley: scoreConley,
  'perceived-stress-scale': scorePerceivedStress,
  'heart-rate-recovery': scoreHeartRateRecovery,
  'lipid-profile': scoreLipidProfile,
  'borg-rpe': scoreBorgRpe,
  quickdash: scoreQuickDash,
});

const FIXTURES = deepFreeze({
  hads: { scores: Object.fromEntries(HADS_ITEMS.map((item, index) => [item.key, item.options[index % item.options.length].value])), notes: 'Stable HADS fixture.' },
  ebbeling: { age: 35, gender: 'female', resting_hr: 68, warmup_speed: 3.2, warmup_speed_unit: 'mph', test_hr_readings: { min1: { hr: 112, rpe: 8 }, min2: { hr: 118, rpe: 9 }, min3: { hr: 124, rpe: 10 }, min4: { hr: 127, rpe: 11 } }, notes: 'Stable Ebbeling fixture.' },
  'harvard-step': { duration_completed: 240, hr_1min: 80, hr_2min: 75, hr_3min: 70, reason_stopped: 'Protocol duration reached', observations: 'Stable Harvard fixture.' },
  'rockport-walk': { age: 45, gender: 'male', walk_time_minutes: 14.2, end_heart_rate: 130, weight_kg: 80, rpe: 12, symptoms: 'No symptoms', notes: 'Stable Rockport fixture.' },
  'resting-heart-rate': { heart_rate_bpm: 72, notes: 'Stable resting-heart-rate fixture.' },
  astrand: { sex: 'male', age: 40, body_mass_kg: 75, workload_watts: 125, hr_minute4: 130, hr_minute5: 132, hr_minute6: 134, observations: 'Stable Astrand fixture.' },
  'vertical-jump': { method: 'sargent', trials: [{ height_cm: 42, method: 'sargent', standing_reach_cm: 210, jump_reach_cm: 252 }, { height_cm: 45, method: 'sargent', standing_reach_cm: 210, jump_reach_cm: 255 }], age: 32, gender: 'male', notes: 'Stable vertical-jump fixture.' },
  ases: { pain_score: 3, adl_scores: [3, 2, 2, 3, 3, 2, 1, 2, 3, 2], notes: 'Stable ASES fixture.' },
  'constant-murley': { pain: 12, adl_scores: { work: 3, leisure: 3, sleep: 2, positioning: 8 }, range_of_motion: { flexion: 135, abduction: 125, external_rotation: 65, internal_rotation: 7 }, strength: 18, notes: 'Stable Constant-Murley fixture.' },
  lysholm: { responses: { limp: 3, support: 5, locking: 10, instability: 20, pain: 20, swelling: 6, stairs: 6, squatting: 4, range_of_motion: 4 }, notes: 'Stable Lysholm fixture.' },
  'acl-rsi': { responses: [7, 6, 6, 7, 6, 5, 6, 7, 6, 5, 7, 7], notes: 'Stable ACL-RSI fixture.' },
  fabq: { responses: [2, 3, 2, 4, 3, 2, 3, 1, 3, 3, 2, 4, 3, 2, 1, 2], notes: 'Stable FABQ fixture.' },
  'drop-vertical-jump': { jump_height_cm: 31.5, knee_angle_degrees: 54, knee_valgus_degrees: 7, notes: 'Stable drop-vertical-jump fixture.' },
  naughton: { protocol_key: 'classic_naughton', total_time_seconds: 300, current_stage_index: 2, stage_data: [{ stage: 1, timeSec: 90, heartRate: 92, bp: '122/76', rpe: 8, symptoms: 'None', speedMph: 2, speedKmh: 3.22, grade: 0, mets: 2.53 }, { stage: 2, timeSec: 210, heartRate: 104, bp: '130/78', rpe: 10, symptoms: 'None', speedMph: 2, speedKmh: 3.22, grade: 3.5, mets: 3.5 }, { stage: 3, timeSec: 300, heartRate: 116, bp: '138/80', rpe: 12, symptoms: 'Mild leg fatigue', speedMph: 2, speedKmh: 3.22, grade: 7, mets: 4.46 }], termination_reason: 'Patient requests to stop', notes: 'Stable Naughton fixture.' },
  sgrq: { diagnosis: 'Synthetic respiratory diagnosis', smoking_status: 'Ex-smoker', oxygen_use: false, exacerbations: 1, rehab: true, admin_mode: 'Clinician-administered', symptoms_responses: { s1: 2, s2: 1, s3: 2, s4: 3, s5: 2, s6: 2, s7: 3, s8: 1 }, activity_responses: Object.fromEntries(SGRQ_ACTIVITY_ITEMS.map((item, index) => [item.key, index % 2 === 0])), impact_responses: Object.fromEntries(SGRQ_IMPACT_ITEMS.map((item, index) => [item.key, index % 3 === 0])), notes: 'Stable SGRQ fixture.' },
  dexa: { t_scores: { lumbarSpine: -1.4, femoralNeck: -1.8, totalHip: -1.2, distalRadius: null }, bmd_values: { lumbarSpine: 0.91, femoralNeck: 0.82, totalHip: 0.88, distalRadius: null }, body_fat_percentage: 27.5, visceral_adipose_tissue: 92, lean_mass_kg: 48.2, notes: 'Stable DEXA fixture.' },
  conley: { scores: { recent_fall: true, history_falls: false, impaired_mobility: true, altered_elimination: false, confusion: false, dizziness: true, poor_judgment: false }, notes: 'Stable Conley fixture.' },
  'perceived-stress-scale': { responses: [2, 3, 2, 1, 2, 3, 1, 2, 3, 2], notes: 'Stable PSS fixture.' },
  'heart-rate-recovery': { peak_heart_rate: 166, hr_1_minute: 146, hr_2_minute: 132, additional_measurements: [{ timepoint: 3, label: '3 minutes', hr: 120 }], recovery_mode: 'passive_standing', preceding_test: 'Synthetic treadmill test', symptoms: 'No symptoms', notes: 'Stable HRR fixture.' },
  'lipid-profile': { unit: 'mmol', total_cholesterol: 5.1, ldl: 3.1, hdl: 1.4, triglycerides: 1.6, notes: 'Stable lipid fixture.' },
  'borg-rpe': { scale_type: 'borg_6_20', rpe_value: 13, activity_description: 'Synthetic treadmill walking', notes: 'Stable Borg fixture.' },
  quickdash: { raw_sum: 33, total_score: 50, assessor_name: 'Synthetic Clinician', assessment_date: '2026-08-22', notes: 'Stable QuickDASH fixture.' },
});

export function buildFixture(runnerKey) {
  invariant(Object.hasOwn(FIXTURES, runnerKey), `unsupported runner key ${runnerKey}`);
  return clone(FIXTURES[runnerKey]);
}

export function validateAndScore(input, context = {}) {
  const runtimeContext = /** @type {Record<string, any>} */ (context);
  const runnerKey = input?.runnerKey ?? input?.runner_key ?? input?.scoringKey ?? input?.scoring_key ?? runtimeContext.runnerKey;
  invariant(typeof runnerKey === 'string' && Object.hasOwn(SCORERS, runnerKey), `unsupported runner key ${String(runnerKey)}`);
  return SCORERS[runnerKey](input, context);
}
