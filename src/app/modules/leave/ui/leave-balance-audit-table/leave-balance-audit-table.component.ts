import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { LeaveBalanceAuditResponse } from '../../models/leave-entitlement.model';

@Component({ selector: 'app-leave-balance-audit-table', standalone: true, imports: [CommonModule, DataTableComponent, DataTableCellDirective], templateUrl: './leave-balance-audit-table.component.html', styleUrl: './leave-balance-audit-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveBalanceAuditTableComponent {
  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'employee', label: 'Employee' },
    { key: 'type', label: 'Type' },
    { key: 'change', label: 'Change' },
    { key: 'hours', label: 'Hours' },
    { key: 'balanceAfter', label: 'Balance After' },
    { key: 'reason', label: 'Reason' },
    { key: 'date', label: 'Date' }
  ];
  protected readonly trackById = (row: LeaveBalanceAuditResponse): string => row.id;
  protected readonly rowTestId = (): string => 'audit-row';

  @Input({ required: true }) rows: readonly LeaveBalanceAuditResponse[] = [];
  @Input({ required: true }) hasMore = false;
  @Input({ required: true }) loading = false;
  @Output() loadMoreRequested = new EventEmitter<void>();

  signedDays(hoursChanged: number): string {
    return hoursChanged >= 0 ? `+${hoursChanged}` : `${hoursChanged}`;
  }

  changeTypeLabel(changeType: string): string {
    if (changeType === 'accrual') return 'Credit';
    return changeType.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
