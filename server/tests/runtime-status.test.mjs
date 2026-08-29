import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { openDatabase } from '../db.mjs';
import {
  assembleRuntimeSnapshot,
  catalogueChecksum,
  createRuntimeStatus,
  inspectRuntimeDatabase,
  resolveDependencyReadiness,
  resolveReleaseMetadata,
} from '../runtimeStatus.mjs';
import {
  buildAssessmentCatalogueForProfession,
  runCatalogueSeed,
} from '../seed.mjs';
import {
  createTestStore,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';
import { startFakeOpenAIChat } from './support/fake-openai-chat.mjs';
import { PHYSIO_RELEASE_TARGET } from '../../scripts/physio-release-contract.mjs';

const RELEASE_SHA = 'a'.repeat(40);
const BUILD_TIMESTAMP = '2026-08-22T01:02:03.000Z';
const DB_OVERRIDE_ACK = 'I_ACKNOWLEDGE_THIS_IS_AN_ISOLATED_NON_PRODUCTION_GATE_DATABASE';

const REAL_PROVIDER_CONFIGURATION = Object.freeze({
  GENERAL_CLINICAL_LLM_ENABLED: '1',
  LLM_REQUIRED: '1',
  TRANSCRIPTION_ENABLED: '1',
  DOCUMENT_EXTRACTION_ENABLED: '1',
  OPENAI_HEALTH_DATA_TERMS_CONFIRMED: '1',
  OPENAI_API_KEY: 'provider-key-for-runtime-contract-test',
  OUTBOUND_EMAIL_ENABLED: '1',
  RESEND_API_KEY: 'resend-key-for-runtime-contract-test',
  PAYMENTS_ENABLED: '1',
  STRIPE_SECRET_KEY: 'stripe-key-for-runtime-contract-test',
  STRIPE_WEBHOOK_SECRET: 'stripe-webhook-for-runtime-contract-test',
  STRIPE_PRICE_ID_MONTHLY: 'price_runtime_monthly',
  STRIPE_PRICE_ID_ANNUAL: 'price_runtime_annual',
  STRIPE_TRIAL_PERIOD_DAYS: '14',
});

const REAL_PHYSIO_PROVIDER_CONFIGURATION = Object.freeze({
  ...REAL_PROVIDER_CONFIGURATION,
  PROFESSION: 'physio',
  DEFAULT_APP_ID: 'local-assesssuite-physio',
  GENERAL_CLINICAL_LLM_ENABLED: '1',
});

const PHYSIO_PRODUCTION_CONFIGURATION = Object.freeze({
  ...REAL_PHYSIO_PROVIDER_CONFIGURATION,
  NODE_ENV: 'production',
  EXPECTED_APP_URL: 'https://physio.app.assesssuite.com',
  APP_URL: 'https://physio.app.assesssuite.com',
  SELFTEST: '0',
  PARITY_ASSURANCE_MODE: '0',
  ALLOW_OPEN_REGISTRATION: '0',
  OUTBOUND_SMS_ENABLED: '0',
  DOCUMENT_EXTRACTION_UNDER_13_ENABLED: '1',
  OPENAI_MODEL_FAST: 'gpt-4.1-mini-2025-04-14',
  OPENAI_MODEL_QUALITY: 'gpt-4.1-2025-04-14',
  OPENAI_TRANSCRIBE_MODEL: 'whisper-1',
  UPLOADS_DIR: '/app/server/data/physio-uploads',
  ALLOW_PAID_PROVIDER_PROBE: '0',
  EMAIL_FROM: 'AssessSuite Physiotherapy <verification@assesssuite.com>',
  EMAIL_REPLY_TO: 'admin@assesssuite.com',
  EMAIL_DOMAIN: 'assesssuite.com',
  ADMIN_PASSWORD: 'runtime-contract-fixture-admin-password',
  STRIPE_SECRET_KEY: 'rk_live_runtime_contract_fixture_key',
  STRIPE_TRIAL_PERIOD_DAYS: '30',
  SENTRY_DSN: 'https://runtimePublicKey@o4511822688813056.ingest.us.sentry.io/4511827129663488',
  SENTRY_ENVIRONMENT: 'physio-production',
  SENTRY_RELEASE: `physio-production@${RELEASE_SHA}`,
});

function withProcessEnvironment(overrides, callback) {
  const prior = new Map();
  for (const [name, value] of Object.entries(overrides)) {
    prior.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = String(value);
  }
  try {
    return callback();
  } finally {
    for (const [name, value] of prior.entries()) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function prepareSeededStore(profession) {
  const store = createTestStore(`assesssuite-runtime-status-${profession}-`);
  const professionEnvironment = profession === 'physio'
    ? { PROFESSION: 'physio', DEFAULT_APP_ID: 'local-assesssuite-physio' }
    : { PROFESSION: undefined, DEFAULT_APP_ID: undefined };
  try {
    withProcessEnvironment({
      NODE_ENV: 'test',
      SELFTEST: '0',
      PARITY_ASSURANCE_MODE: '0',
      ASSESSSUITE_DB_PATH: store.dbPath,
      ASSESSSUITE_DB_PATH_ACK: DB_OVERRIDE_ACK,
      ...professionEnvironment,
    }, () => {
      const opened = openDatabase();
      try {
        runCatalogueSeed(opened);
      } finally {
        opened.db.close();
      }
    });
    return store;
  } catch (error) {
    store.cleanup();
    throw error;
  }
}

function passingDatabaseFixture(environment = {}) {
  const catalogue = buildAssessmentCatalogueForProfession(environment);
  return {
    ready: true,
    integrity: 'ok',
    schema: {
      ready: true,
      version: 'test-schema',
      migration_version: 'sha256:test',
      sqlite_user_version: 0,
      expected_entity_count: 1,
      missing_object_count: 0,
      missing_column_count: 0,
    },
    catalogue: {
      ready: true,
      count: catalogue.runtimeCount,
      checksum: catalogueChecksum(catalogue.assessments),
      checksum_algorithm: 'sha256-canonical-json-v1',
      expected_count: catalogue.runtimeCount,
      expected_checksum: catalogueChecksum(catalogue.assessments),
    },
  };
}

test('catalogue fingerprints are exact, stable, and profession-specific', () => {
  const ep = buildAssessmentCatalogueForProfession({});
  const physio = buildAssessmentCatalogueForProfession({ PROFESSION: 'physio' });

  assert.equal(ep.runtimeCount, 232);
  assert.equal(physio.runtimeCount, PHYSIO_RELEASE_TARGET.catalogueCount);
  assert.equal(
    catalogueChecksum(ep.assessments),
    'b8e47c5483b255a1aea794285879b4686b770ccd406d43f29952043c28f305d0',
  );
  assert.equal(
    catalogueChecksum(physio.assessments),
    PHYSIO_RELEASE_TARGET.catalogueChecksum,
  );
  assert.equal(
    catalogueChecksum([...physio.assessments].reverse()),
    catalogueChecksum(physio.assessments),
    'database row ordering must not change the catalogue identity',
  );

  const changed = structuredClone(physio.assessments);
  changed[0].name = `${changed[0].name} changed`;
  assert.notEqual(catalogueChecksum(changed), catalogueChecksum(physio.assessments));
});

test('enabled dependencies require real fail-loud provider configuration and mocks never count ready', () => {
  assert.equal(resolveDependencyReadiness({}).ready, true, 'deliberately disabled features do not block');

  const configured = resolveDependencyReadiness({
    SELFTEST: '0',
    PARITY_ASSURANCE_MODE: '0',
    ...REAL_PROVIDER_CONFIGURATION,
  });
  assert.equal(configured.ready, true);
  assert.deepEqual(
    Object.values(configured.dependencies).map(({ status }) => status),
    ['ready', 'ready', 'ready', 'ready', 'ready'],
  );

  const configuredPhysio = resolveDependencyReadiness({
    SELFTEST: '0',
    PARITY_ASSURANCE_MODE: '0',
    ...REAL_PHYSIO_PROVIDER_CONFIGURATION,
  });
  assert.equal(configuredPhysio.ready, true);
  assert.deepEqual(configuredPhysio.dependencies.general_clinical_llm, {
    enabled: true, required: true, ready: true, status: 'ready',
  });
  assert.deepEqual(configuredPhysio.dependencies.physio_ai_tasks, {
    enabled: true, required: true, ready: true, status: 'ready',
  });

  const physioWithoutProvider = resolveDependencyReadiness({
    ...REAL_PHYSIO_PROVIDER_CONFIGURATION,
    OPENAI_API_KEY: undefined,
  });
  assert.equal(physioWithoutProvider.ready, false);
  assert.equal(physioWithoutProvider.dependencies.general_clinical_llm.status, 'unavailable');
  assert.equal(physioWithoutProvider.dependencies.physio_ai_tasks.status, 'unavailable');

  const physioWithoutFailLoud = resolveDependencyReadiness({
    ...REAL_PHYSIO_PROVIDER_CONFIGURATION,
    LLM_REQUIRED: '0',
  });
  assert.equal(physioWithoutFailLoud.ready, false);
  assert.equal(physioWithoutFailLoud.dependencies.general_clinical_llm.status, 'unavailable');
  assert.equal(physioWithoutFailLoud.dependencies.physio_ai_tasks.status, 'unavailable');

  const noFailLoud = resolveDependencyReadiness({
    SELFTEST: '0',
    ...REAL_PROVIDER_CONFIGURATION,
    LLM_REQUIRED: '0',
  });
  assert.equal(noFailLoud.ready, false);
  assert.equal(noFailLoud.dependencies.general_clinical_llm.status, 'unavailable');
  assert.equal(noFailLoud.dependencies.transcription.status, 'unavailable');

  for (const environment of [
    { ...REAL_PROVIDER_CONFIGURATION, OPENAI_API_KEY: undefined },
    { ...REAL_PROVIDER_CONFIGURATION, RESEND_API_KEY: undefined },
    { ...REAL_PROVIDER_CONFIGURATION, STRIPE_WEBHOOK_SECRET: undefined },
    { ...REAL_PROVIDER_CONFIGURATION, OPENAI_HEALTH_DATA_TERMS_CONFIRMED: '0' },
    { ...REAL_PROVIDER_CONFIGURATION, SELFTEST: '1' },
    { ...REAL_PROVIDER_CONFIGURATION, PARITY_ASSURANCE_MODE: '1' },
    { ...REAL_PROVIDER_CONFIGURATION, OPENAI_API_KEY: 'synthetic-provider' },
    { ...REAL_PROVIDER_CONFIGURATION, OPENAI_API_KEY: 'dummy-fixture-provider' },
    {
      ...REAL_PROVIDER_CONFIGURATION,
      OPENAI_CHAT_TEST_BASE_URL: 'http://127.0.0.1:45678/v1/chat/completions',
    },
    {
      ...REAL_PROVIDER_CONFIGURATION,
      NODE_ENV: 'production',
      STRIPE_SECRET_KEY: 'sk_test_not-a-live-provider-key',
    },
  ]) {
    assert.equal(resolveDependencyReadiness(environment).ready, false);
  }

  const productionTestStripe = resolveDependencyReadiness({
    ...REAL_PROVIDER_CONFIGURATION,
    NODE_ENV: 'production',
    STRIPE_SECRET_KEY: 'sk_test_not-a-live-provider-key',
  });
  assert.equal(productionTestStripe.dependencies.payments.ready, false);
  const nonProductionTestStripe = resolveDependencyReadiness({
    ...REAL_PROVIDER_CONFIGURATION,
    NODE_ENV: 'test',
    STRIPE_SECRET_KEY: 'sk_test_real-provider-test-mode-key',
  });
  assert.equal(nonProductionTestStripe.dependencies.payments.ready, true);

  const physioPayments = {
    ...REAL_PROVIDER_CONFIGURATION,
    PROFESSION: 'physio',
    NODE_ENV: 'production',
    STRIPE_SECRET_KEY: 'rk_live_runtime_contract_fixture_key',
  };
  assert.equal(resolveDependencyReadiness(physioPayments).dependencies.payments.ready, true);
  for (const trialDays of [undefined, '', '0', '-1', '14.5', 'fourteen']) {
    assert.equal(
      resolveDependencyReadiness({
        ...physioPayments,
        STRIPE_TRIAL_PERIOD_DAYS: trialDays,
      }).dependencies.payments.ready,
      false,
      `Physio trial days ${String(trialDays)} must fail readiness`,
    );
  }
  const legacyEpPayments = { ...physioPayments, PROFESSION: undefined, STRIPE_TRIAL_PERIOD_DAYS: undefined };
  assert.equal(
    resolveDependencyReadiness(legacyEpPayments).dependencies.payments.ready,
    true,
    'EP retains its existing payments-readiness contract',
  );
});

test('database inspection reports integrity and schema failures without throwing', () => {
  const expectedCatalogue = buildAssessmentCatalogueForProfession({});
  const fakeDatabase = {
    prepare(sql) {
      if (sql === 'PRAGMA quick_check') {
        return { all: () => [{ quick_check: 'database disk image is malformed' }] };
      }
      if (sql.includes('FROM sqlite_master')) return { all: () => [] };
      if (sql === 'PRAGMA user_version') return { get: () => ({ user_version: 0 }) };
      throw new Error(`unexpected SQL in integrity fixture: ${sql}`);
    },
  };

  const inspected = inspectRuntimeDatabase({
    db: fakeDatabase,
    entityNames: new Set(['Assessment']),
    expectedCatalogue,
  });
  assert.equal(inspected.ready, false);
  assert.equal(inspected.integrity, 'failed');
  assert.equal(inspected.schema.ready, false);
  assert.ok(inspected.schema.missing_object_count > 0);
  assert.ok(inspected.schema.missing_column_count > 0);
  assert.equal(inspected.catalogue.ready, false);
});

test('expensive SQLite inspection is cached across routine production polls', () => {
  const store = prepareSeededStore('physio');
  let opened;
  try {
    opened = withProcessEnvironment({
      NODE_ENV: 'test',
      SELFTEST: '0',
      ASSESSSUITE_DB_PATH: store.dbPath,
      ASSESSSUITE_DB_PATH_ACK: DB_OVERRIDE_ACK,
      PROFESSION: 'physio',
      DEFAULT_APP_ID: 'local-assesssuite-physio',
    }, () => openDatabase());

    let quickChecks = 0;
    const instrumentedDatabase = {
      prepare(sql) {
        if (sql === 'PRAGMA quick_check') quickChecks += 1;
        return opened.db.prepare(sql);
      },
    };
    let now = 1_000;
    const environment = {
      NODE_ENV: 'test',
      SELFTEST: '0',
      PROFESSION: 'physio',
      DEFAULT_APP_ID: 'local-assesssuite-physio',
    };
    const runtime = createRuntimeStatus({
      environment,
      db: instrumentedDatabase,
      entityNames: opened.entityNames,
      activeContract: {
        professionId: 'physio',
        appId: 'local-assesssuite-physio',
      },
      cacheTtlMs: 30_000,
      clock: () => now,
    });

    assert.equal(quickChecks, 1, 'one integrity pass runs before traffic is accepted');
    runtime.readiness();
    runtime.version();
    runtime.capabilities();
    assert.equal(quickChecks, 1, 'routine endpoint polling reuses the bounded snapshot');

    now += 30_001;
    runtime.readiness();
    assert.equal(quickChecks, 2, 'the database is re-inspected after the TTL expires');
  } finally {
    opened?.db.close();
    store.cleanup();
  }
});

test('production release and identity failures independently fail readiness', () => {
  const baseEnvironment = {
    ...PHYSIO_PRODUCTION_CONFIGURATION,
    RELEASE_SHA,
    BUILD_TIMESTAMP,
    SENTRY_RELEASE: `physio-production@${RELEASE_SHA}`,
  };
  assert.equal(resolveReleaseMetadata(baseEnvironment).ready, true);
  assert.equal(resolveReleaseMetadata({ ...baseEnvironment, RELEASE_SHA: '' }).ready, false);
  assert.equal(resolveReleaseMetadata({ ...baseEnvironment, BUILD_TIMESTAMP: 'not-a-date' }).ready, false);

  const dependencies = resolveDependencyReadiness(baseEnvironment);
  const database = passingDatabaseFixture({ PROFESSION: 'physio' });
  const valid = assembleRuntimeSnapshot({
    environment: baseEnvironment,
    activeContract: {
      professionId: 'physio',
      appId: 'local-assesssuite-physio',
    },
    database,
    dependencies,
  });
  assert.equal(valid.ready, true);

  const wrongIdentity = assembleRuntimeSnapshot({
    environment: baseEnvironment,
    activeContract: {
      professionId: 'exercise-physiology',
      appId: 'local-assesssuite',
    },
    database,
    dependencies,
  });
  assert.equal(wrongIdentity.ready, false);
  assert.deepEqual(wrongIdentity.failures, ['runtime_identity_mismatch']);

  const wrongUrl = assembleRuntimeSnapshot({
    environment: { ...baseEnvironment, APP_URL: 'https://app.assesssuite.com' },
    activeContract: {
      professionId: 'physio',
      appId: 'local-assesssuite-physio',
    },
    database,
    dependencies,
  });
  assert.equal(wrongUrl.ready, false);
  assert.deepEqual(wrongUrl.failures, [
    'runtime_identity_mismatch',
    'production_posture_mismatch',
  ]);

  const invalidManifestIdentity = assembleRuntimeSnapshot({
    environment: {
      ...baseEnvironment,
      DEFAULT_APP_ID: 'local-assesssuite',
    },
    activeContract: {
      professionId: 'physio',
      appId: 'local-assesssuite-physio',
    },
    database,
    dependencies,
  });
  assert.equal(invalidManifestIdentity.ready, false);
  assert.deepEqual(invalidManifestIdentity.failures, [
    'runtime_identity_mismatch',
    'production_posture_mismatch',
  ]);

  const disabledPayments = assembleRuntimeSnapshot({
    environment: { ...baseEnvironment, PAYMENTS_ENABLED: '0' },
    activeContract: {
      professionId: 'physio',
      appId: 'local-assesssuite-physio',
    },
    database,
    dependencies: resolveDependencyReadiness({ ...baseEnvironment, PAYMENTS_ENABLED: '0' }),
  });
  assert.equal(disabledPayments.ready, false);
  assert.ok(disabledPayments.failures.includes('production_posture_mismatch'));
  assert.ok(disabledPayments.failures.includes('dependency_unavailable:payments'));
});

test('seeded EP and Physio servers publish complete positive runtime matrices', async () => {
  for (const target of [
    {
      profession: 'exercise-physiology',
      env: {},
      appId: 'local-assesssuite',
      count: 232,
      checksum: 'b8e47c5483b255a1aea794285879b4686b770ccd406d43f29952043c28f305d0',
    },
    {
      profession: 'physio',
      env: {
        PROFESSION: 'physio',
        DEFAULT_APP_ID: 'local-assesssuite-physio',
        GENERAL_CLINICAL_LLM_ENABLED: '1',
      },
      appId: 'local-assesssuite-physio',
      count: PHYSIO_RELEASE_TARGET.catalogueCount,
      checksum: PHYSIO_RELEASE_TARGET.catalogueChecksum,
    },
  ]) {
    const store = prepareSeededStore(target.profession);
    let server;
    try {
      server = await startTestServer({
        ...REAL_PROVIDER_CONFIGURATION,
        ...target.env,
        RELEASE_SHA,
        BUILD_TIMESTAMP,
      }, { store, selftest: false });

      const live = await requestJson(server, '/api/health/live');
      assert.equal(live.status, 200, live.text);
      assert.equal(live.body?.status, 'live');
      assert.equal(live.body?.profession_id, target.profession);
      assert.equal(live.body?.app_id, target.appId);

      const ready = await requestJson(server, '/api/health/ready');
      assert.equal(ready.status, 200, `${target.profession}: ${ready.text}`);
      assert.equal(ready.body?.status, 'ready');
      assert.equal(ready.body?.ready, true);
      assert.ok(Object.values(ready.body?.checks || {}).every(Boolean));
      assert.equal(ready.body?.checks?.production_posture, true);
      assert.deepEqual(ready.body?.failures, []);

      const version = await requestJson(server, '/api/version');
      assert.equal(version.status, 200, version.text);
      assert.equal(version.body?.release_sha, RELEASE_SHA);
      assert.equal(version.body?.build_timestamp, BUILD_TIMESTAMP);
      assert.equal(version.body?.profession_id, target.profession);
      assert.equal(version.body?.app_id, target.appId);
      assert.equal(version.body?.profession_schema_version, '2.0.0');
      assert.equal(version.body?.catalogue?.count, target.count);
      assert.equal(version.body?.catalogue?.expected_count, target.count);
      assert.equal(version.body?.catalogue?.checksum, target.checksum);
      assert.equal(version.body?.catalogue?.expected_checksum, target.checksum);
      assert.equal(version.body?.catalogue?.ready, true);
      assert.equal(version.body?.database?.integrity, 'ok');
      assert.equal(version.body?.database?.schema_ready, true);
      assert.match(version.body?.database?.migration_version || '', /^sha256:[0-9a-f]{64}$/);
      assert.equal(version.body?.production_posture?.ready, true);
      assert.equal(version.body?.production_posture?.deployment_ready, true);
      assert.equal(version.body?.production_posture?.mode, 'not-applicable');
      assert.match(
        version.body?.production_posture?.posture_sha256 || '',
        /^sha256:[0-9a-f]{64}$/,
      );

      const capabilities = await requestJson(server, '/api/capabilities');
      assert.equal(capabilities.status, 200, capabilities.text);
      assert.equal(capabilities.body?.profession_id, target.profession);
      assert.equal(capabilities.body?.app_id, target.appId);
      assert.equal(capabilities.body?.required_dependencies_ready, true);
      assert.equal(capabilities.body?.production_posture_ready, true);
      assert.equal(capabilities.body?.production_deployment_ready, true);
      assert.equal(capabilities.body?.production_posture_mode, 'not-applicable');
      const capabilityRows = capabilities.body?.capabilities || {};
      if (target.profession === 'physio') {
        assert.deepEqual(Object.keys(capabilityRows), [
          'general_clinical_llm',
          'physio_ai_tasks',
          'transcription',
          'document_extraction',
          'transactional_email',
          'payments',
        ]);
        assert.deepEqual(capabilityRows.general_clinical_llm, {
          enabled: true, required: true, ready: true, status: 'ready',
        });
        assert.deepEqual(capabilityRows.physio_ai_tasks, {
          enabled: true, required: true, ready: true, status: 'ready',
        });
        assert.ok(Object.values(capabilityRows).every(({ status }) => status === 'ready'));
      } else {
        assert.deepEqual(
          Object.values(capabilityRows).map(({ status }) => status),
          ['ready', 'ready', 'ready', 'ready', 'ready'],
        );
      }

      const anonymousPayloads = [live.text, ready.text, version.text, capabilities.text].join('\n');
      for (const secret of [
        REAL_PROVIDER_CONFIGURATION.OPENAI_API_KEY,
        REAL_PROVIDER_CONFIGURATION.RESEND_API_KEY,
        REAL_PROVIDER_CONFIGURATION.STRIPE_SECRET_KEY,
        REAL_PROVIDER_CONFIGURATION.STRIPE_WEBHOOK_SECRET,
      ]) {
        assert.doesNotMatch(anonymousPayloads, new RegExp(secret));
      }
    } finally {
      if (server) await server.stop();
      store.cleanup();
    }
  }
});

test('readiness returns 503 for catalogue drift and unavailable enabled providers', async () => {
  const emptyStore = createTestStore('assesssuite-runtime-status-empty-');
  let emptyServer;
  try {
    emptyServer = await startTestServer({ RELEASE_SHA, BUILD_TIMESTAMP }, {
      store: emptyStore,
      selftest: false,
    });
    const notSeeded = await requestJson(emptyServer, '/api/health/ready');
    assert.equal(notSeeded.status, 503, notSeeded.text);
    assert.equal(notSeeded.body?.ready, false);
    assert.ok(notSeeded.body?.failures?.includes('catalogue_mismatch'));
  } finally {
    if (emptyServer) await emptyServer.stop();
    emptyStore.cleanup();
  }

  const seededStore = prepareSeededStore('physio');
  let providerServer;
  try {
    providerServer = await startTestServer({
      PROFESSION: 'physio',
      DEFAULT_APP_ID: 'local-assesssuite-physio',
      RELEASE_SHA,
      BUILD_TIMESTAMP,
      GENERAL_CLINICAL_LLM_ENABLED: '1',
      LLM_REQUIRED: '1',
      TRANSCRIPTION_ENABLED: '1',
      DOCUMENT_EXTRACTION_ENABLED: '1',
      OUTBOUND_EMAIL_ENABLED: '1',
      PAYMENTS_ENABLED: '1',
    }, { store: seededStore, selftest: false });
    const unavailable = await requestJson(providerServer, '/api/health/ready');
    assert.equal(unavailable.status, 503, unavailable.text);
    assert.equal(unavailable.body?.ready, false);
    assert.ok(unavailable.body?.failures?.includes('dependency_unavailable:general_clinical_llm'));
    assert.ok(unavailable.body?.failures?.includes('dependency_unavailable:physio_ai_tasks'));
    assert.ok(unavailable.body?.failures?.includes('dependency_unavailable:transcription'));
    assert.ok(unavailable.body?.failures?.includes('dependency_unavailable:document_extraction'));
    assert.ok(unavailable.body?.failures?.includes('dependency_unavailable:transactional_email'));
    assert.ok(unavailable.body?.failures?.includes('dependency_unavailable:payments'));

    const capabilities = await requestJson(providerServer, '/api/capabilities');
    assert.equal(capabilities.status, 200, capabilities.text);
    assert.equal(capabilities.body?.required_dependencies_ready, false);
    for (const name of [
      'general_clinical_llm',
      'physio_ai_tasks',
      'transcription',
      'document_extraction',
      'transactional_email',
      'payments',
    ]) {
      assert.deepEqual(capabilities.body?.capabilities?.[name], {
        enabled: true, required: true, ready: false, status: 'unavailable',
      });
    }
  } finally {
    if (providerServer) await providerServer.stop();
    seededStore.cleanup();
  }
});

test('liveness remains independent while a real schema mismatch makes readiness 503', async () => {
  const store = prepareSeededStore('physio');
  let server;
  try {
    server = await startTestServer({
      PROFESSION: 'physio',
      DEFAULT_APP_ID: 'local-assesssuite-physio',
      RELEASE_SHA,
      BUILD_TIMESTAMP,
      GENERAL_CLINICAL_LLM_ENABLED: '0',
      TRANSCRIPTION_ENABLED: '0',
      DOCUMENT_EXTRACTION_ENABLED: '0',
      OUTBOUND_EMAIL_ENABLED: '0',
      PAYMENTS_ENABLED: '0',
    }, { store, selftest: false });

    const mutationHandle = new DatabaseSync(store.dbPath);
    try {
      mutationHandle.exec('DROP VIEW sessions');
    } finally {
      mutationHandle.close();
    }

    const live = await requestJson(server, '/api/health/live');
    assert.equal(live.status, 200, live.text);
    assert.equal(live.body?.status, 'live');

    const ready = await requestJson(server, '/api/health/ready');
    assert.equal(ready.status, 503, ready.text);
    assert.equal(ready.body?.checks?.database_schema, false);
    assert.ok(ready.body?.failures?.includes('database_schema_mismatch'));
  } finally {
    if (server) await server.stop();
    store.cleanup();
  }
});

for (const requiredTable of [
  'stripe_checkout_intent',
  'stripe_webhook_event',
  'physio_ai_generation',
]) {
  test(`Physio readiness fails closed when required persistence table ${requiredTable} disappears`, async () => {
    const store = prepareSeededStore('physio');
    let server;
    try {
      server = await startTestServer({
        PROFESSION: 'physio',
        DEFAULT_APP_ID: 'local-assesssuite-physio',
        RELEASE_SHA,
        BUILD_TIMESTAMP,
        GENERAL_CLINICAL_LLM_ENABLED: '0',
        TRANSCRIPTION_ENABLED: '0',
        DOCUMENT_EXTRACTION_ENABLED: '0',
        OUTBOUND_EMAIL_ENABLED: '0',
        PAYMENTS_ENABLED: '0',
      }, { store, selftest: false });

      const mutationHandle = new DatabaseSync(store.dbPath);
      try {
        mutationHandle.exec(`DROP TABLE "${requiredTable}"`);
      } finally {
        mutationHandle.close();
      }

      const ready = await requestJson(server, '/api/health/ready');
      assert.equal(ready.status, 503, ready.text);
      assert.equal(ready.body?.checks?.database_schema, false);
      assert.ok(ready.body?.failures?.includes('database_schema_mismatch'));
    } finally {
      if (server) await server.stop();
      store.cleanup();
    }
  });
}

test('anonymous runtime polls perform zero provider egress even when a loopback mock is configured', async () => {
  const fakeChat = await startFakeOpenAIChat();
  let server;
  try {
    server = await startTestServer({
      GENERAL_CLINICAL_LLM_ENABLED: '1',
      LLM_REQUIRED: '1',
      TRANSCRIPTION_ENABLED: '1',
      OPENAI_API_KEY: 'synthetic-runtime-health-provider',
      OPENAI_CHAT_TEST_BASE_URL: fakeChat.baseUrl,
    });

    for (const route of [
      '/api/health/live',
      '/api/health/ready',
      '/api/version',
      '/api/capabilities',
    ]) {
      const response = await requestJson(server, route);
      assert.ok([200, 503].includes(response.status), `${route}: ${response.text}`);
    }
    assert.equal(fakeChat.calls.length, 0, 'health/version/capability polls must never call a provider');
  } finally {
    if (server) await server.stop();
    await fakeChat.stop();
  }
});
