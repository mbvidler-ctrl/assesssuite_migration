import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createStripeCheckoutIntentRepository,
  ensureStripeCheckoutIntentSchema,
} from '../db.mjs';
import createCheckoutSession from '../functions/createCheckoutSession.mjs';
import {
  boundCheckoutSession,
  createCheckoutIntentTestStore,
} from './support/stripe-checkout-test-helpers.mjs';

const PHYSIO_CHECKOUT_ENV = Object.freeze({
  NODE_ENV: 'production',
  SELFTEST: undefined,
  PARITY_ASSURANCE_MODE: undefined,
  PAYMENTS_ENABLED: '1',
  STRIPE_SECRET_KEY: 'sk_test_idempotency_contract',
  STRIPE_PRICE_ID_MONTHLY: 'price_physio_monthly',
  STRIPE_PRICE_ID_ANNUAL: 'price_physio_annual',
  STRIPE_TRIAL_PERIOD_DAYS: '30',
  PROFESSION: 'physio',
  DEFAULT_APP_ID: 'local-assesssuite-physio',
  APP_URL: 'https://physio.app.assesssuite.com',
});
const PHYSIO_FLY_REQUEST = Object.freeze({
  headers: Object.freeze({
    host: 'assesssuite-physio-production.fly.dev',
    'x-forwarded-host': 'assesssuite-physio-production.fly.dev',
    'x-forwarded-proto': 'https',
    'fly-forwarded-proto': 'https',
    origin: 'https://assesssuite-physio-production.fly.dev',
  }),
});

async function withEnvironment(overrides, operation) {
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

function respond(status, body) {
  return { status, body };
}

function invokeCheckout(checkoutIntents, { plan = 'monthly', user = {} } = {}) {
  return createCheckoutSession({
    user: {
      id: 'physio-idempotency-user',
      email: 'physio-idempotency@example.test',
      ...user,
    },
    request: PHYSIO_FLY_REQUEST,
    body: { plan },
    checkoutIntents,
    respond,
  });
}

function stripeSuccess(payload, requestId) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name === 'request-id' ? requestId : null) },
    json: async () => payload,
  };
}

test('response-loss retry survives database reopen with one exact Stripe key and body', { concurrency: false }, async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'assesssuite-stripe-intent-'));
  const dbPath = path.join(tempRoot, 'checkout.db');
  const originalFetch = globalThis.fetch;
  const postRequests = [];
  let responseLost = true;
  globalThis.fetch = async (_url, options) => {
    postRequests.push({
      idempotencyKey: options.headers['Idempotency-Key'],
      body: options.body,
    });
    if (responseLost) {
      responseLost = false;
      // Models Stripe having committed while the client loses the response.
      throw new Error('connection closed after request bytes were accepted');
    }
    return stripeSuccess(
      boundCheckoutSession(options, {
        id: 'cs_test_response_loss',
        url: 'https://checkout.stripe.test/response-loss',
      }),
      'req_response_loss_retry',
    );
  };

  let firstDb;
  let reopenedDb;
  try {
    await withEnvironment(PHYSIO_CHECKOUT_ENV, async () => {
      firstDb = new DatabaseSync(dbPath);
      ensureStripeCheckoutIntentSchema(firstDb);
      const firstRepository = createStripeCheckoutIntentRepository(firstDb);
      const uncertain = await invokeCheckout(firstRepository);
      assert.equal(uncertain.status, 503);
      assert.equal(uncertain.body.code, 'checkout_provider_outcome_unknown');
      assert.equal(uncertain.body.retryable, true);
      assert.equal(
        firstDb.prepare('SELECT state FROM stripe_checkout_intent').get().state,
        'response_unknown',
      );
      firstDb.close();
      firstDb = null;

      reopenedDb = new DatabaseSync(dbPath);
      ensureStripeCheckoutIntentSchema(reopenedDb);
      const reopenedRepository = createStripeCheckoutIntentRepository(reopenedDb);
      const retried = await invokeCheckout(reopenedRepository);
      assert.equal(retried.status, 200);
      assert.equal(retried.body.url, 'https://checkout.stripe.test/response-loss');

      assert.equal(postRequests.length, 2);
      assert.equal(postRequests[1].idempotencyKey, postRequests[0].idempotencyKey);
      assert.equal(postRequests[1].body, postRequests[0].body);
      assert.match(postRequests[0].idempotencyKey, /^assesssuite_checkout_v1_[0-9a-f]{64}$/);
      assert.equal(
        reopenedDb.prepare('SELECT COUNT(*) AS count FROM stripe_checkout_intent').get().count,
        1,
      );
      const stored = reopenedDb.prepare('SELECT * FROM stripe_checkout_intent').get();
      assert.equal(stored.state, 'created');
      assert.equal(stored.stripe_session_id, 'cs_test_response_loss');
      assert.equal(stored.stripe_request_id, 'req_response_loss_retry');
    });
  } finally {
    if (firstDb) firstDb.close();
    if (reopenedDb) reopenedDb.close();
    globalThis.fetch = originalFetch;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('an active monthly intent rejects an annual retry without another provider request', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const store = createCheckoutIntentTestStore();
  let fetchCalls = 0;
  globalThis.fetch = async (_url, options) => {
    fetchCalls += 1;
    return stripeSuccess(
      boundCheckoutSession(options, { id: 'cs_test_plan_binding' }),
      'req_plan_binding',
    );
  };
  try {
    await withEnvironment(PHYSIO_CHECKOUT_ENV, async () => {
      const monthly = await invokeCheckout(store.checkoutIntents, { plan: 'monthly' });
      assert.equal(monthly.status, 200);
      const annual = await invokeCheckout(store.checkoutIntents, { plan: 'annual' });
      assert.equal(annual.status, 409);
      assert.equal(annual.body.code, 'checkout_intent_binding_conflict');
      assert.equal(fetchCalls, 1);
      assert.equal(
        store.db.prepare('SELECT COUNT(*) AS count FROM stripe_checkout_intent').get().count,
        1,
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
    store.close();
  }
});

test('a corrupted repository binding fails closed before Stripe is contacted', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('wrong-bound intent must not reach Stripe');
  };
  const checkoutIntents = {
    acquire: (candidate) => ({
      created: false,
      intent: { ...candidate, userId: 'another-account' },
    }),
  };
  try {
    const result = await withEnvironment(PHYSIO_CHECKOUT_ENV, () => (
      invokeCheckout(checkoutIntents)
    ));
    assert.equal(result.status, 409);
    assert.equal(result.body.code, 'checkout_intent_binding_conflict');
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('wrong provider metadata remains uncertain and never rotates the durable key', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const store = createCheckoutIntentTestStore();
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    requests.push({ key: options.headers['Idempotency-Key'], body: options.body });
    const bound = boundCheckoutSession(options, { id: 'cs_test_wrong_binding' });
    return stripeSuccess({
      ...bound,
      metadata: { ...bound.metadata, appId: 'foreign-application' },
    }, 'req_wrong_binding');
  };
  try {
    await withEnvironment(PHYSIO_CHECKOUT_ENV, async () => {
      const first = await invokeCheckout(store.checkoutIntents);
      const second = await invokeCheckout(store.checkoutIntents);
      assert.equal(first.status, 502);
      assert.equal(second.status, 502);
      assert.equal(first.body.code, 'checkout_provider_binding_mismatch');
      assert.equal(requests.length, 2);
      assert.equal(requests[1].key, requests[0].key);
      assert.equal(requests[1].body, requests[0].body);
      assert.equal(
        store.db.prepare('SELECT state FROM stripe_checkout_intent').get().state,
        'response_unknown',
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
    store.close();
  }
});

test('a confirmed expired session rotates to a new intent and never reuses its key', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const store = createCheckoutIntentTestStore();
  const postRequests = [];
  let firstSession;
  globalThis.fetch = async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    if ((options.method || 'GET') === 'GET') {
      assert.equal(url.pathname, '/v1/checkout/sessions/cs_test_expiring');
      return stripeSuccess({
        ...firstSession,
        status: 'expired',
        url: null,
      }, 'req_confirm_expired');
    }

    postRequests.push({
      key: options.headers['Idempotency-Key'],
      body: options.body,
      intentId: new URLSearchParams(options.body).get('metadata[checkoutIntentId]'),
    });
    if (postRequests.length === 1) {
      firstSession = boundCheckoutSession(options, {
        id: 'cs_test_expiring',
        url: 'https://checkout.stripe.test/expiring',
      });
      return stripeSuccess(firstSession, 'req_expiring_created');
    }
    return stripeSuccess(boundCheckoutSession(options, {
      id: 'cs_test_replacement',
      url: 'https://checkout.stripe.test/replacement',
    }), 'req_replacement_created');
  };

  try {
    await withEnvironment(PHYSIO_CHECKOUT_ENV, async () => {
      const first = await invokeCheckout(store.checkoutIntents);
      assert.equal(first.status, 200);
      const replacement = await invokeCheckout(store.checkoutIntents);
      assert.equal(replacement.status, 200);
      assert.equal(replacement.body.url, 'https://checkout.stripe.test/replacement');
      assert.equal(postRequests.length, 2);
      assert.notEqual(postRequests[1].key, postRequests[0].key);
      assert.notEqual(postRequests[1].intentId, postRequests[0].intentId);
      const rows = store.db.prepare(`
        SELECT state, stripe_session_id
        FROM stripe_checkout_intent
        ORDER BY created_at, id
      `).all();
      assert.deepEqual(
        rows.map((row) => [row.state, row.stripe_session_id]),
        [
          ['unusable', 'cs_test_expiring'],
          ['created', 'cs_test_replacement'],
        ],
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
    store.close();
  }
});
