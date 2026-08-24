import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

function users(database) {
  return database.prepare('SELECT id, data FROM entity_User').all().map((row) => ({
    id: row.id,
    ...JSON.parse(row.data),
  }));
}

test('invite fails loudly and rolls back a newly-created invite when email delivery is unconfirmed', async () => {
  const server = await startTestServer({ OUTBOUND_EMAIL_ENABLED: '0' });
  let database;
  try {
    const adminToken = await loginAdmin(server);
    const email = 'delivery-failed-new-invite@example.invalid';
    const invite = await requestJson(
      server,
      `/api/apps/${server.appId}/users/invite-user`,
      {
        method: 'POST',
        token: adminToken,
        body: { user_email: email, role: 'user' },
      },
    );
    assert.equal(invite.status, 502, invite.text);
    assert.deepEqual(invite.body, {
      status: 'delivery_failed',
      error: 'invite_delivery_failed',
    });

    database = new DatabaseSync(server.dbPath);
    assert.equal(users(database).some((user) => user.email === email), false);
  } finally {
    database?.close();
    await server.stop();
  }
});

test('invite delivery failure restores an existing user role', async () => {
  const server = await startTestServer({
    ALLOW_OPEN_REGISTRATION: '1',
    OUTBOUND_EMAIL_ENABLED: '0',
  });
  let database;
  try {
    const existing = await registerUser(server, 'delivery-failed-existing-invite@example.invalid');
    const adminToken = await loginAdmin(server);
    const invite = await requestJson(
      server,
      `/api/apps/${server.appId}/runtime/users/invite-user`,
      {
        method: 'POST',
        token: adminToken,
        body: { user_email: existing.email, role: 'admin' },
      },
    );
    assert.equal(invite.status, 502, invite.text);
    assert.equal(invite.body?.status, 'delivery_failed');

    database = new DatabaseSync(server.dbPath);
    const persisted = users(database).find((user) => user.id === existing.id);
    assert.equal(persisted?.role, 'user');
    assert.notEqual(persisted?.account_status, 'invited');
  } finally {
    database?.close();
    await server.stop();
  }
});
