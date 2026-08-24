import {
  buildCompletedPayload,
  requireChoice,
  requireFiniteNumber,
  requireInteger,
} from './scorers/contract.js';

const HANDRAIL_OPTIONS = Object.freeze(['none', 'occasional', 'continuous', 'required']);
const DEVICE_OPTIONS = Object.freeze(['none', 'cane', 'walker', 'crutches']);

export const TUDS_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'measurement',
  runnerKey: 'tuds',
  scoringKey: 'timed-up-and-down-stairs',
  fields: Object.freeze([
    Object.freeze({
      key: 'trials',
      label: 'Completed timed trials',
      type: 'object[]',
      required: true,
      minItems: 1,
      maxItems: 10,
      items: Object.freeze([
        Object.freeze({ key: 'trial', label: 'Trial number', type: 'integer', required: false, min: 1, max: 10, step: 1 }),
        Object.freeze({ key: 'time', label: 'Trial time', type: 'number', required: true, min: 0.01, max: 3600, step: 0.01, unit: 'seconds' }),
        Object.freeze({ key: 'timestamp', label: 'Recorded timestamp', type: 'text', required: false }),
      ]),
    }),
    Object.freeze({ key: 'num_stairs', label: 'Number of stairs', type: 'number', required: true, min: 1, max: 100, step: 1, unit: 'stairs', default: 14 }),
    Object.freeze({ key: 'stair_height_cm', label: 'Stair height', type: 'number', required: true, min: 1, max: 50, step: 0.1, unit: 'cm' }),
    Object.freeze({ key: 'handrail_use', label: 'Handrail use', type: 'select', required: true, options: HANDRAIL_OPTIONS }),
    Object.freeze({ key: 'assistive_device', label: 'Assistive device', type: 'select', required: true, options: DEVICE_OPTIONS }),
    Object.freeze({ key: 'safety_observations', label: 'Safety observations', type: 'textarea', required: false }),
    Object.freeze({ key: 'notes', label: 'Clinical notes', type: 'textarea', required: false }),
  ]),
  scoring: Object.freeze({
    method: 'arithmetic-mean-and-minimum',
    direction: 'lower_better',
    version: 'tuds-time-v1',
  }),
  result: Object.freeze({
    primaryField: 'average_time',
    unit: 'seconds',
    additionalDataFields: Object.freeze([
      'trials',
      'best_time',
      'num_stairs',
      'stair_height_cm',
      'handrail_use',
      'assistive_device',
      'safety_observations',
      'soap_text',
    ]),
  }),
});

function boundedText(value, field, maxLength) {
  const text = String(value || '').trim();
  if (text.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or fewer`);
  return text;
}

function roundTwo(value) {
  return Math.round(value * 100) / 100;
}

function normalizeTrials(input) {
  if (!Array.isArray(input) || input.length === 0) throw new Error('At least one TUDS trial is required');
  if (input.length > 10) throw new Error('TUDS supports a maximum of 10 trials');
  return input.map((trial, index) => requireFiniteNumber(
    typeof trial === 'object' && trial !== null ? trial.time ?? trial.seconds : trial,
    `TUDS trial ${index + 1}`,
    { min: 0.01, max: 3600 },
  ));
}

export function buildTudsFixture() {
  return {
    trials: [
      { trial: 1, time: 12.4, timestamp: '2026-08-22T00:00:00.000Z' },
      { trial: 2, time: 11.8, timestamp: '2026-08-22T00:01:00.000Z' },
    ],
    num_stairs: 14,
    stair_height_cm: 18,
    handrail_use: 'none',
    assistive_device: 'none',
    safety_observations: 'Completed safely using a reciprocal pattern.',
    notes: 'Deterministic TUDS fixture.',
  };
}

export function validateAndScoreTuds(input, context = {}) {
  const trials = normalizeTrials(input?.trials);
  const numStairs = requireInteger(input?.num_stairs, 'Number of stairs', { min: 1, max: 100 });
  const stairHeight = requireFiniteNumber(input?.stair_height_cm, 'Stair height', { min: 1, max: 50 });
  const handrailUse = requireChoice(input?.handrail_use, 'Handrail use', HANDRAIL_OPTIONS);
  const assistiveDevice = requireChoice(input?.assistive_device, 'Assistive device', DEVICE_OPTIONS);
  const safetyObservations = boundedText(input?.safety_observations, 'Safety observations', 2000);
  const notes = boundedText(input?.notes, 'Clinical notes', 4000);
  const averageTime = roundTwo(trials.reduce((sum, value) => sum + value, 0) / trials.length);
  const bestTime = roundTwo(Math.min(...trials));
  const rawInput = {
    trials,
    num_stairs: numStairs,
    stair_height_cm: stairHeight,
    handrail_use: handrailUse,
    assistive_device: assistiveDevice,
    safety_observations: safetyObservations,
    notes,
  };
  const soapText = [
    '• Timed Up and Down Stairs (TUDS)',
    `  Average time: ${averageTime.toFixed(2)} s; best time: ${bestTime.toFixed(2)} s across ${trials.length} trial(s)`,
    `  Stair configuration: ${numStairs} stairs at ${stairHeight} cm`,
    `  Handrail: ${handrailUse}; assistive device: ${assistiveDevice}`,
    safetyObservations ? `  Safety observations: ${safetyObservations}` : null,
  ].filter(Boolean).join('\n');
  const reportText = `Timed Up and Down Stairs (TUDS): ${averageTime.toFixed(2)} seconds average; ${bestTime.toFixed(2)} seconds best.`;

  return buildCompletedPayload({
    context: {
      ...context,
      assessmentName: context.assessmentName || 'Timed Up and Down Stairs (TUDS)',
      notes,
    },
    resultValue: averageTime,
    measurementType: 'tuds',
    scoringKey: TUDS_RUNNER_SPEC.scoringKey,
    scoringVersion: TUDS_RUNNER_SPEC.scoring.version,
    rawInput,
    soapText,
    additionalData: {
      trials,
      average_time: averageTime,
      best_time: bestTime,
      num_stairs: numStairs,
      stair_height_cm: stairHeight,
      handrail_use: handrailUse,
      assistive_device: assistiveDevice,
      safety_observations: safetyObservations,
      report_text: reportText,
    },
  });
}
