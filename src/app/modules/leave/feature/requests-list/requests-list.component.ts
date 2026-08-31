/** Quiet Operations Desk: Screen 6's HR-wide filterable ledger, counts + status filter chips. */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LeaveApprovalStore } from '../../state/leave-approval.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeaveRequestAllTableComponent } from '../../ui/leave-request-all-table/leave-request-all-table.component';
import { LeaveApprovalDetailSheetComponent } from '../../ui/leave-approval-detail-sheet/leave-approval-detail-sheet.component';

@Component({
  selector: 'app-requests-list',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent, ErrorStateComponent, LeaveRequestAllTableComponent, LeaveApprovalDetailSheetComponent],
  templateUrl: './requests-list.component.html',
  styleUrl: './requests-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestsListComponent {
  private readonly permissionService = inject(PermissionService);
  readonly store = inject(LeaveApprovalStore);
  readonly leaveTypeStore = inject(LeaveTypeStore);
  readonly canApprove = () => this.permissionService.hasPermission('leave:approve');
  readonly detailOpen = signal(false);

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
}
