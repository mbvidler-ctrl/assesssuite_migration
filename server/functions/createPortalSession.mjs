// Ported from base44/functions/createPortalSession/entry.ts.
//
// Two modes, switched solely by stripeGateway.stripeEnabled():
//   - Mock (default; always under SELFTEST=1): deterministic fake
//     billing-portal session URL — no network calls, byte-identical to the
//     pre-gateway behaviour.
//   - Real (STRIPE_SECRET_KEY set): billing-portal session created against
//     api.stripe.com via server/stripeGateway.mjs. Both modes return the
//     same response shape: { url } on 200, { error } on 400/500.

import { createMockPortalSession } from '../mocks/stripe.mjs';
import * as stripeGateway from '../stripeGateway.mjs';

export default async function createPortalSession(ctx) {
  const { body, user, respond } = ctx;
  // Billing identifiers are an authorization boundary. They must come from
  // the authenticated server-side user record, never from caller-controlled
  // JSON (otherwise one account can open another customer's portal).
  const stripeCustomerId = user?.stripe_customer_id;
  const subscriptionId = user?.stripe_subscription_id;
  const requestedFlow = body?.flow;
  const flow = requestedFlow === 'subscription_update' || requestedFlow === 'payment_method_update'
    ? requestedFlow
    : undefined;

  if (!stripeCustomerId) {
    return respond(400, { error: 'No Stripe customer ID found.' });
  }

  if (stripeGateway.stripeEnabled()) {
    // Real mode. Stripe requires an absolute return_url; entry.ts used
    // APP_URL + '/Settings' and so does this branch. An optional `flow`
    // ('subscription_update' | 'payment_method_update') is forwarded to the
    // gateway as flow_data so the portal opens directly on that flow.
    const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    try {
      const session = await stripeGateway.createPortalSession({
        stripeCustomerId,
        returnUrl: `${appUrl}/Settings`,
        flow,
        subscriptionId,
      });
      return respond(200, { url: session.url });
    } catch (err) {
      return respond(500, { error: err.message });
    }
  }

  // Mock mode (default) — unchanged behaviour.
  const session = createMockPortalSession({ stripeCustomerId, returnUrl: '/Settings' });
  return respond(200, { url: session.url });
}
