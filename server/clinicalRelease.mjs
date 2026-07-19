export const INITIAL_RELEASE_COUNTRY = 'australia';

export const INITIAL_RELEASE_PROFESSIONS = new Set([
  'Exercise Physiologist',
  'Gym Management',
  'Clinic Management',
]);

/**
 * RC-2026.07.19 self-service clinical access is intentionally bounded to
 * Australian AEP practices and their authorised management staff. Accounts
 * outside this profile require a separately approved negotiated order.
 */
export function isInitialClinicalReleaseEligible(user) {
  return (
    user?.country === INITIAL_RELEASE_COUNTRY &&
    INITIAL_RELEASE_PROFESSIONS.has(user?.profession)
  );
}

/** Reject only an explicitly supplied value here; the clinical gates below
 * still fail closed when a legacy or incomplete profile omits either field. */
export function validateInitialReleaseProfileUpdate(payload) {
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'country') && payload.country !== INITIAL_RELEASE_COUNTRY) {
    return { ok: false, message: 'Self-service clinical accounts are limited to Australia.' };
  }
  if (
    Object.prototype.hasOwnProperty.call(payload || {}, 'profession') &&
    !INITIAL_RELEASE_PROFESSIONS.has(payload.profession)
  ) {
    return {
      ok: false,
      message: 'This profession requires a separately approved AssessSuite order.',
    };
  }
  return { ok: true };
}
