import {
  ASSESSMENT_ROUTE_REGISTRY_DIGEST,
  GENERATED_ASSESSMENT_ROUTES,
} from './assessmentRunnerRegistry.generated.js';

export { ASSESSMENT_ROUTE_REGISTRY_DIGEST };

export function normalizeAssessmentName(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const routeByCanonicalId = new Map();
const routeByExactName = new Map();
const routeByNormalizedName = new Map();

for (const route of GENERATED_ASSESSMENT_ROUTES) {
  if (routeByCanonicalId.has(route.canonicalId)) {
    throw new Error(`Duplicate assessment runner canonical ID: ${route.canonicalId}`);
  }
  routeByCanonicalId.set(route.canonicalId, route);
  for (const registeredName of [route.name, ...('aliases' in route ? route.aliases : [])]) {
    const exactRoute = routeByExactName.get(registeredName);
    if (exactRoute && exactRoute.canonicalId !== route.canonicalId) {
      throw new Error(`Duplicate exact assessment runner name or alias: ${registeredName}`);
    }
    routeByExactName.set(registeredName, route);

    // Normalized spellings may collide for genuinely different instruments
    // (for example 2-, 6- and 10-minute protocols). Keep their exact names and
    // canonical IDs deterministic while rejecting an ambiguous normalized key.
    const normalizedName = normalizeAssessmentName(registeredName);
    if (!routeByNormalizedName.has(normalizedName)) {
      routeByNormalizedName.set(normalizedName, route);
    } else if (routeByNormalizedName.get(normalizedName)?.canonicalId !== route.canonicalId) {
      routeByNormalizedName.set(normalizedName, null);
    }
  }
}

export const ASSESSMENT_RUNNER_REGISTRY = GENERATED_ASSESSMENT_ROUTES;

/**
 * Exact canonical-ID/name lookup. Unknown names return null and are rejected
 * by the router; there is deliberately no substring or generic fallback.
 */
export function resolveRegisteredAssessmentRoute(assessmentOrName) {
  if (assessmentOrName && typeof assessmentOrName === 'object') {
    const canonicalId = assessmentOrName.canonical_id || assessmentOrName.canonicalId;
    if (canonicalId && routeByCanonicalId.has(canonicalId)) {
      return routeByCanonicalId.get(canonicalId);
    }
    if (routeByExactName.has(assessmentOrName.name)) {
      return routeByExactName.get(assessmentOrName.name);
    }
    return routeByNormalizedName.get(normalizeAssessmentName(assessmentOrName.name)) || null;
  }
  if (routeByExactName.has(assessmentOrName)) return routeByExactName.get(assessmentOrName);
  return routeByNormalizedName.get(normalizeAssessmentName(assessmentOrName)) || null;
}
