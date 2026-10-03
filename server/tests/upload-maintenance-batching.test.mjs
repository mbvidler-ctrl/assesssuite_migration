import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import {
  cleanupExpiredUploadsAsync, cleanupExpiredUploadAuditAsync,
  createHistoricalUploadArtifactReconciler, createUploadRegistry, UPLOAD_POLICY,
} from '../uploadRegistry.mjs';

const now = new Date('2026-10-04T00:00:00.000Z');
const old = '2026-10-01T00:00:00.000Z';
const due = '2026-10-03T00:00:00.000Z';
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-maintenance-'));
  const uploadsDir = path.join(root, 'uploads');
  fs.mkdirSync(uploadsDir);
  const db = new DatabaseSync(path.join(root, 'test.sqlite'));
  t.after(() => { db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  db.exec(`
    CREATE TABLE upload_registry (
      id TEXT PRIMARY KEY, stored_name TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL,
      org_id TEXT NOT NULL, uploader_user_id TEXT NOT NULL, purpose TEXT NOT NULL,
      detected_mime TEXT NOT NULL, byte_size INTEGER NOT NULL, sha256 TEXT NOT NULL,
      lifecycle_state TEXT NOT NULL, subject_age_band TEXT NOT NULL,
      created_at TEXT NOT NULL, expires_at TEXT, bound_at TEXT, deleted_at TEXT,
      bound_entity_type TEXT, bound_entity_id TEXT, is_legacy INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE upload_audit (
      id TEXT PRIMARY KEY, upload_id TEXT, org_id TEXT NOT NULL, actor_user_id TEXT NOT NULL,
      event_type TEXT NOT NULL, outcome TEXT NOT NULL, metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL, expires_at TEXT NOT NULL, legal_hold INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE upload_disposition (
      upload_id TEXT PRIMARY KEY, org_id TEXT NOT NULL, status TEXT NOT NULL,
      reason_code TEXT NOT NULL, planned_action TEXT NOT NULL, review_due_at TEXT NOT NULL,
      recorded_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE extraction_usage (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
    CREATE TABLE entity_Test (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  `);
  function add(n, { state = 'temporary', expires = due, created = old, legacy = 0, bound = false, file = true } = {}) {
    const id = uuid(n);
    db.prepare(`INSERT INTO upload_registry (
      id, stored_name, original_name, org_id, uploader_user_id, purpose, detected_mime,
      byte_size, sha256, lifecycle_state, subject_age_band, created_at, expires_at,
      bound_at, bound_entity_type, bound_entity_id, is_legacy
    ) VALUES (?, ?, 'synthetic.pdf', 'synthetic-org', 'synthetic-user', 'referral-extraction',
              'application/pdf', 1, ?, ?, '13_or_over', ?, ?, ?, ?, ?, ?)`)
      .run(id, `${id}.pdf`, '0'.repeat(64), state, created, expires,
        bound ? old : null, bound ? 'Test' : null, bound ? 'synthetic-entity' : null, legacy);
    if (file) fs.writeFileSync(path.join(uploadsDir, `${id}.pdf`), 'x');
    return id;
  }
  return { db, uploadsDir, add };
}

test('constructor recovers only 25 rows; async recovery drains with yields past failed rows and leaves future rows denied', async (t) => {
  const { db, uploadsDir, add } = fixture(t);
  const failed = add(1, { state: 'registering', file: false });
  fs.mkdirSync(path.join(uploadsDir, `${failed}.pdf`));
  for (let n = 2; n <= 61; n++) add(n, { state: 'registering' });
  const historical = path.join(uploadsDir, `${uuid(200)}.pdf.registering`);
  fs.writeFileSync(historical, 'x');
  fs.utimesSync(historical, new Date(old), new Date(old));
  const registry = createUploadRegistry(db, { uploadsDir });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM upload_registry WHERE lifecycle_state = 'deleted'").get().n, 24);
  assert.equal(fs.existsSync(historical), true, 'startup recovery must not sweep historical artifacts');
  let yields = 0;
  const result = await registry.drainInterruptedRegistrations({ now, yieldToEventLoop: async () => {
    yields += 1;
    db.exec('BEGIN; ROLLBACK;'); // Never yield while a maintenance transaction is open.
    add(300, { state: 'registering', created: '2026-10-04T00:00:00.001Z' });
    await setImmediate();
  } });
  assert.deepEqual(result, { examined: 37, removed: 36, partial: 1 });
  assert.equal(yields, 1);
  assert.equal(registry.getById(failed).state, 'registering');
  assert.equal(registry.getById(uuid(300)).state, 'registering');
  assert.equal(fs.existsSync(historical), true, 'regular recovery must not sweep historical artifacts');
});

test('expiry drains all due batches, advances past protected/failed rows and rechecks after routes run', async (t) => {
  const { db, uploadsDir, add } = fixture(t);
  const failed = add(1, { file: false });
  fs.mkdirSync(path.join(uploadsDir, `${failed}.pdf`));
  const referenced = add(2);
  db.prepare('INSERT INTO entity_Test VALUES (?, ?)').run('reference', JSON.stringify({ file: `/api/files/${referenced}` }));
  const partial = add(3);
  db.prepare('INSERT INTO entity_Test VALUES (?, ?)').run('partial', `{"file":"${partial}"`);
  const legacy = add(4, { legacy: 1 });
  const bound = add(5, { state: 'bound', bound: true });
  for (let n = 6; n <= 61; n++) add(n);
  const marker = path.join(uploadsDir, `${uuid(6)}.provider-block`);
  fs.writeFileSync(marker, '');
  const future = add(62, { expires: '2026-10-04T00:00:00.001Z' });
  let yields = 0;
  let immediateHandled = false;
  const pendingImmediate = setImmediate().then(() => { immediateHandled = true; });
  const result = await cleanupExpiredUploadsAsync({ db, uploadsDir, now, yieldToEventLoop: async () => {
    yields += 1;
    db.exec('BEGIN; ROLLBACK;');
    if (yields === 1) db.prepare(`UPDATE upload_registry SET lifecycle_state = 'bound',
      bound_at = ?, bound_entity_type = 'Test', bound_entity_id = 'new-reference' WHERE id = ?`).run(old, uuid(40));
    await setImmediate();
  } });
  await pendingImmediate;
  assert.equal(immediateHandled, true);
  assert.equal(yields, 2);
  assert.equal(result.examined, 58);
  assert.equal(result.removed, 55);
  assert.equal(result.retained, 3);
  assert.equal(result.isolated, 3);
  assert.equal(result.partial, 2);
  assert.equal(fs.existsSync(marker), false);
  for (const id of [failed, referenced, partial, legacy, bound, uuid(40), future]) {
    assert.equal(fs.existsSync(path.join(uploadsDir, `${id}.pdf`)), true);
  }
  assert.equal(db.prepare('SELECT lifecycle_state FROM upload_registry WHERE id = ?').get(uuid(61)).lifecycle_state, 'deleted');
  assert.equal(db.prepare('SELECT expires_at FROM upload_registry WHERE id = ?').get(referenced).expires_at, null);
});

test('expiry dry run traverses every batch without changing bytes or rows', async (t) => {
  const { db, uploadsDir, add } = fixture(t);
  for (let n = 1; n <= 61; n++) add(n);
  let yields = 0;
  const result = await cleanupExpiredUploadsAsync({ db, uploadsDir, now, dryRun: true,
    yieldToEventLoop: async () => { yields += 1; await setImmediate(); } });
  assert.equal(result.examined, 61);
  assert.equal(result.removed, 61);
  assert.equal(result.dryRun, true);
  assert.equal(yields, 2);
  assert.equal(fs.readdirSync(uploadsDir).length, 61);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM upload_registry WHERE lifecycle_state = 'temporary'").get().n, 61);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM upload_audit').get().n, 0);
});

test('audit, usage and deleted registry cleanup deletes at most 100 per batch and preserves retention/holds', async (t) => {
  const { db, add } = fixture(t);
  const cutoff = new Date(now.getTime() - UPLOAD_POLICY.auditRetentionMs).toISOString();
  const fresh = new Date(new Date(cutoff).getTime() + 1).toISOString();
  const audit = db.prepare(`INSERT INTO upload_audit VALUES (?, NULL, 'synthetic-org', 'system',
    'synthetic', 'synthetic', '{}', ?, ?, ?)`);
  const usage = db.prepare('INSERT INTO extraction_usage VALUES (?, ?)');
  for (let n = 1; n <= 251; n++) {
    audit.run(uuid(n), old, due, 0);
    usage.run(uuid(n), cutoff);
    add(n, { state: 'deleted', file: false });
    db.prepare('UPDATE upload_registry SET deleted_at = ? WHERE id = ?').run(cutoff, uuid(n));
  }
  audit.run('held', old, due, 1);
  audit.run('fresh', old, '2026-10-04T00:00:00.001Z', 0);
  usage.run('fresh', fresh);
  add(300, { state: 'deleted', file: false });
  db.prepare('UPDATE upload_registry SET deleted_at = ? WHERE id = ?').run(fresh, uuid(300));
  let yields = 0;
  const result = await cleanupExpiredUploadAuditAsync({ db, now, yieldToEventLoop: async () => {
    yields += 1;
    db.exec('BEGIN; ROLLBACK;');
    if (yields === 1) assert.equal(db.prepare('SELECT COUNT(*) AS n FROM upload_audit').get().n, 153);
    await setImmediate();
  } });
  assert.equal(result.removed, 753);
  assert.equal(yields, 9);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM upload_audit').get().n, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM extraction_usage').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM upload_registry').get().n, 1);
});

test('audit dry run advances over retained batches without deleting records', async (t) => {
  const { db } = fixture(t);
  const cutoff = new Date(now.getTime() - UPLOAD_POLICY.auditRetentionMs).toISOString();
  const insert = db.prepare('INSERT INTO extraction_usage VALUES (?, ?)');
  for (let n = 1; n <= 201; n++) insert.run(uuid(n), cutoff);
  let yields = 0;
  const result = await cleanupExpiredUploadAuditAsync({ db, now, dryRun: true,
    yieldToEventLoop: async () => { yields += 1; await setImmediate(); } });
  assert.equal(result.removed, 201);
  assert.equal(result.dryRun, true);
  assert.equal(yields, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM extraction_usage').get().n, 201);
});

test('historical scanning retains iterator and lookahead across the 10,000-entry ceiling', async (t) => {
  const { db, uploadsDir } = fixture(t);
  // Final files are protected and stay present, making a restart from the
  // beginning observable. No private contents are needed for this test.
  for (let n = 1; n <= 10_003; n++) fs.writeFileSync(path.join(uploadsDir, `${uuid(n)}.pdf`), '');
  const scanner = createHistoricalUploadArtifactReconciler({ db, uploadsDir });
  t.after(() => scanner.close());
  let yields = 0;
  let firstBatch;
  const firstPromise = scanner.runPass({ now, yieldToEventLoop: async () => {
    yields += 1;
    firstBatch ||= fs.readdirSync(uploadsDir).length;
    await setImmediate();
  } });
  assert.equal(scanner.runPass({ now }), firstPromise, 'overlapping passes share one flight');
  const first = await firstPromise;
  assert.equal(first.examinedEntries, 10_000);
  assert.equal(first.rowlessFinalReviewRequired, 10_000);
  assert.equal(first.truncated, true);
  assert.equal(yields, 399);
  assert.equal(firstBatch, 10_003);
  const second = await scanner.runPass({ now });
  assert.equal(second.examinedEntries, 3, 'lookahead and later entries must be examined exactly once');
  assert.equal(second.rowlessFinalReviewRequired, 3);
  assert.equal(second.truncated, false);
  assert.equal(second.partial, 0);
  assert.equal(fs.readdirSync(uploadsDir).length, 10_003);
});

test('historical scanner closes on failure and shutdown without reopening a cancelled pass', async (t) => {
  const { db, uploadsDir } = fixture(t);
  for (let n = 1; n <= 51; n++) fs.writeFileSync(path.join(uploadsDir, `${uuid(n)}.pdf`), '');
  const scanner = createHistoricalUploadArtifactReconciler({ db, uploadsDir });
  const failed = await scanner.runPass({ now, yieldToEventLoop: async () => { throw new Error('synthetic failure'); } });
  assert.equal(failed.examinedEntries, 25);
  assert.equal(failed.partial, 1);
  const cancelled = await scanner.runPass({ now, yieldToEventLoop: async () => { scanner.close(); await setImmediate(); } });
  assert.equal(cancelled.examinedEntries, 25);
  assert.equal(cancelled.partial, 0);
  const afterClose = await scanner.runPass({ now });
  assert.equal(afterClose.examinedEntries, 0);
  assert.equal(afterClose.partial, 0);
});
