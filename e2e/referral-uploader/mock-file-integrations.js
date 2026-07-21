import { Base44Error } from '@base44/sdk/dist/utils/axios-client.js';

import { harnessState } from './harness-state.js';

export const DOCUMENT_EXTRACTION_MAX_FILES = 4;
export const REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION =
  'referral-processing-authority-v2026-07-21.1';

export async function uploadTenantFile(params) {
  const uploadNumber = harnessState.calls.upload.length + 1;
  harnessState.calls.upload.push({
    org_id: params.org_id,
    purpose: params.purpose,
    processing_authority_confirmed: params.processing_authority_confirmed,
    processing_authority_attestation_version: params.processing_authority_attestation_version,
    subject_age_confirmation: params.subject_age_confirmation,
    subject_age_attestation_version: params.subject_age_attestation_version,
    file: {
      name: params.file?.name,
      type: params.file?.type,
      size: params.file?.size,
    },
  });
  if (harnessState.scenario === 'partial-upload-unmount' && uploadNumber === 2) {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return {
    file_url: `/uploads/synthetic-upload-${uploadNumber}`,
    upload_id: `synthetic-upload-${uploadNumber}`,
  };
}

export async function extractTenantDocumentData(params) {
  harnessState.calls.extract.push({
    org_id: params.org_id,
    file_urls: [...params.file_urls],
    processing_authority_confirmed: params.processing_authority_confirmed,
    processing_authority_attestation_version: params.processing_authority_attestation_version,
    schema_type: params.json_schema?.type,
    schema_fields: Object.keys(params.json_schema?.properties || {}),
  });

  if (harnessState.scenario === 'sdk-error' || harnessState.scenario === 'sdk-generic-disabled') {
    const genericDisabled = harnessState.scenario === 'sdk-generic-disabled';
    const originalError = {
      config: { data: 'Synthetic hidden referral payload' },
      response: {
        status: 403,
        data: {
          code: genericDisabled ? 'generic_extraction_disabled' : 'acceptance_required',
          details: genericDisabled
            ? 'Automated extraction is approved only for the referral workflow.'
            : 'Current AI document-extraction acceptance is required.',
          diagnostic_reference: genericDisabled
            ? '3eff37ad-e846-4ce4-9f9b-486f15bb8faa'
            : '38b4329d-4674-4ff2-a3bb-e231b45676ac',
          ignored_patient_name: 'Synthetic Hidden Person',
        },
      },
    };
    throw new Base44Error(
      'Request failed with status code 403',
      403,
      originalError.response.data.code,
      originalError.response.data,
      originalError,
    );
  }

  return {
    status: 'success',
    output: JSON.parse(JSON.stringify(harnessState.profile)),
  };
}

export async function cancelTenantUploads(params) {
  harnessState.calls.cancel.push({
    org_id: params.org_id,
    upload_ids: [...params.upload_ids],
  });
  return { status: 'success', scheduled: params.upload_ids.length };
}

export async function createTenantFileAccessUrl(params) {
  return {
    file_url: params.file_url,
    expires_at: '2099-01-01T00:00:00.000Z',
  };
}
