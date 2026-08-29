// SQLite persistence layer for the local Base44 shim.
// Uses node:sqlite (DatabaseSync) — a Node 24 built-in, zero new dependencies.

import { DatabaseSync } from 'node:sqlite';

import { ensureApiUsageSchema } from './apiUsage.mjs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { resolveActiveProfessionContract } from '../packages/profession-config/runtime.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

export const PARITY_ASSURANCE_DB_PATH = '/app/server/data/assesssuite-parity.db';
export const SESSION_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;
export const SESSION_MAX_CONCURRENT_PER_USER = 8;

export const STRIPE_WEBHOOK_EVENT_SCHEMA_VERSION = 1;
export const STRIPE_WEBHOOK_EVENT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS stripe_webhook_event (
    event_id TEXT NOT NULL CHECK (
      length(event_id) BETWEEN 8 AND 255 AND event_id GLOB 'evt_*'
    ),
    app_id TEXT NOT NULL,
    profession_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (
      event_type IN (
        'checkout.session.completed',
        'customer.subscription.deleted',
        'customer.subscription.paused',
        'invoice.payment_failed'
      )
    ),
    account_scope TEXT NOT NULL CHECK (account_scope = 'platform'),
    payload_sha256 TEXT NOT NULL CHECK (
      length(payload_sha256) = 64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
    ),
    state TEXT NOT NULL CHECK (state IN ('processing', 'retryable', 'completed')),
    attempt_token TEXT NOT NULL,
    lease_expires_at TEXT NOT NULL,
    response_status INTEGER CHECK (
      response_status IS NULL OR response_status BETWEEN 200 AND 599
    ),
    response_json TEXT,
    last_error_code TEXT,
    claimed_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    PRIMARY KEY (app_id, event_id),
    CHECK (state != 'completed' OR (
      response_status IS NOT NULL AND response_json IS NOT NULL AND completed_at IS NOT NULL
    ))
  ) WITHOUT ROWID;

  CREATE INDEX IF NOT EXISTS idx_stripe_webhook_event_updated
    ON stripe_webhook_event (app_id, updated_at);
`;

export const STRIPE_CHECKOUT_INTENT_SCHEMA_VERSION = 1;
export const STRIPE_CHECKOUT_INTENT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS stripe_checkout_intent (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE CHECK (
      length(idempotency_key) BETWEEN 32 AND 255
    ),
    request_sha256 TEXT NOT NULL CHECK (
      length(request_sha256) = 64 AND request_sha256 NOT GLOB '*[^0-9a-f]*'
    ),
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    app_id TEXT NOT NULL,
    profession_id TEXT NOT NULL,
    price_id TEXT NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
    success_url TEXT NOT NULL,
    cancel_url TEXT NOT NULL,
    trial_period_days INTEGER CHECK (
      trial_period_days IS NULL OR trial_period_days BETWEEN 1 AND 365
    ),
    qa_sequence TEXT,
    state TEXT NOT NULL CHECK (
      state IN ('prepared', 'response_unknown', 'created', 'completed', 'unusable', 'failed')
    ),
    stripe_session_id TEXT,
    stripe_session_url TEXT,
    stripe_session_status TEXT CHECK (
      stripe_session_status IS NULL OR stripe_session_status IN ('open', 'complete', 'expired')
    ),
    stripe_session_expires_at INTEGER CHECK (
      stripe_session_expires_at IS NULL OR stripe_session_expires_at > 0
    ),
    stripe_request_id TEXT,
    last_error_status INTEGER,
    last_error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (state != 'created' OR (
      stripe_session_id IS NOT NULL AND stripe_session_url IS NOT NULL
      AND stripe_session_status = 'open'
    )),
    CHECK (state != 'completed' OR (
      stripe_session_id IS NOT NULL AND stripe_session_status = 'complete'
    )),
    CHECK (state != 'unusable' OR (
      stripe_session_id IS NOT NULL AND stripe_session_status = 'expired'
    ))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_checkout_intent_active_account_app
    ON stripe_checkout_intent (user_id, app_id)
    WHERE state IN ('prepared', 'response_unknown', 'created', 'completed');
  CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_checkout_intent_session
    ON stripe_checkout_intent (stripe_session_id)
    WHERE stripe_session_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_stripe_checkout_intent_account_created
    ON stripe_checkout_intent (user_id, app_id, created_at);
`;

export const PHYSIO_AI_GENERATION_SCHEMA_VERSION = 1;
export const PHYSIO_AI_GENERATION_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS physio_ai_generation (
    id TEXT PRIMARY KEY,
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version = 1),
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    care_episode_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
    request_fingerprint_sha256 TEXT NOT NULL CHECK (
      length(request_fingerprint_sha256) = 64
      AND request_fingerprint_sha256 NOT GLOB '*[^0-9a-f]*'
    ),
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
    output_state TEXT,
    output_json TEXT,
    provenance_json TEXT,
    public_response_json TEXT,
    usage_reservation_id TEXT,
    provider_response_id TEXT,
    provider_http_request_id TEXT,
    provider_request_id_hash TEXT CHECK (
      provider_request_id_hash IS NULL OR (
        length(provider_request_id_hash) = 64
        AND provider_request_id_hash NOT GLOB '*[^0-9a-f]*'
      )
    ),
    review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (
      review_status IN ('unreviewed', 'saved')
    ),
    save_idempotency_key TEXT,
    save_request_fingerprint_sha256 TEXT,
    reviewed_output_json TEXT,
    linked_entity TEXT CHECK (linked_entity IS NULL OR linked_entity IN ('SOAPNote', 'SavedReport')),
    linked_record_id TEXT,
    saved_by TEXT,
    saved_at TEXT,
    error_code TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    UNIQUE (org_id, idempotency_key),
    CHECK (status != 'succeeded' OR (
      output_state = 'ai_draft_unreviewed'
      AND output_json IS NOT NULL
      AND provenance_json IS NOT NULL
      AND public_response_json IS NOT NULL
      AND usage_reservation_id IS NOT NULL
      AND provider_response_id IS NOT NULL
      AND provider_http_request_id IS NOT NULL
      AND provider_request_id_hash IS NOT NULL
      AND completed_at IS NOT NULL
    )),
    CHECK (status != 'failed' OR (error_code IS NOT NULL AND completed_at IS NOT NULL))
    ,CHECK (review_status != 'saved' OR (
      status = 'succeeded'
      AND save_idempotency_key IS NOT NULL
      AND save_request_fingerprint_sha256 IS NOT NULL
      AND reviewed_output_json IS NOT NULL
      AND linked_entity IS NOT NULL
      AND linked_record_id IS NOT NULL
      AND saved_by IS NOT NULL
      AND saved_at IS NOT NULL
    ))
  );

  CREATE INDEX IF NOT EXISTS idx_physio_ai_generation_episode_created
    ON physio_ai_generation (org_id, care_episode_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_physio_ai_generation_user_created
    ON physio_ai_generation (user_id, created_at DESC);
  DROP INDEX IF EXISTS idx_physio_ai_generation_provider_request;
  CREATE INDEX IF NOT EXISTS idx_physio_ai_generation_provider_request
    ON physio_ai_generation (provider_request_id_hash)
    WHERE provider_request_id_hash IS NOT NULL;
`;

export const INTEGRATION_CONNECTION_SCHEMA_VERSION = 1;
export const INTEGRATION_CONNECTION_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS integration_connection (
    id TEXT PRIMARY KEY,
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version = 1),
    org_id TEXT NOT NULL,
    provider_id TEXT NOT NULL CHECK (provider_id IN ('halaxy')),
    status TEXT NOT NULL CHECK (status IN ('disconnected', 'configured', 'connected', 'error')),
    region TEXT,
    credentials_encrypted TEXT,
    credential_hint TEXT,
    settings_json TEXT NOT NULL DEFAULT '{}',
    capabilities_json TEXT NOT NULL DEFAULT '{}',
    last_tested_at TEXT,
    last_success_at TEXT,
    last_error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by_user_id TEXT NOT NULL,
    updated_by_email TEXT NOT NULL,
    UNIQUE (org_id, provider_id),
    CHECK (
      (status = 'disconnected' AND credentials_encrypted IS NULL)
      OR (status != 'disconnected' AND credentials_encrypted IS NOT NULL)
    )
  );

  CREATE INDEX IF NOT EXISTS idx_integration_connection_org
    ON integration_connection (org_id, provider_id);

  CREATE TABLE IF NOT EXISTS integration_event (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
      'configured', 'connection_test_succeeded', 'connection_test_failed',
      'disconnected', 'sync_started', 'sync_succeeded', 'sync_failed'
    )),
    actor_user_id TEXT,
    actor_email TEXT,
    detail_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_integration_event_org_created
    ON integration_event (org_id, created_at DESC, id DESC);

  CREATE TABLE IF NOT EXISTS integration_resource_map (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    local_entity TEXT NOT NULL,
    local_id TEXT NOT NULL,
    remote_id TEXT NOT NULL,
    remote_version TEXT,
    last_synced_at TEXT NOT NULL,
    UNIQUE (org_id, provider_id, resource_type, local_id),
    UNIQUE (org_id, provider_id, resource_type, remote_id)
  );

  CREATE INDEX IF NOT EXISTS idx_integration_resource_remote
    ON integration_resource_map (org_id, provider_id, resource_type, remote_id);
`;

export const EVIDENCE_CACHE_SCHEMA_VERSION = 1;
export const EVIDENCE_CACHE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS evidence_query_cache (
    cache_key TEXT PRIMARY KEY CHECK (
      length(cache_key) = 64 AND cache_key NOT GLOB '*[^0-9a-f]*'
    ),
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version = 1),
    normalized_query TEXT NOT NULL,
    request_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    source_revision TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    stale_until TEXT NOT NULL,
    last_accessed_at TEXT NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0)
  ) WITHOUT ROWID;

  CREATE INDEX IF NOT EXISTS idx_evidence_query_cache_expiry
    ON evidence_query_cache (expires_at, stale_until);
`;

export const TRANSCRIPTION_SESSION_SCHEMA_VERSION = 1;
export const TRANSCRIPTION_SESSION_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS transcription_session (
    id TEXT PRIMARY KEY,
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version = 1),
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
      'recording', 'paused', 'finalising', 'ready', 'recoverable', 'error', 'discarded'
    )),
    label TEXT NOT NULL,
    client_id TEXT,
    appointment_id TEXT,
    care_episode_id TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    transcript_text TEXT NOT NULL DEFAULT '',
    artifacts_json TEXT,
    last_error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_transcription_session_org_updated
    ON transcription_session (org_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_transcription_session_user_status
    ON transcription_session (user_id, status, updated_at DESC);

  CREATE TABLE IF NOT EXISTS transcription_segment (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    upload_id TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    byte_size INTEGER NOT NULL CHECK (byte_size > 0),
    duration_seconds REAL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    status TEXT NOT NULL CHECK (status IN ('uploaded', 'transcribing', 'ready', 'error')),
    transcript_text TEXT,
    speakers_json TEXT,
    provider_receipt_json TEXT,
    last_error_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (session_id, sequence),
    UNIQUE (session_id, upload_id),
    FOREIGN KEY (session_id) REFERENCES transcription_session(id)
  );

  CREATE INDEX IF NOT EXISTS idx_transcription_segment_session_sequence
    ON transcription_segment (session_id, sequence);
`;

const SESSION_STORE_TABLE = 'session_records';

/**
 * Adds the private Stripe Checkout intent ledger. It is intentionally absent
 * from the generic entity schema list: browser callers cannot enumerate or
 * mutate provider idempotency state.
 */
export function ensureStripeCheckoutIntentSchema(db) {
  db.exec(STRIPE_CHECKOUT_INTENT_SCHEMA_SQL);
}

/**
 * Adds the private signed-Stripe event receipt ledger. It is deliberately
 * outside the generic entity API so browser callers cannot forge, enumerate
 * or mutate provider delivery state.
 */
export function ensureStripeWebhookEventSchema(db) {
  db.exec(STRIPE_WEBHOOK_EVENT_SCHEMA_SQL);
}

export function ensurePhysioAiGenerationSchema(db) {
  db.exec(PHYSIO_AI_GENERATION_SCHEMA_SQL);
  const columns = new Set(
    db.prepare('PRAGMA table_info(physio_ai_generation)').all().map((row) => row.name),
  );
  const additions = {
    provider_response_id: 'TEXT',
    provider_http_request_id: 'TEXT',
    review_status: "TEXT NOT NULL DEFAULT 'unreviewed'",
    save_idempotency_key: 'TEXT',
    save_request_fingerprint_sha256: 'TEXT',
    reviewed_output_json: 'TEXT',
    linked_entity: 'TEXT',
    linked_record_id: 'TEXT',
    saved_by: 'TEXT',
    saved_at: 'TEXT',
  };
  for (const [name, ddl] of Object.entries(additions)) {
    if (!columns.has(name)) db.exec(`ALTER TABLE physio_ai_generation ADD COLUMN ${name} ${ddl}`);
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_physio_ai_generation_save_key
      ON physio_ai_generation (org_id, save_idempotency_key)
      WHERE save_idempotency_key IS NOT NULL
  `);
}

export function ensureIntegrationConnectionSchema(db) {
  db.exec(INTEGRATION_CONNECTION_SCHEMA_SQL);
}

export function ensureEvidenceCacheSchema(db) {
  db.exec(EVIDENCE_CACHE_SCHEMA_SQL);
}

export function ensureTranscriptionSessionSchema(db) {
  db.exec(TRANSCRIPTION_SESSION_SCHEMA_SQL);
}

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

export function resolveDefaultDatabaseFileName(environment = process.env) {
  if (environment.SELFTEST === '1') return 'selftest.db';
  return resolveActiveProfessionContract(environment).profession.deployment.dataFile;
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
  const dbFile = override
    ? path.resolve(override)
    : path.join(dataDir, resolveDefaultDatabaseFileName(process.env));
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
  ensureStripeCheckoutIntentSchema(db);
  ensureStripeWebhookEventSchema(db);
  ensurePhysioAiGenerationSchema(db);
  ensureIntegrationConnectionSchema(db);
  ensureEvidenceCacheSchema(db);
  ensureTranscriptionSessionSchema(db);

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

function physioAiGenerationFromRow(row) {
  if (!row) return null;
  return Object.freeze({
    id: row.id,
    schemaVersion: Number(row.schema_version),
    orgId: row.org_id,
    userId: row.user_id,
    clientId: row.client_id,
    careEpisodeId: row.care_episode_id,
    taskId: row.task_id,
    idempotencyKey: row.idempotency_key,
    requestFingerprintSha256: row.request_fingerprint_sha256,
    status: row.status,
    outputState: row.output_state,
    output: row.output_json ? JSON.parse(row.output_json) : null,
    provenance: row.provenance_json ? JSON.parse(row.provenance_json) : null,
    publicResponse: row.public_response_json ? JSON.parse(row.public_response_json) : null,
    usageReservationId: row.usage_reservation_id,
    providerResponseId: row.provider_response_id,
    providerHttpRequestId: row.provider_http_request_id,
    providerRequestIdHash: row.provider_request_id_hash,
    reviewStatus: row.review_status || 'unreviewed',
    saveIdempotencyKey: row.save_idempotency_key,
    saveRequestFingerprintSha256: row.save_request_fingerprint_sha256,
    reviewedOutput: row.reviewed_output_json ? JSON.parse(row.reviewed_output_json) : null,
    linkedEntity: row.linked_entity,
    linkedRecordId: row.linked_record_id,
    savedBy: row.saved_by,
    savedAt: row.saved_at,
    errorCode: row.error_code,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  });
}

export function createPhysioAiGenerationRepository(db, { now = () => new Date() } = {}) {
  ensurePhysioAiGenerationSchema(db);
  const byId = db.prepare('SELECT * FROM physio_ai_generation WHERE id = ?');
  const byKey = db.prepare(`
    SELECT * FROM physio_ai_generation
    WHERE org_id = ? AND idempotency_key = ?
    LIMIT 1
  `);
  const insert = db.prepare(`
    INSERT INTO physio_ai_generation (
      id, org_id, user_id, client_id, care_episode_id, task_id,
      idempotency_key, request_fingerprint_sha256, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `);
  const succeeded = db.prepare(`
    UPDATE physio_ai_generation
    SET status = 'succeeded', output_state = ?, output_json = ?, provenance_json = ?,
        public_response_json = ?, usage_reservation_id = ?, provider_response_id = ?,
        provider_http_request_id = ?, provider_request_id_hash = ?,
        error_code = NULL, completed_at = ?
    WHERE id = ? AND status = 'pending'
  `);
  const failed = db.prepare(`
    UPDATE physio_ai_generation
    SET status = 'failed', error_code = ?, completed_at = ?
    WHERE id = ? AND status = 'pending'
  `);
  const reviewed = db.prepare(`
    UPDATE physio_ai_generation
    SET review_status = 'saved', save_idempotency_key = ?,
        save_request_fingerprint_sha256 = ?, reviewed_output_json = ?,
        linked_entity = ?, linked_record_id = ?, saved_by = ?, saved_at = ?
    WHERE id = ? AND status = 'succeeded' AND review_status = 'unreviewed'
  `);

  function timestamp() {
    const value = now();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Physio AI generation clock is invalid');
    return date.toISOString();
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_physio_episode_org_client_number
      ON entity_PhysioCareEpisode (
        json_extract(data, '$.org_id'),
        json_extract(data, '$.client_id'),
        CAST(json_extract(data, '$.episode_number') AS INTEGER)
      )
      WHERE json_extract(data, '$.org_id') IS NOT NULL
        AND json_extract(data, '$.client_id') IS NOT NULL
        AND json_extract(data, '$.episode_number') IS NOT NULL
  `);

  function getById(id) {
    return physioAiGenerationFromRow(byId.get(id));
  }

  function findByIdempotencyKey(orgId, idempotencyKey) {
    return physioAiGenerationFromRow(byKey.get(orgId, idempotencyKey));
  }

  function acquire(candidate) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = findByIdempotencyKey(candidate.orgId, candidate.idempotencyKey);
      if (existing) {
        db.exec('COMMIT');
        return Object.freeze({ generation: existing, created: false });
      }
      const id = randomUUID();
      insert.run(
        id,
        candidate.orgId,
        candidate.userId,
        candidate.clientId,
        candidate.careEpisodeId,
        candidate.taskId,
        candidate.idempotencyKey,
        candidate.requestFingerprintSha256,
        timestamp(),
      );
      const generation = getById(id);
      db.exec('COMMIT');
      return Object.freeze({ generation, created: true });
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw error;
    }
  }

  function markSucceeded(id, result) {
    const mutation = succeeded.run(
      result.outputState,
      JSON.stringify(result.output),
      JSON.stringify(result.provenance),
      JSON.stringify(result.publicResponse),
      result.usageReservationId,
      result.providerResponseId,
      result.providerHttpRequestId,
      result.providerRequestIdHash,
      timestamp(),
      id,
    );
    if (Number(mutation.changes || 0) !== 1) {
      const current = getById(id);
      if (current?.status === 'succeeded') return current;
      throw new Error('Physio AI generation success transition was rejected');
    }
    return getById(id);
  }

  function markFailed(id, errorCode) {
    const mutation = failed.run(String(errorCode || 'physio_ai_internal_error'), timestamp(), id);
    if (Number(mutation.changes || 0) !== 1) {
      const current = getById(id);
      if (current?.status === 'failed' || current?.status === 'succeeded') return current;
      throw new Error('Physio AI generation failure transition was rejected');
    }
    return getById(id);
  }

  function markReviewed(id, result) {
    const mutation = reviewed.run(
      result.saveIdempotencyKey,
      result.saveRequestFingerprintSha256,
      JSON.stringify(result.reviewedOutput),
      result.linkedEntity,
      result.linkedRecordId,
      result.savedBy,
      timestamp(),
      id,
    );
    if (Number(mutation.changes || 0) !== 1) return getById(id);
    return getById(id);
  }

  return Object.freeze({
    acquire,
    getById,
    findByIdempotencyKey,
    markSucceeded,
    markFailed,
    markReviewed,
  });
}

function stripeWebhookEventFromRow(row) {
  if (!row) return null;
  return Object.freeze({
    eventId: row.event_id,
    appId: row.app_id,
    professionId: row.profession_id,
    eventType: row.event_type,
    accountScope: row.account_scope,
    payloadSha256: row.payload_sha256,
    state: row.state,
    attemptToken: row.attempt_token,
    leaseExpiresAt: row.lease_expires_at,
    responseStatus: row.response_status,
    response: row.response_json ? JSON.parse(row.response_json) : null,
    lastErrorCode: row.last_error_code,
    claimedAt: row.claimed_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  });
}

function requireStripeWebhookIdentity(existing, candidate) {
  if (
    existing.payloadSha256 !== candidate.payloadSha256
    || existing.eventType !== candidate.eventType
    || existing.professionId !== candidate.professionId
    || existing.accountScope !== candidate.accountScope
  ) {
    const error = new Error('Stripe event ID was reused with a divergent signed payload');
    error.code = 'stripe_event_payload_divergent';
    throw error;
  }
}

/**
 * Durable, app-scoped Stripe Event receipt ledger.
 *
 * An exact signed event is claimed under SQLite's write lock before any
 * entitlement or provider mutation. Completed duplicates replay the stored
 * content-free HTTP outcome. Active concurrent deliveries fail closed while
 * a bounded lease is held; a crash leaves a deterministic, reclaimable event
 * whose local writes and provider idempotency keys converge on replay.
 */
export function createStripeWebhookEventRepository(
  db,
  { now = () => new Date(), leaseMs = 5 * 60 * 1000 } = {},
) {
  ensureStripeWebhookEventSchema(db);
  if (!Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 30 * 60 * 1000) {
    throw new RangeError('Stripe webhook event lease must be between 1 and 30 minutes');
  }
  const byKey = db.prepare(`
    SELECT * FROM stripe_webhook_event WHERE app_id = ? AND event_id = ?
  `);
  const insert = db.prepare(`
    INSERT INTO stripe_webhook_event (
      event_id, app_id, profession_id, event_type, account_scope,
      payload_sha256, state, attempt_token, lease_expires_at,
      claimed_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?)
  `);
  const reclaim = db.prepare(`
    UPDATE stripe_webhook_event
    SET state = 'processing', attempt_token = ?, lease_expires_at = ?,
        last_error_code = NULL, updated_at = ?
    WHERE app_id = ? AND event_id = ? AND state != 'completed'
  `);
  const complete = db.prepare(`
    UPDATE stripe_webhook_event
    SET state = 'completed', response_status = ?, response_json = ?,
        last_error_code = NULL, completed_at = ?, updated_at = ?
    WHERE app_id = ? AND event_id = ? AND state = 'processing' AND attempt_token = ?
  `);
  const retryable = db.prepare(`
    UPDATE stripe_webhook_event
    SET state = 'retryable', last_error_code = ?, lease_expires_at = ?, updated_at = ?
    WHERE app_id = ? AND event_id = ? AND state = 'processing' AND attempt_token = ?
  `);

  function dateNow() {
    const value = now();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Stripe event ledger clock is invalid');
    return date;
  }

  function get(appId, eventId) {
    return stripeWebhookEventFromRow(byKey.get(appId, eventId));
  }

  function acquire(candidate) {
    const at = dateNow();
    const atIso = at.toISOString();
    const attemptToken = randomUUID();
    const leaseExpiresAt = new Date(at.getTime() + leaseMs).toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = get(candidate.appId, candidate.eventId);
      if (existing) {
        requireStripeWebhookIdentity(existing, candidate);
        if (existing.state === 'completed') {
          db.exec('COMMIT');
          return Object.freeze({ disposition: 'completed_duplicate', event: existing });
        }
        if (
          existing.state === 'processing'
          && Number.isFinite(Date.parse(existing.leaseExpiresAt))
          && Date.parse(existing.leaseExpiresAt) > at.getTime()
        ) {
          db.exec('COMMIT');
          return Object.freeze({ disposition: 'in_progress', event: existing });
        }
        reclaim.run(attemptToken, leaseExpiresAt, atIso, candidate.appId, candidate.eventId);
        const event = get(candidate.appId, candidate.eventId);
        db.exec('COMMIT');
        return Object.freeze({ disposition: 'reclaimed', event });
      }
      insert.run(
        candidate.eventId,
        candidate.appId,
        candidate.professionId,
        candidate.eventType,
        candidate.accountScope,
        candidate.payloadSha256,
        attemptToken,
        leaseExpiresAt,
        atIso,
        atIso,
      );
      const event = get(candidate.appId, candidate.eventId);
      db.exec('COMMIT');
      return Object.freeze({ disposition: 'claimed', event });
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw error;
    }
  }

  function markCompleted(claim, { status, body }) {
    if (!Number.isInteger(status) || status < 200 || status > 599) {
      throw new TypeError('Stripe event response status is invalid');
    }
    const at = dateNow().toISOString();
    const result = complete.run(
      status,
      JSON.stringify(body ?? null),
      at,
      at,
      claim.appId,
      claim.eventId,
      claim.attemptToken,
    );
    if (Number(result?.changes || 0) !== 1) {
      const current = get(claim.appId, claim.eventId);
      if (current?.state === 'completed') return current;
      throw new Error('Stripe event completion was rejected by its lease');
    }
    return get(claim.appId, claim.eventId);
  }

  function markRetryable(claim, errorCode = 'stripe_webhook_retryable') {
    const at = dateNow().toISOString();
    const result = retryable.run(
      String(errorCode || 'stripe_webhook_retryable').slice(0, 120),
      at,
      at,
      claim.appId,
      claim.eventId,
      claim.attemptToken,
    );
    if (Number(result?.changes || 0) !== 1) return get(claim.appId, claim.eventId);
    return get(claim.appId, claim.eventId);
  }

  return Object.freeze({ acquire, get, markCompleted, markRetryable });
}

function checkoutIntentFromRow(row) {
  if (!row) return null;
  return Object.freeze({
    id: row.id,
    idempotencyKey: row.idempotency_key,
    requestSha256: row.request_sha256,
    userId: row.user_id,
    userEmail: row.user_email,
    appId: row.app_id,
    professionId: row.profession_id,
    priceId: row.price_id,
    plan: row.plan,
    successUrl: row.success_url,
    cancelUrl: row.cancel_url,
    trialPeriodDays: row.trial_period_days,
    qaSequence: row.qa_sequence,
    state: row.state,
    stripeSessionId: row.stripe_session_id,
    stripeSessionUrl: row.stripe_session_url,
    stripeSessionStatus: row.stripe_session_status,
    stripeSessionExpiresAt: row.stripe_session_expires_at,
    stripeRequestId: row.stripe_request_id,
    lastErrorStatus: row.last_error_status,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function requireCheckoutIntentMutation(result, operation) {
  if (Number(result?.changes || 0) !== 1) {
    throw new Error(`Stripe Checkout intent ${operation} rejected by its state transition`);
  }
}

/**
 * Crash-safe private repository for Stripe Checkout creation attempts.
 *
 * `acquire` serialises on SQLite's write lock and returns the existing active
 * account/application intent where one exists. That makes a process restart,
 * parallel browser request or response-loss retry converge on one persisted
 * Stripe idempotency key instead of creating another Checkout Session.
 */
export function createStripeCheckoutIntentRepository(db, { now = () => new Date() } = {}) {
  ensureStripeCheckoutIntentSchema(db);

  const activeForAccount = db.prepare(`
    SELECT *
    FROM stripe_checkout_intent
    WHERE user_id = ? AND app_id = ?
      AND state IN ('prepared', 'response_unknown', 'created', 'completed')
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const byId = db.prepare('SELECT * FROM stripe_checkout_intent WHERE id = ?');
  const insert = db.prepare(`
    INSERT INTO stripe_checkout_intent (
      id, idempotency_key, request_sha256, user_id, user_email, app_id,
      profession_id, price_id, plan, success_url, cancel_url,
      trial_period_days, qa_sequence, state, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)
  `);
  const responseUnknown = db.prepare(`
    UPDATE stripe_checkout_intent
    SET state = 'response_unknown', stripe_session_id = COALESCE(?, stripe_session_id),
        stripe_session_status = COALESCE(?, stripe_session_status),
        stripe_session_expires_at = COALESCE(?, stripe_session_expires_at),
        stripe_request_id = COALESCE(?, stripe_request_id),
        last_error_status = ?, last_error_code = ?, updated_at = ?
    WHERE id = ? AND state IN ('prepared', 'response_unknown')
  `);
  const created = db.prepare(`
    UPDATE stripe_checkout_intent
    SET state = ?, stripe_session_id = ?, stripe_session_url = ?,
        stripe_session_status = ?, stripe_session_expires_at = ?,
        stripe_request_id = COALESCE(?, stripe_request_id),
        last_error_status = NULL, last_error_code = NULL, updated_at = ?
    WHERE id = ? AND state IN ('prepared', 'response_unknown')
  `);
  const observed = db.prepare(`
    UPDATE stripe_checkout_intent
    SET state = ?, stripe_session_url = COALESCE(?, stripe_session_url),
        stripe_session_status = ?, stripe_session_expires_at = ?,
        stripe_request_id = COALESCE(?, stripe_request_id), updated_at = ?
    WHERE id = ? AND state IN ('created', 'completed')
  `);
  const failed = db.prepare(`
    UPDATE stripe_checkout_intent
    SET state = 'failed', stripe_request_id = COALESCE(?, stripe_request_id),
        last_error_status = ?, last_error_code = ?, updated_at = ?
    WHERE id = ? AND state IN ('prepared', 'response_unknown')
  `);

  function timestamp() {
    const value = now();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Checkout intent clock is invalid');
    return date.toISOString();
  }

  function getById(id) {
    return checkoutIntentFromRow(byId.get(id));
  }

  function acquire(candidate) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = checkoutIntentFromRow(activeForAccount.get(candidate.userId, candidate.appId));
      if (existing) {
        db.exec('COMMIT');
        return Object.freeze({ intent: existing, created: false });
      }

      const at = timestamp();
      insert.run(
        candidate.id,
        candidate.idempotencyKey,
        candidate.requestSha256,
        candidate.userId,
        candidate.userEmail,
        candidate.appId,
        candidate.professionId,
        candidate.priceId,
        candidate.plan,
        candidate.successUrl,
        candidate.cancelUrl,
        candidate.trialPeriodDays ?? null,
        candidate.qaSequence ?? null,
        at,
        at,
      );
      const intent = getById(candidate.id);
      db.exec('COMMIT');
      return Object.freeze({ intent, created: true });
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw error;
    }
  }

  function markResponseUnknown(id, {
    status = null,
    code = null,
    requestId = null,
    sessionId = null,
    sessionStatus = null,
    sessionExpiresAt = null,
  } = {}) {
    const result = responseUnknown.run(
      sessionId,
      sessionStatus,
      sessionExpiresAt,
      requestId,
      status,
      code,
      timestamp(),
      id,
    );
    if (Number(result?.changes || 0) !== 1) {
      const current = getById(id);
      if (current?.state === 'created' || current?.state === 'completed') return current;
      requireCheckoutIntentMutation(result, 'response-unknown transition');
    }
    return getById(id);
  }

  function markCreated(id, session, requestId = null) {
    const stateByStatus = { open: 'created', complete: 'completed', expired: 'unusable' };
    const nextState = stateByStatus[session.status];
    if (!nextState) throw new TypeError('Stripe Checkout Session status is unsupported');
    const result = created.run(
      nextState,
      session.id,
      session.url ?? null,
      session.status,
      session.expires_at ?? null,
      requestId,
      timestamp(),
      id,
    );
    if (Number(result?.changes || 0) !== 1) {
      const current = getById(id);
      if (
        current?.stripeSessionId === session.id
        && current?.stripeSessionStatus === session.status
      ) return current;
      requireCheckoutIntentMutation(result, 'created transition');
    }
    return getById(id);
  }

  function markObserved(id, session, requestId = null) {
    const stateByStatus = { open: 'created', complete: 'completed', expired: 'unusable' };
    const nextState = stateByStatus[session.status];
    if (!nextState) throw new TypeError('Stripe Checkout Session status is unsupported');
    const result = observed.run(
      nextState,
      session.url ?? null,
      session.status,
      session.expires_at ?? null,
      requestId,
      timestamp(),
      id,
    );
    if (Number(result?.changes || 0) !== 1) {
      const current = getById(id);
      if (
        current?.stripeSessionId === session.id
        && current?.stripeSessionStatus === session.status
      ) return current;
      requireCheckoutIntentMutation(result, 'provider-observation transition');
    }
    return getById(id);
  }

  function markFailed(id, { status = null, code = null, requestId = null } = {}) {
    const result = failed.run(requestId, status, code, timestamp(), id);
    if (Number(result?.changes || 0) !== 1) {
      const current = getById(id);
      if (current?.state === 'created' || current?.state === 'completed') return current;
      requireCheckoutIntentMutation(result, 'failed transition');
    }
    return getById(id);
  }

  return Object.freeze({ acquire, getById, markResponseUnknown, markCreated, markObserved, markFailed });
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

function invitationFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    email: row.email,
    role: row.role,
    tokenHash: row.token_hash,
    status: row.status,
    invitedByUserId: row.invited_by_user_id,
    invitedByEmail: row.invited_by_email,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    providerMessageId: row.provider_message_id,
  };
}

function accessEventFromRow(row) {
  if (!row) return null;
  let metadata = {};
  try {
    metadata = JSON.parse(row.metadata_json || '{}');
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    orgId: row.org_id,
    eventType: row.event_type,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    subjectUserId: row.subject_user_id,
    subjectEmail: row.subject_email,
    invitationId: row.invitation_id,
    priorRole: row.prior_role,
    nextRole: row.next_role,
    createdAt: row.created_at,
    metadata,
  };
}

/**
 * Private organisation-access ledger. The invitation bearer hash never enters
 * a generic entity record and is omitted by every public presentation helper.
 */
export function createOrganizationAccessRepository(db) {
  const invitationById = db.prepare('SELECT * FROM organization_invitation WHERE id = ?');
  const invitationByHash = db.prepare(
    "SELECT * FROM organization_invitation WHERE token_hash = ? AND status = 'pending'",
  );
  const invitationsForOrg = db.prepare(
    'SELECT * FROM organization_invitation WHERE org_id = ? ORDER BY created_at DESC, id DESC',
  );
  const pendingForEmail = db.prepare(`
    SELECT * FROM organization_invitation
    WHERE org_id = ? AND lower(email) = lower(?) AND status = 'pending'
  `);
  const insertInvitation = db.prepare(`
    INSERT INTO organization_invitation (
      id, org_id, email, role, token_hash, status,
      invited_by_user_id, invited_by_email, created_at, sent_at, expires_at,
      accepted_at, revoked_at, provider_message_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const removeInvitationStatement = db.prepare('DELETE FROM organization_invitation WHERE id = ?');
  const eventsForOrg = db.prepare(`
    SELECT * FROM organization_access_event
    WHERE org_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `);
  const insertEvent = db.prepare(`
    INSERT INTO organization_access_event (
      id, org_id, event_type, actor_user_id, actor_email, subject_user_id,
      subject_email, invitation_id, prior_role, next_role, created_at, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  function getInvitationById(id) {
    return invitationFromRow(invitationById.get(id));
  }

  function findInvitationByTokenHash(tokenHash) {
    return invitationFromRow(invitationByHash.get(tokenHash));
  }

  function findPendingInvitation(orgId, email) {
    return invitationFromRow(pendingForEmail.get(orgId, email));
  }

  function listInvitations(orgId) {
    return invitationsForOrg.all(orgId).map(invitationFromRow);
  }

  function createInvitation(input) {
    const id = input.id || randomUUID();
    insertInvitation.run(
      id,
      input.orgId,
      input.email,
      input.role,
      input.tokenHash,
      input.status || 'pending',
      input.invitedByUserId,
      input.invitedByEmail,
      input.createdAt,
      input.sentAt ?? null,
      input.expiresAt,
      input.acceptedAt ?? null,
      input.revokedAt ?? null,
      input.providerMessageId ?? null,
    );
    return getInvitationById(id);
  }

  function updateInvitation(id, patch = {}) {
    const allowed = new Set([
      'role', 'token_hash', 'status', 'sent_at', 'expires_at',
      'accepted_at', 'revoked_at', 'provider_message_id',
    ]);
    const entries = Object.entries(patch).filter(([field]) => allowed.has(field));
    if (entries.length === 0) return getInvitationById(id);
    const columns = entries.map(([field]) => `${field} = ?`).join(', ');
    const result = db.prepare(`UPDATE organization_invitation SET ${columns} WHERE id = ?`)
      .run(...entries.map(([, value]) => value ?? null), id);
    return Number(result.changes || 0) === 1 ? getInvitationById(id) : null;
  }

  function removeInvitation(id) {
    return Number(removeInvitationStatement.run(id).changes || 0) === 1;
  }

  function recordEvent(input) {
    const id = input.id || randomUUID();
    insertEvent.run(
      id,
      input.orgId,
      input.eventType,
      input.actorUserId ?? null,
      input.actorEmail ?? null,
      input.subjectUserId ?? null,
      input.subjectEmail,
      input.invitationId ?? null,
      input.priorRole ?? null,
      input.nextRole ?? null,
      input.createdAt,
      JSON.stringify(input.metadata || {}),
    );
    return id;
  }

  function listEvents(orgId, limit = 100) {
    const safeLimit = Number.isSafeInteger(limit) && limit > 0 && limit <= 250 ? limit : 100;
    return eventsForOrg.all(orgId, safeLimit).map(accessEventFromRow);
  }

  return Object.freeze({
    createInvitation,
    findInvitationByTokenHash,
    findPendingInvitation,
    getInvitationById,
    listEvents,
    listInvitations,
    recordEvent,
    removeInvitation,
    updateInvitation,
  });
}

function integrationConnectionFromRow(row) {
  if (!row) return null;
  return Object.freeze({
    id: row.id,
    schemaVersion: Number(row.schema_version),
    orgId: row.org_id,
    providerId: row.provider_id,
    status: row.status,
    region: row.region,
    credentialsEncrypted: row.credentials_encrypted,
    credentialHint: row.credential_hint,
    settings: JSON.parse(row.settings_json || '{}'),
    capabilities: JSON.parse(row.capabilities_json || '{}'),
    lastTestedAt: row.last_tested_at,
    lastSuccessAt: row.last_success_at,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedByUserId: row.updated_by_user_id,
    updatedByEmail: row.updated_by_email,
  });
}

function integrationEventFromRow(row) {
  if (!row) return null;
  return Object.freeze({
    id: row.id,
    orgId: row.org_id,
    providerId: row.provider_id,
    eventType: row.event_type,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    detail: JSON.parse(row.detail_json || '{}'),
    createdAt: row.created_at,
  });
}

function integrationResourceMapFromRow(row) {
  if (!row) return null;
  return Object.freeze({
    id: row.id,
    orgId: row.org_id,
    providerId: row.provider_id,
    resourceType: row.resource_type,
    localEntity: row.local_entity,
    localId: row.local_id,
    remoteId: row.remote_id,
    remoteVersion: row.remote_version,
    lastSyncedAt: row.last_synced_at,
  });
}

/** Private provider-connection state. Credential ciphertext is never exposed
 * through the generic entity API and is returned only to server-side callers. */
export function createIntegrationConnectionRepository(db, { now = () => new Date() } = {}) {
  ensureIntegrationConnectionSchema(db);
  const byOrgProvider = db.prepare(`
    SELECT * FROM integration_connection WHERE org_id = ? AND provider_id = ?
  `);
  const listByOrg = db.prepare(`
    SELECT * FROM integration_connection WHERE org_id = ? ORDER BY provider_id
  `);
  const insert = db.prepare(`
    INSERT INTO integration_connection (
      id, org_id, provider_id, status, region, credentials_encrypted,
      credential_hint, settings_json, capabilities_json, last_tested_at,
      last_success_at, last_error_code, created_at, updated_at,
      updated_by_user_id, updated_by_email
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const update = db.prepare(`
    UPDATE integration_connection
    SET status = ?, region = ?, credentials_encrypted = ?, credential_hint = ?,
        settings_json = ?, capabilities_json = ?, last_tested_at = ?,
        last_success_at = ?, last_error_code = ?, updated_at = ?,
        updated_by_user_id = ?, updated_by_email = ?
    WHERE org_id = ? AND provider_id = ?
  `);
  const eventsByOrg = db.prepare(`
    SELECT * FROM integration_event
    WHERE org_id = ? ORDER BY created_at DESC, id DESC LIMIT ?
  `);
  const insertEvent = db.prepare(`
    INSERT INTO integration_event (
      id, org_id, provider_id, event_type, actor_user_id, actor_email,
      detail_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const mapByLocal = db.prepare(`
    SELECT * FROM integration_resource_map
    WHERE org_id = ? AND provider_id = ? AND resource_type = ? AND local_id = ?
  `);
  const mapByRemote = db.prepare(`
    SELECT * FROM integration_resource_map
    WHERE org_id = ? AND provider_id = ? AND resource_type = ? AND remote_id = ?
  `);
  const mapsByType = db.prepare(`
    SELECT * FROM integration_resource_map
    WHERE org_id = ? AND provider_id = ? AND resource_type = ?
    ORDER BY last_synced_at, id
  `);
  const insertMap = db.prepare(`
    INSERT INTO integration_resource_map (
      id, org_id, provider_id, resource_type, local_entity, local_id,
      remote_id, remote_version, last_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateMap = db.prepare(`
    UPDATE integration_resource_map
    SET local_entity = ?, local_id = ?, remote_id = ?, remote_version = ?, last_synced_at = ?
    WHERE id = ?
  `);

  function timestamp() {
    const value = now();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Integration clock is invalid');
    return date.toISOString();
  }

  function get(orgId, providerId) {
    return integrationConnectionFromRow(byOrgProvider.get(orgId, providerId));
  }

  function list(orgId) {
    return listByOrg.all(orgId).map(integrationConnectionFromRow);
  }

  function put(input) {
    const existing = get(input.orgId, input.providerId);
    const observedAt = timestamp();
    const row = {
      status: input.status,
      region: input.region ?? null,
      credentialsEncrypted: input.credentialsEncrypted ?? null,
      credentialHint: input.credentialHint ?? null,
      settings: input.settings || {},
      capabilities: input.capabilities || {},
      lastTestedAt: input.lastTestedAt ?? null,
      lastSuccessAt: input.lastSuccessAt ?? null,
      lastErrorCode: input.lastErrorCode ?? null,
    };
    if (existing) {
      update.run(
        row.status, row.region, row.credentialsEncrypted, row.credentialHint,
        JSON.stringify(row.settings), JSON.stringify(row.capabilities),
        row.lastTestedAt, row.lastSuccessAt, row.lastErrorCode, observedAt,
        input.updatedByUserId, input.updatedByEmail, input.orgId, input.providerId,
      );
    } else {
      insert.run(
        input.id || randomUUID(), input.orgId, input.providerId, row.status,
        row.region, row.credentialsEncrypted, row.credentialHint,
        JSON.stringify(row.settings), JSON.stringify(row.capabilities),
        row.lastTestedAt, row.lastSuccessAt, row.lastErrorCode, observedAt,
        observedAt, input.updatedByUserId, input.updatedByEmail,
      );
    }
    return get(input.orgId, input.providerId);
  }

  function recordEvent(input) {
    const id = input.id || randomUUID();
    insertEvent.run(
      id, input.orgId, input.providerId, input.eventType,
      input.actorUserId ?? null, input.actorEmail ?? null,
      JSON.stringify(input.detail || {}), input.createdAt || timestamp(),
    );
    return id;
  }

  function listEvents(orgId, limit = 100) {
    const safeLimit = Number.isSafeInteger(limit) && limit > 0 && limit <= 250 ? limit : 100;
    return eventsByOrg.all(orgId, safeLimit).map(integrationEventFromRow);
  }

  function getResourceMapByLocal(orgId, providerId, resourceType, localId) {
    return integrationResourceMapFromRow(mapByLocal.get(orgId, providerId, resourceType, localId));
  }

  function getResourceMapByRemote(orgId, providerId, resourceType, remoteId) {
    return integrationResourceMapFromRow(mapByRemote.get(orgId, providerId, resourceType, remoteId));
  }

  function listResourceMaps(orgId, providerId, resourceType) {
    return mapsByType.all(orgId, providerId, resourceType).map(integrationResourceMapFromRow);
  }

  function putResourceMap(input) {
    const local = getResourceMapByLocal(
      input.orgId, input.providerId, input.resourceType, input.localId,
    );
    const remote = getResourceMapByRemote(
      input.orgId, input.providerId, input.resourceType, input.remoteId,
    );
    if (local && remote && local.id !== remote.id) {
      const error = new Error('The local and remote resources are already mapped differently.');
      error.code = 'integration_resource_mapping_conflict';
      throw error;
    }
    if (local && local.remoteId !== input.remoteId) {
      const error = new Error('The local resource is already mapped to another provider record.');
      error.code = 'integration_resource_mapping_conflict';
      throw error;
    }
    if (remote && remote.localId !== input.localId) {
      const error = new Error('The provider record is already mapped to another local resource.');
      error.code = 'integration_resource_mapping_conflict';
      throw error;
    }
    const existing = local || remote;
    const observedAt = input.lastSyncedAt || timestamp();
    if (existing) {
      updateMap.run(
        input.localEntity, input.localId, input.remoteId,
        input.remoteVersion ?? null, observedAt, existing.id,
      );
      return getResourceMapByLocal(input.orgId, input.providerId, input.resourceType, input.localId);
    }
    insertMap.run(
      input.id || randomUUID(), input.orgId, input.providerId, input.resourceType,
      input.localEntity, input.localId, input.remoteId,
      input.remoteVersion ?? null, observedAt,
    );
    return getResourceMapByLocal(input.orgId, input.providerId, input.resourceType, input.localId);
  }

  return Object.freeze({
    get,
    list,
    put,
    recordEvent,
    listEvents,
    getResourceMapByLocal,
    getResourceMapByRemote,
    listResourceMaps,
    putResourceMap,
  });
}

function evidenceCacheFromRow(row) {
  if (!row) return null;
  return Object.freeze({
    cacheKey: row.cache_key,
    schemaVersion: Number(row.schema_version),
    normalizedQuery: row.normalized_query,
    request: JSON.parse(row.request_json),
    result: JSON.parse(row.result_json),
    sourceRevision: row.source_revision,
    fetchedAt: row.fetched_at,
    expiresAt: row.expires_at,
    staleUntil: row.stale_until,
    lastAccessedAt: row.last_accessed_at,
    hitCount: Number(row.hit_count),
  });
}

export function createEvidenceCacheRepository(db, { now = () => new Date() } = {}) {
  ensureEvidenceCacheSchema(db);
  const byKey = db.prepare('SELECT * FROM evidence_query_cache WHERE cache_key = ?');
  const touch = db.prepare(`
    UPDATE evidence_query_cache
    SET hit_count = hit_count + 1, last_accessed_at = ?
    WHERE cache_key = ?
  `);
  const upsert = db.prepare(`
    INSERT INTO evidence_query_cache (
      cache_key, normalized_query, request_json, result_json, source_revision,
      fetched_at, expires_at, stale_until, last_accessed_at, hit_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(cache_key) DO UPDATE SET
      normalized_query = excluded.normalized_query,
      request_json = excluded.request_json,
      result_json = excluded.result_json,
      source_revision = excluded.source_revision,
      fetched_at = excluded.fetched_at,
      expires_at = excluded.expires_at,
      stale_until = excluded.stale_until,
      last_accessed_at = excluded.last_accessed_at,
      hit_count = 0
  `);
  const prune = db.prepare('DELETE FROM evidence_query_cache WHERE stale_until <= ?');

  function timestamp(value = now()) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Evidence cache clock is invalid');
    return date.toISOString();
  }

  function get(cacheKey, { countHit = true } = {}) {
    const row = byKey.get(cacheKey);
    if (!row) return null;
    if (countHit) touch.run(timestamp(), cacheKey);
    return evidenceCacheFromRow(byKey.get(cacheKey));
  }

  function put(input) {
    upsert.run(
      input.cacheKey,
      input.normalizedQuery,
      JSON.stringify(input.request),
      JSON.stringify(input.result),
      input.sourceRevision,
      timestamp(input.fetchedAt),
      timestamp(input.expiresAt),
      timestamp(input.staleUntil),
      timestamp(),
    );
    return get(input.cacheKey, { countHit: false });
  }

  function pruneExpired(at = now()) {
    return Number(prune.run(timestamp(at)).changes || 0);
  }

  return Object.freeze({ get, put, pruneExpired });
}

function transcriptionSegmentFromRow(row) {
  if (!row) return null;
  return Object.freeze({
    id: row.id,
    sessionId: row.session_id,
    orgId: row.org_id,
    sequence: Number(row.sequence),
    uploadId: row.upload_id,
    audioUrl: row.audio_url,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    status: row.status,
    transcriptText: row.transcript_text,
    speakers: row.speakers_json ? JSON.parse(row.speakers_json) : [],
    providerReceipt: row.provider_receipt_json ? JSON.parse(row.provider_receipt_json) : null,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function transcriptionSessionFromRow(row, segments = []) {
  if (!row) return null;
  return Object.freeze({
    id: row.id,
    schemaVersion: Number(row.schema_version),
    orgId: row.org_id,
    userId: row.user_id,
    status: row.status,
    label: row.label,
    clientId: row.client_id,
    appointmentId: row.appointment_id,
    careEpisodeId: row.care_episode_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: Number(row.duration_seconds),
    transcriptText: row.transcript_text || '',
    artifacts: row.artifacts_json ? JSON.parse(row.artifacts_json) : null,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    segments,
  });
}

export function createTranscriptionSessionRepository(db, { now = () => new Date() } = {}) {
  ensureTranscriptionSessionSchema(db);
  const sessionById = db.prepare('SELECT * FROM transcription_session WHERE id = ?');
  const segmentsBySession = db.prepare(`
    SELECT * FROM transcription_segment WHERE session_id = ? ORDER BY sequence
  `);
  const recentByOrg = db.prepare(`
    SELECT * FROM transcription_session
    WHERE org_id = ? AND status != 'discarded'
    ORDER BY updated_at DESC LIMIT ?
  `);
  const activeByUser = db.prepare(`
    SELECT * FROM transcription_session
    WHERE org_id = ? AND user_id = ?
      AND status IN ('recording', 'paused', 'finalising', 'recoverable', 'error')
    ORDER BY updated_at DESC LIMIT 1
  `);
  const insertSession = db.prepare(`
    INSERT INTO transcription_session (
      id, org_id, user_id, status, label, client_id, appointment_id,
      care_episode_id, started_at, duration_seconds, created_at, updated_at
    ) VALUES (?, ?, ?, 'recording', ?, ?, ?, ?, ?, 0, ?, ?)
  `);
  const updateSession = db.prepare(`
    UPDATE transcription_session
    SET status = ?, label = ?, client_id = ?, appointment_id = ?, care_episode_id = ?,
        ended_at = ?, duration_seconds = ?, transcript_text = ?, artifacts_json = ?,
        last_error_code = ?, updated_at = ?
    WHERE id = ?
  `);
  const segmentBySequence = db.prepare(`
    SELECT * FROM transcription_segment WHERE session_id = ? AND sequence = ?
  `);
  const insertSegment = db.prepare(`
    INSERT INTO transcription_segment (
      id, session_id, org_id, sequence, upload_id, audio_url, mime_type,
      byte_size, duration_seconds, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?)
  `);
  const updateSegment = db.prepare(`
    UPDATE transcription_segment
    SET duration_seconds = ?, status = ?, transcript_text = ?, speakers_json = ?,
        provider_receipt_json = ?, last_error_code = ?, updated_at = ?
    WHERE session_id = ? AND sequence = ?
  `);

  function timestamp(value = now()) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Transcription clock is invalid');
    return date.toISOString();
  }

  function get(id) {
    const row = sessionById.get(id);
    if (!row) return null;
    const segments = segmentsBySession.all(id).map(transcriptionSegmentFromRow);
    return transcriptionSessionFromRow(row, segments);
  }

  function listRecent(orgId, limit = 20) {
    const safeLimit = Number.isSafeInteger(limit) && limit > 0 && limit <= 100 ? limit : 20;
    return recentByOrg.all(orgId, safeLimit).map((row) => transcriptionSessionFromRow(row));
  }

  function findActive(orgId, userId) {
    const row = activeByUser.get(orgId, userId);
    return row ? get(row.id) : null;
  }

  function create(input) {
    const id = input.id || randomUUID();
    const startedAt = timestamp(input.startedAt);
    insertSession.run(
      id, input.orgId, input.userId, input.label,
      input.clientId ?? null, input.appointmentId ?? null, input.careEpisodeId ?? null,
      startedAt, startedAt, startedAt,
    );
    return get(id);
  }

  function update(id, patch) {
    const current = get(id);
    if (!current) return null;
    const next = {
      status: patch.status ?? current.status,
      label: patch.label ?? current.label,
      clientId: patch.clientId === undefined ? current.clientId : patch.clientId,
      appointmentId: patch.appointmentId === undefined ? current.appointmentId : patch.appointmentId,
      careEpisodeId: patch.careEpisodeId === undefined ? current.careEpisodeId : patch.careEpisodeId,
      endedAt: patch.endedAt === undefined ? current.endedAt : patch.endedAt,
      durationSeconds: patch.durationSeconds ?? current.durationSeconds,
      transcriptText: patch.transcriptText ?? current.transcriptText,
      artifacts: patch.artifacts === undefined ? current.artifacts : patch.artifacts,
      lastErrorCode: patch.lastErrorCode === undefined ? current.lastErrorCode : patch.lastErrorCode,
    };
    updateSession.run(
      next.status, next.label, next.clientId, next.appointmentId, next.careEpisodeId,
      next.endedAt, next.durationSeconds, next.transcriptText,
      next.artifacts == null ? null : JSON.stringify(next.artifacts),
      next.lastErrorCode, timestamp(), id,
    );
    return get(id);
  }

  function addSegment(input) {
    const existing = segmentBySequence.get(input.sessionId, input.sequence);
    if (existing) return transcriptionSegmentFromRow(existing);
    const observedAt = timestamp();
    insertSegment.run(
      input.id || randomUUID(), input.sessionId, input.orgId, input.sequence,
      input.uploadId, input.audioUrl, input.mimeType, input.byteSize,
      input.durationSeconds ?? null, observedAt, observedAt,
    );
    return transcriptionSegmentFromRow(segmentBySequence.get(input.sessionId, input.sequence));
  }

  function updateSegmentResult(sessionId, sequence, patch) {
    const current = transcriptionSegmentFromRow(segmentBySequence.get(sessionId, sequence));
    if (!current) return null;
    updateSegment.run(
      patch.durationSeconds === undefined ? current.durationSeconds : patch.durationSeconds,
      patch.status ?? current.status,
      patch.transcriptText === undefined ? current.transcriptText : patch.transcriptText,
      JSON.stringify(patch.speakers === undefined ? current.speakers : patch.speakers),
      patch.providerReceipt === undefined
        ? (current.providerReceipt == null ? null : JSON.stringify(current.providerReceipt))
        : (patch.providerReceipt == null ? null : JSON.stringify(patch.providerReceipt)),
      patch.lastErrorCode === undefined ? current.lastErrorCode : patch.lastErrorCode,
      timestamp(), sessionId, sequence,
    );
    return transcriptionSegmentFromRow(segmentBySequence.get(sessionId, sequence));
  }

  function rebuildTranscript(sessionId) {
    const segments = segmentsBySession.all(sessionId).map(transcriptionSegmentFromRow);
    const transcript = segments
      .filter((segment) => segment.status === 'ready' && segment.transcriptText)
      .map((segment) => segment.transcriptText.trim())
      .filter(Boolean)
      .join('\n\n');
    const durationSeconds = Math.round(segments.reduce((total, segment) => total + (segment.durationSeconds || 0), 0));
    return update(sessionId, { transcriptText: transcript, durationSeconds });
  }

  return Object.freeze({
    addSegment,
    create,
    findActive,
    get,
    listRecent,
    rebuildTranscript,
    update,
    updateSegmentResult,
  });
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
