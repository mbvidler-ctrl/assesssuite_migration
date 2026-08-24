const RELEASE_SHA = /^[0-9a-f]{40}$/;
const PHYSIO_RELEASE = /^physio-production@[0-9a-f]{40}$/;

export const PHYSIO_SENTRY_RELEASE_PREFIX = 'physio-production@';

export function sentryReleaseForProfession(professionId, releaseSha) {
  if (typeof releaseSha !== 'string' || !RELEASE_SHA.test(releaseSha)) return null;
  if (professionId === 'physio') return `${PHYSIO_SENTRY_RELEASE_PREFIX}${releaseSha}`;
  if (professionId === 'exercise-physiology') return releaseSha;
  return null;
}

export function normalizeSentryReleaseForEnvironment(environment, release) {
  if (typeof release !== 'string') return null;
  if (environment === 'physio-production') return PHYSIO_RELEASE.test(release) ? release : null;
  if (environment === 'production') return RELEASE_SHA.test(release) ? release : null;
  return null;
}
