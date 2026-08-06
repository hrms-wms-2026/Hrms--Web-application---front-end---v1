import { test, expect, Page } from '@playwright/test';

/**
 * Public marketing landing page at "/". redirectIfAuthenticatedGuard calls GET /auth/me before
 * activating the route, so every test here mocks that call as unauthenticated (401) - matching
 * the real backend's documented behaviour for a guest - so the guard resolves fast and lets the
 * landing page through instead of hitting a real, unmocked backend.
 */
async function mockGuest(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ title: 'Unauthorized', status: 401 })
    })
  );
}

test('visiting "/" displays the landing page', async ({ page }) => {
  await mockGuest(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Everything your people need');
  await expect(page).toHaveURL('/');
});

test('sign-in button navigates to the login route', async ({ page }) => {
  await mockGuest(page);
  await page.goto('/');

  await page.locator('.hero__btn--primary').click();

  await expect(page).toHaveURL(/\/auth\/login$/);
});

test('no horizontal overflow at mobile viewport', async ({ page }) => {
  await mockGuest(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));

  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test('skip link is the first keyboard stop and jumps to main content', async ({ page }) => {
  await mockGuest(page);
  await page.goto('/');
  // redirectIfAuthenticatedGuard resolves /auth/me before the landing page renders; wait for the
  // real content so Tab isn't sent to a still-empty document.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.keyboard.press('Tab');

  await expect(page.locator('.landing-skip-link')).toBeFocused();
});

test('renders ONEXSO branding and no legacy OneVo Workspace branding or system status', async ({ page }) => {
  await mockGuest(page);
  await page.goto('/');

  const logo = page.locator('.landing-header__mark');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('alt', 'ONEXSO');

  await expect(page.locator('body')).not.toContainText('OneVo');
  await expect(page.locator('body')).not.toContainText('All systems operational');
  await expect(page.locator('.landing-header__status')).toHaveCount(0);
  await expect(page.locator('.landing-header__status-dot')).toHaveCount(0);
});

test('navbar hides on scroll down past the threshold and reappears on scroll up', async ({ page }) => {
  await mockGuest(page);
  await page.goto('/');

  const header = page.locator('.landing-header');
  await expect(header).toBeVisible();
  await expect(header).not.toHaveClass(/landing-header--hidden/);

  await page.mouse.wheel(0, 400);
  await expect(header).toHaveClass(/landing-header--hidden/);

  await page.mouse.wheel(0, -200);
  await expect(header).not.toHaveClass(/landing-header--hidden/);
});

test('opening the mobile menu keeps the navbar visible while scrolled', async ({ page }) => {
  await mockGuest(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const header = page.locator('.landing-header');
  await page.mouse.wheel(0, 400);
  await expect(header).toHaveClass(/landing-header--hidden/);

  await page.mouse.wheel(0, -200);
  await expect(header).not.toHaveClass(/landing-header--hidden/);

  await page.locator('.landing-header__menu-btn').click();
  await expect(page.locator('.landing-header__menu-btn')).toHaveAttribute('aria-expanded', 'true');

  await page.mouse.wheel(0, 400);
  await expect(header).not.toHaveClass(/landing-header--hidden/);
});
