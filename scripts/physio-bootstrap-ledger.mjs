#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEDGER_BRANCH = 'assesssuite-physio-bootstrap-ledger';
export const LEDGER_CONTRACT = 'assesssuite-physio-bootstrap-ledger-record/2.0.0';
export const LEDGER_INVENTORY_CONTRACT = 'assesssuite-physio-bootstrap-ledger-inventory/1.0.0';
export const LEDGER_GENESIS_CONTRACT = 'assesssuite-physio-bootstrap-ledger-genesis/1.0.0';
export const LEDGER_PROVISIONING_RECEIPT_CONTRACT =
  'assesssuite-physio-bootstrap-ledger-provisioning-receipt/1.0.0';

const ZERO_SHA256 = '0'.repeat(64);
const STAGES = new Set(['STARTED', 'PROVIDER_ADMISSION', 'PROVIDER_RECONCILIATION', 'TERMINAL']);
const STAGE_EFFECT_RESULTS = new Map([
  ['STARTED', new Set(['STARTED'])],
  ['PROVIDER_ADMISSION', new Set(['STARTED'])],
  ['PROVIDER_RECONCILIATION', new Set(['RECOVERY_RETRY_ADMITTED'])],
  ['TERMINAL', new Set(['COMPLETED'])],
]);
const MAX_RESPONSE_BYTES = 33_554_432;
const MAX_RECORD_BYTES = 25_165_824;
const MAX_PACKET_BYTES = 16_777_216;
const MAX_LEDGER_COMMITS = 10_000;
const MAX_DECODE_DEPTH = 4;
const MAX_DECODE_CANDIDATES = 4_096;
const MAX_DECODED_BYTES = 4_194_304;
const MAX_BUNDLE_CORPUS_ENTRIES = 8_192;
const MAX_DISTRIBUTED_SECRET_CHARACTERS = 1_024;
const MAX_DISTRIBUTED_SEARCH_STATES = 16_384;
const MIN_DISTRIBUTED_SECRET_FRAGMENT = 4;
export const PACKET_SCAN_POLICY_VERSION =
  'assesssuite-physio-bootstrap-ledger-packet-scan-policy/2.0.0';
export const PACKET_SCAN_PROOF_CONTRACT =
  'assesssuite-physio-bootstrap-ledger-packet-scan-proof/2.0.0';
const PACKET_FILE_PATTERN = /^(?:SHA256SUMS|[A-Za-z0-9][A-Za-z0-9._-]{0,154}\.(?:json|txt))$/u;
const CREDENTIAL_PATTERN = /(?:(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{8,}|whsec_[A-Za-z0-9_-]{8,}|re_[A-Za-z0-9_-]{8,}|sk-(?:proj-)?[A-Za-z0-9_-]{8,}|github_pat_[A-Za-z0-9_]{8,}|gh[oprsu]_[A-Za-z0-9]{20,}|flyv1\s+[A-Za-z0-9._-]{8,}|AKIA[0-9A-Z]{16}|-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----|https:\/\/[^\s/@:]+:[^\s/@]+@[^\s/]*ingest\.sentry\.io(?:\/[^\s]*)?|(?:authorization\s*[:=]\s*)?(?:bearer|basic)\s+[A-Za-z0-9._~+\/-]{12,}={0,2})/iu;
const PROVIDER_SECRET_NAMES = ['ADMIN_PASSWORD', 'APP_URL', 'EXPECTED_APP_URL', 'OPENAI_API_KEY',
  'RESEND_API_KEY', 'SENTRY_DSN', 'STRIPE_PRICE_ID_ANNUAL', 'STRIPE_PRICE_ID_MONTHLY',
  'STRIPE_SECRET_KEY'];

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

function assertString(value, pattern, code, field) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(code, `${field} differs`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function gitBlobSha(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function epochMilliseconds(value, code, field) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) fail(code, `${field} differs`);
  return milliseconds;
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
    try {
      stat = fs.lstatSync(cursor);
    } catch {
      fail('LEDGER_PACKET_PATH_INVALID', cursor);
    }
    if (stat.isSymbolicLink()) fail('LEDGER_PACKET_LINK_REJECTED', cursor);
  }
  return absolute;
}

function readStableRegularFile(filePath, maximumBytes = MAX_PACKET_BYTES) {
  const absolute = assertNoLinkedPath(filePath);
  const before = fs.lstatSync(absolute);
  if (!before.isFile() || before.isSymbolicLink() || before.size > maximumBytes) {
    fail('LEDGER_PACKET_INVALID', absolute);
  }
  let descriptor;
  try {
    descriptor = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || !sameFileIdentity(before, opened) || opened.size > maximumBytes) {
      fail('LEDGER_PACKET_RACE_REJECTED', absolute);
    }
    const first = Buffer.alloc(opened.size);
    const second = Buffer.alloc(opened.size);
    if (fs.readSync(descriptor, first, 0, first.length, 0) !== first.length ||
        fs.readSync(descriptor, second, 0, second.length, 0) !== second.length ||
        !first.equals(second)) fail('LEDGER_PACKET_RACE_REJECTED', absolute);
    const afterRead = fs.fstatSync(descriptor);
    const afterPath = fs.lstatSync(absolute);
    if (!sameFileIdentity(opened, afterRead) || !sameFileIdentity(opened, afterPath) ||
        afterPath.isSymbolicLink()) fail('LEDGER_PACKET_RACE_REJECTED', absolute);
    return first;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function textFromBytes(bytes, name) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/[^\t\n\r\x20-\x7e\u00a0-\ufffd]/u.test(text)) {
      fail('LEDGER_PACKET_BINARY_REJECTED', name);
    }
    return text;
  } catch (error) {
    if (String(error?.message || '').startsWith('LEDGER_')) throw error;
    fail('LEDGER_PACKET_BINARY_REJECTED', name);
  }
}

function jsonScalars(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const scalars = [];
  const pending = [parsed];
  let visited = 0;
  while (pending.length > 0) {
    const value = pending.pop();
    visited += 1;
    if (visited > MAX_DECODE_CANDIDATES) fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', 'JSON nodes');
    if (typeof value === 'string') {
      scalars.push(value);
      if (scalars.length > MAX_DECODE_CANDIDATES) fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', 'JSON scalars');
    } else if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) pending.push(value[index]);
    } else if (value && typeof value === 'object') {
      const entries = Object.entries(value);
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [key, entry] = entries[index];
        scalars.push(key);
        if (scalars.length > MAX_DECODE_CANDIDATES) fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', 'JSON scalars');
        pending.push(entry);
      }
    }
  }
  return scalars;
}

function normalizedSearchValues(value) {
  const normalized = [...new Set([value, value.normalize('NFC'), value.normalize('NFKC')])];
  return [...new Set([...normalized,
    ...normalized.map((candidate) => candidate.replace(/[\s\p{Cf}]+/gu, ''))])];
}

function decodeBase64Candidate(value) {
  const compact = value.replace(/\s+/gu, '');
  if (compact.length < 12 || compact.length > Math.ceil(MAX_DECODED_BYTES * 4 / 3) + 4 ||
      !/^[A-Za-z0-9+/_-]+={0,2}$/u.test(compact)) return null;
  const standard = compact.replaceAll('-', '+').replaceAll('_', '/');
  const unpadded = standard.replace(/=+$/u, '');
  if (unpadded.length % 4 === 1) return null;
  const padded = `${unpadded}${'='.repeat((4 - unpadded.length % 4) % 4)}`;
  const bytes = Buffer.from(padded, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_DECODED_BYTES ||
      bytes.toString('base64').replace(/=+$/u, '') !== unpadded) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function base64Candidates(value, name) {
  const candidates = [];
  const maximumCharacters = Math.ceil(MAX_DECODED_BYTES * 4 / 3) + 4;
  let start = -1;
  for (let index = 0; index <= value.length; index += 1) {
    const character = value[index];
    const code = character?.charCodeAt(0) ?? -1;
    const isAlphabet = (code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) || code === 43 || code === 47 || code === 95 || code === 45;
    if (isAlphabet && start < 0) start = index;
    if (isAlphabet) {
      if (index - start + 1 > maximumCharacters) fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', name);
      continue;
    }
    if (start < 0) continue;
    let end = index;
    while (end < value.length && value[end] === '=' && end - index < 2) end += 1;
    if (end - start >= 12) {
      candidates.push(value.slice(start, end));
      if (candidates.length > MAX_DECODE_CANDIDATES) fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', name);
    }
    start = -1;
    if (end > index) index = end - 1;
  }
  return candidates;
}

function scanPacketText(text, name, exactSecrets) {
  const queue = [{ value: text, depth: 0 }];
  const scalars = jsonScalars(text);
  for (const scalar of scalars) queue.push({ value: scalar, depth: 0 });
  if (scalars.length > 1) {
    const joined = scalars.join('');
    if (Buffer.byteLength(joined) > MAX_PACKET_BYTES) {
      fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', name);
    }
    queue.push({ value: joined, depth: 0 });
  }
  const seen = new Set();
  let decodedBytes = 0;
  let cursor = 0;
  while (cursor < queue.length) {
    if (queue.length > MAX_DECODE_CANDIDATES) fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', name);
    const { value, depth } = queue[cursor++];
    if (typeof value !== 'string' || seen.has(`${depth}\0${value}`)) continue;
    seen.add(`${depth}\0${value}`);
    const normalizedValues = [...new Set([value, value.normalize('NFC'), value.normalize('NFKC')])];
    const whitespaceCollapsed = value.replace(/[\s\p{Cf}]+/gu, '');
    const searchableValues = [...new Set([...normalizedValues,
      ...normalizedValues.map((candidate) => candidate.replace(/[\s\p{Cf}]+/gu, ''))])];
    if (searchableValues.some((candidate) => CREDENTIAL_PATTERN.test(candidate)) ||
        exactSecrets.some((secret) => {
          const secretValues = [...new Set([secret, secret.normalize('NFC'), secret.normalize('NFKC')])];
          return searchableValues.some((candidate) => secretValues.some((expected) =>
            candidate.includes(expected) || (expected.length >= 8 &&
              candidate.includes(expected.replace(/[\s\p{Cf}]+/gu, '')))));
        })) {
      fail('LEDGER_PACKET_SECRET_REJECTED', name);
    }
    let percentDecoded = null;
    if (/%[0-9a-f]{2}/iu.test(value)) {
      let decoded;
      try {
        decoded = decodeURIComponent(value);
      } catch {
        fail('LEDGER_PACKET_ENCODING_INVALID', name);
      }
      if (decoded !== value) {
        percentDecoded = decoded;
      }
    }
    const tokens = [value, whitespaceCollapsed].flatMap((candidate) => base64Candidates(candidate, name));
    if (tokens.length > MAX_DECODE_CANDIDATES) fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', name);
    const decodedTokens = [];
    for (const token of tokens) {
      if (token.replace(/=+$/u, '').length > Math.ceil(MAX_DECODED_BYTES * 4 / 3) + 4) {
        fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', name);
      }
      const decoded = decodeBase64Candidate(token);
      if (decoded !== null && decoded !== token) decodedTokens.push(decoded);
    }
    if (depth >= MAX_DECODE_DEPTH) {
      if (percentDecoded !== null || decodedTokens.length > 0) {
        fail('LEDGER_PACKET_DECODE_DEPTH_EXCEEDED', name);
      }
      continue;
    }
    if (percentDecoded !== null) {
      const decoded = percentDecoded;
        decodedBytes += Buffer.byteLength(decoded);
        if (decodedBytes > MAX_DECODED_BYTES) fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', name);
        queue.push({ value: decoded, depth: depth + 1 });
    }
    for (const decoded of decodedTokens) {
      decodedBytes += Buffer.byteLength(decoded);
      if (decodedBytes > MAX_DECODED_BYTES) fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', name);
      queue.push({ value: decoded, depth: depth + 1 });
    }
  }
  return scalars;
}

function scanPacketBytes(bytes, name, exactSecrets = []) {
  if (!PACKET_FILE_PATTERN.test(name)) fail('LEDGER_PACKET_FILE_TYPE_REJECTED', name);
  const text = textFromBytes(bytes, name);
  const scalars = scanPacketText(text, name, exactSecrets);
  return { text, scalars };
}

function scanDistributedSecretCorpus(corpus, exactSecrets, name) {
  if (corpus.length > MAX_BUNDLE_CORPUS_ENTRIES) {
    fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', `${name} corpus`);
  }
  const sources = corpus.map(({ source, value }) => ({
    source,
    values: normalizedSearchValues(value),
  }));
  for (const secretValue of exactSecrets) {
    for (const secret of normalizedSearchValues(secretValue)) {
      if (secret.length < MIN_DISTRIBUTED_SECRET_FRAGMENT * 2) continue;
      if (secret.length > MAX_DISTRIBUTED_SECRET_CHARACTERS) {
        fail('LEDGER_SECRET_SCAN_INPUT_BOUND_EXCEEDED', name);
      }
      let states = 0;
      const memo = new Map();
      const search = (position, usedSources) => {
        if (position === secret.length) return usedSources.size >= 2;
        const remaining = secret.length - position;
        if (remaining < MIN_DISTRIBUTED_SECRET_FRAGMENT) return false;
        const memoKey = `${position}:${[...usedSources].sort().join(',')}`;
        if (memo.has(memoKey)) return memo.get(memoKey);
        states += 1;
        if (states > MAX_DISTRIBUTED_SEARCH_STATES) {
          fail('LEDGER_PACKET_DISTRIBUTED_SCAN_BOUND_EXCEEDED', name);
        }
        const shortestNeedle = secret.slice(position, position + MIN_DISTRIBUTED_SECRET_FRAGMENT);
        for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
          if (usedSources.has(sourceIndex) ||
              !sources[sourceIndex].values.some((candidate) => candidate.includes(shortestNeedle))) continue;
          for (let end = secret.length; end >= position + MIN_DISTRIBUTED_SECRET_FRAGMENT; end -= 1) {
            if (end < secret.length && secret.length - end < MIN_DISTRIBUTED_SECRET_FRAGMENT) continue;
            const fragment = secret.slice(position, end);
            if (!sources[sourceIndex].values.some((candidate) => candidate.includes(fragment))) continue;
            const nextUsed = new Set(usedSources);
            nextUsed.add(sourceIndex);
            if (search(end, nextUsed)) {
              memo.set(memoKey, true);
              return true;
            }
          }
        }
        memo.set(memoKey, false);
        return false;
      };
      if (search(0, new Set())) fail('LEDGER_PACKET_DISTRIBUTED_SECRET_REJECTED', name);
    }
  }
}

function validatePacketBundle(packet, exactSecrets = []) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet) ||
      JSON.stringify(Object.keys(packet).sort()) !==
        JSON.stringify(['contract_version', 'files', 'total_size_bytes']) ||
      packet.contract_version !== 'assesssuite-physio-bootstrap-ledger-packet/1.0.0' ||
      !Number.isSafeInteger(packet.total_size_bytes) || packet.total_size_bytes <= 0 ||
      packet.total_size_bytes > MAX_PACKET_BYTES || !Array.isArray(packet.files) ||
      packet.files.length < 2 || packet.files.length > 256) {
    fail('LEDGER_PACKET_INVALID', 'packet envelope differs');
  }
  let total = 0;
  const names = [];
  const bytesByName = new Map();
  const corpus = [];
  for (const file of packet.files) {
    if (!file || typeof file !== 'object' || Array.isArray(file) ||
        JSON.stringify(Object.keys(file).sort()) !==
          JSON.stringify(['content_base64', 'name', 'sha256', 'size_bytes'])) {
      fail('LEDGER_PACKET_INVALID', 'file differs');
    }
    assertString(file.name, PACKET_FILE_PATTERN,
      'LEDGER_PACKET_INVALID', 'file name');
    assertString(file.sha256, /^[0-9a-f]{64}$/u, 'LEDGER_PACKET_INVALID', 'file sha256');
    if (!Number.isSafeInteger(file.size_bytes) || file.size_bytes < 0 || file.size_bytes > MAX_PACKET_BYTES ||
        typeof file.content_base64 !== 'string') fail('LEDGER_PACKET_INVALID', file.name);
    const bytes = Buffer.from(file.content_base64, 'base64');
    if (bytes.length !== file.size_bytes || bytes.toString('base64') !== file.content_base64 ||
        sha256(bytes) !== file.sha256) fail('LEDGER_PACKET_TAMPERED', file.name);
    const scanned = scanPacketBytes(bytes, file.name, exactSecrets);
    total += bytes.length;
    names.push(file.name);
    bytesByName.set(file.name, bytes);
    corpus.push({ source: `${file.name}:name`, value: file.name });
    corpus.push({ source: `${file.name}:raw`, value: scanned.text });
    scanned.scalars.forEach((value, index) => {
      corpus.push({ source: `${file.name}:scalar:${index}`, value });
    });
    if (corpus.length > MAX_BUNDLE_CORPUS_ENTRIES) {
      fail('LEDGER_PACKET_DECODE_BOUND_EXCEEDED', 'packet corpus');
    }
  }
  const portableNames = names.map((name) => name.normalize('NFKC').toLocaleLowerCase('en-US'));
  if (new Set(names).size !== names.length || new Set(portableNames).size !== portableNames.length ||
      names.some((name) => /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)) ||
      JSON.stringify(names) !== JSON.stringify([...names].sort()) ||
      total !== packet.total_size_bytes || !bytesByName.has('SHA256SUMS')) {
    fail('LEDGER_PACKET_INVALID', 'file inventory differs');
  }
  const expectedNames = names.filter((name) => name !== 'SHA256SUMS');
  const expectedSums = Buffer.from(expectedNames.map((name) =>
    `${sha256(bytesByName.get(name))}  ${name}\n`).join(''));
  if (!bytesByName.get('SHA256SUMS').equals(expectedSums)) {
    fail('LEDGER_PACKET_SUMS_INVALID', 'SHA256SUMS inventory differs');
  }
  scanDistributedSecretCorpus(corpus, exactSecrets, 'packet bundle');
  return bytesByName;
}

export function buildPacketBundle(packetDirectory, secretValues = []) {
  const absolutePacketDirectory = assertNoLinkedPath(packetDirectory);
  const stat = fs.lstatSync(absolutePacketDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('LEDGER_PACKET_INVALID', 'packet root differs');
  if (fs.realpathSync.native(absolutePacketDirectory) !== absolutePacketDirectory) {
    fail('LEDGER_PACKET_LINK_REJECTED', absolutePacketDirectory);
  }
  const names = fs.readdirSync(absolutePacketDirectory).sort();
  const files = [];
  let total = 0;
  const exactSecrets = secretValues.filter((value) => typeof value === 'string' && value.length > 0);
  for (const name of names) {
    assertString(name, PACKET_FILE_PATTERN,
      'LEDGER_PACKET_INVALID', 'file name');
    const filePath = path.join(absolutePacketDirectory, name);
    const bytes = readStableRegularFile(filePath);
    total += bytes.length;
    if (total > MAX_PACKET_BYTES) fail('LEDGER_PACKET_OVERSIZE', packetDirectory);
    scanPacketBytes(bytes, name, exactSecrets);
    files.push({ name, size_bytes: bytes.length, sha256: sha256(bytes), content_base64: bytes.toString('base64') });
  }
  const packet = { contract_version: 'assesssuite-physio-bootstrap-ledger-packet/1.0.0',
    total_size_bytes: total, files };
  validatePacketBundle(packet, exactSecrets);
  return packet;
}

export function materializePacketBundle(packet, outputDirectory, { packetScanProof, secretEntries } = {}) {
  validatePacketScanProof(packetScanProof, packet, secretEntries ?? null);
  const bytesByName = validatePacketBundle(packet,
    normalizedSecretEntries(secretEntries ?? []).map(({ value }) => value));
  const absoluteOutput = assertNoLinkedPath(outputDirectory, { allowMissingLeaf: true });
  if (fs.existsSync(absoluteOutput)) fail('LEDGER_PACKET_OUTPUT_EXISTS', absoluteOutput);
  fs.mkdirSync(absoluteOutput, { recursive: false, mode: 0o700 });
  const outputStat = fs.lstatSync(absoluteOutput);
  if (!outputStat.isDirectory() || outputStat.isSymbolicLink() ||
      fs.realpathSync.native(absoluteOutput) !== absoluteOutput) fail('LEDGER_PACKET_LINK_REJECTED', absoluteOutput);
  for (const [name, bytes] of bytesByName) {
    fs.writeFileSync(path.join(absoluteOutput, name), bytes, { flag: 'wx', mode: 0o600 });
  }
}

function readProviderDigestMap(filePath) {
  const bytes = readStableRegularFile(filePath, 65_536);
  if (bytes.length <= 0 || bytes.length > 65_536) fail('LEDGER_PROVIDER_DIGEST_MAP_INVALID', filePath);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('LEDGER_PROVIDER_DIGEST_MAP_INVALID', filePath);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(['contract_version', 'secrets']) ||
      value.contract_version !== 'assesssuite-fly-secret-metadata/1.0.0' || !Array.isArray(value.secrets)) {
    fail('LEDGER_PROVIDER_DIGEST_MAP_INVALID', filePath);
  }
  const names = [];
  for (const row of value.secrets) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(['digest', 'name', 'status']) ||
        typeof row.name !== 'string' || !PROVIDER_SECRET_NAMES.includes(row.name) ||
        !/^[0-9a-f]{16,64}$/u.test(row.digest || '') || row.status !== 'Staged') {
      fail('LEDGER_PROVIDER_DIGEST_MAP_INVALID', filePath);
    }
    names.push(row.name);
  }
  if (new Set(names).size !== names.length || JSON.stringify(names) !== JSON.stringify([...names].sort()) ||
      !bytes.equals(Buffer.from(canonicalJson(value)))) {
    fail('LEDGER_PROVIDER_DIGEST_MAP_INVALID', filePath);
  }
  return { bytes, sha256: sha256(bytes), names };
}

function readStableJson(filePath, maximumBytes, code) {
  const bytes = readStableRegularFile(filePath, maximumBytes);
  try {
    return JSON.parse(textFromBytes(bytes, path.basename(filePath)));
  } catch (error) {
    if (String(error?.message || '').startsWith('LEDGER_')) throw error;
    fail(code, filePath);
  }
}

export function verifyProviderDigestMap(expectedPath, observedPath) {
  const expected = readProviderDigestMap(expectedPath);
  const observed = readProviderDigestMap(observedPath);
  if (!expected.bytes.equals(observed.bytes)) {
    fail('LEDGER_PROVIDER_DIGEST_DRIFT', `${expected.sha256} != ${observed.sha256}`);
  }
  return { contract_version: 'assesssuite-physio-bootstrap-provider-digest-stability/1.0.0', result: 'PASS',
    expected_sha256: expected.sha256, observed_sha256: observed.sha256,
    secret_names: expected.names, verified_at: new Date().toISOString() };
}

function packetSummary(packet) {
  return { contract_version: packet.contract_version, total_size_bytes: packet.total_size_bytes,
    files: packet.files.map(({ name, size_bytes, sha256: fileSha256 }) =>
      ({ name, size_bytes, sha256: fileSha256 })) };
}

function packetBundleSha256(packet) {
  validatePacketBundle(packet);
  return sha256(Buffer.from(canonicalJson(packet)));
}

function normalizedSecretEntries(secretEntries) {
  if (!Array.isArray(secretEntries)) fail('LEDGER_SECRET_SCAN_INPUT_INVALID', 'secret entries differ');
  const normalized = secretEntries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(['name', 'value']) ||
        typeof entry.name !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/u.test(entry.name) ||
        typeof entry.value !== 'string' || entry.value.length === 0 ||
        entry.value.length > MAX_DISTRIBUTED_SECRET_CHARACTERS) {
      fail('LEDGER_SECRET_SCAN_INPUT_INVALID', entry?.name || 'unknown');
    }
    return { name: entry.name, value: entry.value };
  }).sort((left, right) => left.name.localeCompare(right.name));
  if (new Set(normalized.map(({ name }) => name)).size !== normalized.length) {
    fail('LEDGER_SECRET_SCAN_INPUT_INVALID', 'duplicate secret name');
  }
  return normalized;
}

function durableSecretSet(normalized) {
  return normalized.filter(({ name }) => name !== 'GITHUB_TOKEN');
}

function secretSetFingerprint(normalized) {
  const durable = durableSecretSet(normalized);
  const fingerprints = durable.map(({ name, value }) =>
    ({ name, value_sha256: sha256(Buffer.from(value)) }));
  return sha256(Buffer.from(canonicalJson(fingerprints)));
}

export function buildPacketScanProof(packet, secretEntries) {
  const normalized = normalizedSecretEntries(secretEntries);
  validatePacketBundle(packet, normalized.map(({ value }) => value));
  const durable = durableSecretSet(normalized);
  return {
    contract_version: PACKET_SCAN_PROOF_CONTRACT,
    result: 'PASS',
    scanner_policy_version: PACKET_SCAN_POLICY_VERSION,
    packet_bundle_sha256: packetBundleSha256(packet),
    durable_secret_names: durable.map(({ name }) => name),
    durable_secret_set_fingerprint_sha256: secretSetFingerprint(normalized),
  };
}

function validatePacketScanProof(proof, packet, secretEntries = null) {
  if (!proof || typeof proof !== 'object' || Array.isArray(proof) ||
      JSON.stringify(Object.keys(proof).sort()) !== JSON.stringify([
        'contract_version', 'durable_secret_names', 'durable_secret_set_fingerprint_sha256',
        'packet_bundle_sha256', 'result', 'scanner_policy_version',
      ]) || proof.contract_version !== PACKET_SCAN_PROOF_CONTRACT || proof.result !== 'PASS' ||
      proof.scanner_policy_version !== PACKET_SCAN_POLICY_VERSION ||
      !Array.isArray(proof.durable_secret_names) ||
      JSON.stringify(proof.durable_secret_names) !==
        JSON.stringify([...proof.durable_secret_names].sort()) ||
      new Set(proof.durable_secret_names).size !== proof.durable_secret_names.length ||
      proof.durable_secret_names.some((name) => !/^[A-Z][A-Z0-9_]{0,79}$/u.test(name) ||
        name === 'GITHUB_TOKEN') ||
      !/^[0-9a-f]{64}$/u.test(proof.durable_secret_set_fingerprint_sha256 || '') ||
      proof.packet_bundle_sha256 !== packetBundleSha256(packet)) {
    fail('LEDGER_PACKET_SCAN_PROOF_INVALID', 'packet scan proof differs');
  }
  if (secretEntries !== null) {
    const normalized = normalizedSecretEntries(secretEntries);
    const durable = durableSecretSet(normalized);
    if (JSON.stringify(proof.durable_secret_names) !==
          JSON.stringify(durable.map(({ name }) => name)) ||
        proof.durable_secret_set_fingerprint_sha256 !== secretSetFingerprint(normalized)) {
      fail('LEDGER_PACKET_SCAN_SECRET_SET_MISMATCH', 'materialization secret set differs');
    }
    validatePacketBundle(packet, normalized.map(({ value }) => value));
  }
  return proof;
}

function persistedInventory(inventory) {
  const summarizeRecord = (record) => record ? { ...record, resume_packet: packetSummary(record.resume_packet) } : null;
  return { ...inventory,
    records: inventory.records.map((entry) => ({ ...entry, record: summarizeRecord(entry.record) })),
    latest_record: summarizeRecord(inventory.latest_record),
    active_started_record: summarizeRecord(inventory.active_started_record),
    active_provider_admission_record: summarizeRecord(inventory.active_provider_admission_record),
    active_predecessor_terminal_record: summarizeRecord(inventory.active_predecessor_terminal_record),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--') || index + 1 >= argv.length) fail('LEDGER_ARGUMENT_INVALID', key);
    args[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  return args;
}

function secretEntriesFromArgs(args) {
  const names = (args['secret-env-names'] || '').split(',').filter(Boolean);
  const entries = [];
  for (const name of names) {
    assertString(name, /^[A-Z][A-Z0-9_]{0,79}$/u, 'LEDGER_ARGUMENT_INVALID', 'secret env name');
    if (typeof process.env[name] !== 'string' || process.env[name].length === 0) {
      fail('LEDGER_SECRET_SCAN_INPUT_MISSING', name);
    }
    entries.push({ name, value: process.env[name] });
  }
  return normalizedSecretEntries(entries);
}

function encodeRepositoryPath(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

export function createGitHubClient({ repository, token, fetchImpl = globalThis.fetch,
  apiBase = 'https://api.github.com' }) {
  assertString(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
    'LEDGER_REPOSITORY_INVALID', 'repository');
  if (typeof token !== 'string' || token.length === 0) fail('LEDGER_TOKEN_MISSING', 'GitHub token is required');
  if (typeof fetchImpl !== 'function') fail('LEDGER_FETCH_INVALID', 'fetch implementation is required');
  const repoPath = encodeRepositoryPath(repository);
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  async function request(method, endpoint, body, accepted = [200]) {
    const response = await fetchImpl(`${apiBase}/repos/${repoPath}${endpoint}`, {
      method,
      headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error',
    });
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
      fail('LEDGER_API_RESPONSE_OVERSIZE', `${method} ${endpoint}`);
    }
    let value = null;
    if (text.length > 0) {
      try {
        value = JSON.parse(text);
      } catch {
        fail('LEDGER_API_RESPONSE_INVALID', `${method} ${endpoint}`);
      }
    }
    if (!accepted.includes(response.status)) {
      const error = new Error(`LEDGER_API_STATUS_${response.status}: ${method} ${endpoint}`);
      error.status = response.status;
      error.value = value;
      throw error;
    }
    return { status: response.status, value };
  }

  return { request };
}

function validateArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact) ||
      !Number.isSafeInteger(artifact.id) || artifact.id <= 0) {
    fail('LEDGER_RECORD_INVALID', 'artifact id differs');
  }
  assertString(artifact.name, /^physio-(?:bootstrap-started|bootstrap-provider-admission|production-bootstrap)-[0-9a-f]{40}$/u,
    'LEDGER_RECORD_INVALID', 'artifact name');
  assertString(artifact.digest, /^sha256:[0-9a-f]{64}$/u,
    'LEDGER_RECORD_INVALID', 'artifact digest');
  assertString(artifact.effect_receipt_sha256, /^[0-9a-f]{64}$/u,
    'LEDGER_RECORD_INVALID', 'effect receipt sha256');
  const isStarted = artifact.name.startsWith('physio-bootstrap-started-');
  const isProvider = artifact.name.startsWith('physio-bootstrap-provider-admission-');
  const expectedKeys = ['digest', 'effect_receipt_sha256', 'id', 'name', 'packet_receipt_sha256',
    ...(isProvider ? ['artifact_readback_sha256'] : [])].sort();
  if (JSON.stringify(Object.keys(artifact).sort()) !== JSON.stringify(expectedKeys) ||
      (isStarted ? artifact.packet_receipt_sha256 !== null : artifact.packet_receipt_sha256 === null)) {
    fail('LEDGER_RECORD_INVALID', 'artifact envelope differs');
  }
  if (!isStarted) {
    assertString(artifact.packet_receipt_sha256, /^[0-9a-f]{64}$/u,
      'LEDGER_RECORD_INVALID', 'packet receipt sha256');
  }
  if (isProvider) {
    assertString(artifact.artifact_readback_sha256, /^[0-9a-f]{64}$/u,
      'LEDGER_RECORD_INVALID', 'artifact readback sha256');
  }
}

export function validateLedgerRecord(record, { repository, applicationSha, expectedPath }) {
  const recordKeys = ['application_sequence', 'application_sha', 'artifact', 'contract_version',
    'effect_generation', 'effect_result', 'ledger_branch', 'predecessor_commit_sha',
    'ledger_provisioning_receipt_sha256', 'previous_record_sha256', 'recorded_at', 'repository',
    'resume_packet', 'packet_scan', 'retry_ordinal',
    'stage', 'workflow_run_attempt', 'workflow_run_id'].sort();
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
      JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(recordKeys) ||
      record.contract_version !== LEDGER_CONTRACT || record.repository !== repository ||
      record.ledger_branch !== LEDGER_BRANCH || record.application_sha !== applicationSha ||
      !STAGES.has(record.stage) || !Number.isSafeInteger(record.application_sequence) ||
      record.application_sequence < 0 || !Number.isSafeInteger(record.effect_generation) ||
      record.effect_generation < 0 || !Number.isSafeInteger(record.workflow_run_id) ||
      record.workflow_run_id <= 0 || !Number.isSafeInteger(record.workflow_run_attempt) ||
      record.workflow_run_attempt <= 0) {
    fail('LEDGER_RECORD_INVALID', expectedPath);
  }
  assertString(record.predecessor_commit_sha, /^[0-9a-f]{40}$/u,
    'LEDGER_RECORD_INVALID', 'predecessor commit sha');
  assertString(record.previous_record_sha256, /^[0-9a-f]{64}$/u,
    'LEDGER_RECORD_INVALID', 'previous record sha256');
  assertString(record.ledger_provisioning_receipt_sha256, /^[0-9a-f]{64}$/u,
    'LEDGER_RECORD_INVALID', 'ledger provisioning receipt sha256');
  assertString(record.effect_result, /^[A-Z][A-Z0-9_]{0,79}$/u,
    'LEDGER_RECORD_INVALID', 'effect result');
  if (!STAGE_EFFECT_RESULTS.get(record.stage)?.has(record.effect_result)) {
    fail('LEDGER_EFFECT_RESULT_INVALID', `${record.stage}:${record.effect_result}`);
  }
  if (record.stage === 'PROVIDER_RECONCILIATION') {
    if (!Number.isSafeInteger(record.retry_ordinal) || record.retry_ordinal <= 0) {
      fail('LEDGER_RECORD_INVALID', 'retry ordinal differs');
    }
  } else if (record.retry_ordinal !== null) {
    fail('LEDGER_RECORD_INVALID', 'non-reconciliation retry ordinal differs');
  }
  assertString(record.recorded_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u,
    'LEDGER_RECORD_INVALID', 'recorded at');
  epochMilliseconds(record.recorded_at, 'LEDGER_RECORD_INVALID', 'recorded at');
  validateArtifact(record.artifact);
  const packetFiles = validatePacketBundle(record.resume_packet);
  validatePacketScanProof(record.packet_scan, record.resume_packet);
  const expectedArtifactName = record.stage === 'STARTED' ? `physio-bootstrap-started-${applicationSha}` :
    ['PROVIDER_ADMISSION', 'PROVIDER_RECONCILIATION'].includes(record.stage)
      ? `physio-bootstrap-provider-admission-${applicationSha}` :
      `physio-production-bootstrap-${applicationSha}`;
  if (record.artifact.name !== expectedArtifactName) {
    fail('LEDGER_ARTIFACT_STAGE_MISMATCH', `${record.stage}:${record.artifact.name}`);
  }
  const requireFileHash = (name, expected, code) => {
    const bytes = packetFiles.get(name);
    if (!bytes || sha256(bytes) !== expected) fail(code, name);
  };
  requireFileHash('bootstrap-effect-reconciliation.json', record.artifact.effect_receipt_sha256,
    'LEDGER_EFFECT_RECEIPT_JOIN_INVALID');
  if (['PROVIDER_ADMISSION', 'PROVIDER_RECONCILIATION'].includes(record.stage)) {
    requireFileHash('bootstrap-provider-admission.json', record.artifact.packet_receipt_sha256,
      'LEDGER_PACKET_RECEIPT_JOIN_INVALID');
    requireFileHash('bootstrap-provider-admission-upload-readback.json',
      record.artifact.artifact_readback_sha256, 'LEDGER_ARTIFACT_READBACK_JOIN_INVALID');
  } else if (record.stage === 'TERMINAL') {
    requireFileHash('physio-production-bootstrap.json', record.artifact.packet_receipt_sha256,
      'LEDGER_PACKET_RECEIPT_JOIN_INVALID');
  }
  const expectedName = `${String(record.application_sequence).padStart(10, '0')}-` +
    `${String(record.effect_generation).padStart(10, '0')}-${record.stage.toLowerCase()}-` +
    `${record.workflow_run_id}-${record.workflow_run_attempt}.json`;
  if (path.posix.basename(expectedPath) !== expectedName) fail('LEDGER_RECORD_PATH_INVALID', expectedPath);
  return record;
}

function validateTransition(previous, current, currentSha256) {
  if (!previous) {
    if (current.application_sequence !== 0 || current.effect_generation !== 0 ||
        current.stage !== 'STARTED' || current.previous_record_sha256 !== ZERO_SHA256) {
      fail('LEDGER_CHAIN_INVALID', 'first application record is not generation zero STARTED');
    }
    return;
  }
  if (current.application_sequence !== previous.record.application_sequence + 1 ||
      current.previous_record_sha256 !== previous.sha256) {
    fail('LEDGER_CHAIN_INVALID', `record ${currentSha256} predecessor differs`);
  }
  if (epochMilliseconds(current.recorded_at, 'LEDGER_RECORD_INVALID', 'recorded at') <
      epochMilliseconds(previous.record.recorded_at, 'LEDGER_RECORD_INVALID', 'recorded at')) {
    fail('LEDGER_RECORD_TIME_REGRESSION', currentSha256);
  }
  if (current.stage === 'STARTED') {
    if (previous.record.stage !== 'TERMINAL') {
      fail('LEDGER_UNRESOLVED_GENERATION', 'new STARTED does not follow a terminal record');
    }
    if (current.effect_generation !== previous.record.effect_generation + 1) {
      fail('LEDGER_GENERATION_INVALID', 'STARTED did not advance exactly one generation');
    }
    return;
  }
  if (current.effect_generation !== previous.record.effect_generation) {
    fail('LEDGER_GENERATION_INVALID', `${current.stage} changed generation`);
  }
  if (current.stage === 'PROVIDER_ADMISSION' && previous.record.stage !== 'STARTED') {
    fail('LEDGER_STAGE_INVALID', 'provider admission does not follow STARTED');
  }
  if (current.stage === 'PROVIDER_RECONCILIATION') {
    if (!['PROVIDER_ADMISSION', 'PROVIDER_RECONCILIATION'].includes(previous.record.stage) ||
        current.retry_ordinal !== (previous.record.retry_ordinal ?? 0) + 1) {
      fail('LEDGER_STAGE_INVALID', 'provider reconciliation retry transition differs');
    }
  }
  if (current.stage === 'TERMINAL' &&
      !['PROVIDER_ADMISSION', 'PROVIDER_RECONCILIATION'].includes(previous.record.stage)) {
    fail('LEDGER_STAGE_INVALID', 'terminal does not follow durable provider authority');
  }
}

function normalizedRuleset(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !Number.isSafeInteger(value.id) || value.id <= 0 ||
      value.name !== LEDGER_BRANCH || value.enforcement !== 'active' || value.target !== 'branch' ||
      typeof value.conditions !== 'object' || !value.conditions || Array.isArray(value.conditions) ||
      typeof value.conditions.ref_name !== 'object' || !value.conditions.ref_name ||
      JSON.stringify(value.conditions.ref_name.include) !==
        JSON.stringify([`refs/heads/${LEDGER_BRANCH}`]) ||
      JSON.stringify(value.conditions.ref_name.exclude) !== JSON.stringify([]) ||
      !Array.isArray(value.rules) || typeof value.updated_at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value.updated_at)) {
    fail('LEDGER_RULESET_INVALID', 'ruleset identity, scope, enforcement, or version differs');
  }
  const rules = value.rules.map((rule) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule) || typeof rule.type !== 'string') {
      fail('LEDGER_RULESET_INVALID', 'rule differs');
    }
    return structuredClone(rule);
  }).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const types = new Set(rules.map((rule) => rule.type));
  if (!types.has('deletion') || !types.has('non_fast_forward')) {
    fail('LEDGER_RULESET_INVALID', 'deletion and non-fast-forward rules are required');
  }
  return { id: value.id, name: value.name, enforcement: value.enforcement, target: value.target,
    conditions: structuredClone(value.conditions), rules, updated_at: value.updated_at };
}

function validateGenesisReadback(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([
        'genesis_blob_path', 'genesis_blob_sha', 'genesis_blob_sha256', 'genesis_commit_message',
        'genesis_commit_sha', 'genesis_parent_count', 'genesis_ref_readback_sha', 'genesis_tree_sha',
      ]) || value.genesis_parent_count !== 0 ||
      value.genesis_commit_message !== 'Initialize protected AssessSuite Physio bootstrap ledger' ||
      value.genesis_blob_path !== 'bootstrap-ledger/genesis.json') {
    fail('LEDGER_GENESIS_READBACK_INVALID', 'genesis readback envelope differs');
  }
  for (const field of ['genesis_blob_sha', 'genesis_commit_sha', 'genesis_ref_readback_sha', 'genesis_tree_sha']) {
    assertString(value[field], /^[0-9a-f]{40}$/u, 'LEDGER_GENESIS_READBACK_INVALID', field);
  }
  assertString(value.genesis_blob_sha256, /^[0-9a-f]{64}$/u,
    'LEDGER_GENESIS_READBACK_INVALID', 'genesis blob sha256');
  if (value.genesis_ref_readback_sha !== value.genesis_commit_sha) {
    fail('LEDGER_GENESIS_READBACK_INVALID', 'genesis ref did not identify the zero-parent commit');
  }
  return structuredClone(value);
}

export function buildProvisioningReceipt({ repository, fullRuleset, genesisReadback, provisionedAt }) {
  assertString(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
    'LEDGER_REPOSITORY_INVALID', 'repository');
  if (!fullRuleset || typeof fullRuleset !== 'object' || Array.isArray(fullRuleset) ||
      JSON.stringify(fullRuleset.bypass_actors) !== JSON.stringify([])) {
    fail('LEDGER_RULESET_BYPASS_INVALID', 'external L5 receipt requires an exact empty bypass actor list');
  }
  assertString(provisionedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u,
    'LEDGER_PROVISIONING_RECEIPT_INVALID', 'provisioned at');
  const visibleRuleset = normalizedRuleset(fullRuleset);
  const genesis = validateGenesisReadback(genesisReadback);
  if (epochMilliseconds(provisionedAt, 'LEDGER_PROVISIONING_RECEIPT_INVALID', 'provisioned at') <
      epochMilliseconds(visibleRuleset.updated_at, 'LEDGER_RULESET_INVALID', 'ruleset updated at')) {
    fail('LEDGER_PROVISIONING_ORDER_INVALID', 'receipt predates the exact protected ruleset version');
  }
  return {
    contract_version: LEDGER_PROVISIONING_RECEIPT_CONTRACT,
    result: 'PASS',
    repository,
    ledger_branch: LEDGER_BRANCH,
    exact_ref: `refs/heads/${LEDGER_BRANCH}`,
    authority: 'EXTERNAL_L5_REPOSITORY_ADMINISTRATION_ONLY',
    ruleset_first_precondition_verified: true,
    no_bypass_verified_by_external_l5: true,
    bypass_actors: [],
    visible_ruleset: visibleRuleset,
    visible_ruleset_sha256: sha256(Buffer.from(canonicalJson(visibleRuleset))),
    full_no_bypass_ruleset_sha256: sha256(Buffer.from(canonicalJson(fullRuleset))),
    ...genesis,
    provisioned_at: provisionedAt,
  };
}

function validateProvisioningReceipt(value, repository) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([
        'authority', 'bypass_actors', 'contract_version', 'exact_ref',
        'full_no_bypass_ruleset_sha256', 'genesis_blob_path', 'genesis_blob_sha',
        'genesis_blob_sha256', 'genesis_commit_message', 'genesis_commit_sha', 'genesis_parent_count',
        'genesis_ref_readback_sha', 'genesis_tree_sha', 'ledger_branch', 'no_bypass_verified_by_external_l5',
        'provisioned_at', 'repository', 'result', 'ruleset_first_precondition_verified',
        'visible_ruleset', 'visible_ruleset_sha256',
      ]) || value.contract_version !== LEDGER_PROVISIONING_RECEIPT_CONTRACT || value.result !== 'PASS' ||
      value.repository !== repository || value.ledger_branch !== LEDGER_BRANCH ||
      value.exact_ref !== `refs/heads/${LEDGER_BRANCH}` ||
      value.authority !== 'EXTERNAL_L5_REPOSITORY_ADMINISTRATION_ONLY' ||
      value.ruleset_first_precondition_verified !== true || value.no_bypass_verified_by_external_l5 !== true ||
      JSON.stringify(value.bypass_actors) !== JSON.stringify([])) {
    fail('LEDGER_PROVISIONING_RECEIPT_INVALID', 'receipt identity or no-bypass attestation differs');
  }
  assertString(value.full_no_bypass_ruleset_sha256, /^[0-9a-f]{64}$/u,
    'LEDGER_PROVISIONING_RECEIPT_INVALID', 'full ruleset sha256');
  assertString(value.provisioned_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u,
    'LEDGER_PROVISIONING_RECEIPT_INVALID', 'provisioned at');
  const visible = normalizedRuleset(value.visible_ruleset);
  if (epochMilliseconds(value.provisioned_at, 'LEDGER_PROVISIONING_RECEIPT_INVALID', 'provisioned at') <
      epochMilliseconds(visible.updated_at, 'LEDGER_RULESET_INVALID', 'ruleset updated at')) {
    fail('LEDGER_PROVISIONING_ORDER_INVALID', 'receipt predates the exact protected ruleset version');
  }
  if (canonicalJson(visible) !== canonicalJson(value.visible_ruleset) ||
      sha256(Buffer.from(canonicalJson(visible))) !== value.visible_ruleset_sha256) {
    fail('LEDGER_PROVISIONING_RECEIPT_INVALID', 'visible ruleset commitment differs');
  }
  validateGenesisReadback({
    genesis_blob_path: value.genesis_blob_path,
    genesis_blob_sha: value.genesis_blob_sha,
    genesis_blob_sha256: value.genesis_blob_sha256,
    genesis_commit_message: value.genesis_commit_message,
    genesis_commit_sha: value.genesis_commit_sha,
    genesis_parent_count: value.genesis_parent_count,
    genesis_ref_readback_sha: value.genesis_ref_readback_sha,
    genesis_tree_sha: value.genesis_tree_sha,
  });
  return value;
}

function genesisValue(repository) {
  return { contract_version: LEDGER_GENESIS_CONTRACT, repository, ledger_branch: LEDGER_BRANCH,
    purpose: 'protected append-only AssessSuite Physio bootstrap effect ledger' };
}

export function buildProvisioningContract(repository) {
  assertString(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
    'LEDGER_REPOSITORY_INVALID', 'repository');
  const genesisBytes = Buffer.from(canonicalJson(genesisValue(repository)));
  return {
    contract_version: 'assesssuite-physio-bootstrap-ledger-provisioning/1.0.0',
    result: 'PRECONDITION_ONLY',
    repository,
    ledger_branch: LEDGER_BRANCH,
    exact_ref: `refs/heads/${LEDGER_BRANCH}`,
    authority: 'EXTERNAL_L5_REPOSITORY_ADMINISTRATION_ONLY',
    production_workflow_may_create_branch: false,
    production_workflow_may_create_or_modify_protection: false,
    provisioning_order: [
      'CREATE_RULESET_TARGETING_EXACT_NONEXISTENT_REF',
      'VERIFY_EXACT_REF_RULESET_ACTIVE_WITH_DELETION_AND_NON_FAST_FORWARD_RULES',
      'CREATE_CANONICAL_ZERO_PARENT_GENESIS_COMMIT_AND_EXACT_REF',
      'VERIFY_GENESIS_REF_COMMIT_TREE_BLOB_AND_ACTIVE_RULES',
      'APPEND_CANONICAL_L5_PROVISIONING_RECEIPT_COMMIT_WITH_FORCE_FALSE',
      'VERIFY_PROVISIONING_COMMIT_AND_FINAL_BRANCH_REF',
    ],
    required_active_rule_types: ['deletion', 'non_fast_forward'],
    mandatory_external_receipt_contract: LEDGER_PROVISIONING_RECEIPT_CONTRACT,
    mandatory_external_receipt_sha256_input: 'ledger_provisioning_receipt_sha256',
    receipt_ruleset_join: [
      'EXACT_RULESET_ID_NAME_ENFORCEMENT_TARGET_CONDITIONS_RULES',
      'EXACT_RULESET_UPDATED_AT',
      'EXACT_VISIBLE_OBJECT_SHA256',
      'EXTERNAL_L5_FULL_OBJECT_SHA256_WITH_EMPTY_BYPASS_ACTORS',
    ],
    genesis: {
      parent_count: 0,
      commit_message: 'Initialize protected AssessSuite Physio bootstrap ledger',
      blob_path: 'bootstrap-ledger/genesis.json',
      blob_mode: '100644',
      blob_content_base64: genesisBytes.toString('base64'),
      blob_size_bytes: genesisBytes.length,
      git_blob_sha: gitBlobSha(genesisBytes),
      blob_sha256: sha256(genesisBytes),
    },
    provisioning_receipt_commit: {
      parent: 'EXACT_ZERO_PARENT_GENESIS_COMMIT_SHA',
      commit_message: 'Bind external L5 bootstrap ledger provisioning receipt',
      blob_path: 'bootstrap-ledger/provisioning.json',
      blob_mode: '100644',
      blob_contract: LEDGER_PROVISIONING_RECEIPT_CONTRACT,
      ref_update_force: false,
    },
  };
}

async function loadTree(client, treeSha, cache) {
  if (!cache.has(treeSha)) {
    const tree = (await client.request('GET', `/git/trees/${treeSha}?recursive=1`)).value;
    if (tree?.sha !== treeSha || tree?.truncated !== false || !Array.isArray(tree?.tree)) {
      fail('LEDGER_TREE_INVALID', treeSha);
    }
    cache.set(treeSha, tree);
  }
  return cache.get(treeSha);
}

async function loadCommit(client, commitSha, cache) {
  if (!cache.has(commitSha)) {
    const commit = (await client.request('GET', `/git/commits/${commitSha}`)).value;
    if (commit?.sha !== commitSha || !/^[0-9a-f]{40}$/u.test(commit?.tree?.sha || '') ||
        !Array.isArray(commit?.parents)) fail('LEDGER_COMMIT_INVALID', commitSha);
    cache.set(commitSha, commit);
  }
  return cache.get(commitSha);
}

function blobTreeMap(tree) {
  const paths = new Set();
  const blobs = new Map();
  for (const entry of tree.tree) {
    if (!entry || typeof entry.path !== 'string' || paths.has(entry.path)) {
      fail('LEDGER_TREE_INVALID', tree.sha);
    }
    paths.add(entry.path);
    if (entry.type === 'tree') {
      if (entry.mode !== '040000' || !tree.tree.some((candidate) =>
        candidate?.type === 'blob' && candidate.path.startsWith(`${entry.path}/`))) {
        fail('LEDGER_TREE_INVALID', entry.path);
      }
      continue;
    }
    if (entry.type !== 'blob') fail('LEDGER_TREE_INVALID', entry.path);
    blobs.set(entry.path, entry);
  }
  return blobs;
}

async function listLedgerHistory(client) {
  const listed = [];
  for (let page = 1; page <= Math.ceil(MAX_LEDGER_COMMITS / 100) + 1; page += 1) {
    const rows = (await client.request('GET',
      `/commits?sha=${encodeURIComponent(LEDGER_BRANCH)}&per_page=100&page=${page}`)).value;
    if (!Array.isArray(rows)) fail('LEDGER_HISTORY_PAGINATION_INVALID', `page ${page}`);
    listed.push(...rows);
    if (listed.length > MAX_LEDGER_COMMITS) fail('LEDGER_HISTORY_BOUND_EXCEEDED', String(listed.length));
    if (rows.length < 100) return listed;
  }
  fail('LEDGER_HISTORY_PAGINATION_INVALID', 'history does not terminate within bound');
}

async function auditLedgerHistory({ client, repository, state, records }) {
  const commitCache = new Map([[state.headSha, state.commit]]);
  const treeCache = new Map([[state.treeSha, state.tree]]);
  const listed = await listLedgerHistory(client);
  if (listed.length !== records.length + 2 || listed[0]?.sha !== state.headSha) {
    fail('LEDGER_HISTORY_INVALID', 'commit and immutable record counts differ');
  }
  for (let index = 0; index < listed.length; index += 1) {
    const row = listed[index];
    if (!/^[0-9a-f]{40}$/u.test(row?.sha || '') || !Array.isArray(row?.parents) ||
        (index === listed.length - 1 ? row.parents.length !== 0 :
          row.parents.length !== 1 || row.parents[0]?.sha !== listed[index + 1]?.sha)) {
      fail('LEDGER_HISTORY_INVALID', `paginated commit ${index} differs`);
    }
  }
  const genesisSha = listed.at(-1).sha;
  const genesis = await loadCommit(client, genesisSha, commitCache);
  if (genesis.parents.length !== 0 || genesis.message !== 'Initialize protected AssessSuite Physio bootstrap ledger') {
    fail('LEDGER_GENESIS_INVALID', genesisSha);
  }
  const genesisTree = await loadTree(client, genesis.tree.sha, treeCache);
  const genesisBlobs = blobTreeMap(genesisTree);
  if (genesisBlobs.size !== 1) fail('LEDGER_GENESIS_INVALID', 'genesis tree is not exact');
  const genesisEntry = genesisBlobs.get('bootstrap-ledger/genesis.json');
  if (genesisEntry?.path !== 'bootstrap-ledger/genesis.json' || genesisEntry?.mode !== '100644' ||
      genesisEntry?.type !== 'blob' || !/^[0-9a-f]{40}$/u.test(genesisEntry?.sha || '')) {
    fail('LEDGER_GENESIS_INVALID', 'genesis entry differs');
  }
  const genesisBlob = (await client.request('GET', `/git/blobs/${genesisEntry.sha}`)).value;
  const genesisBytes = Buffer.from(String(genesisBlob?.content || '').replaceAll('\n', ''), 'base64');
  const expectedGenesis = Buffer.from(canonicalJson(genesisValue(repository)));
  if (genesisBlob?.sha !== genesisEntry.sha || genesisBlob?.encoding !== 'base64' ||
      genesisBytes.length !== genesisBlob?.size || gitBlobSha(genesisBytes) !== genesisEntry.sha ||
      !genesisBytes.equals(expectedGenesis)) fail('LEDGER_GENESIS_INVALID', 'genesis bytes differ');

  const provisioningCommitSha = listed.at(-2).sha;
  const provisioningCommit = await loadCommit(client, provisioningCommitSha, commitCache);
  if (provisioningCommit.parents.length !== 1 || provisioningCommit.parents[0]?.sha !== genesisSha ||
      provisioningCommit.message !== 'Bind external L5 bootstrap ledger provisioning receipt') {
    fail('LEDGER_PROVISIONING_COMMIT_INVALID', provisioningCommitSha);
  }
  const provisioningTree = blobTreeMap(await loadTree(client, provisioningCommit.tree.sha, treeCache));
  if (provisioningTree.size !== 2 || provisioningTree.get('bootstrap-ledger/genesis.json')?.sha !== genesisEntry.sha) {
    fail('LEDGER_PROVISIONING_COMMIT_INVALID', 'provisioning tree modified genesis or differs');
  }
  const provisioningEntry = provisioningTree.get('bootstrap-ledger/provisioning.json');
  if (provisioningEntry?.mode !== '100644' || provisioningEntry?.type !== 'blob' ||
      !/^[0-9a-f]{40}$/u.test(provisioningEntry?.sha || '')) {
    fail('LEDGER_PROVISIONING_COMMIT_INVALID', 'provisioning entry differs');
  }
  const provisioningBlob = (await client.request('GET', `/git/blobs/${provisioningEntry.sha}`)).value;
  const provisioningBytes = Buffer.from(String(provisioningBlob?.content || '').replaceAll('\n', ''), 'base64');
  let provisioningJson;
  try {
    provisioningJson = JSON.parse(provisioningBytes.toString('utf8'));
  } catch {
    fail('LEDGER_PROVISIONING_RECEIPT_INVALID', 'receipt JSON differs');
  }
  const provisioningReceipt = validateProvisioningReceipt(provisioningJson, repository);
  if (provisioningBlob?.sha !== provisioningEntry.sha || provisioningBlob?.encoding !== 'base64' ||
      provisioningBytes.length !== provisioningBlob?.size || gitBlobSha(provisioningBytes) !== provisioningEntry.sha ||
      !provisioningBytes.equals(Buffer.from(canonicalJson(provisioningReceipt))) ||
      provisioningReceipt.genesis_commit_sha !== genesisSha ||
      provisioningReceipt.genesis_ref_readback_sha !== genesisSha ||
      provisioningReceipt.genesis_tree_sha !== genesis.tree.sha ||
      provisioningReceipt.genesis_blob_sha !== genesisEntry.sha ||
      provisioningReceipt.genesis_blob_sha256 !== sha256(genesisBytes)) {
    fail('LEDGER_PROVISIONING_JOIN_INVALID', 'receipt does not bind exact genesis readback');
  }

  const recordsByPath = new Map(records.map((record) => [record.path, record]));
  const seenPaths = new Set();
  const recordCommitShas = [];
  const oldestFirst = listed.slice(0, -2).reverse();
  let expectedParent = provisioningCommitSha;
  for (const listedCommit of oldestFirst) {
    const commitSha = listedCommit.sha;
    const commit = await loadCommit(client, commitSha, commitCache);
    if (commit.parents.length !== 1 || commit.parents[0]?.sha !== expectedParent) {
      fail('LEDGER_HISTORY_INVALID', `commit ${commitSha} is not linear`);
    }
    const parent = await loadCommit(client, expectedParent, commitCache);
    const parentTree = blobTreeMap(await loadTree(client, parent.tree.sha, treeCache));
    const currentTree = blobTreeMap(await loadTree(client, commit.tree.sha, treeCache));
    if (currentTree.size !== parentTree.size + 1) {
      fail('LEDGER_HISTORY_NOT_APPEND_ONLY', commitSha);
    }
    const additions = [...currentTree].filter(([entryPath]) => !parentTree.has(entryPath));
    if (additions.length !== 1) fail('LEDGER_HISTORY_NOT_APPEND_ONLY', commitSha);
    for (const [entryPath, entry] of parentTree) {
      const readback = currentTree.get(entryPath);
      if (!readback || readback.mode !== entry.mode || readback.type !== entry.type || readback.sha !== entry.sha) {
        fail('LEDGER_HISTORY_NOT_APPEND_ONLY', entryPath);
      }
    }
    const [recordPath, addition] = additions[0];
    const current = recordsByPath.get(recordPath);
    if (!current || seenPaths.has(recordPath) || addition?.mode !== '100644' ||
        addition?.type !== 'blob' || addition?.sha !== current.blob_sha ||
        current.record.predecessor_commit_sha !== expectedParent) {
      fail('LEDGER_HISTORY_NOT_APPEND_ONLY', recordPath);
    }
    const expectedMessage = `physio bootstrap ledger ${current.record.application_sha} generation ` +
      `${current.record.effect_generation} ${current.record.stage}`;
    if (commit.message !== expectedMessage) {
      fail('LEDGER_HISTORY_INVALID', `commit ${commitSha} is not the exact linear record append`);
    }
    current.commit_sha = commitSha;
    seenPaths.add(recordPath);
    recordCommitShas.push(commitSha);
    expectedParent = commitSha;
  }
  if (seenPaths.size !== records.length || expectedParent !== state.headSha) {
    fail('LEDGER_HISTORY_INVALID', 'record history does not reach the exact branch tip');
  }
  const finalRef = (await client.request('GET', `/git/ref/heads/${encodeURIComponent(LEDGER_BRANCH)}`)).value;
  if (finalRef?.object?.sha !== state.headSha) fail('LEDGER_HISTORY_CHANGED', 'branch moved during audit');
  return { genesisSha, genesisTreeSha: genesis.tree.sha, genesisBlobSha: genesisEntry.sha,
    genesisBlobSha256: sha256(genesisBytes), provisioningCommitSha, provisioningReceipt,
    provisioningReceiptSha256: sha256(Buffer.from(canonicalJson(provisioningReceipt))),
    recordCommitShas, commitCount: listed.length };
}

async function verifyProvisioningRuleset(client, receipt) {
  const expected = receipt.visible_ruleset;
  let live;
  try {
    live = (await client.request('GET', `/rulesets/${expected.id}`)).value;
  } catch (error) {
    fail('LEDGER_RULESET_UNREADABLE', error.message);
  }
  if (Array.isArray(live?.bypass_actors) && live.bypass_actors.length !== 0) {
    fail('LEDGER_RULESET_BYPASS_DRIFT', 'runtime-visible bypass actors are non-empty');
  }
  const normalized = normalizedRuleset(live);
  const normalizedSha = sha256(Buffer.from(canonicalJson(normalized)));
  if (canonicalJson(normalized) !== canonicalJson(expected) ||
      normalizedSha !== receipt.visible_ruleset_sha256) {
    fail('LEDGER_RULESET_DRIFT', 'ruleset id/version/visible object differs from external L5 receipt');
  }
}

async function loadRefAndTree(client) {
  let branch;
  try {
    branch = (await client.request('GET', `/branches/${encodeURIComponent(LEDGER_BRANCH)}`)).value;
  } catch (error) {
    if (error.status === 404) {
      fail('LEDGER_BRANCH_ABSENT_PREPROVISION_REQUIRED',
        `${LEDGER_BRANCH} must be ruleset-protected before external L5 genesis creation`);
    }
    fail('LEDGER_BRANCH_UNREADABLE', error.message);
  }
  if (branch?.name !== LEDGER_BRANCH || branch?.protected !== true || branch?.protection?.enabled !== true) {
    fail('LEDGER_BRANCH_UNPROTECTED', LEDGER_BRANCH);
  }
  let rules;
  try {
    rules = (await client.request('GET', `/rules/branches/${encodeURIComponent(LEDGER_BRANCH)}`)).value;
  } catch (error) {
    fail('LEDGER_PROTECTION_UNREADABLE', error.message);
  }
  const ruleTypes = new Set(Array.isArray(rules) ? rules.map((rule) => rule?.type) : []);
  if (!ruleTypes.has('deletion') || !ruleTypes.has('non_fast_forward')) {
    fail('LEDGER_BRANCH_UNPROTECTED', 'deletion and non-fast-forward protections are required');
  }
  const ref = (await client.request('GET', `/git/ref/heads/${encodeURIComponent(LEDGER_BRANCH)}`)).value;
  const headSha = ref?.object?.sha;
  assertString(headSha, /^[0-9a-f]{40}$/u, 'LEDGER_REF_INVALID', 'ledger head sha');
  if (ref?.ref !== `refs/heads/${LEDGER_BRANCH}` || ref?.object?.type !== 'commit' ||
      branch?.commit?.sha !== headSha) {
    fail('LEDGER_REF_BRANCH_MISMATCH', LEDGER_BRANCH);
  }
  const commit = (await client.request('GET', `/git/commits/${headSha}`)).value;
  if (commit?.sha !== headSha || !/^[0-9a-f]{40}$/u.test(commit?.tree?.sha || '') ||
      !Array.isArray(commit?.parents)) {
    fail('LEDGER_COMMIT_INVALID', headSha);
  }
  const treeSha = commit.tree.sha;
  const tree = (await client.request('GET', `/git/trees/${treeSha}?recursive=1`)).value;
  if (tree?.sha !== treeSha || tree?.truncated !== false || !Array.isArray(tree?.tree)) {
    fail('LEDGER_TREE_INVALID', treeSha);
  }
  return { branch, rules, headSha, commit, treeSha, tree };
}

export async function inventoryLedger({ client, repository, applicationSha }) {
  assertString(applicationSha, /^[0-9a-f]{40}$/u,
    'LEDGER_APPLICATION_SHA_INVALID', 'application sha');
  const state = await loadRefAndTree(client);
  const recordPathPattern = /^bootstrap-ledger\/applications\/([0-9a-f]{40})\/records\/[a-z0-9_-]+\.json$/u;
  const entries = state.tree.tree.filter((entry) => recordPathPattern.test(entry?.path || ''));
  if (entries.length >= MAX_LEDGER_COMMITS) fail('LEDGER_RECORD_BOUND_EXCEEDED', String(entries.length));
  const allRecords = [];
  for (const entry of entries) {
    const pathMatch = entry.path.match(recordPathPattern);
    if (entry.type !== 'blob' || entry.mode !== '100644' || !/^[0-9a-f]{40}$/u.test(entry.sha || '') || !pathMatch) {
      fail('LEDGER_TREE_ENTRY_INVALID', entry.path || 'unknown');
    }
    const blob = (await client.request('GET', `/git/blobs/${entry.sha}`)).value;
    if (blob?.sha !== entry.sha || blob?.encoding !== 'base64' || typeof blob?.content !== 'string' ||
        !Number.isSafeInteger(blob?.size) || blob.size <= 0 || blob.size > MAX_RECORD_BYTES) {
      fail('LEDGER_BLOB_INVALID', entry.path);
    }
    const bytes = Buffer.from(blob.content.replaceAll('\n', ''), 'base64');
    if (bytes.length !== blob.size || gitBlobSha(bytes) !== entry.sha) fail('LEDGER_BLOB_TAMPERED', entry.path);
    let record;
    try {
      record = JSON.parse(bytes.toString('utf8'));
    } catch {
      fail('LEDGER_RECORD_JSON_INVALID', entry.path);
    }
    const recordApplicationSha = pathMatch[1];
    validateLedgerRecord(record, { repository, applicationSha: recordApplicationSha, expectedPath: entry.path });
    if (!bytes.equals(Buffer.from(canonicalJson(record)))) fail('LEDGER_RECORD_CANONICAL_INVALID', entry.path);
    allRecords.push({ path: entry.path, blob_sha: entry.sha, sha256: sha256(bytes), record });
  }
  const byApplication = new Map();
  for (const current of allRecords) {
    const group = byApplication.get(current.record.application_sha) ?? [];
    group.push(current);
    byApplication.set(current.record.application_sha, group);
  }
  for (const [recordApplicationSha, group] of byApplication) {
    group.sort((left, right) => left.record.application_sequence - right.record.application_sequence);
    const uniqueStages = new Set();
    let previous = null;
    for (const current of group) {
      const stageKey = `${current.record.effect_generation}:${current.record.stage}:` +
        `${current.record.retry_ordinal ?? 0}`;
      if (uniqueStages.has(stageKey)) fail('LEDGER_STAGE_DUPLICATE', `${recordApplicationSha}:${stageKey}`);
      uniqueStages.add(stageKey);
      validateTransition(previous, current.record, current.sha256);
      previous = current;
    }
  }
  const history = await auditLedgerHistory({ client, repository, state, records: allRecords });
  await verifyProvisioningRuleset(client, history.provisioningReceipt);
  const provisioningReceipt = history.provisioningReceipt;
  const provisioningReceiptSha256 = history.provisioningReceiptSha256;
  const provisionedAt = epochMilliseconds(provisioningReceipt.provisioned_at,
    'LEDGER_PROVISIONING_RECEIPT_INVALID', 'provisioned at');
  for (const entry of allRecords) {
    if (entry.record.ledger_provisioning_receipt_sha256 !== provisioningReceiptSha256) {
      fail('LEDGER_PROVISIONING_JOIN_INVALID', entry.path);
    }
    if (epochMilliseconds(entry.record.recorded_at, 'LEDGER_RECORD_INVALID', 'recorded at') < provisionedAt) {
      fail('LEDGER_RECORD_PREPROVISIONED', entry.path);
    }
  }
  const records = byApplication.get(applicationSha) ?? [];
  const latest = records.at(-1) ?? null;
  const activeGeneration = latest?.record.effect_generation;
  const activeStarted = records.find(({ record }) =>
    record.effect_generation === activeGeneration && record.stage === 'STARTED') ?? null;
  const activeProviderAdmission = records.find(({ record }) =>
    record.effect_generation === activeGeneration && record.stage === 'PROVIDER_ADMISSION') ?? null;
  const activePredecessorTerminal = activeStarted ? records.filter(({ record }) =>
    record.stage === 'TERMINAL' && record.effect_generation === activeStarted.record.effect_generation - 1 &&
    record.application_sequence < activeStarted.record.application_sequence).at(-1) ?? null : null;
  return {
    contract_version: LEDGER_INVENTORY_CONTRACT,
    result: 'PASS',
    repository,
    ledger_branch: LEDGER_BRANCH,
    application_sha: applicationSha,
    branch_protected: true,
    deletion_protected: true,
    non_fast_forward_protected: true,
    ledger_genesis_sha: history.genesisSha,
    ledger_provisioning_commit_sha: history.provisioningCommitSha,
    ledger_provisioning_receipt: provisioningReceipt,
    ledger_provisioning_receipt_sha256: provisioningReceiptSha256,
    audited_commit_count: history.commitCount,
    ledger_head_sha: state.headSha,
    ledger_tree_sha: state.treeSha,
    record_count: records.length,
    records,
    latest_record_path: latest?.path ?? null,
    latest_record_sha256: latest?.sha256 ?? ZERO_SHA256,
    latest_record: latest?.record ?? null,
    active_started_record_sha256: activeStarted?.sha256 ?? ZERO_SHA256,
    active_started_commit_sha: activeStarted?.commit_sha ?? ZERO_SHA256,
    active_started_record: activeStarted?.record ?? null,
    active_provider_admission_record_sha256: activeProviderAdmission?.sha256 ?? ZERO_SHA256,
    active_provider_admission_commit_sha: activeProviderAdmission?.commit_sha ?? ZERO_SHA256,
    active_provider_admission_record: activeProviderAdmission?.record ?? null,
    active_predecessor_terminal_record_sha256: activePredecessorTerminal?.sha256 ?? ZERO_SHA256,
    active_predecessor_terminal_record: activePredecessorTerminal?.record ?? null,
    next_effect_generation: latest?.record.stage === 'TERMINAL' ? latest.record.effect_generation + 1 :
      latest?.record.effect_generation ?? 0,
    inventoried_at: new Date().toISOString(),
  };
}

export function admitResumeAgainstLedger(inventory, resume) {
  const latest = inventory.latest_record;
  if (!latest) {
    if (resume.artifactId !== '0' || resume.artifactDigest !== '0' || resume.priorGeneration !== '-1' ||
        resume.receiptSha256 !== ZERO_SHA256) {
      fail('LEDGER_FRESH_INPUT_MISMATCH', 'empty ledger requires exact fresh dispatch inputs');
    }
    return;
  }
  if (String(latest.artifact.id) !== resume.artifactId || latest.artifact.digest !== resume.artifactDigest ||
      String(latest.effect_generation) !== resume.priorGeneration ||
      latest.artifact.effect_receipt_sha256 !== resume.receiptSha256) {
    fail('LEDGER_RESUME_INPUT_MISMATCH', 'dispatch does not identify the exact durable ledger tip');
  }
}

function validateAppendRequest(request, inventory) {
  if (!request || typeof request !== 'object' || Array.isArray(request) ||
      request.repository !== inventory.repository || request.ledger_branch !== LEDGER_BRANCH ||
      request.application_sha !== inventory.application_sha || !STAGES.has(request.stage) ||
      !Number.isSafeInteger(request.effect_generation) || request.effect_generation < 0 ||
      !Number.isSafeInteger(request.workflow_run_id) || request.workflow_run_id <= 0 ||
      !Number.isSafeInteger(request.workflow_run_attempt) || request.workflow_run_attempt <= 0) {
    fail('LEDGER_APPEND_REQUEST_INVALID', 'request identity differs');
  }
  validateArtifact(request.artifact);
  validatePacketBundle(request.resume_packet);
  validatePacketScanProof(request.packet_scan, request.resume_packet);
  if (request.ledger_provisioning_receipt_sha256 !== inventory.ledger_provisioning_receipt_sha256) {
    fail('LEDGER_PROVISIONING_JOIN_INVALID', 'append request differs from exact provider readback');
  }
  if (request.stage === 'PROVIDER_RECONCILIATION' &&
      (!Number.isSafeInteger(request.retry_ordinal) || request.retry_ordinal <= 0)) {
    fail('LEDGER_APPEND_REQUEST_INVALID', 'retry ordinal differs');
  }
  const latest = inventory.latest_record;
  if (request.stage === 'STARTED') {
    if (latest && latest.stage !== 'TERMINAL') {
      fail('LEDGER_UNRESOLVED_GENERATION', 'new STARTED cannot abandon unresolved work');
    }
    if (request.effect_generation !== inventory.next_effect_generation) {
      fail('LEDGER_APPEND_GENERATION_MISMATCH', 'STARTED generation differs from inventory');
    }
  } else if (!latest || request.effect_generation !== latest.effect_generation ||
      (request.stage === 'PROVIDER_ADMISSION' && latest.stage !== 'STARTED') ||
      (request.stage === 'PROVIDER_RECONCILIATION' &&
        (!['PROVIDER_ADMISSION', 'PROVIDER_RECONCILIATION'].includes(latest.stage) ||
          request.retry_ordinal !== (latest.retry_ordinal ?? 0) + 1)) ||
      (request.stage === 'TERMINAL' &&
        !['PROVIDER_ADMISSION', 'PROVIDER_RECONCILIATION'].includes(latest.stage))) {
    fail('LEDGER_APPEND_STAGE_MISMATCH', request.stage);
  }
  if (request.stage !== 'PROVIDER_RECONCILIATION' &&
      request.retry_ordinal !== null && request.retry_ordinal !== undefined) {
    fail('LEDGER_APPEND_REQUEST_INVALID', 'non-reconciliation retry ordinal differs');
  }
  assertString(request.effect_result, /^[A-Z][A-Z0-9_]{0,79}$/u,
    'LEDGER_APPEND_REQUEST_INVALID', 'effect result');
}

async function commitIsReachable(client, descendantSha, ancestorSha) {
  let cursor = descendantSha;
  for (let depth = 0; depth < MAX_LEDGER_COMMITS; depth += 1) {
    if (cursor === ancestorSha) return true;
    const commit = (await client.request('GET', `/git/commits/${cursor}`)).value;
    if (commit?.sha !== cursor || !Array.isArray(commit.parents) || commit.parents.length !== 1 ||
        !/^[0-9a-f]{40}$/u.test(commit.parents[0]?.sha || '')) return false;
    cursor = commit.parents[0].sha;
  }
  return false;
}

export async function appendLedgerRecord({ client, repository, applicationSha, request,
  expectedHeadSha, now = () => new Date() }) {
  assertString(expectedHeadSha, /^[0-9a-f]{40}$/u,
    'LEDGER_EXPECTED_HEAD_INVALID', 'expected ledger head');
  const inventory = await inventoryLedger({ client, repository, applicationSha });
  if (inventory.ledger_head_sha !== expectedHeadSha) {
    fail('LEDGER_NON_FAST_FORWARD', 'ledger head changed before append');
  }
  validateAppendRequest(request, inventory);
  const sequence = inventory.record_count;
  const recordedAt = now().toISOString();
  const recordedAtMilliseconds = epochMilliseconds(recordedAt, 'LEDGER_RECORD_INVALID', 'recorded at');
  if (recordedAtMilliseconds < epochMilliseconds(inventory.ledger_provisioning_receipt.provisioned_at,
    'LEDGER_PROVISIONING_RECEIPT_INVALID', 'provisioned at')) {
    fail('LEDGER_RECORD_PREPROVISIONED', recordedAt);
  }
  if (inventory.latest_record && recordedAtMilliseconds < epochMilliseconds(
    inventory.latest_record.recorded_at, 'LEDGER_RECORD_INVALID', 'recorded at')) {
    fail('LEDGER_RECORD_TIME_REGRESSION', recordedAt);
  }
  const record = {
    contract_version: LEDGER_CONTRACT,
    repository,
    ledger_branch: LEDGER_BRANCH,
    application_sha: applicationSha,
    application_sequence: sequence,
    effect_generation: request.effect_generation,
    stage: request.stage,
    retry_ordinal: request.stage === 'PROVIDER_RECONCILIATION' ? request.retry_ordinal : null,
    effect_result: request.effect_result,
    artifact: request.artifact,
    resume_packet: request.resume_packet,
    packet_scan: request.packet_scan,
    workflow_run_id: request.workflow_run_id,
    workflow_run_attempt: request.workflow_run_attempt,
    predecessor_commit_sha: inventory.ledger_head_sha,
    ledger_provisioning_receipt_sha256: inventory.ledger_provisioning_receipt_sha256,
    previous_record_sha256: inventory.latest_record_sha256,
    recorded_at: recordedAt,
  };
  const recordPath = `bootstrap-ledger/applications/${applicationSha}/records/` +
    `${String(sequence).padStart(10, '0')}-${String(request.effect_generation).padStart(10, '0')}-` +
    `${request.stage.toLowerCase()}-${request.workflow_run_id}-${request.workflow_run_attempt}.json`;
  validateLedgerRecord(record, { repository, applicationSha, expectedPath: recordPath });
  const bytes = Buffer.from(canonicalJson(record));
  const recordSha256 = sha256(bytes);
  const createdBlob = (await client.request('POST', '/git/blobs', {
    content: bytes.toString('base64'), encoding: 'base64',
  }, [201])).value;
  if (createdBlob?.sha !== gitBlobSha(bytes)) fail('LEDGER_BLOB_CREATE_MISMATCH', recordPath);
  const createdTree = (await client.request('POST', '/git/trees', {
    base_tree: inventory.ledger_tree_sha,
    tree: [{ path: recordPath, mode: '100644', type: 'blob', sha: createdBlob.sha }],
  }, [201])).value;
  assertString(createdTree?.sha, /^[0-9a-f]{40}$/u, 'LEDGER_TREE_CREATE_INVALID', 'created tree sha');
  const message = `physio bootstrap ledger ${applicationSha} generation ${request.effect_generation} ${request.stage}`;
  const createdCommit = (await client.request('POST', '/git/commits', {
    message, tree: createdTree.sha, parents: [inventory.ledger_head_sha],
  }, [201])).value;
  assertString(createdCommit?.sha, /^[0-9a-f]{40}$/u,
    'LEDGER_COMMIT_CREATE_INVALID', 'created commit sha');
  let updateError = null;
  try {
    await client.request('PATCH', `/git/refs/heads/${encodeURIComponent(LEDGER_BRANCH)}`, {
      sha: createdCommit.sha,
      force: false,
    }, [200]);
  } catch (error) {
    updateError = error;
  }

  let readback;
  try {
    readback = await inventoryLedger({ client, repository, applicationSha });
  } catch (error) {
    if (updateError) fail('LEDGER_NON_FAST_FORWARD', `${updateError.message}; ${error.message}`);
    fail('LEDGER_UPDATE_READBACK_FAILED', error.message);
  }
  if (!(await commitIsReachable(client, readback.ledger_head_sha, createdCommit.sha))) {
    fail('LEDGER_NON_FAST_FORWARD', updateError?.message || 'created commit is not reachable from ledger tip');
  }
  const exactRecord = readback.records.find((entry) => entry.path === recordPath);
  if (exactRecord?.sha256 !== recordSha256 || exactRecord?.commit_sha !== createdCommit.sha) {
    fail('LEDGER_RECORD_READBACK_MISMATCH', recordPath);
  }
  const exactCommit = (await client.request('GET', `/git/commits/${createdCommit.sha}`)).value;
  if (exactCommit?.sha !== createdCommit.sha || exactCommit?.message !== message ||
      exactCommit?.tree?.sha !== createdTree.sha || exactCommit?.parents?.length !== 1 ||
      exactCommit.parents[0]?.sha !== inventory.ledger_head_sha) {
    fail('LEDGER_COMMIT_READBACK_MISMATCH', createdCommit.sha);
  }
  const exactTree = (await client.request('GET', `/git/trees/${createdTree.sha}?recursive=1`)).value;
  const exactEntry = exactTree?.tree?.find((entry) => entry.path === recordPath);
  if (exactTree?.sha !== createdTree.sha || exactTree?.truncated !== false || exactEntry?.sha !== createdBlob.sha ||
      exactEntry?.mode !== '100644' || exactEntry?.type !== 'blob') {
    fail('LEDGER_TREE_READBACK_MISMATCH', recordPath);
  }
  const exactBlob = (await client.request('GET', `/git/blobs/${createdBlob.sha}`)).value;
  const exactBytes = Buffer.from(String(exactBlob?.content || '').replaceAll('\n', ''), 'base64');
  if (exactBlob?.sha !== createdBlob.sha || exactBlob?.encoding !== 'base64' ||
      !exactBytes.equals(bytes) || gitBlobSha(exactBytes) !== createdBlob.sha || sha256(exactBytes) !== recordSha256) {
    fail('LEDGER_BLOB_READBACK_MISMATCH', recordPath);
  }
  return {
    contract_version: 'assesssuite-physio-bootstrap-ledger-append/1.0.0',
    result: 'PASS',
    repository,
    ledger_branch: LEDGER_BRANCH,
    application_sha: applicationSha,
    ledger_record_path: recordPath,
    ledger_record_sha256: recordSha256,
    predecessor_commit_sha: inventory.ledger_head_sha,
    ledger_commit_sha: createdCommit.sha,
    ledger_readback_head_sha: readback.ledger_head_sha,
    update_response_lost_or_rejected: updateError !== null,
    record,
  };
}

function writeOutput(outputPath, value) {
  const absolute = assertNoLinkedPath(outputPath, { allowMissingLeaf: true });
  fs.writeFileSync(absolute, canonicalJson(value), { flag: 'wx', mode: 0o600 });
}

function appendGitHubOutput(outputPath, values) {
  if (!outputPath) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join('');
  fs.appendFileSync(outputPath, lines);
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const [command, ...rest] = argv;
  const args = parseArgs(rest);
  const repository = args.repository;
  const applicationSha = args['application-sha'];
  const output = args.output;
  if (!output) fail('LEDGER_ARGUMENT_INVALID', '--output is required');
  if (command === 'provisioning-contract') {
    const result = buildProvisioningContract(repository);
    writeOutput(output, result);
    return result;
  }
  if (command === 'provisioning-receipt') {
    if (!args['ruleset-readback'] || !args['genesis-readback'] || !args['provisioned-at']) {
      fail('LEDGER_ARGUMENT_INVALID', '--ruleset-readback, --genesis-readback, and --provisioned-at are required');
    }
    const fullRuleset = readStableJson(args['ruleset-readback'], 1_048_576,
      'LEDGER_RULESET_READBACK_INVALID');
    const genesisReadback = readStableJson(args['genesis-readback'], 1_048_576,
      'LEDGER_GENESIS_READBACK_INVALID');
    const result = buildProvisioningReceipt({ repository, fullRuleset, genesisReadback,
      provisionedAt: args['provisioned-at'] });
    writeOutput(output, result);
    appendGitHubOutput(args['github-output'], {
      ledger_provisioning_receipt_sha256: sha256(Buffer.from(canonicalJson(result))),
      ledger_ruleset_id: result.visible_ruleset.id,
      ledger_ruleset_updated_at: result.visible_ruleset.updated_at,
    });
    return result;
  }
  if (command === 'verify-provider-digest-map') {
    if (!args.expected || !args.observed) {
      fail('LEDGER_ARGUMENT_INVALID', '--expected and --observed are required');
    }
    const result = verifyProviderDigestMap(args.expected, args.observed);
    writeOutput(output, result);
    return result;
  }
  if (command === 'scan-packet') {
    if (!args['packet-directory']) fail('LEDGER_ARGUMENT_INVALID', '--packet-directory is required');
    const secretEntries = secretEntriesFromArgs(args);
    const packet = buildPacketBundle(args['packet-directory'], secretEntries.map(({ value }) => value));
    const packetScan = buildPacketScanProof(packet, secretEntries);
    const result = { contract_version: 'assesssuite-physio-bootstrap-ledger-packet-scan/1.0.0',
      result: 'PASS', packet_bundle_sha256: packetBundleSha256(packet), packet_scan: packetScan,
      packet: packetSummary(packet),
      scanned_at: new Date().toISOString() };
    writeOutput(output, result);
    appendGitHubOutput(args['github-output'], {
      packet_bundle_sha256: result.packet_bundle_sha256,
      packet_scan_policy_version: packetScan.scanner_policy_version,
      packet_secret_set_fingerprint_sha256: packetScan.durable_secret_set_fingerprint_sha256,
      packet_durable_secret_names: packetScan.durable_secret_names.join(','),
    });
    return result;
  }
  if (command === 'inventory') {
    const client = options.client ?? createGitHubClient({ repository,
      token: options.token ?? process.env.GITHUB_TOKEN, fetchImpl: options.fetchImpl, apiBase: options.apiBase });
    const inventory = await inventoryLedger({ client, repository, applicationSha });
    assertString(args['provisioning-receipt-sha256'], /^[0-9a-f]{64}$/u,
      'LEDGER_PROVISIONING_INPUT_INVALID', 'provisioning receipt sha256');
    if (args['provisioning-receipt-sha256'] !== inventory.ledger_provisioning_receipt_sha256) {
      fail('LEDGER_PROVISIONING_INPUT_MISMATCH', 'dispatch does not bind exact remote provisioning readback');
    }
    admitResumeAgainstLedger(inventory, {
      artifactId: args['resume-artifact-id'],
      artifactDigest: args['resume-artifact-digest'],
      receiptSha256: args['resume-receipt-sha256'],
      priorGeneration: args['resume-prior-generation'],
    });
    const persisted = persistedInventory(inventory);
    writeOutput(output, persisted);
    appendGitHubOutput(args['github-output'], {
      ledger_inventory_sha256: sha256(Buffer.from(canonicalJson(persisted))),
      ledger_provisioning_receipt_sha256: inventory.ledger_provisioning_receipt_sha256,
      ledger_head_sha: inventory.ledger_head_sha,
      ledger_latest_record_sha256: inventory.latest_record_sha256,
      ledger_prior_generation: inventory.latest_record?.effect_generation ?? -1,
      ledger_prior_effect_result: inventory.latest_record?.effect_result ?? 'NONE',
      ledger_prior_stage: inventory.latest_record?.stage ?? 'NONE',
      ledger_prior_retry_ordinal: inventory.latest_record?.retry_ordinal ?? 0,
      active_started_record_sha256: inventory.active_started_record_sha256,
      active_started_commit_sha: inventory.active_started_commit_sha,
      active_started_artifact_id: inventory.active_started_record?.artifact.id ?? 0,
      active_started_artifact_digest: inventory.active_started_record?.artifact.digest ?? '0',
      active_started_effect_receipt_sha256:
        inventory.active_started_record?.artifact.effect_receipt_sha256 ?? ZERO_SHA256,
      active_provider_admission_record_sha256: inventory.active_provider_admission_record_sha256,
      active_provider_admission_commit_sha: inventory.active_provider_admission_commit_sha,
      active_predecessor_terminal_record_sha256: inventory.active_predecessor_terminal_record_sha256,
      active_predecessor_terminal_artifact_id:
        inventory.active_predecessor_terminal_record?.artifact.id ?? 0,
      active_predecessor_terminal_artifact_digest:
        inventory.active_predecessor_terminal_record?.artifact.digest ?? '0',
      active_predecessor_terminal_effect_receipt_sha256:
        inventory.active_predecessor_terminal_record?.artifact.effect_receipt_sha256 ?? ZERO_SHA256,
      active_predecessor_terminal_effect_generation:
        inventory.active_predecessor_terminal_record?.effect_generation ?? -1,
      next_provider_reconciliation_retry_ordinal:
        ['PROVIDER_ADMISSION', 'PROVIDER_RECONCILIATION'].includes(inventory.latest_record?.stage) ?
          (inventory.latest_record?.retry_ordinal ?? 0) + 1 : 0,
      next_effect_generation: inventory.next_effect_generation,
    });
    return inventory;
  }
  if (command === 'append') {
    const client = options.client ?? createGitHubClient({ repository,
      token: options.token ?? process.env.GITHUB_TOKEN, fetchImpl: options.fetchImpl, apiBase: options.apiBase });
    if (!args.request) fail('LEDGER_ARGUMENT_INVALID', '--request is required');
    const request = readStableJson(args.request, 1_048_576, 'LEDGER_APPEND_REQUEST_INVALID');
    if (!args['packet-directory']) fail('LEDGER_ARGUMENT_INVALID', '--packet-directory is required');
    const secretEntries = secretEntriesFromArgs(args);
    request.resume_packet = buildPacketBundle(args['packet-directory'], secretEntries.map(({ value }) => value));
    assertString(args['expected-packet-bundle-sha256'], /^[0-9a-f]{64}$/u,
      'LEDGER_PACKET_SCAN_RECEIPT_INVALID', 'expected packet bundle sha256');
    if (packetBundleSha256(request.resume_packet) !== args['expected-packet-bundle-sha256']) {
      fail('LEDGER_PACKET_SCAN_RECEIPT_MISMATCH', 'producer secret-scan packet bytes differ');
    }
    const result = await appendLedgerRecord({
      client,
      repository,
      applicationSha,
      request,
      expectedHeadSha: args['expected-head-sha'],
      now: options.now,
    });
    writeOutput(output, result);
    appendGitHubOutput(args['github-output'], {
      ledger_commit_sha: result.ledger_commit_sha,
      ledger_record_sha256: result.ledger_record_sha256,
      ledger_record_path: result.ledger_record_path,
      ledger_readback_head_sha: result.ledger_readback_head_sha,
    });
    return result;
  }
  if (command === 'materialize-remote') {
    assertString(args['record-sha256'], /^[0-9a-f]{64}$/u,
      'LEDGER_ARGUMENT_INVALID', 'record sha256');
    if (!args['output-directory']) fail('LEDGER_ARGUMENT_INVALID', '--output-directory is required');
    const client = options.client ?? createGitHubClient({ repository,
      token: options.token ?? process.env.GITHUB_TOKEN, fetchImpl: options.fetchImpl, apiBase: options.apiBase });
    const inventory = await inventoryLedger({ client, repository, applicationSha });
    const selected = inventory.records.find(({ sha256: recordSha256 }) => recordSha256 === args['record-sha256']);
    if (!selected) fail('LEDGER_PACKET_RECORD_NOT_FOUND', args['record-sha256']);
    const secretEntries = secretEntriesFromArgs(args);
    materializePacketBundle(selected.record.resume_packet, args['output-directory'], {
      packetScanProof: selected.record.packet_scan,
      secretEntries,
    });
    const result = { contract_version: 'assesssuite-physio-bootstrap-ledger-materialization/1.0.0', result: 'PASS',
      repository, ledger_branch: LEDGER_BRANCH, application_sha: applicationSha,
      source_record_sha256: selected.sha256, output_directory: args['output-directory'],
      materialized_at: new Date().toISOString() };
    writeOutput(output, result);
    return result;
  }
  fail('LEDGER_COMMAND_INVALID', command || 'missing');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
