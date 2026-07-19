import { base44 } from '@/api/base44Client';

/**
 * Typed boundary for the tenant-aware upload contract added by the migration
 * shim. The installed Base44 SDK's generated types describe only its legacy
 * one-field upload shape, so the cast belongs here rather than at every
 * clinical call site.
 *
 * @param {{file: File, org_id: string, purpose: string, subject_age_band: '13_or_over'|'under_13'|'unknown'}} params
 * @returns {Promise<{file_url: string, upload_id: string}>}
 */
export async function uploadTenantFile(params) {
  return /** @type {Promise<{file_url: string, upload_id: string}>} */ (
    base44.integrations.Core.UploadFile(/** @type {any} */ (params))
  );
}

/**
 * @param {{org_id: string, file_urls: string[], json_schema: object}} params
 * @returns {Promise<{status: 'success', output: Record<string, any>}|{status: 'error', details: string}>}
 */
export async function extractTenantDocumentData(params) {
  return /** @type {Promise<{status: 'success', output: Record<string, any>}|{status: 'error', details: string}>} */ (
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
