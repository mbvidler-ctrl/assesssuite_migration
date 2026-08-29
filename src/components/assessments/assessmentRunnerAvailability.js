import { resolveRegisteredAssessmentRoute } from './assessmentRunnerRegistry';

/**
 * The generated canonical registry is the single source of truth for runner
 * availability. Catalogue quality flags are retained as source evidence, but
 * a stale flag must never hide a registered, tested runner from clinicians.
 */
export function hasRegisteredAssessmentRunner(assessmentOrName) {
  return Boolean(resolveRegisteredAssessmentRoute(assessmentOrName));
}
