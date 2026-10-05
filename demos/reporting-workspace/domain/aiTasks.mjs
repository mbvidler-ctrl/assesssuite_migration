// Named AI task contract for report section drafting.
//
// This module defines the ONLY route by which model-generated text could
// enter a report draft: a named task with a server-owned input schema, a
// closed output schema, and an explicit provider adapter. The demo workspace
// registers no adapter, so the task fails closed with an explicit
// "unavailable" state. Nothing here fabricates a draft, and nothing here can
// approve or persist content: a validated generation must still pass through
// workflow.applyAiSectionDraft() and clinician review before approval.
//
// The contract mirrors the live physiotherapy task gateway
// (server/physioAiTasks.mjs): reviewed task id, server-built prompt context,
// closed schema validation, provider receipt and content-free provenance.

import { getReportType } from './reportTypes.mjs';
import { WorkflowError, isPlainObject, sha256Canonical } from './util.mjs';

export const REPORT_DRAFT_SECTION_TASK = Object.freeze({
  id: 'report.draft_section.v1',
  version: 'report.draft_section.v1/schema-1.0.0',
  purpose: 'Draft one narrative section of a clinical report from pinned, minimised sources, for clinician review.',
  instructions: Object.freeze([
    'Use only the supplied pinned sources; cite the source id for every claim.',
    'Keep measured findings, reported symptoms and clinical inference distinct.',
    'State uncertainty explicitly; do not invent findings, scores, dates or recommendations.',
    'Do not state that the draft is reviewed, approved, sent or delivered.',
  ]),
  input_schema: Object.freeze({
    type: 'object',
    additionalProperties: false,
    required: ['task', 'report_type', 'section_key', 'section_guidance', 'clinical_questions', 'sources'],
    properties: {
      task: { const: 'report.draft_section.v1' },
      report_type: { type: 'string' },
      section_key: { type: 'string' },
      section_guidance: { type: 'string' },
      clinical_questions: { type: 'array', items: { type: 'string' }, maxItems: 10 },
      sources: {
        type: 'array',
        maxItems: 120,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['source_id', 'category', 'recorded_at', 'content'],
          properties: {
            source_id: { type: 'string' },
            category: { type: 'string' },
            recorded_at: { type: 'string' },
            content: { type: 'object' },
          },
        },
      },
    },
  }),
  output_schema: Object.freeze({
    type: 'object',
    additionalProperties: false,
    required: ['draft_text', 'claims', 'uncertainties', 'clinician_review_questions'],
    properties: {
      draft_text: { type: 'string', minLength: 1, maxLength: 6000 },
      claims: {
        type: 'array',
        maxItems: 40,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'source_ids'],
          properties: {
            text: { type: 'string', minLength: 1, maxLength: 600 },
            source_ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
          },
        },
      },
      uncertainties: { type: 'array', items: { type: 'string', maxLength: 600 }, maxItems: 20 },
      clinician_review_questions: { type: 'array', items: { type: 'string', maxLength: 600 }, maxItems: 20 },
    },
  }),
});

const IDENTIFYING_SOURCE_KEYS = /^(?:display_name|referrer_name|full_name|email|phone|address|date_of_birth)$/i;

function stripIdentity(content) {
  if (Array.isArray(content)) return content.map(stripIdentity);
  if (!isPlainObject(content)) return content;
  const output = {};
  for (const [key, value] of Object.entries(content)) {
    if (IDENTIFYING_SOURCE_KEYS.test(key)) continue;
    output[key] = stripIdentity(value);
  }
  return output;
}

/**
 * Build the server-owned task input. The browser never supplies sources or
 * prompt text; it names a section and the server selects the pinned sources
 * the section may cite. Identity-bearing fields are stripped.
 */
export function buildSectionDraftInput({ request, sourceSet, sectionKey }) {
  const reportType = getReportType(request.report_type);
  if (!reportType) throw new WorkflowError(400, 'unsupported_report_type', 'A supported report type is required.');
  const definition = reportType.sections.find((entry) => entry.key === sectionKey);
  if (!definition || definition.kind !== 'narrative' || !definition.ai_allowed) {
    throw new WorkflowError(400, 'ai_not_allowed_for_section', 'This section does not accept AI-assisted drafts.');
  }
  return {
    task: REPORT_DRAFT_SECTION_TASK.id,
    report_type: request.report_type,
    section_key: sectionKey,
    section_guidance: definition.guidance,
    clinical_questions: [...request.clinical_questions],
    sources: sourceSet.items
      .filter((entry) => entry.category !== 'client_summary' && entry.category !== 'document')
      .map((entry) => ({
        source_id: entry.source_id,
        category: entry.category,
        recorded_at: entry.recorded_at,
        content: stripIdentity(entry.content),
      })),
  };
}

function checkSchema(schema, value, path) {
  if (schema.const !== undefined) {
    if (value !== schema.const) throw new Error(`${path} must equal ${schema.const}`);
    return;
  }
  switch (schema.type) {
    case 'object': {
      if (!isPlainObject(value)) throw new Error(`${path} must be an object`);
      for (const key of schema.required || []) {
        if (!Object.hasOwn(value, key)) throw new Error(`${path}.${key} is required`);
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!Object.hasOwn(schema.properties || {}, key)) throw new Error(`${path}.${key} is not allowed`);
        }
      }
      for (const [key, child] of Object.entries(schema.properties || {})) {
        if (Object.hasOwn(value, key)) checkSchema(child, value[key], `${path}.${key}`);
      }
      return;
    }
    case 'array': {
      if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new Error(`${path} has too many items`);
      if (schema.minItems !== undefined && value.length < schema.minItems) throw new Error(`${path} has too few items`);
      value.forEach((entry, index) => checkSchema(schema.items, entry, `${path}[${index}]`));
      return;
    }
    case 'string': {
      if (typeof value !== 'string') throw new Error(`${path} must be a string`);
      if (schema.minLength !== undefined && value.trim().length < schema.minLength) throw new Error(`${path} must not be empty`);
      if (schema.maxLength !== undefined && value.length > schema.maxLength) throw new Error(`${path} is too long`);
      return;
    }
    default:
      throw new Error(`${path} has an unsupported schema type`);
  }
}

export function validateTaskInput(input) {
  try {
    checkSchema(REPORT_DRAFT_SECTION_TASK.input_schema, input, 'input');
  } catch (error) {
    throw new WorkflowError(400, 'ai_input_schema_invalid', `The task input is invalid: ${error.message}.`);
  }
  return input;
}

export function validateTaskOutput(output) {
  try {
    checkSchema(REPORT_DRAFT_SECTION_TASK.output_schema, output, 'output');
  } catch (error) {
    throw new WorkflowError(422, 'ai_output_schema_invalid', `The generated draft did not conform to the task schema: ${error.message}.`);
  }
  return output;
}

/**
 * Create the task runner. Without an adapter the runner fails closed: it
 * throws an explicit 503 and never fabricates a draft. With an adapter (a
 * test double or a real, separately governed provider gateway) it validates
 * the receipt and output before returning an unreviewed generation.
 */
export function createSectionDraftTask({ adapter = null, now = () => new Date().toISOString(), idFactory = null } = {}) {
  return async function runSectionDraft({ request, sourceSet, sectionKey }) {
    const input = validateTaskInput(buildSectionDraftInput({ request, sourceSet, sectionKey }));
    if (typeof adapter !== 'function') {
      throw new WorkflowError(
        503,
        'ai_drafting_unavailable',
        'AI drafting is not configured in this workspace. No provider request was made and no draft was generated.',
        { task: REPORT_DRAFT_SECTION_TASK.id, task_version: REPORT_DRAFT_SECTION_TASK.version },
      );
    }
    const generated = await adapter(input);
    if (!isPlainObject(generated) || !isPlainObject(generated.receipt) || typeof generated.receipt.provider !== 'string' || typeof generated.receipt.model !== 'string' || generated.receipt.finish_reason !== 'stop') {
      throw new WorkflowError(502, 'ai_provider_receipt_incomplete', 'The provider returned an incomplete generation receipt. No draft was accepted.');
    }
    const output = validateTaskOutput(generated.output);
    const pinned = new Set(sourceSet.items.map((entry) => entry.source_id));
    const unpinned = output.claims.flatMap((claim) => claim.source_ids).filter((sourceId) => !pinned.has(sourceId));
    if (unpinned.length > 0) {
      throw new WorkflowError(422, 'ai_claim_source_not_pinned', `The generated draft cites sources that are not pinned: ${[...new Set(unpinned)].join(', ')}.`);
    }
    const generatedAt = now();
    return {
      generation_id: idFactory ? idFactory('gen') : `gen-${sha256Canonical({ input, generatedAt }).slice(0, 16)}`,
      task: REPORT_DRAFT_SECTION_TASK.id,
      task_version: REPORT_DRAFT_SECTION_TASK.version,
      output_state: 'ai_draft_unreviewed',
      clinician_review_required: true,
      output,
      provenance: {
        generated_at: generatedAt,
        provider: generated.receipt.provider,
        model: generated.receipt.model,
        finish_reason: generated.receipt.finish_reason,
        input_sha256: sha256Canonical(input),
        output_schema_sha256: sha256Canonical(REPORT_DRAFT_SECTION_TASK.output_schema),
        validator: 'assesssuite-reporting-demo-schema-validator',
      },
    };
  };
}
