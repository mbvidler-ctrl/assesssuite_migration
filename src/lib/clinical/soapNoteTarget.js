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
 * @param {unknown} note
 * @returns {boolean}
 */
export function isPublishedNote(note) {
  return Boolean(note) && typeof note === 'object' && note.status === 'published';
}

/**
 * First note that may still be appended to, or null when every candidate is
 * a finalised record.
 * @param {unknown} notes
 * @returns {object|null}
 */
export function selectAppendableNote(notes) {
  if (!Array.isArray(notes)) return null;
  for (const note of notes) {
    if (!note || typeof note !== 'object') continue;
    if (isPublishedNote(note)) continue;
    return note;
  }
  return null;
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
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
