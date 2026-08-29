import { createHash } from 'node:crypto';

import {
  PROFESSION_SCHEMA_VERSION,
  resolveActiveProfessionContract,
} from '../packages/profession-config/runtime.mjs';
import { generalClinicalLlmSwitchedOn } from './capabilities.mjs';
import { capabilityEnabled } from './capabilityFlags.mjs';
import {
  PHYSIO_R1_COMPARISON_PUBLIC_URL,
  PHYSIO_R1_COMPARISON_VARIANT,
  resolvePhysioProductionPosture,
} from './productionPosture.mjs';
import { buildRuntimeAssessmentCatalogue } from './runtimeCatalogue.mjs';

export const RUNTIME_STATUS_CONTRACT_VERSION = 'assesssuite-runtime-status/1.0.0';
export const CATALOGUE_CHECKSUM_ALGORITHM = 'sha256-canonical-json-v1';
export const SQLITE_SCHEMA_CONTRACT_VERSION = 'assesssuite-sqlite-startup-schema/1.0.0';
export const RUNTIME_INSPECTION_CACHE_TTL_MS = 30_000;

const OPERATIONAL_TABLE_COLUMNS = Object.freeze({
  session_records: ['token', 'user_id', 'created_date', 'expires_date'],
  usage_daily_aggregate: [
    'day',
    'marketing_page_load',
    'successful_sign_in',
    'new_verified_account',
    'app_open',
  ],
  outbox_email: ['id', 'payload', 'created_date'],
  outbox_sms: ['id', 'payload', 'created_date'],
  upload_registry: [
    'id',
    'stored_name',
    'org_id',
    'uploader_user_id',
    'lifecycle_state',
    'subject_age_band',
    'sha256',
  ],
  upload_disposition: ['upload_id', 'org_id', 'status', 'review_due_at'],
  upload_audit: ['id', 'upload_id', 'org_id', 'event_type', 'outcome', 'expires_at'],
  extraction_usage: [
    'id',
    'user_id',
    'org_id',
    'status',
    'estimated_cost_microusd',
    'actual_cost_microusd',
  ],
  referral_commit_receipt: [
    'idempotency_key',
    'request_sha256',
    'actor_user_id',
    'org_id',
    'result_json',
  ],
  api_usage_reservation: [
    'id',
    'user_id',
    'org_id',
    'provider',
    'feature',
    'model',
    'status',
    'estimated_cost_microusd',
    'actual_cost_microusd',
    'input_tokens',
    'cached_input_tokens',
    'output_tokens',
    'audio_seconds',
    'provider_request_id_hash',
  ],
  stripe_checkout_intent: [
    'id',
    'idempotency_key',
    'request_sha256',
    'user_id',
    'user_email',
    'app_id',
    'profession_id',
    'price_id',
    'plan',
    'success_url',
    'cancel_url',
    'state',
    'stripe_session_id',
    'stripe_request_id',
    'created_at',
    'updated_at',
  ],
  stripe_webhook_event: [
    'event_id',
    'app_id',
    'profession_id',
    'event_type',
    'account_scope',
    'payload_sha256',
    'state',
    'attempt_token',
    'lease_expires_at',
    'response_status',
    'response_json',
    'last_error_code',
    'claimed_at',
    'updated_at',
    'completed_at',
  ],
  physio_ai_generation: [
    'id',
    'schema_version',
    'org_id',
    'user_id',
    'client_id',
    'care_episode_id',
    'task_id',
    'idempotency_key',
    'request_fingerprint_sha256',
    'status',
    'output_state',
    'output_json',
    'provenance_json',
    'public_response_json',
    'usage_reservation_id',
    'provider_response_id',
    'provider_http_request_id',
    'provider_request_id_hash',
    'review_status',
    'linked_entity',
    'linked_record_id',
    'created_at',
    'completed_at',
  ],
});

const ENTITY_TABLE_COLUMNS = Object.freeze([
  'id',
  'data',
  'created_date',
  'updated_date',
  'created_by',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Stable, lossless JSON used by both expected and persisted catalogue
 * fingerprints. Object keys are sorted recursively; array order remains part
 * of the content contract because assessment item/option ordering is material.
 */
export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function catalogueChecksum(records) {
  if (!Array.isArray(records)) throw new TypeError('catalogue records must be an array');
  const canonicalRecords = records.map((record) => canonicalJson(record)).sort();
  return sha256(canonicalJson(canonicalRecords));
}

function configuredValue(environment, name) {
  return typeof environment[name] === 'string' && environment[name].trim() !== '';
}

function configuredProviderSecret(environment, name) {
  if (!configuredValue(environment, name)) return false;
  const value = environment[name].trim().toLowerCase();
  return !/^(?:synthetic|mock|placeholder|dummy|fake|test)(?:[-_:]|$)/.test(value)
    && value !== 'change-me';
}

function isRealProviderPosture(environment) {
  return environment.SELFTEST !== '1' && environment.PARITY_ASSURANCE_MODE !== '1';
}

function dependencyState({ enabled, configured, failClosed = true, required = enabled }) {
  if (!enabled) {
    return Object.freeze({
      enabled: false,
      required: Boolean(required),
      ready: !required,
      status: required ? 'unavailable' : 'disabled',
    });
  }
  const ready = Boolean(configured && failClosed);
  return Object.freeze({
    enabled: true,
    required: Boolean(required),
    ready,
    status: ready ? 'ready' : 'unavailable',
  });
}

/**
 * Configuration readiness only; live provider behaviour is proved by release
 * canaries. This function never contacts or spends against a provider merely
 * because a load balancer polls readiness.
 */
export function resolveDependencyReadiness(environment = process.env) {
  const realProviderPosture = isRealProviderPosture(environment);
  const isPhysio = environment.PROFESSION === 'physio';
  const r1Comparison = environment.ASSESSSUITE_DEPLOYMENT_VARIANT
    === PHYSIO_R1_COMPARISON_VARIANT;
  const strictPhysioProduction = isPhysio
    && environment.NODE_ENV === 'production'
    && environment.PHYSIO_EXACT_IMAGE_CANARY_MODE !== '1'
    && !r1Comparison;
  const physioTrialConfigured = environment.PROFESSION !== 'physio'
    || /^[1-9][0-9]*$/.test(String(environment.STRIPE_TRIAL_PERIOD_DAYS || '').trim());
  const openAiConfigured = realProviderPosture
    && configuredProviderSecret(environment, 'OPENAI_API_KEY')
    // server/llm.mjs honours this loopback override only under SELFTEST with
    // a synthetic key, both of which already fail realProviderPosture. Keep
    // the explicit exclusion as a regression boundary against either guard
    // being relaxed independently later. Transcription has no URL override.
    && !configuredValue(environment, 'OPENAI_CHAT_TEST_BASE_URL');
  const failLoudLlm = capabilityEnabled('LLM_REQUIRED', environment);

  const dependencies = {
    general_clinical_llm: dependencyState({
      enabled: generalClinicalLlmSwitchedOn(environment),
      configured: openAiConfigured,
      failClosed: failLoudLlm,
    }),
    ...(isPhysio ? {
      // Physio intentionally disables the unstructured Core.InvokeLLM
      // surface. Its six versioned tasks remain a distinct required provider
      // dependency and therefore cannot disappear from readiness merely
      // because the legacy switch is off.
      physio_ai_tasks: dependencyState({
        enabled: true,
        configured: openAiConfigured,
        failClosed: failLoudLlm,
      }),
    } : {}),
    transcription: dependencyState({
      enabled: capabilityEnabled('TRANSCRIPTION_ENABLED', environment),
      configured: openAiConfigured,
      failClosed: failLoudLlm,
      required: strictPhysioProduction
        || capabilityEnabled('TRANSCRIPTION_ENABLED', environment),
    }),
    document_extraction: dependencyState({
      enabled: capabilityEnabled('DOCUMENT_EXTRACTION_ENABLED', environment),
      configured:
        openAiConfigured
        && environment.OPENAI_HEALTH_DATA_TERMS_CONFIRMED === '1'
        && !configuredValue(environment, 'DOCUMENT_EXTRACTION_TEST_BASE_URL'),
      required: strictPhysioProduction
        || capabilityEnabled('DOCUMENT_EXTRACTION_ENABLED', environment),
    }),
    transactional_email: dependencyState({
      enabled: capabilityEnabled('OUTBOUND_EMAIL_ENABLED', environment),
      configured:
        realProviderPosture
        && configuredProviderSecret(environment, 'RESEND_API_KEY'),
      required: strictPhysioProduction
        || capabilityEnabled('OUTBOUND_EMAIL_ENABLED', environment),
    }),
    payments: dependencyState({
      enabled: capabilityEnabled('PAYMENTS_ENABLED', environment),
      configured:
        realProviderPosture
        && configuredProviderSecret(environment, 'STRIPE_SECRET_KEY')
        && (
          environment.NODE_ENV !== 'production'
          || /^(?:rk_live_|sk_live_)/.test(environment.STRIPE_SECRET_KEY.trim())
        )
        && configuredProviderSecret(environment, 'STRIPE_WEBHOOK_SECRET')
        && configuredValue(environment, 'STRIPE_PRICE_ID_MONTHLY')
        && configuredValue(environment, 'STRIPE_PRICE_ID_ANNUAL')
        // Physio self-service must expose the provider-readback trial. EP
        // predates this vertical-specific input and retains its existing
        // readiness contract until its commercial configuration is migrated.
        && physioTrialConfigured,
      required: strictPhysioProduction
        || capabilityEnabled('PAYMENTS_ENABLED', environment),
    }),
  };

  return Object.freeze({
    ready: Object.values(dependencies).every((dependency) => dependency.ready),
    dependencies: Object.freeze(dependencies),
  });
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function expectedSchemaTables(entityNames) {
  const expected = Object.fromEntries(
    Object.entries(OPERATIONAL_TABLE_COLUMNS).map(([name, columns]) => [name, [...columns]]),
  );
  for (const entityName of [...entityNames].sort()) {
    expected[`entity_${entityName}`] = [...ENTITY_TABLE_COLUMNS];
  }
  return expected;
}

export function buildRuntimeDatabaseExpectation(entityNames, expectedCatalogue) {
  if (!(entityNames instanceof Set)) throw new TypeError('entityNames must be a Set');
  if (!expectedCatalogue || !Array.isArray(expectedCatalogue.assessments)) {
    throw new TypeError('expected catalogue is unavailable');
  }
  const expectedTables = expectedSchemaTables(entityNames);
  return Object.freeze({
    expectedTables: Object.freeze(expectedTables),
    migrationVersion: `sha256:${sha256(canonicalJson({
      contract: SQLITE_SCHEMA_CONTRACT_VERSION,
      tables: expectedTables,
      views: { sessions: ['token', 'user_id', 'created_date', 'expires_date'] },
    }))}`,
    entityCount: entityNames.size,
    catalogueCount: expectedCatalogue.runtimeCount,
    catalogueChecksum: catalogueChecksum(expectedCatalogue.assessments),
  });
}

function unavailableDatabaseSnapshot(expectation) {
  return {
    ready: false,
    integrity: 'unavailable',
    schema: {
      ready: false,
      version: SQLITE_SCHEMA_CONTRACT_VERSION,
      migration_version: 'unavailable',
      sqlite_user_version: null,
      expected_entity_count: expectation.entityCount,
      missing_object_count: null,
      missing_column_count: null,
    },
    catalogue: {
      ready: false,
      count: null,
      checksum: null,
      checksum_algorithm: CATALOGUE_CHECKSUM_ALGORITHM,
      expected_count: expectation.catalogueCount,
      expected_checksum: expectation.catalogueChecksum,
    },
  };
}

export function inspectRuntimeDatabase({
  db,
  entityNames,
  expectedCatalogue,
  expectation = buildRuntimeDatabaseExpectation(entityNames, expectedCatalogue),
}) {
  if (!db || typeof db.prepare !== 'function' || !(entityNames instanceof Set)) {
    return unavailableDatabaseSnapshot(expectation);
  }

  try {
    const quickCheckRows = db.prepare('PRAGMA quick_check').all();
    const integrityReady = quickCheckRows.length > 0
      && quickCheckRows.every((row) => Object.values(row)[0] === 'ok');
    const objects = new Map(
      db
        .prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view')")
        .all()
        .map((row) => [row.name, row.type]),
    );

    let missingObjectCount = objects.get('sessions') === 'view' ? 0 : 1;
    let missingColumnCount = 0;
    for (const [table, requiredColumns] of Object.entries(expectation.expectedTables)) {
      if (objects.get(table) !== 'table') {
        missingObjectCount += 1;
        missingColumnCount += requiredColumns.length;
        continue;
      }
      const actualColumns = new Set(
        db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all().map((column) => column.name),
      );
      missingColumnCount += requiredColumns.filter((column) => !actualColumns.has(column)).length;
    }
    const schemaReady = missingObjectCount === 0 && missingColumnCount === 0;

    let catalogueRecords = [];
    let catalogueParseReady = objects.get('entity_Assessment') === 'table';
    if (catalogueParseReady) {
      try {
        catalogueRecords = db
          .prepare('SELECT data FROM entity_Assessment')
          .all()
          .map(({ data }) => JSON.parse(data));
      } catch {
        catalogueParseReady = false;
      }
    }

    const actualCatalogueChecksum = catalogueParseReady
      ? catalogueChecksum(catalogueRecords)
      : null;
    const catalogueReady = Boolean(
      catalogueParseReady
      && catalogueRecords.length === expectation.catalogueCount
      && actualCatalogueChecksum === expectation.catalogueChecksum,
    );
    const sqliteUserVersion = Number(
      Object.values(db.prepare('PRAGMA user_version').get() || {})[0] ?? 0,
    );

    return {
      ready: integrityReady && schemaReady && catalogueReady,
      integrity: integrityReady ? 'ok' : 'failed',
      schema: {
        ready: schemaReady,
        version: SQLITE_SCHEMA_CONTRACT_VERSION,
        migration_version: expectation.migrationVersion,
        sqlite_user_version: Number.isSafeInteger(sqliteUserVersion) ? sqliteUserVersion : null,
        expected_entity_count: expectation.entityCount,
        missing_object_count: missingObjectCount,
        missing_column_count: missingColumnCount,
      },
      catalogue: {
        ready: catalogueReady,
        count: catalogueParseReady ? catalogueRecords.length : null,
        checksum: actualCatalogueChecksum,
        checksum_algorithm: CATALOGUE_CHECKSUM_ALGORITHM,
        expected_count: expectation.catalogueCount,
        expected_checksum: expectation.catalogueChecksum,
      },
    };
  } catch {
    return unavailableDatabaseSnapshot(expectation);
  }
}

function cleanReleaseValue(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._:+-]{1,120}$/.test(value)
    ? value
    : 'unknown';
}

export function resolveReleaseMetadata(environment = process.env) {
  const releaseSha = cleanReleaseValue(environment.RELEASE_SHA);
  const buildTimestamp = cleanReleaseValue(
    environment.BUILD_TIMESTAMP || environment.RELEASE_BUILD_TIMESTAMP,
  );
  const production = environment.NODE_ENV === 'production';
  const shaReady = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(releaseSha);
  const timestampReady = buildTimestamp !== 'unknown'
    && Number.isFinite(Date.parse(buildTimestamp));
  return Object.freeze({
    ready: !production || (shaReady && timestampReady),
    required: production,
    release_sha: releaseSha,
    build_timestamp: buildTimestamp,
  });
}

function resolveIdentityStatus(environment, activeContract) {
  let expected;
  try {
    expected = resolveActiveProfessionContract(environment);
  } catch {
    return Object.freeze({
      ready: false,
      profession_id: activeContract?.professionId || 'unknown',
      profession_schema_version: PROFESSION_SCHEMA_VERSION,
      app_id: activeContract?.appId || 'unknown',
    });
  }
  const production = environment.NODE_ENV === 'production';
  const expectedUrl = environment.ASSESSSUITE_DEPLOYMENT_VARIANT
    === PHYSIO_R1_COMPARISON_VARIANT
    ? PHYSIO_R1_COMPARISON_PUBLIC_URL
    : `https://${expected.profession.deployment.intendedAppHost}`;
  const identityMatches = Boolean(
    activeContract
    && activeContract.professionId === expected.professionId
    && activeContract.appId === expected.appId,
  );
  const urlMatches = !production || (
    environment.EXPECTED_APP_URL === expectedUrl
    && environment.APP_URL === expectedUrl
  );
  return Object.freeze({
    ready: identityMatches && urlMatches,
    profession_id: activeContract?.professionId || 'unknown',
    profession_schema_version: PROFESSION_SCHEMA_VERSION,
    app_id: activeContract?.appId || 'unknown',
  });
}

function readinessFailureCodes({ identity, release, database, dependencies, productionPosture }) {
  const failures = [];
  if (!identity.ready) failures.push('runtime_identity_mismatch');
  if (!release.ready) failures.push('release_metadata_unavailable');
  if (database.integrity !== 'ok') failures.push('database_integrity_failed');
  if (!database.schema.ready) failures.push('database_schema_mismatch');
  if (!database.catalogue.ready) failures.push('catalogue_mismatch');
  if (!productionPosture.runtime_ready) failures.push('production_posture_mismatch');
  for (const [name, dependency] of Object.entries(dependencies.dependencies)) {
    if (!dependency.ready) failures.push(`dependency_unavailable:${name}`);
  }
  return failures;
}

export function assembleRuntimeSnapshot({
  environment,
  activeContract,
  database,
  dependencies,
}) {
  const identity = resolveIdentityStatus(environment, activeContract);
  const release = resolveReleaseMetadata(environment);
  const resolvedPosture = resolvePhysioProductionPosture(environment);
  const productionPosture = Object.freeze({
    ...resolvedPosture,
    runtime_ready: resolvedPosture.ready,
    // The isolated exact-image canary proves the production image and real
    // provider paths, but its provider-off email/payment carrier can never be
    // presented as the normal deployable production posture.
    deployment_ready: resolvedPosture.ready
      && resolvedPosture.mode !== 'exact-image-canary',
  });
  const failures = readinessFailureCodes({
    identity,
    release,
    database,
    dependencies,
    productionPosture,
  });
  return Object.freeze({
    ready: failures.length === 0,
    failures: Object.freeze(failures),
    identity,
    release,
    database,
    dependencies,
    production_posture: productionPosture,
  });
}

/**
 * Runtime-bound façade. Expected catalogue content is frozen once at process
 * startup; database and dependency state are re-read for every readiness poll.
 */
export function createRuntimeStatus({
  environment = process.env,
  db,
  entityNames,
  activeContract = resolveActiveProfessionContract(environment),
  cacheTtlMs = environment.NODE_ENV === 'test' ? 0 : RUNTIME_INSPECTION_CACHE_TTL_MS,
  clock = Date.now,
} = {}) {
  const expectedCatalogue = buildRuntimeAssessmentCatalogue(environment);
  const expectation = buildRuntimeDatabaseExpectation(entityNames, expectedCatalogue);
  if (!Number.isFinite(cacheTtlMs) || cacheTtlMs < 0) {
    throw new TypeError('runtime inspection cache TTL must be a non-negative finite number');
  }
  if (typeof clock !== 'function') throw new TypeError('runtime inspection clock must be a function');

  let cachedSnapshot = null;
  let cachedAt = Number.NEGATIVE_INFINITY;

  function snapshot({ force = false } = {}) {
    const observedAt = Number(clock());
    if (!Number.isFinite(observedAt)) throw new Error('runtime inspection clock returned an invalid value');
    if (
      !force
      && cachedSnapshot
      && observedAt - cachedAt < cacheTtlMs
    ) return cachedSnapshot;

    const database = inspectRuntimeDatabase({
      db,
      entityNames,
      expectedCatalogue,
      expectation,
    });
    const dependencies = resolveDependencyReadiness(environment);
    cachedSnapshot = assembleRuntimeSnapshot({
      environment,
      activeContract,
      database,
      dependencies,
    });
    cachedAt = observedAt;
    return cachedSnapshot;
  }

  // Pay the synchronous SQLite integrity/catalogue cost before accepting
  // traffic, then reuse the bounded snapshot across routine health polls.
  snapshot({ force: true });

  function live() {
    return {
      contract_version: RUNTIME_STATUS_CONTRACT_VERSION,
      status: 'live',
      profession_id: activeContract.professionId,
      app_id: activeContract.appId,
    };
  }

  function readiness() {
    const current = snapshot();
    return {
      contract_version: RUNTIME_STATUS_CONTRACT_VERSION,
      status: current.ready ? 'ready' : 'not_ready',
      ready: current.ready,
      profession_id: current.identity.profession_id,
      app_id: current.identity.app_id,
      checks: {
        identity: current.identity.ready,
        release_metadata: current.release.ready,
        database_integrity: current.database.integrity === 'ok',
        database_schema: current.database.schema.ready,
        catalogue: current.database.catalogue.ready,
        required_dependencies: current.dependencies.ready,
        production_posture: current.production_posture.runtime_ready,
      },
      failures: [...current.failures],
    };
  }

  function version() {
    const current = snapshot();
    return {
      contract_version: RUNTIME_STATUS_CONTRACT_VERSION,
      release_sha: current.release.release_sha,
      build_timestamp: current.release.build_timestamp,
      profession_id: current.identity.profession_id,
      profession_schema_version: current.identity.profession_schema_version,
      app_id: current.identity.app_id,
      catalogue: {
        count: current.database.catalogue.count,
        checksum: current.database.catalogue.checksum,
        checksum_algorithm: current.database.catalogue.checksum_algorithm,
        expected_count: current.database.catalogue.expected_count,
        expected_checksum: current.database.catalogue.expected_checksum,
        ready: current.database.catalogue.ready,
      },
      database: {
        integrity: current.database.integrity,
        schema_ready: current.database.schema.ready,
        schema_version: current.database.schema.version,
        migration_version: current.database.schema.migration_version,
        sqlite_user_version: current.database.schema.sqlite_user_version,
      },
      production_posture: {
        contract_version: current.production_posture.contract_version,
        mode: current.production_posture.mode,
        ready: current.production_posture.runtime_ready,
        deployment_ready: current.production_posture.deployment_ready,
        posture_sha256: current.production_posture.posture_sha256,
      },
    };
  }

  function capabilities() {
    const current = snapshot();
    return {
      contract_version: RUNTIME_STATUS_CONTRACT_VERSION,
      profession_id: current.identity.profession_id,
      app_id: current.identity.app_id,
      required_dependencies_ready: current.dependencies.ready,
      production_posture_ready: current.production_posture.runtime_ready,
      production_deployment_ready: current.production_posture.deployment_ready,
      production_posture_mode: current.production_posture.mode,
      capabilities: Object.fromEntries(
        Object.entries(current.dependencies.dependencies).map(([name, dependency]) => [
          name,
          { ...dependency },
        ]),
      ),
    };
  }

  return Object.freeze({ live, readiness, version, capabilities, snapshot });
}
