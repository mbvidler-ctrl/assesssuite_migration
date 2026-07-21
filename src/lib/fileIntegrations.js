import { base44 } from '@/api/base44Client';

// Matches the reviewed production default. The server remains authoritative;
// this client bound prevents uploading an unusable fifth document first.
export const DOCUMENT_EXTRACTION_MAX_FILES = 4;
export const REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION =
  'referral-processing-authority-v2026-07-21.1';

/**
 * Typed boundary for the tenant-aware upload contract added by the migration
 * shim. The installed Base44 SDK's generated types describe only its legacy
 * one-field upload shape, so the cast belongs here rather than at every
 * clinical call site.
 *
 * @param {{file: File, org_id: string, purpose: string, subject_age_confirmation?: '13_or_over', subject_age_attestation_version?: 'referral-subject-age-attestation-v2026-07-21.1', processing_authority_confirmed?: true, processing_authority_attestation_version?: 'referral-processing-authority-v2026-07-21.1'}} params
 * @returns {Promise<{file_url: string, upload_id: string}>}
 */
export async function uploadTenantFile(params) {
  return /** @type {Promise<{file_url: string, upload_id: string}>} */ (
    base44.integrations.Core.UploadFile(/** @type {any} */ (params))
  );
}

/**
 * Referral extraction requires the version field; established generic
 * clinical/report extraction keeps its explicit, unversioned authority gate.
 * @param {{org_id: string, file_urls: string[], json_schema: object, processing_authority_confirmed: true, processing_authority_attestation_version?: 'referral-processing-authority-v2026-07-21.1'}} params
 * @returns {Promise<{status: 'success', output: Record<string, any>}|{status: 'error', code: string, details: string}>}
 */
export async function extractTenantDocumentData(params) {
  if (!Array.isArray(params?.file_urls) || params.file_urls.length === 0) {
    throw new Error('At least one document is required for extraction.');
  }
  if (params.file_urls.length > DOCUMENT_EXTRACTION_MAX_FILES) {
    throw new Error(`Select no more than ${DOCUMENT_EXTRACTION_MAX_FILES} documents for one extraction.`);
  }
  return /** @type {Promise<{status: 'success', output: Record<string, any>}|{status: 'error', code: string, details: string}>} */ (
    base44.integrations.Core.ExtractDataFromUploadedFile(/** @type {any} */ (params))
  );
}

/**
 * @param {{file_url: string, org_id: string}} params
 * @returns {Promise<{file_url: string, expires_at: string}>}
 */
export async function createTenantFileAccessUrl(params) {
  return /** @type {Promise<{file_url: string, expires_at: string}>} */ (
    (/** @type {any} */ (base44.integrations.Core)).CreateFileAccessUrl(params)
  );
}

/**
 * Shorten the lifecycle of unbound temporary uploads after a practitioner
 * cancels or abandons review. The server re-authorises the complete set before
 * changing any lifecycle state.
 *
 * @param {{org_id: string, upload_ids: string[]}} params
 * @returns {Promise<{status: 'success', scheduled: number}>}
 */
export async function cancelTenantUploads(params) {
  return /** @type {Promise<{status: 'success', scheduled: number}>} */ (
    (/** @type {any} */ (base44.integrations.Core)).CancelTemporaryUploads(params)
  );
}
