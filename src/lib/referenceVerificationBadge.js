// Truthful per-reference verification badge. A reference is only ever
// labelled "Verified" when validateReferences() in TreatmentProtocols.jsx has
// set verified === true after a successful verifyReferences round-trip.
// Every other state — verified:false (including the total-outage path that
// keeps all references but marks them unverified, TreatmentProtocols.jsx's
// validateReferences catch block) or the flag missing entirely — renders the
// amber "not independently verified" treatment. This mirrors the evidence
// service's own fail-closed contract (server/evidence.mjs: verification
// never asserts "verified" on a network failure).
export function getReferenceVerificationBadge(reference) {
  const verified = reference?.verified === true;
  if (verified) {
    return {
      verified: true,
      label: '✓ Verified',
      className: 'bg-green-600 text-white text-xs',
      cardClassName: 'bg-green-50 border-green-200',
    };
  }
  return {
    verified: false,
    label: 'Not independently verified',
    className: 'bg-amber-500 text-white text-xs',
    cardClassName: 'bg-amber-50 border-amber-200',
  };
}
