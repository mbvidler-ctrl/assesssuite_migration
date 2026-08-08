import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ASSESSMENT_DISCOVERY_MAX_RESULTS,
  ASSESSMENT_DISCOVERY_STATUS,
  assessmentDiscoveryStatusMessage,
  discoverAssessments,
} from '../../src/lib/clinical/assessmentDiscovery.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

function syntheticAssessment(index, overrides = {}) {
  return {
    id: `synthetic-${String(index).padStart(5, '0')}`,
    name: `Synthetic Knee Measure ${String(index).padStart(5, '0')}`,
    category: 'musculoskeletal',
    description: `Synthetic assessment ${index}. ` + 'Purpose-built catalogue description. '.repeat(6),
    conditions_indicated: ['knee_osteoarthritis'],
    search_tags: ['knee', 'osteoarthritis', 'function'],
    ...overrides,
  };
}

test('regression: a 232-row catalogue exceeds the legacy admission size while deterministic discovery stays bounded', () => {
  const catalogue = Array.from({ length: 232 }, (_, index) => syntheticAssessment(index, {
    conditions_indicated: index < 107 ? ['knee_osteoarthritis'] : [],
    search_tags: index < 107 ? ['knee_osteoarthritis'] : [],
  }));
  const conditions = [{ name: 'Knee Osteoarthritis' }];

  // Reproduce both defects without invoking a provider: the former component
  // serialized this full projection into one prompt, then its exact lowercase
  // fallback failed to equate spaces with catalogue underscores.
  const legacyProjection = catalogue.map((assessment) => ({
    id: assessment.id,
    name: assessment.name,
    category: assessment.category,
    description: assessment.description.substring(0, 150),
    conditions_indicated: assessment.conditions_indicated,
  }));
  const legacyPrompt = `Client Conditions:\n${JSON.stringify(conditions, null, 2)}\nAvailable Assessments:\n${JSON.stringify(legacyProjection, null, 2)}`;
  const legacyConditionNames = new Set(conditions.map((condition) => condition.name.toLowerCase()));
  const legacyExactMatches = catalogue.filter((assessment) => assessment.conditions_indicated
    .some((indicated) => legacyConditionNames.has(indicated.toLowerCase())));

  assert.ok(Buffer.byteLength(legacyPrompt, 'utf8') > 32_000);
  assert.equal(catalogue.filter((assessment) => assessment.conditions_indicated.length === 0).length, 125);
  assert.equal(legacyExactMatches.length, 0);

  const result = discoverAssessments({ conditions, assessments: catalogue, limit: 500 });
  assert.equal(result.status, ASSESSMENT_DISCOVERY_STATUS.READY);
  assert.equal(result.matchCount, 107);
  assert.equal(result.recommendations.length, ASSESSMENT_DISCOVERY_MAX_RESULTS);
  assert.ok(result.recommendations.every((assessment) => assessment.reason.includes('Knee Osteoarthritis')));
});

test('normalises equivalent punctuation, spelling and catalogue fields without inventing evidence', () => {
  const catalogue = [
    {
      id: 'bp-indication',
      name: 'Synthetic Blood Pressure Measure',
      conditions_indicated: ['high_blood_pressure'],
    },
    {
      id: 'copd-tag',
      name: 'Synthetic Respiratory Measure',
      search_tags: ['chronic_obstructive_pulmonary_disease'],
    },
    {
      id: 'cholesterol-description',
      name: 'Synthetic Lipid Measure',
      description: 'A synthetic measure used for dyslipidemia review.',
    },
    {
      id: 'existing',
      name: 'Existing COPD Measure',
      conditions_indicated: ['COPD'],
    },
    {
      id: 'deleted',
      name: 'Deleted COPD Measure',
      conditions_indicated: ['COPD'],
      is_deleted: true,
    },
  ];

  const result = discoverAssessments({
    conditions: [
      { name: 'Hypertension / High Blood Pressure' },
      { name: 'Chronic Obstructive Pulmonary Disease' },
      { name: 'High Cholesterol / Dyslipidaemia' },
    ],
    assessments: catalogue,
    existingAssessmentIds: ['existing'],
  });

  assert.equal(result.status, ASSESSMENT_DISCOVERY_STATUS.READY);
  assert.deepEqual(
    new Set(result.recommendations.map((assessment) => assessment.id)),
    new Set(['bp-indication', 'copd-tag', 'cholesterol-description']),
  );
  assert.ok(result.recommendations.every((assessment) => assessment.match_basis.length > 0));
  assert.ok(result.recommendations.every((assessment) => !Object.hasOwn(assessment, 'confidence')));
});

test('large catalogue ordering is stable and every caller is constrained by the hard cap', () => {
  const catalogue = Array.from({ length: 4_000 }, (_, index) => syntheticAssessment(index));
  const input = { conditions: [{ name: 'knee osteoarthritis' }], assessments: catalogue, limit: 10_000 };

  const first = discoverAssessments(input);
  const second = discoverAssessments(input);
  const firstFive = discoverAssessments({ ...input, limit: 5 });

  assert.equal(first.recommendations.length, 25);
  assert.deepEqual(first, second);
  assert.deepEqual(
    firstFive.recommendations.map((assessment) => assessment.id),
    first.recommendations.slice(0, 5).map((assessment) => assessment.id),
  );
});

test('empty, unavailable, unsupported, exhausted and unmatched states are explicit', () => {
  const conditions = [{ name: 'synthetic condition' }];
  const cases = [
    discoverAssessments({ conditions: [], assessments: [syntheticAssessment(1)] }),
    discoverAssessments({ conditions, assessments: null }),
    discoverAssessments({ conditions, assessments: [] }),
    discoverAssessments({ conditions, assessments: [{ id: 'metadata-missing' }] }),
    discoverAssessments({
      conditions,
      assessments: [{ id: 'already-recorded', name: 'Synthetic Condition Measure' }],
      existingAssessmentIds: ['already-recorded'],
    }),
    discoverAssessments({
      conditions,
      assessments: [{ id: 'unmatched', name: 'Unrelated Balance Measure' }],
    }),
  ];
  const expected = [
    ASSESSMENT_DISCOVERY_STATUS.NO_CONDITIONS,
    ASSESSMENT_DISCOVERY_STATUS.CATALOGUE_UNAVAILABLE,
    ASSESSMENT_DISCOVERY_STATUS.EMPTY_CATALOGUE,
    ASSESSMENT_DISCOVERY_STATUS.UNSUPPORTED_CATALOGUE,
    ASSESSMENT_DISCOVERY_STATUS.NO_AVAILABLE_ASSESSMENTS,
    ASSESSMENT_DISCOVERY_STATUS.NO_MATCHES,
  ];

  assert.deepEqual(cases.map((result) => result.status), expected);
  for (const result of cases) {
    assert.deepEqual(result.recommendations, []);
    assert.ok(assessmentDiscoveryStatusMessage(result.status).length > 20, result.status);
  }
});

test('the component has one deterministic path and cannot send a catalogue to InvokeLLM', () => {
  const component = fs.readFileSync(
    path.join(repoRoot, 'src/components/client/AssessmentRecommendations.jsx'),
    'utf8',
  );

  assert.match(component, /discoverAssessments\(/);
  assert.match(component, /assessmentDiscoveryStatusMessage\(discovery\.status\)/);
  assert.match(component, /They are not AI-generated/);
  assert.doesNotMatch(component, /InvokeLLM|useAiCapability|fallbackToBasicMatching|JSON\.stringify/);
  assert.equal((component.match(/discoverAssessments\(/g) || []).length, 1);
});
