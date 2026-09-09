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
  year: 2026, entitledHours: 20, annualHours: 20, carriedForwardHours: 0, usedHours: 0, pendingHours: 0, remainingHours: 20,
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
    await expect(page.getByText('20')).toBeVisible();
  });

  test('employee can open the New Request wizard', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse());
    await mockJson(page, '**/api/v1/leave/types*', [LEAVE_TYPE]);
    await mockJson(page, '**/api/v1/leave/balances/my*', [BALANCE_BEFORE]);
    await mockJson(page, '**/api/v1/leave/requests/my*', []);

    await page.goto('/time-off');
    await page.getByTestId('new-request-button').click();
    await expect(page.getByText('New Leave Request')).toBeVisible();
    await expect(page.getByTestId('leave-type-select')).toBeVisible();
  });

  test('manager sees Pending Approvals page', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse({ user: { email: 'manager@acme.com' }, permissions: ['leave:approve'] }));
    await mockJson(page, '**/api/v1/leave/requests/pending-approvals*', [{
      requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1',
      leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10T00:00:00Z', endAt: '2026-09-12T00:00:00Z',
      totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', submittedAt: '2026-08-30T00:00:00Z',
    }]);

    await page.goto('/time-off/team-approvals');
    await expect(page.getByText('Anu Raman')).toBeVisible();
    await expect(page.getByTestId('approval-row').first()).toBeVisible();
  });

  test('manager can open and approve a pending request', async ({ page }) => {
    await mockSessionAndLayout(page, authResponse({ user: { email: 'manager@acme.com' }, permissions: ['leave:approve'] }));
    await mockJson(page, '**/api/v1/leave/requests/pending-approvals*', [{
      requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1',
      leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10T00:00:00Z', endAt: '2026-09-12T00:00:00Z',
      totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', submittedAt: '2026-08-30T00:00:00Z',
    }]);
    await mockJson(page, '**/api/v1/leave/requests/req-1/approval', {
      requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1',
      leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10T00:00:00Z', endAt: '2026-09-12T00:00:00Z',
      totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', reason: null,
      approvers: [], infoMessages: [], submissionConflictSnapshotJson: null, currentWarnings: [], remainingHours: 17,
    });
    await mockJson(page, '**/api/v1/leave/requests/req-1/approve', {
      requestId: 'req-1', status: 'approved', currentApproverState: 'complete',
      paidHoursMovedFromPending: 3, unpaidHours: 0, remainingHours: 17, currentWarnings: [],
    });

    await page.goto('/time-off/team-approvals');
    await page.getByTestId('approval-row').first().click();
    await expect(page.getByTestId('action-approve')).toBeVisible();
    await page.getByTestId('action-approve').click();
    await page.getByRole('button', { name: 'Confirm approve' }).click();
    await expect(page.getByText('Request approved.')).toBeVisible();
  });

  test('employee balance drops after approval', async ({ page }) => {
    const balanceAfter = { ...BALANCE_BEFORE, usedHours: 3, remainingHours: 17 };
    await mockSessionAndLayout(page, authResponse());
    await mockJson(page, '**/api/v1/leave/types*', [LEAVE_TYPE]);
    await mockJson(page, '**/api/v1/leave/balances/my*', [balanceAfter]);
    await mockJson(page, '**/api/v1/leave/requests/my*', []);

    await page.goto('/time-off');
    await expect(page.getByText('Annual Leave')).toBeVisible();
    await expect(page.getByText('17')).toBeVisible();
  });
});
