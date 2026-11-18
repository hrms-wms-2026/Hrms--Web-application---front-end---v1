import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveCalendarMonthResponse } from '../models/leave-calendar.model';
import { LeaveCalendarApiService } from './leave-calendar-api.service';

describe('LeaveCalendarApiService', () => {
  let service: LeaveCalendarApiService;
  let httpMock: HttpTestingController;

  const month: LeaveCalendarMonthResponse = {
    year: 2026, month: 9, monthStart: '2026-09-01', monthEnd: '2026-09-30',
    includesTentativeBlocks: false, isEmpty: false, days: []
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveCalendarApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveCalendarApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetches a month with year and month only', () => {
    service.getMonth({ year: 2026, month: 9 }).subscribe((res) => expect(res).toEqual(month));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/calendar?year=2026&month=9`);
    expect(req.request.method).toBe('GET');
    req.flush(month);
  });

  it('fetches a month with department and includeTentative filters', () => {
    service.getMonth({ year: 2026, month: 9, departmentId: 'dept-1', includeTentative: true }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/calendar?year=2026&month=9&departmentId=dept-1&includeTentative=true`);
    req.flush(month);
  });
});

describe('LeaveCalendarApiService query strings (API helper safety net)', () => {
  let service: LeaveCalendarApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveCalendarApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveCalendarApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends includeTentative=false when it is false', () => {
    service.getMonth({ year: 2026, month: 9, includeTentative: false }).subscribe();
    http.expectOne(`${environment.apiUrl}/leave/calendar?year=2026&month=9&includeTentative=false`).flush({});
  });

  it('lists holidays for a from/to range', () => {
    service.listHolidays('2026-01-01', '2026-12-31').subscribe();
    http.expectOne(`${environment.apiUrl}/leave/holidays?from=2026-01-01&to=2026-12-31`).flush([]);
  });
});
