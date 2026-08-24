// Ported from base44/functions/syncStripeSubscription/entry.ts.
//
// Production reconciles only against Stripe through the server-owned adapter.
// A test adapter may be injected through ctx solely in the exact self-test
// posture; no fake implementation is imported by this runnable module.

import { resolveActiveProfessionContract } from '../../packages/profession-config/runtime.mjs';
import {
  resolveStripeProvider,
  stripeProviderReady,
} from '../providers/stripeProduction.mjs';

export default async function syncStripeSubscription(ctx) {
  const { user, respond, updateSubscriptionEntitlement } = ctx;

  if (!user) {
    return respond(401, { error: 'Unauthorized' });
  }

  let provider;
  try {
    provider = resolveStripeProvider(ctx.stripeProvider, process.env);
  } catch (error) {
    return respond(500, { error: error.message, code: 'stripe_provider_invalid' });
  }
  if (!stripeProviderReady(provider, process.env)) {
    return respond(503, {
      error: 'Subscription reconciliation is unavailable because Stripe is not configured.',
      code: 'stripe_provider_unavailable',
    });
  }

  let customer;
  let subscription;
  try {
      customer = await provider.findCustomerByEmail(user.email);
      if (!customer) {
        return respond(404, { error: 'No Stripe customer found for this email' });
      }
      const activeContract = resolveActiveProfessionContract(process.env);
      const subscriptions = await provider.listSubscriptionsForCustomer(
        customer.id,
        activeContract.professionId === 'physio' ? 100 : 1,
      );
      subscription = activeContract.professionId === 'physio'
        ? subscriptions.find((candidate) => (
            candidate?.metadata?.appId === activeContract.appId
            && candidate?.metadata?.professionId === activeContract.professionId
          ))
        : subscriptions[0];
      if (!subscription) {
        return respond(404, { error: 'No active subscription found' });
      }
  } catch (err) {
    return respond(502, { error: err.message, code: 'stripe_provider_rejected' });
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
    subscription_status: ['active', 'trialing'].includes(subscription.status)
      ? 'active'
      : subscription.status,
    stripe_customer_id: customer.id,
    stripe_subscription_id: subscription.id,
    subscription_start_date: new Date(periodStartSeconds * 1000).toISOString(),
  };

  await updateSubscriptionEntitlement(updateData);

  return respond(200, {
    success: true,
    message: `Subscription synced. Status: ${updateData.subscription_status}`,
    data: updateData,
  });
}
