import { createHash } from 'node:crypto';

import {
  ARTIFACT_STATES,
  AUDIT_EVENT_STATES,
  CAPABILITY_STATES,
  CONFIG_STATES,
  JOB_STATES,
  REVIEW_STATES,
  RUN_STATES,
} from './domainStates.mjs';
import { CoreContractError } from './errors.mjs';
import { CORE_PURPOSES } from './requestContext.mjs';

export const CORE_SCHEMA_VERSION = 1;

function sqlValues(values) {
  return values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', ');
}

const PURPOSE_CHECK = sqlValues(CORE_PURPOSES);
const ARTIFACT_STATE_CHECK = sqlValues(ARTIFACT_STATES);
const RUN_STATE_CHECK = sqlValues(RUN_STATES);
const REVIEW_STATE_CHECK = sqlValues(REVIEW_STATES);
const CONFIG_STATE_CHECK = sqlValues(CONFIG_STATES);
const CAPABILITY_STATE_CHECK = sqlValues(CAPABILITY_STATES);
const JOB_STATE_CHECK = sqlValues(JOB_STATES);
const AUDIT_STATE_CHECK = sqlValues(AUDIT_EVENT_STATES);

/**
 * Additive relational Core V1 schema. The legacy `entity_*` JSON tables remain
 * untouched and are reached later through explicit compatibility adapters.
 */
export const CORE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS core_context_snapshot (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN (${PURPOSE_CHECK})),
    subject_type TEXT,
    subject_id TEXT,
    source_manifest_json TEXT NOT NULL CHECK (json_valid(source_manifest_json)),
    context_json TEXT NOT NULL CHECK (json_valid(context_json)),
    content_hash TEXT NOT NULL UNIQUE CHECK (
      substr(content_hash, 1, 7) = 'sha256:' AND
      length(content_hash) = 71 AND
      substr(content_hash, 8) NOT GLOB '*[^0-9a-f]*'
    ),
    cutoff_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    CHECK ((subject_type IS NULL) = (subject_id IS NULL))
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_core_context_snapshot_org_purpose_created
    ON core_context_snapshot(org_id, purpose, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_core_context_snapshot_subject
    ON core_context_snapshot(org_id, subject_type, subject_id, created_at DESC)
    WHERE subject_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS core_config_version (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    config_key TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN (${CONFIG_STATE_CHECK})),
    config_json TEXT NOT NULL CHECK (json_valid(config_json)),
    content_hash TEXT NOT NULL CHECK (
      substr(content_hash, 1, 7) = 'sha256:' AND
      length(content_hash) = 71 AND
      substr(content_hash, 8) NOT GLOB '*[^0-9a-f]*'
    ),
    validation_ref TEXT,
    approval_ref TEXT,
    deployment_authority_ref TEXT,
    reason_code TEXT,
    state_version INTEGER NOT NULL DEFAULT 0 CHECK (state_version >= 0),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (state <> 'validated' OR validation_ref IS NOT NULL),
    CHECK (state <> 'approved' OR approval_ref IS NOT NULL),
    CHECK (state <> 'active' OR (approval_ref IS NOT NULL AND deployment_authority_ref IS NOT NULL))
  ) STRICT;

  CREATE UNIQUE INDEX IF NOT EXISTS uq_core_config_version_scope
    ON core_config_version(config_key, COALESCE(org_id, ''), version);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_core_config_one_active
    ON core_config_version(config_key, COALESCE(org_id, ''))
    WHERE state = 'active';

  CREATE TABLE IF NOT EXISTS core_capability (
    capability_key TEXT PRIMARY KEY,
    state TEXT NOT NULL DEFAULT 'registered' CHECK (state IN (${CAPABILITY_STATE_CHECK})),
    active_config_version_id TEXT REFERENCES core_config_version(id),
    validation_ref TEXT,
    approval_ref TEXT,
    deployment_authority_ref TEXT,
    reason_code TEXT,
    state_version INTEGER NOT NULL DEFAULT 0 CHECK (state_version >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (
      state <> 'production_active' OR
      (
        active_config_version_id IS NOT NULL AND
        validation_ref IS NOT NULL AND
        approval_ref IS NOT NULL AND
        deployment_authority_ref IS NOT NULL
      )
    )
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_core_capability_state ON core_capability(state);

  CREATE TABLE IF NOT EXISTS core_run (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    run_type TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN (${PURPOSE_CHECK})),
    execution_mode TEXT NOT NULL CHECK (execution_mode IN ('sandbox', 'production')),
    context_snapshot_id TEXT NOT NULL REFERENCES core_context_snapshot(id),
    capability_key TEXT NOT NULL REFERENCES core_capability(capability_key),
    config_version_id TEXT NOT NULL REFERENCES core_config_version(id),
    state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN (${RUN_STATE_CHECK})),
    request_hash TEXT NOT NULL CHECK (
      substr(request_hash, 1, 7) = 'sha256:' AND
      length(request_hash) = 71 AND
      substr(request_hash, 8) NOT GLOB '*[^0-9a-f]*'
    ),
    error_code TEXT,
    state_version INTEGER NOT NULL DEFAULT 0 CHECK (state_version >= 0),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    CHECK (state <> 'running' OR started_at IS NOT NULL),
    CHECK (state NOT IN ('succeeded', 'failed', 'cancelled') OR completed_at IS NOT NULL),
    CHECK (state <> 'failed' OR error_code IS NOT NULL)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_core_run_org_state_created
    ON core_run(org_id, state, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_core_run_snapshot ON core_run(context_snapshot_id);

  CREATE TABLE IF NOT EXISTS core_artifact (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    artifact_type TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN (${PURPOSE_CHECK})),
    context_snapshot_id TEXT NOT NULL REFERENCES core_context_snapshot(id),
    run_id TEXT REFERENCES core_run(id),
    config_version_id TEXT NOT NULL REFERENCES core_config_version(id),
    state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN (${ARTIFACT_STATE_CHECK})),
    content_json TEXT NOT NULL CHECK (json_valid(content_json)),
    content_hash TEXT NOT NULL CHECK (
      substr(content_hash, 1, 7) = 'sha256:' AND
      length(content_hash) = 71 AND
      substr(content_hash, 8) NOT GLOB '*[^0-9a-f]*'
    ),
    supersedes_artifact_id TEXT REFERENCES core_artifact(id),
    state_version INTEGER NOT NULL DEFAULT 0 CHECK (state_version >= 0),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_core_artifact_org_type_state
    ON core_artifact(org_id, artifact_type, state, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_core_artifact_run ON core_artifact(run_id);
  CREATE INDEX IF NOT EXISTS idx_core_artifact_snapshot ON core_artifact(context_snapshot_id);

  CREATE TABLE IF NOT EXISTS core_artifact_source (
    artifact_id TEXT NOT NULL REFERENCES core_artifact(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_version TEXT,
    source_hash TEXT CHECK (
      source_hash IS NULL OR (
        substr(source_hash, 1, 7) = 'sha256:' AND
        length(source_hash) = 71 AND
        substr(source_hash, 8) NOT GLOB '*[^0-9a-f]*'
      )
    ),
    source_snapshot_id TEXT REFERENCES core_context_snapshot(id),
    PRIMARY KEY (artifact_id, ordinal),
    UNIQUE (artifact_id, source_type, source_id, source_version)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_core_artifact_source_lookup
    ON core_artifact_source(source_type, source_id, source_version);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_core_artifact_source_identity
    ON core_artifact_source(artifact_id, source_type, source_id, COALESCE(source_version, ''));

  CREATE TABLE IF NOT EXISTS core_review (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL REFERENCES core_artifact(id),
    artifact_state_version INTEGER NOT NULL CHECK (artifact_state_version >= 0),
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN (${REVIEW_STATE_CHECK})),
    reviewer_actor_id TEXT,
    decision_code TEXT,
    state_version INTEGER NOT NULL DEFAULT 0 CHECK (state_version >= 0),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    decided_at TEXT,
    CHECK (state NOT IN ('in_review', 'changes_requested', 'approved', 'rejected') OR reviewer_actor_id IS NOT NULL),
    CHECK (state NOT IN ('changes_requested', 'approved', 'rejected') OR (decision_code IS NOT NULL AND decided_at IS NOT NULL))
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_core_review_artifact_state
    ON core_review(artifact_id, state, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_core_review_org_reviewer
    ON core_review(org_id, reviewer_actor_id, state);

  CREATE TABLE IF NOT EXISTS core_job (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    job_type TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN (${PURPOSE_CHECK})),
    run_id TEXT REFERENCES core_run(id),
    state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN (${JOB_STATE_CHECK})),
    priority INTEGER NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 1000),
    attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 10),
    available_at TEXT NOT NULL,
    lease_id TEXT,
    worker_id TEXT,
    lease_expires_at TEXT,
    error_code TEXT,
    state_version INTEGER NOT NULL DEFAULT 0 CHECK (state_version >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    CHECK (attempt <= max_attempts),
    CHECK (state NOT IN ('leased', 'running') OR (lease_id IS NOT NULL AND worker_id IS NOT NULL)),
    CHECK (state <> 'leased' OR lease_expires_at IS NOT NULL),
    CHECK (state NOT IN ('succeeded', 'failed', 'cancelled') OR completed_at IS NOT NULL),
    CHECK (state <> 'failed' OR error_code IS NOT NULL)
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_core_job_queue
    ON core_job(state, priority, available_at, created_at);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_core_job_single_active_worker
    ON core_job((1)) WHERE state IN ('leased', 'running');

  CREATE TABLE IF NOT EXISTS core_audit_event (
    id TEXT PRIMARY KEY,
    state TEXT NOT NULL DEFAULT 'recorded' CHECK (state IN (${AUDIT_STATE_CHECK})),
    org_id TEXT,
    actor_user_id TEXT,
    request_id TEXT,
    run_id TEXT REFERENCES core_run(id),
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed', 'noop')),
    from_state TEXT,
    to_state TEXT,
    reason_code TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json) AND json_type(metadata_json) = 'object'),
    occurred_at TEXT NOT NULL,
    CHECK (entity_type = 'system' OR (org_id IS NOT NULL AND entity_id IS NOT NULL))
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_core_audit_org_time
    ON core_audit_event(org_id, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_core_audit_entity_time
    ON core_audit_event(entity_type, entity_id, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_core_audit_run_time
    ON core_audit_event(run_id, occurred_at DESC) WHERE run_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS core_idempotency_key (
    org_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    key_hash TEXT NOT NULL CHECK (
      substr(key_hash, 1, 7) = 'sha256:' AND
      length(key_hash) = 71 AND
      substr(key_hash, 8) NOT GLOB '*[^0-9a-f]*'
    ),
    request_hash TEXT NOT NULL CHECK (
      substr(request_hash, 1, 7) = 'sha256:' AND
      length(request_hash) = 71 AND
      substr(request_hash, 8) NOT GLOB '*[^0-9a-f]*'
    ),
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'completed')),
    response_ref TEXT,
    response_status INTEGER CHECK (response_status IS NULL OR response_status BETWEEN 200 AND 599),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    PRIMARY KEY (org_id, route_id, key_hash),
    CHECK (
      (state = 'pending' AND response_ref IS NULL AND response_status IS NULL) OR
      (state = 'completed' AND response_ref IS NOT NULL AND response_status IS NOT NULL)
    )
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_core_idempotency_expiry ON core_idempotency_key(expires_at);

  CREATE TRIGGER IF NOT EXISTS core_context_snapshot_immutable
  BEFORE UPDATE ON core_context_snapshot
  BEGIN
    SELECT RAISE(ABORT, 'core context snapshots are immutable');
  END;

  CREATE TRIGGER IF NOT EXISTS core_audit_event_immutable_update
  BEFORE UPDATE ON core_audit_event
  BEGIN
    SELECT RAISE(ABORT, 'core audit events are append-only');
  END;

  CREATE TRIGGER IF NOT EXISTS core_audit_event_immutable_delete
  BEFORE DELETE ON core_audit_event
  BEGIN
    SELECT RAISE(ABORT, 'core audit events are append-only');
  END;

  CREATE TRIGGER IF NOT EXISTS core_capability_registered_insert
  BEFORE INSERT ON core_capability
  WHEN NEW.state <> 'registered'
  BEGIN
    SELECT RAISE(ABORT, 'core capabilities must start registered and disabled');
  END;

  CREATE TRIGGER IF NOT EXISTS core_capability_state_transition
  BEFORE UPDATE OF state ON core_capability
  WHEN NEW.state <> OLD.state AND NOT (
    (OLD.state = 'registered' AND NEW.state IN ('sandbox_only', 'retired')) OR
    (OLD.state = 'sandbox_only' AND NEW.state IN ('validated', 'suspended', 'retired')) OR
    (OLD.state = 'validated' AND NEW.state IN ('sandbox_only', 'approved_disabled', 'suspended', 'retired')) OR
    (OLD.state = 'approved_disabled' AND NEW.state IN ('production_active', 'sandbox_only', 'suspended', 'retired')) OR
    (OLD.state = 'production_active' AND NEW.state IN ('approved_disabled', 'suspended', 'retired')) OR
    (OLD.state = 'suspended' AND NEW.state IN ('sandbox_only', 'approved_disabled', 'retired'))
  )
  BEGIN
    SELECT RAISE(ABORT, 'invalid core capability state transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_capability_activation_config_match
  BEFORE UPDATE OF state, active_config_version_id ON core_capability
  WHEN NEW.state = 'production_active' AND NOT EXISTS (
    SELECT 1
    FROM core_config_version AS config
    WHERE config.id = NEW.active_config_version_id
      AND config.config_key = NEW.capability_key
      AND config.org_id IS NULL
      AND config.state = 'active'
  )
  BEGIN
    SELECT RAISE(ABORT, 'production capability requires its matching active global config');
  END;

  CREATE TRIGGER IF NOT EXISTS core_config_state_transition
  BEFORE UPDATE OF state ON core_config_version
  WHEN NEW.state <> OLD.state AND NOT (
    (OLD.state = 'draft' AND NEW.state IN ('validated', 'retired')) OR
    (OLD.state = 'validated' AND NEW.state IN ('draft', 'approved', 'retired')) OR
    (OLD.state = 'approved' AND NEW.state IN ('draft', 'active', 'retired')) OR
    (OLD.state = 'active' AND NEW.state IN ('superseded', 'retired'))
  )
  BEGIN
    SELECT RAISE(ABORT, 'invalid core config state transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_run_state_transition
  BEFORE UPDATE OF state ON core_run
  WHEN NEW.state <> OLD.state AND NOT (
    (OLD.state = 'queued' AND NEW.state IN ('running', 'cancelled')) OR
    (OLD.state = 'running' AND NEW.state IN ('succeeded', 'failed', 'cancelled'))
  )
  BEGIN
    SELECT RAISE(ABORT, 'invalid core run state transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_artifact_state_transition
  BEFORE UPDATE OF state ON core_artifact
  WHEN NEW.state <> OLD.state AND NOT (
    (OLD.state = 'draft' AND NEW.state IN ('review', 'withdrawn')) OR
    (OLD.state = 'review' AND NEW.state IN ('draft', 'approved', 'rejected', 'withdrawn')) OR
    (OLD.state = 'approved' AND NEW.state IN ('superseded', 'withdrawn')) OR
    (OLD.state = 'rejected' AND NEW.state IN ('draft', 'withdrawn'))
  )
  BEGIN
    SELECT RAISE(ABORT, 'invalid core artifact state transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_review_state_transition
  BEFORE UPDATE OF state ON core_review
  WHEN NEW.state <> OLD.state AND NOT (
    (OLD.state = 'pending' AND NEW.state IN ('in_review', 'cancelled')) OR
    (OLD.state = 'in_review' AND NEW.state IN ('changes_requested', 'approved', 'rejected', 'cancelled')) OR
    (OLD.state = 'changes_requested' AND NEW.state IN ('in_review', 'cancelled'))
  )
  BEGIN
    SELECT RAISE(ABORT, 'invalid core review state transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_job_state_transition
  BEFORE UPDATE OF state ON core_job
  WHEN NEW.state <> OLD.state AND NOT (
    (OLD.state = 'queued' AND NEW.state IN ('leased', 'cancelled')) OR
    (OLD.state = 'leased' AND NEW.state IN ('queued', 'running', 'failed', 'cancelled')) OR
    (OLD.state = 'running' AND NEW.state IN ('succeeded', 'failed', 'cancelled'))
  )
  BEGIN
    SELECT RAISE(ABORT, 'invalid core job state transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_artifact_state_version
  BEFORE UPDATE OF state, state_version ON core_artifact
  WHEN
    (NEW.state <> OLD.state AND NEW.state_version <> OLD.state_version + 1) OR
    (NEW.state = OLD.state AND NEW.state_version <> OLD.state_version)
  BEGIN
    SELECT RAISE(ABORT, 'core artifact state version must advance exactly once per transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_run_state_version
  BEFORE UPDATE OF state, state_version ON core_run
  WHEN
    (NEW.state <> OLD.state AND NEW.state_version <> OLD.state_version + 1) OR
    (NEW.state = OLD.state AND NEW.state_version <> OLD.state_version)
  BEGIN
    SELECT RAISE(ABORT, 'core run state version must advance exactly once per transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_review_state_version
  BEFORE UPDATE OF state, state_version ON core_review
  WHEN
    (NEW.state <> OLD.state AND NEW.state_version <> OLD.state_version + 1) OR
    (NEW.state = OLD.state AND NEW.state_version <> OLD.state_version)
  BEGIN
    SELECT RAISE(ABORT, 'core review state version must advance exactly once per transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_config_state_version
  BEFORE UPDATE OF state, state_version ON core_config_version
  WHEN
    (NEW.state <> OLD.state AND NEW.state_version <> OLD.state_version + 1) OR
    (NEW.state = OLD.state AND NEW.state_version <> OLD.state_version)
  BEGIN
    SELECT RAISE(ABORT, 'core config state version must advance exactly once per transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_capability_state_version
  BEFORE UPDATE OF state, state_version ON core_capability
  WHEN
    (NEW.state <> OLD.state AND NEW.state_version <> OLD.state_version + 1) OR
    (NEW.state = OLD.state AND NEW.state_version <> OLD.state_version)
  BEGIN
    SELECT RAISE(ABORT, 'core capability state version must advance exactly once per transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_job_state_version
  BEFORE UPDATE OF state, state_version ON core_job
  WHEN
    (NEW.state <> OLD.state AND NEW.state_version <> OLD.state_version + 1) OR
    (NEW.state = OLD.state AND NEW.state_version <> OLD.state_version)
  BEGIN
    SELECT RAISE(ABORT, 'core job state version must advance exactly once per transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_idempotency_state_transition
  BEFORE UPDATE OF state ON core_idempotency_key
  WHEN NEW.state <> OLD.state AND NOT (OLD.state = 'pending' AND NEW.state = 'completed')
  BEGIN
    SELECT RAISE(ABORT, 'invalid core idempotency state transition');
  END;

  CREATE TRIGGER IF NOT EXISTS core_idempotency_identity_immutable
  BEFORE UPDATE ON core_idempotency_key
  WHEN
    NEW.org_id IS NOT OLD.org_id OR
    NEW.route_id IS NOT OLD.route_id OR
    NEW.key_hash IS NOT OLD.key_hash OR
    NEW.request_hash IS NOT OLD.request_hash OR
    NEW.created_at IS NOT OLD.created_at
  BEGIN
    SELECT RAISE(ABORT, 'core idempotency identity is immutable');
  END;
`;

export const CORE_SCHEMA_CHECKSUM = `sha256:${createHash('sha256')
  .update(CORE_SCHEMA_SQL)
  .digest('hex')}`;

/**
 * Installs Core tables on the existing DatabaseSync handle. Call once from
 * `openDatabase()` after current legacy schema creation and before returning
 * the handle. The caller must not already own a transaction.
 */
export function installCoreSchema(db) {
  if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') {
    throw new CoreContractError('CORE_INVALID_DATABASE', 'a DatabaseSync-compatible handle is required');
  }

  db.exec('PRAGMA foreign_keys = ON;');
  const foreignKeys = Number(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys || 0);
  if (foreignKeys !== 1) {
    throw new CoreContractError(
      'CORE_FOREIGN_KEYS_DISABLED',
      'Core schema requires SQLite foreign-key enforcement',
    );
  }

  let installed = false;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS core_schema_migration (
        version INTEGER PRIMARY KEY CHECK (version > 0),
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);
    const existing = db
      .prepare('SELECT checksum FROM core_schema_migration WHERE version = ?')
      .get(CORE_SCHEMA_VERSION);
    if (existing && existing.checksum !== CORE_SCHEMA_CHECKSUM) {
      throw new CoreContractError(
        'CORE_SCHEMA_CHECKSUM_MISMATCH',
        'installed Core schema does not match this build',
        { httpStatus: 500 },
      );
    }

    db.exec(CORE_SCHEMA_SQL);
    if (!existing) {
      db.prepare(
        'INSERT INTO core_schema_migration (version, checksum, applied_at) VALUES (?, ?, ?)',
      ).run(CORE_SCHEMA_VERSION, CORE_SCHEMA_CHECKSUM, new Date().toISOString());
      installed = true;
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return Object.freeze({
    version: CORE_SCHEMA_VERSION,
    checksum: CORE_SCHEMA_CHECKSUM,
    installed,
  });
}
