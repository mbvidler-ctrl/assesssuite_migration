import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { startFakeOpenAI } from './support/fake-openai.mjs';
import { resolveDocumentExtractionModel, validateExtractionOutput } from '../documentExtraction.mjs';
import {
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_SOURCE,
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
} from '../uploadRegistry.mjs';
import {
  REFERRAL_EXTRACTION_SCHEMA,
  REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS,
  REFERRAL_EXTRACTION_SCHEMA_SHA256,
} from '../../src/lib/referralExtractionSchema.js';
import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_SOURCE,
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
} from '../../src/lib/referralWorkflow.js';
import {
  CANONICAL_REFERRAL_PROFILE_A as PROFILE_A,
  CANONICAL_REFERRAL_PROFILE_DOB_CHANGE as PROFILE_DOB_CHANGE,
  CANONICAL_REFERRAL_PROFILE_FULL_39,
  CANONICAL_REFERRAL_PROFILE_MULTI_FORWARD,
  CANONICAL_REFERRAL_PROFILE_MULTI_REVERSED,
  CANONICAL_REFERRAL_PROFILE_UNDER_13,
  canonicalMultiFileCsvFixture,
  fullFieldReferralPdfFixture,
  csvFixture,
  pdfFixture,
  pngFixture,
} from './support/syntheticReferralFixtures.mjs';
import {
  NARROW_REFERRAL_ASSURANCE_SCHEMA,
} from './support/synthetic-fixtures.mjs';
import {
  activateUser,
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const EXTRACTION_ROUTE = '/integration-endpoints/Core/ExtractDataFromUploadedFile';
const UPLOAD_ROUTE = '/integration-endpoints/Core/UploadFile';
const CANCEL_ROUTE = '/integration-endpoints/Core/CancelTemporaryUploads';
const PROVIDER_KEY_CANARY = 'synthetic-provider-key-canary';
const PROVIDER_BODY_CANARY = 'FAKE_PROVIDER_PRIVATE_BODY_CANARY';
const REFERRAL_SCHEMA = REFERRAL_EXTRACTION_SCHEMA;

let fakeProvider;
let server;
let adminToken;
let tenantA;
let tenantB;
let userA;
let userB;
let colleagueA;

function appRoute(suffix) {
  return `/api/apps/${server.appId}${suffix}`;
}

async function acceptCurrentNotices(user, orgId) {
  const result = await requestJson(
    server,
    appRoute('/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
    { method: 'POST', token: user.token, body: { org_id: orgId, marketing_opt_in: false } },
  );
  assert.equal(result.status, 200, result.text);
}

async function createUserInOrg(email, org, role = 'clinician') {
  const user = await registerUser(server, email);
  await activateUser(server, adminToken, user.id);
  const membership = await requestJson(server, appRoute('/entities/OrganizationMember'), {
    method: 'POST',
    token: adminToken,
    body: { org_id: org.id, user_email: user.email, role, is_primary: true },
  });
  assert.equal(membership.status, 200, membership.text);
  await acceptCurrentNotices(user, org.id);
  return user;
}

async function upload(user, orgId, {
  bytes,
  filename,
  mediaType,
  purpose = 'referral-extraction',
  includeOrg = true,
  subjectDateOfBirth,
  subjectAgeConfirmation,
  subjectAgeAttestationVersion,
  subjectAgeAttestationSource,
  processingAuthorityConfirmed,
  processingAuthorityAttestationVersion,
  processingAuthorityAttestationSource,
} = {}) {
  const form = new FormData();
  if (includeOrg && orgId !== undefined) form.set('org_id', orgId);
  form.set('purpose', purpose);
  if (
    purpose === 'referral-extraction' &&
    subjectDateOfBirth === undefined &&
    subjectAgeConfirmation === undefined &&
    subjectAgeAttestationVersion === undefined
  ) {
    subjectAgeConfirmation = REFERRAL_SUBJECT_AGE_CONFIRMATION;
    subjectAgeAttestationVersion = REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION;
  } else if (
    purpose === 'referral-extraction' &&
    typeof subjectAgeConfirmation === 'string' &&
    subjectAgeAttestationVersion === undefined
  ) {
    subjectAgeAttestationVersion = REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION;
  }
  if (typeof subjectDateOfBirth === 'string') form.set('subject_date_of_birth', subjectDateOfBirth);
  if (typeof subjectAgeConfirmation === 'string') form.set('subject_age_confirmation', subjectAgeConfirmation);
  if (typeof subjectAgeAttestationVersion === 'string') {
    form.set('subject_age_attestation_version', subjectAgeAttestationVersion);
  }
  if (typeof subjectAgeAttestationSource === 'string') {
    form.set('subject_age_attestation_source', subjectAgeAttestationSource);
  }
  if (
    purpose === 'referral-extraction' &&
    processingAuthorityConfirmed === undefined &&
    processingAuthorityAttestationVersion === undefined &&
    processingAuthorityAttestationSource === undefined
  ) {
    processingAuthorityConfirmed = true;
    processingAuthorityAttestationVersion = REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION;
  }
  if (processingAuthorityConfirmed !== undefined && processingAuthorityConfirmed !== null) {
    form.set('processing_authority_confirmed', String(processingAuthorityConfirmed));
  }
  if (typeof processingAuthorityAttestationVersion === 'string') {
    form.set('processing_authority_attestation_version', processingAuthorityAttestationVersion);
  }
  if (typeof processingAuthorityAttestationSource === 'string') {
    form.set('processing_authority_attestation_source', processingAuthorityAttestationSource);
  }
  form.set('file', new File([bytes], filename, { type: mediaType }));
  const response = await fetch(`${server.baseUrl}${appRoute(UPLOAD_ROUTE)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, 'X-App-Id': server.appId },
    body: form,
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* leave binary/malformed text alone */ }
  return { status: response.status, response, body, text };
}

async function extract(user, body, token = user?.token) {
  return requestJson(server, appRoute(EXTRACTION_ROUTE), {
    method: 'POST', token, body: {
      processing_authority_confirmed: true,
      processing_authority_attestation_version: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
      ...body,
    },
  });
}

async function expectUploaded(result) {
  assert.equal(result.status, 200, result.text);
  assert.equal(typeof result.body?.upload_id, 'string');
  assert.equal(result.body?.file_url, `/uploads/${result.body.upload_id}`);
  return result.body;
}

async function uploadReferral(user, orgId, bytes, filename, mediaType) {
  return expectUploaded(await upload(user, orgId, { bytes, filename, mediaType }));
}

function assertSuccess(result, expected) {
  assert.equal(result.status, 200, result.text);
  assert.deepEqual(Object.keys(result.body).sort(), ['output', 'status']);
  assert.equal(result.body.status, 'success');
  assert.deepEqual(result.body.output, expected);
}

async function assertRealTranscriptionUsesRegisteredStoredName(audio, expectedBytes) {
  const uploadRow = getUploadRow(audio.upload_id);
  assert.match(uploadRow.stored_name, new RegExp(`^${audio.upload_id}\\.wav$`, 'i'));

  const environmentKeys = ['OPENAI_API_KEY', 'SELFTEST', 'TRANSCRIPTION_ENABLED', 'UPLOADS_DIR'];
  const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  let providerRequest = null;
  try {
    process.env.OPENAI_API_KEY = 'synthetic-transcription-provider-key';
    delete process.env.SELFTEST;
    process.env.TRANSCRIPTION_ENABLED = '1';
    process.env.UPLOADS_DIR = server.uploadsDir;

    globalThis.fetch = async (url, options = {}) => {
      providerRequest = { url: String(url), options };
      return new Response(JSON.stringify({ text: 'Synthetic registered audio transcript.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const moduleUrl = pathToFileURL(path.join(repoRoot, 'server', 'functions', 'transcribeSession.mjs'));
    moduleUrl.searchParams.set('assurance', `${Date.now()}-${audio.upload_id}`);
    const transcriptionModule = await import(moduleUrl.href);
    transcriptionModule.configureUploadResolver(({ audioUrl, user, orgId }) => {
      assert.equal(audioUrl, audio.file_url);
      assert.equal(user.id, userA.id);
      assert.equal(orgId, tenantA.id);
      return path.join(server.uploadsDir, uploadRow.stored_name);
    });

    const result = await transcriptionModule.default({
      body: { action: 'transcribe', audio_url: audio.file_url, org_id: tenantA.id },
      user: { id: userA.id, email: userA.email },
      respond: (status, body) => ({ status, body }),
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.match(result.body.transcript, /Synthetic registered audio transcript/);
    assert.equal(providerRequest?.url, 'https://api.openai.com/v1/audio/transcriptions');
    assert.equal(providerRequest?.options?.headers?.Authorization, 'Bearer synthetic-transcription-provider-key');
    const submittedFile = providerRequest?.options?.body?.get('file');
    assert.equal(submittedFile?.name, uploadRow.stored_name);
    assert.deepEqual(Buffer.from(await submittedFile.arrayBuffer()), Buffer.from(expectedBytes));
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of environmentKeys) {
      if (originalEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    }
  }
}

function assertControlledFailure(result) {
  assert.notEqual(result.body?.status, 'success', result.text);
  if (result.body?.status === 'error') {
    assert.deepEqual(
      Object.keys(result.body).sort(),
      ['code', 'details', 'diagnostic_reference', 'stage', 'status'],
    );
    assert.match(result.body.code, /^[a-z0-9_]{1,80}$/);
    assert.match(result.body.diagnostic_reference, /^[0-9a-f-]{36}$/i);
    assert.match(result.body.stage, /^[a-z0-9_]{1,48}$/);
    assert.equal(typeof result.body.details, 'string');
    assert.ok(result.body.details.length > 0);
  } else {
    assert.ok(result.status >= 400, `expected failure status/body, received ${result.status} ${result.text}`);
  }
}

function openAssuranceDb() {
  assert.equal(typeof server?.dbPath, 'string');
  return new DatabaseSync(server.dbPath);
}

function makeLegalReceiptStale(user, orgId, documentId) {
  const db = openAssuranceDb();
  try {
    const rows = db.prepare('SELECT id, data FROM entity_LegalAcceptanceEvent').all();
    const update = db.prepare('UPDATE entity_LegalAcceptanceEvent SET data = ? WHERE id = ?');
    let changed = 0;
    for (const row of rows) {
      const receipt = JSON.parse(row.data);
      if (
        receipt.user_email === user.email &&
        receipt.org_id === orgId &&
        receipt.document_id === documentId
      ) {
        receipt.document_fingerprint = `sha256-${'0'.repeat(64)}`;
        changed += Number(update.run(JSON.stringify(receipt), row.id).changes);
      }
    }
    assert.ok(changed >= 1, `expected a ${documentId} receipt to make stale`);
  } finally {
    db.close();
  }
}

function setUploadState(uploadId, state, { expiresAt } = {}) {
  const db = openAssuranceDb();
  try {
    const assignments = ['lifecycle_state = ?'];
    const values = [state];
    if (expiresAt !== undefined) {
      assignments.push('expires_at = ?');
      values.push(expiresAt);
    }
    values.push(uploadId);
    db.prepare(`UPDATE upload_registry SET ${assignments.join(', ')} WHERE id = ?`).run(...values);
  } finally {
    db.close();
  }
}

function getUploadRow(uploadId) {
  const db = openAssuranceDb();
  try {
    return db.prepare('SELECT * FROM upload_registry WHERE id = ?').get(uploadId);
  } finally {
    db.close();
  }
}

function uploadRegistryCount() {
  const db = openAssuranceDb();
  try {
    return Number(db.prepare('SELECT COUNT(*) AS count FROM upload_registry').get().count);
  } finally {
    db.close();
  }
}

function latestExtractionUsage(userId) {
  const db = openAssuranceDb();
  try {
    return db.prepare(`
      SELECT status, upload_count, actual_cost_microusd
      FROM extraction_usage
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(userId);
  } finally {
    db.close();
  }
}

function persistenceSnapshot() {
  const db = openAssuranceDb();
  try {
    return {
      uploadRows: Number(db.prepare('SELECT COUNT(*) AS count FROM upload_registry').get().count),
      auditRows: Number(db.prepare('SELECT COUNT(*) AS count FROM upload_audit').get().count),
      extractionUsageRows: Number(db.prepare('SELECT COUNT(*) AS count FROM extraction_usage').get().count),
      storedFiles: fs.readdirSync(server.uploadsDir).sort(),
    };
  } finally {
    db.close();
  }
}

function uploadExtractionWriteSnapshot(uploadId) {
  const db = openAssuranceDb();
  try {
    return {
      upload: db.prepare('SELECT * FROM upload_registry WHERE id = ?').get(uploadId),
      auditRows: Number(
        db.prepare('SELECT COUNT(*) AS count FROM upload_audit WHERE upload_id = ?').get(uploadId).count,
      ),
      extractionUsageRows: Number(db.prepare('SELECT COUNT(*) AS count FROM extraction_usage').get().count),
      storedFiles: fs.readdirSync(server.uploadsDir).sort(),
    };
  } finally {
    db.close();
  }
}

function wavFixture() {
  const dataBytes = 1600;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write('WAVEfmt ', 8, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataBytes, 40);
  return wav;
}

before(async () => {
  fakeProvider = await startFakeOpenAI();
  server = await startTestServer({
    DOCUMENT_EXTRACTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_TEST_BASE_URL: fakeProvider.baseUrl,
    DOCUMENT_EXTRACTION_TEST_TIMEOUT_MS: '150',
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
  });
  adminToken = await loginAdmin(server);

  userA = await registerUser(server, 'synthetic-tenant-a@example.test');
  await activateUser(server, adminToken, userA.id);
  tenantA = await createOrganizationForUser(server, adminToken, userA);
  await acceptCurrentNotices(userA, tenantA.id);

  userB = await registerUser(server, 'synthetic-tenant-b@example.test');
  await activateUser(server, adminToken, userB.id);
  tenantB = await createOrganizationForUser(server, adminToken, userB);
  await acceptCurrentNotices(userB, tenantB.id);

  colleagueA = await createUserInOrg('synthetic-colleague-a@example.test', tenantA);
});

after(async () => {
  if (server) await server.stop();
  if (fakeProvider) await fakeProvider.stop();
});

test('E01 known PDF fixture extracts the expected referral values', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'known-referral.pdf', 'application/pdf');
  const result = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assertSuccess(result, PROFILE_A);
  assert.equal(fakeProvider.calls.at(-1)?.store, false);
  assert.equal(fakeProvider.calls.at(-1)?.hasTools, false);
  assert.equal(fakeProvider.calls.at(-1)?.background, false);
  assert.equal(fakeProvider.calls.at(-1)?.promptCacheRetention, 'in_memory');
  assert.equal(fakeProvider.calls.at(-1)?.route, '/v1/responses');
  assert.equal(fakeProvider.calls.at(-1)?.schemaPropertyCount, 39);
  assert.deepEqual(fakeProvider.calls.at(-1)?.schemaPropertyNames, REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS);
  assert.deepEqual(fakeProvider.calls.at(-1)?.schemaRequired, REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS);
  assert.equal(fakeProvider.calls.at(-1)?.schemaAdditionalProperties, false);
});

test('E02 known PNG fixture extracts the expected referral values', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, pngFixture(), 'known-referral.png', 'image/png');
  const result = await extract(userA, { file_url: uploadRef.file_url, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assertSuccess(result, PROFILE_A);
  assert.match(fakeProvider.calls.at(-1)?.input || '', /ASSURANCE_PROFILE_A/);
});

test('E03 known CSV fixture uses the bounded parsed-text path and extracts expected values', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, csvFixture(), 'known-referral.csv', 'text/csv');
  const result = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assertSuccess(result, PROFILE_A);
  assert.match(fakeProvider.calls.at(-1)?.input || '', /ASSURANCE_PROFILE_A/);
});

test('E04 missing source fields remain absent or null and are never fabricated', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('missing-fields');
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'missing-fields.pdf', 'application/pdf');
  const result = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body?.status, 'success');
  assert.equal(Object.hasOwn(result.body.output, 'date_of_birth'), false);
  assert.equal(Object.hasOwn(result.body.output, 'referral_source_name'), false);
  assert.equal(Object.hasOwn(result.body.output, 'phone'), false);
  assert.deepEqual(result.body.output.comorbidities, []);
  assert.doesNotMatch(JSON.stringify(result.body.output), /mock|placeholder|example patient/i);
});

test('E05 dates, enums, arrays, required fields, and scalar types satisfy the submitted schema', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'schema-types.pdf', 'application/pdf');
  const result = await extract(userA, {
    upload_id: uploadRef.upload_id,
    org_id: tenantA.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assertSuccess(result, PROFILE_A);
  assert.match(result.body.output.date_of_birth, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(result.body.output.referral_source, 'gp');
  assert.ok(Array.isArray(result.body.output.comorbidities));
  assert.equal(typeof result.body.output.full_name, 'string');
});

test('E05a date format rejects impossible calendar dates instead of normalising them', () => {
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: { date: { type: 'string', format: 'date' } },
    required: ['date'],
  };
  assert.throws(() => validateExtractionOutput({ date: '2026-02-31' }, schema), /reliably/);
  assert.deepEqual(validateExtractionOutput({ date: '2024-02-29' }, schema), { date: '2024-02-29' });
});

test('E05b generic clinical extraction remains release-disabled even when the provider feature flag is enabled', async () => {
  const isolated = await startTestServer({
    DOCUMENT_EXTRACTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_UNDER_13_ENABLED: '1',
    DOCUMENT_EXTRACTION_TEST_BASE_URL: fakeProvider.baseUrl,
    OPENAI_API_KEY: PROVIDER_KEY_CANARY,
    OPENAI_DOCUMENT_EXTRACTION_MODEL: 'synthetic-assurance-model',
  });
  const isolatedRoute = (suffix) => `/api/apps/${isolated.appId}${suffix}`;
  try {
    const isolatedAdmin = await loginAdmin(isolated);
    const isolatedUser = await registerUser(isolated, 'generic-extraction@synthetic.test');
    await activateUser(isolated, isolatedAdmin, isolatedUser.id);
    const isolatedOrg = await createOrganizationForUser(isolated, isolatedAdmin, isolatedUser);
    const acceptance = await requestJson(
      isolated,
      isolatedRoute('/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
      {
        method: 'POST',
        token: isolatedUser.token,
        body: { org_id: isolatedOrg.id, marketing_opt_in: false },
      },
    );
    assert.equal(acceptance.status, 200, acceptance.text);

    const form = new FormData();
    form.set('org_id', isolatedOrg.id);
    form.set('purpose', 'clinical-attachment');
    form.set('file', new File([pdfFixture()], 'generic-clinical-extraction.pdf', { type: 'application/pdf' }));
    const uploadResponse = await fetch(
      `${isolated.baseUrl}${isolatedRoute(UPLOAD_ROUTE)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${isolatedUser.token}`, 'X-App-Id': isolated.appId },
        body: form,
      },
    );
    const uploadText = await uploadResponse.text();
    const uploadBody = JSON.parse(uploadText);
    assert.equal(uploadResponse.status, 200, uploadText);

    const base = {
      upload_id: uploadBody.upload_id,
      org_id: isolatedOrg.id,
      json_schema: NARROW_REFERRAL_ASSURANCE_SCHEMA,
    };
    fakeProvider.reset();
    const missingAuthority = await requestJson(
      isolated,
      isolatedRoute(EXTRACTION_ROUTE),
      { method: 'POST', token: isolatedUser.token, body: base },
    );
    assert.equal(missingAuthority.status, 403, missingAuthority.text);
    assert.equal(missingAuthority.body?.code, 'processing_authority_required');
    assert.equal(fakeProvider.calls.length, 0);

    const result = await requestJson(
      isolated,
      isolatedRoute(EXTRACTION_ROUTE),
      {
        method: 'POST',
        token: isolatedUser.token,
        body: { ...base, processing_authority_confirmed: true },
      },
    );
    assert.equal(result.status, 403, result.text);
    assert.equal(result.body?.code, 'generic_extraction_disabled');
    assert.equal(fakeProvider.calls.length, 0, 'generic clinical bytes must never reach the provider');
  } finally {
    fakeProvider.reset();
    await isolated.stop();
  }
});

test('E05c the adapter preserves every grounded field from the format-faithful 39-field referral', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(
    colleagueA,
    tenantA.id,
    fullFieldReferralPdfFixture(),
    'synthetic-full-field-referral.pdf',
    'application/pdf',
  );
  const result = await extract(colleagueA, {
    upload_id: uploadRef.upload_id,
    org_id: tenantA.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assertSuccess(result, CANONICAL_REFERRAL_PROFILE_FULL_39);
  assert.deepEqual(Object.keys(result.body.output), REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS);
  assert.equal(fakeProvider.calls.length, 1);
  assert.match(fakeProvider.calls[0].input, /ASSURANCE_PROFILE_FULL_39/);
});

test('E06 multi-file merge is application-owned: primary wins, empty fields fill, and arrays de-duplicate stably', async () => {
  fakeProvider.reset();
  const primary = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('primary'),
    'merge-primary.csv',
    'text/csv',
  );
  const additional = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('additional'),
    'merge-additional.csv',
    'text/csv',
  );
  const result = await extract(colleagueA, {
    file_urls: [primary.file_url, additional.file_url], org_id: tenantA.id, json_schema: REFERRAL_SCHEMA,
  });
  assertSuccess(result, CANONICAL_REFERRAL_PROFILE_MULTI_FORWARD);
  assert.equal(fakeProvider.calls.length, 2, 'each file must be extracted independently before local merge');
  assert.equal(fakeProvider.calls[0].input.includes('ASSURANCE_CANONICAL_MULTI_ADDITIONAL'), false);
  assert.equal(fakeProvider.calls[1].input.includes('ASSURANCE_CANONICAL_MULTI_PRIMARY'), false);
  const usage = latestExtractionUsage(colleagueA.id);
  assert.equal(usage?.status, 'succeeded');
  assert.equal(usage?.upload_count, 2);
  assert.equal(usage?.actual_cost_microusd, 176);
});

test('E06a reversing selected documents reverses scalar precedence and preserves ordered array union', async () => {
  fakeProvider.reset();
  const primary = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('primary'),
    'reverse-primary.csv',
    'text/csv',
  );
  const additional = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('additional'),
    'reverse-additional.csv',
    'text/csv',
  );
  const result = await extract(colleagueA, {
    file_urls: [additional.file_url, primary.file_url], org_id: tenantA.id, json_schema: REFERRAL_SCHEMA,
  });
  assertSuccess(result, CANONICAL_REFERRAL_PROFILE_MULTI_REVERSED);
  assert.equal(fakeProvider.calls.length, 2);
});

test('E06b a later per-file provider failure rejects the whole selected set without a partial result', async () => {
  fakeProvider.reset();
  fakeProvider.setModeSequence(['semantic', 'provider-500']);
  const primary = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('primary'),
    'partial-primary.csv',
    'text/csv',
  );
  const additional = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('additional'),
    'partial-additional.csv',
    'text/csv',
  );
  const result = await extract(colleagueA, {
    file_urls: [primary.file_url, additional.file_url], org_id: tenantA.id, json_schema: REFERRAL_SCHEMA,
  });
  assertControlledFailure(result);
  assert.equal(result.body?.code, 'provider_error');
  assert.equal(fakeProvider.calls.length, 2, 'the failure must occur after an independently successful primary extraction');
  assert.equal(getUploadRow(primary.upload_id)?.lifecycle_state, 'temporary');
  assert.equal(getUploadRow(additional.upload_id)?.lifecycle_state, 'temporary');
  assert.equal(latestExtractionUsage(colleagueA.id)?.status, 'failed');
});

test('E06c every selected file is locally preflighted before the first provider request', async () => {
  fakeProvider.reset();
  const primary = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('primary'),
    'preflight-primary.csv',
    'text/csv',
  );
  const malformed = await uploadReferral(
    colleagueA,
    tenantA.id,
    Buffer.from('fixture_id,full_name\n"unterminated,Alex River\n', 'utf8'),
    'preflight-malformed.csv',
    'text/csv',
  );
  const result = await extract(colleagueA, {
    file_urls: [primary.file_url, malformed.file_url], org_id: tenantA.id, json_schema: REFERRAL_SCHEMA,
  });
  assertControlledFailure(result);
  assert.equal(result.body?.code, 'invalid_csv');
  assert.equal(fakeProvider.calls.length, 0, 'malformed later bytes must block all provider transmission');
  assert.equal(getUploadRow(primary.upload_id)?.lifecycle_state, 'temporary');
  assert.equal(getUploadRow(malformed.upload_id)?.lifecycle_state, 'temporary');
  assert.equal(latestExtractionUsage(colleagueA.id)?.status, 'failed');
});

test('E06d an under-13 DOB in any independently extracted file blocks and quarantines the whole set', async () => {
  fakeProvider.reset();
  fakeProvider.setModeSequence(['semantic', 'under-13']);
  const primary = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('primary'),
    'age-primary.csv',
    'text/csv',
  );
  const additional = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('additional'),
    'age-additional.csv',
    'text/csv',
  );
  const result = await extract(colleagueA, {
    file_urls: [primary.file_url, additional.file_url], org_id: tenantA.id, json_schema: REFERRAL_SCHEMA,
  });
  assertControlledFailure(result);
  assert.equal(result.status, 409);
  assert.equal(result.body?.code, 'extracted_subject_under_13');
  assert.equal(Object.hasOwn(result.body || {}, 'output'), false);
  assert.equal(fakeProvider.calls.length, 2);
  for (const uploadId of [primary.upload_id, additional.upload_id]) {
    const row = getUploadRow(uploadId);
    assert.equal(row?.lifecycle_state, 'expired');
    assert.equal(row?.subject_age_band, 'under_13');
  }
  assert.equal(latestExtractionUsage(colleagueA.id)?.status, 'failed');
});

test('E06e aliases resolving to one upload are rejected before every extraction side effect', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('primary'),
    'duplicate-alias-primary.csv',
    'text/csv',
  );
  const storedName = getUploadRow(uploadRef.upload_id)?.stored_name;
  assert.equal(typeof storedName, 'string');
  const before = uploadExtractionWriteSnapshot(uploadRef.upload_id);
  const aliasSets = [
    [uploadRef.file_url, uploadRef.upload_id],
    [uploadRef.file_url, `/api/files/${uploadRef.upload_id}`],
    [uploadRef.file_url, `/uploads/${storedName}`],
  ];

  for (const fileUrls of aliasSets) {
    const result = await extract(colleagueA, {
      file_urls: fileUrls,
      org_id: tenantA.id,
      json_schema: REFERRAL_SCHEMA,
    });
    assertControlledFailure(result);
    assert.equal(result.status, 400, result.text);
    assert.equal(result.body?.code, 'duplicate_file_reference');
    assert.equal(fakeProvider.calls.length, 0);
    assert.deepEqual(uploadExtractionWriteSnapshot(uploadRef.upload_id), before);
  }
});

test('E07 same filename with changed bytes produces the corresponding changed output', async () => {
  fakeProvider.reset();
  const original = await uploadReferral(userA, tenantA.id, csvFixture(), 'same-name.csv', 'text/csv');
  const changed = await uploadReferral(userA, tenantA.id, csvFixture('referral-primary-dob-change.csv'), 'same-name.csv', 'text/csv');
  const first = await extract(userA, { upload_id: original.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  const second = await extract(userA, { upload_id: changed.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assertSuccess(first, PROFILE_A);
  assertSuccess(second, PROFILE_DOB_CHANGE);
  assert.notDeepEqual(first.body.output, second.body.output);
});

test('E08 same bytes under a different filename produce semantically equivalent output', async () => {
  fakeProvider.reset();
  const bytes = pdfFixture();
  const first = await uploadReferral(userA, tenantA.id, bytes, 'first-name.pdf', 'application/pdf');
  const second = await uploadReferral(userA, tenantA.id, bytes, 'different-name.pdf', 'application/pdf');
  const firstResult = await extract(userA, { upload_id: first.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  const secondResult = await extract(userA, { upload_id: second.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assertSuccess(firstResult, PROFILE_A);
  assertSuccess(secondResult, PROFILE_A);
  assert.notEqual(first.upload_id, second.upload_id);
});

test('E09 a one-field fixture change alters only the corresponding semantic field', async () => {
  fakeProvider.reset();
  const original = await uploadReferral(userA, tenantA.id, csvFixture(), 'field-a.csv', 'text/csv');
  const changed = await uploadReferral(userA, tenantA.id, csvFixture('referral-primary-dob-change.csv'), 'field-b.csv', 'text/csv');
  const a = await extract(userA, { upload_id: original.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  const b = await extract(userA, { upload_id: changed.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  const changedKeys = Object.keys(a.body.output).filter((key) => JSON.stringify(a.body.output[key]) !== JSON.stringify(b.body.output[key]));
  assert.deepEqual(changedKeys, ['date_of_birth']);
});

test('E10 missing file reference fails closed before any provider call', async () => {
  fakeProvider.reset();
  const result = await extract(userA, { org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assertControlledFailure(result);
  assert.equal(fakeProvider.calls.length, 0);
});

test('E11 missing, malformed, oversized, and over-deep schemas fail closed', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'bad-schema.pdf', 'application/pdf');
  let deepSchema = { type: 'string' };
  for (let depth = 0; depth < 10; depth += 1) deepSchema = { type: 'object', properties: { nested: deepSchema } };
  const cases = [
    { upload_id: uploadRef.upload_id, org_id: tenantA.id },
    { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: 'not-an-object' },
    { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: { type: 'object', description: 'x'.repeat(34 * 1024) } },
    { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: deepSchema },
  ];
  for (const body of cases) {
    const result = await extract(userA, body);
    assertControlledFailure(result);
  }
  assert.equal(fakeProvider.calls.length, 0);
});

test('E12 unknown, deleted, and expired uploads fail closed', async () => {
  fakeProvider.reset();
  const deleted = await uploadReferral(userA, tenantA.id, pdfFixture(), 'deleted.pdf', 'application/pdf');
  const expired = await uploadReferral(userA, tenantA.id, pdfFixture(), 'expired.pdf', 'application/pdf');
  setUploadState(deleted.upload_id, 'deleted');
  setUploadState(expired.upload_id, 'expired', { expiresAt: new Date(0).toISOString() });
  const ids = ['00000000-0000-4000-8000-000000000000', deleted.upload_id, expired.upload_id];
  const shapes = [];
  for (const upload_id of ids) {
    const result = await extract(userA, { upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
    assert.equal(result.status, 404, result.text);
    assert.match(result.body.diagnostic_reference, /^[0-9a-f-]{36}$/i);
    const indistinguishableShape = { ...result.body };
    delete indistinguishableShape.diagnostic_reference;
    shapes.push(indistinguishableShape);
  }
  assert.deepEqual(shapes[1], shapes[0]);
  assert.deepEqual(shapes[2], shapes[0]);
  assert.equal(fakeProvider.calls.length, 0);
});

test('E13 external, absolute, loopback, and metadata-service URLs fail closed', async () => {
  fakeProvider.reset();
  const references = [
    'https://example.test/referral.pdf',
    'file:///etc/passwd',
    'http://127.0.0.1/private',
    'http://169.254.169.254/latest/meta-data',
    '//example.test/referral.pdf',
  ];
  for (const file_url of references) {
    const result = await extract(userA, { file_url, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
    assertControlledFailure(result);
  }
  assert.equal(fakeProvider.calls.length, 0);
});

test('E14 unsupported or mismatched extension, media type, and file signature fail closed', async () => {
  const cases = [
    { bytes: pngFixture(), filename: 'mismatch.pdf', mediaType: 'application/pdf' },
    { bytes: Buffer.from('<script>alert(1)</script>'), filename: 'active.html', mediaType: 'text/html' },
    { bytes: Buffer.from('not a png'), filename: 'bad.png', mediaType: 'image/png' },
    { bytes: pdfFixture(), filename: 'wrong.txt', mediaType: 'text/plain' },
  ];
  for (const fixture of cases) {
    const result = await upload(userA, tenantA.id, fixture);
    assert.equal(result.status, 415, result.text);
  }
});

test('E15 oversized request/file is rejected while the server remains responsive', async () => {
  const priorFiles = fs.readdirSync(server.uploadsDir).length;
  const result = await upload(userA, tenantA.id, {
    bytes: Buffer.alloc(11 * 1024 * 1024, 65), filename: 'oversized.pdf', mediaType: 'application/pdf',
  });
  assert.equal(result.status, 413, result.text);
  const health = await fetch(`${server.baseUrl}/api/apps/public/prod/public-settings/by-id/post-oversize`);
  assert.equal(health.status, 200);
  assert.equal(fs.readdirSync(server.uploadsDir).length, priorFiles);
});

test('E16 provider timeout fails closed with a sanitised response', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('timeout');
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'timeout.pdf', 'application/pdf');
  const result = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assert.equal(result.status, 504, result.text);
  assertControlledFailure(result);
  assert.doesNotMatch(result.text, /AbortError|127\.0\.0\.1|stack|timeout\.pdf/i);
});

test('E17 provider 4xx/5xx fails closed without leaking the provider body', async () => {
  for (const mode of ['provider-400', 'provider-500']) {
    fakeProvider.reset();
    fakeProvider.setMode(mode);
    const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), `${mode}.pdf`, 'application/pdf');
    const result = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
    assert.equal(result.status, 502, result.text);
    assertControlledFailure(result);
    assert.doesNotMatch(result.text, new RegExp(PROVIDER_BODY_CANARY));
  }
});

test('E18 empty, placeholder, malformed, refusal, and schema-invalid provider output fails closed', async () => {
  for (const mode of ['empty', 'placeholder', 'malformed', 'refusal', 'schema-invalid']) {
    fakeProvider.reset();
    fakeProvider.setMode(mode);
    const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), `${mode}.pdf`, 'application/pdf');
    const result = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
    assertControlledFailure(result);
    assert.doesNotMatch(result.text, /Mock Patient|placeholder|\{not-json/i);
  }
});

test('E18a exact missing-value sentinels normalize to empty values without weakening mock-marker rejection', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('missing-value-sentinels');
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'missing-value-sentinels.pdf', 'application/pdf');
  const result = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assert.equal(result.status, 200, result.text);
  assert.deepEqual(result.body.output, {
    full_name: 'Alex River', comorbidities: [],
  });

  fakeProvider.reset();
  fakeProvider.setMode('placeholder');
  const placeholderRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'mock-marker-still-rejected.pdf', 'application/pdf');
  const placeholder = await extract(userA, { upload_id: placeholderRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assertControlledFailure(placeholder);
});

test('E19 anonymous upload returns 401 and creates no stored file', async () => {
  const beforeFiles = fs.readdirSync(server.uploadsDir).length;
  const form = new FormData();
  form.set('org_id', tenantA.id);
  form.set('purpose', 'referral-extraction');
  form.set('file', new File([pdfFixture()], 'anonymous.pdf', { type: 'application/pdf' }));
  const response = await fetch(`${server.baseUrl}${appRoute(UPLOAD_ROUTE)}`, {
    method: 'POST', headers: { 'X-App-Id': server.appId }, body: form,
  });
  assert.equal(response.status, 401);
  assert.equal(fs.readdirSync(server.uploadsDir).length, beforeFiles);
});

test('E20 anonymous extraction returns 401 before provider access', async () => {
  fakeProvider.reset();
  const result = await extract(null, {
    upload_id: '00000000-0000-4000-8000-000000000000', org_id: tenantA.id, json_schema: REFERRAL_SCHEMA,
  }, undefined);
  assert.equal(result.status, 401, result.text);
  assert.equal(fakeProvider.calls.length, 0);
});

test('E21 anonymous clinical-file retrieval returns 401 or indistinguishable 404', async () => {
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'anonymous-download.pdf', 'application/pdf');
  for (const route of [`/api/files/${uploadRef.upload_id}`, uploadRef.file_url]) {
    const response = await fetch(`${server.baseUrl}${route}`);
    assert.ok(response.status === 401 || response.status === 404, `${route}: ${response.status}`);
    assert.equal((await response.arrayBuffer()).byteLength === pdfFixture().length, false);
  }
});

test('E22 cross-tenant extraction returns the same 404 as an unknown upload', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'cross-extract.pdf', 'application/pdf');
  const cross = await extract(userB, { upload_id: uploadRef.upload_id, org_id: tenantB.id, json_schema: REFERRAL_SCHEMA });
  const unknown = await extract(userB, {
    upload_id: '00000000-0000-4000-8000-000000000000', org_id: tenantB.id, json_schema: REFERRAL_SCHEMA,
  });
  assert.equal(cross.status, 404, cross.text);
  assert.equal(unknown.status, 404, unknown.text);
  assert.match(cross.body.diagnostic_reference, /^[0-9a-f-]{36}$/i);
  assert.match(unknown.body.diagnostic_reference, /^[0-9a-f-]{36}$/i);
  const crossBody = { ...cross.body };
  const unknownBody = { ...unknown.body };
  delete crossBody.diagnostic_reference;
  delete unknownBody.diagnostic_reference;
  assert.deepEqual({ status: cross.status, body: crossBody }, { status: unknown.status, body: unknownBody });
  assert.equal(fakeProvider.calls.length, 0);
});

test('E23 cross-tenant download returns the same 404 as an unknown upload', async () => {
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'cross-download.pdf', 'application/pdf');
  const headers = { Authorization: `Bearer ${userB.token}` };
  const cross = await fetch(`${server.baseUrl}/api/files/${uploadRef.upload_id}`, { headers });
  const unknown = await fetch(`${server.baseUrl}/api/files/00000000-0000-4000-8000-000000000000`, { headers });
  assert.equal(cross.status, 404);
  assert.equal(unknown.status, 404);
  assert.equal(await cross.text(), await unknown.text());
});

test('E24 authorised same-tenant colleague can access a permitted bound clinical document', async () => {
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'bound-colleague.pdf', 'application/pdf');
  const client = await requestJson(server, appRoute('/entities/Client'), {
    method: 'POST', token: userA.token, body: { org_id: tenantA.id, full_name: 'Synthetic Binding Client' },
  });
  assert.equal(client.status, 200, client.text);
  const document = await requestJson(server, appRoute('/entities/ClientDocument'), {
    method: 'POST',
    token: userA.token,
    body: { org_id: tenantA.id, client_id: client.body.id, name: 'Synthetic referral', file_url: uploadRef.file_url },
  });
  assert.equal(document.status, 200, document.text);
  const response = await fetch(`${server.baseUrl}/api/files/${uploadRef.upload_id}`, {
    headers: { Authorization: `Bearer ${colleagueA.token}` },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdfFixture());
});

test('E25 spoofed organisation selection and ambiguous omitted selection are rejected', async () => {
  const spoofed = await upload(userA, tenantB.id, {
    bytes: pdfFixture(), filename: 'spoofed-org.pdf', mediaType: 'application/pdf',
  });
  assert.ok(spoofed.status === 403 || spoofed.status === 404, spoofed.text);

  const secondMembership = await requestJson(server, appRoute('/entities/OrganizationMember'), {
    method: 'POST', token: adminToken,
    body: { org_id: tenantB.id, user_email: userA.email, role: 'clinician', is_primary: false },
  });
  assert.equal(secondMembership.status, 200, secondMembership.text);
  const omitted = await upload(userA, undefined, {
    bytes: pdfFixture(), filename: 'omitted-org.pdf', mediaType: 'application/pdf', includeOrg: false,
  });
  assert.equal(omitted.status, 400, omitted.text);
});

test('E26 encoded separators, traversal, sibling-prefix, NUL, and double decoding fail', async () => {
  const headers = { Authorization: `Bearer ${userA.token}` };
  const cases = [
    '/api/files/%2fetc%2fpasswd',
    '/api/files/%5c..%5csecret',
    '/api/files/..%2f..%2fsecret',
    '/api/files/%252e%252e%252fsecret',
    '/api/files/00000000-0000-4000-8000-000000000000extra',
    '/api/files/%00synthetic',
  ];
  for (const route of cases) {
    try {
      const response = await fetch(`${server.baseUrl}${route}`, { headers });
      assert.ok(response.status === 400 || response.status === 404, `${route}: ${response.status}`);
    } catch (error) {
      assert.match(String(error), /invalid|failed|url/i);
    }
  }
});

test('E27 logs and errors contain no file content, patient data, token, API key, or provider payload', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('provider-500');
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'privacy-canary.pdf', 'application/pdf');
  const result = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  const auditDb = openAssuranceDb();
  const auditRows = auditDb.prepare('SELECT event_type, outcome, metadata_json FROM upload_audit').all();
  const usageRows = auditDb.prepare('SELECT status FROM extraction_usage').all();
  auditDb.close();
  const observable = `${result.text}\n${server.getOutput()}\n${JSON.stringify(auditRows)}\n${JSON.stringify(usageRows)}`;
  const canaries = [
    ['file content', 'ALEX RIVER'],
    ['patient data', 'Alex River'],
    ['bearer token', userA.token],
    ['provider credential', PROVIDER_KEY_CANARY],
    ['provider body', PROVIDER_BODY_CANARY],
  ];
  for (const [label, value] of canaries) {
    assert.equal(observable.includes(value), false, `observable output leaked ${label}`);
  }
  assert.doesNotMatch(observable, /input_file|file_data|base64,/i);
});

test('E28 success retains the exact {status, output} contract', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'success-contract.pdf', 'application/pdf');
  const result = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assertSuccess(result, PROFILE_A);
});

test('E29 controlled failure retains the sanitised error contract with an opaque diagnostic reference', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('malformed');
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'failure-contract.pdf', 'application/pdf');
  const result = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assert.equal(result.body?.status, 'error', result.text);
  assert.deepEqual(
    Object.keys(result.body).sort(),
    ['code', 'details', 'diagnostic_reference', 'stage', 'status'],
  );
  assert.equal(result.body.code, 'provider_malformed_output');
  assert.equal(result.body.stage, 'provider_response');
  assert.match(result.body.diagnostic_reference, /^[0-9a-f-]{36}$/i);
  assert.doesNotMatch(result.body.details, /provider|openai|json|path|malformed|not-json/i);
});

test('E30 extraction never writes a client or clinical entity before practitioner review', async () => {
  fakeProvider.reset();
  const entities = ['Client', 'ClientCondition', 'ClientAssessment', 'ClientDocument'];
  const beforeCounts = {};
  for (const entity of entities) {
    const result = await requestJson(server, appRoute(`/entities/${entity}`), { token: userA.token });
    beforeCounts[entity] = result.body.length;
  }
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'review-gate.pdf', 'application/pdf');
  const extraction = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assertSuccess(extraction, PROFILE_A);
  for (const entity of entities) {
    const result = await requestJson(server, appRoute(`/entities/${entity}`), { token: userA.token });
    assert.equal(result.body.length, beforeCounts[entity], `${entity} changed before review`);
  }
  const reviewPending = getUploadRow(uploadRef.upload_id);
  assert.equal(reviewPending?.lifecycle_state, 'review-pending');
  const restoredWindowMs = Date.parse(reviewPending.expires_at) - Date.parse(reviewPending.created_at);
  assert.ok(restoredWindowMs >= (24 * 60 - 2) * 60 * 1000, restoredWindowMs);
  assert.ok(restoredWindowMs <= 24 * 60 * 60 * 1000, restoredWindowMs);
});

test('E31 explicit create/update persists only reviewed data into the validated tenant', async () => {
  const created = await requestJson(server, appRoute('/entities/Client'), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, full_name: 'Alex Reviewed', phone: '0400111222' },
  });
  assert.equal(created.status, 200, created.text);
  assert.equal(created.body.org_id, tenantA.id);
  assert.equal(created.body.full_name, 'Alex Reviewed');
  assert.equal(Object.hasOwn(created.body, 'date_of_birth'), false);
  assert.equal(Object.hasOwn(created.body, 'referral_source_name'), false);

  const updated = await requestJson(server, appRoute(`/entities/Client/${created.body.id}`), {
    method: 'PUT', token: userA.token,
    body: { full_name: 'Alex Practitioner Corrected', org_id: tenantA.id },
  });
  assert.equal(updated.status, 200, updated.text);
  assert.equal(updated.body.full_name, 'Alex Practitioner Corrected');
  assert.equal(updated.body.org_id, tenantA.id);
});

test('E32 authorised file workflows remain usable and cleanup removes only expired unbound files', async () => {
  const logo = await expectUploaded(await upload(userA, tenantA.id, {
    bytes: pngFixture(), filename: 'synthetic-logo.png', mediaType: 'image/png', purpose: 'profile-image',
  }));
  const audioBytes = wavFixture();
  const audio = await expectUploaded(await upload(userA, tenantA.id, {
    bytes: audioBytes, filename: 'synthetic-audio.wav', mediaType: 'audio/wav', purpose: 'audio-transcription',
  }));
  const attachment = await expectUploaded(await upload(userA, tenantA.id, {
    bytes: pdfFixture(), filename: 'synthetic-attachment.pdf', mediaType: 'application/pdf', purpose: 'clinical-attachment',
  }));
  const referencedAttachment = await expectUploaded(await upload(userA, tenantA.id, {
    bytes: pdfFixture(), filename: 'synthetic-referenced-attachment.pdf', mediaType: 'application/pdf', purpose: 'clinical-attachment',
  }));
  for (const item of [logo, audio, attachment, referencedAttachment]) {
    const response = await fetch(`${server.baseUrl}/api/files/${item.upload_id}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    assert.equal(response.status, 200);
  }

  const transcript = await requestJson(server, appRoute('/functions/transcribeSession'), {
    method: 'POST', token: userA.token,
    body: { action: 'transcribe', audio_url: audio.file_url, org_id: tenantA.id },
  });
  assert.equal(transcript.status, 200, transcript.text);
  await assertRealTranscriptionUsesRegisteredStoredName(audio, audioBytes);

  const boundClient = await requestJson(server, appRoute('/entities/Client'), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, full_name: 'Synthetic Retention Client' },
  });
  const boundDocument = await requestJson(server, appRoute('/entities/ClientDocument'), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, client_id: boundClient.body.id, name: 'Retained', file_url: attachment.file_url },
  });
  assert.equal(boundDocument.status, 200, boundDocument.text);
  const referencedDocument = await requestJson(server, appRoute('/entities/ClientDocument'), {
    method: 'POST', token: userA.token,
    body: {
      org_id: tenantA.id,
      client_id: boundClient.body.id,
      name: 'Referenced despite registry drift',
      file_url: referencedAttachment.file_url,
    },
  });
  assert.equal(referencedDocument.status, 200, referencedDocument.text);

  const unbound = await uploadReferral(userA, tenantA.id, pdfFixture(), 'cleanup-unbound.pdf', 'application/pdf');
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  setUploadState(unbound.upload_id, 'temporary', { expiresAt: expiredAt });
  const dbForCorruptBoundExpiry = openAssuranceDb();
  dbForCorruptBoundExpiry.prepare('UPDATE upload_registry SET expires_at = ? WHERE id = ?').run(expiredAt, attachment.upload_id);
  dbForCorruptBoundExpiry.prepare(`
    UPDATE upload_registry
    SET lifecycle_state = 'expired', expires_at = ?, bound_at = NULL,
        bound_entity_type = NULL, bound_entity_id = NULL
    WHERE id = ?
  `).run(expiredAt, referencedAttachment.upload_id);
  dbForCorruptBoundExpiry.close();

  const registryModule = await import('../../server/uploadRegistry.mjs');
  assert.equal(typeof registryModule.cleanupExpiredUploads, 'function');
  const cleanupDb = openAssuranceDb();
  try {
    await registryModule.cleanupExpiredUploads({ db: cleanupDb, uploadsDir: server.uploadsDir, now: new Date(), dryRun: false });
    const unboundAfter = cleanupDb.prepare('SELECT * FROM upload_registry WHERE id = ?').get(unbound.upload_id);
    const boundAfter = cleanupDb.prepare('SELECT * FROM upload_registry WHERE id = ?').get(attachment.upload_id);
    const referencedAfter = cleanupDb.prepare('SELECT * FROM upload_registry WHERE id = ?').get(referencedAttachment.upload_id);
    assert.ok(['expired', 'deleted'].includes(unboundAfter.lifecycle_state));
    assert.equal(boundAfter.lifecycle_state, 'bound');
    assert.equal(referencedAfter.lifecycle_state, 'expired');
    const boundPath = path.join(server.uploadsDir, boundAfter.stored_name);
    const referencedPath = path.join(server.uploadsDir, referencedAfter.stored_name);
    assert.equal(fs.existsSync(boundPath), true);
    assert.equal(fs.existsSync(referencedPath), true);
    const disposition = cleanupDb.prepare('SELECT * FROM upload_disposition WHERE upload_id = ?')
      .get(referencedAttachment.upload_id);
    assert.equal(disposition?.status, 'review-required');
    assert.equal(disposition?.reason_code, 'cleanup_reference_present');
    assert.equal(referencedAfter.expires_at, null, 'isolated cleanup rows must leave the recurring candidate set');
    const second = await registryModule.cleanupExpiredUploads({ db: cleanupDb, uploadsDir: server.uploadsDir, now: new Date(), dryRun: false });
    assert.equal(second.examined, 0, 'the isolated reference must not recur on every cleanup cycle');
    assert.equal(fs.existsSync(boundPath), true);
    assert.equal(fs.existsSync(referencedPath), true);
  } finally {
    cleanupDb.close();
  }
});

test('E33 referral age input requires the exact versioned practitioner attestation and audits no DOB', async () => {
  fakeProvider.reset();
  const rowsBeforeInvalidRequests = uploadRegistryCount();
  const forged = new FormData();
  forged.set('org_id', tenantA.id);
  forged.set('purpose', 'referral-extraction');
  forged.set('subject_age_band', '13_or_over');
  forged.set('file', new File([pdfFixture()], 'forged-age.pdf', { type: 'application/pdf' }));
  const forgedResponse = await fetch(`${server.baseUrl}${appRoute(UPLOAD_ROUTE)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${userA.token}`, 'X-App-Id': server.appId },
    body: forged,
  });
  assert.equal(forgedResponse.status, 400);

  const missing = await upload(userA, tenantA.id, {
    bytes: pdfFixture(),
    filename: 'missing-attestation.pdf',
    mediaType: 'application/pdf',
    subjectDateOfBirth: null,
  });
  assert.equal(missing.status, 400, missing.text);
  assert.equal(missing.body?.code, 'subject_age_confirmation_required');

  const missingVersion = await upload(userA, tenantA.id, {
    bytes: pdfFixture(),
    filename: 'missing-attestation-version.pdf',
    mediaType: 'application/pdf',
    subjectAgeConfirmation: REFERRAL_SUBJECT_AGE_CONFIRMATION,
    subjectAgeAttestationVersion: null,
  });
  assert.equal(missingVersion.status, 400, missingVersion.text);
  assert.equal(missingVersion.body?.code, 'subject_age_attestation_version_required');

  const staleVersion = await upload(userA, tenantA.id, {
    bytes: pdfFixture(),
    filename: 'stale-attestation-version.pdf',
    mediaType: 'application/pdf',
    subjectAgeConfirmation: REFERRAL_SUBJECT_AGE_CONFIRMATION,
    subjectAgeAttestationVersion: 'referral-subject-age-attestation-v2026-07-19.0',
  });
  assert.equal(staleVersion.status, 400, staleVersion.text);
  assert.equal(staleVersion.body?.code, 'invalid_subject_age_attestation_version');

  const forgedSource = await upload(userA, tenantA.id, {
    bytes: pdfFixture(),
    filename: 'forged-attestation-source.pdf',
    mediaType: 'application/pdf',
    subjectAgeConfirmation: REFERRAL_SUBJECT_AGE_CONFIRMATION,
    subjectAgeAttestationSource: 'client_claimed_source',
  });
  assert.equal(forgedSource.status, 400, forgedSource.text);
  assert.equal(forgedSource.body?.code, 'client_age_attestation_source_rejected');

  const invalidConfirmation = await upload(userA, tenantA.id, {
    bytes: pdfFixture(),
    filename: 'invalid-age-confirmation.pdf',
    mediaType: 'application/pdf',
    subjectAgeConfirmation: 'adult',
  });
  assert.equal(invalidConfirmation.status, 400, invalidConfirmation.text);

  const underAgeConfirmation = await upload(userA, tenantA.id, {
    bytes: pdfFixture(),
    filename: 'under-age-confirmation.pdf',
    mediaType: 'application/pdf',
    subjectAgeConfirmation: 'under_13',
  });
  assert.equal(underAgeConfirmation.status, 409, underAgeConfirmation.text);

  const confirmed = await expectUploaded(await upload(userA, tenantA.id, {
    bytes: pdfFixture(),
    filename: 'confirmed-age.pdf',
    mediaType: 'application/pdf',
    subjectAgeConfirmation: '13_or_over',
  }));
  const confirmedRow = getUploadRow(confirmed.upload_id);
  assert.equal(confirmedRow.subject_age_band, REFERRAL_SUBJECT_AGE_CONFIRMATION);
  assert.equal(Object.hasOwn(confirmedRow, 'subject_date_of_birth'), false);

  const auditDb = openAssuranceDb();
  try {
    const row = auditDb.prepare(`
      SELECT metadata_json FROM upload_audit
      WHERE upload_id = ? AND event_type = 'upload_registered' AND outcome = 'success'
    `).get(confirmed.upload_id);
    const metadata = JSON.parse(row.metadata_json);
    assert.deepEqual(Object.keys(metadata).sort(), [
      'byte_size',
      'detected_mime',
      'processing_authority_attestation_source',
      'processing_authority_attestation_version',
      'processing_authority_confirmed',
      'purpose',
      'subject_age_attestation_source',
      'subject_age_attestation_version',
      'subject_age_band',
    ]);
    assert.equal(metadata.subject_age_attestation_source, REFERRAL_SUBJECT_AGE_ATTESTATION_SOURCE);
    assert.equal(metadata.subject_age_attestation_version, REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION);
    assert.equal(metadata.subject_age_band, REFERRAL_SUBJECT_AGE_CONFIRMATION);
    assert.equal(
      metadata.processing_authority_attestation_source,
      REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_SOURCE,
    );
    assert.equal(
      metadata.processing_authority_attestation_version,
      REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
    );
    assert.equal(metadata.processing_authority_confirmed, true);
    assert.doesNotMatch(row.metadata_json, /date.of.birth|subject_dob|\bdob\b|1990|2000/i);
  } finally {
    auditDb.close();
  }
  assert.equal(uploadRegistryCount(), rowsBeforeInvalidRequests + 1);
  assert.equal(fakeProvider.calls.length, 0);
});

test('E33a startup reconciliation removes a pre-registered upload interrupted before rename', async () => {
  const id = randomUUID();
  const storedName = `${id}.pdf`;
  const tempPath = path.join(server.uploadsDir, `${storedName}.registering`);
  const finalPath = path.join(server.uploadsDir, storedName);
  const bytes = pdfFixture();
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const metadata = {
    byte_size: bytes.length,
    detected_mime: 'application/pdf',
    purpose: 'referral-extraction',
    subject_age_attestation_source: REFERRAL_SUBJECT_AGE_ATTESTATION_SOURCE,
    subject_age_attestation_version: REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
    subject_age_band: REFERRAL_SUBJECT_AGE_CONFIRMATION,
    processing_authority_attestation_source: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_SOURCE,
    processing_authority_attestation_version: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
    processing_authority_confirmed: true,
  };
  const db = openAssuranceDb();
  try {
    db.exec('BEGIN IMMEDIATE');
    db.prepare(`
      INSERT INTO upload_registry (
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, is_legacy
      ) VALUES (?, ?, ?, ?, ?, 'referral-extraction', 'application/pdf', ?, ?,
                'registering', ?, ?, ?, 0)
    `).run(
      id,
      storedName,
      'interrupted-registration.pdf',
      tenantA.id,
      userA.id,
      bytes.length,
      createHash('sha256').update(bytes).digest('hex'),
      REFERRAL_SUBJECT_AGE_CONFIRMATION,
      nowIso,
      expiresAt,
    );
    db.prepare(`
      INSERT INTO upload_audit (
        id, upload_id, org_id, actor_user_id, event_type, outcome,
        metadata_json, created_at, expires_at, legal_hold
      ) VALUES (?, ?, ?, ?, 'upload_registration_reserved', 'success', ?, ?, ?, 0)
    `).run(randomUUID(), id, tenantA.id, userA.id, JSON.stringify(metadata), nowIso, expiresAt);
    db.exec('COMMIT');
    fs.writeFileSync(tempPath, bytes, { flag: 'wx' });

    const denied = await fetch(`${server.baseUrl}/uploads/${id}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    assert.equal(denied.status, 404, 'registering uploads must never be delivered');
    fakeProvider.reset();
    const deniedExtraction = await extract(userA, {
      upload_id: id,
      org_id: tenantA.id,
      json_schema: REFERRAL_SCHEMA,
    });
    assert.equal(deniedExtraction.status, 404, deniedExtraction.text);
    assert.equal(fakeProvider.calls.length, 0, 'registering uploads must never reach the provider');

    const { createUploadRegistry } = await import('../uploadRegistry.mjs');
    createUploadRegistry(db, { uploadsDir: server.uploadsDir });
    const row = db.prepare('SELECT * FROM upload_registry WHERE id = ?').get(id);
    assert.equal(row.lifecycle_state, 'deleted');
    assert.equal(row.original_name, '[deleted]');
    assert.equal(fs.existsSync(tempPath), false);
    assert.equal(fs.existsSync(finalPath), false);
    assert.ok(db.prepare(`
      SELECT id FROM upload_audit
      WHERE upload_id = ? AND event_type = 'upload_registration_reconciled' AND outcome = 'removed'
    `).get(id));
  } finally {
    try { db.exec('ROLLBACK'); } catch { /* no active transaction */ }
    db.close();
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath);
    if (fs.existsSync(finalPath)) fs.rmSync(finalPath);
  }
});

test('E33b missing, partial, or forged upload authority leaves no row, file, audit, or usage write', async () => {
  const cases = [
    {
      label: 'missing',
      processingAuthorityConfirmed: null,
      processingAuthorityAttestationVersion: null,
    },
    {
      label: 'partial-confirmation-only',
      processingAuthorityConfirmed: true,
      processingAuthorityAttestationVersion: null,
    },
    {
      label: 'partial-version-only',
      processingAuthorityConfirmed: null,
      processingAuthorityAttestationVersion: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
    },
    {
      label: 'forged-confirmation',
      processingAuthorityConfirmed: false,
      processingAuthorityAttestationVersion: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
    },
    {
      label: 'forged-version',
      processingAuthorityConfirmed: true,
      processingAuthorityAttestationVersion: 'referral-processing-authority-v2026-07-20.0',
    },
    {
      label: 'forged-source',
      processingAuthorityConfirmed: true,
      processingAuthorityAttestationVersion: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
      processingAuthorityAttestationSource: 'client_claimed_source',
    },
  ];

  for (const authorityCase of cases) {
    const before = persistenceSnapshot();
    const filename = `authority-${authorityCase.label}.pdf`;
    const result = await upload(userA, tenantA.id, {
      bytes: pdfFixture(),
      filename,
      mediaType: 'application/pdf',
      ...authorityCase,
    });
    assert.ok(result.status === 400 || result.status === 403, `${authorityCase.label}: ${result.text}`);
    assert.match(result.body?.code || '', /processing_authority/);
    assert.equal(result.text.includes(filename), false);
    assert.deepEqual(
      persistenceSnapshot(),
      before,
      `${authorityCase.label} authority changed durable upload state`,
    );
  }
});

test('E34 superseded date-of-birth age input fails before upload persistence or provider I/O', async () => {
  fakeProvider.reset();
  const rowsBefore = uploadRegistryCount();
  const supersededDob = await upload(userA, tenantA.id, {
    bytes: pdfFixture(),
    filename: 'superseded-dob-input.pdf',
    mediaType: 'application/pdf',
    subjectDateOfBirth: new Date().getUTCFullYear() + '-01-01',
  });
  assert.equal(supersededDob.status, 400, supersededDob.text);
  assert.equal(supersededDob.body?.code, 'subject_date_of_birth_rejected');
  assert.equal(uploadRegistryCount(), rowsBefore);
  assert.equal(fakeProvider.calls.length, 0);
});

test('E35 extraction requires exact processing authority before provider I/O or extraction writes', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'authority-required.pdf', 'application/pdf');
  const base = { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA };
  const cases = [
    { label: 'missing', body: base },
    { label: 'partial', body: { ...base, processing_authority_confirmed: true } },
    {
      label: 'forged-confirmation',
      body: {
        ...base,
        processing_authority_confirmed: false,
        processing_authority_attestation_version: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
      },
    },
    {
      label: 'forged-version',
      body: {
        ...base,
        processing_authority_confirmed: true,
        processing_authority_attestation_version: 'referral-processing-authority-v2026-07-20.0',
      },
    },
    {
      label: 'forged-source',
      body: {
        ...base,
        processing_authority_confirmed: true,
        processing_authority_attestation_version: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
        processing_authority_attestation_source: 'client_claimed_source',
      },
    },
  ];
  for (const authorityCase of cases) {
    const before = uploadExtractionWriteSnapshot(uploadRef.upload_id);
    const result = await requestJson(server, appRoute(EXTRACTION_ROUTE), {
      method: 'POST',
      token: userA.token,
      body: authorityCase.body,
    });
    assert.ok(result.status === 400 || result.status === 403, `${authorityCase.label}: ${result.text}`);
    assert.equal(result.body?.status, 'error');
    assert.match(result.body?.code || '', /processing_authority/);
    assert.equal(fakeProvider.calls.length, 0);
    assert.deepEqual(
      uploadExtractionWriteSnapshot(uploadRef.upload_id),
      before,
      `${authorityCase.label} authority changed extraction state`,
    );
  }
});

test('E35a expanded, reduced, or reordered referral schemas reject before provider I/O or extraction writes', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'schema-integrity.pdf', 'application/pdf');
  const expanded = structuredClone(REFERRAL_SCHEMA);
  expanded.properties.unreviewed_field = { type: 'string' };
  const reduced = structuredClone(REFERRAL_SCHEMA);
  delete reduced.properties.medicare_referral_type;
  const reordered = structuredClone(REFERRAL_SCHEMA);
  reordered.properties = Object.fromEntries(Object.entries(reordered.properties).reverse());

  for (const [label, jsonSchema] of [
    ['expanded', expanded],
    ['reduced', reduced],
    ['reordered', reordered],
  ]) {
    const before = uploadExtractionWriteSnapshot(uploadRef.upload_id);
    const result = await extract(userA, {
      upload_id: uploadRef.upload_id,
      org_id: tenantA.id,
      json_schema: jsonSchema,
    });
    assert.equal(result.status, 400, `${label}: ${result.text}`);
    assert.equal(result.body?.code, 'noncanonical_referral_schema');
    assert.equal(fakeProvider.calls.length, 0);
    assert.deepEqual(
      uploadExtractionWriteSnapshot(uploadRef.upload_id),
      before,
      `${label} schema changed extraction state`,
    );
  }
});

test('E35b a provider-returned under-13 DOB is blocked once, quarantined content-free, and not retried', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('under-13');
  const uploadRef = await uploadReferral(
    userA,
    tenantA.id,
    pdfFixture({ marker: 'ASSURANCE_PROFILE_UNDER_13', dateOfBirth: '2020-01-02' }),
    'provider-under-13.pdf',
    'application/pdf',
  );
  const filePath = path.join(server.uploadsDir, getUploadRow(uploadRef.upload_id).stored_name);
  const markerPath = path.join(server.uploadsDir, `${uploadRef.upload_id}.provider-block`);
  try {
    const result = await extract(userA, {
      upload_id: uploadRef.upload_id,
      org_id: tenantA.id,
      json_schema: REFERRAL_SCHEMA,
    });
    assert.equal(result.status, 409, result.text);
    assert.equal(result.body?.status, 'error');
    assert.equal(result.body?.code, 'extracted_subject_under_13');
    assert.equal(result.body?.stage, 'post_extraction_age_gate');
    assert.deepEqual(
      Object.keys(result.body).sort(),
      ['code', 'details', 'diagnostic_reference', 'stage', 'status'],
    );
    assert.equal(Object.hasOwn(result.body, 'output'), false);
    for (const forbidden of [
      CANONICAL_REFERRAL_PROFILE_UNDER_13.full_name,
      CANONICAL_REFERRAL_PROFILE_UNDER_13.date_of_birth,
      'provider-under-13.pdf',
    ]) {
      assert.equal(result.text.includes(forbidden), false, `409 response disclosed ${forbidden}`);
    }
    assert.equal(fakeProvider.calls.length, 1, 'provider must be called exactly once before the age gate');

    const quarantined = getUploadRow(uploadRef.upload_id);
    assert.equal(quarantined.lifecycle_state, 'expired');
    assert.equal(quarantined.subject_age_band, 'under_13');
    assert.ok(Date.parse(quarantined.expires_at) <= Date.now(), quarantined.expires_at);
    assert.equal(fs.existsSync(filePath), true, 'cleanup owns physical deletion after quarantine');
    assert.equal(fs.statSync(markerPath).size, 0, 'the durable no-retry marker must remain content-free');

    const db = openAssuranceDb();
    try {
      const ageGate = db.prepare(`
        SELECT metadata_json FROM upload_audit
        WHERE upload_id = ? AND event_type = 'post_extraction_age_gate' AND outcome = 'blocked'
        ORDER BY created_at DESC LIMIT 1
      `).get(uploadRef.upload_id);
      assert.ok(ageGate, 'quarantine audit is required');
      const metadata = JSON.parse(ageGate.metadata_json);
      assert.deepEqual(metadata, {
        code: 'extracted_subject_under_13',
        state_from: 'processing',
        state_to: 'expired',
        live_access_revoked_immediately: true,
        physical_cleanup_scheduled: true,
      });
      assert.doesNotMatch(
        ageGate.metadata_json,
        /Synthetic Minor|2020-01-02|provider-under-13|date.of.birth|\bdob\b/i,
      );
    } finally {
      db.close();
    }

    const retry = await extract(userA, {
      upload_id: uploadRef.upload_id,
      org_id: tenantA.id,
      json_schema: REFERRAL_SCHEMA,
    });
    assert.equal(retry.status, 404, retry.text);
    assert.equal(fakeProvider.calls.length, 1, 'quarantined referrals must never re-enter the provider path');

    const registryModule = await import('../uploadRegistry.mjs');
    const cleanupDb = openAssuranceDb();
    try {
      const cleanup = registryModule.cleanupExpiredUploads({
        db: cleanupDb,
        uploadsDir: server.uploadsDir,
        now: new Date(),
        dryRun: false,
      });
      assert.equal(cleanup.removed, 1);
    } finally {
      cleanupDb.close();
    }
    assert.equal(getUploadRow(uploadRef.upload_id).lifecycle_state, 'deleted');
    assert.equal(fs.existsSync(filePath), false);
    assert.equal(fs.existsSync(markerPath), false);
  } finally {
    fakeProvider.reset();
  }
});

test('E35c a quarantine database abort cannot make provider-returned under-13 bytes retryable', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('under-13');
  const uploadRef = await uploadReferral(
    userA,
    tenantA.id,
    pdfFixture({ marker: 'ASSURANCE_PROFILE_UNDER_13', dateOfBirth: '2020-01-02' }),
    'provider-under-13-db-abort.pdf',
    'application/pdf',
  );
  const markerPath = path.join(server.uploadsDir, `${uploadRef.upload_id}.provider-block`);
  const db = openAssuranceDb();
  try {
    db.exec(`
      CREATE TRIGGER synthetic_fail_under_13_quarantine
      BEFORE UPDATE OF subject_age_band ON upload_registry
      WHEN NEW.id = '${uploadRef.upload_id}' AND NEW.subject_age_band = 'under_13'
      BEGIN
        SELECT RAISE(ABORT, 'synthetic quarantine database abort');
      END;
    `);
  } finally {
    db.close();
  }

  try {
    const first = await extract(userA, {
      upload_id: uploadRef.upload_id,
      org_id: tenantA.id,
      json_schema: REFERRAL_SCHEMA,
    });
    assert.equal(first.status, 409, first.text);
    assert.equal(first.body?.code, 'extracted_subject_under_13');
    assert.equal(fakeProvider.calls.length, 1);
    assert.equal(fs.statSync(markerPath).size, 0, 'the independent marker must survive the SQLite abort');
    assert.notEqual(getUploadRow(uploadRef.upload_id).subject_age_band, 'under_13');

    const retry = await extract(userA, {
      upload_id: uploadRef.upload_id,
      org_id: tenantA.id,
      json_schema: REFERRAL_SCHEMA,
    });
    assert.equal(retry.status, 409, retry.text);
    assert.equal(retry.body?.code, 'provider_retry_blocked');
    assert.equal(fakeProvider.calls.length, 1, 'the database abort must not permit a second provider call');
  } finally {
    const cleanupDb = openAssuranceDb();
    try {
      cleanupDb.exec('DROP TRIGGER IF EXISTS synthetic_fail_under_13_quarantine');
    } finally {
      cleanupDb.close();
    }
    const cancelled = await requestJson(server, appRoute(CANCEL_ROUTE), {
      method: 'POST',
      token: userA.token,
      body: { org_id: tenantA.id, upload_ids: [uploadRef.upload_id] },
    });
    assert.equal(cancelled.status, 200, cancelled.text);
    assert.equal(fs.existsSync(markerPath), false, 'cancellation must remove the provider block marker');
    fakeProvider.reset();
  }
});

test('E35d simultaneous marker and database quarantine faults remain blocked in the live process', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('under-13');
  const uploadRef = await uploadReferral(
    userA,
    tenantA.id,
    pdfFixture({ marker: 'ASSURANCE_PROFILE_UNDER_13', dateOfBirth: '2020-01-02' }),
    'provider-under-13-dual-fault.pdf',
    'application/pdf',
  );
  const markerPath = path.join(server.uploadsDir, `${uploadRef.upload_id}.provider-block`);
  fakeProvider.setBeforeRespond(() => {
    fs.mkdirSync(markerPath, { mode: 0o700 });
  });
  const db = openAssuranceDb();
  try {
    db.exec(`
      CREATE TRIGGER synthetic_fail_under_13_dual_quarantine
      BEFORE UPDATE OF subject_age_band ON upload_registry
      WHEN NEW.id = '${uploadRef.upload_id}' AND NEW.subject_age_band = 'under_13'
      BEGIN
        SELECT RAISE(ABORT, 'synthetic dual quarantine database abort');
      END;
    `);
  } finally {
    db.close();
  }

  try {
    const first = await extract(userA, {
      upload_id: uploadRef.upload_id,
      org_id: tenantA.id,
      json_schema: REFERRAL_SCHEMA,
    });
    assert.equal(first.status, 409, first.text);
    assert.equal(first.body?.code, 'extracted_subject_under_13');
    assert.equal(fakeProvider.calls.length, 1);
    assert.notEqual(getUploadRow(uploadRef.upload_id).subject_age_band, 'under_13');

    const retry = await extract(userA, {
      upload_id: uploadRef.upload_id,
      org_id: tenantA.id,
      json_schema: REFERRAL_SCHEMA,
    });
    assert.equal(retry.status, 409, retry.text);
    assert.equal(retry.body?.code, 'provider_retry_blocked');
    assert.equal(fakeProvider.calls.length, 1, 'dual quarantine faults must not permit a second provider call');
  } finally {
    const cleanupDb = openAssuranceDb();
    try {
      cleanupDb.exec('DROP TRIGGER IF EXISTS synthetic_fail_under_13_dual_quarantine');
    } finally {
      cleanupDb.close();
    }
    if (fs.existsSync(markerPath)) fs.rmSync(markerPath, { recursive: true, force: true });
    const cancelled = await requestJson(server, appRoute(CANCEL_ROUTE), {
      method: 'POST',
      token: userA.token,
      body: { org_id: tenantA.id, upload_ids: [uploadRef.upload_id] },
    });
    assert.equal(cancelled.status, 200, cancelled.text);
    const quotaDb = openAssuranceDb();
    try {
      quotaDb.prepare('UPDATE upload_registry SET created_at = ? WHERE id = ?').run(
        new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        uploadRef.upload_id,
      );
    } finally {
      quotaDb.close();
    }
    fakeProvider.reset();
  }
});

test('E36 practitioner cancellation immediately deletes bytes and redacts unbound filenames', async () => {
  const first = await uploadReferral(userA, tenantA.id, pdfFixture(), 'cancel-one.pdf', 'application/pdf');
  const second = await uploadReferral(userA, tenantA.id, pdfFixture(), 'cancel-two.pdf', 'application/pdf');
  const result = await requestJson(server, appRoute(CANCEL_ROUTE), {
    method: 'POST',
    token: userA.token,
    body: { org_id: tenantA.id, upload_ids: [first.upload_id, second.upload_id] },
  });
  assert.equal(result.status, 200, result.text);
  assert.deepEqual(result.body, { status: 'success', deleted: 2 });
  for (const id of [first.upload_id, second.upload_id]) {
    const row = getUploadRow(id);
    assert.equal(row.lifecycle_state, 'deleted');
    assert.equal(row.original_name, '[deleted]');
    assert.ok(Date.parse(row.deleted_at) <= Date.now());
    assert.equal(fs.existsSync(path.join(server.uploadsDir, row.stored_name)), false);
  }
});

test('E37 general clinical InvokeLLM remains disabled outside the referral adapter', async () => {
  const isolated = await startTestServer({ GENERAL_CLINICAL_LLM_ENABLED: '0' });
  try {
    const isolatedAdmin = await loginAdmin(isolated);
    const result = await requestJson(
      isolated,
      `/api/apps/${isolated.appId}/integration-endpoints/Core/InvokeLLM`,
      { method: 'POST', token: isolatedAdmin, body: { prompt: 'synthetic disabled check' } },
    );
    assert.equal(result.status, 503, result.text);
    assert.equal(result.body?.error, 'General AI generation is disabled on this server.');
  } finally {
    await isolated.stop();
  }
});

test('E38 authority and provider provenance are persisted as bounded content-free audit metadata', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'audit-provenance.pdf', 'application/pdf');
  const result = await extract(userA, {
    upload_id: uploadRef.upload_id,
    org_id: tenantA.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assertSuccess(result, PROFILE_A);
  const db = openAssuranceDb();
  try {
    const rows = db.prepare(`
      SELECT event_type, metadata_json FROM upload_audit
      WHERE upload_id = ? AND event_type IN ('processing_authority_attested', 'document_extraction')
      ORDER BY created_at ASC
    `).all(uploadRef.upload_id);
    const authority = JSON.parse(rows.find((row) => row.event_type === 'processing_authority_attested').metadata_json);
    const extraction = JSON.parse(rows.find((row) => row.event_type === 'document_extraction').metadata_json);
    assert.deepEqual(Object.keys(authority).sort(), [
      'processing_authority_attestation_source',
      'processing_authority_attestation_version',
      'processing_authority_confirmed',
      'upload_purpose',
    ]);
    assert.deepEqual(Object.keys(extraction).sort(), [
      'actual_cost_microusd',
      'estimated_cost_microusd',
      'file_count',
      'prompt_version',
      'provider_contact_attempted',
      'provider_model',
      'provider_request_constructed',
      'provider_response_id_hash',
      'provider_status_class',
      'request_background_disabled',
      'request_conversation_state_disabled',
      'request_inline_only',
      'request_prompt_cache_in_memory',
      'request_store_disabled',
      'request_tools_disabled',
      'schema_hash',
    ]);
    assert.equal(
      authority.processing_authority_attestation_source,
      REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_SOURCE,
    );
    assert.equal(
      authority.processing_authority_attestation_version,
      REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
    );
    assert.equal(authority.processing_authority_confirmed, true);
    assert.equal(authority.upload_purpose, 'referral-extraction');
    assert.equal(extraction.provider_model, 'synthetic-assurance-model');
    assert.equal(extraction.provider_request_constructed, true);
    assert.equal(extraction.provider_contact_attempted, true);
    assert.equal(typeof extraction.prompt_version, 'string');
    assert.match(extraction.provider_response_id_hash, /^[0-9a-f]{64}$/);
    assert.equal(extraction.request_store_disabled, true);
    assert.equal(extraction.request_background_disabled, true);
    assert.equal(extraction.request_prompt_cache_in_memory, true);
    assert.equal(extraction.request_tools_disabled, true);
    assert.equal(extraction.request_inline_only, true);
    assert.equal(extraction.request_conversation_state_disabled, true);
    assert.ok(JSON.stringify(extraction).length < 2_048);
    assert.equal(Object.hasOwn(extraction, 'provider_response_id'), false);
    assert.doesNotMatch(JSON.stringify(rows), /Alex River|ALEX RIVER|file_data|input_file/i);
  } finally {
    db.close();
  }
});

test('E39 same-org colleagues cannot bind or cancel another uploader\'s unbound file', async () => {
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'private-unbound.pdf', 'application/pdf');
  const client = await requestJson(server, appRoute('/entities/Client'), {
    method: 'POST', token: colleagueA.token,
    body: { org_id: tenantA.id, full_name: 'Synthetic Ownership Boundary' },
  });
  assert.equal(client.status, 200, client.text);
  const bind = await requestJson(server, appRoute('/entities/ClientDocument'), {
    method: 'POST', token: colleagueA.token,
    body: { org_id: tenantA.id, client_id: client.body.id, name: 'Must not bind', file_url: uploadRef.file_url },
  });
  assert.equal(bind.status, 404, bind.text);
  const cancel = await requestJson(server, appRoute(CANCEL_ROUTE), {
    method: 'POST', token: colleagueA.token,
    body: { org_id: tenantA.id, upload_ids: [uploadRef.upload_id] },
  });
  assert.equal(cancel.status, 404, cancel.text);
  assert.equal(getUploadRow(uploadRef.upload_id).lifecycle_state, 'temporary');
});

test('E40 an expired unbound upload is inaccessible before periodic cleanup runs', async () => {
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'expired-before-cleanup.pdf', 'application/pdf');
  setUploadState(uploadRef.upload_id, 'temporary', { expiresAt: new Date(Date.now() - 1_000).toISOString() });
  const response = await fetch(`${server.baseUrl}/api/files/${uploadRef.upload_id}`, {
    headers: { Authorization: `Bearer ${userA.token}` },
  });
  assert.equal(response.status, 404);
  assert.equal(fs.existsSync(path.join(server.uploadsDir, getUploadRow(uploadRef.upload_id).stored_name)), true);
});

test('E41 clinical access is scoped to the accepted membership in a multi-organisation account', async () => {
  const tenantBClient = await requestJson(server, appRoute('/entities/Client'), {
    method: 'POST', token: userB.token,
    body: { org_id: tenantB.id, full_name: 'Tenant B Acceptance Boundary' },
  });
  assert.equal(tenantBClient.status, 200, tenantBClient.text);
  const result = await requestJson(server, appRoute(`/entities/Client?q=${encodeURIComponent(JSON.stringify({ org_id: tenantB.id }))}`), {
    token: userA.token,
  });
  assert.equal(result.status, 200, result.text);
  assert.deepEqual(result.body, []);

  const inverse = await registerUser(server, 'inverse-membership@assurance.test');
  await activateUser(server, adminToken, inverse.id);
  for (const [orgId, role, isPrimary] of [
    [tenantA.id, 'owner', true],
    [tenantB.id, 'clinician', false],
  ]) {
    const membership = await requestJson(server, appRoute('/entities/OrganizationMember'), {
      method: 'POST', token: adminToken,
      body: { org_id: orgId, user_email: inverse.email, role, is_primary: isPrimary },
    });
    assert.equal(membership.status, 200, membership.text);
  }

  // Establish A acceptance only long enough for the inverse user to own an A
  // audio object. Removing those receipts below isolates the function-level
  // legal-acceptance check from the independent uploader-ownership check.
  await acceptCurrentNotices(inverse, tenantA.id);
  const inverseAudio = await expectUploaded(await upload(inverse, tenantA.id, {
    bytes: wavFixture(), filename: 'inverse-owned-unaccepted.wav', mediaType: 'audio/wav', purpose: 'audio-transcription',
  }));
  const acceptanceDb = openAssuranceDb();
  try {
    const rows = acceptanceDb.prepare('SELECT id, data FROM entity_LegalAcceptanceEvent').all();
    const remove = acceptanceDb.prepare('DELETE FROM entity_LegalAcceptanceEvent WHERE id = ?');
    let removed = 0;
    for (const row of rows) {
      const receipt = JSON.parse(row.data);
      if (receipt.user_email === inverse.email && receipt.org_id === tenantA.id) {
        removed += Number(remove.run(row.id).changes);
      }
    }
    assert.equal(removed, 8);
  } finally {
    acceptanceDb.close();
  }
  await acceptCurrentNotices(inverse, tenantB.id);

  const acceptedB = await requestJson(server, appRoute(`/entities/Client?q=${encodeURIComponent(JSON.stringify({ org_id: tenantB.id }))}`), {
    token: inverse.token,
  });
  assert.equal(acceptedB.status, 200, acceptedB.text);
  assert.ok(acceptedB.body.some((record) => record.id === tenantBClient.body.id));
  assert.ok(acceptedB.body.every((record) => record.org_id === tenantB.id));
  const unacceptedA = await requestJson(server, appRoute(`/entities/Client?q=${encodeURIComponent(JSON.stringify({ org_id: tenantA.id }))}`), {
    token: inverse.token,
  });
  assert.equal(unacceptedA.status, 200, unacceptedA.text);
  assert.deepEqual(unacceptedA.body, []);

  const blockedUpload = await upload(inverse, tenantA.id, {
    bytes: pdfFixture(), filename: 'inverse-unaccepted.pdf', mediaType: 'application/pdf',
  });
  assert.equal(blockedUpload.status, 403, blockedUpload.text);

  const ownerUpload = await uploadReferral(userA, tenantA.id, pdfFixture(), 'inverse-extraction-source.pdf', 'application/pdf');
  fakeProvider.reset();
  const blockedExtraction = await extract(inverse, {
    org_id: tenantA.id,
    upload_id: ownerUpload.upload_id,
    json_schema: REFERRAL_SCHEMA,
  });
  assert.equal(blockedExtraction.status, 403, blockedExtraction.text);
  assert.equal(fakeProvider.calls.length, 0);

  const blockedFunction = await requestJson(server, appRoute('/functions/transcribeSession'), {
    method: 'POST', token: inverse.token,
    body: { action: 'transcribe', audio_url: inverseAudio.file_url, org_id: tenantA.id },
  });
  assert.equal(blockedFunction.status, 404, blockedFunction.text);
});

test('E42 deleted upload registry metadata is purged after two years unless legal hold is active', async () => {
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'purge-after-retention.pdf', 'application/pdf');
  const cancelled = await requestJson(server, appRoute(CANCEL_ROUTE), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, upload_ids: [uploadRef.upload_id] },
  });
  assert.equal(cancelled.status, 200, cancelled.text);
  const db = openAssuranceDb();
  const oldDate = new Date(Date.now() - (2 * 365 + 2) * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE upload_registry SET deleted_at = ? WHERE id = ?').run(oldDate, uploadRef.upload_id);
  const registryModule = await import('../../server/uploadRegistry.mjs');
  const previousHold = process.env.UPLOAD_AUDIT_LEGAL_HOLD;
  try {
    process.env.UPLOAD_AUDIT_LEGAL_HOLD = '1';
    registryModule.cleanupExpiredUploadAudit({ db, now: new Date(), dryRun: false });
    assert.ok(db.prepare('SELECT id FROM upload_registry WHERE id = ?').get(uploadRef.upload_id));
    delete process.env.UPLOAD_AUDIT_LEGAL_HOLD;
    registryModule.cleanupExpiredUploadAudit({ db, now: new Date(), dryRun: false });
    assert.equal(db.prepare('SELECT id FROM upload_registry WHERE id = ?').get(uploadRef.upload_id), undefined);
  } finally {
    if (previousHold === undefined) delete process.env.UPLOAD_AUDIT_LEGAL_HOLD;
    else process.env.UPLOAD_AUDIT_LEGAL_HOLD = previousHold;
    db.close();
  }
});

test('E43 bound re-extraction requires every current selected-practice legal instrument before provider I/O', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'bound-reextract.pdf', 'application/pdf');
  const client = await requestJson(server, appRoute('/entities/Client'), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, full_name: 'Bound Re-extraction Client' },
  });
  assert.equal(client.status, 200, client.text);
  const document = await requestJson(server, appRoute('/entities/ClientDocument'), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, client_id: client.body.id, name: 'Bound referral', file_url: uploadRef.file_url },
  });
  assert.equal(document.status, 200, document.text);
  assert.equal(getUploadRow(uploadRef.upload_id).lifecycle_state, 'bound');

  for (const documentId of ['collection-notice', 'clinical-use-notice', 'ai-notice']) {
    makeLegalReceiptStale(userA, tenantA.id, documentId);
    fakeProvider.reset();
    const blocked = await extract(userA, {
      upload_id: uploadRef.upload_id,
      org_id: tenantA.id,
      json_schema: REFERRAL_SCHEMA,
    });
    assert.equal(blocked.status, 403, blocked.text);
    assert.equal(blocked.body?.code, 'acceptance_required');
    assert.equal(fakeProvider.calls.length, 0, `${documentId} must fail before provider I/O`);
    assert.equal(getUploadRow(uploadRef.upload_id).lifecycle_state, 'bound');
    await acceptCurrentNotices(userA, tenantA.id);
  }

  fakeProvider.reset();
  const result = await extract(userA, {
    upload_id: uploadRef.upload_id,
    org_id: tenantA.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assertSuccess(result, PROFILE_A);
  assert.equal(getUploadRow(uploadRef.upload_id).lifecycle_state, 'bound');
});

test('E43a a stale owner-contract receipt blocks bound re-extraction before provider I/O', async () => {
  const owner = await registerUser(server, 'synthetic-bound-owner-legal-gate@example.test');
  await activateUser(server, adminToken, owner.id);
  const ownerOrg = await createOrganizationForUser(server, adminToken, owner, 'owner');
  await acceptCurrentNotices(owner, ownerOrg.id);

  const uploadRef = await uploadReferral(owner, ownerOrg.id, pdfFixture(), 'bound-owner-contract.pdf', 'application/pdf');
  const client = await requestJson(server, appRoute('/entities/Client'), {
    method: 'POST', token: owner.token,
    body: { org_id: ownerOrg.id, full_name: 'Bound Owner Contract Client' },
  });
  assert.equal(client.status, 200, client.text);
  const document = await requestJson(server, appRoute('/entities/ClientDocument'), {
    method: 'POST', token: owner.token,
    body: { org_id: ownerOrg.id, client_id: client.body.id, name: 'Bound owner referral', file_url: uploadRef.file_url },
  });
  assert.equal(document.status, 200, document.text);
  assert.equal(getUploadRow(uploadRef.upload_id).lifecycle_state, 'bound');

  makeLegalReceiptStale(owner, ownerOrg.id, 'terms');
  fakeProvider.reset();
  const blocked = await extract(owner, {
    upload_id: uploadRef.upload_id,
    org_id: ownerOrg.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assert.equal(blocked.status, 403, blocked.text);
  assert.equal(blocked.body?.code, 'acceptance_required');
  assert.equal(fakeProvider.calls.length, 0);
  assert.equal(getUploadRow(uploadRef.upload_id).lifecycle_state, 'bound');

  await acceptCurrentNotices(owner, ownerOrg.id);
  fakeProvider.reset();
  const restored = await extract(owner, {
    upload_id: uploadRef.upload_id,
    org_id: ownerOrg.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assertSuccess(restored, PROFILE_A);
});

test('E44 non-Australian or non-release professions fail closed across profile, clinical, upload, and extraction paths', async () => {
  const uploadRef = await uploadReferral(userB, tenantB.id, pdfFixture(), 'release-boundary.pdf', 'application/pdf');

  const invalidProfile = await requestJson(server, appRoute('/entities/User/me'), {
    method: 'PUT',
    token: userB.token,
    body: { country: 'usa', profession: 'Physiotherapist' },
  });
  assert.equal(invalidProfile.status, 403, invalidProfile.text);

  const adminSetOutsideRelease = await requestJson(server, appRoute(`/entities/User/${userB.id}`), {
    method: 'PUT',
    token: adminToken,
    body: { country: 'usa', profession: 'Physiotherapist' },
  });
  assert.equal(adminSetOutsideRelease.status, 200, adminSetOutsideRelease.text);

  try {
    const clinicalList = await requestJson(server, appRoute('/entities/Client'), { token: userB.token });
    assert.equal(clinicalList.status, 403, clinicalList.text);
    assert.equal(clinicalList.body?.message, 'clinical access is not approved for this account profile');

    const clinicalFunction = await requestJson(server, appRoute('/functions/medicalLookup'), {
      method: 'POST', token: userB.token, body: { conditions: ['synthetic'] },
    });
    assert.equal(clinicalFunction.status, 403, clinicalFunction.text);
    assert.equal(clinicalFunction.body?.error, 'clinical access is not approved for this account profile');

    const blockedUpload = await upload(userB, tenantB.id, {
      bytes: pdfFixture(),
      filename: 'blocked-release-boundary.pdf',
      mediaType: 'application/pdf',
    });
    assert.equal(blockedUpload.status, 403, blockedUpload.text);

    fakeProvider.reset();
    const blockedExtraction = await extract(userB, {
      upload_id: uploadRef.upload_id,
      org_id: tenantB.id,
      json_schema: REFERRAL_SCHEMA,
    });
    assert.equal(blockedExtraction.status, 403, blockedExtraction.text);
    assert.equal(fakeProvider.calls.length, 0, 'release boundary must be checked before provider I/O');
  } finally {
    const restored = await requestJson(server, appRoute(`/entities/User/${userB.id}`), {
      method: 'PUT',
      token: adminToken,
      body: { country: 'australia', profession: 'Exercise Physiologist' },
    });
    assert.equal(restored.status, 200, restored.text);
  }
});

test('E45 failed provider calls retain bounded provenance while schema preflight writes nothing', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('provider-500');
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'failed-provenance.pdf', 'application/pdf');
  const providerAttemptStartedAt = Date.now();
  const result = await extract(userA, {
    upload_id: uploadRef.upload_id,
    org_id: tenantA.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assert.equal(result.status, 502, result.text);
  const failedUpload = getUploadRow(uploadRef.upload_id);
  assert.equal(failedUpload.lifecycle_state, 'temporary');
  assert.ok(
    Date.parse(failedUpload.expires_at) <= providerAttemptStartedAt + 60 * 60 * 1000,
    failedUpload.expires_at,
  );

  const db = openAssuranceDb();
  try {
    const row = db.prepare(`
      SELECT metadata_json FROM upload_audit
      WHERE upload_id = ? AND event_type = 'document_extraction' AND outcome = 'failed'
      ORDER BY created_at DESC LIMIT 1
    `).get(uploadRef.upload_id);
    assert.ok(row, JSON.stringify(db.prepare(`
      SELECT event_type, outcome, metadata_json FROM upload_audit
      WHERE upload_id = ? ORDER BY created_at DESC
    `).all(uploadRef.upload_id)));
    const metadata = JSON.parse(row.metadata_json);
    assert.deepEqual(Object.keys(metadata).sort(), [
      'code',
      'diagnostic_reference',
      'file_count',
      'prompt_version',
      'provider_contact_attempted',
      'provider_model',
      'provider_request_constructed',
      'provider_status_class',
      'request_background_disabled',
      'request_conversation_state_disabled',
      'request_inline_only',
      'request_prompt_cache_in_memory',
      'request_store_disabled',
      'request_tools_disabled',
      'schema_hash',
      'stage',
    ]);
    assert.equal(metadata.schema_hash, REFERRAL_EXTRACTION_SCHEMA_SHA256);
    assert.equal(metadata.provider_status_class, '5xx');
    assert.equal(metadata.provider_model, 'synthetic-assurance-model');
    assert.equal(metadata.provider_request_constructed, true);
    assert.equal(metadata.provider_contact_attempted, true);
    assert.equal(typeof metadata.prompt_version, 'string');
    assert.equal(metadata.request_store_disabled, true);
    assert.equal(metadata.request_background_disabled, true);
    assert.equal(metadata.request_prompt_cache_in_memory, true);
    assert.equal(metadata.request_tools_disabled, true);
    assert.equal(metadata.request_inline_only, true);
    assert.equal(metadata.request_conversation_state_disabled, true);
    assert.ok(row.metadata_json.length < 2_048);
    assert.equal(Object.hasOwn(metadata, 'provider_response_id'), false);
    assert.doesNotMatch(row.metadata_json, /Alex River|ALEX RIVER|file_data|input_file/i);
  } finally {
    db.close();
    fakeProvider.reset();
  }

  const preProvider = await uploadReferral(userA, tenantA.id, pdfFixture(), 'pre-provider-failure.pdf', 'application/pdf');
  const preProviderBefore = uploadExtractionWriteSnapshot(preProvider.upload_id);
  const invalidSchema = await extract(userA, {
    upload_id: preProvider.upload_id,
    org_id: tenantA.id,
    json_schema: {},
  });
  assert.equal(invalidSchema.status, 400, invalidSchema.text);
  assert.equal(invalidSchema.body?.code, 'noncanonical_referral_schema');
  assert.equal(fakeProvider.calls.length, 0);
  assert.deepEqual(
    uploadExtractionWriteSnapshot(preProvider.upload_id),
    preProviderBefore,
    'schema preflight must occur before authority audit, usage reservation, or lifecycle writes',
  );

  const priorModel = process.env.OPENAI_DOCUMENT_EXTRACTION_MODEL;
  const priorSelftest = process.env.SELFTEST;
  const priorNodeEnv = process.env.NODE_ENV;
  try {
    process.env.OPENAI_DOCUMENT_EXTRACTION_MODEL = 'opaque-production-override';
    delete process.env.SELFTEST;
    process.env.NODE_ENV = 'production';
    assert.throws(
      () => resolveDocumentExtractionModel(),
      (error) => error?.code === 'extraction_model_override_forbidden' && error?.httpStatus === 503,
    );
    process.env.SELFTEST = '1';
    assert.equal(resolveDocumentExtractionModel(), 'opaque-production-override');
  } finally {
    if (priorModel === undefined) delete process.env.OPENAI_DOCUMENT_EXTRACTION_MODEL;
    else process.env.OPENAI_DOCUMENT_EXTRACTION_MODEL = priorModel;
    if (priorSelftest === undefined) delete process.env.SELFTEST;
    else process.env.SELFTEST = priorSelftest;
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
  }
});

test('E46 membership identity, role, primary status, peer rows, and deletion are server-controlled', async () => {
  const memberships = await requestJson(server, appRoute(`/entities/OrganizationMember?q=${encodeURIComponent(JSON.stringify({ org_id: tenantA.id }))}`), {
    token: userA.token,
  });
  assert.equal(memberships.status, 200, memberships.text);
  const own = memberships.body.find((row) => row.user_email === userA.email);
  const peer = memberships.body.find((row) => row.user_email === colleagueA.email);
  assert.ok(own?.id && peer?.id);

  for (const [id, body, expected] of [
    [own.id, { role: 'owner' }, 403],
    [own.id, { is_primary: false }, 403],
    [peer.id, { role: 'owner' }, 404],
  ]) {
    const result = await requestJson(server, appRoute(`/entities/OrganizationMember/${id}`), {
      method: 'PUT', token: userA.token, body,
    });
    assert.equal(result.status, expected, result.text);
  }
  const singleDelete = await requestJson(server, appRoute(`/entities/OrganizationMember/${peer.id}`), {
    method: 'DELETE', token: userA.token,
  });
  assert.equal(singleDelete.status, 403, singleDelete.text);
  const bulkDelete = await requestJson(server, appRoute('/entities/OrganizationMember'), {
    method: 'DELETE', token: userA.token, body: { org_id: tenantA.id },
  });
  assert.equal(bulkDelete.status, 403, bulkDelete.text);
  const updateMany = await requestJson(server, appRoute('/entities/OrganizationMember/update-many'), {
    method: 'PATCH', token: userA.token,
    body: { query: { org_id: tenantA.id }, data: { role: 'owner' } },
  });
  assert.equal(updateMany.status, 403, updateMany.text);

  const after = await requestJson(server, appRoute(`/entities/OrganizationMember?q=${encodeURIComponent(JSON.stringify({ org_id: tenantA.id }))}`), {
    token: userA.token,
  });
  assert.equal(after.body.find((row) => row.id === own.id).role, own.role);
  assert.equal(after.body.find((row) => row.id === own.id).is_primary, own.is_primary);
  assert.ok(after.body.some((row) => row.id === peer.id));
});

test('E47 clinical child references must belong to the same explicit organisation', async () => {
  const foreignClient = await requestJson(server, appRoute('/entities/Client'), {
    method: 'POST', token: userB.token,
    body: { org_id: tenantB.id, full_name: 'Foreign Reference Boundary' },
  });
  assert.equal(foreignClient.status, 200, foreignClient.text);
  const result = await requestJson(server, appRoute('/entities/ClientAssessment'), {
    method: 'POST', token: userA.token,
    body: {
      org_id: tenantA.id,
      client_id: foreignClient.body.id,
      assessment_id: 'synthetic-assessment-id',
      result_value: 42,
      notes: 'must never cross tenant',
    },
  });
  assert.equal(result.status, 404, result.text);
  const listed = await requestJson(server, appRoute('/entities/ClientAssessment'), { token: userA.token });
  assert.equal(listed.body.some((row) => row.client_id === foreignClient.body.id), false);
});

test('E48 removing a bound reference or deleting its entity isolates retained bytes from ordinary access', async () => {
  const client = await requestJson(server, appRoute('/entities/Client'), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, full_name: 'Bound Lifecycle Boundary' },
  });
  assert.equal(client.status, 200, client.text);

  const first = await uploadReferral(userA, tenantA.id, pdfFixture(), 'replace-bound.pdf', 'application/pdf');
  const firstDocument = await requestJson(server, appRoute('/entities/ClientDocument'), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, client_id: client.body.id, name: 'Replace me', file_url: first.file_url },
  });
  assert.equal(firstDocument.status, 200, firstDocument.text);
  const firstPath = path.join(server.uploadsDir, getUploadRow(first.upload_id).stored_name);
  assert.equal(fs.existsSync(firstPath), true);
  const removedReference = await requestJson(server, appRoute(`/entities/ClientDocument/${firstDocument.body.id}`), {
    method: 'PUT', token: userA.token, body: { file_url: null },
  });
  assert.equal(removedReference.status, 200, removedReference.text);
  assert.equal(getUploadRow(first.upload_id).lifecycle_state, 'expired');
  assert.equal(getUploadRow(first.upload_id).original_name, 'replace-bound.pdf');
  assert.equal(fs.existsSync(firstPath), true);
  const firstAccess = await fetch(`${server.baseUrl}/api/files/${first.upload_id}`, {
    headers: { Authorization: `Bearer ${userA.token}` },
  });
  assert.equal(firstAccess.status, 404);

  const second = await uploadReferral(userA, tenantA.id, pdfFixture(), 'delete-bound.pdf', 'application/pdf');
  const secondDocument = await requestJson(server, appRoute('/entities/ClientDocument'), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, client_id: client.body.id, name: 'Delete me', file_url: second.file_url },
  });
  assert.equal(secondDocument.status, 200, secondDocument.text);
  const secondPath = path.join(server.uploadsDir, getUploadRow(second.upload_id).stored_name);
  const deleted = await requestJson(server, appRoute(`/entities/ClientDocument/${secondDocument.body.id}`), {
    method: 'DELETE', token: userA.token,
  });
  assert.equal(deleted.status, 200, deleted.text);
  assert.equal(getUploadRow(second.upload_id).lifecycle_state, 'expired');
  assert.equal(fs.existsSync(secondPath), true);
  const secondAccess = await fetch(`${server.baseUrl}/api/files/${second.upload_id}`, {
    headers: { Authorization: `Bearer ${userA.token}` },
  });
  assert.equal(secondAccess.status, 404);
  const db = openAssuranceDb();
  try {
    const events = db.prepare(`
      SELECT event_type, outcome, metadata_json FROM upload_audit
      WHERE upload_id IN (?, ?) AND event_type = 'bound_upload_isolated'
      ORDER BY created_at ASC
    `).all(first.upload_id, second.upload_id);
    assert.equal(events.length, 2);
    for (const event of events) {
      assert.equal(event.outcome, 'retained');
      assert.deepEqual(JSON.parse(event.metadata_json), {
        state_from: 'bound',
        state_to: 'expired',
        code: 'source_record_reference_removed',
      });
    }
    const dispositions = db.prepare(`
      SELECT * FROM upload_disposition
      WHERE upload_id IN (?, ?)
      ORDER BY upload_id ASC
    `).all(first.upload_id, second.upload_id);
    assert.equal(dispositions.length, 2);
    for (const disposition of dispositions) {
      assert.equal(disposition.org_id, tenantA.id);
      assert.equal(disposition.status, 'review-required');
      assert.equal(disposition.reason_code, 'source_record_reference_removed');
      assert.equal(disposition.planned_action, 'determine-lawful-retention-transfer-or-deletion');
      assert.equal(disposition.updated_at, disposition.recorded_at);
      const reviewInterval = Date.parse(disposition.review_due_at) - Date.parse(disposition.recorded_at);
      assert.equal(reviewInterval, 30 * 24 * 60 * 60 * 1000);
    }
  } finally {
    db.close();
  }
});

test('E49 unbound files and signed grants remain uploader-private and expire immediately', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'signed-private.pdf', 'application/pdf');
  const before = getUploadRow(uploadRef.upload_id);
  const direct = await fetch(`${server.baseUrl}/api/files/${uploadRef.upload_id}`, {
    headers: { Authorization: `Bearer ${colleagueA.token}` },
  });
  assert.equal(direct.status, 404);
  const colleagueGrant = await requestJson(server, appRoute('/integration-endpoints/Core/CreateFileAccessUrl'), {
    method: 'POST', token: colleagueA.token,
    body: { org_id: tenantA.id, upload_id: uploadRef.upload_id },
  });
  assert.equal(colleagueGrant.status, 404, colleagueGrant.text);
  const colleagueExtraction = await extract(colleagueA, {
    org_id: tenantA.id, upload_id: uploadRef.upload_id, json_schema: REFERRAL_SCHEMA,
  });
  assert.equal(colleagueExtraction.status, 404, colleagueExtraction.text);
  assert.equal(fakeProvider.calls.length, 0);

  const grant = await requestJson(server, appRoute('/integration-endpoints/Core/CreateFileAccessUrl'), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, upload_id: uploadRef.upload_id },
  });
  assert.equal(grant.status, 200, grant.text);
  const ranged = await fetch(`${server.baseUrl}${grant.body.file_url}`, { headers: { Range: 'bytes=0-4' } });
  assert.equal(ranged.status, 206);
  assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), pdfFixture().subarray(0, 5));

  setUploadState(uploadRef.upload_id, 'temporary', { expiresAt: new Date(Date.now() - 1_000).toISOString() });
  const expiredGrant = await fetch(`${server.baseUrl}${grant.body.file_url}`);
  assert.equal(expiredGrant.status, 404);
  const after = getUploadRow(uploadRef.upload_id);
  assert.equal(after.original_name, before.original_name);
  assert.equal(after.deleted_at, before.deleted_at);
  const db = openAssuranceDb();
  try {
    const access = db.prepare(`
      SELECT metadata_json FROM upload_audit
      WHERE upload_id = ? AND event_type = 'upload_accessed'
      ORDER BY created_at DESC LIMIT 1
    `).get(uploadRef.upload_id);
    const metadata = JSON.parse(access.metadata_json);
    assert.deepEqual(metadata, { signed_url: true, range_request: true, range_start: 0, range_end: 4 });
  } finally {
    db.close();
  }
});

test('E50 audio transcription resolver enforces uploader ownership and expiry before any provider path', async () => {
  const audio = await expectUploaded(await upload(userA, tenantA.id, {
    bytes: wavFixture(), filename: 'private-audio.wav', mediaType: 'audio/wav', purpose: 'audio-transcription',
  }));
  const colleague = await requestJson(server, appRoute('/functions/transcribeSession'), {
    method: 'POST', token: colleagueA.token,
    body: { action: 'transcribe', audio_url: audio.file_url, org_id: tenantA.id },
  });
  assert.equal(colleague.status, 404, colleague.text);
  setUploadState(audio.upload_id, 'temporary', { expiresAt: new Date(Date.now() - 1_000).toISOString() });
  const expired = await requestJson(server, appRoute('/functions/transcribeSession'), {
    method: 'POST', token: userA.token,
    body: { action: 'transcribe', audio_url: audio.file_url, org_id: tenantA.id },
  });
  assert.equal(expired.status, 404, expired.text);
});

test('E51 unregistered legacy filenames cannot be claimed through client-writable references', async () => {
  const storedName = 'legacy-claim-boundary.pdf';
  const legacyPath = path.join(server.uploadsDir, storedName);
  fs.writeFileSync(legacyPath, pdfFixture());
  try {
    const client = await requestJson(server, appRoute('/entities/Client'), {
      method: 'POST', token: userA.token,
      body: { org_id: tenantA.id, full_name: 'Legacy Claim Boundary' },
    });
    const document = await requestJson(server, appRoute('/entities/ClientDocument'), {
      method: 'POST', token: userA.token,
      body: { org_id: tenantA.id, client_id: client.body.id, name: 'Untrusted legacy reference', file_url: `/uploads/${storedName}` },
    });
    assert.equal(document.status, 200, document.text);
    const access = await fetch(`${server.baseUrl}/uploads/${storedName}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    assert.equal(access.status, 404);
    const db = openAssuranceDb();
    try {
      assert.equal(db.prepare('SELECT id FROM upload_registry WHERE stored_name = ?').get(storedName), undefined);
    } finally {
      db.close();
    }
  } finally {
    if (fs.existsSync(legacyPath)) fs.rmSync(legacyPath);
  }
});

test('E52 bulk update keeps each upload binding aligned with its actual updated record', async () => {
  const client = await requestJson(server, appRoute('/entities/Client'), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, full_name: 'Bulk Alignment Boundary' },
  });
  const document = await requestJson(server, appRoute('/entities/ClientDocument'), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, client_id: client.body.id, name: 'Bulk target' },
  });
  const skippedUpload = await uploadReferral(userA, tenantA.id, pdfFixture(), 'bulk-skipped.pdf', 'application/pdf');
  const appliedUpload = await uploadReferral(userA, tenantA.id, pdfFixture(), 'bulk-applied.pdf', 'application/pdf');
  const result = await requestJson(server, appRoute('/entities/ClientDocument/bulk'), {
    method: 'PUT', token: userA.token,
    body: [
      { id: '00000000-0000-4000-8000-000000000000', org_id: tenantA.id, file_url: skippedUpload.file_url },
      { id: document.body.id, org_id: tenantA.id, file_url: appliedUpload.file_url },
    ],
  });
  assert.equal(result.status, 200, result.text);
  assert.equal(result.body.length, 1);
  assert.equal(getUploadRow(skippedUpload.upload_id).lifecycle_state, 'temporary');
  const applied = getUploadRow(appliedUpload.upload_id);
  assert.equal(applied.lifecycle_state, 'bound');
  assert.equal(applied.bound_entity_id, document.body.id);
});

test('E53 oversized and over-deep request structures are rejected instead of silently truncating upload-reference scans', async () => {
  const client = await requestJson(server, appRoute('/entities/Client'), {
    method: 'POST', token: userA.token,
    body: { org_id: tenantA.id, full_name: 'Reference Complexity Boundary' },
  });
  assert.equal(client.status, 200, client.text);
  const syntheticFileReference = `/uploads/${randomUUID()}`;
  const before = await requestJson(server, appRoute('/entities/ClientDocument'), { token: userA.token });

  const oversized = {};
  for (let index = 0; index < 1000; index += 1) oversized[`f${index}`] = index;
  oversized.hidden_file_reference = syntheticFileReference;
  const oversizedResult = await requestJson(server, appRoute('/entities/ClientDocument'), {
    method: 'POST', token: userA.token,
    body: {
      org_id: tenantA.id,
      client_id: client.body.id,
      name: 'Must reject oversized reference tree',
      metadata: oversized,
    },
  });
  assert.equal(oversizedResult.status, 400, oversizedResult.text);

  let overDeep = syntheticFileReference;
  for (let depth = 0; depth < 13; depth += 1) overDeep = { next: overDeep };
  const deepResult = await requestJson(server, appRoute('/entities/ClientDocument'), {
    method: 'POST', token: userA.token,
    body: {
      org_id: tenantA.id,
      client_id: client.body.id,
      name: 'Must reject deep reference tree',
      metadata: overDeep,
    },
  });
  assert.equal(deepResult.status, 400, deepResult.text);

  const after = await requestJson(server, appRoute('/entities/ClientDocument'), { token: userA.token });
  assert.equal(after.body.length, before.body.length, 'rejected structures must not create a clinical row');
});

test('E54 an incomplete cleanup reference scan is isolated once and never recurs', async () => {
  const uploadId = randomUUID();
  const storedName = `${uploadId}.pdf`;
  const fileUrl = `/uploads/${uploadId}`;
  const bytes = pdfFixture();
  const filePath = path.join(server.uploadsDir, storedName);
  const recordId = randomUUID();
  const overflow = {};
  for (let index = 0; index < 1000; index += 1) overflow[`f${index}`] = index;
  overflow.hidden_file_reference = fileUrl;
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  const db = openAssuranceDb();
  try {
    fs.writeFileSync(filePath, bytes, { flag: 'wx' });
    db.prepare(`
      INSERT INTO upload_registry (
        id, stored_name, original_name, org_id, uploader_user_id, purpose,
        detected_mime, byte_size, sha256, lifecycle_state, subject_age_band,
        created_at, expires_at, is_legacy
      ) VALUES (?, ?, 'cleanup-incomplete-scan.pdf', ?, ?, 'referral-extraction',
                'application/pdf', ?, ?, 'expired', '13_or_over', ?, ?, 0)
    `).run(
      uploadId,
      storedName,
      tenantA.id,
      userA.id,
      bytes.length,
      createHash('sha256').update(bytes).digest('hex'),
      expiredAt,
      expiredAt,
    );
    db.prepare(`
      INSERT INTO entity_ClientDocument (id, data, created_date, updated_date, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      recordId,
      JSON.stringify({ org_id: tenantA.id, client_id: randomUUID(), name: 'Synthetic legacy overflow', overflow }),
      expiredAt,
      expiredAt,
      userA.email,
    );
    const { cleanupExpiredUploads } = await import('../uploadRegistry.mjs');
    const first = cleanupExpiredUploads({ db, uploadsDir: server.uploadsDir, now: new Date() });
    assert.ok(first.examined >= 1);
    assert.ok(first.isolated >= 1);
    const isolated = db.prepare('SELECT * FROM upload_registry WHERE id = ?').get(uploadId);
    assert.equal(isolated.lifecycle_state, 'expired');
    assert.equal(isolated.expires_at, null);
    assert.equal(fs.existsSync(filePath), true, 'incomplete scans must retain bytes for disposition review');
    const disposition = db.prepare('SELECT * FROM upload_disposition WHERE upload_id = ?').get(uploadId);
    assert.equal(disposition.status, 'review-required');
    assert.equal(disposition.reason_code, 'cleanup_reference_scan_incomplete');

    const second = cleanupExpiredUploads({ db, uploadsDir: server.uploadsDir, now: new Date() });
    assert.equal(second.examined, 0, 'isolated incomplete scans must not recur every minute');

    db.prepare('DELETE FROM entity_ClientDocument WHERE id = ?').run(recordId);
    db.prepare('UPDATE upload_registry SET expires_at = ? WHERE id = ?').run(expiredAt, uploadId);
    const finalCleanup = cleanupExpiredUploads({ db, uploadsDir: server.uploadsDir, now: new Date() });
    assert.ok(finalCleanup.removed >= 1);
    assert.equal(db.prepare('SELECT lifecycle_state FROM upload_registry WHERE id = ?').get(uploadId).lifecycle_state, 'deleted');
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    db.prepare('DELETE FROM entity_ClientDocument WHERE id = ?').run(recordId);
    db.close();
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
  }
});

test('E55 a multi-file provider failure shortens every unbound upload before the first provider response', async () => {
  fakeProvider.reset();
  fakeProvider.setModeSequence(['semantic', 'provider-500']);
  const primary = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('primary'),
    'failure-retention-primary.csv',
    'text/csv',
  );
  const additional = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('additional'),
    'failure-retention-additional.csv',
    'text/csv',
  );
  const uploadIds = [primary.upload_id, additional.upload_id];
  const originalExpiries = uploadIds.map((uploadId) => Date.parse(getUploadRow(uploadId).expires_at));
  let preResponseSnapshot = null;
  let preResponseObservedAt = null;
  fakeProvider.setBeforeRespond(() => {
    if (preResponseSnapshot) return;
    preResponseObservedAt = Date.now();
    preResponseSnapshot = uploadIds.map((uploadId) => getUploadRow(uploadId));
  });

  try {
    const result = await extract(colleagueA, {
      file_urls: [primary.file_url, additional.file_url],
      org_id: tenantA.id,
      json_schema: REFERRAL_SCHEMA,
    });
    assertControlledFailure(result);
    assert.equal(result.status, 502, result.text);
    assert.equal(result.body?.code, 'provider_error');
    assert.equal(fakeProvider.calls.length, 2, 'the later per-file provider call must be the controlled failure');
    assert.ok(preResponseSnapshot, 'the fake provider must capture lifecycle state before its first response');

    for (const [index, row] of preResponseSnapshot.entries()) {
      const shortenedExpiry = Date.parse(row.expires_at);
      assert.equal(row.lifecycle_state, 'processing');
      assert.ok(Number.isFinite(shortenedExpiry), row.expires_at);
      assert.ok(shortenedExpiry < originalExpiries[index], 'provider preflight must shorten the original referral TTL');
      assert.ok(
        shortenedExpiry <= preResponseObservedAt + 60 * 60 * 1000,
        `failure cleanup exceeds one hour before provider response: ${row.expires_at}`,
      );

      const afterFailure = getUploadRow(row.id);
      assert.equal(afterFailure.lifecycle_state, 'temporary');
      assert.ok(
        Date.parse(afterFailure.expires_at) <= shortenedExpiry,
        'failure handling must retain or further shorten the pre-provider expiry',
      );
    }
  } finally {
    fakeProvider.reset();
  }
});

test('E56 a later-file local integrity failure makes zero provider calls and retains every shortened expiry', async () => {
  fakeProvider.reset();
  const primary = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('primary'),
    'local-integrity-primary.csv',
    'text/csv',
  );
  const additional = await uploadReferral(
    colleagueA,
    tenantA.id,
    canonicalMultiFileCsvFixture('additional'),
    'local-integrity-additional.csv',
    'text/csv',
  );
  const uploadIds = [primary.upload_id, additional.upload_id];
  const originalExpiries = uploadIds.map((uploadId) => Date.parse(getUploadRow(uploadId).expires_at));
  const additionalRow = getUploadRow(additional.upload_id);
  fs.appendFileSync(path.join(server.uploadsDir, additionalRow.stored_name), Buffer.from([0]));

  const attemptStartedAt = Date.now();
  const result = await extract(colleagueA, {
    file_urls: [primary.file_url, additional.file_url],
    org_id: tenantA.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assert.equal(result.status, 409, result.text);
  assert.equal(result.body?.code, 'upload_integrity_failed');
  assert.equal(fakeProvider.calls.length, 0, 'all local file reads must finish before the first provider request');

  const db = openAssuranceDb();
  try {
    for (const [index, uploadId] of uploadIds.entries()) {
      const row = db.prepare('SELECT * FROM upload_registry WHERE id = ?').get(uploadId);
      const shortenedExpiry = Date.parse(row.expires_at);
      assert.equal(row.lifecycle_state, 'temporary');
      assert.ok(shortenedExpiry < originalExpiries[index], 'local preflight must shorten the original referral TTL');
      assert.ok(
        shortenedExpiry <= attemptStartedAt + 60 * 60 * 1000,
        `failed local preflight exceeds one-hour retention: ${row.expires_at}`,
      );
      const transitions = db.prepare(`
        SELECT metadata_json FROM upload_audit
        WHERE upload_id = ? AND event_type = 'upload_state_changed'
        ORDER BY created_at ASC, id ASC
      `).all(uploadId).map((audit) => JSON.parse(audit.metadata_json));
      assert.ok(
        transitions.some((transition) => transition.state_to === 'processing'),
        'each selected upload must enter the shortened processing state before local read completion',
      );
      assert.ok(
        transitions.some((transition) => transition.state_from === 'processing' && transition.state_to === 'temporary'),
        'each already-processing upload must return to temporary without restoring its prior TTL',
      );
    }
  } finally {
    db.close();
    fakeProvider.reset();
  }
});

test('E57 repeated failed extraction retries cannot extend the first shortened expiry', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('provider-500');
  const uploadRef = await uploadReferral(
    userA,
    tenantA.id,
    pdfFixture(),
    'failure-retention-retry.pdf',
    'application/pdf',
  );

  const firstAttemptStartedAt = Date.now();
  const first = await extract(userA, {
    upload_id: uploadRef.upload_id,
    org_id: tenantA.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assert.equal(first.status, 502, first.text);
  const firstExpiry = Date.parse(getUploadRow(uploadRef.upload_id).expires_at);
  assert.ok(firstExpiry <= firstAttemptStartedAt + 60 * 60 * 1000);

  await new Promise((resolve) => setTimeout(resolve, 25));
  const secondAttemptStartedAt = Date.now();
  const second = await extract(userA, {
    upload_id: uploadRef.upload_id,
    org_id: tenantA.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assert.equal(second.status, 502, second.text);
  const afterRetry = getUploadRow(uploadRef.upload_id);
  const secondExpiry = Date.parse(afterRetry.expires_at);
  assert.equal(afterRetry.lifecycle_state, 'temporary');
  assert.ok(secondAttemptStartedAt > firstAttemptStartedAt);
  assert.ok(secondExpiry <= firstExpiry, 'a later failed retry must not restart the failure-retention clock');
  assert.ok(secondExpiry <= secondAttemptStartedAt + 60 * 60 * 1000);
  assert.equal(fakeProvider.calls.length, 2);
  fakeProvider.reset();
});

test('E58 the first cleanup tick at a shortened failure expiry removes bytes and terminalizes metadata', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('provider-500');
  const uploadRef = await uploadReferral(
    userA,
    tenantA.id,
    pdfFixture(),
    'failure-retention-cleanup.pdf',
    'application/pdf',
  );
  const result = await extract(userA, {
    upload_id: uploadRef.upload_id,
    org_id: tenantA.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assert.equal(result.status, 502, result.text);

  const failedRow = getUploadRow(uploadRef.upload_id);
  const filePath = path.join(server.uploadsDir, failedRow.stored_name);
  const firstEligibleTick = new Date(failedRow.expires_at);
  assert.equal(failedRow.lifecycle_state, 'temporary');
  assert.equal(fs.existsSync(filePath), true);

  const { cleanupExpiredUploads } = await import('../uploadRegistry.mjs');
  const db = openAssuranceDb();
  try {
    const cleanup = cleanupExpiredUploads({
      db,
      uploadsDir: server.uploadsDir,
      now: firstEligibleTick,
      dryRun: false,
    });
    assert.ok(cleanup.examined >= 1);
    assert.ok(cleanup.removed >= 1);
    const terminal = db.prepare('SELECT * FROM upload_registry WHERE id = ?').get(uploadRef.upload_id);
    assert.equal(terminal.lifecycle_state, 'deleted');
    assert.equal(terminal.deleted_at, firstEligibleTick.toISOString());
    assert.equal(terminal.expires_at, failedRow.expires_at, 'cleanup must preserve the bounded failure deadline');
    assert.equal(terminal.original_name, '[deleted]');
    assert.equal(fs.existsSync(filePath), false, 'the first eligible maintenance tick must physically remove bytes');

    const cleanupAudit = db.prepare(`
      SELECT outcome, metadata_json FROM upload_audit
      WHERE upload_id = ? AND event_type = 'upload_cleanup'
      ORDER BY created_at DESC, id DESC LIMIT 1
    `).get(uploadRef.upload_id);
    assert.equal(cleanupAudit?.outcome, 'removed');
    assert.deepEqual(JSON.parse(cleanupAudit.metadata_json), {
      dry_run: false,
      state_from: 'temporary',
      state_to: 'deleted',
    });
    assert.doesNotMatch(cleanupAudit.metadata_json, /failure-retention-cleanup|Alex River|file_data|input_file/i);
  } finally {
    db.close();
    fakeProvider.reset();
  }
});
