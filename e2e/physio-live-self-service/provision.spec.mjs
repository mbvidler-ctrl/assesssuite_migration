import fs from 'node:fs';
import { expect, test } from '@playwright/test';

import {
  PROVISION_RECEIPT_VERSION,
  canonicalJson,
  markProvisioned,
  markRegistrationCreatedUnknown,
  resolveSelfServiceConfiguration,
  readCleanupLedger,
  sha256,
  updateCleanupStep,
  writeCleanupLedger,
  writeProvisionChecksums,
  writeProvisionReceipt,
} from './self-service-contract.mjs';
import {
  createEmailConfigurationReceipt,
  validateEmailReadbackReceipt,
  validateRuntimeEmailReadinessReceipt,
  waitForProviderEmail,
} from './email-provider-readback.mjs';
import {
  checkoutSessionIdFromUrl,
} from './stripe-live-readback.mjs';
import {
  contentFreeTrustedBrowserCheckoutReceipt,
  removeTrustedBrowserHandoff,
  waitForTrustedBrowserAdmission,
  writeTrustedBrowserCheckoutHandoff,
} from './trusted-browser-checkout.mjs';
import {
  apiRoot,
  captureAppErrors,
  completeProfileSetup,
  contentFreeEntitlementReceipt,
  contentFreeRegistrationReceipt,
  fillSensitive,
  loginThroughUi,
  receiptHash,
  responseJson,
  resumeApplicationAfterTrustedCheckout,
  verifyReleaseBinding,
  waitForEntitlement,
  waitForStripeState,
} from './journey-support.mjs';

const live = resolveSelfServiceConfiguration(process.env, 'provision');

function writePrivateCanonicalReceipt(filename, receipt, label) {
  const bytes = Buffer.from(`${canonicalJson(receipt)}\n`);
  fs.writeFileSync(filename, bytes, {
    mode: 0o600,
    flag: 'wx',
    flush: true,
  });
  const retained = fs.readFileSync(filename);
  if (!retained.equals(bytes)) {
    throw new TypeError(`${label} was not retained exactly`);
  }
  return sha256(retained);
}

test('provision one public Physio self-service account for both live-QA hosts', async ({
  page,
  request,
}, testInfo) => {
  expect(testInfo.project.name).toBe(live.project);
  const ledger = readCleanupLedger(live);
  const startedAt = ledger.created_at;
  const errors = captureAppErrors(live, page);

  const runtimeEmailReadinessReceipt = validateRuntimeEmailReadinessReceipt(
    await verifyReleaseBinding(live, request),
    live,
  );
  writePrivateCanonicalReceipt(
    live.runtimeEmailReadinessReceiptPath,
    runtimeEmailReadinessReceipt,
    'The content-free runtime email-readiness receipt',
  );
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.locator('#fullName').fill(live.fullName);
  await page.locator('#email').fill(live.email);
  await fillSensitive(page.locator('#password'), live.initialPassword, 'Initial password');
  await fillSensitive(page.locator('#confirm'), live.initialPassword, 'Initial password confirmation');

  const registrationRequestedAtMs = Date.now();
  updateCleanupStep(live, ledger, 'registration-account-reconciliation', 'started');
  markRegistrationCreatedUnknown(live, ledger);
  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && response.url().endsWith(`${apiRoot(live)}/auth/register`)
  ), { timeout: 45_000 }).catch(() => null);
  await page.getByRole('button', { name: 'Create account' }).click();
  const registrationResponse = await responsePromise;
  let registrationConfirmed = null;
  if (registrationResponse?.status() === 200) {
    registrationConfirmed = await responseJson(registrationResponse, 'normal registration');
  }

  const registrationEmail = await waitForProviderEmail(live, {
    kind: 'registration',
    notBeforeMs: registrationRequestedAtMs,
  });
  validateEmailReadbackReceipt(registrationEmail.receipt, live, 'registration');
  const registrationEmailReadbackReceiptSha256 = writePrivateCanonicalReceipt(
    live.registrationEmailReadbackReceiptPath,
    registrationEmail.receipt,
    'The content-free registration Gmail/DKIM readback receipt',
  );
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  const verificationResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && response.url().endsWith(`${apiRoot(live)}/auth/verify-otp`)
  ));
  await fillSensitive(page.locator('#otp'), registrationEmail.secret, 'Provider verification code');
  await page.getByRole('button', { name: 'Verify code' }).click();
  const verification = await responseJson(await verificationResponse, 'normal OTP verification');
  if (
    typeof verification.access_token !== 'string'
    || verification.access_token.length < 20
    || typeof verification.user?.id !== 'string'
  ) {
    throw new TypeError('OTP verification did not establish the exact account session');
  }
  const registrationBody = registrationConfirmed || {
    message: 'registered',
    otp_required: true,
    user_id: verification.user.id,
  };
  if (registrationConfirmed && registrationConfirmed.user_id !== verification.user.id) {
    throw new TypeError('Registration response and verified account identity differ');
  }
  const registrationReceipt = contentFreeRegistrationReceipt(
    live,
    registrationBody,
    registrationConfirmed ? 'created-confirmed' : 'created-unknown-resolved',
  );
  ledger.registration_state = 'verified';
  ledger.state = 'provisioning-started';
  ledger.account_user_id_sha256 = sha256(verification.user.id);
  writeCleanupLedger(live, ledger);
  updateCleanupStep(
    live,
    ledger,
    'registration-account-reconciliation',
    'completed',
    registrationReceipt,
  );

  await page.waitForURL(/\/PaymentRequired(?:\?|$)/, { timeout: 120_000 });
  const checkoutStartedAtMs = Date.now();
  ledger.checkout_started_at = new Date(checkoutStartedAtMs).toISOString();
  writeCleanupLedger(live, ledger);
  const checkoutFunctionResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && response.url().endsWith(`${apiRoot(live)}/functions/createCheckoutSession`)
  ));
  await page.getByRole('button', { name: 'Start Monthly Trial' }).click();
  const checkoutFunctionBody = await responseJson(
    await checkoutFunctionResponse,
    'Physio checkout session creation',
  );
  if (canonicalJson(Object.keys(checkoutFunctionBody).sort()) !== canonicalJson(['url'])) {
    throw new TypeError('Physio checkout session response fields differ');
  }
  const createdCheckoutSessionId = checkoutSessionIdFromUrl(checkoutFunctionBody.url);
  ledger.checkout_session_id_sha256 = sha256(createdCheckoutSessionId);
  writeCleanupLedger(live, ledger);
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 120_000 });
  updateCleanupStep(live, ledger, 'trusted-browser-checkout-completion', 'started');
  const handoff = writeTrustedBrowserCheckoutHandoff(live, {
    checkoutUrl: checkoutFunctionBody.url,
    checkoutSessionId: createdCheckoutSessionId,
    checkoutNotBefore: ledger.checkout_started_at,
  });
  let admission;
  try {
    admission = await waitForTrustedBrowserAdmission(live, handoff);
  } finally {
    removeTrustedBrowserHandoff(live);
  }
  ledger.trusted_browser_admission_receipt_sha256 = admission.sha256;
  writeCleanupLedger(live, ledger);

  updateCleanupStep(live, ledger, 'stripe-object-binding-reconciliation', 'started');
  const stripeState = await waitForStripeState(live, {
    notBeforeMs: checkoutStartedAtMs,
    userId: verification.user.id,
    checkoutSessionId: createdCheckoutSessionId,
    allowedSubscriptionStatuses: ['trialing'],
  });
  ledger.stripe_customer_id_sha256 = sha256(stripeState.customerId);
  ledger.stripe_subscription_id_sha256 = sha256(stripeState.subscriptionId);
  ledger.stripe_default_payment_method_id_sha256 = sha256(stripeState.defaultPaymentMethodId);
  writeCleanupLedger(live, ledger);

  const providerGatedReturnObserved = await resumeApplicationAfterTrustedCheckout(live, page);
  const checkoutReceipt = contentFreeTrustedBrowserCheckoutReceipt(live, {
    handoff,
    admission,
    stripeState,
    providerGatedReturnObserved,
  });
  updateCleanupStep(
    live,
    ledger,
    'trusted-browser-checkout-completion',
    'completed',
    checkoutReceipt,
  );
  updateCleanupStep(
    live,
    ledger,
    'stripe-object-binding-reconciliation',
    'completed',
    stripeState.receipt,
  );

  const entitledUser = await waitForEntitlement(live, request, verification.access_token);
  const entitlementReceipt = contentFreeEntitlementReceipt(live, entitledUser);
  if (
    entitledUser.id !== verification.user.id
    || stripeState.customerId !== entitledUser.stripe_customer_id
    || stripeState.subscriptionId !== entitledUser.stripe_subscription_id
    || stripeState.receipt.captured_charge_count !== 0
    || stripeState.receipt.actual_charge_aud_cents !== 0
  ) {
    throw new TypeError('Application entitlement and exact zero-charge Stripe binding differ');
  }

  const onboardingReceipt = await completeProfileSetup(live, page);
  await page.goto('/MyProfile');
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.waitForURL((url) => url.origin === live.origin && url.pathname === '/', {
    timeout: 90_000,
  });
  const login = await loginThroughUi(live, page, live.initialPassword);
  if (
    typeof login.access_token !== 'string'
    || login.user?.id !== entitledUser.id
    || login.user?.account_status !== 'active'
    || login.user?.stripe_subscription_status !== 'trialing'
  ) {
    throw new TypeError('Normal post-onboarding login did not re-read the exact trial account');
  }
  await page.waitForURL(/\/Dashboard(?:\?|$)/, { timeout: 90_000 });
  const loginReceipt = {
    contract_version: 'assesssuite-self-service-normal-login/2.0.0',
    result: 'PASS',
    recipient_sha256: live.emailSha256,
    account_user_id_sha256: sha256(login.user.id),
    completed_at: new Date().toISOString(),
  };
  errors.assertClean();

  const provisionReceipt = {
    contract_version: PROVISION_RECEIPT_VERSION,
    phase: 'provision',
    project_result: 'PASS',
    application: live.application,
    app_id: live.appId,
    profession_id: live.professionId,
    origin: live.origin,
    application_sha: live.applicationSha,
    immutable_image: live.immutableImage,
    catalogue_count: live.catalogueCount,
    catalogue_checksum: live.catalogueChecksum,
    deploy_receipt_sha256: live.deployReceiptSha256,
    exact_image_canary_receipt_sha256: live.exactImageCanaryReceiptSha256,
    email_readback_endpoint_sha256: live.emailReadbackEndpointSha256,
    stripe_checkout_configuration_receipt_sha256: live.stripeCheckoutConfigurationReceiptSha256,
    stripe_integration_contract_sha256: live.stripeIntegrationContractSha256,
    stripe_product_receipt_sha256: live.stripeProductReceiptSha256,
    stripe_price_receipt_sha256: live.stripePriceReceiptSha256,
    stripe_annual_price_receipt_sha256: live.stripeAnnualPriceReceiptSha256,
    stripe_webhook_receipt_sha256: live.stripeWebhookReceiptSha256,
    journey_manifest_sha256: live.journeyManifestSha256,
    l5_intent_id: live.l5IntentId,
    sequence_id: live.sequenceId,
    synthetic_account_email_sha256: live.emailSha256,
    synthetic_namespace_sha256: sha256(live.namespace),
    account_user_id_sha256: sha256(entitledUser.id),
    registration_disposition: ledger.registration_state,
    registration_receipt_sha256: receiptHash(registrationReceipt),
    registration_email_readback_receipt_sha256: registrationEmailReadbackReceiptSha256,
    gmail_registration_message_id_sha256: registrationEmail.receipt.gmail_message_id_sha256,
    checkout_receipt_sha256: receiptHash(checkoutReceipt),
    checkout_session_id_sha256: sha256(createdCheckoutSessionId),
    trusted_browser_admission_receipt_sha256: admission.sha256,
    entitlement_readback_receipt_sha256: receiptHash(entitlementReceipt),
    stripe_provider_readback_receipt_sha256: receiptHash(stripeState.receipt),
    provider_request_ids_sha256: stripeState.receipt.provider_request_ids_sha256,
    onboarding_receipt_sha256: receiptHash(onboardingReceipt),
    login_receipt_sha256: receiptHash(loginReceipt),
    stripe_product_id: live.stripeProductId,
    stripe_product_lookup_key: live.stripeProductLookupKey,
    stripe_price_id: live.stripePriceId,
    stripe_monthly_lookup_key: live.stripeMonthlyLookupKey,
    stripe_annual_price_id: live.stripeAnnualPriceId,
    stripe_annual_lookup_key: live.stripeAnnualLookupKey,
    stripe_customer_id_sha256: sha256(stripeState.customerId),
    stripe_default_payment_method_id_sha256: sha256(stripeState.defaultPaymentMethodId),
    stripe_subscription_id_sha256: sha256(stripeState.subscriptionId),
    stripe_subscription_status: 'trialing',
    trial_days: live.trialDays,
    actual_charge_aud_cents: 0,
    cleanup_state: 'provisioned-awaiting-functional-qa',
    browser_project: live.project,
    card_entry_mechanism: live.cardEntryMechanism,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  };
  const provisionReceiptSha256 = writeProvisionReceipt(live, provisionReceipt);
  const emailConfigurationReceipt = createEmailConfigurationReceipt(live, {
    provisionReceiptSha256,
    registrationEmailReadbackReceipt: registrationEmail.receipt,
    runtimeEmailReadinessReceipt,
  });
  const emailConfigurationReceiptSha256 = writePrivateCanonicalReceipt(
    live.emailConfigurationReceiptPath,
    emailConfigurationReceipt,
    'The post-provision Physio email-configuration receipt',
  );
  markProvisioned(live, ledger, provisionReceipt);
  writeProvisionChecksums(live);
  if (
    provisionReceiptSha256 !== ledger.provision_receipt_sha256
    || sha256(fs.readFileSync(live.cleanupLedgerPath)) === sha256(canonicalJson(ledger))
  ) {
    throw new TypeError('Provision receipt or raw/canonical ledger hash binding differs');
  }
  process.stdout.write(`${JSON.stringify({
    result: 'PASS',
    action: 'provision',
    provision_receipt_sha256: provisionReceiptSha256,
    email_configuration_receipt_sha256: emailConfigurationReceiptSha256,
  })}\n`);
});
