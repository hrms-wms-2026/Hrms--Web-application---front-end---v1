import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { AttendanceTodayResponse } from '../models/time-tracking.model';
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
  messages: []
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

  it('getMyHistory passes from and to query parameters', () => {
    service.getMyHistory('2026-08-17', '2026-08-23').subscribe();
    const request = httpMock.expectOne(
      (candidate) => candidate.url === `${base}/history` && candidate.params.get('from') === '2026-08-17'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-08-17');
    expect(request.request.params.get('to')).toBe('2026-08-23');
    request.flush([]);
  });

  it('getCoveredHistory passes range and optional employeeId', () => {
    service.getCoveredHistory('2026-08-17', '2026-08-23', 'employee-7').subscribe();
    const request = httpMock.expectOne(
      (candidate) => candidate.url === `${base}/covered-history` && candidate.params.get('employeeId') === 'employee-7'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-08-17');
    expect(request.request.params.get('to')).toBe('2026-08-23');
    expect(request.request.params.get('employeeId')).toBe('employee-7');
    request.flush([]);
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
});
