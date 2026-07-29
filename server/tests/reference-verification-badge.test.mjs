// WP2 — truthful per-reference verification badge.
//
// Behavioural coverage of the pure helper, plus a wiring safety net over
// TreatmentProtocols.jsx pairing it with the real behaviour above (per the
// convention in treatment-protocol-catalogue.test.mjs), so this closes the
// "tests prove strings not behaviour" gap by never relying on the regex
// assertions alone.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { getReferenceVerificationBadge } from '../../src/lib/referenceVerificationBadge.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const pageSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'pages', 'TreatmentProtocols.jsx'),
  'utf8',
);

test('a verified reference gets the truthful green badge', () => {
  const badge = getReferenceVerificationBadge({ verified: true });
  assert.equal(badge.verified, true);
  assert.equal(badge.label, '✓ Verified');
  assert.match(badge.className, /bg-green/);
});

test('the verifyReferences-outage shape (verified:false, verification:"unverifiable") never badges as verified', () => {
  const badge = getReferenceVerificationBadge({ verified: false, verification: 'unverifiable' });
  assert.equal(badge.verified, false);
  assert.notEqual(badge.label, '✓ Verified');
  assert.match(badge.className, /bg-amber/);
});

test('a missing verified flag fails closed, not open', () => {
  const badge = getReferenceVerificationBadge({});
  assert.equal(badge.verified, false);
  assert.notEqual(badge.label, '✓ Verified');
  assert.match(badge.className, /bg-amber/);
});

test('TreatmentProtocols.jsx wires the truthful badge into the references map', () => {
  assert.match(pageSource, /import \{ getReferenceVerificationBadge \} from "@\/lib\/referenceVerificationBadge";/);
  assert.match(pageSource, /getReferenceVerificationBadge\(ref\)/);
  assert.doesNotMatch(pageSource, /<Badge className="bg-green-600 text-white text-xs">✓ Verified<\/Badge>/);
});
