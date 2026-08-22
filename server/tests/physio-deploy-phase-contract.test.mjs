import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  PHYSIO_DEPLOY_EFFECT_RECONCILIATION_CONTRACT_VERSION,
  PHYSIO_DEPLOY_PHASES,
  readAndValidatePhysioDeployResumePacket,
  writeInitialPhysioDeployPacket,
  writeNextPhysioDeployPacket,
} from '../../scripts/physio-release-contract.mjs';
import { restartIntentFromPrestate } from '../../scripts/physio-fly-restart-contract.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const options = Object.freeze({
  applicationSha: '1'.repeat(40),
  immutableImage: `registry.fly.io/assesssuite-physio-production@sha256:${'2'.repeat(64)}`,
  publicationReceiptSha256: '3'.repeat(64),
  canaryReceiptSha256: '4'.repeat(64),
  bootstrapReceiptSha256: '5'.repeat(64),
  stripeWebhookReceiptSha256: '6'.repeat(64),
  sentryReleaseReceiptSha256: '7'.repeat(64),
  configSha256: '',
  upstreamArtifactMetadataSha256: '8'.repeat(64),
  expectedVolumeId: 'vol_Physio123',
  capabilityIntentId: 'capability:physio:deploy:unit',
  authorityReference: 'UM-AUTO-20260821-test',
  publicationCapabilityIntentId: 'capability:physio:publication:unit',
  publicationAuthorityReference: 'UM-AUTO-20260821-publication',
  bootstrapCapabilityIntentId: 'capability:physio:bootstrap:unit',
  bootstrapAuthorityReference: 'UM-AUTO-20260821-bootstrap',
  canaryCapabilityIntentId: 'capability:physio:canary:unit',
  canaryAuthorityReference: 'UM-AUTO-20260821-canary',
  stripeWebhookCapabilityIntentId: 'capability:physio:stripe-webhook:unit',
  stripeWebhookAuthorityReference: 'UM-AUTO-20260821-stripe-webhook',
  sentryCapabilityIntentId: 'capability:physio:sentry:unit',
  sentryAuthorityReference: 'UM-AUTO-20260821-sentry',
});

const machineId = 'a'.repeat(14);
const verifierMachineId = 'b'.repeat(14);
const restoreVolumeId = 'vol_Restore123';
const predeploySnapshotId = 'snapshot_pre_123';
const postdeploySnapshotId = 'snapshot_post_123';
const emptyHash = sha256('');
const deployedConfigHash = sha256('deployed-machine-config');
const preRestartInstanceId = 'instance-pre-restart';
const postRestartInstanceId = 'instance-post-restart';
const preRestartUpdatedAt = '2026-08-22T00:00:00.000Z';
const postRestartUpdatedAt = '2026-08-22T00:00:30.000Z';
const restartEffectId = 'deploy:test:12:production_machine_restart';

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function canonicalSha(value) {
  return sha256(Buffer.from(`${canonicalJson(value)}\n`));
}

const preRestartEventsHash = canonicalSha([]);
const postRestartEventsHash = canonicalSha([{ type: 'start', timestamp: postRestartUpdatedAt }]);

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function providerReadback(phase, result = 'PASS', operation = null) {
  const ordinal = PHYSIO_DEPLOY_PHASES.indexOf(phase);
  const deployed = ordinal >= PHYSIO_DEPLOY_PHASES.indexOf('LIVE_DEPLOY_COMPLETED');
  const live = ordinal >= PHYSIO_DEPLOY_PHASES.indexOf('POST_RESTART_VERIFIED');
  const stopped = deployed && ordinal >= PHYSIO_DEPLOY_PHASES.indexOf('MACHINE_STOPPED') &&
    ordinal < PHYSIO_DEPLOY_PHASES.indexOf('MACHINE_STARTED');
  const restoreVolumePresent = ordinal >= PHYSIO_DEPLOY_PHASES.indexOf('RESTORE_VOLUME_CREATED') &&
    ordinal < PHYSIO_DEPLOY_PHASES.indexOf('RESTORE_VOLUME_DESTROYED');
  const verifierPresent = ordinal >= PHYSIO_DEPLOY_PHASES.indexOf('VERIFIER_MACHINE_CREATED') &&
    ordinal < PHYSIO_DEPLOY_PHASES.indexOf('VERIFIER_MACHINE_DESTROYED');
  const verifierStopped = ordinal >= PHYSIO_DEPLOY_PHASES.indexOf('VERIFIER_MACHINE_STOPPED');
  const hasPreSnapshot = ordinal >= PHYSIO_DEPLOY_PHASES.indexOf('SNAPSHOT_COMPLETED');
  const hasPostSnapshot = ordinal >= PHYSIO_DEPLOY_PHASES.indexOf('POSTDEPLOY_SNAPSHOT_COMPLETED');
  const sentryComplete = phase === 'COMPLETED';
  const packetOptions = buildState?.packetOptions ?? options;
  const machineIds = [...(deployed ? [machineId] : []), ...(verifierPresent ? [verifierMachineId] : [])].sort();
  const volumeIds = [packetOptions.expectedVolumeId, ...(restoreVolumePresent ? [restoreVolumeId] : [])].sort();
  const snapshotIds = [...(hasPreSnapshot ? [predeploySnapshotId] : []),
    ...(hasPostSnapshot ? [postdeploySnapshotId] : [])].sort();
  const restartMarker = live ? restartIntentFromPrestate({ applicationSha: packetOptions.applicationSha,
    effectId: restartEffectId, machineId,
    prestate: { observed_config_sha256: deployedConfigHash,
      observed_config_without_restart_sha256: deployedConfigHash,
      observed_restart_intent_sha256: null, observed_machine_instance_id: preRestartInstanceId,
      observed_machine_updated_at: preRestartUpdatedAt } }).restart_intent_sha256 : null;
  return {
    contract_version: 'assesssuite-physio-deploy-provider-readback/1.0.0',
    result,
    application: 'assesssuite-physio-production',
    phase,
    machines_sha256: emptyHash,
    volumes_sha256: emptyHash,
    snapshots_sha256: emptyHash,
    observed_config_sha256: deployed ? (live ? sha256('deployed-machine-config-with-restart-marker') : deployedConfigHash) : emptyHash,
    observed_config_without_restart_sha256: deployed ? deployedConfigHash : emptyHash,
    machine_count: machineIds.length,
    volume_count: volumeIds.length,
    snapshot_count: snapshotIds.length,
    observed_machine_id: deployed ? machineId : null,
    observed_machine_ids: machineIds,
    observed_machine_state: deployed ? (stopped ? 'stopped' : 'started') : null,
    observed_machine_instance_id: deployed ? (live ? postRestartInstanceId : preRestartInstanceId) : null,
    observed_machine_updated_at: deployed ? (live ? postRestartUpdatedAt : preRestartUpdatedAt) : null,
    observed_machine_events_sha256: deployed ? (live ? postRestartEventsHash : preRestartEventsHash) : canonicalSha([]),
    observed_image: deployed ? packetOptions.immutableImage : null,
    observed_volume_id: packetOptions.expectedVolumeId,
    observed_volume_ids: volumeIds,
    observed_restore_volume_id: restoreVolumePresent ? restoreVolumeId : null,
    observed_verifier_machine_id: verifierPresent ? verifierMachineId : null,
    observed_verifier_machine_state: verifierPresent ? (verifierStopped ? 'stopped' : 'started') : null,
    observed_predeploy_snapshot_id: hasPreSnapshot ? predeploySnapshotId : null,
    observed_postdeploy_snapshot_id: hasPostSnapshot ? postdeploySnapshotId : null,
    observed_snapshot_ids: snapshotIds,
    observed_restart_intent_sha256: restartMarker,
    observed_sentry_deployment_id_sha256: sentryComplete ? '9'.repeat(64) : null,
    runtime_live_sha256: live ? 'a'.repeat(64) : null,
    runtime_ready_sha256: live ? 'b'.repeat(64) : null,
    runtime_version_sha256: live ? 'c'.repeat(64) : null,
    runtime_capabilities_sha256: live ? 'd'.repeat(64) : null,
    operation_kind: operation?.kind ?? null,
    operation_effect_id: operation?.effectId ?? null,
    operation_request_sha256: operation?.requestSha256 ?? null,
    operation_resource_id: operation?.resourceId ?? null,
    operation_provider_request_id_sha256: operation?.providerRequestIdSha256 ?? null,
    operation_receipt_sha256: operation?.receiptSha256 ?? null,
    operation_disposition: operation?.disposition ?? 'NONE',
    readback_at: '2026-08-22T00:00:00.000Z',
  };
}

function requestManifest(kind, effectOrdinal, intendedResourceId, packetOptions) {
  return {
    application: 'assesssuite-physio-production',
    application_sha: packetOptions.applicationSha,
    argv_sha256: sha256(`${kind}:argv`),
    config_sha256: packetOptions.configSha256,
    effect_id: `deploy:test:${effectOrdinal}:${kind.toLowerCase()}`,
    effect_ordinal: effectOrdinal,
    expected_volume_id: packetOptions.expectedVolumeId,
    immutable_image: packetOptions.immutableImage,
    intended_resource_id: intendedResourceId,
    kind,
  };
}

function appendProviderEffect(events, requests, kind, intendedResourceId, {
  terminal = true,
  unresolved = false,
  prestateSha256 = sha256(`${kind}:prestate`),
  providerReadbackSha256 = sha256(`${kind}:readback`),
} = {}) {
  const effectOrdinal = requests.length;
  const request = requestManifest(kind, effectOrdinal, intendedResourceId, buildState.packetOptions);
  requests.push(request);
  const startedAt = `2026-08-22T00:${String(effectOrdinal).padStart(2, '0')}:00.000Z`;
  const started = {
    attempt_ordinal: 0,
    completed_at: null,
    effect_id: request.effect_id,
    effect_ordinal: effectOrdinal,
    event_ordinal: events.length,
    intended_resource_id: intendedResourceId,
    kind,
    observed_resource_id: null,
    predecessor_event_sha256: events.length === 0 ? '0'.repeat(64) : canonicalSha(events.at(-1)),
    prestate_sha256: prestateSha256,
    provider_exit_code: null,
    provider_readback_sha256: null,
    provider_request_id_sha256: null,
    request_sha256: canonicalSha(request),
    started_at: startedAt,
    state: 'STARTED',
  };
  events.push(started);
  if (!terminal) return;
  events.push({
    ...started,
    completed_at: `2026-08-22T00:${String(effectOrdinal).padStart(2, '0')}:30.000Z`,
    event_ordinal: events.length,
    observed_resource_id: intendedResourceId,
    predecessor_event_sha256: canonicalSha(started),
    provider_exit_code: unresolved ? 124 : 0,
    provider_readback_sha256: providerReadbackSha256,
    provider_request_id_sha256: sha256(`${kind}:request-id`),
    state: unresolved ? 'STARTED_UNRESOLVED' : 'COMPLETED',
  });
}

function completePendingProviderEffect(events, {
  unresolved = false,
  providerReadbackSha256,
} = {}) {
  const started = events.at(-1);
  assert.equal(started?.state, 'STARTED');
  events.push({
    ...started,
    completed_at: `2026-08-22T00:${String(started.effect_ordinal).padStart(2, '0')}:30.000Z`,
    event_ordinal: events.length,
    observed_resource_id: started.intended_resource_id,
    predecessor_event_sha256: canonicalSha(started),
    provider_exit_code: unresolved ? 124 : 0,
    provider_readback_sha256: providerReadbackSha256 ?? sha256(`${started.kind}:readback`),
    provider_request_id_sha256: sha256(`${started.kind}:request-id`),
    state: unresolved ? 'STARTED_UNRESOLVED' : 'COMPLETED',
  });
}

let buildState;

function buildPacket({ phaseCount = 1, unresolvedLiveButContinue = false, mutate } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-deploy-contract-'));
  const configBytes = Buffer.from('app = "assesssuite-physio-production"\n');
  const packetOptions = Object.freeze({ ...options, configSha256: sha256(configBytes) });
  buildState = { packetOptions };
  const admissionBytes = jsonBytes({
    contract_version: 'assesssuite-physio-deploy-admission/2.0.0',
    result: 'PASS',
    application: 'assesssuite-physio-production',
    application_sha: packetOptions.applicationSha,
    immutable_image: packetOptions.immutableImage,
    expected_volume_id: packetOptions.expectedVolumeId,
    publication_receipt_sha256: packetOptions.publicationReceiptSha256,
    canary_receipt_sha256: packetOptions.canaryReceiptSha256,
    bootstrap_receipt_sha256: packetOptions.bootstrapReceiptSha256,
    stripe_webhook_receipt_sha256: packetOptions.stripeWebhookReceiptSha256,
    sentry_release_receipt_sha256: packetOptions.sentryReleaseReceiptSha256,
    config_sha256: packetOptions.configSha256,
    upstream_artifact_metadata_sha256: packetOptions.upstreamArtifactMetadataSha256,
    capability_intent_id: packetOptions.capabilityIntentId,
    authority_reference: packetOptions.authorityReference,
    publication_capability_intent_id: packetOptions.publicationCapabilityIntentId,
    publication_authority_reference: packetOptions.publicationAuthorityReference,
    bootstrap_capability_intent_id: packetOptions.bootstrapCapabilityIntentId,
    bootstrap_authority_reference: packetOptions.bootstrapAuthorityReference,
    canary_capability_intent_id: packetOptions.canaryCapabilityIntentId,
    canary_authority_reference: packetOptions.canaryAuthorityReference,
    stripe_webhook_capability_intent_id: packetOptions.stripeWebhookCapabilityIntentId,
    stripe_webhook_authority_reference: packetOptions.stripeWebhookAuthorityReference,
    sentry_capability_intent_id: packetOptions.sentryCapabilityIntentId,
    sentry_authority_reference: packetOptions.sentryAuthorityReference,
    admitted_at: '2026-08-22T00:00:00.000Z',
  });
  const files = new Map([
    ['deploy-admission.json', admissionBytes],
    ['deploy-reviewed-config.toml', configBytes],
  ]);
  const observedResourceByKind = Object.freeze({
    PREDEPLOY_SNAPSHOT_CREATE: predeploySnapshotId,
    LIVE_DEPLOY: packetOptions.immutableImage,
    PRESNAPSHOT_MANIFEST_EXEC: machineId,
    PRODUCTION_MACHINE_STOP: machineId,
    POSTDEPLOY_SNAPSHOT_CREATE: postdeploySnapshotId,
    RESTORE_VOLUME_CREATE: restoreVolumeId,
    RESTORE_VERIFIER_MACHINE_CREATE: verifierMachineId,
    RESTORE_VERIFIER_EXEC: verifierMachineId,
    RESTORE_VERIFIER_MACHINE_STOP: verifierMachineId,
    RESTORE_VERIFIER_MACHINE_DESTROY: verifierMachineId,
    RESTORE_VOLUME_DESTROY: restoreVolumeId,
    PRODUCTION_MACHINE_START: machineId,
    PRODUCTION_MACHINE_RESTART: machineId,
    SENTRY_DEPLOYMENT_ASSOCIATE: `physio-production@${packetOptions.applicationSha}`,
  });
  const events = [];
  const requests = [];
  const pendingPhases = new Map([
    ['STARTED', ['PREDEPLOY_SNAPSHOT_CREATE', predeploySnapshotId]],
    ['LIVE_MUTATION_STARTED', ['LIVE_DEPLOY', packetOptions.immutableImage]],
    ['PRESNAPSHOT_MANIFEST_STARTED', ['PRESNAPSHOT_MANIFEST_EXEC', machineId]],
    ['MACHINE_STOP_STARTED', ['PRODUCTION_MACHINE_STOP', machineId]],
    ['POSTDEPLOY_SNAPSHOT_STARTED', ['POSTDEPLOY_SNAPSHOT_CREATE', postdeploySnapshotId]],
    ['RESTORE_VOLUME_CREATE_STARTED', ['RESTORE_VOLUME_CREATE', restoreVolumeId]],
    ['VERIFIER_MACHINE_CREATE_STARTED', ['RESTORE_VERIFIER_MACHINE_CREATE', verifierMachineId]],
    ['RESTORE_VERIFY_STARTED', ['RESTORE_VERIFIER_EXEC', verifierMachineId]],
    ['VERIFIER_MACHINE_STOP_STARTED', ['RESTORE_VERIFIER_MACHINE_STOP', verifierMachineId]],
    ['VERIFIER_MACHINE_DESTROY_STARTED', ['RESTORE_VERIFIER_MACHINE_DESTROY', verifierMachineId]],
    ['RESTORE_VOLUME_DESTROY_STARTED', ['RESTORE_VOLUME_DESTROY', restoreVolumeId]],
    ['MACHINE_START_STARTED', ['PRODUCTION_MACHINE_START', machineId]],
    ['RESTART_STARTED', ['PRODUCTION_MACHINE_RESTART', machineId]],
    ['SENTRY_ASSOCIATION_STARTED', ['SENTRY_DEPLOYMENT_ASSOCIATE', `physio-production@${packetOptions.applicationSha}`]],
  ]);
  const completionPhases = new Set([
    'SNAPSHOT_COMPLETED', 'LIVE_DEPLOY_COMPLETED', 'PRESNAPSHOT_MANIFEST_COMPLETED', 'MACHINE_STOPPED',
    'POSTDEPLOY_SNAPSHOT_COMPLETED', 'RESTORE_VOLUME_CREATED', 'VERIFIER_MACHINE_CREATED', 'RESTORE_VERIFIED',
    'VERIFIER_MACHINE_STOPPED', 'VERIFIER_MACHINE_DESTROYED', 'RESTORE_VOLUME_DESTROYED', 'MACHINE_STARTED',
    'POST_RESTART_VERIFIED', 'COMPLETED',
  ]);
  let predecessorPhase = '0'.repeat(64);
  for (let ordinal = 0; ordinal < phaseCount; ordinal += 1) {
    const phase = PHYSIO_DEPLOY_PHASES[ordinal];
    let result;
    let provider;
    if (pendingPhases.has(phase)) {
      const [kind, resource] = pendingPhases.get(phase);
      const request = requestManifest(kind, requests.length, resource, packetOptions);
      provider = providerReadback(phase, phase === 'STARTED' ? 'NOT_OBSERVED' : 'PASS', {
        kind,
        effectId: request.effect_id,
        requestSha256: canonicalSha(request),
        resourceId: resource,
        providerRequestIdSha256: null,
        receiptSha256: null,
        disposition: 'PRESTATE',
      });
      const providerBytes = jsonBytes(provider);
      appendProviderEffect(events, requests, kind, resource, {
        terminal: false,
        prestateSha256: sha256(providerBytes),
      });
      result = 'STARTED';
    } else if (completionPhases.has(phase) && phase !== 'COMPLETED' && phase !== 'DEPLOY_COMPLETED') {
      const pending = events.at(-1);
      const unresolved = unresolvedLiveButContinue && phase === 'LIVE_DEPLOY_COMPLETED';
      const providerRequestIdSha256 = sha256(`${pending.kind}:request-id`);
      provider = providerReadback(phase, unresolved ? 'STARTED_UNRESOLVED' : 'PASS', {
        kind: pending.kind,
        effectId: pending.effect_id,
        requestSha256: pending.request_sha256,
        resourceId: observedResourceByKind[pending.kind],
        providerRequestIdSha256,
        receiptSha256: ['PRESNAPSHOT_MANIFEST_EXEC', 'RESTORE_VERIFIER_EXEC',
          'PRODUCTION_MACHINE_RESTART'].includes(pending.kind) ? sha256(`${pending.kind}:receipt`) : null,
        disposition: unresolved ? 'AMBIGUOUS' : 'APPLIED',
      });
      const providerBytes = jsonBytes(provider);
      completePendingProviderEffect(events, {
        unresolved,
        providerReadbackSha256: sha256(providerBytes),
      });
      result = unresolved ? 'STARTED_UNRESOLVED' : 'COMPLETED';
    } else if (phase === 'COMPLETED') {
      const pending = events.at(-1);
      const providerRequestIdSha256 = sha256(`${pending.kind}:request-id`);
      provider = providerReadback(phase, 'PASS', {
        kind: pending.kind,
        effectId: pending.effect_id,
        requestSha256: pending.request_sha256,
        resourceId: observedResourceByKind[pending.kind],
        providerRequestIdSha256,
        receiptSha256: sha256(`${pending.kind}:receipt`),
        disposition: 'APPLIED',
      });
      const providerBytes = jsonBytes(provider);
      completePendingProviderEffect(events, { providerReadbackSha256: sha256(providerBytes) });
      result = 'COMPLETED';
    } else {
      provider = providerReadback(phase, 'PASS');
      result = 'COMPLETED';
    }
    const providerBytes = jsonBytes(provider);
    const effect = {
      contract_version: PHYSIO_DEPLOY_EFFECT_RECONCILIATION_CONTRACT_VERSION,
      result,
      phase,
      phase_ordinal: ordinal,
      packet_ordinal: ordinal,
      phase_revision: 0,
      application: 'assesssuite-physio-production',
      application_sha: packetOptions.applicationSha,
      immutable_image: packetOptions.immutableImage,
      expected_volume_id: packetOptions.expectedVolumeId,
      publication_receipt_sha256: packetOptions.publicationReceiptSha256,
      canary_receipt_sha256: packetOptions.canaryReceiptSha256,
      bootstrap_receipt_sha256: packetOptions.bootstrapReceiptSha256,
      stripe_webhook_receipt_sha256: packetOptions.stripeWebhookReceiptSha256,
      sentry_release_receipt_sha256: packetOptions.sentryReleaseReceiptSha256,
      config_sha256: packetOptions.configSha256,
      upstream_artifact_metadata_sha256: packetOptions.upstreamArtifactMetadataSha256,
      capability_intent_id: packetOptions.capabilityIntentId,
      authority_reference: packetOptions.authorityReference,
      publication_capability_intent_id: packetOptions.publicationCapabilityIntentId,
      publication_authority_reference: packetOptions.publicationAuthorityReference,
      bootstrap_capability_intent_id: packetOptions.bootstrapCapabilityIntentId,
      bootstrap_authority_reference: packetOptions.bootstrapAuthorityReference,
      canary_capability_intent_id: packetOptions.canaryCapabilityIntentId,
      canary_authority_reference: packetOptions.canaryAuthorityReference,
      stripe_webhook_capability_intent_id: packetOptions.stripeWebhookCapabilityIntentId,
      stripe_webhook_authority_reference: packetOptions.stripeWebhookAuthorityReference,
      sentry_capability_intent_id: packetOptions.sentryCapabilityIntentId,
      sentry_authority_reference: packetOptions.sentryAuthorityReference,
      predecessor_phase_receipt_sha256: predecessorPhase,
      provider_readback_sha256: sha256(providerBytes),
      provider_subeffects: structuredClone(events),
      provider_subeffect_requests: structuredClone(requests),
      provider_subeffect_chain_sha256: canonicalSha(events),
      provider_calls_attempted: events.filter((row) => (
        row.state === 'COMPLETED' || row.state === 'STARTED_UNRESOLVED'
      )).length,
      provider_calls_confirmed: events.filter((row) => (
        row.state === 'COMPLETED' || row.state === 'RECONCILED_COMPLETED'
      )).length,
      started_at: '2026-08-22T00:00:00.000Z',
      completed_at: result === 'STARTED' ? null : '2026-08-22T00:59:00.000Z',
    };
    mutate?.({ ordinal, phase, effect, provider });
    const finalProviderBytes = jsonBytes(provider);
    effect.provider_readback_sha256 = sha256(finalProviderBytes);
    const effectBytes = jsonBytes(effect);
    files.set(`deploy-phase-${String(ordinal).padStart(4, '0')}-${phase}-r00.json`, effectBytes);
    files.set(`deploy-readback-${String(ordinal).padStart(4, '0')}-${phase}-r00.json`, finalProviderBytes);
    if (provider.operation_receipt_sha256 !== null) {
      const receiptBytes = Buffer.from(`${provider.operation_kind}:receipt`);
      assert.equal(sha256(receiptBytes), provider.operation_receipt_sha256);
      files.set(`deploy-operation-receipt-${String(ordinal).padStart(4, '0')}.bin`, receiptBytes);
    }
    predecessorPhase = sha256(effectBytes);
    if (ordinal === phaseCount - 1) {
      files.set('deploy-effect-reconciliation.json', effectBytes);
      files.set('deploy-provider-readback.json', finalProviderBytes);
    }
  }
  for (const [name, bytes] of files) fs.writeFileSync(path.join(root, name), bytes, { flag: 'wx' });
  rewriteChecksums(root);
  buildState = null;
  return { root, packetOptions };
}

function rewriteChecksums(root) {
  const names = fs.readdirSync(root).filter((name) => name !== 'SHA256SUMS').sort();
  fs.writeFileSync(path.join(root, 'SHA256SUMS'), `${names.map((name) => (
    `${sha256(fs.readFileSync(path.join(root, name)))}  ${name}`
  )).join('\n')}\n`);
}

test('deploy resume packet validates credential-free STARTED evidence', () => {
  const { root, packetOptions } = buildPacket();
  try {
    const result = readAndValidatePhysioDeployResumePacket(root, packetOptions);
    assert.equal(result.phase, 'STARTED');
    assert.equal(result.result, 'STARTED');
    assert.equal(result.providerCallsAttempted, 0);
    assert.equal(result.providerCallsConfirmed, 0);
    assert.equal(result.resumeCompleted, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deploy resume packet validates the complete Fly and Sentry phase chain', () => {
  const { root, packetOptions } = buildPacket({ phaseCount: PHYSIO_DEPLOY_PHASES.length });
  try {
    const result = readAndValidatePhysioDeployResumePacket(root, packetOptions);
    assert.equal(result.phase, 'COMPLETED');
    assert.equal(result.result, 'COMPLETED');
    assert.equal(result.providerCallsAttempted, 14);
    assert.equal(result.providerCallsConfirmed, 14);
    assert.equal(result.resumeCompleted, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deploy resume packet rejects a forged predecessor phase hash', () => {
  const { root, packetOptions } = buildPacket({
    phaseCount: 2,
    mutate: ({ ordinal, effect }) => {
      if (ordinal === 1) effect.predecessor_phase_receipt_sha256 = 'f'.repeat(64);
    },
  });
  try {
    assert.throws(() => readAndValidatePhysioDeployResumePacket(root, packetOptions), /phase 1 differs/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deploy resume packet rejects a request-manifest and STARTED event splice', () => {
  const { root, packetOptions } = buildPacket({
    phaseCount: 3,
    mutate: ({ phase, effect }) => {
      if (phase !== 'LIVE_MUTATION_STARTED') return;
      effect.provider_subeffect_requests[1].application_sha = 'f'.repeat(40);
      effect.provider_subeffects[2].request_sha256 = canonicalSha(effect.provider_subeffect_requests[1]);
      effect.provider_subeffect_chain_sha256 = canonicalSha(effect.provider_subeffects);
    },
  });
  try {
    assert.throws(() => readAndValidatePhysioDeployResumePacket(root, packetOptions), /request manifest 1 differs/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deploy resume packet rejects continuation after an unresolved provider call', () => {
  const { root, packetOptions } = buildPacket({
    phaseCount: 5,
    unresolvedLiveButContinue: true,
  });
  try {
    assert.throws(() => readAndValidatePhysioDeployResumePacket(root, packetOptions),
      /phase transition 4 differs|phase 2 differs/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deploy resume packet rejects nested or unchecksummed evidence', () => {
  const { root, packetOptions } = buildPacket();
  try {
    fs.mkdirSync(path.join(root, 'foreign'));
    assert.throws(() => readAndValidatePhysioDeployResumePacket(root, packetOptions), /flat/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deploy resume packet rejects checksum-valid reviewed-config substitution', () => {
  const { root, packetOptions } = buildPacket();
  try {
    fs.writeFileSync(path.join(root, 'deploy-reviewed-config.toml'), 'app = "foreign"\n');
    rewriteChecksums(root);
    assert.throws(() => readAndValidatePhysioDeployResumePacket(root, packetOptions), /admission identity differs/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('deploy packet writers durably close an exact provider call', () => {
  const fixture = buildPacket();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-deploy-writer-'));
  try {
    const admissionPath = path.join(fixture.root, 'deploy-admission.json');
    const configPath = path.join(fixture.root, 'deploy-reviewed-config.toml');
    const initialReadbackPath = path.join(fixture.root, 'deploy-readback-0000-STARTED-r00.json');
    const initialEffect = JSON.parse(fs.readFileSync(
      path.join(fixture.root, 'deploy-effect-reconciliation.json'),
      'utf8',
    ));
    const requestPath = path.join(work, 'request-00.json');
    fs.writeFileSync(requestPath, jsonBytes(initialEffect.provider_subeffect_requests[0]));
    const initialPacket = path.join(work, 'phase-00');
    const initial = writeInitialPhysioDeployPacket({
      outputPacketRoot: initialPacket,
      admissionPath,
      configPath,
      providerReadbackPath: initialReadbackPath,
      providerRequestPath: requestPath,
      prestateSha256: initialEffect.provider_subeffects[0].prestate_sha256,
      options: fixture.packetOptions,
      now: '2026-08-22T00:00:00.000Z',
    });
    assert.equal(initial.phase, 'STARTED');
    const initialStarted = JSON.parse(fs.readFileSync(
      path.join(initialPacket, 'deploy-effect-reconciliation.json'),
      'utf8',
    )).provider_subeffects.at(-1);
    const snapshotRequestIdSha256 = sha256('snapshot-request-id');
    const snapshotReadbackPath = path.join(work, 'snapshot-readback.json');
    fs.writeFileSync(snapshotReadbackPath, jsonBytes(providerReadback('SNAPSHOT_COMPLETED', 'PASS', {
      kind: initialStarted.kind,
      effectId: initialStarted.effect_id,
      requestSha256: initialStarted.request_sha256,
      resourceId: predeploySnapshotId,
      providerRequestIdSha256: snapshotRequestIdSha256,
      receiptSha256: null,
      disposition: 'APPLIED',
    })));
    const completedPacket = path.join(work, 'phase-01');
    const completed = writeNextPhysioDeployPacket({
      sourcePacketRoot: initialPacket,
      outputPacketRoot: completedPacket,
      phase: 'SNAPSHOT_COMPLETED',
      result: 'COMPLETED',
      providerReadbackPath: snapshotReadbackPath,
      providerExitCode: 0,
      providerRequestIdSha256: snapshotRequestIdSha256,
      observedResourceId: predeploySnapshotId,
      options: fixture.packetOptions,
      now: '2026-08-22T00:00:30.000Z',
    });
    assert.equal(completed.phase, 'SNAPSHOT_COMPLETED');
    assert.equal(completed.providerCallsAttempted, 1);
    assert.equal(completed.providerCallsConfirmed, 1);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
    fs.rmSync(work, { recursive: true, force: true });
  }
});

test('deploy packet writer reconciles a prior unresolved call before another STARTED effect', () => {
  const fixture = buildPacket();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-deploy-reconcile-'));
  try {
    const initialEffect = JSON.parse(fs.readFileSync(
      path.join(fixture.root, 'deploy-effect-reconciliation.json'),
      'utf8',
    ));
    const request0 = path.join(work, 'request-00.json');
    fs.writeFileSync(request0, jsonBytes(initialEffect.provider_subeffect_requests[0]));
    const initialPacket = path.join(work, 'phase-00');
    writeInitialPhysioDeployPacket({
      outputPacketRoot: initialPacket,
      admissionPath: path.join(fixture.root, 'deploy-admission.json'),
      configPath: path.join(fixture.root, 'deploy-reviewed-config.toml'),
      providerReadbackPath: path.join(fixture.root, 'deploy-readback-0000-STARTED-r00.json'),
      providerRequestPath: request0,
      prestateSha256: initialEffect.provider_subeffects[0].prestate_sha256,
      options: fixture.packetOptions,
      now: '2026-08-22T00:00:00.000Z',
    });
    const initialStarted = JSON.parse(fs.readFileSync(
      path.join(initialPacket, 'deploy-effect-reconciliation.json'),
      'utf8',
    )).provider_subeffects.at(-1);
    const unresolvedReadback = providerReadback('SNAPSHOT_COMPLETED', 'STARTED_UNRESOLVED', {
      kind: initialStarted.kind,
      effectId: initialStarted.effect_id,
      requestSha256: initialStarted.request_sha256,
      resourceId: initialStarted.intended_resource_id,
      providerRequestIdSha256: null,
      receiptSha256: null,
      disposition: 'AMBIGUOUS',
    });
    unresolvedReadback.observed_predeploy_snapshot_id = null;
    const unresolvedReadbackPath = path.join(work, 'snapshot-unresolved.json');
    fs.writeFileSync(unresolvedReadbackPath, jsonBytes(unresolvedReadback));
    const unresolvedPacket = path.join(work, 'phase-01-unresolved');
    writeNextPhysioDeployPacket({
      sourcePacketRoot: initialPacket,
      outputPacketRoot: unresolvedPacket,
      phase: 'SNAPSHOT_COMPLETED',
      result: 'STARTED_UNRESOLVED',
      providerReadbackPath: unresolvedReadbackPath,
      providerExitCode: 124,
      providerRequestIdSha256: null,
      observedResourceId: null,
      options: fixture.packetOptions,
      now: '2026-08-22T00:01:00.000Z',
    });
    const reconciledReadbackPath = path.join(work, 'snapshot-reconciled.json');
    const originalPrestate = JSON.parse(fs.readFileSync(
      path.join(initialPacket, 'deploy-provider-readback.json'),
      'utf8',
    ));
    const forgedAppliedPath = path.join(work, 'snapshot-forged-applied.json');
    fs.writeFileSync(forgedAppliedPath, jsonBytes({
      ...originalPrestate,
      result: 'PASS',
      phase: 'SNAPSHOT_COMPLETED',
      operation_kind: initialStarted.kind,
      operation_effect_id: initialStarted.effect_id,
      operation_request_sha256: initialStarted.request_sha256,
      operation_resource_id: predeploySnapshotId,
      operation_provider_request_id_sha256: null,
      operation_receipt_sha256: null,
      operation_disposition: 'APPLIED',
      readback_at: '2026-08-22T00:01:30.000Z',
    }));
    assert.throws(() => writeNextPhysioDeployPacket({
      sourcePacketRoot: unresolvedPacket,
      outputPacketRoot: path.join(work, 'forged-applied-packet'),
      phase: 'SNAPSHOT_COMPLETED',
      result: 'COMPLETED',
      providerReadbackPath: forgedAppliedPath,
      providerRequestIdSha256: null,
      observedResourceId: predeploySnapshotId,
      reconciliationDisposition: 'APPLIED',
      options: fixture.packetOptions,
      now: '2026-08-22T00:01:30.000Z',
    }), /predeploy snapshot applied readback differs/);

    const driftedNotAppliedPath = path.join(work, 'snapshot-drifted-not-applied.json');
    fs.writeFileSync(driftedNotAppliedPath, jsonBytes({
      ...originalPrestate,
      result: 'PASS',
      phase: 'SNAPSHOT_COMPLETED',
      snapshot_count: 1,
      observed_snapshot_ids: ['snapshot_foreign_123'],
      snapshots_sha256: sha256('foreign snapshot inventory'),
      operation_kind: initialStarted.kind,
      operation_effect_id: initialStarted.effect_id,
      operation_request_sha256: initialStarted.request_sha256,
      operation_resource_id: initialStarted.intended_resource_id,
      operation_provider_request_id_sha256: null,
      operation_receipt_sha256: null,
      operation_disposition: 'NOT_APPLIED',
      readback_at: '2026-08-22T00:01:45.000Z',
    }));
    assert.throws(() => writeNextPhysioDeployPacket({
      sourcePacketRoot: unresolvedPacket,
      outputPacketRoot: path.join(work, 'drifted-not-applied-packet'),
      phase: 'SNAPSHOT_COMPLETED',
      result: 'STARTED',
      providerReadbackPath: driftedNotAppliedPath,
      providerRequestIdSha256: null,
      observedResourceId: initialStarted.intended_resource_id,
      reconciliationDisposition: 'NOT_APPLIED',
      options: fixture.packetOptions,
      now: '2026-08-22T00:01:45.000Z',
    }), /NOT_APPLIED readback does not equal its exact prestate/);

    fs.writeFileSync(reconciledReadbackPath, jsonBytes({
      ...originalPrestate,
      result: 'PASS',
      phase: 'SNAPSHOT_COMPLETED',
      operation_kind: initialStarted.kind,
      operation_effect_id: initialStarted.effect_id,
      operation_request_sha256: initialStarted.request_sha256,
      operation_resource_id: initialStarted.intended_resource_id,
      operation_provider_request_id_sha256: null,
      operation_receipt_sha256: null,
      operation_disposition: 'NOT_APPLIED',
      readback_at: '2026-08-22T00:02:00.000Z',
    }));
    const nextPacket = path.join(work, 'phase-02');
    const next = writeNextPhysioDeployPacket({
      sourcePacketRoot: unresolvedPacket,
      outputPacketRoot: nextPacket,
      phase: 'SNAPSHOT_COMPLETED',
      result: 'STARTED',
      providerReadbackPath: reconciledReadbackPath,
      providerRequestIdSha256: null,
      observedResourceId: initialStarted.intended_resource_id,
      reconciliationDisposition: 'NOT_APPLIED',
      options: fixture.packetOptions,
      now: '2026-08-22T00:02:00.000Z',
    });
    assert.equal(next.phase, 'SNAPSHOT_COMPLETED');
    assert.equal(next.result, 'STARTED');
    assert.equal(next.providerCallsAttempted, 1);
    assert.equal(next.providerCallsConfirmed, 0);
    const effect = JSON.parse(fs.readFileSync(path.join(nextPacket, 'deploy-effect-reconciliation.json'), 'utf8'));
    assert.equal(effect.provider_subeffects.at(-2).state, 'RECONCILED_NOT_APPLIED');
    assert.equal(effect.provider_subeffects.at(-1).state, 'RETRY_STARTED');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
    fs.rmSync(work, { recursive: true, force: true });
  }
});

test('deploy Sentry handoff keeps the exact deploy result inside every durable resume envelope', () => {
  const workflow = fs.readFileSync(
    path.resolve('.github/workflows/physio-production-deploy.yml'),
    'utf8',
  );
  assert.doesNotMatch(workflow, /Resolve exact successful deploy result artifact/);
  assert.doesNotMatch(workflow, /key:\s*['"]deploy_result['"]/);
  assert.match(workflow, /artifact-ids: \$\{\{ needs\.deploy\.outputs\.deploy_artifact_id \}\}/);
  const sameRunDownload = workflow.slice(
    workflow.indexOf('- name: Download exact same-run deploy PASS'),
    workflow.indexOf('- name: Download exact same-run deploy phase handoff'),
  );
  assert.doesNotMatch(sameRunDownload, /(?:repository|run-id):/);
  assert.match(workflow, /envelope="\$RUNNER_TEMP\/physio-deploy-sentry-handoff"/);
  assert.match(workflow, /path: \$\{\{ runner\.temp \}\}\/physio-deploy-sentry-handoff/);
  assert.match(workflow, /prior_download\/phase/);
  assert.match(workflow, /prior_download\/deploy-result/);
  assert.match(workflow, /prior_download\/sentry-result/);
  assert.match(workflow, /sentry_result_reuse=true/);
  assert.match(workflow, /validate-deployment[\s\S]*--deploy-receipt-sha256 "\$deploy_receipt_sha"/);
  assert.match(workflow, /deploy_phase_packet_manifest_sha256/);
  assert.match(workflow, /row\.deploy_effect_reconciliation_sha256!==h\(path\.join\(process\.env\.OUTER,phaseNames\[0\]\)\)/);
  assert.match(workflow, /path: \$\{\{ runner\.temp \}\}\/physio-deploy-sentry-started-envelope/);
  assert.match(workflow, /path: \$\{\{ runner\.temp \}\}\/physio-deploy-sentry-terminal-envelope/);
  assert.match(workflow, /steps\.select_sentry_transition\.outputs\.action == 'effect' && steps\.sentry_effect\.outputs\.association_completed != 'true'/);
  assert.match(workflow, /envelope\/sentry-result/);
  assert.match(workflow, /path: \$\{\{ runner\.temp \}\}\/physio-sentry-result/);
  assert.match(workflow, /path: \$\{\{ runner\.temp \}\}\/physio-deploy-sentry-success-envelope/);
  assert.match(workflow, /physio-deploy-completed-reuse-\$\{\{ inputs\.application_sha \}\}-sentry-/);
});
