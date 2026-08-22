import { defineConfig } from '@playwright/test';
import path from 'node:path';

const port = Number(process.env.PHYSIO_PUBLIC_BROWSER_TEST_PORT || 4182);
const baseURL = `http://127.0.0.1:${port}`;
const repositoryRoot = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  testDir: '.',
  testMatch: 'physio-public-entry.spec.mjs',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['line']],
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    ...(process.platform === 'win32' ? { channel: 'chrome' } : {}),
  },
  outputDir: '../../output/playwright/physio-public-entry',
  webServer: {
    command: `npx vite --config e2e/physio-public-entry/vite.config.mjs --host 127.0.0.1 --port ${port}`,
    cwd: repositoryRoot,
    url: `${baseURL}/e2e/physio-public-entry/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
