// Short-lived, tenant-bound delivery URLs for native browser media elements.
// The opaque token is stored only as a hash in process memory. Durable records
// keep the bare upload URL, and the URL itself contains no user or tenant data.

import { createHash, randomBytes } from 'node:crypto';

const grants = new Map();
const MAX_ACTIVE_GRANTS = 10_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ttlSeconds() {
  const parsed = Number(process.env.FILE_ACCESS_URL_TTL_SECONDS);
  if (!Number.isFinite(parsed) || parsed < 30) return 120;
  return Math.min(Math.floor(parsed), 300);
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function removeExpired(nowMs) {
  for (const [hash, grant] of grants) {
    if (grant.expiresAtMs <= nowMs) grants.delete(hash);
  }
}

export function issueFileAccessUrl({ uploadId, orgId, userId, now = new Date() }) {
  if (!UUID_RE.test(String(uploadId || '')) || !orgId || !userId) {
    throw new TypeError('A canonical upload, organisation and user are required for file access.');
  }
  const nowMs = new Date(now).getTime();
  removeExpired(nowMs);
  while (grants.size >= MAX_ACTIVE_GRANTS) {
    grants.delete(grants.keys().next().value);
  }
  const token = randomBytes(32).toString('base64url');
  const expiresAtMs = nowMs + ttlSeconds() * 1000;
  grants.set(tokenHash(token), { uploadId, orgId, userId, expiresAtMs });
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
