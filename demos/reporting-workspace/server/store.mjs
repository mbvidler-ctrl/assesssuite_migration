// SQLite document store for the reporting-workflow demo.
//
// The table layout mirrors the live shim (server/db.mjs): one
// entity_<Name>(id, data) table per entity, with the JSON document carrying
// id, created_date, updated_date and created_by. Keeping the same shape means
// the demo's ReportOutputRequest and ReportDocumentSnapshot rows could be
// registered as local entities in the live shim without a storage migration
// (see docs/reporting/ for the coexistence plan). The store is intentionally
// tiny: equality filters are evaluated in memory, which is adequate for a
// demonstration dataset and keeps the module dependency-free.

import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { WorkflowError } from '../domain/util.mjs';

export const ENTITY_NAMES = Object.freeze([
  'Organization',
  'OrganizationMember',
  'User',
  'Client',
  'PhysioCareEpisode',
  'Assessment',
  'ClientAssessment',
  'SOAPNote',
  'SavedReport',
  'ClientDocument',
  'ReportOutputRequest',
  'ReportDocumentSnapshot',
]);

/** Entities whose rows may never be updated or deleted once written. */
export const IMMUTABLE_ENTITIES = Object.freeze(new Set(['ReportDocumentSnapshot']));

function matches(row, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (expected === undefined) return true;
    return row[key] === expected;
  });
}

export function openStore(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  for (const name of ENTITY_NAMES) {
    db.exec(`CREATE TABLE IF NOT EXISTS entity_${name} (id TEXT PRIMARY KEY, data TEXT NOT NULL)`);
  }
  db.exec('CREATE TABLE IF NOT EXISTS demo_session (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS demo_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

  const statements = new Map();
  const prepared = (sql) => {
    if (!statements.has(sql)) statements.set(sql, db.prepare(sql));
    return statements.get(sql);
  };

  function repo(name) {
    if (!ENTITY_NAMES.includes(name)) throw new WorkflowError(500, 'unknown_entity', `Unknown entity ${name}.`);
    const table = `entity_${name}`;
    const immutable = IMMUTABLE_ENTITIES.has(name);
    return {
      name,
      create(data, actor = 'demo', { now = new Date().toISOString(), id = null } = {}) {
        const recordId = id || data.id || randomUUID();
        const existing = prepared(`SELECT id FROM ${table} WHERE id = ?`).get(recordId);
        if (existing) throw new WorkflowError(409, 'record_exists', `${name} ${recordId} already exists.`);
        const record = { ...data, id: recordId, created_date: data.created_date || now, updated_date: data.updated_date || now, created_by: data.created_by || actor };
        prepared(`INSERT INTO ${table} (id, data) VALUES (?, ?)`).run(recordId, JSON.stringify(record));
        return record;
      },
      getById(id) {
        const row = prepared(`SELECT data FROM ${table} WHERE id = ?`).get(id);
        return row ? JSON.parse(row.data) : null;
      },
      listAll() {
        return prepared(`SELECT data FROM ${table} ORDER BY id`).all().map((row) => JSON.parse(row.data));
      },
      filter(query = {}) {
        return this.listAll().filter((row) => matches(row, query));
      },
      update(id, patch, { now = new Date().toISOString() } = {}) {
        if (immutable) throw new WorkflowError(409, 'immutable_record', `${name} rows are immutable.`);
        const current = this.getById(id);
        if (!current) throw new WorkflowError(404, 'record_not_found', `${name} ${id} was not found.`);
        const { id: _id, created_date: _created, created_by: _createdBy, ...rest } = patch;
        const record = { ...current, ...rest, id, created_date: current.created_date, created_by: current.created_by, updated_date: now };
        prepared(`UPDATE ${table} SET data = ? WHERE id = ?`).run(JSON.stringify(record), id);
        return record;
      },
      replace(id, record, { now = new Date().toISOString() } = {}) {
        if (immutable) throw new WorkflowError(409, 'immutable_record', `${name} rows are immutable.`);
        const current = this.getById(id);
        if (!current) throw new WorkflowError(404, 'record_not_found', `${name} ${id} was not found.`);
        const next = { ...record, id, created_date: current.created_date, created_by: current.created_by, updated_date: now };
        prepared(`UPDATE ${table} SET data = ? WHERE id = ?`).run(JSON.stringify(next), id);
        return next;
      },
      count() {
        return Number(prepared(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
      },
    };
  }

  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* preserve the original error */ }
      throw error;
    }
  }

  const sessions = {
    create(userId, { now = new Date().toISOString() } = {}) {
      const token = randomUUID();
      prepared('INSERT INTO demo_session (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, now);
      return token;
    },
    resolve(token) {
      if (typeof token !== 'string' || !token) return null;
      const row = prepared('SELECT user_id FROM demo_session WHERE token = ?').get(token);
      return row ? row.user_id : null;
    },
    revoke(token) {
      prepared('DELETE FROM demo_session WHERE token = ?').run(token);
    },
  };

  const meta = {
    get(key) {
      const row = prepared('SELECT value FROM demo_meta WHERE key = ?').get(key);
      return row ? row.value : null;
    },
    set(key, value) {
      prepared('INSERT INTO demo_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
    },
  };

  return {
    db,
    path,
    repo,
    transaction,
    sessions,
    meta,
    isEmpty() {
      return repo('Organization').count() === 0;
    },
    close() {
      db.close();
    },
  };
}
