// Ported from base44/functions/createCheckoutSession/entry.ts.
// Fully mocked per Max's direction (2 July 2026): no call to
// api.stripe.com — returns a deterministic fake checkout session with a
// local mock URL. No auth check in the captured source (method-only gate).

import { createMockCheckoutSession } from '../mocks/stripe.mjs';

export default async function createCheckoutSession(ctx) {
  const { body, respond } = ctx;
  const { plan, priceId: directPriceId, userId, userEmail, successUrl, cancelUrl } = body || {};

  const priceId =
    directPriceId || (plan === 'annual' ? 'price_1TbH07LVAtM9m2RxqiPCaZ8M' : 'price_1TbH07LVAtM9m2RxqiPCaZ8M');

  const session = createMockCheckoutSession({
    priceId,
    userId,
    userEmail,
    successUrl: successUrl || '/Dashboard',
    cancelUrl: cancelUrl || '/PaymentRequired',
  });

  return respond(200, { url: session.url });
}
