import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { AttendanceCorrectionResponse } from '../../models/attendance-correction.model';
import { WorkAreaChangeRequestResponse } from '../../models/work-area-change-request.model';
import { AttendanceDayDetail, AttendanceHistoryRow, AttendanceTodayResponse, TimelineEvent } from '../../models/time-tracking.model';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { TimeTrackingComponent } from './time-tracking.component';

const today: AttendanceTodayResponse = {
  employeeId: 'employee-1',
  legalEntityId: 'entity-1',
  workDate: '2026-08-22',
  timezone: 'Asia/Colombo',
  scheduleStatus: 'configured',
  policyStatus: 'configured',
  isWorkingDay: true,
  isHoliday: false,
  holidayName: null,
  scheduledStartTime: '09:00',
  scheduledEndTime: '17:30',
  requiredWorkMinutes: 480,
  breakAllowanceMinutes: 60,
  breakUsedMinutes: 0,
  breakRemainingMinutes: 60,
  breakState: 'available',
  breaks: [],
  expectedWorkMode: 'onsite',
  attendanceStatus: 'not_clocked_in',
  clockInAt: null,
  clockOutAt: null,
  totalWorkedMinutes: 0,
  attendanceSource: null,
  canClockIn: true,
  canClockOut: false,
  canStartBreak: false,
  canEndBreak: false,
  shouldHaveClockedIn: false,
  canViewCoveredEmployees: false,
  allowedClockInMethods: {
    web: true,
    desktopTray: false,
    biometric: false,
    photoRequired: false,
    locationRequired: false,
    allowedRadiusMeters: null
  },
  messages: [],
  attendanceStatusLabel: null,
  attentionType: null,
  attentionLabel: null,
  attentionSeverity: null,
  breakOverageMinutes: 0,
  isOverBreakAllowance: false
};

const coveredRow: AttendanceHistoryRow = {
  attendanceRecordId: 'record-1',
  workDate: '2026-08-22',
  employee: {
    employeeId: 'employee-2',
    displayName: 'Jordan Lee',
    employeeNumber: 'EMP-002',
    position: 'Designer',
    department: 'Product',
    avatarFileId: null
  },
  clockInAt: '2026-08-22T09:05:00+05:30',
  clockOutAt: null,
  isActive: true,
  breakMinutes: 0,
  totalWorkedMinutes: 120,
  expectedWorkMode: 'remote',
  attendanceSource: 'web',
  status: 'clocked_in',
  canViewDetails: true,
  canRequestCorrection: false,
  canRequestWorkAreaChange: false,
  canCorrect: false,
  statusLabel: null,
  attentionType: null,
  attentionLabel: null,
  attentionSeverity: null,
  breakOverageMinutes: 0,
  isOverBreakAllowance: false
};

type StoreMock = {
  today: ReturnType<typeof signal<AttendanceTodayResponse | null>>;
  todayLoading: ReturnType<typeof signal<boolean>>;
  todayError: ReturnType<typeof signal<string | null>>;
  actionLoading: ReturnType<typeof signal<boolean>>;
  activeAction: ReturnType<typeof signal<null>>;
  history: ReturnType<typeof signal<readonly AttendanceHistoryRow[]>>;
  historyLoading: ReturnType<typeof signal<boolean>>;
  historyError: ReturnType<typeof signal<string | null>>;
  historyPage: ReturnType<typeof signal<number>>;
  historyPageSize: ReturnType<typeof signal<number>>;
  historyTotalCount: ReturnType<typeof signal<number>>;
  coveredHistory: ReturnType<typeof signal<readonly AttendanceHistoryRow[]>>;
  coveredHistoryLoading: ReturnType<typeof signal<boolean>>;
  coveredHistoryError: ReturnType<typeof signal<string | null>>;
  coveredHistoryPage: ReturnType<typeof signal<number>>;
  coveredHistoryPageSize: ReturnType<typeof signal<number>>;
  coveredHistoryTotalCount: ReturnType<typeof signal<number>>;
  selectedHistoryRange: ReturnType<typeof signal<{ from: string; to: string } | null>>;
  selectedCoveredEmployeeId: ReturnType<typeof signal<string | null>>;
  dayDetail: ReturnType<typeof signal<AttendanceDayDetail | null>>;
  dayDetailLoading: ReturnType<typeof signal<boolean>>;
  dayDetailError: ReturnType<typeof signal<string | null>>;
  loadDayDetail: ReturnType<typeof vi.fn>;
  clearDayDetail: ReturnType<typeof vi.fn>;
  todayTimelineEvents: ReturnType<typeof signal<readonly TimelineEvent[]>>;
  todayTimelineLoading: ReturnType<typeof signal<boolean>>;
  todayTimelineError: ReturnType<typeof signal<string | null>>;
  loadTodayTimeline: ReturnType<typeof vi.fn>;
  loadToday: ReturnType<typeof vi.fn>;
  loadMyHistory: ReturnType<typeof vi.fn>;
  loadCoveredHistory: ReturnType<typeof vi.fn>;
  clockIn: ReturnType<typeof vi.fn>;
  startBreak: ReturnType<typeof vi.fn>;
  endBreak: ReturnType<typeof vi.fn>;
  clockOut: ReturnType<typeof vi.fn>;
  myCorrections: ReturnType<typeof signal<readonly AttendanceCorrectionResponse[]>>;
  myCorrectionsLoading: ReturnType<typeof signal<boolean>>;
  myCorrectionsError: ReturnType<typeof signal<string | null>>;
  myCorrectionsPage: ReturnType<typeof signal<number>>;
  myCorrectionsPageSize: ReturnType<typeof signal<number>>;
  myCorrectionsTotalCount: ReturnType<typeof signal<number>>;
  myCorrectionsLoaded: ReturnType<typeof signal<boolean>>;
  loadMyCorrections: ReturnType<typeof vi.fn>;
  cancelCorrection: ReturnType<typeof vi.fn>;
  myWorkAreaRequests: ReturnType<typeof signal<readonly WorkAreaChangeRequestResponse[]>>;
  myWorkAreaRequestsLoading: ReturnType<typeof signal<boolean>>;
  myWorkAreaRequestsError: ReturnType<typeof signal<string | null>>;
  myWorkAreaRequestsPage: ReturnType<typeof signal<number>>;
  myWorkAreaRequestsPageSize: ReturnType<typeof signal<number>>;
  myWorkAreaRequestsTotalCount: ReturnType<typeof signal<number>>;
  myWorkAreaRequestsLoaded: ReturnType<typeof signal<boolean>>;
  loadMyWorkAreaRequests: ReturnType<typeof vi.fn>;
  cancelWorkAreaChangeRequest: ReturnType<typeof vi.fn>;
  workAreaActionLoading: ReturnType<typeof signal<boolean>>;
  activeWorkAreaRequestId: ReturnType<typeof signal<string | null>>;
  approvalInbox: ReturnType<typeof signal<readonly AttendanceCorrectionResponse[]>>;
  approvalInboxLoading: ReturnType<typeof signal<boolean>>;
  approvalInboxError: ReturnType<typeof signal<string | null>>;
  approvalInboxLoaded: ReturnType<typeof signal<boolean>>;
  correctionActionLoading: ReturnType<typeof signal<boolean>>;
  activeCorrectionAction: ReturnType<typeof signal<string | null>>;
  loadApprovalInbox: ReturnType<typeof vi.fn>;
  approveCorrection: ReturnType<typeof vi.fn>;
  rejectCorrection: ReturnType<typeof vi.fn>;
  workAreaApprovalInbox: ReturnType<typeof signal<readonly WorkAreaChangeRequestResponse[]>>;
  workAreaApprovalInboxLoading: ReturnType<typeof signal<boolean>>;
  workAreaApprovalInboxError: ReturnType<typeof signal<string | null>>;
  workAreaApprovalInboxPage: ReturnType<typeof signal<number>>;
  workAreaApprovalInboxPageSize: ReturnType<typeof signal<number>>;
  workAreaApprovalInboxTotalCount: ReturnType<typeof signal<number>>;
  workAreaApprovalInboxLoaded: ReturnType<typeof signal<boolean>>;
  loadWorkAreaApprovalInbox: ReturnType<typeof vi.fn>;
  selectWorkAreaApprovalRequest: ReturnType<typeof vi.fn>;
  approveWorkAreaChangeRequest: ReturnType<typeof vi.fn>;
  rejectWorkAreaChangeRequest: ReturnType<typeof vi.fn>;
  workAreaPreview: ReturnType<typeof signal<any>>;
  workAreaPreviewLoading: ReturnType<typeof signal<boolean>>;
  workAreaPreviewError: ReturnType<typeof signal<string | null>>;
  workAreaCreateError: ReturnType<typeof signal<string | null>>;
  clearWorkAreaPreview: ReturnType<typeof vi.fn>;
  previewWorkAreaChange: ReturnType<typeof vi.fn>;
  submitWorkAreaChangeRequest: ReturnType<typeof vi.fn>;
};

describe('TimeTrackingComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    overrides: Partial<AttendanceTodayResponse> = {},
    access = false,
    history: readonly AttendanceHistoryRow[] = [],
    corrections: readonly AttendanceCorrectionResponse[] = [],
    workAreaRequests: readonly WorkAreaChangeRequestResponse[] = [],
    loadedFlags: { corrections?: boolean; workArea?: boolean } = {},
    permissions: string[] = ['attendance:read-own', 'attendance:write-own']
  ): Promise<{ fixture: ComponentFixture<TimeTrackingComponent>; store: StoreMock }> {
    const store: StoreMock = {
      today: signal({ ...today, ...overrides }),
      todayLoading: signal(false),
      todayError: signal(null),
      actionLoading: signal(false),
      activeAction: signal(null),
      history: signal(history),
      historyLoading: signal(false),
      historyError: signal(null),
      historyPage: signal(1),
      historyPageSize: signal(20),
      historyTotalCount: signal(0),
      coveredHistory: signal(access ? history : []),
      coveredHistoryLoading: signal(false),
      coveredHistoryError: signal(null),
      coveredHistoryPage: signal(1),
      coveredHistoryPageSize: signal(20),
      coveredHistoryTotalCount: signal(0),
      selectedHistoryRange: signal(null),
      selectedCoveredEmployeeId: signal(null),
      dayDetail: signal(null),
      dayDetailLoading: signal(false),
      dayDetailError: signal(null),
      loadDayDetail: vi.fn(() => Promise.resolve()),
      clearDayDetail: vi.fn(),
      todayTimelineEvents: signal([]),
      todayTimelineLoading: signal(false),
      todayTimelineError: signal(null),
      loadTodayTimeline: vi.fn(() => Promise.resolve()),
      loadToday: vi.fn(() => Promise.resolve()),
      loadMyHistory: vi.fn(() => Promise.resolve()),
      loadCoveredHistory: vi.fn(() => Promise.resolve()),
      clockIn: vi.fn(() => Promise.resolve()),
      startBreak: vi.fn(() => Promise.resolve()),
      endBreak: vi.fn(() => Promise.resolve()),
      clockOut: vi.fn(() => Promise.resolve()),
      myCorrections: signal(corrections),
      myCorrectionsLoading: signal(false),
      myCorrectionsError: signal(null),
      myCorrectionsPage: signal(1),
      myCorrectionsPageSize: signal(20),
      myCorrectionsTotalCount: signal(0),
      myCorrectionsLoaded: signal(loadedFlags.corrections ?? false),
      loadMyCorrections: vi.fn(() => Promise.resolve()),
      cancelCorrection: vi.fn(() => Promise.resolve()),
      myWorkAreaRequests: signal(workAreaRequests),
      myWorkAreaRequestsLoading: signal(false),
      myWorkAreaRequestsError: signal(null),
      myWorkAreaRequestsPage: signal(1),
      myWorkAreaRequestsPageSize: signal(20),
      myWorkAreaRequestsTotalCount: signal(0),
      myWorkAreaRequestsLoaded: signal(loadedFlags.workArea ?? false),
      loadMyWorkAreaRequests: vi.fn(() => Promise.resolve()),
      cancelWorkAreaChangeRequest: vi.fn(() => Promise.resolve(workAreaRequests[0] ?? null)),
      workAreaActionLoading: signal(false),
      activeWorkAreaRequestId: signal(null),
      approvalInbox: signal([]),
      approvalInboxLoading: signal(false),
      approvalInboxError: signal(null),
      approvalInboxLoaded: signal(false),
      correctionActionLoading: signal(false),
      activeCorrectionAction: signal(null),
      loadApprovalInbox: vi.fn(() => Promise.resolve()),
      approveCorrection: vi.fn(() => Promise.resolve(null)),
      rejectCorrection: vi.fn(() => Promise.resolve(null)),
      workAreaApprovalInbox: signal([]),
      workAreaApprovalInboxLoading: signal(false),
      workAreaApprovalInboxError: signal(null),
      workAreaApprovalInboxPage: signal(1),
      workAreaApprovalInboxPageSize: signal(20),
      workAreaApprovalInboxTotalCount: signal(0),
      workAreaApprovalInboxLoaded: signal(false),
      loadWorkAreaApprovalInbox: vi.fn(() => Promise.resolve()),
      selectWorkAreaApprovalRequest: vi.fn(),
      approveWorkAreaChangeRequest: vi.fn(() => Promise.resolve(null)),
      rejectWorkAreaChangeRequest: vi.fn(() => Promise.resolve(null)),
      workAreaPreview: signal(null),
      workAreaPreviewLoading: signal(false),
      workAreaPreviewError: signal(null),
      workAreaCreateError: signal(null),
      clearWorkAreaPreview: vi.fn(),
      previewWorkAreaChange: vi.fn(() => Promise.resolve(null)),
      submitWorkAreaChangeRequest: vi.fn(() => Promise.resolve(null))
    };

    await TestBed.configureTestingModule({
      imports: [TimeTrackingComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: store },
        {
          provide: PermissionService,
          useValue: {
            hasPermission: vi.fn((permission: string) => (permission === 'attendance:read' ? access : permissions.includes(permission))),
            hasAnyPermission: vi.fn((required: string[]) => required.some((permission) => permissions.includes(permission)))
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TimeTrackingComponent);
    fixture.detectChanges();
    return { fixture, store };
  }

  it('an approve-only user without coverage never reaches Team view - attendance:approve alone does not imply coverage', async () => {
    const { fixture, store } = await setup({}, false, [], [], [], {}, ['attendance:approve']);
    expect(fixture.componentInstance.canShowTeamView()).toBe(false);
    expect(fixture.componentInstance.viewMode()).toBe('my');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Approvals');
    expect(fixture.nativeElement.querySelector('app-correction-approvals')).toBeNull();
    expect(store.loadApprovalInbox).not.toHaveBeenCalled();
    expect(store.loadWorkAreaApprovalInbox).not.toHaveBeenCalled();
  });

  it('does not call loadToday, loadMyHistory, or ensureRequestTabLoaded for an approve-only user without coverage', async () => {
    const { store } = await setup({}, false, [], [], [], {}, ['attendance:approve']);
    expect(store.loadToday).not.toHaveBeenCalled();
    expect(store.loadMyHistory).not.toHaveBeenCalled();
    expect(store.loadMyCorrections).not.toHaveBeenCalled();
  });

  it('does not show Team attendance for a user who has attendance:read (a universal permission) but no one covered', async () => {
    const { fixture } = await setup({ canViewCoveredEmployees: false }, true, [], [], [], {}, ['attendance:read']);
    expect(fixture.componentInstance.canShowTeamView()).toBe(false);
    expect(fixture.componentInstance.viewMode()).toBe('my');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Team attendance');
  });

  it('shows Team attendance but not Approvals for a read-only user with coverage but no approve permission, and loads covered history on entering Team', async () => {
    const { fixture, store } = await setup({ canViewCoveredEmployees: true }, true, [], [], [], {}, ['attendance:read']);
    expect(fixture.componentInstance.canShowTeamView()).toBe(true);
    expect(fixture.componentInstance.hasApproveAccess()).toBe(false);
    fixture.componentInstance.selectViewMode('team');
    fixture.detectChanges();
    expect(store.loadCoveredHistory).toHaveBeenCalled();
    expect(store.loadApprovalInbox).not.toHaveBeenCalled();
    expect(store.loadWorkAreaApprovalInbox).not.toHaveBeenCalled();
  });

  it('places the MY/TEAM switcher in the breadcrumb header beside the request action', async () => {
    const { fixture } = await setup({ canViewCoveredEmployees: true }, true, [], [], [], {}, ['attendance:read']);
    const element = fixture.nativeElement as HTMLElement;
    const header = element.querySelector('.time-tracking-header');
    const headerActions = header?.querySelector('.time-tracking-header-actions');
    const toggle = headerActions?.querySelector('.attendance-view-toggle');
    const requestAction = headerActions?.querySelector('[data-testid="request-work-area-change"]');

    expect(toggle).toBeTruthy();
    expect(requestAction).toBeTruthy();
    if (headerActions && toggle && requestAction) {
      expect(headerActions.contains(toggle)).toBe(true);
      expect(headerActions.contains(requestAction)).toBe(true);
    }
    expect(Array.from(element.children).some((child) => child.classList.contains('attendance-view-toggle'))).toBe(false);
  });

  it('toggles the Request dropdown and shows Attendance correction and Request to change the work mode', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.requestDropdownOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-testid="request-option-attendance-correction"]')).toBeNull();

    const trigger = fixture.nativeElement.querySelector('[data-testid="request-work-area-change"] button') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    expect(component.requestDropdownOpen()).toBe(true);
    const correctionOption = fixture.nativeElement.querySelector('[data-testid="request-option-attendance-correction"]') as HTMLButtonElement;
    const workModeOption = fixture.nativeElement.querySelector('[data-testid="request-option-work-area-change"]') as HTMLButtonElement;

    expect(correctionOption).toBeTruthy();
    expect(workModeOption).toBeTruthy();
    expect(correctionOption.textContent).toContain('Attendance correction');
    expect(workModeOption.textContent).toContain('Request to change the work mode');

    const openCorrectionSpy = vi.spyOn(component, 'openTodayCorrection');
    correctionOption.click();
    fixture.detectChanges();

    expect(openCorrectionSpy).toHaveBeenCalled();
    expect(component.requestDropdownOpen()).toBe(false);
  });

  it('opens work area change modal when work mode option is clicked from Request dropdown', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const trigger = fixture.nativeElement.querySelector('[data-testid="request-work-area-change"] button') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const workModeOption = fixture.nativeElement.querySelector('[data-testid="request-option-work-area-change"]') as HTMLButtonElement;
    const openWorkAreaSpy = vi.spyOn(component, 'openWorkAreaChange');
    workModeOption.click();
    fixture.detectChanges();

    expect(openWorkAreaSpy).toHaveBeenCalled();
    expect(component.workAreaFormOpen()).toBe(true);
  });

  it('a self-service-only user cannot reach team view', async () => {
    const { fixture } = await setup({}, false, [], [], [], {}, ['attendance:read-own']);
    expect(fixture.componentInstance.canShowTeamView()).toBe(false);
    expect(fixture.componentInstance.viewMode()).toBe('my');
  });

  it('loads Today for a read-only (Team attendance) user even without self-service permission', async () => {
    const { store } = await setup({}, true, [], [], [], {}, ['attendance:read']);
    expect(store.loadToday).toHaveBeenCalled();
  });

  it('does not render a Team sub-nav toggle for a coverage-only user - Team attendance shows directly, no Approvals', async () => {
    const { fixture } = await setup({ canViewCoveredEmployees: true }, true, [], [], [], {}, ['attendance:read']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Team workspace"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Team attendance');
    expect(fixture.nativeElement.textContent).not.toContain('Approvals');
  });

  it('never renders a Team sub-nav toggle - Team attendance and Approvals show together, stacked, with no switcher between them', async () => {
    const { fixture } = await setup({ canViewCoveredEmployees: true }, true, [], [], [], {}, ['attendance:read', 'attendance:approve']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Team workspace"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Team attendance');
    expect(fixture.nativeElement.textContent).toContain('Approvals');
  });

  it('shows a count badge only when the corrections queue is non-empty', async () => {
    const { fixture, store } = await setup({ canViewCoveredEmployees: true }, false, [], [], [], {}, ['attendance:approve']);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toMatch(/Attendance corrections \(0\)/);
    expect(fixture.nativeElement.textContent).not.toMatch(/Attendance corrections \(\d+\)/);

    store.approvalInbox.set([{ id: 'c1', status: 'pending' } as unknown as AttendanceCorrectionResponse]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toMatch(/Attendance corrections \(1\)/);
  });

  it('embeds only the active approval type, not both, on initial entry', async () => {
    const { fixture } = await setup({ canViewCoveredEmployees: true }, false, [], [], [], {}, ['attendance:approve']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-correction-approvals').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('app-work-area-approvals').length).toBe(0);
  });

  it('embeds the work-area panel instead when that approval type is selected', async () => {
    const { fixture } = await setup({ canViewCoveredEmployees: true }, false, [], [], [], {}, ['attendance:approve']);
    fixture.componentInstance.selectApprovalType('work-area');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-correction-approvals').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('app-work-area-approvals').length).toBe(1);
  });

  it('formats Today clock-in and clock-out using the backend timezone', async () => {
    const clockIn = '2026-08-22T09:00:00Z';
    const clockOut = '2026-08-22T17:00:00Z';
    const { fixture } = await setup({
      timezone: 'Asia/Colombo',
      clockInAt: clockIn,
      clockOutAt: clockOut
    });
    const component = fixture.componentInstance;
    const expectedClockIn = formatForTimezone(clockIn, 'Asia/Colombo');
    const expectedClockOut = formatForTimezone(clockOut, 'Asia/Colombo');
    const browserIndependentUtcClockIn = formatForTimezone(clockIn, 'UTC');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(component.formatDateTime(clockIn, 'Asia/Colombo')).toBe(expectedClockIn);
    expect(component.formatDateTime(clockOut, 'Asia/Colombo')).toBe(expectedClockOut);
    expect(expectedClockIn).not.toBe(browserIndependentUtcClockIn);
    expect(text).toContain(expectedClockIn);
    expect(text).toContain(expectedClockOut);
  });

  it('uses Today.timezone for personal history row timestamps', async () => {
    const row = {
      ...coveredRow,
      clockInAt: '2026-08-22T09:00:00Z',
      clockOutAt: '2026-08-22T17:00:00Z'
    };
    const { fixture } = await setup({ timezone: 'Asia/Colombo' }, false, [row]);
    const rowText = fixture.nativeElement.querySelector('table tbody tr')?.textContent ?? '';

    expect(rowText).toContain(formatForTimezone(row.clockInAt, 'Asia/Colombo'));
    expect(rowText).toContain(formatForTimezone(row.clockOutAt, 'Asia/Colombo'));
    expect(rowText).not.toContain(formatForTimezone(row.clockInAt, 'UTC'));
  });

  it('uses Today.timezone for covered history row timestamps', async () => {
    const row = {
      ...coveredRow,
      clockInAt: '2026-08-22T09:00:00Z',
      clockOutAt: '2026-08-22T17:00:00Z'
    };
    const { fixture } = await setup({ timezone: 'Asia/Colombo', canViewCoveredEmployees: true }, true, [row]);
    const teamToggle = fixture.nativeElement.querySelectorAll('.attendance-view-toggle__option')[1] as HTMLButtonElement;
    teamToggle.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const teamRowText = fixture.nativeElement.querySelector('#covered-history-heading')?.closest('section')?.querySelector('tbody tr')?.textContent ?? '';

    expect(teamRowText).toContain(formatForTimezone(row.clockInAt, 'Asia/Colombo'));
    expect(teamRowText).toContain(formatForTimezone(row.clockOutAt, 'Asia/Colombo'));
    expect(teamRowText).not.toContain(formatForTimezone(row.clockInAt, 'UTC'));
  });

  it('formats the reviewed correction timestamp using the response timezone', async () => {
    const request = correctionResponse({
      timezone: 'Asia/Colombo',
      status: 'approved',
      reviewedAt: '2026-08-22T18:00:00Z'
    });
    const { fixture } = await setup({ timezone: 'America/New_York' }, false, [], [request]);
    const reviewText = (fixture.nativeElement.querySelector('.corrections-table tbody tr') as HTMLElement).textContent ?? '';

    expect(reviewText).toContain(`Reviewed ${formatForTimezone(request.reviewedAt!, 'Asia/Colombo')}`);
    expect(reviewText).not.toContain(formatForTimezone(request.reviewedAt!, 'America/New_York'));
  });

  it('returns an em dash for invalid timezone and null or invalid timestamps without throwing', async () => {
    const { fixture } = await setup({
      timezone: 'Invalid/LegalEntityTimezone',
      clockInAt: 'not-a-timestamp',
      clockOutAt: '2026-08-22T17:00:00Z'
    });
    const component = fixture.componentInstance;

    expect(() => component.formatDateTime('2026-08-22T09:00:00Z', 'Invalid/LegalEntityTimezone')).not.toThrow();
    expect(component.formatDateTime('2026-08-22T09:00:00Z', 'Invalid/LegalEntityTimezone')).toBe('—');
    expect(component.formatDateTime('not-a-timestamp', 'Asia/Colombo')).toBe('—');
    expect(component.formatDateTime(null, 'Asia/Colombo')).toBe('—');
  });

  it('shows Work mode inside the Work schedule KPI instead of a separate card', async () => {
    const { fixture } = await setup({ expectedWorkMode: 'remote', attendanceSource: 'web' });
    const element = fixture.nativeElement as HTMLElement;
    const labels = Array.from(element.querySelectorAll('.metric-card .metric-label')).map((label) => label.textContent?.trim());
    const schedule = element.querySelector('.metric-card--schedule');

    expect(labels).not.toContain('Work mode');
    expect(schedule?.querySelector('.metric-detail-grid')?.textContent).toContain('Work mode');
    expect(schedule?.textContent).toContain('Remote');
    expect(schedule?.textContent).toContain('Source: Web');
  });

  it('always shows Attendance times with fallbacks when no clock timestamps are available', async () => {
    const { fixture } = await setup({ clockInAt: null, clockOutAt: null });
    const attendanceTimes = fixture.nativeElement.querySelector('.metric-card--attendance-times') as HTMLElement | null;

    expect(attendanceTimes).toBeTruthy();
    expect(attendanceTimes?.textContent).toContain('Clock in');
    expect(attendanceTimes?.textContent).toContain('Clock out');
    expect(attendanceTimes?.textContent).toContain('Not recorded');
  });

  it('shows only the actions enabled by the backend response flags', async () => {
    const { fixture } = await setup({
      canClockIn: false,
      canStartBreak: true,
      canEndBreak: false,
      canClockOut: true
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="status-card-clock-in"]')).toBeNull();
    expect(element.querySelector('[data-testid="status-card-start-break"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="status-card-end-break"]')).toBeNull();
    expect(element.querySelector('[data-testid="status-card-clock-out"]')).toBeTruthy();
  });

  it('shows the my-history Previous/Next control only when there is more than one page, and disables Previous on page 1', async () => {
    const { fixture, store } = await setup({}, false, [coveredRow]);
    store.historyTotalCount.set(41);
    fixture.detectChanges();

    const pageInfo = fixture.nativeElement.querySelector('.tt-pagination-info');
    expect(pageInfo?.textContent).toContain('Page 1 of 3');

    const buttons = fixture.nativeElement.querySelectorAll('.tt-pagination-buttons button');
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
  });

  it('hides the my-history Previous/Next control when everything fits on one page', async () => {
    const { fixture, store } = await setup({}, false, [coveredRow]);
    store.historyTotalCount.set(5);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tt-pagination-info')).toBeNull();
  });

  it('goToHistoryPage asks the store to load the requested page for the currently selected range', async () => {
    const { fixture, store } = await setup({}, false, [coveredRow]);
    const component = fixture.componentInstance;

    component.goToHistoryPage(2);

    expect(store.loadMyHistory).toHaveBeenCalledWith(expect.any(Object), 2);
  });

  it('shows a session-style hero (single number, no stat tiles) and a Today\'s total breakdown', async () => {
    const { fixture } = await setup({ requiredWorkMinutes: 480, totalWorkedMinutes: 150, breakUsedMinutes: 20 });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="status-card-session-value"]')?.textContent?.trim()).toBe('2h 30m');
    expect(element.querySelector('.status-card-stats')).toBeNull();

    const totals = Array.from(element.querySelectorAll('.today-total__item')).map((item) => ({
      label: item.querySelector('dt')?.textContent?.trim(),
      value: item.querySelector('dd')?.textContent?.trim()
    }));
    expect(totals).toContainEqual({ label: 'Scheduled', value: '8h' });
    expect(totals).toContainEqual({ label: 'Worked', value: '2h 30m' });
    expect(totals).toContainEqual({ label: 'Break', value: '20m' });
    expect(totals).toContainEqual({ label: 'Remaining', value: '5h 30m' });
  });

  it('shows remaining break time and the used-break helper when remaining is zero', async () => {
    const { fixture } = await setup({ breakUsedMinutes: 60, breakRemainingMinutes: 0 });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('0m remaining');
    expect(text).toContain('You have used your break time for today.');
  });

  it('openTodayCorrection opens the correction form pre-set to today\'s work date', async () => {
    const { fixture } = await setup({ workDate: '2026-09-08' });

    fixture.componentInstance.openTodayCorrection();

    expect(fixture.componentInstance.correctionFormOpen()?.workDate).toBe('2026-09-08');
    expect(fixture.componentInstance.correctionFormOpen()?.canRequestCorrection).toBe(true);
  });

  it('uses the backend Today status label and falls back to the humanized status', async () => {
    const { fixture } = await setup({ attendanceStatus: 'on_time_off', attendanceStatusLabel: 'On approved time off' });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('On approved time off');
  });

  it('renders the backend attention label without exposing its machine type and applies severity styling', async () => {
    const { fixture } = await setup({
      attentionType: 'worked_during_time_off',
      attentionLabel: 'Worked during approved time off',
      attentionSeverity: 'warning'
    });
    const element = fixture.nativeElement as HTMLElement;
    const banner = element.querySelector('.attention-banner');

    expect(banner?.textContent).toContain('Worked during approved time off');
    expect(banner?.classList.contains('attention-banner--warning')).toBe(true);
    expect(element.textContent).not.toContain('worked_during_time_off');
  });

  it('shows the missed clock-in warning only when no backend attention label exists', async () => {
    const { fixture, store } = await setup({ shouldHaveClockedIn: true, attentionLabel: null });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('You have not clocked in yet.');

    store.today.set({
      ...today,
      shouldHaveClockedIn: true,
      attentionType: 'not_clocked_in',
      attentionLabel: 'Still has not clocked in',
      attentionSeverity: 'critical'
    });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Still has not clocked in');
    expect(text).not.toContain('You have not clocked in yet.');
  });

  it('keeps Clock in available for a leave or non-working-day response when the backend allows it', async () => {
    const { fixture } = await setup({
      attendanceStatus: 'non_working_day',
      attendanceStatusLabel: 'Non-working day',
      isWorkingDay: false,
      canClockIn: true
    });
    expect(fixture.nativeElement.querySelector('[data-testid="status-card-clock-in"]')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('You have not clocked in yet.');
  });

  it('shows break overage while preserving used duration and never renders negative remaining time', async () => {
    const { fixture } = await setup({
      breakAllowanceMinutes: 30,
      breakUsedMinutes: 45,
      breakRemainingMinutes: 0,
      breakOverageMinutes: 15,
      isOverBreakAllowance: true,
      canEndBreak: true
    });
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';

    expect(text).toContain('Break time exceeded by 15 min.');
    expect(text).toContain('30m allowance · 45m used');
    expect(text).not.toContain('-15m');
    expect(element.querySelector('[data-testid="status-card-end-break"]')).toBeTruthy();
  });

  it('suppresses the duplicate attention banner for break overage because the status card already displays the alert', async () => {
    const { fixture } = await setup({
      attendanceStatus: 'working',
      attentionType: 'over_break',
      attentionLabel: 'Break time has exceeded the allowance',
      attentionSeverity: 'warning',
      breakOverageMinutes: 75,
      isOverBreakAllowance: true
    });
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.attention-banner');
    expect(banner).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Break time exceeded by 75 min.');
  });

  it('uses backend history labels and shows attention and break overage for personal and covered rows', async () => {
    const row = {
      ...coveredRow,
      status: 'worked_during_time_off',
      statusLabel: 'Worked during time off',
      attentionType: 'worked_during_time_off',
      attentionLabel: 'Worked during approved time off',
      attentionSeverity: 'warning',
      breakOverageMinutes: 12,
      isOverBreakAllowance: true
    };
    const { fixture } = await setup({ canViewCoveredEmployees: true }, true, [row]);
    const teamToggle = fixture.nativeElement.querySelectorAll('.attendance-view-toggle__option')[1] as HTMLButtonElement;
    teamToggle.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Worked during time off');
    expect(text).toContain('Worked during approved time off');
    expect(text).toContain('Break exceeded by 12 min');
    expect(text).not.toContain('worked_during_time_off');
    expect(fixture.nativeElement.querySelector('#covered-history-heading')?.closest('section')?.querySelectorAll('table')).toHaveLength(1);
  });

  it('humanizes common backend message values instead of rendering machine codes', async () => {
    const { fixture } = await setup({
      messages: ['schedule_not_configured', 'policy_not_configured', 'break_allowance_used', 'already_clocked_out']
    });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Your work schedule is not configured for today.');
    expect(text).toContain('Your attendance policy is not configured.');
    expect(text).toContain('You have used your break time for today.');
    expect(text).toContain('You have already clocked out today.');
    expect(text).not.toContain('schedule_not_configured');
    expect(text).not.toContain('policy_not_configured');
  });

  it('hides team attendance without attendance:read', async () => {
    const { fixture } = await setup({}, false, [coveredRow]);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Team attendance');
  });

  it('shows team attendance with attendance:read', async () => {
    const { fixture } = await setup({ canViewCoveredEmployees: true }, true, [coveredRow]);
    const teamToggle = fixture.nativeElement.querySelectorAll('.attendance-view-toggle__option')[1] as HTMLButtonElement;
    teamToggle.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Team attendance');
    expect(text).toContain('Jordan Lee');
  });
  it('opens the detail drawer for a My-history row using the current employee id from Today', async () => {
    const row = { ...coveredRow, workDate: '2026-08-21' };
    const { fixture } = await setup({ employeeId: 'employee-9' }, false, [row]);
    const component = fixture.componentInstance;

    component.onMyRowSelected(row);

    expect(component.selectedDetail()).toEqual({ employeeId: 'employee-9', workDate: '2026-08-21' });
  });

  it('does not open the detail drawer for a My-history row when Today has not loaded', async () => {
    const row = { ...coveredRow, workDate: '2026-08-21' };
    const { fixture, store } = await setup({}, false, [row]);
    store.today.set(null);
    const component = fixture.componentInstance;

    component.onMyRowSelected(row);

    expect(component.selectedDetail()).toBeNull();
  });

  it("opens the detail drawer for a Team-attendance row using that row's employee id", async () => {
    const { fixture } = await setup({ canViewCoveredEmployees: true }, true, [coveredRow]);
    const component = fixture.componentInstance;

    component.onTeamRowSelected(coveredRow);

    expect(component.selectedDetail()).toEqual({ employeeId: 'employee-2', workDate: '2026-08-22' });
  });

  it('closes and clears the detail drawer', async () => {
    const { fixture, store } = await setup({}, false, [coveredRow]);
    const component = fixture.componentInstance;
    component.selectedDetail.set({ employeeId: 'employee-2', workDate: coveredRow.workDate });

    component.closeDetailDrawer();

    expect(component.selectedDetail()).toBeNull();
    expect(store.clearDayDetail).toHaveBeenCalled();
  });

  it('renders My attendance history and My requests side by side', async () => {
    const { fixture } = await setup({}, false, [coveredRow]);
    const row = fixture.nativeElement.querySelector('.history-requests-row');
    expect(row).toBeTruthy();
    expect(row?.querySelector('app-attendance-history-list')).toBeTruthy();
    expect(row?.textContent).toContain('My requests');
  });

  it('renders the detail drawer content once a row is selected and its data loads', async () => {
    const { fixture, store } = await setup({}, false, [coveredRow]);
    const component = fixture.componentInstance;
    component.selectedDetail.set({ employeeId: 'employee-2', workDate: coveredRow.workDate });
    store.dayDetail.set({ summary: coveredRow, timelineEvents: [], dailyActivity: null, checkIns: [] });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Attendance detail');
  });

  it('opens the correction form with the selected work date and clock-in fields', async () => {
    const eligible = { ...coveredRow, canRequestCorrection: true, workDate: '2026-08-21' };
    const { fixture } = await setup({}, false, [eligible]);
    const component = fixture.componentInstance;
    component.openCorrection(eligible);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Request attendance correction');
    expect(text).toContain('Aug 21, 2026');
    expect(text).toContain('Times are shown in company time.');
    expect(text).not.toContain('Times use Asia/Colombo.');
    expect(fixture.nativeElement.querySelector('input[name="requestedClockInAt"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[name="requestedClockOutAt"]')).toBeNull();
  });

  it('shows the correction-specific fields for break and full-day requests', async () => {
    const eligible = { ...coveredRow, canRequestCorrection: true };
    const { fixture } = await setup({}, false, [eligible]);
    const component = fixture.componentInstance;
    component.openCorrection(eligible);
    component.correctionType.set('break');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Break start time"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[name="requestedClockInAt"]')).toBeNull();

    component.correctionType.set('full_day');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[name="requestedClockInAt"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[name="requestedClockOutAt"]')).toBeTruthy();
  });

  it('shows a one-click fix button for a missing-clock-out attention, naming the stale day', async () => {
    const { fixture } = await setup({
      attentionType: 'missing_clock_out',
      attentionLabel: 'Still shown as clocked in from Aug 19 — confirm the actual clock-out time',
      attentionSeverity: 'critical',
      attentionWorkDate: '2026-08-19'
    });
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('[data-testid="fix-missing-clock-out"]');
    expect(button).toBeTruthy();
    expect(button?.textContent).toContain('Aug 19, 2026');
  });

  it('does not show the fix button for other attention types', async () => {
    const { fixture } = await setup({
      shouldHaveClockedIn: true,
      attentionType: 'not_clocked_in',
      attentionLabel: 'Still has not clocked in',
      attentionSeverity: 'critical',
      attentionWorkDate: null
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="fix-missing-clock-out"]')).toBeNull();
  });

  it('opens a clock-out correction pre-set to the stale day when the fix button is used', async () => {
    const { fixture } = await setup({});
    const component = fixture.componentInstance;

    component.openMissingClockOutCorrection('2026-08-19');
    fixture.detectChanges();

    expect(component.correctionFormOpen()?.workDate).toBe('2026-08-19');
    expect(component.correctionType()).toBe('clock_out');
    expect(fixture.nativeElement.querySelector('input[name="requestedClockOutAt"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[name="requestedClockInAt"]')).toBeNull();
  });

});

function correctionResponse(overrides: Partial<AttendanceCorrectionResponse> = {}): AttendanceCorrectionResponse {
  return {
    id: 'correction-1',
    employeeId: 'employee-1',
    legalEntityId: 'entity-1',
    timezone: 'Asia/Colombo',
    workDate: '2026-08-22',
    correctionType: 'clock_in',
    requestedClockInAt: '2026-08-22T09:00:00Z',
    requestedClockOutAt: null,
    requestedBreaks: null,
    reason: 'Forgot to clock in.',
    notes: null,
    status: 'pending',
    approvalRequired: true,
    requestedById: 'user-1',
    reviewedById: null,
    reviewedAt: null,
    reviewComment: null,
    approver: null,
    requesterDisplayName: 'Alex Employee',
    ...overrides
  };
}

function formatForTimezone(value: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone
  }).format(new Date(value));
}
