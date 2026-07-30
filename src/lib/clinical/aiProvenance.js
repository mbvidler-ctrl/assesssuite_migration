// The canonical vocabulary for "this content was AI-drafted".
//
// Two deliberately redundant halves:
//
//  1. A PLAIN-TEXT block written INSIDE the existing free-text clinical
//     fields (SOAPNote.subjective/objective/assessment/plan, the imported
//     protocol plan). This half survives a clipboard copy, a printed note, a
//     PDF export and — critically — a rollback to an older image that knows
//     nothing about any new column: the label is part of the note text the
//     old image already reads and renders.
//  2. An additive `ai_provenance` array persisted alongside it. This rides
//     in the schemaless JSON blob (server/db.mjs update() merges
//     `{...existingRest, ...incoming}`), so an older image neither drops it
//     nor chokes on it.
//
// Neither half is an audit control. Both are clinician-editable (see
// aiProvenance R7): they exist so a reader is TOLD the content was
// AI-drafted, not so a reader can PROVE it was not tampered with.
//
// Pure and dependency-free. `dateLabel` is always supplied by the caller as
// a preformatted dd/MM/yyyy string so this module stays locale-independent
// and the tests stay deterministic.
//
// Imports MUST stay absent / relative — node --test resolves no Vite alias
// (precedent: src/lib/aiCapabilities.js).

export const AI_PROVENANCE_VERSION = 'ai-provenance-v1';

// ASCII only (no em dash, no smart quotes): must survive plain-text export,
// clipboard paste and any non-UTF8 downstream consumer, and must stay
// greppable in a database dump.
export const AI_CONTENT_MARKER = '[AI-ASSISTED CONTENT - REQUIRES CLINICIAN REVIEW]';

export const AI_SECTION_TAG = 'AI-assisted draft';

export const AI_REPORT_DISCLOSURE_SENTENCE =
  "Sections labelled 'AI-assisted draft' were drafted with AI assistance and reviewed by the treating clinician before release.";

export const AI_LETTER_DISCLOSURE_SENTENCE =
  'Parts of this letter were drafted with AI assistance and reviewed by the treating clinician before release.';

const CLINICIAN_RESPONSIBILITY_SENTENCE =
  'The treating clinician remains responsible for screening contraindications and for the safety and dosage of anything prescribed from it.';

function asText(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * Substring test for the durable plain-text marker.
 * @param {unknown} text
 * @returns {boolean}
 */
export function containsAiContentMarker(text) {
  return asText(text).includes(AI_CONTENT_MARKER);
}

/**
 * The durable plain-text provenance block for AI-drafted content.
 * @param {{dateLabel?: string, detail?: string}} [options]
 * @returns {string}
 */
export function aiProvenanceBlock({ dateLabel, detail } = {}) {
  const when = asText(dateLabel) || 'an unrecorded date';
  const extra = asText(detail).trim();
  const source = [
    `Source: AI-assisted draft generated in AssessSuite on ${when}.`,
    extra,
    CLINICIAN_RESPONSIBILITY_SENTENCE,
  ].filter(Boolean).join(' ');
  return `${AI_CONTENT_MARKER}\n${source}`;
}

/**
 * The provenance line for content that is NOT AI-drafted. Deliberately
 * carries no AI marker — labelling reviewed content as AI-assisted is as
 * dishonest as the reverse.
 * @param {{dateLabel?: string, sourceLabel?: string}} [options]
 * @returns {string}
 */
export function reviewedSourceBlock({ dateLabel, sourceLabel } = {}) {
  const when = asText(dateLabel) || 'an unrecorded date';
  const label = asText(sourceLabel) || 'Reviewed clinical content (AssessSuite)';
  return `Source: ${label}, imported ${when}.`;
}

/**
 * Prefix free text with the durable AI marker block. Idempotent: text that
 * already carries the marker is returned unchanged, so repeated AI Help
 * clicks do not stack banners.
 * @param {unknown} text
 * @param {{dateLabel?: string, detail?: string}} [options]
 * @returns {string}
 */
export function markAiAssistedText(text, options = {}) {
  const body = asText(text);
  if (body === '') return body;
  if (containsAiContentMarker(body)) return body;
  return `${aiProvenanceBlock(options)}\n\n${body}`;
}

/**
 * One additive provenance record. Persisted in SOAPNote.ai_provenance.
 * @param {{source?: string, fields?: unknown, dateLabel?: string, subject?: unknown}} [options]
 */
export function aiProvenanceEntry({ source, fields, dateLabel, subject } = {}) {
  return {
    marker_version: AI_PROVENANCE_VERSION,
    source: asText(source) || 'unknown',
    fields: Array.isArray(fields) ? fields.filter((field) => typeof field === 'string') : [],
    subject: typeof subject === 'string' && subject !== '' ? subject : null,
    recorded_at: asText(dateLabel) || null,
  };
}

/**
 * Append-only accumulation, array-guarded against a corrupt stored value.
 * @param {unknown} existing
 * @param {object} entry
 * @returns {object[]}
 */
export function appendAiProvenance(existing, entry) {
  const prior = Array.isArray(existing) ? existing : [];
  return entry ? [...prior, entry] : [...prior];
}
