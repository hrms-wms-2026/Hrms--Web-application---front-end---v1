/** Quiet Operations Desk: Screen 6/8's queue - one place for a manager or HR to clear pending leave. */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LeaveApprovalStore } from '../../state/leave-approval.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeavePendingApprovalsTableComponent } from '../../ui/leave-pending-approvals-table/leave-pending-approvals-table.component';
import { LeaveApprovalDecisionRequest, LeaveApprovalDetailSheetComponent } from '../../ui/leave-approval-detail-sheet/leave-approval-detail-sheet.component';

@Component({
  selector: 'app-pending-approvals',
  standalone: true,
  imports: [CommonModule, ButtonComponent, ErrorStateComponent, LeavePendingApprovalsTableComponent, LeaveApprovalDetailSheetComponent],
  templateUrl: './pending-approvals.component.html',
  styleUrl: './pending-approvals.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PendingApprovalsComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  readonly store = inject(LeaveApprovalStore);
  readonly leaveTypeStore = inject(LeaveTypeStore);
  readonly canApprove = () => this.permissionService.hasPermission('leave:approve');

  readonly detailOpen = signal(false);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly bulkRejectOpen = signal(false);
  readonly bulkRejectReason = signal('');

  constructor() {
    void this.store.loadPending();
    void this.leaveTypeStore.load();
  }

  onSearchInput(event: Event): void {
    const search = (event.target as HTMLInputElement).value;
    this.store.setPendingFilter({ ...this.store.pendingFilter(), search: search || undefined });
  }

  onLeaveTypeFilterChange(leaveTypeId: string): void {
    this.store.setPendingFilter({ ...this.store.pendingFilter(), leaveTypeId: leaveTypeId || undefined });
  }

  onFromDateChange(fromDate: string): void {
    this.store.setPendingFilter({ ...this.store.pendingFilter(), fromDate: fromDate || undefined });
  }

  onToDateChange(toDate: string): void {
    this.store.setPendingFilter({ ...this.store.pendingFilter(), toDate: toDate || undefined });
  }

  onRowClicked(requestId: string): void {
    this.detailOpen.set(true);
    void this.store.loadDetail(requestId);
  }

  onSelectionChanged(next: Set<string>): void {
    this.selectedIds.set(next);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.store.clearDetail();
  }

  async onDecision(event: LeaveApprovalDecisionRequest): Promise<void> {
    const requestId = this.store.detail()?.requestId;
    if (!requestId) return;

    let result;
    if (event.kind === 'approve') result = await this.store.approve(requestId, { comment: event.comment });
    else if (event.kind === 'reject') result = await this.store.reject(requestId, { reason: event.reason });
    else result = await this.store.requestInfo(requestId, { question: event.question });

    if (result) {
      this.notificationService.success(
        event.kind === 'approve' ? 'Request approved.' : event.kind === 'reject' ? 'Request rejected.' : 'Information requested from the employee.'
      );
      this.closeDetail();
    } else {
      this.notificationService.error(this.store.decideError() ?? 'Failed to record your decision.');
    }
  }

  async onBulkApprove(): Promise<void> {
    const requestIds = [...this.selectedIds()];
    if (requestIds.length === 0) return;
    const result = await this.store.bulkApprove({ requestIds, comment: null });
    if (result) {
      this.notificationService.success(`${result.successCount} approved${result.failureCount > 0 ? `, ${result.failureCount} failed` : ''}.`);
      this.selectedIds.set(new Set());
    } else {
      this.notificationService.error(this.store.decideError() ?? 'Failed to bulk approve these requests.');
    }
  }

  async onBulkReject(): Promise<void> {
    const requestIds = [...this.selectedIds()];
    const reason = this.bulkRejectReason().trim();
    if (requestIds.length === 0 || !reason) return;
    const result = await this.store.bulkReject({ requestIds, reason });
    if (result) {
      this.notificationService.success(`${result.successCount} rejected${result.failureCount > 0 ? `, ${result.failureCount} failed` : ''}.`);
      this.selectedIds.set(new Set());
      this.bulkRejectOpen.set(false);
      this.bulkRejectReason.set('');
    } else {
      this.notificationService.error(this.store.decideError() ?? 'Failed to bulk reject these requests.');
    }
  }
}
