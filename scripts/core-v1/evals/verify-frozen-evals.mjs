#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CASE_SCHEMA_VERSION = 'core-v1.eval.case/1';
const CASE_MANIFEST_SCHEMA_VERSION = 'core-v1.eval.case-manifest/1';
const FREEZE_MANIFEST_SCHEMA_VERSION = 'core-v1.eval.freeze-manifest/1';
const CONSTRAINT_SCHEMA_VERSION = 'core-v1.eval.constraints/1';
const SOURCE_SCHEMA_VERSION = 'core-v1.eval.source-register/1';
const PARTITIONS = ['development', 'validation', 'locked-test'];
const CAPABILITIES = [
  'assessment-discovery',
  'protocol-search',
  'report-composition',
];
const CASE_KEYS = [
  'schema_version',
  'case_id',
  'title',
  'capability',
  'partition',
  'status',
  'data_classification',
  'patient_data',
  'tuning_allowed',
  'case_facts',
  'constraint_refs',
  'fixture',
  'expected_invariants',
];

class VerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VerificationError';
  }
}

function assert(condition, message) {
  if (!condition) throw new VerificationError(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseArgs(argv) {
  const args = {
    corpus: process.env.CORE_V1_EVAL_ROOT || '',
    adapter: '',
    partition: '',
    purpose: '',
    runId: '',
    acknowledgeNoTuning: false,
    acknowledgeLockedTest: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const takeValue = () => {
      const value = argv[index + 1];
      assert(value && !value.startsWith('--'), `${token} requires a value`);
      index += 1;
      return value;
    };

    if (token === '--corpus') args.corpus = takeValue();
    else if (token === '--adapter') args.adapter = takeValue();
    else if (token === '--partition') args.partition = takeValue();
    else if (token === '--purpose') args.purpose = takeValue();
    else if (token === '--run-id') args.runId = takeValue();
    else if (token === '--acknowledge-no-tuning') args.acknowledgeNoTuning = true;
    else if (token === '--acknowledge-locked-test') args.acknowledgeLockedTest = true;
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new VerificationError(`Unknown argument: ${token}`);
  }

  return args;
}

function usage() {
  return [
    'Usage:',
    '  node verify-frozen-evals.mjs --corpus <evaluation-root> [--json]',
    '  node verify-frozen-evals.mjs --corpus <evaluation-root> --adapter <local.mjs> [options]',
    '',
    'Adapter options:',
    '  --partition development|validation|locked-test',
    '  --purpose development|validation|locked-test',
    '  --run-id <stable-run-id>',
    '  --acknowledge-no-tuning',
    '  --acknowledge-locked-test',
  ].join('\n');
}

function safeCorpusPath(root, relativePath) {
  assert(typeof relativePath === 'string' && relativePath.length > 0, 'Manifest path must be a non-empty string');
  assert(!path.isAbsolute(relativePath), `Manifest path must be relative: ${relativePath}`);
  assert(!relativePath.includes('\\'), `Manifest paths must use forward slashes: ${relativePath}`);
  const normal = path.posix.normalize(relativePath);
  assert(normal === relativePath, `Manifest path is not normalised: ${relativePath}`);
  assert(!normal.startsWith('../') && normal !== '..', `Manifest path escapes the corpus: ${relativePath}`);

  const absolute = path.resolve(root, ...normal.split('/'));
  const rootPrefix = `${path.resolve(root)}${path.sep}`;
  assert(absolute.startsWith(rootPrefix), `Resolved path escapes the corpus: ${relativePath}`);
  return absolute;
}

async function readJson(absolutePath, label) {
  let raw;
  try {
    raw = await readFile(absolutePath, 'utf8');
  } catch (error) {
    throw new VerificationError(`Unable to read ${label}: ${error.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new VerificationError(`Invalid JSON in ${label}: ${error.message}`);
  }
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    assert(!seen.has(value), `Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function assertExactKeys(value, expectedKeys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} has unexpected or missing fields; expected ${expected.join(', ')}, received ${actual.join(', ')}`,
  );
}

async function listJsonFiles(root, relativeDirectory) {
  const directory = safeCorpusPath(root, relativeDirectory);
  const output = [];

  async function visit(currentAbsolute, currentRelative) {
    const entries = await readdir(currentAbsolute, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const childAbsolute = path.join(currentAbsolute, entry.name);
      const childRelative = path.posix.join(currentRelative, entry.name);
      if (entry.isDirectory()) await visit(childAbsolute, childRelative);
      else if (entry.isFile() && entry.name.endsWith('.json')) output.push(childRelative);
    }
  }

  await visit(directory, relativeDirectory);
  return output;
}

async function listAllFiles(root) {
  const output = [];

  async function visit(currentAbsolute, currentRelative) {
    const entries = await readdir(currentAbsolute, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const childAbsolute = path.join(currentAbsolute, entry.name);
      const childRelative = currentRelative
        ? path.posix.join(currentRelative, entry.name)
        : entry.name;
      if (entry.isDirectory()) await visit(childAbsolute, childRelative);
      else if (entry.isFile()) output.push(childRelative);
    }
  }

  await visit(path.resolve(root), '');
  return output;
}

async function verifyFreezeManifest(corpusRoot) {
  const manifestPath = safeCorpusPath(corpusRoot, 'manifests/freeze-manifest.json');
  const sidecarPath = safeCorpusPath(corpusRoot, 'manifests/freeze-manifest.sha256');
  const manifestBytes = await readFile(manifestPath);
  const sidecar = (await readFile(sidecarPath, 'utf8')).trim();
  const sidecarParts = sidecar.split(/\s+/u);
  assert(sidecarParts.length >= 1 && /^[a-f0-9]{64}$/u.test(sidecarParts[0]), 'Invalid freeze-manifest.sha256 sidecar');
  assert(sha256(manifestBytes) === sidecarParts[0], 'freeze-manifest.json does not match its SHA-256 sidecar');

  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  assert(manifest.schema_version === FREEZE_MANIFEST_SCHEMA_VERSION, 'Unexpected freeze-manifest schema version');
  assert(manifest.algorithm === 'sha256', 'Freeze manifest must use sha256');
  assert(manifest.canonicalization === 'raw-file-bytes', 'Freeze manifest must hash raw file bytes');
  assert(Array.isArray(manifest.files) && manifest.files.length > 0, 'Freeze manifest contains no files');

  assertUnique(manifest.files.map((entry) => entry.path), 'freeze-manifest path');
  const frozenByPath = new Map();
  for (const entry of manifest.files) {
    assert(entry && typeof entry === 'object', 'Freeze-manifest entry must be an object');
    assert(/^[a-f0-9]{64}$/u.test(entry.sha256), `Invalid SHA-256 for ${entry.path}`);
    assert(Number.isInteger(entry.bytes) && entry.bytes >= 0, `Invalid byte count for ${entry.path}`);
    const absolute = safeCorpusPath(corpusRoot, entry.path);
    const bytes = await readFile(absolute);
    assert(bytes.length === entry.bytes, `Byte-count mismatch for ${entry.path}`);
    assert(sha256(bytes) === entry.sha256, `SHA-256 mismatch for ${entry.path}`);
    frozenByPath.set(entry.path, entry);
  }

  const selfFiles = new Set([
    'manifests/freeze-manifest.json',
    'manifests/freeze-manifest.sha256',
  ]);
  const actualFrozenFiles = (await listAllFiles(corpusRoot))
    .filter((filePath) => !selfFiles.has(filePath))
    .sort();
  const declaredFrozenFiles = [...frozenByPath.keys()].sort();
  assert(
    JSON.stringify(actualFrozenFiles) === JSON.stringify(declaredFrozenFiles),
    'Files on disk do not exactly match the freeze manifest',
  );

  return { manifest, frozenByPath, manifestSha256: sidecarParts[0] };
}

async function verifyCorpus(corpusRoot) {
  const root = path.resolve(corpusRoot);
  const freeze = await verifyFreezeManifest(root);
  const caseManifestPath = 'manifests/case-manifest.json';
  assert(freeze.frozenByPath.has(caseManifestPath), 'case-manifest.json is not covered by the freeze manifest');
  const caseManifest = await readJson(safeCorpusPath(root, caseManifestPath), caseManifestPath);
  assert(caseManifest.schema_version === CASE_MANIFEST_SCHEMA_VERSION, 'Unexpected case-manifest schema version');
  assert(caseManifest.data_policy?.patient_data === false, 'Case manifest must prohibit patient data');
  assert(caseManifest.data_policy?.clinical_validation_claimed === false, 'Case manifest must disclaim clinical validation');
  assert(caseManifest.tuning_policy?.only_partition === 'development', 'Only development may be a tuning partition');
  assert(caseManifest.tuning_policy?.validation_tuning_allowed === false, 'Validation must not permit tuning');
  assert(caseManifest.tuning_policy?.locked_test_tuning_allowed === false, 'Locked test must not permit tuning');

  assertExactKeys(caseManifest.partitions, PARTITIONS, 'case-manifest partitions');
  const listedPartitionCases = [];
  for (const partition of PARTITIONS) {
    const declaration = caseManifest.partitions[partition];
    assert(declaration && typeof declaration === 'object', `Missing ${partition} declaration`);
    assert(Array.isArray(declaration.case_ids), `${partition}.case_ids must be an array`);
    assertUnique(declaration.case_ids, `${partition} case ID`);
    const tuningExpected = partition === 'development';
    assert(declaration.tuning_allowed === tuningExpected, `${partition} tuning_allowed must be ${tuningExpected}`);
    listedPartitionCases.push(...declaration.case_ids);
  }
  assertUnique(listedPartitionCases, 'case ID across partitions');

  const sourceDeclaration = caseManifest.source_register;
  assert(sourceDeclaration && typeof sourceDeclaration === 'object', 'Missing source-register declaration');
  assert(freeze.frozenByPath.has(sourceDeclaration.path), 'Source register is not covered by freeze manifest');
  assert(freeze.frozenByPath.get(sourceDeclaration.path).sha256 === sourceDeclaration.sha256, 'Source-register hash differs between manifests');
  const sourceRegister = await readJson(safeCorpusPath(root, sourceDeclaration.path), sourceDeclaration.path);
  assert(sourceRegister.schema_version === SOURCE_SCHEMA_VERSION, 'Unexpected source-register schema version');
  assert(sourceRegister.data_policy?.patient_data === false, 'Source register must prohibit patient data');
  assert(sourceRegister.data_policy?.clinical_validation_claimed === false, 'Source register must disclaim clinical validation');
  assert(Array.isArray(sourceRegister.sources) && sourceRegister.sources.length > 0, 'Source register is empty');
  const sourceIds = sourceRegister.sources.map((source) => source.source_register_id);
  assertUnique(sourceIds, 'source-register ID');
  const sourceIdSet = new Set(sourceIds);

  assert(Array.isArray(caseManifest.constraint_sets) && caseManifest.constraint_sets.length > 0, 'No constraint sets declared');
  assertUnique(caseManifest.constraint_sets.map((entry) => entry.id), 'constraint-set ID');
  assertUnique(caseManifest.constraint_sets.map((entry) => entry.path), 'constraint-set path');
  const constraintById = new Map();
  for (const declaration of caseManifest.constraint_sets) {
    assert(CAPABILITIES.includes(declaration.capability), `Unknown constraint capability: ${declaration.capability}`);
    assert(freeze.frozenByPath.has(declaration.path), `Constraint set is not covered by freeze manifest: ${declaration.path}`);
    assert(freeze.frozenByPath.get(declaration.path).sha256 === declaration.sha256, `Constraint-set hash differs between manifests: ${declaration.path}`);
    const constraints = await readJson(safeCorpusPath(root, declaration.path), declaration.path);
    assert(constraints.schema_version === CONSTRAINT_SCHEMA_VERSION, `Unexpected constraint schema: ${declaration.path}`);
    assert(constraints.constraint_set_id === declaration.id, `Constraint-set ID mismatch: ${declaration.path}`);
    assert(constraints.capability === declaration.capability, `Constraint capability mismatch: ${declaration.path}`);
    assert(constraints.status === 'frozen', `Constraint set is not frozen: ${declaration.path}`);
    assert(Array.isArray(constraints.constraints) && constraints.constraints.length > 0, `Constraint set is empty: ${declaration.path}`);
    assertUnique(constraints.constraints.map((constraint) => constraint.id), `constraint ID in ${declaration.id}`);
    for (const constraint of constraints.constraints) {
      assert(typeof constraint.statement === 'string' && constraint.statement.length > 0, `Constraint statement is missing: ${constraint.id}`);
      assert(Array.isArray(constraint.source_register_ids) && constraint.source_register_ids.length > 0, `Constraint has no sources: ${constraint.id}`);
      for (const sourceId of constraint.source_register_ids) {
        assert(sourceIdSet.has(sourceId), `Constraint ${constraint.id} references unknown source ${sourceId}`);
      }
    }
    constraintById.set(declaration.id, constraints);
  }

  assert(Array.isArray(caseManifest.cases) && caseManifest.cases.length > 0, 'No cases declared');
  assertUnique(caseManifest.cases.map((entry) => entry.case_id), 'case-manifest case ID');
  assertUnique(caseManifest.cases.map((entry) => entry.path), 'case-manifest path');
  const actualCasePaths = await listJsonFiles(root, 'cases');
  const declaredCasePaths = [...caseManifest.cases.map((entry) => entry.path)].sort();
  assert(
    JSON.stringify(actualCasePaths) === JSON.stringify(declaredCasePaths),
    'Case files on disk do not exactly match case-manifest paths',
  );

  const caseById = new Map();
  const invariantIds = [];
  for (const declaration of caseManifest.cases) {
    assert(PARTITIONS.includes(declaration.partition), `Unknown case partition: ${declaration.partition}`);
    assert(CAPABILITIES.includes(declaration.capability), `Unknown case capability: ${declaration.capability}`);
    assert(declaration.path.startsWith(`cases/${declaration.partition}/`), `Case path does not match partition: ${declaration.path}`);
    assert(freeze.frozenByPath.has(declaration.path), `Case is not covered by freeze manifest: ${declaration.path}`);
    assert(freeze.frozenByPath.get(declaration.path).sha256 === declaration.sha256, `Case hash differs between manifests: ${declaration.path}`);
    const definition = await readJson(safeCorpusPath(root, declaration.path), declaration.path);
    assertExactKeys(definition, CASE_KEYS, `case ${declaration.case_id}`);
    assert(definition.schema_version === CASE_SCHEMA_VERSION, `Unexpected case schema: ${declaration.case_id}`);
    assert(definition.case_id === declaration.case_id, `Case ID mismatch: ${declaration.path}`);
    assert(definition.partition === declaration.partition, `Case partition mismatch: ${declaration.case_id}`);
    assert(definition.capability === declaration.capability, `Case capability mismatch: ${declaration.case_id}`);
    assert(definition.status === 'frozen', `Case is not frozen: ${declaration.case_id}`);
    assert(definition.data_classification === 'synthetic', `Case is not classified synthetic: ${declaration.case_id}`);
    assert(definition.patient_data === false, `Case does not prohibit patient data: ${declaration.case_id}`);
    assert(definition.tuning_allowed === (definition.partition === 'development'), `Invalid tuning flag: ${declaration.case_id}`);
    assert(definition.case_facts && typeof definition.case_facts === 'object' && !Array.isArray(definition.case_facts), `Missing case facts: ${declaration.case_id}`);
    assert(!Object.hasOwn(definition.case_facts, 'constraints'), `Case facts embed constraints: ${declaration.case_id}`);
    assert(!Object.hasOwn(definition.case_facts, 'source_derived_constraints'), `Case facts embed source-derived constraints: ${declaration.case_id}`);
    assert(Array.isArray(definition.constraint_refs) && definition.constraint_refs.length > 0, `Missing constraint refs: ${declaration.case_id}`);
    assertUnique(definition.constraint_refs, `constraint reference in ${declaration.case_id}`);
    for (const constraintRef of definition.constraint_refs) {
      assert(constraintById.has(constraintRef), `Unknown constraint ref ${constraintRef} in ${declaration.case_id}`);
      assert(constraintById.get(constraintRef).capability === definition.capability, `Constraint capability mismatch in ${declaration.case_id}`);
    }
    assert(Array.isArray(definition.expected_invariants) && definition.expected_invariants.length > 0, `Missing invariants: ${declaration.case_id}`);
    assertUnique(definition.expected_invariants.map((item) => item.id), `invariant ID in ${declaration.case_id}`);
    for (const invariant of definition.expected_invariants) {
      assert(/^[A-Z]+-[A-Z]+-[0-9]{3}$/u.test(invariant.id), `Invalid invariant ID ${invariant.id}`);
      assert(typeof invariant.statement === 'string' && invariant.statement.length > 0, `Missing invariant statement ${invariant.id}`);
      invariantIds.push(invariant.id);
    }
    caseById.set(definition.case_id, { declaration, definition });
  }
  assertUnique(invariantIds, 'suite invariant ID');

  const manifestCaseIds = [...caseById.keys()].sort();
  assert(
    JSON.stringify([...listedPartitionCases].sort()) === JSON.stringify(manifestCaseIds),
    'Partition case IDs do not exactly match case entries',
  );
  for (const partition of PARTITIONS) {
    const declared = [...caseManifest.partitions[partition].case_ids].sort();
    const actual = caseManifest.cases
      .filter((entry) => entry.partition === partition)
      .map((entry) => entry.case_id)
      .sort();
    assert(JSON.stringify(declared) === JSON.stringify(actual), `Partition membership mismatch: ${partition}`);
  }

  return {
    root,
    freeze,
    caseManifest,
    caseById,
    constraintById,
    summary: {
      suite_id: caseManifest.suite_id,
      freeze_id: caseManifest.freeze_id,
      manifest_sha256: freeze.manifestSha256,
      files_verified: freeze.manifest.files.length,
      cases_verified: caseManifest.cases.length,
      partitions: Object.fromEntries(PARTITIONS.map((partition) => [
        partition,
        caseManifest.cases.filter((entry) => entry.partition === partition).length,
      ])),
      capabilities: Object.fromEntries(CAPABILITIES.map((capability) => [
        capability,
        caseManifest.cases.filter((entry) => entry.capability === capability).length,
      ])),
    },
  };
}

function validateAdapterGate(args) {
  const partition = args.partition || 'development';
  assert(PARTITIONS.includes(partition), `Unknown adapter partition: ${partition}`);
  const purpose = args.purpose || (partition === 'development' ? 'development' : '');
  assert(purpose === partition, `Adapter purpose must exactly match partition ${partition}`);

  if (partition !== 'development') {
    assert(args.acknowledgeNoTuning, `${partition} execution requires --acknowledge-no-tuning`);
    assert(typeof args.runId === 'string' && args.runId.trim().length >= 6, `${partition} execution requires --run-id`);
  }
  if (partition === 'locked-test') {
    assert(args.acknowledgeLockedTest, 'Locked-test execution requires --acknowledge-locked-test');
  }

  return { partition, purpose, runId: args.runId || `development-${Date.now()}` };
}

function disableProviderAccess() {
  const providerPattern = /(OPENAI|ANTHROPIC|AZURE_OPENAI|GEMINI|GOOGLE_AI|MISTRAL|COHERE|GROQ|TOGETHER|FIREWORKS|BEDROCK|VERTEX|PERPLEXITY)/iu;
  for (const key of Object.keys(process.env)) {
    if (providerPattern.test(key)) delete process.env[key];
  }
  process.env.SELFTEST = '1';
  process.env.CORE_V1_EVAL_OFFLINE = '1';
  globalThis.fetch = async () => {
    throw new VerificationError('Network fetch is disabled during frozen offline evaluation');
  };
}

async function runAdapter(args, corpus) {
  const gate = validateAdapterGate(args);
  disableProviderAccess();
  const adapterAbsolute = path.resolve(args.adapter);
  const adapter = await import(pathToFileURL(adapterAbsolute).href);
  assert(adapter.offlineOnly === true, 'Adapter must export offlineOnly = true');
  assert(typeof adapter.evaluateCase === 'function', 'Adapter must export evaluateCase(caseDefinition, context)');

  const cases = [...corpus.caseById.values()]
    .filter(({ definition }) => definition.partition === gate.partition)
    .sort((left, right) => left.definition.case_id.localeCompare(right.definition.case_id));
  const results = [];
  for (const { definition } of cases) {
    const constraints = definition.constraint_refs.map((constraintRef) => corpus.constraintById.get(constraintRef));
    const result = await adapter.evaluateCase(structuredClone(definition), {
      constraints: structuredClone(constraints),
      partition: gate.partition,
      purpose: gate.purpose,
      runId: gate.runId,
      offline: true,
    });
    assert(result && typeof result === 'object' && !Array.isArray(result), `Adapter returned an invalid result for ${definition.case_id}`);
    assert(result.provider_calls === 0, `Adapter did not report zero provider calls for ${definition.case_id}`);
    assert(result.checks && typeof result.checks === 'object' && !Array.isArray(result.checks), `Adapter returned no checks for ${definition.case_id}`);
    for (const invariant of definition.expected_invariants) {
      assert(result.checks[invariant.id] === true, `Invariant failed or was not evaluated: ${definition.case_id}/${invariant.id}`);
    }
    results.push({
      case_id: definition.case_id,
      invariant_count: definition.expected_invariants.length,
      passed: true,
    });
  }

  return {
    partition: gate.partition,
    purpose: gate.purpose,
    run_id: gate.runId,
    provider_calls: 0,
    cases: results,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  assert(args.corpus, `--corpus or CORE_V1_EVAL_ROOT is required\n\n${usage()}`);
  if (!args.adapter) {
    assert(!args.partition && !args.purpose && !args.runId, 'Adapter-only options were supplied without --adapter');
    assert(!args.acknowledgeNoTuning && !args.acknowledgeLockedTest, 'Adapter acknowledgements were supplied without --adapter');
  }

  const corpus = await verifyCorpus(args.corpus);
  const adapterRun = args.adapter ? await runAdapter(args, corpus) : null;
  const output = {
    ok: true,
    mode: adapterRun ? 'verify-and-run-local-adapter' : 'verify-only',
    clinical_validation_claimed: false,
    patient_data: false,
    ...corpus.summary,
    adapter_run: adapterRun,
  };

  if (args.json) console.log(JSON.stringify(output, null, 2));
  else {
    console.log(`PASS ${output.suite_id}`);
    console.log(`  freeze: ${output.freeze_id}`);
    console.log(`  manifest sha256: ${output.manifest_sha256}`);
    console.log(`  files: ${output.files_verified}; cases: ${output.cases_verified}`);
    console.log(`  partitions: development=${output.partitions.development}, validation=${output.partitions.validation}, locked-test=${output.partitions['locked-test']}`);
    console.log(`  capabilities: assessment-discovery=${output.capabilities['assessment-discovery']}, protocol-search=${output.capabilities['protocol-search']}, report-composition=${output.capabilities['report-composition']}`);
    console.log('  interpretation: synthetic software evaluation only; no clinical validation');
    if (adapterRun) console.log(`  adapter: ${adapterRun.cases.length} ${adapterRun.partition} cases passed offline`);
  }
}

main().catch((error) => {
  const prefix = error instanceof VerificationError ? 'VERIFY FAIL' : 'UNEXPECTED FAIL';
  console.error(`${prefix}: ${error.message}`);
  process.exitCode = 1;
});
