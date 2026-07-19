import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { startFakeOpenAI } from './support/fake-openai.mjs';
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

test('E36 practitioner cancellation shortens every authorised unbound upload lifecycle', async () => {
  const first = await uploadReferral(userA, tenantA.id, pdfFixture(), 'cancel-one.pdf', 'application/pdf');
  const second = await uploadReferral(userA, tenantA.id, pdfFixture(), 'cancel-two.pdf', 'application/pdf');
  const result = await requestJson(server, appRoute(CANCEL_ROUTE), {
    method: 'POST',
    token: userA.token,
    body: { org_id: tenantA.id, upload_ids: [first.upload_id, second.upload_id] },
  });
  assert.equal(result.status, 200, result.text);
  assert.deepEqual(result.body, { status: 'success', scheduled: 2 });
  const deadline = Date.now() + 60 * 60 * 1000 + 5_000;
  for (const id of [first.upload_id, second.upload_id]) {
    const row = getUploadRow(id);
    assert.equal(row.lifecycle_state, 'temporary');
    assert.ok(Date.parse(row.expires_at) <= deadline);
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
