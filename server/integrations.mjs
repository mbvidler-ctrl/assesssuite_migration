// Local implementations of the Base44 Core integrations
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
//     produced by the gated inline Responses API adapter from the caller's
//     validated `json_schema`.

import { extractDocumentData, ExtractionError } from './documentExtraction.mjs';
import {
  APPROVED_UPLOAD_PURPOSES,
  UPLOAD_POLICY,
  UploadError,
  canonicalUploadPath,
} from './uploadRegistry.mjs';
import { issueFileAccessUrl } from './fileAccess.mjs';

import { instantiateSchema, extractJsonKeysFromPrompt } from './mocks/schema-instantiator.mjs';
import { invokeLLM as invokeRealLLM, llmEnabled } from './llm.mjs';
import { sendEmail } from './email.mjs';

// UPLOADS_DIR override: in production the uploads store must live on the
// persistent volume (mounted at server/data), so all three readers of this
// path — here (write), server/index.mjs (serve), transcribeSession.mjs
// (read) — resolve the SAME env-driven location. Default unchanged for dev.

// Production posture: when LLM_REQUIRED=1, InvokeLLM never silently falls back
// to the deterministic mock — a real-model failure returns 502 and a missing
// key returns 503, so mock clinical content is never served or persisted in
// production. Unset in dev/demo and always under SELFTEST (mock-fallback kept).
const LLM_REQUIRED = process.env.LLM_REQUIRED === '1';
const PROCESSING_AUTHORITY_ATTESTATION_VERSION = 'referral-processing-authority-v2026-07-19.1';

/**
 * Converts a raw multipart or JSON body buffer into a plain object, mapping
 * any File-typed FormData entries to Buffers under the same key alongside a
 * sibling `${key}__filename` field, and JSON-stringified nested objects back
 * to parsed values (mirrors the SDK's own FormData encoding for
 * integrations — see node_modules/@base44/sdk/dist/modules/integrations.js:
 * File values are appended as files; other object values are
 * JSON.stringify-ed before being appended).
 */
async function readBoundedRequest(req, maxBytes) {
  const contentLength = req.headers['content-length'];
  if (contentLength !== undefined) {
    const parsed = Number(contentLength);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new UploadError(400, 'invalid_content_length', 'The request length is invalid.');
    }
    if (parsed > maxBytes) {
      req.resume();
      throw new UploadError(413, 'request_too_large', 'The upload request is too large.');
    }
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      req.resume();
      throw new UploadError(413, 'request_too_large', 'The upload request is too large.');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function parseIntegrationBody(req, endpointName) {
  const contentType = req.headers['content-type'] || '';
  const maxBytes = endpointName === 'UploadFile' ? UPLOAD_POLICY.maxRequestBytes : 2 * 1024 * 1024;
  const raw = await readBoundedRequest(req, maxBytes);

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
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(json);
}

// ---------------------------------------------------------------------------
// InvokeLLM
// ---------------------------------------------------------------------------

async function handleInvokeLLM(body) {
  const selftestMockAllowed =
    process.env.SELFTEST === '1' && process.env.GENERAL_CLINICAL_LLM_ENABLED === undefined;
  if (process.env.GENERAL_CLINICAL_LLM_ENABLED !== '1' && !selftestMockAllowed) {
    const error = new Error('General AI generation is disabled on this server.');
    error.httpStatus = 503;
    throw error;
  }
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
    } catch {
      if (LLM_REQUIRED) {
        const e = new Error('AI generation failed.');
        e.httpStatus = 502;
        throw e;
      }
      console.log('[llm] real model failed; using the explicit non-production mock fallback');
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

let activeExtractions = 0;
const activeByUser = new Map();
const activeByOrg = new Map();

function boundedConcurrency(name, fallback, max) {
  const parsed = Number(process.env[name]);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function acquireExtractionSlot(userId, orgId) {
  const globalMax = boundedConcurrency('DOCUMENT_EXTRACTION_MAX_CONCURRENCY', 2, 4);
  const userMax = boundedConcurrency('DOCUMENT_EXTRACTION_USER_CONCURRENCY', 1, 2);
  const orgMax = boundedConcurrency('DOCUMENT_EXTRACTION_ORG_CONCURRENCY', 2, 4);
  if (
    activeExtractions >= globalMax ||
    (activeByUser.get(userId) || 0) >= userMax ||
    (activeByOrg.get(orgId) || 0) >= orgMax
  ) {
    throw new ExtractionError(429, 'extraction_busy', 'Document extraction is busy. Please try again shortly.');
  }
  activeExtractions += 1;
  activeByUser.set(userId, (activeByUser.get(userId) || 0) + 1);
  activeByOrg.set(orgId, (activeByOrg.get(orgId) || 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeExtractions = Math.max(0, activeExtractions - 1);
    const userCount = Math.max(0, (activeByUser.get(userId) || 1) - 1);
    const orgCount = Math.max(0, (activeByOrg.get(orgId) || 1) - 1);
    if (userCount === 0) activeByUser.delete(userId);
    else activeByUser.set(userId, userCount);
    if (orgCount === 0) activeByOrg.delete(orgId);
    else activeByOrg.set(orgId, orgCount);
  };
}

function requireSelectedOrg(body, context) {
  const orgId = typeof body?.org_id === 'string' ? body.org_id.trim() : '';
  if (!orgId) throw new UploadError(400, 'org_required', 'Select the organisation for this request.');
  if (!context.orgIds.includes(orgId)) {
    throw new UploadError(403, 'org_forbidden', 'The selected organisation is unavailable.');
  }
  return orgId;
}

function decodeReferenceSegment(raw) {
  if (
    typeof raw !== 'string' ||
    raw.length === 0 ||
    raw.includes('/') ||
    raw.includes('\\') ||
    /%(?:2f|5c|25)/i.test(raw)
  ) {
    throw new UploadError(400, 'invalid_file_reference', 'The file reference is invalid.');
  }
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    throw new UploadError(400, 'invalid_file_reference', 'The file reference is invalid.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(decoded) || decoded.includes('..')) {
    throw new UploadError(400, 'invalid_file_reference', 'The file reference is invalid.');
  }
  return decoded;
}

function uploadIdFromReference(reference) {
  if (typeof reference !== 'string' || !reference.startsWith('/') || reference.startsWith('//')) {
    throw new UploadError(400, 'external_file_reference', 'Only an AssessSuite file reference can be extracted.');
  }
  const match = /^\/(?:uploads|api\/files)\/([^/?#]+)$/.exec(reference);
  if (!match) throw new UploadError(400, 'invalid_file_reference', 'The file reference is invalid.');
  return decodeReferenceSegment(match[1]);
}

function normalizeExtractionReferences(body) {
  const groups = [];
  if (body?.upload_id !== undefined) groups.push([body.upload_id]);
  if (body?.file_url !== undefined) groups.push([body.file_url]);
  if (body?.upload_ids !== undefined) groups.push(body.upload_ids);
  if (body?.file_urls !== undefined) groups.push(body.file_urls);
  if (groups.length !== 1 || !Array.isArray(groups[0])) {
    throw new UploadError(400, 'invalid_file_reference', 'Provide one file reference or one ordered file-reference list.');
  }
  const references = groups[0];
  if (
    references.length === 0 ||
    references.length > UPLOAD_POLICY.maxFilesPerExtraction ||
    references.some((value) => typeof value !== 'string' || value.length === 0 || value.length > 300)
  ) {
    throw new UploadError(400, 'invalid_file_reference', 'The file-reference list is invalid or too large.');
  }
  if (new Set(references).size !== references.length) {
    throw new UploadError(400, 'duplicate_file_reference', 'Select each file only once.');
  }
  return references;
}

async function resolveRegisteredUpload(reference, context, selectedOrgId) {
  const key = reference.startsWith('/') ? uploadIdFromReference(reference) : decodeReferenceSegment(reference);
  let upload = context.uploadRegistry.getById(key);
  if (!upload && reference.startsWith('/uploads/')) {
    upload = context.uploadRegistry.getByStoredName(key);
    if (!upload && typeof context.resolveLegacyUpload === 'function') {
      upload = await context.resolveLegacyUpload({ storedName: key, selectedOrgId: selectedOrgId });
    }
  }
  if (
    !upload ||
    upload.orgId !== selectedOrgId ||
    !context.orgIds.includes(upload.orgId) ||
    ['deleted', 'expired'].includes(upload.state)
  ) {
    throw new UploadError(404, 'upload_not_found', 'File not found.');
  }
  if (!upload.isLegacy && upload.expiresAt && upload.state !== 'bound' && Date.parse(upload.expiresAt) <= Date.now()) {
    try {
      context.uploadRegistry.transition(upload.id, 'expired', { actorUserId: context.sessionUser.id });
    } catch {
      // The caller still receives the same unknown-resource result.
    }
    throw new UploadError(404, 'upload_not_found', 'File not found.');
  }
  return upload;
}

async function handleExtractDataFromUploadedFile(body, context) {
  const orgId = requireSelectedOrg(body, context);
  if (context.sessionUser.account_status !== 'active') {
    throw new ExtractionError(403, 'account_inactive', 'Account approval is required before document extraction.');
  }
  if (!context.hasExtractionAcceptance(context.sessionUser.email, orgId)) {
    throw new ExtractionError(403, 'acceptance_required', 'Current AI document-extraction acceptance is required.');
  }
  if (body?.processing_authority_confirmed !== true) {
    throw new ExtractionError(
      403,
      'processing_authority_required',
      'Confirm the documented authority for this referral before extraction.',
    );
  }
  const references = normalizeExtractionReferences(body);
  const uploads = [];
  for (const reference of references) {
    const upload = await resolveRegisteredUpload(reference, context, orgId);
    if (!['referral-extraction', 'clinical-attachment', 'report-attachment'].includes(upload.purpose)) {
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
    if (upload.state === 'bound' || (!upload.isLegacy && upload.uploaderUserId !== context.sessionUser.id)) {
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
    uploads.push(upload);
  }

  for (const upload of uploads) {
    context.uploadRegistry.audit({
      uploadId: upload.id,
      orgId,
      actorUserId: context.sessionUser.id,
      eventType: 'processing_authority_attested',
      outcome: 'success',
      metadata: {
        attestation_version: PROCESSING_AUTHORITY_ATTESTATION_VERSION,
        upload_purpose: upload.purpose,
      },
    });
  }

  const releaseSlot = acquireExtractionSlot(context.sessionUser.id, orgId);
  let reservation = null;
  let succeeded = false;
  let actualCostMicrousd = null;
  try {
    reservation = context.uploadRegistry.reserveExtractionUsage({
      userId: context.sessionUser.id,
      orgId,
      uploadCount: uploads.length,
    });
    const files = uploads.map((upload) => {
      context.uploadRegistry.transition(upload.id, 'processing', { actorUserId: context.sessionUser.id });
      const filePath = canonicalUploadPath(context.uploadsDir, upload.storedName, { mustExist: true });
      return { upload, buffer: context.readUploadBuffer(filePath, upload.byteSize) };
    });
    const extracted = await extractDocumentData({
      files,
      schema: body?.json_schema,
      subjectAgeBands: uploads.map((upload) => upload.subjectAgeBand),
    });
    actualCostMicrousd = extracted.actualCostMicrousd;
    for (const upload of uploads) {
      context.uploadRegistry.transition(upload.id, 'review-pending', { actorUserId: context.sessionUser.id });
      context.uploadRegistry.audit({
        uploadId: upload.id,
        orgId,
        actorUserId: context.sessionUser.id,
        eventType: 'document_extraction',
        outcome: 'success',
        metadata: {
          file_count: uploads.length,
          schema_hash: extracted.schemaHash,
          estimated_cost_microusd: reservation.estimatedCostMicrousd,
          actual_cost_microusd: actualCostMicrousd ?? reservation.estimatedCostMicrousd,
          provider_status_class: extracted.providerStatusClass,
          provider_model: extracted.model,
          prompt_version: extracted.promptVersion,
          request_policy: extracted.requestPolicy,
          provider_response_id_hash: extracted.providerResponseIdHash,
        },
      });
    }
    succeeded = true;
    return { status: 'success', output: extracted.output };
  } catch (error) {
    for (const upload of uploads) {
      try {
        const current = context.uploadRegistry.getById(upload.id);
        if (current && !['bound', 'deleted', 'expired'].includes(current.state)) {
          context.uploadRegistry.transition(upload.id, 'temporary', {
            actorUserId: context.sessionUser.id,
            failure: true,
          });
        }
        context.uploadRegistry.audit({
          uploadId: upload.id,
          orgId,
          actorUserId: context.sessionUser.id,
          eventType: 'document_extraction',
          outcome: 'failed',
          metadata: { code: error?.code || 'extraction_failed', file_count: uploads.length },
        });
      } catch {
        // Audit/lifecycle cleanup is best-effort here; the original controlled
        // failure remains the response and the 24-hour outer expiry remains.
      }
    }
    throw error;
  } finally {
    if (reservation) {
      context.uploadRegistry.completeExtractionUsage(reservation.id, {
        succeeded,
        actualCostMicrousd,
      });
    }
    releaseSlot();
  }
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

function subjectAgeBandFromDateOfBirth(value, { required = false, now = new Date() } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new UploadError(400, 'subject_date_of_birth_required', 'Enter the subject date of birth.');
    }
    return 'unknown';
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new UploadError(400, 'invalid_subject_date_of_birth', 'Enter a valid subject date of birth.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day ||
    birthDate.getTime() > now.getTime()
  ) {
    throw new UploadError(400, 'invalid_subject_date_of_birth', 'Enter a valid subject date of birth.');
  }
  let age = now.getUTCFullYear() - year;
  const beforeBirthday =
    now.getUTCMonth() < month - 1 ||
    (now.getUTCMonth() === month - 1 && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age < 13 ? 'under_13' : '13_or_over';
}

async function handleUploadFile(body, files, context) {
  const orgId = requireSelectedOrg(body, context);
  const file = files?.file;
  if (!file) {
    throw new UploadError(400, 'file_required', 'Select a file to upload.');
  }
  const purpose = typeof body?.purpose === 'string' ? body.purpose.trim() : '';
  if (!APPROVED_UPLOAD_PURPOSES.has(purpose)) {
    throw new UploadError(400, 'invalid_purpose', 'Select a supported upload purpose.');
  }
  if (
    purpose !== 'profile-image' &&
    (context.sessionUser.account_status !== 'active' ||
      !context.hasCurrentLegalAcceptance(context.sessionUser.email))
  ) {
    throw new UploadError(403, 'clinical_upload_forbidden', 'Current approved access and legal acceptance are required.');
  }
  if (body?.subject_age_band !== undefined) {
    throw new UploadError(400, 'client_age_band_rejected', 'Submit the subject date of birth, not an age category.');
  }
  const subjectAgeBand = subjectAgeBandFromDateOfBirth(body?.subject_date_of_birth, {
    required: purpose === 'referral-extraction',
  });
  const purposeMaxBytes = purpose === 'referral-extraction' ? UPLOAD_POLICY.maxReferralBytes : UPLOAD_POLICY.maxFileBytes;
  if (file.size <= 0 || file.size > purposeMaxBytes) {
    throw new UploadError(file.size > purposeMaxBytes ? 413 : 400, 'invalid_file_size', 'The selected file size is invalid.');
  }
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const upload = context.uploadRegistry.register({
    buffer,
    originalName: file.name,
    declaredMime: file.type,
    orgId,
    uploaderUserId: context.sessionUser.id,
    purpose,
    subjectAgeBand,
  });
  return { file_url: `/uploads/${upload.id}`, upload_id: upload.id };
}

async function handleCancelTemporaryUploads(body, context) {
  const orgId = requireSelectedOrg(body, context);
  const references = body?.upload_ids;
  if (
    !Array.isArray(references) ||
    references.length === 0 ||
    references.length > UPLOAD_POLICY.maxFilesPerExtraction ||
    references.some((value) => typeof value !== 'string' || value.length === 0 || value.length > 300) ||
    new Set(references).size !== references.length
  ) {
    throw new UploadError(400, 'invalid_file_reference', 'Provide a valid upload list to cancel.');
  }

  const uploads = [];
  for (const reference of references) {
    const upload = await resolveRegisteredUpload(reference, context, orgId);
    if (upload.isLegacy || upload.state === 'bound') {
      throw new UploadError(409, 'upload_not_temporary', 'A retained file cannot be cancelled.');
    }
    uploads.push(upload);
  }

  for (const upload of uploads) {
    context.uploadRegistry.transition(upload.id, 'temporary', {
      actorUserId: context.sessionUser.id,
      failure: true,
    });
    context.uploadRegistry.audit({
      uploadId: upload.id,
      orgId,
      actorUserId: context.sessionUser.id,
      eventType: 'temporary_upload_cancelled',
      outcome: 'success',
      metadata: { cleanup_within_seconds: Math.ceil(UPLOAD_POLICY.failureCleanupMs / 1000) },
    });
  }
  return { status: 'success', scheduled: uploads.length };
}

async function handleRecordLegalAcceptanceBundle(body, context) {
  const orgId = requireSelectedOrg(body, context);
  if (
    body?.marketing_opt_in !== undefined &&
    typeof body.marketing_opt_in !== 'boolean'
  ) {
    throw new UploadError(400, 'invalid_marketing_choice', 'The optional marketing choice is invalid.');
  }
  if (typeof context.recordLegalAcceptanceBundle !== 'function') {
    throw new UploadError(503, 'legal_acceptance_unavailable', 'Legal acceptance is currently unavailable.');
  }
  return context.recordLegalAcceptanceBundle({
    sessionUser: context.sessionUser,
    orgId,
    marketingOptIn: body?.marketing_opt_in === true,
  });
}

async function handleCreateFileAccessUrl(body, context) {
  const orgId = requireSelectedOrg(body, context);
  const reference = typeof body?.file_url === 'string' ? body.file_url : body?.upload_id;
  if (typeof reference !== 'string') {
    throw new UploadError(400, 'invalid_file_reference', 'The file reference is invalid.');
  }
  const upload = await resolveRegisteredUpload(reference, context, orgId);
  if (typeof context.canAccessUpload !== 'function' || !context.canAccessUpload(upload)) {
    throw new UploadError(404, 'upload_not_found', 'File not found.');
  }
  const issued = issueFileAccessUrl({ uploadId: upload.id, orgId, userId: context.sessionUser.id });
  context.uploadRegistry.audit({
    uploadId: upload.id,
    orgId,
    actorUserId: context.sessionUser.id,
    eventType: 'file_access_url_issued',
    outcome: 'success',
    metadata: { purpose: upload.purpose },
  });
  return { file_url: issued.fileUrl, expires_at: issued.expiresAt };
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
  'CreateFileAccessUrl',
  'CancelTemporaryUploads',
  'RecordLegalAcceptanceBundle',
]);

/**
 * Handles POST /api/apps/{appId}/integration-endpoints/Core/{endpointName}.
 * `outboxEmail` / `outboxSms` are the repositories created in server/index.mjs
 * (createOutboxRepository(db, 'email'|'sms')), passed in so this module has
 * no independent database handle.
 */
export async function handleCoreIntegration(req, res, context) {
  const { endpointName, outboxEmail, outboxSms } = context;
  if (!HANDLERS.has(endpointName)) {
    return sendJson(res, 404, { message: `integration endpoint ${endpointName} not found` });
  }

  try {
    const { body, files } = await parseIntegrationBody(req, endpointName);

    switch (endpointName) {
      case 'InvokeLLM': {
        const result = await handleInvokeLLM(body);
        // InvokeLLM's real response is either a bare string or a bare object,
        // never wrapped — but HTTP responses need a body. The SDK's axios
        // response-data unwrapping happens beneath JSON parsing, so a JSON
        // string payload (e.g. `"some text"`) decodes back to a JS string,
        // and a JSON object payload decodes back to a JS object — either way
        // JSON.stringify(result) here reproduces exactly what the real
        // platform would send.
        return sendJson(res, 200, result);
      }
      case 'ExtractDataFromUploadedFile':
        return sendJson(res, 200, await handleExtractDataFromUploadedFile(body, context));
      case 'SendEmail':
        return sendJson(res, 200, await handleSendEmail(body));
      case 'SendSMS':
        return sendJson(res, 200, handleSendSMS(body, outboxSms));
      case 'UploadFile':
        return sendJson(res, 200, await handleUploadFile(body, files, context));
      case 'CreateFileAccessUrl':
        return sendJson(res, 200, await handleCreateFileAccessUrl(body, context));
      case 'CancelTemporaryUploads':
        return sendJson(res, 200, await handleCancelTemporaryUploads(body, context));
      case 'RecordLegalAcceptanceBundle':
        return sendJson(res, 200, await handleRecordLegalAcceptanceBundle(body, context));
      case 'GenerateImage':
        return sendJson(res, 200, handleGenerateImage(body));
      default:
        return sendJson(res, 404, { message: `integration endpoint ${endpointName} not found` });
    }
  } catch (error) {
    const known = error instanceof UploadError || error instanceof ExtractionError || Number.isInteger(error?.httpStatus);
    const status = known ? error.httpStatus || 500 : 500;
    const details = known ? error.publicMessage || error.message : 'The request could not be completed.';
    if (!known) {
      // Metadata only: never print request bodies, file names, provider
      // payloads, tenant identifiers or user data.
      console.error('[integration] request failed', { endpoint: endpointName, code: 'internal_error' });
    }
    if (endpointName === 'ExtractDataFromUploadedFile') {
      return sendJson(res, status, { status: 'error', details });
    }
    return sendJson(res, status, { error: details });
  }
}
