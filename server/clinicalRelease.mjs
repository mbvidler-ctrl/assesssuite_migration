import {
  resolveActiveProfessionContract,
  toPublicProfession,
} from '../packages/profession-config/runtime.mjs';

export {
  INITIAL_RELEASE_COUNTRY,
  INITIAL_RELEASE_PROFESSIONS,
} from '../src/lib/clinicalRelease.js';

/**
 * Resolve the one process-level clinical admission contract from the validated
 * profession manifest. An absent PROFESSION intentionally preserves the EP
 * target. An explicit unknown profession or DEFAULT_APP_ID mismatch throws,
 * allowing server bootstrap to fail before accepting traffic.
 */
export function resolveClinicalReleasePolicy(environment = process.env) {
  const contract = resolveActiveProfessionContract(environment);
  return Object.freeze({
    professionId: contract.professionId,
    appId: contract.appId,
    releaseCountry: contract.releaseCountry,
    releaseProfessions: contract.releaseProfessions,
    publicProfession: Object.freeze(toPublicProfession(contract.profession)),
  });
}

function policyIsValid(policy) {
  return Boolean(
    policy &&
    typeof policy === 'object' &&
    typeof policy.professionId === 'string' && policy.professionId &&
    typeof policy.appId === 'string' && policy.appId &&
    typeof policy.releaseCountry === 'string' && policy.releaseCountry &&
    Array.isArray(policy.releaseProfessions) && policy.releaseProfessions.length > 0 &&
    policy.releaseProfessions.every((profession) => typeof profession === 'string' && profession),
  );
}

export function isInitialClinicalReleaseEligible(user, policy = resolveClinicalReleasePolicy()) {
  if (!policyIsValid(policy)) return false;
  return Boolean(
    user &&
    user.country === policy.releaseCountry &&
    policy.releaseProfessions.includes(user.profession),
  );
}

/** Reject only an explicitly supplied value here; the clinical gates below
 * still fail closed when a legacy or incomplete profile omits either field. */
export function validateInitialReleaseProfileUpdate(payload, policy = resolveClinicalReleasePolicy()) {
  if (!policyIsValid(policy)) {
    return { ok: false, message: 'The active clinical release profile is invalid.' };
  }
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'country') && payload.country !== policy.releaseCountry) {
    return { ok: false, message: 'Self-service clinical accounts are limited to Australia.' };
  }
  if (
    Object.prototype.hasOwnProperty.call(payload || {}, 'profession') &&
    !policy.releaseProfessions.includes(payload.profession)
  ) {
    return {
      ok: false,
      message: 'This profession requires a separately approved AssessSuite order.',
    };
  }
  return { ok: true };
}
