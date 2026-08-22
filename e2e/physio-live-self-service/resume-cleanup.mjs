import fs from 'node:fs';

import {
  RESUME_CLEANUP_RECEIPT_VERSION,
  assertInputLedgerHash,
  assertPaymentValidationLedgerSnapshot,
  assertProvisionLedgerSnapshot,
  canonicalJson,
  markCleanupCompleted,
  readCleanupLedger,
  readPaymentValidationReceipt,
  readProvisionAttemptReceipt,
  readProvisionReceipt,
  resolveSelfServiceConfiguration,
  sha256,
  updateCleanupStep,
  writeCleanupLedger,
  writeResumeCleanupReceipt,
} from './self-service-contract.mjs';
import {
  readEmailConfigurationReceipt,
  validateEmailReadbackReceipt,
  waitForProviderEmail,
} from './email-provider-readback.mjs';
import {
  cancelSubscriptionForCleanup,
  discoverExactCheckoutSessionId,
  reconcileIncompleteCheckoutForCleanup,
  readLiveStripeState,
  refundLiveCharges,
} from './stripe-live-readback.mjs';
import {
  reconcileAndRefundLivePaymentForCleanup,
  resolveLivePaymentValidationBinding,
} from './stripe-live-payment-validation.mjs';
import { removeTrustedBrowserHandoff } from './trusted-browser-checkout.mjs';

const live = resolveSelfServiceConfiguration(process.env, 'resume-cleanup');
removeTrustedBrowserHandoff(live);
const apiRoot = `${live.origin}/api/apps/${live.appId}`;

async function appJson(method, route, { token = null, body = undefined } = {}) {
  const response = await fetch(`${apiRoot}${route}`, {
    method,
    headers: {
      'X-App-Id': live.appId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(45_000),
  });
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError(`Cleanup application readback returned status ${response.status}`);
  }
  return { status: response.status, body: payload };
}

async function readAccountState() {
  for (const password of [live.replacementPassword, live.initialPassword]) {
    const response = await appJson('POST', '/auth/login', {
      body: { email: live.email, password },
    });
    if (response.status === 200 && typeof response.body.access_token === 'string') {
      return {
        state: 'active',
        token: response.body.access_token,
        user: response.body.user,
      };
    }
    if (
      response.status === 403
      && response.body.error === 'account_deactivated'
      && response.body.account_status === 'deactivated'
      && !Object.hasOwn(response.body, 'access_token')
    ) {
      return { state: 'deactivated', token: null, user: null };
    }
  }
  return { state: 'unresolved', token: null, user: null };
}

function ensureStarted(ledger, name) {
  const step = ledger.steps.find((candidate) => candidate.name === name);
  if (!step) throw new TypeError(`Cleanup ledger omitted ${name}`);
  if (step.state === 'pending') updateCleanupStep(live, ledger, name, 'started');
  else if (step.state === 'failed') {
    updateCleanupStep(live, ledger, name, 'started', null, { allowResume: true });
  }
  return step.state !== 'completed';
}

async function resolveUnverifiedAttempt(ledger) {
  if (!live.emailReadbackBearerToken || !live.emailReadbackMailboxId) {
    throw new TypeError(
      'Interrupted post-submit provision cleanup requires the named Gmail readback credential pair',
    );
  }
  const notBeforeMs = Date.parse(ledger.created_at || '');
  if (!Number.isSafeInteger(notBeforeMs)) {
    throw new TypeError('Interrupted provision ledger lacks a registration window');
  }
  const message = await waitForProviderEmail(live, {
    kind: 'registration',
    notBeforeMs,
    timeoutMs: 60_000,
  });
  validateEmailReadbackReceipt(message.receipt, live, 'registration');
  let verification = await appJson('POST', '/auth/verify-otp', {
    body: { email: live.email, otp_code: message.secret },
  });
  let emailReceipt = message.receipt;
  if (verification.status === 401) {
    // A durable cleanup resume may run long after the ten-minute registration
    // challenge expired. Rotate it through the normal public resend endpoint,
    // then require a distinct, newly delivered Gmail/DKIM-bound message before
    // authenticating the exact synthetic account. This is cleanup recovery,
    // not a replay of registration or Checkout.
    const resendRequestedAtMs = Date.now();
    const resend = await appJson('POST', '/auth/resend-otp', {
      body: { email: live.email },
    });
    if (resend.status !== 200 || resend.body.status !== 'accepted') {
      throw new TypeError('Cleanup could not rotate the expired registration challenge');
    }
    const replacement = await waitForProviderEmail(live, {
      kind: 'registration',
      notBeforeMs: resendRequestedAtMs,
      timeoutMs: 120_000,
      excludeMessageIdSha256: message.receipt.gmail_message_id_sha256,
    });
    validateEmailReadbackReceipt(replacement.receipt, live, 'registration');
    verification = await appJson('POST', '/auth/verify-otp', {
      body: { email: live.email, otp_code: replacement.secret },
    });
    emailReceipt = replacement.receipt;
  }
  if (
    verification.status !== 200
    || typeof verification.body.access_token !== 'string'
    || typeof verification.body.user?.id !== 'string'
  ) {
    throw new TypeError('Cleanup could not resolve the exact provider-delivered registration challenge');
  }
  return {
    state: 'active',
    token: verification.body.access_token,
    user: verification.body.user,
    emailReceipt,
  };
}

const startedAt = new Date().toISOString();
let provisionedAccountSha256 = null;
if (live.resumeProvisionBindingKind === 'pass') {
  const passReceipt = readProvisionReceipt(live);
  assertProvisionLedgerSnapshot(live);
  provisionedAccountSha256 = passReceipt.account_user_id_sha256;
} else {
  readProvisionAttemptReceipt(live);
}
assertInputLedgerHash(live, live.resumeInputLedgerSha256);
const ledger = readCleanupLedger(live);
if (!['provisioning-started', 'provisioned-awaiting-functional-qa', 'finalization-started', 'cleanup-required', 'completed'].includes(ledger.state)) {
  throw new TypeError('Cleanup-only resume received an invalid provision ledger state');
}
let authorisedPaymentValidationReceipt = null;
let paymentValidationConfiguration = live;
if (live.expectedPaymentValidationReceiptSha256) {
  authorisedPaymentValidationReceipt = readPaymentValidationReceipt(live);
  assertPaymentValidationLedgerSnapshot(live);
  if (
    ledger.payment_validation_receipt_sha256
      !== live.expectedPaymentValidationReceiptSha256
    || !ledger.payment_validation_started_at
  ) {
    throw new TypeError('Cleanup ledger differs from the authorised AUD 1.00 validation binding');
  }
  const derivedEmailConfigurationReceiptSha256 =
    authorisedPaymentValidationReceipt.email_configuration_receipt_sha256;
  if (
    live.expectedEmailConfigurationReceiptSha256
    && live.expectedEmailConfigurationReceiptSha256
      !== derivedEmailConfigurationReceiptSha256
  ) {
    throw new TypeError(
      'Cleanup standalone email-configuration binding differs from the immutable payment receipt',
    );
  }
  readEmailConfigurationReceipt(live, {
    expectedReceiptSha256: derivedEmailConfigurationReceiptSha256,
    expectedProvisionReceiptSha256: live.expectedProvisionReceiptSha256,
  });
  paymentValidationConfiguration = Object.freeze({
    ...live,
    expectedEmailConfigurationReceiptSha256:
      derivedEmailConfigurationReceiptSha256,
  });
} else if (ledger.payment_validation_receipt_sha256) {
  throw new TypeError('Cleanup refuses an unbound completed AUD 1.00 validation receipt');
} else if (ledger.payment_validation_started_at) {
  if (!live.expectedEmailConfigurationReceiptSha256) {
    throw new TypeError(
      'Cleanup of a started AUD 1.00 validation requires its exact email-configuration binding',
    );
  }
  readEmailConfigurationReceipt(live, {
    expectedReceiptSha256: live.expectedEmailConfigurationReceiptSha256,
    expectedProvisionReceiptSha256: live.expectedProvisionReceiptSha256,
  });
}

const registrationStep = ledger.steps.find((step) => step.name === 'registration-account-reconciliation');
const noRegistrationEffect = live.resumeProvisionBindingKind === 'attempt'
  && ledger.registration_state === 'not-submitted'
  && registrationStep?.state === 'pending'
  && !ledger.account_user_id_sha256
  && !ledger.checkout_started_at
  && !ledger.checkout_session_id_sha256
  && !ledger.stripe_customer_id_sha256
  && !ledger.stripe_subscription_id_sha256;
let account = noRegistrationEffect
  ? { state: 'not-created', token: null, user: null }
  : await readAccountState();
if (account.state === 'unresolved') {
  if (live.resumeProvisionBindingKind !== 'attempt') {
    throw new TypeError('Cleanup could not authenticate or prove persisted deactivation');
  }
  account = await resolveUnverifiedAttempt(ledger);
}
if (account.user?.id) {
  const accountSha256 = sha256(account.user.id);
  if (
    (ledger.account_user_id_sha256 && ledger.account_user_id_sha256 !== accountSha256)
    || (provisionedAccountSha256 && provisionedAccountSha256 !== accountSha256)
  ) {
    throw new TypeError('Cleanup account identity differs from the provision binding');
  }
  ledger.account_user_id_sha256 = accountSha256;
  provisionedAccountSha256 ||= accountSha256;
  ledger.registration_state = 'verified';
  writeCleanupLedger(live, ledger);
}
if (
  account.state === 'deactivated'
  && /^[0-9a-f]{64}$/.test(ledger.account_user_id_sha256 || '')
) {
  if (
    provisionedAccountSha256
    && provisionedAccountSha256 !== ledger.account_user_id_sha256
  ) {
    throw new TypeError('Persisted deactivation differs from the provisioned account binding');
  }
  provisionedAccountSha256 = ledger.account_user_id_sha256;
  ledger.registration_state = 'verified';
  writeCleanupLedger(live, ledger);
}
if (noRegistrationEffect) {
  provisionedAccountSha256 = sha256('no-application-account-created');
}
if (!provisionedAccountSha256) provisionedAccountSha256 = ledger.account_user_id_sha256;
if (!/^[0-9a-f]{64}$/.test(provisionedAccountSha256 || '')) {
  throw new TypeError('Cleanup could not resolve the exact provisioned account identity');
}

if (ensureStarted(ledger, 'registration-account-reconciliation')) {
  if (noRegistrationEffect) {
    updateCleanupStep(live, ledger, 'registration-account-reconciliation', 'completed', {
      result: 'PASS',
      account_user_id_sha256: provisionedAccountSha256,
      resolution: 'durable-pre-submit-marker-no-external-effect',
      observed_at: new Date().toISOString(),
    });
  } else if (ledger.registration_state !== 'verified') {
    throw new TypeError('Cleanup cannot reconcile a registration with no verified or deactivated identity');
  } else {
    updateCleanupStep(live, ledger, 'registration-account-reconciliation', 'completed', {
      result: 'PASS',
      account_user_id_sha256: provisionedAccountSha256,
      resolution: live.resumeProvisionBindingKind === 'attempt'
        ? 'provider-challenge-or-persisted-account-readback'
        : 'pass-provision-readback',
      observed_at: new Date().toISOString(),
    });
  }
}

const checkoutStartedAtMs = Date.parse(ledger.checkout_started_at || '');
const hasCheckout = Number.isSafeInteger(checkoutStartedAtMs);
let binding = null;
let incompleteCheckout = null;
let paymentValidationReconciliation = null;
const trustedBrowserNeedsReconciliation = ensureStarted(
  ledger,
  'trusted-browser-checkout-completion',
);
const stripeBindingNeedsReconciliation = ensureStarted(ledger, 'stripe-object-binding-reconciliation');
const paymentValidationNeedsReconciliation = ensureStarted(
  ledger,
  'stripe-live-payment-validation-reconciliation',
);
if (hasCheckout) {
  const discovered = await discoverExactCheckoutSessionId(live, {
    notBeforeMs: checkoutStartedAtMs,
    ...(account.user?.id
      ? { userId: account.user.id }
      : { userIdSha256: provisionedAccountSha256 }),
  });
  if (
    (ledger.checkout_session_id_sha256
      && sha256(discovered.checkoutSessionId) !== ledger.checkout_session_id_sha256)
    || sha256(discovered.userId) !== provisionedAccountSha256
  ) {
    throw new TypeError('Cleanup-only discovery differs from the created Checkout/account binding');
  }
  ledger.checkout_session_id_sha256 = sha256(discovered.checkoutSessionId);
  if (ledger.payment_validation_started_at) {
    if (
      discovered.checkoutStatus !== 'complete'
      || discovered.paymentStatus !== 'no_payment_required'
      || !discovered.customerId
      || !discovered.subscriptionId
      || !ledger.stripe_customer_id_sha256
      || !ledger.stripe_subscription_id_sha256
      || !ledger.stripe_default_payment_method_id_sha256
      || !ledger.payment_validation_input_ledger_sha256
    ) {
      throw new TypeError('Started AUD 1.00 validation lacks its exact completed Checkout binding');
    }
    const paymentValidationBinding = await resolveLivePaymentValidationBinding(
      paymentValidationConfiguration,
      {
      checkoutSessionId: discovered.checkoutSessionId,
      checkoutSessionIdSha256: ledger.checkout_session_id_sha256,
      userIdSha256: provisionedAccountSha256,
      customerId: discovered.customerId,
      customerIdSha256: ledger.stripe_customer_id_sha256,
      subscriptionId: discovered.subscriptionId,
      subscriptionIdSha256: ledger.stripe_subscription_id_sha256,
      defaultPaymentMethodIdSha256: ledger.stripe_default_payment_method_id_sha256,
      validationInputLedgerSha256: ledger.payment_validation_input_ledger_sha256,
      },
    );
    paymentValidationReconciliation = await reconcileAndRefundLivePaymentForCleanup(
      paymentValidationConfiguration,
      paymentValidationBinding,
    );
    if (
      authorisedPaymentValidationReceipt
      && (
        paymentValidationReconciliation.provider_objects_created !== undefined
        || paymentValidationReconciliation.amount_aud_cents
          !== authorisedPaymentValidationReceipt.amount_aud_cents
        || paymentValidationReconciliation.refunded_aud_cents
          !== authorisedPaymentValidationReceipt.refunded_aud_cents
        || paymentValidationReconciliation.payment_intent_id_sha256
          !== authorisedPaymentValidationReceipt.payment_intent_id_sha256
        || paymentValidationReconciliation.charge_id_sha256
          !== authorisedPaymentValidationReceipt.charge_id_sha256
        || paymentValidationReconciliation.refund_id_sha256
          !== authorisedPaymentValidationReceipt.refund_id_sha256
      )
    ) {
      throw new TypeError('Cleanup AUD 1.00 provider reconciliation differs from its PASS receipt');
    }
  }
  if (
    discovered.checkoutStatus === 'complete'
    && discovered.paymentStatus === 'no_payment_required'
    && discovered.customerId
    && discovered.subscriptionId
  ) {
    binding = await readLiveStripeState(live, {
      notBeforeMs: checkoutStartedAtMs,
      userId: discovered.userId,
      checkoutSessionId: discovered.checkoutSessionId,
      allowedSubscriptionStatuses: ['trialing', 'canceled'],
    });
    if (
      (ledger.stripe_customer_id_sha256 && sha256(binding.customerId) !== ledger.stripe_customer_id_sha256)
      || (ledger.stripe_subscription_id_sha256 && sha256(binding.subscriptionId) !== ledger.stripe_subscription_id_sha256)
    ) {
      throw new TypeError('Cleanup-only Stripe objects differ from the durable ledger');
    }
    ledger.stripe_customer_id_sha256 = sha256(binding.customerId);
    ledger.stripe_subscription_id_sha256 = sha256(binding.subscriptionId);
    ledger.stripe_default_payment_method_id_sha256 = sha256(binding.defaultPaymentMethodId);
  } else {
    incompleteCheckout = await reconcileIncompleteCheckoutForCleanup(live, {
      ...discovered,
      notBeforeMs: checkoutStartedAtMs,
    });
    ledger.stripe_customer_id_sha256 = incompleteCheckout.customerId
      ? sha256(incompleteCheckout.customerId)
      : null;
    ledger.stripe_subscription_id_sha256 = null;
    ledger.stripe_default_payment_method_id_sha256 = null;
  }
  writeCleanupLedger(live, ledger);
}

if (paymentValidationNeedsReconciliation) {
  updateCleanupStep(
    live,
    ledger,
    'stripe-live-payment-validation-reconciliation',
    'completed',
    paymentValidationReconciliation || {
      result: 'PASS',
      provider_objects_created: false,
      actual_charge_aud_cents: 0,
      refunded_aud_cents: 0,
      resolution: 'validation-payment-never-started',
      observed_at: new Date().toISOString(),
    },
  );
}

if (trustedBrowserNeedsReconciliation) {
  updateCleanupStep(live, ledger, 'trusted-browser-checkout-completion', 'completed', binding
    ? {
        result: 'PASS',
        resolution: 'provider-confirmed-complete-checkout-cleanup-only',
        checkout_session_id_sha256: sha256(binding.checkoutSessionId),
        default_payment_method_id_sha256: sha256(binding.defaultPaymentMethodId),
        stripe_readback_receipt_sha256: sha256(canonicalJson(binding.receipt)),
        observed_at: new Date().toISOString(),
      }
    : incompleteCheckout?.receipt || {
        result: 'PASS',
        resolution: 'no-trusted-browser-checkout-effect-created',
        sequence_id: live.sequenceId,
        observed_at: new Date().toISOString(),
      });
}

if (stripeBindingNeedsReconciliation) {
  updateCleanupStep(live, ledger, 'stripe-object-binding-reconciliation', 'completed', binding
    ? binding.receipt
    : incompleteCheckout?.receipt || {
        result: 'PASS',
        provider_objects_created: false,
        sequence_id: live.sequenceId,
        observed_at: new Date().toISOString(),
      });
}

const subscriptionNeedsReconciliation = ensureStarted(ledger, 'stripe-subscription-reconciliation');
if (ensureStarted(ledger, 'application-account-deactivation')) {
  if (account.state === 'active') {
    const linkedCustomerId = account.user?.stripe_customer_id || null;
    const linkedSubscriptionId = account.user?.stripe_subscription_id || null;
    if (
      (linkedCustomerId || linkedSubscriptionId)
      && (
        !binding
        || linkedCustomerId !== binding.customerId
        || linkedSubscriptionId !== binding.subscriptionId
      )
    ) {
      throw new TypeError('Application cleanup refuses a provider-linked account without exact Stripe binding');
    }
    const closure = await appJson('POST', '/functions/cancelSubscriptionAndDeactivate', {
      token: account.token,
      body: {},
    });
    if (
      closure.status !== 200
      || closure.body.status !== 'deactivated'
      || !['cancelled', 'none'].includes(closure.body.subscription)
    ) {
      throw new TypeError('Cleanup-only account closure was not confirmed');
    }
  }
  account = noRegistrationEffect ? account : await readAccountState();
  if (!['deactivated', 'not-created'].includes(account.state)) {
    throw new TypeError('Cleanup-only closure lacks an independent persisted deactivation readback');
  }
  updateCleanupStep(live, ledger, 'application-account-deactivation', 'completed', {
    result: 'PASS',
    account_status: account.state,
    account_user_id_sha256: provisionedAccountSha256,
    observed_at: new Date().toISOString(),
  });
}

if (ensureStarted(ledger, 'persisted-deactivation-login-denial')) {
  account = noRegistrationEffect ? account : await readAccountState();
  if (!['deactivated', 'not-created'].includes(account.state)) {
    throw new TypeError('Cleanup-only fresh login did not deny the deactivated account');
  }
  updateCleanupStep(live, ledger, 'persisted-deactivation-login-denial', 'completed', {
    result: 'PASS',
    account_status: account.state,
    login_status: noRegistrationEffect ? 'not-attempted-no-created-account' : 403,
    token_minted: false,
    account_user_id_sha256: provisionedAccountSha256,
    observed_at: new Date().toISOString(),
  });
}

if (subscriptionNeedsReconciliation) {
  const cancellation = binding
    ? await cancelSubscriptionForCleanup(live, binding)
    : {
        provider: 'stripe',
        result: 'PASS',
        provider_objects_created: Boolean(incompleteCheckout),
        checkout_session_status: incompleteCheckout ? 'expired' : 'none',
        subscription_status: 'none',
        observed_at: new Date().toISOString(),
      };
  updateCleanupStep(live, ledger, 'stripe-subscription-reconciliation', 'completed', cancellation);
}

if (binding) {
  binding = await readLiveStripeState(live, {
    notBeforeMs: checkoutStartedAtMs,
    userId: binding.userId,
    checkoutSessionId: binding.checkoutSessionId,
    allowedSubscriptionStatuses: ['canceled'],
  });
}
const refundNeedsReconciliation = ensureStarted(ledger, 'stripe-charge-refund-reconciliation');
const refundReceipt = binding
  ? await refundLiveCharges(live, binding)
  : {
      provider: 'stripe',
      result: 'PASS',
      provider_objects_created: false,
      actual_charge_aud_cents: 0,
      refunded_aud_cents: 0,
      observed_at: new Date().toISOString(),
    };
if (refundNeedsReconciliation) {
  updateCleanupStep(live, ledger, 'stripe-charge-refund-reconciliation', 'completed', refundReceipt);
}
const paymentValidationActualAudCents = Number(
  paymentValidationReconciliation?.amount_aud_cents
    ?? paymentValidationReconciliation?.actual_charge_aud_cents
    ?? 0,
);
const paymentValidationRefundedAudCents = Number(
  paymentValidationReconciliation?.refunded_aud_cents ?? 0,
);

if (ensureStarted(ledger, 'post-cleanup-provider-readback')) {
  const terminal = binding
    ? await readLiveStripeState(live, {
        notBeforeMs: checkoutStartedAtMs,
        userId: binding.userId,
        checkoutSessionId: binding.checkoutSessionId,
        allowedSubscriptionStatuses: ['canceled'],
      })
    : incompleteCheckout
      ? await reconcileIncompleteCheckoutForCleanup(live, {
          ...incompleteCheckout,
          notBeforeMs: checkoutStartedAtMs,
        })
      : null;
  updateCleanupStep(live, ledger, 'post-cleanup-provider-readback', 'completed', {
    result: 'PASS',
    binding_fingerprint_sha256: terminal?.fingerprint || sha256('no-stripe-provider-object-created'),
    subscription_status: binding ? 'canceled' : 'none',
    stripe_readback_receipt_sha256: terminal
      ? sha256(canonicalJson(terminal.receipt))
      : sha256('no-stripe-provider-readback-required'),
    actual_charge_aud_cents: paymentValidationActualAudCents
      + refundReceipt.actual_charge_aud_cents,
    refunded_aud_cents: paymentValidationRefundedAudCents + refundReceipt.refunded_aud_cents,
    observed_at: new Date().toISOString(),
  });
}

if (ledger.state !== 'completed') markCleanupCompleted(live, ledger);
const finalLedgerRawSha256 = sha256(fs.readFileSync(live.cleanupLedgerPath));
writeResumeCleanupReceipt(live, {
  contract_version: RESUME_CLEANUP_RECEIPT_VERSION,
  action: 'resume_cleanup',
  result: 'PASS',
  application_sha: live.applicationSha,
  immutable_image: live.immutableImage,
  l5_intent_id: live.l5IntentId,
  sequence_id: live.sequenceId,
  synthetic_account_email_sha256: live.emailSha256,
  synthetic_namespace_sha256: sha256(live.namespace),
  account_user_id_sha256: provisionedAccountSha256,
  stripe_customer_id_sha256: binding
    ? sha256(binding.customerId)
    : incompleteCheckout?.customerId
      ? sha256(incompleteCheckout.customerId)
      : sha256('no-stripe-customer-created'),
  stripe_subscription_id_sha256: binding
    ? sha256(binding.subscriptionId)
    : sha256('no-stripe-subscription-created'),
  stripe_default_payment_method_id_sha256: binding
    ? sha256(binding.defaultPaymentMethodId)
    : sha256('no-stripe-default-payment-method-created'),
  provision_binding_kind: live.resumeProvisionBindingKind,
  provision_binding_receipt_sha256: live.resumeProvisionBindingReceiptSha256,
  provision_binding_ledger_sha256: live.resumeProvisionBindingLedgerSha256,
  payment_validation_receipt_sha256: live.expectedPaymentValidationReceiptSha256
    || sha256('no-completed-payment-validation-receipt'),
  resume_input_ledger_sha256: live.resumeInputLedgerSha256,
  final_cleanup_ledger_raw_sha256: finalLedgerRawSha256,
  final_cleanup_ledger_canonical_sha256: sha256(canonicalJson(ledger)),
  cleanup_step_receipts_sha256: sha256(canonicalJson(
    ledger.steps.map((step) => ({ name: step.name, receipt_sha256: step.receipt_sha256 })),
  )),
  actual_charge_aud_cents: paymentValidationActualAudCents
    + refundReceipt.actual_charge_aud_cents,
  refunded_aud_cents: paymentValidationRefundedAudCents + refundReceipt.refunded_aud_cents,
  started_at: startedAt,
  completed_at: new Date().toISOString(),
});
