import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('PhysioEpisodes is registered and direct access is profession gated', () => {
  const pages = read('src', 'pages.config.js');
  const workspace = read('src', 'pages', 'PhysioEpisodes.jsx');
  assert.match(pages, /import PhysioEpisodes from '.\/pages\/PhysioEpisodes'/);
  assert.match(pages, /"PhysioEpisodes": PhysioEpisodes/);
  assert.match(workspace, /activeProfession\.id !== 'physio'/);
  assert.match(workspace, /<Navigate to="\/Dashboard" replace/);
});

test('episode workspace covers client lifecycle, examinations, notes, reports and discharge', () => {
  const workspace = read('src', 'pages', 'PhysioEpisodes.jsx');
  for (const requiredSurface of [
    'Episode overview',
    'Referral and funding',
    'InitialAssessmentWorkspace',
    'Initial findings snapshot',
    'Goals',
    'Repeated measures and outcomes',
    'Encounters and treatment',
    'ClientSOAPNotes',
    'SavedReports',
    'PhysioAiWorkspace',
    'Home program prescriptions',
    'Progress, reporting and discharge',
    'completeDischarge',
  ]) {
    assert.ok(workspace.includes(requiredSurface), `missing ${requiredSurface}`);
  }
  assert.match(workspace, /PhysioCareEpisode\.filter\(\{ client_id: client\.id, org_id: orgId \}\)/);
  assert.match(workspace, /prepareEpisodePayload/);
});

test('initial assessment binds all three examination forms into the persisted episode', () => {
  const component = read('src', 'components', 'physio', 'InitialAssessmentWorkspace.jsx');
  assert.match(component, /PhysioRedFlagScreen/);
  assert.match(component, /PhysioSubjectiveExam/);
  assert.match(component, /PhysioObjectiveExam/);
  assert.match(component, /red_flag_screen: payload/);
  assert.match(component, /subjective_examination: recorded/);
  assert.match(component, /objective_examination: recorded/);
  assert.match(component, /await onPersist\?\.\(nextEpisode\)/);
});

test('episode aggregation does not impose legacy eight-measure or ten-note truncation', () => {
  const domain = read('src', 'lib', 'physio', 'careEpisode.js');
  assert.doesNotMatch(domain, /slice\(0,\s*8\)/);
  assert.match(domain, /client_assessment_ids/);
  assert.match(domain, /return sorted\.map\(\(note, index\) =>/);
});
