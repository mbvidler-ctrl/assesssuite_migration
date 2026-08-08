import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { bootstrapCoreV1Sandbox } from '../../server/core/bootstrap.mjs';
import { transitionArtifactState } from '../../server/core/domainStates.mjs';
import { createCoreV1HttpRouter } from '../../server/core/http.mjs';
import { createCoreRepositories } from '../../server/core/repository.mjs';
import { deriveRequestContext } from '../../server/core/requestContext.mjs';
import { installCoreSchema } from '../../server/core/schema.mjs';
import { CORE_V1_SYNTHETIC_FIXTURE_KEY } from '../../server/core/syntheticFixtures.mjs';

const BASE_TIME = Date.parse('2026-08-08T01:00:00.000Z');
const SOURCE_TIME = '2026-08-08T00:00:00.000Z';
const RENDER_FINGERPRINT = `sha256:${'a'.repeat(64)}`;

function monotonicClock() {
  let tick = 0;
  return () => new Date(BASE_TIME + tick++ * 1_000);
}

function counter(prefix) {
  let value = 0;
  return () => `${prefix}-${String(++value).padStart(4, '0')}`;
}

function largeAssessmentCatalogue() {
  return Array.from({ length: 232 }, (_, index) => ({
    id: `assessment-${String(index + 1).padStart(3, '0')}`,
    name: index === 0 ? 'Persistent Pain Functional Impact Scale' : `Synthetic Measure ${index + 1}`,
    description: index === 0
      ? `Persistent pain function screening ${'bounded synthetic description '.repeat(12)}`
      : `Unrelated synthetic catalogue content ${'catalogue padding '.repeat(12)}`,
    recommended_for_conditions: index === 0 ? ['Persistent Pain'] : undefined,
    tags: index < 125 ? undefined : ['synthetic'],
  }));
}

function reviewedReportBody(secret = 'SYNTHETIC_SECRET_ALPHA') {
  const sourceIds = ['verified-source-001'];
  const section = (sectionKey) => ({
    sectionKey,
    body: `${secret}: synthetic reviewed content for ${sectionKey}`,
    sourceIds,
  });
  return {
    subjectId: 'synthetic-client-001',
    templateSelector: { templateKey: 'gp.referral-update.point-in-time.v1' },
    sourceCutoff: SOURCE_TIME,
    sections: [
      section('reason_for_referral'),
      section('assessment_findings'),
      section('outcome_measures'),
      section('intervention_and_progress'),
      section('recommendations'),
    ],
    claims: [{
      claimId: 'claim-001',
      sectionKey: 'reason_for_referral',
      text: `${secret}: synthetic source-linked claim`,
      sourceIds,
      requiresSource: true,
    }],
  };
}

function createHarness({ sandboxEnabled = true, fixtureProvisioner = null } = {}) {
  const db = new DatabaseSync(':memory:');
  installCoreSchema(db);
  const clock = monotonicClock();
  const idFactory = counter('core-id');
  const repositories = createCoreRepositories(db, { clock, idFactory });
  if (sandboxEnabled) {
    bootstrapCoreV1Sandbox(repositories, {
      sandboxEnabled: true,
      clock,
    });
  }

  let currentUser = {
    id: 'user-creator-001',
    role: 'admin',
    account_status: 'active',
    profession: 'Exercise Physiologist',
    email: 'must-not-enter-core@example.test',
  };
  let authorisedOrgIds = ['org-alpha'];
  let selectedOrgId = null;
  const fixtureProvisionCalls = [];
  const provisionedFixtureScopes = new Set();

  const router = createCoreV1HttpRouter({
    repositories,
    sandboxEnabled,
    resolveSessionUser: () => currentUser,
    resolveAuthorisedOrgIds: () => authorisedOrgIds,
    resolveSelectedOrgId: () => selectedOrgId,
    resolveProtocolScope: () => 'exercise_physiology',
    resolveAssessmentSources: ({ subjectId }) => {
      const assessments = largeAssessmentCatalogue();
      assert.ok(Buffer.byteLength(JSON.stringify(assessments), 'utf8') > 32_768);
      return {
        subject: { type: 'client', id: subjectId },
        sourceReferences: [
          { sourceType: 'assessment_catalogue', sourceId: 'catalogue-232', version: 'v1', capturedAt: SOURCE_TIME },
          { sourceType: 'condition', sourceId: 'condition-001', version: 'v1', capturedAt: SOURCE_TIME },
        ],
        assessments,
        conditions: [{ id: 'condition-001', name: 'Persistent Pain' }],
        existingAssessmentIds: [],
        context: { assessmentCount: assessments.length, conditionCount: 1 },
        cutoffAt: SOURCE_TIME,
      };
    },
    resolveProtocolCatalogue: () => ({
      sourceReferences: [
        { sourceType: 'protocol_catalogue', sourceId: 'protocol-catalogue-legacy', version: 'v1', capturedAt: SOURCE_TIME },
      ],
      catalogue: [{
        id: 'protocol-legacy-001',
        condition_name: 'Persistent Pain',
        protocol: 'Legacy content deliberately blocked by missing governance.',
      }],
      context: { catalogueVersion: 'legacy-v1' },
      cutoffAt: SOURCE_TIME,
    }),
    resolveVerifiedReportSources: ({ subjectId, requestedSourceIds }) => {
      assert.deepEqual(requestedSourceIds, ['verified-source-001']);
      return {
        subject: { type: 'client', id: subjectId },
        sourceReferences: [
          { sourceType: 'verified_record', sourceId: 'verified-source-001', version: 'v1', capturedAt: SOURCE_TIME },
        ],
        reportSources: [{
          sourceId: 'verified-source-001',
          kind: 'synthetic_verified_record',
          title: 'Synthetic verified record',
          occurredAt: SOURCE_TIME,
          sourceVersion: 'v1',
        }],
        context: { verifiedSourceCount: 1 },
      };
    },
    provisionSyntheticFixture: fixtureProvisioner ?? (({ requestContext, fixtureKey }) => {
      fixtureProvisionCalls.push({ requestContext, fixtureKey });
      const scope = `${requestContext.orgId}:${fixtureKey}`;
      const created = !provisionedFixtureScopes.has(scope);
      provisionedFixtureScopes.add(scope);
      return {
        fixtureKey,
        subject: { type: 'client', id: 'core-fixture-client-001' },
        sources: {
          clientConditionId: 'core-fixture-clientcondition-001',
          clientAssessmentId: 'core-fixture-clientassessment-001',
        },
        sourceCutoff: SOURCE_TIME,
        created,
      };
    }),
    resolveRequestId: counter('request'),
    clock,
    idFactory,
  });

  return {
    db,
    repositories,
    router,
    fixtureProvisionCalls,
    setUser(value) { currentUser = value; },
    setAuthorisedOrgs(value) { authorisedOrgIds = value; },
    setSelectedOrg(value) { selectedOrgId = value; },
    close() { db.close(); },
  };
}

async function dispatch(router, method, url, { body = {}, headers = {} } = {}) {
  return router.dispatch({ method, url, body, headers });
}

async function submitAndApprove(harness, draft, reviewerId) {
  const submitted = await dispatch(
    harness.router,
    'POST',
    `/api/core/v1/artifacts/${draft.body.artifactId}/submit-review`,
    { body: { expectedArtifactStateVersion: draft.body.state === 'draft' ? 0 : draft.body.artifact.stateVersion } },
  );
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
  harness.setUser({
    id: reviewerId,
    role: 'admin',
    account_status: 'active',
    profession: 'Accredited Exercise Physiologist',
  });
  const approved = await dispatch(
    harness.router,
    'POST',
    `/api/core/v1/reviews/${submitted.body.review.reviewId}/decision`,
    {
      body: {
        decision: 'approve',
        expectedReviewStateVersion: 0,
        expectedArtifactStateVersion: submitted.body.artifact.stateVersion,
      },
    },
  );
  return { submitted, approved };
}

test('Core V1 is disabled by default and all enabled sandbox routes require an admin session', async () => {
  const disabled = createHarness({ sandboxEnabled: false });
  const enabled = createHarness();
  try {
    const hidden = await dispatch(disabled.router, 'GET', '/api/core/v1/admin/assurance?org_id=org-alpha');
    assert.equal(hidden.status, 404);
    assert.equal(hidden.body.error.code, 'CORE_NOT_FOUND');

    enabled.setUser(null);
    const unauthenticated = await dispatch(enabled.router, 'GET', '/api/core/v1/admin/assurance?org_id=org-alpha');
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticated.body.error.code, 'CORE_AUTH_REQUIRED');

    enabled.setUser({
      id: 'user-clinician-001',
      role: 'user',
      account_status: 'active',
      profession: 'Exercise Physiologist',
    });
    const nonAdmin = await dispatch(enabled.router, 'GET', '/api/core/v1/admin/assurance?org_id=org-alpha');
    assert.equal(nonAdmin.status, 403);
    assert.equal(nonAdmin.body.error.code, 'CORE_ADMIN_REQUIRED');
  } finally {
    disabled.close();
    enabled.close();
  }
});

test('body and header identity spoofing cannot widen tenant scope', async () => {
  const harness = createHarness();
  try {
    const spoofedBody = await dispatch(harness.router, 'POST', '/api/core/v1/assessment-discovery', {
      body: {
        subjectId: 'synthetic-client-001',
        orgId: 'org-bravo',
        role: 'admin',
        profession: 'surgeon',
        purpose: 'report_composition',
      },
      headers: {
        'x-org-id': 'org-bravo',
        'x-role': 'owner',
        'x-profession': 'surgeon',
      },
    });
    assert.equal(spoofedBody.status, 400);
    assert.equal(spoofedBody.body.error.code, 'CORE_UNKNOWN_FIELD');

    harness.setAuthorisedOrgs(['org-alpha', 'org-bravo']);
    harness.setSelectedOrg(null);
    const ambiguous = await dispatch(harness.router, 'GET', '/api/core/v1/assurance/summary', {
      headers: { 'x-org-id': 'org-bravo' },
    });
    assert.equal(ambiguous.status, 403);
    assert.equal(ambiguous.body.error.code, 'CORE_ORG_REQUIRED');

    harness.setAuthorisedOrgs(['org-alpha']);
    const queryScopeSpoof = await dispatch(
      harness.router,
      'GET',
      '/api/core/v1/admin/assurance?org_id=org-bravo',
    );
    assert.equal(queryScopeSpoof.status, 403);
    assert.equal(queryScopeSpoof.body.error.code, 'CORE_ORG_OUTSIDE_SCOPE');
  } finally {
    harness.close();
  }
});

test('synthetic fixture provisioning is admin-only, exact, allowlisted, scoped and idempotent', async () => {
  const harness = createHarness();
  try {
    const querySpoof = await dispatch(
      harness.router,
      'POST',
      '/api/core/v1/admin/synthetic-fixtures/provision?org_id=org-bravo',
      { body: { fixtureKey: CORE_V1_SYNTHETIC_FIXTURE_KEY } },
    );
    assert.equal(querySpoof.status, 400);
    assert.equal(querySpoof.body.error.code, 'CORE_UNKNOWN_QUERY');

    for (const body of [
      { fixtureKey: CORE_V1_SYNTHETIC_FIXTURE_KEY, orgId: 'org-bravo' },
      {
        fixtureKey: CORE_V1_SYNTHETIC_FIXTURE_KEY,
        full_name: 'caller supplied clinical content',
      },
    ]) {
      const rejected = await dispatch(
        harness.router,
        'POST',
        '/api/core/v1/admin/synthetic-fixtures/provision',
        { body },
      );
      assert.equal(rejected.status, 400);
      assert.equal(rejected.body.error.code, 'CORE_UNKNOWN_FIELD');
    }

    const unknown = await dispatch(
      harness.router,
      'POST',
      '/api/core/v1/admin/synthetic-fixtures/provision',
      { body: { fixtureKey: 'caller-defined-fixture' } },
    );
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.error.code, 'CORE_SYNTHETIC_FIXTURE_NOT_ALLOWLISTED');
    assert.equal(harness.fixtureProvisionCalls.length, 0);

    harness.setUser({
      id: 'user-clinician-001',
      role: 'user',
      account_status: 'active',
      profession: 'Exercise Physiologist',
    });
    const nonAdmin = await dispatch(
      harness.router,
      'POST',
      '/api/core/v1/admin/synthetic-fixtures/provision',
      { body: { fixtureKey: CORE_V1_SYNTHETIC_FIXTURE_KEY } },
    );
    assert.equal(nonAdmin.status, 403);
    assert.equal(nonAdmin.body.error.code, 'CORE_ADMIN_REQUIRED');
    assert.equal(harness.fixtureProvisionCalls.length, 0);

    harness.setUser({
      id: 'user-fixture-admin-001',
      role: 'admin',
      account_status: 'active',
      profession: 'Exercise Physiologist',
    });
    const first = await dispatch(
      harness.router,
      'POST',
      '/api/core/v1/admin/synthetic-fixtures/provision',
      { body: { fixtureKey: CORE_V1_SYNTHETIC_FIXTURE_KEY } },
    );
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.deepEqual(first.body, {
      fixtureKey: CORE_V1_SYNTHETIC_FIXTURE_KEY,
      subject: { type: 'client', id: 'core-fixture-client-001' },
      sources: {
        clientConditionId: 'core-fixture-clientcondition-001',
        clientAssessmentId: 'core-fixture-clientassessment-001',
      },
      sourceCutoff: SOURCE_TIME,
      created: true,
      releaseEligible: false,
    });
    assert.equal(harness.fixtureProvisionCalls.length, 1);
    assert.equal(
      harness.fixtureProvisionCalls[0].fixtureKey,
      CORE_V1_SYNTHETIC_FIXTURE_KEY,
    );
    assert.equal(harness.fixtureProvisionCalls[0].requestContext.orgId, 'org-alpha');
    assert.equal(harness.fixtureProvisionCalls[0].requestContext.purpose, 'core_administration');
    assert.equal(
      harness.fixtureProvisionCalls[0].requestContext.routeId,
      'core_v1.synthetic_fixture_provision',
    );

    const replay = await dispatch(
      harness.router,
      'POST',
      '/api/core/v1/admin/synthetic-fixtures/provision',
      { body: { fixtureKey: CORE_V1_SYNTHETIC_FIXTURE_KEY } },
    );
    assert.equal(replay.status, 200, JSON.stringify(replay.body));
    assert.deepEqual(replay.body, { ...first.body, created: false });
    assert.equal(harness.fixtureProvisionCalls.length, 2);

    const audits = harness.repositories.audit.listSummaries({
      orgId: 'org-alpha',
      eventType: 'core.synthetic_fixture.provisioned',
      limit: 10,
    });
    assert.equal(audits.length, 2);
    assert.deepEqual(audits.map((event) => event.outcome), ['noop', 'succeeded']);
    assert.deepEqual(audits.map((event) => event.metadata.idempotentReplay), [true, false]);
    const serializedAudit = JSON.stringify(audits);
    assert.equal(serializedAudit.includes('caller supplied clinical content'), false);
    assert.equal(serializedAudit.includes(CORE_V1_SYNTHETIC_FIXTURE_KEY), false);
  } finally {
    harness.close();
  }
});

test('synthetic fixture provisioning fails closed on an unexpected provisioner response', async () => {
  const clinicalSecret = 'SYNTHETIC_CLINICAL_CONTENT_MUST_NOT_ESCAPE';
  const harness = createHarness({
    fixtureProvisioner: ({ fixtureKey }) => ({
      fixtureKey,
      subject: { type: 'client', id: 'core-fixture-client-001' },
      sources: {
        clientConditionId: 'core-fixture-clientcondition-001',
        clientAssessmentId: 'core-fixture-clientassessment-001',
      },
      sourceCutoff: SOURCE_TIME,
      created: true,
      full_name: clinicalSecret,
    }),
  });
  try {
    const result = await dispatch(
      harness.router,
      'POST',
      '/api/core/v1/admin/synthetic-fixtures/provision',
      { body: { fixtureKey: CORE_V1_SYNTHETIC_FIXTURE_KEY } },
    );
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, {
      error: { code: 'CORE_SYNTHETIC_FIXTURE_PROVISION_FAILED' },
    });
    const serializedAudit = JSON.stringify(harness.repositories.audit.listSummaries({
      orgId: 'org-alpha',
      limit: 10,
    }));
    assert.equal(serializedAudit.includes(clinicalSecret), false);
  } finally {
    harness.close();
  }
});

test('assessment discovery handles the former over-32KB catalogue and records complete lineage', async () => {
  const harness = createHarness();
  try {
    const result = await dispatch(harness.router, 'POST', '/api/core/v1/assessment-discovery', {
      body: { subjectId: 'synthetic-client-001', limit: 5 },
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.state, 'ready');
    assert.equal(result.body.recommendations.length, 1);
    assert.equal(result.body.recommendations[0].id, 'assessment-001');
    assert.equal(result.body.releaseEligible, false);

    const run = harness.repositories.runs.get(result.body.runId, 'org-alpha');
    const artifact = harness.repositories.artifacts.get(result.body.artifactId, 'org-alpha');
    assert.equal(run.state, 'succeeded');
    assert.equal(run.executionMode, 'sandbox');
    assert.equal(artifact.state, 'draft');
    assert.equal(artifact.contextSnapshotId, run.contextSnapshotId);
    assert.equal(artifact.sources.length, 2);
  } finally {
    harness.close();
  }
});

test('protocol assistance is catalogue-only and blocks matching legacy rows without governance', async () => {
  const harness = createHarness();
  try {
    const result = await dispatch(
      harness.router,
      'GET',
      '/api/core/v1/protocol-assistance/search?q=persistent%20pain&limit=5',
    );
    assert.equal(result.status, 200);
    assert.equal(result.body.state, 'catalogue_blocked');
    assert.equal(result.body.code, 'matching_catalogue_entry_failed_governance');
    assert.deepEqual(result.body.matches, []);
    assert.equal(result.body.releaseEligible, false);
    assert.equal('patient' in result.body, false);
  } finally {
    harness.close();
  }
});

test('report composition is draft-only and replays the same idempotent artifact', async () => {
  const harness = createHarness();
  try {
    const options = {
      body: reviewedReportBody(),
      headers: { 'idempotency-key': 'synthetic-report-key-001' },
    };
    const first = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', options);
    const replay = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', options);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(replay.status, 201);
    assert.equal(first.body.artifactId, replay.body.artifactId);
    assert.equal(replay.body.idempotentReplay, true);
    assert.equal(first.body.report.lifecycle.state, 'draft');
    assert.equal(first.body.state, 'draft');
    assert.equal(first.body.releaseEligible, false);
    assert.equal(harness.repositories.artifacts.listSummaries({ orgId: 'org-alpha' }).length, 1);

    const conflict = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: reviewedReportBody('DIFFERENT_SYNTHETIC_CONTENT'),
      headers: { 'idempotency-key': 'synthetic-report-key-001' },
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error.code, 'CORE_IDEMPOTENCY_CONFLICT');
  } finally {
    harness.close();
  }
});

test('report source selection is explicit and bounded before resolution', async () => {
  const harness = createHarness();
  try {
    const missingSources = reviewedReportBody();
    missingSources.sections = missingSources.sections.map((section) => ({
      ...section,
      sourceIds: [],
    }));
    missingSources.claims = [];
    const missing = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: missingSources,
      headers: { 'idempotency-key': 'synthetic-report-no-sources' },
    });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error.code, 'CORE_REPORT_SOURCE_REQUIRED');

    const excessiveSources = reviewedReportBody();
    excessiveSources.sections = excessiveSources.sections.map((section, sectionIndex) => ({
      ...section,
      sourceIds: Array.from({ length: 100 }, (_, sourceIndex) => (
        `source-${sectionIndex}-${String(sourceIndex).padStart(3, '0')}`
      )),
    }));
    excessiveSources.claims[0].sourceIds = ['source-claim-500'];
    const excessive = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: excessiveSources,
      headers: { 'idempotency-key': 'synthetic-report-too-many-sources' },
    });
    assert.equal(excessive.status, 413);
    assert.equal(excessive.body.error.code, 'CORE_REPORT_SOURCE_LIMIT');
  } finally {
    harness.close();
  }
});

test('HTTP and repository approval fail closed when a report has validation blockers', async () => {
  const harness = createHarness();
  try {
    const blockedBody = reviewedReportBody('SYNTHETIC_BLOCKED_REPORT');
    blockedBody.sections = blockedBody.sections.filter((section) => (
      section.sectionKey !== 'recommendations'
    ));
    const draft = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: blockedBody,
      headers: { 'idempotency-key': 'synthetic-blocked-report' },
    });
    assert.equal(draft.status, 201, JSON.stringify(draft.body));
    assert.ok(draft.body.report.validation.blockerCount > 0);
    const submitted = await dispatch(
      harness.router,
      'POST',
      `/api/core/v1/artifacts/${draft.body.artifactId}/submit-review`,
      { body: { expectedArtifactStateVersion: 0 } },
    );
    assert.equal(submitted.status, 201);
    harness.setUser({
      id: 'user-reviewer-blocked-002',
      role: 'admin',
      account_status: 'active',
      profession: 'Accredited Exercise Physiologist',
    });
    const denied = await dispatch(
      harness.router,
      'POST',
      `/api/core/v1/reviews/${submitted.body.review.reviewId}/decision`,
      {
        body: {
          decision: 'approve',
          expectedReviewStateVersion: 0,
          expectedArtifactStateVersion: 1,
        },
      },
    );
    assert.equal(denied.status, 409);
    assert.equal(denied.body.error.code, 'CORE_REPORT_VALIDATION_BLOCKED');
    assert.equal(
      harness.repositories.reviews.get(submitted.body.review.reviewId, 'org-alpha').state,
      'pending',
    );
    assert.equal(harness.repositories.artifacts.get(draft.body.artifactId, 'org-alpha').state, 'review');

    const directRepositoryContext = deriveRequestContext({
      requestId: 'request-direct-blocked-approval',
      sessionUser: {
        id: 'user-reviewer-blocked-002',
        role: 'admin',
        account_status: 'active',
        profession: 'Accredited Exercise Physiologist',
      },
      authorisedOrgIds: ['org-alpha'],
      purpose: 'artifact_review',
      routeId: 'core_v1.direct_repository_blocked_approval',
      receivedAt: '2026-08-08T02:00:00.000Z',
    });
    assert.throws(
      () => harness.repositories.artifacts.transition({
        requestContext: directRepositoryContext,
        artifactId: draft.body.artifactId,
        expectedStateVersion: submitted.body.artifact.stateVersion,
        transition: transitionArtifactState('review', 'approved', {
          reviewId: submitted.body.review.reviewId,
        }),
        updatedAt: '2026-08-08T02:00:00.000Z',
      }),
      (error) => error.code === 'CORE_REPORT_VALIDATION_BLOCKED',
    );
    assert.equal(harness.repositories.artifacts.get(draft.body.artifactId, 'org-alpha').state, 'review');
  } finally {
    harness.close();
  }
});

test('three-actor release control remains sandbox-blocked and survives audit-window exhaustion', async () => {
  const harness = createHarness();
  try {
    const draft = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: reviewedReportBody(),
      headers: { 'idempotency-key': 'synthetic-review-key-001' },
    });
    assert.equal(draft.status, 201, JSON.stringify(draft.body));
    assert.equal(
      draft.body.report.validation.blockerCount,
      0,
      JSON.stringify(draft.body.report.validation),
    );
    assert.deepEqual(draft.body.report.subject, {
      type: 'client',
      id: 'synthetic-client-001',
    });
    const submitted = await dispatch(
      harness.router,
      'POST',
      `/api/core/v1/artifacts/${draft.body.artifactId}/submit-review`,
      { body: { expectedArtifactStateVersion: 0 } },
    );
    assert.equal(submitted.status, 201);
    assert.equal(submitted.body.artifact.state, 'review');
    assert.equal(submitted.body.review.state, 'pending');

    const selfApproval = await dispatch(
      harness.router,
      'POST',
      `/api/core/v1/reviews/${submitted.body.review.reviewId}/decision`,
      {
        body: {
          decision: 'approve',
          expectedReviewStateVersion: 0,
          expectedArtifactStateVersion: 1,
        },
      },
    );
    assert.equal(selfApproval.status, 403);
    assert.equal(selfApproval.body.error.code, 'CORE_SELF_APPROVAL_DENIED');
    const deniedAudit = harness.repositories.audit.listSummaries({ orgId: 'org-alpha' })
      .find((event) => event.metadata.errorCode === 'CORE_SELF_APPROVAL_DENIED');
    assert.ok(deniedAudit);
    assert.match(deniedAudit.metadata.errorCode, /^[A-Z][A-Z0-9_]+$/);

    harness.setUser({
      id: 'user-admin-nonclinical-002',
      role: 'admin',
      account_status: 'active',
      profession: 'Administrator',
    });
    const nonClinicalApproval = await dispatch(
      harness.router,
      'POST',
      `/api/core/v1/reviews/${submitted.body.review.reviewId}/decision`,
      {
        body: {
          decision: 'approve',
          expectedReviewStateVersion: 0,
          expectedArtifactStateVersion: 1,
        },
      },
    );
    assert.equal(nonClinicalApproval.status, 403);
    assert.equal(nonClinicalApproval.body.error.code, 'CORE_CLINICAL_REVIEWER_REQUIRED');

    harness.setUser({
      id: 'user-reviewer-002',
      role: 'admin',
      account_status: 'active',
      profession: 'Accredited Exercise Physiologist',
    });
    const approved = await dispatch(
      harness.router,
      'POST',
      `/api/core/v1/reviews/${submitted.body.review.reviewId}/decision`,
      {
        body: {
          decision: 'approve',
          expectedReviewStateVersion: 0,
          expectedArtifactStateVersion: 1,
        },
      },
    );
    assert.equal(approved.status, 200);
    assert.equal(approved.body.review.state, 'approved');
    assert.equal(approved.body.artifact.state, 'approved');
    assert.equal(approved.body.artifact.content.lifecycle.state, 'draft');
    assert.equal(approved.body.releaseControlComplete, false);
    assert.equal(approved.body.releaseEligible, false);

    const reviewerReleaseAttempt = await dispatch(
      harness.router,
      'POST',
      `/api/core/v1/artifacts/${draft.body.artifactId}/authorize-release`,
      {
        body: {
          expectedArtifactStateVersion: approved.body.artifact.stateVersion,
          contentFingerprint: approved.body.artifact.content.version.contentFingerprint,
          reportHtmlFingerprint: RENDER_FINGERPRINT,
          compatibilityVersion: 'assesssuite.legacy-report-compatibility.v1',
        },
      },
    );
    assert.equal(reviewerReleaseAttempt.status, 403);
    assert.equal(
      reviewerReleaseAttempt.body.error.code,
      'CORE_RELEASE_CONTROLLER_SEPARATION_REQUIRED',
    );

    harness.setUser({
      id: 'user-release-controller-003',
      role: 'admin',
      account_status: 'active',
      profession: 'Administrator',
    });
    const releaseControlled = await dispatch(
      harness.router,
      'POST',
      `/api/core/v1/artifacts/${draft.body.artifactId}/authorize-release`,
      {
        body: {
          expectedArtifactStateVersion: approved.body.artifact.stateVersion,
          contentFingerprint: approved.body.artifact.content.version.contentFingerprint,
          reportHtmlFingerprint: RENDER_FINGERPRINT,
          compatibilityVersion: 'assesssuite.legacy-report-compatibility.v1',
        },
      },
    );
    assert.equal(releaseControlled.status, 201, JSON.stringify(releaseControlled.body));
    assert.equal(releaseControlled.body.releaseControlComplete, true);
    assert.equal(releaseControlled.body.releaseEligible, false);
    assert.equal(releaseControlled.body.releaseBinding.environment, 'sandbox');
    assert.equal(releaseControlled.body.releaseBinding.productionReleaseAuthority, false);
    assert.equal(releaseControlled.body.releaseBinding.orgId, 'org-alpha');
    assert.equal(releaseControlled.body.releaseBinding.subjectType, 'client');
    assert.equal(releaseControlled.body.releaseBinding.subjectId, 'synthetic-client-001');
    assert.equal(releaseControlled.body.releaseBinding.reportHtmlFingerprint, RENDER_FINGERPRINT);
    assert.equal(releaseControlled.body.releaseAuthorization.metadata.subjectType, 'client');
    assert.equal(releaseControlled.body.releaseAuthorization.metadata.subjectId, 'synthetic-client-001');
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

    const duplicateRelease = await dispatch(
      harness.router,
      'POST',
      `/api/core/v1/artifacts/${draft.body.artifactId}/authorize-release`,
      {
        body: {
          expectedArtifactStateVersion: approved.body.artifact.stateVersion,
          contentFingerprint: approved.body.artifact.content.version.contentFingerprint,
          reportHtmlFingerprint: RENDER_FINGERPRINT,
          compatibilityVersion: 'assesssuite.legacy-report-compatibility.v1',
        },
      },
    );
    assert.equal(duplicateRelease.status, 409);
    assert.equal(duplicateRelease.body.error.code, 'CORE_RELEASE_ALREADY_AUTHORIZED');

    let replay;
    for (let index = 0; index < 105; index += 1) {
      replay = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
        body: reviewedReportBody(),
        headers: { 'idempotency-key': 'synthetic-review-key-001' },
      });
      assert.equal(replay.status, 201);
      assert.equal(replay.body.releaseControlComplete, true);
      assert.deepEqual(replay.body.releaseBinding, releaseControlled.body.releaseBinding);
    }
    const newestAuditWindow = harness.repositories.audit.listSummaries({
      orgId: 'org-alpha',
      entityType: 'artifact',
      entityId: draft.body.artifactId,
      limit: 100,
    });
    assert.equal(
      newestAuditWindow.some((event) => event.eventType === 'core.report.release_authorized'),
      false,
    );
    const exactReleaseAuthorizations = harness.repositories.audit.listSummaries({
      orgId: 'org-alpha',
      eventType: 'core.report.release_authorized',
      entityType: 'artifact',
      entityId: draft.body.artifactId,
      limit: 100,
    });
    assert.equal(exactReleaseAuthorizations.length, 1);
    assert.equal(
      exactReleaseAuthorizations[0].eventId,
      releaseControlled.body.releaseAuthorization.eventId,
    );

    const duplicateAfterAuditWindowExhaustion = await dispatch(
      harness.router,
      'POST',
      `/api/core/v1/artifacts/${draft.body.artifactId}/authorize-release`,
      {
        body: {
          expectedArtifactStateVersion: approved.body.artifact.stateVersion,
          contentFingerprint: approved.body.artifact.content.version.contentFingerprint,
          reportHtmlFingerprint: RENDER_FINGERPRINT,
          compatibilityVersion: 'assesssuite.legacy-report-compatibility.v1',
        },
      },
    );
    assert.equal(duplicateAfterAuditWindowExhaustion.status, 409);
    assert.equal(
      duplicateAfterAuditWindowExhaustion.body.error.code,
      'CORE_RELEASE_ALREADY_AUTHORIZED',
    );

    const detail = await dispatch(
      harness.router,
      'GET',
      `/api/core/v1/artifacts/${draft.body.artifactId}`,
    );
    assert.equal(detail.status, 200);
    assert.equal(detail.body.releaseControlComplete, true);
    assert.equal(detail.body.releaseEligible, false);
    assert.equal(detail.body.releaseBinding.releaseAuthorizationEventId,
      releaseControlled.body.releaseAuthorization.eventId);

    assert.equal(replay.body.state, 'approved');
    assert.equal(replay.body.releaseControlComplete, detail.body.releaseControlComplete);
    assert.equal(replay.body.releaseEligible, detail.body.releaseEligible);
    assert.deepEqual(replay.body.releaseBinding, detail.body.releaseBinding);
  } finally {
    harness.close();
  }
});

test('report supersession is same-subject/type/purpose and atomically retires the approved predecessor', async () => {
  const harness = createHarness();
  try {
    const predecessor = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: reviewedReportBody('SYNTHETIC_PREDECESSOR'),
      headers: { 'idempotency-key': 'synthetic-predecessor' },
    });
    assert.equal(predecessor.status, 201, JSON.stringify(predecessor.body));
    const predecessorApproval = await submitAndApprove(
      harness,
      predecessor,
      'user-predecessor-reviewer-002',
    );
    assert.equal(predecessorApproval.approved.status, 200, JSON.stringify(predecessorApproval.approved.body));

    harness.setUser({
      id: 'user-successor-author-003',
      role: 'admin',
      account_status: 'active',
      profession: 'Exercise Physiologist',
    });
    const unapprovedPredecessor = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: reviewedReportBody('SYNTHETIC_UNAPPROVED_PREDECESSOR'),
      headers: { 'idempotency-key': 'synthetic-unapproved-predecessor' },
    });
    const unapprovedSuccessorBody = reviewedReportBody('SYNTHETIC_INVALID_SUCCESSOR');
    unapprovedSuccessorBody.supersedesArtifactId = unapprovedPredecessor.body.artifactId;
    const unapprovedSuccessor = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: unapprovedSuccessorBody,
      headers: { 'idempotency-key': 'synthetic-invalid-successor' },
    });
    assert.equal(unapprovedSuccessor.status, 409);
    assert.equal(unapprovedSuccessor.body.error.code, 'CORE_PREDECESSOR_NOT_APPROVED');

    const crossSubjectBody = reviewedReportBody('SYNTHETIC_CROSS_SUBJECT');
    crossSubjectBody.subjectId = 'synthetic-client-foreign';
    crossSubjectBody.supersedesArtifactId = predecessor.body.artifactId;
    const crossSubject = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: crossSubjectBody,
      headers: { 'idempotency-key': 'synthetic-cross-subject-successor' },
    });
    assert.equal(crossSubject.status, 409);
    assert.equal(crossSubject.body.error.code, 'CORE_PREDECESSOR_SUBJECT_MISMATCH');

    const otherTypeBody = reviewedReportBody('SYNTHETIC_OTHER_REPORT_TYPE');
    otherTypeBody.templateSelector = { templateKey: 'medicare.initial-assessment.point-in-time.v1' };
    otherTypeBody.sections = [
      'reason_for_referral',
      'history_and_medications',
      'assessment_findings',
      'client_goals',
      'management_plan',
      'clinical_comments',
    ].map((sectionKey) => ({
      sectionKey,
      body: `Synthetic content for ${sectionKey}`,
      sourceIds: ['verified-source-001'],
    }));
    otherTypeBody.supersedesArtifactId = predecessor.body.artifactId;
    const otherType = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: otherTypeBody,
      headers: { 'idempotency-key': 'synthetic-other-type-successor' },
    });
    assert.equal(otherType.status, 409);
    assert.equal(otherType.body.error.code, 'CORE_PREDECESSOR_REPORT_IDENTITY_MISMATCH');

    const successorBody = reviewedReportBody('SYNTHETIC_VALID_SUCCESSOR');
    successorBody.supersedesArtifactId = predecessor.body.artifactId;
    const successor = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: successorBody,
      headers: { 'idempotency-key': 'synthetic-valid-successor' },
    });
    const siblingBody = reviewedReportBody('SYNTHETIC_SIBLING_SUCCESSOR_BOUND');
    siblingBody.supersedesArtifactId = predecessor.body.artifactId;
    const boundSibling = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: siblingBody,
      headers: { 'idempotency-key': 'synthetic-sibling-successor-bound' },
    });
    assert.equal(successor.status, 201, JSON.stringify(successor.body));
    assert.equal(boundSibling.status, 201, JSON.stringify(boundSibling.body));
    const siblingSubmitted = await dispatch(
      harness.router,
      'POST',
      `/api/core/v1/artifacts/${boundSibling.body.artifactId}/submit-review`,
      { body: { expectedArtifactStateVersion: 0 } },
    );
    assert.equal(siblingSubmitted.status, 201);

    const successorApproval = await submitAndApprove(
      harness,
      successor,
      'user-successor-reviewer-004',
    );
    assert.equal(successorApproval.approved.status, 200, JSON.stringify(successorApproval.approved.body));
    assert.equal(successorApproval.approved.body.supersededArtifact.artifactId, predecessor.body.artifactId);
    assert.equal(successorApproval.approved.body.supersededArtifact.state, 'superseded');
    assert.equal(
      harness.repositories.artifacts.get(predecessor.body.artifactId, 'org-alpha').state,
      'superseded',
    );

    const siblingApproval = await dispatch(
      harness.router,
      'POST',
      `/api/core/v1/reviews/${siblingSubmitted.body.review.reviewId}/decision`,
      {
        body: {
          decision: 'approve',
          expectedReviewStateVersion: 0,
          expectedArtifactStateVersion: 1,
        },
      },
    );
    assert.equal(siblingApproval.status, 409);
    assert.equal(siblingApproval.body.error.code, 'CORE_PREDECESSOR_NOT_APPROVED');
    assert.equal(
      harness.repositories.reviews.get(siblingSubmitted.body.review.reviewId, 'org-alpha').state,
      'pending',
    );
    assert.equal(
      harness.repositories.artifacts.get(boundSibling.body.artifactId, 'org-alpha').state,
      'review',
    );
  } finally {
    harness.close();
  }
});

test('run/artifact detail is tenant-scoped and assurance collections do not leak stored content', async () => {
  const harness = createHarness();
  try {
    const draft = await dispatch(harness.router, 'POST', '/api/core/v1/report-drafts', {
      body: reviewedReportBody(),
      headers: { 'idempotency-key': 'synthetic-assurance-key-001' },
    });
    const assurance = await dispatch(
      harness.router,
      'GET',
      '/api/core/v1/admin/assurance?org_id=org-alpha&limit=50',
    );
    assert.equal(assurance.status, 200);
    assert.deepEqual(assurance.body.environment, { mode: 'sandbox', production_enabled: false });
    assert.equal(assurance.body.schema.version, '1');
    assert.equal(Array.isArray(assurance.body.config_versions), true);
    const serialized = JSON.stringify(assurance.body);
    assert.equal(serialized.includes('SYNTHETIC_SECRET_ALPHA'), false);
    assert.equal(serialized.includes('must-not-enter-core@example.test'), false);
    assert.equal(serialized.includes('"content":'), false);

    harness.setAuthorisedOrgs(['org-bravo']);
    harness.setSelectedOrg(null);
    const crossTenantArtifact = await dispatch(
      harness.router,
      'GET',
      `/api/core/v1/artifacts/${draft.body.artifactId}`,
    );
    const crossTenantRun = await dispatch(
      harness.router,
      'GET',
      `/api/core/v1/runs/${draft.body.runId}`,
    );
    assert.equal(crossTenantArtifact.status, 404);
    assert.equal(crossTenantRun.status, 404);
  } finally {
    harness.close();
  }
});
