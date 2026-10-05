import assert from 'node:assert/strict';
import test from 'node:test';

import { assessCompleteness, buildEvidenceCatalogue } from '../domain/evidence.mjs';
import { episodeContext } from '../fixtures/syntheticDataset.mjs';
import { KNEE, SHOULDER, catalogueFor, fixtures } from './support.mjs';

function statesOf(assessment) {
  return Object.fromEntries(assessment.requirements.map((entry) => [entry.key, entry.state]));
}

test('two materially different fixtures produce different completeness assessments', () => {
  const { dataset } = fixtures();
  const knee = assessCompleteness({ reportTypeId: 'PHYSIO_PROGRESS_REPORT', catalogue: catalogueFor(dataset, KNEE) });
  const shoulder = assessCompleteness({ reportTypeId: 'PHYSIO_PROGRESS_REPORT', catalogue: catalogueFor(dataset, SHOULDER) });

  assert.deepEqual(statesOf(knee), {
    referral_question: 'present',
    baseline_findings: 'present',
    baseline_measures: 'present',
    goals: 'present',
    progress_reassessment: 'present',
    interventions_delivered: 'present',
    exposure_adherence: 'present',
    clinical_rationale: 'present',
    recommendations: 'present',
    risks_limitations: 'present',
  });
  assert.deepEqual(statesOf(shoulder), {
    referral_question: 'present',
    baseline_findings: 'unknown',
    baseline_measures: 'present',
    goals: 'missing',
    progress_reassessment: 'missing',
    interventions_delivered: 'missing',
    exposure_adherence: 'missing',
    clinical_rationale: 'missing',
    recommendations: 'missing',
    risks_limitations: 'unknown',
  });
  assert.deepEqual(knee.summary, { present: 10, missing: 0, unknown: 0, not_applicable: 0 });
  assert.deepEqual(shoulder.summary, { present: 2, missing: 6, unknown: 2, not_applicable: 0 });
  assert.deepEqual(shoulder.blocking_gaps, ['goals', 'progress_reassessment', 'interventions_delivered', 'exposure_adherence', 'clinical_rationale', 'recommendations']);
  assert.notDeepEqual(knee.requirements, shoulder.requirements);
});

test('every requirement carries a reason and the evidence it relied on', () => {
  const { dataset } = fixtures();
  const knee = assessCompleteness({ reportTypeId: 'PHYSIO_PROGRESS_REPORT', catalogue: catalogueFor(dataset, KNEE) });
  for (const entry of knee.requirements) {
    assert.ok(entry.reason.length > 10, `${entry.key} has a reason`);
    assert.ok(entry.evidence.length > 0, `${entry.key} cites evidence`);
  }
  const progress = knee.requirements.find((entry) => entry.key === 'progress_reassessment');
  assert.match(progress.reason, /2 instruments reassessed; 1 baseline-only/);
  const shoulder = assessCompleteness({ reportTypeId: 'PHYSIO_PROGRESS_REPORT', catalogue: catalogueFor(dataset, SHOULDER) });
  const findings = shoulder.requirements.find((entry) => entry.key === 'baseline_findings');
  assert.match(findings.reason, /objective examination still in draft/);
  const risks = shoulder.requirements.find((entry) => entry.key === 'risks_limitations');
  assert.match(risks.reason, /not marked complete/);
});

test('the referrer update marks requirements it does not use as not applicable', () => {
  const { dataset } = fixtures();
  const update = assessCompleteness({ reportTypeId: 'PHYSIO_REFERRER_UPDATE', catalogue: catalogueFor(dataset, SHOULDER) });
  const states = statesOf(update);
  assert.equal(states.goals, 'not_applicable');
  assert.equal(states.exposure_adherence, 'not_applicable');
  assert.equal(states.progress_reassessment, 'missing');
  assert.equal(update.summary.not_applicable, 2);
});

test('the evidence catalogue is deterministic and hashes every item', () => {
  const { dataset } = fixtures();
  const first = catalogueFor(dataset, KNEE);
  const second = catalogueFor(dataset, KNEE);
  assert.deepEqual(first.items, second.items);
  assert.equal(first.items.length, 24);
  for (const entry of first.items) {
    assert.match(entry.content_sha256, /^[0-9a-f]{64}$/);
    assert.ok(entry.source_id.length > 0);
  }
  const aiDraft = first.byId.get('saved_report:report-knee-ai-referrer-draft');
  assert.equal(aiDraft.ai_assisted, true);
  assert.equal(aiDraft.ai_attribution.task_type, 'physio.referrer_update.v1');
  assert.deepEqual(aiDraft.flags, ['ai_assisted_draft']);
});

test('the pinned patient summary never carries identifying contact fields', () => {
  const { dataset } = fixtures();
  const context = episodeContext(dataset, KNEE);
  const client = {
    ...context.client,
    email: 'synthetic-patient@example.test',
    phone: '0400000000',
    date_of_birth: '1988-06-15',
    address: '1 Synthetic Street',
    medicare_number: '0000000000',
  };
  const catalogue = buildEvidenceCatalogue({ ...context, client });
  const summary = catalogue.byId.get(`client_summary:${client.id}`).content;
  assert.deepEqual(Object.keys(summary).sort(), ['display_name', 'funding_source', 'referral_reason', 'referral_source', 'synthetic']);
  const serialised = JSON.stringify(catalogue.items);
  assert.equal(serialised.includes('0400000000'), false);
  assert.equal(serialised.includes('1988-06-15'), false);
  assert.equal(serialised.includes('synthetic-patient@example.test'), false);
});

test('records outside the selected episode are refused before anything is pinned', () => {
  const { dataset } = fixtures();
  const context = episodeContext(dataset, KNEE);
  const foreign = { ...context.assessments[0], id: 'ca-foreign', physio_care_episode_id: SHOULDER };
  assert.throws(
    () => buildEvidenceCatalogue({ ...context, assessments: [...context.assessments, foreign] }),
    (error) => error.status === 409 && error.code === 'care_episode_context_mismatch',
  );
  const mismatchedClient = { ...context.client, id: 'client-other' };
  assert.throws(
    () => buildEvidenceCatalogue({ ...context, client: mismatchedClient }),
    (error) => error.status === 409 && error.code === 'care_episode_patient_mismatch',
  );
});
