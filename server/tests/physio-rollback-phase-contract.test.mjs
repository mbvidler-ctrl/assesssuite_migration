import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  PHYSIO_ROLLBACK_EFFECT_RECONCILIATION_CONTRACT_VERSION,
  PHYSIO_ROLLBACK_PHASES,
  readAndValidatePhysioRollbackResumePacket,
} from '../../scripts/physio-release-contract.mjs';
import { buildFullMachineConfigUpdate, machineConfigSha256, machineEventsSha256,
  machineStateSha256 } from '../../scripts/physio-fly-machine-config-transition.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const options = Object.freeze({
  failedApplicationSha: '1'.repeat(40),
  currentImmutableImage: `registry.fly.io/assesssuite-physio-production@sha256:${'2'.repeat(64)}`,
  rollbackMode: 'exact-image',
  rollbackReleaseSha: '3'.repeat(40),
  rollbackImmutableImage: `registry.fly.io/assesssuite-physio-production@sha256:${'4'.repeat(64)}`,
  rollbackTargetArtifactId: '1234',
  rollbackTargetArtifactDigest: `sha256:${'5'.repeat(64)}`,
  rollbackTargetReceiptSha256: '6'.repeat(64),
  expectedMachineId: 'a'.repeat(14),
  expectedVolumeId: 'vol_Physio123',
  capabilityIntentId: 'capability:physio:rollback:unit',
  authorityReference: 'UM-AUTO-20260821-test',
});

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function providerReadback(phase, overrides = {}) {
  const empty = sha256('');
  return {
    contract_version: 'assesssuite-physio-rollback-provider-readback/1.0.0',
    result: phase === 'STARTED' ? 'NOT_OBSERVED' : 'PASS',
    application: 'assesssuite-physio-production',
    phase,
    machines_sha256: empty,
    volumes_sha256: empty,
    snapshots_sha256: empty,
    observed_config_sha256: empty,
    machine_config_operation_receipt_sha256s: [],
    machine_config_recovery_prestate_sha256s: [],
    machine_config_recovery_receipt_sha256s: [],
    restore_volume_cleanup_receipt_sha256s: [],
    machine_count: 0,
    volume_count: 0,
    snapshot_count: 0,
    observed_machine_id: null,
    observed_machine_state: null,
    observed_image: null,
    observed_volume_id: null,
    observed_restore_volume_id: null,
    observed_verifier_machine_id: null,
    observed_snapshot_id: null,
    readback_at: '2026-08-22T00:00:00.000Z',
    ...overrides,
  };
}

function effectRow({ phase, ordinal, predecessor, providerSha, packetOptions = options, overrides = {} }) {
  const providerEffectId = `rollback:test:${ordinal}`;
  const operations = {
    STARTED: 'PLAN_ADMITTED',
    SNAPSHOT_COMPLETED: 'SAFETY_SNAPSHOT',
    RESTORE_VERIFIED: 'RESTORE_VERIFY',
    TARGET_VERIFIED: 'TARGET_VERIFY',
    LIVE_MUTATION_STARTED: 'LIVE_IMAGE_CONFIG_RESTORE',
    POST_RESTART_VERIFIED: 'EXACT_CONFIG_READINESS',
    RESTORE_VOLUME_CLEANUP: 'RESTORE_VOLUME_CLEANUP',
    COMPLETED: 'FINALIZE',
  };
  return {
    contract_version: PHYSIO_ROLLBACK_EFFECT_RECONCILIATION_CONTRACT_VERSION,
    result: ordinal === 0 ? 'STARTED' : 'COMPLETED',
    phase,
    phase_ordinal: ordinal,
    application: 'assesssuite-physio-production',
    failed_application_sha: packetOptions.failedApplicationSha,
    current_immutable_image: packetOptions.currentImmutableImage,
    rollback_mode: packetOptions.rollbackMode,
    rollback_release_sha: packetOptions.rollbackReleaseSha,
    rollback_immutable_image: packetOptions.rollbackImmutableImage,
    rollback_target_artifact_id: packetOptions.rollbackTargetArtifactId,
    rollback_target_artifact_digest: packetOptions.rollbackTargetArtifactDigest,
    rollback_target_receipt_sha256: packetOptions.rollbackTargetReceiptSha256,
    rollback_target_config_sha256: '',
    rollback_target_machine_config_sha256: '',
    rollback_target_admission_sha256: '',
    expected_machine_id: packetOptions.expectedMachineId,
    expected_volume_id: packetOptions.expectedVolumeId,
    capability_intent_id: packetOptions.capabilityIntentId,
    authority_reference: packetOptions.authorityReference,
    provider_effect_id: providerEffectId,
    predecessor_phase_receipt_sha256: predecessor,
    provider_readback_sha256: providerSha,
    provider_operation: operations[phase],
    provider_operation_id_sha256: sha256(`${providerEffectId}:${phase}:${operations[phase]}`),
    provider_calls_executed: ordinal === 0 ? 0 : 1,
    initial_machine_state: ordinal === 0 ? 'unknown' : 'started',
    snapshot_id: null,
    restore_volume_id: null,
    verifier_machine_id: null,
    result_machine_id: null,
    result_volume_id: null,
    observed_image: null,
    started_at: '2026-08-22T00:00:00.000Z',
    completed_at: ordinal === 0 ? null : '2026-08-22T00:01:00.000Z',
    ...overrides,
  };
}

function buildPacket({ phaseCount = 1, rollbackMode = 'exact-image', includeRecovery = false,
  includeTransitionRetry = false, mutate } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-rollback-contract-'));
  const firstReleaseStop = rollbackMode === 'stop-first-release';
  const optionSeed = firstReleaseStop
    ? {
        ...options,
        rollbackMode,
        rollbackReleaseSha: 'NOT-AVAILABLE',
        rollbackImmutableImage: 'NOT-AVAILABLE',
        rollbackTargetArtifactId: '0',
        rollbackTargetArtifactDigest: '0',
        rollbackTargetReceiptSha256: '0'.repeat(64),
      }
    : options;
  const configBytes = Buffer.from('app = "assesssuite-physio-production"\n');
  const machineConfigBytes = jsonBytes(firstReleaseStop ? {
    image: optionSeed.currentImmutableImage,
  } : {
    image: optionSeed.rollbackImmutableImage,
    env: { PROFESSION: 'physio', DEFAULT_APP_ID: 'local-assesssuite-physio' },
    metadata: { assesssuite_restart_intent_sha256: '7'.repeat(64) },
    mounts: [{ volume: optionSeed.expectedVolumeId, path: '/app/server/data' }],
    guest: { cpus: 1, memory_mb: 512 },
  });
  const notApplicable = {
    contract_version: 'assesssuite-physio-not-applicable/1.0.0',
    result: 'NOT_APPLICABLE',
    reason: 'stop-first-release',
  };
  const sourceDeployReceiptBytes = firstReleaseStop
    ? jsonBytes(notApplicable)
    : jsonBytes({
        contract_version: 'assesssuite-physio-deploy/3.0.0',
        result: 'PASS',
        application: 'assesssuite-physio-production',
        application_sha: optionSeed.rollbackReleaseSha,
        immutable_image: optionSeed.rollbackImmutableImage,
        rollback_target_config_sha256: sha256(configBytes),
        rollback_target_machine_config_sha256: sha256(machineConfigBytes),
      });
  const packetOptions = Object.freeze({
    ...optionSeed,
    rollbackTargetReceiptSha256: firstReleaseStop ? '0'.repeat(64) : sha256(sourceDeployReceiptBytes),
  });
  const githubAdmissionBytes = firstReleaseStop
    ? jsonBytes(notApplicable)
    : jsonBytes({
        contract_version: 'assesssuite-github-artifact-admission/1.0.0',
        result: 'PASS',
        repository: 'mbvidler-ctrl/assesssuite_migration',
        application_sha: packetOptions.rollbackReleaseSha,
        artifacts: {
          rollback_target: {
            id: Number(packetOptions.rollbackTargetArtifactId),
            name: `physio-deploy-${packetOptions.rollbackReleaseSha}-1`,
            digest: packetOptions.rollbackTargetArtifactDigest,
            expired: false,
            size_in_bytes: 4096,
            maximum_bytes: 67108864,
            workflow_run_id: 987,
            workflow_run_head_sha: packetOptions.rollbackReleaseSha,
            workflow_run_head_branch: 'main',
            workflow_run_path: '.github/workflows/physio-production-deploy.yml',
            workflow_run_event: 'workflow_dispatch',
            workflow_run_conclusion: 'success',
            repository: 'mbvidler-ctrl/assesssuite_migration',
          },
        },
        admitted_at: '2026-08-22T00:00:00.000Z',
      });
  const admissionBytes = jsonBytes({
    contract_version: 'assesssuite-physio-rollback-target-admission/1.0.0',
    result: 'PASS',
    application: 'assesssuite-physio-production',
    application_sha: packetOptions.rollbackReleaseSha,
    immutable_image: packetOptions.rollbackImmutableImage,
    rollback_target_artifact_id: packetOptions.rollbackTargetArtifactId,
    rollback_target_artifact_digest: packetOptions.rollbackTargetArtifactDigest,
    rollback_target_receipt_sha256: packetOptions.rollbackTargetReceiptSha256,
    rollback_target_config_sha256: sha256(configBytes),
    rollback_target_machine_config_sha256: sha256(machineConfigBytes),
    source_receipt_contract_version: firstReleaseStop ? 'NOT-AVAILABLE' : 'assesssuite-physio-deploy/3.0.0',
    source_workflow_path: '.github/workflows/physio-production-deploy.yml',
    source_workflow_run_id: firstReleaseStop ? 0 : 987,
    source_workflow_head_sha: firstReleaseStop ? 'NOT-AVAILABLE' : packetOptions.rollbackReleaseSha,
    github_artifact_admission_sha256: sha256(githubAdmissionBytes),
    source_deploy_receipt_file_sha256: sha256(sourceDeployReceiptBytes),
    admitted_at: '2026-08-22T00:00:00.000Z',
  });
  const files = new Map([
    ['rollback-target-config.toml', configBytes],
    ['rollback-target-github-artifact-admission.json', githubAdmissionBytes],
    ['rollback-target-machine-config.json', machineConfigBytes],
    ['rollback-target-source-deploy-receipt.json', sourceDeployReceiptBytes],
    ['rollback-target-admission.json', admissionBytes],
  ]);
  let currentConfigBytes = null;
  let liveMutationPrestateBytes = null;
  if (phaseCount >= PHYSIO_ROLLBACK_PHASES.indexOf('LIVE_MUTATION_STARTED') + 1) {
    currentConfigBytes = jsonBytes({
      image: optionSeed.currentImmutableImage,
      env: { PROFESSION: 'physio', DEFAULT_APP_ID: 'local-assesssuite-physio' },
      metadata: { assesssuite_restart_intent_sha256: '8'.repeat(64) },
      mounts: [{ volume: optionSeed.expectedVolumeId, path: '/app/server/data' }],
      guest: { cpus: 1, memory_mb: 512 },
    });
    const currentConfig = JSON.parse(currentConfigBytes.toString('utf8'));
    liveMutationPrestateBytes = jsonBytes({
      id: optionSeed.expectedMachineId,
      state: 'started', instance_id: 'instance-before-rollback',
      updated_at: '2026-08-22T00:00:00.000Z',
      events: [{ type: 'start', timestamp: '2026-08-22T00:00:00.000Z' }],
      config: currentConfig,
    });
    const prestateReceiptBytes = jsonBytes({
      contract_version: 'assesssuite-physio-rollback-live-mutation-prestate/1.0.0', result: 'PASS',
      request_url: `https://api.machines.dev/v1/apps/assesssuite-physio-production/machines/${optionSeed.expectedMachineId}`,
      http_status: 200, machine_id: optionSeed.expectedMachineId,
      provider_readback_sha256: sha256(liveMutationPrestateBytes), machine_config_sha256: sha256(currentConfigBytes),
      response_headers_sha256: '9'.repeat(64), captured_at: '2026-08-22T00:00:00.000Z',
    });
    files.set('rollback-current-machine-config.json', currentConfigBytes);
    files.set('rollback-live-mutation-prestate.json', liveMutationPrestateBytes);
    files.set('rollback-live-mutation-prestate-receipt.json', prestateReceiptBytes);
  }
  let predecessor = '0'.repeat(64);
  for (let ordinal = 0; ordinal < phaseCount; ordinal += 1) {
    const phase = PHYSIO_ROLLBACK_PHASES[ordinal];
    const provider = providerReadback(phase);
    const providerBytes = jsonBytes(provider);
    const effect = effectRow({ phase, ordinal, predecessor, providerSha: sha256(providerBytes), packetOptions });
    if (ordinal === 0 && phaseCount > 1) {
      provider.result = 'PASS';
      effect.result = 'COMPLETED';
      effect.initial_machine_state = 'started';
      effect.completed_at = '2026-08-22T00:00:30.000Z';
    }
    if (ordinal >= 1) {
      provider.machine_count = 1;
      provider.volume_count = ordinal >= 2 ? 2 : 1;
      provider.snapshot_count = 1;
      provider.observed_machine_id = options.expectedMachineId;
      provider.observed_machine_state = firstReleaseStop ? 'stopped' : (ordinal >= 4 ? 'started' : 'stopped');
      provider.observed_image = ordinal >= 3 && !firstReleaseStop
        ? packetOptions.rollbackImmutableImage
        : packetOptions.currentImmutableImage;
      provider.observed_volume_id = options.expectedVolumeId;
      provider.observed_snapshot_id = 'snapshot_123';
      effect.initial_machine_state = 'started';
      effect.observed_image = provider.observed_image;
      effect.snapshot_id = provider.observed_snapshot_id;
    }
    if (ordinal >= 2) {
      provider.observed_restore_volume_id = 'vol_Restore123';
      effect.restore_volume_id = provider.observed_restore_volume_id;
    }
    if (ordinal >= 2 && ordinal <= 3) {
      provider.observed_verifier_machine_id = 'b'.repeat(14);
      effect.verifier_machine_id = provider.observed_verifier_machine_id;
    }
    if (ordinal >= 4) effect.result_machine_id = options.expectedMachineId;
    if (ordinal >= 5) effect.result_volume_id = options.expectedVolumeId;
    if (ordinal === PHYSIO_ROLLBACK_PHASES.indexOf('LIVE_MUTATION_STARTED') && !firstReleaseStop) {
      const preMachine = JSON.parse(liveMutationPrestateBytes.toString('utf8'));
      const targetConfig = JSON.parse(machineConfigBytes.toString('utf8'));
      const built = buildFullMachineConfigUpdate({ targetConfig,
        immutableImage: packetOptions.rollbackImmutableImage, expectedVolumeId: packetOptions.expectedVolumeId });
      const successfulOperation = {
        contract_version: 'assesssuite-physio-machine-config-transition/1.0.0', result: 'PASS',
        disposition: 'APPLIED', reason: 'exact target config and reboot observed',
        ...built, observed_machine_id: packetOptions.expectedMachineId,
        observed_config_sha256: built.target_config_sha256, observed_instance_id: 'instance-after-rollback',
        observed_updated_at: '2026-08-22T00:01:00.000Z', observed_events_sha256: 'a'.repeat(64),
        provider_mutation_calls_attempted: 1, provider_mutation_calls_confirmed: 1,
        provider_mutation_responses_received: 1, provider_inventory_calls_attempted: 2,
        provider_inventory_calls_confirmed: 2,
        inventory_receipts: [0, 1].map(() => ({ http_status: 200,
          response_body_sha256: 'b'.repeat(64), response_headers_sha256: 'c'.repeat(64) })),
        mutation_receipt: { http_status: 200, response_body_sha256: 'd'.repeat(64),
          response_headers_sha256: 'e'.repeat(64) },
        pre_machine_sha256: machineStateSha256(preMachine),
        pre_config_sha256: machineConfigSha256(preMachine.config), pre_instance_id: preMachine.instance_id,
        pre_updated_at: preMachine.updated_at, pre_events_sha256: machineEventsSha256(preMachine.events),
      };
      const firstOperation = includeTransitionRetry ? {
        ...successfulOperation, result: 'STARTED_UNRESOLVED', disposition: 'NOT_APPLIED',
        reason: 'exact prestate remains', observed_config_sha256: machineConfigSha256(preMachine.config),
        observed_instance_id: preMachine.instance_id, observed_updated_at: preMachine.updated_at,
        observed_events_sha256: machineEventsSha256(preMachine.events),
        provider_mutation_calls_confirmed: 0,
      } : successfulOperation;
      const operationBytes = jsonBytes(firstOperation);
      files.set('rollback-machine-config-transition-operation-0001.json', operationBytes);
      provider.machine_config_operation_receipt_sha256s = [sha256(operationBytes)];
      if (includeTransitionRetry) {
        const retryBytes = jsonBytes(successfulOperation);
        files.set('rollback-machine-config-transition-operation-0002.json', retryBytes);
        provider.machine_config_operation_receipt_sha256s.push(sha256(retryBytes));
      }
      if (includeRecovery) {
        provider.result = 'STARTED_UNRESOLVED';
        provider.observed_image = packetOptions.currentImmutableImage;
        provider.observed_machine_state = 'started';
        effect.result = 'STARTED_UNRESOLVED';
        effect.observed_image = packetOptions.currentImmutableImage;
        const recoveryPrestate = {
          id: packetOptions.expectedMachineId, state: 'started', instance_id: 'instance-target',
          updated_at: '2026-08-22T00:01:00.000Z',
          events: [{ type: 'update', timestamp: '2026-08-22T00:01:00.000Z' }], config: targetConfig,
        };
        const recoveryPrestateBytes = jsonBytes(recoveryPrestate);
        const recoveryTarget = JSON.parse(currentConfigBytes.toString('utf8'));
        const recoveryBuilt = buildFullMachineConfigUpdate({ targetConfig: recoveryTarget,
          immutableImage: packetOptions.currentImmutableImage, expectedVolumeId: packetOptions.expectedVolumeId });
        const recoveryBytes = jsonBytes({
          contract_version: 'assesssuite-physio-machine-config-transition/1.0.0', result: 'PASS',
          disposition: 'APPLIED', reason: 'exact target config and reboot observed', ...recoveryBuilt,
          observed_machine_id: packetOptions.expectedMachineId,
          observed_config_sha256: recoveryBuilt.target_config_sha256,
          observed_instance_id: 'instance-recovered', observed_updated_at: '2026-08-22T00:02:00.000Z',
          observed_events_sha256: 'f'.repeat(64), provider_mutation_calls_attempted: 1,
          provider_mutation_calls_confirmed: 1, provider_mutation_responses_received: 0,
          provider_inventory_calls_attempted: 2, provider_inventory_calls_confirmed: 2,
          inventory_receipts: [0, 1].map(() => ({ http_status: 200,
            response_body_sha256: '1'.repeat(64), response_headers_sha256: '2'.repeat(64) })),
          mutation_receipt: { error_sha256: '3'.repeat(64) },
          pre_machine_sha256: machineStateSha256(recoveryPrestate),
          pre_config_sha256: machineConfigSha256(recoveryPrestate.config),
          pre_instance_id: recoveryPrestate.instance_id, pre_updated_at: recoveryPrestate.updated_at,
          pre_events_sha256: machineEventsSha256(recoveryPrestate.events),
        });
        files.set('rollback-machine-config-recovery-prestate-0001.json', recoveryPrestateBytes);
        files.set('rollback-machine-config-recovery-operation-0001.json', recoveryBytes);
        provider.machine_config_recovery_prestate_sha256s = [sha256(recoveryPrestateBytes)];
        provider.machine_config_recovery_receipt_sha256s = [sha256(recoveryBytes)];
      }
    }
    if (phase === 'POST_RESTART_VERIFIED') effect.provider_calls_executed = 0;
    if (phase === 'RESTORE_VOLUME_CLEANUP') {
      provider.volume_count = 1;
      const cleanupReceiptBytes = jsonBytes({
        contract_version: 'assesssuite-physio-rollback-volume-cleanup/1.0.0',
        application: 'assesssuite-physio-production', disposition: 'APPLIED',
        restore_volume_id: 'vol_Restore123', request_method: 'DELETE',
        request_url: 'https://api.machines.dev/v1/apps/assesssuite-physio-production/volumes/vol_Restore123?force=false',
        force: false, provider_mutation_calls_attempted: 1, response_received: true, http_status: 204,
        pre_volumes_sha256: sha256('pre-volumes'), post_volumes_sha256: sha256('post-volumes'),
        restore_volume_absent: true,
        response_body_sha256: sha256(''), response_headers_sha256: sha256('headers'), error_sha256: null,
        attempted_at: '2026-08-22T00:00:00.000Z',
      });
      files.set('rollback-restore-volume-cleanup-operation-0001.json', cleanupReceiptBytes);
      provider.restore_volume_cleanup_receipt_sha256s = [sha256(cleanupReceiptBytes)];
    }
    if (phase === 'COMPLETED') provider.volume_count = 1;
    if (phase === 'COMPLETED') effect.provider_calls_executed = 0;
    effect.rollback_target_config_sha256 = sha256(configBytes);
    effect.rollback_target_machine_config_sha256 = sha256(machineConfigBytes);
    effect.rollback_target_admission_sha256 = sha256(admissionBytes);
    mutate?.({ ordinal, phase, effect, provider });
    const finalProviderBytes = jsonBytes(provider);
    effect.provider_readback_sha256 = sha256(finalProviderBytes);
    const effectBytes = jsonBytes(effect);
    files.set(`rollback-phase-${String(ordinal).padStart(2, '0')}-${phase}.json`, effectBytes);
    files.set(`rollback-readback-${String(ordinal).padStart(2, '0')}-${phase}.json`, finalProviderBytes);
    predecessor = sha256(effectBytes);
    if (ordinal === phaseCount - 1) {
      files.set('rollback-effect-reconciliation.json', effectBytes);
      files.set('rollback-provider-readback.json', finalProviderBytes);
    }
  }
  for (const [name, bytes] of files) fs.writeFileSync(path.join(root, name), bytes, { flag: 'wx' });
  const sums = [...files].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([name, bytes]) => `${sha256(bytes)}  ${name}`).join('\n');
  fs.writeFileSync(path.join(root, 'SHA256SUMS'), `${sums}\n`, { flag: 'wx' });
  return { root, packetOptions };
}

function rewriteChecksums(root) {
  const names = fs.readdirSync(root).filter((name) => name !== 'SHA256SUMS').sort();
  fs.writeFileSync(path.join(root, 'SHA256SUMS'), `${names.map((name) => (
    `${sha256(fs.readFileSync(path.join(root, name)))}  ${name}`
  )).join('\n')}\n`);
}

test('rollback resume packet validates a raw-byte STARTED phase chain', () => {
  const { root, packetOptions } = buildPacket();
  try {
    const result = readAndValidatePhysioRollbackResumePacket(root, packetOptions);
    assert.equal(result.phase, 'STARTED');
    assert.equal(result.result, 'STARTED');
    assert.equal(result.resumeCompleted, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback resume packet validates the complete append-only exact-image phase chain', () => {
  const { root, packetOptions } = buildPacket({ phaseCount: PHYSIO_ROLLBACK_PHASES.length });
  try {
    const result = readAndValidatePhysioRollbackResumePacket(root, packetOptions);
    assert.equal(result.phase, 'COMPLETED');
    assert.equal(result.result, 'COMPLETED');
    assert.equal(result.resumeCompleted, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback resume packet validates the complete stop-first-release terminal chain', () => {
  const { root, packetOptions } = buildPacket({
    phaseCount: PHYSIO_ROLLBACK_PHASES.length,
    rollbackMode: 'stop-first-release',
  });
  try {
    const result = readAndValidatePhysioRollbackResumePacket(root, packetOptions);
    assert.equal(result.phase, 'COMPLETED');
    assert.equal(result.result, 'COMPLETED');
    assert.equal(result.resumeCompleted, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback resume packet rejects a forged predecessor hash', () => {
  const { root, packetOptions } = buildPacket({
    phaseCount: 2,
    mutate: ({ ordinal, effect, provider }) => {
      if (ordinal === 1) {
        effect.predecessor_phase_receipt_sha256 = 'f'.repeat(64);
        effect.snapshot_id = 'snapshot_123';
        provider.observed_snapshot_id = 'snapshot_123';
      }
    },
  });
  try {
    assert.throws(() => readAndValidatePhysioRollbackResumePacket(root, packetOptions), /phase 1 differs/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback resume packet rejects effect and provider identity drift', () => {
  const { root, packetOptions } = buildPacket({
    mutate: ({ effect }) => { effect.observed_image = options.currentImmutableImage; },
  });
  try {
    assert.throws(() => readAndValidatePhysioRollbackResumePacket(root, packetOptions), /phase 0 differs/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback resume packet rejects nested or extra evidence', () => {
  const { root, packetOptions } = buildPacket();
  try {
    fs.mkdirSync(path.join(root, 'unchecksummed'));
    assert.throws(() => readAndValidatePhysioRollbackResumePacket(root, packetOptions), /flat/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback resume packet rejects checksum-valid target config substitution', () => {
  const { root, packetOptions } = buildPacket();
  try {
    const file = path.join(root, 'rollback-target-config.toml');
    fs.writeFileSync(file, 'app = "foreign"\n');
    rewriteChecksums(root);
    assert.throws(() => readAndValidatePhysioRollbackResumePacket(root, packetOptions), /target admission identity differs/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback resume packet rejects a checksum-valid re-signed non-main GitHub target admission', () => {
  const { root, packetOptions } = buildPacket();
  try {
    const githubPath = path.join(root, 'rollback-target-github-artifact-admission.json');
    const githubAdmission = JSON.parse(fs.readFileSync(githubPath, 'utf8'));
    githubAdmission.artifacts.rollback_target.workflow_run_head_branch = 'feature/foreign';
    const githubBytes = jsonBytes(githubAdmission);
    fs.writeFileSync(githubPath, githubBytes);

    const targetPath = path.join(root, 'rollback-target-admission.json');
    const targetAdmission = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    targetAdmission.github_artifact_admission_sha256 = sha256(githubBytes);
    const targetBytes = jsonBytes(targetAdmission);
    fs.writeFileSync(targetPath, targetBytes);

    const phasePath = path.join(root, 'rollback-phase-00-STARTED.json');
    const phase = JSON.parse(fs.readFileSync(phasePath, 'utf8'));
    phase.rollback_target_admission_sha256 = sha256(targetBytes);
    const phaseBytes = jsonBytes(phase);
    fs.writeFileSync(phasePath, phaseBytes);
    fs.writeFileSync(path.join(root, 'rollback-effect-reconciliation.json'), phaseBytes);
    rewriteChecksums(root);

    assert.throws(
      () => readAndValidatePhysioRollbackResumePacket(root, packetOptions),
      /rollback target GitHub admission differs/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback resume packet rejects a checksum-valid re-signed foreign source deploy receipt', () => {
  const { root, packetOptions } = buildPacket();
  try {
    const sourcePath = path.join(root, 'rollback-target-source-deploy-receipt.json');
    const sourceReceipt = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    sourceReceipt.contract_version = 'assesssuite-physio-deploy/foreign';
    const sourceBytes = jsonBytes(sourceReceipt);
    fs.writeFileSync(sourcePath, sourceBytes);

    const reboundOptions = Object.freeze({
      ...packetOptions,
      rollbackTargetReceiptSha256: sha256(sourceBytes),
    });
    const targetPath = path.join(root, 'rollback-target-admission.json');
    const targetAdmission = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    targetAdmission.rollback_target_receipt_sha256 = reboundOptions.rollbackTargetReceiptSha256;
    targetAdmission.source_deploy_receipt_file_sha256 = sha256(sourceBytes);
    const targetBytes = jsonBytes(targetAdmission);
    fs.writeFileSync(targetPath, targetBytes);

    const phasePath = path.join(root, 'rollback-phase-00-STARTED.json');
    const phase = JSON.parse(fs.readFileSync(phasePath, 'utf8'));
    phase.rollback_target_receipt_sha256 = reboundOptions.rollbackTargetReceiptSha256;
    phase.rollback_target_admission_sha256 = sha256(targetBytes);
    const phaseBytes = jsonBytes(phase);
    fs.writeFileSync(phasePath, phaseBytes);
    fs.writeFileSync(path.join(root, 'rollback-effect-reconciliation.json'), phaseBytes);
    rewriteChecksums(root);

    assert.throws(
      () => readAndValidatePhysioRollbackResumePacket(root, reboundOptions),
      /rollback target source deploy receipt differs/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback unresolved phase durably validates exact transition and recovery response-loss evidence', () => {
  const { root, packetOptions } = buildPacket({
    phaseCount: PHYSIO_ROLLBACK_PHASES.indexOf('LIVE_MUTATION_STARTED') + 1,
    includeRecovery: true,
  });
  try {
    const result = readAndValidatePhysioRollbackResumePacket(root, packetOptions);
    assert.equal(result.phase, 'LIVE_MUTATION_STARTED');
    assert.equal(result.result, 'STARTED_UNRESOLVED');
    assert.ok(fs.existsSync(path.join(root, 'rollback-machine-config-transition-operation-0001.json')));
    assert.ok(fs.existsSync(path.join(root, 'rollback-machine-config-recovery-prestate-0001.json')));
    assert.ok(fs.existsSync(path.join(root, 'rollback-machine-config-recovery-operation-0001.json')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback completion preserves an unresolved transition before an authoritative retry receipt', () => {
  const { root, packetOptions } = buildPacket({
    phaseCount: PHYSIO_ROLLBACK_PHASES.indexOf('LIVE_MUTATION_STARTED') + 1,
    includeTransitionRetry: true,
  });
  try {
    const result = readAndValidatePhysioRollbackResumePacket(root, packetOptions);
    assert.equal(result.result, 'COMPLETED');
    assert.ok(fs.existsSync(path.join(root, 'rollback-machine-config-transition-operation-0001.json')));
    assert.ok(fs.existsSync(path.join(root, 'rollback-machine-config-transition-operation-0002.json')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback packet rejects checksum-valid durable prestate config drift', () => {
  const { root, packetOptions } = buildPacket({
    phaseCount: PHYSIO_ROLLBACK_PHASES.indexOf('LIVE_MUTATION_STARTED') + 1,
  });
  try {
    const file = path.join(root, 'rollback-current-machine-config.json');
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    config.metadata.assesssuite_restart_intent_sha256 = 'f'.repeat(64);
    fs.writeFileSync(file, jsonBytes(config));
    rewriteChecksums(root);
    assert.throws(() => readAndValidatePhysioRollbackResumePacket(root, packetOptions),
      /prestate receipt differs|prestate config differs/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback packet rejects checksum-valid operation receipt substitution', () => {
  const { root, packetOptions } = buildPacket({
    phaseCount: PHYSIO_ROLLBACK_PHASES.indexOf('LIVE_MUTATION_STARTED') + 1,
  });
  try {
    const file = path.join(root, 'rollback-machine-config-transition-operation-0001.json');
    const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
    receipt.pre_config_sha256 = 'f'.repeat(64);
    const receiptBytes = jsonBytes(receipt);
    fs.writeFileSync(file, receiptBytes);
    const liveOrdinal = PHYSIO_ROLLBACK_PHASES.indexOf('LIVE_MUTATION_STARTED');
    const livePhase = PHYSIO_ROLLBACK_PHASES[liveOrdinal];
    const ordinalPrefix = String(liveOrdinal).padStart(2, '0');
    const readbackPath = path.join(root, `rollback-readback-${ordinalPrefix}-${livePhase}.json`);
    const readback = JSON.parse(fs.readFileSync(readbackPath, 'utf8'));
    readback.machine_config_operation_receipt_sha256s = [sha256(receiptBytes)];
    const readbackBytes = jsonBytes(readback);
    fs.writeFileSync(readbackPath, readbackBytes);
    fs.writeFileSync(path.join(root, 'rollback-provider-readback.json'), readbackBytes);
    const phasePath = path.join(root, `rollback-phase-${ordinalPrefix}-${livePhase}.json`);
    const phase = JSON.parse(fs.readFileSync(phasePath, 'utf8'));
    phase.provider_readback_sha256 = sha256(readbackBytes);
    const phaseBytes = jsonBytes(phase);
    fs.writeFileSync(phasePath, phaseBytes);
    fs.writeFileSync(path.join(root, 'rollback-effect-reconciliation.json'), phaseBytes);
    rewriteChecksums(root);
    assert.throws(() => readAndValidatePhysioRollbackResumePacket(root, packetOptions),
      /machine config transition receipt 1 contract differs/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback post-restart and cleanup phases enforce separate provider-call and topology contracts', () => {
  const cases = [
    {
      label: 'provider mutation hidden in post-restart',
      mutate: ({ phase, effect }) => { if (phase === 'POST_RESTART_VERIFIED') effect.provider_calls_executed = 1; },
      expected: /rollback post-restart phase differs/,
    },
    {
      label: 'cleanup without its one provider call',
      mutate: ({ phase, effect }) => { if (phase === 'RESTORE_VOLUME_CLEANUP') effect.provider_calls_executed = 0; },
      expected: /rollback restore-volume cleanup phase differs/,
    },
    {
      label: 'cleanup retains the detached restore volume',
      mutate: ({ phase, provider }) => { if (phase === 'RESTORE_VOLUME_CLEANUP') provider.volume_count = 2; },
      expected: /rollback restore-volume cleanup phase differs/,
    },
  ];
  for (const { label, mutate, expected } of cases) {
    const built = buildPacket({ phaseCount: PHYSIO_ROLLBACK_PHASES.length, mutate });
    try {
      assert.throws(() => readAndValidatePhysioRollbackResumePacket(built.root, built.packetOptions), expected, label);
    } finally {
      fs.rmSync(built.root, { recursive: true, force: true });
    }
  }
});

test('rollback cleanup rejects a checksum-valid forceful or cross-target deletion receipt', () => {
  for (const mutateReceipt of [
    (receipt) => { receipt.force = true; },
    (receipt) => { receipt.restore_volume_id = 'vol_OtherRestore'; },
    (receipt) => { receipt.disposition = 'AMBIGUOUS'; },
  ]) {
    const cleanupOrdinal = PHYSIO_ROLLBACK_PHASES.indexOf('RESTORE_VOLUME_CLEANUP');
    const { root, packetOptions } = buildPacket({ phaseCount: cleanupOrdinal + 1 });
    try {
      const receiptPath = path.join(root, 'rollback-restore-volume-cleanup-operation-0001.json');
      const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
      mutateReceipt(receipt);
      const receiptBytes = jsonBytes(receipt);
      fs.writeFileSync(receiptPath, receiptBytes);
      const prefix = String(cleanupOrdinal).padStart(2, '0');
      const readbackPath = path.join(root, `rollback-readback-${prefix}-RESTORE_VOLUME_CLEANUP.json`);
      const readback = JSON.parse(fs.readFileSync(readbackPath, 'utf8'));
      readback.restore_volume_cleanup_receipt_sha256s = [sha256(receiptBytes)];
      const readbackBytes = jsonBytes(readback);
      fs.writeFileSync(readbackPath, readbackBytes);
      fs.writeFileSync(path.join(root, 'rollback-provider-readback.json'), readbackBytes);
      const phasePath = path.join(root, `rollback-phase-${prefix}-RESTORE_VOLUME_CLEANUP.json`);
      const phase = JSON.parse(fs.readFileSync(phasePath, 'utf8'));
      phase.provider_readback_sha256 = sha256(readbackBytes);
      const phaseBytes = jsonBytes(phase);
      fs.writeFileSync(phasePath, phaseBytes);
      fs.writeFileSync(path.join(root, 'rollback-effect-reconciliation.json'), phaseBytes);
      rewriteChecksums(root);
      assert.throws(() => readAndValidatePhysioRollbackResumePacket(root, packetOptions),
        /rollback restore-volume cleanup receipt differs|completion lacks applied reconciliation/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});
