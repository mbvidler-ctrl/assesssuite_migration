import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ASSESSMENT_ROUTE_REGISTRY_DIGEST,
  GENERATED_ASSESSMENT_ROUTES,
} from '../../src/components/assessments/assessmentRunnerRegistry.generated.js';
import {
  buildRegisteredAssessmentFixture,
  resolveRegisteredAssessmentScorer,
} from '../../src/lib/clinical/assessmentScorerRegistry.js';
import { buildPhysioCatalogueManifest } from './physio-catalogue.mjs';

const OUTPUT_PATH = fileURLToPath(
  new URL('./physio-runner-content-audit.json', import.meta.url),
);
const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHOICE_ITEM_TYPES = new Set(['choice', 'radio', 'select', 'single_choice', 'yes_no']);
const OPEN_ITEM_TYPES = new Set(['date', 'duration', 'number', 'numeric', 'text', 'textarea', 'time']);
const SIMPLE_FIELD_TYPES = new Set([
  'boolean',
  'date',
  'duration',
  'integer',
  'number',
  'numeric',
  'text',
  'textarea',
  'time',
]);
const CHOICE_FIELD_TYPES = new Set(['choice', 'radio', 'select', 'single_choice', 'yes_no']);
const COMPOUND_FIELD_TYPES = new Set([
  'array',
  'boolean-map',
  'choice-map',
  'choice[]',
  'multi-select',
  'number[]',
  'object',
  'object[]',
  'repeatable_lap',
  'repeatable_rest',
  'side-measurement',
  'side-result',
  'string[]',
  'vitals',
]);
const REPEATED_COMPOUND_FIELD_TYPES = new Set([
  'array',
  'choice[]',
  'multi-select',
  'number[]',
  'object[]',
  'repeatable_lap',
  'repeatable_rest',
  'string[]',
]);
const SHA256 = /^[a-f0-9]{64}$/;
const FIXTURE_CONTEXT_KEYS = new Set([
  'assessmentDate',
  'assessment_date',
  'clinicalNotes',
  'globalNotes',
  'notes',
  'runnerKey',
  'runner_key',
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`Physio runner-content audit invariant failed: ${message}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function currentFileSha256(relativePath) {
  try {
    return sha256(fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath)));
  } catch {
    return null;
  }
}

function componentContainsBindingMarker(componentFile, marker) {
  if (!componentFile || !String(marker || '').trim()) return false;
  try {
    return fs
      .readFileSync(path.join(REPOSITORY_ROOT, componentFile), 'utf8')
      .includes(String(marker));
  } catch {
    return false;
  }
}

function expectedBindingSha256(implementation) {
  return sha256([
    implementation.component_file,
    implementation.component_sha256,
    implementation.scorer_file,
    implementation.scorer_sha256,
    implementation.component_scorer_binding_marker,
  ].join('\n'));
}

function promptFor(item) {
  return String(item?.prompt ?? item?.question_text ?? item?.text ?? '').trim();
}

function itemTypeFor(item) {
  return String(item?.type ?? item?.question_type ?? '').trim().toLowerCase();
}

function atomicKey(value) {
  const key = String(value ?? '').trim();
  return key && !/[.\[\]]/.test(key) ? key : null;
}

function responseBindingIsComplete(binding) {
  if (binding === undefined) return true;
  if (!binding || typeof binding !== 'object' || !atomicKey(binding.field)) return false;
  if (binding.key !== undefined && !atomicKey(binding.key)) return false;
  if (binding.index !== undefined && (!Number.isInteger(binding.index) || binding.index < 0)) return false;
  return !(binding.key !== undefined && binding.index !== undefined);
}

function optionsAreComplete(options) {
  return Array.isArray(options)
    && options.length >= 2
    && options.every((option) => (
      typeof option === 'string'
        ? option.trim().length > 0
        : option
          && typeof option === 'object'
          && String(option.label ?? '').trim().length > 0
          && option.value !== undefined
          && option.value !== null
    ));
}

function itemIsComplete(item) {
  if (
    !item
    || typeof item !== 'object'
    || !atomicKey(item.key)
    || !promptFor(item)
    || !responseBindingIsComplete(item.responseBinding)
  ) return false;
  const itemType = itemTypeFor(item);
  if (OPEN_ITEM_TYPES.has(itemType)) return true;
  if (CHOICE_ITEM_TYPES.has(itemType) || Array.isArray(item.options)) return optionsAreComplete(item.options);
  return false;
}

function keyedCollectionIsComplete(collection, validate) {
  if (!Array.isArray(collection) || collection.length === 0 || !collection.every(validate)) return false;
  return new Set(collection.map(({ key }) => String(key))).size === collection.length;
}

function itemCollectionIsComplete(items) {
  return keyedCollectionIsComplete(items, itemIsComplete);
}

function repeatedCardinalityIsComplete(field) {
  const minimumItems = Number(field.minItems);
  const maximumItems = Number(field.maxItems ?? field.length);
  return Number.isInteger(minimumItems)
    && minimumItems >= 0
    && (
      (Number.isInteger(maximumItems) && maximumItems >= minimumItems)
      || field.unbounded === true
    );
}

function fieldIsComplete(field) {
  if (!field || typeof field !== 'object') return false;
  if (!atomicKey(field.key) || !String(field.label ?? '').trim() || !String(field.type ?? '').trim()) return false;
  const type = String(field.type).trim().toLowerCase();
  if (CHOICE_FIELD_TYPES.has(type)) return optionsAreComplete(field.options);
  if (SIMPLE_FIELD_TYPES.has(type)) return true;
  if (!COMPOUND_FIELD_TYPES.has(type)) return false;

  // Choice collections are complete only when every displayed choice is
  // represented. A label for the map itself does not preserve its contents.
  if (['choice-map', 'choice[]', 'multi-select'].includes(type) && optionsAreComplete(field.options)) {
    return !REPEATED_COMPOUND_FIELD_TYPES.has(type) || repeatedCardinalityIsComplete(field);
  }

  // Structured objects/maps/custom side or vitals groups must disclose every
  // nested production field recursively.
  for (const collection of [field.fields, field.entries, field.items]) {
    if (keyedCollectionIsComplete(collection, fieldIsComplete)) {
      return !REPEATED_COMPOUND_FIELD_TYPES.has(type) || repeatedCardinalityIsComplete(field);
    }
  }

  // Uniform repeated values may use one explicit item schema. Cardinality is
  // always explicit: either a finite maximum or `unbounded: true` when the
  // production runner genuinely applies no cap.
  return Boolean(
    field.itemSchema
    && fieldIsComplete(field.itemSchema)
    && repeatedCardinalityIsComplete(field),
  );
}

function isCompoundField(field) {
  return COMPOUND_FIELD_TYPES.has(String(field?.type || '').trim().toLowerCase());
}

function representedFixtureInputKeys(runnerSpec) {
  const keys = new Set((runnerSpec?.fields || []).map(({ key }) => String(key)));
  if (runnerSpec?.kind === 'questionnaire') {
    for (const item of runnerSpec.items || []) {
      keys.add(String(item.responseBinding?.field || item.key));
    }
  }
  return keys;
}

function registeredFixtureSchemaCoverage(route, runnerSpec) {
  const registeredScorer = resolveRegisteredAssessmentScorer(route.scoringKey);
  if (!registeredScorer) {
    return Object.freeze({
      applicable: false,
      complete: true,
      fixtureInputKeys: Object.freeze([]),
      representedInputKeys: Object.freeze([]),
      unrepresentedInputKeys: Object.freeze([]),
    });
  }
  const fixture = buildRegisteredAssessmentFixture(route.scoringKey);
  invariant(
    fixture && typeof fixture === 'object' && !Array.isArray(fixture),
    `${route.scoringKey} registered fixture must be an input object`,
  );
  const fixtureInputKeys = Object.keys(fixture)
    .filter((key) => !FIXTURE_CONTEXT_KEYS.has(key))
    .sort();
  const representedKeys = representedFixtureInputKeys(runnerSpec);
  const unrepresentedInputKeys = fixtureInputKeys.filter((key) => !representedKeys.has(key));
  return Object.freeze({
    applicable: true,
    complete: unrepresentedInputKeys.length === 0,
    fixtureInputKeys: Object.freeze(fixtureInputKeys),
    representedInputKeys: Object.freeze([...representedKeys].sort()),
    unrepresentedInputKeys: Object.freeze(unrepresentedInputKeys),
  });
}

function contentModeFor(content, runnerSpec) {
  // A bound production spec is authoritative for the runtime interaction.
  // Source questionnaire rows remain preserved as provenance, but cannot
  // reclassify a clinician-recorded measurement runner as a questionnaire.
  if (runnerSpec?.kind === 'questionnaire') return 'ordered-items';
  if (runnerSpec && runnerSpec.kind !== 'questionnaire') return 'structured-fields';
  if (
    content.is_questionnaire === true
    || (Array.isArray(content.questions) && content.questions.length > 0)
  ) return 'ordered-items';
  return 'unclassified';
}

export function buildPhysioRunnerContentAudit(manifest = buildPhysioCatalogueManifest()) {
  invariant(manifest.canonicalAssessments.length === 236, 'catalogue must contain exactly 236 canonicals');
  invariant(GENERATED_ASSESSMENT_ROUTES.length === 236, 'route registry must contain exactly 236 routes');
  const routeById = new Map(GENERATED_ASSESSMENT_ROUTES.map((route) => [route.canonicalId, route]));
  invariant(routeById.size === 236, 'route registry canonical IDs are not unique');

  const rows = manifest.canonicalAssessments.map(({ canonicalId, content }) => {
    const route = routeById.get(canonicalId);
    invariant(route, `${content.name} has no deterministic route`);
    const runnerSpec = content.runner_spec;
    const contentMode = contentModeFor(content, runnerSpec);
    const items = runnerSpec?.kind === 'questionnaire'
      ? runnerSpec.items
      : contentMode === 'ordered-items'
        ? content.questions
        : [];
    const fields = contentMode === 'structured-fields' ? runnerSpec?.fields : [];
    const orderedItemTextComplete = contentMode !== 'ordered-items'
      || itemCollectionIsComplete(items);
    const structuredFieldsComplete = contentMode !== 'structured-fields'
      || keyedCollectionIsComplete(fields, fieldIsComplete);
    const incompleteFieldKeys = contentMode === 'structured-fields' && Array.isArray(fields)
      ? fields.filter((field) => !fieldIsComplete(field)).map((field) => String(field?.key || ''))
      : [];
    const incompleteCompoundFieldKeys = contentMode === 'structured-fields' && Array.isArray(fields)
      ? fields
        .filter((field) => isCompoundField(field) && !fieldIsComplete(field))
        .map((field) => String(field?.key || ''))
      : [];
    const fixtureSchemaCoverage = registeredFixtureSchemaCoverage(route, runnerSpec);
    const canonicalRepresentationComplete = contentMode !== 'unclassified'
      && orderedItemTextComplete
      && structuredFieldsComplete
      && fixtureSchemaCoverage.complete;
    const implementation = runnerSpec?.implementation;
    const implementationComponentDigestPresent = Boolean(
      implementation?.component_file && SHA256.test(String(implementation.component_sha256 || '')),
    );
    const implementationScorerDigestPresent = Boolean(
      implementation?.scorer_file && SHA256.test(String(implementation.scorer_sha256 || '')),
    );
    const implementationComponentDigestCurrent = Boolean(
      implementationComponentDigestPresent
      && currentFileSha256(implementation.component_file) === implementation.component_sha256,
    );
    const implementationScorerDigestCurrent = Boolean(
      implementationScorerDigestPresent
      && currentFileSha256(implementation.scorer_file) === implementation.scorer_sha256,
    );
    const componentScorerBindingMarkerPresent = Boolean(
      implementation
      && componentContainsBindingMarker(
        implementation.component_file,
        implementation.component_scorer_binding_marker,
      ),
    );
    const componentScorerBindingDigestValid = Boolean(
      implementation
      && SHA256.test(String(implementation.component_scorer_binding_sha256 || ''))
      && implementation.component_scorer_binding_sha256 === expectedBindingSha256(implementation),
    );
    const productionBindingComplete = Boolean(
      runnerSpec
      && runnerSpec.runnerKey === route.runnerKey
      && runnerSpec.scoringKey === route.scoringKey
      && implementationComponentDigestPresent
      && implementationScorerDigestPresent
      && implementationComponentDigestCurrent
      && implementationScorerDigestCurrent
      && componentScorerBindingMarkerPresent
      && componentScorerBindingDigestValid,
    );
    const gaps = [];
    if (contentMode === 'unclassified') gaps.push('instrument-kind-unclassified');
    if (!runnerSpec) gaps.push('runner-spec-missing');
    if (contentMode === 'ordered-items' && !orderedItemTextComplete) gaps.push('ordered-items-or-options-incomplete');
    if (contentMode === 'structured-fields' && !structuredFieldsComplete) gaps.push('structured-fields-incomplete');
    if (incompleteCompoundFieldKeys.length > 0) gaps.push('compound-field-schema-incomplete');
    if (!fixtureSchemaCoverage.complete) gaps.push('fixture-input-schema-unrepresented');
    if (!implementationComponentDigestPresent) gaps.push('component-binding-digest-missing');
    if (!implementationScorerDigestPresent) gaps.push('scorer-binding-digest-missing');
    if (implementationComponentDigestPresent && !implementationComponentDigestCurrent) {
      gaps.push('component-binding-digest-stale');
    }
    if (implementationScorerDigestPresent && !implementationScorerDigestCurrent) {
      gaps.push('scorer-binding-digest-stale');
    }
    if (!componentScorerBindingMarkerPresent) gaps.push('component-scorer-binding-missing');
    if (!componentScorerBindingDigestValid) gaps.push('component-scorer-binding-digest-invalid');
    if (runnerSpec && (runnerSpec.runnerKey !== route.runnerKey || runnerSpec.scoringKey !== route.scoringKey)) {
      gaps.push('route-spec-key-mismatch');
    }
    const noAbridgementComplete = canonicalRepresentationComplete && productionBindingComplete;

    return Object.freeze({
      canonicalId,
      name: content.name,
      host: route.host,
      runnerKey: route.runnerKey,
      scoringKey: route.scoringKey,
      contentMode,
      itemCount: Array.isArray(items) ? items.length : 0,
      fieldCount: Array.isArray(fields) ? fields.length : 0,
      runnerSpecPresent: Boolean(runnerSpec),
      orderedItemTextComplete,
      structuredFieldsComplete,
      incompleteFieldKeys: Object.freeze(incompleteFieldKeys),
      incompleteCompoundFieldKeys: Object.freeze(incompleteCompoundFieldKeys),
      registeredFixtureSchemaApplicable: fixtureSchemaCoverage.applicable,
      registeredFixtureInputKeys: fixtureSchemaCoverage.fixtureInputKeys,
      representedFixtureInputKeys: fixtureSchemaCoverage.representedInputKeys,
      unrepresentedFixtureInputKeys: fixtureSchemaCoverage.unrepresentedInputKeys,
      registeredFixtureInputSchemaComplete: fixtureSchemaCoverage.complete,
      canonicalRepresentationComplete,
      implementationComponentDigestPresent,
      implementationScorerDigestPresent,
      implementationComponentDigestCurrent,
      implementationScorerDigestCurrent,
      componentScorerBindingMarkerPresent,
      componentScorerBindingDigestValid,
      productionBindingComplete,
      noAbridgementComplete,
      gaps: Object.freeze(gaps),
    });
  });

  const completeRows = rows.filter(({ noAbridgementComplete }) => noAbridgementComplete);
  const incompleteRows = rows.filter(({ noAbridgementComplete }) => !noAbridgementComplete);
  const contentModeCounts = Object.fromEntries(
    [...new Set(rows.map(({ contentMode }) => contentMode))].sort().map((contentMode) => [
      contentMode,
      rows.filter((row) => row.contentMode === contentMode).length,
    ]),
  );
  const gapCounts = Object.fromEntries(
    [...new Set(rows.flatMap(({ gaps }) => gaps))].sort().map((gap) => [
      gap,
      rows.filter((row) => row.gaps.includes(gap)).length,
    ]),
  );
  const body = {
    schemaVersion: 6,
    catalogueId: manifest.catalogueId,
    catalogueManifestSha256: manifest.manifestDigestSha256,
    routeRegistrySha256: ASSESSMENT_ROUTE_REGISTRY_DIGEST,
    denominator: rows.length,
    complete: completeRows.length,
    incomplete: incompleteRows.length,
    skipped: 0,
    quarantined: 0,
    acceptanceComplete: incompleteRows.length === 0,
    contentModeCounts,
    gapCounts,
    incompleteCanonicalIds: incompleteRows.map(({ canonicalId }) => canonicalId),
    rows,
  };
  return Object.freeze({ ...body, auditSha256: sha256(JSON.stringify(body)) });
}

export function serializePhysioRunnerContentAudit(audit = buildPhysioRunnerContentAudit()) {
  return `${JSON.stringify(audit, null, 2)}\n`;
}

export function assertCheckedInPhysioRunnerContentAudit() {
  const expected = serializePhysioRunnerContentAudit();
  const actual = fs.readFileSync(OUTPUT_PATH, 'utf8').replace(/\r\n/g, '\n');
  invariant(actual === expected, 'checked-in runner-content audit is stale; run with --write');
  return true;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const audit = buildPhysioRunnerContentAudit();
  if (process.argv.includes('--write')) {
    fs.writeFileSync(OUTPUT_PATH, serializePhysioRunnerContentAudit(audit), 'utf8');
  } else {
    assertCheckedInPhysioRunnerContentAudit();
  }
  process.stdout.write(`${JSON.stringify({
    denominator: audit.denominator,
    complete: audit.complete,
    incomplete: audit.incomplete,
    acceptanceComplete: audit.acceptanceComplete,
    auditSha256: audit.auditSha256,
  })}\n`);
}
