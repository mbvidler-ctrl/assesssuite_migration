// Guards the Assessment catalogue against unverified AI-authored references.
// Pure helpers so the gating logic is unit-testable independent of the UI and
// the network. Used where LLM-generated documentation is written back into the
// catalogue (AssessmentAudit), and reusable anywhere a free-text reference
// block must be filtered to only verified citations.

// Split a free-text references block into individual citation lines.
export function splitReferenceLines(referencesText) {
  return String(referencesText || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Given the original citation lines and the aligned verifyReferences results,
// return { verified: string[] | null, removed: number }.
// - results is an array aligned by index to `lines`.
// - A line is kept only when its verdict is exactly 'verified'.
// - If results is not a usable array (service unavailable / error), returns
//   { verified: null } to signal "could not verify" — callers must then NOT
//   persist the references (never assert verified on failure).
export function keepVerifiedReferenceLines(lines, results) {
  const arr = Array.isArray(lines) ? lines : [];
  if (!Array.isArray(results)) {
    return { verified: null, removed: arr.length };
  }
  const verified = arr.filter((_, i) => results[i] && results[i].verdict === "verified");
  return { verified, removed: arr.length - verified.length };
}
