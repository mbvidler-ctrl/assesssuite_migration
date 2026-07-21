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
// Cancellation and closure are fail-closed as a pair. If Stripe cannot confirm
// cancellation, the server must not deactivate the account and falsely report
// that billing stopped; the caller can retry or contact support while retaining
// access to the billing controls. As with deactivateAccount, account_status is
// in UPDATE_ME_GUARDED_FIELDS, so this dedicated endpoint is the only permitted
// self-service transition.

import * as stripeGateway from '../stripeGateway.mjs';
import { cancelMockSubscription } from '../mocks/stripe.mjs';

const NO_PROVIDER_CANCELLATION_REQUIRED = new Set([
  '',
  'inactive',
  'cancelled',
  'canceled',
  'none',
]);
const LOCALLY_CANCELLED_SUBSCRIPTION_STATUSES = new Set(['cancelled', 'canceled']);

function normalizedSubscriptionStatus(user) {
  return typeof user?.subscription_status === 'string'
    ? user.subscription_status.trim().toLowerCase()
    : '';
}

function cancellationConfirmed(result, expectedSubscriptionId) {
  const status = typeof result?.status === 'string' ? result.status.toLowerCase() : '';
  return result?.id === expectedSubscriptionId && (status === 'canceled' || status === 'cancelled');
}

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

  const subscriptionId = typeof user.stripe_subscription_id === 'string'
    ? user.stripe_subscription_id.trim()
    : '';
  const customerId = typeof user.stripe_customer_id === 'string'
    ? user.stripe_customer_id.trim()
    : '';
  const subscriptionStatus = normalizedSubscriptionStatus(user);

  // A locally live/payment-bearing entitlement without a provider identifier
  // is not evidence that billing stopped. Keep the account open so support can
  // reconcile the linkage instead of returning a false cancellation success.
  if (
    !subscriptionId &&
    (customerId || !NO_PROVIDER_CANCELLATION_REQUIRED.has(subscriptionStatus))
  ) {
    return respond(409, {
      error: 'Subscription cancellation cannot be verified because the billing link is incomplete. Your account remains open; please contact support.',
    });
  }

  const providerCancellationRequired = subscriptionId && !LOCALLY_CANCELLED_SUBSCRIPTION_STATUSES.has(subscriptionStatus);
  if (providerCancellationRequired) {
    try {
      let cancellation;
      if (stripeGateway.stripeEnabled()) {
        cancellation = await stripeGateway.cancelSubscription(subscriptionId);
      } else {
        cancellation = cancelMockSubscription(subscriptionId);
      }
      if (!cancellationConfirmed(cancellation, subscriptionId)) {
        throw new Error('subscription cancellation was not confirmed');
      }
    } catch {
      console.error('[cancelSubscriptionAndDeactivate] subscription cancellation was not confirmed');
      return respond(502, {
        error: 'Subscription cancellation could not be confirmed. Your account remains open; please retry or contact support.',
      });
    }
  }

  await entities.User.update(user.id, {
    account_status: 'deactivated',
    deactivated_date: new Date().toISOString(),
    ...(subscriptionId ? { subscription_status: 'cancelled' } : {}),
  });

  return respond(200, {
    status: 'deactivated',
    subscription: subscriptionId ? 'cancelled' : 'none',
  });
}
