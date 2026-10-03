import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApprovalHistoryItemDto } from '../../models/dto/approval-history.dto';
import { ApprovalHistoryListComponent } from './approval-history-list.component';

describe('ApprovalHistoryListComponent', () => {
  let fixture: ComponentFixture<ApprovalHistoryListComponent>;

  const items: ApprovalHistoryItemDto[] = [
    {
      id: 'sent-1', objectiveId: 'obj-1', kind: 'allocation_extend', status: 'pending', direction: 'sent',
      subjectTitle: 'Payments module', detail: '8 additional hours - Finish integration',
      requestedById: 'employee-1', requestedByName: 'Alex Silva', approverId: 'employee-2',
      approverName: 'Priya Nair', decidedById: null, decidedByName: null, decisionComment: null,
      createdAt: '2026-09-24T08:00:00Z', decidedAt: null
    },
    {
      id: 'received-1', objectiveId: 'obj-1', kind: 'task_creation', status: 'approved', direction: 'received',
      subjectTitle: 'Payments module', detail: 'Add audit events', requestedById: 'employee-3',
      requestedByName: 'Sam Lee', approverId: 'employee-1', approverName: 'Alex Silva',
      decidedById: 'employee-1', decidedByName: 'Alex Silva', decisionComment: null,
      createdAt: '2026-09-23T08:00:00Z', decidedAt: '2026-09-23T09:00:00Z'
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ApprovalHistoryListComponent] });
    fixture = TestBed.createComponent(ApprovalHistoryListComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
  });

  it('shows requester, approver, status, and decision actor', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Sam Lee');
    expect(text).toContain('Priya Nair');
    expect(text).toContain('Approved');
    expect(text).toContain('Action by Alex Silva');
    expect(text).toContain('Awaiting Priya Nair');
  });

  it('filters between approvals sent and received by the user', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.approval-history__filter')) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.includes('Sent'))!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="approval-history-sent-1"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="approval-history-received-1"]')).toBeNull();
  });
});
