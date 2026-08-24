import assert from 'node:assert/strict';
import test from 'node:test';

import managePromotions from '../functions/managePromotions.mjs';
import { _mockStripeStore } from '../mocks/stripe.mjs';
import { testStripeProvider } from './support/provider-services.mjs';

function responder() {
  return (status, body) => ({ status, body });
}

function resetMockStore() {
  _mockStripeStore.couponsById.clear();
  _mockStripeStore.promotionCodesById.clear();
}

function withTestProvider(context) {
  return { ...context, stripeProvider: testStripeProvider };
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

test('promotion management requires an administrator session', async () => {
  assert.equal((await managePromotions({ body: { action: 'list' }, respond: responder() })).status, 401);
  assert.equal((await managePromotions({
    user: { id: 'ordinary', role: 'user' },
    body: { action: 'list' },
    respond: responder(),
  })).status, 403);
});

test('administrator can create, list, and deactivate a bounded mock promotion', { concurrency: false }, async () => {
  resetMockStore();
  const user = { id: 'admin-a', email: 'admin@example.invalid', role: 'admin' };
  const create = await withEnvironment({
    PAYMENTS_ENABLED: undefined,
    STRIPE_SECRET_KEY: undefined,
    NODE_ENV: 'test',
    SELFTEST: '1',
  }, () => managePromotions(withTestProvider({
    user,
    body: {
      action: 'create',
      code: 'welcome-20',
      name: 'Welcome offer',
      discount_type: 'percent',
      discount_value: 20,
      duration: 'once',
      max_redemptions: 25,
      first_time_only: true,
      minimum_amount: 50,
      internal_note: 'Approved synthetic campaign',
    },
    respond: responder(),
  })));
  assert.equal(create.status, 201);
  assert.equal(create.body.promotion.code, 'WELCOME-20');
  assert.equal(create.body.promotion.coupon.percent_off, 20);
  assert.equal(create.body.promotion.max_redemptions, 25);
  assert.equal(create.body.promotion.restrictions.minimum_amount, 5000);
  assert.equal(create.body.promotion.metadata.assesssuite_created_by_user_id, 'admin-a');

  const list = await withEnvironment({ NODE_ENV: 'test', SELFTEST: '1' }, () => (
    managePromotions(withTestProvider({ user, body: { action: 'list' }, respond: responder() }))
  ));
  assert.equal(list.status, 200);
  assert.equal(list.body.promotions.length, 1);
  assert.equal(list.body.mode, 'test');

  const deactivate = await withEnvironment({ NODE_ENV: 'test', SELFTEST: '1' }, () => (
    managePromotions(withTestProvider({
      user,
      body: { action: 'deactivate', promotion_id: create.body.promotion.id },
      respond: responder(),
    }))
  ));
  assert.equal(deactivate.status, 200);
  assert.equal(deactivate.body.promotion.active, false);
});

test('invalid or duplicate codes fail without leaving an extra coupon', { concurrency: false }, async () => {
  resetMockStore();
  const user = { id: 'admin-a', email: 'admin@example.invalid', role: 'admin' };
  const invoke = (body) => withEnvironment({ NODE_ENV: 'test', SELFTEST: '1' }, () => (
    managePromotions(withTestProvider({ user, body, respond: responder() }))
  ));
  const invalid = await invoke({
    action: 'create', code: 'no spaces', name: 'Invalid', discount_type: 'percent',
    discount_value: 10, duration: 'once',
  });
  assert.equal(invalid.status, 400);

  const validBody = {
    action: 'create', code: 'LIMITED10', name: 'Limited', discount_type: 'percent',
    discount_value: 10, duration: 'once',
  };
  assert.equal((await invoke(validBody)).status, 201);
  assert.equal((await invoke(validBody)).status, 400);
  assert.equal(_mockStripeStore.couponsById.size, 1);
});

test('real Stripe requests use server-owned promotion fields and current coupon reference shape', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/v1/coupons')) {
      return {
        ok: true, status: 200, headers: { get: () => null },
        json: async () => ({ id: 'coupon_owned', name: 'Partner offer', duration: 'forever', percent_off: 15, valid: true }),
      };
    }
    return {
      ok: true, status: 200, headers: { get: () => null },
      json: async () => ({
        id: 'promo_owned', code: 'PARTNER15', active: true, created: 1,
        promotion: { type: 'coupon', coupon: 'coupon_owned' },
        restrictions: { first_time_transaction: false }, metadata: {},
      }),
    };
  };
  try {
    const result = await withEnvironment({
      PAYMENTS_ENABLED: '1', STRIPE_SECRET_KEY: 'synthetic_test_key',
      SELFTEST: undefined, PARITY_ASSURANCE_MODE: undefined, NODE_ENV: 'test',
    }, () => managePromotions({
      user: { id: 'admin-a', email: 'admin@example.invalid', role: 'admin' },
      body: {
        action: 'create', code: 'partner15', name: 'Partner offer',
        discount_type: 'percent', discount_value: 15, duration: 'forever',
      },
      respond: responder(),
    }));
    assert.equal(result.status, 201);
    assert.equal(requests.length, 2);
    const promotionForm = new URLSearchParams(requests[1].options.body);
    assert.equal(promotionForm.get('promotion[type]'), 'coupon');
    assert.equal(promotionForm.get('promotion[coupon]'), 'coupon_owned');
    assert.equal(promotionForm.get('code'), 'PARTNER15');
    assert.equal(promotionForm.get('metadata[assesssuite_created_by_user_id]'), 'admin-a');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
