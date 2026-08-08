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

test('an explicitly unverified catalogue reference never badges as verified', () => {
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
  assert.match(pageSource, /getReferenceVerificationBadge\(\{ \.\.\.ref, verified: false \}\)/);
  assert.match(pageSource, /<ClickableReferences references=\{ref\.citation\} verified=\{false\} \/>/);
  assert.doesNotMatch(
    pageSource,
    /verifyReferences|searchEvidence|InvokeLLM/,
    'catalogue browsing must remain deterministic and must not perform evidence or generation calls',
  );
  // Whitespace/quote-style insensitive: the truthful checkmark text is only
  // ever produced by getReferenceVerificationBadge() above, never a literal
  // in the page, so its bare presence anywhere in the page — regardless of
  // surrounding JSX syntax, quote style, extra whitespace, or a second
  // render site elsewhere on the page — is itself the defect.
  assert.doesNotMatch(
    pageSource,
    /✓ Verified/,
    'the "✓ Verified" label must only ever come from getReferenceVerificationBadge(), never a hardcoded literal in the page',
  );
  // Behavioural: the badge actually rendered must be the dynamic object
  // returned above, not a literal className/label pair standing in for it.
  assert.match(pageSource, /className=\{badge\.className\}/, 'the reference badge className must come from the dynamic badge object');
  assert.match(pageSource, /\{badge\.label\}/, 'the reference badge label must come from the dynamic badge object');
});
