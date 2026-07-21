export const INITIAL_RELEASE_COUNTRY = 'australia';

export const INITIAL_RELEASE_PROFESSIONS = new Set([
  'Exercise Physiologist',
  'Gym Management',
  'Clinic Management',
]);

/**
 * Shared browser/server predicate for the bounded RC-2026.07.19 clinical
 * release. Keeping one predicate prevents the browser from admitting an
 * incomplete legacy profile that the authoritative upload gate rejects.
 */
export function isInitialClinicalReleaseEligible(user) {
  return (
    user?.country === INITIAL_RELEASE_COUNTRY
    && INITIAL_RELEASE_PROFESSIONS.has(user?.profession)
  );
}
