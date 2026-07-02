// Ported from base44/functions/syncStripeSubscription/entry.ts.
// Fully mocked per Max's direction (2 July 2026): reconciles from the mock
// Stripe store (server/mocks/stripe.mjs) instead of api.stripe.com.

import { findMockSubscriptionByEmail } from '../mocks/stripe.mjs';

export default async function syncStripeSubscription(ctx) {
  const { user, respond, updateMe } = ctx;

  if (!user) {
    return respond(401, { error: 'Unauthorized' });
  }

  const found = findMockSubscriptionByEmail(user.email);

  if (!found) {
    return respond(404, { error: 'No Stripe customer found for this email' });
  }

  const { customer, subscription } = found;

  const updateData = {
    subscription_status: subscription.status === 'active' ? 'active' : subscription.status,
    stripe_customer_id: customer.id,
    stripe_subscription_id: subscription.id,
    subscription_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
  };

  await updateMe(updateData);

  return respond(200, {
    success: true,
    message: `Subscription synced. Status: ${updateData.subscription_status}`,
    data: updateData,
  });
}
