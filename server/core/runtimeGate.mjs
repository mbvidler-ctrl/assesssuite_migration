import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { capabilityEnabled } from '../capabilityFlags.mjs';

export const CORE_V1_ISOLATED_DATABASE_ACK =
  'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE';

const coreDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDataDirectory = path.resolve(coreDirectory, '..', 'data');

export const CORE_V1_FORBIDDEN_DATABASE_PATHS = Object.freeze([
  path.join(serverDataDirectory, 'app.db'),
  path.join(serverDataDirectory, 'selftest.db'),
]);

export const CORE_V1_LOOPBACK_BIND_HOSTS = Object.freeze(['127.0.0.1', '::1']);
const CORE_V1_DEFAULT_ADMIN_EMAIL = 'admin@local.test';
const CORE_V1_DEFAULT_ADMIN_PASSWORD = 'change-me-local';

function canonicalExistingPath(candidate) {
  try {
    return fs.realpathSync.native(candidate);
  } catch {
    return null;
  }
}

function samePath(left, right) {
  return path.relative(left, right) === '';
}

function isStrictDescendant(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== ''
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

/**
 * Resolves an acknowledged test database to its canonical on-disk target.
 *
 * The parent must already exist so junctions/symlinks can be resolved before
 * any mkdir, deletion or SQLite open occurs. `path.relative` provides a
 * separator-aware containment check (and Windows' case-insensitive path
 * semantics) rather than the unsafe string-prefix comparison that accepts
 * siblings such as `Temp-collision`.
 */
export function resolveIsolatedTestDatabasePath(
  environment = process.env,
  override = environment.ASSESSSUITE_DB_PATH,
  { temporaryDirectory = os.tmpdir() } = {},
) {
  if (
    environment.NODE_ENV !== 'test'
    || environment.PARITY_ASSURANCE_MODE === '1'
    || environment.ASSESSSUITE_DB_PATH_ACK !== CORE_V1_ISOLATED_DATABASE_ACK
    || typeof override !== 'string'
    || override.trim() === ''
    || !path.isAbsolute(override)
  ) {
    return null;
  }

  const resolved = path.resolve(override);
  if (path.extname(resolved).toLowerCase() !== '.db') return null;

  const canonicalTemp = canonicalExistingPath(temporaryDirectory);
  const canonicalParent = canonicalExistingPath(path.dirname(resolved));
  if (!canonicalTemp || !canonicalParent) return null;

  const targetExists = fs.existsSync(resolved);
  if (targetExists) {
    try {
      const targetStat = fs.lstatSync(resolved);
      // A symlink can be swapped after canonicalisation, while a hard link can
      // make a temp-looking path mutate a persistent database inode. Core's
      // isolated store must be one ordinary file with one filesystem link.
      if (!targetStat.isFile() || targetStat.isSymbolicLink() || targetStat.nlink !== 1) return null;
    } catch {
      return null;
    }
  }
  const existingTarget = targetExists ? canonicalExistingPath(resolved) : null;
  if (targetExists && !existingTarget) return null;
  const canonicalTarget = existingTarget || path.join(canonicalParent, path.basename(resolved));

  if (!isStrictDescendant(canonicalTemp, canonicalTarget)) return null;

  for (const forbidden of CORE_V1_FORBIDDEN_DATABASE_PATHS) {
    const canonicalForbidden = canonicalExistingPath(forbidden) || path.resolve(forbidden);
    if (samePath(resolved, forbidden) || samePath(canonicalTarget, canonicalForbidden)) return null;
  }

  return canonicalTarget;
}

export function isIsolatedTestDatabasePath(
  environment = process.env,
  override = environment.ASSESSSUITE_DB_PATH,
  options,
) {
  return resolveIsolatedTestDatabasePath(environment, override, options) !== null;
}

/**
 * Core V1's first runtime is intentionally narrower than an ordinary local
 * development flag. It may mutate only an explicitly acknowledged,
 * canonical test database below the operating system's temporary directory;
 * never a production, parity, default-local or persistent store.
 */
export function isCoreV1SandboxRuntimeEnabled(environment = process.env, options) {
  const adminEmail = typeof environment.ADMIN_EMAIL === 'string'
    ? environment.ADMIN_EMAIL.trim().toLowerCase()
    : '';
  const adminPassword = typeof environment.ADMIN_PASSWORD === 'string'
    ? environment.ADMIN_PASSWORD
    : '';
  const normalizedAdminPassword = adminPassword.trim();
  return capabilityEnabled('CORE_V1_SANDBOX_ENABLED', environment)
    && CORE_V1_LOOPBACK_BIND_HOSTS.includes(environment.ASSESSSUITE_BIND_HOST)
    && adminEmail !== ''
    && adminEmail !== CORE_V1_DEFAULT_ADMIN_EMAIL
    && normalizedAdminPassword.length >= 16
    && normalizedAdminPassword !== CORE_V1_DEFAULT_ADMIN_PASSWORD
    && isIsolatedTestDatabasePath(
      environment,
      environment.ASSESSSUITE_DB_PATH,
      options,
    );
}

/**
 * An explicit enablement is a startup assertion, not a best-effort hint. A
 * mis-scoped Core flag therefore fails before any database filesystem work.
 */
export function assertCoreV1SandboxRuntime(environment = process.env, options) {
  const requested = capabilityEnabled('CORE_V1_SANDBOX_ENABLED', environment);
  if (!requested) return false;
  if (!isCoreV1SandboxRuntimeEnabled(environment, options)) {
    throw new Error(
      'Core V1 sandbox requires loopback binding, non-default bootstrap credentials, and an acknowledged absolute .db path inside the canonical temporary directory',
    );
  }
  return true;
}
