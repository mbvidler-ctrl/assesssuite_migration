import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'physio-offline-journey.spec.mjs',
  fullyParallel: false,
  workers: 1,
  timeout: 360_000,
  expect: { timeout: 30_000 },
  reporter: [['line']],
  use: {
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  outputDir: path.resolve(import.meta.dirname, '../../output/playwright/physio-offline-journey'),
});
