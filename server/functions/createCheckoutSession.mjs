// Ported from base44/functions/createCheckoutSession/entry.ts.
//
// Two modes, switched solely by stripeGateway.stripeEnabled():
//   - Mock (default; always under SELFTEST=1): deterministic fake checkout
//     session with a local mock URL — no network calls, byte-identical to
//     the pre-gateway behaviour.
//   - Real (STRIPE_SECRET_KEY set): subscription-mode checkout session
//     created against api.stripe.com via server/stripeGateway.mjs,
//     mirroring the captured entry.ts parameter set. Both modes return the
//     same response shape: { url } on 200. The migration hardens the captured
// method-only route: checkout requires an authenticated, currently unlinked
// account and derives identity, price and redirects exclusively server-side.

import { createMockCheckoutSession, MOCK_CHECKOUT_PRICE_ID } from '../mocks/stripe.mjs';
import * as stripeGateway from '../stripeGateway.mjs';

// Price id captured from the client's original Base44 function (both the
// monthly and annual branches carried the same id in the captured source).
// Used by the MOCK path only — it does not exist in any other Stripe
// account, so the real path resolves prices from STRIPE_PRICE_ID_* instead.
const MOCK_FALLBACK_PRICE_ID = MOCK_CHECKOUT_PRICE_ID;
const CHECKOUT_ELIGIBLE_SUBSCRIPTION_STATUSES = new Set([
  '',
  'inactive',
  'cancelled',
  'canceled',
  'none',
]);

export default async function createCheckoutSession(ctx) {
  const { body, user, respond } = ctx;
  if (!user) {
    return respond(401, { error: 'authentication required' });
  }
  const plan = body?.plan;
  if (plan !== 'monthly' && plan !== 'annual') {
    return respond(400, { error: 'Plan must be monthly or annual.' });
  }

  const linkedSubscriptionId = typeof user.stripe_subscription_id === 'string'
    ? user.stripe_subscription_id.trim()
    : '';
  const subscriptionStatus = typeof user.subscription_status === 'string'
    ? user.subscription_status.trim().toLowerCase()
    : '';
  if (linkedSubscriptionId || !CHECKOUT_ELIGIBLE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {
    return respond(409, {
      error: 'An existing subscription must be managed through the billing portal.',
    });
  }

  // Price, identity and redirect targets are authorization/integrity inputs.
  // Resolve them only from trusted server state, never caller-controlled JSON.
  const userId = user.id;
  const userEmail = user.email;
  const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const successUrl = `${appUrl}/Dashboard`;
  const cancelUrl = `${appUrl}/PaymentRequired`;

  if (stripeGateway.stripeEnabled()) {
    // Real mode. Prices come only from the environment; the frontend's
    // captured ids belong to the client's original account and will not exist
    // in a fresh test-mode account, so set STRIPE_PRICE_ID_* and invoke with
    // the allowlisted plan name.
    const priceId =
      (plan === 'annual' ? process.env.STRIPE_PRICE_ID_ANNUAL : process.env.STRIPE_PRICE_ID_MONTHLY) ||
      null;
    if (!priceId) {
      return respond(500, {
        error:
          'Stripe price not configured: set STRIPE_PRICE_ID_MONTHLY / STRIPE_PRICE_ID_ANNUAL.',
      });
    }
    try {
      const session = await stripeGateway.createCheckoutSession({
        priceId,
        userId,
        userEmail,
        successUrl,
        cancelUrl,
      });
      return respond(200, { url: session.url });
    } catch (err) {
      return respond(500, { error: err.message });
    }
  }

  // Mock mode (default) — unchanged behaviour.
  const priceId = MOCK_FALLBACK_PRICE_ID;

  const session = createMockCheckoutSession({
    priceId,
    userId,
    userEmail,
    successUrl,
    cancelUrl,
  });

  return respond(200, { url: session.url });
}
