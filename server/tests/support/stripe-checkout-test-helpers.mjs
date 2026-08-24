import { DatabaseSync } from 'node:sqlite';

import {
  createStripeCheckoutIntentRepository,
  ensureStripeCheckoutIntentSchema,
} from '../../db.mjs';

export function createCheckoutIntentTestStore(options = {}) {
  const db = new DatabaseSync(':memory:');
  ensureStripeCheckoutIntentSchema(db);
  return {
    db,
    checkoutIntents: createStripeCheckoutIntentRepository(db, options),
    close: () => db.close(),
  };
}

export function boundCheckoutSession(options, overrides = {}) {
  const form = new URLSearchParams(options.body);
  return {
    id: 'cs_test_checkout_intent',
    url: 'https://checkout.stripe.test/session',
    status: 'open',
    expires_at: 1_900_000_000,
    mode: 'subscription',
    client_reference_id: form.get('client_reference_id'),
    customer_email: form.get('customer_email'),
    metadata: {
      userId: form.get('metadata[userId]'),
      userEmail: form.get('metadata[userEmail]'),
      priceId: form.get('metadata[priceId]'),
      appId: form.get('metadata[appId]'),
      professionId: form.get('metadata[professionId]'),
      checkoutIntentId: form.get('metadata[checkoutIntentId]'),
      ...(form.has('metadata[qaSequence]')
        ? { qaSequence: form.get('metadata[qaSequence]') }
        : {}),
    },
    ...overrides,
  };
}
