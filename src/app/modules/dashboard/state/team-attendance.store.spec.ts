import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamAttendanceApiService } from '../data-access/team-attendance-api.service';
import { TeamAttendancePeriodQuery, TeamAttendanceSummaryResponse } from '../models/team-attendance.model';
import { TeamAttendanceStore } from './team-attendance.store';

function summary(over: Partial<TeamAttendanceSummaryResponse> = {}): TeamAttendanceSummaryResponse {
  const zero = { present: 0, late: 0, absent: 0, onLeave: 0, pending: 0 };
  return {
    mode: 'week', rangeStart: '2026-10-26', rangeEnd: '2026-11-01', timezone: 'UTC', today: '2026-10-28',
    eligibleToday: 0, todayCounts: zero, todayRate: null, periodCounts: zero, periodRate: null, previousRate: null,
    deltaPp: null, trend: [], todayPreview: [], departments: [], teamSize: 0, calculatedAtUtc: '2026-10-28T10:00:00Z',
    isProvisional: true, ...over
  };
}

describe('TeamAttendanceStore', () => {
  let getSummary: ReturnType<typeof vi.fn>;
  let store: InstanceType<typeof TeamAttendanceStore>;

  beforeEach(() => {
    getSummary = vi.fn((_q: TeamAttendancePeriodQuery) => of(summary()));
    TestBed.configureTestingModule({
      providers: [TeamAttendanceStore, { provide: TeamAttendanceApiService, useValue: { getSummary } }]
    });
    store = TestBed.inject(TeamAttendanceStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('seed applies the bootstrap and anchors the period on its range start', () => {
    store.seed(summary());

    expect(store.data()?.rangeStart).toBe('2026-10-26');
    expect(store.query()).toEqual({ mode: 'week', anchor: '2026-10-26', departmentId: null });
    expect(store.loadedAt()).toBeInstanceOf(Date);
    expect(getSummary).not.toHaveBeenCalled();
  });

  it('seed of a different period than the selected one reloads the selected one instead', () => {
    store.setMode('month');
    getSummary.mockClear();

    store.seed(summary());

    expect(getSummary).toHaveBeenCalledWith(expect.objectContaining({ mode: 'month' }));
  });

  it('shift moves a week by 7 days', () => {
    store.seed(summary());

    store.shift(-1);

    expect(store.query().anchor).toBe('2026-10-19');
    expect(getSummary).toHaveBeenLastCalledWith({ mode: 'week', anchor: '2026-10-19', departmentId: null });
  });

  it('shift moves a month to the first of the next month', () => {
    getSummary.mockReturnValue(of(summary({ mode: 'month', rangeStart: '2026-01-01', rangeEnd: '2026-01-31', today: '2026-01-31' })));
    store.setMode('month');

    store.shift(1);

    expect(store.query().anchor).toBe('2026-02-01');
  });

  it('setMode from the current period anchors on today', () => {
    store.seed(summary());

    store.setMode('month');

    expect(getSummary).toHaveBeenLastCalledWith({ mode: 'month', anchor: '2026-10-28', departmentId: null });
  });

  it('setMode_latestResponseWins', () => {
    const week = new Subject<TeamAttendanceSummaryResponse>();
    const month = new Subject<TeamAttendanceSummaryResponse>();
    getSummary.mockImplementation((q: TeamAttendancePeriodQuery) => (q.mode === 'month' ? month : week));
    store.seed(summary());

    store.setMode('month');
    store.setMode('week');
    week.next(summary({ mode: 'week', rangeStart: '2026-10-26' }));
    month.next(summary({ mode: 'month', rangeStart: '2026-10-01' }));

    expect(store.data()?.mode).toBe('week');
    expect(store.loading()).toBe(false);
  });

  it('setDepartment reloads with the department', () => {
    store.seed(summary());

    store.setDepartment('d1');

    expect(store.query().departmentId).toBe('d1');
    expect(getSummary).toHaveBeenLastCalledWith(expect.objectContaining({ departmentId: 'd1' }));
  });

  it('a failed load keeps the period and reports the error', () => {
    const failing = new Subject<TeamAttendanceSummaryResponse>();
    getSummary.mockReturnValue(failing);

    store.load();
    failing.error({ error: { detail: 'Nope' } });

    expect(store.error()).toBe('Nope');
    expect(store.loading()).toBe(false);
  });
});
