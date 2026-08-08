// Deterministic protocol-catalogue governance and page-wiring assurance.
// This replaces the retired browser evidence-search grounding path: Protocol
// Assistance now searches controlled catalogue records only and never claims
// that a browser-side evidence search verified them.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PROTOCOL_SEARCH_STATE,
  searchProtocolCatalogue,
} from '../../src/lib/clinical/protocol-assistance/index.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const pageSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'pages', 'TreatmentProtocols.jsx'),
  'utf8',
);

const CONTEXT = Object.freeze({
  profession: 'accredited_exercise_physiologist',
  scope: 'exercise_physiology',
  asOf: '2026-08-08',
});

function governedRecord(overrides = {}) {
  return {
    id: 'protocol-oa-v1',
    condition_name: 'Osteoarthritis',
    aliases: ['OA'],
    category: 'musculoskeletal',
    profession: ['accredited_exercise_physiologist'],
    scope: ['exercise_physiology'],
    source: [{
      title: 'Synthetic controlled source',
      url: 'https://example.test/protocol-source',
    }],
    reviewer: {
      name: 'Synthetic Reviewer',
      credentials: 'AEP',
      reviewed_at: '2026-08-01',
    },
    version: '1.0.0',
    expiry: '2027-08-01',
    rights: { status: 'internal_original', holder: 'Synthetic Test Owner' },
    management_target: 'Functional capacity',
    approval_status: 'reviewed',
    overview: { pathophysiology: 'Synthetic catalogue content.' },
    references: [{ citation: 'Synthetic source citation.' }],
    ...overrides,
  };
}

test('a governed in-scope record is the only kind returned as a match', () => {
  const result = searchProtocolCatalogue({
    query: 'osteoarthritis',
    catalogue: [governedRecord()],
    ...CONTEXT,
  });
  assert.equal(result.state, PROTOCOL_SEARCH_STATE.MATCHES);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].protocol.condition_name, 'Osteoarthritis');
});

test('missing governance and an expired review fail closed as catalogue_blocked', () => {
  const ungoverned = governedRecord({ reviewer: undefined });
  const expired = governedRecord({ id: 'expired', expiry: '2026-08-07' });

  for (const record of [ungoverned, expired]) {
    const result = searchProtocolCatalogue({
      query: 'osteoarthritis',
      catalogue: [record],
      ...CONTEXT,
    });
    assert.equal(result.state, PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED);
    assert.equal(result.matches.length, 0);
    assert.ok(result.blocked[0].issues.length > 0);
  }
});

test('an out-of-scope or explicitly unsupported record is labelled unsupported, never generated', () => {
  const outOfScope = governedRecord({ scope: ['physiotherapy'] });
  const explicitlyUnsupported = {
    condition_name: 'Osteoarthritis',
    supported: false,
    unsupported_reason: 'Outside the controlled Exercise Physiology catalogue.',
  };

  for (const record of [outOfScope, explicitlyUnsupported]) {
    const result = searchProtocolCatalogue({
      query: 'osteoarthritis',
      catalogue: [record],
      ...CONTEXT,
    });
    assert.equal(result.state, PROTOCOL_SEARCH_STATE.UNSUPPORTED);
    assert.equal(result.matches.length, 0);
    assert.ok(result.reasons.length > 0);
  }
});

test('malformed or unavailable catalogues produce explicit blocked states', () => {
  const malformed = searchProtocolCatalogue({
    query: 'osteoarthritis',
    catalogue: [{ condition_name: 'Osteoarthritis' }],
    ...CONTEXT,
  });
  assert.equal(malformed.state, PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED);

  const unavailable = searchProtocolCatalogue({
    query: 'osteoarthritis',
    catalogue: null,
    ...CONTEXT,
  });
  assert.equal(unavailable.state, PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED);
  assert.equal(unavailable.code, 'catalogue_unavailable');
});

test('TreatmentProtocols has no evidence-search or generation fallback and makes no verification overclaim', () => {
  assert.equal(
    (pageSource.match(/from\s+["']@\/lib\/clinical\/protocol-assistance\/index\.js["']/g) || []).length,
    1,
    'the page must consume one governed protocol-assistance engine',
  );
  assert.doesNotMatch(
    pageSource,
    /describeEvidenceGrounding|searchEvidence|verifyReferences|InvokeLLM|add_context_from_internet/,
  );
  assert.doesNotMatch(pageSource, /Generating an AI-assisted protocol from verified research/);
  assert.match(pageSource, /No protocol was generated/);
  assert.match(pageSource, /verified:\s*false/);
  assert.match(pageSource, /verified=\{false\}/);
});
