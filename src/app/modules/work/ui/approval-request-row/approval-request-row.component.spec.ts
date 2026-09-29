import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { ApprovalRequestRowComponent } from './approval-request-row.component';
import { ApprovalItem } from '../../models/approval.model';
import { AllocationRequestDto, ObjectiveEditRequestDto } from '../../models/dto/allocation-request.dto';
import { WorkApprovalRequestDto } from '../../models/dto/work-approval.dto';

function allocationItem(requestedAdditionalHours = 20): ApprovalItem {
  const raw: AllocationRequestDto = {
    id: 'allocation-1',
    objectiveId: 'objective-1',
    requestType: 'extend_allocation',
    status: 'pending',
    payload: { requestedAdditionalHours, reason: 'Need more capacity' },
    createdAt: '2026-08-27T00:00:00Z'
  };
  return {
    id: raw.id,
    kind: 'allocation_extend',
    objectiveId: raw.objectiveId,
    title: `+${requestedAdditionalHours}h requested`,
    description: raw.payload.reason,
    requestedByName: 'Nimal Perera',
    targetTitle: 'Hardware integration',
    targetType: 'module',
    targetId: raw.objectiveId,
    currentAllocatedHours: 24,
    createdAt: raw.createdAt,
    raw
  };
}

function objectiveEditItem(): ApprovalItem {
  const raw: ObjectiveEditRequestDto = {
    id: 'edit-1',
    objectiveId: 'objective-1',
    requestType: 'edit',
    status: 'pending',
    payload: { title: 'Requested Title', description: 'Requested desc', startDate: '2026-01-10', endDate: '2026-02-10', allocatedHours: 15 },
    createdAt: '2026-08-27T00:00:00Z'
  };
  return {
    id: raw.id,
    kind: 'objective_edit',
    objectiveId: raw.objectiveId,
    title: `Edit: ${raw.payload.title}`,
    description: `Objective ${raw.objectiveId}`,
    requestedByName: null,
    createdAt: raw.createdAt,
    raw
  };
}

function taskEditItem(): ApprovalItem {
  const raw: WorkApprovalRequestDto = {
    id: 'edit-req-1',
    projectId: 'project-1',
    actionType: 'task.edit',
    targetType: 'task',
    targetId: 'task-1',
    targetTitle: 'Portal Dashboard And Monitoring — Kickoff',
    status: 'pending',
    requestedByEmployeeId: 'employee-1',
    requestedByName: 'Abitha Devendran',
    approverEmployeeId: 'employee-2',
    approverName: 'Owner',
    payloadJson: '{"Title":"Portal Dashboard And Monitoring — Kickoff","EstimatedHours":75}',
    decisionComment: null,
    createdAt: '2026-09-18T00:00:00Z',
    decidedAt: null
  };
  return {
    id: raw.id,
    kind: 'work_approval',
    objectiveId: '',
    title: `Edit task: ${raw.targetTitle}`,
    description: '',
    requestedByName: raw.requestedByName,
    targetTitle: raw.targetTitle,
    targetType: 'task',
    targetId: raw.targetId,
    createdAt: raw.createdAt,
    raw
  };
}

describe('ApprovalRequestRowComponent', () => {
  let fixture: ComponentFixture<ApprovalRequestRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ApprovalRequestRowComponent] }).compileComponents();
    fixture = TestBed.createComponent(ApprovalRequestRowComponent);
    fixture.componentRef.setInput('item', allocationItem());
    fixture.detectChanges();
  });

  it('renders an editable allocation-hours input initialized from the requested amount', () => {
    const input = fixture.nativeElement.querySelector('[data-testid="allocation-hours-input"]') as HTMLInputElement;

    expect(input).not.toBeNull();
    expect(input.value).toBe('20');
  });

  it('shows the requester, affected module, and allocation impact', () => {
    expect(fixture.nativeElement.textContent).toContain('Nimal Perera');
    expect(fixture.nativeElement.textContent).toContain('Hardware integration');
    expect(fixture.nativeElement.textContent).toContain('24h');
    expect(fixture.nativeElement.textContent).not.toContain('44h');
  });

  it('emits the edited allocation amount when approving', () => {
    const approved = vi.fn();
    fixture.componentInstance.approved.subscribe(approved);
    const input = fixture.nativeElement.querySelector('[data-testid="allocation-hours-input"]') as HTMLInputElement;
    input.value = '12';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('app-button[variant="primary"] button') as HTMLButtonElement).click();

    expect(approved).toHaveBeenCalledWith(12);
  });

  it('emits requestOwnAllocation from the existing inline action', () => {
    const requestOwnAllocation = vi.fn();
    fixture.componentRef.setInput('inlineError', 'Not enough allocation');
    fixture.componentInstance.requestOwnAllocation.subscribe(requestOwnAllocation);
    fixture.detectChanges();

    const action = fixture.debugElement.query(By.css('.approval-row__link')).nativeElement as HTMLButtonElement;
    action.click();

    expect(requestOwnAllocation).toHaveBeenCalledTimes(1);
  });

  describe('objective_edit', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('item', objectiveEditItem());
      fixture.detectChanges();
    });

    it('renders editable fields pre-filled from the requested payload', () => {
      const title = fixture.nativeElement.querySelector('[data-testid="edit-title-input"]') as HTMLInputElement;
      const description = fixture.nativeElement.querySelector('[data-testid="edit-description-input"]') as HTMLTextAreaElement;
      const startDate = fixture.nativeElement.querySelector('[data-testid="edit-start-date-input"]') as HTMLInputElement;
      const endDate = fixture.nativeElement.querySelector('[data-testid="edit-end-date-input"]') as HTMLInputElement;
      const hours = fixture.nativeElement.querySelector('[data-testid="edit-allocated-hours-input"]') as HTMLInputElement;

      expect(title.value).toBe('Requested Title');
      expect(description.value).toBe('Requested desc');
      expect(startDate.value).toBe('2026-01-10');
      expect(endDate.value).toBe('2026-02-10');
      expect(hours.value).toBe('15');
    });

    it('emits the approver-edited payload when approving after changing fields', () => {
      const approved = vi.fn();
      fixture.componentInstance.approved.subscribe(approved);

      const title = fixture.nativeElement.querySelector('[data-testid="edit-title-input"]') as HTMLInputElement;
      title.value = 'Approver Title';
      title.dispatchEvent(new Event('input'));
      const hours = fixture.nativeElement.querySelector('[data-testid="edit-allocated-hours-input"]') as HTMLInputElement;
      hours.value = '10';
      hours.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('app-button[variant="primary"] button') as HTMLButtonElement).click();

      expect(approved).toHaveBeenCalledWith({
        title: 'Approver Title', description: 'Requested desc', startDate: '2026-01-10', endDate: '2026-02-10', allocatedHours: 10
      });
    });

    it('emits the requested payload unchanged when approving without editing', () => {
      const approved = vi.fn();
      fixture.componentInstance.approved.subscribe(approved);

      (fixture.nativeElement.querySelector('app-button[variant="primary"] button') as HTMLButtonElement).click();

      expect(approved).toHaveBeenCalledWith({
        title: 'Requested Title', description: 'Requested desc', startDate: '2026-01-10', endDate: '2026-02-10', allocatedHours: 15
      });
    });
  });

  describe('work_approval (task edit)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('item', taskEditItem());
      fixture.detectChanges();
    });

    it('emits approved with no override on the first click', () => {
      const approved = vi.fn();
      fixture.componentInstance.approved.subscribe(approved);

      (fixture.nativeElement.querySelector('app-button[variant="primary"] button') as HTMLButtonElement).click();

      expect(approved).toHaveBeenCalledWith(undefined);
    });

    it('offers the task details action and emits the selected request', () => {
      const viewRequested = vi.fn();
      fixture.componentInstance.viewRequested.subscribe(viewRequested);

      (fixture.nativeElement.querySelector('[data-testid="view-approval-target"]') as HTMLButtonElement).click();

      expect(viewRequested).toHaveBeenCalledWith(expect.objectContaining({ targetId: 'task-1' }));
    });

    it('requires a comment before emitting rejected, as task requests always did', () => {
      const rejected = vi.fn();
      fixture.componentInstance.rejected.subscribe(rejected);
      const rejectButton = fixture.nativeElement.querySelector('app-button[variant="secondary"] button') as HTMLButtonElement;

      rejectButton.click();
      fixture.detectChanges();
      expect(rejected).not.toHaveBeenCalled();
      const comment = fixture.nativeElement.querySelector('.approval-row__comment') as HTMLTextAreaElement;
      expect(comment).not.toBeNull();

      rejectButton.click();
      expect(rejected).not.toHaveBeenCalled();

      comment.value = 'Estimate looks too high for this phase';
      comment.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      rejectButton.click();

      expect(rejected).toHaveBeenCalledWith('Estimate looks too high for this phase');
    });
  });
});
