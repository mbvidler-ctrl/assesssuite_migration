import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { createClient } from '@base44/sdk';
import { Base44Error } from '@base44/sdk/dist/utils/axios-client.js';

import { REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION } from '../uploadRegistry.mjs';

import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
  resolveReferralOrganization,
} from '../../src/lib/referralWorkflow.js';
import {
  REFERRAL_EXTRACTION_SCHEMA,
  REFERRAL_EXTRACTION_SCHEMA_PROPERTY_COUNT,
  REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS,
  REFERRAL_EXTRACTION_SCHEMA_SHA256,
} from '../../src/lib/referralExtractionSchema.js';
import {
  buildReferralClientData,
  buildReferralConditionData,
  prepareReferralReviewData,
} from '../../src/lib/referralReview.js';
import {
  buildReviewedReferralCommitPayload,
  commitReviewedReferral,
  createReferralCommitIdempotencyKey,
} from '../../src/lib/referralCommit.js';
import { normalizeSdkError, sdkErrorLogMetadata } from '../../src/lib/sdkError.js';
import { startFakeOpenAI } from './support/fake-openai.mjs';
import { CANONICAL_REFERRAL_PROFILE_A, pdfFixture } from './support/synthetic-fixtures.mjs';
import {
  activateUser,
  createOrganizationForUser,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

test('authenticated real-SDK single-practice referral journey auto-resolves ownership, requires review before create, and retains the document', async () => {
  const provider = await startFakeOpenAI();
  const server = await startTestServer({
    DOCUMENT_EXTRACTION_ENABLED: '1',
    DOCUMENT_EXTRACTION_TEST_BASE_URL: provider.baseUrl,
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
    OPENAI_API_KEY: 'synthetic-sdk-journey-key',
    OPENAI_DOCUMENT_EXTRACTION_MODEL: 'synthetic-assurance-model',
  });
  let sdk;

  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-sdk-journey@example.test');
    await activateUser(server, adminToken, user.id);
    const organization = await createOrganizationForUser(server, adminToken, user);
    const acceptance = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      { method: 'POST', token: user.token, body: { org_id: organization.id, marketing_opt_in: false } },
    );
    assert.equal(acceptance.status, 200, acceptance.text);

    sdk = createClient({
      appId: server.appId,
      serverUrl: server.baseUrl,
      token: user.token,
      requiresAuth: false,
    });

    const currentUser = await sdk.auth.me();
    const memberships = await sdk.entities.OrganizationMember.filter({ user_email: currentUser.email });
    const selectedOrgId = resolveReferralOrganization(memberships.map((membership) => ({
      id: membership.org_id,
      isPrimary: membership.is_primary === true,
    })));
    assert.equal(selectedOrgId, organization.id);

    const clientsBefore = await sdk.entities.Client.filter({ org_id: selectedOrgId });
    const upload = await sdk.integrations.Core.UploadFile({
      // The exact client-requested filename is part of the journey contract;
      // the bytes remain the repository-generated synthetic fixture.
      file: new File([pdfFixture()], 'AssessSuite_Demo_GP_Referral(1).pdf', { type: 'application/pdf' }),
      org_id: selectedOrgId,
      purpose: 'referral-extraction',
      processing_authority_confirmed: true,
      processing_authority_attestation_version:
        REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
      subject_age_confirmation: REFERRAL_SUBJECT_AGE_CONFIRMATION,
      subject_age_attestation_version: REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
    });
    assert.match(upload.file_url, /^\/uploads\/[0-9a-f-]+$/i);

    const extraction = await sdk.integrations.Core.ExtractDataFromUploadedFile({
      org_id: selectedOrgId,
      file_urls: [upload.file_url],
      json_schema: REFERRAL_EXTRACTION_SCHEMA,
      processing_authority_confirmed: true,
      processing_authority_attestation_version:
        REFERRAL_PROCESSING_AUTHORITY_ATTESTATION_VERSION,
    });
    assert.equal(extraction.status, 'success');
    assert.deepEqual(extraction.output, CANONICAL_REFERRAL_PROFILE_A);
    const providerCall = provider.calls.at(-1);
    assert.equal(providerCall.schemaPropertyCount, REFERRAL_EXTRACTION_SCHEMA_PROPERTY_COUNT);
    assert.deepEqual(providerCall.schemaPropertyNames, REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS);
    assert.deepEqual(providerCall.schemaRequired, REFERRAL_EXTRACTION_SCHEMA_PROPERTY_KEYS);
    assert.equal(providerCall.schemaAdditionalProperties, false);

    const assuranceDb = new DatabaseSync(server.dbPath, { readOnly: true });
    try {
      const audit = assuranceDb.prepare(`
        SELECT metadata_json
        FROM upload_audit
        WHERE upload_id = ? AND event_type = 'document_extraction' AND outcome = 'success'
        ORDER BY id DESC
        LIMIT 1
      `).get(upload.upload_id);
      assert.ok(audit, 'successful extraction audit row is present');
      assert.equal(JSON.parse(audit.metadata_json).schema_hash, REFERRAL_EXTRACTION_SCHEMA_SHA256);
    } finally {
      assuranceDb.close();
    }

    // Extraction proposes values only. It must not create a clinical entity
    // until the practitioner has reviewed and explicitly persists the result.
    const clientsAfterExtraction = await sdk.entities.Client.filter({ org_id: selectedOrgId });
    assert.equal(clientsAfterExtraction.length, clientsBefore.length);

    const reviewedData = prepareReferralReviewData({
      ...extraction.output,
      full_name: 'Alex River — Practitioner Reviewed',
      gender: 'other',
    });
    const commitPayload = buildReviewedReferralCommitPayload({
      idempotencyKey: createReferralCommitIdempotencyKey(),
      orgId: selectedOrgId,
      operation: 'create',
      client: buildReferralClientData(reviewedData),
      conditions: buildReferralConditionData(reviewedData),
      uploadIds: [upload.upload_id],
    });
    const commitResult = await commitReviewedReferral(sdk, commitPayload);
    const replayResult = await commitReviewedReferral(sdk, commitPayload);
    assert.deepEqual(replayResult, commitResult);
    assert.deepEqual(commitResult, {
      status: 'success',
      operation: 'create',
      client_id: commitResult.client_id,
      counts: {
        conditions_created: 2,
        documents_retained: 1,
        historical_assessments_created: 0,
      },
    });

    const clientsAfterCommit = await sdk.entities.Client.filter({ org_id: selectedOrgId });
    assert.equal(clientsAfterCommit.length, clientsBefore.length + 1);
    const reviewedClient = clientsAfterCommit.find((client) => client.id === commitResult.client_id);
    assert.equal(reviewedClient.full_name, reviewedData.full_name);
    assert.equal(reviewedClient.org_id, selectedOrgId);
    assert.equal(reviewedClient.assigned_clinician_email, currentUser.email);

    const retainedDocuments = await sdk.entities.ClientDocument.filter({
      org_id: selectedOrgId,
      client_id: commitResult.client_id,
    });
    assert.equal(retainedDocuments.length, 1);
    assert.equal(retainedDocuments[0].file_url, upload.file_url);

    const retentionDb = new DatabaseSync(server.dbPath, { readOnly: true });
    try {
      const retainedUpload = retentionDb.prepare(`
        SELECT lifecycle_state, bound_entity_type, bound_entity_id
        FROM upload_registry
        WHERE id = ?
      `).get(upload.upload_id);
      assert.equal(retainedUpload.lifecycle_state, 'bound');
      assert.equal(retainedUpload.bound_entity_type, 'ClientDocument');
      assert.equal(retainedUpload.bound_entity_id, retainedDocuments[0].id);
      assert.equal(
        retentionDb.prepare('SELECT COUNT(*) AS count FROM referral_commit_receipt').get().count,
        1,
      );
    } finally {
      retentionDb.close();
    }
    assert.equal(provider.calls.length, 1);
  } finally {
    sdk?.cleanup();
    await server.stop();
    await provider.stop();
  }
});

test('installed SDK carries a local-server generic-extraction refusal through the safe UI error contract', async () => {
  // Exercise the referral-only boundary with the release feature enabled.
  // Rollback/disabled mode intentionally refuses even earlier with 503 and
  // is covered by the zero-side-effect rollback tests.
  const server = await startTestServer({ DOCUMENT_EXTRACTION_ENABLED: '1' });
  let sdk;

  try {
    const adminToken = await loginAdmin(server);
    const user = await registerUser(server, 'synthetic-generic-disable-sdk@example.test');
    await activateUser(server, adminToken, user.id);
    const organization = await createOrganizationForUser(server, adminToken, user);
    const acceptance = await requestJson(
      server,
      `/api/apps/${server.appId}/integration-endpoints/Core/RecordLegalAcceptanceBundle`,
      { method: 'POST', token: user.token, body: { org_id: organization.id, marketing_opt_in: false } },
    );
    assert.equal(acceptance.status, 200, acceptance.text);

    sdk = createClient({
      appId: server.appId,
      serverUrl: server.baseUrl,
      token: user.token,
      requiresAuth: false,
    });

    const upload = await sdk.integrations.Core.UploadFile({
      file: new File([pdfFixture()], 'synthetic-clinical-attachment.pdf', { type: 'application/pdf' }),
      org_id: organization.id,
      purpose: 'clinical-attachment',
    });

    let installedSdkError;
    await assert.rejects(
      sdk.integrations.Core.ExtractDataFromUploadedFile({
        org_id: organization.id,
        file_urls: [upload.file_url],
        json_schema: { type: 'object', properties: {} },
        processing_authority_confirmed: true,
      }),
      (error) => {
        installedSdkError = error;
        return error instanceof Base44Error;
      },
    );

    const failure = normalizeSdkError(installedSdkError, {
      stage: 'extraction',
      fallbackDetails: 'The referral could not be processed. No client data was changed.',
    });
    assert.equal(failure.stage, 'extraction');
    assert.equal(failure.status, 403);
    assert.equal(failure.code, 'generic_extraction_disabled');
    assert.equal(
      failure.details,
      'Automated extraction is approved only for the referral workflow.',
    );
    assert.match(
      failure.diagnosticReference,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    // ReferralUploader persists these two fields in its visible alert. The
    // browser suite independently renders this exact model using an installed
    // Base44Error, including the support reference.
    assert.deepEqual({
      details: failure.details,
      diagnosticReference: failure.diagnosticReference,
    }, {
      details: installedSdkError.data.details,
      diagnosticReference: installedSdkError.data.diagnostic_reference,
    });
    assert.deepEqual(
      sdkErrorLogMetadata(installedSdkError, { stage: 'extraction' }),
      {
        stage: 'extraction',
        status: 403,
        code: 'generic_extraction_disabled',
        diagnosticReference: failure.diagnosticReference,
      },
    );
    assert.equal(JSON.stringify(sdkErrorLogMetadata(installedSdkError)).includes(upload.file_url), false);
  } finally {
    sdk?.cleanup();
    await server.stop();
  }
});
