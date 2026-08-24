import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  PHYSIO_SENTRY_PHASE_CONTRACT,
  extractSentryProviderRequestIdHashes,
  validatePhysioSentryPhasePacket,
  validatePhysioSentryPhaseReceipt,
  validatePhysioSentryReconciliationPacket,
  validatePhysioSentryReleasePacket,
  validatePhysioSentrySafeOrphanReadback,
} from '../../scripts/physio-sentry-release-contract.mjs';
import { readPhysioSentryDeployCapability } from '../../scripts/physio-deploy-admission.mjs';

const applicationSha = 'a'.repeat(40);
const sourceMapManifestSha256 = 'b'.repeat(64);
const sourceMapArchiveSha256 = 'c'.repeat(64);
const capabilityIntentId = 'CAP-20260821-ASSESSSUITE-PHYSIO-MVP:sentry-release';
const authorityReference = 'UM-AUTO-20260821-ASSESSSUITE-PHYSIO-MVP-LIVE';
const providerEffectId = `sha256:${'d'.repeat(64)}`;
const artifactDigest = `sha256:${'e'.repeat(64)}`;

function canonical(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writePacket(root, files) {
  for (const [name, bytes] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), bytes);
  }
  const walk = (directory, prefix = '') => fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (relative === 'SHA256SUMS') return [];
      return entry.isDirectory() ? walk(path.join(directory, entry.name), relative) : [relative];
    });
  const names = walk(root).sort();
  const sums = names.map((name) => `${hash(fs.readFileSync(path.join(root, ...name.split('/'))))}  ${name}\n`).join('');
  fs.writeFileSync(path.join(root, 'SHA256SUMS'), sums);
}

function request(operation, httpStatus) {
  return {
    operation,
    http_status: httpStatus,
    request_id_count: 1,
    request_id_header_names: ['x-request-id'],
    request_id_sha256: [hash(`${operation}-request-id`)],
  };
}

function phase(overrides = {}) {
  return {
    contract_version: PHYSIO_SENTRY_PHASE_CONTRACT,
    result: 'STARTED',
    phase: 'INTENT_STARTED',
    phase_sequence: 0,
    generation: 0,
    application: 'assesssuite-physio-production',
    application_sha: applicationSha,
    profession_id: 'physio',
    sentry_org: 'unimatter',
    sentry_project: 'assesssuite-production',
    sentry_project_id: '4511827129663488',
    sentry_environment: 'physio-production',
    release_version: `physio-production@${applicationSha}`,
    provider_effect_id: providerEffectId,
    source_map_manifest_sha256: sourceMapManifestSha256,
    source_map_archive_sha256: sourceMapArchiveSha256,
    candidate_core_receipt_sha256: 'f'.repeat(64),
    capability_intent_id: capabilityIntentId,
    authority_reference: authorityReference,
    previous_phase_artifact_id: '0',
    previous_phase_artifact_digest: '0',
    previous_phase_receipt_sha256: 'sha256:na',
    previous_phase: 'NONE',
    reconciliation_artifact_id: '0',
    reconciliation_artifact_digest: '0',
    reconciliation_receipt_sha256: 'sha256:na',
    reconciliation_result: 'NOT_APPLICABLE',
    started_at: '2026-08-22T00:00:00.000Z',
    ...overrides,
  };
}

function reconciliation(previous, overrides = {}) {
  return {
    contract_version: 'assesssuite-physio-sentry-release-reconciliation/2.0.0',
    result: 'SAFE_ORPHAN',
    application: 'assesssuite-physio-production',
    application_sha: applicationSha,
    profession_id: 'physio',
    sentry_org: 'unimatter',
    sentry_project: 'assesssuite-production',
    sentry_project_id: '4511827129663488',
    sentry_environment: 'physio-production',
    release_version: `physio-production@${applicationSha}`,
    provider_effect_id: providerEffectId,
    phase: previous.phase,
    generation: previous.generation,
    phase_sequence: previous.phase_sequence,
    phase_artifact_id: '123',
    phase_artifact_digest: artifactDigest,
    phase_receipt_sha256: '1'.repeat(64),
    release_http_status: 200,
    delete_http_status: null,
    absence_http_status: null,
    release_readback_sha256: '4'.repeat(64),
    deploy_readback_sha256: '5'.repeat(64),
    provider_request_id_hashes_sha256: '6'.repeat(64),
    completed_at: '2026-08-22T00:00:01.000Z',
    ...overrides,
  };
}

const options = {
  applicationSha,
  capabilityIntentId,
  authorityReference,
  sourceMapManifestSha256,
  sourceMapArchiveSha256,
};

test('Sentry phase receipt requires an exact immutable chain before every mutating phase', () => {
  assert.equal(validatePhysioSentryPhaseReceipt(phase(), options), true);
  const mutating = phase({
    phase: 'COMPENSATION_STARTED',
    phase_sequence: 1,
    previous_phase: 'INTENT_STARTED',
    reconciliation_result: 'SAFE_ORPHAN',
    previous_phase_artifact_id: '123',
    previous_phase_artifact_digest: artifactDigest,
    previous_phase_receipt_sha256: '1'.repeat(64),
    reconciliation_artifact_id: '124',
    reconciliation_artifact_digest: `sha256:${'2'.repeat(64)}`,
    reconciliation_receipt_sha256: '3'.repeat(64),
  });
  const prior = phase();
  const recon = reconciliation(prior);
  assert.equal(validatePhysioSentryPhaseReceipt(mutating, {
    ...options,
    previousPhaseReceipt: prior,
    reconciliationReceipt: recon,
  }), true);
  assert.throws(() => validatePhysioSentryPhaseReceipt({
    ...mutating,
    reconciliation_artifact_id: '0',
    reconciliation_artifact_digest: '0',
    reconciliation_receipt_sha256: 'sha256:na',
  }, { ...options, previousPhaseReceipt: prior, reconciliationReceipt: recon }), /reconciliation|chained/i);
  assert.throws(() => validatePhysioSentryPhaseReceipt({
    ...mutating,
    phase_sequence: 2,
  }, { ...options, previousPhaseReceipt: prior, reconciliationReceipt: recon }), /transition|predecessor/i);
  assert.throws(() => validatePhysioSentryPhaseReceipt({
    ...mutating,
    generation: 1,
  }, { ...options, previousPhaseReceipt: prior, reconciliationReceipt: recon }), /compensation start/i);
  assert.throws(() => validatePhysioSentryPhaseReceipt({
    ...mutating,
    phase: 'COMPENSATION_COMPLETED',
    result: 'COMPLETED',
  }, { ...options, previousPhaseReceipt: prior, reconciliationReceipt: recon }), /not permitted|transition/i);
});

test('Sentry phase packet is flat, checksum-bound and link-safe', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-phase-'));
  const linked = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-phase-link-'));
  try {
    const bytes = `${JSON.stringify(phase(), null, 2)}\n`;
    const digest = createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(path.join(root, 'sentry-phase.json'), bytes);
    fs.writeFileSync(path.join(root, 'SHA256SUMS'), `${digest}  sentry-phase.json\n`);
    assert.equal(validatePhysioSentryPhasePacket(root, options), true);

    fs.symlinkSync(path.join(root, 'sentry-phase.json'), path.join(linked, 'sentry-phase.json'));
    fs.writeFileSync(path.join(linked, 'SHA256SUMS'), `${digest}  sentry-phase.json\n`);
    assert.throws(() => validatePhysioSentryPhasePacket(linked, options), /invalid|link/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(linked, { recursive: true, force: true });
  }
});

test('noninitial Sentry phase packet carries and recursively validates the complete immutable chain', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-phase-chain-'));
  try {
    const initial = phase();
    const initialBytes = canonical(initial);
    const safeRecon = reconciliation(initial, {
      phase_artifact_id: '123',
      phase_receipt_sha256: hash(initialBytes),
    });
    const safeReconBytes = canonical(safeRecon);
    const compensationStarted = phase({
      phase: 'COMPENSATION_STARTED',
      phase_sequence: 1,
      previous_phase: 'INTENT_STARTED',
      reconciliation_result: 'SAFE_ORPHAN',
      previous_phase_artifact_id: '123',
      previous_phase_artifact_digest: artifactDigest,
      previous_phase_receipt_sha256: hash(initialBytes),
      reconciliation_artifact_id: '124',
      reconciliation_artifact_digest: `sha256:${'2'.repeat(64)}`,
      reconciliation_receipt_sha256: hash(safeReconBytes),
      started_at: '2026-08-22T00:00:02.000Z',
    });
    const compensationStartedBytes = canonical(compensationStarted);
    const deleteRecon = reconciliation(compensationStarted, {
      result: 'DELETE_COMPLETED_ABSENT',
      phase_artifact_id: '125',
      phase_artifact_digest: `sha256:${'7'.repeat(64)}`,
      phase_receipt_sha256: hash(compensationStartedBytes),
      release_http_status: 200,
      delete_http_status: 204,
      absence_http_status: 404,
      completed_at: '2026-08-22T00:00:03.000Z',
    });
    const deleteReconBytes = canonical(deleteRecon);
    const compensationCompleted = phase({
      result: 'COMPLETED',
      phase: 'COMPENSATION_COMPLETED',
      phase_sequence: 2,
      previous_phase: 'COMPENSATION_STARTED',
      reconciliation_result: 'DELETE_COMPLETED_ABSENT',
      previous_phase_artifact_id: '125',
      previous_phase_artifact_digest: `sha256:${'7'.repeat(64)}`,
      previous_phase_receipt_sha256: hash(compensationStartedBytes),
      reconciliation_artifact_id: '126',
      reconciliation_artifact_digest: `sha256:${'8'.repeat(64)}`,
      reconciliation_receipt_sha256: hash(deleteReconBytes),
      started_at: '2026-08-22T00:00:04.000Z',
    });
    const compensationCompletedBytes = canonical(compensationCompleted);
    const createStarted = phase({
      phase: 'CREATE_UPLOAD_FINALIZE_STARTED',
      phase_sequence: 3,
      generation: 1,
      previous_phase: 'COMPENSATION_COMPLETED',
      reconciliation_result: 'DELETE_COMPLETED_ABSENT',
      previous_phase_artifact_id: '127',
      previous_phase_artifact_digest: `sha256:${'9'.repeat(64)}`,
      previous_phase_receipt_sha256: hash(compensationCompletedBytes),
      reconciliation_artifact_id: '126',
      reconciliation_artifact_digest: `sha256:${'8'.repeat(64)}`,
      reconciliation_receipt_sha256: hash(deleteReconBytes),
      started_at: '2026-08-22T00:00:05.000Z',
    });
    const files = {
      'phase-0000.json': initialBytes,
      'phase-0001.json': compensationStartedBytes,
      'phase-0002.json': compensationCompletedBytes,
      'reconciliation-0001.json': safeReconBytes,
      'reconciliation-0002.json': deleteReconBytes,
      'reconciliation-0003.json': deleteReconBytes,
      'sentry-phase.json': canonical(createStarted),
    };
    writePacket(root, files);
    assert.equal(validatePhysioSentryPhasePacket(root, options), true);

    const skipped = { ...files, 'sentry-phase.json': canonical({ ...createStarted, phase_sequence: 4 }) };
    const skippedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-phase-skipped-'));
    try {
      for (const name of fs.readdirSync(skippedRoot)) fs.rmSync(path.join(skippedRoot, name));
      writePacket(skippedRoot, skipped);
      assert.throws(() => validatePhysioSentryPhasePacket(skippedRoot, options), /file set|sequence/i);
    } finally {
      fs.rmSync(skippedRoot, { recursive: true, force: true });
    }

    const staleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-phase-stale-'));
    try {
      writePacket(staleRoot, { ...files,
        'sentry-phase.json': canonical({ ...createStarted, previous_phase_receipt_sha256: '0'.repeat(64) }),
      });
      assert.throws(() => validatePhysioSentryPhasePacket(staleRoot, options), /byte binding/i);
    } finally {
      fs.rmSync(staleRoot, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('provider proof hashes parsed request identifiers and rejects whole-header substitutes', () => {
  const headers = Buffer.from([
    'HTTP/2 204',
    'date: Sat, 22 Aug 2026 01:02:03 GMT',
    'cf-ray: 1234567890abcdef-SYD',
    'x-request-id: request-123',
    '',
    '',
  ].join('\r\n'));
  const proof = extractSentryProviderRequestIdHashes(headers, { label: 'delete' });
  assert.equal(proof.http_status, 204);
  assert.deepEqual(proof.request_id_header_names, ['cf-ray', 'x-request-id']);
  assert.equal(proof.request_id_count, 2);
  assert.equal(proof.request_id_sha256.length, 2);
  assert.ok(proof.request_id_sha256.every((value) => /^[0-9a-f]{64}$/.test(value)));
  assert.ok(!proof.request_id_sha256.includes(createHash('sha256').update(headers).digest('hex')));
  assert.throws(() => extractSentryProviderRequestIdHashes('HTTP/2 200\r\ndate: now\r\n\r\n'),
    /no provider-derived request identifier/i);
  assert.throws(() => extractSentryProviderRequestIdHashes(
    'HTTP/1.1 301 Moved\r\ncf-ray: one\r\n\r\nHTTP/2 200\r\ncf-ray: two\r\n\r\n',
  ), /ambiguous response chain/i);
});

test('provider proof accepts Sentry guaranteed rate-limit response headers', () => {
  const headers = Buffer.from([
    'HTTP/2 200',
    'x-sentry-rate-limit-limit: 40',
    'x-sentry-rate-limit-remaining: 39',
    'x-sentry-rate-limit-reset: 1787579240',
    'x-sentry-rate-limit-concurrentlimit: 25',
    'x-sentry-rate-limit-concurrentremaining: 24',
    '',
    '',
  ].join('\r\n'));
  const proof = extractSentryProviderRequestIdHashes(headers, { label: 'organization' });
  assert.equal(proof.http_status, 200);
  assert.deepEqual(proof.request_id_header_names, [
    'x-sentry-rate-limit-concurrentlimit',
    'x-sentry-rate-limit-concurrentremaining',
    'x-sentry-rate-limit-limit',
    'x-sentry-rate-limit-remaining',
    'x-sentry-rate-limit-reset',
  ]);
  assert.equal(proof.request_id_count, 5);
  assert.ok(proof.request_id_sha256.every((value) => /^[0-9a-f]{64}$/u.test(value)));
  assert.throws(() => extractSentryProviderRequestIdHashes(
    'HTTP/2 200\r\nx-sentry-rate-limit-limit: synthetic\r\n\r\n',
  ), /no provider-derived request identifier|complete Sentry rate-limit evidence/i);
  assert.throws(() => extractSentryProviderRequestIdHashes(
    'HTTP/2 200\r\nx-sentry-rate-limit-limit: 40\r\nx-sentry-rate-limit-remaining: 39\r\n\r\n',
  ), /complete Sentry rate-limit evidence/i);
});

test('reconciliation packet joins exact target readback, exhaustive pages and result-specific HTTP receipts', () => {
  const buildPacket = (root, proof) => {
    const release = canonical({
      organization: { slug: 'unimatter', region_url: 'https://us.sentry.io' },
      project: { id: '4511827129663488', slug: 'assesssuite-production',
        organization_slug: 'unimatter', region_url: 'https://us.sentry.io' },
      release: {
        version: `physio-production@${applicationSha}`,
        status: 'open',
        deployCount: 0,
        lastDeploy: null,
        firstEvent: null,
        lastEvent: null,
        projects: [{ id: '4511827129663488', slug: 'assesssuite-production' }],
      },
    });
    const deploy = canonical({ pages: [{ items: [], next_cursor: null, results: false }] });
    const proofBytes = canonical({ requests: proof });
    const receipt = canonical(reconciliation(phase(), {
      release_readback_sha256: hash(release),
      deploy_readback_sha256: hash(deploy),
      provider_request_id_hashes_sha256: hash(proofBytes),
    }));
    writePacket(root, {
      'provider-deploy-readback.json': deploy,
      'provider-release-readback.json': release,
      'provider-request-id-hashes.json': proofBytes,
      'sentry-reconciliation.json': receipt,
    });
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-reconciliation-'));
  const invalidRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-reconciliation-invalid-'));
  try {
    const exactProof = [
      request('organization', 200),
      request('project', 200),
      request('release', 200),
      request('deploy-page-0', 200),
    ];
    buildPacket(root, exactProof);
    const reconciliationOptions = {
      applicationSha,
      providerEffectId,
      phaseArtifactId: '123',
      phaseArtifactDigest: artifactDigest,
      phaseReceiptSha256: '1'.repeat(64),
    };
    assert.equal(validatePhysioSentryReconciliationPacket(root, reconciliationOptions), true);
    buildPacket(invalidRoot, exactProof.filter((row) => row.operation !== 'deploy-page-0'));
    assert.throws(() => validatePhysioSentryReconciliationPacket(invalidRoot, reconciliationOptions),
      /operation|status/i);

    const directGlobalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-reconciliation-global-'));
    try {
      buildPacket(directGlobalRoot, [
        request('organization-global', 200),
        request('project', 200),
        request('release', 200),
        request('deploy-page-0', 200),
      ]);
      assert.equal(validatePhysioSentryReconciliationPacket(directGlobalRoot, reconciliationOptions), true);
    } finally {
      fs.rmSync(directGlobalRoot, { recursive: true, force: true });
    }

    const redirectedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-reconciliation-redirect-'));
    try {
      buildPacket(redirectedRoot, [
        request('organization-global', 301),
        request('organization-region', 200),
        request('project', 200),
        request('release', 200),
        request('deploy-page-0', 200),
      ]);
      assert.equal(validatePhysioSentryReconciliationPacket(redirectedRoot, reconciliationOptions), true);

      const incompleteRedirectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'physio-sentry-reconciliation-redirect-invalid-'),
      );
      try {
        buildPacket(incompleteRedirectRoot, [
          request('organization-global', 301),
          request('project', 200),
          request('release', 200),
          request('deploy-page-0', 200),
        ]);
        assert.throws(() => validatePhysioSentryReconciliationPacket(
          incompleteRedirectRoot, reconciliationOptions,
        ), /organization redirect|operation|status/i);
      } finally {
        fs.rmSync(incompleteRedirectRoot, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(redirectedRoot, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(invalidRoot, { recursive: true, force: true });
  }
});

test('DELETE_COMPLETED_ABSENT requires exact predelete, every deploy page, DELETE 204 and absence 404', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-delete-reconciliation-'));
  const invalidRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-delete-reconciliation-invalid-'));
  const build = (packetRoot, deleteStatus) => {
    const release = canonical({
      organization: { slug: 'unimatter', region_url: 'https://us.sentry.io' },
      project: { id: '4511827129663488', slug: 'assesssuite-production',
        organization_slug: 'unimatter', region_url: 'https://us.sentry.io' },
      release: { version: `physio-production@${applicationSha}`, status: 'open', deployCount: 0,
        lastDeploy: null, firstEvent: null, lastEvent: null,
        projects: [{ id: '4511827129663488', slug: 'assesssuite-production' }] },
    });
    const deploy = canonical({ pages: [{ items: [], next_cursor: null, results: false }] });
    const proof = canonical({ requests: [
      request('organization', 200), request('project', 200), request('predelete', 200),
      request('deploy-page-0', 200), request('delete', deleteStatus), request('absence', 404),
    ] });
    const compensation = phase({ phase: 'COMPENSATION_STARTED', phase_sequence: 1 });
    const receipt = canonical(reconciliation(compensation, {
      result: 'DELETE_COMPLETED_ABSENT',
      release_http_status: 200,
      delete_http_status: 204,
      absence_http_status: 404,
      release_readback_sha256: hash(release),
      deploy_readback_sha256: hash(deploy),
      provider_request_id_hashes_sha256: hash(proof),
    }));
    writePacket(packetRoot, {
      'provider-deploy-readback.json': deploy,
      'provider-release-readback.json': release,
      'provider-request-id-hashes.json': proof,
      'sentry-reconciliation.json': receipt,
    });
  };
  try {
    const reconciliationOptions = {
      applicationSha,
      providerEffectId,
      phaseArtifactId: '123',
      phaseArtifactDigest: artifactDigest,
      phaseReceiptSha256: '1'.repeat(64),
    };
    build(root, 204);
    assert.equal(validatePhysioSentryReconciliationPacket(root, reconciliationOptions), true);
    build(invalidRoot, 200);
    assert.throws(() => validatePhysioSentryReconciliationPacket(invalidRoot, reconciliationOptions),
      /operation|status/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(invalidRoot, { recursive: true, force: true });
  }
});

test('completed v2 Sentry packet binds the frozen manifest, full phase chain and exact provider bytes', () => {
  const buildFinalPacket = (root, {
    omitOperation = '', providerRuntimeSha = '', withCurrentReadiness = false,
    organizationOperation = 'organization',
  } = {}) => {
    const releaseVersion = `physio-production@${applicationSha}`;
    const manifest = canonical({
      contract_version: 'assesssuite-physio-sentry-source-map-manifest/1.0.0',
      application: 'assesssuite-physio-production', application_sha: applicationSha,
      profession_id: 'physio', release_version: releaseVersion,
      sentry_environment: 'physio-production', build_timestamp: '2026-08-22T00:01:01.000Z',
      runtime_js: [{ path: 'assets/app.js', bytes: 10, sha256: '5'.repeat(64) }],
      source_maps: [{ path: 'assets/app.js.map', runtime_path: 'assets/app.js', bytes: 20,
        sha256: '7'.repeat(64) }],
    });
    const frozenManifestSha256 = hash(manifest);
    const localProviderEffectId = `sha256:${hash(JSON.stringify({
      application_sha: applicationSha,
      release_version: releaseVersion,
      source_map_manifest_sha256: frozenManifestSha256,
      source_map_archive_sha256: sourceMapArchiveSha256,
      capability_intent_id: capabilityIntentId,
      authority_reference: authorityReference,
    }))}`;
    const initial = phase({
      provider_effect_id: localProviderEffectId,
      source_map_manifest_sha256: frozenManifestSha256,
    });
    const initialBytes = canonical(initial);
    const absentRecon = reconciliation(initial, {
      result: 'EXACT_ABSENCE',
      provider_effect_id: localProviderEffectId,
      phase_artifact_id: '201',
      phase_receipt_sha256: hash(initialBytes),
      release_http_status: 404,
      delete_http_status: null,
      absence_http_status: 404,
    });
    const absentReconBytes = canonical(absentRecon);
    const started = phase({
      provider_effect_id: localProviderEffectId,
      source_map_manifest_sha256: frozenManifestSha256,
      phase: 'CREATE_UPLOAD_FINALIZE_STARTED',
      phase_sequence: 1,
      generation: 1,
      previous_phase: 'INTENT_STARTED',
      reconciliation_result: 'EXACT_ABSENCE',
      previous_phase_artifact_id: '201',
      previous_phase_artifact_digest: artifactDigest,
      previous_phase_receipt_sha256: hash(initialBytes),
      reconciliation_artifact_id: '202',
      reconciliation_artifact_digest: `sha256:${'2'.repeat(64)}`,
      reconciliation_receipt_sha256: hash(absentReconBytes),
      started_at: '2026-08-22T00:01:00.000Z',
    });
    const startedBytes = canonical(started);
    const startedSha = hash(startedBytes);
    const startedArtifactDigest = `sha256:${'3'.repeat(64)}`;
    const providerReadback = canonical({
      organization: { slug: 'unimatter', region_url: 'https://us.sentry.io' },
      project: { id: '4511827129663488', slug: 'assesssuite-production',
        organization_slug: 'unimatter', region_url: 'https://us.sentry.io' },
      release: { version: releaseVersion, status: 'open', date_released: '2026-08-22T00:01:01.000Z',
        deploy_count: 0, last_deploy: null, first_event: null, last_event: null,
        projects: [{ id: '4511827129663488', slug: 'assesssuite-production' }] },
      deploy_pages: [{ items: [], next_cursor: null, results: false }],
      file_pages: [{ item_count: 2, next_cursor: null, results: false }],
      source_map_files: [
        { provider_file_id_sha256: '4'.repeat(64), name: '~/assets/app.js', bytes: 10,
          sha256: providerRuntimeSha || '5'.repeat(64) },
        { provider_file_id_sha256: '6'.repeat(64), name: '~/assets/app.js.map', bytes: 20,
          sha256: '7'.repeat(64) },
      ],
    });
    const operations = [
      request(organizationOperation, 200), request('project', 200), request('precreate', 404),
      request('create', 201), request('upload-0', 201), request('upload-1', 201),
      request('finalize', 200), request('final', 200), request('deploy-page-0', 200),
      request('files-page-0', 200), request('download-0', 200), request('download-1', 200),
    ].filter((row) => row.operation !== omitOperation);
    const requestProof = canonical({
      phase_artifact_id: '300',
      phase_artifact_digest: startedArtifactDigest,
      phase_receipt_sha256: startedSha,
      requests: operations,
    });
    const effect = canonical({
      contract_version: 'assesssuite-physio-sentry-release-effect/2.0.0',
      result: 'COMPLETED',
      application: 'assesssuite-physio-production', application_sha: applicationSha,
      profession_id: 'physio', sentry_org: 'unimatter', sentry_project: 'assesssuite-production',
      sentry_project_id: '4511827129663488', sentry_environment: 'physio-production',
      release_version: releaseVersion, provider_effect_id: localProviderEffectId,
      generation: 1, phase_sequence: 1, build_timestamp: '2026-08-22T00:01:01.000Z',
      started_effect_artifact_id: '300',
      started_effect_artifact_digest: startedArtifactDigest, started_effect_receipt_sha256: startedSha,
      prestate_http_status: 404, mutation_started: true, release_new_exit_code: 0,
      source_map_upload_exit_code: 0, release_finalize_exit_code: 0,
      source_map_manifest_sha256: frozenManifestSha256,
      source_map_archive_sha256: sourceMapArchiveSha256,
      provider_release_readback_sha256: hash(providerReadback),
      provider_request_id_hashes_sha256: hash(requestProof),
      completed_at: '2026-08-22T00:01:02.000Z',
    });
    const receipt = canonical({
      contract_version: 'assesssuite-physio-sentry-release/1.0.0', result: 'PASS',
      application: 'assesssuite-physio-production', application_sha: applicationSha,
      profession_id: 'physio', sentry_org: 'unimatter', sentry_project: 'assesssuite-production',
      sentry_project_id: '4511827129663488', sentry_environment: 'physio-production',
      release_version: releaseVersion, source_map_manifest_sha256: frozenManifestSha256,
      source_map_archive_sha256: sourceMapArchiveSha256, source_map_runtime_count: 1,
      source_map_count: 1, source_maps_uploaded: true, release_finalized: true,
      source_map_upload_stdout_sha256: '8'.repeat(64), source_map_upload_stderr_sha256: '9'.repeat(64),
      provider_release_readback_sha256: hash(providerReadback), credential_scope: ['SENTRY_AUTH_TOKEN'],
      provider_request_id_hashes_sha256: hash(requestProof), started_effect_artifact_id: '300',
      started_effect_artifact_digest: startedArtifactDigest, started_effect_receipt_sha256: startedSha,
      effect_reconciliation_receipt_sha256: hash(effect), fly_credential_absent: true,
      sentry_dsn_absent: true, completed_at: '2026-08-22T00:01:03.000Z',
    });
    const phaseRoot = path.join(root, 'sentry-phase-packet');
    fs.mkdirSync(phaseRoot, { recursive: true });
    writePacket(phaseRoot, {
      'phase-0000.json': initialBytes,
      'reconciliation-0001.json': absentReconBytes,
      'sentry-phase.json': startedBytes,
    });
    const finalFiles = {
      'physio-sentry-release.json': receipt,
      'provider-release-readback.json': providerReadback,
      'provider-request-id-hashes.json': requestProof,
      'sentry-release-effect-reconciliation.json': effect,
      'sentry-source-map-manifest.json': manifest,
      'sentry-started-effect.json': startedBytes,
    };
    if (withCurrentReadiness) {
      const currentRequestProof = canonical({
        release_receipt_sha256: hash(receipt),
        requests: [
          request(organizationOperation, 200), request('project', 200), request('release', 200),
          request('deploy-page-0', 200), request('files-page-0', 200),
          request('download-0', 200), request('download-1', 200),
        ],
      });
      const currentReceipt = canonical({
        contract_version: 'assesssuite-physio-sentry-current-readiness/1.0.0', result: 'PASS',
        application: 'assesssuite-physio-production', application_sha: applicationSha,
        profession_id: 'physio', sentry_org: 'unimatter', sentry_project: 'assesssuite-production',
        sentry_project_id: '4511827129663488', sentry_environment: 'physio-production',
        release_version: releaseVersion, source_map_manifest_sha256: frozenManifestSha256,
        release_receipt_sha256: hash(receipt), provider_readback_sha256: hash(providerReadback),
        provider_request_id_hashes_sha256: hash(currentRequestProof),
        completed_at: '2026-08-22T00:02:00.000Z',
      });
      finalFiles['provider-current-readiness-readback.json'] = providerReadback;
      finalFiles['provider-current-readiness-request-id-hashes.json'] = currentRequestProof;
      finalFiles['sentry-current-readiness.json'] = currentReceipt;
    }
    writePacket(root, finalFiles);
    return frozenManifestSha256;
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-final-v2-'));
  const invalidRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-final-v2-invalid-'));
  const mismatchedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-final-v2-mismatch-'));
  const readinessRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-final-v2-readiness-'));
  const directGlobalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-final-v2-global-'));
  try {
    const frozenManifestSha256 = buildFinalPacket(root);
    const finalOptions = { ...options, sourceMapManifestSha256: frozenManifestSha256 };
    assert.equal(validatePhysioSentryReleasePacket(root, finalOptions), true);
    assert.deepEqual(readPhysioSentryDeployCapability(root), {
      capabilityIntentId,
      authorityReference,
    }, 'deploy admission derives Sentry child identity from the recursively validated terminal phase');
    buildFinalPacket(invalidRoot, { omitOperation: 'download-1' });
    assert.throws(() => validatePhysioSentryReleasePacket(invalidRoot, finalOptions), /operation|status/i);
    buildFinalPacket(mismatchedRoot, { providerRuntimeSha: '0'.repeat(64) });
    assert.throws(() => validatePhysioSentryReleasePacket(mismatchedRoot, finalOptions), /provider source-map file/i);
    buildFinalPacket(readinessRoot, { withCurrentReadiness: true });
    assert.equal(validatePhysioSentryReleasePacket(readinessRoot, finalOptions), true);
    buildFinalPacket(directGlobalRoot, { organizationOperation: 'organization-global', withCurrentReadiness: true });
    assert.equal(validatePhysioSentryReleasePacket(directGlobalRoot, finalOptions), true);
    const initialPath = path.join(root, 'sentry-phase-packet', 'phase-0000.json');
    fs.writeFileSync(initialPath, canonical({ ...JSON.parse(fs.readFileSync(initialPath, 'utf8')),
      candidate_core_receipt_sha256: '0'.repeat(64),
    }));
    writePacket(path.join(root, 'sentry-phase-packet'), {});
    writePacket(root, {});
    assert.throws(() => validatePhysioSentryReleasePacket(root, finalOptions), /predecessor byte binding/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(invalidRoot, { recursive: true, force: true });
    fs.rmSync(mismatchedRoot, { recursive: true, force: true });
    fs.rmSync(readinessRoot, { recursive: true, force: true });
    fs.rmSync(directGlobalRoot, { recursive: true, force: true });
  }
});

test('orphan compensation requires exact target identity, no events and exhausted empty deploy pagination', () => {
  const release = {
    version: `physio-production@${applicationSha}`,
    status: 'open',
    deployCount: 0,
    lastDeploy: null,
    firstEvent: null,
    lastEvent: null,
    projects: [{ id: '4511827129663488', slug: 'assesssuite-production' }],
  };
  const deployPages = [{ items: [], next_cursor: null, results: false }];
  assert.equal(validatePhysioSentrySafeOrphanReadback(release, deployPages, { applicationSha }), true);
  assert.throws(() => validatePhysioSentrySafeOrphanReadback({ ...release, firstEvent: 'event' }, deployPages,
    { applicationSha }), /event-free/i);
  assert.throws(() => validatePhysioSentrySafeOrphanReadback(release,
    [{ items: [], next_cursor: 'cursor', results: true }], { applicationSha }), /exhaustively empty/i);
  assert.throws(() => validatePhysioSentrySafeOrphanReadback({
    ...release,
    projects: [{ id: '999', slug: 'assesssuite-production' }],
  }, deployPages, { applicationSha }), /exact undeployed/i);
});

test('prepare workflow persists each mutation guard and admits every response-loss recovery edge', () => {
  const workflow = fs.readFileSync(path.resolve(
    '.github/workflows/physio-production-prepare-release.yml',
  ), 'utf8');
  assert.doesNotMatch(workflow, /continue-on-error:|set -x|set -o xtrace/);
  for (const marker of [
    "route = 'CREATE_REUSE'",
    "route = 'COMPENSATION_COMPLETE'",
    "phase: 'COMPENSATION_STARTED'",
    "phase:'COMPENSATION_COMPLETED'",
    "phase:'CREATE_UPLOAD_FINALIZE_STARTED'",
    "request delete DELETE \"$release_url\"",
    "request absence GET \"$release_url\"",
    "operation=\"deploy-page-$page\"",
    'Exhaustively deny unadmitted prior exact-SHA Sentry effects',
    'sentry-prior-artifact-inventory.json',
    'Revalidate completed Sentry release current state with read-only provider calls',
    'provider-current-readiness-readback.json',
    'provider-current-readiness-request-id-hashes.json',
    'sentry-current-readiness.json',
    'sentry-phase-packet',
    'sentry-source-map-manifest.json',
    "'phase-????.json'",
    "'reconciliation-????.json'",
    'extract-provider-request-ids',
    'validate-release-packet',
  ]) {
    assert.match(workflow, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(workflow, /if: \$\{\{ needs\.sentry_reconcile\.outputs\.route == 'CREATE_REUSE' \|\| steps\.upload_generation_start\.outcome == 'success' \}\}/);
  assert.match(workflow, /if: \$\{\{ needs\.sentry_reconcile\.outputs\.route == 'COMPENSATION_COMPLETE' \|\| steps\.upload_compensation_effect\.outcome == 'success' \}\}/);
});
