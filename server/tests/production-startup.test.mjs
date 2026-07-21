import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  isDatabaseOverrideAllowed,
  openDatabase,
  PARITY_ASSURANCE_DB_PATH,
} from '../db.mjs';
import {
  PARITY_ASSURANCE_UPLOADS_DIR,
  runProductionBootstrap,
} from '../productionBootstrap.mjs';
import { runCatalogueSeed, runSeed } from '../seed.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

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
  assert.equal(
    flyConfig.split(/\r?\n/).filter((line) =>
      line === '  app = "node server/productionBootstrap.mjs && exec node server/index.mjs"').length,
    1,
    'the Fly process override must preserve the catalogue bootstrap',
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
    environment: { NODE_ENV: 'production' },
    openDatabaseFn: () => {
      calls.push('open');
      return { db, entityNames: new Set(['Assessment']) };
    },
    catalogueSeedFn: (opened) => {
      assert.equal(opened.db, db);
      calls.push('catalogue');
    },
  });
  assert.deepEqual(calls, ['open', 'catalogue', 'close']);

  assert.throws(
    () => runProductionBootstrap({
      environment: { NODE_ENV: 'production', SELFTEST: '1' },
      openDatabaseFn: () => { throw new Error('database was opened'); },
    }),
    /SELFTEST is forbidden/,
  );
  assert.throws(
    () => runProductionBootstrap({ environment: { NODE_ENV: 'test' } }),
    /requires NODE_ENV=production/,
  );
});

test('production parity assurance requires the exact no-egress and isolation posture before database access', () => {
  const safeParityEnvironment = {
    NODE_ENV: 'production',
    PARITY_ASSURANCE_MODE: '1',
    OUTBOUND_EMAIL_ENABLED: '0',
    OUTBOUND_SMS_ENABLED: '0',
    PAYMENTS_ENABLED: '0',
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
      return { db: { close: () => successCalls.push('close') }, entityNames: new Set() };
    },
    catalogueSeedFn: () => successCalls.push('catalogue'),
  });
  assert.deepEqual(successCalls, ['open', 'catalogue', 'close']);

  const invalidValues = {
    OUTBOUND_EMAIL_ENABLED: '1',
    OUTBOUND_SMS_ENABLED: '1',
    PAYMENTS_ENABLED: '1',
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
      environment: { NODE_ENV: 'production', PARITY_ASSURANCE_MODE: 'true' },
      openDatabaseFn: () => { throw new Error('database was opened'); },
    }),
    /PARITY_ASSURANCE_MODE must be exactly 0 or 1/,
  );
});

test('database override policy permits only the existing test harness or exact production parity database', () => {
  const testPath = 'C:/synthetic/isolated-gate.db';
  assert.equal(isDatabaseOverrideAllowed({
    NODE_ENV: 'test',
    ASSESSSUITE_DB_PATH_ACK: 'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE',
  }, testPath), true);
  assert.equal(isDatabaseOverrideAllowed({ NODE_ENV: 'test' }, testPath), false);

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
