// Ported from base44/functions/createPortalSession/entry.ts.
// Fully mocked per Max's direction (2 July 2026): no call to
// api.stripe.com — returns a deterministic fake billing-portal session URL.

import { createMockPortalSession } from '../mocks/stripe.mjs';

export default async function createPortalSession(ctx) {
  const { body, respond } = ctx;
  const { stripeCustomerId } = body || {};

  if (!stripeCustomerId) {
    return respond(400, { error: 'No Stripe customer ID found.' });
  }

  const session = createMockPortalSession({ stripeCustomerId, returnUrl: '/Settings' });
  return respond(200, { url: session.url });
}
