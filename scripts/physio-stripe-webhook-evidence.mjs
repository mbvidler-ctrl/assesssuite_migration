#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const STRIPE_WEBHOOK_METADATA_KEYS = Object.freeze([
  'appId',
  'applicationSha',
  'bootstrapReceiptSha256',
  'capabilityIntentId',
  'effectGeneration',
  'professionId',
  'requestSha256',
  'startedEffectReceiptSha256',
]);

const ENDPOINT_KEYS = Object.freeze([
  'api_version',
  'enabled_events',
  'id',
  'metadata',
  'status',
  'url',
]);
const EVENTS = Object.freeze([
  'checkout.session.completed',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'invoice.payment_failed',
]);
const APPLICATION_SHA = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_INTENT = /^[A-Za-z0-9._:-]{1,160}$/;
const ENDPOINT_ID = /^we_[A-Za-z0-9]+$/;
const ENDPOINT_URL =
  'https://assesssuite-physio-production.fly.dev/api/apps/local-assesssuite-physio/functions/stripeWebhook';
const ZERO_SHA256 = '0'.repeat(64);
const PREDECESSOR_CONTROL_KINDS = Object.freeze([
  'EFFECT_RECONCILIATION',
  'NOT_APPLICABLE',
  'TERMINAL_COMPENSATION',
]);
const FLY_SECRET_BASE_NAMES = Object.freeze([
  'ADMIN_PASSWORD',
  'APP_URL',
  'EXPECTED_APP_URL',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'SENTRY_DSN',
  'STRIPE_PRICE_ID_ANNUAL',
  'STRIPE_PRICE_ID_MONTHLY',
  'STRIPE_SECRET_KEY',
].sort());
const SECRET_VALUE = /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|Bearer\s+[A-Za-z0-9._~+\/-]+|-----BEGIN [A-Z ]+PRIVATE KEY-----/i;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const FORBIDDEN_EXACT_KEYS = new Set([
  'secret', 'raw_secret', 'raw_value', 'client_secret', 'api_key', 'authorization',
  'password', 'cvc', 'cvv', 'card_number', 'email',
]);

const COMPLETED_PACKET_CORE_FILES = Object.freeze([
  'SHA256SUMS',
  'fly-secrets-after.json',
  'fly-secrets-before.json',
  'outstanding-effect-inventory.json',
  'physio-production-stripe-webhook.json',
  'provider-plan-probe-readback.json',
  'provider-plan-request-id-hashes.json',
  'provider-plan.json',
  'provider-request-id-hashes.json',
  'resume-artifact-admission.json',
  'resume-sibling-inventory.json',
  'stripe-create-response-sanitized.json',
  'stripe-endpoint-readback.json',
  'stripe-endpoints-after.json',
  'stripe-endpoints-before.json',
  'stripe-webhook-effect-reconciliation.json',
  'stripe-webhook-effect-identity.json',
  'stripe-webhook-request-manifest.json',
]);

const COMPENSATION_PACKET_CORE_FILES = Object.freeze([
  'SHA256SUMS',
  'outstanding-effect-inventory.json',
  'provider-probe-request-id-hashes.json',
  'resume-artifact-admission.json',
  'resume-sibling-inventory.json',
  'stripe-provider-plan.json',
  'stripe-provider-probe.json',
  'stripe-webhook-effect-identity.json',
  'stripe-webhook-effect-reconciliation.json',
  'stripe-webhook-request-manifest.json',
]);
const COMPENSATION_PHASE_CONTRACT =
  'assesssuite-physio-stripe-webhook-compensation-phase/2.0.0';
const COMPENSATION_OPERATION = 'DELETE';
const COMPENSATION_PHASE_KEYS = Object.freeze([
  'application_sha',
  'artifact_admission_sha256',
  'authority_reference',
  'bootstrap_receipt_sha256',
  'capability_intent_id',
  'completed_at',
  'compensation_effect_identity_sha256',
  'contract_version',
  'created_at',
  'delete_request_id_sha256',
  'delete_response_sha256',
  'effect_generation',
  'effect_identity_receipt_sha256',
  'idempotency_key_sha256',
  'operation',
  'phase',
  'previous_phase_receipt_sha256',
  'prior_effect_lineage_sha256',
  'prior_effect_receipt_sha256',
  'provider_plan_receipt_sha256',
  'readback_request_id_hashes_sha256',
  'readback_sha256',
  'request_sha256',
  'result',
  'revision',
  'started_effect_receipt_sha256',
  'target_effect_generation',
  'target_effect_identity_receipt_sha256',
  'target_endpoint_id',
  'target_endpoint_id_sha256',
  'target_metadata',
  'target_request_sha256',
]);
const STARTED_EFFECT_KEYS = Object.freeze([
  'admission_receipt_sha256', 'application', 'application_sha', 'authority_reference',
  'bootstrap_receipt_sha256', 'capability_intent_id', 'completed_at',
  'compensation_absence_readback_sha256', 'compensation_delete_request_id_sha256',
  'contract_version', 'effect_generation', 'effect_identity_receipt_sha256',
  'exact_image_canary_receipt_sha256', 'fly_secret_import_exit_code', 'fly_secret_prestate',
  'fly_secret_readback_sha256', 'idempotency_key_sha256', 'orphan_compensation_authorized',
  'orphan_compensation_contract_version', 'orphan_compensation_policy',
  'orphan_endpoint_compensated', 'orphan_endpoint_id_sha256', 'prior_artifact_admission_sha256',
  'prior_effect_readback_sha256', 'prior_effect_resolution', 'prior_idempotency_key_sha256',
  'predecessor_control_kind', 'predecessor_control_receipt_sha256',
  'prior_request_sha256', 'provider_create_exit_code', 'provider_create_http_status',
  'provider_endpoint_readback_sha256', 'provider_list_before_sha256', 'request_sha256', 'result',
  'resume_started_effect_receipt_sha256', 'started_at',
]);
const EFFECT_IDENTITY_KEYS = Object.freeze([
  'application', 'application_sha', 'authority_reference', 'bootstrap_receipt_sha256',
  'capability_intent_id', 'contract_version', 'effect_generation', 'exact_image_canary_receipt_sha256',
  'idempotency_key_sha256', 'prior_artifact_admission_sha256', 'prior_effect_receipt_sha256',
  'predecessor_control_kind', 'predecessor_control_receipt_sha256',
  'prior_idempotency_key_sha256', 'prior_request_sha256', 'result',
]);
const REQUEST_MANIFEST_KEYS = Object.freeze([
  'api_version', 'authority_reference', 'capability_intent_id', 'effect_generation', 'enabled_events',
  'endpoint', 'idempotency_key_sha256', 'metadata', 'prior_artifact_admission_sha256',
  'predecessor_control_kind', 'predecessor_control_receipt_sha256',
  'prior_effect_receipt_sha256', 'prior_idempotency_key_sha256', 'prior_request_sha256', 'request_sha256',
]);
const PROVIDER_PLAN_KEYS = Object.freeze([
  'application', 'application_sha', 'authority_reference', 'bootstrap_receipt_sha256',
  'capability_intent_id', 'contract_version', 'current_effect_identity_receipt_sha256', 'effect_generation',
  'endpoint_effect_generation', 'endpoint_lineage', 'endpoint_request_sha256',
  'endpoint_started_effect_receipt_sha256', 'exact_endpoint_id', 'exact_endpoint_id_sha256',
  'observed_endpoint_effect_generation', 'observed_endpoint_lineage', 'observed_endpoint_request_sha256',
  'observed_endpoint_started_effect_receipt_sha256', 'planned_action', 'prior_effect_readback_sha256',
  'prior_effect_receipt_sha256', 'prior_effect_resolution', 'probed_at', 'provider_mutation_absent',
  'provider_probe_readback_sha256', 'provider_probe_request_id_hashes_sha256', 'provider_state',
  'request_sha256', 'result', 'started_effect_receipt_sha256',
]);

function fail(message) {
  throw new Error(`Physio Stripe webhook evidence: ${message}`);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(`${label} exact key allowlist differs`);
  }
}

function exactMetadata(metadata, expectedMetadata) {
  const metadataKeys = Object.keys(metadata || {}).sort();
  if (JSON.stringify(metadataKeys) !== JSON.stringify([...STRIPE_WEBHOOK_METADATA_KEYS].sort())) {
    fail('endpoint metadata exact key allowlist differs');
  }
  exactKeys(expectedMetadata, STRIPE_WEBHOOK_METADATA_KEYS, 'expected endpoint metadata');
  if (metadata.appId !== 'local-assesssuite-physio' || metadata.professionId !== 'physio' ||
      !APPLICATION_SHA.test(metadata.applicationSha || '') ||
      !SHA256.test(metadata.bootstrapReceiptSha256 || '') ||
      !SAFE_INTENT.test(metadata.capabilityIntentId || '') ||
      !/^(?:0|[1-9][0-9]*)$/.test(metadata.effectGeneration || '') ||
      !Number.isSafeInteger(Number(metadata.effectGeneration)) ||
      !SHA256.test(metadata.requestSha256 || '') ||
      !SHA256.test(metadata.startedEffectReceiptSha256 || '') ||
      STRIPE_WEBHOOK_METADATA_KEYS.some((key) => metadata[key] !== expectedMetadata[key])) {
    fail('endpoint metadata identity differs');
  }
  return Object.freeze({
    appId: metadata.appId,
    applicationSha: metadata.applicationSha,
    bootstrapReceiptSha256: metadata.bootstrapReceiptSha256,
    capabilityIntentId: metadata.capabilityIntentId,
    effectGeneration: metadata.effectGeneration,
    professionId: metadata.professionId,
    requestSha256: metadata.requestSha256,
    startedEffectReceiptSha256: metadata.startedEffectReceiptSha256,
  });
}

export function sanitizeStripeWebhookEndpoint(value, expectedMetadata) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('endpoint must be an object');
  const metadata = exactMetadata(value.metadata, expectedMetadata);
  if (!ENDPOINT_ID.test(value.id || '') || value.url !== ENDPOINT_URL || value.status !== 'enabled' ||
      value.api_version !== '2026-07-29.dahlia' ||
      JSON.stringify(value.enabled_events) !== JSON.stringify(EVENTS)) {
    fail('endpoint identity differs');
  }
  return Object.freeze({
    id: value.id,
    url: value.url,
    status: value.status,
    api_version: value.api_version,
    enabled_events: [...EVENTS],
    metadata,
  });
}

export function classifyStripeWebhookEndpointLineage(value, { currentMetadata, priorMetadata }) {
  const options = { currentMetadata, priorMetadata };
  exactKeys(options, ['currentMetadata', 'priorMetadata'], 'endpoint lineage options');
  exactMetadata(currentMetadata, currentMetadata);
  const currentGeneration = Number(currentMetadata.effectGeneration);
  if (priorMetadata !== null) {
    exactMetadata(priorMetadata, priorMetadata);
    const priorGeneration = Number(priorMetadata.effectGeneration);
    if (priorGeneration + 1 !== currentGeneration) {
      fail('prior endpoint generation is not the exact current predecessor');
    }
    for (const key of ['appId', 'applicationSha', 'bootstrapReceiptSha256', 'capabilityIntentId', 'professionId']) {
      if (priorMetadata[key] !== currentMetadata[key]) fail('prior endpoint lineage mission identity differs');
    }
  }

  const observedMetadata = exactMetadata(value?.metadata, value?.metadata);
  const observedGeneration = Number(observedMetadata.effectGeneration);
  const isExact = (expected) => expected !== null &&
    STRIPE_WEBHOOK_METADATA_KEYS.every((key) => observedMetadata[key] === expected[key]);
  if (isExact(currentMetadata)) {
    return Object.freeze({
      endpoint: sanitizeStripeWebhookEndpoint(value, currentMetadata),
      lineage: 'CURRENT',
    });
  }
  if (isExact(priorMetadata)) {
    return Object.freeze({
      endpoint: sanitizeStripeWebhookEndpoint(value, priorMetadata),
      lineage: 'PRIOR',
    });
  }
  if (observedGeneration > currentGeneration) {
    fail('newer endpoint generation is outside the admitted lineage');
  }
  fail('stale or hash-divergent endpoint generation is outside the exact admitted lineage');
}

export function classifyStripeWebhookCompensationProviderList(value, expected) {
  exactKeys(expected, [
    'capabilityIntentId', 'endpointUrl', 'targetEndpointId', 'targetMetadata',
  ], 'compensation provider-list expectation');
  if (expected.endpointUrl !== ENDPOINT_URL || !SAFE_INTENT.test(expected.capabilityIntentId || '') ||
      !ENDPOINT_ID.test(expected.targetEndpointId || '')) {
    fail('compensation provider-list expectation differs');
  }
  exactMetadata(expected.targetMetadata, expected.targetMetadata);
  if (value?.has_more !== false || !Array.isArray(value?.data)) {
    fail('compensation provider readback is paginated or malformed');
  }
  const bound = value.data.filter((row) => row?.metadata?.appId === 'local-assesssuite-physio' ||
    row?.metadata?.professionId === 'physio' ||
    row?.metadata?.capabilityIntentId === expected.capabilityIntentId);
  const atUrl = value.data.filter((row) => row?.url === expected.endpointUrl);
  if (bound.length > 1 || atUrl.length > 1 || bound.length !== atUrl.length ||
      (bound.length === 1 && bound[0]?.id !== atUrl[0]?.id)) {
    fail('compensation provider readback has duplicates, mixed identity, or an alternate URL');
  }
  if (atUrl.length === 0) {
    return Object.freeze({
      exact_endpoint: null,
      exact_url_count: 0,
      has_more: false,
      physio_metadata_bound_count: 0,
    });
  }
  const endpoint = sanitizeStripeWebhookEndpoint(atUrl[0], expected.targetMetadata);
  if (endpoint.id !== expected.targetEndpointId) {
    fail('compensation provider readback target ID differs');
  }
  return Object.freeze({
    exact_endpoint: endpoint,
    exact_url_count: 1,
    has_more: false,
    physio_metadata_bound_count: 1,
  });
}

function inspectJson(value, location = '$') {
  if (typeof value === 'string') {
    if (SECRET_VALUE.test(value) || EMAIL_VALUE.test(value)) fail(`secret or PII value at ${location}`);
    return;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return;
  if (Array.isArray(value)) {
    if (value.length > 1_000) fail(`oversized array at ${location}`);
    value.forEach((item, index) => inspectJson(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') fail(`unsupported JSON value at ${location}`);
  const keys = Object.keys(value);
  if (keys.length > 256) fail(`oversized object at ${location}`);
  for (const key of keys) {
    const normalized = key.toLowerCase();
    if (FORBIDDEN_EXACT_KEYS.has(normalized)) fail(`forbidden evidence key ${key} at ${location}`);
  }
  if ('metadata' in value && ('url' in value || 'enabled_events' in value || 'api_version' in value)) {
    exactKeys(value.metadata, STRIPE_WEBHOOK_METADATA_KEYS, `endpoint metadata at ${location}`);
  }
  for (const [key, item] of Object.entries(value)) inspectJson(item, `${location}.${key}`);
}

export function assertWebhookEvidenceTreeSafe(root) {
  const resolvedRoot = path.resolve(root || '');
  const rootStat = fs.lstatSync(resolvedRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('evidence root is not a regular directory');
  let fileCount = 0;
  let totalBytes = 0;
  const walk = (directory, depth) => {
    if (depth > 8) fail('evidence tree depth exceeds eight');
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.resolve(directory, entry.name);
      const relative = path.relative(resolvedRoot, target);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || entry.isSymbolicLink()) {
        fail('evidence path or link escapes the root');
      }
      if (entry.isDirectory()) {
        walk(target, depth + 1);
        continue;
      }
      if (!entry.isFile()) fail('evidence contains a non-regular filesystem entry');
      fileCount += 1;
      if (fileCount > 128) fail('evidence file count exceeds 128');
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 4_194_304) {
        fail('evidence file is missing, linked, empty or oversized');
      }
      totalBytes += stat.size;
      if (totalBytes > 33_554_432) fail('evidence tree exceeds 32 MiB');
      const bytes = fs.readFileSync(target);
      if (bytes.includes(0)) fail('binary evidence is not permitted');
      const text = bytes.toString('utf8');
      if (Buffer.from(text, 'utf8').compare(bytes) !== 0) fail('evidence is not canonical UTF-8');
      if (SECRET_VALUE.test(text) || EMAIL_VALUE.test(text)) fail('evidence contains a raw credential or PII');
      if (entry.name.endsWith('.json')) {
        let parsed;
        try { parsed = JSON.parse(text); } catch { fail(`invalid JSON evidence: ${relative}`); }
        inspectJson(parsed, relative);
      } else if (entry.name !== 'SHA256SUMS') {
        fail(`unexpected non-JSON evidence file: ${relative}`);
      }
    }
  };
  walk(resolvedRoot, 0);
  if (fileCount < 1) fail('evidence tree is empty');
  return Object.freeze({ file_count: fileCount, total_bytes: totalBytes });
}

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJsonFile(file, label) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    fail(`${label} is not valid JSON`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactValue(actual, expected, label) {
  if (actual !== expected) fail(`${label} differs`);
}

function requireHash(value, label) {
  if (!SHA256.test(value || '')) fail(`${label} is not a lowercase SHA-256`);
  return value;
}

function hashValue(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requireArtifactId(value, label) {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) ||
      !Number.isSafeInteger(Number(value))) {
    fail(`${label} is not a positive artifact ID`);
  }
}

function requireArtifactDigest(value, label) {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) {
    fail(`${label} is not a sha256 artifact digest`);
  }
}

function resumeArtifactLifecycle(name, applicationSha) {
  const escaped = applicationSha.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^physio-stripe-webhook-started-${escaped}$`).test(name)) {
    return { kind: 'STARTED', rank: 1, generation: null, revision: null };
  }
  if (new RegExp(`^physio-stripe-webhook-plan-${escaped}(?:-[1-9][0-9]*)?$`).test(name)) {
    return { kind: 'PROVIDER_PLAN', rank: 2, generation: null, revision: null };
  }
  const compensation = name.match(new RegExp(
    `^physio-stripe-webhook-compensation-phase-${escaped}-([0-9]+)-([0-9]+)$`,
  ));
  if (compensation) {
    const generation = Number(compensation[1]);
    const revision = Number(compensation[2]);
    if (!Number.isSafeInteger(generation) || generation < 0 ||
        !Number.isSafeInteger(revision) || revision < 0) {
      fail('resume sibling compensation coordinates differ');
    }
    return { kind: 'COMPENSATION_PHASE', rank: 3, generation, revision };
  }
  if (new RegExp(`^physio-production-stripe-webhook-${escaped}$`).test(name)) {
    return { kind: 'EFFECT_OR_COMPLETED', rank: 4, generation: null, revision: null };
  }
  fail('resume sibling artifact name is outside the exact webhook lifecycle');
}

function validateResumeSiblingInventory(packet, applicationSha, {
  admissionName = 'resume-artifact-admission.json',
  inventoryName = 'resume-sibling-inventory.json',
} = {}) {
  const inventory = readJsonFile(path.join(packet, inventoryName),
    'resume sibling inventory');
  exactKeys(inventory, [
    'application_sha', 'contract_version', 'eligible_artifacts', 'inventoried_at', 'result',
    'selected_artifact_id', 'selected_artifact_name', 'selected_is_latest',
    'selected_lifecycle_kind', 'source_run_id',
  ], 'resume sibling inventory');
  exactValue(inventory.contract_version, 'assesssuite-webhook-resume-sibling-inventory/1.0.0',
    'resume sibling inventory contract');
  exactValue(inventory.application_sha, applicationSha, 'resume sibling inventory application SHA');
  if (inventory.result === 'NOT_APPLICABLE') {
    if (inventory.source_run_id !== null || inventory.selected_artifact_id !== null ||
        inventory.selected_artifact_name !== null || inventory.selected_lifecycle_kind !== null ||
        inventory.selected_is_latest !== true || inventory.inventoried_at !== null ||
        !Array.isArray(inventory.eligible_artifacts) || inventory.eligible_artifacts.length !== 0) {
      fail('fresh resume sibling inventory differs');
    }
    return inventory;
  }
  if (inventory.result !== 'PASS' || !Number.isSafeInteger(inventory.source_run_id) ||
      inventory.source_run_id < 1 || !Number.isSafeInteger(inventory.selected_artifact_id) ||
      inventory.selected_artifact_id < 1 || inventory.selected_is_latest !== true ||
      !Array.isArray(inventory.eligible_artifacts) || inventory.eligible_artifacts.length < 1 ||
      inventory.eligible_artifacts.length > 64) {
    fail('resumed sibling inventory shape differs');
  }
  requireIsoTimestamp(inventory.inventoried_at, 'resume sibling inventory timestamp');
  const ids = new Set();
  const classCounts = new Map();
  const compensationCoordinates = new Set();
  const compensationGenerations = new Set();
  let selected = null;
  let latest = null;
  for (const row of inventory.eligible_artifacts) {
    exactKeys(row, [
      'digest', 'expired', 'generation', 'id', 'lifecycle_kind', 'name', 'revision', 'size_in_bytes',
    ], 'resume sibling artifact');
    if (!Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id) || row.expired !== false ||
        !Number.isSafeInteger(row.size_in_bytes) || row.size_in_bytes < 1 ||
        row.size_in_bytes > 33_554_432) {
      fail('resume sibling artifact coordinates differ');
    }
    ids.add(row.id);
    requireArtifactDigest(row.digest, 'resume sibling artifact digest');
    const lifecycle = resumeArtifactLifecycle(row.name, applicationSha);
    if (row.lifecycle_kind !== lifecycle.kind || row.generation !== lifecycle.generation ||
        row.revision !== lifecycle.revision) {
      fail('resume sibling artifact lifecycle classification differs');
    }
    classCounts.set(lifecycle.kind, (classCounts.get(lifecycle.kind) || 0) + 1);
    if (lifecycle.kind === 'COMPENSATION_PHASE') {
      const coordinate = `${lifecycle.generation}:${lifecycle.revision}`;
      if (compensationCoordinates.has(coordinate)) fail('duplicate compensation sibling coordinate');
      compensationCoordinates.add(coordinate);
      compensationGenerations.add(lifecycle.generation);
    }
    const coordinate = lifecycle.kind === 'COMPENSATION_PHASE' ? lifecycle.revision : 0;
    if (!latest || lifecycle.rank > latest.rank ||
        (lifecycle.rank === latest.rank && coordinate > latest.coordinate)) {
      latest = {
        coordinate,
        digest: row.digest,
        expired: row.expired,
        generation: row.generation,
        id: row.id,
        lifecycle_kind: row.lifecycle_kind,
        name: row.name,
        rank: lifecycle.rank,
        revision: row.revision,
        size_in_bytes: row.size_in_bytes,
      };
    } else if (lifecycle.rank === latest.rank && coordinate === latest.coordinate) {
      fail('resume sibling lifecycle has an ambiguous latest artifact');
    }
    if (row.id === inventory.selected_artifact_id) selected = row;
  }
  for (const kind of ['STARTED', 'PROVIDER_PLAN', 'EFFECT_OR_COMPLETED']) {
    if ((classCounts.get(kind) || 0) > 1) fail(`resume sibling ${kind} artifact is duplicated`);
  }
  if (compensationGenerations.size > 1) {
    fail('resume sibling compensation artifacts span multiple effect generations');
  }
  if (!selected || selected.id !== latest?.id || selected.name !== inventory.selected_artifact_name ||
      selected.lifecycle_kind !== inventory.selected_lifecycle_kind) {
    fail('selected resume artifact is not the exact latest lifecycle control');
  }
  const admission = readJsonFile(path.join(packet, admissionName),
    'resume artifact admission');
  const admitted = admission?.artifacts?.resume_started_effect;
  if (admission.result !== 'PASS' || admitted?.id !== selected.id || admitted?.name !== selected.name ||
      admitted?.digest !== selected.digest || admitted?.size_in_bytes !== selected.size_in_bytes ||
      admitted?.workflow_run_id !== inventory.source_run_id) {
    fail('resume sibling inventory differs from the admitted selected artifact');
  }
  return inventory;
}

function validateInventory(value, expected, label) {
  exactKeys(value, expected.keys, label);
  exactValue(value.has_more, false, `${label} pagination`);
  exactValue(value.exact_url_count, expected.count, `${label} exact URL count`);
  if ('physioBoundCount' in expected) {
    exactValue(value.physio_metadata_bound_count, expected.physioBoundCount,
      `${label} Physio metadata count`);
  }
  if ('lineage' in expected) {
    exactValue(value.observed_endpoint_lineage, expected.lineage, `${label} lineage`);
  }
  if (expected.endpoint === null) {
    exactValue(value.exact_endpoint, null, `${label} endpoint absence`);
    return null;
  }
  return sanitizeStripeWebhookEndpoint(value.exact_endpoint, expected.metadata);
}

function requireIsoTimestamp(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
      Number.isNaN(Date.parse(value))) {
    fail(`${label} timestamp differs`);
  }
}

function validateProviderRequestIdHashes(value, expectedNames, label) {
  exactKeys(value, ['contract_version', 'hashes', 'provider', ...(label === 'effect provider requests'
    ? ['create_reconciled_from_prior'] : [])], label);
  exactValue(value.contract_version, 'assesssuite-provider-request-id-hashes/1.0.0', `${label} contract`);
  exactValue(value.provider, 'stripe', `${label} provider`);
  exactKeys(value.hashes, expectedNames, `${label} hashes`);
  for (const name of expectedNames) requireHash(value.hashes[name], `${label} ${name}`);
  if (label === 'effect provider requests') exactValue(value.create_reconciled_from_prior, false,
    `${label} create provenance`);
}

function validateFlySecretMetadata(value, expectedNames, label) {
  exactKeys(value, ['contract_version', 'secrets'], label);
  exactValue(value.contract_version, 'assesssuite-fly-secret-metadata/1.0.0', `${label} contract`);
  if (!Array.isArray(value.secrets) || value.secrets.length !== expectedNames.length) {
    fail(`${label} secret count differs`);
  }
  const names = [];
  const byName = new Map();
  for (const row of value.secrets) {
    exactKeys(row, ['digest', 'name', 'status'], `${label} secret`);
    if (typeof row.name !== 'string' || !/^[A-Z][A-Z0-9_]{1,80}$/.test(row.name) ||
        !/^[0-9a-f]{16,64}$/.test(row.digest || '') || row.status !== 'Staged') {
      fail(`${label} secret metadata differs`);
    }
    names.push(row.name);
    byName.set(row.name, row);
  }
  if (byName.size !== names.length || JSON.stringify(names) !== JSON.stringify([...expectedNames].sort())) {
    fail(`${label} exact sorted secret names differ`);
  }
  return byName;
}

function validateFlatChecksummedPacket(root, requiredFiles, label = 'packet') {
  const resolvedRoot = path.resolve(root);
  assertWebhookEvidenceTreeSafe(resolvedRoot);
  const entries = fs.readdirSync(resolvedRoot, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile() || entry.isSymbolicLink())) {
    fail(`${label} must be an exact flat regular-file set`);
  }
  const actualFiles = entries.map((entry) => entry.name).sort();
  for (const name of requiredFiles) {
    if (!actualFiles.includes(name)) fail(`${label} is missing ${name}`);
  }
  const checksumPath = path.join(resolvedRoot, 'SHA256SUMS');
  const checksumText = fs.readFileSync(checksumPath, 'utf8');
  if (!checksumText.endsWith('\n') || checksumText.includes('\r')) fail('SHA256SUMS is not canonical LF text');
  const lines = checksumText.slice(0, -1).split('\n');
  const expectedPayloadNames = actualFiles.filter((name) => name !== 'SHA256SUMS');
  const listedNames = [];
  for (const line of lines) {
    const match = /^([0-9a-f]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(line);
    if (!match) fail('SHA256SUMS line shape differs');
    const [, expectedHash, name] = match;
    if (name === 'SHA256SUMS' || name.includes('/') || name.includes('\\')) fail('SHA256SUMS member is unsafe');
    listedNames.push(name);
    const file = path.join(resolvedRoot, name);
    if (!fs.existsSync(file) || !fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) {
      fail(`SHA256SUMS member ${name} is missing or linked`);
    }
    exactValue(sha256File(file), expectedHash, `SHA256SUMS member ${name}`);
  }
  if (JSON.stringify(listedNames) !== JSON.stringify([...listedNames].sort()) ||
      JSON.stringify(listedNames) !== JSON.stringify(expectedPayloadNames)) {
    fail('SHA256SUMS is not the unique sorted exact packet file set');
  }
  return resolvedRoot;
}

function validateChecksummedPacket(root) {
  return validateFlatChecksummedPacket(root, COMPLETED_PACKET_CORE_FILES, 'completed packet');
}

function canonicalRequestSha(request) {
  const copy = structuredClone(request);
  delete copy.request_sha256;
  delete copy.metadata?.requestSha256;
  return hashValue(JSON.stringify(copy));
}

function compensationEffectIdentity({ effectGeneration, requestSha256, planSha256,
  targetEndpointIdSha256, targetRequestSha256, targetEffectIdentityReceiptSha256 }) {
  return hashValue(JSON.stringify({
    operation: COMPENSATION_OPERATION,
    effect_generation: effectGeneration,
    request_sha256: requestSha256,
    provider_plan_receipt_sha256: planSha256,
    target_endpoint_id_sha256: targetEndpointIdSha256,
    target_request_sha256: targetRequestSha256,
    target_effect_identity_receipt_sha256: targetEffectIdentityReceiptSha256,
  }));
}

function readCompensationRequestIdHashes(file, label) {
  const value = readJsonFile(file, label);
  exactKeys(value, ['contract_version', 'operation', 'provider', 'request_id_sha256'], label);
  exactValue(value.contract_version, 'assesssuite-provider-request-id-hash/2.0.0', `${label} contract`);
  exactValue(value.operation, 'LIST', `${label} operation`);
  exactValue(value.provider, 'stripe', `${label} provider`);
  requireHash(value.request_id_sha256, `${label} request ID`);
  return value;
}

/**
 * Validate the self-contained, revisioned compensation control packet used as
 * the only durable authority for DELETE retries. This function deliberately
 * validates raw packet joins rather than accepting a phase object by shape.
 */
export function validateStripeWebhookCompensationPacket(root, expected) {
  exactKeys(expected, [
    'applicationSha',
    'authorityReference',
    'bootstrapReceiptSha256',
    'capabilityIntentId',
    'controlReceiptSha256',
    'requireCompleted',
  ], 'compensation packet expectation');
  if (!APPLICATION_SHA.test(expected.applicationSha || '') ||
      !SHA256.test(expected.bootstrapReceiptSha256 || '') ||
      !SHA256.test(expected.controlReceiptSha256 || '') ||
      !SAFE_INTENT.test(expected.capabilityIntentId || '') ||
      !/^[A-Za-z0-9._:/-]{1,240}$/.test(expected.authorityReference || '') ||
      typeof expected.requireCompleted !== 'boolean') {
    fail('compensation packet expectation shape differs');
  }

  const packet = validateFlatChecksummedPacket(
    root,
    COMPENSATION_PACKET_CORE_FILES,
    'compensation packet',
  );
  const file = (name) => path.join(packet, name);
  const names = fs.readdirSync(packet).sort();
  const phaseNames = names.filter((name) => /^stripe-webhook-compensation-phase-[0-9]{3}\.json$/.test(name));
  if (phaseNames.length < 1 || phaseNames.some((name, index) =>
    name !== `stripe-webhook-compensation-phase-${String(index).padStart(3, '0')}.json`)) {
    fail('compensation phase revisions are not contiguous from zero');
  }

  const started = readJsonFile(file('stripe-webhook-effect-reconciliation.json'),
    'compensation STARTED effect');
  const identity = readJsonFile(file('stripe-webhook-effect-identity.json'),
    'compensation effect identity');
  const request = readJsonFile(file('stripe-webhook-request-manifest.json'),
    'compensation request');
  const plan = readJsonFile(file('stripe-provider-plan.json'), 'compensation provider plan');
  const probe = readJsonFile(file('stripe-provider-probe.json'), 'compensation provider probe');
  const planRequestIds = readJsonFile(file('provider-probe-request-id-hashes.json'),
    'compensation provider-plan request IDs');
  const startedSha = sha256File(file('stripe-webhook-effect-reconciliation.json'));
  const identitySha = sha256File(file('stripe-webhook-effect-identity.json'));
  const planSha = sha256File(file('stripe-provider-plan.json'));
  const probeSha = sha256File(file('stripe-provider-probe.json'));
  const planRequestIdsSha = sha256File(file('provider-probe-request-id-hashes.json'));
  const resumeSiblingInventory = validateResumeSiblingInventory(packet, expected.applicationSha);
  const compensationAdmissionNames = names
    .filter((name) => /^compensation-resume-artifact-admission-[0-9]{3}\.json$/.test(name)).sort();
  const compensationSiblingNames = names
    .filter((name) => /^compensation-resume-sibling-inventory-[0-9]{3}\.json$/.test(name)).sort();
  if (compensationAdmissionNames.length !== compensationSiblingNames.length ||
      compensationAdmissionNames.some((name, index) =>
        name.slice('compensation-resume-artifact-admission-'.length, -'.json'.length) !==
          compensationSiblingNames[index].slice('compensation-resume-sibling-inventory-'.length, -'.json'.length))) {
    fail('compensation resume admission and sibling-inventory pairs differ');
  }
  for (let index = 0; index < compensationAdmissionNames.length; index += 1) {
    validateResumeSiblingInventory(packet, expected.applicationSha, {
      admissionName: compensationAdmissionNames[index],
      inventoryName: compensationSiblingNames[index],
    });
  }

  exactKeys(started, STARTED_EFFECT_KEYS, 'compensation STARTED effect');
  exactKeys(identity, EFFECT_IDENTITY_KEYS, 'compensation effect identity');
  exactKeys(request, REQUEST_MANIFEST_KEYS, 'compensation request');
  exactKeys(plan, PROVIDER_PLAN_KEYS, 'compensation provider plan');
  exactKeys(probe, ['exact_endpoint', 'exact_url_count', 'has_more', 'physio_metadata_bound_count'],
    'compensation provider probe');

  if (started.contract_version !== 'assesssuite-physio-stripe-webhook-effect-reconciliation/1.0.0' ||
      started.result !== 'STARTED' || started.application_sha !== expected.applicationSha ||
      started.application !== 'assesssuite-physio-production' ||
      started.bootstrap_receipt_sha256 !== expected.bootstrapReceiptSha256 ||
      started.capability_intent_id !== expected.capabilityIntentId ||
      started.authority_reference !== expected.authorityReference ||
      !SHA256.test(started.exact_image_canary_receipt_sha256 || '') ||
      !SHA256.test(started.admission_receipt_sha256 || '') ||
      !SHA256.test(started.resume_started_effect_receipt_sha256 || '') ||
      !SHA256.test(started.prior_artifact_admission_sha256 || '') ||
      !SHA256.test(started.prior_request_sha256 || '') ||
      !SHA256.test(started.prior_idempotency_key_sha256 || '') ||
      started.idempotency_key_sha256 !== request.idempotency_key_sha256 ||
      started.resume_started_effect_receipt_sha256 !== request.prior_effect_receipt_sha256 ||
      started.prior_request_sha256 !== request.prior_request_sha256 ||
      started.prior_artifact_admission_sha256 !== request.prior_artifact_admission_sha256 ||
      started.prior_idempotency_key_sha256 !== request.prior_idempotency_key_sha256 ||
      started.predecessor_control_kind !== request.predecessor_control_kind ||
      started.predecessor_control_receipt_sha256 !== request.predecessor_control_receipt_sha256 ||
      started.completed_at !== null || started.prior_effect_readback_sha256 !== null ||
      started.orphan_compensation_authorized !== true || started.orphan_endpoint_compensated !== false ||
      started.orphan_endpoint_id_sha256 !== null || started.compensation_delete_request_id_sha256 !== null ||
      started.compensation_absence_readback_sha256 !== null || started.provider_list_before_sha256 !== null ||
      started.provider_create_exit_code !== null || started.provider_create_http_status !== null ||
      started.provider_endpoint_readback_sha256 !== null || started.fly_secret_prestate !== null ||
      started.fly_secret_import_exit_code !== null || started.fly_secret_readback_sha256 !== null ||
      started.orphan_compensation_contract_version !==
        'assesssuite-physio-stripe-webhook-orphan-compensation/1.0.0' ||
      started.orphan_compensation_policy !==
        'delete-exact-metadata-bound-endpoint-prove-absence-then-recreate' ||
      started.effect_identity_receipt_sha256 !== identitySha ||
      started.request_sha256 !== request.request_sha256 ||
      request.request_sha256 !== canonicalRequestSha(request) ||
      request.effect_generation !== started.effect_generation ||
      request.authority_reference !== expected.authorityReference ||
      request.capability_intent_id !== expected.capabilityIntentId ||
      request.endpoint !== ENDPOINT_URL || request.api_version !== '2026-07-29.dahlia' ||
      JSON.stringify(request.enabled_events) !== JSON.stringify(EVENTS) ||
      identity.contract_version !== 'assesssuite-physio-stripe-webhook-effect-identity/1.0.0' ||
      identity.result !== 'STARTED' || identity.application !== started.application ||
      identity.application_sha !== expected.applicationSha ||
      identity.bootstrap_receipt_sha256 !== expected.bootstrapReceiptSha256 ||
      identity.exact_image_canary_receipt_sha256 !== started.exact_image_canary_receipt_sha256 ||
      identity.capability_intent_id !== expected.capabilityIntentId ||
      identity.authority_reference !== expected.authorityReference ||
      identity.prior_effect_receipt_sha256 !== request.prior_effect_receipt_sha256 ||
      identity.prior_request_sha256 !== request.prior_request_sha256 ||
      identity.prior_artifact_admission_sha256 !== request.prior_artifact_admission_sha256 ||
      identity.prior_idempotency_key_sha256 !== request.prior_idempotency_key_sha256 ||
      identity.predecessor_control_kind !== request.predecessor_control_kind ||
      identity.predecessor_control_receipt_sha256 !== request.predecessor_control_receipt_sha256 ||
      request.metadata?.effectGeneration !== String(started.effect_generation) ||
      request.metadata?.requestSha256 !== request.request_sha256 ||
      request.metadata?.startedEffectReceiptSha256 !== identitySha ||
      identity.effect_generation !== started.effect_generation ||
      identity.idempotency_key_sha256 !== request.idempotency_key_sha256 ||
      plan.contract_version !== 'assesssuite-physio-stripe-webhook-effect-plan/1.0.0' ||
      plan.result !== 'PASS' || plan.application_sha !== expected.applicationSha ||
      plan.bootstrap_receipt_sha256 !== expected.bootstrapReceiptSha256 ||
      plan.capability_intent_id !== expected.capabilityIntentId ||
      plan.authority_reference !== expected.authorityReference ||
      plan.started_effect_receipt_sha256 !== startedSha ||
      plan.request_sha256 !== request.request_sha256 ||
      plan.effect_generation !== started.effect_generation ||
      plan.current_effect_identity_receipt_sha256 !== identitySha ||
      plan.provider_probe_readback_sha256 !== probeSha ||
      plan.provider_probe_request_id_hashes_sha256 !== planRequestIdsSha ||
      plan.application !== started.application || plan.provider_mutation_absent !== true ||
      plan.prior_effect_receipt_sha256 !== request.prior_effect_receipt_sha256) {
    fail('compensation immutable STARTED, request, identity, or provider-plan join differs');
  }
  if (!PREDECESSOR_CONTROL_KINDS.includes(started.predecessor_control_kind) ||
      !SHA256.test(started.predecessor_control_receipt_sha256 || '') ||
      (started.effect_generation === 0 &&
        (started.predecessor_control_kind !== 'NOT_APPLICABLE' ||
          started.predecessor_control_receipt_sha256 !== ZERO_SHA256)) ||
      (started.effect_generation > 0 &&
        (started.predecessor_control_kind === 'NOT_APPLICABLE' ||
          started.predecessor_control_receipt_sha256 === ZERO_SHA256)) ||
      (started.predecessor_control_kind === 'EFFECT_RECONCILIATION' &&
        started.predecessor_control_receipt_sha256 !== started.resume_started_effect_receipt_sha256) ||
      (started.predecessor_control_kind === 'TERMINAL_COMPENSATION' &&
        started.predecessor_control_receipt_sha256 === started.resume_started_effect_receipt_sha256)) {
    fail('compensation predecessor control binding differs');
  }
  exactValue(resumeSiblingInventory.result, started.effect_generation === 0 ? 'NOT_APPLICABLE' : 'PASS',
    'compensation resume sibling applicability');
  requireIsoTimestamp(started.started_at, 'compensation STARTED effect start');
  requireIsoTimestamp(plan.probed_at, 'compensation provider plan probe');
  if (Date.parse(plan.probed_at) < Date.parse(started.started_at)) {
    fail('compensation provider plan predates its STARTED effect');
  }
  exactMetadata(request.metadata, {
    appId: 'local-assesssuite-physio',
    applicationSha: expected.applicationSha,
    bootstrapReceiptSha256: expected.bootstrapReceiptSha256,
    capabilityIntentId: expected.capabilityIntentId,
    effectGeneration: String(started.effect_generation),
    professionId: 'physio',
    requestSha256: request.request_sha256,
    startedEffectReceiptSha256: identitySha,
  });
  validateProviderRequestIdHashes(planRequestIds, ['provider_probe'], 'provider-plan requests');

  const exactTarget = plan.provider_state === 'EXACT';
  const priorFiles = [
    'prior-stripe-webhook-effect-identity.json',
    'prior-stripe-webhook-effect-reconciliation.json',
    'prior-stripe-webhook-request-manifest.json',
  ];
  const actualPriorFiles = priorFiles.filter((name) => names.includes(name));
  if (actualPriorFiles.length !== (exactTarget ? priorFiles.length : 0)) {
    fail('compensation exact conditional prior-effect file set differs');
  }

  let target = {
    endpointId: null,
    endpointIdSha256: null,
    effectGeneration: null,
    requestSha256: null,
    effectIdentityReceiptSha256: null,
    metadata: null,
    lineageSha256: ZERO_SHA256,
  };
  if (exactTarget) {
    if (plan.endpoint_lineage !== 'PRIOR' || plan.observed_endpoint_lineage !== 'PRIOR' ||
        plan.planned_action !== 'RECONCILE_OR_COMPENSATE_EXACT' ||
        plan.prior_effect_resolution !== 'COMMIT_PRESENT_REQUIRES_COMPENSATION' ||
        plan.prior_effect_readback_sha256 !== probeSha ||
        !ENDPOINT_ID.test(plan.exact_endpoint_id || '') ||
        hashValue(plan.exact_endpoint_id) !== plan.exact_endpoint_id_sha256 ||
        plan.endpoint_effect_generation + 1 !== started.effect_generation ||
        plan.endpoint_effect_generation !== plan.observed_endpoint_effect_generation ||
        plan.endpoint_request_sha256 !== plan.observed_endpoint_request_sha256 ||
        plan.endpoint_started_effect_receipt_sha256 !==
          plan.observed_endpoint_started_effect_receipt_sha256) {
      fail('compensation provider plan does not identify one exact predecessor target');
    }
    const priorEffectFile = file('prior-stripe-webhook-effect-reconciliation.json');
    const priorRequestFile = file('prior-stripe-webhook-request-manifest.json');
    const priorIdentityFile = file('prior-stripe-webhook-effect-identity.json');
    const priorEffect = readJsonFile(priorEffectFile, 'compensation prior effect');
    const priorRequest = readJsonFile(priorRequestFile, 'compensation prior request');
    const priorIdentitySha = sha256File(priorIdentityFile);
    if (priorEffect.request_sha256 !== priorRequest.request_sha256 ||
        priorRequest.request_sha256 !== canonicalRequestSha(priorRequest) ||
        priorEffect.effect_identity_receipt_sha256 !== priorIdentitySha ||
        sha256File(priorEffectFile) !== request.prior_effect_receipt_sha256 ||
        priorRequest.request_sha256 !== request.prior_request_sha256 ||
        priorEffect.effect_generation !== plan.endpoint_effect_generation ||
        priorEffect.request_sha256 !== plan.endpoint_request_sha256 ||
        priorIdentitySha !== plan.endpoint_started_effect_receipt_sha256) {
      fail('compensation prior-effect lineage bytes differ from the target plan');
    }
    const targetEndpoint = sanitizeStripeWebhookEndpoint(probe.exact_endpoint, priorRequest.metadata);
    if (probe.has_more !== false || probe.exact_url_count !== 1 ||
        probe.physio_metadata_bound_count !== 1 || targetEndpoint.id !== plan.exact_endpoint_id) {
      fail('compensation provider-plan target probe differs');
    }
    target = {
      endpointId: targetEndpoint.id,
      endpointIdSha256: hashValue(targetEndpoint.id),
      effectGeneration: priorEffect.effect_generation,
      requestSha256: priorRequest.request_sha256,
      effectIdentityReceiptSha256: priorIdentitySha,
      metadata: priorRequest.metadata,
      lineageSha256: hashValue([
        sha256File(priorEffectFile), sha256File(priorRequestFile), priorIdentitySha,
      ].join('|')),
    };
  } else {
    if (plan.provider_state !== 'ABSENT' || plan.endpoint_lineage !== 'NONE' ||
        plan.observed_endpoint_lineage !== 'NONE' || plan.planned_action !== 'CREATE_FROM_PROVEN_ABSENCE' ||
        !['NOT_APPLICABLE', 'NOT_APPLIED_BY_AUTHORITATIVE_ABSENCE'].includes(plan.prior_effect_resolution) ||
        plan.prior_effect_readback_sha256 !== probeSha ||
        plan.exact_endpoint_id !== null || plan.exact_endpoint_id_sha256 !== null ||
        plan.endpoint_effect_generation !== null || plan.endpoint_request_sha256 !== null ||
        plan.endpoint_started_effect_receipt_sha256 !== null ||
        plan.observed_endpoint_effect_generation !== null || plan.observed_endpoint_request_sha256 !== null ||
        plan.observed_endpoint_started_effect_receipt_sha256 !== null || probe.has_more !== false ||
        probe.exact_url_count !== 0 || probe.physio_metadata_bound_count !== 0 ||
        probe.exact_endpoint !== null) {
      fail('non-compensation provider plan is not exact authoritative absence');
    }
  }

  const effectIdentity = compensationEffectIdentity({
    effectGeneration: started.effect_generation,
    requestSha256: request.request_sha256,
    planSha256: planSha,
    targetEndpointIdSha256: target.endpointIdSha256,
    targetRequestSha256: target.requestSha256,
    targetEffectIdentityReceiptSha256: target.effectIdentityReceiptSha256,
  });
  let priorPhaseSha = ZERO_SHA256;
  let priorTimestamp = Date.parse(plan.probed_at);
  let finalPhase;
  const referencedDynamicFiles = new Set(phaseNames);
  for (let revision = 0; revision < phaseNames.length; revision += 1) {
    const phaseName = phaseNames[revision];
    const phase = readJsonFile(file(phaseName), `compensation phase ${revision}`);
    exactKeys(phase, COMPENSATION_PHASE_KEYS, `compensation phase ${revision}`);
    if (phase.contract_version !== COMPENSATION_PHASE_CONTRACT ||
        phase.operation !== COMPENSATION_OPERATION || phase.revision !== revision ||
        phase.application_sha !== expected.applicationSha ||
        phase.bootstrap_receipt_sha256 !== expected.bootstrapReceiptSha256 ||
        phase.capability_intent_id !== expected.capabilityIntentId ||
        phase.authority_reference !== expected.authorityReference ||
        phase.effect_generation !== started.effect_generation ||
        phase.request_sha256 !== request.request_sha256 ||
        phase.started_effect_receipt_sha256 !== startedSha ||
        phase.effect_identity_receipt_sha256 !== identitySha ||
        phase.idempotency_key_sha256 !== request.idempotency_key_sha256 ||
        phase.provider_plan_receipt_sha256 !== planSha ||
        phase.target_endpoint_id !== target.endpointId ||
        phase.target_endpoint_id_sha256 !== target.endpointIdSha256 ||
        phase.target_effect_generation !== target.effectGeneration ||
        phase.target_request_sha256 !== target.requestSha256 ||
        phase.target_effect_identity_receipt_sha256 !== target.effectIdentityReceiptSha256 ||
        JSON.stringify(phase.target_metadata) !== JSON.stringify(target.metadata) ||
        phase.prior_effect_receipt_sha256 !== request.prior_effect_receipt_sha256 ||
        phase.prior_effect_lineage_sha256 !== target.lineageSha256 ||
        phase.compensation_effect_identity_sha256 !== effectIdentity ||
        phase.previous_phase_receipt_sha256 !== priorPhaseSha) {
      fail(`compensation phase ${revision} immutable intent or lineage differs`);
    }
    requireHash(phase.artifact_admission_sha256,
      `compensation phase ${revision} artifact admission`);
    const admissionNames = names.filter((name) => name === 'resume-artifact-admission.json' ||
      /^compensation-resume-artifact-admission-[0-9]{3}\.json$/.test(name));
    if (!admissionNames.some((name) => sha256File(file(name)) === phase.artifact_admission_sha256)) {
      fail(`compensation phase ${revision} is not bound to an admitted artifact`);
    }
    requireIsoTimestamp(phase.created_at, `compensation phase ${revision} creation`);
    if (Date.parse(phase.created_at) < priorTimestamp) fail('compensation phase chronology regressed');
    priorTimestamp = Date.parse(phase.created_at);
    if (phase.result === 'PASS') {
      requireIsoTimestamp(phase.completed_at, `compensation phase ${revision} completion`);
      if (Date.parse(phase.completed_at) < priorTimestamp) fail('compensation completion chronology regressed');
      priorTimestamp = Date.parse(phase.completed_at);
    } else {
      exactValue(phase.completed_at, null, `compensation phase ${revision} incomplete completion`);
    }

    const hasReadback = phase.readback_sha256 !== null ||
      phase.readback_request_id_hashes_sha256 !== null;
    if (hasReadback) {
      requireHash(phase.readback_sha256, `compensation phase ${revision} readback`);
      requireHash(phase.readback_request_id_hashes_sha256,
        `compensation phase ${revision} readback request ID`);
      const suffix = String(revision).padStart(3, '0');
      const readbackName = `stripe-webhook-compensation-readback-${suffix}.json`;
      const requestIdsName = `stripe-webhook-compensation-request-id-hashes-${suffix}.json`;
      referencedDynamicFiles.add(readbackName);
      referencedDynamicFiles.add(requestIdsName);
      exactValue(sha256File(file(readbackName)), phase.readback_sha256,
        `compensation phase ${revision} raw readback binding`);
      exactValue(sha256File(file(requestIdsName)), phase.readback_request_id_hashes_sha256,
        `compensation phase ${revision} raw request-ID binding`);
      readCompensationRequestIdHashes(file(requestIdsName),
        `compensation phase ${revision} request IDs`);
      const readback = readJsonFile(file(readbackName), `compensation phase ${revision} readback`);
      if (phase.phase === 'RECONCILED_STILL_APPLIED') {
        const endpoint = validateInventory(readback, {
          keys: ['exact_endpoint', 'exact_url_count', 'has_more', 'physio_metadata_bound_count'],
          count: 1, physioBoundCount: 1, endpoint: true, metadata: target.metadata,
        }, `compensation phase ${revision} present readback`);
        exactValue(endpoint.id, target.endpointId, `compensation phase ${revision} target ID`);
      } else if (phase.phase === 'COMPENSATION_COMPLETED') {
        validateInventory(readback, {
          keys: ['exact_endpoint', 'exact_url_count', 'has_more', 'physio_metadata_bound_count'],
          count: 0, physioBoundCount: 0, endpoint: null,
        }, `compensation phase ${revision} absence readback`);
      } else {
        fail(`compensation phase ${revision} has an inadmissible readback`);
      }
    } else if (phase.phase !== 'DELETE_INTENT' && phase.phase !== 'NOT_APPLICABLE') {
      fail(`compensation phase ${revision} is missing its raw readback evidence`);
    }

    const hasDelete = phase.delete_response_sha256 !== null || phase.delete_request_id_sha256 !== null;
    if (hasDelete) {
      requireHash(phase.delete_response_sha256, `compensation phase ${revision} delete response`);
      requireHash(phase.delete_request_id_sha256, `compensation phase ${revision} delete request ID`);
      const deleteName = `stripe-webhook-compensation-delete-response-${String(revision).padStart(3, '0')}.json`;
      referencedDynamicFiles.add(deleteName);
      exactValue(sha256File(file(deleteName)), phase.delete_response_sha256,
        `compensation phase ${revision} raw delete response binding`);
      const deletion = readJsonFile(file(deleteName), `compensation phase ${revision} delete response`);
      exactKeys(deletion, ['deleted', 'id'], `compensation phase ${revision} delete response`);
      exactValue(deletion.deleted, true, `compensation phase ${revision} delete committed`);
      exactValue(deletion.id, target.endpointId, `compensation phase ${revision} delete target`);
    }

    if (!exactTarget) {
      if (revision !== 0 || phase.phase !== 'NOT_APPLICABLE' || phase.result !== 'PASS' || hasReadback || hasDelete) {
        fail('absence-plan compensation must be one exact NOT_APPLICABLE phase');
      }
    } else if (revision === 0) {
      if (phase.phase !== 'DELETE_INTENT' || phase.result !== 'STARTED' || hasReadback || hasDelete) {
        fail('compensation revision zero must be immutable DELETE_INTENT before provider readback');
      }
    } else if (phase.phase === 'RECONCILED_STILL_APPLIED') {
      if (phase.result !== 'STARTED' || !hasReadback || hasDelete) {
        fail(`compensation retry-start phase ${revision} differs`);
      }
    } else if (phase.phase === 'COMPENSATION_COMPLETED') {
      if (phase.result !== 'PASS' || !hasReadback) fail('compensation completion phase differs');
    } else {
      fail(`compensation phase ${revision} transition differs`);
    }
    priorPhaseSha = sha256File(file(phaseName));
    finalPhase = phase;
  }

  exactValue(priorPhaseSha, expected.controlReceiptSha256, 'compensation latest control receipt');
  if (expected.requireCompleted && finalPhase?.result !== 'PASS') {
    fail('compensation packet has no durable PASS terminal phase');
  }
  const allowedStatic = new Set([
    ...COMPENSATION_PACKET_CORE_FILES,
    ...actualPriorFiles,
    ...names.filter((name) => /^compensation-resume-artifact-admission-[0-9]{3}\.json$/.test(name)),
    ...names.filter((name) => /^compensation-resume-sibling-inventory-[0-9]{3}\.json$/.test(name)),
  ]);
  const unexpected = names.filter((name) => !allowedStatic.has(name) && !referencedDynamicFiles.has(name));
  if (unexpected.length !== 0) fail(`compensation packet conditional file set differs: ${unexpected.join(',')}`);

  return Object.freeze({
    compensation_completed: finalPhase?.result === 'PASS',
    compensation_absence_readback_sha256: finalPhase?.readback_sha256,
    compensation_delete_request_id_sha256: finalPhase?.delete_request_id_sha256,
    compensation_effect_identity_sha256: effectIdentity,
    effect_generation: started.effect_generation,
    effect_identity_receipt_sha256: identitySha,
    idempotency_key_sha256: request.idempotency_key_sha256,
    latest_phase: finalPhase?.phase,
    latest_phase_receipt_sha256: priorPhaseSha,
    latest_revision: phaseNames.length - 1,
    orphan_endpoint_compensated: exactTarget && finalPhase?.result === 'PASS',
    request_sha256: request.request_sha256,
    started_effect_receipt_sha256: startedSha,
    target_endpoint_id: target.endpointId,
    target_endpoint_id_sha256: target.endpointIdSha256,
  });
}

export function validateCompletedStripeWebhookPacket(root, expected) {
  exactKeys(expected, [
    'applicationSha',
    'authorityReference',
    'bootstrapReceiptSha256',
    'canaryReceiptSha256',
    'capabilityIntentId',
    'effectReceiptSha256',
  ], 'completed packet expectation');
  if (!APPLICATION_SHA.test(expected.applicationSha || '') ||
      !SHA256.test(expected.bootstrapReceiptSha256 || '') ||
      !SHA256.test(expected.canaryReceiptSha256 || '') ||
      !SHA256.test(expected.effectReceiptSha256 || '') ||
      !SAFE_INTENT.test(expected.capabilityIntentId || '') ||
      !/^[A-Za-z0-9._:/-]{1,240}$/.test(expected.authorityReference || '')) {
    fail('completed packet expectation shape differs');
  }
  const packet = validateChecksummedPacket(root);
  const file = (name) => path.join(packet, name);
  const receipt = readJsonFile(file('physio-production-stripe-webhook.json'), 'completed webhook receipt');
  const effect = readJsonFile(file('stripe-webhook-effect-reconciliation.json'), 'completed webhook effect');
  const identity = readJsonFile(file('stripe-webhook-effect-identity.json'), 'completed webhook effect identity');
  const request = readJsonFile(file('stripe-webhook-request-manifest.json'), 'completed webhook request');
  const plan = readJsonFile(file('provider-plan.json'), 'completed webhook provider plan');

  exactKeys(receipt, [
    'admission_receipt_sha256', 'application', 'application_sha', 'authority_reference',
    'bootstrap_receipt_sha256', 'capability_intent_id', 'completed_at',
    'compensation_absence_readback_sha256', 'compensation_delete_request_id_sha256', 'contract_version',
    'compensation_effect_identity_sha256', 'compensation_phase_artifact_digest',
    'compensation_phase_artifact_id', 'compensation_phase_receipt_sha256',
    'effect_generation', 'effect_identity_receipt_sha256', 'effect_reconciliation_receipt_sha256',
    'enabled_events', 'exact_image_canary_receipt_sha256', 'existing_endpoint_reconciled',
    'fly_secret_names_readback_sha256', 'fly_webhook_secret_digest', 'orphan_compensation_contract_version',
    'orphan_endpoint_compensated', 'orphan_endpoint_id_sha256', 'prior_effect_readback_sha256',
    'predecessor_control_kind', 'predecessor_control_receipt_sha256',
    'prior_effect_receipt_sha256', 'prior_effect_resolution', 'prior_request_sha256',
    'production_ready_for_publication', 'profession_id', 'provider_endpoint_count',
    'provider_endpoint_readback_sha256', 'provider_plan_artifact_digest', 'provider_plan_artifact_id',
    'provider_plan_probe_readback_sha256', 'provider_plan_receipt_sha256',
    'provider_plan_request_id_hashes_sha256', 'provider_request_id_hashes_sha256', 'request_sha256', 'result',
    'started_effect_receipt_sha256', 'stripe_api_version', 'stripe_credential_mode',
    'stripe_signing_secret_sha256', 'stripe_webhook_endpoint', 'stripe_webhook_endpoint_id',
    'stripe_webhook_secret_staged',
  ], 'completed webhook receipt');
  exactKeys(effect, [
    'admission_receipt_sha256', 'application', 'application_sha', 'authority_reference',
    'bootstrap_receipt_sha256', 'capability_intent_id', 'completed_at',
    'compensation_absence_readback_sha256', 'compensation_delete_request_id_sha256', 'contract_version',
    'compensation_effect_identity_sha256', 'compensation_phase_artifact_digest',
    'compensation_phase_artifact_id', 'compensation_phase_receipt_sha256',
    'effect_generation', 'effect_identity_receipt_sha256', 'existing_endpoint_reconciled',
    'exact_image_canary_receipt_sha256', 'fly_secret_import_attempts', 'fly_secret_import_exit_code',
    'fly_secret_prestate', 'fly_secret_readback_sha256', 'fly_webhook_secret_digest', 'idempotency_key_sha256',
    'orphan_compensation_authorized', 'orphan_compensation_contract_version', 'orphan_compensation_policy',
    'orphan_endpoint_compensated', 'orphan_endpoint_id_sha256', 'prior_artifact_admission_sha256',
    'predecessor_control_kind', 'predecessor_control_receipt_sha256',
    'prior_effect_readback_sha256', 'prior_effect_resolution',
    'prior_idempotency_key_sha256', 'prior_request_sha256', 'provider_create_exit_code',
    'provider_create_http_status', 'provider_endpoint_readback_sha256', 'provider_list_before_sha256',
    'provider_plan_artifact_digest', 'provider_plan_artifact_id', 'provider_plan_endpoint_id_sha256',
    'provider_plan_receipt_sha256', 'provider_plan_state', 'provider_request_id_hashes_sha256',
    'request_sha256', 'result', 'resume_started_effect_receipt_sha256', 'started_at',
    'started_effect_receipt_sha256', 'stripe_signing_secret_sha256', 'stripe_webhook_endpoint_id',
  ], 'completed webhook effect');
  exactKeys(identity, [
    'application', 'application_sha', 'authority_reference', 'bootstrap_receipt_sha256',
    'capability_intent_id', 'contract_version', 'effect_generation', 'exact_image_canary_receipt_sha256',
    'idempotency_key_sha256', 'prior_artifact_admission_sha256', 'prior_effect_receipt_sha256',
    'predecessor_control_kind', 'predecessor_control_receipt_sha256',
    'prior_idempotency_key_sha256', 'prior_request_sha256', 'result',
  ], 'completed webhook effect identity');
  exactKeys(request, [
    'api_version', 'authority_reference', 'capability_intent_id', 'effect_generation', 'enabled_events',
    'endpoint', 'idempotency_key_sha256', 'metadata', 'prior_artifact_admission_sha256',
    'predecessor_control_kind', 'predecessor_control_receipt_sha256',
    'prior_effect_receipt_sha256', 'prior_idempotency_key_sha256', 'prior_request_sha256', 'request_sha256',
  ], 'completed webhook request');
  exactKeys(plan, [
    'application', 'application_sha', 'authority_reference', 'bootstrap_receipt_sha256',
    'capability_intent_id', 'contract_version', 'current_effect_identity_receipt_sha256', 'effect_generation',
    'endpoint_effect_generation', 'endpoint_lineage', 'endpoint_request_sha256',
    'endpoint_started_effect_receipt_sha256', 'exact_endpoint_id', 'exact_endpoint_id_sha256',
    'observed_endpoint_effect_generation', 'observed_endpoint_lineage', 'observed_endpoint_request_sha256',
    'observed_endpoint_started_effect_receipt_sha256', 'planned_action', 'prior_effect_readback_sha256',
    'prior_effect_receipt_sha256', 'prior_effect_resolution',
    'probed_at', 'provider_mutation_absent', 'provider_probe_readback_sha256',
    'provider_probe_request_id_hashes_sha256', 'provider_state', 'request_sha256', 'result',
    'started_effect_receipt_sha256',
  ], 'completed webhook provider plan');
  const resumeSiblingInventory = validateResumeSiblingInventory(packet, expected.applicationSha);

  const actualFiles = fs.readdirSync(packet).sort();
  const compensationPrefix = 'compensation-packet--';
  const compensationFiles = actualFiles.filter((name) => name.startsWith(compensationPrefix));
  if (compensationFiles.length === 0 ||
      compensationFiles.some((name) => name.length === compensationPrefix.length)) {
    fail('completed packet has no exact recursive compensation packet');
  }
  const compensationTemp = fs.mkdtempSync(path.join(path.dirname(packet), 'stripe-compensation-validate-'));
  let compensationProof;
  try {
    for (const name of compensationFiles) {
      fs.copyFileSync(file(name), path.join(compensationTemp, name.slice(compensationPrefix.length)),
        fs.constants.COPYFILE_EXCL);
    }
    compensationProof = validateStripeWebhookCompensationPacket(compensationTemp, {
      applicationSha: expected.applicationSha,
      authorityReference: expected.authorityReference,
      bootstrapReceiptSha256: expected.bootstrapReceiptSha256,
      capabilityIntentId: expected.capabilityIntentId,
      controlReceiptSha256: effect.compensation_phase_receipt_sha256,
      requireCompleted: true,
    });
  } finally {
    fs.rmSync(compensationTemp, { recursive: true, force: true });
  }
  const exactFiles = [...COMPLETED_PACKET_CORE_FILES, ...compensationFiles].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(exactFiles)) {
    fail('completed packet exact conditional file set differs');
  }

  exactValue(sha256File(file('stripe-webhook-effect-reconciliation.json')), expected.effectReceiptSha256,
    'completed effect raw receipt SHA');
  for (const row of [receipt, effect]) {
    exactValue(row.application, 'assesssuite-physio-production', 'completed packet application');
    exactValue(row.application_sha, expected.applicationSha, 'completed packet application SHA');
    exactValue(row.bootstrap_receipt_sha256, expected.bootstrapReceiptSha256, 'completed packet bootstrap receipt');
    exactValue(row.exact_image_canary_receipt_sha256, expected.canaryReceiptSha256, 'completed packet canary receipt');
    exactValue(row.capability_intent_id, expected.capabilityIntentId, 'completed packet capability intent');
    exactValue(row.authority_reference, expected.authorityReference, 'completed packet authority');
  }
  exactValue(receipt.contract_version, 'assesssuite-physio-stripe-webhook-bootstrap/1.0.0',
    'completed webhook contract');
  exactValue(receipt.result, 'PASS', 'completed webhook result');
  exactValue(receipt.profession_id, 'physio', 'completed webhook profession');
  exactValue(receipt.production_ready_for_publication, true, 'completed webhook publication readiness');
  exactValue(receipt.stripe_webhook_secret_staged, true, 'completed webhook secret staging');
  exactValue(receipt.stripe_api_version, '2026-07-29.dahlia', 'completed webhook API version');
  exactValue(receipt.stripe_webhook_endpoint, ENDPOINT_URL, 'completed webhook endpoint');
  exactValue(receipt.provider_endpoint_count, 1, 'completed webhook provider endpoint count');
  exactValue(JSON.stringify(receipt.enabled_events), JSON.stringify(EVENTS), 'completed webhook events');
  if (!['restricted_live', 'secret_live'].includes(receipt.stripe_credential_mode) ||
      typeof receipt.existing_endpoint_reconciled !== 'boolean' ||
      typeof receipt.orphan_endpoint_compensated !== 'boolean') {
    fail('completed webhook provider result shape differs');
  }
  requireIsoTimestamp(receipt.completed_at, 'completed webhook receipt completion');
  for (const field of [
    'admission_receipt_sha256', 'effect_identity_receipt_sha256',
    'effect_reconciliation_receipt_sha256', 'fly_secret_names_readback_sha256',
    'provider_endpoint_readback_sha256', 'provider_plan_probe_readback_sha256',
    'provider_plan_receipt_sha256', 'provider_plan_request_id_hashes_sha256',
    'provider_request_id_hashes_sha256', 'request_sha256', 'started_effect_receipt_sha256',
    'stripe_signing_secret_sha256', 'compensation_effect_identity_sha256',
    'compensation_phase_receipt_sha256', 'predecessor_control_receipt_sha256',
  ]) requireHash(receipt[field], `completed webhook receipt ${field}`);
  requireArtifactId(receipt.provider_plan_artifact_id, 'completed webhook provider-plan artifact ID');
  requireArtifactDigest(receipt.provider_plan_artifact_digest,
    'completed webhook provider-plan artifact digest');
  requireArtifactId(receipt.compensation_phase_artifact_id,
    'completed webhook compensation artifact ID');
  requireArtifactDigest(receipt.compensation_phase_artifact_digest,
    'completed webhook compensation artifact digest');

  exactValue(effect.contract_version, 'assesssuite-physio-stripe-webhook-effect-reconciliation/1.0.0',
    'completed effect contract');
  exactValue(effect.result, 'COMPLETED', 'completed effect result');
  exactValue(effect.provider_create_exit_code, 0, 'completed Stripe create/reconcile exit');
  exactValue(effect.provider_create_http_status, '200', 'completed Stripe create/reconcile HTTP status');
  exactValue(effect.fly_secret_import_exit_code, 0, 'completed Fly secret import/reconcile exit');
  if (!Number.isSafeInteger(effect.fly_secret_import_attempts) || effect.fly_secret_import_attempts < 1 ||
      effect.fly_secret_import_attempts > 2) {
    fail('completed Fly secret import attempt count differs');
  }
  if (!SHA256.test(effect.started_effect_receipt_sha256 || '') ||
      !SHA256.test(effect.effect_identity_receipt_sha256 || '') ||
      !SHA256.test(effect.request_sha256 || '') ||
      !SHA256.test(effect.provider_request_id_hashes_sha256 || '') ||
      !SHA256.test(effect.stripe_signing_secret_sha256 || '') ||
      !/^[0-9a-f]{16,64}$/.test(effect.fly_webhook_secret_digest || '') ||
      !Number.isSafeInteger(effect.effect_generation) || effect.effect_generation < 0) {
    fail('completed effect proof shape differs');
  }
  if (!PREDECESSOR_CONTROL_KINDS.includes(effect.predecessor_control_kind) ||
      !SHA256.test(effect.predecessor_control_receipt_sha256 || '') ||
      (effect.effect_generation === 0 &&
        (effect.predecessor_control_kind !== 'NOT_APPLICABLE' ||
          effect.predecessor_control_receipt_sha256 !== ZERO_SHA256)) ||
      (effect.effect_generation > 0 &&
        (effect.predecessor_control_kind === 'NOT_APPLICABLE' ||
          effect.predecessor_control_receipt_sha256 === ZERO_SHA256)) ||
      (effect.predecessor_control_kind === 'EFFECT_RECONCILIATION' &&
        effect.predecessor_control_receipt_sha256 !== effect.resume_started_effect_receipt_sha256) ||
      (effect.predecessor_control_kind === 'TERMINAL_COMPENSATION' &&
        effect.predecessor_control_receipt_sha256 === effect.resume_started_effect_receipt_sha256)) {
    fail('completed effect predecessor control binding differs');
  }
  exactValue(resumeSiblingInventory.result, effect.effect_generation === 0 ? 'NOT_APPLICABLE' : 'PASS',
    'completed resume sibling applicability');
  requireIsoTimestamp(effect.started_at, 'completed effect start');
  requireIsoTimestamp(effect.completed_at, 'completed effect completion');
  if (Date.parse(effect.completed_at) < Date.parse(effect.started_at) ||
      typeof effect.existing_endpoint_reconciled !== 'boolean' ||
      typeof effect.orphan_endpoint_compensated !== 'boolean' ||
      effect.orphan_compensation_authorized !== true ||
      effect.orphan_compensation_contract_version !==
        'assesssuite-physio-stripe-webhook-orphan-compensation/1.0.0' ||
      effect.orphan_compensation_policy !==
        'delete-exact-metadata-bound-endpoint-prove-absence-then-recreate' ||
      !['ABSENT', 'COMPLETE'].includes(effect.fly_secret_prestate) ||
      !['ABSENT', 'EXACT'].includes(effect.provider_plan_state)) {
    fail('completed effect state or chronology differs');
  }
  for (const field of [
    'admission_receipt_sha256', 'effect_identity_receipt_sha256',
    'exact_image_canary_receipt_sha256', 'fly_secret_readback_sha256',
    'idempotency_key_sha256', 'prior_artifact_admission_sha256',
    'prior_idempotency_key_sha256', 'prior_request_sha256',
    'provider_endpoint_readback_sha256', 'provider_list_before_sha256',
    'provider_plan_receipt_sha256', 'provider_request_id_hashes_sha256',
    'request_sha256', 'resume_started_effect_receipt_sha256',
    'predecessor_control_receipt_sha256',
    'started_effect_receipt_sha256', 'stripe_signing_secret_sha256',
    'compensation_effect_identity_sha256', 'compensation_phase_receipt_sha256',
  ]) requireHash(effect[field], `completed webhook effect ${field}`);
  requireArtifactId(effect.provider_plan_artifact_id, 'completed effect provider-plan artifact ID');
  requireArtifactDigest(effect.provider_plan_artifact_digest,
    'completed effect provider-plan artifact digest');
  requireArtifactId(effect.compensation_phase_artifact_id,
    'completed effect compensation artifact ID');
  requireArtifactDigest(effect.compensation_phase_artifact_digest,
    'completed effect compensation artifact digest');
  if (!ENDPOINT_ID.test(effect.stripe_webhook_endpoint_id || '')) {
    fail('completed effect Stripe endpoint ID differs');
  }
  exactValue(receipt.effect_reconciliation_receipt_sha256, expected.effectReceiptSha256,
    'completed receipt effect binding');
  exactValue(receipt.admission_receipt_sha256, effect.admission_receipt_sha256,
    'completed receipt admission binding');
  exactValue(receipt.started_effect_receipt_sha256, effect.started_effect_receipt_sha256,
    'completed receipt STARTED binding');
  exactValue(receipt.effect_identity_receipt_sha256, effect.effect_identity_receipt_sha256,
    'completed receipt effect identity binding');
  exactValue(receipt.request_sha256, effect.request_sha256, 'completed receipt request binding');
  exactValue(receipt.effect_generation, effect.effect_generation, 'completed receipt generation binding');
  exactValue(receipt.stripe_signing_secret_sha256, effect.stripe_signing_secret_sha256,
    'completed receipt signing-secret fingerprint');
  exactValue(receipt.fly_webhook_secret_digest, effect.fly_webhook_secret_digest,
    'completed receipt Fly secret digest');
  exactValue(receipt.provider_endpoint_readback_sha256, sha256File(file('stripe-endpoint-readback.json')),
    'completed endpoint readback binding');
  exactValue(receipt.fly_secret_names_readback_sha256, sha256File(file('fly-secrets-after.json')),
    'completed Fly secret readback binding');
  exactValue(receipt.provider_request_id_hashes_sha256, sha256File(file('provider-request-id-hashes.json')),
    'completed provider request-ID binding');
  exactValue(receipt.provider_plan_receipt_sha256, sha256File(file('provider-plan.json')),
    'completed provider plan binding');
  exactValue(receipt.provider_plan_probe_readback_sha256, sha256File(file('provider-plan-probe-readback.json')),
    'completed provider-plan readback binding');
  exactValue(receipt.provider_plan_request_id_hashes_sha256,
    sha256File(file('provider-plan-request-id-hashes.json')), 'completed provider-plan request-ID binding');
  exactValue(effect.provider_plan_receipt_sha256, receipt.provider_plan_receipt_sha256,
    'completed effect provider plan binding');
  exactValue(effect.provider_plan_artifact_id, receipt.provider_plan_artifact_id,
    'completed effect provider plan artifact ID');
  exactValue(effect.provider_plan_artifact_digest, receipt.provider_plan_artifact_digest,
    'completed effect provider plan artifact digest');
  exactValue(receipt.prior_effect_receipt_sha256, effect.resume_started_effect_receipt_sha256,
    'completed receipt predecessor effect');
  exactValue(receipt.predecessor_control_kind, effect.predecessor_control_kind,
    'completed receipt predecessor control kind');
  exactValue(receipt.predecessor_control_receipt_sha256, effect.predecessor_control_receipt_sha256,
    'completed receipt predecessor control receipt');
  exactValue(receipt.prior_request_sha256, effect.prior_request_sha256,
    'completed receipt predecessor request');
  exactValue(receipt.prior_effect_resolution, effect.prior_effect_resolution,
    'completed receipt predecessor resolution');
  exactValue(receipt.prior_effect_readback_sha256, effect.prior_effect_readback_sha256,
    'completed receipt predecessor readback');
  exactValue(receipt.existing_endpoint_reconciled, effect.existing_endpoint_reconciled,
    'completed receipt endpoint reconciliation state');
  exactValue(receipt.orphan_compensation_contract_version, effect.orphan_compensation_contract_version,
    'completed receipt compensation contract');
  exactValue(receipt.orphan_endpoint_compensated, effect.orphan_endpoint_compensated,
    'completed receipt compensation state');
  exactValue(receipt.orphan_endpoint_id_sha256, effect.orphan_endpoint_id_sha256,
    'completed receipt orphan endpoint binding');
  exactValue(receipt.compensation_delete_request_id_sha256, effect.compensation_delete_request_id_sha256,
    'completed receipt compensation request binding');
  exactValue(receipt.compensation_absence_readback_sha256, effect.compensation_absence_readback_sha256,
    'completed receipt compensation absence binding');
  exactValue(receipt.compensation_phase_artifact_id, effect.compensation_phase_artifact_id,
    'completed receipt compensation artifact ID');
  exactValue(receipt.compensation_phase_artifact_digest, effect.compensation_phase_artifact_digest,
    'completed receipt compensation artifact digest');
  exactValue(receipt.compensation_phase_receipt_sha256, effect.compensation_phase_receipt_sha256,
    'completed receipt compensation phase binding');
  exactValue(receipt.compensation_effect_identity_sha256, effect.compensation_effect_identity_sha256,
    'completed receipt compensation effect identity');
  exactValue(effect.compensation_phase_receipt_sha256,
    compensationProof.latest_phase_receipt_sha256, 'completed recursive compensation receipt');
  exactValue(effect.compensation_effect_identity_sha256,
    compensationProof.compensation_effect_identity_sha256, 'completed recursive compensation identity');
  exactValue(effect.orphan_endpoint_compensated,
    compensationProof.orphan_endpoint_compensated, 'completed recursive compensation result');
  exactValue(effect.provider_plan_endpoint_id_sha256, plan.exact_endpoint_id_sha256,
    'completed effect provider-plan endpoint binding');
  exactValue(effect.provider_plan_state, plan.provider_state,
    'completed effect provider-plan state binding');
  exactValue(sha256File(file('stripe-webhook-effect-identity.json')), effect.effect_identity_receipt_sha256,
    'completed effect identity raw SHA binding');
  exactValue(identity.contract_version, 'assesssuite-physio-stripe-webhook-effect-identity/1.0.0',
    'completed effect identity contract');
  exactValue(identity.result, 'STARTED', 'completed effect identity result');
  exactValue(identity.application, effect.application, 'completed effect identity application');
  exactValue(identity.application_sha, effect.application_sha, 'completed effect identity application SHA');
  exactValue(identity.bootstrap_receipt_sha256, effect.bootstrap_receipt_sha256,
    'completed effect identity bootstrap receipt');
  exactValue(identity.exact_image_canary_receipt_sha256, effect.exact_image_canary_receipt_sha256,
    'completed effect identity canary receipt');
  exactValue(identity.capability_intent_id, effect.capability_intent_id,
    'completed effect identity capability intent');
  exactValue(identity.authority_reference, effect.authority_reference, 'completed effect identity authority');
  exactValue(identity.effect_generation, effect.effect_generation, 'completed effect identity generation');
  exactValue(identity.prior_effect_receipt_sha256, effect.resume_started_effect_receipt_sha256,
    'completed effect identity predecessor effect');
  exactValue(identity.prior_request_sha256, effect.prior_request_sha256,
    'completed effect identity predecessor request');
  exactValue(identity.prior_artifact_admission_sha256, effect.prior_artifact_admission_sha256,
    'completed effect identity predecessor admission');
  exactValue(identity.predecessor_control_kind, effect.predecessor_control_kind,
    'completed effect identity predecessor control kind');
  exactValue(identity.predecessor_control_receipt_sha256, effect.predecessor_control_receipt_sha256,
    'completed effect identity predecessor control receipt');
  exactValue(identity.idempotency_key_sha256, effect.idempotency_key_sha256,
    'completed effect identity idempotency key');
  exactValue(identity.prior_idempotency_key_sha256, effect.prior_idempotency_key_sha256,
    'completed effect identity predecessor idempotency key');
  exactValue(request.request_sha256, effect.request_sha256, 'completed request logical SHA binding');
  exactValue(request.authority_reference, effect.authority_reference, 'completed request authority binding');
  exactValue(request.effect_generation, effect.effect_generation, 'completed request generation binding');
  exactValue(plan.started_effect_receipt_sha256, effect.started_effect_receipt_sha256,
    'completed provider plan STARTED binding');
  exactValue(plan.authority_reference, effect.authority_reference, 'completed provider plan authority binding');
  exactValue(plan.request_sha256, effect.request_sha256, 'completed provider plan request binding');
  exactValue(plan.effect_generation, effect.effect_generation, 'completed provider plan generation binding');

  const requestForHash = structuredClone(request);
  delete requestForHash.request_sha256;
  delete requestForHash.metadata?.requestSha256;
  exactValue(createHash('sha256').update(JSON.stringify(requestForHash)).digest('hex'), effect.request_sha256,
    'completed request canonical logical SHA');
  exactValue(request.metadata?.effectGeneration, String(effect.effect_generation),
    'completed request metadata generation');
  exactValue(request.metadata?.requestSha256, effect.request_sha256,
    'completed request metadata request SHA');
  exactValue(request.metadata?.startedEffectReceiptSha256, effect.effect_identity_receipt_sha256,
    'completed request metadata effect identity');
  exactValue(request.idempotency_key_sha256, effect.idempotency_key_sha256,
    'completed request idempotency key');
  exactValue(request.prior_idempotency_key_sha256, effect.prior_idempotency_key_sha256,
    'completed request predecessor idempotency key');
  exactValue(request.capability_intent_id, effect.capability_intent_id,
    'completed request capability intent');
  exactValue(request.endpoint, ENDPOINT_URL, 'completed request endpoint');
  exactValue(request.api_version, '2026-07-29.dahlia', 'completed request API version');
  exactValue(JSON.stringify(request.enabled_events), JSON.stringify(EVENTS), 'completed request events');
  exactValue(request.prior_effect_receipt_sha256, effect.resume_started_effect_receipt_sha256,
    'completed request predecessor effect');
  exactValue(request.prior_request_sha256, effect.prior_request_sha256,
    'completed request predecessor request');
  exactValue(request.prior_artifact_admission_sha256, effect.prior_artifact_admission_sha256,
    'completed request predecessor admission');
  exactValue(request.predecessor_control_kind, effect.predecessor_control_kind,
    'completed request predecessor control kind');
  exactValue(request.predecessor_control_receipt_sha256, effect.predecessor_control_receipt_sha256,
    'completed request predecessor control receipt');
  exactMetadata(request.metadata, {
    appId: 'local-assesssuite-physio',
    applicationSha: expected.applicationSha,
    bootstrapReceiptSha256: expected.bootstrapReceiptSha256,
    capabilityIntentId: expected.capabilityIntentId,
    effectGeneration: String(effect.effect_generation),
    professionId: 'physio',
    requestSha256: effect.request_sha256,
    startedEffectReceiptSha256: effect.effect_identity_receipt_sha256,
  });
  const expectedIdempotencyKey = `physio-webhook-${hashValue([
    expected.applicationSha,
    expected.bootstrapReceiptSha256,
    expected.capabilityIntentId,
    String(effect.effect_generation),
    effect.resume_started_effect_receipt_sha256,
  ].join('|')).slice(0, 40)}`;
  exactValue(hashValue(expectedIdempotencyKey), effect.idempotency_key_sha256,
    'completed deterministic idempotency key fingerprint');
  if (effect.effect_generation === 0) {
    for (const [value, label] of [
      [effect.resume_started_effect_receipt_sha256, 'predecessor effect'],
      [effect.prior_request_sha256, 'predecessor request'],
      [effect.prior_idempotency_key_sha256, 'predecessor idempotency key'],
    ]) exactValue(value, ZERO_SHA256, `generation-zero ${label}`);
  } else {
    if (effect.resume_started_effect_receipt_sha256 === ZERO_SHA256 ||
        effect.prior_request_sha256 === ZERO_SHA256 || effect.prior_idempotency_key_sha256 === ZERO_SHA256) {
      fail('resumed generation predecessor identity is absent');
    }
  }
  const outstandingInventory = readJsonFile(file('outstanding-effect-inventory.json'),
    'completed outstanding-effect inventory');
  exactKeys(outstandingInventory, [
    'application_sha', 'contract_version', 'expired_metadata_included',
    'historical_artifact_classes', 'historical_artifact_count', 'pages_scanned', 'result',
  ], 'completed outstanding-effect inventory');
  exactValue(outstandingInventory.contract_version, 'assesssuite-outstanding-effect-inventory/2.0.0',
    'completed outstanding-effect inventory contract');
  exactValue(outstandingInventory.application_sha, expected.applicationSha,
    'completed outstanding-effect application SHA');
  exactValue(outstandingInventory.expired_metadata_included, true,
    'completed outstanding-effect expired metadata admission');
  exactValue(JSON.stringify(outstandingInventory.historical_artifact_classes),
    JSON.stringify(['STARTED','PROVIDER_PLAN','COMPENSATION_PHASE','EFFECT','COMPLETED']),
    'completed outstanding-effect artifact classes');
  if (effect.effect_generation === 0) {
    exactValue(outstandingInventory.result, 'PASS', 'fresh outstanding-effect inventory result');
    exactValue(outstandingInventory.historical_artifact_count, 0,
      'fresh outstanding-effect inventory count');
    if (!Number.isSafeInteger(outstandingInventory.pages_scanned) || outstandingInventory.pages_scanned < 1) {
      fail('fresh outstanding-effect inventory page count differs');
    }
  } else {
    exactValue(outstandingInventory.result, 'NOT_APPLICABLE',
      'resumed outstanding-effect inventory result');
    exactValue(outstandingInventory.historical_artifact_count, null,
      'resumed outstanding-effect inventory count');
    exactValue(outstandingInventory.pages_scanned, null, 'resumed outstanding-effect inventory pages');
  }
  if (effect.effect_generation > 0 && effect.idempotency_key_sha256 === effect.prior_idempotency_key_sha256) {
    fail('completed generation reused its predecessor idempotency key');
  }

  exactValue(plan.contract_version, 'assesssuite-physio-stripe-webhook-effect-plan/1.0.0',
    'completed provider-plan contract');
  exactValue(plan.result, 'PASS', 'completed provider-plan result');
  exactValue(plan.application, effect.application, 'completed provider-plan application');
  exactValue(plan.application_sha, effect.application_sha, 'completed provider-plan application SHA');
  exactValue(plan.bootstrap_receipt_sha256, effect.bootstrap_receipt_sha256,
    'completed provider-plan bootstrap receipt');
  exactValue(plan.capability_intent_id, effect.capability_intent_id,
    'completed provider-plan capability intent');
  exactValue(plan.current_effect_identity_receipt_sha256, effect.effect_identity_receipt_sha256,
    'completed provider-plan current effect identity');
  exactValue(plan.prior_effect_receipt_sha256, effect.resume_started_effect_receipt_sha256,
    'completed provider-plan predecessor effect');
  exactValue(plan.prior_effect_resolution, effect.prior_effect_resolution,
    'completed provider-plan predecessor resolution');
  exactValue(plan.prior_effect_readback_sha256, effect.prior_effect_readback_sha256,
    'completed provider-plan predecessor readback');
  exactValue(plan.prior_effect_readback_sha256,
    sha256File(file('provider-plan-probe-readback.json')),
    'completed provider-plan predecessor readback binding');
  exactValue(plan.provider_probe_readback_sha256, sha256File(file('provider-plan-probe-readback.json')),
    'completed provider-plan probe binding');
  exactValue(plan.provider_probe_request_id_hashes_sha256,
    sha256File(file('provider-plan-request-id-hashes.json')),
    'completed provider-plan request-ID binding');
  exactValue(plan.provider_mutation_absent, true, 'completed provider-plan mutation state');
  requireIsoTimestamp(plan.probed_at, 'completed provider-plan probe');
  if (Date.parse(plan.probed_at) < Date.parse(effect.started_at) ||
      Date.parse(plan.probed_at) > Date.parse(effect.completed_at)) {
    fail('completed provider-plan chronology differs');
  }
  requireArtifactId(effect.provider_plan_artifact_id, 'completed provider-plan artifact ID');
  requireArtifactDigest(effect.provider_plan_artifact_digest, 'completed provider-plan artifact digest');
  if ((effect.effect_generation === 0 && effect.prior_effect_resolution !== 'NOT_APPLICABLE') ||
      (effect.effect_generation > 0 && plan.provider_state === 'ABSENT' &&
        effect.prior_effect_resolution !== 'NOT_APPLIED_BY_AUTHORITATIVE_ABSENCE') ||
      (effect.effect_generation > 0 && plan.provider_state === 'EXACT' &&
        effect.prior_effect_resolution !== 'COMMIT_PRESENT_REQUIRES_COMPENSATION')) {
    fail('completed predecessor resolution state differs');
  }

  const expectedEndpointMetadata = {
    appId: 'local-assesssuite-physio',
    applicationSha: expected.applicationSha,
    bootstrapReceiptSha256: expected.bootstrapReceiptSha256,
    capabilityIntentId: expected.capabilityIntentId,
    effectGeneration: String(effect.effect_generation),
    professionId: 'physio',
    requestSha256: effect.request_sha256,
    startedEffectReceiptSha256: effect.effect_identity_receipt_sha256,
  };
  const probeInventory = readJsonFile(file('provider-plan-probe-readback.json'),
    'completed provider-plan probe readback');
  const beforeInventory = readJsonFile(file('stripe-endpoints-before.json'),
    'completed Stripe endpoint prestate');
  if (plan.provider_state === 'ABSENT') {
    exactValue(plan.planned_action, 'CREATE_FROM_PROVEN_ABSENCE', 'completed provider-plan action');
    for (const [value, label] of [
      [plan.exact_endpoint_id, 'exact endpoint ID'],
      [plan.exact_endpoint_id_sha256, 'exact endpoint ID fingerprint'],
      [plan.endpoint_effect_generation, 'endpoint generation'],
      [plan.endpoint_request_sha256, 'endpoint request'],
      [plan.endpoint_started_effect_receipt_sha256, 'endpoint effect identity'],
      [plan.observed_endpoint_effect_generation, 'observed endpoint generation'],
      [plan.observed_endpoint_request_sha256, 'observed endpoint request'],
      [plan.observed_endpoint_started_effect_receipt_sha256, 'observed endpoint effect identity'],
    ]) exactValue(value, null, `absent provider-plan ${label}`);
    exactValue(plan.endpoint_lineage, 'NONE', 'absent provider-plan endpoint lineage');
    exactValue(plan.observed_endpoint_lineage, 'NONE', 'absent provider-plan observed lineage');
    validateInventory(probeInventory, {
      keys: ['exact_endpoint', 'exact_url_count', 'has_more', 'physio_metadata_bound_count'],
      count: 0, physioBoundCount: 0, endpoint: null,
    }, 'completed provider-plan probe inventory');
    validateInventory(beforeInventory, {
      keys: ['exact_endpoint', 'exact_url_count', 'has_more', 'observed_endpoint_lineage'],
      count: 0, lineage: 'NONE', endpoint: null,
    }, 'completed provider prestate inventory');
  } else {
    exactValue(plan.planned_action, 'RECONCILE_OR_COMPENSATE_EXACT', 'completed provider-plan action');
    if (!['CURRENT', 'PRIOR'].includes(plan.endpoint_lineage) ||
        plan.endpoint_lineage !== plan.observed_endpoint_lineage ||
        !ENDPOINT_ID.test(plan.exact_endpoint_id || '') ||
        hashValue(plan.exact_endpoint_id) !== plan.exact_endpoint_id_sha256 ||
        !Number.isSafeInteger(plan.endpoint_effect_generation) || plan.endpoint_effect_generation < 0 ||
        plan.endpoint_effect_generation !== plan.observed_endpoint_effect_generation ||
        plan.endpoint_request_sha256 !== plan.observed_endpoint_request_sha256 ||
        plan.endpoint_started_effect_receipt_sha256 !==
          plan.observed_endpoint_started_effect_receipt_sha256) {
      fail('exact provider-plan lineage differs');
    }
    requireHash(plan.endpoint_request_sha256, 'completed provider-plan endpoint request');
    requireHash(plan.endpoint_started_effect_receipt_sha256,
      'completed provider-plan endpoint effect identity');
    if (plan.endpoint_lineage !== 'PRIOR') {
      fail('completed provider-plan exact endpoint is not an explicitly resumed predecessor');
    }
    const observedMetadata = plan.endpoint_lineage === 'CURRENT' ? expectedEndpointMetadata : {
      ...expectedEndpointMetadata,
      effectGeneration: String(effect.effect_generation - 1),
      requestSha256: plan.endpoint_request_sha256,
      startedEffectReceiptSha256: plan.endpoint_started_effect_receipt_sha256,
    };
    if (plan.endpoint_lineage === 'CURRENT') {
      exactValue(plan.endpoint_effect_generation, effect.effect_generation,
        'current provider-plan generation');
      exactValue(plan.endpoint_request_sha256, effect.request_sha256,
        'current provider-plan request');
      exactValue(plan.endpoint_started_effect_receipt_sha256, effect.effect_identity_receipt_sha256,
        'current provider-plan effect identity');
    } else {
      exactValue(plan.endpoint_effect_generation, effect.effect_generation - 1,
        'prior provider-plan generation');
      exactValue(plan.endpoint_request_sha256, effect.prior_request_sha256,
        'prior provider-plan request');
      if (effect.effect_generation < 1) fail('prior provider endpoint exists for generation zero');
    }
    const probed = validateInventory(probeInventory, {
      keys: ['exact_endpoint', 'exact_url_count', 'has_more', 'physio_metadata_bound_count'],
      count: 1, physioBoundCount: 1, endpoint: true, metadata: observedMetadata,
    }, 'completed provider-plan probe inventory');
    const before = compensationProof.orphan_endpoint_compensated
      ? validateInventory(beforeInventory, {
        keys: ['exact_endpoint', 'exact_url_count', 'has_more', 'observed_endpoint_lineage'],
        count: 0, lineage: 'NONE', endpoint: null,
      }, 'completed post-compensation provider prestate inventory')
      : validateInventory(beforeInventory, {
        keys: ['exact_endpoint', 'exact_url_count', 'has_more', 'observed_endpoint_lineage'],
        count: 1, lineage: plan.endpoint_lineage, endpoint: true, metadata: observedMetadata,
      }, 'completed provider prestate inventory');
    exactValue(probed.id, plan.exact_endpoint_id, 'completed provider-plan probed endpoint ID');
    if (before) exactValue(before.id, plan.exact_endpoint_id, 'completed provider-prestate endpoint ID');
  }

  const planRequestIds = readJsonFile(file('provider-plan-request-id-hashes.json'),
    'completed provider-plan request IDs');
  validateProviderRequestIdHashes(planRequestIds, ['provider_probe'], 'provider-plan requests');
  const effectRequestIds = readJsonFile(file('provider-request-id-hashes.json'),
    'completed effect provider request IDs');
  const expectedEffectRequestNames = [
    'create', 'endpoint_readback', 'list_after', 'list_before',
  ].sort();
  validateProviderRequestIdHashes(effectRequestIds, expectedEffectRequestNames, 'effect provider requests');

  exactValue(sha256File(file('resume-artifact-admission.json')), effect.prior_artifact_admission_sha256,
    'completed predecessor artifact admission binding');
  exactValue(effect.provider_list_before_sha256, sha256File(file('stripe-endpoints-before.json')),
    'completed provider prestate binding');
  exactValue(effect.provider_endpoint_readback_sha256,
    sha256File(file('stripe-endpoint-readback.json')), 'completed effect endpoint readback binding');
  exactValue(effect.fly_secret_readback_sha256, sha256File(file('fly-secrets-after.json')),
    'completed effect Fly secret readback binding');
  exactValue(effect.provider_request_id_hashes_sha256,
    sha256File(file('provider-request-id-hashes.json')), 'completed effect provider request-ID binding');

  const beforeSecretNames = effect.fly_secret_prestate === 'ABSENT'
    ? FLY_SECRET_BASE_NAMES : [...FLY_SECRET_BASE_NAMES, 'STRIPE_WEBHOOK_SECRET'].sort();
  const beforeSecrets = validateFlySecretMetadata(
    readJsonFile(file('fly-secrets-before.json'), 'completed Fly secret prestate'),
    beforeSecretNames, 'completed Fly secret prestate');
  const afterSecrets = validateFlySecretMetadata(
    readJsonFile(file('fly-secrets-after.json'), 'completed Fly secret poststate'),
    [...FLY_SECRET_BASE_NAMES, 'STRIPE_WEBHOOK_SECRET'].sort(), 'completed Fly secret poststate');
  for (const name of FLY_SECRET_BASE_NAMES) {
    exactValue(afterSecrets.get(name)?.digest, beforeSecrets.get(name)?.digest,
      `completed Fly secret ${name} unchanged digest`);
  }
  exactValue(afterSecrets.get('STRIPE_WEBHOOK_SECRET')?.digest, effect.fly_webhook_secret_digest,
    'completed Fly webhook secret staged digest');
  exactValue(receipt.fly_webhook_secret_digest, afterSecrets.get('STRIPE_WEBHOOK_SECRET')?.digest,
    'completed receipt Fly webhook secret staged digest');

  const createdEndpoint = sanitizeStripeWebhookEndpoint(
    readJsonFile(file('stripe-create-response-sanitized.json'), 'completed Stripe create response'),
    expectedEndpointMetadata);
  const finalInventory = readJsonFile(file('stripe-endpoints-after.json'),
    'completed Stripe endpoint final inventory');
  const inventoryEndpoint = validateInventory(finalInventory, {
    keys: ['exact_endpoint', 'exact_url_count', 'has_more'],
    count: 1, endpoint: true, metadata: expectedEndpointMetadata,
  }, 'completed Stripe endpoint final inventory');
  exactValue(effect.existing_endpoint_reconciled, false,
    'completed effect exact create-response provenance');
  exactValue(effectRequestIds.create_reconciled_from_prior, false,
    'completed effect create request provenance');

  if (effect.orphan_endpoint_compensated) {
    exactValue(plan.provider_state, 'EXACT', 'compensation provider-plan state');
    exactValue(plan.endpoint_lineage, 'PRIOR', 'compensation provider-plan lineage');
    exactValue(effect.orphan_endpoint_id_sha256, compensationProof.target_endpoint_id_sha256,
      'completed recursive compensation target binding');
    exactValue(effect.compensation_absence_readback_sha256,
      compensationProof.compensation_absence_readback_sha256,
      'completed recursive compensation absence binding');
    exactValue(effect.compensation_delete_request_id_sha256,
      compensationProof.compensation_delete_request_id_sha256,
      'completed recursive compensation DELETE request binding');
  } else {
    exactValue(effect.orphan_endpoint_id_sha256, null, 'non-compensation orphan endpoint');
    exactValue(effect.compensation_delete_request_id_sha256, null,
      'non-compensation delete request');
    exactValue(effect.compensation_absence_readback_sha256, null,
      'non-compensation absence readback');
    exactValue(receipt.orphan_endpoint_id_sha256, null, 'non-compensation receipt orphan endpoint');
    exactValue(receipt.compensation_delete_request_id_sha256, null,
      'non-compensation receipt delete request');
    exactValue(receipt.compensation_absence_readback_sha256, null,
      'non-compensation receipt absence readback');
  }

  const endpoint = sanitizeStripeWebhookEndpoint(readJsonFile(file('stripe-endpoint-readback.json'),
    'completed endpoint readback'), {
    appId: 'local-assesssuite-physio',
    applicationSha: expected.applicationSha,
    bootstrapReceiptSha256: expected.bootstrapReceiptSha256,
    capabilityIntentId: expected.capabilityIntentId,
    effectGeneration: String(effect.effect_generation),
    professionId: 'physio',
    requestSha256: effect.request_sha256,
    startedEffectReceiptSha256: effect.effect_identity_receipt_sha256,
  });
  exactValue(endpoint.id, receipt.stripe_webhook_endpoint_id, 'completed endpoint ID binding');
  exactValue(endpoint.id, effect.stripe_webhook_endpoint_id, 'completed effect endpoint ID binding');
  exactValue(endpoint.id, createdEndpoint.id, 'completed create/readback endpoint ID binding');
  exactValue(endpoint.id, inventoryEndpoint.id, 'completed inventory/readback endpoint ID binding');
  return Object.freeze({
    effect_generation: effect.effect_generation,
    effect_receipt_sha256: expected.effectReceiptSha256,
    final_receipt_sha256: sha256File(file('physio-production-stripe-webhook.json')),
    request_sha256: effect.request_sha256,
    started_effect_receipt_sha256: effect.started_effect_receipt_sha256,
  });
}

function option(args, name) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : '';
  if (!value || value.startsWith('--')) fail(`missing ${name}`);
  return value;
}

function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (command !== 'scan') fail('usage: scan --root <directory>');
  assertWebhookEvidenceTreeSafe(option(args, '--root'));
  process.stdout.write('{"result":"PASS"}\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
