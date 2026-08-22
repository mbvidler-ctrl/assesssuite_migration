import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RESTART_MARKER_KEY,
  buildRestartUpdate,
  classifyRestartResult,
} from '../../scripts/physio-fly-restart-contract.mjs';

const applicationSha = 'a'.repeat(40);
const machineId = '1234567890abcdef';
const image = `registry.fly.io/assesssuite-physio-production@sha256:${'b'.repeat(64)}`;
const volumeId = 'vol_physio123';
const effectId = `deploy:${applicationSha}:12:production_machine_restart`;

function machine(overrides = {}) {
  return {
    id: machineId, state: 'started', instance_id: 'instance-pre',
    updated_at: '2026-08-22T00:00:00.000Z', events: [{ type: 'start', timestamp: '2026-08-21T23:59:00.000Z' }],
    config: { image, env: { APP_PROFESSION: 'physio' }, metadata: { release: applicationSha },
      mounts: [{ volume: volumeId, path: '/app/server/data' }], guest: { cpus: 1, memory_mb: 512 } },
    ...overrides,
  };
}

function args(preMachine = machine(), machines = []) {
  return { preMachine, machines, applicationSha, effectId, machineId,
    immutableImage: image, expectedVolumeId: volumeId };
}

test('restart update preserves the complete config and adds one deterministic intent marker', () => {
  const pre = machine();
  const first = buildRestartUpdate({ machine: pre, applicationSha, effectId, machineId,
    immutableImage: image, expectedVolumeId: volumeId });
  const second = buildRestartUpdate({ machine: structuredClone(pre), applicationSha, effectId, machineId,
    immutableImage: image, expectedVolumeId: volumeId });
  assert.equal(first.restart_intent_sha256, second.restart_intent_sha256);
  assert.deepEqual(first.request.config, { ...pre.config,
    metadata: { ...pre.config.metadata, [RESTART_MARKER_KEY]: first.restart_intent_sha256 } });
  assert.deepEqual(pre.config.metadata, { release: applicationSha });
});

test('response-loss readback proves APPLIED only for the same machine full config marker and reboot evidence', () => {
  const pre = machine();
  const built = buildRestartUpdate({ machine: pre, applicationSha, effectId, machineId,
    immutableImage: image, expectedVolumeId: volumeId });
  const post = machine({ instance_id: 'instance-post', updated_at: '2026-08-22T00:00:05.000Z',
    events: [...pre.events, { type: 'start', timestamp: '2026-08-22T00:00:04.000Z' }],
    config: built.request.config });
  const result = classifyRestartResult(args(pre, [post]));
  assert.equal(result.disposition, 'APPLIED');
  assert.equal(result.observed_machine_id, machineId);
  assert.equal(result.restart_intent_sha256, built.restart_intent_sha256);
});

test('exact prestate is NOT_APPLIED while marker drift missing reboot and topology attacks are ambiguous', () => {
  const pre = machine();
  assert.equal(classifyRestartResult(args(pre, [structuredClone(pre)])).disposition, 'NOT_APPLIED');
  const built = buildRestartUpdate({ machine: pre, applicationSha, effectId, machineId,
    immutableImage: image, expectedVolumeId: volumeId });
  assert.equal(classifyRestartResult(args(pre, [machine({ config: built.request.config })])).disposition, 'AMBIGUOUS');
  assert.equal(classifyRestartResult(args(pre, [machine({ id: 'fedcba0987654321', config: built.request.config })])).disposition,
    'AMBIGUOUS');
  assert.equal(classifyRestartResult(args(pre, [machine({ config: built.request.config }), machine()])).disposition,
    'AMBIGUOUS');
  const altered = structuredClone(built.request.config);
  altered.guest.memory_mb = 1024;
  assert.equal(classifyRestartResult(args(pre, [machine({ instance_id: 'instance-post',
    updated_at: '2026-08-22T00:00:05.000Z', config: altered })])).disposition, 'AMBIGUOUS');
});
