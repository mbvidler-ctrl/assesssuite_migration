import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PHYSIO_EXACT_IMAGE_CANARY_ACK,
  PHYSIO_PRODUCTION_POSTURE_CONTRACT_VERSION,
  assertPhysioProductionPosture,
  resolvePhysioProductionPosture,
} from '../productionPosture.mjs';
import {
  PHYSIO_CANARY_BOOTSTRAP_RECEIPT_CONTRACT_VERSION,
  runProductionBootstrap,
} from '../productionBootstrap.mjs';

const releaseSha = '0123456789abcdef0123456789abcdef01234567';

function normalEnvironment(overrides = {}) {
  return {
    NODE_ENV: 'production',
    PROFESSION: 'physio',
    DEFAULT_APP_ID: 'local-assesssuite-physio',
    EXPECTED_APP_URL: 'https://physio.app.assesssuite.com',
    APP_URL: 'https://physio.app.assesssuite.com',
    SELFTEST: '0',
    PARITY_ASSURANCE_MODE: '0',
    ALLOW_OPEN_REGISTRATION: '1',
    OUTBOUND_EMAIL_ENABLED: '1',
    OUTBOUND_SMS_ENABLED: '0',
    PAYMENTS_ENABLED: '1',
    GENERAL_CLINICAL_LLM_ENABLED: '1',
    LLM_REQUIRED: '1',
    TRANSCRIPTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_UNDER_13_ENABLED: '0',
    OPENAI_HEALTH_DATA_TERMS_CONFIRMED: '1',
    OPENAI_MODEL_FAST: 'gpt-4.1-mini-2025-04-14',
    OPENAI_MODEL_QUALITY: 'gpt-4.1-2025-04-14',
    OPENAI_TRANSCRIBE_MODEL: 'whisper-1',
    OPENAI_API_KEY: 'contract-fixture-openai-provider-key',
    UPLOADS_DIR: '/app/server/data/physio-uploads',
    RELEASE_SHA: releaseSha,
    BUILD_TIMESTAMP: '2026-08-22T00:00:00.000Z',
    ALLOW_PAID_PROVIDER_PROBE: '0',
    EMAIL_FROM: 'AssessSuite Physiotherapy <verification@assesssuite.com>',
    EMAIL_REPLY_TO: 'admin@assesssuite.com',
    EMAIL_DOMAIN: 'assesssuite.com',
    ADMIN_PASSWORD: 'contract-fixture-admin-password',
    RESEND_API_KEY: 'contract-fixture-resend-key',
    STRIPE_SECRET_KEY: 'rk_live_contract_fixture_stripe_key',
    STRIPE_WEBHOOK_SECRET: 'contract-fixture-webhook-secret',
    STRIPE_PRICE_ID_MONTHLY: 'price_contract_monthly',
    STRIPE_PRICE_ID_ANNUAL: 'price_contract_annual',
    STRIPE_TRIAL_PERIOD_DAYS: '30',
    SENTRY_DSN: 'https://contractPublicKey@o4511822688813056.ingest.us.sentry.io/4511827129663488',
    SENTRY_ENVIRONMENT: 'physio-production',
    SENTRY_RELEASE: `physio-production@${releaseSha}`,
    ...overrides,
  };
}

function canaryEnvironment(phase = 'success', overrides = {}) {
  const environment = normalEnvironment({
    PHYSIO_EXACT_IMAGE_CANARY_MODE: '1',
    OUTBOUND_EMAIL_ENABLED: '0',
    PAYMENTS_ENABLED: '0',
    ALLOW_PAID_PROVIDER_PROBE: '1',
    RUN_PHYSIO_EXACT_IMAGE_CANARY: PHYSIO_EXACT_IMAGE_CANARY_ACK,
    PHYSIO_EXACT_IMAGE_CANARY_BOOTSTRAP_RECEIPT:
      `/tmp/physio-exact-image-canary-bootstrap-${phase}.json`,
    ...overrides,
  });
  for (const name of [
    'ADMIN_PASSWORD',
    'RESEND_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_ID_MONTHLY',
    'STRIPE_PRICE_ID_ANNUAL',
    'STRIPE_TRIAL_PERIOD_DAYS',
    'EMAIL_FROM',
    'EMAIL_REPLY_TO',
    'EMAIL_DOMAIN',
    'SENTRY_DSN',
    'SENTRY_ENVIRONMENT',
    'SENTRY_RELEASE',
  ]) delete environment[name];
  return environment;
}

function r1ComparisonEnvironment(overrides = {}) {
  const environment = normalEnvironment({
    ASSESSSUITE_DEPLOYMENT_VARIANT: 'physio-r1-comparison',
    EXPECTED_APP_URL: 'https://assesssuite-physio-r1.fly.dev',
    APP_URL: 'https://assesssuite-physio-r1.fly.dev',
    ALLOW_OPEN_REGISTRATION: '0',
    PAYMENTS_ENABLED: '0',
  });
  for (const name of [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRICE_ID_MONTHLY',
    'STRIPE_PRICE_ID_ANNUAL',
  ]) delete environment[name];
  return { ...environment, ...overrides };
}

test('normal Physio production posture is exact, provider-real, and content-free', () => {
  const posture = assertPhysioProductionPosture(normalEnvironment());
  assert.equal(posture.applicable, true);
  assert.equal(posture.ready, true);
  assert.equal(posture.mode, 'normal-production');
  assert.equal(posture.contract_version, PHYSIO_PRODUCTION_POSTURE_CONTRACT_VERSION);
  assert.match(posture.posture_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(posture), /sk_live_|OPENAI_API_KEY|RESEND_API_KEY/);

  assert.deepEqual(resolvePhysioProductionPosture({
    NODE_ENV: 'production',
    PROFESSION: 'exercise-physiology',
  }).failures, []);
});

test('R1 comparison posture preserves clinical providers while blocking registration and billing effects', () => {
  const posture = assertPhysioProductionPosture(r1ComparisonEnvironment());
  assert.equal(posture.applicable, true);
  assert.equal(posture.ready, true);
  assert.equal(posture.mode, 'r1-comparison');

  for (const [name, value] of [
    ['ALLOW_OPEN_REGISTRATION', '1'],
    ['PAYMENTS_ENABLED', '1'],
    ['APP_URL', 'https://physio.app.assesssuite.com'],
    ['STRIPE_SECRET_KEY', 'rk_live_must_not_be_staged'],
  ]) {
    const denied = resolvePhysioProductionPosture(r1ComparisonEnvironment({ [name]: value }));
    assert.equal(denied.ready, false, name);
    assert.ok(denied.failures.some((failure) => failure.startsWith(name)), name);
  }
});

test('normal Physio production posture fails closed for every required provider and isolation switch', () => {
  const mutations = {
    PROFESSION: 'physiotherapy',
    SELFTEST: '1',
    PARITY_ASSURANCE_MODE: '1',
    ALLOW_OPEN_REGISTRATION: '0',
    OUTBOUND_EMAIL_ENABLED: '0',
    OUTBOUND_SMS_ENABLED: '1',
    PAYMENTS_ENABLED: '0',
    GENERAL_CLINICAL_LLM_ENABLED: '0',
    LLM_REQUIRED: '0',
    TRANSCRIPTION_ENABLED: '0',
    DOCUMENT_EXTRACTION_ENABLED: '0',
    DOCUMENT_EXTRACTION_UNDER_13_ENABLED: '1',
    OPENAI_HEALTH_DATA_TERMS_CONFIRMED: '0',
    OPENAI_MODEL_FAST: 'gpt-4.1-mini',
    OPENAI_MODEL_QUALITY: 'gpt-4.1',
    OPENAI_TRANSCRIBE_MODEL: 'mutable-model',
    OPENAI_API_KEY: 'placeholder-key',
    UPLOADS_DIR: '/tmp/uploads',
    RELEASE_SHA: 'main',
    BUILD_TIMESTAMP: 'not-a-date',
    ALLOW_PAID_PROVIDER_PROBE: '1',
    RESEND_API_KEY: 'mock-fixture-resend',
    STRIPE_SECRET_KEY: 'sk_test_contract-key',
    STRIPE_TRIAL_PERIOD_DAYS: '0',
    SENTRY_ENVIRONMENT: 'production',
    SENTRY_RELEASE: '89abcdef0123456789abcdef0123456789abcdef',
  };
  for (const [name, value] of Object.entries(mutations)) {
    const posture = resolvePhysioProductionPosture(normalEnvironment({ [name]: value }));
    assert.equal(posture.ready, false, name);
    assert.ok(posture.failures.some((failure) => failure.startsWith(name)), name);
  }

  const missingProfession = normalEnvironment();
  delete missingProfession.PROFESSION;
  const missingProfessionPosture = resolvePhysioProductionPosture(missingProfession);
  assert.equal(missingProfessionPosture.ready, false);
  assert.ok(missingProfessionPosture.failures.includes('PROFESSION_must_equal_physio'));

  for (const [name, value] of [
    ['ASSESSSUITE_DB_PATH', '/app/server/data/physio.db'],
    ['ASSESSSUITE_DB_PATH_ACK', 'ack'],
    ['OPENAI_CHAT_TEST_BASE_URL', 'https://example.invalid'],
    ['OPENAI_CHAT_TEST_TIMEOUT_MS', '1'],
    ['DOCUMENT_EXTRACTION_TEST_BASE_URL', 'https://example.invalid'],
    ['OPENAI_DOCUMENT_EXTRACTION_MODEL', 'mutable-model'],
    ['RUN_DOCUMENT_EXTRACTION_PROVIDER_PROBE', '1'],
  ]) {
    const posture = resolvePhysioProductionPosture(normalEnvironment({ [name]: value }));
    assert.equal(posture.ready, false, name);
    assert.ok(posture.failures.includes(`${name}_must_be_absent`), name);
  }
});

test('exact-image canary is a separately labelled production-bootstrap exception', () => {
  const events = [];
  let write;
  const receipt = runProductionBootstrap({
    environment: canaryEnvironment('success'),
    openDatabaseFn: () => ({
      db: { close: () => events.push('close') },
      entityNames: new Set(['Assessment']),
    }),
    catalogueSeedFn: () => events.push('catalogue'),
    writeFileFn: (file, body, options) => {
      events.push('receipt');
      write = { file, body, options };
    },
  });

  assert.deepEqual(events, ['catalogue', 'close', 'receipt']);
  assert.equal(write.file, '/tmp/physio-exact-image-canary-bootstrap-success.json');
  assert.deepEqual(write.options, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  assert.deepEqual(JSON.parse(write.body), receipt);
  assert.equal(receipt.contract_version, PHYSIO_CANARY_BOOTSTRAP_RECEIPT_CONTRACT_VERSION);
  assert.equal(receipt.result, 'PASS');
  assert.equal(receipt.mode, 'exact-image-canary');
  assert.equal(receipt.node_env, 'production');
  assert.equal(receipt.application_sha, releaseSha);
  assert.equal(receipt.catalogue_bootstrap_completed, true);
  assert.match(receipt.database_path_sha256, /^[0-9a-f]{64}$/);
  assert.match(receipt.uploads_path_sha256, /^[0-9a-f]{64}$/);
  assert.match(receipt.production_posture_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.doesNotMatch(write.body, /OPENAI_API_KEY|contract-fixture-openai-provider-key/);
});

test('canary bootstrap refuses wrong mode/path and never touches the database', () => {
  for (const environment of [
    canaryEnvironment('success', { NODE_ENV: 'test' }),
    canaryEnvironment('success', { PAYMENTS_ENABLED: '1' }),
    canaryEnvironment('success', { OUTBOUND_EMAIL_ENABLED: '1' }),
    canaryEnvironment('success', { RUN_PHYSIO_EXACT_IMAGE_CANARY: 'wrong' }),
    canaryEnvironment('success', {
      PHYSIO_EXACT_IMAGE_CANARY_BOOTSTRAP_RECEIPT: '/tmp/arbitrary.json',
    }),
  ]) {
    let opened = false;
    assert.throws(() => runProductionBootstrap({
      environment,
      openDatabaseFn: () => {
        opened = true;
        throw new Error('database was touched');
      },
      writeFileFn: () => { throw new Error('receipt was written'); },
    }));
    assert.equal(opened, false);
  }
});
