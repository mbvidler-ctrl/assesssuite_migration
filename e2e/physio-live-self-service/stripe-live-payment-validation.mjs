import {
  SELF_SERVICE_CARD_ENTRY_MECHANISM,
  SELF_SERVICE_STRIPE_API_VERSION,
  PAYMENT_VALIDATION_RECEIPT_KEYS,
  PAYMENT_VALIDATION_RECEIPT_VERSION,
  assertExactKeys,
  canonicalJson,
  sha256,
} from './self-service-contract.mjs';

const STRIPE_ORIGIN = 'https://api.stripe.com';
const CONTRACT_VERSION = PAYMENT_VALIDATION_RECEIPT_VERSION;
const VALIDATION_PURPOSE = 'assesssuite_physio_live_payment_validation';
const STRIPE_REQUEST_ID = /^req_[A-Za-z0-9]{6,120}$/;
const PAYMENT_INTENT_ID = /^pi_[A-Za-z0-9]{6,180}$/;
const CHARGE_ID = /^ch_[A-Za-z0-9]{6,180}$/;
const REFUND_ID = /^re_[A-Za-z0-9]{6,180}$/;
const PAYMENT_METHOD_ID = /^pm_[A-Za-z0-9]{6,200}$/;
const STRIPE_LIST_ITEM_ID = /^[A-Za-z0-9_]{3,255}$/;
const STRIPE_MAX_LIST_PAGES = 100;
const STRIPE_MAX_LIST_ITEMS = 10_000;

class StripeProviderRejection extends TypeError {
  constructor(status, providerRequestId) {
    super(`Stripe validation call failed with status ${status}`);
    this.name = 'StripeProviderRejection';
    this.providerRequestId = providerRequestId;
  }
}

export const LIVE_PAYMENT_VALIDATION_RECEIPT_KEYS = PAYMENT_VALIDATION_RECEIPT_KEYS;

function requestId(response) {
  const value = String(response.headers.get('request-id') || '').trim();
  if (!STRIPE_REQUEST_ID.test(value)) {
    throw new TypeError('Stripe validation call omitted its exact provider request ID');
  }
  return value;
}

async function stripeRequest(configuration, method, route, {
  form = null,
  idempotencyKey = null,
} = {}) {
  const response = await fetch(`${STRIPE_ORIGIN}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${configuration.stripeSecretKey}`,
      'Stripe-Version': SELF_SERVICE_STRIPE_API_VERSION,
      ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    ...(form ? { body: new URLSearchParams(form) } : {}),
    signal: AbortSignal.timeout(30_000),
  });
  const providerRequestId = requestId(response);
  if (response.status >= 400 && response.status < 500) {
    throw new StripeProviderRejection(response.status, providerRequestId);
  }
  if (response.status < 200 || response.status >= 300) {
    const error = new TypeError(`Stripe validation call had an uncertain status ${response.status}`);
    error.providerRequestId = providerRequestId;
    throw error;
  }
  const body = await response.json().catch(() => null);
  if (
    !body
    || typeof body !== 'object'
    || Array.isArray(body)
  ) {
    const error = new TypeError('Stripe validation call returned an invalid response');
    error.providerRequestId = providerRequestId;
    throw error;
  }
  return { body, providerRequestId };
}

function recordProviderRequestId(requestIds, providerRequestId) {
  if (STRIPE_REQUEST_ID.test(providerRequestId || '')) requestIds.push(providerRequestId);
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
    requestIds.push(response.providerRequestId);
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

function exactLive(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.livemode !== true) {
    throw new TypeError(`${label} is not one live Stripe object`);
  }
  return value;
}

function providerRequestDigest(requestIds) {
  if (
    !Array.isArray(requestIds)
    || requestIds.length === 0
    || requestIds.some((value) => !STRIPE_REQUEST_ID.test(value))
  ) {
    throw new TypeError('Stripe validation provider-request evidence is incomplete');
  }
  return sha256(canonicalJson([...requestIds].sort()));
}

function exactMetadata(metadata, configuration, binding) {
  return metadata?.appId === configuration.appId
    && metadata?.professionId === configuration.professionId
    && metadata?.l5IntentId === configuration.l5IntentId
    && metadata?.qaSequence === configuration.sequenceId
    && metadata?.subscriptionId === binding.subscriptionId
    && metadata?.provisionReceiptSha256 === configuration.expectedProvisionReceiptSha256
    && metadata?.provisionLedgerSha256 === configuration.provisionLedgerSha256
    && metadata?.emailConfigurationReceiptSha256
      === configuration.expectedEmailConfigurationReceiptSha256
    && metadata?.validationPurpose === VALIDATION_PURPOSE;
}

function validationMetadata(configuration, binding) {
  return {
    'metadata[appId]': configuration.appId,
    'metadata[professionId]': configuration.professionId,
    'metadata[l5IntentId]': configuration.l5IntentId,
    'metadata[qaSequence]': configuration.sequenceId,
    'metadata[subscriptionId]': binding.subscriptionId,
    'metadata[provisionReceiptSha256]': configuration.expectedProvisionReceiptSha256,
    'metadata[provisionLedgerSha256]': configuration.provisionLedgerSha256,
    'metadata[emailConfigurationReceiptSha256]':
      configuration.expectedEmailConfigurationReceiptSha256,
    'metadata[validationPurpose]': VALIDATION_PURPOSE,
  };
}

function paymentIntentIdempotencyKey(configuration, binding) {
  return `assesssuite_physio_validation_pi_${sha256(canonicalJson({
    app_id: configuration.appId,
    profession_id: configuration.professionId,
    l5_intent_id: configuration.l5IntentId,
    sequence_id: configuration.sequenceId,
    checkout_session_id_sha256: sha256(binding.checkoutSessionId),
    customer_id_sha256: sha256(binding.customerId),
    subscription_id_sha256: sha256(binding.subscriptionId),
    default_payment_method_id_sha256: sha256(binding.defaultPaymentMethodId),
    provision_receipt_sha256: configuration.expectedProvisionReceiptSha256,
    provision_ledger_sha256: configuration.provisionLedgerSha256,
    email_configuration_receipt_sha256:
      configuration.expectedEmailConfigurationReceiptSha256,
    amount_aud_cents: 100,
  })).slice(0, 64)}`;
}

function refundIdempotencyKey(configuration, binding, paymentIntentId, chargeId) {
  return `assesssuite_physio_validation_refund_${sha256(canonicalJson({
    sequence_id: configuration.sequenceId,
    l5_intent_id: configuration.l5IntentId,
    subscription_id_sha256: sha256(binding.subscriptionId),
    payment_intent_id_sha256: sha256(paymentIntentId),
    charge_id_sha256: sha256(chargeId),
    email_configuration_receipt_sha256:
      configuration.expectedEmailConfigurationReceiptSha256,
    amount_aud_cents: 100,
  })).slice(0, 64)}`;
}

async function readFoundation(configuration, binding, requestIds) {
  const checkoutResponse = await stripeRequest(
    configuration,
    'GET',
    `/v1/checkout/sessions/${encodeURIComponent(binding.checkoutSessionId)}`,
  );
  requestIds.push(checkoutResponse.providerRequestId);
  const checkout = exactLive(checkoutResponse.body, 'validation Checkout Session');
  if (
    checkout.id !== binding.checkoutSessionId
    || checkout.status !== 'complete'
    || checkout.payment_status !== 'no_payment_required'
    || checkout.amount_total !== 0
    || checkout.currency !== 'aud'
    || checkout.payment_method_collection !== 'always'
    || checkout.customer !== binding.customerId
    || checkout.subscription !== binding.subscriptionId
    || sha256(checkout.metadata?.userId || '') !== binding.userIdSha256
    || checkout.metadata?.qaSequence !== configuration.sequenceId
  ) {
    throw new TypeError('AUD 1.00 validation Checkout binding differs');
  }

  const subscriptionResponse = await stripeRequest(
    configuration,
    'GET',
    `/v1/subscriptions/${encodeURIComponent(binding.subscriptionId)}`,
  );
  requestIds.push(subscriptionResponse.providerRequestId);
  const subscription = exactLive(subscriptionResponse.body, 'validation subscription');
  const subscriptionDefaultPaymentMethod = typeof subscription.default_payment_method === 'object'
    ? subscription.default_payment_method?.id
    : subscription.default_payment_method;
  if (
    subscription.id !== binding.subscriptionId
    || subscription.customer !== binding.customerId
    || subscription.status !== 'trialing'
    || subscriptionDefaultPaymentMethod !== binding.defaultPaymentMethodId
  ) {
    throw new TypeError('AUD 1.00 validation subscription/default PaymentMethod differs');
  }

  const customerResponse = await stripeRequest(
    configuration,
    'GET',
    `/v1/customers/${encodeURIComponent(binding.customerId)}`,
  );
  requestIds.push(customerResponse.providerRequestId);
  const customer = exactLive(customerResponse.body, 'validation customer');
  const customerDefaultPaymentMethod = typeof customer.invoice_settings?.default_payment_method
    === 'object'
    ? customer.invoice_settings.default_payment_method?.id
    : customer.invoice_settings?.default_payment_method;
  if (
    customer.id !== binding.customerId
    || customer.email?.toLowerCase() !== configuration.email
    || (customerDefaultPaymentMethod
      && customerDefaultPaymentMethod !== binding.defaultPaymentMethodId)
  ) {
    throw new TypeError('AUD 1.00 validation Customer/default PaymentMethod differs');
  }

  const paymentMethodResponse = await stripeRequest(
    configuration,
    'GET',
    `/v1/payment_methods/${encodeURIComponent(binding.defaultPaymentMethodId)}`,
  );
  requestIds.push(paymentMethodResponse.providerRequestId);
  const paymentMethod = exactLive(paymentMethodResponse.body, 'validation default PaymentMethod');
  if (
    !PAYMENT_METHOD_ID.test(paymentMethod.id || '')
    || paymentMethod.id !== binding.defaultPaymentMethodId
    || paymentMethod.customer !== binding.customerId
  ) {
    throw new TypeError('AUD 1.00 validation PaymentMethod is not attached to the exact Customer');
  }
}

async function listExactPaymentIntents(configuration, binding, requestIds) {
  const candidates = await stripeListAll(
    configuration,
    `/v1/payment_intents?customer=${encodeURIComponent(binding.customerId)}&limit=100`,
    requestIds,
    'AUD 1.00 PaymentIntent discovery',
  );
  const metadataDrift = candidates.some((candidate) => (
    candidate?.metadata?.qaSequence === configuration.sequenceId
    && !exactMetadata(candidate.metadata, configuration, binding)
  ));
  if (metadataDrift) {
    throw new TypeError('AUD 1.00 PaymentIntent discovery found cross-object metadata drift');
  }
  const matches = candidates.filter((candidate) => (
    candidate?.livemode === true
    && candidate.customer === binding.customerId
    && exactMetadata(candidate.metadata, configuration, binding)
  ));
  if (matches.length > 1) {
    throw new TypeError('AUD 1.00 PaymentIntent discovery is ambiguous');
  }
  return matches[0] || null;
}

function validatePaymentIntent(value, configuration, binding) {
  const paymentIntent = exactLive(value, 'AUD 1.00 PaymentIntent');
  if (
    !PAYMENT_INTENT_ID.test(paymentIntent.id || '')
    || paymentIntent.amount !== 100
    || paymentIntent.amount_received !== 100
    || paymentIntent.currency !== 'aud'
    || paymentIntent.customer !== binding.customerId
    || paymentIntent.payment_method !== binding.defaultPaymentMethodId
    || paymentIntent.status !== 'succeeded'
    || !CHARGE_ID.test(paymentIntent.latest_charge || '')
    || !exactMetadata(paymentIntent.metadata, configuration, binding)
  ) {
    throw new TypeError('AUD 1.00 PaymentIntent lacks the exact live binding or succeeded state');
  }
  return paymentIntent;
}

function isExactUnchargedFailedPaymentIntent(value, configuration, binding) {
  return value?.livemode === true
    && PAYMENT_INTENT_ID.test(value.id || '')
    && value.amount === 100
    && Number(value.amount_received || 0) === 0
    && Number(value.amount_capturable || 0) === 0
    && value.currency === 'aud'
    && value.customer === binding.customerId
    && value.payment_method === binding.defaultPaymentMethodId
    && ['requires_payment_method', 'requires_action', 'canceled'].includes(value.status)
    && exactMetadata(value.metadata, configuration, binding);
}

async function readExactUnchargedFailedCharge(
  configuration,
  binding,
  paymentIntent,
  requestIds,
) {
  if (!CHARGE_ID.test(paymentIntent.latest_charge || '')) {
    throw new TypeError('AUD 1.00 failed PaymentIntent latest Charge binding is malformed');
  }
  const response = await stripeRequest(
    configuration,
    'GET',
    `/v1/charges/${encodeURIComponent(paymentIntent.latest_charge)}`,
  );
  requestIds.push(response.providerRequestId);
  const charge = exactLive(response.body, 'AUD 1.00 uncharged failed Charge');
  if (
    charge.id !== paymentIntent.latest_charge
    || charge.payment_intent !== paymentIntent.id
    || charge.customer !== binding.customerId
    || charge.payment_method !== binding.defaultPaymentMethodId
    || charge.amount !== 100
    || Number(charge.amount_captured || 0) !== 0
    || Number(charge.amount_refunded || 0) !== 0
    || charge.currency !== 'aud'
    || charge.paid !== false
    || charge.refunded !== false
    || !(charge.status === 'failed'
      || (paymentIntent.status === 'requires_action' && charge.status === 'pending'))
    || !(charge.invoice === null || charge.invoice === undefined)
  ) {
    throw new TypeError('AUD 1.00 failed Charge is not exact and provably uncharged');
  }
  return charge;
}

async function createOrResolvePaymentIntent(configuration, binding, requestIds, { allowCreate }) {
  const prior = await listExactPaymentIntents(configuration, binding, requestIds);
  if (prior) {
    if (!allowCreate && isExactUnchargedFailedPaymentIntent(prior, configuration, binding)) {
      const failedCharge = prior.latest_charge
        ? await readExactUnchargedFailedCharge(configuration, binding, prior, requestIds)
        : null;
      return {
        unchargedFailure: true,
        paymentIntent: prior,
        failedCharge,
        disposition: 'existing-uncharged-failure',
      };
    }
    return { paymentIntent: validatePaymentIntent(prior, configuration, binding), disposition: 'existing-exact' };
  }
  if (!allowCreate) return null;
  const idempotencyKey = paymentIntentIdempotencyKey(configuration, binding);
  try {
    const response = await stripeRequest(configuration, 'POST', '/v1/payment_intents', {
      idempotencyKey,
      form: {
        amount: '100',
        currency: 'aud',
        customer: binding.customerId,
        payment_method: binding.defaultPaymentMethodId,
        confirm: 'true',
        off_session: 'true',
        description: 'AssessSuite Physio synthetic live QA validation — AUD 1.00',
        ...validationMetadata(configuration, binding),
      },
    });
    requestIds.push(response.providerRequestId);
    return {
      paymentIntent: validatePaymentIntent(response.body, configuration, binding),
      disposition: 'created-confirmed',
    };
  } catch (payment_intent_create_response_unknown) {
    recordProviderRequestId(requestIds, payment_intent_create_response_unknown.providerRequestId);
    if (payment_intent_create_response_unknown instanceof StripeProviderRejection) {
      throw payment_intent_create_response_unknown;
    }
    const resolved = await listExactPaymentIntents(configuration, binding, requestIds);
    if (!resolved) {
      throw new AggregateError(
        [payment_intent_create_response_unknown],
        'payment_intent_create_response_unknown: no exact provider object was discoverable; cleanup resume is required',
      );
    }
    return {
      paymentIntent: validatePaymentIntent(resolved, configuration, binding),
      disposition: 'created-unknown-resolved',
    };
  }
}

async function readExactPaymentIntent(configuration, binding, paymentIntentId, requestIds) {
  const response = await stripeRequest(
    configuration,
    'GET',
    `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
  );
  requestIds.push(response.providerRequestId);
  return validatePaymentIntent(response.body, configuration, binding);
}

async function readExactCharge(configuration, binding, paymentIntent, requestIds) {
  const response = await stripeRequest(
    configuration,
    'GET',
    `/v1/charges/${encodeURIComponent(paymentIntent.latest_charge)}`,
  );
  requestIds.push(response.providerRequestId);
  const charge = exactLive(response.body, 'AUD 1.00 resulting Charge');
  if (
    charge.id !== paymentIntent.latest_charge
    || charge.payment_intent !== paymentIntent.id
    || charge.customer !== binding.customerId
    || charge.payment_method !== binding.defaultPaymentMethodId
    || charge.amount !== 100
    || charge.amount_captured !== 100
    || charge.currency !== 'aud'
    || charge.paid !== true
    || charge.status !== 'succeeded'
    || !(charge.invoice === null || charge.invoice === undefined)
  ) {
    throw new TypeError('AUD 1.00 resulting Charge is not an exact non-invoice PaymentIntent charge');
  }
  return charge;
}

async function listExactRefunds(configuration, binding, paymentIntent, charge, requestIds) {
  const candidates = await stripeListAll(
    configuration,
    `/v1/refunds?charge=${encodeURIComponent(charge.id)}&limit=100`,
    requestIds,
    'AUD 1.00 Refund discovery',
  );
  const metadataDrift = candidates.some((candidate) => (
    candidate?.metadata?.qaSequence === configuration.sequenceId
    && !exactMetadata(candidate.metadata, configuration, binding)
  ));
  if (metadataDrift) {
    throw new TypeError('AUD 1.00 Refund discovery found cross-object metadata drift');
  }
  const matches = candidates.filter((candidate) => (
    candidate?.livemode === true
    && candidate.charge === charge.id
    && candidate.payment_intent === paymentIntent.id
    && exactMetadata(candidate.metadata, configuration, binding)
  ));
  if (matches.length > 1) throw new TypeError('AUD 1.00 Refund discovery is ambiguous');
  return matches[0] || null;
}

function validateRefund(value, configuration, binding, paymentIntent, charge) {
  const refund = exactLive(value, 'AUD 1.00 full Refund');
  if (
    !REFUND_ID.test(refund.id || '')
    || refund.charge !== charge.id
    || refund.payment_intent !== paymentIntent.id
    || refund.amount !== 100
    || refund.currency !== 'aud'
    || refund.status !== 'succeeded'
    || !exactMetadata(refund.metadata, configuration, binding)
  ) {
    throw new TypeError('AUD 1.00 Refund lacks the exact full succeeded binding');
  }
  return refund;
}

async function createOrResolveRefund(configuration, binding, paymentIntent, charge, requestIds) {
  const prior = await listExactRefunds(configuration, binding, paymentIntent, charge, requestIds);
  if (prior) {
    return {
      refund: validateRefund(prior, configuration, binding, paymentIntent, charge),
      disposition: 'existing-exact',
    };
  }
  const idempotencyKey = refundIdempotencyKey(configuration, binding, paymentIntent.id, charge.id);
  try {
    const response = await stripeRequest(configuration, 'POST', '/v1/refunds', {
      idempotencyKey,
      form: {
        charge: charge.id,
        amount: '100',
        reason: 'requested_by_customer',
        ...validationMetadata(configuration, binding),
      },
    });
    requestIds.push(response.providerRequestId);
    return {
      refund: validateRefund(response.body, configuration, binding, paymentIntent, charge),
      disposition: 'created-confirmed',
    };
  } catch (refund_create_response_unknown) {
    recordProviderRequestId(requestIds, refund_create_response_unknown.providerRequestId);
    if (refund_create_response_unknown instanceof StripeProviderRejection) {
      throw refund_create_response_unknown;
    }
    const resolved = await listExactRefunds(
      configuration,
      binding,
      paymentIntent,
      charge,
      requestIds,
    );
    if (!resolved) {
      throw new AggregateError(
        [refund_create_response_unknown],
        'refund_create_response_unknown: exact full Refund was not discoverable; cleanup resume is required',
      );
    }
    return {
      refund: validateRefund(resolved, configuration, binding, paymentIntent, charge),
      disposition: 'created-unknown-resolved',
    };
  }
}

async function readExactRefund(configuration, binding, refund, paymentIntent, charge, requestIds) {
  const response = await stripeRequest(
    configuration,
    'GET',
    `/v1/refunds/${encodeURIComponent(refund.id)}`,
  );
  requestIds.push(response.providerRequestId);
  return validateRefund(response.body, configuration, binding, paymentIntent, charge);
}

async function executeValidation(configuration, binding, {
  allowPaymentIntentCreate,
  requirePaymentIntent,
}) {
  if (
    configuration.cardEntryMechanism !== SELF_SERVICE_CARD_ENTRY_MECHANISM
    || !/^[0-9a-f]{64}$/.test(configuration.expectedEmailConfigurationReceiptSha256 || '')
    || !PAYMENT_METHOD_ID.test(binding.defaultPaymentMethodId || '')
    || sha256(binding.checkoutSessionId) !== binding.checkoutSessionIdSha256
    || sha256(binding.customerId) !== binding.customerIdSha256
    || sha256(binding.subscriptionId) !== binding.subscriptionIdSha256
    || sha256(binding.defaultPaymentMethodId) !== binding.defaultPaymentMethodIdSha256
  ) {
    throw new TypeError('AUD 1.00 validation input binding differs');
  }
  const requestIds = [];
  await readFoundation(configuration, binding, requestIds);
  const created = await createOrResolvePaymentIntent(
    configuration,
    binding,
    requestIds,
    { allowCreate: allowPaymentIntentCreate },
  );
  if (!created) {
    if (requirePaymentIntent) throw new TypeError('AUD 1.00 validation did not create its exact PaymentIntent');
    return Object.freeze({
      result: 'PASS',
      provider: 'stripe',
      provider_objects_created: false,
      actual_charge_aud_cents: 0,
      refunded_aud_cents: 0,
      provider_request_ids_sha256: providerRequestDigest(requestIds),
      observed_at: new Date().toISOString(),
    });
  }
  if (created.unchargedFailure) {
    return Object.freeze({
      result: 'PASS',
      provider: 'stripe',
      provider_objects_created: true,
      payment_intent_id_sha256: sha256(created.paymentIntent.id),
      payment_intent_status: created.paymentIntent.status,
      ...(created.failedCharge ? {
        failed_charge_id_sha256: sha256(created.failedCharge.id),
        failed_charge_status: created.failedCharge.status,
      } : {}),
      actual_charge_aud_cents: 0,
      refunded_aud_cents: 0,
      resolution: 'exact-uncharged-payment-intent-failure',
      provider_request_ids_sha256: providerRequestDigest(requestIds),
      observed_at: new Date().toISOString(),
    });
  }
  const paymentIntent = await readExactPaymentIntent(
    configuration,
    binding,
    created.paymentIntent.id,
    requestIds,
  );
  const chargeBeforeRefund = await readExactCharge(
    configuration,
    binding,
    paymentIntent,
    requestIds,
  );
  if (Number(chargeBeforeRefund.amount_refunded || 0) > 100) {
    throw new TypeError('AUD 1.00 Charge refund amount exceeds the authorised validation amount');
  }
  const refunded = await createOrResolveRefund(
    configuration,
    binding,
    paymentIntent,
    chargeBeforeRefund,
    requestIds,
  );
  const refund = await readExactRefund(
    configuration,
    binding,
    refunded.refund,
    paymentIntent,
    chargeBeforeRefund,
    requestIds,
  );
  const charge = await readExactCharge(configuration, binding, paymentIntent, requestIds);
  if (charge.amount_refunded !== 100 || charge.refunded !== true) {
    throw new TypeError('AUD 1.00 Charge amount_refunded was not the exact full amount');
  }

  const paymentIntentKey = paymentIntentIdempotencyKey(configuration, binding);
  const refundKey = refundIdempotencyKey(configuration, binding, paymentIntent.id, charge.id);
  const receipt = {
    contract_version: CONTRACT_VERSION,
    action: 'validate_payment',
    result: 'PASS',
    provider: 'stripe',
    livemode: true,
    application: configuration.application,
    app_id: configuration.appId,
    profession_id: configuration.professionId,
    l5_intent_id: configuration.l5IntentId,
    qa_sequence_sha256: sha256(configuration.sequenceId),
    card_entry_mechanism: SELF_SERVICE_CARD_ENTRY_MECHANISM,
    provision_receipt_sha256: configuration.expectedProvisionReceiptSha256,
    provision_ledger_sha256: configuration.provisionLedgerSha256,
    email_configuration_receipt_sha256:
      configuration.expectedEmailConfigurationReceiptSha256,
    validation_input_ledger_sha256: configuration.validationInputLedgerSha256
      || binding.validationInputLedgerSha256,
    checkout_session_id_sha256: sha256(binding.checkoutSessionId),
    customer_id_sha256: sha256(binding.customerId),
    subscription_id_sha256: sha256(binding.subscriptionId),
    default_payment_method_id_sha256: sha256(binding.defaultPaymentMethodId),
    payment_intent_id_sha256: sha256(paymentIntent.id),
    charge_id_sha256: sha256(charge.id),
    refund_id_sha256: sha256(refund.id),
    payment_intent_idempotency_key_sha256: sha256(paymentIntentKey),
    refund_idempotency_key_sha256: sha256(refundKey),
    payment_intent_create_disposition: created.disposition,
    refund_create_disposition: refunded.disposition,
    amount_aud_cents: 100,
    maximum_authorised_aud_cents: 2_000,
    currency: 'aud',
    payment_intent_status: 'succeeded',
    charge_status: 'succeeded',
    refund_status: 'succeeded',
    amount_received_aud_cents: paymentIntent.amount_received,
    amount_captured_aud_cents: charge.amount_captured,
    refunded_aud_cents: charge.amount_refunded,
    charge_invoice_present: false,
    direct_charges_api_create_used: false,
    invoice_reconciliation_used: false,
    api_version: SELF_SERVICE_STRIPE_API_VERSION,
    provider_request_ids_sha256: providerRequestDigest(requestIds),
    completed_at: new Date().toISOString(),
  };
  assertExactKeys(receipt, LIVE_PAYMENT_VALIDATION_RECEIPT_KEYS, 'AUD 1.00 validation receipt');
  return Object.freeze(receipt);
}

export async function resolveLivePaymentValidationBinding(configuration, {
  checkoutSessionId,
  userIdSha256,
  customerId,
  subscriptionId,
  checkoutSessionIdSha256,
  customerIdSha256,
  subscriptionIdSha256,
  defaultPaymentMethodIdSha256,
  validationInputLedgerSha256,
}) {
  if (
    sha256(checkoutSessionId) !== checkoutSessionIdSha256
    || sha256(customerId) !== customerIdSha256
    || sha256(subscriptionId) !== subscriptionIdSha256
    || !/^[0-9a-f]{64}$/.test(defaultPaymentMethodIdSha256 || '')
  ) {
    throw new TypeError('Cleanup validation-payment discovery hashes differ');
  }
  const subscriptionResponse = await stripeRequest(
    configuration,
    'GET',
    `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
  const subscription = exactLive(subscriptionResponse.body, 'cleanup validation subscription');
  const defaultPaymentMethodId = typeof subscription.default_payment_method === 'object'
    ? subscription.default_payment_method?.id
    : subscription.default_payment_method;
  if (
    subscription.id !== subscriptionId
    || subscription.customer !== customerId
    || !PAYMENT_METHOD_ID.test(defaultPaymentMethodId || '')
    || sha256(defaultPaymentMethodId) !== defaultPaymentMethodIdSha256
  ) {
    throw new TypeError('Cleanup validation subscription/default PaymentMethod differs');
  }
  const binding = {
    userIdSha256,
    checkoutSessionId,
    checkoutSessionIdSha256,
    customerId,
    customerIdSha256,
    subscriptionId,
    subscriptionIdSha256,
    defaultPaymentMethodId,
    defaultPaymentMethodIdSha256,
    validationInputLedgerSha256,
  };
  const requestIds = [subscriptionResponse.providerRequestId];
  await readFoundation(configuration, binding, requestIds);
  return Object.freeze(binding);
}

export async function validateAndRefundLivePayment(configuration, binding) {
  return executeValidation(configuration, binding, {
    allowPaymentIntentCreate: true,
    requirePaymentIntent: true,
  });
}

export async function reconcileAndRefundLivePaymentForCleanup(configuration, binding) {
  return executeValidation(configuration, binding, {
    allowPaymentIntentCreate: false,
    requirePaymentIntent: false,
  });
}
