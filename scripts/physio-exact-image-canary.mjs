// Physio immutable-image real-provider canary producer.
//
// `produce-local` creates one disposable local Docker container from the
// sealed candidate image, with no published service, mount, custom DNS or
// Docker volume; runs `run-inside`; destroys the captured container; proves
// the Docker volume inventory is unchanged; validates the content-free
// receipt; and writes exactly physio-exact-image-canary.json. This is the only
// production CLI producer and intentionally runs before any Fly app exists.
//
// `run-inside` starts actual loopback-only productionBootstrap -> server/index
// process sequences from the candidate image and exercises the ordinary
// authenticated HTTP routes. One server uses the inherited real provider
// credential. The second bootstraps with that real credential, then replaces
// only the server credential with an explicit invalid value for loud non-2xx
// fault proof. Both stores are temporary and are removed before the command
// returns. No prompt,
// provider output, transcript, document text, credential, raw provider request
// identifier or synthetic person identifier is emitted in the artifact.

import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hashPassword } from '../server/auth.mjs';
import { PHYSIO_AI_TASKS, validatePhysioTaskOutput } from '../server/physioAiTasks.mjs';
import {
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
} from '../server/uploadRegistry.mjs';
import {
  REFERRAL_EXTRACTION_SCHEMA,
  REFERRAL_EXTRACTION_SCHEMA_SHA256,
} from '../src/lib/referralExtractionSchema.js';
import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
} from '../src/lib/referralWorkflow.js';
import {
  PHYSIO_CANARY_APP_ID,
  PHYSIO_CANARY_APPLICATION,
  PHYSIO_CANARY_CONTAINER_PREFIX,
  PHYSIO_CANARY_MAX_PAID_CALLS,
  PHYSIO_CANARY_PROFESSION_ID,
  PHYSIO_CANARY_PROVIDER_TASK_MAP,
  PHYSIO_CANARY_PROVIDER_TASK_SET,
  PHYSIO_CANARY_TASK_IDS,
  PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS,
  PHYSIO_CANARY_TTL_SECONDS,
  PHYSIO_CANARY_TRANSCRIPTION_MODEL,
  PHYSIO_EXACT_IMAGE_CANARY_CONTRACT,
  PHYSIO_EXACT_IMAGE_CANARY_EFFECT_CONTRACT,
  readAndValidatePhysioCanaryEffectReceipt,
  validatePhysioCanaryEffectReceipt,
  validatePhysioExactImageCanaryReceipt,
} from './physio-exact-image-canary-contract.mjs';
import {
  PHYSIO_CANARY_AUDIO_BYTES,
  PHYSIO_CANARY_AUDIO_EXPECTED_MARKER,
  PHYSIO_CANARY_AUDIO_RELATIVE_PATH,
  PHYSIO_CANARY_AUDIO_SHA256,
  readAndValidatePhysioCanaryAudioFixture,
} from './physio-exact-image-canary-fixture.mjs';
import { buildPhysioCanaryReferralPdf } from './physio-exact-image-canary-document-fixture.mjs';

export const PHYSIO_EXACT_IMAGE_CANARY_ACK =
  'I_ACKNOWLEDGE_THIS_USES_ONLY_SYNTHETIC_FIXTURES_IN_A_DISPOSABLE_NO_SERVICE_NO_VOLUME_NO_DNS_CONTAINER';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FINAL_FILENAME = 'physio-exact-image-canary.json';
const EFFECT_LEDGER_FILENAME = 'canary-effect-reconciliation.json';
const RELEASE_SHA_RE = /^[0-9a-f]{40}$/;
const LOCAL_IMAGE_RE = /^sha256:[0-9a-f]{64}$/;
const CARRIER_ID_RE = /^[0-9a-f]{12,64}$/i;
const MAX_AUDIO_BYTES = 256 * 1024;
const AUDIO_TYPES = Object.freeze({
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
});
const INVALID_PROVIDER_CREDENTIAL = 'physio-exact-image-canary-invalid-provider-credential';
const EDIT_MARKER = 'Synthetic clinician edit confirmed.';
const PHYSIO_PUBLIC_APP_URL = 'https://physio.app.assesssuite.com';
const PHYSIO_CANARY_DATABASE_PATH = '/app/server/data/physio.db';
const PHYSIO_CANARY_UPLOADS_DIR = '/app/server/data/physio-uploads';
const PHYSIO_CANARY_BOOTSTRAP_RECEIPT_PREFIX = '/tmp/physio-exact-image-canary-bootstrap-';
const PHYSIO_CANARY_BOOTSTRAP_CONTRACT =
  'assesssuite-physio-exact-image-canary-bootstrap/1.0.0';
const PHYSIO_CANARY_PRODUCTION_POSTURE_CONTRACT =
  'assesssuite-physio-production-posture/1.0.0';
const PHYSIO_RUNTIME_TREE_CONTRACT = 'assesssuite-physio-runtime-tree/1.0.0';
const INNER_EXEC_TIMEOUT_SECONDS = 1_500;
const INNER_RECEIPT_BEGIN = 'PHYSIO_EXACT_IMAGE_CANARY_RECEIPT_BEGIN';
const INNER_RECEIPT_END = 'PHYSIO_EXACT_IMAGE_CANARY_RECEIPT_END';
const INNER_PROVIDER_PROGRESS_PREFIX = 'PHYSIO_EXACT_IMAGE_CANARY_PROVIDER_CALL ';
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const RAW_SHA256_RE = /^[0-9a-f]{64}$/;
const PRODUCTION_MOCK_OUTPUT_MARKER =
  /SYNTHETIC_CHAT_PROVIDER_RESPONSE|local InvokeLLM mock|\[Fallback transcript|Simulated SOAP note[^\n]{0,80}placeholder|simulation response/i;
const PHYSIO_FORBIDDEN_RUNTIME_MARKER =
  /media\.base44\.com|Superagent One|superagent-one@|Testing bypass\s*[—-]\s*demo only|admin@local\.test|clinician@org-alpha\.seed\.test|owner@org-alpha\.seed\.test|change-me-local|SeedDemo!2026/i;

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return createHash('sha256').update(bytes).digest('hex');
}

function shaReceipt(value) {
  return `sha256:${sha256(value)}`;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function requireTrue(condition, code) {
  if (!condition) throw new Error(`physio_canary_${code}`);
}

function normalizedMarker(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function assertPhysioCanaryProviderTaskMapping(
  providerTaskSet = PHYSIO_CANARY_PROVIDER_TASK_SET,
) {
  requireTrue(Array.isArray(providerTaskSet) &&
    arraysEqual(providerTaskSet, PHYSIO_CANARY_PROVIDER_TASK_SET),
  'provider_task_set_differs');
  requireTrue(arraysEqual(
    providerTaskSet.map((name) => PHYSIO_CANARY_PROVIDER_TASK_MAP[name]),
    [...PHYSIO_CANARY_TASK_IDS, 'transcription', 'extraction'],
  ), 'provider_task_mapping_differs');
  return true;
}

function fixtureMetadata(file, marker, { requireFrozenFixture = false } = {}) {
  const resolved = path.resolve(file || '');
  const extension = path.extname(resolved).toLowerCase();
  const normalized = normalizedMarker(marker);
  requireTrue(path.isAbsolute(resolved), 'audio_path_not_absolute');
  requireTrue(/(?:synthetic|canary)/i.test(path.basename(resolved)), 'audio_name_not_synthetic');
  requireTrue(AUDIO_TYPES[extension], 'audio_type_unsupported');
  requireTrue(normalized.length >= 8 && normalized.length <= 160 && /(?:synthetic|canary)/.test(normalized),
    'audio_marker_not_synthetic');
  const stat = fs.lstatSync(resolved);
  requireTrue(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= MAX_AUDIO_BYTES,
    'audio_file_invalid');
  const bytes = fs.readFileSync(resolved);
  if (requireFrozenFixture) {
    requireTrue(stat.size === PHYSIO_CANARY_AUDIO_BYTES &&
      sha256(bytes) === PHYSIO_CANARY_AUDIO_SHA256 &&
      normalized === PHYSIO_CANARY_AUDIO_EXPECTED_MARKER,
    'audio_fixture_contract_differs');
  }
  return {
    path: resolved,
    extension,
    mime: AUDIO_TYPES[extension],
    marker: normalized,
    bytes,
  };
}

export function physioCanaryContainerName(applicationSha) {
  requireTrue(RELEASE_SHA_RE.test(applicationSha || ''), 'container_name_release_sha_invalid');
  return `${PHYSIO_CANARY_CONTAINER_PREFIX}${applicationSha.slice(0, 12)}`;
}

function activeEnvironmentValue(value) {
  return value !== undefined && value !== null &&
    !['', '0', 'false', 'off', 'disabled'].includes(String(value).trim().toLowerCase());
}

function readRequiredSource(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  requireTrue(relative && !relative.startsWith('..') && !path.isAbsolute(relative),
    'artifact_scan_path_escape');
  const stat = fs.lstatSync(resolved);
  requireTrue(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 2 * 1024 * 1024,
    `artifact_scan_file_invalid_${relativePath.replace(/[^a-z0-9]+/gi, '_')}`);
  return fs.readFileSync(resolved, 'utf8');
}

function productionBundleFiles(root) {
  const pending = [path.resolve(root)];
  const files = [];
  let totalBytes = 0;
  while (pending.length) {
    const directory = pending.pop();
    const stat = fs.lstatSync(directory);
    requireTrue(stat.isDirectory() && !stat.isSymbolicLink(), 'artifact_scan_dist_directory_invalid');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) requireTrue(false, 'artifact_scan_dist_symlink');
      if (entry.isDirectory()) {
        pending.push(child);
        continue;
      }
      if (!entry.isFile() || !/\.(?:js|mjs|cjs|html)$/i.test(entry.name)) continue;
      const childStat = fs.lstatSync(child);
      totalBytes += childStat.size;
      requireTrue(totalBytes <= 25 * 1024 * 1024, 'artifact_scan_dist_too_large');
      files.push(child);
    }
  }
  requireTrue(files.length > 0, 'artifact_scan_dist_empty');
  return files;
}

function regularApplicationFiles(root) {
  const resolvedRoot = path.resolve(root);
  const pending = [resolvedRoot];
  const files = [];
  while (pending.length) {
    const directory = pending.pop();
    const relativeDirectory = path.relative(resolvedRoot, directory).replaceAll('\\', '/');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      const relative = path.relative(resolvedRoot, child).replaceAll('\\', '/');
      requireTrue(relative && !relative.startsWith('../') && !path.isAbsolute(relative),
        'artifact_scan_runtime_tree_path_escape');
      requireTrue(!entry.isSymbolicLink(), 'artifact_scan_runtime_tree_symlink');
      if (entry.isDirectory()) {
        // Production dependencies and the canary's ephemeral DB/upload root
        // are separately bounded. The manifest is the exact app-owned source
        // and browser-build closure, not a package-manager or mutable-data
        // inventory.
        if (relative === 'node_modules' || relative === 'server/data') continue;
        pending.push(child);
      } else {
        requireTrue(entry.isFile(), 'artifact_scan_runtime_tree_non_regular');
        if (relative !== 'physio-runtime-manifest.json') files.push(relative);
      }
    }
    requireTrue(relativeDirectory !== 'node_modules' && relativeDirectory !== 'server/data',
      'artifact_scan_runtime_tree_excluded_directory_traversed');
  }
  return files.sort();
}

export function verifyPhysioRuntimeTree(root = REPO_ROOT) {
  const resolvedRoot = path.resolve(root);
  const topLevel = fs.readdirSync(resolvedRoot, { withFileTypes: true });
  const allowedTopLevel = new Set([
    'dist', 'docs', 'node_modules', 'package-lock.json', 'package.json',
    'packages', 'physio-runtime-manifest.json', 'scripts', 'server', 'src',
  ]);
  requireTrue(topLevel.every((entry) => allowedTopLevel.has(entry.name)),
    'artifact_scan_runtime_tree_top_level_differs');
  const manifestPath = path.join(resolvedRoot, 'physio-runtime-manifest.json');
  const manifestStat = fs.lstatSync(manifestPath);
  requireTrue(manifestStat.isFile() && !manifestStat.isSymbolicLink() &&
    manifestStat.size > 0 && manifestStat.size <= 256 * 1024,
  'artifact_scan_runtime_manifest_file_invalid');
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  exactObjectKeys(manifest, [
    'contract_version', 'profession_id', 'app_id', 'file_count', 'files', 'manifest_sha256',
  ], 'artifact_scan_runtime_manifest');
  requireTrue(manifest.contract_version === PHYSIO_RUNTIME_TREE_CONTRACT &&
    manifest.profession_id === PHYSIO_CANARY_PROFESSION_ID &&
    manifest.app_id === PHYSIO_CANARY_APP_ID &&
    Number.isSafeInteger(manifest.file_count) && manifest.file_count > 0 &&
    Array.isArray(manifest.files) && manifest.files.length === manifest.file_count &&
    /^[0-9a-f]{64}$/.test(manifest.manifest_sha256 || ''),
  'artifact_scan_runtime_manifest_identity_differs');
  const expectedPaths = [];
  let priorPath = '';
  for (const row of manifest.files) {
    exactObjectKeys(row, ['path', 'bytes', 'sha256'], 'artifact_scan_runtime_manifest_file');
    requireTrue(typeof row.path === 'string' && row.path.length > 0 &&
      !row.path.startsWith('/') && !row.path.includes('\\') &&
      !row.path.split('/').includes('..') && row.path > priorPath,
    'artifact_scan_runtime_manifest_path_differs');
    requireTrue(Number.isSafeInteger(row.bytes) && row.bytes > 0 &&
      /^[0-9a-f]{64}$/.test(row.sha256 || ''),
    'artifact_scan_runtime_manifest_file_identity_differs');
    const absolute = path.resolve(resolvedRoot, row.path);
    const relative = path.relative(resolvedRoot, absolute);
    requireTrue(relative === row.path.replaceAll('/', path.sep) &&
      !relative.startsWith('..') && !path.isAbsolute(relative),
    'artifact_scan_runtime_manifest_path_escape');
    const stat = fs.lstatSync(absolute);
    requireTrue(stat.isFile() && !stat.isSymbolicLink() && stat.size === row.bytes &&
      sha256(fs.readFileSync(absolute)) === row.sha256,
    'artifact_scan_runtime_manifest_file_differs');
    expectedPaths.push(row.path);
    priorPath = row.path;
  }
  const core = {
    contract_version: manifest.contract_version,
    profession_id: manifest.profession_id,
    app_id: manifest.app_id,
    file_count: manifest.file_count,
    files: manifest.files,
  };
  requireTrue(sha256(canonicalJson(core)) === manifest.manifest_sha256,
    'artifact_scan_runtime_manifest_digest_differs');
  requireTrue(arraysEqual(regularApplicationFiles(resolvedRoot), expectedPaths),
    'artifact_scan_runtime_tree_file_set_differs');
  for (const forbidden of [
    /^server\/mocks(?:\/|$)/,
    /^server\/selftest\.mjs$/,
    /^server\/tests\/(?!fixtures\/physio-exact-image-canary\/synthetic-physio-canary\.wav$)/,
    /^server\/functions\/epMaintenanceRegistry\.mjs$/,
    /^src\/(?:pages|components)(?:\/|$)/,
    /^packages\/profession-config\/professions\/exercise-physiology\.mjs$/,
    /^(?:e2e|\.github)(?:\/|$)/,
    /\.map$/,
  ]) requireTrue(!expectedPaths.some((entry) => forbidden.test(entry)),
  'artifact_scan_runtime_tree_forbidden_path');
  return Object.freeze({
    manifest_sha256: `sha256:${manifest.manifest_sha256}`,
    manifest_receipt_sha256: shaReceipt(manifestBytes),
    file_count: manifest.file_count,
  });
}

function matchingParenthesisIndex(source, openingIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')') {
      depth -= 1;
      if (depth === 0) return index;
      requireTrue(depth >= 0, 'artifact_scan_soap_legacy_ai_guard_unbalanced');
    }
  }
  requireTrue(false, 'artifact_scan_soap_legacy_ai_guard_unbalanced');
}

/**
 * The shared SOAP editor retains two legacy InvokeLLM helpers for EP. Physio
 * must never render either helper: its only text-AI surface is the versioned
 * physio.soap_note.v1 workspace included in the exact canary task set.
 */
export function verifyLegacySoapAiIsolation(source) {
  requireTrue(
    /const\s+legacySectionAiAllowed\s*=\s*activeProfession\.id\s*===\s*['"]exercise-physiology['"]\s*;/.test(source),
    'artifact_scan_soap_legacy_ai_profession_gate_missing',
  );

  const invokePositions = [];
  const invokePattern = /\bbase44\.integrations\.Core\.InvokeLLM\s*\(/g;
  for (const match of source.matchAll(invokePattern)) invokePositions.push(match.index);
  requireTrue(invokePositions.length === 2, 'artifact_scan_soap_legacy_ai_call_count_differs');

  const guardedRanges = [];
  const guardPattern = /\{[^\r\n{}]*\blegacySectionAiAllowed\b[^\r\n{}]*&&\s*\(/g;
  for (const match of source.matchAll(guardPattern)) {
    const openingIndex = match.index + match[0].lastIndexOf('(');
    guardedRanges.push([openingIndex, matchingParenthesisIndex(source, openingIndex)]);
  }
  const containingRanges = new Set();
  for (const invokePosition of invokePositions) {
    const rangeIndex = guardedRanges.findIndex(([start, end]) =>
      invokePosition > start && invokePosition < end);
    requireTrue(rangeIndex >= 0, 'artifact_scan_soap_legacy_ai_reachable_in_physio');
    containingRanges.add(rangeIndex);
  }
  requireTrue(containingRanges.size === 2, 'artifact_scan_soap_legacy_ai_guards_not_independent');
  return true;
}

/**
 * Physio deliberately exposes neither the unused placeholder image generator
 * nor SMS. The profession manifest is the source of truth and the server must
 * apply that list before parsing an integration request body. EP keeps the
 * shared handlers, so this is an exact profession-bound reachability proof.
 */
export function verifyPhysioDisabledCoreIntegrations({
  professionSource,
  serverIndexSource,
  integrationsSource,
}) {
  requireTrue(
    /disabledCoreIntegrationIds\s*:\s*\[\s*['"]SendSMS['"]\s*,\s*['"]GenerateImage['"]\s*\]/.test(professionSource),
    'artifact_scan_physio_disabled_integrations_manifest_differs',
  );
  requireTrue(
    /disabledCoreIntegrationIds\s*:\s*[\r\n\s]*CLINICAL_RELEASE_POLICY\.publicProfession\.features\.disabledCoreIntegrationIds/.test(serverIndexSource),
    'artifact_scan_physio_disabled_integrations_bridge_missing',
  );
  const disabledGate = integrationsSource.indexOf('context.disabledCoreIntegrationIds?.includes(endpointName)');
  const bodyParser = integrationsSource.indexOf('await parseIntegrationBody(req, endpointName)', disabledGate);
  requireTrue(disabledGate >= 0, 'artifact_scan_disabled_integration_gate_missing');
  requireTrue(bodyParser > disabledGate, 'artifact_scan_disabled_integration_gate_after_body_parse');
  return true;
}

/**
 * Executed inside the exact image before paid calls. This is deliberately a
 * semantic posture check over the shipped production entry points, not a
 * blanket word grep: labelled deterministic fixtures remain in server source
 * for tests, but their activation must be gated behind SELFTEST and production
 * must fail closed before reaching them.
 */
export function verifyProductionArtifactPosture({
  environment = process.env,
  root = REPO_ROOT,
  distRoot = path.join(root, 'dist'),
  sealedRuntime = true,
} = {}) {
  const requiredEnvironment = {
    NODE_ENV: 'production',
    PROFESSION: PHYSIO_CANARY_PROFESSION_ID,
    DEFAULT_APP_ID: PHYSIO_CANARY_APP_ID,
    LLM_REQUIRED: '1',
    GENERAL_CLINICAL_LLM_ENABLED: '0',
    TRANSCRIPTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_ENABLED: '1',
    OPENAI_HEALTH_DATA_TERMS_CONFIRMED: '1',
  };
  for (const [name, expected] of Object.entries(requiredEnvironment)) {
    requireTrue(environment[name] === expected, `production_posture_${name.toLowerCase()}_differs`);
  }
  requireTrue(!activeEnvironmentValue(environment.SELFTEST), 'production_posture_selftest_active');
  requireTrue(!activeEnvironmentValue(environment.PARITY_ASSURANCE_MODE),
    'production_posture_parity_active');
  const strictCanaryEnvironment = {
    PHYSIO_EXACT_IMAGE_CANARY_MODE: '1',
    RUN_PHYSIO_EXACT_IMAGE_CANARY: PHYSIO_EXACT_IMAGE_CANARY_ACK,
    ALLOW_PAID_PROVIDER_PROBE: '1',
    OUTBOUND_EMAIL_ENABLED: '0',
    OUTBOUND_SMS_ENABLED: '0',
    PAYMENTS_ENABLED: '0',
    ALLOW_OPEN_REGISTRATION: '1',
    APP_URL: PHYSIO_PUBLIC_APP_URL,
    EXPECTED_APP_URL: PHYSIO_PUBLIC_APP_URL,
    UPLOADS_DIR: PHYSIO_CANARY_UPLOADS_DIR,
    ASSESSSUITE_BIND_HOST: '127.0.0.1',
    OPENAI_MODEL_FAST: PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS[0],
    OPENAI_MODEL_QUALITY: PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS[1],
    OPENAI_TRANSCRIBE_MODEL: PHYSIO_CANARY_TRANSCRIPTION_MODEL,
  };
  for (const [name, expected] of Object.entries(strictCanaryEnvironment)) {
    requireTrue(environment[name] === expected,
      `production_posture_${name.toLowerCase()}_differs`);
  }
  requireTrue(!environment.ASSESSSUITE_DB_PATH && !environment.ASSESSSUITE_DB_PATH_ACK,
    'production_posture_database_override_active');
  requireTrue(new RegExp(
    `^${PHYSIO_CANARY_BOOTSTRAP_RECEIPT_PREFIX}(?:success|fault)\\.json$`,
  ).test(environment.PHYSIO_EXACT_IMAGE_CANARY_BOOTSTRAP_RECEIPT || ''),
  'production_posture_bootstrap_receipt_path_differs');
  requireTrue(RELEASE_SHA_RE.test(environment.RELEASE_SHA || '') &&
    Number.isFinite(Date.parse(environment.BUILD_TIMESTAMP || '')) &&
    LOCAL_IMAGE_RE.test(environment.PHYSIO_CANARY_IMMUTABLE_IMAGE || '') &&
    /^sha256:[0-9a-f]{64}$/.test(environment.PHYSIO_CANARY_CANDIDATE_ARCHIVE_SHA256 || ''),
  'production_posture_release_identity_differs');
  for (const name of [
    'OPENAI_CHAT_TEST_BASE_URL',
    'DOCUMENT_EXTRACTION_TEST_BASE_URL',
    'DOCUMENT_EXTRACTION_PROVIDER_PROBE',
    'DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK',
    'RUN_DOCUMENT_EXTRACTION_PROVIDER_PROBE',
    'OPENAI_DOCUMENT_EXTRACTION_MODEL',
  ]) {
    requireTrue(!activeEnvironmentValue(environment[name]),
      `production_posture_${name.toLowerCase()}_active`);
  }
  for (const [name, value] of Object.entries(environment)) {
    if (!/(?:MOCK|PLACEHOLDER|FAKE|SIMULAT)/i.test(name)) continue;
    requireTrue(!activeEnvironmentValue(value),
      `production_posture_forbidden_activation_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`);
  }
  const providerKey = String(environment.OPENAI_API_KEY || '');
  requireTrue(providerKey.length >= 20 &&
    !/(?:synthetic|test|mock|placeholder|fake|canary-invalid)/i.test(providerKey),
  'production_posture_provider_credential_not_real');

  if (sealedRuntime) verifyPhysioRuntimeTree(root);

  const entryHtml = readRequiredSource(distRoot, 'index.html');
  requireTrue(/<title>AssessSuite Physio<\/title>/.test(entryHtml) &&
    /<meta\s+name="description"\s+content="AssessSuite Physio\b/.test(entryHtml),
  'artifact_scan_physio_entry_identity_differs');

  const ai = readRequiredSource(root, 'server/physioAiTasks.mjs');
  for (const marker of [
    'invokeLLMWithUsage',
    'throw providerFailure(error)',
    "status: 'succeeded'",
    'provider_request_id_hash:',
    "output_state: 'ai_draft_unreviewed'",
  ]) requireTrue(ai.includes(marker), 'artifact_scan_ai_fail_closed_contract_missing');
  requireTrue(!/return\s+(?:mock|placeholder|fallback)[A-Za-z0-9_]*\s*\(/i.test(ai),
    'artifact_scan_ai_reachable_fallback');

  verifyPhysioDisabledCoreIntegrations({
    professionSource: readRequiredSource(root, 'packages/profession-config/professions/physiotherapy.mjs'),
    serverIndexSource: readRequiredSource(root, 'server/index.mjs'),
    integrationsSource: readRequiredSource(root, 'server/integrations.mjs'),
  });

  const transcription = readRequiredSource(root, 'server/functions/transcribeSession.mjs');
  const realGate = transcription.indexOf('if (realPathEnabled())');
  const injectedGate = transcription.indexOf('if (testFallback)', realGate);
  const unconfigured = transcription.indexOf('return respond(503, {', injectedGate);
  requireTrue(
    transcription.includes("Boolean(process.env.OPENAI_API_KEY) && process.env.SELFTEST !== '1'") &&
    transcription.includes("environment.NODE_ENV !== 'test' || environment.SELFTEST !== '1'") &&
    realGate >= 0 && injectedGate > realGate && unconfigured > injectedGate &&
    !/\bfunction\s+(?:mockTranscript|mockSoap)\b/.test(transcription) &&
    transcription.includes('return respond(502, {') &&
    transcription.includes('code: TRANSCRIPTION_PROVIDER_FAILED_CODE'),
    'artifact_scan_transcription_fail_closed_contract_missing',
  );

  const extraction = readRequiredSource(root, 'server/documentExtraction.mjs');
  for (const marker of [
    "const selftest = process.env.SELFTEST === '1'",
    'const providerProbe = selftest &&',
    'const fakeUrl = selftest && !providerProbe',
    "process.env.OPENAI_HEALTH_DATA_TERMS_CONFIRMED !== '1'",
    '!process.env.OPENAI_API_KEY',
    'url: OPENAI_RESPONSES_URL',
    'providerResponseIdHash',
  ]) requireTrue(extraction.includes(marker), 'artifact_scan_extraction_fail_closed_contract_missing');

  for (const file of productionBundleFiles(distRoot)) {
    const source = fs.readFileSync(file, 'utf8');
    requireTrue(!PRODUCTION_MOCK_OUTPUT_MARKER.test(source),
      `artifact_scan_bundle_marker_${path.basename(file).replace(/[^a-z0-9]+/gi, '_')}`);
    requireTrue(!PHYSIO_FORBIDDEN_RUNTIME_MARKER.test(source),
      `artifact_scan_bundle_non_physio_marker_${path.basename(file).replace(/[^a-z0-9]+/gi, '_')}`);
  }
  return true;
}

function argument(name, argv = process.argv.slice(2)) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function arraysEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function runProcess(command, args, { timeoutMs = 120_000, allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      Object.defineProperties(error, {
        physioProcessExitCode: { value: 1 },
        physioProcessStdout: { value: stdout },
        physioProcessStderr: { value: stderr },
      });
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !allowFailure) {
        // Do not include Fly/provider stderr: it may contain control-plane
        // details. The stage-specific error code is sufficient for resumption.
        const error = new Error(`physio_canary_command_failed_${command}_${code ?? 'signal'}`);
        Object.defineProperties(error, {
          physioProcessExitCode: {
            value: Number.isSafeInteger(code) && code >= 0 && code <= 255 ? code : 1,
          },
          physioProcessStdout: { value: stdout },
          physioProcessStderr: { value: stderr },
        });
        reject(error);
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

function bootstrapReceiptPath(phase) {
  requireTrue(['success', 'fault'].includes(phase), 'production_phase_invalid');
  return `${PHYSIO_CANARY_BOOTSTRAP_RECEIPT_PREFIX}${phase}.json`;
}

function withoutForbiddenInheritedCanaryEnvironment(environment) {
  const cleaned = { ...environment };
  for (const name of [
    'ASSESSSUITE_DB_PATH',
    'ASSESSSUITE_DB_PATH_ACK',
    'OPENAI_CHAT_TEST_BASE_URL',
    'OPENAI_CHAT_TEST_TIMEOUT_MS',
    'DOCUMENT_EXTRACTION_TEST_BASE_URL',
    'DOCUMENT_EXTRACTION_PROVIDER_PROBE',
    'DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK',
    'RUN_DOCUMENT_EXTRACTION_PROVIDER_PROBE',
    'OPENAI_DOCUMENT_EXTRACTION_MODEL',
  ]) delete cleaned[name];
  return cleaned;
}

function randomCanarySecret() {
  return `Canary-${randomBytes(32).toString('base64url')}!9a`;
}

/**
 * Builds the only admitted production child plan. The returned object is an
 * internal launch plan and can contain credentials; it must never be logged or
 * copied into the content-free release receipt.
 */
export function buildPhysioProductionCanaryRuntimePlan({
  environment = process.env,
  phase,
  port,
  maximumCostMicrousd,
  providerCredential = environment.OPENAI_API_KEY,
  adminEmail = `physio-canary-admin-${randomUUID()}@example.test`,
  adminPassword = randomCanarySecret(),
  clinicianPassword = randomCanarySecret(),
} = {}) {
  requireTrue(['success', 'fault'].includes(phase), 'production_phase_invalid');
  requireTrue(Number.isSafeInteger(port) && port > 0 && port <= 65_535,
    'production_port_invalid');
  requireTrue(Number.isSafeInteger(maximumCostMicrousd) && maximumCostMicrousd > 0 &&
    maximumCostMicrousd <= 5_000_000, 'cost_ceiling_invalid');
  requireTrue(environment.RUN_PHYSIO_EXACT_IMAGE_CANARY === PHYSIO_EXACT_IMAGE_CANARY_ACK &&
    environment.ALLOW_PAID_PROVIDER_PROBE === '1',
  'production_paid_probe_authority_missing');
  requireTrue(typeof providerCredential === 'string' && providerCredential.trim().length >= 20 &&
    !/(?:synthetic|test|mock|placeholder|fake|canary-invalid)/i.test(providerCredential),
  'production_posture_provider_credential_not_real');
  requireTrue(typeof adminEmail === 'string' &&
    /^[a-z0-9][a-z0-9-]{0,126}@example\.test$/.test(adminEmail),
    'production_admin_identity_invalid');
  requireTrue(typeof adminPassword === 'string' && adminPassword.length >= 32 &&
    typeof clinicianPassword === 'string' && clinicianPassword.length >= 32,
  'production_random_credential_invalid');

  const childEnvironment = {
    ...withoutForbiddenInheritedCanaryEnvironment(environment),
    NODE_ENV: 'production',
    SELFTEST: '0',
    PARITY_ASSURANCE_MODE: '0',
    PHYSIO_EXACT_IMAGE_CANARY_MODE: '1',
    PHYSIO_EXACT_IMAGE_CANARY_BOOTSTRAP_RECEIPT: bootstrapReceiptPath(phase),
    PROFESSION: PHYSIO_CANARY_PROFESSION_ID,
    DEFAULT_APP_ID: PHYSIO_CANARY_APP_ID,
    PORT: String(port),
    ASSESSSUITE_BIND_HOST: '127.0.0.1',
    APP_URL: PHYSIO_PUBLIC_APP_URL,
    EXPECTED_APP_URL: PHYSIO_PUBLIC_APP_URL,
    UPLOADS_DIR: PHYSIO_CANARY_UPLOADS_DIR,
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminPassword,
    OPENAI_API_KEY: providerCredential,
    RUN_PHYSIO_EXACT_IMAGE_CANARY: PHYSIO_EXACT_IMAGE_CANARY_ACK,
    ALLOW_PAID_PROVIDER_PROBE: '1',
    OPENAI_MODEL_FAST: PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS[0],
    OPENAI_MODEL_QUALITY: PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS[1],
    OPENAI_TRANSCRIBE_MODEL: PHYSIO_CANARY_TRANSCRIPTION_MODEL,
    LLM_REQUIRED: '1',
    GENERAL_CLINICAL_LLM_ENABLED: '0',
    TRANSCRIPTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_UNDER_13_ENABLED: '0',
    OPENAI_HEALTH_DATA_TERMS_CONFIRMED: '1',
    OUTBOUND_EMAIL_ENABLED: '0',
    OUTBOUND_SMS_ENABLED: '0',
    PAYMENTS_ENABLED: '0',
    // Required by the strict bootstrap posture, but deliberately unused by
    // this journey: the synthetic clinician is provisioned by an authenticated
    // random bootstrap admin and then signs in through the normal login route.
    ALLOW_OPEN_REGISTRATION: '1',
    AI_USAGE_USER_ROLLING_24H_USD: String(Math.ceil(maximumCostMicrousd / 1_000_000) + 1),
    AI_USAGE_USER_ROLLING_24H_CALLS: '32',
    AI_USAGE_GLOBAL_MONTHLY_USD: String(Math.ceil(maximumCostMicrousd / 1_000_000) + 1),
    AI_USAGE_INVOKE_FAST_ESTIMATE_USD: '0.07',
    AI_USAGE_INVOKE_QUALITY_ESTIMATE_USD: '0.33',
    AI_USAGE_TRANSCRIPTION_ESTIMATE_USD: '0.10',
    AI_USAGE_SOAP_ESTIMATE_USD: '0.33',
    AI_USAGE_DOCUMENT_EXTRACTION_ESTIMATE_USD: '0.20',
  };
  const command = phase === 'fault'
    ? `node server/productionBootstrap.mjs && { export OPENAI_API_KEY='${INVALID_PROVIDER_CREDENTIAL}'; exec node server/index.mjs; }`
    : 'node server/productionBootstrap.mjs && exec node server/index.mjs';
  return Object.freeze({
    phase,
    command: 'sh',
    args: Object.freeze(['-c', command]),
    cwd: REPO_ROOT,
    environment: Object.freeze(childEnvironment),
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    listenerAddress: '127.0.0.1',
    databasePath: PHYSIO_CANARY_DATABASE_PATH,
    uploadsDir: PHYSIO_CANARY_UPLOADS_DIR,
    bootstrapReceiptPath: bootstrapReceiptPath(phase),
    adminEmail,
    adminPassword,
    clinicianPassword,
  });
}

async function freeLoopbackPort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      socket.close(() => resolve(address.port));
    });
  });
}

async function requestJson(server, route, { method = 'GET', token, body, headers = {} } = {}) {
  const requestHeaders = { 'X-App-Id': server.appId || PHYSIO_CANARY_APP_ID, ...headers };
  if (body !== undefined && !requestHeaders['Content-Type']) requestHeaders['Content-Type'] = 'application/json';
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  const response = await fetch(`${server.baseUrl}${route}`, {
    method,
    headers: requestHeaders,
    body: body === undefined
      ? undefined
      : requestHeaders['Content-Type'] === 'application/json'
        ? JSON.stringify(body)
        : body,
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // The canary validates JSON only where the route contract requires it.
  }
  return { response, status: response.status, body: parsed, text };
}

function resetEphemeralProductionCanaryState() {
  requireTrue(process.platform !== 'win32', 'ephemeral_reset_requires_carrier_linux');
  requireTrue(path.resolve(PHYSIO_CANARY_DATABASE_PATH) === PHYSIO_CANARY_DATABASE_PATH &&
    path.resolve(PHYSIO_CANARY_UPLOADS_DIR) === PHYSIO_CANARY_UPLOADS_DIR,
  'ephemeral_path_resolution_differs');
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const candidate = `${PHYSIO_CANARY_DATABASE_PATH}${suffix}`;
    if (fs.existsSync(candidate)) {
      const stat = fs.lstatSync(candidate);
      requireTrue(stat.isFile() && !stat.isSymbolicLink(), 'ephemeral_database_path_invalid');
      fs.rmSync(candidate);
    }
  }
  if (fs.existsSync(PHYSIO_CANARY_UPLOADS_DIR)) {
    const stat = fs.lstatSync(PHYSIO_CANARY_UPLOADS_DIR);
    requireTrue(stat.isDirectory() && !stat.isSymbolicLink(), 'ephemeral_upload_path_invalid');
    fs.rmSync(PHYSIO_CANARY_UPLOADS_DIR, { recursive: true });
  }
  for (const phase of ['success', 'fault']) {
    const receipt = bootstrapReceiptPath(phase);
    if (!fs.existsSync(receipt)) continue;
    const stat = fs.lstatSync(receipt);
    requireTrue(stat.isFile() && !stat.isSymbolicLink(), 'bootstrap_receipt_path_invalid');
    fs.rmSync(receipt);
  }
  return true;
}

function exactObjectKeys(value, expected, code) {
  requireTrue(value && typeof value === 'object' && !Array.isArray(value), `${code}_not_object`);
  requireTrue(arraysEqual(Object.keys(value).sort(), [...expected].sort()), `${code}_keys_differ`);
}

function readBootstrapReceipt(plan) {
  const stat = fs.lstatSync(plan.bootstrapReceiptPath);
  requireTrue(stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && stat.size <= 16_384,
    'bootstrap_receipt_file_invalid');
  if (process.platform !== 'win32') {
    requireTrue((stat.mode & 0o777) === 0o600, 'bootstrap_receipt_permissions_differ');
  }
  const bytes = fs.readFileSync(plan.bootstrapReceiptPath);
  const receipt = JSON.parse(bytes.toString('utf8'));
  exactObjectKeys(receipt, [
    'contract_version', 'result', 'mode', 'node_env', 'profession_id', 'app_id',
    'application_sha', 'build_timestamp', 'database_path_sha256', 'uploads_path_sha256',
    'production_posture_contract_version', 'production_posture_sha256',
    'catalogue_bootstrap_completed', 'completed_at',
  ], 'bootstrap_receipt');
  requireTrue(receipt.contract_version === PHYSIO_CANARY_BOOTSTRAP_CONTRACT &&
    receipt.result === 'PASS' && receipt.mode === 'exact-image-canary' &&
    receipt.node_env === 'production' && receipt.profession_id === PHYSIO_CANARY_PROFESSION_ID &&
    receipt.app_id === PHYSIO_CANARY_APP_ID &&
    receipt.application_sha === plan.environment.RELEASE_SHA &&
    receipt.build_timestamp === plan.environment.BUILD_TIMESTAMP &&
    receipt.database_path_sha256 === sha256(PHYSIO_CANARY_DATABASE_PATH) &&
    receipt.uploads_path_sha256 === sha256(PHYSIO_CANARY_UPLOADS_DIR) &&
    receipt.production_posture_contract_version === PHYSIO_CANARY_PRODUCTION_POSTURE_CONTRACT &&
    /^sha256:[0-9a-f]{64}$/.test(receipt.production_posture_sha256 || '') &&
    receipt.catalogue_bootstrap_completed === true &&
    Number.isFinite(Date.parse(receipt.completed_at)),
  'bootstrap_receipt_contract_differs');
  return { receipt, sha256: shaReceipt(bytes) };
}

async function waitForProductionListener(child, baseUrl, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    requireTrue(!child.canaryStartError, 'production_server_process_error');
    requireTrue(child.exitCode === null, 'production_server_exited_before_readiness');
    try {
      const response = await fetch(`${baseUrl}/api/health/live`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.status === 200) return true;
    } catch {
      // The production process has not bound its loopback listener yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  requireTrue(false, 'production_server_readiness_timeout');
}

async function stopProductionChild(child) {
  if (!child || child.exitCode !== null) return true;
  const exited = once(child, 'exit').then(() => true).catch(() => false);
  child.kill('SIGTERM');
  const graceful = await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(() => resolve(false), 10_000)),
  ]);
  if (graceful) return true;
  child.kill('SIGKILL');
  return Promise.race([
    exited,
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
}

export async function runPhysioProductionCanaryProcess(plan) {
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.environment,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let childError = null;
  child.once('error', (error) => {
    childError = error;
    child.canaryStartError = error;
  });
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  try {
    await waitForProductionListener(child, plan.baseUrl);
    requireTrue(!childError, 'production_server_process_error');
    const expectedListener = `[shim] listening on http://127.0.0.1:${plan.port}`;
    requireTrue(output.split(/\r?\n/).includes(expectedListener), 'production_loopback_listener_not_observed');
    const bootstrap = readBootstrapReceipt(plan);
    const server = { appId: PHYSIO_CANARY_APP_ID, baseUrl: plan.baseUrl };
    const readiness = await requestJson(server, '/api/health/ready');
    const version = await requestJson(server, '/api/version');
    const capabilities = await requestJson(server, '/api/capabilities');
    requireTrue(readiness.status === 200 && readiness.body?.ready === true &&
      readiness.body?.checks?.production_posture === true,
      'production_server_not_ready');
    requireTrue(version.status === 200 && version.body?.release_sha === plan.environment.RELEASE_SHA &&
      version.body?.profession_id === PHYSIO_CANARY_PROFESSION_ID &&
      version.body?.app_id === PHYSIO_CANARY_APP_ID &&
      version.body?.production_posture?.mode === 'exact-image-canary' &&
      version.body?.production_posture?.ready === true &&
      version.body?.production_posture?.deployment_ready === false &&
      version.body?.production_posture?.posture_sha256 ===
        bootstrap.receipt.production_posture_sha256,
    'production_server_version_differs');
    requireTrue(capabilities.status === 200 && capabilities.body?.profession_id ===
      PHYSIO_CANARY_PROFESSION_ID && capabilities.body?.app_id === PHYSIO_CANARY_APP_ID &&
      capabilities.body?.required_dependencies_ready === true &&
      capabilities.body?.production_posture_ready === true &&
      capabilities.body?.production_deployment_ready === false &&
      capabilities.body?.production_posture_mode === 'exact-image-canary',
    'production_server_capability_vector_not_ready');
    return {
      child,
      baseUrl: plan.baseUrl,
      listenerAddress: '127.0.0.1',
      listenerPort: plan.port,
      bootstrapReceiptSha256: bootstrap.sha256,
      observedNodeEnv: bootstrap.receipt.node_env,
      observedReleaseSha: version.body.release_sha,
      versionReceiptSha256: shaReceipt(canonicalJson(version.body)),
      capabilityVectorSha256: shaReceipt(canonicalJson(capabilities.body)),
      liveProofEligible: true,
      async stop() { return stopProductionChild(child); },
    };
  } catch (error) {
    await stopProductionChild(child);
    throw error;
  }
}

/**
 * An injected process runner is useful for offline unit tests of the launch
 * plan. Injection is indelibly marked mechanics-only and can never satisfy the
 * final receipt's live production-process proof.
 */
export async function startPhysioCanaryServer(options = {}) {
  const port = options.port || await (options.portResolver || freeLoopbackPort)();
  const plan = buildPhysioProductionCanaryRuntimePlan({ ...options, port });
  const injectedMechanics = Boolean(options.processRunner || options.stateResetter || options.portResolver);
  const stateResetter = options.stateResetter || resetEphemeralProductionCanaryState;
  await stateResetter(plan);
  const productionMockScanPassed = verifyProductionArtifactPosture({
    environment: plan.environment,
    sealedRuntime: !injectedMechanics,
  });
  const runtimeTree = injectedMechanics ? null : verifyPhysioRuntimeTree(REPO_ROOT);
  const processRunner = options.processRunner || runPhysioProductionCanaryProcess;
  const runtime = await processRunner(plan);
  return {
    ...runtime,
    appId: PHYSIO_CANARY_APP_ID,
    dbPath: PHYSIO_CANARY_DATABASE_PATH,
    uploadsDir: PHYSIO_CANARY_UPLOADS_DIR,
    phase: plan.phase,
    adminEmail: plan.adminEmail,
    adminPassword: plan.adminPassword,
    clinicianPassword: plan.clinicianPassword,
    productionMockScanPassed,
    runtimeTreeManifestReceiptSha256: runtimeTree?.manifest_receipt_sha256 || null,
    liveProofEligible: !injectedMechanics && runtime.liveProofEligible === true,
  };
}

export async function setupSyntheticClinician(server) {
  requireTrue(server.liveProofEligible === true && server.phase, 'production_runtime_not_live');
  const adminLogin = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
    method: 'POST',
    body: { email: server.adminEmail, password: server.adminPassword },
  });
  requireTrue(adminLogin.status === 200 && adminLogin.body?.access_token,
    'random_bootstrap_admin_login_failed');
  const adminToken = adminLogin.body.access_token;
  const email = `physio-canary-clinician-${randomUUID()}@example.test`;
  const password = server.clinicianPassword;
  const passwordRecord = hashPassword(password);
  const provisioned = await requestJson(server, `/api/apps/${server.appId}/entities/User`, {
    method: 'POST', token: adminToken,
    body: {
      email,
      role: 'user',
      account_status: 'active',
      subscription_status: 'active',
      email_verified: true,
      country: 'australia',
      profession: 'Physiotherapist',
      clinician_name: 'Synthetic Physio Canary Clinician',
      full_name: 'Synthetic Physio Canary Clinician',
      ...passwordRecord,
      synthetic_canary: true,
    },
  });
  requireTrue(provisioned.status === 200 && provisioned.body?.id &&
    provisioned.body?.email === email, 'clinician_provisioning_failed');
  const clinicianLogin = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
    method: 'POST', body: { email, password },
  });
  requireTrue(clinicianLogin.status === 200 && clinicianLogin.body?.access_token,
    'clinician_normal_login_failed');
  const user = {
    id: provisioned.body.id,
    email,
    token: clinicianLogin.body.access_token,
  };
  const organization = await requestJson(server, `/api/apps/${server.appId}/entities/Organization`, {
    method: 'POST', token: adminToken,
    body: { name: `Synthetic Physio Canary Practice ${randomUUID()}`, synthetic_canary: true },
  });
  requireTrue(organization.status === 200 && organization.body?.id, 'organization_create_failed');
  const membership = await requestJson(server, `/api/apps/${server.appId}/entities/OrganizationMember`, {
    method: 'POST', token: adminToken,
    body: {
      org_id: organization.body.id,
      user_email: user.email,
      role: 'clinician',
      is_primary: true,
      synthetic_canary: true,
    },
  });
  requireTrue(membership.status === 200, 'membership_create_failed');
  const acceptance = await requestJson(
    server,
    `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
    { method: 'POST', token: user.token, body: { org_id: organization.body.id, marketing_opt_in: false } },
  );
  requireTrue(acceptance.status === 200, 'legal_acceptance_failed');
  const client = await requestJson(server, `/api/apps/${server.appId}/entities/Client`, {
    method: 'POST', token: user.token,
    body: {
      org_id: organization.body.id,
      full_name: `Synthetic Physio Canary Patient ${randomUUID()}`,
      status: 'active',
      primary_condition: 'Wholly synthetic lateral ankle sprain',
      assigned_clinician_email: user.email,
      synthetic_canary: true,
    },
  });
  requireTrue(client.status === 200 && client.body?.id, 'client_create_failed');
  const episode = await requestJson(server, `/api/apps/${server.appId}/entities/PhysioCareEpisode`, {
    method: 'POST', token: user.token,
    body: {
      schema_version: 2,
      org_id: organization.body.id,
      client_id: client.body.id,
      primary_practitioner_id: user.id,
      episode_number: 1,
      title: 'Synthetic exact-image canary episode',
      status: 'active',
      episode_start_date: '2026-08-22',
      presenting_problem: 'Wholly synthetic ankle pain after a training drill',
      synthetic_canary: true,
    },
  });
  requireTrue(episode.status === 200 && episode.body?.id, 'episode_create_failed');
  return {
    adminToken,
    user,
    orgId: organization.body.id,
    clientId: client.body.id,
    episodeId: episode.body.id,
  };
}

function usageRows(dbPath, userId) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare(`
      SELECT id, provider, feature, model, status, estimated_cost_microusd,
             actual_cost_microusd, request_units, input_tokens,
             cached_input_tokens, output_tokens, audio_seconds,
             provider_request_id_hash, created_at, completed_at
      FROM api_usage_reservation
      WHERE user_id = ?
      ORDER BY created_at ASC, rowid ASC
    `).all(userId);
  } finally {
    db.close();
  }
}

async function proveGenericLlmIsolated(server, subject) {
  const before = usageRows(server.dbPath, subject.user.id);
  const genericResponse = await requestJson(
    server,
    `/api/apps/${server.appId}/integration-endpoints/Core/InvokeLLM`,
    {
      method: 'POST',
      token: subject.user.token,
      body: { prompt: 'Synthetic canary request that must never reach a provider.' },
    },
  );
  const legacySoapResponse = await requestJson(
    server,
    `/api/apps/${server.appId}/functions/transcribeSession`,
    {
      method: 'POST',
      token: subject.user.token,
      body: {
        action: 'dissect_to_soap',
        transcript: 'Synthetic transcript that must never reach the legacy SOAP provider path.',
      },
    },
  );
  const after = usageRows(server.dbPath, subject.user.id);
  requireTrue(
    genericResponse.status === 403
      && genericResponse.body?.code === 'profession_ai_surface_unavailable'
      && legacySoapResponse.status === 403
      && legacySoapResponse.body?.code === 'profession_ai_surface_unavailable'
      && before.length === after.length,
    'legacy_clinical_llm_reachable_in_physio',
  );
  return true;
}

function latestNewUsage(before, after, feature, status) {
  const previousIds = new Set(before.map((row) => row.id));
  const rowsAdded = after.filter((row) => !previousIds.has(row.id));
  requireTrue(rowsAdded.length === 1, `${feature}_usage_delta_not_one`);
  const row = rowsAdded[0];
  requireTrue(row.feature === feature && row.status === status, `${feature}_usage_state_differs`);
  return row;
}

function providerHash(row, code) {
  requireTrue(/^[0-9a-f]{64}$/.test(row.provider_request_id_hash || ''), `${code}_provider_hash_missing`);
  return `sha256:${row.provider_request_id_hash}`;
}

function providerProgressRow(callOrdinal, providerTask, success) {
  requireTrue(Number.isSafeInteger(callOrdinal) && callOrdinal >= 1 &&
    callOrdinal <= PHYSIO_CANARY_MAX_PAID_CALLS, 'provider_progress_ordinal_invalid');
  requireTrue(PHYSIO_CANARY_PROVIDER_TASK_SET[callOrdinal - 1] === providerTask,
    'provider_progress_task_order_differs');
  requireTrue(SHA256_RE.test(success?.provider_request_id || ''),
    'provider_progress_request_hash_invalid');
  const actualCostMicrousd = success?.usage_delta?.estimated_cost_microusd;
  requireTrue(Number.isSafeInteger(actualCostMicrousd) && actualCostMicrousd >= 0,
    'provider_progress_cost_invalid');
  return Object.freeze({
    call_ordinal: callOrdinal,
    provider_task: providerTask,
    provider_request_id_sha256: success.provider_request_id,
    usage_receipt_sha256: shaReceipt(canonicalJson(success.usage_delta)),
    actual_cost_microusd: actualCostMicrousd,
  });
}

function emitProviderProgress(callOrdinal, providerTask, success) {
  const row = providerProgressRow(callOrdinal, providerTask, success);
  process.stdout.write(`${INNER_PROVIDER_PROGRESS_PREFIX}${JSON.stringify(row)}\n`);
  return row;
}

function durableGenerationReceipt(dbPath, generationId) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare(`
      SELECT id, status, usage_reservation_id, provider_response_id,
             provider_http_request_id, provider_request_id_hash,
             provenance_json, public_response_json
      FROM physio_ai_generation
      WHERE id = ?
    `).get(generationId) || null;
  } finally {
    db.close();
  }
}

function taskContext(taskId) {
  return {
    synthetic_fixture: true,
    presentation: 'Wholly synthetic adult lateral ankle pain after a training drill.',
    reported_function: 'Synthetic difficulty descending stairs and running.',
    examination: {
      observation: 'Synthetic mild swelling only.',
      range_of_motion: 'Synthetic ankle dorsiflexion recorded as 8 degrees.',
      strength: 'Synthetic eversion strength recorded as 4 of 5.',
    },
    measures: [
      { name: 'Synthetic Lower Extremity Functional Scale', baseline: 42, current: 52, unit: 'points' },
    ],
    goals: ['Synthetic return to a 20 minute continuous run.'],
    recorded_management: ['Synthetic graded loading and balance exercise discussion.'],
    task_fixture_id: taskId,
  };
}

async function persistEditableTaskDraft(server, subject, taskId, generation) {
  const saved = await requestJson(server, `/api/apps/${server.appId}/functions/savePhysioAiGeneration`, {
    method: 'POST', token: subject.user.token,
    body: {
      generation_id: generation.generation_id,
      edited_output: generation.output,
      save_request_id: `physio-canary-save-${taskId}`,
      expected_episode_updated_date: generation.care_episode_updated_date,
    },
  });
  const entity = saved.body?.linked_entity;
  const created = saved.body?.linked_record;
  requireTrue(saved.status === 200 && created?.id &&
    (entity === 'SOAPNote' || entity === 'SavedReport'), `${taskId}_persistence_create_failed`);
  const reread = await requestJson(
    server,
    `/api/apps/${server.appId}/entities/${entity}/${encodeURIComponent(created.id)}`,
    { token: subject.user.token },
  );
  requireTrue(reread.status === 200 && reread.body?.status === 'draft', `${taskId}_persistence_reread_failed`);

  let update;
  if (entity === 'SOAPNote') {
    update = {
      other: `${String(reread.body.other || '')}\n${EDIT_MARKER}`.trim(),
      expected_updated_date: reread.body.updated_date,
    };
  } else {
    update = {
      section_content: {
        ...reread.body.section_content,
        synthetic_clinician_edit: EDIT_MARKER,
      },
      expected_updated_date: reread.body.updated_date,
    };
  }
  const edited = await requestJson(
    server,
    `/api/apps/${server.appId}/entities/${entity}/${encodeURIComponent(created.id)}`,
    { method: 'PUT', token: subject.user.token, body: update },
  );
  requireTrue(edited.status === 200, `${taskId}_persistence_edit_failed`);
  const reloaded = await requestJson(
    server,
    `/api/apps/${server.appId}/entities/${entity}/${encodeURIComponent(created.id)}`,
    { token: subject.user.token },
  );
  const editRoundTrip = entity === 'SOAPNote'
    ? String(reloaded.body?.other || '').includes(EDIT_MARKER)
    : reloaded.body?.section_content?.synthetic_clinician_edit === EDIT_MARKER;
  requireTrue(reloaded.status === 200 && editRoundTrip, `${taskId}_editable_roundtrip_failed`);
  return shaReceipt(canonicalJson({
    task: taskId,
    entity,
    state: reloaded.body.status,
    edit_marker: EDIT_MARKER,
    generation_contract: reloaded.body.ai_generation?.provenance?.receipt_contract_version ||
      reloaded.body.ai_generation?.task_type || taskId,
  }));
}

async function runSixTaskSuccesses(server, subject, onProviderSuccess = () => {}) {
  const taskReceipts = {};
  for (const [taskIndex, taskId] of PHYSIO_CANARY_TASK_IDS.entries()) {
    const before = usageRows(server.dbPath, subject.user.id);
    const response = await requestJson(server, `/api/apps/${server.appId}/functions/physioAiTask`, {
      method: 'POST', token: subject.user.token,
      body: {
        task: taskId,
        org_id: subject.orgId,
        care_episode_id: subject.episodeId,
        generation_request_id: `physio-canary-success-${taskId}`,
        context: { clinician_context: JSON.stringify(taskContext(taskId)) },
      },
    });
    requireTrue(response.status === 200, `${taskId}_provider_success_failed`);
    const generation = response.body;
    requireTrue(generation?.task === taskId && generation?.care_episode_id === subject.episodeId &&
      typeof generation?.care_episode_updated_date === 'string' &&
      typeof generation?.generation_id === 'string' &&
      generation?.output_state === 'ai_draft_unreviewed' &&
      generation?.clinician_review_required === true, `${taskId}_public_contract_differs`);
    validatePhysioTaskOutput(taskId, generation.output);
    const after = usageRows(server.dbPath, subject.user.id);
    const usage = latestNewUsage(before, after, 'invoke_llm', 'succeeded');
    requireTrue(generation.provenance?.provider === usage.provider &&
      generation.provenance?.model === usage.model &&
      generation.provenance?.provider_request_id_hash === usage.provider_request_id_hash &&
      /^[0-9a-f]{64}$/.test(generation.provenance?.provider_http_request_id_hash || '') &&
      generation.provenance?.output_schema_receipt?.schema_sha256 ===
        sha256(JSON.stringify(PHYSIO_AI_TASKS[taskId].schema)) &&
      generation.provenance?.output_schema_receipt?.validator ===
        'assesssuite-physio-output-schema-validator' &&
      generation.provenance?.output_schema_receipt?.result === 'valid' &&
      generation.provenance?.finish_reason === 'stop' &&
      Number.isInteger(generation.provenance?.provider_status) &&
      generation.provenance.provider_status >= 200 && generation.provenance.provider_status < 300 &&
      generation.provenance?.usage?.output_tokens === usage.output_tokens &&
      generation.provenance?.usage?.input_tokens === usage.input_tokens &&
      generation.provenance?.usage?.actual_cost_microusd === usage.actual_cost_microusd,
    `${taskId}_adapter_ledger_receipt_differs`);
    const privateGeneration = durableGenerationReceipt(server.dbPath, generation.generation_id);
    requireTrue(privateGeneration?.status === 'succeeded' &&
      typeof privateGeneration.usage_reservation_id === 'string' &&
      typeof privateGeneration.provider_response_id === 'string' &&
      privateGeneration.provider_response_id.length > 0 &&
      typeof privateGeneration.provider_http_request_id === 'string' &&
      privateGeneration.provider_http_request_id.length > 0 &&
      privateGeneration.provider_request_id_hash === generation.provenance.provider_request_id_hash,
    `${taskId}_private_provider_receipt_missing`);
    requireTrue(!/mock|simulat|placeholder|fallback/i.test(`${usage.provider}\n${usage.model}`),
      `${taskId}_provider_posture_invalid`);
    requireTrue(PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS.includes(usage.model),
      `${taskId}_provider_snapshot_not_pinned`);
    const successReceipt = {
      status: 'PASS',
      provider_posture: 'real',
      provider: usage.provider,
      model: usage.model,
      provider_request_id: providerHash(usage, taskId),
      schema_receipt_sha256: shaReceipt(canonicalJson({
        task_version: generation.task_version,
        schema: PHYSIO_AI_TASKS[taskId].schema,
      })),
      usage_delta: {
        input_tokens: Number(usage.input_tokens),
        cached_input_tokens: Number(usage.cached_input_tokens || 0),
        output_tokens: Number(usage.output_tokens),
        estimated_cost_microusd: Number(usage.actual_cost_microusd),
      },
    };
    // Emit only after the provider/adapter/private-ledger evidence is fully
    // admitted, but before downstream editable persistence: if that later
    // proof fails, the already-incurred provider effect remains reconcilable.
    onProviderSuccess(taskIndex + 1, PHYSIO_CANARY_PROVIDER_TASK_SET[taskIndex],
      successReceipt);
    const persistenceReceipt = await persistEditableTaskDraft(server, subject, taskId, generation);
    taskReceipts[taskId] = {
      success: successReceipt,
      fault: null,
      structured_schema_valid: true,
      editable_persistence_verified: true,
      persistence_receipt_sha256: persistenceReceipt,
    };
  }
  return taskReceipts;
}

async function uploadAudio(server, subject, fixture) {
  const form = new FormData();
  form.append('org_id', subject.orgId);
  form.append('purpose', 'audio-transcription');
  form.append('file', new Blob([fixture.bytes], { type: fixture.mime }),
    `synthetic-physio-canary${fixture.extension}`);
  const response = await fetch(
    `${server.baseUrl}/api/apps/${server.appId}/integration-endpoints/Core/UploadFile`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${subject.user.token}`, 'X-App-Id': server.appId },
      body: form,
      signal: AbortSignal.timeout(60_000),
    },
  );
  const body = await response.json().catch(() => null);
  requireTrue(response.status === 200 && body?.file_url && body?.upload_id, 'audio_upload_failed');
  return body;
}

async function runTranscriptionSuccess(server, subject, fixture) {
  const uploaded = await uploadAudio(server, subject, fixture);
  const before = usageRows(server.dbPath, subject.user.id);
  const result = await requestJson(server, `/api/apps/${server.appId}/functions/transcribeSession`, {
    method: 'POST', token: subject.user.token,
    body: {
      action: 'transcribe',
      audio_url: uploaded.file_url,
      org_id: subject.orgId,
      care_episode_id: subject.episodeId,
      client_id: subject.clientId,
    },
  });
  requireTrue(result.status === 200 && result.body?.simulated === false &&
    typeof result.body?.transcript === 'string' && result.body.transcript.trim(), 'transcription_success_failed');
  requireTrue(normalizedMarker(result.body.transcript).includes(fixture.marker), 'transcription_fixture_not_grounded');
  const usage = latestNewUsage(before, usageRows(server.dbPath, subject.user.id), 'transcription', 'succeeded');
  requireTrue(!/mock|simulat|placeholder|fallback/i.test(`${usage.provider}\n${usage.model}`),
    'transcription_provider_posture_invalid');
  requireTrue(usage.model === PHYSIO_CANARY_TRANSCRIPTION_MODEL,
    'transcription_provider_model_not_pinned');
  return {
    success: {
      status: 'PASS',
      provider_posture: 'real',
      provider: usage.provider,
      model: usage.model,
      provider_request_id: providerHash(usage, 'transcription'),
      schema_receipt_sha256: shaReceipt(canonicalJson({ transcript: 'string', simulated: false })),
      usage_delta: {
        audio_seconds: Number(usage.audio_seconds),
        estimated_cost_microusd: Number(usage.actual_cost_microusd),
      },
    },
    fault: null,
    real_media_fixture: true,
    fixture_receipt_sha256: shaReceipt(fixture.bytes),
  };
}

async function uploadReferral(server, subject, fixtureBytes) {
  const form = new FormData();
  form.append('org_id', subject.orgId);
  form.append('purpose', 'referral-extraction');
  form.append('processing_authority_confirmed', 'true');
  form.append('processing_authority_attestation_version',
    REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION);
  form.append('subject_age_confirmation', REFERRAL_SUBJECT_AGE_CONFIRMATION);
  form.append('subject_age_attestation_version', REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION);
  form.append('file', new Blob([fixtureBytes], { type: 'application/pdf' }),
    'synthetic-physio-exact-image-canary-referral.pdf');
  const response = await fetch(
    `${server.baseUrl}/api/apps/${server.appId}/integration-endpoints/Core/UploadFile`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${subject.user.token}`, 'X-App-Id': server.appId },
      body: form,
      signal: AbortSignal.timeout(60_000),
    },
  );
  const body = await response.json().catch(() => null);
  requireTrue(response.status === 200 && body?.file_url && body?.upload_id, 'referral_upload_failed');
  return body;
}

function extractionIsGrounded(output) {
  return Boolean(
    output && typeof output === 'object' && !Array.isArray(output) &&
    typeof output.full_name === 'string' && output.full_name.trim().toLowerCase() === 'alex river' &&
    output.date_of_birth === '1990-01-02' &&
    typeof output.primary_condition === 'string' && /ankle sprain/i.test(output.primary_condition) &&
    Array.isArray(output.comorbidities) && output.comorbidities.some((entry) => /asthma/i.test(String(entry))) &&
    !/mock|placeholder|dummy|unknown patient/i.test(JSON.stringify(output))
  );
}

function extractionAudit(dbPath, uploadId, outcome) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare(`
      SELECT metadata_json
      FROM upload_audit
      WHERE upload_id = ? AND event_type = 'document_extraction' AND outcome = ?
      ORDER BY created_at DESC, rowid DESC
    `).all(uploadId, outcome);
    return rows.map((row) => {
      try { return JSON.parse(row.metadata_json); } catch { return null; }
    }).find(Boolean) || null;
  } finally {
    db.close();
  }
}

async function callExtraction(server, subject, uploaded) {
  return requestJson(
    server,
    `/api/apps/${server.appId}/integration-endpoints/Core/ExtractDataFromUploadedFile`,
    {
      method: 'POST', token: subject.user.token,
      body: {
        org_id: subject.orgId,
        file_urls: [uploaded.file_url],
        json_schema: REFERRAL_EXTRACTION_SCHEMA,
        processing_authority_confirmed: true,
        processing_authority_attestation_version:
          REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
      },
    },
  );
}

async function runExtractionSuccess(server, subject) {
  const fixtureBytes = buildPhysioCanaryReferralPdf();
  const uploaded = await uploadReferral(server, subject, fixtureBytes);
  const before = usageRows(server.dbPath, subject.user.id);
  const result = await callExtraction(server, subject, uploaded);
  requireTrue(result.status === 200 && result.body?.status === 'success' &&
    extractionIsGrounded(result.body.output), 'extraction_success_failed');
  const usage = latestNewUsage(before, usageRows(server.dbPath, subject.user.id),
    'document_extraction', 'succeeded');
  const audit = extractionAudit(server.dbPath, uploaded.upload_id, 'success');
  requireTrue(audit?.provider_contact_attempted === true && audit?.provider_status_class === '2xx' &&
    audit?.schema_hash === REFERRAL_EXTRACTION_SCHEMA_SHA256 && audit?.provider_model === usage.model &&
    audit?.provider_response_id_hash === usage.provider_request_id_hash,
  'extraction_adapter_audit_differs');
  requireTrue(!/mock|simulat|placeholder|fallback/i.test(`${usage.provider}\n${usage.model}`),
    'extraction_provider_posture_invalid');
  requireTrue(PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS.includes(usage.model),
    'extraction_provider_snapshot_not_pinned');
  return {
    success: {
      status: 'PASS',
      provider_posture: 'real',
      provider: usage.provider,
      model: usage.model,
      provider_request_id: providerHash(usage, 'extraction'),
      schema_receipt_sha256: `sha256:${REFERRAL_EXTRACTION_SCHEMA_SHA256}`,
      provider_response_sha256: shaReceipt(canonicalJson(result.body.output)),
      usage_delta: {
        request_units: Number(usage.request_units),
        estimated_cost_microusd: Number(usage.actual_cost_microusd),
      },
    },
    fault: null,
    real_document_fixture: true,
    fixture_receipt_sha256: shaReceipt(fixtureBytes),
  };
}

async function runFaultPaths(server, subject, fixture) {
  const taskFaults = {};
  for (const taskId of PHYSIO_CANARY_TASK_IDS) {
    const beforeUsage = usageRows(server.dbPath, subject.user.id);
    const beforePersisted = await Promise.all(['SOAPNote', 'SavedReport'].map((entity) =>
      requestJson(server, `/api/apps/${server.appId}/entities/${entity}`, { token: subject.user.token })));
    const response = await requestJson(server, `/api/apps/${server.appId}/functions/physioAiTask`, {
      method: 'POST', token: subject.user.token,
      body: {
        task: taskId,
        org_id: subject.orgId,
        care_episode_id: subject.episodeId,
        generation_request_id: `physio-canary-fault-${taskId}`,
        context: { clinician_context: JSON.stringify(taskContext(taskId)) },
      },
    });
    const failedUsage = latestNewUsage(beforeUsage, usageRows(server.dbPath, subject.user.id),
      'invoke_llm', 'failed');
    const afterPersisted = await Promise.all(['SOAPNote', 'SavedReport'].map((entity) =>
      requestJson(server, `/api/apps/${server.appId}/entities/${entity}`, { token: subject.user.token })));
    requireTrue(response.status === 502 && response.body?.code === 'ai_provider_failed' &&
      beforePersisted.every((entry, index) => entry.body?.length === afterPersisted[index].body?.length) &&
      failedUsage.provider === 'openai' &&
      PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS.includes(failedUsage.model),
    `${taskId}_fault_not_loud`);
    taskFaults[taskId] = {
      status: 'PASS',
      non_2xx_verified: true,
      http_status: response.status,
      error_code: response.body.code,
      provider_contact_attempted: true,
      placeholder_success: false,
      persisted_false_success: false,
    };
  }

  const audio = await uploadAudio(server, subject, fixture);
  const transcriptionBefore = usageRows(server.dbPath, subject.user.id);
  const transcription = await requestJson(server, `/api/apps/${server.appId}/functions/transcribeSession`, {
    method: 'POST', token: subject.user.token,
    body: {
      action: 'transcribe',
      audio_url: audio.file_url,
      org_id: subject.orgId,
      care_episode_id: subject.episodeId,
      client_id: subject.clientId,
    },
  });
  const failedTranscriptionUsage = latestNewUsage(
    transcriptionBefore,
    usageRows(server.dbPath, subject.user.id),
    'transcription',
    'failed',
  );
  requireTrue(transcription.status === 502 && transcription.body?.code === 'transcription_provider_failed' &&
    !transcription.body?.transcript && transcription.body?.simulated !== true &&
    failedTranscriptionUsage.provider === 'openai' &&
    failedTranscriptionUsage.model === PHYSIO_CANARY_TRANSCRIPTION_MODEL,
  'transcription_fault_not_loud');
  const transcriptionFault = {
    status: 'PASS', non_2xx_verified: true, http_status: transcription.status,
    error_code: transcription.body.code, provider_contact_attempted: true,
    placeholder_success: false, persisted_false_success: false,
  };

  const document = await uploadReferral(server, subject, buildPhysioCanaryReferralPdf());
  const extractionBefore = usageRows(server.dbPath, subject.user.id);
  const extraction = await callExtraction(server, subject, document);
  const failedExtractionUsage = latestNewUsage(extractionBefore, usageRows(server.dbPath, subject.user.id),
    'document_extraction', 'failed');
  const audit = extractionAudit(server.dbPath, document.upload_id, 'failed');
  requireTrue(extraction.status >= 400 && extraction.status < 600 && extraction.body?.status === 'error' &&
    typeof extraction.body?.code === 'string' && extraction.body.code.trim() &&
    audit?.provider_contact_attempted === true && audit?.provider_status_class === '4xx' &&
    failedExtractionUsage.provider === 'openai' &&
    PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS.includes(failedExtractionUsage.model) &&
    !extraction.body?.output,
  'extraction_fault_not_loud');
  const extractionFault = {
    status: 'PASS', non_2xx_verified: true, http_status: extraction.status,
    error_code: extraction.body.code, provider_contact_attempted: true,
    placeholder_success: false, persisted_false_success: false,
  };
  return { taskFaults, transcriptionFault, extractionFault };
}

function actualCost(rowsToPrice) {
  return rowsToPrice
    .filter((row) => row.status === 'succeeded')
    .reduce((sum, row) => sum + Number(row.actual_cost_microusd || 0), 0);
}

export async function runInsideCanary(environment = process.env) {
  requireTrue(environment.RUN_PHYSIO_EXACT_IMAGE_CANARY === PHYSIO_EXACT_IMAGE_CANARY_ACK,
    'acknowledgement_missing');
  requireTrue(environment.ALLOW_PAID_PROVIDER_PROBE === '1', 'paid_probe_not_authorized');
  requireTrue(environment.NODE_ENV === 'production', 'carrier_not_production_image');
  requireTrue(environment.PHYSIO_EXACT_IMAGE_CANARY_MODE === '1',
    'strict_canary_mode_missing');
  requireTrue(environment.PROFESSION === PHYSIO_CANARY_PROFESSION_ID &&
    environment.DEFAULT_APP_ID === PHYSIO_CANARY_APP_ID, 'profession_identity_differs');
  requireTrue(RELEASE_SHA_RE.test(environment.RELEASE_SHA || '') &&
    environment.RELEASE_SHA === environment.PHYSIO_CANARY_APPLICATION_SHA, 'release_sha_differs');
  requireTrue(environment.PHYSIO_CANARY_CONTAINER_NAME ===
    physioCanaryContainerName(environment.RELEASE_SHA), 'container_name_identity_differs');
  requireTrue(Number(environment.PHYSIO_CANARY_TTL_SECONDS) === PHYSIO_CANARY_TTL_SECONDS,
    'ttl_seconds_differs');
  assertPhysioCanaryProviderTaskMapping(
    String(environment.PHYSIO_CANARY_PROVIDER_TASK_SET || '').split(',').filter(Boolean),
  );
  requireTrue(LOCAL_IMAGE_RE.test(environment.PHYSIO_CANARY_IMMUTABLE_IMAGE || ''), 'image_digest_missing');
  requireTrue(/^sha256:[0-9a-f]{64}$/.test(environment.PHYSIO_CANARY_CANDIDATE_ARCHIVE_SHA256 || ''),
    'candidate_archive_digest_missing');
  requireTrue(CARRIER_ID_RE.test(environment.PHYSIO_CANARY_CARRIER_ID || ''),
    'local_carrier_identity_missing');
  requireTrue(typeof environment.OPENAI_API_KEY === 'string' && environment.OPENAI_API_KEY.trim().length > 0,
    'provider_credential_missing');
  requireTrue(!environment.DOCUMENT_EXTRACTION_TEST_BASE_URL && environment.SELFTEST !== '1',
    'mock_provider_route_enabled');
  const maximumCostMicrousd = Number(environment.PHYSIO_CANARY_MAX_COST_MICROUSD);
  requireTrue(Number.isSafeInteger(maximumCostMicrousd) && maximumCostMicrousd > 0 &&
    maximumCostMicrousd <= 5_000_000, 'cost_ceiling_invalid');
  requireTrue(environment.PHYSIO_CANARY_AUDIO_SHA256 === PHYSIO_CANARY_AUDIO_SHA256,
    'audio_fixture_sha_identity_differs');
  const fixture = fixtureMetadata(environment.PHYSIO_CANARY_AUDIO_PATH,
    environment.PHYSIO_CANARY_EXPECTED_TRANSCRIPT_MARKER, { requireFrozenFixture: true });
  const startedAt = new Date().toISOString();
  let successServer;
  let faultServer;
  let innerReceipt = null;
  let ephemeralStateRemoved = false;
  try {
    successServer = await startPhysioCanaryServer({
      maximumCostMicrousd,
      phase: 'success',
      environment,
    });
    requireTrue(successServer.liveProofEligible === true, 'success_runtime_not_live_proof');
    const successSubject = await setupSyntheticClinician(successServer);
    await proveGenericLlmIsolated(successServer, successSubject);
    const tasks = await runSixTaskSuccesses(successServer, successSubject, emitProviderProgress);
    const transcription = await runTranscriptionSuccess(successServer, successSubject, fixture);
    emitProviderProgress(7, PHYSIO_CANARY_PROVIDER_TASK_SET[6], transcription.success);
    const extraction = await runExtractionSuccess(successServer, successSubject);
    emitProviderProgress(8, PHYSIO_CANARY_PROVIDER_TASK_SET[7], extraction.success);
    const successUsage = usageRows(successServer.dbPath, successSubject.user.id);
    requireTrue(successUsage.filter((row) => row.status === 'succeeded').length ===
      PHYSIO_CANARY_MAX_PAID_CALLS, 'paid_call_count_differs');
    const cost = actualCost(successUsage);
    requireTrue(Number.isSafeInteger(cost) && cost <= maximumCostMicrousd, 'cost_ceiling_exceeded');

    requireTrue(await successServer.stop(), 'success_runtime_stop_failed');
    const successRuntime = successServer;
    successServer = null;

    faultServer = await startPhysioCanaryServer({
      maximumCostMicrousd,
      phase: 'fault',
      environment,
    });
    requireTrue(faultServer.liveProofEligible === true, 'fault_runtime_not_live_proof');
    const faultSubject = await setupSyntheticClinician(faultServer);
    await proveGenericLlmIsolated(faultServer, faultSubject);
    const faults = await runFaultPaths(faultServer, faultSubject, fixture);
    for (const taskId of PHYSIO_CANARY_TASK_IDS) tasks[taskId].fault = faults.taskFaults[taskId];
    transcription.fault = faults.transcriptionFault;
    extraction.fault = faults.extractionFault;

    requireTrue(await faultServer.stop(), 'fault_runtime_stop_failed');
    const faultRuntime = faultServer;
    faultServer = null;
    requireTrue(successRuntime.observedNodeEnv === 'production' &&
      faultRuntime.observedNodeEnv === 'production' &&
      successRuntime.observedReleaseSha === environment.RELEASE_SHA &&
      faultRuntime.observedReleaseSha === environment.RELEASE_SHA,
    'production_runtime_identity_differs');

    innerReceipt = {
      contract_version: PHYSIO_EXACT_IMAGE_CANARY_CONTRACT,
      result: 'PASS',
      application: PHYSIO_CANARY_APPLICATION,
      application_sha: environment.RELEASE_SHA,
      immutable_image: environment.PHYSIO_CANARY_IMMUTABLE_IMAGE,
      image_digest: environment.PHYSIO_CANARY_IMMUTABLE_IMAGE,
      candidate_archive_sha256: environment.PHYSIO_CANARY_CANDIDATE_ARCHIVE_SHA256,
      profession_id: PHYSIO_CANARY_PROFESSION_ID,
      app_id: PHYSIO_CANARY_APP_ID,
      carrier_type: 'local-docker',
      carrier_id_sha256: shaReceipt(environment.PHYSIO_CANARY_CARRIER_ID),
      // The outer producer overwrites these fields only after exact Docker
      // readback, captured-container destruction and volume reconciliation.
      isolated_candidate_image_verified: false,
      disposable_container_destroyed: false,
      host_port_binding_count: -1,
      mount_count: -1,
      custom_dns_count: -1,
      network_mode: 'unverified',
      docker_volume_inventory_unchanged: false,
      production_mock_scan_passed: successRuntime.productionMockScanPassed === true &&
        faultRuntime.productionMockScanPassed === true,
      production_runtime: {
        mode: 'production-process',
        strict_canary_mode: true,
        observed_child_node_env: 'production',
        production_bootstrap_completed: true,
        success_bootstrap_receipt_sha256: successRuntime.bootstrapReceiptSha256,
        fault_bootstrap_receipt_sha256: faultRuntime.bootstrapReceiptSha256,
        success_version_receipt_sha256: successRuntime.versionReceiptSha256,
        fault_version_receipt_sha256: faultRuntime.versionReceiptSha256,
        success_capability_vector_sha256: successRuntime.capabilityVectorSha256,
        fault_capability_vector_sha256: faultRuntime.capabilityVectorSha256,
        runtime_tree_manifest_receipt_sha256:
          successRuntime.runtimeTreeManifestReceiptSha256,
        observed_release_sha: environment.RELEASE_SHA,
        observed_immutable_image: environment.PHYSIO_CANARY_IMMUTABLE_IMAGE,
        server_entry_sequence: 'productionBootstrap-to-server/index',
        loopback_only: successRuntime.listenerAddress === '127.0.0.1' &&
          faultRuntime.listenerAddress === '127.0.0.1',
        ephemeral_storage: successRuntime.dbPath === PHYSIO_CANARY_DATABASE_PATH &&
          faultRuntime.dbPath === PHYSIO_CANARY_DATABASE_PATH,
        ephemeral_state_removed: false,
        test_harness_used: false,
        fixed_otp_used: false,
        success_live_proof: successRuntime.liveProofEligible,
        fault_live_proof: faultRuntime.liveProofEligible,
      },
      bounded_paid_calls: {
        maximum: PHYSIO_CANARY_MAX_PAID_CALLS,
        succeeded: successUsage.filter((row) => row.status === 'succeeded').length,
      },
      cost_ceiling_microusd: maximumCostMicrousd,
      actual_cost_microusd: cost,
      tasks,
      transcription,
      extraction,
      started_at: startedAt,
      completed_at: null,
    };
  } finally {
    const faultStopped = faultServer ? await faultServer.stop().catch(() => false) : true;
    const successStopped = successServer ? await successServer.stop().catch(() => false) : true;
    ephemeralStateRemoved = faultStopped && successStopped && resetEphemeralProductionCanaryState();
  }
  requireTrue(innerReceipt && ephemeralStateRemoved, 'production_runtime_cleanup_incomplete');
  innerReceipt.production_runtime.ephemeral_state_removed = true;
  innerReceipt.completed_at = new Date().toISOString();
  return innerReceipt;
}

export function parseInnerReceipt(stdout) {
  const text = String(stdout || '').trim();
  const begin = text.indexOf(INNER_RECEIPT_BEGIN);
  const end = text.indexOf(INNER_RECEIPT_END, begin + INNER_RECEIPT_BEGIN.length);
  requireTrue(begin >= 0 && end > begin && begin === text.lastIndexOf(INNER_RECEIPT_BEGIN) &&
    end === text.lastIndexOf(INNER_RECEIPT_END), 'inner_output_receipt_sentinel_differs');
  const payload = text.slice(begin + INNER_RECEIPT_BEGIN.length, end).trim();
  requireTrue(payload.startsWith('{') && payload.endsWith('}'), 'inner_output_receipt_json_missing');
  return JSON.parse(payload);
}

function outputPath(value) {
  const resolved = path.resolve(value || FINAL_FILENAME);
  requireTrue(path.basename(resolved) === FINAL_FILENAME, 'output_filename_differs');
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  requireTrue(!fs.existsSync(resolved), 'output_already_exists');
  return resolved;
}

function effectLedgerPath(value, { requireAbsent = false } = {}) {
  const resolved = path.resolve(value || EFFECT_LEDGER_FILENAME);
  requireTrue(path.basename(resolved) === EFFECT_LEDGER_FILENAME, 'effect_ledger_filename_differs');
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const parent = fs.lstatSync(path.dirname(resolved));
  requireTrue(parent.isDirectory() && !parent.isSymbolicLink(),
    'effect_ledger_parent_invalid');
  if (requireAbsent) requireTrue(!fs.existsSync(resolved), 'effect_ledger_already_exists');
  return resolved;
}

export function prepareProviderEffectLedgerTarget(file) {
  return effectLedgerPath(file, { requireAbsent: true });
}

function providerEvidenceFromCalls(calls, { knownEmpty = false } = {}) {
  const frozenCalls = calls.map((row) => ({ ...row }));
  const actualCostMicrousd = frozenCalls.reduce(
    (sum, row) => sum + row.actual_cost_microusd,
    0,
  );
  return {
    partial_provider_calls: frozenCalls,
    partial_provider_request_id_hashes: frozenCalls.map(
      (row) => row.provider_request_id_sha256,
    ),
    partial_provider_usage: {
      usage_complete: frozenCalls.length === PHYSIO_CANARY_MAX_PAID_CALLS,
      calls_succeeded: frozenCalls.length > 0 || knownEmpty ? frozenCalls.length : null,
      actual_cost_microusd: frozenCalls.length > 0 || knownEmpty ? actualCostMicrousd : null,
      last_observed_call_ordinal: frozenCalls.length > 0 ? frozenCalls.length : null,
    },
  };
}

function progressCallFromSuccess(callOrdinal, providerTask, success) {
  try {
    return providerProgressRow(callOrdinal, providerTask, success);
  } catch {
    return null;
  }
}

function providerCallsFromReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return [];
  const successes = [
    ...PHYSIO_CANARY_TASK_IDS.map((taskId) => receipt.tasks?.[taskId]?.success),
    receipt.transcription?.success,
    receipt.extraction?.success,
  ];
  const calls = [];
  for (const [index, success] of successes.entries()) {
    const call = progressCallFromSuccess(
      index + 1,
      PHYSIO_CANARY_PROVIDER_TASK_SET[index],
      success,
    );
    if (!call) break;
    calls.push(call);
  }
  return calls;
}

export function parseProviderProgress(stdout) {
  const rows = [];
  for (const line of String(stdout || '').split(/\r?\n/)) {
    if (!line.startsWith(INNER_PROVIDER_PROGRESS_PREFIX)) continue;
    let parsed;
    try {
      parsed = JSON.parse(line.slice(INNER_PROVIDER_PROGRESS_PREFIX.length));
    } catch {
      requireTrue(false, 'provider_progress_json_invalid');
    }
    exactObjectKeys(parsed, [
      'actual_cost_microusd', 'call_ordinal', 'provider_request_id_sha256',
      'provider_task', 'usage_receipt_sha256',
    ], 'provider_progress_row');
    const expectedOrdinal = rows.length + 1;
    requireTrue(parsed.call_ordinal === expectedOrdinal &&
      parsed.provider_task === PHYSIO_CANARY_PROVIDER_TASK_SET[expectedOrdinal - 1] &&
      SHA256_RE.test(parsed.provider_request_id_sha256 || '') &&
      SHA256_RE.test(parsed.usage_receipt_sha256 || '') &&
      Number.isSafeInteger(parsed.actual_cost_microusd) &&
      parsed.actual_cost_microusd >= 0,
    'provider_progress_row_invalid');
    rows.push(Object.freeze({ ...parsed }));
    requireTrue(rows.length <= PHYSIO_CANARY_MAX_PAID_CALLS,
      'provider_progress_call_bound_exceeded');
  }
  return Object.freeze(rows);
}

function partialProviderEvidence({ receipt = null, progressStdout = '', knownEmpty = false } = {}) {
  const receiptCalls = providerCallsFromReceipt(receipt);
  let progressCalls = [];
  try {
    progressCalls = parseProviderProgress(progressStdout);
  } catch {
    // Malformed or ambiguous child output is never admitted as evidence. A
    // terminal STARTED_UNRESOLVED row is still written with unknown usage.
    return providerEvidenceFromCalls([], { knownEmpty: false });
  }
  const shorter = receiptCalls.length <= progressCalls.length ? receiptCalls : progressCalls;
  const longer = receiptCalls.length > progressCalls.length ? receiptCalls : progressCalls;
  if (shorter.some((row, index) => canonicalJson(row) !== canonicalJson(longer[index]))) {
    return providerEvidenceFromCalls([], { knownEmpty: false });
  }
  return providerEvidenceFromCalls(longer, { knownEmpty });
}

function atomicPublishNewJson(resolved, row) {
  const bytes = Buffer.from(`${JSON.stringify(row, null, 2)}\n`, 'utf8');
  const temporary = `${resolved}.tmp-${process.pid}-${randomUUID()}`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  try {
    // Publishing a hard link to a fully flushed same-directory temporary is
    // atomic and, unlike rename(2), fails if a prior terminal ledger exists.
    fs.linkSync(temporary, resolved);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  if (process.platform !== 'win32') {
    const parentDescriptor = fs.openSync(path.dirname(resolved), fs.constants.O_RDONLY);
    try {
      fs.fsyncSync(parentDescriptor);
    } finally {
      fs.closeSync(parentDescriptor);
    }
  }
  return bytes;
}

export function writeProviderEffectLedger({
  file,
  result,
  providerEffectId,
  startedEffectReceiptSha256,
  applicationSha,
  immutableImage,
  candidateArchiveSha256,
  maximumCostMicrousd,
  receipt = null,
  error = null,
  progressStdout = '',
  knownEmpty = false,
  producerExitCode,
  producerStdout = '',
  producerStderr = '',
}) {
  requireTrue(['STARTED_UNRESOLVED', 'COMPLETED'].includes(result), 'effect_result_invalid');
  requireTrue(SHA256_RE.test(providerEffectId || ''), 'provider_effect_id_invalid');
  requireTrue(RAW_SHA256_RE.test(startedEffectReceiptSha256 || ''),
    'started_effect_receipt_sha256_invalid');
  requireTrue(Number.isSafeInteger(producerExitCode) && producerExitCode >= 0 &&
    producerExitCode <= 255, 'producer_exit_code_invalid');
  const resolved = effectLedgerPath(file, { requireAbsent: true });
  let admittedReceipt = receipt;
  if (result === 'COMPLETED') {
    requireTrue(producerExitCode === 0, 'completed_producer_exit_code_differs');
    admittedReceipt = validatePhysioExactImageCanaryReceipt(receipt, {
      expectedApplicationSha: applicationSha,
      expectedImmutableImage: immutableImage,
      expectedCandidateArchiveSha256: candidateArchiveSha256,
      maximumCostMicrousd,
    });
  } else {
    requireTrue(producerExitCode !== 0, 'unresolved_producer_exit_code_differs');
  }
  const partial = partialProviderEvidence({
    receipt: admittedReceipt,
    progressStdout,
    knownEmpty,
  });
  const row = {
    contract_version: PHYSIO_EXACT_IMAGE_CANARY_EFFECT_CONTRACT,
    result,
    application: PHYSIO_CANARY_APPLICATION,
    application_sha: applicationSha,
    provider_effect_id: providerEffectId,
    candidate_archive_sha256: candidateArchiveSha256,
    local_image_id: immutableImage,
    provider_call_maximum: PHYSIO_CANARY_MAX_PAID_CALLS,
    maximum_cost_microusd: maximumCostMicrousd,
    started_effect_receipt_sha256: startedEffectReceiptSha256,
    partial_provider_calls: partial.partial_provider_calls,
    partial_provider_request_id_hashes: partial.partial_provider_request_id_hashes,
    partial_provider_usage: partial.partial_provider_usage,
    producer_exit_code: producerExitCode,
    producer_stdout_sha256: shaReceipt(producerStdout),
    producer_stderr_sha256: shaReceipt(producerStderr),
    error_receipt_sha256: result === 'STARTED_UNRESOLVED'
      ? shaReceipt(error instanceof Error ? `${error.name}:${error.message}` :
        String(error || 'physio_canary_producer_failed'))
      : null,
    completed_at: new Date().toISOString(),
  };
  validatePhysioCanaryEffectReceipt(row, {
    expectedApplicationSha: applicationSha,
    expectedProviderEffectId: providerEffectId,
    expectedStartedEffectReceiptSha256: startedEffectReceiptSha256,
    expectedImmutableImage: immutableImage,
    expectedCandidateArchiveSha256: candidateArchiveSha256,
    maximumCostMicrousd,
  });
  const expectedBytes = atomicPublishNewJson(resolved, row);
  const readback = readAndValidatePhysioCanaryEffectReceipt(resolved, {
    expectedApplicationSha: applicationSha,
    expectedProviderEffectId: providerEffectId,
    expectedStartedEffectReceiptSha256: startedEffectReceiptSha256,
    expectedImmutableImage: immutableImage,
    expectedCandidateArchiveSha256: candidateArchiveSha256,
    maximumCostMicrousd,
  });
  requireTrue(canonicalJson(readback) === canonicalJson(row) &&
    shaReceipt(fs.readFileSync(resolved)) === shaReceipt(expectedBytes),
  'effect_ledger_readback_differs');
  return readback;
}

async function dockerInspect(docker, kind, identity, { allowAbsent = false } = {}) {
  const result = await runProcess(docker, [kind, 'inspect', identity], {
    timeoutMs: 60_000,
    allowFailure: allowAbsent,
  });
  if (result.code !== 0) return null;
  const payload = JSON.parse(result.stdout);
  requireTrue(Array.isArray(payload) && payload.length === 1, `docker_${kind}_inspect_shape_differs`);
  return payload[0];
}

async function dockerVolumeInventory(docker) {
  const result = await runProcess(docker, ['volume', 'ls', '--quiet'], { timeoutMs: 60_000 });
  return String(result.stdout || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean).sort();
}

export function assertLocalCanaryContainer(container, {
  containerId,
  containerName,
  immutableImage,
  applicationSha,
  candidateArchiveSha256,
  ttlSeconds = PHYSIO_CANARY_TTL_SECONDS,
}) {
  requireTrue(container?.Id === containerId, 'local_container_id_differs');
  requireTrue(container?.Name === `/${containerName}`, 'local_container_name_differs');
  requireTrue(container?.Image === immutableImage, 'local_container_image_differs');
  const labels = container?.Config?.Labels || {};
  requireTrue(labels['assesssuite-canary-role'] === 'physio-exact-image' &&
    labels['assesssuite-release-sha'] === applicationSha &&
    labels['assesssuite-candidate-archive-sha256'] === candidateArchiveSha256,
  'local_container_labels_differ');
  requireTrue(container?.HostConfig?.AutoRemove === true &&
    container?.HostConfig?.Privileged === false &&
    container?.HostConfig?.ReadonlyRootfs === false &&
    container?.HostConfig?.NetworkMode === 'bridge' &&
    container?.HostConfig?.RestartPolicy?.Name === 'no' &&
    (container?.HostConfig?.Binds == null ||
      (Array.isArray(container.HostConfig.Binds) && container.HostConfig.Binds.length === 0)) &&
    Array.isArray(container?.Mounts) && container.Mounts.length === 0 &&
    (container?.HostConfig?.Dns == null ||
      (Array.isArray(container.HostConfig.Dns) && container.HostConfig.Dns.length === 0)) &&
    Object.keys(container?.HostConfig?.PortBindings || {}).length === 0 &&
    arraysEqual(container?.Config?.Cmd, ['sleep', String(ttlSeconds)]),
  'local_container_topology_differs');
  const environment = container?.Config?.Env || [];
  requireTrue(!environment.some((entry) => /^(?:OPENAI_API_KEY|SENTRY_AUTH_TOKEN|SENTRY_DSN|STRIPE_SECRET_KEY|RESEND_API_KEY)=/.test(entry)),
    'local_container_persistent_credential_differs');
  return container;
}

function localCanaryContainerReadback(container) {
  return Object.freeze({
    carrier_id_sha256: shaReceipt(container.Id),
    immutable_image: container.Image,
    deterministic_name_sha256: shaReceipt(container.Name),
    canary_role: container.Config.Labels['assesssuite-canary-role'],
    application_sha: container.Config.Labels['assesssuite-release-sha'],
    candidate_archive_sha256: container.Config.Labels['assesssuite-candidate-archive-sha256'],
    host_port_binding_count: Object.keys(container.HostConfig.PortBindings || {}).length,
    mount_count: container.Mounts.length,
    custom_dns_count: (container.HostConfig.Dns || []).length,
    network_mode: container.HostConfig.NetworkMode,
  });
}

export async function produceLocalPhysioExactImageCanary({
  applicationSha,
  immutableImage,
  candidateArchiveSha256,
  containerName,
  ttlSeconds = PHYSIO_CANARY_TTL_SECONDS,
  providerTaskSet = PHYSIO_CANARY_PROVIDER_TASK_SET,
  maximumCostMicrousd = 3_000_000,
  output,
  docker = process.env.DOCKER_PATH || 'docker',
} = {}) {
  requireTrue(process.env.RUN_PHYSIO_EXACT_IMAGE_CANARY === PHYSIO_EXACT_IMAGE_CANARY_ACK,
    'producer_acknowledgement_missing');
  requireTrue(process.env.ALLOW_PAID_PROVIDER_PROBE === '1', 'producer_paid_probe_not_authorized');
  requireTrue(typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.trim(),
    'provider_credential_missing');
  for (const forbidden of [
    'SENTRY_AUTH_TOKEN', 'SENTRY_DSN', 'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY',
  ]) requireTrue(!process.env[forbidden], `producer_forbidden_${forbidden.toLowerCase()}`);
  requireTrue(RELEASE_SHA_RE.test(applicationSha || ''), 'application_sha_invalid');
  requireTrue(LOCAL_IMAGE_RE.test(immutableImage || ''), 'local_image_id_invalid');
  requireTrue(/^sha256:[0-9a-f]{64}$/.test(candidateArchiveSha256 || ''),
    'candidate_archive_sha256_invalid');
  requireTrue(Number.isSafeInteger(maximumCostMicrousd) && maximumCostMicrousd > 0 &&
    maximumCostMicrousd <= 5_000_000, 'maximum_cost_invalid');
  const expectedContainerName = physioCanaryContainerName(applicationSha);
  const exactContainerName = containerName || expectedContainerName;
  requireTrue(exactContainerName === expectedContainerName, 'container_name_differs_from_release_sha');
  requireTrue(ttlSeconds === PHYSIO_CANARY_TTL_SECONDS, 'ttl_seconds_differs');
  assertPhysioCanaryProviderTaskMapping(providerTaskSet);
  readAndValidatePhysioCanaryAudioFixture(REPO_ROOT);
  const finalPath = outputPath(output);

  const image = await dockerInspect(docker, 'image', immutableImage);
  requireTrue(image?.Id === immutableImage, 'loaded_local_image_id_differs');
  const initialVolumeInventory = await dockerVolumeInventory(docker);
  let priorCarrierReconciled = false;
  let priorCarrierAdmissionReadbackSha256 = shaReceipt(canonicalJson({
    deterministic_container_name_absent: true,
  }));
  const existing = await dockerInspect(docker, 'container', exactContainerName, { allowAbsent: true });
  if (existing) {
    // A retry may encounter the exact prior carrier when `docker run`
    // committed but its response was lost. Reconcile only the fully admitted
    // immutable-image/name/label/topology identity; an arbitrary same-name or
    // replacement container is never a cleanup target.
    const prior = assertLocalCanaryContainer(existing, {
      containerId: existing.Id,
      containerName: exactContainerName,
      immutableImage,
      applicationSha,
      candidateArchiveSha256,
      ttlSeconds,
    });
    priorCarrierAdmissionReadbackSha256 = shaReceipt(canonicalJson(
      localCanaryContainerReadback(prior),
    ));
    const removed = await runProcess(docker, ['rm', '--force', existing.Id], {
      timeoutMs: 60_000,
      allowFailure: true,
    });
    requireTrue(removed.code === 0 &&
      (await dockerInspect(docker, 'container', existing.Id, { allowAbsent: true })) === null &&
      (await dockerInspect(docker, 'container', exactContainerName, { allowAbsent: true })) === null,
    'prior_local_container_reconciliation_failed');
    priorCarrierReconciled = true;
  }
  let containerId = null;
  let innerReceipt = null;
  let topologyVerified = false;
  let destroyed = false;
  let carrierPreDestroyReadbackSha256 = shaReceipt(canonicalJson({
    captured_carrier_absent_before_cleanup: true,
  }));
  let carrierPostDestroyReadbackSha256 = null;
  let executionError = null;
  try {
    // Exact local equivalent of `docker run --detach --rm`: no host service,
    // bind mount, Docker volume, custom DNS or production-provider resource.
    try {
      const created = await runProcess(docker, [
        'run', '--detach', '--rm', '--name', exactContainerName,
        '--label', 'assesssuite-canary-role=physio-exact-image',
        '--label', `assesssuite-release-sha=${applicationSha}`,
        '--label', `assesssuite-candidate-archive-sha256=${candidateArchiveSha256}`,
        '--network', 'bridge',
        '--restart', 'no',
        immutableImage, 'sleep', String(ttlSeconds),
      ], { timeoutMs: 90_000 });
      containerId = created.stdout.trim();
    } catch (createError) {
      // A provider response loss is ambiguous until the deterministic name is
      // read back. Capture and clean only an exact carrier created from this
      // candidate; otherwise preserve the original failure.
      const uncertain = await dockerInspect(docker, 'container', exactContainerName, {
        allowAbsent: true,
      });
      if (!uncertain) throw createError;
      containerId = uncertain.Id;
      assertLocalCanaryContainer(uncertain, {
        containerId,
        containerName: exactContainerName,
        immutableImage,
        applicationSha,
        candidateArchiveSha256,
        ttlSeconds,
      });
    }
    requireTrue(CARRIER_ID_RE.test(containerId || ''), 'created_local_container_not_found');
    const admitted = assertLocalCanaryContainer(
      await dockerInspect(docker, 'container', containerId),
      {
        containerId,
        containerName: exactContainerName,
        immutableImage,
        applicationSha,
        candidateArchiveSha256,
        ttlSeconds,
      },
    );
    requireTrue(admitted?.State?.Running === true, 'local_container_not_running_at_admission');
    topologyVerified = true;
    const fixturePath = `/app/${PHYSIO_CANARY_AUDIO_RELATIVE_PATH.replaceAll('\\', '/')}`;
    const copiedHash = await runProcess(docker, [
      'exec', containerId, 'sha256sum', fixturePath,
    ], { timeoutMs: 60_000 });
    requireTrue(copiedHash.stdout.trim().startsWith(PHYSIO_CANARY_AUDIO_SHA256),
      'audio_fixture_inside_image_differs');
    const environment = [
      'OPENAI_API_KEY',
      'NODE_ENV=production',
      'SELFTEST=0',
      'PARITY_ASSURANCE_MODE=0',
      'PHYSIO_EXACT_IMAGE_CANARY_MODE=1',
      `PROFESSION=${PHYSIO_CANARY_PROFESSION_ID}`,
      `DEFAULT_APP_ID=${PHYSIO_CANARY_APP_ID}`,
      `RELEASE_SHA=${applicationSha}`,
      `PHYSIO_CANARY_APPLICATION_SHA=${applicationSha}`,
      `PHYSIO_CANARY_IMMUTABLE_IMAGE=${immutableImage}`,
      `PHYSIO_CANARY_CANDIDATE_ARCHIVE_SHA256=${candidateArchiveSha256}`,
      `PHYSIO_CANARY_CARRIER_ID=${containerId}`,
      `PHYSIO_CANARY_CONTAINER_NAME=${exactContainerName}`,
      `PHYSIO_CANARY_TTL_SECONDS=${ttlSeconds}`,
      `PHYSIO_CANARY_PROVIDER_TASK_SET=${providerTaskSet.join(',')}`,
      `RUN_PHYSIO_EXACT_IMAGE_CANARY=${PHYSIO_EXACT_IMAGE_CANARY_ACK}`,
      'ALLOW_PAID_PROVIDER_PROBE=1',
      `PHYSIO_CANARY_MAX_COST_MICROUSD=${maximumCostMicrousd}`,
      'LLM_REQUIRED=1',
      'GENERAL_CLINICAL_LLM_ENABLED=0',
      'TRANSCRIPTION_ENABLED=1',
      'DOCUMENT_EXTRACTION_ENABLED=1',
      'DOCUMENT_EXTRACTION_UNDER_13_ENABLED=0',
      'OPENAI_HEALTH_DATA_TERMS_CONFIRMED=1',
      `OPENAI_MODEL_FAST=${PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS[0]}`,
      `OPENAI_MODEL_QUALITY=${PHYSIO_CANARY_TEXT_MODEL_SNAPSHOTS[1]}`,
      `OPENAI_TRANSCRIBE_MODEL=${PHYSIO_CANARY_TRANSCRIPTION_MODEL}`,
      `PHYSIO_CANARY_AUDIO_PATH=${fixturePath}`,
      `PHYSIO_CANARY_EXPECTED_TRANSCRIPT_MARKER=${PHYSIO_CANARY_AUDIO_EXPECTED_MARKER}`,
      `PHYSIO_CANARY_AUDIO_SHA256=${PHYSIO_CANARY_AUDIO_SHA256}`,
      'OUTBOUND_EMAIL_ENABLED=0',
      'OUTBOUND_SMS_ENABLED=0',
      'PAYMENTS_ENABLED=0',
      'ALLOW_OPEN_REGISTRATION=1',
      `APP_URL=${PHYSIO_PUBLIC_APP_URL}`,
      `EXPECTED_APP_URL=${PHYSIO_PUBLIC_APP_URL}`,
      `UPLOADS_DIR=${PHYSIO_CANARY_UPLOADS_DIR}`,
    ];
    const executed = await runProcess(docker, [
      'exec', ...environment.flatMap((value) => ['--env', value]),
      containerId, 'node', '/app/scripts/physio-exact-image-canary.mjs', 'run-inside',
    ], { timeoutMs: (INNER_EXEC_TIMEOUT_SECONDS + 30) * 1_000 });
    innerReceipt = parseInnerReceipt(executed.stdout);
    requireTrue(innerReceipt.application_sha === applicationSha &&
      innerReceipt.immutable_image === immutableImage &&
      innerReceipt.candidate_archive_sha256 === candidateArchiveSha256 &&
      innerReceipt.carrier_type === 'local-docker' &&
      innerReceipt.carrier_id_sha256 === shaReceipt(containerId), 'inner_identity_differs');
  } catch (error) {
    executionError = error;
  } finally {
    try {
      if (containerId) {
        const captured = await dockerInspect(docker, 'container', containerId, { allowAbsent: true });
        const sameName = await dockerInspect(docker, 'container', exactContainerName, { allowAbsent: true });
        requireTrue(!sameName || sameName.Id === containerId, 'same_name_replacement_container_detected');
        if (captured) {
          const admittedForCleanup = assertLocalCanaryContainer(captured, {
            containerId,
            containerName: exactContainerName,
            immutableImage,
            applicationSha,
            candidateArchiveSha256,
            ttlSeconds,
          });
          carrierPreDestroyReadbackSha256 = shaReceipt(canonicalJson(
            localCanaryContainerReadback(admittedForCleanup),
          ));
          const removed = await runProcess(docker, ['rm', '--force', containerId], {
            timeoutMs: 60_000,
            allowFailure: true,
          });
          requireTrue(removed.code === 0, 'local_container_destroy_failed');
        }
        destroyed = (await dockerInspect(docker, 'container', containerId, { allowAbsent: true })) === null &&
          (await dockerInspect(docker, 'container', exactContainerName, { allowAbsent: true })) === null;
        carrierPostDestroyReadbackSha256 = shaReceipt(canonicalJson({
          captured_carrier_absent: (await dockerInspect(
            docker, 'container', containerId, { allowAbsent: true },
          )) === null,
          deterministic_container_name_absent: (await dockerInspect(
            docker, 'container', exactContainerName, { allowAbsent: true },
          )) === null,
          remaining_exact_namespace_container_count: destroyed ? 0 : 1,
        }));
      }
    } catch (cleanupError) {
      // Preserve the primary execution error and its content-free progress
      // stream. Cleanup ambiguity still forces STARTED_UNRESOLVED.
      if (!executionError) executionError = cleanupError;
    }
  }
  if (executionError) {
    if (innerReceipt && !executionError.physioCanaryReceipt) {
      Object.defineProperty(executionError, 'physioCanaryReceipt', { value: innerReceipt });
    }
    throw executionError;
  }
  try {
    requireTrue(innerReceipt && topologyVerified && destroyed, 'local_carrier_cleanup_incomplete');
    requireTrue(arraysEqual(await dockerVolumeInventory(docker), initialVolumeInventory),
      'docker_volume_inventory_changed');
    const receipt = {
      ...innerReceipt,
      isolated_candidate_image_verified: true,
      prior_carrier_reconciled: priorCarrierReconciled,
      prior_carrier_admission_readback_sha256: priorCarrierAdmissionReadbackSha256,
      carrier_pre_destroy_readback_sha256: carrierPreDestroyReadbackSha256,
      carrier_post_destroy_readback_sha256: carrierPostDestroyReadbackSha256,
      remaining_exact_namespace_container_count: 0,
      disposable_container_destroyed: true,
      host_port_binding_count: 0,
      mount_count: 0,
      custom_dns_count: 0,
      network_mode: 'bridge',
      docker_volume_inventory_unchanged: true,
    };
    validatePhysioExactImageCanaryReceipt(receipt, {
      expectedApplicationSha: applicationSha,
      expectedImmutableImage: immutableImage,
      expectedCandidateArchiveSha256: candidateArchiveSha256,
      maximumCostMicrousd,
    });
    fs.writeFileSync(finalPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    return { output: finalPath, receipt };
  } catch (error) {
    if (innerReceipt && !error.physioCanaryReceipt) {
      Object.defineProperty(error, 'physioCanaryReceipt', { value: innerReceipt });
    }
    throw error;
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'run-inside') {
    const receipt = await runInsideCanary();
    process.stdout.write(`${INNER_RECEIPT_BEGIN}\n${JSON.stringify(receipt)}\n${INNER_RECEIPT_END}\n`);
    return;
  }
  if (mode !== 'produce-local') throw new Error('expected produce-local or run-inside subcommand');
  const maximumCostRaw = argument('--maximum-cost-microusd');
  const effectLedger = argument('--effect-ledger');
  const providerEffectId = argument('--provider-effect-id');
  const startedEffectReceiptSha256 = argument('--started-effect-receipt-sha256');
  const options = {
    applicationSha: argument('--application-sha'),
    immutableImage: argument('--immutable-image'),
    candidateArchiveSha256: argument('--candidate-archive-sha256'),
    containerName: argument('--container-name'),
    ttlSeconds: argument('--ttl-seconds') === undefined
      ? PHYSIO_CANARY_TTL_SECONDS
      : Number(argument('--ttl-seconds')),
    providerTaskSet: argument('--provider-task-set') === undefined
      ? PHYSIO_CANARY_PROVIDER_TASK_SET
      : String(argument('--provider-task-set')).split(',').filter(Boolean),
    maximumCostMicrousd: maximumCostRaw === undefined ? 3_000_000 : Number(maximumCostRaw),
    output: argument('--output'),
    docker: argument('--docker') || process.env.DOCKER_PATH || 'docker',
  };
  requireTrue(effectLedger && providerEffectId && startedEffectReceiptSha256,
    'provider_effect_ledger_arguments_missing');
  requireTrue(SHA256_RE.test(providerEffectId), 'provider_effect_id_invalid');
  requireTrue(RAW_SHA256_RE.test(startedEffectReceiptSha256),
    'started_effect_receipt_sha256_invalid');
  prepareProviderEffectLedgerTarget(effectLedger);

  let result;
  let producerError = null;
  let producerExitCode = 0;
  let producerStdout = '';
  let producerStderr = '';
  try {
    result = await produceLocalPhysioExactImageCanary(options);
  } catch (error) {
    producerError = error;
    producerExitCode = 1;
  }

  if (!producerError) {
    // The producer may print only the artifact path and SHA-256; no receipt
    // body or provider content is echoed into general workflow logs.
    producerStdout = `${JSON.stringify({
      artifact: result.output,
      sha256: sha256(fs.readFileSync(result.output)),
    })}\n`;
  } else {
    const errorCode = /^physio_canary_[a-z0-9_]{1,160}$/.test(producerError?.message || '')
      ? producerError.message
      : 'physio_canary_producer_failed';
    producerStderr = `Physio exact-image canary producer failed: ${errorCode}\n`;
  }

  const ledgerArguments = {
    file: effectLedger,
    providerEffectId,
    startedEffectReceiptSha256,
    applicationSha: options.applicationSha,
    immutableImage: options.immutableImage,
    candidateArchiveSha256: options.candidateArchiveSha256,
    maximumCostMicrousd: options.maximumCostMicrousd,
    receipt: result?.receipt || producerError?.physioCanaryReceipt || null,
    error: producerError || producerStderr,
    progressStdout: producerError?.physioProcessStdout || '',
    producerExitCode,
    producerStdout,
    producerStderr,
  };

  try {
    writeProviderEffectLedger({
      ...ledgerArguments,
      result: producerError ? 'STARTED_UNRESOLVED' : 'COMPLETED',
    });
  } catch (ledgerError) {
    if (!producerError && !fs.existsSync(path.resolve(effectLedger))) {
      // A full canary that cannot satisfy the terminal COMPLETED contract is
      // still an ambiguous paid effect. Convert it exactly once before any
      // stdout/stderr bytes are emitted.
      producerError = ledgerError;
      producerExitCode = 1;
      producerStdout = '';
      const errorCode = /^physio_canary_[a-z0-9_]{1,160}$/.test(ledgerError?.message || '')
        ? ledgerError.message
        : 'physio_canary_terminal_validation_failed';
      producerStderr = `Physio exact-image canary producer failed: ${errorCode}\n`;
      writeProviderEffectLedger({
        ...ledgerArguments,
        result: 'STARTED_UNRESOLVED',
        error: ledgerError,
        producerExitCode,
        producerStdout,
        producerStderr,
      });
    } else {
      throw ledgerError;
    }
  }

  if (producerStdout) process.stdout.write(producerStdout);
  if (producerStderr) process.stderr.write(producerStderr);
  process.exitCode = producerExitCode;
}

function isMainModule() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isMainModule()) {
  try {
    await main();
  } catch (error) {
    // Preflight/ledger-publication failures occur before provider replay or
    // preserve an existing no-overwrite ledger. Keep their outer process
    // failure deterministic and content-free as well.
    process.stdout.write('');
    process.stderr.write('Physio exact-image canary producer failed: physio_canary_control_failure\n');
    process.exitCode = 1;
  }
}
