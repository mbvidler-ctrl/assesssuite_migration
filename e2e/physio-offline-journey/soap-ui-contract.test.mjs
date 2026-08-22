import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const soapModalSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'components', 'calendar', 'SOAPNoteModal.jsx'),
  'utf8',
);

test('Physio keeps transcription but cannot render legacy transcript dissection', () => {
  assert.match(
    soapModalSource,
    /const legacyTranscriptDissectionAllowed = activeProfession\.id === 'exercise-physiology';/,
  );
  assert.match(
    soapModalSource,
    /\{!isLocked && legacyTranscriptDissectionAllowed && \(/,
  );
  assert.match(soapModalSource, /onClick=\{\(\) => transcribeAudio\(audio\.url\)\}/);
  assert.match(soapModalSource, /Dissect to SOAP/);
});
