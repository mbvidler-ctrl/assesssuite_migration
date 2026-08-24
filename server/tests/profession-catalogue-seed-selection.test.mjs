import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAssessmentCatalogueForProfession } from '../seed.mjs';
import { buildPhysioCatalogueManifest } from '../catalogue/physio-catalogue.mjs';

test('absent PROFESSION retains the 232-record EP runtime catalogue', () => {
  const catalogue = buildAssessmentCatalogueForProfession({});
  assert.equal(catalogue.professionId, 'exercise-physiology');
  assert.deepEqual(catalogue.prefixes, ['assessment-part']);
  assert.equal(catalogue.required, false);
  assert.equal(catalogue.syntheticCount, 4);
  assert.equal(catalogue.shadowedSyntheticCount, 0);
  assert.equal(catalogue.importedDefinitionCount, 229);
  assert.equal(catalogue.shadowedImportCount, 1);
  assert.equal(catalogue.runtimeCount, 232);
  assert.equal(new Set(catalogue.assessments.map(({ name }) => name)).size, 232);
});

test('explicit Physio selection loads only the generated 236-record Physio seed', () => {
  const catalogue = buildAssessmentCatalogueForProfession({ PROFESSION: 'physio' });
  assert.equal(catalogue.professionId, 'physio');
  assert.deepEqual(catalogue.prefixes, ['physiotherapy-assessment-part']);
  assert.equal(catalogue.required, true);
  assert.equal(catalogue.syntheticCount, 0);
  assert.equal(catalogue.shadowedSyntheticCount, 4);
  assert.equal(catalogue.importedDefinitionCount, 236);
  assert.equal(catalogue.shadowedImportCount, 0);
  assert.equal(catalogue.runtimeCount, 236);
  assert.equal(new Set(catalogue.assessments.map(({ name }) => name)).size, 236);
  const manifest = buildPhysioCatalogueManifest();
  assert.deepEqual(
    new Set(catalogue.assessments.map(({ canonical_id: canonicalId }) => canonicalId)),
    new Set(manifest.canonicalAssessments.map(({ canonicalId }) => canonicalId)),
    'the runtime seed must be exactly the generated 236-canonical identity set',
  );
  assert.ok(catalogue.assessments.some(({ name }) => name === 'QuickDASH'));
  assert.ok(catalogue.assessments.some(({ name }) => name === 'STarT Back Screening Tool'));
  assert.ok(catalogue.assessments.some(({ name }) => name === 'Orebro Musculoskeletal Pain Screening Questionnaire'));
  assert.ok(catalogue.assessments.some(({ name }) => name === 'Neurological Screening Examination'));
});

test('an explicitly unknown or mismatched profession fails closed', () => {
  assert.throws(
    () => buildAssessmentCatalogueForProfession({ PROFESSION: 'unknown-profession' }),
    /unknown profession "unknown-profession"/,
  );
  assert.throws(
    () => buildAssessmentCatalogueForProfession({ PROFESSION: 'Physiotherapy' }),
    /unknown profession "Physiotherapy"/,
  );
});
