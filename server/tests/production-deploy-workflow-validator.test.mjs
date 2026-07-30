import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const validator = path.join(repoRoot, 'scripts', 'validate-production-deploy-workflow.mjs');

const GOVERNED_WORKFLOWS = [
  { file: 'production-deploy.yml', mutations: 42 },
  { file: 'production-prepare-release.yml', mutations: 25 },
  { file: 'production-prepare-rollback-image.yml', mutations: 30 },
  { file: 'production-rollback.yml', mutations: 30 },
  { file: 'production-parity-assurance.yml', mutations: 44 },
];

function workflowPath(file) {
  return path.join(repoRoot, '.github', 'workflows', file);
}

function run(file, ...args) {
  return spawnSync(process.execPath, [validator, workflowPath(file), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function validatorSelfSha() {
  return createHash('sha256')
    .update(fs.readFileSync(validator, 'utf8').replaceAll('\r\n', '\n'))
    .digest('hex');
}

test('V01 --print-self-sha matches an independently computed hash of the validator file', () => {
  const printed = spawnSync(process.execPath, [validator, '--print-self-sha'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(printed.status, 0, printed.stdout + printed.stderr);
  assert.equal(printed.stdout.trim(), validatorSelfSha());
});

for (const { file, mutations } of GOVERNED_WORKFLOWS) {
  test(`V02 ${file} satisfies the trusted release-workflow contract`, () => {
    const result = run(file);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /workflow contract passed/);
  });

  test(`V03 ${file} rejects every adversarial mutation (${mutations}/${mutations})`, () => {
    const result = run(file, '--selftest');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(
      result.stdout,
      new RegExp(`mutation selftest passed \\(${mutations}/${mutations} rejected\\)`),
    );
  });

  test(`V04 ${file} pins EXPECTED_TRUSTED_VALIDATOR_SHA256 equal to the validator's actual hash`, () => {
    const text = fs.readFileSync(workflowPath(file), 'utf8');
    assert.match(
      text,
      new RegExp(`EXPECTED_TRUSTED_VALIDATOR_SHA256:\\s*${validatorSelfSha()}\\b`),
    );
  });
}

test('V05 the release and rollback-image prepare lanes diff against the same production baseline', () => {
  const releaseText = fs.readFileSync(workflowPath('production-prepare-release.yml'), 'utf8');
  const rollbackText = fs.readFileSync(workflowPath('production-prepare-rollback-image.yml'), 'utf8');
  const extractShas = (text) =>
    [...text.matchAll(/PRODUCTION_BASE_SHA:\s*([0-9a-f]{40})/g)].map((match) => match[1]);
  const releaseShas = new Set(extractShas(releaseText));
  const rollbackShas = new Set(extractShas(rollbackText));
  assert.equal(releaseShas.size, 1, 'release workflow should pin exactly one PRODUCTION_BASE_SHA value');
  assert.equal(
    rollbackShas.size,
    1,
    'rollback-image workflow should pin exactly one PRODUCTION_BASE_SHA value',
  );
  assert.deepEqual(
    [...rollbackShas],
    [...releaseShas],
    'rollback-image lane must diff against the same production baseline as the release lane, not a stale one',
  );
});
