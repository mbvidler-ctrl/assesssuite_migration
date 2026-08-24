import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsDirectory = path.join(repoRoot, 'server', 'tests');
const exactSharedContracts = new Set([
  'api-usage-ledger.test.mjs',
  'assessment-discovery.test.mjs',
  'assessment-runner-registry.test.mjs',
  'error-telemetry.test.mjs',
  'frontend-error-telemetry.test.mjs',
  'github-artifact-admission.test.mjs',
  'production-startup.test.mjs',
  'public-capabilities-contract.test.mjs',
  'signup-contract.test.mjs',
  'stripe-webhook-event-idempotency.test.mjs',
]);
const requiredPhysioContracts = new Set([
  'assessment-discovery.test.mjs',
  'github-artifact-admission.test.mjs',
  'physio-ai-tasks.test.mjs',
  'physio-assessment-acceptance-matrix.test.mjs',
  'physio-billing-contract.test.mjs',
  'physio-care-episode-functional.test.mjs',
  'physio-care-episode-lifecycle.test.mjs',
  'physio-catalogue-integrity.test.mjs',
  'physio-database-migration-restore.test.mjs',
  'physio-email-contract.test.mjs',
  'physio-episode-adversarial-contract.test.mjs',
  'physio-episode-linkage.test.mjs',
  'physio-exact-image-canary.test.mjs',
  'physio-legacy-ai-isolation.test.mjs',
  'physio-live-qa-contract.test.mjs',
  'physio-live-payment-validation-contract.test.mjs',
  'physio-live-self-service-contract.test.mjs',
  'physio-public-entry.test.mjs',
  'physio-release-order-redesign.test.mjs',
  'physio-release-workflows.test.mjs',
  'physio-restore-verifier.test.mjs',
  'physio-runner-content-integrity.test.mjs',
  'physio-self-service-journey.test.mjs',
  'physio-stripe-webhook-bootstrap-contract.test.mjs',
  'profession-build-architecture.test.mjs',
  'profession-catalogue-seed-selection.test.mjs',
  'profession-server-admission.test.mjs',
  'runtime-status.test.mjs',
  'stripe-webhook-event-idempotency.test.mjs',
]);
const tests = fs.readdirSync(testsDirectory)
  .filter((name) => (
    name.endsWith('.test.mjs')
    && (
      name.startsWith('physio-')
      || name.startsWith('profession-')
      || name.startsWith('runtime-status')
      || exactSharedContracts.has(name)
    )
  ))
  .sort()
  .map((name) => path.join('server', 'tests', name));

if (tests.length < 10) {
  throw new Error(`Physio suite discovery found only ${tests.length} tests; expected at least 10.`);
}
const discoveredNames = new Set(tests.map((testPath) => path.basename(testPath)));
const missingContracts = [...requiredPhysioContracts].filter((name) => !discoveredNames.has(name));
if (missingContracts.length > 0) {
  throw new Error(`Physio suite is missing mandatory contracts: ${missingContracts.join(', ')}`);
}

// These files exercise many short-lived SQLite stores, HTTP listeners and
// child application processes. Running them one file at a time makes resource
// ownership and teardown deterministic on Windows and prevents a completed
// worker from being stranded behind another file's concurrent pipe lifecycle.
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...tests], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.signal) throw new Error(`Physio suite terminated by ${result.signal}`);
process.exitCode = result.status ?? 1;
