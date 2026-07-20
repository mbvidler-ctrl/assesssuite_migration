import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const suites = [
  'sdk-error-contract.test.mjs',
  'signup-contract.test.mjs',
  'extraction-matrix.test.mjs',
  'referral-sdk-journey.test.mjs',
  'referral-production-canary.test.mjs',
  'rollback-compatibility.test.mjs',
  'release-tools.test.mjs',
];

for (const suite of suites) {
  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', path.join(testsDir, suite)], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    break;
  }
}
