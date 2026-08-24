import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CLEANUP_LEDGER_KEYS,
  CLEANUP_STEP_KEYS,
  CLEANUP_STEP_NAMES,
  FINAL_RECEIPT_KEYS,
  PROVISION_ATTEMPT_RECEIPT_KEYS,
  PROVISION_RECEIPT_KEYS,
  RESUME_CLEANUP_RECEIPT_KEYS,
  SELF_SERVICE_MAX_CHARGE_AUD_CENTS,
  assertExactKeys,
  canonicalJson,
  createCleanupLedger,
  markProvisioned,
  resolveSelfServiceConfiguration,
  sha256,
  updateCleanupStep,
  validateCleanupLedger,
  writeCleanupLedger,
  writeProvisionAttemptReceipt,
} from '../../e2e/physio-live-self-service/self-service-contract.mjs';
import {
  EMAIL_CONFIGURATION_RECEIPT_KEYS,
  RUNTIME_EMAIL_READINESS_RECEIPT_KEYS,
  createEmailConfigurationReceipt,
  parsePassingAssessSuiteDkim,
  readEmailConfigurationReceipt,
  validateRuntimeEmailReadinessReceipt,
  waitForProviderEmail,
} from '../../e2e/physio-live-self-service/email-provider-readback.mjs';
import {
  discoverExactCheckoutSessionId,
  reconcileIncompleteCheckoutForCleanup,
} from '../../e2e/physio-live-self-service/stripe-live-readback.mjs';
import { validateAndRefundLivePayment } from '../../e2e/physio-live-self-service/stripe-live-payment-validation.mjs';
import {
  TRUSTED_BROWSER_ADMISSION_VERSION,
  removeTrustedBrowserHandoff,
  validateTrustedBrowserAdmission,
  writeTrustedBrowserCheckoutHandoff,
} from '../../e2e/physio-live-self-service/trusted-browser-checkout.mjs';
import {
  verifyReleaseBinding,
} from '../../e2e/physio-live-self-service/journey-support.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lane = path.join(repoRoot, 'e2e', 'physio-live-self-service');

function sourceHash(relativePath) {
  return sha256(fs.readFileSync(path.join(repoRoot, relativePath)));
}

function environment(overrides = {}) {
  const suffix = '123456abcdef';
  const email = `acceptance+assesssuite-physio-self-service-${suffix}@example.test`;
  return {
    PHYSIO_SELF_SERVICE_PHASE: 'provision',
    PHYSIO_SELF_SERVICE_EXTERNAL_EFFECTS_AUTHORIZED: '1',
    PHYSIO_SELF_SERVICE_ORIGIN: 'https://assesssuite-physio-production.fly.dev',
    PHYSIO_SELF_SERVICE_ACCOUNT_EMAIL: email,
    PHYSIO_SELF_SERVICE_EXPECTED_EMAIL_SHA256: sha256(email),
    PHYSIO_SELF_SERVICE_SEQUENCE_ID: `assesssuite-physio-self-service-${suffix}`,
    PHYSIO_SELF_SERVICE_NAMESPACE: `physio-self-service-${suffix}`,
    PHYSIO_SELF_SERVICE_EXPECTED_SHA: '1'.repeat(40),
    PHYSIO_SELF_SERVICE_EXPECTED_IMAGE: `registry.fly.io/assesssuite-physio-production@sha256:${'2'.repeat(64)}`,
    PHYSIO_SELF_SERVICE_EXPECTED_CATALOGUE_CHECKSUM: '3'.repeat(64),
    PHYSIO_SELF_SERVICE_DEPLOY_RECEIPT_SHA256: '4'.repeat(64),
    PHYSIO_SELF_SERVICE_EXACT_IMAGE_CANARY_RECEIPT_SHA256: '5'.repeat(64),
    PHYSIO_SELF_SERVICE_STRIPE_CHECKOUT_CONFIGURATION_RECEIPT_SHA256: '7'.repeat(64),
    PHYSIO_SELF_SERVICE_STRIPE_PRODUCT_RECEIPT_SHA256: '8'.repeat(64),
    PHYSIO_SELF_SERVICE_STRIPE_PRICE_RECEIPT_SHA256: '9'.repeat(64),
    PHYSIO_SELF_SERVICE_STRIPE_ANNUAL_PRICE_RECEIPT_SHA256: 'b'.repeat(64),
    PHYSIO_SELF_SERVICE_STRIPE_WEBHOOK_RECEIPT_SHA256: 'a'.repeat(64),
    PHYSIO_SELF_SERVICE_JOURNEY_MANIFEST_SHA256: sourceHash('e2e/physio-live-self-service/journey-manifest.json'),
    PHYSIO_SELF_SERVICE_L5_INTENT_ID: 'CAP-PHYSIO-SELF-SERVICE-SYNTHETIC-123456abcdef',
    PHYSIO_SELF_SERVICE_INITIAL_PASSWORD: 'Synthetic-Initial-Password-1!',
    PHYSIO_SELF_SERVICE_REPLACEMENT_PASSWORD: 'Synthetic-Replacement-Password-2!',
    PHYSIO_SELF_SERVICE_CLINICIAN_NAME: 'Synthetic Physio Owner',
    PHYSIO_SELF_SERVICE_CLINIC_NAME: 'Synthetic Physio Practice',
    PHYSIO_SELF_SERVICE_CLINIC_ADDRESS: '1 Synthetic Street, Sydney NSW',
    PHYSIO_SELF_SERVICE_CLINIC_PHONE: '0200000000',
    PHYSIO_SELF_SERVICE_QUALIFICATION: 'Bachelor of Physiotherapy',
    PHYSIO_SELF_SERVICE_REGISTRATION_NUMBER: 'PHY0001234567',
    PHYSIO_SELF_SERVICE_GMAIL_API_BEARER_TOKEN: `ya29.${'b'.repeat(40)}`,
    PHYSIO_SELF_SERVICE_GMAIL_MAILBOX_ID: 'me',
    PHYSIO_SELF_SERVICE_STRIPE_SECRET_KEY: `sk_live_${'c'.repeat(40)}`,
    PHYSIO_SELF_SERVICE_STRIPE_PRODUCT_ID: 'prod_Physio12345678',
    PHYSIO_SELF_SERVICE_STRIPE_PRICE_ID: 'price_PhysioMonthly12345678',
    PHYSIO_SELF_SERVICE_STRIPE_ANNUAL_PRICE_ID: 'price_PhysioAnnual123456789',
    PHYSIO_SELF_SERVICE_CARD_ENTRY_MECHANISM: 'trusted-browser-autofill',
    PHYSIO_SELF_SERVICE_EXPECTED_DUE_TODAY_AUD_CENTS: '0',
    PHYSIO_SELF_SERVICE_MAX_CHARGE_AUD_CENTS: '2000',
    PHYSIO_SELF_SERVICE_RECURRING_AMOUNT_AUD_CENTS: '5500',
    PHYSIO_SELF_SERVICE_ANNUAL_RECURRING_AMOUNT_AUD_CENTS: '54000',
    PHYSIO_SELF_SERVICE_TRIAL_DAYS: '30',
    ...overrides,
  };
}

function apiResponse(body, status = 200) {
  return {
    status: () => status,
    json: async () => structuredClone(body),
  };
}

function releaseBindingRequest(configuration, capabilityOverrides = {}) {
  const bodies = {
    '/api/version': {
      contract_version: 'assesssuite-runtime-status/1.0.0',
      release_sha: configuration.applicationSha,
      profession_id: configuration.professionId,
      app_id: configuration.appId,
      catalogue: {
        count: configuration.catalogueCount,
        expected_count: configuration.catalogueCount,
        checksum: configuration.catalogueChecksum,
        expected_checksum: configuration.catalogueChecksum,
        ready: true,
      },
      database: { integrity: 'ok', schema_ready: true },
    },
    '/api/health/ready': {
      contract_version: 'assesssuite-runtime-status/1.0.0',
      status: 'ready',
      ready: true,
      profession_id: configuration.professionId,
      app_id: configuration.appId,
      checks: {
        identity: true,
        release_metadata: true,
        database_integrity: true,
        database_schema: true,
        catalogue: true,
        required_dependencies: true,
        production_posture: true,
      },
      failures: [],
    },
    '/api/capabilities': {
      contract_version: 'assesssuite-runtime-status/1.0.0',
      profession_id: configuration.professionId,
      app_id: configuration.appId,
      required_dependencies_ready: true,
      production_posture_ready: true,
      production_deployment_ready: true,
      production_posture_mode: 'normal-production',
      capabilities: {
        transactional_email: {
          enabled: true, required: true, ready: true, status: 'ready',
        },
        payments: {
          enabled: true, required: true, ready: true, status: 'ready',
        },
      },
      ...capabilityOverrides,
    },
  };
  return {
    get: async (route) => apiResponse(bodies[route]),
  };
}

function finalizeEnvironment(overrides = {}) {
  return environment({
    PHYSIO_SELF_SERVICE_PHASE: 'finalize',
    PHYSIO_SELF_SERVICE_ORIGIN: 'https://physio.app.assesssuite.com',
    PHYSIO_SELF_SERVICE_PROVISION_RECEIPT_SHA256: 'd'.repeat(64),
    PHYSIO_SELF_SERVICE_PROVISION_LEDGER_SHA256: 'e'.repeat(64),
    PHYSIO_SELF_SERVICE_PAYMENT_VALIDATION_RECEIPT_SHA256: '6'.repeat(64),
    PHYSIO_SELF_SERVICE_PAYMENT_VALIDATION_LEDGER_SHA256: '7'.repeat(64),
    PHYSIO_SELF_SERVICE_FLY_HOST_QA_RECEIPT_SHA256: 'f'.repeat(64),
    PHYSIO_SELF_SERVICE_RESTART_RECEIPT_SHA256: '1'.repeat(64),
    PHYSIO_SELF_SERVICE_CUSTOM_HOST_QA_RECEIPT_SHA256: '2'.repeat(64),
    PHYSIO_SELF_SERVICE_DNS_TLS_RECEIPT_SHA256: 'c'.repeat(64),
    ...overrides,
  });
}

test('provision configuration binds exact pre-DNS Fly host, direct Gmail and commercial offer', () => {
  const configuration = resolveSelfServiceConfiguration(environment());
  assert.equal(configuration.phase, 'provision');
  assert.equal(configuration.origin, 'https://assesssuite-physio-production.fly.dev');
  assert.equal(configuration.emailReadbackProvider, 'gmail-api');
  assert.equal(configuration.emailReadbackEndpointSha256, sha256('https://gmail.googleapis.com/'));
  assert.equal(configuration.dnsTlsReceiptSha256, null);
  assert.equal(configuration.expectedDueTodayAudCents, 0);
  assert.equal(configuration.maximumChargeAudCents, SELF_SERVICE_MAX_CHARGE_AUD_CENTS);
  assert.equal(configuration.recurringAmountAudCents, 5_500);
  assert.equal(configuration.annualRecurringAmountAudCents, 54_000);
  assert.equal(configuration.trialDays, 30);
  assert.equal(configuration.stripeProductLookupKey, 'assesssuite_physio');
  assert.equal(configuration.stripeMonthlyLookupKey, 'assesssuite_physio_monthly_aud_5500');
  assert.equal(configuration.stripeAnnualLookupKey, 'assesssuite_physio_annual_aud_54000');
  assert.equal(configuration.cardEntryMechanism, 'trusted-browser-autofill');
  assert.equal(configuration.trustedBrowserProfile, 'maxwell-existing-trusted-chrome-profile');
  assert.equal(path.relative(repoRoot, configuration.trustedBrowserHandoffPath).startsWith('..'), true);
  assert.equal(Object.hasOwn(configuration, 'expectedEmailConfigurationReceiptSha256'), false);
  assert.throws(
    () => resolveSelfServiceConfiguration(environment({
      PHYSIO_SELF_SERVICE_EMAIL_CONFIGURATION_RECEIPT_SHA256: '6'.repeat(64),
    })),
    /Provision creates the email-configuration receipt/,
  );
});

test('runtime email readiness requires exact Physio production capability identity and posture', async () => {
  const configuration = resolveSelfServiceConfiguration(environment());
  const receipt = await verifyReleaseBinding(
    configuration,
    releaseBindingRequest(configuration),
  );
  assert.equal(receipt.capabilities_contract_version, 'assesssuite-runtime-status/1.0.0');
  assert.equal(receipt.required_dependencies_ready, true);
  assert.equal(receipt.production_posture_ready, true);
  assert.equal(receipt.production_deployment_ready, true);
  assert.equal(receipt.production_posture_mode, 'normal-production');
  assert.equal(receipt.runtime_dependency_name, 'RESEND_API_KEY');

  for (const capabilityOverrides of [
    { contract_version: 'assesssuite-runtime-status/foreign' },
    { profession_id: 'exercise-physiology' },
    { app_id: 'local-assesssuite' },
    { required_dependencies_ready: false },
    { production_posture_ready: false },
    { production_deployment_ready: false },
    { production_posture_mode: 'not-applicable' },
    { production_posture_mode: 'exact-image-canary' },
  ]) {
    await assert.rejects(() => verifyReleaseBinding(
      configuration,
      releaseBindingRequest(configuration, capabilityOverrides),
    ));
  }
});

test('phase inputs are distinct and cleanup resume consumes both immutable and evolving ledger hashes', () => {
  const validationEnvironment = environment({
    PHYSIO_SELF_SERVICE_PHASE: 'validate-payment',
    PHYSIO_SELF_SERVICE_PROVISION_RECEIPT_SHA256: 'd'.repeat(64),
    PHYSIO_SELF_SERVICE_PROVISION_LEDGER_SHA256: 'e'.repeat(64),
    PHYSIO_SELF_SERVICE_VALIDATION_INPUT_LEDGER_SHA256: 'f'.repeat(64),
    PHYSIO_SELF_SERVICE_EMAIL_CONFIGURATION_RECEIPT_SHA256: '6'.repeat(64),
  });
  delete validationEnvironment.PHYSIO_SELF_SERVICE_INITIAL_PASSWORD;
  delete validationEnvironment.PHYSIO_SELF_SERVICE_REPLACEMENT_PASSWORD;
  delete validationEnvironment.PHYSIO_SELF_SERVICE_GMAIL_API_BEARER_TOKEN;
  delete validationEnvironment.PHYSIO_SELF_SERVICE_GMAIL_MAILBOX_ID;
  const validation = resolveSelfServiceConfiguration(validationEnvironment);
  assert.equal(validation.phase, 'validate-payment');
  assert.equal(validation.origin, 'https://assesssuite-physio-production.fly.dev');
  assert.equal(validation.validationInputLedgerSha256, 'f'.repeat(64));
  assert.equal(validation.expectedEmailConfigurationReceiptSha256, '6'.repeat(64));
  assert.equal(validation.initialPassword, null);
  assert.equal(validation.emailReadbackBearerToken, null);

  const finalize = resolveSelfServiceConfiguration(finalizeEnvironment());
  assert.equal(finalize.origin, 'https://physio.app.assesssuite.com');
  assert.equal(finalize.dnsTlsReceiptSha256, 'c'.repeat(64));
  assert.equal(finalize.expectedProvisionReceiptSha256, 'd'.repeat(64));
  assert.equal(finalize.provisionLedgerSha256, 'e'.repeat(64));
  assert.equal(finalize.expectedPaymentValidationReceiptSha256, '6'.repeat(64));
  assert.equal(finalize.paymentValidationLedgerSha256, '7'.repeat(64));
  assert.equal(finalize.flyHostQaReceiptSha256, 'f'.repeat(64));
  assert.equal(finalize.restartReceiptSha256, '1'.repeat(64));
  assert.equal(finalize.customHostQaReceiptSha256, '2'.repeat(64));
  assert.equal(Object.hasOwn(finalize, 'stripeCardNumber'), false);

  const resume = resolveSelfServiceConfiguration(environment({
    PHYSIO_SELF_SERVICE_PHASE: 'resume-cleanup',
    PHYSIO_SELF_SERVICE_PROVISION_BINDING_KIND: 'pass',
    PHYSIO_SELF_SERVICE_PROVISION_RECEIPT_SHA256: 'd'.repeat(64),
    PHYSIO_SELF_SERVICE_PROVISION_LEDGER_SHA256: 'e'.repeat(64),
    PHYSIO_SELF_SERVICE_RESUME_INPUT_LEDGER_SHA256: 'f'.repeat(64),
  }));
  assert.equal(resume.resumeInputLedgerSha256, 'f'.repeat(64));
  assert.equal(resume.resumeProvisionBindingKind, 'pass');
  assert.equal(resume.resumeProvisionBindingReceiptSha256, 'd'.repeat(64));
  assert.equal(resume.resumeProvisionBindingLedgerSha256, 'e'.repeat(64));
  assert.equal(resume.emailReadbackBearerToken, null);
  assert.equal(Object.hasOwn(resume, 'stripeCardNumber'), false);

  const interruptedProvisionResume = resolveSelfServiceConfiguration(environment({
    PHYSIO_SELF_SERVICE_PHASE: 'resume-cleanup',
    PHYSIO_SELF_SERVICE_PROVISION_BINDING_KIND: 'attempt',
    PHYSIO_SELF_SERVICE_PROVISION_ATTEMPT_RECEIPT_SHA256: '7'.repeat(64),
    PHYSIO_SELF_SERVICE_PROVISION_INITIAL_LEDGER_SHA256: '8'.repeat(64),
    PHYSIO_SELF_SERVICE_RESUME_INPUT_LEDGER_SHA256: '9'.repeat(64),
  }));
  assert.equal(interruptedProvisionResume.resumeProvisionBindingKind, 'attempt');
  assert.equal(interruptedProvisionResume.resumeProvisionBindingReceiptSha256, '7'.repeat(64));
  assert.equal(interruptedProvisionResume.resumeProvisionBindingLedgerSha256, '8'.repeat(64));
  assert.match(interruptedProvisionResume.emailReadbackBearerToken, /^ya29\./);
});

test('configuration fails closed on phase host, alias, cost, trial, test Stripe and alternate email readback', () => {
  const invalid = [
    [{ PHYSIO_SELF_SERVICE_ORIGIN: 'https://physio.app.assesssuite.com' }, /exact provision origin/],
    [{ PHYSIO_SELF_SERVICE_ORIGIN: 'https://attacker.invalid' }, /exact provision origin/],
    [{ PHYSIO_SELF_SERVICE_ACCOUNT_EMAIL: 'acceptance+123456abcdef@example.test' }, /exact server-derived sequence alias/],
    [{ PHYSIO_SELF_SERVICE_EXPECTED_DUE_TODAY_AUD_CENTS: '1' }, /must equal the frozen value 0/],
    [{ PHYSIO_SELF_SERVICE_MAX_CHARGE_AUD_CENTS: '2001' }, /must equal the frozen value 2000/],
    [{ PHYSIO_SELF_SERVICE_TRIAL_DAYS: '21' }, /must equal the frozen value 30/],
    [{ PHYSIO_SELF_SERVICE_STRIPE_SECRET_KEY: `sk_test_${'c'.repeat(40)}` }, /invalid release-bound value/],
    [{ PHYSIO_SELF_SERVICE_EMAIL_READBACK_MODE: 'authorised-json-api' }, /direct Gmail API readback only/],
    [{ PHYSIO_SELF_SERVICE_EMAIL_READBACK_ENDPOINT: 'https://adapter.example.test' }, /direct Gmail API readback only/],
    [{ PHYSIO_SELF_SERVICE_STRIPE_CARD_NUMBER: 'not-retained' }, /Raw card data/],
    [{ PHYSIO_SELF_SERVICE_STRIPE_PAYMENT_METHOD_ID: 'pm_direct_injection' }, /direct PaymentMethod injection/],
    [{ PHYSIO_SELF_SERVICE_CARD_ENTRY_MECHANISM: 'protected-runner-ephemeral-secret' }, /trusted-browser-autofill/],
  ];
  for (const [override, pattern] of invalid) {
    assert.throws(() => resolveSelfServiceConfiguration(environment(override)), pattern);
  }
  assert.match(
    resolveSelfServiceConfiguration(environment({
      PHYSIO_SELF_SERVICE_STRIPE_SECRET_KEY: `rk_live_${'r'.repeat(40)}`,
    })).stripeSecretKey,
    /^rk_live_/,
  );
  assert.throws(
    () => resolveSelfServiceConfiguration(finalizeEnvironment({
      PHYSIO_SELF_SERVICE_ORIGIN: 'https://assesssuite-physio-production.fly.dev',
    })),
    /exact finalize origin/,
  );
});

test('DKIM proof requires one correlated passing assesssuite.com signature and selector', () => {
  const headers = new Map([
    ['dkim-signature', [`v=1; a=rsa-sha256; d=assesssuite.com; s=transactional; b=${'A'.repeat(64)}`]],
    ['authentication-results', [
      'mx.google.com; dkim=pass header.i=@assesssuite.com header.s=transactional header.d=assesssuite.com; spf=pass',
    ]],
  ]);
  const proof = parsePassingAssessSuiteDkim(headers);
  assert.equal(proof.domain, 'assesssuite.com');
  assert.equal(proof.selector, 'transactional');
  assert.match(proof.authenticationResultsSha256, /^[0-9a-f]{64}$/);

  const wrong = new Map(headers);
  wrong.set('authentication-results', [
    'mx.google.com; dkim=pass header.i=@mailer.example header.s=transactional header.d=mailer.example',
  ]);
  assert.throws(() => parsePassingAssessSuiteDkim(wrong), /did not correlate/);

  const injectedPassBeforeRealFailure = new Map(headers);
  injectedPassBeforeRealFailure.set('authentication-results', [
    'attacker.invalid; dkim=pass header.i=@assesssuite.com header.s=transactional header.d=assesssuite.com',
    'mx.google.com; dkim=fail header.i=@assesssuite.com header.s=transactional header.d=assesssuite.com',
  ]);
  assert.throws(
    () => parsePassingAssessSuiteDkim(injectedPassBeforeRealFailure),
    /trust boundary was ambiguous/,
  );

  const forgedDuplicateGmailResult = new Map(headers);
  forgedDuplicateGmailResult.set('authentication-results', [
    'mx.google.com; dkim=pass header.i=@assesssuite.com header.s=transactional header.d=assesssuite.com',
    'mx.google.com; dkim=fail header.i=@assesssuite.com header.s=transactional header.d=assesssuite.com',
  ]);
  assert.throws(
    () => parsePassingAssessSuiteDkim(forgedDuplicateGmailResult),
    /trust boundary was ambiguous/,
  );
});

function stripeResponse(body, requestId) {
  return {
    status: 200,
    headers: { get: (name) => (name.toLowerCase() === 'request-id' ? requestId : null) },
    json: async () => body,
  };
}

test('Stripe discovery exhausts cursor pages and rejects duplicate provider objects', { concurrency: false }, async () => {
  const configuration = resolveSelfServiceConfiguration(environment());
  const created = Math.floor(Date.now() / 1000);
  const exact = {
    id: 'cs_live_paginatedexact123456',
    livemode: true,
    created,
    mode: 'subscription',
    status: 'open',
    payment_status: 'unpaid',
    client_reference_id: 'user-exact',
    customer_email: configuration.email,
    customer: null,
    subscription: null,
    metadata: {
      userId: 'user-exact',
      userEmail: configuration.email,
      priceId: configuration.stripePriceId,
      appId: configuration.appId,
      professionId: configuration.professionId,
      qaSequence: configuration.sequenceId,
    },
  };
  const decoy = { ...exact, id: 'cs_live_paginateddecoy123456', client_reference_id: 'user-decoy' };
  const originalFetch = globalThis.fetch;
  const routes = [];
  globalThis.fetch = async (rawUrl) => {
    const url = new URL(rawUrl);
    routes.push(url.search);
    if (!url.searchParams.has('starting_after')) {
      return stripeResponse({ has_more: true, data: [decoy] }, 'req_paginated01');
    }
    assert.equal(url.searchParams.get('starting_after'), decoy.id);
    return stripeResponse({ has_more: false, data: [exact] }, 'req_paginated02');
  };
  try {
    const discovered = await discoverExactCheckoutSessionId(configuration, {
      notBeforeMs: Date.now() - 1_000,
      userId: 'user-exact',
    });
    assert.equal(discovered.checkoutSessionId, exact.id);
    assert.equal(routes.length, 2);

    let page = 0;
    globalThis.fetch = async () => {
      page += 1;
      return stripeResponse(
        { has_more: page === 1, data: [decoy] },
        `req_duplicate${String(page).padStart(2, '0')}`,
      );
    };
    await assert.rejects(
      () => discoverExactCheckoutSessionId(configuration, {
        notBeforeMs: Date.now() - 1_000,
        userId: 'user-exact',
      }),
      /invalid or duplicate Stripe object/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gmail readback exhausts pages, binds exact sender and rejects duplicate IDs', { concurrency: false }, async () => {
  const configuration = resolveSelfServiceConfiguration(environment());
  const now = Date.now();
  const exactId = 'gmail_exact_message_123456';
  const decoyId = 'gmail_decoy_message_123456';
  const exactMessage = {
    id: exactId,
    threadId: 'gmail_exact_thread_123456',
    historyId: '123456789',
    internalDate: String(now),
    payload: {
      mimeType: 'text/plain',
      headers: [
        { name: 'From', value: 'AssessSuite Physiotherapy <verification@assesssuite.com>' },
        { name: 'To', value: configuration.email },
        { name: 'Subject', value: 'Your AssessSuite Physio verification code' },
        { name: 'Message-ID', value: '<synthetic-page@example.test>' },
        { name: 'DKIM-Signature', value: `v=1; d=assesssuite.com; s=transactional; a=rsa-sha256; b=${'A'.repeat(64)}` },
        { name: 'Authentication-Results', value: 'mx.google.com; dkim=pass header.i=@assesssuite.com header.d=assesssuite.com header.s=transactional' },
      ],
      body: { data: Buffer.from('Your verification code is: 123456').toString('base64url') },
    },
  };
  const decoyMessage = {
    ...exactMessage,
    id: decoyId,
    threadId: 'gmail_decoy_thread_123456',
    payload: {
      ...exactMessage.payload,
      headers: exactMessage.payload.headers.map((header) => (
        header.name === 'Subject' ? { ...header, value: 'Unrelated message' } : header
      )),
    },
  };
  const originalFetch = globalThis.fetch;
  const listTokens = [];
  const gmailNextPageField = ['next', 'Page', 'Token'].join('');
  const gmailPage2Fixture = 'synthetic-gmail-page-2';
  globalThis.fetch = async (rawUrl) => {
    const url = new URL(rawUrl);
    if (url.pathname.endsWith('/messages')) {
      const pageCursor = url.searchParams.get('pageToken');
      listTokens.push(pageCursor);
      return stripeResponse(pageCursor
        ? { messages: [{ id: exactId }] }
        : { messages: [{ id: decoyId }], [gmailNextPageField]: gmailPage2Fixture }, 'req_unused01');
    }
    if (url.pathname.endsWith(`/${decoyId}`)) return stripeResponse(decoyMessage, 'req_unused02');
    if (url.pathname.endsWith(`/${exactId}`)) return stripeResponse(exactMessage, 'req_unused03');
    throw new TypeError(`Unexpected Gmail test request: ${url.pathname}`);
  };
  try {
    const result = await waitForProviderEmail(configuration, {
      kind: 'registration',
      notBeforeMs: now - 1_000,
      timeoutMs: 1_000,
      pollIntervalMs: 1,
    });
    assert.equal(result.secret, '123456');
    assert.equal(result.receipt.sender_sha256, sha256('AssessSuite Physiotherapy <verification@assesssuite.com>'));
    assert.deepEqual(listTokens, [null, gmailPage2Fixture]);

    const unintendedRecipient = structuredClone(exactMessage);
    unintendedRecipient.payload.headers = unintendedRecipient.payload.headers.map((header) => (
      header.name === 'To'
        ? { ...header, value: `${configuration.email}, unintended@example.test` }
        : header
    ));
    globalThis.fetch = async (rawUrl) => {
      const url = new URL(rawUrl);
      return url.pathname.endsWith('/messages')
        ? stripeResponse({ messages: [{ id: exactId }] }, 'req_recipient_fixture01')
        : stripeResponse(unintendedRecipient, 'req_recipient_fixture02');
    };
    await assert.rejects(
      () => waitForProviderEmail(configuration, {
        kind: 'registration',
        notBeforeMs: now - 1_000,
        timeoutMs: 1,
        pollIntervalMs: 1,
      }),
      /Timed out waiting for the registration direct Gmail readback/,
    );

    const wrongSender = structuredClone(exactMessage);
    wrongSender.payload.headers = wrongSender.payload.headers.map((header) => (
      header.name === 'From'
        ? { ...header, value: 'Synthetic Impostor <impostor@example.test>' }
        : header
    ));
    globalThis.fetch = async (rawUrl) => {
      const url = new URL(rawUrl);
      return url.pathname.endsWith('/messages')
        ? stripeResponse({ messages: [{ id: exactId }] }, 'req_sender_fixture01')
        : stripeResponse(wrongSender, 'req_sender_fixture02');
    };
    await assert.rejects(
      () => waitForProviderEmail(configuration, {
        kind: 'registration',
        notBeforeMs: now - 1_000,
        timeoutMs: 1,
        pollIntervalMs: 1,
      }),
      /direct Gmail evidence did not match/,
    );

    const duplicateHeader = structuredClone(exactMessage);
    duplicateHeader.payload.headers.push({
      name: 'From',
      value: 'AssessSuite Physiotherapy <verification@assesssuite.com>',
    });
    globalThis.fetch = async (rawUrl) => {
      const url = new URL(rawUrl);
      return url.pathname.endsWith('/messages')
        ? stripeResponse({ messages: [{ id: exactId }] }, 'req_header_fixture01')
        : stripeResponse(duplicateHeader, 'req_header_fixture02');
    };
    await assert.rejects(
      () => waitForProviderEmail(configuration, {
        kind: 'registration',
        notBeforeMs: now - 1_000,
        timeoutMs: 1,
        pollIntervalMs: 1,
      }),
      /duplicated the from header/,
    );

    const decodeBomb = structuredClone(exactMessage);
    decodeBomb.payload.body.data = 'A'.repeat(700_001);
    globalThis.fetch = async (rawUrl) => {
      const url = new URL(rawUrl);
      return url.pathname.endsWith('/messages')
        ? stripeResponse({ messages: [{ id: exactId }] }, 'req_body_fixture01')
        : stripeResponse(decodeBomb, 'req_body_fixture02');
    };
    await assert.rejects(
      () => waitForProviderEmail(configuration, {
        kind: 'registration',
        notBeforeMs: now - 1_000,
        timeoutMs: 1,
        pollIntervalMs: 1,
      }),
      /invalid or excessive base64url/,
    );

    let page = 0;
    globalThis.fetch = async () => {
      page += 1;
      return stripeResponse(
        page === 1
          ? { messages: [{ id: decoyId }], [gmailNextPageField]: gmailPage2Fixture }
          : { messages: [{ id: decoyId }] },
        `req_unused${String(page + 3).padStart(2, '0')}`,
      );
    };
    await assert.rejects(
      () => waitForProviderEmail(configuration, {
        kind: 'registration',
        notBeforeMs: now - 1_000,
        timeoutMs: 1,
        pollIntervalMs: 1,
      }),
      /invalid or duplicate ID/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('post-provision email configuration binds runtime secret readiness and persisted Gmail/DKIM proof', () => {
  const evidenceDirectory = path.join(repoRoot, 'output', `email-configuration-${Date.now()}`);
  const configuration = resolveSelfServiceConfiguration(environment({
    PHYSIO_SELF_SERVICE_EVIDENCE_DIR: evidenceDirectory,
  }));
  const receivedAt = '2026-08-23T01:00:00.000Z';
  const observedAt = '2026-08-23T01:00:01.000Z';
  const registrationEmailReadbackReceipt = {
    contract_version: 'assesssuite-email-dkim-delivery-readback/2.0.0',
    result: 'PASS',
    mailbox_provider: 'gmail-api',
    delivery_identity: 'dkim:assesssuite.com',
    message_kind: 'registration',
    gmail_message_id_sha256: '1'.repeat(64),
    gmail_thread_id_sha256: '2'.repeat(64),
    gmail_history_id_sha256: '3'.repeat(64),
    rfc_message_id_sha256: '4'.repeat(64),
    recipient_sha256: configuration.emailSha256,
    subject_sha256: sha256('Your AssessSuite Physio verification code'),
    synthetic_correlation_sha256: sha256(
      `${configuration.sequenceId}:${configuration.email}:registration`,
    ),
    dkim_domain_sha256: sha256('assesssuite.com'),
    dkim_selector_sha256: '5'.repeat(64),
    authentication_results_sha256: '6'.repeat(64),
    provider_status: 200,
    received_at: receivedAt,
    observed_at: observedAt,
    simulated: false,
    message_body_retained: false,
    secret_retained: false,
    sender_sha256: sha256('AssessSuite Physiotherapy <verification@assesssuite.com>'),
  };
  const runtimeEmailReadinessReceipt = {
    contract_version: 'assesssuite-physio-runtime-email-readiness/1.0.0',
    result: 'PASS',
    application: configuration.application,
    app_id: configuration.appId,
    profession_id: configuration.professionId,
    release_sha: configuration.applicationSha,
    immutable_image: configuration.immutableImage,
    origin: configuration.origin,
    capabilities_endpoint: '/api/capabilities',
    capabilities_contract_version: 'assesssuite-runtime-status/1.0.0',
    required_dependencies_ready: true,
    production_posture_ready: true,
    production_deployment_ready: true,
    production_posture_mode: 'normal-production',
    transactional_email_enabled: true,
    transactional_email_required: true,
    transactional_email_ready: true,
    transactional_email_status: 'ready',
    runtime_dependency_name: 'RESEND_API_KEY',
    runtime_secret_configured: true,
    runtime_secret_value_observed: false,
    runtime_secret_value_retained: false,
    observed_at: '2026-08-23T00:59:59.000Z',
  };
  const provisionReceiptSha256 = 'd'.repeat(64);
  try {
    fs.mkdirSync(evidenceDirectory, { recursive: true });
    fs.writeFileSync(
      configuration.registrationEmailReadbackReceiptPath,
      `${canonicalJson(registrationEmailReadbackReceipt)}\n`,
      { mode: 0o600, flag: 'wx' },
    );
    fs.writeFileSync(
      configuration.runtimeEmailReadinessReceiptPath,
      `${canonicalJson(runtimeEmailReadinessReceipt)}\n`,
      { mode: 0o600, flag: 'wx' },
    );
    const receipt = createEmailConfigurationReceipt(configuration, {
      provisionReceiptSha256,
      registrationEmailReadbackReceipt,
      runtimeEmailReadinessReceipt,
      completedAt: '2026-08-23T01:00:02.000Z',
    });
    assertExactKeys(receipt, EMAIL_CONFIGURATION_RECEIPT_KEYS, 'email configuration receipt');
    assertExactKeys(
      runtimeEmailReadinessReceipt,
      RUNTIME_EMAIL_READINESS_RECEIPT_KEYS,
      'runtime email readiness receipt',
    );
    assert.equal(validateRuntimeEmailReadinessReceipt(
      runtimeEmailReadinessReceipt,
      configuration,
    ), runtimeEmailReadinessReceipt);
    assert.equal(receipt.runtime_dependency_name, 'RESEND_API_KEY');
    assert.equal(receipt.runtime_email_secret_configured, true);
    assert.equal(receipt.runtime_email_secret_value_observed, false);
    assert.equal(receipt.runtime_email_secret_value_retained, false);
    assert.equal(receipt.gmail_message_id_sha256, '1'.repeat(64));
    assert.equal(receipt.gmail_thread_id_sha256, '2'.repeat(64));
    assert.equal(receipt.provision_receipt_sha256, provisionReceiptSha256);
    assert.equal(receipt.deploy_receipt_sha256, configuration.deployReceiptSha256);
    assert.equal(
      receipt.exact_image_canary_receipt_sha256,
      configuration.exactImageCanaryReceiptSha256,
    );
    fs.writeFileSync(
      configuration.emailConfigurationReceiptPath,
      `${canonicalJson(receipt)}\n`,
      { mode: 0o600, flag: 'wx' },
    );
    const expectedReceiptSha256 = sha256(
      fs.readFileSync(configuration.emailConfigurationReceiptPath),
    );
    const retained = readEmailConfigurationReceipt(configuration, {
      expectedReceiptSha256,
      expectedProvisionReceiptSha256: provisionReceiptSha256,
    });
    assert.deepEqual(retained, receipt);
    assert.doesNotMatch(
      canonicalJson(receipt),
      /gmail_exact_message|otp_code|verification code|password|bearer|oauth|resend_(?:message|request|account)/i,
    );
    assert.throws(
      () => createEmailConfigurationReceipt(configuration, {
        provisionReceiptSha256,
        registrationEmailReadbackReceipt,
        runtimeEmailReadinessReceipt: {
          ...runtimeEmailReadinessReceipt,
          runtime_secret_configured: false,
        },
      }),
      /runtime email-readiness receipt differs/,
    );
  } finally {
    fs.rmSync(evidenceDirectory, { recursive: true, force: true });
  }
});

test('live payment validation reconciles a committed response loss by exact metadata and idempotency', { concurrency: false }, async () => {
  const configuration = resolveSelfServiceConfiguration(environment({
    PHYSIO_SELF_SERVICE_PHASE: 'validate-payment',
    PHYSIO_SELF_SERVICE_PROVISION_RECEIPT_SHA256: 'c'.repeat(64),
    PHYSIO_SELF_SERVICE_PROVISION_LEDGER_SHA256: 'd'.repeat(64),
    PHYSIO_SELF_SERVICE_VALIDATION_INPUT_LEDGER_SHA256: 'e'.repeat(64),
    PHYSIO_SELF_SERVICE_EMAIL_CONFIGURATION_RECEIPT_SHA256: '6'.repeat(64),
  }));
  const userId = 'user-payment-validation-fixture';
  const binding = {
    userIdSha256: sha256(userId),
    checkoutSessionId: 'cs_live_validationfixture123456',
    checkoutSessionIdSha256: sha256('cs_live_validationfixture123456'),
    customerId: 'cus_validationfixture123456',
    customerIdSha256: sha256('cus_validationfixture123456'),
    subscriptionId: 'sub_validationfixture123456',
    subscriptionIdSha256: sha256('sub_validationfixture123456'),
    defaultPaymentMethodId: 'pm_validationfixture123456',
    defaultPaymentMethodIdSha256: sha256('pm_validationfixture123456'),
  };
  const paymentIntentId = 'pi_validationfixture123456';
  const chargeId = 'ch_validationfixture123456';
  const refundId = 're_validationfixture123456';
  const metadata = {
    appId: configuration.appId,
    professionId: configuration.professionId,
    l5IntentId: configuration.l5IntentId,
    qaSequence: configuration.sequenceId,
    subscriptionId: binding.subscriptionId,
    provisionReceiptSha256: configuration.expectedProvisionReceiptSha256,
    provisionLedgerSha256: configuration.provisionLedgerSha256,
    emailConfigurationReceiptSha256:
      configuration.expectedEmailConfigurationReceiptSha256,
    validationPurpose: 'assesssuite_physio_live_payment_validation',
  };
  const paymentIntent = {
    id: paymentIntentId,
    livemode: true,
    amount: 100,
    amount_received: 100,
    currency: 'aud',
    customer: binding.customerId,
    payment_method: binding.defaultPaymentMethodId,
    status: 'succeeded',
    latest_charge: chargeId,
    metadata,
  };
  const charge = () => ({
    id: chargeId,
    livemode: true,
    payment_intent: paymentIntentId,
    customer: binding.customerId,
    payment_method: binding.defaultPaymentMethodId,
    amount: 100,
    amount_captured: 100,
    amount_refunded: refundCommitted ? 100 : 0,
    currency: 'aud',
    paid: true,
    status: 'succeeded',
    refunded: refundCommitted,
    invoice: null,
  });
  const refund = {
    id: refundId,
    livemode: true,
    charge: chargeId,
    payment_intent: paymentIntentId,
    amount: 100,
    currency: 'aud',
    status: 'succeeded',
    metadata,
  };
  const originalFetch = globalThis.fetch;
  let paymentIntentCommitted = false;
  let refundCommitted = false;
  let rejectNextPaymentIntent = true;
  let paymentIntentListReads = 0;
  let requestNumber = 0;
  const mutationKeys = [];
  globalThis.fetch = async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    const method = options.method || 'GET';
    if (method !== 'GET') mutationKeys.push(options.headers?.['Idempotency-Key']);
    const response = (body) => stripeResponse(
      body,
      `req_paymentfixture${String(++requestNumber).padStart(2, '0')}`,
    );
    if (url.pathname === `/v1/checkout/sessions/${binding.checkoutSessionId}`) return response({
      id: binding.checkoutSessionId,
      livemode: true,
      status: 'complete',
      payment_status: 'no_payment_required',
      amount_total: 0,
      currency: 'aud',
      payment_method_collection: 'always',
      customer: binding.customerId,
      subscription: binding.subscriptionId,
      metadata: { userId, qaSequence: configuration.sequenceId },
    });
    if (url.pathname === `/v1/subscriptions/${binding.subscriptionId}`) return response({
      id: binding.subscriptionId,
      livemode: true,
      customer: binding.customerId,
      status: 'trialing',
      default_payment_method: binding.defaultPaymentMethodId,
    });
    if (url.pathname === `/v1/customers/${binding.customerId}`) return response({
      id: binding.customerId,
      livemode: true,
      email: configuration.email,
      invoice_settings: { default_payment_method: binding.defaultPaymentMethodId },
    });
    if (url.pathname === `/v1/payment_methods/${binding.defaultPaymentMethodId}`) return response({
      id: binding.defaultPaymentMethodId,
      livemode: true,
      customer: binding.customerId,
    });
    if (url.pathname === '/v1/payment_intents' && method === 'GET') {
      paymentIntentListReads += 1;
      return response({ has_more: false, data: paymentIntentCommitted ? [paymentIntent] : [] });
    }
    if (url.pathname === '/v1/payment_intents' && method === 'POST') {
      if (rejectNextPaymentIntent) {
        rejectNextPaymentIntent = false;
        return {
          status: 402,
          headers: { get: (name) => (name.toLowerCase() === 'request-id' ? 'req_paymentrejected01' : null) },
          json: async () => ({ error: { type: 'synthetic_fixture_rejection' } }),
        };
      }
      paymentIntentCommitted = true;
      throw new TypeError('synthetic response loss after committed PaymentIntent');
    }
    if (url.pathname === `/v1/payment_intents/${paymentIntentId}`) return response(paymentIntent);
    if (url.pathname === `/v1/charges/${chargeId}`) return response(charge());
    if (url.pathname === '/v1/refunds' && method === 'GET') {
      return response({ has_more: false, data: refundCommitted ? [refund] : [] });
    }
    if (url.pathname === '/v1/refunds' && method === 'POST') {
      refundCommitted = true;
      return response(refund);
    }
    if (url.pathname === `/v1/refunds/${refundId}`) return response(refund);
    throw new TypeError(`Unexpected payment validation fixture request: ${method} ${url.pathname}`);
  };
  try {
    await assert.rejects(
      () => validateAndRefundLivePayment(configuration, binding),
      /failed with status 402/,
    );
    assert.equal(paymentIntentListReads, 1);
    assert.equal(paymentIntentCommitted, false);

    const receipt = await validateAndRefundLivePayment(configuration, binding);
    assert.equal(receipt.result, 'PASS');
    assert.equal(receipt.payment_intent_create_disposition, 'created-unknown-resolved');
    assert.equal(receipt.refunded_aud_cents, 100);
    assert.equal(mutationKeys.length, 3);
    assert.match(mutationKeys[0], /^assesssuite_physio_validation_pi_[0-9a-f]{64}$/);
    assert.equal(mutationKeys[1], mutationKeys[0]);
    assert.match(mutationKeys[2], /^assesssuite_physio_validation_refund_[0-9a-f]{64}$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cleanup discovers and expires one exact uncharged interrupted Checkout only after binding reads', { concurrency: false }, async () => {
  const configuration = resolveSelfServiceConfiguration(environment());
  const created = Math.floor(Date.now() / 1000);
  const sessionBase = {
    id: 'cs_live_sequence123456',
    livemode: true,
    created,
    mode: 'subscription',
    status: 'open',
    payment_status: 'unpaid',
    client_reference_id: 'user-exact',
    customer_email: configuration.email,
    customer: null,
    subscription: null,
    metadata: {
      userId: 'user-exact',
      userEmail: configuration.email,
      priceId: configuration.stripePriceId,
      appId: configuration.appId,
      professionId: configuration.professionId,
      qaSequence: configuration.sequenceId,
    },
  };
  const calls = [];
  const mutationIdempotencyKeys = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    const method = options.method || 'GET';
    calls.push(`${method} ${url.pathname}`);
    if (method !== 'GET') mutationIdempotencyKeys.push(options.headers?.['Idempotency-Key']);
    const requestId = `req_contract${String(calls.length).padStart(2, '0')}`;
    if (url.pathname === '/v1/checkout/sessions') {
      return stripeResponse({ has_more: false, data: [sessionBase] }, requestId);
    }
    if (url.pathname === `/v1/checkout/sessions/${sessionBase.id}`) {
      const expired = calls.some((call) => call.endsWith('/expire'));
      return stripeResponse({ ...sessionBase, status: expired ? 'expired' : 'open' }, requestId);
    }
    if (url.pathname === `/v1/prices/${configuration.stripePriceId}`) {
      return stripeResponse({
        id: configuration.stripePriceId,
        livemode: true,
        active: true,
        product: configuration.stripeProductId,
        currency: 'aud',
        unit_amount: 5_500,
        lookup_key: configuration.stripeMonthlyLookupKey,
        type: 'recurring',
        recurring: { interval: 'month', interval_count: 1 },
        metadata: { appId: configuration.appId, professionId: configuration.professionId },
      }, requestId);
    }
    if (url.pathname === `/v1/products/${configuration.stripeProductId}`) {
      return stripeResponse({
        id: configuration.stripeProductId,
        livemode: true,
        active: true,
        name: 'AssessSuite Physiotherapy',
        metadata: {
          appId: configuration.appId,
          professionId: configuration.professionId,
          productLookupKey: configuration.stripeProductLookupKey,
        },
      }, requestId);
    }
    if (url.pathname === `/v1/checkout/sessions/${sessionBase.id}/expire`) {
      return stripeResponse({ ...sessionBase, status: 'expired' }, requestId);
    }
    throw new TypeError(`Unexpected mocked Stripe request: ${method} ${url.pathname}`);
  };
  try {
    const discovered = await discoverExactCheckoutSessionId(configuration, {
      notBeforeMs: Date.now() - 1_000,
      userId: 'user-exact',
    });
    const cleaned = await reconcileIncompleteCheckoutForCleanup(configuration, {
      ...discovered,
      notBeforeMs: Date.now() - 1_000,
    });
    assert.equal(cleaned.receipt.checkout_status, 'expired');
    assert.equal(cleaned.receipt.captured_charge_count, 0);
    const expireIndex = calls.findIndex((call) => call.endsWith('/expire'));
    assert.ok(expireIndex > calls.findIndex((call) => call.includes('/v1/prices/')));
    assert.ok(expireIndex > calls.findIndex((call) => call.includes('/v1/products/')));
    assert.equal(calls.filter((call) => call.endsWith('/expire')).length, 1);
    assert.equal(mutationIdempotencyKeys.length, 1);
    assert.match(mutationIdempotencyKeys[0], /^assesssuite_physio_expire_checkout_[0-9a-f]{64}$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cleanup refuses ambiguous sequence Checkout Sessions before any mutation', { concurrency: false }, async () => {
  const configuration = resolveSelfServiceConfiguration(environment());
  const created = Math.floor(Date.now() / 1000);
  const session = (id) => ({
    id,
    livemode: true,
    created,
    mode: 'subscription',
    status: 'open',
    payment_status: 'unpaid',
    client_reference_id: 'user-exact',
    customer_email: configuration.email,
    customer: null,
    subscription: null,
    metadata: {
      userId: 'user-exact',
      userEmail: configuration.email,
      priceId: configuration.stripePriceId,
      appId: configuration.appId,
      professionId: configuration.professionId,
      qaSequence: configuration.sequenceId,
    },
  });
  const originalFetch = globalThis.fetch;
  let mutations = 0;
  globalThis.fetch = async (_url, options = {}) => {
    if ((options.method || 'GET') !== 'GET') mutations += 1;
    return stripeResponse({
      has_more: false,
      data: [session('cs_live_ambiguous111'), session('cs_live_ambiguous222')],
    }, 'req_ambiguous01');
  };
  try {
    await assert.rejects(() => discoverExactCheckoutSessionId(configuration, {
      notBeforeMs: Date.now() - 1_000,
      userId: 'user-exact',
    }), /missing or ambiguous/);
    assert.equal(mutations, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('durable ledger records created-unknown state and snapshots provision without circular hashes', () => {
  const evidenceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'physio-self-service-contract-'));
  const configuration = resolveSelfServiceConfiguration(environment({
    PHYSIO_SELF_SERVICE_EVIDENCE_DIR: path.relative(repoRoot, evidenceDirectory).startsWith('..')
      ? path.join(repoRoot, 'output', `contract-${Date.now()}`)
      : evidenceDirectory,
  }));
  try {
    const ledger = createCleanupLedger(configuration, '2026-08-22T00:00:00.000Z');
    assertExactKeys(ledger, CLEANUP_LEDGER_KEYS, 'cleanup ledger');
    assert.equal(ledger.steps.length, CLEANUP_STEP_NAMES.length);
    for (const step of ledger.steps) assertExactKeys(step, CLEANUP_STEP_KEYS, 'cleanup step');
    writeCleanupLedger(configuration, ledger);
    const attempt = writeProvisionAttemptReceipt(configuration, ledger);
    assert.equal(
      attempt.initial_cleanup_ledger_raw_sha256,
      sha256(fs.readFileSync(configuration.provisionInitialLedgerPath)),
    );
    assert.deepEqual(
      fs.readFileSync(configuration.provisionInitialLedgerPath),
      fs.readFileSync(configuration.cleanupLedgerPath),
    );
    updateCleanupStep(configuration, ledger, CLEANUP_STEP_NAMES[0], 'started');
    ledger.registration_state = 'verified';
    ledger.account_user_id_sha256 = '1'.repeat(64);
    updateCleanupStep(configuration, ledger, CLEANUP_STEP_NAMES[0], 'completed', { result: 'PASS' });
    updateCleanupStep(configuration, ledger, CLEANUP_STEP_NAMES[1], 'started');
    updateCleanupStep(configuration, ledger, CLEANUP_STEP_NAMES[1], 'completed', { result: 'PASS' });
    updateCleanupStep(configuration, ledger, CLEANUP_STEP_NAMES[2], 'started');
    ledger.checkout_started_at = '2026-08-22T00:01:00.000Z';
    ledger.checkout_session_id_sha256 = '2'.repeat(64);
    ledger.stripe_customer_id_sha256 = '3'.repeat(64);
    ledger.stripe_subscription_id_sha256 = '4'.repeat(64);
    ledger.stripe_default_payment_method_id_sha256 = '5'.repeat(64);
    writeCleanupLedger(configuration, ledger);
    updateCleanupStep(configuration, ledger, CLEANUP_STEP_NAMES[2], 'completed', { result: 'PASS' });
    markProvisioned(configuration, ledger, { result: 'PASS' });
    assert.equal(ledger.state, 'provisioned-awaiting-functional-qa');
    assert.deepEqual(
      fs.readFileSync(configuration.provisionLedgerPath),
      fs.readFileSync(configuration.cleanupLedgerPath),
    );
    assert.notEqual(
      sha256(fs.readFileSync(configuration.cleanupLedgerPath)),
      sha256(canonicalJson(ledger)),
    );
    assert.throws(() => validateCleanupLedger(ledger, configuration, { requireComplete: true }), /has not completed/);
    assert.doesNotMatch(JSON.stringify(ledger), /password|bearer|card_number|cvc|reset_token|otp_code/i);
  } finally {
    fs.rmSync(configuration.evidenceDirectory, { recursive: true, force: true });
    fs.rmSync(evidenceDirectory, { recursive: true, force: true });
  }
});

test('cleanup-only resume completes locally from the durable pre-submit no-effect marker without Gmail', () => {
  const evidenceDirectory = path.join(repoRoot, 'output', `contract-no-effect-${Date.now()}`);
  const provisionEnvironment = environment({
    PHYSIO_SELF_SERVICE_EVIDENCE_DIR: evidenceDirectory,
  });
  const provision = resolveSelfServiceConfiguration(provisionEnvironment);
  try {
    const ledger = createCleanupLedger(provision, '2026-08-22T00:00:00.000Z');
    assert.equal(ledger.registration_state, 'not-submitted');
    writeCleanupLedger(provision, ledger);
    writeProvisionAttemptReceipt(provision, ledger);

    const resumeEnvironment = {
      ...process.env,
      ...provisionEnvironment,
      PHYSIO_SELF_SERVICE_PHASE: 'resume-cleanup',
      PHYSIO_SELF_SERVICE_PROVISION_BINDING_KIND: 'attempt',
      PHYSIO_SELF_SERVICE_PROVISION_ATTEMPT_RECEIPT_SHA256: sha256(
        fs.readFileSync(provision.provisionAttemptReceiptPath),
      ),
      PHYSIO_SELF_SERVICE_PROVISION_INITIAL_LEDGER_SHA256: sha256(
        fs.readFileSync(provision.provisionInitialLedgerPath),
      ),
      PHYSIO_SELF_SERVICE_RESUME_INPUT_LEDGER_SHA256: sha256(
        fs.readFileSync(provision.cleanupLedgerPath),
      ),
    };
    delete resumeEnvironment.PHYSIO_SELF_SERVICE_GMAIL_API_BEARER_TOKEN;
    delete resumeEnvironment.PHYSIO_SELF_SERVICE_GMAIL_MAILBOX_ID;
    const result = spawnSync(
      process.execPath,
      ['e2e/physio-live-self-service/resume-cleanup.mjs'],
      { cwd: repoRoot, env: resumeEnvironment, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const completed = JSON.parse(fs.readFileSync(provision.cleanupLedgerPath, 'utf8'));
    assert.equal(completed.state, 'completed');
    assert.equal(completed.registration_state, 'not-submitted');
    assert.equal(completed.steps.every((step) => step.state === 'completed'), true);
    const receipt = JSON.parse(fs.readFileSync(provision.resumeCleanupReceiptPath, 'utf8'));
    assert.equal(receipt.action, 'resume_cleanup');
    assert.equal(receipt.provision_binding_kind, 'attempt');
    assert.equal(receipt.result, 'PASS');
  } finally {
    fs.rmSync(evidenceDirectory, { recursive: true, force: true });
  }
});

test('receipt allowlists are unique, content-free and distinguish provision, final and cleanup-only evidence', () => {
  for (const keys of [
    PROVISION_ATTEMPT_RECEIPT_KEYS,
    PROVISION_RECEIPT_KEYS,
    EMAIL_CONFIGURATION_RECEIPT_KEYS,
    RUNTIME_EMAIL_READINESS_RECEIPT_KEYS,
    FINAL_RECEIPT_KEYS,
    RESUME_CLEANUP_RECEIPT_KEYS,
  ]) {
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(keys.some((key) => (
      /password|bearer|card_number|cvc|reset_token|otp_code/i.test(key)
      && !key.endsWith('_sha256')
    )), false);
  }
  assert.equal(PROVISION_RECEIPT_KEYS.includes('dns_tls_receipt_sha256'), false);
  assert.equal(PROVISION_RECEIPT_KEYS.includes('gmail_registration_message_id_sha256'), true);
  assert.equal(PROVISION_RECEIPT_KEYS.includes('email_configuration_receipt_sha256'), false);
  assert.equal(EMAIL_CONFIGURATION_RECEIPT_KEYS.includes('provision_receipt_sha256'), true);
  assert.equal(
    EMAIL_CONFIGURATION_RECEIPT_KEYS.includes('runtime_email_readiness_receipt_sha256'),
    true,
  );
  assert.equal(PROVISION_RECEIPT_KEYS.includes('initial_password_sha256'), false);
  assert.equal(FINAL_RECEIPT_KEYS.includes('provision_ledger_sha256'), true);
  assert.equal(FINAL_RECEIPT_KEYS.includes('cleanup_ledger_canonical_sha256'), true);
  assert.equal(RESUME_CLEANUP_RECEIPT_KEYS.includes('resume_input_ledger_sha256'), true);
  assert.equal(RESUME_CLEANUP_RECEIPT_KEYS.includes('provision_binding_kind'), true);
  assert.equal(RESUME_CLEANUP_RECEIPT_KEYS.includes('final_cleanup_ledger_raw_sha256'), true);
});

test('browser and provider sources enforce split phases, exact bindings and cleanup-only non-creation', () => {
  const provision = fs.readFileSync(path.join(lane, 'provision.spec.mjs'), 'utf8');
  const finalize = fs.readFileSync(path.join(lane, 'finalize.spec.mjs'), 'utf8');
  const support = fs.readFileSync(path.join(lane, 'journey-support.mjs'), 'utf8');
  const resume = fs.readFileSync(path.join(lane, 'resume-cleanup.mjs'), 'utf8');
  const email = fs.readFileSync(path.join(lane, 'email-provider-readback.mjs'), 'utf8');
  const stripe = fs.readFileSync(path.join(lane, 'stripe-live-readback.mjs'), 'utf8');
  const paymentValidation = fs.readFileSync(
    path.join(lane, 'stripe-live-payment-validation.mjs'),
    'utf8',
  );
  const config = fs.readFileSync(path.join(lane, 'playwright.config.mjs'), 'utf8');
  const profile = fs.readFileSync(path.join(repoRoot, 'src', 'pages', 'MyProfile.jsx'), 'utf8');
  assert.match(provision, /page\.goto\('\/register'\)/);
  assert.match(provision, /markRegistrationCreatedUnknown/);
  assert.match(support, /Confirming your trial/);
  assert.match(finalize, /readLiveStripeState[\s\S]*Cancel subscription and close account/);
  assert.match(finalize, /account_deactivated/);
  assert.match(finalize, /waitForURL\(\/\\\/AccountDeactivated/);
  assert.match(profile, /logout\(window\.location\.origin \+ "\/AccountDeactivated"\)/);
  assert.match(email, /https:\/\/gmail\.googleapis\.com/);
  assert.equal(email.includes('header\\\\.d=assesssuite\\\\.com'), true);
  assert.doesNotMatch(
    `${email}\n${fs.readFileSync(path.join(lane, 'self-service-contract.mjs'), 'utf8')}`,
    /authorised-json-api|sending_provider|resend_(?:account|message|request)|api\.resend/i,
  );
  assert.doesNotMatch(email, /export function writeEmailConfiguration|export function persist/i);
  assert.match(stripe, /metadata\?\.qaSequence === configuration\.sequenceId/);
  assert.match(stripe, /recentSubscriptions\.length !== 1/);
  assert.match(stripe, /invoiceSubscriptionId\(invoice\) !== binding\.subscriptionId/);
  assert.match(stripe, /exactMetadata\(invoiceSubscriptionMetadata\(invoice\)/);
  assert.match(stripe, /exceeds the AUD 20 refund authority; no refund was mutated/);
  assert.match(stripe, /mutationIdempotencyKey\(\s*'cancel_subscription'/);
  assert.match(stripe, /mutationIdempotencyKey\('refund_charge'/);
  assert.match(stripe, /invalid or duplicate Stripe object/);
  assert.match(paymentValidation, /instanceof StripeProviderRejection/);
  assert.match(paymentValidation, /cross-object metadata drift/);
  assert.equal((paymentValidation.match(/await stripeListAll\(/g) || []).length, 2);
  assert.match(email, /MAX_GMAIL_LIST_PAGES/);
  assert.match(email, /MAX_DECODED_BODY_BYTES/);
  assert.match(email, /synthetic_correlation_sha256/);
  assert.doesNotMatch(resume, /\/auth\/register|createCheckoutSession|\/v1\/checkout\/sessions[^?]/);
  assert.match(resume, /verification\.status === 401[\s\S]*\/auth\/resend-otp/);
  assert.match(resume, /excludeMessageIdSha256: message\.receipt\.gmail_message_id_sha256/);
  assert.match(email, /excludeMessageIdSha256 && sha256\(message\.id \|\| ''\) === excludeMessageIdSha256/);
  assert.match(config, /trace: 'off'/);
  assert.match(config, /screenshot: 'off'/);
  assert.match(config, /video: 'off'/);
  assert.doesNotMatch(`${provision}\n${finalize}`, /\.skip\s*\(|\.fixme\s*\(|page\.route\s*\(|route\.fulfill\s*\(|000000/);
});

test('manifest fixes one account and exact ordered two-phase journey', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(lane, 'journey-manifest.json'), 'utf8'));
  assert.equal(manifest.contract_version, 'assesssuite-physio-live-self-service-journey/4.0.0');
  assert.equal(
    manifest.email_configuration_contract_version,
    'assesssuite-physio-email-configuration/1.0.0',
  );
  assert.equal(manifest.email_configuration_is_post_provision, true);
  assert.equal(
    manifest.live_payment_validation.email_configuration_receipt_hash_required,
    true,
  );
  assert.equal(manifest.one_synthetic_account_only, true);
  assert.equal(manifest.email_readback_provider, 'gmail-api');
  assert.equal(manifest.dkim_domain, 'assesssuite.com');
  assert.equal(manifest.trial_days, 30);
  assert.equal(manifest.maximum_refundable_charge_aud_cents, 2_000);
  assert.deepEqual(manifest.phase_origins, {
    provision: ['https://assesssuite-physio-production.fly.dev'],
    'validate-payment': ['https://assesssuite-physio-production.fly.dev'],
    finalize: ['https://physio.app.assesssuite.com'],
    'resume-cleanup': [
      'https://assesssuite-physio-production.fly.dev',
      'https://physio.app.assesssuite.com',
    ],
  });
  assert.deepEqual(Object.keys(manifest.production_phases), ['provision', 'finalize']);
  assert.equal(manifest.resume_command_replays_registration_or_checkout, false);
  assert.equal(manifest.required_stripe_metadata.qaSequence, 'server-derived-from-authenticated-sequence-email');
  assert.equal(manifest.card_entry_mechanism, 'trusted-browser-autofill');
  assert.equal(manifest.raw_pan_or_cvc_received_by_runner, false);
  assert.equal(manifest.direct_payment_method_injection_allowed, false);
  assert.equal(manifest.checkout_url_retained_in_evidence, false);
});

test('trusted-browser handoff is transient and admission is content-free, exact and stale-safe', () => {
  const evidenceDirectory = path.join(repoRoot, 'output', `trusted-browser-${Date.now()}`);
  const configuration = resolveSelfServiceConfiguration(environment({
    PHYSIO_SELF_SERVICE_EVIDENCE_DIR: evidenceDirectory,
  }));
  const checkoutSessionId = 'cs_live_trustedbrowser123456';
  const checkoutUrl = `https://checkout.stripe.com/c/pay/${checkoutSessionId}#opaque-provider-fragment`;
  const checkoutNotBefore = new Date(Date.now() - 1_000).toISOString();
  try {
    fs.mkdirSync(evidenceDirectory, { recursive: true });
    const handoff = writeTrustedBrowserCheckoutHandoff(configuration, {
      checkoutUrl,
      checkoutSessionId,
      checkoutNotBefore,
    });
    const rawHandoff = fs.readFileSync(configuration.trustedBrowserHandoffPath, 'utf8');
    assert.match(rawHandoff, /checkout\.stripe\.com/);
    const parsedHandoff = JSON.parse(rawHandoff);
    assert.equal(parsedHandoff.pan_or_cvc_present, false);
    for (const forbidden of ['card_number', 'card_expiry', 'card_cvc', 'payment_method_id']) {
      assert.equal(Object.hasOwn(parsedHandoff, forbidden), false);
    }
    assert.equal(fs.existsSync(path.join(evidenceDirectory, path.basename(configuration.trustedBrowserHandoffPath))), false);

    const openedAt = new Date().toISOString();
    const admission = {
      contract_version: TRUSTED_BROWSER_ADMISSION_VERSION,
      action: 'complete_hosted_checkout',
      result: 'PASS',
      application: configuration.application,
      app_id: configuration.appId,
      profession_id: configuration.professionId,
      l5_intent_id: configuration.l5IntentId,
      sequence_id: configuration.sequenceId,
      card_entry_mechanism: configuration.cardEntryMechanism,
      browser_profile: configuration.trustedBrowserProfile,
      checkout_session_id_sha256: handoff.checkoutSessionIdSha256,
      checkout_url_sha256: handoff.checkoutUrlSha256,
      checkout_not_before: handoff.checkoutNotBefore,
      handoff_created_at: handoff.createdAt,
      normal_hosted_checkout: true,
      trusted_browser_completion_observed: true,
      pan_or_cvc_received_by_control_plane: false,
      pan_or_cvc_retained: false,
      direct_payment_method_injection: false,
      protected_runner_alternate_enabled: false,
      opened_at: openedAt,
      completed_at: new Date().toISOString(),
    };
    assert.equal(validateTrustedBrowserAdmission(configuration, handoff, admission), admission);
    assert.doesNotMatch(JSON.stringify(admission), /checkout\.stripe\.com|cs_live_|"pm_[^"]+"/i);
    assert.throws(
      () => validateTrustedBrowserAdmission(configuration, handoff, {
        ...admission,
        direct_payment_method_injection: true,
      }),
      /direct PaymentMethod injection posture/,
    );
  } finally {
    removeTrustedBrowserHandoff(configuration);
    fs.rmSync(evidenceDirectory, { recursive: true, force: true });
  }
});
