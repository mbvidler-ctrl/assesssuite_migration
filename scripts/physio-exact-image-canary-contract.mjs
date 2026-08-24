// Content-free release contract for the Physio immutable-image provider canary.
//
// The artifact intentionally contains only fixed booleans, bounded counters,
// provider/model labels and SHA-256 receipts. Provider request identifiers are
// never written verbatim: the historically named `provider_request_id` field
// is a contract-stable *digest* and must be `sha256:<64 lowercase hex>`.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  validatePhysioExactImageCanarySuccessPacket as validateSuccessPacket,
} from './physio-exact-image-canary-success-contract.mjs';

export const PHYSIO_EXACT_IMAGE_CANARY_CONTRACT =
  'assesssuite-physio-exact-image-canary/3.0.0';
export const PHYSIO_EXACT_IMAGE_CANARY_EFFECT_CONTRACT =
  'assesssuite-physio-exact-image-canary-effect/1.0.0';
export const PHYSIO_EXACT_IMAGE_CANARY_COMPLETED_EFFECT_CONTRACT =
  'assesssuite-physio-exact-image-canary-completed-effect/1.0.0';
export const PHYSIO_EXACT_IMAGE_CANARY_SUCCESS_PACKET_CONTRACT =
  'assesssuite-physio-exact-image-canary-success-packet/1.0.0';
export const PHYSIO_EXACT_IMAGE_CANARY_SUCCESS_PACKET_FILES = Object.freeze([
  'SHA256SUMS',
  'canary-completed-effect-reconciliation.json',
  'canary-effect-reconciliation.json',
  'candidate-artifact-admission.json',
  'candidate-artifact-execution-admission.json',
  'physio-exact-image-canary.json',
  'provider-canary-admission.json',
  'provider-canary-started-effect.json',
]);
// The delegated whole-packet reader treats these as mandatory raw-hash joins.
// Keeping the join inventory at this public boundary makes STARTED fixture
// identity and terminal COMPLETED provenance explicit to every caller.
export const PHYSIO_EXACT_IMAGE_CANARY_SUCCESS_PACKET_JOIN_FIELDS = Object.freeze([
  'audio_fixture_sha256',
  'document_fixture_sha256',
  'started_effect_receipt_sha256',
  'effect_reconciliation_receipt_sha256',
  'canary_receipt_sha256',
  'provider_canary_admission_receipt_sha256',
  'candidate_artifact_admission_receipt_sha256',
  'candidate_artifact_execution_admission_receipt_sha256',
]);
export const PHYSIO_CANARY_APPLICATION = 'assesssuite-physio-production';
export const PHYSIO_CANARY_APP_ID = 'local-assesssuite-physio';
export const PHYSIO_CANARY_PROFESSION_ID = 'physio';
export const PHYSIO_CANARY_MAX_PAID_CALLS = 8;
export const PHYSIO_CANARY_CONTAINER_PREFIX = 'assesssuite-physio-canary-';
export const PHYSIO_CANARY_TTL_SECONDS = 1_800;
export const PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS = Object.freeze([
  'gpt-4.1-mini-2025-04-14',
  'gpt-4.1-2025-04-14',
]);
export const PHYSIO_CANARY_TRANSCRIPTION_MODEL = 'whisper-1';

export const PHYSIO_CANARY_TASK_IDS = Object.freeze([
  'physio.initial_assessment_summary.v1',
  'physio.soap_note.v1',
  'physio.management_plan.v1',
  'physio.progress_comparison.v1',
  'physio.referrer_update.v1',
  'physio.discharge_summary.v1',
]);

// The control-plane capability intent uses short, provider-neutral names.
// Receipt task keys retain the public versioned API IDs so deploy evidence is
// tied to the exact user-visible contracts. Keep this mapping explicit: it is
// the only accepted translation between the eight authorised paid calls and
// the six versioned task IDs plus transcription/document extraction.
export const PHYSIO_CANARY_PROVIDER_TASK_MAP = Object.freeze({
  initial_assessment_summary: PHYSIO_CANARY_TASK_IDS[0],
  soap_note: PHYSIO_CANARY_TASK_IDS[1],
  management_plan: PHYSIO_CANARY_TASK_IDS[2],
  progress_comparison: PHYSIO_CANARY_TASK_IDS[3],
  referrer_update: PHYSIO_CANARY_TASK_IDS[4],
  discharge_summary: PHYSIO_CANARY_TASK_IDS[5],
  transcription: 'transcription',
  extraction: 'extraction',
});
export const PHYSIO_CANARY_PROVIDER_TASK_SET = Object.freeze(
  Object.keys(PHYSIO_CANARY_PROVIDER_TASK_MAP),
);

const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const RAW_SHA_RE = /^[0-9a-f]{64}$/;
const RELEASE_SHA_RE = /^[0-9a-f]{40}$/;
const LOCAL_IMAGE_RE = /^sha256:[0-9a-f]{64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SAFE_LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/ -]{0,159}$/;

function fail(message) {
  throw new TypeError(`Physio exact-image canary receipt rejected: ${message}`);
}

function plainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, expected, label) {
  plainObject(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail(`${label} key set differs`);
}

function safeLabel(value, label) {
  if (typeof value !== 'string' || !SAFE_LABEL_RE.test(value)) fail(`${label} is invalid`);
}

function sha(value, label) {
  if (typeof value !== 'string' || !SHA_RE.test(value)) fail(`${label} must be sha256:<64 lowercase hex>`);
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} must be a non-negative integer`);
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) fail(`${label} must be a positive integer`);
}

function validateFault(value, label) {
  exactKeys(value, [
    'status',
    'non_2xx_verified',
    'http_status',
    'error_code',
    'provider_contact_attempted',
    'placeholder_success',
    'persisted_false_success',
  ], `${label}.fault`);
  if (value.status !== 'PASS' || value.non_2xx_verified !== true ||
      !Number.isInteger(value.http_status) || value.http_status < 400 || value.http_status > 599 ||
      value.provider_contact_attempted !== true || value.placeholder_success !== false ||
      value.persisted_false_success !== false) {
    fail(`${label}.fault does not prove a loud provider failure`);
  }
  safeLabel(value.error_code, `${label}.fault.error_code`);
}

function validateProviderBase(value, label, usageKind) {
  const keys = [
    'status',
    'provider_posture',
    'provider',
    'model',
    'provider_request_id',
    'schema_receipt_sha256',
    'usage_delta',
  ];
  if (usageKind === 'document') keys.push('provider_response_sha256');
  exactKeys(value, keys, `${label}.success`);
  if (value.status !== 'PASS' || value.provider_posture !== 'real') {
    fail(`${label}.success is not a real provider receipt`);
  }
  safeLabel(value.provider, `${label}.success.provider`);
  safeLabel(value.model, `${label}.success.model`);
  if (usageKind === 'audio') {
    if (value.model !== PHYSIO_CANARY_TRANSCRIPTION_MODEL) {
      fail(`${label}.success.model is not the pinned transcription model`);
    }
  } else if (!PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS.includes(value.model)) {
    fail(`${label}.success.model is not a pinned provider-reported text snapshot`);
  }
  // Contract-stable field name; value is always a digest, never a raw ID.
  sha(value.provider_request_id, `${label}.success.provider_request_id`);
  sha(value.schema_receipt_sha256, `${label}.success.schema_receipt_sha256`);
  if (usageKind === 'document') {
    sha(value.provider_response_sha256, `${label}.success.provider_response_sha256`);
  }

  if (usageKind === 'audio') {
    exactKeys(value.usage_delta, ['audio_seconds', 'estimated_cost_microusd'], `${label}.usage_delta`);
    if (!(Number(value.usage_delta.audio_seconds) > 0)) fail(`${label} has no positive audio usage`);
  } else if (usageKind === 'document') {
    exactKeys(value.usage_delta, ['request_units', 'estimated_cost_microusd'], `${label}.usage_delta`);
    positiveInteger(value.usage_delta.request_units, `${label}.usage_delta.request_units`);
  } else {
    exactKeys(
      value.usage_delta,
      ['input_tokens', 'cached_input_tokens', 'output_tokens', 'estimated_cost_microusd'],
      `${label}.usage_delta`,
    );
    nonNegativeInteger(value.usage_delta.input_tokens, `${label}.usage_delta.input_tokens`);
    nonNegativeInteger(value.usage_delta.cached_input_tokens, `${label}.usage_delta.cached_input_tokens`);
    if (value.usage_delta.cached_input_tokens > value.usage_delta.input_tokens) {
      fail(`${label}.usage_delta.cached_input_tokens exceeds input_tokens`);
    }
    positiveInteger(value.usage_delta.output_tokens, `${label}.usage_delta.output_tokens`);
  }
  nonNegativeInteger(
    value.usage_delta.estimated_cost_microusd,
    `${label}.usage_delta.estimated_cost_microusd`,
  );
}

function validateTask(value, taskId) {
  exactKeys(value, [
    'success',
    'fault',
    'structured_schema_valid',
    'editable_persistence_verified',
    'persistence_receipt_sha256',
  ], `tasks.${taskId}`);
  validateProviderBase(value.success, `tasks.${taskId}`, 'tokens');
  validateFault(value.fault, `tasks.${taskId}`);
  if (value.structured_schema_valid !== true || value.editable_persistence_verified !== true) {
    fail(`${taskId} lacks schema/editable persistence proof`);
  }
  sha(value.persistence_receipt_sha256, `tasks.${taskId}.persistence_receipt_sha256`);
}

function validateTranscription(value) {
  exactKeys(value, [
    'success',
    'fault',
    'real_media_fixture',
    'fixture_receipt_sha256',
  ], 'transcription');
  validateProviderBase(value.success, 'transcription', 'audio');
  validateFault(value.fault, 'transcription');
  if (value.real_media_fixture !== true) fail('transcription did not use a real media fixture');
  sha(value.fixture_receipt_sha256, 'transcription.fixture_receipt_sha256');
}

function validateExtraction(value) {
  exactKeys(value, [
    'success',
    'fault',
    'real_document_fixture',
    'fixture_receipt_sha256',
  ], 'extraction');
  validateProviderBase(value.success, 'extraction', 'document');
  validateFault(value.fault, 'extraction');
  if (value.real_document_fixture !== true) fail('extraction did not use a real document fixture');
  sha(value.fixture_receipt_sha256, 'extraction.fixture_receipt_sha256');
}

function validateProductionRuntime(value, receipt) {
  exactKeys(value, [
    'mode',
    'strict_canary_mode',
    'observed_child_node_env',
    'production_bootstrap_completed',
    'success_bootstrap_receipt_sha256',
    'fault_bootstrap_receipt_sha256',
    'success_version_receipt_sha256',
    'fault_version_receipt_sha256',
    'success_capability_vector_sha256',
    'fault_capability_vector_sha256',
    'runtime_tree_manifest_receipt_sha256',
    'observed_release_sha',
    'observed_immutable_image',
    'server_entry_sequence',
    'loopback_only',
    'ephemeral_storage',
    'ephemeral_state_removed',
    'test_harness_used',
    'fixed_otp_used',
    'success_live_proof',
    'fault_live_proof',
  ], 'production_runtime');
  if (
    value.mode !== 'production-process' ||
    value.strict_canary_mode !== true ||
    value.observed_child_node_env !== 'production' ||
    value.production_bootstrap_completed !== true ||
    value.observed_release_sha !== receipt.application_sha ||
    value.observed_immutable_image !== receipt.immutable_image ||
    value.server_entry_sequence !== 'productionBootstrap-to-server/index' ||
    value.loopback_only !== true ||
    value.ephemeral_storage !== true ||
    value.ephemeral_state_removed !== true ||
    value.test_harness_used !== false ||
    value.fixed_otp_used !== false ||
    value.success_live_proof !== true ||
    value.fault_live_proof !== true
  ) {
    fail('production_runtime does not prove the strict production process journey');
  }
  for (const name of [
    'success_bootstrap_receipt_sha256',
    'fault_bootstrap_receipt_sha256',
    'success_version_receipt_sha256',
    'fault_version_receipt_sha256',
    'success_capability_vector_sha256',
    'fault_capability_vector_sha256',
    'runtime_tree_manifest_receipt_sha256',
  ]) sha(value[name], `production_runtime.${name}`);
}

/**
 * Validate and return a content-free canary receipt. The strict allowlist is
 * also the output firewall: prompts, provider outputs, transcripts, uploaded
 * document text, direct identifiers and raw provider request IDs have nowhere
 * to appear in an accepted artifact.
 */
export function validatePhysioExactImageCanaryReceipt(receipt, {
  expectedApplicationSha,
  expectedImmutableImage,
  expectedCandidateArchiveSha256,
  maximumCostMicrousd,
} = {}) {
  exactKeys(receipt, [
    'contract_version',
    'result',
    'application',
    'application_sha',
    'immutable_image',
    'image_digest',
    'candidate_archive_sha256',
    'profession_id',
    'app_id',
    'carrier_type',
    'carrier_id_sha256',
    'isolated_candidate_image_verified',
    'prior_carrier_reconciled',
    'prior_carrier_admission_readback_sha256',
    'carrier_pre_destroy_readback_sha256',
    'carrier_post_destroy_readback_sha256',
    'remaining_exact_namespace_container_count',
    'disposable_container_destroyed',
    'host_port_binding_count',
    'mount_count',
    'custom_dns_count',
    'network_mode',
    'docker_volume_inventory_unchanged',
    'production_mock_scan_passed',
    'production_runtime',
    'bounded_paid_calls',
    'cost_ceiling_microusd',
    'actual_cost_microusd',
    'tasks',
    'transcription',
    'extraction',
    'started_at',
    'completed_at',
  ], 'receipt');

  if (receipt.contract_version !== PHYSIO_EXACT_IMAGE_CANARY_CONTRACT || receipt.result !== 'PASS' ||
      receipt.application !== PHYSIO_CANARY_APPLICATION ||
      receipt.profession_id !== PHYSIO_CANARY_PROFESSION_ID ||
      receipt.app_id !== PHYSIO_CANARY_APP_ID) {
    fail('identity or aggregate result differs');
  }
  if (!RELEASE_SHA_RE.test(receipt.application_sha)) fail('application_sha is not an exact commit');
  if (!LOCAL_IMAGE_RE.test(receipt.immutable_image)) fail('immutable_image is not an exact local image ID');
  if (receipt.image_digest !== receipt.immutable_image) fail('image_digest differs');
  sha(receipt.candidate_archive_sha256, 'candidate_archive_sha256');
  if (expectedApplicationSha && receipt.application_sha !== expectedApplicationSha) fail('application_sha differs');
  if (expectedImmutableImage && receipt.immutable_image !== expectedImmutableImage) fail('immutable_image differs');
  if (expectedCandidateArchiveSha256 &&
      receipt.candidate_archive_sha256 !== expectedCandidateArchiveSha256) {
    fail('candidate_archive_sha256 differs');
  }
  if (receipt.carrier_type !== 'local-docker') fail('carrier_type differs');
  sha(receipt.carrier_id_sha256, 'carrier_id_sha256');
  if (typeof receipt.prior_carrier_reconciled !== 'boolean') fail('prior_carrier_reconciled differs');
  for (const name of [
    'prior_carrier_admission_readback_sha256',
    'carrier_pre_destroy_readback_sha256',
    'carrier_post_destroy_readback_sha256',
  ]) sha(receipt[name], name);
  validateProductionRuntime(receipt.production_runtime, receipt);
  if (receipt.isolated_candidate_image_verified !== true ||
      receipt.disposable_container_destroyed !== true ||
      receipt.host_port_binding_count !== 0 || receipt.mount_count !== 0 ||
      receipt.custom_dns_count !== 0 || receipt.network_mode !== 'bridge' ||
      receipt.remaining_exact_namespace_container_count !== 0 ||
      receipt.docker_volume_inventory_unchanged !== true ||
      receipt.production_mock_scan_passed !== true) {
    fail('isolated exact-image or mock-scan proof differs');
  }
  exactKeys(receipt.bounded_paid_calls, ['maximum', 'succeeded'], 'bounded_paid_calls');
  if (receipt.bounded_paid_calls.maximum !== PHYSIO_CANARY_MAX_PAID_CALLS ||
      receipt.bounded_paid_calls.succeeded !== PHYSIO_CANARY_MAX_PAID_CALLS) {
    fail(`paid-call bound must be exactly ${PHYSIO_CANARY_MAX_PAID_CALLS}`);
  }
  positiveInteger(receipt.cost_ceiling_microusd, 'cost_ceiling_microusd');
  nonNegativeInteger(receipt.actual_cost_microusd, 'actual_cost_microusd');
  if (receipt.actual_cost_microusd > receipt.cost_ceiling_microusd) fail('cost ceiling exceeded');
  if (maximumCostMicrousd !== undefined && receipt.cost_ceiling_microusd > maximumCostMicrousd) {
    fail('receipt cost ceiling exceeds controller maximum');
  }

  exactKeys(receipt.tasks, PHYSIO_CANARY_TASK_IDS, 'tasks');
  for (const taskId of PHYSIO_CANARY_TASK_IDS) validateTask(receipt.tasks[taskId], taskId);
  validateTranscription(receipt.transcription);
  validateExtraction(receipt.extraction);
  if (!ISO_RE.test(receipt.started_at) || !ISO_RE.test(receipt.completed_at) ||
      Date.parse(receipt.completed_at) < Date.parse(receipt.started_at)) {
    fail('canary timestamps are invalid');
  }

  return receipt;
}

export function readAndValidatePhysioExactImageCanaryReceipt(file, options = {}) {
  const resolved = path.resolve(file);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > 65_536) {
    fail('artifact file is missing, linked, empty or oversized');
  }
  return validatePhysioExactImageCanaryReceipt(JSON.parse(fs.readFileSync(resolved, 'utf8')), options);
}

export function validatePhysioCanaryEffectReceipt(receipt, {
  expectedApplicationSha,
  expectedProviderEffectId,
  expectedStartedEffectReceiptSha256,
  expectedImmutableImage,
  expectedCandidateArchiveSha256,
  maximumCostMicrousd,
} = {}) {
  exactKeys(receipt, [
    'application', 'application_sha', 'candidate_archive_sha256', 'completed_at',
    'contract_version', 'error_receipt_sha256', 'local_image_id',
    'maximum_cost_microusd', 'partial_provider_calls',
    'partial_provider_request_id_hashes',
    'partial_provider_usage', 'producer_exit_code', 'producer_stderr_sha256',
    'producer_stdout_sha256', 'provider_call_maximum', 'provider_effect_id',
    'result', 'started_effect_receipt_sha256',
  ], 'provider effect receipt');
  if (receipt.contract_version !== PHYSIO_EXACT_IMAGE_CANARY_EFFECT_CONTRACT ||
      !['COMPLETED', 'STARTED_UNRESOLVED'].includes(receipt.result) ||
      receipt.application !== PHYSIO_CANARY_APPLICATION ||
      !RELEASE_SHA_RE.test(receipt.application_sha || '') ||
      !LOCAL_IMAGE_RE.test(receipt.local_image_id || '') ||
      !SHA_RE.test(receipt.candidate_archive_sha256 || '') ||
      !SHA_RE.test(receipt.provider_effect_id || '') ||
      !RAW_SHA_RE.test(receipt.started_effect_receipt_sha256 || '') ||
      receipt.provider_call_maximum !== 8 ||
      !Number.isSafeInteger(receipt.maximum_cost_microusd) ||
      receipt.maximum_cost_microusd <= 0 || receipt.maximum_cost_microusd > 5_000_000 ||
      !Number.isSafeInteger(receipt.producer_exit_code) || receipt.producer_exit_code < 0 ||
      receipt.producer_exit_code > 255 ||
      !SHA_RE.test(receipt.producer_stdout_sha256 || '') ||
      !SHA_RE.test(receipt.producer_stderr_sha256 || '') ||
      !ISO_RE.test(receipt.completed_at || '')) {
    fail('provider effect identity differs');
  }
  if (expectedApplicationSha && receipt.application_sha !== expectedApplicationSha) {
    fail('provider effect application SHA differs');
  }
  if (expectedProviderEffectId && receipt.provider_effect_id !== expectedProviderEffectId) {
    fail('provider effect ID differs');
  }
  if (expectedStartedEffectReceiptSha256 &&
      receipt.started_effect_receipt_sha256 !== expectedStartedEffectReceiptSha256) {
    fail('provider effect STARTED receipt differs');
  }
  if (expectedImmutableImage && receipt.local_image_id !== expectedImmutableImage) {
    fail('provider effect immutable image differs');
  }
  if (expectedCandidateArchiveSha256 &&
      receipt.candidate_archive_sha256 !== expectedCandidateArchiveSha256) {
    fail('provider effect candidate archive differs');
  }
  if (maximumCostMicrousd !== undefined &&
      receipt.maximum_cost_microusd > maximumCostMicrousd) {
    fail('provider effect cost ceiling exceeds controller maximum');
  }
  if (!Array.isArray(receipt.partial_provider_request_id_hashes) ||
      receipt.partial_provider_request_id_hashes.length > PHYSIO_CANARY_MAX_PAID_CALLS ||
      receipt.partial_provider_request_id_hashes.some((value) => !SHA_RE.test(value))) {
    fail('partial_provider_request_id_hashes must contain only sha256:<64 lowercase hex>');
  }
  if (!Array.isArray(receipt.partial_provider_calls) ||
      receipt.partial_provider_calls.length > PHYSIO_CANARY_MAX_PAID_CALLS) {
    fail('partial_provider_calls differs');
  }
  for (const [index, call] of receipt.partial_provider_calls.entries()) {
    exactKeys(call, [
      'actual_cost_microusd', 'call_ordinal', 'provider_request_id_sha256', 'provider_task',
      'usage_receipt_sha256',
    ], `partial_provider_calls[${index}]`);
    const expectedTask = PHYSIO_CANARY_PROVIDER_TASK_SET[index];
    if (call.call_ordinal !== index + 1 || call.provider_task !== expectedTask ||
        call.provider_request_id_sha256 !== receipt.partial_provider_request_id_hashes[index] ||
        !SHA_RE.test(call.provider_request_id_sha256 || '') ||
        !SHA_RE.test(call.usage_receipt_sha256 || '') ||
        !Number.isSafeInteger(call.actual_cost_microusd) || call.actual_cost_microusd < 0 ||
        call.actual_cost_microusd > receipt.maximum_cost_microusd) {
      fail(`partial_provider_calls[${index}] differs`);
    }
  }
  if (receipt.partial_provider_request_id_hashes.length !==
      receipt.partial_provider_calls.length) {
    fail('partial provider evidence cardinality differs');
  }
  exactKeys(receipt.partial_provider_usage,
    ['actual_cost_microusd', 'calls_succeeded', 'last_observed_call_ordinal', 'usage_complete'],
    'partial_provider_usage');
  const usage = receipt.partial_provider_usage;
  if (typeof usage.usage_complete !== 'boolean' ||
      (usage.calls_succeeded !== null &&
        (!Number.isSafeInteger(usage.calls_succeeded) || usage.calls_succeeded < 0 ||
          usage.calls_succeeded > PHYSIO_CANARY_MAX_PAID_CALLS)) ||
      (usage.actual_cost_microusd !== null &&
        (!Number.isSafeInteger(usage.actual_cost_microusd) || usage.actual_cost_microusd < 0 ||
          usage.actual_cost_microusd > receipt.maximum_cost_microusd)) ||
      (usage.last_observed_call_ordinal !== null &&
        (!Number.isSafeInteger(usage.last_observed_call_ordinal) ||
          usage.last_observed_call_ordinal < 1 ||
          usage.last_observed_call_ordinal > PHYSIO_CANARY_MAX_PAID_CALLS))) {
    fail('partial_provider_usage differs');
  }
  if (receipt.partial_provider_calls.length > 0) {
    if (usage.calls_succeeded !== receipt.partial_provider_calls.length ||
        usage.last_observed_call_ordinal !== receipt.partial_provider_calls.length ||
        usage.actual_cost_microusd !== receipt.partial_provider_calls.reduce(
          (sum, call) => sum + call.actual_cost_microusd, 0,
        )) {
      fail('partial provider usage cardinality differs');
    }
  } else if (!(
    (usage.calls_succeeded === null && usage.actual_cost_microusd === null) ||
    (usage.calls_succeeded === 0 && usage.actual_cost_microusd === 0)
  )) {
    fail('empty partial provider usage differs');
  } else if (usage.last_observed_call_ordinal !== null) {
    fail('empty partial provider ordinal differs');
  }
  if (usage.usage_complete !==
      (receipt.partial_provider_calls.length === PHYSIO_CANARY_MAX_PAID_CALLS)) {
    fail('partial provider usage completeness differs');
  }
  if (receipt.result === 'COMPLETED') {
    if (receipt.producer_exit_code !== 0 || usage.usage_complete !== true ||
        usage.calls_succeeded !== PHYSIO_CANARY_MAX_PAID_CALLS ||
        usage.last_observed_call_ordinal !== PHYSIO_CANARY_MAX_PAID_CALLS ||
        receipt.partial_provider_request_id_hashes.length !== PHYSIO_CANARY_MAX_PAID_CALLS ||
        receipt.error_receipt_sha256 !== null) {
      fail('completed provider effect differs');
    }
  } else if (receipt.producer_exit_code === 0 ||
      !SHA_RE.test(receipt.error_receipt_sha256 || '')) {
    fail('unresolved provider effect differs');
  }
  return receipt;
}

export function readAndValidatePhysioCanaryEffectReceipt(file, options = {}) {
  const resolved = path.resolve(file);
  const before = fs.lstatSync(resolved);
  if (path.basename(resolved) !== 'canary-effect-reconciliation.json' ||
      !before.isFile() || before.isSymbolicLink() || before.size <= 0 || before.size > 65_536) {
    fail('provider effect artifact file is missing, linked, empty or oversized');
  }
  const descriptor = fs.openSync(resolved, fs.constants.O_RDONLY |
    (fs.constants.O_NOFOLLOW || 0));
  let bytes;
  try {
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.size !== before.size ||
        (before.dev !== undefined && opened.dev !== before.dev) ||
        (before.ino !== undefined && opened.ino !== before.ino)) {
      fail('provider effect artifact changed during read');
    }
    bytes = fs.readFileSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  const after = fs.lstatSync(resolved);
  if (!after.isFile() || after.isSymbolicLink() || after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs || after.dev !== before.dev || after.ino !== before.ino) {
    fail('provider effect artifact changed during read');
  }
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('provider effect artifact is not valid JSON');
  }
  return validatePhysioCanaryEffectReceipt(parsed, options);
}

export function readAndValidatePhysioExactImageCanarySuccessPacket(packetRoot, options = {}) {
  return validateSuccessPacket(packetRoot, options, {
    validateCanaryReceipt: validatePhysioExactImageCanaryReceipt,
    validateEffectReceipt: validatePhysioCanaryEffectReceipt,
  });
}

function successPacketArguments(argv) {
  const allowed = new Set([
    '--packet', '--application-sha', '--immutable-image', '--candidate-archive-sha256',
    '--canary-receipt-sha256', '--maximum-cost-microusd', '--provider-effect-id',
    '--candidate-artifact-id', '--candidate-artifact-digest', '--candidate-receipt-sha256',
    '--capability-intent-id', '--authority-reference', '--capability-binding-sha256',
  ]);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(name) || values.has(name) || value === undefined ||
        value.startsWith('--')) {
      fail('success-packet CLI arguments are missing, duplicated or unknown');
    }
    values.set(name, value);
  }
  if (!values.has('--packet')) fail('success-packet CLI requires --packet');
  const maximum = values.get('--maximum-cost-microusd');
  const artifactId = values.get('--candidate-artifact-id');
  if (maximum !== undefined &&
      (!/^[1-9][0-9]*$/.test(maximum) || Number(maximum) > 5_000_000)) {
    fail('success-packet maximum cost differs');
  }
  if (artifactId !== undefined && !/^[1-9][0-9]*$/.test(artifactId)) {
    fail('success-packet candidate artifact ID differs');
  }
  return {
    packet: values.get('--packet'),
    options: {
      expectedApplicationSha: values.get('--application-sha'),
      expectedImmutableImage: values.get('--immutable-image'),
      expectedCandidateArchiveSha256: values.get('--candidate-archive-sha256'),
      expectedCanaryReceiptSha256: values.get('--canary-receipt-sha256'),
      expectedProviderEffectId: values.get('--provider-effect-id'),
      expectedCandidateArtifactId: artifactId === undefined ? undefined : Number(artifactId),
      expectedCandidateArtifactDigest: values.get('--candidate-artifact-digest'),
      expectedCandidateReceiptSha256: values.get('--candidate-receipt-sha256'),
      expectedCapabilityIntentId: values.get('--capability-intent-id'),
      expectedAuthorityReference: values.get('--authority-reference'),
      expectedCapabilityBindingSha256: values.get('--capability-binding-sha256'),
      maximumCostMicrousd: maximum === undefined ? undefined : Number(maximum),
    },
  };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isMainModule() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  if (process.argv[2] === 'validate') {
    readAndValidatePhysioExactImageCanaryReceipt(argument('--receipt'), {
      expectedApplicationSha: argument('--application-sha'),
      expectedImmutableImage: argument('--immutable-image'),
      expectedCandidateArchiveSha256: argument('--candidate-archive-sha256'),
      maximumCostMicrousd: argument('--maximum-cost-microusd') === undefined
        ? undefined
        : Number(argument('--maximum-cost-microusd')),
    });
    process.stdout.write('Physio exact-image canary receipt: PASS\n');
  } else if (process.argv[2] === 'validate-effect') {
    readAndValidatePhysioCanaryEffectReceipt(argument('--receipt'), {
      expectedApplicationSha: argument('--application-sha'),
      expectedProviderEffectId: argument('--provider-effect-id'),
      expectedStartedEffectReceiptSha256: argument('--started-effect-receipt-sha256'),
      expectedImmutableImage: argument('--immutable-image'),
      expectedCandidateArchiveSha256: argument('--candidate-archive-sha256'),
      maximumCostMicrousd: argument('--maximum-cost-microusd') === undefined
        ? undefined
        : Number(argument('--maximum-cost-microusd')),
    });
    process.stdout.write('Physio exact-image canary effect receipt: PASS\n');
  } else if (process.argv[2] === 'validate-success-packet') {
    const parsed = successPacketArguments(process.argv.slice(3));
    readAndValidatePhysioExactImageCanarySuccessPacket(parsed.packet, parsed.options);
    process.stdout.write('Physio exact-image canary success packet: PASS\n');
  } else fail('expected validate, validate-effect or validate-success-packet subcommand');
}
