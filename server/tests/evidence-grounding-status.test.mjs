// WP2 — honest evidence-grounding copy for the treatment-protocol UI.
//
// Behavioural coverage of describeEvidenceGrounding, plus a wiring safety
// net over TreatmentProtocols.jsx confirming the overclaiming pre-fetch
// toast wording is gone and the helper is actually called.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { describeEvidenceGrounding } from '../../src/lib/evidenceGroundingStatus.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const pageSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'pages', 'TreatmentProtocols.jsx'),
  'utf8',
);

test('a network error is never-ok, regardless of result count', () => {
  const status = describeEvidenceGrounding({ networkError: true, resultCount: 3, reviewsOnlyApplied: true });
  assert.equal(status.ok, false);
});

test('zero results is never-ok', () => {
  const status = describeEvidenceGrounding({ networkError: false, resultCount: 0, reviewsOnlyApplied: true });
  assert.equal(status.ok, false);
});

test('a degraded (non-reviews-only) result is ok but honestly flagged as a warning', () => {
  const status = describeEvidenceGrounding({ networkError: false, resultCount: 2, reviewsOnlyApplied: false });
  assert.equal(status.ok, true);
  assert.equal(status.tone, 'warning');
  assert.match(status.message, /systematic-review/);
});

test('a genuine systematic-review result is ok and reported as success', () => {
  const status = describeEvidenceGrounding({ networkError: false, resultCount: 2, reviewsOnlyApplied: true });
  assert.equal(status.ok, true);
  assert.equal(status.tone, 'success');
});

test('a missing reviewsOnlyApplied is never reported as confirmed review-level grounding', () => {
  // Tri-state: absence of the flag (older server image / alternate path) must
  // fall to a warning, never fall through to the success message.
  for (const missing of [undefined, null]) {
    const status = describeEvidenceGrounding({ networkError: false, resultCount: 2, reviewsOnlyApplied: missing });
    assert.equal(status.ok, true);
    assert.equal(status.tone, 'warning', String(missing));
    assert.doesNotMatch(status.message, /Systematic-review evidence retrieved/);
  }
});

test('TreatmentProtocols.jsx uses the helper and no longer overclaims before the search has even run', () => {
  assert.match(pageSource, /import \{ describeEvidenceGrounding \} from "@\/lib\/evidenceGroundingStatus";/);
  assert.match(pageSource, /describeEvidenceGrounding\(\{/);

  // Whitespace-insensitive: collapse runs of whitespace before matching so a
  // reformat (line wraps, re-indentation) of the old literal cannot silently
  // defeat this guard.
  const normalized = pageSource.replace(/\s+/g, ' ');
  assert.doesNotMatch(normalized, /Generating an AI-assisted protocol from verified research/);

  // Behavioural: the copy actually shown to the clinician (both the toast and
  // the persisted page note) must be sourced from groundingStatus.message —
  // the helper's own honest wording — rather than any static literal. This
  // closes the loophole a bare wording check cannot: any hardcoded
  // overclaiming string reintroduced at these call sites, worded however you
  // like, fails these assertions because it is not groundingStatus.message.
  assert.match(
    pageSource,
    /toast\.warning\(groundingStatus\.message\)/,
    'the grounding warning toast must be sourced from groundingStatus.message, not a static string',
  );
  assert.match(
    pageSource,
    /setEvidenceGroundingNote\(groundingStatus\.message\)/,
    'the persisted grounding note must be sourced from groundingStatus.message, not a static string',
  );
});
