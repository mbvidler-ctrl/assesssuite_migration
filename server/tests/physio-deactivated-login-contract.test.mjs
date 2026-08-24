import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

test('persisted deactivated account cannot mint a fresh login session', async () => {
  const server = await startTestServer({ ALLOW_OPEN_REGISTRATION: '1' });
  let database;
  try {
    const email = 'deactivated-login@example.invalid';
    const registered = await registerUser(server, email);
    const adminToken = await loginAdmin(server);
    const deactivated = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/User/${registered.id}`,
      {
        method: 'PUT',
        token: adminToken,
        body: { account_status: 'deactivated' },
      },
    );
    assert.equal(deactivated.status, 200, deactivated.text);
    assert.equal(deactivated.body?.account_status, 'deactivated');

    database = new DatabaseSync(server.dbPath);
    const countSessions = () => database
      .prepare('SELECT COUNT(*) AS count FROM session_records')
      .get().count;
    const sessionsBefore = countSessions();

    const login = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
      method: 'POST',
      body: { email, password: 'Synthetic-Assurance-Password-1!' },
    });
    assert.equal(login.status, 403, login.text);
    assert.deepEqual(login.body, {
      error: 'account_deactivated',
      account_status: 'deactivated',
    });
    assert.equal(Object.hasOwn(login.body, 'access_token'), false);
    assert.equal(countSessions(), sessionsBefore);

    const row = database
      .prepare('SELECT data FROM entity_User WHERE id = ?')
      .get(registered.id);
    assert.equal(JSON.parse(row.data).account_status, 'deactivated');
  } finally {
    database?.close();
    await server.stop();
  }
});
