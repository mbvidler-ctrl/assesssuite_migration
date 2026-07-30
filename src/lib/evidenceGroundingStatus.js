// Australian English. Describes what searchEvidence actually returned so the
// UI never claims systematic-review or "verified research" grounding when
// the server silently degraded to a broader search (server/evidence.mjs's
// reviewsOnly fallback, reported via reviewsOnlyApplied).
/**
 * @param {{
 *   networkError?: unknown,
 *   resultCount?: number,
 *   reviewsOnlyApplied?: boolean
 * }} [result]
 */
export function describeEvidenceGrounding({ networkError, resultCount, reviewsOnlyApplied } = {}) {
  if (networkError || !resultCount) {
    return {
      ok: false,
      tone: 'error',
      message: 'No verified research could be retrieved for this condition.',
    };
  }
  if (reviewsOnlyApplied === false) {
    return {
      ok: true,
      tone: 'warning',
      message:
        'No systematic-review evidence was found for this condition — broader indexed research was used instead of review-level evidence.',
    };
  }
  // Tri-state: only an explicit reviewsOnlyApplied === true confirms
  // review-level grounding. A missing/unknown field (an older server image or
  // a future evidence path) must never be reported as confirmed systematic-
  // review evidence purely because the flag was absent — fail to a warning.
  if (reviewsOnlyApplied === true) {
    return {
      ok: true,
      tone: 'success',
      message: 'Systematic-review evidence retrieved for this condition.',
    };
  }
  return {
    ok: true,
    tone: 'warning',
    message:
      'Verified research was retrieved for this condition, but this server did not report whether it was review-level evidence.',
  };
}
