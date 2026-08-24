import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { loadEntityNames } from '../server/db.mjs';
import {
  buildRuntimeDatabaseExpectation,
  inspectRuntimeDatabase,
} from '../server/runtimeStatus.mjs';
import { buildRuntimeAssessmentCatalogue } from '../server/runtimeCatalogue.mjs';
import {
  buildPhysioLogicalDataManifest,
  inspectPhysioSqliteSchema,
  PHYSIO_DATA_MANIFEST_CONTRACT_VERSION,
  PHYSIO_RELEASE_TARGET,
  PHYSIO_RESTORE_PROVIDER_OFF_ENV,
  PHYSIO_SQLITE_SCHEMA_CONTRACT_VERSION,
} from './physio-release-contract.mjs';

export const PHYSIO_RESTORE_VERIFY_CONTRACT_VERSION =
  'assesssuite-physio-restore-verification/2.0.0';
export const PHYSIO_SNAPSHOT_MANIFEST_CONTRACT_VERSION =
  'assesssuite-physio-presnapshot-manifest/1.0.0';
export const PHYSIO_FIRST_RELEASE_EMPTY_RESTORE_CONTRACT_VERSION =
  'assesssuite-physio-first-release-empty-restore/1.0.0';
export const PHYSIO_RESTORE_DATABASE_PATH = '/app/server/data/physio.db';
export const PHYSIO_RESTORE_DATA_DIRECTORY = '/app/server/data';

const SHA_RE = /^[0-9a-f]{40}$/;
const IMAGE_RE = /^registry\.fly\.io\/assesssuite-physio-production@sha256:[0-9a-f]{64}$/;
const VOLUME_RE = /^vol_[A-Za-z0-9]+$/;
const SNAPSHOT_RE = /^[A-Za-z0-9_-]{6,160}$/;
const MACHINE_RE = /^[0-9a-f]{14,32}$/i;
const PROVIDER_SWITCHES = Object.freeze(Object.keys(PHYSIO_RESTORE_PROVIDER_OFF_ENV));
const PROVIDER_CREDENTIALS = Object.freeze([
  'ADMIN_PASSWORD',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'SENTRY_DSN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_MONTHLY',
  'STRIPE_PRICE_ID_ANNUAL',
]);
const TEST_PROVIDER_SETTINGS = Object.freeze([
  'OPENAI_CHAT_TEST_BASE_URL',
  'OPENAI_CHAT_TEST_TIMEOUT_MS',
  'DOCUMENT_EXTRACTION_TEST_BASE_URL',
  'DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK',
  'RUN_DOCUMENT_EXTRACTION_PROVIDER_PROBE',
  'RUN_PHYSIO_EXACT_IMAGE_CANARY',
]);

function fail(message) {
  throw new Error(`Physio restore verification failed: ${message}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertIdentity({ applicationSha, immutableImage, volumeId, snapshotId, machineId }) {
  if (!SHA_RE.test(applicationSha || '')) fail('application SHA differs');
  if (!IMAGE_RE.test(immutableImage || '')) fail('immutable image differs');
  if (!VOLUME_RE.test(volumeId || '')) fail('restored volume ID differs');
  if (!SNAPSHOT_RE.test(snapshotId || '')) fail('source snapshot ID differs');
  if (!MACHINE_RE.test(machineId || '')) fail('verifier machine ID differs');
}

function assertIsolatedProviderPosture(environment) {
  for (const name of PROVIDER_SWITCHES) {
    if (environment[name] !== '0') fail(`${name} is not explicitly disabled`);
  }
  for (const name of PROVIDER_CREDENTIALS) {
    if (environment[name] !== undefined && environment[name] !== '') {
      fail(`${name} reached the read-only verifier process`);
    }
  }
  for (const name of TEST_PROVIDER_SETTINGS) {
    if (environment[name] !== undefined && environment[name] !== '') {
      fail(`${name} reached the read-only verifier process`);
    }
  }
}

function assertDatabasePath(databasePath, requireProductionPath) {
  if (!path.isAbsolute(databasePath || '') || path.extname(databasePath).toLowerCase() !== '.db') {
    fail('database path is not an absolute .db path');
  }
  if (requireProductionPath && path.normalize(databasePath) !== path.normalize(PHYSIO_RESTORE_DATABASE_PATH)) {
    fail('database path differs from the isolated Physio mount');
  }
  const stat = fs.lstatSync(databasePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) fail('database is not a non-empty regular file');
}

function assertExactObservedSchema(schema) {
  if (schema.contract_version !== PHYSIO_SQLITE_SCHEMA_CONTRACT_VERSION ||
      schema.schema_digest !== PHYSIO_RELEASE_TARGET.sqliteSchemaDigest ||
      schema.sqlite_user_version !== PHYSIO_RELEASE_TARGET.sqliteUserVersion ||
      schema.object_count !== PHYSIO_RELEASE_TARGET.sqliteSchemaObjectCount ||
      schema.table_count !== PHYSIO_RELEASE_TARGET.sqliteSchemaTableCount) {
    fail('observed SQLite schema differs from the exact pinned release schema');
  }
}

function openReadOnlyDatabase(databasePath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  db.exec('PRAGMA query_only = ON;');
  return db;
}

function assertIntegrity(db) {
  const rows = db.prepare('PRAGMA quick_check').all();
  if (rows.length === 0 || rows.some((row) => Object.values(row)[0] !== 'ok')) {
    fail('restored SQLite integrity differs');
  }
}

export function capturePhysioSnapshotManifest({
  databasePath,
  snapshotSentinel,
  environment = process.env,
  requireProductionPath = true,
}) {
  assertIsolatedProviderPosture(environment);
  assertDatabasePath(databasePath, requireProductionPath);
  const db = openReadOnlyDatabase(databasePath);
  try {
    assertIntegrity(db);
    const schema = inspectPhysioSqliteSchema(db);
    assertExactObservedSchema(schema);
    const manifest = buildPhysioLogicalDataManifest(db, { snapshotSentinel });
    if (manifest.table_count !== PHYSIO_RELEASE_TARGET.logicalDataTableCount) {
      fail('logical data manifest table set differs');
    }
    return Object.freeze({
      contract_version: PHYSIO_SNAPSHOT_MANIFEST_CONTRACT_VERSION,
      result: 'PASS',
      application: PHYSIO_RELEASE_TARGET.app,
      database_path_sha256: sha256(PHYSIO_RESTORE_DATABASE_PATH),
      schema_contract_version: schema.contract_version,
      schema_digest: schema.schema_digest,
      schema_object_count: schema.object_count,
      schema_table_count: schema.table_count,
      sqlite_user_version: schema.sqlite_user_version,
      data_manifest_contract_version: manifest.contract_version,
      data_manifest_sha256: manifest.manifest_sha256,
      data_manifest_table_count: manifest.table_count,
      data_manifest_total_row_count: manifest.total_row_count,
      data_manifest_tables: manifest.tables,
      snapshot_sentinel_sha256: manifest.snapshot_sentinel_sha256,
      database_read_only: true,
      provider_switches_disabled: true,
      provider_credentials_absent: true,
      test_provider_settings_absent: true,
    });
  } finally {
    db.close();
  }
}

function parseCatalogueSentinel(db) {
  const rows = db.prepare('SELECT data FROM entity_Assessment').all();
  const candidates = rows.map(({ data }) => {
    const parsed = JSON.parse(data);
    return {
      canonicalId: parsed?.canonical_id,
      data,
    };
  }).filter(({ canonicalId }) => typeof canonicalId === 'string' && canonicalId.trim() !== '');
  candidates.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
  if (candidates.length !== PHYSIO_RELEASE_TARGET.catalogueCount) {
    fail('canonical catalogue sentinel set differs');
  }
  const sentinel = candidates[0];
  return Object.freeze({
    canonical_id: sentinel.canonicalId,
    data_sha256: sha256(sentinel.data),
  });
}

export function verifyPhysioRestoredDatabase({
  databasePath,
  applicationSha,
  immutableImage,
  volumeId,
  snapshotId,
  machineId,
  snapshotSentinel,
  expectedDataManifestSha256,
  environment = process.env,
  requireProductionPath = true,
  observedAt = new Date(),
}) {
  assertIdentity({ applicationSha, immutableImage, volumeId, snapshotId, machineId });
  assertIsolatedProviderPosture(environment);
  assertDatabasePath(databasePath, requireProductionPath);
  if (!/^sha256:[0-9a-f]{64}$/.test(expectedDataManifestSha256 || '')) {
    fail('expected logical data manifest hash differs');
  }
  const timestamp = observedAt instanceof Date ? observedAt : new Date(observedAt);
  if (!Number.isFinite(timestamp.getTime())) fail('verification timestamp is invalid');

  const expectedCatalogue = buildRuntimeAssessmentCatalogue({
    PROFESSION: 'physio',
    DEFAULT_APP_ID: PHYSIO_RELEASE_TARGET.appId,
  });
  const entityNames = new Set(loadEntityNames());
  const expectation = buildRuntimeDatabaseExpectation(entityNames, expectedCatalogue);
  const db = openReadOnlyDatabase(databasePath);
  try {
    assertIntegrity(db);
    const observedSchema = inspectPhysioSqliteSchema(db);
    assertExactObservedSchema(observedSchema);
    const dataManifest = buildPhysioLogicalDataManifest(db, { snapshotSentinel });
    if (dataManifest.table_count !== PHYSIO_RELEASE_TARGET.logicalDataTableCount ||
        dataManifest.manifest_sha256 !== expectedDataManifestSha256) {
      fail('restored logical data manifest differs from the quiesced pre-snapshot manifest');
    }
    const database = inspectRuntimeDatabase({ db, entityNames, expectedCatalogue, expectation });
    if (!database.ready || database.integrity !== 'ok' || !database.schema.ready || !database.catalogue.ready) {
      fail('restored database integrity, schema, or catalogue is not ready');
    }
    if (
      database.catalogue.count !== PHYSIO_RELEASE_TARGET.catalogueCount
      || database.catalogue.checksum !== PHYSIO_RELEASE_TARGET.catalogueChecksum
      || database.catalogue.expected_checksum !== PHYSIO_RELEASE_TARGET.catalogueChecksum
    ) fail('restored catalogue fingerprint differs');
    let writeRejected = false;
    try {
      db.exec('CREATE TABLE assesssuite_restore_verifier_must_not_write (id TEXT);');
    } catch {
      writeRejected = true;
    }
    if (!writeRejected) fail('read-only database unexpectedly accepted a write');

    return Object.freeze({
      contract_version: PHYSIO_RESTORE_VERIFY_CONTRACT_VERSION,
      result: 'PASS',
      application: PHYSIO_RELEASE_TARGET.app,
      application_sha: applicationSha,
      immutable_image: immutableImage,
      source_snapshot_id: snapshotId,
      restored_volume_id: volumeId,
      verifier_machine_id_sha256: sha256(machineId),
      database_path_sha256: sha256(PHYSIO_RESTORE_DATABASE_PATH),
      database_read_only: true,
      provider_switches_disabled: true,
      provider_credentials_absent: true,
      test_provider_settings_absent: true,
      sqlite_integrity: database.integrity,
      schema_contract_version: observedSchema.contract_version,
      schema_version: observedSchema.contract_version,
      migration_version: observedSchema.schema_digest,
      schema_digest: observedSchema.schema_digest,
      schema_object_count: observedSchema.object_count,
      schema_table_count: observedSchema.table_count,
      sqlite_user_version: observedSchema.sqlite_user_version,
      data_manifest_contract_version: PHYSIO_DATA_MANIFEST_CONTRACT_VERSION,
      data_manifest_sha256: dataManifest.manifest_sha256,
      data_manifest_table_count: dataManifest.table_count,
      data_manifest_total_row_count: dataManifest.total_row_count,
      data_manifest_tables: dataManifest.tables,
      snapshot_sentinel_sha256: dataManifest.snapshot_sentinel_sha256,
      catalogue_count: database.catalogue.count,
      catalogue_checksum: database.catalogue.checksum,
      catalogue_sentinel: parseCatalogueSentinel(db),
      verified_at: timestamp.toISOString(),
    });
  } finally {
    db.close();
  }
}

/**
 * A failed first release must return to the exact pre-bootstrap data state,
 * not merely stop the service while retaining the candidate's migrated data.
 * The initial Fly volume is application-empty; ext4 may expose one empty
 * lost+found directory. No names or file content are emitted in the receipt.
 */
export function verifyPhysioFirstReleaseEmptyRestore({
  dataDirectory,
  applicationSha,
  immutableImage,
  volumeId,
  snapshotId,
  machineId,
  environment = process.env,
  requireProductionPath = true,
  observedAt = new Date(),
}) {
  assertIdentity({ applicationSha, immutableImage, volumeId, snapshotId, machineId });
  assertIsolatedProviderPosture(environment);
  if (!path.isAbsolute(dataDirectory || '') ||
      (requireProductionPath && path.normalize(dataDirectory) !== path.normalize(PHYSIO_RESTORE_DATA_DIRECTORY))) {
    fail('first-release recovery data directory differs');
  }
  const root = fs.lstatSync(dataDirectory);
  if (!root.isDirectory() || root.isSymbolicLink()) fail('first-release recovery root is not an exact directory');
  const entries = fs.readdirSync(dataDirectory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name !== 'lost+found' || !entry.isDirectory() || entry.isSymbolicLink()) {
      fail('first-release recovery contains application or unexpected data');
    }
    if (fs.readdirSync(path.join(dataDirectory, entry.name)).length !== 0) {
      fail('first-release recovery filesystem recovery directory is not empty');
    }
  }
  for (const relative of [
    'physio.db', 'physio.db-wal', 'physio.db-shm', 'physio.db-journal', 'physio-uploads',
  ]) {
    if (fs.existsSync(path.join(dataDirectory, relative))) {
      fail('first-release recovery retained application data');
    }
  }
  const timestamp = observedAt instanceof Date ? observedAt : new Date(observedAt);
  if (!Number.isFinite(timestamp.getTime())) fail('first-release recovery timestamp is invalid');
  return Object.freeze({
    contract_version: PHYSIO_FIRST_RELEASE_EMPTY_RESTORE_CONTRACT_VERSION,
    result: 'PASS',
    application: PHYSIO_RELEASE_TARGET.app,
    application_sha: applicationSha,
    immutable_image: immutableImage,
    source_snapshot_id: snapshotId,
    restored_volume_id: volumeId,
    verifier_machine_id_sha256: sha256(machineId),
    data_directory_sha256: sha256(PHYSIO_RESTORE_DATA_DIRECTORY),
    application_database_absent: true,
    application_uploads_absent: true,
    unexpected_data_absent: true,
    provider_switches_disabled: true,
    provider_credentials_absent: true,
    test_provider_settings_absent: true,
    verified_at: timestamp.toISOString(),
  });
}

function readOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length || args[index + 1].startsWith('--')) {
    fail(`${name} is required`);
  }
  return args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (command === 'manifest') {
    const receipt = capturePhysioSnapshotManifest({
      databasePath: readOption(args, '--database'),
      snapshotSentinel: readOption(args, '--snapshot-sentinel'),
    });
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return;
  }
  if (command === 'verify-first-release-empty') {
    const receipt = verifyPhysioFirstReleaseEmptyRestore({
      dataDirectory: readOption(args, '--data-directory'),
      applicationSha: readOption(args, '--application-sha'),
      immutableImage: readOption(args, '--immutable-image'),
      volumeId: readOption(args, '--volume-id'),
      snapshotId: readOption(args, '--snapshot-id'),
      machineId: readOption(args, '--machine-id'),
    });
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return;
  }
  if (command !== 'verify') fail('command must be manifest, verify-first-release-empty, or verify');
  const receipt = verifyPhysioRestoredDatabase({
    databasePath: readOption(args, '--database'),
    applicationSha: readOption(args, '--application-sha'),
    immutableImage: readOption(args, '--immutable-image'),
    volumeId: readOption(args, '--volume-id'),
    snapshotId: readOption(args, '--snapshot-id'),
    machineId: readOption(args, '--machine-id'),
    snapshotSentinel: readOption(args, '--snapshot-sentinel'),
    expectedDataManifestSha256: readOption(args, '--expected-data-manifest-sha256'),
  });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  });
}
