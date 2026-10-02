import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { EmployeeDetailComponent } from './employee-detail.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { WorkModeStore } from '../../../settings/state/work-mode.store';
import { EmployeeDirectoryStore } from '../../../work/state/employee-directory.store';

describe('EmployeeDetailComponent', () => {
  const detailFixture: EmployeeDetailResponse = {
    id: 'emp-1',
    jobInformation: {
      employeeNumber: 'E-001',
      legalEntityId: 'le-1',
      legalEntityName: 'Acme Corp',
      departmentName: 'Engineering',
      positionName: 'Software Engineer',
      positionId: 'pos-1',
      reportingManagerName: 'Grace Hopper',
      employmentTypeLabel: 'Full time',
      status: 'active',
      hireDate: '2024-01-15',
      probationEndDate: null,
      workModeLabel: 'Remote',
      employmentTypeCode: 'full_time',
      workModeId: 'wm-1'
    },
    personalInformation: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@test.dev',
      phone: null,
      dateOfBirth: null,
      gender: null,
      nationalityId: null,
      addresses: []
    },
    emergencyContacts: [],
    payroll: null,
    invitationStatus: null,
    invitationExpiresAt: null,
    trayAppAccessEnabled: false
  };

  function setup(
    employee: EmployeeDetailResponse,
    apiOverrides: Partial<PeopleApiService> = {},
    hasWritePermission = true,
    currentEmployeeId: string | null = 'emp-99',
    hasOffboardPermission = true
  ) {
    const apiStub = {
      getEmployeeDetail: vi.fn().mockReturnValue(of(employee)),
      resendInvitation: vi.fn().mockReturnValue(of({ expiresAt: '2026-08-25T00:00:00Z' })),
      changePosition: vi.fn().mockReturnValue(of({ pendingApproval: false })),
      getJobJourney: vi.fn().mockReturnValue(of([])),
      getWorkGraph: vi.fn().mockReturnValue(of({ nodes: [], links: [], hiddenTaskCount: 0 })),
      listEmployees: vi.fn().mockReturnValue(of({ items: [], totalCount: 0, page: 1, pageSize: 3 })),
      getOverviewAttendance: vi.fn().mockReturnValue(
        of({ from: '2026-09-01', to: '2026-09-30', workingDays: 0, present: 0, late: 0, missingClockOuts: 0, leaveDays: 0, days: [] })
      ),
      getOverviewAttendanceDiscipline: vi.fn().mockReturnValue(
        of({ from: '2026-09-01', to: '2026-09-30', lateClockIns: 0, earlyClockOuts: 0, missingClockOuts: 0, overBreakDays: 0, overBreakMinutes: 0, locationTrackingEnabled: false, locationViolations: null })
      ),
      getOverviewTimeOff: vi.fn().mockReturnValue(of({ year: 2026, balances: [], nextLeave: null })),
      getOverviewWork: vi.fn().mockReturnValue(
        of({ from: '', to: '', assigned: 0, completed: 0, inProgress: 0, overdue: 0, notStarted: 0, completionRatePercent: 0, onTimeRatePercent: null })
      ),
      getOverviewDelivery: vi.fn().mockReturnValue(
        of({ from: '', to: '', tasksAssigned: 0, tasksCompleted: 0, onTimeCompleted: 0, completedWithDueDate: 0, storyPointsAssigned: 0, storyPointsCompleted: 0, previous: null })
      ),
      getOverviewActivity: vi.fn().mockReturnValue(
        of({ from: '', to: '', activityMonitoringEnabled: true, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0, daysWithData: 0, previous: null })
      ),
      getOverviewApprovals: vi.fn().mockReturnValue(
        of({ from: '', to: '', pending: 0, approved: 0, rejected: 0, total: 0, items: [] })
      ),
      getOverviewSignals: vi.fn().mockReturnValue(of({ from: '', to: '', signals: [] })),
      getOverviewAttendanceDays: vi.fn().mockReturnValue(of({ from: '', to: '', timezone: 'UTC', days: [] })),
      getOverviewWorkTasks: vi.fn().mockReturnValue(of({ from: '', to: '', items: [] })),
      getOverviewUpcoming: vi.fn().mockReturnValue(of({ from: '', to: '', items: [] })),
      getOverviewChecklists: vi.fn().mockReturnValue(of({ groups: [] })),
      getOverviewHistory: vi.fn().mockReturnValue(of({ events: [] })),
      getOverviewRecentActivity: vi.fn().mockReturnValue(of({ items: [], nextBefore: null, isPartial: true })),
      ...apiOverrides
    };
    const notificationsStub = { success: vi.fn(), error: vi.fn() };
    // The Change Position modal (Task 4) fetches positions for the legal entity as soon as it
    // opens; stub it out so opening the modal in these tests never issues a real HTTP request.
    const positionApiStub = { listFlat: vi.fn().mockReturnValue(of({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 })) };
    const permissionServiceStub = {
      hasPermission: (p: string) => (p === 'employees:write' ? hasWritePermission : p === 'employees:offboard' ? hasOffboardPermission : true)
    };
    // EmployeeJobInfoComponent (rendered as a real child on the Job tab) injects the real,
    // providedIn: 'root' WorkModeStore, which would otherwise pull in WorkModeApiService ->
    // HttpClient - neither is provided in this spec file, so every test would fail to construct
    // the component tree without this stub.
    const workModeStoreStub = {
      items: signal([]) as any,
      atCap: signal(false) as any,
      loading: signal(false) as any,
      saving: signal(false) as any,
      error: signal(null) as any,
      load: vi.fn() as any,
      create: vi.fn() as any,
      update: vi.fn() as any,
      deactivate: vi.fn() as any
    };
    const employeeDirectoryStub = {
      get: vi.fn((id: string) => id === employee.id
        ? { id, name: `${employee.personalInformation.firstName} ${employee.personalInformation.lastName}`, initials: 'AL', avatarUrl: 'https://api.test/files/avatar-1' }
        : undefined),
      ensureLoaded: vi.fn().mockResolvedValue(undefined),
      seed: vi.fn()
    };

    TestBed.configureTestingModule({
      imports: [EmployeeDetailComponent],
      providers: [
        provideRouter([]),
        { provide: PeopleApiService, useValue: apiStub },
        { provide: NotificationService, useValue: notificationsStub },
        { provide: PositionApiService, useValue: positionApiStub },
        { provide: PermissionService, useValue: permissionServiceStub },
        { provide: AuthStore, useValue: { employeeId: () => currentEmployeeId } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'emp-1' } } } },
        { provide: OffboardingApiService, useValue: { getOffboarding: () => of(null) } },
        { provide: WorkModeStore, useValue: workModeStoreStub },
        { provide: EmployeeDirectoryStore, useValue: employeeDirectoryStub }
      ]
    });

    const fixture = TestBed.createComponent(EmployeeDetailComponent);
    return { fixture, apiStub, notificationsStub, employeeDirectoryStub };
  }

  it('shows the loader while the employee is loading', () => {
    const subject = new Subject<EmployeeDetailResponse>();
    const { fixture } = setup(detailFixture, { getEmployeeDetail: vi.fn().mockReturnValue(subject.asObservable()) });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading employee');

    subject.next(detailFixture);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Loading employee');
  });

  it('shows the error state with a retry action that reissues the request', () => {
    const getEmployeeDetail = vi.fn()
      .mockReturnValueOnce(throwError(() => new Error('boom')))
      .mockReturnValueOnce(of(detailFixture));
    const { fixture } = setup(detailFixture, { getEmployeeDetail });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('boom');

    const retryButton: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
    retryButton?.click();
    fixture.detectChanges();

    expect(getEmployeeDetail).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
  });

  it('renders the Overview tab first, then Employment and Personal on request', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.activeTab()).toBe('overview');
    expect(el.querySelector('app-employee-overview-tab')).toBeTruthy();
    // Employment is not mounted until it is first opened.
    expect(el.querySelector('app-employee-employment-tab')).toBeFalsy();
    expect(el.querySelector('app-employee-personal-tab')).toBeFalsy();

    fixture.componentInstance.selectTab('employment');
    fixture.detectChanges();
    expect(el.querySelector('app-employee-employment-tab')?.hasAttribute('hidden')).toBe(false);
    expect(el.querySelector('app-employee-job-info')).toBeTruthy();
    expect(el.querySelector('app-employee-overview-tab')).toBeFalsy();

    fixture.componentInstance.selectTab('personal');
    fixture.detectChanges();
    expect(el.querySelector('app-employee-personal-tab')).toBeTruthy();
    expect(el.querySelector('app-employee-personal-info')).toBeTruthy();
    expect(el.querySelector('app-employee-emergency-contacts')).toBeTruthy();
    expect(el.querySelector('app-employee-employment-tab')?.hasAttribute('hidden')).toBe(true);
  });

  it('lists the tabs in the order Overview, Employment, Personal', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('nav[aria-label="Employee Detail Sections"] button')
    ).map((b) => (b as HTMLElement).textContent?.trim());

    expect(labels).toEqual(['Overview', 'Employment', 'Personal']);
  });

  it('waits for the Employment tab before loading the job journey and work graph', () => {
    const { fixture, apiStub } = setup(detailFixture);
    fixture.detectChanges();

    expect(apiStub.getJobJourney).not.toHaveBeenCalled();
    expect(apiStub.getWorkGraph).not.toHaveBeenCalled();

    fixture.componentInstance.selectTab('employment');
    fixture.detectChanges();

    expect(apiStub.getJobJourney).toHaveBeenCalledTimes(1);
    expect(apiStub.getWorkGraph).toHaveBeenCalledTimes(1);
  });

  it('does not reload the work graph or journey when switching to Personal and back to Employment', () => {
    const { fixture, apiStub } = setup(detailFixture);
    fixture.detectChanges();
    fixture.componentInstance.selectTab('employment');
    fixture.detectChanges();

    fixture.componentInstance.selectTab('personal');
    fixture.detectChanges();
    fixture.componentInstance.selectTab('employment');
    fixture.detectChanges();

    expect(apiStub.getWorkGraph).toHaveBeenCalledTimes(1);
    expect(apiStub.getJobJourney).toHaveBeenCalledTimes(1);
  });

  it('shows the month and Compare controls in the header only on the Overview tab', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-employee-period-controls button[title="Previous month"]')).toBeTruthy();
    expect([...el.querySelectorAll('app-employee-period-controls button')].some((b) => b.textContent?.includes('Compare'))).toBe(true);

    fixture.componentInstance.selectTab('personal');
    fixture.detectChanges();
    expect(el.querySelector('app-employee-period-controls')).toBeFalsy();
  });

  it('switches tabs when a tab button is clicked', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    const personalButton = Array.from(
      fixture.nativeElement.querySelectorAll('nav[aria-label="Employee Detail Sections"] button')
    ).find((b) => (b as HTMLElement).textContent?.trim() === 'Personal') as HTMLButtonElement;
    personalButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('personal');
  });

  it('renders the Payroll section in the Personal tab when the response includes it', () => {
    const { fixture } = setup({
      ...detailFixture,
      payroll: { hasBankDetailsOnFile: true, bankName: 'Test Bank', maskedAccountNumber: '****1234', accountType: 'checking' }
    });
    fixture.detectChanges();

    fixture.componentInstance.activeTab.set('personal');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-employee-payroll')).toBeTruthy();
  });

  it('omits the Payroll section when the response does not include it', () => {
    const { fixture } = setup({ ...detailFixture, payroll: null });
    fixture.detectChanges();

    fixture.componentInstance.activeTab.set('personal');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-employee-payroll')).toBeFalsy();
  });

  it('removes the marked metadata and outer border from the profile header', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('[data-testid="employee-profile-header"]') as HTMLElement;
    expect(header.classList.contains('border')).toBe(false);
    expect(header.textContent).not.toContain('E-001');
    expect(header.textContent).not.toContain('Acme Corp');
    expect(header.querySelector('[data-testid="employee-key-facts"]')).toBeNull();
  });

  it('renders the cached employee photo and requests a cache fill for deep links', () => {
    const { fixture, employeeDirectoryStub } = setup(detailFixture);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('[data-testid="employee-profile-header"] app-avatar img') as HTMLImageElement;
    const avatar = fixture.nativeElement.querySelector('[data-testid="employee-avatar"]') as HTMLElement;
    expect(image.src).toBe('https://api.test/files/avatar-1');
    expect(avatar.classList.contains('employee-detail-avatar')).toBe(true);
    expect(employeeDirectoryStub.ensureLoaded).toHaveBeenCalledWith(['emp-1']);
  });

  it('orders identity details as name, email, then side-by-side position and department', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    const name = fixture.nativeElement.querySelector('[data-testid="employee-name"]') as HTMLElement;
    const email = fixture.nativeElement.querySelector('[data-testid="employee-email"]') as HTMLElement;
    const roleContext = fixture.nativeElement.querySelector('[data-testid="employee-role-context"]') as HTMLElement;

    expect(name.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(email.compareDocumentPosition(roleContext) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(roleContext.classList.contains('flex')).toBe(true);
    expect(roleContext.textContent).toContain('Software Engineer');
    expect(roleContext.textContent).toContain('Engineering');
  });

  it('places attendance status directly after the name and before email without using the role width', () => {
    const { fixture } = setup({
      ...detailFixture,
      attendanceSummary: {
        showNotClockedInWarning: true,
        shouldHaveClockedIn: true,
        hasClockedInToday: false,
        workDate: '2026-08-15',
        timezone: 'UTC',
        scheduledStartTime: '09:00',
        warningLabel: 'Still has not clocked in',
        attendanceStatus: 'not_clocked_in',
        attendanceStatusLabel: 'Not clocked in',
        attentionType: 'not_clocked_in',
        attentionSeverity: 'critical',
        attentionLabel: 'Still has not clocked in'
      }
    });
    fixture.detectChanges();

    const primaryRow = fixture.nativeElement.querySelector('[data-testid="employee-primary-row"]') as HTMLElement;
    const primaryDetails = fixture.nativeElement.querySelector('[data-testid="employee-primary-details"]') as HTMLElement;
    const name = fixture.nativeElement.querySelector('[data-testid="employee-name"]') as HTMLElement;
    const email = fixture.nativeElement.querySelector('[data-testid="employee-email"]') as HTMLElement;
    const status = fixture.nativeElement.querySelector('[data-testid="employee-attendance-status"]') as HTMLElement;
    const roleContext = fixture.nativeElement.querySelector('[data-testid="employee-role-context"]') as HTMLElement;

    expect(primaryDetails.parentElement).toBe(primaryRow);
    expect(status.parentElement).toBe(primaryRow);
    expect(name.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(status.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(email.compareDocumentPosition(roleContext) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(primaryRow.classList.contains('flex-wrap')).toBe(true);
    expect(status.classList.contains('flex-shrink-0')).toBe(true);
    expect(status.classList.contains('border')).toBe(false);
    expect(status.classList.contains('bg-rose-50')).toBe(true);
    expect(status.textContent).not.toContain('Attendance today');
    expect(status.textContent).toContain('Still has not clocked in');
  });

  it('shows a Transfer / Promote button and opens the modal when the employee has a legal entity', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const changePositionButton = buttons.find((b) => b.textContent?.includes('Transfer / Promote'));
    expect(changePositionButton).toBeTruthy();

    expect(fixture.componentInstance.changePositionOpen()).toBe(false);
    changePositionButton?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.changePositionMenuOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-change-position-modal')).toBeTruthy();
  });

  it('hides the Transfer / Promote button when employee invitationStatus is pending or expired', () => {
    const { fixture } = setup({
      ...detailFixture,
      invitationStatus: 'pending'
    });
    fixture.detectChanges();

    const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const changePositionButton = buttons.find((b) => b.textContent?.includes('Transfer / Promote'));
    expect(changePositionButton).toBeFalsy();
  });

  it('hides the Change Position menu entirely when viewing your own record', () => {
    const { fixture } = setup(detailFixture, {}, true, 'emp-1');
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="change-position-trigger"]')).toBeFalsy();
  });

  it('shows the action menu with Promotion, Transfer, and Offboarding for another employee', () => {
    const { fixture } = setup(detailFixture, {}, true, 'emp-99');
    fixture.componentInstance.load();
    fixture.detectChanges();
    fixture.componentInstance.changePositionMenuOpen.set(true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Promotion');
    expect(text).toContain('Transfer');
    const offboardingButton = fixture.nativeElement.querySelector('[data-testid="offboarding-menu-item"]') as HTMLButtonElement | null;
    expect(offboardingButton?.disabled).toBe(false);
  });

  it('hides the Offboarding item from a user with employees:write but not employees:offboard', () => {
    const { fixture } = setup(detailFixture, {}, true, 'emp-99', false);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="change-position-trigger"]') as HTMLElement).querySelector('button')!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="offboarding-menu-item"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Promotion');
  });

  it('shows only the Offboarding item to a user with employees:offboard but not employees:write', () => {
    const { fixture } = setup(detailFixture, {}, false, 'emp-99', true);
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('[data-testid="change-position-trigger"]') as HTMLElement;
    expect(trigger.textContent).toContain('Offboarding');
    trigger.querySelector('button')!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="offboarding-menu-item"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Promotion');
  });

  it('enables the Offboarding menu item and navigates to the wizard on click', () => {
    const { fixture } = setup(detailFixture, {}, true, 'emp-99');
    fixture.detectChanges();
    fixture.componentInstance.changePositionMenuOpen.set(true);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const button = fixture.nativeElement.querySelector('[data-testid="offboarding-menu-item"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    button.click();
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/people/employees', expect.any(String), 'offboarding']);
  });

  it('opens the modal with changeReason=Promotion when Promotion is clicked', () => {
    const { fixture } = setup(detailFixture, {}, true, 'emp-99');
    fixture.componentInstance.load();
    fixture.detectChanges();

    fixture.componentInstance.openChangePosition('Promotion');

    expect(fixture.componentInstance.changePositionOpen()).toBe(true);
    expect(fixture.componentInstance.changePositionReason()).toBe('Promotion');
  });

  it('does not render a Transfer / Promote button when the user lacks employees:write', () => {
    const { fixture } = setup(detailFixture, {}, false);
    fixture.detectChanges();

    const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const changePositionButton = buttons.find((b) => b.textContent?.includes('Transfer / Promote'));
    expect(changePositionButton).toBeFalsy();
    expect(fixture.componentInstance.canChangePosition()).toBe(false);
  });

  it('does not render a Transfer / Promote control when the employee has no legal entity', () => {
    const { fixture } = setup({
      ...detailFixture,
      jobInformation: { ...detailFixture.jobInformation, legalEntityId: null }
    });
    fixture.detectChanges();

    const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const changePositionButton = buttons.find((b) => b.textContent?.includes('Transfer / Promote'));
    expect(changePositionButton).toBeFalsy();
  });

  it('reloads and shows a success toast when the position is changed', () => {
    const { fixture, apiStub, notificationsStub } = setup(detailFixture);
    fixture.detectChanges();
    fixture.componentInstance.changePositionOpen.set(true);
    fixture.detectChanges();

    fixture.componentInstance.onPositionChanged();

    expect(fixture.componentInstance.changePositionOpen()).toBe(false);
    expect(notificationsStub.success).toHaveBeenCalledWith('Position updated.');
    expect(apiStub.getEmployeeDetail).toHaveBeenCalledTimes(2);
  });

  it('reloads and shows a success toast when job details are saved', () => {
    const { fixture, apiStub, notificationsStub } = setup(detailFixture, {
      updateJobDetails: vi.fn().mockReturnValue(of(undefined))
    });
    fixture.detectChanges();

    fixture.componentInstance.onJobDetailsSave({
      employeeNumber: 'E-002', employmentTypeCode: 'part_time', workModeId: 'wm-2'
    });

    expect(apiStub.updateJobDetails).toHaveBeenCalledWith('emp-1', {
      employeeNumber: 'E-002', employmentTypeCode: 'part_time', workModeId: 'wm-2'
    });
    expect(fixture.componentInstance.savingJobDetails()).toBe(false);
    expect(notificationsStub.success).toHaveBeenCalledWith('Job details updated.');
    expect(apiStub.getEmployeeDetail).toHaveBeenCalledTimes(2);
  });

  it('surfaces an error toast and stops the saving state when the job details save fails', () => {
    const { fixture, apiStub, notificationsStub } = setup(detailFixture, {
      updateJobDetails: vi.fn().mockReturnValue(throwError(() => new Error('boom')))
    });
    fixture.detectChanges();

    fixture.componentInstance.onJobDetailsSave({
      employeeNumber: 'E-002', employmentTypeCode: 'part_time', workModeId: null
    });

    expect(fixture.componentInstance.savingJobDetails()).toBe(false);
    expect(notificationsStub.error).toHaveBeenCalledWith('boom');
    expect(apiStub.getEmployeeDetail).toHaveBeenCalledTimes(1);
  });

  it('does not show the resend button when the invitation is pending', () => {
    const { fixture } = setup({ ...detailFixture, invitationStatus: 'pending' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Resend invitation');
  });

  it('does not show the resend button when the invitation was accepted', () => {
    const { fixture } = setup({ ...detailFixture, invitationStatus: 'accepted' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Resend invitation');
  });

  it('does not show the resend button when no invitation was ever issued', () => {
    const { fixture } = setup({ ...detailFixture, invitationStatus: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Resend invitation');
  });

  it('shows the resend button only when the invitation expired unaccepted', () => {
    const { fixture } = setup({ ...detailFixture, invitationStatus: 'expired' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Resend invitation');
  });

  it('resends the invitation, shows a success toast, and reloads the employee', async () => {
    const { fixture, apiStub, notificationsStub } = setup({ ...detailFixture, invitationStatus: 'expired' });
    fixture.detectChanges();

    fixture.componentInstance.resendInvitation('emp-1');
    await fixture.whenStable();

    expect(apiStub.resendInvitation).toHaveBeenCalledWith('emp-1');
    expect(notificationsStub.success).toHaveBeenCalledWith('Invitation resent.');
    expect(apiStub.getEmployeeDetail).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.resending()).toBe(false);
  });

  it('shows an error toast and stops resending on failure', async () => {
    const { fixture, notificationsStub } = setup(
      { ...detailFixture, invitationStatus: 'expired' },
      { resendInvitation: vi.fn().mockReturnValue(throwError(() => new Error('failed'))) }
    );
    fixture.detectChanges();

    fixture.componentInstance.resendInvitation('emp-1');
    await fixture.whenStable();

    expect(notificationsStub.error).toHaveBeenCalled();
    expect(fixture.componentInstance.resending()).toBe(false);
  });

  it('renders breadcrumb header and does not render Back to Employees link', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-breadcrumb-header')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Back to Employees');
  });

  it('omits the attendance status when the response has no attendance summary (caller lacks attendance:read)', () => {
    const { fixture } = setup({ ...detailFixture, attendanceSummary: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="employee-attendance-status"]')).toBeNull();
  });

  it('shows the not-clocked-in warning without an Attendance today label', () => {
    const { fixture } = setup({
      ...detailFixture,
      attendanceSummary: {
        showNotClockedInWarning: true,
        shouldHaveClockedIn: true,
        hasClockedInToday: false,
        workDate: '2026-08-15',
        timezone: 'UTC',
        scheduledStartTime: '09:00',
        warningLabel: 'Still has not clocked in',
        attendanceStatus: 'not_clocked_in',
        attendanceStatusLabel: 'Not clocked in',
        attentionType: 'not_clocked_in',
        attentionSeverity: 'critical',
        attentionLabel: 'Still has not clocked in'
      }
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Attendance today');
    expect(text).toContain('Still has not clocked in');
  });

  it('shows the status label and break-overage marker in the attendance status', () => {
    const { fixture } = setup({
      ...detailFixture,
      attendanceSummary: {
        showNotClockedInWarning: false,
        shouldHaveClockedIn: true,
        hasClockedInToday: true,
        workDate: '2026-08-15',
        timezone: 'UTC',
        scheduledStartTime: '09:00',
        warningLabel: null,
        attendanceStatus: 'on_break',
        attendanceStatusLabel: 'On break',
        attentionType: null,
        attentionSeverity: null,
        attentionLabel: null,
        breakUsedMinutes: 75,
        breakAllowanceMinutes: 60,
        breakOverageMinutes: 15,
        isOverBreakAllowance: true
      }
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('On break');
    expect(text).toContain('Break exceeded by 15 min');
  });
});
