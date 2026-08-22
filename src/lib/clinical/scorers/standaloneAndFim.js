import {
  buildCompletedPayload,
  requireChoice,
  requireFiniteNumber,
  requireInteger,
} from './contract.js';

function boundedText(value, field, maxLength = 4000) {
  const text = String(value ?? '').trim();
  if (text.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or fewer`);
  return text;
}

function optionalFiniteNumber(value, field, limits) {
  if (value === '' || value === null || value === undefined) return null;
  return requireFiniteNumber(value, field, limits);
}

function completedContext(context, assessmentName, notes) {
  return { ...context, assessmentName: context.assessmentName || assessmentName, notes };
}

function round(value, places = 3) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function choiceOptions(entries) {
  return Object.freeze(entries.map(([label, value]) => Object.freeze({ label, value })));
}

function normalizeTimedTrials(input, expectedCount, distanceMetres, label) {
  const supplied = Array.isArray(input?.trials) ? input.trials : [];
  if (supplied.length !== expectedCount) {
    throw new Error(`${label} requires exactly ${expectedCount} completed trials`);
  }
  return supplied.map((trial, index) => {
    const timeSeconds = requireFiniteNumber(
      trial?.time_s ?? trial?.time_seconds ?? trial,
      `${label} trial ${index + 1} time`,
      { min: 0.01, max: 3600 },
    );
    return Object.freeze({
      time_s: round(timeSeconds, 2),
      ...(distanceMetres ? { speed_ms: round(distanceMetres / timeSeconds, 3) } : {}),
    });
  });
}

function optionalVital(value, field, limits) {
  return optionalFiniteNumber(value, field, limits);
}

function normalizeVitals(input, prefix) {
  const supplied = input && typeof input === 'object' ? input : {};
  return Object.freeze({
    heart_rate: optionalVital(
      supplied.heart_rate ?? supplied.hr,
      `${prefix} heart rate`,
      { min: 0, max: 300 },
    ),
    blood_pressure: boundedText(
      supplied.blood_pressure ?? supplied.bp,
      `${prefix} blood pressure`,
      40,
    ),
    spo2: optionalVital(
      supplied.spo2 ?? supplied.spO2,
      `${prefix} SpO2`,
      { min: 0, max: 100 },
    ),
  });
}

const NOTES_FIELD = Object.freeze({
  key: 'notes',
  label: 'Clinical notes',
  type: 'textarea',
  required: false,
});

export const EIGHT_FOOT_UP_GO_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'measurement',
  runnerKey: '8-foot-up-go',
  scoringKey: '8-foot-up-go',
  fields: Object.freeze([
    Object.freeze({
      key: 'trials',
      label: 'Completed timed trials',
      type: 'object[]',
      required: true,
      minItems: 2,
      maxItems: 2,
      items: Object.freeze([
        Object.freeze({ key: 'time_s', label: 'Trial time', type: 'number', required: true, min: 0.01, max: 3600, step: 0.01, unit: 'seconds' }),
      ]),
    }),
    Object.freeze({ key: 'chair_height', label: 'Chair height', type: 'select', required: true, options: choiceOptions([['Standard (43–45 cm)', 'standard'], ['Higher than standard', 'high'], ['Lower than standard', 'low']]) }),
    Object.freeze({ key: 'assistance_used', label: 'Assistance used', type: 'select', required: true, options: choiceOptions([['None', 'none'], ['Arm rest', 'arm_rest'], ['Hand-held assistance', 'hand_held']]) }),
    Object.freeze({ key: 'footwear', label: 'Footwear', type: 'text', required: false }),
    NOTES_FIELD,
  ]),
  protocol: Object.freeze({
    courseDistanceMetres: 2.44,
    requiredTrials: 2,
    resultRule: 'best-faster-trial',
  }),
  scoring: Object.freeze({
    method: 'minimum-of-two-completed-trial-times',
    direction: 'lower_better',
    version: '8-foot-up-go-two-trial-v1',
  }),
  result: Object.freeze({
    primaryField: 'best_time_s',
    unit: 'seconds',
    additionalDataFields: Object.freeze([
      'trials',
      'best_time_s',
      'average_time_s',
      'chair_height',
      'assistance_used',
      'footwear',
      'interpretation',
      'soap_text',
    ]),
  }),
});

export function interpretEightFootUpGo() {
  return 'Compare the best time with age- and gender-matched Senior Fitness Test reference data.';
}

export function buildEightFootUpGoFixture() {
  return {
    trials: [{ time_s: 7.8 }, { time_s: 7.4 }],
    chair_height: 'standard',
    assistance_used: 'none',
    footwear: 'Supportive walking shoes',
    notes: 'Deterministic two-trial fixture.',
  };
}

export function validateAndScoreEightFootUpGo(input, context = {}) {
  const trials = normalizeTimedTrials(input, 2, null, '8-Foot Up-and-Go Test');
  const chairHeight = requireChoice(input?.chair_height, 'Chair height', ['standard', 'high', 'low']);
  const assistanceUsed = requireChoice(input?.assistance_used, 'Assistance used', ['none', 'arm_rest', 'hand_held']);
  const footwear = boundedText(input?.footwear, 'Footwear', 500);
  const notes = boundedText(input?.notes, 'Clinical notes');
  const bestTime = Math.min(...trials.map(({ time_s: time }) => time));
  const averageTime = round(trials.reduce((sum, { time_s: time }) => sum + time, 0) / trials.length, 2);
  const interpretation = interpretEightFootUpGo();
  const rawInput = {
    trials,
    chair_height: chairHeight,
    assistance_used: assistanceUsed,
    footwear,
    notes,
  };
  const soapText = [
    '• 8-Foot Up-and-Go Test',
    `  Trials: ${trials.map(({ time_s: time }, index) => `${index + 1}: ${time.toFixed(2)} s`).join('; ')}`,
    `  Best time: ${bestTime.toFixed(2)} s`,
    `  Average time: ${averageTime.toFixed(2)} s`,
    `  Chair height: ${chairHeight}`,
    `  Assistance: ${assistanceUsed}`,
    footwear ? `  Footwear: ${footwear}` : null,
    `  Interpretation: ${interpretation}`,
    notes ? `  Clinical notes: ${notes}` : null,
  ].filter(Boolean).join('\n');

  return buildCompletedPayload({
    context: completedContext(context, '8-Foot Up-and-Go Test', notes),
    resultValue: bestTime,
    measurementType: '8_foot_up_and_go',
    scoringKey: EIGHT_FOOT_UP_GO_RUNNER_SPEC.scoringKey,
    scoringVersion: EIGHT_FOOT_UP_GO_RUNNER_SPEC.scoring.version,
    rawInput,
    soapText,
    additionalData: {
      trials,
      best_time_s: bestTime,
      average_time_s: averageTime,
      chair_height: chairHeight,
      assistance_used: assistanceUsed,
      footwear,
      interpretation,
      report_text: `8-Foot Up-and-Go Test: best of two trials ${bestTime.toFixed(2)} seconds.`,
    },
  });
}

export const SIX_METRE_WALK_TIMED_DISTANCE_M = 4;

export const SIX_METRE_WALK_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'measurement',
  runnerKey: '6-meter-walk',
  scoringKey: '6-meter-walk',
  fields: Object.freeze([
    Object.freeze({
      key: 'trials',
      label: 'Completed middle-4-metre trials',
      type: 'object[]',
      required: true,
      minItems: 3,
      maxItems: 3,
      items: Object.freeze([
        Object.freeze({ key: 'time_s', label: 'Trial time', type: 'number', required: true, min: 0.01, max: 3600, step: 0.01, unit: 'seconds' }),
        Object.freeze({ key: 'speed_ms', label: 'Calculated gait speed', type: 'number', required: false, min: 0.001, max: 20, step: 0.001, unit: 'm/s' }),
      ]),
    }),
    Object.freeze({ key: 'test_condition', label: 'Test condition', type: 'select', required: true, options: choiceOptions([['Self-selected pace', 'self_selected'], ['Fast but safe pace', 'fast']]) }),
    Object.freeze({ key: 'gait_aids', label: 'Gait aid', type: 'text', required: false }),
    Object.freeze({ key: 'footwear', label: 'Footwear', type: 'text', required: false }),
    NOTES_FIELD,
  ]),
  protocol: Object.freeze({
    courseLengthMetres: 6,
    timedDistanceMetres: SIX_METRE_WALK_TIMED_DISTANCE_M,
    accelerationZoneMetres: 1,
    decelerationZoneMetres: 1,
    requiredTrials: 3,
    resultRule: 'highest-speed-trial',
  }),
  scoring: Object.freeze({
    method: 'timed-distance-metres-divided-by-seconds-best-of-three',
    timedDistanceMetres: SIX_METRE_WALK_TIMED_DISTANCE_M,
    direction: 'higher_better',
    version: '6-metre-walk-middle-4m-three-trial-v1',
  }),
  result: Object.freeze({
    primaryField: 'best_speed_ms',
    unit: 'm/s',
    additionalDataFields: Object.freeze([
      'trials',
      'best_speed_ms',
      'best_time_s',
      'average_speed_ms',
      'test_condition',
      'gait_aids',
      'footwear',
      'interpretation',
      'soap_text',
    ]),
  }),
});

export function interpretSixMetreWalk(speed) {
  if (speed > 1) return 'Above 1.0 m/s source reference point for older adults';
  if (speed < 0.8) return 'Below 0.8 m/s source mobility-impairment reference point';
  return 'Between the source reference points of 0.8 and 1.0 m/s';
}

export function buildSixMetreWalkFixture() {
  return {
    trials: [{ time_s: 4.2 }, { time_s: 4 }, { time_s: 3.8 }],
    test_condition: 'self_selected',
    gait_aids: '',
    footwear: 'Supportive walking shoes',
    notes: 'Deterministic three-trial fixture.',
  };
}

export function validateAndScoreSixMetreWalk(input, context = {}) {
  const trials = normalizeTimedTrials(
    input,
    3,
    SIX_METRE_WALK_TIMED_DISTANCE_M,
    '6-Metre Walk Test',
  );
  const testCondition = requireChoice(input?.test_condition, 'Test condition', ['self_selected', 'fast']);
  const gaitAids = boundedText(input?.gait_aids, 'Gait aids', 500);
  const footwear = boundedText(input?.footwear, 'Footwear', 500);
  const notes = boundedText(input?.notes, 'Clinical notes');
  const bestTrial = trials.reduce((best, trial) => (trial.speed_ms > best.speed_ms ? trial : best));
  const averageSpeed = round(
    trials.reduce((sum, { speed_ms: speed }) => sum + speed, 0) / trials.length,
    3,
  );
  const interpretation = interpretSixMetreWalk(bestTrial.speed_ms);
  const rawInput = {
    trials,
    test_condition: testCondition,
    gait_aids: gaitAids,
    footwear,
    notes,
  };
  const soapText = [
    '• 6-Metre Walk Test',
    `  Timed distance: middle ${SIX_METRE_WALK_TIMED_DISTANCE_M} metres of a 6-metre course`,
    `  Trials: ${trials.map(({ time_s: time, speed_ms: speed }, index) => `${index + 1}: ${time.toFixed(2)} s (${speed.toFixed(3)} m/s)`).join('; ')}`,
    `  Best speed: ${bestTrial.speed_ms.toFixed(3)} m/s (${bestTrial.time_s.toFixed(2)} s)`,
    `  Average speed: ${averageSpeed.toFixed(3)} m/s`,
    `  Condition: ${testCondition === 'self_selected' ? 'Self-selected pace' : 'Fast but safe pace'}`,
    `  Interpretation: ${interpretation}`,
    gaitAids ? `  Gait aid: ${gaitAids}` : null,
    footwear ? `  Footwear: ${footwear}` : null,
    notes ? `  Clinical notes: ${notes}` : null,
  ].filter(Boolean).join('\n');

  return buildCompletedPayload({
    context: completedContext(context, '6-Metre Walk Test', notes),
    resultValue: bestTrial.speed_ms,
    measurementType: '6_meter_walk_test',
    scoringKey: SIX_METRE_WALK_RUNNER_SPEC.scoringKey,
    scoringVersion: SIX_METRE_WALK_RUNNER_SPEC.scoring.version,
    rawInput,
    soapText,
    additionalData: {
      timed_distance_m: SIX_METRE_WALK_TIMED_DISTANCE_M,
      trials,
      best_speed_ms: bestTrial.speed_ms,
      best_time_s: bestTrial.time_s,
      average_speed_ms: averageSpeed,
      test_condition: testCondition,
      gait_aids: gaitAids,
      footwear,
      interpretation,
      report_text: `6-Metre Walk Test: best middle-4-metre gait speed ${bestTrial.speed_ms.toFixed(3)} m/s.`,
    },
  });
}

export const FOUR_HUNDRED_METRE_WALK_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'measurement',
  runnerKey: '400-meter-walk',
  scoringKey: '400-meter-walk',
  fields: Object.freeze([
    Object.freeze({ key: 'total_time_seconds', label: 'Total elapsed time', type: 'number', required: true, min: 0.1, max: 86400, step: 0.1, unit: 'seconds' }),
    Object.freeze({ key: 'distance_covered_m', label: 'Distance covered', type: 'number', required: true, min: 0, max: 400, step: 1, unit: 'metres' }),
    Object.freeze({ key: 'completed', label: 'Completed 400 metres', type: 'select', required: true, options: choiceOptions([['Yes', true], ['No — stopped early', false]]) }),
    Object.freeze({
      key: 'laps',
      label: '40-metre lap splits',
      type: 'repeatable_lap',
      required: false,
      minItems: 0,
      maxItems: 10,
      items: Object.freeze([
        Object.freeze({ key: 'lap', label: 'Lap number', type: 'integer', required: true, min: 1, max: 10, step: 1 }),
        Object.freeze({ key: 'cumulative', label: 'Cumulative elapsed time', type: 'number', required: true, min: 0.01, max: 86400, step: 0.1, unit: 'seconds' }),
        Object.freeze({ key: 'split', label: 'Lap split time', type: 'number', required: true, min: 0.01, max: 86400, step: 0.1, unit: 'seconds' }),
      ]),
    }),
    Object.freeze({
      key: 'rest_breaks',
      label: 'Rest breaks',
      type: 'repeatable_rest',
      required: false,
      minItems: 0,
      unbounded: true,
      items: Object.freeze([
        Object.freeze({ key: 'at_time', label: 'Elapsed time at rest break', type: 'number', required: true, min: 0, max: 86400, step: 0.1, unit: 'seconds' }),
        Object.freeze({ key: 'at_metres', label: 'Distance covered at rest break', type: 'number', required: true, min: 0, max: 400, step: 1, unit: 'metres' }),
      ]),
    }),
    Object.freeze({ key: 'early_stop_reason', label: 'Reason for stopping early', type: 'textarea', required: false }),
    Object.freeze({
      key: 'pre_test',
      label: 'Pre-test observations',
      type: 'object',
      required: false,
      fields: Object.freeze([
        Object.freeze({ key: 'heart_rate', label: 'Heart rate', type: 'number', required: false, min: 0, max: 300, unit: 'bpm' }),
        Object.freeze({ key: 'blood_pressure', label: 'Blood pressure', type: 'text', required: false }),
        Object.freeze({ key: 'spo2', label: 'SpO2', type: 'number', required: false, min: 0, max: 100, unit: '%' }),
      ]),
    }),
    Object.freeze({
      key: 'post_test',
      label: 'Post-test observations',
      type: 'object',
      required: false,
      fields: Object.freeze([
        Object.freeze({ key: 'heart_rate', label: 'Heart rate', type: 'number', required: false, min: 0, max: 300, unit: 'bpm' }),
        Object.freeze({ key: 'blood_pressure', label: 'Blood pressure', type: 'text', required: false }),
        Object.freeze({ key: 'spo2', label: 'SpO2', type: 'number', required: false, min: 0, max: 100, unit: '%' }),
      ]),
    }),
    Object.freeze({ key: 'gait_observations', label: 'Gait observations', type: 'textarea', required: false }),
    Object.freeze({ key: 'symptoms_observed', label: 'Symptoms observed or reported', type: 'textarea', required: false }),
    NOTES_FIELD,
  ]),
  protocol: Object.freeze({ lapDistanceMetres: 40, totalLaps: 10, totalDistanceMetres: 400 }),
  scoring: Object.freeze({
    method: 'elapsed-seconds-with-completion-and-distance-status',
    sourceMobilityLimitationReferenceSeconds: 420,
    direction: 'lower_better_when_completed',
    version: '400-metre-walk-v1',
  }),
  result: Object.freeze({
    primaryField: 'total_time_seconds',
    unit: 'seconds',
    additionalDataFields: Object.freeze([
      'distance_covered_m',
      'completed',
      'laps',
      'rest_breaks',
      'pre_test',
      'post_test',
      'gait_observations',
      'symptoms_observed',
      'interpretation',
      'soap_text',
    ]),
  }),
});

function normalizeLaps(value) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) throw new Error('Lap splits must contain at most 10 laps');
  let previousCumulative = 0;
  return value.map((lap, index) => {
    const lapNumber = requireInteger(lap?.lap ?? index + 1, `Lap ${index + 1} number`, { min: 1, max: 10 });
    if (lapNumber !== index + 1) throw new Error(`Lap ${index + 1} is out of sequence`);
    const cumulative = requireFiniteNumber(lap?.cumulative, `Lap ${lapNumber} cumulative time`, { min: 0.01, max: 86400 });
    const split = requireFiniteNumber(lap?.split, `Lap ${lapNumber} split time`, { min: 0.01, max: 86400 });
    if (cumulative <= previousCumulative) throw new Error(`Lap ${lapNumber} cumulative time must increase`);
    previousCumulative = cumulative;
    return Object.freeze({ lap: lapNumber, cumulative: round(cumulative, 1), split: round(split, 1) });
  });
}

function normalizeRestBreaks(value) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('Rest breaks must be an array');
  return value.map((rest, index) => Object.freeze({
    at_time: round(requireFiniteNumber(rest?.at_time, `Rest break ${index + 1} time`, { min: 0, max: 86400 }), 1),
    at_metres: requireFiniteNumber(rest?.at_metres, `Rest break ${index + 1} distance`, { min: 0, max: 400 }),
  }));
}

export function interpretFourHundredMetreWalk(totalTimeSeconds, completed) {
  if (!completed) return '400 metres not completed';
  return totalTimeSeconds > 420
    ? 'Above the source 7-minute mobility-limitation reference point'
    : 'At or below the source 7-minute mobility-limitation reference point';
}

export function buildFourHundredMetreWalkFixture() {
  return {
    total_time_seconds: 318.4,
    distance_covered_m: 400,
    completed: true,
    laps: [],
    rest_breaks: [],
    pre_test: { heart_rate: 72, blood_pressure: '120/80', spo2: 98 },
    post_test: { heart_rate: 108, blood_pressure: '136/84', spo2: 97 },
    gait_observations: 'Steady gait throughout.',
    symptoms_observed: 'None reported.',
    early_stop_reason: '',
    notes: 'Deterministic completed-distance fixture.',
  };
}

export function validateAndScoreFourHundredMetreWalk(input, context = {}) {
  const totalTimeSeconds = round(requireFiniteNumber(input?.total_time_seconds, 'Total time', { min: 0.1, max: 86400 }), 1);
  if (typeof input?.completed !== 'boolean') throw new Error('Completed status must be true or false');
  const completed = input.completed;
  const distanceCovered = requireFiniteNumber(input?.distance_covered_m, 'Distance covered', { min: 0, max: 400 });
  if (completed && distanceCovered !== 400) throw new Error('A completed 400-Metre Walk Test must record 400 metres');
  if (!completed && distanceCovered >= 400) throw new Error('A stopped-early 400-Metre Walk Test must record less than 400 metres');
  const earlyStopReason = boundedText(input?.early_stop_reason, 'Early stop reason', 2000);
  if (!completed && !earlyStopReason) throw new Error('Early stop reason is required when 400 metres is not completed');
  const laps = normalizeLaps(input?.laps);
  if (completed && laps.length > 0 && laps.length !== 10) throw new Error('A completed timed run must contain all 10 lap splits');
  const restBreaks = normalizeRestBreaks(input?.rest_breaks);
  const preTest = normalizeVitals(input?.pre_test, 'Pre-test');
  const postTest = normalizeVitals(input?.post_test, 'Post-test');
  const gaitObservations = boundedText(input?.gait_observations, 'Gait observations');
  const symptomsObserved = boundedText(input?.symptoms_observed, 'Symptoms observed');
  const notes = boundedText(input?.notes, 'Clinical notes');
  const interpretation = interpretFourHundredMetreWalk(totalTimeSeconds, completed);
  const rawInput = {
    total_time_seconds: totalTimeSeconds,
    distance_covered_m: distanceCovered,
    completed,
    laps,
    rest_breaks: restBreaks,
    early_stop_reason: earlyStopReason,
    pre_test: preTest,
    post_test: postTest,
    gait_observations: gaitObservations,
    symptoms_observed: symptomsObserved,
    notes,
  };
  const soapText = [
    '• 400-Metre Walk Test',
    `  Elapsed time: ${totalTimeSeconds.toFixed(1)} s`,
    `  Distance covered: ${distanceCovered} m`,
    `  Completed: ${completed ? 'Yes' : 'No'}`,
    `  Rest breaks: ${restBreaks.length}`,
    `  Interpretation: ${interpretation}`,
    earlyStopReason ? `  Early stop reason: ${earlyStopReason}` : null,
    gaitObservations ? `  Gait observations: ${gaitObservations}` : null,
    symptomsObserved ? `  Symptoms: ${symptomsObserved}` : null,
    notes ? `  Clinical notes: ${notes}` : null,
  ].filter(Boolean).join('\n');

  return buildCompletedPayload({
    context: completedContext(context, '400-Metre Walk Test', notes),
    resultValue: totalTimeSeconds,
    measurementType: '400_meter_walk_test',
    scoringKey: FOUR_HUNDRED_METRE_WALK_RUNNER_SPEC.scoringKey,
    scoringVersion: FOUR_HUNDRED_METRE_WALK_RUNNER_SPEC.scoring.version,
    rawInput,
    soapText,
    additionalData: {
      total_time_seconds: totalTimeSeconds,
      distance_covered_m: distanceCovered,
      completed,
      laps,
      rest_breaks: restBreaks,
      number_of_rests: restBreaks.length,
      stopped_early: !completed,
      early_stop_reason: earlyStopReason,
      pre_test: preTest,
      post_test: postTest,
      gait_observations: gaitObservations,
      symptoms_observed: symptomsObserved,
      interpretation,
      report_text: `400-Metre Walk Test: ${distanceCovered} metres in ${totalTimeSeconds.toFixed(1)} seconds; ${completed ? 'completed' : 'stopped early'}.`,
    },
  });
}

export const SIX_MINUTE_STEP_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'measurement',
  runnerKey: '6-minute-step',
  scoringKey: '6-minute-step',
  fields: Object.freeze([
    Object.freeze({ key: 'step_count', label: 'Total completed step cycles', type: 'number', required: true, min: 0, max: 5000, step: 1, unit: 'steps' }),
    Object.freeze({ key: 'step_height_cm', label: 'Step height', type: 'number', required: true, min: 1, max: 100, step: 0.1, unit: 'cm' }),
    Object.freeze({ key: 'elapsed_seconds', label: 'Elapsed test time', type: 'number', required: true, min: 1, max: 360, step: 1, unit: 'seconds' }),
    Object.freeze({ key: 'age', label: 'Age', type: 'number', required: true, min: 0, max: 130, step: 1, unit: 'years' }),
    Object.freeze({ key: 'gender', label: 'Gender used for reference comparison', type: 'select', required: true, options: choiceOptions([['Male', 'male'], ['Female', 'female']]) }),
    Object.freeze({
      key: 'pre_test',
      label: 'Pre-test observations',
      type: 'object',
      required: false,
      fields: Object.freeze([
        Object.freeze({ key: 'heart_rate', label: 'Heart rate', type: 'number', required: false, min: 0, max: 300, unit: 'bpm' }),
        Object.freeze({ key: 'blood_pressure', label: 'Blood pressure', type: 'text', required: false }),
        Object.freeze({ key: 'spo2', label: 'SpO2', type: 'number', required: false, min: 0, max: 100, unit: '%' }),
      ]),
    }),
    Object.freeze({
      key: 'post_test',
      label: 'Post-test observations',
      type: 'object',
      required: false,
      fields: Object.freeze([
        Object.freeze({ key: 'heart_rate', label: 'Heart rate', type: 'number', required: false, min: 0, max: 300, unit: 'bpm' }),
        Object.freeze({ key: 'blood_pressure', label: 'Blood pressure', type: 'text', required: false }),
        Object.freeze({ key: 'spo2', label: 'SpO2', type: 'number', required: false, min: 0, max: 100, unit: '%' }),
      ]),
    }),
    Object.freeze({ key: 'symptoms', label: 'Symptoms during test', type: 'textarea', required: false }),
    NOTES_FIELD,
  ]),
  protocol: Object.freeze({ targetDurationSeconds: 360, stepCycleDefinition: 'up-up-down-down' }),
  scoring: Object.freeze({
    method: 'completed-step-cycle-count-with-protocol-context',
    direction: 'higher_better_within_same_protocol',
    version: '6-minute-step-count-v1',
  }),
  result: Object.freeze({
    primaryField: 'step_count',
    unit: 'steps',
    additionalDataFields: Object.freeze([
      'step_height_cm',
      'elapsed_seconds',
      'test_completed',
      'age',
      'gender',
      'pre_test',
      'post_test',
      'symptoms',
      'interpretation',
      'soap_text',
    ]),
  }),
});

export function buildSixMinuteStepFixture() {
  return {
    step_count: 190,
    step_height_cm: 20,
    elapsed_seconds: 360,
    age: 35,
    gender: 'female',
    pre_test: { heart_rate: 72, blood_pressure: '120/80', spo2: 98 },
    post_test: { heart_rate: 124, blood_pressure: '142/86', spo2: 96 },
    symptoms: 'Expected exertion only.',
    notes: 'Deterministic full-duration fixture.',
  };
}

export function validateAndScoreSixMinuteStep(input, context = {}) {
  const stepCount = requireInteger(input?.step_count, 'Step count', { min: 0, max: 5000 });
  const stepHeightCm = requireFiniteNumber(input?.step_height_cm, 'Step height', { min: 1, max: 100 });
  const elapsedSeconds = requireInteger(input?.elapsed_seconds, 'Elapsed time', { min: 1, max: 360 });
  const age = requireInteger(input?.age, 'Age', { min: 0, max: 130 });
  const gender = requireChoice(input?.gender, 'Gender', ['male', 'female']);
  const preTest = normalizeVitals(input?.pre_test, 'Pre-test');
  const postTest = normalizeVitals(input?.post_test, 'Post-test');
  const symptoms = boundedText(input?.symptoms, 'Symptoms');
  const notes = boundedText(input?.notes, 'Clinical notes');
  const testCompleted = elapsedSeconds === 360;
  const interpretation = testCompleted
    ? 'Compare with reference data using the same step height, protocol, age and population.'
    : `Stopped at ${elapsedSeconds} seconds; do not compare directly with full 6-minute reference values.`;
  const rawInput = {
    step_count: stepCount,
    step_height_cm: stepHeightCm,
    elapsed_seconds: elapsedSeconds,
    age,
    gender,
    pre_test: preTest,
    post_test: postTest,
    symptoms,
    notes,
  };
  const soapText = [
    '• 6-Minute Step Test',
    `  Step cycles: ${stepCount}`,
    `  Step height: ${stepHeightCm} cm`,
    `  Elapsed time: ${elapsedSeconds} seconds (${testCompleted ? 'full protocol completed' : 'stopped early'})`,
    `  Reference context: age ${age}; ${gender}`,
    `  Interpretation: ${interpretation}`,
    symptoms ? `  Symptoms: ${symptoms}` : null,
    notes ? `  Clinical notes: ${notes}` : null,
  ].filter(Boolean).join('\n');

  return buildCompletedPayload({
    context: completedContext(context, '6-Minute Step Test', notes),
    resultValue: stepCount,
    measurementType: '6_minute_step_test',
    scoringKey: SIX_MINUTE_STEP_RUNNER_SPEC.scoringKey,
    scoringVersion: SIX_MINUTE_STEP_RUNNER_SPEC.scoring.version,
    rawInput,
    soapText,
    additionalData: {
      step_count: stepCount,
      step_height_cm: stepHeightCm,
      step_height: stepHeightCm,
      elapsed_seconds: elapsedSeconds,
      test_completed: testCompleted,
      age,
      gender,
      pre_test: preTest,
      post_test: postTest,
      symptoms,
      interpretation,
      report_text: `6-Minute Step Test: ${stepCount} step cycles in ${elapsedSeconds} seconds on a ${stepHeightCm} cm step.`,
    },
  });
}

export const FIM_SCORE_LEVELS = Object.freeze([
  Object.freeze({ value: 7, label: '7 – Complete Independence', description: 'Activity performed safely, without modification, equipment, or assistance, within reasonable time.' }),
  Object.freeze({ value: 6, label: '6 – Modified Independence', description: 'Requires an assistive device, takes more than reasonable time, or there are safety considerations.' }),
  Object.freeze({ value: 5, label: '5 – Supervision/Setup', description: 'Requires only standby supervision, cueing, or coaxing. No hands-on assistance. Helper sets up objects.' }),
  Object.freeze({ value: 4, label: '4 – Minimal Assistance', description: 'Helper provides hands-on assistance only (touching); person performs ≥75% of task effort.' }),
  Object.freeze({ value: 3, label: '3 – Moderate Assistance', description: 'Person performs 50–74% of task effort.' }),
  Object.freeze({ value: 2, label: '2 – Maximal Assistance', description: 'Person performs 25–49% of task effort.' }),
  Object.freeze({ value: 1, label: '1 – Total Assistance', description: 'Person performs <25% of task effort or activity cannot be done.' }),
]);

function fimItem(id, key, label, description, category, subscale) {
  return Object.freeze({
    id,
    key,
    label,
    prompt: `${label} — ${description}`,
    description,
    category,
    subscale,
    type: 'single_choice',
    required: true,
    options: FIM_SCORE_LEVELS,
  });
}

export const FIM_SECTIONS = Object.freeze([
  Object.freeze({
    category: 'Self-Care',
    subscale: 'motor',
    items: Object.freeze([
      fimItem(0, 'eating', 'Eating', 'Use of suitable utensils to bring food to mouth, chewing and swallowing.', 'Self-Care', 'motor'),
      fimItem(1, 'grooming', 'Grooming', 'Oral care, hair combing, washing hands/face, shaving or makeup.', 'Self-Care', 'motor'),
      fimItem(2, 'bathing', 'Bathing', 'Washing, rinsing, and drying the body from the neck down (excluding back).', 'Self-Care', 'motor'),
      fimItem(3, 'dressing_upper_body', 'Dressing – Upper Body', 'Dressing and undressing above the waist, including prostheses or orthoses.', 'Self-Care', 'motor'),
      fimItem(4, 'dressing_lower_body', 'Dressing – Lower Body', 'Dressing and undressing below the waist, including prostheses or orthoses.', 'Self-Care', 'motor'),
      fimItem(5, 'toileting', 'Toileting', 'Maintaining perineal hygiene and adjusting clothing before/after using toilet.', 'Self-Care', 'motor'),
    ]),
  }),
  Object.freeze({
    category: 'Sphincter Control',
    subscale: 'motor',
    items: Object.freeze([
      fimItem(6, 'bladder_management', 'Bladder Management', 'Level of assistance needed to manage bladder safely; frequency of accidents.', 'Sphincter Control', 'motor'),
      fimItem(7, 'bowel_management', 'Bowel Management', 'Level of assistance needed to manage bowel safely; frequency of accidents.', 'Sphincter Control', 'motor'),
    ]),
  }),
  Object.freeze({
    category: 'Transfers',
    subscale: 'motor',
    items: Object.freeze([
      fimItem(8, 'transfer_bed_chair_wheelchair', 'Transfer: Bed/Chair/Wheelchair', 'Transferring to/from bed, chair, and wheelchair.', 'Transfers', 'motor'),
      fimItem(9, 'transfer_toilet', 'Transfer: Toilet', 'Getting on and off a toilet or commode.', 'Transfers', 'motor'),
      fimItem(10, 'transfer_tub_shower', 'Transfer: Tub/Shower', 'Getting into and out of a bathtub or shower.', 'Transfers', 'motor'),
    ]),
  }),
  Object.freeze({
    category: 'Locomotion',
    subscale: 'motor',
    items: Object.freeze([
      fimItem(11, 'walk_wheelchair', 'Walk / Wheelchair', 'Walking on level surfaces, or propelling a wheelchair indoors for at least 50m.', 'Locomotion', 'motor'),
      fimItem(12, 'stairs', 'Stairs', 'Going up and down 12–14 stairs.', 'Locomotion', 'motor'),
    ]),
  }),
  Object.freeze({
    category: 'Communication',
    subscale: 'cognitive',
    items: Object.freeze([
      fimItem(13, 'comprehension', 'Comprehension', 'Understanding verbal or non-verbal communication.', 'Communication', 'cognitive'),
      fimItem(14, 'expression', 'Expression', 'Expressing verbal or non-verbal language; clear meaningful communication.', 'Communication', 'cognitive'),
    ]),
  }),
  Object.freeze({
    category: 'Social Cognition',
    subscale: 'cognitive',
    items: Object.freeze([
      fimItem(15, 'social_interaction', 'Social Interaction', 'Skills related to getting along and participating with others in therapeutic and social situations.', 'Social Cognition', 'cognitive'),
      fimItem(16, 'problem_solving', 'Problem Solving', 'Skills related to solving problems of daily living including safety and financial decisions.', 'Social Cognition', 'cognitive'),
      fimItem(17, 'memory', 'Memory', 'Skills related to recognising people frequently encountered, remembering daily routines, and executing requests without reminders.', 'Social Cognition', 'cognitive'),
    ]),
  }),
]);

export const FIM_ITEMS = Object.freeze(FIM_SECTIONS.flatMap(({ items }) => items));

export const FIM_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'questionnaire',
  runnerKey: 'fim',
  scoringKey: 'fim',
  items: Object.freeze(FIM_ITEMS.map((item) => Object.freeze({
    ...item,
    responseBinding: Object.freeze({ field: 'scores', key: item.key }),
  }))),
  fields: Object.freeze([
    ...FIM_ITEMS.map((item) => Object.freeze({ ...item, label: item.prompt })),
    NOTES_FIELD,
  ]),
  scoring: Object.freeze({
    method: 'sum-18-items-each-rated-1-to-7',
    range: Object.freeze([18, 126]),
    motorRange: Object.freeze([13, 91]),
    cognitiveRange: Object.freeze([5, 35]),
    direction: 'higher_greater_independence',
    version: 'fim-18-item-v1',
  }),
  result: Object.freeze({
    primaryField: 'total_score',
    unit: 'points',
    additionalDataFields: Object.freeze([
      'motor_score',
      'cognitive_score',
      'total_score',
      'responses',
      'sections',
      'soap_text',
    ]),
  }),
});

export function buildFimFixture() {
  return {
    scores: Object.fromEntries(FIM_ITEMS.map(({ key }, index) => [key, (index % 7) + 1])),
    notes: 'Deterministic complete 18-item FIM fixture.',
  };
}

export function validateAndScoreFim(input, context = {}) {
  const supplied = input?.scores ?? input?.responses ?? input;
  const responses = {};
  for (const item of FIM_ITEMS) {
    const rawValue = Array.isArray(supplied)
      ? supplied[item.id]
      : supplied?.[item.key] ?? supplied?.[item.id];
    const value = requireInteger(rawValue, item.label, { min: 1, max: 7 });
    responses[item.key] = requireChoice(value, item.label, FIM_SCORE_LEVELS.map(({ value: score }) => score));
  }
  const notes = boundedText(input?.notes, 'Clinical notes');
  const motorScore = FIM_ITEMS
    .filter(({ subscale }) => subscale === 'motor')
    .reduce((sum, { key }) => sum + responses[key], 0);
  const cognitiveScore = FIM_ITEMS
    .filter(({ subscale }) => subscale === 'cognitive')
    .reduce((sum, { key }) => sum + responses[key], 0);
  const totalScore = motorScore + cognitiveScore;
  const sections = FIM_SECTIONS.map((section) => ({
    category: section.category,
    subscale: section.subscale,
    items: section.items.map((item) => ({
      key: item.key,
      name: item.label,
      score: responses[item.key],
      level: FIM_SCORE_LEVELS.find(({ value }) => value === responses[item.key])?.label,
    })),
  }));
  const sectionLines = sections.map((section) => [
    `  ${section.category} (${section.subscale}):`,
    ...section.items.map((item) => `    ${item.name}: ${item.level}`),
  ].join('\n'));
  const rawInput = { scores: responses, notes };
  const soapText = [
    '• Functional Independence Measure (FIM)',
    `  Total score: ${totalScore}/126`,
    `  Motor subscale: ${motorScore}/91`,
    `  Cognitive subscale: ${cognitiveScore}/35`,
    '  Individual item scores:',
    ...sectionLines,
    notes ? `  Clinical notes: ${notes}` : null,
  ].filter(Boolean).join('\n');

  return buildCompletedPayload({
    context: completedContext(context, 'Functional Independence Measure (FIM)', notes),
    resultValue: totalScore,
    measurementType: 'fim',
    scoringKey: FIM_RUNNER_SPEC.scoringKey,
    scoringVersion: FIM_RUNNER_SPEC.scoring.version,
    rawInput,
    soapText,
    additionalData: {
      motor_score: motorScore,
      cognitive_score: cognitiveScore,
      total_score: totalScore,
      responses,
      sections,
      report_text: `Functional Independence Measure (FIM): ${totalScore}/126 (motor ${motorScore}/91; cognitive ${cognitiveScore}/35).`,
    },
  });
}

export const STANDALONE_AND_FIM_SCORERS = Object.freeze([
  Object.freeze({ runnerSpec: EIGHT_FOOT_UP_GO_RUNNER_SPEC, buildFixture: buildEightFootUpGoFixture, validateAndScore: validateAndScoreEightFootUpGo }),
  Object.freeze({ runnerSpec: SIX_METRE_WALK_RUNNER_SPEC, buildFixture: buildSixMetreWalkFixture, validateAndScore: validateAndScoreSixMetreWalk }),
  Object.freeze({ runnerSpec: FOUR_HUNDRED_METRE_WALK_RUNNER_SPEC, buildFixture: buildFourHundredMetreWalkFixture, validateAndScore: validateAndScoreFourHundredMetreWalk }),
  Object.freeze({ runnerSpec: SIX_MINUTE_STEP_RUNNER_SPEC, buildFixture: buildSixMinuteStepFixture, validateAndScore: validateAndScoreSixMinuteStep }),
  Object.freeze({ runnerSpec: FIM_RUNNER_SPEC, buildFixture: buildFimFixture, validateAndScore: validateAndScoreFim }),
]);
