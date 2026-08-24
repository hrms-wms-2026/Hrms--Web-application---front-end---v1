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
      getMyAllocationRequests: () => of([{
        id: 'a1', objectiveId: 'obj-1', requestType: 'extend_allocation' as const, status: 'pending' as const,
        payload: { requestedAdditionalHours: 8, reason: 'Need more' },
        createdAt: '2026-08-17T00:00:00Z'
      }]),
      getMyObjectiveChangeRequests: () => of([{
        id: 'c1', objectiveId: 'obj-1', requestType: 'edit_fields', requestedById: 'e1',
        reportingManagerId: 'e2', status: 'pending' as const, payloadJson: null,
        decidedAt: null, decidedById: null, createdAt: '2026-08-17T00:00:00Z'
      }]),
      getMyObjectiveInvitations: () => of([{
        id: 'i1', projectId: 'p1', objectiveId: 'obj-1', invitedEmployeeId: 'e3',
        inviteType: 'member' as const, status: 'pending' as const, invitedById: 'e1',
        decidedAt: null, createdAt: '2026-08-17T00:00:00Z'
      }]),
      approveTaskCreationRequest: () => of({}),
      rejectTaskCreationRequest: () => of(undefined),
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

  it('loadAll populates all four approval lists', async () => {
    const store = setup();
    await store.loadAll();

    expect(store.taskCreationRequests().length).toBe(1);
    expect(store.allocationRequests().length).toBe(1);
    expect(store.objectiveChangeRequests().length).toBe(1);
    expect(store.objectiveInvitations().length).toBe(1);
    expect(store.pendingCount()).toBe(4);
  });

  it('approve removes the item from the matching list', async () => {
    const store = setup();
    await store.loadAll();
    const item = store.taskCreationRequests()[0];

    await store.approve(item);

    expect(store.taskCreationRequests().length).toBe(0);
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
});
