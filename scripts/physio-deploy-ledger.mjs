#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEPLOY_LEDGER_BRANCH = 'assesssuite-physio-deploy-ledger';
export const DEPLOY_LEDGER_RECORD_CONTRACT = 'assesssuite-physio-deploy-ledger-record/1.0.0';
export const DEPLOY_LEDGER_INVENTORY_CONTRACT = 'assesssuite-physio-deploy-ledger-inventory/1.0.0';
export const DEPLOY_LEDGER_GENESIS_CONTRACT = 'assesssuite-physio-deploy-ledger-genesis/1.0.0';
export const DEPLOY_LEDGER_PACKET_CONTRACT = 'assesssuite-physio-deploy-ledger-packet/1.0.0';
export const DEPLOY_LEDGER_PROVISIONING_RECEIPT_CONTRACT =
  'assesssuite-physio-deploy-ledger-provisioned-by-l5/1.0.0';

const ZERO_SHA256 = '0'.repeat(64);
const MAX_RESPONSE_BYTES = 67_108_864;
const MAX_PACKET_BYTES = 67_108_864;
const MAX_RECORD_BYTES = 96_000_000;
const MAX_LEDGER_COMMITS = 10_000;
const MAX_DECODE_DEPTH = 4;
const MAX_DECODE_CANDIDATES = 8_192;
const MAX_DECODED_BYTES = 8_388_608;
const MAX_SECRET_CORPUS_ENTRIES = 16_384;
const MAX_DISTRIBUTED_SECRET_CHARACTERS = 1_024;
const MAX_DISTRIBUTED_SEARCH_STATES = 16_384;
const MIN_DISTRIBUTED_SECRET_FRAGMENT = 4;
const SHA40 = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const PACKET_FILE_PATTERN = /^(?:SHA256SUMS|[A-Za-z0-9][A-Za-z0-9._-]{0,159}\.(?:json|txt|toml|headers))$/u;
const CREDENTIAL_PATTERN = /(?:(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{8,}|whsec_[A-Za-z0-9_-]{8,}|re_[A-Za-z0-9_-]{8,}|sk-(?:proj-)?[A-Za-z0-9_-]{8,}|github_pat_[A-Za-z0-9_]{8,}|gh[oprsu]_[A-Za-z0-9]{20,}|flyv1\s+[A-Za-z0-9._-]{8,}|AKIA[0-9A-Z]{16}|-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----|https:\/\/[^\s/@:]+:[^\s/@]+@[^\s/]*ingest\.sentry\.io(?:\/[^\s]*)?|(?:authorization\s*[:=]\s*)?(?:bearer|basic)\s+[A-Za-z0-9._~+\/-]{12,}={0,2})/iu;
const MUTABLE_PHASE_ALIASES = new Set([
  'phase/SHA256SUMS',
  'phase/deploy-effect-reconciliation.json',
  'phase/deploy-provider-readback.json',
]);

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`);
}

function assertString(value, pattern, code, field) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(code, `${field} differs`);
}

function exactKeys(value, keys, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail(code, `${label} keys differ`);
  }
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
    try { stat = fs.lstatSync(cursor); } catch { fail('DEPLOY_LEDGER_PACKET_PATH_INVALID', cursor); }
    if (stat.isSymbolicLink()) fail('DEPLOY_LEDGER_PACKET_LINK_REJECTED', cursor);
  }
  return absolute;
}

function readStableRegularFile(filePath, maximumBytes = MAX_PACKET_BYTES) {
  const absolute = assertNoLinkedPath(filePath);
  const before = fs.lstatSync(absolute);
  if (!before.isFile() || before.isSymbolicLink() || before.size > maximumBytes) {
    fail('DEPLOY_LEDGER_PACKET_INVALID', absolute);
  }
  let descriptor;
  try {
    descriptor = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || !sameFileIdentity(before, opened) || opened.size > maximumBytes) {
      fail('DEPLOY_LEDGER_PACKET_RACE_REJECTED', absolute);
    }
    const first = Buffer.alloc(opened.size);
    const second = Buffer.alloc(opened.size);
    if (fs.readSync(descriptor, first, 0, first.length, 0) !== first.length ||
        fs.readSync(descriptor, second, 0, second.length, 0) !== second.length || !first.equals(second)) {
      fail('DEPLOY_LEDGER_PACKET_RACE_REJECTED', absolute);
    }
    const afterRead = fs.fstatSync(descriptor);
    const afterPath = fs.lstatSync(absolute);
    if (!sameFileIdentity(opened, afterRead) || !sameFileIdentity(opened, afterPath) ||
        afterPath.isSymbolicLink()) fail('DEPLOY_LEDGER_PACKET_RACE_REJECTED', absolute);
    return first;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function textFromBytes(bytes, name) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (/[^\t\n\r\x20-\x7e\u00a0-\ufffd]/u.test(text)) {
      fail('DEPLOY_LEDGER_PACKET_BINARY_REJECTED', name);
    }
    return text;
  } catch (error) {
    if (String(error?.message || '').startsWith('DEPLOY_LEDGER_')) throw error;
    fail('DEPLOY_LEDGER_PACKET_BINARY_REJECTED', name);
  }
}

function jsonScalars(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return []; }
  const scalars = [];
  const pending = [parsed];
  let visited = 0;
  while (pending.length > 0) {
    const value = pending.pop();
    visited += 1;
    if (visited > MAX_DECODE_CANDIDATES) fail('DEPLOY_LEDGER_PACKET_DECODE_BOUND_EXCEEDED', 'JSON nodes');
    if (typeof value === 'string') scalars.push(value);
    else if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) pending.push(value[index]);
    } else if (value && typeof value === 'object') {
      const entries = Object.entries(value);
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        scalars.push(entries[index][0]);
        pending.push(entries[index][1]);
      }
    }
    if (scalars.length > MAX_DECODE_CANDIDATES) {
      fail('DEPLOY_LEDGER_PACKET_DECODE_BOUND_EXCEEDED', 'JSON scalars');
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
      !/^[A-Za-z0-9+\/_-]+={0,2}$/u.test(compact)) return null;
  const standard = compact.replaceAll('-', '+').replaceAll('_', '/');
  const unpadded = standard.replace(/=+$/u, '');
  if (unpadded.length % 4 === 1) return null;
  const padded = `${unpadded}${'='.repeat((4 - unpadded.length % 4) % 4)}`;
  const bytes = Buffer.from(padded, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_DECODED_BYTES ||
      bytes.toString('base64').replace(/=+$/u, '') !== unpadded) return null;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return null; }
}

function base64Candidates(value, name) {
  const candidates = [];
  const maximumCharacters = Math.ceil(MAX_DECODED_BYTES * 4 / 3) + 4;
  let start = -1;
  for (let index = 0; index <= value.length; index += 1) {
    const character = value[index];
    const code = character?.charCodeAt(0) ?? -1;
    const alphabet = (code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) || code === 43 || code === 47 || code === 95 || code === 45;
    if (alphabet && start < 0) start = index;
    if (alphabet) {
      if (index - start + 1 > maximumCharacters) fail('DEPLOY_LEDGER_PACKET_DECODE_BOUND_EXCEEDED', name);
      continue;
    }
    if (start < 0) continue;
    let end = index;
    while (end < value.length && value[end] === '=' && end - index < 2) end += 1;
    if (end - start >= 12) candidates.push(value.slice(start, end));
    if (candidates.length > MAX_DECODE_CANDIDATES) {
      fail('DEPLOY_LEDGER_PACKET_DECODE_BOUND_EXCEEDED', name);
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
  if (scalars.length > 1) queue.push({ value: scalars.join(''), depth: 0 });
  const seen = new Set();
  let decodedBytes = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    if (queue.length > MAX_DECODE_CANDIDATES) fail('DEPLOY_LEDGER_PACKET_DECODE_BOUND_EXCEEDED', name);
    const { value, depth } = queue[cursor];
    if (typeof value !== 'string' || seen.has(`${depth}\0${value}`)) continue;
    seen.add(`${depth}\0${value}`);
    const searchable = normalizedSearchValues(value);
    if (searchable.some((candidate) => CREDENTIAL_PATTERN.test(candidate)) || exactSecrets.some((secret) =>
      normalizedSearchValues(secret).some((expected) => searchable.some((candidate) =>
        candidate.includes(expected))))) fail('DEPLOY_LEDGER_PACKET_SECRET_REJECTED', name);
    let percentDecoded = null;
    if (/%[0-9a-f]{2}/iu.test(value)) {
      try { percentDecoded = decodeURIComponent(value); } catch {
        fail('DEPLOY_LEDGER_PACKET_ENCODING_INVALID', name);
      }
      if (percentDecoded === value) percentDecoded = null;
    }
    const compact = value.replace(/[\s\p{Cf}]+/gu, '');
    const decodedTokens = [...new Set([value, compact].flatMap((candidate) =>
      base64Candidates(candidate, name)).map(decodeBase64Candidate).filter((candidate) =>
      candidate !== null && candidate !== value))];
    if (depth >= MAX_DECODE_DEPTH) {
      if (percentDecoded !== null || decodedTokens.length > 0) {
        fail('DEPLOY_LEDGER_PACKET_DECODE_DEPTH_EXCEEDED', name);
      }
      continue;
    }
    for (const decoded of [percentDecoded, ...decodedTokens]) {
      if (decoded === null) continue;
      decodedBytes += Buffer.byteLength(decoded);
      if (decodedBytes > MAX_DECODED_BYTES) fail('DEPLOY_LEDGER_PACKET_DECODE_BOUND_EXCEEDED', name);
      queue.push({ value: decoded, depth: depth + 1 });
    }
  }
  return scalars;
}

function scanPacketBytes(bytes, name, exactSecrets) {
  if (!PACKET_FILE_PATTERN.test(path.posix.basename(name))) {
    fail('DEPLOY_LEDGER_PACKET_FILE_TYPE_REJECTED', name);
  }
  const text = textFromBytes(bytes, name);
  return { text, scalars: scanPacketText(text, name, exactSecrets) };
}

function scanDistributedSecrets(corpus, exactSecrets) {
  if (corpus.length > MAX_SECRET_CORPUS_ENTRIES) {
    fail('DEPLOY_LEDGER_PACKET_DECODE_BOUND_EXCEEDED', 'packet corpus');
  }
  const sources = corpus.map(({ value }) => normalizedSearchValues(value));
  for (const secretValue of exactSecrets) {
    for (const secret of normalizedSearchValues(secretValue)) {
      if (secret.length < MIN_DISTRIBUTED_SECRET_FRAGMENT * 2) continue;
      if (secret.length > MAX_DISTRIBUTED_SECRET_CHARACTERS) {
        fail('DEPLOY_LEDGER_SECRET_SCAN_INPUT_BOUND_EXCEEDED', 'secret');
      }
      let states = 0;
      const search = (position, used) => {
        if (position === secret.length) return used.size >= 2;
        if (secret.length - position < MIN_DISTRIBUTED_SECRET_FRAGMENT) return false;
        states += 1;
        if (states > MAX_DISTRIBUTED_SEARCH_STATES) {
          fail('DEPLOY_LEDGER_PACKET_DISTRIBUTED_SCAN_BOUND_EXCEEDED', 'packet');
        }
        const shortest = secret.slice(position, position + MIN_DISTRIBUTED_SECRET_FRAGMENT);
        for (let source = 0; source < sources.length; source += 1) {
          if (used.has(source) || !sources[source].some((candidate) => candidate.includes(shortest))) continue;
          for (let end = secret.length; end >= position + MIN_DISTRIBUTED_SECRET_FRAGMENT; end -= 1) {
            if (end < secret.length && secret.length - end < MIN_DISTRIBUTED_SECRET_FRAGMENT) continue;
            const fragment = secret.slice(position, end);
            if (!sources[source].some((candidate) => candidate.includes(fragment))) continue;
            const next = new Set(used); next.add(source);
            if (search(end, next)) return true;
          }
        }
        return false;
      };
      if (search(0, new Set())) fail('DEPLOY_LEDGER_PACKET_SECRET_REJECTED', 'distributed packet');
    }
  }
}

function safeRelativePath(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512 || value.includes('\\') ||
      value.startsWith('/') || value.endsWith('/') || value.split('/').some((part) =>
        part.length < 1 || part === '.' || part === '..' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(part))) {
    fail('DEPLOY_LEDGER_PACKET_PATH_INVALID', String(value));
  }
  return value;
}

function validateChecksumManifests(bytesByPath) {
  for (const [manifestPath, manifestBytes] of bytesByPath) {
    if (path.posix.basename(manifestPath) !== 'SHA256SUMS') continue;
    const base = path.posix.dirname(manifestPath);
    const prefix = base === '.' ? '' : `${base}/`;
    const expected = [...bytesByPath.keys()].filter((name) =>
      name !== manifestPath && name.startsWith(prefix)).sort();
    const text = manifestBytes.toString('utf8');
    if (!text.endsWith('\n')) fail('DEPLOY_LEDGER_PACKET_SUMS_INVALID', manifestPath);
    const observed = [];
    for (const line of text.trimEnd().split('\n')) {
      const match = line.match(/^([0-9a-f]{64}) [ *](.+)$/u);
      if (!match) fail('DEPLOY_LEDGER_PACKET_SUMS_INVALID', `${manifestPath}: ${line}`);
      const relative = safeRelativePath(match[2]);
      const target = safeRelativePath(path.posix.normalize(path.posix.join(prefix, relative)));
      if (!target.startsWith(prefix) || !bytesByPath.has(target) || sha256(bytesByPath.get(target)) !== match[1]) {
        fail('DEPLOY_LEDGER_PACKET_SUMS_INVALID', `${manifestPath}: ${relative}`);
      }
      observed.push(target);
    }
    if (JSON.stringify(observed) !== JSON.stringify(expected)) {
      fail('DEPLOY_LEDGER_PACKET_SUMS_INVALID', `${manifestPath} inventory differs`);
    }
  }
}

export function validateDeployLedgerPacket(packet, secretValues = []) {
  exactKeys(packet, ['contract_version', 'files', 'total_size_bytes'],
    'DEPLOY_LEDGER_PACKET_INVALID', 'packet');
  if (packet.contract_version !== DEPLOY_LEDGER_PACKET_CONTRACT || !Array.isArray(packet.files) ||
      packet.files.length < 4 || packet.files.length > 1024 ||
      !Number.isSafeInteger(packet.total_size_bytes) || packet.total_size_bytes < 1 ||
      packet.total_size_bytes > MAX_PACKET_BYTES) {
    fail('DEPLOY_LEDGER_PACKET_INVALID', 'packet envelope differs');
  }
  const bytesByPath = new Map();
  const portablePaths = new Set();
  const corpus = [];
  const exactSecrets = secretValues.filter((value) => typeof value === 'string' && value.length > 0);
  let total = 0;
  for (const file of packet.files) {
    exactKeys(file, ['content_base64', 'path', 'sha256', 'size_bytes'],
      'DEPLOY_LEDGER_PACKET_INVALID', 'packet file');
    const relative = safeRelativePath(file.path);
    const portablePath = relative.toLowerCase();
    assertString(file.sha256, SHA256, 'DEPLOY_LEDGER_PACKET_INVALID', 'file sha256');
    if (!Number.isSafeInteger(file.size_bytes) || file.size_bytes < 0 || file.size_bytes > MAX_PACKET_BYTES ||
        typeof file.content_base64 !== 'string' || bytesByPath.has(relative) || portablePaths.has(portablePath)) {
      fail('DEPLOY_LEDGER_PACKET_INVALID', relative);
    }
    const bytes = Buffer.from(file.content_base64, 'base64');
    if (bytes.toString('base64') !== file.content_base64 || bytes.length !== file.size_bytes ||
        sha256(bytes) !== file.sha256) fail('DEPLOY_LEDGER_PACKET_TAMPERED', relative);
    const scanned = scanPacketBytes(bytes, relative, exactSecrets);
    corpus.push({ source: relative, value: scanned.text });
    for (const scalar of scanned.scalars) corpus.push({ source: relative, value: scalar });
    bytesByPath.set(relative, bytes);
    portablePaths.add(portablePath);
    total += bytes.length;
  }
  const paths = [...bytesByPath.keys()];
  if (JSON.stringify(paths) !== JSON.stringify([...paths].sort()) || total !== packet.total_size_bytes ||
      !bytesByPath.has('phase/SHA256SUMS') ||
      !bytesByPath.has('phase/deploy-effect-reconciliation.json') ||
      !bytesByPath.has('phase/deploy-provider-readback.json')) {
    fail('DEPLOY_LEDGER_PACKET_INVALID', 'packet inventory differs');
  }
  validateChecksumManifests(bytesByPath);
  scanDistributedSecrets(corpus, exactSecrets);
  return bytesByPath;
}

function walkPacketFiles(root, current = root, output = []) {
  const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    const relative = safeRelativePath(path.relative(root, absolute).split(path.sep).join('/'));
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      fail('DEPLOY_LEDGER_PACKET_INVALID', relative);
    }
    if (stat.isDirectory()) walkPacketFiles(root, absolute, output);
    else output.push({ absolute, relative, size: stat.size });
  }
  return output;
}

export function buildDeployLedgerPacket(packetDirectory, secretValues = []) {
  const root = assertNoLinkedPath(packetDirectory);
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || fs.realpathSync.native(root) !== root) {
    fail('DEPLOY_LEDGER_PACKET_INVALID', 'packet root differs');
  }
  const exactSecrets = secretValues.filter((value) => typeof value === 'string' && value.length > 0);
  const files = [];
  let total = 0;
  for (const entry of walkPacketFiles(root)) {
    const bytes = readStableRegularFile(entry.absolute);
    total += bytes.length;
    if (total > MAX_PACKET_BYTES || bytes.length !== entry.size) {
      fail('DEPLOY_LEDGER_PACKET_OVERSIZE', entry.relative);
    }
    files.push({ path: entry.relative, size_bytes: bytes.length, sha256: sha256(bytes),
      content_base64: bytes.toString('base64') });
  }
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const packet = { contract_version: DEPLOY_LEDGER_PACKET_CONTRACT, total_size_bytes: total, files };
  validateDeployLedgerPacket(packet, exactSecrets);
  return packet;
}

export function materializeDeployLedgerPacket(packet, outputDirectory) {
  const files = validateDeployLedgerPacket(packet);
  const output = assertNoLinkedPath(outputDirectory, { allowMissingLeaf: true });
  if (fs.existsSync(output)) fail('DEPLOY_LEDGER_PACKET_OUTPUT_EXISTS', output);
  fs.mkdirSync(output, { recursive: false, mode: 0o700 });
  for (const [relative, bytes] of files) {
    const target = path.resolve(output, ...relative.split('/'));
    if (!target.startsWith(`${output}${path.sep}`)) fail('DEPLOY_LEDGER_PACKET_PATH_INVALID', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
  }
}

function encodeRepositoryPath(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

export function createDeployLedgerGitHubClient({ repository, token, fetchImpl = globalThis.fetch,
  apiBase = 'https://api.github.com' }) {
  assertString(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
    'DEPLOY_LEDGER_REPOSITORY_INVALID', 'repository');
  if (typeof token !== 'string' || token.length < 20 || /[\r\n]/u.test(token)) {
    fail('DEPLOY_LEDGER_TOKEN_MISSING', 'GitHub token is required');
  }
  const repoPath = encodeRepositoryPath(repository);
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28' };
  async function request(method, endpoint, body, accepted = [200]) {
    const response = await fetchImpl(`${apiBase}/repos/${repoPath}${endpoint}`, {
      method, headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error',
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
      fail('DEPLOY_LEDGER_API_RESPONSE_OVERSIZE', `${method} ${endpoint}`);
    }
    let value = null;
    if (text) {
      try { value = JSON.parse(text); } catch { fail('DEPLOY_LEDGER_API_RESPONSE_INVALID', `${method} ${endpoint}`); }
    }
    if (!accepted.includes(response.status)) {
      const error = new Error(`DEPLOY_LEDGER_API_STATUS_${response.status}: ${method} ${endpoint}`);
      error.status = response.status;
      throw error;
    }
    const responseHeaders = {};
    for (const name of ['etag', 'last-modified', 'x-github-request-id']) {
      const headerValue = response.headers?.get?.(name);
      if (headerValue) responseHeaders[name] = headerValue;
    }
    return { status: response.status, value, headers: responseHeaders };
  }
  return { request };
}

const ARTIFACT_NAME = /^physio-deploy-(?:phase-[0-9a-f]{40}-(?:[0-9]{3}-[a-z0-9-]+|sentry-handoff)-[0-9]+-[0-9]+|terminal-[0-9a-f]{40}-sentry-[0-9]+-[0-9]+|completed-reuse-[0-9a-f]{40}(?:-sentry)?-[0-9]+-[0-9]+)$/u;
const DEPLOY_PHASES = new Set([
  'STARTED', 'SNAPSHOT_COMPLETED', 'LIVE_MUTATION_STARTED', 'LIVE_DEPLOY_COMPLETED',
  'PRESNAPSHOT_MANIFEST_STARTED', 'PRESNAPSHOT_MANIFEST_COMPLETED', 'MACHINE_STOP_STARTED',
  'MACHINE_STOPPED', 'POSTDEPLOY_SNAPSHOT_STARTED', 'POSTDEPLOY_SNAPSHOT_COMPLETED',
  'RESTORE_VOLUME_CREATE_STARTED', 'RESTORE_VOLUME_CREATED', 'VERIFIER_MACHINE_CREATE_STARTED',
  'VERIFIER_MACHINE_CREATED', 'RESTORE_VERIFY_STARTED', 'RESTORE_VERIFIED',
  'VERIFIER_MACHINE_STOP_STARTED', 'VERIFIER_MACHINE_STOPPED', 'VERIFIER_MACHINE_DESTROY_STARTED',
  'VERIFIER_MACHINE_DESTROYED', 'RESTORE_VOLUME_DESTROY_STARTED', 'RESTORE_VOLUME_DESTROYED',
  'MACHINE_START_STARTED', 'MACHINE_STARTED', 'RESTART_STARTED', 'POST_RESTART_VERIFIED',
  'DEPLOY_COMPLETED', 'SENTRY_ASSOCIATION_STARTED', 'COMPLETED',
]);
const DEPLOY_RESULTS = new Set(['STARTED', 'COMPLETED', 'STARTED_UNRESOLVED']);

function readPacketJson(bytesByPath, relative, code) {
  const bytes = bytesByPath.get(relative);
  if (!bytes || bytes.length > 2_097_152) fail(code, relative);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { fail(code, relative); }
  if (!bytes.equals(Buffer.from(canonicalJson(value)))) fail(code, `${relative} is not canonical JSON`);
  return value;
}

function validateArtifact(artifact, applicationSha) {
  exactKeys(artifact, ['digest', 'id', 'name', 'run_attempt', 'run_id', 'workflow_conclusion',
    'workflow_path'], 'DEPLOY_LEDGER_RECORD_INVALID', 'artifact');
  if (!Number.isSafeInteger(artifact.id) || artifact.id <= 0 || !ARTIFACT_NAME.test(artifact.name || '') ||
      !artifact.name.includes(applicationSha) || !DIGEST.test(artifact.digest || '') ||
      !Number.isSafeInteger(artifact.run_id) || artifact.run_id <= 0 ||
      !Number.isSafeInteger(artifact.run_attempt) || artifact.run_attempt <= 0 ||
      artifact.workflow_path !== '.github/workflows/physio-production-deploy.yml' ||
      !['in_progress', 'success', 'failure', 'cancelled', 'timed_out'].includes(artifact.workflow_conclusion)) {
    fail('DEPLOY_LEDGER_RECORD_INVALID', 'artifact identity differs');
  }
  const suffix = `-${artifact.run_id}-${artifact.run_attempt}`;
  if (!artifact.name.endsWith(suffix)) fail('DEPLOY_LEDGER_RECORD_INVALID', 'artifact run suffix differs');
}

function packetIdentity(packet, applicationSha) {
  const bytesByPath = validateDeployLedgerPacket(packet);
  const effect = readPacketJson(bytesByPath, 'phase/deploy-effect-reconciliation.json',
    'DEPLOY_LEDGER_EFFECT_INVALID');
  if (effect.contract_version !== 'assesssuite-physio-deploy-effect-reconciliation/2.0.0' ||
      effect.application_sha !== applicationSha || !DEPLOY_PHASES.has(effect.phase) ||
      !DEPLOY_RESULTS.has(effect.result) || !Number.isSafeInteger(effect.packet_ordinal) ||
      effect.packet_ordinal < 0 || effect.packet_ordinal > 255 ||
      !Number.isSafeInteger(effect.phase_ordinal) || effect.phase_ordinal < 0 || effect.phase_ordinal > 64 ||
      !Number.isSafeInteger(effect.phase_revision) || effect.phase_revision < 0 || effect.phase_revision > 99) {
    fail('DEPLOY_LEDGER_EFFECT_INVALID', 'effect identity differs');
  }
  const readback = readPacketJson(bytesByPath, 'phase/deploy-provider-readback.json',
    'DEPLOY_LEDGER_READBACK_INVALID');
  if (readback.contract_version !== 'assesssuite-physio-deploy-provider-readback/1.0.0' ||
      readback.application !== 'assesssuite-physio-production' || readback.phase !== effect.phase ||
      !['NOT_OBSERVED', 'PASS', 'STARTED_UNRESOLVED'].includes(readback.result)) {
    fail('DEPLOY_LEDGER_READBACK_INVALID', 'provider readback identity differs');
  }
  const packetSha256 = sha256(Buffer.from(canonicalJson(packet)));
  return { bytesByPath, effect, effectReceiptSha256: sha256(bytesByPath.get(
    'phase/deploy-effect-reconciliation.json')), packetSha256 };
}

export function validateDeployLedgerRecord(record, { repository, applicationSha, expectedPath }) {
  exactKeys(record, ['application_sequence', 'application_sha', 'artifact', 'contract_version',
    'effect_receipt_sha256', 'ledger_branch', 'ledger_provisioning_receipt_sha256',
    'packet_ordinal', 'packet_sha256', 'phase', 'phase_revision', 'predecessor_commit_sha',
    'previous_record_sha256', 'recorded_at', 'repository', 'result', 'resume_packet'],
  'DEPLOY_LEDGER_RECORD_INVALID', 'record');
  if (record.contract_version !== DEPLOY_LEDGER_RECORD_CONTRACT || record.repository !== repository ||
      record.ledger_branch !== DEPLOY_LEDGER_BRANCH || record.application_sha !== applicationSha ||
      !Number.isSafeInteger(record.application_sequence) || record.application_sequence < 0 ||
      !Number.isSafeInteger(record.packet_ordinal) || record.packet_ordinal < 0 || record.packet_ordinal > 255 ||
      !Number.isSafeInteger(record.phase_revision) || record.phase_revision < 0 || record.phase_revision > 99 ||
      !DEPLOY_PHASES.has(record.phase) || !DEPLOY_RESULTS.has(record.result)) {
    fail('DEPLOY_LEDGER_RECORD_INVALID', expectedPath);
  }
  validateArtifact(record.artifact, applicationSha);
  for (const [field, pattern] of [['predecessor_commit_sha', SHA40], ['previous_record_sha256', SHA256],
    ['ledger_provisioning_receipt_sha256', SHA256], ['effect_receipt_sha256', SHA256],
    ['packet_sha256', SHA256]]) assertString(record[field], pattern, 'DEPLOY_LEDGER_RECORD_INVALID', field);
  assertString(record.recorded_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u,
    'DEPLOY_LEDGER_RECORD_INVALID', 'recorded_at');
  const identity = packetIdentity(record.resume_packet, applicationSha);
  if (record.packet_sha256 !== identity.packetSha256 ||
      record.effect_receipt_sha256 !== identity.effectReceiptSha256 ||
      record.packet_ordinal !== identity.effect.packet_ordinal || record.phase !== identity.effect.phase ||
      record.phase_revision !== identity.effect.phase_revision || record.result !== identity.effect.result) {
    fail('DEPLOY_LEDGER_RECORD_INVALID', 'packet join differs');
  }
  const expectedName = `${String(record.application_sequence).padStart(10, '0')}-` +
    `${String(record.packet_ordinal).padStart(4, '0')}-${record.phase.toLowerCase()}-` +
    `r${String(record.phase_revision).padStart(2, '0')}-${record.artifact.id}.json`;
  if (path.posix.basename(expectedPath) !== expectedName) {
    fail('DEPLOY_LEDGER_RECORD_PATH_INVALID', expectedPath);
  }
  return record;
}

function immutablePacketPrefix(previousPacket, currentPacket) {
  const previous = validateDeployLedgerPacket(previousPacket);
  const current = validateDeployLedgerPacket(currentPacket);
  for (const [relative, bytes] of previous) {
    if (MUTABLE_PHASE_ALIASES.has(relative)) continue;
    const readback = current.get(relative);
    if (!readback || !readback.equals(bytes)) {
      fail('DEPLOY_LEDGER_PACKET_PREFIX_INVALID', relative);
    }
  }
}

function validateRecordTransition(previous, current, currentSha256) {
  if (!previous) {
    if (current.application_sequence !== 0 || current.packet_ordinal !== 0 ||
        current.phase !== 'STARTED' || current.result !== 'STARTED' ||
        current.previous_record_sha256 !== ZERO_SHA256) {
      fail('DEPLOY_LEDGER_CHAIN_INVALID', 'first record differs');
    }
    return;
  }
  if (current.application_sequence !== previous.record.application_sequence + 1 ||
      current.previous_record_sha256 !== previous.sha256) {
    fail('DEPLOY_LEDGER_CHAIN_INVALID', currentSha256);
  }
  const previousArtifact = previous.record.artifact;
  const currentArtifact = current.artifact;
  if (current.packet_ordinal < previous.record.packet_ordinal ||
      (current.packet_ordinal === previous.record.packet_ordinal &&
       (current.packet_sha256 !== previous.record.packet_sha256 ||
        current.effect_receipt_sha256 !== previous.record.effect_receipt_sha256)) ||
      currentArtifact.id <= previousArtifact.id) {
    fail('DEPLOY_LEDGER_NON_MAXIMAL_LINEAGE', currentSha256);
  }
  if (current.packet_ordinal > previous.record.packet_ordinal) {
    if (current.packet_ordinal !== previous.record.packet_ordinal + 1) {
      fail('DEPLOY_LEDGER_PACKET_GAP', currentSha256);
    }
    immutablePacketPrefix(previous.record.resume_packet, current.resume_packet);
  }
}

function genesisValue(repository) {
  return {
    contract_version: DEPLOY_LEDGER_GENESIS_CONTRACT,
    repository,
    ledger_branch: DEPLOY_LEDGER_BRANCH,
    purpose: 'protected append-only AssessSuite Physio deploy and Sentry effect ledger',
  };
}

export function buildDeployLedgerProvisioningContract(repository) {
  assertString(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
    'DEPLOY_LEDGER_REPOSITORY_INVALID', 'repository');
  const genesisBytes = Buffer.from(canonicalJson(genesisValue(repository)));
  return {
    contract_version: 'assesssuite-physio-deploy-ledger-provisioning/1.0.0',
    result: 'PRECONDITION_ONLY',
    repository,
    ledger_branch: DEPLOY_LEDGER_BRANCH,
    authority: 'EXTERNAL_L5_REPOSITORY_ADMINISTRATION_ONLY',
    required_active_rule_types: ['deletion', 'non_fast_forward', 'required_linear_history'],
    production_workflow_may_create_branch: false,
    production_workflow_may_create_or_modify_protection: false,
    provisioning_order: [
      'CREATE_RULESET_TARGETING_EXACT_NONEXISTENT_REF',
      'VERIFY_EXACT_REF_RULESET_ACTIVE_WITH_DELETION_NON_FAST_FORWARD_AND_LINEAR_HISTORY_RULES',
      'CREATE_CANONICAL_ZERO_PARENT_GENESIS_COMMIT_AND_EXACT_REF',
      'VERIFY_GENESIS_REF_COMMIT_TREE_BLOB_AND_ACTIVE_RULES',
      'APPEND_CANONICAL_L5_PROVISIONING_RECEIPT_COMMIT_WITH_FORCE_FALSE',
      'VERIFY_PROVISIONING_COMMIT_AND_FINAL_BRANCH_REF',
    ],
    genesis: {
      parent_count: 0,
      commit_message: 'Initialize protected AssessSuite Physio deploy ledger',
      blob_path: 'deploy-ledger/genesis.json', blob_mode: '100644',
      blob_content_base64: genesisBytes.toString('base64'), blob_size_bytes: genesisBytes.length,
      git_blob_sha: gitBlobSha(genesisBytes), blob_sha256: sha256(genesisBytes),
    },
    provisioning_receipt_commit: {
      parent: 'EXACT_ZERO_PARENT_GENESIS_COMMIT_SHA',
      commit_message: 'Bind external L5 deploy ledger provisioning receipt',
      blob_path: 'deploy-ledger/provisioning.json', blob_mode: '100644',
      blob_contract: DEPLOY_LEDGER_PROVISIONING_RECEIPT_CONTRACT, ref_update_force: false,
    },
  };
}

function normalizedRuleset(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !Number.isSafeInteger(value.id) || value.id <= 0 || value.name !== DEPLOY_LEDGER_BRANCH ||
      value.enforcement !== 'active' || value.target !== 'branch' ||
      JSON.stringify(value.conditions?.ref_name?.include) !==
        JSON.stringify([`refs/heads/${DEPLOY_LEDGER_BRANCH}`]) ||
      JSON.stringify(value.conditions?.ref_name?.exclude) !== JSON.stringify([]) ||
      !Array.isArray(value.rules) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value.updated_at || '')) {
    fail('DEPLOY_LEDGER_RULESET_INVALID', 'identity, scope, enforcement, or updated_at differs');
  }
  const rules = value.rules.map((rule) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule) || typeof rule.type !== 'string' ||
        JSON.stringify(Object.keys(rule).sort()) !== JSON.stringify(['type'])) {
      fail('DEPLOY_LEDGER_RULESET_INVALID', 'rule differs');
    }
    return structuredClone(rule);
  }).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const types = rules.map((rule) => rule.type).sort();
  if (JSON.stringify(types) !==
      JSON.stringify(['deletion', 'non_fast_forward', 'required_linear_history'])) {
    fail('DEPLOY_LEDGER_RULESET_INVALID', 'required immutable rules absent');
  }
  return { id: value.id, name: value.name, enforcement: value.enforcement, target: value.target,
    conditions: structuredClone(value.conditions), rules, updated_at: value.updated_at };
}

function validateGenesisReadback(value) {
  exactKeys(value, ['genesis_blob_path', 'genesis_blob_sha', 'genesis_blob_sha256',
    'genesis_commit_message', 'genesis_commit_sha', 'genesis_parent_count',
    'genesis_ref_readback_sha', 'genesis_tree_sha'],
  'DEPLOY_LEDGER_GENESIS_READBACK_INVALID', 'genesis readback');
  if (value.genesis_parent_count !== 0 ||
      value.genesis_commit_message !== 'Initialize protected AssessSuite Physio deploy ledger' ||
      value.genesis_blob_path !== 'deploy-ledger/genesis.json' ||
      value.genesis_ref_readback_sha !== value.genesis_commit_sha) {
    fail('DEPLOY_LEDGER_GENESIS_READBACK_INVALID', 'genesis identity differs');
  }
  for (const field of ['genesis_blob_sha', 'genesis_commit_sha', 'genesis_ref_readback_sha', 'genesis_tree_sha']) {
    assertString(value[field], SHA40, 'DEPLOY_LEDGER_GENESIS_READBACK_INVALID', field);
  }
  assertString(value.genesis_blob_sha256, SHA256,
    'DEPLOY_LEDGER_GENESIS_READBACK_INVALID', 'genesis_blob_sha256');
  return structuredClone(value);
}

export function buildDeployLedgerProvisioningReceipt({ repository, fullRuleset, genesisReadback,
  provisionedAt }) {
  assertString(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u,
    'DEPLOY_LEDGER_REPOSITORY_INVALID', 'repository');
  if (!fullRuleset || typeof fullRuleset !== 'object' || Array.isArray(fullRuleset) ||
      JSON.stringify(fullRuleset.bypass_actors) !== JSON.stringify([])) {
    fail('DEPLOY_LEDGER_RULESET_BYPASS_INVALID', 'L5 receipt requires exact empty bypass actors');
  }
  assertString(provisionedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u,
    'DEPLOY_LEDGER_PROVISIONING_RECEIPT_INVALID', 'provisioned_at');
  const visibleRuleset = normalizedRuleset(fullRuleset);
  if (!Number.isFinite(Date.parse(provisionedAt)) ||
      Date.parse(provisionedAt) < Date.parse(visibleRuleset.updated_at)) {
    fail('DEPLOY_LEDGER_PROVISIONING_RECEIPT_INVALID', 'provisioning predates exact ruleset version');
  }
  const genesis = validateGenesisReadback(genesisReadback);
  return {
    contract_version: DEPLOY_LEDGER_PROVISIONING_RECEIPT_CONTRACT,
    result: 'PASS', repository, ledger_branch: DEPLOY_LEDGER_BRANCH,
    exact_ref: `refs/heads/${DEPLOY_LEDGER_BRANCH}`,
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

function validateProvisioningReceipt(receipt, repository) {
  exactKeys(receipt, ['authority', 'bypass_actors', 'contract_version', 'exact_ref',
    'full_no_bypass_ruleset_sha256', 'genesis_blob_path', 'genesis_blob_sha',
    'genesis_blob_sha256', 'genesis_commit_message', 'genesis_commit_sha', 'genesis_parent_count',
    'genesis_ref_readback_sha', 'genesis_tree_sha', 'ledger_branch', 'no_bypass_verified_by_external_l5',
    'provisioned_at', 'repository', 'result', 'ruleset_first_precondition_verified',
    'visible_ruleset', 'visible_ruleset_sha256'],
  'DEPLOY_LEDGER_PROVISIONING_RECEIPT_INVALID', 'provisioning receipt');
  if (receipt.contract_version !== DEPLOY_LEDGER_PROVISIONING_RECEIPT_CONTRACT ||
      receipt.result !== 'PASS' || receipt.repository !== repository ||
      receipt.ledger_branch !== DEPLOY_LEDGER_BRANCH ||
      receipt.exact_ref !== `refs/heads/${DEPLOY_LEDGER_BRANCH}` ||
      receipt.authority !== 'EXTERNAL_L5_REPOSITORY_ADMINISTRATION_ONLY' ||
      receipt.ruleset_first_precondition_verified !== true ||
      receipt.no_bypass_verified_by_external_l5 !== true ||
      JSON.stringify(receipt.bypass_actors) !== JSON.stringify([])) {
    fail('DEPLOY_LEDGER_PROVISIONING_RECEIPT_INVALID', 'identity or no-bypass attestation differs');
  }
  assertString(receipt.full_no_bypass_ruleset_sha256, SHA256,
    'DEPLOY_LEDGER_PROVISIONING_RECEIPT_INVALID', 'full_no_bypass_ruleset_sha256');
  assertString(receipt.provisioned_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u,
    'DEPLOY_LEDGER_PROVISIONING_RECEIPT_INVALID', 'provisioned_at');
  const visible = normalizedRuleset(receipt.visible_ruleset);
  if (!Number.isFinite(Date.parse(receipt.provisioned_at)) ||
      Date.parse(receipt.provisioned_at) < Date.parse(visible.updated_at)) {
    fail('DEPLOY_LEDGER_PROVISIONING_RECEIPT_INVALID', 'provisioning predates exact ruleset version');
  }
  if (canonicalJson(visible) !== canonicalJson(receipt.visible_ruleset) ||
      sha256(Buffer.from(canonicalJson(visible))) !== receipt.visible_ruleset_sha256) {
    fail('DEPLOY_LEDGER_PROVISIONING_RECEIPT_INVALID', 'visible ruleset commitment differs');
  }
  validateGenesisReadback({
    genesis_blob_path: receipt.genesis_blob_path, genesis_blob_sha: receipt.genesis_blob_sha,
    genesis_blob_sha256: receipt.genesis_blob_sha256,
    genesis_commit_message: receipt.genesis_commit_message,
    genesis_commit_sha: receipt.genesis_commit_sha,
    genesis_parent_count: receipt.genesis_parent_count,
    genesis_ref_readback_sha: receipt.genesis_ref_readback_sha,
    genesis_tree_sha: receipt.genesis_tree_sha,
  });
}

async function loadTree(client, treeSha, cache = new Map()) {
  if (!cache.has(treeSha)) {
    const tree = (await client.request('GET', `/git/trees/${treeSha}?recursive=1`)).value;
    if (tree?.sha !== treeSha || tree?.truncated !== false || !Array.isArray(tree?.tree)) {
      fail('DEPLOY_LEDGER_TREE_INVALID', treeSha);
    }
    cache.set(treeSha, tree);
  }
  return cache.get(treeSha);
}

async function loadCommit(client, commitSha, cache = new Map()) {
  if (!cache.has(commitSha)) {
    const commit = (await client.request('GET', `/git/commits/${commitSha}`)).value;
    if (commit?.sha !== commitSha || !SHA40.test(commit?.tree?.sha || '') || !Array.isArray(commit?.parents)) {
      fail('DEPLOY_LEDGER_COMMIT_INVALID', commitSha);
    }
    cache.set(commitSha, commit);
  }
  return cache.get(commitSha);
}

function blobTreeMap(tree) {
  const paths = new Set();
  const blobs = new Map();
  for (const entry of tree.tree) {
    if (!entry || typeof entry.path !== 'string' || paths.has(entry.path)) {
      fail('DEPLOY_LEDGER_TREE_INVALID', tree.sha);
    }
    paths.add(entry.path);
    if (entry.type === 'tree') {
      if (entry.mode !== '040000' || !tree.tree.some((candidate) =>
        candidate?.type === 'blob' && candidate.path.startsWith(`${entry.path}/`))) {
        fail('DEPLOY_LEDGER_TREE_INVALID', entry.path);
      }
      continue;
    }
    if (entry.type !== 'blob') fail('DEPLOY_LEDGER_TREE_INVALID', entry.path);
    blobs.set(entry.path, entry);
  }
  return blobs;
}

async function listLedgerHistory(client) {
  const listed = [];
  const maximumPages = Math.ceil(MAX_LEDGER_COMMITS / 100) + 1;
  for (let page = 1; page <= maximumPages; page += 1) {
    const rows = (await client.request('GET',
      `/commits?sha=${encodeURIComponent(DEPLOY_LEDGER_BRANCH)}&per_page=100&page=${page}`)).value;
    if (!Array.isArray(rows)) fail('DEPLOY_LEDGER_HISTORY_PAGINATION_INVALID', `page ${page}`);
    listed.push(...rows);
    if (listed.length > MAX_LEDGER_COMMITS) {
      fail('DEPLOY_LEDGER_HISTORY_BOUND_EXCEEDED', String(listed.length));
    }
    if (rows.length < 100) return listed;
  }
  fail('DEPLOY_LEDGER_HISTORY_PAGINATION_INVALID', 'history exceeds the exact global bound');
}

async function loadRefTreeAndProvisioning(client, repository) {
  let branch;
  try {
    branch = (await client.request('GET', `/branches/${encodeURIComponent(DEPLOY_LEDGER_BRANCH)}`)).value;
  } catch (error) {
    if (error.status === 404) {
      fail('DEPLOY_LEDGER_BRANCH_ABSENT_PREPROVISION_REQUIRED', DEPLOY_LEDGER_BRANCH);
    }
    throw error;
  }
  if (branch?.name !== DEPLOY_LEDGER_BRANCH || branch?.protected !== true ||
      branch?.protection?.enabled !== true) {
    fail('DEPLOY_LEDGER_BRANCH_UNPROTECTED', DEPLOY_LEDGER_BRANCH);
  }
  const activeRulesResponse = await client.request('GET',
    `/rules/branches/${encodeURIComponent(DEPLOY_LEDGER_BRANCH)}`);
  const activeRules = activeRulesResponse.value;
  const activeRuleTypes = new Set(Array.isArray(activeRules) ? activeRules.map((rule) => rule?.type) : []);
  if (!activeRuleTypes.has('deletion') || !activeRuleTypes.has('non_fast_forward') ||
      !activeRuleTypes.has('required_linear_history')) {
    fail('DEPLOY_LEDGER_BRANCH_UNPROTECTED',
      'deletion/non_fast_forward/required_linear_history active rules absent');
  }
  const ref = (await client.request('GET',
    `/git/ref/heads/${encodeURIComponent(DEPLOY_LEDGER_BRANCH)}`)).value;
  const headSha = ref?.object?.sha;
  if (ref?.ref !== `refs/heads/${DEPLOY_LEDGER_BRANCH}` || ref?.object?.type !== 'commit' ||
      !SHA40.test(headSha || '') || branch?.commit?.sha !== headSha) {
    fail('DEPLOY_LEDGER_REF_INVALID', DEPLOY_LEDGER_BRANCH);
  }
  const commit = await loadCommit(client, headSha);
  const treeSha = commit.tree.sha;
  const tree = await loadTree(client, treeSha);
  const blobs = blobTreeMap(tree);
  return { branch, activeRules, headSha, commit, treeSha, tree, blobs };
}

async function auditLedgerHistory({ client, repository, state, records }) {
  const commitCache = new Map([[state.headSha, state.commit]]);
  const treeCache = new Map([[state.treeSha, state.tree]]);
  const listed = await listLedgerHistory(client);
  if (listed.length !== records.length + 2 || listed[0]?.sha !== state.headSha) {
    fail('DEPLOY_LEDGER_HISTORY_INVALID', 'global commit and record counts differ');
  }
  for (let index = 0; index < listed.length; index += 1) {
    const row = listed[index];
    if (!SHA40.test(row?.sha || '') || !Array.isArray(row?.parents) ||
        (index === listed.length - 1 ? row.parents.length !== 0 :
          row.parents.length !== 1 || row.parents[0]?.sha !== listed[index + 1]?.sha)) {
      fail('DEPLOY_LEDGER_HISTORY_INVALID', `paginated commit ${index} differs`);
    }
  }
  const genesisSha = listed.at(-1).sha;
  const genesisCommit = await loadCommit(client, genesisSha, commitCache);
  if (genesisCommit.parents.length !== 0 ||
      genesisCommit.message !== 'Initialize protected AssessSuite Physio deploy ledger') {
    fail('DEPLOY_LEDGER_GENESIS_INVALID', genesisSha);
  }
  const genesisTree = await loadTree(client, genesisCommit.tree.sha, treeCache);
  const genesisBlobs = blobTreeMap(genesisTree);
  if (genesisBlobs.size !== 1) fail('DEPLOY_LEDGER_GENESIS_INVALID', 'genesis tree differs');
  const genesisEntry = genesisBlobs.get('deploy-ledger/genesis.json');
  if (genesisEntry?.mode !== '100644' || genesisEntry?.type !== 'blob' || !SHA40.test(genesisEntry?.sha || '')) {
    fail('DEPLOY_LEDGER_GENESIS_INVALID', 'genesis entry differs');
  }
  const genesisBlob = (await client.request('GET', `/git/blobs/${genesisEntry.sha}`)).value;
  const genesisBytes = Buffer.from(String(genesisBlob?.content || '').replaceAll('\n', ''), 'base64');
  if (genesisBlob?.sha !== genesisEntry.sha || genesisBlob?.encoding !== 'base64' ||
      genesisBytes.length !== genesisBlob?.size || gitBlobSha(genesisBytes) !== genesisEntry.sha ||
      !genesisBytes.equals(Buffer.from(canonicalJson(genesisValue(repository))))) {
    fail('DEPLOY_LEDGER_GENESIS_INVALID', 'genesis blob differs');
  }

  const provisioningCommitSha = listed.at(-2).sha;
  const provisioningCommit = await loadCommit(client, provisioningCommitSha, commitCache);
  if (provisioningCommit.parents.length !== 1 || provisioningCommit.parents[0]?.sha !== genesisSha ||
      provisioningCommit.message !== 'Bind external L5 deploy ledger provisioning receipt') {
    fail('DEPLOY_LEDGER_PROVISIONING_COMMIT_INVALID', provisioningCommitSha);
  }
  const provisioningTree = blobTreeMap(await loadTree(client, provisioningCommit.tree.sha, treeCache));
  if (provisioningTree.size !== 2 ||
      provisioningTree.get('deploy-ledger/genesis.json')?.sha !== genesisEntry.sha) {
    fail('DEPLOY_LEDGER_PROVISIONING_COMMIT_INVALID', 'provisioning tree differs');
  }
  const provisioningEntry = provisioningTree.get('deploy-ledger/provisioning.json');
  if (provisioningEntry?.mode !== '100644' || provisioningEntry?.type !== 'blob' ||
      !SHA40.test(provisioningEntry?.sha || '')) {
    fail('DEPLOY_LEDGER_PROVISIONING_COMMIT_INVALID', 'provisioning entry differs');
  }
  const provisioningBlob = (await client.request('GET', `/git/blobs/${provisioningEntry.sha}`)).value;
  const provisioningBytes = Buffer.from(String(provisioningBlob?.content || '').replaceAll('\n', ''), 'base64');
  let provisioningReceipt;
  try { provisioningReceipt = JSON.parse(provisioningBytes.toString('utf8')); } catch {
    fail('DEPLOY_LEDGER_PROVISIONING_RECEIPT_INVALID', 'receipt JSON differs');
  }
  validateProvisioningReceipt(provisioningReceipt, repository);
  if (provisioningBlob?.sha !== provisioningEntry.sha || provisioningBlob?.encoding !== 'base64' ||
      provisioningBytes.length !== provisioningBlob?.size || gitBlobSha(provisioningBytes) !== provisioningEntry.sha ||
      !provisioningBytes.equals(Buffer.from(canonicalJson(provisioningReceipt))) ||
      provisioningReceipt.genesis_commit_sha !== genesisSha ||
      provisioningReceipt.genesis_ref_readback_sha !== genesisSha ||
      provisioningReceipt.genesis_tree_sha !== genesisCommit.tree.sha ||
      provisioningReceipt.genesis_blob_sha !== genesisEntry.sha ||
      provisioningReceipt.genesis_blob_sha256 !== sha256(genesisBytes)) {
    fail('DEPLOY_LEDGER_PROVISIONING_JOIN_INVALID', 'receipt does not bind exact genesis readback');
  }

  const recordsByPath = new Map(records.map((record) => [record.path, record]));
  const seen = new Set();
  let expectedParent = provisioningCommitSha;
  for (const listedCommit of listed.slice(0, -2).reverse()) {
    const commit = await loadCommit(client, listedCommit.sha, commitCache);
    if (commit.parents.length !== 1 || commit.parents[0]?.sha !== expectedParent) {
      fail('DEPLOY_LEDGER_HISTORY_INVALID', `commit ${commit.sha} is not linear`);
    }
    const parent = await loadCommit(client, expectedParent, commitCache);
    const parentTree = blobTreeMap(await loadTree(client, parent.tree.sha, treeCache));
    const currentTree = blobTreeMap(await loadTree(client, commit.tree.sha, treeCache));
    if (currentTree.size !== parentTree.size + 1) {
      fail('DEPLOY_LEDGER_HISTORY_NOT_APPEND_ONLY', commit.sha);
    }
    for (const [entryPath, entry] of parentTree) {
      const current = currentTree.get(entryPath);
      if (!current || current.mode !== entry.mode || current.type !== entry.type || current.sha !== entry.sha) {
        fail('DEPLOY_LEDGER_HISTORY_NOT_APPEND_ONLY', entryPath);
      }
    }
    const additions = [...currentTree].filter(([entryPath]) => !parentTree.has(entryPath));
    if (additions.length !== 1) fail('DEPLOY_LEDGER_HISTORY_NOT_APPEND_ONLY', commit.sha);
    const [recordPath, addition] = additions[0];
    const record = recordsByPath.get(recordPath);
    if (!record || seen.has(recordPath) || addition.mode !== '100644' || addition.type !== 'blob' ||
        addition.sha !== record.blob_sha || record.record.predecessor_commit_sha !== expectedParent ||
        commit.message !== `physio deploy ledger ${record.record.application_sha} packet ` +
          `${record.record.packet_ordinal} ${record.record.phase}`) {
      fail('DEPLOY_LEDGER_HISTORY_NOT_APPEND_ONLY', recordPath);
    }
    record.commit_sha = commit.sha;
    seen.add(recordPath);
    expectedParent = commit.sha;
  }
  if (seen.size !== records.length || expectedParent !== state.headSha) {
    fail('DEPLOY_LEDGER_HISTORY_INVALID', 'history does not reach exact tip');
  }
  const finalRef = (await client.request('GET',
    `/git/ref/heads/${encodeURIComponent(DEPLOY_LEDGER_BRANCH)}`)).value;
  if (finalRef?.object?.sha !== state.headSha) {
    fail('DEPLOY_LEDGER_HISTORY_CHANGED', 'branch moved during global audit');
  }
  const rulesetResponse = await client.request('GET', `/rulesets/${provisioningReceipt.visible_ruleset.id}`);
  const normalizedRuntimeRuleset = normalizedRuleset(rulesetResponse.value);
  if (canonicalJson(normalizedRuntimeRuleset) !== canonicalJson(provisioningReceipt.visible_ruleset) ||
      sha256(Buffer.from(canonicalJson(normalizedRuntimeRuleset))) !== provisioningReceipt.visible_ruleset_sha256) {
    fail('DEPLOY_LEDGER_PROVISIONING_DRIFT', 'runtime-visible ruleset differs from exact L5 receipt');
  }
  return { genesisSha, provisioningCommitSha, provisioningReceipt,
    provisioningReceiptSha256: sha256(Buffer.from(canonicalJson(provisioningReceipt))),
    commitCount: listed.length };
}

export async function inventoryDeployLedger({ client, repository, applicationSha }) {
  assertString(applicationSha, SHA40, 'DEPLOY_LEDGER_APPLICATION_SHA_INVALID', 'application sha');
  const state = await loadRefTreeAndProvisioning(client, repository);
  const recordPattern = /^deploy-ledger\/applications\/([0-9a-f]{40})\/records\/[^/]+\.json$/u;
  const allRecords = [];
  for (const entry of state.tree.tree.filter((candidate) => recordPattern.test(candidate?.path || ''))) {
    const match = entry.path.match(recordPattern);
    if (!match || entry.type !== 'blob' || entry.mode !== '100644' || !SHA40.test(entry.sha || '')) {
      fail('DEPLOY_LEDGER_TREE_ENTRY_INVALID', entry.path || 'unknown');
    }
    const blob = (await client.request('GET', `/git/blobs/${entry.sha}`)).value;
    if (blob?.sha !== entry.sha || blob?.encoding !== 'base64' || typeof blob.content !== 'string' ||
        !Number.isSafeInteger(blob.size) || blob.size <= 0 || blob.size > MAX_RECORD_BYTES) {
      fail('DEPLOY_LEDGER_BLOB_INVALID', entry.path);
    }
    const bytes = Buffer.from(blob.content.replaceAll('\n', ''), 'base64');
    if (bytes.length !== blob.size || gitBlobSha(bytes) !== entry.sha) {
      fail('DEPLOY_LEDGER_BLOB_TAMPERED', entry.path);
    }
    let record;
    try { record = JSON.parse(bytes.toString('utf8')); } catch {
      fail('DEPLOY_LEDGER_RECORD_JSON_INVALID', entry.path);
    }
    validateDeployLedgerRecord(record, { repository, applicationSha: match[1], expectedPath: entry.path });
    if (!bytes.equals(Buffer.from(canonicalJson(record)))) {
      fail('DEPLOY_LEDGER_RECORD_CANONICAL_INVALID', entry.path);
    }
    allRecords.push({ path: entry.path, blob_sha: entry.sha, sha256: sha256(bytes), record });
  }
  const allowed = new Set(['deploy-ledger/genesis.json', 'deploy-ledger/provisioning.json',
    ...allRecords.map((entry) => entry.path)]);
  for (const entryPath of state.blobs.keys()) {
    if (!allowed.has(entryPath)) fail('DEPLOY_LEDGER_TREE_ENTRY_INVALID', entryPath);
  }
  const byApplication = new Map();
  for (const entry of allRecords) {
    const rows = byApplication.get(entry.record.application_sha) ?? [];
    rows.push(entry);
    byApplication.set(entry.record.application_sha, rows);
  }
  for (const [sha, rows] of byApplication) {
    rows.sort((left, right) => left.record.application_sequence - right.record.application_sequence);
    let previous = null;
    for (const entry of rows) {
      validateRecordTransition(previous, entry.record, entry.sha256);
      previous = entry;
    }
    if (rows.some((entry, index) => entry.record.application_sequence !== index)) {
      fail('DEPLOY_LEDGER_CHAIN_INVALID', sha);
    }
  }
  const history = await auditLedgerHistory({ client, repository, state, records: allRecords });
  const provisioningReceiptSha256 = history.provisioningReceiptSha256;
  for (const entry of allRecords) {
    if (entry.record.ledger_provisioning_receipt_sha256 !== provisioningReceiptSha256) {
      fail('DEPLOY_LEDGER_PROVISIONING_JOIN_INVALID', entry.path);
    }
  }
  const records = byApplication.get(applicationSha) ?? [];
  const latest = records.at(-1) ?? null;
  return {
    contract_version: DEPLOY_LEDGER_INVENTORY_CONTRACT, result: 'PASS', repository,
    ledger_branch: DEPLOY_LEDGER_BRANCH, application_sha: applicationSha,
    branch_protected: true, deletion_protected: true, non_fast_forward_protected: true,
    ledger_head_sha: state.headSha, ledger_tree_sha: state.treeSha,
    ledger_genesis_sha: history.genesisSha, audited_commit_count: history.commitCount,
    ledger_provisioning_commit_sha: history.provisioningCommitSha,
    ledger_provisioning_receipt: history.provisioningReceipt,
    ledger_provisioning_receipt_sha256: provisioningReceiptSha256,
    record_count: records.length, records,
    latest_record_path: latest?.path ?? null, latest_record_sha256: latest?.sha256 ?? ZERO_SHA256,
    latest_record_commit_sha: latest?.commit_sha ?? ZERO_SHA256,
    latest_record: latest?.record ?? null, inventoried_at: new Date().toISOString(),
  };
}

function validateAppendRequest(request, inventory) {
  exactKeys(request, ['application_sha', 'artifact', 'ledger_branch',
    'ledger_provisioning_receipt_sha256', 'repository', 'resume_packet'],
  'DEPLOY_LEDGER_APPEND_REQUEST_INVALID', 'append request');
  if (request.repository !== inventory.repository || request.ledger_branch !== DEPLOY_LEDGER_BRANCH ||
      request.application_sha !== inventory.application_sha ||
      request.ledger_provisioning_receipt_sha256 !== inventory.ledger_provisioning_receipt_sha256) {
    fail('DEPLOY_LEDGER_APPEND_REQUEST_INVALID', 'request identity differs');
  }
  validateArtifact(request.artifact, inventory.application_sha);
  const identity = packetIdentity(request.resume_packet, inventory.application_sha);
  const latest = inventory.latest_record;
  if (!latest) {
    if (identity.effect.packet_ordinal !== 0 || identity.effect.phase !== 'STARTED' ||
        identity.effect.result !== 'STARTED') {
      fail('DEPLOY_LEDGER_APPEND_REQUEST_INVALID', 'first packet differs');
    }
  } else {
    if (request.artifact.id <= latest.artifact.id ||
        identity.effect.packet_ordinal < latest.packet_ordinal ||
        identity.effect.packet_ordinal > latest.packet_ordinal + 1) {
      fail('DEPLOY_LEDGER_NON_MAXIMAL_LINEAGE', 'append is not newer than exact durable tip');
    }
    if (identity.effect.packet_ordinal === latest.packet_ordinal) {
      if (identity.packetSha256 !== latest.packet_sha256 ||
          identity.effectReceiptSha256 !== latest.effect_receipt_sha256) {
        fail('DEPLOY_LEDGER_TRANSPORT_REFRESH_INVALID', 'same ordinal packet differs');
      }
    } else {
      immutablePacketPrefix(latest.resume_packet, request.resume_packet);
    }
  }
  return identity;
}

async function commitIsReachable(client, descendantSha, ancestorSha) {
  let cursor = descendantSha;
  for (let depth = 0; depth < MAX_LEDGER_COMMITS; depth += 1) {
    if (cursor === ancestorSha) return true;
    const commit = (await client.request('GET', `/git/commits/${cursor}`)).value;
    if (commit?.sha !== cursor || !Array.isArray(commit.parents) || commit.parents.length !== 1 ||
        !SHA40.test(commit.parents[0]?.sha || '')) return false;
    cursor = commit.parents[0].sha;
  }
  return false;
}

export async function appendDeployLedgerRecord({ client, repository, applicationSha, request,
  expectedHeadSha, expectedProvisioningReceiptSha256, now = () => new Date() }) {
  assertString(expectedHeadSha, SHA40, 'DEPLOY_LEDGER_EXPECTED_HEAD_INVALID', 'expected head sha');
  assertString(expectedProvisioningReceiptSha256, SHA256,
    'DEPLOY_LEDGER_PROVISIONING_INPUT_INVALID', 'expected provisioning receipt sha256');
  const inventory = await inventoryDeployLedger({ client, repository, applicationSha });
  if (inventory.ledger_head_sha !== expectedHeadSha) {
    fail('DEPLOY_LEDGER_NON_FAST_FORWARD', 'ledger head changed before append');
  }
  if (inventory.ledger_provisioning_receipt_sha256 !== expectedProvisioningReceiptSha256) {
    fail('DEPLOY_LEDGER_PROVISIONING_INPUT_MISMATCH', 'dispatch is not bound to exact L5 receipt');
  }
  const identity = validateAppendRequest(request, inventory);
  const sequence = inventory.record_count;
  const record = {
    contract_version: DEPLOY_LEDGER_RECORD_CONTRACT,
    repository,
    ledger_branch: DEPLOY_LEDGER_BRANCH,
    application_sha: applicationSha,
    application_sequence: sequence,
    packet_ordinal: identity.effect.packet_ordinal,
    phase: identity.effect.phase,
    phase_revision: identity.effect.phase_revision,
    result: identity.effect.result,
    effect_receipt_sha256: identity.effectReceiptSha256,
    packet_sha256: identity.packetSha256,
    artifact: request.artifact,
    resume_packet: request.resume_packet,
    predecessor_commit_sha: inventory.ledger_head_sha,
    previous_record_sha256: inventory.latest_record_sha256,
    ledger_provisioning_receipt_sha256: inventory.ledger_provisioning_receipt_sha256,
    recorded_at: now().toISOString(),
  };
  const recordPath = `deploy-ledger/applications/${applicationSha}/records/` +
    `${String(sequence).padStart(10, '0')}-${String(record.packet_ordinal).padStart(4, '0')}-` +
    `${record.phase.toLowerCase()}-r${String(record.phase_revision).padStart(2, '0')}-` +
    `${record.artifact.id}.json`;
  validateDeployLedgerRecord(record, { repository, applicationSha, expectedPath: recordPath });
  const bytes = Buffer.from(canonicalJson(record));
  const recordSha256 = sha256(bytes);
  const createdBlob = (await client.request('POST', '/git/blobs', {
    content: bytes.toString('base64'), encoding: 'base64',
  }, [201])).value;
  if (createdBlob?.sha !== gitBlobSha(bytes)) fail('DEPLOY_LEDGER_BLOB_CREATE_MISMATCH', recordPath);
  const createdTree = (await client.request('POST', '/git/trees', {
    base_tree: inventory.ledger_tree_sha,
    tree: [{ path: recordPath, mode: '100644', type: 'blob', sha: createdBlob.sha }],
  }, [201])).value;
  assertString(createdTree?.sha, SHA40, 'DEPLOY_LEDGER_TREE_CREATE_INVALID', 'created tree sha');
  const message = `physio deploy ledger ${applicationSha} packet ${record.packet_ordinal} ${record.phase}`;
  const createdCommit = (await client.request('POST', '/git/commits', {
    message, tree: createdTree.sha, parents: [inventory.ledger_head_sha],
  }, [201])).value;
  assertString(createdCommit?.sha, SHA40, 'DEPLOY_LEDGER_COMMIT_CREATE_INVALID', 'created commit sha');
  let updateError = null;
  try {
    await client.request('PATCH', `/git/refs/heads/${encodeURIComponent(DEPLOY_LEDGER_BRANCH)}`, {
      sha: createdCommit.sha, force: false,
    }, [200]);
  } catch (error) {
    updateError = error;
  }
  let readback;
  try {
    readback = await inventoryDeployLedger({ client, repository, applicationSha });
  } catch (error) {
    if (updateError) fail('DEPLOY_LEDGER_NON_FAST_FORWARD', `${updateError.message}; ${error.message}`);
    throw error;
  }
  if (!(await commitIsReachable(client, readback.ledger_head_sha, createdCommit.sha))) {
    fail('DEPLOY_LEDGER_NON_FAST_FORWARD', updateError?.message || 'created commit is not reachable');
  }
  const exactRecord = readback.records.find((entry) => entry.path === recordPath);
  if (exactRecord?.sha256 !== recordSha256 || exactRecord?.commit_sha !== createdCommit.sha) {
    fail('DEPLOY_LEDGER_RECORD_READBACK_MISMATCH', recordPath);
  }
  const exactCommit = (await client.request('GET', `/git/commits/${createdCommit.sha}`)).value;
  if (exactCommit?.sha !== createdCommit.sha || exactCommit?.message !== message ||
      exactCommit?.tree?.sha !== createdTree.sha || exactCommit?.parents?.length !== 1 ||
      exactCommit.parents[0]?.sha !== inventory.ledger_head_sha) {
    fail('DEPLOY_LEDGER_COMMIT_READBACK_MISMATCH', createdCommit.sha);
  }
  const exactTree = (await client.request('GET', `/git/trees/${createdTree.sha}?recursive=1`)).value;
  const exactEntry = exactTree?.tree?.find((entry) => entry.path === recordPath);
  if (exactTree?.sha !== createdTree.sha || exactTree?.truncated !== false || exactEntry?.sha !== createdBlob.sha ||
      exactEntry?.mode !== '100644' || exactEntry?.type !== 'blob') {
    fail('DEPLOY_LEDGER_TREE_READBACK_MISMATCH', recordPath);
  }
  const exactBlob = (await client.request('GET', `/git/blobs/${createdBlob.sha}`)).value;
  const exactBytes = Buffer.from(String(exactBlob?.content || '').replaceAll('\n', ''), 'base64');
  if (exactBlob?.sha !== createdBlob.sha || exactBlob?.encoding !== 'base64' || !exactBytes.equals(bytes) ||
      gitBlobSha(exactBytes) !== createdBlob.sha || sha256(exactBytes) !== recordSha256) {
    fail('DEPLOY_LEDGER_BLOB_READBACK_MISMATCH', recordPath);
  }
  return {
    contract_version: 'assesssuite-physio-deploy-ledger-append/1.0.0', result: 'PASS',
    repository, ledger_branch: DEPLOY_LEDGER_BRANCH, application_sha: applicationSha,
    ledger_record_path: recordPath, ledger_record_sha256: recordSha256,
    predecessor_commit_sha: inventory.ledger_head_sha, ledger_commit_sha: createdCommit.sha,
    ledger_readback_head_sha: readback.ledger_head_sha,
    update_response_lost_or_rejected: updateError !== null, record,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--') || index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
      fail('DEPLOY_LEDGER_ARGUMENT_INVALID', token);
    }
    const key = token.slice(2);
    if (Object.hasOwn(args, key)) fail('DEPLOY_LEDGER_ARGUMENT_DUPLICATE', key);
    args[key] = argv[index + 1];
    index += 1;
  }
  return args;
}

function writeOutput(outputPath, value) {
  fs.writeFileSync(outputPath, canonicalJson(value), { flag: 'wx', mode: 0o600 });
}

function appendGitHubOutput(outputPath, values) {
  if (!outputPath) return;
  const rows = Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join('');
  fs.appendFileSync(outputPath, rows);
}

function readJsonFileExact(filePath, maximum = MAX_RECORD_BYTES) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > maximum) {
    fail('DEPLOY_LEDGER_INPUT_INVALID', filePath);
  }
  const bytes = fs.readFileSync(filePath);
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch {
    fail('DEPLOY_LEDGER_INPUT_INVALID', filePath);
  }
  return value;
}

function exactSecretValues(names) {
  if (!names) return [];
  const unique = [...new Set(names.split(',').filter(Boolean))];
  for (const name of unique) {
    if (!/^[A-Z][A-Z0-9_]{0,79}$/u.test(name)) fail('DEPLOY_LEDGER_SECRET_ENV_INVALID', name);
  }
  return unique.map((name) => process.env[name] || '').filter(Boolean);
}

function requireProvisioningInput(inventory, value) {
  assertString(value, SHA256, 'DEPLOY_LEDGER_PROVISIONING_INPUT_INVALID',
    'provisioning receipt sha256');
  if (inventory.ledger_provisioning_receipt_sha256 !== value) {
    fail('DEPLOY_LEDGER_PROVISIONING_INPUT_MISMATCH', 'dispatch does not bind exact L5 receipt');
  }
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const [command, ...rest] = argv;
  const args = parseArgs(rest);
  if (!args.output) fail('DEPLOY_LEDGER_ARGUMENT_INVALID', '--output is required');
  if (command === 'provisioning-contract') {
    writeOutput(args.output, buildDeployLedgerProvisioningContract(args.repository));
    return;
  }
  if (command === 'provisioning-receipt') {
    const fullRuleset = readJsonFileExact(args['ruleset-readback']);
    const genesisReadback = readJsonFileExact(args['genesis-readback']);
    writeOutput(args.output, buildDeployLedgerProvisioningReceipt({ repository: args.repository,
      fullRuleset, genesisReadback, provisionedAt: args['provisioned-at'] }));
    return;
  }
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const client = options.client ?? createDeployLedgerGitHubClient({
    repository: args.repository, token, fetchImpl: options.fetchImpl,
  });
  const inventory = await inventoryDeployLedger({
    client, repository: args.repository, applicationSha: args['application-sha'],
  });
  requireProvisioningInput(inventory, args['provisioning-receipt-sha256']);
  if (command === 'inventory') {
    writeOutput(args.output, inventory);
    appendGitHubOutput(args['github-output'], {
      deploy_ledger_head_sha: inventory.ledger_head_sha,
      deploy_ledger_record_count: inventory.record_count,
      deploy_ledger_latest_record_sha256: inventory.latest_record_sha256,
      deploy_ledger_latest_record_commit_sha: inventory.latest_record_commit_sha,
      deploy_ledger_latest_artifact_id: inventory.latest_record?.artifact.id ?? 0,
      deploy_ledger_latest_artifact_digest: inventory.latest_record?.artifact.digest ?? '0',
      deploy_ledger_latest_packet_ordinal: inventory.latest_record?.packet_ordinal ?? -1,
      deploy_ledger_latest_effect_receipt_sha256: inventory.latest_record?.effect_receipt_sha256 ?? ZERO_SHA256,
      deploy_ledger_provisioning_receipt_sha256: inventory.ledger_provisioning_receipt_sha256,
    });
    return;
  }
  if (command === 'append') {
    const request = readJsonFileExact(args.request);
    const secretValues = exactSecretValues(args['secret-env-names']);
    request.resume_packet = buildDeployLedgerPacket(args['packet-directory'], secretValues);
    const result = await appendDeployLedgerRecord({
      client, repository: args.repository, applicationSha: args['application-sha'], request,
      expectedHeadSha: args['expected-head-sha'],
      expectedProvisioningReceiptSha256: args['provisioning-receipt-sha256'],
      now: options.now,
    });
    writeOutput(args.output, result);
    appendGitHubOutput(args['github-output'], {
      deploy_ledger_record_sha256: result.ledger_record_sha256,
      deploy_ledger_commit_sha: result.ledger_commit_sha,
      deploy_ledger_readback_head_sha: result.ledger_readback_head_sha,
    });
    return;
  }
  if (command === 'materialize-remote') {
    const selected = args['record-sha256']
      ? inventory.records.find((entry) => entry.sha256 === args['record-sha256'])
      : inventory.records.at(-1);
    if (!selected) fail('DEPLOY_LEDGER_RECORD_NOT_FOUND', args['record-sha256'] || 'latest');
    materializeDeployLedgerPacket(selected.record.resume_packet, args['output-directory']);
    writeOutput(args.output, {
      contract_version: 'assesssuite-physio-deploy-ledger-materialization/1.0.0', result: 'PASS',
      repository: args.repository, application_sha: args['application-sha'],
      ledger_head_sha: inventory.ledger_head_sha, record_sha256: selected.sha256,
      record_commit_sha: selected.commit_sha, packet_ordinal: selected.record.packet_ordinal,
      phase: selected.record.phase, effect_receipt_sha256: selected.record.effect_receipt_sha256,
      source_artifact: selected.record.artifact, materialized_at: new Date().toISOString(),
    });
    return;
  }
  fail('DEPLOY_LEDGER_COMMAND_INVALID', String(command));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
