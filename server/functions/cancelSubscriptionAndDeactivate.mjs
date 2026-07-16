// cancelSubscriptionAndDeactivate — combined immediate Stripe cancellation +
// self-service account closure (launch-readiness, 16 July 2026).
//
// Consolidates the two actions the "Cancel subscription and close account"
// control performs: it cancels the caller's Stripe subscription IMMEDIATELY
// (billing stops at once; the existing no-refund policy governs) and then sets
// the caller's OWN account_status to 'deactivated'. The deactivation leg mirrors
// deactivateAccount exactly — same guards, same retention model (deactivation
// destroys NOTHING; the organisation, clients and clinical records are retained,
// org-scoped and encrypted, for the professional retention period) — and adds
// the subscription-cancellation leg ahead of it.
//
// The cancellation is best-effort: a cancel failure (already cancelled, unknown
// id, transient Stripe error) must NOT block the account closure, so it is
// caught and logged rather than propagated. As with deactivateAccount,
// account_status is in UPDATE_ME_GUARDED_FIELDS, so this dedicated endpoint is
// the only permitted self-service transition.

import * as stripeGateway from '../stripeGateway.mjs';
import { cancelMockSubscription } from '../mocks/stripe.mjs';

export default async function cancelSubscriptionAndDeactivate(ctx) {
  const { user, entities, respond } = ctx;
  if (!user) {
    return respond(401, { error: 'authentication required' });
  }
  if (user.role === 'admin') {
    // The bootstrap admin closing its own account would orphan the deployment
    // (approvals, reactivations and catalogue writes are admin-only).
    return respond(403, { error: 'an administrator account cannot self-deactivate' });
  }

  if (user.stripe_subscription_id) {
    try {
      if (stripeGateway.stripeEnabled()) {
        await stripeGateway.cancelSubscription(user.stripe_subscription_id);
      } else {
        cancelMockSubscription(user.stripe_subscription_id);
      }
    } catch (err) {
      // Tolerate a cancellation failure: the account still closes. A dangling
      // subscription is reconciled out of band rather than blocking closure.
      console.error('[cancelSubscriptionAndDeactivate] subscription cancel failed:', err);
    }
  }

  await entities.User.update(user.id, {
    account_status: 'deactivated',
    deactivated_date: new Date().toISOString(),
  });

  return respond(200, {
    status: 'deactivated',
    subscription: user.stripe_subscription_id ? 'cancelled' : 'none',
  });
}
