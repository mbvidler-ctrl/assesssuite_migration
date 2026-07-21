import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { scanReleaseDiff } from '../../scripts/scan-release-diff.mjs';
import {
  REFERRAL_PROCESSING_ATTESTATION,
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
  resolveReferralOrganization,
} from '../../src/lib/referralWorkflow.js';
import { buildSoapHistoryPrintHtml, escapeHtmlText } from '../../src/lib/safeHtml.js';

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

test('T03b direct local production deployment is fail-closed in favour of the trusted workflow', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const command = manifest.scripts?.['deploy:prod'];
  assert.equal(typeof command, 'string');
  assert.match(command, /Direct production deployment is disabled/);
  assert.match(command, /production-deploy workflow/);
  assert.doesNotMatch(command, /\bfly\s+deploy\b/);
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'deploy:prod'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0, result.stdout + result.stderr);

  const launchRunbook = fs.readFileSync(
    path.join(repoRoot, 'docs', 'launch', '20260713-go-live-runbook.md'),
    'utf8',
  );
  assert.match(launchRunbook, /sealed workflow is the only place permitted to invoke `fly deploy/);
  assert.match(launchRunbook, /never run that command locally/);
  assert.match(launchRunbook, /Do not run `npm run deploy:prod`/);
});

test('T04 public-surface workflow checks explicitly propagate failures and require anonymous file 401', () => {
  for (const file of ['production-deploy.yml', 'production-rollback.yml']) {
    const source = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', file), 'utf8');
    assert.match(source, /read_public_surface\(\)[\s\S]*?node --input-type=module <<'NODE' \|\| return 1/);
    assert.match(source, /anonymous-file[\s\S]*?\[\[ "\$status" == '401' \]\] \|\| return 1/);
  }
  for (const file of ['production-prepare-release.yml', 'production-prepare-rollback-image.yml']) {
    const source = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', file), 'utf8');
    const marker = file === 'production-prepare-release.yml'
      ? '      - name: Secret and high-entropy diff scan'
      : '      - name: Secret scan and local image gate';
    const start = source.indexOf(marker);
    const end = source.indexOf('\n      - name:', start + marker.length);
    assert.notEqual(start, -1, `${file} scanner step is missing`);
    const scannerStep = source.slice(start, end === -1 ? undefined : end);
    assert.match(scannerStep, /env:[\s\S]*?EXPECTED_RELEASE_SCANNER_SHA256:\s*[0-9a-f]{64}[\s\S]*?run:/);
    assert.match(scannerStep, /sha256sum scripts\/scan-release-diff\.mjs/);
    assert.match(scannerStep, /\$EXPECTED_RELEASE_SCANNER_SHA256/);
    assert.match(scannerStep, /node scripts\/scan-release-diff\.mjs/);
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

  const runtimeReferences = [
    'diff --git a/server/tests/probe.mjs b/server/tests/probe.mjs',
    '+++ b/server/tests/probe.mjs',
    '+const request = { token: authenticatedUser.token };',
    '+const options = { API_KEY: configuredProviderCredential };',
  ].join('\n');
  assert.deepEqual(scanReleaseDiff(runtimeReferences), []);
});

test('T06 referral extraction is the sole visible extraction path and preserves its authority boundary', () => {
  const helper = fs.readFileSync(path.join(repoRoot, 'src', 'lib', 'fileIntegrations.js'), 'utf8');
  const referral = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'documents', 'ReferralUploader.jsx'), 'utf8');
  const clientDocuments = fs.readFileSync(path.join(repoRoot, 'src', 'components', 'client', 'ClientDocuments.jsx'), 'utf8');
  const nonReferralUploaders = [
    ['assessments', 'CBMRunner.jsx'],
    ['calendar', 'SOAPNoteModal.jsx'],
    ['client', 'AdverseEventForm.jsx'],
    ['client', 'ClientDocuments.jsx'],
  ].map((segments) => fs.readFileSync(path.join(repoRoot, 'src', 'components', ...segments), 'utf8'));
  const integrations = fs.readFileSync(path.join(repoRoot, 'server', 'integrations.mjs'), 'utf8');
  const uploadRegistry = fs.readFileSync(path.join(repoRoot, 'server', 'uploadRegistry.mjs'), 'utf8');
  assert.match(referral, /processing_authority_confirmed:\s*true/);
  assert.match(referral, /DOCUMENT_EXTRACTION_MAX_FILES/);
  assert.match(helper, /params\.file_urls\.length > DOCUMENT_EXTRACTION_MAX_FILES/);
  assert.match(referral, /subject_age_confirmation:\s*REFERRAL_SUBJECT_AGE_CONFIRMATION/);
  assert.match(referral, /subject_age_attestation_version:\s*REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION/);
  assert.doesNotMatch(referral, /subject_date_of_birth/);
  for (const source of nonReferralUploaders) {
    assert.doesNotMatch(source, /subject_date_of_birth/);
  }
  assert.match(integrations, /attestationVersion !== REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION/);
  assert.match(integrations, /subject_date_of_birth_rejected/);
  assert.match(uploadRegistry, /subject_age_attestation_source:\s*REFERRAL_SUBJECT_AGE_ATTESTATION_SOURCE/);
  assert.match(uploadRegistry, /subject_age_attestation_version:\s*subjectAgeAttestationVersion/);
  assert.match(uploadRegistry, /subject_age_band:\s*subjectAgeBand/);
  assert.match(
    referral,
    /organizationOptions\.length > 1 && \([\s\S]*?<Label htmlFor="referral-organization">Choose practice for this referral<\/Label>[\s\S]*?onValueChange=\{handleOrganizationChange\}/,
  );
  assert.doesNotMatch(referral, /Owning practice/);
  assert.match(referral, /Organization\.get\(membership\.org_id\)/);
  assert.match(referral, /name:\s*organization\?\.name \|\| membership\.org_id/);
  assert.doesNotMatch(referral, /id="referral-(?:date-of-birth|processing-authority)"/);
  assert.match(referral, /Extract Data from \{files\.length\} file\(s\)/);
  assert.match(referral, /aria-describedby="referral-extraction-attestation"/);
  assert.match(referral, /id="referral-extraction-attestation"/);
  assert.match(referral, /\{REFERRAL_PROCESSING_ATTESTATION\}/);
  assert.doesNotMatch(referral, /<HistoricalAssessmentExtractor/);
  assert.doesNotMatch(clientDocuments, /ClientDataExtractor|Scan for (?:Client )?Data|showExtractor/);
  assert.match(
    integrations,
    /referralUploadCount !== uploads\.length[\s\S]*?'generic_extraction_disabled'[\s\S]*?Automated extraction is approved only for the referral workflow\./,
  );
});

test('T07 referral workflow auto-resolves one practice but requires an explicit valid multi-practice choice', () => {
  const options = [
    { id: 'org-secondary', isPrimary: false },
    { id: 'org-primary', isPrimary: true },
  ];
  assert.equal(resolveReferralOrganization(options), '');
  assert.equal(resolveReferralOrganization(options, 'org-secondary'), 'org-secondary');
  assert.equal(resolveReferralOrganization(options, 'org-unknown'), '');
  assert.equal(resolveReferralOrganization([{ id: 'org-only', isPrimary: false }]), 'org-only');
  assert.equal(resolveReferralOrganization([
    { id: 'org-only', isPrimary: false },
    { id: 'org-only', isPrimary: true },
  ]), 'org-only');
  assert.equal(resolveReferralOrganization([{ id: '' }, null, {}]), '');
  assert.equal(resolveReferralOrganization([]), '');
  assert.equal(REFERRAL_SUBJECT_AGE_CONFIRMATION, '13_or_over');
  assert.equal(
    REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
    'referral-subject-age-attestation-v2026-07-21.1',
  );
  assert.match(REFERRAL_PROCESSING_ATTESTATION, /13 or older/);
  assert.match(REFERRAL_PROCESSING_ATTESTATION, /documented.*notice and consent.*valid authority/i);
});

function assertTwoPhaseImmutableDigestBinding(preparationSource, deploySource) {
  const publishStart = preparationSource.indexOf('      - name: Publish immutable image and seal compatibility bundle');
  const publishEnd = preparationSource.indexOf('\n      - name:', publishStart + 1);
  assert.notEqual(publishStart, -1);
  const publishStep = preparationSource.slice(publishStart, publishEnd === -1 ? undefined : publishEnd);
  assert.match(publishStep, /push_output="\$\(timeout[\s\S]*?docker push "\$new_image_tag" 2>&1\)"/);
  assert.match(
    publishStep,
    /candidate_registry_digest="\$\(printf '%s\\n' "\$push_output"[\s\S]*?digest: \(sha256:\[0-9a-f\]\{64\}\)/,
  );
  assert.match(publishStep, /candidate_image_ref="registry\.fly\.io\/\$app@\$candidate_registry_digest"/);
  assert.equal((publishStep.match(/docker push "\$new_image_tag"/g) || []).length, 1);
  assert.doesNotMatch(publishStep, /\bfly deploy\b/);

  const releaseStep = deploySource.slice(
    deploySource.indexOf('      - name: Final secret-bearing Fly release command and public verification'),
  );
  assert.notEqual(releaseStep.length, 0);
  assert.match(
    deploySource,
    /CANDIDATE_IMAGE_REF:\s*registry\.fly\.io\/assesssuite-production@\$\{\{ inputs\.application_image_digest \}\}/,
  );
  assert.match(releaseStep, /--image "\$candidate_image_ref"/);
  assert.match(releaseStep, /--remote-only/);
  assert.match(releaseStep, /--skip-release-command/);
  assert.doesNotMatch(releaseStep, /docker (?:build|push|run)|npm (?:ci|run)|actions\/checkout/);
  assert.match(
    deploySource,
    /artifact-ids:\s*\$\{\{ inputs\.deploy_bundle_artifact_id \}\}[\s\S]*?github-token:\s*\$\{\{ github\.token \}\}[\s\S]*?run-id:\s*\$\{\{ inputs\.preparation_run_id \}\}/,
  );
}

test('T08 application candidate carries no branch-sourced secret-bearing hotfix workflow', () => {
  assert.equal(
    fs.existsSync(path.join(repoRoot, '.github', 'workflows', 'production-referral-hotfix-one-shot.yml')),
    false,
  );
});

test('T09 SOAP history print output encodes persisted values and isolates the popup', () => {
  const hostile = `<script>alert('xss')<\/script>&\"`;
  const encoded = escapeHtmlText(hostile);
  assert.equal(encoded, '&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;&amp;&quot;');
  assert.doesNotMatch(encoded, /[<>]/);

  const printHtml = buildSoapHistoryPrintHtml({
    clientName: '<img src=x onerror=clientPayload()>',
    noteDate: '<svg onload=datePayload()>',
    history: [{
      action: '<script>actionPayload()</script>',
      userEmail: 'attacker@example.test"><iframe srcdoc=payload>',
      timestamp: '<details open ontoggle=timestampPayload()>',
    }],
  });
  for (const executable of ['<img', '<svg', '<script', '<iframe', '<details']) {
    assert.doesNotMatch(printHtml, new RegExp(executable, 'i'));
  }
  for (const encodedMarker of ['&lt;img', '&lt;svg', '&lt;script', '&lt;iframe', '&lt;details']) {
    assert.match(printHtml, new RegExp(encodedMarker, 'i'));
  }
  assert.match(printHtml, /default-src 'none'; style-src 'unsafe-inline'/);

  const source = fs.readFileSync(
    path.join(repoRoot, 'src', 'components', 'calendar', 'SOAPNoteModal.jsx'),
    'utf8',
  );
  const noteHistoryStart = source.indexOf('Note History');
  const historyPrint = source.slice(
    source.indexOf("const printWindow = window.open('', '_blank', 'width=800,height=600');", noteHistoryStart),
    source.indexOf('Print History', noteHistoryStart),
  );
  assert.match(historyPrint, /printWindow\.opener = null/);
  assert.match(historyPrint, /buildSoapHistoryPrintHtml\(\{/);
  assert.match(historyPrint, /clientName:\s*client\.full_name/);
  assert.match(historyPrint, /noteDate:\s*moment\(soapNote\.note_date\)\.format\('LL'\)/);
  assert.match(historyPrint, /action:\s*entry\.action/);
  assert.match(historyPrint, /userEmail:\s*entry\.user_email/);
  assert.match(historyPrint, /timestamp:\s*moment\(entry\.timestamp\)\.format\('LLL'\)/);
  assert.match(historyPrint, /renderSafeHtmlDocument\(printWindow, printHtml\)/);
  assert.doesNotMatch(historyPrint, /document\.write/);
});

test('T10 production publication and deployment are split at the immutable digest boundary', () => {
  const preparationSource = fs.readFileSync(
    path.join(repoRoot, '.github', 'workflows', 'production-prepare-release.yml'),
    'utf8',
  );
  const deploySource = fs.readFileSync(
    path.join(repoRoot, '.github', 'workflows', 'production-deploy.yml'),
    'utf8',
  );
  assertTwoPhaseImmutableDigestBinding(preparationSource, deploySource);
});

test('T11 every production mutation workflow pins the established 3 GB Sydney volume', () => {
  for (const file of [
    'production-deploy.yml',
    'production-rollback.yml',
  ]) {
    const source = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', file), 'utf8');
    assert.match(
      source,
      /volume\.size_gb !== 3/,
      `${file} must pin the established 3 GB volume`,
    );
    assert.match(source, /volume\.name !== 'assesssuite_data'/);
    assert.match(source, /volume\.region !== 'syd'/);
    assert.doesNotMatch(source, /one 1 GB assesssuite_data volume in syd/);
  }
});
