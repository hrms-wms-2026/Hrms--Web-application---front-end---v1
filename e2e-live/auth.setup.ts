import { test as setup, expect } from '@playwright/test';
import { LIVE_AUTH_STATE, TENANT, trayConnected } from './live.fixture';

/**
 * Logs in once per run and saves the session for every live test: the API allows five logins per email in five
 * minutes, so a login per test would lock the account out after a couple of runs.
 */
setup('log in', async ({ page }) => {
  const email = process.env['E2E_EMAIL'];
  const password = process.env['E2E_PASSWORD'];
  if (!email || !password) throw new Error('Set E2E_EMAIL and E2E_PASSWORD (a development seed user).');
  await trayConnected(page);
  await page.goto('/auth/login');
  await page.getByPlaceholder('Work email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
  // Fail at once on the login limiter or bad credentials instead of waiting out the timeout.
  const refused = page.getByRole('alert');
  await Promise.race([
    page.waitForURL(`${TENANT}/**`),
    refused.waitFor().then(async () => { throw new Error(`Login refused: ${await refused.innerText()}`); }),
  ]);
  await expect(page.getByRole('link', { name: 'Planner', exact: true }).first()).toBeVisible();
  await page.context().storageState({ path: LIVE_AUTH_STATE });
});
