import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

const KEY_ENV_NAME = 'ASSESSSUITE_INTEGRATION_ENCRYPTION_KEY';
const ENVELOPE_VERSION = 'v1';

export class IntegrationCredentialKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IntegrationCredentialKeyError';
    this.code = 'integration_credential_key_unavailable';
  }
}

function decodeKey(environment = process.env) {
  const encoded = String(environment[KEY_ENV_NAME] || '').trim();
  if (!encoded) {
    throw new IntegrationCredentialKeyError(`${KEY_ENV_NAME} is not configured`);
  }
  let key;
  try {
    key = Buffer.from(encoded, 'base64');
  } catch {
    throw new IntegrationCredentialKeyError(`${KEY_ENV_NAME} is not valid base64`);
  }
  if (key.length !== 32 || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
    throw new IntegrationCredentialKeyError(`${KEY_ENV_NAME} must encode exactly 32 bytes`);
  }
  return key;
}

function associatedData({ orgId, providerId }) {
  const org = String(orgId || '').trim();
  const provider = String(providerId || '').trim();
  if (!org || !provider) throw new TypeError('Integration credential scope is incomplete');
  return Buffer.from(`assesssuite:integration:${org}:${provider}:${ENVELOPE_VERSION}`, 'utf8');
}

export function integrationCredentialKeyConfigured(environment = process.env) {
  try {
    decodeKey(environment);
    return true;
  } catch {
    return false;
  }
}

export function sealIntegrationCredentials(credentials, scope, { environment = process.env } = {}) {
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    throw new TypeError('Integration credentials must be an object');
  }
  const key = decodeKey(environment);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(associatedData(scope));
  const plaintext = Buffer.from(JSON.stringify(credentials), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENVELOPE_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function openIntegrationCredentials(envelope, scope, { environment = process.env } = {}) {
  const parts = String(envelope || '').split('.');
  if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) {
    const error = new Error('Integration credential envelope is invalid');
    error.code = 'integration_credential_envelope_invalid';
    throw error;
  }
  const key = decodeKey(environment);
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const ciphertext = Buffer.from(parts[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) throw new Error('invalid envelope');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(associatedData(scope));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plaintext);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid payload');
    return parsed;
  } catch (cause) {
    const error = new Error('Integration credentials could not be decrypted');
    error.code = 'integration_credentials_unreadable';
    error.cause = cause;
    throw error;
  }
}

export const INTEGRATION_CREDENTIAL_KEY_ENV = KEY_ENV_NAME;
