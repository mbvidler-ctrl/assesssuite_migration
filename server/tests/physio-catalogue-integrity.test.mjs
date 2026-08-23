import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  buildPhysioCatalogueManifest,
  contentSha256,
  PHYSIO_CATALOGUE_IDENTITY_PINS,
  PHYSIO_CATALOGUE_MANIFEST_PATH,
  PHYSIO_CATALOGUE_SEED_PATH,
} from '../catalogue/physio-catalogue.mjs';
import {
  normalisedFileSha256,
  normalisedSourceSha256,
} from '../catalogue/normalised-source-hash.mjs';
import {
  checkPhysioCatalogueArtifacts,
  validatePhysioCatalogueManifest,
} from '../catalogue/generate-physio-catalogue.mjs';

const legacyPhysioPath = new URL(
  '../data-import/physiotherapy-outcome-measures-part-0.jsonl',
  import.meta.url,
);

test('Physio catalogue preserves all 255 original sources, adds six maintained sources, and resolves to exactly 236 semantic canonicals', () => {
  const manifest = buildPhysioCatalogueManifest();
  const summary = validatePhysioCatalogueManifest(manifest);

  assert.deepEqual(manifest.counts, {
    epImportDefinitions: 229,
    epSyntheticDefinitions: 4,
    epRuntimeDefinitions: 232,
    physioLegacyDefinitions: 23,
    originalSourceCrosswalkEntries: 255,
    componentSourceDefinitions: 6,
    sourceCrosswalkEntries: 261,
    epSemanticDuplicates: 6,
    canonicalAssessments: 236,
    legacyPhysioAdditions: 4,
    componentPhysioAdditions: 6,
    physioAdditions: 10,
    shadowedEpImports: 1,
  });
  assert.equal(summary.sourceCrosswalkEntries, 261);
  assert.equal(summary.canonicalAssessments, 236);
  assert.equal(new Set(manifest.sources.map(({ sourceRef }) => sourceRef)).size, 261);
  assert.equal(new Set(manifest.canonicalAssessments.map(({ canonicalId }) => canonicalId)).size, 236);
  assert.equal(manifest.originalSourceDeduplicationMap.length, 255);
  assert.equal(new Set(manifest.originalSourceDeduplicationMap.map(({ sourceRef }) => sourceRef)).size, 255);
  assert.equal(new Set(manifest.originalSourceDeduplicationMap.map(({ canonicalId }) => canonicalId)).size, 230);
  assert.equal(manifest.deduplicationMap.length, 261);
  assert.equal(new Set(manifest.deduplicationMap.map(({ sourceRef }) => sourceRef)).size, 261);
  assert.equal(new Set(manifest.deduplicationMap.map(({ canonicalId }) => canonicalId)).size, 236);

  for (const source of manifest.sources) {
    assert.equal(contentSha256(source.sourceContent), source.contentSha256, source.sourceRef);
    const canonical = manifest.canonicalAssessments.find(({ canonicalId }) => canonicalId === source.canonicalId);
    assert.ok(canonical, source.canonicalId);
    assert.ok(canonical.sourceRefs.includes(source.sourceRef), source.sourceRef);
  }
});

test('registry stability preserves all 232 EP source identities, reconciles six duplicates and declares ten additive Physio IDs', () => {
  const manifest = buildPhysioCatalogueManifest();
  const stability = manifest.registryStability;
  assert.equal(stability.originalEpSourceRefs.length, 232);
  assert.equal(new Set(stability.originalEpSourceRefs).size, 232);
  assert.equal(stability.retainedEpCanonicalIds.length, 226);
  assert.equal(new Set(stability.retainedEpCanonicalIds).size, 226);
  assert.equal(stability.additivePhysioCanonicalIds.length, 10);
  assert.equal(new Set(stability.additivePhysioCanonicalIds).size, 10);
  assert.deepEqual(stability.removedOriginalSourceRefs, []);
  assert.deepEqual(stability.undeclaredCanonicalIds, []);
  assert.equal(
    stability.originalEpSourceRefsSha256,
    PHYSIO_CATALOGUE_IDENTITY_PINS.originalEpSourceRefsSha256,
  );
  assert.equal(
    stability.retainedEpCanonicalIdsSha256,
    PHYSIO_CATALOGUE_IDENTITY_PINS.retainedEpCanonicalIdsSha256,
  );
  assert.equal(
    stability.additivePhysioCanonicalIdsSha256,
    PHYSIO_CATALOGUE_IDENTITY_PINS.additivePhysioCanonicalIdsSha256,
  );
  assert.equal(
    manifest.deduplicationMapDigestSha256,
    PHYSIO_CATALOGUE_IDENTITY_PINS.deduplicationMapSha256,
  );
  assert.equal(
    manifest.sourceDigestSha256,
    PHYSIO_CATALOGUE_IDENTITY_PINS.sourceContentSha256,
  );
  assert.equal(
    manifest.canonicalDigestSha256,
    PHYSIO_CATALOGUE_IDENTITY_PINS.canonicalContentSha256,
  );
  assert.equal(
    new Set([
      ...stability.retainedEpCanonicalIds,
      ...stability.additivePhysioCanonicalIds,
    ]).size,
    236,
  );
  const canonicalIds = new Set(manifest.canonicalAssessments.map(({ canonicalId }) => canonicalId));
  for (const canonicalId of stability.retainedEpCanonicalIds) assert.ok(canonicalIds.has(canonicalId));
  for (const canonicalId of stability.additivePhysioCanonicalIds) assert.ok(canonicalIds.has(canonicalId));
});

test('six declared EP duplicate sources are retained as checksummed variants of richer semantic canonicals', () => {
  const manifest = buildPhysioCatalogueManifest();
  assert.equal(manifest.semanticReconciliation.length, 6);
  assert.equal(new Set(manifest.semanticReconciliation.map(({ sourceRef }) => sourceRef)).size, 6);
  assert.equal(new Set(manifest.semanticReconciliation.map(({ targetSourceRef }) => targetSourceRef)).size, 5);

  for (const row of manifest.semanticReconciliation) {
    assert.match(row.rationale, /\S/);
    const source = manifest.sources.find(({ sourceRef }) => sourceRef === row.sourceRef);
    const target = manifest.sources.find(({ sourceRef }) => sourceRef === row.targetSourceRef);
    assert.ok(source, row.sourceRef);
    assert.ok(target, row.targetSourceRef);
    assert.equal(source.relationship, 'same-instrument-ep-duplicate');
    assert.equal(source.canonicalId, target.canonicalId);
    assert.equal(source.semanticRationale, row.rationale);
    const canonical = manifest.canonicalAssessments.find(({ canonicalId }) => canonicalId === target.canonicalId);
    assert.equal(canonical.primarySourceRef, row.targetSourceRef);
    const variant = canonical.content.source_variants.find(({ source_ref }) => source_ref === row.sourceRef);
    assert.ok(variant, row.sourceRef);
    assert.equal(variant.relationship, 'same-instrument-ep-duplicate');
    assert.equal(variant.semantic_rationale, row.rationale);
    assert.equal(variant.content_sha256, source.contentSha256);
    assert.deepEqual(variant.source_content, source.sourceContent);
  }
});

test('six maintained-component additions are explicit new sources with complete runner specs and implementation checksums', () => {
  const manifest = buildPhysioCatalogueManifest();
  const sources = manifest.sources.filter(({ sourceSet }) => sourceSet === 'physio-maintained-component');
  assert.equal(sources.length, 6);
  assert.deepEqual(
    sources.map(({ sourceName }) => sourceName).sort(),
    [
      'Air Displacement Plethysmography (BOD POD)',
      'Balance Error Scoring System (BESS)',
      'Edmonton Frail Scale (EFS)',
      'Expanded Disability Status Scale (EDSS)',
      'International Physical Activity Questionnaire – Short Form (IPAQ-SF)',
      'Timed Up and Down Stairs (TUDS)',
    ],
  );
  for (const source of sources) {
    assert.equal(source.relationship, 'physio-component-addition');
    assert.match(source.implementationFile, /^src\/components\/assessments\/.+Runner\.jsx$/);
    assert.match(source.implementationSha256, /^[a-f0-9]{64}$/);
    const canonical = manifest.canonicalAssessments.find(({ canonicalId }) => canonicalId === source.canonicalId);
    assert.ok(canonical, source.canonicalId);
    assert.equal(canonical.primarySourceRef, source.sourceRef);
    assert.equal(canonical.content.runner_spec.runnerKey, source.runnerKey);
    assert.equal(canonical.content.runner_spec.scoringKey, source.scoringKey);
    assert.equal(canonical.content.runner_spec.implementation.component_file, source.implementationFile);
    assert.equal(canonical.content.runner_spec.implementation.component_sha256, source.implementationSha256);
    assert.ok(canonical.content.runner_spec.fields.length > 0);
    if (canonical.content.runner_spec.kind === 'questionnaire') {
      assert.ok(canonical.content.runner_spec.items.length > 0);
      assert.equal(canonical.content.questions.length, canonical.content.runner_spec.items.length);
      for (const [index, item] of canonical.content.runner_spec.items.entries()) {
        const question = canonical.content.questions[index];
        assert.equal(question.key, item.key);
        assert.equal(question.question_text, item.prompt);
        assert.equal(question.question_type, item.type);
        assert.equal(question.required, item.required);
        assert.deepEqual(question.options, item.options);
      }
    }
  }
});

test('implementation checksums are invariant to checkout line endings and match every bound source file', () => {
  const lf = 'export const assessment = true;\n';
  const crlf = '\uFEFFexport const assessment = true;\r\n';
  assert.equal(normalisedSourceSha256(lf), normalisedSourceSha256(crlf));

  const manifest = buildPhysioCatalogueManifest();
  for (const source of manifest.sources.filter(({ sourceSet }) => sourceSet === 'physio-maintained-component')) {
    assert.equal(
      source.implementationSha256,
      normalisedFileSha256(path.resolve(source.implementationFile)),
      source.sourceRef,
    );
  }

  for (const canonical of manifest.canonicalAssessments) {
    const implementation = canonical.content.runner_spec?.implementation;
    assert.ok(implementation, canonical.canonicalId);
    assert.equal(
      implementation.component_sha256,
      normalisedFileSha256(path.resolve(implementation.component_file)),
      `${canonical.canonicalId} component`,
    );
    assert.equal(
      implementation.scorer_sha256,
      normalisedFileSha256(path.resolve(implementation.scorer_file)),
      `${canonical.canonicalId} scorer`,
    );
  }
});

test('legacy Physio source is vendored byte-for-byte and all recorded labels remain intact', () => {
  const raw = fs.readFileSync(legacyPhysioPath);
  assert.equal(
    crypto.createHash('sha256').update(raw).digest('hex'),
    'aeb2ca0d4f11b71376c56e9ce709eb9f628b6e2f98071d8e6de43e00a8769879',
  );

  const manifest = buildPhysioCatalogueManifest();
  const physioSources = manifest.sources.filter(({ sourceSet }) => sourceSet === 'physio-legacy');
  const rightsCounts = Object.groupBy(
    physioSources,
    ({ sourceContent }) => sourceContent.rights.status,
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(rightsCounts).map(([key, values]) => [key, values.length])),
    {
      'public-domain': 9,
      'free-for-clinical-use': 2,
      'paid-licence': 5,
      'permission-required': 2,
      'requires-verification': 5,
    },
  );
  assert.equal(physioSources.filter(({ sourceContent }) => sourceContent.rights.itemTextIncluded).length, 9);
  assert.equal(physioSources.filter(({ sourceContent }) => !sourceContent.rights.itemTextIncluded).length, 14);
});

test('19 Physio sources crosswalk and four additive sources become canonical records', () => {
  const manifest = buildPhysioCatalogueManifest();
  const physioSources = manifest.sources.filter(({ sourceSet }) => sourceSet === 'physio-legacy');
  assert.equal(physioSources.filter(({ relationship }) => relationship === 'same-instrument').length, 19);
  assert.deepEqual(
    physioSources
      .filter(({ relationship }) => relationship === 'physio-addition')
      .map(({ sourceName }) => sourceName)
      .sort(),
    [
      'Neurological Screening Examination',
      'Orebro Musculoskeletal Pain Screening Questionnaire',
      'QuickDASH',
      'STarT Back Screening Tool',
    ],
  );

  const canonicalVariants = manifest.canonicalAssessments.flatMap(({ content }) => (
    content.source_variants.filter(({ relationship }) => relationship === 'same-instrument')
  ));
  assert.equal(canonicalVariants.length, 19);
  assert.equal(new Set(canonicalVariants.map(({ source_ref }) => source_ref)).size, 19);
  for (const variant of canonicalVariants) {
    assert.equal(contentSha256(variant.source_content), variant.content_sha256, variant.source_ref);
    const source = physioSources.find(({ sourceRef }) => sourceRef === variant.source_ref);
    assert.ok(source, variant.source_ref);
    assert.deepEqual(variant.source_content, source.sourceContent);
  }

  for (const source of physioSources.filter(({ relationship }) => relationship === 'same-instrument')) {
    const canonical = manifest.canonicalAssessments.find(({ canonicalId }) => canonicalId === source.canonicalId);
    if (source.sourceName !== canonical.name) {
      assert.ok(canonical.content.aliases.includes(source.sourceName), source.sourceName);
      assert.ok(canonical.content.search_tags.includes(source.sourceName), source.sourceName);
    }
  }
});

test('the shadowed EP DASS-21 import remains losslessly related to the runtime synthetic definition', () => {
  const manifest = buildPhysioCatalogueManifest();
  assert.equal(manifest.shadowedEpImportSources.length, 1);
  const [shadowed] = manifest.shadowedEpImportSources;
  assert.equal(shadowed.sourceName, 'DASS-21');
  assert.equal(shadowed.sourceContent.questions.length, 21);
  assert.equal(contentSha256(shadowed.sourceContent), shadowed.contentSha256);

  const runtime = manifest.sources.find(({ sourceRef }) => sourceRef === shadowed.shadowedBySourceRef);
  assert.ok(runtime);
  assert.equal(runtime.sourceName, 'DASS-21');
  assert.equal(runtime.canonicalId, shadowed.canonicalId);

  const canonical = manifest.canonicalAssessments.find(({ canonicalId }) => canonicalId === shadowed.canonicalId);
  assert.equal(canonical.content.questions.length, 21);
  const preservedShadow = canonical.content.source_variants.find(({ source_ref }) => source_ref === shadowed.sourceRef);
  assert.ok(preservedShadow);
  assert.equal(preservedShadow.relationship, 'shadowed-runtime-source');
  assert.equal(preservedShadow.content_sha256, shadowed.contentSha256);
  assert.deepEqual(preservedShadow.source_content, shadowed.sourceContent);
});

test('repaired TSK, 10RM and BIA runtime specs are embedded without abridging their source rows', () => {
  const manifest = buildPhysioCatalogueManifest();
  const byId = new Map(manifest.canonicalAssessments.map((assessment) => [assessment.canonicalId, assessment]));
  const tsk = byId.get('assessment:ep-import:691eb419ae95315ff3bad4fa');
  const tenRm = byId.get('assessment:ep-import:6933cc3f697c55fe37e0bc21');
  const bia = byId.get('assessment:ep-import:6933d97ed8d7afa0d779cc81');

  assert.equal(tsk.content.questions.length, 17);
  assert.equal(tsk.content.runner_spec.items.length, 17);
  assert.deepEqual(
    tsk.content.questions.map(({ question_text }) => question_text),
    tsk.content.runner_spec.items.map(({ prompt }) => prompt),
  );
  assert.deepEqual(
    tsk.content.questions.map(({ options }) => options),
    tsk.content.runner_spec.items.map(({ options }) => options),
  );
  assert.equal(tsk.content.runner_spec.scoringKey, 'tsk-17');

  for (const canonical of [tsk, tenRm, bia]) {
    assert.ok(canonical.content.runner_spec.implementation.component_file);
    assert.match(canonical.content.runner_spec.implementation.component_sha256, /^[a-f0-9]{64}$/);
    assert.ok(canonical.content.runner_spec.implementation.scorer_file);
    assert.match(canonical.content.runner_spec.implementation.scorer_sha256, /^[a-f0-9]{64}$/);
    assert.ok(canonical.sourceRefs.length > 0);
  }
  assert.equal(tenRm.content.runner_spec.scoringKey, '10rm');
  assert.equal(bia.content.runner_spec.scoringKey, 'bia');
});

test('checked-in manifest and seed JSONL exactly match deterministic generation', () => {
  const summary = checkPhysioCatalogueArtifacts();
  assert.equal(summary.sourceCrosswalkEntries, 261);
  assert.equal(summary.canonicalAssessments, 236);

  const manifest = JSON.parse(fs.readFileSync(PHYSIO_CATALOGUE_MANIFEST_PATH, 'utf8'));
  const seedRecords = fs
    .readFileSync(PHYSIO_CATALOGUE_SEED_PATH, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
  assert.equal(seedRecords.length, 236);
  assert.equal(new Set(seedRecords.map(({ name }) => name)).size, 236);
  assert.deepEqual(
    seedRecords.map(contentSha256),
    manifest.canonicalAssessments.map(({ contentSha256 }) => contentSha256),
  );
});
