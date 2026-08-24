// Ported from base44/functions/createPortalSession/entry.ts.
//
// Production creates a real billing-portal session through the server-owned
// Stripe adapter. Isolated tests may inject a test adapter through ctx; this
// runnable module imports and ships no fake provider implementation.

import { resolvePublicRequestOrigin } from '../publicRequestOrigin.mjs';
import {
  resolveStripeProvider,
  stripeProviderReady,
} from '../providers/stripeProduction.mjs';

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

  let provider;
  try {
    provider = resolveStripeProvider(ctx.stripeProvider, process.env);
  } catch (error) {
    return respond(500, { error: error.message, code: 'stripe_provider_invalid' });
  }
  if (!stripeProviderReady(provider, process.env)) {
    return respond(503, {
      error: 'The billing portal is unavailable because Stripe is not configured.',
      code: 'stripe_provider_unavailable',
    });
  }

  // Stripe requires an absolute return_url. Resolve it from the exact public
  // request host (custom or Fly) and never from caller JSON.
  let appUrl;
  try {
    appUrl = resolvePublicRequestOrigin({ request: ctx.request, environment: process.env });
  } catch (error) {
    return respond(400, { error: error.message, code: error.code });
  }
  try {
    const session = await provider.createPortalSession({
      stripeCustomerId,
      returnUrl: `${appUrl}/MyProfile`,
      flow,
      subscriptionId,
    });
    return respond(200, { url: session.url });
  } catch (err) {
    return respond(502, { error: err.message, code: 'stripe_provider_rejected' });
  }
}
