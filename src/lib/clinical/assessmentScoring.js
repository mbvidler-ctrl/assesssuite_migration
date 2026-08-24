import { todayLocal } from '../localDate.js';

function requireFiniteNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  if (value === '' || value === null || value === undefined) {
    throw new Error(`${field} is required`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new Error(`${field} must be a number from ${min} to ${max}`);
  }
  return number;
}

function responseAt(responses, index) {
  return Array.isArray(responses) ? responses[index] : responses?.[index];
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function rounded(value) {
  return Math.round(value * 100) / 100;
}

export function classifyBpiDomain(score) {
  if (score === 0) return 'None';
  if (score <= 4) return 'Mild';
  if (score <= 6) return 'Moderate';
  return 'Severe';
}

/**
 * Brief Pain Inventory short-form scoring.
 *
 * Item 0 records whether non-everyday pain is present and is not part of either
 * domain score. Items 1-4 form the pain-severity mean; items 5-11 form the
 * pain-interference mean. A zero is a completed answer, never missing data.
 */
export function scoreBriefPainInventory(
  responses,
  { notes = '', assessmentDate = todayLocal(), assessmentName = 'Brief Pain Inventory (BPI)' } = {},
) {
  const painPresent = requireFiniteNumber(responseAt(responses, 0), 'BPI pain-present item', { min: 0, max: 1 });
  const severityItems = [1, 2, 3, 4].map((index) => (
    requireFiniteNumber(responseAt(responses, index), `BPI severity item ${index}`, { min: 0, max: 10 })
  ));
  const interferenceItems = [5, 6, 7, 8, 9, 10, 11].map((index) => (
    requireFiniteNumber(responseAt(responses, index), `BPI interference item ${index - 4}`, { min: 0, max: 10 })
  ));
  const severity = rounded(mean(severityItems));
  const interference = rounded(mean(interferenceItems));
  const severityBand = classifyBpiDomain(severity);
  const interferenceBand = classifyBpiDomain(interference);
  const soapText = [
    `• ${assessmentName}`,
    `  Pain other than everyday pain today: ${painPresent === 1 ? 'Yes' : 'No'}`,
    `  Pain Severity: ${severity.toFixed(2)}/10 — ${severityBand}`,
    `  Pain Interference: ${interference.toFixed(2)}/10 — ${interferenceBand}`,
    `  Severity item scores (worst, least, average, current): ${severityItems.join(', ')}`,
    `  Interference item scores (general activity, mood, walking, work, relations, sleep, enjoyment): ${interferenceItems.join(', ')}`,
  ].join('\n');

  return {
    status: 'completed',
    result_value: severity,
    assessment_date: assessmentDate,
    additional_data: {
      measurement_type: 'bpi',
      scoring_version: 'bpi-short-form-severity-4-interference-7',
      pain_present: painPresent === 1,
      pain_severity_score: severity,
      pain_interference_score: interference,
      pain_severity_interpretation: severityBand,
      pain_interference_interpretation: interferenceBand,
      severity_items: severityItems,
      interference_items: interferenceItems,
      responses: { ...responses },
      soap_text: soapText,
    },
    notes: notes || soapText,
  };
}

function selectedLabel(question, response, selectedOptionIndex) {
  if (question.question_type === 'yes_no') return Number(response) === 1 ? 'Yes' : 'No';
  if (!Array.isArray(question.options)) return String(response);
  const selected = selectedOptionIndex !== undefined
    ? question.options[selectedOptionIndex]
    : question.options.find((option) => Number(option.value) === Number(response));
  return selected?.label ?? String(response);
}

export function scoreQuestionnaire(
  assessment,
  responses,
  { selectedOptions = {}, notes = '', assessmentDate = todayLocal() } = {},
) {
  if (!assessment || !Array.isArray(assessment.questions) || assessment.questions.length === 0) {
    throw new Error('Questionnaire definition must include at least one question');
  }
  const values = assessment.questions.map((question, index) => {
    const value = requireFiniteNumber(responseAt(responses, index), `Question ${index + 1}`);
    if (Array.isArray(question.options) && question.options.length > 0) {
      const permitted = question.options.some((option) => Number(option.value) === value);
      if (!permitted) throw new Error(`Question ${index + 1} response is not a permitted option`);
    }
    return value;
  });
  const total = rounded(values.reduce((sum, value) => sum + value, 0));
  const maxScore = assessment.questions.reduce((sum, question) => {
    if (Array.isArray(question.options) && question.options.length > 0) {
      return sum + Math.max(...question.options.map((option) => Number(option.value) || 0));
    }
    return sum + (question.question_type === 'yes_no' ? 1 : 0);
  }, 0);
  const itemLines = assessment.questions.flatMap((question, index) => [
    `  Q${index + 1}. ${question.question_text}`,
    `      Answer: ${selectedLabel(question, values[index], selectedOptions[index])}`,
  ]);
  const soapText = [
    `• ${assessment.name}: ${total}/${maxScore}`,
    '',
    '  Individual Question Responses:',
    ...itemLines,
  ].join('\n');

  return {
    status: 'completed',
    result_value: total,
    assessment_date: assessmentDate,
    additional_data: {
      responses: { ...responses },
      measurement_type: 'questionnaire',
      soap_text: soapText,
    },
    notes: notes || soapText,
  };
}

/**
 * @param {any} assessment
 * @param {any} responses
 * @param {any} [options]
 */
export function scoreQuestionnaireAssessment(
  assessment,
  responses,
  options = {},
) {
  const { scoringKey = 'questionnaire-sum', ...scoreOptions } = options;
  if (scoringKey === 'bpi') {
    return scoreBriefPainInventory(responses, {
      ...scoreOptions,
      assessmentName: assessment?.name || 'Brief Pain Inventory (BPI)',
    });
  }
  if (scoringKey !== 'questionnaire-sum') {
    throw new Error(`Unsupported questionnaire scoring key: ${scoringKey}`);
  }
  return scoreQuestionnaire(assessment, responses, scoreOptions);
}

export const STRUCTURED_ASSESSMENT_FIELDS = Object.freeze({
  'ankle-dorsiflexion-rom': Object.freeze([
    Object.freeze({ key: 'degrees', label: 'Dorsiflexion angle', type: 'number', min: -90, max: 90, step: 0.1, unit: 'degrees' }),
    Object.freeze({ key: 'side', label: 'Side tested', type: 'select', options: ['Left', 'Right'] }),
    Object.freeze({ key: 'knee_position', label: 'Knee position', type: 'select', options: ['Flexed', 'Extended'] }),
  ]),
});

export function buildStructuredFixture(scoringKey) {
  switch (scoringKey) {
    case 'ankle-dorsiflexion-rom': return { degrees: 20, side: 'Left', knee_position: 'Flexed' };
    default: throw new Error(`Unsupported structured scoring key: ${scoringKey}`);
  }
}

export function scoreStructuredAssessment(
  scoringKey,
  values,
  { assessmentName = scoringKey, notes = '', assessmentDate = todayLocal() } = {},
) {
  let resultValue;
  let summary;
  let interpretation = null;
  let normalized;

  switch (scoringKey) {
    case 'ankle-dorsiflexion-rom': {
      const degrees = requireFiniteNumber(values.degrees, 'Dorsiflexion angle', { min: -90, max: 90 });
      if (!['Left', 'Right'].includes(values.side)) throw new Error('Side tested is required');
      if (!['Flexed', 'Extended'].includes(values.knee_position)) throw new Error('Knee position is required');
      normalized = { degrees, side: values.side, knee_position: values.knee_position };
      resultValue = degrees;
      summary = `${values.side} ankle dorsiflexion (${values.knee_position.toLowerCase()} knee): ${degrees} degrees`;
      break;
    }
    default:
      throw new Error(`Unsupported structured scoring key: ${scoringKey}`);
  }

  const soapText = `• ${assessmentName}\n  ${summary}`;
  return {
    status: 'completed',
    result_value: resultValue,
    assessment_date: assessmentDate,
    additional_data: {
      measurement_type: scoringKey,
      scoring_key: scoringKey,
      values: normalized,
      interpretation,
      soap_text: soapText,
    },
    notes: notes || soapText,
  };
}
