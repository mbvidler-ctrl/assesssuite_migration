import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  createTestStore,
  loginAdmin,
  registerUser,
  requestJson,
  startTestServer,
} from './support/server-harness.mjs';

const RENDER_FINGERPRINT = `sha256:${'b'.repeat(64)}`;

const CORE_TEST_ADMIN_EMAIL = 'core-v1-admin@isolated.test';
const CORE_TEST_ADMIN_PASSWORD = 'Synthetic-Core-V1-Password-1!';
const CORE_SYNTHETIC_FIXTURE_KEY = 'persistent-pain-aep-v1';
const SYNTHETIC_FIXTURE_ATTACK_SENTINEL =
  'SENSITIVE-SYNTHETIC-FIXTURE-ATTACK-CONTENT-MUST-NOT-ECHO';

async function entity(server, token, entityName, { method = 'POST', id = null, body } = {}) {
  return requestJson(
    server,
    `/api/apps/${server.appId}/entities/${entityName}${id ? `/${id}` : ''}`,
    { method, token, body },
  );
}

function assertControlled4xx(response, sentinel = SYNTHETIC_FIXTURE_ATTACK_SENTINEL) {
  assert.ok(response.status >= 400 && response.status < 500, response.text);
  assert.equal(
    response.text.includes(sentinel),
    false,
    'a controlled refusal must not echo caller-controlled clinical content',
  );
}

function reportBody(sourceId, sourceCutoff) {
  const sourceIds = [sourceId];
  const section = (sectionKey) => ({
    sectionKey,
    body: `SYNTHETIC_CORE_REPORT: ${sectionKey}`,
    sourceIds,
  });
  return {
    subjectId: 'replaced-after-client-create',
    templateSelector: { templateKey: 'gp.referral-update.point-in-time.v1' },
    sourceCutoff,
    sections: [
      section('reason_for_referral'),
      section('assessment_findings'),
      section('outcome_measures'),
      section('intervention_and_progress'),
      section('recommendations'),
    ],
    claims: [{
      claimId: 'synthetic-claim-001',
      sectionKey: 'reason_for_referral',
      text: 'SYNTHETIC_CORE_REPORT: source-linked claim',
      sourceIds,
      requiresSource: true,
    }],
  };
}

async function updateClinicalAdmin(server, adminToken, userId, registrationNumber) {
  const result = await entity(server, adminToken, 'User', {
    method: 'PUT',
    id: userId,
    body: {
      role: 'admin',
      account_status: 'active',
      country: 'australia',
      profession: 'Exercise Physiologist',
      qualifications: 'Synthetic accredited exercise physiology credential',
      registration_number: registrationNumber,
    },
  });
  assert.equal(result.status, 200, result.text);
  return result.body;
}

async function updateReleaseControllerAdmin(server, adminToken, userId) {
  const result = await entity(server, adminToken, 'User', {
    method: 'PUT',
    id: userId,
    body: {
      role: 'admin',
      account_status: 'active',
      country: 'australia',
      profession: 'Administrator',
    },
  });
  assert.equal(result.status, 200, result.text);
  return result.body;
}

async function loginCoreAdmin(server) {
  const result = await requestJson(server, `/api/apps/${server.appId}/auth/login`, {
    method: 'POST',
    body: {
      email: CORE_TEST_ADMIN_EMAIL,
      password: CORE_TEST_ADMIN_PASSWORD,
    },
  });
  assert.equal(result.status, 200, result.text);
  assert.ok(result.body?.access_token);
  return result.body.access_token;
}

function listCoreSchemaObjects(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE name GLOB 'core_*'
      ORDER BY name
    `).all().map((row) => row.name);
  } finally {
    db.close();
  }
}

test('Core V1 stays hidden when its strict sandbox gate is off', async () => {
  const server = await startTestServer({ CORE_V1_SANDBOX_ENABLED: '0' });
  try {
    assert.deepEqual(
      listCoreSchemaObjects(server.dbPath),
      [],
      'a fully started disabled server must not mutate its database with Core schema',
    );
    const token = await loginAdmin(server);
    const response = await requestJson(server, '/api/core/v1/admin/assurance', { token });
    assert.equal(response.status, 404);
    assert.equal(response.body?.error?.code, 'CORE_NOT_FOUND');
  } finally {
    await server.stop();
  }
});

test('Core V1 rejects a reused sandbox store whose retained admin differs from configured credentials', async () => {
  const mismatchedStore = createTestStore('assesssuite-core-v1-admin-mismatch-');
  try {
    const legacyServer = await startTestServer(
      { CORE_V1_SANDBOX_ENABLED: '0' },
      { store: mismatchedStore, selftest: false },
    );
    try {
      // Prove the retained database really carries the harness's legacy
      // default administrator before attempting the strong Core boot.
      await loginAdmin(legacyServer);
    } finally {
      await legacyServer.stop();
    }

    await assert.rejects(
      () => startTestServer({
        CORE_V1_SANDBOX_ENABLED: '1',
        ADMIN_EMAIL: CORE_TEST_ADMIN_EMAIL,
        ADMIN_PASSWORD: CORE_TEST_ADMIN_PASSWORD,
      }, { store: mismatchedStore, selftest: false }),
      /sandbox administrator does not match the configured isolated credentials/,
    );
  } finally {
    mismatchedStore.cleanup();
  }

  const matchingStore = createTestStore('assesssuite-core-v1-admin-match-');
  let first = null;
  let second = null;
  try {
    const environment = {
      CORE_V1_SANDBOX_ENABLED: '1',
      ADMIN_EMAIL: CORE_TEST_ADMIN_EMAIL,
      ADMIN_PASSWORD: CORE_TEST_ADMIN_PASSWORD,
    };
    first = await startTestServer(environment, { store: matchingStore, selftest: false });
    await first.stop();
    first = null;
    second = await startTestServer(environment, { store: matchingStore, selftest: false });
    const login = await loginCoreAdmin(second);
    assert.ok(login, 'an exact retained admin remains usable on a later isolated sandbox boot');
    await second.stop();
    second = null;

    const db = new DatabaseSync(matchingStore.dbPath);
    try {
      const retained = db.prepare(`
        SELECT data FROM entity_User
        WHERE json_extract(data, '$.role') = 'admin'
        LIMIT 1
      `).get();
      const duplicate = JSON.parse(retained.data);
      duplicate.email = 'second-core-admin@isolated.test';
      const now = '2026-08-08T00:00:00.000Z';
      db.prepare(`
        INSERT INTO entity_User (id, data, created_date, updated_date, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(randomUUID(), JSON.stringify(duplicate), now, now, CORE_TEST_ADMIN_EMAIL);
    } finally {
      db.close();
    }
    await assert.rejects(
      () => startTestServer(environment, { store: matchingStore, selftest: false }),
      /sandbox administrator does not match the configured isolated credentials/,
      'more than one retained administrator must fail even when one matches exactly',
    );
  } finally {
    if (first) await first.stop();
    if (second) await second.stop();
    matchingStore.cleanup();
  }
});

test('mounted Core V1 executes the synthetic assessment, protocol, report and review corridor', async () => {
  const server = await startTestServer({
    CORE_V1_SANDBOX_ENABLED: '1',
    ADMIN_EMAIL: CORE_TEST_ADMIN_EMAIL,
    ADMIN_PASSWORD: CORE_TEST_ADMIN_PASSWORD,
  });
  try {
    assert.ok(
      listCoreSchemaObjects(server.dbPath).includes('core_schema_migration'),
      'the explicit isolated sandbox must install Core schema before mounting routes',
    );
    const creatorToken = await loginCoreAdmin(server);
    const users = await entity(server, creatorToken, 'User', { method: 'GET' });
    assert.equal(users.status, 200, users.text);
    const creator = users.body.find((user) => user.email === CORE_TEST_ADMIN_EMAIL);
    assert.ok(creator?.id);
    await updateClinicalAdmin(server, creatorToken, creator.id, 'SYNTHETIC-AEP-001');

    const organization = await entity(server, creatorToken, 'Organization', {
      body: { name: 'Synthetic Core V1 Organisation' },
    });
    assert.equal(organization.status, 200, organization.text);
    const orgId = organization.body.id;
    const creatorMembership = await entity(server, creatorToken, 'OrganizationMember', {
      body: {
        org_id: orgId,
        user_email: CORE_TEST_ADMIN_EMAIL,
        role: 'clinician',
        is_primary: true,
      },
    });
    assert.equal(creatorMembership.status, 200, creatorMembership.text);

    const unauthorisedProvisioner = await registerUser(
      server,
      'core-v1-fixture-provision-denied@example.test',
    );
    const deniedProvision = await requestJson(
      server,
      '/api/core/v1/admin/synthetic-fixtures/provision',
      {
        method: 'POST',
        token: unauthorisedProvisioner.token,
        body: { fixtureKey: CORE_SYNTHETIC_FIXTURE_KEY },
      },
    );
    assertControlled4xx(deniedProvision);

    const unknownFixture = await requestJson(
      server,
      '/api/core/v1/admin/synthetic-fixtures/provision',
      {
        method: 'POST',
        token: creatorToken,
        body: { fixtureKey: 'caller-selected-clinical-fixture' },
      },
    );
    assertControlled4xx(unknownFixture);

    const injectedFixtureFields = await requestJson(
      server,
      '/api/core/v1/admin/synthetic-fixtures/provision',
      {
        method: 'POST',
        token: creatorToken,
        body: {
          fixtureKey: CORE_SYNTHETIC_FIXTURE_KEY,
          org_id: 'caller-selected-org',
          full_name: SYNTHETIC_FIXTURE_ATTACK_SENTINEL,
        },
      },
    );
    assertControlled4xx(injectedFixtureFields);

    const provisioned = await requestJson(
      server,
      '/api/core/v1/admin/synthetic-fixtures/provision',
      {
        method: 'POST',
        token: creatorToken,
        body: { fixtureKey: CORE_SYNTHETIC_FIXTURE_KEY },
      },
    );
    assert.equal(provisioned.status, 201, provisioned.text);
    assert.equal(provisioned.body.fixtureKey, CORE_SYNTHETIC_FIXTURE_KEY);
    assert.equal(provisioned.body.subject?.type, 'client');
    assert.ok(provisioned.body.subject?.id);
    assert.ok(provisioned.body.sources?.clientConditionId);
    assert.ok(provisioned.body.sources?.clientAssessmentId);
    assert.match(provisioned.body.sourceCutoff, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(provisioned.body.created, true);
    assert.equal(provisioned.body.releaseEligible, false);
    const clientId = provisioned.body.subject.id;

    const provisionReplay = await requestJson(
      server,
      '/api/core/v1/admin/synthetic-fixtures/provision',
      {
        method: 'POST',
        token: creatorToken,
        body: { fixtureKey: CORE_SYNTHETIC_FIXTURE_KEY },
      },
    );
    assert.equal(provisionReplay.status, 200, provisionReplay.text);
    assert.equal(provisionReplay.body.created, false);
    assert.deepEqual(provisionReplay.body.subject, provisioned.body.subject);
    assert.deepEqual(provisionReplay.body.sources, provisioned.body.sources);
    assert.equal(provisionReplay.body.sourceCutoff, provisioned.body.sourceCutoff);

    const forgedMarker = await entity(server, creatorToken, 'Client', {
      body: {
        org_id: orgId,
        full_name: SYNTHETIC_FIXTURE_ATTACK_SENTINEL,
        core_v1_synthetic: true,
      },
    });
    assertControlled4xx(forgedMarker);

    const forgedProvenance = await entity(server, creatorToken, 'Client', {
      body: {
        org_id: orgId,
        full_name: SYNTHETIC_FIXTURE_ATTACK_SENTINEL,
        coreV1SyntheticProvenance: { forged: SYNTHETIC_FIXTURE_ATTACK_SENTINEL },
      },
    });
    assertControlled4xx(forgedProvenance);

    const unmarkedClient = await entity(server, creatorToken, 'Client', {
      body: { org_id: orgId, full_name: 'Synthetic but deliberately unmarked' },
    });
    assert.equal(unmarkedClient.status, 200, unmarkedClient.text);

    const ordinaryChildren = {};
    for (const [entityName, body] of [
      ['ClientCondition', {
        condition_name: 'Ordinary synthetic condition',
        condition_type: 'primary',
      }],
      ['ClientAssessment', {
        assessment_id: 'ordinary-synthetic-assessment',
        status: 'completed',
        assessment_date: '2026-08-06',
      }],
      ['SOAPNote', {
        note_date: '2026-08-06',
        status: 'draft',
        subjective: 'Ordinary synthetic note',
      }],
    ]) {
      const ordinary = await entity(server, creatorToken, entityName, {
        body: { org_id: orgId, client_id: unmarkedClient.body.id, ...body },
      });
      assert.equal(ordinary.status, 200, ordinary.text);
      ordinaryChildren[entityName] = ordinary.body;
    }
    assert.deepEqual(Object.keys(ordinaryChildren).sort(), [
      'ClientAssessment',
      'ClientCondition',
      'SOAPNote',
    ]);

    for (const [entityName, body] of [
      ['ClientCondition', {
        condition_name: 'Forged fixture-labelled condition',
        core_v1_synthetic: true,
      }],
      ['ClientAssessment', {
        assessment_id: 'forged-fixture-labelled-assessment',
        coreV1SyntheticProvenance: { forged: SYNTHETIC_FIXTURE_ATTACK_SENTINEL },
      }],
      ['SOAPNote', {
        subjective: SYNTHETIC_FIXTURE_ATTACK_SENTINEL,
        'core-v1-synthetic-provenance': { forged: true },
      }],
    ]) {
      const forgedChild = await entity(server, creatorToken, entityName, {
        body: {
          org_id: orgId,
          client_id: unmarkedClient.body.id,
          ...body,
        },
      });
      assertControlled4xx(forgedChild);
    }

    for (const [entityName, body] of [
      ['ClientCondition', {
        condition_name: SYNTHETIC_FIXTURE_ATTACK_SENTINEL,
        condition_type: 'primary',
      }],
      ['ClientAssessment', {
        assessment_id: SYNTHETIC_FIXTURE_ATTACK_SENTINEL,
        status: 'completed',
        assessment_date: '2026-08-07',
      }],
      ['SOAPNote', {
        note_date: '2026-08-07',
        status: 'draft',
        subjective: SYNTHETIC_FIXTURE_ATTACK_SENTINEL,
      }],
    ]) {
      const attached = await entity(server, creatorToken, entityName, {
        body: { org_id: orgId, client_id: clientId, ...body },
      });
      assertControlled4xx(attached);
    }

    const reparentCondition = await entity(server, creatorToken, 'ClientCondition', {
      method: 'PUT',
      id: ordinaryChildren.ClientCondition.id,
      body: { client_id: clientId, notes: SYNTHETIC_FIXTURE_ATTACK_SENTINEL },
    });
    assertControlled4xx(reparentCondition);

    const reparentAssessment = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/ClientAssessment/bulk`,
      {
        method: 'PUT',
        token: creatorToken,
        body: [{
          id: ordinaryChildren.ClientAssessment.id,
          client_id: clientId,
          notes: SYNTHETIC_FIXTURE_ATTACK_SENTINEL,
        }],
      },
    );
    assertControlled4xx(reparentAssessment);

    const reparentSoap = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/SOAPNote/update-many`,
      {
        method: 'PATCH',
        token: creatorToken,
        body: {
          query: { id: ordinaryChildren.SOAPNote.id },
          data: { client_id: clientId, subjective: SYNTHETIC_FIXTURE_ATTACK_SENTINEL },
        },
      },
    );
    assertControlled4xx(reparentSoap);

    for (const [entityName, ordinary] of Object.entries(ordinaryChildren)) {
      const unchanged = await entity(server, creatorToken, entityName, {
        method: 'GET',
        id: ordinary.id,
      });
      assert.equal(unchanged.status, 200, unchanged.text);
      assert.equal(unchanged.body.client_id, unmarkedClient.body.id);
    }

    for (const fixtureRecord of [
      { entityName: 'Client', id: clientId },
      { entityName: 'ClientCondition', id: provisioned.body.sources.clientConditionId },
      { entityName: 'ClientAssessment', id: provisioned.body.sources.clientAssessmentId },
    ]) {
      const beforeMutation = await entity(server, creatorToken, fixtureRecord.entityName, {
        method: 'GET',
        id: fixtureRecord.id,
      });
      assert.equal(beforeMutation.status, 200, beforeMutation.text);
      assert.equal(beforeMutation.body.core_v1_synthetic, true);
      assert.notEqual(beforeMutation.body.created_by, CORE_TEST_ADMIN_EMAIL);
      const provenance = beforeMutation.body.core_v1_synthetic_provenance;
      assert.equal(provenance?.fixtureKey, CORE_SYNTHETIC_FIXTURE_KEY);
      assert.equal(provenance?.entityName, fixtureRecord.entityName);
      assert.equal(provenance?.recordId, fixtureRecord.id);
      assert.equal(provenance?.subjectId, clientId);
      assert.equal(provenance?.orgId, orgId);
      assert.equal(JSON.stringify(beforeMutation.body).includes(SYNTHETIC_FIXTURE_ATTACK_SENTINEL), false);

      const singleUpdate = await entity(server, creatorToken, fixtureRecord.entityName, {
        method: 'PUT',
        id: fixtureRecord.id,
        body: { notes: SYNTHETIC_FIXTURE_ATTACK_SENTINEL },
      });
      assertControlled4xx(singleUpdate);

      const bulkUpdate = await requestJson(
        server,
        `/api/apps/${server.appId}/entities/${fixtureRecord.entityName}/bulk`,
        {
          method: 'PUT',
          token: creatorToken,
          body: [{ id: fixtureRecord.id, notes: SYNTHETIC_FIXTURE_ATTACK_SENTINEL }],
        },
      );
      assertControlled4xx(bulkUpdate);

      const updateMany = await requestJson(
        server,
        `/api/apps/${server.appId}/entities/${fixtureRecord.entityName}/update-many`,
        {
          method: 'PATCH',
          token: creatorToken,
          body: {
            query: { id: fixtureRecord.id },
            data: { notes: SYNTHETIC_FIXTURE_ATTACK_SENTINEL },
          },
        },
      );
      assertControlled4xx(updateMany);

      const deleted = await entity(server, creatorToken, fixtureRecord.entityName, {
        method: 'DELETE',
        id: fixtureRecord.id,
      });
      assertControlled4xx(deleted);

      const unchanged = await entity(server, creatorToken, fixtureRecord.entityName, {
        method: 'GET',
        id: fixtureRecord.id,
      });
      assert.equal(unchanged.status, 200, unchanged.text);
      assert.deepEqual(unchanged.body, beforeMutation.body);
    }

    const catalogue = Array.from({ length: 232 }, (_, index) => ({
      name: index === 0 ? 'Persistent Pain Functional Impact Scale' : `Synthetic Measure ${index + 1}`,
      category: 'synthetic',
      description: index === 0
        ? `Persistent pain functional screening ${'bounded synthetic catalogue text '.repeat(12)}`
        : `Unrelated synthetic catalogue content ${'bounded synthetic catalogue text '.repeat(12)}`,
      conditions_indicated: index === 0 ? ['Persistent Pain'] : undefined,
      search_tags: index < 125 ? undefined : ['synthetic'],
    }));
    assert.ok(Buffer.byteLength(JSON.stringify(catalogue), 'utf8') > 32_768);
    const assessmentBulk = await requestJson(
      server,
      `/api/apps/${server.appId}/entities/Assessment/bulk`,
      { method: 'POST', token: creatorToken, body: catalogue },
    );
    assert.equal(assessmentBulk.status, 200, assessmentBulk.text);
    assert.equal(assessmentBulk.body.length, 232);

    const forgedFinalReport = await entity(server, creatorToken, 'SavedReport', {
      body: {
        org_id: orgId,
        client_id: clientId,
        report_type: 'gp_summary',
        report_name: 'Synthetic prior final report',
        report_date: '2026-08-02',
        status: 'final',
        report_html: '<p>SYNTHETIC SOURCE CONTENT</p>',
      },
    });
    assert.equal(forgedFinalReport.status, 409, forgedFinalReport.text);
    assert.equal(
      forgedFinalReport.body?.message,
      'report governance transitions are server-controlled',
    );

    const protocol = await entity(server, creatorToken, 'TreatmentProtocol', {
      body: {
        condition_name: 'Persistent Pain',
        category: 'general',
        clinical_note: 'Synthetic legacy row intentionally missing governance metadata.',
      },
    });
    assert.equal(protocol.status, 200, protocol.text);

    const assurance = await requestJson(
      server,
      `/api/core/v1/admin/assurance?org_id=${encodeURIComponent(orgId)}&limit=25`,
      { token: creatorToken },
    );
    assert.equal(assurance.status, 200, assurance.text);
    assert.deepEqual(assurance.body.environment, { mode: 'sandbox', production_enabled: false });
    assert.equal(assurance.body.summary.org_id, orgId);
    assert.equal(JSON.stringify(assurance.body).includes('SYNTHETIC SOURCE CONTENT'), false);

    const unmarkedAttempt = await requestJson(server, '/api/core/v1/assessment-discovery', {
      method: 'POST',
      token: creatorToken,
      body: { subjectId: unmarkedClient.body.id, limit: 5 },
    });
    assert.equal(unmarkedAttempt.status, 404);
    assert.equal(unmarkedAttempt.body.error.code, 'CORE_SUBJECT_NOT_FOUND');

    const assessment = await requestJson(server, '/api/core/v1/assessment-discovery', {
      method: 'POST',
      token: creatorToken,
      body: { subjectId: clientId, limit: 5 },
    });
    assert.equal(assessment.status, 200, assessment.text);
    assert.equal(assessment.body.state, 'ready');
    assert.equal(assessment.body.recommendations[0].name, 'Persistent Pain Functional Impact Scale');
    assert.equal(assessment.body.releaseEligible, false);

    const protocolSearch = await requestJson(
      server,
      '/api/core/v1/protocol-assistance/search?q=Persistent%20Pain&limit=10',
      { token: creatorToken },
    );
    assert.equal(protocolSearch.status, 200, protocolSearch.text);
    assert.equal(protocolSearch.body.state, 'catalogue_blocked');
    assert.equal(protocolSearch.body.releaseEligible, false);

    // Generated report entities cannot recursively promote themselves into
    // verified evidence. Use the eligible completed assessment instead.
    const sourceId = `ClientAssessment:${provisioned.body.sources.clientAssessmentId}`;
    const draftInput = reportBody(sourceId, provisioned.body.sourceCutoff);
    draftInput.subjectId = clientId;
    const draft = await requestJson(server, '/api/core/v1/report-drafts', {
      method: 'POST',
      token: creatorToken,
      headers: { 'Idempotency-Key': 'synthetic-full-stack-report-001' },
      body: draftInput,
    });
    assert.equal(draft.status, 201, draft.text);
    assert.equal(draft.body.state, 'draft');
    assert.equal(draft.body.report.lifecycle.state, 'draft');
    assert.equal(draft.body.releaseEligible, false);

    const replay = await requestJson(server, '/api/core/v1/report-drafts', {
      method: 'POST',
      token: creatorToken,
      headers: { 'Idempotency-Key': 'synthetic-full-stack-report-001' },
      body: draftInput,
    });
    assert.equal(replay.status, 201, replay.text);
    assert.equal(replay.body.artifactId, draft.body.artifactId);
    assert.equal(replay.body.idempotentReplay, true);

    const submitted = await requestJson(
      server,
      `/api/core/v1/artifacts/${draft.body.artifactId}/submit-review`,
      {
        method: 'POST',
        token: creatorToken,
        body: { expectedArtifactStateVersion: 0 },
      },
    );
    assert.equal(submitted.status, 201, submitted.text);

    const selfApproval = await requestJson(
      server,
      `/api/core/v1/reviews/${submitted.body.review.reviewId}/decision`,
      {
        method: 'POST',
        token: creatorToken,
        body: {
          decision: 'approve',
          expectedReviewStateVersion: 0,
          expectedArtifactStateVersion: 1,
        },
      },
    );
    assert.equal(selfApproval.status, 403);
    assert.equal(selfApproval.body.error.code, 'CORE_SELF_APPROVAL_DENIED');

    const reviewer = await registerUser(server, 'core-v1-reviewer@example.test');
    await updateClinicalAdmin(server, creatorToken, reviewer.id, 'SYNTHETIC-AEP-002');
    const reviewerMembership = await entity(server, creatorToken, 'OrganizationMember', {
      body: {
        org_id: orgId,
        user_email: reviewer.email,
        role: 'clinician',
        is_primary: true,
      },
    });
    assert.equal(reviewerMembership.status, 200, reviewerMembership.text);

    const approved = await requestJson(
      server,
      `/api/core/v1/reviews/${submitted.body.review.reviewId}/decision`,
      {
        method: 'POST',
        token: reviewer.token,
        body: {
          decision: 'approve',
          expectedReviewStateVersion: 0,
          expectedArtifactStateVersion: 1,
        },
      },
    );
    assert.equal(approved.status, 200, approved.text);
    assert.equal(approved.body.review.state, 'approved');
    assert.equal(approved.body.artifact.state, 'approved');
    assert.equal(approved.body.releaseControlComplete, false);
    assert.equal(approved.body.releaseEligible, false);

    const reviewerReleaseAttempt = await requestJson(
      server,
      `/api/core/v1/artifacts/${draft.body.artifactId}/authorize-release`,
      {
        method: 'POST',
        token: reviewer.token,
        body: {
          expectedArtifactStateVersion: approved.body.artifact.stateVersion,
          contentFingerprint: approved.body.artifact.content.version.contentFingerprint,
          reportHtmlFingerprint: RENDER_FINGERPRINT,
          compatibilityVersion: 'assesssuite.legacy-report-compatibility.v1',
        },
      },
    );
    assert.equal(reviewerReleaseAttempt.status, 403, reviewerReleaseAttempt.text);
    assert.equal(
      reviewerReleaseAttempt.body.error.code,
      'CORE_RELEASE_CONTROLLER_SEPARATION_REQUIRED',
    );

    const releaseController = await registerUser(server, 'core-v1-release-controller@example.test');
    await updateReleaseControllerAdmin(server, creatorToken, releaseController.id);
    const releaseControlled = await requestJson(
      server,
      `/api/core/v1/artifacts/${draft.body.artifactId}/authorize-release`,
      {
        method: 'POST',
        token: releaseController.token,
        body: {
          expectedArtifactStateVersion: approved.body.artifact.stateVersion,
          contentFingerprint: approved.body.artifact.content.version.contentFingerprint,
          reportHtmlFingerprint: RENDER_FINGERPRINT,
          compatibilityVersion: 'assesssuite.legacy-report-compatibility.v1',
        },
      },
    );
    assert.equal(releaseControlled.status, 201, releaseControlled.text);
    assert.equal(releaseControlled.body.releaseControlComplete, true);
    assert.equal(releaseControlled.body.releaseEligible, false);
    assert.equal(releaseControlled.body.releaseBinding.environment, 'sandbox');
    assert.equal(releaseControlled.body.releaseBinding.productionReleaseAuthority, false);
    assert.equal(
      releaseControlled.body.releaseBinding.authorActorId,
      approved.body.artifact.content.version.createdBy,
    );
    assert.notEqual(
      releaseControlled.body.releaseBinding.authorActorId,
      releaseControlled.body.releaseBinding.reviewerActorId,
    );
    assert.notEqual(
      releaseControlled.body.releaseBinding.authorActorId,
      releaseControlled.body.releaseBinding.releaseControllerActorId,
    );

    const currentReplay = await requestJson(server, '/api/core/v1/report-drafts', {
      method: 'POST',
      token: releaseController.token,
      headers: { 'Idempotency-Key': 'synthetic-full-stack-report-001' },
      body: draftInput,
    });
    assert.equal(currentReplay.status, 201, currentReplay.text);
    assert.equal(currentReplay.body.state, 'approved');
    assert.equal(currentReplay.body.releaseControlComplete, true);
    assert.equal(currentReplay.body.releaseEligible, false);
    assert.deepEqual(currentReplay.body.releaseBinding, releaseControlled.body.releaseBinding);

    const finalAssurance = await requestJson(
      server,
      `/api/core/v1/admin/assurance?org_id=${encodeURIComponent(orgId)}&limit=50`,
      { token: releaseController.token },
    );
    assert.equal(finalAssurance.status, 200, finalAssurance.text);
    const serialized = JSON.stringify(finalAssurance.body);
    assert.equal(serialized.includes('SYNTHETIC_CORE_REPORT'), false);
    assert.equal(serialized.includes('core-v1-reviewer@example.test'), false);
    assert.equal(serialized.includes('core-v1-release-controller@example.test'), false);
    assert.ok(finalAssurance.body.runs.length >= 3);
    assert.ok(finalAssurance.body.artifacts.length >= 3);
    assert.ok(finalAssurance.body.reviews.length >= 1);
  } finally {
    await server.stop();
  }
});
