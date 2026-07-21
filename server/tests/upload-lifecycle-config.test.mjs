import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const DAY_MS = 24 * 60 * 60 * 1000;

function runModule(source, environment = {}) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: repoRoot,
    env: { ...process.env, ...environment },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

function createLifecycleTables(db) {
  db.exec(`
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
    CREATE TABLE upload_audit (
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
  `);
}

test('production rejects any non-730 audit-retention override without echoing its value', () => {
  const canary = 'synthetic-retention-secret-729';
  const refused = runModule("await import('./server/uploadRegistry.mjs')", {
    NODE_ENV: 'production',
    SELFTEST: '',
    UPLOAD_AUDIT_RETENTION_DAYS: canary,
    UPLOAD_CLEANUP_INTERVAL_MINUTES: '1',
  });
  assert.notEqual(refused.status, 0, `${refused.stdout}\n${refused.stderr}`);
  assert.match(`${refused.stdout}\n${refused.stderr}`, /must remain 730 in production/);
  assert.doesNotMatch(`${refused.stdout}\n${refused.stderr}`, new RegExp(canary));

  const accepted = runModule("await import('./server/uploadRegistry.mjs')", {
    NODE_ENV: 'production',
    SELFTEST: '',
    UPLOAD_AUDIT_RETENTION_DAYS: '730',
    UPLOAD_CLEANUP_INTERVAL_MINUTES: '1',
  });
  assert.equal(accepted.status, 0, `${accepted.stdout}\n${accepted.stderr}`);

  const cleanupCanary = 'synthetic-cleanup-secret-15';
  const cleanupRefused = runModule("await import('./server/uploadRegistry.mjs')", {
    NODE_ENV: 'production',
    SELFTEST: '',
    UPLOAD_AUDIT_RETENTION_DAYS: '730',
    UPLOAD_CLEANUP_INTERVAL_MINUTES: cleanupCanary,
  });
  assert.notEqual(cleanupRefused.status, 0, `${cleanupRefused.stdout}\n${cleanupRefused.stderr}`);
  assert.match(`${cleanupRefused.stdout}\n${cleanupRefused.stderr}`, /must remain 1 in production/);
  assert.doesNotMatch(`${cleanupRefused.stdout}\n${cleanupRefused.stderr}`, new RegExp(cleanupCanary));
});

test('runtime, production manifest, example configuration, and scheduler preserve the controlled retention cadence', async () => {
  const { UPLOAD_POLICY } = await import('../uploadRegistry.mjs');
  assert.equal(UPLOAD_POLICY.auditRetentionMs, 730 * DAY_MS);

  const productionManifest = fs.readFileSync(path.join(repoRoot, 'fly.production.toml'), 'utf8');
  assert.match(productionManifest, /^\s*UPLOAD_AUDIT_RETENTION_DAYS\s*=\s*"730"\s*$/m);
  assert.match(productionManifest, /^\s*UPLOAD_CLEANUP_INTERVAL_MINUTES\s*=\s*"1"\s*$/m);

  const exampleConfiguration = fs.readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
  assert.match(exampleConfiguration, /^UPLOAD_AUDIT_RETENTION_DAYS=730\s*$/m);
  assert.match(exampleConfiguration, /^UPLOAD_CLEANUP_INTERVAL_MINUTES=1\s*$/m);

  const serverSource = fs.readFileSync(path.join(repoRoot, 'server', 'index.mjs'), 'utf8');
  assert.match(serverSource, /const uploadCleanupIntervalMinutes = 1;/);
  assert.match(
    serverSource,
    /setInterval\(\s*runUploadLifecycleMaintenance,\s*uploadCleanupIntervalMinutes \* 60 \* 1000,\s*\)/s,
  );
});

test('startup reconciliation removes a final file renamed before activation and preserves active uploads', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-upload-rename-recovery-'));
  const uploadsDir = path.join(tempDir, 'uploads');
  const dbPath = path.join(tempDir, 'recovery.db');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const interruptedId = '00000000-0000-4000-8000-000000000011';
  const activeId = '00000000-0000-4000-8000-000000000012';
  const interruptedName = `${interruptedId}.pdf`;
  const activeName = `${activeId}.pdf`;
  const interruptedPath = path.join(uploadsDir, interruptedName);
  const interruptedTempPath = `${interruptedPath}.registering`;
  const providerBlockPath = path.join(uploadsDir, `${interruptedId}.provider-block`);
  const activePath = path.join(uploadsDir, activeName);
  const bytes = Buffer.from('%PDF-1.4\nsynthetic rename-before-activation recovery fixture\n%%EOF\n');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const createdAt = '2026-07-21T00:00:00.000Z';
  const expiresAt = '2026-07-21T23:59:00.000Z';
  const db = new DatabaseSync(dbPath);

  try {
    createLifecycleTables(db);
    const insert = db.prepare(`
      INSERT INTO upload_registry (
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, is_legacy
      ) VALUES (?, ?, ?, 'synthetic-org', 'synthetic-user', 'referral-extraction',
                'application/pdf', ?, ?, ?, '13_or_over', ?, ?, 0)
    `);
    insert.run(
      interruptedId,
      interruptedName,
      'interrupted-after-rename.pdf',
      bytes.length,
      digest,
      'registering',
      createdAt,
      expiresAt,
    );
    insert.run(
      activeId,
      activeName,
      'active-control.pdf',
      bytes.length,
      digest,
      'temporary',
      createdAt,
      expiresAt,
    );

    // This is the precise crash window: rename completed, the temporary name
    // no longer exists, and the durable row was not activated.
    fs.writeFileSync(interruptedPath, bytes, { flag: 'wx' });
    fs.writeFileSync(providerBlockPath, Buffer.alloc(0), { flag: 'wx' });
    fs.writeFileSync(activePath, bytes, { flag: 'wx' });
    assert.equal(fs.existsSync(interruptedTempPath), false);

    const { createUploadRegistry } = await import('../uploadRegistry.mjs');
    const registry = createUploadRegistry(db, { uploadsDir });

    const interrupted = db.prepare('SELECT * FROM upload_registry WHERE id = ?').get(interruptedId);
    assert.equal(interrupted.lifecycle_state, 'deleted');
    assert.equal(interrupted.original_name, '[deleted]');
    assert.equal(interrupted.deleted_at, interrupted.expires_at);
    assert.equal(fs.existsSync(interruptedPath), false, 'renamed orphan bytes must be removed');
    assert.equal(fs.existsSync(interruptedTempPath), false);
    assert.equal(fs.existsSync(providerBlockPath), false);
    assert.ok(db.prepare(`
      SELECT id FROM upload_audit
      WHERE upload_id = ?
        AND event_type = 'upload_registration_reconciled'
        AND outcome = 'removed'
    `).get(interruptedId));

    const active = registry.getById(activeId);
    assert.equal(active.state, 'temporary');
    assert.equal(fs.existsSync(activePath), true, 'activated upload bytes must remain intact');

    const repeated = registry.reconcileInterruptedRegistrations();
    assert.equal(repeated.examined, 0);
    assert.equal(repeated.removed, 0);
    assert.equal(repeated.partial, 0);
    assert.equal(repeated.historicalArtifacts.removed, 0);
    assert.equal(repeated.historicalArtifacts.rowlessFinalReviewRequired, 0);
  } finally {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('historical rowless reconciliation is pattern-only, age-bounded, content-free, and idempotent', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-rowless-reconciliation-'));
  const uploadsDir = path.join(tempDir, 'uploads');
  const dbPath = path.join(tempDir, 'reconciliation.db');
  const symlinkTarget = path.join(tempDir, 'symlink-target');
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(symlinkTarget);
  const db = new DatabaseSync(dbPath);
  const now = new Date();
  const staleAt = new Date(now.getTime() - DAY_MS - 60_000);
  const freshAt = new Date(now.getTime() - 60 * 60 * 1000);
  const privateContentCanary = 'synthetic-private-referral-body-canary';
  const privateNameCanary = 'synthetic-private-referral-name.txt';
  const ids = {
    stalePending: '00000000-0000-4000-8000-000000000101',
    stalePendingOperation: '00000000-0000-4000-8000-000000000201',
    freshPending: '00000000-0000-4000-8000-000000000102',
    freshPendingOperation: '00000000-0000-4000-8000-000000000202',
    staleRegistering: '00000000-0000-4000-8000-000000000103',
    freshRegistering: '00000000-0000-4000-8000-000000000104',
    staleProviderBlock: '00000000-0000-4000-8000-000000000105',
    freshProviderBlock: '00000000-0000-4000-8000-000000000106',
    nonemptyProviderBlock: '00000000-0000-4000-8000-000000000107',
    rowlessFinal: '00000000-0000-4000-8000-000000000108',
    registered: '00000000-0000-4000-8000-000000000109',
    directory: '00000000-0000-4000-8000-000000000110',
    symlink: '00000000-0000-4000-8000-000000000111',
    startup: '00000000-0000-4000-8000-000000000112',
    unsupported: '00000000-0000-4000-8000-000000000113',
    rowlessFinalEmpty: '00000000-0000-4000-8000-000000000114',
  };
  const names = {
    stalePending: `${ids.stalePending}.pdf.pending-${ids.stalePendingOperation}`,
    freshPending: `${ids.freshPending}.csv.pending-${ids.freshPendingOperation}`,
    staleRegistering: `${ids.staleRegistering}.docx.registering`,
    freshRegistering: `${ids.freshRegistering}.png.registering`,
    staleProviderBlock: `${ids.staleProviderBlock}.provider-block`,
    freshProviderBlock: `${ids.freshProviderBlock}.provider-block`,
    nonemptyProviderBlock: `${ids.nonemptyProviderBlock}.provider-block`,
    rowlessFinal: `${ids.rowlessFinal}.pdf`,
    rowlessFinalEmpty: `${ids.rowlessFinalEmpty}.csv`,
    registeredStored: `${ids.registered}.pdf`,
    registeredArtifact: `${ids.registered}.pdf.registering`,
    directory: `${ids.directory}.jpg.registering`,
    symlink: `${ids.symlink}.webp.registering`,
    startup: `${ids.startup}.pdf.registering`,
    unsupported: `${ids.unsupported}.exe.registering`,
  };

  const writeAt = (name, contents, mtime) => {
    const filePath = path.join(uploadsDir, name);
    fs.writeFileSync(filePath, contents, { flag: 'wx' });
    fs.utimesSync(filePath, mtime, mtime);
    return filePath;
  };

  try {
    createLifecycleTables(db);
    db.prepare(`
      INSERT INTO upload_registry (
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, is_legacy
      ) VALUES (?, ?, 'registered-control.pdf', 'synthetic-org', 'synthetic-user',
                'referral-extraction', 'application/pdf', 5, ?, 'temporary',
                '13_or_over', ?, ?, 0)
    `).run(
      ids.registered,
      names.registeredStored,
      '0'.repeat(64),
      staleAt.toISOString(),
      new Date(now.getTime() + DAY_MS).toISOString(),
    );

    writeAt(names.stalePending, privateContentCanary, staleAt);
    writeAt(names.freshPending, privateContentCanary, freshAt);
    writeAt(names.staleRegistering, privateContentCanary, staleAt);
    writeAt(names.freshRegistering, privateContentCanary, freshAt);
    writeAt(names.staleProviderBlock, Buffer.alloc(0), staleAt);
    writeAt(names.freshProviderBlock, Buffer.alloc(0), freshAt);
    writeAt(names.nonemptyProviderBlock, privateContentCanary, staleAt);
    writeAt(names.rowlessFinal, privateContentCanary, staleAt);
    writeAt(names.rowlessFinalEmpty, Buffer.alloc(0), staleAt);
    writeAt(names.registeredArtifact, privateContentCanary, staleAt);
    fs.mkdirSync(path.join(uploadsDir, names.directory));
    fs.symlinkSync(
      symlinkTarget,
      path.join(uploadsDir, names.symlink),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    writeAt(privateNameCanary, privateContentCanary, staleAt);
    writeAt(names.unsupported, privateContentCanary, staleAt);

    const { reconcileHistoricalRowlessUploadArtifacts, createUploadRegistry } =
      await import('../uploadRegistry.mjs');
    const observedLogs = [];
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    for (const method of Object.keys(originalConsole)) {
      console[method] = (...args) => observedLogs.push([method, ...args]);
    }
    let first;
    try {
      first = reconcileHistoricalRowlessUploadArtifacts({ db, uploadsDir, now });
    } finally {
      Object.assign(console, originalConsole);
    }

    assert.deepEqual(first, {
      examinedEntries: 14,
      managedCandidates: 12,
      removed: 3,
      removedPredecessorPending: 1,
      removedRegistering: 1,
      removedProviderBlocks: 1,
      rowlessFinalReviewRequired: 2,
      preservedFresh: 3,
      preservedRegistered: 1,
      preservedUnsafeType: 2,
      preservedNonemptyProviderBlock: 1,
      partial: 0,
      truncated: false,
    });
    assert.deepEqual(observedLogs, []);
    const serialized = JSON.stringify(first);
    assert.doesNotMatch(serialized, new RegExp(privateContentCanary));
    assert.doesNotMatch(serialized, new RegExp(privateNameCanary));
    assert.equal(Object.values(first).every((value) => ['number', 'boolean'].includes(typeof value)), true);

    for (const name of [names.stalePending, names.staleRegistering, names.staleProviderBlock]) {
      assert.equal(fs.existsSync(path.join(uploadsDir, name)), false);
    }
    for (const name of [
      names.freshPending,
      names.freshRegistering,
      names.freshProviderBlock,
      names.nonemptyProviderBlock,
      names.rowlessFinal,
      names.rowlessFinalEmpty,
      names.registeredArtifact,
      names.directory,
      names.symlink,
      privateNameCanary,
      names.unsupported,
    ]) {
      assert.equal(fs.existsSync(path.join(uploadsDir, name)), true, 'non-eligible artifact must remain');
    }

    const second = reconcileHistoricalRowlessUploadArtifacts({ db, uploadsDir, now });
    assert.equal(second.removed, 0);
    assert.equal(second.rowlessFinalReviewRequired, 2);
    assert.equal(second.preservedRegistered, 1);
    assert.equal(second.partial, 0);
    assert.equal(fs.existsSync(path.join(uploadsDir, names.rowlessFinal)), true);
    assert.equal(fs.existsSync(path.join(uploadsDir, names.rowlessFinalEmpty)), true);

    const startupPath = writeAt(names.startup, privateContentCanary, staleAt);
    const registry = createUploadRegistry(db, { uploadsDir });
    assert.equal(fs.existsSync(startupPath), false, 'registry startup must invoke rowless reconciliation');
    assert.equal(registry.getByStoredName(names.rowlessFinal), null);
    assert.equal(fs.existsSync(path.join(uploadsDir, names.rowlessFinal)), true);
    const recurring = registry.reconcileInterruptedRegistrations({ now });
    assert.equal(recurring.historicalArtifacts.removed, 0);
    assert.equal(recurring.historicalArtifacts.rowlessFinalReviewRequired, 2);
  } finally {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('reviewed-under-13 bulk quarantine secures every retained upload before reporting an item failure', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-reviewed-age-quarantine-'));
  const uploadsDir = path.join(tempDir, 'uploads');
  const dbPath = path.join(tempDir, 'quarantine.db');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const reviewPendingId = '00000000-0000-4000-8000-000000000021';
  const missingId = '00000000-0000-4000-8000-000000000022';
  const boundId = '00000000-0000-4000-8000-000000000023';
  const actorUserId = 'synthetic-reviewer';
  const quarantineAt = new Date('2026-07-21T03:04:05.000Z');
  const bytes = Buffer.from('%PDF-1.4\nsynthetic reviewed age quarantine fixture\n%%EOF\n');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const db = new DatabaseSync(dbPath);

  try {
    createLifecycleTables(db);
    const insert = db.prepare(`
      INSERT INTO upload_registry (
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, bound_at, bound_entity_type, bound_entity_id,
        is_legacy
      ) VALUES (?, ?, ?, 'synthetic-org', 'synthetic-uploader', 'referral-extraction',
                'application/pdf', ?, ?, ?, '13_or_over', ?, ?, ?, ?, ?, 0)
    `);
    const createdAt = '2026-07-21T00:00:00.000Z';
    insert.run(
      reviewPendingId,
      `${reviewPendingId}.pdf`,
      'review-pending.pdf',
      bytes.length,
      digest,
      'review-pending',
      createdAt,
      '2026-07-21T23:59:00.000Z',
      null,
      null,
      null,
    );
    insert.run(
      boundId,
      `${boundId}.pdf`,
      'already-bound.pdf',
      bytes.length,
      digest,
      'bound',
      createdAt,
      null,
      '2026-07-21T01:00:00.000Z',
      'ClientDocument',
      'synthetic-document',
    );
    fs.writeFileSync(path.join(uploadsDir, `${reviewPendingId}.pdf`), bytes, { flag: 'wx' });
    fs.writeFileSync(path.join(uploadsDir, `${boundId}.pdf`), bytes, { flag: 'wx' });

    const { createUploadRegistry } = await import('../uploadRegistry.mjs');
    const registry = createUploadRegistry(db, { uploadsDir });
    let thrown;
    try {
      registry.quarantineReviewedUnder13(
        [reviewPendingId, missingId, boundId],
        { actorUserId, now: quarantineAt },
      );
    } catch (error) {
      thrown = error;
    }

    assert.equal(thrown?.code, 'upload_quarantine_incomplete');
    assert.equal(thrown?.httpStatus, 503);
    assert.deepEqual(thrown?.quarantineResult, {
      attempted: 3,
      quarantined: 2,
      alreadyTerminal: 0,
      failed: 1,
    });
    assert.equal(Object.keys(thrown).includes('quarantineResult'), false);
    assert.equal(Object.keys(thrown).includes('cause'), false);

    const reviewPending = registry.getById(reviewPendingId);
    assert.equal(reviewPending.subjectAgeBand, 'under_13');
    assert.equal(reviewPending.state, 'expired');
    assert.equal(reviewPending.expiresAt, quarantineAt.toISOString());
    assert.equal(registry.isProviderBlocked(reviewPendingId), true);
    assert.equal(fs.existsSync(path.join(uploadsDir, `${reviewPendingId}.provider-block`)), true);

    const bound = registry.getById(boundId);
    assert.equal(bound.subjectAgeBand, 'under_13');
    assert.equal(bound.state, 'bound');
    assert.equal(bound.boundEntityId, 'synthetic-document');
    assert.equal(registry.isProviderBlocked(boundId), true);
    assert.equal(fs.existsSync(path.join(uploadsDir, `${boundId}.provider-block`)), true);

    const audits = db.prepare(`
      SELECT upload_id, metadata_json FROM upload_audit
      WHERE event_type = 'referral_review_age_gate' AND outcome = 'blocked'
      ORDER BY upload_id ASC
    `).all();
    assert.deepEqual(audits.map((row) => row.upload_id), [reviewPendingId, boundId]);
    for (const row of audits) {
      const metadata = JSON.parse(row.metadata_json);
      assert.equal(metadata.code, 'reviewed_subject_under_13');
      assert.doesNotMatch(row.metadata_json, /date.of.birth|subject_dob|\bdob\b|2020|patient/i);
    }
  } finally {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('database startup widens the existing upload lifecycle constraint without losing rows', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-upload-migration-'));
  const dbPath = path.join(tempDir, 'migration.db');
  const id = '00000000-0000-4000-8000-000000000001';
  try {
    const oldDb = new DatabaseSync(dbPath);
    oldDb.exec(`
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
    oldDb.prepare(`
      INSERT INTO upload_registry (
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, is_legacy
      ) VALUES (?, 'legacy-row.pdf', 'legacy-row.pdf', 'org-a', 'user-a',
                'referral-extraction', 'application/pdf', 5, ?, 'temporary',
                '13_or_over', '2026-07-20T00:00:00.000Z',
                '2026-07-21T00:00:00.000Z', 0)
    `).run(id, '0'.repeat(64));
    oldDb.close();

    const result = runModule(`
      const { openDatabase } = await import('./server/db.mjs');
      const { db } = openDatabase();
      const ddl = String(db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'upload_registry'").get()?.sql || '');
      const row = db.prepare('SELECT * FROM upload_registry WHERE id = ?').get('${id}');
      if (!ddl.includes("'registering'") || row?.stored_name !== 'legacy-row.pdf') process.exitCode = 7;
      db.close();
    `, {
      NODE_ENV: 'test',
      SELFTEST: '',
      ASSESSSUITE_DB_PATH: dbPath,
      ASSESSSUITE_DB_PATH_ACK: 'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE',
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const migrated = new DatabaseSync(dbPath);
    try {
      assert.match(
        migrated.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'upload_registry'").get().sql,
        /'registering'/,
      );
      assert.equal(migrated.prepare('SELECT stored_name FROM upload_registry WHERE id = ?').get(id).stored_name, 'legacy-row.pdf');
      migrated.prepare(`
        INSERT INTO upload_registry (
          id, stored_name, original_name, org_id, uploader_user_id, purpose,
          detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
          created_at, expires_at, is_legacy
        ) VALUES ('00000000-0000-4000-8000-000000000002', 'registering.pdf',
                  'registering.pdf', 'org-a', 'user-a', 'referral-extraction',
                  'application/pdf', 5, ?, 'registering', '13_or_over',
                  '2026-07-20T00:00:00.000Z', '2026-07-21T00:00:00.000Z', 0)
      `).run('1'.repeat(64));
    } finally {
      migrated.close();
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
