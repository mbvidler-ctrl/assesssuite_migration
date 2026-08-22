import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertCheckedInPhysioRunnerContentAudit,
  buildPhysioRunnerContentAudit,
} from '../catalogue/physio-runner-content-audit.mjs';
import { buildPhysioCatalogueManifest } from '../catalogue/physio-catalogue.mjs';
import { RUNNER_KEYS as MOBILITY_BALANCE_ORTHO_RUNNER_KEYS } from '../../src/lib/clinical/scorers/extrasMobilityBalanceOrtho.js';
import { PROM_NEURO_RUNNER_KEYS } from '../../src/lib/clinical/scorers/extrasPromNeuro.js';
import { RUNNER_KEYS as CORE_B_RUNNER_KEYS } from '../../src/lib/clinical/scorers/coreB.js';
import { RUNNER_KEYS as CORE_A_RUNNER_KEYS } from '../../src/lib/clinical/scorers/coreA.js';

test('no-abridgement audit reports every canonical and remains fail-closed', () => {
  const audit = buildPhysioRunnerContentAudit();
  assert.equal(assertCheckedInPhysioRunnerContentAudit(), true);
  assert.equal(audit.denominator, 236);
  assert.equal(audit.complete, 236);
  assert.equal(audit.incomplete, 0);
  assert.equal(audit.skipped, 0);
  assert.equal(audit.quarantined, 0);
  assert.equal(audit.acceptanceComplete, true);
  assert.equal(audit.rows.length, 236);
  assert.equal(new Set(audit.rows.map(({ canonicalId }) => canonicalId)).size, 236);
  assert.deepEqual(audit.incompleteCanonicalIds, []);
  assert.match(audit.auditSha256, /^[a-f0-9]{64}$/);
});

test('full DASS-21 and TSK-17 item wording/options are bound to their production scorers', () => {
  const audit = buildPhysioRunnerContentAudit();
  for (const [canonicalId, expectedItems] of [
    ['assessment:ep-synthetic:dass-21', 21],
    ['assessment:ep-import:691eb419ae95315ff3bad4fa', 17],
  ]) {
    const row = audit.rows.find((candidate) => candidate.canonicalId === canonicalId);
    assert.equal(row.contentMode, 'ordered-items');
    assert.equal(row.itemCount, expectedItems);
    assert.equal(row.orderedItemTextComplete, true);
    assert.equal(row.productionBindingComplete, true);
    assert.equal(row.noAbridgementComplete, true);
    assert.deepEqual(row.gaps, []);
  }
});

test('all six maintained Physio additions bind their complete fields or ordered items to production scorers', () => {
  const audit = buildPhysioRunnerContentAudit();
  const expected = new Map([
    ['assessment:physio-component:balance-error-scoring-system', { mode: 'structured-fields', count: 7 }],
    ['assessment:physio-component:air-displacement-plethysmography-bod-pod', { mode: 'structured-fields', count: 8 }],
    ['assessment:physio-component:expanded-disability-status-scale', { mode: 'structured-fields', count: 3 }],
    ['assessment:physio-component:international-physical-activity-questionnaire-short-form', { mode: 'ordered-items', count: 7 }],
    ['assessment:physio-component:edmonton-frail-scale', { mode: 'ordered-items', count: 11 }],
    ['assessment:physio-component:timed-up-and-down-stairs', { mode: 'structured-fields', count: 7 }],
  ]);
  for (const [canonicalId, { mode, count }] of expected) {
    const row = audit.rows.find((candidate) => candidate.canonicalId === canonicalId);
    assert.equal(row.contentMode, mode, canonicalId);
    assert.equal(mode === 'ordered-items' ? row.itemCount : row.fieldCount, count, canonicalId);
    assert.equal(row.productionBindingComplete, true, canonicalId);
    assert.equal(row.noAbridgementComplete, true, canonicalId);
    assert.deepEqual(row.gaps, [], canonicalId);
  }
});

test('standalone paths bind complete ordered items or recursively described fields', () => {
  const audit = buildPhysioRunnerContentAudit();
  const expected = new Map([
    ['8-foot-up-go', { mode: 'structured-fields', count: 5 }],
    ['6-meter-walk', { mode: 'structured-fields', count: 5 }],
    ['400-meter-walk', { mode: 'structured-fields', count: 11 }],
    ['6-minute-step', { mode: 'structured-fields', count: 9 }],
    ['fim', { mode: 'ordered-items', count: 18 }],
  ]);
  for (const [runnerKey, { mode, count }] of expected) {
    const row = audit.rows.find((candidate) => candidate.runnerKey === runnerKey);
    assert.ok(row, runnerKey);
    assert.equal(row.contentMode, mode, runnerKey);
    assert.equal(mode === 'ordered-items' ? row.itemCount : row.fieldCount, count, runnerKey);
    assert.equal(row.productionBindingComplete, true, runnerKey);
    assert.equal(row.noAbridgementComplete, true, runnerKey);
    assert.deepEqual(row.incompleteCompoundFieldKeys, [], runnerKey);
    assert.deepEqual(row.gaps, [], runnerKey);
  }
});

test('B3 body/fitness scorers bind recursively complete production fields', () => {
  const audit = buildPhysioRunnerContentAudit();
  const keys = [
    'bmi_full', 'whr_full', 'girth', 'body_fat_skinfold', 'home_step', '12min_walk',
    'max_push', 'fvc', 'pefr', 'ymca_cycle', 'wingate', 'rsa_generic', 'hydrostatic',
    'rmr', 'rsa_6x30', 'rsa_10x20', 'rsa_7x35', 'rsa_shuttle', 'vo2max_gxt_full',
    'met_calc_full',
  ];
  for (const runnerKey of keys) {
    const row = audit.rows.find((candidate) => candidate.runnerKey === runnerKey);
    assert.ok(row, runnerKey);
    assert.equal(row.contentMode, 'structured-fields', runnerKey);
    assert.ok(row.fieldCount > 0, runnerKey);
    assert.equal(row.productionBindingComplete, true, runnerKey);
    assert.equal(row.noAbridgementComplete, true, runnerKey);
    assert.deepEqual(row.incompleteCompoundFieldKeys, [], runnerKey);
    assert.deepEqual(row.unrepresentedFixtureInputKeys, [], runnerKey);
    assert.deepEqual(row.gaps, [], runnerKey);
  }
});

test('B1 and B2 partitions bind every frozen fixture input to complete production content', () => {
  const audit = buildPhysioRunnerContentAudit();
  for (const runnerKey of [...PROM_NEURO_RUNNER_KEYS, ...MOBILITY_BALANCE_ORTHO_RUNNER_KEYS]) {
    const row = audit.rows.find((candidate) => candidate.runnerKey === runnerKey);
    assert.ok(row, runnerKey);
    assert.equal(row.registeredFixtureSchemaApplicable, true, runnerKey);
    assert.equal(row.registeredFixtureInputSchemaComplete, true, runnerKey);
    assert.deepEqual(row.unrepresentedFixtureInputKeys, [], runnerKey);
    assert.equal(row.productionBindingComplete, true, runnerKey);
    assert.equal(row.noAbridgementComplete, true, runnerKey);
    assert.deepEqual(row.gaps, [], runnerKey);
  }
});

test('Core-B binds all 22 frozen fixtures to complete production content', () => {
  const audit = buildPhysioRunnerContentAudit();
  assert.equal(CORE_B_RUNNER_KEYS.length, 22);
  for (const runnerKey of CORE_B_RUNNER_KEYS) {
    const row = audit.rows.find((candidate) => candidate.runnerKey === runnerKey);
    assert.ok(row, runnerKey);
    assert.equal(row.registeredFixtureSchemaApplicable, true, runnerKey);
    assert.equal(row.registeredFixtureInputSchemaComplete, true, runnerKey);
    assert.deepEqual(row.unrepresentedFixtureInputKeys, [], runnerKey);
    assert.equal(row.productionBindingComplete, true, runnerKey);
    assert.equal(row.noAbridgementComplete, true, runnerKey);
    assert.deepEqual(row.gaps, [], runnerKey);
  }
});

test('Core-A binds all final 22 frozen fixtures to complete production content', () => {
  const audit = buildPhysioRunnerContentAudit();
  assert.equal(CORE_A_RUNNER_KEYS.length, 22);
  for (const runnerKey of CORE_A_RUNNER_KEYS) {
    const row = audit.rows.find((candidate) => candidate.runnerKey === runnerKey);
    assert.ok(row, runnerKey);
    assert.equal(row.contentMode, 'structured-fields', runnerKey);
    assert.equal(row.registeredFixtureSchemaApplicable, true, runnerKey);
    assert.equal(row.registeredFixtureInputSchemaComplete, true, runnerKey);
    assert.deepEqual(row.unrepresentedFixtureInputKeys, [], runnerKey);
    assert.equal(row.productionBindingComplete, true, runnerKey);
    assert.equal(row.noAbridgementComplete, true, runnerKey);
    assert.deepEqual(row.gaps, [], runnerKey);
  }
  const frailty = audit.rows.find(({ runnerKey }) => runnerKey === 'clinical-frailty-scale');
  assert.equal(frailty.contentMode, 'structured-fields');
  assert.equal(frailty.fieldCount, 2);
  assert.equal(frailty.itemCount, 0);
});

test('C2 functional/orthopaedic scorers bind recursively complete production fields', () => {
  const audit = buildPhysioRunnerContentAudit();
  const keys = [
    'arm_curl', '30sec_sts', 'triple_hop', 'trendelenburg', 'stair_climb',
    'two_min_step', 'step_tap', 'box_block_test', 'mcgill', '60sec_sts',
    'distress_thermometer', 'static_back', 'rombergs_standing', 'shoulder_tug',
    'gst', 'timed_push_up', 'static_squat', 'squat', 'ymca_bench', '5xsts',
    'fac', 'modified_rankin', 'nine_peg', 'grooved_peg', 'elys_test',
    'thomas_test', 'anterior_drawer_knee', 'noble_compression',
  ];
  for (const runnerKey of keys) {
    const row = audit.rows.find((candidate) => candidate.runnerKey === runnerKey);
    assert.ok(row, runnerKey);
    assert.equal(row.contentMode, 'structured-fields', runnerKey);
    assert.ok(row.fieldCount > 0, runnerKey);
    assert.equal(row.productionBindingComplete, true, runnerKey);
    assert.equal(row.noAbridgementComplete, true, runnerKey);
    assert.deepEqual(row.incompleteFieldKeys, [], runnerKey);
    assert.deepEqual(row.gaps, [], runnerKey);
  }
  const distress = audit.rows.find(({ runnerKey }) => runnerKey === 'distress_thermometer');
  assert.equal(distress.itemCount, 0);
  assert.ok(distress.fieldCount > 0);
});

test('C1 scorers bind recursively complete production fields', () => {
  const audit = buildPhysioRunnerContentAudit();
  const keys = [
    'heart_rate', 'spo2-exercise', 'spo2-resting', 'blood_pressure',
    'ymca_3min_step', 'aerobic_step', 'chester', 'eswt', 'height_measurement',
    'weight_measure', 'waist_circ', 'tri_arm', 'tecumseh', 'balke',
    'modified_bruce', '1rm_testing', 'bruce_treadmill', '2min_walk',
    '20m_shuttle', '3015_ift', 'fasting_glucose', 'ogtt', 'hba1c',
  ];
  const rows = keys.map((runnerKey) => {
    const row = audit.rows.find((candidate) => candidate.runnerKey === runnerKey);
    assert.ok(row, runnerKey);
    assert.equal(row.productionBindingComplete, true, runnerKey);
    assert.equal(row.contentMode, 'structured-fields', runnerKey);
    assert.equal(row.noAbridgementComplete, true, runnerKey);
    assert.deepEqual(row.incompleteCompoundFieldKeys, [], runnerKey);
    assert.deepEqual(row.gaps, [], runnerKey);
    return row;
  });
  assert.equal(rows.length, 23);
});

test('former aggregate-only shortcuts now bind full ordered or level-and-side content', () => {
  const audit = buildPhysioRunnerContentAudit();
  const expected = new Map([
    ['assessment:ep-import:6933cc3f697c55fe37e0bc27', 20],
    ['assessment:physio-legacy:neurological-screening-examination', 56],
    ['assessment:physio-legacy:orebro-musculoskeletal-pain-screening-questionnaire', 10],
    ['assessment:physio-legacy:start-back-screening-tool', 9],
  ]);
  for (const [canonicalId, count] of expected) {
    const row = audit.rows.find((candidate) => candidate.canonicalId === canonicalId);
    assert.equal(row.noAbridgementComplete, true, canonicalId);
    assert.equal(row.itemCount || row.fieldCount, count, canonicalId);
    assert.deepEqual(row.gaps, [], canonicalId);
  }
});

test('every complete row has ordered items or fields plus component and scorer digests', () => {
  const audit = buildPhysioRunnerContentAudit();
  for (const row of audit.rows.filter(({ noAbridgementComplete }) => noAbridgementComplete)) {
    assert.equal(row.canonicalRepresentationComplete, true, row.name);
    assert.equal(row.implementationComponentDigestPresent, true, row.name);
    assert.equal(row.implementationScorerDigestPresent, true, row.name);
    assert.equal(row.implementationComponentDigestCurrent, true, row.name);
    assert.equal(row.implementationScorerDigestCurrent, true, row.name);
    assert.equal(row.componentScorerBindingMarkerPresent, true, row.name);
    assert.equal(row.componentScorerBindingDigestValid, true, row.name);
    assert.equal(row.productionBindingComplete, true, row.name);
    assert.equal(row.registeredFixtureInputSchemaComplete, true, row.name);
    assert.ok(row.itemCount > 0 || row.fieldCount > 0, row.name);
  }
});

test('registered scorer fixtures fail closed when their production input key is not represented', () => {
  const manifest = buildPhysioCatalogueManifest();
  const targetCanonicalId = 'assessment:ep-import:6900b2fb190ed8134f88dcd6';
  const mutatedAssessments = manifest.canonicalAssessments.map((entry) => {
    if (entry.canonicalId !== targetCanonicalId) return entry;
    return {
      ...entry,
      content: {
        ...entry.content,
        runner_spec: {
          ...entry.content.runner_spec,
          fields: entry.content.runner_spec.fields.map((field) => (
            field.key === 'trials' ? { ...field, key: 'recorded_trials' } : field
          )),
        },
      },
    };
  });
  const audit = buildPhysioRunnerContentAudit({
    ...manifest,
    canonicalAssessments: mutatedAssessments,
  });
  const row = audit.rows.find(({ canonicalId }) => canonicalId === targetCanonicalId);
  assert.equal(row.structuredFieldsComplete, true);
  assert.equal(row.registeredFixtureInputSchemaComplete, false);
  assert.deepEqual(row.unrepresentedFixtureInputKeys, ['trials']);
  assert.equal(row.canonicalRepresentationComplete, false);
  assert.equal(row.noAbridgementComplete, false);
  assert.ok(row.gaps.includes('fixture-input-schema-unrepresented'));
});

test('component-scorer binding fails closed when the production component lacks its exact marker', () => {
  const manifest = buildPhysioCatalogueManifest();
  const targetCanonicalId = 'assessment:ep-synthetic:dass-21';
  const mutatedAssessments = manifest.canonicalAssessments.map((entry) => {
    if (entry.canonicalId !== targetCanonicalId) return entry;
    return {
      ...entry,
      content: {
        ...entry.content,
        runner_spec: {
          ...entry.content.runner_spec,
          implementation: {
            ...entry.content.runner_spec.implementation,
            component_scorer_binding_marker: '@/lib/clinical/definitely-not-imported',
          },
        },
      },
    };
  });
  const audit = buildPhysioRunnerContentAudit({
    ...manifest,
    canonicalAssessments: mutatedAssessments,
  });
  const row = audit.rows.find(({ canonicalId }) => canonicalId === targetCanonicalId);
  assert.equal(row.componentScorerBindingMarkerPresent, false);
  assert.equal(row.componentScorerBindingDigestValid, false);
  assert.equal(row.productionBindingComplete, false);
  assert.equal(row.noAbridgementComplete, false);
  assert.ok(row.gaps.includes('component-scorer-binding-missing'));
  assert.ok(row.gaps.includes('component-scorer-binding-digest-invalid'));
});

test('compound fields fail closed when nested production inputs are omitted', () => {
  const manifest = buildPhysioCatalogueManifest();
  const targetCanonicalId = 'assessment:ep-import:6875c72f2289fc627a74b0c1';
  const mutatedAssessments = manifest.canonicalAssessments.map((entry) => {
    if (entry.canonicalId !== targetCanonicalId) return entry;
    const [firstField, ...remainingFields] = entry.content.runner_spec.fields;
    return {
      ...entry,
      content: {
        ...entry.content,
        runner_spec: {
          ...entry.content.runner_spec,
          fields: [{ ...firstField, type: 'object' }, ...remainingFields],
        },
      },
    };
  });
  const audit = buildPhysioRunnerContentAudit({
    ...manifest,
    canonicalAssessments: mutatedAssessments,
  });
  const row = audit.rows.find(({ canonicalId }) => canonicalId === targetCanonicalId);
  assert.equal(row.canonicalRepresentationComplete, false);
  assert.equal(row.noAbridgementComplete, false);
  assert.deepEqual(row.incompleteCompoundFieldKeys, ['degrees']);
  assert.ok(row.gaps.includes('compound-field-schema-incomplete'));
});

test('repeated compound fields fail closed when production cardinality is omitted', () => {
  const manifest = buildPhysioCatalogueManifest();
  const targetCanonicalId = 'assessment:ep-import:6925720e03bb5bd63f4b303b';
  const mutatedAssessments = manifest.canonicalAssessments.map((entry) => {
    if (entry.canonicalId !== targetCanonicalId) return entry;
    return {
      ...entry,
      content: {
        ...entry.content,
        runner_spec: {
          ...entry.content.runner_spec,
          fields: entry.content.runner_spec.fields.map((field) => (
            field.key === 'laps'
              ? { ...field, maxItems: undefined }
              : field
          )),
        },
      },
    };
  });
  const audit = buildPhysioRunnerContentAudit({
    ...manifest,
    canonicalAssessments: mutatedAssessments,
  });
  const row = audit.rows.find(({ canonicalId }) => canonicalId === targetCanonicalId);
  assert.equal(row.canonicalRepresentationComplete, false);
  assert.equal(row.noAbridgementComplete, false);
  assert.deepEqual(row.incompleteCompoundFieldKeys, ['laps']);
  assert.ok(row.gaps.includes('compound-field-schema-incomplete'));
});

test('flattened dotted field paths cannot replace a recursive object schema', () => {
  const manifest = buildPhysioCatalogueManifest();
  const targetCanonicalId = 'assessment:ep-import:6875c72f2289fc627a74b0c1';
  const mutatedAssessments = manifest.canonicalAssessments.map((entry) => {
    if (entry.canonicalId !== targetCanonicalId) return entry;
    const [firstField, ...remainingFields] = entry.content.runner_spec.fields;
    return {
      ...entry,
      content: {
        ...entry.content,
        runner_spec: {
          ...entry.content.runner_spec,
          fields: [{ ...firstField, key: 'ankle.degrees' }, ...remainingFields],
        },
      },
    };
  });
  const audit = buildPhysioRunnerContentAudit({
    ...manifest,
    canonicalAssessments: mutatedAssessments,
  });
  const row = audit.rows.find(({ canonicalId }) => canonicalId === targetCanonicalId);
  assert.equal(row.canonicalRepresentationComplete, false);
  assert.equal(row.noAbridgementComplete, false);
  assert.deepEqual(row.incompleteFieldKeys, ['ankle.degrees']);
  assert.ok(row.gaps.includes('structured-fields-incomplete'));
});

test('questionnaire item keys and response bindings cannot encode flattened paths', () => {
  const manifest = buildPhysioCatalogueManifest();
  const targetCanonicalId = 'assessment:ep-synthetic:dass-21';
  const mutatedAssessments = manifest.canonicalAssessments.map((entry) => {
    if (entry.canonicalId !== targetCanonicalId) return entry;
    const [firstItem, ...remainingItems] = entry.content.runner_spec.items;
    return {
      ...entry,
      content: {
        ...entry.content,
        runner_spec: {
          ...entry.content.runner_spec,
          items: [
            {
              ...firstItem,
              key: 'responses.0',
              responseBinding: { field: 'responses.0', index: 0 },
            },
            ...remainingItems,
          ],
        },
      },
    };
  });
  const audit = buildPhysioRunnerContentAudit({
    ...manifest,
    canonicalAssessments: mutatedAssessments,
  });
  const row = audit.rows.find(({ canonicalId }) => canonicalId === targetCanonicalId);
  assert.equal(row.orderedItemTextComplete, false);
  assert.equal(row.noAbridgementComplete, false);
  assert.ok(row.gaps.includes('ordered-items-or-options-incomplete'));
});

test('duplicate questionnaire item keys fail closed instead of overwriting a response', () => {
  const manifest = buildPhysioCatalogueManifest();
  const targetCanonicalId = 'assessment:ep-synthetic:dass-21';
  const mutatedAssessments = manifest.canonicalAssessments.map((entry) => {
    if (entry.canonicalId !== targetCanonicalId) return entry;
    const [firstItem, secondItem, ...remainingItems] = entry.content.runner_spec.items;
    return {
      ...entry,
      content: {
        ...entry.content,
        runner_spec: {
          ...entry.content.runner_spec,
          items: [firstItem, { ...secondItem, key: firstItem.key }, ...remainingItems],
        },
      },
    };
  });
  const audit = buildPhysioRunnerContentAudit({
    ...manifest,
    canonicalAssessments: mutatedAssessments,
  });
  const row = audit.rows.find(({ canonicalId }) => canonicalId === targetCanonicalId);
  assert.equal(row.orderedItemTextComplete, false);
  assert.equal(row.noAbridgementComplete, false);
  assert.ok(row.gaps.includes('ordered-items-or-options-incomplete'));
});
