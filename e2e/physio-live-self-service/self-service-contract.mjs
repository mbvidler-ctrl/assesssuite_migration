import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const SELF_SERVICE_CONTRACT_VERSION = 'assesssuite-physio-live-self-service/4.0.0';
export const PROVISION_RECEIPT_VERSION = 'assesssuite-physio-live-self-service-provision/4.0.0';
export const FINAL_RECEIPT_VERSION = 'assesssuite-physio-live-self-service-finalize/3.0.0';
export const CLEANUP_LEDGER_VERSION = 'assesssuite-physio-live-self-service-cleanup/3.0.0';
export const RESUME_CLEANUP_RECEIPT_VERSION = 'assesssuite-physio-live-self-service-resume-cleanup/3.0.0';
export const PROVISION_ATTEMPT_RECEIPT_VERSION = 'assesssuite-physio-live-self-service-provision-attempt/3.0.0';
export const EMAIL_CONFIGURATION_RECEIPT_VERSION =
  'assesssuite-physio-email-configuration/1.0.0';
export const PAYMENT_VALIDATION_RECEIPT_VERSION =
  'assesssuite-stripe-live-payment-validation/2.0.0';
export const SELF_SERVICE_APPLICATION = 'assesssuite-physio-production';
export const SELF_SERVICE_APP_ID = 'local-assesssuite-physio';
export const SELF_SERVICE_PROFESSION_ID = 'physio';
export const SELF_SERVICE_CATALOGUE_COUNT = 236;
export const SELF_SERVICE_PROJECT = 'chromium-desktop';
export const SELF_SERVICE_MAX_CHARGE_AUD_CENTS = 2_000;
export const SELF_SERVICE_STRIPE_API_VERSION = '2026-07-29.dahlia';
export const SELF_SERVICE_STRIPE_INTEGRATION_PATTERN = '^assesssuite_physio_[a-z]{8}$';
export const SELF_SERVICE_STRIPE_PRODUCT_LOOKUP_KEY = 'assesssuite_physio';
export const SELF_SERVICE_STRIPE_MONTHLY_LOOKUP_KEY = 'assesssuite_physio_monthly_aud_5500';
export const SELF_SERVICE_STRIPE_ANNUAL_LOOKUP_KEY = 'assesssuite_physio_annual_aud_54000';
export const SELF_SERVICE_CARD_ENTRY_MECHANISM = 'trusted-browser-autofill';
export const SELF_SERVICE_TRUSTED_BROWSER_PROFILE = 'maxwell-existing-trusted-chrome-profile';
export const SELF_SERVICE_TRUSTED_BROWSER_TIMEOUT_MS = 15 * 60 * 1000;
export const SELF_SERVICE_FLY_ORIGIN = 'https://assesssuite-physio-production.fly.dev';
export const SELF_SERVICE_CUSTOM_ORIGIN = 'https://physio.app.assesssuite.com';
export const SELF_SERVICE_PHASE_ORIGINS = Object.freeze({
  provision: Object.freeze([SELF_SERVICE_FLY_ORIGIN]),
  'validate-payment': Object.freeze([SELF_SERVICE_FLY_ORIGIN]),
  finalize: Object.freeze([SELF_SERVICE_CUSTOM_ORIGIN]),
  'resume-cleanup': Object.freeze([SELF_SERVICE_FLY_ORIGIN, SELF_SERVICE_CUSTOM_ORIGIN]),
});
export const GMAIL_API_ENDPOINT = 'https://gmail.googleapis.com/';

export const PAYMENT_VALIDATION_RECEIPT_KEYS = Object.freeze([
  'action',
  'amount_aud_cents',
  'amount_captured_aud_cents',
  'amount_received_aud_cents',
  'api_version',
  'app_id',
  'application',
  'card_entry_mechanism',
  'charge_id_sha256',
  'charge_invoice_present',
  'charge_status',
  'checkout_session_id_sha256',
  'completed_at',
  'contract_version',
  'currency',
  'customer_id_sha256',
  'default_payment_method_id_sha256',
  'direct_charges_api_create_used',
  'email_configuration_receipt_sha256',
  'invoice_reconciliation_used',
  'l5_intent_id',
  'livemode',
  'maximum_authorised_aud_cents',
  'payment_intent_create_disposition',
  'payment_intent_id_sha256',
  'payment_intent_idempotency_key_sha256',
  'payment_intent_status',
  'profession_id',
  'provider',
  'provider_request_ids_sha256',
  'provision_ledger_sha256',
  'provision_receipt_sha256',
  'qa_sequence_sha256',
  'refund_create_disposition',
  'refund_id_sha256',
  'refund_idempotency_key_sha256',
  'refund_status',
  'refunded_aud_cents',
  'result',
  'subscription_id_sha256',
  'validation_input_ledger_sha256',
]);

const SHA_256 = /^[0-9a-f]{64}$/;
const SHA_40 = /^[0-9a-f]{40}$/;
const IMAGE_DIGEST = /^registry\.fly\.io\/assesssuite-physio-production@sha256:[0-9a-f]{64}$/;
const SEQUENCE_ID = /^assesssuite-physio-self-service-([0-9a-f]{12})$/;
const NAMESPACE = /^physio-self-service-([0-9a-f]{12})$/;
const STRIPE_PRODUCT_ID = /^prod_[A-Za-z0-9]{8,120}$/;
const STRIPE_PRICE_ID = /^price_[A-Za-z0-9]{8,120}$/;
const L5_INTENT_ID = /^CAP-[A-Za-z0-9._:-]{8,180}$/;
const STRIPE_LIVE_KEY = /^(?:rk|sk)_live_[A-Za-z0-9_]{20,4096}$/;
const GMAIL_BEARER = /^[A-Za-z0-9._~+/-]{20,4096}$/;

export const CLEANUP_STEP_NAMES = Object.freeze([
  'registration-account-reconciliation',
  'trusted-browser-checkout-completion',
  'stripe-object-binding-reconciliation',
  'stripe-live-payment-validation-reconciliation',
  'application-account-deactivation',
  'stripe-subscription-reconciliation',
  'stripe-charge-refund-reconciliation',
  'persisted-deactivation-login-denial',
  'post-cleanup-provider-readback',
]);

export const CLEANUP_STEP_KEYS = Object.freeze([
  'completed_at', 'name', 'receipt_sha256', 'started_at', 'state',
]);

export const CLEANUP_LEDGER_KEYS = Object.freeze([
  'account_user_id_sha256',
  'checkout_session_id_sha256',
  'checkout_started_at',
  'completed_at',
  'contract_version',
  'created_at',
  'custom_host_qa_receipt_sha256',
  'dns_tls_receipt_sha256',
  'finalization_started_at',
  'fly_host_qa_receipt_sha256',
  'payment_validation_input_ledger_sha256',
  'payment_validation_receipt_sha256',
  'payment_validation_started_at',
  'provision_receipt_sha256',
  'provisioned_at',
  'registration_state',
  'restart_receipt_sha256',
  'sequence_id',
  'state',
  'steps',
  'stripe_default_payment_method_id_sha256',
  'stripe_customer_id_sha256',
  'stripe_subscription_id_sha256',
  'synthetic_account_email_sha256',
  'synthetic_namespace_sha256',
  'trusted_browser_admission_receipt_sha256',
]);

export const PROVISION_RECEIPT_KEYS = Object.freeze([
  'account_user_id_sha256',
  'actual_charge_aud_cents',
  'app_id',
  'application',
  'application_sha',
  'browser_project',
  'card_entry_mechanism',
  'catalogue_checksum',
  'catalogue_count',
  'checkout_receipt_sha256',
  'checkout_session_id_sha256',
  'cleanup_state',
  'completed_at',
  'contract_version',
  'deploy_receipt_sha256',
  'email_readback_endpoint_sha256',
  'entitlement_readback_receipt_sha256',
  'exact_image_canary_receipt_sha256',
  'gmail_registration_message_id_sha256',
  'immutable_image',
  'journey_manifest_sha256',
  'l5_intent_id',
  'login_receipt_sha256',
  'onboarding_receipt_sha256',
  'origin',
  'phase',
  'profession_id',
  'project_result',
  'provider_request_ids_sha256',
  'registration_disposition',
  'registration_email_readback_receipt_sha256',
  'registration_receipt_sha256',
  'sequence_id',
  'started_at',
  'stripe_annual_lookup_key',
  'stripe_annual_price_id',
  'stripe_annual_price_receipt_sha256',
  'stripe_checkout_configuration_receipt_sha256',
  'stripe_customer_id_sha256',
  'stripe_default_payment_method_id_sha256',
  'stripe_integration_contract_sha256',
  'stripe_monthly_lookup_key',
  'stripe_price_id',
  'stripe_price_receipt_sha256',
  'stripe_product_id',
  'stripe_product_lookup_key',
  'stripe_product_receipt_sha256',
  'stripe_provider_readback_receipt_sha256',
  'stripe_subscription_id_sha256',
  'stripe_subscription_status',
  'trusted_browser_admission_receipt_sha256',
  'stripe_webhook_receipt_sha256',
  'synthetic_account_email_sha256',
  'synthetic_namespace_sha256',
  'trial_days',
]);

export const PROVISION_ATTEMPT_RECEIPT_KEYS = Object.freeze([
  'action',
  'application_sha',
  'contract_version',
  'created_at',
  'immutable_image',
  'initial_cleanup_ledger_raw_sha256',
  'l5_intent_id',
  'sequence_id',
  'state',
  'synthetic_account_email_sha256',
  'synthetic_namespace_sha256',
]);

export const FINAL_RECEIPT_KEYS = Object.freeze([
  'account_deactivation_receipt_sha256',
  'account_user_id_sha256',
  'actual_charge_aud_cents',
  'app_id',
  'application',
  'application_sha',
  'cleanup_ledger_canonical_sha256',
  'completed_at',
  'contract_version',
  'custom_host_qa_receipt_sha256',
  'dns_tls_receipt_sha256',
  'fly_host_qa_receipt_sha256',
  'immutable_image',
  'l5_intent_id',
  'login_denial_receipt_sha256',
  'origin',
  'phase',
  'profession_id',
  'project_result',
  'provision_ledger_sha256',
  'provision_receipt_sha256',
  'payment_validation_ledger_sha256',
  'payment_validation_receipt_sha256',
  'recovery_email_readback_receipt_sha256',
  'refunded_aud_cents',
  'reset_receipt_sha256',
  'restart_receipt_sha256',
  'sequence_id',
  'started_at',
  'stripe_cancellation_receipt_sha256',
  'stripe_customer_id_sha256',
  'stripe_default_payment_method_id_sha256',
  'stripe_post_cleanup_receipt_sha256',
  'stripe_refund_receipt_sha256',
  'stripe_subscription_id_sha256',
  'synthetic_account_email_sha256',
  'synthetic_namespace_sha256',
]);

export const RESUME_CLEANUP_RECEIPT_KEYS = Object.freeze([
  'account_user_id_sha256',
  'action',
  'actual_charge_aud_cents',
  'application_sha',
  'cleanup_step_receipts_sha256',
  'completed_at',
  'contract_version',
  'final_cleanup_ledger_canonical_sha256',
  'final_cleanup_ledger_raw_sha256',
  'immutable_image',
  'l5_intent_id',
  'provision_binding_kind',
  'provision_binding_ledger_sha256',
  'provision_binding_receipt_sha256',
  'payment_validation_receipt_sha256',
  'refunded_aud_cents',
  'result',
  'resume_input_ledger_sha256',
  'sequence_id',
  'started_at',
  'stripe_customer_id_sha256',
  'stripe_default_payment_method_id_sha256',
  'stripe_subscription_id_sha256',
  'synthetic_account_email_sha256',
  'synthetic_namespace_sha256',
]);

function required(environment, name) {
  const value = typeof environment[name] === 'string' ? environment[name].trim() : '';
  if (!value) throw new TypeError(`${name} is required for Physio self-service QA`);
  return value;
}

function optional(environment, name) {
  const value = typeof environment[name] === 'string' ? environment[name].trim() : '';
  return value || null;
}

function exactPattern(environment, name, pattern) {
  const value = required(environment, name);
  if (!pattern.test(value)) throw new TypeError(`${name} has an invalid release-bound value`);
  return value;
}

function exactInteger(environment, name, value) {
  const raw = required(environment, name);
  if (!/^(0|[1-9][0-9]*)$/.test(raw) || Number(raw) !== value) {
    throw new TypeError(`${name} must equal the frozen value ${value}`);
  }
  return value;
}

function exactOrigin(environment, phase) {
  const raw = required(environment, 'PHYSIO_SELF_SERVICE_ORIGIN').replace(/\/$/, '');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new TypeError('PHYSIO_SELF_SERVICE_ORIGIN must be an absolute HTTPS origin');
  }
  if (
    url.protocol !== 'https:'
    || url.pathname !== '/'
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new TypeError('PHYSIO_SELF_SERVICE_ORIGIN must be an exact approved Physio origin');
  }
  const allowedOrigins = SELF_SERVICE_PHASE_ORIGINS[phase];
  if (!allowedOrigins || !allowedOrigins.includes(url.origin) || raw !== url.origin) {
    throw new TypeError(`PHYSIO_SELF_SERVICE_ORIGIN differs from the exact ${phase} origin`);
  }
  return url.origin;
}

function validatePassword(value, name) {
  if (value.length < 16 || value.length > 200 || /\s/.test(value)) {
    throw new TypeError(`${name} is unavailable or malformed`);
  }
  return value;
}

function exactSourceHash(environment, name, repoRoot, relativePath) {
  const expected = exactPattern(environment, name, SHA_256);
  const source = path.resolve(repoRoot, relativePath);
  const relative = path.relative(repoRoot, source);
  const stat = fs.lstatSync(source);
  if (
    !relative
    || relative.startsWith('..')
    || path.isAbsolute(relative)
    || !stat.isFile()
    || stat.isSymbolicLink()
    || sha256(fs.readFileSync(source)) !== expected
  ) {
    throw new TypeError(`${name} differs from the checked-out self-service source`);
  }
  return expected;
}

function assertManifest(repoRoot) {
  const filename = path.join(repoRoot, 'e2e', 'physio-live-self-service', 'journey-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const expected = {
    contract_version: 'assesssuite-physio-live-self-service-journey/4.0.0',
    application: SELF_SERVICE_APPLICATION,
    app_id: SELF_SERVICE_APP_ID,
    profession_id: SELF_SERVICE_PROFESSION_ID,
    catalogue_count: SELF_SERVICE_CATALOGUE_COUNT,
    browser_project: SELF_SERVICE_PROJECT,
    phase_origins: SELF_SERVICE_PHASE_ORIGINS,
    production_phases: {
      provision: [
        'registration-started-ledger',
        'public-registration-ui',
        'direct-gmail-dkim-otp-readback',
        'persisted-content-free-gmail-dkim-readback',
        'normal-otp-verification-ui',
        'live-stripe-checkout-session-ui',
        'trusted-browser-autofill-checkout-completion',
        'content-free-trusted-browser-admission',
        'provider-gated-checkout-return-entitlement',
        'exact-stripe-object-binding',
        'clinician-practice-onboarding-ui',
        'logout-login-ui',
        'post-provision-email-configuration-receipt',
      ],
      finalize: [
        'provision-and-functional-qa-binding',
        'forgot-password-ui',
        'direct-gmail-dkim-reset-readback',
        'password-reset-ui',
        'pre-mutation-stripe-binding-readback',
        'subscription-cancellation-account-deactivation-ui',
        'persisted-deactivation-login-denial-readback',
        'bounded-stripe-refund-reconciliation',
        'terminal-provider-readback',
      ],
    },
    resume_command_replays_registration_or_checkout: false,
    normal_ui_registration_only: true,
    test_otp_or_reset_backdoor_allowed: false,
    email_readback_provider: 'gmail-api',
    dkim_domain: 'assesssuite.com',
    email_configuration_contract_version: EMAIL_CONFIGURATION_RECEIPT_VERSION,
    email_configuration_is_post_provision: true,
    stripe_mode: 'live',
    stripe_api_version: SELF_SERVICE_STRIPE_API_VERSION,
    stripe_currency: 'aud',
    stripe_integration_identifier_pattern: SELF_SERVICE_STRIPE_INTEGRATION_PATTERN,
    stripe_product_lookup_key: SELF_SERVICE_STRIPE_PRODUCT_LOOKUP_KEY,
    stripe_monthly_lookup_key: SELF_SERVICE_STRIPE_MONTHLY_LOOKUP_KEY,
    stripe_annual_lookup_key: SELF_SERVICE_STRIPE_ANNUAL_LOOKUP_KEY,
    dynamic_payment_methods_required: true,
    card_entry_mechanism: SELF_SERVICE_CARD_ENTRY_MECHANISM,
    trusted_browser_profile: SELF_SERVICE_TRUSTED_BROWSER_PROFILE,
    raw_pan_or_cvc_received_by_runner: false,
    direct_payment_method_injection_allowed: false,
    protected_runner_ephemeral_secret_enabled: false,
    checkout_url_retained_in_evidence: false,
    trial_days: 30,
    expected_due_today_aud_cents: 0,
    checkout_immediate_stripe_charge_allowed: false,
    live_payment_validation: {
      action: 'validate_payment',
      contract_version: PAYMENT_VALIDATION_RECEIPT_VERSION,
      amount_aud_cents: 100,
      maximum_authorised_aud_cents: SELF_SERVICE_MAX_CHARGE_AUD_CENTS,
      create_api: 'payment_intents',
      direct_charges_api_create_allowed: false,
      invoice_reconciliation_allowed: false,
      full_refund_required: true,
      email_configuration_receipt_hash_required: true,
    },
    unexpected_charge_requires_refund_and_failed_acceptance: true,
    maximum_refundable_charge_aud_cents: SELF_SERVICE_MAX_CHARGE_AUD_CENTS,
    cancellation_during_trial_required: true,
    monthly_price_aud_cents: 5_500,
    monthly_interval: 'month',
    annual_price_aud_cents: 54_000,
    annual_interval: 'year',
    required_stripe_metadata: {
      appId: SELF_SERVICE_APP_ID,
      professionId: SELF_SERVICE_PROFESSION_ID,
      productLookupKey: SELF_SERVICE_STRIPE_PRODUCT_LOOKUP_KEY,
      qaSequence: 'server-derived-from-authenticated-sequence-email',
    },
    traces_screenshots_video_allowed: false,
    skips_fixmes_mocks_or_provider_substitution_allowed: false,
    one_synthetic_account_only: true,
  };
  if (canonicalJson(manifest) !== canonicalJson(expected)) {
    throw new TypeError('The self-service journey manifest differs from its executable contract');
  }
}

function assertStripeIntegrationSource(repoRoot) {
  const source = fs.readFileSync(path.join(repoRoot, 'server', 'stripeGateway.mjs'), 'utf8');
  const caller = fs.readFileSync(path.join(repoRoot, 'server', 'functions', 'createCheckoutSession.mjs'), 'utf8');
  if (
    !source.includes(`export const STRIPE_API_VERSION = '${SELF_SERVICE_STRIPE_API_VERSION}'`)
    || !source.includes("['integration_identifier', `assesssuite_physio_${integrationSuffix}`]")
    || !source.includes("params.push(['metadata[qaSequence]', qaSequence])")
    || !source.includes("params.push(['subscription_data[metadata][qaSequence]', qaSequence])")
    || !source.includes("['payment_method_collection', 'always']")
    || source.includes('payment_method_types')
    || !caller.includes('selfServiceQaSequenceForEmail(userEmail)')
    || !caller.includes('/PaymentRequired?checkout_return=1')
  ) {
    throw new TypeError('The checked-out Stripe integration contract differs');
  }
  return sha256(canonicalJson({
    api_version: SELF_SERVICE_STRIPE_API_VERSION,
    dynamic_payment_methods: true,
    payment_method_collection: 'always',
    integration_identifier_pattern: SELF_SERVICE_STRIPE_INTEGRATION_PATTERN,
    qa_sequence_source: 'authenticated-email-only',
    checkout_return: '/PaymentRequired?checkout_return=1',
  }));
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return createHash('sha256').update(bytes).digest('hex');
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    throw new TypeError(`${label} fields differ`);
  }
}

export function resolveSelfServiceConfiguration(environment = process.env, requestedPhase = null) {
  if (required(environment, 'PHYSIO_SELF_SERVICE_EXTERNAL_EFFECTS_AUTHORIZED') !== '1') {
    throw new TypeError('Physio self-service QA requires an exact authorised external-effect lane');
  }
  const forbiddenPaymentInputs = [
    'PHYSIO_SELF_SERVICE_STRIPE_CARD_NUMBER',
    'PHYSIO_SELF_SERVICE_STRIPE_CARD_EXPIRY',
    'PHYSIO_SELF_SERVICE_STRIPE_CARD_CVC',
    'PHYSIO_SELF_SERVICE_STRIPE_CARDHOLDER_NAME',
    'PHYSIO_SELF_SERVICE_STRIPE_BILLING_POSTAL_CODE',
    'PHYSIO_SELF_SERVICE_STRIPE_PAYMENT_METHOD_ID',
    'PHYSIO_SELF_SERVICE_PAYMENT_METHOD_ID',
    'PHYSIO_SELF_SERVICE_PROTECTED_RUNNER_EPHEMERAL_SECRET',
  ];
  if (forbiddenPaymentInputs.some((name) => typeof environment[name] === 'string' && environment[name].trim())) {
    throw new TypeError('Raw card data, direct PaymentMethod injection and protected-runner secrets are forbidden');
  }
  if (
    environment.PHYSIO_SELF_SERVICE_CARD_ENTRY_MECHANISM
    && environment.PHYSIO_SELF_SERVICE_CARD_ENTRY_MECHANISM !== SELF_SERVICE_CARD_ENTRY_MECHANISM
  ) {
    throw new TypeError('Hosted Checkout must use the authorised trusted-browser-autofill mechanism');
  }
  const phase = requestedPhase || required(environment, 'PHYSIO_SELF_SERVICE_PHASE');
  if (!['provision', 'validate-payment', 'finalize', 'resume-cleanup'].includes(phase)) {
    throw new TypeError(
      'PHYSIO_SELF_SERVICE_PHASE must be provision, validate-payment, finalize or resume-cleanup',
    );
  }
  if (
    (environment.PHYSIO_SELF_SERVICE_EMAIL_READBACK_MODE
      && environment.PHYSIO_SELF_SERVICE_EMAIL_READBACK_MODE !== 'gmail-api')
    || (environment.PHYSIO_SELF_SERVICE_EMAIL_READBACK_PROVIDER
      && environment.PHYSIO_SELF_SERVICE_EMAIL_READBACK_PROVIDER !== 'gmail-api')
    || environment.PHYSIO_SELF_SERVICE_EMAIL_READBACK_ENDPOINT
  ) {
    throw new TypeError('Launch email proof permits direct Gmail API readback only');
  }
  const origin = exactOrigin(environment, phase);
  const sequenceId = exactPattern(environment, 'PHYSIO_SELF_SERVICE_SEQUENCE_ID', SEQUENCE_ID);
  const namespace = exactPattern(environment, 'PHYSIO_SELF_SERVICE_NAMESPACE', NAMESPACE);
  const suffix = sequenceId.match(SEQUENCE_ID)[1];
  if (namespace.match(NAMESPACE)[1] !== suffix) {
    throw new TypeError('The self-service sequence and namespace bindings differ');
  }
  const email = required(environment, 'PHYSIO_SELF_SERVICE_ACCOUNT_EMAIL').toLowerCase();
  const alias = email.match(/^[^@\s+]+\+assesssuite-physio-self-service-([0-9a-f]{12})@[^@\s]+$/i);
  if (!alias || alias[1].toLowerCase() !== suffix) {
    throw new TypeError('The synthetic account email must use the exact server-derived sequence alias');
  }
  const expectedEmailSha256 = exactPattern(environment, 'PHYSIO_SELF_SERVICE_EXPECTED_EMAIL_SHA256', SHA_256);
  if (sha256(email) !== expectedEmailSha256) {
    throw new TypeError('The named synthetic account differs from its intent binding');
  }
  const repoRoot = path.resolve(process.cwd());
  assertManifest(repoRoot);
  const evidenceDirectory = path.resolve(
    environment.PHYSIO_SELF_SERVICE_EVIDENCE_DIR
      || path.join(repoRoot, 'output', 'playwright', 'physio-live-self-service', sequenceId),
  );
  const relativeEvidence = path.relative(repoRoot, evidenceDirectory);
  if (!relativeEvidence || relativeEvidence.startsWith('..') || path.isAbsolute(relativeEvidence)) {
    throw new TypeError('PHYSIO_SELF_SERVICE_EVIDENCE_DIR must stay inside the repository');
  }

  const configuration = {
    phase,
    contractVersion: SELF_SERVICE_CONTRACT_VERSION,
    application: SELF_SERVICE_APPLICATION,
    appId: SELF_SERVICE_APP_ID,
    professionId: SELF_SERVICE_PROFESSION_ID,
    catalogueCount: SELF_SERVICE_CATALOGUE_COUNT,
    project: SELF_SERVICE_PROJECT,
    origin,
    applicationSha: exactPattern(environment, 'PHYSIO_SELF_SERVICE_EXPECTED_SHA', SHA_40),
    immutableImage: exactPattern(environment, 'PHYSIO_SELF_SERVICE_EXPECTED_IMAGE', IMAGE_DIGEST),
    catalogueChecksum: exactPattern(environment, 'PHYSIO_SELF_SERVICE_EXPECTED_CATALOGUE_CHECKSUM', SHA_256),
    deployReceiptSha256: exactPattern(environment, 'PHYSIO_SELF_SERVICE_DEPLOY_RECEIPT_SHA256', SHA_256),
    exactImageCanaryReceiptSha256: exactPattern(environment, 'PHYSIO_SELF_SERVICE_EXACT_IMAGE_CANARY_RECEIPT_SHA256', SHA_256),
    stripeCheckoutConfigurationReceiptSha256: exactPattern(environment, 'PHYSIO_SELF_SERVICE_STRIPE_CHECKOUT_CONFIGURATION_RECEIPT_SHA256', SHA_256),
    stripeProductReceiptSha256: exactPattern(environment, 'PHYSIO_SELF_SERVICE_STRIPE_PRODUCT_RECEIPT_SHA256', SHA_256),
    stripePriceReceiptSha256: exactPattern(environment, 'PHYSIO_SELF_SERVICE_STRIPE_PRICE_RECEIPT_SHA256', SHA_256),
    stripeAnnualPriceReceiptSha256: exactPattern(environment, 'PHYSIO_SELF_SERVICE_STRIPE_ANNUAL_PRICE_RECEIPT_SHA256', SHA_256),
    stripeWebhookReceiptSha256: exactPattern(environment, 'PHYSIO_SELF_SERVICE_STRIPE_WEBHOOK_RECEIPT_SHA256', SHA_256),
    stripeIntegrationContractSha256: assertStripeIntegrationSource(repoRoot),
    journeyManifestSha256: exactSourceHash(environment, 'PHYSIO_SELF_SERVICE_JOURNEY_MANIFEST_SHA256', repoRoot, 'e2e/physio-live-self-service/journey-manifest.json'),
    dnsTlsReceiptSha256: phase === 'finalize'
      ? exactPattern(environment, 'PHYSIO_SELF_SERVICE_DNS_TLS_RECEIPT_SHA256', SHA_256)
      : null,
    l5IntentId: exactPattern(environment, 'PHYSIO_SELF_SERVICE_L5_INTENT_ID', L5_INTENT_ID),
    sequenceId,
    namespace,
    email,
    emailSha256: expectedEmailSha256,
    initialPassword: phase === 'validate-payment'
      ? null
      : validatePassword(required(environment, 'PHYSIO_SELF_SERVICE_INITIAL_PASSWORD'), 'PHYSIO_SELF_SERVICE_INITIAL_PASSWORD'),
    replacementPassword: phase === 'validate-payment'
      ? null
      : validatePassword(required(environment, 'PHYSIO_SELF_SERVICE_REPLACEMENT_PASSWORD'), 'PHYSIO_SELF_SERVICE_REPLACEMENT_PASSWORD'),
    fullName: phase === 'provision' ? required(environment, 'PHYSIO_SELF_SERVICE_CLINICIAN_NAME') : null,
    clinicName: phase === 'provision' ? required(environment, 'PHYSIO_SELF_SERVICE_CLINIC_NAME') : null,
    clinicAddress: phase === 'provision' ? required(environment, 'PHYSIO_SELF_SERVICE_CLINIC_ADDRESS') : null,
    clinicPhone: phase === 'provision' ? required(environment, 'PHYSIO_SELF_SERVICE_CLINIC_PHONE') : null,
    qualification: phase === 'provision' ? required(environment, 'PHYSIO_SELF_SERVICE_QUALIFICATION') : null,
    registrationNumber: phase === 'provision' ? required(environment, 'PHYSIO_SELF_SERVICE_REGISTRATION_NUMBER') : null,
    emailReadbackMode: 'gmail-api',
    emailReadbackProvider: 'gmail-api',
    emailReadbackBearerToken: phase === 'validate-payment'
      ? null
      : phase === 'resume-cleanup'
      ? environment.PHYSIO_SELF_SERVICE_PROVISION_BINDING_KIND === 'attempt'
        ? optional(environment, 'PHYSIO_SELF_SERVICE_GMAIL_API_BEARER_TOKEN')
        : null
      : exactPattern(environment, 'PHYSIO_SELF_SERVICE_GMAIL_API_BEARER_TOKEN', GMAIL_BEARER),
    emailReadbackMailboxId: phase === 'validate-payment'
      ? null
      : phase === 'resume-cleanup'
      ? environment.PHYSIO_SELF_SERVICE_PROVISION_BINDING_KIND === 'attempt'
        ? optional(environment, 'PHYSIO_SELF_SERVICE_GMAIL_MAILBOX_ID')
        : null
      : required(environment, 'PHYSIO_SELF_SERVICE_GMAIL_MAILBOX_ID'),
    emailReadbackEndpointSha256: sha256(GMAIL_API_ENDPOINT),
    stripeSecretKey: exactPattern(environment, 'PHYSIO_SELF_SERVICE_STRIPE_SECRET_KEY', STRIPE_LIVE_KEY),
    stripeProductId: exactPattern(environment, 'PHYSIO_SELF_SERVICE_STRIPE_PRODUCT_ID', STRIPE_PRODUCT_ID),
    stripePriceId: exactPattern(environment, 'PHYSIO_SELF_SERVICE_STRIPE_PRICE_ID', STRIPE_PRICE_ID),
    stripeAnnualPriceId: exactPattern(environment, 'PHYSIO_SELF_SERVICE_STRIPE_ANNUAL_PRICE_ID', STRIPE_PRICE_ID),
    stripeProductLookupKey: SELF_SERVICE_STRIPE_PRODUCT_LOOKUP_KEY,
    stripeMonthlyLookupKey: SELF_SERVICE_STRIPE_MONTHLY_LOOKUP_KEY,
    stripeAnnualLookupKey: SELF_SERVICE_STRIPE_ANNUAL_LOOKUP_KEY,
    cardEntryMechanism: SELF_SERVICE_CARD_ENTRY_MECHANISM,
    trustedBrowserProfile: SELF_SERVICE_TRUSTED_BROWSER_PROFILE,
    trustedBrowserTimeoutMs: SELF_SERVICE_TRUSTED_BROWSER_TIMEOUT_MS,
    expectedDueTodayAudCents: exactInteger(environment, 'PHYSIO_SELF_SERVICE_EXPECTED_DUE_TODAY_AUD_CENTS', 0),
    maximumChargeAudCents: exactInteger(environment, 'PHYSIO_SELF_SERVICE_MAX_CHARGE_AUD_CENTS', SELF_SERVICE_MAX_CHARGE_AUD_CENTS),
    recurringAmountAudCents: exactInteger(environment, 'PHYSIO_SELF_SERVICE_RECURRING_AMOUNT_AUD_CENTS', 5_500),
    annualRecurringAmountAudCents: exactInteger(environment, 'PHYSIO_SELF_SERVICE_ANNUAL_RECURRING_AMOUNT_AUD_CENTS', 54_000),
    trialDays: exactInteger(environment, 'PHYSIO_SELF_SERVICE_TRIAL_DAYS', 30),
    evidenceDirectory,
    cleanupLedgerPath: path.join(evidenceDirectory, 'physio-live-self-service-cleanup-ledger.json'),
    provisionAttemptReceiptPath: path.join(evidenceDirectory, 'physio-live-self-service-provision-attempt-receipt.json'),
    provisionInitialLedgerPath: path.join(evidenceDirectory, 'physio-live-self-service-provision-initial-ledger.json'),
    provisionLedgerPath: path.join(evidenceDirectory, 'physio-live-self-service-provision-ledger.json'),
    provisionReceiptPath: path.join(evidenceDirectory, 'physio-live-self-service-provision-receipt.json'),
    registrationEmailReadbackReceiptPath: path.join(
      evidenceDirectory,
      'physio-live-self-service-registration-email-readback-receipt.json',
    ),
    emailConfigurationReceiptPath: path.join(
      evidenceDirectory,
      'physio-live-self-service-email-configuration-receipt.json',
    ),
    runtimeEmailReadinessReceiptPath: path.join(
      evidenceDirectory,
      'physio-live-self-service-runtime-email-readiness-receipt.json',
    ),
    finalFragmentPath: path.join(evidenceDirectory, 'physio-live-self-service-final-fragment.json'),
    finalReceiptPath: path.join(evidenceDirectory, 'physio-live-self-service-final-receipt.json'),
    resumeCleanupReceiptPath: path.join(evidenceDirectory, 'physio-live-self-service-resume-cleanup-receipt.json'),
    trustedBrowserAdmissionPath: path.join(
      evidenceDirectory,
      'physio-live-self-service-trusted-browser-admission.json',
    ),
    paymentValidationReceiptPath: path.join(
      evidenceDirectory,
      'physio-live-self-service-payment-validation-receipt.json',
    ),
    paymentValidationLedgerPath: path.join(
      evidenceDirectory,
      'physio-live-self-service-payment-validation-ledger.json',
    ),
  };
  const handoffDirectory = path.resolve(
    environment.PHYSIO_SELF_SERVICE_TRUSTED_BROWSER_HANDOFF_DIR
      || path.join(os.tmpdir(), 'assesssuite-physio-self-service'),
  );
  const relativeHandoffToRepo = path.relative(repoRoot, handoffDirectory);
  const relativeHandoffToEvidence = path.relative(evidenceDirectory, handoffDirectory);
  if (
    (!relativeHandoffToRepo || (!relativeHandoffToRepo.startsWith('..') && !path.isAbsolute(relativeHandoffToRepo)))
    || (!relativeHandoffToEvidence || (!relativeHandoffToEvidence.startsWith('..') && !path.isAbsolute(relativeHandoffToEvidence)))
  ) {
    throw new TypeError('The trusted-browser handoff directory must remain outside the repository and evidence');
  }
  configuration.trustedBrowserHandoffDirectory = handoffDirectory;
  configuration.trustedBrowserHandoffPath = path.join(
    handoffDirectory,
    `${sequenceId}-checkout-handoff.json`,
  );
  if (phase === 'validate-payment' || phase === 'finalize') {
    configuration.expectedProvisionReceiptSha256 = exactPattern(environment, 'PHYSIO_SELF_SERVICE_PROVISION_RECEIPT_SHA256', SHA_256);
    configuration.provisionLedgerSha256 = exactPattern(environment, 'PHYSIO_SELF_SERVICE_PROVISION_LEDGER_SHA256', SHA_256);
  }
  if (phase === 'validate-payment') {
    configuration.expectedEmailConfigurationReceiptSha256 = exactPattern(
      environment,
      'PHYSIO_SELF_SERVICE_EMAIL_CONFIGURATION_RECEIPT_SHA256',
      SHA_256,
    );
    configuration.validationInputLedgerSha256 = exactPattern(
      environment,
      'PHYSIO_SELF_SERVICE_VALIDATION_INPUT_LEDGER_SHA256',
      SHA_256,
    );
  } else if (phase === 'finalize') {
    if (optional(environment, 'PHYSIO_SELF_SERVICE_EMAIL_CONFIGURATION_RECEIPT_SHA256')) {
      throw new TypeError(
        'Finalize derives the email-configuration binding from the immutable payment receipt',
      );
    }
    configuration.expectedPaymentValidationReceiptSha256 = exactPattern(
      environment,
      'PHYSIO_SELF_SERVICE_PAYMENT_VALIDATION_RECEIPT_SHA256',
      SHA_256,
    );
    configuration.paymentValidationLedgerSha256 = exactPattern(
      environment,
      'PHYSIO_SELF_SERVICE_PAYMENT_VALIDATION_LEDGER_SHA256',
      SHA_256,
    );
    configuration.flyHostQaReceiptSha256 = exactPattern(environment, 'PHYSIO_SELF_SERVICE_FLY_HOST_QA_RECEIPT_SHA256', SHA_256);
    configuration.restartReceiptSha256 = exactPattern(environment, 'PHYSIO_SELF_SERVICE_RESTART_RECEIPT_SHA256', SHA_256);
    configuration.customHostQaReceiptSha256 = exactPattern(environment, 'PHYSIO_SELF_SERVICE_CUSTOM_HOST_QA_RECEIPT_SHA256', SHA_256);
  } else if (phase === 'resume-cleanup') {
    if (
      Boolean(configuration.emailReadbackBearerToken)
      !== Boolean(configuration.emailReadbackMailboxId)
      || (configuration.emailReadbackBearerToken
        && !GMAIL_BEARER.test(configuration.emailReadbackBearerToken))
    ) {
      throw new TypeError('Cleanup Gmail credentials must be supplied together and remain well formed');
    }
    configuration.resumeInputLedgerSha256 = exactPattern(environment, 'PHYSIO_SELF_SERVICE_RESUME_INPUT_LEDGER_SHA256', SHA_256);
    configuration.resumeProvisionBindingKind = required(environment, 'PHYSIO_SELF_SERVICE_PROVISION_BINDING_KIND');
    if (!['pass', 'attempt'].includes(configuration.resumeProvisionBindingKind)) {
      throw new TypeError('PHYSIO_SELF_SERVICE_PROVISION_BINDING_KIND must be pass or attempt');
    }
    if (configuration.resumeProvisionBindingKind === 'pass') {
      configuration.expectedProvisionReceiptSha256 = exactPattern(environment, 'PHYSIO_SELF_SERVICE_PROVISION_RECEIPT_SHA256', SHA_256);
      configuration.provisionLedgerSha256 = exactPattern(environment, 'PHYSIO_SELF_SERVICE_PROVISION_LEDGER_SHA256', SHA_256);
      configuration.resumeProvisionBindingReceiptSha256 = configuration.expectedProvisionReceiptSha256;
      configuration.resumeProvisionBindingLedgerSha256 = configuration.provisionLedgerSha256;
      const paymentValidationReceiptSha256 = optional(
        environment,
        'PHYSIO_SELF_SERVICE_PAYMENT_VALIDATION_RECEIPT_SHA256',
      );
      const paymentValidationLedgerSha256 = optional(
        environment,
        'PHYSIO_SELF_SERVICE_PAYMENT_VALIDATION_LEDGER_SHA256',
      );
      if (Boolean(paymentValidationReceiptSha256) !== Boolean(paymentValidationLedgerSha256)) {
        throw new TypeError('Cleanup payment-validation receipt and ledger bindings must be supplied together');
      }
      if (paymentValidationReceiptSha256 && !SHA_256.test(paymentValidationReceiptSha256)) {
        throw new TypeError('Cleanup payment-validation receipt binding is malformed');
      }
      if (paymentValidationLedgerSha256 && !SHA_256.test(paymentValidationLedgerSha256)) {
        throw new TypeError('Cleanup payment-validation ledger binding is malformed');
      }
      configuration.expectedPaymentValidationReceiptSha256 = paymentValidationReceiptSha256;
      configuration.paymentValidationLedgerSha256 = paymentValidationLedgerSha256;
      const emailConfigurationReceiptSha256 = optional(
        environment,
        'PHYSIO_SELF_SERVICE_EMAIL_CONFIGURATION_RECEIPT_SHA256',
      );
      if (emailConfigurationReceiptSha256 && !SHA_256.test(emailConfigurationReceiptSha256)) {
        throw new TypeError('Cleanup email-configuration receipt binding is malformed');
      }
      configuration.expectedEmailConfigurationReceiptSha256 =
        emailConfigurationReceiptSha256 || null;
    } else {
      configuration.provisionAttemptReceiptSha256 = exactPattern(environment, 'PHYSIO_SELF_SERVICE_PROVISION_ATTEMPT_RECEIPT_SHA256', SHA_256);
      configuration.provisionInitialLedgerSha256 = exactPattern(environment, 'PHYSIO_SELF_SERVICE_PROVISION_INITIAL_LEDGER_SHA256', SHA_256);
      configuration.resumeProvisionBindingReceiptSha256 = configuration.provisionAttemptReceiptSha256;
      configuration.resumeProvisionBindingLedgerSha256 = configuration.provisionInitialLedgerSha256;
    }
  } else if (optional(environment, 'PHYSIO_SELF_SERVICE_EMAIL_CONFIGURATION_RECEIPT_SHA256')) {
    throw new TypeError(
      'Provision creates the email-configuration receipt and refuses any pre-existing receipt hash',
    );
  }
  return Object.freeze(configuration);
}

export function createCleanupLedger(configuration, startedAt) {
  return {
    contract_version: CLEANUP_LEDGER_VERSION,
    sequence_id: configuration.sequenceId,
    synthetic_account_email_sha256: configuration.emailSha256,
    synthetic_namespace_sha256: sha256(configuration.namespace),
    state: 'provisioning-started',
    registration_state: 'not-submitted',
    account_user_id_sha256: null,
    stripe_customer_id_sha256: null,
    stripe_subscription_id_sha256: null,
    stripe_default_payment_method_id_sha256: null,
    trusted_browser_admission_receipt_sha256: null,
    checkout_session_id_sha256: null,
    checkout_started_at: null,
    provision_receipt_sha256: null,
    payment_validation_input_ledger_sha256: null,
    payment_validation_receipt_sha256: null,
    payment_validation_started_at: null,
    fly_host_qa_receipt_sha256: null,
    restart_receipt_sha256: null,
    custom_host_qa_receipt_sha256: null,
    dns_tls_receipt_sha256: null,
    created_at: startedAt,
    provisioned_at: null,
    finalization_started_at: null,
    completed_at: null,
    steps: CLEANUP_STEP_NAMES.map((name) => ({
      name,
      state: 'pending',
      started_at: null,
      completed_at: null,
      receipt_sha256: null,
    })),
  };
}

export function writeProvisionAttemptReceipt(configuration, ledger) {
  validateCleanupLedger(ledger, configuration);
  fs.copyFileSync(
    configuration.cleanupLedgerPath,
    configuration.provisionInitialLedgerPath,
    fs.constants.COPYFILE_EXCL,
  );
  const initialCleanupLedgerRawSha256 = sha256(fs.readFileSync(configuration.provisionInitialLedgerPath));
  const receipt = {
    contract_version: PROVISION_ATTEMPT_RECEIPT_VERSION,
    action: 'provision-attempt',
    state: 'prepared-before-first-external-effect',
    application_sha: configuration.applicationSha,
    immutable_image: configuration.immutableImage,
    l5_intent_id: configuration.l5IntentId,
    sequence_id: configuration.sequenceId,
    synthetic_account_email_sha256: configuration.emailSha256,
    synthetic_namespace_sha256: sha256(configuration.namespace),
    initial_cleanup_ledger_raw_sha256: initialCleanupLedgerRawSha256,
    created_at: ledger.created_at,
  };
  assertExactKeys(receipt, PROVISION_ATTEMPT_RECEIPT_KEYS, 'self-service provision-attempt receipt');
  fs.writeFileSync(configuration.provisionAttemptReceiptPath, `${canonicalJson(receipt)}\n`, {
    encoding: 'utf8', mode: 0o600, flag: 'wx', flush: true,
  });
  fs.writeFileSync(
    path.join(configuration.evidenceDirectory, 'PROVISION-ATTEMPT-SHA256SUMS'),
    [
      `${sha256(fs.readFileSync(configuration.provisionAttemptReceiptPath))}  physio-live-self-service-provision-attempt-receipt.json`,
      `${receipt.initial_cleanup_ledger_raw_sha256}  physio-live-self-service-provision-initial-ledger.json`,
    ].join('\n').concat('\n'),
    { encoding: 'utf8', mode: 0o600, flag: 'wx', flush: true },
  );
  return receipt;
}

export function readProvisionAttemptReceipt(configuration) {
  const bytes = fs.readFileSync(configuration.provisionAttemptReceiptPath);
  if (sha256(bytes) !== configuration.provisionAttemptReceiptSha256) {
    throw new TypeError('The provision-attempt receipt differs from its authorised hash');
  }
  const receipt = JSON.parse(bytes.toString('utf8'));
  const initialLedgerBytes = fs.readFileSync(configuration.provisionInitialLedgerPath);
  if (sha256(initialLedgerBytes) !== configuration.provisionInitialLedgerSha256) {
    throw new TypeError('The immutable initial provision ledger differs from its authorised hash');
  }
  validateCleanupLedger(JSON.parse(initialLedgerBytes.toString('utf8')), configuration);
  assertExactKeys(receipt, PROVISION_ATTEMPT_RECEIPT_KEYS, 'self-service provision-attempt receipt');
  if (
    receipt.contract_version !== PROVISION_ATTEMPT_RECEIPT_VERSION
    || receipt.action !== 'provision-attempt'
    || receipt.state !== 'prepared-before-first-external-effect'
    || receipt.application_sha !== configuration.applicationSha
    || receipt.immutable_image !== configuration.immutableImage
    || receipt.l5_intent_id !== configuration.l5IntentId
    || receipt.sequence_id !== configuration.sequenceId
    || receipt.synthetic_account_email_sha256 !== configuration.emailSha256
    || receipt.synthetic_namespace_sha256 !== sha256(configuration.namespace)
    || receipt.initial_cleanup_ledger_raw_sha256 !== configuration.provisionInitialLedgerSha256
  ) {
    throw new TypeError('The provision-attempt receipt binding differs');
  }
  return receipt;
}

export function validateCleanupLedger(ledger, configuration, { requireComplete = false } = {}) {
  assertExactKeys(ledger, CLEANUP_LEDGER_KEYS, 'self-service cleanup ledger');
  if (
    ledger.contract_version !== CLEANUP_LEDGER_VERSION
    || ledger.sequence_id !== configuration.sequenceId
    || ledger.synthetic_account_email_sha256 !== configuration.emailSha256
    || ledger.synthetic_namespace_sha256 !== sha256(configuration.namespace)
    || !['provisioning-started', 'cleanup-required', 'provisioned-awaiting-functional-qa', 'finalization-started', 'completed'].includes(ledger.state)
    || !['not-submitted', 'created-unknown', 'verified'].includes(ledger.registration_state)
    || !Array.isArray(ledger.steps)
    || canonicalJson(ledger.steps.map((step) => step.name)) !== canonicalJson(CLEANUP_STEP_NAMES)
  ) {
    throw new TypeError('The self-service cleanup ledger binding differs');
  }
  for (const step of ledger.steps) {
    assertExactKeys(step, CLEANUP_STEP_KEYS, 'self-service cleanup step');
    if (!['pending', 'started', 'completed', 'failed'].includes(step.state)) {
      throw new TypeError(`The self-service cleanup step ${step.name} has an invalid state`);
    }
    if (step.state === 'completed' && (
      !Date.parse(step.started_at || '')
      || !Date.parse(step.completed_at || '')
      || !SHA_256.test(step.receipt_sha256 || '')
    )) {
      throw new TypeError(`The self-service cleanup step ${step.name} is incomplete`);
    }
  }
  if (requireComplete && (
    ledger.state !== 'completed'
    || !Date.parse(ledger.completed_at || '')
    || ledger.steps.some((step) => step.state !== 'completed')
  )) {
    throw new TypeError('The self-service cleanup ledger has not completed');
  }
  return ledger;
}

export function writeCleanupLedger(configuration, ledger) {
  validateCleanupLedger(ledger, configuration);
  fs.mkdirSync(configuration.evidenceDirectory, { recursive: true });
  const temporaryPath = path.join(
    configuration.evidenceDirectory,
    `.physio-live-self-service-cleanup-ledger-${randomUUID()}.tmp`,
  );
  try {
    fs.writeFileSync(temporaryPath, `${canonicalJson(ledger)}\n`, {
      encoding: 'utf8', mode: 0o600, flag: 'wx', flush: true,
    });
    fs.renameSync(temporaryPath, configuration.cleanupLedgerPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

export function readCleanupLedger(configuration) {
  const ledger = JSON.parse(fs.readFileSync(configuration.cleanupLedgerPath, 'utf8'));
  return validateCleanupLedger(ledger, configuration);
}

export function assertInputLedgerHash(configuration, expectedSha256) {
  if (sha256(fs.readFileSync(configuration.cleanupLedgerPath)) !== expectedSha256) {
    throw new TypeError('The retained cleanup ledger differs from the authorised input hash');
  }
}

export function assertProvisionLedgerSnapshot(configuration) {
  if (sha256(fs.readFileSync(configuration.provisionLedgerPath)) !== configuration.provisionLedgerSha256) {
    throw new TypeError('The immutable provision ledger snapshot differs from its authorised hash');
  }
  const snapshot = JSON.parse(fs.readFileSync(configuration.provisionLedgerPath, 'utf8'));
  validateCleanupLedger(snapshot, configuration);
  if (snapshot.state !== 'provisioned-awaiting-functional-qa') {
    throw new TypeError('The immutable provision ledger snapshot has an invalid state');
  }
  return snapshot;
}

export function updateCleanupStep(configuration, ledger, name, state, receipt = null, { allowResume = false } = {}) {
  const step = ledger.steps.find((candidate) => candidate.name === name);
  if (!step) throw new TypeError(`Unknown self-service cleanup step: ${name}`);
  const now = new Date().toISOString();
  if (state === 'started') {
    if (step.state === 'failed' && allowResume) {
      step.state = 'started';
      step.started_at = now;
      step.completed_at = null;
      step.receipt_sha256 = null;
    } else if (step.state === 'pending') {
      step.state = 'started';
      step.started_at = now;
    } else {
      throw new TypeError(`${name} cannot be replayed from ${step.state}`);
    }
  } else if (state === 'completed' || state === 'failed') {
    if (step.state !== 'started') throw new TypeError(`${name} was not started`);
    step.state = state;
    step.completed_at = now;
    step.receipt_sha256 = receipt ? sha256(canonicalJson(receipt)) : sha256(`${name}:${state}:${now}`);
  } else {
    throw new TypeError(`Unsupported self-service cleanup transition: ${state}`);
  }
  if (state === 'failed') ledger.state = 'cleanup-required';
  writeCleanupLedger(configuration, ledger);
}

export function markRegistrationCreatedUnknown(configuration, ledger) {
  ledger.registration_state = 'created-unknown';
  ledger.state = 'cleanup-required';
  writeCleanupLedger(configuration, ledger);
}

export function markProvisioned(configuration, ledger, provisionReceipt) {
  if (
    ledger.registration_state !== 'verified'
    || ledger.steps.slice(0, 3).some((step) => step.state !== 'completed')
    || ledger.steps.slice(3).some((step) => step.state !== 'pending')
  ) {
    throw new TypeError('The provision ledger is not ready to await functional QA');
  }
  ledger.provision_receipt_sha256 = sha256(Buffer.from(`${canonicalJson(provisionReceipt)}\n`));
  ledger.state = 'provisioned-awaiting-functional-qa';
  ledger.provisioned_at = new Date().toISOString();
  writeCleanupLedger(configuration, ledger);
  fs.copyFileSync(
    configuration.cleanupLedgerPath,
    configuration.provisionLedgerPath,
    fs.constants.COPYFILE_EXCL,
  );
}

export function markValidationPaymentStarted(configuration, ledger) {
  if (
    configuration.phase !== 'validate-payment'
    || ledger.state !== 'provisioned-awaiting-functional-qa'
    || ledger.provision_receipt_sha256 !== configuration.expectedProvisionReceiptSha256
    || ledger.payment_validation_started_at
    || ledger.payment_validation_receipt_sha256
  ) {
    throw new TypeError('AUD 1.00 validation requires the exact untouched provision state');
  }
  assertInputLedgerHash(configuration, configuration.validationInputLedgerSha256);
  ledger.payment_validation_started_at = new Date().toISOString();
  ledger.payment_validation_input_ledger_sha256 = configuration.validationInputLedgerSha256;
  writeCleanupLedger(configuration, ledger);
  updateCleanupStep(
    configuration,
    ledger,
    'stripe-live-payment-validation-reconciliation',
    'started',
  );
}

export function writePaymentValidationReceipt(configuration, ledger, receipt) {
  assertExactKeys(receipt, PAYMENT_VALIDATION_RECEIPT_KEYS, 'AUD 1.00 validation receipt');
  if (
    configuration.phase !== 'validate-payment'
    || receipt?.contract_version !== PAYMENT_VALIDATION_RECEIPT_VERSION
    || receipt?.result !== 'PASS'
    || receipt?.provision_receipt_sha256 !== configuration.expectedProvisionReceiptSha256
    || receipt?.provision_ledger_sha256 !== configuration.provisionLedgerSha256
    || receipt?.validation_input_ledger_sha256 !== configuration.validationInputLedgerSha256
    || receipt?.email_configuration_receipt_sha256
      !== configuration.expectedEmailConfigurationReceiptSha256
    || ledger.payment_validation_receipt_sha256
  ) {
    throw new TypeError('AUD 1.00 validation receipt differs from its durable start binding');
  }
  fs.writeFileSync(configuration.paymentValidationReceiptPath, `${canonicalJson(receipt)}\n`, {
    encoding: 'utf8', mode: 0o600, flag: 'wx', flush: true,
  });
  const paymentValidationReceiptSha256 = sha256(
    fs.readFileSync(configuration.paymentValidationReceiptPath),
  );
  ledger.payment_validation_receipt_sha256 = paymentValidationReceiptSha256;
  updateCleanupStep(
    configuration,
    ledger,
    'stripe-live-payment-validation-reconciliation',
    'completed',
    receipt,
  );
  fs.copyFileSync(
    configuration.cleanupLedgerPath,
    configuration.paymentValidationLedgerPath,
    fs.constants.COPYFILE_EXCL,
  );
  const paymentValidationLedgerSha256 = sha256(
    fs.readFileSync(configuration.paymentValidationLedgerPath),
  );
  fs.writeFileSync(
    path.join(configuration.evidenceDirectory, 'PAYMENT-VALIDATION-SHA256SUMS'),
    [
      `${configuration.expectedProvisionReceiptSha256}  physio-live-self-service-provision-receipt.json`,
      `${configuration.provisionLedgerSha256}  physio-live-self-service-provision-ledger.json`,
      `${configuration.expectedEmailConfigurationReceiptSha256}  physio-live-self-service-email-configuration-receipt.json`,
      `${paymentValidationReceiptSha256}  physio-live-self-service-payment-validation-receipt.json`,
      `${paymentValidationLedgerSha256}  physio-live-self-service-payment-validation-ledger.json`,
      `${sha256(fs.readFileSync(configuration.cleanupLedgerPath))}  physio-live-self-service-cleanup-ledger.json`,
    ].join('\n').concat('\n'),
    { encoding: 'utf8', mode: 0o600, flag: 'wx', flush: true },
  );
  return Object.freeze({
    paymentValidationReceiptSha256,
    paymentValidationLedgerSha256,
  });
}

export function readPaymentValidationReceipt(configuration) {
  const bytes = fs.readFileSync(configuration.paymentValidationReceiptPath);
  if (sha256(bytes) !== configuration.expectedPaymentValidationReceiptSha256) {
    throw new TypeError('The retained AUD 1.00 validation receipt differs from its authorised hash');
  }
  const receipt = JSON.parse(bytes.toString('utf8'));
  assertExactKeys(receipt, PAYMENT_VALIDATION_RECEIPT_KEYS, 'retained AUD 1.00 validation receipt');
  if (
    receipt.contract_version !== PAYMENT_VALIDATION_RECEIPT_VERSION
    || receipt.result !== 'PASS'
    || receipt.provision_receipt_sha256 !== configuration.expectedProvisionReceiptSha256
    || receipt.provision_ledger_sha256 !== configuration.provisionLedgerSha256
    || !SHA_256.test(receipt.email_configuration_receipt_sha256 || '')
    || (configuration.expectedEmailConfigurationReceiptSha256
      && receipt.email_configuration_receipt_sha256
        !== configuration.expectedEmailConfigurationReceiptSha256)
    || receipt.refunded_aud_cents !== 100
  ) {
    throw new TypeError('The retained AUD 1.00 validation receipt binding differs');
  }
  return receipt;
}

export function assertPaymentValidationLedgerSnapshot(configuration) {
  const bytes = fs.readFileSync(configuration.paymentValidationLedgerPath);
  if (sha256(bytes) !== configuration.paymentValidationLedgerSha256) {
    throw new TypeError('The immutable AUD 1.00 validation ledger differs from its authorised hash');
  }
  const ledger = validateCleanupLedger(JSON.parse(bytes.toString('utf8')), configuration);
  if (
    ledger.state !== 'provisioned-awaiting-functional-qa'
    || ledger.payment_validation_receipt_sha256
      !== configuration.expectedPaymentValidationReceiptSha256
    || ledger.steps.find((step) => step.name === 'stripe-live-payment-validation-reconciliation')
      ?.state !== 'completed'
  ) {
    throw new TypeError('The immutable AUD 1.00 validation ledger is incomplete');
  }
  return ledger;
}

export function writeProvisionChecksums(configuration) {
  const lines = [
    ['physio-live-self-service-provision-attempt-receipt.json', configuration.provisionAttemptReceiptPath],
    ['physio-live-self-service-provision-initial-ledger.json', configuration.provisionInitialLedgerPath],
    ['physio-live-self-service-runtime-email-readiness-receipt.json', configuration.runtimeEmailReadinessReceiptPath],
    ['physio-live-self-service-registration-email-readback-receipt.json', configuration.registrationEmailReadbackReceiptPath],
    ['physio-live-self-service-provision-receipt.json', configuration.provisionReceiptPath],
    ['physio-live-self-service-email-configuration-receipt.json', configuration.emailConfigurationReceiptPath],
    ['physio-live-self-service-provision-ledger.json', configuration.provisionLedgerPath],
    ['physio-live-self-service-trusted-browser-admission.json', configuration.trustedBrowserAdmissionPath],
    ['physio-live-self-service-cleanup-ledger.json', configuration.cleanupLedgerPath],
  ].map(([name, filename]) => `${sha256(fs.readFileSync(filename))}  ${name}`).join('\n');
  fs.writeFileSync(
    path.join(configuration.evidenceDirectory, 'PROVISION-SHA256SUMS'),
    `${lines}\n`,
    { encoding: 'utf8', mode: 0o600, flag: 'wx', flush: true },
  );
}

export function beginFinalization(configuration, ledger) {
  assertInputLedgerHash(configuration, configuration.paymentValidationLedgerSha256);
  if (
    ledger.state !== 'provisioned-awaiting-functional-qa'
    || ledger.provision_receipt_sha256 !== configuration.expectedProvisionReceiptSha256
    || ledger.payment_validation_receipt_sha256
      !== configuration.expectedPaymentValidationReceiptSha256
  ) {
    throw new TypeError('Finalization requires the exact provision receipt and awaiting-QA ledger');
  }
  Object.assign(ledger, {
    state: 'finalization-started',
    finalization_started_at: new Date().toISOString(),
    fly_host_qa_receipt_sha256: configuration.flyHostQaReceiptSha256,
    restart_receipt_sha256: configuration.restartReceiptSha256,
    custom_host_qa_receipt_sha256: configuration.customHostQaReceiptSha256,
    dns_tls_receipt_sha256: configuration.dnsTlsReceiptSha256,
  });
  writeCleanupLedger(configuration, ledger);
}

export function markCleanupCompleted(configuration, ledger) {
  if (ledger.steps.some((step) => step.state !== 'completed')) {
    throw new TypeError('Cleanup cannot complete while a reconciliation step remains open');
  }
  ledger.state = 'completed';
  ledger.completed_at = new Date().toISOString();
  writeCleanupLedger(configuration, ledger);
}

function assertHashFields(receipt, keys, label) {
  for (const key of keys) {
    if (!SHA_256.test(receipt[key] || '')) throw new TypeError(`${label} ${key} is invalid`);
  }
}

export function writeProvisionReceipt(configuration, receipt) {
  assertExactKeys(receipt, PROVISION_RECEIPT_KEYS, 'self-service provision receipt');
  if (
    receipt.contract_version !== PROVISION_RECEIPT_VERSION
    || receipt.phase !== 'provision'
    || receipt.project_result !== 'PASS'
    || receipt.application !== configuration.application
    || receipt.app_id !== configuration.appId
    || receipt.profession_id !== configuration.professionId
    || receipt.origin !== configuration.origin
    || receipt.application_sha !== configuration.applicationSha
    || receipt.immutable_image !== configuration.immutableImage
    || receipt.catalogue_count !== configuration.catalogueCount
    || receipt.catalogue_checksum !== configuration.catalogueChecksum
    || receipt.sequence_id !== configuration.sequenceId
    || receipt.synthetic_account_email_sha256 !== configuration.emailSha256
    || receipt.synthetic_namespace_sha256 !== sha256(configuration.namespace)
    || receipt.stripe_product_id !== configuration.stripeProductId
    || receipt.stripe_price_id !== configuration.stripePriceId
    || receipt.stripe_annual_price_id !== configuration.stripeAnnualPriceId
    || receipt.stripe_product_lookup_key !== configuration.stripeProductLookupKey
    || receipt.stripe_monthly_lookup_key !== configuration.stripeMonthlyLookupKey
    || receipt.stripe_annual_lookup_key !== configuration.stripeAnnualLookupKey
    || receipt.stripe_subscription_status !== 'trialing'
    || receipt.card_entry_mechanism !== configuration.cardEntryMechanism
    || receipt.trial_days !== configuration.trialDays
    || receipt.actual_charge_aud_cents !== 0
    || receipt.registration_disposition !== 'verified'
    || receipt.cleanup_state !== 'provisioned-awaiting-functional-qa'
  ) {
    throw new TypeError('The self-service provision receipt differs');
  }
  assertHashFields(receipt, PROVISION_RECEIPT_KEYS.filter((key) => key.endsWith('_sha256')), 'self-service provision receipt');
  fs.mkdirSync(configuration.evidenceDirectory, { recursive: true });
  fs.writeFileSync(configuration.provisionReceiptPath, `${canonicalJson(receipt)}\n`, {
    encoding: 'utf8', mode: 0o600, flag: 'wx', flush: true,
  });
  return sha256(fs.readFileSync(configuration.provisionReceiptPath));
}

export function readProvisionReceipt(configuration) {
  const bytes = fs.readFileSync(configuration.provisionReceiptPath);
  if (sha256(bytes) !== configuration.expectedProvisionReceiptSha256) {
    throw new TypeError('The retained provision receipt differs from its authorised hash');
  }
  const receipt = JSON.parse(bytes.toString('utf8'));
  assertExactKeys(receipt, PROVISION_RECEIPT_KEYS, 'self-service provision receipt');
  if (
    receipt.contract_version !== PROVISION_RECEIPT_VERSION
    || receipt.sequence_id !== configuration.sequenceId
    || receipt.synthetic_account_email_sha256 !== configuration.emailSha256
    || receipt.application_sha !== configuration.applicationSha
    || receipt.immutable_image !== configuration.immutableImage
  ) {
    throw new TypeError('The retained provision receipt binding differs');
  }
  return receipt;
}

export function writeFinalFragment(configuration, fragment) {
  assertExactKeys(fragment, FINAL_RECEIPT_KEYS.filter((key) => key !== 'cleanup_ledger_canonical_sha256'), 'self-service final fragment');
  fs.writeFileSync(configuration.finalFragmentPath, `${canonicalJson(fragment)}\n`, {
    encoding: 'utf8', mode: 0o600, flush: true,
  });
}

export function writeResumeCleanupReceipt(configuration, receipt) {
  assertExactKeys(receipt, RESUME_CLEANUP_RECEIPT_KEYS, 'self-service resume-cleanup receipt');
  if (
    receipt.contract_version !== RESUME_CLEANUP_RECEIPT_VERSION
    || receipt.action !== 'resume_cleanup'
    || receipt.result !== 'PASS'
    || receipt.application_sha !== configuration.applicationSha
    || receipt.immutable_image !== configuration.immutableImage
    || receipt.l5_intent_id !== configuration.l5IntentId
    || receipt.sequence_id !== configuration.sequenceId
    || receipt.provision_binding_kind !== configuration.resumeProvisionBindingKind
    || receipt.provision_binding_receipt_sha256 !== configuration.resumeProvisionBindingReceiptSha256
    || receipt.provision_binding_ledger_sha256 !== configuration.resumeProvisionBindingLedgerSha256
    || receipt.payment_validation_receipt_sha256 !== (
      configuration.expectedPaymentValidationReceiptSha256
        || sha256('no-completed-payment-validation-receipt')
    )
    || receipt.resume_input_ledger_sha256 !== configuration.resumeInputLedgerSha256
    || receipt.synthetic_account_email_sha256 !== configuration.emailSha256
    || receipt.synthetic_namespace_sha256 !== sha256(configuration.namespace)
    || receipt.refunded_aud_cents !== receipt.actual_charge_aud_cents
  ) {
    throw new TypeError('The self-service resume-cleanup receipt differs');
  }
  assertHashFields(
    receipt,
    RESUME_CLEANUP_RECEIPT_KEYS.filter((key) => key.endsWith('_sha256')),
    'self-service resume-cleanup receipt',
  );
  fs.writeFileSync(configuration.resumeCleanupReceiptPath, `${canonicalJson(receipt)}\n`, {
    encoding: 'utf8', mode: 0o600, flag: 'wx', flush: true,
  });
  fs.writeFileSync(
    path.join(configuration.evidenceDirectory, 'RESUME-CLEANUP-SHA256SUMS'),
    [
      `${configuration.resumeProvisionBindingReceiptSha256}  ${configuration.resumeProvisionBindingKind === 'pass'
        ? 'physio-live-self-service-provision-receipt.json'
        : 'physio-live-self-service-provision-attempt-receipt.json'}`,
      `${configuration.resumeProvisionBindingLedgerSha256}  ${configuration.resumeProvisionBindingKind === 'pass'
        ? 'physio-live-self-service-provision-ledger.json'
        : 'physio-live-self-service-provision-initial-ledger.json'}`,
      ...(configuration.expectedPaymentValidationReceiptSha256
        ? [
            `${configuration.expectedPaymentValidationReceiptSha256}  physio-live-self-service-payment-validation-receipt.json`,
            `${configuration.paymentValidationLedgerSha256}  physio-live-self-service-payment-validation-ledger.json`,
          ]
        : []),
      `${sha256(fs.readFileSync(configuration.cleanupLedgerPath))}  physio-live-self-service-cleanup-ledger.json`,
      `${sha256(fs.readFileSync(configuration.resumeCleanupReceiptPath))}  physio-live-self-service-resume-cleanup-receipt.json`,
    ].join('\n').concat('\n'),
    { encoding: 'utf8', mode: 0o600, flag: 'wx', flush: true },
  );
}

export function finalizeSelfServiceReceipt(environment = process.env) {
  const configuration = resolveSelfServiceConfiguration(environment, 'finalize');
  const fragment = JSON.parse(fs.readFileSync(configuration.finalFragmentPath, 'utf8'));
  const ledger = readCleanupLedger(configuration);
  validateCleanupLedger(ledger, configuration, { requireComplete: true });
  const receipt = { ...fragment, cleanup_ledger_canonical_sha256: sha256(canonicalJson(ledger)) };
  assertExactKeys(receipt, FINAL_RECEIPT_KEYS, 'self-service final receipt');
  if (
    receipt.contract_version !== FINAL_RECEIPT_VERSION
    || receipt.phase !== 'finalize'
    || receipt.project_result !== 'PASS'
    || receipt.sequence_id !== configuration.sequenceId
    || receipt.provision_ledger_sha256 !== configuration.provisionLedgerSha256
    || receipt.provision_receipt_sha256 !== configuration.expectedProvisionReceiptSha256
    || receipt.payment_validation_receipt_sha256
      !== configuration.expectedPaymentValidationReceiptSha256
    || receipt.payment_validation_ledger_sha256 !== configuration.paymentValidationLedgerSha256
    || receipt.fly_host_qa_receipt_sha256 !== configuration.flyHostQaReceiptSha256
    || receipt.restart_receipt_sha256 !== configuration.restartReceiptSha256
    || receipt.custom_host_qa_receipt_sha256 !== configuration.customHostQaReceiptSha256
    || receipt.dns_tls_receipt_sha256 !== configuration.dnsTlsReceiptSha256
    || receipt.actual_charge_aud_cents !== 100
    || receipt.refunded_aud_cents !== 100
  ) {
    throw new TypeError('The self-service final receipt differs');
  }
  assertHashFields(receipt, FINAL_RECEIPT_KEYS.filter((key) => key.endsWith('_sha256')), 'self-service final receipt');
  fs.writeFileSync(configuration.finalReceiptPath, `${canonicalJson(receipt)}\n`, {
    encoding: 'utf8', mode: 0o600, flag: 'wx', flush: true,
  });
  const sums = [
    ['physio-live-self-service-provision-attempt-receipt.json', configuration.provisionAttemptReceiptPath],
    ['physio-live-self-service-provision-initial-ledger.json', configuration.provisionInitialLedgerPath],
    ['physio-live-self-service-runtime-email-readiness-receipt.json', configuration.runtimeEmailReadinessReceiptPath],
    ['physio-live-self-service-registration-email-readback-receipt.json', configuration.registrationEmailReadbackReceiptPath],
    ['physio-live-self-service-provision-receipt.json', configuration.provisionReceiptPath],
    ['physio-live-self-service-email-configuration-receipt.json', configuration.emailConfigurationReceiptPath],
    ['physio-live-self-service-provision-ledger.json', configuration.provisionLedgerPath],
    ['physio-live-self-service-payment-validation-receipt.json', configuration.paymentValidationReceiptPath],
    ['physio-live-self-service-payment-validation-ledger.json', configuration.paymentValidationLedgerPath],
    ['physio-live-self-service-cleanup-ledger.json', configuration.cleanupLedgerPath],
    ['physio-live-self-service-final-receipt.json', configuration.finalReceiptPath],
  ].map(([name, filename]) => `${sha256(fs.readFileSync(filename))}  ${name}`).join('\n');
  fs.writeFileSync(path.join(configuration.evidenceDirectory, 'SHA256SUMS'), `${sums}\n`, {
    encoding: 'utf8', mode: 0o600, flush: true,
  });
  fs.rmSync(configuration.finalFragmentPath, { force: true });
  return receipt;
}

export function cleanupTransientEvidence(environment = process.env) {
  const configuration = resolveSelfServiceConfiguration(environment);
  fs.rmSync(path.join(configuration.evidenceDirectory, 'artifacts'), { recursive: true, force: true });
  fs.rmSync(configuration.trustedBrowserHandoffPath, { force: true });
}
