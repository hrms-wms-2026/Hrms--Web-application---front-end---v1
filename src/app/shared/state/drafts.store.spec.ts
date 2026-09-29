import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PermissionService } from '../../core/auth/state/permission.service';
import { PeopleApiService } from '../../modules/people/data-access/people-api.service';
import { TaskDraftApiService } from '../../modules/work/data-access/task-draft-api.service';
import { DraftsStore } from './drafts.store';

describe('DraftsStore', () => {
  const taskApi = { list: vi.fn(), remove: vi.fn() };
  const peopleApi = { listDrafts: vi.fn(), cancelDraft: vi.fn() };
  let hasEmployeesRead = true;
  let store: InstanceType<typeof DraftsStore>;

  beforeEach(() => {
    hasEmployeesRead = true;
    taskApi.list.mockReset();
    taskApi.remove.mockReset().mockReturnValue(of(undefined));
    peopleApi.listDrafts.mockReset();
    peopleApi.cancelDraft.mockReset().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        { provide: TaskDraftApiService, useValue: taskApi },
        { provide: PeopleApiService, useValue: peopleApi },
        { provide: PermissionService, useValue: { hasPermission: (p: string) => p !== 'employees:read' || hasEmployeesRead } }
      ]
    });
    store = TestBed.inject(DraftsStore);
  });

  it('merges task and employee drafts into labelled chips', async () => {
    taskApi.list.mockReturnValue(of([{ id: 't1', projectId: 'p1', title: '', updatedAt: '' }]));
    peopleApi.listDrafts.mockReturnValue(of({
      items: [
        { id: 'e1', displayName: 'Jane Doe', status: 'draft' },
        { id: 'e2', displayName: ' ', status: 'waiting_for_seat' }
      ],
      totalCount: 2, page: 1, pageSize: 50
    }));

    await store.load();

    expect(store.chips()).toEqual([
      { kind: 'task', id: 't1', label: 'Untitled task', badge: null, projectId: 'p1' },
      { kind: 'employee', id: 'e1', label: 'Jane Doe', badge: null, projectId: null },
      { kind: 'employee', id: 'e2', label: 'Untitled employee', badge: 'Waiting for seat', projectId: null }
    ]);
    expect(peopleApi.listDrafts).toHaveBeenCalledWith({ mine: true, page: 1, pageSize: 50 });
  });

  it('labels awaiting-approval drafts', async () => {
    taskApi.list.mockReturnValue(of([]));
    peopleApi.listDrafts.mockReturnValue(of({
      items: [{ id: 'e1', displayName: 'Jane', status: 'waiting_for_position_approval' }],
      totalCount: 1, page: 1, pageSize: 50
    }));
    await store.load();
    expect(store.chips()[0].badge).toBe('Awaiting approval');
  });

  it('still shows task drafts when the onboarding list fails, and skips it without employees:read', async () => {
    taskApi.list.mockReturnValue(of([{ id: 't1', projectId: 'p1', title: 'A', updatedAt: '' }]));
    peopleApi.listDrafts.mockReturnValue(throwError(() => new Error('403')));

    await store.load();
    expect(store.chips().map((c) => c.id)).toEqual(['t1']);

    hasEmployeesRead = false;
    peopleApi.listDrafts.mockClear();
    await store.load();
    expect(peopleApi.listDrafts).not.toHaveBeenCalled();
  });

  it('removeChip deletes through the right API and drops the chip', async () => {
    taskApi.list.mockReturnValue(of([{ id: 't1', projectId: 'p1', title: 'A', updatedAt: '' }]));
    peopleApi.listDrafts.mockReturnValue(of({ items: [{ id: 'e1', displayName: 'Jane', status: 'draft' }], totalCount: 1, page: 1, pageSize: 50 }));
    await store.load();

    expect(await store.removeChip(store.chips()[0])).toBe(true);
    expect(taskApi.remove).toHaveBeenCalledWith('t1');
    expect(await store.removeChip(store.chips()[0])).toBe(true);
    expect(peopleApi.cancelDraft).toHaveBeenCalledWith('e1');
    expect(store.chips()).toEqual([]);
  });

  it('removeChip keeps the chip and reports failure when the API rejects', async () => {
    taskApi.list.mockReturnValue(of([{ id: 't1', projectId: 'p1', title: 'A', updatedAt: '' }]));
    peopleApi.listDrafts.mockReturnValue(of({ items: [], totalCount: 0, page: 1, pageSize: 50 }));
    taskApi.remove.mockReturnValue(throwError(() => new Error('boom')));
    await store.load();

    expect(await store.removeChip(store.chips()[0])).toBe(false);
    expect(store.chips()).toHaveLength(1);
  });
});
