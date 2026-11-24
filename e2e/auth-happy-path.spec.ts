import { test, expect, Page } from '@playwright/test';
import type { AuthResponseDto } from '../src/app/core/auth/models/dto/auth-response.dto';

/**
 * Exercises the real cross-subdomain hand-off end-to-end: login (base host) -> legal consent
 * (base host) -> browser redirect to the tenant subdomain's /auth/continue -> session exchange ->
 * dashboard. Only the four backend API calls are mocked; every navigation (including the
 * base-host -> tenant-host redirect) is a real browser navigation, since Chromium resolves
 * *.localhost to loopback and the Angular dev server accepts any Host header.
 */

const TENANT_SLUG = 'acme';
const USER_EMAIL = 'person@acme.com';

function authResponse(overrides: Partial<AuthResponseDto>): AuthResponseDto {
  return {
    authenticated: false,
    user: { email: USER_EMAIL },
    permissions: [],
    active_modules: [],
    must_change_password: false,
    mfa_required: false,
    legal_acceptance_required: false,
    pending_legal_documents: null,
    expires_at: null,
    continue_url: null,
    workspace: null,
    ...overrides,
  };
}

async function mockJson(page: Page, urlPattern: string, body: unknown): Promise<void> {
  await page.route(urlPattern, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

test('login -> legal consent -> tenant redirect -> dashboard', async ({ page, baseURL }) => {
  const tenantOrigin = new URL(baseURL!);
  tenantOrigin.hostname = `${TENANT_SLUG}.${tenantOrigin.hostname}`;
  const continueUrl = `${tenantOrigin.origin}/auth/continue?code=e2e-test-code`;

  await mockJson(
    page,
    '**/api/v1/auth/login',
    authResponse({
      legal_acceptance_required: true,
      pending_legal_documents: [
        {
          document_type: 'terms_of_service',
          version: '1.0',
          title: 'Terms of Service',
          effective_at: '2026-01-01T00:00:00Z',
          content_url: null,
        },
      ],
    }),
  );

  await mockJson(page, '**/api/v1/auth/google-config', { enabled: false, clientId: null });

  await page.goto('/auth/login');
  await page.getByPlaceholder('Work email').fill(USER_EMAIL);
  await page.getByPlaceholder('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Log In' }).click();

  await expect(page).toHaveURL(/\/auth\/legal-consent$/);
  await expect(page.getByText('Terms of Service')).toBeVisible();

  await mockJson(
    page,
    '**/api/v1/legal/acceptances/complete-login',
    authResponse({
      redirect_required: true,
      continue_url: continueUrl,
      workspace: { slug: TENANT_SLUG, display_name: 'Acme Corp' },
    }),
  );

  await mockJson(
    page,
    '**/api/v1/auth/session-exchange',
    authResponse({
      authenticated: true,
      workspace: { slug: TENANT_SLUG, display_name: 'Acme Corp' },
    }),
  );

  await mockJson(
    page,
    '**/api/v1/auth/me',
    authResponse({
      authenticated: true,
      workspace: { slug: TENANT_SLUG, display_name: 'Acme Corp' },
    }),
  );

  await page.getByRole('button', { name: 'Accept and continue' }).click();

  // Real cross-origin reload + lazy chunk load + session-exchange + /auth/me chain needs more
  // headroom than the default 5s assertion timeout.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  // The signed-in identity now shows as the navbar avatar inside "Profile and settings".
  await expect(
    page
      .getByRole('button', { name: 'Profile and settings' })
      .getByRole('img', { name: `${USER_EMAIL}'s avatar` }),
  ).toBeVisible({ timeout: 15_000 });
});

/**
 * Google sign-in (Phase 1: existing users only). Google Identity Services is replaced by a tiny
 * fake served at the real GIS URL: it records initialize(), draws a "Continue with Google" button
 * in renderButton() and fires the credential callback on click. No request ever reaches Google.
 */
test.describe('Google sign-in', () => {
  const GIS_URL = 'https://accounts.google.com/gsi/client';
  const FAKE_ID_TOKEN = 'e2e-fake-google-id-token';
  const TRAY_RETURN = '/device/activate?request_id=req-123&user_code=ABCD-1234';

  /** fireTwice simulates GIS delivering the same credential twice. */
  function fakeGisScript(fireTwice = false): string {
    return `
      window.__gisInit = [];
      window.google = { accounts: { id: {
        initialize: function (config) { window.__gisInit.push({ client_id: config.client_id, auto_select: config.auto_select, ux_mode: config.ux_mode }); window.__gisCallback = config.callback; },
        renderButton: function (host) {
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = 'Continue with Google';
          b.addEventListener('click', function () {
            window.__gisCallback({ credential: '${FAKE_ID_TOKEN}' });
            ${fireTwice ? `window.__gisCallback({ credential: '${FAKE_ID_TOKEN}' });` : ''}
          });
          host.appendChild(b);
        }
      } } };`;
  }

  async function serveFakeGis(page: Page, fireTwice = false): Promise<void> {
    await page.route(GIS_URL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: fakeGisScript(fireTwice),
      }),
    );
  }

  async function mockGoogleConfig(page: Page, enabled: boolean): Promise<void> {
    await mockJson(page, '**/api/v1/auth/google-config', {
      enabled,
      clientId: enabled ? 'e2e-client.apps.googleusercontent.com' : null,
    });
  }

  /**
   * /auth/me is host-aware like the real backend: the root host is never signed in (otherwise the
   * login route's redirectIfAuthenticatedGuard would bounce straight to the dashboard), a tenant
   * subdomain is signed in once its session exchange has run.
   */
  test.beforeEach(async ({ page, baseURL }) => {
    const rootHost = new URL(baseURL!).hostname;
    await page.route('**/api/v1/auth/me', (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host === rootHost || !host.endsWith(`.${rootHost}`)) {
        return route.fulfill({
          status: 401,
          contentType: 'application/problem+json',
          body: '{"status":401}',
        });
      }
      const slug = host.slice(0, -(rootHost.length + 1));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          authResponse({ authenticated: true, workspace: { slug, display_name: slug } }),
        ),
      });
    });
  });

  /** Tenant-host continuation: the one-time code exchange succeeds. */
  async function mockTenantContinuation(page: Page): Promise<void> {
    await page.route('**/api/v1/auth/session-exchange', (route) => {
      const slug = new URL(route.request().url()).hostname.split('.')[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          authResponse({ authenticated: true, workspace: { slug, display_name: slug } }),
        ),
      });
    });
  }

  function tenantContinueUrl(baseURL: string, slug = TENANT_SLUG): string {
    const tenant = new URL(baseURL);
    tenant.hostname = `${slug}.${tenant.hostname}`;
    return `${tenant.origin}/auth/continue?code=e2e-google-code`;
  }

  async function expectPasswordLoginUsable(page: Page): Promise<void> {
    await expect(page.getByPlaceholder('Work email')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toBeEnabled();
  }

  test('existing user signs in with Google and resumes tray device activation', async ({
    page,
    baseURL,
  }) => {
    await serveFakeGis(page);
    await mockGoogleConfig(page, true);
    await mockTenantContinuation(page);

    const googleBodies: unknown[] = [];
    await page.route('**/api/v1/auth/login/google', (route) => {
      googleBodies.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          authResponse({ redirect_required: true, continue_url: tenantContinueUrl(baseURL!) }),
        ),
      });
    });

    await page.goto(`/auth/login?returnUrl=${encodeURIComponent(TRAY_RETURN)}`);
    await page.getByRole('button', { name: 'Continue with Google' }).click();

    await expect(page).toHaveURL(
      (url) =>
        url.hostname.startsWith(`${TENANT_SLUG}.`) &&
        `${url.pathname}${url.search}` === TRAY_RETURN,
      { timeout: 15_000 },
    );
    expect(googleBodies).toEqual([{ google_id_token: FAKE_ID_TOKEN }]);
    expect(page.url()).not.toContain(FAKE_ID_TOKEN);
    const stored = await page.evaluate(
      () =>
        JSON.stringify({ ...localStorage }) +
        JSON.stringify({ ...sessionStorage }) +
        document.cookie,
    );
    expect(stored).not.toContain(FAKE_ID_TOKEN);
  });

  test('GIS is initialised without auto sign-in and with the configured client id', async ({
    page,
  }) => {
    await serveFakeGis(page);
    await mockGoogleConfig(page, true);

    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();

    const init = await page.evaluate(
      () => (window as unknown as { __gisInit: unknown[] }).__gisInit,
    );
    expect(init).toEqual([
      { client_id: 'e2e-client.apps.googleusercontent.com', auto_select: false, ux_mode: 'popup' },
    ]);
  });

  test('multi-workspace user picks a server-offered workspace', async ({ page, baseURL }) => {
    await serveFakeGis(page);
    await mockGoogleConfig(page, true);
    await mockTenantContinuation(page);
    await page.route('**/api/v1/auth/login/google', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          requires_workspace_selection: true,
          login_challenge: 'e2e-challenge',
          workspaces: [
            { slug: 'acme', displayName: 'Acme Corp' },
            { slug: 'beta', displayName: 'Beta Ltd' },
          ],
        }),
      }),
    );
    const selectBodies: unknown[] = [];
    await page.route('**/api/v1/auth/login/select-workspace', (route) => {
      selectBodies.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          authResponse({
            redirect_required: true,
            continue_url: tenantContinueUrl(baseURL!, 'beta'),
          }),
        ),
      });
    });

    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Continue with Google' }).click();

    const group = page.getByRole('group', { name: 'Choose a workspace' });
    await expect(group).toBeVisible();
    await expect(group.getByRole('radio')).toHaveCount(2);
    expect(page.url()).not.toContain('e2e-challenge');
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    await expect(continueButton).toBeDisabled();

    await page.getByRole('radio', { name: 'Beta Ltd' }).check();
    await continueButton.click();

    await expect(page).toHaveURL(
      (url) => url.hostname.startsWith('beta.') && url.pathname === '/dashboard',
      {
        timeout: 15_000,
      },
    );
    expect(selectBodies).toEqual([{ login_challenge: 'e2e-challenge', workspace: 'beta' }]);
  });

  test('expired workspace challenge returns the user to sign-in', async ({ page }) => {
    await serveFakeGis(page);
    await mockGoogleConfig(page, true);
    await page.route('**/api/v1/auth/login/google', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          requires_workspace_selection: true,
          login_challenge: 'e2e-challenge',
          workspaces: [
            { slug: 'acme', displayName: 'Acme Corp' },
            { slug: 'beta', displayName: 'Beta Ltd' },
          ],
        }),
      }),
    );
    await page.route('**/api/v1/auth/login/select-workspace', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 401 }),
      }),
    );

    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await page.getByRole('radio', { name: 'Acme Corp' }).check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect(page.getByText('That sign-in has expired. Please sign in again.')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Choose a workspace' })).toHaveCount(0);
    await expectPasswordLoginUsable(page);
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  });

  test('unknown Google user gets the generic failure and stays on login', async ({ page }) => {
    await serveFakeGis(page);
    await mockGoogleConfig(page, true);
    await page.route('**/api/v1/auth/login/google', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 401, detail: 'Invalid email or password.' }),
      }),
    );

    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Continue with Google' }).click();

    await expect(page.getByRole('alert')).toHaveText('Invalid email or password.');
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expectPasswordLoginUsable(page);
  });

  test('duplicate credential callback sends only one login request', async ({ page, baseURL }) => {
    await serveFakeGis(page, true);
    await mockGoogleConfig(page, true);
    await mockTenantContinuation(page);
    let googleCalls = 0;
    await page.route('**/api/v1/auth/login/google', async (route) => {
      googleCalls++;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          authResponse({ redirect_required: true, continue_url: tenantContinueUrl(baseURL!) }),
        ),
      });
    });

    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Continue with Google' }).click();

    await expect(page).toHaveURL((url) => url.pathname === '/dashboard', { timeout: 15_000 });
    expect(googleCalls).toBe(1);
  });

  test('unsafe external returnUrl is dropped after Google sign-in', async ({ page, baseURL }) => {
    await serveFakeGis(page);
    await mockGoogleConfig(page, true);
    await mockTenantContinuation(page);
    await mockJson(
      page,
      '**/api/v1/auth/login/google',
      authResponse({ redirect_required: true, continue_url: tenantContinueUrl(baseURL!) }),
    );

    await page.goto(`/auth/login?returnUrl=${encodeURIComponent('https://evil.example/steal')}`);
    await page.getByRole('button', { name: 'Continue with Google' }).click();

    await expect(page).toHaveURL(
      (url) => url.hostname.startsWith(`${TENANT_SLUG}.`) && url.pathname === '/dashboard',
      {
        timeout: 15_000,
      },
    );
    expect(page.url()).not.toContain('evil.example');
  });

  test('disabled Google shows no button and never loads GIS', async ({ page }) => {
    let gisRequested = false;
    await page.route(GIS_URL, (route) => {
      gisRequested = true;
      return route.abort();
    });
    await mockGoogleConfig(page, false);

    await page.goto('/auth/login');

    await expectPasswordLoginUsable(page);
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
    await expect(page.locator('.login-google-divider')).toHaveCount(0);
    expect(gisRequested).toBe(false);
  });

  test('blocked GIS script leaves password login usable', async ({ page }) => {
    await page.route(GIS_URL, (route) => route.abort('blockedbyclient'));
    await mockGoogleConfig(page, true);

    await page.goto('/auth/login');

    await expectPasswordLoginUsable(page);
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
    await expect(page.locator('.login-google')).toBeHidden();
  });
});
