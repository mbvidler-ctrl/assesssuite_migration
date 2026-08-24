import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveProfession } from '../packages/profession-config/runtime.mjs';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataImportDirectory = path.join(serverDirectory, 'data-import');
const epRuntimeSyntheticPath = path.join(
  dataImportDirectory,
  'ep-runtime-synthetic-assessments.json',
);

function loadJsonlPrefix(prefix, { required }) {
  if (!fs.existsSync(dataImportDirectory)) {
    if (required) throw new Error(`Required catalogue directory is missing: ${dataImportDirectory}`);
    return [];
  }
  const files = fs.readdirSync(dataImportDirectory)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.jsonl'))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
  if (required && files.length === 0) {
    throw new Error(`Required assessment catalogue prefix has no JSONL files: ${prefix}`);
  }
  const records = [];
  for (const file of files) {
    for (const [lineIndex, line] of fs.readFileSync(path.join(dataImportDirectory, file), 'utf8')
      .split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        if (record && record.is_deleted !== true) records.push(record);
      } catch (error) {
        if (required) {
          throw new Error(`${file}:${lineIndex + 1}: invalid required catalogue JSON (${error.message})`);
        }
      }
    }
  }
  if (required && records.length === 0) {
    throw new Error(`Required assessment catalogue prefix contains no active records: ${prefix}`);
  }
  return records;
}

function loadEpRuntimeSynthetics() {
  const parsed = JSON.parse(fs.readFileSync(epRuntimeSyntheticPath, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length !== 4) {
    throw new Error('EP runtime synthetic assessment catalogue is invalid');
  }
  return parsed;
}

/**
 * Production-safe catalogue composition. Physio reads only its generated
 * complete registry; the EP-only synthetic resource is opened lazily and is
 * therefore omitted from the sealed Physio runtime tree.
 */
export function buildRuntimeAssessmentCatalogue(environment = process.env) {
  const profession = resolveProfession(environment);
  const prefixes = profession.assessmentLibrary.seedFiles;
  const required = profession.assessmentLibrary.mode === 'explicit';
  const importedAssessments = prefixes.flatMap((prefix) => loadJsonlPrefix(prefix, { required }));

  const importedNames = new Set();
  for (const assessment of importedAssessments) {
    if (!assessment?.name) {
      throw new Error(`Assessment catalogue for ${profession.id} contains a record without a name`);
    }
    if (importedNames.has(assessment.name)) {
      throw new Error(`Assessment catalogue for ${profession.id} contains duplicate name: ${assessment.name}`);
    }
    importedNames.add(assessment.name);
  }

  const synthetics = required ? [] : loadEpRuntimeSynthetics();
  const syntheticNames = new Set(synthetics.map(({ name }) => name));
  const nonCollidingImports = importedAssessments.filter(({ name }) => !syntheticNames.has(name));
  const assessments = [...synthetics, ...nonCollidingImports];
  if (new Set(assessments.map(({ name }) => name)).size !== assessments.length) {
    throw new Error(`Assessment catalogue for ${profession.id} is not unique after runtime merge`);
  }
  return Object.freeze({
    professionId: profession.id,
    prefixes: Object.freeze([...prefixes]),
    required,
    syntheticCount: synthetics.length,
    shadowedSyntheticCount: required ? 4 : 0,
    importedDefinitionCount: importedAssessments.length,
    shadowedImportCount: importedAssessments.length - nonCollidingImports.length,
    runtimeCount: assessments.length,
    assessments: Object.freeze(assessments),
  });
}
