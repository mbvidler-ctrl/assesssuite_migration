import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_APP_DB_PATH,
  isDatabaseOverrideAllowed,
  openDatabase,
  PARITY_ASSURANCE_DB_PATH,
} from '../db.mjs';
import { CORE_V1_ISOLATED_DATABASE_ACK } from '../core/runtimeGate.mjs';
import {
  PARITY_ASSURANCE_UPLOADS_DIR,
  PRODUCTION_APP_URL,
  runProductionBootstrap,
} from '../productionBootstrap.mjs';
import { runCatalogueSeed, runSeed } from '../seed.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const productionAppEnvironment = Object.freeze({
  NODE_ENV: 'production',
  EXPECTED_APP_URL: PRODUCTION_APP_URL,
  APP_URL: PRODUCTION_APP_URL,
});

function restoreEnvironment(previous) {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

test('production container starts only the explicit catalogue bootstrap', () => {
  const dockerfile = fs.readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
  assert.match(dockerfile, /VITE_BASE44_APP_ID=local-assesssuite/);
  const appParams = fs.readFileSync(path.join(repoRoot, 'src', 'lib', 'app-params.js'), 'utf8');
  assert.match(appParams, /VITE_BASE44_APP_ID \|\| "local-assesssuite"/);
  const flyConfig = fs.readFileSync(path.join(repoRoot, 'fly.production.toml'), 'utf8');
  assert.match(
    dockerfile,
    /CMD \["sh", "-c", "node server\/productionBootstrap\.mjs && exec node server\/index\.mjs"\]/,
  );
  assert.doesNotMatch(dockerfile, /CMD[^\n]*node server\/seed\.mjs/);
  assert.doesNotMatch(
    flyConfig,
    /^\s*\[\s*(?:processes|"processes"|'processes')\s*\]\s*(?:#.*)?$/m,
    'Fly must inherit the shell-safe image CMD instead of tokenizing a process override',
  );
  assert.doesNotMatch(flyConfig, /^\s*app\s*=\s*"node server\/index\.mjs"\s*$/m);
});

test('full synthetic seeding refuses production before touching a database', () => {
  const previous = { NODE_ENV: process.env.NODE_ENV };
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(
      () => runSeed({
        db: new Proxy({}, { get: () => { throw new Error('database was touched'); } }),
        entityNames: new Set(),
      }),
      /full synthetic seed is disabled in production/i,
    );
  } finally {
    restoreEnvironment(previous);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-production-seed-refusal-'));
  const untouchedDbPath = path.join(tempDir, 'must-not-exist.db');
  try {
    const result = spawnSync(process.execPath, ['server/seed.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ASSESSSUITE_DB_PATH: untouchedDbPath,
      },
    });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(`${result.stdout}\n${result.stderr}`, /full synthetic seed is disabled in production/i);
    assert.equal(fs.existsSync(untouchedDbPath), false, 'the refused command must not open or create a database');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('production bootstrap is fail-closed and invokes only the catalogue seeder', () => {
  const calls = [];
  const db = { close: () => calls.push('close') };
  runProductionBootstrap({
    environment: { ...productionAppEnvironment },
    openDatabaseFn: ({ environment }) => {
      assert.deepEqual(environment, productionAppEnvironment);
      calls.push('open');
      return {
        db,
        entityNames: new Set(['Assessment']),
        coreV1SandboxEnabled: false,
        coreV1Schema: null,
        coreV1SchemaPresent: false,
      };
    },
    catalogueSeedFn: (opened) => {
      assert.equal(opened.db, db);
      calls.push('catalogue');
    },
  });
  assert.deepEqual(calls, ['open', 'catalogue', 'close']);

  assert.throws(
    () => runProductionBootstrap({
      environment: { ...productionAppEnvironment, SELFTEST: '1' },
      openDatabaseFn: () => { throw new Error('database was opened'); },
    }),
    /SELFTEST is forbidden/,
  );
  assert.throws(
    () => runProductionBootstrap({ environment: { NODE_ENV: 'test' } }),
    /requires NODE_ENV=production/,
  );
});

test('production bootstrap requires explicit proof of a Core-schema-neutral open', () => {
  for (const [label, posture] of [
    ['enabled', {
      coreV1SandboxEnabled: true,
      coreV1Schema: null,
      coreV1SchemaPresent: false,
    }],
    ['schema-present', {
      coreV1SandboxEnabled: false,
      coreV1Schema: null,
      coreV1SchemaPresent: true,
    }],
    ['unproved', {}],
  ]) {
    const calls = [];
    assert.throws(
      () => runProductionBootstrap({
        environment: { ...productionAppEnvironment },
        openDatabaseFn: () => ({
          db: { close: () => calls.push('close') },
          entityNames: new Set(),
          ...posture,
        }),
        catalogueSeedFn: () => calls.push('catalogue'),
      }),
      /Core-schema-neutral/,
      label,
    );
    assert.deepEqual(calls, ['close'], `${label} must close without catalogue writes`);
  }
});

test('production parity assurance requires the exact no-egress and isolation posture before database access', () => {
  const safeParityEnvironment = {
    ...productionAppEnvironment,
    PARITY_ASSURANCE_MODE: '1',
    OUTBOUND_EMAIL_ENABLED: '0',
    OUTBOUND_SMS_ENABLED: '0',
    PAYMENTS_ENABLED: '0',
    CORE_V1_SANDBOX_ENABLED: '0',
    DOCUMENT_EXTRACTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_UNDER_13_ENABLED: '0',
    GENERAL_CLINICAL_LLM_ENABLED: '0',
    TRANSCRIPTION_ENABLED: '0',
    ASSESSSUITE_DB_PATH: PARITY_ASSURANCE_DB_PATH,
    UPLOADS_DIR: PARITY_ASSURANCE_UPLOADS_DIR,
    // Same-app parity may inherit these secrets; the switches above remain
    // the authority boundary.
    RESEND_API_KEY: 'synthetic-inherited-resend-secret',
    STRIPE_SECRET_KEY: 'sk_test_synthetic_inherited_secret',
  };

  const successCalls = [];
  runProductionBootstrap({
    environment: safeParityEnvironment,
    openDatabaseFn: () => {
      successCalls.push('open');
      return {
        db: { close: () => successCalls.push('close') },
        entityNames: new Set(),
        coreV1SandboxEnabled: false,
        coreV1Schema: null,
        coreV1SchemaPresent: false,
      };
    },
    catalogueSeedFn: () => successCalls.push('catalogue'),
  });
  assert.deepEqual(successCalls, ['open', 'catalogue', 'close']);

  const invalidValues = {
    OUTBOUND_EMAIL_ENABLED: '1',
    OUTBOUND_SMS_ENABLED: '1',
    PAYMENTS_ENABLED: '1',
    CORE_V1_SANDBOX_ENABLED: '1',
    DOCUMENT_EXTRACTION_ENABLED: '0',
    DOCUMENT_EXTRACTION_UNDER_13_ENABLED: '1',
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    TRANSCRIPTION_ENABLED: '1',
    ASSESSSUITE_DB_PATH: '/app/server/data/app.db',
    UPLOADS_DIR: '/app/server/data/uploads',
  };
  for (const [name, invalid] of Object.entries(invalidValues)) {
    let databaseOpened = false;
    assert.throws(
      () => runProductionBootstrap({
        environment: { ...safeParityEnvironment, [name]: invalid },
        openDatabaseFn: () => {
          databaseOpened = true;
          throw new Error('database was opened');
        },
      }),
      (error) => error instanceof Error && error.message.includes(`requires ${name}=`),
      name,
    );
    assert.equal(databaseOpened, false, `${name} must fail before database access`);
  }

  assert.throws(
    () => runProductionBootstrap({
      environment: { ...productionAppEnvironment, PARITY_ASSURANCE_MODE: 'true' },
      openDatabaseFn: () => { throw new Error('database was opened'); },
    }),
    /PARITY_ASSURANCE_MODE must be exactly 0 or 1/,
  );
});

test('production bootstrap refuses an unproved or stale application origin before database access', () => {
  for (const environment of [
    { NODE_ENV: 'production', APP_URL: PRODUCTION_APP_URL },
    { NODE_ENV: 'production', EXPECTED_APP_URL: PRODUCTION_APP_URL },
    { ...productionAppEnvironment, APP_URL: 'https://assesssuite.com' },
    { ...productionAppEnvironment, EXPECTED_APP_URL: 'https://assesssuite.com' },
  ]) {
    let databaseOpened = false;
    assert.throws(
      () => runProductionBootstrap({
        environment,
        openDatabaseFn: () => {
          databaseOpened = true;
          throw new Error('database was opened');
        },
      }),
      /EXPECTED_APP_URL|APP_URL/,
    );
    assert.equal(databaseOpened, false);
  }
});

test('database override policy permits only the existing test harness or exact production parity database', () => {
  const isolatedTestRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-db-override-'));
  const testPath = path.join(isolatedTestRoot, 'isolated-gate.db');
  try {
    assert.equal(isDatabaseOverrideAllowed({
      NODE_ENV: 'test',
      ASSESSSUITE_DB_PATH_ACK: CORE_V1_ISOLATED_DATABASE_ACK,
    }, testPath), true);
    assert.equal(isDatabaseOverrideAllowed({ NODE_ENV: 'test' }, testPath), false);
  } finally {
    fs.rmSync(isolatedTestRoot, { recursive: true, force: true });
  }

  assert.equal(isDatabaseOverrideAllowed({
    NODE_ENV: 'production',
    PARITY_ASSURANCE_MODE: '1',
  }, PARITY_ASSURANCE_DB_PATH), true);
  assert.equal(isDatabaseOverrideAllowed({
    NODE_ENV: 'production',
    PARITY_ASSURANCE_MODE: '1',
  }, '/app/server/data/other.db'), false);
  assert.equal(isDatabaseOverrideAllowed({
    NODE_ENV: 'production',
  }, PARITY_ASSURANCE_DB_PATH), false);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-production-db-refusal-'));
  const refusedPath = path.join(tempDir, 'must-not-exist.db');
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    PARITY_ASSURANCE_MODE: process.env.PARITY_ASSURANCE_MODE,
    ASSESSSUITE_DB_PATH: process.env.ASSESSSUITE_DB_PATH,
    ASSESSSUITE_DB_PATH_ACK: process.env.ASSESSSUITE_DB_PATH_ACK,
  };
  try {
    process.env.NODE_ENV = 'production';
    process.env.PARITY_ASSURANCE_MODE = '1';
    process.env.ASSESSSUITE_DB_PATH = refusedPath;
    delete process.env.ASSESSSUITE_DB_PATH_ACK;
    assert.throws(() => openDatabase(), /exact production parity path/);
    assert.equal(fs.existsSync(refusedPath), false, 'refused override must not create a database');
  } finally {
    restoreEnvironment(previous);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('direct production database startup cannot combine SELFTEST with the parity store', () => {
  assert.throws(
    () => openDatabase({
      environment: {
        NODE_ENV: 'production',
        SELFTEST: '1',
        PARITY_ASSURANCE_MODE: '1',
        ASSESSSUITE_DB_PATH: PARITY_ASSURANCE_DB_PATH,
      },
    }),
    /SELFTEST is forbidden when NODE_ENV=production/,
  );
});

test('ordinary default and production database opens never install Core schema', () => {
  for (const [label, environment] of [
    ['test-default', { NODE_ENV: 'test', CORE_V1_SANDBOX_ENABLED: '0' }],
    ['production-default', { NODE_ENV: 'production', CORE_V1_SANDBOX_ENABLED: '0' }],
  ]) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `assesssuite-${label}-`));
    let db;
    try {
      const opened = openDatabase({ environment, dataDirectory: tempDir });
      db = opened.db;
      assert.equal(opened.coreV1SandboxEnabled, false);
      assert.equal(opened.coreV1Schema, null);
      assert.equal(opened.coreV1SchemaPresent, false);
      const coreObjects = db.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE name GLOB 'core_*'
        ORDER BY name
      `).all();
      assert.deepEqual(coreObjects, [], `${label} must remain Core-schema neutral`);
    } finally {
      if (db) db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('production bootstrap refuses a database carrying a pre-existing Core schema', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-stale-core-schema-'));
  const dbPath = path.join(tempDir, 'app.db');
  let sandboxDb;
  try {
    const sandbox = openDatabase({
      environment: {
        NODE_ENV: 'test',
        ASSESSSUITE_DB_PATH: dbPath,
        ASSESSSUITE_DB_PATH_ACK: CORE_V1_ISOLATED_DATABASE_ACK,
        ASSESSSUITE_BIND_HOST: '127.0.0.1',
        ADMIN_EMAIL: 'stale-core-admin@isolated.test',
        ADMIN_PASSWORD: 'Synthetic-Stale-Core-Password-1!',
        CORE_V1_SANDBOX_ENABLED: '1',
      },
    });
    sandboxDb = sandbox.db;
    assert.equal(sandbox.coreV1SchemaPresent, true);
    sandboxDb.close();
    sandboxDb = null;

    let catalogueCalled = false;
    assert.throws(
      () => runProductionBootstrap({
        environment: { ...productionAppEnvironment, CORE_V1_SANDBOX_ENABLED: '0' },
        openDatabaseFn: ({ environment }) => openDatabase({ environment, dataDirectory: tempDir }),
        catalogueSeedFn: () => { catalogueCalled = true; },
      }),
      /Core-schema-neutral/,
    );
    assert.equal(catalogueCalled, false);
  } finally {
    if (sandboxDb) sandboxDb.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('SELFTEST cannot delete a default or temporary-prefix-collision database', () => {
  const beforeDefault = fs.existsSync(DEFAULT_APP_DB_PATH)
    ? (() => {
        const stat = fs.statSync(DEFAULT_APP_DB_PATH);
        return { exists: true, size: stat.size, mtimeMs: stat.mtimeMs };
      })()
    : { exists: false };

  const baseEnvironment = {
    NODE_ENV: 'test',
    SELFTEST: '1',
    ASSESSSUITE_DB_PATH_ACK: CORE_V1_ISOLATED_DATABASE_ACK,
    CORE_V1_SANDBOX_ENABLED: '1',
  };
  assert.throws(
    () => openDatabase({
      environment: { ...baseEnvironment, ASSESSSUITE_DB_PATH: DEFAULT_APP_DB_PATH },
    }),
    /canonical temporary test directory/,
  );
  const afterDefault = fs.existsSync(DEFAULT_APP_DB_PATH)
    ? (() => {
        const stat = fs.statSync(DEFAULT_APP_DB_PATH);
        return { exists: true, size: stat.size, mtimeMs: stat.mtimeMs };
      })()
    : { exists: false };
  assert.deepEqual(afterDefault, beforeDefault, 'the default app database must be untouched');

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-prefix-collision-db-'));
  const canonicalTemp = path.join(fixtureRoot, 'Temp');
  const collisionRoot = path.join(fixtureRoot, 'Temp-collision');
  fs.mkdirSync(canonicalTemp, { recursive: true });
  fs.mkdirSync(collisionRoot, { recursive: true });
  const collisionDb = path.join(collisionRoot, 'must-survive.db');
  const sentinel = Buffer.from('NOT_A_DATABASE_MUST_SURVIVE');
  fs.writeFileSync(collisionDb, sentinel);
  try {
    assert.throws(
      () => openDatabase({
        environment: { ...baseEnvironment, ASSESSSUITE_DB_PATH: collisionDb },
        temporaryDirectory: canonicalTemp,
      }),
      /canonical temporary directory/,
    );
    assert.deepEqual(fs.readFileSync(collisionDb), sentinel);
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('catalogue bootstrap is idempotent and never creates tenant, account, receipt or clinical rows', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-production-bootstrap-'));
  const dbPath = path.join(tempDir, 'catalogue.db');
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    SELFTEST: process.env.SELFTEST,
    ASSESSSUITE_DB_PATH: process.env.ASSESSSUITE_DB_PATH,
    ASSESSSUITE_DB_PATH_ACK: process.env.ASSESSSUITE_DB_PATH_ACK,
  };
  process.env.NODE_ENV = 'test';
  delete process.env.SELFTEST;
  process.env.ASSESSSUITE_DB_PATH = dbPath;
  process.env.ASSESSSUITE_DB_PATH_ACK =
    'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE';

  let db;
  try {
    const opened = openDatabase();
    db = opened.db;
    runCatalogueSeed(opened);
    const firstCounts = Object.fromEntries(
      ['Assessment', 'Exercise', 'TreatmentProtocol'].map((entityName) => [
        entityName,
        Number(db.prepare(`SELECT COUNT(*) AS count FROM entity_${entityName}`).get().count),
      ]),
    );
    assert.ok(firstCounts.Assessment > 0);
    assert.ok(firstCounts.Exercise > 0);

    runCatalogueSeed(opened);
    const secondCounts = Object.fromEntries(
      Object.keys(firstCounts).map((entityName) => [
        entityName,
        Number(db.prepare(`SELECT COUNT(*) AS count FROM entity_${entityName}`).get().count),
      ]),
    );
    assert.deepEqual(secondCounts, firstCounts);

    // Heal a legacy interrupted seed: any-row must not be mistaken for a
    // complete catalogue.
    const missingAssessment = db.prepare('SELECT id FROM entity_Assessment ORDER BY created_date LIMIT 1').get();
    db.prepare('DELETE FROM entity_Assessment WHERE id = ?').run(missingAssessment.id);
    assert.equal(
      Number(db.prepare('SELECT COUNT(*) AS count FROM entity_Assessment').get().count),
      firstCounts.Assessment - 1,
    );
    runCatalogueSeed(opened);
    assert.equal(
      Number(db.prepare('SELECT COUNT(*) AS count FROM entity_Assessment').get().count),
      firstCounts.Assessment,
    );

    for (const entityName of [
      'Organization',
      'OrganizationMember',
      'User',
      'LegalAcceptanceEvent',
      'Client',
      'ClientDocument',
    ]) {
      const count = Number(db.prepare(`SELECT COUNT(*) AS count FROM entity_${entityName}`).get().count);
      assert.equal(count, 0, `${entityName} must remain empty`);
    }
  } finally {
    if (db) db.close();
    restoreEnvironment(previous);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
