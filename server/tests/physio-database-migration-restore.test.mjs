import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { createEntityRepository, openDatabase } from '../db.mjs';

const ISOLATED_DB_ACK = 'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE';

async function withPhysioDatabase(dbPath, operation) {
  const overrides = {
    NODE_ENV: 'test',
    SELFTEST: undefined,
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    ASSESSSUITE_DB_PATH: dbPath,
    ASSESSSUITE_DB_PATH_ACK: ISOLATED_DB_ACK,
  };
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

function seedProductionShapedEpDatabase(dbPath) {
  const db = new DatabaseSync(dbPath);
  const now = Date.now();
  const createdAt = new Date(now - 60_000).toISOString();
  const expiresAt = new Date(now + 60 * 60_000).toISOString();
  try {
    db.exec(`
      PRAGMA journal_mode = DELETE;

      CREATE TABLE entity_User (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_date TEXT NOT NULL,
        updated_date TEXT NOT NULL,
        created_by TEXT
      );
      CREATE TABLE entity_Client (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_date TEXT NOT NULL,
        updated_date TEXT NOT NULL,
        created_by TEXT
      );
      CREATE TABLE entity_Assessment (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_date TEXT NOT NULL,
        updated_date TEXT NOT NULL,
        created_by TEXT
      );
      CREATE TABLE sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_date TEXT NOT NULL,
        expires_date TEXT
      );

      CREATE TABLE upload_registry (
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
          lifecycle_state IN ('temporary', 'processing', 'review-pending', 'bound', 'expired', 'deleted')
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
    `);

    const insertEntity = db.prepare(`
      INSERT INTO entity_Client (id, data, created_date, updated_date, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertEntity.run(
      'client-existing-ep',
      JSON.stringify({ org_id: 'org-existing', full_name: 'Synthetic Existing Client' }),
      createdAt,
      createdAt,
      'synthetic@example.test',
    );
    db.prepare(`
      INSERT INTO entity_Assessment (id, data, created_date, updated_date, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'assessment-existing-ep',
      JSON.stringify({ name: 'Existing EP catalogue record', source_id: 'existing-ep-source' }),
      createdAt,
      createdAt,
      'synthetic@example.test',
    );
    db.prepare('INSERT INTO sessions (token, user_id, created_date, expires_date) VALUES (?, ?, ?, ?)')
      .run('legacy-session-fixture-token', 'user-existing', createdAt, expiresAt);
    db.prepare(`
      INSERT INTO upload_registry (
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, bound_at, deleted_at, bound_entity_type,
        bound_entity_id, is_legacy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'upload-existing',
      'existing-referral.pdf',
      'referral.pdf',
      'org-existing',
      'user-existing',
      'referral-extraction',
      'application/pdf',
      128,
      'a'.repeat(64),
      'temporary',
      '13_or_over',
      createdAt,
      new Date(now + 24 * 60 * 60_000).toISOString(),
      null,
      null,
      null,
      null,
      0,
    );
  } finally {
    db.close();
  }
}

test('production-shaped EP database migrates in place and its Physio state survives restart and clone restore', { concurrency: false }, async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-physio-migration-'));
  const sourcePath = path.join(tempRoot, 'production-shaped.db');
  const preMigrationSnapshotPath = path.join(tempRoot, 'pre-migration-snapshot.db');
  const restoredPath = path.join(tempRoot, 'restored-physio.db');
  seedProductionShapedEpDatabase(sourcePath);
  fs.copyFileSync(sourcePath, preMigrationSnapshotPath);

  try {
    await withPhysioDatabase(sourcePath, () => {
      const { db, entityNames } = openDatabase();
      try {
        assert.ok(entityNames.has('PhysioCareEpisode'));
        assert.equal(
          db.prepare("SELECT type FROM sqlite_master WHERE name = 'entity_PhysioCareEpisode'").get()?.type,
          'table',
        );
        assert.equal(
          createEntityRepository(db, 'Client').getById('client-existing-ep')?.full_name,
          'Synthetic Existing Client',
        );
        assert.equal(
          createEntityRepository(db, 'Assessment').getById('assessment-existing-ep')?.source_id,
          'existing-ep-source',
        );
        assert.equal(
          db.prepare("SELECT user_id FROM sessions WHERE token = 'legacy-session-fixture-token'").get()?.user_id,
          'user-existing',
        );
        assert.match(
          db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'upload_registry'").get()?.sql || '',
          /'registering'/,
        );
        assert.equal(
          db.prepare("SELECT lifecycle_state FROM upload_registry WHERE id = 'upload-existing'").get()?.lifecycle_state,
          'temporary',
        );

        const episode = createEntityRepository(db, 'PhysioCareEpisode').create({
          schema_version: 2,
          org_id: 'org-existing',
          client_id: 'client-existing-ep',
          episode_number: 1,
          status: 'active',
          episode_start_date: '2026-08-22',
          presenting_problem: 'Synthetic migration and restore proof',
        }, 'synthetic@example.test');
        assert.ok(episode.id);
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      } finally {
        db.close();
      }
    });

    await withPhysioDatabase(sourcePath, () => {
      const { db } = openDatabase();
      try {
        const episodes = createEntityRepository(db, 'PhysioCareEpisode').listAll();
        assert.equal(episodes.length, 1);
        assert.equal(episodes[0].presenting_problem, 'Synthetic migration and restore proof');
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      } finally {
        db.close();
      }
    });

    fs.copyFileSync(sourcePath, restoredPath);
    await withPhysioDatabase(restoredPath, () => {
      const { db } = openDatabase();
      try {
        assert.equal(
          createEntityRepository(db, 'Client').getById('client-existing-ep')?.org_id,
          'org-existing',
        );
        const restoredEpisode = createEntityRepository(db, 'PhysioCareEpisode').listAll()[0];
        assert.equal(restoredEpisode.client_id, 'client-existing-ep');
        assert.equal(restoredEpisode.status, 'active');
        assert.equal(db.prepare('PRAGMA quick_check').get()?.quick_check, 'ok');
      } finally {
        db.close();
      }
    });

    assert.ok(fs.statSync(preMigrationSnapshotPath).size > 0);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
