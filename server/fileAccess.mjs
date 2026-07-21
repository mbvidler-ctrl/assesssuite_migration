// Short-lived, tenant-bound delivery URLs for native browser media elements.
// The opaque token is stored only as a hash in process memory. Durable records
// keep the bare upload URL, and the URL itself contains no user or tenant data.

import { createHash, randomBytes } from 'node:crypto';

const grants = new Map();
const grantHashesByUser = new Map();
const MAX_ACTIVE_GRANTS = 10_000;
const MAX_ACTIVE_GRANTS_PER_USER = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class FileAccessGrantCapacityError extends Error {
  constructor() {
    super('File access grant capacity is exhausted.');
    this.name = 'FileAccessGrantCapacityError';
    this.httpStatus = 503;
    this.code = 'file_access_capacity_exhausted';
    this.publicMessage = 'Temporary file access is currently unavailable.';
  }
}

function ttlSeconds() {
  const parsed = Number(process.env.FILE_ACCESS_URL_TTL_SECONDS);
  if (!Number.isFinite(parsed) || parsed < 30) return 120;
  return Math.min(Math.floor(parsed), 300);
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function removeGrant(hash, grant = grants.get(hash)) {
  if (!grant || !grants.delete(hash)) return false;
  const userHashes = grantHashesByUser.get(grant.userId);
  if (userHashes) {
    userHashes.delete(hash);
    if (userHashes.size === 0) grantHashesByUser.delete(grant.userId);
  }
  return true;
}

function removeExpired(nowMs) {
  for (const [hash, grant] of grants) {
    if (grant.expiresAtMs <= nowMs) removeGrant(hash, grant);
  }
}

function makeRoomForUser(userId) {
  let userHashes = grantHashesByUser.get(userId);
  while (userHashes?.size >= MAX_ACTIVE_GRANTS_PER_USER) {
    removeGrant(userHashes.keys().next().value);
    userHashes = grantHashesByUser.get(userId);
  }
}

export function issueFileAccessUrl({ uploadId, orgId, userId, now = new Date() }) {
  if (!UUID_RE.test(String(uploadId || '')) || !orgId || !userId) {
    throw new TypeError('A canonical upload, organisation and user are required for file access.');
  }
  const nowMs = new Date(now).getTime();
  removeExpired(nowMs);
  makeRoomForUser(userId);
  if (grants.size >= MAX_ACTIVE_GRANTS) throw new FileAccessGrantCapacityError();
  const token = randomBytes(32).toString('base64url');
  const hash = tokenHash(token);
  const expiresAtMs = nowMs + ttlSeconds() * 1000;
  grants.set(hash, { uploadId, orgId, userId, expiresAtMs });
  let userHashes = grantHashesByUser.get(userId);
  if (!userHashes) {
    userHashes = new Set();
    grantHashesByUser.set(userId, userHashes);
  }
  userHashes.add(hash);
  return {
    fileUrl: `/api/files/${encodeURIComponent(uploadId)}?access_token=${encodeURIComponent(token)}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}
export function verifyFileAccessToken(token, { uploadId, now = new Date() }) {
  if (typeof token !== 'string' || token.length < 40 || token.length > 100) return null;
  const nowMs = new Date(now).getTime();
  removeExpired(nowMs);
  const grant = grants.get(tokenHash(token));
  if (!grant || grant.uploadId !== uploadId || grant.expiresAtMs <= nowMs) return null;
  return {
    uploadId: grant.uploadId,
    orgId: grant.orgId,
    userId: grant.userId,
    expiresAt: new Date(grant.expiresAtMs).toISOString(),
  };
}
