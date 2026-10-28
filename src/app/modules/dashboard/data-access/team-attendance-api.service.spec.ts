import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { TeamAttendanceApiService } from './team-attendance-api.service';

describe('TeamAttendanceApiService', () => {
  let service: TeamAttendanceApiService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/attendance/time-tracking/team`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TeamAttendanceApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('GETs the summary with mode and anchor only when department is unset', () => {
    service.getSummary({ mode: 'month', anchor: '2026-10-01', departmentId: null }).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/attendance-summary`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['anchor', 'mode']);
    expect(req.request.params.get('mode')).toBe('month');
    expect(req.request.params.get('anchor')).toBe('2026-10-01');
    req.flush({});
  });

  it('omits a null anchor', () => {
    service.getSummary({ mode: 'week', anchor: null, departmentId: 'd1' }).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/attendance-summary`);
    expect(req.request.params.has('anchor')).toBe(false);
    expect(req.request.params.get('departmentId')).toBe('d1');
    req.flush({});
  });

  it('GETs employees with paging and a trimmed search', () => {
    service.getEmployees({ mode: 'week', anchor: '2026-10-26', departmentId: null, search: '  ann ', page: 2, pageSize: 20 }).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/attendance-employees`);
    const p = req.request.params;
    expect(p.get('page')).toBe('2');
    expect(p.get('pageSize')).toBe('20');
    expect(p.get('search')).toBe('ann');
    expect(p.has('departmentId')).toBe(false);
    req.flush({ items: [], pageNumber: 2, pageSize: 20, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: true });
  });

  it('leaves out a blank search', () => {
    service.getEmployees({ mode: 'week', anchor: null, departmentId: null, search: '   ', page: 1, pageSize: 20 }).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/attendance-employees`);
    expect(req.request.params.has('search')).toBe(false);
    req.flush({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false });
  });
});
