import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SprintListStore } from './sprint-list.store';
import { SprintApiService } from '../data-access/sprint-api.service';
import { SprintDto } from '../models/dto/sprint.dto';

describe('SprintListStore', () => {
  const dto: SprintDto = {
    id: 's1', objectiveId: 'o1', name: 'Sprint 1', goal: null,
    startDate: '2026-09-01', endDate: '2026-09-14', status: 'active',
    completedAt: null, achievedAt: null
  };

  function setup(apiOverrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
    const api = {
      getByObjective: vi.fn().mockReturnValue(of([dto])),
      create: vi.fn(),
      start: vi.fn(),
      edit: vi.fn(),
      complete: vi.fn(),
      achieve: vi.fn(),
      ...apiOverrides
    };
    TestBed.configureTestingModule({
      providers: [SprintListStore, { provide: SprintApiService, useValue: api }]
    });
    return { store: TestBed.inject(SprintListStore), api };
  }

  it('load populates sprints from the API', async () => {
    const { store } = setup();
    await store.load('o1', false);
    expect(store.sprints().length).toBe(1);
    expect(store.sprints()[0].name).toBe('Sprint 1');
  });

  it('start re-fetches the list after succeeding', async () => {
    const { store, api } = setup({ start: vi.fn().mockReturnValue(of(dto)) });
    await store.load('o1', false);
    await store.start('s1', { startDate: '2026-09-21', endDate: '2026-10-02' }, 'o1', false);
    expect(api.getByObjective).toHaveBeenCalledTimes(2);
  });

  it('complete forwards the disposition payload and re-fetches on success', async () => {
    const { store, api } = setup({ complete: vi.fn().mockReturnValue(of(dto)) });
    await store.load('o1', false);
    await store.complete('s1', { disposition: 'backlog' }, 'o1', false);
    expect(api.complete).toHaveBeenCalledWith('s1', { disposition: 'backlog' });
    expect(api.getByObjective).toHaveBeenCalledTimes(2);
  });
});
