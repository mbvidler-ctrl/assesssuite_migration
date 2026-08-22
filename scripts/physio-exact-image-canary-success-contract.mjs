// Exact success-packet contract for the Physio immutable-image provider canary.
//
// This validator is the shared admission boundary for publication, deployment,
// completed-effect reconciliation and existing-success readback. It verifies
// the packet as one joined proof rather than accepting individually plausible
// JSON documents that do not describe the same provider effect.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPhysioCanaryReferralPdf } from './physio-exact-image-canary-document-fixture.mjs';
import { PHYSIO_CANARY_AUDIO_SHA256 } from './physio-exact-image-canary-fixture.mjs';

const PHYSIO_CANARY_APPLICATION = 'assesssuite-physio-production';
const PHYSIO_CANARY_MAX_PAID_CALLS = 8;
const PHYSIO_EXACT_IMAGE_CANARY_EFFECT_CONTRACT =
  'assesssuite-physio-exact-image-canary-effect/1.0.0';
const PHYSIO_CANARY_PROVIDER_TASK_SET = Object.freeze([
  'initial_assessment_summary',
  'soap_note',
  'management_plan',
  'progress_comparison',
  'referrer_update',
  'discharge_summary',
  'transcription',
  'extraction',
]);
const PHYSIO_CANARY_TASK_IDS = Object.freeze([
  'physio.initial_assessment_summary.v1',
  'physio.soap_note.v1',
  'physio.management_plan.v1',
  'physio.progress_comparison.v1',
  'physio.referrer_update.v1',
  'physio.discharge_summary.v1',
]);

export const PHYSIO_CANARY_SUCCESS_PACKET_CONTRACT =
  'assesssuite-physio-exact-image-canary-success-packet/1.0.0';
export const PHYSIO_CANARY_COMPLETED_EFFECT_CONTRACT =
  'assesssuite-physio-exact-image-canary-completed-effect/1.0.0';
export const PHYSIO_CANARY_PROVIDER_ADMISSION_CONTRACT =
  'assesssuite-physio-exact-image-canary-admission/1.0.0';
export const PHYSIO_GITHUB_ARTIFACT_ADMISSION_CONTRACT =
  'assesssuite-github-artifact-admission/1.0.0';

export const PHYSIO_CANARY_SUCCESS_PACKET_FILES = Object.freeze([
  'SHA256SUMS',
  'canary-completed-effect-reconciliation.json',
  'canary-effect-reconciliation.json',
  'candidate-artifact-admission.json',
  'candidate-artifact-execution-admission.json',
  'physio-exact-image-canary.json',
  'provider-canary-admission.json',
  'provider-canary-started-effect.json',
]);
export const PHYSIO_EXACT_IMAGE_CANARY_SUCCESS_PACKET_FILES =
  PHYSIO_CANARY_SUCCESS_PACKET_FILES;

const PACKET_DATA_FILES = Object.freeze(
  PHYSIO_CANARY_SUCCESS_PACKET_FILES.filter((name) => name !== 'SHA256SUMS'),
);
const RAW_SHA_RE = /^[0-9a-f]{64}$/;
const PREFIXED_SHA_RE = /^sha256:[0-9a-f]{64}$/;
const RELEASE_SHA_RE = /^[0-9a-f]{40}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CAPABILITY_RE = /^[A-Za-z0-9._:-]{1,160}$/;
const AUTHORITY_RE = /^[A-Za-z0-9._:/-]{1,240}$/;
const REPOSITORY = 'mbvidler-ctrl/assesssuite_migration';
const CANDIDATE_WORKFLOW = '.github/workflows/physio-production-prepare-release.yml';
const PROVIDER_TASK_SET = PHYSIO_CANARY_PROVIDER_TASK_SET.join(',');
const MAX_PACKET_BYTES = 1_048_576;
const MAX_JSON_BYTES = 131_072;

function fail(message) {
  throw new TypeError(`Physio exact-image canary success packet rejected: ${message}`);
}

function plainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function exactKeys(value, expected, label) {
  plainObject(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail(`${label} key set differs`);
}

function rawSha(value, label) {
  if (typeof value !== 'string' || !RAW_SHA_RE.test(value)) {
    fail(`${label} must be 64 lowercase hexadecimal characters`);
  }
  return value;
}

function prefixedSha(value, label) {
  if (typeof value !== 'string' || !PREFIXED_SHA_RE.test(value)) {
    fail(`${label} must be sha256:<64 lowercase hex>`);
  }
  return value;
}

function releaseSha(value, label) {
  if (typeof value !== 'string' || !RELEASE_SHA_RE.test(value)) {
    fail(`${label} must be an exact lowercase commit SHA`);
  }
  return value;
}

function iso(value, label) {
  if (typeof value !== 'string' || !ISO_RE.test(value) || !Number.isFinite(Date.parse(value))) {
    fail(`${label} must be a canonical UTC timestamp`);
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) fail(`${label} must be a positive integer`);
  return value;
}

function same(actual, expected, label) {
  if (actual !== expected) fail(`${label} differs`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalJsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

// This is deliberately byte-identical to the canonical usage serializer in
// the canary producer. It binds each terminal progress row to the exact usage
// object in the final provider receipt, rather than accepting only an equal
// aggregate cost from a different eight-call run.
function canonicalUsageJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalUsageJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalUsageJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function canaryProviderCalls(canary) {
  const successes = [
    ...PHYSIO_CANARY_TASK_IDS.map((taskId) => canary.tasks[taskId].success),
    canary.transcription.success,
    canary.extraction.success,
  ];
  return successes.map((success, index) => ({
    call_ordinal: index + 1,
    provider_task: PHYSIO_CANARY_PROVIDER_TASK_SET[index],
    provider_request_id_sha256: success.provider_request_id,
    usage_receipt_sha256: `sha256:${sha256(canonicalUsageJson(success.usage_delta))}`,
    actual_cost_microusd: success.usage_delta.estimated_cost_microusd,
  }));
}

function readStableRegularFile(file, maximumBytes, label) {
  const before = fs.lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink() || before.size <= 0 ||
      before.size > maximumBytes) {
    fail(`${label} is missing, linked, empty or oversized`);
  }
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  let bytes;
  try {
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.size !== before.size ||
        opened.dev !== before.dev || opened.ino !== before.ino) {
      fail(`${label} changed while opening`);
    }
    bytes = fs.readFileSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  const after = fs.lstatSync(file);
  if (!after.isFile() || after.isSymbolicLink() || after.size !== before.size ||
      after.dev !== before.dev || after.ino !== before.ino || after.mtimeMs !== before.mtimeMs) {
    fail(`${label} changed while reading`);
  }
  return bytes;
}

function readCanonicalJson(bytes, label) {
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(`${label} is not valid JSON`);
  }
  plainObject(value, label);
  if (!bytes.equals(canonicalJsonBytes(value))) {
    fail(`${label} is not canonical JSON`);
  }
  return value;
}

function validateManifest(bytes, dataBytes) {
  const text = bytes.toString('utf8');
  if (!bytes.equals(Buffer.from(text, 'utf8')) || !text.endsWith('\n') || text.includes('\r')) {
    fail('SHA256SUMS encoding or newline differs');
  }
  const lines = text.slice(0, -1).split('\n');
  if (lines.length !== PACKET_DATA_FILES.length) fail('SHA256SUMS cardinality differs');
  const names = [];
  for (const line of lines) {
    const match = line.match(/^([0-9a-f]{64})  ([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/);
    if (!match) fail('SHA256SUMS contains a malformed row');
    const [, expectedHash, name] = match;
    if (names.includes(name)) fail('SHA256SUMS contains a duplicate filename');
    names.push(name);
    if (!dataBytes.has(name)) fail('SHA256SUMS names an unadmitted file');
    if (sha256(dataBytes.get(name)) !== expectedHash) fail(`${name} checksum differs`);
  }
  if (JSON.stringify(names) !== JSON.stringify(PACKET_DATA_FILES)) {
    fail('SHA256SUMS membership or ordering differs');
  }
}

function readSuccessPacket(packetDirectory) {
  if (typeof packetDirectory !== 'string' || packetDirectory.length === 0) {
    fail('packet directory is required');
  }
  const resolved = path.resolve(packetDirectory);
  const before = fs.lstatSync(resolved);
  if (!before.isDirectory() || before.isSymbolicLink()) fail('packet path is not a safe directory');
  const entries = fs.readdirSync(resolved).sort();
  if (JSON.stringify(entries) !== JSON.stringify(PHYSIO_CANARY_SUCCESS_PACKET_FILES)) {
    fail('packet file set differs');
  }
  const bytes = new Map();
  let totalBytes = 0;
  for (const name of PHYSIO_CANARY_SUCCESS_PACKET_FILES) {
    const maximum = name === 'SHA256SUMS' ? 4_096 : MAX_JSON_BYTES;
    const value = readStableRegularFile(path.join(resolved, name), maximum, name);
    totalBytes += value.length;
    if (totalBytes > MAX_PACKET_BYTES) fail('packet exceeds its aggregate size bound');
    bytes.set(name, value);
  }
  const after = fs.lstatSync(resolved);
  if (!after.isDirectory() || after.isSymbolicLink() ||
      after.dev !== before.dev || after.ino !== before.ino || after.mtimeMs !== before.mtimeMs) {
    fail('packet directory changed while reading');
  }
  validateManifest(bytes.get('SHA256SUMS'), new Map(
    PACKET_DATA_FILES.map((name) => [name, bytes.get(name)]),
  ));
  const json = Object.fromEntries(PACKET_DATA_FILES.map((name) => [
    name,
    readCanonicalJson(bytes.get(name), name),
  ]));
  return { resolved, bytes, json };
}

export function derivePhysioCanaryProviderEffectId(providerAdmission) {
  plainObject(providerAdmission, 'provider admission');
  const effectIdentity = {
    contract_version: 'assesssuite-physio-exact-image-canary-effect-identity/1.0.0',
    application: providerAdmission.application,
    application_sha: providerAdmission.application_sha,
    capability_intent_id: providerAdmission.capability_intent_id,
    provider_action: 'exact-eight-real-provider-canary',
    audio_fixture_sha256: providerAdmission.audio_fixture_sha256,
    document_fixture_sha256: providerAdmission.document_fixture_sha256,
  };
  return `sha256:${sha256(JSON.stringify(effectIdentity))}`;
}

export function derivePhysioCanaryCapabilityBindingSha256(providerAdmission) {
  plainObject(providerAdmission, 'provider admission');
  if (typeof providerAdmission.capability_intent_id !== 'string' ||
      !CAPABILITY_RE.test(providerAdmission.capability_intent_id) ||
      typeof providerAdmission.authority_reference !== 'string' ||
      !AUTHORITY_RE.test(providerAdmission.authority_reference)) {
    fail('provider capability binding differs');
  }
  return sha256(canonicalUsageJson({
    capability_intent_id: providerAdmission.capability_intent_id,
    authority_reference: providerAdmission.authority_reference,
  }));
}

const SHARED_PROVIDER_FIELDS = Object.freeze([
  'application', 'application_sha', 'candidate_artifact_id', 'candidate_artifact_digest',
  'candidate_receipt_sha256', 'candidate_archive_sha256', 'oci_archive_sha256',
  'oci_manifest_digest', 'oci_descriptor_manifest_sha256', 'local_image_id',
  'provider_task_set', 'provider_call_maximum', 'maximum_cost_microusd',
  'capability_intent_id', 'authority_reference', 'audio_fixture_sha256',
  'document_fixture_sha256', 'provider_effect_id',
]);

function validateSharedProviderIdentity(receipt, label) {
  same(receipt.application, PHYSIO_CANARY_APPLICATION, `${label} application`);
  releaseSha(receipt.application_sha, `${label} application_sha`);
  positiveInteger(receipt.candidate_artifact_id, `${label} candidate_artifact_id`);
  prefixedSha(receipt.candidate_artifact_digest, `${label} candidate_artifact_digest`);
  rawSha(receipt.candidate_receipt_sha256, `${label} candidate_receipt_sha256`);
  prefixedSha(receipt.candidate_archive_sha256, `${label} candidate_archive_sha256`);
  prefixedSha(receipt.oci_archive_sha256, `${label} oci_archive_sha256`);
  prefixedSha(receipt.oci_manifest_digest, `${label} oci_manifest_digest`);
  rawSha(receipt.oci_descriptor_manifest_sha256, `${label} oci_descriptor_manifest_sha256`);
  prefixedSha(receipt.local_image_id, `${label} local_image_id`);
  same(receipt.provider_task_set, PROVIDER_TASK_SET, `${label} provider_task_set`);
  same(receipt.provider_call_maximum, PHYSIO_CANARY_MAX_PAID_CALLS,
    `${label} provider_call_maximum`);
  if (!Number.isSafeInteger(receipt.maximum_cost_microusd) ||
      receipt.maximum_cost_microusd <= 0 || receipt.maximum_cost_microusd > 5_000_000) {
    fail(`${label} maximum_cost_microusd differs`);
  }
  if (typeof receipt.capability_intent_id !== 'string' ||
      !CAPABILITY_RE.test(receipt.capability_intent_id)) {
    fail(`${label} capability_intent_id differs`);
  }
  if (typeof receipt.authority_reference !== 'string' ||
      !AUTHORITY_RE.test(receipt.authority_reference)) {
    fail(`${label} authority_reference differs`);
  }
  same(receipt.audio_fixture_sha256, PHYSIO_CANARY_AUDIO_SHA256,
    `${label} audio_fixture_sha256`);
  const documentFixtureSha256 = sha256(buildPhysioCanaryReferralPdf());
  same(receipt.document_fixture_sha256, documentFixtureSha256,
    `${label} document_fixture_sha256`);
  prefixedSha(receipt.provider_effect_id, `${label} provider_effect_id`);
  same(receipt.provider_effect_id, derivePhysioCanaryProviderEffectId(receipt),
    `${label} derived provider_effect_id`);
}

export function validatePhysioCanaryCandidateArtifactAdmission(receipt, {
  expectedApplicationSha,
} = {}) {
  exactKeys(receipt, [
    'application_sha', 'artifacts', 'admitted_at', 'contract_version',
    'repository', 'result',
  ], 'candidate artifact admission');
  same(receipt.contract_version, PHYSIO_GITHUB_ARTIFACT_ADMISSION_CONTRACT,
    'candidate artifact admission contract');
  same(receipt.result, 'PASS', 'candidate artifact admission result');
  same(receipt.repository, REPOSITORY, 'candidate artifact admission repository');
  releaseSha(receipt.application_sha, 'candidate artifact admission application_sha');
  if (expectedApplicationSha !== undefined) {
    same(receipt.application_sha, expectedApplicationSha,
      'candidate artifact admission expected application_sha');
  }
  iso(receipt.admitted_at, 'candidate artifact admission admitted_at');
  exactKeys(receipt.artifacts, ['candidate'], 'candidate artifact admission artifacts');
  const candidate = receipt.artifacts.candidate;
  exactKeys(candidate, [
    'digest', 'expired', 'id', 'maximum_bytes', 'name', 'repository', 'size_in_bytes',
    'workflow_run_conclusion', 'workflow_run_event', 'workflow_run_head_branch',
    'workflow_run_head_sha', 'workflow_run_id', 'workflow_run_path',
  ], 'candidate artifact metadata');
  positiveInteger(candidate.id, 'candidate artifact id');
  same(candidate.name, `physio-candidate-${receipt.application_sha}`, 'candidate artifact name');
  prefixedSha(candidate.digest, 'candidate artifact digest');
  same(candidate.expired, false, 'candidate artifact expired state');
  positiveInteger(candidate.size_in_bytes, 'candidate artifact size');
  same(candidate.maximum_bytes, 1_073_741_824, 'candidate artifact maximum bytes');
  if (candidate.size_in_bytes > candidate.maximum_bytes) fail('candidate artifact exceeds size bound');
  positiveInteger(candidate.workflow_run_id, 'candidate source run id');
  same(candidate.workflow_run_head_sha, receipt.application_sha, 'candidate source run SHA');
  same(candidate.workflow_run_head_branch, 'main', 'candidate source branch');
  same(candidate.workflow_run_path, CANDIDATE_WORKFLOW, 'candidate source workflow');
  same(candidate.workflow_run_event, 'workflow_dispatch', 'candidate source event');
  same(candidate.workflow_run_conclusion, 'success', 'candidate source conclusion');
  same(candidate.repository, REPOSITORY, 'candidate artifact repository');
  return receipt;
}

export function validatePhysioCanaryProviderAdmission(receipt, {
  expectedApplicationSha,
  expectedProviderEffectId,
} = {}) {
  exactKeys(receipt, [
    ...SHARED_PROVIDER_FIELDS,
    'admitted_at', 'candidate_artifact_admission_receipt_sha256',
    'candidate_source_run_id', 'contract_version', 'result',
  ], 'provider admission');
  same(receipt.contract_version, PHYSIO_CANARY_PROVIDER_ADMISSION_CONTRACT,
    'provider admission contract');
  same(receipt.result, 'PASS', 'provider admission result');
  validateSharedProviderIdentity(receipt, 'provider admission');
  rawSha(receipt.candidate_artifact_admission_receipt_sha256,
    'provider admission candidate artifact receipt SHA');
  positiveInteger(receipt.candidate_source_run_id, 'provider admission candidate source run ID');
  iso(receipt.admitted_at, 'provider admission admitted_at');
  if (expectedApplicationSha !== undefined) {
    same(receipt.application_sha, expectedApplicationSha, 'provider admission expected application_sha');
  }
  if (expectedProviderEffectId !== undefined) {
    same(receipt.provider_effect_id, expectedProviderEffectId,
      'provider admission expected provider_effect_id');
  }
  return receipt;
}

export function validatePhysioCanaryStartedEffectReceipt(receipt, {
  expectedApplicationSha,
  expectedProviderEffectId,
} = {}) {
  exactKeys(receipt, [
    ...SHARED_PROVIDER_FIELDS,
    'candidate_admission_receipt_sha256', 'candidate_artifact_admission_receipt_sha256',
    'contract_version', 'github_run_attempt', 'github_run_id', 'result', 'started_at',
  ], 'STARTED effect');
  same(receipt.contract_version, PHYSIO_EXACT_IMAGE_CANARY_EFFECT_CONTRACT,
    'STARTED effect contract');
  same(receipt.result, 'STARTED', 'STARTED effect result');
  validateSharedProviderIdentity(receipt, 'STARTED effect');
  rawSha(receipt.candidate_admission_receipt_sha256, 'STARTED provider admission SHA');
  rawSha(receipt.candidate_artifact_admission_receipt_sha256,
    'STARTED candidate artifact admission SHA');
  positiveInteger(receipt.github_run_id, 'STARTED github_run_id');
  same(receipt.github_run_attempt, 1, 'STARTED github_run_attempt');
  iso(receipt.started_at, 'STARTED started_at');
  if (expectedApplicationSha !== undefined) {
    same(receipt.application_sha, expectedApplicationSha, 'STARTED expected application_sha');
  }
  if (expectedProviderEffectId !== undefined) {
    same(receipt.provider_effect_id, expectedProviderEffectId,
      'STARTED expected provider_effect_id');
  }
  return receipt;
}

export function validatePhysioCanaryCompletedEffectReceipt(receipt, {
  expectedApplicationSha,
  expectedProviderEffectId,
} = {}) {
  exactKeys(receipt, [
    'application', 'application_sha', 'candidate_artifact_admission_receipt_sha256',
    'candidate_artifact_execution_admission_receipt_sha256', 'canary_receipt_sha256',
    'contract_version', 'effect_reconciliation_receipt_sha256',
    'provider_call_maximum', 'provider_canary_admission_receipt_sha256',
    'provider_effect_id', 'reconciled_at', 'result', 'started_effect_receipt_sha256',
  ], 'completed-effect reconciliation');
  same(receipt.contract_version, PHYSIO_CANARY_COMPLETED_EFFECT_CONTRACT,
    'completed-effect contract');
  same(receipt.result, 'PASS', 'completed-effect result');
  same(receipt.application, PHYSIO_CANARY_APPLICATION, 'completed-effect application');
  releaseSha(receipt.application_sha, 'completed-effect application_sha');
  prefixedSha(receipt.provider_effect_id, 'completed-effect provider_effect_id');
  same(receipt.provider_call_maximum, PHYSIO_CANARY_MAX_PAID_CALLS,
    'completed-effect provider_call_maximum');
  for (const field of [
    'started_effect_receipt_sha256', 'effect_reconciliation_receipt_sha256',
    'canary_receipt_sha256', 'provider_canary_admission_receipt_sha256',
    'candidate_artifact_admission_receipt_sha256',
    'candidate_artifact_execution_admission_receipt_sha256',
  ]) rawSha(receipt[field], `completed-effect ${field}`);
  iso(receipt.reconciled_at, 'completed-effect reconciled_at');
  if (expectedApplicationSha !== undefined) {
    same(receipt.application_sha, expectedApplicationSha,
      'completed-effect expected application_sha');
  }
  if (expectedProviderEffectId !== undefined) {
    same(receipt.provider_effect_id, expectedProviderEffectId,
      'completed-effect expected provider_effect_id');
  }
  return receipt;
}

function assertSharedProviderFields(provider, started) {
  for (const field of SHARED_PROVIDER_FIELDS) {
    same(started[field], provider[field], `STARTED/provider ${field}`);
  }
}

function optionalExpectation(value, expected, label) {
  if (expected !== undefined) same(value, expected, label);
}

export function validatePhysioExactImageCanarySuccessPacket(packetDirectory, {
  expectedApplicationSha,
  expectedImmutableImage,
  expectedCandidateArchiveSha256,
  expectedCanaryReceiptSha256,
  expectedProviderEffectId,
  expectedCandidateArtifactId,
  expectedCandidateArtifactDigest,
  expectedCandidateReceiptSha256,
  expectedCapabilityIntentId,
  expectedAuthorityReference,
  expectedCapabilityBindingSha256,
  maximumCostMicrousd,
} = {}, {
  validateCanaryReceipt,
  validateEffectReceipt,
} = {}) {
  if (typeof validateCanaryReceipt !== 'function' ||
      typeof validateEffectReceipt !== 'function') {
    fail('receipt validators are unavailable');
  }
  const packet = readSuccessPacket(packetDirectory);
  const candidate = packet.json['candidate-artifact-admission.json'];
  const executionCandidate = packet.json['candidate-artifact-execution-admission.json'];
  const provider = packet.json['provider-canary-admission.json'];
  const started = packet.json['provider-canary-started-effect.json'];
  const canary = packet.json['physio-exact-image-canary.json'];
  const effect = packet.json['canary-effect-reconciliation.json'];
  const completed = packet.json['canary-completed-effect-reconciliation.json'];

  validatePhysioCanaryCandidateArtifactAdmission(candidate, { expectedApplicationSha });
  validatePhysioCanaryCandidateArtifactAdmission(executionCandidate, { expectedApplicationSha });
  validatePhysioCanaryProviderAdmission(provider, {
    expectedApplicationSha,
    expectedProviderEffectId,
  });
  validatePhysioCanaryStartedEffectReceipt(started, {
    expectedApplicationSha,
    expectedProviderEffectId,
  });
  validateCanaryReceipt(canary, {
    expectedApplicationSha,
    expectedImmutableImage,
    expectedCandidateArchiveSha256,
    maximumCostMicrousd,
  });
  validateEffectReceipt(effect, {
    expectedApplicationSha,
    expectedProviderEffectId,
    expectedStartedEffectReceiptSha256: sha256(packet.bytes.get(
      'provider-canary-started-effect.json',
    )),
    expectedImmutableImage,
    expectedCandidateArchiveSha256,
    maximumCostMicrousd,
  });
  if (effect.result !== 'COMPLETED') fail('provider effect is not COMPLETED');
  validatePhysioCanaryCompletedEffectReceipt(completed, {
    expectedApplicationSha,
    expectedProviderEffectId,
  });

  if (!packet.bytes.get('candidate-artifact-admission.json').equals(
    packet.bytes.get('candidate-artifact-execution-admission.json'),
  )) fail('candidate original/execution admission bytes differ');

  const hashes = Object.fromEntries(PACKET_DATA_FILES.map((name) => [
    name,
    sha256(packet.bytes.get(name)),
  ]));
  const hashJoins = {
    started_effect_receipt_sha256: 'provider-canary-started-effect.json',
    effect_reconciliation_receipt_sha256: 'canary-effect-reconciliation.json',
    canary_receipt_sha256: 'physio-exact-image-canary.json',
    provider_canary_admission_receipt_sha256: 'provider-canary-admission.json',
    candidate_artifact_admission_receipt_sha256: 'candidate-artifact-admission.json',
    candidate_artifact_execution_admission_receipt_sha256:
      'candidate-artifact-execution-admission.json',
  };
  for (const [field, filename] of Object.entries(hashJoins)) {
    same(completed[field], hashes[filename], `completed-effect ${field} join`);
  }
  same(provider.candidate_artifact_admission_receipt_sha256,
    hashes['candidate-artifact-admission.json'], 'provider/candidate admission hash join');
  same(started.candidate_artifact_admission_receipt_sha256,
    hashes['candidate-artifact-admission.json'], 'STARTED/candidate admission hash join');
  same(started.candidate_admission_receipt_sha256,
    hashes['provider-canary-admission.json'], 'STARTED/provider admission hash join');
  same(effect.started_effect_receipt_sha256,
    hashes['provider-canary-started-effect.json'], 'effect/STARTED hash join');

  assertSharedProviderFields(provider, started);
  const artifact = candidate.artifacts.candidate;
  same(provider.application_sha, candidate.application_sha, 'provider/candidate application SHA');
  same(provider.candidate_artifact_id, artifact.id, 'provider/candidate artifact ID');
  same(provider.candidate_artifact_digest, artifact.digest, 'provider/candidate artifact digest');
  same(provider.candidate_source_run_id, artifact.workflow_run_id,
    'provider/candidate source run ID');
  same(effect.application, provider.application, 'effect/provider application');
  same(effect.application_sha, provider.application_sha, 'effect/provider application SHA');
  same(effect.provider_effect_id, provider.provider_effect_id, 'effect/provider effect ID');
  same(effect.local_image_id, provider.local_image_id, 'effect/provider image ID');
  same(effect.candidate_archive_sha256, provider.candidate_archive_sha256,
    'effect/provider candidate archive');
  same(effect.provider_call_maximum, provider.provider_call_maximum,
    'effect/provider call maximum');
  same(effect.maximum_cost_microusd, provider.maximum_cost_microusd,
    'effect/provider cost ceiling');
  same(canary.application, provider.application, 'canary/provider application');
  same(canary.application_sha, provider.application_sha, 'canary/provider application SHA');
  same(canary.immutable_image, provider.local_image_id, 'canary/provider image ID');
  same(canary.candidate_archive_sha256, provider.candidate_archive_sha256,
    'canary/provider candidate archive');
  same(canary.bounded_paid_calls.maximum, provider.provider_call_maximum,
    'canary/provider call maximum');
  same(canary.bounded_paid_calls.succeeded, PHYSIO_CANARY_MAX_PAID_CALLS,
    'canary paid-call completion');
  same(canary.cost_ceiling_microusd, provider.maximum_cost_microusd,
    'canary/provider cost ceiling');
  same(canary.actual_cost_microusd, effect.partial_provider_usage.actual_cost_microusd,
    'canary/effect actual provider cost');
  const finalCanaryCalls = canaryProviderCalls(canary);
  same(finalCanaryCalls.length, PHYSIO_CANARY_MAX_PAID_CALLS,
    'canary provider-call cardinality');
  for (const [index, expectedCall] of finalCanaryCalls.entries()) {
    const terminalCall = effect.partial_provider_calls[index];
    for (const field of [
      'call_ordinal', 'provider_task', 'provider_request_id_sha256',
      'usage_receipt_sha256', 'actual_cost_microusd',
    ]) {
      same(terminalCall[field], expectedCall[field],
        `canary/effect provider call ${index + 1} ${field}`);
    }
  }
  same(completed.application_sha, provider.application_sha, 'completed/provider application SHA');
  same(completed.provider_effect_id, provider.provider_effect_id,
    'completed/provider effect ID');
  same(completed.provider_call_maximum, provider.provider_call_maximum,
    'completed/provider call maximum');

  optionalExpectation(provider.application_sha, expectedApplicationSha, 'expected application SHA');
  optionalExpectation(provider.local_image_id, expectedImmutableImage, 'expected immutable image');
  optionalExpectation(provider.candidate_archive_sha256, expectedCandidateArchiveSha256,
    'expected candidate archive');
  optionalExpectation(provider.provider_effect_id, expectedProviderEffectId,
    'expected provider effect ID');
  optionalExpectation(provider.candidate_artifact_id, expectedCandidateArtifactId,
    'expected candidate artifact ID');
  optionalExpectation(provider.candidate_artifact_digest, expectedCandidateArtifactDigest,
    'expected candidate artifact digest');
  optionalExpectation(provider.candidate_receipt_sha256, expectedCandidateReceiptSha256,
    'expected candidate receipt SHA');
  optionalExpectation(provider.capability_intent_id, expectedCapabilityIntentId,
    'expected capability intent ID');
  optionalExpectation(provider.authority_reference, expectedAuthorityReference,
    'expected authority reference');
  if (expectedCapabilityBindingSha256 !== undefined) {
    rawSha(expectedCapabilityBindingSha256, 'expected capability binding SHA');
    same(derivePhysioCanaryCapabilityBindingSha256(provider),
      expectedCapabilityBindingSha256, 'expected capability binding SHA');
  }
  optionalExpectation(hashes['physio-exact-image-canary.json'], expectedCanaryReceiptSha256,
    'expected canary receipt SHA');

  return {
    contractVersion: PHYSIO_CANARY_SUCCESS_PACKET_CONTRACT,
    result: 'PASS',
    packetPath: packet.resolved,
    applicationSha: provider.application_sha,
    immutableImage: provider.local_image_id,
    candidateArchiveSha256: provider.candidate_archive_sha256,
    providerEffectId: provider.provider_effect_id,
    candidateArtifactId: provider.candidate_artifact_id,
    candidateArtifactDigest: provider.candidate_artifact_digest,
    capabilityBindingSha256: derivePhysioCanaryCapabilityBindingSha256(provider),
    canaryReceiptSha256: hashes['physio-exact-image-canary.json'],
    effectReceiptSha256: hashes['canary-effect-reconciliation.json'],
    startedEffectReceiptSha256: hashes['provider-canary-started-effect.json'],
    completedEffectReceiptSha256: hashes['canary-completed-effect-reconciliation.json'],
    hashes,
    receipts: {
      candidateArtifactAdmission: candidate,
      providerAdmission: provider,
      startedEffect: started,
      canary,
      effect,
      completedEffect: completed,
    },
  };
}

function parseArguments(argv) {
  const args = [...argv];
  if (args.shift() !== 'validate') fail('usage: validate --packet <directory>');
  const allowed = new Set([
    '--packet', '--application-sha', '--immutable-image', '--candidate-archive-sha256',
    '--canary-receipt-sha256', '--provider-effect-id', '--maximum-cost-microusd',
    '--candidate-artifact-id',
    '--candidate-artifact-digest', '--candidate-receipt-sha256',
    '--capability-intent-id', '--authority-reference', '--capability-binding-sha256',
  ]);
  const values = new Map();
  while (args.length > 0) {
    const name = args.shift();
    const value = args.shift();
    if (!allowed.has(name) || values.has(name) || value === undefined || value.startsWith('--')) {
      fail('CLI arguments are missing, duplicated or unknown');
    }
    values.set(name, value);
  }
  if (!values.has('--packet')) fail('--packet is required');
  return values;
}

function cliOptions(values) {
  const maximum = values.get('--maximum-cost-microusd');
  const artifactId = values.get('--candidate-artifact-id');
  if (maximum !== undefined && (!/^[1-9][0-9]*$/.test(maximum) || Number(maximum) > 5_000_000)) {
    fail('--maximum-cost-microusd differs');
  }
  if (artifactId !== undefined && !/^[1-9][0-9]*$/.test(artifactId)) {
    fail('--candidate-artifact-id differs');
  }
  return {
    expectedApplicationSha: values.get('--application-sha'),
    expectedImmutableImage: values.get('--immutable-image'),
    expectedCandidateArchiveSha256: values.get('--candidate-archive-sha256'),
    expectedCanaryReceiptSha256: values.get('--canary-receipt-sha256'),
    expectedProviderEffectId: values.get('--provider-effect-id'),
    maximumCostMicrousd: maximum === undefined ? undefined : Number(maximum),
    expectedCandidateArtifactId: artifactId === undefined ? undefined : Number(artifactId),
    expectedCandidateArtifactDigest: values.get('--candidate-artifact-digest'),
    expectedCandidateReceiptSha256: values.get('--candidate-receipt-sha256'),
    expectedCapabilityIntentId: values.get('--capability-intent-id'),
    expectedAuthorityReference: values.get('--authority-reference'),
    expectedCapabilityBindingSha256: values.get('--capability-binding-sha256'),
  };
}

function isMainModule() {
  return Boolean(process.argv[1]) &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const run = async () => {
  try {
    const values = parseArguments(process.argv.slice(2));
    const { readAndValidatePhysioExactImageCanarySuccessPacket } = await import(
      './physio-exact-image-canary-contract.mjs'
    );
    const result = readAndValidatePhysioExactImageCanarySuccessPacket(
      values.get('--packet'),
      cliOptions(values),
    );
    process.stdout.write(`${JSON.stringify({
      contract_version: result.contractVersion,
      result: result.result,
      application_sha: result.applicationSha,
      immutable_image: result.immutableImage,
      candidate_archive_sha256: result.candidateArchiveSha256,
      provider_effect_id: result.providerEffectId,
      capability_binding_sha256: result.capabilityBindingSha256,
      canary_receipt_sha256: result.canaryReceiptSha256,
      effect_receipt_sha256: result.effectReceiptSha256,
      started_effect_receipt_sha256: result.startedEffectReceiptSha256,
      completed_effect_receipt_sha256: result.completedEffectReceiptSha256,
    })}\n`);
  } catch (error) {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  }
  };
  await run();
}
