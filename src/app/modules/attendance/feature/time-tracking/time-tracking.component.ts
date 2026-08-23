import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { isMachineValue } from '../../../../core/services/error-handler.service';
import { AttendanceHistoryRow, AttendanceTodayResponse, TimeTrackingRange } from '../../models/time-tracking.model';
import { TimeTrackingAction, TimeTrackingStore } from '../../state/time-tracking.store';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DISPLAY_TIMEZONE_FALLBACK = 'UTC';

@Component({
  selector: 'app-time-tracking',
  standalone: true,
  imports: [BreadcrumbHeaderComponent, ButtonComponent, DatePickerComponent],
  templateUrl: './time-tracking.component.html',
  styleUrl: './time-tracking.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeTrackingComponent implements OnInit {
  readonly store = inject(TimeTrackingStore);
  private readonly permissionService = inject(PermissionService);

  readonly hasCoveredAccess = computed(() => this.permissionService.hasPermission('attendance:read'));
  readonly historyFrom = signal('');
  readonly historyTo = signal('');
  readonly rangeError = signal('');
  readonly currentWeekRange = currentWeekRange();
  /** History rows have no timezone field, so use Today.timezone for the selected company.
   * UTC is an explicit display-only fallback until Today is available; it is never the browser timezone. */
  readonly displayTimezone = computed(() => this.store.today()?.timezone?.trim() || DISPLAY_TIMEZONE_FALLBACK);
  readonly canViewCoveredEmployees = computed(() => this.store.today()?.canViewCoveredEmployees ?? false);
  readonly friendlyTodayMessages = computed(() => this.getFriendlyTodayMessages(this.store.today()));

  ngOnInit(): void {
    const range = this.currentWeekRange;
    this.historyFrom.set(range.from);
    this.historyTo.set(range.to);
    void this.store.loadToday();
    void this.store.loadMyHistory(range);
    if (this.hasCoveredAccess()) {
      void this.store.loadCoveredHistory(range);
    }
  }

  applyHistoryRange(): void {
    const range = this.selectedRange();
    if (!range) {
      return;
    }

    void this.store.loadMyHistory(range);
    if (this.hasCoveredAccess()) {
      void this.store.loadCoveredHistory(range);
    }
  }

  retryToday(): void {
    void this.store.loadToday();
  }

  retryHistory(): void {
    this.applyHistoryRange();
  }

  retryCoveredHistory(): void {
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    if (this.hasCoveredAccess()) {
      void this.store.loadCoveredHistory(range, this.store.selectedCoveredEmployeeId() ?? undefined);
    }
  }

  setHistoryFrom(value: string): void {
    this.historyFrom.set(value);
    this.rangeError.set('');
  }

  setHistoryTo(value: string): void {
    this.historyTo.set(value);
    this.rangeError.set('');
  }

  selectedRange(): TimeTrackingRange | null {
    const range = { from: this.historyFrom().trim(), to: this.historyTo().trim() };
    if (!range.from || !range.to) {
      this.rangeError.set('Select both a start date and an end date.');
      return null;
    }
    if (range.from > range.to) {
      this.rangeError.set('The start date must be on or before the end date.');
      return null;
    }
    this.rangeError.set('');
    return range;
  }

  actionIsLoading(action: TimeTrackingAction): boolean {
    return this.store.activeAction() === action;
  }

  statusLabel(value: string): string {
    return humanizeValue(value, {
      not_clocked_in: 'Not clocked in',
      clocked_in: 'Clocked in',
      on_break: 'On break',
      clocked_out: 'Clocked out',
      present: 'Present',
      absent: 'Absent',
      late: 'Late',
      off_day: 'Off day'
    });
  }

  workModeLabel(value: string | null): string {
    return value ? humanizeValue(value, { onsite: 'Onsite', remote: 'Remote', hybrid: 'Hybrid', field: 'Field' }) : 'Not specified';
  }

  sourceLabel(value: string | null): string {
    return value ? humanizeValue(value, { web: 'Web', desktop_tray: 'Desktop tray', biometric: 'Biometric' }) : '—';
  }

  formatDate(value: string): string {
    return formatDate(value);
  }

  formatDateTime(value: string | null, timezone?: string | null): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    const displayTimezone = validDisplayTimezone(timezone);
    if (!displayTimezone) {
      return '—';
    }

    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: displayTimezone
      }).format(date);
    } catch {
      // Invalid runtime timezone data must not surface a technical error to users.
      return '—';
    }
  }

  formatMinutes(value: number | null): string {
    if (value === null || value < 0) {
      return '—';
    }
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    if (hours === 0) {
      return `${minutes}m`;
    }
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }

  employeeLabel(row: AttendanceHistoryRow): string {
    return row.employee?.displayName ?? 'Current employee';
  }

  private getFriendlyTodayMessages(today: AttendanceTodayResponse | null): readonly string[] {
    if (!today) {
      return [];
    }

    const messages = today.messages
      .map((message) => humanizeAttendanceMessage(message))
      .filter((message): message is string => !!message);

    if (!today.isWorkingDay && !today.isHoliday && !messages.some((message) => message.toLowerCase().includes('off day'))) {
      messages.push('Today is an off day.');
    }
    return messages;
  }
}

function currentWeekRange(reference = new Date()): TimeTrackingRange {
  const referenceDay = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const dayOfWeek = referenceDay.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(referenceDay.getTime() + mondayOffset * DAY_IN_MILLISECONDS);
  const sunday = new Date(monday.getTime() + 6 * DAY_IN_MILLISECONDS);
  return { from: toDateOnly(monday), to: toDateOnly(sunday) };
}

function toDateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function validDisplayTimezone(timezone: string | null | undefined): string | null {
  const candidate = timezone?.trim() || DISPLAY_TIMEZONE_FALLBACK;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: candidate }).format();
    return candidate;
  } catch {
    return null;
  }
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function humanizeAttendanceMessage(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/[ -]+/g, '_');
  if (!normalized) {
    return null;
  }

  if (normalized.includes('schedule') && normalized.includes('not') && normalized.includes('config')) {
    return 'Your work schedule is not configured for today.';
  }
  if (normalized.includes('policy') && normalized.includes('not') && normalized.includes('config')) {
    return 'Your attendance policy is not configured.';
  }
  if (normalized.includes('break') && (normalized.includes('used') || normalized.includes('allowance'))) {
    return 'You have used your break time for today.';
  }
  if (normalized.includes('already') && normalized.includes('clocked') && normalized.includes('out')) {
    return 'You have already clocked out today.';
  }
  if (normalized.includes('off') && normalized.includes('day')) {
    return 'Today is an off day.';
  }
  return isMachineValue(value) ? null : value;
}

function humanizeValue(value: string, knownValues: Record<string, string>): string {
  const normalized = value.trim().toLowerCase().replace(/[ -]+/g, '_');
  if (knownValues[normalized]) {
    return knownValues[normalized];
  }
  if (!normalized) {
    return 'Not specified';
  }
  return normalized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
