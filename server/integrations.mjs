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
//   - SendEmail / SendSMS: SendEmail is not a generic relay. Its only caller,
//     FeedbackModal.jsx, supplies an AssessmentRequest id; the server verifies
//     ownership and tenant scope, derives both fixed-recipient messages, and
//     rate-limits notifications. No SendSMS consumer exists in src/.
//   - UploadFile: uniformly `{ file_url }` across every call site found
//     (SOAPNoteModal, ReferralUploader, ClientDocuments, AdverseEventForm,
//     CBMRunner, MyProfile, SectionEditor).
//   - GenerateImage: no consumer found in src/ — implemented per contract
//     to the stated shape ({ url }) defensively.
//   - ExtractDataFromUploadedFile: preserves the existing
//     `{ status: 'success'|'error', output, details? }` response contract, but
//     this release permits provider egress only for ReferralUploader and the
//     server-owned canonical referral schema.

import { randomUUID } from 'node:crypto';

import {
  assertCanonicalReferralExtractionSchema,
  assertDocumentExtractionEnabled,
  extractDocumentData,
  ExtractionError,
} from './documentExtraction.mjs';
import {
  APPROVED_UPLOAD_PURPOSES,
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_SOURCE,
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
  UPLOAD_DISPOSITION_RESOLUTION_VERSION,
  UPLOAD_POLICY,
  UploadError,
  canonicalUploadPath,
} from './uploadRegistry.mjs';
import { issueFileAccessUrl } from './fileAccess.mjs';

import { instantiateSchema, extractJsonKeysFromPrompt } from './mocks/schema-instantiator.mjs';
import { invokeLLM as invokeRealLLM, llmEnabled } from './llm.mjs';
import { adminNotificationRecipient, sendEmail } from './email.mjs';
import { createFixedWindowRateLimiter } from './rateLimit.mjs';
import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
} from '../src/lib/referralWorkflow.js';

// UPLOADS_DIR override: in production the uploads store must live on the
// persistent volume (mounted at server/data), so all three readers of this
// path — here (write), server/index.mjs (serve), transcribeSession.mjs
// (read) — resolve the SAME env-driven location. Default unchanged for dev.

// Production posture: when LLM_REQUIRED=1, InvokeLLM never silently falls back
// to the deterministic mock — a real-model failure returns 502 and a missing
// key returns 503, so mock clinical content is never served or persisted in
// production. Unset in dev/demo and always under SELFTEST (mock-fallback kept).
const LLM_REQUIRED = process.env.LLM_REQUIRED === '1';

const diagnosticPolicy = (status, stage, message) => Object.freeze({ status, stage, message });

// Referral errors are deliberately rendered from this closed catalogue. The
// thrown exception contributes only its class and stable code; its message is
// never reflected. This keeps provider text, filenames and request data out of
// both the public response and the content-free operational diagnostic.
const REFERRAL_ERROR_POLICIES = Object.freeze({
  UploadFile: Object.freeze({
    invalid_content_length: diagnosticPolicy(400, 'upload_request', 'The request length is invalid.'),
    request_too_large: diagnosticPolicy(413, 'upload_request', 'The upload request is too large.'),
    upload_capacity_exceeded: diagnosticPolicy(
      429,
      'upload_request',
      'Too many uploads are in progress. Try again shortly.',
    ),
    org_required: diagnosticPolicy(400, 'upload_authorization', 'Select the organisation for this request.'),
    org_forbidden: diagnosticPolicy(403, 'upload_authorization', 'The selected organisation is unavailable.'),
    clinical_upload_forbidden: diagnosticPolicy(
      403,
      'upload_authorization',
      'Current approved access and legal acceptance are required.',
    ),
    file_required: diagnosticPolicy(400, 'upload_validation', 'Select a file to upload.'),
    invalid_purpose: diagnosticPolicy(400, 'upload_validation', 'Select a supported upload purpose.'),
    subject_age_not_applicable: diagnosticPolicy(
      400,
      'upload_validation',
      'Subject age is not accepted for this upload purpose.',
    ),
    subject_date_of_birth_rejected: diagnosticPolicy(
      400,
      'upload_validation',
      'Use the supported patient age attestation.',
    ),
    client_age_attestation_source_rejected: diagnosticPolicy(
      400,
      'upload_validation',
      'The patient age attestation source is server controlled.',
    ),
    subject_age_confirmation_required: diagnosticPolicy(
      400,
      'upload_validation',
      'Confirm the patient is 13 or older.',
    ),
    subject_age_attestation_version_required: diagnosticPolicy(
      400,
      'upload_validation',
      'Refresh AssessSuite before confirming the patient age.',
    ),
    invalid_subject_age_attestation_version: diagnosticPolicy(
      400,
      'upload_validation',
      'Refresh AssessSuite before confirming the patient age.',
    ),
    under_13_review_required: diagnosticPolicy(
      409,
      'upload_authorization',
      'This referral requires a privacy review before automated extraction can be used.',
    ),
    invalid_subject_age_confirmation: diagnosticPolicy(
      400,
      'upload_validation',
      'Confirm the patient is 13 or older.',
    ),
    client_age_band_rejected: diagnosticPolicy(
      400,
      'upload_validation',
      'Use the supported subject age confirmation.',
    ),
    processing_authority_required: diagnosticPolicy(
      403,
      'upload_authorization',
      'Confirm the documented authority for this referral before upload.',
    ),
    processing_authority_attestation_version_required: diagnosticPolicy(
      400,
      'upload_validation',
      'Refresh AssessSuite before confirming referral processing authority.',
    ),
    invalid_processing_authority_attestation_version: diagnosticPolicy(
      400,
      'upload_validation',
      'Refresh AssessSuite before confirming referral processing authority.',
    ),
    client_processing_authority_source_rejected: diagnosticPolicy(
      400,
      'upload_validation',
      'The processing-authority source is server controlled.',
    ),
    processing_authority_not_applicable: diagnosticPolicy(
      400,
      'upload_validation',
      'Referral processing authority is not accepted for this upload purpose.',
    ),
    invalid_referral_authority_provenance: diagnosticPolicy(
      400,
      'upload_validation',
      'The referral authority confirmation is invalid.',
    ),
    referral_authority_not_applicable: diagnosticPolicy(
      400,
      'upload_validation',
      'Referral authority is not accepted for this upload purpose.',
    ),
    invalid_file_size: diagnosticPolicy(400, 'upload_validation', 'The selected file size is invalid.'),
    empty_file: diagnosticPolicy(400, 'upload_validation', 'The selected file is empty.'),
    file_too_large: diagnosticPolicy(413, 'upload_validation', 'The selected file is too large.'),
    unsupported_or_mismatched_file: diagnosticPolicy(
      415,
      'upload_validation',
      'The file type is unsupported or does not match its contents.',
    ),
    purpose_media_mismatch: diagnosticPolicy(
      415,
      'upload_validation',
      'That file type is not supported for the selected purpose.',
    ),
    mime_mismatch: diagnosticPolicy(
      415,
      'upload_validation',
      'The file type is unsupported or does not match its contents.',
    ),
    upload_limit_reached: diagnosticPolicy(
      429,
      'upload_capacity',
      'Upload limit reached. Please try again later.',
    ),
    invalid_age_band: diagnosticPolicy(400, 'upload_validation', 'The subject age category is invalid.'),
    invalid_subject_age_attestation_provenance: diagnosticPolicy(
      400,
      'upload_validation',
      'The patient age attestation is invalid.',
    ),
    subject_age_attestation_not_applicable: diagnosticPolicy(
      400,
      'upload_validation',
      'Patient age attestation is not accepted for this upload purpose.',
    ),
  }),
  ExtractDataFromUploadedFile: Object.freeze({
    invalid_content_length: diagnosticPolicy(400, 'extraction_request', 'The request length is invalid.'),
    request_too_large: diagnosticPolicy(413, 'extraction_request', 'The upload request is too large.'),
    org_required: diagnosticPolicy(400, 'extraction_authorization', 'Select the organisation for this request.'),
    org_forbidden: diagnosticPolicy(403, 'extraction_authorization', 'The selected organisation is unavailable.'),
    clinical_release_unavailable: diagnosticPolicy(
      403,
      'extraction_authorization',
      'Document extraction is not approved for this account profile.',
    ),
    account_inactive: diagnosticPolicy(
      403,
      'extraction_authorization',
      'Account approval is required before document extraction.',
    ),
    acceptance_required: diagnosticPolicy(
      403,
      'extraction_authorization',
      'Current AI document-extraction acceptance is required.',
    ),
    processing_authority_required: diagnosticPolicy(
      403,
      'extraction_authorization',
      'Confirm the documented authority for this referral before extraction.',
    ),
    processing_authority_attestation_version_required: diagnosticPolicy(
      400,
      'extraction_authorization',
      'Refresh AssessSuite before confirming referral processing authority.',
    ),
    invalid_processing_authority_attestation_version: diagnosticPolicy(
      400,
      'extraction_authorization',
      'Refresh AssessSuite before confirming referral processing authority.',
    ),
    client_processing_authority_source_rejected: diagnosticPolicy(
      400,
      'extraction_authorization',
      'The processing-authority source is server controlled.',
    ),
    stored_processing_authority_required: diagnosticPolicy(
      409,
      'extraction_authorization',
      'Re-upload this referral after confirming processing authority.',
    ),
    generic_extraction_disabled: diagnosticPolicy(
      403,
      'extraction_authorization',
      'Automated extraction is approved only for the referral workflow.',
    ),
    provider_retry_blocked: diagnosticPolicy(
      409,
      'post_extraction_age_gate',
      'This referral requires a privacy review before automated extraction can continue.',
    ),
    mixed_extraction_purpose: diagnosticPolicy(
      400,
      'extraction_input',
      'Referral files cannot be extracted with another upload purpose.',
    ),
    under_13_review_required: diagnosticPolicy(
      409,
      'extraction_authorization',
      'This referral requires a privacy review before automated extraction can be used.',
    ),
    invalid_file_reference: diagnosticPolicy(400, 'extraction_input', 'The file reference is invalid.'),
    external_file_reference: diagnosticPolicy(
      400,
      'extraction_input',
      'Only an AssessSuite file reference can be extracted.',
    ),
    duplicate_file_reference: diagnosticPolicy(400, 'extraction_input', 'Select each file only once.'),
    upload_not_found: diagnosticPolicy(404, 'extraction_input', 'File not found.'),
    extraction_busy: diagnosticPolicy(
      429,
      'extraction_capacity',
      'Document extraction is busy. Please try again shortly.',
    ),
    extraction_limit_reached: diagnosticPolicy(
      429,
      'extraction_capacity',
      'Document extraction limit reached. Please try again later.',
    ),
    upload_integrity_failed: diagnosticPolicy(
      409,
      'document_validation',
      'The uploaded file failed integrity validation.',
    ),
    upload_too_large: diagnosticPolicy(413, 'document_validation', 'The uploaded file is too large.'),
    invalid_upload_state: diagnosticPolicy(
      409,
      'upload_lifecycle',
      'The file cannot be moved to that state.',
    ),
    bound_upload_immutable: diagnosticPolicy(
      409,
      'upload_lifecycle',
      'The retained file cannot be changed by temporary-file lifecycle.',
    ),
    upload_changed: diagnosticPolicy(
      409,
      'document_validation',
      'The uploaded file changed before extraction.',
    ),
    missing_file: diagnosticPolicy(400, 'document_validation', 'Select at least one file to extract.'),
    unsupported_document_type: diagnosticPolicy(
      400,
      'document_validation',
      'This file type cannot be extracted.',
    ),
    invalid_csv: diagnosticPolicy(415, 'document_validation', 'The CSV file is not valid UTF-8 text.'),
    csv_too_large: diagnosticPolicy(413, 'document_validation', 'The CSV file is too large to extract safely.'),
    csv_too_complex: diagnosticPolicy(
      413,
      'document_validation',
      'The CSV file is too large or complex to extract safely.',
    ),
    empty_csv: diagnosticPolicy(400, 'document_validation', 'The CSV file contains no data.'),
    extraction_payload_too_large: diagnosticPolicy(
      413,
      'document_validation',
      'The selected files are too large to extract together.',
    ),
    invalid_schema: diagnosticPolicy(400, 'schema_validation', 'The extraction schema is invalid.'),
    noncanonical_referral_schema: diagnosticPolicy(
      400,
      'schema_validation',
      'Use the current AssessSuite referral extraction fields.',
    ),
    invalid_schema_contract: diagnosticPolicy(
      400,
      'schema_validation',
      'The extraction schema contract is invalid.',
    ),
    unsafe_schema_description: diagnosticPolicy(
      400,
      'schema_validation',
      'The extraction schema contains an unsupported field description.',
    ),
    unsupported_schema_keyword: diagnosticPolicy(
      400,
      'schema_validation',
      'The extraction schema uses an unsupported keyword.',
    ),
    invalid_schema_enum: diagnosticPolicy(
      400,
      'schema_validation',
      'The extraction schema contains an invalid enum.',
    ),
    invalid_schema_const: diagnosticPolicy(
      400,
      'schema_validation',
      'The extraction schema contains an invalid constant.',
    ),
    invalid_schema_format: diagnosticPolicy(
      400,
      'schema_validation',
      'The extraction schema uses an unsupported format.',
    ),
    invalid_schema_properties: diagnosticPolicy(
      400,
      'schema_validation',
      'Every object in the extraction schema must define properties.',
    ),
    schema_too_wide: diagnosticPolicy(
      400,
      'schema_validation',
      'The extraction schema contains too many fields.',
    ),
    schema_additional_properties: diagnosticPolicy(
      400,
      'schema_validation',
      'The extraction schema cannot allow undeclared fields.',
    ),
    invalid_schema_required: diagnosticPolicy(
      400,
      'schema_validation',
      'The extraction schema has invalid required fields.',
    ),
    invalid_schema_items: diagnosticPolicy(
      400,
      'schema_validation',
      'Every array in the extraction schema must define item types.',
    ),
    invalid_schema_shape: diagnosticPolicy(
      400,
      'schema_validation',
      'The extraction schema shape is invalid.',
    ),
    invalid_schema_root: diagnosticPolicy(
      400,
      'schema_validation',
      'The extraction schema must describe an object.',
    ),
    extraction_model_override_forbidden: diagnosticPolicy(
      503,
      'provider_configuration',
      'Document extraction is not safely configured.',
    ),
    provider_policy_violation: diagnosticPolicy(
      500,
      'provider_configuration',
      'Document extraction is not safely configured.',
    ),
    extraction_disabled: diagnosticPolicy(
      503,
      'provider_configuration',
      'Document extraction is currently unavailable.',
    ),
    invalid_test_provider_url: diagnosticPolicy(
      500,
      'provider_configuration',
      'Document extraction is not safely configured.',
    ),
    test_provider_required: diagnosticPolicy(
      503,
      'provider_configuration',
      'Document extraction is unavailable in deterministic test mode.',
    ),
    provider_probe_not_acknowledged: diagnosticPolicy(
      503,
      'provider_configuration',
      'Document extraction is not safely configured.',
    ),
    health_data_terms_unconfirmed: diagnosticPolicy(
      503,
      'provider_configuration',
      'Document extraction is not yet configured for health information.',
    ),
    provider_not_configured: diagnosticPolicy(
      503,
      'provider_configuration',
      'Document extraction is currently unavailable.',
    ),
    provider_timeout: diagnosticPolicy(
      504,
      'provider_request',
      'Document extraction timed out. Please try again.',
    ),
    provider_unavailable: diagnosticPolicy(
      502,
      'provider_request',
      'Document extraction is temporarily unavailable.',
    ),
    provider_error: diagnosticPolicy(
      502,
      'provider_response',
      'Document extraction is temporarily unavailable.',
    ),
    provider_response_too_large: diagnosticPolicy(
      502,
      'provider_response',
      'The document could not be extracted reliably.',
    ),
    provider_malformed_response: diagnosticPolicy(
      502,
      'provider_response',
      'The document could not be extracted reliably.',
    ),
    provider_refusal: diagnosticPolicy(
      422,
      'provider_response',
      'The document could not be extracted. Please review it manually.',
    ),
    provider_empty_response: diagnosticPolicy(
      502,
      'provider_response',
      'The document could not be extracted reliably.',
    ),
    provider_incomplete: diagnosticPolicy(
      502,
      'provider_response',
      'The document could not be extracted reliably.',
    ),
    provider_malformed_output: diagnosticPolicy(
      502,
      'provider_response',
      'The document could not be extracted reliably.',
    ),
    provider_model_mismatch: diagnosticPolicy(
      502,
      'provider_response',
      'Document extraction is temporarily unavailable.',
    ),
    extracted_subject_under_13: diagnosticPolicy(
      409,
      'post_extraction_age_gate',
      'This referral requires a privacy review before automated extraction can continue.',
    ),
    schema_invalid_provider_output: diagnosticPolicy(
      502,
      'provider_response',
      'The document could not be extracted reliably.',
    ),
  }),
});

function referralDiagnostic(endpointName, error, reference) {
  const isControlled = error instanceof UploadError || error instanceof ExtractionError;
  const code = isControlled && typeof error.code === 'string' ? error.code : '';
  const endpointPolicies = REFERRAL_ERROR_POLICIES[endpointName];
  const policy = endpointPolicies && Object.hasOwn(endpointPolicies, code)
    ? endpointPolicies[code]
    : null;
  if (policy) {
    const status = Number.isInteger(error.httpStatus) && error.httpStatus >= 400 && error.httpStatus <= 599
      ? error.httpStatus
      : policy.status;
    return { diagnostic_reference: reference, code, ...policy, status };
  }
  return {
    diagnostic_reference: reference,
    code: 'internal_error',
    status: 500,
    stage: endpointName === 'UploadFile' ? 'upload_registration' : 'extraction_internal',
    message: 'The request could not be completed.',
  };
}

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

// Multipart parsing materialises the complete request body before creating
// File objects. Bound concurrent UploadFile requests before any body bytes are
// retained so a burst cannot multiply that memory cost without limit. The
// supported upload workflows are sequential, so one request per user and two
// process-wide preserve normal use while sharply bounding memory pressure.
const MAX_CONCURRENT_UPLOAD_REQUESTS = 2;
const MAX_CONCURRENT_UPLOAD_REQUESTS_PER_USER = 1;
let activeUploadRequests = 0;
const activeUploadRequestsByUser = new Map();

function acquireUploadAdmission(req, userId) {
  const userKey = typeof userId === 'string' && userId.length > 0 ? userId : '__missing_session_user__';
  const activeForUser = activeUploadRequestsByUser.get(userKey) || 0;
  if (
    activeUploadRequests >= MAX_CONCURRENT_UPLOAD_REQUESTS ||
    activeForUser >= MAX_CONCURRENT_UPLOAD_REQUESTS_PER_USER
  ) {
    // Continue consuming the socket without retaining chunks. Destroying it
    // here could prevent the caller from receiving the controlled 429 JSON.
    req.on('error', () => {});
    req.resume();
    throw new UploadError(
      429,
      'upload_capacity_exceeded',
      'Too many uploads are in progress. Try again shortly.',
    );
  }

  activeUploadRequests += 1;
  activeUploadRequestsByUser.set(userKey, activeForUser + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeUploadRequests = Math.max(0, activeUploadRequests - 1);
    const remainingForUser = Math.max(0, (activeUploadRequestsByUser.get(userKey) || 1) - 1);
    if (remainingForUser === 0) activeUploadRequestsByUser.delete(userKey);
    else activeUploadRequestsByUser.set(userKey, remainingForUser);
  };
}

async function parseIntegrationBody(req, endpointName) {
  const contentType = req.headers['content-type'] || '';
  const maxBytes = endpointName === 'UploadFile'
    ? UPLOAD_POLICY.maxRequestBytes
    : endpointName === 'EnsureFounderOrganization'
      ? 8 * 1024
      : 2 * 1024 * 1024;
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
    ['registering', 'deleted', 'expired'].includes(upload.state)
  ) {
    throw new UploadError(404, 'upload_not_found', 'File not found.');
  }
  return upload;
}

function rejectDuplicateResolvedUploads(uploads) {
  const canonicalIds = uploads.map((upload) => upload.id);
  if (new Set(canonicalIds).size !== canonicalIds.length) {
    throw new UploadError(400, 'duplicate_file_reference', 'Select each file only once.');
  }
}

function rejectExpiredResolvedUploads(uploads, context) {
  for (const upload of uploads) {
    if (
      !upload.isLegacy &&
      upload.expiresAt &&
      upload.state !== 'bound' &&
      Date.parse(upload.expiresAt) <= Date.now()
    ) {
      try {
        context.uploadRegistry.transition(upload.id, 'expired', { actorUserId: context.sessionUser.id });
      } catch {
        // The caller still receives the same unknown-resource result.
      }
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
  }
}

async function handleExtractDataFromUploadedFile(body, context) {
  // Compatibility/rollback mode is a true feature kill switch. Refuse before
  // resolving uploads or creating authority, usage, lifecycle or file-read
  // side effects. The adapter repeats this guard for direct callers.
  assertDocumentExtractionEnabled();
  const orgId = requireSelectedOrg(body, context);
  if (typeof context.isClinicalUseEligible !== 'function' || !context.isClinicalUseEligible()) {
    throw new ExtractionError(
      403,
      'clinical_release_unavailable',
      'Document extraction is not approved for this account profile.',
    );
  }
  if (context.sessionUser.account_status !== 'active') {
    throw new ExtractionError(403, 'account_inactive', 'Account approval is required before document extraction.');
  }
  if (!context.hasExtractionAcceptance(context.sessionUser.email, orgId)) {
    throw new ExtractionError(403, 'acceptance_required', 'Current AI document-extraction acceptance is required.');
  }
  // Every provider egress keeps the existing point-of-action authority gate.
  // The release boundary below then requires the exact referral version and
  // upload-bound provenance; generic clinical/report extraction is disabled.
  if (body?.processing_authority_confirmed !== true) {
    throw new ExtractionError(
      403,
      'processing_authority_required',
      'Confirm the documented authority for this referral before extraction.',
    );
  }
  if (body?.processing_authority_attestation_source !== undefined) {
    throw new ExtractionError(
      400,
      'client_processing_authority_source_rejected',
      'The processing-authority source is server controlled.',
    );
  }
  const references = normalizeExtractionReferences(body);
  const uploads = [];
  for (const reference of references) {
    const upload = await resolveRegisteredUpload(reference, context, orgId);
    if (!['referral-extraction', 'clinical-attachment', 'report-attachment'].includes(upload.purpose)) {
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
    if (!upload.isLegacy && upload.state !== 'bound' && upload.uploaderUserId !== context.sessionUser.id) {
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
    uploads.push(upload);
  }
  // Raw references are not canonical identities: an upload id, its returned
  // /uploads URL, its authenticated /api/files URL and its stored-name alias
  // may all resolve to the same registry row. Reject that repeated canonical
  // id before lifecycle, audit, usage-reservation or provider side effects.
  rejectDuplicateResolvedUploads(uploads);
  rejectExpiredResolvedUploads(uploads, context);

  const referralUploadCount = uploads.filter((upload) => upload.purpose === 'referral-extraction').length;
  if (referralUploadCount !== uploads.length) {
    throw new ExtractionError(
      403,
      'generic_extraction_disabled',
      'Automated extraction is approved only for the referral workflow.',
    );
  }
  const isReferralExtraction = true;
  if (isReferralExtraction) {
    if (body?.processing_authority_attestation_version === undefined) {
      throw new ExtractionError(
        400,
        'processing_authority_attestation_version_required',
        'Refresh AssessSuite before confirming referral processing authority.',
      );
    }
    if (
      body.processing_authority_attestation_version !==
      REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION
    ) {
      throw new ExtractionError(
        400,
        'invalid_processing_authority_attestation_version',
        'Refresh AssessSuite before confirming referral processing authority.',
      );
    }
    // This check is intentionally before every lifecycle, audit, usage or
    // provider write. The provider receives only the frozen server schema.
    assertCanonicalReferralExtractionSchema(body?.json_schema);
    if (uploads.some((upload) => !context.uploadRegistry.hasReferralProcessingAuthority(upload.id))) {
      throw new ExtractionError(
        409,
        'stored_processing_authority_required',
        'Re-upload this referral after confirming processing authority.',
      );
    }
    if (uploads.some((upload) => context.uploadRegistry.isProviderBlocked(upload.id))) {
      throw new ExtractionError(
        409,
        'provider_retry_blocked',
        'This referral requires a privacy review before automated extraction can continue.',
      );
    }
  }

  for (const upload of isReferralExtraction ? uploads : []) {
    context.uploadRegistry.audit({
      uploadId: upload.id,
      orgId,
      actorUserId: context.sessionUser.id,
      eventType: 'processing_authority_attested',
      outcome: 'success',
      metadata: {
        processing_authority_attestation_source:
          REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_SOURCE,
        processing_authority_attestation_version:
          REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
        processing_authority_confirmed: true,
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
      if (upload.state !== 'bound') {
        context.uploadRegistry.transition(upload.id, 'processing', { actorUserId: context.sessionUser.id });
      }
      const filePath = canonicalUploadPath(context.uploadsDir, upload.storedName, { mustExist: true });
      return { upload, buffer: context.readUploadBuffer(filePath, upload.byteSize) };
    });
    const extracted = await extractDocumentData({
      files,
      schema: body?.json_schema,
      subjectAgeBands: uploads.map((upload) => upload.subjectAgeBand),
      schemaContract: 'referral',
    });
    actualCostMicrousd = extracted.actualCostMicrousd;
    for (const upload of uploads) {
      if (upload.state !== 'bound') {
        context.uploadRegistry.transition(upload.id, 'review-pending', { actorUserId: context.sessionUser.id });
      }
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
          provider_request_constructed: true,
          provider_contact_attempted: true,
          request_store_disabled: extracted.requestPolicy?.store === true,
          request_background_disabled: extracted.requestPolicy?.background === true,
          request_prompt_cache_in_memory: extracted.requestPolicy?.prompt_cache_retention === true,
          request_tools_disabled: extracted.requestPolicy?.tools === true,
          request_inline_only: extracted.requestPolicy?.inline === true,
          request_conversation_state_disabled: extracted.requestPolicy?.has_conversation_state === false,
          provider_response_id_hash: extracted.providerResponseIdHash,
        },
      });
    }
    succeeded = true;
    return { status: 'success', output: extracted.output };
  } catch (error) {
    const diagnostic = referralDiagnostic(
      'ExtractDataFromUploadedFile',
      error,
      context.diagnosticReference || randomUUID(),
    );
    if (error?.code === 'extracted_subject_under_13') {
      for (const upload of uploads) {
        try {
          context.uploadRegistry.quarantineExtractedUnder13(upload.id, {
            actorUserId: context.sessionUser.id,
          });
        } catch {
          // The original fail-closed response remains authoritative. The
          // independent provider-block control survives a database quarantine
          // failure, and the pre-provider shortened expiry remains in force.
        }
      }
    }
    for (const upload of uploads) {
      try {
        const current = context.uploadRegistry.getById(upload.id);
        if (current && !['bound', 'deleted', 'expired'].includes(current.state)) {
          context.uploadRegistry.transition(upload.id, 'temporary', {
            actorUserId: context.sessionUser.id,
            failure: true,
          });
        }
        const provenance = error?.extractionProvenance;
        const providerAttempt = provenance
          ? {
              schema_hash: provenance.schemaHash,
              provider_status_class: provenance.providerStatusClass,
              provider_model: provenance.model,
              prompt_version: provenance.promptVersion,
              provider_request_constructed: true,
              provider_contact_attempted: true,
              request_store_disabled: provenance.requestPolicy?.store === true,
              request_background_disabled: provenance.requestPolicy?.background === true,
              request_prompt_cache_in_memory: provenance.requestPolicy?.prompt_cache_retention === true,
              request_tools_disabled: provenance.requestPolicy?.tools === true,
              request_inline_only: provenance.requestPolicy?.inline === true,
              request_conversation_state_disabled:
                provenance.requestPolicy?.has_conversation_state === false,
            }
          : {
              provider_request_constructed: false,
              provider_contact_attempted: false,
            };
        context.uploadRegistry.audit({
          uploadId: upload.id,
          orgId,
          actorUserId: context.sessionUser.id,
          eventType: 'document_extraction',
          outcome: 'failed',
          metadata: {
            diagnostic_reference: diagnostic.diagnostic_reference,
            stage: diagnostic.stage,
            code: diagnostic.code,
            file_count: uploads.length,
            ...providerAttempt,
          },
        });
      } catch {
        // Audit/lifecycle cleanup is best-effort here; the original controlled
        // failure remains the response. Provider-attempted files retain the
        // already-shortened expiry established before provider contact.
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

const FEEDBACK_NOTIFICATION_RATE_LIMITER = createFixedWindowRateLimiter({
  limit: 5,
  windowMs: 60 * 60 * 1000,
});
const ASSESSMENT_REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FEEDBACK_EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,189}$/;
const FEEDBACK_REQUEST_TYPES = Object.freeze({
  new_assessment: 'New assessment request',
  error_report: 'Assessment error report',
});

function feedbackRequestError(status, code, message) {
  return new UploadError(status, code, message);
}

function validateFeedbackNotificationRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw feedbackRequestError(
      400,
      'invalid_feedback_notification_request',
      'Provide an assessment request to notify.',
    );
  }
  const keys = Reflect.ownKeys(body);
  if (keys.length !== 1 || keys[0] !== 'assessment_request_id') {
    throw feedbackRequestError(
      400,
      'invalid_feedback_notification_request',
      'Feedback notifications accept only an assessment request identifier.',
    );
  }
  if (typeof body.assessment_request_id !== 'string' || !ASSESSMENT_REQUEST_ID_RE.test(body.assessment_request_id)) {
    throw feedbackRequestError(
      400,
      'invalid_assessment_request_id',
      'Provide a valid assessment request identifier.',
    );
  }
  return body.assessment_request_id;
}

function boundedFeedbackText(value, maxLength, { optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    return optional ? '' : null;
  }
  if (typeof value !== 'string' || value.length > maxLength || value.includes('\u0000')) return null;
  const trimmed = value.trim();
  if (!trimmed) return optional ? '' : null;
  return trimmed;
}

function validateAssessmentRequestRecord(record) {
  const requestTypeLabel = FEEDBACK_REQUEST_TYPES[record?.request_type];
  const details = boundedFeedbackText(record?.details, 5_000);
  const assessmentName = boundedFeedbackText(record?.assessment_name, 200, { optional: true });
  const createdAtMs = Date.parse(record?.created_date);
  if (
    !requestTypeLabel ||
    details === null ||
    assessmentName === null ||
    record?.status !== 'pending' ||
    !Number.isFinite(createdAtMs)
  ) {
    throw feedbackRequestError(
      400,
      'invalid_assessment_request_record',
      'The assessment request cannot be notified in its current state.',
    );
  }
  return {
    assessmentName,
    createdAt: new Date(createdAtMs).toISOString(),
    details,
    requestTypeLabel,
  };
}

function notificationWasRecorded(outboxEmail, to, subject) {
  return outboxEmail.listAll().some((item) => item.to === to && item.subject === subject);
}

async function handleSendEmail(body, context) {
  if (!context?.sessionUser || typeof context.sessionUser.email !== 'string') {
    throw feedbackRequestError(401, 'authentication_required', 'Sign in to submit feedback.');
  }
  if (
    context.sessionUser.email_verified !== true ||
    context.sessionUser.account_status !== 'active' ||
    context.sessionUser.subscription_status !== 'active'
  ) {
    throw feedbackRequestError(
      403,
      'feedback_notification_not_permitted',
      'An active verified subscription is required to submit feedback notifications.',
    );
  }

  const assessmentRequestId = validateFeedbackNotificationRequest(body);
  if (typeof context.getAssessmentRequest !== 'function' || typeof context.outboxEmail?.listAll !== 'function') {
    throw feedbackRequestError(503, 'feedback_notification_unavailable', 'Feedback notification is unavailable.');
  }
  const assessmentRequest = context.getAssessmentRequest(assessmentRequestId);
  if (
    !assessmentRequest ||
    assessmentRequest.user_email !== context.sessionUser.email ||
    !Array.isArray(context.orgIds) ||
    !context.orgIds.includes(assessmentRequest.org_id)
  ) {
    throw feedbackRequestError(404, 'assessment_request_not_found', 'Assessment request not found.');
  }
  const request = validateAssessmentRequestRecord(assessmentRequest);

  const adminRecipient = adminNotificationRecipient();
  if (
    typeof adminRecipient !== 'string' ||
    adminRecipient.length > 254 ||
    adminRecipient !== adminRecipient.trim() ||
    !FEEDBACK_EMAIL_RE.test(adminRecipient)
  ) {
    throw feedbackRequestError(
      503,
      'feedback_notification_unavailable',
      'Feedback notification is unavailable.',
    );
  }

  const adminSubject = `AssessSuite feedback [${assessmentRequestId}]`;
  const confirmationSubject = `AssessSuite request confirmation [${assessmentRequestId}]`;
  const adminRecorded = notificationWasRecorded(context.outboxEmail, adminRecipient, adminSubject);
  const confirmationRecorded = notificationWasRecorded(
    context.outboxEmail,
    context.sessionUser.email,
    confirmationSubject,
  );
  if (adminRecorded && confirmationRecorded) {
    return {
      status: 'already_recorded',
      assessment_request_id: assessmentRequestId,
      recorded: true,
      sent: false,
    };
  }

  const quota = FEEDBACK_NOTIFICATION_RATE_LIMITER.consume(context.sessionUser.id || context.sessionUser.email);
  if (!quota.allowed) {
    throw feedbackRequestError(
      429,
      'feedback_notification_rate_limited',
      'Too many feedback notifications have been requested. Try again later.',
    );
  }

  const submitterName = boundedFeedbackText(context.sessionUser.full_name, 200, { optional: true }) ||
    context.sessionUser.email;
  const assessmentLine = request.assessmentName ? `\nAssessment: ${request.assessmentName}` : '';
  const requestSummary = [
    `Request ID: ${assessmentRequestId}`,
    `Request type: ${request.requestTypeLabel}${assessmentLine}`,
    `Submitted by: ${submitterName} (${context.sessionUser.email})`,
    `Submitted at: ${request.createdAt}`,
    '',
    'Details:',
    request.details,
  ].join('\n');
  const deliveries = [];
  if (!adminRecorded) {
    deliveries.push(await sendEmail({
      to: adminRecipient,
      subject: adminSubject,
      text: `${requestSummary}\n\nReview this request in the Admin Dashboard assessment requests view.`,
    }));
  }
  if (!confirmationRecorded) {
    deliveries.push(await sendEmail({
      to: context.sessionUser.email,
      subject: confirmationSubject,
      text: `Thank you for your feedback. Your request has been logged for review.\n\n${requestSummary}`,
    }));
  }

  const recorded = deliveries.every((delivery) => delivery?.recorded === true);
  const sent = deliveries.every((delivery) => delivery?.sent === true);
  return {
    status: sent ? 'sent' : recorded ? 'recorded' : 'failed',
    assessment_request_id: assessmentRequestId,
    recorded,
    sent,
  };
}

function handleSendSMS(body, outboxSms) {
  const { to, body: smsBody } = body || {};
  outboxSms.record({ to, body: smsBody });
  return { status: 'sent', to };
}

// ---------------------------------------------------------------------------
// UploadFile
// ---------------------------------------------------------------------------

function subjectAgeAttestationFromUploadRequest(body, purpose) {
  const confirmation = body?.subject_age_confirmation;
  const attestationVersion = body?.subject_age_attestation_version;
  const attestationSource = body?.subject_age_attestation_source;
  const dateOfBirth = body?.subject_date_of_birth;

  if (purpose !== 'referral-extraction') {
    if (
      confirmation !== undefined ||
      attestationVersion !== undefined ||
      attestationSource !== undefined ||
      dateOfBirth !== undefined
    ) {
      throw new UploadError(400, 'subject_age_not_applicable', 'Subject age is not accepted for this upload purpose.');
    }
    return { band: 'unknown', version: null };
  }

  // The trust boundary is the authenticated practitioner's explicit action,
  // not a DOB field or a client-computed age band. Reject every superseded
  // representation before bytes are registered or any provider can run.
  if (dateOfBirth !== undefined) {
    throw new UploadError(
      400,
      'subject_date_of_birth_rejected',
      'Use the supported patient age attestation.',
    );
  }
  if (attestationSource !== undefined) {
    throw new UploadError(
      400,
      'client_age_attestation_source_rejected',
      'The patient age attestation source is server controlled.',
    );
  }
  if (confirmation === undefined) {
    throw new UploadError(400, 'subject_age_confirmation_required', 'Confirm the patient is 13 or older.');
  }
  if (attestationVersion === undefined) {
    throw new UploadError(
      400,
      'subject_age_attestation_version_required',
      'Refresh AssessSuite before confirming the patient age.',
    );
  }
  if (attestationVersion !== REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION) {
    throw new UploadError(
      400,
      'invalid_subject_age_attestation_version',
      'Refresh AssessSuite before confirming the patient age.',
    );
  }
  if (confirmation === 'under_13') {
    throw new UploadError(
      409,
      'under_13_review_required',
      'This referral requires a privacy review before automated extraction can be used.',
    );
  }
  if (confirmation !== REFERRAL_SUBJECT_AGE_CONFIRMATION) {
    throw new UploadError(400, 'invalid_subject_age_confirmation', 'Confirm the patient is 13 or older.');
  }
  return {
    band: REFERRAL_SUBJECT_AGE_CONFIRMATION,
    version: REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  };
}

function processingAuthorityAttestationFromUploadRequest(body, purpose) {
  const confirmed = body?.processing_authority_confirmed;
  const attestationVersion = body?.processing_authority_attestation_version;
  const attestationSource = body?.processing_authority_attestation_source;
  if (purpose !== 'referral-extraction') {
    if (
      confirmed !== undefined ||
      attestationVersion !== undefined ||
      attestationSource !== undefined
    ) {
      throw new UploadError(
        400,
        'processing_authority_not_applicable',
        'Referral processing authority is not accepted for this upload purpose.',
      );
    }
    return { confirmed: null, version: null };
  }
  if (attestationSource !== undefined) {
    throw new UploadError(
      400,
      'client_processing_authority_source_rejected',
      'The processing-authority source is server controlled.',
    );
  }
  if (confirmed !== true) {
    throw new UploadError(
      403,
      'processing_authority_required',
      'Confirm the documented authority for this referral before upload.',
    );
  }
  if (attestationVersion === undefined) {
    throw new UploadError(
      400,
      'processing_authority_attestation_version_required',
      'Refresh AssessSuite before confirming referral processing authority.',
    );
  }
  if (attestationVersion !== REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION) {
    throw new UploadError(
      400,
      'invalid_processing_authority_attestation_version',
      'Refresh AssessSuite before confirming referral processing authority.',
    );
  }
  return { confirmed: true, version: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION };
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
    (typeof context.isClinicalUseEligible !== 'function' ||
      !context.isClinicalUseEligible() ||
      context.sessionUser.account_status !== 'active' ||
      !context.hasCurrentLegalAcceptance(context.sessionUser.email, orgId))
  ) {
    throw new UploadError(403, 'clinical_upload_forbidden', 'Current approved access and legal acceptance are required.');
  }
  if (body?.subject_age_band !== undefined) {
    throw new UploadError(400, 'client_age_band_rejected', 'Use the supported subject age confirmation.');
  }
  const subjectAgeAttestation = subjectAgeAttestationFromUploadRequest(body, purpose);
  const processingAuthorityAttestation = processingAuthorityAttestationFromUploadRequest(body, purpose);
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
    subjectAgeBand: subjectAgeAttestation.band,
    subjectAgeAttestationVersion: subjectAgeAttestation.version,
    processingAuthorityConfirmed: processingAuthorityAttestation.confirmed,
    processingAuthorityAttestationVersion: processingAuthorityAttestation.version,
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
    if (upload.uploaderUserId !== context.sessionUser.id) {
      throw new UploadError(404, 'upload_not_found', 'File not found.');
    }
    uploads.push(upload);
  }

  for (const upload of uploads) {
    context.uploadRegistry.cancelTemporary(upload.id, { actorUserId: context.sessionUser.id });
  }
  return { status: 'success', deleted: uploads.length };
}

function handleGetUploadDispositionReport(body, context) {
  const orgId = body?.org_id === undefined ? null : body.org_id;
  const report = context.uploadRegistry.getUploadDispositionReport({
    actorUserId: context.sessionUser.id,
    orgId,
  });
  return {
    status: 'success',
    resolution_version: UPLOAD_DISPOSITION_RESOLUTION_VERSION,
    report,
  };
}

function handleResolveUploadDisposition(body, context) {
  const report = context.uploadRegistry.resolveUploadDisposition({
    uploadId: typeof body?.upload_id === 'string' ? body.upload_id.trim() : body?.upload_id,
    orgId: typeof body?.org_id === 'string' ? body.org_id.trim() : body?.org_id,
    actorUserId: context.sessionUser.id,
    resolution: body?.resolution,
    resolutionVersion: body?.resolution_version,
    retentionBasis: body?.retention_basis,
    expectedUpdatedAt: body?.expected_updated_at,
  });
  return {
    status: 'success',
    resolution_version: UPLOAD_DISPOSITION_RESOLUTION_VERSION,
    report,
  };
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

// ---------------------------------------------------------------------------
// Founder organisation bootstrap
// ---------------------------------------------------------------------------

const FOUNDER_CLINIC_NAME_MAX_CODE_POINTS = 160;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;

function validateFounderClinicName(value) {
  if (typeof value !== 'string') {
    throw new UploadError(400, 'invalid_clinic_name', 'Enter a valid practice name.');
  }
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (
    normalized.length === 0 ||
    Array.from(normalized).length > FOUNDER_CLINIC_NAME_MAX_CODE_POINTS ||
    CONTROL_CHARACTERS.test(normalized)
  ) {
    throw new UploadError(400, 'invalid_clinic_name', 'Enter a valid practice name.');
  }
  return normalized;
}

function compareStableRecords(left, right) {
  const dateOrder = String(left?.created_date || '').localeCompare(String(right?.created_date || ''));
  if (dateOrder !== 0) return dateOrder;
  return String(left?.id || '').localeCompare(String(right?.id || ''));
}

function comparableStoredClinicName(value) {
  try {
    return validateFounderClinicName(value);
  } catch {
    return null;
  }
}

function safeFounderOrganizationIdentity(organization) {
  return { id: organization.id, name: organization.name };
}

/**
 * Build the sole server-authorised founder-organisation mutation. The caller
 * supplies only a display name. User identity, owner role and primary status
 * are derived from the authenticated session and the complete read/create
 * sequence is serialized by one SQLite write transaction.
 *
 * The deterministic replay order also recovers the exact legacy partial state
 * produced by the former two-call browser flow: an unreferenced organisation
 * created by this user with the same normalized name is adopted instead of
 * creating another orphan.
 */
export function createFounderOrganizationEnsurer({
  db,
  organizationRepo,
  organizationMemberRepo,
}) {
  return function ensureFounderOrganization({ sessionUser, clinicName }) {
    const normalizedClinicName = validateFounderClinicName(clinicName);
    const userEmail = typeof sessionUser?.email === 'string'
      ? sessionUser.email.trim().toLowerCase()
      : '';
    if (!sessionUser?.id || !userEmail) {
      throw new UploadError(401, 'authentication_required', 'Authentication is required.');
    }
    if (
      sessionUser.role === 'admin' ||
      sessionUser.account_status !== 'active' ||
      sessionUser.subscription_status !== 'active'
    ) {
      throw new UploadError(
        403,
        'founder_organization_forbidden',
        'Complete account activation and payment before creating a practice.',
      );
    }
    if (
      !db ||
      typeof db.exec !== 'function' ||
      !organizationRepo ||
      !organizationMemberRepo
    ) {
      throw new UploadError(
        503,
        'founder_organization_unavailable',
        'Practice creation is currently unavailable.',
      );
    }

    let transactionStarted = false;
    try {
      db.exec('BEGIN IMMEDIATE');
      transactionStarted = true;

      const allMemberships = organizationMemberRepo.listAll();
      const userMemberships = allMemberships
        .filter((membership) => (
          typeof membership?.user_email === 'string' &&
          membership.user_email.trim().toLowerCase() === userEmail
        ))
        .sort(compareStableRecords);
      const existingFounderMembership = userMemberships.find((membership) => (
        membership.role === 'owner' && membership.is_primary === true
      ));

      if (existingFounderMembership) {
        const organization = organizationRepo.getById(existingFounderMembership.org_id);
        if (!organization) {
          throw new UploadError(
            409,
            'founder_membership_invalid',
            'The existing practice membership could not be verified.',
          );
        }
        db.exec('COMMIT');
        transactionStarted = false;
        return safeFounderOrganizationIdentity(organization);
      }

      // Existing invited/non-owner membership is handled by ProfileSetup's
      // established path. A direct call must not create an extra tenant or
      // silently elevate that membership to owner.
      if (userMemberships.length > 0) {
        throw new UploadError(
          409,
          'existing_membership_requires_selection',
          'Use the existing practice membership to continue.',
        );
      }

      const referencedOrganizationIds = new Set(
        allMemberships
          .map((membership) => membership?.org_id)
          .filter((orgId) => typeof orgId === 'string' && orgId.length > 0),
      );
      let organization = organizationRepo
        .listAll()
        .filter((candidate) => (
          candidate.created_by === userEmail &&
          !referencedOrganizationIds.has(candidate.id) &&
          comparableStoredClinicName(candidate.name) === normalizedClinicName
        ))
        .sort(compareStableRecords)[0] || null;

      if (!organization) {
        organization = organizationRepo.create({ name: normalizedClinicName }, userEmail);
      }
      organizationMemberRepo.create({
        org_id: organization.id,
        user_email: userEmail,
        role: 'owner',
        is_primary: true,
      }, userEmail);

      db.exec('COMMIT');
      transactionStarted = false;
      return safeFounderOrganizationIdentity(organization);
    } catch (error) {
      if (transactionStarted) {
        try { db.exec('ROLLBACK'); } catch { /* preserve the original controlled failure */ }
      }
      throw error;
    }
  };
}

async function handleEnsureFounderOrganization(body, context) {
  if (typeof context.ensureFounderOrganization !== 'function') {
    throw new UploadError(
      503,
      'founder_organization_unavailable',
      'Practice creation is currently unavailable.',
    );
  }
  return context.ensureFounderOrganization({
    sessionUser: context.sessionUser,
    clinicName: body?.clinic_name,
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
  'GetUploadDispositionReport',
  'ResolveUploadDisposition',
  'RecordLegalAcceptanceBundle',
  'EnsureFounderOrganization',
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

  const referralReference = Object.hasOwn(REFERRAL_ERROR_POLICIES, endpointName) ? randomUUID() : null;
  const requestContext = referralReference
    ? { ...context, diagnosticReference: referralReference }
    : context;

  let releaseUploadAdmission = null;
  try {
    if (endpointName === 'UploadFile') {
      releaseUploadAdmission = acquireUploadAdmission(req, context.sessionUser?.id);
    }
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
        return sendJson(res, 200, await handleExtractDataFromUploadedFile(body, requestContext));
      case 'SendEmail':
        return sendJson(res, 200, await handleSendEmail(body, context));
      case 'SendSMS':
        return sendJson(res, 200, handleSendSMS(body, outboxSms));
      case 'UploadFile':
        return sendJson(res, 200, await handleUploadFile(body, files, requestContext));
      case 'CreateFileAccessUrl':
        return sendJson(res, 200, await handleCreateFileAccessUrl(body, context));
      case 'CancelTemporaryUploads':
        return sendJson(res, 200, await handleCancelTemporaryUploads(body, context));
      case 'GetUploadDispositionReport':
        return sendJson(res, 200, handleGetUploadDispositionReport(body, context));
      case 'ResolveUploadDisposition':
        return sendJson(res, 200, handleResolveUploadDisposition(body, context));
      case 'RecordLegalAcceptanceBundle':
        return sendJson(res, 200, await handleRecordLegalAcceptanceBundle(body, context));
      case 'EnsureFounderOrganization':
        return sendJson(res, 200, await handleEnsureFounderOrganization(body, context));
      case 'GenerateImage':
        return sendJson(res, 200, handleGenerateImage(body));
      default:
        return sendJson(res, 404, { message: `integration endpoint ${endpointName} not found` });
    }
  } catch (error) {
    if (referralReference) {
      const diagnostic = referralDiagnostic(endpointName, error, referralReference);
      // This is the complete operational event. Keep it content-free: no
      // request/body, document, filename, provider response, secret or raw
      // user/organisation/upload identifiers are permitted here.
      console.error('[integration] referral operation refused', {
        endpoint: endpointName,
        diagnostic_reference: diagnostic.diagnostic_reference,
        stage: diagnostic.stage,
        code: diagnostic.code,
        status: diagnostic.status,
      });
      if (endpointName === 'ExtractDataFromUploadedFile') {
        return sendJson(res, diagnostic.status, {
          status: 'error',
          code: diagnostic.code,
          details: diagnostic.message,
          diagnostic_reference: diagnostic.diagnostic_reference,
          stage: diagnostic.stage,
        });
      }
      return sendJson(res, diagnostic.status, {
        code: diagnostic.code,
        error: diagnostic.message,
        diagnostic_reference: diagnostic.diagnostic_reference,
        stage: diagnostic.stage,
      });
    }
    const known = error instanceof UploadError || error instanceof ExtractionError || Number.isInteger(error?.httpStatus);
    const status = known ? error.httpStatus || 500 : 500;
    const code = known && typeof error?.code === 'string' && /^[a-z0-9_]{1,80}$/.test(error.code)
      ? error.code
      : 'internal_error';
    const details = known ? error.publicMessage || error.message : 'The request could not be completed.';
    if (!known) {
      // Metadata only: never print request bodies, file names, provider
      // payloads, tenant identifiers or user data.
      console.error('[integration] request failed', { endpoint: endpointName, code: 'internal_error' });
    }
    if (endpointName === 'ExtractDataFromUploadedFile') {
      return sendJson(res, status, { status: 'error', code, details });
    }
    return sendJson(res, status, { code, error: details });
  } finally {
    releaseUploadAdmission?.();
  }
}
