// Real Stripe adapter for the four ported payment functions
// (createCheckoutSession, createPortalSession, stripeWebhook,
// syncStripeSubscription). Zero new dependencies: built-in fetch against
// https://api.stripe.com with form-encoded bodies, and node:crypto for
// webhook signature verification.
//
// Mode selection is a single switch — stripeEnabled(), below. When it
// returns false (the default: no STRIPE_SECRET_KEY, or SELFTEST=1), no code
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
//   - POST /v1/billing_portal/sessions
//   - GET  /v1/customers?email=&limit=1
//   - GET  /v1/subscriptions?customer=&limit=
//   - GET  /v1/subscriptions/{id}
// No Stripe-Version header is pinned, matching the captured functions
// (the account's default API version applies).

import { createHmac, timingSafeEqual } from 'node:crypto';

const STRIPE_API_BASE = 'https://api.stripe.com';
const REQUEST_TIMEOUT_MS = 20_000;
const WEBHOOK_TOLERANCE_SECONDS = 300; // 5 minutes, per Stripe's own default

/**
 * True only when a real Stripe key is configured AND this is not a
 * self-test run. SELFTEST=1 always forces the mock path regardless of any
 * key present in the environment, so `npm run selftest` can never touch the
 * network. This is the single mode switch — the four functions branch on
 * this helper and nothing else.
 */
export function stripeEnabled() {
  if (process.env.SELFTEST === '1') return false;
  const key = process.env.STRIPE_SECRET_KEY;
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
async function stripeRequest(method, apiPath, params = []) {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) {
    throw new StripeApiError('STRIPE_SECRET_KEY is not set', { status: 0 });
  }

  const search = new URLSearchParams();
  for (const [name, value] of params) {
    if (value === undefined || value === null || value === '') continue;
    search.append(name, String(value));
  }

  let url = `${STRIPE_API_BASE}${apiPath}`;
  const options = {
    method,
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
  if (method === 'GET') {
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  } else {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
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
  return payload;
}

/**
 * POST /v1/checkout/sessions — subscription-mode checkout session.
 * Parameter set mirrors base44/functions/createCheckoutSession/entry.ts
 * exactly (including the metadata and subscription_data metadata the
 * webhook's customer.subscription.* handlers rely on to find the user).
 * Returns the full session object; callers read `session.url`.
 */
export async function createCheckoutSession({ priceId, userId, userEmail, successUrl, cancelUrl }) {
  return stripeRequest('POST', '/v1/checkout/sessions', [
    ['mode', 'subscription'],
    ['line_items[0][price]', priceId],
    ['line_items[0][quantity]', '1'],
    ['success_url', successUrl],
    ['cancel_url', cancelUrl],
    ['customer_email', userEmail],
    ['client_reference_id', userId],
    ['metadata[userId]', userId],
    ['metadata[userEmail]', userEmail],
    ['subscription_data[metadata][userId]', userId],
    ['subscription_data[metadata][userEmail]', userEmail],
  ]);
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
