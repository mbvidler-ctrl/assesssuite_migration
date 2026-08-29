import { createEntityRepository } from '../db.mjs';
import { resolveActiveProfessionContract } from '../../packages/profession-config/runtime.mjs';

const MUTABLE_STATUSES = new Set(['recording', 'paused', 'recoverable', 'error']);

function normalizeAccessEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function careEpisodeEntityName() {
  return resolveActiveProfessionContract(process.env).profession.features.careEpisodes
    ? 'PhysioCareEpisode'
    : null;
}

function fail(ctx, status, code, message, extras = {}) {
  return ctx.respond(status, { status: 'error', error: code, message, ...extras });
}

function membershipContext(ctx) {
  const memberships = createEntityRepository(ctx.db, 'OrganizationMember').listAll().filter((row) => (
    normalizeAccessEmail(row.user_email) === normalizeAccessEmail(ctx.user?.email)
  ));
  const requestedOrgId = typeof ctx.body?.org_id === 'string' ? ctx.body.org_id.trim() : '';
  const membership = requestedOrgId
    ? memberships.find((row) => row.org_id === requestedOrgId)
    : memberships.find((row) => row.is_primary === true) || memberships[0];
  return membership ? { membership, orgId: membership.org_id } : null;
}

function cleanOptionalId(value) {
  if (value === null || value === undefined || value === '') return null;
  const clean = String(value).trim();
  return clean && clean.length <= 200 && !/[\r\n\0]/.test(clean) ? clean : undefined;
}

function cleanLabel(value) {
  const clean = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.slice(0, 120) || `Consultation ${new Date().toLocaleDateString('en-AU')}`;
}

function sessionPresentation(session, { includeTranscript = true } = {}) {
  return {
    id: session.id,
    org_id: session.orgId,
    status: session.status,
    label: session.label,
    client_id: session.clientId,
    appointment_id: session.appointmentId,
    care_episode_id: session.careEpisodeId,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    duration_seconds: session.durationSeconds,
    transcript: includeTranscript ? session.transcriptText : undefined,
    artifacts: includeTranscript ? session.artifacts : undefined,
    last_error_code: session.lastErrorCode,
    updated_at: session.updatedAt,
    segments: (session.segments || []).map((segment) => ({
      sequence: segment.sequence,
      upload_id: segment.uploadId,
      audio_url: segment.audioUrl,
      mime_type: segment.mimeType,
      byte_size: segment.byteSize,
      duration_seconds: segment.durationSeconds,
      status: segment.status,
      transcript: includeTranscript ? segment.transcriptText : undefined,
      speakers: includeTranscript ? segment.speakers : undefined,
      last_error_code: segment.lastErrorCode,
      updated_at: segment.updatedAt,
    })),
  };
}

function validateContextEntity(ctx, entityName, id, orgId) {
  if (!id) return true;
  const record = createEntityRepository(ctx.db, entityName).getById(id);
  return Boolean(record && record.org_id === orgId);
}

function ownedSession(ctx, scope, id, { mustBeMutable = false } = {}) {
  const session = ctx.transcriptionSessions.get(String(id || ''));
  if (!session || session.orgId !== scope.orgId) return { error: 'not_found' };
  if (session.userId !== ctx.user.id) return { error: 'not_owner', session };
  if (mustBeMutable && !MUTABLE_STATUSES.has(session.status)) return { error: 'not_mutable', session };
  return { session };
}

export default async function manageTranscriptionSession(ctx) {
  if (!ctx.db || !ctx.transcriptionSessions || !ctx.user) {
    return fail(ctx, 503, 'transcription_session_unavailable', 'Persistent transcription is unavailable.');
  }
  const scope = membershipContext(ctx);
  if (!scope) return fail(ctx, 403, 'organization_membership_required', 'Practice membership is required.');
  const action = typeof ctx.body?.action === 'string' ? ctx.body.action : 'recover';

  if (action === 'recover') {
    const active = ctx.transcriptionSessions.findActive(scope.orgId, ctx.user.id);
    return ctx.respond(200, {
      status: 'success',
      active_session: active ? sessionPresentation(active) : null,
    });
  }

  if (action === 'list') {
    return ctx.respond(200, {
      status: 'success',
      sessions: ctx.transcriptionSessions.listRecent(scope.orgId, 25).map((session) => (
        sessionPresentation(session, { includeTranscript: false })
      )),
    });
  }

  if (action === 'get') {
    const session = ctx.transcriptionSessions.get(String(ctx.body?.session_id || ''));
    if (!session || session.orgId !== scope.orgId) {
      return fail(ctx, 404, 'transcription_session_not_found', 'The transcription session was not found.');
    }
    return ctx.respond(200, { status: 'success', session: sessionPresentation(session) });
  }

  if (action === 'create') {
    const active = ctx.transcriptionSessions.findActive(scope.orgId, ctx.user.id);
    if (active) {
      return fail(ctx, 409, 'active_transcription_exists', 'Finish or recover the current transcription before starting another.', {
        active_session: sessionPresentation(active),
      });
    }
    const clientId = cleanOptionalId(ctx.body?.client_id);
    const appointmentId = cleanOptionalId(ctx.body?.appointment_id);
    const careEpisodeId = cleanOptionalId(ctx.body?.care_episode_id);
    if (clientId === undefined || appointmentId === undefined || careEpisodeId === undefined) {
      return fail(ctx, 400, 'transcription_context_invalid', 'The selected consultation context is invalid.');
    }
    if (!validateContextEntity(ctx, 'Client', clientId, scope.orgId)) {
      return fail(ctx, 404, 'transcription_client_not_found', 'The selected patient or client was not found.');
    }
    if (!validateContextEntity(ctx, 'Appointment', appointmentId, scope.orgId)) {
      return fail(ctx, 404, 'transcription_appointment_not_found', 'The selected appointment was not found.');
    }
    const episodeEntity = careEpisodeEntityName();
    if (careEpisodeId && !episodeEntity) {
      return fail(ctx, 400, 'transcription_episode_unsupported', 'Care-episode attachment is not available in this product target.');
    }
    if (careEpisodeId && !validateContextEntity(ctx, episodeEntity, careEpisodeId, scope.orgId)) {
      return fail(ctx, 404, 'transcription_episode_not_found', 'The selected care episode was not found.');
    }
    const session = ctx.transcriptionSessions.create({
      orgId: scope.orgId,
      userId: ctx.user.id,
      label: cleanLabel(ctx.body?.label),
      clientId,
      appointmentId,
      careEpisodeId,
    });
    return ctx.respond(200, { status: 'success', session: sessionPresentation(session) });
  }

  const owned = ownedSession(ctx, scope, ctx.body?.session_id, {
    // Context attachment is metadata and remains useful after transcription
    // has completed. Audio/session mutation stays restricted to open states.
    mustBeMutable: ['append_segment', 'pause', 'resume', 'finish'].includes(action),
  });
  if (owned.error === 'not_found') return fail(ctx, 404, 'transcription_session_not_found', 'The transcription session was not found.');
  if (owned.error === 'not_owner') return fail(ctx, 403, 'transcription_session_owner_required', 'Only the recording clinician can change this transcription.');
  if (owned.error === 'not_mutable') return fail(ctx, 409, 'transcription_session_closed', 'This transcription session is already closed.');
  const session = owned.session;

  if (action === 'append_segment') {
    const sequence = Number(ctx.body?.sequence);
    const uploadId = String(ctx.body?.upload_id || '').trim();
    const audioUrl = String(ctx.body?.audio_url || '').trim();
    if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > 1000 || !uploadId || !audioUrl) {
      return fail(ctx, 400, 'transcription_segment_invalid', 'The recording segment is invalid.');
    }
    const upload = ctx.db.prepare(`
      SELECT * FROM upload_registry
      WHERE id = ? AND org_id = ? AND uploader_user_id = ? AND purpose = 'audio-transcription'
    `).get(uploadId, scope.orgId, ctx.user.id);
    if (!upload) return fail(ctx, 404, 'transcription_upload_not_found', 'The recording segment upload was not found.');
    let pathname = '';
    try { pathname = new URL(audioUrl, 'https://assesssuite.invalid').pathname; } catch { /* invalid below */ }
    // UploadFile deliberately returns the opaque registry id, not the stored
    // filename. Match that public reference to the tenant-scoped receipt;
    // the configured upload resolver performs the final id -> path mapping.
    if (pathname !== `/uploads/${upload.id}` || Number(upload.byte_size) <= 0) {
      return fail(ctx, 409, 'transcription_upload_mismatch', 'The recording segment does not match its upload receipt.');
    }
    const segment = ctx.transcriptionSessions.addSegment({
      sessionId: session.id,
      orgId: scope.orgId,
      sequence,
      uploadId,
      audioUrl: pathname,
      mimeType: upload.detected_mime,
      byteSize: Number(upload.byte_size),
      durationSeconds: Number.isFinite(Number(ctx.body?.duration_seconds))
        ? Math.max(0, Number(ctx.body.duration_seconds))
        : null,
    });
    const observedAt = new Date().toISOString();
    ctx.db.prepare(`
      UPDATE upload_registry
      SET lifecycle_state = 'bound', bound_at = ?, expires_at = NULL,
          bound_entity_type = 'TranscriptionSession', bound_entity_id = ?
      WHERE id = ? AND org_id = ? AND lifecycle_state IN ('temporary', 'processing', 'review-pending', 'bound')
    `).run(observedAt, session.id, uploadId, scope.orgId);
    return ctx.respond(200, { status: 'success', segment: sessionPresentation({ segments: [segment] }).segments[0] });
  }

  if (action === 'attach') {
    if (session.status === 'discarded') {
      return fail(ctx, 409, 'transcription_session_discarded', 'A discarded transcription cannot be attached to clinical context.');
    }
    const clientId = cleanOptionalId(ctx.body?.client_id);
    const appointmentId = cleanOptionalId(ctx.body?.appointment_id);
    const careEpisodeId = cleanOptionalId(ctx.body?.care_episode_id);
    if (clientId === undefined || appointmentId === undefined || careEpisodeId === undefined) {
      return fail(ctx, 400, 'transcription_context_invalid', 'The selected consultation context is invalid.');
    }
    const episodeEntity = careEpisodeEntityName();
    if (careEpisodeId && !episodeEntity) {
      return fail(ctx, 400, 'transcription_episode_unsupported', 'Care-episode attachment is not available in this product target.');
    }
    if (!validateContextEntity(ctx, 'Client', clientId, scope.orgId)
        || !validateContextEntity(ctx, 'Appointment', appointmentId, scope.orgId)
        || (careEpisodeId && !validateContextEntity(ctx, episodeEntity, careEpisodeId, scope.orgId))) {
      return fail(ctx, 404, 'transcription_context_not_found', 'The selected consultation context was not found.');
    }
    const updated = ctx.transcriptionSessions.update(session.id, {
      label: cleanLabel(ctx.body?.label || session.label), clientId, appointmentId, careEpisodeId,
    });
    return ctx.respond(200, { status: 'success', session: sessionPresentation(updated) });
  }

  if (action === 'pause' || action === 'resume') {
    const updated = ctx.transcriptionSessions.update(session.id, {
      status: action === 'pause' ? 'paused' : 'recording',
      lastErrorCode: null,
    });
    return ctx.respond(200, { status: 'success', session: sessionPresentation(updated) });
  }

  if (action === 'finish') {
    const refreshed = ctx.transcriptionSessions.get(session.id);
    const pending = refreshed.segments.some((segment) => segment.status !== 'ready');
    const updated = ctx.transcriptionSessions.update(session.id, {
      status: pending ? 'finalising' : 'ready',
      endedAt: new Date().toISOString(),
    });
    return ctx.respond(200, { status: 'success', session: sessionPresentation(updated) });
  }

  if (action === 'discard') {
    if (typeof ctx.uploadRegistry?.expireBoundTranscriptionAudio !== 'function') {
      return fail(ctx, 503, 'transcription_audio_expiry_unavailable', 'The recording cannot be discarded safely right now. Try again shortly.');
    }
    ctx.uploadRegistry.expireBoundTranscriptionAudio({
      sessionId: session.id,
      orgId: scope.orgId,
      actorUserId: ctx.user.id,
    });
    const updated = ctx.transcriptionSessions.update(session.id, {
      status: 'discarded', endedAt: new Date().toISOString(), transcriptText: '', artifacts: null,
    });
    return ctx.respond(200, { status: 'success', session: sessionPresentation(updated) });
  }

  return fail(ctx, 400, 'transcription_session_action_invalid', 'The requested transcription action is not supported.');
}
