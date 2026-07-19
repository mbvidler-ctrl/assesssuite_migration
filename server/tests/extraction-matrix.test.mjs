import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { startFakeOpenAI } from './support/fake-openai.mjs';
import { resolveDocumentExtractionModel } from '../documentExtraction.mjs';
import {
  MERGED_PROFILE,
  PROFILE_A,
  PROFILE_DOB_CHANGE,
  REFERRAL_SCHEMA,
  csvFixture,
  pdfFixture,
  pngFixture,
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
  subjectDateOfBirth = '2000-01-01',
} = {}) {
  const form = new FormData();
  if (includeOrg && orgId !== undefined) form.set('org_id', orgId);
  form.set('purpose', purpose);
  if (typeof subjectDateOfBirth === 'string') form.set('subject_date_of_birth', subjectDateOfBirth);
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
    method: 'POST', token, body: { processing_authority_confirmed: true, ...body },
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
    assert.deepEqual(Object.keys(result.body).sort(), ['details', 'status']);
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
  assert.equal(fakeProvider.calls.at(-1)?.promptCacheRetention, 'in-memory');
  assert.equal(fakeProvider.calls.at(-1)?.route, '/v1/responses');
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
  assert.equal(result.body.output.date_of_birth, null);
  assert.equal(result.body.output.referrer, null);
  assert.equal(result.body.output.phone, null);
  assert.deepEqual(result.body.output.diagnoses, []);
  assert.doesNotMatch(JSON.stringify(result.body.output), /mock|placeholder|example patient/i);
});

test('E05 dates, enums, arrays, required fields, and scalar types satisfy the submitted schema', async () => {
  fakeProvider.reset();
  const schema = structuredClone(REFERRAL_SCHEMA);
  schema.properties.referrer.enum = ['Dr Synthetic', null];
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'schema-types.pdf', 'application/pdf');
  const result = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: schema });
  assertSuccess(result, PROFILE_A);
  assert.match(result.body.output.date_of_birth, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(result.body.output.diagnoses));
  assert.equal(typeof result.body.output.full_name, 'string');
});

test('E06 multi-file merge applies primary-wins and fill-empty with stable array de-duplication', async () => {
  fakeProvider.reset();
  const primary = await uploadReferral(userA, tenantA.id, csvFixture(), 'merge-primary.csv', 'text/csv');
  const additional = await uploadReferral(userA, tenantA.id, csvFixture('referral-additional.csv'), 'merge-additional.csv', 'text/csv');
  const result = await extract(userA, {
    file_urls: [primary.file_url, additional.file_url], org_id: tenantA.id, json_schema: REFERRAL_SCHEMA,
  });
  assertSuccess(result, MERGED_PROFILE);
  assert.equal(fakeProvider.calls.length, 1);
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
    shapes.push(result.body);
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
  assert.deepEqual({ status: cross.status, body: cross.body }, { status: unknown.status, body: unknown.body });
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

test('E29 controlled failure retains the sanitised {status:error, details} contract', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('malformed');
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'failure-contract.pdf', 'application/pdf');
  const result = await extract(userA, { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA });
  assert.equal(result.body?.status, 'error', result.text);
  assert.deepEqual(Object.keys(result.body).sort(), ['details', 'status']);
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
  assert.equal(getUploadRow(uploadRef.upload_id)?.lifecycle_state, 'review-pending');
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
  assert.equal(Object.hasOwn(created.body, 'referrer'), false);

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
  for (const item of [logo, audio, attachment]) {
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

  const unbound = await uploadReferral(userA, tenantA.id, pdfFixture(), 'cleanup-unbound.pdf', 'application/pdf');
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  setUploadState(unbound.upload_id, 'temporary', { expiresAt: expiredAt });
  const dbForCorruptBoundExpiry = openAssuranceDb();
  dbForCorruptBoundExpiry.prepare('UPDATE upload_registry SET expires_at = ? WHERE id = ?').run(expiredAt, attachment.upload_id);
  dbForCorruptBoundExpiry.close();

  const registryModule = await import('../../server/uploadRegistry.mjs');
  assert.equal(typeof registryModule.cleanupExpiredUploads, 'function');
  const cleanupDb = openAssuranceDb();
  try {
    await registryModule.cleanupExpiredUploads({ db: cleanupDb, uploadsDir: server.uploadsDir, now: new Date(), dryRun: false });
    const unboundAfter = cleanupDb.prepare('SELECT * FROM upload_registry WHERE id = ?').get(unbound.upload_id);
    const boundAfter = cleanupDb.prepare('SELECT * FROM upload_registry WHERE id = ?').get(attachment.upload_id);
    assert.ok(['expired', 'deleted'].includes(unboundAfter.lifecycle_state));
    assert.equal(boundAfter.lifecycle_state, 'bound');
    const boundPath = path.join(server.uploadsDir, boundAfter.stored_name);
    assert.equal(fs.existsSync(boundPath), true);
    const second = await registryModule.cleanupExpiredUploads({ db: cleanupDb, uploadsDir: server.uploadsDir, now: new Date(), dryRun: false });
    assert.ok(second == null || second.deleted === 0 || second.removed === 0 || second.processed === 0);
  } finally {
    cleanupDb.close();
  }
});

test('E33 browser-supplied age labels are rejected and exact date of birth is required', async () => {
  fakeProvider.reset();
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
    filename: 'missing-dob.pdf',
    mediaType: 'application/pdf',
    subjectDateOfBirth: null,
  });
  assert.equal(missing.status, 400, missing.text);
  assert.equal(fakeProvider.calls.length, 0);
});

test('E34 under-13 date of birth fails closed before provider I/O', async () => {
  fakeProvider.reset();
  const underAge = await expectUploaded(await upload(userA, tenantA.id, {
    bytes: pdfFixture(),
    filename: 'under-age.pdf',
    mediaType: 'application/pdf',
    subjectDateOfBirth: new Date().getUTCFullYear() + '-01-01',
  }));
  const result = await extract(userA, {
    upload_id: underAge.upload_id,
    org_id: tenantA.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assert.equal(result.status, 409, result.text);
  assert.equal(result.body?.status, 'error');
  assert.equal(fakeProvider.calls.length, 0);
});

test('E35 missing practitioner processing authority fails before provider I/O', async () => {
  fakeProvider.reset();
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'authority-required.pdf', 'application/pdf');
  const result = await requestJson(server, appRoute(EXTRACTION_ROUTE), {
    method: 'POST',
    token: userA.token,
    body: { upload_id: uploadRef.upload_id, org_id: tenantA.id, json_schema: REFERRAL_SCHEMA },
  });
  assert.equal(result.status, 403, result.text);
  assert.equal(result.body?.status, 'error');
  assert.equal(fakeProvider.calls.length, 0);
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
    assert.deepEqual(Object.keys(authority).sort(), ['attestation_version', 'upload_purpose']);
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
    assert.equal(typeof authority.attestation_version, 'string');
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

test('E43 an authorised bound referral can be re-extracted without changing its retained lifecycle', async () => {
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
  const result = await extract(userA, {
    upload_id: uploadRef.upload_id,
    org_id: tenantA.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assertSuccess(result, PROFILE_A);
  assert.equal(getUploadRow(uploadRef.upload_id).lifecycle_state, 'bound');
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

test('E45 failed provider calls retain bounded policy provenance and production model overrides are prohibited', async () => {
  fakeProvider.reset();
  fakeProvider.setMode('provider-500');
  const uploadRef = await uploadReferral(userA, tenantA.id, pdfFixture(), 'failed-provenance.pdf', 'application/pdf');
  const result = await extract(userA, {
    upload_id: uploadRef.upload_id,
    org_id: tenantA.id,
    json_schema: REFERRAL_SCHEMA,
  });
  assert.equal(result.status, 502, result.text);

  const db = openAssuranceDb();
  try {
    const row = db.prepare(`
      SELECT metadata_json FROM upload_audit
      WHERE upload_id = ? AND event_type = 'document_extraction' AND outcome = 'failed'
      ORDER BY created_at DESC LIMIT 1
    `).get(uploadRef.upload_id);
    const metadata = JSON.parse(row.metadata_json);
    assert.deepEqual(Object.keys(metadata).sort(), [
      'code',
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
    ]);
    assert.match(metadata.schema_hash, /^[0-9a-f]{64}$/);
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
  const invalidSchema = await extract(userA, {
    upload_id: preProvider.upload_id,
    org_id: tenantA.id,
    json_schema: {},
  });
  assert.equal(invalidSchema.status, 400, invalidSchema.text);
  assert.equal(fakeProvider.calls.length, 0);
  const preProviderDb = openAssuranceDb();
  try {
    const row = preProviderDb.prepare(`
      SELECT metadata_json FROM upload_audit
      WHERE upload_id = ? AND event_type = 'document_extraction' AND outcome = 'failed'
      ORDER BY created_at DESC LIMIT 1
    `).get(preProvider.upload_id);
    const metadata = JSON.parse(row.metadata_json);
    assert.deepEqual(Object.keys(metadata).sort(), [
      'code',
      'file_count',
      'provider_contact_attempted',
      'provider_request_constructed',
    ]);
    assert.equal(metadata.provider_request_constructed, false);
    assert.equal(metadata.provider_contact_attempted, false);
  } finally {
    preProviderDb.close();
  }

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
