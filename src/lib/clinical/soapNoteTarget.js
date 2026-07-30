// Choosing WHICH SOAP note a background write may append to.
//
// A published SOAP note is a finalised clinical record; the server now
// refuses every non-amendment write to one (server/index.mjs,
// publishedNoteMutationDenied). Every client site that appends into "the
// first note it found" must therefore skip published notes and fall through
// to creating a fresh draft, otherwise clinicians see a hard 409 where the
// write previously (wrongly) succeeded.
//
// Pure, dependency-free, no Vite alias (node --test resolves none).

/**
 * @typedef {{
 *   id?: unknown,
 *   objective?: unknown,
 *   status?: unknown,
 *   [key: string]: unknown
 * }} SoapNoteRecord
 */

/**
 * @param {unknown} note
 * @returns {note is SoapNoteRecord}
 */
function isSoapNoteRecord(note) {
  return note !== null && typeof note === 'object';
}

/**
 * @param {unknown} note
 * @returns {boolean}
 */
export function isPublishedNote(note) {
  return isSoapNoteRecord(note) && note.status === 'published';
}

/**
 * First note that may still be appended to, or null when every candidate is
 * a finalised record.
 * @param {unknown} notes
 * @returns {SoapNoteRecord|null}
 */
export function selectAppendableNote(notes) {
  if (!Array.isArray(notes)) return null;
  for (const note of notes) {
    if (!isSoapNoteRecord(note)) continue;
    if (isPublishedNote(note)) continue;
    return note;
  }
  return null;
}

/**
 * Append objective text to the first appendable SOAP note among `notes`, or
 * create a fresh draft when every candidate is a finalised (published) record.
 *
 * This lifts the whole append-or-create DECISION out of the background
 * assessment writers so that "which note gets written, and whether a published
 * note is skipped" is one pure, unit-tested data-flow — not a call-site
 * spelling (`.at(0)`, a destructure, an index variable) that the server's
 * published-note guard can be silently defeated by.
 *
 * The SOAPNote entity is injected so the decision is exercisable without a
 * backend: pass `base44.entities.SOAPNote` in the app, a fake in tests.
 *
 * @param {{update: Function, create: Function}} entity
 * @param {unknown} notes notes already fetched for the appointment/client
 * @param {string} objectiveText text to append
 * @param {object} [createFields] fields for a fresh draft when none is appendable
 * @returns {Promise<{mode: 'append', noteId: unknown}|{mode: 'create'}>}
 */
export async function appendObjectiveToSoapNote(entity, notes, objectiveText, createFields = {}) {
  const target = selectAppendableNote(notes);
  if (target) {
    const existing = typeof target.objective === 'string' ? target.objective : '';
    const updatedObjective = existing ? `${existing}\n\n${objectiveText}` : objectiveText;
    await entity.update(target.id, { objective: updatedObjective });
    return { mode: 'append', noteId: target.id };
  }
  await entity.create({ ...createFields, objective: objectiveText, status: 'draft' });
  return { mode: 'create' };
}

/**
 * 'YYYY-MM-DD' in LOCAL time, or null for a missing/malformed value.
 *
 * Behaviour-identical to date-fns `format(new Date(v), 'yyyy-MM-dd')` for
 * valid dates, but returns null instead of throwing RangeError on a corrupt
 * note_date — a malformed row must make a note "not today", never crash the
 * modal that is reading it.
 * @param {unknown} value
 * @returns {string|null}
 */
export function localDayOf(value) {
  if (value === null || value === undefined || value === '') return null;
  let date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else {
    return null;
  }
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
