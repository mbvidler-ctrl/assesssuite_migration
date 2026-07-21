import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { after, before, test } from 'node:test';

import { handleCoreIntegration } from '../integrations.mjs';
import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
} from '../../src/lib/referralWorkflow.js';
import {
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
} from '../uploadRegistry.mjs';
import { REFERRAL_EXTRACTION_SCHEMA } from '../../src/lib/referralExtractionSchema.js';
import { pdfFixture } from './support/syntheticReferralFixtures.mjs';
import {
  activateUser,
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_MARKER = 'SYNTHETIC_PRIVATE_REFERRAL_MARKER';

let server;
let user;
let organization;

function appRoute(suffix) {
  return `/api/apps/${server.appId}${suffix}`;
}

function openDb() {
  return new DatabaseSync(server.dbPath);
}

async function upload(form) {
  const response = await fetch(`${server.baseUrl}${appRoute('/integration-endpoints/Core/UploadFile')}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, 'X-App-Id': server.appId },
    body: form,
  });
  const text = await response.text();
  return { status: response.status, text, body: JSON.parse(text) };
}

function referralForm(bytes, filename, mediaType = 'application/pdf') {
  const form = new FormData();
  form.set('org_id', organization.id);
  form.set('purpose', 'referral-extraction');
  form.set('processing_authority_confirmed', 'true');
  form.set(
    'processing_authority_attestation_version',
    REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
  );
  form.set('subject_age_confirmation', REFERRAL_SUBJECT_AGE_CONFIRMATION);
  form.set('subject_age_attestation_version', REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION);
  form.set('file', new File([bytes], filename, { type: mediaType }));
  return form;
}

function diagnosticLogWindow(diagnosticReference) {
  const output = server.getOutput();
  const index = output.indexOf(diagnosticReference);
  assert.ok(index >= 0, `diagnostic reference ${diagnosticReference} was not logged`);
  return output.slice(Math.max(0, index - 300), index + 500);
}

before(async () => {
  server = await startTestServer({ DOCUMENT_EXTRACTION_ENABLED: '0' });
  const adminToken = await loginAdmin(server);
  user = await registerUser(server, 'diagnostics-user@synthetic.test');
  await activateUser(server, adminToken, user.id);
  organization = await createOrganizationForUser(server, adminToken, user);
  const acceptance = await requestJson(
    server,
    appRoute('/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
    {
      method: 'POST',
      token: user.token,
      body: { org_id: organization.id, marketing_opt_in: false },
    },
  );
  assert.equal(acceptance.status, 200, acceptance.text);
});

after(async () => {
  await server?.stop();
});

test('pre-registration UploadFile refusal returns and logs only an opaque allowlisted diagnostic', async () => {
  const db = openDb();
  const beforeUploads = Number(db.prepare('SELECT COUNT(*) AS n FROM upload_registry').get().n);
  db.close();

  const result = await upload(
    referralForm(Buffer.from(`${PRIVATE_MARKER}: not a PDF`), `${PRIVATE_MARKER}.pdf`),
  );

  assert.equal(result.status, 415, result.text);
  assert.deepEqual(Object.keys(result.body).sort(), ['code', 'diagnostic_reference', 'error', 'stage']);
  assert.equal(result.body.code, 'unsupported_or_mismatched_file');
  assert.equal(result.body.stage, 'upload_validation');
  assert.equal(result.body.error, 'The file type is unsupported or does not match its contents.');
  assert.match(result.body.diagnostic_reference, UUID_V4);
  assert.doesNotMatch(result.text, new RegExp(PRIVATE_MARKER));

  const logWindow = diagnosticLogWindow(result.body.diagnostic_reference);
  assert.match(logWindow, /stage: 'upload_validation'/);
  assert.match(logWindow, /code: 'unsupported_or_mismatched_file'/);
  for (const forbidden of [PRIVATE_MARKER, user.id, organization.id, user.email]) {
    assert.equal(logWindow.includes(forbidden), false, `diagnostic log included ${forbidden}`);
  }

  const auditDb = openDb();
  try {
    const afterUploads = Number(auditDb.prepare('SELECT COUNT(*) AS n FROM upload_registry').get().n);
    const diagnosticAuditRows = Number(
      auditDb.prepare('SELECT COUNT(*) AS n FROM upload_audit WHERE metadata_json LIKE ?')
        .get(`%${result.body.diagnostic_reference}%`).n,
    );
    assert.equal(afterUploads, beforeUploads);
    assert.equal(diagnosticAuditRows, 0, 'pre-registration refusal must not create a dummy audit row');
  } finally {
    auditDb.close();
  }
});

test('disabled extraction correlates the response and safe log without a durable audit side effect', async () => {
  const uploaded = await upload(referralForm(pdfFixture(), `${PRIVATE_MARKER}-registered.pdf`));
  assert.equal(uploaded.status, 200, uploaded.text);

  const result = await requestJson(
    server,
    appRoute('/integration-endpoints/Core/ExtractDataFromUploadedFile'),
    {
      method: 'POST',
      token: user.token,
      body: {
        org_id: organization.id,
        upload_id: uploaded.body.upload_id,
        processing_authority_confirmed: true,
        processing_authority_attestation_version:
          REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
        json_schema: REFERRAL_EXTRACTION_SCHEMA,
      },
    },
  );

  assert.equal(result.status, 503, result.text);
  assert.deepEqual(
    Object.keys(result.body).sort(),
    ['code', 'details', 'diagnostic_reference', 'stage', 'status'],
  );
  assert.equal(result.body.status, 'error');
  assert.equal(result.body.code, 'extraction_disabled');
  assert.equal(result.body.stage, 'provider_configuration');
  assert.equal(result.body.details, 'Document extraction is currently unavailable.');
  assert.match(result.body.diagnostic_reference, UUID_V4);

  const logWindow = diagnosticLogWindow(result.body.diagnostic_reference);
  assert.match(logWindow, /stage: 'provider_configuration'/);
  assert.match(logWindow, /code: 'extraction_disabled'/);
  for (const forbidden of [PRIVATE_MARKER, user.id, organization.id, uploaded.body.upload_id, user.email]) {
    assert.equal(logWindow.includes(forbidden), false, `diagnostic log included ${forbidden}`);
  }

  const db = openDb();
  try {
    const rows = Number(db.prepare(`
      SELECT COUNT(*) AS n FROM upload_audit
      WHERE upload_id = ? AND event_type = 'document_extraction'
    `).get(uploaded.body.upload_id).n);
    assert.equal(
      rows,
      0,
      'the rollback kill-switch must refuse before any durable extraction audit write',
    );
  } finally {
    db.close();
  }
});

test('an arbitrary internal exception cannot select an allowlisted code or leak its message', async () => {
  const form = new FormData();
  form.set('org_id', 'synthetic-org');
  form.set('purpose', 'referral-extraction');
  form.set('processing_authority_confirmed', 'true');
  form.set(
    'processing_authority_attestation_version',
    REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
  );
  form.set('subject_age_confirmation', REFERRAL_SUBJECT_AGE_CONFIRMATION);
  form.set('subject_age_attestation_version', REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION);
  form.set('file', new File([pdfFixture()], `${PRIVATE_MARKER}.pdf`, { type: 'application/pdf' }));
  const encoded = new Request('http://127.0.0.1/upload', { method: 'POST', body: form });
  const req = Readable.from([Buffer.from(await encoded.arrayBuffer())]);
  req.headers = Object.fromEntries(encoded.headers.entries());

  let statusCode = null;
  let responseBody = '';
  const res = {
    headersSent: false,
    writeHead(status) {
      statusCode = status;
      this.headersSent = true;
    },
    end(chunk = '') {
      responseBody += String(chunk);
    },
  };
  const thrown = new Error(`${PRIVATE_MARKER}: arbitrary internal detail`);
  thrown.httpStatus = 418;
  thrown.code = 'unsupported_or_mismatched_file';
  const events = [];
  const originalConsoleError = console.error;
  console.error = (...args) => events.push(args);
  try {
    await handleCoreIntegration(req, res, {
      endpointName: 'UploadFile',
      sessionUser: { id: 'synthetic-user', email: 'synthetic@invalid.test', account_status: 'active' },
      orgIds: ['synthetic-org'],
      isClinicalUseEligible: () => true,
      hasCurrentLegalAcceptance: () => true,
      uploadRegistry: {
        register() {
          throw thrown;
        },
      },
    });
  } finally {
    console.error = originalConsoleError;
  }

  const body = JSON.parse(responseBody);
  assert.equal(statusCode, 500);
  assert.equal(body.code, 'internal_error');
  assert.equal(body.stage, 'upload_registration');
  assert.equal(body.error, 'The request could not be completed.');
  assert.match(body.diagnostic_reference, UUID_V4);
  assert.equal(responseBody.includes(PRIVATE_MARKER), false);
  const serializedEvents = JSON.stringify(events);
  assert.equal(serializedEvents.includes(PRIVATE_MARKER), false);
  assert.equal(serializedEvents.includes('synthetic-user'), false);
  assert.equal(serializedEvents.includes('synthetic-org'), false);
  assert.equal(serializedEvents.includes('synthetic@invalid.test'), false);
  assert.equal(serializedEvents.includes(body.diagnostic_reference), true);
});
