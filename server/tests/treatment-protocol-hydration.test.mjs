import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDirectory, '..', '..');
const importDirectory = path.join(repoRoot, 'server', 'data-import');

function readJsonLines(fileName) {
  return fs.readFileSync(path.join(importDirectory, fileName), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

test('generated treatment protocol catalogue is deterministic and current', () => {
  assert.doesNotThrow(() => execFileSync(
    process.execPath,
    [path.join(repoRoot, 'server', 'catalogue', 'generate-treatment-protocols.mjs'), '--check'],
    { cwd: repoRoot, stdio: 'pipe' },
  ));
});

test('shared treatment protocol library is extensively hydrated across physiotherapy domains', () => {
  const legacy = readJsonLines('treatmentprotocol-part-0.jsonl');
  const hydrated = readJsonLines('treatmentprotocol-part-1.jsonl');
  const allNames = new Set([...legacy, ...hydrated].map((row) => row.condition_name.trim().toLocaleLowerCase()));

  assert.equal(hydrated.length, 60);
  assert.ok(allNames.size >= 100, `expected at least 100 distinct protocols, received ${allNames.size}`);
  assert.equal(new Set(hydrated.map((row) => row.condition_name.toLocaleLowerCase())).size, hydrated.length);

  const requiredTopics = [
    'Rotator Cuff Tendinopathy',
    'Anterior Cruciate Ligament Reconstruction Rehabilitation',
    'Spinal Cord Injury Rehabilitation',
    'Peripheral Vestibular Hypofunction',
    'Cerebral Palsy Rehabilitation — Children and Young People',
    'Bronchiectasis Airway Clearance and Rehabilitation',
    'Stress Urinary Incontinence Rehabilitation',
    'Post-COVID Condition Rehabilitation',
    'Cancer-related Lymphoedema Rehabilitation',
  ];
  const generatedNames = new Set(hydrated.map((row) => row.condition_name));
  requiredTopics.forEach((topic) => assert.ok(generatedNames.has(topic), `missing integrated domain protocol: ${topic}`));

  for (const protocol of hydrated) {
    assert.equal(protocol.evidence_status, 'source_linked', protocol.condition_name);
    assert.equal(protocol.evidence_reviewed_at, '2026-08-30', protocol.condition_name);
    assert.ok(protocol.assessment.key_assessments.length >= 4, protocol.condition_name);
    assert.ok(protocol.assessment.outcome_measures.length >= 3, protocol.condition_name);
    assert.ok(protocol.exercise_prescription.exercises.length >= 4, protocol.condition_name);
    assert.equal(protocol.progression.phases.length, 3, protocol.condition_name);
    assert.ok(protocol.contraindications.red_flags.length >= 3, protocol.condition_name);
    assert.ok(protocol.references.length >= 1, protocol.condition_name);
    assert.deepEqual(protocol.applicable_professions, ['physiotherapy', 'exercise-physiology']);
    protocol.references.forEach((reference) => {
      assert.match(reference.url, /^https:\/\//, protocol.condition_name);
      assert.equal(reference.verification, 'catalogue_source_linked', protocol.condition_name);
      assert.equal(reference.catalogue_verified_at, '2026-08-30', protocol.condition_name);
      assert.match(reference.citation, /https:\/\//, protocol.condition_name);
    });
  }
});

test('source-linked catalogue references bypass repeat academic lookups while AI references remain verified', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'TreatmentProtocols.jsx'), 'utf8');
  assert.match(source, /verification === "catalogue_source_linked"/);
  assert.match(source, /referencesNeedingVerification/);
  assert.match(source, /base44\.functions\.invoke\('verifyReferences'/);
  assert.match(source, /Source-linked library/);
});
