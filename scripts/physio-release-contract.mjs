import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RESTART_MARKER_KEY, configWithoutRestartMarker,
  restartIntentFromPrestate } from './physio-fly-restart-contract.mjs';
import { buildFullMachineConfigUpdate, machineConfigSha256, machineEventsSha256, machineStateSha256,
  validateMachineForConfigTransition } from './physio-fly-machine-config-transition.mjs';

export const PHYSIO_RELEASE_CONTRACT_VERSION = 'assesssuite-physio-release/1.0.0';
export const PHYSIO_SQLITE_SCHEMA_CONTRACT_VERSION =
  'assesssuite-physio-sqlite-schema/1.0.0';
export const PHYSIO_DATA_MANIFEST_CONTRACT_VERSION =
  'assesssuite-physio-logical-data-manifest/1.0.0';
export const PHYSIO_SNAPSHOT_MANIFEST_CONTRACT_VERSION =
  'assesssuite-physio-presnapshot-manifest/1.0.0';
export const PHYSIO_DEPLOY_EFFECT_RECONCILIATION_CONTRACT_VERSION =
  'assesssuite-physio-deploy-effect-reconciliation/2.0.0';
export const PHYSIO_ROLLBACK_EFFECT_RECONCILIATION_CONTRACT_VERSION =
  'assesssuite-physio-rollback-effect-reconciliation/1.0.0';
export const PHYSIO_ROLLBACK_TARGET_ADMISSION_CONTRACT_VERSION =
  'assesssuite-physio-rollback-target-admission/1.0.0';

export const PHYSIO_ROLLBACK_PHASES = Object.freeze([
  'STARTED',
  'SNAPSHOT_COMPLETED',
  'RESTORE_VERIFIED',
  'TARGET_VERIFIED',
  'LIVE_MUTATION_STARTED',
  'POST_RESTART_VERIFIED',
  'RESTORE_VOLUME_CLEANUP',
  'COMPLETED',
]);

export const PHYSIO_DEPLOY_PHASES = Object.freeze([
  'STARTED',
  'SNAPSHOT_COMPLETED',
  'LIVE_MUTATION_STARTED',
  'LIVE_DEPLOY_COMPLETED',
  'PRESNAPSHOT_MANIFEST_STARTED',
  'PRESNAPSHOT_MANIFEST_COMPLETED',
  'MACHINE_STOP_STARTED',
  'MACHINE_STOPPED',
  'POSTDEPLOY_SNAPSHOT_STARTED',
  'POSTDEPLOY_SNAPSHOT_COMPLETED',
  'RESTORE_VOLUME_CREATE_STARTED',
  'RESTORE_VOLUME_CREATED',
  'VERIFIER_MACHINE_CREATE_STARTED',
  'VERIFIER_MACHINE_CREATED',
  'RESTORE_VERIFY_STARTED',
  'RESTORE_VERIFIED',
  'VERIFIER_MACHINE_STOP_STARTED',
  'VERIFIER_MACHINE_STOPPED',
  'VERIFIER_MACHINE_DESTROY_STARTED',
  'VERIFIER_MACHINE_DESTROYED',
  'RESTORE_VOLUME_DESTROY_STARTED',
  'RESTORE_VOLUME_DESTROYED',
  'MACHINE_START_STARTED',
  'MACHINE_STARTED',
  'RESTART_STARTED',
  'POST_RESTART_VERIFIED',
  'DEPLOY_COMPLETED',
  'SENTRY_ASSOCIATION_STARTED',
  'COMPLETED',
]);

export const PHYSIO_DEPLOY_PROVIDER_SUBEFFECT_KINDS = Object.freeze([
  'PREDEPLOY_SNAPSHOT_CREATE',
  'LIVE_DEPLOY',
  'PRESNAPSHOT_MANIFEST_EXEC',
  'PRODUCTION_MACHINE_STOP',
  'POSTDEPLOY_SNAPSHOT_CREATE',
  'RESTORE_VOLUME_CREATE',
  'RESTORE_VERIFIER_MACHINE_CREATE',
  'RESTORE_VERIFIER_EXEC',
  'RESTORE_VERIFIER_MACHINE_STOP',
  'RESTORE_VERIFIER_MACHINE_DESTROY',
  'RESTORE_VOLUME_DESTROY',
  'PRODUCTION_MACHINE_START',
  'PRODUCTION_MACHINE_RESTART',
  'SENTRY_DEPLOYMENT_ASSOCIATE',
]);

export const PHYSIO_LOGICAL_DATA_TABLES = Object.freeze([
  'api_usage_reservation',
  'entity_AdverseEvent',
  'entity_Appointment',
  'entity_Assessment',
  'entity_AssessmentRequest',
  'entity_Client',
  'entity_ClientAssessment',
  'entity_ClientCondition',
  'entity_ClientDocument',
  'entity_ClientNutritionPlan',
  'entity_ClientOnboardingEpisode',
  'entity_ClientReport',
  'entity_ClinicPolicy',
  'entity_Exercise',
  'entity_LegalAcceptance',
  'entity_LegalAcceptanceEvent',
  'entity_Organization',
  'entity_OrganizationMember',
  'entity_Payment',
  'entity_PhysioCareEpisode',
  'entity_SavedReport',
  'entity_SOAPNote',
  'entity_TreatmentProtocol',
  'entity_User',
  'extraction_usage',
  'organization_access_event',
  'organization_invitation',
  'outbox_email',
  'outbox_sms',
  'physio_ai_generation',
  'referral_commit_receipt',
  'session_records',
  'stripe_checkout_intent',
  'stripe_webhook_event',
  'upload_audit',
  'upload_disposition',
  'upload_registry',
  'usage_daily_aggregate',
]);

export const PHYSIO_RESTORE_PROVIDER_OFF_ENV = Object.freeze({
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
export const PHYSIO_RELEASE_TARGET = Object.freeze({
  app: 'assesssuite-physio-production',
  appId: 'local-assesssuite-physio',
  professionId: 'physio',
  professionSchemaVersion: '2.0.0',
  region: 'syd',
  volumeName: 'assesssuite_physio_data',
  volumeSizeGb: 3,
  volumeSnapshotRetentionDays: 5,
  mountPath: '/app/server/data',
  memoryMb: 512,
  cpus: 1,
  cpuKind: 'shared',
  flyHostname: 'https://assesssuite-physio-production.fly.dev',
  publicHostname: 'https://physio.app.assesssuite.com',
  catalogueCount: 236,
  catalogueChecksum: 'feed8f3b5c3a5cad19e682b18bcce0c848699b9cb43328fde23e267c5dbabd9e',
  sqliteUserVersion: 0,
  sqliteSchemaDigest: 'sha256:9e0ccdab32367a91151d78830eb115dc92c0bdea7f3cdaa85ce906cf10c8c575',
  sqliteSchemaObjectCount: 115,
  sqliteSchemaTableCount: 38,
  logicalDataTableCount: 38,
});

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const IMAGE_PATTERN = /^registry\.fly\.io\/assesssuite-physio-production@sha256:[0-9a-f]{64}$/;

function fail(message) {
  throw new Error(`Physio release contract: ${message}`);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} is not an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail(`${label} key set differs`);
}

export function validatePhysioPresnapshotManifestReceipt(receipt, { snapshotSentinel }) {
  exactKeys(receipt, [
    'contract_version',
    'result',
    'application',
    'database_path_sha256',
    'schema_contract_version',
    'schema_digest',
    'schema_object_count',
    'schema_table_count',
    'sqlite_user_version',
    'data_manifest_contract_version',
    'data_manifest_sha256',
    'data_manifest_table_count',
    'data_manifest_total_row_count',
    'data_manifest_tables',
    'snapshot_sentinel_sha256',
    'database_read_only',
    'provider_switches_disabled',
    'provider_credentials_absent',
    'test_provider_settings_absent',
  ], 'pre-snapshot manifest receipt');
  if (!/^[0-9a-f]{64}$/.test(snapshotSentinel || '')) fail('snapshot sentinel differs');
  if (receipt.contract_version !== PHYSIO_SNAPSHOT_MANIFEST_CONTRACT_VERSION ||
      receipt.result !== 'PASS' || receipt.application !== PHYSIO_RELEASE_TARGET.app ||
      receipt.database_path_sha256 !== sha256(PHYSIO_RELEASE_TARGET.mountPath + '/physio.db') ||
      receipt.schema_contract_version !== PHYSIO_SQLITE_SCHEMA_CONTRACT_VERSION ||
      receipt.schema_digest !== PHYSIO_RELEASE_TARGET.sqliteSchemaDigest ||
      receipt.schema_object_count !== PHYSIO_RELEASE_TARGET.sqliteSchemaObjectCount ||
      receipt.schema_table_count !== PHYSIO_RELEASE_TARGET.sqliteSchemaTableCount ||
      receipt.sqlite_user_version !== PHYSIO_RELEASE_TARGET.sqliteUserVersion ||
      receipt.data_manifest_contract_version !== PHYSIO_DATA_MANIFEST_CONTRACT_VERSION ||
      receipt.data_manifest_table_count !== PHYSIO_RELEASE_TARGET.logicalDataTableCount ||
      !Number.isSafeInteger(receipt.data_manifest_total_row_count) ||
      receipt.data_manifest_total_row_count < 0 ||
      !DIGEST_PATTERN.test(receipt.data_manifest_sha256 || '') ||
      receipt.snapshot_sentinel_sha256 !== sha256(snapshotSentinel) ||
      receipt.database_read_only !== true || receipt.provider_switches_disabled !== true ||
      receipt.provider_credentials_absent !== true || receipt.test_provider_settings_absent !== true) {
    fail('pre-snapshot manifest receipt differs');
  }
  if (!Array.isArray(receipt.data_manifest_tables) ||
      receipt.data_manifest_tables.length !== PHYSIO_LOGICAL_DATA_TABLES.length) {
    fail('pre-snapshot logical table manifest differs');
  }
  let totalRows = 0;
  receipt.data_manifest_tables.forEach((table, index) => {
    exactKeys(table, ['name', 'row_count', 'rows_sha256'], `pre-snapshot table ${index}`);
    if (table.name !== PHYSIO_LOGICAL_DATA_TABLES[index] ||
        !Number.isSafeInteger(table.row_count) || table.row_count < 0 ||
        !/^[0-9a-f]{64}$/.test(table.rows_sha256 || '')) {
      fail(`pre-snapshot table ${index} differs`);
    }
    totalRows += table.row_count;
  });
  if (totalRows !== receipt.data_manifest_total_row_count) {
    fail('pre-snapshot manifest row count differs');
  }
  const manifestInput = {
    contract_version: PHYSIO_DATA_MANIFEST_CONTRACT_VERSION,
    schema_digest: PHYSIO_RELEASE_TARGET.sqliteSchemaDigest,
    sqlite_user_version: PHYSIO_RELEASE_TARGET.sqliteUserVersion,
    snapshot_sentinel: snapshotSentinel,
    tables: receipt.data_manifest_tables,
  };
  if (receipt.data_manifest_sha256 !== `sha256:${sha256(canonicalJson(manifestInput))}`) {
    fail('pre-snapshot logical manifest digest differs');
  }
  return Object.freeze({
    contractVersion: PHYSIO_SNAPSHOT_MANIFEST_CONTRACT_VERSION,
    dataManifestSha256: receipt.data_manifest_sha256,
    tableCount: receipt.data_manifest_table_count,
    totalRowCount: receipt.data_manifest_total_row_count,
  });
}

function quoteSqliteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function normaliseSqliteDdl(sql) {
  if (sql === null || sql === undefined) return null;
  return String(sql).trim().replace(/\s+/g, ' ');
}

function sqliteRows(db, sql) {
  if (!db || typeof db.prepare !== 'function') fail('SQLite handle is unavailable');
  return db.prepare(sql).all();
}

function sqliteScalarInteger(db, pragma, label) {
  const row = db.prepare(pragma).get() || {};
  const value = Number(Object.values(row)[0]);
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} is invalid`);
  return value;
}

function canonicalColumn(column) {
  return Object.freeze({
    cid: Number(column.cid),
    name: String(column.name),
    type: String(column.type || ''),
    notnull: Number(column.notnull),
    default: column.dflt_value === undefined ? null : column.dflt_value,
    pk: Number(column.pk),
    hidden: Number(column.hidden || 0),
  });
}

function inspectTableSchema(db, table) {
  const quotedTable = quoteSqliteIdentifier(table);
  const tableList = sqliteRows(db, 'PRAGMA table_list')
    .find((row) => row.schema === 'main' && row.name === table);
  if (!tableList) fail(`table_list omits ${table}`);
  const columns = sqliteRows(db, `PRAGMA table_xinfo(${quotedTable})`)
    .map(canonicalColumn)
    .sort((left, right) => left.cid - right.cid);
  if (columns.length === 0) fail(`table ${table} has no columns`);
  const indexes = sqliteRows(db, `PRAGMA index_list(${quotedTable})`)
    .map((index) => {
      const name = String(index.name);
      return Object.freeze({
        name,
        unique: Number(index.unique),
        origin: String(index.origin || ''),
        partial: Number(index.partial),
        columns: sqliteRows(db, `PRAGMA index_xinfo(${quoteSqliteIdentifier(name)})`)
          .map((column) => Object.freeze({
            seqno: Number(column.seqno),
            cid: Number(column.cid),
            name: column.name === null || column.name === undefined ? null : String(column.name),
            desc: Number(column.desc),
            coll: column.coll === null || column.coll === undefined ? null : String(column.coll),
            key: Number(column.key),
          }))
          .sort((left, right) => left.seqno - right.seqno),
      });
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const foreignKeys = sqliteRows(db, `PRAGMA foreign_key_list(${quotedTable})`)
    .map((foreignKey) => Object.freeze({
      id: Number(foreignKey.id),
      seq: Number(foreignKey.seq),
      table: String(foreignKey.table),
      from: String(foreignKey.from),
      to: foreignKey.to === null || foreignKey.to === undefined ? null : String(foreignKey.to),
      on_update: String(foreignKey.on_update),
      on_delete: String(foreignKey.on_delete),
      match: String(foreignKey.match),
    }))
    .sort((left, right) => left.id - right.id || left.seq - right.seq);
  return Object.freeze({
    name: table,
    kind: String(tableList.type),
    column_count: Number(tableList.ncol),
    without_rowid: Number(tableList.wr),
    strict: Number(tableList.strict),
    columns: Object.freeze(columns),
    indexes: Object.freeze(indexes),
    foreign_keys: Object.freeze(foreignKeys),
  });
}

export function inspectPhysioSqliteSchema(db) {
  const userVersion = sqliteScalarInteger(db, 'PRAGMA user_version', 'SQLite user_version');
  const objects = sqliteRows(
    db,
    "SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name, tbl_name",
  ).map((row) => Object.freeze({
    type: String(row.type),
    name: String(row.name),
    table: String(row.tbl_name),
    sql: normaliseSqliteDdl(row.sql),
  }));
  if (objects.length === 0) fail('SQLite object set is empty');
  const tables = objects
    .filter((object) => object.type === 'table')
    .map((object) => inspectTableSchema(db, object.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  const canonical = Object.freeze({
    contract_version: PHYSIO_SQLITE_SCHEMA_CONTRACT_VERSION,
    sqlite_user_version: userVersion,
    objects: Object.freeze(objects),
    tables: Object.freeze(tables),
  });
  return Object.freeze({
    contract_version: PHYSIO_SQLITE_SCHEMA_CONTRACT_VERSION,
    sqlite_user_version: userVersion,
    object_count: objects.length,
    table_count: tables.length,
    schema_digest: `sha256:${sha256(canonicalJson(canonical))}`,
    canonical,
  });
}

function encodeSqliteValue(value) {
  if (value === null) return Object.freeze(['null']);
  if (typeof value === 'string') return Object.freeze(['text', value]);
  if (typeof value === 'bigint') return Object.freeze(['integer', value.toString()]);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('logical manifest encountered a non-finite SQLite value');
    return Object.freeze([Number.isInteger(value) ? 'integer' : 'real', String(value)]);
  }
  if (value instanceof Uint8Array) {
    return Object.freeze(['blob', Buffer.from(value).toString('base64')]);
  }
  fail(`logical manifest encountered unsupported SQLite value type ${typeof value}`);
}

function inspectLogicalTable(db, table, schemaTable) {
  const columns = schemaTable.columns.filter((column) => column.hidden === 0);
  const projection = columns.map((column) => quoteSqliteIdentifier(column.name)).join(', ');
  const rowHashes = [];
  for (const row of db.prepare(`SELECT ${projection} FROM ${quoteSqliteIdentifier(table)}`).iterate()) {
    const values = columns.map((column) => encodeSqliteValue(row[column.name]));
    rowHashes.push(sha256(canonicalJson(values)));
  }
  rowHashes.sort();
  return Object.freeze({
    name: table,
    row_count: rowHashes.length,
    rows_sha256: sha256(canonicalJson(rowHashes)),
  });
}

export function buildPhysioLogicalDataManifest(db, { snapshotSentinel }) {
  if (!/^[0-9a-f]{64}$/.test(snapshotSentinel || '')) {
    fail('snapshot sentinel must be 32 random bytes encoded as lowercase hex');
  }
  db.exec('BEGIN');
  try {
    const schema = inspectPhysioSqliteSchema(db);
    const tables = schema.canonical.tables
      .filter((table) => !table.name.startsWith('sqlite_'))
      .map((table) => inspectLogicalTable(db, table.name, table));
    const totalRowCount = tables.reduce((total, table) => total + table.row_count, 0);
    const manifestInput = Object.freeze({
      contract_version: PHYSIO_DATA_MANIFEST_CONTRACT_VERSION,
      schema_digest: schema.schema_digest,
      sqlite_user_version: schema.sqlite_user_version,
      snapshot_sentinel: snapshotSentinel,
      tables,
    });
    const manifest = Object.freeze({
      contract_version: PHYSIO_DATA_MANIFEST_CONTRACT_VERSION,
      schema_digest: schema.schema_digest,
      sqlite_user_version: schema.sqlite_user_version,
      snapshot_sentinel_sha256: sha256(snapshotSentinel),
      table_count: tables.length,
      total_row_count: totalRowCount,
      tables: Object.freeze(tables),
      manifest_sha256: `sha256:${sha256(canonicalJson(manifestInput))}`,
    });
    db.exec('COMMIT');
    return manifest;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

export function resolvePhysioReleaseCatalogueContract() {
  const count = PHYSIO_RELEASE_TARGET.catalogueCount;
  const checksum = PHYSIO_RELEASE_TARGET.catalogueChecksum;
  if (!Number.isSafeInteger(count) || count <= 0) fail('pinned catalogue count is invalid');
  if (!/^[0-9a-f]{64}$/.test(checksum)) fail('pinned catalogue checksum is invalid');
  return Object.freeze({ count, checksum });
}

export function renderPhysioReleaseCatalogueEnvironment() {
  const { count, checksum } = resolvePhysioReleaseCatalogueContract();
  return `PHYSIO_EXPECTED_CATALOGUE_COUNT=${count}\nPHYSIO_EXPECTED_CATALOGUE_CHECKSUM=${checksum}\n`;
}

function normaliseLf(value) {
  return value.replaceAll('\r\n', '\n');
}

function exactCount(source, needle, expected, label = needle) {
  const actual = source.split(needle).length - 1;
  if (actual !== expected) fail(`${label} count is ${actual}; expected ${expected}`);
}

export function sha256Lf(value) {
  return createHash('sha256').update(normaliseLf(value)).digest('hex');
}

export function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (Buffer.byteLength(raw) > 1_048_576) fail(`${filePath} exceeds the 1 MiB JSON evidence bound`);
  return JSON.parse(raw);
}

export function asRows(payload, candidateKeys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') fail('provider JSON is not an object or array');
  for (const key of candidateKeys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  if (Array.isArray(payload.data)) return payload.data;
  fail(`provider JSON lacks an array at ${candidateKeys.join(', ') || 'data'}`);
}

function stringValue(value, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} is missing`);
  return value.trim();
}

function numericValue(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) fail(`${label} is not numeric`);
  return number;
}

function volumeIdOf(volume) {
  return stringValue(volume.id ?? volume.ID, 'volume ID');
}

function machineIdOf(machine) {
  return stringValue(machine.id ?? machine.ID, 'machine ID');
}

function stateOf(row) {
  return String(row.state ?? row.State ?? '').toLowerCase();
}

function regionOf(row) {
  return row.region ?? row.Region;
}

export function canonicalizePhysioFlyImageReference(value) {
  if (typeof value === 'string') {
    if (!IMAGE_PATTERN.test(value)) fail('Fly image reference string differs');
    return value;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('Fly image reference object differs');
  }
  const keys = JSON.stringify(Object.keys(value).sort());
  const baseKeys = JSON.stringify(['digest', 'registry', 'repository']);
  const flyctl0471Keys = JSON.stringify(['digest', 'labels', 'registry', 'repository', 'tag']);
  if (keys !== baseKeys && keys !== flyctl0471Keys) fail('Fly image reference object differs');
  if (value.registry !== 'registry.fly.io' || value.repository !== PHYSIO_RELEASE_TARGET.app ||
      !/^sha256:[0-9a-f]{64}$/.test(value.digest || '')) {
    fail('Fly image reference object identity differs');
  }
  if (keys === flyctl0471Keys) {
    if (!/^deployment-[0-9A-Z]{26}$/.test(value.tag || '') ||
        !value.labels || typeof value.labels !== 'object' || Array.isArray(value.labels)) {
      fail('Fly image reference metadata differs');
    }
    const allowedLabels = new Set(['GH_ACTION_NAME', 'GH_EVENT_NAME', 'GH_REPO', 'GH_SHA']);
    if (Object.keys(value.labels).some((label) => !allowedLabels.has(label)) ||
        Object.values(value.labels).some((labelValue) => typeof labelValue !== 'string')) {
      fail('Fly image reference labels differ');
    }
    if (value.labels.GH_ACTION_NAME !== undefined &&
        !/^__run_[1-9][0-9]*$/.test(value.labels.GH_ACTION_NAME)) {
      fail('Fly image reference action label differs');
    }
    if (value.labels.GH_EVENT_NAME !== undefined &&
        !/^(?:push|workflow_dispatch)$/.test(value.labels.GH_EVENT_NAME)) {
      fail('Fly image reference event label differs');
    }
    if (value.labels.GH_REPO !== undefined &&
        value.labels.GH_REPO !== 'mbvidler-ctrl/assesssuite_migration') {
      fail('Fly image reference repository label differs');
    }
    if (value.labels.GH_SHA !== undefined && !SHA_PATTERN.test(value.labels.GH_SHA)) {
      fail('Fly image reference SHA label differs');
    }
  }
  return `${value.registry}/${value.repository}@${value.digest}`;
}

function findImageReference(machine) {
  const primaryCandidates = [
    machine.image_ref,
    machine.imageRef,
    machine.ImageRef,
  ].filter((value) => value !== undefined && value !== null && value !== '');
  const configCandidates = [
    machine.config?.image,
    machine.Config?.image,
  ].filter((value) => value !== undefined && value !== null && value !== '');
  const candidates = primaryCandidates.length > 0 ? primaryCandidates : configCandidates;
  if (candidates.length === 0) return '';
  const canonical = [...new Set(candidates.map(canonicalizePhysioFlyImageReference))];
  if (canonical.length !== 1) fail('Fly machine exposes conflicting image references');
  const admittedTags = new Set(primaryCandidates
    .filter((value) => value && typeof value === 'object' && !Array.isArray(value) && value.tag)
    .map((value) => `${value.registry}/${value.repository}:${value.tag}`));
  for (const configImage of configCandidates) {
    if (typeof configImage === 'string' && admittedTags.has(configImage)) continue;
    if (canonicalizePhysioFlyImageReference(configImage) !== canonical[0]) {
      fail('Fly machine exposes conflicting image references');
    }
  }
  return canonical[0];
}

function inspectSoleVolume(volume, expectedVolumeId, attachedMachineId) {
  const target = PHYSIO_RELEASE_TARGET;
  const id = volumeIdOf(volume);
  if (expectedVolumeId && id !== expectedVolumeId) fail(`volume ${id} differs from pinned ${expectedVolumeId}`);
  if ((volume.name ?? volume.Name) !== target.volumeName) fail('volume name differs');
  if (regionOf(volume) !== target.region) fail('volume region differs');
  if (!['created', ''].includes(stateOf(volume))) fail(`volume state is ${stateOf(volume)}`);
  if (numericValue(volume.size_gb ?? volume.sizeGb ?? volume.SizeGb, 'volume size') !== target.volumeSizeGb) {
    fail('volume size differs');
  }
  if (volume.encrypted !== true && volume.Encrypted !== true) fail('volume is not encrypted');
  const retention = volume.snapshot_retention ?? volume.snapshotRetention ?? volume.SnapshotRetention;
  if (numericValue(retention, 'snapshot retention') !== target.volumeSnapshotRetentionDays) {
    fail('snapshot retention differs');
  }
  const backups = volume.auto_backup_enabled ?? volume.autoBackupEnabled ?? volume.AutoBackupEnabled;
  if (backups !== true) fail('scheduled snapshots are not enabled');
  const attached = volume.attached_machine_id ?? volume.attachedMachineId ?? volume.AttachedMachineId ?? null;
  if (attachedMachineId === null && attached !== null) fail('bootstrapped volume is unexpectedly attached');
  if (attachedMachineId && attached !== attachedMachineId) fail('volume is not attached to the pinned machine');
  return id;
}

function inspectSoleMachine(machine, expectedMachineId, expectedImageRef, volumeId, { allowStopped = false } = {}) {
  const target = PHYSIO_RELEASE_TARGET;
  const id = machineIdOf(machine);
  if (!/^[0-9a-f]{14,32}$/i.test(id)) fail('machine ID shape differs');
  if (expectedMachineId && id !== expectedMachineId) fail(`machine ${id} differs from pinned ${expectedMachineId}`);
  if (regionOf(machine) !== target.region) fail('machine region differs');
  const machineState = stateOf(machine);
  const admittedStates = allowStopped ? ['started', 'stopped'] : ['started'];
  if (!admittedStates.includes(machineState)) fail(`machine state is ${machineState}`);

  const guest = machine.config?.guest ?? machine.Config?.guest ?? machine.guest ?? {};
  if (numericValue(guest.cpus, 'machine CPUs') !== target.cpus) fail('machine CPU count differs');
  if (numericValue(guest.memory_mb ?? guest.memoryMb, 'machine memory') !== target.memoryMb) {
    fail('machine memory differs');
  }
  if ((guest.cpu_kind ?? guest.cpuKind) !== target.cpuKind) fail('machine CPU kind differs');

  if (!IMAGE_PATTERN.test(expectedImageRef || '')) fail('expected image is not the Physio immutable registry digest');
  const actualImage = findImageReference(machine);
  if (actualImage !== expectedImageRef) fail(`machine image ${actualImage || 'missing'} differs from pinned image`);

  const mounts = machine.config?.mounts ?? machine.Config?.mounts;
  if (!Array.isArray(mounts) || mounts.length !== 1) fail('machine must expose exactly one persistent mount');
  const mount = mounts[0];
  const mountedId = mount.volume ?? mount.volume_id ?? mount.volumeId;
  if (mountedId !== volumeId) fail('machine mount ID differs from pinned volume');
  if ((mount.path ?? mount.destination) !== target.mountPath) fail('machine mount path differs');
  return Object.freeze({ id, state: machineState });
}

export function inspectTopology({
  machinesPayload,
  volumesPayload,
  mode,
  expectedVolumeId = '',
  expectedMachineId = '',
  expectedImageRef = '',
}) {
  if (!['absent', 'bootstrapped', 'deployed', 'recovery-admission'].includes(mode)) {
    fail(`unsupported topology mode ${mode}`);
  }
  const machines = asRows(machinesPayload, ['machines', 'Machines']);
  const volumes = asRows(volumesPayload, ['volumes', 'Volumes']);
  if (mode === 'absent') {
    if (machines.length !== 0 || volumes.length !== 0) fail('absent topology is not empty');
    return Object.freeze({ mode, machineCount: 0, volumeCount: 0 });
  }
  if (volumes.length !== 1) fail(`expected one Physio volume; found ${volumes.length}`);
  if (mode === 'bootstrapped') {
    if (machines.length !== 0) fail(`bootstrapped topology has ${machines.length} machines`);
    const volumeId = inspectSoleVolume(volumes[0], expectedVolumeId, null);
    return Object.freeze({ mode, machineCount: 0, volumeCount: 1, volumeId });
  }
  if (machines.length !== 1) fail(`deployed topology has ${machines.length} machines`);
  const machineId = machineIdOf(machines[0]);
  const volumeId = inspectSoleVolume(volumes[0], expectedVolumeId, machineId);
  const inspectedMachine = inspectSoleMachine(
    machines[0],
    expectedMachineId,
    expectedImageRef,
    volumeId,
    { allowStopped: mode === 'recovery-admission' },
  );
  return Object.freeze({
    mode,
    machineCount: 1,
    volumeCount: 1,
    volumeId,
    machineId,
    ...(mode === 'recovery-admission' ? { machineState: inspectedMachine.state } : {}),
  });
}

export function inspectRestoreVerifierTopology({
  machinesPayload,
  volumesPayload,
  productionMachineId,
  primaryVolumeId,
  restoreVolumeId,
  verifierMachineName,
  verifierRole,
  expectedImageRef,
  expectedApplicationSha,
  expectedProductionState = 'stopped',
}) {
  const machines = asRows(machinesPayload, ['machines', 'Machines']);
  const volumes = asRows(volumesPayload, ['volumes', 'Volumes']);
  if (machines.length !== 2 || volumes.length !== 2) {
    fail(`restore verifier topology must contain exactly two machines and two volumes; found ${machines.length}/${volumes.length}`);
  }
  if (!/^[0-9a-f]{14,32}$/i.test(productionMachineId || '')) fail('production machine ID shape differs');
  if (!/^vol_[A-Za-z0-9]+$/.test(primaryVolumeId || '')) fail('primary volume ID shape differs');
  if (!/^vol_[A-Za-z0-9]+$/.test(restoreVolumeId || '') || restoreVolumeId === primaryVolumeId) {
    fail('restore volume ID shape or isolation differs');
  }
  if (!/^[a-z0-9-]{1,63}$/.test(verifierMachineName || '')) fail('verifier machine name shape differs');
  if (!/^[a-z0-9-]{1,80}$/.test(verifierRole || '')) fail('verifier role shape differs');
  if (!IMAGE_PATTERN.test(expectedImageRef || '')) fail('verifier image is not an immutable Physio digest');
  if (!/^[0-9a-f]{40}$/.test(expectedApplicationSha || '')) fail('verifier application SHA differs');

  const production = machines.find((row) => machineIdOf(row) === productionMachineId);
  const verifierMatches = machines.filter((row) => (row?.name ?? row?.Name) === verifierMachineName);
  if (!production || verifierMatches.length !== 1) fail('production or unique verifier identity differs');
  if (!['started', 'stopped'].includes(expectedProductionState) || stateOf(production) !== expectedProductionState) {
    fail('production machine state during restore verification differs');
  }
  const verifier = verifierMatches[0];
  const verifierMachineId = machineIdOf(verifier);
  if (!/^[0-9a-f]{14,32}$/i.test(verifierMachineId) || verifierMachineId === productionMachineId) {
    fail('verifier machine ID shape or isolation differs');
  }
  if (regionOf(verifier) !== PHYSIO_RELEASE_TARGET.region || stateOf(verifier) !== 'started') {
    fail('verifier machine region or state differs');
  }

  const config = verifier.config ?? verifier.Config ?? {};
  const image = findImageReference(verifier);
  const services = config.services;
  const mounts = config.mounts;
  const metadata = config.metadata ?? {};
  const initCommand = config.init?.cmd ?? config.init?.exec;
  const restartPolicy = config.restart?.policy;
  const dnsSkipRegistration = config.dns?.skip_registration;
  const environment = config.env ?? {};
  if (image !== expectedImageRef) fail('verifier image readback differs');
  if (!Array.isArray(services) || services.length !== 0) fail('verifier exposes a Fly service');
  if (!Array.isArray(mounts) || mounts.length !== 1) fail('verifier mount cardinality differs');
  const mount = mounts[0];
  if ((mount.volume ?? mount.volume_id ?? mount.volumeId) !== restoreVolumeId) {
    fail('verifier mount ID differs from exact restore volume');
  }
  if ((mount.path ?? mount.destination) !== PHYSIO_RELEASE_TARGET.mountPath) fail('verifier mount path differs');
  if (metadata['assesssuite-restore-role'] !== verifierRole ||
      metadata['assesssuite-release-sha'] !== expectedApplicationSha) {
    fail('verifier ownership metadata differs');
  }
  if (JSON.stringify(initCommand) !== JSON.stringify(['sleep', '1800']) &&
      JSON.stringify(initCommand) !== JSON.stringify(['/bin/sleep', '1800'])) {
    fail('verifier command readback differs');
  }
  if (restartPolicy !== 'no') fail('verifier restart policy readback differs');
  if (dnsSkipRegistration !== true) fail('verifier DNS registration was not disabled');
  if (config.auto_destroy === true) fail('verifier unexpectedly enables auto-destroy');

  const expectedEnvironment = {
    NODE_ENV: 'production',
    PROFESSION: PHYSIO_RELEASE_TARGET.professionId,
    DEFAULT_APP_ID: PHYSIO_RELEASE_TARGET.appId,
    ...PHYSIO_RESTORE_PROVIDER_OFF_ENV,
  };
  for (const [name, value] of Object.entries(expectedEnvironment)) {
    if (environment[name] !== value) fail(`verifier environment ${name} differs`);
  }
  if (JSON.stringify(Object.keys(environment).sort()) !==
      JSON.stringify(Object.keys(expectedEnvironment).sort())) {
    fail('verifier environment key set differs');
  }
  for (const [name, value] of Object.entries(environment)) {
    if (/(?:MOCK|FAKE|SELFTEST|TEST_BASE_URL|PARITY|PROBE)/i.test(name) && value !== '0') {
      fail(`verifier environment exposes forbidden ${name}`);
    }
  }

  const primary = volumes.find((row) => volumeIdOf(row) === primaryVolumeId);
  const restore = volumes.find((row) => volumeIdOf(row) === restoreVolumeId);
  if (!primary || !restore) fail('primary or restore volume is missing');
  const primaryAttachment = primary.attached_machine_id ?? primary.attachedMachineId ?? primary.AttachedMachineId;
  const restoreAttachment = restore.attached_machine_id ?? restore.attachedMachineId ?? restore.AttachedMachineId;
  if (primaryAttachment !== productionMachineId || restoreAttachment !== verifierMachineId) {
    fail('exact primary or restore volume attachment differs');
  }
  if (regionOf(restore) !== PHYSIO_RELEASE_TARGET.region ||
      (restore.encrypted !== true && restore.Encrypted !== true)) {
    fail('restore volume region or encryption differs');
  }

  return Object.freeze({
    verifierMachineId,
    verifierMachineIdSha256: sha256(verifierMachineId),
    providerCommandReadback: true,
    providerEnvironmentReadback: true,
    providerRestartPolicyReadback: true,
    providerDnsReadback: true,
    exactMountIdVerified: true,
    services: 0,
  });
}

/**
 * First-deployment failure recovery has no production Machine after the failed
 * carrier is destroyed. This validator proves the sole replacement carrier is
 * a provider-off, no-service, no-DNS verifier attached by exact ID to the
 * snapshot clone while the mutated original volume remains detached.
 */
export function inspectFirstReleaseRecoveryVerifierTopology({
  machinesPayload,
  volumesPayload,
  originalVolumeId,
  recoveryVolumeId,
  verifierMachineName,
  verifierRole,
  expectedImageRef,
  expectedApplicationSha,
}) {
  const machines = asRows(machinesPayload, ['machines', 'Machines']);
  const volumes = asRows(volumesPayload, ['volumes', 'Volumes']);
  if (machines.length !== 1 || volumes.length !== 2) {
    fail(`first-release recovery verifier topology must contain exactly one machine and two volumes; found ${machines.length}/${volumes.length}`);
  }
  if (!/^vol_[A-Za-z0-9]+$/.test(originalVolumeId || '') ||
      !/^vol_[A-Za-z0-9]+$/.test(recoveryVolumeId || '') ||
      originalVolumeId === recoveryVolumeId) fail('first-release recovery volume identity differs');
  if (!/^[a-z0-9-]{1,63}$/.test(verifierMachineName || '') ||
      !/^[a-z0-9-]{1,80}$/.test(verifierRole || '')) fail('first-release recovery verifier ownership shape differs');
  if (!IMAGE_PATTERN.test(expectedImageRef || '') || !SHA_PATTERN.test(expectedApplicationSha || '')) {
    fail('first-release recovery verifier image or application SHA differs');
  }

  const matches = machines.filter((row) => (row?.name ?? row?.Name) === verifierMachineName);
  if (matches.length !== 1) fail('first-release recovery verifier identity differs');
  const verifier = matches[0];
  const verifierMachineId = machineIdOf(verifier);
  if (!/^[0-9a-f]{14,32}$/i.test(verifierMachineId) ||
      regionOf(verifier) !== PHYSIO_RELEASE_TARGET.region || stateOf(verifier) !== 'started') {
    fail('first-release recovery verifier machine state differs');
  }

  const original = volumes.find((row) => volumeIdOf(row) === originalVolumeId);
  const recovery = volumes.find((row) => volumeIdOf(row) === recoveryVolumeId);
  if (!original || !recovery) fail('first-release original or recovery volume is missing');
  inspectSoleVolume(original, originalVolumeId, null);
  inspectSoleVolume(recovery, recoveryVolumeId, verifierMachineId);

  const config = verifier.config ?? verifier.Config ?? {};
  const environment = config.env ?? {};
  const metadata = config.metadata ?? {};
  const mounts = config.mounts;
  const mount = Array.isArray(mounts) && mounts.length === 1 ? mounts[0] : null;
  const initCommand = config.init?.cmd ?? config.init?.exec;
  if (findImageReference(verifier) !== expectedImageRef ||
      !Array.isArray(config.services) || config.services.length !== 0 ||
      !mount || (mount.volume ?? mount.volume_id ?? mount.volumeId) !== recoveryVolumeId ||
      (mount.path ?? mount.destination) !== PHYSIO_RELEASE_TARGET.mountPath ||
      metadata['assesssuite-restore-role'] !== verifierRole ||
      metadata['assesssuite-release-sha'] !== expectedApplicationSha ||
      (JSON.stringify(initCommand) !== JSON.stringify(['sleep', '1800']) &&
       JSON.stringify(initCommand) !== JSON.stringify(['/bin/sleep', '1800'])) ||
      config.restart?.policy !== 'no' || config.dns?.skip_registration !== true ||
      config.auto_destroy === true) {
    fail('first-release recovery verifier configuration differs');
  }
  const expectedEnvironment = {
    NODE_ENV: 'production',
    PROFESSION: PHYSIO_RELEASE_TARGET.professionId,
    DEFAULT_APP_ID: PHYSIO_RELEASE_TARGET.appId,
    ...PHYSIO_RESTORE_PROVIDER_OFF_ENV,
  };
  for (const [name, value] of Object.entries(expectedEnvironment)) {
    if (environment[name] !== value) fail(`first-release recovery verifier environment ${name} differs`);
  }
  if (JSON.stringify(Object.keys(environment).sort()) !==
      JSON.stringify(Object.keys(expectedEnvironment).sort())) {
    fail('first-release recovery verifier environment key set differs');
  }
  return Object.freeze({
    verifierMachineId,
    verifierMachineIdSha256: sha256(verifierMachineId),
    originalVolumeDetached: true,
    recoveryVolumeExactMountVerified: true,
    services: 0,
  });
}

export function inspectOrganization({ organizationPayload, expectedSlug }) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(expectedSlug || '')) {
    fail('expected Fly organization slug is invalid');
  }
  if (!organizationPayload || typeof organizationPayload !== 'object' || Array.isArray(organizationPayload)) {
    fail('Fly organization readback is malformed');
  }
  const slug = organizationPayload.slug ?? organizationPayload.Slug;
  const id = organizationPayload.id ?? organizationPayload.ID;
  if (slug !== expectedSlug || !/^[A-Za-z0-9_-]{2,160}$/.test(id || '')) {
    fail('Fly organization identity differs');
  }
  return Object.freeze({ slug, id });
}

export function inspectApplication({ applicationsPayload, mode, expectedOrganization = '' }) {
  if (!['absent', 'present'].includes(mode)) fail(`unsupported application mode ${mode}`);
  const applications = asRows(applicationsPayload, ['apps', 'applications']);
  if (expectedOrganization) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(expectedOrganization)) {
      fail('expected Fly application organization slug is invalid');
    }
    for (const row of applications) {
      const organization = row?.organization ?? row?.Organization ?? {};
      const slug = organization?.slug ?? organization?.Slug ?? row?.organization_slug ?? row?.organizationSlug;
      if (slug !== expectedOrganization) fail('Fly application owner organization differs');
    }
  }
  const matches = applications.filter((row) => (
    row?.name ?? row?.Name ?? row?.app_name ?? row?.appName
  ) === PHYSIO_RELEASE_TARGET.app);
  if (mode === 'absent' && matches.length !== 0) fail('Physio application already exists');
  if (mode === 'present' && matches.length !== 1) fail(`expected one Physio application; found ${matches.length}`);
  return Object.freeze({ mode, count: matches.length, ...(expectedOrganization ? { organization: expectedOrganization } : {}) });
}

export function inspectCertificateInventory(certificatesPayload, { mode = 'absent' } = {}) {
  if (!['absent', 'production'].includes(mode)) fail(`unsupported certificate inventory mode ${mode}`);
  const certificates = asRows(certificatesPayload, ['certificates', 'certs']);
  if (mode === 'absent') {
    if (certificates.length !== 0) fail(`custom certificate inventory is not empty (${certificates.length})`);
    return Object.freeze({ count: 0 });
  }
  if (certificates.length !== 1) {
    fail(`production certificate inventory count is ${certificates.length}; expected 1`);
  }
  const certificate = certificates[0];
  exactKeys(certificate, [
    'hostname', 'status', 'dns_provider', 'acme_dns_configured', 'acme_alpn_configured',
    'acme_http_configured', 'ownership_txt_configured', 'configured', 'acme_requested',
    'has_custom_certificate', 'has_fly_certificate', 'created_at', 'updated_at',
  ], 'production certificate');
  const expectedHostname = new URL(PHYSIO_RELEASE_TARGET.publicHostname).hostname;
  const createdAt = stringValue(certificate.created_at, 'production certificate created timestamp');
  const updatedAt = stringValue(certificate.updated_at, 'production certificate updated timestamp');
  const createdAtMs = Date.parse(createdAt);
  const updatedAtMs = Date.parse(updatedAt);
  if (certificate.hostname !== expectedHostname || certificate.status !== 'Ready' ||
      certificate.dns_provider !== 'godaddy' || certificate.acme_dns_configured !== false ||
      certificate.acme_alpn_configured !== true || certificate.acme_http_configured !== false ||
      certificate.ownership_txt_configured !== false || certificate.configured !== true ||
      certificate.acme_requested !== true || certificate.has_custom_certificate !== false ||
      certificate.has_fly_certificate !== true || !Number.isFinite(createdAtMs) ||
      !Number.isFinite(updatedAtMs) || createdAtMs > updatedAtMs) {
    fail('production certificate identity or readiness differs');
  }
  return Object.freeze({
    count: 1,
    hostname: expectedHostname,
    status: 'ready',
    dnsProvider: 'godaddy',
    challenge: 'tls-alpn-01',
    configured: true,
    acmeRequested: true,
    flyManaged: true,
    customCertificateCount: 0,
    createdAt,
    updatedAt,
  });
}

export function inspectNoCustomCertificates(certificatesPayload) {
  return inspectCertificateInventory(certificatesPayload, { mode: 'absent' });
}

function parsePhysioStateSnapshotBytes(value, label) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : (value instanceof Uint8Array ? Buffer.from(value) : null);
  if (!bytes || bytes.length === 0 || bytes.length > 1_048_576) fail(`${label} bytes differ`);
  const text = bytes.toString('utf8');
  if (Buffer.from(text, 'utf8').compare(bytes) !== 0 || text.includes('\r') ||
      !text.endsWith('\n') || text.endsWith('\n\n')) {
    fail(`${label} encoding differs`);
  }
  try {
    return { bytes, value: JSON.parse(text) };
  } catch {
    fail(`${label} JSON differs`);
  }
}

export function validatePhysioStateSnapshotEvidence({
  receipt,
  initialStateBytes,
  finalStateBytes,
  applicationSha,
}) {
  if (!SHA_PATTERN.test(applicationSha || '')) fail('state snapshot application SHA differs');
  exactKeys(receipt, [
    'application', 'authority_reference', 'capability_intent_id', 'contract_version',
    'custom_certificate_count', 'event_sha', 'expected_state', 'fly_hostname_precedes_custom_dns',
    'immutable_image', 'machine_id', 'observed_at', 'provider_raw_readback_sha256',
    'provider_state_final_sha256', 'provider_state_initial_sha256', 'provider_state_unchanged',
    'result', 'volume_id',
  ], 'state snapshot receipt');
  const initial = parsePhysioStateSnapshotBytes(initialStateBytes, 'initial provider state');
  const final = parsePhysioStateSnapshotBytes(finalStateBytes, 'final provider state');
  const initialSha256 = sha256(initial.bytes);
  const finalSha256 = sha256(final.bytes);
  const rawKeys = [
    'apps_final', 'apps_initial', 'certificates_final', 'certificates_initial',
    'machines_final', 'machines_initial', 'volumes_final', 'volumes_initial',
  ];
  exactKeys(receipt.provider_raw_readback_sha256, rawKeys, 'state snapshot raw-provider hashes');
  if (receipt.contract_version !== 'assesssuite-physio-state-snapshot/2.0.0' ||
      receipt.result !== 'PASS' || receipt.application !== PHYSIO_RELEASE_TARGET.app ||
      receipt.event_sha !== applicationSha || !['absent', 'deployed'].includes(receipt.expected_state) ||
      receipt.custom_certificate_count !== 0 || receipt.fly_hostname_precedes_custom_dns !== true ||
      receipt.provider_state_unchanged !== true ||
      receipt.provider_state_initial_sha256 !== initialSha256 ||
      receipt.provider_state_final_sha256 !== finalSha256 || initialSha256 !== finalSha256 ||
      initial.bytes.compare(final.bytes) !== 0 ||
      Object.values(receipt.provider_raw_readback_sha256).some((value) => !/^[0-9a-f]{64}$/.test(value)) ||
      !/^[A-Za-z0-9._:-]{1,160}$/.test(receipt.capability_intent_id || '') ||
      !/^[A-Za-z0-9._:/-]{1,240}$/.test(receipt.authority_reference || '') ||
      !Number.isFinite(Date.parse(receipt.observed_at || ''))) {
    fail('state snapshot identity or immutable evidence differs');
  }

  exactKeys(initial.value, ['application', 'topology', 'certificates'], 'canonical provider state');
  if (receipt.expected_state === 'absent') {
    const expected = {
      application: { mode: 'absent', count: 0 },
      topology: { mode: 'absent', machineCount: 0, volumeCount: 0 },
      certificates: { count: 0 },
    };
    if (receipt.volume_id !== 'NOT-CREATED' || receipt.machine_id !== 'NOT-CREATED' ||
        receipt.immutable_image !== 'NOT-DEPLOYED' || canonicalJson(initial.value) !== canonicalJson(expected)) {
      fail('absent state snapshot topology differs');
    }
  } else {
    exactKeys(initial.value.application, ['mode', 'count'], 'deployed application state');
    exactKeys(initial.value.topology, [
      'mode', 'machineCount', 'volumeCount', 'volumeId', 'machineId',
    ], 'deployed topology state');
    exactKeys(initial.value.certificates, [
      'count', 'hostname', 'status', 'dnsProvider', 'challenge', 'configured', 'acmeRequested',
      'flyManaged', 'customCertificateCount', 'createdAt', 'updatedAt',
    ], 'deployed certificate state');
    const certificate = initial.value.certificates;
    const expectedHostname = new URL(PHYSIO_RELEASE_TARGET.publicHostname).hostname;
    const createdAtMs = Date.parse(certificate.createdAt || '');
    const updatedAtMs = Date.parse(certificate.updatedAt || '');
    if (!/^vol_[A-Za-z0-9]+$/.test(receipt.volume_id || '') ||
        !/^[0-9a-f]{14,32}$/.test(receipt.machine_id || '') ||
        !IMAGE_PATTERN.test(receipt.immutable_image || '') ||
        initial.value.application.mode !== 'present' || initial.value.application.count !== 1 ||
        initial.value.topology.mode !== 'deployed' || initial.value.topology.machineCount !== 1 ||
        initial.value.topology.volumeCount !== 1 || initial.value.topology.volumeId !== receipt.volume_id ||
        initial.value.topology.machineId !== receipt.machine_id || certificate.count !== 1 ||
        certificate.hostname !== expectedHostname || certificate.status !== 'ready' ||
        certificate.dnsProvider !== 'godaddy' || certificate.challenge !== 'tls-alpn-01' ||
        certificate.configured !== true || certificate.acmeRequested !== true ||
        certificate.flyManaged !== true || certificate.customCertificateCount !== 0 ||
        !Number.isFinite(createdAtMs) || !Number.isFinite(updatedAtMs) || createdAtMs > updatedAtMs) {
      fail('deployed state snapshot topology or certificate differs');
    }
  }
  return Object.freeze({
    expectedState: receipt.expected_state,
    volumeId: receipt.volume_id,
    machineId: receipt.machine_id,
    immutableImage: receipt.immutable_image,
  });
}

export function inspectSnapshot({ snapshotsPayload, expectedSnapshotId = '' }) {
  const snapshots = asRows(snapshotsPayload, ['snapshots', 'Snapshots']);
  if (snapshots.length === 0) fail('snapshot inventory is empty');
  const idOf = (row) => row?.id ?? row?.ID ?? row?.snapshot_id ?? row?.snapshotId;
  const selected = expectedSnapshotId
    ? snapshots.find((row) => idOf(row) === expectedSnapshotId)
    : snapshots[0];
  if (!selected) fail(`snapshot ${expectedSnapshotId} is missing`);
  const snapshotId = stringValue(idOf(selected), 'snapshot ID');
  if (!/^[A-Za-z0-9_-]{6,160}$/.test(snapshotId)) fail('snapshot ID shape differs');
  const status = String(selected.status ?? selected.state ?? selected.Status ?? selected.State ?? 'created').toLowerCase();
  if (!['created', 'complete', 'completed', 'ready', ''].includes(status)) fail(`snapshot state is ${status}`);
  return Object.freeze({ snapshotId, status: status || 'created' });
}

export function validateRuntimeEvidence({ live, ready, version, capabilities, expectedSha }) {
  const target = PHYSIO_RELEASE_TARGET;
  const catalogue = resolvePhysioReleaseCatalogueContract();
  if (!SHA_PATTERN.test(expectedSha)) fail('runtime expected SHA must be a 40-character commit');
  if (live?.status !== 'live' || live?.profession_id !== target.professionId || live?.app_id !== target.appId) {
    fail('liveness identity differs');
  }
  if (ready?.status !== 'ready' || ready?.ready !== true || !Array.isArray(ready?.failures) || ready.failures.length) {
    fail('readiness is not a clean pass');
  }
  const checks = ready?.checks;
  if (!checks || Object.keys(checks).length < 6 || Object.values(checks).some((value) => value !== true)) {
    fail('readiness checks are incomplete or failing');
  }
  if (
    version?.release_sha !== expectedSha
    || version?.profession_id !== target.professionId
    || version?.profession_schema_version !== target.professionSchemaVersion
    || version?.app_id !== target.appId
    || version?.catalogue?.count !== catalogue.count
    || version?.catalogue?.expected_count !== catalogue.count
    || version?.catalogue?.checksum !== catalogue.checksum
    || version?.catalogue?.expected_checksum !== catalogue.checksum
    || version?.catalogue?.ready !== true
    || version?.database?.integrity !== 'ok'
    || version?.database?.schema_ready !== true
    || !/^sha256:[0-9a-f]{64}$/.test(version?.database?.migration_version || '')
    || version?.production_posture?.mode !== 'normal-production'
    || version?.production_posture?.ready !== true
    || version?.production_posture?.deployment_ready !== true
    || !/^sha256:[0-9a-f]{64}$/.test(version?.production_posture?.posture_sha256 || '')
  ) fail('version, catalogue, or database evidence differs');
  if (
    capabilities?.profession_id !== target.professionId
    || capabilities?.app_id !== target.appId
    || capabilities?.required_dependencies_ready !== true
    || capabilities?.production_posture_ready !== true
    || capabilities?.production_deployment_ready !== true
    || capabilities?.production_posture_mode !== 'normal-production'
  ) fail('capability identity or aggregate readiness differs');
  const required = [
    'general_clinical_llm',
    'physio_ai_tasks',
    'transcription',
    'document_extraction',
    'transactional_email',
    'payments',
  ];
  const deliberatelyDisabled = [];
  const capabilityRows = capabilities?.capabilities;
  if (!capabilityRows || JSON.stringify(Object.keys(capabilityRows).sort()) !==
    JSON.stringify([...required, ...deliberatelyDisabled].sort())) {
    fail('required capability set differs');
  }
  for (const name of required) {
    const row = capabilityRows[name];
    if (row?.enabled !== true || row?.required !== true || row?.ready !== true || row?.status !== 'ready') {
      fail(`required capability ${name} is not real-provider ready`);
    }
  }
  for (const name of deliberatelyDisabled) {
    const row = capabilityRows[name];
    if (row?.enabled !== false || row?.required !== false || row?.ready !== true || row?.status !== 'disabled') {
      fail(`capability ${name} is not deliberately disabled`);
    }
  }
  return Object.freeze({ releaseSha: expectedSha, ready: true });
}

export async function collectLoopbackRuntimeEvidence({
  fetchFn = globalThis.fetch,
  baseUrl = 'http://127.0.0.1:8787',
} = {}) {
  if (typeof fetchFn !== 'function') fail('loopback runtime fetch is unavailable');
  if (baseUrl !== 'http://127.0.0.1:8787') fail('loopback runtime origin differs');
  const endpoints = {
    live: '/api/health/live',
    ready: '/api/health/ready',
    version: '/api/version',
    capabilities: '/api/capabilities',
  };
  const evidence = {};
  for (const [name, pathname] of Object.entries(endpoints)) {
    const response = await fetchFn(`${baseUrl}${pathname}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (response?.status !== 200) fail(`loopback runtime ${name} returned ${response?.status ?? 'no status'}`);
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > 65_536) fail(`loopback runtime ${name} exceeds the evidence limit`);
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      fail(`loopback runtime ${name} is not JSON`);
    }
    evidence[name] = parsed;
  }
  return Object.freeze({
    contract_version: 'assesssuite-physio-loopback-runtime-evidence/1.0.0',
    origin: baseUrl,
    endpoints: Object.freeze(evidence),
    observed_at: new Date().toISOString(),
  });
}

const PHYSIO_DEPLOY_PACKET_BASE_FILES = Object.freeze([
  'SHA256SUMS',
  'deploy-admission.json',
  'deploy-effect-reconciliation.json',
  'deploy-provider-readback.json',
  'deploy-reviewed-config.toml',
]);

function readRegularExternalFile(filePath, label, maximumBytes) {
  const resolved = path.resolve(filePath);
  const before = fs.lstatSync(resolved);
  if (before.isSymbolicLink() || !before.isFile() || before.size <= 0 || before.size > maximumBytes) {
    fail(`${label} is not a bounded regular file`);
  }
  const descriptor = fs.openSync(resolved, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) {
      fail(`${label} changed during admission`);
    }
    const bytes = fs.readFileSync(descriptor);
    const after = fs.lstatSync(resolved);
    if (after.isSymbolicLink() || !after.isFile() || after.dev !== before.dev || after.ino !== before.ino ||
        after.size !== before.size || bytes.length !== opened.size) {
      fail(`${label} identity changed during admission`);
    }
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function readRegularDeployPacketFile(packetRoot, basename, maximumBytes) {
  if (!/^[A-Za-z0-9._-]+$/.test(basename) || path.basename(basename) !== basename) {
    fail(`deploy packet member ${basename} is not a basename`);
  }
  const filePath = path.join(packetRoot, basename);
  const before = fs.lstatSync(filePath);
  if (before.isSymbolicLink() || !before.isFile()) fail(`deploy packet member ${basename} is not a regular file`);
  if (before.size <= 0 || before.size > maximumBytes) fail(`deploy packet member ${basename} size differs`);
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) {
      fail(`deploy packet member ${basename} changed during admission`);
    }
    const bytes = fs.readFileSync(descriptor);
    const after = fs.lstatSync(filePath);
    if (after.isSymbolicLink() || !after.isFile() || after.dev !== before.dev || after.ino !== before.ino ||
        after.size !== before.size || bytes.length !== opened.size) {
      fail(`deploy packet member ${basename} identity changed during admission`);
    }
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function parseDeployJson(buffer, basename) {
  const text = buffer.toString('utf8');
  if (Buffer.from(text, 'utf8').compare(buffer) !== 0 || text.includes('\r') ||
      !text.endsWith('\n') || text.endsWith('\n\n')) {
    fail(`deploy packet member ${basename} is not canonical LF UTF-8 JSON`);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(`deploy packet member ${basename} is not JSON`);
  }
}

function deployPhaseBasename(packetOrdinal, phase, phaseRevision) {
  return `deploy-phase-${String(packetOrdinal).padStart(4, '0')}-${phase}-r${String(phaseRevision).padStart(2, '0')}.json`;
}

function deployReadbackBasename(packetOrdinal, phase, phaseRevision) {
  return `deploy-readback-${String(packetOrdinal).padStart(4, '0')}-${phase}-r${String(phaseRevision).padStart(2, '0')}.json`;
}

function readChecksummedDeployPacket(packetRoot) {
  const root = path.resolve(packetRoot);
  const rootStat = fs.lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) fail('deploy packet root differs');
  const entries = fs.readdirSync(root, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile() || entry.isSymbolicLink())) {
    fail('deploy packet must be flat and contain regular files only');
  }
  const effectPreview = readRegularDeployPacketFile(root, 'deploy-effect-reconciliation.json', 2_097_152);
  const preview = parseDeployJson(effectPreview, 'deploy-effect-reconciliation.json');
  const phaseOrdinal = PHYSIO_DEPLOY_PHASES.indexOf(preview?.phase);
  if (phaseOrdinal < 0 || preview?.phase_ordinal !== phaseOrdinal ||
      !Number.isSafeInteger(preview?.packet_ordinal) || preview.packet_ordinal < 0 || preview.packet_ordinal > 255 ||
      !Number.isSafeInteger(preview?.phase_revision) || preview.phase_revision < 0 || preview.phase_revision > 99) {
    fail('deploy packet current phase differs');
  }
  const phaseMembers = entries.map((entry) => entry.name).filter((name) => (
    /^deploy-(?:phase|readback)-[0-9]{4}-[A-Z_]+-r[0-9]{2}\.json$/.test(name)
  ));
  const ledger = [];
  const operationReceiptNames = [];
  for (let packetOrdinal = 0; packetOrdinal <= preview.packet_ordinal; packetOrdinal += 1) {
    const prefix = String(packetOrdinal).padStart(4, '0');
    const phaseMatches = phaseMembers.filter((name) => name.startsWith(`deploy-phase-${prefix}-`));
    const readbackMatches = phaseMembers.filter((name) => name.startsWith(`deploy-readback-${prefix}-`));
    if (phaseMatches.length !== 1 || readbackMatches.length !== 1) fail('deploy packet ledger membership differs');
    const match = phaseMatches[0].match(/^deploy-phase-[0-9]{4}-([A-Z_]+)-r([0-9]{2})\.json$/);
    if (!match) fail('deploy packet phase basename differs');
    const phase = match[1];
    const phaseRevision = Number(match[2]);
    const readbackName = deployReadbackBasename(packetOrdinal, phase, phaseRevision);
    if (readbackMatches[0] !== readbackName || !PHYSIO_DEPLOY_PHASES.includes(phase)) {
      fail('deploy packet readback basename differs');
    }
    ledger.push(Object.freeze({
      packetOrdinal,
      phase,
      phaseOrdinal: PHYSIO_DEPLOY_PHASES.indexOf(phase),
      phaseRevision,
      phaseName: phaseMatches[0],
      readbackName,
    }));
    const readbackPreview = parseDeployJson(
      readRegularDeployPacketFile(root, readbackName, 2_097_152),
      readbackName,
    );
    if (readbackPreview?.operation_receipt_sha256 !== null) {
      operationReceiptNames.push(`deploy-operation-receipt-${prefix}.bin`);
    }
  }
  const current = ledger.at(-1);
  if (current.phase !== preview.phase || current.phaseOrdinal !== phaseOrdinal ||
      current.phaseRevision !== preview.phase_revision) fail('deploy current packet ledger alias differs');
  const expectedFiles = [
    ...PHYSIO_DEPLOY_PACKET_BASE_FILES,
    ...ledger.flatMap((row) => [row.phaseName, row.readbackName]),
    ...operationReceiptNames,
  ].sort();
  const actualNames = entries.map((entry) => entry.name).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedFiles)) fail('deploy packet file set differs');
  const buffers = new Map();
  for (const basename of expectedFiles) {
    const maximum = basename === 'deploy-reviewed-config.toml' ? 65_536 : 2_097_152;
    buffers.set(basename, readRegularDeployPacketFile(root, basename, maximum));
  }
  const sums = buffers.get('SHA256SUMS').toString('utf8');
  if (sums.includes('\r') || !sums.endsWith('\n') || sums.endsWith('\n\n')) {
    fail('deploy SHA256SUMS is not canonical LF text');
  }
  const payloadNames = expectedFiles.filter((name) => name !== 'SHA256SUMS').sort();
  const rows = sums.trimEnd().split('\n').map((row) => {
    const match = row.match(/^([0-9a-f]{64})  ([A-Za-z0-9._-]+)$/);
    if (!match || path.basename(match[2]) !== match[2]) fail('deploy SHA256SUMS row differs');
    return { digest: match[1], basename: match[2] };
  });
  if (JSON.stringify(rows.map((row) => row.basename)) !== JSON.stringify(payloadNames) ||
      new Set(rows.map((row) => row.basename)).size !== rows.length) {
    fail('deploy SHA256SUMS membership or bytewise ordering differs');
  }
  for (const row of rows) {
    if (sha256(buffers.get(row.basename)) !== row.digest) {
      fail(`deploy packet member ${row.basename} checksum differs`);
    }
  }
  for (const entry of ledger) {
    const readback = parseDeployJson(buffers.get(entry.readbackName), entry.readbackName);
    const receiptName = `deploy-operation-receipt-${String(entry.packetOrdinal).padStart(4, '0')}.bin`;
    if (readback.operation_receipt_sha256 !== null &&
        sha256(buffers.get(receiptName)) !== readback.operation_receipt_sha256) {
      fail(`deploy operation receipt ${entry.packetOrdinal} hash differs`);
    }
  }
  return Object.freeze({ root, buffers, phaseOrdinal, packetOrdinal: preview.packet_ordinal, ledger });
}

function validateDeployAdmission(row, configBytes, options) {
  exactKeys(row, [
    'admitted_at', 'application', 'application_sha', 'authority_reference', 'bootstrap_receipt_sha256',
    'bootstrap_authority_reference', 'bootstrap_capability_intent_id', 'canary_receipt_sha256',
    'canary_authority_reference', 'canary_capability_intent_id',
    'capability_intent_id', 'config_sha256', 'contract_version',
    'expected_volume_id', 'immutable_image', 'publication_receipt_sha256', 'result',
    'publication_authority_reference', 'publication_capability_intent_id',
    'sentry_authority_reference', 'sentry_capability_intent_id', 'sentry_release_receipt_sha256',
    'stripe_webhook_authority_reference', 'stripe_webhook_capability_intent_id',
    'stripe_webhook_receipt_sha256',
    'upstream_artifact_metadata_sha256',
  ], 'deploy admission');
  if (row.contract_version !== 'assesssuite-physio-deploy-admission/2.0.0' || row.result !== 'PASS' ||
      row.application !== PHYSIO_RELEASE_TARGET.app || row.application_sha !== options.applicationSha ||
      row.immutable_image !== options.immutableImage || row.expected_volume_id !== options.expectedVolumeId ||
      row.publication_receipt_sha256 !== options.publicationReceiptSha256 ||
      row.canary_receipt_sha256 !== options.canaryReceiptSha256 ||
      row.bootstrap_receipt_sha256 !== options.bootstrapReceiptSha256 ||
      row.stripe_webhook_receipt_sha256 !== options.stripeWebhookReceiptSha256 ||
      row.sentry_release_receipt_sha256 !== options.sentryReleaseReceiptSha256 ||
      row.config_sha256 !== options.configSha256 || row.config_sha256 !== sha256(configBytes) ||
      row.upstream_artifact_metadata_sha256 !== options.upstreamArtifactMetadataSha256 ||
      row.capability_intent_id !== options.capabilityIntentId || row.authority_reference !== options.authorityReference ||
      row.publication_capability_intent_id !== options.publicationCapabilityIntentId ||
      row.publication_authority_reference !== options.publicationAuthorityReference ||
      row.bootstrap_capability_intent_id !== options.bootstrapCapabilityIntentId ||
      row.bootstrap_authority_reference !== options.bootstrapAuthorityReference ||
      row.canary_capability_intent_id !== options.canaryCapabilityIntentId ||
      row.canary_authority_reference !== options.canaryAuthorityReference ||
      row.stripe_webhook_capability_intent_id !== options.stripeWebhookCapabilityIntentId ||
      row.stripe_webhook_authority_reference !== options.stripeWebhookAuthorityReference ||
      row.sentry_capability_intent_id !== options.sentryCapabilityIntentId ||
      row.sentry_authority_reference !== options.sentryAuthorityReference ||
      !Number.isFinite(Date.parse(row.admitted_at || ''))) {
    fail('deploy admission identity differs');
  }
  const config = configBytes.toString('utf8');
  if (Buffer.from(config, 'utf8').compare(configBytes) !== 0 || config.includes('\r') ||
      !config.endsWith('\n') || config.endsWith('\n\n')) {
    fail('deploy reviewed config is not canonical LF UTF-8');
  }
}

function validateDeployProviderReadback(row, phase) {
  exactKeys(row, [
    'application', 'contract_version', 'machine_count', 'machines_sha256', 'observed_config_sha256',
    'observed_config_without_restart_sha256',
    'observed_image', 'observed_machine_id', 'observed_machine_ids', 'observed_machine_state',
    'observed_machine_events_sha256', 'observed_machine_instance_id', 'observed_machine_updated_at',
    'observed_postdeploy_snapshot_id',
    'observed_predeploy_snapshot_id', 'observed_restore_volume_id', 'observed_sentry_deployment_id_sha256',
    'observed_snapshot_ids', 'observed_verifier_machine_id', 'observed_verifier_machine_state',
    'observed_restart_intent_sha256',
    'observed_volume_id', 'observed_volume_ids', 'operation_disposition', 'operation_effect_id',
    'operation_kind', 'operation_provider_request_id_sha256', 'operation_receipt_sha256',
    'operation_request_sha256', 'operation_resource_id',
    'phase', 'readback_at', 'result',
    'runtime_capabilities_sha256', 'runtime_live_sha256', 'runtime_ready_sha256',
    'runtime_version_sha256', 'snapshot_count', 'snapshots_sha256', 'volume_count', 'volumes_sha256',
  ], 'deploy provider readback');
  const hashes = [row.machines_sha256, row.volumes_sha256, row.snapshots_sha256, row.observed_config_sha256,
    row.observed_config_without_restart_sha256, row.observed_machine_events_sha256];
  const optionalHashes = [
    row.observed_sentry_deployment_id_sha256, row.observed_restart_intent_sha256, row.runtime_capabilities_sha256,
    row.runtime_live_sha256, row.runtime_ready_sha256, row.runtime_version_sha256,
  ];
  if (row.contract_version !== 'assesssuite-physio-deploy-provider-readback/1.0.0' ||
      !['NOT_OBSERVED', 'PASS', 'STARTED_UNRESOLVED'].includes(row.result) ||
      row.application !== PHYSIO_RELEASE_TARGET.app || row.phase !== phase ||
      ![row.machine_count, row.volume_count, row.snapshot_count]
        .every((value) => Number.isSafeInteger(value) && value >= 0) ||
      !hashes.every((value) => /^[0-9a-f]{64}$/.test(value || '')) ||
      !optionalHashes.every((value) => value === null || /^[0-9a-f]{64}$/.test(value)) ||
      !(row.observed_machine_id === null || /^[0-9a-f]{14,32}$/i.test(row.observed_machine_id)) ||
      !(row.observed_machine_instance_id === null ||
        (typeof row.observed_machine_instance_id === 'string' && row.observed_machine_instance_id.length >= 1 &&
         row.observed_machine_instance_id.length <= 160 && !/[\r\n\0]/.test(row.observed_machine_instance_id))) ||
      !(row.observed_machine_updated_at === null || Number.isFinite(Date.parse(row.observed_machine_updated_at || ''))) ||
      !(row.observed_verifier_machine_id === null || /^[0-9a-f]{14,32}$/i.test(row.observed_verifier_machine_id)) ||
      ![row.observed_volume_id, row.observed_restore_volume_id]
        .every((value) => value === null || /^vol_[A-Za-z0-9]+$/.test(value)) ||
      ![row.observed_predeploy_snapshot_id, row.observed_postdeploy_snapshot_id]
        .every((value) => value === null || /^[A-Za-z0-9_-]{6,160}$/.test(value)) ||
      !(row.observed_machine_state === null || ['started', 'stopped'].includes(row.observed_machine_state)) ||
      !(row.observed_verifier_machine_state === null || ['started', 'stopped'].includes(row.observed_verifier_machine_state)) ||
      !(row.observed_image === null || IMAGE_PATTERN.test(row.observed_image)) ||
      !(row.operation_kind === null || PHYSIO_DEPLOY_PROVIDER_SUBEFFECT_KINDS.includes(row.operation_kind)) ||
      !(row.operation_effect_id === null || /^[A-Za-z0-9._:-]{1,200}$/.test(row.operation_effect_id)) ||
      !(row.operation_request_sha256 === null || /^[0-9a-f]{64}$/.test(row.operation_request_sha256)) ||
      !(row.operation_resource_id === null || /^[A-Za-z0-9._:@/-]{1,240}$/.test(row.operation_resource_id)) ||
      !(row.operation_provider_request_id_sha256 === null ||
        /^[0-9a-f]{64}$/.test(row.operation_provider_request_id_sha256)) ||
      !(row.operation_receipt_sha256 === null || /^[0-9a-f]{64}$/.test(row.operation_receipt_sha256)) ||
      !['NONE', 'PRESTATE', 'APPLIED', 'NOT_APPLIED', 'AMBIGUOUS', 'READ_ONLY_RETRY']
        .includes(row.operation_disposition) ||
      !Number.isFinite(Date.parse(row.readback_at || ''))) {
    fail('deploy provider readback differs');
  }
  const inventories = [
    [row.observed_machine_ids, row.machine_count, /^[0-9a-f]{14,32}$/i, 'machine'],
    [row.observed_volume_ids, row.volume_count, /^vol_[A-Za-z0-9]+$/, 'volume'],
    [row.observed_snapshot_ids, row.snapshot_count, /^[A-Za-z0-9_-]{6,160}$/, 'snapshot'],
  ];
  for (const [values, count, pattern, label] of inventories) {
    if (!Array.isArray(values) || values.length !== count ||
        values.some((value) => typeof value !== 'string' || !pattern.test(value)) ||
        JSON.stringify(values) !== JSON.stringify([...new Set(values)].sort())) {
      fail(`deploy provider readback ${label} inventory differs`);
    }
  }
  if (row.operation_disposition === 'NONE') {
    if ([row.operation_kind, row.operation_effect_id, row.operation_request_sha256,
      row.operation_resource_id, row.operation_provider_request_id_sha256,
      row.operation_receipt_sha256].some((value) => value !== null)) {
      fail('deploy provider readback NONE operation differs');
    }
  } else if (!row.operation_kind || !row.operation_effect_id || !row.operation_request_sha256) {
    fail('deploy provider readback operation identity differs');
  }
  return row;
}

function deploySubeffectEventSha256(row) {
  return sha256(Buffer.from(`${canonicalJson(row)}\n`, 'utf8'));
}

function validateDeployProviderSubeffects(events) {
  if (!Array.isArray(events) || events.length > 256) fail('deploy provider subeffect ledger differs');
  let predecessor = '0'.repeat(64);
  let nextEffectOrdinal = 0;
  let pending = null;
  let unresolved = null;
  let retryPermitted = null;
  const seenEffectIds = new Set();
  for (let index = 0; index < events.length; index += 1) {
    const row = events[index];
    exactKeys(row, [
      'attempt_ordinal', 'completed_at', 'effect_id', 'effect_ordinal', 'event_ordinal', 'intended_resource_id', 'kind',
      'observed_resource_id', 'predecessor_event_sha256', 'prestate_sha256', 'provider_exit_code',
      'provider_readback_sha256', 'provider_request_id_sha256', 'request_sha256', 'started_at', 'state',
    ], `deploy provider subeffect event ${index}`);
    if (row.event_ordinal !== index || row.predecessor_event_sha256 !== predecessor ||
        !Number.isSafeInteger(row.attempt_ordinal) || row.attempt_ordinal < 0 || row.attempt_ordinal > 32 ||
        !PHYSIO_DEPLOY_PROVIDER_SUBEFFECT_KINDS.includes(row.kind) ||
        !/^[A-Za-z0-9._:-]{1,200}$/.test(row.effect_id || '') ||
        !/^[0-9a-f]{64}$/.test(row.request_sha256 || '') || !/^[0-9a-f]{64}$/.test(row.prestate_sha256 || '') ||
        !(row.intended_resource_id === null || /^[A-Za-z0-9._:@/-]{1,240}$/.test(row.intended_resource_id)) ||
        !(row.observed_resource_id === null || /^[A-Za-z0-9._:@/-]{1,240}$/.test(row.observed_resource_id)) ||
        !Number.isFinite(Date.parse(row.started_at || ''))) {
      fail(`deploy provider subeffect event ${index} differs`);
    }
    if (row.state === 'STARTED') {
      if (pending || unresolved || retryPermitted || row.attempt_ordinal !== 0 ||
          row.effect_ordinal !== nextEffectOrdinal || seenEffectIds.has(row.effect_id) ||
          row.observed_resource_id !== null || row.provider_exit_code !== null ||
          row.provider_request_id_sha256 !== null || row.provider_readback_sha256 !== null ||
          row.completed_at !== null) {
        fail(`deploy provider subeffect STARTED event ${index} differs`);
      }
      seenEffectIds.add(row.effect_id);
      pending = row;
      nextEffectOrdinal += 1;
    } else if (row.state === 'RETRY_STARTED') {
      if (pending || unresolved || !retryPermitted ||
          row.effect_ordinal !== retryPermitted.effect_ordinal || row.kind !== retryPermitted.kind ||
          row.effect_id !== retryPermitted.effect_id || row.request_sha256 !== retryPermitted.request_sha256 ||
          row.intended_resource_id !== retryPermitted.intended_resource_id ||
          row.attempt_ordinal !== retryPermitted.attempt_ordinal + 1 ||
          row.observed_resource_id !== null || row.provider_exit_code !== null ||
          row.provider_request_id_sha256 !== null || row.provider_readback_sha256 !== null ||
          row.completed_at !== null) {
        fail(`deploy provider subeffect RETRY_STARTED event ${index} differs`);
      }
      pending = row;
      retryPermitted = null;
    } else if (row.state === 'COMPLETED' || row.state === 'STARTED_UNRESOLVED') {
      if (!pending || unresolved || row.effect_ordinal !== pending.effect_ordinal || row.kind !== pending.kind ||
          row.effect_id !== pending.effect_id || row.request_sha256 !== pending.request_sha256 ||
          row.prestate_sha256 !== pending.prestate_sha256 ||
          row.intended_resource_id !== pending.intended_resource_id || row.started_at !== pending.started_at ||
          row.attempt_ordinal !== pending.attempt_ordinal ||
          !Number.isSafeInteger(row.provider_exit_code) || row.provider_exit_code < 0 || row.provider_exit_code > 255 ||
          !(row.provider_request_id_sha256 === null || /^[0-9a-f]{64}$/.test(row.provider_request_id_sha256)) ||
          !/^[0-9a-f]{64}$/.test(row.provider_readback_sha256 || '') ||
          !Number.isFinite(Date.parse(row.completed_at || ''))) {
        fail(`deploy provider subeffect terminal event ${index} differs`);
      }
      pending = null;
      unresolved = row.state === 'STARTED_UNRESOLVED' ? row : null;
    } else if (row.state === 'RECONCILED_COMPLETED' || row.state === 'RECONCILED_NOT_APPLIED') {
      if (!unresolved || pending || row.effect_ordinal !== unresolved.effect_ordinal ||
          row.kind !== unresolved.kind || row.effect_id !== unresolved.effect_id ||
          row.request_sha256 !== unresolved.request_sha256 || row.prestate_sha256 !== unresolved.prestate_sha256 ||
          row.intended_resource_id !== unresolved.intended_resource_id || row.started_at !== unresolved.started_at ||
          row.attempt_ordinal !== unresolved.attempt_ordinal ||
          row.provider_exit_code !== unresolved.provider_exit_code ||
          !(row.observed_resource_id === null || /^[A-Za-z0-9._:@/-]{1,240}$/.test(row.observed_resource_id)) ||
          !(row.provider_request_id_sha256 === null || /^[0-9a-f]{64}$/.test(row.provider_request_id_sha256)) ||
          !/^[0-9a-f]{64}$/.test(row.provider_readback_sha256 || '') ||
          !Number.isFinite(Date.parse(row.completed_at || ''))) {
        fail(`deploy provider subeffect reconciliation event ${index} differs`);
      }
      retryPermitted = row.state === 'RECONCILED_NOT_APPLIED' ? row : null;
      unresolved = null;
    } else {
      fail(`deploy provider subeffect state ${index} differs`);
    }
    predecessor = deploySubeffectEventSha256(row);
  }
  return Object.freeze({
    providerCallsAttempted: events.filter((row) => (
      row.state === 'COMPLETED' || row.state === 'STARTED_UNRESOLVED'
    )).length,
    providerCallsConfirmed: events.filter((row) => (
      row.state === 'COMPLETED' || row.state === 'RECONCILED_COMPLETED'
    )).length,
    pending,
    unresolved,
    retryPermitted,
    chainSha256: sha256(Buffer.from(`${canonicalJson(events)}\n`, 'utf8')),
  });
}

function validateDeployProviderRequests(requests, events, options) {
  const startedEvents = events.filter((row) => row.state === 'STARTED');
  if (!Array.isArray(requests) || requests.length !== startedEvents.length) {
    fail('deploy provider request manifest count differs');
  }
  for (let index = 0; index < requests.length; index += 1) {
    const row = requests[index];
    const event = startedEvents[index];
    exactKeys(row, [
      'application', 'application_sha', 'argv_sha256', 'config_sha256', 'effect_id',
      'effect_ordinal', 'expected_volume_id', 'immutable_image', 'intended_resource_id', 'kind',
    ], `deploy provider request manifest ${index}`);
    const requestSha256 = sha256(Buffer.from(`${canonicalJson(row)}\n`, 'utf8'));
    if (row.effect_ordinal !== index || row.effect_ordinal !== event.effect_ordinal ||
        row.kind !== event.kind || row.effect_id !== event.effect_id || row.application !== PHYSIO_RELEASE_TARGET.app ||
        row.application_sha !== options.applicationSha || row.immutable_image !== options.immutableImage ||
        row.expected_volume_id !== options.expectedVolumeId || row.config_sha256 !== options.configSha256 ||
        row.intended_resource_id !== event.intended_resource_id ||
        !/^[0-9a-f]{64}$/.test(row.argv_sha256 || '') || event.request_sha256 !== requestSha256) {
      fail(`deploy provider request manifest ${index} differs`);
    }
  }
  for (const row of events.filter((event) => event.state === 'RETRY_STARTED')) {
    const request = requests[row.effect_ordinal];
    if (!request || request.effect_id !== row.effect_id || request.kind !== row.kind ||
        sha256(Buffer.from(`${canonicalJson(request)}\n`, 'utf8')) !== row.request_sha256) {
      fail(`deploy provider retry request manifest ${row.effect_ordinal} differs`);
    }
  }
  return requests;
}

function equalProviderInventory(left, right, keys) {
  return keys.every((key) => JSON.stringify(left?.[key]) === JSON.stringify(right?.[key]));
}

function validateDeployOperationDisposition(event, provider, readbackBySha256, options) {
  const expectedDisposition = {
    STARTED: 'PRESTATE',
    RETRY_STARTED: 'NOT_APPLIED',
    COMPLETED: 'APPLIED',
    STARTED_UNRESOLVED: 'AMBIGUOUS',
    RECONCILED_COMPLETED: 'APPLIED',
    RECONCILED_NOT_APPLIED: 'NOT_APPLIED',
  }[event.state];
  if (!expectedDisposition || provider.operation_disposition !== expectedDisposition ||
      provider.operation_kind !== event.kind || provider.operation_effect_id !== event.effect_id ||
      provider.operation_request_sha256 !== event.request_sha256 ||
      provider.operation_provider_request_id_sha256 !== event.provider_request_id_sha256) {
    fail(`deploy ${event.kind} ${event.state} provider operation binding differs`);
  }
  const expectedResource = event.state === 'STARTED' || event.state === 'RETRY_STARTED'
    ? event.intended_resource_id
    : event.observed_resource_id ?? event.intended_resource_id;
  if (provider.operation_resource_id !== expectedResource) {
    fail(`deploy ${event.kind} provider operation resource differs`);
  }
  if (event.state === 'STARTED' || event.state === 'RETRY_STARTED') {
    if (event.prestate_sha256 !== provider.__raw_sha256) {
      fail(`deploy ${event.kind} STARTED prestate raw hash differs`);
    }
    return;
  }
  if (event.provider_readback_sha256 !== provider.__raw_sha256) {
    fail(`deploy ${event.kind} terminal raw readback hash differs`);
  }
  if (event.state === 'STARTED_UNRESOLVED') return;
  const prestate = readbackBySha256.get(event.prestate_sha256);
  if (!prestate) fail(`deploy ${event.kind} prestate readback is absent from the packet chain`);
  if (event.state === 'RECONCILED_NOT_APPLIED') {
    const inventoryKeys = {
      PREDEPLOY_SNAPSHOT_CREATE: ['observed_snapshot_ids', 'snapshots_sha256'],
      LIVE_DEPLOY: ['observed_machine_ids', 'observed_volume_ids', 'machines_sha256', 'volumes_sha256'],
      PRESNAPSHOT_MANIFEST_EXEC: ['observed_machine_ids', 'machines_sha256'],
      PRODUCTION_MACHINE_STOP: ['observed_machine_ids', 'machines_sha256'],
      POSTDEPLOY_SNAPSHOT_CREATE: ['observed_snapshot_ids', 'snapshots_sha256'],
      RESTORE_VOLUME_CREATE: ['observed_volume_ids', 'volumes_sha256'],
      RESTORE_VERIFIER_MACHINE_CREATE: ['observed_machine_ids', 'machines_sha256'],
      RESTORE_VERIFIER_EXEC: ['observed_machine_ids', 'machines_sha256'],
      RESTORE_VERIFIER_MACHINE_STOP: ['observed_machine_ids', 'machines_sha256'],
      RESTORE_VERIFIER_MACHINE_DESTROY: ['observed_machine_ids', 'machines_sha256'],
      RESTORE_VOLUME_DESTROY: ['observed_volume_ids', 'volumes_sha256'],
      PRODUCTION_MACHINE_START: ['observed_machine_ids', 'machines_sha256'],
      PRODUCTION_MACHINE_RESTART: ['observed_machine_ids', 'machines_sha256', 'operation_receipt_sha256'],
      SENTRY_DEPLOYMENT_ASSOCIATE: ['observed_sentry_deployment_id_sha256'],
    }[event.kind];
    if (!inventoryKeys || !equalProviderInventory(provider, prestate, inventoryKeys)) {
      fail(`deploy ${event.kind} NOT_APPLIED readback does not equal its exact prestate`);
    }
    return;
  }
  const hashRequired = () => {
    if (!/^[0-9a-f]{64}$/.test(provider.operation_receipt_sha256 || '')) {
      fail(`deploy ${event.kind} applied receipt hash differs`);
    }
  };
  switch (event.kind) {
    case 'PREDEPLOY_SNAPSHOT_CREATE':
      if (!provider.observed_predeploy_snapshot_id ||
          provider.observed_predeploy_snapshot_id !== event.observed_resource_id ||
          !provider.observed_snapshot_ids.includes(event.observed_resource_id)) {
        fail('deploy predeploy snapshot applied readback differs');
      }
      break;
    case 'LIVE_DEPLOY':
      if (provider.machine_count !== 1 || provider.volume_count !== 1 ||
          provider.observed_image !== options.immutableImage ||
          provider.observed_volume_id !== options.expectedVolumeId ||
          !/^[0-9a-f]{64}$/.test(provider.observed_config_sha256 || '')) {
        fail('deploy live mutation applied readback differs');
      }
      break;
    case 'PRESNAPSHOT_MANIFEST_EXEC':
    case 'RESTORE_VERIFIER_EXEC':
      hashRequired();
      break;
    case 'PRODUCTION_MACHINE_STOP':
      if (provider.observed_machine_state !== 'stopped') fail('deploy machine-stop readback differs');
      break;
    case 'POSTDEPLOY_SNAPSHOT_CREATE':
      if (!provider.observed_postdeploy_snapshot_id ||
          provider.observed_postdeploy_snapshot_id !== event.observed_resource_id ||
          !provider.observed_snapshot_ids.includes(event.observed_resource_id)) {
        fail('deploy postdeploy snapshot applied readback differs');
      }
      break;
    case 'RESTORE_VOLUME_CREATE':
      if (provider.observed_restore_volume_id !== event.observed_resource_id ||
          !provider.observed_volume_ids.includes(event.observed_resource_id)) {
        fail('deploy restore-volume create readback differs');
      }
      break;
    case 'RESTORE_VERIFIER_MACHINE_CREATE':
      if (provider.observed_verifier_machine_id !== event.observed_resource_id ||
          provider.observed_verifier_machine_state !== 'started' ||
          !provider.observed_machine_ids.includes(event.observed_resource_id)) {
        fail('deploy verifier-machine create readback differs');
      }
      break;
    case 'RESTORE_VERIFIER_MACHINE_STOP':
      if (provider.observed_verifier_machine_id !== event.observed_resource_id ||
          provider.observed_verifier_machine_state !== 'stopped') {
        fail('deploy verifier-machine stop readback differs');
      }
      break;
    case 'RESTORE_VERIFIER_MACHINE_DESTROY':
      if (provider.observed_verifier_machine_id !== null ||
          provider.observed_machine_ids.includes(event.observed_resource_id)) {
        fail('deploy verifier-machine destroy absence readback differs');
      }
      break;
    case 'RESTORE_VOLUME_DESTROY':
      if (provider.observed_restore_volume_id !== null ||
          provider.observed_volume_ids.includes(event.observed_resource_id)) {
        fail('deploy restore-volume destroy absence readback differs');
      }
      break;
    case 'PRODUCTION_MACHINE_START':
      if (provider.observed_machine_state !== 'started') fail('deploy machine-start readback differs');
      break;
    case 'PRODUCTION_MACHINE_RESTART':
      {
      const expected = restartIntentFromPrestate({ prestate, applicationSha: options.applicationSha,
        effectId: event.effect_id, machineId: event.intended_resource_id });
      const restartAdvanced = provider.observed_machine_instance_id !== prestate.observed_machine_instance_id ||
        Date.parse(provider.observed_machine_updated_at || '') > Date.parse(prestate.observed_machine_updated_at || '');
      if (provider.machine_count !== 1 || provider.observed_machine_id !== prestate.observed_machine_id ||
          provider.observed_machine_state !== 'started' || provider.observed_image !== options.immutableImage ||
          provider.observed_volume_id !== options.expectedVolumeId ||
          provider.observed_config_without_restart_sha256 !== prestate.observed_config_without_restart_sha256 ||
          provider.observed_restart_intent_sha256 !== expected.restart_intent_sha256 ||
          !restartAdvanced || provider.observed_machine_events_sha256 === prestate.observed_machine_events_sha256 ||
          ![provider.runtime_live_sha256, provider.runtime_ready_sha256, provider.runtime_version_sha256,
            provider.runtime_capabilities_sha256].every((value) => /^[0-9a-f]{64}$/.test(value || ''))) {
        fail('deploy machine-restart readback differs');
      }
      hashRequired();
      break;
      }
    case 'SENTRY_DEPLOYMENT_ASSOCIATE':
      if (!provider.observed_sentry_deployment_id_sha256) fail('deploy Sentry association readback differs');
      hashRequired();
      break;
    default:
      fail(`deploy provider kind ${event.kind} lacks an applied-readback predicate`);
  }
}

function validateDeployEffectRow(effect, provider, options, context) {
  exactKeys(effect, [
    'application', 'application_sha', 'authority_reference', 'bootstrap_receipt_sha256',
    'bootstrap_authority_reference', 'bootstrap_capability_intent_id', 'canary_receipt_sha256',
    'canary_authority_reference', 'canary_capability_intent_id',
    'capability_intent_id', 'completed_at', 'config_sha256',
    'contract_version', 'expected_volume_id', 'immutable_image', 'phase', 'phase_ordinal',
    'packet_ordinal', 'phase_revision', 'predecessor_phase_receipt_sha256',
    'provider_calls_attempted', 'provider_calls_confirmed', 'provider_readback_sha256',
    'provider_subeffect_chain_sha256', 'provider_subeffect_requests', 'provider_subeffects',
    'publication_authority_reference', 'publication_capability_intent_id', 'publication_receipt_sha256',
    'result', 'sentry_authority_reference', 'sentry_capability_intent_id',
    'sentry_release_receipt_sha256', 'started_at', 'stripe_webhook_authority_reference',
    'stripe_webhook_capability_intent_id', 'stripe_webhook_receipt_sha256',
    'upstream_artifact_metadata_sha256',
  ], `deploy effect phase ${context.ordinal}`);
  const subeffects = validateDeployProviderSubeffects(effect.provider_subeffects);
  const requests = validateDeployProviderRequests(effect.provider_subeffect_requests, effect.provider_subeffects, options);
  const expectedProviderResult = effect.result === 'STARTED_UNRESOLVED'
    ? 'STARTED_UNRESOLVED'
    : effect.result === 'COMPLETED' ? 'PASS' : null;
  if (effect.contract_version !== PHYSIO_DEPLOY_EFFECT_RECONCILIATION_CONTRACT_VERSION ||
      !['STARTED', 'COMPLETED', 'STARTED_UNRESOLVED'].includes(effect.result) ||
      effect.phase !== PHYSIO_DEPLOY_PHASES[context.ordinal] || effect.phase_ordinal !== context.ordinal ||
      effect.packet_ordinal !== context.packetOrdinal || effect.phase_revision !== context.phaseRevision ||
      effect.application !== PHYSIO_RELEASE_TARGET.app || effect.application_sha !== options.applicationSha ||
      effect.immutable_image !== options.immutableImage || effect.expected_volume_id !== options.expectedVolumeId ||
      effect.publication_receipt_sha256 !== options.publicationReceiptSha256 ||
      effect.canary_receipt_sha256 !== options.canaryReceiptSha256 ||
      effect.bootstrap_receipt_sha256 !== options.bootstrapReceiptSha256 ||
      effect.stripe_webhook_receipt_sha256 !== options.stripeWebhookReceiptSha256 ||
      effect.sentry_release_receipt_sha256 !== options.sentryReleaseReceiptSha256 ||
      effect.config_sha256 !== options.configSha256 ||
      effect.upstream_artifact_metadata_sha256 !== options.upstreamArtifactMetadataSha256 ||
      effect.capability_intent_id !== options.capabilityIntentId || effect.authority_reference !== options.authorityReference ||
      effect.publication_capability_intent_id !== options.publicationCapabilityIntentId ||
      effect.publication_authority_reference !== options.publicationAuthorityReference ||
      effect.bootstrap_capability_intent_id !== options.bootstrapCapabilityIntentId ||
      effect.bootstrap_authority_reference !== options.bootstrapAuthorityReference ||
      effect.canary_capability_intent_id !== options.canaryCapabilityIntentId ||
      effect.canary_authority_reference !== options.canaryAuthorityReference ||
      effect.stripe_webhook_capability_intent_id !== options.stripeWebhookCapabilityIntentId ||
      effect.stripe_webhook_authority_reference !== options.stripeWebhookAuthorityReference ||
      effect.sentry_capability_intent_id !== options.sentryCapabilityIntentId ||
      effect.sentry_authority_reference !== options.sentryAuthorityReference ||
      effect.predecessor_phase_receipt_sha256 !== context.expectedPredecessorSha256 ||
      effect.provider_readback_sha256 !== context.providerReadbackSha256 ||
      effect.provider_subeffect_chain_sha256 !== subeffects.chainSha256 ||
      effect.provider_calls_attempted !== subeffects.providerCallsAttempted ||
      effect.provider_calls_confirmed !== subeffects.providerCallsConfirmed ||
      effect.provider_calls_confirmed > effect.provider_calls_attempted ||
      (expectedProviderResult !== null && provider.result !== expectedProviderResult) ||
      (effect.result === 'STARTED' && !['NOT_OBSERVED', 'PASS'].includes(provider.result)) ||
      !Number.isFinite(Date.parse(effect.started_at || '')) ||
      (effect.result === 'STARTED' && effect.completed_at !== null) ||
      (effect.result !== 'STARTED' && !Number.isFinite(Date.parse(effect.completed_at || '')))) {
    fail(`deploy effect reconciliation phase ${context.ordinal} differs`);
  }
  const priorEvents = context.previousProviderSubeffects;
  const priorRequests = context.previousProviderRequests;
  if (JSON.stringify(effect.provider_subeffects.slice(0, priorEvents.length)) !== JSON.stringify(priorEvents)) {
    fail(`deploy provider subeffect prefix differs at phase ${context.ordinal}`);
  }
  if (JSON.stringify(requests.slice(0, priorRequests.length)) !== JSON.stringify(priorRequests)) {
    fail(`deploy provider request prefix differs at phase ${context.ordinal}`);
  }
  const newEvents = effect.provider_subeffects.slice(priorEvents.length);
  if (newEvents.length === 0 && !['DEPLOY_COMPLETED', 'COMPLETED'].includes(effect.phase)) {
    fail(`deploy phase ${context.ordinal} lacks a provider-ledger transition`);
  }
  for (const event of newEvents) {
    validateDeployOperationDisposition(event, provider, context.readbackBySha256, options);
  }
  if (effect.result === 'STARTED_UNRESOLVED' && !subeffects.unresolved) {
    fail('deploy unresolved phase lacks an unresolved provider subeffect');
  }
  if (effect.result === 'STARTED' && !subeffects.pending) {
    fail('deploy STARTED phase lacks a pending provider subeffect');
  }
  if (effect.result === 'COMPLETED' && (subeffects.pending || subeffects.unresolved || subeffects.retryPermitted)) {
    fail('deploy completed phase contains an unterminated provider subeffect');
  }
  const completedKinds = new Set(effect.provider_subeffects
    .filter((row) => row.state === 'COMPLETED' || row.state === 'RECONCILED_COMPLETED')
    .map((row) => row.kind));
  if (effect.phase === 'SNAPSHOT_COMPLETED' && effect.result === 'COMPLETED' &&
      (!completedKinds.has('PREDEPLOY_SNAPSHOT_CREATE') || !provider.observed_predeploy_snapshot_id)) {
    fail('deploy snapshot phase lacks exact snapshot completion');
  }
  if (effect.phase === 'LIVE_MUTATION_STARTED' && effect.result === 'STARTED' &&
      (!subeffects.pending || subeffects.pending.kind !== 'LIVE_DEPLOY')) {
    fail('deploy live mutation STARTED lacks the exact pending deploy subeffect');
  }
  const successfulFlyKinds = [
    'LIVE_DEPLOY', 'PRESNAPSHOT_MANIFEST_EXEC', 'PRODUCTION_MACHINE_STOP',
    'POSTDEPLOY_SNAPSHOT_CREATE', 'RESTORE_VOLUME_CREATE', 'RESTORE_VERIFIER_MACHINE_CREATE',
    'RESTORE_VERIFIER_EXEC', 'RESTORE_VERIFIER_MACHINE_STOP', 'RESTORE_VERIFIER_MACHINE_DESTROY',
    'RESTORE_VOLUME_DESTROY', 'PRODUCTION_MACHINE_START', 'PRODUCTION_MACHINE_RESTART',
  ];
  if (['POST_RESTART_VERIFIED', 'DEPLOY_COMPLETED', 'SENTRY_ASSOCIATION_STARTED', 'COMPLETED'].includes(effect.phase) &&
      effect.result === 'COMPLETED' && successfulFlyKinds.some((kind) => !completedKinds.has(kind))) {
    fail('deploy post-restart phase lacks the complete provider subeffect chain');
  }
  if (['POST_RESTART_VERIFIED', 'DEPLOY_COMPLETED', 'SENTRY_ASSOCIATION_STARTED', 'COMPLETED'].includes(effect.phase) &&
      effect.result === 'COMPLETED' &&
      (provider.observed_machine_id === null || provider.observed_machine_state !== 'started' ||
       provider.observed_image !== options.immutableImage || provider.observed_volume_id !== options.expectedVolumeId ||
       ![provider.runtime_live_sha256, provider.runtime_ready_sha256, provider.runtime_version_sha256,
         provider.runtime_capabilities_sha256].every((value) => /^[0-9a-f]{64}$/.test(value || '')))) {
    fail('deploy post-restart provider state differs');
  }
  if (effect.phase === 'SENTRY_ASSOCIATION_STARTED' && effect.result === 'STARTED' &&
      (!subeffects.pending || subeffects.pending.kind !== 'SENTRY_DEPLOYMENT_ASSOCIATE')) {
    fail('deploy Sentry association STARTED lacks the exact pending provider subeffect');
  }
  if (effect.phase === 'COMPLETED' && effect.result === 'COMPLETED' &&
      (!completedKinds.has('SENTRY_DEPLOYMENT_ASSOCIATE') || !provider.observed_sentry_deployment_id_sha256)) {
    fail('completed deploy packet lacks exact Sentry association evidence');
  }
}

export function readAndValidatePhysioDeployResumePacket(packetRoot, options) {
  const requiredOptions = [
    'applicationSha', 'immutableImage', 'publicationReceiptSha256', 'canaryReceiptSha256',
    'bootstrapReceiptSha256', 'stripeWebhookReceiptSha256', 'sentryReleaseReceiptSha256',
    'configSha256', 'upstreamArtifactMetadataSha256', 'expectedVolumeId',
    'capabilityIntentId', 'authorityReference', 'publicationCapabilityIntentId',
    'publicationAuthorityReference', 'bootstrapCapabilityIntentId', 'bootstrapAuthorityReference',
    'canaryCapabilityIntentId', 'canaryAuthorityReference',
    'stripeWebhookCapabilityIntentId', 'stripeWebhookAuthorityReference',
    'sentryCapabilityIntentId', 'sentryAuthorityReference',
  ];
  for (const name of requiredOptions) {
    if (typeof options?.[name] !== 'string' || options[name] === '') fail(`deploy option ${name} differs`);
  }
  const receiptHashes = [
    options.publicationReceiptSha256, options.canaryReceiptSha256, options.bootstrapReceiptSha256,
    options.stripeWebhookReceiptSha256, options.sentryReleaseReceiptSha256, options.configSha256,
    options.upstreamArtifactMetadataSha256,
  ];
  if (!SHA_PATTERN.test(options.applicationSha) || !IMAGE_PATTERN.test(options.immutableImage) ||
      !receiptHashes.every((value) => /^[0-9a-f]{64}$/.test(value)) ||
      !/^vol_[A-Za-z0-9]+$/.test(options.expectedVolumeId) ||
      !/^[A-Za-z0-9._:-]{1,160}$/.test(options.capabilityIntentId) ||
      !/^[A-Za-z0-9._:/-]{1,240}$/.test(options.authorityReference) ||
      ![options.publicationCapabilityIntentId, options.canaryCapabilityIntentId, options.bootstrapCapabilityIntentId,
        options.stripeWebhookCapabilityIntentId, options.sentryCapabilityIntentId]
        .every((value) => /^[A-Za-z0-9._:-]{1,160}$/.test(value)) ||
      ![options.publicationAuthorityReference, options.canaryAuthorityReference, options.bootstrapAuthorityReference,
        options.stripeWebhookAuthorityReference, options.sentryAuthorityReference]
        .every((value) => /^[A-Za-z0-9._:/-]{1,240}$/.test(value))) {
    fail('deploy option identity differs');
  }
  const capabilityLineage = [
    options.capabilityIntentId, options.publicationCapabilityIntentId, options.canaryCapabilityIntentId,
    options.bootstrapCapabilityIntentId, options.stripeWebhookCapabilityIntentId,
    options.sentryCapabilityIntentId,
  ];
  const authorityLineage = [
    options.authorityReference, options.publicationAuthorityReference, options.canaryAuthorityReference,
    options.bootstrapAuthorityReference, options.stripeWebhookAuthorityReference,
    options.sentryAuthorityReference,
  ];
  if (new Set(capabilityLineage).size !== capabilityLineage.length ||
      new Set(authorityLineage).size !== authorityLineage.length) {
    fail('deploy upstream capability or authority lineage is not distinct');
  }
  const packet = readChecksummedDeployPacket(packetRoot);
  const admissionBytes = packet.buffers.get('deploy-admission.json');
  const configBytes = packet.buffers.get('deploy-reviewed-config.toml');
  validateDeployAdmission(parseDeployJson(admissionBytes, 'deploy-admission.json'), configBytes, options);
  let previousPhaseSha = '0'.repeat(64);
  let previousProviderSubeffects = [];
  let previousProviderRequests = [];
  const readbackBySha256 = new Map();
  let previousEffect = null;
  for (const entry of packet.ledger) {
    const phaseBytes = packet.buffers.get(entry.phaseName);
    const readbackBytes = packet.buffers.get(entry.readbackName);
    const effect = parseDeployJson(phaseBytes, entry.phaseName);
    const provider = validateDeployProviderReadback(
      parseDeployJson(readbackBytes, entry.readbackName),
      entry.phase,
    );
    Object.defineProperty(provider, '__raw_sha256', { value: sha256(readbackBytes), enumerable: false });
    readbackBySha256.set(provider.__raw_sha256, provider);
    if (entry.packetOrdinal === 0) {
      if (entry.phaseOrdinal !== 0 || entry.phaseRevision !== 0 || effect.result !== 'STARTED') {
        fail('deploy first packet transition differs');
      }
    } else if (entry.phaseOrdinal === previousEffect.phase_ordinal) {
      if (entry.phaseRevision !== previousEffect.phase_revision + 1 ||
          !((previousEffect.result === 'STARTED_UNRESOLVED' &&
             ['STARTED', 'COMPLETED'].includes(effect.result)) ||
            (previousEffect.result === 'STARTED' && previousEffect.phase_revision > 0 &&
             ['COMPLETED', 'STARTED_UNRESOLVED'].includes(effect.result)))) {
        fail(`deploy same-phase revision transition ${entry.packetOrdinal} differs`);
      }
    } else {
      if (entry.phaseOrdinal !== previousEffect.phase_ordinal + 1 || entry.phaseRevision !== 0 ||
          previousEffect.result === 'STARTED_UNRESOLVED' ||
          (previousEffect.result === 'STARTED' &&
            !['COMPLETED', 'STARTED_UNRESOLVED'].includes(effect.result)) ||
          (previousEffect.result === 'COMPLETED' &&
            !(effect.result === 'STARTED' ||
              (entry.phase === 'DEPLOY_COMPLETED' && effect.result === 'COMPLETED')))) {
        fail(`deploy phase transition ${entry.packetOrdinal} differs`);
      }
    }
    validateDeployEffectRow(effect, provider, options, {
      ordinal: entry.phaseOrdinal,
      packetOrdinal: entry.packetOrdinal,
      phaseRevision: entry.phaseRevision,
      expectedPredecessorSha256: previousPhaseSha,
      providerReadbackSha256: sha256(readbackBytes),
      previousProviderSubeffects,
      previousProviderRequests,
      readbackBySha256,
    });
    previousPhaseSha = sha256(phaseBytes);
    previousProviderSubeffects = effect.provider_subeffects;
    previousProviderRequests = effect.provider_subeffect_requests;
    previousEffect = effect;
  }
  const current = packet.ledger.at(-1);
  const currentPhase = current.phase;
  const currentPhaseName = current.phaseName;
  const currentReadbackName = current.readbackName;
  const effectBytes = packet.buffers.get('deploy-effect-reconciliation.json');
  const providerBytes = packet.buffers.get('deploy-provider-readback.json');
  if (!effectBytes.equals(packet.buffers.get(currentPhaseName)) ||
      !providerBytes.equals(packet.buffers.get(currentReadbackName))) {
    fail('deploy current phase aliases differ from the append-only raw chain');
  }
  const effect = parseDeployJson(effectBytes, 'deploy-effect-reconciliation.json');
  return Object.freeze({
    contractVersion: effect.contract_version,
    phase: effect.phase,
    phaseOrdinal: packet.phaseOrdinal,
    packetOrdinal: packet.packetOrdinal,
    phaseRevision: effect.phase_revision,
    result: effect.result,
    resumeCompleted: effect.phase === 'COMPLETED' && effect.result === 'COMPLETED',
    effectReceiptSha256: sha256(effectBytes),
    admissionReceiptSha256: sha256(admissionBytes),
    configSha256: sha256(configBytes),
    providerCallsAttempted: effect.provider_calls_attempted,
    providerCallsConfirmed: effect.provider_calls_confirmed,
  });
}

function writeDeployPacket(outputPacketRoot, payloads) {
  const root = path.resolve(outputPacketRoot);
  fs.mkdirSync(root, { recursive: false, mode: 0o700 });
  const ordered = [...payloads].sort(([left], [right]) => left.localeCompare(right));
  for (const [basename, bytes] of ordered) {
    if (basename === 'SHA256SUMS' || path.basename(basename) !== basename || !Buffer.isBuffer(bytes)) {
      fail('deploy packet write member differs');
    }
    fs.writeFileSync(path.join(root, basename), bytes, { flag: 'wx', mode: 0o600 });
  }
  const sums = ordered.map(([basename, bytes]) => `${sha256(bytes)}  ${basename}`).join('\n');
  fs.writeFileSync(path.join(root, 'SHA256SUMS'), `${sums}\n`, { flag: 'wx', mode: 0o600 });
}

function deployEffectIdentityFromAdmission(admission) {
  return {
    application: admission.application,
    application_sha: admission.application_sha,
    authority_reference: admission.authority_reference,
    bootstrap_authority_reference: admission.bootstrap_authority_reference,
    bootstrap_capability_intent_id: admission.bootstrap_capability_intent_id,
    bootstrap_receipt_sha256: admission.bootstrap_receipt_sha256,
    canary_authority_reference: admission.canary_authority_reference,
    canary_capability_intent_id: admission.canary_capability_intent_id,
    canary_receipt_sha256: admission.canary_receipt_sha256,
    capability_intent_id: admission.capability_intent_id,
    config_sha256: admission.config_sha256,
    expected_volume_id: admission.expected_volume_id,
    immutable_image: admission.immutable_image,
    publication_receipt_sha256: admission.publication_receipt_sha256,
    publication_authority_reference: admission.publication_authority_reference,
    publication_capability_intent_id: admission.publication_capability_intent_id,
    sentry_authority_reference: admission.sentry_authority_reference,
    sentry_capability_intent_id: admission.sentry_capability_intent_id,
    sentry_release_receipt_sha256: admission.sentry_release_receipt_sha256,
    stripe_webhook_authority_reference: admission.stripe_webhook_authority_reference,
    stripe_webhook_capability_intent_id: admission.stripe_webhook_capability_intent_id,
    stripe_webhook_receipt_sha256: admission.stripe_webhook_receipt_sha256,
    upstream_artifact_metadata_sha256: admission.upstream_artifact_metadata_sha256,
  };
}

function startedDeploySubeffect(request, prestateSha256, predecessorEventSha256, eventOrdinal, startedAt) {
  return {
    attempt_ordinal: 0,
    completed_at: null,
    effect_id: request.effect_id,
    effect_ordinal: request.effect_ordinal,
    event_ordinal: eventOrdinal,
    intended_resource_id: request.intended_resource_id,
    kind: request.kind,
    observed_resource_id: null,
    predecessor_event_sha256: predecessorEventSha256,
    prestate_sha256: prestateSha256,
    provider_exit_code: null,
    provider_readback_sha256: null,
    provider_request_id_sha256: null,
    request_sha256: sha256(Buffer.from(`${canonicalJson(request)}\n`, 'utf8')),
    started_at: startedAt,
    state: 'STARTED',
  };
}

function writeCanonicalJsonExclusive(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}

export function writePhysioDeployAdmission({ outputPath, options, now = new Date().toISOString() }) {
  if (!Number.isFinite(Date.parse(now))) fail('deploy admission timestamp differs');
  const configBytes = fs.readFileSync(options.configPath);
  const row = {
    contract_version: 'assesssuite-physio-deploy-admission/2.0.0',
    result: 'PASS',
    application: PHYSIO_RELEASE_TARGET.app,
    application_sha: options.applicationSha,
    immutable_image: options.immutableImage,
    expected_volume_id: options.expectedVolumeId,
    publication_receipt_sha256: options.publicationReceiptSha256,
    canary_receipt_sha256: options.canaryReceiptSha256,
    bootstrap_receipt_sha256: options.bootstrapReceiptSha256,
    stripe_webhook_receipt_sha256: options.stripeWebhookReceiptSha256,
    sentry_release_receipt_sha256: options.sentryReleaseReceiptSha256,
    config_sha256: options.configSha256,
    upstream_artifact_metadata_sha256: options.upstreamArtifactMetadataSha256,
    capability_intent_id: options.capabilityIntentId,
    authority_reference: options.authorityReference,
    publication_capability_intent_id: options.publicationCapabilityIntentId,
    publication_authority_reference: options.publicationAuthorityReference,
    bootstrap_capability_intent_id: options.bootstrapCapabilityIntentId,
    bootstrap_authority_reference: options.bootstrapAuthorityReference,
    canary_capability_intent_id: options.canaryCapabilityIntentId,
    canary_authority_reference: options.canaryAuthorityReference,
    stripe_webhook_capability_intent_id: options.stripeWebhookCapabilityIntentId,
    stripe_webhook_authority_reference: options.stripeWebhookAuthorityReference,
    sentry_capability_intent_id: options.sentryCapabilityIntentId,
    sentry_authority_reference: options.sentryAuthorityReference,
    admitted_at: now,
  };
  validateDeployAdmission(row, configBytes, options);
  writeCanonicalJsonExclusive(outputPath, row);
  return Object.freeze(row);
}

export function writePhysioDeployProviderRequest({
  outputPath,
  kind,
  effectOrdinal,
  intendedResourceId,
  argvPath,
  options,
}) {
  if (!PHYSIO_DEPLOY_PROVIDER_SUBEFFECT_KINDS.includes(kind) ||
      !Number.isSafeInteger(effectOrdinal) || effectOrdinal < 0 || effectOrdinal > 32 ||
      !(intendedResourceId === null || /^[A-Za-z0-9._:@/-]{1,240}$/.test(intendedResourceId))) {
    fail('deploy provider request input differs');
  }
  const row = {
    application: PHYSIO_RELEASE_TARGET.app,
    application_sha: options.applicationSha,
    argv_sha256: sha256(fs.readFileSync(argvPath)),
    config_sha256: options.configSha256,
    effect_id: `deploy:${options.applicationSha}:${effectOrdinal}:${kind.toLowerCase()}`,
    effect_ordinal: effectOrdinal,
    expected_volume_id: options.expectedVolumeId,
    immutable_image: options.immutableImage,
    intended_resource_id: intendedResourceId,
    kind,
  };
  writeCanonicalJsonExclusive(outputPath, row);
  return Object.freeze(row);
}

export function writePhysioDeployProviderReadback({
  outputPath,
  phase,
  result,
  machinesPath,
  volumesPath,
  snapshotsPath,
  observedMachineId = null,
  observedVolumeId = null,
  observedRestoreVolumeId = null,
  observedVerifierMachineId = null,
  observedPredeploySnapshotId = null,
  observedPostdeploySnapshotId = null,
  observedSentryDeploymentIdSha256 = null,
  operationKind = null,
  operationEffectId = null,
  operationRequestSha256 = null,
  operationResourceId = null,
  operationProviderRequestIdSha256 = null,
  operationReceiptPath = null,
  operationDisposition = 'NONE',
  runtimeLivePath = null,
  runtimeReadyPath = null,
  runtimeVersionPath = null,
  runtimeCapabilitiesPath = null,
  now = new Date().toISOString(),
}) {
  const machineBytes = fs.readFileSync(machinesPath);
  const volumeBytes = fs.readFileSync(volumesPath);
  const snapshotBytes = fs.readFileSync(snapshotsPath);
  const machines = asRows(JSON.parse(machineBytes), ['machines', 'Machines']);
  const volumes = asRows(JSON.parse(volumeBytes), ['volumes', 'Volumes']);
  const snapshots = asRows(JSON.parse(snapshotBytes), ['snapshots', 'Snapshots']);
  const machineIds = machines.map(machineIdOf).sort();
  const volumeIds = volumes.map(volumeIdOf).sort();
  const snapshotIds = snapshots.map((row) => stringValue(
    row?.id ?? row?.ID ?? row?.snapshot_id ?? row?.snapshotId,
    'snapshot ID',
  )).sort();
  if (new Set(machineIds).size !== machineIds.length || new Set(volumeIds).size !== volumeIds.length ||
      new Set(snapshotIds).size !== snapshotIds.length || snapshotIds.length > 1000) {
    fail('deploy provider inventory identity differs');
  }
  const selectedMachine = observedMachineId === null
    ? null
    : machines.find((row) => machineIdOf(row) === observedMachineId);
  const verifierMachine = observedVerifierMachineId === null
    ? null
    : machines.find((row) => machineIdOf(row) === observedVerifierMachineId);
  if ((observedMachineId !== null && !selectedMachine) ||
      (observedVolumeId !== null && !volumeIds.includes(observedVolumeId)) ||
      (observedRestoreVolumeId !== null && !volumeIds.includes(observedRestoreVolumeId)) ||
      (observedVerifierMachineId !== null && !verifierMachine) ||
      (observedPredeploySnapshotId !== null && !snapshotIds.includes(observedPredeploySnapshotId)) ||
      (observedPostdeploySnapshotId !== null && !snapshotIds.includes(observedPostdeploySnapshotId))) {
    fail('deploy observed provider resource is absent from its inventory');
  }
  const optionalFileHash = (filePath) => filePath ? sha256(fs.readFileSync(filePath)) : null;
  const machineConfig = selectedMachine?.config ?? selectedMachine?.Config ?? null;
  const machineEvents = selectedMachine?.events ?? selectedMachine?.Events ?? [];
  if (!Array.isArray(machineEvents) || machineEvents.length > 1000) {
    fail('deploy observed machine events differ');
  }
  const configWithoutRestart = machineConfig === null ? null : configWithoutRestartMarker(machineConfig);
  const restartIntent = machineConfig?.metadata?.[RESTART_MARKER_KEY] ?? null;
  const row = {
    contract_version: 'assesssuite-physio-deploy-provider-readback/1.0.0',
    result,
    application: PHYSIO_RELEASE_TARGET.app,
    phase,
    machines_sha256: sha256(machineBytes),
    volumes_sha256: sha256(volumeBytes),
    snapshots_sha256: sha256(snapshotBytes),
    observed_config_sha256: machineConfig === null
      ? sha256(Buffer.alloc(0))
      : sha256(Buffer.from(`${canonicalJson(machineConfig)}\n`, 'utf8')),
    observed_config_without_restart_sha256: configWithoutRestart === null
      ? sha256(Buffer.alloc(0))
      : sha256(Buffer.from(`${canonicalJson(configWithoutRestart)}\n`, 'utf8')),
    machine_count: machineIds.length,
    volume_count: volumeIds.length,
    snapshot_count: snapshotIds.length,
    observed_machine_id: observedMachineId,
    observed_machine_ids: machineIds,
    observed_machine_state: selectedMachine ? stateOf(selectedMachine) : null,
    observed_machine_instance_id: selectedMachine
      ? String(selectedMachine.instance_id ?? selectedMachine.instanceId ?? '') || null
      : null,
    observed_machine_updated_at: selectedMachine
      ? (selectedMachine.updated_at ?? selectedMachine.updatedAt ?? null)
      : null,
    observed_machine_events_sha256: sha256(Buffer.from(`${canonicalJson(machineEvents)}\n`, 'utf8')),
    observed_image: selectedMachine ? findImageReference(selectedMachine) : null,
    observed_volume_id: observedVolumeId,
    observed_volume_ids: volumeIds,
    observed_restore_volume_id: observedRestoreVolumeId,
    observed_verifier_machine_id: observedVerifierMachineId,
    observed_verifier_machine_state: verifierMachine ? stateOf(verifierMachine) : null,
    observed_predeploy_snapshot_id: observedPredeploySnapshotId,
    observed_postdeploy_snapshot_id: observedPostdeploySnapshotId,
    observed_snapshot_ids: snapshotIds,
    observed_restart_intent_sha256: restartIntent,
    observed_sentry_deployment_id_sha256: observedSentryDeploymentIdSha256,
    runtime_live_sha256: optionalFileHash(runtimeLivePath),
    runtime_ready_sha256: optionalFileHash(runtimeReadyPath),
    runtime_version_sha256: optionalFileHash(runtimeVersionPath),
    runtime_capabilities_sha256: optionalFileHash(runtimeCapabilitiesPath),
    operation_kind: operationKind,
    operation_effect_id: operationEffectId,
    operation_request_sha256: operationRequestSha256,
    operation_resource_id: operationResourceId,
    operation_provider_request_id_sha256: operationProviderRequestIdSha256,
    operation_receipt_sha256: optionalFileHash(operationReceiptPath),
    operation_disposition: operationDisposition,
    readback_at: now,
  };
  validateDeployProviderReadback(row, phase);
  writeCanonicalJsonExclusive(outputPath, row);
  return Object.freeze(row);
}

export function writePhysioDeployDerivedProviderReadback({
  sourcePacketRoot,
  outputPath,
  phase,
  result,
  operationKind,
  operationEffectId,
  operationRequestSha256,
  operationResourceId,
  operationProviderRequestIdSha256 = null,
  operationReceiptPath = null,
  operationDisposition,
  observedSentryDeploymentIdSha256 = null,
  options,
  now = new Date().toISOString(),
}) {
  readAndValidatePhysioDeployResumePacket(sourcePacketRoot, options);
  const packet = readChecksummedDeployPacket(sourcePacketRoot);
  const sourceProvider = validateDeployProviderReadback(parseDeployJson(
    packet.buffers.get('deploy-provider-readback.json'),
    'deploy-provider-readback.json',
  ), parseDeployJson(
    packet.buffers.get('deploy-effect-reconciliation.json'),
    'deploy-effect-reconciliation.json',
  ).phase);
  const operationReceiptSha256 = operationReceiptPath === null
    ? null
    : sha256(readRegularExternalFile(operationReceiptPath, 'deploy operation receipt', 2_097_152));
  const row = {
    ...sourceProvider,
    result,
    phase,
    observed_sentry_deployment_id_sha256: observedSentryDeploymentIdSha256,
    operation_kind: operationKind,
    operation_effect_id: operationEffectId,
    operation_request_sha256: operationRequestSha256,
    operation_resource_id: operationResourceId,
    operation_provider_request_id_sha256: operationProviderRequestIdSha256,
    operation_receipt_sha256: operationReceiptSha256,
    operation_disposition: operationDisposition,
    readback_at: now,
  };
  validateDeployProviderReadback(row, phase);
  writeCanonicalJsonExclusive(outputPath, row);
  return Object.freeze(row);
}

export function writeInitialPhysioDeployPacket({
  outputPacketRoot,
  admissionPath,
  configPath,
  providerReadbackPath,
  providerRequestPath,
  prestateSha256,
  options,
  now = new Date().toISOString(),
}) {
  if (!/^[0-9a-f]{64}$/.test(prestateSha256 || '') || !Number.isFinite(Date.parse(now))) {
    fail('initial deploy packet effect boundary differs');
  }
  const admissionBytes = fs.readFileSync(admissionPath);
  const configBytes = fs.readFileSync(configPath);
  const providerBytes = fs.readFileSync(providerReadbackPath);
  const requestBytes = fs.readFileSync(providerRequestPath);
  const admission = parseDeployJson(admissionBytes, 'deploy-admission.json');
  validateDeployAdmission(admission, configBytes, options);
  const provider = validateDeployProviderReadback(
    parseDeployJson(providerBytes, 'deploy-readback-0000-STARTED-r00.json'),
    'STARTED',
  );
  if (!['NOT_OBSERVED', 'PASS'].includes(provider.result) || prestateSha256 !== sha256(providerBytes)) {
    fail('initial deploy provider prestate differs');
  }
  const request = parseDeployJson(requestBytes, 'deploy-provider-request.json');
  const started = startedDeploySubeffect(request, prestateSha256, '0'.repeat(64), 0, now);
  validateDeployProviderSubeffects([started]);
  validateDeployProviderRequests([request], [started], options);
  const events = [started];
  const effect = {
    contract_version: PHYSIO_DEPLOY_EFFECT_RECONCILIATION_CONTRACT_VERSION,
    result: 'STARTED',
    phase: 'STARTED',
    phase_ordinal: 0,
    packet_ordinal: 0,
    phase_revision: 0,
    ...deployEffectIdentityFromAdmission(admission),
    predecessor_phase_receipt_sha256: '0'.repeat(64),
    provider_calls_attempted: 0,
    provider_calls_confirmed: 0,
    provider_readback_sha256: sha256(providerBytes),
    provider_subeffect_chain_sha256: sha256(Buffer.from(`${canonicalJson(events)}\n`, 'utf8')),
    provider_subeffect_requests: [request],
    provider_subeffects: events,
    started_at: now,
    completed_at: null,
  };
  const effectBytes = Buffer.from(`${JSON.stringify(effect, null, 2)}\n`);
  const payloads = new Map([
    ['deploy-admission.json', admissionBytes],
    ['deploy-effect-reconciliation.json', effectBytes],
    [deployPhaseBasename(0, 'STARTED', 0), effectBytes],
    ['deploy-provider-readback.json', providerBytes],
    [deployReadbackBasename(0, 'STARTED', 0), providerBytes],
    ['deploy-reviewed-config.toml', configBytes],
  ]);
  writeDeployPacket(outputPacketRoot, payloads);
  return readAndValidatePhysioDeployResumePacket(outputPacketRoot, options);
}

export function writeNextPhysioDeployPacket({
  sourcePacketRoot,
  outputPacketRoot,
  phase,
  result,
  providerReadbackPath,
  providerRequestPath = null,
  prestateSha256 = null,
  providerExitCode = null,
  providerRequestIdSha256 = null,
  observedResourceId = null,
  reconciliationDisposition = null,
  operationReceiptPath = null,
  options,
  now = new Date().toISOString(),
}) {
  const sourceResult = readAndValidatePhysioDeployResumePacket(sourcePacketRoot, options);
  const source = readChecksummedDeployPacket(sourcePacketRoot);
  const priorEffectBytes = source.buffers.get('deploy-effect-reconciliation.json');
  const priorEffect = parseDeployJson(priorEffectBytes, 'deploy-effect-reconciliation.json');
  const samePhase = phase === priorEffect.phase;
  const nextPhaseOrdinal = samePhase ? priorEffect.phase_ordinal : priorEffect.phase_ordinal + 1;
  const phaseRevision = samePhase ? priorEffect.phase_revision + 1 : 0;
  const packetOrdinal = priorEffect.packet_ordinal + 1;
  if (phase !== PHYSIO_DEPLOY_PHASES[nextPhaseOrdinal] || phaseRevision > 99 || packetOrdinal > 255 ||
      !['STARTED', 'COMPLETED', 'STARTED_UNRESOLVED'].includes(result) ||
      !Number.isFinite(Date.parse(now))) {
    fail('next deploy phase identity differs');
  }
  const providerBytes = fs.readFileSync(providerReadbackPath);
  const provider = validateDeployProviderReadback(parseDeployJson(providerBytes, `deploy readback ${phase}`), phase);
  const operationReceiptBytes = operationReceiptPath === null ? null : fs.readFileSync(operationReceiptPath);
  if ((operationReceiptBytes === null) !== (provider.operation_receipt_sha256 === null) ||
      (operationReceiptBytes !== null && sha256(operationReceiptBytes) !== provider.operation_receipt_sha256)) {
    fail('deploy operation receipt bytes differ from provider readback');
  }
  const events = structuredClone(priorEffect.provider_subeffects);
  const requests = structuredClone(priorEffect.provider_subeffect_requests);
  if (priorEffect.result === 'STARTED_UNRESOLVED') {
    if (!samePhase || providerRequestPath ||
        !['APPLIED', 'NOT_APPLIED'].includes(reconciliationDisposition) ||
        (reconciliationDisposition === 'APPLIED' && result !== 'COMPLETED') ||
        (reconciliationDisposition === 'NOT_APPLIED' && result !== 'STARTED') ||
        !(providerRequestIdSha256 === null || /^[0-9a-f]{64}$/.test(providerRequestIdSha256)) ||
        !(observedResourceId === null || /^[A-Za-z0-9._:@/-]{1,240}$/.test(observedResourceId))) {
      fail('deploy unresolved reconciliation transition differs');
    }
      const unresolved = events.at(-1);
      if (!unresolved || unresolved.state !== 'STARTED_UNRESOLVED') {
        fail('deploy unresolved provider event differs');
      }
    const reconciled = {
        ...unresolved,
        completed_at: now,
        event_ordinal: events.length,
        observed_resource_id: observedResourceId,
        predecessor_event_sha256: deploySubeffectEventSha256(unresolved),
        provider_readback_sha256: sha256(providerBytes),
        provider_request_id_sha256: providerRequestIdSha256,
      state: reconciliationDisposition === 'APPLIED' ? 'RECONCILED_COMPLETED' : 'RECONCILED_NOT_APPLIED',
    };
    events.push(reconciled);
    if (reconciliationDisposition === 'NOT_APPLIED') {
      events.push({
        ...unresolved,
        attempt_ordinal: unresolved.attempt_ordinal + 1,
        completed_at: null,
        event_ordinal: events.length,
        observed_resource_id: null,
        predecessor_event_sha256: deploySubeffectEventSha256(reconciled),
        prestate_sha256: sha256(providerBytes),
        provider_exit_code: null,
        provider_readback_sha256: null,
        provider_request_id_sha256: null,
        started_at: now,
        state: 'RETRY_STARTED',
      });
    }
  } else if (result === 'STARTED') {
    if (samePhase || priorEffect.result !== 'COMPLETED' || !providerRequestPath ||
        reconciliationDisposition !== null || prestateSha256 !== sha256(providerBytes)) {
      fail('next deploy STARTED phase predecessor differs');
    }
    const request = parseDeployJson(fs.readFileSync(providerRequestPath), `deploy request ${phase}`);
    const predecessorEvent = events.length === 0 ? '0'.repeat(64) : deploySubeffectEventSha256(events.at(-1));
    const started = startedDeploySubeffect(request, prestateSha256, predecessorEvent, events.length, now);
    events.push(started);
    requests.push(request);
  } else if (['DEPLOY_COMPLETED', 'COMPLETED'].includes(phase) && result === 'COMPLETED' &&
      !samePhase && priorEffect.result === 'COMPLETED') {
    if (providerRequestPath || providerExitCode !== null || providerRequestIdSha256 !== null ||
        observedResourceId !== null || reconciliationDisposition !== null) {
      fail('deploy completed milestone unexpectedly describes a provider call');
    }
  } else {
    const pending = events.at(-1);
    const retryTerminal = samePhase && priorEffect.phase_revision > 0;
    if (priorEffect.result !== 'STARTED' || !pending ||
        !['STARTED', 'RETRY_STARTED'].includes(pending.state) ||
        (retryTerminal !== (pending.state === 'RETRY_STARTED')) || providerRequestPath ||
        !Number.isSafeInteger(providerExitCode) || providerExitCode < 0 || providerExitCode > 255 ||
        !(providerRequestIdSha256 === null || /^[0-9a-f]{64}$/.test(providerRequestIdSha256)) ||
        !(observedResourceId === null || /^[A-Za-z0-9._:@/-]{1,240}$/.test(observedResourceId)) ||
        reconciliationDisposition !== null) {
      fail('next deploy terminal phase predecessor differs');
    }
    events.push({
      ...pending,
      completed_at: now,
      event_ordinal: events.length,
      observed_resource_id: observedResourceId,
      predecessor_event_sha256: deploySubeffectEventSha256(pending),
      provider_exit_code: providerExitCode,
      provider_readback_sha256: sha256(providerBytes),
      provider_request_id_sha256: providerRequestIdSha256,
      state: result,
    });
  }
  const subeffects = validateDeployProviderSubeffects(events);
  validateDeployProviderRequests(requests, events, options);
  const effect = {
    ...deployEffectIdentityFromAdmission(parseDeployJson(
      source.buffers.get('deploy-admission.json'),
      'deploy-admission.json',
    )),
    contract_version: PHYSIO_DEPLOY_EFFECT_RECONCILIATION_CONTRACT_VERSION,
    result,
    phase,
    phase_ordinal: nextPhaseOrdinal,
    packet_ordinal: packetOrdinal,
    phase_revision: phaseRevision,
    predecessor_phase_receipt_sha256: sha256(priorEffectBytes),
    provider_calls_attempted: subeffects.providerCallsAttempted,
    provider_calls_confirmed: subeffects.providerCallsConfirmed,
    provider_readback_sha256: sha256(providerBytes),
    provider_subeffect_chain_sha256: subeffects.chainSha256,
    provider_subeffect_requests: requests,
    provider_subeffects: events,
    started_at: priorEffect.started_at,
    completed_at: result === 'STARTED' ? null : now,
  };
  const effectBytes = Buffer.from(`${JSON.stringify(effect, null, 2)}\n`);
  const payloads = new Map([
    ['deploy-admission.json', source.buffers.get('deploy-admission.json')],
    ['deploy-effect-reconciliation.json', effectBytes],
    ['deploy-provider-readback.json', providerBytes],
    ['deploy-reviewed-config.toml', source.buffers.get('deploy-reviewed-config.toml')],
  ]);
  for (const entry of source.ledger) {
    payloads.set(entry.phaseName, source.buffers.get(entry.phaseName));
    payloads.set(entry.readbackName, source.buffers.get(entry.readbackName));
  }
  for (const [basename, bytes] of source.buffers.entries()) {
    if (/^deploy-operation-receipt-[0-9]{4}\.bin$/.test(basename)) payloads.set(basename, bytes);
  }
  payloads.set(deployPhaseBasename(packetOrdinal, phase, phaseRevision), effectBytes);
  payloads.set(deployReadbackBasename(packetOrdinal, phase, phaseRevision), providerBytes);
  if (operationReceiptBytes !== null) {
    payloads.set(`deploy-operation-receipt-${String(packetOrdinal).padStart(4, '0')}.bin`, operationReceiptBytes);
  }
  writeDeployPacket(outputPacketRoot, payloads);
  return readAndValidatePhysioDeployResumePacket(outputPacketRoot, options);
}

const PHYSIO_ROLLBACK_PACKET_BASE_FILES = Object.freeze([
  'SHA256SUMS',
  'rollback-effect-reconciliation.json',
  'rollback-provider-readback.json',
  'rollback-target-admission.json',
  'rollback-target-config.toml',
  'rollback-target-github-artifact-admission.json',
  'rollback-target-machine-config.json',
  'rollback-target-source-deploy-receipt.json',
]);
const PHYSIO_ROLLBACK_LIVE_PRESTATE_FILES = Object.freeze([
  'rollback-current-machine-config.json',
  'rollback-live-mutation-prestate.json',
  'rollback-live-mutation-prestate-receipt.json',
]);
const PHYSIO_ROLLBACK_MACHINE_OPERATION_SERIES = Object.freeze({
  machine_config_operation_receipt_sha256s: 'rollback-machine-config-transition-operation',
  machine_config_recovery_prestate_sha256s: 'rollback-machine-config-recovery-prestate',
  machine_config_recovery_receipt_sha256s: 'rollback-machine-config-recovery-operation',
  restore_volume_cleanup_receipt_sha256s: 'rollback-restore-volume-cleanup-operation',
});

function rollbackMachineOperationBasename(prefix, ordinal) {
  return `${prefix}-${String(ordinal).padStart(4, '0')}.json`;
}

function readRegularPacketFile(packetRoot, basename, maximumBytes) {
  if (!/^[A-Za-z0-9._-]+$/.test(basename) || path.basename(basename) !== basename) {
    fail(`rollback packet member ${basename} is not a basename`);
  }
  const filePath = path.join(packetRoot, basename);
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) fail(`rollback packet member ${basename} is not a regular file`);
  if (stat.size <= 0 || stat.size > maximumBytes) fail(`rollback packet member ${basename} size differs`);
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size) {
      fail(`rollback packet member ${basename} changed during admission`);
    }
    const bytes = fs.readFileSync(descriptor);
    const after = fs.lstatSync(filePath);
    if (after.isSymbolicLink() || !after.isFile() || after.dev !== stat.dev || after.ino !== stat.ino ||
        after.size !== stat.size || opened.size !== bytes.length) {
      fail(`rollback packet member ${basename} identity changed during admission`);
    }
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function parseRollbackJson(buffer, basename) {
  const text = buffer.toString('utf8');
  if (Buffer.from(text, 'utf8').compare(buffer) !== 0 || text.includes('\r') ||
      !text.endsWith('\n') || text.endsWith('\n\n')) {
    fail(`rollback packet member ${basename} is not canonical LF UTF-8 JSON`);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(`rollback packet member ${basename} is not JSON`);
  }
}

function readChecksummedRollbackPacket(packetRoot) {
  const root = path.resolve(packetRoot);
  const rootStat = fs.lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) fail('rollback packet root differs');
  const entries = fs.readdirSync(root, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile() || entry.isSymbolicLink())) {
    fail('rollback packet must be flat and contain regular files only');
  }
  const actualNames = entries.map((entry) => entry.name).sort();
  const effectPreview = readRegularPacketFile(root, 'rollback-effect-reconciliation.json', 1_048_576);
  const preview = parseRollbackJson(effectPreview, 'rollback-effect-reconciliation.json');
  const phaseOrdinal = PHYSIO_ROLLBACK_PHASES.indexOf(preview?.phase);
  if (phaseOrdinal < 0 || preview?.phase_ordinal !== phaseOrdinal) fail('rollback packet current phase differs');
  const phaseFiles = [];
  const operationFiles = new Set();
  for (let index = 0; index <= phaseOrdinal; index += 1) {
    const phase = PHYSIO_ROLLBACK_PHASES[index];
    phaseFiles.push(`rollback-phase-${String(index).padStart(2, '0')}-${phase}.json`);
    const readbackName = `rollback-readback-${String(index).padStart(2, '0')}-${phase}.json`;
    phaseFiles.push(readbackName);
    const readbackPreview = parseRollbackJson(
      readRegularPacketFile(root, readbackName, 1_048_576),
      readbackName,
    );
    for (const [field, prefix] of Object.entries(PHYSIO_ROLLBACK_MACHINE_OPERATION_SERIES)) {
      const hashes = readbackPreview?.[field];
      if (!Array.isArray(hashes)) continue;
      for (let ordinal = 1; ordinal <= hashes.length; ordinal += 1) {
        operationFiles.add(rollbackMachineOperationBasename(prefix, ordinal));
      }
    }
  }
  const liveMutationOrdinal = PHYSIO_ROLLBACK_PHASES.indexOf('LIVE_MUTATION_STARTED');
  const expectedFiles = [...PHYSIO_ROLLBACK_PACKET_BASE_FILES,
    ...(phaseOrdinal >= liveMutationOrdinal ? PHYSIO_ROLLBACK_LIVE_PRESTATE_FILES : []),
    ...phaseFiles, ...operationFiles].sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedFiles)) fail('rollback packet file set differs');
  const buffers = new Map();
  for (const basename of expectedFiles) {
    const maximum = basename === 'rollback-target-config.toml' ? 65_536 : 1_048_576;
    buffers.set(basename, readRegularPacketFile(root, basename, maximum));
  }
  const sumsText = buffers.get('SHA256SUMS').toString('utf8');
  if (sumsText.includes('\r') || !sumsText.endsWith('\n') || sumsText.endsWith('\n\n')) {
    fail('rollback SHA256SUMS is not canonical LF text');
  }
  const rows = sumsText.trimEnd().split('\n');
  const expectedPayloadNames = expectedFiles.filter((name) => name !== 'SHA256SUMS').sort();
  const parsed = rows.map((row) => {
    const match = row.match(/^([0-9a-f]{64})  ([A-Za-z0-9._-]+)$/);
    if (!match || path.basename(match[2]) !== match[2]) fail('rollback SHA256SUMS row differs');
    return { digest: match[1], basename: match[2] };
  });
  if (JSON.stringify(parsed.map((row) => row.basename)) !== JSON.stringify(expectedPayloadNames)) {
    fail('rollback SHA256SUMS membership or bytewise ordering differs');
  }
  if (new Set(parsed.map((row) => row.basename)).size !== parsed.length) {
    fail('rollback SHA256SUMS contains duplicate members');
  }
  for (const row of parsed) {
    if (sha256(buffers.get(row.basename)) !== row.digest) {
      fail(`rollback packet member ${row.basename} checksum differs`);
    }
  }
  return Object.freeze({ root, buffers, phaseOrdinal });
}

function validateRollbackTargetAdmission(
  row,
  configBytes,
  machineConfigBytes,
  githubAdmissionBytes,
  sourceDeployReceiptBytes,
  options,
) {
  exactKeys(row, [
    'admitted_at', 'application', 'application_sha', 'contract_version', 'github_artifact_admission_sha256', 'immutable_image',
    'result', 'rollback_target_artifact_digest', 'rollback_target_artifact_id',
    'rollback_target_config_sha256', 'rollback_target_machine_config_sha256',
    'rollback_target_receipt_sha256', 'source_deploy_receipt_file_sha256',
    'source_receipt_contract_version', 'source_workflow_head_sha',
    'source_workflow_path', 'source_workflow_run_id',
  ], 'rollback target admission');
  const firstReleaseStop = options.rollbackMode === 'stop-first-release';
  const expectedSourceContract = firstReleaseStop ? 'NOT-AVAILABLE' : 'assesssuite-physio-deploy/3.0.0';
  if (row.contract_version !== PHYSIO_ROLLBACK_TARGET_ADMISSION_CONTRACT_VERSION || row.result !== 'PASS' ||
      row.application !== PHYSIO_RELEASE_TARGET.app || row.application_sha !== options.rollbackReleaseSha ||
      row.immutable_image !== options.rollbackImmutableImage ||
      String(row.rollback_target_artifact_id) !== String(options.rollbackTargetArtifactId) ||
      row.rollback_target_artifact_digest !== options.rollbackTargetArtifactDigest ||
      row.rollback_target_receipt_sha256 !== options.rollbackTargetReceiptSha256 ||
      row.source_receipt_contract_version !== expectedSourceContract ||
      row.source_workflow_path !== '.github/workflows/physio-production-deploy.yml' ||
      row.source_workflow_head_sha !== (firstReleaseStop ? 'NOT-AVAILABLE' : options.rollbackReleaseSha) ||
      (firstReleaseStop ? row.source_workflow_run_id !== 0 :
        (!Number.isSafeInteger(row.source_workflow_run_id) || row.source_workflow_run_id < 1)) ||
      !/^[0-9a-f]{64}$/.test(row.github_artifact_admission_sha256 || '') ||
      row.rollback_target_config_sha256 !== sha256(configBytes) ||
      row.rollback_target_machine_config_sha256 !== sha256(machineConfigBytes) ||
      row.github_artifact_admission_sha256 !== sha256(githubAdmissionBytes) ||
      row.source_deploy_receipt_file_sha256 !== sha256(sourceDeployReceiptBytes) ||
      !Number.isFinite(Date.parse(row.admitted_at || ''))) {
    fail('rollback target admission identity differs');
  }
  const sourceConfig = configBytes.toString('utf8');
  if (Buffer.from(sourceConfig, 'utf8').compare(configBytes) !== 0 || sourceConfig.includes('\r') ||
      !sourceConfig.endsWith('\n') || sourceConfig.endsWith('\n\n')) {
    fail('rollback target config is not canonical LF UTF-8');
  }
  const machineConfig = parseRollbackJson(machineConfigBytes, 'rollback-target-machine-config.json');
  if (!machineConfig || typeof machineConfig !== 'object' || Array.isArray(machineConfig)) {
    fail('rollback target machine config differs');
  }
  const targetImage = machineConfig.image ?? machineConfig.image_ref ?? machineConfig.imageRef;
  const expectedMachineImage = firstReleaseStop ? options.currentImmutableImage : options.rollbackImmutableImage;
  if (canonicalizePhysioFlyImageReference(targetImage) !== expectedMachineImage) {
    fail('rollback target machine config image differs');
  }
  const githubAdmission = parseRollbackJson(
    githubAdmissionBytes,
    'rollback-target-github-artifact-admission.json',
  );
  const sourceDeployReceipt = parseRollbackJson(
    sourceDeployReceiptBytes,
    'rollback-target-source-deploy-receipt.json',
  );
  if (firstReleaseStop) {
    for (const [value, label] of [
      [githubAdmission, 'rollback target GitHub admission'],
      [sourceDeployReceipt, 'rollback target source deploy receipt'],
    ]) {
      exactKeys(value, ['contract_version', 'reason', 'result'], label);
      if (value.contract_version !== 'assesssuite-physio-not-applicable/1.0.0' ||
          value.result !== 'NOT_APPLICABLE' || value.reason !== 'stop-first-release') {
        fail(`${label} sentinel differs`);
      }
    }
    return;
  }
  exactKeys(githubAdmission, [
    'admitted_at', 'application_sha', 'artifacts', 'contract_version', 'repository', 'result',
  ], 'rollback target GitHub admission');
  exactKeys(githubAdmission.artifacts, ['rollback_target'], 'rollback target GitHub artifacts');
  const githubTarget = githubAdmission.artifacts.rollback_target;
  exactKeys(githubTarget, [
    'digest', 'expired', 'id', 'maximum_bytes', 'name', 'repository', 'size_in_bytes',
    'workflow_run_conclusion', 'workflow_run_event', 'workflow_run_head_branch',
    'workflow_run_head_sha', 'workflow_run_id', 'workflow_run_path',
  ], 'rollback target GitHub artifact');
  if (githubAdmission.contract_version !== 'assesssuite-github-artifact-admission/1.0.0' ||
      githubAdmission.result !== 'PASS' || githubAdmission.repository !== 'mbvidler-ctrl/assesssuite_migration' ||
      githubAdmission.application_sha !== options.rollbackReleaseSha ||
      githubTarget.id !== Number(options.rollbackTargetArtifactId) ||
      githubTarget.digest !== options.rollbackTargetArtifactDigest || githubTarget.expired !== false ||
      githubTarget.workflow_run_head_sha !== options.rollbackReleaseSha ||
      githubTarget.workflow_run_head_branch !== 'main' || githubTarget.workflow_run_event !== 'workflow_dispatch' ||
      githubTarget.workflow_run_conclusion !== 'success' ||
      githubTarget.workflow_run_path !== '.github/workflows/physio-production-deploy.yml' ||
      githubTarget.repository !== 'mbvidler-ctrl/assesssuite_migration' ||
      githubTarget.workflow_run_id !== row.source_workflow_run_id ||
      !Number.isFinite(Date.parse(githubAdmission.admitted_at || ''))) {
    fail('rollback target GitHub admission differs');
  }
  if (sha256(sourceDeployReceiptBytes) !== options.rollbackTargetReceiptSha256 ||
      sourceDeployReceipt.contract_version !== 'assesssuite-physio-deploy/3.0.0' ||
      sourceDeployReceipt.result !== 'PASS' || sourceDeployReceipt.application !== PHYSIO_RELEASE_TARGET.app ||
      sourceDeployReceipt.application_sha !== options.rollbackReleaseSha ||
      sourceDeployReceipt.immutable_image !== options.rollbackImmutableImage ||
      sourceDeployReceipt.rollback_target_config_sha256 !== sha256(configBytes) ||
      sourceDeployReceipt.rollback_target_machine_config_sha256 !== sha256(machineConfigBytes)) {
    fail('rollback target source deploy receipt differs');
  }
}

function validateRollbackLiveMutationPrestate(packet, options) {
  const configBytes = packet.buffers.get('rollback-current-machine-config.json');
  const prestateBytes = packet.buffers.get('rollback-live-mutation-prestate.json');
  const receiptBytes = packet.buffers.get('rollback-live-mutation-prestate-receipt.json');
  if (!configBytes || !prestateBytes || !receiptBytes) fail('rollback live mutation prestate is absent');
  const config = parseRollbackJson(configBytes, 'rollback-current-machine-config.json');
  const machine = parseRollbackJson(prestateBytes, 'rollback-live-mutation-prestate.json');
  const receipt = parseRollbackJson(receiptBytes, 'rollback-live-mutation-prestate-receipt.json');
  exactKeys(receipt, ['captured_at', 'contract_version', 'http_status', 'machine_config_sha256',
    'machine_id', 'provider_readback_sha256', 'request_url', 'response_headers_sha256', 'result'],
  'rollback live mutation prestate receipt');
  if (receipt.contract_version !== 'assesssuite-physio-rollback-live-mutation-prestate/1.0.0' ||
      receipt.result !== 'PASS' || receipt.http_status !== 200 ||
      receipt.machine_id !== options.expectedMachineId ||
      receipt.request_url !== `https://api.machines.dev/v1/apps/${PHYSIO_RELEASE_TARGET.app}/machines/${options.expectedMachineId}` ||
      receipt.provider_readback_sha256 !== sha256(prestateBytes) ||
      receipt.machine_config_sha256 !== sha256(configBytes) ||
      !/^[0-9a-f]{64}$/.test(receipt.response_headers_sha256 || '') ||
      !Number.isFinite(Date.parse(receipt.captured_at || ''))) {
    fail('rollback live mutation prestate receipt differs');
  }
  const sourceImage = machine?.config?.image;
  const allowedImages = options.rollbackMode === 'exact-image'
    ? [options.currentImmutableImage, options.rollbackImmutableImage]
    : [options.currentImmutableImage];
  if (!allowedImages.includes(sourceImage) ||
      JSON.stringify(machine.config) !== JSON.stringify(config)) {
    fail('rollback live mutation prestate config differs');
  }
  validateMachineForConfigTransition(machine, { machineId: options.expectedMachineId,
    immutableImage: sourceImage, expectedVolumeId: options.expectedVolumeId,
    expectedState: 'started' });
  if (machineConfigSha256(config) !== machineConfigSha256(machine.config)) {
    fail('rollback live mutation prestate config hash differs');
  }
  if (options.rollbackMode === 'exact-image') {
    const targetConfig = parseRollbackJson(
      packet.buffers.get('rollback-target-machine-config.json'),
      'rollback-target-machine-config.json',
    );
    buildFullMachineConfigUpdate({ targetConfig, immutableImage: options.rollbackImmutableImage,
      expectedVolumeId: options.expectedVolumeId });
  }
}

function validateRollbackMachineOperationReceipt(receiptBytes, prestateBytes, targetConfigBytes,
  options, { sourceImage, targetImage, requireApplied, label }) {
  const receipt = parseRollbackJson(receiptBytes, label);
  const preMachine = parseRollbackJson(prestateBytes, `${label} prestate`);
  const targetConfig = parseRollbackJson(targetConfigBytes, `${label} target config`);
  validateMachineForConfigTransition(preMachine, { machineId: options.expectedMachineId,
    immutableImage: sourceImage, expectedVolumeId: options.expectedVolumeId,
    expectedState: 'started' });
  const built = buildFullMachineConfigUpdate({ targetConfig, immutableImage: targetImage,
    expectedVolumeId: options.expectedVolumeId });
  const mutationAttempted = receipt.provider_mutation_calls_attempted;
  const mutationConfirmed = receipt.provider_mutation_calls_confirmed;
  const mutationResponses = receipt.provider_mutation_responses_received;
  const inventoryAttempted = receipt.provider_inventory_calls_attempted;
  const inventoryConfirmed = receipt.provider_inventory_calls_confirmed;
  if (receipt.contract_version !== 'assesssuite-physio-machine-config-transition/1.0.0' ||
      !['PASS', 'STARTED_UNRESOLVED'].includes(receipt.result) ||
      !['APPLIED', 'NOT_APPLIED', 'AMBIGUOUS'].includes(receipt.disposition) ||
      receipt.request_sha256 !== built.request_sha256 ||
      receipt.request_body !== built.request_body ||
      receipt.target_config_sha256 !== built.target_config_sha256 ||
      receipt.pre_machine_sha256 !== machineStateSha256(preMachine) ||
      receipt.pre_config_sha256 !== machineConfigSha256(preMachine.config) ||
      receipt.pre_instance_id !== preMachine.instance_id || receipt.pre_updated_at !== preMachine.updated_at ||
      receipt.pre_events_sha256 !== machineEventsSha256(preMachine.events) ||
      !Number.isSafeInteger(mutationAttempted) || ![0, 1].includes(mutationAttempted) ||
      !Number.isSafeInteger(mutationConfirmed) || mutationConfirmed < 0 || mutationConfirmed > mutationAttempted ||
      !Number.isSafeInteger(mutationResponses) || mutationResponses < 0 || mutationResponses > mutationAttempted ||
      !Number.isSafeInteger(inventoryAttempted) || inventoryAttempted < 1 || inventoryAttempted > 100 ||
      !Number.isSafeInteger(inventoryConfirmed) || inventoryConfirmed < 0 || inventoryConfirmed > inventoryAttempted ||
      !Array.isArray(receipt.inventory_receipts) || receipt.inventory_receipts.length > inventoryAttempted ||
      receipt.inventory_receipts.some((row) => !row || typeof row !== 'object' ||
        !Number.isInteger(row.http_status) || row.http_status < 100 || row.http_status > 599 ||
        !/^[0-9a-f]{64}$/.test(row.response_body_sha256 || '') ||
        !/^[0-9a-f]{64}$/.test(row.response_headers_sha256 || ''))) {
    fail(`${label} contract differs`);
  }
  if (mutationAttempted === 0 ? receipt.mutation_receipt !== null :
    (!receipt.mutation_receipt || typeof receipt.mutation_receipt !== 'object')) {
    fail(`${label} mutation receipt differs`);
  }
  if (mutationAttempted === 1) {
    const mutationReceipt = receipt.mutation_receipt;
    if (mutationResponses === 1
      ? (!Number.isInteger(mutationReceipt.http_status) || mutationReceipt.http_status < 100 ||
        mutationReceipt.http_status > 599 ||
        !/^[0-9a-f]{64}$/.test(mutationReceipt.response_body_sha256 || '') ||
        !/^[0-9a-f]{64}$/.test(mutationReceipt.response_headers_sha256 || ''))
      : !/^[0-9a-f]{64}$/.test(mutationReceipt.error_sha256 || '')) {
      fail(`${label} mutation response evidence differs`);
    }
  }
  if (requireApplied && (receipt.result !== 'PASS' || receipt.disposition !== 'APPLIED' ||
      receipt.observed_machine_id !== options.expectedMachineId ||
      receipt.observed_config_sha256 !== built.target_config_sha256 ||
      typeof receipt.observed_instance_id !== 'string' || receipt.observed_instance_id.length < 1 ||
      !Number.isFinite(Date.parse(receipt.observed_updated_at || '')) ||
      !/^[0-9a-f]{64}$/.test(receipt.observed_events_sha256 || '') ||
      mutationConfirmed !== mutationAttempted || inventoryConfirmed !== inventoryAttempted)) {
    fail(`${label} applied readback differs`);
  }
  return receipt;
}

function validateRollbackMachineOperationEvidence(packet, provider, effect, options) {
  const buffersByField = {};
  for (const [field, prefix] of Object.entries(PHYSIO_ROLLBACK_MACHINE_OPERATION_SERIES)) {
    const buffers = provider[field].map((expectedHash, index) => {
      const basename = rollbackMachineOperationBasename(prefix, index + 1);
      const bytes = packet.buffers.get(basename);
      if (!bytes || sha256(bytes) !== expectedHash) {
        fail(`rollback machine operation evidence ${basename} hash differs`);
      }
      return bytes;
    });
    buffersByField[field] = buffers;
  }
  const transitionReceipts = buffersByField.machine_config_operation_receipt_sha256s;
  const recoveryPrestates = buffersByField.machine_config_recovery_prestate_sha256s;
  const recoveryReceipts = buffersByField.machine_config_recovery_receipt_sha256s;
  const cleanupReceipts = buffersByField.restore_volume_cleanup_receipt_sha256s;
  if (effect.phase !== 'LIVE_MUTATION_STARTED' &&
      (transitionReceipts.length || recoveryPrestates.length || recoveryReceipts.length)) {
    fail('rollback machine operation evidence is bound to the wrong phase');
  }
  if (effect.phase !== 'RESTORE_VOLUME_CLEANUP' && cleanupReceipts.length) {
    fail('rollback restore-volume cleanup evidence is bound to the wrong phase');
  }
  if (effect.phase === 'RESTORE_VOLUME_CLEANUP') {
    if (effect.result === 'STARTED' && cleanupReceipts.length === 0) return;
    if (!cleanupReceipts.length) fail('rollback restore-volume cleanup evidence is absent');
    for (const [index, bytes] of cleanupReceipts.entries()) {
      const receipt = parseRollbackJson(bytes, `rollback restore-volume cleanup receipt ${index + 1}`);
      exactKeys(receipt, [
        'application', 'attempted_at', 'contract_version', 'disposition', 'error_sha256', 'force',
        'http_status', 'provider_mutation_calls_attempted', 'request_method', 'request_url',
        'post_volumes_sha256', 'pre_volumes_sha256', 'response_body_sha256', 'response_headers_sha256',
        'response_received', 'restore_volume_absent', 'restore_volume_id',
      ], 'rollback restore-volume cleanup receipt');
      if (receipt.contract_version !== 'assesssuite-physio-rollback-volume-cleanup/1.0.0' ||
          receipt.application !== PHYSIO_RELEASE_TARGET.app ||
          !['APPLIED', 'NOT_APPLIED', 'AMBIGUOUS'].includes(receipt.disposition) ||
          receipt.restore_volume_id !== effect.restore_volume_id || receipt.request_method !== 'DELETE' ||
          receipt.request_url !== `https://api.machines.dev/v1/apps/${PHYSIO_RELEASE_TARGET.app}/volumes/${effect.restore_volume_id}?force=false` ||
          receipt.force !== false || ![0, 1].includes(receipt.provider_mutation_calls_attempted) ||
          typeof receipt.response_received !== 'boolean' ||
          typeof receipt.restore_volume_absent !== 'boolean' ||
          !(receipt.http_status === null || Number.isSafeInteger(receipt.http_status)) ||
          ![receipt.pre_volumes_sha256, receipt.post_volumes_sha256,
            receipt.response_body_sha256, receipt.response_headers_sha256, receipt.error_sha256]
            .every((value) => value === null || /^[0-9a-f]{64}$/.test(value)) ||
          !Number.isFinite(Date.parse(receipt.attempted_at || ''))) {
        fail('rollback restore-volume cleanup receipt differs');
      }
    }
    if (effect.result === 'COMPLETED' && cleanupReceipts.at(-1) &&
        (parseRollbackJson(cleanupReceipts.at(-1), 'rollback restore-volume final cleanup receipt').disposition !== 'APPLIED' ||
         parseRollbackJson(cleanupReceipts.at(-1), 'rollback restore-volume final cleanup receipt').restore_volume_absent !== true ||
         !parseRollbackJson(cleanupReceipts.at(-1), 'rollback restore-volume final cleanup receipt').pre_volumes_sha256 ||
         !parseRollbackJson(cleanupReceipts.at(-1), 'rollback restore-volume final cleanup receipt').post_volumes_sha256 ||
         !cleanupReceipts.some((bytes) => parseRollbackJson(bytes,
           'rollback restore-volume cleanup mutation receipt').provider_mutation_calls_attempted === 1))) {
      fail('rollback restore-volume cleanup completion lacks applied reconciliation');
    }
    return;
  }
  if (effect.phase !== 'LIVE_MUTATION_STARTED') return;
  if (options.rollbackMode === 'exact-image' && effect.result === 'COMPLETED' && !transitionReceipts.length) {
    fail('rollback exact-image completion lacks machine config transition evidence');
  }
  if (transitionReceipts.length) {
    const prestate = packet.buffers.get('rollback-live-mutation-prestate.json');
    const sourceMachine = parseRollbackJson(prestate, 'rollback live transition prestate');
    for (let index = 0; index < transitionReceipts.length; index += 1) {
      validateRollbackMachineOperationReceipt(transitionReceipts[index], prestate,
        packet.buffers.get('rollback-target-machine-config.json'), options,
        { sourceImage: sourceMachine.config.image, targetImage: options.rollbackImmutableImage,
          requireApplied: effect.result === 'COMPLETED' && index === transitionReceipts.length - 1,
          label: `rollback machine config transition receipt ${index + 1}` });
    }
  }
  if (recoveryPrestates.length !== recoveryReceipts.length) {
    fail('rollback machine recovery evidence is incomplete');
  }
  for (let index = 0; index < recoveryReceipts.length; index += 1) {
    validateRollbackMachineOperationReceipt(recoveryReceipts[index], recoveryPrestates[index],
      packet.buffers.get('rollback-current-machine-config.json'), options,
      { sourceImage: options.rollbackImmutableImage, targetImage: options.currentImmutableImage,
        requireApplied: false, label: `rollback machine config recovery receipt ${index + 1}` });
  }
}

function validateRollbackProviderReadback(row, phase) {
  exactKeys(row, [
    'application', 'contract_version', 'machine_count', 'machines_sha256', 'observed_config_sha256',
    'machine_config_operation_receipt_sha256s', 'machine_config_recovery_prestate_sha256s',
    'machine_config_recovery_receipt_sha256s', 'restore_volume_cleanup_receipt_sha256s',
    'observed_image', 'observed_machine_id', 'observed_machine_state', 'observed_restore_volume_id',
    'observed_snapshot_id', 'observed_verifier_machine_id', 'observed_volume_id',
    'phase', 'readback_at', 'result', 'snapshot_count', 'snapshots_sha256',
    'volume_count', 'volumes_sha256',
  ], 'rollback provider readback');
  if (row.contract_version !== 'assesssuite-physio-rollback-provider-readback/1.0.0' ||
      !['NOT_OBSERVED', 'PASS', 'STARTED_UNRESOLVED'].includes(row.result) ||
      row.application !== PHYSIO_RELEASE_TARGET.app || row.phase !== phase ||
      !Number.isSafeInteger(row.machine_count) || row.machine_count < 0 ||
      !Number.isSafeInteger(row.volume_count) || row.volume_count < 0 ||
      !Number.isSafeInteger(row.snapshot_count) || row.snapshot_count < 0 ||
      ![row.machines_sha256, row.volumes_sha256, row.snapshots_sha256, row.observed_config_sha256]
        .every((value) => /^[0-9a-f]{64}$/.test(value || '')) ||
      ![row.machine_config_operation_receipt_sha256s, row.machine_config_recovery_prestate_sha256s,
        row.machine_config_recovery_receipt_sha256s, row.restore_volume_cleanup_receipt_sha256s]
        .every((values) => Array.isArray(values) && values.length <= 100 &&
          values.every((value) => /^[0-9a-f]{64}$/.test(value))) ||
      ![row.observed_machine_id, row.observed_verifier_machine_id]
        .every((value) => value === null || /^[0-9a-f]{14,32}$/i.test(value)) ||
      ![row.observed_volume_id, row.observed_restore_volume_id]
        .every((value) => value === null || /^vol_[A-Za-z0-9]+$/.test(value)) ||
      !(row.observed_snapshot_id === null || /^[A-Za-z0-9_-]{6,160}$/.test(row.observed_snapshot_id)) ||
      !(row.observed_machine_state === null || ['started', 'stopped'].includes(row.observed_machine_state)) ||
      !(row.observed_image === null || IMAGE_PATTERN.test(row.observed_image)) ||
      !Number.isFinite(Date.parse(row.readback_at || ''))) {
    fail('rollback provider readback differs');
  }
  return row;
}

const PHYSIO_ROLLBACK_PROVIDER_OPERATIONS = Object.freeze({
  STARTED: 'PLAN_ADMITTED',
  SNAPSHOT_COMPLETED: 'SAFETY_SNAPSHOT',
  RESTORE_VERIFIED: 'RESTORE_VERIFY',
  TARGET_VERIFIED: 'TARGET_VERIFY',
  LIVE_MUTATION_STARTED: 'LIVE_IMAGE_CONFIG_RESTORE',
  POST_RESTART_VERIFIED: 'EXACT_CONFIG_READINESS',
  RESTORE_VOLUME_CLEANUP: 'RESTORE_VOLUME_CLEANUP',
  COMPLETED: 'FINALIZE',
});

function validateRollbackEffectRow(effect, provider, options, context) {
  exactKeys(effect, [
    'application', 'authority_reference', 'capability_intent_id', 'completed_at',
    'contract_version', 'current_immutable_image', 'expected_machine_id', 'expected_volume_id',
    'failed_application_sha', 'initial_machine_state', 'observed_image', 'phase', 'phase_ordinal',
    'predecessor_phase_receipt_sha256', 'provider_calls_executed', 'provider_effect_id',
    'provider_operation', 'provider_operation_id_sha256', 'provider_readback_sha256',
    'result', 'result_machine_id', 'result_volume_id', 'restore_volume_id',
    'rollback_immutable_image', 'rollback_mode', 'rollback_release_sha', 'rollback_target_admission_sha256',
    'rollback_target_artifact_digest', 'rollback_target_artifact_id', 'rollback_target_config_sha256',
    'rollback_target_machine_config_sha256', 'rollback_target_receipt_sha256', 'snapshot_id',
    'started_at', 'verifier_machine_id',
  ], `rollback effect phase ${context.ordinal}`);
  const expectedOperation = PHYSIO_ROLLBACK_PROVIDER_OPERATIONS[effect.phase];
  const operationHash = sha256(`${effect.provider_effect_id}:${effect.phase}:${effect.provider_operation}`);
  const expectedProviderResult = effect.result === 'STARTED_UNRESOLVED'
    ? 'STARTED_UNRESOLVED'
    : effect.result === 'COMPLETED' ? 'PASS' : null;
  if (effect.contract_version !== PHYSIO_ROLLBACK_EFFECT_RECONCILIATION_CONTRACT_VERSION ||
      !['STARTED', 'COMPLETED', 'STARTED_UNRESOLVED'].includes(effect.result) ||
      effect.phase !== PHYSIO_ROLLBACK_PHASES[context.ordinal] || effect.phase_ordinal !== context.ordinal ||
      effect.application !== PHYSIO_RELEASE_TARGET.app ||
      effect.failed_application_sha !== options.failedApplicationSha ||
      effect.current_immutable_image !== options.currentImmutableImage ||
      effect.rollback_mode !== options.rollbackMode || effect.rollback_release_sha !== options.rollbackReleaseSha ||
      effect.rollback_immutable_image !== options.rollbackImmutableImage ||
      String(effect.rollback_target_artifact_id) !== String(options.rollbackTargetArtifactId) ||
      effect.rollback_target_artifact_digest !== options.rollbackTargetArtifactDigest ||
      effect.rollback_target_receipt_sha256 !== options.rollbackTargetReceiptSha256 ||
      effect.expected_machine_id !== options.expectedMachineId || effect.expected_volume_id !== options.expectedVolumeId ||
      effect.capability_intent_id !== options.capabilityIntentId || effect.authority_reference !== options.authorityReference ||
      effect.rollback_target_admission_sha256 !== context.targetAdmissionSha256 ||
      effect.rollback_target_config_sha256 !== context.targetConfigSha256 ||
      effect.rollback_target_machine_config_sha256 !== context.targetMachineConfigSha256 ||
      effect.provider_readback_sha256 !== context.providerReadbackSha256 ||
      effect.predecessor_phase_receipt_sha256 !== context.expectedPredecessorSha256 ||
      effect.provider_operation !== expectedOperation || effect.provider_operation_id_sha256 !== operationHash ||
      !/^[A-Za-z0-9._:-]{1,200}$/.test(effect.provider_effect_id || '') ||
      !Number.isSafeInteger(effect.provider_calls_executed) || effect.provider_calls_executed < 0 ||
      effect.provider_calls_executed > (context.ordinal === 0 || effect.phase === 'COMPLETED' ? 0 : 1) ||
      (effect.result === 'STARTED' && effect.provider_calls_executed !== 0) ||
      (context.ordinal < context.currentOrdinal && effect.result !== 'COMPLETED') ||
      (expectedProviderResult !== null && provider.result !== expectedProviderResult) ||
      (effect.result === 'STARTED' && !['NOT_OBSERVED', 'PASS'].includes(provider.result)) ||
      !((context.ordinal === 0 && effect.initial_machine_state === 'unknown') ||
        ['started', 'stopped'].includes(effect.initial_machine_state)) ||
      effect.observed_image !== provider.observed_image ||
      effect.snapshot_id !== provider.observed_snapshot_id ||
      effect.restore_volume_id !== provider.observed_restore_volume_id ||
      effect.verifier_machine_id !== provider.observed_verifier_machine_id ||
      (effect.result_machine_id !== null && effect.result_machine_id !== provider.observed_machine_id) ||
      (effect.result_volume_id !== null && effect.result_volume_id !== provider.observed_volume_id) ||
      !Number.isFinite(Date.parse(effect.started_at || '')) ||
      (effect.completed_at !== null && !Number.isFinite(Date.parse(effect.completed_at || ''))) ||
      (effect.result === 'STARTED' && effect.completed_at !== null) ||
      (effect.result !== 'STARTED' && effect.completed_at === null)) {
    fail(`rollback effect reconciliation phase ${context.ordinal} differs`);
  }
  if (effect.phase === 'SNAPSHOT_COMPLETED' && effect.result === 'COMPLETED' &&
      (!effect.snapshot_id || effect.snapshot_id !== provider.observed_snapshot_id)) {
    fail('rollback snapshot phase lacks exact snapshot readback');
  }
  if (effect.phase === 'RESTORE_VERIFIED' && effect.result === 'COMPLETED' &&
      (!effect.restore_volume_id || !effect.verifier_machine_id)) {
    fail('rollback restore phase lacks exact clone and verifier identities');
  }
  if (effect.phase === 'TARGET_VERIFIED' && effect.result === 'COMPLETED' &&
      options.rollbackMode === 'exact-image' && effect.observed_image !== options.rollbackImmutableImage) {
    fail('rollback target phase image differs');
  }
  if (effect.phase === 'LIVE_MUTATION_STARTED' && effect.result === 'COMPLETED') {
    const expectedLiveImage = options.rollbackMode === 'exact-image'
      ? options.rollbackImmutableImage
      : options.currentImmutableImage;
    if (effect.result_machine_id !== options.expectedMachineId || effect.observed_image !== expectedLiveImage ||
        provider.observed_machine_state !== (options.rollbackMode === 'exact-image' ? 'started' : 'stopped')) {
      fail('rollback live image/config phase differs');
    }
  }
  if (effect.phase === 'POST_RESTART_VERIFIED' && effect.result === 'COMPLETED' &&
      (effect.provider_calls_executed !== 0 || provider.volume_count !== 2 ||
       !effect.restore_volume_id ||
       provider.observed_machine_state !== (options.rollbackMode === 'exact-image' ? 'started' : 'stopped') ||
       effect.result_machine_id !== options.expectedMachineId ||
       effect.result_volume_id !== options.expectedVolumeId)) {
    fail('rollback post-restart phase differs');
  }
  if (effect.phase === 'RESTORE_VOLUME_CLEANUP' && effect.result === 'COMPLETED' &&
      (effect.provider_calls_executed !== 1 || provider.volume_count !== 1 ||
       !effect.restore_volume_id || provider.observed_restore_volume_id !== effect.restore_volume_id ||
       provider.observed_machine_state !== (options.rollbackMode === 'exact-image' ? 'started' : 'stopped') ||
       effect.result_machine_id !== options.expectedMachineId ||
       effect.result_volume_id !== options.expectedVolumeId)) {
    fail('rollback restore-volume cleanup phase differs');
  }
  if (effect.phase === 'COMPLETED' &&
      (effect.result !== 'COMPLETED' || effect.provider_calls_executed !== 0 ||
       provider.result !== 'PASS' || provider.observed_machine_state !==
         (options.rollbackMode === 'exact-image' ? 'started' : 'stopped'))) {
    fail('completed rollback reuse is not read-only terminal evidence');
  }
}

export function readAndValidatePhysioRollbackResumePacket(packetRoot, options) {
  const requiredOptions = [
    'failedApplicationSha', 'currentImmutableImage', 'rollbackMode', 'rollbackReleaseSha',
    'rollbackImmutableImage', 'rollbackTargetArtifactId', 'rollbackTargetArtifactDigest',
    'rollbackTargetReceiptSha256', 'expectedMachineId', 'expectedVolumeId',
    'capabilityIntentId', 'authorityReference',
  ];
  for (const name of requiredOptions) {
    if (typeof options?.[name] !== 'string' || options[name] === '') fail(`rollback option ${name} differs`);
  }
  const firstReleaseStop = options.rollbackMode === 'stop-first-release';
  if (!SHA_PATTERN.test(options.failedApplicationSha) || !IMAGE_PATTERN.test(options.currentImmutableImage) ||
      !['exact-image', 'stop-first-release'].includes(options.rollbackMode) ||
      !/^[0-9a-f]{14,32}$/i.test(options.expectedMachineId) ||
      !/^vol_[A-Za-z0-9]+$/.test(options.expectedVolumeId) ||
      !/^[A-Za-z0-9._:-]{1,160}$/.test(options.capabilityIntentId) ||
      !/^[A-Za-z0-9._:/-]{1,240}$/.test(options.authorityReference) ||
      (firstReleaseStop && (options.rollbackReleaseSha !== 'NOT-AVAILABLE' ||
        options.rollbackImmutableImage !== 'NOT-AVAILABLE' || options.rollbackTargetArtifactId !== '0' ||
        options.rollbackTargetArtifactDigest !== '0' ||
        options.rollbackTargetReceiptSha256 !== '0'.repeat(64))) ||
      (!firstReleaseStop && (!SHA_PATTERN.test(options.rollbackReleaseSha) ||
        !IMAGE_PATTERN.test(options.rollbackImmutableImage) || !/^[1-9][0-9]*$/.test(options.rollbackTargetArtifactId) ||
        !DIGEST_PATTERN.test(options.rollbackTargetArtifactDigest) ||
        !/^[0-9a-f]{64}$/.test(options.rollbackTargetReceiptSha256)))) {
    fail('rollback option identity differs');
  }
  const packet = readChecksummedRollbackPacket(packetRoot);
  const effectBytes = packet.buffers.get('rollback-effect-reconciliation.json');
  const providerBytes = packet.buffers.get('rollback-provider-readback.json');
  const targetBytes = packet.buffers.get('rollback-target-admission.json');
  const configBytes = packet.buffers.get('rollback-target-config.toml');
  const githubAdmissionBytes = packet.buffers.get('rollback-target-github-artifact-admission.json');
  const machineConfigBytes = packet.buffers.get('rollback-target-machine-config.json');
  const sourceDeployReceiptBytes = packet.buffers.get('rollback-target-source-deploy-receipt.json');
  const effect = parseRollbackJson(effectBytes, 'rollback-effect-reconciliation.json');
  const target = parseRollbackJson(targetBytes, 'rollback-target-admission.json');
  validateRollbackTargetAdmission(
    target,
    configBytes,
    machineConfigBytes,
    githubAdmissionBytes,
    sourceDeployReceiptBytes,
    options,
  );
  if (packet.phaseOrdinal >= PHYSIO_ROLLBACK_PHASES.indexOf('LIVE_MUTATION_STARTED')) {
    validateRollbackLiveMutationPrestate(packet, options);
  }
  let previousPhaseSha = '0'.repeat(64);
  for (let ordinal = 0; ordinal <= packet.phaseOrdinal; ordinal += 1) {
    const phase = PHYSIO_ROLLBACK_PHASES[ordinal];
    const phaseName = `rollback-phase-${String(ordinal).padStart(2, '0')}-${phase}.json`;
    const readbackName = `rollback-readback-${String(ordinal).padStart(2, '0')}-${phase}.json`;
    const phaseBytes = packet.buffers.get(phaseName);
    const readbackBytes = packet.buffers.get(readbackName);
    const phaseRow = parseRollbackJson(phaseBytes, phaseName);
    const readbackRow = validateRollbackProviderReadback(parseRollbackJson(readbackBytes, readbackName), phase);
    validateRollbackMachineOperationEvidence(packet, readbackRow, phaseRow, options);
    validateRollbackEffectRow(phaseRow, readbackRow, options, {
      ordinal,
      currentOrdinal: packet.phaseOrdinal,
      expectedPredecessorSha256: previousPhaseSha,
      providerReadbackSha256: sha256(readbackBytes),
      targetAdmissionSha256: sha256(targetBytes),
      targetConfigSha256: sha256(configBytes),
      targetMachineConfigSha256: sha256(machineConfigBytes),
    });
    previousPhaseSha = sha256(phaseBytes);
  }
  const currentPhaseName = `rollback-phase-${String(packet.phaseOrdinal).padStart(2, '0')}-${effect.phase}.json`;
  const currentReadbackName = `rollback-readback-${String(packet.phaseOrdinal).padStart(2, '0')}-${effect.phase}.json`;
  if (!effectBytes.equals(packet.buffers.get(currentPhaseName)) ||
      !providerBytes.equals(packet.buffers.get(currentReadbackName))) {
    fail('rollback current phase aliases differ from the append-only raw chain');
  }
  const phaseOrdinal = packet.phaseOrdinal;
  return Object.freeze({
    contractVersion: effect.contract_version,
    phase: effect.phase,
    phaseOrdinal,
    result: effect.result,
    resumeCompleted: effect.phase === 'COMPLETED' && effect.result === 'COMPLETED',
    effectReceiptSha256: sha256(effectBytes),
    targetAdmissionSha256: sha256(targetBytes),
    rollbackTargetConfigSha256: sha256(configBytes),
    rollbackTargetMachineConfigSha256: sha256(machineConfigBytes),
  });
}

export function validatePhysioReleaseSource(repoRoot) {
  const root = path.resolve(repoRoot);
  resolvePhysioReleaseCatalogueContract();
  const configPath = path.join(root, 'fly.physio.production.toml');
  const dockerfilePath = path.join(root, 'Dockerfile.physio');
  const config = normaliseLf(fs.readFileSync(configPath, 'utf8'));
  const dockerfile = normaliseLf(fs.readFileSync(dockerfilePath, 'utf8'));
  if (!config.endsWith('\n') || !dockerfile.endsWith('\n')) fail('release source must end in LF');
  if (config.includes('\t') || dockerfile.includes('\t')) fail('release source contains a tab');

  for (const [needle, label] of [
    [`app = "${PHYSIO_RELEASE_TARGET.app}"`, 'Physio Fly application'],
    [`primary_region = "${PHYSIO_RELEASE_TARGET.region}"`, 'Sydney primary region'],
    ['dockerfile = "Dockerfile.physio"', 'Physio Dockerfile binding'],
    [`PROFESSION = "${PHYSIO_RELEASE_TARGET.professionId}"`, 'profession binding'],
    [`DEFAULT_APP_ID = "${PHYSIO_RELEASE_TARGET.appId}"`, 'app identity binding'],
    ['SELFTEST = "0"', 'production self-test isolation'],
    ['PARITY_ASSURANCE_MODE = "0"', 'normal production database posture'],
    ['ALLOW_OPEN_REGISTRATION = "0"', 'invitation-only access posture'],
    ['OUTBOUND_EMAIL_ENABLED = "1"', 'real transactional email switch'],
    ['OUTBOUND_SMS_ENABLED = "0"', 'deliberately absent SMS switch'],
    ['PAYMENTS_ENABLED = "1"', 'real payments switch'],
    ['ALLOW_PAID_PROVIDER_PROBE = "0"', 'normal paid-provider probe posture'],
    ['LLM_REQUIRED = "1"', 'fail-loud AI provider posture'],
    ['GENERAL_CLINICAL_LLM_ENABLED = "1"', 'fully enabled clinical LLM posture'],
    ['OPENAI_MODEL_FAST = "gpt-4.1-mini-2025-04-14"', 'fast model snapshot pin'],
    ['OPENAI_MODEL_QUALITY = "gpt-4.1-2025-04-14"', 'quality model snapshot pin'],
    ['TRANSCRIPTION_ENABLED = "1"', 'transcription provider switch'],
    ['OPENAI_TRANSCRIBE_MODEL = "whisper-1"', 'transcription model pin'],
    ['DOCUMENT_EXTRACTION_ENABLED = "1"', 'document extraction provider switch'],
    ['DOCUMENT_EXTRACTION_UNDER_13_ENABLED = "1"', 'paediatric referral extraction'],
    ['OPENAI_HEALTH_DATA_TERMS_CONFIRMED = "1"', 'provider health-data terms posture'],
    [`EXPECTED_APP_URL = "${PHYSIO_RELEASE_TARGET.publicHostname}"`, 'public host identity'],
    ['UPLOADS_DIR = "/app/server/data/physio-uploads"', 'production upload mount binding'],
    ['SENTRY_ENVIRONMENT = "physio-production"', 'Sentry production environment'],
    ['EMAIL_FROM = "AssessSuite Physiotherapy <verification@assesssuite.com>"', 'Physio email sender identity'],
    ['EMAIL_REPLY_TO = "admin@assesssuite.com"', 'Physio email reply identity'],
    ['EMAIL_DOMAIN = "assesssuite.com"', 'Physio email domain identity'],
    ['STRIPE_TRIAL_PERIOD_DAYS = "30"', 'source-backed one-month Physio trial mapping'],
    [`source = "${PHYSIO_RELEASE_TARGET.volumeName}"`, 'isolated volume'],
    [`destination = "${PHYSIO_RELEASE_TARGET.mountPath}"`, 'data mount'],
    [`snapshot_retention = ${PHYSIO_RELEASE_TARGET.volumeSnapshotRetentionDays}`, 'snapshot retention'],
    ['scheduled_snapshots = true', 'scheduled snapshots'],
    ['min_machines_running = 1', 'one running machine'],
    ['memory = "512mb"', 'machine memory'],
    ['cpu_kind = "shared"', 'shared CPU'],
    ['cpus = 1', 'single CPU'],
  ]) exactCount(config, needle, 1, label);
  exactCount(config, '[[vm]]', 1, 'VM stanza');
  exactCount(config, '[mounts]', 1, 'mount stanza');
  for (const forbidden of [
    'ASSESSSUITE_DB_PATH',
    'ASSESSSUITE_DB_PATH_ACK',
    'OPENAI_CHAT_TEST_BASE_URL',
    'DOCUMENT_EXTRACTION_TEST_BASE_URL',
    'PHYSIO_EXACT_IMAGE_CANARY_MODE',
    'RUN_PHYSIO_EXACT_IMAGE_CANARY',
  ]) {
    if (config.includes(forbidden)) fail(`production Fly source contains forbidden ${forbidden}`);
  }

  for (const [needle, label] of [
    ['FROM node:24-slim@sha256:', 'digest-pinned Node base'],
    ['ARG RELEASE_SHA', 'release SHA build argument'],
    ['ARG BUILD_TIMESTAMP', 'build timestamp argument'],
    ['PROFESSION=physio', 'image profession binding'],
    ['DEFAULT_APP_ID=local-assesssuite-physio', 'image app identity'],
    ['VITE_PROFESSION=physio', 'browser profession binding'],
    ['VITE_BASE44_APP_ID=local-assesssuite-physio', 'browser app identity'],
    ['RUN npm run catalogue:physio:check', 'catalogue generation check'],
    ['RUN npm run build:physio', 'Physio production build'],
    ['node server/productionBootstrap.mjs', 'database bootstrap'],
    ['exec node server/index.mjs', 'production server entrypoint'],
    ['VITE_SENTRY_RELEASE=physio-production@${RELEASE_SHA}', 'browser Sentry release binding'],
    ['SENTRY_RELEASE=physio-production@${RELEASE_SHA}', 'server Sentry release binding'],
  ]) {
    if (!dockerfile.includes(needle)) fail(`missing ${label}`);
  }
  if (/\b(?:mock|placeholder|synthetic)[-_a-z0-9]*\s*=\s*(?:1|true)/i.test(config + '\n' + dockerfile)) {
    fail('production source enables a mock, placeholder, or synthetic mode');
  }
  return Object.freeze({
    contractVersion: PHYSIO_RELEASE_CONTRACT_VERSION,
    configSha256: sha256Lf(config),
    dockerfileSha256: sha256Lf(dockerfile),
  });
}

function readOption(args, name, { required = true, fallback = '' } = {}) {
  const index = args.indexOf(name);
  if (index === -1) {
    if (required) fail(`missing ${name}`);
    return fallback;
  }
  if (index + 1 >= args.length || args[index + 1].startsWith('--')) fail(`${name} lacks a value`);
  return args[index + 1];
}

function verifyOptionalHash(actual, expected, label) {
  if (expected && !/^[0-9a-f]{64}$/.test(expected)) fail(`${label} expected hash shape differs`);
  if (expected && actual !== expected) fail(`${label} hash ${actual} differs from pinned ${expected}`);
}

function deployOptionsFromArgs(args) {
  return {
    applicationSha: readOption(args, '--application-sha'),
    immutableImage: readOption(args, '--immutable-image'),
    publicationReceiptSha256: readOption(args, '--publication-receipt-sha256'),
    canaryReceiptSha256: readOption(args, '--canary-receipt-sha256'),
    bootstrapReceiptSha256: readOption(args, '--bootstrap-receipt-sha256'),
    stripeWebhookReceiptSha256: readOption(args, '--stripe-webhook-receipt-sha256'),
    sentryReleaseReceiptSha256: readOption(args, '--sentry-release-receipt-sha256'),
    configSha256: readOption(args, '--config-sha256'),
    upstreamArtifactMetadataSha256: readOption(args, '--upstream-artifact-metadata-sha256'),
    expectedVolumeId: readOption(args, '--expected-volume-id'),
    capabilityIntentId: readOption(args, '--capability-intent-id'),
    authorityReference: readOption(args, '--authority-reference'),
    publicationCapabilityIntentId: readOption(args, '--publication-capability-intent-id'),
    publicationAuthorityReference: readOption(args, '--publication-authority-reference'),
    bootstrapCapabilityIntentId: readOption(args, '--bootstrap-capability-intent-id'),
    bootstrapAuthorityReference: readOption(args, '--bootstrap-authority-reference'),
    canaryCapabilityIntentId: readOption(args, '--canary-capability-intent-id'),
    canaryAuthorityReference: readOption(args, '--canary-authority-reference'),
    stripeWebhookCapabilityIntentId: readOption(args, '--stripe-webhook-capability-intent-id'),
    stripeWebhookAuthorityReference: readOption(args, '--stripe-webhook-authority-reference'),
    sentryCapabilityIntentId: readOption(args, '--sentry-capability-intent-id'),
    sentryAuthorityReference: readOption(args, '--sentry-authority-reference'),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (command === 'validate-source') {
    const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const root = readOption(args, '--root', { required: false, fallback: defaultRoot });
    const result = validatePhysioReleaseSource(root);
    verifyOptionalHash(result.configSha256, readOption(args, '--config-sha256', { required: false }), 'config');
    verifyOptionalHash(result.dockerfileSha256, readOption(args, '--dockerfile-sha256', { required: false }), 'Dockerfile');
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === 'collect-loopback-runtime') {
    const result = await collectLoopbackRuntimeEvidence();
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === 'write-catalogue-environment') {
    const githubEnvironment = readOption(args, '--github-env');
    if (!path.isAbsolute(githubEnvironment)) fail('GitHub environment path must be absolute');
    fs.appendFileSync(githubEnvironment, renderPhysioReleaseCatalogueEnvironment(), { encoding: 'utf8' });
    return;
  }
  if (command === 'inspect-app') {
    const result = inspectApplication({
      applicationsPayload: readJsonFile(readOption(args, '--apps')),
      mode: readOption(args, '--mode'),
      expectedOrganization: readOption(args, '--organization', { required: false }),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === 'inspect-org') {
    const result = inspectOrganization({
      organizationPayload: readJsonFile(readOption(args, '--organization-readback')),
      expectedSlug: readOption(args, '--organization'),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === 'inspect-topology') {
    const result = inspectTopology({
      machinesPayload: readJsonFile(readOption(args, '--machines')),
      volumesPayload: readJsonFile(readOption(args, '--volumes')),
      mode: readOption(args, '--mode'),
      expectedVolumeId: readOption(args, '--volume-id', { required: false }),
      expectedMachineId: readOption(args, '--machine-id', { required: false }),
      expectedImageRef: readOption(args, '--image', { required: false }),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === 'inspect-no-certificates') {
    const result = inspectCertificateInventory(
      readJsonFile(readOption(args, '--certificates')),
      { mode: readOption(args, '--mode', { required: false, fallback: 'absent' }) },
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === 'inspect-snapshot') {
    const result = inspectSnapshot({
      snapshotsPayload: readJsonFile(readOption(args, '--snapshots')),
      expectedSnapshotId: readOption(args, '--snapshot-id', { required: false }),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === 'validate-presnapshot-manifest') {
    const result = validatePhysioPresnapshotManifestReceipt(
      readJsonFile(readOption(args, '--manifest')),
      { snapshotSentinel: readOption(args, '--snapshot-sentinel') },
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (command === 'validate-deploy-resume-packet') {
    const result = readAndValidatePhysioDeployResumePacket(
      readOption(args, '--packet'),
      deployOptionsFromArgs(args),
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (command === 'write-deploy-admission') {
    const options = deployOptionsFromArgs(args);
    const result = writePhysioDeployAdmission({
      outputPath: readOption(args, '--output'),
      options: {
        ...options,
        configPath: readOption(args, '--config'),
      },
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (command === 'write-deploy-provider-request') {
    const effectOrdinal = Number(readOption(args, '--effect-ordinal'));
    const intendedResourceId = readOption(args, '--intended-resource-id', {
      required: false,
      fallback: '',
    });
    const result = writePhysioDeployProviderRequest({
      outputPath: readOption(args, '--output'),
      kind: readOption(args, '--kind'),
      effectOrdinal,
      intendedResourceId: intendedResourceId || null,
      argvPath: readOption(args, '--argv'),
      options: deployOptionsFromArgs(args),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (command === 'write-deploy-provider-readback') {
    const optional = (name) => readOption(args, name, { required: false, fallback: '' }) || null;
    const result = writePhysioDeployProviderReadback({
      outputPath: readOption(args, '--output'),
      phase: readOption(args, '--phase'),
      result: readOption(args, '--result'),
      machinesPath: readOption(args, '--machines'),
      volumesPath: readOption(args, '--volumes'),
      snapshotsPath: readOption(args, '--snapshots'),
      observedMachineId: optional('--observed-machine-id'),
      observedVolumeId: optional('--observed-volume-id'),
      observedRestoreVolumeId: optional('--observed-restore-volume-id'),
      observedVerifierMachineId: optional('--observed-verifier-machine-id'),
      observedPredeploySnapshotId: optional('--observed-predeploy-snapshot-id'),
      observedPostdeploySnapshotId: optional('--observed-postdeploy-snapshot-id'),
      observedSentryDeploymentIdSha256: optional('--observed-sentry-deployment-id-sha256'),
      operationKind: optional('--operation-kind'),
      operationEffectId: optional('--operation-effect-id'),
      operationRequestSha256: optional('--operation-request-sha256'),
      operationResourceId: optional('--operation-resource-id'),
      operationProviderRequestIdSha256: optional('--operation-provider-request-id-sha256'),
      operationReceiptPath: optional('--operation-receipt'),
      operationDisposition: readOption(args, '--operation-disposition', {
        required: false,
        fallback: 'NONE',
      }),
      runtimeLivePath: optional('--runtime-live'),
      runtimeReadyPath: optional('--runtime-ready'),
      runtimeVersionPath: optional('--runtime-version'),
      runtimeCapabilitiesPath: optional('--runtime-capabilities'),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (command === 'write-deploy-derived-provider-readback') {
    const optional = (name) => readOption(args, name, { required: false, fallback: '' }) || null;
    const result = writePhysioDeployDerivedProviderReadback({
      sourcePacketRoot: readOption(args, '--source-packet'),
      outputPath: readOption(args, '--output'),
      phase: readOption(args, '--phase'),
      result: readOption(args, '--result'),
      operationKind: readOption(args, '--operation-kind'),
      operationEffectId: readOption(args, '--operation-effect-id'),
      operationRequestSha256: readOption(args, '--operation-request-sha256'),
      operationResourceId: readOption(args, '--operation-resource-id'),
      operationProviderRequestIdSha256: optional('--operation-provider-request-id-sha256'),
      operationReceiptPath: optional('--operation-receipt'),
      operationDisposition: readOption(args, '--operation-disposition'),
      observedSentryDeploymentIdSha256: optional('--observed-sentry-deployment-id-sha256'),
      options: deployOptionsFromArgs(args),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (command === 'write-deploy-started-packet') {
    const result = writeInitialPhysioDeployPacket({
      outputPacketRoot: readOption(args, '--output-packet'),
      admissionPath: readOption(args, '--admission'),
      configPath: readOption(args, '--config'),
      providerReadbackPath: readOption(args, '--provider-readback'),
      providerRequestPath: readOption(args, '--provider-request'),
      prestateSha256: readOption(args, '--prestate-sha256'),
      options: deployOptionsFromArgs(args),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (command === 'advance-deploy-packet') {
    const requestPath = readOption(args, '--provider-request', { required: false });
    const requestIdSha = readOption(args, '--provider-request-id-sha256', { required: false });
    const observedResource = readOption(args, '--observed-resource-id', { required: false });
    const exitCode = readOption(args, '--provider-exit-code', { required: false });
    const result = writeNextPhysioDeployPacket({
      sourcePacketRoot: readOption(args, '--source-packet'),
      outputPacketRoot: readOption(args, '--output-packet'),
      phase: readOption(args, '--phase'),
      result: readOption(args, '--result'),
      providerReadbackPath: readOption(args, '--provider-readback'),
      providerRequestPath: requestPath || null,
      prestateSha256: readOption(args, '--prestate-sha256', { required: false }) || null,
      providerExitCode: exitCode === '' ? null : Number(exitCode),
      providerRequestIdSha256: requestIdSha || null,
      observedResourceId: observedResource || null,
      reconciliationDisposition: readOption(args, '--reconciliation-disposition', {
        required: false,
        fallback: '',
      }) || null,
      operationReceiptPath: readOption(args, '--operation-receipt', { required: false }) || null,
      options: deployOptionsFromArgs(args),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (command === 'validate-rollback-resume-packet') {
    const rollbackMode = readOption(args, '--rollback-mode');
    const result = readAndValidatePhysioRollbackResumePacket(
      readOption(args, '--packet'),
      {
        failedApplicationSha: readOption(args, '--failed-application-sha'),
        currentImmutableImage: readOption(args, '--current-immutable-image'),
        rollbackMode,
        rollbackReleaseSha: readOption(args, '--rollback-release-sha'),
        rollbackImmutableImage: readOption(args, '--rollback-immutable-image'),
        rollbackTargetArtifactId: readOption(args, '--rollback-target-artifact-id'),
        rollbackTargetArtifactDigest: readOption(args, '--rollback-target-artifact-digest'),
        rollbackTargetReceiptSha256: readOption(args, '--rollback-target-receipt-sha256'),
        expectedMachineId: readOption(args, '--expected-machine-id'),
        expectedVolumeId: readOption(args, '--expected-volume-id'),
        capabilityIntentId: readOption(args, '--capability-intent-id'),
        authorityReference: readOption(args, '--authority-reference'),
      },
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (command === 'inspect-restore-verifier') {
    const result = inspectRestoreVerifierTopology({
      machinesPayload: readJsonFile(readOption(args, '--machines')),
      volumesPayload: readJsonFile(readOption(args, '--volumes')),
      productionMachineId: readOption(args, '--production-machine-id'),
      primaryVolumeId: readOption(args, '--primary-volume-id'),
      restoreVolumeId: readOption(args, '--restore-volume-id'),
      verifierMachineName: readOption(args, '--verifier-machine-name'),
      verifierRole: readOption(args, '--verifier-role'),
      expectedImageRef: readOption(args, '--image'),
      expectedApplicationSha: readOption(args, '--sha'),
      expectedProductionState: readOption(args, '--production-state', { required: false, fallback: 'stopped' }),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === 'inspect-first-release-recovery-verifier') {
    const result = inspectFirstReleaseRecoveryVerifierTopology({
      machinesPayload: readJsonFile(readOption(args, '--machines')),
      volumesPayload: readJsonFile(readOption(args, '--volumes')),
      originalVolumeId: readOption(args, '--original-volume-id'),
      recoveryVolumeId: readOption(args, '--recovery-volume-id'),
      verifierMachineName: readOption(args, '--verifier-machine-name'),
      verifierRole: readOption(args, '--verifier-role'),
      expectedImageRef: readOption(args, '--image'),
      expectedApplicationSha: readOption(args, '--sha'),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  if (command === 'validate-runtime') {
    const result = validateRuntimeEvidence({
      live: readJsonFile(readOption(args, '--live')),
      ready: readJsonFile(readOption(args, '--ready')),
      version: readJsonFile(readOption(args, '--version')),
      capabilities: readJsonFile(readOption(args, '--capabilities')),
      expectedSha: readOption(args, '--sha'),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  process.stderr.write(
    'usage: node scripts/physio-release-contract.mjs '
    + '<validate-source|write-catalogue-environment|inspect-org|inspect-app|inspect-topology|inspect-restore-verifier|inspect-first-release-recovery-verifier|inspect-no-certificates|inspect-snapshot|validate-presnapshot-manifest|validate-deploy-resume-packet|write-deploy-admission|write-deploy-provider-request|write-deploy-provider-readback|write-deploy-derived-provider-readback|write-deploy-started-packet|advance-deploy-packet|validate-rollback-resume-packet|validate-runtime> [options]\n',
  );
  process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  });
}
