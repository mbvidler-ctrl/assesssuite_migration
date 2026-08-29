import { defineConfig } from '@playwright/test';

const port = Number(process.env.EP_ASSESSMENT_BROWSER_TEST_PORT || 4181);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: '.',
  testMatch: 'ep-assessment-runner.spec.mjs',
  fullyParallel: false,
  workers: 1,
  // Windows cold transforms include the full canonical catalogue and legacy
  // runner graph.  The server is healthy, but that first deterministic
  // transform can exceed 30 seconds on the release workstation.
  timeout: 120_000,
  expect: {
    timeout: 60_000,
  },
  reporter: [['line']],
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1365, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    ...(process.platform === 'win32' ? { channel: 'chrome' } : {}),
  },
  outputDir: '../../output/playwright/ep-assessment-runner',
  webServer: {
    command: `npx vite --config vite.config.mjs --host 127.0.0.1 --port ${port}`,
    env: {
      ...process.env,
      VITE_PROFESSION: 'exercise-physiology',
      VITE_BASE44_APP_ID: 'local-assesssuite',
    },
    url: `${baseURL}/e2e/ep-assessment-runner/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
