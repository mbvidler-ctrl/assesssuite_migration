import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { GENERATED_ASSESSMENT_ROUTES } from '../../src/components/assessments/assessmentRunnerRegistry.generated.js';
import { projectAssessmentResult } from '../../src/components/reports/assessmentResultProjection.js';
import {
  buildStructuredFixture,
  scoreQuestionnaireAssessment,
  scoreStructuredAssessment,
} from '../../src/lib/clinical/assessmentScoring.js';
import { discoverAssessments, searchAssessments } from '../../src/lib/clinical/assessmentDiscovery.js';
import {
  buildRegisteredAssessmentFixture,
  resolveRegisteredAssessmentScorer,
  validateAndScoreRegisteredAssessment,
} from '../../src/lib/clinical/assessmentScorerRegistry.js';
import { buildDass21Payload, DASS21_QUESTIONS } from '../../src/lib/clinical/dass21.js';
import { createEntityRepository } from '../db.mjs';
import { buildPhysioCatalogueManifest } from './physio-catalogue.mjs';
import { buildPhysioRunnerContentAudit } from './physio-runner-content-audit.mjs';

export const PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR = 236;
export const PHYSIO_ASSESSMENT_ACCEPTANCE_STAGES = Object.freeze([
  'validation',
  'score',
  'persistReload',
  'soap',
  'report',
  'search',
  'recommendation',
]);
export const PHYSIO_ASSESSMENT_SCORING_MODES = Object.freeze({
  REGISTERED_REAL_SCORER: 'registered-real-scorer',
  SHARED_REAL_SCORER: 'shared-real-scorer',
  RUNNER_BOUNDARY_CONTRACT: 'runner-boundary-contract',
});
export const PHYSIO_ASSESSMENT_PERSISTENCE_MODE = 'sqlite-entity-client-assessment-repository-round-trip';

const FIXTURE_DATE = '2026-08-22';
const FORBIDDEN_ROUTE_TERMS = new Set(['generic', 'manual', 'fallback']);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sortedJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortedJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortedJsonValue(value[key])]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(sortedJsonValue(value));
}

/**
 * Opens the same synchronous repository contract used by the production shim,
 * but against a private SQLite database owned by one acceptance run.
 */
export function createPhysioAcceptancePersistenceHarness() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE entity_ClientAssessment (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT
    );
  `);
  const repository = createEntityRepository(db, 'ClientAssessment');
  let closed = false;
  return Object.freeze({
    db,
    repository,
    get closed() {
      return closed;
    },
    close() {
      if (closed) return;
      db.close();
      closed = true;
    },
  });
}

/** Persists and reloads one completed result, rejecting any byte-level JSON drift. */
export function persistReloadClientAssessment(repository, canonicalId, scored) {
  invariant(repository && typeof repository.create === 'function', 'ClientAssessment repository is unavailable');
  invariant(typeof repository.getById === 'function', 'ClientAssessment repository cannot reload records');
  const expected = JSON.parse(JSON.stringify({
    assessment_id: canonicalId,
    ...scored,
  }));
  const created = repository.create(expected, 'physio-acceptance@assesssuite.test');
  invariant(created?.id, `${canonicalId} persistence did not return a record ID`);
  const record = repository.getById(created.id);
  invariant(record, `${canonicalId} persistence reload returned no record`);
  const {
    id: _id,
    created_date: _createdDate,
    updated_date: _updatedDate,
    created_by: _createdBy,
    assessment_id: reloadedCanonicalId,
    ...reloaded
  } = record;
  invariant(reloadedCanonicalId === canonicalId, `${canonicalId} persistence identity drifted`);
  invariant(
    stableJson({ assessment_id: reloadedCanonicalId, ...reloaded }) === stableJson(expected),
    `${canonicalId} persistence round-trip drifted`,
  );
  invariant(
    !Object.is(Number(scored.result_value), 0) || Object.is(Number(reloaded.result_value), 0),
    `${canonicalId} persistence lost a numeric zero`,
  );
  return Object.freeze({ persistenceKey: created.id, reloaded: Object.freeze(reloaded) });
}

function questionnaireFixture(assessment) {
  return Object.fromEntries(assessment.questions.map((question, index) => {
    const firstOption = Array.isArray(question.options) ? question.options[0] : null;
    const value = firstOption?.value ?? (question.question_type === 'yes_no' ? 0 : null);
    invariant(value !== null && value !== undefined, `${assessment.name} Q${index + 1} has no fixture-compatible option`);
    return [index, Number(value)];
  }));
}

function scoreFixture(route, assessment) {
  if (resolveRegisteredAssessmentScorer(route.scoringKey)) {
    return validateAndScoreRegisteredAssessment(
      route.scoringKey,
      buildRegisteredAssessmentFixture(route.scoringKey),
      {
        assessmentName: assessment.name,
        assessmentDate: FIXTURE_DATE,
      },
    );
  }
  if (route.scoringKey === 'bpi') {
    return scoreQuestionnaireAssessment(assessment, {
      0: 1,
      1: 8,
      2: 2,
      3: 5,
      4: 5,
      5: 2,
      6: 3,
      7: 4,
      8: 5,
      9: 6,
      10: 7,
      11: 8,
    }, { scoringKey: 'bpi', assessmentDate: FIXTURE_DATE });
  }
  if (route.scoringKey === 'questionnaire-sum') {
    return scoreQuestionnaireAssessment(assessment, questionnaireFixture(assessment), {
      scoringKey: 'questionnaire-sum',
      assessmentDate: FIXTURE_DATE,
    });
  }
  if (route.scoringKey === 'dass21') {
    const rawScores = Object.fromEntries(DASS21_QUESTIONS.map((_, index) => [index, index % 4]));
    return { ...buildDass21Payload(rawScores), assessment_date: FIXTURE_DATE };
  }
  if (route.host === 'structured') {
    return scoreStructuredAssessment(route.scoringKey, buildStructuredFixture(route.scoringKey), {
      assessmentName: assessment.name,
      assessmentDate: FIXTURE_DATE,
    });
  }

  // Dedicated interactive runners own their clinical formula and UI. The
  // acceptance harness exercises their common completed-payload boundary with
  // a deterministic zero-value result, which also proves zero survives every
  // downstream stage. Instrument-specific formula tests remain colocated with
  // each runner; this fixture is not a substitute clinical score.
  return {
    status: 'completed',
    result_value: 0,
    assessment_date: FIXTURE_DATE,
    additional_data: {
      measurement_type: route.runnerKey,
      route_key: route.runnerKey,
      fixture_kind: 'runner-boundary-contract',
      soap_text: `• ${assessment.name}\n  Canonical runner ${route.runnerKey} completed with fixture result 0 ${assessment.unit_of_measure || ''}`.trim(),
    },
    notes: `Acceptance fixture for ${route.runnerKey}`,
  };
}

function scoringModeFor(route) {
  if (resolveRegisteredAssessmentScorer(route.scoringKey)) {
    return PHYSIO_ASSESSMENT_SCORING_MODES.REGISTERED_REAL_SCORER;
  }
  if (
    route.scoringKey === 'bpi'
    || route.scoringKey === 'questionnaire-sum'
    || route.scoringKey === 'dass21'
    || route.host === 'structured'
  ) {
    return PHYSIO_ASSESSMENT_SCORING_MODES.SHARED_REAL_SCORER;
  }
  return PHYSIO_ASSESSMENT_SCORING_MODES.RUNNER_BOUNDARY_CONTRACT;
}

function assertProductionSearchHit(assessments, query, canonicalId, label) {
  invariant(String(query || '').trim(), `${label} has an empty production-search query`);
  const results = searchAssessments({ assessments, query });
  invariant(
    results.some((assessment) => assessment.canonical_id === canonicalId),
    `${label} is not discoverable through production search: ${query}`,
  );
}

function validateRoute(route, assessment) {
  invariant(route, `${assessment.name} has no route`);
  invariant(route.canonicalId === assessment.canonical_id, `${assessment.name} route ID mismatch`);
  invariant(route.name === assessment.name, `${assessment.name} route name mismatch`);
  invariant(route.host && !FORBIDDEN_ROUTE_TERMS.has(route.host), `${assessment.name} has forbidden host ${route.host}`);
  invariant(
    route.runnerKey
      && route.runnerKey !== 'test-runner'
      && !FORBIDDEN_ROUTE_TERMS.has(route.runnerKey),
    `${assessment.name} has non-deterministic runner key ${route.runnerKey}`,
  );
  invariant(route.scoringKey, `${assessment.name} has no scoring key`);
  invariant(Array.isArray(assessment.source_variants), `${assessment.name} has no source-variant collection`);
}

export function buildPhysioAssessmentAcceptanceMatrix(manifest = buildPhysioCatalogueManifest()) {
  invariant(
    manifest.canonicalAssessments.length === PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR,
    `acceptance denominator must be ${PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR}`,
  );
  invariant(
    GENERATED_ASSESSMENT_ROUTES.length === PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR,
    `route denominator must be ${PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR}`,
  );

  const routeById = new Map(GENERATED_ASSESSMENT_ROUTES.map((route) => [route.canonicalId, route]));
  invariant(routeById.size === PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR, 'route canonical IDs are not unique');
  const runnerContentAudit = buildPhysioRunnerContentAudit(manifest);
  const runnerContentById = new Map(runnerContentAudit.rows.map((row) => [row.canonicalId, row]));
  invariant(runnerContentById.size === PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR, 'runner-content audit denominator drifted');
  const assessments = manifest.canonicalAssessments.map(({ content }) => content);
  const recommendationCandidates = assessments.map((assessment) => ({
    ...assessment,
    id: assessment.canonical_id,
  }));
  const persistence = createPhysioAcceptancePersistenceHarness();
  let rows;
  try {
    rows = manifest.canonicalAssessments.map(({ canonicalId, content: assessment }) => {
    const route = routeById.get(canonicalId);
    validateRoute(route, assessment);

    const scored = scoreFixture(route, assessment);
    invariant(scored.status === 'completed', `${assessment.name} did not complete`);
    invariant(Number.isFinite(Number(scored.result_value)), `${assessment.name} score is not finite`);

    const { persistenceKey, reloaded } = persistReloadClientAssessment(
      persistence.repository,
      canonicalId,
      scored,
    );

    const soapText = String(reloaded.additional_data?.soap_text || '').trim();
    invariant(soapText.length > 0, `${assessment.name} has no SOAP text`);
    const report = projectAssessmentResult({ assessment, completedAssessment: reloaded });
    invariant(report.soap_text === soapText, `${assessment.name} report lost SOAP text`);

    const productionSearchTerms = [
      { label: `${assessment.name} canonical name`, query: assessment.name },
      { label: `${assessment.name} canonical ID`, query: canonicalId },
      ...(assessment.aliases || []).map((alias) => ({
        label: `${assessment.name} alias`,
        query: alias,
      })),
      ...(assessment.source_variants || []).flatMap((variant, index) => [
        { label: `${assessment.name} source variant ${index + 1} name`, query: variant.source_name },
        { label: `${assessment.name} source variant ${index + 1} reference`, query: variant.source_ref },
      ]),
    ];
    for (const { label, query } of productionSearchTerms) {
      assertProductionSearchHit(assessments, query, canonicalId, label);
    }

    const recommendations = discoverAssessments({
      conditions: [{ name: assessment.name }],
      assessments: recommendationCandidates,
      limit: 5,
    });
    invariant(
      recommendations.some(({ canonical_id: recommendedId }) => recommendedId === canonicalId),
      `${assessment.name} was not recommendation-discoverable by its canonical name`,
    );

    const scoringMode = scoringModeFor(route);
    const executesActualScorer = scoringMode !== PHYSIO_ASSESSMENT_SCORING_MODES.RUNNER_BOUNDARY_CONTRACT;
    const runnerContent = runnerContentById.get(canonicalId);
    const executesCompleteInstrumentPath = executesActualScorer && runnerContent.noAbridgementComplete;
    return Object.freeze({
      canonicalId,
      name: assessment.name,
      host: route.host,
      runnerKey: route.runnerKey,
      scoringKey: route.scoringKey,
      scoringMode,
      executesActualValidation: executesCompleteInstrumentPath,
      executesActualScorer,
      executesCompleteInstrumentPath,
      noAbridgementComplete: runnerContent.noAbridgementComplete,
      runnerContentGaps: runnerContent.gaps,
      resultValue: Number(scored.result_value),
      persistenceKey,
      persistenceMode: PHYSIO_ASSESSMENT_PERSISTENCE_MODE,
      productionSearchQueryCount: productionSearchTerms.length,
      recommendationCandidateCount: recommendationCandidates.length,
      payloadSha256: sha256(JSON.stringify(scored)),
      reportSha256: sha256(JSON.stringify(report)),
      stages: Object.freeze({
        validation: executesCompleteInstrumentPath,
        score: executesCompleteInstrumentPath,
        persistReload: true,
        soap: true,
        report: true,
        search: true,
        recommendation: true,
      }),
    });
    });
  } finally {
    persistence.close();
  }
  invariant(persistence.closed, 'acceptance SQLite database was not closed deterministically');

  invariant(rows.length === PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR, 'acceptance matrix row count drifted');
  const passedRows = rows.filter(({ stages }) => Object.values(stages).every(Boolean));
  const failedRows = rows.filter(({ stages }) => !Object.values(stages).every(Boolean));
  const scoringModeCounts = Object.freeze(Object.fromEntries(
    Object.values(PHYSIO_ASSESSMENT_SCORING_MODES).map((mode) => [
      mode,
      rows.filter((row) => row.scoringMode === mode).length,
    ]),
  ));
  invariant(
    Object.values(scoringModeCounts).reduce((sum, count) => sum + count, 0)
      === PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR,
    'acceptance matrix scoring-mode denominator drifted',
  );
  const actualScoringFrontierByHost = Object.freeze(Object.fromEntries(
    [...new Set(rows.map((row) => row.host))].sort().map((host) => [
      host,
      rows.filter((row) => row.host === host && !row.executesActualScorer).length,
    ]),
  ));
  const completeInstrumentFrontierByHost = Object.freeze(Object.fromEntries(
    [...new Set(rows.map((row) => row.host))].sort().map((host) => [
      host,
      rows.filter((row) => row.host === host && !row.executesCompleteInstrumentPath).length,
    ]),
  ));

  return Object.freeze({
    denominator: PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR,
    passed: passedRows.length,
    failed: failedRows.length,
    skipped: 0,
    quarantined: 0,
    acceptanceComplete: passedRows.length === PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR,
    failureStageCounts: Object.freeze(Object.fromEntries(
      PHYSIO_ASSESSMENT_ACCEPTANCE_STAGES.map((stage) => [
        stage,
        rows.filter((row) => !row.stages[stage]).length,
      ]),
    )),
    stageNames: PHYSIO_ASSESSMENT_ACCEPTANCE_STAGES,
    scoringModeCounts,
    actualScoringFrontierByHost,
    completeInstrumentFrontierByHost,
    noAbridgementAuditSha256: runnerContentAudit.auditSha256,
    persistenceMode: PHYSIO_ASSESSMENT_PERSISTENCE_MODE,
    persistenceDatabaseClosed: persistence.closed,
    recommendationCandidateCount: recommendationCandidates.length,
    routeRegistrySha256: sha256(JSON.stringify(GENERATED_ASSESSMENT_ROUTES)),
    rows: Object.freeze(rows),
  });
}
