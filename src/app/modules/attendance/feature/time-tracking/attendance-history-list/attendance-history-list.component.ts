import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { AttendanceHistoryRow } from '../../../models/time-tracking.model';
import { formatDate, formatDateTime, formatMinutes, statusLabel } from '../../../utils/attendance-formatters';

@Component({
  selector: 'app-attendance-history-list',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './attendance-history-list.component.html',
  styleUrl: './attendance-history-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceHistoryListComponent {
  readonly rows = input<readonly AttendanceHistoryRow[]>([]);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly totalCount = input(0);
  readonly displayTimezone = input<string>('UTC');
  readonly emptyMessage = input('No attendance records for this date range.');
  readonly showEmployeeColumn = input(false);
  readonly retryDisabledMessage = input<string | null>(null);

  readonly pageChange = output<number>();
  readonly retryRequested = output<void>();
  readonly rowSelected = output<AttendanceHistoryRow>();

  readonly Math = Math;

  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;
  readonly formatMinutes = formatMinutes;
  readonly statusLabel = statusLabel;

  employeeLabel(row: AttendanceHistoryRow): string {
    return row.employee?.displayName ?? 'Current employee';
  }

  hasBreakOverage(value: number | null | undefined, isOverBreakAllowance = false): boolean {
    return isOverBreakAllowance || (value ?? 0) > 0;
  }

  breakOverageHistoryLabel(value: number | null | undefined): string {
    return `Break exceeded by ${Math.max(0, value ?? 0)} min`;
  }

  selectRow(row: AttendanceHistoryRow): void {
    if (row.canViewDetails) {
      this.rowSelected.emit(row);
    }
  }
}
