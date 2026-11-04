import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamScheduleApiService } from '../data-access/team-schedule-api.service';
import { scheduleResponse } from '../utils/team-schedule.testing';
import { TeamScheduleStore } from './team-schedule.store';

describe('TeamScheduleStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(fail = false) {
    const getTeamDay = vi.fn((date: string | null) =>
      fail
        ? throwError(() => new Error('boom'))
        : of(scheduleResponse([], { date: date ?? '2026-10-29' })),
    );
    TestBed.configureTestingModule({
      providers: [TeamScheduleStore, { provide: TeamScheduleApiService, useValue: { getTeamDay } }],
    });
    return { store: TestBed.inject(TeamScheduleStore), getTeamDay };
  }

  it('loads today, then a past day, and keeps the shown day for retry', () => {
    const { store, getTeamDay } = setup();

    store.load();
    expect(getTeamDay).toHaveBeenLastCalledWith(null);
    expect(store.data()!.date).toBe('2026-10-29');
    expect(store.loadedAt()).toBeInstanceOf(Date);

    store.load('2026-10-27');
    expect(store.date()).toBe('2026-10-27');
    store.retry();
    expect(getTeamDay).toHaveBeenLastCalledWith('2026-10-27');
  });

  it('seed applies the bootstrap only while today is shown', () => {
    const { store, getTeamDay } = setup();

    store.seed(scheduleResponse([]));
    expect(getTeamDay).not.toHaveBeenCalled();
    expect(store.data()).not.toBeNull();

    store.load('2026-10-27');
    store.seed(scheduleResponse([]));
    expect(getTeamDay).toHaveBeenLastCalledWith('2026-10-27');
  });

  it('shiftDay walks back from today and returns to today, never past it', () => {
    const { store, getTeamDay } = setup();

    store.load();
    expect(store.today()).toBe('2026-10-29');
    store.shiftDay(-1);
    expect(getTeamDay).toHaveBeenLastCalledWith('2026-10-28');
    store.shiftDay(-1);
    expect(getTeamDay).toHaveBeenLastCalledWith('2026-10-27');
    store.shiftDay(1);
    store.shiftDay(1);
    expect(getTeamDay).toHaveBeenLastCalledWith(null);
    expect(store.date()).toBeNull();
    store.shiftDay(1);
    expect(getTeamDay).toHaveBeenLastCalledWith(null);
  });

  it('keeps an error message on failure', () => {
    const { store } = setup(true);

    store.load();
    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });
});
