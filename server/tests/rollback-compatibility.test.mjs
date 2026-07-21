import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';

import {
  LEGAL_DOCUMENTS,
  PRACTITIONER_NOTICE_IDS,
  SUITE_VERSION,
} from '../../src/lib/legal/documentRegistry.js';
import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
} from '../../src/lib/referralWorkflow.js';
import {
  REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
} from '../uploadRegistry.mjs';
import { REFERRAL_EXTRACTION_SCHEMA as REFERRAL_SCHEMA } from '../../src/lib/referralExtractionSchema.js';
import { startFakeOpenAI } from './support/fake-openai.mjs';
import { pdfFixture } from './support/syntheticReferralFixtures.mjs';
import {
  activateUser,
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const EXPECTED_SUPERSEDED_VERSION = 'RC-2026.07.11';
const EXPECTED_CURRENT_VERSION = 'RC-2026.07.19';
const SUPERSEDED_VERSION = process.env.SUPERSEDED_LEGAL_VERSION || EXPECTED_SUPERSEDED_VERSION;
const CURRENT_VERSION = process.env.NEW_LEGAL_VERSION || EXPECTED_CURRENT_VERSION;
const UNKNOWN_VERSION = 'RC-1900.01.01';

function parseReviewedFlyConfig(fileName) {
  const source = fs.readFileSync(path.join(process.cwd(), fileName), 'utf8');
  const values = new Map();
  let section = 'root';
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sectionMatch = line.match(/^\[\[?([^\]]+)\]\]?$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    const assignment = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!assignment) continue;
    const key = `${section}.${assignment[1]}`;
    assert.equal(values.has(key), false, `${fileName} repeats ${key}`);
    values.set(key, assignment[2]);
  }
  return values;
}

let fakeProvider;
let server;
let adminToken;
let fixtures;

function route(suffix) {
  return `/api/apps/${server.appId}${suffix}`;
}

async function createAcceptedUser(version, suffix) {
  const user = await registerUser(server, `synthetic-rollback-${suffix}@example.test`);
  await activateUser(server, adminToken, user.id);
  const org = await createOrganizationForUser(server, adminToken, user);
  if (version === CURRENT_VERSION) {
    const bundle = await requestJson(
      server,
      route('/integration-endpoints/Core/RecordLegalAcceptanceBundle'),
      { method: 'POST', token: user.token, body: { org_id: org.id, marketing_opt_in: false } },
    );
    assert.equal(bundle.status, 200, bundle.text);
    return { user, org };
  }
  for (const documentId of PRACTITIONER_NOTICE_IDS) {
    const doc = LEGAL_DOCUMENTS[documentId];
    const acceptance = await requestJson(server, route('/entities/LegalAcceptanceEvent'), {
      method: 'POST',
      token: adminToken,
      body: {
        event_type: doc.eventType,
        user_email: user.email,
        org_id: org.id,
        suite_version: version,
        document_id: documentId,
        document_title: doc.title,
        actor_capacity: 'synthetic rollback fixture',
      },
    });
    assert.equal(acceptance.status, 200, acceptance.text);
  }
  return { user, org };
}

async function clinicalAccess(fixture) {
  return requestJson(server, route('/entities/Client'), { token: fixture.user.token });
}

async function uploadReferral(fixture) {
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
  form.set('file', new File([pdfFixture()], 'synthetic-rollback.pdf', { type: 'application/pdf' }));
  const response = await fetch(`${server.baseUrl}${route('/integration-endpoints/Core/UploadFile')}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fixture.user.token}`, 'X-App-Id': server.appId },
    body: form,
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.status, 200);
  assert.equal(typeof body?.upload_id, 'string');
  return body;
}

before(async () => {
  assert.equal(SUPERSEDED_VERSION, EXPECTED_SUPERSEDED_VERSION, 'workflow superseded-version input drifted');
  assert.equal(CURRENT_VERSION, EXPECTED_CURRENT_VERSION, 'workflow new-version input drifted');
  assert.equal(SUITE_VERSION, CURRENT_VERSION, 'rollback gate must track the exact current legal-suite version');
  fakeProvider = await startFakeOpenAI();
  server = await startTestServer({
    DOCUMENT_EXTRACTION_ENABLED: '0',
    LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS: `${SUPERSEDED_VERSION},${CURRENT_VERSION}`,
    DOCUMENT_EXTRACTION_TEST_BASE_URL: fakeProvider.baseUrl,
    OPENAI_API_KEY: 'synthetic-rollback-provider-canary',
    OPENAI_DOCUMENT_EXTRACTION_MODEL: 'synthetic-assurance-model',
  });
  adminToken = await loginAdmin(server);
  fixtures = {
    current: await createAcceptedUser(CURRENT_VERSION, 'current'),
    superseded: await createAcceptedUser(SUPERSEDED_VERSION, 'superseded'),
    unknown: await createAcceptedUser(UNKNOWN_VERSION, 'unknown'),
  };
});

after(async () => {
  if (server) await server.stop();
  if (fakeProvider) await fakeProvider.stop();
});

test('R00 rollback config is a same-revision, extraction-disabled posture only', () => {
  const candidate = parseReviewedFlyConfig('fly.production.toml');
  const rollback = parseReviewedFlyConfig('fly.rollback.production.toml');
  assert.equal(candidate.get('env.DOCUMENT_EXTRACTION_ENABLED'), '"1"');
  assert.equal(rollback.get('env.DOCUMENT_EXTRACTION_ENABLED'), '"0"');
  assert.equal(
    rollback.get('env.LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS'),
    '"RC-2026.07.11,RC-2026.07.19"',
  );
  assert.equal(candidate.has('env.LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS'), false);

  const rollbackComparable = new Map(rollback);
  rollbackComparable.set(
    'env.DOCUMENT_EXTRACTION_ENABLED',
    candidate.get('env.DOCUMENT_EXTRACTION_ENABLED'),
  );
  rollbackComparable.delete('env.LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS');
  assert.deepEqual(
    [...rollbackComparable.entries()].sort(),
    [...candidate.entries()].sort(),
    'rollback may differ only by the reviewed extraction switch and legal compatibility allowlist',
  );
});

test('R01 compatibility rollback accepts the new/current legal-suite version', async () => {
  const result = await clinicalAccess(fixtures.current);
  assert.equal(result.status, 200, result.text);
  assert.ok(Array.isArray(result.body));
});

test('R02 compatibility rollback accepts the superseded legal-suite version', async () => {
  const result = await clinicalAccess(fixtures.superseded);
  assert.equal(result.status, 200, result.text);
  assert.ok(Array.isArray(result.body));
});

test('R03 compatibility rollback rejects every version outside the exact allowlist', async () => {
  const result = await clinicalAccess(fixtures.unknown);
  assert.equal(result.status, 403, result.text);
  assert.equal(result.body?.message, 'current legal acceptance required');
});

test('R04 compatibility rollback keeps provider extraction disabled and makes zero provider calls', async () => {
  fakeProvider.reset();
  const upload = await uploadReferral(fixtures.current);
  const beforeDb = new DatabaseSync(server.dbPath, { readOnly: true });
  const beforeRegistry = beforeDb.prepare(`
    SELECT stored_name, lifecycle_state, expires_at, subject_age_band, bound_at
    FROM upload_registry WHERE id = ?
  `).get(upload.upload_id);
  const beforeAuditCount = beforeDb.prepare(
    'SELECT COUNT(*) AS count FROM upload_audit WHERE upload_id = ?',
  ).get(upload.upload_id).count;
  const beforeUsageCount = beforeDb.prepare(
    'SELECT COUNT(*) AS count FROM extraction_usage WHERE org_id = ?',
  ).get(fixtures.current.org.id).count;
  beforeDb.close();
  assert.equal(beforeRegistry.lifecycle_state, 'temporary');
  const uploadPath = path.join(server.uploadsDir, beforeRegistry.stored_name);
  const beforeFile = fs.statSync(uploadPath);

  const extraction = await requestJson(
    server,
    route('/integration-endpoints/Core/ExtractDataFromUploadedFile'),
    {
      method: 'POST',
      token: fixtures.current.user.token,
      body: {
        upload_id: upload.upload_id,
        org_id: fixtures.current.org.id,
        json_schema: REFERRAL_SCHEMA,
        processing_authority_confirmed: true,
        processing_authority_attestation_version:
          REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
      },
    },
  );
  assert.notEqual(extraction.body?.status, 'success', extraction.text);
  assert.equal(extraction.status, 503, extraction.text);
  assert.equal(extraction.body?.code, 'extraction_disabled', extraction.text);
  assert.equal(fakeProvider.calls.length, 0);

  const afterDb = new DatabaseSync(server.dbPath, { readOnly: true });
  const afterRegistry = afterDb.prepare(`
    SELECT stored_name, lifecycle_state, expires_at, subject_age_band, bound_at
    FROM upload_registry WHERE id = ?
  `).get(upload.upload_id);
  const afterAuditCount = afterDb.prepare(
    'SELECT COUNT(*) AS count FROM upload_audit WHERE upload_id = ?',
  ).get(upload.upload_id).count;
  const afterUsageCount = afterDb.prepare(
    'SELECT COUNT(*) AS count FROM extraction_usage WHERE org_id = ?',
  ).get(fixtures.current.org.id).count;
  afterDb.close();
  const afterFile = fs.statSync(uploadPath);
  assert.deepEqual(afterRegistry, beforeRegistry, 'disabled extraction must not mutate upload lifecycle');
  assert.equal(afterAuditCount, beforeAuditCount, 'disabled extraction must not append upload audit events');
  assert.equal(afterUsageCount, beforeUsageCount, 'disabled extraction must not reserve usage');
  assert.equal(afterFile.size, beforeFile.size, 'disabled extraction must not alter source bytes');
  assert.equal(afterFile.mtimeMs, beforeFile.mtimeMs, 'disabled extraction must not rewrite source bytes');
});

test('R05 extraction-enabled runtime cannot use the compatibility allowlist', async () => {
  await server.stop();
  server = null;
  await assert.rejects(
    startTestServer({
      DOCUMENT_EXTRACTION_ENABLED: '1',
      LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS: `${SUPERSEDED_VERSION},${CURRENT_VERSION}`,
      DOCUMENT_EXTRACTION_TEST_BASE_URL: fakeProvider.baseUrl,
      OPENAI_API_KEY: 'synthetic-rollback-provider-canary',
      OPENAI_DOCUMENT_EXTRACTION_MODEL: 'synthetic-assurance-model',
    }),
    /LEGAL_COMPATIBILITY_ACCEPTED_VERSIONS cannot be used while document extraction is enabled/,
  );
});
