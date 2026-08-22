import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { PHYSIO_ADDITIVE_SOURCES } from '../catalogue/physio-additive-sources.mjs';
import { projectAssessmentResult } from '../../src/components/reports/assessmentResultProjection.js';
import {
  BESS_CONDITIONS,
  BESS_RUNNER_SPEC,
  BOD_POD_RUNNER_SPEC,
  EDSS_RUNNER_SPEC,
  EFS_ITEMS,
  EFS_RUNNER_SPEC,
  IPAQ_SHORT_FORM_ITEMS,
  IPAQ_SHORT_FORM_RUNNER_SPEC,
  MAINTAINED_PHYSIO_ADDITION_SCORERS,
  buildBessFixture,
  buildBodPodFixture,
  buildEdssFixture,
  buildEfsFixture,
  buildIpaqShortFormFixture,
  computeIpaqShortFormScore,
  validateAndScoreBess,
  validateAndScoreBodPod,
  validateAndScoreEdss,
  validateAndScoreEfs,
  validateAndScoreIpaqShortForm,
} from '../../src/lib/clinical/scorers/maintainedPhysioAdditions.js';
import {
  resolveRegisteredAssessmentScorer,
  validateAndScoreRegisteredAssessment,
} from '../../src/lib/clinical/assessmentScorerRegistry.js';

const CONTEXT = Object.freeze({ assessmentDate: '2026-08-22' });

function context(name) {
  return { ...CONTEXT, assessmentName: name };
}

function assertCompletedPath(payload, assessment) {
  assert.equal(payload.status, 'completed');
  assert.ok(Number.isFinite(payload.result_value));
  assert.equal(payload.assessment_date, CONTEXT.assessmentDate);
  assert.ok(payload.additional_data.raw_input);
  assert.ok(payload.additional_data.soap_text);
  assert.ok(payload.additional_data.report_text);
  const reloaded = JSON.parse(JSON.stringify(payload));
  assert.deepEqual(reloaded, payload);
  const report = projectAssessmentResult({ assessment, completedAssessment: reloaded });
  assert.equal(report.result_value, payload.result_value);
  assert.equal(report.soap_text, payload.additional_data.soap_text);
  assert.match(report.report_text, new RegExp(assessment.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('five maintained Physio additions expose stable complete specs and registry bindings', () => {
  assert.deepEqual(
    MAINTAINED_PHYSIO_ADDITION_SCORERS.map(({ runnerSpec }) => [runnerSpec.runnerKey, runnerSpec.scoringKey]),
    [
      ['bess', 'bess'],
      ['bod_pod', 'bod-pod'],
      ['edss', 'edss'],
      ['ipaq', 'ipaq-short-form'],
      ['efs', 'edmonton-frail-scale'],
    ],
  );
  for (const { runnerSpec } of MAINTAINED_PHYSIO_ADDITION_SCORERS) {
    assert.equal(resolveRegisteredAssessmentScorer(runnerSpec.scoringKey).runnerSpec, runnerSpec);
    assert.equal(runnerSpec.schemaVersion, 1);
    assert.ok(runnerSpec.result.primaryField);
    assert.ok(runnerSpec.scoring.version);
    assert.deepEqual(JSON.parse(JSON.stringify(runnerSpec)), runnerSpec);
  }

  const additiveByScoringKey = new Map(PHYSIO_ADDITIVE_SOURCES.map((source) => [source.scoringKey, source]));
  for (const { runnerSpec } of MAINTAINED_PHYSIO_ADDITION_SCORERS) {
    assert.equal(additiveByScoringKey.get(runnerSpec.scoringKey).content.runner_spec, runnerSpec);
  }
});

test('BESS requires and sums all six condition scores without a generic severity classification', () => {
  assert.equal(BESS_CONDITIONS.length, 6);
  assert.equal(BESS_RUNNER_SPEC.fields.filter(({ required }) => required).length, 6);
  const zeroInput = Object.fromEntries(BESS_CONDITIONS.map(({ key }) => [key, 0]));
  const zero = validateAndScoreBess(zeroInput, context('Balance Error Scoring System (BESS)'));
  assert.equal(zero.result_value, 0);
  assert.equal(zero.additional_data.total_errors, 0);
  assert.equal('interpretation' in zero.additional_data, false);
  assertCompletedPath(zero, {
    canonical_id: 'assessment:physio-component:balance-error-scoring-system',
    name: 'Balance Error Scoring System (BESS)',
    unit_of_measure: 'errors',
  });

  const fixture = buildBessFixture();
  assert.equal(validateAndScoreBess(fixture, context('BESS')).result_value, 10);
  const missing = { ...fixture };
  delete missing.foam_tandem_errors;
  assert.throws(() => validateAndScoreBess(missing, context('BESS')), /required/);
  assert.throws(() => validateAndScoreBess({ ...fixture, firm_double_leg_errors: 1.5 }, context('BESS')), /whole number/);
  assert.throws(() => validateAndScoreBess({ ...fixture, firm_double_leg_errors: 11 }, context('BESS')), /between 0 and 10/);
});

test('BOD POD supports finite direct and calculated body-fat results and rejects partial mass input', () => {
  const directZero = validateAndScoreBodPod({ body_fat_pct: 0 }, context('BOD POD'));
  assert.equal(directZero.result_value, 0);
  assert.equal(directZero.additional_data.result_source, 'device-reported-body-fat-percentage');
  assert.equal('classification' in directZero.additional_data, false);

  const calculated = validateAndScoreBodPod(buildBodPodFixture(), context('Air Displacement Plethysmography (BOD POD)'));
  assert.equal(calculated.result_value, 20);
  assert.equal(calculated.additional_data.fat_free_mass_kg, 64);
  assert.equal(calculated.additional_data.result_source, 'calculated-from-fat-mass-and-body-mass');
  assertCompletedPath(calculated, {
    canonical_id: 'assessment:physio-component:air-displacement-plethysmography-bod-pod',
    name: 'Air Displacement Plethysmography (BOD POD)',
    unit_of_measure: '%',
  });

  assert.throws(() => validateAndScoreBodPod({ fat_mass_kg: 15 }, context('BOD POD')), /both body mass and fat mass/);
  assert.throws(() => validateAndScoreBodPod({ body_mass_kg: 60, fat_mass_kg: 61 }, context('BOD POD')), /cannot exceed body mass/);
  assert.throws(() => validateAndScoreBodPod({ body_fat_pct: Number.NaN }, context('BOD POD')), /finite number/);
});

test('EDSS preserves a valid zero and only accepts defined half-step scores and functional-system grades', () => {
  assert.deepEqual(EDSS_RUNNER_SPEC.fields[0].options.slice(0, 4).map(({ value }) => value), [0, 1, 1.5, 2]);
  assert.equal(EDSS_RUNNER_SPEC.fields[0].options.some(({ value }) => value === 0.5), false);
  assert.deepEqual(
    EDSS_RUNNER_SPEC.fields.find(({ key }) => key === 'functional_systems').fields.map(({ key }) => key),
    ['pyramidal', 'cerebellar', 'brainstem', 'sensory', 'bowel_bladder', 'visual', 'cerebral', 'ambulation'],
  );
  const zero = validateAndScoreEdss(buildEdssFixture(), context('Expanded Disability Status Scale (EDSS)'));
  assert.equal(zero.result_value, 0);
  assert.equal(zero.additional_data.edss_score, 0);
  assert.match(zero.additional_data.descriptor, /Normal neurological/);
  assertCompletedPath(zero, {
    canonical_id: 'assessment:physio-component:expanded-disability-status-scale',
    name: 'Expanded Disability Status Scale (EDSS)',
    unit_of_measure: 'points',
  });
  assert.throws(() => validateAndScoreEdss({ edss_score: 0.5 }, context('EDSS')), /not a permitted choice/);
  assert.throws(() => validateAndScoreEdss({ edss_score: 2, functional_systems: { pyramidal: 7 } }, context('EDSS')), /between 0 and 6/);
});

test('IPAQ-SF retains seven ordered items and implements the 2005 cleaning and category rules', () => {
  assert.equal(IPAQ_SHORT_FORM_ITEMS.length, 7);
  assert.equal(IPAQ_SHORT_FORM_RUNNER_SPEC.items, IPAQ_SHORT_FORM_ITEMS);
  assert.match(IPAQ_SHORT_FORM_RUNNER_SPEC.scoring.method, /2005-cleaned/);

  const high = validateAndScoreIpaqShortForm(buildIpaqShortFormFixture(), context('International Physical Activity Questionnaire – Short Form (IPAQ-SF)'));
  assert.equal(high.result_value, 1878);
  assert.equal(high.additional_data.activity_category, 'High Physical Activity');
  assertCompletedPath(high, {
    canonical_id: 'assessment:physio-component:international-physical-activity-questionnaire-short-form',
    name: 'International Physical Activity Questionnaire – Short Form (IPAQ-SF)',
    unit_of_measure: 'MET-minutes/week',
  });

  const moderate = computeIpaqShortFormScore({
    vigorous_days: 0,
    vigorous_minutes: 0,
    moderate_days: 2,
    moderate_minutes: 30,
    walking_days: 3,
    walking_minutes: 30,
    sitting_minutes: 480,
  });
  assert.equal(moderate.activity_category, 'Moderate Physical Activity');
  assert.equal(moderate.total_met_mins, 537);

  const cleaned = computeIpaqShortFormScore({
    vigorous_days: 1,
    vigorous_minutes: 200,
    moderate_days: 2,
    moderate_minutes: 9,
    walking_days: 0,
    walking_minutes: 30,
    sitting_minutes: 0,
  });
  assert.equal(cleaned.processed_activity.vigorous.minutes, 180);
  assert.deepEqual(cleaned.processed_activity.moderate, { days: 0, minutes: 0 });
  assert.deepEqual(cleaned.processed_activity.walking, { days: 0, minutes: 0 });
  assert.equal(cleaned.total_met_mins, 1440);

  assert.throws(() => computeIpaqShortFormScore({ ...buildIpaqShortFormFixture(), sitting_minutes: '' }), /required/);
  assert.throws(() => computeIpaqShortFormScore({ ...buildIpaqShortFormFixture(), vigorous_days: 8 }), /between 0 and 7/);
  assert.throws(() => computeIpaqShortFormScore({
    ...buildIpaqShortFormFixture(),
    vigorous_minutes: 400,
    moderate_minutes: 400,
    walking_minutes: 200,
  }), /960-minute daily outlier/);
});

test('EFS renders and scores every one of the 11 canonical items to the 17-point range', () => {
  assert.equal(EFS_ITEMS.length, 11);
  assert.equal(EFS_RUNNER_SPEC.items, EFS_ITEMS);
  assert.ok(EFS_ITEMS.every((item) => (
    item.responseBinding.field === 'responses' && item.responseBinding.key === item.key
  )));
  assert.deepEqual(EFS_ITEMS.map(({ key }) => key), [
    'cognition_clock',
    'hospital_admissions',
    'self_rated_health',
    'functional_independence',
    'social_support',
    'polypharmacy',
    'medication_forgetting',
    'nutrition_weight_loss',
    'mood',
    'continence',
    'timed_up_and_go',
  ]);
  assert.equal(EFS_ITEMS.find(({ key }) => key === 'hospital_admissions').options[2].label, 'More than 2');

  const maximumResponses = Object.fromEntries(EFS_ITEMS.map((item) => [item.key, item.options.at(-1).value]));
  const maximum = validateAndScoreEfs({ responses: maximumResponses }, context('Edmonton Frail Scale (EFS)'));
  assert.equal(maximum.result_value, 17);
  assert.equal(maximum.additional_data.frailty_category, 'Severely Frail');
  assertCompletedPath(maximum, {
    canonical_id: 'assessment:physio-component:edmonton-frail-scale',
    name: 'Edmonton Frail Scale (EFS)',
    unit_of_measure: 'points',
  });

  const fixture = buildEfsFixture();
  const missing = { ...fixture, responses: { ...fixture.responses } };
  delete missing.responses.medication_forgetting;
  assert.throws(() => validateAndScoreEfs(missing, context('EFS')), /medication_forgetting is required/);
  assert.throws(() => validateAndScoreEfs({ ...fixture, responses: { ...fixture.responses, mood: 2 } }, context('EFS')), /not a permitted choice/);
});

test('rendered production runners invoke the shared scorer and do not retain the repaired shortcuts', () => {
  const bodPodRunnerFilename = [
    'AirDisplacementPlethysmography',
    'BodPodRunner.jsx',
  ].join('');
  const components = [
    ['BESSRunner.jsx', 'validateAndScoreBess'],
    [bodPodRunnerFilename, 'validateAndScoreBodPod'],
    ['EDSSRunner.jsx', 'validateAndScoreEdss'],
    ['IPAQRunner.jsx', 'validateAndScoreIpaqShortForm'],
    ['EdmontonFrailScaleEFSRunner.jsx', 'validateAndScoreEfs'],
  ];
  for (const [filename, scorer] of components) {
    const source = fs.readFileSync(new URL(`../../src/components/assessments/${filename}`, import.meta.url), 'utf8');
    assert.match(source, /@\/lib\/clinical\/scorers\/maintainedPhysioAdditions/);
    assert.match(source, new RegExp(`${scorer}\\(`));
  }
  const bess = fs.readFileSync(new URL('../../src/components/assessments/BESSRunner.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(bess, /Please score at least one condition/);
  assert.doesNotMatch(bess, /Severe balance impairment/);
  const bodPod = fs.readFileSync(
    new URL(`../../src/components/assessments/${bodPodRunnerFilename}`, import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(bodPod, /FAT_NORMS|classifyBodyFat/);
  const efs = fs.readFileSync(new URL('../../src/components/assessments/EdmontonFrailScaleEFSRunner.jsx', import.meta.url), 'utf8');
  assert.match(efs, /EFS_ITEMS\.map/);
  assert.match(efs, /11-item, 9-domain frailty assessment/);
  assert.doesNotMatch(efs, /answered === 9|answered}\/9/);
  const edss = fs.readFileSync(new URL('../../src/components/assessments/EDSSRunner.jsx', import.meta.url), 'utf8');
  assert.match(edss, /edssScore !== ""/);
  assert.doesNotMatch(edss, /if \(!edssScore\)/);
});

test('central registry invokes the exact five maintained addition scorers', () => {
  for (const { runnerSpec, buildFixture, validateAndScore } of MAINTAINED_PHYSIO_ADDITION_SCORERS) {
    const fixture = buildFixture();
    const scorerContext = context(runnerSpec.scoringKey);
    assert.deepEqual(
      validateAndScoreRegisteredAssessment(runnerSpec.scoringKey, fixture, scorerContext),
      validateAndScore(fixture, scorerContext),
    );
  }
});
