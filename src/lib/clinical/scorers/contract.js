const ISO_LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OPEN_QUESTIONNAIRE_ITEM_TYPES = new Set([
  'date',
  'duration',
  'number',
  'numeric',
  'text',
  'textarea',
  'time',
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`Assessment scorer contract: ${message}`);
}

export function requireFiniteNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  invariant(value !== '' && value !== null && value !== undefined, `${field} is required`);
  const number = Number(value);
  invariant(Number.isFinite(number), `${field} must be a finite number`);
  invariant(number >= min && number <= max, `${field} must be between ${min} and ${max}`);
  return number;
}

export function requireInteger(value, field, limits = {}) {
  const number = requireFiniteNumber(value, field, limits);
  invariant(Number.isInteger(number), `${field} must be a whole number`);
  return number;
}

export function requireChoice(value, field, options) {
  invariant(Array.isArray(options) && options.length > 0, `${field} has no permitted choices`);
  invariant(options.includes(value), `${field} is not a permitted choice`);
  return value;
}

export function normalizeScorerContext(context = {}) {
  const assessmentName = String(context.assessmentName || '').trim();
  const assessmentDate = String(context.assessmentDate || '').trim();
  const notes = String(context.notes || '');
  invariant(assessmentName, 'context.assessmentName is required');
  invariant(ISO_LOCAL_DATE.test(assessmentDate), 'context.assessmentDate must be an explicit YYYY-MM-DD date');
  return {
    assessmentName,
    assessmentDate,
    notes,
    client: context.client ?? null,
  };
}

export function buildCompletedPayload({
  context,
  resultValue,
  measurementType,
  scoringKey,
  scoringVersion,
  rawInput,
  soapText,
  additionalData = {},
}) {
  const normalizedContext = normalizeScorerContext(context);
  const numericResult = requireFiniteNumber(resultValue, 'result_value');
  invariant(typeof measurementType === 'string' && measurementType.trim(), 'measurementType is required');
  invariant(typeof scoringKey === 'string' && scoringKey.trim(), 'scoringKey is required');
  invariant(typeof scoringVersion === 'string' && scoringVersion.trim(), 'scoringVersion is required');
  invariant(rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput), 'rawInput must be an object');
  invariant(typeof soapText === 'string' && soapText.trim(), 'soapText is required');

  const payload = {
    status: 'completed',
    result_value: numericResult,
    assessment_date: normalizedContext.assessmentDate,
    notes: normalizedContext.notes || soapText,
    additional_data: {
      measurement_type: measurementType,
      scoring_key: scoringKey,
      scoring_version: scoringVersion,
      raw_input: structuredClone(rawInput),
      soap_text: soapText,
      ...additionalData,
    },
  };
  return assertCompletedAssessmentPayload(payload);
}

export function assertRunnerSpec(runnerSpec) {
  invariant(runnerSpec && typeof runnerSpec === 'object', 'runnerSpec is required');
  invariant(runnerSpec.schemaVersion === 1, 'runnerSpec.schemaVersion must be 1');
  invariant(typeof runnerSpec.kind === 'string' && runnerSpec.kind.trim(), 'runnerSpec.kind is required');
  invariant(typeof runnerSpec.runnerKey === 'string' && runnerSpec.runnerKey.trim(), 'runnerSpec.runnerKey is required');
  invariant(typeof runnerSpec.scoringKey === 'string' && runnerSpec.scoringKey.trim(), 'runnerSpec.scoringKey is required');
  invariant(runnerSpec.scoring && typeof runnerSpec.scoring.version === 'string' && runnerSpec.scoring.version.trim(), 'runnerSpec.scoring.version is required');
  invariant(runnerSpec.result && typeof runnerSpec.result.primaryField === 'string' && runnerSpec.result.primaryField.trim(), 'runnerSpec.result.primaryField is required');
  if (runnerSpec.kind === 'questionnaire') {
    invariant(Array.isArray(runnerSpec.items) && runnerSpec.items.length > 0, 'questionnaire runnerSpec.items must be non-empty');
    for (const [index, item] of runnerSpec.items.entries()) {
      invariant(typeof item.key === 'string' && item.key.trim(), `questionnaire item ${index + 1} has no key`);
      invariant(
        typeof (item.prompt ?? item.question_text) === 'string' && (item.prompt ?? item.question_text).trim(),
        `questionnaire item ${index + 1} has no prompt`,
      );
      const itemType = String(item.type ?? item.question_type ?? '').trim().toLowerCase();
      if (!OPEN_QUESTIONNAIRE_ITEM_TYPES.has(itemType)) {
        invariant(Array.isArray(item.options) && item.options.length > 0, `questionnaire item ${index + 1} has no options`);
      }
    }
  } else {
    invariant(Array.isArray(runnerSpec.fields) && runnerSpec.fields.length > 0, 'non-questionnaire runnerSpec.fields must be non-empty');
  }
  return runnerSpec;
}

export function assertCompletedAssessmentPayload(payload) {
  invariant(payload && typeof payload === 'object', 'completed payload must be an object');
  invariant(payload.status === 'completed', 'completed payload status must be completed');
  invariant(Number.isFinite(payload.result_value), 'completed payload result_value must be finite');
  invariant(ISO_LOCAL_DATE.test(String(payload.assessment_date || '')), 'completed payload assessment_date must be YYYY-MM-DD');
  invariant(payload.additional_data && typeof payload.additional_data === 'object', 'completed payload additional_data is required');
  for (const key of ['measurement_type', 'scoring_key', 'scoring_version', 'raw_input', 'soap_text']) {
    invariant(payload.additional_data[key] !== undefined && payload.additional_data[key] !== null, `completed payload additional_data.${key} is required`);
  }
  invariant(typeof payload.additional_data.soap_text === 'string' && payload.additional_data.soap_text.trim(), 'completed payload SOAP text is empty');
  return payload;
}

export function defineAssessmentScorer({ runnerSpec, buildFixture, validateAndScore }) {
  assertRunnerSpec(runnerSpec);
  invariant(typeof buildFixture === 'function', `${runnerSpec.scoringKey} buildFixture must be a function`);
  invariant(typeof validateAndScore === 'function', `${runnerSpec.scoringKey} validateAndScore must be a function`);
  return Object.freeze({ runnerSpec: Object.freeze(runnerSpec), buildFixture, validateAndScore });
}
