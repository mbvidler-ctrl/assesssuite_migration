import { expect, test } from '@playwright/test';

import {
  FINAL_RECEIPT_VERSION,
  beginFinalization,
  markCleanupCompleted,
  readCleanupLedger,
  readPaymentValidationReceipt,
  readProvisionReceipt,
  resolveSelfServiceConfiguration,
  sha256,
  updateCleanupStep,
  writeFinalFragment,
} from './self-service-contract.mjs';
import {
  validateEmailReadbackReceipt,
  waitForProviderEmail,
} from './email-provider-readback.mjs';
import {
  apiRoot,
  captureAppErrors,
  loginThroughUi,
  receiptHash,
  responseJson,
  verifyReleaseBinding,
} from './journey-support.mjs';
import {
  discoverExactCheckoutSessionId,
  readCancellationReceipt,
  readLiveStripeState,
  refundLiveCharges,
} from './stripe-live-readback.mjs';

const live = resolveSelfServiceConfiguration(process.env, 'finalize');

test('finalize the exact provisioned Physio account after both live-QA hosts and restart', async ({
  page,
  request,
}, testInfo) => {
  expect(testInfo.project.name).toBe(live.project);
  const startedAt = new Date().toISOString();
  const provisionReceipt = readProvisionReceipt(live);
  const paymentValidationReceipt = readPaymentValidationReceipt(live);
  const ledger = readCleanupLedger(live);
  beginFinalization(live, ledger);
  const errors = captureAppErrors(live, page);
  await verifyReleaseBinding(live, request);

  const initialLogin = await loginThroughUi(live, page, live.initialPassword);
  if (
    typeof initialLogin.access_token !== 'string'
    || sha256(initialLogin.user?.id || '') !== provisionReceipt.account_user_id_sha256
    || initialLogin.user?.account_status !== 'active'
    || initialLogin.user?.stripe_subscription_status !== 'trialing'
  ) {
    throw new TypeError('Finalization did not re-open the exact provisioned trial account');
  }
  await page.waitForURL(/\/Dashboard(?:\?|$)/, { timeout: 90_000 });

  await page.goto('/forgot-password');
  await page.locator('#email').fill(live.email);
  const recoveryRequestedAtMs = Date.now();
  const recoveryResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && response.url().endsWith(`${apiRoot(live)}/auth/reset-password-request`)
  ));
  await page.getByRole('button', { name: 'Send reset link' }).click();
  const recoveryAccepted = await responseJson(await recoveryResponse, 'normal recovery request');
  if (recoveryAccepted.status !== 'accepted') {
    throw new TypeError('The normal recovery request was not accepted');
  }
  const recoveryEmail = await waitForProviderEmail(live, {
    kind: 'recovery',
    notBeforeMs: recoveryRequestedAtMs,
  });
  validateEmailReadbackReceipt(recoveryEmail.receipt, live, 'recovery');
  await page.goto(recoveryEmail.secret);
  await page.locator('#password').fill(live.replacementPassword);
  await page.locator('#confirm').fill(live.replacementPassword);
  const resetResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && response.url().endsWith(`${apiRoot(live)}/auth/reset-password`)
  ));
  await page.getByRole('button', { name: 'Reset password' }).click();
  const reset = await responseJson(await resetResponse, 'normal password reset');
  if (reset.status !== 'reset') throw new TypeError('The normal password reset did not complete');
  await page.waitForURL(/\/login(?:\?|$)/, { timeout: 90_000 });
  await loginThroughUi(live, page, live.initialPassword, 401);
  await expect(page.getByText(/Invalid email or password/i)).toBeVisible();
  const recoveredLogin = await loginThroughUi(live, page, live.replacementPassword);
  if (
    typeof recoveredLogin.access_token !== 'string'
    || sha256(recoveredLogin.user?.id || '') !== provisionReceipt.account_user_id_sha256
  ) {
    throw new TypeError('Recovered credentials did not establish the exact provisioned account');
  }
  await page.waitForURL(/\/Dashboard(?:\?|$)/, { timeout: 90_000 });
  const resetReceipt = {
    contract_version: 'assesssuite-self-service-password-reset/2.0.0',
    result: 'PASS',
    recipient_sha256: live.emailSha256,
    account_user_id_sha256: sha256(recoveredLogin.user.id),
    prior_password_rejected: true,
    replacement_password_login_succeeded: true,
    completed_at: new Date().toISOString(),
  };

  const checkoutStartedAtMs = Date.parse(ledger.checkout_started_at || '');
  if (!Number.isSafeInteger(checkoutStartedAtMs)) {
    throw new TypeError('The provision ledger lacks an exact Checkout creation window');
  }
  const discovered = await discoverExactCheckoutSessionId(live, {
    notBeforeMs: checkoutStartedAtMs,
    userId: recoveredLogin.user.id,
  });
  if (sha256(discovered.checkoutSessionId) !== ledger.checkout_session_id_sha256) {
    throw new TypeError('The exact Checkout Session differs from the provision ledger');
  }
  const binding = await readLiveStripeState(live, {
    notBeforeMs: checkoutStartedAtMs,
    userId: recoveredLogin.user.id,
    checkoutSessionId: discovered.checkoutSessionId,
    allowedSubscriptionStatuses: ['trialing'],
  });
  if (
    sha256(binding.customerId) !== ledger.stripe_customer_id_sha256
    || sha256(binding.subscriptionId) !== ledger.stripe_subscription_id_sha256
    || sha256(binding.defaultPaymentMethodId) !== ledger.stripe_default_payment_method_id_sha256
    || sha256(binding.customerId) !== provisionReceipt.stripe_customer_id_sha256
    || sha256(binding.subscriptionId) !== provisionReceipt.stripe_subscription_id_sha256
    || sha256(binding.defaultPaymentMethodId)
      !== provisionReceipt.stripe_default_payment_method_id_sha256
  ) {
    throw new TypeError('Pre-mutation Stripe discovery differs from the exact provisioned objects');
  }

  updateCleanupStep(live, ledger, 'application-account-deactivation', 'started');
  updateCleanupStep(live, ledger, 'stripe-subscription-reconciliation', 'started');
  await page.goto('/MyProfile');
  await page.getByRole('button', { name: 'Manage Subscription' }).click();
  await page.getByRole('button', { name: 'Cancel subscription and close account' }).click();
  const closureResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && response.url().endsWith(`${apiRoot(live)}/functions/cancelSubscriptionAndDeactivate`)
  ));
  await page.getByRole('button', { name: 'Cancel subscription and close account' }).click();
  const closure = await responseJson(await closureResponse, 'normal account cancellation');
  if (closure.status !== 'deactivated' || closure.subscription !== 'cancelled') {
    throw new TypeError('The normal UI did not confirm cancellation and deactivation');
  }
  await page.waitForURL(/\/AccountDeactivated(?:\?|$)/, { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Account deactivated' })).toBeVisible();
  const accountReceipt = {
    contract_version: 'assesssuite-self-service-account-deactivation/2.0.0',
    result: 'PASS',
    account_status: 'deactivated',
    subscription_status: 'cancelled',
    account_user_id_sha256: sha256(recoveredLogin.user.id),
    ui_response_sha256: receiptHash(closure),
    completed_at: new Date().toISOString(),
  };
  updateCleanupStep(live, ledger, 'application-account-deactivation', 'completed', accountReceipt);

  updateCleanupStep(live, ledger, 'persisted-deactivation-login-denial', 'started');
  const denied = await loginThroughUi(live, page, live.replacementPassword, 403);
  if (
    denied.error !== 'account_deactivated'
    || denied.account_status !== 'deactivated'
    || Object.hasOwn(denied, 'access_token')
  ) {
    throw new TypeError('Fresh login did not independently read back persisted deactivation');
  }
  await expect(page.getByText(/account.deactivated|deactivated/i).first()).toBeVisible();
  await page.goto('/AccountDeactivated');
  await expect(page.getByRole('heading', { name: 'Account deactivated' })).toBeVisible();
  const loginDenialReceipt = {
    contract_version: 'assesssuite-self-service-deactivation-readback/2.0.0',
    result: 'PASS',
    account_user_id_sha256: sha256(recoveredLogin.user.id),
    account_status: 'deactivated',
    login_status: 403,
    login_error_code: 'account_deactivated',
    token_minted: false,
    deactivated_route_observed: true,
    observed_at: new Date().toISOString(),
  };
  updateCleanupStep(
    live,
    ledger,
    'persisted-deactivation-login-denial',
    'completed',
    loginDenialReceipt,
  );

  const cancellationReceipt = await readCancellationReceipt(live, binding, {
    uiCancellationConfirmed: true,
  });
  updateCleanupStep(
    live,
    ledger,
    'stripe-subscription-reconciliation',
    'completed',
    cancellationReceipt,
  );
  updateCleanupStep(live, ledger, 'stripe-charge-refund-reconciliation', 'started');
  const refundReceipt = await refundLiveCharges(live, binding);
  updateCleanupStep(
    live,
    ledger,
    'stripe-charge-refund-reconciliation',
    'completed',
    refundReceipt,
  );
  updateCleanupStep(live, ledger, 'post-cleanup-provider-readback', 'started');
  const postCleanup = await readLiveStripeState(live, {
    notBeforeMs: checkoutStartedAtMs,
    userId: recoveredLogin.user.id,
    checkoutSessionId: discovered.checkoutSessionId,
    allowedSubscriptionStatuses: ['canceled'],
  });
  if (
    postCleanup.fingerprint !== binding.fingerprint
    || refundReceipt.refunded_aud_cents !== refundReceipt.actual_charge_aud_cents
  ) {
    throw new TypeError('Terminal Stripe provider readback differs from the pre-mutation binding');
  }
  const postCleanupReceipt = {
    contract_version: 'assesssuite-self-service-terminal-provider-readback/2.0.0',
    result: 'PASS',
    binding_fingerprint_sha256: postCleanup.fingerprint,
    subscription_status: 'canceled',
    actual_charge_aud_cents: refundReceipt.actual_charge_aud_cents,
    refunded_aud_cents: refundReceipt.refunded_aud_cents,
    stripe_readback_receipt_sha256: receiptHash(postCleanup.receipt),
    observed_at: new Date().toISOString(),
  };
  updateCleanupStep(
    live,
    ledger,
    'post-cleanup-provider-readback',
    'completed',
    postCleanupReceipt,
  );
  markCleanupCompleted(live, ledger);
  errors.assertClean();

  writeFinalFragment(live, {
    contract_version: FINAL_RECEIPT_VERSION,
    phase: 'finalize',
    project_result: 'PASS',
    application: live.application,
    app_id: live.appId,
    profession_id: live.professionId,
    origin: live.origin,
    application_sha: live.applicationSha,
    immutable_image: live.immutableImage,
    l5_intent_id: live.l5IntentId,
    sequence_id: live.sequenceId,
    synthetic_account_email_sha256: live.emailSha256,
    synthetic_namespace_sha256: sha256(live.namespace),
    account_user_id_sha256: sha256(recoveredLogin.user.id),
    stripe_customer_id_sha256: sha256(binding.customerId),
    stripe_subscription_id_sha256: sha256(binding.subscriptionId),
    stripe_default_payment_method_id_sha256: sha256(binding.defaultPaymentMethodId),
    provision_receipt_sha256: live.expectedProvisionReceiptSha256,
    provision_ledger_sha256: live.provisionLedgerSha256,
    payment_validation_receipt_sha256: live.expectedPaymentValidationReceiptSha256,
    payment_validation_ledger_sha256: live.paymentValidationLedgerSha256,
    fly_host_qa_receipt_sha256: live.flyHostQaReceiptSha256,
    restart_receipt_sha256: live.restartReceiptSha256,
    custom_host_qa_receipt_sha256: live.customHostQaReceiptSha256,
    dns_tls_receipt_sha256: live.dnsTlsReceiptSha256,
    recovery_email_readback_receipt_sha256: receiptHash(recoveryEmail.receipt),
    reset_receipt_sha256: receiptHash(resetReceipt),
    account_deactivation_receipt_sha256: receiptHash(accountReceipt),
    login_denial_receipt_sha256: receiptHash(loginDenialReceipt),
    stripe_cancellation_receipt_sha256: receiptHash(cancellationReceipt),
    stripe_refund_receipt_sha256: receiptHash(refundReceipt),
    stripe_post_cleanup_receipt_sha256: receiptHash(postCleanupReceipt),
    actual_charge_aud_cents: paymentValidationReceipt.amount_aud_cents
      + refundReceipt.actual_charge_aud_cents,
    refunded_aud_cents: paymentValidationReceipt.refunded_aud_cents
      + refundReceipt.refunded_aud_cents,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  });
});
