// Ported from base44/functions/createCheckoutSession/entry.ts.
//
// Two modes, switched solely by stripeGateway.stripeEnabled():
//   - Mock (default; always under SELFTEST=1): deterministic fake checkout
//     session with a local mock URL — no network calls, byte-identical to
//     the pre-gateway behaviour.
//   - Real (STRIPE_SECRET_KEY set): subscription-mode checkout session
//     created against api.stripe.com via server/stripeGateway.mjs,
//     mirroring the captured entry.ts parameter set. Both modes return the
//     same response shape: { url } on 200.
// No auth check in the captured source (method-only gate) — preserved.

import { createMockCheckoutSession } from '../mocks/stripe.mjs';
import * as stripeGateway from '../stripeGateway.mjs';

// Price id captured from the client's original Base44 function (both the
// monthly and annual branches carried the same id in the captured source).
// Used by the MOCK path only — it does not exist in any other Stripe
// account, so the real path resolves prices from STRIPE_PRICE_ID_* instead.
const MOCK_FALLBACK_PRICE_ID = 'price_1TbH07LVAtM9m2RxqiPCaZ8M';

export default async function createCheckoutSession(ctx) {
  const { body, respond } = ctx;
  const { plan, priceId: directPriceId, userId, userEmail, successUrl, cancelUrl } = body || {};

  if (stripeGateway.stripeEnabled()) {
    // Real mode. Prices come from the environment (a body-supplied priceId
    // wins, matching entry.ts, but note the frontend's captured ids belong
    // to the client's original account and will not exist in a fresh
    // test-mode account — set STRIPE_PRICE_ID_* and invoke with `plan`).
    const priceId =
      directPriceId ||
      (plan === 'annual' ? process.env.STRIPE_PRICE_ID_ANNUAL : process.env.STRIPE_PRICE_ID_MONTHLY) ||
      null;
    if (!priceId) {
      return respond(500, {
        error:
          'Stripe price not configured: set STRIPE_PRICE_ID_MONTHLY / STRIPE_PRICE_ID_ANNUAL or pass priceId.',
      });
    }
    // Stripe requires absolute success/cancel URLs; APP_URL supplies the
    // origin where the caller passed a relative or no URL (entry.ts used
    // the same APP_URL convention).
    const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const absolute = (candidate, fallbackPath) =>
      candidate && /^https?:\/\//i.test(candidate) ? candidate : `${appUrl}${fallbackPath}`;
    try {
      const session = await stripeGateway.createCheckoutSession({
        priceId,
        userId,
        userEmail,
        successUrl: absolute(successUrl, '/Dashboard'),
        cancelUrl: absolute(cancelUrl, '/PaymentRequired'),
      });
      return respond(200, { url: session.url });
    } catch (err) {
      return respond(500, { error: err.message });
    }
  }

  // Mock mode (default) — unchanged behaviour.
  const priceId = directPriceId || (plan === 'annual' ? MOCK_FALLBACK_PRICE_ID : MOCK_FALLBACK_PRICE_ID);

  const session = createMockCheckoutSession({
    priceId,
    userId,
    userEmail,
    successUrl: successUrl || '/Dashboard',
    cancelUrl: cancelUrl || '/PaymentRequired',
  });

  return respond(200, { url: session.url });
}
