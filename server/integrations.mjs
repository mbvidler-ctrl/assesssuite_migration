// Local mock implementations of the Base44 Core integrations
// (`/api/apps/{appId}/integration-endpoints/Core/{Name}`), per the
// "Integrations" section of docs/shim/20260702-sdk-wire-protocol.md.
//
// The SDK's integrations module posts through the main axios client, which
// unwraps responses (interceptResponses: true — see
// node_modules/@base44/sdk/dist/client.js and
// node_modules/@base44/sdk/dist/utils/axios-client.js): callers receive
// `response.data` directly, not the axios response envelope. Every handler
// here therefore returns exactly the JSON body real call sites destructure.
//
// Response shapes are matched to the consuming components (verified by
// direct read, not assumption):
//   - InvokeLLM: src/components/reports/wizard-steps/SectionEditor.jsx,
//     src/components/client/{MedicationAlerts,AssessmentRecommendations,
//     NutritionPlanCreator}.jsx, src/components/reports/*.jsx,
//     src/pages/{ClientConditions,TreatmentProtocols,AssessmentAudit}.jsx.
//     With response_json_schema -> the schema-shaped object, returned
//     directly (no wrapper: `result.alerts`, `result.recommendations`, a
//     nested protocol object, etc.). Without a schema -> a raw string.
//     Special case (PrivateHealthInitialAssessment.jsx:787): no schema is
//     passed, but the prompt embeds a JSON object literal describing the
//     desired keys and the caller does `JSON.parse(result)` on the string.
//     Detected generically: when no schema is given but the prompt contains
//     a parseable `{ "key": "description", ... }` block, the mock returns a
//     JSON-encoded string using those keys (so JSON.parse succeeds) rather
//     than prose.
//   - SendEmail / SendSMS: fire-and-forget at every call site found
//     (src/components/assessments/FeedbackModal.jsx for SendEmail; no
//     SendSMS consumer exists in src/ at all) — recorded to the outbox
//     tables and a simple {status:'sent'} success shape returned.
//   - UploadFile: uniformly `{ file_url }` across every call site found
//     (SOAPNoteModal, ReferralUploader, ClientDocuments, AdverseEventForm,
//     CBMRunner, MyProfile, SectionEditor).
//   - GenerateImage: no consumer found in src/ — implemented per contract
//     to the stated shape ({ url }) defensively.
//   - ExtractDataFromUploadedFile: uniformly `{ status: 'success'|'error',
//     output, details? }` across every call site found (ReferralUploader
//     x2, ClientDataExtractor, HistoricalAssessmentExtractor); `output` is
//     instantiated from the caller's `json_schema`.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { instantiateSchema, extractJsonKeysFromPrompt } from './mocks/schema-instantiator.mjs';
import { invokeLLM as invokeRealLLM, llmEnabled } from './llm.mjs';
import { sendEmail } from './email.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// UPLOADS_DIR override: in production the uploads store must live on the
// persistent volume (mounted at server/data), so all three readers of this
// path — here (write), server/index.mjs (serve), transcribeSession.mjs
// (read) — resolve the SAME env-driven location. Default unchanged for dev.
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Production posture: when LLM_REQUIRED=1, InvokeLLM never silently falls back
// to the deterministic mock — a real-model failure returns 502 and a missing
// key returns 503, so mock clinical content is never served or persisted in
// production. Unset in dev/demo and always under SELFTEST (mock-fallback kept).
const LLM_REQUIRED = process.env.LLM_REQUIRED === '1';

/**
 * Converts a raw multipart or JSON body buffer into a plain object, mapping
 * any File-typed FormData entries to Buffers under the same key alongside a
 * sibling `${key}__filename` field, and JSON-stringified nested objects back
 * to parsed values (mirrors the SDK's own FormData encoding for
 * integrations — see node_modules/@base44/sdk/dist/modules/integrations.js:
 * File values are appended as files; other object values are
 * JSON.stringify-ed before being appended).
 */
async function parseIntegrationBody(req) {
  const contentType = req.headers['content-type'] || '';
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);

  if (contentType.includes('multipart/form-data')) {
    const response = new Response(raw, { headers: { 'content-type': contentType } });
    const form = await response.formData();
    const body = {};
    const files = {};
    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        files[key] = value;
      } else {
        // Non-file fields may be JSON-encoded objects (per the SDK's
        // integrations module) or plain strings.
        try {
          body[key] = JSON.parse(value);
        } catch {
          body[key] = value;
        }
      }
    }
    return { body, files };
  }

  if (raw.length === 0) return { body: {}, files: {} };
  try {
    return { body: JSON.parse(raw.toString('utf8')), files: {} };
  } catch {
    return { body: {}, files: {} };
  }
}

function sendJson(res, status, payload) {
  const json = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

// ---------------------------------------------------------------------------
// InvokeLLM
// ---------------------------------------------------------------------------

async function handleInvokeLLM(body) {
  const { prompt, response_json_schema: schema } = body || {};
  const schemaObj = schema && typeof schema === 'object' ? { ...schema, type: schema.type || 'object' } : null;
  const jsonKeys = schemaObj ? null : extractJsonKeysFromPrompt(prompt);

  // Real model path (engagement election E6). De-identification is applied
  // inside invokeRealLLM before any egress. The prompt's own wording drives
  // prose-vs-JSON for the no-schema case, so the heuristic is not needed here.
  // Any failure falls through to the deterministic mock so the demo never
  // hard-fails on a network/API error.
  if (llmEnabled()) {
    try {
      return await invokeRealLLM({ prompt, schema: schemaObj });
    } catch (err) {
      if (LLM_REQUIRED) {
        const e = new Error(`AI generation failed: ${err.message}`);
        e.httpStatus = 502;
        throw e;
      }
      console.log('[llm] real model failed, falling back to mock:', err.message);
    }
  } else if (LLM_REQUIRED) {
    // Production: never silently serve mock clinical content when no key is set.
    const e = new Error('AI generation is not configured on this server.');
    e.httpStatus = 503;
    throw e;
  }

  if (schemaObj) {
    return instantiateSchema(schemaObj, 'response');
  }

  // No schema: check whether the prompt itself asks for a JSON-shaped
  // response by embedding an example object literal (PrivateHealthInitial
  // Assessment.jsx pattern) — if so, return a JSON string so the caller's
  // own JSON.parse succeeds; otherwise return placeholder prose.
  if (jsonKeys && jsonKeys.length > 0) {
    const obj = {};
    for (const key of jsonKeys) {
      obj[key] = `Mock generated content for "${key}". Placeholder clinical narrative produced by the local InvokeLLM mock — not real AI output.`;
    }
    return JSON.stringify(obj);
  }

  const topic = typeof prompt === 'string' && prompt.trim() ? prompt.trim().slice(0, 80).replace(/\s+/g, ' ') : 'the requested topic';
  return (
    `This is placeholder narrative content generated by the local InvokeLLM mock in place of ` +
    `a real language model call. It stands in for a response to a prompt beginning: "${topic}". ` +
    `The mock produces deterministic, non-clinical filler prose of sufficient length to exercise ` +
    `downstream formatting, word-count, and editing logic without contacting any external service.`
  );
}

// ---------------------------------------------------------------------------
// ExtractDataFromUploadedFile
// ---------------------------------------------------------------------------

function handleExtractDataFromUploadedFile(body) {
  const { json_schema: schema } = body || {};
  if (!schema || typeof schema !== 'object') {
    return { status: 'error', details: 'json_schema is required' };
  }
  const output = instantiateSchema({ ...schema, type: schema.type || 'object' }, 'output');
  return { status: 'success', output };
}

// ---------------------------------------------------------------------------
// SendEmail / SendSMS
// ---------------------------------------------------------------------------

async function handleSendEmail(body) {
  const { to, subject, body: emailBody } = body || {};
  // sendEmail records to the outbox itself (audit log) and dispatches via
  // Resend when RESEND_API_KEY is set — the same supply-a-key-and-it-works
  // pattern as the Stripe and OpenAI adapters. Return shape unchanged.
  await sendEmail({ to, subject, text: emailBody });
  return { status: 'sent', to, subject };
}

function handleSendSMS(body, outboxSms) {
  const { to, body: smsBody } = body || {};
  outboxSms.record({ to, body: smsBody });
  return { status: 'sent', to };
}

// ---------------------------------------------------------------------------
// UploadFile
// ---------------------------------------------------------------------------

async function handleUploadFile(files) {
  const file = files?.file;
  if (!file) {
    return { error: 'file is required' };
  }
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = path.extname(file.name || '') || '';
  const storedName = `${randomUUID()}${ext}`;
  fs.writeFileSync(path.join(uploadsDir, storedName), buffer);
  return { file_url: `/uploads/${storedName}` };
}

// ---------------------------------------------------------------------------
// GenerateImage
// ---------------------------------------------------------------------------

function handleGenerateImage(body) {
  // No consumer exists in src/ at the time of porting; implemented to the
  // contract's stated shape. A 1x1 transparent PNG data URL avoids writing
  // a binary placeholder asset while still round-tripping as a real image
  // URL a caller could set as an <img src>.
  const transparentPixelDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  return { url: transparentPixelDataUrl };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const HANDLERS = new Set([
  'InvokeLLM',
  'SendEmail',
  'SendSMS',
  'UploadFile',
  'GenerateImage',
  'ExtractDataFromUploadedFile',
]);

/**
 * Handles POST /api/apps/{appId}/integration-endpoints/Core/{endpointName}.
 * `outboxEmail` / `outboxSms` are the repositories created in server/index.mjs
 * (createOutboxRepository(db, 'email'|'sms')), passed in so this module has
 * no independent database handle.
 */
export async function handleCoreIntegration(req, res, { endpointName, outboxEmail, outboxSms }) {
  if (!HANDLERS.has(endpointName)) {
    return sendJson(res, 404, { message: `integration endpoint ${endpointName} not found` });
  }

  const { body, files } = await parseIntegrationBody(req);

  switch (endpointName) {
    case 'InvokeLLM': {
      try {
        const result = await handleInvokeLLM(body);
        // InvokeLLM's real response is either a bare string or a bare object,
        // never wrapped — but HTTP responses need a body. The SDK's axios
        // response-data unwrapping happens beneath JSON parsing, so a JSON
        // string payload (e.g. `"some text"`) decodes back to a JS string,
        // and a JSON object payload decodes back to a JS object — either way
        // JSON.stringify(result) here reproduces exactly what the real
        // platform would send.
        return sendJson(res, 200, result);
      } catch (err) {
        // Production loud-fail (LLM_REQUIRED): surface a real error instead of
        // mock clinical content. Client call sites already catch and toast.
        return sendJson(res, err.httpStatus || 500, { error: err.message });
      }
    }
    case 'ExtractDataFromUploadedFile':
      return sendJson(res, 200, handleExtractDataFromUploadedFile(body));
    case 'SendEmail':
      return sendJson(res, 200, await handleSendEmail(body));
    case 'SendSMS':
      return sendJson(res, 200, handleSendSMS(body, outboxSms));
    case 'UploadFile':
      return sendJson(res, 200, await handleUploadFile(files));
    case 'GenerateImage':
      return sendJson(res, 200, handleGenerateImage(body));
    default:
      return sendJson(res, 404, { message: `integration endpoint ${endpointName} not found` });
  }
}
