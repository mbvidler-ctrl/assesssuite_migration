import { expect } from '@playwright/test';

import { canonicalJson, sha256 } from './self-service-contract.mjs';
import {
  readLiveStripeState,
} from './stripe-live-readback.mjs';

export function apiRoot(configuration) {
  return `/api/apps/${configuration.appId}`;
}

export async function responseJson(response, label, expectedStatus = 200) {
  const status = response.status();
  const body = await response.json().catch(() => null);
  if (status !== expectedStatus || !body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TypeError(`${label} failed with status ${status}`);
  }
  return body;
}

function authHeaders(configuration, token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'X-App-Id': configuration.appId,
    ...extra,
  };
}

export async function apiJson(configuration, request, token, method, route, body, expectedStatus = 200) {
  const response = await request.fetch(`${apiRoot(configuration)}${route}`, {
    method,
    headers: authHeaders(
      configuration,
      token,
      body === undefined ? {} : { 'Content-Type': 'application/json' },
    ),
    ...(body === undefined ? {} : { data: body }),
    timeout: 90_000,
  });
  return responseJson(response, `${method} ${route}`, expectedStatus);
}

export async function verifyReleaseBinding(configuration, request) {
  const version = await responseJson(await request.get('/api/version'), 'release version');
  expect(version).toMatchObject({
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
  });
  const ready = await responseJson(await request.get('/api/health/ready'), 'release readiness');
  expect(ready).toMatchObject({
    status: 'ready',
    ready: true,
    profession_id: configuration.professionId,
    app_id: configuration.appId,
    failures: [],
  });
  expect(Object.values(ready.checks || {}).every(Boolean)).toBe(true);
  const capabilities = await responseJson(
    await request.get('/api/capabilities'),
    'release capabilities',
  );
  expect(capabilities).toMatchObject({
    contract_version: 'assesssuite-runtime-status/1.0.0',
    profession_id: configuration.professionId,
    app_id: configuration.appId,
    required_dependencies_ready: true,
    production_posture_ready: true,
    production_deployment_ready: true,
    production_posture_mode: 'normal-production',
  });
  for (const name of ['transactional_email', 'payments']) {
    expect(capabilities.capabilities?.[name]).toMatchObject({
      enabled: true,
      required: true,
      ready: true,
      status: 'ready',
    });
  }
  return Object.freeze({
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
    observed_at: new Date().toISOString(),
  });
}

export function contentFreeRegistrationReceipt(configuration, body, disposition) {
  if (
    body?.message !== 'registered'
    || body.otp_required !== true
    || typeof body.user_id !== 'string'
    || body.user_id.length < 4
    || !['created-confirmed', 'created-unknown-resolved'].includes(disposition)
  ) {
    throw new TypeError('The normal registration response or resolution differs');
  }
  return {
    contract_version: 'assesssuite-self-service-registration/2.0.0',
    result: 'PASS',
    disposition,
    account_user_id_sha256: sha256(body.user_id),
    recipient_sha256: configuration.emailSha256,
    otp_required: true,
    observed_at: new Date().toISOString(),
  };
}

export function contentFreeEntitlementReceipt(configuration, user) {
  if (
    user?.email?.toLowerCase() !== configuration.email
    || user.account_status !== 'active'
    || user.subscription_status !== 'active'
    || user.stripe_subscription_status !== 'trialing'
    || typeof user.stripe_customer_id !== 'string'
    || typeof user.stripe_subscription_id !== 'string'
  ) {
    throw new TypeError('The application entitlement/webhook readback differs');
  }
  return {
    contract_version: 'assesssuite-self-service-entitlement-readback/2.0.0',
    result: 'PASS',
    account_user_id_sha256: sha256(user.id),
    recipient_sha256: configuration.emailSha256,
    account_status: 'active',
    subscription_status: 'active',
    stripe_subscription_status: 'trialing',
    stripe_customer_id_sha256: sha256(user.stripe_customer_id),
    stripe_subscription_id_sha256: sha256(user.stripe_subscription_id),
    observed_at: new Date().toISOString(),
  };
}

export async function waitForEntitlement(configuration, request, token) {
  const deadline = Date.now() + 100_000;
  while (Date.now() <= deadline) {
    try {
      const user = await apiJson(configuration, request, token, 'GET', '/entities/User/me');
      if (
        user?.account_status === 'active'
        && user.subscription_status === 'active'
        && user.stripe_subscription_status === 'trialing'
        && typeof user.stripe_customer_id === 'string'
        && typeof user.stripe_subscription_id === 'string'
      ) return user;
    } catch {
      // The public UI independently displays bounded retry state while the
      // webhook and provider indexes converge.
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new TypeError('The application did not publish the exact Stripe trial entitlement');
}

export async function waitForStripeState(configuration, binding) {
  const deadline = Date.now() + 90_000;
  let lastError = null;
  while (Date.now() <= deadline) {
    try {
      return await readLiveStripeState(configuration, binding);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new AggregateError(
    lastError ? [lastError] : [],
    'Stripe did not publish the exact bound subscription within the bounded window',
  );
}

export async function fillSensitive(locator, value, label) {
  try {
    await locator.fill(value);
  } catch {
    throw new TypeError(`${label} could not be entered through the normal interface`);
  }
}

export async function resumeApplicationAfterTrustedCheckout(configuration, page) {
  await page.goto(`${configuration.origin}/PaymentRequired?checkout_return=1`);
  await page.waitForURL((url) => (
    url.origin === configuration.origin
    && url.pathname === '/PaymentRequired'
    && url.searchParams.get('checkout_return') === '1'
  ), { timeout: 90_000 });
  await expect(page.getByText('Confirming your trial')).toBeVisible();
  await page.waitForURL(/\/ProfileSetup(?:\?|$)/, { timeout: 120_000 });
  return true;
}

export async function completeProfileSetup(configuration, page) {
  await page.locator('#clinician_name').fill(configuration.fullName);
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Registered Physiotherapist (Ahpra)' }).click();
  await page.locator('#qualifications').fill(configuration.qualification);
  await page.locator('#registration_number').fill(configuration.registrationNumber);
  await page.locator('#clinic_name').fill(configuration.clinicName);
  await page.locator('#clinic_address').fill(configuration.clinicAddress);
  await page.locator('#clinic_phone').fill(configuration.clinicPhone);
  await page.locator('#clinic_email').fill(configuration.email);
  await page.locator('#consent-accepted').click();
  const save = page.waitForResponse((response) => (
    response.request().method() === 'PUT'
    && response.url().includes(`${apiRoot(configuration)}/entities/User/me`)
  ));
  await page.getByRole('button', { name: 'Complete Setup' }).click();
  await responseJson(await save, 'profile setup');
  await page.waitForURL(/\/Dashboard(?:\?|$)/, { timeout: 120_000 });
  return {
    contract_version: 'assesssuite-self-service-onboarding/2.0.0',
    result: 'PASS',
    clinician_name_sha256: sha256(configuration.fullName),
    clinic_name_sha256: sha256(configuration.clinicName),
    profession: 'Physiotherapist',
    registration_number_sha256: sha256(configuration.registrationNumber),
    completed_at: new Date().toISOString(),
  };
}

export async function loginThroughUi(configuration, page, password, expectedStatus = 200) {
  await page.goto('/login');
  await page.locator('#email').fill(configuration.email);
  await fillSensitive(page.locator('#password'), password, 'Account password');
  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && response.url().endsWith(`${apiRoot(configuration)}/auth/login`)
  ));
  await page.getByRole('button', { name: 'Log in' }).click();
  const response = await responsePromise;
  return responseJson(response, 'normal login', expectedStatus);
}

export function captureAppErrors(configuration, page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.location().url.startsWith(configuration.origin)) {
      consoleErrors.push(sha256(`${message.location().url}:${message.location().lineNumber}`));
    }
  });
  page.on('pageerror', (error) => {
    if (page.url().startsWith(configuration.origin)) pageErrors.push(sha256(error.name || 'Error'));
  });
  return {
    assertClean() {
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    },
  };
}

export function receiptHash(value) {
  return sha256(canonicalJson(value));
}
