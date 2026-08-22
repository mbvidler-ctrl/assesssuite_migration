// Server-owned AI task contracts for the physiotherapy vertical.
//
// This is deliberately not an alias of the generic InvokeLLM surface. The
// browser selects a reviewed task id while prompts, schemas, provider proof,
// usage accounting and failure behaviour remain authoritative on the server.
// This lane never invokes the deterministic development mock and never returns
// a draft unless the provider receipt and usage settlement are both complete.

import { createHash } from 'node:crypto';

import {
  CLINICAL_AI_DISABLED_CODE,
  CLINICAL_AI_DISABLED_MESSAGE,
  CLINICAL_AI_PROVIDER_FAILED_CODE,
  CLINICAL_AI_UNCONFIGURED_CODE,
  CLINICAL_AI_UNCONFIGURED_MESSAGE,
  physioAiTasksAvailable,
} from './capabilities.mjs';
import { invokeLLMWithUsage, llmEnabled, pickModel } from './llm.mjs';

export const PHYSIO_AI_CONTRACT_VERSION = 'physio-ai-task-contract/2.0.0';
export const PHYSIO_AI_RECEIPT_CONTRACT_VERSION = 'physio-ai-provider-receipt/1.0.0';
export const PHYSIO_AI_PROVIDER_FEATURE = 'invoke_llm';
export const PHYSIO_AI_INTERNAL_RECEIPT = Symbol('physio-ai-internal-receipt');

export const PHYSIO_AI_PUBLIC_TASK_IDS = Object.freeze({
  initialAssessmentSummary: 'physio.initial_assessment_summary.v1',
  soapNote: 'physio.soap_note.v1',
  managementPlan: 'physio.management_plan.v1',
  progressComparison: 'physio.progress_comparison.v1',
  referrerUpdate: 'physio.referrer_update.v1',
  dischargeSummary: 'physio.discharge_summary.v1',
});

const MAX_CONTEXT_BYTES = 64 * 1024;
const MAX_CONTEXT_DEPTH = 8;
const MAX_ARRAY_ITEMS = 120;
const MAX_STRING_LENGTH = 16_000;

const stringArray = Object.freeze({
  type: 'array',
  items: { type: 'string' },
});

const measureArray = Object.freeze({
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      measure: { type: 'string' },
      finding: { type: 'string' },
      interpretation_for_clinician_review: { type: 'string' },
    },
    required: ['measure', 'finding', 'interpretation_for_clinician_review'],
  },
});

function task({ version, label, purpose, instructions, properties, required }) {
  return Object.freeze({
    version,
    label,
    purpose,
    instructions: Object.freeze(instructions),
    schema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties,
      required,
    }),
  });
}

export const PHYSIO_AI_TASKS = Object.freeze({
  [PHYSIO_AI_PUBLIC_TASK_IDS.initialAssessmentSummary]: task({
    version: 'physio.initial_assessment_summary.v1/schema-1.0.0',
    label: 'Initial assessment summary',
    purpose: 'Structure an initial physiotherapy assessment into a clinician-editable summary.',
    instructions: [
      'Summarise the supplied history, function, examination findings and baseline measures.',
      'Keep reported history distinct from observed and measured findings.',
      'State any supplied working clinical impression as provisional and identify missing information.',
    ],
    properties: {
      presenting_problem_summary: { type: 'string' },
      functional_and_participation_impact: { type: 'string' },
      history_highlights: stringArray,
      objective_findings: stringArray,
      baseline_outcome_measures: measureArray,
      goals_reported: stringArray,
      working_clinical_impression_for_review: { type: 'string' },
      uncertainties: stringArray,
      clinician_review_questions: stringArray,
    },
    required: [
      'presenting_problem_summary',
      'functional_and_participation_impact',
      'history_highlights',
      'objective_findings',
      'baseline_outcome_measures',
      'goals_reported',
      'working_clinical_impression_for_review',
      'uncertainties',
      'clinician_review_questions',
    ],
  }),
  [PHYSIO_AI_PUBLIC_TASK_IDS.soapNote]: task({
    version: 'physio.soap_note.v1/schema-1.0.0',
    label: 'SOAP note',
    purpose: 'Draft a SOAP-format physiotherapy note from the recorded encounter facts.',
    instructions: [
      'Use only supplied encounter facts; do not invent examination results, consent or interventions.',
      'In Assessment, synthesise the clinician-facing impression and uncertainty from the supplied record.',
      'In Plan, record proposed next steps as a draft for clinician confirmation.',
    ],
    properties: {
      subjective: { type: 'string' },
      objective: { type: 'string' },
      assessment_for_clinician_review: { type: 'string' },
      plan_for_clinician_confirmation: { type: 'string' },
      unresolved_safety_questions: stringArray,
      omissions_or_uncertainties: stringArray,
    },
    required: [
      'subjective',
      'objective',
      'assessment_for_clinician_review',
      'plan_for_clinician_confirmation',
      'unresolved_safety_questions',
      'omissions_or_uncertainties',
    ],
  }),
  [PHYSIO_AI_PUBLIC_TASK_IDS.progressComparison]: task({
    version: 'physio.progress_comparison.v1/schema-1.0.0',
    label: 'Progress comparison',
    purpose: 'Compare baseline and review data while preserving measurement context.',
    instructions: [
      'Compare like with like and preserve the supplied units, timing and measurement context.',
      'Describe direction and magnitude of change without claiming significance unless a threshold is supplied.',
      'Do not attribute change to treatment unless the supplied context supports that conclusion.',
    ],
    properties: {
      comparison_summary: { type: 'string' },
      measure_trends: measureArray,
      functional_changes: stringArray,
      goal_progress: stringArray,
      barriers_and_modifiers: stringArray,
      missing_or_non_comparable_data: stringArray,
      clinician_review_points: stringArray,
    },
    required: [
      'comparison_summary',
      'measure_trends',
      'functional_changes',
      'goal_progress',
      'barriers_and_modifiers',
      'missing_or_non_comparable_data',
      'clinician_review_points',
    ],
  }),
  [PHYSIO_AI_PUBLIC_TASK_IDS.referrerUpdate]: task({
    version: 'physio.referrer_update.v1/schema-1.0.0',
    label: 'Referrer update',
    purpose: 'Draft a concise clinical progress update for clinician review before external use.',
    instructions: [
      'Use only facts in the supplied context and distinguish reported symptoms, observed findings and measures.',
      'Summarise management to date and the current plan without inventing a recipient identity.',
      'Do not state that the update was approved or sent.',
    ],
    properties: {
      subject_line: { type: 'string' },
      opening: { type: 'string' },
      clinical_and_functional_update: { type: 'string' },
      objective_progress: stringArray,
      management_to_date: stringArray,
      current_plan_for_clinician_confirmation: { type: 'string' },
      questions_or_escalation_for_referrer: stringArray,
      limitations_and_uncertainties: stringArray,
    },
    required: [
      'subject_line',
      'opening',
      'clinical_and_functional_update',
      'objective_progress',
      'management_to_date',
      'current_plan_for_clinician_confirmation',
      'questions_or_escalation_for_referrer',
      'limitations_and_uncertainties',
    ],
  }),
  [PHYSIO_AI_PUBLIC_TASK_IDS.dischargeSummary]: task({
    version: 'physio.discharge_summary.v1/schema-1.0.0',
    label: 'Discharge summary',
    purpose: 'Draft an episode discharge summary from the recorded course and outcomes.',
    instructions: [
      'Summarise the episode, management, measured change, current function and unresolved issues.',
      'Keep proposed follow-up and home management explicit drafts for clinician confirmation.',
      'Do not invent adherence, consent, outcome scores or follow-up arrangements.',
    ],
    properties: {
      episode_summary: { type: 'string' },
      management_delivered: stringArray,
      goal_outcomes: stringArray,
      outcome_measure_change: measureArray,
      current_function: { type: 'string' },
      home_management_record_for_confirmation: stringArray,
      follow_up_draft_for_confirmation: stringArray,
      unresolved_issues_and_risks: stringArray,
    },
    required: [
      'episode_summary',
      'management_delivered',
      'goal_outcomes',
      'outcome_measure_change',
      'current_function',
      'home_management_record_for_confirmation',
      'follow_up_draft_for_confirmation',
      'unresolved_issues_and_risks',
    ],
  }),
  [PHYSIO_AI_PUBLIC_TASK_IDS.managementPlan]: task({
    version: 'physio.management_plan.v1/schema-1.0.0',
    label: 'Management plan draft',
    purpose: 'Organise the recorded findings and goals into management options for clinician selection.',
    instructions: [
      'Tie management options and reassessment to the supplied impairments, function, participation and goals.',
      'Identify dosage and progression decisions that still require clinician input.',
      'Surface unresolved contraindications, precautions and referral considerations rather than filling gaps.',
    ],
    properties: {
      problem_list_for_review: stringArray,
      patient_goals_for_confirmation: stringArray,
      management_options_for_clinician_selection: stringArray,
      dosage_and_progression_questions: stringArray,
      outcome_measures_for_consideration: stringArray,
      reassessment_draft: { type: 'string' },
      coordination_and_referral_considerations: stringArray,
      contraindication_and_red_flag_checks_required: stringArray,
      uncertainties: stringArray,
    },
    required: [
      'problem_list_for_review',
      'patient_goals_for_confirmation',
      'management_options_for_clinician_selection',
      'dosage_and_progression_questions',
      'outcome_measures_for_consideration',
      'reassessment_draft',
      'coordination_and_referral_considerations',
      'contraindication_and_red_flag_checks_required',
      'uncertainties',
    ],
  }),
});

export const PHYSIO_AI_TASK_IDS = Object.freeze([
  PHYSIO_AI_PUBLIC_TASK_IDS.initialAssessmentSummary,
  PHYSIO_AI_PUBLIC_TASK_IDS.soapNote,
  PHYSIO_AI_PUBLIC_TASK_IDS.managementPlan,
  PHYSIO_AI_PUBLIC_TASK_IDS.progressComparison,
  PHYSIO_AI_PUBLIC_TASK_IDS.referrerUpdate,
  PHYSIO_AI_PUBLIC_TASK_IDS.dischargeSummary,
]);

export const PHYSIO_AI_SYSTEM_INSTRUCTIONS = Object.freeze([
  'You are a clinical documentation assistant for an Australian physiotherapy service.',
  'Write in Australian English and use a precise professional clinical register.',
  'Produce a clinician-editable draft from the supplied facts; do not claim that the draft is reviewed, approved, saved, sent or delivered.',
  'Do not invent findings, interventions, consent, diagnoses, scores, dates, thresholds, citations or follow-up arrangements.',
  'Keep reported, observed, measured and inferred information distinct, and make uncertainty explicit.',
  'Follow the task instructions and output schema exactly. Never emit mock, placeholder or demonstration content.',
]);

export class PhysioAiTaskError extends Error {
  constructor(status, code, message, { cause = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'PhysioAiTaskError';
    this.status = status;
    this.httpStatus = status;
    this.code = code;
  }
}

const DIRECT_IDENTIFIER_KEY = /^(?:id|.*_id|full_name|first_name|last_name|preferred_name|email|phone|mobile|address|date_of_birth|dob|medicare|dva|ndis|mrn|urn)$/i;
const BLOCKED_OBJECT_KEY = /^(?:__proto__|prototype|constructor)$/;
const PERSON_CONTEXT_PATH = /(?:client|patient|person|referrer|clinician|contact|recipient)(?:\.|\[|$)/i;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function minimiseContext(value, path = 'context', depth = 0) {
  if (depth > MAX_CONTEXT_DEPTH) {
    throw new PhysioAiTaskError(400, 'context_too_deep', `Clinical context exceeds the ${MAX_CONTEXT_DEPTH}-level nesting limit.`);
  }
  if (value === null) return null;
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) {
      throw new PhysioAiTaskError(413, 'context_value_too_large', `${path} exceeds the ${MAX_STRING_LENGTH}-character field limit.`);
    }
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new PhysioAiTaskError(400, 'invalid_context', `${path} must be a finite number.`);
    return value;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) {
      throw new PhysioAiTaskError(413, 'context_array_too_large', `${path} exceeds the ${MAX_ARRAY_ITEMS}-item limit.`);
    }
    return value.map((entry, index) => minimiseContext(entry, `${path}[${index}]`, depth + 1));
  }
  if (!isPlainObject(value)) {
    throw new PhysioAiTaskError(400, 'invalid_context', `${path} contains an unsupported value.`);
  }

  const result = Object.create(null);
  for (const [key, entry] of Object.entries(value)) {
    const nameIdentifiesPerson = key.toLowerCase() === 'name' && PERSON_CONTEXT_PATH.test(path);
    if (BLOCKED_OBJECT_KEY.test(key) || DIRECT_IDENTIFIER_KEY.test(key) || nameIdentifiesPerson) continue;
    result[key] = minimiseContext(entry, `${path}.${key}`, depth + 1);
  }
  return result;
}

export function preparePhysioClinicalContext(context) {
  if (!isPlainObject(context)) {
    throw new PhysioAiTaskError(400, 'context_required', 'A structured clinical context object is required.');
  }
  const safeContext = minimiseContext(context);
  const serialized = JSON.stringify(safeContext);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CONTEXT_BYTES) {
    throw new PhysioAiTaskError(413, 'context_too_large', `Clinical context exceeds the ${MAX_CONTEXT_BYTES}-byte limit.`);
  }
  if (Object.keys(safeContext).length === 0) {
    throw new PhysioAiTaskError(400, 'context_required', 'Clinical context must contain at least one non-identifying fact.');
  }
  return safeContext;
}

function assertSchemaValue(schema, value, path = 'draft') {
  if (schema.type === 'object') {
    if (!isPlainObject(value)) throw new Error(`${path} must be an object`);
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) throw new Error(`${path}.${key} is required`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(schema.properties || {}, key)) throw new Error(`${path}.${key} is not allowed`);
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (Object.hasOwn(value, key)) assertSchemaValue(childSchema, value[key], `${path}.${key}`);
    }
    return;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
    if (value.length > MAX_ARRAY_ITEMS) throw new Error(`${path} contains too many items`);
    value.forEach((entry, index) => assertSchemaValue(schema.items, entry, `${path}[${index}]`));
    return;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') throw new Error(`${path} must be a string`);
    if (!value.trim()) throw new Error(`${path} must not be empty`);
    if (value.length > MAX_STRING_LENGTH) throw new Error(`${path} is too long`);
  }
}

export function validatePhysioTaskOutput(taskId, output) {
  const selectedTask = PHYSIO_AI_TASKS[taskId];
  if (!selectedTask) throw new Error(`unknown physiotherapy AI task: ${taskId}`);
  assertSchemaValue(selectedTask.schema, output);
  return output;
}

export function buildPhysioTaskPrompt(taskId, context) {
  const selectedTask = PHYSIO_AI_TASKS[taskId];
  if (!selectedTask) {
    throw new PhysioAiTaskError(400, 'unsupported_task', 'A supported physiotherapy AI task is required.');
  }
  return [
    `PHYSIOTHERAPY TASK: ${taskId}`,
    `TASK CONTRACT: ${selectedTask.version}`,
    `PURPOSE: ${selectedTask.purpose}`,
    '',
    'TASK INSTRUCTIONS:',
    ...selectedTask.instructions.map((instruction) => `- ${instruction}`),
    '',
    'CLINICAL CONTEXT:',
    JSON.stringify(context, null, 2),
  ].join('\n');
}

function asPublicUsageError(error) {
  const status = Number(error?.httpStatus || error?.status);
  if (
    Number.isInteger(status) &&
    status >= 400 &&
    status < 600 &&
    typeof error?.code === 'string' &&
    error.code.startsWith('api_usage_')
  ) {
    return new PhysioAiTaskError(status, error.code, String(error.message || 'AI usage accounting is unavailable.'), { cause: error });
  }
  return null;
}

function assertProviderReceipt(generated) {
  const usage = generated?.usage;
  const completeUsage = usage &&
    Number.isSafeInteger(usage.inputTokens) && usage.inputTokens >= 0 &&
    Number.isSafeInteger(usage.cachedInputTokens) && usage.cachedInputTokens >= 0 &&
    usage.cachedInputTokens <= usage.inputTokens &&
    Number.isSafeInteger(usage.outputTokens) && usage.outputTokens >= 0;
  const complete = generated &&
    typeof generated.provider === 'string' && generated.provider.trim() &&
    typeof generated.model === 'string' && generated.model.trim() &&
    generated.modelFromProvider === true &&
    typeof generated.providerRequestId === 'string' && generated.providerRequestId.trim() &&
    typeof generated.providerHttpRequestId === 'string' && generated.providerHttpRequestId.trim() &&
    Number.isInteger(generated.providerStatus) && generated.providerStatus >= 200 && generated.providerStatus < 300 &&
    generated.finishReason === 'stop' &&
    completeUsage;
  if (!complete) throw new Error('provider returned an incomplete generation receipt');
  return {
    provider: generated.provider.trim(),
    model: generated.model.trim(),
    providerRequestId: generated.providerRequestId.trim(),
    providerHttpRequestId: generated.providerHttpRequestId.trim(),
    providerStatus: generated.providerStatus,
    finishReason: generated.finishReason,
    usage: {
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      outputTokens: usage.outputTokens,
    },
  };
}

function providerFailure(cause) {
  return new PhysioAiTaskError(
    502,
    CLINICAL_AI_PROVIDER_FAILED_CODE,
    'AI generation failed. No physiotherapy draft was generated.',
    { cause },
  );
}

export function createPhysioAiTaskRunner({
  invoke = invokeLLMWithUsage,
  providerAvailable = llmEnabled,
  featureEnabled = physioAiTasksAvailable,
  providerSelector = () => 'openai',
  modelSelector = pickModel,
  now = () => new Date(),
} = {}) {
  return async function runPhysioAiTask(request = {}, services = {}) {
    const taskId = typeof request.task === 'string' ? request.task.trim() : '';
    const selectedTask = PHYSIO_AI_TASKS[taskId];
    if (!selectedTask) {
      throw new PhysioAiTaskError(400, 'unsupported_task', 'A supported physiotherapy AI task is required.');
    }
    const orgId = typeof request.orgId === 'string' ? request.orgId.trim() : '';
    if (!orgId || orgId.length > 200) {
      throw new PhysioAiTaskError(400, 'organization_required', 'A valid organisation is required for physiotherapy AI generation.');
    }
    const safeContext = preparePhysioClinicalContext(request.context);
    if (!featureEnabled()) {
      throw new PhysioAiTaskError(503, CLINICAL_AI_DISABLED_CODE, CLINICAL_AI_DISABLED_MESSAGE);
    }
    if (!providerAvailable()) {
      throw new PhysioAiTaskError(503, CLINICAL_AI_UNCONFIGURED_CODE, CLINICAL_AI_UNCONFIGURED_MESSAGE);
    }
    const apiUsage = services.apiUsage;
    if (!apiUsage || ['reserve', 'settle', 'estimateChatMicrousd', 'calculateChatCostMicrousd'].some((method) => typeof apiUsage[method] !== 'function')) {
      throw new PhysioAiTaskError(503, 'api_usage_accounting_unavailable', 'AI usage accounting is temporarily unavailable. Please try again.');
    }

    const prompt = buildPhysioTaskPrompt(taskId, safeContext);
    const selectedProvider = String(providerSelector()).trim().toLowerCase();
    if (!selectedProvider) {
      throw new PhysioAiTaskError(503, CLINICAL_AI_UNCONFIGURED_CODE, CLINICAL_AI_UNCONFIGURED_MESSAGE);
    }
    const selectedModel = modelSelector(prompt, selectedTask.schema);
    let reservation;
    try {
      reservation = await apiUsage.reserve({
        orgId,
        provider: selectedProvider,
        feature: PHYSIO_AI_PROVIDER_FEATURE,
        model: selectedModel,
        estimatedCostMicrousd: apiUsage.estimateChatMicrousd({
          model: selectedModel,
          feature: PHYSIO_AI_PROVIDER_FEATURE,
        }),
      });
    } catch (error) {
      throw asPublicUsageError(error) || new PhysioAiTaskError(
        503,
        'api_usage_accounting_unavailable',
        'AI usage accounting is temporarily unavailable. Please try again.',
        { cause: error },
      );
    }

    let generated;
    let receipt;
    try {
      generated = await invoke({
        prompt,
        schema: selectedTask.schema,
        systemInstructions: PHYSIO_AI_SYSTEM_INSTRUCTIONS,
      });
      receipt = assertProviderReceipt(generated);
      if (receipt.provider.toLowerCase() !== selectedProvider) {
        throw new Error('provider receipt does not match the reserved provider');
      }
      validatePhysioTaskOutput(taskId, generated.value);
    } catch (error) {
      try {
        await apiUsage.settle({ reservationId: reservation.id, status: 'failed' });
      } catch (settlementError) {
        throw asPublicUsageError(settlementError) || new PhysioAiTaskError(
          503,
          'api_usage_accounting_unavailable',
          'AI usage accounting is temporarily unavailable. Please try again.',
          { cause: settlementError },
        );
      }
      throw providerFailure(error);
    }

    let actualCostMicrousd;
    try {
      actualCostMicrousd = apiUsage.calculateChatCostMicrousd({
        model: selectedModel,
        inputTokens: receipt.usage.inputTokens,
        cachedInputTokens: receipt.usage.cachedInputTokens,
        outputTokens: receipt.usage.outputTokens,
      });
    } catch (error) {
      try {
        await apiUsage.settle({ reservationId: reservation.id, status: 'failed' });
      } catch (settlementError) {
        throw asPublicUsageError(settlementError) || new PhysioAiTaskError(
          503,
          'api_usage_accounting_unavailable',
          'AI usage accounting is temporarily unavailable. Please try again.',
          { cause: settlementError },
        );
      }
      throw asPublicUsageError(error) || providerFailure(error);
    }
    if (!Number.isSafeInteger(actualCostMicrousd) || actualCostMicrousd < 0) {
      try {
        await apiUsage.settle({ reservationId: reservation.id, status: 'failed' });
      } catch (settlementError) {
        throw asPublicUsageError(settlementError) || new PhysioAiTaskError(
          503,
          'api_usage_accounting_unavailable',
          'AI usage accounting is temporarily unavailable. Please try again.',
          { cause: settlementError },
        );
      }
      throw providerFailure(new Error('provider usage could not be priced'));
    }

    try {
      await apiUsage.settle({
        reservationId: reservation.id,
        status: 'succeeded',
        actualCostMicrousd,
        inputTokens: receipt.usage.inputTokens,
        cachedInputTokens: receipt.usage.cachedInputTokens,
        outputTokens: receipt.usage.outputTokens,
        providerRequestId: receipt.providerRequestId,
      });
    } catch (error) {
      throw asPublicUsageError(error) || new PhysioAiTaskError(
        503,
        'api_usage_accounting_unavailable',
        'AI usage accounting is temporarily unavailable. Please try again.',
        { cause: error },
      );
    }

    const generatedAt = new Date(now()).toISOString();
    const publicResult = {
      task: taskId,
      task_version: selectedTask.version,
      contract_version: PHYSIO_AI_CONTRACT_VERSION,
      output_state: 'ai_draft_unreviewed',
      clinician_review_required: true,
      output: generated.value,
      provenance: {
        receipt_contract_version: PHYSIO_AI_RECEIPT_CONTRACT_VERSION,
        generated_at: generatedAt,
        provider: receipt.provider,
        model: receipt.model,
        finish_reason: receipt.finishReason,
        provider_status: receipt.providerStatus,
        provider_request_id_hash: createHash('sha256').update(receipt.providerRequestId).digest('hex'),
        provider_http_request_id_hash: createHash('sha256').update(receipt.providerHttpRequestId).digest('hex'),
        output_schema_receipt: {
          schema_sha256: createHash('sha256').update(JSON.stringify(selectedTask.schema)).digest('hex'),
          validator: 'assesssuite-physio-output-schema-validator',
          validator_version: PHYSIO_AI_CONTRACT_VERSION,
          result: 'valid',
        },
        usage: {
          input_tokens: receipt.usage.inputTokens,
          cached_input_tokens: receipt.usage.cachedInputTokens,
          output_tokens: receipt.usage.outputTokens,
          actual_cost_microusd: actualCostMicrousd,
        },
      },
    };
    Object.defineProperty(publicResult, PHYSIO_AI_INTERNAL_RECEIPT, {
      value: Object.freeze({
        usageReservationId: reservation.id,
        providerResponseId: receipt.providerRequestId,
        providerHttpRequestId: receipt.providerHttpRequestId,
      }),
      enumerable: false,
      writable: false,
    });
    return publicResult;
  };
}

export const runPhysioAiTask = createPhysioAiTaskRunner();
