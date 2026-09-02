/** Screen 8: employee info, dates, balance impact, conflicts, and the three decision actions. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { LeaveApprovalDetailResponse, parseSubmissionConflictSnapshot } from '../../models/leave-approval.model';

export type LeaveApprovalDecisionRequest =
  | { kind: 'approve'; comment: string | null }
  | { kind: 'reject'; reason: string }
  | { kind: 'request-info'; question: string };

type ActionPanel = 'approve' | 'reject' | 'request-info' | null;

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
  @Output() decisionRequested = new EventEmitter<LeaveApprovalDecisionRequest>();
  @Output() closed = new EventEmitter<void>();

  readonly activeAction = signal<ActionPanel>(null);
  readonly approveComment = signal('');
  readonly rejectReason = signal('');
  readonly infoQuestion = signal('');

  readonly submissionSnapshot = computed(() =>
    this.detail ? parseSubmissionConflictSnapshot(this.detail.submissionConflictSnapshotJson) : null
  );

  readonly currentApproverState = computed(() => {
    const approver = this.detail?.approvers.find(
      (a) => a.status === 'pending' || a.status === 'information_requested'
    );
    return approver ? `Awaiting approver ${approver.sequenceOrder}` : 'No pending approver';
  });

  openAction(action: Exclude<ActionPanel, null>): void {
    this.activeAction.set(action);
  }

  closeAction(): void {
    this.activeAction.set(null);
    this.approveComment.set('');
    this.rejectReason.set('');
    this.infoQuestion.set('');
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

  onClose(): void {
    this.closeAction();
    this.closed.emit();
  }
}
