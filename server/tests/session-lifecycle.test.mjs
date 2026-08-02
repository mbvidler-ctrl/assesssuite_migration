import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  SESSION_ABSOLUTE_TTL_MS,
  createSessionRepository,
  ensureSessionSchema,
} from '../db.mjs';
import {
  createTestStore,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const EXPECTED_MAX_CONCURRENT_SESSIONS = 8;

function openMemoryDatabase() {
  const db = new DatabaseSync(':memory:');
  ensureSessionSchema(db);
  return db;
}

test('unknown reset tokens are rejected before password hashing and rechecked under lock', () => {
  const source = fs.readFileSync(new URL('../index.mjs', import.meta.url), 'utf8');
  const databaseSource = fs.readFileSync(new URL('../db.mjs', import.meta.url), 'utf8');
  const start = source.indexOf("if (action === 'reset-password' && req.method === 'POST')");
  const end = source.indexOf("if (action === 'change-password' && req.method === 'POST')", start);
  const block = source.slice(start, end);
  const cheapPrecheck = block.indexOf('const resetCandidate =');
  const passwordHash = block.indexOf('hashPassword(new_password)');
  const writeLock = block.indexOf("db.exec('BEGIN IMMEDIATE')");
  const lockedRecheck = block.indexOf('const user = userRepo.listAll()', writeLock);

  assert.ok(start >= 0 && end > start);
  assert.ok(cheapPrecheck >= 0 && cheapPrecheck < passwordHash);
  assert.ok(passwordHash < writeLock);
  assert.ok(writeLock < lockedRecheck);
  assert.match(databaseSource, /PRAGMA busy_timeout = 5000;/);
});

test('session tokens expire server-side at the eight-hour absolute boundary', () => {
  const db = openMemoryDatabase();
  const issuedAt = Date.now();
  let now = issuedAt;
  const sessions = createSessionRepository(db, { now: () => now });
  const token = sessions.create('user-a');
  const stored = db.prepare('SELECT * FROM session_records WHERE token = ?').get(token);

  assert.equal(Date.parse(stored.created_date), issuedAt);
  assert.equal(Date.parse(stored.expires_date), issuedAt + SESSION_ABSOLUTE_TTL_MS);
  assert.equal(sessions.findByToken(token)?.user_id, 'user-a');

  now += SESSION_ABSOLUTE_TTL_MS - 1;
  assert.equal(sessions.findByToken(token)?.user_id, 'user-a');

  now += 1;
  assert.equal(sessions.findByToken(token), null);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM session_records').get().count, 0);
  db.close();
});

test('legacy migration and the retained rollback binary enforce expiry in SQLite', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_date TEXT NOT NULL
    );
    INSERT INTO sessions (token, user_id, created_date)
      VALUES ('legacy-token', 'legacy-user', '2026-08-01T00:00:00.000Z');
  `);

  const migration = ensureSessionSchema(db);
  assert.deepEqual(migration, { migrated: true, revokedSessions: 1 });
  assert.equal(
    db.prepare("SELECT type FROM sqlite_master WHERE name = 'sessions'").get().type,
    'view',
  );

  // This is the retained binary's exact table declaration and three-column
  // insert shape. CREATE TABLE remains a no-op against the compatibility view.
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_date TEXT NOT NULL
    );
  `);
  const legacyInsert = db.prepare(
    'INSERT INTO sessions (token, user_id, created_date) VALUES (?, ?, ?)',
  );
  const beforeInsert = Date.now();
  legacyInsert.run('rollback-current', 'rollback-user', '2999-01-01T00:00:00.000Z');
  const rollbackCurrent = db
    .prepare('SELECT * FROM sessions WHERE token = ?')
    .get('rollback-current');
  assert.ok(Date.parse(rollbackCurrent.created_date) >= beforeInsert - 1_000);
  assert.ok(Date.parse(rollbackCurrent.created_date) <= Date.now() + 1_000);
  assert.equal(
    Date.parse(rollbackCurrent.expires_date) - Date.parse(rollbackCurrent.created_date),
    SESSION_ABSOLUTE_TTL_MS,
  );

  const explicitCreated = new Date(Date.now() - 1_000).toISOString();
  const explicitOverlong = new Date(
    Date.parse(explicitCreated) + SESSION_ABSOLUTE_TTL_MS + 60_000,
  ).toISOString();
  assert.throws(
    () => db.prepare(`
      INSERT INTO sessions (token, user_id, created_date, expires_date)
      VALUES (?, ?, ?, ?)
    `).run('rollback-overlong', 'rollback-user', explicitCreated, explicitOverlong),
    /session lifetime exceeds eight hours/,
  );
  assert.throws(
    () => db.prepare(`
      INSERT INTO session_records (token, user_id, created_date, expires_date)
      VALUES (?, ?, ?, ?)
    `).run(
      'future-created',
      'rollback-user',
      '2999-01-01T00:00:00.000Z',
      '2999-01-01T08:00:00.000Z',
    ),
    /future session creation time/,
  );

  const forwardRecovery = ensureSessionSchema(db);
  assert.deepEqual(forwardRecovery, { migrated: false, revokedSessions: 0 });
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM session_records').get().count,
    1,
  );

  // The older binary's DELETE also remains compatible through the view.
  db.prepare('DELETE FROM sessions WHERE token = ?').run('rollback-current');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM session_records').get().count, 0);
  db.close();
});

test('migration is idempotent and preserves only a valid bounded session', () => {
  const db = new DatabaseSync(':memory:');
  const created = new Date(Date.now() - 60_000).toISOString();
  const expires = new Date(Date.parse(created) + SESSION_ABSOLUTE_TTL_MS).toISOString();
  const overlong = new Date(
    Date.parse(created) + SESSION_ABSOLUTE_TTL_MS + 60_000,
  ).toISOString();
  db.exec(`
    CREATE TABLE sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_date TEXT NOT NULL,
      expires_date TEXT
    );
  `);
  const insert = db.prepare(`
    INSERT INTO sessions (token, user_id, created_date, expires_date)
    VALUES (?, ?, ?, ?)
  `);
  insert.run('bounded', 'user-a', created, expires);
  insert.run('overlong', 'user-a', created, overlong);
  insert.run('unbounded', 'user-a', created, null);

  assert.deepEqual(ensureSessionSchema(db), { migrated: true, revokedSessions: 2 });
  assert.equal(db.prepare('SELECT token FROM session_records').get().token, 'bounded');
  assert.deepEqual(ensureSessionSchema(db), { migrated: false, revokedSessions: 0 });
  assert.equal(db.prepare('SELECT token FROM sessions').get().token, 'bounded');
  db.close();
});

test('migration and retained rollback inserts enforce the per-user session cap', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_date TEXT NOT NULL,
      expires_date TEXT
    );
  `);
  const insertLegacy = db.prepare(`
    INSERT INTO sessions (token, user_id, created_date, expires_date)
    VALUES (?, ?, ?, ?)
  `);
  const baseline = Date.now() - 60_000;
  for (let index = 0; index < EXPECTED_MAX_CONCURRENT_SESSIONS + 4; index += 1) {
    const created = new Date(baseline + index).toISOString();
    insertLegacy.run(
      `legacy-${String(index).padStart(2, '0')}`,
      'rollback-user',
      created,
      new Date(Date.parse(created) + SESSION_ABSOLUTE_TTL_MS).toISOString(),
    );
  }

  assert.deepEqual(ensureSessionSchema(db), { migrated: true, revokedSessions: 4 });
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM session_records WHERE user_id = ?')
      .get('rollback-user').count,
    EXPECTED_MAX_CONCURRENT_SESSIONS,
  );
  assert.equal(
    db.prepare('SELECT token FROM sessions WHERE token = ?').get('legacy-00'),
    undefined,
  );
  assert.equal(
    db.prepare('SELECT token FROM sessions WHERE token = ?').get('legacy-11').token,
    'legacy-11',
  );

  const rollbackInsert = db.prepare(
    'INSERT INTO sessions (token, user_id, created_date) VALUES (?, ?, ?)',
  );
  for (let index = 0; index < 4; index += 1) {
    rollbackInsert.run(`rollback-new-${index}`, 'rollback-user', '2999-01-01T00:00:00.000Z');
  }
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM session_records WHERE user_id = ?')
      .get('rollback-user').count,
    EXPECTED_MAX_CONCURRENT_SESSIONS,
  );
  assert.equal(
    db.prepare('SELECT token FROM sessions WHERE token = ?').get('rollback-new-3').token,
    'rollback-new-3',
  );
  db.close();
});

test('new session issuance opportunistically removes unpresented expired rows', () => {
  const db = openMemoryDatabase();
  const sessions = createSessionRepository(db);
  const expiredToken = sessions.create('user-a');
  db.exec('DROP TRIGGER session_records_update_guard;');
  db.prepare('UPDATE session_records SET expires_date = ? WHERE token = ?').run(
    '2000-01-01T00:00:00.000Z',
    expiredToken,
  );
  const current = sessions.create('user-b');

  assert.equal(db.prepare('SELECT * FROM session_records WHERE token = ?').get(expiredToken), undefined);
  assert.equal(db.prepare('SELECT * FROM session_records WHERE token = ?').get(current).user_id, 'user-b');
  db.close();
});

test('routine session issuance uses indexed expiry and per-user retention plans', () => {
  const db = openMemoryDatabase();
  const observedAt = new Date().toISOString();
  const expiryPlan = db.prepare(`
    EXPLAIN QUERY PLAN
    DELETE FROM session_records
    WHERE julianday(expires_date) <= julianday(?)
  `).all(observedAt);
  const retentionPlan = db.prepare(`
    EXPLAIN QUERY PLAN
    SELECT token
    FROM session_records
    WHERE user_id = ?
    ORDER BY created_date DESC, token DESC
    LIMIT -1 OFFSET ?
  `).all('synthetic-valid-user', EXPECTED_MAX_CONCURRENT_SESSIONS - 1);

  assert.match(
    expiryPlan.map((step) => step.detail).join('\n'),
    /USING INDEX idx_session_records_expires_julianday/,
  );
  assert.match(
    retentionPlan.map((step) => step.detail).join('\n'),
    /USING COVERING INDEX idx_session_records_user_created_token/,
  );
  assert.doesNotMatch(
    retentionPlan.map((step) => step.detail).join('\n'),
    /USE TEMP B-TREE|SCAN session_records/,
  );
  db.close();
});

test('session issuance retains only the newest bounded set for one user', () => {
  const db = openMemoryDatabase();
  let now = Date.now() - 1_000;
  const sessions = createSessionRepository(db, { now: () => now });
  const issued = [];
  const other = sessions.create('other-user');

  for (let index = 0; index < EXPECTED_MAX_CONCURRENT_SESSIONS + 4; index += 1) {
    now += 1;
    issued.push(sessions.create('bounded-user'));
  }

  const retained = db
    .prepare('SELECT token FROM session_records WHERE user_id = ? ORDER BY created_date ASC')
    .all('bounded-user')
    .map((row) => row.token);
  assert.equal(retained.length, EXPECTED_MAX_CONCURRENT_SESSIONS);
  assert.deepEqual(retained, issued.slice(-EXPECTED_MAX_CONCURRENT_SESSIONS));
  assert.equal(sessions.findByToken(issued[0]), null);
  assert.equal(sessions.findByToken(issued.at(-1))?.user_id, 'bounded-user');
  assert.equal(sessions.findByToken(other)?.user_id, 'other-user');
  db.close();
});

test('repository configuration cannot exceed the universal eight-hour maximum', () => {
  const db = openMemoryDatabase();
  assert.throws(
    () => createSessionRepository(db, { absoluteTtlMs: SESSION_ABSOLUTE_TTL_MS + 1 }),
    /cannot exceed eight hours/,
  );
  db.close();
});

test('backing session rows are immutable and cannot be renewed by moving both timestamps', () => {
  const db = openMemoryDatabase();
  const sessions = createSessionRepository(db);
  const token = sessions.create('user-a');
  const renewedCreated = new Date().toISOString();
  const renewedExpiry = new Date(
    Date.parse(renewedCreated) + SESSION_ABSOLUTE_TTL_MS,
  ).toISOString();

  assert.throws(
    () => db.prepare(`
      UPDATE session_records
      SET created_date = ?, expires_date = ?
      WHERE token = ?
    `).run(renewedCreated, renewedExpiry, token),
    /session records are immutable/,
  );
  assert.equal(sessions.findByToken(token)?.user_id, 'user-a');
  db.close();
});

test('user-wide revocation removes concurrent sessions without affecting another user', () => {
  const db = openMemoryDatabase();
  const sessions = createSessionRepository(db);
  const first = sessions.create('user-a');
  const second = sessions.create('user-a');
  const other = sessions.create('user-b');

  assert.equal(sessions.removeForUser('user-a'), 2);
  assert.equal(sessions.findByToken(first), null);
  assert.equal(sessions.findByToken(second), null);
  assert.equal(sessions.findByToken(other)?.user_id, 'user-b');
  db.close();
});

test('a bounded session remains enforceable after a database restart', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-session-persistence-'));
  const dbPath = path.join(tempRoot, 'sessions.db');
  const issuedAt = Date.now();
  let token;

  try {
    const firstDb = new DatabaseSync(dbPath);
    ensureSessionSchema(firstDb);
    token = createSessionRepository(firstDb, { now: () => issuedAt }).create('persistent-user');
    firstDb.close();

    const reopenedDb = new DatabaseSync(dbPath);
    ensureSessionSchema(reopenedDb);
    const sessions = createSessionRepository(reopenedDb, { now: () => issuedAt + 60_000 });
    assert.equal(sessions.findByToken(token)?.user_id, 'persistent-user');
    reopenedDb.close();
  } finally {
    // node:sqlite can retain a Windows file handle until process teardown even
    // after DatabaseSync.close(). The OS temp directory remains the bounded
    // cleanup owner on Windows; other platforms remove the fixture eagerly.
    if (process.platform !== 'win32') {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
});

test('reset password changes revoke sessions at the database layer for rollback compatibility', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE entity_User (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT
    );
  `);
  ensureSessionSchema(db);
  const users = db.prepare(`
    INSERT INTO entity_User (id, data, created_date, updated_date, created_by)
    VALUES (?, ?, ?, ?, ?)
  `);
  const timestamp = new Date().toISOString();
  users.run(
    'rollback-user',
    JSON.stringify({
      email: 'rollback-user@example.invalid',
      password_hash: 'synthetic-old-password-hash',
      reset_token: 'synthetic-reset-token',
    }),
    timestamp,
    timestamp,
    null,
  );

  const sessions = createSessionRepository(db);
  const token = sessions.create('rollback-user');
  db.prepare('UPDATE entity_User SET data = ? WHERE id = ?').run(
    JSON.stringify({
      email: 'changed@example.invalid',
      password_hash: 'synthetic-old-password-hash',
      reset_token: 'synthetic-reset-token',
    }),
    'rollback-user',
  );
  assert.equal(sessions.findByToken(token)?.user_id, 'rollback-user');

  ensureSessionSchema(db);
  db.prepare('UPDATE entity_User SET data = ? WHERE id = ?').run(
    JSON.stringify({
      email: 'changed@example.invalid',
      password_hash: 'synthetic-new-password-hash',
      reset_token: null,
    }),
    'rollback-user',
  );
  assert.equal(sessions.findByToken(token), null);
  db.close();
});

test('ordinary authenticated change-password does not invoke reset-driven revocation', async () => {
  const server = await startTestServer({ ALLOW_OPEN_REGISTRATION: '1' });
  try {
    const email = 'session-change-password-user@example.invalid';
    const newPassword = 'Synthetic-Authenticated-Password-2!';
    const registered = await registerUser(server, email);
    const changed = await requestJson(server, `/api/apps/${server.appId}/auth/change-password`, {
      method: 'POST',
      token: registered.token,
      body: {
        user_id: registered.id,
        current_password: 'Synthetic-Assurance-Password-1!',
        new_password: newPassword,
      },
    });
    assert.equal(changed.status, 200);

    const me = await requestJson(server, `/api/apps/${server.appId}/entities/User/me`, {
      token: registered.token,
    });
    assert.equal(me.status, 200);

    const freshLogin = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
      method: 'POST',
      body: { email, password: newPassword },
    });
    assert.equal(freshLogin.status, 200);
  } finally {
    await server.stop();
  }
});

test('logout removes the presented session through the public auth route', async () => {
  const server = await startTestServer({ ALLOW_OPEN_REGISTRATION: '1' });
  try {
    const registered = await registerUser(server, 'session-logout-user@example.invalid');
    const logout = await fetch(`${server.baseUrl}/api/apps/auth/logout?from_url=%2Flogin`, {
      headers: { Authorization: `Bearer ${registered.token}` },
      redirect: 'manual',
    });
    assert.equal(logout.status, 302);
    assert.equal(logout.headers.get('location'), '/login');

    const me = await requestJson(server, `/api/apps/${server.appId}/entities/User/me`, {
      token: registered.token,
    });
    assert.equal(me.status, 401);
    assert.deepEqual(me.body, { message: 'authentication required' });
  } finally {
    await server.stop();
  }
});

test('expired tokens are rejected by entity and function authentication routes', async () => {
  const server = await startTestServer({ ALLOW_OPEN_REGISTRATION: '1' });
  try {
    const registered = await registerUser(server, 'session-expired-route-user@example.invalid');
    const db = new DatabaseSync(server.dbPath);
    db.exec('DROP TRIGGER session_records_update_guard;');
    db.prepare('UPDATE session_records SET expires_date = ? WHERE token = ?').run(
      '2000-01-01T00:00:00.000Z',
      registered.token,
    );
    db.close();

    const me = await requestJson(server, `/api/apps/${server.appId}/entities/User/me`, {
      token: registered.token,
    });
    assert.equal(me.status, 401);

    const functionCall = await requestJson(
      server,
      `/api/apps/${server.appId}/functions/createPortalSession`,
      { method: 'POST', token: registered.token, body: {} },
    );
    assert.equal(functionCall.status, 401);
    assert.deepEqual(functionCall.body, { error: 'authentication required' });

    const verificationDb = new DatabaseSync(server.dbPath);
    assert.equal(
      verificationDb
        .prepare('SELECT * FROM session_records WHERE token = ?')
        .get(registered.token),
      undefined,
    );
    verificationDb.close();
  } finally {
    await server.stop();
  }
});

test('successful password reset revokes every issued session and permits a fresh login', async () => {
  const server = await startTestServer({ ALLOW_OPEN_REGISTRATION: '1' });
  try {
    const email = 'session-reset-user@example.invalid';
    const password = 'Synthetic-Assurance-Password-1!';
    const newPassword = 'Synthetic-Assurance-Password-2!';
    const registered = await registerUser(server, email);
    const secondLogin = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(secondLogin.status, 200);
    assert.ok(secondLogin.body?.access_token);

    const request = await requestJson(server, `/api/apps/${server.appId}/auth/reset-password-request`, {
      method: 'POST',
      body: { email },
    });
    assert.equal(request.status, 200);
    assert.deepEqual(request.body, { status: 'accepted' });

    const db = new DatabaseSync(server.dbPath);
    const userRow = db
      .prepare('SELECT data FROM entity_User')
      .all()
      .map((row) => JSON.parse(row.data))
      .find((user) => user.email === email);
    db.close();
    assert.match(userRow?.reset_token || '', /^[0-9a-f-]{36}$/i);

    const reset = await requestJson(server, `/api/apps/${server.appId}/auth/reset-password`, {
      method: 'POST',
      body: { reset_token: userRow.reset_token, new_password: newPassword },
    });
    assert.equal(reset.status, 200);
    assert.deepEqual(reset.body, { status: 'reset' });

    for (const token of [registered.token, secondLogin.body.access_token]) {
      const me = await requestJson(server, `/api/apps/${server.appId}/entities/User/me`, { token });
      assert.equal(me.status, 401);
      assert.deepEqual(me.body, { message: 'authentication required' });

      const functionCall = await requestJson(
        server,
        `/api/apps/${server.appId}/functions/createPortalSession`,
        { method: 'POST', token, body: {} },
      );
      assert.equal(functionCall.status, 401);
      assert.deepEqual(functionCall.body, { error: 'authentication required' });
    }

    const oldLogin = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(oldLogin.status, 401);

    const freshLogin = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
      method: 'POST',
      body: { email, password: newPassword },
    });
    assert.equal(freshLogin.status, 200);
    assert.ok(freshLogin.body?.access_token);
  } finally {
    await server.stop();
  }
});

test('two server processes cannot both consume the same reset token', async () => {
  const store = createTestStore('assesssuite-session-reset-race-');
  let setupServer;
  let firstServer;
  let secondServer;
  try {
    const email = 'session-reset-race-user@example.invalid';
    setupServer = await startTestServer(
      { ALLOW_OPEN_REGISTRATION: '1' },
      { store },
    );
    const registered = await registerUser(setupServer, email);
    await requestJson(setupServer, `/api/apps/${setupServer.appId}/auth/reset-password-request`, {
      method: 'POST',
      body: { email },
    });

    const db = new DatabaseSync(store.dbPath);
    const user = db
      .prepare('SELECT data FROM entity_User')
      .all()
      .map((row) => JSON.parse(row.data))
      .find((candidate) => candidate.email === email);
    db.close();
    assert.match(user?.reset_token || '', /^[0-9a-f-]{36}$/i);
    await setupServer.stop();
    setupServer = null;

    firstServer = await startTestServer(
      { ALLOW_OPEN_REGISTRATION: '1' },
      { store, selftest: false },
    );
    secondServer = await startTestServer(
      { ALLOW_OPEN_REGISTRATION: '1' },
      { store, selftest: false },
    );

    const passwords = [
      'Synthetic-Concurrent-Password-A-2!',
      'Synthetic-Concurrent-Password-B-2!',
    ];
    const attempts = await Promise.all(passwords.map((newPassword, index) => requestJson(
      index === 0 ? firstServer : secondServer,
      `/api/apps/${firstServer.appId}/auth/reset-password`,
      { method: 'POST', body: { reset_token: user.reset_token, new_password: newPassword } },
    )));
    assert.deepEqual(attempts.map((attempt) => attempt.status).sort(), [200, 400]);

    const logins = await Promise.all(passwords.map((password) => requestJson(
      firstServer,
      `/api/apps/${firstServer.appId}/auth/login`,
      { method: 'POST', body: { email, password } },
    )));
    assert.equal(logins.filter((login) => login.status === 200).length, 1);
    assert.equal(logins.filter((login) => login.status === 401).length, 1);

    const me = await requestJson(firstServer, `/api/apps/${firstServer.appId}/entities/User/me`, {
      token: registered.token,
    });
    assert.equal(me.status, 401);
  } finally {
    await setupServer?.stop();
    await firstServer?.stop();
    await secondServer?.stop();
    store.cleanup();
  }
});

test('a malformed reset-token expiry fails closed without revoking the current session', async () => {
  const server = await startTestServer({ ALLOW_OPEN_REGISTRATION: '1' });
  try {
    const email = 'session-reset-malformed-expiry-user@example.invalid';
    const registered = await registerUser(server, email);
    await requestJson(server, `/api/apps/${server.appId}/auth/reset-password-request`, {
      method: 'POST',
      body: { email },
    });

    const db = new DatabaseSync(server.dbPath);
    const row = db
      .prepare('SELECT id, data FROM entity_User')
      .all()
      .find((candidate) => JSON.parse(candidate.data).email === email);
    const user = JSON.parse(row.data);
    user.reset_token_expires = 'synthetic-invalid-expiry';
    db.prepare('UPDATE entity_User SET data = ? WHERE id = ?').run(JSON.stringify(user), row.id);
    db.close();

    const reset = await requestJson(server, `/api/apps/${server.appId}/auth/reset-password`, {
      method: 'POST',
      body: {
        reset_token: user.reset_token,
        new_password: 'Synthetic-Malformed-Expiry-Password-2!',
      },
    });
    assert.equal(reset.status, 400);

    const me = await requestJson(server, `/api/apps/${server.appId}/entities/User/me`, {
      token: registered.token,
    });
    assert.equal(me.status, 200);
  } finally {
    await server.stop();
  }
});

test('password reset rolls back password and token consumption if session revocation fails', async () => {
  const server = await startTestServer({ ALLOW_OPEN_REGISTRATION: '1' });
  let faultDb;
  try {
    const email = 'session-reset-atomicity-user@example.invalid';
    const password = 'Synthetic-Assurance-Password-1!';
    const newPassword = 'Synthetic-Assurance-Password-2!';
    const registered = await registerUser(server, email);

    await requestJson(server, `/api/apps/${server.appId}/auth/reset-password-request`, {
      method: 'POST',
      body: { email },
    });

    faultDb = new DatabaseSync(server.dbPath);
    const userBefore = faultDb
      .prepare('SELECT data FROM entity_User')
      .all()
      .map((row) => JSON.parse(row.data))
      .find((user) => user.email === email);
    assert.match(userBefore.reset_token, /^[0-9a-f-]{36}$/i);
    faultDb.exec(`
      CREATE TRIGGER fail_session_revocation
      BEFORE DELETE ON session_records
      BEGIN
        SELECT RAISE(ABORT, 'synthetic session revocation failure');
      END;
    `);

    const reset = await requestJson(server, `/api/apps/${server.appId}/auth/reset-password`, {
      method: 'POST',
      body: { reset_token: userBefore.reset_token, new_password: newPassword },
    });
    assert.equal(reset.status, 500);

    faultDb.exec('DROP TRIGGER fail_session_revocation;');
    const userAfter = faultDb
      .prepare('SELECT data FROM entity_User')
      .all()
      .map((row) => JSON.parse(row.data))
      .find((user) => user.email === email);
    assert.equal(userAfter.reset_token, userBefore.reset_token);
    assert.equal(userAfter.password_hash, userBefore.password_hash);
    faultDb.close();
    faultDb = null;

    const me = await requestJson(server, `/api/apps/${server.appId}/entities/User/me`, {
      token: registered.token,
    });
    assert.equal(me.status, 200);

    const oldLogin = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(oldLogin.status, 200);

    const newLogin = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
      method: 'POST',
      body: { email, password: newPassword },
    });
    assert.equal(newLogin.status, 401);
  } finally {
    faultDb?.close();
    await server.stop();
  }
});
