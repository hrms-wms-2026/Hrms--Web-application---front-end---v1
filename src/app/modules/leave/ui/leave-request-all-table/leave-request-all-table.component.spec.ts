import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveRequestAllListItemResponse } from '../../models/leave-approval.model';
import { LeaveRequestAllTableComponent } from './leave-request-all-table.component';

describe('LeaveRequestAllTableComponent', () => {
  let fixture: ComponentFixture<LeaveRequestAllTableComponent>;

  const rows: LeaveRequestAllListItemResponse[] = [
    { requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', departmentId: 'dept-1', departmentName: 'Engineering', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', startDate: '2026-09-10', endDate: '2026-09-12', totalDays: 3, status: 'approved', submittedAt: '2026-08-25T00:00:00Z' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveRequestAllTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveRequestAllTableComponent);
    fixture.componentRef.setInput('rows', rows);
  });

  it('renders one row per request', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="all-request-row"]').length).toBe(1);
  });

  it('emits rowClicked with the request id when a row is clicked', () => {
    fixture.detectChanges();
    const emitted: string[] = [];
    fixture.componentInstance.rowClicked.subscribe((id: string) => emitted.push(id));
    fixture.nativeElement.querySelector('[data-testid="all-request-row"]').click();
    expect(emitted).toEqual(['req-1']);
  });

  it('emits cancelRequested with the row when Cancel is clicked', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.cancelRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.nativeElement.querySelector('[data-testid="cancel-request"]').click();
    expect(emitted).toEqual([rows[0]]);
  });
});
