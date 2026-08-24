import {
  buildCompletedPayload,
  requireChoice,
  requireFiniteNumber,
  requireInteger,
} from './contract.js';

function invariant(condition, message) {
  if (!condition) throw new Error(`Residual assessment scorer: ${message}`);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function option(label, value) {
  return Object.freeze({ label, value });
}

const ZERO_TO_TEN = Object.freeze(Array.from({ length: 11 }, (_, value) => option(String(value), value)));
const ONE_TO_SEVEN = Object.freeze(Array.from({ length: 7 }, (_, index) => option(String(index + 1), index + 1)));
const UEFI_OPTIONS = Object.freeze([
  option('Extreme difficulty or unable to perform', 0),
  option('Quite a bit of difficulty', 1),
  option('Moderate difficulty', 2),
  option('A little bit of difficulty', 3),
  option('No difficulty', 4),
]);
const BINARY_OPTIONS = Object.freeze([option('Disagree', 0), option('Agree', 1)]);

function item(key, prompt, options, extra = {}) {
  return Object.freeze({
    key,
    prompt,
    type: 'single_choice',
    required: true,
    options,
    responseBinding: Object.freeze({ field: 'responses', key }),
    ...extra,
  });
}

function field(key, label, type, extra = {}) {
  return Object.freeze({ key, label, type, required: extra.required !== false, ...extra });
}

const CRDQ_ITEM_DEFINITIONS = Object.freeze([
  ['q1', 'Breathlessness difficulty while walking uphill or climbing stairs', 'dyspnoea'],
  ['q2', 'Shortness of breath while hurrying', 'dyspnoea'],
  ['q3', 'Breathlessness preventing desired activities', 'dyspnoea'],
  ['q4', 'Fatigue or tiredness', 'fatigue'],
  ['q5', 'Low mood frequency', 'emotional_function'],
  ['q6', 'Frustration frequency', 'emotional_function'],
  ['q7', 'Anxiety or fear caused by respiratory disease', 'emotional_function'],
  ['q8', 'Depressed mood frequency', 'emotional_function'],
  ['q9', 'Fear or worry about health', 'emotional_function'],
  ['q10', 'Effect of respiratory disease on family life', 'emotional_function'],
  ['q11', 'Confidence preventing disease interference with work', 'mastery'],
  ['q12', 'Perceived control over respiratory disease', 'mastery'],
  ['q13', 'Confidence in ability to manage disease', 'mastery'],
  ['q14', 'Optimism about the future', 'mastery'],
  ['q15', 'Awareness of breathing while relaxing', 'dyspnoea'],
  ['q16', 'Breathlessness frequency while climbing stairs', 'dyspnoea'],
  ['q17', 'Concern about health', 'emotional_function'],
  ['q18', 'Breathing preventing desired activities', 'dyspnoea'],
  ['q19', 'Feeling in control of life', 'mastery'],
  ['q20', 'Health limiting social life', 'emotional_function'],
]);

export const CRDQ_RUNNER_SPEC = deepFreeze({
  schemaVersion: 1,
  kind: 'questionnaire',
  runnerKey: 'crdq',
  scoringKey: 'crdq',
  fields: [],
  items: CRDQ_ITEM_DEFINITIONS.map(([key, prompt, domain]) => item(key, prompt, ONE_TO_SEVEN, { domain })),
  scoring: {
    method: 'source-item-domain-means-and-overall-mean',
    version: 'crdq-ep-source-20.v1',
    domains: ['dyspnoea', 'fatigue', 'emotional_function', 'mastery'],
  },
  result: {
    primaryField: 'overall_mean',
    unit: 'points',
    additionalDataFields: ['domain_scores', 'responses', 'soap_text'],
  },
});

const UEFI_ACTIVITIES = Object.freeze([
  'Usual work, housework, or school activities',
  'Usual hobbies, recreation, or sport',
  'Lift a grocery bag to waist height',
  'Lift a grocery bag above the head',
  'Groom hair',
  'Push up through the hands from a chair or bath',
  'Prepare food, including peeling or cutting',
  'Drive',
  'Vacuum, sweep, or rake',
  'Dress',
  'Fasten buttons',
  'Use tools or appliances',
  'Open doors',
  'Clean',
  'Tie or lace shoes',
  'Sleep',
  'Launder clothes, including washing, ironing, or folding',
  'Open a jar',
  'Throw a ball',
  'Carry a small suitcase with the affected arm',
]);

export const UEFI_RUNNER_SPEC = deepFreeze({
  schemaVersion: 1,
  kind: 'questionnaire',
  runnerKey: 'uefs',
  scoringKey: 'uefs',
  fields: [],
  items: UEFI_ACTIVITIES.map((prompt, index) => item(`q${index + 1}`, prompt, UEFI_OPTIONS)),
  scoring: { method: 'sum-twenty-zero-to-four-items', version: 'uefi-20.v1', range: [0, 80] },
  result: {
    primaryField: 'total_score',
    unit: 'points',
    additionalDataFields: ['responses', 'maximum_score', 'soap_text'],
  },
  provenance: {
    sourceInstrumentName: 'Upper Extremity Functional Index (UEFI-20)',
    catalogueLabelRetained: 'Upper Extremity Functional Scale (UEFS)',
  },
});

const START_BACK_PROMPTS = Object.freeze([
  'Back pain spread into one or both legs during the last two weeks',
  'Shoulder or neck pain occurred during the last two weeks',
  'Back pain limited walking to short distances',
  'Back pain caused slower dressing during the last two weeks',
  'Physical activity feels unsafe for a person with this condition',
  'Worrying thoughts occurred frequently',
  'The back pain feels terrible and unlikely to improve',
  'Usual activities have not been enjoyable',
]);
const START_BACK_BOTHERSOME = Object.freeze([
  option('Not at all', 0),
  option('Slightly', 0),
  option('Moderately', 0),
  option('Very much', 1),
  option('Extremely', 1),
]);

export const START_BACK_RUNNER_SPEC = deepFreeze({
  schemaVersion: 1,
  kind: 'questionnaire',
  runnerKey: 'start-back',
  scoringKey: 'start-back',
  fields: [],
  items: [
    ...START_BACK_PROMPTS.map((prompt, index) => item(`q${index + 1}`, prompt, BINARY_OPTIONS)),
    item('q9', 'Overall bothersomeness of back pain during the last two weeks', START_BACK_BOTHERSOME),
  ],
  scoring: {
    method: 'nine-item-total-and-items-five-to-nine-psychosocial-subscale',
    version: 'start-back-9.v1',
    riskRule: 'total<=3 low; otherwise psychosocial>=4 high; otherwise medium',
  },
  result: {
    primaryField: 'total_score',
    unit: 'points',
    additionalDataFields: ['psychosocial_score', 'risk_band', 'responses', 'soap_text'],
  },
});

const OREBRO_DURATION_OPTIONS = Object.freeze([
  option('0–1 weeks', 1), option('1–2 weeks', 2), option('3–4 weeks', 3),
  option('4–5 weeks', 4), option('6–8 weeks', 5), option('9–11 weeks', 6),
  option('3–6 months', 7), option('6–9 months', 8), option('9–12 months', 9),
  option('Over one year', 10),
]);

export const OREBRO_RUNNER_SPEC = deepFreeze({
  schemaVersion: 1,
  kind: 'questionnaire',
  runnerKey: 'orebro',
  scoringKey: 'orebro',
  fields: [],
  items: [
    item('q1', 'Duration of the current pain problem', OREBRO_DURATION_OPTIONS),
    item('q2', 'Pain intensity during the past week', ZERO_TO_TEN),
    item('q3', 'Current ability to perform light work or home duties for one hour', ZERO_TO_TEN, { reverseScored: true }),
    item('q4', 'Current ability to sleep at night', ZERO_TO_TEN, { reverseScored: true }),
    item('q5', 'Tension or anxiety during the past week', ZERO_TO_TEN),
    item('q6', 'Distress caused by depressed feelings during the past week', ZERO_TO_TEN),
    item('q7', 'Perceived risk that the current pain will persist', ZERO_TO_TEN),
    item('q8', 'Perceived chance of performing normal work or home duties in three months', ZERO_TO_TEN, { reverseScored: true }),
    item('q9', 'Belief that increased pain means activity should stop until pain decreases', ZERO_TO_TEN),
    item('q10', 'Belief that normal work or home duties should not be performed with current pain', ZERO_TO_TEN),
  ],
  scoring: {
    method: 'sum-ten-items-reversing-items-three-four-eight',
    version: 'omspq-10-short.v1',
    range: [0, 100],
    increasedRiskThreshold: 50,
  },
  result: {
    primaryField: 'total_score',
    unit: 'points',
    additionalDataFields: ['instrument_version', 'risk_band', 'responses', 'scored_items', 'soap_text'],
  },
});

const MYOTOMES = Object.freeze([
  ['C5', 'Shoulder abduction'], ['C6', 'Elbow flexion or wrist extension'],
  ['C7', 'Elbow extension or wrist flexion'], ['C8', 'Thumb extension or finger flexion'],
  ['T1', 'Finger abduction'], ['L2', 'Hip flexion'], ['L3', 'Knee extension'],
  ['L4', 'Ankle dorsiflexion'], ['L5', 'Great-toe extension'],
  ['S1', 'Ankle plantarflexion or eversion'], ['S2', 'Knee flexion'],
]);
const DERMATOMES = Object.freeze(['C5', 'C6', 'C7', 'C8', 'T1', 'L2', 'L3', 'L4', 'L5', 'S1', 'S2']);
const REFLEXES = Object.freeze([
  ['biceps_c5_c6', 'Biceps reflex (C5–C6)'],
  ['brachioradialis_c6', 'Brachioradialis reflex (C6)'],
  ['triceps_c7', 'Triceps reflex (C7)'],
  ['patellar_l3_l4', 'Patellar reflex (L3–L4)'],
  ['achilles_s1', 'Achilles reflex (S1)'],
]);
const MRC_OPTIONS = Object.freeze(['0', '1', '2', '3', '4', '5', 'Not tested']);
const SENSORY_OPTIONS = Object.freeze(['Normal', 'Reduced', 'Absent', 'Altered', 'Not tested']);
const REFLEX_OPTIONS = Object.freeze(['0', '1+', '2+', '3+', '4+', 'Not tested']);
const SIDES = Object.freeze(['left', 'right']);

export const NEUROLOGICAL_SCREEN_FIELDS = deepFreeze([
  field('region', 'Region screened', 'select', { options: ['Upper limb', 'Lower limb', 'Upper and lower limbs'] }),
  ...MYOTOMES.flatMap(([level, action]) => SIDES.map((side) => field(
    `myotome_${level.toLowerCase()}_${side}`,
    `${level} ${action} — ${side}`,
    'select',
    { options: MRC_OPTIONS },
  ))),
  ...DERMATOMES.flatMap((level) => SIDES.map((side) => field(
    `dermatome_${level.toLowerCase()}_${side}`,
    `${level} dermatome sensation — ${side}`,
    'select',
    { options: SENSORY_OPTIONS },
  ))),
  ...REFLEXES.flatMap(([key, label]) => SIDES.map((side) => field(
    `reflex_${key}_${side}`,
    `${label} — ${side}`,
    'select',
    { options: REFLEX_OPTIONS },
  ))),
  field('findings', 'Levels, sides, grades, asymmetry, and other neurological findings', 'textarea'),
]);

export const NEUROLOGICAL_SCREEN_RUNNER_SPEC = deepFreeze({
  schemaVersion: 1,
  kind: 'measurement',
  runnerKey: 'neurological-screen',
  scoringKey: 'neurological-screen',
  fields: NEUROLOGICAL_SCREEN_FIELDS,
  scoring: {
    method: 'per-level-per-side-abnormal-finding-count-with-raw-grades-retained',
    version: 'neurological-screen-level-side.v1',
  },
  result: {
    primaryField: 'abnormal_finding_count',
    unit: 'findings',
    additionalDataFields: ['values', 'abnormal_findings', 'soap_text'],
  },
});

export const ASTRAND_STEP_RUNNER_SPEC = deepFreeze({
  schemaVersion: 1,
  kind: 'measurement',
  runnerKey: 'astrand_rhyming_step',
  scoringKey: 'astrand_rhyming_step',
  fields: [
    field('sex', 'Protocol sex category', 'select', { options: ['male', 'female'] }),
    field('age', 'Age', 'number', { min: 12, max: 100, unit: 'years' }),
    field('weight_kg', 'Body mass', 'number', { min: 20, max: 300, unit: 'kg' }),
    field('height_cm', 'Height', 'number', { min: 80, max: 250, unit: 'cm' }),
    field('elapsed_seconds', 'Stepping duration', 'number', { min: 1, max: 300, unit: 'seconds' }),
    field('heart_rate_during', 'Heart rate during final test minute', 'number', { min: 30, max: 240, unit: 'bpm', required: false }),
    field('post_test_heart_rate', 'Immediate post-test heart rate', 'number', { min: 30, max: 240, unit: 'bpm' }),
    field('notes', 'Clinical notes', 'textarea', { required: false }),
  ],
  scoring: {
    method: 'record-protocol-completion-and-post-test-heart-rate-without-unvalidated-vo2-conversion',
    version: 'astrand-rhyming-step-recorded-hr.v1',
    cadenceCyclesPerMinute: 22.5,
    durationSeconds: 300,
    stepHeightCm: { male: 40, female: 33 },
  },
  result: {
    primaryField: 'post_test_heart_rate',
    unit: 'bpm',
    additionalDataFields: ['protocol', 'completed_full_protocol', 'raw_input', 'soap_text'],
  },
});

function responsesFrom(input) {
  const responses = input?.responses ?? input;
  invariant(responses && typeof responses === 'object' && !Array.isArray(responses), 'responses must be an object');
  return responses;
}

function responseFor(responses, key, index) {
  const value = responses[key] ?? responses[index];
  invariant(value !== '' && value !== null && value !== undefined, `${key} is required`);
  return value;
}

function integerResponses(input, spec, { min, max }) {
  const responses = responsesFrom(input);
  const normalized = {};
  spec.items.forEach(({ key }, index) => {
    normalized[key] = requireInteger(responseFor(responses, key, index), key, { min, max });
  });
  return normalized;
}

function questionnaireSoap(name, total, maximum, spec, responses, extraLines = []) {
  return [
    `• ${name}: ${total}/${maximum}`,
    ...extraLines,
    '  Item scores:',
    ...spec.items.map(({ key, prompt }, index) => `  ${index + 1}. ${prompt}: ${responses[key]}`),
  ].join('\n');
}

export function validateAndScoreCrdq(input, context = {}) {
  const responses = integerResponses(input, CRDQ_RUNNER_SPEC, { min: 1, max: 7 });
  const domains = {};
  for (const domain of CRDQ_RUNNER_SPEC.scoring.domains) {
    const values = CRDQ_RUNNER_SPEC.items.filter((candidate) => candidate.domain === domain).map(({ key }) => responses[key]);
    invariant(values.length > 0, `${domain} has no items`);
    domains[domain] = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
  }
  const values = Object.values(responses);
  const overall = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
  const soapText = questionnaireSoap(context.assessmentName, overall, 7, CRDQ_RUNNER_SPEC, responses, [
    `  Domain means — Dyspnoea: ${domains.dyspnoea}/7; Fatigue: ${domains.fatigue}/7; Emotional function: ${domains.emotional_function}/7; Mastery: ${domains.mastery}/7`,
  ]);
  return buildCompletedPayload({
    context,
    resultValue: overall,
    measurementType: 'crdq',
    scoringKey: 'crdq',
    scoringVersion: CRDQ_RUNNER_SPEC.scoring.version,
    rawInput: { responses },
    soapText,
    additionalData: { responses, domain_scores: domains, overall_mean: overall, item_count: 20 },
  });
}

export function validateAndScoreUefi(input, context = {}) {
  const responses = integerResponses(input, UEFI_RUNNER_SPEC, { min: 0, max: 4 });
  const total = Object.values(responses).reduce((sum, value) => sum + value, 0);
  const soapText = questionnaireSoap(context.assessmentName, total, 80, UEFI_RUNNER_SPEC, responses);
  return buildCompletedPayload({
    context,
    resultValue: total,
    measurementType: 'uefi-20',
    scoringKey: 'uefs',
    scoringVersion: UEFI_RUNNER_SPEC.scoring.version,
    rawInput: { responses },
    soapText,
    additionalData: { responses, total_score: total, maximum_score: 80 },
  });
}

export function validateAndScoreStartBack(input, context = {}) {
  const responses = integerResponses(input, START_BACK_RUNNER_SPEC, { min: 0, max: 1 });
  const total = Object.values(responses).reduce((sum, value) => sum + value, 0);
  const psychosocial = ['q5', 'q6', 'q7', 'q8', 'q9'].reduce((sum, key) => sum + responses[key], 0);
  const riskBand = total <= 3 ? 'Low risk' : psychosocial >= 4 ? 'High risk' : 'Medium risk';
  const soapText = questionnaireSoap(context.assessmentName, total, 9, START_BACK_RUNNER_SPEC, responses, [
    `  Psychosocial subscale: ${psychosocial}/5`,
    `  Risk stratum: ${riskBand}`,
  ]);
  return buildCompletedPayload({
    context,
    resultValue: total,
    measurementType: 'start-back',
    scoringKey: 'start-back',
    scoringVersion: START_BACK_RUNNER_SPEC.scoring.version,
    rawInput: { responses },
    soapText,
    additionalData: { responses, total_score: total, psychosocial_score: psychosocial, risk_band: riskBand },
  });
}

export function validateAndScoreOrebro(input, context = {}) {
  const responses = responsesFrom(input);
  const normalized = {};
  OREBRO_RUNNER_SPEC.items.forEach(({ key }, index) => {
    normalized[key] = requireInteger(responseFor(responses, key, index), key, {
      min: key === 'q1' ? 1 : 0,
      max: 10,
    });
  });
  const scoredItems = Object.fromEntries(Object.entries(normalized).map(([key, value]) => [
    key,
    ['q3', 'q4', 'q8'].includes(key) ? 10 - value : value,
  ]));
  const total = Object.values(scoredItems).reduce((sum, value) => sum + value, 0);
  const riskBand = total >= 50 ? 'Increased risk of long-term disability' : 'Below the published increased-risk threshold';
  const soapText = questionnaireSoap(context.assessmentName, total, 100, OREBRO_RUNNER_SPEC, normalized, [
    '  Instrument version: OMSPQ-10 short form',
    `  Risk band: ${riskBand}`,
    `  Scored items after reversals: ${Object.values(scoredItems).join(', ')}`,
  ]);
  return buildCompletedPayload({
    context,
    resultValue: total,
    measurementType: 'omspq-10',
    scoringKey: 'orebro',
    scoringVersion: OREBRO_RUNNER_SPEC.scoring.version,
    rawInput: { responses: normalized },
    soapText,
    additionalData: {
      instrument_version: 'OMSPQ-10 short form',
      responses: normalized,
      scored_items: scoredItems,
      total_score: total,
      risk_band: riskBand,
    },
  });
}

function relevantLevel(region, level) {
  const isUpper = /^[CT]/.test(level);
  if (region === 'Upper and lower limbs') return true;
  return region === 'Upper limb' ? isUpper : !isUpper;
}

export function validateAndScoreNeurologicalScreen(input, context = {}) {
  invariant(input && typeof input === 'object' && !Array.isArray(input), 'neurological input must be an object');
  const region = requireChoice(input.region, 'region', ['Upper limb', 'Lower limb', 'Upper and lower limbs']);
  const values = { region };
  const abnormalFindings = [];
  for (const [level] of MYOTOMES) {
    if (!relevantLevel(region, level)) continue;
    for (const side of SIDES) {
      const key = `myotome_${level.toLowerCase()}_${side}`;
      const grade = requireChoice(input[key], key, MRC_OPTIONS);
      invariant(grade !== 'Not tested', `${key} must be tested for the selected region`);
      values[key] = grade;
      if (grade !== '5') abnormalFindings.push(`${level} myotome ${side}: grade ${grade}/5`);
    }
  }
  for (const level of DERMATOMES) {
    if (!relevantLevel(region, level)) continue;
    for (const side of SIDES) {
      const key = `dermatome_${level.toLowerCase()}_${side}`;
      const finding = requireChoice(input[key], key, SENSORY_OPTIONS);
      invariant(finding !== 'Not tested', `${key} must be tested for the selected region`);
      values[key] = finding;
      if (finding !== 'Normal') abnormalFindings.push(`${level} dermatome ${side}: ${finding}`);
    }
  }
  for (const [reflexKey, label] of REFLEXES) {
    const level = reflexKey.includes('c') ? 'C' : reflexKey.includes('l') ? 'L' : 'S';
    if (!relevantLevel(region, level)) continue;
    for (const side of SIDES) {
      const key = `reflex_${reflexKey}_${side}`;
      const grade = requireChoice(input[key], key, REFLEX_OPTIONS);
      invariant(grade !== 'Not tested', `${key} must be tested for the selected region`);
      values[key] = grade;
      if (grade !== '2+') abnormalFindings.push(`${label} ${side}: ${grade}`);
    }
  }
  const findings = String(input.findings || '').trim();
  invariant(findings, 'findings are required');
  values.findings = findings;
  const result = abnormalFindings.length;
  const soapText = [
    `• ${context.assessmentName}`,
    `  Region: ${region}`,
    `  Abnormal findings: ${result}`,
    ...(abnormalFindings.length ? abnormalFindings.map((finding) => `  - ${finding}`) : ['  - No abnormal tested level/side grades recorded']),
    `  Clinical findings: ${findings}`,
  ].join('\n');
  return buildCompletedPayload({
    context,
    resultValue: result,
    measurementType: 'neurological-screen',
    scoringKey: 'neurological-screen',
    scoringVersion: NEUROLOGICAL_SCREEN_RUNNER_SPEC.scoring.version,
    rawInput: values,
    soapText,
    additionalData: { values, abnormal_findings: abnormalFindings, abnormal_finding_count: result },
  });
}

export function validateAndScoreAstrandStep(input, context = {}) {
  invariant(input && typeof input === 'object' && !Array.isArray(input), 'Astrand step input must be an object');
  const sex = requireChoice(input.sex ?? input.gender, 'sex', ['male', 'female']);
  const age = requireInteger(input.age, 'age', { min: 12, max: 100 });
  const weightKg = requireFiniteNumber(input.weight_kg ?? input.weight, 'weight_kg', { min: 20, max: 300 });
  const heightCm = requireFiniteNumber(input.height_cm ?? input.height, 'height_cm', { min: 80, max: 250 });
  const elapsedSeconds = requireInteger(input.elapsed_seconds, 'elapsed_seconds', { min: 1, max: 300 });
  const during = input.heart_rate_during === '' || input.heart_rate_during === null || input.heart_rate_during === undefined
    ? null
    : requireInteger(input.heart_rate_during, 'heart_rate_during', { min: 30, max: 240 });
  const post = requireInteger(input.post_test_heart_rate, 'post_test_heart_rate', { min: 30, max: 240 });
  const notes = String(input.notes || context.notes || '').trim();
  const full = elapsedSeconds === 300;
  const stepHeightCm = sex === 'male' ? 40 : 33;
  const rawInput = {
    sex, age, weight_kg: weightKg, height_cm: heightCm, elapsed_seconds: elapsedSeconds,
    heart_rate_during: during, post_test_heart_rate: post, notes,
  };
  const soapText = [
    `• ${context.assessmentName}`,
    `  Protocol: ${stepHeightCm} cm step; 22.5 cycles/min; ${elapsedSeconds}/300 seconds`,
    `  Completion: ${full ? 'Full five-minute protocol' : 'Stopped before five minutes'}`,
    during === null ? null : `  Final-minute heart rate: ${during} bpm`,
    `  Immediate post-test heart rate: ${post} bpm`,
    notes ? `  Clinical notes: ${notes}` : null,
  ].filter(Boolean).join('\n');
  return buildCompletedPayload({
    context,
    resultValue: post,
    measurementType: 'astrand-rhyming-step-test',
    scoringKey: 'astrand_rhyming_step',
    scoringVersion: ASTRAND_STEP_RUNNER_SPEC.scoring.version,
    rawInput,
    soapText,
    additionalData: {
      post_test_heart_rate: post,
      heart_rate_during: during,
      completed_full_protocol: full,
      protocol: { step_height_cm: stepHeightCm, cadence_cycles_per_minute: 22.5, target_duration_seconds: 300 },
    },
  });
}

const DEFINITIONS = deepFreeze([
  { runnerSpec: CRDQ_RUNNER_SPEC, buildFixture: () => ({ responses: Object.fromEntries(CRDQ_RUNNER_SPEC.items.map(({ key }, index) => [key, (index % 7) + 1])) }), validateAndScore: validateAndScoreCrdq },
  { runnerSpec: UEFI_RUNNER_SPEC, buildFixture: () => ({ responses: Object.fromEntries(UEFI_RUNNER_SPEC.items.map(({ key }, index) => [key, index % 5])) }), validateAndScore: validateAndScoreUefi },
  { runnerSpec: START_BACK_RUNNER_SPEC, buildFixture: () => ({ responses: { q1: 1, q2: 0, q3: 1, q4: 1, q5: 1, q6: 1, q7: 0, q8: 1, q9: 1 } }), validateAndScore: validateAndScoreStartBack },
  { runnerSpec: OREBRO_RUNNER_SPEC, buildFixture: () => ({ responses: { q1: 5, q2: 6, q3: 4, q4: 5, q5: 4, q6: 3, q7: 6, q8: 7, q9: 5, q10: 6 } }), validateAndScore: validateAndScoreOrebro },
  { runnerSpec: NEUROLOGICAL_SCREEN_RUNNER_SPEC, buildFixture: () => {
    const fixture = { region: 'Upper and lower limbs', findings: 'All tested levels and sides recorded; one reduced left L5 myotome.' };
    for (const [level] of MYOTOMES) for (const side of SIDES) fixture[`myotome_${level.toLowerCase()}_${side}`] = level === 'L5' && side === 'left' ? '4' : '5';
    for (const level of DERMATOMES) for (const side of SIDES) fixture[`dermatome_${level.toLowerCase()}_${side}`] = 'Normal';
    for (const [key] of REFLEXES) for (const side of SIDES) fixture[`reflex_${key}_${side}`] = '2+';
    return fixture;
  }, validateAndScore: validateAndScoreNeurologicalScreen },
  { runnerSpec: ASTRAND_STEP_RUNNER_SPEC, buildFixture: () => ({ sex: 'female', age: 44, weight_kg: 68, height_cm: 166, elapsed_seconds: 300, heart_rate_during: 142, post_test_heart_rate: 138, notes: 'Cadence maintained.' }), validateAndScore: validateAndScoreAstrandStep },
]);

export const RESIDUAL_ASSESSMENT_SCORERS = DEFINITIONS;
export const RUNNER_SPECS = Object.freeze(DEFINITIONS.map(({ runnerSpec }) => runnerSpec));

const DEFINITION_BY_KEY = new Map();
for (const definition of DEFINITIONS) {
  DEFINITION_BY_KEY.set(definition.runnerSpec.runnerKey, definition);
  DEFINITION_BY_KEY.set(definition.runnerSpec.scoringKey, definition);
}

export function buildFixture(key) {
  const definition = DEFINITION_BY_KEY.get(String(key || '').trim());
  invariant(definition, `unsupported fixture key ${key}`);
  return clone(definition.buildFixture());
}

export function validateAndScore(key, input, context = {}) {
  const definition = DEFINITION_BY_KEY.get(String(key || '').trim());
  invariant(definition, `unsupported scorer key ${key}`);
  return definition.validateAndScore(input, context);
}
