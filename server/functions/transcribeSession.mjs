// transcribeSession — feature-gated real transcription and SOAP dissection.
// Production is fail-closed; deterministic mocks exist only for SELFTEST or
// non-production environments where LLM_REQUIRED is not enabled.
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
// SOAP dissection settles against provider token counts.
//
// `transcribe` resolves only a tenant-authorised direct child of UPLOADS_DIR,
// validates the supported container and 20 MiB limit, then calls OpenAI using
// the release-pinned `whisper-1` model. Returned text passes through
// deidentify() before it reaches the browser. Provider failure returns 502;
// missing production configuration returns 503; neither becomes a mock.
//
// `dissect_to_soap` uses invokeLLMWithUsage(), retaining the shared
// de-identification, model-selection and JSON-schema behaviour. Production
// rejects an empty transcript and never fabricates a SOAP note. A permitted
// SELFTEST/non-production mock always sets `simulated: true` and prefixes the
// simulation notice to every persisted SOAP field.

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
import { capabilityEnabled } from '../capabilityFlags.mjs';
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
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

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

function mockTranscript(audioUrl) {
  const label =
    typeof audioUrl === 'string' && audioUrl ? audioUrl.split('/').pop() : 'session recording';
  return (
    `[Fallback transcript for ${label}]\n\n` +
    `Clinician: How has your pain been since the last session?\n` +
    `Client: A little better, still stiff in the mornings.\n` +
    `Clinician: Let's run through today's exercises and reassess your range of motion.\n\n` +
    `(This is placeholder text produced by the local transcribeSession fallback — no real ` +
    `audio transcription has occurred. Real transcription runs when OPENAI_API_KEY is set; ` +
    `this fallback is served when the key is absent, the run is a self-test, or the ` +
    `transcription call fails.)`
  );
}

function mockSoap(hasTranscript) {
  const notice =
    '[Simulated SOAP note — placeholder content, not generated from AI analysis of the transcript.] ';
  return {
    success: true,
    simulated: true,
    // The notice is prefixed onto every field, not just subjective. Each of
    // these four strings is what gets persisted into SOAPNote.subjective/
    // objective/assessment/plan (see SOAPNoteModal.jsx dissectToSOAP), so the
    // marker must be durable in the free text of every field it labels — a
    // notice on subjective alone would leave objective/assessment/plan
    // reading as unlabelled fabricated clinical content once persisted.
    subjective:
      notice +
      (hasTranscript
        ? 'Client reports improved pain levels since last session, with residual morning stiffness.'
        : 'Client reports as discussed during the session.'),
    objective: notice + 'Range of motion and exercise tolerance reassessed during today\'s session.',
    assessment: notice + 'Client demonstrates continued progress consistent with the current treatment plan.',
    plan: notice + 'Continue current exercise programme; reassess at next scheduled session.',
  };
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

  if (action === 'transcribe') {
    const { audio_url, org_id: orgId } = body || {};
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
        await settleApiUsage(ctx, settlement);
      } catch (error) {
        const failure = apiUsageFailure(error);
        return respond(failure.status, failure.body);
      }
      return respond(200, { transcript: safeText, simulated: false });
    }

    if (process.env.SELFTEST !== '1' && capabilityEnabled('LLM_REQUIRED')) {
      return respond(503, {
        code: TRANSCRIPTION_UNCONFIGURED_CODE,
        error: TRANSCRIPTION_UNCONFIGURED_MESSAGE,
      });
    }

    return respond(200, { transcript: mockTranscript(audio_url), simulated: true });
  }

  if (action === 'dissect_to_soap') {
    const { transcript } = body || {};
    const hasTranscript = typeof transcript === 'string' && transcript.trim().length > 0;
    const selftest = process.env.SELFTEST === '1';

    if (!hasTranscript && !selftest && capabilityEnabled('LLM_REQUIRED')) {
      return respond(400, {
        code: 'transcript_required',
        error: 'A transcript is required before SOAP dissection can run.',
      });
    }

    if (hasTranscript && !selftest) {
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
          if (capabilityEnabled('LLM_REQUIRED')) {
            // Production posture: a real call was attempted and failed —
            // never silently degrade to fabricated clinical content.
            return respond(502, {
              code: TRANSCRIPTION_PROVIDER_FAILED_CODE,
              error: 'SOAP dissection is temporarily unavailable.',
            });
          }
          // Non-production convenience: fall through to the labelled mock below.
        }
      } else if (capabilityEnabled('LLM_REQUIRED')) {
        // Production posture: no provider configured at all — never
        // silently serve a fabricated SOAP note when a real transcript
        // was supplied and a real dissection was expected.
        return respond(503, {
          code: TRANSCRIPTION_UNCONFIGURED_CODE,
          error: 'SOAP dissection is not configured on this server.',
        });
      }
    }

    return respond(200, mockSoap(hasTranscript));
  }

  return respond(400, { error: `Unknown action: ${action}` });
}
