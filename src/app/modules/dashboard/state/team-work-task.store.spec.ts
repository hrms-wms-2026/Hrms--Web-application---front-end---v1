import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeamWorkTaskApiService } from '../data-access/team-work-task-api.service';
import { TeamWorkTaskQuery } from '../models/team-work-task.model';
import { workTaskResponse } from '../utils/team-work-task.testing';
import { TeamWorkTaskStore, shiftWorkTaskAnchor } from './team-work-task.store';

describe('TeamWorkTaskStore', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(get = vi.fn((_q: TeamWorkTaskQuery) => of(workTaskResponse()))) {
    TestBed.configureTestingModule({
      providers: [TeamWorkTaskStore, { provide: TeamWorkTaskApiService, useValue: { get } }],
    });
    return { store: TestBed.inject(TeamWorkTaskStore), get };
  }

  it('loads the selected period', () => {
    const { store, get } = setup();
    store.load();
    expect(get).toHaveBeenCalledWith({ period: 'week', anchor: null });
    expect(store.data()?.totals.utilization).toBe(50);
    expect(store.loadedAt()).not.toBeNull();
  });

  it('switching period from the current one anchors on today', () => {
    const { store, get } = setup();
    store.load();
    store.setPeriod('day');
    expect(get).toHaveBeenLastCalledWith({ period: 'day', anchor: '2026-10-28' });
  });

  it('shifts by a day, a week or a month', () => {
    expect(shiftWorkTaskAnchor('day', '2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftWorkTaskAnchor('week', '2026-10-26', 1)).toBe('2026-11-02');
    expect(shiftWorkTaskAnchor('month', '2026-10-01', -1)).toBe('2026-09-01');
    const { store, get } = setup();
    store.load();
    store.shift(-1);
    expect(get).toHaveBeenLastCalledWith({ period: 'week', anchor: '2026-10-19' });
  });

  it('keeps the error message', () => {
    const { store } = setup(vi.fn(() => throwError(() => ({ error: { detail: 'nope' } }))));
    store.load();
    expect(store.error()).toBe('nope');
    expect(store.loading()).toBe(false);
  });

  it('a seed for another period reloads the selected one', () => {
    const { store, get } = setup();
    store.load();
    store.setPeriod('month');
    get.mockClear();
    store.seed(workTaskResponse());
    expect(get).toHaveBeenCalledTimes(1);
  });
});
