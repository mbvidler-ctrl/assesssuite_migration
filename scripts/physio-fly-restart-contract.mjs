#!/usr/bin/env node

import { createHash } from 'node:crypto';

export const FLY_RESTART_INTENT_CONTRACT = 'assesssuite-physio-machine-restart-intent/1.0.0';
export const FLY_RESTART_RECEIPT_CONTRACT = 'assesssuite-physio-machine-restart-operation/2.0.0';
export const RESTART_MARKER_KEY = 'assesssuite_restart_intent_sha256';

const SHA40 = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const MACHINE_ID = /^[0-9a-f]{14,32}$/iu;
const IMAGE = /^registry\.fly\.io\/assesssuite-physio-production@sha256:[0-9a-f]{64}$/u;

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function configSha256(config) {
  return sha256(`${canonicalJson(config)}\n`);
}

function eventsSha256(events) {
  return sha256(`${canonicalJson(events)}\n`);
}

function clone(value) {
  return structuredClone(value);
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail('FLY_RESTART_MACHINE_INVALID', label);
  return value;
}

function machineConfig(machine) {
  const config = machine?.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) fail('FLY_RESTART_MACHINE_INVALID', 'config');
  return config;
}

function validateTopology(machine, { machineId, immutableImage, expectedVolumeId }) {
  if (!machine || typeof machine !== 'object' || Array.isArray(machine) || machine.id !== machineId ||
      !MACHINE_ID.test(machineId || '') || machine.state !== 'started' ||
      machineConfig(machine).image !== immutableImage || !IMAGE.test(immutableImage || '')) {
    fail('FLY_RESTART_MACHINE_INVALID', 'machine identity/state/image');
  }
  const mounts = machine.config.mounts;
  if (!Array.isArray(mounts) || mounts.length !== 1 || mounts[0]?.volume !== expectedVolumeId ||
      mounts[0]?.path !== '/app/server/data' || !/^vol_[A-Za-z0-9]+$/u.test(expectedVolumeId || '')) {
    fail('FLY_RESTART_MACHINE_INVALID', 'mount topology');
  }
  if (typeof machine.instance_id !== 'string' || machine.instance_id.length < 1 || machine.instance_id.length > 160 ||
      /[\r\n\0]/u.test(machine.instance_id)) fail('FLY_RESTART_MACHINE_INVALID', 'instance_id');
  timestamp(machine.updated_at, 'updated_at');
  if (!Array.isArray(machine.events) || machine.events.length > 1000) fail('FLY_RESTART_MACHINE_INVALID', 'events');
  return machine;
}

export function configWithoutRestartMarker(config) {
  const clean = clone(config);
  const metadata = clean.metadata;
  if (metadata !== undefined) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      fail('FLY_RESTART_MACHINE_INVALID', 'metadata');
    }
    delete metadata[RESTART_MARKER_KEY];
    if (Object.keys(metadata).length === 0) delete clean.metadata;
  }
  return clean;
}

export function buildRestartUpdate({ machine, applicationSha, effectId, machineId, immutableImage,
  expectedVolumeId }) {
  validateTopology(machine, { machineId, immutableImage, expectedVolumeId });
  if (!SHA40.test(applicationSha || '') || !/^[A-Za-z0-9._:-]{1,200}$/u.test(effectId || '')) {
    fail('FLY_RESTART_INPUT_INVALID', 'effect identity');
  }
  const preConfig = configWithoutRestartMarker(machine.config);
  const intent = { contract_version: FLY_RESTART_INTENT_CONTRACT, application_sha: applicationSha,
    effect_id: effectId, machine_id: machineId,
    prestate_config_sha256: configSha256(preConfig),
    prestate_instance_id: machine.instance_id, prestate_updated_at: machine.updated_at };
  const marker = sha256(canonicalJson(intent));
  const nextConfig = clone(machine.config);
  nextConfig.metadata = { ...(nextConfig.metadata || {}), [RESTART_MARKER_KEY]: marker };
  return Object.freeze({ intent, restart_intent_sha256: marker,
    request: { config: nextConfig }, request_sha256: sha256(JSON.stringify({ config: nextConfig })) });
}

export function restartIntentFromPrestate({ prestate, applicationSha, effectId, machineId }) {
  if (!prestate || !SHA256.test(prestate.observed_config_sha256 || '') ||
      !SHA256.test(prestate.observed_config_without_restart_sha256 || '') ||
      !(prestate.observed_restart_intent_sha256 === null ||
        SHA256.test(prestate.observed_restart_intent_sha256 || '')) ||
      typeof prestate.observed_machine_instance_id !== 'string' || prestate.observed_machine_instance_id.length < 1 ||
      !Number.isFinite(Date.parse(prestate.observed_machine_updated_at || '')) || !SHA40.test(applicationSha || '') ||
      !MACHINE_ID.test(machineId || '') || !/^[A-Za-z0-9._:-]{1,200}$/u.test(effectId || '')) {
    fail('FLY_RESTART_PRESTATE_INVALID', 'prestate identity');
  }
  const intent = { contract_version: FLY_RESTART_INTENT_CONTRACT, application_sha: applicationSha,
    effect_id: effectId, machine_id: machineId,
    prestate_config_sha256: prestate.observed_config_without_restart_sha256,
    prestate_instance_id: prestate.observed_machine_instance_id,
    prestate_updated_at: prestate.observed_machine_updated_at };
  return Object.freeze({ intent, restart_intent_sha256: sha256(canonicalJson(intent)) });
}

export function classifyRestartReadback({ prestate, machines, applicationSha, effectId, machineId,
  immutableImage, expectedVolumeId }) {
  const built = restartIntentFromPrestate({ prestate, applicationSha, effectId, machineId });
  if (!Array.isArray(machines) || machines.length !== 1) {
    return Object.freeze({ disposition: 'AMBIGUOUS', reason: 'machine inventory count differs', ...built });
  }
  const current = machines[0];
  if (current?.id !== machineId) {
    return Object.freeze({ disposition: 'AMBIGUOUS', reason: 'machine was replaced', ...built });
  }
  try { validateTopology(current, { machineId, immutableImage, expectedVolumeId }); } catch (error) {
    return Object.freeze({ disposition: 'AMBIGUOUS', reason: error.message, ...built });
  }
  const currentMarker = current.config.metadata?.[RESTART_MARKER_KEY] ?? null;
  const unmarkedHash = configSha256(configWithoutRestartMarker(current.config));
  if (currentMarker === prestate.observed_restart_intent_sha256 &&
      configSha256(current.config) === prestate.observed_config_sha256 &&
      unmarkedHash === prestate.observed_config_without_restart_sha256 &&
      current.instance_id === prestate.observed_machine_instance_id &&
      current.updated_at === prestate.observed_machine_updated_at &&
      eventsSha256(current.events) === prestate.observed_machine_events_sha256) {
    return Object.freeze({ disposition: 'NOT_APPLIED', reason: 'exact prestate remains', ...built });
  }
  if (currentMarker !== built.restart_intent_sha256 ||
      unmarkedHash !== prestate.observed_config_without_restart_sha256) {
    return Object.freeze({ disposition: 'AMBIGUOUS', reason: 'marker or full config differs', ...built });
  }
  const instanceChanged = current.instance_id !== prestate.observed_machine_instance_id;
  const updatedAdvanced = Date.parse(current.updated_at) > Date.parse(prestate.observed_machine_updated_at);
  const startEventAdvanced = current.events.some((event) => isStartEvent(event) &&
    eventAt(event) !== null && Date.parse(eventAt(event)) > Date.parse(prestate.observed_machine_updated_at));
  if (!instanceChanged && !updatedAdvanced && !startEventAdvanced) {
    return Object.freeze({ disposition: 'AMBIGUOUS', reason: 'restart evidence did not advance', ...built });
  }
  return Object.freeze({ disposition: 'APPLIED', reason: 'exact marked update and restart observed', ...built,
    observed_machine_id: current.id, prestate_instance_id: prestate.observed_machine_instance_id,
    observed_instance_id: current.instance_id, prestate_updated_at: prestate.observed_machine_updated_at,
    observed_updated_at: current.updated_at, observed_events_sha256: eventsSha256(current.events),
    full_config_without_marker_sha256: unmarkedHash });
}

function eventAt(event) {
  const value = event?.timestamp ?? event?.created_at ?? event?.updated_at;
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function isStartEvent(event) {
  return ['start', 'started', 'launch', 'update'].includes(String(event?.type ?? event?.status ?? '').toLowerCase());
}

export function classifyRestartResult({ preMachine, machines, applicationSha, effectId, machineId,
  immutableImage, expectedVolumeId }) {
  const built = buildRestartUpdate({ machine: preMachine, applicationSha, effectId, machineId,
    immutableImage, expectedVolumeId });
  const prestate = { observed_config_sha256: configSha256(preMachine.config),
    observed_config_without_restart_sha256: built.intent.prestate_config_sha256,
    observed_restart_intent_sha256: preMachine.config.metadata?.[RESTART_MARKER_KEY] ?? null,
    observed_machine_instance_id: preMachine.instance_id, observed_machine_updated_at: preMachine.updated_at,
    observed_machine_events_sha256: eventsSha256(preMachine.events) };
  return classifyRestartReadback({ prestate, machines, applicationSha, effectId, machineId,
    immutableImage, expectedVolumeId });
}
