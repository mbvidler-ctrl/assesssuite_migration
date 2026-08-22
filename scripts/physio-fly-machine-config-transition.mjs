#!/usr/bin/env node

import { createHash } from 'node:crypto';

export const FLY_MACHINE_CONFIG_TRANSITION_CONTRACT =
  'assesssuite-physio-machine-config-transition/1.0.0';
export const PHYSIO_MACHINE_MOUNT_PATH = '/app/server/data';

const MACHINE_ID = /^[0-9a-f]{14,32}$/iu;
const IMAGE = /^registry\.fly\.io\/assesssuite-physio-production@sha256:[0-9a-f]{64}$/u;
const VOLUME = /^vol_[A-Za-z0-9]+$/u;

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

export function machineConfigSha256(config) {
  return sha256(`${canonicalJson(config)}\n`);
}

export function machineEventsSha256(events) {
  return sha256(`${canonicalJson(events)}\n`);
}

export function machineStateSha256(machine) {
  return sha256(`${canonicalJson(machine)}\n`);
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    fail('FLY_MACHINE_CONFIG_TIMESTAMP_INVALID', label);
  }
  return value;
}

function exactConfig(config, { immutableImage, expectedVolumeId }) {
  if (!config || typeof config !== 'object' || Array.isArray(config) ||
      config.image !== immutableImage || !IMAGE.test(immutableImage || '')) {
    fail('FLY_MACHINE_CONFIG_TARGET_INVALID', 'image or config');
  }
  const mounts = config.mounts;
  if (!VOLUME.test(expectedVolumeId || '') || !Array.isArray(mounts) || mounts.length !== 1 ||
      mounts[0]?.volume !== expectedVolumeId || mounts[0]?.path !== PHYSIO_MACHINE_MOUNT_PATH) {
    fail('FLY_MACHINE_CONFIG_TARGET_INVALID', 'mount topology');
  }
  if (config.metadata !== undefined &&
      (!config.metadata || typeof config.metadata !== 'object' || Array.isArray(config.metadata))) {
    fail('FLY_MACHINE_CONFIG_TARGET_INVALID', 'metadata');
  }
  return structuredClone(config);
}

export function validateMachineForConfigTransition(machine, { machineId, immutableImage,
  expectedVolumeId, expectedState = null }) {
  if (!machine || typeof machine !== 'object' || Array.isArray(machine) ||
      machine.id !== machineId || !MACHINE_ID.test(machineId || '') ||
      !['started', 'stopped'].includes(machine.state) ||
      (expectedState !== null && machine.state !== expectedState)) {
    fail('FLY_MACHINE_CONFIG_MACHINE_INVALID', 'identity or state');
  }
  exactConfig(machine.config, { immutableImage, expectedVolumeId });
  if (typeof machine.instance_id !== 'string' || machine.instance_id.length < 1 ||
      machine.instance_id.length > 160 || /[\r\n\0]/u.test(machine.instance_id)) {
    fail('FLY_MACHINE_CONFIG_MACHINE_INVALID', 'instance_id');
  }
  timestamp(machine.updated_at, 'updated_at');
  if (!Array.isArray(machine.events) || machine.events.length > 1000) {
    fail('FLY_MACHINE_CONFIG_MACHINE_INVALID', 'events');
  }
  return machine;
}

export function buildFullMachineConfigUpdate({ targetConfig, immutableImage, expectedVolumeId }) {
  const config = exactConfig(targetConfig, { immutableImage, expectedVolumeId });
  const request = { config };
  return Object.freeze({ request, request_body: JSON.stringify(request),
    request_sha256: sha256(JSON.stringify(request)),
    target_config_sha256: machineConfigSha256(config) });
}

function eventAt(event) {
  const value = event?.timestamp ?? event?.created_at ?? event?.updated_at;
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

function rebootAdvanced(preMachine, current) {
  if (current.instance_id !== preMachine.instance_id ||
      Date.parse(current.updated_at) > Date.parse(preMachine.updated_at)) return true;
  return current.events.some((event) => {
    const type = String(event?.type ?? event?.status ?? '').toLowerCase();
    const at = eventAt(event);
    return ['start', 'started', 'launch', 'update'].includes(type) && at !== null &&
      Date.parse(at) > Date.parse(preMachine.updated_at);
  });
}

export function classifyFullMachineConfigReadback({ preMachine, machines, targetConfig, machineId,
  sourceImage, targetImage, expectedVolumeId }) {
  validateMachineForConfigTransition(preMachine, { machineId, immutableImage: sourceImage,
    expectedVolumeId, expectedState: 'started' });
  const built = buildFullMachineConfigUpdate({ targetConfig, immutableImage: targetImage,
    expectedVolumeId });
  if (!Array.isArray(machines) || machines.length !== 1 || machines[0]?.id !== machineId) {
    return Object.freeze({ disposition: 'AMBIGUOUS', reason: 'machine inventory or identity differs', ...built });
  }
  const current = machines[0];
  const currentImage = current?.config?.image;
  if (![sourceImage, targetImage].includes(currentImage)) {
    return Object.freeze({ disposition: 'AMBIGUOUS', reason: 'machine image left transition lineage', ...built });
  }
  try {
    validateMachineForConfigTransition(current, { machineId, immutableImage: currentImage,
      expectedVolumeId });
  } catch (error) {
    return Object.freeze({ disposition: 'AMBIGUOUS', reason: error.message, ...built });
  }
  const currentConfigSha256 = machineConfigSha256(current.config);
  const preConfigSha256 = machineConfigSha256(preMachine.config);
  const currentEventsSha256 = machineEventsSha256(current.events);
  const preEventsSha256 = machineEventsSha256(preMachine.events);
  if (currentConfigSha256 === built.target_config_sha256 && current.state === 'started') {
    if (preConfigSha256 !== built.target_config_sha256 && !rebootAdvanced(preMachine, current)) {
      return Object.freeze({ disposition: 'AMBIGUOUS', reason: 'target config lacks reboot evidence', ...built });
    }
    return Object.freeze({ disposition: 'APPLIED', reason: preConfigSha256 === built.target_config_sha256
      ? 'exact target config already active' : 'exact target config and reboot observed', ...built,
    observed_machine_id: current.id, observed_config_sha256: currentConfigSha256,
    observed_instance_id: current.instance_id, observed_updated_at: current.updated_at,
    observed_events_sha256: currentEventsSha256 });
  }
  if (currentConfigSha256 === preConfigSha256 && current.state === preMachine.state &&
      current.instance_id === preMachine.instance_id && current.updated_at === preMachine.updated_at &&
      currentEventsSha256 === preEventsSha256) {
    return Object.freeze({ disposition: 'NOT_APPLIED', reason: 'exact prestate remains', ...built,
      observed_machine_id: current.id, observed_config_sha256: currentConfigSha256,
      observed_instance_id: current.instance_id, observed_updated_at: current.updated_at,
      observed_events_sha256: currentEventsSha256 });
  }
  return Object.freeze({ disposition: 'AMBIGUOUS', reason: 'config, state, or reboot evidence differs', ...built });
}

function headersSha256(response) {
  const rows = [...response.headers.entries()].map(([name, value]) => [name.toLowerCase(), value])
    .sort(([left], [right]) => left.localeCompare(right));
  return sha256(JSON.stringify(rows));
}

async function responseText(response, label) {
  const text = await response.text();
  if (Buffer.byteLength(text) > 1_048_576) fail('FLY_MACHINE_CONFIG_RESPONSE_OVERSIZE', label);
  return text;
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeFullMachineConfigTransition({ apiBase, token, preMachine, targetConfig,
  machineId, sourceImage, targetImage, expectedVolumeId, fetchImpl = globalThis.fetch,
  pollAttempts = 20, pollIntervalMs = 3_000, sleepImpl = delay }) {
  if (typeof apiBase !== 'string' || apiBase !==
      'https://api.machines.dev/v1/apps/assesssuite-physio-production' ||
      typeof token !== 'string' || token.length < 20 || typeof fetchImpl !== 'function') {
    fail('FLY_MACHINE_CONFIG_CLIENT_INVALID', 'base, token, or fetch');
  }
  const built = buildFullMachineConfigUpdate({ targetConfig, immutableImage: targetImage,
    expectedVolumeId });
  validateMachineForConfigTransition(preMachine, { machineId, immutableImage: sourceImage,
    expectedVolumeId, expectedState: 'started' });
  const prestateEvidence = Object.freeze({
    pre_machine_sha256: machineStateSha256(preMachine),
    pre_config_sha256: machineConfigSha256(preMachine.config),
    pre_instance_id: preMachine.instance_id,
    pre_updated_at: preMachine.updated_at,
    pre_events_sha256: machineEventsSha256(preMachine.events),
  });
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  let inventoryCallsAttempted = 0;
  let inventoryCallsConfirmed = 0;
  const inventoryReceipts = [];
  const list = async () => {
    inventoryCallsAttempted += 1;
    const response = await fetchImpl(`${apiBase}/machines`, { method: 'GET', redirect: 'error',
      signal: AbortSignal.timeout(60_000), headers });
    const text = await responseText(response, 'machine inventory');
    inventoryReceipts.push({ http_status: response.status, response_body_sha256: sha256(text),
      response_headers_sha256: headersSha256(response) });
    if (response.status !== 200) fail('FLY_MACHINE_CONFIG_INVENTORY_STATUS', String(response.status));
    inventoryCallsConfirmed += 1;
    const value = JSON.parse(text);
    if (!Array.isArray(value) || value.length > 100) fail('FLY_MACHINE_CONFIG_INVENTORY_INVALID', 'rows');
    return value;
  };
  let initial;
  try {
    initial = classifyFullMachineConfigReadback({ preMachine, machines: await list(), targetConfig,
      machineId, sourceImage, targetImage, expectedVolumeId });
  } catch (error) {
    return Object.freeze({ contract_version: FLY_MACHINE_CONFIG_TRANSITION_CONTRACT,
      result: 'STARTED_UNRESOLVED', disposition: 'AMBIGUOUS', reason: error.message,
      provider_mutation_calls_attempted: 0, provider_mutation_calls_confirmed: 0,
      provider_mutation_responses_received: 0, provider_inventory_calls_attempted: inventoryCallsAttempted,
      provider_inventory_calls_confirmed: inventoryCallsConfirmed, inventory_receipts: inventoryReceipts,
      mutation_receipt: null, ...built, ...prestateEvidence });
  }
  if (initial.disposition === 'APPLIED') {
    return Object.freeze({ contract_version: FLY_MACHINE_CONFIG_TRANSITION_CONTRACT, result: 'PASS',
      ...initial, provider_mutation_calls_attempted: 0, provider_mutation_calls_confirmed: 0,
      provider_mutation_responses_received: 0, provider_inventory_calls_attempted: inventoryCallsAttempted,
      provider_inventory_calls_confirmed: inventoryCallsConfirmed, inventory_receipts: inventoryReceipts,
      mutation_receipt: null, ...prestateEvidence });
  }
  if (initial.disposition !== 'NOT_APPLIED') {
    return Object.freeze({ contract_version: FLY_MACHINE_CONFIG_TRANSITION_CONTRACT,
      result: 'STARTED_UNRESOLVED', ...initial, provider_mutation_calls_attempted: 0,
      provider_mutation_calls_confirmed: 0, provider_mutation_responses_received: 0,
      provider_inventory_calls_attempted: inventoryCallsAttempted,
      provider_inventory_calls_confirmed: inventoryCallsConfirmed, inventory_receipts: inventoryReceipts,
      mutation_receipt: null, ...prestateEvidence });
  }
  let mutationResponse = null;
  let mutationError = null;
  try {
    mutationResponse = await fetchImpl(`${apiBase}/machines/${machineId}`, { method: 'POST', redirect: 'error',
      signal: AbortSignal.timeout(120_000), headers: { ...headers, 'Content-Type': 'application/json' },
      body: built.request_body });
  } catch (error) {
    mutationError = error;
  }
  let mutationReceipt = null;
  if (mutationResponse) {
    const text = await responseText(mutationResponse, 'machine update');
    mutationReceipt = { http_status: mutationResponse.status, response_body_sha256: sha256(text),
      response_headers_sha256: headersSha256(mutationResponse) };
  } else if (mutationError) {
    mutationReceipt = { error_sha256: sha256(String(mutationError.message || mutationError)) };
  }
  let outcome = initial;
  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    if (attempt > 0) await sleepImpl(pollIntervalMs);
    try {
      outcome = classifyFullMachineConfigReadback({ preMachine, machines: await list(), targetConfig,
        machineId, sourceImage, targetImage, expectedVolumeId });
      if (outcome.disposition !== 'AMBIGUOUS') break;
    } catch (error) {
      outcome = { disposition: 'AMBIGUOUS', reason: error.message, ...built };
    }
  }
  return Object.freeze({ contract_version: FLY_MACHINE_CONFIG_TRANSITION_CONTRACT,
    result: outcome.disposition === 'APPLIED' ? 'PASS' : 'STARTED_UNRESOLVED', ...outcome,
    provider_mutation_calls_attempted: 1,
    provider_mutation_calls_confirmed: outcome.disposition === 'APPLIED' ? 1 : 0,
    provider_mutation_responses_received: mutationResponse ? 1 : 0,
    provider_inventory_calls_attempted: inventoryCallsAttempted,
    provider_inventory_calls_confirmed: inventoryCallsConfirmed,
    inventory_receipts: inventoryReceipts, mutation_receipt: mutationReceipt, ...prestateEvidence });
}
