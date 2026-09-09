import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveApprovalDetailResponse } from '../../models/leave-approval.model';
import { LeaveApprovalDetailSheetComponent } from './leave-approval-detail-sheet.component';

describe('LeaveApprovalDetailSheetComponent', () => {
  let fixture: ComponentFixture<LeaveApprovalDetailSheetComponent>;

  const detail: LeaveApprovalDetailResponse = {
    requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1',
    leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-09T14:00:00.000Z', endAt: '2026-09-09T18:00:00.000Z',
    totalHours: 4, paidHours: 4, unpaidHours: 0, status: 'pending', reason: 'Family trip',
    approvers: [
      { approverEmployeeId: 'mgr-1', sequenceOrder: 1, status: 'pending', comment: null, delegatedFromApproverId: null, decidedAt: null }
    ],
    infoMessages: [],
    submissionConflictSnapshotJson: JSON.stringify({ warnings: [], calendarConflicts: [], teamAbsencePercent: null }),
    currentWarnings: [{ code: 'blackout_period', message: 'Overlaps a configured blackout period.' }],
    remainingHours: 17
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveApprovalDetailSheetComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveApprovalDetailSheetComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('detail', detail);
    fixture.componentRef.setInput('canApprove', true);
  });

  it('renders the employee, type, datetime range, and total hours in the header', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Anu Raman');
    expect(text).toContain('Annual Leave');
    expect(text).toContain('9 Sep 14:00 → 9 Sep 18:00');
    expect(text).toContain('4h');
    expect(text).not.toContain('days');
  });

  it('renders current warnings', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Overlaps a configured blackout period.');
  });

  it('opens the reject form and requires a reason before emitting', () => {
    fixture.detectChanges();
    fixture.componentInstance.openAction('reject');
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.decisionRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.onSubmitReject();
    expect(fixture.componentInstance.decisionRequested.observed).toBe(true);
    expect(emitted).toEqual([]);
  });

  it('emits decisionRequested with an approve action and comment', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.decisionRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.openAction('approve');
    fixture.componentInstance.approveComment.set('Enjoy the trip');
    fixture.componentInstance.onSubmitApprove();
    expect(emitted).toEqual([{ kind: 'approve', comment: 'Enjoy the trip' }]);
  });

  it('emits decisionRequested with a reject action once a reason is entered', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.decisionRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.openAction('reject');
    fixture.componentInstance.rejectReason.set('No cover available');
    fixture.componentInstance.onSubmitReject();
    expect(emitted).toEqual([{ kind: 'reject', reason: 'No cover available' }]);
  });

  it('does not emit reject without a reason', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.decisionRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.openAction('reject');
    fixture.componentInstance.onSubmitReject();
    expect(emitted).toEqual([]);
  });

  it('emits decisionRequested with a request-info action once a question is entered', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.decisionRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.openAction('request-info');
    fixture.componentInstance.infoQuestion.set('Can you share your travel dates?');
    fixture.componentInstance.onSubmitRequestInfo();
    expect(emitted).toEqual([{ kind: 'request-info', question: 'Can you share your travel dates?' }]);
  });

  it('hides action buttons when canApprove is false', () => {
    fixture.componentRef.setInput('canApprove', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="action-approve"]')).toBeNull();
  });
});
