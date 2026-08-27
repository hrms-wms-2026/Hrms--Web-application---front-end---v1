import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AttendanceTodayResponse } from '../models/time-tracking.model';
import { TimeTrackingApiService } from '../data-access/time-tracking-api.service';
import { WorkAreaChangeRequestResponse } from '../models/work-area-change-request.model';
import {
  TIME_TRACKING_COVERED_FORBIDDEN_ERROR,
  TimeTrackingStore
} from './time-tracking.store';

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
  attendanceStatusLabel: 'Not clocked in',
  attentionType: 'not_clocked_in',
  attentionLabel: 'Still has not clocked in',
  attentionSeverity: 'critical',
  breakOverageMinutes: 0,
  isOverBreakAllowance: false
};

const workAreaRequest: WorkAreaChangeRequestResponse = {
  id: 'wa-1',
  employeeId: 'employee-1',
  legalEntityId: 'entity-1',
  requesterDisplayName: 'Requester',
  timezone: 'Asia/Colombo',
  date: '2026-08-22',
  currentExpectedWorkArea: 'onsite',
  requestedWorkArea: 'remote',
  reason: 'Client meeting',
  status: 'pending',
  requestedAt: '2026-08-21T06:00:00.000Z',
  reviewedById: null,
  reviewerDisplayName: null,
  reviewedAt: null,
  reviewComment: null,
  receiver: { employeeId: 'approver-1', userId: 'user-1', displayName: 'Approver', positionName: 'Manager' }
};

describe('TimeTrackingStore', () => {
  let api: {
    getToday: ReturnType<typeof vi.fn>;
    getMyHistory: ReturnType<typeof vi.fn>;
    getCoveredHistory: ReturnType<typeof vi.fn>;
    getMyCorrections: ReturnType<typeof vi.fn>;
    getApprovalInbox: ReturnType<typeof vi.fn>;
    previewWorkAreaChange: ReturnType<typeof vi.fn>;
    createWorkAreaChangeRequest: ReturnType<typeof vi.fn>;
    getMyWorkAreaChangeRequests: ReturnType<typeof vi.fn>;
    getWorkAreaChangeApprovalInbox: ReturnType<typeof vi.fn>;
    approveWorkAreaChangeRequest: ReturnType<typeof vi.fn>;
    rejectWorkAreaChangeRequest: ReturnType<typeof vi.fn>;
    cancelWorkAreaChangeRequest: ReturnType<typeof vi.fn>;
    clockIn: ReturnType<typeof vi.fn>;
    startBreak: ReturnType<typeof vi.fn>;
    endBreak: ReturnType<typeof vi.fn>;
    clockOut: ReturnType<typeof vi.fn>;
  };
  let notifications: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let errors: { toSafeMessage: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof TimeTrackingStore>;

  beforeEach(() => {
    api = {
      getToday: vi.fn(() => of(today)),
      getMyHistory: vi.fn(() => of({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 })),
      getCoveredHistory: vi.fn(() => of({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 })),
      getMyCorrections: vi.fn(() => of({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 })),
      getApprovalInbox: vi.fn(() => of([])),
      previewWorkAreaChange: vi.fn(() => of({ date: '2026-08-22', timezone: 'Asia/Colombo', currentExpectedWorkArea: 'onsite', requestedWorkArea: 'remote', reason: 'Client meeting', receiver: { employeeId: 'approver-1', userId: 'user-1', displayName: 'Approver', positionName: 'Manager' } })),
      createWorkAreaChangeRequest: vi.fn(() => of(workAreaRequest)),
      getMyWorkAreaChangeRequests: vi.fn((query: { pageNumber: number; pageSize: number }) => of({ items: [workAreaRequest], pageNumber: query.pageNumber, pageSize: query.pageSize, totalCount: 1 })),
      getWorkAreaChangeApprovalInbox: vi.fn((query: { pageNumber: number; pageSize: number }) => of({ items: [workAreaRequest], pageNumber: query.pageNumber, pageSize: query.pageSize, totalCount: 1 })),
      approveWorkAreaChangeRequest: vi.fn(() => of({ ...workAreaRequest, status: 'approved' })),
      rejectWorkAreaChangeRequest: vi.fn(() => of({ ...workAreaRequest, status: 'rejected' })),
      cancelWorkAreaChangeRequest: vi.fn(() => of({ ...workAreaRequest, status: 'cancelled' })),
      clockIn: vi.fn(() => of(today)),
      startBreak: vi.fn(() => of(today)),
      endBreak: vi.fn(() => of(today)),
      clockOut: vi.fn(() => of(today))
    };
    notifications = { success: vi.fn(), error: vi.fn() };
    errors = { toSafeMessage: vi.fn(() => 'A friendly attendance error.') };

    TestBed.configureTestingModule({
      providers: [
        TimeTrackingStore,
        { provide: TimeTrackingApiService, useValue: api },
        { provide: NotificationService, useValue: notifications },
        { provide: ErrorHandlerService, useValue: errors }
      ]
    });
    store = TestBed.inject(TimeTrackingStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads Work Area requester and approval pages with separate list state', async () => {
    await store.loadMyWorkAreaRequests();
    await store.loadWorkAreaApprovalInbox({ status: 'pending' });

    expect(api.getMyWorkAreaChangeRequests).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 20 });
    expect(api.getWorkAreaChangeApprovalInbox).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 20, status: 'pending' });
    expect(store.myWorkAreaRequests()).toHaveLength(1);
    expect(store.workAreaApprovalInbox()).toHaveLength(1);
  });

  it('previews and submits a Work Area request with dedicated loading state and success outcome', async () => {
    const payload = { date: '2026-08-22', requestedWorkArea: 'remote' as const, reason: 'Client meeting' };
    const preview = await store.previewWorkAreaChange(payload);
    expect(preview?.receiver.displayName).toBe('Approver');
    expect(store.workAreaPreview()).toEqual(preview);

    const result = await store.submitWorkAreaChangeRequest(payload);
    expect(result?.status).toBe('pending');
    expect(notifications.success).toHaveBeenCalledWith('Work-area change request sent.');
    expect(store.workAreaActionLoading()).toBe(false);
    expect(store.workAreaCreateLoading()).toBe(false);
  });

  it('refreshes My Requests after a cancellation conflict and shows a safe error', async () => {
    api.cancelWorkAreaChangeRequest.mockReturnValue(throwError(() => ({ status: 409, error: { detail: 'already been updated' } })));

    await store.cancelWorkAreaChangeRequest('wa-1');

    expect(api.getMyWorkAreaChangeRequests).toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith('This request has already been updated. Refreshing the list.');
    expect(store.workAreaActionLoading()).toBe(false);
  });

  it('refreshes the approval inbox after an approval conflict', async () => {
    api.approveWorkAreaChangeRequest.mockReturnValue(throwError(() => ({ status: 409, error: { detail: 'changed by another reviewer' } })));

    await store.approveWorkAreaChangeRequest('wa-1', null);

    expect(api.getWorkAreaChangeApprovalInbox).toHaveBeenCalled();
    expect(notifications.error).toHaveBeenCalledWith('This request has already been updated. Refreshing the list.');
  });

  it('loadToday stores the response', async () => {
    await store.loadToday();
    expect(api.getToday).toHaveBeenCalledOnce();
    expect(store.today()).toEqual(today);
    expect(store.today()?.attendanceStatusLabel).toBe('Not clocked in');
    expect(store.today()?.attentionType).toBe('not_clocked_in');
    expect(store.today()?.attentionLabel).toBe('Still has not clocked in');
    expect(store.today()?.attentionSeverity).toBe('critical');
    expect(store.today()?.breakOverageMinutes).toBe(0);
    expect(store.today()?.isOverBreakAllowance).toBe(false);
    expect(store.todayLoading()).toBe(false);
    expect(store.todayError()).toBeNull();
  });

  it('mutations replace today and show the matching success toast', async () => {
    const updated = { ...today, canClockIn: false, canClockOut: true, attendanceStatus: 'clocked_in' };
    api.clockIn.mockReturnValue(of(updated));

    await store.clockIn();

    expect(store.today()).toEqual(updated);
    expect(notifications.success).toHaveBeenCalledWith('Clocked in.');
    expect(store.actionLoading()).toBe(false);
    expect(store.activeAction()).toBeNull();
  });

  it('prevents duplicate in-flight action calls', async () => {
    const response = new Subject<AttendanceTodayResponse>();
    api.clockIn.mockReturnValue(response.asObservable());

    const first = store.clockIn();
    const second = store.clockIn();
    expect(api.clockIn).toHaveBeenCalledOnce();
    expect(store.activeAction()).toBe('clockIn');

    response.next(today);
    response.complete();
    await first;
    await second;
    expect(notifications.success).toHaveBeenCalledOnce();
  });

  it('uses a sanitized notification message on mutation failure and does not toast success', async () => {
    api.clockOut.mockReturnValue(throwError(() => new Error('RAW_BACKEND_CODE')));

    await store.clockOut();

    expect(errors.toSafeMessage).toHaveBeenCalled();
    expect(store.todayError()).toBe('A friendly attendance error.');
    expect(notifications.error).toHaveBeenCalledWith('A friendly attendance error.');
    expect(notifications.success).not.toHaveBeenCalled();
  });

  it('shows a friendly covered-history message for a 403 response', async () => {
    api.getCoveredHistory.mockReturnValue(throwError(() => ({ status: 403 })));

    await store.loadCoveredHistory({ from: '2026-08-17', to: '2026-08-23' });

    expect(store.coveredHistoryError()).toBe(TIME_TRACKING_COVERED_FORBIDDEN_ERROR);
    expect(errors.toSafeMessage).not.toHaveBeenCalled();
  });

  it('loadMyHistory resets to the requested page and stores the paged totals', async () => {
    api.getMyHistory.mockReturnValue(of({ items: [], pageNumber: 3, pageSize: 20, totalCount: 61 }));

    await store.loadMyHistory({ from: '2026-08-17', to: '2026-08-23' }, 3);

    expect(api.getMyHistory).toHaveBeenCalledWith('2026-08-17', '2026-08-23', 3, 20);
    expect(store.historyPage()).toBe(3);
    expect(store.historyTotalCount()).toBe(61);
  });

  it('loadMyCorrections defaults to page 1 and stores the paged totals', async () => {
    api.getMyCorrections.mockReturnValue(of({ items: [], pageNumber: 1, pageSize: 20, totalCount: 5 }));

    await store.loadMyCorrections();

    expect(api.getMyCorrections).toHaveBeenCalledWith(1, 20);
    expect(store.myCorrectionsPage()).toBe(1);
    expect(store.myCorrectionsTotalCount()).toBe(5);
  });

  it('marks corrections as loaded after a successful load, but not before', async () => {
    expect(store.myCorrectionsLoaded()).toBe(false);

    await store.loadMyCorrections();

    expect(store.myCorrectionsLoaded()).toBe(true);
  });

  it('marks Work Area requests as loaded after a successful load, but not before', async () => {
    expect(store.myWorkAreaRequestsLoaded()).toBe(false);

    await store.loadMyWorkAreaRequests();

    expect(store.myWorkAreaRequestsLoaded()).toBe(true);
  });

  it('does not mark corrections as loaded when the load fails', async () => {
    api.getMyCorrections.mockReturnValue(throwError(() => new Error('boom')));

    await store.loadMyCorrections();

    expect(store.myCorrectionsLoaded()).toBe(false);
  });

  it('sets approvalInboxLoaded to true only after a successful loadApprovalInbox', async () => {
    api.getApprovalInbox.mockReturnValue(of([]));
    expect(store.approvalInboxLoaded()).toBe(false);

    await store.loadApprovalInbox();

    expect(store.approvalInboxLoaded()).toBe(true);
  });

  it('does not set approvalInboxLoaded after a failed loadApprovalInbox', async () => {
    api.getApprovalInbox.mockReturnValue(throwError(() => new Error('network')));

    await store.loadApprovalInbox();

    expect(store.approvalInboxLoaded()).toBe(false);
  });

  it('sets workAreaApprovalInboxLoaded to true only after a successful loadWorkAreaApprovalInbox', async () => {
    expect(store.workAreaApprovalInboxLoaded()).toBe(false);

    await store.loadWorkAreaApprovalInbox();

    expect(store.workAreaApprovalInboxLoaded()).toBe(true);
  });

  it('does not set workAreaApprovalInboxLoaded after a failed loadWorkAreaApprovalInbox', async () => {
    api.getWorkAreaChangeApprovalInbox.mockReturnValue(throwError(() => new Error('network')));

    await store.loadWorkAreaApprovalInbox();

    expect(store.workAreaApprovalInboxLoaded()).toBe(false);
  });

  it('keeps requester and approval filters in separate store signals', async () => {
    await store.loadWorkAreaApprovalInbox({ status: 'pending', pageNumber: 2 });

    const state = store as unknown as Record<string, unknown>;
    const requesterFilters = state['myWorkAreaRequestFilters'];
    const approvalFilters = state['workAreaApprovalFilters'];

    expect(typeof requesterFilters).toBe('function');
    expect(typeof approvalFilters).toBe('function');
    expect((requesterFilters as () => unknown)()).toEqual({ pageNumber: 1, pageSize: 20 });
    expect((approvalFilters as () => unknown)()).toEqual({ status: 'pending', pageNumber: 2, pageSize: 20 });
  });

  it('does not leak approval status into a subsequent requester-history load', async () => {
    await store.loadWorkAreaApprovalInbox({ status: 'pending' });
    await store.loadMyWorkAreaRequests();

    expect(api.getMyWorkAreaChangeRequests).toHaveBeenLastCalledWith({ pageNumber: 1, pageSize: 20 });
  });

  it('keeps requester and approval pagination independent in both directions', async () => {
    await store.loadMyWorkAreaRequests({ pageNumber: 3 });
    await store.loadWorkAreaApprovalInbox({ pageNumber: 2, status: 'pending' });
    await store.loadMyWorkAreaRequests();

    expect(api.getMyWorkAreaChangeRequests).toHaveBeenLastCalledWith({ pageNumber: 3, pageSize: 20 });
    expect(store.myWorkAreaRequestsPage()).toBe(3);
    expect(store.workAreaApprovalInboxPage()).toBe(2);

    expect((store as unknown as Record<string, unknown>)['myWorkAreaRequestFilters']).toBeDefined();
    expect((store as unknown as Record<string, unknown>)['workAreaApprovalFilters']).toBeDefined();
  });

  it('refreshes an approval conflict with the current approval filters only', async () => {
    await store.loadMyWorkAreaRequests({ status: 'approved', pageNumber: 4 });
    await store.loadWorkAreaApprovalInbox({ status: 'pending', pageNumber: 2 });
    api.approveWorkAreaChangeRequest.mockReturnValue(throwError(() => ({ status: 409, error: { detail: 'changed by another reviewer' } })));

    await store.approveWorkAreaChangeRequest('wa-1', null);

    expect(api.getWorkAreaChangeApprovalInbox).toHaveBeenLastCalledWith({ status: 'pending', pageNumber: 2, pageSize: 20 });
    expect(api.getMyWorkAreaChangeRequests).toHaveBeenLastCalledWith({ status: 'approved', pageNumber: 4, pageSize: 20 });
  });

  it('refreshes a cancellation conflict with requester-history filters only', async () => {
    await store.loadMyWorkAreaRequests({ status: 'approved', pageNumber: 3 });
    await store.loadWorkAreaApprovalInbox({ status: 'pending', pageNumber: 2 });
    api.cancelWorkAreaChangeRequest.mockReturnValue(throwError(() => ({ status: 409, error: { detail: 'already been updated' } })));

    await store.cancelWorkAreaChangeRequest('wa-1');

    expect(api.getMyWorkAreaChangeRequests).toHaveBeenLastCalledWith({ status: 'approved', pageNumber: 3, pageSize: 20 });
    expect(api.getWorkAreaChangeApprovalInbox).toHaveBeenLastCalledWith({ status: 'pending', pageNumber: 2, pageSize: 20 });
  });

  it('keeps requester and approval list data isolated', async () => {
    const requester = { ...workAreaRequest, id: 'requester-only' };
    const approval = { ...workAreaRequest, id: 'approval-only' };
    api.getMyWorkAreaChangeRequests.mockReturnValue(of({ items: [requester], pageNumber: 1, pageSize: 20, totalCount: 1 }));
    api.getWorkAreaChangeApprovalInbox.mockReturnValue(of({ items: [approval], pageNumber: 1, pageSize: 20, totalCount: 1 }));

    await store.loadMyWorkAreaRequests();
    await store.loadWorkAreaApprovalInbox();

    expect(store.myWorkAreaRequests().map((item) => item.id)).toEqual(['requester-only']);
    expect(store.workAreaApprovalInbox().map((item) => item.id)).toEqual(['approval-only']);
  });
});
