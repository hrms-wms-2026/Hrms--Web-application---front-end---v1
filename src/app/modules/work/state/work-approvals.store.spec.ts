import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WorkApprovalsStore } from './work-approvals.store';
import { WorkApprovalsApiService } from '../data-access/work-approvals-api.service';
import { WorkApprovalRequestDto } from '../models/dto/work-approval.dto';

function workApproval(overrides: Partial<WorkApprovalRequestDto> = {}): WorkApprovalRequestDto {
  return {
    id: 'w1', projectId: 'p1', actionType: 'task.edit', targetType: 'task', targetId: 'task-1',
    targetTitle: 'Update estimate', status: 'pending', requestedByEmployeeId: 'e1', requestedByName: 'Abitha Devendran',
    approverEmployeeId: 'e2', approverName: 'Owner', payloadJson: '{}', decisionComment: null,
    createdAt: '2026-08-17T00:00:00Z', decidedAt: null, ...overrides
  };
}

/** The engine inbox for one project: a task request plus the three module-request kinds. */
function projectInbox(): WorkApprovalRequestDto[] {
  return [
    workApproval(),
    workApproval({
      id: 'a1', actionType: 'module.allocation_extend', targetType: 'module', targetId: 'obj-1', targetTitle: 'Payments',
      payloadJson: JSON.stringify({ requestedAdditionalHours: 8, reason: 'Need more' })
    }),
    workApproval({ id: 'c1', actionType: 'module.achieve', targetType: 'module', targetId: 'obj-1', targetTitle: 'Payments' }),
    workApproval({
      id: 'e1', actionType: 'module.edit', targetType: 'module', targetId: 'obj-1', targetTitle: 'Payments',
      payloadJson: JSON.stringify({ title: 'New Title', description: null, startDate: '2026-01-10', endDate: '2026-02-10', allocatedHours: 15 })
    })
  ];
}

describe('WorkApprovalsStore', () => {
  function setup(apiOverrides: Partial<WorkApprovalsApiService> = {}) {
    const api = {
      getProjectApprovals: vi.fn().mockReturnValue(of(projectInbox())),
      getMyObjectiveInvitations: () => of([{
        id: 'i1', projectId: 'p1', objectiveId: 'obj-1', invitedEmployeeId: 'e3',
        inviteType: 'member' as const, status: 'pending' as const, invitedById: 'e1',
        decidedAt: null, createdAt: '2026-08-17T00:00:00Z'
      }]),
      approveWorkApproval: vi.fn().mockReturnValue(of(workApproval({ status: 'approved' }))),
      rejectWorkApproval: vi.fn().mockReturnValue(of(workApproval({ status: 'rejected' }))),
      acceptObjectiveInvitation: () => of(undefined),
      rejectObjectiveInvitation: () => of(undefined),
      ...apiOverrides
    };

    TestBed.configureTestingModule({
      providers: [WorkApprovalsStore, { provide: WorkApprovalsApiService, useValue: api }]
    });
    return TestBed.inject(WorkApprovalsStore);
  }

  it('loadAll(projectId) loads the project inbox once and splits it by kind', async () => {
    const getProjectApprovals = vi.fn().mockReturnValue(of(projectInbox()));
    const store = setup({ getProjectApprovals });
    await store.loadAll('p1');

    expect(getProjectApprovals).toHaveBeenCalledTimes(1);
    expect(getProjectApprovals).toHaveBeenCalledWith('p1', 'inbox');
    expect(store.workApprovals().map((i) => i.id)).toEqual(['w1']);
    expect(store.allocationRequests().map((i) => i.id)).toEqual(['a1']);
    expect(store.objectiveChangeRequests().map((i) => i.id)).toEqual(['c1', 'e1']);
    expect(store.objectiveInvitations().length).toBe(1);
    expect(store.pendingCount()).toBe(5);
  });

  it('loadAll(projectId) leaves project.status_template_change items out of workApprovals', async () => {
    const getProjectApprovals = vi.fn().mockReturnValue(of([
      workApproval(),
      workApproval({ id: 'st1', actionType: 'project.status_template_change', targetType: 'project', targetId: null })
    ]));
    const store = setup({ getProjectApprovals });
    await store.loadAll('p1');

    expect(store.workApprovals().map((i) => i.id)).toEqual(['w1']);
  });

  it('loadAll without a project leaves the engine lists empty and never calls the per-project inbox', async () => {
    const getProjectApprovals = vi.fn().mockReturnValue(of(projectInbox()));
    const store = setup({ getProjectApprovals });
    await store.loadAll();

    expect(getProjectApprovals).not.toHaveBeenCalled();
    expect(store.workApprovals().length).toBe(0);
    expect(store.allocationRequests().length).toBe(0);
    expect(store.objectiveChangeRequests().length).toBe(0);
  });

  it('approve(work_approval item) calls approveWorkApproval and removes it', async () => {
    const approveWorkApproval = vi.fn().mockReturnValue(of(workApproval({ status: 'approved' })));
    const store = setup({ approveWorkApproval });
    await store.loadAll('p1');

    await store.approve(store.workApprovals()[0]);

    expect(approveWorkApproval).toHaveBeenCalledWith('w1', undefined);
    expect(store.workApprovals().length).toBe(0);
  });

  it('reject(work_approval item, comment) calls rejectWorkApproval with the comment', async () => {
    const rejectWorkApproval = vi.fn().mockReturnValue(of(workApproval({ status: 'rejected' })));
    const store = setup({ rejectWorkApproval });
    await store.loadAll('p1');

    await store.reject(store.workApprovals()[0], 'Not now');

    expect(rejectWorkApproval).toHaveBeenCalledWith('w1', 'Not now');
    expect(store.workApprovals().length).toBe(0);
  });

  it('approve(allocation_extend engine item, 5) sends {"requestedAdditionalHours":5,"reason":<original>}', async () => {
    const approveWorkApproval = vi.fn().mockReturnValue(of(workApproval({ status: 'approved' })));
    const store = setup({ approveWorkApproval });
    await store.loadAll('p1');

    await store.approve(store.allocationRequests()[0], 5);

    expect(approveWorkApproval).toHaveBeenCalledWith('a1', JSON.stringify({ requestedAdditionalHours: 5, reason: 'Need more' }));
    expect(store.allocationRequests().length).toBe(0);
  });

  it('approve on an allocation request with insufficient approver slack surfaces the 409 message and keeps the item pending', async () => {
    const approveWorkApproval = vi.fn().mockReturnValue(
      throwError(() => ({ status: 409, error: { detail: "You don't have enough allocation yourself..." } }))
    );
    const store = setup({ approveWorkApproval });
    await store.loadAll('p1');

    await store.approve(store.allocationRequests()[0]);

    expect(store.error()).toContain("You don't have enough allocation yourself");
    expect(store.allocationRequests().length).toBe(1);
  });

  it('approve on an objective_edit item approves as-is when the approver made no changes', async () => {
    const approveWorkApproval = vi.fn().mockReturnValue(of(workApproval({ status: 'approved' })));
    const store = setup({ approveWorkApproval });
    await store.loadAll('p1');
    const item = store.objectiveChangeRequests().find((i) => i.kind === 'objective_edit')!;

    await store.approve(item);

    expect(approveWorkApproval).toHaveBeenCalledWith('e1', undefined);
    expect(store.objectiveChangeRequests().some((i) => i.id === 'e1')).toBe(false);
  });

  it('approve(objective_edit engine item, editPayload) calls approveWorkApproval(id, JSON.stringify(editPayload))', async () => {
    const approveWorkApproval = vi.fn().mockReturnValue(of(workApproval({ status: 'approved' })));
    const store = setup({ approveWorkApproval });
    await store.loadAll('p1');
    const item = store.objectiveChangeRequests().find((i) => i.kind === 'objective_edit')!;
    const approvedEdit = { title: 'Approver Title', description: null, startDate: '2026-01-12', endDate: '2026-02-05', allocatedHours: 10 };

    await store.approve(item, approvedEdit);

    expect(approveWorkApproval).toHaveBeenCalledWith('e1', JSON.stringify(approvedEdit));
  });

  it('reject(objective_change engine item) calls rejectWorkApproval', async () => {
    const rejectWorkApproval = vi.fn().mockReturnValue(of(workApproval({ status: 'rejected' })));
    const store = setup({ rejectWorkApproval });
    await store.loadAll('p1');
    const item = store.objectiveChangeRequests().find((i) => i.kind === 'objective_change')!;

    await store.reject(item, 'No');

    expect(rejectWorkApproval).toHaveBeenCalledWith('c1', 'No');
    expect(store.objectiveChangeRequests().some((i) => i.id === 'c1')).toBe(false);
  });
});
