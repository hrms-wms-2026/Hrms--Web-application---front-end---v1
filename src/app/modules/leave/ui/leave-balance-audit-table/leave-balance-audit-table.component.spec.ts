import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveBalanceAuditResponse } from '../../models/leave-entitlement.model';
import { LeaveBalanceAuditTableComponent } from './leave-balance-audit-table.component';

describe('LeaveBalanceAuditTableComponent', () => {
  let fixture: ComponentFixture<LeaveBalanceAuditTableComponent>;

  const rows: LeaveBalanceAuditResponse[] = [
    { id: 'audit-1', employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', changeType: 'accrual', hoursChanged: 20, balanceAfter: 20, reason: 'Auto-generated', relatedRequestId: null, createdAt: '2026-08-25T00:00:00Z' },
    { id: 'audit-2', employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', changeType: 'deduction', hoursChanged: -3, balanceAfter: 17, reason: 'Leave request approved', relatedRequestId: 'req-1', createdAt: '2026-08-26T00:00:00Z' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveBalanceAuditTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveBalanceAuditTableComponent);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('hasMore', false);
    fixture.componentRef.setInput('loading', false);
  });

  it('renders one row per audit entry', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="audit-row"]').length).toBe(2);
  });

  it('shows a positive/negative sign on hoursChanged', () => {
    fixture.detectChanges();
    const cells = fixture.nativeElement.querySelectorAll('[data-testid="audit-hours-changed"]');
    expect(cells[0].textContent.trim()).toBe('+20');
    expect(cells[1].textContent.trim()).toBe('-3');
  });

  it('shows the Load more button only when hasMore is true', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="load-more"]')).toBeNull();
    fixture.componentRef.setInput('hasMore', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="load-more"]')).not.toBeNull();
  });

  it('emits loadMoreRequested when Load more is clicked', () => {
    fixture.componentRef.setInput('hasMore', true);
    fixture.detectChanges();
    let emitted = 0;
    fixture.componentInstance.loadMoreRequested.subscribe(() => emitted++);
    fixture.nativeElement.querySelector('[data-testid="load-more"]').click();
    expect(emitted).toBe(1);
  });
});
