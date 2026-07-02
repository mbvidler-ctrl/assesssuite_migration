/**
 * Shared advisory duplicate-client detection.
 *
 * Consolidates and slightly improves on the ad hoc heuristic previously
 * confined to the referral-upload path (see
 * `src/components/documents/ReferralUploader.jsx`, matching intent at
 * lines 211-237 as at commit 0a6905e). This module is deliberately a pure
 * function with no imports so it can be reused from any create path
 * (Onboarding, QuickOnboardModal, ReferralUploader) without introducing a
 * dependency edge on React or the SDK client.
 *
 * Matching remains name + date of birth, both required, but improves on
 * the referral heuristic in two respects:
 *  - Name normalisation strips punctuation and collapses internal
 *    whitespace (not just lower-case/trim), then compares by exact
 *    equality OR token-subset (every token of the shorter normalised name
 *    appears among the tokens of the longer one). This still misses
 *    genuine nickname/spelling variants (e.g. "Jon" vs "John") because
 *    neither is a token subset of the other - a known, documented
 *    limitation, not a defect.
 *  - Date-of-birth normalisation parses common formats (ISO
 *    `YYYY-MM-DD`, and `DD/MM/YYYY` or `D/M/YYYY`) to a canonical
 *    `YYYY-MM-DD` string before comparing, so a DD/MM/YYYY value entered
 *    in one path matches an ISO value stored from another path.
 *
 * This check is advisory only: it is intended to surface likely
 * duplicates for human confirmation before a create proceeds, never to
 * block creation outright.
 */

/**
 * Normalise a name for comparison: lower-case, strip punctuation, collapse
 * internal whitespace, trim.
 *
 * @param {string} name
 * @returns {string} normalised name, or '' if not a usable string
 */
function normaliseName(name) {
  if (typeof name !== "string") return "";
  return name
    .toLowerCase()
    .replace(/[.,'"`\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a date-of-birth value in ISO (`YYYY-MM-DD`) or `DD/MM/YYYY` /
 * `D/M/YYYY` form into a canonical `YYYY-MM-DD` string.
 *
 * @param {string} value
 * @returns {string|null} canonical date string, or null if unparseable
 */
function normaliseDob(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }

  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

/**
 * Determine whether two normalised names should be treated as a match:
 * exact equality, or every whitespace-delimited token of the shorter name
 * appears among the tokens of the longer name (token-subset match).
 *
 * @param {string} a normalised name
 * @param {string} b normalised name
 * @returns {boolean}
 */
function namesMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;

  const tokensA = a.split(" ").filter(Boolean);
  const tokensB = b.split(" ").filter(Boolean);
  const [shorter, longer] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  if (shorter.length === 0) return false;

  const longerSet = new Set(longer);
  return shorter.every((token) => longerSet.has(token));
}

/**
 * Find existing clients that potentially duplicate a candidate client
 * record, matching on normalised full name AND normalised date of birth.
 * Both fields must match; a candidate or existing record lacking a usable
 * name or date of birth is never treated as a match.
 *
 * @param {{full_name?: string, date_of_birth?: string}} candidate
 *   The client data about to be created.
 * @param {Array<{id?: string, full_name?: string, date_of_birth?: string}>} existingClients
 *   The caller's already-loaded existing client records (typically the
 *   current organisation's client list).
 * @returns {Array<object>} the subset of existingClients considered
 *   potential duplicates of candidate; empty if none, or if candidate
 *   lacks a comparable name or date of birth.
 */
export function findPotentialDuplicates(candidate, existingClients) {
  if (!candidate || !Array.isArray(existingClients) || existingClients.length === 0) return [];

  const candidateName = normaliseName(candidate.full_name);
  const candidateDob = normaliseDob(candidate.date_of_birth);
  if (!candidateName || !candidateDob) return [];

  return existingClients.filter((existing) => {
    if (!existing) return false;
    const existingName = normaliseName(existing.full_name);
    const existingDob = normaliseDob(existing.date_of_birth);
    if (!existingName || !existingDob) return false;
    return existingDob === candidateDob && namesMatch(candidateName, existingName);
  });
}
