import { test, expect, Page } from '@playwright/test';
import type { AuthResponseDto } from '../src/app/core/auth/models/dto/auth-response.dto';

/**
 * Golden path for Leave Management: an employee submits a request, a manager approves it,
 * and the employee's balance reflects the approval. All API calls are mocked via page.route —
 * matching e2e/work-management-projects.spec.ts's convention — no real backend/database.
 */

const WORKSPACE = { slug: 'acme', display_name: 'Acme Corp' };

function authResponse(overrides: Partial<AuthResponseDto> = {}): AuthResponseDto {
  return {
    authenticated: true,
    user: { email: 'employee@acme.com' },
    permissions: ['leave:read-own'],
    active_modules: ['worksync_foundation', 'leave'],
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

async function mockSessionAndLayout(page: Page, auth: AuthResponseDto): Promise<void> {
  await mockJson(page, '**/api/v1/auth/me', auth);
  await mockJson(page, '**/api/v1/org/legal-entities*', [
    { id: 'legal-1', name: 'Acme Corp', companyCode: 'ACME', logoFileId: null, isActive: true, isPrimary: true },
  ]);
}

const LEAVE_TYPE = {
  id: 'type-1', name: 'Annual Leave', code: 'ANNUAL', description: null, category: 'annual', isPaid: true,
  requiresApproval: true, requiresDocument: false, documentRequiredAfterDays: null, acceptedDocumentTypes: [],
  maxConsecutiveDays: null, defaultDaysPerYear: 20, carryForwardAllowed: true, maxCarryForwardDays: 5,
  carryForwardExpiryMonths: 3, proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 0,
  isActive: true, createdAt: '2026-08-21T00:00:00Z',
};

const BALANCE_BEFORE = {
  employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman', departmentId: null, departmentName: null,
  legalEntityId: null, legalEntityName: null, leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL',
  year: 2026, entitledHours: 160, annualHours: 160, carriedForwardHours: 0, usedHours: 0, pendingHours: 0, remainingHours: 160,
  isNegative: false, carryForwardExpiresOn: null,
};

test.describe('Leave Management - golden path', () => {
  test('employee sees My Balances with their leave balance', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse());
    await mockJson(page, '**/api/v1/leave/types*', [LEAVE_TYPE]);
    await mockJson(page, '**/api/v1/leave/balances/my*', [BALANCE_BEFORE]);
    await mockJson(page, '**/api/v1/leave/requests/my*', []);

    await page.goto('/time-off');
    await expect(page.getByText('Annual Leave')).toBeVisible();
    await expect(page.getByTestId('balance-remaining')).toHaveText('160.00');
  });

  test('employee can open the New Request wizard', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse());
    await mockJson(page, '**/api/v1/leave/types*', [LEAVE_TYPE]);
    await mockJson(page, '**/api/v1/leave/balances/my*', [BALANCE_BEFORE]);
    await mockJson(page, '**/api/v1/leave/requests/my*', []);
    await mockJson(page, '**/api/v1/leave/balances/work-window*', {
      workStartTime: '09:00', workEndTime: '18:00', breakDurationMinutes: 60, timezone: 'UTC',
    });

    await page.goto('/time-off');
    await page.getByTestId('new-request-button').click();
    await expect(page.getByText('New Leave Request')).toBeVisible();
    await expect(page.getByTestId('leave-type-select')).toBeVisible();
  });

  test('manager sees Pending Approvals page', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse({ user: { email: 'manager@acme.com' }, permissions: ['leave:approve'] }));
    await mockJson(page, '**/api/v1/leave/types*', [LEAVE_TYPE]);
    await mockJson(page, '**/api/v1/leave/requests/pending-approvals*', [{
      requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1',
      leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10T09:00:00.000Z', endAt: '2026-09-12T18:00:00.000Z',
      totalHours: 24, paidHours: 24, unpaidHours: 0, status: 'pending', submittedAt: '2026-08-30T00:00:00Z',
    }]);

    await page.goto('/time-off/team-approvals');
    await expect(page.getByText('Anu Raman')).toBeVisible();
    await expect(page.getByTestId('approval-row').first()).toBeVisible();
  });

  test('manager can open and approve a pending request', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse({ user: { email: 'manager@acme.com' }, permissions: ['leave:approve'] }));
    await mockJson(page, '**/api/v1/leave/types*', [LEAVE_TYPE]);
    await mockJson(page, '**/api/v1/leave/requests/pending-approvals*', [{
      requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1',
      leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10T09:00:00.000Z', endAt: '2026-09-12T18:00:00.000Z',
      totalHours: 24, paidHours: 24, unpaidHours: 0, status: 'pending', submittedAt: '2026-08-30T00:00:00Z',
    }]);
    await mockJson(page, '**/api/v1/leave/requests/req-1/approval', {
      requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1',
      leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10T09:00:00.000Z', endAt: '2026-09-12T18:00:00.000Z',
      totalHours: 24, paidHours: 24, unpaidHours: 0, status: 'pending', reason: null,
      approvers: [], infoMessages: [], submissionConflictSnapshotJson: null, currentWarnings: [], remainingHours: 136,
    });
    await mockJson(page, '**/api/v1/leave/requests/req-1/approve', {
      requestId: 'req-1', status: 'approved', currentApproverState: 'complete',
      paidHoursMovedFromPending: 24, unpaidHours: 0, remainingHours: 136, currentWarnings: [],
    });

    await page.goto('/time-off/team-approvals');
    await page.getByTestId('approval-row').first().click();
    await expect(page.getByTestId('action-approve')).toBeVisible();
    await page.getByTestId('action-approve').click();
    await page.getByRole('button', { name: 'Confirm approve' }).click();
    await expect(page.getByText('Request approved.')).toBeVisible();
  });

  test('employee can submit a leave request through the wizard', async ({ page }) => {
    const preview = {
      id: 'req-new', employeeId: 'emp-1', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL',
      startAt: '2026-09-10T09:00:00.000Z', endAt: '2026-09-12T18:00:00.000Z', totalHours: 24, paidHours: 24, unpaidHours: 0,
      status: 'pending', noticePeriodMissed: false, submittedOnBehalfOfBy: null,
      balanceImpact: { currentRemainingHours: 160, pendingAfterSubmitHours: 24, remainingAfterSubmitHours: 136 },
      approvers: [], conflictSnapshot: { warnings: [], calendarConflicts: [], teamAbsencePercent: null },
      createdAt: '2026-09-01T00:00:00Z',
    };

    await mockSessionAndLayout(page, authResponse());
    await mockJson(page, '**/api/v1/leave/types*', [LEAVE_TYPE]);
    await mockJson(page, '**/api/v1/leave/balances/my*', [BALANCE_BEFORE]);
    await mockJson(page, '**/api/v1/leave/requests/my*', []);
    await mockJson(page, '**/api/v1/leave/balances/work-window*', {
      workStartTime: '09:00', workEndTime: '18:00', breakDurationMinutes: 60, timezone: 'UTC',
    });
    await page.route('**/api/v1/leave/requests/preview', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(preview) })
    );
    await page.route('**/api/v1/leave/requests', (route) => {
      if (route.request().method() === 'POST' && !route.request().url().includes('/preview') && !route.request().url().includes('/my')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(preview) });
      }
      return route.continue();
    });

    await page.goto('/time-off');
    await page.getByTestId('new-request-button').click();
    await page.getByTestId('leave-type-select').selectOption('type-1');
    await page.getByRole('button', { name: 'Continue' }).click();
    await pickDate(page, 'From date', 10);
    await pickDate(page, 'To date', 12);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Total leave hours')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByTestId('request-review')).toContainText('Annual Leave');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('New Leave Request')).toHaveCount(0);
  });

  test('employee balance drops after approval', async ({ page }) => {
    const balanceAfter = { ...BALANCE_BEFORE, usedHours: 24, remainingHours: 136 };
    await mockSessionAndLayout(page, authResponse());
    await mockJson(page, '**/api/v1/leave/types*', [LEAVE_TYPE]);
    await mockJson(page, '**/api/v1/leave/balances/my*', [balanceAfter]);
    await mockJson(page, '**/api/v1/leave/requests/my*', []);

    await page.goto('/time-off');
    await expect(page.getByText('Annual Leave')).toBeVisible();
    await expect(page.getByTestId('balance-remaining')).toHaveText('136.00');
  });
});

async function pickDate(page: Page, label: string, dayOfMonth: number): Promise<void> {
  const field = page.locator('.dp-container').filter({ hasText: label });
  await field.getByLabel('Open calendar picker').click();
  await field.locator('.dp-day-btn:not(.dp-day-btn--outside)').filter({ hasText: new RegExp(`^${dayOfMonth}$`) }).click();
}
