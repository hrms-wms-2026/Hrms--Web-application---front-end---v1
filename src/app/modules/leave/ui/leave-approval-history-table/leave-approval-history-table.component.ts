/** Pending Approvals > History: requests the current approver already acted on, newest first. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { LeaveApprovalHistoryItemResponse } from '../../models/leave-approval.model';

@Component({ selector: 'app-leave-approval-history-table', standalone: true, imports: [CommonModule, DataTableComponent, DataTableCellDirective], templateUrl: './leave-approval-history-table.component.html', styleUrls: ['../leave-request-all-table/leave-request-all-table.component.css', './leave-approval-history-table.component.css'], changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveApprovalHistoryTableComponent {
  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'from', label: 'From' },
    { key: 'to', label: 'To' },
    { key: 'hours', label: 'Hours' },
    { key: 'action', label: 'My action' },
    { key: 'when', label: 'When' },
    { key: 'status', label: 'Request status' }
  ];
  protected readonly trackByRequest = (row: LeaveApprovalHistoryItemResponse): string => row.requestId;
  protected readonly rowTestId = (): string => 'history-row';

  @Input({ required: true }) rows: readonly LeaveApprovalHistoryItemResponse[] = [];
  @Output() rowClicked = new EventEmitter<string>();

  actionLabel(action: LeaveApprovalHistoryItemResponse['myAction']): string {
    switch (action) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'forwarded': return 'Forwarded';
      case 'information_requested': return 'Asked for info';
    }
  }

  statusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
