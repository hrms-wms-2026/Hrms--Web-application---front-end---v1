import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WorkApprovalsComponent } from './work-approvals.component';
import { WorkApprovalsStore } from '../../state/work-approvals.store';
import { WorkApprovalsApiService } from '../../data-access/work-approvals-api.service';
import { ProjectApiService } from '../../data-access/project-api.service';
import { ApprovalItem } from '../../models/approval.model';
import { AllocationRequestDto } from '../../models/dto/allocation-request.dto';

describe('WorkApprovalsComponent', () => {
  let fixture: ComponentFixture<WorkApprovalsComponent>;
  let storeStub: any;
  let approvalsApi: any;
  let projectApi: any;

  function setup(createAllocationRequest = vi.fn().mockReturnValue(of({}))): void {
    storeStub = {
      loadAll: vi.fn().mockResolvedValue(undefined),
      loading: () => false,
      error: () => null,
      pendingCount: () => 0,
      taskCreationRequests: () => [],
      allocationRequests: () => [],
      objectiveChangeRequests: () => [],
      objectiveInvitations: () => [],
      approve: vi.fn().mockResolvedValue(true),
      reject: vi.fn().mockResolvedValue(true)
    };
    approvalsApi = { createAllocationRequest };
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
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (key: string) => key === 'id' ? 'project-1' : null } }, parent: null }
        }
      ]
    });
    fixture = TestBed.createComponent(WorkApprovalsComponent);
    fixture.detectChanges();
  }

  it('loads all approvals and the current project modules on init', async () => {
    setup();
    await fixture.whenStable();

    expect(storeStub.loadAll).toHaveBeenCalledTimes(1);
    expect(projectApi.getMyMilestones).toHaveBeenCalledWith('project-1');
  });

  it('opens the Create Approval modal with the loaded module options', async () => {
    setup();
    await fixture.whenStable();
    fixture.componentInstance.openCreateApproval();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="create-approval-modal"]')).not.toBeNull();
    const options = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="create-approval-modal"] select option'))
      .map((option: any) => option.textContent?.trim());
    expect(options).toEqual(['Select a module', 'Module One', 'Module Two']);
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
    expect(storeStub.loadAll).toHaveBeenCalledTimes(2);
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
      title: '+20h requested',
      description: 'Need more',
      requestedByName: null,
      createdAt: '2026-08-27T00:00:00Z',
      raw: {
        id: 'allocation-1', objectiveId: 'obj-1', requestType: 'extend_allocation', status: 'pending',
        payload: { requestedAdditionalHours: 20, reason: 'Need more' }, createdAt: '2026-08-27T00:00:00Z'
      } satisfies AllocationRequestDto
    };

    fixture.componentInstance.onRequestOwnAllocation(item);
    fixture.detectChanges();

    expect((fixture.componentInstance as any).createOpen()).toBe(true);
    expect((fixture.componentInstance as any).createModuleId()).toBe('obj-1');
  });
});
