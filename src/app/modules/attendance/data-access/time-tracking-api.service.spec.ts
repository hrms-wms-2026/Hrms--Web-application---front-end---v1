import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { AttendanceDayDetail, AttendanceHistoryRow, AttendanceTodayResponse, PagedResultDto } from '../models/time-tracking.model';
import { TimeTrackingApiService } from './time-tracking-api.service';

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
  attendanceStatusLabel: 'Not clocked in',
  attentionType: 'not_clocked_in',
  attentionLabel: 'Still has not clocked in',
  attentionSeverity: 'critical',
  breakOverageMinutes: 0,
  isOverBreakAllowance: false
};

describe('TimeTrackingApiService', () => {
  let service: TimeTrackingApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/attendance/time-tracking`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TimeTrackingApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TimeTrackingApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      httpMock?.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('getToday calls the today endpoint', () => {
    service.getToday().subscribe((response) => expect(response).toEqual(today));
    const request = httpMock.expectOne(`${base}/today`);
    expect(request.request.method).toBe('GET');
    request.flush(today);
  });

  it('preserves the expanded Today response fields', () => {
    service.getToday().subscribe((response) => {
      expect(response.attendanceStatusLabel).toBe('Not clocked in');
      expect(response.attentionType).toBe('not_clocked_in');
      expect(response.attentionLabel).toBe('Still has not clocked in');
      expect(response.attentionSeverity).toBe('critical');
      expect(response.breakOverageMinutes).toBe(0);
      expect(response.isOverBreakAllowance).toBe(false);
    });
    const request = httpMock.expectOne(`${base}/today`);
    request.flush(today);
  });

  it('preserves the expanded History response fields', () => {
    const row: AttendanceHistoryRow = {
      attendanceRecordId: 'record-1',
      workDate: '2026-08-22',
      employee: null,
      clockInAt: null,
      clockOutAt: null,
      isActive: false,
      breakMinutes: 45,
      totalWorkedMinutes: 0,
      expectedWorkMode: null,
      attendanceSource: null,
      status: 'over_break',
      canViewDetails: true,
      canRequestCorrection: false,
      canRequestWorkAreaChange: false,
      canCorrect: false,
      statusLabel: 'Over break allowance',
      attentionType: 'over_break',
      attentionLabel: 'Break time has exceeded the allowance',
      attentionSeverity: 'warning',
      breakOverageMinutes: 15,
      isOverBreakAllowance: true
    };
    const page: PagedResultDto<AttendanceHistoryRow> = { items: [row], pageNumber: 1, pageSize: 20, totalCount: 1 };
    service.getMyHistory('2026-08-17', '2026-08-23', 1, 20).subscribe((response) => {
      expect(response.items[0]).toEqual(row);
    });
    const request = httpMock.expectOne(
      (candidate) => candidate.url === `${base}/history` && candidate.params.get('from') === '2026-08-17'
    );
    request.flush(page);
  });

  it('getMyHistory passes from, to, and paging query parameters', () => {
    service.getMyHistory('2026-08-17', '2026-08-23', 2, 20).subscribe();
    const request = httpMock.expectOne(
      (candidate) => candidate.url === `${base}/history` && candidate.params.get('from') === '2026-08-17'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-08-17');
    expect(request.request.params.get('to')).toBe('2026-08-23');
    expect(request.request.params.get('pageNumber')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('20');
    request.flush({ items: [], pageNumber: 2, pageSize: 20, totalCount: 0 });
  });

  it('getDayDetail calls the history-detail endpoint with employeeId and date', () => {
    const detail: AttendanceDayDetail = {
      summary: {
        attendanceRecordId: 'record-1',
        workDate: '2026-08-27',
        employee: null,
        clockInAt: '2026-08-27T04:00:00Z',
        clockOutAt: null,
        isActive: true,
        breakMinutes: 0,
        totalWorkedMinutes: 120,
        expectedWorkMode: 'onsite',
        attendanceSource: 'web',
        status: 'clocked_in',
        canViewDetails: true,
        canRequestCorrection: true,
        canRequestWorkAreaChange: false,
        canCorrect: false
      },
      timelineEvents: [{ eventType: 'ClockIn', timestamp: '2026-08-27T04:00:00Z', source: 'web' }],
      dailyActivity: null
    };

    service.getDayDetail('employee-1', '2026-08-27').subscribe((response) => expect(response).toEqual(detail));

    const request = httpMock.expectOne(`${base}/history-detail?employeeId=employee-1&date=2026-08-27`);
    expect(request.request.method).toBe('GET');
    request.flush(detail);
  });

  it('getCoveredHistory passes range, paging, and optional employeeId', () => {
    service.getCoveredHistory('2026-08-17', '2026-08-23', 1, 20, 'employee-7').subscribe();
    const request = httpMock.expectOne(
      (candidate) => candidate.url === `${base}/covered-history` && candidate.params.get('employeeId') === 'employee-7'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-08-17');
    expect(request.request.params.get('to')).toBe('2026-08-23');
    expect(request.request.params.get('pageNumber')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('20');
    expect(request.request.params.get('employeeId')).toBe('employee-7');
    request.flush({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 });
  });

  it('clockIn sends only the web source payload', () => {
    service.clockIn().subscribe();
    const request = httpMock.expectOne(`${base}/clock-in`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ source: 'web' });
    request.flush(today);
  });

  it.each([
    ['startBreak', `${base}/break/start`],
    ['endBreak', `${base}/break/end`],
    ['clockOut', `${base}/clock-out`]
  ] as const)('%s calls its endpoint without a request body', (method, url) => {
    service[method]().subscribe();
    const request = httpMock.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush(today);
  });

  it('posts a correction preview with the backend request shape', () => {
    const payload = { workDate: '2026-08-21', correctionType: 'clock_in' as const, requestedClockInAt: '2026-08-21T03:30:00.000Z', requestedClockOutAt: null, requestedBreaks: null, reason: 'Forgot to clock in', notes: null };
    service.previewCorrection(payload).subscribe();
    const request = httpMock.expectOne(`${environment.apiUrl}/attendance/corrections/preview`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ approvalRequired: true, approver: { employeeId: 'e2', userId: 'u2', displayName: 'Approver', positionName: 'Manager' } });
  });

  it('loads requester corrections with paging and optional date filters, and pending approvals with status filters', () => {
    service.getMyCorrections(1, 20, '2026-08-01', '2026-08-31').subscribe();
    const mine = httpMock.expectOne((candidate) => candidate.url.endsWith('/attendance/corrections/my'));
    expect(mine.request.params.get('from')).toBe('2026-08-01');
    expect(mine.request.params.get('to')).toBe('2026-08-31');
    expect(mine.request.params.get('pageNumber')).toBe('1');
    expect(mine.request.params.get('pageSize')).toBe('20');
    mine.flush({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 });

    service.getApprovalInbox().subscribe();
    const approvals = httpMock.expectOne((candidate) => candidate.url.endsWith('/attendance/corrections/approvals'));
    expect(approvals.request.params.get('status')).toBe('pending');
    approvals.flush([]);
  });

  it.each([
    ['approveCorrection', 'approve'], ['rejectCorrection', 'reject'], ['cancelCorrection', 'cancel']
  ] as const)('%s calls the correction mutation endpoint', (method, action) => {
    const operation = method === 'cancelCorrection' ? service[method]('c1') : service[method]('c1', { reviewComment: 'Reviewed' });
    operation.subscribe();
    const request = httpMock.expectOne(`${environment.apiUrl}/attendance/corrections/c1/${action}`);
    expect(request.request.method).toBe('POST');
    request.flush({});
  });

  it('posts the Work Area preview and create payloads to the dedicated endpoints', () => {
    const payload = { date: '2026-08-25', requestedWorkArea: 'remote' as const, reason: 'Client meeting' };
    service.previewWorkAreaChange(payload).subscribe();
    const preview = httpMock.expectOne(`${environment.apiUrl}/attendance/work-area-change-requests/preview`);
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual(payload);
    preview.flush({});

    service.createWorkAreaChangeRequest(payload).subscribe();
    const create = httpMock.expectOne(`${environment.apiUrl}/attendance/work-area-change-requests`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(payload);
    create.flush({});
  });

  it('loads Work Area requester and approval lists with contract filters', () => {
    service.getMyWorkAreaChangeRequests({ status: 'pending', pageNumber: 2, pageSize: 10 }).subscribe();
    const mine = httpMock.expectOne((candidate) => candidate.url.endsWith('/attendance/work-area-change-requests/my'));
    expect(mine.request.params.get('status')).toBe('pending');
    expect(mine.request.params.get('pageNumber')).toBe('2');
    expect(mine.request.params.get('pageSize')).toBe('10');
    mine.flush({ items: [], pageNumber: 2, pageSize: 10, totalCount: 0 });

    service.getWorkAreaChangeApprovalInbox({ status: 'pending', pageNumber: 1, pageSize: 20 }).subscribe();
    const approvals = httpMock.expectOne((candidate) => candidate.url.endsWith('/attendance/work-area-change-requests/approvals'));
    expect(approvals.request.params.get('status')).toBe('pending');
    approvals.flush({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0 });
  });

  it.each([
    ['approveWorkAreaChangeRequest', 'approve'], ['rejectWorkAreaChangeRequest', 'reject'], ['cancelWorkAreaChangeRequest', 'cancel']
  ] as const)('%s calls the Work Area mutation endpoint', (method, action) => {
    const operation = method === 'cancelWorkAreaChangeRequest'
      ? service[method]('wa-1')
      : method === 'rejectWorkAreaChangeRequest'
        ? service[method]('wa-1', 'Reviewed')
        : service[method]('wa-1', 'Approved');
    operation.subscribe();
    const request = httpMock.expectOne(`${environment.apiUrl}/attendance/work-area-change-requests/wa-1/${action}`);
    expect(request.request.method).toBe('POST');
    if (action !== 'cancel') expect(request.request.body).toEqual({ reviewComment: action === 'reject' ? 'Reviewed' : 'Approved' });
    request.flush({});
  });
});
