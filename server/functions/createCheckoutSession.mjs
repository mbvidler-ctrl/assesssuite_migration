// Ported from base44/functions/createCheckoutSession/entry.ts.
//
// Production has one mode: subscription Checkout created against Stripe via
// the server-owned provider adapter. Isolated tests may inject their adapter
// through ctx, but no fake provider is imported by or shipped with this
// runnable module. The response shape remains { url } on 200. The migration hardens the captured
// method-only route: checkout requires an authenticated, currently unlinked
// account and derives identity, price and redirects exclusively server-side.

import { randomUUID } from 'node:crypto';

import { resolveActiveProfessionContract } from '../../packages/profession-config/runtime.mjs';
import { resolvePublicRequestOrigin } from '../publicRequestOrigin.mjs';
import {
  resolveStripeProvider,
  stripeProviderReady,
} from '../providers/stripeProduction.mjs';

const CHECKOUT_ELIGIBLE_SUBSCRIPTION_STATUSES = new Set([
  '',
  'inactive',
  'cancelled',
  'canceled',
  'none',
]);
const SELF_SERVICE_QA_EMAIL_PATTERN = /^[^@\s+]+\+assesssuite-physio-self-service-([0-9a-f]{12})@[^@\s]+$/i;
const STRIPE_IDEMPOTENCY_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;

export function selfServiceQaSequenceForEmail(email) {
  const match = String(email || '').trim().match(SELF_SERVICE_QA_EMAIL_PATTERN);
  return match
    ? `assesssuite-physio-self-service-${match[1].toLowerCase()}`
    : null;
}

function configuredTrialPeriodDays(environment, { required = false } = {}) {
  const raw = typeof environment.STRIPE_TRIAL_PERIOD_DAYS === 'string'
    ? environment.STRIPE_TRIAL_PERIOD_DAYS.trim()
    : '';
  if (!raw) {
    if (required) {
      throw new TypeError('STRIPE_TRIAL_PERIOD_DAYS must be configured for Physio checkout');
    }
    return null;
  }
  if (!/^\d+$/.test(raw)) {
    throw new TypeError('STRIPE_TRIAL_PERIOD_DAYS must be a whole number of days');
  }
  const days = Number(raw);
  if (!Number.isSafeInteger(days) || days < 1 || days > 365) {
    throw new TypeError('STRIPE_TRIAL_PERIOD_DAYS must be between 1 and 365');
  }
  return days;
}

function checkoutRequestForIntent(intent) {
  return {
    priceId: intent.priceId,
    userId: intent.userId,
    userEmail: intent.userEmail,
    successUrl: intent.successUrl,
    cancelUrl: intent.cancelUrl,
    appId: intent.appId,
    professionId: intent.professionId,
    trialPeriodDays: intent.trialPeriodDays,
    qaSequence: intent.qaSequence,
    checkoutIntentId: intent.id,
    idempotencyKey: intent.idempotencyKey,
  };
}

function checkoutIntentCandidate({
  userId,
  userEmail,
  appId,
  professionId,
  priceId,
  plan,
  successUrl,
  cancelUrl,
  trialPeriodDays,
  qaSequence,
}, provider) {
  const id = randomUUID();
  const idempotencyKey = provider.checkoutIdempotencyKeyFor({
    userId,
    appId,
    priceId,
    checkoutIntentId: id,
  });
  const candidate = {
    id,
    idempotencyKey,
    userId,
    userEmail,
    appId,
    professionId,
    priceId,
    plan,
    successUrl,
    cancelUrl,
    trialPeriodDays,
    qaSequence,
  };
  return Object.freeze({
    ...candidate,
    requestSha256: provider.checkoutSessionRequestSha256(
      checkoutRequestForIntent(candidate),
    ),
  });
}

function nullableEqual(left, right) {
  return (left ?? null) === (right ?? null);
}

function checkoutIntentMatchesRequest(intent, expected, provider) {
  const semanticFields = [
    'userId',
    'userEmail',
    'appId',
    'professionId',
    'priceId',
    'plan',
    'successUrl',
    'cancelUrl',
    'trialPeriodDays',
    'qaSequence',
  ];
  if (semanticFields.some((field) => !nullableEqual(intent[field], expected[field]))) return false;

  const expectedKey = provider.checkoutIdempotencyKeyFor({
    userId: intent.userId,
    appId: intent.appId,
    priceId: intent.priceId,
    checkoutIntentId: intent.id,
  });
  if (intent.idempotencyKey !== expectedKey) return false;
  return intent.requestSha256 === provider.checkoutSessionRequestSha256(
    checkoutRequestForIntent(intent),
  );
}

function providerSessionBindingError(session, intent) {
  if (!session || typeof session !== 'object') return 'missing Checkout Session response';
  if (typeof session.id !== 'string' || !/^cs_[A-Za-z0-9_]+$/.test(session.id)) {
    return 'invalid Checkout Session id';
  }
  if (!['open', 'complete', 'expired'].includes(session.status)) {
    return 'invalid Checkout Session status';
  }
  if (session.status === 'open' && (typeof session.url !== 'string' || session.url === '')) {
    return 'open Checkout Session has no URL';
  }
  const sessionEmail = session.customer_email || session.customer_details?.email || null;
  const expectedMetadata = {
    userId: intent.userId,
    userEmail: intent.userEmail,
    priceId: intent.priceId,
    appId: intent.appId,
    professionId: intent.professionId,
    checkoutIntentId: intent.id,
    qaSequence: intent.qaSequence,
  };
  if (session.client_reference_id !== intent.userId) return 'client reference does not match intent';
  if (sessionEmail !== intent.userEmail) return 'customer email does not match intent';
  for (const [field, expected] of Object.entries(expectedMetadata)) {
    if (!nullableEqual(session.metadata?.[field], expected)) {
      return `metadata ${field} does not match intent`;
    }
  }
  return null;
}

function intentIsTooOldToRetry(intent, nowMs = Date.now()) {
  const createdMs = Date.parse(intent.createdAt);
  return !Number.isFinite(createdMs) || nowMs - createdMs >= STRIPE_IDEMPOTENCY_RETRY_WINDOW_MS;
}

function providerApiError(error, provider) {
  return typeof provider.errorClass === 'function' && error instanceof provider.errorClass;
}

function providerOutcomeIsIndeterminate(error, provider) {
  return providerApiError(error, provider) && (
    error.status === 0
    || error.status === 408
    || error.status === 409
    || error.status === 429
    || error.status >= 500
    || error.type === 'idempotency_error'
    || error.code === 'idempotency_key_in_use'
  );
}

function checkoutError(respond, status, code, error, retryable = false) {
  return respond(status, { error, code, ...(retryable ? { retryable: true } : {}) });
}

export default async function createCheckoutSession(ctx) {
  const { body, user, respond } = ctx;
  if (!user) {
    return respond(401, { error: 'authentication required' });
  }
  const plan = body?.plan;
  if (plan !== 'monthly' && plan !== 'annual') {
    return respond(400, { error: 'Plan must be monthly or annual.' });
  }

  const linkedSubscriptionId = typeof user.stripe_subscription_id === 'string'
    ? user.stripe_subscription_id.trim()
    : '';
  const subscriptionStatus = typeof user.subscription_status === 'string'
    ? user.subscription_status.trim().toLowerCase()
    : '';
  if (linkedSubscriptionId || !CHECKOUT_ELIGIBLE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {
    return respond(409, {
      error: 'An existing subscription must be managed through the billing portal.',
    });
  }

  // Price, identity and redirect targets are authorization/integrity inputs.
  // Resolve them only from trusted server state, never caller-controlled JSON.
  const userId = user.id;
  const userEmail = user.email;
  let appUrl;
  try {
    appUrl = resolvePublicRequestOrigin({ request: ctx.request, environment: process.env });
  } catch (error) {
    return checkoutError(respond, 400, error.code || 'public_request_origin_rejected', error.message);
  }
  const successUrl = `${appUrl}/PaymentRequired?checkout_return=1`;
  const cancelUrl = `${appUrl}/PaymentRequired`;

  let provider;
  try {
    provider = resolveStripeProvider(ctx.stripeProvider, process.env);
  } catch (error) {
    return checkoutError(respond, 500, 'stripe_provider_invalid', error.message);
  }
  if (!stripeProviderReady(provider, process.env)) {
    return checkoutError(
      respond,
      503,
      'stripe_provider_unavailable',
      'Stripe Checkout is unavailable because the payment provider is not configured.',
      true,
    );
  }

  try {
    // Prices come only from the environment or the explicitly injected test
    // provider; the browser may select only the allowlisted plan name.
    // captured ids belong to the client's original account and will not exist
    // in a fresh test-mode account, so set STRIPE_PRICE_ID_* and invoke with
    // the allowlisted plan name.
    const configuredPrice = plan === 'annual'
      ? process.env.STRIPE_PRICE_ID_ANNUAL
      : process.env.STRIPE_PRICE_ID_MONTHLY;
    const priceId = typeof provider.priceIdForPlan === 'function'
      ? provider.priceIdForPlan(plan, process.env)
      : configuredPrice || null;
    if (!priceId) {
      return respond(500, {
        error:
          'Stripe price not configured: set STRIPE_PRICE_ID_MONTHLY / STRIPE_PRICE_ID_ANNUAL.',
      });
    }
    const activeContract = resolveActiveProfessionContract(process.env);
      // The only QA correlation accepted by Stripe is derived from the
      // authenticated account email. Caller JSON cannot opt an ordinary user
      // into the controlled live self-service sequence or select its value.
      const qaSequence = selfServiceQaSequenceForEmail(userEmail);
      const trialPeriodDays = typeof provider.trialPeriodDays === 'function'
        ? provider.trialPeriodDays(activeContract, process.env)
        : configuredTrialPeriodDays(process.env, {
            required: activeContract.professionId === 'physio',
          });
      if (!ctx.checkoutIntents) {
        return checkoutError(
          respond,
          500,
          'checkout_intent_store_unavailable',
          'Stripe Checkout intent persistence is unavailable.',
        );
      }

      const requestBinding = {
        userId,
        userEmail,
        appId: activeContract.appId,
        professionId: activeContract.professionId,
        priceId,
        plan,
        successUrl,
        cancelUrl,
        trialPeriodDays,
        qaSequence,
      };

      // At most one rotation is possible in a request, and only after Stripe
      // has positively reported that the previous bound session is expired.
      for (let rotation = 0; rotation < 2; rotation += 1) {
        const candidate = checkoutIntentCandidate(requestBinding, provider);
        const { intent } = ctx.checkoutIntents.acquire(candidate);
        if (!checkoutIntentMatchesRequest(intent, requestBinding, provider)) {
          return checkoutError(
            respond,
            409,
            'checkout_intent_binding_conflict',
            'An existing Checkout intent is bound to different account, application or pricing inputs.',
          );
        }

        if (intent.state === 'completed') {
          return checkoutError(
            respond,
            409,
            'checkout_already_complete',
            'This Checkout intent has already completed.',
          );
        }

        if (intent.state === 'created') {
          try {
            const session = await provider.retrieveCheckoutSession(intent.stripeSessionId);
            const bindingError = providerSessionBindingError(session, intent);
            if (bindingError) {
              return checkoutError(
                respond,
                502,
                'checkout_provider_binding_mismatch',
                `Stripe returned a Checkout Session with a wrong binding: ${bindingError}.`,
              );
            }
            const observed = ctx.checkoutIntents.markObserved(
              intent.id,
              session,
              provider.stripeRequestIdFor(session),
            );
            if (observed.state === 'created') return respond(200, { url: observed.stripeSessionUrl });
            if (observed.state === 'completed') {
              return checkoutError(
                respond,
                409,
                'checkout_already_complete',
                'This Checkout intent has already completed.',
              );
            }
            // `unusable` is the only provider-proven state that permits a new
            // UUID/key. Continue once and acquire a brand-new durable intent.
            continue;
          } catch (error) {
            if (providerApiError(error, provider)) {
              return checkoutError(
                respond,
                providerOutcomeIsIndeterminate(error, provider) ? 503 : 502,
                'checkout_reconciliation_unavailable',
                'The existing Checkout Session could not be reconciled with Stripe.',
                providerOutcomeIsIndeterminate(error, provider),
              );
            }
            throw error;
          }
        }

        if (!['prepared', 'response_unknown'].includes(intent.state)) {
          return checkoutError(
            respond,
            409,
            'checkout_intent_not_reusable',
            'The Checkout intent cannot be reused.',
          );
        }
        if (intentIsTooOldToRetry(intent)) {
          return checkoutError(
            respond,
            409,
            'checkout_intent_reconciliation_required',
            'The uncertain Checkout intent is too old for an automatic idempotent retry.',
          );
        }

        try {
          const session = await provider.createCheckoutSession(checkoutRequestForIntent(intent));
          const bindingError = providerSessionBindingError(session, intent);
          if (bindingError) {
            ctx.checkoutIntents.markResponseUnknown(intent.id, {
              requestId: provider.stripeRequestIdFor(session),
              sessionId: typeof session?.id === 'string' ? session.id : null,
              sessionStatus: ['open', 'complete', 'expired'].includes(session?.status)
                ? session.status
                : null,
              sessionExpiresAt: Number.isSafeInteger(session?.expires_at)
                ? session.expires_at
                : null,
              code: 'provider_binding_mismatch',
            });
            return checkoutError(
              respond,
              502,
              'checkout_provider_binding_mismatch',
              `Stripe returned a Checkout Session with a wrong binding: ${bindingError}.`,
            );
          }
          const stored = ctx.checkoutIntents.markCreated(
            intent.id,
            session,
            provider.stripeRequestIdFor(session),
          );
          if (stored.state === 'created') return respond(200, { url: stored.stripeSessionUrl });
          if (stored.state === 'completed') {
            return checkoutError(
              respond,
              409,
              'checkout_already_complete',
              'This Checkout intent has already completed.',
            );
          }
          continue;
        } catch (error) {
          if (!providerApiError(error, provider)) throw error;
          if (providerOutcomeIsIndeterminate(error, provider)) {
            ctx.checkoutIntents.markResponseUnknown(intent.id, {
              status: error.status,
              code: error.code || error.type,
              requestId: error.requestId,
            });
            return checkoutError(
              respond,
              503,
              'checkout_provider_outcome_unknown',
              'Stripe Checkout creation has an uncertain outcome; retry will reuse the same request.',
              true,
            );
          }
          ctx.checkoutIntents.markFailed(intent.id, {
            status: error.status,
            code: error.code || error.type,
            requestId: error.requestId,
          });
          return checkoutError(
            respond,
            502,
            'checkout_provider_rejected',
            error.message,
          );
        }
      }

    return checkoutError(
      respond,
      409,
      'checkout_intent_rotation_exhausted',
      'Stripe returned an unusable Checkout Session twice; no further session was created.',
    );
  } catch (err) {
    return respond(500, { error: err.message });
  }
}
