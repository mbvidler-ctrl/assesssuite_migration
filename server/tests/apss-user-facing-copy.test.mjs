import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSource = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

const formSource = readSource('src/components/onboarding/APSSForm.jsx');
const stageTwoSource = readSource('src/components/onboarding/APSSStage2.jsx');
const quickOnboardSource = readSource('src/components/onboarding/QuickOnboardModal.jsx');
const editClientSource = readSource('src/components/client/EditClientInfoModal.jsx');

test('renders neutral Safety Screen and Clinical Risk Review labels', () => {
  assert.match(formSource, /Safety Screen — Pre-Exercise Screening/);
  assert.match(formSource, /Clinical Risk Review — Pre-Exercise Screening/);
  assert.match(quickOnboardSource, /Safety Screen — Pre-Exercise Screening/);
  assert.match(stageTwoSource, /published pre-exercise screening guidelines/);
  assert.match(editClientSource, /Failed to save the Safety Screen/);
  assert.match(editClientSource, /Failed to save the Clinical Risk Review/);

  assert.doesNotMatch(formSource, /Adult Pre-Exercise Screening \(APSS\)/);
  assert.doesNotMatch(quickOnboardSource, /Adult Pre-Exercise Screening \(APSS\)/);
  assert.doesNotMatch(stageTwoSource, /Adult Pre-Exercise Screening System \(APSS\)|APSS guidelines/);
  assert.doesNotMatch(editClientSource, /Failed to save APSS/);
});

test('retains the published screening hyperlinks', () => {
  assert.match(stageTwoSource, /href="https:\/\/www\.essa\.org\.au"/);
  assert.match(stageTwoSource, /href="https:\/\/www\.sma\.org\.au"/);
  assert.match(stageTwoSource, /target="_blank" rel="noopener noreferrer"/);
});

test('keeps existing apss storage fields intact', () => {
  assert.match(formSource, /\bapss_q1_heart_stroke\b/);
  assert.match(editClientSource, /\bapss_completed\b/);
  assert.match(editClientSource, /\bapss_stage2_completed\b/);
});
