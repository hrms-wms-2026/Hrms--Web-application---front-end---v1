/** Quiet Operations Desk: a scan-first balance ledger shared by My, Team, and All Balances. */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { formatDaysAtWorkDayHours, formatHours } from '../../utils/leave-hours-format';

@Component({
  selector: 'app-leave-balance-list-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leave-balance-list-table.component.html',
  styleUrl: './leave-balance-list-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveBalanceListTableComponent {
  @Input({ required: true }) balances: readonly LeaveBalanceResponse[] = [];
  @Input() showEmployeeColumn = true;
  @Input() showDepartmentColumn = false;
  @Input() showLegalEntityColumn = false;
  @Input() workDayHours: number | null = null;
  readonly formatHours = formatHours;

  daysAtRate(entitledHours: number): string | null {
    if (!this.workDayHours || this.workDayHours <= 0) return null;
    return formatDaysAtWorkDayHours(entitledHours, this.workDayHours);
  }
}
