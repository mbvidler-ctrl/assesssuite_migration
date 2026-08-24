import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

function storedUser(databasePath, email) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return db.prepare('SELECT data FROM entity_User').all()
      .map(({ data }) => JSON.parse(data))
      .find((candidate) => candidate.email === email);
  } finally {
    db.close();
  }
}

test('invalid reset origin is enumeration-neutral and persists no known-account token or throttle', async () => {
  const server = await startTestServer({ ALLOW_OPEN_REGISTRATION: '1' });
  try {
    const knownEmail = 'reset-origin-known@example.invalid';
    const unknownEmail = 'reset-origin-unknown@example.invalid';
    await registerUser(server, knownEmail);
    const splitHeaders = {
      host: new URL(server.baseUrl).host,
      'x-forwarded-host': 'attacker.invalid',
      'x-forwarded-proto': 'https',
      origin: 'https://attacker.invalid',
    };

    const responses = [];
    for (const email of [knownEmail, unknownEmail]) {
      responses.push(await requestJson(
        server,
        `/api/apps/${server.appId}/auth/reset-password-request`,
        { method: 'POST', headers: splitHeaders, body: { email } },
      ));
    }
    assert.deepEqual(responses.map(({ status }) => status), [400, 400]);
    assert.deepEqual(responses[0].body, responses[1].body);
    assert.deepEqual(responses[0].body, {
      message: 'password reset request origin is not permitted',
    });

    const known = storedUser(server.dbPath, knownEmail);
    assert.equal(known.reset_token ?? null, null);
    assert.equal(known.reset_token_expires ?? null, null);
    assert.equal(known.reset_last_request_at ?? null, null);
  } finally {
    await server.stop();
  }
});
