/** Quiet Operations Desk: the manager/HR queue - one row per request awaiting this approver. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { LeavePendingApprovalListItemResponse } from '../../models/leave-approval.model';

@Component({ selector: 'app-leave-pending-approvals-table', standalone: true, imports: [CommonModule, DataTableComponent, DataTableCellDirective], templateUrl: './leave-pending-approvals-table.component.html', styleUrl: './leave-pending-approvals-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeavePendingApprovalsTableComponent {
  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'from', label: 'From' },
    { key: 'to', label: 'To' },
    { key: 'hours', label: 'Hours' },
    { key: 'status', label: 'Status' }
  ];
  protected readonly trackByRequest = (row: LeavePendingApprovalListItemResponse): string => row.requestId;
  protected readonly rowTestId = (): string => 'approval-row';
  protected readonly selectTestId = (): string => 'approval-select';
  protected readonly selectAriaLabel = (row: LeavePendingApprovalListItemResponse): string => 'Select request from ' + row.employeeName;

  @Input({ required: true }) rows: readonly LeavePendingApprovalListItemResponse[] = [];
  @Input({ required: true }) selectedIds: ReadonlySet<string> = new Set();
  @Output() rowClicked = new EventEmitter<string>();
  @Output() selectionChanged = new EventEmitter<Set<string>>();

  statusLabel(status: string): string {
    return status === 'information_requested' ? 'Awaiting your info' : 'Pending';
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  onRowSelection(requestId: string, checked: boolean): void {
    const next = new Set(this.selectedIds);
    if (checked) next.add(requestId); else next.delete(requestId);
    this.selectionChanged.emit(next);
  }

  onSelectAll(checked: boolean): void {
    this.selectionChanged.emit(checked ? new Set(this.rows.map((row) => row.requestId)) : new Set());
  }

}
