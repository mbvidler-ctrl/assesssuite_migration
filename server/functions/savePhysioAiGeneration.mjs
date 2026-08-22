import { createHash, randomUUID } from 'node:crypto';

import { createEntityRepository } from '../db.mjs';
import {
  PHYSIO_AI_TASKS,
  PhysioAiTaskError,
  validatePhysioTaskOutput,
} from '../physioAiTasks.mjs';
import {
  appendAiDraftToEpisode,
  buildAiSavedReportDraftPayload,
  buildAiSoapNoteDraftPayload,
  createAiDraftRecord,
  physioAiDraftDestination,
} from '../../src/lib/physio/aiDraft.js';

const SAVE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function fail(status, code, message) {
  throw new PhysioAiTaskError(status, code, message);
}

async function assertOrganisationAccess(ctx, orgId) {
  if (!ctx.user) fail(401, 'authentication_required', 'Authentication is required.');
  if (ctx.user.role === 'admin') return;
  const memberships = await ctx.entities.OrganizationMember.filter({
    org_id: orgId,
    user_email: ctx.user.email,
  });
  if (!memberships.length) fail(403, 'organization_access_denied', 'You do not have access to this organisation.');
}

export default async function savePhysioAiGeneration(ctx) {
  try {
    const body = ctx.body && typeof ctx.body === 'object' && !Array.isArray(ctx.body) ? ctx.body : {};
    const allowed = new Set([
      'generation_id', 'edited_output', 'save_request_id', 'expected_episode_updated_date',
    ]);
    const unknown = Object.keys(body).filter((key) => !allowed.has(key));
    if (unknown.length) fail(400, 'unknown_parameters', `Unknown request parameter: ${unknown.join(', ')}.`);
    const generationId = typeof body.generation_id === 'string' ? body.generation_id.trim() : '';
    const saveRequestId = typeof body.save_request_id === 'string' ? body.save_request_id.trim() : '';
    const expectedEpisodeUpdatedDate = typeof body.expected_episode_updated_date === 'string'
      ? body.expected_episode_updated_date.trim()
      : '';
    if (!generationId) fail(400, 'generation_required', 'A durable AI generation is required.');
    if (!SAVE_KEY_PATTERN.test(saveRequestId)) {
      fail(400, 'save_request_id_required', 'A valid save_request_id is required.');
    }
    if (!expectedEpisodeUpdatedDate) {
      fail(400, 'expected_episode_version_required', 'Reload the care episode before saving this draft.');
    }
    if (!body.edited_output || typeof body.edited_output !== 'object' || Array.isArray(body.edited_output)) {
      fail(400, 'edited_output_required', 'A structured edited draft is required.');
    }
    if (!ctx.physioAiGenerations || !ctx.db) {
      fail(503, 'physio_ai_generation_store_unavailable', 'AI generation persistence is unavailable.');
    }

    let generation = ctx.physioAiGenerations.getById(generationId);
    if (!generation || generation.status !== 'succeeded') {
      fail(404, 'generation_not_found', 'The completed AI generation was not found.');
    }
    if (generation.userId !== ctx.user.id) {
      fail(403, 'generation_user_mismatch', 'This AI generation belongs to another clinician.');
    }
    await assertOrganisationAccess(ctx, generation.orgId);
    const frozenEpisodeUpdatedDate = generation.publicResponse?.care_episode_updated_date;
    if (
      typeof frozenEpisodeUpdatedDate !== 'string' || !frozenEpisodeUpdatedDate ||
      expectedEpisodeUpdatedDate !== frozenEpisodeUpdatedDate
    ) {
      fail(
        409,
        'generation_episode_version_mismatch',
        'This AI draft was generated from a different care episode version. Regenerate it before saving.',
      );
    }
    try {
      validatePhysioTaskOutput(generation.taskId, body.edited_output);
    } catch {
      fail(400, 'edited_output_schema_invalid', 'The edited draft no longer conforms to its task schema.');
    }

    const requestFingerprint = sha256({
      contract: 'physio-ai-generation-review/1.0.0',
      generation_id: generationId,
      user_id: ctx.user.id,
      edited_output: body.edited_output,
      expected_episode_updated_date: expectedEpisodeUpdatedDate,
    });
    const replay = async () => {
      if (generation.saveIdempotencyKey !== saveRequestId || generation.saveRequestFingerprintSha256 !== requestFingerprint) {
        fail(409, 'save_request_conflict', 'This save request is already bound to different reviewed content.');
      }
      const linked = await ctx.entities[generation.linkedEntity].get(generation.linkedRecordId);
      const episode = await ctx.entities.PhysioCareEpisode.get(generation.careEpisodeId);
      return ctx.respond(200, {
        generation_id: generation.id,
        linked_entity: generation.linkedEntity,
        linked_record: linked,
        care_episode: episode,
        replayed: true,
      });
    };
    if (generation.reviewStatus === 'saved') return await replay();

    const episodeRepo = createEntityRepository(ctx.db, 'PhysioCareEpisode');
    const clientRepo = createEntityRepository(ctx.db, 'Client');
    const destination = physioAiDraftDestination(generation.taskId);
    const linkedEntity = destination === 'soap_note' ? 'SOAPNote' : 'SavedReport';
    const linkedRepo = createEntityRepository(ctx.db, linkedEntity);
    const task = PHYSIO_AI_TASKS[generation.taskId];
    if (!task) fail(409, 'generation_task_unavailable', 'The generation task contract is unavailable.');

    ctx.db.exec('BEGIN IMMEDIATE');
    try {
      generation = ctx.physioAiGenerations.getById(generationId);
      if (generation.reviewStatus === 'saved') {
        ctx.db.exec('COMMIT');
        return await replay();
      }
      const episode = episodeRepo.getById(generation.careEpisodeId);
      const client = clientRepo.getById(generation.clientId);
      if (
        !episode || !client || episode.org_id !== generation.orgId || client.org_id !== generation.orgId
        || episode.client_id !== generation.clientId || episode.updated_date !== expectedEpisodeUpdatedDate
      ) {
        fail(409, 'care_episode_changed', 'The care episode changed; reload before saving this AI draft.');
      }

      const sourceOutputSha256 = sha256(generation.output);
      const provenanceSha256 = sha256(generation.provenance);
      const common = {
        generationId,
        orgId: generation.orgId,
        clientId: generation.clientId,
        careEpisodeId: generation.careEpisodeId,
        draft: body.edited_output,
        provenance: generation.provenance,
        outputState: generation.outputState,
        sourceOutputSha256,
        provenanceSha256,
      };
      const linkedPayload = destination === 'soap_note'
        ? buildAiSoapNoteDraftPayload(common)
        : {
            ...buildAiSavedReportDraftPayload({
              ...common,
              taskType: generation.taskId,
              taskLabel: task.label,
              assessmentIds: createEntityRepository(ctx.db, 'ClientAssessment').listAll()
                .filter((row) => row.org_id === generation.orgId
                  && row.client_id === generation.clientId
                  && row.physio_care_episode_id === generation.careEpisodeId)
                .map((row) => row.id),
            }),
            revision_number: 1,
            revision_history: [],
          };
      linkedPayload.ai_generation = {
        ...linkedPayload.ai_generation,
        reviewed_by: ctx.user.id,
        reviewed_at: new Date().toISOString(),
      };
      const linkedRecord = linkedRepo.create(linkedPayload, ctx.user.email);
      const aiDraftRecord = createAiDraftRecord({
        generationId,
        taskType: generation.taskId,
        draft: body.edited_output,
        provenance: generation.provenance,
        sourceOutputState: generation.outputState,
        wasEdited: sha256(body.edited_output) !== sourceOutputSha256,
        savedBy: ctx.user.id,
        linkedRecord: { entity: linkedEntity, id: linkedRecord.id },
        idFactory: () => randomUUID(),
      });
      aiDraftRecord.source_output_sha256 = sourceOutputSha256;
      aiDraftRecord.provenance_sha256 = provenanceSha256;
      const episodeWithDraft = appendAiDraftToEpisode(episode, aiDraftRecord);
      const savedEpisode = episodeRepo.update(episode.id, { reporting: episodeWithDraft.reporting });
      const reviewed = ctx.physioAiGenerations.markReviewed(generation.id, {
        saveIdempotencyKey: saveRequestId,
        saveRequestFingerprintSha256: requestFingerprint,
        reviewedOutput: body.edited_output,
        linkedEntity,
        linkedRecordId: linkedRecord.id,
        savedBy: ctx.user.id,
      });
      if (reviewed?.reviewStatus !== 'saved' || reviewed.linkedRecordId !== linkedRecord.id) {
        throw new Error('AI generation review state was not persisted');
      }
      ctx.db.exec('COMMIT');
      return ctx.respond(200, {
        generation_id: generation.id,
        linked_entity: linkedEntity,
        linked_record: linkedRecord,
        care_episode: savedEpisode,
        replayed: false,
      });
    } catch (error) {
      try { ctx.db.exec('ROLLBACK'); } catch { /* preserve original */ }
      throw error;
    }
  } catch (error) {
    if (error instanceof PhysioAiTaskError) {
      return ctx.respond(error.status, { error: error.message, code: error.code });
    }
    console.error('[physio-ai] save generation failed:', error);
    return ctx.respond(500, {
      error: 'The reviewed AI draft could not be saved. No clinical record was created.',
      code: 'physio_ai_save_failed',
    });
  }
}
