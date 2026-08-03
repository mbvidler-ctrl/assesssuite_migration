import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  classifyRegistryChange,
  diffManifests,
  evaluateFlagImpact,
  parseNotice,
} from '../../scripts/check-flag-impact.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const fixturesDir = path.join(testsDir, 'fixtures', 'flag-impact');
const noticesDir = path.join(fixturesDir, 'notices');

function readJsonFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf8'));
}

function readNoticeFixture(name) {
  return fs.readFileSync(path.join(noticesDir, name), 'utf8');
}

function noticeRecord(name, { canonicalPath } = {}) {
  return { path: canonicalPath || `docs/deployment/notices/${name}`, text: readNoticeFixture(name) };
}

const baseManifest = () => readJsonFixture('base-manifest.json');
const unchangedManifest = () => readJsonFixture('head-manifest-unchanged.json');
const productionOffManifest = () => readJsonFixture('head-manifest-production-off.json');
const surfaceRemovedManifest = () => readJsonFixture('head-manifest-surface-removed.json');

test('G01 no-op change is not triggered', () => {
  const result = evaluateFlagImpact({ baseManifest: baseManifest(), headManifest: unchangedManifest(), changedFiles: [] });
  assert.deepEqual(result, { triggered: false, ok: true, unmet: [], triggeringFlags: [], summary: 'No capability-flag changes detected.' });
});

test('G02 T1 reduction with no notice fails and names the flag', () => {
  const result = evaluateFlagImpact({
    baseManifest: baseManifest(),
    headManifest: productionOffManifest(),
    changedFiles: ['server/capabilityFlags.mjs'],
  });
  assert.equal(result.triggered, true);
  assert.equal(result.ok, false);
  assert.ok(result.unmet.some((message) => message.includes('GENERAL_CLINICAL_LLM_ENABLED') && message.toLowerCase().includes('capability notice')));
});

test('G03 T1 reduction covered by a valid notice in changed files passes', () => {
  const result = evaluateFlagImpact({
    baseManifest: baseManifest(),
    headManifest: productionOffManifest(),
    changedFiles: ['server/capabilityFlags.mjs', 'docs/deployment/flag-manifest.json', 'docs/deployment/notices/notice-valid.md'],
    notices: [noticeRecord('notice-valid.md')],
  });
  assert.equal(result.triggered, true);
  assert.equal(result.ok, true, JSON.stringify(result.unmet));
  assert.match(result.summary, /GENERAL_CLINICAL_LLM_ENABLED/);
});

test('G04 notice present but flags: omits the triggering flag fails (R2)', () => {
  const result = evaluateFlagImpact({
    baseManifest: baseManifest(),
    headManifest: productionOffManifest(),
    changedFiles: ['docs/deployment/flag-manifest.json', 'docs/deployment/notices/notice-wrong-flag.md'],
    notices: [noticeRecord('notice-wrong-flag.md')],
  });
  assert.equal(result.ok, false);
  assert.ok(result.unmet.some((message) => message.startsWith('R2:')));
});

test('G05 reduction covered by a direction: restores notice fails (R4)', () => {
  const result = evaluateFlagImpact({
    baseManifest: baseManifest(),
    headManifest: productionOffManifest(),
    changedFiles: ['docs/deployment/flag-manifest.json', 'docs/deployment/notices/notice-wrong-direction.md'],
    notices: [noticeRecord('notice-wrong-direction.md')],
  });
  assert.equal(result.ok, false);
  assert.ok(result.unmet.some((message) => message.startsWith('R4:')));
});

test('G06 reduction covered by a TBC owner_acknowledgement fails (R4)', () => {
  const result = evaluateFlagImpact({
    baseManifest: baseManifest(),
    headManifest: productionOffManifest(),
    changedFiles: ['docs/deployment/flag-manifest.json', 'docs/deployment/notices/notice-blank-ack.md'],
    notices: [noticeRecord('notice-blank-ack.md')],
  });
  assert.equal(result.ok, false);
  assert.ok(result.unmet.some((message) => message.startsWith('R4:')));
});

test('G07 T3 surface removal with no notice fails and names the removed path', () => {
  const result = evaluateFlagImpact({
    baseManifest: baseManifest(),
    headManifest: surfaceRemovedManifest(),
    changedFiles: ['server/capabilityFlags.mjs'],
  });
  assert.equal(result.triggered, true);
  assert.equal(result.ok, false);
  assert.ok(result.unmet.some((message) => message.includes('capability notice')));
  const changes = diffManifests(baseManifest(), surfaceRemovedManifest());
  assert.ok(changes.some((change) => change.kind === 'client_surface_removed' && change.path === 'src/pages/TreatmentProtocols.jsx'));
});

test('G08 T4 diff-only edit to a watched TOML fails even when manifests are identical', () => {
  const diffText = fs.readFileSync(path.join(fixturesDir, 'diff-toml-flag.txt'), 'utf8');
  const result = evaluateFlagImpact({
    baseManifest: unchangedManifest(),
    headManifest: unchangedManifest(),
    changedFiles: ['fly.production.toml'],
    diffText,
  });
  assert.equal(result.triggered, true);
  assert.equal(result.ok, false);
  assert.ok(result.triggeringFlags.includes('GENERAL_CLINICAL_LLM_ENABLED'));
});

test('G09 R5 — a server-gate file changes with no manifest update and a stale manifest', () => {
  const result = evaluateFlagImpact({
    baseManifest: baseManifest(),
    headManifest: productionOffManifest(),
    // T1 already triggers on GENERAL_CLINICAL_LLM_ENABLED; the notice covers
    // it correctly (R1-R4 all satisfied), but the gate file that implements
    // the switch also changed and the manifest file itself is not part of
    // the changed set, with no confirmation that flags:check still passes.
    changedFiles: ['server/integrations.mjs', 'docs/deployment/notices/notice-valid.md'],
    notices: [noticeRecord('notice-valid.md')],
    manifestCheckOk: false,
  });
  assert.equal(result.ok, false);
  assert.ok(result.unmet.some((message) => message.startsWith('R5:')));
});

test('G09b R5 is satisfied when flags:check is confirmed to pass instead', () => {
  const result = evaluateFlagImpact({
    baseManifest: baseManifest(),
    headManifest: productionOffManifest(),
    changedFiles: ['server/integrations.mjs', 'docs/deployment/notices/notice-valid.md'],
    notices: [noticeRecord('notice-valid.md')],
    manifestCheckOk: true,
  });
  assert.equal(result.ok, true, JSON.stringify(result.unmet));
});

test('G10 classifyRegistryChange', () => {
  assert.equal(classifyRegistryChange('1', '0'), 'reducing');
  assert.equal(classifyRegistryChange('0', '1'), 'restoring');
  assert.equal(classifyRegistryChange('19 July 2026', 'effective'), 'none');
  assert.equal(classifyRegistryChange('1', undefined), 'reducing');
  assert.equal(classifyRegistryChange('0', undefined), 'none');
  assert.equal(classifyRegistryChange(null, null), 'none');
});

test('G11 parseNotice rejects malformed notices and accepts both shipped notices', () => {
  const missingFence = parseNotice('notice-malformed.md', readNoticeFixture('notice-malformed.md'));
  assert.equal(missingFence.ok, false);
  assert.ok(missingFence.errors.some((message) => message.includes('fence')));

  const badDirection = parseNotice('x.md', [
    '<!--capability-notice',
    'notice_id: x',
    'date: 2026-01-01',
    'flags: GENERAL_CLINICAL_LLM_ENABLED',
    'direction: paused',
    'release: v1',
    'surfaces_affected: 1',
    'owner_acknowledgement: ack',
    'expected_duration: n/a',
    'capability-notice-->',
    '',
    '## User-visible effect',
    'x',
    '## Surfaces affected',
    'x',
    '## Detection and monitoring',
    'x',
    '## Restoration criteria',
    'x',
  ].join('\n'));
  assert.equal(badDirection.ok, false);
  assert.ok(badDirection.errors.some((message) => message.includes('direction')));

  const wrongStem = parseNotice('20260101-real-name.md', readNoticeFixture('notice-valid.md').replace('notice_id: notice-valid', 'notice_id: some-other-id'));
  assert.equal(wrongStem.ok, false);
  assert.ok(wrongStem.errors.some((message) => message.includes('notice_id')));

  const wrongDate = parseNotice(
    '20260101-real-name.md',
    readNoticeFixture('notice-valid.md')
      .replace('notice_id: notice-valid', 'notice_id: 20260101-real-name')
      .replace('date: 2026-01-01', 'date: 2026-02-02'),
  );
  assert.equal(wrongDate.ok, false);
  assert.ok(wrongDate.errors.some((message) => message.includes('does not match the filename prefix')));

  const missingHeading = parseNotice('x.md', readNoticeFixture('notice-valid.md').replace('## Restoration criteria', '## Not A Real Heading'));
  assert.equal(missingHeading.ok, false);
  assert.ok(missingHeading.errors.some((message) => message.includes('Restoration criteria')));

  const emptyHeading = parseNotice(
    'x.md',
    readNoticeFixture('notice-valid.md').replace('Synthetic restoration criteria.', ''),
  );
  assert.equal(emptyHeading.ok, false);
  assert.ok(emptyHeading.errors.some((message) => message.includes('no content')));

  const validLf = readNoticeFixture('notice-valid.md').replaceAll('\r\n', '\n');
  const validCrlf = validLf.replaceAll('\n', '\r\n');
  const parsedLf = parseNotice('notice-valid.md', validLf);
  const parsedCrlf = parseNotice('notice-valid.md', validCrlf);
  assert.equal(parsedLf.ok, true, JSON.stringify(parsedLf.errors));
  assert.deepEqual(parsedCrlf, parsedLf, 'LF and CRLF notices must parse identically');

  // Both real, shipped notices must parse cleanly.
  for (const fileName of [
    '20260721-general-clinical-llm-disabled.md',
    '20260728-general-clinical-llm-restored.md',
  ]) {
    const text = fs.readFileSync(path.join(repoRoot, 'docs', 'deployment', 'notices', fileName), 'utf8');
    const parsed = parseNotice(fileName, text);
    assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
  }
});

test('G12 CLI end-to-end in offline mode', () => {
  const scriptPath = path.join(repoRoot, 'scripts', 'check-flag-impact.mjs');

  const failing = spawnSync(process.execPath, [
    scriptPath,
    '--base-manifest', path.join(fixturesDir, 'base-manifest.json'),
    '--head-manifest', path.join(fixturesDir, 'head-manifest-production-off.json'),
    '--changed-files', path.join(fixturesDir, 'changed-files-none.txt'),
  ], { encoding: 'utf8' });
  assert.equal(failing.status, 1, failing.stdout + failing.stderr);
  assert.match(failing.stderr, /capability-notice/);
  assert.match(failing.stderr, /notice_id:/);

  const passing = spawnSync(process.execPath, [
    scriptPath,
    '--base-manifest', path.join(fixturesDir, 'base-manifest.json'),
    '--head-manifest', path.join(fixturesDir, 'head-manifest-production-off.json'),
    '--changed-files', path.join(fixturesDir, 'changed-files-with-valid-notice.txt'),
    '--notices-dir', noticesDir,
  ], { encoding: 'utf8' });
  assert.equal(passing.status, 0, passing.stdout + passing.stderr);
  assert.match(passing.stdout, /GENERAL_CLINICAL_LLM_ENABLED/);

  const missingBase = spawnSync(process.execPath, [
    scriptPath,
    '--base-manifest', path.join(fixturesDir, 'does-not-exist.json'),
    '--head-manifest', path.join(fixturesDir, 'head-manifest-production-off.json'),
  ], { encoding: 'utf8' });
  assert.equal(missingBase.status, 2, missingBase.stdout + missingBase.stderr);
});

test('G13 PR template covers the required capability-impact checklist', () => {
  const templatePath = path.join(repoRoot, '.github', 'pull_request_template.md');
  const text = fs.readFileSync(templatePath, 'utf8');
  assert.match(text, /## Production capability impact/);
  assert.match(text, /flags:write/);
  assert.match(text, /docs\/deployment\/notices\//);
  assert.match(text, /- \[ \]/);
});

test('G14 live git inspection is bounded and excludes unrelated binary payloads', () => {
  const script = fs
    .readFileSync(path.join(repoRoot, 'scripts', 'check-flag-impact.mjs'), 'utf8')
    .replaceAll('\r\n', '\n');
  assert.ok(script.includes('const GIT_MAX_BUFFER_BYTES = 8 * 1024 * 1024;'));
  assert.ok(script.includes("const LIVE_DIFF_PATHSPEC = [\n  ...WATCHED_CONFIG_FILES,\n  '.github/workflows',\n];"));
  assert.ok(script.includes('maxBuffer: GIT_MAX_BUFFER_BYTES'));
  assert.ok(script.includes("'--no-ext-diff',\n    '--no-textconv',"));
  assert.ok(script.includes("'--',\n    ...LIVE_DIFF_PATHSPEC,"));
  assert.doesNotMatch(script, /runGit\(repoRoot, \['diff', '--binary', `\$\{base\}\.\.\.HEAD`\]\)/);
});
