import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  SELF_SERVICE_CARD_ENTRY_MECHANISM,
  canonicalJson,
  sha256,
} from '../../e2e/physio-live-self-service/self-service-contract.mjs';
import {
  reconcileAndRefundLivePaymentForCleanup,
  validateAndRefundLivePayment,
} from '../../e2e/physio-live-self-service/stripe-live-payment-validation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lane = path.join(root, 'e2e', 'physio-live-self-service');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8').replaceAll('\r\n', '\n');
}

function ordered(source, markers, label) {
  let cursor = -1;
  for (const marker of markers) {
    const next = typeof marker === 'string'
      ? source.indexOf(marker, cursor + 1)
      : source.slice(cursor + 1).search(marker) + cursor + 1;
    assert.ok(next > cursor, `${label}: missing or out-of-order marker ${String(marker)}`);
    cursor = next;
  }
}

test('hosted Checkout collects a reusable default payment method without caller-controlled payment rails', () => {
  const gateway = read('server', 'stripeGateway.mjs');
  const checkout = read('server', 'functions', 'createCheckoutSession.mjs');
  const origins = read('server', 'publicRequestOrigin.mjs');

  assert.match(gateway, /\['payment_method_collection', 'always'\]/,
    'the zero-due trial must still collect a reusable payment method');
  assert.doesNotMatch(`${gateway}\n${checkout}`, /payment_method_types/,
    'Stripe dynamic payment methods must remain provider-selected');
  assert.match(gateway, /integrationSuffixForIntent[\s\S]*subarray\(0, 8\)[\s\S]*byte % 26/,
    'integration_identifier needs an eight-letter intent-stable provider suffix');
  assert.match(gateway, /assesssuite_physio_\$\{integrationSuffix\}/);
  assert.match(origins, /https:\/\/assesssuite-physio-production\.fly\.dev/);
  assert.match(origins, /https:\/\/physio\.app\.assesssuite\.com/);
  assert.match(checkout, /resolvePublicRequestOrigin\(\{ request: ctx\.request/,
    'return URLs must come from trusted request metadata, never caller JSON');
  assert.doesNotMatch(checkout, /body\?\.(?:success|cancel|return|origin|host|url)/i);
});

test('AUD 1.00 validation uses an idempotent PaymentIntent, exact Charge readback and immediate full Refund', () => {
  const relative = path.join('e2e', 'physio-live-self-service', 'stripe-live-payment-validation.mjs');
  const absolute = path.join(root, relative);
  assert.ok(fs.existsSync(absolute), `${relative} is required`);
  const source = fs.readFileSync(absolute, 'utf8').replaceAll('\r\n', '\n');

  for (const marker of [
    'PAYMENT_VALIDATION_RECEIPT_VERSION',
    'amount_aud_cents: 100',
    'maximum_authorised_aud_cents: 2_000',
    "currency: 'aud'",
    "'metadata[appId]'",
    "'metadata[professionId]'",
    "'metadata[l5IntentId]'",
    "'metadata[qaSequence]'",
    "'metadata[subscriptionId]'",
    "'metadata[provisionReceiptSha256]'",
    "'metadata[provisionLedgerSha256]'",
    "'metadata[emailConfigurationReceiptSha256]'",
    "'Idempotency-Key'",
    'payment_intent_create_response_unknown',
    'refund_create_response_unknown',
    'provider_request_ids_sha256',
    'payment_intent_id_sha256',
    'charge_id_sha256',
    'refund_id_sha256',
  ]) assert.ok(source.includes(marker), `AUD 1.00 validation is missing ${marker}`);

  ordered(source, [
    /\/v1\/checkout\/sessions\//,
    /\/v1\/subscriptions\//,
    /default_payment_method/,
    /\/v1\/payment_methods\//,
    /\/v1\/payment_intents/,
    /\/v1\/charges\//,
    /\/v1\/refunds/,
    /\/v1\/refunds\//,
    /amount_refunded/,
  ], 'AUD 1.00 provider lifecycle');

  assert.doesNotMatch(source, /payment_method_types/,
    'the validation action may not override Stripe dynamic payment methods');
  assert.doesNotMatch(source, /(?:POST[^\n]{0,200}\/v1\/charges|\/v1\/charges[^\n]{0,200}method:\s*['"]POST)/s,
    'a direct Charges API create is prohibited');
  assert.doesNotMatch(source, /\/v1\/invoices/,
    'a direct PaymentIntent charge must not be misrepresented as invoice reconciliation');
  assert.match(source, /charge\.invoice[\s\S]{0,160}(?:null|undefined)/,
    'the resulting direct charge must be proven non-invoice');
  assert.match(source, /off_session[\s\S]{0,120}(?:true|'true')/);
  assert.match(source, /confirm[\s\S]{0,120}(?:true|'true')/);
  assert.match(source, /amount_received[\s\S]{0,160}100/);
  assert.match(source, /amount_captured[\s\S]{0,160}100/);
  assert.match(source, /amount_refunded[\s\S]{0,160}100/);
  assert.match(source, /livemode[\s\S]{0,120}true/);
  assert.match(source, /status[\s\S]{0,120}succeeded/);
});

test('AUD 1.00 response-loss recovery is durably bound to provision and cleanup receipts', () => {
  const validationPath = path.join(lane, 'validate-payment.mjs');
  assert.ok(fs.existsSync(validationPath), 'the separate provider-direct validate_payment phase is required');
  const validation = fs.readFileSync(validationPath, 'utf8').replaceAll('\r\n', '\n');
  const contract = read('e2e', 'physio-live-self-service', 'self-service-contract.mjs');
  const resume = read('e2e', 'physio-live-self-service', 'resume-cleanup.mjs');
  const finalize = read('e2e', 'physio-live-self-service', 'finalize.spec.mjs');
  const wrapper = read('scripts', 'run-physio-live-self-service.mjs');
  const packageJson = read('package.json');

  for (const marker of [
    'expectedProvisionReceiptSha256',
    'provisionLedgerSha256',
    'validationInputLedgerSha256',
    'expectedEmailConfigurationReceiptSha256',
    'stripe-live-payment-validation-reconciliation',
    'markValidationPaymentStarted',
    'validateAndRefundLivePayment',
    'writeCleanupLedger',
    'paymentValidationReceiptSha256',
  ]) assert.ok(`${validation}\n${contract}`.includes(marker), `durable validation phase is missing ${marker}`);
  ordered(validation, [
    'markValidationPaymentStarted',
    'writeCleanupLedger',
    'validateAndRefundLivePayment',
    'paymentValidationReceiptSha256',
  ], 'durable AUD 1.00 effect order');

  assert.match(resume, /reconcileAndRefundLivePaymentForCleanup/,
    'cleanup resume must resolve a started PaymentIntent/refund before subscription cancellation completes');
  ordered(resume, [
    /paymentValidationReconciliation = await reconcileAndRefundLivePaymentForCleanup\(/,
    /await cancelSubscriptionForCleanup\(live, binding\)/,
  ], 'failed or response-lost validation cleanup before trial cancellation');
  assert.match(contract, /stripe-live-payment-validation-reconciliation/);
  assert.match(
    read('e2e', 'physio-live-self-service', 'stripe-live-payment-validation.mjs'),
    /resolution: 'exact-uncharged-payment-intent-failure'/,
    'a provably uncharged off-session failure must yield a cleanup receipt instead of blocking cancellation',
  );
  assert.match(finalize, /expectedPaymentValidationReceiptSha256/,
    'finalization must consume the exact completed AUD 1.00 receipt');
  assert.match(wrapper, /validate_payment/);
  assert.match(packageJson, /test:physio-live-self-service:validate_payment/);
  assert.doesNotMatch(`${validation}\n${resume}`, /(?:000000|pm_card_|tok_visa|test clock)/i,
    'live evidence may not use a test card, token or Stripe test clock');
});

function stripeResponse(body, number) {
  return {
    status: 200,
    headers: { get: (name) => (name.toLowerCase() === 'request-id'
      ? `req_validation${String(number).padStart(3, '0')}`
      : null) },
    json: async () => body,
  };
}

function validationFixture() {
  const configuration = {
    stripeSecretKey: `sk_live_${'a'.repeat(40)}`,
    application: 'assesssuite-physio-production',
    appId: 'local-assesssuite-physio',
    professionId: 'physio',
    l5IntentId: ['CAP-PHYSIO-VALIDATION', '123456abcdef'].join('-'),
    sequenceId: 'assesssuite-physio-self-service-123456abcdef',
    email: 'acceptance+assesssuite-physio-self-service-123456abcdef@example.test',
    cardEntryMechanism: SELF_SERVICE_CARD_ENTRY_MECHANISM,
    expectedProvisionReceiptSha256: '1'.repeat(64),
    provisionLedgerSha256: '2'.repeat(64),
    validationInputLedgerSha256: '3'.repeat(64),
    expectedEmailConfigurationReceiptSha256: '4'.repeat(64),
  };
  const ids = {
    user: 'user_exact_validation',
    checkout: 'cs_live_validation123456',
    customer: 'cus_validation123456',
    subscription: 'sub_validation123456',
    paymentMethod: 'pm_validation123456',
    paymentIntent: 'pi_validation123456',
    charge: 'ch_validation123456',
    refund: 're_validation123456',
  };
  const binding = {
    userIdSha256: sha256(ids.user),
    checkoutSessionId: ids.checkout,
    checkoutSessionIdSha256: sha256(ids.checkout),
    customerId: ids.customer,
    customerIdSha256: sha256(ids.customer),
    subscriptionId: ids.subscription,
    subscriptionIdSha256: sha256(ids.subscription),
    defaultPaymentMethodId: ids.paymentMethod,
    defaultPaymentMethodIdSha256: sha256(ids.paymentMethod),
  };
  const metadata = {
    appId: configuration.appId,
    professionId: configuration.professionId,
    l5IntentId: configuration.l5IntentId,
    qaSequence: configuration.sequenceId,
    subscriptionId: ids.subscription,
    provisionReceiptSha256: configuration.expectedProvisionReceiptSha256,
    provisionLedgerSha256: configuration.provisionLedgerSha256,
    emailConfigurationReceiptSha256:
      configuration.expectedEmailConfigurationReceiptSha256,
    validationPurpose: 'assesssuite_physio_live_payment_validation',
  };
  return { configuration, ids, binding, metadata };
}

test('AUD 1.00 committed-but-response-lost PaymentIntent and Refund resolve without duplicate mutation', { concurrency: false }, async () => {
  const { configuration, ids, binding, metadata } = validationFixture();
  let paymentIntentCommitted = false;
  let refundCommitted = false;
  let requestNumber = 0;
  let paymentIntentPosts = 0;
  let refundPosts = 0;
  const paymentIntent = () => ({
    id: ids.paymentIntent,
    livemode: true,
    amount: 100,
    amount_received: 100,
    currency: 'aud',
    customer: ids.customer,
    payment_method: ids.paymentMethod,
    status: 'succeeded',
    latest_charge: ids.charge,
    metadata,
  });
  const charge = () => ({
    id: ids.charge,
    livemode: true,
    payment_intent: ids.paymentIntent,
    customer: ids.customer,
    payment_method: ids.paymentMethod,
    amount: 100,
    amount_captured: 100,
    amount_refunded: refundCommitted ? 100 : 0,
    refunded: refundCommitted,
    currency: 'aud',
    paid: true,
    status: 'succeeded',
    invoice: null,
  });
  const refund = () => ({
    id: ids.refund,
    livemode: true,
    charge: ids.charge,
    payment_intent: ids.paymentIntent,
    amount: 100,
    currency: 'aud',
    status: 'succeeded',
    metadata,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    const method = options.method || 'GET';
    requestNumber += 1;
    if (url.pathname === `/v1/checkout/sessions/${ids.checkout}`) {
      return stripeResponse({
        id: ids.checkout,
        livemode: true,
        status: 'complete',
        payment_status: 'no_payment_required',
        amount_total: 0,
        currency: 'aud',
        payment_method_collection: 'always',
        customer: ids.customer,
        subscription: ids.subscription,
        metadata: { userId: ids.user, qaSequence: configuration.sequenceId },
      }, requestNumber);
    }
    if (url.pathname === `/v1/subscriptions/${ids.subscription}`) {
      return stripeResponse({
        id: ids.subscription,
        livemode: true,
        customer: ids.customer,
        status: 'trialing',
        default_payment_method: ids.paymentMethod,
      }, requestNumber);
    }
    if (url.pathname === `/v1/customers/${ids.customer}`) {
      return stripeResponse({
        id: ids.customer,
        livemode: true,
        email: configuration.email,
        invoice_settings: { default_payment_method: ids.paymentMethod },
      }, requestNumber);
    }
    if (url.pathname === `/v1/payment_methods/${ids.paymentMethod}`) {
      return stripeResponse({
        id: ids.paymentMethod,
        livemode: true,
        customer: ids.customer,
        type: 'card',
      }, requestNumber);
    }
    if (url.pathname === '/v1/payment_intents' && method === 'GET') {
      return stripeResponse({
        has_more: false,
        data: paymentIntentCommitted ? [paymentIntent()] : [],
      }, requestNumber);
    }
    if (url.pathname === '/v1/payment_intents' && method === 'POST') {
      paymentIntentPosts += 1;
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('amount'), '100');
      assert.equal(form.get('confirm'), 'true');
      assert.equal(form.get('off_session'), 'true');
      assert.equal(form.get('metadata[l5IntentId]'), configuration.l5IntentId);
      assert.equal(
        form.get('metadata[emailConfigurationReceiptSha256]'),
        configuration.expectedEmailConfigurationReceiptSha256,
      );
      assert.equal(form.has('payment_method_types'), false);
      assert.match(options.headers['Idempotency-Key'], /^assesssuite_physio_validation_pi_/);
      paymentIntentCommitted = true;
      throw new Error('synthetic committed response loss');
    }
    if (url.pathname === `/v1/payment_intents/${ids.paymentIntent}`) {
      return stripeResponse(paymentIntent(), requestNumber);
    }
    if (url.pathname === `/v1/charges/${ids.charge}`) {
      return stripeResponse(charge(), requestNumber);
    }
    if (url.pathname === '/v1/refunds' && method === 'GET') {
      return stripeResponse({
        has_more: false,
        data: refundCommitted ? [refund()] : [],
      }, requestNumber);
    }
    if (url.pathname === '/v1/refunds' && method === 'POST') {
      refundPosts += 1;
      assert.match(options.headers['Idempotency-Key'], /^assesssuite_physio_validation_refund_/);
      assert.equal(
        new URLSearchParams(options.body).get('metadata[l5IntentId]'),
        configuration.l5IntentId,
      );
      refundCommitted = true;
      throw new Error('synthetic committed refund response loss');
    }
    if (url.pathname === `/v1/refunds/${ids.refund}`) {
      return stripeResponse(refund(), requestNumber);
    }
    throw new TypeError(`Unexpected Stripe test request ${method} ${url.pathname}`);
  };
  try {
    const receipt = await validateAndRefundLivePayment(configuration, binding);
    assert.equal(receipt.contract_version, 'assesssuite-stripe-live-payment-validation/2.0.0');
    assert.equal(receipt.result, 'PASS');
    assert.equal(receipt.payment_intent_create_disposition, 'created-unknown-resolved');
    assert.equal(receipt.refund_create_disposition, 'created-unknown-resolved');
    assert.equal(receipt.amount_aud_cents, 100);
    assert.equal(receipt.refunded_aud_cents, 100);
    assert.equal(receipt.l5_intent_id, configuration.l5IntentId);
    assert.equal(
      receipt.email_configuration_receipt_sha256,
      configuration.expectedEmailConfigurationReceiptSha256,
    );
    assert.equal(paymentIntentPosts, 1);
    assert.equal(refundPosts, 1);
    assert.doesNotMatch(canonicalJson(receipt), /pi_validation|ch_validation|re_validation|pm_validation/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AUD 1.00 rejects a Refund whose direct provider readback loses the exact mission metadata', { concurrency: false }, async () => {
  const {
    configuration,
    ids,
    binding,
    metadata,
  } = validationFixture();
  let requestNumber = 0;
  let refundPosts = 0;
  const paymentIntent = {
    id: ids.paymentIntent,
    livemode: true,
    amount: 100,
    amount_received: 100,
    currency: 'aud',
    customer: ids.customer,
    payment_method: ids.paymentMethod,
    status: 'succeeded',
    latest_charge: ids.charge,
    metadata,
  };
  const charge = {
    id: ids.charge,
    livemode: true,
    payment_intent: ids.paymentIntent,
    customer: ids.customer,
    payment_method: ids.paymentMethod,
    amount: 100,
    amount_captured: 100,
    amount_refunded: 0,
    refunded: false,
    currency: 'aud',
    paid: true,
    status: 'succeeded',
    invoice: null,
  };
  const refund = {
    id: ids.refund,
    livemode: true,
    charge: ids.charge,
    payment_intent: ids.paymentIntent,
    amount: 100,
    currency: 'aud',
    status: 'succeeded',
    metadata,
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    const method = options.method || 'GET';
    requestNumber += 1;
    if (url.pathname === `/v1/checkout/sessions/${ids.checkout}`) {
      return stripeResponse({
        id: ids.checkout,
        livemode: true,
        status: 'complete',
        payment_status: 'no_payment_required',
        amount_total: 0,
        currency: 'aud',
        payment_method_collection: 'always',
        customer: ids.customer,
        subscription: ids.subscription,
        metadata: { userId: ids.user, qaSequence: configuration.sequenceId },
      }, requestNumber);
    }
    if (url.pathname === `/v1/subscriptions/${ids.subscription}`) {
      return stripeResponse({
        id: ids.subscription,
        livemode: true,
        customer: ids.customer,
        status: 'trialing',
        default_payment_method: ids.paymentMethod,
      }, requestNumber);
    }
    if (url.pathname === `/v1/customers/${ids.customer}`) {
      return stripeResponse({
        id: ids.customer,
        livemode: true,
        email: configuration.email,
        invoice_settings: { default_payment_method: ids.paymentMethod },
      }, requestNumber);
    }
    if (url.pathname === `/v1/payment_methods/${ids.paymentMethod}`) {
      return stripeResponse({
        id: ids.paymentMethod,
        livemode: true,
        customer: ids.customer,
        type: 'card',
      }, requestNumber);
    }
    if (url.pathname === '/v1/payment_intents' && method === 'GET') {
      return stripeResponse({ has_more: false, data: [paymentIntent] }, requestNumber);
    }
    if (url.pathname === `/v1/payment_intents/${ids.paymentIntent}`) {
      return stripeResponse(paymentIntent, requestNumber);
    }
    if (url.pathname === `/v1/charges/${ids.charge}`) {
      return stripeResponse(charge, requestNumber);
    }
    if (url.pathname === '/v1/refunds' && method === 'GET') {
      return stripeResponse({ has_more: false, data: [] }, requestNumber);
    }
    if (url.pathname === '/v1/refunds' && method === 'POST') {
      refundPosts += 1;
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('metadata[l5IntentId]'), configuration.l5IntentId);
      assert.equal(form.get('metadata[provisionReceiptSha256]'), configuration.expectedProvisionReceiptSha256);
      assert.equal(
        form.get('metadata[emailConfigurationReceiptSha256]'),
        configuration.expectedEmailConfigurationReceiptSha256,
      );
      return stripeResponse(refund, requestNumber);
    }
    if (url.pathname === `/v1/refunds/${ids.refund}`) {
      return stripeResponse({
        ...refund,
        metadata: { ...metadata, provisionReceiptSha256: 'f'.repeat(64) },
      }, requestNumber);
    }
    throw new TypeError(`Unexpected Stripe test request ${method} ${url.pathname}`);
  };
  try {
    await assert.rejects(
      () => validateAndRefundLivePayment(configuration, binding),
      /Refund lacks the exact full succeeded binding/,
    );
    assert.equal(refundPosts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cleanup proves an off-session authentication failure uncharged before preserving trial cancellation', { concurrency: false }, async () => {
  const {
    configuration,
    ids,
    binding,
    metadata,
  } = validationFixture();
  let requestNumber = 0;
  let providerPosts = 0;
  let capturedAmount = 0;
  const paymentIntent = {
    id: ids.paymentIntent,
    livemode: true,
    amount: 100,
    amount_received: 0,
    amount_capturable: 0,
    currency: 'aud',
    customer: ids.customer,
    payment_method: ids.paymentMethod,
    status: 'requires_action',
    latest_charge: ids.charge,
    metadata,
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    const method = options.method || 'GET';
    requestNumber += 1;
    if (method === 'POST') providerPosts += 1;
    if (url.pathname === `/v1/checkout/sessions/${ids.checkout}`) {
      return stripeResponse({
        id: ids.checkout,
        livemode: true,
        status: 'complete',
        payment_status: 'no_payment_required',
        amount_total: 0,
        currency: 'aud',
        payment_method_collection: 'always',
        customer: ids.customer,
        subscription: ids.subscription,
        metadata: { userId: ids.user, qaSequence: configuration.sequenceId },
      }, requestNumber);
    }
    if (url.pathname === `/v1/subscriptions/${ids.subscription}`) {
      return stripeResponse({
        id: ids.subscription,
        livemode: true,
        customer: ids.customer,
        status: 'trialing',
        default_payment_method: ids.paymentMethod,
      }, requestNumber);
    }
    if (url.pathname === `/v1/customers/${ids.customer}`) {
      return stripeResponse({
        id: ids.customer,
        livemode: true,
        email: configuration.email,
        invoice_settings: { default_payment_method: ids.paymentMethod },
      }, requestNumber);
    }
    if (url.pathname === `/v1/payment_methods/${ids.paymentMethod}`) {
      return stripeResponse({
        id: ids.paymentMethod,
        livemode: true,
        customer: ids.customer,
        type: 'card',
      }, requestNumber);
    }
    if (url.pathname === '/v1/payment_intents' && method === 'GET') {
      return stripeResponse({ has_more: false, data: [paymentIntent] }, requestNumber);
    }
    if (url.pathname === `/v1/charges/${ids.charge}`) {
      return stripeResponse({
        id: ids.charge,
        livemode: true,
        payment_intent: ids.paymentIntent,
        customer: ids.customer,
        payment_method: ids.paymentMethod,
        amount: 100,
        amount_captured: capturedAmount,
        amount_refunded: 0,
        refunded: false,
        currency: 'aud',
        paid: false,
        status: 'failed',
        invoice: null,
      }, requestNumber);
    }
    throw new TypeError(`Unexpected Stripe test request ${method} ${url.pathname}`);
  };
  try {
    const receipt = await reconcileAndRefundLivePaymentForCleanup(configuration, binding);
    assert.equal(receipt.result, 'PASS');
    assert.equal(receipt.resolution, 'exact-uncharged-payment-intent-failure');
    assert.equal(receipt.payment_intent_status, 'requires_action');
    assert.equal(receipt.failed_charge_id_sha256, sha256(ids.charge));
    assert.equal(receipt.failed_charge_status, 'failed');
    assert.equal(receipt.actual_charge_aud_cents, 0);
    assert.equal(receipt.refunded_aud_cents, 0);
    assert.equal(providerPosts, 0);

    capturedAmount = 1;
    await assert.rejects(
      () => reconcileAndRefundLivePaymentForCleanup(configuration, binding),
      /failed Charge is not exact and provably uncharged/,
    );
    assert.equal(providerPosts, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AUD 1.00 rejects an invoice-linked or wrong-bound charge before Refund mutation', { concurrency: false }, async () => {
  const { configuration, ids, binding, metadata } = validationFixture();
  let refundMutations = 0;
  let requestNumber = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    const method = options.method || 'GET';
    requestNumber += 1;
    if (method === 'POST') refundMutations += url.pathname === '/v1/refunds' ? 1 : 0;
    const objects = {
      [`/v1/checkout/sessions/${ids.checkout}`]: {
        id: ids.checkout, livemode: true, status: 'complete', payment_status: 'no_payment_required',
        amount_total: 0, currency: 'aud', payment_method_collection: 'always',
        customer: ids.customer, subscription: ids.subscription,
        metadata: { userId: ids.user, qaSequence: configuration.sequenceId },
      },
      [`/v1/subscriptions/${ids.subscription}`]: {
        id: ids.subscription, livemode: true, customer: ids.customer, status: 'trialing',
        default_payment_method: ids.paymentMethod,
      },
      [`/v1/customers/${ids.customer}`]: {
        id: ids.customer, livemode: true, email: configuration.email,
        invoice_settings: { default_payment_method: ids.paymentMethod },
      },
      [`/v1/payment_methods/${ids.paymentMethod}`]: {
        id: ids.paymentMethod, livemode: true, customer: ids.customer, type: 'card',
      },
      [`/v1/payment_intents/${ids.paymentIntent}`]: {
        id: ids.paymentIntent, livemode: true, amount: 100, amount_received: 100,
        currency: 'aud', customer: ids.customer, payment_method: ids.paymentMethod,
        status: 'succeeded', latest_charge: ids.charge, metadata,
      },
      [`/v1/charges/${ids.charge}`]: {
        id: ids.charge, livemode: true, payment_intent: ids.paymentIntent,
        customer: ids.customer, payment_method: ids.paymentMethod, amount: 100,
        amount_captured: 100, amount_refunded: 0, refunded: false, currency: 'aud',
        paid: true, status: 'succeeded', invoice: 'in_forbidden_invoice_reconciliation',
      },
    };
    if (url.pathname === '/v1/payment_intents') {
      return stripeResponse({ has_more: false, data: [objects[`/v1/payment_intents/${ids.paymentIntent}`]] }, requestNumber);
    }
    if (objects[url.pathname]) return stripeResponse(objects[url.pathname], requestNumber);
    throw new TypeError(`Unexpected Stripe test request ${method} ${url.pathname}`);
  };
  try {
    await assert.rejects(
      () => validateAndRefundLivePayment(configuration, binding),
      /non-invoice PaymentIntent charge/,
    );
    assert.equal(refundMutations, 0);
    await assert.rejects(
      () => validateAndRefundLivePayment(configuration, {
        ...binding,
        defaultPaymentMethodIdSha256: 'f'.repeat(64),
      }),
      /input binding differs/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
