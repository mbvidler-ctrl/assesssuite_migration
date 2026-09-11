import assert from 'node:assert/strict';
import { test } from 'node:test';

import { requestJson, startTestServer } from './support/server-harness.mjs';

function publicSettingsRoute(server) {
  return '/api/apps/public/prod/public-settings/by-id/' + server.appId;
}

function registrationRoute(server, suffix) {
  return '/api/apps/' + server.appId + '/auth/' + suffix;
}

async function assertClosedRegistration(server, email) {
  const settings = await requestJson(server, publicSettingsRoute(server));
  assert.equal(settings.status, 200, settings.text);
  assert.deepEqual(settings.body.public_settings.registration, {
    mode: 'invitation_only',
    open: false,
  });

  const registration = await requestJson(server, registrationRoute(server, 'register'), {
    method: 'POST',
    body: {
      email,
      password: 'Synthetic-Registration-Password-1!',
      full_name: 'Synthetic Registration User',
    },
  });
  assert.equal(registration.status, 403, registration.text);
  assert.match(registration.body?.message || '', /self-registration is disabled/i);
}

test('EP public registration posture is the same predicate used by register and OTP verification', async () => {
  const server = await startTestServer(
    { ALLOW_OPEN_REGISTRATION: '1', OUTBOUND_EMAIL_ENABLED: '0' },
    { selftest: true },
  );
  try {
    const settings = await requestJson(server, publicSettingsRoute(server));
    assert.equal(settings.status, 200, settings.text);
    assert.deepEqual(settings.body.public_settings.registration, {
      mode: 'open',
      open: true,
    });

    const email = 'synthetic-open-registration@example.test';
    const registration = await requestJson(server, registrationRoute(server, 'register'), {
      method: 'POST',
      body: {
        email,
        password: 'Synthetic-Registration-Password-1!',
        full_name: 'Synthetic Registration User',
      },
    });
    assert.equal(registration.status, 200, registration.text);
    assert.equal(registration.body?.otp_required, true);

    const verification = await requestJson(server, registrationRoute(server, 'verify-otp'), {
      method: 'POST',
      body: { email, otp_code: '000000' },
    });
    assert.equal(verification.status, 200, verification.text);
    assert.equal(typeof verification.body?.access_token, 'string');
  } finally {
    await server.stop();
  }
});

test('a disabled EP server and Physio SELFTEST default both publish closed registration', async () => {
  const epServer = await startTestServer(
    { ALLOW_OPEN_REGISTRATION: '0', OUTBOUND_EMAIL_ENABLED: '0' },
    { selftest: false },
  );
  try {
    await assertClosedRegistration(epServer, 'synthetic-closed-ep@example.test');
  } finally {
    await epServer.stop();
  }

  // ALLOW_OPEN_REGISTRATION must be truly absent: capabilityConfigured() is
  // the Physio carve-out that keeps the product closed even under SELFTEST.
  const physioServer = await startTestServer(
    {
      PROFESSION: 'physio',
      DEFAULT_APP_ID: 'local-assesssuite-physio',
      APP_URL: 'https://physio.app.assesssuite.com',
      ALLOW_OPEN_REGISTRATION: undefined,
      OUTBOUND_EMAIL_ENABLED: '0',
    },
    { selftest: true },
  );
  try {
    await assertClosedRegistration(physioServer, 'synthetic-closed-physio@example.test');
  } finally {
    await physioServer.stop();
  }
});
