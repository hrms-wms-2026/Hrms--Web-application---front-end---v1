import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveRequestListItemResponse } from '../../models/leave-request.model';
import { LeaveRequestHistoryTableComponent } from './leave-request-history-table.component';

describe('LeaveRequestHistoryTableComponent', () => {
  let fixture: ComponentFixture<LeaveRequestHistoryTableComponent>;

  const requests: LeaveRequestListItemResponse[] = [
    { id: 'req-1', employeeId: 'emp-1', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10T00:00:00Z', endAt: '2026-09-12T00:00:00Z', totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', noticePeriodMissed: false, createdAt: '2026-08-25T00:00:00Z', updatedAt: null },
    { id: 'req-2', employeeId: 'emp-1', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-07-01T00:00:00Z', endAt: '2026-07-01T00:00:00Z', totalHours: 1, paidHours: 1, unpaidHours: 0, status: 'rejected', noticePeriodMissed: true, createdAt: '2026-06-20T00:00:00Z', updatedAt: '2026-06-21T00:00:00Z' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveRequestHistoryTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveRequestHistoryTableComponent);
    fixture.componentRef.setInput('requests', requests);
  });

  it('renders one row per request', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="request-row"]').length).toBe(2);
  });

  it('shows a status badge matching each status', () => {
    fixture.detectChanges();
    const badges = fixture.nativeElement.querySelectorAll('[data-testid="request-status"]');
    expect(badges[0].textContent.trim()).toBe('Pending');
    expect(badges[0].className).toContain('lrh-status-pending');
    expect(badges[1].textContent.trim()).toBe('Rejected');
    expect(badges[1].className).toContain('lrh-status-rejected');
  });

  it('shows a Cancel button only for pending or approved rows', () => {
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="cancel-request"]');
    expect(buttons.length).toBe(1); // requests[0] is pending, requests[1] is rejected
  });

  it('emits cancelRequested with the row when Cancel is clicked', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.cancelRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.nativeElement.querySelector('[data-testid="cancel-request"]').click();
    expect(emitted).toEqual([requests[0]]);
  });
});
