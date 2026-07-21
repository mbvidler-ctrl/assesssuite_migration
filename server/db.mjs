// SQLite persistence layer for the local Base44 shim.
// Uses node:sqlite (DatabaseSync) — a Node 24 built-in, zero new dependencies.

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

export const PARITY_ASSURANCE_DB_PATH = '/app/server/data/assesssuite-parity.db';

/**
 * Database overrides are permitted only for the existing isolated test
 * harness or for the one exact production parity database. The parity case is
 * intentionally duplicated here even though productionBootstrap validates
 * the same value, so bypassing that bootstrap cannot widen the filesystem
 * target.
 */
export function isDatabaseOverrideAllowed(environment = process.env, override = environment.ASSESSSUITE_DB_PATH) {
  if (!override) return true;
  const isolatedGateHarness =
    environment.NODE_ENV === 'test' &&
    environment.ASSESSSUITE_DB_PATH_ACK ===
      'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE';
  const isolatedProductionParity =
    environment.NODE_ENV === 'production' &&
    environment.PARITY_ASSURANCE_MODE === '1' &&
    override === PARITY_ASSURANCE_DB_PATH;
  return isolatedGateHarness || isolatedProductionParity;
}

const entitySchemasPath = path.join(
  __dirname,
  '..',
  'docs',
  'source-capture',
  '20260702-live-entity-schemas.json',
);

/**
 * Loads the captured entity schema list, returning the array of
 * { entity_name, entity_schema } entries. `User` is included as a captured
 * entity (its schema carries only the custom fields; auth fields such as
 * role/email/password_hash live inside the JSON blob alongside them).
 */
/** Reads capture + local schema entries as one array. */
function loadAllSchemaEntries() {
  const parsed = JSON.parse(fs.readFileSync(entitySchemasPath, 'utf8'));
  const entries = [...parsed.schemas];
  // Local-only entities absent from the live capture. The capture file stays
  // pristine (it is provenance evidence); additions live beside the shim.
  // Payment: imported by src/entities/all.js and used by Finances.jsx, but
  // never registered on the live platform — the page could never load data.
  const localSchemasPath = path.join(__dirname, 'local-entity-schemas.json');
  if (fs.existsSync(localSchemasPath)) {
    const local = JSON.parse(fs.readFileSync(localSchemasPath, 'utf8'));
    for (const entry of local.schemas) {
      if (!entries.some((e) => e.entity_name === entry.entity_name)) entries.push(entry);
    }
  }
  return entries;
}

export function loadEntityNames() {
  return loadAllSchemaEntries().map((entry) => entry.entity_name);
}

/**
 * The set of entity names whose schema carries an org_id property — i.e. the
 * tenant-scoped entities. Derived statically from the schemas rather than by
 * sampling stored data, so an empty collection or a null-org_id row can never
 * silently disable scoping (a fail-open the runtime heuristic suffered from).
 */
export function loadOrgScopedEntities() {
  return new Set(
    loadAllSchemaEntries()
      .filter((entry) => 'org_id' in (entry.entity_schema?.properties || {}))
      .map((entry) => entry.entity_name),
  );
}

/**
 * Opens (creating if absent) the shim's SQLite database and ensures every
 * table required by the contract exists. SELFTEST=1 uses a dedicated,
 * freshly-recreated database file so self-test runs never pollute dev data.
 */
export function openDatabase() {
  const isSelftest = process.env.SELFTEST === '1';
  const override = process.env.ASSESSSUITE_DB_PATH;
  if (!isDatabaseOverrideAllowed(process.env, override)) {
    throw new Error(
      'ASSESSSUITE_DB_PATH is permitted only under the explicit isolated gate harness or exact production parity path',
    );
  }
  const dbFile = override ? path.resolve(override) : path.join(dataDir, isSelftest ? 'selftest.db' : 'app.db');
  if (override && path.extname(dbFile).toLowerCase() !== '.db') {
    throw new Error('ASSESSSUITE_DB_PATH must identify an exact .db file');
  }
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });

  if (isSelftest) {
    // Remove the main db file plus any WAL/SHM siblings from a prior run so
    // the self-test always starts from a genuinely empty database.
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const candidate = `${dbFile}${suffix}`;
      if (fs.existsSync(candidate)) fs.rmSync(candidate);
    }
  }

  const db = new DatabaseSync(dbFile);
  db.exec('PRAGMA journal_mode = WAL;');

  const entityNames = loadEntityNames();

  for (const entityName of entityNames) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS entity_${entityName} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_date TEXT NOT NULL,
        updated_date TEXT NOT NULL,
        created_by TEXT
      );
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_date TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS outbox_email (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_date TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS outbox_sms (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_date TEXT NOT NULL
    );
  `);

  // Uploads are intentionally not modelled as a generic Base44 entity. They
  // carry security and lifecycle invariants that must be enforced in SQL and
  // must never be writable through the generic entity API.
  db.exec(`
    CREATE TABLE IF NOT EXISTS upload_registry (
      id TEXT PRIMARY KEY,
      stored_name TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      org_id TEXT NOT NULL,
      uploader_user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      detected_mime TEXT NOT NULL,
      byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
      sha256 TEXT NOT NULL,
      lifecycle_state TEXT NOT NULL CHECK (
        lifecycle_state IN ('registering', 'temporary', 'processing', 'review-pending', 'bound', 'expired', 'deleted')
      ),
      subject_age_band TEXT NOT NULL DEFAULT 'unknown' CHECK (
        subject_age_band IN ('unknown', 'under_13', '13_or_over')
      ),
      created_at TEXT NOT NULL,
      expires_at TEXT,
      bound_at TEXT,
      deleted_at TEXT,
      bound_entity_type TEXT,
      bound_entity_id TEXT,
      is_legacy INTEGER NOT NULL DEFAULT 0 CHECK (is_legacy IN (0, 1))
    );

    CREATE INDEX IF NOT EXISTS idx_upload_registry_org_state
      ON upload_registry (org_id, lifecycle_state);
    CREATE INDEX IF NOT EXISTS idx_upload_registry_uploader_created
      ON upload_registry (uploader_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_upload_registry_expiry
      ON upload_registry (expires_at, lifecycle_state);

    CREATE TABLE IF NOT EXISTS upload_disposition (
      upload_id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (
        status IN ('review-required', 'retained', 'transferred', 'deleted')
      ),
      reason_code TEXT NOT NULL,
      planned_action TEXT NOT NULL,
      review_due_at TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_upload_disposition_due
      ON upload_disposition (status, review_due_at);

    CREATE TABLE IF NOT EXISTS upload_audit (
      id TEXT PRIMARY KEY,
      upload_id TEXT,
      org_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      outcome TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      legal_hold INTEGER NOT NULL DEFAULT 0 CHECK (legal_hold IN (0, 1))
    );

    CREATE INDEX IF NOT EXISTS idx_upload_audit_org_created
      ON upload_audit (org_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_upload_audit_expiry
      ON upload_audit (expires_at, legal_hold);

    CREATE TABLE IF NOT EXISTS extraction_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      upload_count INTEGER NOT NULL CHECK (upload_count > 0),
      estimated_cost_microusd INTEGER NOT NULL CHECK (estimated_cost_microusd >= 0),
      actual_cost_microusd INTEGER,
      status TEXT NOT NULL CHECK (status IN ('reserved', 'succeeded', 'failed')),
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_extraction_usage_user_created
      ON extraction_usage (user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_extraction_usage_org_created
      ON extraction_usage (org_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_extraction_usage_created
      ON extraction_usage (created_at);

    -- A reviewed referral spans several ordinary entity tables plus the
    -- upload registry. Keep its retry receipt outside the generic entity API:
    -- callers must never be able to forge, enumerate or mutate idempotency
    -- state through base44.entities.*.
    CREATE TABLE IF NOT EXISTS referral_commit_receipt (
      idempotency_key TEXT PRIMARY KEY,
      request_sha256 TEXT NOT NULL CHECK (length(request_sha256) = 64),
      actor_user_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('create', 'update')),
      client_id TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_referral_commit_receipt_actor_created
      ON referral_commit_receipt (actor_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_referral_commit_receipt_org_created
      ON referral_commit_receipt (org_id, created_at);
  `);

  // Existing production databases predate the crash-safe `registering`
  // lifecycle. SQLite cannot widen a CHECK constraint in place, so rebuild
  // only this internal table in one transaction when the recorded DDL lacks
  // the new state. No generic entity or clinical row is involved.
  const uploadRegistryDdl = String(
    db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'upload_registry'").get()?.sql || '',
  );
  if (!uploadRegistryDdl.includes("'registering'")) {
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE upload_registry_registering_migration (
        id TEXT PRIMARY KEY,
        stored_name TEXT NOT NULL UNIQUE,
        original_name TEXT NOT NULL,
        org_id TEXT NOT NULL,
        uploader_user_id TEXT NOT NULL,
        purpose TEXT NOT NULL,
        detected_mime TEXT NOT NULL,
        byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
        sha256 TEXT NOT NULL,
        lifecycle_state TEXT NOT NULL CHECK (
          lifecycle_state IN ('registering', 'temporary', 'processing', 'review-pending', 'bound', 'expired', 'deleted')
        ),
        subject_age_band TEXT NOT NULL DEFAULT 'unknown' CHECK (
          subject_age_band IN ('unknown', 'under_13', '13_or_over')
        ),
        created_at TEXT NOT NULL,
        expires_at TEXT,
        bound_at TEXT,
        deleted_at TEXT,
        bound_entity_type TEXT,
        bound_entity_id TEXT,
        is_legacy INTEGER NOT NULL DEFAULT 0 CHECK (is_legacy IN (0, 1))
      );
      INSERT INTO upload_registry_registering_migration (
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, bound_at, deleted_at, bound_entity_type,
        bound_entity_id, is_legacy
      )
      SELECT
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, bound_at, deleted_at, bound_entity_type,
        bound_entity_id, is_legacy
      FROM upload_registry;
      DROP TABLE upload_registry;
      ALTER TABLE upload_registry_registering_migration RENAME TO upload_registry;
      CREATE INDEX idx_upload_registry_org_state
        ON upload_registry (org_id, lifecycle_state);
      CREATE INDEX idx_upload_registry_uploader_created
        ON upload_registry (uploader_user_id, created_at);
      CREATE INDEX idx_upload_registry_expiry
        ON upload_registry (expires_at, lifecycle_state);
      COMMIT;
    `);
  }

  return { db, entityNames: new Set(entityNames) };
}

/**
 * Converts a stored row ({ id, data, created_date, updated_date, created_by })
 * into the client-facing record shape: platform built-ins spread with the
 * parsed JSON payload.
 */
function rowToRecord(row) {
  const payload = JSON.parse(row.data);
  return {
    id: row.id,
    created_date: row.created_date,
    updated_date: row.updated_date,
    created_by: row.created_by,
    ...payload,
  };
}

/**
 * Thin repository wrapping CRUD + query operations for a single entity table.
 * `entityName` must already be a known, validated table (guarded upstream by
 * the router against the captured entity-name set) to avoid SQL injection
 * via table-name interpolation.
 */
export function createEntityRepository(db, entityName) {
  const table = `entity_${entityName}`;

  function listAll() {
    const stmt = db.prepare(`SELECT * FROM ${table}`);
    return stmt.all().map(rowToRecord);
  }

  function getById(id) {
    const stmt = db.prepare(`SELECT * FROM ${table} WHERE id = ?`);
    const row = stmt.get(id);
    return row ? rowToRecord(row) : null;
  }

  function create(data, createdBy) {
    const now = new Date().toISOString();
    const id = randomUUID();
    const { id: _ignoredId, created_date: _cd, updated_date: _ud, created_by: _cb, ...rest } = data || {};
    const stmt = db.prepare(
      `INSERT INTO ${table} (id, data, created_date, updated_date, created_by) VALUES (?, ?, ?, ?, ?)`,
    );
    stmt.run(id, JSON.stringify(rest), now, now, createdBy ?? null);
    return getById(id);
  }

  function update(id, data) {
    const existing = getById(id);
    if (!existing) return null;
    const {
      id: _ignoredId,
      created_date: _cd,
      updated_date: _ud,
      created_by: _cb,
      ...existingRest
    } = existing;
    const { id: _i2, created_date: _c2, updated_date: _u2, created_by: _c3, ...incoming } = data || {};
    const merged = { ...existingRest, ...incoming };
    const now = new Date().toISOString();
    const stmt = db.prepare(`UPDATE ${table} SET data = ?, updated_date = ? WHERE id = ?`);
    stmt.run(JSON.stringify(merged), now, id);
    return getById(id);
  }

  function remove(id) {
    const stmt = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
    const info = stmt.run(id);
    return info.changes > 0;
  }

  return { listAll, getById, create, update, remove, table };
}

/**
 * Repository for the sessions table (opaque token -> user_id).
 */
export function createSessionRepository(db) {
  function create(userId) {
    const token = randomUUID() + randomUUID();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, created_date) VALUES (?, ?, ?)').run(
      token,
      userId,
      now,
    );
    return token;
  }

  function findByToken(token) {
    const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    return row || null;
  }

  function remove(token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  return { create, findByToken, remove };
}

/**
 * Repository for the outbox tables (mocked email/SMS sends).
 */
export function createOutboxRepository(db, kind) {
  const table = kind === 'sms' ? 'outbox_sms' : 'outbox_email';
  function record(payload) {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO ${table} (id, payload, created_date) VALUES (?, ?, ?)`).run(
      id,
      JSON.stringify(payload),
      now,
    );
    return id;
  }
  function listAll() {
    return db
      .prepare(`SELECT * FROM ${table} ORDER BY created_date ASC`)
      .all()
      .map((row) => ({ id: row.id, created_date: row.created_date, ...JSON.parse(row.payload) }));
  }
  return { record, listAll };
}
