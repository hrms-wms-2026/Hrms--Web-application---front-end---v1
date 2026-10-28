import { defineConfig, devices } from '@playwright/test';

/**
 * Live end-to-end runs against the local API (https://localhost:7229) and `npm start`, both already running with the
 * Meetings/Planner flags on. Unlike ./e2e (every API mocked), these write real data to the local database, so they run
 * one at a time and only on demand: `npx playwright test --config=playwright.live.config.ts`. The account comes from
 * E2E_EMAIL / E2E_PASSWORD (a development seed user), never from the repository.
 */
export default defineConfig({
  testDir: './e2e-live',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['line']],
  use: {
    baseURL: 'https://localhost:4200',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // The installed Chrome, so no Playwright browser download is needed. One login per run (auth.setup.ts), shared.
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    {
      name: 'chrome', dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], channel: 'chrome', storageState: 'playwright/.auth/live.json' },
    },
  ],
});
