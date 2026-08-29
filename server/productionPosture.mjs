import { createHash } from 'node:crypto';
import { capabilityEnabled } from './capabilityFlags.mjs';
import { assertTestProviderInjectionAbsent } from './providerServices.mjs';
import { sentryReleaseForProfession } from '../packages/profession-config/sentry-release.mjs';

export const PHYSIO_PRODUCTION_POSTURE_CONTRACT_VERSION =
  'assesssuite-physio-production-posture/1.0.0';
export const PHYSIO_EXACT_IMAGE_CANARY_MODE = 'PHYSIO_EXACT_IMAGE_CANARY_MODE';
export const PHYSIO_EXACT_IMAGE_CANARY_ACK =
  'I_ACKNOWLEDGE_THIS_USES_ONLY_SYNTHETIC_FIXTURES_IN_A_DISPOSABLE_NO_SERVICE_NO_VOLUME_NO_DNS_CONTAINER';
export const PHYSIO_PRODUCTION_UPLOADS_DIR = '/app/server/data/physio-uploads';
export const PHYSIO_PRODUCTION_DATA_FILE = '/app/server/data/physio.db';
export const PHYSIO_MODEL_FAST = 'gpt-4.1-mini-2025-04-14';
export const PHYSIO_MODEL_QUALITY = 'gpt-4.1-2025-04-14';

const RELEASE_SHA = /^[0-9a-f]{40}$/;
const PLACEHOLDER = /^(?:change-me|dummy|fake|mock|placeholder|synthetic|test)(?:[-_:]|$)/i;
const SENTRY_HOST = 'o4511822688813056.ingest.us.sentry.io';
const SENTRY_PROJECT = '4511827129663488';
const PUBLIC_URL = 'https://physio.app.assesssuite.com';
export const PHYSIO_R1_COMPARISON_VARIANT = 'physio-r1-comparison';
export const PHYSIO_R1_COMPARISON_PUBLIC_URL = 'https://assesssuite-physio-r1.fly.dev';
const CANARY_BOOTSTRAP_RECEIPT =
  /^\/tmp\/physio-exact-image-canary-bootstrap-(?:success|fault)\.json$/;

function configured(environment, name) {
  return typeof environment[name] === 'string' && environment[name].trim() !== '';
}

function realSecret(environment, name) {
  if (!configured(environment, name)) return false;
  const value = environment[name].trim();
  return !PLACEHOLDER.test(value);
}

function validSentryDsn(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && parsed.hostname === SENTRY_HOST
      && parsed.pathname === `/${SENTRY_PROJECT}`
      && /^[A-Za-z0-9_-]{1,256}$/.test(parsed.username)
      && parsed.password === ''
      && parsed.search === ''
      && parsed.hash === '';
  } catch {
    return false;
  }
}

function stablePostureHash(input) {
  const canonical = JSON.stringify(Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => left.localeCompare(right)),
  ));
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

function addExactFailures(failures, environment, expected) {
  for (const [name, value] of Object.entries(expected)) {
    if (environment[name] !== value) failures.push(`${name}_must_equal_${value}`);
  }
}

function addAbsentFailures(failures, environment, names) {
  for (const name of names) {
    if (configured(environment, name)) failures.push(`${name}_must_be_absent`);
  }
}

/**
 * Pure, non-egressing configuration gate. Provider behaviour remains the
 * responsibility of exact-image and post-deploy canaries; this contract makes
 * it impossible for disabled, test, parity, placeholder, or wrong-target
 * configuration to report normal Physio production readiness.
 */
export function resolvePhysioProductionPosture(environment = process.env) {
  const r1Comparison = environment.ASSESSSUITE_DEPLOYMENT_VARIANT
    === PHYSIO_R1_COMPARISON_VARIANT;
  const publicUrl = r1Comparison ? PHYSIO_R1_COMPARISON_PUBLIC_URL : PUBLIC_URL;
  const physioTargetClaimed = environment.PROFESSION === 'physio'
    || environment.DEFAULT_APP_ID === 'local-assesssuite-physio'
    || environment.EXPECTED_APP_URL === PUBLIC_URL
    || environment.APP_URL === PUBLIC_URL
    || environment.EXPECTED_APP_URL === PHYSIO_R1_COMPARISON_PUBLIC_URL
    || environment.APP_URL === PHYSIO_R1_COMPARISON_PUBLIC_URL
    || r1Comparison
    || environment[PHYSIO_EXACT_IMAGE_CANARY_MODE] === '1';
  const applicable = environment.NODE_ENV === 'production'
    && physioTargetClaimed;
  if (!applicable) {
    return Object.freeze({
      applicable: false,
      ready: true,
      mode: 'not-applicable',
      failures: Object.freeze([]),
      contract_version: PHYSIO_PRODUCTION_POSTURE_CONTRACT_VERSION,
      posture_sha256: stablePostureHash({ applicable: false }),
    });
  }

  const canary = environment[PHYSIO_EXACT_IMAGE_CANARY_MODE] === '1';
  const mode = canary
    ? 'exact-image-canary'
    : r1Comparison ? 'r1-comparison' : 'normal-production';
  const failures = [];
  addExactFailures(failures, environment, {
    NODE_ENV: 'production',
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    EXPECTED_APP_URL: publicUrl,
    APP_URL: publicUrl,
    SELFTEST: '0',
    PARITY_ASSURANCE_MODE: '0',
    ALLOW_OPEN_REGISTRATION: r1Comparison ? '0' : '1',
    OUTBOUND_SMS_ENABLED: '0',
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '1',
    TRANSCRIPTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_UNDER_13_ENABLED: '0',
    OPENAI_HEALTH_DATA_TERMS_CONFIRMED: '1',
    OPENAI_MODEL_FAST: PHYSIO_MODEL_FAST,
    OPENAI_MODEL_QUALITY: PHYSIO_MODEL_QUALITY,
    OPENAI_TRANSCRIBE_MODEL: 'whisper-1',
    UPLOADS_DIR: PHYSIO_PRODUCTION_UPLOADS_DIR,
  });
  if (r1Comparison) {
    addExactFailures(failures, environment, {
      ASSESSSUITE_DEPLOYMENT_VARIANT: PHYSIO_R1_COMPARISON_VARIANT,
    });
    addAbsentFailures(failures, environment, [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_ID_MONTHLY',
      'STRIPE_PRICE_ID_ANNUAL',
    ]);
  }
  addAbsentFailures(failures, environment, [
    'ASSESSSUITE_DB_PATH',
    'ASSESSSUITE_DB_PATH_ACK',
    'OPENAI_CHAT_TEST_BASE_URL',
    'OPENAI_CHAT_TEST_TIMEOUT_MS',
    'DOCUMENT_EXTRACTION_TEST_BASE_URL',
    'OPENAI_DOCUMENT_EXTRACTION_MODEL',
    'DOCUMENT_EXTRACTION_PROVIDER_PROBE_ACK',
    'RUN_DOCUMENT_EXTRACTION_PROVIDER_PROBE',
    'ASSESSSUITE_TEST_PROVIDER_SERVICES',
  ]);
  if (!realSecret(environment, 'OPENAI_API_KEY')) failures.push('OPENAI_API_KEY_must_be_real');
  if (!RELEASE_SHA.test(environment.RELEASE_SHA || '')) failures.push('RELEASE_SHA_must_be_exact');
  if (!Number.isFinite(Date.parse(environment.BUILD_TIMESTAMP || ''))) {
    failures.push('BUILD_TIMESTAMP_must_be_exact');
  }
  if (environment.DOCUMENT_EXTRACTION_PROVIDER_PROBE !== undefined
      && !['', '0'].includes(environment.DOCUMENT_EXTRACTION_PROVIDER_PROBE)) {
    failures.push('DOCUMENT_EXTRACTION_PROVIDER_PROBE_must_be_off');
  }

  if (canary) {
    addExactFailures(failures, environment, {
      OUTBOUND_EMAIL_ENABLED: '0',
      PAYMENTS_ENABLED: '0',
      ALLOW_PAID_PROVIDER_PROBE: '1',
      RUN_PHYSIO_EXACT_IMAGE_CANARY: PHYSIO_EXACT_IMAGE_CANARY_ACK,
    });
    if (!CANARY_BOOTSTRAP_RECEIPT.test(
      environment.PHYSIO_EXACT_IMAGE_CANARY_BOOTSTRAP_RECEIPT || '',
    )) failures.push('PHYSIO_EXACT_IMAGE_CANARY_BOOTSTRAP_RECEIPT_must_be_isolated');
  } else {
    if (environment[PHYSIO_EXACT_IMAGE_CANARY_MODE] !== undefined
        && !['', '0'].includes(environment[PHYSIO_EXACT_IMAGE_CANARY_MODE])) {
      failures.push('PHYSIO_EXACT_IMAGE_CANARY_MODE_must_be_off');
    }
    addExactFailures(failures, environment, {
      OUTBOUND_EMAIL_ENABLED: '1',
      PAYMENTS_ENABLED: r1Comparison ? '0' : '1',
      ALLOW_PAID_PROVIDER_PROBE: '0',
      EMAIL_FROM: 'AssessSuite Physiotherapy <verification@assesssuite.com>',
      EMAIL_REPLY_TO: 'admin@assesssuite.com',
      EMAIL_DOMAIN: 'assesssuite.com',
      STRIPE_TRIAL_PERIOD_DAYS: '30',
      SENTRY_ENVIRONMENT: 'physio-production',
    });
    addAbsentFailures(failures, environment, [
      'RUN_PHYSIO_EXACT_IMAGE_CANARY',
      'PHYSIO_EXACT_IMAGE_CANARY_BOOTSTRAP_RECEIPT',
    ]);
    for (const name of ['ADMIN_PASSWORD', 'RESEND_API_KEY']) {
      if (!realSecret(environment, name)) failures.push(`${name}_must_be_real`);
    }
    if (!r1Comparison) {
      for (const name of [
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'STRIPE_PRICE_ID_MONTHLY',
        'STRIPE_PRICE_ID_ANNUAL',
      ]) if (!realSecret(environment, name)) failures.push(`${name}_must_be_real`);
      if (!/^(?:rk_live_|sk_live_)/.test(String(environment.STRIPE_SECRET_KEY || ''))) {
        failures.push('STRIPE_SECRET_KEY_must_be_live_restricted_or_secret');
      }
    }
    if (!validSentryDsn(environment.SENTRY_DSN)) failures.push('SENTRY_DSN_must_be_approved');
    if (environment.SENTRY_RELEASE !== sentryReleaseForProfession('physio', environment.RELEASE_SHA)) {
      failures.push('SENTRY_RELEASE_must_match_physio_production_RELEASE_SHA');
    }
  }

  const posture = {
    applicable: true,
    ready: failures.length === 0,
    mode,
    failures: Object.freeze([...failures]),
    contract_version: PHYSIO_PRODUCTION_POSTURE_CONTRACT_VERSION,
  };
  return Object.freeze({
    ...posture,
    posture_sha256: stablePostureHash({
      contract_version: posture.contract_version,
      mode,
      failures: [...failures].sort(),
      release_sha: environment.RELEASE_SHA || '',
      provider_flags: {
        llm: capabilityEnabled('LLM_REQUIRED', environment),
        transcription: capabilityEnabled('TRANSCRIPTION_ENABLED', environment),
        extraction: capabilityEnabled('DOCUMENT_EXTRACTION_ENABLED', environment),
        email: capabilityEnabled('OUTBOUND_EMAIL_ENABLED', environment),
        payments: capabilityEnabled('PAYMENTS_ENABLED', environment),
      },
    }),
  });
}

export function assertPhysioProductionPosture(environment = process.env) {
  const posture = resolvePhysioProductionPosture(environment);
  if (posture.applicable) assertTestProviderInjectionAbsent(environment);
  if (!posture.ready) {
    throw new Error(`Physio production posture failed: ${posture.failures.join(', ')}`);
  }
  return posture;
}
