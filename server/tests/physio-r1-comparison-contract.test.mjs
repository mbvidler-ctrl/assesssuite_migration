import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function catalogueChecksum(records) {
  const canonicalRecords = records.map((record) => canonicalJson(record)).sort();
  return createHash('sha256').update(canonicalJson(canonicalRecords)).digest('hex');
}

test('R1 comparison preserves the exact accepted 236-assessment catalogue', () => {
  const assessments = read('server/data-import/physiotherapy-assessment-part-0.jsonl')
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const expected = 'c39fd9e75054857d7f642c8fc2210446781d247e44c751b04499db749bfaa56f';
  assert.equal(assessments.length, 236);
  assert.equal(catalogueChecksum(assessments), expected);
  assert.match(read('scripts/physio-release-contract.mjs'), new RegExp(`catalogueChecksum: '${expected}'`));
});

test('R1 comparison target is isolated and cannot register or create payment effects', () => {
  const config = read('fly.physio.r1-comparison.toml');
  assert.match(config, /^app = "assesssuite-physio-r1"$/m);
  assert.match(config, /^\s*source = "assesssuite_physio_r1_data"$/m);
  assert.match(config, /^\s*ASSESSSUITE_DEPLOYMENT_VARIANT = "physio-r1-comparison"$/m);
  assert.match(config, /^\s*EXPECTED_APP_URL = "https:\/\/assesssuite-physio-r1\.fly\.dev"$/m);
  assert.match(config, /^\s*ALLOW_OPEN_REGISTRATION = "0"$/m);
  assert.match(config, /^\s*PAYMENTS_ENABLED = "0"$/m);
  assert.match(config, /^\s*TRANSCRIPTION_ENABLED = "1"$/m);
  assert.match(config, /^\s*DOCUMENT_EXTRACTION_ENABLED = "1"$/m);
  assert.match(config, /^\s*LLM_REQUIRED = "1"$/m);
  assert.doesNotMatch(config, /assesssuite_physio_data"/);
});
