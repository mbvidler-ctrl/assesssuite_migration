export const REFERRAL_SUBJECT_AGE_CONFIRMATION = '13_or_over';
export const REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION =
  'referral-subject-age-attestation-v2026-07-20.1';
// Recorded by the server, never accepted from the browser. Exported beside
// the version so assurance code verifies the same bounded provenance value.
export const REFERRAL_SUBJECT_AGE_ATTESTATION_SOURCE =
  'authenticated_practitioner_action';

// The published RC notice still describes the superseded exact-DOB UI. Its
// controlled content/fingerprint is intentionally untouched by this hotfix;
// correct that wording only through the separate controlled legal-copy path.

export const REFERRAL_PROCESSING_ATTESTATION =
  'By selecting Confirm Patient 13+ & Extract, you attest that the patient is 13 or older and the practice has documented the patient or representative notice and consent, or another valid authority, for AssessSuite and OpenAI to process this referral.';

/**
 * Preserve an explicit, still-valid practice choice. A single unique practice
 * is unambiguous and can be selected without user input. Multiple practices
 * require an explicit choice; never infer ownership from membership ordering
 * or the primary-membership flag. The server still verifies membership on
 * every upload, extraction and clinical write.
 */
export function resolveReferralOrganization(options, currentOrgId = '') {
  const validOptions = Array.isArray(options)
    ? [...new Map(
      options
        .filter((option) => typeof option?.id === 'string' && option.id.length > 0)
        .map((option) => [option.id, option]),
    ).values()]
    : [];

  if (validOptions.some((option) => option.id === currentOrgId)) return currentOrgId;
  return validOptions.length === 1 ? validOptions[0].id : '';
}
