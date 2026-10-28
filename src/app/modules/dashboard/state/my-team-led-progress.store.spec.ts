import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MyTeamLedProgressStore } from './my-team-led-progress.store';
import { MyTeamLedProgressApiService } from '../data-access/my-team-led-progress-api.service';
import { TeamProgressDetailApiService } from '../data-access/team-progress-detail-api.service';
import { LedWorkProgressResponse } from '../models/my-team-led-progress.model';
import { ledTime } from '../utils/team-progress-time.testing';

const getTimeProgress = vi.fn((period: 'week' | 'month') => of(ledTime({ period })));
const detailApi = { provide: TeamProgressDetailApiService, useValue: { getTimeProgress } };

describe('MyTeamLedProgressStore', () => {
  const sampleResponse: LedWorkProgressResponse = {
    hours: { allocatedHours: 0, completedHours: 0, inProgressHours: 0, notStartedHours: 0, untaskedHours: 0, overTaskedHours: 0, taskCount: 0, unestimatedTaskCount: 0 }, modulesAtRisk: 0,
    projects: [],
    overdueTasks: [],
    overdueTotal: 0
  };

  function setup() {
    const getLedProgress = vi.fn().mockReturnValue(of(sampleResponse));
    TestBed.configureTestingModule({
      providers: [MyTeamLedProgressStore, { provide: MyTeamLedProgressApiService, useValue: { getLedProgress } }, detailApi]
    });
    return { store: TestBed.inject(MyTeamLedProgressStore), getLedProgress };
  }

  it('starts with no data', () => {
    const { store } = setup();
    expect(store.data()).toBeNull();
  });

  it('load populates data', async () => {
    const { store } = setup();
    await store.load();
    expect(store.data()).toEqual(sampleResponse);
  });

  it('load sets an error on failure', async () => {
    const getLedProgress = vi.fn().mockReturnValue(throwError(() => ({ error: { detail: 'boom' } })));
    TestBed.configureTestingModule({
      providers: [MyTeamLedProgressStore, { provide: MyTeamLedProgressApiService, useValue: { getLedProgress } }, detailApi]
    });
    const store = TestBed.inject(MyTeamLedProgressStore);
    await store.load();
    expect(store.error()).toBe('boom');
  });

  it('loadTime starts on the week and keeps time figures apart from the allocation data', async () => {
    const { store } = setup();
    await store.load();

    store.loadTime('week');
    expect(store.timePeriod()).toBe('week');
    expect(store.time()!.period).toBe('week');

    store.loadTime('month');
    expect(getTimeProgress).toHaveBeenLastCalledWith('month');
    expect(store.time()!.period).toBe('month');
    expect(store.data()).toEqual(sampleResponse);
  });

  it('a failed time load flags timeError and leaves the allocation data alone', async () => {
    const { store } = setup();
    await store.load();
    getTimeProgress.mockReturnValueOnce(throwError(() => new Error('x')));

    store.loadTime('week');
    expect(store.timeError()).toBe(true);
    expect(store.error()).toBeNull();
  });
});
