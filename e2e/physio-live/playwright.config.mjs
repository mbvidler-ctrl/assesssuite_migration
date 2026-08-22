import { defineConfig, devices } from '@playwright/test';

import { resolvePhysioLiveQaConfiguration } from './live-qa-contract.mjs';

const live = resolvePhysioLiveQaConfiguration(process.env);

export default defineConfig({
  testDir: '.',
  testMatch: 'physio-live.spec.mjs',
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
    navigationTimeout: 60_000,
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
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
