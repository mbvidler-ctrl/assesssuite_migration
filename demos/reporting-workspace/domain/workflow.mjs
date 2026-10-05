// Reporting workflow: the OutputRequest aggregate and its commands.
//
// Every command is a pure function of (current request, payload, context)
// that returns the next request state (and, for approval, an immutable
// DocumentSnapshot). Commands never mutate their input. Persistence, role
// admission and clocks live in the service layer; this module enforces the
// domain invariants:
//
//   1. Every formal output begins with an OutputRequest.
//   2. Completeness is requirement-based and visible.
//   3. A SourceSet pins its sources; a refresh is explicit, never silent.
//   4. Facts render deterministically from structured data and are not
//      editable as free text.
//   5. An approved snapshot is immutable; a correction creates a successor
//      snapshot linked to its predecessor.
//   6. AI-assisted narrative stays labelled and cannot be approved unreviewed.

import {
  APPROVED_STATUSES,
  EDITABLE_STATUSES,
  RECIPIENT_ROLES,
  REQUEST_STATUSES as S,
  REVIEW_STATES,
  SECTION_ORIGINS,
  GENERATOR_VERSION,
  getReportType,
} from './reportTypes.mjs';
import { assessCompleteness } from './evidence.mjs';
import { detectSourceChanges, pinSourceSet } from './sourceSet.mjs';
import { buildDocumentModel, generateFactSections, renderDocumentHtml } from './render.mjs';
import {
  WorkflowError,
  assertKnownKeys,
  clone,
  isPlainObject,
  optionalString,
  requireDate,
  requireString,
  requireStringArray,
  sha256Canonical,
} from './util.mjs';

const MAX_PROCESSED_COMMANDS = 50;
const NARRATIVE_MAX = 12_000;

function fail(status, code, message, detail) {
  throw new WorkflowError(status, code, message, detail);
}

function requireContext(ctx) {
  if (!ctx || typeof ctx.now !== 'string' || typeof ctx.idFactory !== 'function' || !ctx.actor?.user_id) {
    fail(500, 'workflow_context_invalid', 'The workflow context must supply now, idFactory and an actor.');
  }
  return ctx;
}

function appendHistory(request, { event, from, to, actor, at, detail = undefined }) {
  const sequence = request.history.length + 1;
  request.history.push({
    sequence,
    event,
    from_status: from,
    to_status: to,
    actor_user_id: actor.user_id,
    actor_name: actor.display_name || actor.user_id,
    occurred_at: at,
    ...(detail !== undefined ? { detail } : {}),
  });
}

function currentSourceSet(request) {
  const set = request.source_sets.find((entry) => entry.id === request.current_source_set_id);
  if (!set) fail(409, 'source_set_required', 'Assemble evidence before drafting this report.');
  return set;
}

function currentRevision(request) {
  const revision = request.draft_revisions.find((entry) => entry.id === request.current_revision_id);
  if (!revision) fail(409, 'draft_required', 'Start a draft before performing this action.');
  return revision;
}

function assertStatus(request, allowed, action) {
  if (!allowed.includes(request.status)) {
    fail(409, 'invalid_status_transition', `Cannot ${action} while the request is ${request.status.replace(/_/g, ' ')}.`, {
      status: request.status,
      allowed,
    });
  }
}

function assertExpectedVersion(request, payload) {
  if (payload.expected_version === undefined || payload.expected_version === null) {
    fail(400, 'expected_version_required', 'Reload the report request before changing it.');
  }
  if (Number(payload.expected_version) !== request.version) {
    fail(409, 'request_changed', 'The report request changed; reload before saving.', {
      expected_version: payload.expected_version,
      current_version: request.version,
    });
  }
}

function bump(request, at) {
  request.version += 1;
  request.updated_at = at;
}

function buildSections({ reportType, sourceSet, request, completeness, existing = null }) {
  const narrativeSeed = new Map((existing || []).map((section) => [section.key, section]));
  const preliminary = reportType.sections.map((definition) => {
    if (definition.kind === 'facts') {
      return { key: definition.key, title: definition.title, kind: 'facts', origin: SECTION_ORIGINS.facts, blocks: [], source_refs: [], review_state: REVIEW_STATES.reviewed, not_applicable_reason: '', ai_attribution: null, required: definition.required };
    }
    const prior = narrativeSeed.get(definition.key);
    if (prior) {
      return { ...clone(prior), title: definition.title, required: definition.required };
    }
    return {
      key: definition.key,
      title: definition.title,
      kind: 'narrative',
      origin: SECTION_ORIGINS.clinician,
      text: '',
      source_refs: [],
      review_state: REVIEW_STATES.notStarted,
      not_applicable_reason: '',
      ai_attribution: null,
      required: definition.required,
      refresh_note: '',
    };
  });
  const facts = generateFactSections({ reportTypeId: reportType.id, sourceSet, request, completeness, sections: preliminary });
  return preliminary.map((section) => (section.kind === 'facts'
    ? { ...section, blocks: facts[section.key].blocks, source_refs: facts[section.key].source_refs }
    : section));
}

function newRevision(request, { sourceSet, sections, ctx, basedOnRevisionId = null, basedOnSnapshotId = null, refreshDiff = null, amendment = null }) {
  const revisionNumber = request.draft_revisions.length + 1;
  return {
    id: ctx.idFactory('rev'),
    revision_number: revisionNumber,
    source_set_id: sourceSet.id,
    source_set_version: sourceSet.version,
    based_on_revision_id: basedOnRevisionId,
    based_on_snapshot_id: basedOnSnapshotId,
    author_user_id: ctx.actor.user_id,
    author_name: ctx.actor.display_name || ctx.actor.user_id,
    created_at: ctx.now,
    review_note: '',
    refresh_diff: refreshDiff,
    amendment,
    approved_snapshot_id: null,
    sections,
  };
}

function commitRevision(request, revision) {
  request.draft_revisions.push(revision);
  request.current_revision_id = revision.id;
  return revision;
}

function recordCommand(request, commandId, fingerprint) {
  if (!commandId) return;
  request.processed_commands.push({ command_id: commandId, fingerprint, result_version: request.version });
  if (request.processed_commands.length > MAX_PROCESSED_COMMANDS) {
    request.processed_commands.splice(0, request.processed_commands.length - MAX_PROCESSED_COMMANDS);
  }
}

function replayIfProcessed(request, command, payload) {
  const commandId = typeof payload.command_id === 'string' && payload.command_id.trim() ? payload.command_id.trim() : '';
  if (!commandId) return { commandId: '', fingerprint: '', replay: null };
  const { command_id: _omit, expected_version: _version, ...rest } = payload;
  const fingerprint = sha256Canonical({ command, payload: rest });
  const processed = request.processed_commands.find((entry) => entry.command_id === commandId);
  if (processed) {
    if (processed.fingerprint !== fingerprint) {
      fail(409, 'command_conflict', 'This command id was already used for a different command.');
    }
    return { commandId, fingerprint, replay: { request, replayed: true } };
  }
  return { commandId, fingerprint, replay: null };
}

function validateRecipient(recipient) {
  if (!isPlainObject(recipient)) fail(400, 'invalid_request', 'A recipient is required.');
  assertKnownKeys(recipient, new Set(['name', 'role', 'organisation', 'channel']), 'recipient');
  const role = requireString(recipient.role, 'recipient.role', { max: 60 });
  if (!RECIPIENT_ROLES.includes(role)) fail(400, 'invalid_request', `recipient.role must be one of: ${RECIPIENT_ROLES.join(', ')}.`);
  return {
    name: requireString(recipient.name, 'recipient.name', { max: 200 }),
    role,
    organisation: optionalString(recipient.organisation, 'recipient.organisation', { max: 200 }),
    channel: optionalString(recipient.channel, 'recipient.channel', { max: 60 }) || 'not_specified',
  };
}

const CREATE_KEYS = new Set([
  'command_id', 'org_id', 'client_id', 'physio_care_episode_id', 'report_type', 'purpose', 'recipient',
  'clinical_questions', 'owner_user_id', 'due_date', 'required_evidence',
]);

/**
 * Create an OutputRequest. The caller has already proven that the episode
 * belongs to the organisation and to the client, and that the owner is a
 * member of the organisation.
 */
export function createOutputRequest(payload, ctx) {
  requireContext(ctx);
  assertKnownKeys(payload, CREATE_KEYS, 'create');
  const reportType = getReportType(payload.report_type);
  if (!reportType) fail(400, 'unsupported_report_type', 'A supported report type is required.');
  const requiredEvidence = requireStringArray(payload.required_evidence, 'required_evidence', { maxItems: 20, maxLength: 60 });
  const unknownRequirement = requiredEvidence.filter((key) => !reportType.requirements.includes(key));
  if (unknownRequirement.length > 0) {
    fail(400, 'invalid_request', `required_evidence contains requirements this report type does not use: ${unknownRequirement.join(', ')}.`);
  }
  const request = {
    id: ctx.idFactory('req'),
    org_id: requireString(payload.org_id, 'org_id', { max: 200 }),
    client_id: requireString(payload.client_id, 'client_id', { max: 200 }),
    physio_care_episode_id: requireString(payload.physio_care_episode_id, 'physio_care_episode_id', { max: 200 }),
    report_type: reportType.id,
    template_version: reportType.template_version,
    generator_version: GENERATOR_VERSION,
    purpose: requireString(payload.purpose, 'purpose', { max: 600 }),
    recipient: validateRecipient(payload.recipient),
    clinical_questions: requireStringArray(payload.clinical_questions, 'clinical_questions', { maxItems: 10, maxLength: 500 }),
    owner_user_id: requireString(payload.owner_user_id, 'owner_user_id', { max: 200 }),
    requested_by_user_id: ctx.actor.user_id,
    due_date: requireDate(payload.due_date, 'due_date'),
    required_evidence: requiredEvidence.length ? requiredEvidence : [...reportType.requirements],
    status: S.requested,
    version: 1,
    completeness: null,
    source_sets: [],
    current_source_set_id: null,
    draft_revisions: [],
    current_revision_id: null,
    snapshot_ids: [],
    current_snapshot_id: null,
    snapshot_chain: [],
    delivery_events: [],
    export_events: [],
    cancellation: null,
    history: [],
    processed_commands: [],
    created_at: ctx.now,
    updated_at: ctx.now,
    created_by: ctx.actor.user_id,
  };
  appendHistory(request, { event: 'request_created', from: null, to: S.requested, actor: ctx.actor, at: ctx.now });
  if (typeof payload.command_id === 'string' && payload.command_id.trim()) {
    const { command_id: _omit, ...rest } = payload;
    recordCommand(request, payload.command_id.trim(), sha256Canonical({ command: 'createOutputRequest', payload: rest }));
  }
  return request;
}

const MUTATING_KEYS = {
  assembleEvidence: new Set(['command_id', 'expected_version', 'source_ids']),
  startDraft: new Set(['command_id', 'expected_version']),
  saveDraft: new Set(['command_id', 'expected_version', 'sections', 'review_note']),
  importAiDraftSection: new Set(['command_id', 'expected_version', 'section_key', 'source_id', 'field']),
  applyAiSectionDraft: new Set(['command_id', 'expected_version', 'section_key', 'generation']),
  submitForReview: new Set(['command_id', 'expected_version', 'note']),
  approve: new Set(['command_id', 'expected_version', 'acknowledge_stale_sources', 'approval_note']),
  refreshSources: new Set(['command_id', 'expected_version', 'source_ids']),
  openAmendment: new Set(['command_id', 'expected_version', 'reason']),
  recordDelivery: new Set(['command_id', 'expected_version', 'channel', 'recipient_note']),
  cancel: new Set(['command_id', 'expected_version', 'reason']),
};

function begin(request, command, payload, ctx) {
  requireContext(ctx);
  assertKnownKeys(payload, MUTATING_KEYS[command], command);
  const { commandId, fingerprint, replay } = replayIfProcessed(request, command, payload);
  if (replay) return { replay, commandId, fingerprint, next: null };
  assertExpectedVersion(request, payload);
  return { replay: null, commandId, fingerprint, next: clone(request) };
}

function finish(next, commandId, fingerprint, ctx, extra = {}) {
  bump(next, ctx.now);
  recordCommand(next, commandId, fingerprint);
  return { request: next, replayed: false, ...extra };
}

export function assembleEvidence(request, payload, ctx) {
  const { replay, commandId, fingerprint, next } = begin(request, 'assembleEvidence', payload, ctx);
  if (replay) return replay;
  assertStatus(next, [S.requested, S.assemblingEvidence], 'assemble evidence');
  if (!ctx.catalogue) fail(500, 'workflow_context_invalid', 'An evidence catalogue is required to assemble evidence.');
  const sourceIds = payload.source_ids === undefined ? null : requireStringArray(payload.source_ids, 'source_ids', { maxItems: 500, maxLength: 300 });
  const sourceSet = pinSourceSet({
    catalogue: ctx.catalogue,
    reportTypeId: next.report_type,
    sourceIds,
    version: next.source_sets.length + 1,
    id: ctx.idFactory('src'),
    createdAt: ctx.now,
    createdBy: ctx.actor.user_id,
  });
  next.source_sets.push(sourceSet);
  next.current_source_set_id = sourceSet.id;
  next.completeness = {
    ...assessCompleteness({ reportTypeId: next.report_type, catalogue: ctx.catalogue, clinicalQuestions: next.clinical_questions }),
    assessed_at: ctx.now,
    source_set_id: sourceSet.id,
  };
  const from = next.status;
  next.status = S.assemblingEvidence;
  appendHistory(next, { event: 'evidence_assembled', from, to: next.status, actor: ctx.actor, at: ctx.now, detail: { source_set_id: sourceSet.id, version: sourceSet.version, sources: sourceSet.items.length, blocking_gaps: next.completeness.blocking_gaps } });
  return finish(next, commandId, fingerprint, ctx);
}

export function startDraft(request, payload, ctx) {
  const { replay, commandId, fingerprint, next } = begin(request, 'startDraft', payload, ctx);
  if (replay) return replay;
  assertStatus(next, [S.assemblingEvidence], 'start a draft');
  const reportType = getReportType(next.report_type);
  const sourceSet = currentSourceSet(next);
  const sections = buildSections({ reportType, sourceSet, request: next, completeness: next.completeness });
  const revision = commitRevision(next, newRevision(next, { sourceSet, sections, ctx }));
  const from = next.status;
  next.status = S.draft;
  appendHistory(next, { event: 'draft_started', from, to: next.status, actor: ctx.actor, at: ctx.now, detail: { revision_id: revision.id, revision_number: revision.revision_number } });
  return finish(next, commandId, fingerprint, ctx);
}

function applyNarrativeUpdates(revision, updates, reportType) {
  if (!Array.isArray(updates)) fail(400, 'invalid_request', 'sections must be a list of section updates.');
  if (updates.length > reportType.sections.length) fail(400, 'invalid_request', 'Too many section updates.');
  const seen = new Set();
  for (const update of updates) {
    assertKnownKeys(update, new Set(['key', 'text', 'review_state', 'not_applicable_reason']), 'section update');
    const key = requireString(update.key, 'section.key', { max: 80 });
    if (seen.has(key)) fail(400, 'invalid_request', `Section ${key} appears more than once.`);
    seen.add(key);
    const definition = reportType.sections.find((entry) => entry.key === key);
    if (!definition) fail(400, 'unknown_section', `Section ${key} does not exist in this report type.`);
    if (definition.kind === 'facts') {
      fail(400, 'facts_not_editable', `Section ${key} is generated from pinned sources and cannot be edited as free text. Refresh the sources instead.`);
    }
    const section = revision.sections.find((entry) => entry.key === key);
    if (update.text !== undefined) {
      const nextText = optionalString(update.text, `section.${key}.text`, { max: NARRATIVE_MAX });
      if (section.origin === SECTION_ORIGINS.aiAssisted && nextText !== section.text) {
        section.ai_attribution = { ...(section.ai_attribution || {}), edited_after_import: true };
      }
      section.text = nextText;
      if (section.origin === SECTION_ORIGINS.clinician) {
        section.review_state = nextText ? REVIEW_STATES.inProgress : REVIEW_STATES.notStarted;
      } else if (section.review_state === REVIEW_STATES.reviewed) {
        section.review_state = REVIEW_STATES.inProgress;
      }
    }
    if (update.not_applicable_reason !== undefined) {
      section.not_applicable_reason = optionalString(update.not_applicable_reason, `section.${key}.not_applicable_reason`, { max: 500 });
    }
    if (update.review_state !== undefined) {
      const state = requireString(update.review_state, `section.${key}.review_state`, { max: 40 });
      if (!Object.values(REVIEW_STATES).includes(state)) fail(400, 'invalid_request', `Unsupported review_state ${state}.`);
      if (state === REVIEW_STATES.notApplicable) {
        if (definition.required && !section.not_applicable_reason) {
          fail(400, 'not_applicable_reason_required', `A reason is required to mark ${definition.title} as not applicable.`);
        }
      }
      if (state === REVIEW_STATES.reviewed && section.origin !== SECTION_ORIGINS.aiAssisted && !section.text) {
        fail(400, 'invalid_request', `Section ${key} cannot be marked reviewed while empty.`);
      }
      section.review_state = state;
    }
  }
}

export function saveDraft(request, payload, ctx) {
  const { replay, commandId, fingerprint, next } = begin(request, 'saveDraft', payload, ctx);
  if (replay) return replay;
  if (APPROVED_STATUSES.includes(next.status)) {
    fail(409, 'approved_snapshot_immutable', 'This report is approved. Open an amendment to make a correction.');
  }
  assertStatus(next, EDITABLE_STATUSES, 'save the draft');
  const reportType = getReportType(next.report_type);
  const sourceSet = currentSourceSet(next);
  const base = currentRevision(next);
  const revision = newRevision(next, { sourceSet, sections: clone(base.sections), ctx, basedOnRevisionId: base.id, basedOnSnapshotId: base.based_on_snapshot_id, amendment: base.amendment ? clone(base.amendment) : null });
  applyNarrativeUpdates(revision, payload.sections || [], reportType);
  revision.review_note = optionalString(payload.review_note, 'review_note', { max: 2000 });
  const facts = generateFactSections({ reportTypeId: reportType.id, sourceSet, request: next, completeness: next.completeness, sections: revision.sections });
  for (const section of revision.sections) {
    if (section.kind === 'facts') {
      section.blocks = facts[section.key].blocks;
      section.source_refs = facts[section.key].source_refs;
    }
  }
  commitRevision(next, revision);
  const from = next.status;
  if (next.status === S.needsReview) next.status = S.draft;
  appendHistory(next, { event: 'draft_saved', from, to: next.status, actor: ctx.actor, at: ctx.now, detail: { revision_id: revision.id, revision_number: revision.revision_number } });
  return finish(next, commandId, fingerprint, ctx);
}

export function importAiDraftSection(request, payload, ctx) {
  const { replay, commandId, fingerprint, next } = begin(request, 'importAiDraftSection', payload, ctx);
  if (replay) return replay;
  if (APPROVED_STATUSES.includes(next.status)) {
    fail(409, 'approved_snapshot_immutable', 'This report is approved. Open an amendment to make a correction.');
  }
  assertStatus(next, EDITABLE_STATUSES, 'import an AI-assisted draft');
  const reportType = getReportType(next.report_type);
  const sectionKey = requireString(payload.section_key, 'section_key', { max: 80 });
  const definition = reportType.sections.find((entry) => entry.key === sectionKey);
  if (!definition) fail(400, 'unknown_section', `Section ${sectionKey} does not exist in this report type.`);
  if (definition.kind !== 'narrative' || !definition.ai_allowed) {
    fail(400, 'ai_not_allowed_for_section', `Section ${definition.title} does not accept AI-assisted drafts.`);
  }
  const sourceSet = currentSourceSet(next);
  const sourceId = requireString(payload.source_id, 'source_id', { max: 300 });
  const source = sourceSet.items.find((entry) => entry.source_id === sourceId);
  if (!source) fail(400, 'source_not_pinned', 'The AI-assisted draft must be a pinned source of this report.');
  if (source.category !== 'prior_report' || !source.ai_assisted) {
    fail(400, 'source_not_ai_draft', 'Only a pinned AI-assisted draft can be imported as an AI-assisted section.');
  }
  const field = requireString(payload.field, 'field', { max: 120 });
  const imported = source.content.section_content?.[field];
  if (typeof imported !== 'string' || !imported.trim()) {
    fail(400, 'ai_draft_field_missing', `The pinned AI-assisted draft has no text for field ${field}.`);
  }
  const base = currentRevision(next);
  const revision = newRevision(next, { sourceSet, sections: clone(base.sections), ctx, basedOnRevisionId: base.id, basedOnSnapshotId: base.based_on_snapshot_id, amendment: base.amendment ? clone(base.amendment) : null });
  const section = revision.sections.find((entry) => entry.key === sectionKey);
  section.origin = SECTION_ORIGINS.aiAssisted;
  section.text = imported.trim();
  section.review_state = REVIEW_STATES.inProgress;
  section.source_refs = [...new Set([...(section.source_refs || []), sourceId])];
  section.ai_attribution = {
    ...(source.ai_attribution || {}),
    source_id: sourceId,
    source_record_id: source.record_id,
    field,
    imported_at: ctx.now,
    imported_by: ctx.actor.user_id,
    edited_after_import: false,
  };
  commitRevision(next, revision);
  const from = next.status;
  if (next.status === S.needsReview) next.status = S.draft;
  appendHistory(next, { event: 'ai_draft_imported', from, to: next.status, actor: ctx.actor, at: ctx.now, detail: { revision_id: revision.id, section_key: sectionKey, source_id: sourceId, field } });
  return finish(next, commandId, fingerprint, ctx);
}

/**
 * Apply a server-produced named-task generation to a narrative section.
 * Internal: only the service may call this with a validated task result.
 */
export function applyAiSectionDraft(request, payload, ctx) {
  const { replay, commandId, fingerprint, next } = begin(request, 'applyAiSectionDraft', payload, ctx);
  if (replay) return replay;
  if (APPROVED_STATUSES.includes(next.status)) {
    fail(409, 'approved_snapshot_immutable', 'This report is approved. Open an amendment to make a correction.');
  }
  assertStatus(next, EDITABLE_STATUSES, 'apply an AI-assisted draft');
  const reportType = getReportType(next.report_type);
  const sectionKey = requireString(payload.section_key, 'section_key', { max: 80 });
  const definition = reportType.sections.find((entry) => entry.key === sectionKey);
  if (!definition) fail(400, 'unknown_section', `Section ${sectionKey} does not exist in this report type.`);
  if (definition.kind !== 'narrative' || !definition.ai_allowed) {
    fail(400, 'ai_not_allowed_for_section', `Section ${definition.title} does not accept AI-assisted drafts.`);
  }
  const generation = payload.generation;
  if (!isPlainObject(generation) || generation.output_state !== 'ai_draft_unreviewed' || !isPlainObject(generation.output) || typeof generation.output.draft_text !== 'string') {
    fail(400, 'invalid_generation', 'A validated, unreviewed named-task generation is required.');
  }
  const sourceSet = currentSourceSet(next);
  const pinned = new Set(sourceSet.items.map((entry) => entry.source_id));
  const claimedSources = [...new Set((generation.output.claims || []).flatMap((claim) => claim.source_ids || []))];
  const unpinned = claimedSources.filter((sourceId) => !pinned.has(sourceId));
  if (unpinned.length > 0) {
    fail(422, 'ai_claim_source_not_pinned', `The generation cites sources that are not pinned: ${unpinned.join(', ')}.`);
  }
  const base = currentRevision(next);
  const revision = newRevision(next, { sourceSet, sections: clone(base.sections), ctx, basedOnRevisionId: base.id, basedOnSnapshotId: base.based_on_snapshot_id, amendment: base.amendment ? clone(base.amendment) : null });
  const section = revision.sections.find((entry) => entry.key === sectionKey);
  section.origin = SECTION_ORIGINS.aiAssisted;
  section.text = generation.output.draft_text.trim();
  section.review_state = REVIEW_STATES.inProgress;
  section.source_refs = claimedSources;
  section.ai_attribution = {
    generation_id: generation.generation_id,
    task_type: generation.task,
    task_version: generation.task_version,
    model: generation.provenance?.model || '',
    provider: generation.provenance?.provider || '',
    generated_at: generation.provenance?.generated_at || '',
    source_output_sha256: sha256Canonical(generation.output),
    claims: clone(generation.output.claims || []),
    uncertainties: clone(generation.output.uncertainties || []),
    imported_at: ctx.now,
    imported_by: ctx.actor.user_id,
    edited_after_import: false,
  };
  commitRevision(next, revision);
  const from = next.status;
  if (next.status === S.needsReview) next.status = S.draft;
  appendHistory(next, { event: 'ai_section_drafted', from, to: next.status, actor: ctx.actor, at: ctx.now, detail: { revision_id: revision.id, section_key: sectionKey, generation_id: generation.generation_id } });
  return finish(next, commandId, fingerprint, ctx);
}

function assertReadyForReview(revision, reportType) {
  const problems = [];
  for (const definition of reportType.sections) {
    if (definition.kind !== 'narrative' || !definition.required) continue;
    const section = revision.sections.find((entry) => entry.key === definition.key);
    if (section.review_state === REVIEW_STATES.notApplicable) continue;
    if (!section.text) problems.push(`${definition.title} is empty`);
  }
  if (problems.length > 0) {
    fail(409, 'draft_incomplete', `The draft is not ready for review: ${problems.join('; ')}.`, { problems });
  }
}

export function submitForReview(request, payload, ctx) {
  const { replay, commandId, fingerprint, next } = begin(request, 'submitForReview', payload, ctx);
  if (replay) return replay;
  assertStatus(next, [S.draft, S.amendmentInProgress], 'submit for review');
  const reportType = getReportType(next.report_type);
  const revision = currentRevision(next);
  assertReadyForReview(revision, reportType);
  revision.review_note = optionalString(payload.note, 'note', { max: 2000 }) || revision.review_note;
  const from = next.status;
  next.status = S.needsReview;
  appendHistory(next, { event: 'submitted_for_review', from, to: next.status, actor: ctx.actor, at: ctx.now, detail: { revision_id: revision.id } });
  return finish(next, commandId, fingerprint, ctx);
}

export function approve(request, payload, ctx) {
  const { replay, commandId, fingerprint, next } = begin(request, 'approve', payload, ctx);
  if (replay) return replay;
  assertStatus(next, [S.needsReview], 'approve');
  if (!ctx.catalogue) fail(500, 'workflow_context_invalid', 'The current evidence catalogue is required to approve.');
  const reportType = getReportType(next.report_type);
  const revision = currentRevision(next);
  const sourceSet = currentSourceSet(next);
  assertReadyForReview(revision, reportType);
  const unreviewedAi = revision.sections.filter((section) => section.origin === SECTION_ORIGINS.aiAssisted && section.review_state !== REVIEW_STATES.reviewed && section.review_state !== REVIEW_STATES.notApplicable);
  if (unreviewedAi.length > 0) {
    fail(409, 'ai_sections_unreviewed', `AI-assisted sections must be reviewed before approval: ${unreviewedAi.map((section) => section.title).join('; ')}.`, { sections: unreviewedAi.map((section) => section.key) });
  }
  const changes = detectSourceChanges({ sourceSet, catalogue: ctx.catalogue, reportTypeId: next.report_type });
  const acknowledge = payload.acknowledge_stale_sources === true;
  if (changes.is_stale && !acknowledge) {
    fail(409, 'sources_changed', 'Source records changed after this draft was pinned. Refresh the sources, or approve explicitly as at the pinned sources.', changes);
  }
  const snapshotId = ctx.idFactory('snap');
  const supersedes = revision.amendment?.supersedes_snapshot_id || null;
  const contentSha256 = sha256Canonical({
    request_id: next.id,
    report_type: next.report_type,
    template_version: next.template_version,
    generator_version: GENERATOR_VERSION,
    revision_id: revision.id,
    sections: revision.sections,
    source_set_id: sourceSet.id,
    manifest_sha256: sourceSet.manifest_sha256,
    supersedes_snapshot_id: supersedes,
  });
  const approval = {
    approved_by_user_id: ctx.actor.user_id,
    approved_by_name: ctx.actor.display_name || ctx.actor.user_id,
    approved_at: ctx.now,
    snapshot_id: snapshotId,
    content_sha256: contentSha256,
    note: optionalString(payload.approval_note, 'approval_note', { max: 2000 }),
  };
  const model = buildDocumentModel({
    reportTypeId: next.report_type,
    request: next,
    sections: revision.sections,
    sourceSet,
    completeness: next.completeness,
    meta: {
      document_state: supersedes ? 'APPROVED — AMENDED OUTPUT' : 'APPROVED',
      approval,
      amendment: revision.amendment ? { reason: revision.amendment.reason, supersedes_snapshot_id: supersedes } : null,
      stale_sources_acknowledged: changes.is_stale && acknowledge,
      owner_name: ctx.ownerName || next.owner_user_id,
      synthetic: ctx.synthetic === true,
    },
  });
  const renderedHtml = renderDocumentHtml(model);
  const snapshot = {
    id: snapshotId,
    sequence: next.snapshot_ids.length + 1,
    request_id: next.id,
    org_id: next.org_id,
    client_id: next.client_id,
    physio_care_episode_id: next.physio_care_episode_id,
    report_type: next.report_type,
    template_version: next.template_version,
    generator_version: GENERATOR_VERSION,
    revision_id: revision.id,
    revision_number: revision.revision_number,
    source_set_id: sourceSet.id,
    source_set_version: sourceSet.version,
    source_set: clone(sourceSet),
    sections: clone(revision.sections),
    document_model: model,
    rendered_html: renderedHtml,
    content_sha256: contentSha256,
    document_sha256: sha256Canonical(renderedHtml),
    manifest_sha256: sourceSet.manifest_sha256,
    approved_by_user_id: approval.approved_by_user_id,
    approved_by_name: approval.approved_by_name,
    approved_at: approval.approved_at,
    approval_note: approval.note,
    stale_sources_acknowledged: changes.is_stale && acknowledge,
    staleness_at_approval: changes.is_stale ? clone(changes) : null,
    supersedes_snapshot_id: supersedes,
    amendment: revision.amendment ? clone(revision.amendment) : null,
    created_at: ctx.now,
  };
  revision.approved_snapshot_id = snapshotId;
  next.snapshot_ids.push(snapshotId);
  next.current_snapshot_id = snapshotId;
  if (supersedes) {
    const predecessor = next.snapshot_chain.find((entry) => entry.snapshot_id === supersedes);
    if (predecessor) {
      predecessor.superseded_by_snapshot_id = snapshotId;
      predecessor.superseded_at = ctx.now;
      predecessor.supersession_reason = revision.amendment.reason;
    }
  }
  next.snapshot_chain.push({
    snapshot_id: snapshotId,
    sequence: snapshot.sequence,
    approved_at: ctx.now,
    supersedes_snapshot_id: supersedes,
    superseded_by_snapshot_id: null,
    superseded_at: null,
    supersession_reason: null,
  });
  const from = next.status;
  next.status = S.approved;
  appendHistory(next, { event: supersedes ? 'amendment_approved' : 'approved', from, to: next.status, actor: ctx.actor, at: ctx.now, detail: { snapshot_id: snapshotId, revision_id: revision.id, content_sha256: contentSha256, supersedes_snapshot_id: supersedes, stale_sources_acknowledged: snapshot.stale_sources_acknowledged } });
  return finish(next, commandId, fingerprint, ctx, { snapshot });
}

export function refreshSources(request, payload, ctx) {
  const { replay, commandId, fingerprint, next } = begin(request, 'refreshSources', payload, ctx);
  if (replay) return replay;
  if (APPROVED_STATUSES.includes(next.status)) {
    fail(409, 'approved_snapshot_immutable', 'This report is approved. Open an amendment before refreshing its sources.');
  }
  assertStatus(next, EDITABLE_STATUSES, 'refresh sources');
  if (!ctx.catalogue) fail(500, 'workflow_context_invalid', 'An evidence catalogue is required to refresh sources.');
  const reportType = getReportType(next.report_type);
  const previous = currentSourceSet(next);
  const changes = detectSourceChanges({ sourceSet: previous, catalogue: ctx.catalogue, reportTypeId: next.report_type });
  const explicitSelection = payload.source_ids !== undefined;
  if (!changes.is_stale && !explicitSelection) {
    fail(409, 'sources_unchanged', 'The pinned sources match the current records; there is nothing to refresh.');
  }
  const sourceIds = explicitSelection ? requireStringArray(payload.source_ids, 'source_ids', { maxItems: 500, maxLength: 300 }) : null;
  const sourceSet = pinSourceSet({
    catalogue: ctx.catalogue,
    reportTypeId: next.report_type,
    sourceIds,
    version: next.source_sets.length + 1,
    id: ctx.idFactory('src'),
    createdAt: ctx.now,
    createdBy: ctx.actor.user_id,
  });
  next.source_sets.push(sourceSet);
  next.current_source_set_id = sourceSet.id;
  next.completeness = {
    ...assessCompleteness({ reportTypeId: next.report_type, catalogue: ctx.catalogue, clinicalQuestions: next.clinical_questions }),
    assessed_at: ctx.now,
    source_set_id: sourceSet.id,
  };
  const base = currentRevision(next);
  const carried = clone(base.sections).map((section) => {
    if (section.kind !== 'narrative') return section;
    if (!section.text) return section;
    return {
      ...section,
      review_state: section.review_state === REVIEW_STATES.notApplicable ? section.review_state : REVIEW_STATES.inProgress,
      refresh_note: `Carried forward from source set version ${previous.version}; review against the refreshed sources (version ${sourceSet.version}).`,
    };
  });
  const sections = buildSections({ reportType, sourceSet, request: next, completeness: next.completeness, existing: carried });
  const revision = commitRevision(next, newRevision(next, {
    sourceSet,
    sections,
    ctx,
    basedOnRevisionId: base.id,
    basedOnSnapshotId: base.based_on_snapshot_id,
    amendment: base.amendment ? clone(base.amendment) : null,
    refreshDiff: { from_source_set: previous.id, from_version: previous.version, to_source_set: sourceSet.id, to_version: sourceSet.version, ...changes },
  }));
  const from = next.status;
  if (next.status === S.needsReview) next.status = S.draft;
  appendHistory(next, { event: 'sources_refreshed', from, to: next.status, actor: ctx.actor, at: ctx.now, detail: { revision_id: revision.id, source_set_id: sourceSet.id, changed: changes.changed.length, added: changes.added.length, removed: changes.removed.length } });
  return finish(next, commandId, fingerprint, ctx);
}

export function openAmendment(request, payload, ctx) {
  const { replay, commandId, fingerprint, next } = begin(request, 'openAmendment', payload, ctx);
  if (replay) return replay;
  assertStatus(next, [...APPROVED_STATUSES], 'open an amendment');
  const reason = requireString(payload.reason, 'reason', { max: 1000 });
  if (!ctx.snapshot || ctx.snapshot.id !== next.current_snapshot_id) {
    fail(500, 'workflow_context_invalid', 'The current approved snapshot is required to open an amendment.');
  }
  const snapshot = ctx.snapshot;
  const sourceSet = next.source_sets.find((entry) => entry.id === snapshot.source_set_id);
  if (!sourceSet) fail(409, 'source_set_required', 'The approved snapshot no longer references a pinned source set.');
  next.current_source_set_id = sourceSet.id;
  const sections = clone(snapshot.sections).map((section) => (section.kind === 'narrative' && section.text
    ? { ...section, review_state: section.origin === SECTION_ORIGINS.aiAssisted ? REVIEW_STATES.inProgress : section.review_state }
    : section));
  const revision = commitRevision(next, newRevision(next, {
    sourceSet,
    sections,
    ctx,
    basedOnRevisionId: snapshot.revision_id,
    basedOnSnapshotId: snapshot.id,
    amendment: { reason, supersedes_snapshot_id: snapshot.id, opened_by: ctx.actor.user_id, opened_at: ctx.now },
  }));
  const from = next.status;
  next.status = S.amendmentInProgress;
  appendHistory(next, { event: 'amendment_opened', from, to: next.status, actor: ctx.actor, at: ctx.now, detail: { revision_id: revision.id, supersedes_snapshot_id: snapshot.id, reason } });
  return finish(next, commandId, fingerprint, ctx);
}

export function recordDelivery(request, payload, ctx) {
  const { replay, commandId, fingerprint, next } = begin(request, 'recordDelivery', payload, ctx);
  if (replay) return replay;
  assertStatus(next, [...APPROVED_STATUSES], 'record delivery');
  const channel = requireString(payload.channel, 'channel', { max: 60 });
  const event = {
    id: ctx.idFactory('dlv'),
    snapshot_id: next.current_snapshot_id,
    channel,
    recipient_name: next.recipient.name,
    recipient_note: optionalString(payload.recipient_note, 'recipient_note', { max: 1000 }),
    status: 'recorded_manually',
    integration: 'none',
    recorded_by_user_id: ctx.actor.user_id,
    recorded_at: ctx.now,
  };
  next.delivery_events.push(event);
  const from = next.status;
  next.status = S.sent;
  appendHistory(next, { event: 'delivery_recorded', from, to: next.status, actor: ctx.actor, at: ctx.now, detail: { delivery_id: event.id, channel, status: event.status } });
  return finish(next, commandId, fingerprint, ctx);
}

export function recordExport(request, payload, ctx) {
  requireContext(ctx);
  assertKnownKeys(payload, new Set(['snapshot_id', 'format']), 'recordExport');
  const snapshotId = requireString(payload.snapshot_id, 'snapshot_id', { max: 200 });
  if (!request.snapshot_ids.includes(snapshotId)) fail(404, 'snapshot_not_found', 'The snapshot does not belong to this request.');
  const next = clone(request);
  next.export_events.push({
    id: ctx.idFactory('exp'),
    snapshot_id: snapshotId,
    format: requireString(payload.format, 'format', { max: 40 }),
    exported_by_user_id: ctx.actor.user_id,
    exported_at: ctx.now,
  });
  next.updated_at = ctx.now;
  return { request: next, replayed: false };
}

export function cancel(request, payload, ctx) {
  const { replay, commandId, fingerprint, next } = begin(request, 'cancel', payload, ctx);
  if (replay) return replay;
  if (APPROVED_STATUSES.includes(next.status)) {
    fail(409, 'approved_snapshot_immutable', 'An approved report cannot be cancelled; open an amendment or record a correction.');
  }
  assertStatus(next, [S.requested, S.assemblingEvidence, S.draft, S.needsReview, S.amendmentInProgress], 'cancel');
  const reason = requireString(payload.reason, 'reason', { max: 1000 });
  const from = next.status;
  next.cancellation = { reason, cancelled_by_user_id: ctx.actor.user_id, cancelled_at: ctx.now, from_status: from };
  next.status = S.cancelled;
  appendHistory(next, { event: 'cancelled', from, to: next.status, actor: ctx.actor, at: ctx.now, detail: { reason } });
  return finish(next, commandId, fingerprint, ctx);
}

export const COMMANDS = Object.freeze({
  assembleEvidence,
  startDraft,
  saveDraft,
  importAiDraftSection,
  submitForReview,
  approve,
  refreshSources,
  openAmendment,
  recordDelivery,
  recordExport,
  cancel,
});

/** Commands the HTTP layer may expose. applyAiSectionDraft is internal. */
export const PUBLIC_COMMAND_NAMES = Object.freeze(Object.keys(COMMANDS));

/** Render the current draft revision as a preview document (never approved). */
export function renderDraftPreview(request, { ownerName = '', synthetic = false } = {}) {
  const revision = currentRevision(request);
  const sourceSet = request.source_sets.find((entry) => entry.id === revision.source_set_id);
  if (!sourceSet) fail(409, 'source_set_required', 'The draft revision references no pinned source set.');
  const model = buildDocumentModel({
    reportTypeId: request.report_type,
    request,
    sections: revision.sections,
    sourceSet,
    completeness: request.completeness,
    meta: {
      document_state: revision.amendment ? 'AMENDMENT DRAFT — NOT APPROVED' : 'DRAFT — NOT APPROVED',
      approval: null,
      amendment: revision.amendment ? { reason: revision.amendment.reason, supersedes_snapshot_id: revision.amendment.supersedes_snapshot_id } : null,
      owner_name: ownerName || request.owner_user_id,
      synthetic,
    },
  });
  return { model, html: renderDocumentHtml(model) };
}
