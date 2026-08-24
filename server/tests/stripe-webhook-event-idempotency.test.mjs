import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { createStripeWebhookEventRepository } from '../db.mjs';
import stripeWebhook from '../functions/stripeWebhook.mjs';
import { testStripeProvider } from './support/provider-services.mjs';

const EVENT_CREATED = 1_800_000_100;

async function withPhysioTestEnvironment(operation) {
  const overrides = {
    NODE_ENV: 'test',
    SELFTEST: '1',
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    PAYMENTS_ENABLED: '1',
    STRIPE_PRICE_ID_MONTHLY: testStripeProvider.approvedPriceIds()[0],
    STRIPE_PRICE_ID_ANNUAL: 'price_test_annual',
    OUTBOUND_EMAIL_ENABLED: '0',
  };
  const previous = new Map(Object.keys(overrides).map((name) => [name, process.env[name]]));
  try {
    for (const [name, value] of Object.entries(overrides)) process.env[name] = value;
    return await operation();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function checkoutEvent(overrides = {}) {
  const priceId = testStripeProvider.approvedPriceIds()[0];
  return {
    id: 'evt_webhookidempotency',
    created: EVENT_CREATED,
    livemode: false,
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'subscription',
        payment_status: 'paid',
        customer: 'cus_eventledger',
        subscription: 'sub_eventledger',
        client_reference_id: 'user-eventledger',
        customer_email: 'event-ledger@example.test',
        metadata: {
          userId: 'user-eventledger',
          priceId,
          appId: 'local-assesssuite-physio',
          professionId: 'physio',
        },
        ...overrides,
      },
    },
  };
}

function createHarness({
  blockUpdate = null,
  provider = testStripeProvider,
  wrapWebhookEvents = null,
} = {}) {
  const db = new DatabaseSync(':memory:');
  const baseWebhookEvents = createStripeWebhookEventRepository(db, { leaseMs: 1000 });
  const webhookEvents = wrapWebhookEvents ? wrapWebhookEvents(baseWebhookEvents) : baseWebhookEvents;
  const updates = [];
  const deliveryEvidence = [];
  const user = {
    id: 'user-eventledger',
    email: 'event-ledger@example.test',
    account_status: 'pending',
  };
  const invoke = (event) => stripeWebhook({
    body: event,
    rawBody: Buffer.from(JSON.stringify(event)),
    request: { headers: {} },
    user: { id: 'admin-eventledger', role: 'admin' },
    stripeProvider: provider,
    webhookEvents,
    entities: {
      User: {
        get: async (id) => (id === user.id ? { ...user } : null),
        update: async (id, data) => {
          if (blockUpdate) await blockUpdate();
          updates.push({ id, data });
          Object.assign(user, data);
        },
      },
    },
    outboxEmail: { record: (row) => deliveryEvidence.push(row) },
    respond: (status, body) => ({ status, body }),
  });
  return { db, webhookEvents, baseWebhookEvents, updates, deliveryEvidence, user, invoke };
}

test('exact duplicate Stripe delivery returns the stored outcome without a second mutation or email', { concurrency: false }, async () => {
  await withPhysioTestEnvironment(async () => {
    const harness = createHarness();
    try {
      const event = checkoutEvent();
      const first = await harness.invoke(event);
      const duplicate = await harness.invoke(event);
      assert.equal(first.status, 200);
      assert.deepEqual(duplicate, first);
      assert.equal(harness.updates.length, 1);
      assert.equal(harness.deliveryEvidence.length, 1);
      assert.equal(harness.user.subscription_start_date, new Date(EVENT_CREATED * 1000).toISOString());
      const receipt = harness.webhookEvents.get('local-assesssuite-physio', event.id);
      assert.equal(receipt.state, 'completed');
      assert.equal(receipt.responseStatus, 200);
      assert.equal(receipt.response.welcome_delivery.attempted, true);
    } finally {
      harness.db.close();
    }
  });
});

test('same Stripe event ID with a divergent signed payload fails without mutation', { concurrency: false }, async () => {
  await withPhysioTestEnvironment(async () => {
    const harness = createHarness();
    try {
      const event = checkoutEvent();
      assert.equal((await harness.invoke(event)).status, 200);
      const divergent = checkoutEvent({ customer: 'cus_divergent' });
      const response = await harness.invoke(divergent);
      assert.equal(response.status, 409);
      assert.match(response.body.message, /conflicts/);
      assert.equal(harness.updates.length, 1);
      assert.equal(harness.deliveryEvidence.length, 1);
    } finally {
      harness.db.close();
    }
  });
});

test('concurrent duplicate is rejected while the first exact event holds its lease', { concurrency: false }, async () => {
  await withPhysioTestEnvironment(async () => {
    let releaseUpdate;
    let enteredUpdate;
    const entered = new Promise((resolve) => { enteredUpdate = resolve; });
    const blocked = new Promise((resolve) => { releaseUpdate = resolve; });
    const harness = createHarness({
      blockUpdate: async () => {
        enteredUpdate();
        await blocked;
      },
    });
    try {
      const event = checkoutEvent();
      const firstPromise = harness.invoke(event);
      await entered;
      const concurrent = await harness.invoke(event);
      assert.equal(concurrent.status, 409);
      assert.equal(concurrent.body.code, 'stripe_event_in_progress');
      releaseUpdate();
      assert.equal((await firstPromise).status, 200);
      assert.equal(harness.updates.length, 1);
      assert.equal(harness.deliveryEvidence.length, 1);
    } finally {
      harness.db.close();
    }
  });
});

test('expired processing lease is reclaimed only for the exact event identity', () => {
  let now = new Date('2026-08-22T00:00:00.000Z');
  const db = new DatabaseSync(':memory:');
  try {
    const repository = createStripeWebhookEventRepository(db, { now: () => now, leaseMs: 1000 });
    const candidate = {
      eventId: 'evt_webhooklease',
      appId: 'local-assesssuite-physio',
      professionId: 'physio',
      eventType: 'checkout.session.completed',
      accountScope: 'platform',
      payloadSha256: 'a'.repeat(64),
    };
    assert.equal(repository.acquire(candidate).disposition, 'claimed');
    assert.equal(repository.acquire(candidate).disposition, 'in_progress');
    now = new Date(now.getTime() + 1001);
    assert.equal(repository.acquire(candidate).disposition, 'reclaimed');
    assert.throws(
      () => repository.acquire({ ...candidate, payloadSha256: 'b'.repeat(64) }),
      /divergent signed payload/,
    );
  } finally {
    db.close();
  }
});

test('retryable provider failure reclaims the exact event and applies entitlement once', { concurrency: false }, async () => {
  await withPhysioTestEnvironment(async () => {
    let retrievals = 0;
    const priceId = testStripeProvider.approvedPriceIds()[0];
    const provider = {
      ...testStripeProvider,
      corroboratesCheckoutSubscription: true,
      async retrieveSubscription(id) {
        retrievals += 1;
        if (retrievals === 1) throw new Error('synthetic provider response loss');
        return {
          id,
          customer: 'cus_eventledger',
          status: 'active',
          metadata: {
            userId: 'user-eventledger',
            priceId,
            appId: 'local-assesssuite-physio',
            professionId: 'physio',
          },
          items: { data: [{ price: { id: priceId } }] },
        };
      },
    };
    const harness = createHarness({ provider });
    try {
      const event = checkoutEvent();
      assert.equal((await harness.invoke(event)).status, 500);
      assert.equal(harness.baseWebhookEvents.get('local-assesssuite-physio', event.id).state, 'retryable');
      assert.equal((await harness.invoke(event)).status, 200);
      assert.equal(retrievals, 2);
      assert.equal(harness.updates.length, 1);
      assert.equal(harness.deliveryEvidence.length, 1);
    } finally {
      harness.db.close();
    }
  });
});

test('local entitlement commit followed by receipt-write loss reconciles without a second mutation or email', { concurrency: false }, async () => {
  await withPhysioTestEnvironment(async () => {
    let loseCompletionResponse = true;
    const harness = createHarness({
      wrapWebhookEvents(base) {
        return {
          acquire: base.acquire,
          get: base.get,
          markRetryable: base.markRetryable,
          markCompleted(claim, outcome) {
            if (loseCompletionResponse) {
              loseCompletionResponse = false;
              throw new Error('synthetic SQLite completion response loss');
            }
            return base.markCompleted(claim, outcome);
          },
        };
      },
    });
    try {
      const event = checkoutEvent();
      assert.equal((await harness.invoke(event)).status, 500);
      assert.equal(harness.updates.length, 1);
      assert.equal(harness.deliveryEvidence.length, 1);
      assert.equal(harness.baseWebhookEvents.get('local-assesssuite-physio', event.id).state, 'retryable');
      const reconciled = await harness.invoke(event);
      assert.equal(reconciled.status, 200);
      assert.equal(reconciled.body.welcome_delivery.attempted, false);
      assert.equal(harness.updates.length, 1);
      assert.equal(harness.deliveryEvidence.length, 1);
      assert.equal(harness.baseWebhookEvents.get('local-assesssuite-physio', event.id).state, 'completed');
    } finally {
      harness.db.close();
    }
  });
});
