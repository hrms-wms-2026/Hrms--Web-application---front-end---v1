import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamScheduleApiService } from '../data-access/team-schedule-api.service';
import { weekResponse } from '../utils/team-schedule.testing';
import { TeamScheduleWeekStore } from './team-schedule-week.store';

describe('TeamScheduleWeekStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(fail: () => boolean = () => false) {
    const getTeamWeek = vi.fn((weekStart: string | null) =>
      fail()
        ? throwError(() => new Error('boom'))
        : of(weekResponse({ weekStart: weekStart ?? '2026-10-26' })),
    );
    TestBed.configureTestingModule({
      providers: [
        TeamScheduleWeekStore,
        { provide: TeamScheduleApiService, useValue: { getTeamWeek } },
      ],
    });
    return { store: TestBed.inject(TeamScheduleWeekStore), getTeamWeek };
  }

  it('is lazy: nothing loads until load is called', () => {
    const { store, getTeamWeek } = setup();

    expect(getTeamWeek).not.toHaveBeenCalled();
    expect(store.data()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('loads a week, then fails, then retries the same week', () => {
    let failing = false;
    const { store, getTeamWeek } = setup(() => failing);

    store.load(null);
    expect(getTeamWeek).toHaveBeenLastCalledWith(null);
    expect(store.data()!.weekStart).toBe('2026-10-26');
    expect(store.currentWeek()).toBe('2026-10-26');

    failing = true;
    store.load('2026-10-19');
    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);

    failing = false;
    store.retry();
    expect(getTeamWeek).toHaveBeenLastCalledWith('2026-10-19');
    expect(store.error()).toBeNull();
    expect(store.data()!.weekStart).toBe('2026-10-19');
  });

  it('shiftWeek steps by seven days and never past the current week', () => {
    const { store, getTeamWeek } = setup();

    store.load(null);
    store.shiftWeek(-1);
    expect(getTeamWeek).toHaveBeenLastCalledWith('2026-10-19');
    store.shiftWeek(1);
    expect(getTeamWeek).toHaveBeenLastCalledWith(null);
    store.shiftWeek(1);
    expect(getTeamWeek).toHaveBeenLastCalledWith(null);
  });
});
