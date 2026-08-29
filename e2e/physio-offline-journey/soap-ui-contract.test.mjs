import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const soapModalSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'components', 'calendar', 'SOAPNoteModal.jsx'),
  'utf8',
);

test('Physio keeps the shared EP transcription and SOAP-dissection surfaces functional', () => {
  assert.match(
    soapModalSource,
    /const sharedTranscriptDissectionAllowed = activeProfession\.features\.legacyGeneralClinicalLlm === true;/,
  );
  assert.match(
    soapModalSource,
    /\{!isLocked && sharedTranscriptDissectionAllowed && \(/,
  );
  assert.match(soapModalSource, /onClick=\{\(\) => transcribeAudio\(audio\.url\)\}/);
  assert.match(soapModalSource, /Dissect to SOAP/);
  assert.match(soapModalSource, /await persistentTranscription\.start\(\{/);
  assert.match(soapModalSource, /Confirm and start persistent transcription/);
});
