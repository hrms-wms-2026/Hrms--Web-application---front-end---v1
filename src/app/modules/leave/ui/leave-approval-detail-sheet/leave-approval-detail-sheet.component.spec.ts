import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveApprovalDetailResponse } from '../../models/leave-approval.model';
import { LeaveApprovalDetailSheetComponent } from './leave-approval-detail-sheet.component';

describe('LeaveApprovalDetailSheetComponent', () => {
  let fixture: ComponentFixture<LeaveApprovalDetailSheetComponent>;

  const detail: LeaveApprovalDetailResponse = {
    requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1',
    leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10', endAt: '2026-09-12',
    totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', reason: 'Family trip',
    approvers: [
      { approverEmployeeId: 'mgr-1', approverName: 'Priya Nair', sequenceOrder: 1, status: 'pending', comment: null, delegatedFromApproverId: null, decidedAt: null }
    ],
    infoMessages: [],
    submissionConflictSnapshotJson: JSON.stringify({ warnings: [], calendarConflicts: [], teamAbsencePercent: null }),
    currentWarnings: [{ code: 'blackout_period', message: 'Overlaps a configured blackout period.' }],
    remainingHours: 17,
    canDecide: true, forwardTo: null, canChangeDecision: false
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveApprovalDetailSheetComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveApprovalDetailSheetComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('detail', detail);
    fixture.componentRef.setInput('canApprove', true);
  });

  it('renders the employee, type, and total days in the header', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Anu Raman');
    expect(text).toContain('Annual Leave');
    expect(text).toContain('3');
  });

  it('renders current warnings', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Overlaps a configured blackout period.');
  });

  it('marks a current warning as NEW when it was not in the submission snapshot', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="warning-new"]')?.textContent?.trim()).toBe('NEW');
  });

  it('shows team coverage when the submission snapshot includes a percent', () => {
    fixture.componentRef.setInput('detail', {
      ...detail,
      submissionConflictSnapshotJson: JSON.stringify({ warnings: [], calendarConflicts: [], teamAbsencePercent: 40 })
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="team-coverage"]')?.textContent).toContain('40%');
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

  it('offers Send to the manager when a forward target exists and emits the note', () => {
    fixture.componentRef.setInput('detail', { ...detail, forwardTo: { employeeId: 'mgr-2', name: 'Nadesh Coomaraswamy' }, canChangeDecision: false });
    fixture.detectChanges();
    const forwardButton = fixture.nativeElement.querySelector('[data-testid="action-forward"]') as HTMLButtonElement;
    expect(forwardButton.textContent).toContain('Send to Nadesh Coomaraswamy');
    forwardButton.click();
    fixture.componentInstance.forwardNote.set('  Long leave  ');
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.decisionRequested.subscribe((e: unknown) => emitted.push(e));
    (fixture.nativeElement.querySelector('[data-testid="confirm-forward"]') as HTMLButtonElement).click();
    expect(emitted).toEqual([{ kind: 'forward', note: 'Long leave' }]);
  });

  it('hides Send to when there is nobody to forward to', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="action-forward"]')).toBeNull();
  });

  it('lets the deciding approver change an approval to a rejection with a reason', () => {
    fixture.componentRef.setInput('canApprove', false);
    fixture.componentRef.setInput('detail', { ...detail, status: 'approved', canChangeDecision: true });
    fixture.detectChanges();
    const change = fixture.nativeElement.querySelector('[data-testid="action-change"]') as HTMLButtonElement;
    expect(change.textContent).toContain('Change to Rejected');
    change.click();
    fixture.detectChanges();
    const confirm = fixture.nativeElement.querySelector('[data-testid="confirm-change"]') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fixture.componentInstance.changeComment.set('Team is short that week');
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.decisionRequested.subscribe((e: unknown) => emitted.push(e));
    confirm.click();
    expect(emitted).toEqual([{ kind: 'change-to-reject', reason: 'Team is short that week' }]);
  });

  it('offers Change to Approved on a rejected request and hides the section when it can no longer change', () => {
    fixture.componentRef.setInput('canApprove', false);
    fixture.componentRef.setInput('detail', { ...detail, status: 'rejected', canChangeDecision: true });
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('[data-testid="action-change"]') as HTMLElement).textContent).toContain('Change to Approved');

    fixture.componentRef.setInput('detail', { ...detail, status: 'rejected', canChangeDecision: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="change-decision"]')).toBeNull();
  });

  it('names the waiting approver even when the detail arrives after the sheet first renders', () => {
    fixture.componentRef.setInput('detail', null);
    fixture.detectChanges();
    fixture.componentRef.setInput('detail', detail);
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('[data-testid="approver-state"]') as HTMLElement).textContent).toContain('Waiting for Priya Nair');
  });

  it('labels each conversation message with who wrote it', () => {
    fixture.componentRef.setInput('detail', {
      ...detail,
      infoMessages: [
        { senderEmployeeId: 'mgr-1', message: 'What is the trip for?', createdAt: '2026-09-01T08:00:00Z' },
        { senderEmployeeId: 'emp-1', message: 'Family wedding', createdAt: '2026-09-01T09:00:00Z' }
      ]
    });
    fixture.detectChanges();
    const messages = Array.from(fixture.nativeElement.querySelectorAll('.lad-msg')) as HTMLElement[];
    expect(messages.length).toBe(2);
    expect(messages[0].textContent).toContain('Priya Nair');
    expect(messages[1].textContent).toContain('Anu Raman');
    expect(messages[1].classList).toContain('lad-msg--employee');
  });
});
