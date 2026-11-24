/** Quiet Operations Desk: a scan-first balance ledger shared by My, Team, and All Balances. */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
@Component({ selector: 'app-leave-balance-list-table', standalone: true, imports: [DataTableComponent, DataTableCellDirective], templateUrl: './leave-balance-list-table.component.html', styleUrl: './leave-balance-list-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveBalanceListTableComponent {
  protected get columns(): readonly DataTableColumn[] {
    return [
      ...(this.showEmployeeColumn ? [{ key: 'employee', label: 'Employee' }] : []),
      ...(this.showDepartmentColumn ? [{ key: 'department', label: 'Department', filterValue: (b: LeaveBalanceResponse) => b.departmentName ?? '—' }] : []),
      ...(this.showLegalEntityColumn ? [{ key: 'legalEntity', label: 'Legal Entity', filterValue: (b: LeaveBalanceResponse) => b.legalEntityName ?? '—' }] : []),
      { key: 'leaveType', label: 'Leave type', filterValue: (b: LeaveBalanceResponse) => b.leaveTypeName },
      { key: 'entitled', label: 'Entitled hours' },
      { key: 'carried', label: 'Carried forward hours' },
      { key: 'used', label: 'Used hours' },
      { key: 'pending', label: 'Pending hours' },
      { key: 'remaining', label: 'Remaining hours' },
      { key: 'expires', label: 'Carry-forward expires' }
    ];
  }
  protected readonly trackBalance = (balance: LeaveBalanceResponse): string => balance.employeeId + balance.leaveTypeId;
  protected readonly rowTestId = (): string => 'balance-row';
 @Input({ required: true }) balances: readonly LeaveBalanceResponse[] = []; @Input() showEmployeeColumn = true; @Input() showDepartmentColumn = false; @Input() showLegalEntityColumn = false; }
