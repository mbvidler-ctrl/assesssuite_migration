import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  BIA_RUNNER_SPEC,
  RUNNER_SPECS,
  TEN_RM_RUNNER_SPEC,
  TSK_RUNNER_SPEC,
  buildFixture,
  validateAndScore,
  validateAndScoreBia,
  validateAndScoreTenRm,
  validateAndScoreTsk,
} from '../../src/lib/clinical/scorers/classDRepairs.js';
import { projectAssessmentResult } from '../../src/components/reports/assessmentResultProjection.js';

const FIXED_CONTEXT = Object.freeze({ assessmentDate: '2026-08-22' });

function tskResponses({ normal = 1, reversed = 4 } = {}) {
  return Object.fromEntries(TSK_RUNNER_SPEC.items.map((item, index) => [
    item.key,
    [4, 8, 12, 16].includes(index + 1) ? reversed : normal,
  ]));
}

function assertPersistenceAndReportInvariant(payload, assessment) {
  assert.equal(payload.status, 'completed');
  assert.ok(Number.isFinite(payload.result_value));
  assert.equal(payload.assessment_date, FIXED_CONTEXT.assessmentDate);
  assert.ok(payload.additional_data.measurement_type);
  assert.ok(payload.additional_data.scoring_key);
  assert.ok(payload.additional_data.scoring_version);
  assert.ok(payload.additional_data.raw_input);
  assert.ok(payload.additional_data.soap_text);
  assert.ok(payload.additional_data.report_text);

  const reloaded = JSON.parse(JSON.stringify(payload));
  assert.deepEqual(reloaded, payload);
  const projection = projectAssessmentResult({ assessment, completedAssessment: reloaded });
  assert.equal(projection.result_value, payload.result_value);
  assert.equal(projection.soap_text, payload.additional_data.soap_text);
  assert.match(projection.report_text, new RegExp(assessment.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test('repaired class-D runner specs are frozen, serializable and expose stable keys', () => {
  assert.deepEqual(
    RUNNER_SPECS.map(({ runnerKey, scoringKey }) => ({ runnerKey, scoringKey })),
    [
      { runnerKey: 'tsk', scoringKey: 'tsk-17' },
      { runnerKey: '10rm', scoringKey: '10rm' },
      { runnerKey: 'bia', scoringKey: 'bia' },
    ],
  );
  for (const spec of RUNNER_SPECS) {
    assert.ok(Object.isFrozen(spec));
    assert.equal(spec.schemaVersion, 1);
    assert.ok(['questionnaire', 'measurement'].includes(spec.kind));
    assert.ok(spec.result.primaryField);
    assert.ok(spec.result.unit);
    assert.ok(JSON.stringify(spec).length > 100);
    assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec);
  }
});

test('TSK-17 retains all 17 ordered source items, response options and reverse-score positions', () => {
  assert.equal(TSK_RUNNER_SPEC.items.length, 17);
  assert.deepEqual(TSK_RUNNER_SPEC.scoring.reverseScoredItems, [4, 8, 12, 16]);
  assert.deepEqual(
    TSK_RUNNER_SPEC.items.map(({ key }) => key),
    Array.from({ length: 17 }, (_, index) => `q${index + 1}`),
  );
  for (const [index, item] of TSK_RUNNER_SPEC.items.entries()) {
    assert.ok(item.prompt.length > 10);
    assert.equal(item.required, true);
    assert.deepEqual(item.responseBinding, { field: 'responses', index });
    assert.equal(item.runtimeResponseKey, item.key);
    assert.ok(Object.isFrozen(item.responseBinding));
    assert.deepEqual(item.options.map(({ value }) => value), [1, 2, 3, 4]);
    assert.deepEqual(
      item.options.map(({ label }) => label),
      ['Strongly disagree', 'Disagree', 'Agree', 'Strongly agree'],
    );
  }
  assert.match(TSK_RUNNER_SPEC.provenance.sourceUrl, /^https:\/\/www\.sira\.nsw\.gov\.au\//);
  assert.match(TSK_RUNNER_SPEC.provenance.sourceCitation, /Vlaeyen/);
});

test('TSK-17 validation executes the real reverse-scoring path at both boundaries', () => {
  const minimum = validateAndScoreTsk({ responses: tskResponses() }, FIXED_CONTEXT);
  assert.equal(minimum.result_value, 17);
  assert.deepEqual(minimum.additional_data.reverse_scored_items, [4, 8, 12, 16]);
  assert.equal(minimum.additional_data.scored_items[3].response, 4);
  assert.equal(minimum.additional_data.scored_items[3].scored_value, 1);
  assert.match(minimum.additional_data.interpretation, /Not above/);

  const maximum = validateAndScoreTsk({
    responses: tskResponses({ normal: 4, reversed: 1 }),
  }, FIXED_CONTEXT);
  assert.equal(maximum.result_value, 68);
  assert.equal(maximum.additional_data.scored_items[3].scored_value, 4);
  assert.equal(maximum.additional_data.interpretation, 'High kinesiophobia');

  assertPersistenceAndReportInvariant(maximum, {
    canonical_id: 'assessment:test:tsk-17',
    name: 'Tampa Scale for Kinesiophobia (TSK)',
    unit_of_measure: 'points',
  });
});

test('TSK-17 rejects missing, zero, NaN, fractional and out-of-range answers', () => {
  const complete = tskResponses();
  const withoutLast = { ...complete };
  delete withoutLast.q17;
  assert.throws(() => validateAndScoreTsk({ responses: withoutLast }, FIXED_CONTEXT), /item 17 is required/);
  assert.throws(() => validateAndScoreTsk({ responses: { ...complete, q1: 0 } }, FIXED_CONTEXT), /from 1 to 4/);
  assert.throws(() => validateAndScoreTsk({ responses: { ...complete, q1: Number.NaN } }, FIXED_CONTEXT), /from 1 to 4/);
  assert.throws(() => validateAndScoreTsk({ responses: { ...complete, q1: 1.5 } }, FIXED_CONTEXT), /from 1 to 4/);
  assert.throws(() => validateAndScoreTsk({ responses: { ...complete, q1: 5 } }, FIXED_CONTEXT), /from 1 to 4/);
  assert.throws(
    () => validateAndScoreTsk({ responses: complete, notes: 'x'.repeat(4001) }, FIXED_CONTEXT),
    /4000 characters or fewer/,
  );
});

test('TSK-17 accepts array-form UI-compatible values and preserves bounded notes', () => {
  const payload = validateAndScoreTsk({
    responses: Array.from({ length: 17 }, () => '2'),
    notes: 'Observed without interruption.',
  }, FIXED_CONTEXT);
  assert.ok(Number.isFinite(payload.result_value));
  assert.equal(payload.notes, 'Observed without interruption.');
  assert.equal(payload.additional_data.raw_input.notes, payload.notes);
  assert.equal(payload.additional_data.responses.q1, 2);
});

test('dedicated 10RM scorer records a finite direct 10RM result without 1RM substitution', () => {
  const minimum = validateAndScoreTenRm({
    exercise: 'Knee extension',
    load: 0.1,
    unit: 'kg',
    equipment: 'Machine',
    test_standard: 'Ten repetitions completed.',
    notes: 'Boundary fixture',
  }, FIXED_CONTEXT);
  assert.equal(minimum.result_value, 0.1);
  assert.equal(minimum.additional_data.ten_rm_load, 0.1);
  assert.equal(minimum.additional_data.repetitions, 10);
  assert.equal(minimum.additional_data.measurement_type, '10rm');
  assert.equal('one_rm_load' in minimum.additional_data, false);
  assert.doesNotMatch(JSON.stringify(minimum), /1rm_testing|one_rm_load/);

  const maximum = validateAndScoreTenRm({ exercise: 'Leg press', load: 5000, unit: 'lb' }, FIXED_CONTEXT);
  assert.equal(maximum.result_value, 5000);
  assertPersistenceAndReportInvariant(minimum, {
    canonical_id: 'assessment:test:10rm',
    name: 'Ten Repetition Maximum (10RM)',
    unit_of_measure: 'kg',
  });
});

test('10RM rejects zero, missing, NaN, invalid units and out-of-range loads', () => {
  assert.throws(() => validateAndScoreTenRm({ exercise: '', load: 10, unit: 'kg' }, FIXED_CONTEXT), /Exercise tested is required/);
  assert.throws(() => validateAndScoreTenRm({ exercise: 'Leg press', load: '', unit: 'kg' }, FIXED_CONTEXT), /10RM load is required/);
  assert.throws(() => validateAndScoreTenRm({ exercise: 'Leg press', load: 0, unit: 'kg' }, FIXED_CONTEXT), /0\.1 to 5000/);
  assert.throws(() => validateAndScoreTenRm({ exercise: 'Leg press', load: Number.NaN, unit: 'kg' }, FIXED_CONTEXT), /0\.1 to 5000/);
  assert.throws(() => validateAndScoreTenRm({ exercise: 'Leg press', load: 5000.1, unit: 'kg' }, FIXED_CONTEXT), /0\.1 to 5000/);
  assert.throws(() => validateAndScoreTenRm({ exercise: 'Leg press', load: 80, unit: 'stone' }, FIXED_CONTEXT), /kg or lb/);
});

test('10RM accepts the string-shaped numeric values submitted by its HTML inputs', () => {
  const payload = validateAndScoreTenRm({ exercise: 'Leg press', load: '80.5', unit: 'kg' }, FIXED_CONTEXT);
  assert.equal(payload.result_value, 80.5);
  assert.equal(payload.additional_data.raw_input.load, 80.5);
});

test('BIA requires a finite device-reported body-fat primary result and preserves numeric zero', () => {
  const zero = validateAndScoreBia({
    height: 170,
    weight: 70,
    age: 45,
    gender: 'female',
    body_fat_pct: 0,
    resistance: 0,
    reactance: 0,
    basal_metabolic_rate: 0,
  }, FIXED_CONTEXT);
  assert.equal(zero.result_value, 0);
  assert.equal(zero.additional_data.body_fat_pct, 0);
  assert.equal(zero.additional_data.resistance, 0);
  assert.equal(zero.additional_data.reactance, 0);
  assert.equal(zero.additional_data.basal_metabolic_rate, 0);
  assert.doesNotMatch(JSON.stringify(zero), /NaN|:null/);

  const withoutOptionals = validateAndScoreBia({
    height: 170,
    weight: 70,
    age: 45,
    gender: 'female',
    body_fat_pct: 20,
  }, FIXED_CONTEXT);
  assert.equal('resistance' in withoutOptionals.additional_data, false);
  assert.equal('resistance' in withoutOptionals.additional_data.values, false);

  const maximum = validateAndScoreBia({
    height: 300,
    weight: 1000,
    age: 130,
    gender: 'male',
    body_fat_pct: 100,
    resistance: 10000,
    reactance: 5000,
  }, FIXED_CONTEXT);
  assert.equal(maximum.result_value, 100);

  assertPersistenceAndReportInvariant(zero, {
    canonical_id: 'assessment:test:bia',
    name: 'Bioelectrical Impedance Analysis (BIA)',
    unit_of_measure: '%',
  });
});

test('BIA accepts the string-shaped numeric values submitted by its HTML inputs', () => {
  const payload = validateAndScoreBia({
    height: '170',
    weight: '70.5',
    age: '45',
    gender: 'female',
    body_fat_pct: '22.5',
    resistance: '520',
    reactance: '65',
  }, FIXED_CONTEXT);
  assert.equal(payload.result_value, 22.5);
  assert.equal(payload.additional_data.height, 170);
  assert.equal(payload.additional_data.resistance, 520);
});

test('BIA rejects resistance-only, missing, NaN and out-of-range primary values', () => {
  const base = { height: 170, weight: 70, age: 45, gender: 'female' };
  assert.throws(() => validateAndScoreBia({ ...base, resistance: 520 }, FIXED_CONTEXT), /body fat percentage is required/);
  assert.throws(() => validateAndScoreBia({ ...base, body_fat_pct: Number.NaN }, FIXED_CONTEXT), /from 0 to 100/);
  assert.throws(() => validateAndScoreBia({ ...base, body_fat_pct: -0.1 }, FIXED_CONTEXT), /from 0 to 100/);
  assert.throws(() => validateAndScoreBia({ ...base, body_fat_pct: 100.1 }, FIXED_CONTEXT), /from 0 to 100/);
  assert.throws(() => validateAndScoreBia({ ...base, body_fat_pct: 20, resistance: Infinity }, FIXED_CONTEXT), /Resistance must be/);
  assert.throws(() => validateAndScoreBia({ ...base, body_fat_pct: 20, age: 45.5 }, FIXED_CONTEXT), /whole number/);
});

test('partition fixture/router API exercises the same three real scorers', () => {
  const routes = [
    ['tsk', 'tsk-17'],
    ['10rm', '10rm'],
    ['bia', 'bia'],
  ];
  for (const [runnerKey, scoringKey] of routes) {
    const fixture = buildFixture(runnerKey);
    const payload = validateAndScore(fixture, { ...FIXED_CONTEXT, runnerKey });
    assert.equal(payload.additional_data.scoring_key, scoringKey);
    assert.ok(Number.isFinite(payload.result_value));
  }
  assert.equal(
    validateAndScore(buildFixture('tsk'), { ...FIXED_CONTEXT, scoringKey: 'tsk-17' }).additional_data.scoring_key,
    'tsk-17',
  );
  assert.equal(
    validateAndScore({ ...buildFixture('10rm'), runner_key: '10rm' }, FIXED_CONTEXT).additional_data.scoring_key,
    '10rm',
  );
  assert.equal(
    validateAndScore({ ...buildFixture('bia'), scoring_key: 'bia' }, FIXED_CONTEXT).additional_data.scoring_key,
    'bia',
  );
  assert.throws(() => buildFixture('not-a-runner'), /Unsupported/);
  assert.throws(() => validateAndScore({}, FIXED_CONTEXT), /requires runnerKey/);
});

test('Extras UI uses dedicated TSK and 10RM runners while preserving the 1RM route', () => {
  const extrasSource = fs.readFileSync(
    new URL('../../src/components/assessments/TestRunnerExtras.jsx', import.meta.url),
    'utf8',
  );
  assert.match(extrasSource, /case 'tsk': return <TampaScaleKinesiophobiaTSK17Runner/);
  assert.match(extrasSource, /case '10rm': return <TenRepetitionMaximum10RMRunner/);
  assert.match(extrasSource, /case '1rm_testing': return <OneRMTestingRunner/);
  assert.doesNotMatch(extrasSource, /case '10rm': return <OneRMTestingRunner/);
  assert.match(extrasSource, /'bia', 'tsk', '10rm'/);

  const componentContracts = [
    ['TampaScaleKinesiophobiaTSK17Runner.jsx', 'validateAndScoreTsk'],
    ['TenRepetitionMaximum10RMRunner.jsx', 'validateAndScoreTenRm'],
    ['BioelectricalImpedanceAnalysisBIARunner.jsx', 'validateAndScoreBia'],
  ];
  for (const [filename, scorerName] of componentContracts) {
    const source = fs.readFileSync(
      new URL(`../../src/components/assessments/${filename}`, import.meta.url),
      'utf8',
    );
    assert.match(source, /@\/lib\/clinical\/scorers\/classDRepairs/);
    assert.match(source, new RegExp(`${scorerName}\\(`));
  }
});
