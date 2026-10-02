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
