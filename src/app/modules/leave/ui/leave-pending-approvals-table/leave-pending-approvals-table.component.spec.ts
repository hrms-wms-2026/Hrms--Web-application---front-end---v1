import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeavePendingApprovalListItemResponse } from '../../models/leave-approval.model';
import { LeavePendingApprovalsTableComponent } from './leave-pending-approvals-table.component';

describe('LeavePendingApprovalsTableComponent', () => {
  let fixture: ComponentFixture<LeavePendingApprovalsTableComponent>;

  const rows: LeavePendingApprovalListItemResponse[] = [
    { requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startDate: '2026-09-10', endDate: '2026-09-12', totalDays: 3, paidDays: 3, unpaidDays: 0, status: 'pending', submittedAt: '2026-08-25T00:00:00Z' },
    { requestId: 'req-2', employeeId: 'emp-2', employeeName: 'Karthik S', leaveTypeId: 'type-2', leaveTypeName: 'Sick Leave', leaveTypeCode: 'SICK', startDate: '2026-09-01', endDate: '2026-09-01', totalDays: 1, paidDays: 1, unpaidDays: 0, status: 'information_requested', submittedAt: '2026-08-20T00:00:00Z' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeavePendingApprovalsTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeavePendingApprovalsTableComponent);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('selectedIds', new Set<string>());
  });

  it('renders one row per pending approval', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="approval-row"]').length).toBe(2);
  });

  it('emits rowClicked with the request id when a row is clicked', () => {
    fixture.detectChanges();
    const emitted: string[] = [];
    fixture.componentInstance.rowClicked.subscribe((id: string) => emitted.push(id));
    fixture.nativeElement.querySelectorAll('[data-testid="approval-row"]')[0].click();
    expect(emitted).toEqual(['req-1']);
  });

  it('emits selectionChanged with the toggled id when a checkbox is clicked', () => {
    fixture.detectChanges();
    const emitted: Set<string>[] = [];
    fixture.componentInstance.selectionChanged.subscribe((s: Set<string>) => emitted.push(s));
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="approval-select"]');
    checkbox.click();
    expect(emitted[0].has('req-1')).toBe(true);
  });

  it('checkbox click does not also trigger the row click', () => {
    fixture.detectChanges();
    const rowClicks: string[] = [];
    fixture.componentInstance.rowClicked.subscribe((id: string) => rowClicks.push(id));
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="approval-select"]');
    checkbox.click();
    expect(rowClicks).toEqual([]);
  });
});
