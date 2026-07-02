// Ported from base44/functions/stripeWebhook/entry.ts.
// Fully mocked per Max's direction (2 July 2026): accepts the posted event
// JSON WITHOUT real HMAC signature verification (there is no real Stripe
// signing secret in local dev), but reproduces the identical event-type
// handling and User entitlement writes as the captured source.

import { recordMockSubscription } from '../mocks/stripe.mjs';

export default async function stripeWebhook(ctx) {
  const { body: event, entities, respond } = ctx;

  if (!event || typeof event !== 'object' || !event.type) {
    return respond(400, { message: 'Invalid JSON' });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data?.object || {};
      const data = {
        account_status: 'active',
        subscription_status: 'active',
        stripe_customer_id: s.customer,
        stripe_subscription_id: s.subscription,
        subscription_start_date: new Date().toISOString(),
      };
      let updated = false;

      if (s.customer && s.subscription) {
        const email = s.customer_email || s.customer_details?.email || null;
        recordMockSubscription({ customerId: s.customer, subscriptionId: s.subscription, status: 'active', email });
      }

      if (s.client_reference_id) {
        try {
          await entities.User.update(s.client_reference_id, data);
          updated = true;
        } catch {
          // Fall through to email lookup, matching entry.ts's try/catch.
        }
      }

      if (!updated && (s.customer_email || s.customer_details?.email)) {
        const email = (s.customer_email || s.customer_details.email).toLowerCase();
        const users = await entities.User.filter({});
        const matchedUser = users?.find((u) => u.email?.toLowerCase() === email);
        if (matchedUser) {
          await entities.User.update(matchedUser.id, data);
          updated = true;
        }
      }
    }

    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.paused') {
      const s = event.data?.object || {};
      const data = { account_status: 'suspended', subscription_status: 'cancelled' };
      if (s.metadata?.userId) {
        await entities.User.update(s.metadata.userId, data);
      } else if (s.metadata?.userEmail) {
        const users = await entities.User.filter({ email: s.metadata.userEmail });
        if (users?.length > 0) await entities.User.update(users[0].id, data);
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const users = await entities.User.filter({ stripe_customer_id: event.data?.object?.customer });
      if (users?.length > 0) {
        await entities.User.update(users[0].id, { account_status: 'suspended', subscription_status: 'payment_failed' });
      }
    }
  } catch (err) {
    return respond(500, { message: 'Internal error' });
  }

  return respond(200, { received: true });
}
