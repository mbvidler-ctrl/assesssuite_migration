import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  buildPhysioCatalogueManifest,
  contentSha256,
  PHYSIO_CATALOGUE_EXPECTATIONS,
  PHYSIO_CATALOGUE_IDENTITY_PINS,
  PHYSIO_CATALOGUE_MANIFEST_PATH,
  PHYSIO_CATALOGUE_SEED_PATH,
  serializePhysioCatalogueManifest,
  serializePhysioCatalogueSeed,
} from './physio-catalogue.mjs';

function invariant(condition, message) {
  if (!condition) throw new Error(`Physio catalogue validation failed: ${message}`);
}

function readRequiredFile(filePath) {
  invariant(fs.existsSync(filePath), `generated file is missing: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

export function validatePhysioCatalogueManifest(manifest) {
  const { counts, expectations } = manifest;
  invariant(expectations.originalSourceCrosswalkEntries === 255, 'original acceptance denominator must remain 255');
  invariant(expectations.sourceCrosswalkEntries === 261, 'full source denominator must remain 261');
  invariant(counts.epRuntimeDefinitions === 232, 'EP runtime denominator must remain 232');
  invariant(counts.physioLegacyDefinitions === 23, 'legacy Physio denominator must remain 23');
  invariant(counts.originalSourceCrosswalkEntries === expectations.originalSourceCrosswalkEntries, 'original 255-source crosswalk is incomplete');
  invariant(counts.sourceCrosswalkEntries === expectations.sourceCrosswalkEntries, 'crosswalk is incomplete');
  invariant(counts.epSemanticDuplicates === expectations.epSemanticDuplicates, 'semantic duplicate declaration count drifted');
  invariant(counts.componentSourceDefinitions === expectations.componentSourceDefinitions, 'component-source definition count drifted');
  invariant(
    JSON.stringify(manifest.identityPins) === JSON.stringify(PHYSIO_CATALOGUE_IDENTITY_PINS),
    'published identity pins do not match the code-level acceptance pins',
  );
  invariant(
    counts.canonicalAssessments === expectations.canonicalAssessments,
    `canonical count ${counts.canonicalAssessments} must equal ${expectations.canonicalAssessments}`,
  );

  const sourceRefs = new Set();
  const canonicalIds = new Set();
  const sourceByRef = new Map();
  const canonicalById = new Map();

  for (const source of manifest.sources) {
    invariant(!sourceRefs.has(source.sourceRef), `duplicate sourceRef ${source.sourceRef}`);
    sourceRefs.add(source.sourceRef);
    sourceByRef.set(source.sourceRef, source);
    invariant(source.sourceContent && typeof source.sourceContent === 'object', `${source.sourceRef} has no full source content`);
    invariant(
      contentSha256(source.sourceContent) === source.contentSha256,
      `${source.sourceRef} content checksum does not match`,
    );
  }

  for (const canonical of manifest.canonicalAssessments) {
    invariant(!canonicalIds.has(canonical.canonicalId), `duplicate canonicalId ${canonical.canonicalId}`);
    canonicalIds.add(canonical.canonicalId);
    canonicalById.set(canonical.canonicalId, canonical);
    invariant(canonical.content && typeof canonical.content === 'object', `${canonical.canonicalId} has no canonical content`);
    invariant(
      contentSha256(canonical.content) === canonical.contentSha256,
      `${canonical.canonicalId} content checksum does not match`,
    );
    invariant(canonical.sourceRefs.length > 0, `${canonical.canonicalId} has no source relationship`);
  }

  for (const source of manifest.sources) {
    const canonical = canonicalById.get(source.canonicalId);
    invariant(canonical, `${source.sourceRef} points to missing ${source.canonicalId}`);
    invariant(
      canonical.sourceRefs.includes(source.sourceRef),
      `${source.sourceRef} is missing from ${source.canonicalId}.sourceRefs`,
    );
  }

  for (const canonical of manifest.canonicalAssessments) {
    for (const sourceRef of canonical.sourceRefs) {
      const source = sourceByRef.get(sourceRef);
      invariant(source, `${canonical.canonicalId} points to missing ${sourceRef}`);
      invariant(
        source.canonicalId === canonical.canonicalId,
        `${canonical.canonicalId} and ${sourceRef} disagree on relationship`,
      );
    }
  }

  for (const shadowed of manifest.shadowedEpImportSources) {
    invariant(shadowed.sourceContent && typeof shadowed.sourceContent === 'object', `${shadowed.sourceRef} shadow content is absent`);
    invariant(
      contentSha256(shadowed.sourceContent) === shadowed.contentSha256,
      `${shadowed.sourceRef} shadow checksum does not match`,
    );
    invariant(sourceByRef.has(shadowed.shadowedBySourceRef), `${shadowed.sourceRef} shadow target is absent`);
    invariant(canonicalById.has(shadowed.canonicalId), `${shadowed.sourceRef} canonical target is absent`);
  }

  invariant(
    contentSha256(manifest.sources) === manifest.sourceDigestSha256,
    'aggregate source digest does not match',
  );
  invariant(
    contentSha256(manifest.canonicalAssessments) === manifest.canonicalDigestSha256,
    'aggregate canonical digest does not match',
  );
  invariant(
    contentSha256(manifest.deduplicationMap) === manifest.deduplicationMapDigestSha256,
    'deduplication map digest does not match',
  );
  invariant(
    contentSha256(manifest.originalSourceDeduplicationMap) === manifest.originalDeduplicationMapDigestSha256,
    'original deduplication map digest does not match',
  );
  const originalSourceRefs = manifest.originalSourceDeduplicationMap.map(({ sourceRef }) => sourceRef).sort();
  const originalSources = originalSourceRefs.map((sourceRef) => sourceByRef.get(sourceRef));
  invariant(originalSources.every(Boolean), 'original deduplication map points to an absent source');
  invariant(
    contentSha256(originalSourceRefs) === manifest.originalAcceptanceSourceRefsSha256,
    'original accepted source-ref digest does not match',
  );
  invariant(
    contentSha256(manifest.sources.map(({ sourceRef }) => sourceRef).sort()) === manifest.allSourceRefsSha256,
    'full source-ref digest does not match',
  );
  invariant(
    contentSha256(originalSources
      .map(({ sourceRef, contentSha256: sourceContentSha256 }) => ({ sourceRef, contentSha256: sourceContentSha256 }))
      .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef))) === manifest.originalSourceContentSha256,
    'original source-content digest does not match',
  );
  const componentSources = manifest.sources.filter(({ sourceSet }) => sourceSet === 'physio-maintained-component');
  invariant(
    contentSha256(componentSources
      .map(({ sourceRef, implementationFile, implementationSha256 }) => ({ sourceRef, implementationFile, implementationSha256 }))
      .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef))) === manifest.componentImplementationSha256,
    'component implementation digest does not match',
  );
  invariant(manifest.originalAcceptanceSourceRefsSha256 === PHYSIO_CATALOGUE_IDENTITY_PINS.originalAcceptanceSourceRefsSha256, 'original accepted source identities are not pinned');
  invariant(manifest.allSourceRefsSha256 === PHYSIO_CATALOGUE_IDENTITY_PINS.allSourceRefsSha256, 'full source identities are not pinned');
  invariant(manifest.originalSourceContentSha256 === PHYSIO_CATALOGUE_IDENTITY_PINS.originalSourceContentSha256, 'original source content is not pinned');
  invariant(manifest.sourceDigestSha256 === PHYSIO_CATALOGUE_IDENTITY_PINS.sourceContentSha256, 'source content is not pinned');
  invariant(manifest.componentImplementationSha256 === PHYSIO_CATALOGUE_IDENTITY_PINS.componentImplementationSha256, 'component implementations are not pinned');
  invariant(manifest.canonicalDigestSha256 === PHYSIO_CATALOGUE_IDENTITY_PINS.canonicalContentSha256, 'canonical content is not pinned');
  invariant(manifest.originalDeduplicationMapDigestSha256 === PHYSIO_CATALOGUE_IDENTITY_PINS.originalDeduplicationMapSha256, 'original deduplication relationships are not pinned');
  invariant(manifest.deduplicationMapDigestSha256 === PHYSIO_CATALOGUE_IDENTITY_PINS.deduplicationMapSha256, 'deduplication relationships are not pinned');

  invariant(
    manifest.deduplicationMap.length === expectations.sourceCrosswalkEntries,
    'published full deduplication map is not 261 entries',
  );
  invariant(
    manifest.originalSourceDeduplicationMap.length === expectations.originalSourceCrosswalkEntries,
    'published original deduplication map is not 255 entries',
  );
  const dedupSourceRefs = new Set();
  const dedupCanonicalIds = new Set();
  for (const mapping of manifest.deduplicationMap) {
    invariant(!dedupSourceRefs.has(mapping.sourceRef), `duplicate dedup sourceRef ${mapping.sourceRef}`);
    dedupSourceRefs.add(mapping.sourceRef);
    dedupCanonicalIds.add(mapping.canonicalId);
    const source = sourceByRef.get(mapping.sourceRef);
    invariant(source, `dedup mapping points to missing ${mapping.sourceRef}`);
    invariant(source.canonicalId === mapping.canonicalId, `${mapping.sourceRef} canonical mapping drifted`);
    invariant(source.relationship === mapping.relationship, `${mapping.sourceRef} relationship drifted`);
  }
  invariant(
    dedupCanonicalIds.size === expectations.canonicalAssessments,
    `deduplication map must resolve to exactly ${expectations.canonicalAssessments} canonical IDs`,
  );
  invariant(
    new Set(manifest.originalSourceDeduplicationMap.map(({ canonicalId }) => canonicalId)).size
      === expectations.canonicalAssessments - expectations.componentPhysioAdditions,
    'original 255-source map must resolve to exactly 230 semantic canonical IDs',
  );

  const stability = manifest.registryStability;
  invariant(stability.originalEpSourceRefs.length === expectations.epRuntimeDefinitions, 'EP source baseline count drifted');
  invariant(stability.retainedEpCanonicalIds.length === expectations.epRuntimeDefinitions - expectations.epSemanticDuplicates, 'semantically reconciled EP canonical count drifted');
  invariant(stability.additivePhysioCanonicalIds.length === expectations.physioAdditions, 'additive registry count drifted');
  invariant(stability.removedOriginalSourceRefs.length === 0, 'original source removal detected');
  invariant(stability.undeclaredCanonicalIds.length === 0, 'undeclared canonical addition detected');
  invariant(stability.originalEpSourceRefsSha256 === PHYSIO_CATALOGUE_IDENTITY_PINS.originalEpSourceRefsSha256, 'EP baseline source refs are not pinned');
  invariant(stability.retainedEpCanonicalIdsSha256 === PHYSIO_CATALOGUE_IDENTITY_PINS.retainedEpCanonicalIdsSha256, 'reconciled EP canonical IDs are not pinned');
  invariant(stability.additivePhysioCanonicalIdsSha256 === PHYSIO_CATALOGUE_IDENTITY_PINS.additivePhysioCanonicalIdsSha256, 'Physio additive IDs are not pinned');
  invariant(
    new Set([
      ...stability.retainedEpCanonicalIds,
      ...stability.additivePhysioCanonicalIds,
    ]).size === expectations.canonicalAssessments,
    'baseline-plus-additions registry is not exactly 236 unique IDs',
  );
  for (const sourceRef of stability.originalEpSourceRefs) {
    invariant(sourceByRef.has(sourceRef), `EP baseline source removed: ${sourceRef}`);
  }
  for (const canonicalId of stability.retainedEpCanonicalIds) {
    invariant(canonicalById.has(canonicalId), `reconciled EP canonical ID removed: ${canonicalId}`);
  }
  for (const canonicalId of stability.additivePhysioCanonicalIds) {
    invariant(canonicalById.has(canonicalId), `declared Physio addition missing: ${canonicalId}`);
  }

  const { manifestDigestSha256, ...manifestBody } = manifest;
  invariant(contentSha256(manifestBody) === manifestDigestSha256, 'manifest digest does not match');

  const legacyAdditions = manifest.sources.filter(({ relationship }) => relationship === 'physio-addition');
  invariant(legacyAdditions.length === expectations.legacyPhysioAdditions, 'legacy Physio additive relationship count drifted');
  const componentAdditions = manifest.sources.filter(({ relationship }) => relationship === 'physio-component-addition');
  invariant(componentAdditions.length === expectations.componentPhysioAdditions, 'component Physio additive relationship count drifted');
  const mappedPhysio = manifest.sources.filter(({ sourceSet }) => sourceSet === 'physio-legacy');
  invariant(mappedPhysio.length === expectations.physioLegacyDefinitions, 'not every Physio source is mapped');
  invariant(
    manifest.canonicalAssessments.every(({ content }) => typeof content.scoring_system === 'string' && content.scoring_system.trim()),
    'a canonical assessment has no scoring system',
  );
  invariant(
    manifest.canonicalAssessments.every(({ content }) => typeof content.instructions === 'string' && content.instructions.trim()),
    'a canonical assessment has no instructions',
  );

  return {
    sourceCrosswalkEntries: counts.sourceCrosswalkEntries,
    canonicalAssessments: counts.canonicalAssessments,
    epRuntimeDefinitions: counts.epRuntimeDefinitions,
    physioLegacyDefinitions: counts.physioLegacyDefinitions,
    physioAdditions: counts.physioAdditions,
    shadowedEpImports: counts.shadowedEpImports,
    manifestDigestSha256,
  };
}

export function writePhysioCatalogueArtifacts() {
  const manifest = buildPhysioCatalogueManifest();
  validatePhysioCatalogueManifest(manifest);
  fs.writeFileSync(PHYSIO_CATALOGUE_MANIFEST_PATH, serializePhysioCatalogueManifest(manifest), 'utf8');
  fs.writeFileSync(PHYSIO_CATALOGUE_SEED_PATH, serializePhysioCatalogueSeed(manifest), 'utf8');
  return manifest;
}

export function checkPhysioCatalogueArtifacts() {
  const manifest = buildPhysioCatalogueManifest();
  const summary = validatePhysioCatalogueManifest(manifest);
  invariant(
    readRequiredFile(PHYSIO_CATALOGUE_MANIFEST_PATH) === serializePhysioCatalogueManifest(manifest),
    'physio-catalogue-manifest.json is stale; run with --write',
  );
  invariant(
    readRequiredFile(PHYSIO_CATALOGUE_SEED_PATH) === serializePhysioCatalogueSeed(manifest),
    'physiotherapy-assessment-part-0.jsonl is stale; run with --write',
  );
  return summary;
}

function isMainModule() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const shouldWrite = process.argv.includes('--write');
  const manifest = shouldWrite ? writePhysioCatalogueArtifacts() : null;
  const summary = shouldWrite
    ? validatePhysioCatalogueManifest(manifest)
    : checkPhysioCatalogueArtifacts();
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: shouldWrite ? 'write' : 'check',
    ...summary,
    expectations: PHYSIO_CATALOGUE_EXPECTATIONS,
  })}\n`);
}
