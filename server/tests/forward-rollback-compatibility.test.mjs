import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LEGAL_DOCUMENTS,
  PRACTITIONER_NOTICE_IDS,
  SUITE_VERSION,
} from '../../src/lib/legal/documentRegistry.js';
import {
  REFERRAL_EXTRACTION_SCHEMA,
  REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS,
} from '../../src/lib/referralExtractionSchema.js';
import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
} from '../../src/lib/referralWorkflow.js';
import { REFERRAL_REVIEW_COMMIT_VERSION } from '../referralCommit.mjs';
import { REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION } from '../uploadRegistry.mjs';
import { startFakeOpenAI } from './support/fake-openai.mjs';
import {
  CANONICAL_REFERRAL_PROFILE_FULL_39,
  canonicalMultiFileCsvFixture,
  fullFieldReferralPdfFixture,
  pdfFixture,
} from './support/syntheticReferralFixtures.mjs';
import {
  activateUser,
  assertImmutableImageReference,
  createOrganizationForUser,
  createTestStore,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const CURRENT_VERSION = 'RC-2026.07.19';
const SUPERSEDED_VERSION = 'RC-2026.07.11';
const UNKNOWN_VERSION = 'RC-1900.01.01';
const FORWARD_IMAGE = process.env.FORWARD_IMAGE?.trim() || null;
const ROLLBACK_IMAGE = process.env.ROLLBACK_IMAGE?.trim() || null;
const PROVIDER_KEY_CANARY = 'synthetic-forward-rollback-provider-canary';
const FORBIDDEN_INHERITED_SECRETS = [
  'FLY_API_TOKEN',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_MONTHLY',
  'STRIPE_PRICE_ID_ANNUAL',
];
const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const CLIENT_REVIEW_FIELDS = new Set([
  'full_name',
  'date_of_birth',
  'gender',
  'phone',
  'email',
  'address',
  'referral_source',
  'referral_source_name',
  'referral_source_address',
  'referral_source_email',
  'referral_provider_number',
  'referral_reason',
  'referral_date',
  'funding_source',
  'medicare_number',
  'medicare_irn',
  'medicare_referral_type',
  'dva_card_number',
  'dva_card_type',
  'dva_file_number',
  'dva_accepted_conditions',
  'ndis_number',
  'ndis_goals',
  'private_health_fund_name',
  'private_health_fund_number',
  'workcover_claim_number',
  'workcover_date_of_injury',
  'workcover_injury_description',
  'primary_gp_name',
  'primary_gp_clinic_name',
  'primary_gp_address',
  'primary_gp_phone',
  'primary_gp_email',
  'primary_gp_provider_number',
  'client_goals',
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertCanonicalFlyStartupContract() {
  const flyConfig = fs.readFileSync(path.join(repoRoot, 'fly.production.toml'), 'utf8');
  const dockerfile = fs.readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
  assert.match(
    flyConfig,
    /\[processes\]\s+app\s*=\s*"node server\/productionBootstrap\.mjs && exec node server\/index\.mjs"/,
    'Fly must run the bounded production bootstrap and then replace it with the server',
  );
  assert.match(
    dockerfile,
    /CMD \["sh", "-c", "node server\/productionBootstrap\.mjs && exec node server\/index\.mjs"\]/,
    'the image default must retain the production bootstrap contract',
  );
}

function hashFile(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function route(server, suffix) {
  return `/api/apps/${server.appId}${suffix}`;
}

function openDatabase(dbPath, { readOnly = false } = {}) {
  const db = new DatabaseSync(dbPath, { readOnly });
  db.exec('PRAGMA busy_timeout = 5000;');
  if (readOnly) db.exec('PRAGMA query_only = ON;');
  return db;
}

function assertSqliteIntegrity(dbPath) {
  const db = openDatabase(dbPath);
  try {
    const integrity = db.prepare('PRAGMA integrity_check;').all();
    assert.equal(integrity.length, 1);
    assert.equal(integrity[0].integrity_check, 'ok');
    const foreignKeys = db.prepare('PRAGMA foreign_key_check;').all();
    assert.deepEqual(foreignKeys, []);
  } finally {
    db.close();
  }
}

function checkpointAndHashDatabase(dbPath) {
  const db = openDatabase(dbPath);
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    const integrity = db.prepare('PRAGMA integrity_check;').all();
    assert.equal(integrity.length, 1);
    assert.equal(integrity[0].integrity_check, 'ok');
  } finally {
    db.close();
  }
  const digest = hashFile(dbPath);
  assert.match(digest, /^[0-9a-f]{64}$/);
  return digest;
}

function databaseAndUploadSnapshot(store) {
  const db = openDatabase(store.dbPath, { readOnly: true });
  let tableRows;
  try {
    tableRows = Object.fromEntries(
      db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all().map(({ name }) => [name, db.prepare(`SELECT * FROM "${name}" ORDER BY 1`).all()]),
    );
  } finally {
    db.close();
  }
  const files = fs.readdirSync(store.uploadsDir).sort().map((name) => {
    const filePath = path.join(store.uploadsDir, name);
    const stat = fs.lstatSync(filePath);
    return {
      name,
      kind: stat.isFile() && !stat.isSymbolicLink() ? 'file' : 'other',
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      sha256: stat.isFile() && !stat.isSymbolicLink() ? hashFile(filePath) : null,
    };
  });
  const databaseFiles = ['', '-wal'].map((suffix) => `${store.dbPath}${suffix}`)
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => ({
      name: path.basename(candidate),
      size: fs.statSync(candidate).size,
      sha256: hashFile(candidate),
    }));
  return {
    tableDigest: sha256(Buffer.from(JSON.stringify(tableRows))),
    tableRows,
    files,
    databaseFiles,
  };
}

async function createAcceptedUser(server, adminToken, version, suffix) {
  const user = await registerUser(server, `synthetic-roundtrip-${suffix}@example.test`);
  await activateUser(server, adminToken, user.id);
  const org = await createOrganizationForUser(server, adminToken, user);
  if (version === CURRENT_VERSION) {
    const acceptance = await requestJson(
      server,
      route(server, '/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
      {
        method: 'POST',
        token: user.token,
        body: { org_id: org.id, marketing_opt_in: false },
      },
    );
    assert.equal(acceptance.status, 200, acceptance.text);
    return { user, org };
  }
  for (const documentId of PRACTITIONER_NOTICE_IDS) {
    const doc = LEGAL_DOCUMENTS[documentId];
    const acceptance = await requestJson(server, route(server, '/entities/LegalAcceptanceEvent'), {
      method: 'POST',
      token: adminToken,
      body: {
        event_type: doc.eventType,
        user_email: user.email,
        org_id: org.id,
        suite_version: version,
        document_id: documentId,
        document_title: doc.title,
        actor_capacity: 'synthetic compatibility fixture',
      },
    });
    assert.equal(acceptance.status, 200, acceptance.text);
  }
  return { user, org };
}

async function clinicalAccess(server, fixture) {
  return requestJson(server, route(server, '/entities/Client'), { token: fixture.user.token });
}

async function assertLegalStatus(server, fixture, status) {
  const result = await clinicalAccess(server, fixture);
  assert.equal(result.status, status, result.text);
  if (status === 200) assert.ok(Array.isArray(result.body));
  else assert.equal(result.body?.message, 'current legal acceptance required');
}

async function uploadReferral(server, fixture, bytes, filename, mediaType) {
  const form = new FormData();
  form.set('org_id', fixture.org.id);
  form.set('purpose', 'referral-extraction');
  form.set('processing_authority_confirmed', 'true');
  form.set(
    'processing_authority_attestation_version',
    REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
  );
  form.set('subject_age_confirmation', REFERRAL_SUBJECT_AGE_CONFIRMATION);
  form.set('subject_age_attestation_version', REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION);
  form.set('file', new File([bytes], filename, { type: mediaType }));
  const response = await fetch(
    `${server.baseUrl}${route(server, '/integration-endpoints/Core/UploadFile')}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${fixture.user.token}`, 'X-App-Id': server.appId },
      body: form,
    },
  );
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  assert.equal(response.status, 200, text);
  assert.equal(typeof body?.upload_id, 'string');
  assert.equal(body?.file_url, `/uploads/${body.upload_id}`);
  return body;
}

async function extractReferral(server, fixture, uploadIds) {
  return requestJson(
    server,
    route(server, '/integration-endpoints/Core/ExtractDataFromUploadedFile'),
    {
      method: 'POST',
      token: fixture.user.token,
      body: {
        file_urls: uploadIds.map((id) => `/uploads/${id}`),
        org_id: fixture.org.id,
        json_schema: REFERRAL_EXTRACTION_SCHEMA,
        processing_authority_confirmed: true,
        processing_authority_attestation_version:
          REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
      },
    },
  );
}

function reviewedClientFromExtraction(output) {
  return Object.fromEntries(
    Object.entries(output).filter(([key, value]) => CLIENT_REVIEW_FIELDS.has(key) && value != null),
  );
}

function reviewedConditionsFromExtraction(output) {
  return [
    { condition_name: output.primary_condition, condition_type: 'primary' },
    ...output.comorbidities.map((conditionName) => ({
      condition_name: conditionName,
      condition_type: 'comorbidity',
    })),
    ...output.medications.map((medication) => ({
      condition_name: 'Medication',
      condition_type: 'comorbidity',
      medication,
    })),
    {
      condition_name: 'Relevant medical history',
      condition_type: 'comorbidity',
      notes: output.medical_history,
    },
  ];
}

async function commitReferral(server, fixture, payload) {
  return requestJson(server, route(server, '/functions/commitReviewedReferral'), {
    method: 'POST',
    token: fixture.user.token,
    body: payload,
  });
}

function uploadRows(dbPath, uploadIds) {
  const db = openDatabase(dbPath, { readOnly: true });
  try {
    const select = db.prepare('SELECT * FROM upload_registry WHERE id = ?');
    return uploadIds.map((id) => select.get(id));
  } finally {
    db.close();
  }
}

function seedLegacyRegisteringCrash(store, fixture) {
  const id = randomUUID();
  const storedName = `${id}.pdf`;
  const bytes = Buffer.from('%PDF-1.4\nsynthetic interrupted registering object\n%%EOF\n');
  const createdAt = new Date(Date.now() - 60_000).toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const db = openDatabase(store.dbPath);
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE upload_registry_pre_registering (
        id TEXT PRIMARY KEY,
        stored_name TEXT NOT NULL UNIQUE,
        original_name TEXT NOT NULL,
        org_id TEXT NOT NULL,
        uploader_user_id TEXT NOT NULL,
        purpose TEXT NOT NULL,
        detected_mime TEXT NOT NULL,
        byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
        sha256 TEXT NOT NULL,
        lifecycle_state TEXT NOT NULL CHECK (
          lifecycle_state IN ('temporary', 'processing', 'review-pending', 'bound', 'expired', 'deleted')
        ),
        subject_age_band TEXT NOT NULL DEFAULT 'unknown' CHECK (
          subject_age_band IN ('unknown', 'under_13', '13_or_over')
        ),
        created_at TEXT NOT NULL,
        expires_at TEXT,
        bound_at TEXT,
        deleted_at TEXT,
        bound_entity_type TEXT,
        bound_entity_id TEXT,
        is_legacy INTEGER NOT NULL DEFAULT 0 CHECK (is_legacy IN (0, 1))
      );
      INSERT INTO upload_registry_pre_registering (
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, bound_at, deleted_at, bound_entity_type,
        bound_entity_id, is_legacy
      )
      SELECT
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, bound_at, deleted_at, bound_entity_type,
        bound_entity_id, is_legacy
      FROM upload_registry;
      DROP TABLE upload_registry;
      ALTER TABLE upload_registry_pre_registering RENAME TO upload_registry;
      CREATE INDEX idx_upload_registry_org_state ON upload_registry (org_id, lifecycle_state);
      CREATE INDEX idx_upload_registry_uploader_created ON upload_registry (uploader_user_id, created_at);
      CREATE INDEX idx_upload_registry_expiry ON upload_registry (expires_at, lifecycle_state);
      COMMIT;
    `);
    const oldDdl = String(
      db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'upload_registry'").get()?.sql,
    );
    assert.doesNotMatch(oldDdl, /'registering'/);
    db.exec('PRAGMA ignore_check_constraints = ON;');
    db.prepare(`
      INSERT INTO upload_registry (
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, is_legacy
      ) VALUES (?, ?, ?, ?, ?, 'referral-extraction', 'application/pdf', ?, ?,
        'registering', '13_or_over', ?, ?, 0)
    `).run(
      id,
      storedName,
      'synthetic-interrupted-registering.pdf',
      fixture.org.id,
      fixture.user.id,
      bytes.length,
      sha256(bytes),
      createdAt,
      expiresAt,
    );
    db.exec('PRAGMA ignore_check_constraints = OFF;');
  } finally {
    db.close();
  }
  const finalPath = path.join(store.uploadsDir, storedName);
  const tempPath = `${finalPath}.registering`;
  const markerPath = path.join(store.uploadsDir, `${id}.provider-block`);
  fs.writeFileSync(finalPath, bytes, { flag: 'wx' });
  fs.writeFileSync(tempPath, bytes, { flag: 'wx' });
  fs.writeFileSync(markerPath, Buffer.alloc(0), { flag: 'wx' });
  return { id, storedName, finalPath, tempPath, markerPath };
}

function commonPhaseEnvironment(fakeProvider) {
  return {
    ALLOW_OPEN_REGISTRATION: '1',
    DOCUMENT_EXTRACTION_TEST_BASE_URL: fakeProvider.baseUrl,
    DOCUMENT_EXTRACTION_TEST_TIMEOUT_MS: '1000',
    DOCUMENT_EXTRACTION_USER_PER_MINUTE: '60',
    DOCUMENT_EXTRACTION_ORG_PER_MINUTE: '180',
    DOCUMENT_EXTRACTION_USER_DAILY_DOCUMENTS: '500',
    DOCUMENT_EXTRACTION_ORG_DAILY_DOCUMENTS: '2000',
    DOCUMENT_EXTRACTION_USER_DAILY_COST_USD: '10',
    DOCUMENT_EXTRACTION_ORG_DAILY_COST_USD: '20',
    DOCUMENT_EXTRACTION_MONTHLY_CIRCUIT_USD: '29',
    DOCUMENT_EXTRACTION_ESTIMATED_COST_PER_DOCUMENT_USD: '0.01',
    UPLOAD_USER_PER_MINUTE: '60',
    UPLOAD_ORG_PER_MINUTE: '240',
    OPENAI_API_KEY: PROVIDER_KEY_CANARY,
    OPENAI_DOCUMENT_EXTRACTION_MODEL: 'synthetic-assurance-model',
    RESEND_API_KEY: '',
    TRANSCRIPTION_ENABLED: '0',
    GENERAL_CLINICAL_LLM_ENABLED: '0',
    DOCUMENT_EXTRACTION_UNDER_13_ENABLED: '0',
  };
}

async function startPhase({ store, fakeProvider, image, selftest, rollback = false }) {
  return startTestServer(
    {
      ...commonPhaseEnvironment(fakeProvider),
      DOCUMENT_EXTRACTION_ENABLED: rollback ? '0' : '1',
      LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS: rollback
        ? `${SUPERSEDED_VERSION},${CURRENT_VERSION}`
        : '',
    },
    {
      store,
      selftest,
      image,
      imageLabel: rollback ? 'ROLLBACK_IMAGE' : 'FORWARD_IMAGE',
      startupTimeoutMs: image ? 60_000 : 30_000,
    },
  );
}

async function assertBoundFile(server, token, uploadId, expectedHash) {
  const response = await fetch(`${server.baseUrl}/api/files/${uploadId}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-App-Id': server.appId },
  });
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(bytes), expectedHash);
}

test('current -> compatibility rollback -> current preserves and safely evolves one store', {
  timeout: FORWARD_IMAGE ? 180_000 : 90_000,
}, async () => {
  assert.equal(SUITE_VERSION, CURRENT_VERSION, 'current legal-suite version drifted');
  assert.equal(Boolean(FORWARD_IMAGE), Boolean(ROLLBACK_IMAGE), 'both exact images are required together');
  for (const name of FORBIDDEN_INHERITED_SECRETS) {
    assert.equal(process.env[name], undefined, `${name} must not enter the proof subprocess`);
  }
  assertCanonicalFlyStartupContract();
  const syntheticDigest = `registry.example/assesssuite@sha256:${'a'.repeat(64)}`;
  assert.equal(assertImmutableImageReference(syntheticDigest), syntheticDigest);
  assert.throws(() => assertImmutableImageReference(`sha256:${'a'.repeat(64)}`), /immutable sha256/);
  assert.throws(() => assertImmutableImageReference('registry.example/assesssuite:latest'), /immutable sha256/);

  const store = createTestStore('assesssuite-forward-rollback-');
  const fakeProvider = await startFakeOpenAI();
  let server = null;
  let mergeProof = false;
  let registeringProof = false;
  let ageProof = false;
  let receiptProof = false;

  try {
    // Phase C1: current forward runtime creates the complete durable fixture.
    server = await startPhase({
      store,
      fakeProvider,
      image: FORWARD_IMAGE,
      selftest: true,
    });
    const adminToken = await loginAdmin(server);
    const fixtures = {
      current: await createAcceptedUser(server, adminToken, CURRENT_VERSION, 'current'),
      superseded: await createAcceptedUser(server, adminToken, SUPERSEDED_VERSION, 'superseded'),
      unknown: await createAcceptedUser(server, adminToken, UNKNOWN_VERSION, 'unknown'),
    };
    await assertLegalStatus(server, fixtures.current, 200);
    await assertLegalStatus(server, fixtures.superseded, 403);
    await assertLegalStatus(server, fixtures.unknown, 403);

    fakeProvider.reset();
    const full = await uploadReferral(
      server,
      fixtures.current,
      fullFieldReferralPdfFixture(),
      'synthetic-full-39.pdf',
      'application/pdf',
    );
    const additional = await uploadReferral(
      server,
      fixtures.current,
      canonicalMultiFileCsvFixture('additional'),
      'synthetic-additional.csv',
      'text/csv',
    );
    const extraction = await extractReferral(
      server,
      fixtures.current,
      [full.upload_id, additional.upload_id],
    );
    assert.equal(extraction.status, 200, extraction.text);
    assert.equal(extraction.body?.status, 'success');
    assert.deepEqual(Object.keys(extraction.body.output), REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS);
    assert.deepEqual(extraction.body.output, {
      ...CANONICAL_REFERRAL_PROFILE_FULL_39,
      medications: [
        ...CANONICAL_REFERRAL_PROFILE_FULL_39.medications,
        'ibuprofen 200 mg',
        'Paracetamol 500 mg',
      ],
    });
    assert.equal(fakeProvider.calls.length, 2);
    for (const call of fakeProvider.calls) {
      assert.equal(call.schemaPropertyCount, 39);
      assert.deepEqual(call.schemaPropertyNames, REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS);
      assert.deepEqual(call.schemaRequired, REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS);
      assert.equal(call.schemaAdditionalProperties, false);
    }
    assert.match(fakeProvider.calls[0].input, /ASSURANCE_PROFILE_FULL_39/);
    assert.doesNotMatch(fakeProvider.calls[0].input, /ASSURANCE_CANONICAL_MULTI_ADDITIONAL/);
    assert.match(fakeProvider.calls[1].input, /ASSURANCE_CANONICAL_MULTI_ADDITIONAL/);
    assert.doesNotMatch(fakeProvider.calls[1].input, /ASSURANCE_PROFILE_FULL_39/);
    mergeProof = true;

    const commitPayload = {
      idempotency_key: randomUUID(),
      org_id: fixtures.current.org.id,
      operation: 'create',
      client_id: null,
      review_confirmed: true,
      review_version: REFERRAL_REVIEW_COMMIT_VERSION,
      client: reviewedClientFromExtraction(extraction.body.output),
      conditions: reviewedConditionsFromExtraction(extraction.body.output),
      upload_ids: [full.upload_id, additional.upload_id],
      historical_assessments: [],
    };
    const committed = await commitReferral(server, fixtures.current, commitPayload);
    assert.equal(committed.status, 200, committed.text);
    assert.equal(committed.body?.status, 'success');
    assert.equal(committed.body?.counts?.documents_retained, 2);
    const replayC1 = await commitReferral(server, fixtures.current, commitPayload);
    assert.equal(replayC1.status, 200, replayC1.text);
    assert.deepEqual(replayC1.body, committed.body);
    const conflictC1 = await commitReferral(server, fixtures.current, {
      ...commitPayload,
      client: { ...commitPayload.client, phone: '+61 400 999 999' },
    });
    assert.equal(conflictC1.status, 409, conflictC1.text);
    assert.equal(conflictC1.body?.code, 'idempotency_conflict');

    const boundRowsC1 = uploadRows(store.dbPath, [full.upload_id, additional.upload_id]);
    const boundHashes = new Map();
    for (const row of boundRowsC1) {
      assert.equal(row.lifecycle_state, 'bound');
      assert.equal(row.org_id, fixtures.current.org.id);
      assert.equal(row.bound_entity_type, 'ClientDocument');
      const filePath = path.join(store.uploadsDir, row.stored_name);
      assert.equal(hashFile(filePath), row.sha256);
      boundHashes.set(row.id, row.sha256);
    }

    const disabledProbe = await uploadReferral(
      server,
      fixtures.current,
      pdfFixture(),
      'synthetic-disabled-probe.pdf',
      'application/pdf',
    );

    fakeProvider.reset();
    fakeProvider.setModeSequence(['semantic', 'under-13']);
    const agePrimary = await uploadReferral(
      server,
      fixtures.current,
      canonicalMultiFileCsvFixture('primary'),
      'synthetic-age-primary.csv',
      'text/csv',
    );
    const ageAdditional = await uploadReferral(
      server,
      fixtures.current,
      canonicalMultiFileCsvFixture('additional'),
      'synthetic-age-additional.csv',
      'text/csv',
    );
    const ageResult = await extractReferral(
      server,
      fixtures.current,
      [agePrimary.upload_id, ageAdditional.upload_id],
    );
    assert.equal(ageResult.status, 409, ageResult.text);
    assert.equal(ageResult.body?.code, 'extracted_subject_under_13');
    assert.equal(Object.hasOwn(ageResult.body || {}, 'output'), false);
    assert.equal(fakeProvider.calls.length, 2);
    const ageIds = [agePrimary.upload_id, ageAdditional.upload_id];
    const ageRowsC1 = uploadRows(store.dbPath, ageIds);
    const ageArtifacts = [];
    for (const row of ageRowsC1) {
      assert.equal(row.lifecycle_state, 'expired');
      assert.equal(row.subject_age_band, 'under_13');
      const filePath = path.join(store.uploadsDir, row.stored_name);
      const markerPath = path.join(store.uploadsDir, `${row.id}.provider-block`);
      assert.equal(fs.existsSync(filePath), true);
      assert.equal(fs.statSync(markerPath).size, 0);
      ageArtifacts.push({ filePath, markerPath });
    }

    await server.stop();
    server = null;
    const forwardDatabaseHash = checkpointAndHashDatabase(store.dbPath);
    const interrupted = seedLegacyRegisteringCrash(store, fixtures.current);

    // Phase R: the exact compatibility posture migrates/reconciles the shared
    // store, accepts only the two legal versions and cannot reach a provider.
    server = await startPhase({
      store,
      fakeProvider,
      image: ROLLBACK_IMAGE,
      selftest: false,
      rollback: true,
    });
    const reconciliationDb = openDatabase(store.dbPath, { readOnly: true });
    try {
      const ddl = String(
        reconciliationDb.prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'upload_registry'",
        ).get()?.sql,
      );
      assert.match(ddl, /'registering'/);
      const interruptedRow = reconciliationDb.prepare(`
        SELECT lifecycle_state, original_name, deleted_at
        FROM upload_registry WHERE id = ?
      `).get(interrupted.id);
      assert.equal(interruptedRow.lifecycle_state, 'deleted');
      assert.equal(interruptedRow.original_name, '[deleted]');
      assert.equal(typeof interruptedRow.deleted_at, 'string');
      assert.equal(reconciliationDb.prepare(`
        SELECT COUNT(*) AS n FROM upload_audit
        WHERE upload_id = ? AND event_type = 'upload_registration_reconciled'
          AND outcome = 'removed'
      `).get(interrupted.id).n, 1);
    } finally {
      reconciliationDb.close();
    }
    for (const artifact of [interrupted.finalPath, interrupted.tempPath, interrupted.markerPath]) {
      assert.equal(fs.existsSync(artifact), false, artifact);
    }
    registeringProof = true;

    const ageRowsR = uploadRows(store.dbPath, ageIds);
    for (let index = 0; index < ageRowsR.length; index += 1) {
      assert.equal(ageRowsR[index].lifecycle_state, 'deleted');
      assert.equal(ageRowsR[index].subject_age_band, 'under_13');
      assert.equal(ageRowsR[index].original_name, '[deleted]');
      assert.equal(fs.existsSync(ageArtifacts[index].filePath), false);
      assert.equal(fs.existsSync(ageArtifacts[index].markerPath), false);
    }
    ageProof = true;
    assertSqliteIntegrity(store.dbPath);

    await assertLegalStatus(server, fixtures.current, 200);
    await assertLegalStatus(server, fixtures.superseded, 200);
    await assertLegalStatus(server, fixtures.unknown, 403);

    const targetFromRollback = await requestJson(
      server,
      route(server, `/entities/Client/${committed.body.client_id}`),
      { token: fixtures.current.user.token },
    );
    assert.equal(targetFromRollback.status, 200, targetFromRollback.text);
    assert.equal(targetFromRollback.body.org_id, fixtures.current.org.id);
    const crossTenant = await requestJson(
      server,
      route(server, `/entities/Client/${committed.body.client_id}`),
      { token: fixtures.superseded.user.token },
    );
    assert.equal(crossTenant.status, 404, crossTenant.text);

    const conditionsR = await requestJson(server, route(server, '/entities/ClientCondition'), {
      token: fixtures.current.user.token,
    });
    const documentsR = await requestJson(server, route(server, '/entities/ClientDocument'), {
      token: fixtures.current.user.token,
    });
    assert.equal(conditionsR.status, 200, conditionsR.text);
    assert.equal(documentsR.status, 200, documentsR.text);
    const targetConditions = conditionsR.body.filter(
      (row) => row.client_id === committed.body.client_id,
    );
    const targetDocuments = documentsR.body.filter(
      (row) => row.client_id === committed.body.client_id,
    );
    assert.equal(targetConditions.length, committed.body.counts.conditions_created);
    assert.equal(targetDocuments.length, 2);
    for (const row of [...targetConditions, ...targetDocuments]) {
      assert.equal(row.org_id, fixtures.current.org.id);
    }
    for (const [uploadId, expectedHash] of boundHashes) {
      await assertBoundFile(server, fixtures.current.user.token, uploadId, expectedHash);
    }

    const replayR = await commitReferral(server, fixtures.current, commitPayload);
    assert.equal(replayR.status, 200, replayR.text);
    assert.deepEqual(replayR.body, committed.body);
    const conflictR = await commitReferral(server, fixtures.current, {
      ...commitPayload,
      client: { ...commitPayload.client, phone: '+61 400 888 888' },
    });
    assert.equal(conflictR.status, 409, conflictR.text);
    assert.equal(conflictR.body?.code, 'idempotency_conflict');

    const rollbackWrite = await requestJson(
      server,
      route(server, `/entities/Client/${committed.body.client_id}`),
      {
        method: 'PUT',
        token: fixtures.current.user.token,
        body: { address: '39 Synthetic Rollback Street' },
      },
    );
    assert.equal(rollbackWrite.status, 200, rollbackWrite.text);
    assert.equal(rollbackWrite.body.address, '39 Synthetic Rollback Street');

    fakeProvider.reset();
    const beforeDisabled = databaseAndUploadSnapshot(store);
    const disabled = await requestJson(
      server,
      route(server, '/integration-endpoints/Core/ExtractDataFromUploadedFile'),
      {
        method: 'POST',
        token: fixtures.current.user.token,
        body: {
          upload_id: disabledProbe.upload_id,
          org_id: fixtures.current.org.id,
          json_schema: REFERRAL_EXTRACTION_SCHEMA,
          processing_authority_confirmed: true,
          processing_authority_attestation_version:
            REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
        },
      },
    );
    assert.equal(disabled.status, 503, disabled.text);
    assert.equal(disabled.body?.code, 'extraction_disabled', disabled.text);
    assert.notEqual(disabled.body?.status, 'success');
    assert.equal(fakeProvider.calls.length, 0);
    const afterDisabled = databaseAndUploadSnapshot(store);
    assert.deepEqual(afterDisabled, beforeDisabled, 'disabled rollback request mutated persistent state');

    await server.stop();
    server = null;
    const rollbackDatabaseHash = checkpointAndHashDatabase(store.dbPath);
    assert.notEqual(rollbackDatabaseHash, forwardDatabaseHash);

    // Phase C2: final forward runtime reads the rollback write and all prior
    // clinical/bound state, then performs and reads a fresh current write.
    server = await startPhase({
      store,
      fakeProvider,
      image: FORWARD_IMAGE,
      selftest: false,
    });
    await assertLegalStatus(server, fixtures.current, 200);
    await assertLegalStatus(server, fixtures.superseded, 403);
    await assertLegalStatus(server, fixtures.unknown, 403);

    const rollbackWriteRead = await requestJson(
      server,
      route(server, `/entities/Client/${committed.body.client_id}`),
      { token: fixtures.current.user.token },
    );
    assert.equal(rollbackWriteRead.status, 200, rollbackWriteRead.text);
    assert.equal(rollbackWriteRead.body.address, '39 Synthetic Rollback Street');
    assert.equal(rollbackWriteRead.body.org_id, fixtures.current.org.id);

    const replayC2 = await commitReferral(server, fixtures.current, commitPayload);
    assert.equal(replayC2.status, 200, replayC2.text);
    assert.deepEqual(replayC2.body, committed.body);
    const conflictC2 = await commitReferral(server, fixtures.current, {
      ...commitPayload,
      client: { ...commitPayload.client, phone: '+61 400 777 777' },
    });
    assert.equal(conflictC2.status, 409, conflictC2.text);
    assert.equal(conflictC2.body?.code, 'idempotency_conflict');

    const finalWrite = await requestJson(
      server,
      route(server, `/entities/Client/${committed.body.client_id}`),
      {
        method: 'PUT',
        token: fixtures.current.user.token,
        body: { phone: '+61 400 123 456' },
      },
    );
    assert.equal(finalWrite.status, 200, finalWrite.text);
    assert.equal(finalWrite.body.address, '39 Synthetic Rollback Street');
    assert.equal(finalWrite.body.phone, '+61 400 123 456');
    const finalRead = await requestJson(
      server,
      route(server, `/entities/Client/${committed.body.client_id}`),
      { token: fixtures.current.user.token },
    );
    assert.equal(finalRead.status, 200, finalRead.text);
    assert.equal(finalRead.body.address, '39 Synthetic Rollback Street');
    assert.equal(finalRead.body.phone, '+61 400 123 456');

    const finalConditions = await requestJson(server, route(server, '/entities/ClientCondition'), {
      token: fixtures.current.user.token,
    });
    const finalDocuments = await requestJson(server, route(server, '/entities/ClientDocument'), {
      token: fixtures.current.user.token,
    });
    assert.equal(
      finalConditions.body.filter((row) => row.client_id === committed.body.client_id).length,
      targetConditions.length,
    );
    assert.equal(
      finalDocuments.body.filter((row) => row.client_id === committed.body.client_id).length,
      2,
    );
    const boundRowsC2 = uploadRows(store.dbPath, [full.upload_id, additional.upload_id]);
    for (const row of boundRowsC2) {
      assert.equal(row.lifecycle_state, 'bound');
      assert.equal(row.org_id, fixtures.current.org.id);
      assert.equal(row.bound_entity_type, 'ClientDocument');
      assert.equal(hashFile(path.join(store.uploadsDir, row.stored_name)), boundHashes.get(row.id));
      assert.equal(row.sha256, boundHashes.get(row.id));
    }

    const receiptDb = openDatabase(store.dbPath, { readOnly: true });
    try {
      const receipts = receiptDb.prepare(`
        SELECT * FROM referral_commit_receipt WHERE idempotency_key = ?
      `).all(commitPayload.idempotency_key);
      assert.equal(receipts.length, 1);
      assert.match(receipts[0].request_sha256, /^[0-9a-f]{64}$/);
      assert.equal(receipts[0].actor_user_id, fixtures.current.user.id);
      assert.equal(receipts[0].org_id, fixtures.current.org.id);
      assert.equal(receipts[0].client_id, committed.body.client_id);
      assert.deepEqual(JSON.parse(receipts[0].result_json), committed.body);
    } finally {
      receiptDb.close();
    }
    receiptProof = true;
    assertSqliteIntegrity(store.dbPath);

    await server.stop();
    server = null;
    const finalDatabaseHash = checkpointAndHashDatabase(store.dbPath);
    assert.notEqual(finalDatabaseHash, rollbackDatabaseHash);
    assert.match(finalDatabaseHash, /^[0-9a-f]{64}$/);

    assert.equal(mergeProof, true);
    assert.equal(registeringProof, true);
    assert.equal(ageProof, true);
    assert.equal(receiptProof, true);
    console.log('ROLLBACK_PROOF_REGISTERING_STATE=PASS');
    console.log('ROLLBACK_PROOF_39_FIELD_PER_FILE_MERGE=PASS');
    console.log('ROLLBACK_PROOF_AGE_QUARANTINE=PASS');
    console.log('ROLLBACK_PROOF_REFERRAL_COMMIT_RECEIPT_REPLAY=PASS');
  } finally {
    if (server) await server.stop().catch(() => {});
    await fakeProvider.stop().catch(() => {});
    store.cleanup();
  }
});
