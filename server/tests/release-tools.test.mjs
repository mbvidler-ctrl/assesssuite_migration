import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { scanReleaseDiff } from '../../scripts/scan-release-diff.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const comparator = path.join(repoRoot, 'scripts', 'compare-typecheck-baseline.mjs');
const secretPreflight = path.join(repoRoot, 'scripts', 'check-production-secrets.mjs');

function runComparator(baseText, candidateText) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-typecheck-gate-'));
  try {
    const base = path.join(root, 'base.log');
    const candidate = path.join(root, 'candidate.log');
    fs.writeFileSync(base, baseText);
    fs.writeFileSync(candidate, candidateText);
    return spawnSync(process.execPath, [comparator, '--base', base, '--candidate', candidate], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('T01 typecheck comparator counts global diagnostics and rejects newly introduced fatal errors', () => {
  const base = 'src/probe.js(1,1): error TS1234: reviewed baseline\n';
  const result = runComparator(base, `${base}error TS18003: No inputs were found in config file.\n`);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /<global>\|TS18003/);
});

test('T02 typecheck comparator rejects empty file-mode candidate evidence', () => {
  const result = runComparator('src/probe.js(1,1): error TS1234: reviewed baseline\n', '');
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /Candidate typecheck evidence file is empty/);
});

test('T03 production secret preflight is sealed to the exact production app before invoking flyctl', () => {
  const result = spawnSync(process.execPath, [secretPreflight, 'different-app'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /sealed to assesssuite-production/);
  const source = fs.readFileSync(secretPreflight, 'utf8');
  assert.match(source, /LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS/);
  assert.match(source, /OPENAI_DOCUMENT_EXTRACTION_MODEL/);
});

test('T04 public-surface workflow checks explicitly propagate failures and require anonymous file 401', () => {
  for (const file of ['production-deploy.yml', 'production-rollback.yml']) {
    const source = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', file), 'utf8');
    assert.match(source, /read_public_surface\(\)[\s\S]*?node --input-type=module <<'NODE' \|\| return 1/);
    assert.match(source, /anonymous-file[\s\S]*?\[\[ "\$status" == '401' \]\] \|\| return 1/);
  }
  for (const file of ['production-deploy.yml', 'production-prepare-rollback-image.yml']) {
    const source = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', file), 'utf8');
    assert.match(source, /EXPECTED_RELEASE_SCANNER_SHA256:\s*[0-9a-f]{64}/);
    assert.match(source, /actual_scanner_sha256=.*sha256sum scripts\/scan-release-diff\.mjs/);
    assert.match(source, /node scripts\/scan-release-diff\.mjs/);
  }
});

test('T05 release scanner accepts the exact reviewed diff and rejects constructed secret material', () => {
  const exact = spawnSync('git', ['diff', '--binary', 'd593a7f2e83657125d5be4acb49642a38215d5bd...HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  assert.equal(exact.status, 0, exact.stderr);
  assert.deepEqual(scanReleaseDiff(exact.stdout), []);

  const providerKey = ['sk_', 'live_', 'AbCdEf0123456789AbCdEf'].join('');
  const githubToken = ['gh', 'p_', 'AbCdEf0123456789AbCdEf012345'].join('');
  const unquotedCredential = ['AbCdEf01', '23456789', 'GhIjKlMn', 'OpQrStUv'].join('');
  const fakeDiff = [
    'diff --git a/src/probe.js b/src/probe.js',
    '+++ b/src/probe.js',
    `+const credential = "${providerKey}";`,
    `+const sourceControlCredential = "${githubToken}";`,
    `+INTERNAL_API_KEY=${unquotedCredential}`,
  ].join('\n');
  assert.ok(scanReleaseDiff(fakeDiff).some((finding) => finding.kind === 'provider-secret-format'));
  assert.equal(scanReleaseDiff(fakeDiff).filter((finding) => finding.kind === 'provider-secret-format').length, 2);
  assert.ok(scanReleaseDiff(fakeDiff).some((finding) => finding.kind === 'literal-sensitive-assignment'));
});

test('T06 UI extraction callers preserve authority, file bounds, DOB gate, and explicit organisation persistence', () => {
  const helper = fs.readFileSync(path.join(repoRoot, 'src', 'lib', 'fileIntegrations.js'), 'utf8');
  const referral = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'documents', 'ReferralUploader.jsx'), 'utf8');
  const client = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'documents', 'ClientDataExtractor.jsx'), 'utf8');
  const historical = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'documents', 'HistoricalAssessmentExtractor.jsx'), 'utf8');
  for (const source of [referral, client, historical]) {
    assert.match(source, /processing_authority_confirmed:\s*true/);
    assert.match(source, /DOCUMENT_EXTRACTION_MAX_FILES/);
  }
  assert.match(helper, /params\.file_urls\.length > DOCUMENT_EXTRACTION_MAX_FILES/);
  assert.match(referral, /subject_date_of_birth:\s*subjectDateOfBirth/);
  assert.match(historical, /ClientAssessment\.create\(\{[\s\S]*?org_id:\s*orgId,[\s\S]*?client_id:\s*clientId/);
});
