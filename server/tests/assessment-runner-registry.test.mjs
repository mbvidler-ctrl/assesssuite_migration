import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

import { buildPhysioCatalogueManifest } from '../catalogue/physio-catalogue.mjs';
import {
  assertCheckedInAssessmentRouteRegistry,
  buildPhysioAssessmentRoutes,
} from '../catalogue/generate-assessment-route-registry.mjs';
import { PHYSIO_ROUTE_ASSIGNMENTS } from '../catalogue/physio-route-assignments.mjs';
import {
  ASSESSMENT_RUNNER_REGISTRY,
  ASSESSMENT_ROUTE_REGISTRY_DIGEST,
  normalizeAssessmentName,
  resolveRegisteredAssessmentRoute,
} from '../../src/components/assessments/assessmentRunnerRegistry.js';
import { hasAssessmentResultValue } from '../../src/components/reports/assessmentResultValue.js';

test('all 236 canonical IDs have a unique deterministic runner route', () => {
  const manifest = buildPhysioCatalogueManifest();
  assert.equal(assertCheckedInAssessmentRouteRegistry(), true);
  assert.deepEqual(ASSESSMENT_RUNNER_REGISTRY, buildPhysioAssessmentRoutes());
  assert.equal(ASSESSMENT_RUNNER_REGISTRY.length, 236);
  assert.equal(new Set(ASSESSMENT_RUNNER_REGISTRY.map(({ canonicalId }) => canonicalId)).size, 236);
  assert.equal(new Set(ASSESSMENT_RUNNER_REGISTRY.map(({ name }) => name)).size, 236);
  assert.deepEqual(
    ASSESSMENT_RUNNER_REGISTRY.map(({ canonicalId }) => canonicalId).sort(),
    manifest.canonicalAssessments.map(({ canonicalId }) => canonicalId).sort(),
  );
  assert.equal(
    crypto.createHash('sha256').update(JSON.stringify(ASSESSMENT_RUNNER_REGISTRY)).digest('hex'),
    ASSESSMENT_ROUTE_REGISTRY_DIGEST,
  );

  for (const route of ASSESSMENT_RUNNER_REGISTRY) {
    assert.ok(route.host);
    assert.ok(route.runnerKey);
    assert.ok(route.scoringKey);
    assert.ok(!['generic', 'manual', 'fallback', 'generic-test-runner'].includes(route.host));
    assert.ok(!['generic', 'manual', 'fallback', 'manual-result-capture'].includes(route.runnerKey));
    if (route.host === 'test-runner') assert.notEqual(route.runnerKey, 'test-runner');
    assert.equal(resolveRegisteredAssessmentRoute({ canonical_id: route.canonicalId }), route);
    assert.equal(resolveRegisteredAssessmentRoute(route.name), route);
  }
});

test('route generation is rebuildable from a separate maintained assignment map', () => {
  assert.equal(Object.keys(PHYSIO_ROUTE_ASSIGNMENTS).length, 236);
  const generatorSource = fs.readFileSync(
    new URL('../catalogue/generate-assessment-route-registry.mjs', import.meta.url),
    'utf8',
  );
  assert.match(generatorSource, /PHYSIO_ROUTE_ASSIGNMENTS/);
  assert.doesNotMatch(generatorSource, /GENERATED_ASSESSMENT_ROUTES as CHECKED_IN_ROUTES/);
});

test('BPI, UEFS and YMCA have exact non-colliding routes', () => {
  assert.deepEqual(
    { ...resolveRegisteredAssessmentRoute('Brief Pain Inventory (BPI)') },
    {
      canonicalId: 'assessment:ep-import:691eb419ae95315ff3bad4f1',
      name: 'Brief Pain Inventory (BPI)',
      host: 'questionnaire',
      runnerKey: 'bpi',
      scoringKey: 'bpi',
    },
  );
  assert.deepEqual(
    { ...resolveRegisteredAssessmentRoute('Upper Extremity Functional Scale (UEFS)') },
    {
      canonicalId: 'assessment:ep-import:6933cc3f697c55fe37e0bc27',
      name: 'Upper Extremity Functional Scale (UEFS)',
      host: 'questionnaire',
      runnerKey: 'uefs',
      scoringKey: 'uefs',
    },
  );
  assert.equal(resolveRegisteredAssessmentRoute('YMCA 3-Minute Step Test').runnerKey, 'ymca_3min_step');
  assert.equal(resolveRegisteredAssessmentRoute('YMCA 3 Minute Step Test').runnerKey, 'ymca_3min_step');
});

test('deduplicated source names resolve as aliases while substring guesses remain rejected', () => {
  const retained = resolveRegisteredAssessmentRoute('30-Second Sit-to-Stand Test');
  const sourceAlias = resolveRegisteredAssessmentRoute('30-Second Sit to Stand Test');
  assert.equal(sourceAlias.canonicalId, retained.canonicalId);
  assert.equal(
    normalizeAssessmentName('30-Second Sit to Stand Test'),
    normalizeAssessmentName('30-Second Sit-to-Stand Test'),
  );
  assert.equal(resolveRegisteredAssessmentRoute('30 second sit to stand test').canonicalId, retained.canonicalId);
  assert.equal(
    resolveRegisteredAssessmentRoute('Timed Up and Go').canonicalId,
    'assessment:ep-import:6900b2fb190ed8134f88dcd6',
  );
  assert.equal(
    resolveRegisteredAssessmentRoute('Six-Minute Walk Test').canonicalId,
    'assessment:ep-import:69636f09c9620c87150fe372',
  );
  assert.equal(resolveRegisteredAssessmentRoute('Brief Pain Inventory (BPI) follow-up'), null);
  assert.equal(resolveRegisteredAssessmentRoute('UEFS-like screen'), null);
  assert.equal(resolveRegisteredAssessmentRoute('Generic 3-minute step test'), null);
});

test('all ten additive Physio assessments have explicit functional routes', () => {
  assert.equal(resolveRegisteredAssessmentRoute('QuickDASH').runnerKey, 'quickdash');
  assert.equal(resolveRegisteredAssessmentRoute('STarT Back Screening Tool').host, 'questionnaire');
  assert.equal(resolveRegisteredAssessmentRoute('Orebro Musculoskeletal Pain Screening Questionnaire').host, 'questionnaire');
  assert.equal(resolveRegisteredAssessmentRoute('Neurological Screening Examination').host, 'structured');
  assert.equal(resolveRegisteredAssessmentRoute('Air Displacement Plethysmography (BOD POD)').runnerKey, 'bod_pod');
  assert.equal(resolveRegisteredAssessmentRoute('Balance Error Scoring System (BESS)').runnerKey, 'bess');
  assert.equal(resolveRegisteredAssessmentRoute('Edmonton Frail Scale (EFS)').runnerKey, 'efs');
  assert.equal(resolveRegisteredAssessmentRoute('Expanded Disability Status Scale (EDSS)').runnerKey, 'edss');
  assert.equal(resolveRegisteredAssessmentRoute('International Physical Activity Questionnaire – Short Form (IPAQ-SF)').runnerKey, 'ipaq');
  assert.equal(resolveRegisteredAssessmentRoute('Timed Up and Down Stairs (TUDS)').runnerKey, 'tuds');
});

test('protocol-distinct routes do not share an accidental scorer selection', () => {
  assert.equal(resolveRegisteredAssessmentRoute('Heart Rate Recovery (HRR) – 1 and 2 Minutes').runnerKey, 'heart-rate-recovery');
  assert.equal(resolveRegisteredAssessmentRoute('Åstrand-Rhyming Cycle Test').runnerKey, 'astrand');
  assert.equal(resolveRegisteredAssessmentRoute('Åstrand-Rhyming Step Test').runnerKey, 'astrand_rhyming_step');
  assert.deepEqual(
    { ...resolveRegisteredAssessmentRoute({ canonical_id: 'assessment:ep-import:6876d96437f326610e5253c6' }) },
    {
      canonicalId: 'assessment:ep-import:6876d96437f326610e5253c6',
      name: 'Oxygen Saturation (SpO2) Pre/Post Exercise',
      host: 'extras',
      runnerKey: 'spo2-exercise',
      scoringKey: 'spo2-exercise',
    },
  );
  assert.deepEqual(
    { ...resolveRegisteredAssessmentRoute({ canonical_id: 'assessment:ep-import:6933ca483ef96a9f8b810bba' }) },
    {
      canonicalId: 'assessment:ep-import:6933ca483ef96a9f8b810bba',
      name: 'Resting Oxygen Saturation (SpO2)',
      host: 'extras',
      runnerKey: 'spo2-resting',
      scoringKey: 'spo2-resting',
    },
  );
  assert.notEqual(
    resolveRegisteredAssessmentRoute('Oxygen Saturation (SpO2) Pre/Post Exercise').scoringKey,
    resolveRegisteredAssessmentRoute('Resting Oxygen Saturation (SpO2)').scoringKey,
  );
});

test('router hosts contain no assessment-name substring detector or accidental fallback', () => {
  const routerSource = fs.readFileSync(
    new URL('../../src/components/assessments/AssessmentTestRunnerRouter.jsx', import.meta.url),
    'utf8',
  );
  const extrasSource = fs.readFileSync(
    new URL('../../src/components/assessments/TestRunnerExtras.jsx', import.meta.url),
    'utf8',
  );
  const testRunnerSource = fs.readFileSync(
    new URL('../../src/components/assessments/TestRunner.jsx', import.meta.url),
    'utf8',
  );

  assert.match(routerSource, /resolveRegisteredAssessmentRoute\(assessment\)/);
  assert.doesNotMatch(routerSource, /assessmentName|canHandleAssessment|testRunnerOnly|Default generic test runner/);
  assert.doesNotMatch(extrasSource, /detectAssessmentRunner|const n = name\.toLowerCase\(\)/);
  assert.match(extrasSource, /const testType = runnerKey/);
  assert.doesNotMatch(testRunnerSource, /assessment\.name[^\n]*\.includes\(/);
  assert.match(testRunnerSource, /const activeRunnerKey = runnerKey/);
});

test('every Extras route key has an implemented switch branch', () => {
  const extrasSource = fs.readFileSync(
    new URL('../../src/components/assessments/TestRunnerExtras.jsx', import.meta.url),
    'utf8',
  );
  const implemented = new Set(
    [...extrasSource.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)].map((match) => match[1]),
  );
  const missing = ASSESSMENT_RUNNER_REGISTRY
    .filter(({ host }) => host === 'extras')
    .filter(({ runnerKey }) => !implemented.has(runnerKey))
    .map(({ name, runnerKey }) => `${runnerKey}: ${name}`);
  assert.deepEqual(missing, []);
});

test('zero is a reportable result value', () => {
  assert.equal(hasAssessmentResultValue(0), true);
  assert.equal(hasAssessmentResultValue('0'), true);
  assert.equal(hasAssessmentResultValue(-1), true);
  assert.equal(hasAssessmentResultValue(null), false);
  assert.equal(hasAssessmentResultValue(undefined), false);
  assert.equal(hasAssessmentResultValue(''), false);
});

test('QuestionnaireRunner radio groups are controlled from first render', () => {
  const source = fs.readFileSync(
    new URL('../../src/components/assessments/QuestionnaireRunner.jsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /responses\[index\].*\? '' : String\(responses\[index\]\)/);
  assert.match(source, /selectedOptions\[index\].*\? '' : String\(selectedOptions\[index\]\)/);
  assert.doesNotMatch(source, /value=\{responses\[index\]\?\.toString\(\)\}/);
  assert.doesNotMatch(source, /value=\{selectedOptions\[index\]\?\.toString\(\)\}/);
});
