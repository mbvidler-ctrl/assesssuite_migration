// Password hashing, session tokens, and auth endpoint handlers for the shim.

import { scryptSync, randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';

const SCRYPT_KEYLEN = 64;

/**
 * Hashes a plaintext password with a fresh per-user salt.
 * Returns { password_hash, salt } — both hex strings, stored inside the
 * User entity's JSON data blob (never returned to clients).
 */
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return { password_hash: hash, salt };
}

/**
 * Verifies a plaintext password against a stored hash + salt using a
 * timing-safe comparison.
 */
export function verifyPassword(password, passwordHash, salt) {
  if (!passwordHash || !salt) return false;
  const candidate = scryptSync(password, salt, SCRYPT_KEYLEN);
  const stored = Buffer.from(passwordHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

/**
 * Parses the Authorization header, returning the bearer token or null.
 */
export function parseBearerToken(req) {
  const header = req.headers['authorization'];
  if (!header || Array.isArray(header)) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Strips authentication-internal fields (password_hash, salt, and any OTP /
 * reset-token bookkeeping) from a User record before it is ever returned to
 * a client.
 */
export function stripAuthFields(userRecord) {
  if (!userRecord) return userRecord;
  const {
    password_hash,
    salt,
    otp_code,
    otp_expires,
    reset_token,
    reset_token_expires,
    ...safe
  } = userRecord;
  return safe;
}

/**
 * Generates a mock 6-digit OTP alongside the fixed acceptance code the
 * contract mandates ("000000" always verifies).
 */
export function generateOtp() {
  return String(randomUUID().replace(/\D/g, '').padEnd(6, '0')).slice(0, 6);
}

/**
 * Fields that updateMe must never be permitted to change, per the
 * authorisation model in the contract.
 */
export const UPDATE_ME_GUARDED_FIELDS = new Set([
  'role',
  'email',
  'id',
  'created_date',
  // Approval state is an admin decision (AdminApprovals) — self-service
  // activation via updateMe (ProfileSetup previously set 'active') is refused.
  'account_status',
  'email_verified',
]);

/**
 * Strips guarded fields from an updateMe payload.
 */
export function sanitizeUpdateMePayload(payload) {
  const sanitized = { ...payload };
  for (const field of UPDATE_ME_GUARDED_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}
