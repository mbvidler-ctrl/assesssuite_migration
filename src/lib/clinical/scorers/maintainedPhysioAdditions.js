import {
  buildCompletedPayload,
  requireChoice,
  requireFiniteNumber,
  requireInteger,
} from './contract.js';

function boundedText(value, field, maxLength) {
  const text = String(value ?? '').trim();
  if (text.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or fewer`);
  return text;
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function optionalFiniteNumber(value, field, limits) {
  if (value === '' || value === null || value === undefined) return null;
  return requireFiniteNumber(value, field, limits);
}

function completedContext(context, assessmentName, notes) {
  return { ...context, assessmentName: context.assessmentName || assessmentName, notes };
}

function choiceOptions(entries) {
  return Object.freeze(entries.map(([label, value]) => Object.freeze({ label, value })));
}

export const BESS_CONDITIONS = Object.freeze([
  Object.freeze({ key: 'firm_double_leg_errors', label: 'Double leg stance on firm surface' }),
  Object.freeze({ key: 'firm_single_leg_errors', label: 'Single leg stance on firm surface, non-dominant foot' }),
  Object.freeze({ key: 'firm_tandem_errors', label: 'Tandem stance on firm surface, non-dominant foot back' }),
  Object.freeze({ key: 'foam_double_leg_errors', label: 'Double leg stance on foam surface' }),
  Object.freeze({ key: 'foam_single_leg_errors', label: 'Single leg stance on foam surface, non-dominant foot' }),
  Object.freeze({ key: 'foam_tandem_errors', label: 'Tandem stance on foam surface, non-dominant foot back' }),
]);

export const BESS_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'measurement',
  runnerKey: 'bess',
  scoringKey: 'bess',
  fields: Object.freeze([
    ...BESS_CONDITIONS.map(({ key, label }) => Object.freeze({
      key,
      label,
      type: 'number',
      required: true,
      min: 0,
      max: 10,
      step: 1,
      unit: 'errors',
    })),
    Object.freeze({ key: 'notes', label: 'Clinical notes', type: 'textarea', required: false }),
  ]),
  scoring: Object.freeze({
    method: 'sum-six-condition-errors',
    range: Object.freeze([0, 60]),
    direction: 'lower_better',
    version: 'bess-six-condition-v1',
  }),
  result: Object.freeze({
    primaryField: 'total_errors',
    unit: 'errors',
    additionalDataFields: Object.freeze(['condition_errors', 'soap_text']),
  }),
});

export function buildBessFixture() {
  return {
    firm_double_leg_errors: 0,
    firm_single_leg_errors: 2,
    firm_tandem_errors: 1,
    foam_double_leg_errors: 1,
    foam_single_leg_errors: 4,
    foam_tandem_errors: 2,
    notes: 'Deterministic six-condition BESS fixture.',
  };
}

export function validateAndScoreBess(input, context = {}) {
  const conditionErrors = Object.fromEntries(BESS_CONDITIONS.map(({ key, label }) => [
    key,
    requireInteger(input?.[key], label, { min: 0, max: 10 }),
  ]));
  const notes = boundedText(input?.notes, 'Clinical notes', 4000);
  const totalErrors = Object.values(conditionErrors).reduce((sum, value) => sum + value, 0);
  const rawInput = { ...conditionErrors, notes };
  const conditionLines = BESS_CONDITIONS.map(({ key, label }) => `  ${label}: ${conditionErrors[key]} error${conditionErrors[key] === 1 ? '' : 's'}`);
  const soapText = [
    '• Balance Error Scoring System (BESS)',
    `  Total errors: ${totalErrors}/60`,
    '  Condition breakdown:',
    ...conditionLines,
    notes ? `  Clinical notes: ${notes}` : null,
  ].filter(Boolean).join('\n');

  return buildCompletedPayload({
    context: completedContext(context, 'Balance Error Scoring System (BESS)', notes),
    resultValue: totalErrors,
    measurementType: 'bess',
    scoringKey: BESS_RUNNER_SPEC.scoringKey,
    scoringVersion: BESS_RUNNER_SPEC.scoring.version,
    rawInput,
    soapText,
    additionalData: {
      total_errors: totalErrors,
      condition_errors: conditionErrors,
      report_text: `Balance Error Scoring System (BESS): ${totalErrors} errors across six conditions.`,
    },
  });
}

export const BOD_POD_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'measurement',
  runnerKey: 'bod_pod',
  scoringKey: 'bod-pod',
  fields: Object.freeze([
    Object.freeze({ key: 'body_mass_kg', label: 'Body mass', type: 'number', required: false, min: 0.01, max: 500, step: 0.01, unit: 'kg' }),
    Object.freeze({ key: 'body_volume_l', label: 'Body volume', type: 'number', required: false, min: 0.01, max: 500, step: 0.01, unit: 'L' }),
    Object.freeze({ key: 'body_density_g_cc', label: 'Body density', type: 'number', required: false, min: 0.5, max: 2, step: 0.001, unit: 'g/cc' }),
    Object.freeze({ key: 'body_fat_pct', label: 'Body fat', type: 'number', required: false, min: 0, max: 100, step: 0.1, unit: '%' }),
    Object.freeze({ key: 'fat_mass_kg', label: 'Fat mass', type: 'number', required: false, min: 0, max: 500, step: 0.01, unit: 'kg' }),
    Object.freeze({ key: 'fat_free_mass_kg', label: 'Fat-free mass', type: 'number', required: false, min: 0, max: 500, step: 0.01, unit: 'kg' }),
    Object.freeze({ key: 'resting_metabolic_rate_kcal_day', label: 'Resting metabolic rate', type: 'number', required: false, min: 0, max: 10000, step: 1, unit: 'kcal/day' }),
    Object.freeze({ key: 'notes', label: 'Clinical notes', type: 'textarea', required: false }),
  ]),
  validation: Object.freeze({
    anyOf: Object.freeze([
      Object.freeze(['body_fat_pct']),
      Object.freeze(['body_mass_kg', 'fat_mass_kg']),
    ]),
  }),
  scoring: Object.freeze({
    method: 'direct-or-fat-mass-over-body-mass',
    range: Object.freeze([0, 100]),
    direction: 'contextual',
    version: 'bod-pod-v1',
  }),
  result: Object.freeze({
    primaryField: 'body_fat_pct',
    unit: '%',
    additionalDataFields: Object.freeze([
      'body_mass_kg',
      'body_volume_l',
      'body_density_g_cc',
      'fat_mass_kg',
      'fat_free_mass_kg',
      'resting_metabolic_rate_kcal_day',
      'soap_text',
    ]),
  }),
});

export function buildBodPodFixture() {
  return {
    body_mass_kg: 80,
    body_volume_l: 75.4,
    body_density_g_cc: 1.061,
    fat_mass_kg: 16,
    resting_metabolic_rate_kcal_day: 1780,
    notes: 'Deterministic calculated BOD POD fixture.',
  };
}

export function computeBodPodResult(input) {
  const bodyMass = optionalFiniteNumber(input?.body_mass_kg, 'Body mass', { min: 0.01, max: 500 });
  const bodyVolume = optionalFiniteNumber(input?.body_volume_l, 'Body volume', { min: 0.01, max: 500 });
  const bodyDensity = optionalFiniteNumber(input?.body_density_g_cc, 'Body density', { min: 0.5, max: 2 });
  const directBodyFat = optionalFiniteNumber(input?.body_fat_pct, 'Body fat percentage', { min: 0, max: 100 });
  const fatMass = optionalFiniteNumber(input?.fat_mass_kg, 'Fat mass', { min: 0, max: 500 });
  const suppliedFatFreeMass = optionalFiniteNumber(input?.fat_free_mass_kg, 'Fat-free mass', { min: 0, max: 500 });
  const restingMetabolicRate = optionalFiniteNumber(
    input?.resting_metabolic_rate_kcal_day,
    'Resting metabolic rate',
    { min: 0, max: 10000 },
  );
  if (directBodyFat === null && (bodyMass === null || fatMass === null)) {
    throw new Error('Enter body fat percentage or both body mass and fat mass');
  }
  if (bodyMass !== null && fatMass !== null && fatMass > bodyMass) {
    throw new Error('Fat mass cannot exceed body mass');
  }
  if (bodyMass !== null && suppliedFatFreeMass !== null && suppliedFatFreeMass > bodyMass) {
    throw new Error('Fat-free mass cannot exceed body mass');
  }
  const calculatedBodyFat = directBodyFat ?? (fatMass / bodyMass) * 100;
  const bodyFatPct = round(requireFiniteNumber(calculatedBodyFat, 'Body fat percentage', { min: 0, max: 100 }), 1);
  const fatFreeMass = suppliedFatFreeMass ?? (
    bodyMass !== null && fatMass !== null ? round(bodyMass - fatMass, 2) : null
  );
  return {
    body_mass_kg: bodyMass,
    body_volume_l: bodyVolume,
    body_density_g_cc: bodyDensity,
    body_fat_pct: bodyFatPct,
    fat_mass_kg: fatMass,
    fat_free_mass_kg: fatFreeMass,
    resting_metabolic_rate_kcal_day: restingMetabolicRate,
    result_source: directBodyFat === null ? 'calculated-from-fat-mass-and-body-mass' : 'device-reported-body-fat-percentage',
  };
}

export function validateAndScoreBodPod(input, context = {}) {
  const values = computeBodPodResult(input);
  const notes = boundedText(input?.notes, 'Clinical notes', 4000);
  const rawInput = { ...values, notes };
  const soapText = [
    '• Air Displacement Plethysmography (BOD POD)',
    `  Body fat: ${values.body_fat_pct.toFixed(1)}%`,
    values.body_mass_kg !== null ? `  Body mass: ${values.body_mass_kg} kg` : null,
    values.body_volume_l !== null ? `  Body volume: ${values.body_volume_l} L` : null,
    values.body_density_g_cc !== null ? `  Body density: ${values.body_density_g_cc} g/cc` : null,
    values.fat_mass_kg !== null ? `  Fat mass: ${values.fat_mass_kg} kg` : null,
    values.fat_free_mass_kg !== null ? `  Fat-free mass: ${values.fat_free_mass_kg} kg` : null,
    values.resting_metabolic_rate_kcal_day !== null
      ? `  Resting metabolic rate: ${values.resting_metabolic_rate_kcal_day} kcal/day`
      : null,
    notes ? `  Clinical notes: ${notes}` : null,
  ].filter(Boolean).join('\n');

  return buildCompletedPayload({
    context: completedContext(context, 'Air Displacement Plethysmography (BOD POD)', notes),
    resultValue: values.body_fat_pct,
    measurementType: 'body_composition',
    scoringKey: BOD_POD_RUNNER_SPEC.scoringKey,
    scoringVersion: BOD_POD_RUNNER_SPEC.scoring.version,
    rawInput,
    soapText,
    additionalData: {
      ...values,
      report_text: `Air Displacement Plethysmography (BOD POD): ${values.body_fat_pct.toFixed(1)}% body fat.`,
    },
  });
}

export const EDSS_SCORE_OPTIONS = Object.freeze([
  [0, 'Normal neurological examination'],
  [1, 'No disability, minimal signs in one functional system'],
  [1.5, 'No disability, minimal signs in more than one functional system'],
  [2, 'Minimal disability in one functional system'],
  [2.5, 'Mild disability in one functional system or minimal disability in two functional systems'],
  [3, 'Moderate disability in one functional system, or mild disability in three or four functional systems; fully ambulatory'],
  [3.5, 'Fully ambulatory with moderate disability in one functional system and more than minimal disability in several others'],
  [4, 'Fully ambulatory without aid, self-sufficient, able to walk about 500 metres'],
  [4.5, 'Fully ambulatory without aid, able to walk about 300 metres'],
  [5, 'Ambulatory without aid for about 200 metres; disability impairs full daily activities'],
  [5.5, 'Ambulatory without aid for about 100 metres; disability precludes full daily activities'],
  [6, 'Intermittent or unilateral constant assistance required to walk about 100 metres'],
  [6.5, 'Constant bilateral assistance required to walk about 20 metres'],
  [7, 'Unable to walk beyond about 5 metres even with aid; essentially restricted to wheelchair'],
  [7.5, 'Unable to take more than a few steps; restricted to wheelchair'],
  [8, 'Essentially restricted to bed or chair; retains effective use of arms'],
  [8.5, 'Essentially restricted to bed much of the day; retains some effective use of arms'],
  [9, 'Confined to bed; can still communicate and eat'],
  [9.5, 'Totally helpless bed patient; unable to communicate effectively or eat and swallow'],
  [10, 'Death due to multiple sclerosis'],
].map(([score, label]) => Object.freeze({ score, label })));

export const EDSS_FUNCTIONAL_SYSTEMS = Object.freeze([
  Object.freeze({ key: 'pyramidal', label: 'Pyramidal (motor)' }),
  Object.freeze({ key: 'cerebellar', label: 'Cerebellar' }),
  Object.freeze({ key: 'brainstem', label: 'Brainstem' }),
  Object.freeze({ key: 'sensory', label: 'Sensory' }),
  Object.freeze({ key: 'bowel_bladder', label: 'Bowel and bladder' }),
  Object.freeze({ key: 'visual', label: 'Visual' }),
  Object.freeze({ key: 'cerebral', label: 'Cerebral (mental)' }),
  Object.freeze({ key: 'ambulation', label: 'Ambulation' }),
]);

const EDSS_ALLOWED_SCORES = Object.freeze(EDSS_SCORE_OPTIONS.map(({ score }) => score));
const EDSS_FS_OPTIONS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);
const EDSS_SCORE_FIELD_OPTIONS = Object.freeze(EDSS_SCORE_OPTIONS.map(({ score, label }) => Object.freeze({
  label: `${score} — ${label}`,
  value: score,
})));
const EDSS_FS_FIELD_OPTIONS = choiceOptions([
  ['0 — Normal', 0],
  ['1 — Minimal', 1],
  ['2 — Mild', 2],
  ['3 — Moderate', 3],
  ['4 — Marked', 4],
  ['5 — Severe', 5],
  ['6 — Very severe', 6],
]);

export const EDSS_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'clinician_recorded_scale',
  runnerKey: 'edss',
  scoringKey: 'edss',
  fields: Object.freeze([
    Object.freeze({ key: 'edss_score', label: 'EDSS score', type: 'select', required: true, options: EDSS_SCORE_FIELD_OPTIONS }),
    Object.freeze({
      key: 'functional_systems',
      label: 'Functional-system grades',
      type: 'object',
      required: false,
      fields: Object.freeze(EDSS_FUNCTIONAL_SYSTEMS.map(({ key, label }) => Object.freeze({
        key,
        label: `${label} functional system`,
        type: 'select',
        required: false,
        options: EDSS_FS_FIELD_OPTIONS,
      }))),
    }),
    Object.freeze({ key: 'notes', label: 'Clinical notes', type: 'textarea', required: false }),
  ]),
  scoring: Object.freeze({
    method: 'clinician-determined-direct-entry',
    range: Object.freeze([0, 10]),
    direction: 'lower_better',
    version: 'edss-kurtzke-recording-v1',
  }),
  result: Object.freeze({
    primaryField: 'edss_score',
    unit: 'points',
    additionalDataFields: Object.freeze(['functional_systems', 'interpretation', 'descriptor', 'soap_text']),
  }),
});

export function getEdssInterpretation(score) {
  if (score === 0) return 'Normal neurological examination';
  if (score <= 3.5) return 'Minimal to moderate disability; fully ambulatory';
  if (score <= 5.5) return 'Ambulatory disability without aid';
  if (score <= 6.5) return 'Walking aid required';
  if (score <= 7.5) return 'Wheelchair dependence';
  if (score <= 9.5) return 'Bed or chair restriction';
  return 'Death due to multiple sclerosis';
}

export function buildEdssFixture() {
  return {
    edss_score: 0,
    functional_systems: { pyramidal: 0, cerebellar: 0 },
    notes: 'Deterministic zero-value EDSS fixture.',
  };
}

export function validateAndScoreEdss(input, context = {}) {
  const rawScore = requireFiniteNumber(input?.edss_score, 'EDSS score', { min: 0, max: 10 });
  const edssScore = requireChoice(rawScore, 'EDSS score', EDSS_ALLOWED_SCORES);
  const suppliedSystems = input?.functional_systems && typeof input.functional_systems === 'object'
    ? input.functional_systems
    : input || {};
  const functionalSystems = {};
  for (const { key, label } of EDSS_FUNCTIONAL_SYSTEMS) {
    const value = suppliedSystems[key];
    if (value === '' || value === null || value === undefined) continue;
    functionalSystems[key] = requireChoice(
      requireInteger(value, `${label} functional system`, { min: 0, max: 6 }),
      `${label} functional system`,
      EDSS_FS_OPTIONS,
    );
  }
  const notes = boundedText(input?.notes, 'Clinical notes', 4000);
  const descriptor = EDSS_SCORE_OPTIONS.find(({ score }) => score === edssScore)?.label;
  const interpretation = getEdssInterpretation(edssScore);
  const rawInput = { edss_score: edssScore, functional_systems: functionalSystems, notes };
  const soapText = [
    '• Expanded Disability Status Scale (EDSS)',
    `  Score: ${edssScore} — ${interpretation}`,
    `  Descriptor: ${descriptor}`,
    Object.keys(functionalSystems).length
      ? `  Functional-system grades: ${Object.entries(functionalSystems).map(([key, value]) => `${key.replaceAll('_', ' ')} ${value}`).join('; ')}`
      : null,
    notes ? `  Clinical notes: ${notes}` : null,
  ].filter(Boolean).join('\n');

  return buildCompletedPayload({
    context: completedContext(context, 'Expanded Disability Status Scale (EDSS)', notes),
    resultValue: edssScore,
    measurementType: 'edss',
    scoringKey: EDSS_RUNNER_SPEC.scoringKey,
    scoringVersion: EDSS_RUNNER_SPEC.scoring.version,
    rawInput,
    soapText,
    additionalData: {
      edss_score: edssScore,
      functional_systems: functionalSystems,
      interpretation,
      descriptor,
      report_text: `Expanded Disability Status Scale (EDSS): ${edssScore} — ${descriptor}.`,
    },
  });
}

export const IPAQ_SHORT_FORM_ITEMS = Object.freeze([
  Object.freeze({ key: 'vigorous_days', prompt: 'During the last 7 days, on how many days did you do vigorous physical activities for at least 10 minutes at a time?', type: 'number', required: true, min: 0, max: 7, step: 1, unit: 'days/week' }),
  Object.freeze({ key: 'vigorous_minutes', prompt: 'How much time did you usually spend doing vigorous physical activities on one of those days?', type: 'number', required: true, min: 0, max: 1440, step: 1, unit: 'minutes/day' }),
  Object.freeze({ key: 'moderate_days', prompt: 'During the last 7 days, on how many days did you do moderate physical activities, not including walking, for at least 10 minutes at a time?', type: 'number', required: true, min: 0, max: 7, step: 1, unit: 'days/week' }),
  Object.freeze({ key: 'moderate_minutes', prompt: 'How much time did you usually spend doing moderate physical activities on one of those days?', type: 'number', required: true, min: 0, max: 1440, step: 1, unit: 'minutes/day' }),
  Object.freeze({ key: 'walking_days', prompt: 'During the last 7 days, on how many days did you walk for at least 10 minutes at a time?', type: 'number', required: true, min: 0, max: 7, step: 1, unit: 'days/week' }),
  Object.freeze({ key: 'walking_minutes', prompt: 'How much time did you usually spend walking on one of those days?', type: 'number', required: true, min: 0, max: 1440, step: 1, unit: 'minutes/day' }),
  Object.freeze({ key: 'sitting_minutes', prompt: 'During the last 7 days, how much time did you spend sitting on a weekday?', type: 'number', required: true, min: 0, max: 1440, step: 1, unit: 'minutes/day' }),
]);

export const IPAQ_SHORT_FORM_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'questionnaire',
  runnerKey: 'ipaq',
  scoringKey: 'ipaq-short-form',
  items: IPAQ_SHORT_FORM_ITEMS,
  fields: Object.freeze([
    ...IPAQ_SHORT_FORM_ITEMS.map((item) => Object.freeze({ ...item, label: item.prompt })),
    Object.freeze({ key: 'notes', label: 'Clinical notes', type: 'textarea', required: false }),
  ]),
  scoring: Object.freeze({
    method: 'ipaq-short-form-2005-cleaned-weighted-met-minutes',
    weights: Object.freeze({ vigorous: 8, moderate: 4, walking: 3.3 }),
    minimumBoutMinutes: 10,
    truncationMinutesPerDay: 180,
    dailyActivityOutlierMinutes: 960,
    direction: 'higher_more_activity',
    version: 'ipaq-short-form-2005',
  }),
  result: Object.freeze({
    primaryField: 'total_met_mins',
    unit: 'MET-minutes/week',
    additionalDataFields: Object.freeze([
      'vigorous_met_mins',
      'moderate_met_mins',
      'walking_met_mins',
      'sitting_minutes',
      'activity_category',
      'processed_activity',
      'soap_text',
    ]),
  }),
  provenance: Object.freeze({
    sourceCitation: 'IPAQ Research Committee. Guidelines for Data Processing and Analysis of the International Physical Activity Questionnaire, revised November 2005.',
    sourceUrl: 'https://sites.google.com/view/ipaq/score',
  }),
});

function cleanIpaqActivity(days, minutes) {
  if (days === 0 || minutes < 10) return { days: 0, minutes: 0 };
  return { days, minutes: Math.min(minutes, 180) };
}

export function computeIpaqShortFormScore(input) {
  const reported = {
    vigorous_days: requireInteger(input?.vigorous_days, 'Vigorous activity days', { min: 0, max: 7 }),
    vigorous_minutes: requireInteger(input?.vigorous_minutes, 'Vigorous activity minutes', { min: 0, max: 1440 }),
    moderate_days: requireInteger(input?.moderate_days, 'Moderate activity days', { min: 0, max: 7 }),
    moderate_minutes: requireInteger(input?.moderate_minutes, 'Moderate activity minutes', { min: 0, max: 1440 }),
    walking_days: requireInteger(input?.walking_days, 'Walking days', { min: 0, max: 7 }),
    walking_minutes: requireInteger(input?.walking_minutes, 'Walking minutes', { min: 0, max: 1440 }),
    sitting_minutes: requireInteger(input?.sitting_minutes, 'Weekday sitting minutes', { min: 0, max: 1440 }),
  };
  const reportedActivityMinutes = reported.vigorous_minutes + reported.moderate_minutes + reported.walking_minutes;
  if (reportedActivityMinutes > 960) {
    throw new Error('Combined vigorous, moderate and walking time exceeds the IPAQ 960-minute daily outlier limit');
  }
  const vigorous = cleanIpaqActivity(reported.vigorous_days, reported.vigorous_minutes);
  const moderate = cleanIpaqActivity(reported.moderate_days, reported.moderate_minutes);
  const walking = cleanIpaqActivity(reported.walking_days, reported.walking_minutes);
  const vigorousMetMins = round(8 * vigorous.days * vigorous.minutes, 1);
  const moderateMetMins = round(4 * moderate.days * moderate.minutes, 1);
  const walkingMetMins = round(3.3 * walking.days * walking.minutes, 1);
  const totalMetMins = round(vigorousMetMins + moderateMetMins + walkingMetMins, 1);
  const combinedDays = Math.min(vigorous.days + moderate.days + walking.days, 7);
  const moderateOrWalkingDays = Math.min(
    (moderate.minutes >= 30 ? moderate.days : 0) + (walking.minutes >= 30 ? walking.days : 0),
    7,
  );
  const high = (vigorous.days >= 3 && totalMetMins >= 1500)
    || (combinedDays >= 7 && totalMetMins >= 3000);
  const moderateCategory = (vigorous.days >= 3 && vigorous.minutes >= 20)
    || moderateOrWalkingDays >= 5
    || (combinedDays >= 5 && totalMetMins >= 600);
  const activityCategory = high
    ? 'High Physical Activity'
    : moderateCategory
      ? 'Moderate Physical Activity'
      : 'Low Physical Activity';

  return {
    reported,
    processed_activity: { vigorous, moderate, walking, combined_days: combinedDays },
    vigorous_met_mins: vigorousMetMins,
    moderate_met_mins: moderateMetMins,
    walking_met_mins: walkingMetMins,
    total_met_mins: totalMetMins,
    sitting_minutes: reported.sitting_minutes,
    activity_category: activityCategory,
  };
}

export function buildIpaqShortFormFixture() {
  return {
    vigorous_days: 3,
    vigorous_minutes: 60,
    moderate_days: 2,
    moderate_minutes: 30,
    walking_days: 2,
    walking_minutes: 30,
    sitting_minutes: 420,
    notes: 'Deterministic IPAQ-SF fixture.',
  };
}

export function validateAndScoreIpaqShortForm(input, context = {}) {
  const score = computeIpaqShortFormScore(input);
  const notes = boundedText(input?.notes, 'Clinical notes', 4000);
  const rawInput = { ...score.reported, notes };
  const soapText = [
    '• International Physical Activity Questionnaire – Short Form (IPAQ-SF)',
    `  Total: ${score.total_met_mins.toFixed(1)} MET-minutes/week — ${score.activity_category}`,
    `  Vigorous: ${score.vigorous_met_mins.toFixed(1)}; moderate: ${score.moderate_met_mins.toFixed(1)}; walking: ${score.walking_met_mins.toFixed(1)} MET-minutes/week`,
    `  Weekday sitting: ${score.sitting_minutes} minutes/day`,
    notes ? `  Clinical notes: ${notes}` : null,
  ].filter(Boolean).join('\n');

  return buildCompletedPayload({
    context: completedContext(context, 'International Physical Activity Questionnaire – Short Form (IPAQ-SF)', notes),
    resultValue: score.total_met_mins,
    measurementType: 'ipaq_short_form',
    scoringKey: IPAQ_SHORT_FORM_RUNNER_SPEC.scoringKey,
    scoringVersion: IPAQ_SHORT_FORM_RUNNER_SPEC.scoring.version,
    rawInput,
    soapText,
    additionalData: {
      ...score.reported,
      processed_activity: score.processed_activity,
      vigorous_met_mins: score.vigorous_met_mins,
      moderate_met_mins: score.moderate_met_mins,
      walking_met_mins: score.walking_met_mins,
      total_met_mins: score.total_met_mins,
      activity_category: score.activity_category,
      report_text: `IPAQ-SF: ${score.total_met_mins.toFixed(1)} MET-minutes/week — ${score.activity_category}.`,
    },
  });
}

const EFS_ITEM_DEFINITIONS = Object.freeze([
  Object.freeze({ key: 'cognition_clock', domain: 'Cognition', prompt: 'Please imagine that this pre-drawn circle is a clock. Place the numbers in the correct positions, then place the hands to indicate ten after eleven.', type: 'single_choice', required: true, options: choiceOptions([['No errors', 0], ['Minor spacing errors', 1], ['Other errors', 2]]) }),
  Object.freeze({ key: 'hospital_admissions', domain: 'General Health Status', prompt: 'In the past year, how many times have you been admitted to a hospital?', type: 'single_choice', required: true, options: choiceOptions([['0', 0], ['1–2', 1], ['More than 2', 2]]) }),
  Object.freeze({ key: 'self_rated_health', domain: 'General Health Status', prompt: 'In general, how would you describe your health?', type: 'single_choice', required: true, options: choiceOptions([['Excellent, very good or good', 0], ['Fair', 1], ['Poor', 2]]) }),
  Object.freeze({ key: 'functional_independence', domain: 'Functional Independence', prompt: 'With how many of these activities do you require help: meal preparation, shopping, transportation, telephone, housekeeping, laundry, managing money, taking medications?', type: 'single_choice', required: true, options: choiceOptions([['0–1 activities', 0], ['2–4 activities', 1], ['5–8 activities', 2]]) }),
  Object.freeze({ key: 'social_support', domain: 'Social Support', prompt: 'When you need help, can you count on someone who is willing and able to meet your needs?', type: 'single_choice', required: true, options: choiceOptions([['Always', 0], ['Sometimes', 1], ['Never', 2]]) }),
  Object.freeze({ key: 'polypharmacy', domain: 'Medication Use', prompt: 'Do you use five or more different prescription medications on a regular basis?', type: 'yes_no', required: true, options: choiceOptions([['No', 0], ['Yes', 1]]) }),
  Object.freeze({ key: 'medication_forgetting', domain: 'Medication Use', prompt: 'At times, do you forget to take your prescription medications?', type: 'yes_no', required: true, options: choiceOptions([['No', 0], ['Yes', 1]]) }),
  Object.freeze({ key: 'nutrition_weight_loss', domain: 'Nutrition', prompt: 'Have you recently lost weight such that your clothing has become looser?', type: 'yes_no', required: true, options: choiceOptions([['No', 0], ['Yes', 1]]) }),
  Object.freeze({ key: 'mood', domain: 'Mood', prompt: 'Do you often feel sad or depressed?', type: 'yes_no', required: true, options: choiceOptions([['No', 0], ['Yes', 1]]) }),
  Object.freeze({ key: 'continence', domain: 'Continence', prompt: "Do you have a problem with losing control of urine when you don't want to?", type: 'yes_no', required: true, options: choiceOptions([['No', 0], ['Yes', 1]]) }),
  Object.freeze({ key: 'timed_up_and_go', domain: 'Functional Performance', prompt: 'From sitting with back and arms resting, stand on GO, walk safely to a mark about three metres away, return to the chair and sit down.', type: 'single_choice', required: true, options: choiceOptions([['0–10 seconds', 0], ['11–20 seconds', 1], ['More than 20 seconds, unwilling, or requires assistance', 2]]) }),
]);

export const EFS_ITEMS = Object.freeze(EFS_ITEM_DEFINITIONS.map((item) => Object.freeze({
  ...item,
  responseBinding: Object.freeze({ field: 'responses', key: item.key }),
})));

export const EFS_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'questionnaire',
  runnerKey: 'efs',
  scoringKey: 'edmonton-frail-scale',
  items: EFS_ITEMS,
  fields: Object.freeze([
    ...EFS_ITEMS.map((item) => Object.freeze({ ...item, label: item.prompt })),
    Object.freeze({ key: 'notes', label: 'Clinical notes', type: 'textarea', required: false }),
  ]),
  scoring: Object.freeze({
    method: 'sum-eleven-item-values',
    range: Object.freeze([0, 17]),
    direction: 'lower_better',
    version: 'edmonton-frail-scale-11-item-v1',
  }),
  result: Object.freeze({
    primaryField: 'total_score',
    unit: 'points',
    additionalDataFields: Object.freeze(['responses', 'domain_scores', 'frailty_category', 'soap_text']),
  }),
  provenance: Object.freeze({
    sourceCitation: 'Rolfson DB et al. Validity and reliability of the Edmonton Frail Scale. Age and Ageing. 2006;35(5):526–529.',
  }),
});

export function getEfsInterpretation(score) {
  if (score <= 4) return 'Not Frail';
  if (score <= 6) return 'Apparently Vulnerable';
  if (score <= 8) return 'Mildly Frail';
  if (score <= 10) return 'Moderately Frail';
  return 'Severely Frail';
}

export function buildEfsFixture() {
  return {
    responses: Object.fromEntries(EFS_ITEMS.map((item, index) => [
      item.key,
      index % item.options.length === 0 ? item.options.at(-1).value : item.options[0].value,
    ])),
    notes: 'Deterministic complete 11-item EFS fixture.',
  };
}

export function validateAndScoreEfs(input, context = {}) {
  const suppliedResponses = input?.responses && typeof input.responses === 'object'
    ? input.responses
    : input || {};
  const responses = {};
  const domainScores = {};
  for (const item of EFS_ITEMS) {
    const rawValue = suppliedResponses[item.key];
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      throw new Error(`${item.domain}: ${item.key} is required`);
    }
    const numericValue = requireFiniteNumber(rawValue, `${item.domain}: ${item.key}`);
    const value = requireChoice(numericValue, `${item.domain}: ${item.key}`, item.options.map((option) => option.value));
    responses[item.key] = value;
    domainScores[item.domain] = (domainScores[item.domain] || 0) + value;
  }
  const notes = boundedText(input?.notes, 'Clinical notes', 4000);
  const totalScore = Object.values(responses).reduce((sum, value) => sum + value, 0);
  const frailtyCategory = getEfsInterpretation(totalScore);
  const rawInput = { responses, notes };
  const soapText = [
    '• Edmonton Frail Scale (EFS)',
    `  Total score: ${totalScore}/17 — ${frailtyCategory}`,
    ...Object.entries(domainScores).map(([domain, score]) => `  ${domain}: ${score}`),
    notes ? `  Clinical notes: ${notes}` : null,
  ].filter(Boolean).join('\n');

  return buildCompletedPayload({
    context: completedContext(context, 'Edmonton Frail Scale (EFS)', notes),
    resultValue: totalScore,
    measurementType: 'edmonton_frail_scale',
    scoringKey: EFS_RUNNER_SPEC.scoringKey,
    scoringVersion: EFS_RUNNER_SPEC.scoring.version,
    rawInput,
    soapText,
    additionalData: {
      responses,
      domain_scores: domainScores,
      total_score: totalScore,
      frailty_category: frailtyCategory,
      report_text: `Edmonton Frail Scale (EFS): ${totalScore}/17 — ${frailtyCategory}.`,
    },
  });
}

export const MAINTAINED_PHYSIO_ADDITION_SCORERS = Object.freeze([
  Object.freeze({ runnerSpec: BESS_RUNNER_SPEC, buildFixture: buildBessFixture, validateAndScore: validateAndScoreBess }),
  Object.freeze({ runnerSpec: BOD_POD_RUNNER_SPEC, buildFixture: buildBodPodFixture, validateAndScore: validateAndScoreBodPod }),
  Object.freeze({ runnerSpec: EDSS_RUNNER_SPEC, buildFixture: buildEdssFixture, validateAndScore: validateAndScoreEdss }),
  Object.freeze({ runnerSpec: IPAQ_SHORT_FORM_RUNNER_SPEC, buildFixture: buildIpaqShortFormFixture, validateAndScore: validateAndScoreIpaqShortForm }),
  Object.freeze({ runnerSpec: EFS_RUNNER_SPEC, buildFixture: buildEfsFixture, validateAndScore: validateAndScoreEfs }),
]);
