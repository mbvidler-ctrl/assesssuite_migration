import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import {
  assertSandboxBootstrapEnvironment,
  runSandboxBootstrap,
} from '../sandboxBootstrap.mjs';
import { assertSyntheticSeedEnvironment, PRODUCTION_FLY_APP_NAME, SANDBOX_SEED_MANIFEST } from '../seed.mjs';
import { runProvenanceGate } from '../../scripts/sandbox-data-provenance-gate.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

const SANDBOX_ENVIRONMENT = {
  SANDBOX_MODE: '1',
  FLY_APP_NAME: 'unimatter-demo',
  NODE_ENV: 'production',
  ALLOW_OPEN_REGISTRATION: '0',
  OUTBOUND_EMAIL_ENABLED: '0',
  OUTBOUND_SMS_ENABLED: '0',
  PAYMENTS_ENABLED: '0',
};

function restoreEnvironment(previous) {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

test('sandbox bootstrap guards fail closed before any database access', () => {
  assertSandboxBootstrapEnvironment(SANDBOX_ENVIRONMENT);

  const refusals = [
    [{ ...SANDBOX_ENVIRONMENT, SANDBOX_MODE: undefined }, /requires SANDBOX_MODE=1/],
    [{ ...SANDBOX_ENVIRONMENT, SANDBOX_MODE: '0' }, /requires SANDBOX_MODE=1/],
    [{ ...SANDBOX_ENVIRONMENT, FLY_APP_NAME: PRODUCTION_FLY_APP_NAME }, /never run on the production app/],
    [{ ...SANDBOX_ENVIRONMENT, PARITY_ASSURANCE_MODE: '1' }, /mutually exclusive/],
    [{ ...SANDBOX_ENVIRONMENT, SELFTEST: '1' }, /SELFTEST is forbidden/],
    [{ ...SANDBOX_ENVIRONMENT, ASSESSSUITE_DB_PATH: '/data/anything.db' }, /ASSESSSUITE_DB_PATH is forbidden/],
    [{ ...SANDBOX_ENVIRONMENT, OUTBOUND_EMAIL_ENABLED: '1' }, /OUTBOUND_EMAIL_ENABLED/],
    [{ ...SANDBOX_ENVIRONMENT, OUTBOUND_SMS_ENABLED: '1' }, /OUTBOUND_SMS_ENABLED/],
    [{ ...SANDBOX_ENVIRONMENT, PAYMENTS_ENABLED: '1' }, /PAYMENTS_ENABLED/],
    [{ ...SANDBOX_ENVIRONMENT, ALLOW_OPEN_REGISTRATION: '1' }, /ALLOW_OPEN_REGISTRATION=0/],
  ];
  for (const [environment, pattern] of refusals) {
    let touched = false;
    assert.throws(
      () => runSandboxBootstrap({
        environment,
        openDatabaseFn: () => { touched = true; throw new Error('database was opened'); },
        wipeFn: () => { touched = true; throw new Error('database was wiped'); },
      }),
      pattern,
    );
    assert.equal(touched, false, 'refusal must occur before any database file is touched');
  }
});

test('synthetic seed sandbox exception admits only the exact sandbox posture', () => {
  // The plain production posture still refuses.
  assert.throws(
    () => assertSyntheticSeedEnvironment({ NODE_ENV: 'production' }),
    /disabled in production/,
  );
  // The sandbox posture is admitted.
  assertSyntheticSeedEnvironment({
    NODE_ENV: 'production',
    SANDBOX_MODE: '1',
    FLY_APP_NAME: 'unimatter-demo',
  });
  // Each single deviation from the sandbox posture refuses again.
  const refusals = [
    { NODE_ENV: 'production', SANDBOX_MODE: '1', FLY_APP_NAME: PRODUCTION_FLY_APP_NAME },
    { NODE_ENV: 'production', SANDBOX_MODE: '1', ASSESSSUITE_DB_PATH: '/data/production.db' },
    { NODE_ENV: 'production', SANDBOX_MODE: '1', PARITY_ASSURANCE_MODE: '1' },
    { NODE_ENV: 'production', SANDBOX_MODE: 'true' },
  ];
  for (const environment of refusals) {
    assert.throws(() => assertSyntheticSeedEnvironment(environment), /disabled in production/);
  }
});

test('sandbox fly config boots the sandbox lane; production fly config never does', () => {
  const sandboxConfig = fs.readFileSync(path.join(repoRoot, 'fly.toml'), 'utf8');
  assert.match(
    sandboxConfig,
    /^\s*app = "node server\/sandboxBootstrap\.mjs && exec node server\/index\.mjs"\s*$/m,
  );
  assert.match(sandboxConfig, /^\s*SANDBOX_MODE = "1"\s*$/m);
  for (const gate of ['OUTBOUND_EMAIL_ENABLED', 'OUTBOUND_SMS_ENABLED', 'PAYMENTS_ENABLED']) {
    assert.match(sandboxConfig, new RegExp(`^\\s*${gate} = "0"\\s*$`, 'm'), gate);
  }
  assert.match(sandboxConfig, /^\s*ALLOW_OPEN_REGISTRATION = "0"\s*$/m);

  const productionConfig = fs.readFileSync(path.join(repoRoot, 'fly.production.toml'), 'utf8');
  assert.doesNotMatch(productionConfig, /sandboxBootstrap/);
  assert.doesNotMatch(productionConfig, /SANDBOX_MODE/);
});

test('sandbox bootstrap wipes, reseeds every entity, and passes the provenance gate', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-sandbox-bootstrap-'));
  const dbPath = path.join(tempDir, 'sandbox.db');
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    SELFTEST: process.env.SELFTEST,
    SANDBOX_MODE: process.env.SANDBOX_MODE,
    FLY_APP_NAME: process.env.FLY_APP_NAME,
    ASSESSSUITE_DB_PATH: process.env.ASSESSSUITE_DB_PATH,
    ASSESSSUITE_DB_PATH_ACK: process.env.ASSESSSUITE_DB_PATH_ACK,
    ALLOW_OPEN_REGISTRATION: process.env.ALLOW_OPEN_REGISTRATION,
  };
  process.env.NODE_ENV = 'test';
  delete process.env.SELFTEST;
  process.env.SANDBOX_MODE = '1';
  process.env.FLY_APP_NAME = 'unimatter-demo';
  process.env.ASSESSSUITE_DB_PATH = dbPath;
  process.env.ASSESSSUITE_DB_PATH_ACK =
    'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE';
  process.env.ALLOW_OPEN_REGISTRATION = '0';

  try {
    runSandboxBootstrap();

    const seededEntities = [
      'Organization', 'OrganizationMember', 'User', 'LegalAcceptanceEvent',
      'Client', 'ClientCondition', 'Appointment', 'Payment', 'ClientAssessment',
      'SOAPNote', 'ClientReport', 'SavedReport', 'ClientOnboardingEpisode',
      'ClientDocument', 'ClientNutritionPlan', 'AdverseEvent', 'AssessmentRequest',
      'ClinicPolicy', 'Assessment', 'Exercise', 'TreatmentProtocol',
    ];
    const readCounts = () => {
      const db = new DatabaseSync(dbPath, { readOnly: true });
      try {
        return Object.fromEntries(seededEntities.map((entityName) => [
          entityName,
          Number(db.prepare(`SELECT COUNT(*) AS count FROM entity_${entityName}`).get().count),
        ]));
      } finally {
        db.close();
      }
    };

    const firstCounts = readCounts();
    for (const [entityName, count] of Object.entries(firstCounts)) {
      assert.ok(count > 0, `${entityName} must be seeded (got ${count})`);
    }

    const report = runProvenanceGate({ dbPath });
    assert.deepEqual(report.violations, []);
    assert.ok(report.checkedRecords > 0);

    // A second boot must wipe and converge on the same synthetic baseline.
    runSandboxBootstrap();
    assert.deepEqual(readCounts(), firstCounts);
  } finally {
    restoreEnvironment(previous);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('the provenance gate detects a planted non-synthetic record', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-sandbox-gate-'));
  const dbPath = path.join(tempDir, 'sandbox.db');
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    SELFTEST: process.env.SELFTEST,
    SANDBOX_MODE: process.env.SANDBOX_MODE,
    FLY_APP_NAME: process.env.FLY_APP_NAME,
    ASSESSSUITE_DB_PATH: process.env.ASSESSSUITE_DB_PATH,
    ASSESSSUITE_DB_PATH_ACK: process.env.ASSESSSUITE_DB_PATH_ACK,
  };
  process.env.NODE_ENV = 'test';
  delete process.env.SELFTEST;
  process.env.SANDBOX_MODE = '1';
  process.env.FLY_APP_NAME = 'unimatter-demo';
  process.env.ASSESSSUITE_DB_PATH = dbPath;
  process.env.ASSESSSUITE_DB_PATH_ACK =
    'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE';

  try {
    runSandboxBootstrap();

    const db = new DatabaseSync(dbPath);
    try {
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO entity_User (id, data, created_date, updated_date, created_by) VALUES (?, ?, ?, ?, ?)',
      ).run(
        'planted-user',
        JSON.stringify({ email: 'real.person@gmail.com', full_name: 'Real Person', role: 'user' }),
        now,
        now,
        null,
      );
      db.prepare(
        'INSERT INTO entity_Client (id, data, created_date, updated_date, created_by) VALUES (?, ?, ?, ?, ?)',
      ).run(
        'planted-client',
        JSON.stringify({ full_name: 'Real Patient', email: 'patient@outlook.com', org_id: 'foreign-org' }),
        now,
        now,
        null,
      );
    } finally {
      db.close();
    }

    const report = runProvenanceGate({ dbPath });
    assert.ok(
      report.violations.some((v) => v.includes('real.person@gmail.com')),
      `planted user must be reported: ${JSON.stringify(report.violations)}`,
    );
    assert.ok(
      report.violations.some((v) => v.includes('planted-client')),
      'planted client must be reported',
    );
    assert.ok(
      SANDBOX_SEED_MANIFEST.userEmails.every((email) =>
        !report.violations.some((v) => v.includes(`"${email}"`))),
      'manifest users must not be reported',
    );
  } finally {
    restoreEnvironment(previous);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
