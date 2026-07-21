// Strict output firewall for scripts/referral-production-canary.mjs.
// Accepts exactly one JSON line and only the fixed metadata schema. This keeps
// Fly/GitHub logs free of referral content, provider output and arbitrary
// exception text even if the canary implementation regresses later.

import fs from 'node:fs';

import {
  CANARY_NAME,
  CANARY_SCHEMA_VERSION,
  CHECK_NAMES,
  FAILURE_STAGES,
} from './referral-production-canary-contract.mjs';

const inputPath = process.argv[2];
if (!inputPath) {
  process.stderr.write('usage: node scripts/validate-referral-production-canary-output.mjs <jsonl>\n');
  process.exit(2);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function refuse() {
  process.stderr.write('referral canary output rejected by content firewall\n');
  process.exit(1);
}

let text;
try {
  text = fs.readFileSync(inputPath, 'utf8');
} catch {
  refuse();
}

const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
if (lines.length !== 1 || lines[0].length > 8_192) refuse();

let row;
try {
  row = JSON.parse(lines[0]);
} catch {
  refuse();
}

if (!exactKeys(row, [
  'schema_version',
  'canary',
  'observed_at_utc',
  'release_sha',
  'result',
  'failure_stage',
  'fixture',
  'isolation',
  'checks',
])) refuse();
if (row.schema_version !== CANARY_SCHEMA_VERSION || row.canary !== CANARY_NAME) refuse();
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.observed_at_utc)) refuse();
if (!(row.release_sha === null || /^[0-9a-f]{40}$/.test(row.release_sha))) refuse();
if (!['PASS', 'FAIL', 'REFUSED'].includes(row.result)) refuse();
if (!(row.failure_stage === null || FAILURE_STAGES.includes(row.failure_stage))) refuse();
if (row.result === 'PASS' && row.failure_stage !== null) refuse();
if (row.result !== 'PASS' && row.failure_stage === null) refuse();

if (!exactKeys(row.fixture, ['provenance', 'requested_filename_contract', 'byte_sha256'])) refuse();
if (row.fixture.provenance !== 'repository-generated-synthetic-pdf') refuse();
if (row.fixture.requested_filename_contract !== true) refuse();
if (!/^[0-9a-f]{64}$/.test(row.fixture.byte_sha256)) refuse();

if (!exactKeys(row.isolation, [
  'database',
  'uploads',
  'production_database_writes',
  'production_upload_writes',
  'external_email_sends',
  'temporary_storage_removed',
])) refuse();
if (row.isolation.database !== 'temporary' || row.isolation.uploads !== 'temporary') refuse();
if (
  row.isolation.production_database_writes !== 0 ||
  row.isolation.production_upload_writes !== 0 ||
  row.isolation.external_email_sends !== 0 ||
  typeof row.isolation.temporary_storage_removed !== 'boolean'
) refuse();

if (!exactKeys(row.checks, CHECK_NAMES)) refuse();
if (Object.values(row.checks).some((value) => typeof value !== 'boolean')) refuse();
if (row.isolation.temporary_storage_removed !== row.checks.temporary_storage_removed) refuse();
if (row.result === 'PASS' && Object.values(row.checks).some((value) => value !== true)) refuse();

process.stdout.write('referral production canary output validated\n');
