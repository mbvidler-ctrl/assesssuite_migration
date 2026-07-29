// Australian English. Describes what searchEvidence actually returned so the
// UI never claims systematic-review or "verified research" grounding when
// the server silently degraded to a broader search (server/evidence.mjs's
// reviewsOnly fallback, reported via reviewsOnlyApplied).
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
  return {
    ok: true,
    tone: 'success',
    message: 'Systematic-review evidence retrieved for this condition.',
  };
}
