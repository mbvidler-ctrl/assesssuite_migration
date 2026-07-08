// Ported from base44/functions/syncStripeSubscription/entry.ts.
//
// Two modes, switched solely by stripeGateway.stripeEnabled():
//   - Mock (default; always under SELFTEST=1): reconciles from the mock
//     Stripe store (server/mocks/stripe.mjs) — byte-identical to the
//     pre-gateway behaviour.
//   - Real (STRIPE_SECRET_KEY set): looks up the customer by email and the
//     customer's latest subscription against api.stripe.com via
//     server/stripeGateway.mjs, mirroring entry.ts.
// Both modes write the identical entitlement shape to the User record
// (subscription_status, stripe_customer_id, stripe_subscription_id,
// subscription_start_date) — the mock's shapes are the contract.

import { findMockSubscriptionByEmail } from '../mocks/stripe.mjs';
import * as stripeGateway from '../stripeGateway.mjs';

export default async function syncStripeSubscription(ctx) {
  const { user, respond, updateMe } = ctx;

  if (!user) {
    return respond(401, { error: 'Unauthorized' });
  }

  let customer;
  let subscription;

  if (stripeGateway.stripeEnabled()) {
    // Real mode — same lookup sequence and 404 branches as entry.ts.
    try {
      customer = await stripeGateway.findCustomerByEmail(user.email);
      if (!customer) {
        return respond(404, { error: 'No Stripe customer found for this email' });
      }
      const subscriptions = await stripeGateway.listSubscriptionsForCustomer(customer.id, 1);
      if (subscriptions.length === 0) {
        return respond(404, { error: 'No active subscription found' });
      }
      subscription = subscriptions[0];
    } catch (err) {
      return respond(500, { error: err.message });
    }
  } else {
    // Mock mode (default) — unchanged behaviour.
    const found = findMockSubscriptionByEmail(user.email);
    if (!found) {
      return respond(404, { error: 'No Stripe customer found for this email' });
    }
    ({ customer, subscription } = found);
  }

  // Epoch seconds for the period start. entry.ts read the top-level
  // `current_period_start`; Stripe API versions from 2025-03-31.basil moved
  // that field onto the subscription item, and a fresh test-mode account
  // defaults to a current version — so the real path needs the fallbacks.
  // The written entitlement shape is unchanged (ISO string).
  const periodStartSeconds =
    subscription.current_period_start ??
    subscription.items?.data?.[0]?.current_period_start ??
    subscription.start_date ??
    Math.floor(Date.now() / 1000);

  const updateData = {
    subscription_status: subscription.status === 'active' ? 'active' : subscription.status,
    stripe_customer_id: customer.id,
    stripe_subscription_id: subscription.id,
    subscription_start_date: new Date(periodStartSeconds * 1000).toISOString(),
  };

  await updateMe(updateData);

  return respond(200, {
    success: true,
    message: `Subscription synced. Status: ${updateData.subscription_status}`,
    data: updateData,
  });
}
