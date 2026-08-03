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
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
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
    })
  );

  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(USER_EMAIL);
  await page.getByLabel('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/auth\/legal-consent$/);
  await expect(page.getByText('Terms of Service')).toBeVisible();

  await mockJson(
    page,
    '**/api/v1/legal/acceptances/complete-login',
    authResponse({
      redirect_required: true,
      continue_url: continueUrl,
      workspace: { slug: TENANT_SLUG, display_name: 'Acme Corp' },
    })
  );

  await mockJson(
    page,
    '**/api/v1/auth/session-exchange',
    authResponse({
      authenticated: true,
      workspace: { slug: TENANT_SLUG, display_name: 'Acme Corp' },
    })
  );

  await mockJson(
    page,
    '**/api/v1/auth/me',
    authResponse({
      authenticated: true,
      workspace: { slug: TENANT_SLUG, display_name: 'Acme Corp' },
    })
  );

  await page.getByRole('button', { name: 'Accept and continue' }).click();

  // Real cross-origin reload + lazy chunk load + session-exchange + /auth/me chain needs more
  // headroom than the default 5s assertion timeout.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: `Welcome, ${USER_EMAIL}` })).toBeVisible();
});
