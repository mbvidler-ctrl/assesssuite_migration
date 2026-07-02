// Deterministic in-memory mock of the Stripe surfaces used by the captured
// Deno functions (createCheckoutSession, createPortalSession, stripeWebhook,
// syncStripeSubscription). No network calls of any kind — per Max's
// direction of 2 July 2026 recorded in the wire-protocol contract
// ("Stripe functions are fully mocked").
//
// The mock store is process-local and reset on server restart (adequate for
// local development / self-test; there is no persistence requirement in the
// contract for Stripe state beyond the User entitlement fields it writes).

import { randomUUID } from 'node:crypto';

/** customer_id -> { id, email, subscriptions: [{id, status, current_period_start}] } */
const customersByEmail = new Map();
const customersById = new Map();

function ensureCustomer(email) {
  const key = (email || '').toLowerCase();
  if (key && customersByEmail.has(key)) return customersByEmail.get(key);
  const customer = { id: `mock_cus_${randomUUID()}`, email: key || null, subscriptions: [] };
  if (key) customersByEmail.set(key, customer);
  customersById.set(customer.id, customer);
  return customer;
}

function findCustomerById(id) {
  return customersById.get(id) || null;
}

function findCustomerByEmail(email) {
  if (!email) return null;
  return customersByEmail.get(email.toLowerCase()) || null;
}

/**
 * Mocks POST https://api.stripe.com/v1/checkout/sessions.
 * Returns a fake checkout session object carrying the same fields
 * createCheckoutSession/entry.ts reads (`session.url`) plus enough state
 * (`customer`, `client_reference_id`, `subscription`) for the webhook mock to
 * reconcile later.
 */
export function createMockCheckoutSession({ priceId, userId, userEmail, successUrl, cancelUrl }) {
  const customer = ensureCustomer(userEmail);
  const sessionId = `mock_cs_${randomUUID()}`;
  const subscriptionId = `mock_sub_${randomUUID()}`;
  return {
    id: sessionId,
    object: 'checkout.session',
    mode: 'subscription',
    customer: customer.id,
    customer_email: userEmail || null,
    client_reference_id: userId || null,
    subscription: subscriptionId,
    metadata: { userId: userId || '', userEmail: userEmail || '' },
    success_url: successUrl || null,
    cancel_url: cancelUrl || null,
    price: priceId || null,
    url: `/mock-stripe/checkout/${sessionId}`,
  };
}

/**
 * Mocks POST https://api.stripe.com/v1/billing_portal/sessions.
 * Returns {url} pointing at a local mock billing-portal URL, per
 * createPortalSession/entry.ts (`Response.json({ url: session.url })`
 * equivalent).
 */
export function createMockPortalSession({ stripeCustomerId, returnUrl }) {
  const portalId = `mock_bps_${randomUUID()}`;
  return {
    id: portalId,
    object: 'billing_portal.session',
    customer: stripeCustomerId,
    return_url: returnUrl || null,
    url: `/mock-stripe/portal/${portalId}`,
  };
}

/**
 * Records (or updates) a subscription against the mock customer store, used
 * by the checkout.session.completed webhook handler so a later
 * syncStripeSubscription call can reconcile from mock state instead of a
 * real Stripe API call.
 */
export function recordMockSubscription({ customerId, subscriptionId, status = 'active', email }) {
  let customer = findCustomerById(customerId);
  if (!customer) {
    // The webhook's event.data.object.customer id may not already exist in
    // the mock store (e.g. a webhook delivered for a checkout session this
    // mock did not itself mint the customer id for). Register it now,
    // keyed by both id and email where available, so
    // findMockSubscriptionByEmail can still reconcile it afterwards — this
    // mirrors how a real Stripe webhook is the source of truth for customer
    // existence, not the local caller.
    customer = { id: customerId, email: (email || '').toLowerCase() || null, subscriptions: [] };
    customersById.set(customerId, customer);
    if (customer.email) customersByEmail.set(customer.email, customer);
  } else if (email && !customer.email) {
    customer.email = email.toLowerCase();
    customersByEmail.set(customer.email, customer);
  }
  let subscription = customer.subscriptions.find((s) => s.id === subscriptionId);
  if (!subscription) {
    subscription = {
      id: subscriptionId,
      status,
      current_period_start: Math.floor(Date.now() / 1000),
    };
    customer.subscriptions.push(subscription);
  } else {
    subscription.status = status;
  }
  return subscription;
}

/**
 * Mocks GET https://api.stripe.com/v1/customers?email=...&limit=1 followed
 * by GET https://api.stripe.com/v1/subscriptions?customer=...&limit=1, as
 * used by syncStripeSubscription/entry.ts. Returns null where no mock
 * customer/subscription exists yet (matching the 404 branches in entry.ts).
 */
export function findMockSubscriptionByEmail(email) {
  const customer = findCustomerByEmail(email);
  if (!customer || customer.subscriptions.length === 0) return null;
  const subscription = customer.subscriptions[customer.subscriptions.length - 1];
  return { customer, subscription };
}

export const _mockStripeStore = { customersByEmail, customersById };
