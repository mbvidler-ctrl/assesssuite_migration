import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import stripeWebhook from '../functions/stripeWebhook.mjs';

const APPROVED_PRICE = 'price_synthetic_approved';

async function withEnvironment(overrides, operation) {
  const previous = Object.fromEntries(Object.keys(overrides).map((name) => [name, process.env[name]]));
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

function signedContext({ event, subscriptionPriceId, updates, accountStatus = 'pending' }) {
  const rawBody = Buffer.from(JSON.stringify(event));
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', 'whsec_synthetic')
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  const user = {
    id: 'synthetic-user',
    email: 'synthetic-user@example.test',
    account_status: accountStatus,
  };
  return {
    rawBody,
    request: { headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` } },
    body: event,
    user: null,
    entities: {
      User: {
        get: async (id) => (id === user.id ? user : null),
        update: async (id, data) => { updates.push({ id, data }); },
      },
    },
    respond: (status, body) => ({ status, body }),
    subscriptionPriceId,
  };
}

function checkoutEvent() {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'subscription',
        payment_status: 'paid',
        customer: 'cus_synthetic',
        subscription: 'sub_synthetic',
        client_reference_id: 'synthetic-user',
        customer_email: 'synthetic-user@example.test',
        metadata: { userId: 'synthetic-user', priceId: APPROVED_PRICE },
      },
    },
  };
}

test('real Stripe webhook corroborates the approved recurring price before entitlement', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let actualSubscriptionPrice = 'price_unapproved';
  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://api.stripe.com/v1/subscriptions/sub_synthetic');
    return {
      ok: true,
      json: async () => ({
        id: 'sub_synthetic',
        customer: 'cus_synthetic',
        status: 'active',
        metadata: { userId: 'synthetic-user', priceId: APPROVED_PRICE },
        items: { data: [{ price: { id: actualSubscriptionPrice } }] },
      }),
      headers: { get: () => null },
    };
  };
  try {
    await withEnvironment({
      SELFTEST: undefined,
      PARITY_ASSURANCE_MODE: undefined,
      PAYMENTS_ENABLED: '1',
      STRIPE_SECRET_KEY: 'sk_test_synthetic',
      STRIPE_WEBHOOK_SECRET: 'whsec_synthetic',
      STRIPE_PRICE_ID_MONTHLY: APPROVED_PRICE,
      STRIPE_PRICE_ID_ANNUAL: 'price_synthetic_annual',
      OUTBOUND_EMAIL_ENABLED: '0',
    }, async () => {
      const rejectedUpdates = [];
      const rejected = await stripeWebhook(signedContext({
        event: checkoutEvent(),
        subscriptionPriceId: actualSubscriptionPrice,
        updates: rejectedUpdates,
      }));
      assert.equal(rejected.status, 400);
      assert.equal(rejectedUpdates.length, 0);

      actualSubscriptionPrice = APPROVED_PRICE;
      const acceptedUpdates = [];
      const accepted = await stripeWebhook(signedContext({
        event: checkoutEvent(),
        subscriptionPriceId: actualSubscriptionPrice,
        updates: acceptedUpdates,
      }));
      assert.equal(accepted.status, 200);
      assert.equal(acceptedUpdates.length, 1);
      assert.equal(acceptedUpdates[0].data.subscription_status, 'active');
      assert.equal(acceptedUpdates[0].data.stripe_subscription_id, 'sub_synthetic');
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('late paid checkout for a terminal account is cancelled and durably linked before acknowledgement', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method });
    assert.equal(url, 'https://api.stripe.com/v1/subscriptions/sub_synthetic');
    if (options.method === 'GET') {
      return {
        ok: true,
        json: async () => ({
          id: 'sub_synthetic',
          customer: 'cus_synthetic',
          status: 'active',
          metadata: { userId: 'synthetic-user', priceId: APPROVED_PRICE },
          items: { data: [{ price: { id: APPROVED_PRICE } }] },
        }),
        headers: { get: () => null },
      };
    }
    assert.equal(options.method, 'DELETE');
    return {
      ok: true,
      json: async () => ({ id: 'sub_synthetic', status: 'canceled' }),
      headers: { get: () => null },
    };
  };

  try {
    await withEnvironment({
      SELFTEST: undefined,
      PARITY_ASSURANCE_MODE: undefined,
      PAYMENTS_ENABLED: '1',
      STRIPE_SECRET_KEY: 'sk_test_synthetic',
      STRIPE_WEBHOOK_SECRET: 'whsec_synthetic',
      STRIPE_PRICE_ID_MONTHLY: APPROVED_PRICE,
      STRIPE_PRICE_ID_ANNUAL: 'price_synthetic_annual',
      OUTBOUND_EMAIL_ENABLED: '0',
    }, async () => {
      const updates = [];
      const response = await stripeWebhook(signedContext({
        event: checkoutEvent(),
        updates,
        accountStatus: 'rejected',
      }));
      assert.equal(response.status, 200);
      assert.deepEqual(requests.map((request) => request.method), ['GET', 'DELETE']);
      assert.equal(updates.length, 1);
      assert.deepEqual(updates[0], {
        id: 'synthetic-user',
        data: {
          subscription_status: 'cancelled',
          stripe_customer_id: 'cus_synthetic',
          stripe_subscription_id: 'sub_synthetic',
        },
      });
      assert.equal(Object.hasOwn(updates[0].data, 'account_status'), false);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('failed terminal-account cancellation persists linkage and returns a retryable failure', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, 'https://api.stripe.com/v1/subscriptions/sub_synthetic');
    if (options.method === 'GET') {
      return {
        ok: true,
        json: async () => ({
          id: 'sub_synthetic',
          customer: 'cus_synthetic',
          status: 'active',
          metadata: { userId: 'synthetic-user', priceId: APPROVED_PRICE },
          items: { data: [{ price: { id: APPROVED_PRICE } }] },
        }),
        headers: { get: () => null },
      };
    }
    return {
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'synthetic cancellation failure' } }),
      headers: { get: () => 'synthetic-request-id' },
    };
  };

  try {
    await withEnvironment({
      SELFTEST: undefined,
      PARITY_ASSURANCE_MODE: undefined,
      PAYMENTS_ENABLED: '1',
      STRIPE_SECRET_KEY: 'sk_test_synthetic',
      STRIPE_WEBHOOK_SECRET: 'whsec_synthetic',
      STRIPE_PRICE_ID_MONTHLY: APPROVED_PRICE,
      STRIPE_PRICE_ID_ANNUAL: 'price_synthetic_annual',
      OUTBOUND_EMAIL_ENABLED: '0',
    }, async () => {
      const updates = [];
      const response = await stripeWebhook(signedContext({
        event: checkoutEvent(),
        updates,
        accountStatus: 'deactivated',
      }));
      assert.equal(response.status, 500);
      assert.equal(response.body.message, 'Paid subscription cancellation is pending');
      assert.deepEqual(updates, [{
        id: 'synthetic-user',
        data: {
          subscription_status: 'cancellation_pending',
          stripe_customer_id: 'cus_synthetic',
          stripe_subscription_id: 'sub_synthetic',
        },
      }]);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('terminal-account webhook retry converges when Stripe already shows the subscription cancelled', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const methods = [];
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, 'https://api.stripe.com/v1/subscriptions/sub_synthetic');
    methods.push(options.method);
    return {
      ok: true,
      json: async () => ({
        id: 'sub_synthetic',
        customer: 'cus_synthetic',
        status: 'canceled',
        metadata: { userId: 'synthetic-user', priceId: APPROVED_PRICE },
        items: { data: [{ price: { id: APPROVED_PRICE } }] },
      }),
      headers: { get: () => null },
    };
  };

  try {
    await withEnvironment({
      SELFTEST: undefined,
      PARITY_ASSURANCE_MODE: undefined,
      PAYMENTS_ENABLED: '1',
      STRIPE_SECRET_KEY: 'sk_test_synthetic',
      STRIPE_WEBHOOK_SECRET: 'whsec_synthetic',
      STRIPE_PRICE_ID_MONTHLY: APPROVED_PRICE,
      STRIPE_PRICE_ID_ANNUAL: 'price_synthetic_annual',
      OUTBOUND_EMAIL_ENABLED: '0',
    }, async () => {
      const updates = [];
      const response = await stripeWebhook(signedContext({
        event: checkoutEvent(),
        updates,
        accountStatus: 'deactivated',
      }));
      assert.equal(response.status, 200);
      assert.deepEqual(methods, ['GET']);
      assert.equal(updates.length, 1);
      assert.equal(updates[0].data.subscription_status, 'cancelled');
      assert.equal(updates[0].data.stripe_subscription_id, 'sub_synthetic');
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
