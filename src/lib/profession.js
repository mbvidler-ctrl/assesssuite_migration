import { useMemo } from 'react';
import {
  getProfession,
  term as resolveTerm,
  toPublicProfession,
} from '../../packages/profession-config/index.mjs';
import { useAuth } from '@/lib/AuthContext';

// Both values are injected by the explicit app shell. Unknown or mismatched
// identities throw during module evaluation; a Physio bundle never falls back
// to EP because of a missing environment value.
export const BUILD_TIME_PROFESSION_ID = import.meta.env.VITE_PROFESSION;
const compiledAppId = import.meta.env.VITE_BASE44_APP_ID;
const buildDefinition = getProfession(BUILD_TIME_PROFESSION_ID);

if (compiledAppId !== buildDefinition.deployment.appId) {
  throw new TypeError(
    `compiled app id does not match the ${BUILD_TIME_PROFESSION_ID} profession target`,
  );
}

export const buildTimeProfession = Object.freeze(toPublicProfession(buildDefinition));

/**
 * Resolve server-published identity without allowing one vertical to relabel
 * another. The current EP server does not yet publish a profession block, so an
 * absent block uses the already-validated build identity; a present conflicting
 * block is a fatal target mismatch.
 */
export function professionFromPublicSettings(appPublicSettings) {
  const published = appPublicSettings?.public_settings?.profession;
  if (!published) return buildTimeProfession;
  if (typeof published !== 'object' || published.id !== BUILD_TIME_PROFESSION_ID) {
    throw new TypeError(
      `server profession does not match the ${BUILD_TIME_PROFESSION_ID} application build`,
    );
  }
  if (!published.lexicon || typeof published.lexicon !== 'object') {
    throw new TypeError('server profession payload is missing its lexicon');
  }
  return published;
}

export function useProfession() {
  const { appPublicSettings } = useAuth() || {};
  return useMemo(
    () => professionFromPublicSettings(appPublicSettings),
    [appPublicSettings],
  );
}

export function useTerm() {
  const profession = useProfession();
  return useMemo(() => (token) => resolveTerm(profession, token), [profession]);
}

export function staticTerm(token) {
  return resolveTerm(buildTimeProfession, token);
}
