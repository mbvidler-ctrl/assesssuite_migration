import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertImmutableImageReference } from '../server/tests/support/server-harness.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const forwardImage = process.env.FORWARD_IMAGE?.trim() || null;
const rollbackImage = process.env.ROLLBACK_IMAGE?.trim() || null;

if (Boolean(forwardImage) !== Boolean(rollbackImage)) {
  throw new Error('Set both FORWARD_IMAGE and ROLLBACK_IMAGE, or neither for the local checkout proof.');
}
if (forwardImage) {
  assertImmutableImageReference(forwardImage, 'FORWARD_IMAGE');
  assertImmutableImageReference(rollbackImage, 'ROLLBACK_IMAGE');
}

const childEnvironment = { ...process.env };
for (const name of [
  'FLY_API_TOKEN',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_MONTHLY',
  'STRIPE_PRICE_ID_ANNUAL',
]) {
  delete childEnvironment[name];
}

const child = spawn(
  process.execPath,
  ['--test', '--test-concurrency=1', 'server/tests/forward-rollback-compatibility.test.mjs'],
  {
    cwd: repoRoot,
    env: {
      ...childEnvironment,
      ...(forwardImage ? { FORWARD_IMAGE: forwardImage, ROLLBACK_IMAGE: rollbackImage } : {}),
    },
    stdio: 'inherit',
  },
);

const [code, signal] = await once(child, 'exit');
if (signal) {
  throw new Error(`forward/rollback compatibility proof terminated by ${signal}`);
}
process.exitCode = code ?? 1;
