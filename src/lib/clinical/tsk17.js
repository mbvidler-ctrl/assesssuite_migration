import { todayLocal } from '../localDate.js';

const TSK_RESPONSE_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Strongly disagree', value: 1 }),
  Object.freeze({ label: 'Disagree', value: 2 }),
  Object.freeze({ label: 'Agree', value: 3 }),
  Object.freeze({ label: 'Strongly agree', value: 4 }),
]);

// Item wording and scoring are transcribed from the NSW State Insurance
// Regulatory Authority's reprint of the original instrument, which identifies
// Miller, Kori and Todd (1991) and the Vlaeyen et al. (1995) Pain publication.
// Source retrieved 2026-08-22:
// https://www.sira.nsw.gov.au/__data/assets/pdf_file/0019/1323523/tampa_scale_kinesiophobia.pdf
const TSK_ITEM_PROMPTS = Object.freeze([
  'I’m afraid that I might injure myself if I exercise.',
  'If I were to try to overcome it, my pain would increase.',
  'My body is telling me I have something dangerously wrong.',
  'My pain would probably be relieved if I were to exercise.',
  'People aren’t taking my medical condition seriously enough.',
  'My accident has put my body at risk for the rest of my life.',
  'Pain always means I have injured my body.',
  'Just because something aggravates my pain does not mean it is dangerous.',
  'I am afraid that I might injure myself accidentally.',
  'Simply being careful that I do not make any unnecessary movements is the safest thing I can do to prevent my pain from worsening.',
  'I wouldn’t have this much pain if there weren’t something potentially dangerous going on in my body.',
  'Although my condition is painful, I would be better off if I were physically active.',
  'Pain lets me know when to stop exercising so that I don’t injure myself.',
  'It’s really not safe for a person with a condition like mine to be physically active.',
  'I can’t do all the things normal people do because it’s too easy for me to get injured.',
  'Even though something is causing me a lot of pain, I don’t think it’s actually dangerous.',
  'No one should have to exercise when he/she is in pain.',
]);

export const TSK_REVERSE_SCORED_ITEMS = Object.freeze([4, 8, 12, 16]);

const TSK_ITEMS = Object.freeze(TSK_ITEM_PROMPTS.map((prompt, index) => Object.freeze({
  key: `q${index + 1}`,
  prompt,
  responseBinding: Object.freeze({ field: 'responses', index }),
  runtimeResponseKey: `q${index + 1}`,
  required: true,
  options: TSK_RESPONSE_OPTIONS,
})));

export const TSK_RUNNER_SPEC = Object.freeze({
  schemaVersion: 1,
  kind: 'questionnaire',
  runnerKey: 'tsk',
  scoringKey: 'tsk-17',
  fields: Object.freeze([]),
  items: TSK_ITEMS,
  scoring: Object.freeze({
    method: 'sum-17-items-with-reverse-scoring',
    version: 'tsk-17.v1',
    responseMinimum: 1,
    responseMaximum: 4,
    reverseScoredItems: TSK_REVERSE_SCORED_ITEMS,
    totalMinimum: 17,
    totalMaximum: 68,
    highScoreThresholdExclusive: 37,
  }),
  result: Object.freeze({
    primaryField: 'total_score',
    unit: 'points',
    additionalDataFields: Object.freeze([
      'responses',
      'scored_items',
      'reverse_scored_items',
      'interpretation',
      'interpretation_summary',
      'soap_text',
      'soap_objective',
      'report_text',
    ]),
  }),
  provenance: Object.freeze({
    instrument: 'Tampa Scale for Kinesiophobia (TSK-17)',
    itemAndScoringSource: 'NSW State Insurance Regulatory Authority reprint of the original instrument',
    sourceUrl: 'https://www.sira.nsw.gov.au/__data/assets/pdf_file/0019/1323523/tampa_scale_kinesiophobia.pdf',
    sourceCitation: 'Vlaeyen JWS, Kole-Snijders AMJ, Boeren RGB, van Eek H. Fear of movement/(re)injury in chronic low back pain and its relation to behavioral performance. Pain. 1995;62(3):363-372.',
    retrievedDate: '2026-08-22',
  }),
});

function valueForItem(responses, item, index) {
  if (Array.isArray(responses)) return responses[index];
  if (!responses || typeof responses !== 'object') return undefined;
  return responses[item.key] ?? responses[index];
}

function assessmentDateFrom(context) {
  const supplied = String(context?.assessmentDate || '').trim();
  return supplied || todayLocal();
}

export function validateAndScore(input, context = {}) {
  const responses = input?.responses;
  const normalizedResponses = {};
  const scoredItems = [];

  TSK_RUNNER_SPEC.items.forEach((item, index) => {
    const itemNumber = index + 1;
    const rawValue = valueForItem(responses, item, index);
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      throw new Error(`TSK item ${itemNumber} is required`);
    }
    const response = Number(rawValue);
    if (!Number.isInteger(response) || response < 1 || response > 4) {
      throw new Error(`TSK item ${itemNumber} must be a whole-number response from 1 to 4`);
    }
    const scoredValue = TSK_REVERSE_SCORED_ITEMS.includes(itemNumber) ? 5 - response : response;
    normalizedResponses[item.key] = response;
    scoredItems.push(Object.freeze({
      item: itemNumber,
      key: item.key,
      response,
      reverse_scored: TSK_REVERSE_SCORED_ITEMS.includes(itemNumber),
      scored_value: scoredValue,
    }));
  });

  const totalScore = scoredItems.reduce((total, item) => total + item.scored_value, 0);
  if (!Number.isFinite(totalScore) || totalScore < 17 || totalScore > 68) {
    throw new Error('TSK total must be finite and within the 17–68 scoring range');
  }

  const interpretation = totalScore > 37
    ? 'High kinesiophobia'
    : 'Not above the high-kinesiophobia threshold';
  const assessmentName = String(context?.assessmentName || 'Tampa Scale for Kinesiophobia (TSK-17)').trim();
  const interpretationSummary = `TSK-17 total: ${totalScore}/68 — ${interpretation}.`;
  const responseLines = TSK_RUNNER_SPEC.items.map((item, index) => {
    const response = normalizedResponses[item.key];
    const option = item.options.find(({ value }) => value === response);
    return `  Q${index + 1}. ${item.prompt}\n      Response: ${option.label} (${response}); scored ${scoredItems[index].scored_value}`;
  });
  const soapText = [
    `• ${assessmentName}`,
    `  Total: ${totalScore}/68`,
    `  Interpretation: ${interpretation}`,
    '  Individual responses:',
    ...responseLines,
  ].join('\n');
  const notes = String(input?.notes ?? context?.notes ?? '').trim();
  if (notes.length > 4000) throw new Error('Clinical notes must be 4000 characters or fewer');
  const rawInput = {
    responses: { ...normalizedResponses },
    notes,
  };

  return {
    status: 'completed',
    result_value: totalScore,
    assessment_date: assessmentDateFrom(context),
    additional_data: {
      measurement_type: 'tsk-17',
      scoring_key: TSK_RUNNER_SPEC.scoringKey,
      scoring_version: TSK_RUNNER_SPEC.scoring.version,
      raw_input: rawInput,
      total_score: totalScore,
      score_range: { minimum: 17, maximum: 68 },
      responses: normalizedResponses,
      scored_items: scoredItems,
      reverse_scored_items: [...TSK_REVERSE_SCORED_ITEMS],
      interpretation,
      interpretation_summary: interpretationSummary,
      soap_text: soapText,
      soap_objective: interpretationSummary,
      report_text: `${interpretationSummary}\n${soapText}`,
      provenance: { ...TSK_RUNNER_SPEC.provenance },
    },
    notes,
  };
}

export function buildTskFixture(response = 2) {
  return {
    responses: Object.fromEntries(TSK_RUNNER_SPEC.items.map((item) => [item.key, response])),
    notes: '',
  };
}
