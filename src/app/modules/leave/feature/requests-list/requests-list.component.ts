/** Quiet Operations Desk: Screen 6's HR-wide filterable ledger, counts + status filter chips. */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LeaveApprovalStore } from '../../state/leave-approval.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { CancelLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveRequestAllListItemResponse } from '../../models/leave-approval.model';
import { LeaveCancelConfirmDialogComponent } from '../../ui/leave-cancel-confirm-dialog/leave-cancel-confirm-dialog.component';
import { LeaveRequestAllTableComponent } from '../../ui/leave-request-all-table/leave-request-all-table.component';
import { LeaveApprovalDetailSheetComponent } from '../../ui/leave-approval-detail-sheet/leave-approval-detail-sheet.component';

@Component({
  selector: 'app-requests-list',
  standalone: true,
  imports: [CommonModule, DatePickerComponent, EmptyStateComponent, ErrorStateComponent, SelectComponent, LeaveCancelConfirmDialogComponent, LeaveRequestAllTableComponent, LeaveApprovalDetailSheetComponent],
  templateUrl: './requests-list.component.html',
  styleUrls: ['../../ui/time-off-chrome.css', './requests-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestsListComponent {
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);
  readonly store = inject(LeaveApprovalStore);
  readonly leaveTypeStore = inject(LeaveTypeStore);
  readonly canApprove = () => this.permissionService.hasPermission('leave:approve');
  readonly detailOpen = signal(false);
  readonly cancelTarget = signal<LeaveRequestAllListItemResponse | null>(null);
  readonly statusFilter = computed(() => this.store.allFilter().status ?? '');
  readonly leaveTypeOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All leave types' },
    ...this.leaveTypeStore.items().map((type) => ({ value: type.id, label: type.name }))
  ]);

  constructor() {
    void this.store.loadAll();
    void this.leaveTypeStore.load();
  }

  setStatusFilter(status: string | undefined): void {
    this.store.setAllFilter({ ...this.store.allFilter(), status: status || undefined });
  }

  onLeaveTypeFilterChange(leaveTypeId: string): void {
    this.store.setAllFilter({ ...this.store.allFilter(), leaveTypeId: leaveTypeId || undefined });
  }

  onFromDateChange(fromDate: string): void {
    this.store.setAllFilter({ ...this.store.allFilter(), fromDate: fromDate || undefined });
  }

  onToDateChange(toDate: string): void {
    this.store.setAllFilter({ ...this.store.allFilter(), toDate: toDate || undefined });
  }

  onRowClicked(requestId: string): void {
    this.detailOpen.set(true);
    void this.store.loadDetail(requestId);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.store.clearDetail();
  }

  onCancelRequested(row: LeaveRequestAllListItemResponse): void {
    this.cancelTarget.set(row);
  }

  closeCancelDialog(): void {
    this.cancelTarget.set(null);
  }

  async onConfirmCancel(payload: CancelLeaveRequestRequest): Promise<void> {
    const target = this.cancelTarget();
    if (!target) return;
    const result = await this.store.cancel(target.requestId, payload);
    if (result) {
      this.notificationService.success('Leave request cancelled.');
      this.closeCancelDialog();
    } else {
      this.notificationService.error(this.store.cancelDialogError() ?? 'Failed to cancel this request.');
    }
  }
}
