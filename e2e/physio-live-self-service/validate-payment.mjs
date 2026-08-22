import fs from 'node:fs';

import {
  assertInputLedgerHash,
  assertProvisionLedgerSnapshot,
  markValidationPaymentStarted,
  readCleanupLedger,
  readProvisionReceipt,
  resolveSelfServiceConfiguration,
  sha256,
  writeCleanupLedger,
  writePaymentValidationReceipt,
} from './self-service-contract.mjs';
import { readEmailConfigurationReceipt } from './email-provider-readback.mjs';
import {
  discoverExactCheckoutSessionId,
  readLiveStripeState,
} from './stripe-live-readback.mjs';
import { validateAndRefundLivePayment } from './stripe-live-payment-validation.mjs';

const live = resolveSelfServiceConfiguration(process.env, 'validate-payment');
const provisionReceipt = readProvisionReceipt(live);
readEmailConfigurationReceipt(live, {
  expectedReceiptSha256: live.expectedEmailConfigurationReceiptSha256,
  expectedProvisionReceiptSha256: live.expectedProvisionReceiptSha256,
});
assertProvisionLedgerSnapshot(live);
assertInputLedgerHash(live, live.validationInputLedgerSha256);
const ledger = readCleanupLedger(live);
if (
  ledger.state !== 'provisioned-awaiting-functional-qa'
  || ledger.provision_receipt_sha256 !== live.expectedProvisionReceiptSha256
  || sha256(fs.readFileSync(live.cleanupLedgerPath)) !== live.validationInputLedgerSha256
) {
  throw new TypeError('AUD 1.00 validation input ledger differs from the exact provision');
}

markValidationPaymentStarted(live, ledger);
writeCleanupLedger(live, ledger);

const checkoutStartedAtMs = Date.parse(ledger.checkout_started_at || '');
if (!Number.isSafeInteger(checkoutStartedAtMs)) {
  throw new TypeError('AUD 1.00 validation lacks the exact Checkout creation window');
}
const discovered = await discoverExactCheckoutSessionId(live, {
  notBeforeMs: checkoutStartedAtMs,
  userIdSha256: provisionReceipt.account_user_id_sha256,
});
if (
  sha256(discovered.checkoutSessionId) !== provisionReceipt.checkout_session_id_sha256
  || sha256(discovered.checkoutSessionId) !== ledger.checkout_session_id_sha256
) {
  throw new TypeError('AUD 1.00 validation discovered a different Checkout Session');
}
const stripeState = await readLiveStripeState(live, {
  notBeforeMs: checkoutStartedAtMs,
  userId: discovered.userId,
  checkoutSessionId: discovered.checkoutSessionId,
  allowedSubscriptionStatuses: ['trialing'],
});
if (
  sha256(stripeState.customerId) !== provisionReceipt.stripe_customer_id_sha256
  || sha256(stripeState.customerId) !== ledger.stripe_customer_id_sha256
  || sha256(stripeState.subscriptionId) !== provisionReceipt.stripe_subscription_id_sha256
  || sha256(stripeState.subscriptionId) !== ledger.stripe_subscription_id_sha256
  || sha256(stripeState.defaultPaymentMethodId)
    !== provisionReceipt.stripe_default_payment_method_id_sha256
  || sha256(stripeState.defaultPaymentMethodId)
    !== ledger.stripe_default_payment_method_id_sha256
) {
  throw new TypeError('AUD 1.00 validation provider objects differ from the provision binding');
}

const receipt = await validateAndRefundLivePayment(live, {
  notBeforeMs: checkoutStartedAtMs,
  userIdSha256: sha256(discovered.userId),
  checkoutSessionId: stripeState.checkoutSessionId,
  checkoutSessionIdSha256: provisionReceipt.checkout_session_id_sha256,
  customerId: stripeState.customerId,
  customerIdSha256: provisionReceipt.stripe_customer_id_sha256,
  subscriptionId: stripeState.subscriptionId,
  subscriptionIdSha256: provisionReceipt.stripe_subscription_id_sha256,
  defaultPaymentMethodId: stripeState.defaultPaymentMethodId,
  defaultPaymentMethodIdSha256: provisionReceipt.stripe_default_payment_method_id_sha256,
});
const completed = writePaymentValidationReceipt(live, ledger, receipt);
process.stdout.write(`${JSON.stringify({
  result: 'PASS',
  action: 'validate_payment',
  amount_aud_cents: 100,
  refunded_aud_cents: 100,
  payment_validation_receipt_sha256: completed.paymentValidationReceiptSha256,
  payment_validation_ledger_sha256: completed.paymentValidationLedgerSha256,
  email_configuration_receipt_sha256: live.expectedEmailConfigurationReceiptSha256,
})}\n`);
