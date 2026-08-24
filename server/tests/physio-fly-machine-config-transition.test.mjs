import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PHYSIO_MACHINE_MOUNT_PATH,
  buildFullMachineConfigUpdate,
  classifyFullMachineConfigReadback,
  executeFullMachineConfigTransition,
  machineConfigSha256,
} from '../../scripts/physio-fly-machine-config-transition.mjs';

const machineId = 'abcdef12345678';
const volumeId = 'vol_physio123';
const sourceImage = `registry.fly.io/assesssuite-physio-production@sha256:${'a'.repeat(64)}`;
const targetImage = `registry.fly.io/assesssuite-physio-production@sha256:${'b'.repeat(64)}`;

function config(image, marker) {
  return {
    image,
    env: { PROFESSION: 'physio', DEFAULT_APP_ID: 'local-assesssuite-physio' },
    metadata: { assesssuite_restart_intent_sha256: marker },
    mounts: [{ volume: volumeId, path: PHYSIO_MACHINE_MOUNT_PATH }],
    guest: { cpus: 1, memory_mb: 512 },
  };
}

function machine(image, marker, overrides = {}) {
  return {
    id: machineId,
    state: 'started',
    instance_id: 'instance-before',
    updated_at: '2026-08-22T00:00:00.000Z',
    events: [{ type: 'start', timestamp: '2026-08-22T00:00:00.000Z' }],
    config: config(image, marker),
    ...overrides,
  };
}

test('full-config update preserves every recorded target field including the restart marker', () => {
  const targetConfig = config(targetImage, 'd'.repeat(64));
  const built = buildFullMachineConfigUpdate({ targetConfig, immutableImage: targetImage,
    expectedVolumeId: volumeId });
  assert.deepEqual(built.request, { config: targetConfig });
  assert.equal(built.target_config_sha256, machineConfigSha256(targetConfig));
  assert.equal(built.request_sha256.length, 64);
  assert.equal(built.request.config.metadata.assesssuite_restart_intent_sha256, 'd'.repeat(64));
});

test('response-loss readback proves exact target config only with reboot evidence', () => {
  const preMachine = machine(sourceImage, 'c'.repeat(64));
  const targetConfig = config(targetImage, 'd'.repeat(64));
  const applied = machine(targetImage, 'd'.repeat(64), {
    instance_id: 'instance-after', updated_at: '2026-08-22T00:01:00.000Z',
    events: [...preMachine.events, { type: 'update', timestamp: '2026-08-22T00:01:00.000Z' }],
  });
  assert.equal(classifyFullMachineConfigReadback({ preMachine, machines: [applied], targetConfig,
    machineId, sourceImage, targetImage, expectedVolumeId: volumeId }).disposition, 'APPLIED');
  const noReboot = machine(targetImage, 'd'.repeat(64));
  assert.equal(classifyFullMachineConfigReadback({ preMachine, machines: [noReboot], targetConfig,
    machineId, sourceImage, targetImage, expectedVolumeId: volumeId }).disposition, 'AMBIGUOUS');
});

test('same target on resume is APPLIED and exact unchanged source is NOT_APPLIED', () => {
  const preMachine = machine(sourceImage, 'c'.repeat(64));
  const targetConfig = config(targetImage, 'd'.repeat(64));
  assert.equal(classifyFullMachineConfigReadback({ preMachine, machines: [structuredClone(preMachine)],
    targetConfig, machineId, sourceImage, targetImage, expectedVolumeId: volumeId }).disposition, 'NOT_APPLIED');
  const alreadyTarget = machine(targetImage, 'd'.repeat(64));
  assert.equal(classifyFullMachineConfigReadback({ preMachine: alreadyTarget,
    machines: [structuredClone(alreadyTarget)], targetConfig, machineId, sourceImage: targetImage,
    targetImage, expectedVolumeId: volumeId }).disposition, 'APPLIED');
});

test('wrong marker, config drift, replacement, extra machine, and mount drift are ambiguous', () => {
  const preMachine = machine(sourceImage, 'c'.repeat(64));
  const targetConfig = config(targetImage, 'd'.repeat(64));
  const applied = machine(targetImage, 'd'.repeat(64), {
    instance_id: 'instance-after', updated_at: '2026-08-22T00:01:00.000Z',
    events: [{ type: 'update', timestamp: '2026-08-22T00:01:00.000Z' }],
  });
  const cases = [
    [{ ...applied, id: '99999999999999' }],
    [applied, structuredClone(applied)],
    [{ ...applied, config: config(targetImage, 'e'.repeat(64)) }],
    [{ ...applied, config: { ...targetConfig, env: { PROFESSION: 'exercise-physiology' } } }],
    [{ ...applied, config: { ...targetConfig,
      mounts: [{ volume: volumeId, path: '/data' }] } }],
  ];
  for (const machines of cases) {
    assert.equal(classifyFullMachineConfigReadback({ preMachine, machines, targetConfig, machineId,
      sourceImage, targetImage, expectedVolumeId: volumeId }).disposition, 'AMBIGUOUS');
  }
});

function response(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('lost update response is confirmed by exact full-config readback without a second mutation', async () => {
  const preMachine = machine(sourceImage, 'c'.repeat(64));
  const targetConfig = config(targetImage, 'd'.repeat(64));
  const applied = machine(targetImage, 'd'.repeat(64), {
    instance_id: 'instance-after', updated_at: '2026-08-22T00:01:00.000Z',
    events: [{ type: 'update', timestamp: '2026-08-22T00:01:00.000Z' }],
  });
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push([url, options.method]);
    if (calls.length === 1) return response([preMachine]);
    if (calls.length === 2) throw new Error('response lost');
    return response([applied]);
  };
  const receipt = await executeFullMachineConfigTransition({
    apiBase: 'https://api.machines.dev/v1/apps/assesssuite-physio-production',
    token: 'synthetic-test-token-value', preMachine, targetConfig, machineId, sourceImage, targetImage,
    expectedVolumeId: volumeId, fetchImpl, pollAttempts: 1, pollIntervalMs: 0,
  });
  assert.equal(receipt.result, 'PASS');
  assert.equal(receipt.provider_mutation_calls_attempted, 1);
  assert.equal(receipt.provider_mutation_calls_confirmed, 1);
  assert.equal(receipt.provider_mutation_responses_received, 0);
  assert.equal(receipt.pre_config_sha256, machineConfigSha256(preMachine.config));
  assert.equal(receipt.pre_instance_id, preMachine.instance_id);
  assert.equal(receipt.pre_updated_at, preMachine.updated_at);
  assert.equal(calls.filter(([, method]) => method === 'POST').length, 1);
});

test('recovery uses the captured current config and proves it after a target transition', async () => {
  const original = machine(sourceImage, 'c'.repeat(64));
  const target = machine(targetImage, 'd'.repeat(64), {
    instance_id: 'target-instance', updated_at: '2026-08-22T00:01:00.000Z',
    events: [{ type: 'update', timestamp: '2026-08-22T00:01:00.000Z' }],
  });
  const recovered = machine(sourceImage, 'c'.repeat(64), {
    instance_id: 'recovered-instance', updated_at: '2026-08-22T00:02:00.000Z',
    events: [{ type: 'update', timestamp: '2026-08-22T00:02:00.000Z' }],
  });
  const rows = [[target], response({}, 200), [recovered]];
  let index = 0;
  const fetchImpl = async () => {
    const row = rows[index++];
    return row instanceof Response ? row : response(row);
  };
  const receipt = await executeFullMachineConfigTransition({
    apiBase: 'https://api.machines.dev/v1/apps/assesssuite-physio-production',
    token: 'synthetic-test-token-value', preMachine: target, targetConfig: original.config,
    machineId, sourceImage: targetImage, targetImage: sourceImage, expectedVolumeId: volumeId,
    fetchImpl, pollAttempts: 1, pollIntervalMs: 0,
  });
  assert.equal(receipt.result, 'PASS');
  assert.equal(receipt.observed_config_sha256, machineConfigSha256(original.config));
  assert.equal(receipt.provider_mutation_calls_confirmed, 1);
});
