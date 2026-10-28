import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamAttendanceApiService } from '../../data-access/team-attendance-api.service';
import {
  TeamAttendanceBucket,
  TeamAttendanceEmployeeRow,
  TeamAttendanceEmployeesQuery,
  TeamAttendancePage,
  TeamAttendanceSummaryResponse
} from '../../models/team-attendance.model';
import { TeamAttendanceStore } from '../../state/team-attendance.store';
import { TeamAttendanceDetailDialogComponent } from './team-attendance-detail-dialog.component';

function dates(start: string, count: number): string[] {
  const [y, m, d] = start.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
}

function summary(over: Partial<TeamAttendanceSummaryResponse> = {}): TeamAttendanceSummaryResponse {
  const zero = { present: 0, late: 0, absent: 0, onLeave: 0, pending: 0 };
  return {
    mode: 'week', rangeStart: '2026-10-26', rangeEnd: '2026-11-01', timezone: 'UTC', today: '2026-10-28',
    eligibleToday: 2, todayCounts: { ...zero, present: 2 }, todayRate: 100,
    periodCounts: { present: 40, late: 3, absent: 2, onLeave: 1, pending: 0 }, periodRate: 95.6, previousRate: 90, deltaPp: 5.6,
    trend: dates('2026-10-26', 7).map((date) => ({ date, ...zero, present: 2, rate: 100 })), todayPreview: [],
    departments: [{ id: 'd1', name: 'Development' }], teamSize: 2, calculatedAtUtc: '2026-10-28T10:00:00Z', isProvisional: true,
    ...over
  };
}

function row(name: string, days: string[], bucket: (i: number) => TeamAttendanceBucket = () => 'present'): TeamAttendanceEmployeeRow {
  return {
    employeeId: name, name, avatarFileId: null, department: 'Development',
    days: days.map((date, i) => ({ date, bucket: bucket(i) })), attended: 3, eligibleDays: 3, rate: 100
  };
}

function page(items: TeamAttendanceEmployeeRow[], pageNumber = 1, totalPages = 1): TeamAttendancePage<TeamAttendanceEmployeeRow> {
  return { items, pageNumber, pageSize: 20, totalCount: items.length, totalPages, hasNext: pageNumber < totalPages, hasPrevious: pageNumber > 1 };
}

describe('TeamAttendanceDetailDialogComponent', () => {
  let fixture: ComponentFixture<TeamAttendanceDetailDialogComponent>;
  let store: InstanceType<typeof TeamAttendanceStore>;
  let getSummary: ReturnType<typeof vi.fn>;
  let getEmployees: ReturnType<typeof vi.fn>;
  const weekDays = dates('2026-10-26', 7);

  function setup(data: TeamAttendanceSummaryResponse = summary()): HTMLElement {
    getSummary = vi.fn(() => of(data));
    getEmployees = vi.fn((q: TeamAttendanceEmployeesQuery) =>
      of(page([row('Ann', data.trend.map((p) => p.date), (i) => (i === 1 ? 'late' : 'present')), row('Bob', data.trend.map((p) => p.date))], q.page)));
    TestBed.configureTestingModule({
      imports: [TeamAttendanceDetailDialogComponent],
      providers: [TeamAttendanceStore, { provide: TeamAttendanceApiService, useValue: { getSummary, getEmployees } }]
    });
    store = TestBed.inject(TeamAttendanceStore);
    store.seed(data);
    fixture = TestBed.createComponent(TeamAttendanceDetailDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    return document.body;
  }

  const all = (id: string) => document.body.querySelectorAll(`[data-testid=${id}]`);
  const one = (id: string) => document.body.querySelector(`[data-testid=${id}]`);

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  beforeEach(() => vi.useRealTimers());

  it('loads employees for the store\'s period, so opening keeps the selected mode', () => {
    setup(summary({ mode: 'month', rangeStart: '2026-10-01', rangeEnd: '2026-10-31', trend: dates('2026-10-01', 31).map((date) => ({ date, present: 1, late: 0, absent: 0, onLeave: 0, pending: 0, rate: 100 })) }));

    expect(getEmployees).toHaveBeenCalledWith(expect.objectContaining({ mode: 'month', anchor: '2026-10-01', page: 1 }));
    expect(one('tad-range')?.textContent?.trim()).toBe('October 2026');
  });

  it('a week renders 7 date columns and February 2028 renders 29', () => {
    setup();
    expect(all('tad-date-col').length).toBe(7);

    TestBed.resetTestingModule();
    setup(summary({ mode: 'month', rangeStart: '2028-02-01', rangeEnd: '2028-02-29', trend: dates('2028-02-01', 29).map((date) => ({ date, present: 1, late: 0, absent: 0, onLeave: 0, pending: 0, rate: 100 })) }));
    expect(all('tad-date-col').length).toBe(29);
  });

  it('shows Late as its own labelled cell, distinct from Present', () => {
    setup();
    const cells = all('tad-cell');

    expect(cells[0].getAttribute('aria-label')).toBe('Present');
    expect(cells[1].getAttribute('aria-label')).toBe('Late');
    expect(cells[1].className).not.toBe(cells[0].className);
  });

  it('shows five period tiles counted in days', () => {
    setup();
    const tiles = [...all('kpi-tile')].map((t) => t.textContent?.replace(/\s+/g, ' ').trim());

    expect(tiles.length).toBe(5);
    expect(tiles[0]).toContain('2');
    expect(tiles[1]).toContain('40');
    expect(tiles[1]).toContain('days');
  });

  it('searches after a pause', () => {
    vi.useFakeTimers();
    setup();
    getEmployees.mockClear();

    fixture.componentInstance.onSearch('ann');
    vi.advanceTimersByTime(299);
    fixture.detectChanges();
    expect(getEmployees).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();

    expect(getEmployees).toHaveBeenCalledWith(expect.objectContaining({ search: 'ann', page: 1 }));
  });

  it('the department filter goes through the store', () => {
    setup();
    const setDepartment = vi.spyOn(store, 'setDepartment');

    fixture.componentInstance.onDepartment('d1');
    fixture.componentInstance.onDepartment('');

    expect(setDepartment).toHaveBeenNthCalledWith(1, 'd1');
    expect(setDepartment).toHaveBeenNthCalledWith(2, null);
  });

  it('exports every page of the current filter as escaped CSV', async () => {
    setup();
    const download = vi.spyOn(fixture.componentInstance, 'downloadFile').mockImplementation(() => undefined);
    getEmployees.mockImplementation((q: TeamAttendanceEmployeesQuery) =>
      of(page([row(q.page === 1 ? '=HYPERLINK("x")' : 'Bob', weekDays, (i) => (i === 1 ? 'late' : i === 5 ? 'off' : 'present'))], q.page, 2)));

    await fixture.componentInstance.exportCsv();

    expect(getEmployees).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 50 }));
    const [filename, text] = download.mock.calls[0];
    expect(filename).toBe('team-attendance-2026-10-26_2026-11-01.csv');
    const lines = text.split('\r\n');
    expect(lines[0]).toBe('Name,Department,2026-10-26,2026-10-27,2026-10-28,2026-10-29,2026-10-30,2026-10-31,2026-11-01,Attended,Eligible days,Rate %');
    expect(lines[1].startsWith(`"'=HYPERLINK(""x"")",Development,Present,Late,`)).toBe(true);
    expect(lines[1]).toContain(',Off,');
    expect(lines).toHaveLength(3);
  });

  it('a failed export says so and downloads nothing', async () => {
    setup();
    const download = vi.spyOn(fixture.componentInstance, 'downloadFile').mockImplementation(() => undefined);
    getEmployees.mockImplementation(() => throwError(() => new Error('boom')));

    await fixture.componentInstance.exportCsv();
    fixture.detectChanges();

    expect(download).not.toHaveBeenCalled();
    expect(one('tad-export-error')?.textContent).toContain("Couldn't export");
  });

  it('closing clears a department filter, so the card never shows filtered figures unannounced', () => {
    setup();
    store.setDepartment('d1');

    fixture.componentInstance.close();

    expect(store.query().departmentId).toBeNull();
  });

  it('emits closed when the modal closes', () => {
    setup();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);

    fixture.componentInstance.close();

    expect(closed).toBe(1);
  });
});
