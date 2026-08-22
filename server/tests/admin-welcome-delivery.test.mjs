import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

test('admin activation awaits and exposes durable welcome-delivery evidence', async () => {
  const server = await startTestServer({ ALLOW_OPEN_REGISTRATION: '1' });
  try {
    const user = await registerUser(server, 'admin-welcome@example.invalid');
    const adminToken = await loginAdmin(server);
    const activation = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/User/${user.id}`,
      {
        method: 'PUT',
        token: adminToken,
        body: {
          account_status: 'active',
          country: 'australia',
          profession: 'Exercise Physiologist',
        },
      },
    );
    assert.equal(activation.status, 200);
    assert.equal(activation.body.account_status, 'active');
    assert.equal(activation.body.welcome_delivery.event, 'admin_welcome_email_delivery');
    assert.equal(activation.body.welcome_delivery.attempted, true);
    assert.equal(activation.body.welcome_delivery.recorded, true);
    assert.equal(activation.body.welcome_delivery.sent, false);
    assert.equal(activation.body.welcome_delivery.failure.code, 'delivery_not_sent');

    const db = new DatabaseSync(server.dbPath, { readOnly: true });
    try {
      const evidence = db.prepare('SELECT payload FROM outbox_email').all()
        .map(({ payload }) => JSON.parse(payload))
        .filter(({ event }) => event === 'admin_welcome_email_delivery');
      assert.equal(evidence.length, 1);
      assert.equal(evidence[0].user_id, user.id);
      assert.equal(evidence[0].sent, false);
    } finally {
      db.close();
    }
  } finally {
    await server.stop();
  }
});
