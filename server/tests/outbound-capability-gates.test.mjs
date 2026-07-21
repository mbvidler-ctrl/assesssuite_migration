import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  emailEnabled,
  initEmail,
  sendEmail,
  smsEnabled,
} from '../email.mjs';
import createCheckoutSessionFunction from '../functions/createCheckoutSession.mjs';
import {
  createCheckoutSession as createRealCheckoutSession,
  stripeEnabled,
} from '../stripeGateway.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

async function withEnvironment(overrides, operation) {
  const previous = Object.fromEntries(
    Object.keys(overrides).map((name) => [name, process.env[name]]),
  );
  try {
    for (const [name, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    return await operation();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('secret presence alone never enables email or payment egress', () => {
  const inheritedSecrets = {
    RESEND_API_KEY: 'synthetic-inherited-resend-secret',
    STRIPE_SECRET_KEY: 'sk_test_synthetic_inherited_secret',
  };
  for (const disabledValue of [undefined, '', '0', 'true', 'yes']) {
    assert.equal(emailEnabled({
      ...inheritedSecrets,
      OUTBOUND_EMAIL_ENABLED: disabledValue,
    }), false, `email gate ${String(disabledValue)}`);
    assert.equal(stripeEnabled({
      ...inheritedSecrets,
      PAYMENTS_ENABLED: disabledValue,
    }), false, `payment gate ${String(disabledValue)}`);
  }
  assert.equal(emailEnabled({ ...inheritedSecrets, OUTBOUND_EMAIL_ENABLED: '1' }), true);
  assert.equal(stripeEnabled({ ...inheritedSecrets, PAYMENTS_ENABLED: '1' }), true);
});

test('self-test and parity mode override affirmative email, SMS and payment gates', () => {
  const fullyEnabled = {
    OUTBOUND_EMAIL_ENABLED: '1',
    OUTBOUND_SMS_ENABLED: '1',
    PAYMENTS_ENABLED: '1',
    RESEND_API_KEY: 'synthetic-resend-secret',
    STRIPE_SECRET_KEY: 'sk_test_synthetic_secret',
  };
  assert.equal(emailEnabled({ ...fullyEnabled, SELFTEST: '1' }), false);
  assert.equal(smsEnabled({ ...fullyEnabled, SELFTEST: '1' }), false);
  assert.equal(stripeEnabled({ ...fullyEnabled, SELFTEST: '1' }), false);
  assert.equal(emailEnabled({ ...fullyEnabled, PARITY_ASSURANCE_MODE: '1' }), false);
  assert.equal(smsEnabled({ ...fullyEnabled, PARITY_ASSURANCE_MODE: '1' }), false);
  assert.equal(stripeEnabled({ ...fullyEnabled, PARITY_ASSURANCE_MODE: '1' }), false);
});

test('email remains outbox-only with an inherited secret and gate off', { concurrency: false }, async () => {
  const records = [];
  initEmail({ record: (payload) => records.push(payload) });
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('network path must be unreachable');
  };
  try {
    const result = await withEnvironment({
      SELFTEST: undefined,
      PARITY_ASSURANCE_MODE: '1',
      OUTBOUND_EMAIL_ENABLED: '1',
      RESEND_API_KEY: 'synthetic-inherited-resend-secret',
    }, () => sendEmail({
      to: 'synthetic-recipient@example.invalid',
      subject: 'Synthetic parity proof',
      text: 'Synthetic only',
    }));
    assert.deepEqual(result, { recorded: true, sent: false });
    assert.equal(records.length, 1);
    assert.equal(records[0].body, null);
    assert.equal(JSON.stringify(records[0]).includes('Synthetic only'), false);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('affirmative email gate plus secret preserves the real adapter path', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async (url, options) => {
    fetchCalls += 1;
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.method, 'POST');
    return { ok: true };
  };
  try {
    const result = await withEnvironment({
      SELFTEST: undefined,
      PARITY_ASSURANCE_MODE: undefined,
      OUTBOUND_EMAIL_ENABLED: '1',
      RESEND_API_KEY: 'synthetic-resend-secret',
    }, () => sendEmail({
      to: 'synthetic-recipient@example.invalid',
      subject: 'Synthetic positive control',
      text: 'Synthetic only',
    }));
    assert.deepEqual(result, { recorded: true, sent: true });
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('payment gate is enforced at both the caller branch and direct network sink', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('network path must be unreachable');
  };
  try {
    await withEnvironment({
      SELFTEST: undefined,
      PARITY_ASSURANCE_MODE: '1',
      PAYMENTS_ENABLED: '1',
      STRIPE_SECRET_KEY: 'sk_test_synthetic_inherited_secret',
    }, async () => {
      const response = await createCheckoutSessionFunction({
        user: { id: 'synthetic-user', email: 'synthetic-user@example.invalid' },
        body: {
          plan: 'monthly',
          userId: 'synthetic-user',
          userEmail: 'synthetic-user@example.invalid',
        },
        respond: (status, body) => ({ status, body }),
      });
      assert.equal(response.status, 200);
      assert.match(response.body.url, /mock-stripe\/checkout/);

      await assert.rejects(
        createRealCheckoutSession({
          priceId: 'price_synthetic',
          userId: 'synthetic-user',
          userEmail: 'synthetic-user@example.invalid',
          successUrl: 'https://example.invalid/success',
          cancelUrl: 'https://example.invalid/cancel',
        }),
        (error) => error?.code === 'payments_disabled',
      );
    });
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('affirmative payment gate plus secret preserves the real adapter path', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async (url, options) => {
    fetchCalls += 1;
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(options.method, 'POST');
    return {
      ok: true,
      json: async () => ({ id: 'cs_test_synthetic', url: 'https://checkout.stripe.test/synthetic' }),
      headers: { get: () => null },
    };
  };
  try {
    const session = await withEnvironment({
      SELFTEST: undefined,
      PARITY_ASSURANCE_MODE: undefined,
      PAYMENTS_ENABLED: '1',
      STRIPE_SECRET_KEY: 'sk_test_synthetic_secret',
    }, () => createRealCheckoutSession({
      priceId: 'price_synthetic',
      userId: 'synthetic-user',
      userEmail: 'synthetic-user@example.invalid',
      successUrl: 'https://example.invalid/success',
      cancelUrl: 'https://example.invalid/cancel',
    }));
    assert.equal(session.id, 'cs_test_synthetic');
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('production configs pin explicit email, SMS and payment postures', () => {
  for (const fileName of ['fly.production.toml', 'fly.rollback.production.toml']) {
    const source = fs.readFileSync(path.join(repoRoot, fileName), 'utf8');
    assert.equal((source.match(/^\s*OUTBOUND_EMAIL_ENABLED\s*=\s*"1"\s*$/gm) || []).length, 1, fileName);
    assert.equal((source.match(/^\s*OUTBOUND_SMS_ENABLED\s*=\s*"0"\s*$/gm) || []).length, 1, fileName);
    assert.equal((source.match(/^\s*PAYMENTS_ENABLED\s*=\s*"1"\s*$/gm) || []).length, 1, fileName);
  }

  const integrations = fs.readFileSync(path.join(repoRoot, 'server', 'integrations.mjs'), 'utf8')
    .replaceAll('\r\n', '\n');
  const smsHandler = /function handleSendSMS[\s\S]*?\n}\n/.exec(integrations)?.[0] || '';
  assert.match(smsHandler, /outboxSms\.record/);
  assert.doesNotMatch(smsHandler, /\bfetch\b|https?:\/\/|twilio/i);
});

test('transactional auth callers consume delivery outcomes and revoke undelivered capabilities', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'server', 'index.mjs'), 'utf8').replaceAll('\r\n', '\n');
  assert.match(source, /transactionalEmailDeliveryRequired\(\)[\s\S]*?delivery\.sent/);
  assert.match(source, /verification email delivery could not be confirmed; please retry/);
  assert.match(source, /otp_code:\s*null,[\s\S]*?otp_last_sent_at:\s*null/);
  assert.match(source, /reset_token:\s*null,[\s\S]*?reset_last_request_at:\s*null/);
  const forgotPassword = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'ForgotPassword.jsx'), 'utf8');
  assert.match(forgotPassword, /If an account exists with that email, you'll receive a password reset link shortly\./);
});
