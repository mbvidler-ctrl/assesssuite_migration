import assert from 'node:assert/strict';
import test from 'node:test';

import createCheckoutSession from '../functions/createCheckoutSession.mjs';
import {
  boundCheckoutSession,
  createCheckoutIntentTestStore,
} from './support/stripe-checkout-test-helpers.mjs';

function responder() {
  return (status, body) => ({ status, body });
}

async function withEnvironment(values, operation) {
  const previous = new Map();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await operation();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('checkout rejects missing sessions and non-allowlisted plans', async () => {
  assert.equal((await createCheckoutSession({ body: { plan: 'monthly' }, respond: responder() })).status, 401);
  assert.equal((await createCheckoutSession({ user: { id: 'u', email: 'u@example.invalid' }, body: { plan: 'free' }, respond: responder() })).status, 400);
});

test('checkout refuses a second subscription for a linked or live account', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('Stripe must not be contacted');
  };
  try {
    const linked = await createCheckoutSession({
      user: {
        id: 'linked-user',
        email: 'linked@example.invalid',
        subscription_status: 'active',
        stripe_subscription_id: 'sub_existing',
      },
      body: { plan: 'monthly' },
      respond: responder(),
    });
    assert.equal(linked.status, 409);
    assert.match(linked.body.error, /billing portal/i);

    const liveWithoutId = await createCheckoutSession({
      user: {
        id: 'live-user',
        email: 'live@example.invalid',
        subscription_status: 'payment_failed',
        stripe_subscription_id: null,
      },
      body: { plan: 'annual' },
      respond: responder(),
    });
    assert.equal(liveWithoutId.status, 409);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkout uses only server-owned price, authenticated identity and application return URLs', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const store = createCheckoutIntentTestStore();
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => boundCheckoutSession(options, {
        url: 'https://checkout.example.test/session',
      }),
    };
  };

  try {
    const response = await withEnvironment({
      SELFTEST: undefined,
      PARITY_ASSURANCE_MODE: undefined,
      PAYMENTS_ENABLED: '1',
      STRIPE_SECRET_KEY: 'synthetic_test_key',
      STRIPE_PRICE_ID_MONTHLY: 'price_owned',
      APP_URL: 'https://assesssuite.example.test/',
    }, () => createCheckoutSession({
      user: { id: 'user-owned', email: 'owned@example.invalid' },
      body: {
        plan: 'monthly',
        priceId: 'price_attacker',
        userId: 'user-victim',
        userEmail: 'victim@example.invalid',
        successUrl: 'https://attacker.invalid/success',
        cancelUrl: 'https://attacker.invalid/cancel',
        qaSequence: 'assesssuite-physio-self-service-123456abcdef',
      },
      checkoutIntents: store.checkoutIntents,
      respond: responder(),
    }));

    assert.equal(response.status, 200);
    assert.equal(requests.length, 1);
    const form = new URLSearchParams(requests[0].options.body);
    assert.equal(form.get('line_items[0][price]'), 'price_owned');
    assert.equal(form.get('client_reference_id'), 'user-owned');
    assert.equal(form.get('customer_email'), 'owned@example.invalid');
    assert.equal(form.get('success_url'), 'https://assesssuite.example.test/PaymentRequired?checkout_return=1');
    assert.equal(form.get('cancel_url'), 'https://assesssuite.example.test/PaymentRequired');
    assert.equal(form.get('allow_promotion_codes'), 'true');
    assert.match(requests[0].options.headers['Idempotency-Key'], /^assesssuite_checkout_v1_[0-9a-f]{64}$/);
    assert.match(form.get('metadata[checkoutIntentId]'), /^[0-9a-f-]{36}$/);
    assert.equal(form.has('metadata[qaSequence]'), false);
    assert.equal(form.has('subscription_data[metadata][qaSequence]'), false);
    assert.equal([...form.values()].some((value) => value.includes('attacker.invalid') || value.includes('victim')), false);
  } finally {
    globalThis.fetch = originalFetch;
    store.close();
  }
});
