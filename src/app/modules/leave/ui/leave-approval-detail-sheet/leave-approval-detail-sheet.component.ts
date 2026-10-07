/** Screen 8: employee info, dates, balance impact, conflicts, and the three decision actions. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { LeaveApprovalApproverResponse, LeaveApprovalDetailResponse, LeaveApprovalInfoMessageResponse, parseSubmissionConflictSnapshot } from '../../models/leave-approval.model';

export type LeaveApprovalDecisionRequest =
  | { kind: 'approve'; comment: string | null }
  | { kind: 'reject'; reason: string }
  | { kind: 'request-info'; question: string }
  | { kind: 'forward'; note: string | null }
  | { kind: 'change-to-reject'; reason: string }
  | { kind: 'change-to-approve'; comment: string | null };

/** Success toast text for a decision, shared by every page that hosts the sheet. */
export function decisionMessage(event: LeaveApprovalDecisionRequest, forwardToName: string): string {
  switch (event.kind) {
    case 'approve': return 'Request approved.';
    case 'reject': return 'Request rejected.';
    case 'forward': return `Request sent to ${forwardToName}.`;
    case 'request-info': return 'Information requested from the employee.';
    case 'change-to-reject': return 'Decision changed to rejected.';
    case 'change-to-approve': return 'Decision changed to approved.';
  }
}

type ActionPanel = 'approve' | 'reject' | 'request-info' | 'forward' | 'change' | null;

@Component({
  selector: 'app-leave-approval-detail-sheet',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  templateUrl: './leave-approval-detail-sheet.component.html',
  styleUrl: './leave-approval-detail-sheet.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveApprovalDetailSheetComponent {
  @Input({ required: true }) open = false;
  @Input({ required: true }) detail: LeaveApprovalDetailResponse | null = null;
  @Input({ required: true }) canApprove = false;
  @Input() deciding = false;
  @Input() decideError: string | null = null;
  @Input() loading = false;
  @Input() loadError: string | null = null;
  @Output() decisionRequested = new EventEmitter<LeaveApprovalDecisionRequest>();
  @Output() closed = new EventEmitter<void>();

  readonly activeAction = signal<ActionPanel>(null);
  readonly approveComment = signal('');
  readonly rejectReason = signal('');
  readonly infoQuestion = signal('');
  readonly forwardNote = signal('');
  readonly changeComment = signal('');

  // Plain methods, not computed(): `detail` is a plain @Input, so a computed() would cache the
  // first (empty) value and never see the loaded request.
  submissionSnapshot() {
    return this.detail ? parseSubmissionConflictSnapshot(this.detail.submissionConflictSnapshotJson) : null;
  }

  currentApprover(): LeaveApprovalApproverResponse | null {
    return this.detail?.approvers.find((a) => a.status === 'pending' || a.status === 'information_requested') ?? null;
  }

  currentApproverState(): string {
    const detail = this.detail;
    if (!detail) return '';
    const approver = this.currentApprover();
    if (detail.status === 'information_requested') {
      return `Waiting for ${detail.employeeName} to answer ${approver?.approverName || 'the approver'}`;
    }
    if (approver) return `Waiting for ${approver.approverName || 'approver ' + approver.sequenceOrder}`;
    if (detail.status === 'approved') return 'Approved';
    if (detail.status === 'rejected') return 'Rejected';
    if (detail.status === 'cancelled') return 'Cancelled';
    return 'No pending approver';
  }

  statusLabel(status: string): string {
    return status === 'information_requested' ? 'Info requested' : status.charAt(0).toUpperCase() + status.slice(1);
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** "2026-10-08 (Wed)" in the viewer's local time, matching the app's yyyy-MM-dd tables. */
  dayLabel(iso: string): string {
    const date = new Date(iso);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} (${date.toLocaleDateString('en-US', { weekday: 'short' })})`;
  }

  isSameDay(): boolean {
    if (!this.detail) return false;
    return new Date(this.detail.startAt).toDateString() === new Date(this.detail.endAt).toDateString();
  }

  /** Who wrote a question/answer: the employee, an approver on the request, or a generic label. */
  senderName(message: LeaveApprovalInfoMessageResponse): string {
    const detail = this.detail;
    if (!detail) return '';
    if (message.senderEmployeeId === detail.employeeId) return detail.employeeName;
    return detail.approvers.find((a) => a.approverEmployeeId === message.senderEmployeeId)?.approverName || 'Approver';
  }

  isFromEmployee(message: LeaveApprovalInfoMessageResponse): boolean {
    return message.senderEmployeeId === this.detail?.employeeId;
  }

  hasNoChecks(): boolean {
    const snapshot = this.submissionSnapshot();
    const submitted = (snapshot?.warnings.length ?? 0) + (snapshot?.calendarConflicts.length ?? 0);
    return submitted === 0 && (this.detail?.currentWarnings.length ?? 0) === 0;
  }

  teamCoverageLabel(): string | null {
    const percent = this.submissionSnapshot()?.teamAbsencePercent;
    if (percent === null || percent === undefined) return null;
    return `${percent}% of the team is off in this range`;
  }

  isNewWarning(code: string): boolean {
    const submitted = this.submissionSnapshot()?.warnings ?? [];
    return !submitted.some((warning) => warning.code === code);
  }

  openAction(action: Exclude<ActionPanel, null>): void {
    this.activeAction.set(action);
  }

  closeAction(): void {
    this.activeAction.set(null);
    this.approveComment.set('');
    this.rejectReason.set('');
    this.infoQuestion.set('');
    this.forwardNote.set('');
    this.changeComment.set('');
  }

  onSubmitApprove(): void {
    this.decisionRequested.emit({ kind: 'approve', comment: this.approveComment().trim() || null });
  }

  onSubmitReject(): void {
    const reason = this.rejectReason().trim();
    if (!reason) return;
    this.decisionRequested.emit({ kind: 'reject', reason });
  }

  onSubmitRequestInfo(): void {
    const question = this.infoQuestion().trim();
    if (!question) return;
    this.decisionRequested.emit({ kind: 'request-info', question });
  }

  onSubmitForward(): void {
    this.decisionRequested.emit({ kind: 'forward', note: this.forwardNote().trim() || null });
  }

  onSubmitChange(): void {
    const comment = this.changeComment().trim();
    if (this.detail?.status === 'approved') {
      if (!comment) return;
      this.decisionRequested.emit({ kind: 'change-to-reject', reason: comment });
    } else {
      this.decisionRequested.emit({ kind: 'change-to-approve', comment: comment || null });
    }
  }

  approverStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Waiting';
      case 'information_requested': return 'Asked for info';
      case 'forwarded': return 'Forwarded';
      case 'skipped': return 'Not needed';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  onClose(): void {
    this.closeAction();
    this.closed.emit();
  }
}
