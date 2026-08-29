// transcribeSession — feature-gated real transcription and SOAP dissection.
// Production is fail-closed. Isolated tests may inject a labelled response
// function through the explicit test-provider seam; this runnable module
// contains no fabricated transcript or SOAP implementation.
//
// SOAPNoteModal invokes this module through `base44.functions.invoke`. That
// SDK returns the raw response envelope, so the client reads `result?.data ??
// result`. Two actions are dispatched on body.action:
//   - 'transcribe'      : { audio_url, org_id } -> { transcript, simulated }
//   - 'dissect_to_soap' : { transcript } -> { success, simulated, subjective,
//                           objective, assessment, plan }
//
// Both real actions require OPENAI_API_KEY and SELFTEST !== '1'. Before any
// provider egress they reserve bounded usage against the authenticated user;
// a missing ledger, cap refusal or unpriced model fails before the provider
// call. Successful transcription settles against verbose-json audio duration;
// SOAP dissection settles against provider token counts. Physio retains this
// operational EP-compatible tool alongside its richer versioned SOAP workflow.
//
// `transcribe` resolves only a tenant-authorised direct child of UPLOADS_DIR,
// validates the supported container and 20 MiB limit, then calls OpenAI using
// the release-pinned `whisper-1` model. Returned text passes through
// deidentify() before it reaches the browser. Provider failure returns 502;
// missing production configuration returns 503.
//
// `dissect_to_soap` uses invokeLLMWithUsage(), retaining the shared
// de-identification, model-selection and JSON-schema behaviour. Production
// rejects an empty transcript and never fabricates a SOAP note. The omitted
// test adapter labels every injected response and each persisted SOAP field.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TRANSCRIPTION_DISABLED_CODE,
  TRANSCRIPTION_DISABLED_MESSAGE,
  TRANSCRIPTION_PROVIDER_FAILED_CODE,
  TRANSCRIPTION_UNCONFIGURED_CODE,
  TRANSCRIPTION_UNCONFIGURED_MESSAGE,
  transcriptionAvailable,
} from '../capabilities.mjs';
import { resolveActiveProfessionContract } from '../../packages/profession-config/runtime.mjs';
import {
  deidentify,
  invokeLLMWithUsage,
  llmEnabled,
  pickModel,
} from '../llm.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Must match uploadsDir in server/integrations.mjs (where handleUploadFile
// writes) and server/index.mjs (which serves GET /uploads/*).
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
let authorisedUploadResolver = null;

/**
 * Configured by server/index.mjs with the process's tenant-aware upload
 * registry. Kept as dependency injection so this function never opens a
 * second database or infers tenancy from a filename.
 */
export function configureUploadResolver(resolver) {
  authorisedUploadResolver = typeof resolver === 'function' ? resolver : null;
}

const TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';
// Pinned so admission estimates and actual-cost settlement use one reviewed
// price-registry entry. The Fly configs repeat this value for operator clarity.
const TRANSCRIBE_MODEL = 'whisper-1';
const DIARIZED_TRANSCRIBE_MODEL = 'gpt-4o-transcribe-diarize';
const PROVIDER_CALL_RECEIPT_CONTRACT_VERSION = 'assesssuite-provider-call-receipt/1.0.0';
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const PERSISTENT_TRANSCRIPTION_OPEN_STATUSES = new Set([
  'recording',
  'paused',
  'finalising',
  'recoverable',
  'error',
]);

// MIME type by stored extension. SOAPNoteModal selects WebM/Opus or MP4 from
// the browser's supported MediaRecorder formats and names the file to match;
// the other entries support already-registered compatible audio uploads.
const MIME_BY_EXT = {
  '.webm': 'audio/webm',
  '.mp3': 'audio/mpeg',
  '.mpga': 'audio/mpeg',
  '.mpeg': 'audio/mpeg',
  '.mp4': 'audio/mp4',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.flac': 'audio/flac',
};

function realPathEnabled() {
  return Boolean(process.env.OPENAI_API_KEY) && process.env.SELFTEST !== '1';
}

function resolveTranscriptionFallback(ctx, environment = process.env) {
  const injected = ctx?.transcriptionFallback || null;
  if (!injected) return null;
  if (environment.NODE_ENV !== 'test' || environment.SELFTEST !== '1') {
    throw new Error('injected transcription responses are forbidden outside self-test');
  }
  if (typeof injected !== 'function') {
    throw new TypeError('injected transcription response service must be a function');
  }
  return injected;
}

/**
 * Maps an audio_url of the form "/uploads/<name>" (or an absolute URL whose
 * pathname is /uploads/<name>) to the stored file's path, returning null for
 * anything that does not resolve to a direct child of the uploads directory.
 * Guards, in order: URL parse (strips query/hash, normalises absolute URLs);
 * percent-decoding (so encoded traversal like %2e%2e%2f is seen decoded);
 * prefix check; rejection of separators, "..", and NUL in the residual name;
 * and a final containment check that the resolved path is exactly
 * uploadsDir + separator + name.
 */
function resolveUploadPath(audioUrl, { user, orgId }) {
  if (!authorisedUploadResolver || !user || typeof orgId !== 'string' || !orgId) return null;
  const resolved = authorisedUploadResolver({ audioUrl, user, orgId });
  if (typeof resolved !== 'string') return null;
  const root = path.resolve(uploadsDir);
  const candidate = path.resolve(resolved);
  if (path.dirname(candidate) !== root) return null;
  return candidate;
}

async function transcribeWithOpenAI(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) throw new Error('unsupported audio type');
  const buffer = fs.readFileSync(filePath);

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), path.basename(filePath));
  form.append('model', TRANSCRIBE_MODEL);
  // verbose_json supplies duration so the durable usage ledger can settle
  // the reservation against actual audio seconds.
  form.append('response_format', 'verbose_json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI transcription ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!text) throw new Error('OpenAI transcription returned empty text');
    const duration = Number(data?.duration);
    return {
      text,
      audioSeconds: Number.isFinite(duration) && duration >= 0 ? duration : null,
      providerRequestId: res.headers.get('x-request-id') || null,
      providerStatus: res.status,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function transcribeDiarizedWithOpenAI(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) throw new Error('unsupported audio type');
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), path.basename(filePath));
  form.append('model', DIARIZED_TRANSCRIBE_MODEL);
  form.append('response_format', 'diarized_json');
  form.append('chunking_strategy', 'auto');
  form.append('language', 'en');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  try {
    const res = await fetch(TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI diarized transcription ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!text) throw new Error('OpenAI diarized transcription returned empty text');
    const segments = (Array.isArray(data?.segments) ? data.segments : []).map((segment, index) => ({
      id: String(segment?.id ?? index),
      speaker: String(segment?.speaker || `Speaker ${index + 1}`).slice(0, 80),
      start: Number.isFinite(Number(segment?.start)) ? Number(segment.start) : null,
      end: Number.isFinite(Number(segment?.end)) ? Number(segment.end) : null,
      text: typeof segment?.text === 'string' ? segment.text.trim() : '',
    })).filter((segment) => segment.text);
    const usage = data?.usage && typeof data.usage === 'object' ? data.usage : {};
    const duration = Number(data?.duration ?? usage?.seconds);
    return {
      text,
      segments,
      audioSeconds: Number.isFinite(duration) && duration > 0
        ? duration
        : Math.max(0, ...segments.map((segment) => segment.end || 0)) || null,
      inputTokens: Number.isSafeInteger(usage?.input_tokens) ? usage.input_tokens : null,
      outputTokens: Number.isSafeInteger(usage?.output_tokens) ? usage.output_tokens : null,
      providerRequestId: res.headers.get('x-request-id') || null,
      providerStatus: res.status,
    };
  } finally {
    clearTimeout(timer);
  }
}

function apiUsageFailure(error) {
  const status = Number.isInteger(error?.httpStatus) && error.httpStatus >= 400 && error.httpStatus <= 599
    ? error.httpStatus
    : 503;
  const code = typeof error?.code === 'string' && error.code
    ? error.code
    : 'api_usage_unavailable';
  const fallback = code === 'api_usage_cap_reached'
    ? 'Your AI usage limit has been reached. Try again after the limit resets.'
    : 'AI usage controls are temporarily unavailable.';
  const message = typeof error?.publicMessage === 'string' && error.publicMessage.trim()
    ? error.publicMessage.trim()
    : fallback;
  const body = { code, error: message };
  if (typeof error?.resetsAt === 'string' && error.resetsAt) body.resets_at = error.resetsAt;
  if (Number.isInteger(error?.retryAfterSeconds)) body.retry_after_seconds = error.retryAfterSeconds;
  return { status, body };
}

async function reserveApiUsage(ctx, request) {
  if (!ctx.apiUsage || typeof ctx.apiUsage.reserve !== 'function') {
    const error = new Error('API usage admission is unavailable');
    error.httpStatus = 503;
    error.code = 'api_usage_unavailable';
    throw error;
  }
  const reservation = await ctx.apiUsage.reserve(request);
  if (!reservation?.id) {
    const error = new Error('API usage reservation did not return an id');
    error.httpStatus = 503;
    error.code = 'api_usage_unavailable';
    throw error;
  }
  return reservation;
}

async function settleApiUsage(ctx, settlement) {
  if (!ctx.apiUsage || typeof ctx.apiUsage.settle !== 'function') {
    const error = new Error('API usage settlement is unavailable');
    error.httpStatus = 503;
    error.code = 'api_usage_unavailable';
    throw error;
  }
  await ctx.apiUsage.settle(settlement);
}

async function markApiUsageFailed(ctx, reservationId) {
  try {
    await settleApiUsage(ctx, { reservationId, status: 'failed' });
  } catch (error) {
    console.log('[transcribeSession] usage failure settlement failed:', error.message);
  }
}

const SOAP_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    subjective: { type: 'string' },
    objective: { type: 'string' },
    assessment: { type: 'string' },
    plan: { type: 'string' },
  },
  required: ['success', 'subjective', 'objective', 'assessment', 'plan'],
};

const TRANSCRIPT_ARTIFACT_SCHEMA = {
  type: 'object',
  properties: {
    concise_summary: { type: 'string' },
    history_and_symptoms: { type: 'array', items: { type: 'string' } },
    objective_observations: { type: 'array', items: { type: 'string' } },
    interventions_and_education: { type: 'array', items: { type: 'string' } },
    goals_and_preferences: { type: 'array', items: { type: 'string' } },
    agreed_actions: { type: 'array', items: { type: 'string' } },
    follow_up_items: { type: 'array', items: { type: 'string' } },
    red_flags_or_escalations: { type: 'array', items: { type: 'string' } },
    soap: {
      type: 'object',
      properties: {
        subjective: { type: 'string' },
        objective: { type: 'string' },
        assessment: { type: 'string' },
        plan: { type: 'string' },
      },
      required: ['subjective', 'objective', 'assessment', 'plan'],
    },
    source_segments: { type: 'array', items: { type: 'integer' } },
  },
  required: [
    'concise_summary', 'history_and_symptoms', 'objective_observations',
    'interventions_and_education', 'goals_and_preferences', 'agreed_actions',
    'follow_up_items', 'red_flags_or_escalations', 'soap', 'source_segments',
  ],
};

function buildTranscriptArtifactPrompt(session) {
  const transcript = session.segments
    .filter((segment) => segment.status === 'ready' && segment.transcriptText)
    .map((segment) => `[Recording segment ${segment.sequence}]\n${segment.transcriptText}`)
    .join('\n\n');
  return [
    `You are a clinical documentation assistant supporting a ${resolveActiveProfessionContract(process.env).clinicalPromptRole}.`,
    'Turn the consultation transcript into a concise, review-ready clinical workspace.',
    'Use only facts present in the transcript. Do not infer diagnoses, measurements, consent, tests, interventions, goals or decisions that were not spoken.',
    'Preserve uncertainty and speaker attribution where it matters. Use Australian English.',
    'The SOAP draft must be concise and clinically useful. Put absent content in an empty string or empty array rather than inventing it.',
    'List the zero-based recording segment numbers that materially support the output in source_segments.',
    '',
    transcript.slice(0, 300_000),
  ].join('\n');
}

function buildSoapPrompt(transcript) {
  return [
    'You are a clinical scribe for an allied-health (exercise physiology) practice.',
    'Dissect the session transcript below into the four sections of a SOAP note.',
    'Use only content grounded in the transcript; do not invent findings, measurements or history.',
    'Write concise clinical prose in Australian English (no contractions; professional register).',
    '',
    'Sections:',
    '- subjective: what the client reports — symptoms, history, concerns, goals, self-assessed progress.',
    '- objective: observable or measurable findings — tests performed, measurements taken, observed movement quality and exercise tolerance.',
    '- assessment: the clinician\'s professional interpretation of the subjective and objective findings.',
    '- plan: agreed next steps — exercise prescription, home programme, referrals, follow-up.',
    '',
    'Set success to true when the transcript contains usable clinical content.',
    'If the transcript is empty or contains nothing clinically usable, set success to false and each section to an empty string.',
    '',
    'Transcript:',
    '"""',
    String(transcript ?? ''),
    '"""',
  ].join('\n');
}

export default async function transcribeSession(ctx) {
  const { body, respond } = ctx;
  const { action } = body || {};
  let testFallback;
  try {
    testFallback = resolveTranscriptionFallback(ctx, process.env);
  } catch (error) {
    return respond(500, { code: 'test_provider_injection_rejected', error: error.message });
  }

  // Launch posture: transcription is disabled for users unless expressly
  // enabled (TRANSCRIPTION_ENABLED=1). The code path is kept intact — this
  // is a switch, not a removal. SELFTEST keeps the regression suite running.
  // transcriptionAvailable() is the published predicate (server/
  // capabilities.mjs); it resolves TRANSCRIPTION_ENABLED's 'implied-on'
  // posture through the capability-flag registry, so this gate, the
  // /public-settings capabilities block and the flag manifest cannot drift.
  if (!transcriptionAvailable()) {
    return respond(403, {
      code: TRANSCRIPTION_DISABLED_CODE,
      error: TRANSCRIPTION_DISABLED_MESSAGE,
    });
  }

  if (action === 'transcribe_segment') {
    const {
      audio_url: audioUrl,
      org_id: orgId,
      persistent_session_id: sessionId,
    } = body || {};
    const sequence = Number(body?.sequence);
    const session = ctx.transcriptionSessions?.get(String(sessionId || ''));
    if (!session || session.orgId !== orgId) {
      return respond(404, { code: 'transcription_session_not_found', error: 'The transcription session was not found.' });
    }
    if (session.userId !== ctx.user?.id) {
      return respond(403, { code: 'transcription_session_owner_required', error: 'Only the recording clinician can transcribe this segment.' });
    }
    if (!PERSISTENT_TRANSCRIPTION_OPEN_STATUSES.has(session.status)) {
      return respond(409, {
        code: 'transcription_session_closed',
        error: 'This transcription session is closed and cannot incur further provider processing.',
      });
    }
    const segment = session.segments.find((entry) => entry.sequence === sequence);
    if (!segment || segment.audioUrl !== audioUrl) {
      return respond(404, { code: 'transcription_segment_not_found', error: 'The recording segment was not found.' });
    }
    if (segment.status === 'ready') {
      return respond(200, {
        transcript: segment.transcriptText,
        speakers: segment.speakers,
        session_transcript: session.transcriptText,
        simulated: Boolean(segment.providerReceipt?.simulated),
        provider_receipt: segment.providerReceipt,
        replayed: true,
      });
    }
    if (segment.status === 'transcribing') {
      return respond(409, {
        code: 'transcription_segment_in_progress',
        error: 'This recording segment is already being transcribed.',
      });
    }
    const filePath = resolveUploadPath(audioUrl, { user: ctx.user, orgId });
    if (!filePath) return respond(404, { code: 'audio_not_found', error: 'Audio file not found.' });
    let stat;
    try { stat = fs.lstatSync(filePath); } catch { /* handled below */ }
    if (!stat?.isFile() || stat.isSymbolicLink()) {
      return respond(404, { code: 'audio_not_found', error: 'Audio file not found.' });
    }
    if (!MIME_BY_EXT[path.extname(filePath).toLowerCase()]) {
      return respond(415, { code: 'unsupported_audio_type', error: 'This audio format cannot be transcribed.' });
    }
    if (stat.size <= 0 || stat.size > MAX_AUDIO_BYTES) {
      return respond(stat.size <= 0 ? 400 : 413, {
        code: stat.size <= 0 ? 'empty_audio' : 'audio_too_large',
        error: stat.size <= 0 ? 'The recording segment is empty.' : 'Each recording segment must be no larger than 20 MiB.',
      });
    }
    if (!realPathEnabled()) {
      if (testFallback) {
        const fallback = await testFallback({ action: 'transcribe', audioUrl });
        const transcript = String(fallback?.transcript || '').trim();
        ctx.transcriptionSessions.updateSegmentResult(session.id, sequence, {
          status: 'ready', transcriptText: transcript, speakers: [],
          providerReceipt: { simulated: true }, durationSeconds: segment.durationSeconds || 1,
          lastErrorCode: null,
        });
        const rebuilt = ctx.transcriptionSessions.rebuildTranscript(session.id);
        return respond(200, { ...fallback, transcript, speakers: [], session_transcript: rebuilt.transcriptText });
      }
      return respond(503, { code: TRANSCRIPTION_UNCONFIGURED_CODE, error: TRANSCRIPTION_UNCONFIGURED_MESSAGE });
    }

    ctx.transcriptionSessions.updateSegmentResult(session.id, sequence, {
      status: 'transcribing', lastErrorCode: null,
    });
    let reservation;
    try {
      reservation = await reserveApiUsage(ctx, {
        feature: 'transcription',
        model: DIARIZED_TRANSCRIBE_MODEL,
        estimatedCostMicrousd: ctx.apiUsage?.estimates?.transcriptionMicrousd,
      });
    } catch (error) {
      ctx.transcriptionSessions.updateSegmentResult(session.id, sequence, {
        status: 'error', lastErrorCode: error?.code || 'api_usage_unavailable',
      });
      return respond(apiUsageFailure(error).status, apiUsageFailure(error).body);
    }
    let providerResult;
    try {
      providerResult = await transcribeDiarizedWithOpenAI(filePath);
    } catch (error) {
      await markApiUsageFailed(ctx, reservation.id);
      ctx.transcriptionSessions.updateSegmentResult(session.id, sequence, {
        status: 'error', lastErrorCode: TRANSCRIPTION_PROVIDER_FAILED_CODE,
      });
      ctx.transcriptionSessions.update(session.id, {
        status: 'recoverable', lastErrorCode: TRANSCRIPTION_PROVIDER_FAILED_CODE,
      });
      console.log('[transcribeSession] diarized transcription failed:', error.message);
      return respond(502, { code: TRANSCRIPTION_PROVIDER_FAILED_CODE, error: 'This recording segment could not be transcribed. It remains saved and can be retried.' });
    }
    if (
      typeof providerResult.providerRequestId !== 'string'
      || !providerResult.providerRequestId.trim()
      || !Number.isInteger(providerResult.providerStatus)
      || providerResult.providerStatus < 200
      || providerResult.providerStatus >= 300
    ) {
      await markApiUsageFailed(ctx, reservation.id);
      ctx.transcriptionSessions.updateSegmentResult(session.id, sequence, {
        status: 'error', lastErrorCode: TRANSCRIPTION_PROVIDER_FAILED_CODE,
      });
      ctx.transcriptionSessions.update(session.id, {
        status: 'recoverable', lastErrorCode: TRANSCRIPTION_PROVIDER_FAILED_CODE,
      });
      return respond(502, {
        code: TRANSCRIPTION_PROVIDER_FAILED_CODE,
        error: 'The transcription provider did not return a verifiable receipt. The audio remains saved and can be retried.',
      });
    }
    const { text: safeText } = deidentify(providerResult.text);
    const safeSpeakers = providerResult.segments.map((entry) => ({
      ...entry,
      text: deidentify(entry.text).text,
    }));
    const settlement = {
      reservationId: reservation.id,
      status: 'succeeded',
      inputTokens: providerResult.inputTokens,
      cachedInputTokens: 0,
      outputTokens: providerResult.outputTokens,
      audioSeconds: providerResult.audioSeconds,
      providerRequestId: providerResult.providerRequestId,
    };
    if (
      Number.isSafeInteger(providerResult.inputTokens)
      && Number.isSafeInteger(providerResult.outputTokens)
      && typeof ctx.apiUsage.calculateTranscriptionTokenCostMicrousd === 'function'
    ) {
      settlement.actualCostMicrousd = ctx.apiUsage.calculateTranscriptionTokenCostMicrousd({
        model: DIARIZED_TRANSCRIBE_MODEL,
        inputTokens: providerResult.inputTokens,
        outputTokens: providerResult.outputTokens,
      });
    }
    if (!Number.isSafeInteger(settlement.actualCostMicrousd) || settlement.actualCostMicrousd < 0) {
      await markApiUsageFailed(ctx, reservation.id);
      ctx.transcriptionSessions.updateSegmentResult(session.id, sequence, {
        status: 'error', lastErrorCode: 'api_usage_accounting_unavailable',
      });
      ctx.transcriptionSessions.update(session.id, {
        status: 'recoverable', lastErrorCode: 'api_usage_accounting_unavailable',
      });
      return respond(503, { code: 'api_usage_accounting_unavailable', error: 'AI usage controls are temporarily unavailable. The audio remains saved.' });
    }
    try {
      await settleApiUsage(ctx, settlement);
    } catch (error) {
      ctx.transcriptionSessions.updateSegmentResult(session.id, sequence, {
        status: 'error', lastErrorCode: error?.code || 'api_usage_settlement_failed',
      });
      ctx.transcriptionSessions.update(session.id, {
        status: 'recoverable', lastErrorCode: error?.code || 'api_usage_settlement_failed',
      });
      const failure = apiUsageFailure(error);
      return respond(failure.status, failure.body);
    }
    const providerReceipt = {
      contract_version: PROVIDER_CALL_RECEIPT_CONTRACT_VERSION,
      feature: 'transcription',
      provider: 'openai',
      model: DIARIZED_TRANSCRIBE_MODEL,
      provider_status: providerResult.providerStatus,
      provider_request_id_hash: createHash('sha256').update(providerResult.providerRequestId).digest('hex'),
      usage: {
        audio_seconds: providerResult.audioSeconds,
        input_tokens: providerResult.inputTokens,
        output_tokens: providerResult.outputTokens,
        actual_cost_microusd: settlement.actualCostMicrousd,
      },
    };
    ctx.transcriptionSessions.updateSegmentResult(session.id, sequence, {
      status: 'ready', transcriptText: safeText, speakers: safeSpeakers,
      providerReceipt, durationSeconds: providerResult.audioSeconds,
      lastErrorCode: null,
    });
    const rebuilt = ctx.transcriptionSessions.rebuildTranscript(session.id);
    const refreshed = ctx.transcriptionSessions.get(session.id);
    if (refreshed.status === 'finalising' && refreshed.segments.every((entry) => entry.status === 'ready')) {
      ctx.transcriptionSessions.update(session.id, { status: 'ready', lastErrorCode: null });
    } else if (refreshed.status === 'recoverable') {
      ctx.transcriptionSessions.update(session.id, { status: 'paused', lastErrorCode: null });
    }
    return respond(200, {
      transcript: safeText,
      speakers: safeSpeakers,
      session_transcript: rebuilt.transcriptText,
      simulated: false,
      provider_receipt: providerReceipt,
    });
  }

  if (action === 'structure_transcript') {
    const { org_id: orgId, persistent_session_id: sessionId } = body || {};
    const session = ctx.transcriptionSessions?.get(String(sessionId || ''));
    if (!session || session.orgId !== orgId) {
      return respond(404, { code: 'transcription_session_not_found', error: 'The transcription session was not found.' });
    }
    if (session.userId !== ctx.user?.id) {
      return respond(403, { code: 'transcription_session_owner_required', error: 'Only the recording clinician can structure this transcript.' });
    }
    if (!session.transcriptText.trim()) {
      return respond(409, { code: 'transcription_not_ready', error: 'At least one recording segment must be transcribed first.' });
    }
    if (!llmEnabled()) {
      return respond(503, { code: TRANSCRIPTION_UNCONFIGURED_CODE, error: 'Clinical transcript structuring is not configured on this server.' });
    }
    const prompt = buildTranscriptArtifactPrompt(session);
    const model = pickModel(prompt, TRANSCRIPT_ARTIFACT_SCHEMA);
    let reservation = null;
    try {
      reservation = await reserveApiUsage(ctx, {
        feature: 'soap_dissection', model,
        estimatedCostMicrousd: ctx.apiUsage?.estimates?.soapMicrousd,
      });
      const llmResult = await invokeLLMWithUsage({ prompt, schema: TRANSCRIPT_ARTIFACT_SCHEMA });
      const usage = llmResult.usage || {};
      const settlement = {
        reservationId: reservation.id,
        status: 'succeeded',
        inputTokens: usage.inputTokens ?? null,
        cachedInputTokens: usage.cachedInputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        providerRequestId: llmResult.providerRequestId ?? null,
      };
      if (Number.isSafeInteger(usage.inputTokens) && Number.isSafeInteger(usage.outputTokens)) {
        settlement.actualCostMicrousd = ctx.apiUsage.calculateChatCostMicrousd({
          model: llmResult.model || model,
          inputTokens: usage.inputTokens,
          cachedInputTokens: usage.cachedInputTokens ?? 0,
          outputTokens: usage.outputTokens,
        });
      }
      await settleApiUsage(ctx, settlement);
      const artifacts = llmResult.value;
      const updated = ctx.transcriptionSessions.update(session.id, {
        status: 'ready', artifacts, lastErrorCode: null,
      });
      return respond(200, {
        success: true,
        simulated: false,
        artifacts,
        persistent_session_id: updated.id,
      });
    } catch (error) {
      if (reservation) await markApiUsageFailed(ctx, reservation.id);
      if (Number.isInteger(error?.httpStatus)) {
        const failure = apiUsageFailure(error);
        return respond(failure.status, failure.body);
      }
      console.log('[transcribeSession] transcript structuring failed:', error.message);
      return respond(502, { code: TRANSCRIPTION_PROVIDER_FAILED_CODE, error: 'The transcript is saved, but its clinical workspace could not be prepared. Try again.' });
    }
  }

  if (action === 'transcribe') {
    const {
      audio_url,
      org_id: orgId,
      care_episode_id: careEpisodeId,
      client_id: clientId,
    } = body || {};
    const requiresCareEpisode = resolveActiveProfessionContract(process.env).professionId === 'physio';
    if (requiresCareEpisode || careEpisodeId !== undefined) {
      if (
        typeof careEpisodeId !== 'string' || !careEpisodeId.trim() || careEpisodeId !== careEpisodeId.trim()
        || typeof clientId !== 'string' || !clientId.trim() || clientId !== clientId.trim()
      ) {
        return respond(400, {
          code: 'care_episode_required',
          error: 'A valid saved care episode and patient are required for episode transcription.',
        });
      }
      const episodes = await ctx.entities.PhysioCareEpisode.filter({ id: careEpisodeId, org_id: orgId });
      if (!Array.isArray(episodes) || episodes.length !== 1) {
        return respond(404, {
          code: 'care_episode_not_found',
          error: 'The care episode was not found in this organisation.',
        });
      }
      if (episodes[0].client_id !== clientId) {
        return respond(409, {
          code: 'care_episode_patient_mismatch',
          error: 'The care episode and patient do not match.',
        });
      }
    }
    const filePath = resolveUploadPath(audio_url, { user: ctx.user, orgId });
    if (!filePath) {
      return respond(404, { code: 'audio_not_found', error: 'Audio file not found.' });
    }

    let stat;
    try {
      stat = fs.lstatSync(filePath);
    } catch {
      return respond(404, { code: 'audio_not_found', error: 'Audio file not found.' });
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return respond(404, { code: 'audio_not_found', error: 'Audio file not found.' });
    }
    if (!MIME_BY_EXT[path.extname(filePath).toLowerCase()]) {
      return respond(415, {
        code: 'unsupported_audio_type',
        error: 'This audio format cannot be transcribed. Use WebM, WAV, MP3, MP4, M4A, OGG or FLAC.',
      });
    }
    if (stat.size <= 0) {
      return respond(400, { code: 'empty_audio', error: 'The audio recording is empty.' });
    }
    if (stat.size > MAX_AUDIO_BYTES) {
      return respond(413, {
        code: 'audio_too_large',
        error: 'The audio recording exceeds the 20 MiB transcription limit.',
      });
    }

    if (realPathEnabled()) {
      let reservation;
      try {
        reservation = await reserveApiUsage(ctx, {
          feature: 'transcription',
          model: TRANSCRIBE_MODEL,
          estimatedCostMicrousd: ctx.apiUsage?.estimates?.transcriptionMicrousd,
        });
      } catch (error) {
        const failure = apiUsageFailure(error);
        return respond(failure.status, failure.body);
      }

      let providerResult;
      try {
        providerResult = await transcribeWithOpenAI(filePath);
      } catch (error) {
        console.log('[transcribeSession] real transcription failed:', error.message);
        await markApiUsageFailed(ctx, reservation.id);
        return respond(502, {
          code: TRANSCRIPTION_PROVIDER_FAILED_CODE,
          error: 'Audio transcription is temporarily unavailable.',
        });
      }

      if (
        !(providerResult.audioSeconds > 0)
        || typeof providerResult.providerRequestId !== 'string'
        || !providerResult.providerRequestId.trim()
        || !Number.isInteger(providerResult.providerStatus)
        || providerResult.providerStatus < 200
        || providerResult.providerStatus >= 300
      ) {
        await markApiUsageFailed(ctx, reservation.id);
        return respond(502, {
          code: TRANSCRIPTION_PROVIDER_FAILED_CODE,
          error: 'Audio transcription is temporarily unavailable.',
        });
      }

      // Defence in depth: the transcript is user-visible and is sent back
      // out to the model by dissect_to_soap.
      const { text: safeText } = deidentify(providerResult.text);
      const settlement = {
        reservationId: reservation.id,
        status: 'succeeded',
        audioSeconds: providerResult.audioSeconds,
        providerRequestId: providerResult.providerRequestId,
      };
      try {
        if (
          providerResult.audioSeconds !== null &&
          typeof ctx.apiUsage.calculateTranscriptionCostMicrousd === 'function'
        ) {
          settlement.actualCostMicrousd = ctx.apiUsage.calculateTranscriptionCostMicrousd({
            model: TRANSCRIBE_MODEL,
            audioSeconds: providerResult.audioSeconds,
          });
        }
        if (!Number.isSafeInteger(settlement.actualCostMicrousd) || settlement.actualCostMicrousd < 0) {
          await markApiUsageFailed(ctx, reservation.id);
          return respond(503, {
            code: 'api_usage_accounting_unavailable',
            error: 'AI usage controls are temporarily unavailable.',
          });
        }
        await settleApiUsage(ctx, settlement);
      } catch (error) {
        const failure = apiUsageFailure(error);
        return respond(failure.status, failure.body);
      }
      return respond(200, {
        transcript: safeText,
        simulated: false,
        provider_receipt: {
          contract_version: PROVIDER_CALL_RECEIPT_CONTRACT_VERSION,
          feature: 'transcription',
          provider: 'openai',
          model: TRANSCRIBE_MODEL,
          provider_status: providerResult.providerStatus,
          provider_request_id_hash: createHash('sha256')
            .update(providerResult.providerRequestId)
            .digest('hex'),
          usage: {
            audio_seconds: providerResult.audioSeconds,
            actual_cost_microusd: settlement.actualCostMicrousd,
          },
        },
      });
    }

    if (testFallback) {
      return respond(200, await testFallback({ action: 'transcribe', audioUrl: audio_url }));
    }
    return respond(503, {
      code: TRANSCRIPTION_UNCONFIGURED_CODE,
      error: TRANSCRIPTION_UNCONFIGURED_MESSAGE,
    });
  }

  if (action === 'dissect_to_soap') {
    const { transcript } = body || {};
    const hasTranscript = typeof transcript === 'string' && transcript.trim().length > 0;
    if (!hasTranscript && !testFallback) {
      return respond(400, {
        code: 'transcript_required',
        error: 'A transcript is required before SOAP dissection can run.',
      });
    }

    if (hasTranscript && !testFallback) {
      if (llmEnabled()) {
        const prompt = buildSoapPrompt(transcript);
        const model = pickModel(prompt, SOAP_SCHEMA);
        let reservation = null;
        let providerSucceeded = false;
        try {
          // The usage-aware adapter preserves de-identification, model choice
          // and the JSON-schema mechanism while exposing accounting metadata.
          reservation = await reserveApiUsage(ctx, {
            feature: 'soap_dissection',
            model,
            estimatedCostMicrousd: ctx.apiUsage?.estimates?.soapMicrousd,
          });
          const llmResult = await invokeLLMWithUsage({ prompt, schema: SOAP_SCHEMA });
          providerSucceeded = true;
          const usage = llmResult.usage || {};
          const settlement = {
            reservationId: reservation.id,
            status: 'succeeded',
            inputTokens: usage.inputTokens ?? null,
            cachedInputTokens: usage.cachedInputTokens ?? null,
            outputTokens: usage.outputTokens ?? null,
            providerRequestId: llmResult.providerRequestId ?? null,
          };
          if (
            Number.isFinite(usage.inputTokens) &&
            Number.isFinite(usage.outputTokens) &&
            typeof ctx.apiUsage.calculateChatCostMicrousd === 'function'
          ) {
            settlement.actualCostMicrousd = ctx.apiUsage.calculateChatCostMicrousd({
              model: llmResult.model || model,
              inputTokens: usage.inputTokens,
              cachedInputTokens: usage.cachedInputTokens ?? 0,
              outputTokens: usage.outputTokens,
            });
          }
          await settleApiUsage(ctx, settlement);
          const result = llmResult.value;
          return respond(200, {
            success: result?.success !== false,
            simulated: false,
            subjective: typeof result?.subjective === 'string' ? result.subjective : '',
            objective: typeof result?.objective === 'string' ? result.objective : '',
            assessment: typeof result?.assessment === 'string' ? result.assessment : '',
            plan: typeof result?.plan === 'string' ? result.plan : '',
          });
        } catch (err) {
          if (!reservation || providerSucceeded || Number.isInteger(err?.httpStatus)) {
            const failure = apiUsageFailure(err);
            return respond(failure.status, failure.body);
          }
          await markApiUsageFailed(ctx, reservation.id);
          console.log('[transcribeSession] real dissection failed:', err.message);
          return respond(502, {
            code: TRANSCRIPTION_PROVIDER_FAILED_CODE,
            error: 'SOAP dissection is temporarily unavailable.',
          });
        }
      } else {
        return respond(503, {
          code: TRANSCRIPTION_UNCONFIGURED_CODE,
          error: 'SOAP dissection is not configured on this server.',
        });
      }
    }

    if (testFallback) {
      return respond(200, await testFallback({ action: 'dissect_to_soap', hasTranscript }));
    }
    return respond(503, {
      code: TRANSCRIPTION_UNCONFIGURED_CODE,
      error: 'SOAP dissection is not configured on this server.',
    });
  }

  return respond(400, { error: `Unknown action: ${action}` });
}
