import { test, expect, Page } from '@playwright/test';
import type { AuthResponseDto } from '../src/app/core/auth/models/dto/auth-response.dto';

/**
 * End-to-end coverage for the Work Management Projects module: nav gating on projects:access,
 * the project list (with filters), Create Project, Project Detail, and the read-only milestone
 * drill-down. All API calls are mocked via page.route — only real browser navigation/rendering
 * is exercised, matching the auth-happy-path.spec.ts convention in this same folder.
 */

const WORKSPACE = { slug: 'acme', display_name: 'Acme Corp' };
const USER_EMAIL = 'lead@acme.com';

function authResponse(overrides: Partial<AuthResponseDto> = {}): AuthResponseDto {
  return {
    authenticated: true,
    user: { email: USER_EMAIL },
    permissions: ['projects:access'],
    active_modules: ['worksync_foundation', 'projects', 'objectives_milestones'],
    must_change_password: false,
    mfa_required: false,
    legal_acceptance_required: false,
    pending_legal_documents: null,
    expires_at: null,
    continue_url: null,
    workspace: WORKSPACE,
    ...overrides,
  };
}

async function mockJson(page: Page, urlPattern: string, body: unknown): Promise<void> {
  await page.route(urlPattern, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  );
}

/** Mocks the two calls every authenticated layout render makes, regardless of which page loads. */
async function mockSessionAndLayout(page: Page, auth: AuthResponseDto): Promise<void> {
  await mockJson(page, '**/api/v1/auth/me', auth);
  await mockJson(page, '**/api/v1/org/legal-entities*', [
    { id: 'legal-1', name: 'Acme Corp', companyCode: 'ACME', logoFileId: null, isActive: true, isPrimary: true },
  ]);
}

const PROJECT_LEAD = {
  id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
  startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
  allocatedHours: 40, completedHours: 10, isLead: true, isAchieved: false, achievedAt: null,
};

const CATEGORIES = [{ id: 'cat1', name: 'Backend' }];

test.describe('Work Management - Projects', () => {
  test('Work nav item is visible for a user with projects:access, and opens the project list', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse());
    await mockJson(page, '**/api/v1/work/projects/mine*', {
      items: [PROJECT_LEAD], pageNumber: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasNext: false, hasPrevious: false,
    });
    await mockJson(page, '**/api/v1/work/project-categories*', CATEGORIES);

    await page.goto('/dashboard');
    const workLink = page.getByRole('link', { name: 'Work' });
    await expect(workLink).toBeVisible();
    await workLink.click();

    await expect(page).toHaveURL(/\/work$/);
    await expect(page.getByText('Website Revamp')).toBeVisible();
    await expect(page.getByText('WEB', { exact: true })).toBeVisible();
  });

  test('Work nav item is hidden for a user without projects:access', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse({ permissions: [] }));

    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Work' })).toHaveCount(0);
  });

  test('redirects away from /work when navigated directly without projects:access', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse({ permissions: [] }));

    await page.goto('/work');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('shows the empty state when the caller has no projects', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse());
    await mockJson(page, '**/api/v1/work/projects/mine*', {
      items: [], pageNumber: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false,
    });
    await mockJson(page, '**/api/v1/work/project-categories*', CATEGORIES);

    await page.goto('/work');
    await expect(page.getByText('No projects yet')).toBeVisible();
  });

  test('creates a project via the Create popup and the new project appears in the list', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse());

    let created = false;
    await page.route('**/api/v1/work/projects/mine*', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          items: created ? [PROJECT_LEAD] : [],
          pageNumber: 1, pageSize: 20, totalCount: created ? 1 : 0, totalPages: created ? 1 : 0,
          hasNext: false, hasPrevious: false,
        }),
      })
    );
    await mockJson(page, '**/api/v1/work/project-categories*', CATEGORIES);
    await page.route('**/api/v1/work/projects', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      created = true;
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ project: { id: 'p1', name: 'Website Revamp' } }),
      });
    });

    await page.goto('/work');
    await expect(page.getByText('No projects yet')).toBeVisible();

    await page.getByRole('button', { name: '+ Create project' }).first().click();
    await page.locator('[data-testid="name-field"] input').fill('Website Revamp');
    await page.locator('[data-testid="identifier-field"] input').fill('WEB');
    await page.locator('[data-testid="category-field"] select').selectOption('cat1');
    await page.locator('[data-testid="start-date-field"] input').fill('2026-08-01');
    await page.locator('[data-testid="target-date-field"] input').fill('2026-12-01');
    await page.locator('[data-testid="release-date-field"] input').fill('2026-11-15');
    await page.locator('[data-testid="allocated-hours-field"] input').fill('40');
    await page.locator('[data-testid="submit-button"] button').click();

    await expect(page.getByText('Website Revamp')).toBeVisible();
  });

  test('Project Detail shows milestones and drills into a milestone subtree', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse());
    await mockJson(page, '**/api/v1/work/projects/mine*', {
      items: [PROJECT_LEAD], pageNumber: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasNext: false, hasPrevious: false,
    });
    await mockJson(page, '**/api/v1/work/project-categories*', CATEGORIES);
    await mockJson(page, '**/api/v1/work/projects/p1', {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: 'Rebuild the site',
      leadId: 'u1', startDate: '2026-08-01', targetDate: '2026-12-01', color: null, actualHours: 0,
      allocatedHours: 40, completedHours: 10, isActive: true, isAchieved: false, achievedAt: null,
      createdAt: '2026-08-01T00:00:00Z', updatedAt: null, isLead: true,
    });
    await mockJson(page, '**/api/v1/work/projects/p1/objectives/mine', [
      {
        objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
        ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
        startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 10,
        objectiveIsActive: true, isAchieved: false, achievedAt: null, membershipIsActive: true, membershipRemovedAt: null,
      },
    ]);
    await mockJson(page, '**/api/v1/work/objectives/o1/tree', {
      parentObjective: null,
      objective: {
        id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
        description: null, ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
        startDate: '2026-08-01', endDate: '2026-12-01', progress: 25, actualHours: null,
        allocatedHours: 40, completedHours: 10, isActive: true, createdAt: '2026-08-01T00:00:00Z',
        updatedAt: null, children: [],
      },
    });

    await page.goto('/work');
    await page.getByRole('button', { name: 'View' }).click();

    await expect(page).toHaveURL(/\/work\/p1$/);
    await expect(page.getByRole('heading', { name: 'Website Revamp' })).toBeVisible();
    await expect(page.getByText('Default')).toBeVisible();
    await expect(page.getByText('Jane Doe')).toBeVisible();

    await page.getByText('Default').click();
    await expect(page.locator('app-milestone-tree-node').getByText('25%')).toBeVisible();
  });
});
