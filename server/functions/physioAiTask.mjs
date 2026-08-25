import { createHash } from 'node:crypto';

import {
  PHYSIO_AI_INTERNAL_RECEIPT,
  PhysioAiTaskError,
  preparePhysioClinicalContext,
  runPhysioAiTask,
} from '../physioAiTasks.mjs';

const ALLOWED_BODY_KEYS = new Set([
  'task',
  'org_id',
  'care_episode_id',
  'generation_request_id',
  'context',
]);
const ALLOWED_CALLER_CONTEXT_KEYS = new Set(['clinician_context']);
const MAX_CLINICIAN_CONTEXT_LENGTH = 16_000;
const MAX_EPISODE_RECORDS_PER_ENTITY = 120;
const EPISODE_CONTEXT_ENTITIES = Object.freeze([
  ['ClientAssessment', 'assessment_records'],
  ['SOAPNote', 'soap_notes'],
  ['SavedReport', 'saved_reports'],
  ['ClientReport', 'client_reports'],
  ['ClientDocument', 'document_records'],
]);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;
const PENDING_GENERATION_ABANDON_MS = 15 * 60 * 1000;

function omitKeys(record, keys) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key)));
}

function projectCareEpisodeForAi(episode) {
  const projected = omitKeys(episode, new Set());
  if (!projected?.reporting || typeof projected.reporting !== 'object' || Array.isArray(projected.reporting)) {
    return projected;
  }
  // Saved AI drafts already re-enter the bounded context through their
  // linked SOAPNote/SavedReport clinical fields. Re-including their complete
  // output and provider provenance here duplicates content, exceeds the
  // context-depth contract after the first save, and prevents the next task
  // from reaching the provider.
  projected.reporting = omitKeys(
    projected.reporting,
    new Set(['ai_drafts', 'latest_ai_draft']),
  );
  return projected;
}

function projectEpisodeRecordForAi(contextKey, record) {
  if (contextKey === 'saved_reports') {
    return omitKeys(record, new Set(['ai_generation', 'report_html', 'revision_history']));
  }
  if (contextKey === 'soap_notes') {
    return omitKeys(record, new Set(['ai_generation', 'ai_edit_revision_history']));
  }
  if (contextKey === 'client_reports') {
    return omitKeys(record, new Set(['html_content', 'revision_history']));
  }
  return record;
}

async function assertOrganisationAccess(ctx, orgId) {
  if (!ctx.user) {
    throw new PhysioAiTaskError(401, 'authentication_required', 'Authentication is required.');
  }
  if (ctx.user.role === 'admin') return;
  const memberships = await ctx.entities.OrganizationMember.filter({
    org_id: orgId,
    user_email: ctx.user.email,
  });
  if (!Array.isArray(memberships) || memberships.length === 0) {
    throw new PhysioAiTaskError(403, 'organization_access_denied', 'You do not have access to this organisation.');
  }
}

async function assertCareEpisodeAccess(ctx, orgId, careEpisodeId) {
  if (typeof careEpisodeId !== 'string' || !careEpisodeId.trim() || careEpisodeId !== careEpisodeId.trim()) {
    throw new PhysioAiTaskError(400, 'care_episode_required', 'A valid saved care episode is required.');
  }
  const episodes = await ctx.entities.PhysioCareEpisode.filter({ id: careEpisodeId, org_id: orgId });
  if (!Array.isArray(episodes) || episodes.length !== 1) {
    throw new PhysioAiTaskError(404, 'care_episode_not_found', 'The care episode was not found in this organisation.');
  }
  return episodes[0];
}

function prepareClinicianContext(value) {
  if (value === undefined || value === null) return '';
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PhysioAiTaskError(400, 'invalid_caller_context', 'Caller context must be an object containing only optional clinician_context text.');
  }
  const unknownKeys = Object.keys(value).filter((key) => !ALLOWED_CALLER_CONTEXT_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new PhysioAiTaskError(
      400,
      'caller_clinical_context_forbidden',
      'Clinical record arrays are server-owned. Only optional clinician_context text may be supplied.',
    );
  }
  if (value.clinician_context === undefined || value.clinician_context === null) return '';
  if (typeof value.clinician_context !== 'string') {
    throw new PhysioAiTaskError(400, 'invalid_clinician_context', 'clinician_context must be text.');
  }
  const normalized = value.clinician_context
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  if (normalized.length > MAX_CLINICIAN_CONTEXT_LENGTH) {
    throw new PhysioAiTaskError(
      413,
      'clinician_context_too_large',
      `clinician_context exceeds the ${MAX_CLINICIAN_CONTEXT_LENGTH}-character limit.`,
    );
  }
  return normalized;
}

function prepareGenerationRequestId(value) {
  if (typeof value !== 'string' || value !== value.trim() || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new PhysioAiTaskError(
      400,
      'generation_request_id_required',
      'A valid generation_request_id is required for idempotent AI generation.',
    );
  }
  return value;
}

function generationRequestFingerprint({ userId, orgId, careEpisodeId, careEpisodeUpdatedDate, taskId, clinicianContext }) {
  return createHash('sha256').update(JSON.stringify({
    contract: 'physio-ai-generation-request/1.0.0',
    user_id: userId,
    org_id: orgId,
    care_episode_id: careEpisodeId,
    care_episode_updated_date: careEpisodeUpdatedDate,
    task_id: taskId,
    clinician_context: clinicianContext,
  })).digest('hex');
}

function assertEpisodeRecordScope(records, label, { orgId, clientId, careEpisodeId }) {
  if (!Array.isArray(records)) {
    throw new PhysioAiTaskError(503, 'episode_context_unavailable', `${label} could not be loaded for the care episode.`);
  }
  if (records.length > MAX_EPISODE_RECORDS_PER_ENTITY) {
    throw new PhysioAiTaskError(
      413,
      'episode_context_too_large',
      `${label} exceeds the ${MAX_EPISODE_RECORDS_PER_ENTITY}-record episode-context limit.`,
    );
  }
  for (const record of records) {
    if (
      !record ||
      record.org_id !== orgId ||
      record.client_id !== clientId ||
      record.physio_care_episode_id !== careEpisodeId
    ) {
      throw new PhysioAiTaskError(
        409,
        'care_episode_context_mismatch',
        `${label} contained a record outside the selected care episode. No AI request was sent.`,
      );
    }
  }
  return records;
}

export function buildEpisodeScopedPhysioClinicalContext({
  orgId,
  episode,
  client,
  records,
  clinicianContext = '',
}) {
  const careEpisodeId = typeof episode?.id === 'string' ? episode.id.trim() : '';
  const clientId = typeof episode?.client_id === 'string' ? episode.client_id.trim() : '';
  if (
    !careEpisodeId ||
    !clientId ||
    episode.org_id !== orgId ||
    !client ||
    client.id !== clientId ||
    client.org_id !== orgId
  ) {
    throw new PhysioAiTaskError(
      409,
      'care_episode_patient_mismatch',
      'The saved care episode does not resolve to one patient in this organisation.',
    );
  }

  const context = {
    client_profile: client,
    care_episode: projectCareEpisodeForAi(episode),
  };
  for (const [, contextKey] of EPISODE_CONTEXT_ENTITIES) {
    const scoped = assertEpisodeRecordScope(records?.[contextKey], contextKey, {
      orgId,
      clientId,
      careEpisodeId,
    });
    context[contextKey] = scoped.map((record) => projectEpisodeRecordForAi(contextKey, record));
  }
  if (clinicianContext) context.clinician_context = clinicianContext;
  return preparePhysioClinicalContext(context);
}

async function loadEpisodeScopedClinicalContext(ctx, orgId, episode, clinicianContext) {
  const clientRows = await ctx.entities.Client.filter({ id: episode.client_id, org_id: orgId });
  if (!Array.isArray(clientRows) || clientRows.length !== 1) {
    throw new PhysioAiTaskError(
      409,
      'care_episode_patient_mismatch',
      'The saved care episode does not resolve to one patient in this organisation.',
    );
  }
  const query = {
    org_id: orgId,
    client_id: episode.client_id,
    physio_care_episode_id: episode.id,
  };
  const loaded = await Promise.all(
    EPISODE_CONTEXT_ENTITIES.map(async ([entityName, contextKey]) => [
      contextKey,
      await ctx.entities[entityName].filter(query),
    ]),
  );
  return buildEpisodeScopedPhysioClinicalContext({
    orgId,
    episode,
    client: clientRows[0],
    records: Object.fromEntries(loaded),
    clinicianContext,
  });
}

export function createPhysioAiTaskHandler({ run = runPhysioAiTask } = {}) {
  return async function physioAiTask(ctx) {
    try {
      const body = ctx.body && typeof ctx.body === 'object' && !Array.isArray(ctx.body) ? ctx.body : {};
      const unknownKeys = Object.keys(body).filter((key) => !ALLOWED_BODY_KEYS.has(key));
      if (unknownKeys.length > 0) {
        throw new PhysioAiTaskError(
          400,
          'unknown_parameters',
          `Unknown request parameter${unknownKeys.length === 1 ? '' : 's'}: ${unknownKeys.join(', ')}.`,
        );
      }
      const orgId = typeof body.org_id === 'string' ? body.org_id.trim() : '';
      if (!orgId || orgId.length > 200) {
        throw new PhysioAiTaskError(400, 'organization_required', 'A valid organisation is required for physiotherapy AI generation.');
      }
      await assertOrganisationAccess(ctx, orgId);
      const careEpisode = await assertCareEpisodeAccess(ctx, orgId, body.care_episode_id);
      const taskId = typeof body.task === 'string' ? body.task.trim() : '';
      const clinicianContext = prepareClinicianContext(body.context);
      const generationRequestId = prepareGenerationRequestId(body.generation_request_id);
      if (!ctx.physioAiGenerations) {
        throw new PhysioAiTaskError(
          503,
          'physio_ai_generation_store_unavailable',
          'AI generation persistence is unavailable. No provider request was sent.',
        );
      }
      const requestFingerprintSha256 = generationRequestFingerprint({
        userId: ctx.user.id,
        orgId,
        careEpisodeId: careEpisode.id,
        careEpisodeUpdatedDate: careEpisode.updated_date,
        taskId,
        clinicianContext,
      });
      const acquired = ctx.physioAiGenerations.acquire({
        orgId,
        userId: ctx.user.id,
        clientId: careEpisode.client_id,
        careEpisodeId: careEpisode.id,
        taskId,
        idempotencyKey: generationRequestId,
        requestFingerprintSha256,
      });
      const generation = acquired.generation;
      if (!acquired.created) {
        if (generation.requestFingerprintSha256 !== requestFingerprintSha256) {
          throw new PhysioAiTaskError(
            409,
            'generation_request_conflict',
            'generation_request_id is already bound to a different canonical request.',
          );
        }
        if (generation.status === 'succeeded' && generation.publicResponse) {
          return ctx.respond(200, generation.publicResponse);
        }
        const pendingAgeMs = Date.now() - Date.parse(generation.createdAt || '');
        if (
          generation.status === 'pending'
          && Number.isFinite(pendingAgeMs)
          && pendingAgeMs >= PENDING_GENERATION_ABANDON_MS
        ) {
          ctx.physioAiGenerations.markFailed(generation.id, 'generation_abandoned_after_timeout');
          throw new PhysioAiTaskError(
            409,
            'generation_request_abandoned',
            'The indeterminate provider request was abandoned without replay. Start a new generation request.',
          );
        }
        throw new PhysioAiTaskError(
          409,
          generation.status === 'pending'
            ? 'generation_in_progress'
            : generation.errorCode === 'generation_abandoned_after_timeout'
              ? 'generation_request_abandoned'
              : 'generation_request_failed',
          generation.status === 'pending'
            ? 'This AI generation request is already in progress. Retry the same request to read back its result.'
            : 'This AI generation request previously failed. Start a new generation with a new generation_request_id.',
        );
      }

      try {
        const clinicalContext = await loadEpisodeScopedClinicalContext(
          ctx,
          orgId,
          careEpisode,
          clinicianContext,
        );
        const result = await run(
          { task: taskId, orgId, context: clinicalContext },
          { apiUsage: ctx.apiUsage },
        );
        const internalReceipt = result?.[PHYSIO_AI_INTERNAL_RECEIPT];
        if (!internalReceipt?.usageReservationId) {
          throw new PhysioAiTaskError(
            503,
            'physio_ai_generation_receipt_missing',
            'AI generation could not be durably bound to its usage reservation.',
          );
        }
        const publicResponse = {
          ...result,
          care_episode_id: careEpisode.id,
          care_episode_updated_date: careEpisode.updated_date,
          generation_id: generation.id,
        };
        const persisted = ctx.physioAiGenerations.markSucceeded(generation.id, {
          outputState: result.output_state,
          output: result.output,
          provenance: result.provenance,
          publicResponse,
          usageReservationId: internalReceipt.usageReservationId,
          providerResponseId: internalReceipt.providerResponseId,
          providerHttpRequestId: internalReceipt.providerHttpRequestId,
          providerRequestIdHash: result.provenance?.provider_request_id_hash,
        });
        if (
          persisted?.status !== 'succeeded' ||
          persisted?.usageReservationId !== internalReceipt.usageReservationId ||
          persisted?.providerResponseId !== internalReceipt.providerResponseId ||
          persisted?.providerHttpRequestId !== internalReceipt.providerHttpRequestId ||
          persisted?.providerRequestIdHash !== result.provenance?.provider_request_id_hash ||
          persisted?.publicResponse?.generation_id !== generation.id
        ) {
          throw new PhysioAiTaskError(
            503,
            'physio_ai_generation_persistence_failed',
            'AI generation could not be durably persisted. No draft was returned.',
          );
        }
        return ctx.respond(200, persisted.publicResponse);
      } catch (error) {
        try {
          ctx.physioAiGenerations.markFailed(generation.id, error?.code || 'physio_ai_internal_error');
        } catch (persistenceError) {
          console.error('[physio-ai] generation failure state could not be persisted:', persistenceError);
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof PhysioAiTaskError) {
        return ctx.respond(error.status, { error: error.message, code: error.code });
      }
      console.error('[physio-ai] unexpected task gateway failure:', error);
      return ctx.respond(500, {
        error: 'Physiotherapy AI generation could not be completed. No draft was generated.',
        code: 'physio_ai_internal_error',
      });
    }
  };
}

export default createPhysioAiTaskHandler();
