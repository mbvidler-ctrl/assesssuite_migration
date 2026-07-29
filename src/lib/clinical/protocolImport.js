// Building the plain-text plan an imported treatment protocol writes into a
// client's SOAP note, and choosing which note it may be written to.
//
// Three honesty properties this module exists to hold:
//
//  1. An AI-drafted protocol carries the durable AI marker into the clinical
//     record. Previously the import produced text indistinguishable from
//     clinician-authored content the moment it landed in `plan`.
//  2. Contraindications, red flags and references TRAVEL with the plan.
//     Previously they were silently dropped, so the safety content the
//     clinician saw on screen was not the content that reached the note. An
//     absent contraindications block is stated explicitly rather than left
//     as silence.
//  3. Verification state is reported as the data carries it — never as a
//     bare "verified" claim the payload does not support.
//
// Input is either a normalised protocol (src/lib/protocolResponse.js
// normaliseProtocolResponse) or, on the reviewed-catalogue fallback path, a
// raw catalogue row. Every field access is therefore guarded: this is raw
// unvalidated content and a `.map` on a string here would be a second
// instance of the SPA-crash class already on record.
//
// Pure, dependency-free, relative imports only (node --test resolves no
// Vite alias).

import { AI_CONTENT_MARKER, aiProvenanceBlock, reviewedSourceBlock } from './aiProvenance.js';
import { localDayOf, selectAppendableNote } from './soapNoteTarget.js';

export const PROTOCOL_PROVENANCE = Object.freeze({
  AI: 'ai-assisted',
  REVIEWED: 'reviewed-catalogue',
});

export const NO_CONTRAINDICATIONS_WARNING =
  'No contraindications or red flags were supplied with this protocol. Screen the client independently before prescribing.';

export const NO_REFERENCES_WARNING = 'No verified references accompanied this protocol.';

export const LATER_PHASES_NOTICE =
  'Later phases were not imported. See the full protocol before progressing.';

export const BLOCKED_BY_PUBLISHED_MESSAGE =
  "Today's note is published, so the protocol was added to a new draft note.";

const REVIEWED_SOURCE_LABEL = 'Reviewed protocol catalogue (AssessSuite)';

function text(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function list(value) {
  if (!Array.isArray(value)) return [];
  return value.map(text).map((entry) => entry.trim()).filter(Boolean);
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

/**
 * @param {unknown} protocolData
 * @param {{conditionName?: unknown, provenance?: string, dateLabel?: string}} [options]
 * @returns {string}
 */
export function buildProtocolPlanText(protocolData, { conditionName, provenance, dateLabel } = {}) {
  const protocol = plainObject(protocolData) || {};
  const name = text(conditionName).trim() || 'Unnamed condition';
  const isAi = provenance !== PROTOCOL_PROVENANCE.REVIEWED;

  let planText = `TREATMENT PROTOCOL: ${name}\n\n`;

  planText += isAi
    ? aiProvenanceBlock({
        dateLabel,
        detail: 'This draft was not drawn from the reviewed protocol catalogue and has not been independently verified.',
      })
    : reviewedSourceBlock({ dateLabel, sourceLabel: REVIEWED_SOURCE_LABEL });
  planText += '\n\n';

  // --- Exercise prescription (byte-identical to the pre-WP1 output) -------
  const prescription = plainObject(protocol.exercise_prescription);
  if (prescription) {
    planText += `EXERCISE PRESCRIPTION:\n`;

    const exercises = Array.isArray(prescription.exercises) ? prescription.exercises : [];
    exercises.forEach((rawExercise, i) => {
      const exercise = plainObject(rawExercise);
      if (!exercise) return;
      planText += `\n${i + 1}. ${text(exercise.name)} (${text(exercise.type)})\n`;
      planText += `   Dosage: ${text(exercise.dosage)}\n`;
      planText += `   Purpose: ${text(exercise.purpose)}\n`;
      if (text(exercise.modifications)) {
        planText += `   Modifications: ${text(exercise.modifications)}\n`;
      }
    });

    planText += `\n`;
    if (text(prescription.frequency)) {
      planText += `Frequency: ${text(prescription.frequency)}\n`;
    }
    if (text(prescription.session_duration)) {
      planText += `Session Duration: ${text(prescription.session_duration)}\n`;
    }
    if (text(prescription.program_duration)) {
      planText += `Program Duration: ${text(prescription.program_duration)}\n`;
    }
  }

  // --- Current phase ------------------------------------------------------
  const progression = plainObject(protocol.progression);
  const phases = progression && Array.isArray(progression.phases) ? progression.phases : [];
  const firstPhase = plainObject(phases[0]);
  if (firstPhase) {
    planText += `\nCURRENT PHASE: ${text(firstPhase.phase_name)}\n`;
    planText += `Goals: ${text(firstPhase.goals)}\n`;
    planText += `Duration: ${text(firstPhase.duration)}\n`;
    if (phases.length > 1) {
      planText += `${LATER_PHASES_NOTICE}\n`;
    }
  }

  // --- Contraindications and red flags (previously dropped entirely) ------
  planText += `\nCONTRAINDICATIONS AND RED FLAGS:\n`;
  const contraindications = plainObject(protocol.contraindications);
  const absolute = contraindications ? list(contraindications.absolute) : [];
  const relative = contraindications ? list(contraindications.relative) : [];
  const redFlags = contraindications ? list(contraindications.red_flags) : [];
  if (absolute.length === 0 && relative.length === 0 && redFlags.length === 0) {
    planText += `${NO_CONTRAINDICATIONS_WARNING}\n`;
  } else {
    if (absolute.length > 0) planText += `Absolute: ${absolute.join('; ')}\n`;
    if (relative.length > 0) planText += `Relative: ${relative.join('; ')}\n`;
    if (redFlags.length > 0) planText += `Red flags: ${redFlags.join('; ')}\n`;
  }

  // --- References, with the verification state the data actually carries --
  planText += `\nKEY REFERENCES:\n`;
  const references = Array.isArray(protocol.references) ? protocol.references : [];
  const citations = [];
  references.forEach((rawReference) => {
    const reference = plainObject(rawReference);
    if (!reference) return;
    const citation = text(reference.citation).trim();
    if (!citation) return;
    citations.push(`${citations.length + 1}. ${citation} ${reference.verified === true ? '[verified]' : '[not verified]'}`);
  });
  if (citations.length === 0) {
    planText += `${NO_REFERENCES_WARNING}\n`;
  } else {
    planText += `${citations.join('\n')}\n`;
  }

  return planText;
}

/**
 * Decide where an imported protocol may be written.
 *
 * @param {unknown} notes every SOAP note fetched for the client
 * @param {{todayDateStr?: string}} [options]
 * @returns {{mode: 'append', note: object}|{mode: 'create', blockedByPublished: boolean}}
 */
export function selectProtocolImportTarget(notes, { todayDateStr } = {}) {
  const rows = Array.isArray(notes) ? notes : [];
  const sameDay = rows.filter((note) => (
    note && typeof note === 'object' && localDayOf(note.note_date) === todayDateStr
  ));
  const appendable = selectAppendableNote(sameDay);
  if (appendable) return { mode: 'append', note: appendable };
  return { mode: 'create', blockedByPublished: sameDay.length > 0 };
}

export { AI_CONTENT_MARKER };
