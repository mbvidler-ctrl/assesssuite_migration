import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  BROWSER_RECEIPT_KEYS,
  PARITY_ADMIN_EMAIL,
  PARITY_BASE_URL,
  PARITY_DB_PATH,
  PARITY_NAMESPACE,
  PARITY_PROVIDER_CALL_LIMIT,
  PARITY_UPLOADS_DIR,
  REVIEW_CONTROLS,
  assertParityWaveEnvironment,
  deriveParityIdentity as deriveRunnerIdentity,
  expectedArtifactHashes as expectedRunnerHashes,
  frameParityReceipt as frameBrowserReceipt,
  makeBrowserReceipt,
} from './production-parity-wave.mjs';
import {
  CLEANUP_RECEIPT_KEYS,
  CLINICAL_ENTITIES,
  OBSERVE_RECEIPT_KEYS,
  PARITY_DB_ACK,
  SEED_RECEIPT_KEYS,
  VERIFY_SEED_RECEIPT_KEYS,
  assertParityMachineEnvironment,
  cleanupNamespaceStore,
  deriveParityIdentity as deriveCleanupIdentity,
  expectedArtifactHashes as expectedCleanupHashes,
  frameParityReceipt as frameMachineReceipt,
  isMissionEntityRow,
} from './production-parity-cleanup.mjs';
import { CANONICAL_REFERRAL_PROFILE_FULL_39 } from './support/syntheticReferralFixtures.mjs';
import { openDatabase } from '../db.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const hashes = expectedRunnerHashes();

function commonEnvironment(waveId = 'wave-1') {
  return {
    NODE_ENV: 'production',
    PARITY_ASSURANCE_MODE: '1',
    PARITY_NAMESPACE,
    PARITY_WAVE_ID: waveId,
    PARITY_BASE_URL,
    PARITY_PROVIDER_CALL_LIMIT: String(PARITY_PROVIDER_CALL_LIMIT),
    PARITY_ARTIFACT_DIR: path.join(repoRoot, '.parity-contract-test-artifacts', waveId),
    ASSESSSUITE_DB_PATH: PARITY_DB_PATH,
    UPLOADS_DIR: PARITY_UPLOADS_DIR,
    OUTBOUND_EMAIL_ENABLED: '0',
    OUTBOUND_SMS_ENABLED: '0',
    PAYMENTS_ENABLED: '0',
    DOCUMENT_EXTRACTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_UNDER_13_ENABLED: '0',
    OPENAI_HEALTH_DATA_TERMS_CONFIRMED: '1',
    GENERAL_CLINICAL_LLM_ENABLED: '0',
    TRANSCRIPTION_ENABLED: '0',
    ALLOW_OPEN_REGISTRATION: '0',
    ADMIN_EMAIL: PARITY_ADMIN_EMAIL,
    LEGAL_STATUS: 'effective',
    LEGAL_EFFECTIVE_DATE: '19 July 2026',
    PARITY_RUNNER_SHA256: hashes.runner_sha256,
    PARITY_FIXTURE_SHA256: hashes.fixture_sha256,
    PARITY_CLEANUP_SHA256: hashes.cleanup_sha256,
    PARITY_CONFIG_SHA256: hashes.config_sha256,
  };
}

test('parity identity is deterministic, wave-bounded, synthetic and shared by both executors', () => {
  for (const waveId of ['wave-1', 'wave-2']) {
    const runner = deriveRunnerIdentity(waveId);
    const cleanup = deriveCleanupIdentity(waveId);
    assert.deepEqual(runner, cleanup);
    assert.match(runner.email, new RegExp(`@${PARITY_NAMESPACE.replaceAll('-', '\\-')}\\.seed\\.test$`));
    assert.equal(runner.password.length, 32);
  }
  assert.throws(() => deriveRunnerIdentity('wave-3'), /invalid_wave_id/);
});

test('browser executor accepts only the frozen exact-machine contract and verifies actual artifacts', () => {
  const accepted = assertParityWaveEnvironment(commonEnvironment());
  assert.equal(accepted.waveId, 'wave-1');
  assert.deepEqual(accepted.hashes, hashes);

  const mutations = {
    PARITY_NAMESPACE: 'asr-r2-wrong',
    PARITY_BASE_URL: 'http://127.0.0.1:8787',
    PARITY_PROVIDER_CALL_LIMIT: '2',
    ALLOW_OPEN_REGISTRATION: '1',
    ADMIN_EMAIL: 'admin@assesssuite.com',
    ASSESSSUITE_DB_PATH: '/app/server/data/app.db',
    UPLOADS_DIR: '/app/server/data/uploads',
    DOCUMENT_EXTRACTION_TEST_BASE_URL: 'http://127.0.0.1:9999',
    SELFTEST: '1',
    PARITY_RUNNER_SHA256: '0'.repeat(64),
  };
  for (const [name, value] of Object.entries(mutations)) {
    assert.throws(() => assertParityWaveEnvironment({ ...commonEnvironment(), [name]: value }), undefined, name);
  }
});

test('machine modes keep the test-only DB acknowledgement out of production observation and cleanup', () => {
  const seed = {
    ...commonEnvironment(),
    NODE_ENV: 'test',
    ASSESSSUITE_DB_PATH_ACK: PARITY_DB_ACK,
  };
  assert.equal(assertParityMachineEnvironment('seed', seed).waveId, 'wave-1');
  assert.throws(() => assertParityMachineEnvironment('seed', {
    ...seed,
    ASSESSSUITE_DB_PATH_ACK: 'wrong',
  }));
  for (const mode of ['verify-seed', 'observe-wave', 'cleanup-and-verify']) {
    assert.equal(assertParityMachineEnvironment(mode, commonEnvironment()).waveId, 'wave-1');
    assert.throws(() => assertParityMachineEnvironment(mode, {
      ...commonEnvironment(),
      ASSESSSUITE_DB_PATH_ACK: PARITY_DB_ACK,
    }));
  }
  assert.deepEqual(expectedCleanupHashes(), hashes);
  assert.throws(() => assertParityMachineEnvironment('unknown', commonEnvironment()));
});

test('browser receipt has the exact signup, referral and three-screenshot schema', () => {
  const files = [
    `${PARITY_NAMESPACE}-wave-1-signup-consent.png`,
    `${PARITY_NAMESPACE}-wave-1-referral-uploader.png`,
    `${PARITY_NAMESPACE}-wave-1-mandatory-review.png`,
  ];
  const receipt = makeBrowserReceipt({
    waveId: 'wave-1',
    hashes,
    clientRecordsCreated: 0,
    screenshots: {
      files,
      sha256: Object.fromEntries(files.map((file, index) => [file, String(index + 1).repeat(64)])),
    },
  });
  assert.deepEqual(Object.keys(receipt), BROWSER_RECEIPT_KEYS);
  assert.equal(receipt.mandatory_checkbox_count, 1);
  assert.equal(receipt.marketing_checkbox_count, 1);
  assert.equal(receipt.marketing_default_checked, false);
  assert.equal(receipt.signup_acceptance_submissions, 1);
  assert.equal(receipt.signup_acceptance_retry_requests, 1);
  assert.equal(receipt.profile_setup_post_payment_surface, true);
  assert.equal(receipt.single_practice_uploader_present, true);
  assert.equal(receipt.multi_practice_uploader_present, false);
  assert.equal(receipt.synthetic_document_count, 1);
  assert.equal(receipt.provider_call_limit, 1);
  assert.equal(receipt.referral_commit_performed, false);
  assert.deepEqual(receipt.screenshot_files, files);
  assert.equal(Object.keys(receipt.screenshot_sha256).length, 3);
  const waveTwo = makeBrowserReceipt({
    waveId: 'wave-2',
    hashes,
    clientRecordsCreated: 0,
    screenshots: { files: receipt.screenshot_files, sha256: receipt.screenshot_sha256 },
  });
  assert.equal(waveTwo.single_practice_uploader_present, false);
  assert.equal(waveTwo.multi_practice_uploader_present, true);
});

test('all 39 referral keys are bound to a specific mandatory-review control', () => {
  assert.equal(Object.keys(CANONICAL_REFERRAL_PROFILE_FULL_39).length, 39);
  assert.deepEqual(
    new Set(Object.keys(REVIEW_CONTROLS)),
    new Set(Object.keys(CANONICAL_REFERRAL_PROFILE_FULL_39)),
  );
  assert.equal(new Set(Object.values(REVIEW_CONTROLS).map(([label]) => label)).size, 39);
});

test('receipt framing is one bounded single-line JSON object between exact sentinels', () => {
  const receipt = { schema_version: 'assesssuite.production-parity.v1', result: 'PASS' };
  for (const frame of [frameBrowserReceipt(receipt), frameMachineReceipt(receipt)]) {
    const lines = frame.split('\n');
    assert.equal(lines.length, 3);
    assert.equal(lines[0], 'ASSESSSUITE_PARITY_RECEIPT_BEGIN');
    assert.deepEqual(JSON.parse(lines[1]), receipt);
    assert.equal(lines[2], 'ASSESSSUITE_PARITY_RECEIPT_END');
  }
});

test('machine receipt key sets expose bounded seed, readiness, observation and cleanup facts', () => {
  assert.equal(new Set(SEED_RECEIPT_KEYS).size, SEED_RECEIPT_KEYS.length);
  assert.equal(new Set(VERIFY_SEED_RECEIPT_KEYS).size, VERIFY_SEED_RECEIPT_KEYS.length);
  assert.equal(new Set(OBSERVE_RECEIPT_KEYS).size, OBSERVE_RECEIPT_KEYS.length);
  assert.equal(new Set(CLEANUP_RECEIPT_KEYS).size, CLEANUP_RECEIPT_KEYS.length);
  for (const key of [
    'provider_requests',
    'clinical_writes',
    'signup_profile_writes',
    'signup_acceptance_rows',
    'signup_acceptance_document_rows',
    'signup_acceptance_role',
    'duplicate_signup_acceptance_rows',
    'production_volume_path_accesses',
  ]) {
    assert.ok(OBSERVE_RECEIPT_KEYS.includes(key), key);
  }
  for (const key of [
    'remaining_namespace_rows',
    'remaining_namespace_files',
    'nonnamespace_rows_touched',
    'nonnamespace_files_touched',
    'clinical_rows_deleted',
  ]) {
    assert.ok(CLEANUP_RECEIPT_KEYS.includes(key), key);
  }
});

test('namespace classifier includes exact tags and linked identities but excludes unrelated rows', () => {
  const context = {
    emails: new Set([`practitioner.wave-1@${PARITY_NAMESPACE}.seed.test`]),
    userIds: new Set(['mission-user']),
    organizationIds: new Set(['mission-org']),
    membershipIds: new Set(['mission-membership']),
    legalReceiptIds: new Set(['mission-legal']),
  };
  assert.equal(isMissionEntityRow({
    id: 'tagged', data: JSON.stringify({ _parity_namespace: PARITY_NAMESPACE }), created_by: null,
  }, context), true);
  assert.equal(isMissionEntityRow({
    id: 'linked', data: JSON.stringify({ org_id: 'mission-org' }), created_by: null,
  }, context), true);
  assert.equal(isMissionEntityRow({
    id: 'unrelated', data: JSON.stringify({ org_id: 'preserved-org' }), created_by: 'elsewhere@example.invalid',
  }, context), false);
});

test('cleanup executes twice, removes failed-wave rows/files, and preserves nonnamespace sentinels', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-parity-cleanup-'));
  const dbPath = path.join(tempRoot, 'parity-test.db');
  const uploadsDir = path.join(tempRoot, 'uploads');
  const environmentKeys = ['NODE_ENV', 'SELFTEST', 'ASSESSSUITE_DB_PATH', 'ASSESSSUITE_DB_PATH_ACK'];
  const savedEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
  let db;
  try {
    process.env.NODE_ENV = 'test';
    delete process.env.SELFTEST;
    process.env.ASSESSSUITE_DB_PATH = dbPath;
    process.env.ASSESSSUITE_DB_PATH_ACK = PARITY_DB_ACK;
    const opened = openDatabase();
    db = opened.db;
    const entityNames = opened.entityNames;
    for (const key of environmentKeys) {
      if (savedEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnvironment[key];
    }
    fs.mkdirSync(uploadsDir);

    const now = new Date().toISOString();
    const missionUserId = 'mission-user';
    const missionOrgId = 'mission-org';
    const missionUploadId = 'mission-upload-id';
    const practitionerEmail = `practitioner.wave-1@${PARITY_NAMESPACE}.seed.test`;
    const insertEntity = (entityName, id, data, createdBy = null) => {
      db.prepare(`
        INSERT INTO entity_${entityName} (id, data, created_date, updated_date, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, JSON.stringify(data), now, now, createdBy);
    };
    insertEntity('User', missionUserId, {
      _parity_namespace: PARITY_NAMESPACE,
      email: practitionerEmail,
    }, practitionerEmail);
    insertEntity('Organization', missionOrgId, {
      _parity_namespace: PARITY_NAMESPACE,
      name: 'mission practice',
    }, practitionerEmail);
    insertEntity('OrganizationMember', 'mission-membership', {
      _parity_namespace: PARITY_NAMESPACE,
      org_id: missionOrgId,
      user_email: practitionerEmail,
      role: 'clinician',
      is_primary: true,
    }, practitionerEmail);
    insertEntity('Client', 'mission-client', {
      _parity_namespace: PARITY_NAMESPACE,
      org_id: missionOrgId,
      full_name: 'Synthetic mission client',
    }, practitionerEmail);
    insertEntity('User', 'preserved-user', { email: 'preserved@example.invalid' }, 'preserved@example.invalid');
    insertEntity('Organization', 'preserved-org', { name: 'preserved practice' }, 'preserved@example.invalid');
    insertEntity('Client', 'preserved-client', {
      org_id: 'preserved-org',
      full_name: 'Preserved sentinel client',
    }, 'preserved@example.invalid');

    db.prepare(`
      INSERT INTO upload_registry (
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, bound_at, deleted_at, bound_entity_type,
        bound_entity_id, is_legacy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 0)
    `).run(
      missionUploadId,
      'mission-upload.bin',
      'synthetic.pdf',
      missionOrgId,
      missionUserId,
      'referral-extraction',
      'application/pdf',
      7,
      '1'.repeat(64),
      'temporary',
      '13_or_over',
      now,
      now,
    );
    db.prepare(`
      INSERT INTO upload_disposition (
        upload_id, org_id, status, reason_code, planned_action,
        review_due_at, recorded_at, updated_at
      ) VALUES (?, ?, 'review-required', 'synthetic', 'delete', ?, ?, ?)
    `).run('orphan-mission-disposition', missionOrgId, now, now, now);
    db.prepare('INSERT INTO sessions (token, user_id, created_date) VALUES (?, ?, ?)')
      .run('mission-session', missionUserId, now);
    db.prepare('INSERT INTO outbox_email (id, payload, created_date) VALUES (?, ?, ?)')
      .run('mission-email', JSON.stringify({ to: 'alex.river@example.invalid' }), now);
    db.prepare('INSERT INTO outbox_email (id, payload, created_date) VALUES (?, ?, ?)')
      .run('preserved-email', JSON.stringify({ to: 'preserved@example.invalid' }), now);
    db.prepare('INSERT INTO outbox_sms (id, payload, created_date) VALUES (?, ?, ?)')
      .run('mission-sms', JSON.stringify({ to: '+61 400 000 101' }), now);
    db.prepare('INSERT INTO outbox_sms (id, payload, created_date) VALUES (?, ?, ?)')
      .run('preserved-sms', JSON.stringify({ to: '+61 400 999 999' }), now);

    db.exec(`
      CREATE TABLE parity_assurance_control (
        namespace TEXT NOT NULL,
        wave_id TEXT NOT NULL,
        control_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (namespace, wave_id)
      )
    `);
    db.prepare(`
      INSERT INTO parity_assurance_control (namespace, wave_id, control_json, created_at)
      VALUES (?, 'wave-1', ?, ?)
    `).run(PARITY_NAMESPACE, JSON.stringify({
      namespace: PARITY_NAMESPACE,
      waveId: 'wave-1',
      practitionerId: missionUserId,
      organizationIds: [missionOrgId],
      membershipIds: ['mission-membership'],
      legalReceiptIds: [],
      baseline: {
        outboundEmailIds: ['preserved-email'],
        outboundSmsIds: ['preserved-sms'],
        clinicalIds: Object.fromEntries(CLINICAL_ENTITIES.map((name) => [
          name,
          name === 'Client' ? ['preserved-client'] : [],
        ])),
      },
    }), now);

    for (const [name, content] of [
      ['mission-upload.bin', 'mission'],
      ['mission-upload.bin.registering', 'mission-registering'],
      [`${missionUploadId}.provider-block`, 'mission-block'],
      ['preserved-sentinel.bin', 'preserved'],
    ]) {
      fs.writeFileSync(path.join(uploadsDir, name), content);
    }

    const contract = {
      waveId: 'wave-1',
      identity: deriveCleanupIdentity('wave-1'),
      hashes,
    };
    const first = cleanupNamespaceStore({ db, entityNames, contract, uploadsDir });
    assert.ok(first.rowsDeleted >= 9);
    assert.equal(first.filesDeleted, 3);
    assert.equal(first.clinicalRowsDeleted, 1);
    assert.equal(first.remainingNamespaceRows, 0);
    assert.equal(first.remainingNamespaceFiles, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM entity_User WHERE id = 'preserved-user'").get().n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM entity_Client WHERE id = 'preserved-client'").get().n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox_email WHERE id = 'preserved-email'").get().n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM outbox_sms WHERE id = 'preserved-sms'").get().n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM outbox_email').get().n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM outbox_sms').get().n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM upload_registry').get().n, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM upload_disposition WHERE org_id = 'mission-org'").get().n, 0);
    assert.equal(fs.readFileSync(path.join(uploadsDir, 'preserved-sentinel.bin'), 'utf8'), 'preserved');

    const second = cleanupNamespaceStore({ db, entityNames, contract, uploadsDir });
    assert.equal(second.rowsDeleted, 0);
    assert.equal(second.filesDeleted, 0);
    assert.equal(second.remainingNamespaceRows, 0);
    assert.equal(second.remainingNamespaceFiles, 0);
  } finally {
    for (const key of environmentKeys) {
      if (savedEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnvironment[key];
    }
    db?.close();
    const resolvedTempRoot = path.resolve(tempRoot);
    const resolvedOsTemp = path.resolve(os.tmpdir());
    assert.ok(resolvedTempRoot.startsWith(`${resolvedOsTemp}${path.sep}`));
    fs.rmSync(resolvedTempRoot, { recursive: true, force: true });
  }
});

test('source contract keeps browser evidence bounded and cleanup path-exact', () => {
  const runner = fs.readFileSync(path.join(repoRoot, 'server', 'tests', 'production-parity-wave.mjs'), 'utf8');
  const cleanup = fs.readFileSync(path.join(repoRoot, 'server', 'tests', 'production-parity-cleanup.mjs'), 'utf8');
  assert.equal((runner.match(/\.screenshot\(\{/g) || []).length, 3);
  assert.doesNotMatch(runner, /tracing\.start|storageState\s*:/);
  assert.match(runner, /fullFieldReferralPdfFixture\(\)/);
  assert.match(runner, /Extract Data from 1 file\(s\)/);
  assert.match(runner, /marketing_opt_in: false/);
  assert.match(cleanup, /path\.basename\(name\) !== name/);
  assert.match(cleanup, /path\.dirname\(candidate\) !== root/);
  assert.doesNotMatch(cleanup, /rmSync\([^\n]*recursive\s*:\s*true/);
});

test('CLI failures emit only the bounded generic marker and never exception details', () => {
  for (const [relativePath, argument] of [
    ['server/tests/production-parity-wave.mjs', 'invalid-mode'],
    ['server/tests/production-parity-cleanup.mjs', 'invalid-mode'],
  ]) {
    const result = spawnSync(process.execPath, [path.join(repoRoot, relativePath), argument], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'ASSESSSUITE_PARITY_FAILED\n');
  }
});
