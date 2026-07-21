import {
  INITIAL_RELEASE_COUNTRY,
  INITIAL_RELEASE_PROFESSIONS,
} from '../src/lib/clinicalRelease.js';

export {
  INITIAL_RELEASE_COUNTRY,
  INITIAL_RELEASE_PROFESSIONS,
  isInitialClinicalReleaseEligible,
} from '../src/lib/clinicalRelease.js';

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
