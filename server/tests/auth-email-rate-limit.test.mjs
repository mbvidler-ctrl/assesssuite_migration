import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { requestJson, startTestServer } from './support/server-harness.mjs';

function outboxCount(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return Number(db.prepare('SELECT COUNT(*) AS count FROM outbox_email').get().count);
  } finally {
    db.close();
  }
}

async function authRequest(server, action, email, headers = {}) {
  return requestJson(server, `/api/apps/${server.appId}/auth/${action}`, {
    method: 'POST',
    headers,
    body: { email },
  });
}

function assertAccepted(result) {
  assert.equal(result.status, 200, result.text);
  assert.deepEqual(result.body, { status: 'accepted' });
}

test('auth-email per-address limit counts unknown addresses without blocking registration', async () => {
  const server = await startTestServer(
    { ALLOW_OPEN_REGISTRATION: '1', OUTBOUND_EMAIL_ENABLED: '0' },
    { selftest: false },
  );
  try {
    const email = 'synthetic-address-limit@example.test';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assertAccepted(await authRequest(server, 'reset-password-request', email));
    }

    const registration = await requestJson(server, `/api/apps/${server.appId}/auth/register`, {
      method: 'POST',
      body: { email, password: 'Synthetic-address-limit-password-1!' },
    });
    assert.equal(registration.status, 200, registration.text);
    const afterRegistration = outboxCount(server.dbPath);

    // The sixth auth-email request is still indistinguishable from an
    // accepted request, but must not enqueue a password-reset message.
    assertAccepted(await authRequest(server, 'reset-password-request', email));
    assert.equal(outboxCount(server.dbPath), afterRegistration);
  } finally {
    await server.stop();
  }
});

test('auth-email per-IP limit suppresses a known-user send with a generic response', async () => {
  const server = await startTestServer(
    { ALLOW_OPEN_REGISTRATION: '1', OUTBOUND_EMAIL_ENABLED: '0' },
    { selftest: false },
  );
  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      assertAccepted(await authRequest(
        server,
        attempt % 2 === 0 ? 'resend-otp' : 'reset-password-request',
        `synthetic-ip-spray-${attempt}@example.test`,
      ));
    }
    const baseline = outboxCount(server.dbPath);
    assertAccepted(await authRequest(server, 'resend-otp', 'admin@local.test'));
    assert.equal(outboxCount(server.dbPath), baseline);
  } finally {
    await server.stop();
  }
});

test('auth-email global limit applies across resend and reset requests from varied IPs', async () => {
  const server = await startTestServer(
    { ALLOW_OPEN_REGISTRATION: '1', OUTBOUND_EMAIL_ENABLED: '0' },
    { selftest: false },
  );
  try {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const octet3 = Math.floor(attempt / 250);
      const octet4 = (attempt % 250) + 1;
      assertAccepted(await authRequest(
        server,
        attempt % 2 === 0 ? 'resend-otp' : 'reset-password-request',
        `synthetic-global-spray-${attempt}@example.test`,
        { 'Fly-Client-IP': `198.51.${octet3}.${octet4}` },
      ));
    }
    const baseline = outboxCount(server.dbPath);
    assertAccepted(await authRequest(
      server,
      'reset-password-request',
      'admin@local.test',
      { 'Fly-Client-IP': '203.0.113.200' },
    ));
    assert.equal(outboxCount(server.dbPath), baseline);
  } finally {
    await server.stop();
  }
});
