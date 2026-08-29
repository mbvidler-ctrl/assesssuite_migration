import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const ci = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
const assurance = fs.readFileSync(path.join(testsDir, 'run-assurance.mjs'), 'utf8');
const dependencyAudit = fs.readFileSync(
  path.join(repoRoot, 'scripts', 'check-dependency-audit.mjs'),
  'utf8',
);
const referralBrowserConfig = fs.readFileSync(
  path.join(repoRoot, 'e2e', 'referral-uploader', 'vite.config.mjs'),
  'utf8',
);

test('CI rejects every .env variant and scans the exact pull-request diff with the pinned scanner', () => {
  assert.match(ci, /BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(ci, /git merge-base --is-ancestor "\$\{base_sha\}" HEAD/);
  assert.match(ci, /git diff --name-only "\$\{base_sha\}"\.\.\.HEAD/);
  assert.match(ci, /\(\^\|\/\)\\\.env\(\$\|\\\.\)/);
  assert.match(ci, /EXPECTED_RELEASE_SCANNER_SHA256: [0-9a-f]{64}/);
  assert.match(ci, /sha256sum scripts\/scan-release-diff\.mjs/);
  assert.match(ci, /node scripts\/scan-release-diff\.mjs "\$\{RUNNER_TEMP\}\/pull-request\.diff"/);
});

test('hosted CI and aggregate assurance retain the split and safe-HTML release surfaces', () => {
  assert.match(ci, /npm run build:platform/);
  assert.match(ci, /npm run build:landing/);
  assert.match(ci, /npm run verify:split-build/);
  assert.match(ci, /npm run test:split-hosting/);
  assert.match(ci, /npm run test:safe-html-output/);
  assert.match(assurance, /'split-hosting-boundary\.test\.mjs'/);
  assert.match(assurance, /'static-spa-routing\.test\.mjs'/);
});

test('the referral browser harness pins an explicit EP build identity', () => {
  assert.match(referralBrowserConfig, /'import\.meta\.env\.VITE_PROFESSION': JSON\.stringify\('exercise-physiology'\)/);
  assert.match(referralBrowserConfig, /'import\.meta\.env\.VITE_BASE44_APP_ID': JSON\.stringify\('local-assesssuite'\)/);
});

test('dependency exceptions bind both advisory ID and reviewed package name', () => {
  assert.match(dependencyAudit, /ALLOWLISTED_ADVISORIES\.get\(id\)/);
  assert.match(dependencyAudit, /exception\?\.packages\.includes\(packageName\)/);
  assert.doesNotMatch(dependencyAudit, /if \(ALLOWLISTED_ADVISORIES\.has\(id\)\)/);
});
