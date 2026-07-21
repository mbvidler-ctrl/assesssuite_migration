import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const pageSource = fs.readFileSync(
  path.join(repoRoot, 'src', 'pages', 'TreatmentProtocols.jsx'),
  'utf8',
);

test('treatment-protocol search exposes reviewed catalogue rows and no disabled generation path', () => {
  assert.match(pageSource, /base44\.entities\.TreatmentProtocol\.list\(\)/);
  assert.match(pageSource, /No reviewed treatment protocol matches/);
  assert.doesNotMatch(pageSource, /Core\.InvokeLLM/);
  assert.doesNotMatch(pageSource, /searchEvidence/);
  assert.doesNotMatch(pageSource, /Generate Protocol for/);
  assert.doesNotMatch(pageSource, /enter custom condition/i);
  assert.doesNotMatch(pageSource, /TreatmentProtocol\.filter/);
});

test('reviewed catalogue preparation is null-safe, deduplicated and sorted before selection', () => {
  assert.match(pageSource, /for \(const row of Array\.isArray\(rows\) \? rows : \[\]\)/);
  assert.match(pageSource, /typeof row\?\.condition_name === "string"/);
  assert.match(pageSource, /uniqueByName\.has\(key\)/);
  assert.match(pageSource, /\[\.\.\.uniqueByName\.values\(\)\]\.sort/);
  assert.match(pageSource, /condition_name\.localeCompare/);
  assert.match(pageSource, /const reviewedProtocol = condition\?\.protocol/);
  assert.match(pageSource, /onClick=\{\(\) => loadProtocol\(condition\)\}/);
  assert.match(pageSource, /setProtocolData\(protocol\)/);
  assert.match(pageSource, /<ImportToSOAPModal/);
});
