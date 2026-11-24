/** Quiet Operations Desk: HR's org-wide read-only ledger of every leave request. */
import { ChangeDetectionStrategy, Component, computed, EventEmitter, input, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableCellDirective, DataTableColumn, DataTableColumnFilters, DataTableComponent, DataTableFilterValues, withColumnFilters } from '../../../../shared/ui/data-table/data-table.component';
import { LeaveRequestAllListItemResponse } from '../../models/leave-approval.model';

@Component({ selector: 'app-leave-request-all-table', standalone: true, imports: [CommonModule, DataTableComponent, DataTableCellDirective], templateUrl: './leave-request-all-table.component.html', styleUrl: './leave-request-all-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveRequestAllTableComponent {
  /** Header-menu filters keyed by column key - each mirrors one of the page's filters. */
  readonly columnFilters = input<DataTableColumnFilters>({});
  readonly filterValues = input<DataTableFilterValues>({});
  @Output() filterChanged = new EventEmitter<{ key: string; values: string[] }>();
  protected readonly tableColumns = computed(() => withColumnFilters(this.columns, this.columnFilters()));

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'type', label: 'Type' },
    { key: 'from', label: 'From' },
    { key: 'to', label: 'To' },
    { key: 'hours', label: 'Hours' },
    { key: 'approver', label: 'Approver' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', interactive: true, shrink: true, align: 'end' as const }
  ];
  protected readonly trackByRequest = (row: LeaveRequestAllListItemResponse): string => row.requestId;
  protected readonly rowTestId = (): string => 'all-request-row';

  @Input({ required: true }) rows: readonly LeaveRequestAllListItemResponse[] = [];
  @Output() rowClicked = new EventEmitter<string>();
  @Output() cancelRequested = new EventEmitter<LeaveRequestAllListItemResponse>();

  statusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  }

  canCancel(row: LeaveRequestAllListItemResponse): boolean {
    return row.status === 'pending' || row.status === 'approved';
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
