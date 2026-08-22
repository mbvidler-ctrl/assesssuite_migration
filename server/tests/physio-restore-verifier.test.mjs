import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { openDatabase } from '../db.mjs';
import { runCatalogueSeed } from '../seed.mjs';
import {
  capturePhysioSnapshotManifest,
  PHYSIO_FIRST_RELEASE_EMPTY_RESTORE_CONTRACT_VERSION,
  PHYSIO_RESTORE_VERIFY_CONTRACT_VERSION,
  verifyPhysioFirstReleaseEmptyRestore,
  verifyPhysioRestoredDatabase,
} from '../../scripts/physio-restore-verify.mjs';
import {
  PHYSIO_RELEASE_TARGET,
  validatePhysioPresnapshotManifestReceipt,
} from '../../scripts/physio-release-contract.mjs';

const ISOLATED_DB_ACK = 'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE';
const APPLICATION_SHA = 'a'.repeat(40);
const IMMUTABLE_IMAGE = `registry.fly.io/assesssuite-physio-production@sha256:${'b'.repeat(64)}`;
const VOLUME_ID = 'vol_1234567890abcdef';
const SNAPSHOT_ID = 'vs_restore_verifier_fixture';
const MACHINE_ID = '1a2b3c4d5e6f78';
const SNAPSHOT_SENTINEL = 'c'.repeat(64);
const PROVIDER_OFF = Object.freeze({
  LLM_REQUIRED: '0',
  GENERAL_CLINICAL_LLM_ENABLED: '0',
  TRANSCRIPTION_ENABLED: '0',
  DOCUMENT_EXTRACTION_ENABLED: '0',
  DOCUMENT_EXTRACTION_UNDER_13_ENABLED: '0',
  DOCUMENT_EXTRACTION_PROVIDER_PROBE: '0',
  OUTBOUND_EMAIL_ENABLED: '0',
  OUTBOUND_SMS_ENABLED: '0',
  PAYMENTS_ENABLED: '0',
  SELFTEST: '0',
  PARITY_ASSURANCE_MODE: '0',
  ALLOW_PAID_PROVIDER_PROBE: '0',
});

async function withEnvironment(overrides, operation) {
  const previous = new Map();
  for (const [name, value] of Object.entries(overrides)) {
    previous.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    return await operation();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

async function createProductionShapedPhysioDatabase(databasePath) {
  await withEnvironment({
    NODE_ENV: 'test',
    SELFTEST: undefined,
    PROFESSION: 'physio',
    DEFAULT_APP_ID: PHYSIO_RELEASE_TARGET.appId,
    ASSESSSUITE_DB_PATH: databasePath,
    ASSESSSUITE_DB_PATH_ACK: ISOLATED_DB_ACK,
  }, () => {
    const { db, entityNames } = openDatabase();
    try {
      runCatalogueSeed({ db, entityNames });
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } finally {
      db.close();
    }
  });
}

function capture(databasePath, environment = PROVIDER_OFF, snapshotSentinel = SNAPSHOT_SENTINEL) {
  return capturePhysioSnapshotManifest({
    databasePath,
    snapshotSentinel,
    environment,
    requireProductionPath: false,
  });
}

function verify(
  databasePath,
  environment = PROVIDER_OFF,
  expectedDataManifestSha256 = capture(databasePath, environment).data_manifest_sha256,
  snapshotSentinel = SNAPSHOT_SENTINEL,
) {
  return verifyPhysioRestoredDatabase({
    databasePath,
    applicationSha: APPLICATION_SHA,
    immutableImage: IMMUTABLE_IMAGE,
    volumeId: VOLUME_ID,
    snapshotId: SNAPSHOT_ID,
    machineId: MACHINE_ID,
    snapshotSentinel,
    expectedDataManifestSha256,
    environment,
    requireProductionPath: false,
    observedAt: new Date('2026-08-22T00:00:00.000Z'),
  });
}

test('read-only restore verifier proves integrity, complete schema, exact catalogue and sentinel', { concurrency: false }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-physio-restore-verifier-'));
  const databasePath = path.join(root, 'physio.db');
  try {
    await createProductionShapedPhysioDatabase(databasePath);
    const receipt = verify(databasePath);
    assert.equal(receipt.contract_version, PHYSIO_RESTORE_VERIFY_CONTRACT_VERSION);
    assert.equal(receipt.result, 'PASS');
    assert.equal(receipt.database_read_only, true);
    assert.equal(receipt.provider_switches_disabled, true);
    assert.equal(receipt.provider_credentials_absent, true);
    assert.equal(receipt.test_provider_settings_absent, true);
    assert.equal(receipt.sqlite_integrity, 'ok');
    assert.equal(receipt.schema_contract_version, 'assesssuite-physio-sqlite-schema/1.0.0');
    assert.equal(receipt.schema_digest, PHYSIO_RELEASE_TARGET.sqliteSchemaDigest);
    assert.equal(receipt.migration_version, PHYSIO_RELEASE_TARGET.sqliteSchemaDigest);
    assert.equal(receipt.sqlite_user_version, PHYSIO_RELEASE_TARGET.sqliteUserVersion);
    assert.equal(receipt.schema_object_count, PHYSIO_RELEASE_TARGET.sqliteSchemaObjectCount);
    assert.equal(receipt.schema_table_count, PHYSIO_RELEASE_TARGET.sqliteSchemaTableCount);
    assert.equal(receipt.data_manifest_contract_version, 'assesssuite-physio-logical-data-manifest/1.0.0');
    assert.match(receipt.data_manifest_sha256, /^sha256:[0-9a-f]{64}$/);
    assert.equal(receipt.data_manifest_table_count, PHYSIO_RELEASE_TARGET.logicalDataTableCount);
    assert.ok(receipt.data_manifest_total_row_count >= PHYSIO_RELEASE_TARGET.catalogueCount);
    assert.equal(receipt.data_manifest_tables.length, PHYSIO_RELEASE_TARGET.logicalDataTableCount);
    assert.deepEqual(
      receipt.data_manifest_tables.find((table) => table.name === 'stripe_checkout_intent'),
      {
        name: 'stripe_checkout_intent',
        row_count: 0,
        rows_sha256: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
      },
    );
    assert.match(receipt.snapshot_sentinel_sha256, /^[0-9a-f]{64}$/);
    assert.equal(receipt.catalogue_count, PHYSIO_RELEASE_TARGET.catalogueCount);
    assert.equal(receipt.catalogue_checksum, PHYSIO_RELEASE_TARGET.catalogueChecksum);
    assert.match(receipt.catalogue_sentinel.canonical_id, /^(?:assessment:|physio-)/);
    assert.match(receipt.catalogue_sentinel.data_sha256, /^[0-9a-f]{64}$/);

    const reopened = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.equal(
        reopened.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'assesssuite_restore_verifier_must_not_write'").get().count,
        0,
      );
    } finally {
      reopened.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release admission validates the real pre-snapshot manifest emitter shape exactly', { concurrency: false }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-physio-presnapshot-contract-'));
  const databasePath = path.join(root, 'physio.db');
  try {
    await createProductionShapedPhysioDatabase(databasePath);
    const receipt = capture(databasePath);
    assert.deepEqual(validatePhysioPresnapshotManifestReceipt(receipt, {
      snapshotSentinel: SNAPSHOT_SENTINEL,
    }), {
      contractVersion: 'assesssuite-physio-presnapshot-manifest/1.0.0',
      dataManifestSha256: receipt.data_manifest_sha256,
      tableCount: PHYSIO_RELEASE_TARGET.logicalDataTableCount,
      totalRowCount: receipt.data_manifest_total_row_count,
    });

    const staleAliases = structuredClone(receipt);
    staleAliases.sqlite_schema_object_count = staleAliases.schema_object_count;
    delete staleAliases.schema_object_count;
    assert.throws(
      () => validatePhysioPresnapshotManifestReceipt(staleAliases, { snapshotSentinel: SNAPSHOT_SENTINEL }),
      /key set differs/,
    );

    const prefixedTableHash = structuredClone(receipt);
    prefixedTableHash.data_manifest_tables[0].rows_sha256 = `sha256:${prefixedTableHash.data_manifest_tables[0].rows_sha256}`;
    assert.throws(
      () => validatePhysioPresnapshotManifestReceipt(prefixedTableHash, { snapshotSentinel: SNAPSHOT_SENTINEL }),
      /table 0 differs/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('restore verifier rejects catalogue drift and any provider-capable process posture', { concurrency: false }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-physio-restore-verifier-negative-'));
  const databasePath = path.join(root, 'physio.db');
  try {
    await createProductionShapedPhysioDatabase(databasePath);
    assert.throws(
      () => verify(databasePath, { ...PROVIDER_OFF, OPENAI_API_KEY: 'must-not-reach-fixture-verifier' }),
      /OPENAI_API_KEY reached the read-only verifier process/,
    );
    assert.throws(
      () => verify(databasePath, { ...PROVIDER_OFF, PAYMENTS_ENABLED: '1' }),
      /PAYMENTS_ENABLED is not explicitly disabled/,
    );
    assert.throws(
      () => verify(databasePath, { ...PROVIDER_OFF, GENERAL_CLINICAL_LLM_ENABLED: '1' }),
      /GENERAL_CLINICAL_LLM_ENABLED is not explicitly disabled/,
    );
    assert.throws(
      () => verify(databasePath, { ...PROVIDER_OFF, SELFTEST: '1' }),
      /SELFTEST is not explicitly disabled/,
    );
    assert.throws(
      () => verify(databasePath, { ...PROVIDER_OFF, OUTBOUND_SMS_ENABLED: '1' }),
      /OUTBOUND_SMS_ENABLED is not explicitly disabled/,
    );
    assert.throws(
      () => verify(databasePath, { ...PROVIDER_OFF, PARITY_ASSURANCE_MODE: '1' }),
      /PARITY_ASSURANCE_MODE is not explicitly disabled/,
    );
    assert.throws(
      () => verify(databasePath, { ...PROVIDER_OFF, OPENAI_CHAT_TEST_BASE_URL: 'http:\/\/127.0.0.1:4567' }),
      /OPENAI_CHAT_TEST_BASE_URL reached the read-only verifier process/,
    );

    const writable = new DatabaseSync(databasePath);
    try {
      const row = writable.prepare('SELECT id, data FROM entity_Assessment ORDER BY id LIMIT 1').get();
      const data = JSON.parse(row.data);
      writable.prepare('UPDATE entity_Assessment SET data = ? WHERE id = ?')
        .run(JSON.stringify({ ...data, name: `${data.name} (drift)` }), row.id);
    } finally {
      writable.close();
    }
    assert.throws(() => verify(databasePath), /integrity, schema, or catalogue is not ready/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('sentinel-bound logical manifest rejects deletion of a mutable client row', { concurrency: false }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-physio-restore-manifest-drift-'));
  const databasePath = path.join(root, 'physio.db');
  try {
    await createProductionShapedPhysioDatabase(databasePath);
    const writable = new DatabaseSync(databasePath);
    try {
      writable.prepare(`
        INSERT INTO entity_Client (id, data, created_date, updated_date, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'client_manifest_regression',
        JSON.stringify({ org_id: 'org_manifest', first_name: 'Synthetic', last_name: 'Manifest' }),
        '2026-08-22T00:00:00.000Z',
        '2026-08-22T00:00:00.000Z',
        'user_manifest',
      );
    } finally {
      writable.close();
    }
    const before = capture(databasePath);
    assert.equal(verify(databasePath, PROVIDER_OFF, before.data_manifest_sha256).result, 'PASS');

    const afterDelete = new DatabaseSync(databasePath);
    try {
      afterDelete.prepare('DELETE FROM entity_Client WHERE id = ?').run('client_manifest_regression');
    } finally {
      afterDelete.close();
    }
    assert.throws(
      () => verify(databasePath, PROVIDER_OFF, before.data_manifest_sha256),
      /restored logical data manifest differs from the quiesced pre-snapshot manifest/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('exact observed schema rejects extra objects columns and user_version drift', { concurrency: false }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-physio-restore-schema-drift-'));
  try {
    for (const [name, mutate] of [
      ['extra-table', (db) => db.exec('CREATE TABLE unexpected_restore_schema (id TEXT PRIMARY KEY);')],
      ['extra-column', (db) => db.exec('ALTER TABLE entity_Client ADD COLUMN unexpected_restore_column TEXT;')],
      ['user-version', (db) => db.exec('PRAGMA user_version = 999;')],
    ]) {
      const databasePath = path.join(root, `${name}.db`);
      await createProductionShapedPhysioDatabase(databasePath);
      const writable = new DatabaseSync(databasePath);
      try { mutate(writable); } finally { writable.close(); }
      assert.throws(
        () => capture(databasePath),
        /observed SQLite schema differs from the exact pinned release schema/,
        name,
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('first-release recovery accepts only the application-empty snapshot clone', { concurrency: false }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-physio-empty-restore-'));
  try {
    fs.mkdirSync(path.join(root, 'lost+found'));
    const receipt = verifyPhysioFirstReleaseEmptyRestore({
      dataDirectory: root,
      applicationSha: APPLICATION_SHA,
      immutableImage: IMMUTABLE_IMAGE,
      volumeId: VOLUME_ID,
      snapshotId: SNAPSHOT_ID,
      machineId: MACHINE_ID,
      environment: PROVIDER_OFF,
      requireProductionPath: false,
      observedAt: new Date('2026-08-22T00:00:00.000Z'),
    });
    assert.equal(receipt.contract_version, PHYSIO_FIRST_RELEASE_EMPTY_RESTORE_CONTRACT_VERSION);
    assert.equal(receipt.result, 'PASS');
    assert.equal(receipt.application_database_absent, true);
    assert.equal(receipt.application_uploads_absent, true);
    assert.equal(receipt.unexpected_data_absent, true);
    assert.equal(receipt.provider_switches_disabled, true);
    assert.match(receipt.verifier_machine_id_sha256, /^[0-9a-f]{64}$/);

    fs.writeFileSync(path.join(root, 'physio.db'), 'candidate residue');
    assert.throws(
      () => verifyPhysioFirstReleaseEmptyRestore({
        dataDirectory: root,
        applicationSha: APPLICATION_SHA,
        immutableImage: IMMUTABLE_IMAGE,
        volumeId: VOLUME_ID,
        snapshotId: SNAPSHOT_ID,
        machineId: MACHINE_ID,
        environment: PROVIDER_OFF,
        requireProductionPath: false,
      }),
      /contains application or unexpected data|retained application data/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
