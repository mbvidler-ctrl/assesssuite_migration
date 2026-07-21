import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { REFERRAL_REVIEW_COMMIT_VERSION } from '../referralCommit.mjs';
import { REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION } from '../uploadRegistry.mjs';
import { REFERRAL_EXTRACTION_SCHEMA } from '../../src/lib/referralExtractionSchema.js';
import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
} from '../../src/lib/referralWorkflow.js';
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

test('review-time under-13 correction quarantines the referral before any later provider call', async () => {
  const provider = await startFakeOpenAI();
  const server = await startTestServer({
    DOCUMENT_EXTRACTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_TEST_BASE_URL: provider.baseUrl,
    DOCUMENT_EXTRACTION_TEST_TIMEOUT_MS: '500',
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
    OPENAI_API_KEY: 'synthetic-reviewed-age-gate-key',
    OPENAI_DOCUMENT_EXTRACTION_MODEL: 'synthetic-assurance-model',
  });
  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-reviewed-age-gate@example.test');
    await activateUser(server, adminToken, user.id);
    const organization = await createOrganizationForUser(server, adminToken, user);
    const acceptance = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      { method: 'POST', token: user.token, body: { org_id: organization.id, marketing_opt_in: false } },
    );
    assert.equal(acceptance.status, 200, acceptance.text);

    provider.setMode('missing-fields');
    const uploadedFiles = [];
    for (const suffix of ['clean', 'damaged']) {
      const form = new FormData();
      form.set('org_id', organization.id);
      form.set('purpose', 'referral-extraction');
      form.set('processing_authority_confirmed', 'true');
      form.set('processing_authority_attestation_version', REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION);
      form.set('subject_age_confirmation', REFERRAL_SUBJECT_AGE_CONFIRMATION);
      form.set('subject_age_attestation_version', REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION);
      form.set('file', new File(
        [pdfFixture()],
        `synthetic-reviewed-age-gate-${suffix}.pdf`,
        { type: 'application/pdf' },
      ));
      const uploadResponse = await fetch(
        `${server.baseUrl}/api/apps/${server.appId}/integration-endpoints/Core/UploadFile`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.token}`, 'X-App-Id': server.appId },
          body: form,
        },
      );
      const uploaded = await uploadResponse.json();
      assert.equal(uploadResponse.status, 200, JSON.stringify(uploaded));
      uploadedFiles.push(uploaded);

      const initialExtraction = await requestJson(
        server,
        `/api/apps/${server.appId}/integration-endpoints/Core/ExtractDataFromUploadedFile`,
        {
          method: 'POST',
          token: user.token,
          body: {
            upload_id: uploaded.upload_id,
            org_id: organization.id,
            json_schema: REFERRAL_EXTRACTION_SCHEMA,
            processing_authority_confirmed: true,
            processing_authority_attestation_version: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
          },
        },
      );
      assert.equal(initialExtraction.status, 200, initialExtraction.text);
      assert.equal(Object.hasOwn(initialExtraction.body.output, 'date_of_birth'), false);
    }
    assert.equal(provider.calls.length, 2);

    // A bad sibling must not prevent the reviewed under-13 conclusion from
    // provider-blocking the otherwise clean member of the selected set.
    const damagedStoredName = fs.readdirSync(server.uploadsDir)
      .find((name) => name.startsWith(`${uploadedFiles[1].upload_id}.`));
    assert.ok(damagedStoredName);
    fs.appendFileSync(path.join(server.uploadsDir, damagedStoredName), 'synthetic-integrity-fault');

    const commit = await requestJson(
      server,
      `/api/apps/${server.appId}/functions/commitReviewedReferral`,
      {
        method: 'POST',
        token: user.token,
        body: {
          idempotency_key: randomUUID(),
          org_id: organization.id,
          operation: 'create',
          client_id: null,
          review_confirmed: true,
          review_version: REFERRAL_REVIEW_COMMIT_VERSION,
          client: {
            full_name: 'Synthetic Reviewed Minor',
            date_of_birth: '2020-01-02',
            gender: 'other',
          },
          conditions: [],
          upload_ids: uploadedFiles.map((uploaded) => uploaded.upload_id),
          historical_assessments: [],
        },
      },
    );
    assert.equal(commit.status, 409, commit.text);
    assert.equal(commit.body?.code, 'reviewed_subject_under_13');

    const db = new DatabaseSync(server.dbPath);
    try {
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_Client').get().n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_ClientDocument').get().n, 0);
      const uploads = db.prepare(`
        SELECT lifecycle_state, subject_age_band, expires_at
        FROM upload_registry WHERE id IN (?, ?)
        ORDER BY id
      `).all(uploadedFiles[0].upload_id, uploadedFiles[1].upload_id);
      assert.equal(uploads.length, 2);
      for (const upload of uploads) {
        assert.equal(upload.lifecycle_state, 'expired');
        assert.equal(upload.subject_age_band, 'under_13');
        assert.ok(Date.parse(upload.expires_at) <= Date.now(), upload.expires_at);
      }
    } finally {
      db.close();
    }
    for (const uploaded of uploadedFiles) {
      assert.equal(fs.statSync(path.join(server.uploadsDir, `${uploaded.upload_id}.provider-block`)).size, 0);
    }

    provider.reset();
    const retry = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/ExtractDataFromUploadedFile`,
      {
        method: 'POST',
        token: user.token,
        body: {
          upload_id: uploadedFiles[0].upload_id,
          org_id: organization.id,
          json_schema: REFERRAL_EXTRACTION_SCHEMA,
          processing_authority_confirmed: true,
          processing_authority_attestation_version: REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
        },
      },
    );
    assert.equal(retry.status, 404, retry.text);
    assert.equal(provider.calls.length, 0, 'reviewed under-13 files must not re-enter the provider path');
  } finally {
    await server.stop();
    await provider.stop();
  }
});
