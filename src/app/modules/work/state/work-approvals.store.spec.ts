import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WorkApprovalsStore } from './work-approvals.store';
import { WorkApprovalsApiService } from '../data-access/work-approvals-api.service';

describe('WorkApprovalsStore', () => {
  function setup(apiOverrides: Partial<WorkApprovalsApiService> = {}) {
    const api = {
      getMyTaskCreationRequests: () => of([{
        id: 't1', objectiveId: 'obj-1', status: 'pending',
        payload: {
          title: 'Build login', description: null, categoryId: 'task', priority: 'medium',
          dueDate: null, estimatedHours: 5, storyPoints: null
        },
        createdAt: '2026-08-17T00:00:00Z'
      }]),
      getMyTaskEditRequests: () => of([{
        id: 'te1', taskId: 'task-1', objectiveId: 'obj-1', status: 'pending' as const,
        payload: {
          title: 'Update estimate', description: null, priority: 'medium',
          dueDate: null, estimatedHours: 8, storyPoints: null
        },
        requestedByName: 'Abitha Devendran', createdAt: '2026-08-17T00:00:00Z'
      }]),
      getMyAllocationRequests: () => of([{
        id: 'a1', objectiveId: 'obj-1', requestType: 'extend_allocation' as const, status: 'pending' as const,
        payload: { requestedAdditionalHours: 8, reason: 'Need more' },
        createdAt: '2026-08-17T00:00:00Z'
      }]),
      getMyObjectiveChangeRequests: () => of([{
        id: 'c1', objectiveId: 'obj-1', requestType: 'edit_fields', requestedById: 'e1',
        reportingManagerId: 'e2', status: 'pending' as const, payloadJson: null,
        decidedAt: null, decidedById: null, createdAt: '2026-08-17T00:00:00Z'
      }, {
        id: 'e1', objectiveId: 'obj-1', requestType: 'edit', requestedById: 'e1',
        reportingManagerId: 'e2', status: 'pending' as const,
        payloadJson: JSON.stringify({ title: 'New Title', description: null, startDate: '2026-01-10', endDate: '2026-02-10', allocatedHours: 15 }),
        decidedAt: null, decidedById: null, createdAt: '2026-08-17T00:00:00Z'
      }]),
      getMyObjectiveInvitations: () => of([{
        id: 'i1', projectId: 'p1', objectiveId: 'obj-1', invitedEmployeeId: 'e3',
        inviteType: 'member' as const, status: 'pending' as const, invitedById: 'e1',
        decidedAt: null, createdAt: '2026-08-17T00:00:00Z'
      }]),
      approveTaskCreationRequest: () => of({}),
      rejectTaskCreationRequest: () => of(undefined),
      approveTaskEditRequest: () => of({}),
      rejectTaskEditRequest: () => of(undefined),
      approveAllocationRequest: () => of(undefined),
      rejectAllocationRequest: () => of(undefined),
      approveObjectiveChangeRequest: () => of(undefined),
      rejectObjectiveChangeRequest: () => of(undefined),
      acceptObjectiveInvitation: () => of(undefined),
      rejectObjectiveInvitation: () => of(undefined),
      ...apiOverrides
    };

    TestBed.configureTestingModule({
      providers: [WorkApprovalsStore, { provide: WorkApprovalsApiService, useValue: api }]
    });
    return TestBed.inject(WorkApprovalsStore);
  }

  it('loadAll populates all five approval lists', async () => {
    const store = setup();
    await store.loadAll();

    expect(store.taskCreationRequests().length).toBe(1);
    expect(store.taskEditRequests().length).toBe(1);
    expect(store.allocationRequests().length).toBe(1);
    expect(store.objectiveChangeRequests().length).toBe(2);
    expect(store.objectiveInvitations().length).toBe(1);
    expect(store.pendingCount()).toBe(6);
  });

  it('approve on a task_edit item routes through the task-edit-request approve endpoint', async () => {
    const approveTaskEditRequest = vi.fn().mockReturnValue(of({}));
    const store = setup({ approveTaskEditRequest });
    await store.loadAll();
    const item = store.taskEditRequests()[0];

    await store.approve(item);

    expect(approveTaskEditRequest).toHaveBeenCalledWith('te1');
    expect(store.taskEditRequests().length).toBe(0);
  });

  it('reject on a task_edit item routes through the task-edit-request reject endpoint with the comment', async () => {
    const rejectTaskEditRequest = vi.fn().mockReturnValue(of(undefined));
    const store = setup({ rejectTaskEditRequest });
    await store.loadAll();
    const item = store.taskEditRequests()[0];

    await store.reject(item, 'Not now');

    expect(rejectTaskEditRequest).toHaveBeenCalledWith('te1', 'Not now');
    expect(store.taskEditRequests().length).toBe(0);
  });

  it('approve removes the item from the matching list', async () => {
    const store = setup();
    await store.loadAll();
    const item = store.taskCreationRequests()[0];

    await store.approve(item);

    expect(store.taskCreationRequests().length).toBe(0);
  });

    it('approve passes the edited additional hours for an allocation request', async () => {
    const approveAllocationRequest = vi.fn().mockReturnValue(of(undefined));
    const store = setup({ approveAllocationRequest });
    await store.loadAll();
    const item = store.allocationRequests()[0];

    await store.approve(item, 12);

    expect(approveAllocationRequest).toHaveBeenCalledWith('a1', 12);
    expect(store.allocationRequests().length).toBe(0);
  });

  it('approve on an allocation request with insufficient approver slack surfaces the 409 message and keeps the item pending', async () => {

    const approveAllocationRequest = vi.fn().mockReturnValue(
      throwError(() => ({ status: 409, error: { detail: "You don't have enough allocation yourself..." } }))
    );
    const store = setup({ approveAllocationRequest });
    await store.loadAll();
    const item = store.allocationRequests()[0];

    await store.approve(item);

    expect(store.error()).toContain("You don't have enough allocation yourself");
    expect(store.allocationRequests().length).toBe(1);
  });

  it('approve on an objective_edit item approves as-is when the approver made no changes', async () => {
    const approveObjectiveChangeRequest = vi.fn().mockReturnValue(of(undefined));
    const store = setup({ approveObjectiveChangeRequest });
    await store.loadAll();
    const item = store.objectiveChangeRequests().find((i) => i.kind === 'objective_edit')!;

    await store.approve(item);

    expect(approveObjectiveChangeRequest).toHaveBeenCalledWith('e1', undefined);
    expect(store.objectiveChangeRequests().some((i) => i.id === 'e1')).toBe(false);
  });

  it('approve on an objective_edit item passes the approver-edited fields when provided', async () => {
    const approveObjectiveChangeRequest = vi.fn().mockReturnValue(of(undefined));
    const store = setup({ approveObjectiveChangeRequest });
    await store.loadAll();
    const item = store.objectiveChangeRequests().find((i) => i.kind === 'objective_edit')!;
    const approvedEdit = { title: 'Approver Title', description: null, startDate: '2026-01-12', endDate: '2026-02-05', allocatedHours: 10 };

    await store.approve(item, approvedEdit);

    expect(approveObjectiveChangeRequest).toHaveBeenCalledWith('e1', approvedEdit);
  });

  it('reject on an objective_edit item routes through the change-request reject endpoint', async () => {
    const rejectObjectiveChangeRequest = vi.fn().mockReturnValue(of(undefined));
    const store = setup({ rejectObjectiveChangeRequest });
    await store.loadAll();
    const item = store.objectiveChangeRequests().find((i) => i.kind === 'objective_edit')!;

    await store.reject(item);

    expect(rejectObjectiveChangeRequest).toHaveBeenCalledWith('e1');
    expect(store.objectiveChangeRequests().some((i) => i.id === 'e1')).toBe(false);
  });
});
