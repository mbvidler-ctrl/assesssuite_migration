#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  validateCompletedStripeWebhookPacket,
  validateStripeWebhookCompensationPacket,
} from './physio-stripe-webhook-evidence.mjs';

export const WEBHOOK_LEDGER_BRANCH = 'assesssuite-physio-webhook-ledger';
export const WEBHOOK_LEDGER_GENESIS_CONTRACT =
  'assesssuite-physio-webhook-ledger-genesis/2.0.0';
export const WEBHOOK_LEDGER_PROVISIONING_CONTRACT =
  'assesssuite-physio-webhook-ledger-ruleset-provisioning/2.0.0';
export const WEBHOOK_LEDGER_RECORD_CONTRACT =
  'assesssuite-physio-webhook-ledger-record/2.0.0';
export const WEBHOOK_LEDGER_PACKET_CONTRACT =
  'assesssuite-physio-webhook-ledger-packet/1.0.0';
export const WEBHOOK_LEDGER_RECEIPT_CONTRACT =
  'assesssuite-physio-webhook-ledger-receipt/1.0.0';

const ZERO_SHA256 = '0'.repeat(64);
const SHA40 = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const ARTIFACT_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const MAX_PACKET_BYTES = 32 * 1024 * 1024;
const MAX_RECORD_BYTES = 48 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const MAX_LEDGER_COMMITS = 20_000;
const MAX_DECODED_SCAN_BYTES = 16 * 1024 * 1024;
const MAX_DECODED_TOKEN_BYTES = 2 * 1024 * 1024;
const MAX_DECODE_CANDIDATES = 4_096;
const MAX_DECODE_DEPTH = 4;
const MAX_BUNDLE_CORPUS_ENTRIES = 8_192;
const MAX_DISTRIBUTED_SECRET_CHARACTERS = 1_024;
const MAX_DISTRIBUTED_SEARCH_STATES = 16_384;
const MIN_DISTRIBUTED_SECRET_FRAGMENT = 4;
const UTF8 = new TextDecoder('utf-8', { fatal: true });
const PACKET_FILE_NAME = /^(?:SHA256SUMS|[A-Za-z0-9][A-Za-z0-9._-]{0,194}\.json)$/u;
const FORBIDDEN_VALUE = /(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]+|whsec_[A-Za-z0-9_-]+|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9]{20,}|(?:github_pat_|gh[pousr]_)[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._~+\/-]+|Authorization\s*:\s*Basic\s+[A-Za-z0-9+/=]+|-----BEGIN [A-Z ]+PRIVATE KEY-----|(?:AKIA|ASIA)[A-Z0-9]{16}/iu;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const FORBIDDEN_KEY = /^(?:secret|raw_secret|raw_value|client_secret|api_key|authorization|password|cvc|cvv|card_number|email)$/iu;
const LIFECYCLE_KINDS = new Set(['COMPLETED', 'COMPENSATION']);
const LEDGER_RULESET_NAME = 'Protect AssessSuite Physio webhook ledger';
const LEDGER_GENESIS_PATH = '.ledger/genesis.json';
const LEDGER_GENESIS_MESSAGE = 'AssessSuite Physio webhook ledger genesis';
const LEDGER_PROVISIONING_PATH = '.ledger/provisioning.json';
const LEDGER_PROVISIONING_MESSAGE = 'Bind AssessSuite Physio webhook ledger provisioning receipt';

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

function exactKeys(value, expected, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(code, `${label} exact keys differ`);
  }
}

function assertString(value, pattern, code, label) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(code, `${label} differs`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function gitBlobSha(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

function assertNoLinkedPath(inputPath, { allowMissingLeaf = false } = {}) {
  const absolute = path.resolve(inputPath);
  const parsed = path.parse(absolute);
  let cursor = parsed.root;
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (let index = 0; index < segments.length; index += 1) {
    cursor = path.join(cursor, segments[index]);
    if (allowMissingLeaf && index === segments.length - 1 && !fs.existsSync(cursor)) break;
    let stat;
    try { stat = fs.lstatSync(cursor); } catch { fail('WEBHOOK_LEDGER_FILE_INVALID', cursor); }
    if (stat.isSymbolicLink()) fail('WEBHOOK_LEDGER_PACKET_LINK_REJECTED', cursor);
  }
  return absolute;
}

function readStableRegularFile(filePath, maximumBytes = MAX_PACKET_BYTES) {
  const absolute = assertNoLinkedPath(filePath);
  const before = fs.lstatSync(absolute);
  if (!before.isFile() || before.isSymbolicLink() || before.size > maximumBytes) {
    fail('WEBHOOK_LEDGER_FILE_INVALID', absolute);
  }
  let descriptor;
  try {
    descriptor = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || !sameFileIdentity(before, opened) || opened.size > maximumBytes) {
      fail('WEBHOOK_LEDGER_PACKET_RACE_REJECTED', absolute);
    }
    const first = Buffer.alloc(opened.size);
    const second = Buffer.alloc(opened.size);
    if (fs.readSync(descriptor, first, 0, first.length, 0) !== first.length ||
        fs.readSync(descriptor, second, 0, second.length, 0) !== second.length || !first.equals(second)) {
      fail('WEBHOOK_LEDGER_PACKET_RACE_REJECTED', absolute);
    }
    const afterRead = fs.fstatSync(descriptor);
    const afterPath = fs.lstatSync(absolute);
    if (!sameFileIdentity(opened, afterRead) || !sameFileIdentity(opened, afterPath) ||
        afterPath.isSymbolicLink()) fail('WEBHOOK_LEDGER_PACKET_RACE_REJECTED', absolute);
    return first;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function canonicalProviderJson(value) {
  const sort = (entry) => {
    if (Array.isArray(entry)) return entry.map(sort);
    if (entry && typeof entry === 'object') {
      return Object.fromEntries(Object.keys(entry).sort().map((key) => [key, sort(entry[key])]));
    }
    return entry;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

function safeTimestamp(value, label) {
  assertString(value, ISO, 'WEBHOOK_LEDGER_TIMESTAMP_INVALID', label);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed > Date.now() + 5 * 60_000) {
    fail('WEBHOOK_LEDGER_TIMESTAMP_INVALID', label);
  }
}

function decodeUtf8(bytes) {
  try {
    return UTF8.decode(bytes);
  } catch {
    return null;
  }
}

function assertNoBinaryContainer(bytes, label) {
  const signatures = [
    Buffer.from([0x1f, 0x8b]),
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]),
    Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]),
  ];
  if (signatures.some((signature) => bytes.subarray(0, signature.length).equals(signature))) {
    fail('WEBHOOK_LEDGER_BINARY_REJECTED', label);
  }
  const text = decodeUtf8(bytes);
  if (text === null || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text)) {
    fail('WEBHOOK_LEDGER_BINARY_REJECTED', label);
  }
  return text;
}

function decodePercentRuns(value) {
  if (!/%[0-9a-f]{2}/iu.test(value)) return null;
  try {
    const decoded = decodeURIComponent(value);
    return decoded === value ? null : decoded;
  } catch {
    return null;
  }
}

function decodeBase64Candidate(value) {
  if (value.length < 16 || value.length > MAX_DECODED_TOKEN_BYTES * 2 ||
      /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/iu.test(value)) return null;
  const withoutPadding = value.replace(/=+$/u, '');
  if (withoutPadding.length % 4 === 1 || /={3,}$/u.test(value) || /=[^=]/u.test(value)) return null;
  const urlSafe = /[-_]/u.test(withoutPadding);
  if ((urlSafe && /[+/]/u.test(withoutPadding)) ||
      (!urlSafe && !/^[A-Za-z0-9+/]+$/u.test(withoutPadding)) ||
      (urlSafe && !/^[A-Za-z0-9_-]+$/u.test(withoutPadding))) return null;
  const padded = `${withoutPadding}${'='.repeat((4 - (withoutPadding.length % 4)) % 4)}`;
  let bytes;
  try {
    bytes = Buffer.from(padded, urlSafe ? 'base64url' : 'base64');
  } catch {
    return null;
  }
  const canonicalPadded = urlSafe
    ? bytes.toString('base64').replace(/\+/gu, '-').replace(/\//gu, '_')
    : bytes.toString('base64');
  const canonicalUnpadded = canonicalPadded.replace(/=+$/u, '');
  return canonicalUnpadded === withoutPadding ? bytes : null;
}

function scanTextValue(value, label, exactSecrets, state, depth = 0) {
  if (depth > MAX_DECODE_DEPTH) fail('WEBHOOK_LEDGER_DECODE_BOUNDS_EXCEEDED', label);
  const normalized = value.normalize('NFKC');
  const compact = normalized.replace(/[\s\p{Cf}]+/gu, '');
  for (const candidate of new Set([normalized, compact])) {
    if (FORBIDDEN_VALUE.test(candidate) || EMAIL_VALUE.test(candidate) ||
        exactSecrets.some((secret) => candidate.includes(secret) ||
          compact.includes(secret.normalize('NFKC').replace(/[\s\p{Cf}]+/gu, '')))) {
      fail('WEBHOOK_LEDGER_SECRET_REJECTED', label);
    }
  }
  const percentDecoded = decodePercentRuns(normalized);
  const tokens = compact.match(/[A-Za-z0-9+/_-]{16,}={0,2}/gu) || [];
  const decodedTokens = [];
  for (const token of tokens) {
    if (token.length > MAX_DECODED_TOKEN_BYTES * 2) {
      fail('WEBHOOK_LEDGER_DECODE_BOUNDS_EXCEEDED', label);
    }
    const bytes = decodeBase64Candidate(token);
    if (bytes !== null) decodedTokens.push(bytes);
  }
  if (depth === MAX_DECODE_DEPTH) {
    if (percentDecoded !== null || decodedTokens.length > 0) {
      fail('WEBHOOK_LEDGER_DECODE_DEPTH_EXCEEDED', label);
    }
    return;
  }
  if (percentDecoded !== null) {
    state.candidates += 1;
    state.decodedBytes += Buffer.byteLength(percentDecoded);
    if (state.candidates > MAX_DECODE_CANDIDATES || state.decodedBytes > MAX_DECODED_SCAN_BYTES) {
      fail('WEBHOOK_LEDGER_DECODE_BOUNDS_EXCEEDED', label);
    }
    scanTextValue(percentDecoded, `${label}:percent`, exactSecrets, state, depth + 1);
  }
  for (const bytes of decodedTokens) {
    state.candidates += 1;
    state.decodedBytes += bytes.length;
    if (bytes.length > MAX_DECODED_TOKEN_BYTES || state.candidates > MAX_DECODE_CANDIDATES ||
        state.decodedBytes > MAX_DECODED_SCAN_BYTES) {
      fail('WEBHOOK_LEDGER_DECODE_BOUNDS_EXCEEDED', label);
    }
    const decoded = decodeUtf8(bytes);
    if (decoded !== null) scanTextValue(decoded, `${label}:base64`, exactSecrets, state, depth + 1);
  }
}

function scanJsonValue(value, label, exactSecrets, state, scalars, corpus, depth = 0) {
  if (depth > 40) fail('WEBHOOK_LEDGER_SECRET_REJECTED', `${label} nesting`);
  if (typeof value === 'string') {
    scalars.push(value);
    corpus.push({ source: label, value });
    scanTextValue(value, label, exactSecrets, state);
    return;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      scanJsonValue(value[index], `${label}[${index}]`, exactSecrets, state, scalars, corpus, depth + 1);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key)) fail('WEBHOOK_LEDGER_SECRET_REJECTED', `${label}.${key}`);
      corpus.push({ source: `${label}:key:${key}`, value: key });
      scanTextValue(key, `${label}:key`, exactSecrets, state);
      scanJsonValue(child, `${label}.${key}`, exactSecrets, state, scalars, corpus, depth + 1);
    }
  }
}

function normalizedCorpusValues(value) {
  const normalized = [...new Set([value, value.normalize('NFC'), value.normalize('NFKC')])];
  return [...new Set([...normalized,
    ...normalized.map((candidate) => candidate.replace(/[\s\p{Cf}]+/gu, ''))])];
}

function scanDistributedExactSecrets(corpus, exactSecrets) {
  if (corpus.length > MAX_BUNDLE_CORPUS_ENTRIES) {
    fail('WEBHOOK_LEDGER_DECODE_BOUNDS_EXCEEDED', 'packet corpus');
  }
  const sources = corpus.map(({ source, value }) => ({ source, values: normalizedCorpusValues(value) }));
  for (const exactSecret of exactSecrets) {
    for (const secret of normalizedCorpusValues(exactSecret)) {
      if (secret.length < MIN_DISTRIBUTED_SECRET_FRAGMENT * 2) continue;
      if (secret.length > MAX_DISTRIBUTED_SECRET_CHARACTERS) {
        fail('WEBHOOK_LEDGER_SECRET_SCAN_INPUT_BOUNDS_EXCEEDED', 'exact secret');
      }
      let states = 0;
      const memo = new Map();
      const search = (position, usedSources) => {
        if (position === secret.length) return usedSources.size >= 2;
        if (secret.length - position < MIN_DISTRIBUTED_SECRET_FRAGMENT) return false;
        const key = `${position}:${[...usedSources].sort().join(',')}`;
        if (memo.has(key)) return memo.get(key);
        states += 1;
        if (states > MAX_DISTRIBUTED_SEARCH_STATES) {
          fail('WEBHOOK_LEDGER_DISTRIBUTED_SCAN_BOUNDS_EXCEEDED', 'packet corpus');
        }
        const shortest = secret.slice(position, position + MIN_DISTRIBUTED_SECRET_FRAGMENT);
        for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
          if (usedSources.has(sourceIndex) ||
              !sources[sourceIndex].values.some((candidate) => candidate.includes(shortest))) continue;
          for (let end = secret.length; end >= position + MIN_DISTRIBUTED_SECRET_FRAGMENT; end -= 1) {
            if (end < secret.length && secret.length - end < MIN_DISTRIBUTED_SECRET_FRAGMENT) continue;
            const fragment = secret.slice(position, end);
            if (!sources[sourceIndex].values.some((candidate) => candidate.includes(fragment))) continue;
            const nextUsed = new Set(usedSources);
            nextUsed.add(sourceIndex);
            if (search(end, nextUsed)) {
              memo.set(key, true);
              return true;
            }
          }
        }
        memo.set(key, false);
        return false;
      };
      if (search(0, new Set())) {
        fail('WEBHOOK_LEDGER_DISTRIBUTED_SECRET_REJECTED', 'packet corpus');
      }
    }
  }
}

function validatePacketBundle(packet, exactSecrets = []) {
  exactKeys(packet, ['contract_version', 'files', 'total_size_bytes'],
    'WEBHOOK_LEDGER_PACKET_INVALID', 'packet');
  if (packet.contract_version !== WEBHOOK_LEDGER_PACKET_CONTRACT ||
      !Number.isSafeInteger(packet.total_size_bytes) || packet.total_size_bytes < 1 ||
      packet.total_size_bytes > MAX_PACKET_BYTES || !Array.isArray(packet.files) ||
      packet.files.length < 2 || packet.files.length > 512) {
    fail('WEBHOOK_LEDGER_PACKET_INVALID', 'envelope');
  }
  const names = [];
  const bytesByName = new Map();
  const caseFoldedNames = new Set();
  const scalarStrings = [];
  const corpus = [];
  const scanState = { candidates: 0, decodedBytes: 0 };
  const forbiddenExact = exactSecrets.filter((value) => typeof value === 'string' && value.length > 0);
  let total = 0;
  for (const file of packet.files) {
    exactKeys(file, ['content_base64', 'name', 'sha256', 'size_bytes'],
      'WEBHOOK_LEDGER_PACKET_INVALID', 'packet file');
    assertString(file.name, PACKET_FILE_NAME, 'WEBHOOK_LEDGER_PACKET_INVALID', 'packet file name');
    assertString(file.sha256, SHA256, 'WEBHOOK_LEDGER_PACKET_INVALID', `${file.name} SHA`);
    if (!Number.isSafeInteger(file.size_bytes) || file.size_bytes < 0 ||
        file.size_bytes > MAX_PACKET_BYTES || typeof file.content_base64 !== 'string') {
      fail('WEBHOOK_LEDGER_PACKET_INVALID', file.name);
    }
    const bytes = Buffer.from(file.content_base64, 'base64');
    if (bytes.toString('base64') !== file.content_base64 || bytes.length !== file.size_bytes ||
        sha256(bytes) !== file.sha256) fail('WEBHOOK_LEDGER_PACKET_TAMPERED', file.name);
    const foldedName = file.name.toLowerCase();
    if (caseFoldedNames.has(foldedName) ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(file.name)) {
      fail('WEBHOOK_LEDGER_PACKET_INVALID', 'portable inventory');
    }
    caseFoldedNames.add(foldedName);
    const text = assertNoBinaryContainer(bytes, file.name);
    corpus.push({ source: `${file.name}:name`, value: file.name });
    corpus.push({ source: `${file.name}:raw`, value: text });
    scanTextValue(file.name, `${file.name}:name`, forbiddenExact, scanState);
    scanTextValue(text, file.name, forbiddenExact, scanState);
    if (file.name.endsWith('.json')) {
      let value;
      try { value = JSON.parse(text); } catch { fail('WEBHOOK_LEDGER_PACKET_INVALID', `${file.name} JSON`); }
      scanJsonValue(value, file.name, forbiddenExact, scanState, scalarStrings, corpus);
    }
    names.push(file.name);
    bytesByName.set(file.name, bytes);
    total += bytes.length;
  }
  if (new Set(names).size !== names.length || JSON.stringify(names) !== JSON.stringify([...names].sort()) ||
      total !== packet.total_size_bytes || !bytesByName.has('SHA256SUMS')) {
    fail('WEBHOOK_LEDGER_PACKET_INVALID', 'inventory');
  }
  const sumsBytes = bytesByName.get('SHA256SUMS');
  const sumsText = sumsBytes.toString('utf8');
  const sums = sumsText.endsWith('\n') ? sumsText.slice(0, -1).split('\n') : [];
  const expectedNames = names.filter((name) => name !== 'SHA256SUMS');
  const observedNames = [];
  for (const line of sums) {
    const match = line.match(/^([0-9a-f]{64}) {2}([A-Za-z0-9][A-Za-z0-9._-]{0,199})$/u);
    if (!match || match[2] === 'SHA256SUMS' || !bytesByName.has(match[2]) ||
        sha256(bytesByName.get(match[2])) !== match[1]) {
      fail('WEBHOOK_LEDGER_PACKET_SUMS_INVALID', line);
    }
    observedNames.push(match[2]);
  }
  if (JSON.stringify(observedNames) !== JSON.stringify(expectedNames)) {
    fail('WEBHOOK_LEDGER_PACKET_SUMS_INVALID', 'inventory');
  }
  const canonicalSums = `${expectedNames.map((name) => `${sha256(bytesByName.get(name))}  ${name}`).join('\n')}\n`;
  if (!sumsBytes.equals(Buffer.from(canonicalSums))) {
    fail('WEBHOOK_LEDGER_PACKET_SUMS_INVALID', 'canonical bytes');
  }
  for (let start = 0; start < scalarStrings.length; start += 1) {
    let joined = '';
    let containsShortFragment = false;
    for (let end = start; end < Math.min(scalarStrings.length, start + 4); end += 1) {
      const fragment = scalarStrings[end];
      joined += fragment;
      containsShortFragment ||= fragment.length < 16;
      if (joined.length > 512) break;
      if (end > start && containsShortFragment) {
        scanTextValue(joined, `packet scalar fragments ${start}-${end}`, forbiddenExact, scanState);
      }
    }
  }
  scanDistributedExactSecrets(corpus, forbiddenExact);
  return bytesByName;
}

export function buildWebhookPacketBundle(packetDirectory, exactSecrets = []) {
  const absolutePacketDirectory = assertNoLinkedPath(packetDirectory);
  const rootStat = fs.lstatSync(absolutePacketDirectory);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    fail('WEBHOOK_LEDGER_PACKET_INVALID', 'root');
  }
  if (fs.realpathSync.native(absolutePacketDirectory) !== absolutePacketDirectory) {
    fail('WEBHOOK_LEDGER_PACKET_LINK_REJECTED', absolutePacketDirectory);
  }
  const names = fs.readdirSync(absolutePacketDirectory).sort();
  const files = [];
  let total = 0;
  for (const name of names) {
    assertString(name, PACKET_FILE_NAME, 'WEBHOOK_LEDGER_PACKET_INVALID', 'file name');
    const filePath = path.join(absolutePacketDirectory, name);
    const bytes = readStableRegularFile(filePath);
    total += bytes.length;
    if (total > MAX_PACKET_BYTES) fail('WEBHOOK_LEDGER_PACKET_OVERSIZE', packetDirectory);
    files.push({ name, size_bytes: bytes.length, sha256: sha256(bytes), content_base64: bytes.toString('base64') });
  }
  const packet = { contract_version: WEBHOOK_LEDGER_PACKET_CONTRACT, total_size_bytes: total, files };
  validatePacketBundle(packet, exactSecrets);
  return packet;
}

export function materializeWebhookPacketBundle(packet, outputDirectory, exactSecrets = []) {
  const files = validatePacketBundle(packet, exactSecrets);
  const absoluteOutput = assertNoLinkedPath(outputDirectory, { allowMissingLeaf: true });
  if (fs.existsSync(absoluteOutput)) fail('WEBHOOK_LEDGER_OUTPUT_EXISTS', absoluteOutput);
  fs.mkdirSync(absoluteOutput, { recursive: false, mode: 0o700 });
  if (fs.realpathSync.native(absoluteOutput) !== absoluteOutput) {
    fail('WEBHOOK_LEDGER_PACKET_LINK_REJECTED', absoluteOutput);
  }
  for (const [name, bytes] of files) {
    fs.writeFileSync(path.join(absoluteOutput, name), bytes, { flag: 'wx', mode: 0o600 });
  }
}

function packetManifest(packet) {
  return {
    contract_version: packet.contract_version,
    total_size_bytes: packet.total_size_bytes,
    files: packet.files.map(({ name, sha256: fileSha256, size_bytes: sizeBytes }) =>
      ({ name, sha256: fileSha256, size_bytes: sizeBytes })),
  };
}

export function validateWebhookArchiveSource(source, applicationSha, lifecycleKind, repository) {
  exactKeys(source, [
    'artifact_admission_sha256', 'artifact_digest', 'artifact_expired', 'artifact_id',
    'artifact_maximum_bytes', 'artifact_name', 'artifact_receipt_sha256', 'artifact_size_in_bytes',
    'repository', 'workflow_run_attempt', 'workflow_run_conclusion', 'workflow_run_event',
    'workflow_run_head_branch', 'workflow_run_head_sha', 'workflow_run_id', 'workflow_run_path',
  ], 'WEBHOOK_LEDGER_SOURCE_INVALID', 'source');
  assertString(source.artifact_admission_sha256, SHA256, 'WEBHOOK_LEDGER_SOURCE_INVALID', 'admission SHA');
  assertString(source.artifact_digest, ARTIFACT_DIGEST, 'WEBHOOK_LEDGER_SOURCE_INVALID', 'artifact digest');
  assertString(source.artifact_receipt_sha256, SHA256, 'WEBHOOK_LEDGER_SOURCE_INVALID', 'receipt SHA');
  if (!Number.isSafeInteger(source.artifact_id) || source.artifact_id < 1 ||
      !Number.isSafeInteger(source.workflow_run_id) || source.workflow_run_id < 1 ||
      !Number.isSafeInteger(source.workflow_run_attempt) || source.workflow_run_attempt < 1 ||
      source.artifact_expired !== false || !Number.isSafeInteger(source.artifact_size_in_bytes) ||
      source.artifact_size_in_bytes < 1 || source.artifact_size_in_bytes > 33_554_432 ||
      source.artifact_maximum_bytes !== 33_554_432 || source.repository !== repository ||
      source.workflow_run_head_sha !== applicationSha || source.workflow_run_head_branch !== 'main' ||
      source.workflow_run_event !== 'workflow_dispatch' ||
      source.workflow_run_path !== '.github/workflows/physio-production-stripe-webhook.yml' ||
      !['success', 'failure', 'cancelled', 'timed_out'].includes(source.workflow_run_conclusion)) {
    fail('WEBHOOK_LEDGER_SOURCE_INVALID', 'coordinates');
  }
  const completedName = `physio-production-stripe-webhook-${applicationSha}`;
  const compensationName = new RegExp(
    `^physio-stripe-webhook-compensation-phase-${applicationSha}-[0-9]+-[0-9]+$`, 'u');
  if ((lifecycleKind === 'COMPLETED' &&
      (source.artifact_name !== completedName || source.workflow_run_conclusion !== 'success')) ||
      (lifecycleKind === 'COMPENSATION' && !compensationName.test(source.artifact_name || ''))) {
    fail('WEBHOOK_LEDGER_SOURCE_INVALID', 'artifact family');
  }
  return source;
}

function validateExpectation(expectation, lifecycleKind, applicationSha) {
  if (lifecycleKind === 'COMPLETED') {
    exactKeys(expectation, [
      'applicationSha', 'authorityReference', 'bootstrapReceiptSha256', 'canaryReceiptSha256',
      'capabilityIntentId', 'effectReceiptSha256',
    ], 'WEBHOOK_LEDGER_EXPECTATION_INVALID', 'completed expectation');
  } else {
    exactKeys(expectation, [
      'applicationSha', 'authorityReference', 'bootstrapReceiptSha256', 'capabilityIntentId',
      'controlReceiptSha256', 'requireCompleted',
    ], 'WEBHOOK_LEDGER_EXPECTATION_INVALID', 'compensation expectation');
    if (typeof expectation.requireCompleted !== 'boolean') {
      fail('WEBHOOK_LEDGER_EXPECTATION_INVALID', 'requireCompleted');
    }
  }
  if (expectation.applicationSha !== applicationSha) {
    fail('WEBHOOK_LEDGER_EXPECTATION_INVALID', 'application SHA');
  }
}

export function validateWebhookPacketForArchive(packetDirectory, lifecycleKind, expectation) {
  if (!LIFECYCLE_KINDS.has(lifecycleKind)) fail('WEBHOOK_LEDGER_LIFECYCLE_INVALID', lifecycleKind);
  validateExpectation(expectation, lifecycleKind, expectation?.applicationSha);
  const proof = lifecycleKind === 'COMPLETED'
    ? validateCompletedStripeWebhookPacket(packetDirectory, expectation)
    : validateStripeWebhookCompensationPacket(packetDirectory, expectation);
  return Object.freeze({
    kind: lifecycleKind,
    result: lifecycleKind === 'COMPLETED' ? 'COMPLETED' :
      (proof.compensation_completed ? 'COMPENSATED' : 'UNRESOLVED'),
    effect_generation: proof.effect_generation,
    started_effect_receipt_sha256: proof.started_effect_receipt_sha256,
    request_sha256: proof.request_sha256,
    control_receipt_sha256: lifecycleKind === 'COMPLETED'
      ? proof.final_receipt_sha256 : proof.latest_phase_receipt_sha256,
    effect_receipt_sha256: lifecycleKind === 'COMPLETED'
      ? proof.effect_receipt_sha256 : null,
    latest_revision: lifecycleKind === 'COMPENSATION' ? proof.latest_revision : null,
  });
}

function validateLifecycle(value) {
  exactKeys(value, [
    'control_receipt_sha256', 'effect_generation', 'effect_receipt_sha256', 'kind',
    'latest_revision', 'request_sha256', 'result', 'started_effect_receipt_sha256',
  ], 'WEBHOOK_LEDGER_LIFECYCLE_INVALID', 'lifecycle');
  if (!LIFECYCLE_KINDS.has(value.kind) || !['COMPLETED', 'COMPENSATED', 'UNRESOLVED'].includes(value.result) ||
      !Number.isSafeInteger(value.effect_generation) || value.effect_generation < 0) {
    fail('WEBHOOK_LEDGER_LIFECYCLE_INVALID', 'shape');
  }
  for (const field of ['control_receipt_sha256', 'request_sha256', 'started_effect_receipt_sha256']) {
    assertString(value[field], SHA256, 'WEBHOOK_LEDGER_LIFECYCLE_INVALID', field);
  }
  if (value.kind === 'COMPLETED') {
    assertString(value.effect_receipt_sha256, SHA256, 'WEBHOOK_LEDGER_LIFECYCLE_INVALID', 'effect receipt');
    if (value.result !== 'COMPLETED' || value.latest_revision !== null) {
      fail('WEBHOOK_LEDGER_LIFECYCLE_INVALID', 'completed state');
    }
  } else if (value.effect_receipt_sha256 !== null || !Number.isSafeInteger(value.latest_revision) ||
      value.latest_revision < 0 || !['COMPENSATED', 'UNRESOLVED'].includes(value.result)) {
    fail('WEBHOOK_LEDGER_LIFECYCLE_INVALID', 'compensation state');
  }
}

export function validateWebhookLedgerRecord(record, { repository, applicationSha, expectedPath }) {
  exactKeys(record, [
    'application_sequence', 'application_sha', 'contract_version', 'ledger_branch', 'lifecycle',
    'ledger_provisioning_receipt_sha256', 'packet', 'packet_manifest_sha256', 'predecessor_commit_sha',
    'previous_lifecycle_control_sha256', 'previous_record_sha256', 'recorded_at',
    'repository', 'source',
  ], 'WEBHOOK_LEDGER_RECORD_INVALID', 'record');
  if (record.contract_version !== WEBHOOK_LEDGER_RECORD_CONTRACT || record.repository !== repository ||
      record.ledger_branch !== WEBHOOK_LEDGER_BRANCH || record.application_sha !== applicationSha ||
      !Number.isSafeInteger(record.application_sequence) || record.application_sequence < 0) {
    fail('WEBHOOK_LEDGER_RECORD_INVALID', expectedPath);
  }
  assertString(record.predecessor_commit_sha, SHA40, 'WEBHOOK_LEDGER_RECORD_INVALID', 'predecessor commit');
  assertString(record.ledger_provisioning_receipt_sha256, SHA256,
    'WEBHOOK_LEDGER_RECORD_INVALID', 'ledger provisioning receipt');
  assertString(record.previous_record_sha256, SHA256, 'WEBHOOK_LEDGER_RECORD_INVALID', 'previous record');
  assertString(record.previous_lifecycle_control_sha256, SHA256,
    'WEBHOOK_LEDGER_RECORD_INVALID', 'previous lifecycle control');
  assertString(record.packet_manifest_sha256, SHA256,
    'WEBHOOK_LEDGER_RECORD_INVALID', 'packet manifest');
  safeTimestamp(record.recorded_at, 'recorded_at');
  validateLifecycle(record.lifecycle);
  validateWebhookArchiveSource(record.source, applicationSha, record.lifecycle.kind, repository);
  if (record.lifecycle.kind === 'COMPENSATION') {
    const expectedArtifactName = `physio-stripe-webhook-compensation-phase-${applicationSha}-` +
      `${record.lifecycle.effect_generation}-${record.lifecycle.latest_revision}`;
    const expectedPhaseMember = `stripe-webhook-compensation-phase-` +
      `${String(record.lifecycle.latest_revision).padStart(3, '0')}.json`;
    if (record.source.artifact_name !== expectedArtifactName ||
        !record.packet.files.some((file) => file.name === expectedPhaseMember)) {
      fail('WEBHOOK_LEDGER_RECORD_INVALID', 'compensation artifact lifecycle coordinates differ');
    }
  }
  if (record.source.artifact_receipt_sha256 !== record.lifecycle.control_receipt_sha256) {
    fail('WEBHOOK_LEDGER_RECORD_INVALID', 'source receipt does not bind the validated lifecycle control');
  }
  validatePacketBundle(record.packet);
  if (sha256(canonicalJson(packetManifest(record.packet))) !== record.packet_manifest_sha256) {
    fail('WEBHOOK_LEDGER_RECORD_INVALID', 'packet manifest binding');
  }
  const expectedName = `${String(record.application_sequence).padStart(10, '0')}-` +
    `${String(record.lifecycle.effect_generation).padStart(10, '0')}-` +
    `${record.lifecycle.kind.toLowerCase()}-${record.source.workflow_run_id}-${record.source.artifact_id}.json`;
  const expectedFullPath = `records/${applicationSha}/${expectedName}`;
  if (expectedPath !== expectedFullPath) fail('WEBHOOK_LEDGER_RECORD_PATH_INVALID', expectedPath);
  return record;
}

function validateRecordTransition(previous, current) {
  if (!previous) {
    if (current.application_sequence !== 0 || current.previous_record_sha256 !== ZERO_SHA256 ||
        current.previous_lifecycle_control_sha256 !== ZERO_SHA256) {
      fail('WEBHOOK_LEDGER_CHAIN_INVALID', 'first application record');
    }
    return;
  }
  if (current.application_sequence !== previous.record.application_sequence + 1 ||
      current.previous_record_sha256 !== previous.sha256 ||
      current.previous_lifecycle_control_sha256 !== previous.record.lifecycle.control_receipt_sha256) {
    fail('WEBHOOK_LEDGER_CHAIN_INVALID', 'record predecessor');
  }
  const prior = previous.record.lifecycle;
  const next = current.lifecycle;
  if (prior.result === 'COMPLETED') {
    fail('WEBHOOK_LEDGER_CHAIN_INVALID', 'completed application SHA is immutable');
  }
  if (next.control_receipt_sha256 === prior.control_receipt_sha256) {
    fail('WEBHOOK_LEDGER_CHAIN_INVALID', 'lifecycle control receipt was replayed');
  }
  if (next.effect_generation === prior.effect_generation) {
    if (prior.result !== 'UNRESOLVED' ||
        next.started_effect_receipt_sha256 !== prior.started_effect_receipt_sha256 ||
        next.request_sha256 !== prior.request_sha256) {
      fail('WEBHOOK_LEDGER_CHAIN_INVALID', 'same-generation identity or terminal state');
    }
    if (next.kind === 'COMPENSATION') {
      if (prior.kind !== 'COMPENSATION' || next.latest_revision !== prior.latest_revision + 1) {
        fail('WEBHOOK_LEDGER_CHAIN_INVALID', 'compensation revision did not advance exactly once');
      }
      return;
    }
    if (next.kind !== 'COMPLETED' || next.result !== 'COMPLETED') {
      fail('WEBHOOK_LEDGER_CHAIN_INVALID', 'same-generation terminal transition');
    }
    return;
  }
  if (next.effect_generation !== prior.effect_generation + 1 || prior.result !== 'COMPENSATED' ||
      next.started_effect_receipt_sha256 === prior.started_effect_receipt_sha256 ||
      next.request_sha256 === prior.request_sha256) {
    fail('WEBHOOK_LEDGER_CHAIN_INVALID', 'next-generation transition');
  }
}

function encodePath(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

export function createWebhookLedgerGitHubClient({ repository, token, fetchImpl = globalThis.fetch,
  apiBase = 'https://api.github.com' }) {
  assertString(repository, REPOSITORY, 'WEBHOOK_LEDGER_REPOSITORY_INVALID', 'repository');
  if (typeof token !== 'string' || token.length < 20 || typeof fetchImpl !== 'function') {
    fail('WEBHOOK_LEDGER_CLIENT_INVALID', 'token or fetch');
  }
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  async function request(method, endpoint, body, accepted = [200]) {
    const response = await fetchImpl(`${apiBase}/repos/${repository}${endpoint}`, {
      method,
      headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error',
    });
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
      fail('WEBHOOK_LEDGER_API_RESPONSE_OVERSIZE', `${method} ${endpoint}`);
    }
    let value = null;
    if (text.length) {
      try { value = JSON.parse(text); } catch { fail('WEBHOOK_LEDGER_API_RESPONSE_INVALID', endpoint); }
    }
    if (!accepted.includes(response.status)) {
      const error = new Error(`WEBHOOK_LEDGER_API_STATUS_${response.status}: ${method} ${endpoint}`);
      error.status = response.status;
      error.value = value;
      throw error;
    }
    return { status: response.status, value };
  }
  return { request };
}

function decodeBlob(blob, expectedSha, label) {
  if (!blob || blob.encoding !== 'base64' || typeof blob.content !== 'string' || blob.truncated === true) {
    fail('WEBHOOK_LEDGER_BLOB_INVALID', label);
  }
  const bytes = Buffer.from(blob.content.replace(/\n/gu, ''), 'base64');
  if (bytes.length > MAX_RECORD_BYTES || gitBlobSha(bytes) !== expectedSha ||
      (blob.sha !== undefined && blob.sha !== expectedSha)) fail('WEBHOOK_LEDGER_BLOB_INVALID', label);
  return bytes;
}

function visibleRulesetObject(ruleset) {
  return {
    id: ruleset.id,
    node_id: ruleset.node_id,
    name: ruleset.name,
    target: ruleset.target,
    enforcement: ruleset.enforcement,
    updated_at: ruleset.updated_at,
    conditions: ruleset.conditions,
    rules: ruleset.rules,
  };
}

function validateWebhookGenesisReadback(value, repository) {
  exactKeys(value, [
    'genesis_blob_path', 'genesis_blob_sha', 'genesis_blob_sha256', 'genesis_commit_message',
    'genesis_commit_sha', 'genesis_parent_count', 'genesis_ref_readback_sha', 'genesis_tree_sha',
  ], 'WEBHOOK_LEDGER_GENESIS_INVALID', 'genesis readback');
  if (value.genesis_blob_path !== LEDGER_GENESIS_PATH ||
      value.genesis_commit_message !== LEDGER_GENESIS_MESSAGE || value.genesis_parent_count !== 0 ||
      value.genesis_ref_readback_sha !== value.genesis_commit_sha) {
    fail('WEBHOOK_LEDGER_GENESIS_INVALID', 'genesis readback semantics differ');
  }
  for (const field of ['genesis_blob_sha', 'genesis_commit_sha', 'genesis_ref_readback_sha', 'genesis_tree_sha']) {
    assertString(value[field], SHA40, 'WEBHOOK_LEDGER_GENESIS_INVALID', field);
  }
  assertString(value.genesis_blob_sha256, SHA256, 'WEBHOOK_LEDGER_GENESIS_INVALID', 'genesis blob SHA256');
  const expectedBytes = genesisBytes(repository);
  if (value.genesis_blob_sha !== gitBlobSha(expectedBytes) || value.genesis_blob_sha256 !== sha256(expectedBytes)) {
    fail('WEBHOOK_LEDGER_GENESIS_INVALID', 'genesis blob commitment differs');
  }
  return structuredClone(value);
}

function validateAdminWebhookLedgerRuleset(ruleset) {
  const expectedRuleTypes = ['deletion', 'non_fast_forward', 'required_linear_history'];
  const observedRuleTypes = Array.isArray(ruleset?.rules) ? ruleset.rules.map((row) => row?.type).sort() : [];
  if (!Number.isSafeInteger(ruleset?.id) || ruleset.id < 1 ||
      typeof ruleset?.node_id !== 'string' || ruleset.node_id.length < 1 || ruleset.node_id.length > 200 ||
      ruleset.name !== LEDGER_RULESET_NAME || ruleset.target !== 'branch' || ruleset.enforcement !== 'active' ||
      !ISO.test(ruleset.updated_at || '') || !Array.isArray(ruleset.bypass_actors) || ruleset.bypass_actors.length !== 0 ||
      JSON.stringify(ruleset?.conditions?.ref_name?.include) !==
        JSON.stringify([`refs/heads/${WEBHOOK_LEDGER_BRANCH}`]) ||
      JSON.stringify(ruleset?.conditions?.ref_name?.exclude) !== JSON.stringify([]) ||
      JSON.stringify(observedRuleTypes) !== JSON.stringify(expectedRuleTypes) ||
      ruleset.rules.some((row) => JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['type']))) {
    fail('WEBHOOK_LEDGER_RULESET_INVALID', 'admin provisioning readback differs');
  }
  return observedRuleTypes;
}

export function buildWebhookLedgerRulesetProvisioningReceipt({ repository, ruleset, genesisReadback,
  observedAt = new Date().toISOString(), providerApiVersion = '2022-11-28' }) {
  assertString(repository, REPOSITORY, 'WEBHOOK_LEDGER_RULESET_INVALID', 'repository');
  safeTimestamp(observedAt, 'ruleset observed_at');
  const observedRuleTypes = validateAdminWebhookLedgerRuleset(ruleset);
  const genesis = validateWebhookGenesisReadback(genesisReadback, repository);
  if (Date.parse(observedAt) < Date.parse(ruleset.updated_at)) {
    fail('WEBHOOK_LEDGER_RULESET_INVALID', 'provisioning observation predates ruleset version');
  }
  return Object.freeze({
    contract_version: WEBHOOK_LEDGER_PROVISIONING_CONTRACT,
    result: 'PASS', repository, provider_api_version: providerApiVersion,
    observed_at: observedAt, ruleset_id: ruleset.id, ruleset_node_id: ruleset.node_id,
    ruleset_name: ruleset.name, ruleset_target: ruleset.target, enforcement: ruleset.enforcement,
    provider_updated_at: ruleset.updated_at, bypass_actor_count: 0,
    include_refs: ruleset.conditions.ref_name.include,
    exclude_refs: ruleset.conditions.ref_name.exclude,
    rule_types: observedRuleTypes,
    visible_object_sha256: sha256(canonicalProviderJson(visibleRulesetObject(ruleset))),
    full_object_sha256: sha256(canonicalProviderJson(ruleset)),
    ...genesis,
  });
}

function validateRulesetProvisioningReceipt(receipt, repository) {
  exactKeys(receipt, [
    'bypass_actor_count', 'contract_version', 'enforcement', 'exclude_refs', 'full_object_sha256',
    'genesis_blob_path', 'genesis_blob_sha', 'genesis_blob_sha256', 'genesis_commit_message',
    'genesis_commit_sha', 'genesis_parent_count', 'genesis_ref_readback_sha', 'genesis_tree_sha',
    'include_refs', 'observed_at', 'provider_api_version', 'provider_updated_at', 'repository',
    'result', 'rule_types', 'ruleset_id', 'ruleset_name', 'ruleset_node_id', 'ruleset_target',
    'visible_object_sha256',
  ], 'WEBHOOK_LEDGER_RULESET_INVALID', 'provisioning receipt');
  if (receipt.contract_version !== WEBHOOK_LEDGER_PROVISIONING_CONTRACT ||
      receipt.result !== 'PASS' || receipt.repository !== repository || receipt.provider_api_version !== '2022-11-28' ||
      !Number.isSafeInteger(receipt.ruleset_id) || receipt.ruleset_id < 1 ||
      typeof receipt.ruleset_node_id !== 'string' || receipt.ruleset_node_id.length < 1 ||
      receipt.ruleset_name !== LEDGER_RULESET_NAME || receipt.ruleset_target !== 'branch' ||
      receipt.enforcement !== 'active' || receipt.bypass_actor_count !== 0 ||
      JSON.stringify(receipt.include_refs) !== JSON.stringify([`refs/heads/${WEBHOOK_LEDGER_BRANCH}`]) ||
      JSON.stringify(receipt.exclude_refs) !== JSON.stringify([]) ||
      JSON.stringify(receipt.rule_types) !==
        JSON.stringify(['deletion', 'non_fast_forward', 'required_linear_history'])) {
    fail('WEBHOOK_LEDGER_RULESET_INVALID', 'provisioning receipt semantics differ');
  }
  safeTimestamp(receipt.observed_at, 'ruleset observed_at');
  safeTimestamp(receipt.provider_updated_at, 'ruleset provider_updated_at');
  if (Date.parse(receipt.observed_at) < Date.parse(receipt.provider_updated_at)) {
    fail('WEBHOOK_LEDGER_RULESET_INVALID', 'provisioning observation predates ruleset version');
  }
  assertString(receipt.visible_object_sha256, SHA256, 'WEBHOOK_LEDGER_RULESET_INVALID', 'visible object hash');
  assertString(receipt.full_object_sha256, SHA256, 'WEBHOOK_LEDGER_RULESET_INVALID', 'full object hash');
  validateWebhookGenesisReadback({
    genesis_blob_path: receipt.genesis_blob_path,
    genesis_blob_sha: receipt.genesis_blob_sha,
    genesis_blob_sha256: receipt.genesis_blob_sha256,
    genesis_commit_message: receipt.genesis_commit_message,
    genesis_commit_sha: receipt.genesis_commit_sha,
    genesis_parent_count: receipt.genesis_parent_count,
    genesis_ref_readback_sha: receipt.genesis_ref_readback_sha,
    genesis_tree_sha: receipt.genesis_tree_sha,
  }, repository);
  return receipt;
}

function canonicalGenesis(repository) {
  assertString(repository, REPOSITORY, 'WEBHOOK_LEDGER_REPOSITORY_INVALID', 'repository');
  return {
    contract_version: WEBHOOK_LEDGER_GENESIS_CONTRACT,
    ledger_branch: WEBHOOK_LEDGER_BRANCH,
    purpose: 'protected append-only AssessSuite Physio Stripe webhook lifecycle archive',
    repository,
  };
}

export function genesisBytes(repository) {
  return Buffer.from(canonicalJson(canonicalGenesis(repository)));
}

async function readTree(client, treeSha) {
  const tree = (await client.request('GET', `/git/trees/${treeSha}?recursive=1`)).value;
  if (tree?.sha !== treeSha || tree.truncated !== false || !Array.isArray(tree.tree)) {
    fail('WEBHOOK_LEDGER_TREE_INVALID', treeSha);
  }
  const map = new Map();
  for (const row of tree.tree) {
    if (row?.type === 'tree') {
      if (row.mode !== '040000' || !SHA40.test(row.sha || '') || typeof row.path !== 'string' ||
          !/^(?:\.ledger|records(?:\/[0-9a-f]{40})?)$/u.test(row.path)) {
        fail('WEBHOOK_LEDGER_TREE_INVALID', treeSha);
      }
      continue;
    }
    if (row?.type !== 'blob' || row.mode !== '100644' || !SHA40.test(row.sha || '') ||
        typeof row.path !== 'string' || map.has(row.path)) fail('WEBHOOK_LEDGER_TREE_INVALID', treeSha);
    map.set(row.path, row);
  }
  return map;
}

async function listAllCommits(client) {
  const descending = [];
  for (let page = 1; page <= Math.ceil(MAX_LEDGER_COMMITS / 100) + 1; page += 1) {
    const rows = (await client.request('GET',
      `/commits?sha=${WEBHOOK_LEDGER_BRANCH}&per_page=100&page=${page}`)).value;
    if (!Array.isArray(rows) || rows.some((row) => !SHA40.test(row?.sha || ''))) {
      fail('WEBHOOK_LEDGER_HISTORY_INVALID', `page ${page}`);
    }
    descending.push(...rows.map((row) => row.sha));
    if (descending.length > MAX_LEDGER_COMMITS) fail('WEBHOOK_LEDGER_HISTORY_OVERSIZE', 'commit count');
    if (rows.length < 100) return descending.reverse();
  }
  fail('WEBHOOK_LEDGER_HISTORY_PAGINATION_INVALID', 'history did not terminate');
}

export async function inspectWebhookLedgerRuleset({ client, provisioningReceipt }) {
  validateRulesetProvisioningReceipt(provisioningReceipt, provisioningReceipt.repository);
  const candidates = [];
  for (let page = 1; page <= 100; page += 1) {
    const rows = (await client.request('GET',
      `/rulesets?includes_parents=false&per_page=100&page=${page}`)).value;
    if (!Array.isArray(rows)) fail('WEBHOOK_LEDGER_RULESET_INVALID', `page ${page}`);
    candidates.push(...rows.filter((row) => row?.name === LEDGER_RULESET_NAME));
    if (rows.length < 100) break;
    if (page === 100) fail('WEBHOOK_LEDGER_RULESET_INVALID', 'pagination did not terminate');
  }
  if (candidates.length !== 1 || !Number.isSafeInteger(candidates[0].id) || candidates[0].id < 1) {
    fail('WEBHOOK_LEDGER_RULESET_INVALID', 'exact ruleset is absent or ambiguous');
  }
  if (candidates[0].id !== provisioningReceipt.ruleset_id) {
    fail('WEBHOOK_LEDGER_RULESET_INVALID', 'ruleset ID changed');
  }
  const ruleset = (await client.request('GET',
    `/rulesets/${provisioningReceipt.ruleset_id}?includes_parents=false`)).value;
  const expectedRuleTypes = ['deletion', 'non_fast_forward', 'required_linear_history'];
  const observedRuleTypes = Array.isArray(ruleset?.rules)
    ? ruleset.rules.map((row) => row?.type).sort() : [];
  const bypassVisibleAndChanged = Object.hasOwn(ruleset || {}, 'bypass_actors') &&
    (!Array.isArray(ruleset.bypass_actors) || ruleset.bypass_actors.length !== 0);
  if (ruleset?.id !== provisioningReceipt.ruleset_id ||
      ruleset?.node_id !== provisioningReceipt.ruleset_node_id ||
      ruleset?.updated_at !== provisioningReceipt.provider_updated_at ||
      ruleset?.name !== LEDGER_RULESET_NAME ||
      ruleset?.target !== 'branch' || ruleset?.enforcement !== 'active' ||
      bypassVisibleAndChanged ||
      JSON.stringify(ruleset?.conditions?.ref_name?.include) !==
        JSON.stringify([`refs/heads/${WEBHOOK_LEDGER_BRANCH}`]) ||
      JSON.stringify(ruleset?.conditions?.ref_name?.exclude) !== JSON.stringify([]) ||
      JSON.stringify(observedRuleTypes) !== JSON.stringify(expectedRuleTypes) ||
      ruleset.rules.some((row) => JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['type'])) ||
      sha256(canonicalProviderJson(visibleRulesetObject(ruleset))) !== provisioningReceipt.visible_object_sha256) {
    fail('WEBHOOK_LEDGER_RULESET_INVALID', 'ruleset semantics differ');
  }
  return Object.freeze({ id: ruleset.id, name: ruleset.name, rule_types: observedRuleTypes });
}

export async function inspectWebhookLedger({ client, repository }) {
  const ref = (await client.request('GET', `/git/ref/heads/${encodeURIComponent(WEBHOOK_LEDGER_BRANCH)}`)).value;
  if (ref?.ref !== `refs/heads/${WEBHOOK_LEDGER_BRANCH}` || ref.object?.type !== 'commit' ||
      !SHA40.test(ref.object?.sha || '')) fail('WEBHOOK_LEDGER_REF_INVALID', 'branch ref');
  const startingHead = ref.object.sha;
  const branch = (await client.request('GET', `/branches/${encodeURIComponent(WEBHOOK_LEDGER_BRANCH)}`)).value;
  const activeRules = (await client.request('GET',
    `/rules/branches/${encodeURIComponent(WEBHOOK_LEDGER_BRANCH)}`)).value;
  const activeRuleTypes = Array.isArray(activeRules) ? activeRules.map((row) => row?.type).sort() : [];
  if (branch?.name !== WEBHOOK_LEDGER_BRANCH || branch?.commit?.sha !== startingHead || branch?.protected !== true ||
      JSON.stringify(activeRuleTypes) !==
        JSON.stringify(['deletion', 'non_fast_forward', 'required_linear_history'])) {
    fail('WEBHOOK_LEDGER_PROTECTION_INVALID', WEBHOOK_LEDGER_BRANCH);
  }
  const shas = await listAllCommits(client);
  if (shas.length < 2 || shas.at(-1) !== startingHead) fail('WEBHOOK_LEDGER_HISTORY_INVALID', 'tip');
  let previousCommitSha = null;
  let previousTree = null;
  let genesisSha = null;
  let genesisTreeSha = null;
  let genesisBlobSha = null;
  let genesisBlobSha256 = null;
  let provisioningCommitSha = null;
  let provisioningReceipt = null;
  let provisioningReceiptSha256 = null;
  let ruleset = null;
  const applicationRecords = new Map();
  const sourceIdentities = new Map();
  const recordEntries = [];
  for (let index = 0; index < shas.length; index += 1) {
    const commitSha = shas[index];
    const commit = (await client.request('GET', `/git/commits/${commitSha}`)).value;
    if (commit?.sha !== commitSha || !SHA40.test(commit.tree?.sha || '') || !Array.isArray(commit.parents)) {
      fail('WEBHOOK_LEDGER_HISTORY_INVALID', commitSha);
    }
    const tree = await readTree(client, commit.tree.sha);
    if (index === 0) {
      if (commit.parents.length !== 0 || commit.message !== LEDGER_GENESIS_MESSAGE ||
          tree.size !== 1 || !tree.has(LEDGER_GENESIS_PATH)) {
        fail('WEBHOOK_LEDGER_GENESIS_INVALID', commitSha);
      }
      const entry = tree.get(LEDGER_GENESIS_PATH);
      const bytes = decodeBlob((await client.request('GET', `/git/blobs/${entry.sha}`)).value,
        entry.sha, 'genesis');
      let genesis;
      try { genesis = JSON.parse(bytes.toString('utf8')); } catch { fail('WEBHOOK_LEDGER_GENESIS_INVALID', 'JSON'); }
      exactKeys(genesis, ['contract_version', 'ledger_branch', 'purpose', 'repository'],
        'WEBHOOK_LEDGER_GENESIS_INVALID', 'genesis');
      if (!bytes.equals(Buffer.from(canonicalJson(genesis))) ||
          genesis.contract_version !== WEBHOOK_LEDGER_GENESIS_CONTRACT ||
          genesis.ledger_branch !== WEBHOOK_LEDGER_BRANCH || genesis.repository !== repository ||
          genesis.purpose !== 'protected append-only AssessSuite Physio Stripe webhook lifecycle archive') {
        fail('WEBHOOK_LEDGER_GENESIS_INVALID', 'bytes');
      }
      genesisSha = commitSha;
      genesisTreeSha = commit.tree.sha;
      genesisBlobSha = entry.sha;
      genesisBlobSha256 = sha256(bytes);
    } else if (index === 1) {
      if (commit.parents.length !== 1 || commit.parents[0]?.sha !== genesisSha ||
          commit.message !== LEDGER_PROVISIONING_MESSAGE || tree.size !== 2 ||
          !tree.has(LEDGER_GENESIS_PATH) || !tree.has(LEDGER_PROVISIONING_PATH) ||
          tree.get(LEDGER_GENESIS_PATH)?.sha !== previousTree.get(LEDGER_GENESIS_PATH)?.sha) {
        fail('WEBHOOK_LEDGER_PROVISIONING_INVALID', commitSha);
      }
      const entry = tree.get(LEDGER_PROVISIONING_PATH);
      const bytes = decodeBlob((await client.request('GET', `/git/blobs/${entry.sha}`)).value,
        entry.sha, 'provisioning');
      try { provisioningReceipt = JSON.parse(bytes.toString('utf8')); } catch {
        fail('WEBHOOK_LEDGER_PROVISIONING_INVALID', 'JSON');
      }
      validateRulesetProvisioningReceipt(provisioningReceipt, repository);
      if (!bytes.equals(Buffer.from(canonicalJson(provisioningReceipt))) ||
          provisioningReceipt.genesis_commit_sha !== genesisSha ||
          provisioningReceipt.genesis_ref_readback_sha !== genesisSha ||
          provisioningReceipt.genesis_tree_sha !== genesisTreeSha ||
          provisioningReceipt.genesis_blob_path !== LEDGER_GENESIS_PATH ||
          provisioningReceipt.genesis_blob_sha !== genesisBlobSha ||
          provisioningReceipt.genesis_blob_sha256 !== genesisBlobSha256) {
        fail('WEBHOOK_LEDGER_PROVISIONING_INVALID', 'receipt does not bind exact genesis');
      }
      provisioningReceiptSha256 = sha256(bytes);
      ruleset = await inspectWebhookLedgerRuleset({ client, provisioningReceipt });
      provisioningCommitSha = commitSha;
    } else {
      if (commit.parents.length !== 1 || commit.parents[0]?.sha !== previousCommitSha ||
          commit.message !== 'Append AssessSuite Physio webhook ledger record') {
        fail('WEBHOOK_LEDGER_HISTORY_INVALID', commitSha);
      }
      const added = [...tree.keys()].filter((key) => !previousTree.has(key));
      const removed = [...previousTree.keys()].filter((key) => !tree.has(key));
      const changed = [...previousTree.keys()].filter((key) => tree.has(key) &&
        JSON.stringify(tree.get(key)) !== JSON.stringify(previousTree.get(key)));
      if (added.length !== 1 || removed.length !== 0 || changed.length !== 0 ||
          !/^records\/[0-9a-f]{40}\/[A-Za-z0-9._-]+\.json$/u.test(added[0])) {
        fail('WEBHOOK_LEDGER_HISTORY_INVALID', `commit ${commitSha} is not one immutable append`);
      }
      const recordPath = added[0];
      const entry = tree.get(recordPath);
      const bytes = decodeBlob((await client.request('GET', `/git/blobs/${entry.sha}`)).value,
        entry.sha, recordPath);
      let record;
      try { record = JSON.parse(bytes.toString('utf8')); } catch { fail('WEBHOOK_LEDGER_RECORD_INVALID', recordPath); }
      const applicationSha = recordPath.split('/')[1];
      validateWebhookLedgerRecord(record, { repository, applicationSha, expectedPath: recordPath });
      if (record.predecessor_commit_sha !== previousCommitSha ||
          record.ledger_provisioning_receipt_sha256 !== provisioningReceiptSha256) {
        fail('WEBHOOK_LEDGER_CHAIN_INVALID', 'predecessor commit');
      }
      const prior = applicationRecords.get(applicationSha)?.at(-1) || null;
      validateRecordTransition(prior, record);
      const recordSha256 = sha256(bytes);
      const row = { commit_sha: commitSha, path: recordPath, blob_sha: entry.sha,
        sha256: recordSha256, record };
      const sourceKey = `${record.source.workflow_run_id}:${record.source.artifact_id}`;
      if (sourceIdentities.has(sourceKey)) {
        fail('WEBHOOK_LEDGER_SOURCE_REPLAY', sourceKey);
      }
      sourceIdentities.set(sourceKey, row);
      if (!applicationRecords.has(applicationSha)) applicationRecords.set(applicationSha, []);
      applicationRecords.get(applicationSha).push(row);
      recordEntries.push(row);
    }
    previousCommitSha = commitSha;
    previousTree = tree;
  }
  const finalRef = (await client.request('GET',
    `/git/ref/heads/${encodeURIComponent(WEBHOOK_LEDGER_BRANCH)}`)).value;
  if (finalRef?.object?.sha !== startingHead) fail('WEBHOOK_LEDGER_HISTORY_CHANGED', 'branch moved');
  return Object.freeze({
    contract_version: 'assesssuite-physio-webhook-ledger-inventory/1.0.0',
    result: 'PASS', repository, ledger_branch: WEBHOOK_LEDGER_BRANCH,
    ledger_genesis_sha: genesisSha, ledger_provisioning_commit_sha: provisioningCommitSha,
    ledger_provisioning_receipt_sha256: provisioningReceiptSha256,
    ledger_head_sha: startingHead,
    ledger_ruleset_id: ruleset.id,
    audited_commit_count: shas.length, records: recordEntries, application_records: applicationRecords,
    source_identities: sourceIdentities,
  });
}

export async function createWebhookLedgerGenesis({ client, repository }) {
  assertString(repository, REPOSITORY, 'WEBHOOK_LEDGER_REPOSITORY_INVALID', 'repository');
  const candidates = [];
  for (let page = 1; page <= 100; page += 1) {
    const rows = (await client.request('GET',
      `/rulesets?includes_parents=false&per_page=100&page=${page}`)).value;
    if (!Array.isArray(rows)) fail('WEBHOOK_LEDGER_RULESET_INVALID', `page ${page}`);
    candidates.push(...rows.filter((row) => row?.name === LEDGER_RULESET_NAME));
    if (rows.length < 100) break;
    if (page === 100) fail('WEBHOOK_LEDGER_RULESET_INVALID', 'pagination did not terminate');
  }
  if (candidates.length !== 1 || !Number.isSafeInteger(candidates[0]?.id)) {
    fail('WEBHOOK_LEDGER_RULESET_INVALID', 'exact active ruleset must predate genesis');
  }
  const fullRuleset = (await client.request('GET',
    `/rulesets/${candidates[0].id}?includes_parents=false`)).value;
  validateAdminWebhookLedgerRuleset(fullRuleset);
  const bytes = genesisBytes(repository);
  const blob = (await client.request('POST', '/git/blobs',
    { content: bytes.toString('base64'), encoding: 'base64' }, [201])).value;
  if (blob?.sha !== gitBlobSha(bytes)) fail('WEBHOOK_LEDGER_GENESIS_INVALID', 'blob readback');
  const tree = (await client.request('POST', '/git/trees', { tree: [{ path: LEDGER_GENESIS_PATH,
    mode: '100644', type: 'blob', sha: blob.sha }] }, [201])).value;
  if (!SHA40.test(tree?.sha || '')) fail('WEBHOOK_LEDGER_GENESIS_INVALID', 'tree readback');
  const commit = (await client.request('POST', '/git/commits', {
    message: LEDGER_GENESIS_MESSAGE, tree: tree.sha, parents: [],
  }, [201])).value;
  if (!SHA40.test(commit?.sha || '')) fail('WEBHOOK_LEDGER_GENESIS_INVALID', 'commit readback');
  try {
    await client.request('POST', '/git/refs',
      { ref: `refs/heads/${WEBHOOK_LEDGER_BRANCH}`, sha: commit.sha }, [201]);
  } catch (error) {
    const ref = await client.request('GET', `/git/ref/heads/${encodeURIComponent(WEBHOOK_LEDGER_BRANCH)}`);
    if (ref.value?.object?.sha !== commit.sha) throw error;
  }
  const refReadback = (await client.request('GET',
    `/git/ref/heads/${encodeURIComponent(WEBHOOK_LEDGER_BRANCH)}`)).value;
  const commitReadback = (await client.request('GET', `/git/commits/${commit.sha}`)).value;
  const treeReadback = await readTree(client, tree.sha);
  const blobReadback = decodeBlob((await client.request('GET', `/git/blobs/${blob.sha}`)).value,
    blob.sha, 'genesis readback');
  if (refReadback?.object?.sha !== commit.sha || commitReadback?.parents?.length !== 0 ||
      commitReadback?.message !== LEDGER_GENESIS_MESSAGE || commitReadback?.tree?.sha !== tree.sha ||
      treeReadback.size !== 1 || treeReadback.get(LEDGER_GENESIS_PATH)?.sha !== blob.sha ||
      !blobReadback.equals(bytes)) {
    fail('WEBHOOK_LEDGER_GENESIS_INVALID', 'post-creation provider readback');
  }
  return {
    contract_version: 'assesssuite-physio-webhook-ledger-genesis-readback/2.0.0',
    result: 'PASS', repository, ledger_branch: WEBHOOK_LEDGER_BRANCH,
    genesis_commit_sha: commit.sha, genesis_parent_count: 0,
    genesis_commit_message: LEDGER_GENESIS_MESSAGE, genesis_tree_sha: tree.sha,
    genesis_blob_path: LEDGER_GENESIS_PATH, genesis_blob_sha: blob.sha,
    genesis_blob_sha256: sha256(bytes), genesis_ref_readback_sha: commit.sha,
    ruleset_id: fullRuleset.id,
  };
}

export async function appendWebhookLedgerProvisioningReceipt({ client, repository, provisioningReceipt,
  expectedGenesisSha }) {
  assertString(expectedGenesisSha, SHA40, 'WEBHOOK_LEDGER_GENESIS_INVALID', 'expected genesis SHA');
  validateRulesetProvisioningReceipt(provisioningReceipt, repository);
  if (provisioningReceipt.genesis_commit_sha !== expectedGenesisSha) {
    fail('WEBHOOK_LEDGER_PROVISIONING_INVALID', 'receipt genesis differs');
  }
  await inspectWebhookLedgerRuleset({ client, provisioningReceipt });
  const ref = (await client.request('GET',
    `/git/ref/heads/${encodeURIComponent(WEBHOOK_LEDGER_BRANCH)}`)).value;
  if (ref?.object?.sha !== expectedGenesisSha) {
    fail('WEBHOOK_LEDGER_NON_FAST_FORWARD', 'genesis is not the exact branch tip');
  }
  const genesisCommit = (await client.request('GET', `/git/commits/${expectedGenesisSha}`)).value;
  const genesisTree = await readTree(client, genesisCommit?.tree?.sha);
  if (genesisCommit?.parents?.length !== 0 || genesisCommit?.message !== LEDGER_GENESIS_MESSAGE ||
      genesisCommit?.tree?.sha !== provisioningReceipt.genesis_tree_sha || genesisTree.size !== 1 ||
      genesisTree.get(LEDGER_GENESIS_PATH)?.sha !== provisioningReceipt.genesis_blob_sha) {
    fail('WEBHOOK_LEDGER_GENESIS_INVALID', 'provisioning predecessor differs');
  }
  const bytes = Buffer.from(canonicalJson(provisioningReceipt));
  const blob = (await client.request('POST', '/git/blobs',
    { content: bytes.toString('base64'), encoding: 'base64' }, [201])).value;
  if (blob?.sha !== gitBlobSha(bytes)) fail('WEBHOOK_LEDGER_PROVISIONING_INVALID', 'blob readback');
  const tree = (await client.request('POST', '/git/trees', {
    base_tree: genesisCommit.tree.sha,
    tree: [{ path: LEDGER_PROVISIONING_PATH, mode: '100644', type: 'blob', sha: blob.sha }],
  }, [201])).value;
  if (!SHA40.test(tree?.sha || '')) fail('WEBHOOK_LEDGER_PROVISIONING_INVALID', 'tree readback');
  const commit = (await client.request('POST', '/git/commits', {
    message: LEDGER_PROVISIONING_MESSAGE, tree: tree.sha, parents: [expectedGenesisSha],
  }, [201])).value;
  if (!SHA40.test(commit?.sha || '')) fail('WEBHOOK_LEDGER_PROVISIONING_INVALID', 'commit readback');
  let updateError = null;
  try {
    await client.request('PATCH', `/git/refs/heads/${encodeURIComponent(WEBHOOK_LEDGER_BRANCH)}`,
      { sha: commit.sha, force: false }, [200]);
  } catch (error) {
    updateError = error;
  }
  let readback;
  try {
    readback = await inspectWebhookLedger({ client, repository });
  } catch (error) {
    if (updateError) throw updateError;
    throw error;
  }
  if (readback.ledger_genesis_sha !== expectedGenesisSha ||
      readback.ledger_provisioning_commit_sha !== commit.sha ||
      readback.ledger_provisioning_receipt_sha256 !== sha256(bytes) ||
      readback.ledger_head_sha !== commit.sha || readback.audited_commit_count !== 2) {
    fail('WEBHOOK_LEDGER_PROVISIONING_INVALID', 'post-append provider readback');
  }
  return { contract_version: 'assesssuite-physio-webhook-ledger-provisioning-append/2.0.0', result: 'PASS',
    repository, ledger_branch: WEBHOOK_LEDGER_BRANCH, ledger_genesis_sha: expectedGenesisSha,
    ledger_provisioning_commit_sha: commit.sha, ledger_provisioning_blob_sha: blob.sha,
    ledger_provisioning_receipt_sha256: sha256(bytes), response_loss_reconciled: updateError !== null,
    ruleset_id: readback.ledger_ruleset_id, audited_commit_count: readback.audited_commit_count };
}

function sourceKey(source) {
  return `${source.workflow_run_id}:${source.artifact_id}`;
}

export async function appendWebhookLedgerRecord({ client, repository, applicationSha, request,
  recordedAt = new Date().toISOString() }) {
  assertString(applicationSha, SHA40, 'WEBHOOK_LEDGER_APPLICATION_INVALID', 'application SHA');
  exactKeys(request, ['lifecycle', 'packet', 'source'],
    'WEBHOOK_LEDGER_APPEND_INVALID', 'append request');
  validateLifecycle(request.lifecycle);
  validateWebhookArchiveSource(request.source, applicationSha, request.lifecycle.kind, repository);
  validatePacketBundle(request.packet);
  safeTimestamp(recordedAt, 'recordedAt');
  const inventory = await inspectWebhookLedger({ client, repository });
  const replay = inventory.source_identities.get(sourceKey(request.source));
  if (replay) {
    const expectedManifest = sha256(canonicalJson(packetManifest(request.packet)));
    if (replay.record.packet_manifest_sha256 !== expectedManifest ||
        JSON.stringify(replay.record.source) !== JSON.stringify(request.source) ||
        JSON.stringify(replay.record.lifecycle) !== JSON.stringify(request.lifecycle)) {
      fail('WEBHOOK_LEDGER_SOURCE_REPLAY_CONFLICT', sourceKey(request.source));
    }
    return buildAppendResult(inventory, replay, true);
  }
  const prior = inventory.application_records.get(applicationSha)?.at(-1) || null;
  const sequence = prior ? prior.record.application_sequence + 1 : 0;
  const record = {
    contract_version: WEBHOOK_LEDGER_RECORD_CONTRACT,
    repository,
    ledger_branch: WEBHOOK_LEDGER_BRANCH,
    application_sha: applicationSha,
    application_sequence: sequence,
    predecessor_commit_sha: inventory.ledger_head_sha,
    previous_record_sha256: prior?.sha256 || ZERO_SHA256,
    previous_lifecycle_control_sha256: prior?.record.lifecycle.control_receipt_sha256 || ZERO_SHA256,
    ledger_provisioning_receipt_sha256: inventory.ledger_provisioning_receipt_sha256,
    source: request.source,
    lifecycle: request.lifecycle,
    packet_manifest_sha256: sha256(canonicalJson(packetManifest(request.packet))),
    packet: request.packet,
    recorded_at: recordedAt,
  };
  const recordPath = `records/${applicationSha}/${String(sequence).padStart(10, '0')}-` +
    `${String(request.lifecycle.effect_generation).padStart(10, '0')}-` +
    `${request.lifecycle.kind.toLowerCase()}-${request.source.workflow_run_id}-${request.source.artifact_id}.json`;
  validateWebhookLedgerRecord(record, { repository, applicationSha, expectedPath: recordPath });
  validateRecordTransition(prior, record);
  const bytes = Buffer.from(canonicalJson(record));
  if (bytes.length > MAX_RECORD_BYTES) fail('WEBHOOK_LEDGER_RECORD_OVERSIZE', recordPath);
  const expectedRecordSha = sha256(bytes);
  let commitSha = null;
  try {
    const currentRef = (await client.request('GET',
      `/git/ref/heads/${encodeURIComponent(WEBHOOK_LEDGER_BRANCH)}`)).value;
    if (currentRef?.object?.sha !== inventory.ledger_head_sha) {
      fail('WEBHOOK_LEDGER_NON_FAST_FORWARD', 'head changed before append');
    }
    const blob = (await client.request('POST', '/git/blobs',
      { content: bytes.toString('base64'), encoding: 'base64' }, [201])).value;
    if (blob?.sha !== gitBlobSha(bytes)) fail('WEBHOOK_LEDGER_APPEND_READBACK_INVALID', 'blob');
    const headCommit = (await client.request('GET', `/git/commits/${inventory.ledger_head_sha}`)).value;
    const tree = (await client.request('POST', '/git/trees', {
      base_tree: headCommit.tree.sha,
      tree: [{ path: recordPath, mode: '100644', type: 'blob', sha: blob.sha }],
    }, [201])).value;
    if (!SHA40.test(tree?.sha || '')) fail('WEBHOOK_LEDGER_APPEND_READBACK_INVALID', 'tree');
    const commit = (await client.request('POST', '/git/commits', {
      message: 'Append AssessSuite Physio webhook ledger record', tree: tree.sha,
      parents: [inventory.ledger_head_sha],
    }, [201])).value;
    if (!SHA40.test(commit?.sha || '')) fail('WEBHOOK_LEDGER_APPEND_READBACK_INVALID', 'commit');
    commitSha = commit.sha;
    await client.request('PATCH', `/git/refs/heads/${encodeURIComponent(WEBHOOK_LEDGER_BRANCH)}`,
      { sha: commitSha, force: false }, [200]);
  } catch (error) {
    const reconciled = await inspectWebhookLedger({ client, repository });
    const found = reconciled.source_identities.get(sourceKey(request.source));
    if (!found || found.sha256 !== expectedRecordSha || found.path !== recordPath) throw error;
    return buildAppendResult(reconciled, found, true);
  }
  const readback = await inspectWebhookLedger({ client, repository });
  const found = readback.source_identities.get(sourceKey(request.source));
  if (!found || found.commit_sha !== commitSha || found.path !== recordPath ||
      found.sha256 !== expectedRecordSha || found.record.packet_manifest_sha256 !== record.packet_manifest_sha256) {
    fail('WEBHOOK_LEDGER_APPEND_READBACK_INVALID', recordPath);
  }
  return buildAppendResult(readback, found, false);
}

function buildAppendResult(inventory, row, reconciled) {
  return Object.freeze({
    contract_version: 'assesssuite-physio-webhook-ledger-append/1.0.0', result: 'PASS',
    response_loss_reconciled: reconciled, repository: inventory.repository,
    ledger_branch: inventory.ledger_branch, ledger_genesis_sha: inventory.ledger_genesis_sha,
    ledger_provisioning_commit_sha: inventory.ledger_provisioning_commit_sha,
    ledger_provisioning_receipt_sha256: inventory.ledger_provisioning_receipt_sha256,
    ledger_ruleset_id: inventory.ledger_ruleset_id,
    ledger_head_sha: inventory.ledger_head_sha, ledger_commit_sha: row.commit_sha,
    ledger_record_path: row.path, ledger_record_blob_sha: row.blob_sha,
    ledger_record_sha256: row.sha256, packet_manifest_sha256: row.record.packet_manifest_sha256,
    record: row.record,
  });
}

export function buildWebhookArchiveReceipt(appendResult, archivedAt = appendResult.record.recorded_at) {
  safeTimestamp(archivedAt, 'archivedAt');
  const record = appendResult.record;
  return Object.freeze({
    contract_version: WEBHOOK_LEDGER_RECEIPT_CONTRACT,
    result: 'PASS',
    repository: appendResult.repository,
    application_sha: record.application_sha,
    archived_at: archivedAt,
    source_workflow_run_id: record.source.workflow_run_id,
    source_workflow_run_attempt: record.source.workflow_run_attempt,
    source_workflow_run_path: record.source.workflow_run_path,
    source_workflow_run_conclusion: record.source.workflow_run_conclusion,
    source_artifact_id: record.source.artifact_id,
    source_artifact_name: record.source.artifact_name,
    source_artifact_digest: record.source.artifact_digest,
    source_artifact_size_in_bytes: record.source.artifact_size_in_bytes,
    source_artifact_admission_sha256: record.source.artifact_admission_sha256,
    source_artifact_receipt_sha256: record.source.artifact_receipt_sha256,
    source_repository: record.source.repository,
    source_workflow_run_head_sha: record.source.workflow_run_head_sha,
    lifecycle_kind: record.lifecycle.kind,
    lifecycle_result: record.lifecycle.result,
    effect_generation: record.lifecycle.effect_generation,
    lifecycle_control_receipt_sha256: record.lifecycle.control_receipt_sha256,
    started_effect_receipt_sha256: record.lifecycle.started_effect_receipt_sha256,
    request_sha256: record.lifecycle.request_sha256,
    ledger_branch: appendResult.ledger_branch,
    ledger_genesis_sha: appendResult.ledger_genesis_sha,
    ledger_provisioning_commit_sha: appendResult.ledger_provisioning_commit_sha,
    ledger_provisioning_receipt_sha256: appendResult.ledger_provisioning_receipt_sha256,
    ledger_ruleset_id: appendResult.ledger_ruleset_id,
    ledger_head_sha: appendResult.ledger_head_sha,
    ledger_commit_sha: appendResult.ledger_commit_sha,
    ledger_record_path: appendResult.ledger_record_path,
    ledger_record_blob_sha: appendResult.ledger_record_blob_sha,
    ledger_record_sha256: appendResult.ledger_record_sha256,
    ledger_packet_manifest_sha256: appendResult.packet_manifest_sha256,
  });
}

export function validateWebhookArchiveReceipt(receipt, expected) {
  const keys = [
    'application_sha', 'archived_at', 'contract_version', 'effect_generation', 'ledger_branch',
    'ledger_commit_sha', 'ledger_genesis_sha', 'ledger_head_sha', 'ledger_packet_manifest_sha256',
    'ledger_provisioning_commit_sha', 'ledger_provisioning_receipt_sha256', 'ledger_ruleset_id',
    'ledger_record_blob_sha', 'ledger_record_path', 'ledger_record_sha256', 'lifecycle_control_receipt_sha256',
    'lifecycle_kind', 'lifecycle_result', 'repository', 'request_sha256', 'result',
    'source_artifact_admission_sha256', 'source_artifact_digest', 'source_artifact_id',
    'source_artifact_size_in_bytes',
    'source_artifact_name', 'source_artifact_receipt_sha256', 'source_workflow_run_attempt',
    'source_repository', 'source_workflow_run_conclusion', 'source_workflow_run_head_sha',
    'source_workflow_run_id', 'source_workflow_run_path',
    'started_effect_receipt_sha256',
  ];
  exactKeys(receipt, keys, 'WEBHOOK_LEDGER_RECEIPT_INVALID', 'receipt');
  exactKeys(expected, [
    'applicationSha', 'archiveArtifactDigest', 'archiveArtifactId', 'archiveArtifactName',
    'archiveReceiptSha256', 'repository',
  ], 'WEBHOOK_LEDGER_RECEIPT_INVALID', 'receipt expectation');
  if (receipt.contract_version !== WEBHOOK_LEDGER_RECEIPT_CONTRACT || receipt.result !== 'PASS' ||
      receipt.repository !== expected.repository || receipt.application_sha !== expected.applicationSha ||
      receipt.source_repository !== expected.repository ||
      receipt.source_workflow_run_head_sha !== expected.applicationSha ||
      receipt.source_artifact_receipt_sha256 !== receipt.lifecycle_control_receipt_sha256 ||
      receipt.source_artifact_name !== `physio-production-stripe-webhook-${expected.applicationSha}` ||
      receipt.ledger_branch !== WEBHOOK_LEDGER_BRANCH || receipt.lifecycle_kind !== 'COMPLETED' ||
      receipt.lifecycle_result !== 'COMPLETED' ||
      !Number.isSafeInteger(receipt.ledger_ruleset_id) || receipt.ledger_ruleset_id < 1 ||
      sha256(canonicalJson(receipt)) !== expected.archiveReceiptSha256 ||
      expected.archiveArtifactName !== `physio-webhook-archive-${expected.applicationSha}` ||
      !Number.isSafeInteger(expected.archiveArtifactId) || expected.archiveArtifactId < 1 ||
      !Number.isSafeInteger(receipt.source_artifact_id) || receipt.source_artifact_id < 1 ||
      !Number.isSafeInteger(receipt.source_artifact_size_in_bytes) ||
      receipt.source_artifact_size_in_bytes < 1 || receipt.source_artifact_size_in_bytes > 33_554_432 ||
      !Number.isSafeInteger(receipt.source_workflow_run_id) || receipt.source_workflow_run_id < 1 ||
      !Number.isSafeInteger(receipt.source_workflow_run_attempt) || receipt.source_workflow_run_attempt < 1 ||
      receipt.source_workflow_run_path !== '.github/workflows/physio-production-stripe-webhook.yml' ||
      receipt.source_workflow_run_conclusion !== 'success') {
    fail('WEBHOOK_LEDGER_RECEIPT_INVALID', 'identity');
  }
  assertString(expected.archiveArtifactDigest, ARTIFACT_DIGEST,
    'WEBHOOK_LEDGER_RECEIPT_INVALID', 'archive digest');
  assertString(expected.archiveReceiptSha256, SHA256,
    'WEBHOOK_LEDGER_RECEIPT_INVALID', 'archive receipt SHA');
  safeTimestamp(receipt.archived_at, 'archive receipt timestamp');
  assertString(receipt.source_artifact_digest, ARTIFACT_DIGEST,
    'WEBHOOK_LEDGER_RECEIPT_INVALID', 'source artifact digest');
  for (const field of [
    'ledger_genesis_sha', 'ledger_head_sha', 'ledger_commit_sha', 'ledger_record_blob_sha',
  ]) assertString(receipt[field], SHA40, 'WEBHOOK_LEDGER_RECEIPT_INVALID', field);
  for (const field of [
    'source_artifact_admission_sha256', 'source_artifact_receipt_sha256',
    'lifecycle_control_receipt_sha256', 'started_effect_receipt_sha256', 'request_sha256',
    'ledger_record_sha256', 'ledger_packet_manifest_sha256',
  ]) assertString(receipt[field], SHA256, 'WEBHOOK_LEDGER_RECEIPT_INVALID', field);
  return receipt;
}

export async function materializeWebhookPacketFromLedger({ client, repository, applicationSha,
  archiveReceipt, outputDirectory, expectation }) {
  const inventory = await inspectWebhookLedger({ client, repository });
  const row = inventory.records.find((entry) => entry.commit_sha === archiveReceipt.ledger_commit_sha &&
    entry.path === archiveReceipt.ledger_record_path && entry.sha256 === archiveReceipt.ledger_record_sha256);
  const commitOrder = [inventory.ledger_genesis_sha, ...inventory.records.map((entry) => entry.commit_sha)];
  const recordIndex = commitOrder.indexOf(archiveReceipt.ledger_commit_sha);
  const receiptHeadIndex = commitOrder.indexOf(archiveReceipt.ledger_head_sha);
  const source = row?.record.source;
  const lifecycle = row?.record.lifecycle;
  if (!row || row.record.application_sha !== applicationSha ||
      recordIndex < 1 || receiptHeadIndex < recordIndex ||
      archiveReceipt.repository !== repository || archiveReceipt.application_sha !== applicationSha ||
      archiveReceipt.ledger_branch !== inventory.ledger_branch ||
      archiveReceipt.ledger_genesis_sha !== inventory.ledger_genesis_sha ||
      archiveReceipt.ledger_provisioning_commit_sha !== inventory.ledger_provisioning_commit_sha ||
      archiveReceipt.ledger_provisioning_receipt_sha256 !== inventory.ledger_provisioning_receipt_sha256 ||
      archiveReceipt.ledger_ruleset_id !== inventory.ledger_ruleset_id ||
      row.blob_sha !== archiveReceipt.ledger_record_blob_sha ||
      row.record.packet_manifest_sha256 !== archiveReceipt.ledger_packet_manifest_sha256 ||
      source.artifact_admission_sha256 !== archiveReceipt.source_artifact_admission_sha256 ||
      source.artifact_digest !== archiveReceipt.source_artifact_digest ||
      source.artifact_id !== archiveReceipt.source_artifact_id ||
      source.artifact_name !== archiveReceipt.source_artifact_name ||
      source.artifact_receipt_sha256 !== archiveReceipt.source_artifact_receipt_sha256 ||
      source.artifact_size_in_bytes !== archiveReceipt.source_artifact_size_in_bytes ||
      source.repository !== archiveReceipt.source_repository ||
      source.workflow_run_attempt !== archiveReceipt.source_workflow_run_attempt ||
      source.workflow_run_conclusion !== archiveReceipt.source_workflow_run_conclusion ||
      source.workflow_run_head_sha !== archiveReceipt.source_workflow_run_head_sha ||
      source.workflow_run_id !== archiveReceipt.source_workflow_run_id ||
      source.workflow_run_path !== archiveReceipt.source_workflow_run_path ||
      lifecycle.kind !== archiveReceipt.lifecycle_kind ||
      lifecycle.result !== archiveReceipt.lifecycle_result ||
      lifecycle.effect_generation !== archiveReceipt.effect_generation ||
      lifecycle.control_receipt_sha256 !== archiveReceipt.lifecycle_control_receipt_sha256 ||
      lifecycle.started_effect_receipt_sha256 !== archiveReceipt.started_effect_receipt_sha256 ||
      lifecycle.request_sha256 !== archiveReceipt.request_sha256) {
    fail('WEBHOOK_LEDGER_MATERIALIZATION_INVALID', 'receipt-to-ledger join');
  }
  materializeWebhookPacketBundle(row.record.packet, outputDirectory);
  const proof = validateWebhookPacketForArchive(outputDirectory, row.record.lifecycle.kind, expectation);
  if (JSON.stringify(proof) !== JSON.stringify(row.record.lifecycle)) {
    fail('WEBHOOK_LEDGER_MATERIALIZATION_INVALID', 'owning validator result');
  }
  return { inventory, row, proof };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith('--') || argv[index + 1] === undefined) {
      fail('WEBHOOK_LEDGER_ARGUMENT_INVALID', argv[index] || 'missing');
    }
    args[argv[index].slice(2)] = argv[index + 1];
  }
  return args;
}

function readJson(file, max = MAX_RECORD_BYTES) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > max) {
    fail('WEBHOOK_LEDGER_FILE_INVALID', file);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeNew(file, value) {
  fs.writeFileSync(file, canonicalJson(value), { flag: 'wx', mode: 0o600 });
}

async function main(argv = process.argv.slice(2)) {
  const command = argv.shift();
  const args = parseArgs(argv);
  const repository = args.repository;
  const token = process.env[args['token-env'] || 'GITHUB_TOKEN'];
  const client = createWebhookLedgerGitHubClient({ repository, token });
  if (command === 'ruleset-receipt') {
    const ruleset = readJson(args['provider-response']);
    const genesisReadback = readJson(args['genesis-readback']);
    writeNew(args.output, buildWebhookLedgerRulesetProvisioningReceipt({ repository, ruleset,
      genesisReadback,
      observedAt: args['observed-at'] || new Date().toISOString(),
      providerApiVersion: args['provider-api-version'] || '2022-11-28' }));
    return;
  }
  if (command === 'create-genesis') {
    writeNew(args.output, await createWebhookLedgerGenesis({ client, repository }));
    return;
  }
  if (command === 'append-provisioning') {
    const provisioningReceipt = readJson(args['provisioning-receipt']);
    writeNew(args.output, await appendWebhookLedgerProvisioningReceipt({ client, repository,
      provisioningReceipt, expectedGenesisSha: args['expected-genesis-sha'] }));
    return;
  }
  if (command === 'inspect') {
    const inventory = await inspectWebhookLedger({ client, repository });
    writeNew(args.output, { ...inventory, application_records: undefined, source_identities: undefined });
    return;
  }
  if (command === 'append') {
    const request = readJson(args.request);
    const expectation = request.expectation;
    const lifecycle = validateWebhookPacketForArchive(args['packet-directory'], request.lifecycle_kind, expectation);
    const packet = buildWebhookPacketBundle(args['packet-directory'],
      (args['secret-env-names'] || '').split(',').filter(Boolean).map((name) => process.env[name]));
    const append = await appendWebhookLedgerRecord({ client, repository,
      applicationSha: expectation.applicationSha,
      request: { source: request.source, lifecycle, packet } });
    const receipt = buildWebhookArchiveReceipt(append);
    fs.mkdirSync(args['archive-directory'], { recursive: false, mode: 0o700 });
    writeNew(path.join(args['archive-directory'], 'physio-webhook-archive-receipt.json'), receipt);
    materializeWebhookPacketBundle(append.record.packet, path.join(args['archive-directory'], 'packet'));
    writeNew(args.output, append);
    return;
  }
  if (command === 'materialize') {
    const receipt = readJson(args.receipt);
    const expectation = readJson(args.expectation);
    await materializeWebhookPacketFromLedger({ client, repository,
      applicationSha: expectation.applicationSha, archiveReceipt: receipt,
      outputDirectory: args['output-directory'], expectation });
    writeNew(args.output, { contract_version: 'assesssuite-physio-webhook-ledger-materialization/1.0.0',
      result: 'PASS', application_sha: expectation.applicationSha,
      ledger_commit_sha: receipt.ledger_commit_sha, materialized_at: new Date().toISOString() });
    return;
  }
  if (command === 'rehydrate') {
    const expectation = readJson(args.expectation);
    const applicationSha = args['application-sha'];
    assertString(applicationSha, SHA40, 'WEBHOOK_LEDGER_APPLICATION_INVALID', 'application SHA');
    assertString(args['ledger-commit-sha'], SHA40,
      'WEBHOOK_LEDGER_ARGUMENT_INVALID', 'ledger commit SHA');
    const inventory = await inspectWebhookLedger({ client, repository });
    const row = inventory.records.find((entry) =>
      entry.commit_sha === args['ledger-commit-sha'] && entry.record.application_sha === applicationSha);
    if (!row) fail('WEBHOOK_LEDGER_MATERIALIZATION_INVALID', 'record commit is absent');
    fs.mkdirSync(args['archive-directory'], { recursive: false, mode: 0o700 });
    const packetDirectory = path.join(args['archive-directory'], 'packet');
    materializeWebhookPacketBundle(row.record.packet, packetDirectory);
    const proof = validateWebhookPacketForArchive(packetDirectory, row.record.lifecycle.kind, expectation);
    if (JSON.stringify(proof) !== JSON.stringify(row.record.lifecycle)) {
      fail('WEBHOOK_LEDGER_MATERIALIZATION_INVALID', 'owning validator result');
    }
    const append = buildAppendResult(inventory, row, true);
    writeNew(path.join(args['archive-directory'], 'physio-webhook-archive-receipt.json'),
      buildWebhookArchiveReceipt(append));
    writeNew(args.output, { contract_version: 'assesssuite-physio-webhook-ledger-rehydration/1.0.0',
      result: 'PASS', application_sha: applicationSha, ledger_commit_sha: row.commit_sha,
      ledger_record_sha256: row.sha256, packet_manifest_sha256: row.record.packet_manifest_sha256,
      rehydrated_at: new Date().toISOString() });
    return;
  }
  fail('WEBHOOK_LEDGER_ARGUMENT_INVALID', command || 'missing command');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
