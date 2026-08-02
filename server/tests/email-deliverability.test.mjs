import assert from 'node:assert/strict';
import test from 'node:test';

import { initEmail, otpEmail, resetEmail, sendEmail } from '../email.mjs';

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

async function withEmailFetch(fetchImplementation, operation) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImplementation;
  try {
    return await withEnvironment({
      SELFTEST: undefined,
      PARITY_ASSURANCE_MODE: undefined,
      OUTBOUND_EMAIL_ENABLED: '1',
      RESEND_API_KEY: 'synthetic-resend-secret',
      EMAIL_FROM: undefined,
      EMAIL_REPLY_TO: undefined,
    }, operation);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('default sender is replyable and Resend message id is retained', { concurrency: false }, async () => {
  initEmail({ record() {} });
  let requestBody;
  const result = await withEmailFetch(async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794' }),
    };
  }, () => sendEmail({
    to: 'synthetic-recipient@example.invalid',
    subject: 'Synthetic message',
    text: 'Synthetic only',
    html: '<p>Synthetic only</p>',
  }));

  assert.equal(requestBody.from, 'AssessSuite Clinical <verification@assesssuite.com>');
  assert.equal(requestBody.reply_to, 'admin@assesssuite.com');
  assert.equal(requestBody.text, 'Synthetic only');
  assert.equal(requestBody.html, '<p>Synthetic only</p>');
  assert.deepEqual(result, {
    recorded: true,
    sent: true,
    providerId: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794',
  });
});

test('successful HTTP response without a valid provider id is not treated as sent', { concurrency: false }, async () => {
  const result = await withEmailFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: ' ' }),
  }), () => sendEmail({
    to: 'synthetic-recipient@example.invalid',
    subject: 'Synthetic message',
    text: 'Synthetic only',
  }));

  assert.deepEqual(result, {
    recorded: true,
    sent: false,
    failure: { stage: 'provider', code: 'invalid_provider_response', status: 200 },
  });
});

test('provider rejection returns safe structured failure information', { concurrency: false }, async () => {
  const secretEcho = 'synthetic-resend-secret';
  const result = await withEmailFetch(async () => ({
    ok: false,
    status: 422,
    json: async () => ({
      name: 'validation_error',
      message: `credential ${secretEcho} rejected for recipient`,
    }),
  }), () => sendEmail({
    to: 'synthetic-recipient@example.invalid',
    subject: 'Synthetic message',
    text: 'Synthetic only',
  }));

  assert.deepEqual(result, {
    recorded: true,
    sent: false,
    failure: {
      stage: 'provider',
      code: 'provider_rejected',
      status: 422,
      providerCode: 'validation_error',
    },
  });
  assert.equal(JSON.stringify(result).includes(secretEcho), false);
  assert.equal(JSON.stringify(result).includes('recipient'), false);
});

test('templates include email-client metadata, preheader and multipart content', () => {
  const template = resetEmail('https://assesssuite.com/reset-password?token=synthetic');
  assert.match(template.text, /password reset was requested/i);
  assert.match(template.html, /<!doctype html><html lang="en"><head>/);
  assert.match(template.html, /<meta charset="utf-8">/);
  assert.match(template.html, /<meta name="viewport"/);
  assert.match(template.html, /<title>Reset your password<\/title>/);
  assert.match(template.html, /display:none;max-height:0;overflow:hidden/);
  assert.match(template.html, /Reset your password/);
});

test('OTP template identifies its origin and warns against code sharing', () => {
  const template = otpEmail('123456');
  for (const content of [template.text, template.html]) {
    assert.match(content, /assesssuite\.com/i);
    assert.match(content, /Do not share this code with anyone/i);
    assert.match(content, /including AssessSuite support/i);
    assert.match(content, /admin@assesssuite\.com/i);
  }
  assert.match(template.text, /expires in 10 minutes/i);
  assert.match(template.html, /expires in 10 minutes/i);
});
