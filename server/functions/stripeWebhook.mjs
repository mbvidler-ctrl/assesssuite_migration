// Ported from base44/functions/stripeWebhook/entry.ts.
//
// Production accepts only the server-owned Stripe provider. The
// Stripe-Signature header is verified
//     over the RAW request bytes (ctx.rawBody, supplied by the dispatcher
//     in server/functions/index.mjs) using HMAC-SHA256 with
//     STRIPE_WEBHOOK_SECRET, timing-safe compare, 5-minute replay window.
//     Unsigned or badly signed posts are rejected — in real mode an
//     unverified webhook could flip a user's entitlement, so verification
//     is mandatory (stricter than entry.ts, which skipped verification when
//     the secret was absent).
//
// Isolated tests may inject an explicitly test-only provider through ctx;
// this production-runnable module imports and ships no fake adapter.

import { sendEmail, welcomeEmail } from '../email.mjs';
import { createHash } from 'node:crypto';
import { resolveActiveProfessionContract } from '../../packages/profession-config/runtime.mjs';
import {
  resolveStripeProvider,
  stripeProviderReady,
} from '../providers/stripeProduction.mjs';

function cancellationConfirmed(result, expectedSubscriptionId) {
  const status = typeof result?.status === 'string' ? result.status.toLowerCase() : '';
  return result?.id === expectedSubscriptionId && (status === 'canceled' || status === 'cancelled');
}

function metadataMatchesApplication(metadata, activeContract) {
  return metadata?.appId === activeContract.appId
    && metadata?.professionId === activeContract.professionId;
}

function providerStatus(subscription) {
  return typeof subscription?.status === 'string'
    ? subscription.status.trim().toLowerCase()
    : '';
}

function subscriptionIsEntitled(subscription) {
  return ['active', 'trialing'].includes(providerStatus(subscription));
}

function checkoutPaymentIsEntitled(paymentStatus, subscription, corroboratesSubscription) {
  if (!corroboratesSubscription) return paymentStatus === 'paid';
  if (!subscriptionIsEntitled(subscription)) return false;
  if (paymentStatus === 'paid') return true;
  return paymentStatus === 'no_payment_required' && providerStatus(subscription) === 'trialing';
}

const STRIPE_WEBHOOK_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'invoice.payment_failed',
]);

function directEventMetadata(event) {
  const object = event?.data?.object;
  if (!object || typeof object !== 'object' || Array.isArray(object)) return null;
  if (event.type === 'invoice.payment_failed') return object.subscription_details?.metadata || null;
  return object.metadata || null;
}

async function updateUserIfChanged(entities, userRecord, data) {
  const changed = Object.entries(data).some(([key, value]) => userRecord?.[key] !== value);
  if (!changed) return false;
  await entities.User.update(userRecord.id, data);
  return true;
}

export default async function stripeWebhook(ctx) {
  const {
    body: event,
    rawBody,
    request,
    entities,
    respond: rawRespond,
    user,
    webhookEvents,
  } = ctx;
  let respond = rawRespond;
  let provider;
  try {
    provider = resolveStripeProvider(ctx.stripeProvider, process.env);
  } catch (error) {
    return respond(500, { message: error.message, code: 'stripe_provider_invalid' });
  }
  if (!stripeProviderReady(provider, process.env)) {
    return respond(503, {
      message: 'Stripe webhooks are unavailable because the provider is not configured',
      code: 'stripe_provider_unavailable',
    });
  }
  const corroboratesSubscription = provider.corroboratesCheckoutSubscription === true;
  const enforcesApplicationMetadata = provider.enforcesApplicationMetadata !== false;
  let activeContract;
  try {
    activeContract = resolveActiveProfessionContract(process.env);
  } catch {
    return respond(500, { message: 'Application billing identity is misconfigured' });
  }

  if (provider.requiresSignedWebhook === true) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
    if (!secret) {
      // Refuse to process unverifiable webhooks in real mode rather than
      // silently trusting them.
      return respond(500, { message: 'STRIPE_WEBHOOK_SECRET is not configured' });
    }
    const verdict = provider.verifyStripeSignatureHeader({
      rawBody,
      signatureHeader: request?.headers?.['stripe-signature'],
      secret,
    });
    if (!verdict.ok) {
      return respond(400, { message: 'Invalid signature' });
    }
  } else {
    // Only an explicitly injected test provider can select this branch, and
    // resolveStripeProvider has already proven NODE_ENV=test + SELFTEST=1.
    if (!user) return respond(401, { message: 'authentication required' });
    if (user.role !== 'admin') return respond(403, { message: 'admin access required' });
  }

  if (!event || typeof event !== 'object' || !event.type) {
    return respond(400, { message: 'Invalid JSON' });
  }
  if (
    !/^evt_[A-Za-z0-9]+$/.test(event.id || '')
    || !STRIPE_WEBHOOK_EVENT_TYPES.has(event.type)
    || !Number.isInteger(event.created)
    || event.created <= 0
    || event.account !== undefined && event.account !== null
    || !event.data?.object
    || typeof event.data.object !== 'object'
    || Array.isArray(event.data.object)
  ) {
    return respond(400, { message: 'Stripe event identity is invalid' });
  }
  const requiresLiveEvent = process.env.NODE_ENV === 'production'
    || /^(?:rk|sk)_live_/.test(process.env.STRIPE_SECRET_KEY || '');
  if (requiresLiveEvent && event.livemode !== true) {
    return respond(400, { message: 'Stripe event is not live-mode' });
  }
  if (!webhookEvents || typeof webhookEvents.acquire !== 'function') {
    return respond(503, {
      message: 'Stripe event persistence is unavailable',
      code: 'stripe_event_ledger_unavailable',
    });
  }
  const metadata = directEventMetadata(event);
  if (metadata && !metadataMatchesApplication(metadata, activeContract)) {
    return respond(200, { received: true, ignored: true });
  }

  let acquisition;
  try {
    acquisition = webhookEvents.acquire({
      eventId: event.id,
      appId: activeContract.appId,
      professionId: activeContract.professionId,
      eventType: event.type,
      accountScope: 'platform',
      payloadSha256: createHash('sha256').update(rawBody).digest('hex'),
    });
  } catch (error) {
    if (error?.code === 'stripe_event_payload_divergent') {
      return respond(409, { message: 'Stripe event ID conflicts with an earlier signed payload' });
    }
    return respond(500, { message: 'Stripe event persistence failed' });
  }
  if (acquisition.disposition === 'completed_duplicate') {
    return respond(acquisition.event.responseStatus, acquisition.event.response);
  }
  if (acquisition.disposition === 'in_progress') {
    return respond(409, {
      message: 'Stripe event is already being processed',
      code: 'stripe_event_in_progress',
    });
  }
  const eventClaim = acquisition.event;
  let ledgerFinalized = false;
  respond = (status, body) => {
    if (status >= 500) {
      webhookEvents.markRetryable(eventClaim, body?.code || 'stripe_webhook_retryable');
    } else {
      webhookEvents.markCompleted(eventClaim, { status, body });
      ledgerFinalized = true;
    }
    return rawRespond(status, body);
  };

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
      if (enforcesApplicationMetadata && !metadataMatchesApplication(s.metadata, activeContract)) {
        // A Stripe account may deliver several AssessSuite verticals to one
        // endpoint configuration. Acknowledge a foreign vertical without
        // mutating this application's isolated entitlement store.
        return respond(200, { received: true, ignored: true });
      }
      const approvedPriceIds = typeof provider.approvedPriceIds === 'function'
        ? new Set(provider.approvedPriceIds(process.env))
        : new Set([
            process.env.STRIPE_PRICE_ID_MONTHLY,
            process.env.STRIPE_PRICE_ID_ANNUAL,
          ].filter((value) => typeof value === 'string' && value.trim() !== '').map((value) => value.trim()));
      if (
        s.mode !== 'subscription' ||
        !['paid', 'no_payment_required'].includes(s.payment_status) ||
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
      if (corroboratesSubscription) {
        // Corroborate the session metadata against Stripe's resulting
        // subscription. This prevents an approved price id placed only in
        // metadata from activating a subscription whose actual recurring
        // line item uses another price.
        providerSubscription = await provider.retrieveSubscription(subscriptionId);
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
          !metadataMatchesApplication(providerSubscription?.metadata, activeContract) ||
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
          if (corroboratesSubscription) {
            const currentProviderStatus = providerStatus(providerSubscription);
            cancellation = currentProviderStatus === 'canceled' || currentProviderStatus === 'cancelled'
              ? providerSubscription
              : await provider.cancelSubscription(subscriptionId);
          } else {
            provider.recordSubscription({
              customerId,
              subscriptionId,
              status: 'active',
              email: checkoutEmail,
            });
            cancellation = await provider.cancelSubscription(subscriptionId);
          }
          if (!cancellationConfirmed(cancellation, subscriptionId)) {
            throw new Error('subscription cancellation was not confirmed');
          }
        } catch {
          await updateUserIfChanged(entities, checkoutUser, {
            subscription_status: 'cancellation_pending',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          });
          return respond(500, { message: 'Paid subscription cancellation is pending' });
        }
        await updateUserIfChanged(entities, checkoutUser, {
          subscription_status: 'cancelled',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
        });
        return respond(200, { received: true });
      }

      if (!checkoutPaymentIsEntitled(
        s.payment_status,
        providerSubscription,
        corroboratesSubscription,
      )) {
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
        stripe_subscription_status: providerStatus(providerSubscription) || 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_start_date: new Date(event.created * 1000).toISOString(),
        subscription_trial_end_date:
          providerStatus(providerSubscription) === 'trialing'
          && Number.isFinite(providerSubscription?.trial_end)
            ? new Date(providerSubscription.trial_end * 1000).toISOString()
            : null,
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
      const maybeWelcome = async (existingUser) => {
        if (!existingUser?.email || NO_WELCOME.has(existingUser.account_status)) {
          return { attempted: false };
        }
        const delivery = await sendEmail({
          to: existingUser.email,
          ...welcomeEmail(existingUser.clinician_name || existingUser.full_name),
          idempotencyKey: `stripe-welcome/${event.id}`,
        });
        const safeEvidence = {
          event: 'stripe_welcome_email_delivery',
          stripe_event_id: typeof event.id === 'string' ? event.id.slice(0, 200) : null,
          user_id: String(existingUser.id || '').slice(0, 200),
          attempted: true,
          recorded: delivery.recorded === true,
          sent: delivery.sent === true,
          provider_message_id: delivery.sent === true ? delivery.providerId || null : null,
          failure: delivery.sent === true ? null : delivery.failure || { code: 'delivery_not_sent' },
        };
        try {
          ctx.outboxEmail?.record(safeEvidence);
        } catch (error) {
          console.error('[stripeWebhook] welcome delivery evidence persistence failed:', {
            code: 'welcome_delivery_evidence_persistence_failed',
            error: error?.name || 'Error',
          });
        }
        if (!delivery.sent) {
          console.error('[stripeWebhook] welcome email delivery failed:', safeEvidence.failure);
        }
        return safeEvidence;
      };
      if (!corroboratesSubscription && typeof provider.recordSubscription === 'function') {
        provider.recordSubscription({ customerId, subscriptionId, status: 'active', email: checkoutEmail });
      }

      const data = dataFor(checkoutUser);
      if (data) {
        await updateUserIfChanged(entities, checkoutUser, data);
        const welcomeDelivery = await maybeWelcome(checkoutUser);
        return respond(200, { received: true, welcome_delivery: welcomeDelivery });
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
      if (enforcesApplicationMetadata && !metadataMatchesApplication(s.metadata, activeContract)) {
        return respond(200, { received: true, ignored: true });
      }
      let target = null;
      if (s.metadata?.userId) {
        target = await entities.User.get(s.metadata.userId).catch(() => null);
      } else if (s.metadata?.userEmail) {
        const users = await entities.User.filter({ email: s.metadata.userEmail });
        target = users?.[0] || null;
      }
      if (target) {
        await updateUserIfChanged(entities, target, {
          ...suspendData(target),
          subscription_status: 'cancelled',
        });
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data?.object || {};
      if (corroboratesSubscription) {
        let billingMetadata = invoice.subscription_details?.metadata;
        const invoiceSubscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;
        if (!metadataMatchesApplication(billingMetadata, activeContract) && invoiceSubscriptionId) {
          const invoiceSubscription = await provider.retrieveSubscription(invoiceSubscriptionId);
          const invoiceCustomerId = typeof invoiceSubscription?.customer === 'string'
            ? invoiceSubscription.customer
            : invoiceSubscription?.customer?.id;
          if (invoiceCustomerId !== invoice.customer) {
            return respond(400, { message: 'Invoice subscription customer does not match' });
          }
          billingMetadata = invoiceSubscription?.metadata;
        }
        if (enforcesApplicationMetadata && !metadataMatchesApplication(billingMetadata, activeContract)) {
          return respond(200, { received: true, ignored: true });
        }
      }
      const users = await entities.User.filter({ stripe_customer_id: invoice.customer });
      if (users?.length > 0) {
        await updateUserIfChanged(entities, users[0], {
          ...suspendData(users[0]),
          subscription_status: 'payment_failed',
        });
      }
    }
  } catch (err) {
    if (ledgerFinalized) {
      return rawRespond(500, { message: 'Internal error' });
    }
    return respond(500, { message: 'Internal error' });
  }

  return respond(200, { received: true });
}
