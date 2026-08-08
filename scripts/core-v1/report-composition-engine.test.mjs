import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDeterministicExportInput,
  composeReportDraft,
  createSourceManifest,
  transitionReportLifecycle,
} from "../../src/lib/reports/core/reportCompositionEngine.js";

const TEMPLATE_SELECTOR = { templateKey: "general.progress-review.reporting-period.v1" };
const GENERATED_AT = "2026-08-08T00:30:00.000Z";
const SOURCE_CUTOFF = "2026-08-07T23:59:59.999+10:00";

const sections = [
  { sectionKey: "reason_for_report", body: "Synthetic participant progress review." },
  { sectionKey: "treatment_summary", body: "Synthetic exercise sessions were recorded in the fixture." },
  { sectionKey: "outcome_measures", body: "See the deterministic outcome table." },
  { sectionKey: "current_status", body: "Synthetic current status statement." },
  { sectionKey: "goal_progress", body: "Synthetic goal progress statement." },
  { sectionKey: "next_period_plan", body: "Synthetic plan statement." },
];

const sources = [
  {
    sourceId: "synthetic-assessment-001",
    kind: "assessment_result",
    title: "Synthetic assessment result",
    occurredAt: "2026-08-05",
    recordedAt: "2026-08-05T01:00:00.000Z",
    locator: { entity: "ClientAssessment", id: "synthetic-ca-001" },
    contentDigest: "sha256:synthetic-assessment-001",
  },
  {
    sourceId: "synthetic-soap-001",
    kind: "soap_note",
    title: "Synthetic SOAP note",
    occurredAt: "2026-08-06T02:00:00.000Z",
    locator: { entity: "SOAPNote", id: "synthetic-soap-001" },
    contentDigest: "sha256:synthetic-soap-001",
  },
];

const claims = [
  {
    claimId: "claim-current-status",
    sectionKey: "current_status",
    text: "The synthetic fixture records the current status.",
    sourceIds: ["synthetic-soap-001"],
    factKey: "status",
    factScope: "2026-08-06",
    factValue: "recorded",
  },
  {
    claimId: "claim-outcome",
    sectionKey: "outcome_measures",
    text: "The synthetic assessment contains a recorded outcome value.",
    sourceIds: ["synthetic-assessment-001"],
    factKey: "outcome_value",
    factScope: "2026-08-05",
    factValue: 42,
  },
];

function validDraft(overrides = {}) {
  return composeReportDraft({
    subject: { type: "client", id: "synthetic-client" },
    templateSelector: TEMPLATE_SELECTOR,
    sourceCutoff: SOURCE_CUTOFF,
    reportingPeriod: { start: "2026-08-01", end: "2026-08-07" },
    sources,
    sections,
    claims,
    generatedAt: GENERATED_AT,
    createdBy: "synthetic-composer",
    ...overrides,
  });
}

test("freezes a deterministic source manifest at an explicit cutoff", () => {
  const manifest = createSourceManifest({
    sourceCutoff: SOURCE_CUTOFF,
    sources: [
      ...sources,
      {
        sourceId: "synthetic-future-001",
        kind: "soap_note",
        occurredAt: "2026-08-08T23:00:00.000Z",
        contentDigest: "sha256:future",
      },
      {
        sourceId: "synthetic-undated-001",
        kind: "note",
        contentDigest: "sha256:undated",
      },
      {
        sourceId: "synthetic-edited-after-cutoff",
        kind: "soap_note",
        occurredAt: "2026-08-01T00:00:00.000Z",
        recordedAt: "2026-08-08T00:00:00.000Z",
        contentDigest: "sha256:edited-after-cutoff",
      },
    ],
  });

  assert.deepEqual(manifest.included.map((source) => source.sourceId), [
    "synthetic-assessment-001",
    "synthetic-soap-001",
  ]);
  assert.deepEqual(
    Object.fromEntries(manifest.excluded.map((source) => [source.sourceId, source.exclusionReason])),
    {
      "synthetic-future-001": "after_source_cutoff",
      "synthetic-undated-001": "missing_or_invalid_effective_at",
      "synthetic-edited-after-cutoff": "after_source_cutoff",
    }
  );
  assert.match(manifest.fingerprint, /^fnv1a32:[a-f0-9]{8}$/);
  assert.throws(
    () => createSourceManifest({ sourceCutoff: "2026-08-07T23:59:59", sources: [] }),
    /explicit timezone/
  );
});

test("composition is invariant to input ordering", () => {
  const first = validDraft();
  const second = validDraft({
    sources: [...sources].reverse(),
    sections: [...sections].reverse(),
    claims: [...claims].reverse(),
  });

  assert.equal(first.artifactId, second.artifactId);
  assert.equal(first.version.contentFingerprint, second.version.contentFingerprint);
  assert.deepEqual(first.subject, { type: "client", id: "synthetic-client" });
  assert.deepEqual(buildDeterministicExportInput(first), buildDeterministicExportInput(second));
  assert.equal(first.validation.status, "ready_for_review");
  assert.equal(first.validation.blockerCount, 0);
  assert.notEqual(
    first.version.contentFingerprint,
    validDraft({ subject: { type: "client", id: "synthetic-other-client" } }).version.contentFingerprint,
  );
  assert.throws(() => validDraft({ subject: undefined }), /subject must be an object/);
  assert.throws(
    () => validDraft({ subject: { type: "client", id: "synthetic-client", extra: true } }),
    /exactly type and id/,
  );
});

test("missing and post-cutoff sources plus contradictions block approval", () => {
  const blocked = validDraft({
    sources: [
      ...sources,
      {
        sourceId: "synthetic-after-cutoff",
        kind: "assessment_result",
        occurredAt: "2026-08-09T00:00:00.000Z",
        locator: { entity: "ClientAssessment", id: "synthetic-future" },
        contentDigest: "sha256:future",
      },
    ],
    claims: [
      ...claims,
      {
        claimId: "claim-after-cutoff",
        sectionKey: "current_status",
        text: "A future fixture must not ground this report.",
        sourceIds: ["synthetic-after-cutoff"],
      },
      {
        claimId: "claim-conflict-a",
        sectionKey: "goal_progress",
        text: "Synthetic fact value A.",
        sourceIds: ["synthetic-soap-001"],
        factKey: "goal_state",
        factScope: "same-review-window",
        factValue: "achieved",
      },
      {
        claimId: "claim-conflict-b",
        sectionKey: "goal_progress",
        text: "Synthetic fact value B.",
        sourceIds: ["synthetic-assessment-001"],
        factKey: "goal_state",
        factScope: "same-review-window",
        factValue: "not_achieved",
      },
    ],
  });
  const codes = blocked.validation.issues.map((item) => item.code);
  assert.ok(codes.includes("CLAIM_SOURCE_MISSING"));
  assert.ok(codes.includes("CLAIM_CONTRADICTION"));
  assert.equal(blocked.validation.status, "blocked");

  const inReview = transitionReportLifecycle(blocked, {
    to: "in_review",
    at: "2026-08-08T01:00:00.000Z",
    actorId: "synthetic-composer",
    reason: "Request review of blocker fixture",
  });
  assert.throws(
    () => transitionReportLifecycle(inReview, {
      to: "approved",
      at: "2026-08-08T02:00:00.000Z",
      actorId: "synthetic-reviewer",
      actorRole: "reviewer",
      reason: "Cannot approve unresolved blockers",
    }),
    /validation blockers/
  );
});

test("an omitted claim ledger cannot silently produce a review-ready clinical report", () => {
  const withoutClaims = validDraft({ claims: [] });
  assert.equal(withoutClaims.validation.status, "blocked");
  assert.ok(withoutClaims.validation.issues.some((item) => item.code === "CLAIM_LEDGER_EMPTY"));
});

test("local review readiness never becomes release eligibility without exact Core authority", () => {
  const draft = validDraft({ artifactId: "synthetic-report-001" });
  const inReview = transitionReportLifecycle(draft, {
    to: "in_review",
    at: "2026-08-08T01:00:00.000Z",
    actorId: "synthetic-composer",
    reason: "Composition complete",
  });
  const approved = transitionReportLifecycle(inReview, {
    to: "approved",
    at: "2026-08-08T02:00:00.000Z",
    actorId: "synthetic-reviewer",
    actorRole: "exercise_physiologist_reviewer",
    reason: "Synthetic evidence and claims reviewed",
  });

  const draftExport = buildDeterministicExportInput(draft);
  const approvedExport = buildDeterministicExportInput(approved);
  const releaseBinding = {
    schemaVersion: "assesssuite.report-release-binding.v1",
    environment: "production",
    artifactId: approved.artifactId,
    orgId: "synthetic-org",
    subjectType: "client",
    subjectId: "synthetic-client",
    artifactState: "approved",
    artifactStateVersion: 2,
    authorActorId: "synthetic-composer",
    contentHash: `sha256:${"a".repeat(64)}`,
    contentFingerprint: approved.version.contentFingerprint,
    reportHtmlFingerprint: `sha256:${"b".repeat(64)}`,
    compatibilityVersion: "assesssuite.legacy-report-compatibility.v1",
    reviewId: "synthetic-review",
    reviewerActorId: "synthetic-reviewer",
    releaseAuthorizationEventId: "synthetic-release-event",
    releaseControllerActorId: "synthetic-release-controller",
    releaseControlComplete: true,
    releaseEligible: true,
    productionReleaseAuthority: true,
  };
  const boundExport = buildDeterministicExportInput(draft, {
    releaseBinding,
    orgId: "synthetic-org",
  });
  assert.equal(draftExport.releaseEligible, false);
  assert.equal(draftExport.reviewReady, false);
  assert.equal(approvedExport.reviewReady, true);
  assert.equal(approvedExport.releaseEligible, false);
  assert.equal(approvedExport.lifecycleState, "draft");
  assert.equal(approvedExport.reviewReadinessState, "approved");
  assert.equal(approvedExport.releaseAuthority.bindingStatus, "required");
  assert.equal(boundExport.releaseEligible, true);
  assert.equal(boundExport.lifecycleState, "approved");
  assert.deepEqual(boundExport.subject, { type: "client", id: "synthetic-client" });
  assert.equal(boundExport.releaseAuthority.bindingStatus, "verified");
  assert.deepEqual(boundExport.releaseBinding, releaseBinding);
  assert.equal(buildDeterministicExportInput(draft, { releaseBinding }).releaseEligible, false);
  assert.equal(buildDeterministicExportInput(draft, {
    releaseBinding: { ...releaseBinding, environment: "sandbox", releaseEligible: false },
    orgId: "synthetic-org",
  }).releaseEligible, false);
  assert.equal(buildDeterministicExportInput(draft, {
    releaseBinding: { ...releaseBinding, unexpected: true },
    orgId: "synthetic-org",
  }).releaseEligible, false);
  const { authorActorId: omittedAuthor, ...missingAuthorBinding } = releaseBinding;
  assert.equal(omittedAuthor, "synthetic-composer");
  assert.equal(buildDeterministicExportInput(draft, {
    releaseBinding: missingAuthorBinding,
    orgId: "synthetic-org",
  }).releaseEligible, false);
  assert.equal(buildDeterministicExportInput(draft, {
    releaseBinding: { ...releaseBinding, authorActorId: "synthetic-substituted-author" },
    orgId: "synthetic-org",
  }).releaseEligible, false);
  const { orgId: omittedOrgId, ...missingTenantBinding } = releaseBinding;
  assert.equal(omittedOrgId, "synthetic-org");
  assert.equal(buildDeterministicExportInput(draft, {
    releaseBinding: missingTenantBinding,
    orgId: "synthetic-org",
  }).releaseEligible, false);
  assert.equal(buildDeterministicExportInput(draft, {
    releaseBinding: { ...releaseBinding, orgId: "synthetic-foreign-org" },
    orgId: "synthetic-org",
  }).releaseEligible, false);
  assert.equal(buildDeterministicExportInput(draft, {
    releaseBinding: { ...releaseBinding, subjectId: "synthetic-foreign-client" },
    orgId: "synthetic-org",
  }).releaseEligible, false);
  const { subjectType: omittedSubjectType, ...missingSubjectBinding } = releaseBinding;
  assert.equal(omittedSubjectType, "client");
  assert.equal(buildDeterministicExportInput(draft, {
    releaseBinding: missingSubjectBinding,
    orgId: "synthetic-org",
  }).releaseEligible, false);
  assert.equal(approved.lifecycle.reviews.length, 1);
  assert.equal(approved.lifecycle.reviews[0].contentFingerprint, draft.version.contentFingerprint);
  assert.deepEqual(approved.sections, draft.sections);
  assert.deepEqual(approved.claimLedger, draft.claimLedger);
});
