import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  RUNNER_KEYS,
  RUNNER_SPECS,
  buildFixture,
  scoreBorgRpe,
  scoreConstantMurley,
  scoreDexa,
  scoreHeartRateRecovery,
  scoreLipidProfile,
  scoreNaughton,
  scoreQuickDash,
  scoreSgrq,
  scoreVerticalJump,
  validateAndScore,
} from '../../src/lib/clinical/scorers/coreB.js';
import { projectAssessmentResult } from '../../src/components/reports/assessmentResultProjection.js';

const FIXED_CONTEXT = Object.freeze({ assessmentDate: '2026-08-22' });
const EXPECTED_KEYS = Object.freeze([
  'hads', 'ebbeling', 'harvard-step', 'rockport-walk', 'resting-heart-rate', 'astrand',
  'vertical-jump', 'ases', 'constant-murley', 'lysholm', 'acl-rsi', 'fabq',
  'drop-vertical-jump', 'naughton', 'sgrq', 'dexa', 'conley', 'perceived-stress-scale',
  'heart-rate-recovery', 'lipid-profile', 'borg-rpe', 'quickdash',
]);

const CHOICE_TYPES = new Set(['choice', 'radio', 'select', 'single_choice', 'yes_no']);
const SIMPLE_TYPES = new Set(['boolean', 'date', 'duration', 'integer', 'number', 'numeric', 'text', 'textarea', 'time']);
const COMPOUND_TYPES = new Set(['array', 'object']);

function assertFieldComplete(field, path) {
  assert.ok(field?.key && field?.label && field?.type, `${path} requires key, label and type`);
  assert.doesNotMatch(field.key, /[.\[\]]/, `${path} must use an atomic key`);
  const type = String(field.type).toLowerCase();
  if (CHOICE_TYPES.has(type)) {
    assert.ok(Array.isArray(field.options) && field.options.length >= 2, `${path} requires ordered options`);
    for (const option of field.options) {
      assert.equal(typeof option.label, 'string', `${path} option requires label`);
      assert.ok(option.label.length > 0, `${path} option label must not be empty`);
      assert.notEqual(option.value, undefined, `${path} option requires value`);
      assert.notEqual(option.value, null, `${path} option requires value`);
    }
    return;
  }
  if (SIMPLE_TYPES.has(type)) return;
  assert.ok(COMPOUND_TYPES.has(type), `${path} uses unsupported compound type ${type}`);
  if (type === 'array') {
    const minimum = Number(field.minItems ?? field.length);
    const maximum = Number(field.maxItems ?? field.length);
    assert.ok(Number.isInteger(minimum) && minimum >= 0, `${path} requires a finite minimum cardinality`);
    assert.ok(Number.isInteger(maximum) && maximum >= minimum, `${path} requires a finite maximum cardinality`);
  }
  const nested = [field.fields, field.entries, field.items].find((entries) => Array.isArray(entries) && entries.length > 0);
  if (nested) {
    nested.forEach((entry, index) => assertFieldComplete(entry, `${path}.${entry.key || index}`));
    return;
  }
  assert.ok(field.itemSchema, `${path} requires recursive children or itemSchema`);
  assertFieldComplete(field.itemSchema, `${path}[]`);
}

function assertPersistenceInvariant(payload, runnerKey) {
  assert.equal(payload.status, 'completed');
  assert.ok(Number.isFinite(payload.result_value), `${runnerKey} must return a finite primary result`);
  assert.equal(payload.assessment_date, FIXED_CONTEXT.assessmentDate);
  assert.equal(payload.additional_data.scoring_key, runnerKey);
  assert.equal(payload.additional_data.scoring_version, `${runnerKey}.v1`);
  assert.ok(payload.additional_data.measurement_type);
  assert.ok(payload.additional_data.raw_input);
  assert.ok(payload.additional_data.interpretation.length > 3);
  assert.ok(payload.additional_data.soap_text.length > 20);
  assert.ok(payload.additional_data.report_text.length > payload.additional_data.soap_text.length);
  assert.doesNotMatch(JSON.stringify(payload), /NaN|Infinity/);

  const reloaded = JSON.parse(JSON.stringify(payload));
  assert.deepEqual(reloaded, payload);
  const projection = projectAssessmentResult({
    assessment: { canonical_id: `assessment:test:${runnerKey}`, name: `Fixture ${runnerKey}` },
    completedAssessment: reloaded,
  });
  assert.equal(projection.result_value, payload.result_value);
  assert.equal(projection.soap_text, payload.additional_data.soap_text);
  assert.match(projection.report_text, new RegExp(`Fixture ${runnerKey}`));
}

test('Core-B exposes exactly 22 frozen, recursive and schema-v6-safe RunnerSpecs', () => {
  assert.deepEqual(RUNNER_KEYS, EXPECTED_KEYS);
  assert.deepEqual(RUNNER_SPECS.map(({ runnerKey }) => runnerKey), EXPECTED_KEYS);
  assert.equal(new Set(EXPECTED_KEYS).size, 22);
  for (const spec of RUNNER_SPECS) {
    assert.ok(Object.isFrozen(spec));
    assert.ok(Object.isFrozen(spec.scoring));
    assert.equal(spec.schemaVersion, 1);
    assert.equal(spec.scoringKey, spec.runnerKey);
    assert.equal(spec.scoring.version, `${spec.runnerKey}.v1`);
    const content = spec.kind === 'questionnaire' ? spec.items : spec.fields;
    assert.ok(Array.isArray(content) && content.length > 0, `${spec.runnerKey} requires complete content`);
    content.forEach((entry, index) => assertFieldComplete(entry, `${spec.runnerKey}.${entry.key || index}`));
    if (spec.kind === 'questionnaire') {
      const fixture = buildFixture(spec.runnerKey);
      const boundFields = new Set(spec.items.map((item) => item.responseBinding?.field));
      const fixtureFields = Object.keys(fixture).filter((key) => !['notes', 'assessment_date'].includes(key));
      assert.deepEqual([...boundFields].sort(), fixtureFields.sort(), `${spec.runnerKey} questionnaire bindings must expose every fixture response field`);
      for (const [index, item] of spec.items.entries()) {
        assert.ok(Object.isFrozen(item.responseBinding), `${spec.runnerKey} item ${index + 1} binding must be frozen`);
        assert.ok(item.responseBinding.field);
        assert.equal(/[.\[\]]/.test(item.responseBinding.field), false);
        if (Array.isArray(fixture[item.responseBinding.field])) assert.equal(item.responseBinding.index, index);
        else assert.equal(item.responseBinding.key, item.key);
      }
    }
    assert.ok(spec.result.primaryField);
    assert.ok(spec.result.unit);
    assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec);
  }
});

test('all 22 deterministic fixtures execute, persist, reload, project to SOAP and render to reports', () => {
  for (const runnerKey of EXPECTED_KEYS) {
    const payload = validateAndScore(buildFixture(runnerKey), {
      ...FIXED_CONTEXT,
      runnerKey,
      assessmentName: `Fixture ${runnerKey}`,
    });
    assertPersistenceInvariant(payload, runnerKey);
  }
});

test('every Core-B route rejects a missing primary requirement instead of accepting a default', () => {
  const invalidByKey = {
    hads: { ...buildFixture('hads'), scores: { ...buildFixture('hads').scores, q14: undefined } },
    ebbeling: { ...buildFixture('ebbeling'), test_hr_readings: { ...buildFixture('ebbeling').test_hr_readings, min4: { hr: '', rpe: 11 } } },
    'harvard-step': { ...buildFixture('harvard-step'), duration_completed: '' },
    'rockport-walk': { ...buildFixture('rockport-walk'), weight_kg: '' },
    'resting-heart-rate': { heart_rate_bpm: '' },
    astrand: { ...buildFixture('astrand'), hr_minute6: '' },
    'vertical-jump': { ...buildFixture('vertical-jump'), trials: [] },
    ases: { ...buildFixture('ases'), adl_scores: buildFixture('ases').adl_scores.slice(0, 9) },
    'constant-murley': { ...buildFixture('constant-murley'), strength: '' },
    lysholm: { ...buildFixture('lysholm'), responses: { ...buildFixture('lysholm').responses, pain: undefined } },
    'acl-rsi': { ...buildFixture('acl-rsi'), responses: buildFixture('acl-rsi').responses.slice(0, 11) },
    fabq: { ...buildFixture('fabq'), responses: [...buildFixture('fabq').responses.slice(0, 15), null] },
    'drop-vertical-jump': { ...buildFixture('drop-vertical-jump'), knee_angle_degrees: '' },
    naughton: { ...buildFixture('naughton'), stage_data: [] },
    sgrq: { ...buildFixture('sgrq'), activity_responses: { ...buildFixture('sgrq').activity_responses, a7: undefined } },
    dexa: { ...buildFixture('dexa'), t_scores: {} },
    conley: { ...buildFixture('conley'), scores: { ...buildFixture('conley').scores, dizziness: undefined } },
    'perceived-stress-scale': { ...buildFixture('perceived-stress-scale'), responses: [...buildFixture('perceived-stress-scale').responses.slice(0, 9), null] },
    'heart-rate-recovery': { ...buildFixture('heart-rate-recovery'), hr_1_minute: '' },
    'lipid-profile': { ...buildFixture('lipid-profile'), total_cholesterol: '' },
    'borg-rpe': { ...buildFixture('borg-rpe'), rpe_value: 12.5 },
    quickdash: { ...buildFixture('quickdash'), total_score: '' },
  };
  assert.deepEqual(Object.keys(invalidByKey), EXPECTED_KEYS);
  for (const [runnerKey, input] of Object.entries(invalidByKey)) {
    assert.throws(() => validateAndScore(input, { ...FIXED_CONTEXT, runnerKey }), /required|must contain|must equal|must be|not available|not a permitted|At least one/);
  }
});

test('formula, protocol and zero-preservation samples stay deterministic and fail closed', () => {
  const jump = scoreVerticalJump(buildFixture('vertical-jump'), FIXED_CONTEXT);
  assert.equal(jump.result_value, 45);
  assert.equal(jump.additional_data.trials[1].standing_reach_cm, 210);
  assert.throws(() => scoreVerticalJump({ ...buildFixture('vertical-jump'), trials: [{ height_cm: 44, method: 'sargent', standing_reach_cm: 210, jump_reach_cm: 255 }] }, FIXED_CONTEXT), /must equal/);

  const constant = scoreConstantMurley(buildFixture('constant-murley'), FIXED_CONTEXT);
  assert.equal(constant.result_value, 76);
  assert.equal(constant.additional_data.rom_score, 30);

  const naughton = scoreNaughton(buildFixture('naughton'), FIXED_CONTEXT);
  assert.equal(naughton.result_value, 300);
  assert.deepEqual(naughton.additional_data.stage_data.map(({ stage }) => stage), [1, 2, 3]);
  assert.throws(() => scoreNaughton({ ...buildFixture('naughton'), stage_data: [{ ...buildFixture('naughton').stage_data[0], grade: 9 }] }, FIXED_CONTEXT), /do not match/);

  const sgrq = scoreSgrq(buildFixture('sgrq'), FIXED_CONTEXT);
  assert.equal(sgrq.result_value, 40);
  assert.equal(Object.keys(sgrq.additional_data.activity_responses).length, 7);
  assert.equal(Object.keys(sgrq.additional_data.impact_responses).length, 22);

  const dexa = scoreDexa({ t_scores: { lumbarSpine: -1.2, femoralNeck: -1.8 }, bmd_values: { lumbarSpine: 0 }, body_fat_percentage: 0, visceral_adipose_tissue: 0, lean_mass_kg: 0, notes: '' }, FIXED_CONTEXT);
  assert.equal(dexa.result_value, -1.8);
  assert.equal(dexa.additional_data.bmd_values.lumbarSpine, 0);
  assert.equal(dexa.additional_data.body_fat_percentage, 0);

  const zeroRecovery = scoreHeartRateRecovery({ peak_heart_rate: 100, hr_1_minute: 100, hr_2_minute: 110, additional_measurements: [], recovery_mode: 'passive_seated', notes: '' }, FIXED_CONTEXT);
  assert.equal(zeroRecovery.result_value, 0);
  assert.equal(zeroRecovery.additional_data.hrr_2_minute, -10);

  const zeroLipids = scoreLipidProfile({ unit: 'mgdl', total_cholesterol: 0, ldl: 0, hdl: 0, triglycerides: 0, notes: '' }, FIXED_CONTEXT);
  assert.equal(zeroLipids.result_value, 0);
  assert.equal(zeroLipids.additional_data.ldl, 0);
  assert.equal(zeroLipids.additional_data.hdl, 0);
  assert.equal(zeroLipids.additional_data.triglycerides, 0);

  assert.equal(scoreBorgRpe({ scale_type: 'borg_6_20', rpe_value: 7.5, notes: '' }, FIXED_CONTEXT).result_value, 7.5);
  assert.equal(scoreQuickDash({ raw_sum: 33, total_score: 50, assessment_date: '2026-08-22', notes: '' }, FIXED_CONTEXT).result_value, 50);
  assert.throws(() => scoreQuickDash({ raw_sum: 33, total_score: 49, assessment_date: '2026-08-22', notes: '' }, FIXED_CONTEXT), /does not match/);
  assert.throws(() => validateAndScore({ runnerKey: 'not-a-real-route' }, FIXED_CONTEXT), /unsupported runner key/);
});

test('each production runner imports and invokes its exact Core-B scorer', () => {
  const contracts = [
    ['HADSRunner.jsx', 'scoreHads'], ['EbbelingTestRunner.jsx', 'scoreEbbeling'],
    ['HarvardStepRunner.jsx', 'scoreHarvardStep'], ['RockportWalkRunner.jsx', 'scoreRockportWalk'],
    ['AstrandTestRunner.jsx', 'scoreAstrand'], ['VerticalJumpTestRunner.jsx', 'scoreVerticalJump'],
    ['AmericanShoulderandElbowSurgeonsASESScoreRunner.jsx', 'scoreAses'], ['ConstantMurleyScoreRunner.jsx', 'scoreConstantMurley'],
    ['LysholmKneeScoreRunner.jsx', 'scoreLysholm'], ['ACLRSIRunner.jsx', 'scoreAclRsi'],
    ['FearAvoidanceBeliefsQuestionnaireFABQRunner.jsx', 'scoreFabq'], ['DropVerticalJumpRunner.jsx', 'scoreDropVerticalJump'],
    ['NaughtonTreadmillProtocolRunner.jsx', 'scoreNaughton'], ['StGeorgesRespiratoryQuestionnaireSGRQRunner.jsx', 'scoreSgrq'],
    ['DEXAScanResultsInterpretationRunner.jsx', 'scoreDexa'], ['ConleyScaleRunner.jsx', 'scoreConley'],
    ['PerceivedStressScalePSSRunner.jsx', 'scorePerceivedStress'], ['HRRRunner.jsx', 'scoreHeartRateRecovery'],
    ['LipidProfileRunner.jsx', 'scoreLipidProfile'], ['BorgRPERunner.jsx', 'scoreBorgRpe'],
    ['QuickDASHRunner.jsx', 'scoreQuickDash'],
  ];
  for (const [filename, scorer] of contracts) {
    const source = fs.readFileSync(new URL(`../../src/components/assessments/${filename}`, import.meta.url), 'utf8');
    assert.match(source, /@\/lib\/clinical\/scorers\/coreB/);
    assert.match(source, new RegExp(`onSave\\(${scorer}\\(`));
    assert.doesNotMatch(source, /onSave\(\{/);
  }

  const vitalSource = fs.readFileSync(new URL('../../src/components/assessments/VitalSignsRunner.jsx', import.meta.url), 'utf8');
  assert.match(vitalSource, /@\/lib\/clinical\/scorers\/coreB/);
  assert.match(vitalSource, /runnerKey === 'resting-heart-rate'/);
  assert.match(vitalSource, /scoreRestingHeartRate\(\{ heart_rate_bpm:/);

  const testRunnerSource = fs.readFileSync(new URL('../../src/components/assessments/TestRunner.jsx', import.meta.url), 'utf8');
  assert.match(testRunnerSource, /<VitalSignsRunner[\s\S]*?runnerKey=\{activeRunnerKey\}/);
  assert.match(testRunnerSource, /<VitalSignsRunner[\s\S]*?client=\{client\}[\s\S]*?assessment=\{assessment\}/);

  const sgrqSource = fs.readFileSync(new URL('../../src/components/assessments/StGeorgesRespiratoryQuestionnaireSGRQRunner.jsx', import.meta.url), 'utf8');
  assert.match(sgrqSource, /activityAnswered === ACTIVITY_ITEMS\.length/);
  assert.match(sgrqSource, /impactAnswered === IMPACT_ITEMS\.length/);
  const jumpSource = fs.readFileSync(new URL('../../src/components/assessments/VerticalJumpTestRunner.jsx', import.meta.url), 'utf8');
  assert.match(jumpSource, /standing_reach_cm:/);
  assert.match(jumpSource, /jump_reach_cm:/);
});
