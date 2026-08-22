import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHECKOUT_RETURN_MAX_ATTEMPTS,
  confirmCheckoutReturn,
  isAuthoritativeTrialEntitlement,
} from '../../src/lib/checkoutReturn.js';

const ACTIVE_TRIAL = Object.freeze({
  account_status: 'active',
  subscription_status: 'active',
  stripe_subscription_status: 'trialing',
  stripe_customer_id: 'cus_exact',
  stripe_subscription_id: 'sub_exact',
});

test('checkout return waits for authoritative delayed-webhook state', async () => {
  const states = [
    { account_status: 'pending', subscription_status: 'inactive' },
    { account_status: 'pending', subscription_status: 'active', stripe_customer_id: 'cus_exact', stripe_subscription_id: 'sub_exact' },
    { account_status: 'pending', subscription_status: 'active', stripe_customer_id: 'cus_exact', stripe_subscription_id: 'sub_exact' },
    ACTIVE_TRIAL,
  ];
  let reads = 0;
  let syncs = 0;
  let waits = 0;
  const result = await confirmCheckoutReturn({
    readUser: async () => states[Math.min(reads++, states.length - 1)],
    syncSubscription: async () => { syncs += 1; },
    wait: async () => { waits += 1; },
    maxAttempts: 3,
    intervalMs: 0,
  });

  assert.equal(result.status, 'confirmed');
  assert.equal(result.attempts, 2);
  assert.equal(syncs, 2);
  assert.equal(waits, 1);
  assert.equal(isAuthoritativeTrialEntitlement(states[1]), false);
  assert.equal(isAuthoritativeTrialEntitlement(ACTIVE_TRIAL), true);
});

test('checkout URL alone never grants access and confirmation is bounded', async () => {
  let reads = 0;
  let syncs = 0;
  const result = await confirmCheckoutReturn({
    readUser: async () => {
      reads += 1;
      return { account_status: 'pending', subscription_status: 'inactive' };
    },
    syncSubscription: async () => { syncs += 1; throw new Error('webhook delayed'); },
    wait: async () => {},
    maxAttempts: 3,
    intervalMs: 0,
  });

  assert.equal(result.status, 'timeout');
  assert.equal(result.attempts, 3);
  assert.equal(reads, 6);
  assert.equal(syncs, 3);
  assert.ok(result.error instanceof Error);
});

test('checkout confirmation is abortable before a provider action', async () => {
  const controller = new AbortController();
  controller.abort();
  let invoked = false;
  const result = await confirmCheckoutReturn({
    readUser: async () => { invoked = true; },
    syncSubscription: async () => { invoked = true; },
    wait: async () => {},
    signal: controller.signal,
    maxAttempts: CHECKOUT_RETURN_MAX_ATTEMPTS,
  });
  assert.deepEqual(result, { status: 'aborted', attempts: 0 });
  assert.equal(invoked, false);
});
