import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  discoverAssessments,
  MAX_ASSESSMENT_RECOMMENDATIONS,
  normalizeClinicalText,
} from '../../src/lib/clinical/assessmentDiscovery.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');

function assessment(id, name, fields = {}) {
  return {
    id,
    name,
    category: 'general',
    description: 'General assessment catalogue entry.',
    conditions_indicated: [],
    search_tags: [],
    ...fields,
  };
}

test('normalisation removes case, punctuation, whitespace, hyphen and underscore differences', () => {
  assert.equal(
    normalizeClinicalText('  KNEE__Osteoarthritis -  Right / Side  '),
    'knee osteoarthritis right side',
  );
  assert.equal(normalizeClinicalText('High-BP'), 'high bp');
});

test('the full 229+ row catalogue is searched and output remains capped', () => {
  const filler = Array.from({ length: 229 }, (_, index) => assessment(
    `filler-${String(index).padStart(3, '0')}`,
    `Unrelated Measure ${index}`,
    { search_tags: ['unrelated_measure'] },
  ));
  const catalogue = [
    ...filler,
    assessment('copd-cat', 'COPD Assessment Test', { search_tags: ['COPD'] }),
    assessment('copd-ccq', 'Clinical COPD Questionnaire', { conditions_indicated: ['chronic_obstructive_pulmonary_disease'] }),
    assessment('copd-6mwt', 'Six-Minute Walk Test', { description: 'Functional capacity assessment used for people with COPD.' }),
    assessment('copd-iswt', 'Incremental Shuttle Walk Test', { search_tags: ['chronic_airflow_limitation'] }),
    assessment('copd-fvc', 'Forced Vital Capacity', { description: 'Pulmonary function monitoring in chronic obstructive lung disease.' }),
    assessment('copd-extra', 'Respiratory Symptom Measure', { conditions_indicated: ['copd'] }),
  ];

  const results = discoverAssessments({
    conditions: [{ condition_name: 'Chronic Obstructive Pulmonary Disease' }],
    assessments: catalogue,
    limit: 999,
  });

  assert.equal(catalogue.length, 235);
  assert.equal(results.length, MAX_ASSESSMENT_RECOMMENDATIONS);
  assert.ok(results.some(item => item.id === 'copd-extra'), 'a matching row after index 229 must be considered');
  assert.ok(results.every(item => /COPD|Chronic Obstructive Pulmonary Disease/i.test(item.reason)));
});

test('COPD acronym and chronic obstructive disease aliases match in both directions', () => {
  const fromAcronym = discoverAssessments({
    conditions: ['COPD'],
    assessments: [assessment('full-name', 'Respiratory Function', {
      conditions_indicated: ['chronic-obstructive_pulmonary disease'],
    })],
  });
  const fromFullName = discoverAssessments({
    conditions: ['Chronic Obstructive Pulmonary Disease'],
    assessments: [assessment('acronym', 'COPD Assessment Test')],
  });

  assert.deepEqual(fromAcronym.map(item => item.id), ['full-name']);
  assert.deepEqual(fromFullName.map(item => item.id), ['acronym']);
});

test('knee osteoarthritis favours knee-specific and general OA measures, not hip-only measures', () => {
  const results = discoverAssessments({
    conditions: [{ name: 'Osteoarthritis - Right Knee' }],
    assessments: [
      assessment('hip-oa', 'Hip Osteoarthritis Outcome Score', { conditions_indicated: ['hip_osteoarthritis'] }),
      assessment('general-oa', 'Arthritis Impact Measure', { conditions_indicated: ['osteoarthritis'] }),
      assessment('knee-oa', 'Knee Injury and Osteoarthritis Outcome Score', { conditions_indicated: ['knee-osteoarthritis'] }),
    ],
  });

  assert.equal(results[0]?.id, 'knee-oa');
  assert.ok(results.some(item => item.id === 'general-oa'));
  assert.ok(!results.some(item => item.id === 'hip-oa'));
  assert.match(results[0].reason, /Osteoarthritis - Right Knee/);
});

test('dyslipidaemia and cholesterol aliases match lipid catalogue tags', () => {
  const results = discoverAssessments({
    conditions: ['High Cholesterol / Dyslipidaemia'],
    assessments: [
      assessment('lipids', 'Fasting Lipid Profile', { search_tags: ['lipid_profile'] }),
      assessment('unrelated', 'Grip Strength'),
    ],
  });

  assert.deepEqual(results.map(item => item.id), ['lipids']);
  assert.match(results[0].reason, /dyslipidaemia|cholesterol/i);
});

test('generic hypertension ranks resting blood pressure and rejects qualified pulmonary hypertension', () => {
  const results = discoverAssessments({
    conditions: ['Hypertension / High Blood Pressure'],
    assessments: [
      assessment('pulmonary-htn', 'Pulmonary Hypertension Functional Class', {
        conditions_indicated: ['pulmonary_hypertension'],
        search_tags: ['pulmonary-hypertension'],
      }),
      assessment('resting-bp', 'Resting Blood Pressure', {
        search_tags: ['blood_pressure'],
      }),
    ],
  });

  assert.equal(results[0]?.id, 'resting-bp');
  assert.ok(!results.some(item => item.id === 'pulmonary-htn'));
});

test('ranking is deterministic when catalogue order changes', () => {
  const catalogue = [
    assessment('charlie', 'Charlie COPD Measure', { conditions_indicated: ['copd'] }),
    assessment('alpha', 'Alpha COPD Measure', { conditions_indicated: ['copd'] }),
    assessment('bravo', 'Bravo COPD Measure', { conditions_indicated: ['copd'] }),
    assessment('echo', 'Echo COPD Measure', { conditions_indicated: ['copd'] }),
    assessment('delta', 'Delta COPD Measure', { conditions_indicated: ['copd'] }),
    assessment('foxtrot', 'Foxtrot COPD Measure', { conditions_indicated: ['copd'] }),
  ];

  const forward = discoverAssessments({ conditions: ['COPD'], assessments: catalogue });
  const reverse = discoverAssessments({ conditions: ['COPD'], assessments: [...catalogue].reverse() });

  assert.deepEqual(forward, reverse);
  assert.deepEqual(forward.map(item => item.id), ['alpha', 'bravo', 'charlie', 'delta', 'echo']);
});

test('already-added assessments are excluded across string and numeric id representations', () => {
  const results = discoverAssessments({
    conditions: ['COPD'],
    assessments: [
      assessment(42, 'Already Added COPD Measure', { conditions_indicated: ['copd'] }),
      assessment('available', 'Available COPD Measure', { conditions_indicated: ['copd'] }),
    ],
    existingAssessmentIds: [{ assessment_id: '42' }],
  });

  assert.deepEqual(results.map(item => item.id), ['available']);
});

test('component uses local discovery, bounded AI context and explicit operational states', () => {
  const source = fs.readFileSync(
    path.join(repoRoot, 'src/components/client/AssessmentRecommendations.jsx'),
    'utf8',
  );

  assert.match(source, /discoverAssessments\(\{/);
  assert.match(source, /slice\(0, MAX_ASSESSMENT_RECOMMENDATIONS\)/);
  assert.match(source, /selected_candidates: candidates/);
  assert.doesNotMatch(source, /Available Assessments:/);
  assert.doesNotMatch(source, /JSON\.stringify\([^\n]*allAssessments/);
  assert.match(source, /Loading the assessment catalogue/);
  assert.match(source, /No unused assessments in the catalogue matched/);
  assert.match(source, /temporarily unavailable/);
  assert.match(source, /onClick=\{\(\) => handleAddAssessment\(assessment\)\}/);
});
