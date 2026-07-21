// Ported from base44/functions/stripeWebhook/entry.ts.
//
// Two modes, switched solely by stripeGateway.stripeEnabled():
//   - Mock (default; always under SELFTEST=1): accepts the posted event
//     JSON WITHOUT signature verification (there is no signing secret in
//     local dev) — byte-identical to the pre-gateway behaviour.
//   - Real (STRIPE_SECRET_KEY set): the Stripe-Signature header is verified
//     over the RAW request bytes (ctx.rawBody, supplied by the dispatcher
//     in server/functions/index.mjs) using HMAC-SHA256 with
//     STRIPE_WEBHOOK_SECRET, timing-safe compare, 5-minute replay window.
//     Unsigned or badly signed posts are rejected — in real mode an
//     unverified webhook could flip a user's entitlement, so verification
//     is mandatory (stricter than entry.ts, which skipped verification when
//     the secret was absent).
//
// The event-type handling and User entitlement writes below are SHARED by
// both modes and identical in shape to the captured source — the mock's
// shapes are the contract.

import {
  cancelMockSubscription,
  MOCK_CHECKOUT_PRICE_ID,
  recordMockSubscription,
} from '../mocks/stripe.mjs';
import {
  cancelSubscription,
  retrieveSubscription,
  stripeEnabled,
  verifyStripeSignatureHeader,
} from '../stripeGateway.mjs';
import { sendEmail, welcomeEmail } from '../email.mjs';

function cancellationConfirmed(result, expectedSubscriptionId) {
  const status = typeof result?.status === 'string' ? result.status.toLowerCase() : '';
  return result?.id === expectedSubscriptionId && (status === 'canceled' || status === 'cancelled');
}

export default async function stripeWebhook(ctx) {
  const { body: event, rawBody, request, entities, respond, user } = ctx;

  if (stripeEnabled()) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
    if (!secret) {
      // Refuse to process unverifiable webhooks in real mode rather than
      // silently trusting them.
      return respond(500, { message: 'STRIPE_WEBHOOK_SECRET is not configured' });
    }
    const verdict = verifyStripeSignatureHeader({
      rawBody,
      signatureHeader: request?.headers?.['stripe-signature'],
      secret,
    });
    if (!verdict.ok) {
      return respond(400, { message: 'Invalid signature' });
    }
  } else {
    // Mock mode has no signing secret to verify against, and there is no
    // real Stripe to originate the call — so the only legitimate caller is
    // internal QA. Without this gate an anonymous caller could grant
    // entitlement, lift an admin-imposed suspension, or suspend any user by
    // email (a denial-of-service primitive). Require an admin session.
    if (!user) return respond(401, { message: 'authentication required' });
    if (user.role !== 'admin') return respond(403, { message: 'admin access required' });
  }

  if (!event || typeof event !== 'object' || !event.type) {
    return respond(400, { message: 'Invalid JSON' });
  }

  // Terminal statuses a billing event must never override: an admin rejection
  // cannot be bought around, and a self-closed (deactivated) account is not
  // reopened or relabelled by a stray Stripe event.
  const NEVER_ACTIVATE = new Set(['rejected', 'deactivated']);

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data?.object || {};
      // A signed Stripe event proves origin, not that the event represents a
      // paid AssessSuite subscription for the claimed user.  Only the exact
      // Checkout Session shape created by createCheckoutSession is allowed to
      // grant entitlement.  In particular, do not activate from an unpaid,
      // one-off, or foreign-account Checkout Session which merely carries a
      // user id in client_reference_id.
      const checkoutUserId = typeof s.client_reference_id === 'string' ? s.client_reference_id.trim() : '';
      const metadataUserId = typeof s.metadata?.userId === 'string' ? s.metadata.userId.trim() : '';
      const customerId = typeof s.customer === 'string' ? s.customer.trim() : '';
      const subscriptionId = typeof s.subscription === 'string' ? s.subscription.trim() : '';
      const checkoutEmail = String(s.customer_email || s.customer_details?.email || '').trim().toLowerCase();
      const checkoutPriceId = typeof s.metadata?.priceId === 'string' ? s.metadata.priceId.trim() : '';
      const approvedPriceIds = stripeEnabled()
        ? new Set([
            process.env.STRIPE_PRICE_ID_MONTHLY,
            process.env.STRIPE_PRICE_ID_ANNUAL,
          ].filter((value) => typeof value === 'string' && value.trim() !== '').map((value) => value.trim()))
        : new Set([MOCK_CHECKOUT_PRICE_ID]);
      if (
        s.mode !== 'subscription' ||
        s.payment_status !== 'paid' ||
        !checkoutUserId ||
        metadataUserId !== checkoutUserId ||
        !customerId ||
        !subscriptionId ||
        !checkoutEmail ||
        !approvedPriceIds.has(checkoutPriceId)
      ) {
        return respond(400, { message: 'Checkout session is not eligible for subscription activation' });
      }

      const checkoutUser = await entities.User.get(checkoutUserId).catch(() => null);
      if (!checkoutUser || String(checkoutUser.email || '').trim().toLowerCase() !== checkoutEmail) {
        return respond(400, { message: 'Checkout session identity does not match an AssessSuite account' });
      }

      let providerSubscription = null;
      if (stripeEnabled()) {
        // Corroborate the session metadata against Stripe's resulting
        // subscription. This prevents an approved price id placed only in
        // metadata from activating a subscription whose actual recurring
        // line item uses another price.
        providerSubscription = await retrieveSubscription(subscriptionId);
        const subscriptionCustomerId = typeof providerSubscription?.customer === 'string'
          ? providerSubscription.customer
          : providerSubscription?.customer?.id;
        const subscriptionPriceIds = (providerSubscription?.items?.data || [])
          .map((item) => item?.price?.id)
          .filter((value) => typeof value === 'string');
        if (
          providerSubscription?.id !== subscriptionId ||
          subscriptionCustomerId !== customerId ||
          providerSubscription?.metadata?.userId !== checkoutUserId ||
          providerSubscription?.metadata?.priceId !== checkoutPriceId ||
          !subscriptionPriceIds.some((priceId) => approvedPriceIds.has(priceId))
        ) {
          return respond(400, { message: 'Stripe subscription is not eligible for AssessSuite activation' });
        }
      }

      // A valid paid Checkout Session can arrive after an administrator has
      // rejected the account or after the user has closed it. Silently
      // ignoring that event would leave Stripe charging a subscription that
      // AssessSuite neither exposes nor retains enough linkage to reconcile.
      // Cancel it now, persist the outcome, and make any failure retryable.
      if (NEVER_ACTIVATE.has(checkoutUser.account_status)) {
        try {
          let cancellation;
          if (stripeEnabled()) {
            const providerStatus = typeof providerSubscription?.status === 'string'
              ? providerSubscription.status.toLowerCase()
              : '';
            cancellation = providerStatus === 'canceled' || providerStatus === 'cancelled'
              ? providerSubscription
              : await cancelSubscription(subscriptionId);
          } else {
            recordMockSubscription({
              customerId,
              subscriptionId,
              status: 'active',
              email: checkoutEmail,
            });
            cancellation = cancelMockSubscription(subscriptionId);
          }
          if (!cancellationConfirmed(cancellation, subscriptionId)) {
            throw new Error('subscription cancellation was not confirmed');
          }
        } catch {
          await entities.User.update(checkoutUserId, {
            subscription_status: 'cancellation_pending',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          });
          return respond(500, { message: 'Paid subscription cancellation is pending' });
        }
        await entities.User.update(checkoutUserId, {
          subscription_status: 'cancelled',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        });
        return respond(200, { received: true });
      }

      if (providerSubscription?.status !== undefined && providerSubscription.status !== 'active') {
        return respond(400, { message: 'Stripe subscription is not eligible for AssessSuite activation' });
      }
      // Launch model (Max's direction, 13 July 2026): successful payment
      // AUTO-APPROVES. A pending account activates on checkout completion and
      // a payment-failure suspension is lifted — the admin-approval queue is
      // no longer a gate in the ordinary signup path. Two exclusions:
      // 'rejected' is never activated by payment (an admin rejection cannot
      // be bought around), and 'deactivated' (self-service account closure)
      // is not reopened by a stray billing event.
      const entitlement = {
        subscription_status: 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_start_date: new Date().toISOString(),
      };
      // Terminal accounts were handled above: their late subscription was
      // cancelled and its reconciliation linkage retained without activation.
      // For every remaining account, payment activates (auto-approve) and
      // writes the live entitlement.
      const dataFor = (existingUser) => (
        NEVER_ACTIVATE.has(existingUser?.account_status)
          ? null
          : { ...entitlement, account_status: 'active' }
      );
      // Welcome fires strictly on FIRST activation: not for an already-active
      // user, not for a protected status, and not for a returning customer
      // whose lapsed ('suspended') subscription is merely being restored.
      const NO_WELCOME = new Set(['active', 'suspended', 'rejected', 'deactivated']);
      const maybeWelcome = (existingUser) => {
        if (!existingUser?.email) return;
        if (NO_WELCOME.has(existingUser.account_status)) return;
        sendEmail({ to: existingUser.email, ...welcomeEmail(existingUser.clinician_name || existingUser.full_name) }).catch(() => {});
      };
      if (!stripeEnabled()) {
        // Mock mode only: record into the in-memory mock store so a later
        // syncStripeSubscription call can reconcile without a real API. In
        // real mode syncStripeSubscription reads api.stripe.com directly.
        recordMockSubscription({ customerId, subscriptionId, status: 'active', email: checkoutEmail });
      }

      const data = dataFor(checkoutUser);
      if (data) {
        await entities.User.update(checkoutUserId, data);
        maybeWelcome(checkoutUser);
      }
    }

    // Suspension events must not overwrite a protected terminal status: a
    // 'rejected' or self-'deactivated' account stays as it is (a billing event
    // arriving after closure/rejection must not silently relabel it
    // 'suspended', which would let a later payment reactivate it). Only the
    // subscription_status (entitlement axis) is updated for those.
    const suspendData = (existingUser) => (
      NEVER_ACTIVATE.has(existingUser?.account_status)
        ? {}
        : { account_status: 'suspended' }
    );

    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.paused') {
      const s = event.data?.object || {};
      let target = null;
      if (s.metadata?.userId) {
        target = await entities.User.get(s.metadata.userId).catch(() => null);
      } else if (s.metadata?.userEmail) {
        const users = await entities.User.filter({ email: s.metadata.userEmail });
        target = users?.[0] || null;
      }
      if (target) {
        await entities.User.update(target.id, { ...suspendData(target), subscription_status: 'cancelled' });
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const users = await entities.User.filter({ stripe_customer_id: event.data?.object?.customer });
      if (users?.length > 0) {
        await entities.User.update(users[0].id, { ...suspendData(users[0]), subscription_status: 'payment_failed' });
      }
    }
  } catch (err) {
    return respond(500, { message: 'Internal error' });
  }

  return respond(200, { received: true });
}
