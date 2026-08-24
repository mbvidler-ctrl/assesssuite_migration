import {
  SELF_SERVICE_STRIPE_API_VERSION,
  assertExactKeys,
  canonicalJson,
  sha256,
} from './self-service-contract.mjs';

const STRIPE_ORIGIN = 'https://api.stripe.com';
const STRIPE_REQUEST_ID = /^req_[A-Za-z0-9]{6,120}$/;
const STRIPE_LIST_ITEM_ID = /^[A-Za-z0-9_]{3,255}$/;
const STRIPE_MAX_LIST_PAGES = 100;
const STRIPE_MAX_LIST_ITEMS = 10_000;
const CUSTOMER_ID = /^cus_[A-Za-z0-9]{6,160}$/;
const SUBSCRIPTION_ID = /^sub_[A-Za-z0-9]{6,160}$/;
const CHARGE_ID = /^ch_[A-Za-z0-9]{6,160}$/;
const REFUND_ID = /^re_[A-Za-z0-9]{6,160}$/;
const CHECKOUT_SESSION_ID = /^cs_live_[A-Za-z0-9]{6,200}$/;
const PAYMENT_METHOD_ID = /^pm_[A-Za-z0-9]{6,200}$/;
const PAYMENT_INTENT_ID = /^pi_[A-Za-z0-9]{6,180}$/;
const LIVE_VALIDATION_PURPOSE = 'assesssuite_physio_live_payment_validation';

export const STRIPE_READBACK_RECEIPT_KEYS = Object.freeze([
  'actual_charge_aud_cents',
  'annual_interval',
  'annual_lookup_key',
  'annual_price_id',
  'annual_unit_amount',
  'api_version',
  'app_id',
  'binding_fingerprint_sha256',
  'captured_charge_count',
  'checkout_amount_total_aud_cents',
  'checkout_payment_method_collection',
  'checkout_session_id_sha256',
  'contract_version',
  'currency',
  'default_payment_method_id_sha256',
  'default_payment_method_source',
  'customer_id_sha256',
  'interval',
  'livemode',
  'observed_at',
  'price_id',
  'price_lookup_key',
  'product_id',
  'product_lookup_key',
  'product_name',
  'profession_id',
  'provider',
  'provider_request_ids_sha256',
  'qa_sequence_sha256',
  'result',
  'subscription_id_sha256',
  'subscription_status',
  'trial_days',
  'unit_amount',
]);

const CANCELLATION_RECEIPT_KEYS = Object.freeze([
  'binding_fingerprint_sha256',
  'cancelled_during_trial',
  'contract_version',
  'customer_id_sha256',
  'livemode',
  'observed_at',
  'provider',
  'provider_request_ids_sha256',
  'result',
  'subscription_id_sha256',
  'subscription_status',
  'ui_cancellation_confirmed',
]);

const REFUND_RECEIPT_KEYS = Object.freeze([
  'actual_charge_aud_cents',
  'binding_fingerprint_sha256',
  'contract_version',
  'customer_id_sha256',
  'livemode',
  'observed_at',
  'provider',
  'provider_request_ids_sha256',
  'refunded_aud_cents',
  'refunded_charge_count',
  'result',
]);

const INCOMPLETE_CHECKOUT_CLEANUP_RECEIPT_KEYS = Object.freeze([
  'binding_fingerprint_sha256',
  'captured_charge_count',
  'checkout_session_id_sha256',
  'checkout_status',
  'contract_version',
  'customer_id_sha256',
  'livemode',
  'observed_at',
  'price_id',
  'product_id',
  'provider',
  'provider_request_ids_sha256',
  'qa_sequence_sha256',
  'result',
  'subscription_status',
]);

function providerRequestId(response) {
  const value = String(response.headers.get('request-id') || '').trim();
  if (!STRIPE_REQUEST_ID.test(value)) {
    throw new TypeError('Stripe did not return a valid provider request identifier');
  }
  return value;
}

async function stripeRequest(configuration, method, route, form = null, idempotencyKey = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${STRIPE_ORIGIN}${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${configuration.stripeSecretKey}`,
        'Stripe-Version': SELF_SERVICE_STRIPE_API_VERSION,
        ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      ...(form ? { body: new URLSearchParams(form) } : {}),
      signal: controller.signal,
    });
    const requestId = providerRequestId(response);
    if (response.status < 200 || response.status >= 300) {
      throw new TypeError(`Stripe provider call failed with status ${response.status}`);
    }
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new TypeError('Stripe provider call returned an invalid response');
    }
    return { body, requestId };
  } finally {
    clearTimeout(timer);
  }
}

async function stripeListAll(configuration, initialRoute, requestIds, label) {
  if (!initialRoute.startsWith('/v1/') || initialRoute.includes('starting_after=')) {
    throw new TypeError(`${label} route is invalid`);
  }
  const items = [];
  const seenIds = new Set();
  let route = initialRoute;
  for (let page = 0; page < STRIPE_MAX_LIST_PAGES; page += 1) {
    const response = await stripeRequest(configuration, 'GET', route);
    requestIds.push(response.requestId);
    if (
      !Array.isArray(response.body.data)
      || response.body.data.length > 100
      || typeof response.body.has_more !== 'boolean'
    ) {
      throw new TypeError(`${label} returned an invalid Stripe list envelope`);
    }
    for (const item of response.body.data) {
      if (
        !item
        || typeof item !== 'object'
        || Array.isArray(item)
        || !STRIPE_LIST_ITEM_ID.test(item.id || '')
        || seenIds.has(item.id)
      ) {
        throw new TypeError(`${label} returned an invalid or duplicate Stripe object`);
      }
      seenIds.add(item.id);
      items.push(item);
      if (items.length > STRIPE_MAX_LIST_ITEMS) {
        throw new TypeError(`${label} exceeded the bounded complete result set`);
      }
    }
    if (response.body.has_more === false) return items;
    const cursor = response.body.data.at(-1)?.id;
    if (!STRIPE_LIST_ITEM_ID.test(cursor || '')) {
      throw new TypeError(`${label} pagination did not advance`);
    }
    const next = new URL(`${STRIPE_ORIGIN}${initialRoute}`);
    next.searchParams.set('starting_after', cursor);
    route = `${next.pathname}${next.search}`;
  }
  throw new TypeError(`${label} exceeded the bounded page count`);
}

function mutationIdempotencyKey(action, configuration, binding, resourceId) {
  return `assesssuite_physio_${action}_${sha256(canonicalJson({
    app_id: configuration.appId,
    l5_intent_id: configuration.l5IntentId,
    qa_sequence: configuration.sequenceId,
    binding_fingerprint_sha256: binding.fingerprint,
    resource_id_sha256: sha256(resourceId),
  }))}`;
}

function exactLiveObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.livemode !== true) {
    throw new TypeError(`${label} is not a live Stripe object`);
  }
  return value;
}

function providerRequestDigest(requestIds) {
  if (!Array.isArray(requestIds) || requestIds.length === 0 || requestIds.some((id) => !STRIPE_REQUEST_ID.test(id))) {
    throw new TypeError('Stripe request evidence is incomplete');
  }
  return sha256(canonicalJson([...requestIds].sort()));
}

function withinCreationWindow(value, notBeforeMs) {
  const created = Number(value?.created);
  return Number.isSafeInteger(created)
    && created >= Math.floor((notBeforeMs - 60_000) / 1000)
    && created <= Math.floor((Date.now() + 60_000) / 1000);
}

function exactMetadata(metadata, configuration, userId) {
  return metadata?.userId === userId
    && metadata?.userEmail?.toLowerCase() === configuration.email
    && metadata?.priceId === configuration.stripePriceId
    && metadata?.appId === configuration.appId
    && metadata?.professionId === configuration.professionId
    && metadata?.qaSequence === configuration.sequenceId;
}

function exactItem(subscription, configuration) {
  const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  return items.length === 1
    && items[0]?.price?.id === configuration.stripePriceId
    && items[0]?.price?.product === configuration.stripeProductId;
}

function invoiceSubscriptionId(invoice) {
  const candidate = invoice?.subscription
    || invoice?.subscription_details?.subscription
    || invoice?.parent?.subscription_details?.subscription;
  return typeof candidate === 'object' ? candidate.id : candidate;
}

function invoiceSubscriptionMetadata(invoice) {
  return invoice?.parent?.subscription_details?.metadata
    || invoice?.subscription_details?.metadata
    || null;
}

async function listExactBoundCharges(configuration, binding, requestIds) {
  const charges = await stripeListAll(
    configuration,
    `/v1/charges?customer=${encodeURIComponent(binding.customerId)}&limit=100`,
    requestIds,
    'Stripe charge readback',
  );
  const recent = charges.filter((charge) => (
    charge?.livemode === true
    && withinCreationWindow(charge, binding.notBeforeMs)
    && charge.paid === true
    && charge.status === 'succeeded'
    && Number.isSafeInteger(charge.amount_captured)
    && charge.amount_captured > 0
  ));
  const bound = [];
  for (const charge of recent) {
    if (!charge.invoice) {
      if (
        !CHARGE_ID.test(charge.id || '')
        || charge.customer !== binding.customerId
        || charge.currency !== 'aud'
        || charge.amount !== 100
        || charge.amount_captured !== 100
        || charge.amount_refunded !== 100
        || charge.refunded !== true
        || !PAYMENT_INTENT_ID.test(charge.payment_intent || '')
      ) {
        throw new TypeError('A recent non-invoice Stripe charge is not the fully refunded AUD 1.00 validation');
      }
      const paymentIntentResponse = await stripeRequest(
        configuration,
        'GET',
        `/v1/payment_intents/${encodeURIComponent(charge.payment_intent)}`,
      );
      requestIds.push(paymentIntentResponse.requestId);
      const paymentIntent = exactLiveObject(
        paymentIntentResponse.body,
        'Stripe direct validation PaymentIntent',
      );
      if (
        paymentIntent.id !== charge.payment_intent
        || paymentIntent.customer !== binding.customerId
        || paymentIntent.amount !== 100
        || paymentIntent.amount_received !== 100
        || paymentIntent.currency !== 'aud'
        || paymentIntent.status !== 'succeeded'
        || paymentIntent.latest_charge !== charge.id
        || paymentIntent.metadata?.appId !== configuration.appId
        || paymentIntent.metadata?.professionId !== configuration.professionId
        || paymentIntent.metadata?.qaSequence !== configuration.sequenceId
        || paymentIntent.metadata?.subscriptionId !== binding.subscriptionId
        || paymentIntent.metadata?.validationPurpose !== LIVE_VALIDATION_PURPOSE
        || (configuration.expectedProvisionReceiptSha256
          && paymentIntent.metadata?.provisionReceiptSha256
            !== configuration.expectedProvisionReceiptSha256)
        || (configuration.provisionLedgerSha256
          && paymentIntent.metadata?.provisionLedgerSha256 !== configuration.provisionLedgerSha256)
      ) {
        throw new TypeError('The refunded AUD 1.00 validation PaymentIntent lacks exact metadata binding');
      }
      continue;
    }
    if (
      !CHARGE_ID.test(charge.id || '')
      || charge.customer !== binding.customerId
      || charge.currency !== 'aud'
    ) {
      throw new TypeError('A recent Stripe charge is not safely bound to the QA customer and invoice');
    }
    const invoiceResponse = await stripeRequest(
      configuration,
      'GET',
      `/v1/invoices/${encodeURIComponent(charge.invoice)}`,
    );
    requestIds.push(invoiceResponse.requestId);
    const invoice = exactLiveObject(invoiceResponse.body, 'Stripe charge invoice');
    if (
      invoice.customer !== binding.customerId
      || invoiceSubscriptionId(invoice) !== binding.subscriptionId
      || invoice.currency !== 'aud'
      || !exactMetadata(invoiceSubscriptionMetadata(invoice), configuration, binding.userId)
    ) {
      throw new TypeError('A recent Stripe charge invoice lacks exact sequence metadata binding');
    }
    bound.push({ charge, invoice });
  }
  return bound;
}

function bindingFingerprint(configuration, value) {
  return sha256(canonicalJson({
    sequence_id: configuration.sequenceId,
    user_id_sha256: sha256(value.userId),
    checkout_session_id_sha256: sha256(value.checkoutSessionId),
    customer_id_sha256: sha256(value.customerId),
    subscription_id_sha256: sha256(value.subscriptionId),
    product_id: configuration.stripeProductId,
    price_id: configuration.stripePriceId,
  }));
}

export function checkoutSessionIdFromUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('Stripe Checkout URL is invalid');
  }
  const id = url.pathname.split('/').find((part) => CHECKOUT_SESSION_ID.test(part));
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'checkout.stripe.com'
    || !id
    || url.username
    || url.password
  ) {
    throw new TypeError('Stripe Checkout URL is not an exact live hosted session');
  }
  return id;
}

export async function discoverExactCheckoutSessionId(configuration, {
  notBeforeMs,
  userId = null,
  userIdSha256 = null,
}) {
  if (
    !Number.isSafeInteger(notBeforeMs)
    || notBeforeMs <= 0
    || (!userId && !/^[0-9a-f]{64}$/.test(userIdSha256 || ''))
  ) {
    throw new TypeError('Stripe Checkout discovery inputs are invalid');
  }
  const createdAfter = Math.max(0, Math.floor((notBeforeMs - 60_000) / 1000));
  const requestIds = [];
  const allSessions = await stripeListAll(
    configuration,
    `/v1/checkout/sessions?limit=100&created%5Bgte%5D=${createdAfter}`,
    requestIds,
    'Stripe Checkout Session discovery',
  );
  const correlatedSessions = allSessions
    .filter((candidate) => (
      candidate?.livemode === true
      && CHECKOUT_SESSION_ID.test(candidate.id || '')
      && withinCreationWindow(candidate, notBeforeMs)
      && (userId
        ? candidate.client_reference_id === userId
        : sha256(candidate.client_reference_id || '') === userIdSha256)
    ));
  if (correlatedSessions.some((candidate) => (
    !exactMetadata(candidate.metadata, configuration, candidate.client_reference_id)
  ))) {
    throw new TypeError('Stripe Checkout Session discovery found cross-object metadata drift');
  }
  const sessions = correlatedSessions;
  if (sessions.length !== 1) {
    throw new TypeError('Stripe Checkout Session discovery is missing or ambiguous');
  }
  const session = sessions[0];
  const expectedEmail = (session.customer_details?.email || session.customer_email || '').toLowerCase();
  if (
    session.mode !== 'subscription'
    || expectedEmail !== configuration.email
    || (session.customer !== null && session.customer !== undefined && !CUSTOMER_ID.test(session.customer))
    || (session.subscription !== null && session.subscription !== undefined && !SUBSCRIPTION_ID.test(session.subscription))
  ) {
    throw new TypeError('Stripe Checkout Session discovery lacks the exact account binding');
  }
  if (session.customer) {
    const allCustomers = await stripeListAll(
      configuration,
      `/v1/customers?email=${encodeURIComponent(configuration.email)}&limit=100`,
      requestIds,
      'Stripe Checkout customer discovery',
    );
    const customers = allCustomers
      .filter((candidate) => (
        candidate?.livemode === true
        && candidate.email?.toLowerCase() === configuration.email
        && withinCreationWindow(candidate, notBeforeMs)
      ));
    if (
      customers.length !== 1
      || customers[0].id !== session.customer
      || !CUSTOMER_ID.test(customers[0].id || '')
    ) {
      throw new TypeError('Stripe Checkout customer discovery is missing, ambiguous or unbound');
    }
  }
  return {
    checkoutSessionId: session.id,
    customerId: session.customer || null,
    subscriptionId: session.subscription || null,
    checkoutStatus: session.status,
    paymentStatus: session.payment_status,
    userId: session.client_reference_id,
    providerRequestIdsSha256: providerRequestDigest(requestIds),
  };
}

export async function readLiveStripeState(configuration, {
  notBeforeMs,
  userId,
  checkoutSessionId,
  allowedSubscriptionStatuses = ['trialing'],
}) {
  if (
    !Number.isSafeInteger(notBeforeMs)
    || notBeforeMs <= 0
    || typeof userId !== 'string'
    || userId.length < 4
    || !CHECKOUT_SESSION_ID.test(checkoutSessionId || '')
    || !Array.isArray(allowedSubscriptionStatuses)
    || allowedSubscriptionStatuses.length === 0
  ) {
    throw new TypeError('Stripe exact-binding inputs are invalid');
  }
  const requestIds = [];
  const checkoutResponse = await stripeRequest(
    configuration,
    'GET',
    `/v1/checkout/sessions/${encodeURIComponent(checkoutSessionId)}`,
  );
  requestIds.push(checkoutResponse.requestId);
  const checkout = exactLiveObject(checkoutResponse.body, 'Stripe Checkout Session');
  if (
    checkout.id !== checkoutSessionId
    || checkout.mode !== 'subscription'
    || checkout.status !== 'complete'
    || checkout.payment_status !== 'no_payment_required'
    || checkout.currency !== 'aud'
    || checkout.amount_total !== configuration.expectedDueTodayAudCents
    || checkout.payment_method_collection !== 'always'
    || checkout.client_reference_id !== userId
    || (checkout.customer_details?.email || checkout.customer_email || '').toLowerCase() !== configuration.email
    || !exactMetadata(checkout.metadata, configuration, userId)
    || !CUSTOMER_ID.test(checkout.customer || '')
    || !SUBSCRIPTION_ID.test(checkout.subscription || '')
    || !withinCreationWindow(checkout, notBeforeMs)
  ) {
    throw new TypeError('Stripe Checkout Session lacks the exact account and QA sequence binding');
  }

  const allCustomers = await stripeListAll(
    configuration,
    `/v1/customers?email=${encodeURIComponent(configuration.email)}&limit=100`,
    requestIds,
    'Stripe customer readback',
  );
  const customers = allCustomers
    .filter((candidate) => candidate?.livemode === true && withinCreationWindow(candidate, notBeforeMs));
  if (customers.length !== 1) {
    throw new TypeError('Stripe customer readback is missing or ambiguous for the exact sequence window');
  }
  const customer = exactLiveObject(customers[0], 'Stripe customer');
  if (
    customer.id !== checkout.customer
    || customer.email?.toLowerCase() !== configuration.email
  ) {
    throw new TypeError('Stripe customer does not match the Checkout recipient binding');
  }

  const allSubscriptions = await stripeListAll(
    configuration,
    `/v1/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=100`,
    requestIds,
    'Stripe subscription readback',
  );
  const recentSubscriptions = allSubscriptions
    .filter((candidate) => candidate?.livemode === true && withinCreationWindow(candidate, notBeforeMs));
  if (recentSubscriptions.length !== 1) {
    throw new TypeError('Stripe subscription readback is missing or ambiguous for the exact sequence window');
  }
  const subscription = exactLiveObject(recentSubscriptions[0], 'Stripe subscription');
  if (
    subscription.id !== checkout.subscription
    || subscription.customer !== customer.id
    || !allowedSubscriptionStatuses.includes(subscription.status)
    || !exactMetadata(subscription.metadata, configuration, userId)
    || !exactItem(subscription, configuration)
  ) {
    throw new TypeError('Stripe subscription lacks exact account, product, price or QA sequence binding');
  }

  const subscriptionDefaultPaymentMethod = typeof subscription.default_payment_method === 'object'
    ? subscription.default_payment_method?.id
    : subscription.default_payment_method;
  const customerDefaultPaymentMethod = typeof customer.invoice_settings?.default_payment_method
    === 'object'
    ? customer.invoice_settings.default_payment_method?.id
    : customer.invoice_settings?.default_payment_method;
  const defaultPaymentMethodCandidates = [
    subscriptionDefaultPaymentMethod,
    customerDefaultPaymentMethod,
  ].filter(Boolean);
  if (
    defaultPaymentMethodCandidates.length === 0
    || defaultPaymentMethodCandidates.some((candidate) => !PAYMENT_METHOD_ID.test(candidate))
    || new Set(defaultPaymentMethodCandidates).size !== 1
  ) {
    throw new TypeError('Stripe subscription/customer lacks one exact reusable default PaymentMethod');
  }
  const defaultPaymentMethodId = defaultPaymentMethodCandidates[0];
  const defaultPaymentMethodResponse = await stripeRequest(
    configuration,
    'GET',
    `/v1/payment_methods/${encodeURIComponent(defaultPaymentMethodId)}`,
  );
  requestIds.push(defaultPaymentMethodResponse.requestId);
  const defaultPaymentMethod = exactLiveObject(
    defaultPaymentMethodResponse.body,
    'Stripe default PaymentMethod',
  );
  if (
    defaultPaymentMethod.id !== defaultPaymentMethodId
    || defaultPaymentMethod.customer !== customer.id
    || typeof defaultPaymentMethod.type !== 'string'
    || !defaultPaymentMethod.type
  ) {
    throw new TypeError('Stripe default PaymentMethod is not attached to the exact Checkout customer');
  }
  const defaultPaymentMethodSource = subscriptionDefaultPaymentMethod && customerDefaultPaymentMethod
    ? 'subscription-and-customer'
    : subscriptionDefaultPaymentMethod
      ? 'subscription'
      : 'customer';

  const priceResponse = await stripeRequest(configuration, 'GET', `/v1/prices/${encodeURIComponent(configuration.stripePriceId)}`);
  requestIds.push(priceResponse.requestId);
  const price = exactLiveObject(priceResponse.body, 'Stripe monthly price');
  const annualPriceResponse = await stripeRequest(configuration, 'GET', `/v1/prices/${encodeURIComponent(configuration.stripeAnnualPriceId)}`);
  requestIds.push(annualPriceResponse.requestId);
  const annualPrice = exactLiveObject(annualPriceResponse.body, 'Stripe annual price');
  const productResponse = await stripeRequest(configuration, 'GET', `/v1/products/${encodeURIComponent(configuration.stripeProductId)}`);
  requestIds.push(productResponse.requestId);
  const product = exactLiveObject(productResponse.body, 'Stripe product');
  if (
    price.id !== configuration.stripePriceId
    || price.product !== configuration.stripeProductId
    || price.active !== true
    || price.currency !== 'aud'
    || price.unit_amount !== configuration.recurringAmountAudCents
    || price.lookup_key !== configuration.stripeMonthlyLookupKey
    || price.type !== 'recurring'
    || price.recurring?.interval !== 'month'
    || price.recurring?.interval_count !== 1
    || price.metadata?.appId !== configuration.appId
    || price.metadata?.professionId !== configuration.professionId
    || annualPrice.id !== configuration.stripeAnnualPriceId
    || annualPrice.product !== configuration.stripeProductId
    || annualPrice.active !== true
    || annualPrice.currency !== 'aud'
    || annualPrice.unit_amount !== configuration.annualRecurringAmountAudCents
    || annualPrice.lookup_key !== configuration.stripeAnnualLookupKey
    || annualPrice.type !== 'recurring'
    || annualPrice.recurring?.interval !== 'year'
    || annualPrice.recurring?.interval_count !== 1
    || annualPrice.metadata?.appId !== configuration.appId
    || annualPrice.metadata?.professionId !== configuration.professionId
    || product.id !== configuration.stripeProductId
    || product.name !== 'AssessSuite Physiotherapy'
    || product.active !== true
    || product.metadata?.appId !== configuration.appId
    || product.metadata?.professionId !== configuration.professionId
    || product.metadata?.productLookupKey !== configuration.stripeProductLookupKey
  ) {
    throw new TypeError('Stripe live product and prices differ from the frozen Physio catalogue');
  }
  const trialSeconds = Number.isSafeInteger(subscription.trial_start)
    && Number.isSafeInteger(subscription.trial_end)
    ? subscription.trial_end - subscription.trial_start
    : 0;
  if (trialSeconds !== configuration.trialDays * 86_400) {
    throw new TypeError('Stripe subscription does not carry the exact 30-day trial');
  }

  const provisionalBinding = {
    notBeforeMs,
    userId,
    checkoutSessionId,
    customerId: customer.id,
    subscriptionId: subscription.id,
  };
  const charges = await listExactBoundCharges(configuration, provisionalBinding, requestIds);
  const actualChargeAudCents = charges.reduce((sum, entry) => sum + entry.charge.amount_captured, 0);
  const fingerprint = bindingFingerprint(configuration, provisionalBinding);
  const receipt = {
    contract_version: 'assesssuite-stripe-exact-binding-readback/2.0.0',
    result: 'PASS',
    provider: 'stripe',
    livemode: true,
    app_id: configuration.appId,
    profession_id: configuration.professionId,
    qa_sequence_sha256: sha256(configuration.sequenceId),
    checkout_session_id_sha256: sha256(checkoutSessionId),
    checkout_amount_total_aud_cents: checkout.amount_total,
    checkout_payment_method_collection: checkout.payment_method_collection,
    customer_id_sha256: sha256(customer.id),
    default_payment_method_id_sha256: sha256(defaultPaymentMethodId),
    default_payment_method_source: defaultPaymentMethodSource,
    subscription_id_sha256: sha256(subscription.id),
    binding_fingerprint_sha256: fingerprint,
    product_id: configuration.stripeProductId,
    product_name: 'AssessSuite Physiotherapy',
    product_lookup_key: configuration.stripeProductLookupKey,
    price_id: configuration.stripePriceId,
    price_lookup_key: configuration.stripeMonthlyLookupKey,
    annual_price_id: configuration.stripeAnnualPriceId,
    annual_lookup_key: configuration.stripeAnnualLookupKey,
    currency: 'aud',
    unit_amount: configuration.recurringAmountAudCents,
    interval: 'month',
    annual_unit_amount: configuration.annualRecurringAmountAudCents,
    annual_interval: 'year',
    trial_days: configuration.trialDays,
    subscription_status: subscription.status,
    captured_charge_count: charges.length,
    actual_charge_aud_cents: actualChargeAudCents,
    api_version: SELF_SERVICE_STRIPE_API_VERSION,
    provider_request_ids_sha256: providerRequestDigest(requestIds),
    observed_at: new Date().toISOString(),
  };
  assertExactKeys(receipt, STRIPE_READBACK_RECEIPT_KEYS, 'Stripe exact-binding receipt');
  return {
    ...provisionalBinding,
    fingerprint,
    subscriptionStatus: subscription.status,
    defaultPaymentMethodId,
    defaultPaymentMethodSource,
    charges,
    receipt,
  };
}

export async function reconcileIncompleteCheckoutForCleanup(configuration, discovered) {
  if (
    !discovered
    || !Number.isSafeInteger(discovered.notBeforeMs)
    || !CHECKOUT_SESSION_ID.test(discovered.checkoutSessionId || '')
    || typeof discovered.userId !== 'string'
    || discovered.userId.length < 4
  ) {
    throw new TypeError('Incomplete Checkout cleanup inputs are invalid');
  }
  const requestIds = [];
  const readSession = async () => {
    const response = await stripeRequest(
      configuration,
      'GET',
      `/v1/checkout/sessions/${encodeURIComponent(discovered.checkoutSessionId)}`,
    );
    requestIds.push(response.requestId);
    const session = exactLiveObject(response.body, 'incomplete Stripe Checkout Session');
    if (
      session.id !== discovered.checkoutSessionId
      || session.mode !== 'subscription'
      || !['open', 'expired'].includes(session.status)
      || session.payment_status === 'paid'
      || session.subscription
      || session.client_reference_id !== discovered.userId
      || (session.customer_details?.email || session.customer_email || '').toLowerCase() !== configuration.email
      || !exactMetadata(session.metadata, configuration, discovered.userId)
      || !withinCreationWindow(session, discovered.notBeforeMs)
      || (session.customer || null) !== (discovered.customerId || null)
    ) {
      throw new TypeError('Incomplete Stripe Checkout Session is not exactly bound or is financially active');
    }
    return session;
  };

  let session = await readSession();
  const priceResponse = await stripeRequest(
    configuration,
    'GET',
    `/v1/prices/${encodeURIComponent(configuration.stripePriceId)}`,
  );
  requestIds.push(priceResponse.requestId);
  const price = exactLiveObject(priceResponse.body, 'Stripe monthly price');
  const productResponse = await stripeRequest(
    configuration,
    'GET',
    `/v1/products/${encodeURIComponent(configuration.stripeProductId)}`,
  );
  requestIds.push(productResponse.requestId);
  const product = exactLiveObject(productResponse.body, 'Stripe product');
  if (
    price.id !== configuration.stripePriceId
    || price.product !== configuration.stripeProductId
    || price.active !== true
    || price.currency !== 'aud'
    || price.unit_amount !== configuration.recurringAmountAudCents
    || price.lookup_key !== configuration.stripeMonthlyLookupKey
    || price.type !== 'recurring'
    || price.recurring?.interval !== 'month'
    || price.recurring?.interval_count !== 1
    || price.metadata?.appId !== configuration.appId
    || price.metadata?.professionId !== configuration.professionId
    || product.id !== configuration.stripeProductId
    || product.name !== 'AssessSuite Physiotherapy'
    || product.active !== true
    || product.metadata?.appId !== configuration.appId
    || product.metadata?.professionId !== configuration.professionId
    || product.metadata?.productLookupKey !== configuration.stripeProductLookupKey
  ) {
    throw new TypeError('Incomplete Checkout cleanup found a different product or price');
  }

  if (session.customer) {
    const customerResponse = await stripeRequest(
      configuration,
      'GET',
      `/v1/customers/${encodeURIComponent(session.customer)}`,
    );
    requestIds.push(customerResponse.requestId);
    const customer = exactLiveObject(customerResponse.body, 'incomplete Checkout customer');
    if (
      customer.id !== session.customer
      || customer.email?.toLowerCase() !== configuration.email
      || !withinCreationWindow(customer, discovered.notBeforeMs)
    ) {
      throw new TypeError('Incomplete Checkout customer differs from the exact sequence binding');
    }
    const subscriptions = await stripeListAll(
      configuration,
      `/v1/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=100`,
      requestIds,
      'Incomplete Checkout subscription discovery',
    );
    const charges = await stripeListAll(
      configuration,
      `/v1/charges?customer=${encodeURIComponent(customer.id)}&limit=100`,
      requestIds,
      'Incomplete Checkout charge discovery',
    );
    if (
      subscriptions.length !== 0
      || charges.length !== 0
    ) {
      throw new TypeError('Incomplete Checkout cleanup refuses a customer with any subscription or charge');
    }
  }

  if (session.status === 'open') {
    const expired = await stripeRequest(
      configuration,
      'POST',
      `/v1/checkout/sessions/${encodeURIComponent(session.id)}/expire`,
      {},
      mutationIdempotencyKey('expire_checkout', configuration, {
        fingerprint: bindingFingerprint(configuration, {
          userId: discovered.userId,
          checkoutSessionId: discovered.checkoutSessionId,
          customerId: discovered.customerId || 'no-customer-created',
          subscriptionId: discovered.subscriptionId || 'no-subscription-created',
        }),
      }, session.id),
    );
    requestIds.push(expired.requestId);
    if (
      expired.body?.livemode !== true
      || expired.body.id !== session.id
      || expired.body.status !== 'expired'
      || expired.body.subscription
      || !exactMetadata(expired.body.metadata, configuration, discovered.userId)
    ) {
      throw new TypeError('Stripe did not confirm expiration of the exact incomplete Checkout Session');
    }
    session = await readSession();
  }
  if (session.status !== 'expired') {
    throw new TypeError('Incomplete Checkout cleanup did not reach an expired terminal state');
  }
  const fingerprint = bindingFingerprint(configuration, {
    userId: discovered.userId,
    checkoutSessionId: discovered.checkoutSessionId,
    customerId: discovered.customerId || 'no-customer-created',
    subscriptionId: 'no-subscription-created',
  });
  const receipt = {
    contract_version: 'assesssuite-stripe-incomplete-checkout-cleanup/2.0.0',
    result: 'PASS',
    provider: 'stripe',
    livemode: true,
    qa_sequence_sha256: sha256(configuration.sequenceId),
    checkout_session_id_sha256: sha256(discovered.checkoutSessionId),
    customer_id_sha256: discovered.customerId
      ? sha256(discovered.customerId)
      : sha256('no-stripe-customer-created'),
    product_id: configuration.stripeProductId,
    price_id: configuration.stripePriceId,
    subscription_status: 'none',
    checkout_status: 'expired',
    captured_charge_count: 0,
    binding_fingerprint_sha256: fingerprint,
    provider_request_ids_sha256: providerRequestDigest(requestIds),
    observed_at: new Date().toISOString(),
  };
  assertExactKeys(receipt, INCOMPLETE_CHECKOUT_CLEANUP_RECEIPT_KEYS, 'incomplete Checkout cleanup receipt');
  return {
    ...discovered,
    fingerprint,
    receipt,
  };
}

async function reverifyBinding(configuration, binding, allowedSubscriptionStatuses) {
  const current = await readLiveStripeState(configuration, {
    notBeforeMs: binding.notBeforeMs,
    userId: binding.userId,
    checkoutSessionId: binding.checkoutSessionId,
    allowedSubscriptionStatuses,
  });
  if (
    current.customerId !== binding.customerId
    || current.subscriptionId !== binding.subscriptionId
    || current.fingerprint !== binding.fingerprint
  ) {
    throw new TypeError('Stripe cleanup binding changed or became ambiguous before mutation');
  }
  return current;
}

export async function readCancellationReceipt(configuration, binding, { uiCancellationConfirmed }) {
  const current = await reverifyBinding(configuration, binding, ['canceled']);
  if (uiCancellationConfirmed !== true) {
    throw new TypeError('Stripe cancellation readback requires normal UI confirmation');
  }
  const receipt = {
    contract_version: 'assesssuite-stripe-live-cancellation/2.0.0',
    result: 'PASS',
    provider: 'stripe',
    livemode: true,
    binding_fingerprint_sha256: current.fingerprint,
    customer_id_sha256: sha256(current.customerId),
    subscription_id_sha256: sha256(current.subscriptionId),
    subscription_status: 'canceled',
    cancelled_during_trial: true,
    ui_cancellation_confirmed: true,
    provider_request_ids_sha256: current.receipt.provider_request_ids_sha256,
    observed_at: new Date().toISOString(),
  };
  assertExactKeys(receipt, CANCELLATION_RECEIPT_KEYS, 'Stripe cancellation receipt');
  return receipt;
}

export async function cancelSubscriptionForCleanup(configuration, binding) {
  const current = await reverifyBinding(configuration, binding, ['trialing', 'canceled']);
  if (current.subscriptionStatus === 'canceled') {
    return {
      provider: 'stripe',
      result: 'PASS',
      binding_fingerprint_sha256: current.fingerprint,
      subscription_id_sha256: sha256(current.subscriptionId),
      subscription_status: 'canceled',
      provider_request_ids_sha256: current.receipt.provider_request_ids_sha256,
      observed_at: new Date().toISOString(),
    };
  }
  const cancelled = await stripeRequest(
    configuration,
    'DELETE',
    `/v1/subscriptions/${encodeURIComponent(current.subscriptionId)}`,
    null,
    mutationIdempotencyKey(
      'cancel_subscription',
      configuration,
      current,
      current.subscriptionId,
    ),
  );
  if (
    cancelled.body?.livemode !== true
    || cancelled.body.id !== current.subscriptionId
    || cancelled.body.customer !== current.customerId
    || cancelled.body.status !== 'canceled'
    || !exactMetadata(cancelled.body.metadata, configuration, current.userId)
  ) {
    throw new TypeError('Stripe cleanup cancellation was not confirmed against the exact binding');
  }
  return {
    provider: 'stripe',
    result: 'PASS',
    binding_fingerprint_sha256: current.fingerprint,
    subscription_id_sha256: sha256(current.subscriptionId),
    subscription_status: 'canceled',
    provider_request_ids_sha256: providerRequestDigest([cancelled.requestId]),
    observed_at: new Date().toISOString(),
  };
}

export async function refundLiveCharges(configuration, binding) {
  const current = await reverifyBinding(configuration, binding, ['trialing', 'canceled']);
  const total = current.charges.reduce((sum, entry) => sum + entry.charge.amount_captured, 0);
  if (total > configuration.maximumChargeAudCents) {
    throw new TypeError('The exact QA charge exceeds the AUD 20 refund authority; no refund was mutated');
  }
  const requestIds = [];
  let refundCount = 0;
  for (const { charge } of current.charges) {
    const remaining = charge.amount_captured - Number(charge.amount_refunded || 0);
    if (remaining <= 0) {
      refundCount += Number(charge.amount_refunded || 0) > 0 ? 1 : 0;
      continue;
    }
    const refund = await stripeRequest(
      configuration,
      'POST',
      '/v1/refunds',
      {
        charge: charge.id,
        amount: String(remaining),
        reason: 'requested_by_customer',
        'metadata[appId]': configuration.appId,
        'metadata[professionId]': configuration.professionId,
        'metadata[qaSequence]': configuration.sequenceId,
        'metadata[bindingFingerprint]': current.fingerprint,
      },
      mutationIdempotencyKey('refund_charge', configuration, current, charge.id),
    );
    requestIds.push(refund.requestId);
    if (
      refund.body?.livemode !== true
      || !REFUND_ID.test(refund.body.id || '')
      || refund.body.charge !== charge.id
      || refund.body.amount !== remaining
      || refund.body.status !== 'succeeded'
    ) {
      throw new TypeError('Stripe did not confirm the exact bounded QA refund');
    }
    refundCount += 1;
  }
  const verified = await reverifyBinding(configuration, binding, ['trialing', 'canceled']);
  const refunded = verified.charges.reduce(
    (sum, entry) => sum + Number(entry.charge.amount_refunded || 0),
    0,
  );
  if (refunded !== total) {
    throw new TypeError('Stripe charge reconciliation found an unrefunded exact QA charge');
  }
  const receipt = {
    contract_version: 'assesssuite-stripe-live-refund/2.0.0',
    result: 'PASS',
    provider: 'stripe',
    livemode: true,
    binding_fingerprint_sha256: verified.fingerprint,
    customer_id_sha256: sha256(verified.customerId),
    actual_charge_aud_cents: total,
    refunded_aud_cents: refunded,
    refunded_charge_count: refundCount,
    provider_request_ids_sha256: requestIds.length > 0
      ? providerRequestDigest(requestIds)
      : verified.receipt.provider_request_ids_sha256,
    observed_at: new Date().toISOString(),
  };
  assertExactKeys(receipt, REFUND_RECEIPT_KEYS, 'Stripe refund receipt');
  return receipt;
}
