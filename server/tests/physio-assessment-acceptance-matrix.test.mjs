import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPhysioAssessmentAcceptanceMatrix,
  createPhysioAcceptancePersistenceHarness,
  persistReloadClientAssessment,
  PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR,
  PHYSIO_ASSESSMENT_PERSISTENCE_MODE,
  PHYSIO_ASSESSMENT_SCORING_MODES,
  PHYSIO_ASSESSMENT_ACCEPTANCE_STAGES,
} from '../catalogue/physio-assessment-acceptance.mjs';
import { buildPhysioCatalogueManifest } from '../catalogue/physio-catalogue.mjs';
import { projectAssessmentResult } from '../../src/components/reports/assessmentResultProjection.js';
import {
  buildStructuredFixture,
  scoreBriefPainInventory,
  scoreStructuredAssessment,
} from '../../src/lib/clinical/assessmentScoring.js';
import { buildDass21Payload, DASS21_QUESTIONS } from '../../src/lib/clinical/dass21.js';
import { discoverAssessments, normalizeClinicalText } from '../../src/lib/clinical/assessmentDiscovery.js';

test('manifest-driven matrix exposes the exact actual-scorer frontier without skips or quarantine', () => {
  const matrix = buildPhysioAssessmentAcceptanceMatrix();
  assert.equal(matrix.denominator, PHYSIO_ASSESSMENT_ACCEPTANCE_DENOMINATOR);
  assert.equal(matrix.passed, 236);
  assert.equal(matrix.failed, 0);
  assert.equal(matrix.skipped, 0);
  assert.equal(matrix.quarantined, 0);
  assert.equal(matrix.acceptanceComplete, true);
  assert.deepEqual(matrix.failureStageCounts, {
    validation: 0,
    score: 0,
    persistReload: 0,
    soap: 0,
    report: 0,
    search: 0,
    recommendation: 0,
  });
  assert.equal(matrix.persistenceMode, PHYSIO_ASSESSMENT_PERSISTENCE_MODE);
  assert.equal(matrix.persistenceDatabaseClosed, true);
  assert.equal(matrix.recommendationCandidateCount, 236);
  assert.deepEqual(matrix.scoringModeCounts, {
    [PHYSIO_ASSESSMENT_SCORING_MODES.REGISTERED_REAL_SCORER]: 227,
    [PHYSIO_ASSESSMENT_SCORING_MODES.SHARED_REAL_SCORER]: 9,
    [PHYSIO_ASSESSMENT_SCORING_MODES.RUNNER_BOUNDARY_CONTRACT]: 0,
  });
  assert.deepEqual(matrix.actualScoringFrontierByHost, {
    extras: 0,
    fim: 0,
    questionnaire: 0,
    'standalone-400-meter-walk': 0,
    'standalone-6-meter-walk': 0,
    'standalone-6-minute-step': 0,
    'standalone-8-foot-up-go': 0,
    structured: 0,
    'test-runner': 0,
  });
  assert.deepEqual(matrix.completeInstrumentFrontierByHost, {
    extras: 0,
    fim: 0,
    questionnaire: 0,
    'standalone-400-meter-walk': 0,
    'standalone-6-meter-walk': 0,
    'standalone-6-minute-step': 0,
    'standalone-8-foot-up-go': 0,
    structured: 0,
    'test-runner': 0,
  });
  assert.match(matrix.noAbridgementAuditSha256, /^[a-f0-9]{64}$/);
  assert.equal(matrix.rows.length, 236);
  assert.equal(new Set(matrix.rows.map(({ canonicalId }) => canonicalId)).size, 236);
  assert.equal(matrix.routeRegistrySha256, '82ec2bc6f91ff8f20be0a3befde68f3ea7ff414f5ff435cbd45a77d326e7d418');
  assert.deepEqual(matrix.stageNames, PHYSIO_ASSESSMENT_ACCEPTANCE_STAGES);
  for (const row of matrix.rows) {
    assert.deepEqual(Object.keys(row.stages), PHYSIO_ASSESSMENT_ACCEPTANCE_STAGES);
    assert.match(row.payloadSha256, /^[a-f0-9]{64}$/);
    assert.match(row.reportSha256, /^[a-f0-9]{64}$/);
    assert.ok(Object.values(PHYSIO_ASSESSMENT_SCORING_MODES).includes(row.scoringMode));
    assert.equal(
      row.executesActualScorer,
      row.scoringMode !== PHYSIO_ASSESSMENT_SCORING_MODES.RUNNER_BOUNDARY_CONTRACT,
    );
    assert.equal(row.executesCompleteInstrumentPath, row.executesActualScorer && row.noAbridgementComplete);
    assert.equal(row.executesActualValidation, row.executesCompleteInstrumentPath);
    assert.equal(row.stages.validation, row.executesCompleteInstrumentPath);
    assert.equal(row.stages.score, row.executesCompleteInstrumentPath);
    assert.equal(row.persistenceMode, PHYSIO_ASSESSMENT_PERSISTENCE_MODE);
    assert.ok(row.productionSearchQueryCount >= 2);
    assert.equal(row.recommendationCandidateCount, 236);
  }
});

test('acceptance persistence uses the production ClientAssessment repository and rejects reload drift', () => {
  const harness = createPhysioAcceptancePersistenceHarness();
  const canonicalId = 'assessment:acceptance:zero-preservation';
  const scored = {
    status: 'completed',
    result_value: 0,
    assessment_date: '2026-08-22',
    additional_data: { soap_text: 'Zero is a valid completed result.' },
    notes: '',
  };
  try {
    const roundTrip = persistReloadClientAssessment(harness.repository, canonicalId, scored);
    assert.ok(roundTrip.persistenceKey);
    assert.equal(roundTrip.reloaded.result_value, 0);
    assert.deepEqual(roundTrip.reloaded.additional_data, scored.additional_data);

    const corruptingRepository = {
      create: (...args) => harness.repository.create(...args),
      getById: (id) => ({
        ...harness.repository.getById(id),
        result_value: 99,
      }),
    };
    assert.throws(
      () => persistReloadClientAssessment(corruptingRepository, canonicalId, scored),
      /persistence round-trip drifted/,
    );
  } finally {
    harness.close();
  }
  assert.equal(harness.closed, true);
});

test('full-catalogue recommendation identity lookup covers every deduplicated semantic row', () => {
  const candidates = buildPhysioCatalogueManifest().canonicalAssessments.map(({ content }) => ({
    ...content,
    id: content.canonical_id,
  }));

  for (const assessment of candidates) {
    const recommendations = discoverAssessments({
      conditions: [{ name: assessment.name }],
      assessments: candidates,
      limit: 5,
    });
    assert.ok(
      recommendations.some(({ canonical_id: canonicalId }) => canonicalId === assessment.canonical_id),
      assessment.name,
    );
  }

  const semanticName = normalizeClinicalText('30-Second Sit-to-Stand Test');
  const semanticIds = candidates
    .filter(({ name }) => normalizeClinicalText(name) === semanticName)
    .map(({ canonical_id: canonicalId }) => canonicalId)
    .sort();
  assert.equal(semanticIds.length, 1);
  const recommendationIds = discoverAssessments({
    conditions: [{ name: '30-Second Sit-to-Stand Test' }],
    assessments: candidates,
    limit: 5,
  }).map(({ canonical_id: canonicalId }) => canonicalId);
  for (const canonicalId of semanticIds) assert.ok(recommendationIds.includes(canonicalId), canonicalId);
});

test('BPI scores severity from four items and interference from seven items', () => {
  const payload = scoreBriefPainInventory({
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
  }, { assessmentDate: '2026-08-22' });
  assert.equal(payload.result_value, 5);
  assert.equal(payload.additional_data.pain_severity_score, 5);
  assert.equal(payload.additional_data.pain_interference_score, 5);
  assert.equal(payload.additional_data.pain_severity_interpretation, 'Moderate');
  assert.equal(payload.additional_data.pain_interference_interpretation, 'Moderate');
  assert.equal(payload.additional_data.severity_items.length, 4);
  assert.equal(payload.additional_data.interference_items.length, 7);
  assert.match(payload.additional_data.soap_text, /Pain Severity: 5\.00\/10/);
  assert.match(payload.additional_data.soap_text, /Pain Interference: 5\.00\/10/);

  assert.throws(
    () => scoreBriefPainInventory({ 0: 1, 1: 2 }),
    /BPI severity item 2 is required/,
  );
});

test('canonical DASS-21 content and payload retain all 21 items', () => {
  const manifest = buildPhysioCatalogueManifest();
  const canonical = manifest.canonicalAssessments.find(({ canonicalId }) => (
    canonicalId === 'assessment:ep-synthetic:dass-21'
  ));
  assert.equal(canonical.content.questions.length, 21);
  assert.deepEqual(
    canonical.content.questions.map(({ question_text }) => question_text),
    DASS21_QUESTIONS.map(({ text }) => text),
  );

  const payload = buildDass21Payload(Object.fromEntries(DASS21_QUESTIONS.map((_, index) => [index, 1])));
  assert.equal(payload.additional_data.items.length, 21);
  assert.equal(payload.additional_data.depression_score, 14);
  assert.equal(payload.additional_data.anxiety_score, 14);
  assert.equal(payload.additional_data.stress_score, 14);
  assert.equal(payload.additional_data.depression_interpretation, 'Moderate');
  assert.equal(payload.additional_data.anxiety_interpretation, 'Moderate');
  assert.equal(payload.additional_data.stress_interpretation, 'Normal');
});

test('ankle dorsiflexion structured route validates and creates score, SOAP and report payloads', () => {
  const manifest = buildPhysioCatalogueManifest();
  const keys = ['ankle-dorsiflexion-rom'];
  for (const scoringKey of keys) {
    const routeName = {
      'ankle-dorsiflexion-rom': 'Ankle Dorsiflexion ROM',
    }[scoringKey];
    const canonical = manifest.canonicalAssessments.find(({ name }) => name === routeName);
    const payload = scoreStructuredAssessment(scoringKey, buildStructuredFixture(scoringKey), {
      assessmentName: routeName,
      assessmentDate: '2026-08-22',
    });
    assert.equal(payload.status, 'completed');
    assert.ok(Number.isFinite(payload.result_value));
    assert.ok(payload.additional_data.soap_text.length > 0);
    const projection = projectAssessmentResult({ assessment: canonical.content, completedAssessment: payload });
    assert.equal(projection.result_value, payload.result_value);
    assert.equal(projection.soap_text, payload.additional_data.soap_text);
  }

});

test('report projection preserves a completed numeric zero', () => {
  const projection = projectAssessmentResult({
    assessment: {
      canonical_id: 'assessment:test:zero',
      name: 'Zero Result Contract',
      unit_of_measure: 'points',
    },
    completedAssessment: {
      status: 'completed',
      result_value: 0,
      assessment_date: '2026-08-22',
      additional_data: { measurement_type: 'zero-test', soap_text: '• Zero Result Contract\n  Result: 0' },
    },
  });
  assert.equal(projection.result_value, 0);
  assert.equal(projection.result_label, '0 points');
  assert.match(projection.report_text, /Zero Result Contract: 0 points/);
});
