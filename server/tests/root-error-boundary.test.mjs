// Behavioural coverage for src/lib/renderFailure.js (the pure logic behind
// src/components/system/RootErrorBoundary.jsx) plus a structural check over
// the boundary component and its authenticated app entry wiring.
//
// No jsdom/react-dom-server path exists here: node --test cannot import a
// .jsx file, and React 18's server renderToString does not run error
// boundaries — hence the pure-logic split described in the module header of
// renderFailure.js. T18-T21 carry the actual behaviour proof; T22 is a
// structural (source-regex) wiring guard.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  MAX_RENDER_FAILURE_MESSAGE,
  clearRenderFailureState,
  describeRenderFailure,
  nextRenderFailureState,
} from '../../src/lib/renderFailure.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

// T18
test('T18: describeRenderFailure reports the real Error name and message', () => {
  const described = describeRenderFailure(new TypeError('x.map is not a function'));
  assert.equal(described.name, 'TypeError');
  assert.match(described.message, /is not a function/);
});

// T19
test('T19: describeRenderFailure truncates long messages and redacts email/id/date patterns', () => {
  const longMessage = 'x'.repeat(5000);
  const truncated = describeRenderFailure(new Error(longMessage));
  assert.equal(truncated.message.length, MAX_RENDER_FAILURE_MESSAGE + 1); // + trailing ellipsis
  assert.ok(truncated.message.endsWith('…'));

  const sensitive = describeRenderFailure(
    new Error('Contact jane@example.com, ref 4321987654321, seen on 01/02/1970.'),
  );
  assert.match(sensitive.message, /\[REDACTED_EMAIL\]/);
  assert.match(sensitive.message, /\[REDACTED_ID\]/);
  assert.match(sensitive.message, /\[REDACTED_DATE\]/);
  assert.ok(!sensitive.message.includes('jane@example.com'));
  assert.ok(!sensitive.message.includes('4321987654321'));
  assert.ok(!sensitive.message.includes('01/02/1970'));
});

// T20
test('T20: describeRenderFailure never throws and always defaults name to Error for non-Error input', () => {
  for (const value of ['boom', null, undefined, {}]) {
    const described = describeRenderFailure(value);
    assert.equal(described.name, 'Error');
    assert.equal(typeof described.message, 'string');
    assert.ok(described.message.length <= MAX_RENDER_FAILURE_MESSAGE + 1);
  }
});

// T21
test('T21: nextRenderFailureState/clearRenderFailureState implement the remount contract', () => {
  const next = nextRenderFailureState(new Error('boom'));
  assert.ok(next.failure);
  assert.equal(next.failure.name, 'Error');

  assert.deepEqual(clearRenderFailureState({ failure: { name: 'Error', message: 'x' }, resetToken: 2 }), {
    failure: null,
    resetToken: 3,
  });
  assert.deepEqual(clearRenderFailureState(undefined), { failure: null, resetToken: 1 });
});

// T22 (structural) — main.jsx wraps App in the boundary, the boundary
// implements the two error-boundary lifecycle hooks, and every import line
// in the boundary resolves to either react or @/lib/renderFailure. This last
// assertion is what keeps the fallback from ever depending on the subtree it
// exists to catch.
test('T22 (structural): authenticated app entry wraps App in the isolated RootErrorBoundary', () => {
  const mainSource = fs.readFileSync(
    path.join(repoRoot, 'apps', 'app-ep', 'src', 'main.jsx'),
    'utf8',
  );
  assert.match(mainSource, /import RootErrorBoundary from ['"]@\/components\/system\/RootErrorBoundary\.jsx['"]/);
  assert.match(mainSource, /initialiseFrontendErrorTelemetry\(\);/);
  assert.match(
    mainSource,
    /<RootErrorBoundary\s+captureError=\{captureFrontendException\}>[\s\S]*<App\s*\/>[\s\S]*<\/RootErrorBoundary>/,
  );

  const boundaryPath = path.join(repoRoot, 'src', 'components', 'system', 'RootErrorBoundary.jsx');
  const boundarySource = fs.readFileSync(boundaryPath, 'utf8');
  assert.match(boundarySource, /static getDerivedStateFromError/);
  assert.match(boundarySource, /componentDidCatch/);
  assert.match(boundarySource, /this\.props\.captureError\?\.\(error\)/);
  assert.doesNotMatch(boundarySource, /console\.(?:error|log|warn)/);

  const importLines = [...boundarySource.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.ok(importLines.length > 0, 'expected at least one import line in RootErrorBoundary.jsx');
  for (const specifier of importLines) {
    assert.ok(
      specifier === 'react' || specifier === '@/lib/renderFailure',
      `unexpected import "${specifier}" in RootErrorBoundary.jsx — its only imports must be react and @/lib/renderFailure`,
    );
  }
});
