// WP1 — honest persistence of AI content.
//
// Offline and pure: exercises the three src/lib/clinical modules directly
// and pins the source contract of the call sites that must consume them.
// Spawns nothing, opens no socket. Modelled on protocol-client-picker.test.mjs.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  AI_CONTENT_MARKER,
  AI_LETTER_DISCLOSURE_SENTENCE,
  AI_PROVENANCE_VERSION,
  AI_REPORT_DISCLOSURE_SENTENCE,
  AI_SECTION_TAG,
  aiProvenanceEntry,
  appendAiProvenance,
  containsAiContentMarker,
  markAiAssistedText,
} from '../../src/lib/clinical/aiProvenance.js';
import {
  isPublishedNote,
  localDayOf,
  selectAppendableNote,
} from '../../src/lib/clinical/soapNoteTarget.js';
import {
  BLOCKED_BY_PUBLISHED_MESSAGE,
  PROTOCOL_PROVENANCE,
  buildProtocolPlanText,
  selectProtocolImportTarget,
} from '../../src/lib/clinical/protocolImport.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

function readSource(...segments) {
  return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

const DATE_LABEL = '28/07/2026';

const AI_FIXTURE = {
  exercise_prescription: {
    exercises: [
      {
        name: 'Sit-to-stand',
        type: 'strength',
        dosage: '3 x 10',
        purpose: 'Lower-limb power',
        modifications: 'Use armrests if unsteady',
      },
    ],
    frequency: '3 x weekly',
    session_duration: '45 minutes',
    program_duration: '12 weeks',
  },
  progression: {
    phases: [
      { phase_name: 'Phase 1', goals: 'Restore tolerance', duration: '4 weeks' },
      { phase_name: 'Phase 2', goals: 'Build capacity', duration: '4 weeks' },
      { phase_name: 'Phase 3', goals: 'Maintain', duration: '4 weeks' },
    ],
  },
  contraindications: {
    absolute: ['Unstable angina'],
    relative: ['Uncontrolled hypertension'],
    red_flags: ['New chest pain during exertion'],
  },
  references: [
    { citation: 'Example A (2024). Trial of exercise. https://doi.org/10.1000/a', verified: true },
    { citation: 'Example B (2023). Uncorroborated review.', verified: false },
  ],
};

test('P01 an AI-assisted protocol import carries a durable AI marker into the note', () => {
  const planText = buildProtocolPlanText(AI_FIXTURE, {
    conditionName: 'Dementia',
    provenance: PROTOCOL_PROVENANCE.AI,
    dateLabel: DATE_LABEL,
  });
  assert.ok(planText.startsWith('TREATMENT PROTOCOL: Dementia\n\n'), planText.slice(0, 80));
  assert.ok(planText.includes(AI_CONTENT_MARKER), planText);
  assert.ok(
    planText.includes(`Source: AI-assisted draft generated in AssessSuite on ${DATE_LABEL}.`),
    planText,
  );
  assert.match(planText, /has not been independently verified\./);
  assert.match(planText, /remains responsible for screening contraindications/);
  assert.equal(containsAiContentMarker(planText), true);
  // ASCII-only so the label survives a plain-text export or clipboard paste.
  assert.ok(
    [...AI_CONTENT_MARKER].every((char) => char.codePointAt(0) >= 0x20 && char.codePointAt(0) <= 0x7e),
    AI_CONTENT_MARKER,
  );
});

test('P02 a reviewed catalogue import is not labelled as AI', () => {
  const planText = buildProtocolPlanText(AI_FIXTURE, {
    conditionName: 'Dementia',
    provenance: PROTOCOL_PROVENANCE.REVIEWED,
    dateLabel: DATE_LABEL,
  });
  assert.equal(containsAiContentMarker(planText), false);
  assert.ok(
    planText.includes(`Source: Reviewed protocol catalogue (AssessSuite), imported ${DATE_LABEL}.`),
    planText,
  );
});

test('P02a an unknown or missing provenance fails towards over-disclosure', () => {
  for (const provenance of [undefined, null, '', 'something-else']) {
    const planText = buildProtocolPlanText(AI_FIXTURE, {
      conditionName: 'Dementia',
      provenance,
      dateLabel: DATE_LABEL,
    });
    assert.equal(containsAiContentMarker(planText), true, String(provenance));
  }
});

test('P03 contraindications and red flags travel with the imported plan', () => {
  const planText = buildProtocolPlanText(AI_FIXTURE, {
    conditionName: 'Dementia',
    provenance: PROTOCOL_PROVENANCE.AI,
    dateLabel: DATE_LABEL,
  });
  const section = planText.slice(planText.indexOf('CONTRAINDICATIONS AND RED FLAGS'));
  assert.match(section, /Absolute: Unstable angina/);
  assert.match(section, /Relative: Uncontrolled hypertension/);
  assert.match(section, /Red flags: New chest pain during exertion/);
});

test('P04 a protocol with no contraindications says so explicitly', () => {
  const planText = buildProtocolPlanText(
    { exercise_prescription: AI_FIXTURE.exercise_prescription },
    { conditionName: 'Dementia', provenance: PROTOCOL_PROVENANCE.AI, dateLabel: DATE_LABEL },
  );
  assert.match(planText, /CONTRAINDICATIONS AND RED FLAGS/);
  assert.match(planText, /Screen the client independently before prescribing\./);
});

test('P05 references travel with the verification state the data actually carries', () => {
  const planText = buildProtocolPlanText(AI_FIXTURE, {
    conditionName: 'Dementia',
    provenance: PROTOCOL_PROVENANCE.AI,
    dateLabel: DATE_LABEL,
  });
  const section = planText.slice(planText.indexOf('KEY REFERENCES'));
  assert.match(section, /1\. Example A \(2024\)\..*\[verified\]/);
  assert.match(section, /2\. Example B \(2023\)\..*\[not verified\]/);
  // The unverified reference must never inherit a verification claim.
  const unverifiedLine = section.split('\n').find((line) => line.includes('Example B'));
  assert.doesNotMatch(unverifiedLine, /✓/);
  assert.doesNotMatch(unverifiedLine, /(?<!not )\[verified\]/);

  const noReferences = buildProtocolPlanText(
    { exercise_prescription: AI_FIXTURE.exercise_prescription },
    { conditionName: 'Dementia', provenance: PROTOCOL_PROVENANCE.AI, dateLabel: DATE_LABEL },
  );
  assert.match(noReferences, /No verified references accompanied this protocol\./);
});

test('P06 later phases are disclosed rather than silently dropped', () => {
  const planText = buildProtocolPlanText(AI_FIXTURE, {
    conditionName: 'Dementia',
    provenance: PROTOCOL_PROVENANCE.AI,
    dateLabel: DATE_LABEL,
  });
  assert.match(planText, /Later phases were not imported\. See the full protocol before progressing\./);

  const singlePhase = buildProtocolPlanText(
    { progression: { phases: [{ phase_name: 'Only', goals: 'g', duration: 'd' }] } },
    { conditionName: 'Dementia', provenance: PROTOCOL_PROVENANCE.AI, dateLabel: DATE_LABEL },
  );
  assert.doesNotMatch(singlePhase, /Later phases were not imported/);
});

test('P07 malformed protocol content does not throw', () => {
  const malformed = {
    exercise_prescription: { exercises: 'oops', frequency: 42 },
    progression: 'oops',
    contraindications: 'oops',
    references: 'oops',
  };
  let planText;
  assert.doesNotThrow(() => {
    planText = buildProtocolPlanText(malformed, {
      conditionName: 'Dementia',
      provenance: PROTOCOL_PROVENANCE.AI,
      dateLabel: DATE_LABEL,
    });
  });
  assert.equal(typeof planText, 'string');
  assert.match(planText, /Screen the client independently before prescribing\./);
  assert.match(planText, /No verified references accompanied this protocol\./);

  for (const input of [null, undefined, 'oops', 42, []]) {
    assert.doesNotThrow(() => buildProtocolPlanText(input, { conditionName: 'X', dateLabel: DATE_LABEL }));
  }
});

test('P08 the import target skips published notes and reports why', () => {
  const todayDateStr = localDayOf(new Date());
  const published = { id: 'p', status: 'published', note_date: new Date().toISOString() };
  const draft = { id: 'd', status: 'draft', note_date: new Date().toISOString() };

  assert.deepEqual(
    selectProtocolImportTarget([published], { todayDateStr }),
    { mode: 'create', blockedByPublished: true },
  );

  const withDraft = selectProtocolImportTarget([published, draft], { todayDateStr });
  assert.equal(withDraft.mode, 'append');
  assert.equal(withDraft.note.id, 'd');

  assert.deepEqual(
    selectProtocolImportTarget([], { todayDateStr }),
    { mode: 'create', blockedByPublished: false },
  );

  // A corrupt note_date must make the note "not today", never throw.
  assert.equal(localDayOf('not-a-date'), null);
  assert.deepEqual(
    selectProtocolImportTarget([{ id: 'bad', status: 'draft', note_date: 'not-a-date' }], { todayDateStr }),
    { mode: 'create', blockedByPublished: false },
  );

  assert.equal(isPublishedNote(published), true);
  assert.equal(isPublishedNote(draft), false);
  assert.equal(selectAppendableNote('oops'), null);
  assert.equal(selectAppendableNote([published]), null);
});

test('P09 disclosure copy is Australian English and the marker is idempotent', () => {
  assert.match(AI_REPORT_DISCLOSURE_SENTENCE, /labelled/);
  assert.doesNotMatch(AI_REPORT_DISCLOSURE_SENTENCE, /labeled/);
  assert.match(AI_LETTER_DISCLOSURE_SENTENCE, /drafted with AI assistance/);
  assert.doesNotMatch(AI_LETTER_DISCLOSURE_SENTENCE, /labeled/);
  assert.equal(AI_SECTION_TAG, 'AI-assisted draft');

  const once = markAiAssistedText('Client reports improved tolerance.', { dateLabel: DATE_LABEL });
  const twice = markAiAssistedText(once, { dateLabel: DATE_LABEL });
  assert.equal(twice, once);
  assert.equal((twice.match(/REQUIRES CLINICIAN REVIEW/g) || []).length, 1);
  assert.equal(markAiAssistedText('', { dateLabel: DATE_LABEL }), '');
  assert.equal(markAiAssistedText(null, { dateLabel: DATE_LABEL }), '');

  const entry = aiProvenanceEntry({
    source: 'transcript-dissection',
    fields: ['plan', 42],
    dateLabel: DATE_LABEL,
    subject: 'Dementia',
  });
  assert.equal(entry.marker_version, AI_PROVENANCE_VERSION);
  assert.deepEqual(entry.fields, ['plan']);
  assert.equal(entry.recorded_at, DATE_LABEL);
  assert.deepEqual(appendAiProvenance('not-an-array', entry), [entry]);
  assert.equal(appendAiProvenance([entry], entry).length, 2);
});

test('P10 the protocol import modal uses the shared builder and target selector', () => {
  const source = readSource('src', 'components', 'protocols', 'ImportToSOAPModal.jsx');
  assert.match(source, /buildProtocolPlanText\(/);
  assert.match(source, /selectProtocolImportTarget\(/);
  assert.match(source, /aiProvenanceEntry\(/);
  assert.match(source, /appendAiProvenance\(/);
  assert.doesNotMatch(source, /const generatePlanText/);
  // Blocked-by-published must be surfaced, not silently swallowed.
  assert.match(source, /target\.blockedByPublished/);
  assert.match(source, /BLOCKED_BY_PUBLISHED_MESSAGE/);
  assert.equal(
    BLOCKED_BY_PUBLISHED_MESSAGE,
    "Today's note is published, so the protocol was added to a new draft note.",
  );

  const page = readSource('src', 'pages', 'TreatmentProtocols.jsx');
  assert.match(
    page,
    /provenance=\{selectedCondition\?\.protocol \? PROTOCOL_PROVENANCE\.REVIEWED : PROTOCOL_PROVENANCE\.AI\}/,
  );
});

test('P11 report builders and the SOAP modal persist the AI provenance', () => {
  const wizard = readSource('src', 'components', 'reports', 'UnifiedReportWizard.jsx');
  assert.match(wizard, /AI_REPORT_DISCLOSURE_SENTENCE/);
  assert.match(wizard, /AI_LETTER_DISCLOSURE_SENTENCE/);
  assert.match(wizard, /_ai_drafted/);
  assert.match(wizard, /ai_assisted_sections/);

  const sectionEditor = readSource('src', 'components', 'reports', 'wizard-steps', 'SectionEditor.jsx');
  assert.match(sectionEditor, /_ai_drafted`\]: true/);
  assert.match(sectionEditor, /_ai_drafted`\]: false/);

  const modal = readSource('src', 'components', 'calendar', 'SOAPNoteModal.jsx');
  assert.match(modal, /markAiAssistedText\(/);
  assert.match(modal, /ai_provenance: soapNote\.ai_provenance \|\| \[\]/);
});

test('P13 a concurrent-amendment refusal is explained, not surfaced as a bare failure', () => {
  // R1: the published-note guard makes a stale amendment 409 instead of
  // silently clobbering someone else's. That is the correct fail-closed
  // outcome, but it must not reach the clinician as "Failed to save note: …".
  const modal = readSource('src', 'components', 'calendar', 'SOAPNoteModal.jsx');
  assert.match(modal, /normalizeSdkError\(error, \{ stage: 'soap_note_save' \}\)/);
  assert.match(modal, /status === 409/);
  assert.match(modal, /This note was amended by someone else while you had it open\./);
  assert.match(modal, /Nothing you typed has been saved\./);
});

test('P12 every background SOAP-note writer selects an appendable note', () => {
  // R5: the published-note guard makes any write to a finalised note 409.
  // These five sites appended into whichever note they found first.
  const writers = [
    ['src', 'components', 'assessments', 'TestRunnerSOAPHelper.jsx'],
    ['src', 'components', 'assessments', 'SixMeterWalkStandaloneWrapper.jsx'],
    ['src', 'components', 'assessments', '8FootUpandGoStandaloneWrapper.jsx'],
    ['src', 'components', 'assessments', 'SixMinuteStepTestStandaloneWrapper.jsx'],
    ['src', 'components', 'assessments', 'ModifiedRankinScaleMRSRunner.jsx'],
  ];
  for (const writer of writers) {
    const source = readSource(...writer);
    assert.match(source, /selectAppendableNote\(/, writer.join('/'));
    assert.doesNotMatch(source, /existingSoapNotes\[0\]/, writer.join('/'));
    assert.doesNotMatch(source, /existingSOAPNotes\[0\]/, writer.join('/'));
    assert.doesNotMatch(source, /soapNotes\[0\]/, writer.join('/'));
  }
});
