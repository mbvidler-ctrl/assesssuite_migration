import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CATALOGUE_ASSESSMENTS } from '../seed.mjs';
import {
  EXPECTED_PHYSIO_COMPONENT_ADDITION_COUNT,
  PHYSIO_ADDITIVE_SOURCES,
} from './physio-additive-sources.mjs';
import {
  EXPECTED_PHYSIO_ADDITION_COUNT,
  EXPECTED_PHYSIO_SOURCE_COUNT,
  PHYSIO_SOURCE_CROSSWALK,
} from './physio-crosswalk.mjs';
import {
  EP_SEMANTIC_DUPLICATE_CROSSWALK,
  EXPECTED_EP_SEMANTIC_DUPLICATE_COUNT,
} from './physio-semantic-crosswalk.mjs';
import {
  buildCanonicalQuestionnaireRunnerSpec,
  CANONICAL_DRIVEN_QUESTIONNAIRE_ROUTES,
  PHYSIO_RUNTIME_SPEC_OVERLAYS,
} from './physio-runtime-spec-overlays.mjs';
import { normalisedFileSha256 } from './normalised-source-hash.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(__dirname, '..');
const dataImportDirectory = path.join(serverDirectory, 'data-import');

export const PHYSIO_CATALOGUE_MANIFEST_PATH = path.join(
  __dirname,
  'physio-catalogue-manifest.json',
);
export const PHYSIO_CATALOGUE_SEED_PATH = path.join(
  dataImportDirectory,
  'physiotherapy-assessment-part-0.jsonl',
);

export const PHYSIO_CATALOGUE_EXPECTATIONS = Object.freeze({
  epImportDefinitions: 229,
  epSyntheticDefinitions: 4,
  epRuntimeDefinitions: 232,
  physioLegacyDefinitions: EXPECTED_PHYSIO_SOURCE_COUNT,
  originalSourceCrosswalkEntries: 255,
  componentSourceDefinitions: EXPECTED_PHYSIO_COMPONENT_ADDITION_COUNT,
  sourceCrosswalkEntries: 261,
  epSemanticDuplicates: EXPECTED_EP_SEMANTIC_DUPLICATE_COUNT,
  legacyPhysioAdditions: EXPECTED_PHYSIO_ADDITION_COUNT,
  componentPhysioAdditions: EXPECTED_PHYSIO_COMPONENT_ADDITION_COUNT,
  physioAdditions: EXPECTED_PHYSIO_ADDITION_COUNT + EXPECTED_PHYSIO_COMPONENT_ADDITION_COUNT,
  canonicalAssessments: 236,
  shadowedEpImports: 1,
});

// Immutable pins for this accepted source set. A deliberate catalogue change
// must update these values in review; `--write` alone cannot bless a removed
// EP identity, an undeclared addition, changed relationship, or abridged
// source/canonical content.
export const PHYSIO_CATALOGUE_IDENTITY_PINS = Object.freeze({
  originalAcceptanceSourceRefsSha256: '2f7ec521ab0c61dc8c0ddae9e00795d38f7b413003d4cba9394df56e64032904',
  allSourceRefsSha256: 'fd1ffd19b903393206a524fe25c9c5adab2c63ec77b79a31ae78421a4e7f1288',
  originalEpSourceRefsSha256: 'b8b04112f9f6b3bc3058dce79d09b3a5a2b0f7244f3d2ce5b45e16f91500d719',
  retainedEpCanonicalIdsSha256: 'e969f3d3355553c7e4ccaf89648f8de310ed7678c9fa4ae137f3b4da1fb00716',
  additivePhysioCanonicalIdsSha256: '9cc45dff30c06f17dae4b76b5859937604ebf6b7df53f6082acb8d9626c8faf0',
  originalDeduplicationMapSha256: 'fe48e7ab5d5e0306e85bb60559350dec4e998a3419d611a8923ccf79eac4855a',
  deduplicationMapSha256: '94701ecc576b42d31e69586e271a48532bee981073b0a25be1f14022ad5adabf',
  originalSourceContentSha256: 'bdc2b49a58c38fec41d7542de38dff022c3c912b3e6781c78a370b9ef9e691d0',
  sourceContentSha256: '047eb670ad7958a8259e8fc0adacefe5e906a8f17f527cb7456befb777e39132',
  componentImplementationSha256: '4a3d14747559acb24af6c7ea2d62bc0b241bb7ade22e580cbb634bc2cd7e1918',
  canonicalContentSha256: '69c238e7ed2a3078e947d25fc8ffa2b3439938ffac57ffac83f96cad89d6d4a7',
});

const PHYSIO_RUNTIME_CONTENT_REPLACEMENTS = Object.freeze({
  'assessment:ep-import:691eb419ae95315ff3bad4f6': Object.freeze([{
    field: 'description',
    from: 'Useful for behavioral activation planning in exercise physiology context.',
    to: 'Useful for behavioural activation planning in physiotherapy and multidisciplinary rehabilitation contexts.',
  }]),
  'assessment:ep-import:691eb419ae95315ff3bad4fa': Object.freeze([{
    field: 'description',
    from: 'Essential for exercise physiologists designing pacing and graded exposure plans.',
    to: 'Relevant to physiotherapists designing pacing and graded exposure plans.',
  }]),
  'assessment:ep-import:6934cb9404d9e954fd8b150e': Object.freeze([{
    field: 'references',
    from: 'Non-proprietary general movement screening tool for exercise physiology practice.',
    to: 'Non-proprietary general movement screening tool for physiotherapy and allied-health practice.',
  }]),
  'assessment:ep-import:693a932ee95d0bcc4922a20b': Object.freeze([{
    field: 'scoring_system',
    from: 'Normative MET capacities and VO2max values are available in ACSM and other exercise physiology references and are usually stratified by age and sex.',
    to: 'Normative MET capacities and VO2max values are available in ACSM and other exercise-testing and rehabilitation references and are usually stratified by age and sex.',
  }]),
});

function invariant(condition, message) {
  if (!condition) throw new Error(`Physio catalogue invariant failed: ${message}`);
}

function sortJsonValue(value) {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, sortJsonValue(value[key])]),
    );
  }
  return value;
}

/** Deterministic JSON used for source and generated-artifact checksums. */
export function stableStringify(value, indentation = 0) {
  return JSON.stringify(sortJsonValue(value), null, indentation);
}

export function contentSha256(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function slug(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => line.trim())
    .map(({ line, lineNumber }) => {
      try {
        return {
          content: JSON.parse(line),
          sourceFile: path.relative(path.resolve(__dirname, '..', '..'), filePath).replaceAll('\\', '/'),
          sourceLine: lineNumber,
        };
      } catch (error) {
        throw new Error(`${filePath}:${lineNumber}: invalid JSONL (${error.message})`);
      }
    });
}

function loadEpImports() {
  const files = fs
    .readdirSync(dataImportDirectory)
    .filter((name) => /^assessment-part-\d+\.jsonl$/.test(name))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
  return files.flatMap((name) => loadJsonl(path.join(dataImportDirectory, name)));
}

function runtimeSourceForSynthetic(content, index) {
  const sourceRef = `ep-synthetic:${slug(content.name)}`;
  return {
    sourceRef,
    sourceSet: 'ep-runtime',
    sourceKind: 'ep-synthetic',
    sourceName: content.name,
    sourceFile: 'server/seed.mjs',
    sourceOrdinal: index + 1,
    canonicalId: `assessment:${sourceRef}`,
    relationship: 'canonical-runtime-definition',
    contentSha256: contentSha256(content),
    sourceContent: content,
  };
}

function runtimeSourceForImport(record) {
  invariant(record.content.source_id, `${record.content.name} has no EP source_id`);
  const sourceRef = `ep-import:${record.content.source_id}`;
  return {
    sourceRef,
    sourceSet: 'ep-runtime',
    sourceKind: 'ep-import',
    sourceName: record.content.name,
    sourceFile: record.sourceFile,
    sourceLine: record.sourceLine,
    canonicalId: `assessment:${sourceRef}`,
    relationship: 'canonical-runtime-definition',
    contentSha256: contentSha256(record.content),
    sourceContent: record.content,
  };
}

function physioSourceRef(name) {
  return `physio-legacy:${slug(name)}`;
}

function canonicalFromSource(source) {
  return {
    canonicalId: source.canonicalId,
    name: source.sourceName,
    primarySourceRef: source.sourceRef,
    contentSha256: source.contentSha256,
    sourceRefs: [source.sourceRef],
    content: source.sourceContent,
  };
}

function applyPhysioRuntimeContentReplacements(canonicalId, content) {
  const replacements = PHYSIO_RUNTIME_CONTENT_REPLACEMENTS[canonicalId] || [];
  return replacements.reduce((updated, { field, from, to }) => {
    const current = String(updated[field] ?? '');
    invariant(current.includes(from), `${canonicalId}.${field} Physio language source drifted`);
    return {
      ...updated,
      [field]: current.replace(from, to),
    };
  }, content);
}

function componentSourceRecord(definition) {
  invariant(definition?.sourceRef?.startsWith('physio-component:'), 'component sourceRef must use physio-component namespace');
  invariant(definition?.componentFile, `${definition?.sourceRef || 'component source'} has no componentFile`);
  invariant(definition?.content?.name, `${definition.sourceRef} has no assessment name`);
  const componentPath = path.resolve(__dirname, '..', '..', definition.componentFile);
  invariant(fs.existsSync(componentPath), `${definition.sourceRef} component is missing: ${definition.componentFile}`);
  return {
    sourceRef: definition.sourceRef,
    sourceSet: 'physio-maintained-component',
    sourceKind: 'maintained-runner-definition',
    sourceName: definition.content.name,
    sourceFile: 'server/catalogue/physio-additive-sources.mjs',
    implementationFile: definition.componentFile,
    implementationSha256: normalisedFileSha256(componentPath),
    canonicalId: `assessment:${definition.sourceRef}`,
    relationship: 'physio-component-addition',
    runnerKey: definition.runnerKey,
    scoringKey: definition.scoringKey,
    contentSha256: contentSha256(definition.content),
    sourceContent: definition.content,
  };
}

function assertUnique(values, label) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  invariant(duplicates.size === 0, `${label} duplicates: ${[...duplicates].join(', ')}`);
}

/**
 * Builds a deterministic, lossless source manifest and its exact 236-record Physio
 * runtime catalogue. The 255 acceptance sources are the 232 current EP
 * runtime definitions plus the 23 legacy Physio definitions. The EP import
 * hidden by the synthetic DASS-21 runtime definition is retained separately
 * under shadowedEpImportSources so its content remains auditable without
 * inflating the runtime acceptance denominator.
 */
export function buildPhysioCatalogueManifest() {
  const epImports = loadEpImports();
  const physioSourceRecords = loadJsonl(
    path.join(dataImportDirectory, 'physiotherapy-outcome-measures-part-0.jsonl'),
  );

  invariant(
    epImports.length === PHYSIO_CATALOGUE_EXPECTATIONS.epImportDefinitions,
    `expected ${PHYSIO_CATALOGUE_EXPECTATIONS.epImportDefinitions} EP imports, found ${epImports.length}`,
  );
  invariant(
    CATALOGUE_ASSESSMENTS.length === PHYSIO_CATALOGUE_EXPECTATIONS.epSyntheticDefinitions,
    `expected ${PHYSIO_CATALOGUE_EXPECTATIONS.epSyntheticDefinitions} EP synthetic definitions, found ${CATALOGUE_ASSESSMENTS.length}`,
  );
  invariant(
    physioSourceRecords.length === PHYSIO_CATALOGUE_EXPECTATIONS.physioLegacyDefinitions,
    `expected ${PHYSIO_CATALOGUE_EXPECTATIONS.physioLegacyDefinitions} Physio definitions, found ${physioSourceRecords.length}`,
  );
  invariant(
    PHYSIO_SOURCE_CROSSWALK.length === PHYSIO_CATALOGUE_EXPECTATIONS.physioLegacyDefinitions,
    `expected ${PHYSIO_CATALOGUE_EXPECTATIONS.physioLegacyDefinitions} Physio crosswalk rows, found ${PHYSIO_SOURCE_CROSSWALK.length}`,
  );

  assertUnique(epImports.map(({ content }) => content.source_id), 'EP import source_id');
  assertUnique(epImports.map(({ content }) => content.name), 'EP import name');
  assertUnique(CATALOGUE_ASSESSMENTS.map(({ name }) => name), 'EP synthetic name');
  assertUnique(physioSourceRecords.map(({ content }) => content.name), 'Physio source name');
  assertUnique(PHYSIO_SOURCE_CROSSWALK.map(({ physioName }) => physioName), 'Physio crosswalk name');
  invariant(
    PHYSIO_ADDITIVE_SOURCES.length === PHYSIO_CATALOGUE_EXPECTATIONS.componentSourceDefinitions,
    `expected ${PHYSIO_CATALOGUE_EXPECTATIONS.componentSourceDefinitions} component sources, found ${PHYSIO_ADDITIVE_SOURCES.length}`,
  );
  invariant(
    EP_SEMANTIC_DUPLICATE_CROSSWALK.length === PHYSIO_CATALOGUE_EXPECTATIONS.epSemanticDuplicates,
    `expected ${PHYSIO_CATALOGUE_EXPECTATIONS.epSemanticDuplicates} semantic duplicate rows, found ${EP_SEMANTIC_DUPLICATE_CROSSWALK.length}`,
  );
  assertUnique(PHYSIO_ADDITIVE_SOURCES.map(({ sourceRef }) => sourceRef), 'component sourceRef');
  assertUnique(PHYSIO_ADDITIVE_SOURCES.map(({ content }) => content.name), 'component source name');
  assertUnique(EP_SEMANTIC_DUPLICATE_CROSSWALK.map(({ sourceRef }) => sourceRef), 'semantic duplicate sourceRef');

  const syntheticNames = new Set(CATALOGUE_ASSESSMENTS.map(({ name }) => name));
  const runtimeImportRecords = epImports.filter(({ content }) => !syntheticNames.has(content.name));
  const shadowedImportRecords = epImports.filter(({ content }) => syntheticNames.has(content.name));

  const unreconciledRuntimeSources = [
    ...CATALOGUE_ASSESSMENTS.map(runtimeSourceForSynthetic),
    ...runtimeImportRecords.map(runtimeSourceForImport),
  ];
  invariant(
    unreconciledRuntimeSources.length === PHYSIO_CATALOGUE_EXPECTATIONS.epRuntimeDefinitions,
    `expected ${PHYSIO_CATALOGUE_EXPECTATIONS.epRuntimeDefinitions} EP runtime definitions, found ${unreconciledRuntimeSources.length}`,
  );
  invariant(
    shadowedImportRecords.length === PHYSIO_CATALOGUE_EXPECTATIONS.shadowedEpImports,
    `expected ${PHYSIO_CATALOGUE_EXPECTATIONS.shadowedEpImports} shadowed EP import, found ${shadowedImportRecords.length}`,
  );
  assertUnique(unreconciledRuntimeSources.map(({ sourceName }) => sourceName), 'EP runtime name');
  assertUnique(unreconciledRuntimeSources.map(({ sourceRef }) => sourceRef), 'EP runtime sourceRef');

  const unreconciledRuntimeByRef = new Map(
    unreconciledRuntimeSources.map((source) => [source.sourceRef, source]),
  );
  const semanticDuplicateByRef = new Map(
    EP_SEMANTIC_DUPLICATE_CROSSWALK.map((row) => [row.sourceRef, row]),
  );
  for (const row of EP_SEMANTIC_DUPLICATE_CROSSWALK) {
    invariant(unreconciledRuntimeByRef.has(row.sourceRef), `semantic duplicate source not found: ${row.sourceRef}`);
    invariant(unreconciledRuntimeByRef.has(row.targetSourceRef), `semantic duplicate target not found: ${row.targetSourceRef}`);
    invariant(!semanticDuplicateByRef.has(row.targetSourceRef), `semantic duplicate target cannot itself be an alias: ${row.targetSourceRef}`);
    invariant(typeof row.rationale === 'string' && row.rationale.trim(), `${row.sourceRef} has no semantic rationale`);
  }

  const runtimeSources = unreconciledRuntimeSources.map((source) => {
    const semantic = semanticDuplicateByRef.get(source.sourceRef);
    if (!semantic) return source;
    const target = unreconciledRuntimeByRef.get(semantic.targetSourceRef);
    return {
      ...source,
      canonicalId: target.canonicalId,
      relationship: semantic.relationship,
      matchedRuntimeSourceRef: semantic.targetSourceRef,
      semanticRationale: semantic.rationale,
    };
  });

  const canonicalAssessments = runtimeSources
    .filter(({ sourceRef }) => !semanticDuplicateByRef.has(sourceRef))
    .map(canonicalFromSource);
  const canonicalById = new Map(
    canonicalAssessments.map((canonical) => [canonical.canonicalId, canonical]),
  );
  for (const source of runtimeSources.filter(({ sourceRef }) => semanticDuplicateByRef.has(sourceRef))) {
    const canonical = canonicalById.get(source.canonicalId);
    invariant(canonical, `${source.sourceRef} semantic target canonical is absent`);
    canonical.sourceRefs.push(source.sourceRef);
  }
  const canonicalByRuntimeName = new Map(
    runtimeSources.map((source) => [source.sourceName, canonicalById.get(source.canonicalId)]),
  );
  const componentSources = PHYSIO_ADDITIVE_SOURCES.map(componentSourceRecord);
  for (const source of componentSources) {
    const canonical = canonicalFromSource(source);
    canonicalAssessments.push(canonical);
    canonicalById.set(canonical.canonicalId, canonical);
    canonicalByRuntimeName.set(canonical.name, canonical);
  }
  const physioByName = new Map(
    physioSourceRecords.map((record) => [record.content.name, record]),
  );
  const physioSources = [];

  for (const crosswalk of PHYSIO_SOURCE_CROSSWALK) {
    const physioRecord = physioByName.get(crosswalk.physioName);
    invariant(physioRecord, `crosswalk source not found: ${crosswalk.physioName}`);
    const sourceRef = physioSourceRef(crosswalk.physioName);

    let canonical;
    if (crosswalk.targetRuntimeName) {
      canonical = canonicalByRuntimeName.get(crosswalk.targetRuntimeName);
      invariant(
        canonical,
        `crosswalk target not found: ${crosswalk.physioName} -> ${crosswalk.targetRuntimeName}`,
      );
    } else {
      const canonicalId = `assessment:${sourceRef}`;
      canonical = {
        canonicalId,
        name: physioRecord.content.name,
        primarySourceRef: sourceRef,
        contentSha256: contentSha256(physioRecord.content),
        sourceRefs: [],
        content: physioRecord.content,
      };
      canonicalAssessments.push(canonical);
      canonicalById.set(canonical.canonicalId, canonical);
      canonicalByRuntimeName.set(canonical.name, canonical);
    }

    canonical.sourceRefs.push(sourceRef);
    physioSources.push({
      sourceRef,
      sourceSet: 'physio-legacy',
      sourceKind: 'physio-import',
      sourceName: physioRecord.content.name,
      sourceFile: physioRecord.sourceFile,
      sourceLine: physioRecord.sourceLine,
      canonicalId: canonical.canonicalId,
      relationship: crosswalk.relationship,
      matchedRuntimeName: crosswalk.targetRuntimeName,
      contentSha256: contentSha256(physioRecord.content),
      sourceContent: physioRecord.content,
    });
  }

  const originalSources = [...runtimeSources, ...physioSources];
  const sources = [...originalSources, ...componentSources];
  assertUnique(originalSources.map(({ sourceRef }) => sourceRef), 'original acceptance sourceRef');
  assertUnique(sources.map(({ sourceRef }) => sourceRef), 'catalogue sourceRef');
  assertUnique(canonicalAssessments.map(({ canonicalId }) => canonicalId), 'canonicalId');
  assertUnique(canonicalAssessments.map(({ name }) => name), 'canonical name');

  invariant(
    originalSources.length === PHYSIO_CATALOGUE_EXPECTATIONS.originalSourceCrosswalkEntries,
    `expected ${PHYSIO_CATALOGUE_EXPECTATIONS.originalSourceCrosswalkEntries} original source mappings, found ${originalSources.length}`,
  );
  invariant(
    sources.length === PHYSIO_CATALOGUE_EXPECTATIONS.sourceCrosswalkEntries,
    `expected ${PHYSIO_CATALOGUE_EXPECTATIONS.sourceCrosswalkEntries} source mappings, found ${sources.length}`,
  );
  invariant(
    canonicalAssessments.length === PHYSIO_CATALOGUE_EXPECTATIONS.canonicalAssessments,
    `expected exactly ${PHYSIO_CATALOGUE_EXPECTATIONS.canonicalAssessments} canonical assessments, found ${canonicalAssessments.length}`,
  );

  const legacyAdditions = physioSources.filter(({ relationship }) => relationship === 'physio-addition');
  invariant(
    legacyAdditions.length === PHYSIO_CATALOGUE_EXPECTATIONS.legacyPhysioAdditions,
    `expected ${PHYSIO_CATALOGUE_EXPECTATIONS.legacyPhysioAdditions} legacy Physio additions, found ${legacyAdditions.length}`,
  );
  invariant(
    componentSources.length === PHYSIO_CATALOGUE_EXPECTATIONS.componentPhysioAdditions,
    `expected ${PHYSIO_CATALOGUE_EXPECTATIONS.componentPhysioAdditions} component Physio additions, found ${componentSources.length}`,
  );

  const shadowedEpImportSources = shadowedImportRecords.map((record) => {
    const shadowingSource = runtimeSources.find(({ sourceName }) => sourceName === record.content.name);
    invariant(shadowingSource, `shadowing runtime source not found for ${record.content.name}`);
    return {
      sourceRef: `ep-import:${record.content.source_id}`,
      sourceKind: 'ep-import-shadowed-by-runtime-synthetic',
      sourceName: record.content.name,
      sourceFile: record.sourceFile,
      sourceLine: record.sourceLine,
      shadowedBySourceRef: shadowingSource.sourceRef,
      canonicalId: shadowingSource.canonicalId,
      contentSha256: contentSha256(record.content),
      sourceContent: record.content,
    };
  });

  // Every canonical retains one primary source while carrying each equivalent
  // original source verbatim as a checksummed variant. This includes the six
  // reconciled EP duplicates and the 19 legacy Physio variants. The shadowed
  // 21-item EP DASS definition supplies the canonical questions so runtime
  // content is no longer the two-item synthetic exemplar.
  for (const canonical of canonicalAssessments) {
    const mappedVariants = sources.filter((source) => (
      source.canonicalId === canonical.canonicalId
      && source.sourceRef !== canonical.primarySourceRef
    ));
    const shadowVariants = shadowedEpImportSources.filter((source) => (
      source.canonicalId === canonical.canonicalId
    ));
    const aliases = [...new Set([
      ...(Array.isArray(canonical.content.aliases) ? canonical.content.aliases : []),
      ...mappedVariants
        .map(({ sourceName }) => sourceName)
        .filter((sourceName) => sourceName !== canonical.name),
    ])].sort();
    const sourceVariants = [
      ...mappedVariants.map((source) => ({
        source_ref: source.sourceRef,
        source_name: source.sourceName,
        relationship: source.relationship,
        matched_source_ref: source.matchedRuntimeSourceRef,
        semantic_rationale: source.semanticRationale,
        content_sha256: source.contentSha256,
        source_content: source.sourceContent,
      })),
      ...shadowVariants.map((source) => ({
        source_ref: source.sourceRef,
        source_name: source.sourceName,
        relationship: 'shadowed-runtime-source',
        content_sha256: source.contentSha256,
        source_content: source.sourceContent,
      })),
    ].sort((left, right) => left.source_ref.localeCompare(right.source_ref));

    let runtimeContent = canonical.content;
    const dassShadow = shadowVariants.find(({ sourceName }) => sourceName === 'DASS-21');
    if (canonical.name === 'DASS-21' && dassShadow) {
      invariant(
        Array.isArray(dassShadow.sourceContent.questions)
          && dassShadow.sourceContent.questions.length === 21,
        'shadowed DASS-21 source must contain all 21 items',
      );
      runtimeContent = {
        ...dassShadow.sourceContent,
        ...runtimeContent,
        questions: dassShadow.sourceContent.questions,
      };
    }

    runtimeContent = applyPhysioRuntimeContentReplacements(canonical.canonicalId, runtimeContent);

    const runtimeSpecOverlay = PHYSIO_RUNTIME_SPEC_OVERLAYS[canonical.canonicalId];
    if (runtimeSpecOverlay) {
      runtimeContent = {
        ...runtimeContent,
        ...(runtimeSpecOverlay.questions ? { questions: runtimeSpecOverlay.questions } : {}),
        ...(runtimeSpecOverlay.isQuestionnaire !== undefined
          ? { is_questionnaire: runtimeSpecOverlay.isQuestionnaire }
          : {}),
        runner_spec: runtimeSpecOverlay.runnerSpec,
      };
    }

    const canonicalQuestionnaireRoute = CANONICAL_DRIVEN_QUESTIONNAIRE_ROUTES[canonical.canonicalId];
    if (canonicalQuestionnaireRoute) {
      runtimeContent = {
        ...runtimeContent,
        runner_spec: buildCanonicalQuestionnaireRunnerSpec({
          questions: runtimeContent.questions,
          ...canonicalQuestionnaireRoute,
        }),
      };
    }

    const componentPrimary = componentSources.find(({ sourceRef }) => (
      sourceRef === canonical.primarySourceRef
    ));
    if (componentPrimary) {
      runtimeContent = {
        ...runtimeContent,
        runner_spec: {
          ...runtimeContent.runner_spec,
          implementation: {
            ...runtimeContent.runner_spec?.implementation,
            component_file: componentPrimary.implementationFile,
            component_sha256: componentPrimary.implementationSha256,
          },
        },
      };
    }

    canonical.content = {
      ...runtimeContent,
      canonical_id: canonical.canonicalId,
      primary_source_ref: canonical.primarySourceRef,
      aliases,
      search_tags: [...new Set([
        ...(Array.isArray(runtimeContent.search_tags) ? runtimeContent.search_tags : []),
        canonical.name,
        ...aliases,
      ])],
      source_variants: sourceVariants,
    };
    canonical.contentSha256 = contentSha256(canonical.content);
  }

  for (const canonical of canonicalAssessments) {
    canonical.sourceRefs.sort();
  }
  canonicalAssessments.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));

  const deduplicationMap = sources
    .map(({ sourceRef, sourceSet, sourceName, canonicalId, relationship }) => ({
      sourceRef,
      sourceSet,
      sourceName,
      canonicalId,
      relationship,
    }))
    .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef));
  const originalSourceDeduplicationMap = deduplicationMap.filter(({ sourceRef }) => (
    originalSources.some((source) => source.sourceRef === sourceRef)
  ));
  const originalEpSourceRefs = runtimeSources
    .map(({ sourceRef }) => sourceRef)
    .sort();
  const retainedEpCanonicalIds = [...new Set(runtimeSources
    .map(({ canonicalId }) => canonicalId))]
    .sort();
  const additivePhysioCanonicalIds = [
    ...legacyAdditions,
    ...componentSources,
  ]
    .map(({ canonicalId }) => canonicalId)
    .sort();
  const retainedCanonicalIds = new Set(canonicalAssessments.map(({ canonicalId }) => canonicalId));
  const allowedCanonicalIds = new Set([
    ...retainedEpCanonicalIds,
    ...additivePhysioCanonicalIds,
  ]);
  const removedOriginalSourceRefs = originalSources
    .map(({ sourceRef }) => sourceRef)
    .filter((sourceRef) => !sources.some((source) => source.sourceRef === sourceRef));
  const undeclaredCanonicalIds = [...retainedCanonicalIds]
    .filter((canonicalId) => !allowedCanonicalIds.has(canonicalId))
    .sort();
  invariant(removedOriginalSourceRefs.length === 0, 'an original source identity was removed');
  invariant(undeclaredCanonicalIds.length === 0, 'a canonical ID was added outside the declared Physio additions');
  invariant(
    allowedCanonicalIds.size === PHYSIO_CATALOGUE_EXPECTATIONS.canonicalAssessments,
    'semantically-reconciled EP registry plus declared additions does not equal the canonical denominator',
  );

  const registryStability = {
    policy: 'retain-all-255-original-source-identities-reconcile-declared-semantic-duplicates-and-add-declared-physio-sources',
    originalEpSourceRefs,
    retainedEpCanonicalIds,
    additivePhysioCanonicalIds,
    removedOriginalSourceRefs,
    undeclaredCanonicalIds,
    originalEpSourceRefsSha256: contentSha256(originalEpSourceRefs),
    retainedEpCanonicalIdsSha256: contentSha256(retainedEpCanonicalIds),
    additivePhysioCanonicalIdsSha256: contentSha256(additivePhysioCanonicalIds),
  };

  const originalAcceptanceSourceRefsSha256 = contentSha256(
    originalSources.map(({ sourceRef }) => sourceRef).sort(),
  );
  const allSourceRefsSha256 = contentSha256(
    sources.map(({ sourceRef }) => sourceRef).sort(),
  );
  const originalSourceContentSha256 = contentSha256(
    originalSources
      .map(({ sourceRef, contentSha256: sourceContentSha256 }) => ({ sourceRef, contentSha256: sourceContentSha256 }))
      .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef)),
  );
  const sourceDigestSha256 = contentSha256(sources);
  const componentImplementationSha256 = contentSha256(
    componentSources
      .map(({ sourceRef, implementationFile, implementationSha256 }) => ({ sourceRef, implementationFile, implementationSha256 }))
      .sort((left, right) => left.sourceRef.localeCompare(right.sourceRef)),
  );
  const canonicalDigestSha256 = contentSha256(canonicalAssessments);
  const originalDeduplicationMapDigestSha256 = contentSha256(originalSourceDeduplicationMap);
  const deduplicationMapDigestSha256 = contentSha256(deduplicationMap);
  const actualIdentityPins = {
    originalAcceptanceSourceRefsSha256,
    allSourceRefsSha256,
    originalEpSourceRefsSha256: registryStability.originalEpSourceRefsSha256,
    retainedEpCanonicalIdsSha256: registryStability.retainedEpCanonicalIdsSha256,
    additivePhysioCanonicalIdsSha256: registryStability.additivePhysioCanonicalIdsSha256,
    originalDeduplicationMapSha256: originalDeduplicationMapDigestSha256,
    deduplicationMapSha256: deduplicationMapDigestSha256,
    originalSourceContentSha256,
    sourceContentSha256: sourceDigestSha256,
    componentImplementationSha256,
    canonicalContentSha256: canonicalDigestSha256,
  };
  invariant(
    stableStringify(actualIdentityPins) === stableStringify(PHYSIO_CATALOGUE_IDENTITY_PINS),
    `pinned identity/content set drifted; reviewed replacement is ${stableStringify(actualIdentityPins)}`,
  );

  const manifestBody = {
    schemaVersion: 2,
    catalogueId: 'assesssuite-physio-mvp',
    expectations: PHYSIO_CATALOGUE_EXPECTATIONS,
    counts: {
      epImportDefinitions: epImports.length,
      epSyntheticDefinitions: CATALOGUE_ASSESSMENTS.length,
      epRuntimeDefinitions: runtimeSources.length,
      physioLegacyDefinitions: physioSources.length,
      originalSourceCrosswalkEntries: originalSources.length,
      componentSourceDefinitions: componentSources.length,
      sourceCrosswalkEntries: sources.length,
      epSemanticDuplicates: EP_SEMANTIC_DUPLICATE_CROSSWALK.length,
      canonicalAssessments: canonicalAssessments.length,
      legacyPhysioAdditions: legacyAdditions.length,
      componentPhysioAdditions: componentSources.length,
      physioAdditions: additivePhysioCanonicalIds.length,
      shadowedEpImports: shadowedEpImportSources.length,
    },
    identityPins: PHYSIO_CATALOGUE_IDENTITY_PINS,
    originalAcceptanceSourceRefsSha256,
    allSourceRefsSha256,
    originalSourceContentSha256,
    sourceDigestSha256,
    componentImplementationSha256,
    canonicalDigestSha256,
    originalDeduplicationMapDigestSha256,
    deduplicationMapDigestSha256,
    sources,
    originalSourceDeduplicationMap,
    deduplicationMap,
    semanticReconciliation: EP_SEMANTIC_DUPLICATE_CROSSWALK,
    registryStability,
    shadowedEpImportSources,
    canonicalAssessments,
  };

  return {
    ...manifestBody,
    manifestDigestSha256: contentSha256(manifestBody),
  };
}

export function serializePhysioCatalogueManifest(manifest) {
  return `${stableStringify(manifest, 2)}\n`;
}

export function serializePhysioCatalogueSeed(manifest) {
  return `${manifest.canonicalAssessments
    .map(({ content }) => JSON.stringify(content))
    .join('\n')}\n`;
}
