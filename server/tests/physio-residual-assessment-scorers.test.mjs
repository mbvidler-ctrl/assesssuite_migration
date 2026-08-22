import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ASTRAND_STEP_RUNNER_SPEC,
  buildFixture,
  CRDQ_RUNNER_SPEC,
  NEUROLOGICAL_SCREEN_RUNNER_SPEC,
  OREBRO_RUNNER_SPEC,
  RUNNER_SPECS,
  START_BACK_RUNNER_SPEC,
  UEFI_RUNNER_SPEC,
  validateAndScore,
} from '../../src/lib/clinical/scorers/residualAssessments.js';
import { projectAssessmentResult } from '../../src/components/reports/assessmentResultProjection.js';

const CONTEXT = Object.freeze({ assessmentName: 'Synthetic residual assessment', assessmentDate: '2026-08-22' });

test('six residual specs preserve every ordered item or level-and-side field', () => {
  assert.equal(RUNNER_SPECS.length, 6);
  assert.equal(CRDQ_RUNNER_SPEC.items.length, 20);
  assert.equal(UEFI_RUNNER_SPEC.items.length, 20);
  assert.equal(START_BACK_RUNNER_SPEC.items.length, 9);
  assert.equal(OREBRO_RUNNER_SPEC.items.length, 10);
  assert.equal(NEUROLOGICAL_SCREEN_RUNNER_SPEC.fields.length, 56);
  assert.equal(ASTRAND_STEP_RUNNER_SPEC.fields.length, 8);
  for (const spec of [CRDQ_RUNNER_SPEC, UEFI_RUNNER_SPEC, START_BACK_RUNNER_SPEC, OREBRO_RUNNER_SPEC]) {
    assert.ok(spec.items.every((item) => (
      item.responseBinding.field === 'responses' && item.responseBinding.key === item.key
    )));
  }
  for (const spec of RUNNER_SPECS) {
    const content = spec.kind === 'questionnaire' ? spec.items : spec.fields;
    assert.ok(content.length > 0, spec.runnerKey);
    assert.equal(content.every((entry) => entry.key && (entry.prompt || entry.label)), true, spec.runnerKey);
  }
});

test('all six deterministic fixtures invoke their actual scorer and round-trip through report projection', () => {
  for (const spec of RUNNER_SPECS) {
    const payload = validateAndScore(spec.scoringKey, buildFixture(spec.scoringKey), CONTEXT);
    assert.equal(payload.status, 'completed', spec.runnerKey);
    assert.ok(Number.isFinite(payload.result_value), spec.runnerKey);
    assert.equal(payload.additional_data.scoring_key, spec.scoringKey, spec.runnerKey);
    assert.ok(payload.additional_data.soap_text.length > 0, spec.runnerKey);
    const reloaded = JSON.parse(JSON.stringify(payload));
    assert.deepEqual(reloaded, payload, spec.runnerKey);
    const projected = projectAssessmentResult({
      assessment: { name: CONTEXT.assessmentName, unit_of_measure: spec.result.unit },
      completedAssessment: reloaded,
    });
    assert.equal(projected.result_value, payload.result_value, spec.runnerKey);
    assert.equal(projected.soap_text, payload.additional_data.soap_text, spec.runnerKey);
  }
});

test('STarT Back uses the actual total and psychosocial risk algorithm', () => {
  const low = validateAndScore('start-back', { responses: Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`q${index + 1}`, index < 3 ? 1 : 0])) }, CONTEXT);
  const medium = validateAndScore('start-back', { responses: { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1, q7: 1, q8: 0, q9: 0 } }, CONTEXT);
  const high = validateAndScore('start-back', { responses: { q1: 0, q2: 0, q3: 0, q4: 0, q5: 1, q6: 1, q7: 1, q8: 1, q9: 0 } }, CONTEXT);
  assert.equal(low.additional_data.risk_band, 'Low risk');
  assert.equal(medium.additional_data.risk_band, 'Medium risk');
  assert.equal(high.additional_data.risk_band, 'High risk');
  assert.equal(high.additional_data.psychosocial_score, 4);
});

test('Örebro short form reverses items 3, 4 and 8 and retains raw plus scored values', () => {
  const payload = validateAndScore('orebro', { responses: { q1: 10, q2: 10, q3: 0, q4: 0, q5: 10, q6: 10, q7: 10, q8: 0, q9: 10, q10: 10 } }, CONTEXT);
  assert.equal(payload.result_value, 100);
  assert.equal(payload.additional_data.scored_items.q3, 10);
  assert.equal(payload.additional_data.scored_items.q4, 10);
  assert.equal(payload.additional_data.scored_items.q8, 10);
  assert.match(payload.additional_data.risk_band, /Increased risk/);
});

test('neurological screen retains every selected-region level and side and detects abnormal grades', () => {
  const payload = validateAndScore('neurological-screen', buildFixture('neurological-screen'), CONTEXT);
  assert.equal(payload.result_value, 1);
  assert.equal(payload.additional_data.abnormal_findings.length, 1);
  assert.match(payload.additional_data.abnormal_findings[0], /L5 myotome left/);
  assert.ok(Object.keys(payload.additional_data.values).length > 50);
});

test('Astrand step persists observed heart rate and never fabricates a shortcut VO2 estimate', () => {
  const payload = validateAndScore('astrand_rhyming_step', buildFixture('astrand_rhyming_step'), CONTEXT);
  assert.equal(payload.result_value, 138);
  assert.equal(payload.additional_data.completed_full_protocol, true);
  assert.equal(payload.additional_data.protocol.step_height_cm, 33);
  assert.equal('vo2max' in payload.additional_data, false);
});

test('all residual scorers fail closed for missing or invalid production inputs', () => {
  for (const spec of RUNNER_SPECS) {
    assert.throws(() => validateAndScore(spec.scoringKey, {}, CONTEXT), /required|responses|input|permitted/i, spec.runnerKey);
  }
  const uefi = buildFixture('uefs');
  uefi.responses.q1 = Number.NaN;
  assert.throws(() => validateAndScore('uefs', uefi, CONTEXT), /finite number/i);
  const orebro = buildFixture('orebro');
  orebro.responses.q2 = 11;
  assert.throws(() => validateAndScore('orebro', orebro, CONTEXT), /between 0 and 10/i);
});
