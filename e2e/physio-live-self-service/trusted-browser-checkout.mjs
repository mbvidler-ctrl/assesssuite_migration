import fs from 'node:fs';
import path from 'node:path';

import {
  SELF_SERVICE_CARD_ENTRY_MECHANISM,
  SELF_SERVICE_TRUSTED_BROWSER_PROFILE,
  assertExactKeys,
  canonicalJson,
  sha256,
} from './self-service-contract.mjs';
import { checkoutSessionIdFromUrl } from './stripe-live-readback.mjs';

export const TRUSTED_BROWSER_HANDOFF_VERSION =
  'assesssuite-physio-trusted-browser-checkout-handoff/1.0.0';
export const TRUSTED_BROWSER_ADMISSION_VERSION =
  'assesssuite-physio-trusted-browser-checkout-admission/1.0.0';
export const TRUSTED_BROWSER_CHECKOUT_RECEIPT_VERSION =
  'assesssuite-stripe-trusted-browser-checkout/1.0.0';

export const TRUSTED_BROWSER_HANDOFF_KEYS = Object.freeze([
  'action',
  'app_id',
  'application',
  'browser_profile',
  'card_entry_mechanism',
  'checkout_not_before',
  'checkout_session_id_sha256',
  'checkout_url',
  'checkout_url_sha256',
  'contract_version',
  'created_at',
  'direct_payment_method_injection',
  'expires_at',
  'l5_intent_id',
  'pan_or_cvc_present',
  'profession_id',
  'protected_runner_alternate_enabled',
  'sequence_id',
]);

export const TRUSTED_BROWSER_ADMISSION_KEYS = Object.freeze([
  'action',
  'app_id',
  'application',
  'browser_profile',
  'card_entry_mechanism',
  'checkout_not_before',
  'checkout_session_id_sha256',
  'checkout_url_sha256',
  'completed_at',
  'contract_version',
  'direct_payment_method_injection',
  'handoff_created_at',
  'l5_intent_id',
  'normal_hosted_checkout',
  'opened_at',
  'pan_or_cvc_received_by_control_plane',
  'pan_or_cvc_retained',
  'profession_id',
  'protected_runner_alternate_enabled',
  'result',
  'sequence_id',
  'trusted_browser_completion_observed',
]);

export const TRUSTED_BROWSER_CHECKOUT_RECEIPT_KEYS = Object.freeze([
  'card_entry_mechanism',
  'checkout_mode',
  'checkout_provider',
  'checkout_session_id_sha256',
  'checkout_url_sha256',
  'completed_at',
  'contract_version',
  'default_payment_method_id_sha256',
  'direct_payment_method_injection',
  'expected_due_today_aud_cents',
  'normal_hosted_checkout',
  'observed_due_today_aud_cents',
  'pan_or_cvc_received_by_control_plane',
  'pan_or_cvc_retained',
  'protected_runner_alternate_enabled',
  'provider_gated_return_observed',
  'result',
  'stripe_provider_readback_receipt_sha256',
  'trusted_browser_admission_receipt_sha256',
]);

const SHA_256 = /^[0-9a-f]{64}$/;

function exactIso(value, label) {
  const timestamp = Date.parse(value || '');
  if (!Number.isSafeInteger(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new TypeError(`${label} must be an exact ISO timestamp`);
  }
  return timestamp;
}

function assertExactBoolean(value, expected, label) {
  if (value !== expected) throw new TypeError(`${label} differs from the frozen value`);
}

function readAdmissionFile(configuration) {
  const stat = fs.lstatSync(configuration.trustedBrowserAdmissionPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 16_384) {
    throw new TypeError('Trusted-browser admission must be one bounded regular file');
  }
  const bytes = fs.readFileSync(configuration.trustedBrowserAdmissionPath);
  const receipt = JSON.parse(bytes.toString('utf8'));
  return { receipt, sha256: sha256(bytes), modifiedAtMs: stat.mtimeMs };
}

export function writeTrustedBrowserCheckoutHandoff(configuration, {
  checkoutUrl,
  checkoutSessionId,
  checkoutNotBefore,
}) {
  if (configuration.phase !== 'provision') {
    throw new TypeError('Trusted-browser Checkout handoff is provision-only');
  }
  if (configuration.cardEntryMechanism !== SELF_SERVICE_CARD_ENTRY_MECHANISM) {
    throw new TypeError('Trusted-browser Checkout mechanism differs');
  }
  const parsedSessionId = checkoutSessionIdFromUrl(checkoutUrl);
  if (parsedSessionId !== checkoutSessionId) {
    throw new TypeError('Trusted-browser Checkout handoff Session differs');
  }
  const notBeforeMs = exactIso(checkoutNotBefore, 'Checkout not-before');
  const createdAt = new Date().toISOString();
  const createdAtMs = exactIso(createdAt, 'Checkout handoff creation');
  if (createdAtMs < notBeforeMs || createdAtMs > Date.now() + 1_000) {
    throw new TypeError('Trusted-browser Checkout handoff is outside its exact creation window');
  }
  fs.mkdirSync(configuration.trustedBrowserHandoffDirectory, {
    recursive: true,
    mode: 0o700,
  });
  const parent = fs.lstatSync(configuration.trustedBrowserHandoffDirectory);
  if (!parent.isDirectory() || parent.isSymbolicLink()) {
    throw new TypeError('Trusted-browser Checkout handoff parent must be a real directory');
  }
  if (
    fs.existsSync(configuration.trustedBrowserHandoffPath)
    || fs.existsSync(configuration.trustedBrowserAdmissionPath)
  ) {
    throw new TypeError('Trusted-browser Checkout refuses a stale handoff or admission');
  }
  const handoff = {
    contract_version: TRUSTED_BROWSER_HANDOFF_VERSION,
    action: 'complete_hosted_checkout',
    application: configuration.application,
    app_id: configuration.appId,
    profession_id: configuration.professionId,
    l5_intent_id: configuration.l5IntentId,
    sequence_id: configuration.sequenceId,
    card_entry_mechanism: SELF_SERVICE_CARD_ENTRY_MECHANISM,
    browser_profile: SELF_SERVICE_TRUSTED_BROWSER_PROFILE,
    checkout_session_id_sha256: sha256(checkoutSessionId),
    checkout_url: checkoutUrl,
    checkout_url_sha256: sha256(checkoutUrl),
    checkout_not_before: checkoutNotBefore,
    created_at: createdAt,
    expires_at: new Date(createdAtMs + configuration.trustedBrowserTimeoutMs).toISOString(),
    pan_or_cvc_present: false,
    direct_payment_method_injection: false,
    protected_runner_alternate_enabled: false,
  };
  assertExactKeys(handoff, TRUSTED_BROWSER_HANDOFF_KEYS, 'trusted-browser Checkout handoff');
  fs.writeFileSync(configuration.trustedBrowserHandoffPath, `${canonicalJson(handoff)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
    flush: true,
  });
  return Object.freeze({
    checkoutSessionId,
    checkoutSessionIdSha256: handoff.checkout_session_id_sha256,
    checkoutUrlSha256: handoff.checkout_url_sha256,
    checkoutNotBefore: handoff.checkout_not_before,
    createdAt: handoff.created_at,
    expiresAt: handoff.expires_at,
  });
}

export function validateTrustedBrowserAdmission(configuration, handoff, receipt, {
  modifiedAtMs = Date.now(),
} = {}) {
  assertExactKeys(receipt, TRUSTED_BROWSER_ADMISSION_KEYS, 'trusted-browser Checkout admission');
  const notBeforeMs = exactIso(receipt.checkout_not_before, 'Admission Checkout not-before');
  const handoffCreatedAtMs = exactIso(receipt.handoff_created_at, 'Admission handoff creation');
  const openedAtMs = exactIso(receipt.opened_at, 'Admission browser open');
  const completedAtMs = exactIso(receipt.completed_at, 'Admission browser completion');
  if (
    receipt.contract_version !== TRUSTED_BROWSER_ADMISSION_VERSION
    || receipt.action !== 'complete_hosted_checkout'
    || receipt.result !== 'PASS'
    || receipt.application !== configuration.application
    || receipt.app_id !== configuration.appId
    || receipt.profession_id !== configuration.professionId
    || receipt.l5_intent_id !== configuration.l5IntentId
    || receipt.sequence_id !== configuration.sequenceId
    || receipt.card_entry_mechanism !== SELF_SERVICE_CARD_ENTRY_MECHANISM
    || receipt.browser_profile !== SELF_SERVICE_TRUSTED_BROWSER_PROFILE
    || receipt.checkout_session_id_sha256 !== handoff.checkoutSessionIdSha256
    || receipt.checkout_url_sha256 !== handoff.checkoutUrlSha256
    || receipt.checkout_not_before !== handoff.checkoutNotBefore
    || receipt.handoff_created_at !== handoff.createdAt
    || !SHA_256.test(receipt.checkout_session_id_sha256 || '')
    || !SHA_256.test(receipt.checkout_url_sha256 || '')
    || notBeforeMs > handoffCreatedAtMs
    || openedAtMs < handoffCreatedAtMs
    || completedAtMs < openedAtMs
    || completedAtMs > Date.now() + 60_000
    || modifiedAtMs < notBeforeMs - 1_000
  ) {
    throw new TypeError('Trusted-browser Checkout admission differs from the exact handoff');
  }
  assertExactBoolean(receipt.normal_hosted_checkout, true, 'normal hosted Checkout admission');
  assertExactBoolean(
    receipt.trusted_browser_completion_observed,
    true,
    'trusted-browser completion admission',
  );
  assertExactBoolean(
    receipt.pan_or_cvc_received_by_control_plane,
    false,
    'control-plane PAN/CVC receipt posture',
  );
  assertExactBoolean(receipt.pan_or_cvc_retained, false, 'PAN/CVC retention posture');
  assertExactBoolean(
    receipt.direct_payment_method_injection,
    false,
    'direct PaymentMethod injection posture',
  );
  assertExactBoolean(
    receipt.protected_runner_alternate_enabled,
    false,
    'protected-runner alternate posture',
  );
  return receipt;
}

export async function waitForTrustedBrowserAdmission(configuration, handoff) {
  const deadline = Date.now() + configuration.trustedBrowserTimeoutMs;
  let lastError = null;
  while (Date.now() <= deadline) {
    if (fs.existsSync(configuration.trustedBrowserAdmissionPath)) {
      try {
        const admission = readAdmissionFile(configuration);
        validateTrustedBrowserAdmission(configuration, handoff, admission.receipt, {
          modifiedAtMs: admission.modifiedAtMs,
        });
        return Object.freeze(admission);
      } catch (error) {
        lastError = error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new AggregateError(
    lastError ? [lastError] : [],
    'Trusted Chrome did not complete the exact hosted Checkout within the bounded window; '
      + 'the remaining action is to complete this one hosted Checkout in the existing trusted profile',
  );
}

export function removeTrustedBrowserHandoff(configuration) {
  const expected = path.join(
    configuration.trustedBrowserHandoffDirectory,
    `${configuration.sequenceId}-checkout-handoff.json`,
  );
  if (path.resolve(expected) !== path.resolve(configuration.trustedBrowserHandoffPath)) {
    throw new TypeError('Trusted-browser Checkout handoff deletion target differs');
  }
  fs.rmSync(expected, { force: true });
}

export function contentFreeTrustedBrowserCheckoutReceipt(configuration, {
  handoff,
  admission,
  stripeState,
  providerGatedReturnObserved,
}) {
  if (
    admission.receipt.result !== 'PASS'
    || stripeState.receipt.result !== 'PASS'
    || stripeState.receipt.checkout_session_id_sha256 !== handoff.checkoutSessionIdSha256
    || stripeState.receipt.default_payment_method_id_sha256
      !== sha256(stripeState.defaultPaymentMethodId)
    || stripeState.receipt.checkout_amount_total_aud_cents
      !== configuration.expectedDueTodayAudCents
    || stripeState.receipt.checkout_payment_method_collection !== 'always'
    || providerGatedReturnObserved !== true
  ) {
    throw new TypeError('Trusted-browser Checkout lacks its final provider-gated admission');
  }
  const receipt = {
    contract_version: TRUSTED_BROWSER_CHECKOUT_RECEIPT_VERSION,
    result: 'PASS',
    checkout_provider: 'stripe',
    checkout_mode: 'live',
    card_entry_mechanism: SELF_SERVICE_CARD_ENTRY_MECHANISM,
    normal_hosted_checkout: true,
    checkout_session_id_sha256: handoff.checkoutSessionIdSha256,
    checkout_url_sha256: handoff.checkoutUrlSha256,
    trusted_browser_admission_receipt_sha256: admission.sha256,
    stripe_provider_readback_receipt_sha256: sha256(canonicalJson(stripeState.receipt)),
    default_payment_method_id_sha256: sha256(stripeState.defaultPaymentMethodId),
    expected_due_today_aud_cents: configuration.expectedDueTodayAudCents,
    observed_due_today_aud_cents: stripeState.receipt.checkout_amount_total_aud_cents,
    provider_gated_return_observed: true,
    pan_or_cvc_received_by_control_plane: false,
    pan_or_cvc_retained: false,
    direct_payment_method_injection: false,
    protected_runner_alternate_enabled: false,
    completed_at: new Date().toISOString(),
  };
  assertExactKeys(receipt, TRUSTED_BROWSER_CHECKOUT_RECEIPT_KEYS, 'trusted-browser Checkout receipt');
  return receipt;
}
