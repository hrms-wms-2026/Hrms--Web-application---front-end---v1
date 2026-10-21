import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { TeamProgressDetailApiService } from './team-progress-detail-api.service';

describe('TeamProgressDetailApiService', () => {
  let service: TeamProgressDetailApiService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/work/led-progress`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TeamProgressDetailApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('GETs employees with paging, sort and the set filters only', () => {
    let total = -1;
    service
      .getEmployees({ pageNumber: 2, pageSize: 20, search: 'ann', projectId: 'p1', objectiveId: undefined, sort: 'name', direction: 'asc' })
      .subscribe((page) => (total = page.totalCount));

    const req = http.expectOne((r) => r.url === `${base}/employees`);
    expect(req.request.method).toBe('GET');
    const p = req.request.params;
    expect(p.get('pageNumber')).toBe('2');
    expect(p.get('pageSize')).toBe('20');
    expect(p.get('search')).toBe('ann');
    expect(p.get('projectId')).toBe('p1');
    expect(p.has('objectiveId')).toBe(false);
    expect(p.get('sort')).toBe('name');
    expect(p.get('direction')).toBe('asc');
    req.flush({
      items: [], pageNumber: 2, pageSize: 20, totalCount: 7, totalPages: 1, hasNext: false, hasPrevious: true,
      unassigned: { completedHours: 0, inProgressHours: 0, notStartedHours: 0, totalHours: 0, taskCount: 0 }
    });
    expect(total).toBe(7);
  });

  it('GETs tasks with status, employee and module filters and drops an empty search', () => {
    service
      .getTasks({
        pageNumber: 1, pageSize: 20, search: '', status: 'inProgress', objectiveId: 'o1', employeeId: 'e1',
        sort: 'dueDate', direction: 'desc'
      })
      .subscribe();

    const req = http.expectOne((r) => r.url === `${base}/tasks`);
    const p = req.request.params;
    expect(p.get('status')).toBe('inProgress');
    expect(p.get('objectiveId')).toBe('o1');
    expect(p.get('employeeId')).toBe('e1');
    expect(p.get('sort')).toBe('dueDate');
    expect(p.get('direction')).toBe('desc');
    expect(p.has('search')).toBe(false);
    expect(p.has('projectId')).toBe(false);
    req.flush({ items: [], pageNumber: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false });
  });

  it('GETs the period progress for a week or month', () => {
    let total = -1;
    service.getPeriodProgress('week').subscribe((r) => (total = r.totalHours));

    const req = http.expectOne((r) => r.url === `${base}/period`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('period')).toBe('week');
    req.flush({
      period: 'week', from: '2026-10-19', to: '2026-10-25', completedHours: 2, inProgressHours: 3, notStartedHours: 5,
      totalHours: 10, taskCount: 4, completedTaskCount: 1, inProgressTaskCount: 1, notStartedTaskCount: 2, unestimatedTaskCount: 0
    });
    expect(total).toBe(10);
  });
});
