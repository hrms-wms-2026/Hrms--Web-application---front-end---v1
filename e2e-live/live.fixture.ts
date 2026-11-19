import { test as base, expect, Page } from '@playwright/test';

/** The tenant host the seed workspace runs on, once logged in through https://localhost:4200. */
export const TENANT = 'https://dapi.localhost:4200';

/** Where auth.setup.ts saves the logged-in session (git-ignored). */
export const LIVE_AUTH_STATE = 'playwright/.auth/live.json';

/**
 * The tray-app gate binds a browser session to the desktop tray app with a code pasted into that app, which a test
 * browser cannot do. Only that one status call is answered here; every other request reaches the real API.
 */
export async function trayConnected(page: Page): Promise<void> {
  await page.route(/\/api\/v1\/monitoring\/activation\/status/, (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      required: false, connected: true, grace_period_seconds: 0, server_time: new Date().toISOString(),
      presence_valid_until: new Date(Date.now() + 3_600_000).toISOString(), device: null,
    }),
  }));
}

/** A page on the tenant home, signed in with the session auth.setup.ts saved, with the tray gate answered. */
export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    await trayConnected(page);
    await page.goto(`${TENANT}/`);
    await expect(page.getByRole('link', { name: 'Planner', exact: true }).first()).toBeVisible();
    await use(page);
  },
});

export { expect };
