import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adminNotifyEmail,
  inviteEmail,
  otpEmail,
  resetEmail,
  sendEmail,
  welcomeEmail,
} from '../email.mjs';

async function withPhysioEnvironment(operation) {
  const overrides = {
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    SELFTEST: undefined,
    PARITY_ASSURANCE_MODE: undefined,
    OUTBOUND_EMAIL_ENABLED: '1',
    RESEND_API_KEY: 'synthetic_physio_email_key',
    EMAIL_FROM: undefined,
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

test('Physio verification, recovery, welcome and invite templates use the active product', { concurrency: false }, async () => {
  await withPhysioEnvironment(async () => {
    const otp = otpEmail('123456');
    assert.equal(otp.subject, 'Your AssessSuite Physio verification code');
    assert.match(otp.text, /physio\.app\.assesssuite\.com/);
    assert.match(otp.html, /AssessSuite Physiotherapy/);

    assert.equal(
      resetEmail('https://physio.app.assesssuite.com/reset-password?token=synthetic').subject,
      'Reset your AssessSuite Physio password',
    );
    assert.equal(welcomeEmail('Synthetic Physio').subject, 'Your AssessSuite Physio account is active');
    assert.equal(inviteEmail('Physiotherapist').subject, 'You have been invited to AssessSuite Physio');
    assert.equal(adminNotifyEmail('physio@example.test').subject, 'AssessSuite Physio: new registration');
  });
});

test('Physio provider send uses the vertical sender identity by default', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let providerBody;
  globalThis.fetch = async (_url, options) => {
    providerBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'resend_physio_receipt_1' }),
    };
  };
  try {
    await withPhysioEnvironment(async () => {
      const result = await sendEmail({
        to: 'synthetic-recipient@example.test',
        ...otpEmail('654321'),
      });
      assert.equal(result.sent, true);
      assert.equal(result.providerId, 'resend_physio_receipt_1');
      assert.equal(
        providerBody.from,
        'AssessSuite Physiotherapy <verification@assesssuite.com>',
      );
      assert.equal(providerBody.subject, 'Your AssessSuite Physio verification code');
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
