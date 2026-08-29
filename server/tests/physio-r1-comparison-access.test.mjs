import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { hashPassword } from '../auth.mjs';
import { createEntityRepository, openDatabase } from '../db.mjs';
import {
  inspectPhysioR1ComparisonAccess,
  provisionPhysioR1ComparisonAccess,
} from '../../scripts/provision-physio-r1-comparison-access.mjs';

const MAXWELL = 'mb.vidler@gmail.com';
const BRENTON = 'brenton@primehealthclinics.com';

function withEnvironment(databasePath) {
  return {
    ...process.env,
    NODE_ENV: 'production',
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    ASSESSSUITE_DEPLOYMENT_VARIANT: 'physio-r1-comparison',
    ALLOW_OPEN_REGISTRATION: '0',
    PAYMENTS_ENABLED: '0',
    EXPECTED_APP_URL: 'https://assesssuite-physio-r1.fly.dev',
    ASSESSSUITE_DB_PATH: databasePath,
  };
}

test('R1 comparison gives Maxwell and Brenton full restricted access without changing Maxwell credentials', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-r1-access-'));
  const databasePath = path.join(directory, 'physio.db');
  const prior = { ...process.env };
  const environment = withEnvironment(databasePath);
  Object.assign(process.env, environment, {
    NODE_ENV: 'test',
    ASSESSSUITE_DB_PATH_ACK: 'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE',
  });
  try {
    const originalPassword = hashPassword('Existing-Maxwell-Password-1!');
    let opened = openDatabase();
    createEntityRepository(opened.db, 'User').create({
      email: MAXWELL,
      email_verified: true,
      account_status: 'pending',
      role: 'user',
      ...originalPassword,
    }, MAXWELL);
    opened.db.close();

    let deliveries = 0;
    const applied = await provisionPhysioR1ComparisonAccess({
      maxwellEmail: MAXWELL,
      brentonEmail: BRENTON,
      apply: true,
      environment,
      deliver: async ({ to, text }) => {
        deliveries += 1;
        assert.equal(to, BRENTON);
        assert.match(text, /assesssuite-physio-r1\.fly\.dev\/reset-password\?token=/);
        return { sent: true, providerId: 'email_synthetic_r1' };
      },
    });
    assert.equal(applied.brenton_activation_email, 'sent');
    assert.equal(deliveries, 1);

    opened = openDatabase();
    const users = createEntityRepository(opened.db, 'User').listAll();
    const maxwell = users.find((user) => user.email === MAXWELL);
    const brenton = users.find((user) => user.email === BRENTON);
    assert.equal(maxwell.password_hash, originalPassword.password_hash);
    assert.equal(maxwell.salt, originalPassword.salt);
    assert.equal(maxwell.account_status, 'active');
    assert.equal(maxwell.role, 'admin');
    assert.equal(brenton.account_status, 'active');
    assert.equal(brenton.role, 'admin');
    assert.equal(brenton.email_verified, false);
    assert.match(brenton.reset_token, /^[0-9a-f-]{36}$/i);
    opened.db.close();

    const inspection = inspectPhysioR1ComparisonAccess({
      maxwellEmail: MAXWELL,
      brentonEmail: BRENTON,
      environment,
    });
    assert.equal(inspection.all_access_paths_ready, true);
    assert.deepEqual(inspection.targets.map((target) => target.access_state), ['active', 'activation-email-sent']);
    assert.doesNotMatch(JSON.stringify(inspection), /reset_token|password_hash|salt|email_synthetic_r1/i);

    await provisionPhysioR1ComparisonAccess({
      maxwellEmail: MAXWELL,
      brentonEmail: BRENTON,
      apply: true,
      environment,
      deliver: async () => {
        deliveries += 1;
        return { sent: true, providerId: 'should_not_send' };
      },
    });
    assert.equal(deliveries, 1, 'a still-valid delivered activation must be idempotent');
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in prior)) delete process.env[key];
    }
    Object.assign(process.env, prior);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('R1 comparison access provisioning fails closed outside the isolated non-billing target', async () => {
  await assert.rejects(
    provisionPhysioR1ComparisonAccess({
      maxwellEmail: MAXWELL,
      brentonEmail: BRENTON,
      apply: false,
      environment: {
        NODE_ENV: 'production',
        PROFESSION: 'physio',
        DEFAULT_APP_ID: 'local-assesssuite-physio',
        ASSESSSUITE_DEPLOYMENT_VARIANT: 'physio-r1-comparison',
        ALLOW_OPEN_REGISTRATION: '1',
        PAYMENTS_ENABLED: '0',
        EXPECTED_APP_URL: 'https://assesssuite-physio-r1.fly.dev',
      },
    }),
    /ALLOW_OPEN_REGISTRATION=0/,
  );
});
