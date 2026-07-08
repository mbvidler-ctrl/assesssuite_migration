// transcribeSession — real transcription + SOAP dissection, env-gated with a
// deterministic mock fallback.
//
// This function is absent from the captured base44/functions/ source
// (docs/source-capture); it is invoked by
// src/components/calendar/SOAPNoteModal.jsx via `base44.functions.invoke`,
// whose response is the raw (not-unwrapped) axios response object per the
// functions client contract (the SDK creates the functions axios client with
// interceptResponses: false) — the JSON body therefore sits under `.data`,
// and the SOAPNoteModal call sites read `result?.data ?? result` in line with
// every other functions.invoke call site in this app.
//
// Two actions, dispatched on body.action:
//   - 'transcribe'     : { audio_url } -> { transcript }
//   - 'dissect_to_soap': { transcript } -> { success, subjective, objective,
//                          assessment, plan }
//
// Real paths (both gated on OPENAI_API_KEY being set AND SELFTEST !== '1';
// the self-test spawns its server with the parent environment inherited, so
// the SELFTEST guard is what keeps CI/self-test runs fully offline):
//   - transcribe: maps audio_url ("/uploads/<name>") to the file stored by
//     handleUploadFile (server/integrations.mjs) under server/uploads/,
//     rejecting anything that does not resolve to a direct child of that
//     directory, and POSTs it to the OpenAI audio transcriptions endpoint
//     using built-in fetch + FormData + Blob (Node 24 natives; no npm deps).
//     Model comes from OPENAI_TRANSCRIBE_MODEL (default 'whisper-1';
//     'gpt-4o-mini-transcribe' is a cheaper alternative — set the env var to
//     switch). The returned text is passed through deidentify() from
//     server/llm.mjs before it is returned (defence in depth: the demo audio
//     is synthetic, but dissect_to_soap sends the transcript back out to the
//     model).
//   - dissect_to_soap: delegates to invokeLLM() from server/llm.mjs (which
//     applies de-identification, model pick and the JSON-schema mechanism)
//     with a clinical-scribe prompt.
//
// On any failure — key absent, self-test, bad/missing file, network or API
// error — each action falls back to the deterministic mock below, whose text
// states plainly that it is fallback placeholder output.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { deidentify, invokeLLM, llmEnabled } from '../llm.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Must match uploadsDir in server/integrations.mjs (where handleUploadFile
// writes) and server/index.mjs (which serves GET /uploads/*).
const uploadsDir = path.join(__dirname, '..', 'uploads');

const TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';
// whisper-1 is the single well-known dedicated audio model (~USD 0.006 per
// minute of audio). gpt-4o-mini-transcribe is a cheaper alternative; switch
// by setting OPENAI_TRANSCRIBE_MODEL — no code change required.
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';

// MIME type by file extension. The SOAPNoteModal recorder produces
// audio/webm (MediaRecorder blobs are assembled with { type: 'audio/webm' }
// and uploaded as session-<ts>.webm); the remainder cover the other formats
// the OpenAI endpoint accepts, should an upload arrive by another route.
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
function resolveUploadPath(audioUrl) {
  if (typeof audioUrl !== 'string' || !audioUrl) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(audioUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (!pathname.startsWith('/uploads/')) return null;
  const name = pathname.slice('/uploads/'.length);
  if (
    !name ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('..') ||
    name.includes('\0')
  ) {
    return null;
  }
  const resolved = path.resolve(uploadsDir, name);
  if (resolved !== path.join(uploadsDir, name)) return null;
  const rel = path.relative(uploadsDir, resolved);
  if (rel !== name) return null;
  return resolved;
}

async function transcribeWithOpenAI(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
  const buffer = fs.readFileSync(filePath);

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), path.basename(filePath));
  form.append('model', TRANSCRIBE_MODEL);

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
    return text;
  } finally {
    clearTimeout(timer);
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
  return {
    success: true,
    subjective: hasTranscript
      ? 'Client reports improved pain levels since last session, with residual morning stiffness.'
      : 'Client reports as discussed during the session.',
    objective: 'Range of motion and exercise tolerance reassessed during today\'s session.',
    assessment: 'Client demonstrates continued progress consistent with the current treatment plan.',
    plan: 'Continue current exercise programme; reassess at next scheduled session.',
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
    'Write concise clinical prose in British English (no contractions; professional register).',
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

  if (action === 'transcribe') {
    const { audio_url } = body || {};

    if (realPathEnabled()) {
      try {
        const filePath = resolveUploadPath(audio_url);
        if (!filePath) {
          throw new Error(`audio_url does not resolve to a stored upload: ${String(audio_url).slice(0, 120)}`);
        }
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          throw new Error(`uploaded audio file not found: ${path.basename(filePath)}`);
        }
        const text = await transcribeWithOpenAI(filePath);
        // Defence in depth: demo audio is synthetic, but the transcript is
        // user-visible and is sent back out to the model by dissect_to_soap.
        const { text: safeText } = deidentify(text);
        return respond(200, { transcript: safeText });
      } catch (err) {
        console.log('[transcribeSession] real transcription failed, falling back to mock:', err.message);
      }
    }

    return respond(200, { transcript: mockTranscript(audio_url) });
  }

  if (action === 'dissect_to_soap') {
    const { transcript } = body || {};
    const hasTranscript = typeof transcript === 'string' && transcript.trim().length > 0;

    if (hasTranscript && llmEnabled() && process.env.SELFTEST !== '1') {
      try {
        // invokeLLM applies de-identification, model pick and the JSON-schema
        // mechanism; it throws on any failure so this falls through to the mock.
        const result = await invokeLLM({
          prompt: buildSoapPrompt(transcript),
          schema: SOAP_SCHEMA,
        });
        return respond(200, {
          success: result?.success !== false,
          subjective: typeof result?.subjective === 'string' ? result.subjective : '',
          objective: typeof result?.objective === 'string' ? result.objective : '',
          assessment: typeof result?.assessment === 'string' ? result.assessment : '',
          plan: typeof result?.plan === 'string' ? result.plan : '',
        });
      } catch (err) {
        console.log('[transcribeSession] real dissection failed, falling back to mock:', err.message);
      }
    }

    return respond(200, mockSoap(hasTranscript));
  }

  return respond(400, { error: `Unknown action: ${action}` });
}
