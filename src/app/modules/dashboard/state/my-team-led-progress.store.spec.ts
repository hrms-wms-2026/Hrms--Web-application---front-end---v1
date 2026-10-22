import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MyTeamLedProgressStore } from './my-team-led-progress.store';
import { MyTeamLedProgressApiService } from '../data-access/my-team-led-progress-api.service';
import { LedWorkProgressResponse } from '../models/my-team-led-progress.model';

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
      providers: [MyTeamLedProgressStore, { provide: MyTeamLedProgressApiService, useValue: { getLedProgress } }]
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
      providers: [MyTeamLedProgressStore, { provide: MyTeamLedProgressApiService, useValue: { getLedProgress } }]
    });
    const store = TestBed.inject(MyTeamLedProgressStore);
    await store.load();
    expect(store.error()).toBe('boom');
  });
});
