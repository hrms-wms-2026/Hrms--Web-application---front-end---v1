import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AttendanceTodayResponse } from '../models/time-tracking.model';
import { TimeTrackingApiService } from '../data-access/time-tracking-api.service';
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

describe('TimeTrackingStore', () => {
  let api: {
    getToday: ReturnType<typeof vi.fn>;
    getMyHistory: ReturnType<typeof vi.fn>;
    getCoveredHistory: ReturnType<typeof vi.fn>;
    getMyCorrections: ReturnType<typeof vi.fn>;
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
});
