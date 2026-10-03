import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WorkApprovalsComponent } from './work-approvals.component';
import { WorkDropdownComponent } from '../../ui/work-dropdown/work-dropdown.component';
import { WorkApprovalsStore } from '../../state/work-approvals.store';
import { WorkApprovalsApiService } from '../../data-access/work-approvals-api.service';
import { ProjectApiService } from '../../data-access/project-api.service';
import { TaskStatusChangeRequestApiService } from '../../data-access/task-status-change-request-api.service';
import { ApprovalItem } from '../../models/approval.model';
import { WorkApprovalRequestDto } from '../../models/dto/work-approval.dto';

function engineRaw(overrides: Partial<WorkApprovalRequestDto> = {}): WorkApprovalRequestDto {
  return {
    id: 'r1', projectId: 'project-1', actionType: 'module.allocation_extend', targetType: 'module', targetId: 'obj-1',
    targetTitle: 'Module One', status: 'pending', requestedByEmployeeId: 'e1', requestedByName: 'Sam Lee',
    approverEmployeeId: 'e2', approverName: 'Owner', payloadJson: '{}', decisionComment: null,
    createdAt: '2026-09-28T00:00:00Z', decidedAt: null, ...overrides
  };
}

describe('WorkApprovalsComponent', () => {
  let fixture: ComponentFixture<WorkApprovalsComponent>;
  let storeStub: any;
  let approvalsApi: any;
  let projectApi: any;

  function setup(
    createAllocationRequest = vi.fn().mockReturnValue(of({})),
    getApprovalHistory = vi.fn().mockReturnValue(of([])),
    workApprovals: ApprovalItem[] = [],
    allocationRequests: ApprovalItem[] = [],
    objectiveChangeRequests: ApprovalItem[] = [],
    objectiveInvitations: ApprovalItem[] = []
  ): void {
    storeStub = {
      loadAll: vi.fn().mockResolvedValue(undefined),
      loading: () => false,
      error: () => null,
      pendingCount: () => 0,
      workApprovals: () => workApprovals,
      allocationRequests: () => allocationRequests,
      objectiveChangeRequests: () => objectiveChangeRequests,
      objectiveInvitations: () => objectiveInvitations,
      approve: vi.fn().mockResolvedValue(true),
      reject: vi.fn().mockResolvedValue(true)
    };
    approvalsApi = { createAllocationRequest, getApprovalHistory };
    projectApi = {
      getMyMilestones: vi.fn().mockReturnValue(of([
        { objectiveId: 'obj-1', title: 'Module One', isOwner: true },
        { objectiveId: 'obj-2', title: 'Module Two', isOwner: false }
      ]))
    };

    TestBed.configureTestingModule({
      imports: [WorkApprovalsComponent],
      providers: [
        { provide: WorkApprovalsStore, useValue: storeStub },
        { provide: WorkApprovalsApiService, useValue: approvalsApi },
        { provide: ProjectApiService, useValue: projectApi },
        {
          provide: TaskStatusChangeRequestApiService,
          useValue: { getForProject: vi.fn().mockReturnValue(of({ canEditDirectly: false, canRequest: false, requests: [] })) }
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (key: string) => key === 'id' ? 'project-1' : null } }, parent: null }
        }
      ]
    });
    fixture = TestBed.createComponent(WorkApprovalsComponent);
    fixture.detectChanges();
  }

  it('renders one Task Requests section from workApprovals; no Task Creation/Task Edit sections', async () => {
    const item: ApprovalItem = {
      id: 'w1', kind: 'work_approval', objectiveId: '', title: 'Edit task: Fix login', description: '',
      requestedByName: 'Sam Lee', targetTitle: 'Fix login', targetType: 'task', targetId: 't-1',
      createdAt: '2026-09-28T00:00:00Z',
      raw: {
        id: 'w1', projectId: 'project-1', actionType: 'task.edit', targetType: 'task', targetId: 't-1',
        targetTitle: 'Fix login', status: 'pending', requestedByEmployeeId: 'e1', requestedByName: 'Sam Lee',
        approverEmployeeId: 'e2', approverName: 'Owner', payloadJson: '{}', decisionComment: null,
        createdAt: '2026-09-28T00:00:00Z', decidedAt: null
      }
    };
    setup(undefined, undefined, [item]);
    await fixture.whenStable();
    fixture.detectChanges();

    const headings = Array.from(fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>)
      .map((h) => h.textContent?.trim() ?? '');
    expect(headings.some((h) => h.startsWith('Task Requests') && h.includes('1'))).toBe(true);
    expect(headings.some((h) => h.includes('Task Creation') || h.includes('Task Edit'))).toBe(false);
  }, 15000); // this component renders slowly when the whole suite runs in parallel

  it('shows an invitation to a module the invitee is not a member of yet, and hides other projects\' invitations', async () => {
    const invitation = (id: string, projectId: string, objectiveId: string): ApprovalItem => ({
      id, kind: 'objective_invitation', objectiveId, title: 'Invited as member', description: '',
      requestedByName: null, targetType: 'module', targetId: objectiveId, createdAt: '2026-09-28T00:00:00Z',
      raw: {
        id, projectId, objectiveId, invitedEmployeeId: 'me', inviteType: 'member', status: 'pending',
        invitedById: 'e2', decidedAt: null, createdAt: '2026-09-28T00:00:00Z'
      }
    });
    // obj-9 is not in getMyMilestones: the invitee only becomes a member after accepting.
    setup(undefined, undefined, [], [], [], [
      invitation('inv-1', 'project-1', 'obj-9'),
      invitation('inv-2', 'other-project', 'obj-7')
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const headings = Array.from(fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>)
      .map((h) => h.textContent?.trim() ?? '');
    const invitationHeading = headings.find((h) => h.startsWith('Objective Invitations'));
    expect(invitationHeading).toBeDefined();
    expect(invitationHeading).toContain('1');
    expect(fixture.nativeElement.querySelector('[data-testid="approvals-empty-state"]')).toBeNull();
  }, 15000);

  it('uses the approval queue loaded by the project shell and loads current project modules', async () => {
    setup();
    await fixture.whenStable();

    expect(storeStub.loadAll).not.toHaveBeenCalled();
    expect(projectApi.getMyMilestones).toHaveBeenCalledWith('project-1');
  });

  it('opens the Create Approval modal with the loaded module options', async () => {
    setup();
    await fixture.whenStable();
    fixture.componentInstance.openCreateApproval();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="create-approval-modal"]')).not.toBeNull();
    const dropdown = fixture.debugElement.query(By.directive(WorkDropdownComponent)).componentInstance as WorkDropdownComponent;
    expect(dropdown.options().map((option) => option.label)).toEqual(['Module One', 'Module Two']);
    const trigger = fixture.nativeElement.querySelector('[data-testid="create-approval-modal"] .work-dropdown__trigger');
    expect(trigger.textContent).toContain('Select a module');
  });

  it('shows Requests and History tabs; History lists this project\'s approval history inline', async () => {
    setup();
    await fixture.whenStable();
    fixture.detectChanges();

    const tabs = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>);
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Requests', 'History']);
    expect(fixture.nativeElement.querySelector('[data-testid="approval-history-list"]')).toBeNull();

    tabs[1].click();
    fixture.detectChanges();

    // History reuses the list already loaded for "My Pending Requests" - no second request.
    expect(fixture.nativeElement.querySelector('[data-testid="approval-history-list"]')).not.toBeNull();
    expect(approvalsApi.getApprovalHistory).toHaveBeenCalledTimes(1);
    expect(approvalsApi.getApprovalHistory).toHaveBeenCalledWith('project-1');
  }, 15000);

  it('lists sprint requests in their own Sprint Requests section, not under Task Requests', async () => {
    const sprintItem: ApprovalItem = {
      id: 's1', kind: 'work_approval', objectiveId: '', title: 'Start sprint: Sprint 4', description: 'Start sprint',
      requestedByName: 'Sam Lee', targetTitle: 'Sprint 4', targetType: 'request', targetId: 'sp-4',
      createdAt: '2026-09-28T00:00:00Z',
      raw: engineRaw({ id: 's1', actionType: 'sprint.start', targetType: 'sprint', targetId: 'sp-4', targetTitle: 'Sprint 4' })
    };
    setup(undefined, undefined, [sprintItem]);
    await fixture.whenStable();
    fixture.detectChanges();

    const headings = Array.from(fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>)
      .map((h) => h.textContent?.trim() ?? '');
    expect(headings.some((h) => h.startsWith('Sprint Requests') && h.includes('1'))).toBe(true);
    expect(headings.some((h) => h.startsWith('Task Requests'))).toBe(false);
  }, 15000);

  it('shows requests sent by the user that are still awaiting approval on the main page', async () => {
    const getApprovalHistory = vi.fn().mockReturnValue(of([{
      id: 'allocation-1', objectiveId: 'obj-1', kind: 'allocation_extend', status: 'pending',
      direction: 'sent', subjectTitle: 'Module One', detail: '12 additional hours - Delivery work',
      requestedById: 'employee-1', requestedByName: 'Alex Silva', approverId: 'employee-2',
      approverName: 'Priya Nair', decidedById: null, decidedByName: null, decisionComment: null,
      createdAt: '2026-09-25T08:00:00Z', decidedAt: null
    }]));
    setup(vi.fn().mockReturnValue(of({})), getApprovalHistory);
    await fixture.whenStable();
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('[data-testid="sent-pending-request-allocation-1"]');
    expect(row).not.toBeNull();
    expect(row.textContent).toContain('Module One');
    expect(row.textContent).toContain('Priya Nair');
    expect(row.textContent).toContain('Pending');
    expect(fixture.nativeElement.querySelector('[data-testid="approvals-empty-state"]')).toBeNull();
  });

  it('submits a create allocation request and reloads approvals on success', async () => {
    setup();
    await fixture.whenStable();
    const component = fixture.componentInstance as any;
    component.openCreateApproval();
    component.createModuleId.set('obj-1');
    component.createHours.set('12');
    component.createReason.set('Need more delivery capacity');

    await component.submitCreateApproval();

    expect(approvalsApi.createAllocationRequest).toHaveBeenCalledWith('obj-1', {
      requestedAdditionalHours: 12,
      reason: 'Need more delivery capacity'
    });
    expect(storeStub.loadAll).toHaveBeenCalledWith('project-1');
    expect(component.createOpen()).toBe(false);
  });

  it('shows an alert when creating an allocation request fails', async () => {
    const create = vi.fn().mockReturnValue(
      throwError(() => ({ error: { detail: 'A change request is already pending.' } }))
    );
    setup(create);
    await fixture.whenStable();
    const component = fixture.componentInstance as any;
    component.openCreateApproval();
    component.createModuleId.set('obj-1');
    component.createHours.set('12');
    component.createReason.set('Need more delivery capacity');

    await component.submitCreateApproval();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('already pending');
  });

  it('prefills the same create modal from the request-more-allocation action', async () => {
    setup();
    await fixture.whenStable();
    const item: ApprovalItem = {
      id: 'allocation-1',
      kind: 'allocation_extend',
      objectiveId: 'obj-1',
      title: '+20h requested',
      description: 'Need more',
      requestedByName: null,
      createdAt: '2026-08-27T00:00:00Z',
      engine: true,
      raw: { ...engineRaw({ id: 'allocation-1' }), payload: { requestedAdditionalHours: 20, reason: 'Need more' } }
    };

    fixture.componentInstance.onRequestOwnAllocation(item);
    fixture.detectChanges();

    expect((fixture.componentInstance as any).createOpen()).toBe(true);
    expect((fixture.componentInstance as any).createModuleId()).toBe('obj-1');
  });
});

describe('WorkApprovalsComponent (module requests from the engine inbox)', () => {
  it('allocation and objective-change sections render from the store lists by kind, with no module scoping', async () => {
    const allocation: ApprovalItem = {
      id: 'a1', kind: 'allocation_extend', objectiveId: 'obj-9', title: '+8h requested', description: 'Need more',
      requestedByName: 'Sam Lee', targetTitle: 'Other Module', targetType: 'module', targetId: 'obj-9',
      createdAt: '2026-09-28T00:00:00Z', engine: true,
      raw: { ...engineRaw({ id: 'a1', targetId: 'obj-9' }), payload: { requestedAdditionalHours: 8, reason: 'Need more' } }
    };
    const achieve: ApprovalItem = {
      id: 'c1', kind: 'objective_change', objectiveId: 'obj-9', title: 'Achieve module: Other Module', description: 'Achieve module',
      requestedByName: 'Sam Lee', targetTitle: 'Other Module', targetType: 'module', targetId: 'obj-9',
      createdAt: '2026-09-28T00:00:00Z', engine: true,
      raw: engineRaw({ id: 'c1', actionType: 'module.achieve', targetId: 'obj-9' })
    };
    TestBed.configureTestingModule({
      imports: [WorkApprovalsComponent],
      providers: [
        {
          provide: WorkApprovalsStore,
          useValue: {
            loadAll: vi.fn().mockResolvedValue(undefined), loading: () => false, error: () => null, pendingCount: () => 2,
            workApprovals: () => [], allocationRequests: () => [allocation], objectiveChangeRequests: () => [achieve],
            objectiveInvitations: () => [], approve: vi.fn(), reject: vi.fn()
          }
        },
        { provide: WorkApprovalsApiService, useValue: { createAllocationRequest: vi.fn(), getApprovalHistory: vi.fn().mockReturnValue(of([])) } },
        // obj-9 is not in the caller's own milestone list: engine items must still show.
        { provide: ProjectApiService, useValue: { getMyMilestones: vi.fn().mockReturnValue(of([{ objectiveId: 'obj-1', title: 'Module One' }])) } },
        {
          provide: TaskStatusChangeRequestApiService,
          useValue: { getForProject: vi.fn().mockReturnValue(of({ canEditDirectly: false, canRequest: false, requests: [] })) }
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (key: string) => key === 'id' ? 'project-1' : null } }, parent: null }
        }
      ]
    });
    const fixture = TestBed.createComponent(WorkApprovalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const headings = Array.from(fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>)
      .map((h) => h.textContent?.trim() ?? '');
    expect(headings.some((h) => h.startsWith('Allocation Requests') && h.includes('1'))).toBe(true);
    expect(headings.some((h) => h.startsWith('Objective Change Requests') && h.includes('1'))).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Other Module');
    expect(fixture.nativeElement.textContent).toContain('Achieve module');
  }, 15000);
});
