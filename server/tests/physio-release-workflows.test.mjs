import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

import {
  PHYSIO_RESTORE_PROVIDER_OFF_ENV,
  PHYSIO_RELEASE_TARGET,
  canonicalizePhysioFlyImageReference,
  inspectApplication,
  inspectCertificateInventory,
  inspectFirstReleaseRecoveryVerifierTopology,
  inspectNoCustomCertificates,
  inspectRestoreVerifierTopology,
  inspectSnapshot,
  inspectTopology,
  renderPhysioReleaseCatalogueEnvironment,
  validatePhysioStateSnapshotEvidence,
  validatePhysioReleaseSource,
  validateRuntimeEvidence,
} from '../../scripts/physio-release-contract.mjs';
import { validatePhysioSentryReleasePacket } from '../../scripts/physio-sentry-release-contract.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workflowDirectory = path.join(repoRoot, '.github', 'workflows');
const workflowNames = Object.freeze([
  'physio-production-state-snapshot.yml',
  'physio-production-prepare-release.yml',
  'physio-production-exact-image-canary.yml',
  'physio-production-bootstrap.yml',
  'physio-production-stripe-webhook.yml',
  'physio-production-webhook-archive.yml',
  'physio-production-publish.yml',
  'physio-production-deploy.yml',
  'physio-production-rollback.yml',
]);

function workflow(name) {
  return fs.readFileSync(path.join(workflowDirectory, name), 'utf8').replaceAll('\r\n', '\n');
}

function countOf(source, needle) {
  return source.split(needle).length - 1;
}

function assertInOrder(source, markers) {
  let previous = -1;
  for (const marker of markers) {
    const index = source.indexOf(marker, previous + 1);
    assert.notEqual(index, -1, `missing ordered marker ${marker}`);
    assert.ok(index > previous, `${marker} is out of order`);
    previous = index;
  }
}

test('legacy Sentry completion packets fail closed without the frozen manifest and v2 phase chain', () => {
  const applicationSha = 'a'.repeat(40);
  const releaseVersion = `physio-production@${applicationSha}`;
  const sourceMapManifestSha256 = 'b'.repeat(64);
  const sourceMapArchiveSha256 = 'c'.repeat(64);
  const capabilityIntentId = 'CAP-20260821-ASSESSSUITE-PHYSIO-MVP:sentry-release';
  const authorityReference = 'UM-AUTO-20260821-ASSESSSUITE-PHYSIO-MVP-LIVE';
  const timestamp = '2026-08-22T00:00:00.000Z';
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
  const writePacket = (root, projectId) => {
    const providerEffectId = `sha256:${hash(JSON.stringify({
      application_sha: applicationSha,
      release_version: releaseVersion,
      source_map_manifest_sha256: sourceMapManifestSha256,
      source_map_archive_sha256: sourceMapArchiveSha256,
      capability_intent_id: capabilityIntentId,
      authority_reference: authorityReference,
    }))}`;
    const started = {
      contract_version: 'assesssuite-physio-sentry-release-effect/1.0.0', result: 'STARTED',
      application: 'assesssuite-physio-production', application_sha: applicationSha,
      profession_id: 'physio', sentry_org: 'unimatter', sentry_project: 'assesssuite-production',
      sentry_project_id: projectId, sentry_environment: 'physio-production', release_version: releaseVersion,
      provider_effect_id: providerEffectId, source_map_manifest_sha256: sourceMapManifestSha256,
      source_map_archive_sha256: sourceMapArchiveSha256, candidate_core_receipt_sha256: 'd'.repeat(64),
      capability_intent_id: capabilityIntentId, authority_reference: authorityReference,
      resume_effect_artifact_id: '0', resume_effect_artifact_digest: '0',
      resume_artifact_admission_sha256: 'sha256:na', prior_effect_receipt_sha256: 'sha256:na',
      started_at: timestamp,
    };
    fs.writeFileSync(path.join(root, 'sentry-started-effect.json'), canonical(started));
    const startedSha = hash(fs.readFileSync(path.join(root, 'sentry-started-effect.json')));
    const requestHashes = {
      final_headers_sha256: '1'.repeat(64), final_status_sha256: '2'.repeat(64),
      prestate_headers_sha256: '3'.repeat(64), prestate_status_sha256: '4'.repeat(64),
    };
    fs.writeFileSync(path.join(root, 'provider-request-id-hashes.json'), canonical(requestHashes));
    const requestHashesSha = hash(fs.readFileSync(path.join(root, 'provider-request-id-hashes.json')));
    const readback = {
      version: releaseVersion,
      projects: [{ id: '4511827129663488', slug: 'assesssuite-production' }],
      status: 'open', date_released: null,
    };
    fs.writeFileSync(path.join(root, 'provider-release-readback.json'), canonical(readback));
    const readbackSha = hash(fs.readFileSync(path.join(root, 'provider-release-readback.json')));
    const effect = {
      contract_version: 'assesssuite-physio-sentry-release-effect/1.0.0', result: 'COMPLETED',
      application: 'assesssuite-physio-production', application_sha: applicationSha,
      profession_id: 'physio', sentry_org: 'unimatter', sentry_project: 'assesssuite-production',
      sentry_project_id: projectId, sentry_environment: 'physio-production', release_version: releaseVersion,
      provider_effect_id: providerEffectId, started_effect_artifact_id: '123',
      started_effect_artifact_digest: `sha256:${'5'.repeat(64)}`,
      started_effect_receipt_sha256: startedSha, prestate_http_status: 404, mutation_started: true,
      release_new_exit_code: 0, source_map_upload_exit_code: 0, release_finalize_exit_code: 0,
      source_map_manifest_sha256: sourceMapManifestSha256, source_map_archive_sha256: sourceMapArchiveSha256,
      provider_release_readback_sha256: readbackSha, provider_request_id_hashes_sha256: requestHashesSha,
      completed_at: timestamp,
    };
    fs.writeFileSync(path.join(root, 'sentry-release-effect-reconciliation.json'), canonical(effect));
    const effectSha = hash(fs.readFileSync(path.join(root, 'sentry-release-effect-reconciliation.json')));
    const receipt = {
      contract_version: 'assesssuite-physio-sentry-release/1.0.0', result: 'PASS',
      application: 'assesssuite-physio-production', application_sha: applicationSha,
      profession_id: 'physio', sentry_org: 'unimatter', sentry_project: 'assesssuite-production',
      sentry_project_id: '4511827129663488', sentry_environment: 'physio-production',
      release_version: releaseVersion, source_map_manifest_sha256: sourceMapManifestSha256,
      source_map_archive_sha256: sourceMapArchiveSha256, source_map_runtime_count: 1, source_map_count: 1,
      source_maps_uploaded: true, release_finalized: true,
      source_map_upload_stdout_sha256: '6'.repeat(64), source_map_upload_stderr_sha256: '7'.repeat(64),
      provider_release_readback_sha256: readbackSha, credential_scope: ['SENTRY_AUTH_TOKEN'],
      provider_request_id_hashes_sha256: requestHashesSha, started_effect_artifact_id: '123',
      started_effect_artifact_digest: `sha256:${'5'.repeat(64)}`,
      started_effect_receipt_sha256: startedSha, effect_reconciliation_receipt_sha256: effectSha,
      fly_credential_absent: true, sentry_dsn_absent: true, completed_at: timestamp,
    };
    fs.writeFileSync(path.join(root, 'physio-sentry-release.json'), canonical(receipt));
    const names = fs.readdirSync(root).sort();
    const sums = names.map((name) => `${hash(fs.readFileSync(path.join(root, name)))}  ${name}`).join('\n');
    fs.writeFileSync(path.join(root, 'SHA256SUMS'), `${sums}\n`);
  };

  const validRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-packet-valid-'));
  const driftRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-sentry-packet-drift-'));
  try {
    writePacket(validRoot, '4511827129663488');
    assert.throws(() => validatePhysioSentryReleasePacket(validRoot, {
      applicationSha, capabilityIntentId, authorityReference,
      sourceMapManifestSha256, sourceMapArchiveSha256,
    }), /phase packet|phase state-machine/i);
    writePacket(driftRoot, '9999999999999999');
    assert.throws(() => validatePhysioSentryReleasePacket(driftRoot, {
      applicationSha, capabilityIntentId, authorityReference,
      sourceMapManifestSha256, sourceMapArchiveSha256,
    }), /phase packet|phase state-machine/i);
  } finally {
    fs.rmSync(validRoot, { recursive: true, force: true });
    fs.rmSync(driftRoot, { recursive: true, force: true });
  }
});

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing block start ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing block end ${endMarker}`);
  return source.slice(start, end);
}

function assertIsolatedRestoreVerifierBlock(source, { imageVariable, role }) {
  assert.match(source, new RegExp(`fly machine run "\\$${imageVariable}"`));
  assert.match(source, /--volume "\$restore_volume_id:\/app\/server\/data"/);
  assert.match(source, new RegExp(`--metadata 'assesssuite-restore-role=${role}'`));
  assert.match(source, /--restart no --autostart=false --autostop=off --skip-dns-registration/);
  assert.doesNotMatch(source, /--port|--service|--http-service/);
  assert.match(source, /physio-release-contract\.mjs inspect-restore-verifier/);
  assert.match(source, /--production-state stopped/);
  for (const name of Object.keys(PHYSIO_RESTORE_PROVIDER_OFF_ENV)) {
    assert.match(source, new RegExp(`--env '${name}=0'`));
  }
  for (const name of [
    'ADMIN_PASSWORD', 'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY', 'OPENAI_API_KEY', 'RESEND_API_KEY', 'SENTRY_DSN',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_MONTHLY',
    'STRIPE_PRICE_ID_ANNUAL', 'OPENAI_CHAT_TEST_BASE_URL', 'OPENAI_CHAT_TEST_TIMEOUT_MS',
    'DOCUMENT_EXTRACTION_TEST_BASE_URL', 'DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK',
    'RUN_DOCUMENT_EXTRACTION_PROVIDER_PROBE', 'RUN_PHYSIO_EXACT_IMAGE_CANARY',
  ]) assert.match(source, new RegExp(`-u ${name}(?: |\\")`));
  assert.match(source, /node \/app\/scripts\/physio-restore-verify\.mjs verify --database \/app\/server\/data\/physio\.db/);
  assert.match(source, /--snapshot-sentinel '\$snapshot_sentinel'/);
  assert.match(source, /--expected-data-manifest-sha256 '\$expected_data_manifest_sha256'/);
  assert.match(source, /assesssuite-physio-restore-verification\/2\.0\.0/);
  assert.match(source, /provider_switches_disabled !== true \|\| row\.provider_credentials_absent !== true/);
  assert.match(source, /row\.test_provider_settings_absent !== true/);
  assert.match(source, /row\.schema_digest !== 'sha256:[0-9a-f]{64}'/);
  assert.match(source, /row\.data_manifest_sha256 !== process\.env\.(?:EXPECTED_MANIFEST|MANIFEST)/);
  assert.match(source, /row\.catalogue_checksum !== process\.env\.PHYSIO_EXPECTED_CATALOGUE_CHECKSUM/);
}

const image = `registry.fly.io/${PHYSIO_RELEASE_TARGET.app}@sha256:${'b'.repeat(64)}`;
const volume = Object.freeze({
  id: 'vol_physio123',
  name: PHYSIO_RELEASE_TARGET.volumeName,
  region: PHYSIO_RELEASE_TARGET.region,
  state: 'created',
  size_gb: PHYSIO_RELEASE_TARGET.volumeSizeGb,
  encrypted: true,
  snapshot_retention: PHYSIO_RELEASE_TARGET.volumeSnapshotRetentionDays,
  auto_backup_enabled: true,
  attached_machine_id: null,
});
const machine = Object.freeze({
  id: 'abcdef01234567',
  region: PHYSIO_RELEASE_TARGET.region,
  state: 'started',
  image_ref: image,
  config: {
    image,
    guest: { cpus: 1, memory_mb: 512, cpu_kind: 'shared' },
    mounts: [{ volume: volume.id, name: volume.name, path: PHYSIO_RELEASE_TARGET.mountPath }],
  },
});

function runtimeEvidence() {
  return {
    live: {
      status: 'live', profession_id: 'physio', app_id: 'local-assesssuite-physio',
    },
    ready: {
      status: 'ready', ready: true, failures: [],
      checks: {
        identity: true,
        release_metadata: true,
        database_integrity: true,
        database_schema: true,
        catalogue: true,
        required_dependencies: true,
        production_posture: true,
      },
    },
    version: {
      release_sha: 'a'.repeat(40),
      profession_id: 'physio', profession_schema_version: '2.0.0',
      app_id: 'local-assesssuite-physio',
      catalogue: {
        count: 236,
        expected_count: 236,
        checksum: PHYSIO_RELEASE_TARGET.catalogueChecksum,
        expected_checksum: PHYSIO_RELEASE_TARGET.catalogueChecksum,
        ready: true,
      },
      database: {
        integrity: 'ok', schema_ready: true, migration_version: `sha256:${'c'.repeat(64)}`,
      },
      production_posture: {
        mode: 'normal-production',
        ready: true,
        deployment_ready: true,
        posture_sha256: `sha256:${'d'.repeat(64)}`,
      },
    },
    capabilities: {
      profession_id: 'physio', app_id: 'local-assesssuite-physio',
      required_dependencies_ready: true,
      production_posture_ready: true,
      production_deployment_ready: true,
      production_posture_mode: 'normal-production',
      capabilities: {
        general_clinical_llm: {
          enabled: true, required: true, ready: true, status: 'ready',
        },
        ...Object.fromEntries([
          'physio_ai_tasks', 'transcription', 'document_extraction', 'transactional_email', 'payments',
        ].map((name) => [name, { enabled: true, required: true, ready: true, status: 'ready' }])),
      },
    },
  };
}

test('Physio release source is explicit deterministic and isolated from EP topology', () => {
  const first = validatePhysioReleaseSource(repoRoot);
  const second = validatePhysioReleaseSource(repoRoot);
  assert.deepEqual(first, second);
  assert.match(first.configSha256, /^[0-9a-f]{64}$/);
  assert.match(first.dockerfileSha256, /^[0-9a-f]{64}$/);

  const config = fs.readFileSync(path.join(repoRoot, 'fly.physio.production.toml'), 'utf8');
  assert.match(config, /^app = "assesssuite-physio-production"$/m);
  assert.match(config, /^primary_region = "syd"$/m);
  assert.match(config, /^  source = "assesssuite_physio_data"$/m);
  assert.match(config, /^  EMAIL_FROM = "AssessSuite Physiotherapy <verification@assesssuite\.com>"$/m);
  assert.match(config, /^  EMAIL_REPLY_TO = "admin@assesssuite\.com"$/m);
  assert.match(config, /^  EMAIL_DOMAIN = "assesssuite\.com"$/m);
  assert.match(config, /^  STRIPE_TRIAL_PERIOD_DAYS = "30"$/m);
  assert.match(config, /^  LLM_REQUIRED = "1"$/m);
  assert.match(config, /^  GENERAL_CLINICAL_LLM_ENABLED = "1"$/m);
  assert.match(config, /^  ALLOW_OPEN_REGISTRATION = "0"$/m);
  assert.doesNotMatch(config, /assesssuite_data_r12|app = "assesssuite-production"/);
});

test('one exact-SHA release target drives every catalogue receipt and runtime expectation', () => {
  assert.equal(PHYSIO_RELEASE_TARGET.catalogueCount, 236);
  assert.match(PHYSIO_RELEASE_TARGET.catalogueChecksum, /^[0-9a-f]{64}$/);
  assert.equal(
    renderPhysioReleaseCatalogueEnvironment(),
    `PHYSIO_EXPECTED_CATALOGUE_COUNT=${PHYSIO_RELEASE_TARGET.catalogueCount}\n`
      + `PHYSIO_EXPECTED_CATALOGUE_CHECKSUM=${PHYSIO_RELEASE_TARGET.catalogueChecksum}\n`,
  );

  const prepare = workflow('physio-production-prepare-release.yml');
  const deploy = workflow('physio-production-deploy.yml');
  const releaseContract = fs.readFileSync(path.join(repoRoot, 'scripts', 'physio-release-contract.mjs'), 'utf8');
  const runtimeStatusTest = fs.readFileSync(path.join(repoRoot, 'server', 'tests', 'runtime-status.test.mjs'), 'utf8');
  assert.equal(
    [releaseContract, prepare, deploy, runtimeStatusTest]
      .reduce((total, source) => total + countOf(source, PHYSIO_RELEASE_TARGET.catalogueChecksum), 0),
    1,
    'the frozen catalogue checksum must have exactly one authoritative source literal',
  );

  assert.match(prepare, /node scripts\/physio-release-contract\.mjs validate-source/);
  assert.equal(countOf(deploy, 'write-catalogue-environment --github-env "$GITHUB_ENV"'), 1);
  assert.match(deploy, /catalogue_count: catalogueCount/);
  assert.match(deploy, /catalogue_checksum: catalogueChecksum/);
  for (const source of [prepare, deploy]) assert.doesNotMatch(source, /catalogue_checksum: '[0-9a-f]{64}'/);
  assert.match(deploy, /row\.catalogue_count !== Number\(process\.env\.PHYSIO_EXPECTED_CATALOGUE_COUNT\)/);
  assert.match(deploy, /row\.catalogue_checksum !== process\.env\.PHYSIO_EXPECTED_CATALOGUE_CHECKSUM/);
});

test('topology validator accepts only absent bootstrapped or sole exact-digest deployed Physio states', () => {
  assert.deepEqual(
    inspectTopology({ machinesPayload: [], volumesPayload: [], mode: 'absent' }),
    { mode: 'absent', machineCount: 0, volumeCount: 0 },
  );
  assert.deepEqual(
    inspectTopology({
      machinesPayload: [], volumesPayload: [volume], mode: 'bootstrapped', expectedVolumeId: volume.id,
    }),
    { mode: 'bootstrapped', machineCount: 0, volumeCount: 1, volumeId: volume.id },
  );
  const attached = { ...volume, attached_machine_id: machine.id };
  assert.deepEqual(
    inspectTopology({
      machinesPayload: [machine], volumesPayload: [attached], mode: 'deployed',
      expectedVolumeId: volume.id, expectedMachineId: machine.id, expectedImageRef: image,
    }),
    { mode: 'deployed', machineCount: 1, volumeCount: 1, volumeId: volume.id, machineId: machine.id },
  );
  const flyImageObject = {
    registry: 'registry.fly.io', repository: PHYSIO_RELEASE_TARGET.app,
    digest: `sha256:${'b'.repeat(64)}`,
  };
  assert.equal(canonicalizePhysioFlyImageReference(flyImageObject), image);
  const flyctl0471ImageObject = {
    ...flyImageObject,
    tag: `deployment-${'A'.repeat(26)}`,
    labels: {
      GH_ACTION_NAME: '__run_5',
      GH_EVENT_NAME: 'workflow_dispatch',
      GH_REPO: 'mbvidler-ctrl/assesssuite_migration',
      GH_SHA: 'a'.repeat(40),
    },
  };
  assert.equal(canonicalizePhysioFlyImageReference(flyctl0471ImageObject), image);
  assert.deepEqual(inspectTopology({
    machinesPayload: [{
      ...machine,
      image_ref: flyctl0471ImageObject,
      config: {
        ...machine.config,
        image: `registry.fly.io/${PHYSIO_RELEASE_TARGET.app}:${flyctl0471ImageObject.tag}`,
      },
    }],
    volumesPayload: [attached], mode: 'deployed', expectedVolumeId: volume.id,
    expectedMachineId: machine.id, expectedImageRef: image,
  }), { mode: 'deployed', machineCount: 1, volumeCount: 1, volumeId: volume.id, machineId: machine.id });
  assert.deepEqual(inspectTopology({
    machinesPayload: [{ ...machine, image_ref: flyImageObject, config: { ...machine.config, image: flyImageObject } }],
    volumesPayload: [attached], mode: 'deployed', expectedVolumeId: volume.id,
    expectedMachineId: machine.id, expectedImageRef: image,
  }), { mode: 'deployed', machineCount: 1, volumeCount: 1, volumeId: volume.id, machineId: machine.id });
  for (const invalidImage of [
    { ...flyImageObject, registry: 'docker.io' },
    { ...flyImageObject, repository: 'assesssuite-ep-production' },
    { ...flyImageObject, extra: 'moving-tag' },
    { ...flyctl0471ImageObject, tag: 'moving-tag' },
    { ...flyctl0471ImageObject, labels: { unexpected: 'value' } },
    { ...flyctl0471ImageObject, labels: { GH_REPO: 'other/repository' } },
  ]) assert.throws(() => canonicalizePhysioFlyImageReference(invalidImage), /Physio release contract/);

  assert.throws(() => inspectTopology({
    machinesPayload: [{
      ...machine,
      image_ref: flyctl0471ImageObject,
      config: { ...machine.config, image: `registry.fly.io/${PHYSIO_RELEASE_TARGET.app}:deployment-${'B'.repeat(26)}` },
    }],
    volumesPayload: [attached], mode: 'deployed', expectedVolumeId: volume.id,
    expectedMachineId: machine.id, expectedImageRef: image,
  }), /Physio release contract/);

  const invalidCases = [
    () => inspectTopology({ machinesPayload: [machine], volumesPayload: [], mode: 'absent' }),
    () => inspectTopology({ machinesPayload: [], volumesPayload: [volume, volume], mode: 'bootstrapped' }),
    () => inspectTopology({
      machinesPayload: [{ ...machine, region: 'iad' }], volumesPayload: [attached], mode: 'deployed',
      expectedImageRef: image,
    }),
    () => inspectTopology({
      machinesPayload: [machine], volumesPayload: [{ ...attached, auto_backup_enabled: false }], mode: 'deployed',
      expectedImageRef: image,
    }),
    () => inspectTopology({
      machinesPayload: [machine], volumesPayload: [attached], mode: 'deployed',
      expectedImageRef: `registry.fly.io/${PHYSIO_RELEASE_TARGET.app}:moving-tag`,
    }),
    () => inspectTopology({
      machinesPayload: [{
        ...machine,
        config: {
          ...machine.config,
          mounts: [{ name: volume.name, path: PHYSIO_RELEASE_TARGET.mountPath }],
        },
      }],
      volumesPayload: [attached], mode: 'deployed', expectedImageRef: image,
    }),
  ];
  for (const invalid of invalidCases) assert.throws(invalid, /Physio release contract/);
});

test('first-release snapshot recovery verifier proves exact replacement mount and no provider surface', () => {
  const recoveryVolumeId = 'vol_recovery123';
  const verifierMachineId = '1234567890abcd';
  const verifierMachineName = 'assesssuite-physio-first-recovery-aaaaaaaaaaaa';
  const verifierRole = 'physio-first-release-recovery-verifier';
  const applicationSha = 'a'.repeat(40);
  const original = { ...volume, attached_machine_id: null };
  const recovery = { ...volume, id: recoveryVolumeId, attached_machine_id: verifierMachineId };
  const verifier = {
    id: verifierMachineId,
    name: verifierMachineName,
    region: PHYSIO_RELEASE_TARGET.region,
    state: 'started',
    image_ref: image,
    config: {
      image,
      services: [],
      mounts: [{ volume: recoveryVolumeId, path: PHYSIO_RELEASE_TARGET.mountPath }],
      metadata: {
        'assesssuite-restore-role': verifierRole,
        'assesssuite-release-sha': applicationSha,
      },
      init: { cmd: ['sleep', '1800'] },
      restart: { policy: 'no' },
      dns: { skip_registration: true },
      auto_destroy: false,
      env: {
        NODE_ENV: 'production',
        PROFESSION: PHYSIO_RELEASE_TARGET.professionId,
        DEFAULT_APP_ID: PHYSIO_RELEASE_TARGET.appId,
        ...PHYSIO_RESTORE_PROVIDER_OFF_ENV,
      },
    },
  };
  const input = {
    machinesPayload: [verifier],
    volumesPayload: [original, recovery],
    originalVolumeId: volume.id,
    recoveryVolumeId,
    verifierMachineName,
    verifierRole,
    expectedImageRef: image,
    expectedApplicationSha: applicationSha,
  };
  const result = inspectFirstReleaseRecoveryVerifierTopology(input);
  assert.equal(result.verifierMachineId, verifierMachineId);
  assert.equal(result.originalVolumeDetached, true);
  assert.equal(result.recoveryVolumeExactMountVerified, true);

  for (const mutate of [
    (copy) => { copy.machines[0].config.mounts[0] = { name: recovery.name, path: PHYSIO_RELEASE_TARGET.mountPath }; },
    (copy) => { copy.machines[0].config.services = [{ internal_port: 8787 }]; },
    (copy) => { copy.machines[0].config.env.EXTRA_PROVIDER_SETTING = '0'; },
    (copy) => { copy.volumes[0].attached_machine_id = verifierMachineId; },
  ]) {
    const copy = { machines: structuredClone(input.machinesPayload), volumes: structuredClone(input.volumesPayload) };
    mutate(copy);
    assert.throws(() => inspectFirstReleaseRecoveryVerifierTopology({
      ...input,
      machinesPayload: copy.machines,
      volumesPayload: copy.volumes,
    }), /Physio release contract/);
  }
});

test('restore verifier topology is an exact two-machine two-volume no-service provider-off corridor', () => {
  const productionMachineId = machine.id;
  const restoreVolumeId = 'vol_restore123';
  const verifierMachineId = '1234567890abcd';
  const verifierMachineName = 'assesssuite-physio-restore-aaaaaaaaaaaa';
  const verifierRole = 'physio-deploy-verifier';
  const applicationSha = 'a'.repeat(40);
  const production = structuredClone(machine);
  production.state = 'stopped';
  const primary = { ...volume, attached_machine_id: productionMachineId };
  const restore = {
    ...volume,
    id: restoreVolumeId,
    name: 'assesssuite_physio_restore_gate',
    attached_machine_id: verifierMachineId,
  };
  const verifier = {
    id: verifierMachineId,
    name: verifierMachineName,
    region: PHYSIO_RELEASE_TARGET.region,
    state: 'started',
    image_ref: image,
    config: {
      image,
      guest: { cpus: 1, memory_mb: 512, cpu_kind: 'shared' },
      services: [],
      mounts: [{ volume: restoreVolumeId, path: PHYSIO_RELEASE_TARGET.mountPath }],
      metadata: {
        'assesssuite-restore-role': verifierRole,
        'assesssuite-release-sha': applicationSha,
      },
      init: { cmd: ['sleep', '1800'] },
      restart: { policy: 'no' },
      dns: { skip_registration: true },
      auto_destroy: false,
      env: {
        NODE_ENV: 'production',
        PROFESSION: PHYSIO_RELEASE_TARGET.professionId,
        DEFAULT_APP_ID: PHYSIO_RELEASE_TARGET.appId,
        ...PHYSIO_RESTORE_PROVIDER_OFF_ENV,
      },
    },
  };
  const input = {
    machinesPayload: [production, verifier],
    volumesPayload: [primary, restore],
    productionMachineId,
    primaryVolumeId: volume.id,
    restoreVolumeId,
    verifierMachineName,
    verifierRole,
    expectedImageRef: image,
    expectedApplicationSha: applicationSha,
    expectedProductionState: 'stopped',
  };
  const result = inspectRestoreVerifierTopology(input);
  assert.equal(result.verifierMachineId, verifierMachineId);
  assert.equal(result.services, 0);
  assert.equal(result.exactMountIdVerified, true);
  assert.equal(result.providerCommandReadback, true);
  assert.equal(result.providerEnvironmentReadback, true);
  assert.equal(result.providerRestartPolicyReadback, true);
  assert.equal(result.providerDnsReadback, true);

  for (const mutate of [
    (copy) => { copy.machines[1].config.mounts[0] = { volume: 'vol_wrong123', name: restore.name, path: PHYSIO_RELEASE_TARGET.mountPath }; },
    (copy) => { copy.machines[1].config.services = [{ internal_port: 8787 }]; },
    (copy) => { copy.machines[1].config.init.cmd = ['node', 'server/index.mjs']; },
    (copy) => { copy.machines[1].config.dns.skip_registration = false; },
    (copy) => { copy.machines[1].config.env.OUTBOUND_SMS_ENABLED = '1'; },
    (copy) => { copy.machines[0].state = 'started'; },
  ]) {
    const copy = { machines: structuredClone(input.machinesPayload), volumes: structuredClone(input.volumesPayload) };
    mutate(copy);
    assert.throws(
      () => inspectRestoreVerifierTopology({
        ...input,
        machinesPayload: copy.machines,
        volumesPayload: copy.volumes,
      }),
      /Physio release contract/,
    );
  }
});

test('application certificate snapshot and runtime validators fail closed on drift', () => {
  const appRow = { name: PHYSIO_RELEASE_TARGET.app };
  assert.deepEqual(inspectApplication({ applicationsPayload: [], mode: 'absent' }), { mode: 'absent', count: 0 });
  assert.deepEqual(inspectApplication({ applicationsPayload: [appRow], mode: 'present' }), { mode: 'present', count: 1 });
  assert.throws(() => inspectApplication({ applicationsPayload: [appRow], mode: 'absent' }), /already exists/);
  assert.deepEqual(inspectNoCustomCertificates([]), { count: 0 });
  assert.throws(() => inspectNoCustomCertificates([{ hostname: 'physio.app.assesssuite.com' }]), /not empty/);
  const productionCertificate = {
    hostname: 'physio.app.assesssuite.com',
    status: 'Ready',
    dns_provider: 'godaddy',
    acme_dns_configured: false,
    acme_alpn_configured: true,
    acme_http_configured: false,
    ownership_txt_configured: false,
    configured: true,
    acme_requested: true,
    has_custom_certificate: false,
    has_fly_certificate: true,
    created_at: '2026-08-25T02:45:44.06Z',
    updated_at: '2026-08-25T03:09:55.13Z',
  };
  assert.deepEqual(inspectCertificateInventory([productionCertificate], { mode: 'production' }), {
    count: 1,
    hostname: 'physio.app.assesssuite.com',
    status: 'ready',
    dnsProvider: 'godaddy',
    challenge: 'tls-alpn-01',
    configured: true,
    acmeRequested: true,
    flyManaged: true,
    customCertificateCount: 0,
    createdAt: '2026-08-25T02:45:44.06Z',
    updatedAt: '2026-08-25T03:09:55.13Z',
  });
  for (const mutate of [
    (certificate) => { certificate.hostname = 'other.example.com'; },
    (certificate) => { certificate.status = 'Awaiting certificates'; },
    (certificate) => { certificate.has_custom_certificate = true; },
    (certificate) => { certificate.has_fly_certificate = false; },
    (certificate) => { certificate.acme_alpn_configured = false; },
    (certificate) => { certificate.created_at = 'not-a-date'; },
    (certificate) => { certificate.extra = true; },
  ]) {
    const certificate = structuredClone(productionCertificate);
    mutate(certificate);
    assert.throws(
      () => inspectCertificateInventory([certificate], { mode: 'production' }),
      /Physio release contract/,
    );
  }
  assert.throws(
    () => inspectCertificateInventory([productionCertificate, productionCertificate], { mode: 'production' }),
    /expected 1/,
  );
  assert.throws(() => inspectCertificateInventory([], { mode: 'other' }), /unsupported certificate inventory mode/);
  assert.deepEqual(inspectSnapshot({ snapshotsPayload: [{ id: 'vs_snapshot123', status: 'created' }] }), {
    snapshotId: 'vs_snapshot123', status: 'created',
  });

  const passing = runtimeEvidence();
  assert.deepEqual(validateRuntimeEvidence({ ...passing, expectedSha: 'a'.repeat(40) }), {
    releaseSha: 'a'.repeat(40), ready: true,
  });
  for (const mutate of [
    (evidence) => { evidence.ready.ready = false; },
    (evidence) => { evidence.version.catalogue.count = 235; },
    (evidence) => { evidence.version.database.integrity = 'failed'; },
    (evidence) => { evidence.capabilities.capabilities.transcription.status = 'unavailable'; },
    (evidence) => { evidence.capabilities.capabilities.general_clinical_llm = {
      enabled: false, required: true, ready: false, status: 'disabled',
    }; },
    (evidence) => { delete evidence.capabilities.capabilities.physio_ai_tasks; },
    (evidence) => { delete evidence.capabilities.capabilities.document_extraction; },
  ]) {
    const evidence = structuredClone(passing);
    mutate(evidence);
    assert.throws(() => validateRuntimeEvidence({ ...evidence, expectedSha: 'a'.repeat(40) }), /Physio release contract/);
  }
});

test('prepare admits exact absent or deployed state snapshots and rejects state drift', () => {
  const applicationSha = 'a'.repeat(40);
  const rawHashes = Object.fromEntries([
    'apps_final', 'apps_initial', 'certificates_final', 'certificates_initial',
    'machines_final', 'machines_initial', 'volumes_final', 'volumes_initial',
  ].map((key) => [key, 'b'.repeat(64)]));
  const bytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  const receipt = (state, providerBytes, overrides = {}) => ({
    contract_version: 'assesssuite-physio-state-snapshot/2.0.0',
    result: 'PASS',
    application: PHYSIO_RELEASE_TARGET.app,
    event_sha: applicationSha,
    expected_state: state,
    volume_id: state === 'absent' ? 'NOT-CREATED' : 'vol_40o2xpn82k5qkmk4',
    machine_id: state === 'absent' ? 'NOT-CREATED' : '2863214a0d2228',
    immutable_image: state === 'absent'
      ? 'NOT-DEPLOYED'
      : `registry.fly.io/${PHYSIO_RELEASE_TARGET.app}@sha256:${'c'.repeat(64)}`,
    custom_certificate_count: 0,
    fly_hostname_precedes_custom_dns: true,
    provider_state_unchanged: true,
    provider_state_initial_sha256: createHash('sha256').update(providerBytes).digest('hex'),
    provider_state_final_sha256: createHash('sha256').update(providerBytes).digest('hex'),
    provider_raw_readback_sha256: rawHashes,
    capability_intent_id: 'physio-state-test',
    authority_reference: 'UM-AUTO-PHYSIO/state-test',
    observed_at: '2026-08-29T15:48:31.997Z',
    ...overrides,
  });
  const absentState = bytes({
    application: { mode: 'absent', count: 0 },
    topology: { mode: 'absent', machineCount: 0, volumeCount: 0 },
    certificates: { count: 0 },
  });
  const deployedProvider = {
    application: { mode: 'present', count: 1 },
    topology: {
      mode: 'deployed', machineCount: 1, volumeCount: 1,
      volumeId: 'vol_40o2xpn82k5qkmk4', machineId: '2863214a0d2228',
    },
    certificates: {
      count: 1,
      hostname: 'physio.app.assesssuite.com',
      status: 'ready',
      dnsProvider: 'godaddy',
      challenge: 'tls-alpn-01',
      configured: true,
      acmeRequested: true,
      flyManaged: true,
      customCertificateCount: 0,
      createdAt: '2026-08-25T02:45:44.06Z',
      updatedAt: '2026-08-25T03:09:55.13Z',
    },
  };
  const deployedState = bytes(deployedProvider);
  assert.deepEqual(validatePhysioStateSnapshotEvidence({
    receipt: receipt('absent', absentState),
    initialStateBytes: absentState,
    finalStateBytes: absentState,
    applicationSha,
  }), {
    expectedState: 'absent', volumeId: 'NOT-CREATED', machineId: 'NOT-CREATED', immutableImage: 'NOT-DEPLOYED',
  });
  assert.deepEqual(validatePhysioStateSnapshotEvidence({
    receipt: receipt('deployed', deployedState),
    initialStateBytes: deployedState,
    finalStateBytes: deployedState,
    applicationSha,
  }), {
    expectedState: 'deployed',
    volumeId: 'vol_40o2xpn82k5qkmk4',
    machineId: '2863214a0d2228',
    immutableImage: `registry.fly.io/${PHYSIO_RELEASE_TARGET.app}@sha256:${'c'.repeat(64)}`,
  });

  const mutationCases = [
    { receipt: receipt('bootstrapped', absentState) },
    { receipt: receipt('deployed', deployedState, { volume_id: 'vol_wrong' }) },
    { receipt: receipt('deployed', deployedState, { immutable_image: 'NOT-DEPLOYED' }) },
    { receipt: receipt('deployed', deployedState, { unexpected: true }) },
  ];
  for (const input of mutationCases) {
    assert.throws(() => validatePhysioStateSnapshotEvidence({
      receipt: input.receipt,
      initialStateBytes: input.receipt.expected_state === 'deployed' ? deployedState : absentState,
      finalStateBytes: input.receipt.expected_state === 'deployed' ? deployedState : absentState,
      applicationSha,
    }), /Physio release contract/);
  }
  const wrongHost = structuredClone(deployedProvider);
  wrongHost.certificates.hostname = 'other.example.com';
  const wrongHostBytes = bytes(wrongHost);
  assert.throws(() => validatePhysioStateSnapshotEvidence({
    receipt: receipt('deployed', wrongHostBytes),
    initialStateBytes: wrongHostBytes,
    finalStateBytes: wrongHostBytes,
    applicationSha,
  }), /topology or certificate differs/);
  assert.throws(() => validatePhysioStateSnapshotEvidence({
    receipt: receipt('deployed', deployedState),
    initialStateBytes: deployedState,
    finalStateBytes: bytes({ ...deployedProvider, unexpected: true }),
    applicationSha,
  }), /immutable evidence differs/);
});

test('all Physio release workflows are manual SHA-pinned isolated and certificate-bounded', () => {
  assert.deepEqual(
    fs.readdirSync(workflowDirectory).filter((name) => name.startsWith('physio-production-')).sort(),
    [
      ...workflowNames,
      'physio-production-lean-live.yml',
      'physio-production-provision-owners.yml',
    ].sort(),
  );
  for (const name of workflowNames) {
    const source = workflow(name);
    const document = yaml.load(source);
    assert.ok(source.endsWith('\n'), `${name} must end in LF`);
    assert.doesNotMatch(source, /\t|\0/, `${name} contains a tab or NUL`);
    assert.match(source, /\non:\n  workflow_dispatch:\n/);
    assert.doesNotMatch(source, /^  (?:push|pull_request|pull_request_target|schedule|workflow_run|repository_dispatch):/m);
    if (name === 'physio-production-bootstrap.yml') {
      assert.deepEqual(document.permissions, { contents: 'read', actions: 'read' },
        'bootstrap defaults to read-only permissions');
      assert.match(source, /assesssuite-physio-bootstrap-ledger/);
      assert.match(source, /node scripts\/physio-bootstrap-ledger\.mjs append/);
      assert.doesNotMatch(source, /\bgit\s+(?:push|commit|update-ref)\b|\bgh\s+api\b/,
        'bootstrap ledger writes must remain inside the owning audited helper');
    } else if (name === 'physio-production-webhook-archive.yml') {
      assert.deepEqual(document.permissions, { contents: 'read', actions: 'read' });
      assert.match(source, /assesssuite-physio-webhook-ledger/);
      assert.match(source, /node scripts\/physio-webhook-ledger\.mjs append/);
      assert.doesNotMatch(source, /\bgit\s+(?:push|commit|update-ref)\b|\bgh\s+api\b/,
        'webhook archive ledger writes must remain inside the owning audited helper');
    } else {
      assert.ok(document.permissions && Object.keys(document.permissions).length > 0 &&
        Object.values(document.permissions).every((value) => value === 'read'),
      `${name} must retain read-only workflow permissions`);
    }
    for (const [jobName, job] of Object.entries(document.jobs || {})) {
      const bootstrapLedgerWriters = new Set(['ledger_started', 'ledger_provider', 'ledger_terminal']);
      if (name === 'physio-production-bootstrap.yml' && bootstrapLedgerWriters.has(jobName)) {
        assert.deepEqual(job.permissions, { contents: 'write', actions: 'read' },
          `only bootstrap ledger append job ${jobName} may receive exact write authority`);
        const jobSource = JSON.stringify(job);
        assert.match(jobSource, /physio-bootstrap-ledger\.mjs append/);
        assert.doesNotMatch(jobSource, /\$\{\{\s*secrets\./,
          `${jobName} may not receive provider secret values`);
        assert.match(jobSource, /expected-packet-bundle-sha256/,
          `${jobName} must join the producer's exhaustive secret-scan receipt`);
        assert.doesNotMatch(jobSource,
          /\bfly\s+(?:apps|volumes|secrets|machine|deploy|certs|dns)\b|FLY_API_TOKEN.*\bfly\b/,
          `${jobName} must remain a provider-call-free ledger append job`);
        const checkout = job.steps.find((step) => typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@'));
        assert.equal(checkout?.with?.ref, '${{ inputs.application_sha }}');
        assert.equal(checkout?.with?.['persist-credentials'], false);
      } else if (name === 'physio-production-webhook-archive.yml' && jobName === 'archive') {
        assert.deepEqual(job.permissions, { contents: 'write', actions: 'read' },
          'only the webhook archive job may receive exact protected-ledger write authority');
        assert.equal(job.environment, undefined,
          'the protected webhook ledger writer may not receive the production environment');
        const jobSource = JSON.stringify(job);
        assert.doesNotMatch(jobSource, /\$\{\{\s*secrets\.|id-token[^,}]*write/,
          'the protected webhook ledger writer may not receive provider credentials or OIDC');
        assert.doesNotMatch(jobSource,
          /\bfly\s+(?:apps|volumes|secrets|machine|deploy|certs|dns)\b|\bcurl\b|\bgh\s+api\b|\/v1\//,
          'the protected webhook ledger writer must remain provider-call free');
      } else if (name === 'physio-production-deploy.yml') {
        const permissionContract = {
          deploy: { contents: 'read', actions: 'read' },
          archive_deploy_transition: { contents: 'write', actions: 'read' },
          continue_fly_transition: { contents: 'read', actions: 'write' },
          sentry_deployment: { contents: 'read', actions: 'read' },
          archive_sentry_transition: { contents: 'write', actions: 'read' },
          continue_sentry_transition: { contents: 'read', actions: 'write' },
        };
        assert.deepEqual(job.permissions, permissionContract[jobName],
          `deploy job ${jobName} has authority outside its exact role`);
        const jobSource = JSON.stringify(job);
        const providerBearing = job.environment !== undefined || /\$\{\{\s*secrets\./.test(jobSource);
        if (providerBearing) {
          assert.deepEqual(job.permissions, { contents: 'read', actions: 'read' },
            `${jobName} may use provider credentials only with repository/action read authority`);
          assert.doesNotMatch(jobSource, /id-token[^,}]*write|contents[^,}]*write|actions[^,}]*write/,
            `${jobName} may not combine provider authority with repository, dispatch or OIDC write`);
        }
        if (job.permissions?.contents === 'write' || job.permissions?.actions === 'write') {
          assert.equal(job.environment, undefined,
            `${jobName} write barrier may not receive the production environment`);
          assert.doesNotMatch(jobSource, /\$\{\{\s*secrets\.|id-token[^,}]*write/,
            `${jobName} write barrier may not receive provider credentials or OIDC`);
          assert.doesNotMatch(jobSource,
            /actions\/checkout|\bfly\s+(?:apps|volumes|secrets|machine|deploy|certs|dns)\b|\bsentry-cli\b|api\.machines\.dev|sentry\.io\/api/,
            `${jobName} write barrier may not check out or execute a provider command`);
        }
        if (job.permissions?.contents === 'write') {
          assert.equal(job.uses, './.github/workflows/physio-deploy-ledger-archive.yml',
            `${jobName} must call only the fixed protected-ledger writer`);
        }
        if (job.permissions?.actions === 'write') {
          assert.equal(job.uses, './.github/workflows/physio-deploy-continuation.yml',
            `${jobName} must call only the fixed continuation dispatcher`);
        }
      } else if (name === 'physio-production-rollback.yml' && jobName === 'rollback_continue') {
        assert.deepEqual(job.permissions, { contents: 'read', actions: 'write' },
          'rollback continuation receives only dispatch authority');
        assert.equal(job.uses, './.github/workflows/physio-rollback-continuation.yml');
        assert.equal(job.environment, undefined);
        assert.doesNotMatch(JSON.stringify(job), /\$\{\{\s*secrets\.|FLY_API_TOKEN|SENTRY_AUTH_TOKEN|STRIPE_SECRET_KEY/,
          'rollback continuation must remain provider-credential free');
      } else {
        assert.equal(job.permissions, undefined,
          `${name}:${jobName} may not override the reviewed top-level permissions`);
      }
    }
    assert.match(source, /concurrency:\n  group: assesssuite-physio-production\n  cancel-in-progress: false/);
    if (name === 'physio-production-webhook-archive.yml') {
      assert.doesNotMatch(source, /environment:\s*physio-production/,
        'the protected webhook ledger writer must remain outside the production environment');
    } else {
      assert.match(source, /environment: physio-production/);
    }
    assert.match(source, /assesssuite-physio-production/);
    assert.match(source, /refs\/heads\/main/);
    assert.ok(
      source.includes('git ls-remote --exit-code https://github.com/mbvidler-ctrl/assesssuite_migration.git refs/heads/main') ||
        (source.includes('EVENT_SHA') && source.includes('WORKFLOW_SHA') && source.includes('TRUSTED_WORKFLOW_SHA')),
      `${name} does not bind the exact trusted main SHA`,
    );
    if (['physio-production-state-snapshot.yml', 'physio-production-prepare-release.yml',
      'physio-production-deploy.yml', 'physio-production-rollback.yml'].includes(name)) {
      assert.match(source, /node scripts\/physio-release-contract\.mjs validate-source/);
    } else {
      assert.match(source, /artifact-ids: \$\{\{ inputs\.[a-z_]+_artifact_id \}\}/);
    }
    assert.doesNotMatch(source, /(?:registry\.fly\.io\/|app=|application: ')[^\n']*assesssuite-production/);
    assert.doesNotMatch(source, /assesssuite_data_r12|https:\/\/app\.assesssuite\.com/);
    assert.doesNotMatch(source, /\bfly (?:certs (?:add|create|setup)|dns|ips allocate)|cloudflare|route53/i);
    assert.doesNotMatch(source, /continue-on-error:|set -x|set -o xtrace/);
    const actions = [...source.matchAll(/^\s+uses:\s+([^\s#]+)/gm)].map((match) => match[1]);
    assert.ok(actions.length >= 1, `${name} has no pinned action`);
    for (const action of actions) {
      if (action.startsWith('./')) {
        assert.ok(new Set([
          './.github/actions/upload-deploy-ledger-packet',
          './.github/workflows/physio-deploy-ledger-archive.yml',
          './.github/workflows/physio-deploy-continuation.yml',
          './.github/workflows/physio-rollback-continuation.yml',
        ]).has(action), `${name} may call only the reviewed local transport or reusable barriers`);
      } else {
        assert.match(action, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/);
      }
    }
  }

  const deployLedgerCallee = yaml.load(workflow('physio-deploy-ledger-archive.yml'));
  assert.deepEqual(deployLedgerCallee.permissions, { contents: 'read', actions: 'read' });
  assert.deepEqual(deployLedgerCallee.jobs?.archive?.permissions, { contents: 'write', actions: 'read' },
    'the reusable protected-ledger callee must receive exactly its caller-capped permissions');
  const continuationCallee = yaml.load(workflow('physio-deploy-continuation.yml'));
  assert.deepEqual(continuationCallee.permissions, { contents: 'read', actions: 'write' });
  assert.deepEqual(continuationCallee.jobs?.continue?.permissions, { contents: 'read', actions: 'write' },
    'the reusable continuation callee must receive exactly its caller-capped permissions');
  const localTransport = yaml.load(fs.readFileSync(
    path.join(repoRoot, '.github', 'actions', 'upload-deploy-ledger-packet', 'action.yml'), 'utf8'));
  assert.equal(localTransport.runs?.steps?.length, 1,
    'the local deploy-ledger action must remain a transport-only wrapper');
  assert.match(localTransport.runs.steps[0].uses,
    /^actions\/upload-artifact@[0-9a-f]{40}$/,
    'the local transport wrapper must pin its only provider action');
});

test('state snapshot is effect-free and captures stable absent bootstrapped or deployed readback', () => {
  const source = workflow('physio-production-state-snapshot.yml');
  assert.match(source, /SNAPSHOT assesssuite-physio-production READ ONLY/);
  assert.match(source, /expected_state:[\s\S]+- absent\n          - bootstrapped\n          - deployed/);
  assert.match(source, /fly apps list --json/);
  assert.match(source, /fly machines list --app "\$app" --json/);
  assert.match(source, /fly volumes list --app "\$app" --json/);
  assert.match(source, /inspect-no-certificates/);
  assert.match(source, /certificate_mode=absent/);
  assert.match(source, /certificate_mode=production/);
  assert.equal(countOf(source, '--mode "$certificate_mode"'), 3);
  assert.match(source, /assesssuite-physio-state-snapshot\/2\.0\.0/);
  assert.match(source, /provider-state-initial\.json/);
  assert.match(source, /provider-state-final\.json/);
  assert.match(source, /provider_raw_readback_sha256:/);
  assert.match(source, /provider_state_unchanged: true/);
  assert.match(source, /cmp --silent "\$receipt_dir\/provider-state-initial\.json" "\$receipt_dir\/provider-state-final\.json"/);
  assert.doesNotMatch(source, /fly (?:apps create|volumes (?:create|destroy)|secrets|deploy|machine (?:stop|restart|destroy))/);
  assert.equal(countOf(source, '${{ secrets.FLY_API_TOKEN }}'), 1);
});

test('bootstrap consumes the local canary then creates only app volume and pre-webhook secrets', () => {
  const source = workflow('physio-production-bootstrap.yml');
  assert.match(source, /BOOTSTRAP assesssuite-physio-production AFTER CANARY/);
  assert.match(source, /assesssuite-physio-candidate-build\/3\.0\.0/);
  assert.match(source, /physio-exact-image-canary-contract\.mjs validate/);
  assert.match(source, /assesssuite-physio-bootstrap-admission\/1\.0\.0/);
  assert.match(source, /assesssuite-physio-bootstrap-effect-reconciliation\/1\.0\.0/);
  assert.equal(countOf(source, 'fly apps create "$app"'), 1);
  assert.equal(countOf(source, 'fly volumes create assesssuite_physio_data'), 1);
  assert.match(source, /--app "\$app" --region syd --size 3 --snapshot-retention 5 --scheduled-snapshots --json --yes/);
  assert.match(source, /fly secrets import --app "\$app" --stage --dns-checks=false/);
  assert.match(source, /--mode bootstrapped/);
  assert.match(source, /machine_count: 0/);
  assert.match(source, /custom_certificate_count: 0/);
  assert.match(source, /assesssuite-physio-bootstrap\/3\.0\.0/);
  assert.match(source, /production_ready: false/);
  assert.match(source, /webhook_secret_pending: true/);
  assert.match(source, /started_effect_receipt_sha256:/);
  assert.match(source, /secret_bundle_fingerprint_sha256:/);
  assert.match(source, /secret_import_reconciliation:/);
  assert.match(source, /fly_organization_slug:/);
  assert.match(source, /observed_secret_names:/);
  assert.doesNotMatch(source, /fly deploy|docker (?:build|push)|machine (?:run|restart|destroy)/);
  for (const name of [
    'ADMIN_PASSWORD', 'APP_URL', 'OPENAI_API_KEY', 'RESEND_API_KEY', 'SENTRY_DSN',
    'STRIPE_PRICE_ID_ANNUAL', 'STRIPE_PRICE_ID_MONTHLY', 'STRIPE_SECRET_KEY',
  ]) assert.match(source, new RegExp(`'${name}'`));
  assert.doesNotMatch(source, /'STRIPE_WEBHOOK_SECRET'/);
  assert.doesNotMatch(source, /STRIPE_TRIAL_PERIOD_DAYS=%s/, 'trial days must remain non-secret target configuration');
  assert.doesNotMatch(source, /OPENAI_API_KEY=(?:placeholder|mock|fake)|RESEND_API_KEY=(?:placeholder|mock|fake)/i);
});

test('prepare gates EP and Physio then seals one local candidate and same-build Sentry evidence', () => {
  const source = workflow('physio-production-prepare-release.yml');
  assert.match(source, /gates:\n    name:[^\n]+\n    runs-on: ubuntu-24\.04\n    environment: physio-production\n    timeout-minutes: 90/);
  assertInOrder(source, [
    'Admit exact release-state snapshot and source',
    'npm run lint',
    'npm run typecheck',
    'npm run build:platform',
    'npm run build:physio',
    'docker buildx bake --allow="fs.write=$source_maps" --file "$bake" --pull candidate sourcemaps',
    'docker save "$candidate"',
    'candidate-image.oci.tar.gz',
    'Upload immutable candidate core',
    'Reconcile or upload and finalize exact Sentry release',
    'Seal exact candidate release handoff',
    'Upload immutable candidate archive',
  ]);
  assert.match(source, /assesssuite-physio-candidate-build\/3\.0\.0/);
  assert.match(source, /validatePhysioStateSnapshotEvidence/);
  assert.match(source, /assesssuite-physio-sentry-release\/1\.0\.0/);
  assert.match(source, /same_build_source_maps_verified: true/);
  assert.match(source, /oci_descriptor_manifest_sha256:/);
  assert.match(source, /fly_resource_count: 0/);
  assert.doesNotMatch(source, /npm run test:(?:assurance|physio)/,
    'extended assurance runs after first deployment, not inside immutable image preparation');
  assert.doesNotMatch(source, /registry\.fly\.io|docker push|regctl image copy/);
  assert.doesNotMatch(source, /\bfly deploy\b|fly volumes create|fly machine (?:run|restart|stop|destroy)/);
});

test('exact-image canary consumes the sealed local candidate without Fly resources or publication', () => {
  const source = workflow('physio-production-exact-image-canary.yml');
  assert.match(source, /CANARY assesssuite-physio-production LOCAL EXACT IMAGE/);
  assert.match(source, /artifact-ids: \$\{\{ inputs\.candidate_artifact_id \}\}/);
  assert.match(source, /assesssuite-physio-candidate-build\/3\.0\.0/);
  assert.match(source, /docker load/);
  assert.match(source, /node scripts\/physio-exact-image-canary\.mjs produce-local/);
  assert.match(source, /--container-name "assesssuite-physio-canary-\$\{APPLICATION_SHA:0:12\}"/);
  assert.match(source, /--maximum-cost-microusd "\$MAXIMUM_COST_MICROUSD"/);
  assert.match(source, /physio-exact-image-canary-contract\.mjs validate/);
  assert.match(source, /name: physio-exact-image-canary-\$\{\{ inputs\.application_sha \}\}/);
  assert.equal(countOf(source, '${{ secrets.OPENAI_API_KEY }}'), 1);
  assert.equal(countOf(source, '${{ secrets.FLY_API_TOKEN }}'), 0);
  assert.doesNotMatch(source, /publication_artifact|registry\.fly\.io|\bfly(?:ctl)?\b/);
  assert.doesNotMatch(source, /--audio-path|--expected-transcript-marker|cat .*physio-exact-image-canary/);
});

test('first deploy snapshots exact volume proves restore deploys digest verifies Fly host then restarts', () => {
  const source = workflow('physio-production-deploy.yml');
  const canaryContract = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'physio-exact-image-canary-contract.mjs'),
    'utf8',
  );
  const deployAdmission = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'physio-deploy-admission.mjs'),
    'utf8',
  );
  assert.match(source, /physio-exact-image-canary-contract\.mjs validate/);
  assert.match(source, /node scripts\/physio-deploy-admission\.mjs/);
  assert.match(source, /assesssuite-physio-image-publication\/3\.0\.0/);
  assert.match(source, /assesssuite-physio-bootstrap\/3\.0\.0/);
  assert.match(source, /assesssuite-physio-stripe-webhook-bootstrap\/1\.0\.0/);
  assert.match(source, /assesssuite-physio-sentry-release\/1\.0\.0/);
  assert.match(canaryContract, /value\.mode !== 'production-process'/);
  assert.match(canaryContract, /gpt-4\.1-mini-2025-04-14/);
  assert.match(canaryContract, /gpt-4\.1-2025-04-14/);
  assert.match(source, /DEPLOY assesssuite-physio-production FIRST RELEASE EXACT DIGEST/);
  assert.equal(countOf(source, 'fly deploy "$empty_context"'), 1);
  assert.equal(countOf(source, 'fly volumes snapshots create "$EXPECTED_VOLUME_ID"'), 2);
  assert.equal(countOf(source, 'fly volumes create "$restore_name"'), 1);
  assert.match(source, /--snapshot-id "\$postdeploy_snapshot_id"/);
  assert.match(source, /fly volumes destroy "\$restore_volume_id" --app "\$app" --yes/);
  assert.match(source, /--image "\$IMMUTABLE_IMAGE" --strategy immediate --ha=false --dns-checks=false/);
  assert.match(source, /--remote-only --skip-release-command --yes/);
  assertInOrder(source, [
    'fly volumes snapshots create "$EXPECTED_VOLUME_ID"',
    'fly deploy "$empty_context"',
    'fly_base/api/health/live',
    'physio-restore-verify.mjs manifest',
    'fly machine stop "$machine_id"',
    'machines-quiesced.json',
    'postdeploy-snapshot-create.json',
    'fly volumes create "$restore_name"',
    'physio-restore-verify.mjs verify',
    'destroy_restore_machine_exactly',
    'destroy_restore_volume_exactly',
    'fly machine start "$machine_id"',
    'request_body="$DEPLOY_WORK/restart-update-request-effect.json"',
    'buildRestartUpdate,classifyRestartReadback',
    'https://api.machines.dev/v1/apps/assesssuite-physio-production',
    'certificates-final.json',
    'custom_dns_deferred_until_after_fly_hostname: true',
  ]);
  assert.doesNotMatch(source, /fly machine restart "\$machine_id"/,
    'the unmarked restart command cannot be reconciled after response loss');
  for (const marker of [
    'observed_config_without_restart_sha256',
    'observed_machine_instance_id', 'observed_machine_updated_at',
    'observed_events_sha256', 'provider_mutation_calls_attempted',
    'provider_mutation_calls_confirmed',
  ]) assert.ok(source.includes(marker), `durable Machines API restart evidence is missing ${marker}`);
  const restartContract = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'physio-fly-restart-contract.mjs'), 'utf8');
  assert.match(restartContract,
    /RESTART_MARKER_KEY = 'assesssuite_restart_intent_sha256'/,
    'the exact Machines API update must carry its deterministic restart intent marker');
  const releaseContract = fs.readFileSync(
    path.join(repoRoot, 'scripts', 'physio-release-contract.mjs'), 'utf8');
  assert.match(releaseContract, /observed_machine_events_sha256/,
    'restart admission must bind the canonical machine event history readback');
  assert.match(source, /machine_count: 1, volume_count: 1/);
  assert.doesNotMatch(source, /rollback_failed_first_release/,
    'a monolithic failure trap would bypass the append-only per-mutation phase ledger');
  for (const marker of [
    'prepare_operation()',
    'complete_operation()',
    'classify_provider()',
    'write-deploy-provider-request',
    'write-deploy-started-packet',
    'validate-deploy-resume-packet',
    'advance-deploy-packet',
    'STARTED_UNRESOLVED',
    'AMBIGUOUS',
    'APPLIED',
    'NOT_APPLIED',
    'RETRY_STARTED',
  ]) assert.ok(source.includes(marker),
    `durable deploy response-loss corridor is missing ${marker}`);
  assert.match(source,
    /if \[\[ "\$disposition" == APPLIED \]\]; then[\s\S]*call_needed=false/,
    'a reconciled applied subeffect must advance without replaying the provider call');
  assert.match(source,
    /if \[\[ "\$disposition" == NOT_APPLIED \]\]; then[\s\S]*call_needed=true/,
    'a reconciled non-applied subeffect must retain the same effect and explicitly admit one retry');
  assert.match(source,
    /STARTED_UNRESOLVED is continued only after an exact provider readback from machines, volumes, and snapshots/,
    'an unresolved deploy phase must not resume without complete authoritative provider readback');
  assert.match(source, /artifact-ids: \$\{\{ inputs\.canary_artifact_id \}\}/);
  assert.match(source, /artifact-ids: \$\{\{ inputs\.production_bootstrap_artifact_id \}\}/);
  assert.match(deployAdmission, /row\.production_ready_for_publication !== true/);
  assert.match(deployAdmission, /row\.production_ready !== false/);
  assert.match(deployAdmission, /row\.webhook_secret_pending !== true/);
  assert.match(deployAdmission, /JSON\.stringify\(row\.staged_secret_names\)/,
    'deploy admission must bind the exact pre-webhook bootstrap secret-name set');
  assert.match(deployAdmission, /fly_secret_names_readback_sha256/,
    'deploy admission must bind the post-webhook Fly secret-name readback');
  assert.match(source, /production_bootstrap_receipt_sha256:/);
  for (const taskId of [
    'physio.initial_assessment_summary.v1',
    'physio.soap_note.v1',
    'physio.management_plan.v1',
    'physio.progress_comparison.v1',
    'physio.referrer_update.v1',
    'physio.discharge_summary.v1',
  ]) assert.match(canaryContract, new RegExp(taskId.replaceAll('.', '\\.')));
  assert.match(canaryContract, /validateProviderBase\(value\.success, 'transcription', 'audio'\)/);
  assert.match(canaryContract, /validateFault\(value\.fault, 'transcription'\)/);
  assert.match(canaryContract, /validateProviderBase\(value\.success, 'extraction', 'document'\)/);
  assert.match(canaryContract, /validateFault\(value\.fault, 'extraction'\)/);
  assert.match(canaryContract, /sha\(value\.provider_request_id/);
  assert.match(canaryContract, /positiveInteger\(value\.usage_delta\.request_units/);
  assert.match(canaryContract, /sha\(value\.provider_response_sha256/);
  assert.match(canaryContract, /receipt\.production_mock_scan_passed !== true/);
  assert.match(
    source,
    /exact_image_canary_receipt_sha256\s*:\s*process\.env\.CANARY_RECEIPT_SHA256/,
  );
  assert.equal(countOf(source, 'fly machine run "$IMMUTABLE_IMAGE"'), 2);
  assert.match(source, /assesssuite-physio-restore-\$\{APPLICATION_SHA:0:12\}/);
  const restoreBlock = between(
    source,
    '# The clone is not proof until the exact candidate image mounts it',
    '\n          destroy_restore_machine_exactly',
  );
  assertIsolatedRestoreVerifierBlock(restoreBlock, {
    imageVariable: 'IMMUTABLE_IMAGE',
    role: 'physio-deploy-verifier',
  });
  assertInOrder(restoreBlock, [
    'fly machine run "$IMMUTABLE_IMAGE"',
    'fly machine exec "$verifier_id"',
    'physio-restore-verify.mjs verify',
    'complete_operation RESTORE_VERIFIED RESTORE_VERIFIER_EXEC',
  ]);
  const restoreCleanupAndPass = source.slice(source.indexOf('\n          destroy_restore_machine_exactly', source.indexOf('# The clone is not proof')));
  assertInOrder(restoreCleanupAndPass, [
    'destroy_restore_machine_exactly',
    'destroy_restore_volume_exactly',
    'prepare_operation VERIFIER_MACHINE_STOP_STARTED VERIFIER_MACHINE_STOPPED RESTORE_VERIFIER_MACHINE_STOP',
    'complete_operation VERIFIER_MACHINE_STOPPED RESTORE_VERIFIER_MACHINE_STOP',
    'prepare_operation VERIFIER_MACHINE_DESTROY_STARTED VERIFIER_MACHINE_DESTROYED RESTORE_VERIFIER_MACHINE_DESTROY',
    'complete_operation VERIFIER_MACHINE_DESTROYED RESTORE_VERIFIER_MACHINE_DESTROY',
    'prepare_operation RESTORE_VOLUME_DESTROY_STARTED RESTORE_VOLUME_DESTROYED RESTORE_VOLUME_DESTROY',
    'complete_operation RESTORE_VOLUME_DESTROYED RESTORE_VOLUME_DESTROY',
    'prepare_operation MACHINE_START_STARTED MACHINE_STARTED PRODUCTION_MACHINE_START',
    'complete_operation MACHINE_STARTED PRODUCTION_MACHINE_START',
    'prepare_operation RESTART_STARTED POST_RESTART_VERIFIED PRODUCTION_MACHINE_RESTART',
    'complete_operation POST_RESTART_VERIFIED PRODUCTION_MACHINE_RESTART',
    "contract_version: 'assesssuite-physio-deploy/3.0.0', result: 'PASS'",
  ]);
  assert.match(source,
    /prepare_operation RESTORE_VERIFY_STARTED RESTORE_VERIFIED RESTORE_VERIFIER_EXEC/);
  for (const proof of [
    "contract_version!=='assesssuite-physio-restore-verification/2.0.0'",
    'row.data_manifest_sha256 !== process.env.MANIFEST',
    'row.database_read_only!==true',
    'row.provider_credentials_absent !== true',
    "row.schema_digest !== 'sha256:9e0ccdab32367a91151d78830eb115dc92c0bdea7f3cdaa85ce906cf10c8c575'",
    'row.schema_object_count!==115',
    'row.schema_table_count!==38',
    'row.data_manifest_table_count!==38',
    'row.catalogue_count !== Number(process.env.PHYSIO_EXPECTED_CATALOGUE_COUNT)',
    'row.catalogue_checksum !== process.env.PHYSIO_EXPECTED_CATALOGUE_CHECKSUM',
  ]) assert.ok(source.includes(proof), `restore phase is missing exact proof ${proof}`);
  assert.match(source,
    /prepare_operation RESTART_STARTED POST_RESTART_VERIFIED PRODUCTION_MACHINE_RESTART/);
  assert.match(source,
    /complete_operation POST_RESTART_VERIFIED PRODUCTION_MACHINE_RESTART "\$status" "\$receipt" post-restart/);
  for (const proof of [
    "contract_version:'assesssuite-physio-machine-restart-operation/2.0.0'",
    "provider_mutation_calls_confirmed:outcome?.disposition==='APPLIED'?1:0",
    'provider_mutation_responses_received:mutation?1:0',
    'runtime_live_sha256:h(process.env.LIVE)',
    'runtime_ready_sha256:h(process.env.READY)',
    'runtime_version_sha256:h(process.env.VERSION)',
    'runtime_capabilities_sha256:h(process.env.CAPABILITIES)',
  ]) assert.ok(source.includes(proof), `restart phase is missing exact proof ${proof}`);
  assertInOrder(source, [
    'advance_packet "$DEPLOY_PACKET" "$next" DEPLOY_COMPLETED COMPLETED',
    'validate-deploy-resume-packet',
    '== DEPLOY_COMPLETED',
    'phase_result="$result/deploy-phase-packet"',
    '(cd "$DEPLOY_PACKET" && sha256sum --check --strict SHA256SUMS)',
    '(cd "$phase_result" && sha256sum --check --strict SHA256SUMS)',
    'phase_packet_manifest_hash=',
    'deploy_effect_reconciliation_sha256:process.env.EFFECT_HASH',
    'deploy_phase_packet_manifest_sha256:process.env.PHASE_PACKET_MANIFEST_HASH',
    "find . -type f ! -path './SHA256SUMS'",
    'sha256sum --check --strict SHA256SUMS',
  ]);
});

test('rollback preserves a snapshot restore proof and supports exact digest or first-release stop', () => {
  const source = workflow('physio-production-rollback.yml');
  assert.match(source, /exact-image/);
  assert.match(source, /stop-first-release/);
  assert.match(source, /git merge-base --is-ancestor "\$ROLLBACK_RELEASE_SHA" "\$TRUSTED_WORKFLOW_SHA"/);
  assert.match(source, /fly volumes snapshots create "\$EXPECTED_VOLUME_ID"/);
  assert.match(source, /fly volumes create "\$restore_name"/);
  assert.doesNotMatch(source, /fly volumes destroy "\$restore_volume_id"/);
  assert.match(source, /volumes\/\$restore_volume_id\?force=false/);
  assert.match(source, /executeFullMachineConfigTransition/);
  assert.match(source, /execute_config_transition "\$LIVE_MUTATION_PRESTATE" "\$ROLLBACK_TARGET_MACHINE_CONFIG"/);
  assert.match(source, /execute_config_transition "\$recovery_prestate" "\$CURRENT_MACHINE_CONFIG"/);
  assert.match(source, /rollback-live-mutation-prestate\.json/);
  assert.match(source, /rollback-current-machine-config\.json/);
  assert.match(source, /rollback-machine-config-transition-operation\.json/);
  assert.match(source, /rollback-machine-config-recovery-operation/);
  assert.match(source, /fly machine stop "\$EXPECTED_MACHINE_ID"/);
  assert.doesNotMatch(source, /fly machine restart "\$result_machine_id"/);
  assert.match(source, /data_action: 'preserved-isolated-volume'/);
  assert.match(source, /dns_action: 'separate-capability-not-performed'/);
  assert.equal(countOf(source, 'fly machine run "$CURRENT_IMMUTABLE_IMAGE"'), 1);
  assert.equal(countOf(source, 'fly machine run "$ROLLBACK_IMMUTABLE_IMAGE"'), 1);
  assert.match(source, /assesssuite-physio-rollback-restore-\$\{FAILED_APPLICATION_SHA:0:12\}/);
  const restoreBlock = between(
    source,
    '(cd "$verifier_context" && timeout',
    '\n          destroy_restore_machine_exactly',
  );
  assertIsolatedRestoreVerifierBlock(restoreBlock, {
    imageVariable: 'CURRENT_IMMUTABLE_IMAGE',
    role: 'physio-rollback-verifier',
  });
  assertInOrder(restoreBlock, [
    'fly machine run "$CURRENT_IMMUTABLE_IMAGE"',
    'fly machine exec "$restore_machine_id"',
    'physio-restore-verify.mjs verify',
    'restore_verification_receipt_sha256=',
  ]);
  const restoreCleanupAndMutation = source.slice(source.indexOf('\n          destroy_restore_machine_exactly', source.indexOf('(cd "$verifier_context"')));
  assertInOrder(restoreCleanupAndMutation, [
    'destroy_restore_machine_exactly',
    'rollback-target-verifier',
    'rollback_target_clone_validated=1',
    'remaining_seconds',
    'mutation_started=1',
  ]);

  const restartProof = source.slice(source.indexOf('exact_machine="$work/machine-before-readiness-exact.json"'));
  assertInOrder(restartProof, [
    'exact_machine="$work/machine-before-readiness-exact.json"',
    'machineConfigSha256(machine.config)!==machineConfigSha256(expected)',
    'live-post-restart.json',
    'ready-post-restart.json',
    'version-post-restart.json',
    'capabilities-post-restart.json',
    'validate-runtime',
    'machines-post-restart.json',
    'volumes-post-restart.json',
    'inspect-topology',
    'machine-post-restart-final-exact.json',
    "contract_version: 'assesssuite-physio-rollback-post-restart/2.0.0'",
    'post_restart_proof_sha256=',
    'Prepare rollback RESTORE_VOLUME_CLEANUP phase intent',
    'Upload rollback RESTORE_VOLUME_CLEANUP STARTED effect before provider mutation',
    'Execute isolated rollback RESTORE_VOLUME_CLEANUP transition',
    "contract_version: 'assesssuite-physio-rollback/3.0.0', result: 'PASS'",
  ]);
  const postRestartBlock = between(source,
    '- name: Execute rollback POST_RESTART_VERIFIED read-only exact-config persistence phase',
    '- name: Upload rollback POST_RESTART_VERIFIED receipt before terminal finalization');
  assert.doesNotMatch(postRestartBlock, /method:'DELETE'|volumes destroy|provider-calls 1/);
  assert.match(postRestartBlock,
    /--phase POST_RESTART_VERIFIED --result COMPLETED --provider-calls 0/);
  const cleanupBlock = between(source,
    '- name: Execute isolated rollback RESTORE_VOLUME_CLEANUP transition',
    '- name: Upload rollback RESTORE_VOLUME_CLEANUP receipt before terminal finalization');
  assertInOrder(cleanupBlock, [
    'fly machines list --app "$app" --json >"$work/machines-before.json"',
    'fly volumes list --app "$app" --json >"$work/volumes-before.json"',
    'fresh cleanup cannot adopt an absent restore volume',
    'REQUEST_URL="https://api.machines.dev/v1/apps/$app/volumes/$restore_volume_id?force=false"',
    'method:\'DELETE\'',
    'fly volumes list --app "$app" --json >"$work/volumes-after.json"',
    '--phase RESTORE_VOLUME_CLEANUP --result COMPLETED',
    '--provider-calls 1',
  ]);
  assert.equal(countOf(cleanupBlock, 'await fetch(process.env.REQUEST_URL'), 1);
  assert.match(cleanupBlock, /response_received:false/);
  assert.match(cleanupBlock, /STARTED_UNRESOLVED/);
  for (const field of [
    'presnapshot_manifest_contract_version', 'presnapshot_manifest_receipt_sha256',
    'logical_data_manifest_contract_version', 'logical_data_manifest_sha256',
    'logical_data_table_count', 'snapshot_sentinel_sha256',
    'sqlite_schema_contract_version', 'sqlite_schema_digest', 'sqlite_schema_object_count',
    'sqlite_schema_table_count', 'sqlite_user_version', 'production_machine_stopped_before_snapshot',
    'restore_clone_mounted', 'restore_database_verified', 'restore_verifier_machine_destroyed',
    'primary_topology_and_recovery_reserve_verified_before_rollback', 'restore_verification_receipt_sha256',
    'restore_verifier_machine_id_sha256', 'post_restart_runtime_verified',
    'post_restart_identity_verified', 'post_restart_topology_verified',
    'post_restart_proof_contract_version', 'post_restart_proof_sha256',
    'rollback_target_clone_preflight_verified', 'rollback_target_verification_receipt_sha256',
    'rollback_target_verifier_machine_id_sha256', 'recovery_reserve_seconds',
    'failed_rollback_recovery_path_armed', 'restore_volume_cleanup_phase_sha256',
  ]) assert.match(source, new RegExp(`${field}:`));
  assert.match(source, /post_restart_runtime_verified: exactImageMode/);
  assert.match(source, /post_restart_proof_sha256: exactImageMode \? process\.env\.POST_RESTART_PROOF_SHA : null/);
  assert.match(source, /receipt_files=\(physio-rollback-presnapshot-manifest\.json physio-rollback-restore-verification\.json rollback-restore-verifier-provider-readback\.json\)/);
  assert.match(source, /receipt_files\+=\(physio-rollback-target-verification\.json rollback-target-verifier-provider-readback\.json/);
  assert.match(source, /physio-rollback-post-restart-proof\.json runtime-live-post-restart\.json/);
  assert.match(source, /contract_version: 'assesssuite-physio-rollback-recovery\/1\.0\.0', result: 'PASS'/);
  assert.match(source, /recovery_status=RECOVERY_FAILED/);
  assert.match(source, /service_stopped: serviceStopped/);
  assert.match(source, /provider_readback_complete: providerReadbackComplete/);
  assert.match(source, /contract_version: 'assesssuite-physio-rollback\/3\.0\.0', result: 'FAILED'/);
});

test('rollback cleanup continuation is provider-free exact-artifact and response-loss safe', () => {
  const rollback = workflow('physio-production-rollback.yml');
  const continuation = workflow('physio-rollback-continuation.yml');
  assert.match(rollback,
    /needs\.rollback_start\.outputs\.resume_phase == 'POST_RESTART_VERIFIED'.*'RESTORE_VOLUME_CLEANUP'/);
  assert.match(rollback, /needs\.rollback_phases\.outputs\.continuation_artifact_id/);
  assert.match(rollback, /restore_volume_cleanup_receipt_sha256s\.length>=3/);
  assert.match(rollback, /uses: \.\/\.github\/workflows\/physio-rollback-continuation\.yml/);
  assert.match(continuation, /permissions:\n\s+contents: read\n\s+actions: write/);
  assert.doesNotMatch(continuation, /\$\{\{\s*secrets\./);
  assert.doesNotMatch(continuation, /\bfly\s|api\.machines\.dev|sentry\.io\/api|stripe\.com/);
  assert.match(continuation, /row\.total_count!==total/);
  assert.match(continuation, /seen\.has\(run\.id\)/);
  assert.match(continuation, /observed!==total/);
  assert.match(continuation, /matches\.length>1/);
  assert.match(continuation, /dispatch_responses_confirmed:confirmed/);
  assert.match(continuation, /resume_rollback_effect_artifact_digest/);
  assert.match(continuation, /resume_rollback_effect_receipt_sha256/);
});

test('restore workflow contract rejects provider-capable or service-exposed verifier mutations', () => {
  for (const [name, start, end, imageVariable, role] of [
    [
      'physio-production-deploy.yml',
      '# The clone is not proof until the exact candidate image mounts it',
      '\n          destroy_restore_machine_exactly',
      'IMMUTABLE_IMAGE',
      'physio-deploy-verifier',
    ],
    [
      'physio-production-rollback.yml',
      '(cd "$verifier_context" && timeout',
      '\n          destroy_restore_machine_exactly',
      'CURRENT_IMMUTABLE_IMAGE',
      'physio-rollback-verifier',
    ],
  ]) {
    const block = between(workflow(name), start, end);
    assertIsolatedRestoreVerifierBlock(block, { imageVariable, role });
    for (const corrupted of [
      block.replace("--env 'GENERAL_CLINICAL_LLM_ENABLED=0'", "--env 'GENERAL_CLINICAL_LLM_ENABLED=1'"),
      block.replace("--env 'SELFTEST=0'", "--env 'SELFTEST=1'"),
      block.replace('--skip-dns-registration', '--port 8080'),
      block.replace('-u OPENAI_API_KEY', ''),
    ]) {
      assert.throws(
        () => assertIsolatedRestoreVerifierBlock(corrupted, { imageVariable, role }),
        assert.AssertionError,
      );
    }
  }
});

test('R1 comparison deployment is immutable, snapshot-isolated, fully tested and non-billing', () => {
  const source = workflow('physio-r1-comparison-deploy.yml');
  assert.match(source, /APP: assesssuite-physio-r1/);
  assert.match(source, /R1_BASELINE_SHA: ba47570e3c09279cedb1ee37c9dfa374b6cba178/);
  assert.match(source, /R1_FOUNDATION_SHA: d17eac5627ed104bdb6cc79007c6c5e83df3fe11/);
  assert.match(source, /R1_ORIGIN_FIX_SHA: 2f0f3946c1a0f57d31f0f97fe04aed03e3a210fe/);
  assert.match(source, /R1_RUNTIME_FIX_SHA: 073d1914c8696a6fa4357752c1d30f670e4dc761/);
  assert.match(source, /R1_PRE_STAGE2_SHA: 8237e6518bd739db24711e1d4ee70b3e4c3f9d36/);
  assert.match(source, /R1_STAGE2_FOUNDATION_SHA: 68f277e6511440232ed299402cc42c598110ca65/);
  assert.match(source, /R1_STAGE2_FUNCTIONAL_SHA: 553b6ea49628d6e434eb852f61ce20c353d77eec/);
  assert.match(source, /R1_COMPARISON_SHA: 27cec6656472788f491cdb447c996bcf4a0b4bb1/);
  assert.match(source, /R1_SNAPSHOT_ID: vs_kmp35PK891uLO2MA74/);
  assert.match(source, /R1_SNAPSHOT_DIGEST: 1004f97fb148027c6ef04598860723d1583db984e54c843fa938e6b7e64d2ac6/);
  assert.match(source, /R1_VOLUME_ID: vol_vgn67klw1jq1km04/);
  assert.match(source, /R1_VOLUME_NAME: assesssuite_physio_r1_data/);
  assert.match(source, /R1_CATALOGUE_COUNT: "236"/);
  assert.match(source, /R1_CATALOGUE_CHECKSUM: c39fd9e75054857d7f642c8fc2210446781d247e44c751b04499db749bfaa56f/);
  assert.match(source, /ref: \$\{\{ env\.R1_COMPARISON_SHA \}\}/);
  assert.match(source, /git rev-parse HEAD\^\^\^\^\^\^\^/);
  assert.match(source, /ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY/);
  assert.match(source, /secrets\.FLY_API_TOKEN_R1/);
  assert.match(source, /npm audit --audit-level=high/);
  assert.match(source, /npm run test:physio/);
  assert.match(source, /npm run test:physio-offline-journey/);
  assert.match(source, /npm run build:physio/);
  assert.match(source, /\.catalogue\.count == \$count/);
  assert.match(source, /\.catalogue\.checksum == \$checksum/);
  assert.match(source, /attached_machine_id \/\/ ""/);
  assert.match(source, /for attempt in \$\(seq 1 24\)/);
  assert.match(source, /\.Status == "deployed"/);
  assert.match(source, /provision-physio-r1-comparison-access\.mjs --apply/);
  assert.match(source, /provision-physio-r1-comparison-access\.mjs --inspect/);
  assert.match(source, /\.all_access_paths_ready == true/);
  assert.match(source, /"\$register_status" == "403"/);
  assert.match(source, /\(\.message \/\/ \.error\) == "self-registration is disabled for this deployment"/);
  assert.match(source, /flyctl deploy --app "\$APP" --config fly\.physio\.r1-comparison\.toml/);
  assert.match(source, /--label "ASSESSSUITE_SOURCE_SHA=\$R1_COMPARISON_SHA"/);
  assert.match(source, /image_ref\.labels\.ASSESSSUITE_SOURCE_SHA == \$sha/);
  assert.match(source, /open_registration: false/);
  assert.match(source, /payments_enabled: false/);
  assert.doesNotMatch(source, /\$\{\{ secrets\.STRIPE_/);
  assertInOrder(source, [
    '- name: Prove complete R1 assessment and application test surface',
    '- name: Prove isolated restored volume before deployment',
    '- name: Stage only non-billing R1 comparison secrets',
    '- name: Deploy exact R1 comparison source onto restored volume',
    '- name: Prove exact live release, readiness, and isolation',
    '- name: Provision and prove restricted comparison access',
  ]);
});

test('restricted-owner workflow activates Maxwell and provider-invites Brenton on the exact R3 release', () => {
  const source = workflow('physio-production-provision-owners.yml');
  assert.match(source, /MAXWELL_EMAIL: mb\.vidler@gmail\.com/);
  assert.match(source, /BRENTON_EMAIL: brenton@primehealthclinics\.com/);
  assert.match(source, /ORGANIZATION_NAME: AssessSuite Physio/);
  assert.match(source, /ref: \$\{\{ inputs\.application_sha \}\}/);
  assert.match(source, /image_ref\.labels\.GH_SHA == \$sha/);
  assert.match(source, /config\.env\.ALLOW_OPEN_REGISTRATION == "0"/);
  assert.match(source, /provision-physio-restricted-owners\.mjs --apply/);
  assert.match(source, /provision-physio-restricted-owners\.mjs --inspect/);
  assert.match(source, /\.all_targets_accounted_for == true/);
  assert.match(source, /\.state == "active-owner" or \.state == "invited-owner"/);
  assert.match(source, /"\$status" == "403"/);
  assert.doesNotMatch(source, /ADMIN_PASSWORD|STRIPE_SECRET_KEY|--password/);
  assertInOrder(source, [
    '- name: Prove the exact deployed R3 machine before access mutation',
    '- name: Preview exact owner transition without mutation',
    '- name: Activate Maxwell and issue Brenton owner invitation',
    '- name: Inspect persisted owner and invitation state',
    '- name: Prove public registration remains unavailable',
  ]);
});
