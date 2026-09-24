import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SprintListStore } from './sprint-list.store';
import { SprintApiService } from '../data-access/sprint-api.service';
import { SprintDto } from '../models/dto/sprint.dto';

describe('SprintListStore', () => {
  const dto: SprintDto = {
    id: 's1', projectId: 'p-1', name: 'Sprint 1', goal: null,
    startDate: '2026-09-01', endDate: '2026-09-14', status: 'active',
    completedAt: null, achievedAt: null, canManage: true
  };

  function setup(apiOverrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
    const api = {
      getByProject: vi.fn().mockReturnValue(of([dto])),
      create: vi.fn(),
      setTasks: vi.fn(),
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

  it('loadForProject populates sprints from the API', async () => {
    const { store, api } = setup();
    await store.loadForProject('p-1');
    expect(api.getByProject).toHaveBeenCalledWith('p-1');
    expect(store.sprints().length).toBe(1);
  });

  it('create calls the API then reloads the project sprints', async () => {
    const { store, api } = setup({ create: vi.fn().mockReturnValue(of(dto)) });
    const ok = await store.create('p-1', { name: 'Sprint 1' });
    expect(ok).toBe(true);
    expect(api.create).toHaveBeenCalledWith('p-1', { name: 'Sprint 1' });
    expect(api.getByProject).toHaveBeenCalledWith('p-1');
  });

  it('setTasks calls the API then reloads the project sprints', async () => {
    const { store, api } = setup();
    api.setTasks.mockReturnValue(of(dto));
    api.getByProject.mockReturnValue(of([dto]));
    const ok = await store.setTasks('sp-1', { addTaskIds: ['t1'], removeTaskIds: [] }, 'p-1');
    expect(ok).toBe(true);
    expect(api.setTasks).toHaveBeenCalledWith('sp-1', { addTaskIds: ['t1'], removeTaskIds: [] });
    expect(api.getByProject).toHaveBeenCalledWith('p-1');
  });

  it('start re-fetches the project sprints after succeeding', async () => {
    const { store, api } = setup({ start: vi.fn().mockReturnValue(of(dto)) });
    await store.start('s1', { startDate: '2026-09-21', endDate: '2026-10-02' }, 'p-1');
    expect(api.getByProject).toHaveBeenCalledWith('p-1');
  });

  it('edit re-fetches the project sprints after succeeding', async () => {
    const { store, api } = setup({ edit: vi.fn().mockReturnValue(of(dto)) });
    const ok = await store.edit('s1', { name: 'Renamed', goal: null }, 'p-1');
    expect(ok).toBe(true);
    expect(api.getByProject).toHaveBeenCalledWith('p-1');
  });

  it('complete forwards the disposition payload and re-fetches on success', async () => {
    const { store, api } = setup({ complete: vi.fn().mockReturnValue(of(dto)) });
    await store.complete('s1', { disposition: 'backlog' }, 'p-1');
    expect(api.complete).toHaveBeenCalledWith('s1', { disposition: 'backlog' });
    expect(api.getByProject).toHaveBeenCalledWith('p-1');
  });

  it('achieve calls the API then reloads the project sprints', async () => {
    const { store, api } = setup({ achieve: vi.fn().mockReturnValue(of(dto)) });
    const ok = await store.achieve('s1', 'p-1');
    expect(ok).toBe(true);
    expect(api.achieve).toHaveBeenCalledWith('s1');
    expect(api.getByProject).toHaveBeenCalledWith('p-1');
  });
});
