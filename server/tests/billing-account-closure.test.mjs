import assert from 'node:assert/strict';
import test from 'node:test';

import cancelSubscriptionAndDeactivate from '../functions/cancelSubscriptionAndDeactivate.mjs';

function responder() {
  return (status, body) => ({ status, body });
}

async function withRealPaymentGate(fetchImplementation, operation) {
  const originalFetch = globalThis.fetch;
  const originalEnvironment = {
    PAYMENTS_ENABLED: process.env.PAYMENTS_ENABLED,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    SELFTEST: process.env.SELFTEST,
    PARITY_ASSURANCE_MODE: process.env.PARITY_ASSURANCE_MODE,
  };
  process.env.PAYMENTS_ENABLED = '1';
  process.env.STRIPE_SECRET_KEY = 'synthetic_test_key';
  delete process.env.SELFTEST;
  delete process.env.PARITY_ASSURANCE_MODE;
  globalThis.fetch = fetchImplementation;
  try {
    return await operation();
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('account remains open when linked-subscription cancellation is not confirmed', async () => {
  const updates = [];
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await withRealPaymentGate(
      async () => ({
        ok: false,
        status: 503,
        headers: { get: () => 'synthetic-request' },
        json: async () => ({ error: { message: 'synthetic upstream failure' } }),
      }),
      () => cancelSubscriptionAndDeactivate({
        user: { id: 'user-a', role: 'user', stripe_subscription_id: 'sub_owned' },
        entities: { User: { update: async (...args) => updates.push(args) } },
        respond: responder(),
      }),
    );
    assert.equal(response.status, 502);
    assert.equal(updates.length, 0);
    assert.match(response.body.error, /account remains open/i);
  } finally {
    console.error = originalConsoleError;
  }
});

test('account remains open when a live entitlement has no provider subscription identifier', async () => {
  const updates = [];
  let fetched = false;
  const response = await withRealPaymentGate(
    async () => {
      fetched = true;
      throw new Error('provider must not be contacted without an identifier');
    },
    () => cancelSubscriptionAndDeactivate({
      user: {
        id: 'user-missing-link',
        role: 'user',
        subscription_status: 'active',
        stripe_subscription_id: null,
      },
      entities: { User: { update: async (...args) => updates.push(args) } },
      respond: responder(),
    }),
  );
  assert.equal(response.status, 409);
  assert.match(response.body.error, /billing link is incomplete/i);
  assert.equal(updates.length, 0);
  assert.equal(fetched, false);
});

test('account deactivates only after linked-subscription cancellation succeeds', async () => {
  const updates = [];
  const response = await withRealPaymentGate(
    async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ id: 'sub_owned', status: 'canceled' }),
    }),
    () => cancelSubscriptionAndDeactivate({
      user: { id: 'user-a', role: 'user', stripe_subscription_id: 'sub_owned' },
      entities: { User: { update: async (...args) => updates.push(args) } },
      respond: responder(),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.subscription, 'cancelled');
  assert.equal(updates.length, 1);
  assert.equal(updates[0][0], 'user-a');
  assert.equal(updates[0][1].account_status, 'deactivated');
  assert.equal(updates[0][1].subscription_status, 'cancelled');
});
