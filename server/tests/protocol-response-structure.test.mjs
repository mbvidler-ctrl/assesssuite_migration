// Behavioural coverage for src/lib/protocolResponse.js — the shared
// structural normaliser TreatmentProtocols.jsx relies on to survive a
// malformed AI-drafted (or reviewed catalogue) treatment protocol without
// crashing the whole page. T12-T16 carry the actual behaviour proof; T17 is
// labelled a wiring guard (source regex over the page), not a behaviour
// proof, matching the tautological-source-test critique this suite was
// asked to avoid repeating.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  normaliseProtocolResponse,
  renderSafetyViolations,
} from '../../src/lib/protocolResponse.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

// T12 — the exact A1 hazard: a scalar where the page expects a string array,
// alongside two intact string-array fields in the same section. One bad
// field must not take the page down, and must not take the good fields with
// it.
test('T12: a malformed contraindications.absolute is dropped without disturbing its siblings', () => {
  const raw = {
    contraindications: {
      absolute: 'Uncontrolled hypertension',
      relative: ['x'],
      red_flags: ['y'],
    },
  };
  assert.deepEqual(renderSafetyViolations(raw), ['contraindications.absolute']);

  const result = normaliseProtocolResponse(raw);
  assert.equal(result.ok, true);
  assert.equal(result.degraded, true);
  assert.ok(result.dropped.includes('contraindications.absolute'));
  assert.deepEqual(result.protocol.contraindications.relative, ['x']);
  assert.deepEqual(result.protocol.contraindications.red_flags, ['y']);
  assert.equal(Object.hasOwn(result.protocol.contraindications, 'absolute'), false);
  assert.deepEqual(renderSafetyViolations(result.protocol), []);
});

// T13 — an object-array field mixing a string, a null and a valid object;
// only the valid object survives, and its own malformed field is dropped
// too rather than crashing the item normaliser.
test('T13: exercise_prescription.exercises keeps only well-formed items and drops their bad fields', () => {
  const raw = {
    exercise_prescription: {
      exercises: [
        'not an object',
        null,
        { name: 'Sit to stand', dosage: { sets: 3 } },
      ],
    },
  };
  const result = normaliseProtocolResponse(raw);
  assert.equal(result.ok, true);
  assert.equal(result.protocol.exercise_prescription.exercises.length, 1);
  const kept = result.protocol.exercise_prescription.exercises[0];
  assert.equal(kept.name, 'Sit to stand');
  assert.equal(Object.hasOwn(kept, 'dosage'), false);
  assert.deepEqual(renderSafetyViolations(result.protocol), []);
});

// T14 — a section that is the wrong shape entirely (object vs array vs
// scalar), each dropped independently, while at least one other section
// still comes through.
test('T14: wrongly-shaped sections are dropped independently, leaving the rest intact', () => {
  const raw = {
    progression: { phases: { phase_name: 'not an array' } },
    outcomes: 'not an object',
    clinical_note: { note: 'not a string' },
    overview: { pathophysiology: 'Valid text.' },
  };
  const result = normaliseProtocolResponse(raw);
  assert.equal(result.ok, true);
  assert.equal(Object.hasOwn(result.protocol, 'progression'), true);
  assert.equal(Object.hasOwn(result.protocol.progression, 'phases'), false);
  assert.equal(Object.hasOwn(result.protocol, 'outcomes'), false);
  assert.equal(Object.hasOwn(result.protocol, 'clinical_note'), false);
  assert.equal(result.protocol.overview.pathophysiology, 'Valid text.');
  assert.ok(result.dropped.includes('progression.phases'));
  assert.ok(result.dropped.includes('outcomes'));
  assert.ok(result.dropped.includes('clinical_note'));
});

// T15 — nothing renderable at all: this is the input to the page's existing
// throw new Error("The AI service returned an invalid treatment protocol.").
test('T15: null, a bare string, an empty array and a number are all rejected outright', () => {
  for (const raw of [null, 'text', [], 42]) {
    const result = normaliseProtocolResponse(raw);
    assert.equal(result.ok, false, `expected ok:false for ${JSON.stringify(raw)}`);
    assert.equal(result.protocol, null);
  }
});

// T16 — losslessness: the regression guard for reviewed catalogue content.
// If any reviewed catalogue row contains a field shape the contract does not
// anticipate, this test fails; the correct fix widens the contract, never
// the assertion, and never excludes the row (R8).
test('T16: the first five reviewed catalogue rows normalise losslessly', () => {
  const catalogueFile = path.join(repoRoot, 'server', 'data-import', 'treatmentprotocol-part-0.jsonl');
  const lines = fs.readFileSync(catalogueFile, 'utf8').split(/\r?\n/).filter((line) => line.trim().length > 0);
  assert.ok(lines.length >= 5, 'expected at least 5 reviewed catalogue rows to exist');
  for (const line of lines.slice(0, 5)) {
    const row = JSON.parse(line);
    const result = normaliseProtocolResponse(row);
    assert.equal(result.ok, true, `row "${row.condition_name}" failed to normalise`);
    assert.equal(result.degraded, false, `row "${row.condition_name}" lost content it should have kept`);
    assert.deepEqual(result.dropped, [], `row "${row.condition_name}" dropped: ${result.dropped.join(', ')}`);
    assert.deepEqual(result.protocol, row, `row "${row.condition_name}" was altered by normalisation`);
  }
});

// T17 — the catalogue match -> page-state handoff must fail closed when the
// render normaliser drops any field. A degraded catalogue row is governed as
// blocked; there is no AI branch and no raw/generated fallback.
test('T17: governed catalogue matches pass through the normaliser and degraded rows are blocked', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'TreatmentProtocols.jsx'), 'utf8');
  assert.match(source, /import\s*\{\s*normaliseProtocolResponse\s*\}\s*from\s*["']@\/lib\/protocolResponse["']/);
  assert.match(source, /normaliseProtocolResponse\(condition\.protocol\)/);
  assert.match(source, /if\s*\(\s*!reviewed\.ok\s*\|\|\s*reviewed\.degraded\s*\)/);
  assert.match(source, /state:\s*PROTOCOL_SEARCH_STATE\.CATALOGUE_BLOCKED/);
  assert.match(source, /setProtocolData\(reviewed\.protocol\)/);
  assert.doesNotMatch(source, /setProtocolData\(condition\.protocol\)/);
  assert.doesNotMatch(source, /InvokeLLM|searchEvidence|buildProtocolViewModel/);
});
