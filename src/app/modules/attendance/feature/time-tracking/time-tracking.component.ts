import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  AttendanceCorrectionBreakRequest,
  AttendanceCorrectionPreviewRequest,
  AttendanceCorrectionType,
  CORRECTION_TYPE_OPTIONS,
  correctionTypeLabel,
  correctionStatusLabel,
  AttendanceCorrectionResponse
} from '../../models/attendance-correction.model';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { isMachineValue } from '../../../../core/services/error-handler.service';
import { AttendanceHistoryRow, AttendanceTodayResponse, TimeTrackingRange } from '../../models/time-tracking.model';
import { TimeTrackingAction, TimeTrackingStore } from '../../state/time-tracking.store';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DISPLAY_TIMEZONE_FALLBACK = 'UTC';
type AttendanceViewMode = 'my' | 'team';

@Component({
  selector: 'app-time-tracking',
  standalone: true,
  imports: [BreadcrumbHeaderComponent, ButtonComponent, DatePickerComponent, FormsModule, ModalComponent],
  templateUrl: './time-tracking.component.html',
  styleUrl: './time-tracking.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeTrackingComponent implements OnInit {
  readonly store = inject(TimeTrackingStore);
  private readonly permissionService = inject(PermissionService);
  private readonly notifications = inject(NotificationService);

  readonly Math = Math;
  readonly hasCoveredAccess = computed(() => this.permissionService.hasPermission('attendance:read'));
  readonly viewMode = signal<AttendanceViewMode>('my');
  readonly historyFrom = signal('');
  readonly historyTo = signal('');
  readonly rangeError = signal('');
  readonly currentWeekRange = currentWeekRange();
  /** History rows have no timezone field, so use Today.timezone for the selected company.
   * UTC is an explicit display-only fallback until Today is available; it is never the browser timezone. */
  readonly displayTimezone = computed(() => this.store.today()?.timezone?.trim() || DISPLAY_TIMEZONE_FALLBACK);
  readonly canViewCoveredEmployees = computed(() => this.store.today()?.canViewCoveredEmployees ?? false);
  readonly friendlyTodayMessages = computed(() => this.getFriendlyTodayMessages(this.store.today()));
  readonly correctionFormOpen = signal<AttendanceHistoryRow | null>(null);
  readonly correctionType = signal<AttendanceCorrectionType>('clock_in');
  readonly requestedClockInTime = signal('');
  readonly requestedClockOutTime = signal('');
  readonly correctionReason = signal('');
  readonly correctionNotes = signal('');
  readonly correctionBreaks = signal<CorrectionBreakDraft[]>([{ start: '', end: '' }]);
  readonly correctionFieldErrors = signal<Record<string, string>>({});
  readonly correctionFormMessage = signal('');
  readonly correctionPreviewReady = signal(false);
  readonly correctionTypeOptions = CORRECTION_TYPE_OPTIONS;
  readonly correctionTypeLabel = correctionTypeLabel;
  readonly correctionStatusLabel = correctionStatusLabel;

  ngOnInit(): void {
    const range = this.currentWeekRange;
    this.historyFrom.set(range.from);
    this.historyTo.set(range.to);
    void this.store.loadToday();
    void this.store.loadMyHistory(range);
    if (this.store.loadMyCorrections) {
      void this.store.loadMyCorrections();
    }
  }

  applyHistoryRange(): void {
    const range = this.selectedRange();
    if (!range) {
      return;
    }

    if (this.viewMode() === 'team') {
      if (this.hasCoveredAccess()) {
        void this.store.loadCoveredHistory(range);
      }
      return;
    }

    void this.store.loadMyHistory(range);
  }

  selectViewMode(mode: AttendanceViewMode): void {
    this.viewMode.set(mode);
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;

    if (mode === 'team') {
      if (this.hasCoveredAccess()) {
        void this.store.loadCoveredHistory(range);
      }
      return;
    }

    void this.store.loadMyHistory(range);
  }

  retryToday(): void {
    void this.store.loadToday();
  }

  retryHistory(): void {
    this.applyHistoryRange();
  }

  goToHistoryPage(page: number): void {
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    void this.store.loadMyHistory(range, page);
  }

  goToCoveredHistoryPage(page: number): void {
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    void this.store.loadCoveredHistory(range, this.store.selectedCoveredEmployeeId() ?? undefined, page);
  }

  goToCorrectionsPage(page: number): void {
    void this.store.loadMyCorrections(page);
  }

  openCorrection(row: AttendanceHistoryRow): void {
    if (!row.canRequestCorrection) return;
    this.correctionFormOpen.set(row);
    this.correctionType.set('clock_in');
    this.requestedClockInTime.set(row.clockInAt ? this.localTimeForInput(row.clockInAt) : '');
    this.requestedClockOutTime.set(row.clockOutAt ? this.localTimeForInput(row.clockOutAt) : '');
    this.correctionReason.set('');
    this.correctionNotes.set('');
    this.correctionBreaks.set([{ start: '', end: '' }]);
    this.correctionFieldErrors.set({});
    this.correctionFormMessage.set('');
    this.correctionPreviewReady.set(false);
    this.store.clearCorrectionPreview?.();
  }

  closeCorrection(): void {
    if (!this.store.correctionActionLoading?.()) this.correctionFormOpen.set(null);
  }

  addBreakInterval(): void {
    this.correctionBreaks.update((items) => [...items, { start: '', end: '' }]);
  }

  removeBreakInterval(index: number): void {
    this.correctionBreaks.update((items) => items.length === 1 ? items : items.filter((_, itemIndex) => itemIndex !== index));
  }

  async previewOrSubmitCorrection(): Promise<void> {
    const request = this.buildCorrectionRequest();
    if (!request) return;
    if (!this.correctionPreviewReady()) {
      const preview = await this.store.previewCorrection(request);
      if (!preview) {
        this.correctionFormMessage.set(this.store.correctionError?.() || 'No eligible attendance approver is configured for this employee.');
        return;
      }
      this.correctionPreviewReady.set(true);
      this.correctionFormMessage.set(preview.approvalRequired
        ? preview.approver?.positionName
          ? `This request will be sent to ${preview.approver.displayName}, ${preview.approver.positionName}.`
          : preview.approver
            ? `This request will be sent to ${preview.approver.displayName}.`
            : 'No eligible attendance approver is configured for this employee.'
        : 'This correction can be applied without approval.');
      return;
    }

    if (this.store.correctionPreview?.()?.approvalRequired && !this.store.correctionPreview?.()?.approver) {
      this.correctionFormMessage.set('No eligible attendance approver is configured for this employee.');
      return;
    }
    const result = await this.store.submitCorrection(request);
    if (!result) {
      this.correctionFormMessage.set(this.store.correctionError?.() || 'Could not submit the correction request. Try again.');
      return;
    }
    this.notifications.success(result.status === 'approved' ? 'Attendance correction applied.' : 'Correction request submitted.');
    this.closeCorrection();
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    void this.store.loadToday();
    void this.store.loadMyHistory(range);
    void this.store.loadMyCorrections();
  }

  async cancelCorrection(id: string): Promise<void> {
    const result = await this.store.cancelCorrection(id);
    if (!result) return;
    this.notifications.success('Correction request cancelled.');
    void this.store.loadMyCorrections();
  }

  correctionActionIsLoading(action: string): boolean {
    return this.store.activeCorrectionAction?.() === action;
  }

  correctionSummary(request: AttendanceCorrectionResponse): string {
    if (request.correctionType === 'break') return `${request.requestedBreaks?.length ?? 0} interval(s)`;
    const clockIn = request.requestedClockInAt ? this.formatDateTime(request.requestedClockInAt, request.timezone) : null;
    const clockOut = request.requestedClockOutAt ? this.formatDateTime(request.requestedClockOutAt, request.timezone) : null;
    if (clockIn && clockOut) return `${clockIn} to ${clockOut}`;
    return clockIn || clockOut || 'Time update requested';
  }

  private buildCorrectionRequest(): AttendanceCorrectionPreviewRequest | null {
    const row = this.correctionFormOpen();
    if (!row) return null;
    const errors: Record<string, string> = {};
    const reason = this.correctionReason().trim();
    if (!reason) errors['reason'] = 'Tell us why this correction is needed.';
    if (reason.length > 255) errors['reason'] = 'Reason must be 255 characters or fewer.';
    if (this.correctionNotes().length > 2000) errors['notes'] = 'Notes must be 2000 characters or fewer.';
    const type = this.correctionType();
    const clockIn = type === 'clock_in' || type === 'full_day' ? this.toDateTimeOffset(this.requestedClockInTime(), row.workDate) : null;
    const clockOut = type === 'clock_out' || type === 'full_day' ? this.toDateTimeOffset(this.requestedClockOutTime(), row.workDate) : null;
    if (type === 'clock_in' || type === 'full_day') {
      if (!this.requestedClockInTime()) errors['requestedClockInAt'] = 'Enter a clock-in time.';
      else if (!clockIn) errors['requestedClockInAt'] = 'Enter a valid local time.';
    }
    if (type === 'clock_out' || type === 'full_day') {
      if (!this.requestedClockOutTime()) errors['requestedClockOutAt'] = 'Enter a clock-out time.';
      else if (!clockOut) errors['requestedClockOutAt'] = 'Enter a valid local time.';
    }
    if (clockIn && clockOut && new Date(clockOut).getTime() <= new Date(clockIn).getTime()) errors['requestedClockOutAt'] = 'Clock-out must be after clock-in.';
    let requestedBreaks: readonly AttendanceCorrectionBreakRequest[] | null = null;
    if (type === 'break') {
      const intervals = this.correctionBreaks().map((item) => ({
        start: this.toDateTimeOffset(item.start, row.workDate),
        end: this.toDateTimeOffset(item.end, row.workDate),
        rawStart: item.start,
        rawEnd: item.end
      }));
      if (!intervals.length || intervals.some((item) => !item.rawStart || !item.rawEnd || !item.start || !item.end)) {
        errors['requestedBreaks'] = 'Enter a valid start and end time for each break interval.';
      } else if (intervals.some((item) => new Date(item.end!).getTime() <= new Date(item.start!).getTime())) {
        errors['requestedBreaks'] = 'Each break interval must end after it starts.';
      } else {
        const ordered = [...intervals].sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime());
        if (ordered.some((item, index) => index > 0 && new Date(ordered[index - 1].end!).getTime() > new Date(item.start!).getTime())) errors['requestedBreaks'] = 'Break intervals cannot overlap.';
        requestedBreaks = intervals.map((item) => ({ breakStart: item.start!, breakEnd: item.end!, breakType: 'other' }));
      }
    }
    this.correctionFieldErrors.set(errors);
    this.correctionFormMessage.set(Object.keys(errors).length ? 'Please correct the highlighted fields.' : '');
    if (Object.keys(errors).length) return null;
    return {
      workDate: row.workDate,
      correctionType: type,
      requestedClockInAt: clockIn,
      requestedClockOutAt: clockOut,
      requestedBreaks,
      reason,
      notes: this.correctionNotes().trim() || null
    };
  }

  private toDateTimeOffset(value: string, workDate: string): string | null {
    if (!value || !/^\\d{2}:\\d{2}$/.test(value)) return null;
    try {
      const timezone = validDisplayTimezone(this.displayTimezone()) ?? DISPLAY_TIMEZONE_FALLBACK;
      const iso = localDateTimeToIso(workDate, value, timezone);
      return iso && dateOnlyForZone(iso, timezone) === workDate ? iso : null;
    } catch {
      return null;
    }
  }

  private localTimeForInput(value: string): string {
    try {
      const timezone = validDisplayTimezone(this.displayTimezone()) ?? DISPLAY_TIMEZONE_FALLBACK;
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(value));
      return `${parts.find((part) => part.type === 'hour')?.value ?? '00'}:${parts.find((part) => part.type === 'minute')?.value ?? '00'}`;
    } catch {
      return '';
    }
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

  statusLabel(value: string, backendLabel?: string | null): string {
    const label = backendLabel?.trim();
    if (label) {
      return label;
    }

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

  attentionClass(severity: string | null | undefined): string {
    const normalized = severity?.trim().toLowerCase();
    if (normalized === 'critical' || normalized === 'error') {
      return 'attention-banner attention-banner--critical';
    }
    if (normalized === 'warning') {
      return 'attention-banner attention-banner--warning';
    }
    return 'attention-banner attention-banner--neutral';
  }

  hasAttention(label: string | null | undefined): boolean {
    return !!label?.trim();
  }

  hasBreakOverage(value: number | null | undefined, isOverBreakAllowance = false): boolean {
    return isOverBreakAllowance || (value ?? 0) > 0;
  }

  breakOverageLabel(value: number | null | undefined): string {
    return `Break time exceeded by ${Math.max(0, value ?? 0)} min.`;
  }

  breakOverageHistoryLabel(value: number | null | undefined): string {
    return `Break exceeded by ${Math.max(0, value ?? 0)} min`;
  }

  private getFriendlyTodayMessages(today: AttendanceTodayResponse | null): readonly string[] {
    if (!today) {
      return [];
    }

    const attentionLabel = today.attentionLabel?.trim().toLowerCase();
    const messages = today.messages
      .map((message) => humanizeAttendanceMessage(message))
      .filter((message): message is string => !!message)
      .filter((message) => !attentionLabel || message.trim().toLowerCase() !== attentionLabel);

    if (!today.isWorkingDay && !today.isHoliday && !messages.some((message) => message.toLowerCase().includes('off day'))) {
      messages.push('Today is an off day.');
    }
    return messages;
  }
}

type CorrectionBreakDraft = { start: string; end: string };

function localDateTimeToIso(workDate: string, time: string, timezone: string): string | null {
  const [year, month, day] = workDate.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite) || hour > 23 || minute > 59) return null;
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(candidate);
    const shownHour = Number(parts.find((part) => part.type === 'hour')?.value);
    const shownMinute = Number(parts.find((part) => part.type === 'minute')?.value);
    const delta = ((shownHour * 60 + shownMinute) - (hour * 60 + minute)) * 60_000;
    if (!delta) return candidate.toISOString();
    candidate = new Date(candidate.getTime() - delta);
  }
  return candidate.toISOString();
}

function dateOnlyForZone(value: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
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
