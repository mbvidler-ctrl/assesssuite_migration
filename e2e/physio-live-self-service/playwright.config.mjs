import { defineConfig, devices } from '@playwright/test';

import { resolveSelfServiceConfiguration } from './self-service-contract.mjs';

const live = resolveSelfServiceConfiguration(process.env);
if (!['provision', 'finalize'].includes(live.phase)) {
  throw new TypeError('Playwright self-service execution supports only provision or finalize');
}

export default defineConfig({
  testDir: '.',
  testMatch: live.phase === 'provision' ? 'provision.spec.mjs' : 'finalize.spec.mjs',
  outputDir: `${live.evidenceDirectory}/artifacts`,
  globalSetup: './global-setup.mjs',
  globalTeardown: './global-teardown.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 20 * 60 * 1000,
  expect: { timeout: 30_000 },
  reporter: [['line']],
  use: {
    baseURL: live.origin,
    actionTimeout: 45_000,
    navigationTimeout: 90_000,
    ignoreHTTPSErrors: false,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
