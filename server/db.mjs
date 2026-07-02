// SQLite persistence layer for the local Base44 shim.
// Uses node:sqlite (DatabaseSync) — a Node 24 built-in, zero new dependencies.

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

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
function loadEntityNames() {
  const raw = fs.readFileSync(entitySchemasPath, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.schemas.map((entry) => entry.entity_name);
}

/**
 * Opens (creating if absent) the shim's SQLite database and ensures every
 * table required by the contract exists. SELFTEST=1 uses a dedicated,
 * freshly-recreated database file so self-test runs never pollute dev data.
 */
export function openDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });

  const isSelftest = process.env.SELFTEST === '1';
  const dbFile = path.join(dataDir, isSelftest ? 'selftest.db' : 'app.db');

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
