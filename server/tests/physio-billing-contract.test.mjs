import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import createCheckoutSession from '../functions/createCheckoutSession.mjs';
import stripeWebhook from '../functions/stripeWebhook.mjs';
import syncStripeSubscription from '../functions/syncStripeSubscription.mjs';
import { createStripeWebhookEventRepository } from '../db.mjs';
import {
  boundCheckoutSession,
  createCheckoutIntentTestStore,
} from './support/stripe-checkout-test-helpers.mjs';

const PHYSIO_ENV = Object.freeze({
  NODE_ENV: 'production',
  SELFTEST: undefined,
  PARITY_ASSURANCE_MODE: undefined,
  PAYMENTS_ENABLED: '1',
  STRIPE_SECRET_KEY: 'sk_test_physio_contract',
  STRIPE_WEBHOOK_SECRET: 'fixture-physio-webhook-contract',
  STRIPE_PRICE_ID_MONTHLY: 'price_physio_monthly',
  STRIPE_PRICE_ID_ANNUAL: 'price_physio_annual',
  PROFESSION: 'physio',
  DEFAULT_APP_ID: 'local-assesssuite-physio',
  APP_URL: 'https://physio.app.assesssuite.com',
  OUTBOUND_EMAIL_ENABLED: '0',
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

test('Physio checkout refuses to invent a trial period', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('Stripe must not be called without a frozen trial duration');
  };
  try {
    const response = await withEnvironment({ ...PHYSIO_ENV, STRIPE_TRIAL_PERIOD_DAYS: undefined }, () => (
      createCheckoutSession({
        user: { id: 'physio-user', email: 'physio@example.test' },
        request: PHYSIO_FLY_REQUEST,
        body: { plan: 'monthly' },
        respond,
      })
    ));
    assert.equal(response.status, 500);
    assert.match(response.body.error, /STRIPE_TRIAL_PERIOD_DAYS/);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Physio checkout binds the trial to the exact application and profession', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let form;
  const store = createCheckoutIntentTestStore();
  globalThis.fetch = async (_url, options) => {
    form = new URLSearchParams(options.body);
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'req_checkout_physio' },
      json: async () => boundCheckoutSession(options, {
        url: 'https://checkout.stripe.test/physio',
      }),
    };
  };
  try {
    const response = await withEnvironment({ ...PHYSIO_ENV, STRIPE_TRIAL_PERIOD_DAYS: '30' }, () => (
      createCheckoutSession({
        user: {
          id: 'physio-user',
          email: 'physio+assesssuite-physio-self-service-123456abcdef@example.test',
        },
        request: PHYSIO_FLY_REQUEST,
        body: {
          plan: 'annual',
          appId: 'local-assesssuite',
          professionId: 'exercise-physiology',
          trialPeriodDays: 365,
          qaSequence: 'attacker-controlled',
        },
        checkoutIntents: store.checkoutIntents,
        respond,
      })
    ));
    assert.equal(response.status, 200);
    assert.equal(form.get('line_items[0][price]'), 'price_physio_annual');
    assert.equal(form.get('metadata[appId]'), 'local-assesssuite-physio');
    assert.equal(form.get('metadata[professionId]'), 'physio');
    assert.equal(form.get('subscription_data[metadata][appId]'), 'local-assesssuite-physio');
    assert.equal(form.get('subscription_data[metadata][professionId]'), 'physio');
    assert.equal(form.get('metadata[qaSequence]'), 'assesssuite-physio-self-service-123456abcdef');
    assert.equal(form.get('subscription_data[metadata][qaSequence]'), 'assesssuite-physio-self-service-123456abcdef');
    assert.equal(form.get('subscription_data[trial_period_days]'), '30');
    assert.equal(form.get('payment_method_collection'), 'always');
    assert.match(form.get('integration_identifier'), /^assesssuite_physio_[a-z]{8}$/);
    assert.match(form.get('metadata[checkoutIntentId]'), /^[0-9a-f-]{36}$/);
    assert.equal(form.has('payment_method_types[0]'), false);
    assert.equal([...form.values()].includes('local-assesssuite'), false);
  } finally {
    globalThis.fetch = originalFetch;
    store.close();
  }
});

test('ordinary users cannot inject self-service Stripe metadata', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let form;
  const store = createCheckoutIntentTestStore();
  globalThis.fetch = async (_url, options) => {
    form = new URLSearchParams(options.body);
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'req_checkout_ordinary' },
      json: async () => boundCheckoutSession(options, {
        url: 'https://checkout.stripe.test/ordinary',
      }),
    };
  };
  try {
    const response = await withEnvironment({ ...PHYSIO_ENV, STRIPE_TRIAL_PERIOD_DAYS: '30' }, () => (
      createCheckoutSession({
        user: { id: 'ordinary-user', email: 'ordinary@example.test' },
        request: PHYSIO_FLY_REQUEST,
        body: {
          plan: 'monthly',
          qaSequence: 'assesssuite-physio-self-service-123456abcdef',
        },
        checkoutIntents: store.checkoutIntents,
        respond,
      })
    ));
    assert.equal(response.status, 200);
    assert.equal(form.has('metadata[qaSequence]'), false);
    assert.equal(form.has('subscription_data[metadata][qaSequence]'), false);
    assert.equal([...form.values()].includes('assesssuite-physio-self-service-123456abcdef'), false);
  } finally {
    globalThis.fetch = originalFetch;
    store.close();
  }
});

function signedWebhookContext({ event, updates, deliveryEvidence = [] }) {
  const eventDb = new DatabaseSync(':memory:');
  const rawBody = Buffer.from(JSON.stringify(event));
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', PHYSIO_ENV.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  return {
    body: event,
    rawBody,
    request: { headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` } },
    entities: {
      User: {
        get: async (id) => (id === 'physio-user' ? {
          id,
          email: 'physio@example.test',
          account_status: 'pending',
        } : null),
        update: async (id, data) => updates.push({ id, data }),
      },
    },
    outboxEmail: { record: (row) => deliveryEvidence.push(row) },
    webhookEvents: createStripeWebhookEventRepository(eventDb),
    respond,
  };
}

function physioCheckoutEvent(metadata = {}) {
  return {
    id: 'evt_physiocheckoutcompleted',
    created: 1_800_000_000,
    livemode: true,
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'subscription',
        payment_status: 'no_payment_required',
        customer: 'cus_physio',
        subscription: 'sub_physio',
        client_reference_id: 'physio-user',
        customer_email: 'physio@example.test',
        metadata: {
          userId: 'physio-user',
          priceId: 'price_physio_monthly',
          appId: 'local-assesssuite-physio',
          professionId: 'physio',
          ...metadata,
        },
      },
    },
  };
}

test('trialing Physio checkout activates entitlement only after provider corroboration', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const trialEnd = Math.floor(Date.now() / 1000) + (30 * 86400);
  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://api.stripe.com/v1/subscriptions/sub_physio');
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'req_subscription_physio' },
      json: async () => ({
        id: 'sub_physio',
        customer: 'cus_physio',
        status: 'trialing',
        trial_end: trialEnd,
        metadata: {
          userId: 'physio-user',
          priceId: 'price_physio_monthly',
          appId: 'local-assesssuite-physio',
          professionId: 'physio',
        },
        items: { data: [{ price: { id: 'price_physio_monthly' } }] },
      }),
    };
  };
  try {
    const updates = [];
    const deliveryEvidence = [];
    const response = await withEnvironment({ ...PHYSIO_ENV, STRIPE_TRIAL_PERIOD_DAYS: '30' }, () => (
      stripeWebhook(signedWebhookContext({
        event: physioCheckoutEvent(),
        updates,
        deliveryEvidence,
      }))
    ));
    assert.equal(response.status, 200);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].data.account_status, 'active');
    assert.equal(updates[0].data.subscription_status, 'active');
    assert.equal(updates[0].data.stripe_subscription_status, 'trialing');
    assert.equal(updates[0].data.subscription_trial_end_date, new Date(trialEnd * 1000).toISOString());
    assert.equal(response.body.welcome_delivery.attempted, true);
    assert.equal(response.body.welcome_delivery.sent, false);
    assert.equal(deliveryEvidence.length, 1);
    assert.equal(deliveryEvidence[0].event, 'stripe_welcome_email_delivery');
    assert.equal(deliveryEvidence[0].failure.code, 'delivery_not_sent');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Physio webhook acknowledges and ignores a foreign vertical', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('foreign vertical must not be corroborated against Stripe');
  };
  try {
    const updates = [];
    const event = physioCheckoutEvent({
      appId: 'local-assesssuite',
      professionId: 'exercise-physiology',
    });
    const response = await withEnvironment({ ...PHYSIO_ENV, STRIPE_TRIAL_PERIOD_DAYS: '30' }, () => (
      stripeWebhook(signedWebhookContext({ event, updates }))
    ));
    assert.equal(response.status, 200);
    assert.equal(response.body.ignored, true);
    assert.equal(fetchCalls, 0);
    assert.deepEqual(updates, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Physio subscription sync selects only its application-bound subscription', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const updates = [];
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/v1/customers') {
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'req_customer_physio' },
        json: async () => ({ data: [{ id: 'cus_shared' }] }),
      };
    }
    assert.equal(parsed.pathname, '/v1/subscriptions');
    assert.equal(parsed.searchParams.get('limit'), '100');
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'req_subscriptions_physio' },
      json: async () => ({ data: [
        {
          id: 'sub_ep',
          status: 'active',
          metadata: { appId: 'local-assesssuite', professionId: 'exercise-physiology' },
        },
        {
          id: 'sub_physio',
          status: 'trialing',
          start_date: 1_800_000_000,
          metadata: { appId: 'local-assesssuite-physio', professionId: 'physio' },
        },
      ] }),
    };
  };
  try {
    const response = await withEnvironment({ ...PHYSIO_ENV, STRIPE_TRIAL_PERIOD_DAYS: '30' }, () => (
      syncStripeSubscription({
        user: { id: 'physio-user', email: 'physio@example.test' },
        updateSubscriptionEntitlement: async (data) => updates.push(data),
        respond,
      })
    ));
    assert.equal(response.status, 200);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].stripe_subscription_id, 'sub_physio');
    assert.equal(updates[0].subscription_status, 'active');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('subscription page renders the Physio product and canonical catalogue count', () => {
  const source = fs.readFileSync(new URL('../../src/pages/PaymentRequired.jsx', import.meta.url), 'utf8');
  assert.match(source, /profession\.productName/);
  assert.match(source, /236 canonical outcome measures and assessments/);
  assert.match(source, /Start Monthly Trial/);
  assert.match(source, /Confirming your trial/);
  assert.match(source, /Retry confirmation/);
  assert.match(source, /syncStripeSubscription/);
  assert.doesNotMatch(source, /Choose a plan to access AssessSuite\.<\/p>/);
});
