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

import { recordMockSubscription } from '../mocks/stripe.mjs';
import { stripeEnabled, verifyStripeSignatureHeader } from '../stripeGateway.mjs';
import { sendEmail, welcomeEmail } from '../email.mjs';

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

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data?.object || {};
      // Launch model (Max's direction, 13 July 2026): successful payment
      // AUTO-APPROVES. A pending account activates on checkout completion and
      // a payment-failure suspension is lifted — the admin-approval queue is
      // no longer a gate in the ordinary signup path. Two exclusions:
      // 'rejected' is never activated by payment (an admin rejection cannot
      // be bought around), and 'deactivated' (self-service account closure)
      // is not reopened by a stray billing event.
      const entitlement = {
        subscription_status: 'active',
        stripe_customer_id: s.customer,
        stripe_subscription_id: s.subscription,
        subscription_start_date: new Date().toISOString(),
      };
      const NEVER_ACTIVATE = new Set(['rejected', 'deactivated']);
      const dataFor = (existingUser) => (
        NEVER_ACTIVATE.has(existingUser?.account_status)
          ? entitlement
          : { ...entitlement, account_status: 'active' }
      );
      const maybeWelcome = (existingUser) => {
        if (!existingUser?.email) return;
        if (existingUser.account_status === 'active' || NEVER_ACTIVATE.has(existingUser.account_status)) return;
        sendEmail({ to: existingUser.email, ...welcomeEmail(existingUser.clinician_name || existingUser.full_name) }).catch(() => {});
      };
      let updated = false;

      if (!stripeEnabled() && s.customer && s.subscription) {
        // Mock mode only: record into the in-memory mock store so a later
        // syncStripeSubscription call can reconcile without a real API. In
        // real mode syncStripeSubscription reads api.stripe.com directly.
        const email = s.customer_email || s.customer_details?.email || null;
        recordMockSubscription({ customerId: s.customer, subscriptionId: s.subscription, status: 'active', email });
      }

      if (s.client_reference_id) {
        try {
          let existing = null;
          try {
            existing = await entities.User.get(s.client_reference_id);
          } catch {
            // Missing user falls through to the email lookup below.
          }
          if (existing) {
            await entities.User.update(s.client_reference_id, dataFor(existing));
            maybeWelcome(existing);
            updated = true;
          }
        } catch {
          // Fall through to email lookup, matching entry.ts's try/catch.
        }
      }

      if (!updated && (s.customer_email || s.customer_details?.email)) {
        const email = (s.customer_email || s.customer_details.email).toLowerCase();
        const users = await entities.User.filter({});
        const matchedUser = users?.find((u) => u.email?.toLowerCase() === email);
        if (matchedUser) {
          await entities.User.update(matchedUser.id, dataFor(matchedUser));
          maybeWelcome(matchedUser);
          updated = true;
        }
      }
    }

    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.paused') {
      const s = event.data?.object || {};
      const data = { account_status: 'suspended', subscription_status: 'cancelled' };
      if (s.metadata?.userId) {
        await entities.User.update(s.metadata.userId, data);
      } else if (s.metadata?.userEmail) {
        const users = await entities.User.filter({ email: s.metadata.userEmail });
        if (users?.length > 0) await entities.User.update(users[0].id, data);
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const users = await entities.User.filter({ stripe_customer_id: event.data?.object?.customer });
      if (users?.length > 0) {
        await entities.User.update(users[0].id, { account_status: 'suspended', subscription_status: 'payment_failed' });
      }
    }
  } catch (err) {
    return respond(500, { message: 'Internal error' });
  }

  return respond(200, { received: true });
}
