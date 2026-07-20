import assert from 'node:assert/strict';
import test from 'node:test';

import { createClient } from '@base44/sdk';

import {
  REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
  REFERRAL_SUBJECT_AGE_CONFIRMATION,
  resolveReferralOrganization,
} from '../../src/lib/referralWorkflow.js';
import { startFakeOpenAI } from './support/fake-openai.mjs';
import { PROFILE_A, REFERRAL_SCHEMA, pdfFixture } from './support/synthetic-fixtures.mjs';
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
      subject_age_confirmation: REFERRAL_SUBJECT_AGE_CONFIRMATION,
      subject_age_attestation_version: REFERRAL_SUBJECT_AGE_ATTESTATION_VERSION,
    });
    assert.match(upload.file_url, /^\/uploads\/[0-9a-f-]+$/i);

    const extraction = await sdk.integrations.Core.ExtractDataFromUploadedFile({
      org_id: selectedOrgId,
      file_urls: [upload.file_url],
      json_schema: REFERRAL_SCHEMA,
      processing_authority_confirmed: true,
    });
    assert.equal(extraction.status, 'success');
    assert.deepEqual(extraction.output, PROFILE_A);

    // Extraction proposes values only. It must not create a clinical entity
    // until the practitioner has reviewed and explicitly persists the result.
    const clientsAfterExtraction = await sdk.entities.Client.filter({ org_id: selectedOrgId });
    assert.equal(clientsAfterExtraction.length, clientsBefore.length);

    const reviewedClient = await sdk.entities.Client.create({
      org_id: selectedOrgId,
      full_name: 'Alex River — Practitioner Reviewed',
      date_of_birth: extraction.output.date_of_birth,
      assigned_clinician_email: currentUser.email,
    });
    const retainedDocument = await sdk.entities.ClientDocument.create({
      org_id: selectedOrgId,
      client_id: reviewedClient.id,
      document_type: 'referral',
      file_url: upload.file_url,
      file_name: 'AssessSuite_Demo_GP_Referral(1).pdf',
      notes: 'Synthetic real-SDK journey fixture',
    });

    assert.equal(reviewedClient.org_id, selectedOrgId);
    assert.equal(retainedDocument.org_id, selectedOrgId);
    assert.equal(retainedDocument.file_url, upload.file_url);
    assert.equal(provider.calls.length, 1);
  } finally {
    sdk?.cleanup();
    await server.stop();
    await provider.stop();
  }
});
