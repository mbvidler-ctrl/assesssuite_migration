import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testsDir, '..', '..');
const validator = path.join(repoRoot, 'scripts', 'validate-production-state-snapshot-workflow.mjs');
const workflow = path.join(repoRoot, '.github', 'workflows', 'production-state-snapshot.yml');

function run(...args) {
  return spawnSync(process.execPath, [validator, workflow, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

test('trusted production-state snapshot workflow satisfies its fail-closed contract', () => {
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /production state snapshot workflow contract passed/);
});

test('production-state snapshot workflow rejects every adversarial mutation', () => {
  const result = run('--selftest');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /mutation selftest passed \(30\/30 rejected\)/);
});
