// Real Stripe adapter for the four ported payment functions
// (createCheckoutSession, createPortalSession, stripeWebhook,
// syncStripeSubscription). Zero new dependencies: built-in fetch against
// https://api.stripe.com with form-encoded bodies, and node:crypto for
// webhook signature verification.
//
// Mode selection is a single switch — stripeEnabled(), below. When it
// returns false (the default: PAYMENTS_ENABLED is not exactly 1, no
// STRIPE_SECRET_KEY, SELFTEST=1, or parity assurance mode), no code
// in this module is reachable from the four functions and the existing
// deterministic mock (server/mocks/stripe.mjs) serves everything, so the
// demo's behaviour is unchanged. When a key is supplied, each function
// switches to this adapter while writing the identical User entitlement
// shape the mock path writes (the mock's shapes are the contract — see
// docs/stripe/20260708-stripe-activation-runbook.md).
//
// The request surface deliberately covers only what the four functions
// need, mirroring the captured Base44 sources (base44/functions/*/entry.ts):
//   - POST /v1/checkout/sessions        (mode=subscription)
//   - GET  /v1/checkout/sessions/{id}
//   - POST /v1/billing_portal/sessions
//   - GET  /v1/customers?email=&limit=1
//   - GET  /v1/subscriptions?customer=&limit=
//   - GET  /v1/subscriptions/{id}
// Every request pins the reviewed API contract. Checkout also carries a
// server-generated integration identifier; neither value is accepted from
// browser input.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { capabilityEnabled } from './capabilityFlags.mjs';

const STRIPE_API_BASE = 'https://api.stripe.com';
export const STRIPE_API_VERSION = '2026-07-29.dahlia';
const REQUEST_TIMEOUT_MS = 20_000;
const WEBHOOK_TOLERANCE_SECONDS = 300; // 5 minutes, per Stripe's own default
const STRIPE_REQUEST_IDS = new WeakMap();
const CHECKOUT_INTENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CHECKOUT_IDEMPOTENCY_KEY_PATTERN = /^assesssuite_checkout_v1_[0-9a-f]{64}$/;

/**
 * True only when PAYMENTS_ENABLED is exactly 1, a real Stripe key is
 * configured, and this is neither a self-test nor parity-assurance run.
 * SELFTEST=1 and PARITY_ASSURANCE_MODE=1 always force the mock path regardless
 * of any inherited key, so those postures cannot touch the Stripe network.
 * Ordinary payment functions branch on this helper; the network sink repeats
 * the gate independently so a direct gateway import cannot bypass it.
 */
function paymentsGateEnabled(environment = process.env) {
  return capabilityEnabled('PAYMENTS_ENABLED', environment);
}

export function stripeEnabled(environment = process.env) {
  if (!paymentsGateEnabled(environment)) return false;
  const key = environment.STRIPE_SECRET_KEY;
  return typeof key === 'string' && key.trim() !== '';
}

/**
 * Error thrown for any non-2xx Stripe API response (or a missing key).
 * `message` carries Stripe's own error message where one was returned, so
 * the functions can surface it verbatim the way the captured entry.ts did
 * (`session.error?.message || "Stripe error"`).
 */
export class StripeApiError extends Error {
  constructor(message, { status = 0, code = null, type = null, requestId = null } = {}) {
    super(message);
    this.name = 'StripeApiError';
    this.status = status;
    this.code = code;
    this.type = type;
    this.requestId = requestId;
  }
}

/**
 * Minimal form-encoded request helper. `params` is an array of
 * [key, value] pairs (bracket notation written literally, e.g.
 * 'line_items[0][price]'), matching how the captured Deno functions built
 * their URLSearchParams. GET requests carry params in the query string.
 */
function formEncoded(params) {
  const search = new URLSearchParams();
  for (const [name, value] of params) {
    if (value === undefined || value === null || value === '') continue;
    search.append(name, String(value));
  }
  return search;
}

async function stripeRequest(method, apiPath, params = [], { idempotencyKey = null } = {}) {
  // Enforce the capability at the network sink as well as at every ordinary
  // caller's mode branch. An imported gateway method must never turn a secret
  // alone into authority for a real payment request.
  if (!paymentsGateEnabled()) {
    throw new StripeApiError('Real payment flows are disabled by PAYMENTS_ENABLED', {
      status: 0,
      code: 'payments_disabled',
    });
  }
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) {
    throw new StripeApiError('STRIPE_SECRET_KEY is not set', { status: 0 });
  }

  if (idempotencyKey !== null) {
    if (method !== 'POST') {
      throw new TypeError('Stripe idempotency keys are permitted only for POST requests');
    }
    if (!CHECKOUT_IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new TypeError('Stripe Checkout idempotency key is malformed');
    }
  }

  const search = formEncoded(params);

  let url = `${STRIPE_API_BASE}${apiPath}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
  if (method === 'GET') {
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  } else {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idempotencyKey) options.headers['Idempotency-Key'] = idempotencyKey;
    options.body = search.toString();
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    throw new StripeApiError(`Stripe API unreachable: ${err.message}`, { status: 0 });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body (should not happen against api.stripe.com); fall through.
  }

  if (!response.ok) {
    throw new StripeApiError(payload?.error?.message || `Stripe error (HTTP ${response.status})`, {
      status: response.status,
      code: payload?.error?.code || null,
      type: payload?.error?.type || null,
      requestId: response.headers.get('request-id'),
    });
  }
  if (payload && typeof payload === 'object') {
    STRIPE_REQUEST_IDS.set(payload, response.headers.get('request-id') || null);
  }
  return payload;
}

/** Returns the provider request id captured with a successful response. */
export function stripeRequestIdFor(payload) {
  return payload && typeof payload === 'object'
    ? STRIPE_REQUEST_IDS.get(payload) || null
    : null;
}

function requireCheckoutIntentId(checkoutIntentId) {
  if (!CHECKOUT_INTENT_ID_PATTERN.test(checkoutIntentId || '')) {
    throw new TypeError('Stripe Checkout intent id is malformed');
  }
}

function integrationSuffixForIntent(checkoutIntentId) {
  requireCheckoutIntentId(checkoutIntentId);
  return Array.from(createHash('sha256').update(checkoutIntentId).digest().subarray(0, 8), (byte) => (
    String.fromCharCode(97 + (byte % 26))
  )).join('');
}

/**
 * Provider idempotency namespace. The random persisted intent UUID prevents
 * reuse across user actions; the digest also binds account, app and price so
 * a corrupted row cannot silently redirect a retry to another commercial
 * object.
 */
export function checkoutIdempotencyKeyFor({ userId, appId, priceId, checkoutIntentId }) {
  requireCheckoutIntentId(checkoutIntentId);
  for (const [name, value] of Object.entries({ userId, appId, priceId })) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new TypeError(`Stripe Checkout ${name} is required`);
    }
  }
  const digest = createHash('sha256')
    .update(JSON.stringify(['assesssuite-checkout-v1', userId, appId, priceId, checkoutIntentId]))
    .digest('hex');
  return `assesssuite_checkout_v1_${digest}`;
}

function buildCheckoutSessionParams({
  priceId,
  userId,
  userEmail,
  successUrl,
  cancelUrl,
  appId,
  professionId,
  trialPeriodDays,
  qaSequence = null,
  checkoutIntentId,
}) {
  requireCheckoutIntentId(checkoutIntentId);
  if (
    qaSequence !== null
    && !/^assesssuite-physio-self-service-[0-9a-f]{12}$/.test(qaSequence)
  ) {
    throw new TypeError('Stripe QA sequence binding is malformed');
  }
  const integrationSuffix = integrationSuffixForIntent(checkoutIntentId);
  const params = [
    ['mode', 'subscription'],
    // A zero-due trial must still collect and attach a reusable payment
    // method for the controlled off-session validation and later renewal.
    ['payment_method_collection', 'always'],
    ['integration_identifier', `assesssuite_physio_${integrationSuffix}`],
    ['line_items[0][price]', priceId],
    ['line_items[0][quantity]', '1'],
    ['success_url', successUrl],
    ['cancel_url', cancelUrl],
    ['customer_email', userEmail],
    ['client_reference_id', userId],
    ['metadata[userId]', userId],
    ['metadata[userEmail]', userEmail],
    ['metadata[priceId]', priceId],
    ['metadata[appId]', appId],
    ['metadata[professionId]', professionId],
    ['metadata[checkoutIntentId]', checkoutIntentId],
    ['subscription_data[metadata][userId]', userId],
    ['subscription_data[metadata][userEmail]', userEmail],
    ['subscription_data[metadata][priceId]', priceId],
    ['subscription_data[metadata][appId]', appId],
    ['subscription_data[metadata][professionId]', professionId],
    ['subscription_data[metadata][checkoutIntentId]', checkoutIntentId],
    // Stripe-hosted Checkout validates the code and applies the discount.
    // No promotion value or discount amount is accepted from the browser.
    ['allow_promotion_codes', 'true'],
  ];
  if (qaSequence) {
    params.push(['metadata[qaSequence]', qaSequence]);
    params.push(['subscription_data[metadata][qaSequence]', qaSequence]);
  }
  if (trialPeriodDays !== undefined && trialPeriodDays !== null) {
    params.push(['subscription_data[trial_period_days]', trialPeriodDays]);
  }
  return params;
}

/** Hashes the exact Stripe form body together with the exact request key. */
export function checkoutSessionRequestSha256(args) {
  if (!CHECKOUT_IDEMPOTENCY_KEY_PATTERN.test(args.idempotencyKey || '')) {
    throw new TypeError('Stripe Checkout idempotency key is malformed');
  }
  const body = formEncoded(buildCheckoutSessionParams(args)).toString();
  return createHash('sha256')
    .update(`assesssuite-checkout-request-v1\n${args.idempotencyKey}\n${body}`)
    .digest('hex');
}

/**
 * POST /v1/checkout/sessions — subscription-mode checkout session.
 * Parameter set mirrors base44/functions/createCheckoutSession/entry.ts
 * exactly (including the metadata and subscription_data metadata the
 * webhook's customer.subscription.* handlers rely on to find the user).
 * Returns the full session object; callers read `session.url`.
 */
export async function createCheckoutSession({
  priceId,
  userId,
  userEmail,
  successUrl,
  cancelUrl,
  appId,
  professionId,
  trialPeriodDays,
  qaSequence = null,
  checkoutIntentId,
  idempotencyKey,
}) {
  const params = buildCheckoutSessionParams({
    priceId,
    userId,
    userEmail,
    successUrl,
    cancelUrl,
    appId,
    professionId,
    trialPeriodDays,
    qaSequence,
    checkoutIntentId,
  });
  return stripeRequest('POST', '/v1/checkout/sessions', params, { idempotencyKey });
}

/** GET /v1/checkout/sessions/{id} — reconciles a durable creation intent. */
export async function retrieveCheckoutSession(checkoutSessionId) {
  if (typeof checkoutSessionId !== 'string' || !/^cs_[A-Za-z0-9_]+$/.test(checkoutSessionId)) {
    throw new TypeError('Stripe Checkout Session id is malformed');
  }
  return stripeRequest('GET', `/v1/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`);
}

/** Lists the promotion codes and coupons needed by the admin surface. */
export async function listPromotionCodes({ limit = 100 } = {}) {
  const [promotionCodes, coupons] = await Promise.all([
    stripeRequest('GET', '/v1/promotion_codes', [['limit', limit]]),
    stripeRequest('GET', '/v1/coupons', [['limit', limit]]),
  ]);
  return {
    promotionCodes: promotionCodes?.data || [],
    coupons: coupons?.data || [],
    hasMore: Boolean(promotionCodes?.has_more || coupons?.has_more),
  };
}

/** Creates the discount definition that a customer-facing promotion uses. */
export async function createCoupon({
  name,
  duration,
  percentOff,
  amountOff,
  currency = 'aud',
  metadata = {},
}) {
  const params = [
    ['name', name],
    ['duration', duration],
  ];
  if (percentOff != null) params.push(['percent_off', percentOff]);
  if (amountOff != null) {
    params.push(['amount_off', amountOff]);
    params.push(['currency', currency]);
  }
  for (const [key, value] of Object.entries(metadata)) {
    params.push([`metadata[${key}]`, value]);
  }
  return stripeRequest('POST', '/v1/coupons', params);
}

/** Creates a current-API promotion code backed by a coupon. */
export async function createPromotionCode({
  couponId,
  code,
  maxRedemptions,
  expiresAt,
  firstTimeOnly = false,
  minimumAmount,
  currency = 'aud',
  metadata = {},
}) {
  const params = [
    ['promotion[type]', 'coupon'],
    ['promotion[coupon]', couponId],
    ['code', code],
    ['active', 'true'],
    ['max_redemptions', maxRedemptions],
    ['expires_at', expiresAt],
    ['restrictions[first_time_transaction]', firstTimeOnly ? 'true' : 'false'],
  ];
  if (minimumAmount != null) {
    params.push(['restrictions[minimum_amount]', minimumAmount]);
    params.push(['restrictions[minimum_amount_currency]', currency]);
  }
  for (const [key, value] of Object.entries(metadata)) {
    params.push([`metadata[${key}]`, value]);
  }
  return stripeRequest('POST', '/v1/promotion_codes', params);
}

/** Promotion codes are retired rather than deleted, preserving their history. */
export async function deactivatePromotionCode(promotionCodeId) {
  return stripeRequest(
    'POST',
    `/v1/promotion_codes/${encodeURIComponent(promotionCodeId)}`,
    [['active', 'false']],
  );
}

/** Best-effort rollback for a coupon whose promotion-code creation failed. */
export async function deleteCoupon(couponId) {
  return stripeRequest('DELETE', `/v1/coupons/${encodeURIComponent(couponId)}`);
}

/**
 * POST /v1/billing_portal/sessions — customer billing portal.
 * When `flow` is provided ('subscription_update' | 'payment_method_update'),
 * flow_data[type] is added so the portal opens directly on that flow; the
 * pair is omitted entirely when `flow` is absent (stripeRequest drops empty
 * values), preserving the plain-portal behaviour.
 * Returns the full session object; callers read `session.url`.
 */
export async function createPortalSession({ stripeCustomerId, returnUrl, flow, subscriptionId }) {
  const params = [
    ['customer', stripeCustomerId],
    ['return_url', returnUrl],
  ];
  // Stripe requires the subscription id inside flow_data[subscription_update]
  // whenever the flow type is 'subscription_update'; sending the type alone is
  // a 400. Only request that flow when the id is available — otherwise fall
  // back to the plain portal rather than error a subscription-less caller.
  if (flow === 'subscription_update') {
    if (subscriptionId) {
      params.push(['flow_data[type]', 'subscription_update']);
      params.push(['flow_data[subscription_update][subscription]', subscriptionId]);
    }
  } else if (flow) {
    params.push(['flow_data[type]', flow]);
  }
  return stripeRequest('POST', '/v1/billing_portal/sessions', params);
}

/**
 * DELETE /v1/subscriptions/{id} — cancels a subscription immediately.
 * Returns the cancelled subscription object (status 'canceled').
 */
export async function cancelSubscription(subscriptionId) {
  return stripeRequest('DELETE', `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

/**
 * GET /v1/customers?email=&limit=1 — returns the first matching customer
 * object, or null where none exists (matching the 404 branch in
 * base44/functions/syncStripeSubscription/entry.ts).
 */
export async function findCustomerByEmail(email) {
  const result = await stripeRequest('GET', '/v1/customers', [
    ['email', email],
    ['limit', '1'],
  ]);
  return result?.data?.[0] || null;
}

/**
 * GET /v1/subscriptions?customer=&limit= — returns an array (possibly
 * empty) of subscription objects for the customer. Stripe's default status
 * filter applies (canceled subscriptions are excluded), matching the
 * captured syncStripeSubscription behaviour.
 */
export async function listSubscriptionsForCustomer(customerId, limit = 1) {
  const result = await stripeRequest('GET', '/v1/subscriptions', [
    ['customer', customerId],
    ['limit', String(limit)],
  ]);
  return result?.data || [];
}

/** GET /v1/subscriptions/{id} — retrieves a single subscription object. */
export async function retrieveSubscription(subscriptionId) {
  return stripeRequest('GET', `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

/**
 * Verifies a Stripe webhook signature (Stripe-Signature header, scheme v1)
 * against the RAW request body bytes using HMAC-SHA256 with the endpoint's
 * signing secret. Pure function of its inputs — no environment reads — so
 * it is directly unit-testable without a key.
 *
 * Header format: `t=<unix seconds>,v1=<hex>[,v1=<hex>...][,v0=...]`.
 * Multiple v1 values are accepted (Stripe sends more than one while a
 * secret is being rolled); any single match passes. Comparison is
 * timing-safe; timestamps more than `toleranceSeconds` (default 300) from
 * now are rejected to blunt replay.
 *
 * Returns { ok: true } or { ok: false, reason } — the caller decides the
 * HTTP response.
 */
export function verifyStripeSignatureHeader({
  rawBody,
  signatureHeader,
  secret,
  toleranceSeconds = WEBHOOK_TOLERANCE_SECONDS,
  nowMs = Date.now(),
}) {
  if (!secret) return { ok: false, reason: 'no signing secret provided' };
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { ok: false, reason: 'missing Stripe-Signature header' };
  }

  let timestamp = null;
  const candidates = [];
  for (const part of signatureHeader.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name === 't') timestamp = value;
    else if (name === 'v1') candidates.push(value);
  }

  if (!timestamp || !/^\d+$/.test(timestamp)) {
    return { ok: false, reason: 'missing or malformed timestamp' };
  }
  if (candidates.length === 0) {
    return { ok: false, reason: 'no v1 signature in header' };
  }

  const skewSeconds = Math.abs(nowMs / 1000 - Number(timestamp));
  if (skewSeconds > toleranceSeconds) {
    return { ok: false, reason: 'timestamp outside tolerance (possible replay)' };
  }

  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8');
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(bodyBuffer).digest();

  for (const candidate of candidates) {
    // Guard the hex decode: Buffer.from silently truncates invalid hex,
    // which would defeat the length check below.
    if (!/^[0-9a-f]+$/i.test(candidate)) continue;
    const candidateBuffer = Buffer.from(candidate, 'hex');
    if (candidateBuffer.length === expected.length && timingSafeEqual(candidateBuffer, expected)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: 'signature mismatch' };
}
