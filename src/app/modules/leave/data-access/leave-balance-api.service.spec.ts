import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveBalanceApiService } from './leave-balance-api.service';
describe('LeaveBalanceApiService', () => { let service: LeaveBalanceApiService; let http: HttpTestingController; beforeEach(() => { TestBed.configureTestingModule({ providers: [LeaveBalanceApiService, provideHttpClient(), provideHttpClientTesting()] }); service = TestBed.inject(LeaveBalanceApiService); http = TestBed.inject(HttpTestingController); }); afterEach(() => http.verify()); it('gets personal balances for a year', () => { service.my(2026).subscribe(); const req = http.expectOne(`${environment.apiUrl}/leave/balances/my?year=2026`); expect(req.request.method).toBe('GET'); req.flush([]); }); it('gets team balances with filters', () => { service.team(2026, { departmentId: 'dept-1', search: 'anu' }).subscribe(); const req = http.expectOne(`${environment.apiUrl}/leave/balances/team?year=2026&departmentId=dept-1&search=anu`); req.flush([]); }); it('gets all balances with filters', () => { service.all(2026, { legalEntityId: 'le-1', leaveTypeId: 'type-1' }).subscribe(); const req = http.expectOne(`${environment.apiUrl}/leave/balances/all?year=2026&legalEntityId=le-1&leaveTypeId=type-1`); req.flush([]); }); it('gets the signed-in employee work window', () => { service.workWindow().subscribe(); const req = http.expectOne(`${environment.apiUrl}/leave/balances/work-window`); expect(req.request.method).toBe('GET'); req.flush({ workStartTime: '09:00', workEndTime: '18:00', breakDurationMinutes: 60, timezone: 'UTC' }); }); });

describe('LeaveBalanceApiService query strings (API helper safety net)', () => {
  let service: LeaveBalanceApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveBalanceApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveBalanceApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('team sends every filter in a fixed order', () => {
    service.team(2026, { search: 'anu', leaveTypeId: 'type-1', departmentId: 'dept-1' }).subscribe();
    http.expectOne(`${environment.apiUrl}/leave/balances/team?year=2026&departmentId=dept-1&leaveTypeId=type-1&search=anu`).flush([]);
  });

  it('all sends employmentStatusId 0 and skips an empty search', () => {
    service.all(2026, { employmentStatusId: 0, search: '' }).subscribe();
    http.expectOne(`${environment.apiUrl}/leave/balances/all?year=2026&employmentStatusId=0`).flush([]);
  });

  it('all sends every filter in a fixed order', () => {
    service
      .all(2026, { search: 'anu', employmentStatusId: 2, leaveTypeId: 'type-1', departmentId: 'dept-1', legalEntityId: 'le-1' })
      .subscribe();
    http
      .expectOne(
        `${environment.apiUrl}/leave/balances/all?year=2026&legalEntityId=le-1&departmentId=dept-1&leaveTypeId=type-1&employmentStatusId=2&search=anu`
      )
      .flush([]);
  });
});
