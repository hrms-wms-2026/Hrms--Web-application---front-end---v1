import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../../shared/ui/data-table/data-table.component';
import { AttendanceEmptyStateComponent } from '../../../ui/attendance-empty-state/attendance-empty-state.component';
import { AttendanceErrorBannerComponent } from '../../../ui/attendance-error-banner/attendance-error-banner.component';
import { AttendanceListPagerComponent } from '../../../ui/attendance-list-pager/attendance-list-pager.component';
import { AttendanceHistoryRow } from '../../../models/time-tracking.model';
import { formatDate, formatDateTime, formatMinutes, statusLabel } from '../../../utils/attendance-formatters';

@Component({
  selector: 'app-attendance-history-list',
  standalone: true,
  imports: [AttendanceEmptyStateComponent, AttendanceErrorBannerComponent, AttendanceListPagerComponent, DataTableComponent, DataTableCellDirective],
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
  readonly showStatusNotes = input(false);
  readonly retryDisabledMessage = input<string | null>(null);

  readonly pageChange = output<number>();
  readonly retryRequested = output<void>();
  readonly rowSelected = output<AttendanceHistoryRow>();

  readonly emptyIconPaths = ['M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'];

  protected readonly columns = computed<DataTableColumn[]>(() => [
    ...(this.showEmployeeColumn() ? [{ key: 'employee', label: 'Employee' }] : []),
    { key: 'date', label: 'Date' },
    { key: 'clockIn', label: 'Clock in' },
    { key: 'clockOut', label: 'Clock out' },
    { key: 'break', label: 'Break' },
    { key: 'status', label: 'Status' }
  ]);
  protected readonly trackByRecord = (row: AttendanceHistoryRow): string => row.attendanceRecordId;
  /** Only rows with viewable details get the shared table's clickable (pointer + hover) styling. */
  protected readonly rowClass = (row: AttendanceHistoryRow): string => (row.canViewDetails ? 'data-table__row--clickable' : '');

  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;
  readonly formatMinutes = formatMinutes;
  readonly statusLabel = statusLabel;

  employeeLabel(row: AttendanceHistoryRow): string {
    return row.employee?.displayName ?? 'Current employee';
  }

  scheduledLabel(row: AttendanceHistoryRow): string {
    if (row.scheduledStartTime && row.scheduledEndTime) return `${row.scheduledStartTime} – ${row.scheduledEndTime}`;
    if (row.scheduledStartTime) return row.scheduledStartTime;
    if (row.scheduledEndTime) return row.scheduledEndTime;
    return 'Not scheduled';
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
