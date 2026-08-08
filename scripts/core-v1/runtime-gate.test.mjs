import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertCoreV1SandboxRuntime,
  CORE_V1_FORBIDDEN_DATABASE_PATHS,
  CORE_V1_ISOLATED_DATABASE_ACK,
  isCoreV1SandboxRuntimeEnabled,
  isIsolatedTestDatabasePath,
  resolveIsolatedTestDatabasePath,
} from '../../server/core/runtimeGate.mjs';

function isolatedFixture(prefix = 'assesssuite-core-v1-runtime-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbPath = path.join(root, 'synthetic.db');
  const environment = {
    NODE_ENV: 'test',
    PARITY_ASSURANCE_MODE: '0',
    ASSESSSUITE_DB_PATH: dbPath,
    ASSESSSUITE_DB_PATH_ACK: CORE_V1_ISOLATED_DATABASE_ACK,
    ASSESSSUITE_BIND_HOST: '127.0.0.1',
    ADMIN_EMAIL: 'core-v1-admin@isolated.test',
    ADMIN_PASSWORD: 'Synthetic-Core-V1-Password-1!',
    CORE_V1_SANDBOX_ENABLED: '1',
  };
  return {
    root,
    dbPath,
    environment,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

test('Core V1 sandbox requires every canonical isolated-test gate', () => {
  const fixture = isolatedFixture();
  try {
    assert.equal(isCoreV1SandboxRuntimeEnabled(fixture.environment), true);
    assert.equal(
      resolveIsolatedTestDatabasePath(fixture.environment),
      path.join(fs.realpathSync.native(fixture.root), 'synthetic.db'),
    );

    for (const field of [
      'NODE_ENV',
      'ASSESSSUITE_DB_PATH',
      'ASSESSSUITE_DB_PATH_ACK',
      'ASSESSSUITE_BIND_HOST',
      'ADMIN_EMAIL',
      'ADMIN_PASSWORD',
      'CORE_V1_SANDBOX_ENABLED',
    ]) {
      const environment = { ...fixture.environment };
      delete environment[field];
      assert.equal(isCoreV1SandboxRuntimeEnabled(environment), false, field);
    }

    assert.equal(isCoreV1SandboxRuntimeEnabled({
      ...fixture.environment,
      ASSESSSUITE_DB_PATH: path.join(fixture.root, 'not-a-database.sqlite'),
    }), false);
    assert.equal(isCoreV1SandboxRuntimeEnabled({
      ...fixture.environment,
      ASSESSSUITE_DB_PATH: 'relative.db',
    }), false);
  } finally {
    fixture.cleanup();
  }
});

test('Core V1 rejects public binding and default or weak bootstrap credentials', () => {
  const fixture = isolatedFixture();
  try {
    for (const [field, invalid] of [
      ['ASSESSSUITE_BIND_HOST', '0.0.0.0'],
      ['ASSESSSUITE_BIND_HOST', 'localhost'],
      ['ADMIN_EMAIL', 'admin@local.test'],
      ['ADMIN_EMAIL', '  ADMIN@LOCAL.TEST  '],
      ['ADMIN_PASSWORD', 'change-me-local'],
      ['ADMIN_PASSWORD', '  change-me-local  '],
      ['ADMIN_PASSWORD', '                '],
      ['ADMIN_PASSWORD', 'short'],
    ]) {
      assert.equal(
        isCoreV1SandboxRuntimeEnabled({ ...fixture.environment, [field]: invalid }),
        false,
        `${field}=${invalid}`,
      );
    }
    assert.equal(isCoreV1SandboxRuntimeEnabled({
      ...fixture.environment,
      ASSESSSUITE_BIND_HOST: '::1',
    }), true);
  } finally {
    fixture.cleanup();
  }
});

test('production and parity cannot expose Core V1 even when the flag is set', () => {
  const fixture = isolatedFixture();
  try {
    assert.equal(isCoreV1SandboxRuntimeEnabled({
      ...fixture.environment,
      NODE_ENV: 'production',
    }), false);
    assert.equal(isCoreV1SandboxRuntimeEnabled({
      ...fixture.environment,
      PARITY_ASSURANCE_MODE: '1',
    }), false);
    assert.throws(
      () => assertCoreV1SandboxRuntime({
        ...fixture.environment,
        NODE_ENV: 'production',
      }),
      /canonical temporary directory/,
    );
  } finally {
    fixture.cleanup();
  }
});

test('default, persistent and temporary-prefix-collision paths never qualify', () => {
  const base = {
    NODE_ENV: 'test',
    PARITY_ASSURANCE_MODE: '0',
    ASSESSSUITE_DB_PATH_ACK: CORE_V1_ISOLATED_DATABASE_ACK,
    ASSESSSUITE_BIND_HOST: '127.0.0.1',
    ADMIN_EMAIL: 'core-v1-admin@isolated.test',
    ADMIN_PASSWORD: 'Synthetic-Core-V1-Password-1!',
    CORE_V1_SANDBOX_ENABLED: '1',
  };

  for (const dbPath of CORE_V1_FORBIDDEN_DATABASE_PATHS) {
    assert.equal(isIsolatedTestDatabasePath({ ...base, ASSESSSUITE_DB_PATH: dbPath }), false);
  }

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-core-v1-prefix-proof-'));
  const canonicalTemp = path.join(fixtureRoot, 'Temp');
  const collisionRoot = path.join(fixtureRoot, 'Temp-collision');
  fs.mkdirSync(canonicalTemp, { recursive: true });
  fs.mkdirSync(collisionRoot, { recursive: true });
  try {
    const collisionPath = path.join(collisionRoot, 'synthetic.db');
    assert.equal(
      isIsolatedTestDatabasePath(
        { ...base, ASSESSSUITE_DB_PATH: collisionPath },
        collisionPath,
        { temporaryDirectory: canonicalTemp },
      ),
      false,
      'a sibling sharing the temporary-directory text prefix is not contained by it',
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('a temp-path hard link to a persistent file never qualifies', (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-core-v1-hardlink-proof-'));
  const canonicalTemp = path.join(fixtureRoot, 'Temp');
  const persistentRoot = path.join(fixtureRoot, 'persistent-source');
  fs.mkdirSync(canonicalTemp, { recursive: true });
  fs.mkdirSync(persistentRoot, { recursive: true });
  const dbPath = path.join(canonicalTemp, 'synthetic.db');
  const environment = {
    NODE_ENV: 'test',
    PARITY_ASSURANCE_MODE: '0',
    ASSESSSUITE_DB_PATH: dbPath,
    ASSESSSUITE_DB_PATH_ACK: CORE_V1_ISOLATED_DATABASE_ACK,
    ASSESSSUITE_BIND_HOST: '127.0.0.1',
    ADMIN_EMAIL: 'core-v1-admin@isolated.test',
    ADMIN_PASSWORD: 'Synthetic-Core-V1-Password-1!',
    CORE_V1_SANDBOX_ENABLED: '1',
  };
  const persistentFile = path.join(persistentRoot, 'persistent.db');
  fs.writeFileSync(persistentFile, 'PERSISTENT_SENTINEL');
  try {
    try {
      fs.linkSync(persistentFile, dbPath);
    } catch (error) {
      t.skip(`filesystem does not permit the hard-link proof: ${error.code || 'link_failed'}`);
      return;
    }
    assert.equal(fs.statSync(dbPath).nlink > 1, true);
    assert.equal(
      isCoreV1SandboxRuntimeEnabled(environment, { temporaryDirectory: canonicalTemp }),
      false,
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('SELFTEST does not imply Core V1 sandbox enablement', () => {
  const fixture = isolatedFixture();
  try {
    assert.equal(isCoreV1SandboxRuntimeEnabled({
      ...fixture.environment,
      SELFTEST: '1',
      CORE_V1_SANDBOX_ENABLED: '0',
    }), false);
  } finally {
    fixture.cleanup();
  }
});
