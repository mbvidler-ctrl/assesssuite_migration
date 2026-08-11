// SQLite persistence layer for the local Base44 shim.
// Uses node:sqlite (DatabaseSync) — a Node 24 built-in, zero new dependencies.

import { DatabaseSync } from 'node:sqlite';

import { ensureApiUsageSchema } from './apiUsage.mjs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

export const PARITY_ASSURANCE_DB_PATH = '/app/server/data/assesssuite-parity.db';
export const SESSION_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;
export const SESSION_MAX_CONCURRENT_PER_USER = 8;

const SESSION_STORE_TABLE = 'session_records';

/**
 * Migrates the legacy sessions table to a rollback-compatible backing table.
 *
 * The retained rollback image still inserts three columns and selects directly
 * from `sessions`. Keeping that name as a filtered view, with INSTEAD OF
 * triggers, means the older binary receives the same eight-hour absolute
 * timeout from SQLite itself. It cannot see expired rows or mint an unbounded
 * null-expiry session after rollback.
 */
export function ensureSessionSchema(db) {
  let migrated = false;
  let revokedSessions = 0;

  db.exec('BEGIN IMMEDIATE');
  try {
    const sessionsObject = db
      .prepare("SELECT type FROM sqlite_master WHERE name = 'sessions'")
      .get();
    const storeObject = db
      .prepare("SELECT type FROM sqlite_master WHERE name = 'session_records'")
      .get();

    if (storeObject && storeObject.type !== 'table') {
      throw new Error('session_records exists but is not a table');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS ${SESSION_STORE_TABLE} (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_date TEXT NOT NULL,
        expires_date TEXT NOT NULL
      );

      DROP TRIGGER IF EXISTS session_records_insert_guard;
      DROP TRIGGER IF EXISTS session_records_update_guard;
    `);

    if (sessionsObject?.type === 'table') {
      const legacyCount = Number(
        db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count || 0,
      );
      const columns = db.prepare('PRAGMA table_info(sessions)').all();
      const hasExpiry = columns.some((column) => column.name === 'expires_date');
      let preserved = 0;

      if (hasExpiry) {
        preserved = Number(
          db
            .prepare(`
              SELECT COUNT(*) AS count
              FROM sessions
              WHERE created_date IS NOT NULL
                AND julianday(created_date) IS NOT NULL
                AND julianday(created_date) <= julianday('now', '+1 second')
                AND expires_date IS NOT NULL
                AND julianday(expires_date) IS NOT NULL
                AND julianday(expires_date) > julianday('now')
                AND julianday(expires_date) > julianday(created_date)
                AND julianday(expires_date) <= julianday(created_date, '+8 hours')
            `)
            .get().count || 0,
        );
        db.exec(`
          INSERT OR REPLACE INTO ${SESSION_STORE_TABLE}
            (token, user_id, created_date, expires_date)
          SELECT
            token,
            user_id,
            created_date,
            strftime('%Y-%m-%dT%H:%M:%fZ', expires_date)
          FROM sessions
          WHERE created_date IS NOT NULL
            AND julianday(created_date) IS NOT NULL
            AND julianday(created_date) <= julianday('now', '+1 second')
            AND expires_date IS NOT NULL
            AND julianday(expires_date) IS NOT NULL
            AND julianday(expires_date) > julianday('now')
            AND julianday(expires_date) > julianday(created_date)
            AND julianday(expires_date) <= julianday(created_date, '+8 hours');
        `);
      }

      revokedSessions += legacyCount - preserved;
      db.exec('DROP TABLE sessions;');
      migrated = true;
    } else if (sessionsObject && sessionsObject.type !== 'view') {
      throw new Error('sessions exists but is neither a table nor a view');
    }

    db.exec(`
      DROP TRIGGER IF EXISTS sessions_insert;
      DROP TRIGGER IF EXISTS sessions_delete;
      DROP VIEW IF EXISTS sessions;

      CREATE INDEX IF NOT EXISTS idx_session_records_expires_date
        ON ${SESSION_STORE_TABLE}(expires_date);
      CREATE INDEX IF NOT EXISTS idx_session_records_expires_julianday
        ON ${SESSION_STORE_TABLE}(julianday(expires_date));
      CREATE INDEX IF NOT EXISTS idx_session_records_user_id
        ON ${SESSION_STORE_TABLE}(user_id);
      CREATE INDEX IF NOT EXISTS idx_session_records_user_created_token
        ON ${SESSION_STORE_TABLE}(user_id, created_date DESC, token DESC);
    `);

    const expired = db
      .prepare(`
        DELETE FROM ${SESSION_STORE_TABLE}
        WHERE julianday(created_date) IS NULL
           OR julianday(created_date) > julianday('now', '+1 second')
           OR julianday(expires_date) IS NULL
           OR julianday(expires_date) <= julianday('now')
           OR julianday(expires_date) <= julianday(created_date)
           OR julianday(expires_date) > julianday(created_date, '+8 hours')
      `)
      .run();
    revokedSessions += Number(expired.changes || 0);

    const overCap = db
      .prepare(`
        DELETE FROM ${SESSION_STORE_TABLE}
        WHERE token IN (
          SELECT token
          FROM (
            SELECT
              token,
              ROW_NUMBER() OVER (
                PARTITION BY user_id
                ORDER BY created_date DESC, token DESC
              ) AS session_position
            FROM ${SESSION_STORE_TABLE}
          )
          WHERE session_position > ?
        )
      `)
      .run(SESSION_MAX_CONCURRENT_PER_USER);
    revokedSessions += Number(overCap.changes || 0);

    db.exec(`
      CREATE VIEW sessions AS
      SELECT token, user_id, created_date, expires_date
      FROM ${SESSION_STORE_TABLE}
      WHERE julianday(created_date) IS NOT NULL
        AND julianday(created_date) <= julianday('now', '+1 second')
        AND julianday(expires_date) IS NOT NULL
        AND julianday(expires_date) > julianday('now')
        AND julianday(expires_date) > julianday(created_date)
        AND julianday(expires_date) <= julianday(created_date, '+8 hours');

      CREATE TRIGGER session_records_insert_guard
      BEFORE INSERT ON ${SESSION_STORE_TABLE}
      BEGIN
        SELECT CASE
          WHEN julianday(NEW.created_date) IS NULL
            THEN RAISE(ABORT, 'invalid session creation time')
          WHEN julianday(NEW.created_date) > julianday('now', '+1 second')
            THEN RAISE(ABORT, 'future session creation time')
          WHEN julianday(NEW.expires_date) IS NULL
            THEN RAISE(ABORT, 'invalid session expiry time')
          WHEN julianday(NEW.expires_date) <= julianday('now')
            THEN RAISE(ABORT, 'session already expired')
          WHEN julianday(NEW.expires_date) <= julianday(NEW.created_date)
            THEN RAISE(ABORT, 'invalid session lifetime')
          WHEN julianday(NEW.expires_date) > julianday(NEW.created_date, '+8 hours')
            THEN RAISE(ABORT, 'session lifetime exceeds eight hours')
        END;

        DELETE FROM ${SESSION_STORE_TABLE}
        WHERE julianday(expires_date) <= julianday(NEW.created_date);

        DELETE FROM ${SESSION_STORE_TABLE}
        WHERE token IN (
          SELECT token
          FROM ${SESSION_STORE_TABLE}
          WHERE user_id = NEW.user_id
          ORDER BY created_date DESC, token DESC
          LIMIT -1 OFFSET ${SESSION_MAX_CONCURRENT_PER_USER - 1}
        );
      END;

      CREATE TRIGGER session_records_update_guard
      BEFORE UPDATE ON ${SESSION_STORE_TABLE}
      BEGIN
        SELECT RAISE(ABORT, 'session records are immutable');
      END;

      CREATE TRIGGER sessions_insert
      INSTEAD OF INSERT ON sessions
      BEGIN
        INSERT INTO ${SESSION_STORE_TABLE}
          (token, user_id, created_date, expires_date)
        VALUES (
          NEW.token,
          NEW.user_id,
          CASE
            WHEN NEW.expires_date IS NULL
              THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            ELSE NEW.created_date
          END,
          CASE
            WHEN NEW.expires_date IS NULL
              THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+8 hours')
            ELSE NEW.expires_date
          END
        );
      END;

      CREATE TRIGGER sessions_delete
      INSTEAD OF DELETE ON sessions
      BEGIN
        DELETE FROM ${SESSION_STORE_TABLE} WHERE token = OLD.token;
      END;
    `);

    const userObject = db
      .prepare("SELECT type FROM sqlite_master WHERE name = 'entity_User'")
      .get();
    if (userObject?.type === 'table') {
      db.exec(`
        DROP TRIGGER IF EXISTS user_password_session_revocation;
        CREATE TRIGGER user_password_session_revocation
        AFTER UPDATE OF data ON entity_User
        WHEN json_extract(OLD.data, '$.password_hash')
          IS NOT json_extract(NEW.data, '$.password_hash')
          AND json_extract(OLD.data, '$.reset_token') IS NOT NULL
          AND json_extract(NEW.data, '$.reset_token') IS NULL
        BEGIN
          DELETE FROM ${SESSION_STORE_TABLE} WHERE user_id = NEW.id;
        END;
      `);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { migrated, revokedSessions };
}

export const USAGE_METRIC_NAMES = Object.freeze([
  'marketing_page_load',
  'successful_sign_in',
  'new_verified_account',
  'app_open',
]);

const USAGE_METRIC_SET = new Set(USAGE_METRIC_NAMES);
const BRISBANE_TIME_ZONE = 'Australia/Brisbane';
const brisbaneDateFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: BRISBANE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function brisbaneDay(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('usage analytics requires a valid date');
  const parts = Object.fromEntries(
    brisbaneDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function offsetCalendarDay(day, offset) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + offset)).toISOString().slice(0, 10);
}

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
  // Concurrent server processes must wait briefly for the active SQLite
  // writer so security-sensitive transactions can acquire their lock and
  // re-read authoritative state. Without a bounded busy timeout, a losing
  // password-reset request can surface SQLITE_BUSY as a 500 instead of
  // observing the already-consumed token and failing closed.
  db.exec('PRAGMA busy_timeout = 5000;');

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

  ensureSessionSchema(db);

  db.exec(`
    -- Identifier-free operational analytics. Every write is a daily aggregate
    -- increment; this table has no event, request, user or session dimension.
    CREATE TABLE IF NOT EXISTS usage_daily_aggregate (
      day TEXT PRIMARY KEY CHECK (
        length(day) = 10 AND
        day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      ),
      marketing_page_load INTEGER NOT NULL DEFAULT 0 CHECK (
        typeof(marketing_page_load) = 'integer' AND marketing_page_load BETWEEN 0 AND 9007199254740991
      ),
      successful_sign_in INTEGER NOT NULL DEFAULT 0 CHECK (
        typeof(successful_sign_in) = 'integer' AND successful_sign_in BETWEEN 0 AND 9007199254740991
      ),
      new_verified_account INTEGER NOT NULL DEFAULT 0 CHECK (
        typeof(new_verified_account) = 'integer' AND new_verified_account BETWEEN 0 AND 9007199254740991
      ),
      app_open INTEGER NOT NULL DEFAULT 0 CHECK (
        typeof(app_open) = 'integer' AND app_open BETWEEN 0 AND 9007199254740991
      )
    ) WITHOUT ROWID;
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

  // Paid-provider usage is deliberately outside the generic entity API. The
  // additive startup migration is rollback compatible: older application
  // images ignore this table, while every current startup idempotently
  // verifies the ledger and its indexes before any provider route is served.
  ensureApiUsageSchema(db);

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
export function createSessionRepository(
  db,
  { absoluteTtlMs = SESSION_ABSOLUTE_TTL_MS, now = () => Date.now() } = {},
) {
  if (!Number.isFinite(absoluteTtlMs) || absoluteTtlMs <= 0) {
    throw new Error('session absolute TTL must be a positive finite duration');
  }
  if (absoluteTtlMs > SESSION_ABSOLUTE_TTL_MS) {
    throw new Error('session absolute TTL cannot exceed eight hours');
  }

  function currentTimeMs() {
    const value = Number(now());
    if (!Number.isFinite(value)) throw new Error('session clock returned an invalid time');
    return value;
  }

  function create(userId) {
    const token = randomUUID() + randomUUID();
    const issuedAt = currentTimeMs();
    const createdDate = new Date(issuedAt).toISOString();
    const expiresDate = new Date(issuedAt + absoluteTtlMs).toISOString();
    db.prepare(
      `INSERT INTO ${SESSION_STORE_TABLE}
        (token, user_id, created_date, expires_date) VALUES (?, ?, ?, ?)`,
    ).run(
      token,
      userId,
      createdDate,
      expiresDate,
    );
    return token;
  }

  function findByToken(token) {
    const row = db
      .prepare(`SELECT * FROM ${SESSION_STORE_TABLE} WHERE token = ?`)
      .get(token);
    if (!row) return null;
    const createdAt = Date.parse(row.created_date || '');
    const expiresAt = Date.parse(row.expires_date || '');
    const observedAt = currentTimeMs();
    if (
      !Number.isFinite(createdAt) ||
      !Number.isFinite(expiresAt) ||
      createdAt > observedAt ||
      expiresAt <= observedAt ||
      expiresAt <= createdAt ||
      expiresAt > createdAt + absoluteTtlMs
    ) {
      remove(token);
      return null;
    }
    return row;
  }

  function remove(token) {
    db.prepare(`DELETE FROM ${SESSION_STORE_TABLE} WHERE token = ?`).run(token);
  }

  function removeForUser(userId) {
    const result = db
      .prepare(`DELETE FROM ${SESSION_STORE_TABLE} WHERE user_id = ?`)
      .run(userId);
    return Number(result.changes || 0);
  }

  return { create, findByToken, remove, removeForUser };
}

/**
 * Identifier-free daily usage counters. Metric names are a closed enum and
 * are interpolated only while preparing the four static upsert statements.
 */
export function createUsageAnalyticsRepository(db, { clock = () => new Date() } = {}) {
  const incrementStatements = Object.fromEntries(
    USAGE_METRIC_NAMES.map((metric) => [
      metric,
      db.prepare(`
        INSERT INTO usage_daily_aggregate (day, ${metric})
        VALUES (?, 1)
        ON CONFLICT(day) DO UPDATE SET ${metric} = ${metric} + 1
      `),
    ]),
  );
  const summaryStatement = db.prepare(`
    SELECT
      day,
      marketing_page_load,
      successful_sign_in,
      new_verified_account,
      app_open
    FROM usage_daily_aggregate
    WHERE day BETWEEN ? AND ?
    ORDER BY day ASC
  `);

  function currentDate() {
    const value = clock();
    return value instanceof Date ? value : new Date(value);
  }

  function increment(metric, at = currentDate()) {
    if (!USAGE_METRIC_SET.has(metric)) throw new TypeError('unknown usage metric');
    const day = brisbaneDay(at);
    incrementStatements[metric].run(day);
    return day;
  }

  function summarize(days = 30, at = currentDate()) {
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      throw new RangeError('usage summary days must be an integer from 1 to 90');
    }
    const endDay = brisbaneDay(at);
    const startDay = offsetCalendarDay(endDay, 1 - days);
    const rowsByDay = new Map(
      summaryStatement.all(startDay, endDay).map((row) => [row.day, row]),
    );
    return Array.from({ length: days }, (_, index) => {
      const day = offsetCalendarDay(startDay, index);
      const stored = rowsByDay.get(day);
      return {
        day,
        marketing_page_load: Number(stored?.marketing_page_load || 0),
        successful_sign_in: Number(stored?.successful_sign_in || 0),
        new_verified_account: Number(stored?.new_verified_account || 0),
        app_open: Number(stored?.app_open || 0),
      };
    });
  }

  return Object.freeze({ increment, summarize });
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
