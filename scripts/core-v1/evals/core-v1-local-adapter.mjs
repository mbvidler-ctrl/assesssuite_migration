import {
  ASSESSMENT_DISCOVERY_MAX_RESULTS,
  ASSESSMENT_DISCOVERY_STATUS,
  discoverAssessments,
} from '../../../src/lib/clinical/assessmentDiscovery.js';
import {
  PROTOCOL_SEARCH_STATE,
  searchProtocolCatalogue,
} from '../../../src/lib/clinical/protocol-assistance/index.js';
import {
  buildDeterministicExportInput,
  composeReportDraft,
  createSourceManifest,
  transitionReportLifecycle,
} from '../../../src/lib/reports/core/reportCompositionEngine.js';

export const offlineOnly = true;

const REPORT_TEMPLATE_SELECTOR = Object.freeze({
  templateKey: 'general.progress-review.reporting-period.v1',
});
const REPORT_GENERATED_AT = '2026-08-08T00:30:00.000Z';
const REPORT_SECTIONS = Object.freeze([
  { sectionKey: 'reason_for_report', body: 'Synthetic report-composition evaluation.' },
  { sectionKey: 'treatment_summary', body: 'Synthetic administrative service summary.' },
  { sectionKey: 'outcome_measures', body: 'Synthetic structured outcome row.' },
  { sectionKey: 'current_status', body: 'Synthetic current status statement.' },
  { sectionKey: 'goal_progress', body: 'Synthetic goal progress statement.' },
  { sectionKey: 'next_period_plan', body: 'Synthetic next-period administrative statement.' },
]);

function ids(result) {
  return result.recommendations.map((entry) => entry.id);
}

function protocolIds(result) {
  return result.matches.map((entry) => entry.id);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assessmentConditions(caseDefinition) {
  return [
    ...(caseDefinition.case_facts.referral_terms || []),
    caseDefinition.case_facts.search_text,
  ].filter((value) => typeof value === 'string' && value.trim());
}

function generateAssessmentCatalogue(generator, count) {
  const anchors = generator.anchor_entries.map((entry) => ({
    ...entry,
    description: 'Synthetic anchor for deterministic catalogue growth evaluation.',
  }));
  const distractorCount = Math.max(0, count - anchors.length);
  const distractors = Array.from({ length: distractorCount }, (_, index) => ({
    id: `${generator.distractor_template.id_prefix}${String(index).padStart(5, '0')}`,
    name: `${generator.distractor_template.name_prefix}${String(index).padStart(5, '0')}`,
    category: generator.distractor_template.category,
    conditions_indicated: generator.distractor_template.conditions_indicated,
    description: 'Synthetic unrelated catalogue-growth distractor.',
  }));
  return [...anchors, ...distractors];
}

function evaluateAssessment(caseDefinition) {
  const checks = {};
  const conditions = assessmentConditions(caseDefinition);

  if (caseDefinition.case_id === 'assessment-hypertension-cardiorespiratory') {
    const catalogue = caseDefinition.fixture.catalogue;
    const forward = discoverAssessments({ conditions, assessments: catalogue, limit: 1000 });
    const reverse = discoverAssessments({ conditions, assessments: [...catalogue].reverse(), limit: 1000 });
    const leading = new Set(ids(forward).slice(0, 2));
    checks['AD-DEV-001'] = leading.has('synthetic-assessment-cardio-001')
      && leading.has('synthetic-assessment-cardio-002');
    checks['AD-DEV-002'] = forward.recommendations.length <= ASSESSMENT_DISCOVERY_MAX_RESULTS
      && sameJson(ids(forward), ids(reverse));
    checks['AD-DEV-003'] = forward.status === ASSESSMENT_DISCOVERY_STATUS.READY;
  } else if (caseDefinition.case_id === 'assessment-musculoskeletal-normalisation') {
    const result = discoverAssessments({ conditions, assessments: caseDefinition.fixture.catalogue });
    const resultIds = ids(result);
    const firstIndex = resultIds.indexOf('synthetic-assessment-msk-001');
    const secondIndex = resultIds.indexOf('synthetic-assessment-msk-002');
    const distractorIndex = resultIds.indexOf('synthetic-assessment-distractor-002');
    checks['AD-VAL-001'] = firstIndex >= 0;
    checks['AD-VAL-002'] = secondIndex >= 0;
    checks['AD-VAL-003'] = distractorIndex === -1
      || (firstIndex >= 0 && secondIndex >= 0 && distractorIndex > Math.max(firstIndex, secondIndex));
  } else if (caseDefinition.case_id === 'assessment-no-supported-condition') {
    const result = discoverAssessments({ conditions, assessments: caseDefinition.fixture.catalogue });
    checks['AD-LOCK-001'] = result.status === ASSESSMENT_DISCOVERY_STATUS.NO_CONDITIONS
      && result.recommendations.length === 0;
    checks['AD-LOCK-002'] = result.matchCount === 0;
    checks['AD-LOCK-003'] = result.status !== ASSESSMENT_DISCOVERY_STATUS.NO_MATCHES
      && result.status !== ASSESSMENT_DISCOVERY_STATUS.CATALOGUE_UNAVAILABLE;
  } else if (caseDefinition.case_id === 'assessment-full-catalogue-growth') {
    const generator = caseDefinition.fixture.catalogue_generator;
    const baselineCatalogue = generateAssessmentCatalogue(generator, generator.baseline_count);
    const grownCatalogue = generateAssessmentCatalogue(generator, generator.growth_count);
    const baseline = discoverAssessments({ conditions, assessments: baselineCatalogue, limit: 1000 });
    const grown = discoverAssessments({ conditions, assessments: grownCatalogue, limit: 1000 });
    const expectedAnchors = generator.anchor_entries.map((entry) => entry.id).sort();
    checks['AD-LOCK-004'] = sameJson(ids(baseline).slice(0, 2).sort(), expectedAnchors)
      && sameJson(ids(grown).slice(0, 2).sort(), expectedAnchors);
    checks['AD-LOCK-005'] = baseline.recommendations.length <= ASSESSMENT_DISCOVERY_MAX_RESULTS
      && grown.recommendations.length <= ASSESSMENT_DISCOVERY_MAX_RESULTS;
    checks['AD-LOCK-006'] = baseline.catalogueCount === generator.baseline_count
      && grown.catalogueCount === generator.growth_count;
  } else {
    throw new Error(`Unknown assessment-discovery case ${caseDefinition.case_id}`);
  }

  return checks;
}

function protocolContext(caseDefinition) {
  return {
    profession: caseDefinition.case_facts.profession,
    scope: caseDefinition.case_facts.scope,
    asOf: '2026-08-08',
  };
}

function evaluateProtocol(caseDefinition) {
  const checks = {};
  const context = protocolContext(caseDefinition);
  const catalogue = caseDefinition.fixture.library;
  const results = caseDefinition.case_facts.queries.map((query) => searchProtocolCatalogue({
    query,
    catalogue,
    ...context,
  }));

  if (caseDefinition.case_id === 'protocol-reviewed-exact-alias') {
    const [exact, alias] = results;
    checks['PS-DEV-001'] = exact.state === PROTOCOL_SEARCH_STATE.MATCHES
      && alias.state === PROTOCOL_SEARCH_STATE.MATCHES
      && sameJson(protocolIds(exact), protocolIds(alias))
      && protocolIds(exact)[0] === 'synthetic-protocol-001';
    checks['PS-DEV-002'] = Boolean(exact.matches[0]?.governance?.reviewer)
      && Boolean(exact.matches[0]?.governance?.version)
      && !Object.hasOwn(exact.matches[0]?.protocol || {}, 'content');
    checks['PS-DEV-003'] = !protocolIds(exact).includes('synthetic-protocol-distractor-001')
      && !protocolIds(alias).includes('synthetic-protocol-distractor-001');
  } else if (caseDefinition.case_id === 'protocol-unsupported-out-of-scope') {
    const [outOfScope, unsupported] = results;
    checks['PS-VAL-001'] = outOfScope.state === PROTOCOL_SEARCH_STATE.UNSUPPORTED
      && outOfScope.code === 'profession_out_of_bounds'
      && unsupported.state === PROTOCOL_SEARCH_STATE.UNSUPPORTED
      && unsupported.code === 'explicitly_unsupported'
      && outOfScope.matches.length === 0
      && unsupported.matches.length === 0;
    checks['PS-VAL-002'] = results.every((result) => !Object.hasOwn(result, 'protocol'));
    checks['PS-VAL-003'] = results.every((result) => result.matches.length === 0);
  } else if (caseDefinition.case_id === 'protocol-missing-governance') {
    const [result] = results;
    checks['PS-LOCK-001'] = result.state === PROTOCOL_SEARCH_STATE.CATALOGUE_BLOCKED
      && result.code === 'matching_catalogue_entry_failed_governance'
      && result.blocked?.[0]?.id === 'synthetic-protocol-incomplete-001';
    checks['PS-LOCK-002'] = result.matches.length === 0
      && Array.isArray(result.blocked?.[0]?.issues)
      && result.blocked[0].issues.length > 0;
    checks['PS-LOCK-003'] = !Object.hasOwn(result, 'protocol');
  } else {
    throw new Error(`Unknown protocol-search case ${caseDefinition.case_id}`);
  }

  return checks;
}

function reportSource(rawSource) {
  return {
    sourceId: rawSource.source_id,
    kind: 'synthetic_administrative_fact',
    title: `Synthetic source ${rawSource.source_id}`,
    occurredAt: rawSource.captured_at,
    recordedAt: rawSource.captured_at,
    locator: { fixture: rawSource.source_id },
    contentDigest: `sha256:${rawSource.source_id}`,
  };
}

function reportOptions(caseDefinition, { sources, claims, sections = REPORT_SECTIONS, ...overrides } = {}) {
  return {
    artifactId: `${caseDefinition.case_id}-artifact-v${overrides.versionNumber || 1}`,
    subject: { type: 'client', id: `${caseDefinition.case_id}-synthetic-client` },
    templateSelector: REPORT_TEMPLATE_SELECTOR,
    sourceCutoff: caseDefinition.case_facts.source_cutoff,
    reportingPeriod: { start: '2026-07-01', end: '2026-07-31' },
    sources,
    sections,
    claims,
    generatedAt: REPORT_GENERATED_AT,
    createdBy: 'core-v1-frozen-eval-adapter',
    ...overrides,
  };
}

function evaluateReport(caseDefinition) {
  const checks = {};

  if (caseDefinition.case_id === 'report-source-cutoff') {
    const sources = caseDefinition.fixture.sources.map(reportSource);
    const first = createSourceManifest({
      sourceCutoff: caseDefinition.case_facts.source_cutoff,
      sources,
    });
    const second = createSourceManifest({
      sourceCutoff: caseDefinition.case_facts.source_cutoff,
      sources: [...sources].reverse(),
    });
    const included = first.included.map((source) => source.sourceId);
    const excluded = first.excluded.map((source) => source.sourceId);
    checks['RC-DEV-001'] = sameJson(included, ['synthetic-source-001', 'synthetic-source-002']);
    checks['RC-DEV-002'] = sameJson(excluded, ['synthetic-source-003'])
      && first.excluded[0].exclusionReason === 'after_source_cutoff';
    checks['RC-DEV-003'] = first.fingerprint === second.fingerprint
      && sameJson(included, second.included.map((source) => source.sourceId));
  } else if (caseDefinition.case_id === 'report-conflicting-facts') {
    const sources = caseDefinition.fixture.sources.map(reportSource);
    const claims = caseDefinition.fixture.sources.map((rawSource, index) => ({
      claimId: `synthetic-conflict-claim-${index + 1}`,
      sectionKey: 'current_status',
      text: `Synthetic weekly service hours value ${rawSource.fact.weekly_service_hours}.`,
      sourceIds: [rawSource.source_id],
      factKey: 'weekly_service_hours',
      factScope: 'same-report-window',
      factValue: rawSource.fact.weekly_service_hours,
    }));
    const draft = composeReportDraft(reportOptions(caseDefinition, { sources, claims }));
    const conflictEntries = draft.claimLedger.entries.filter((entry) => entry.validationStatus === 'contradicted');
    checks['RC-VAL-001'] = conflictEntries.length === 2
      && sameJson(
        conflictEntries.flatMap((entry) => entry.sourceIds).sort(),
        ['synthetic-source-004', 'synthetic-source-005'],
      );
    checks['RC-VAL-002'] = new Set(conflictEntries.map((entry) => entry.factValue)).size === 2;
    checks['RC-VAL-003'] = draft.lifecycle.state === 'draft'
      && draft.validation.status === 'blocked'
      && draft.validation.issues.some((issue) => issue.code === 'CLAIM_CONTRADICTION');
  } else if (caseDefinition.case_id === 'report-classification-round-trip') {
    const [row] = caseDefinition.fixture.outcome_rows;
    const sources = row.source_ids.map((sourceId) => reportSource({
      source_id: sourceId,
      captured_at: '2026-07-20T00:00:00Z',
    }));
    const claims = [{
      claimId: row.row_id,
      sectionKey: 'outcome_measures',
      text: row.description,
      sourceIds: row.source_ids,
      factKey: 'outcome_row',
      factScope: 'synthetic-round-trip',
      factValue: row,
    }];
    const draft = composeReportDraft(reportOptions(caseDefinition, { sources, claims }));
    const exported = buildDeterministicExportInput(draft);
    const ledgerRow = draft.claimLedger.entries[0].factValue;
    const exportedRow = exported.claimLedger.entries[0].factValue;
    checks['RC-VAL-004'] = ledgerRow.classification === 'Goal'
      && exportedRow.classification === 'Goal';
    checks['RC-VAL-005'] = ledgerRow.row_id === row.row_id
      && ledgerRow.domain === row.domain
      && ledgerRow.description === row.description
      && sameJson(ledgerRow.source_ids, row.source_ids);
    checks['RC-VAL-006'] = sameJson(ledgerRow, exportedRow);
  } else if (caseDefinition.case_id === 'report-missing-source') {
    const source = reportSource({
      source_id: 'synthetic-source-007',
      captured_at: '2026-07-20T00:00:00Z',
    });
    const claims = caseDefinition.fixture.claims.map((claim, index) => ({
      claimId: claim.claim_id,
      sectionKey: index === 0 ? 'current_status' : 'goal_progress',
      text: claim.text,
      sourceIds: claim.source_ids,
    }));
    const draft = composeReportDraft(reportOptions(caseDefinition, {
      sources: [source],
      claims,
    }));
    const unsupported = draft.claimLedger.entries.find((entry) => entry.claimId === 'synthetic-claim-unsupported-001');
    checks['RC-LOCK-001'] = unsupported?.validationStatus === 'missing_source'
      && unsupported.sourceIds.length === 0;
    checks['RC-LOCK-002'] = draft.validation.status === 'blocked'
      && draft.validation.issues.some((issue) => issue.code === 'CLAIM_SOURCE_MISSING');
    checks['RC-LOCK-003'] = unsupported.unresolvedSourceIds.length === 0
      && draft.sourceManifest.included.every((entry) => entry.sourceId === 'synthetic-source-007');
  } else if (caseDefinition.case_id === 'report-draft-review-invariants') {
    const source = reportSource({
      source_id: 'synthetic-lifecycle-source-001',
      captured_at: '2026-07-20T00:00:00Z',
    });
    const claims = [{
      claimId: 'synthetic-lifecycle-claim-001',
      sectionKey: 'current_status',
      text: 'Synthetic lifecycle claim.',
      sourceIds: [source.sourceId],
    }];
    const draft = composeReportDraft(reportOptions(caseDefinition, { sources: [source], claims }));
    const inReview = transitionReportLifecycle(draft, {
      to: 'in_review',
      at: '2026-08-08T01:00:00.000Z',
      actorId: 'synthetic-editor',
      reason: 'Synthetic review requested',
    });
    const approved = transitionReportLifecycle(inReview, {
      to: 'approved',
      at: '2026-08-08T02:00:00.000Z',
      actorId: 'synthetic-human-reviewer',
      actorRole: 'human_reviewer',
      reason: 'Synthetic review completed',
    });
    const approvedSnapshot = JSON.stringify(approved);
    const newSections = REPORT_SECTIONS.map((section) => (
      section.sectionKey === 'current_status'
        ? { ...section, body: `${section.body} Edited in a new version.` }
        : section
    ));
    const secondDraft = composeReportDraft(reportOptions(caseDefinition, {
      sources: [source],
      claims,
      sections: newSections,
      versionNumber: 2,
      supersedesArtifactId: approved.artifactId,
    }));
    checks['RC-LOCK-004'] = draft.lifecycle.state === 'draft'
      && draft.lifecycle.reviews.length === 0
      && buildDeterministicExportInput(draft).releaseEligible === false;
    checks['RC-LOCK-005'] = approved.lifecycle.state === 'approved'
      && approved.lifecycle.reviews.length === 1
      && approved.lifecycle.reviews[0].reviewerId === 'synthetic-human-reviewer'
      && approved.lifecycle.reviews[0].reviewerRole === 'human_reviewer';
    checks['RC-LOCK-006'] = JSON.stringify(approved) === approvedSnapshot
      && secondDraft.lifecycle.state === 'draft'
      && secondDraft.version.number === 2
      && secondDraft.version.supersedesArtifactId === approved.artifactId;
    checks['RC-LOCK-007'] = approved.lifecycle.events.length === 3
      && approved.lifecycle.events.every((event, index, events) => (
        index === 0 || Date.parse(event.at) >= Date.parse(events[index - 1].at)
      ));
  } else {
    throw new Error(`Unknown report-composition case ${caseDefinition.case_id}`);
  }

  return checks;
}

export async function evaluateCase(caseDefinition) {
  let checks;
  if (caseDefinition.capability === 'assessment-discovery') {
    checks = evaluateAssessment(caseDefinition);
  } else if (caseDefinition.capability === 'protocol-search') {
    checks = evaluateProtocol(caseDefinition);
  } else if (caseDefinition.capability === 'report-composition') {
    checks = evaluateReport(caseDefinition);
  } else {
    throw new Error(`Unknown capability ${caseDefinition.capability}`);
  }

  return {
    provider_calls: 0,
    checks,
  };
}
