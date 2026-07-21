import assert from 'node:assert/strict';
import test from 'node:test';

import { loginAdmin, requestJson, startTestServer } from './support/server-harness.mjs';

for (const terminalStatus of ['rejected', 'deactivated']) {
  test(`same-password re-registration cannot reset an unverified ${terminalStatus} account`, async () => {
    const server = await startTestServer({ ALLOW_OPEN_REGISTRATION: '1', OUTBOUND_EMAIL_ENABLED: '0' });
    try {
      const route = `/api/apps/${server.appId}/auth/register`;
      const email = `synthetic-terminal-${terminalStatus}@example.test`;
      const password = 'Synthetic-terminal-password-123!';
      const registration = await requestJson(server, route, {
        method: 'POST',
        body: { email, password, full_name: 'Original Synthetic Name' },
      });
      assert.equal(registration.status, 200, registration.text);

      const adminToken = await loginAdmin(server);
      const terminalUpdate = await requestJson(
        server,
        `/api/apps/${server.appId}/entities/User/${registration.body.user_id}`,
        { method: 'PUT', token: adminToken, body: { account_status: terminalStatus } },
      );
      assert.equal(terminalUpdate.status, 200, terminalUpdate.text);
      assert.equal(terminalUpdate.body.account_status, terminalStatus);
      assert.equal(terminalUpdate.body.email_verified, false);

      const retry = await requestJson(server, route, {
        method: 'POST',
        body: { email, password, full_name: 'Attacker Replacement Name' },
      });
      assert.equal(retry.status, 409, retry.text);
      assert.match(retry.text, /cannot be re-registered/i);

      const stored = await requestJson(
        server,
        `/api/apps/${server.appId}/entities/User/${registration.body.user_id}`,
        { token: adminToken },
      );
      assert.equal(stored.status, 200, stored.text);
      assert.equal(stored.body.account_status, terminalStatus);
      assert.equal(stored.body.email_verified, false);
      assert.equal(stored.body.full_name, 'Original Synthetic Name');
    } finally {
      await server.stop();
    }
  });
}

test('production registration limits repeated work for one email before password hashing', async () => {
  const server = await startTestServer(
    { ALLOW_OPEN_REGISTRATION: '1', OUTBOUND_EMAIL_ENABLED: '0' },
    { selftest: false },
  );
  try {
    const route = `/api/apps/${server.appId}/auth/register`;
    const body = { email: 'synthetic-rate-limit@example.test', password: 'synthetic-password-123' };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const accepted = await requestJson(server, route, { method: 'POST', body });
      assert.equal(accepted.status, 200, accepted.text);
    }
    const refused = await requestJson(server, route, { method: 'POST', body });
    assert.equal(refused.status, 429, refused.text);
    assert.match(refused.text, /too many registration attempts/i);
  } finally {
    await server.stop();
  }
});

test('registration rejects oversized bodies before JSON parsing or password hashing', async () => {
  const server = await startTestServer(
    { ALLOW_OPEN_REGISTRATION: '1', OUTBOUND_EMAIL_ENABLED: '0' },
    { selftest: false },
  );
  try {
    const response = await fetch(`${server.baseUrl}/api/apps/${server.appId}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'synthetic-large@example.test',
        password: 'synthetic-x'.repeat(2_500),
      }),
    });
    assert.equal(response.status, 413, await response.text());
  } finally {
    await server.stop();
  }
});
