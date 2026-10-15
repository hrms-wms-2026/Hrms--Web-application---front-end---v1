import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { AttendanceDetailDrawerComponent, AttendanceDetailSelection } from './attendance-detail-drawer/attendance-detail-drawer.component';
import { AttendanceStatusCardComponent } from '../status-card/attendance-status-card.component';
import { AttendanceTodayTimelineComponent } from './today-timeline/attendance-today-timeline.component';
import { AttendanceHistoryListComponent } from './attendance-history-list/attendance-history-list.component';
import { MyRequestsPanelComponent } from './my-requests-panel/my-requests-panel.component';
import { NotificationService } from '../../../../core/services/notification.service';
import {
  AttendanceCorrectionBreakRequest,
  AttendanceCorrectionPreviewRequest,
  AttendanceCorrectionType,
  CORRECTION_TYPE_OPTIONS
} from '../../models/attendance-correction.model';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DateRangePickerComponent } from '../../../../shared/ui/date-range-picker/date-range-picker.component';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { isMachineValue } from '../../../../core/services/error-handler.service';
import { AttendanceHistoryRow, AttendanceTodayResponse, TimeTrackingRange } from '../../models/time-tracking.model';
import {
  WorkArea,
  WorkAreaChangeRequestPayload,
  WORK_AREA_OPTIONS,
  workAreaChangeStatusLabel,
  workAreaLabel
} from '../../models/work-area-change-request.model';
import { TIME_TRACKING_COVERED_FORBIDDEN_ERROR, TimeTrackingStore } from '../../state/time-tracking.store';
import {
  DISPLAY_TIMEZONE_FALLBACK as SHARED_DISPLAY_TIMEZONE_FALLBACK,
  formatDate as formatDateShared,
  formatDateTime as formatDateTimeShared,
  formatMinutes as formatMinutesShared,
  formatWorkAreaDate as formatWorkAreaDateShared,
  sourceLabel as sourceLabelShared,
  validDisplayTimezone as validDisplayTimezoneShared,
  workModeLabel as workModeLabelShared
} from '../../utils/attendance-formatters';

import { AttendanceCorrectionModalComponent } from '../../ui/attendance-correction-modal/attendance-correction-modal.component';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
type AttendanceViewMode = 'my' | 'team';

@Component({
  selector: 'app-time-tracking',
  standalone: true,
  imports: [AttendanceCorrectionModalComponent, AttendanceDetailDrawerComponent, AttendanceHistoryListComponent, AttendanceStatusCardComponent, AttendanceTodayTimelineComponent, BreadcrumbHeaderComponent, ButtonComponent, DatePickerComponent, DateRangePickerComponent, FormsModule, ModalComponent, MyRequestsPanelComponent, PopoverComponent, RouterLink],
  templateUrl: './time-tracking.component.html',
  styleUrl: './time-tracking.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeTrackingComponent implements OnInit {
  readonly store = inject(TimeTrackingStore);
  private readonly permissionService = inject(PermissionService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

    readonly Math = Math;
  readonly TIME_TRACKING_COVERED_FORBIDDEN_ERROR = TIME_TRACKING_COVERED_FORBIDDEN_ERROR;
  private readonly queryParams = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  readonly hasSelfServiceAccess = computed(() => this.permissionService.hasAnyPermission(['attendance:read-own', 'attendance:write-own']));
  readonly hasCoveredAccess = computed(() => this.permissionService.hasPermission('attendance:read'));
  readonly hasApproveAccess = computed(() => this.permissionService.hasPermission('attendance:approve'));
  /**
   * attendance:read (hasCoveredAccess) is a universal permission granted to every
   * employee, same as the self-service permissions - it is not a signal that this
   * person manages anyone, and attendance:approve without real coverage does not occur
   * in this product's data model (an approver is always someone's covered manager).
   * Team view is therefore gated purely on Today.canViewCoveredEmployees.
   */
  readonly canShowTeamView = computed(() => this.canViewCoveredEmployees());

  readonly viewMode = computed<AttendanceViewMode>(() => {
    const requested = this.queryParams().get('view');
    if (requested === 'team' && this.canShowTeamView()) return 'team';
    if (requested === 'my' && this.hasSelfServiceAccess()) return 'my';
    if (this.hasSelfServiceAccess()) return 'my';
    if (this.canShowTeamView()) return 'team';
    return 'my';
  });

  readonly deepLinkRequestId = computed(() => this.queryParams().get('requestId'));
  /** Set by the employee profile's "View attendance" link to narrow Team attendance to one person. */
  readonly deepLinkEmployeeId = computed(() => this.queryParams().get('employeeId')?.trim() || null);
  private readonly deepLinkRange = computed<TimeTrackingRange | null>(() => {
    const from = this.queryParams().get('from');
    const to = this.queryParams().get('to');
    const isDate = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
    return isDate(from) && isDate(to) && from <= to ? { from, to } : null;
  });

  readonly historyFrom = signal('');
  readonly historyTo = signal('');
  readonly todayDateString = computed(() => this.store.today()?.workDate || toDateOnly(new Date()));
  readonly currentWeekRange = currentWeekRange();
  readonly selectedDetail = signal<AttendanceDetailSelection | null>(null);
  readonly selectedDetailSummary = signal<AttendanceHistoryRow | null>(null);
  /** History rows have no timezone field, so use Today.timezone for the selected company.
   * UTC is an explicit display-only fallback until Today is available; it is never the browser timezone. */
  readonly displayTimezone = computed(() => this.store.today()?.timezone?.trim() || SHARED_DISPLAY_TIMEZONE_FALLBACK);
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
  readonly workAreaFormOpen = signal(false);
  readonly workAreaReviewReady = signal(false);
  readonly workAreaDate = signal('');
  readonly workAreaRequestedArea = signal<WorkArea>('remote');
  readonly workAreaReason = signal('');
  readonly workAreaFieldErrors = signal<Record<string, string>>({});
  readonly workAreaFormMessage = signal('');

  readonly workAreaOptions = WORK_AREA_OPTIONS;
  readonly workAreaChangeStatusLabel = workAreaChangeStatusLabel;
  readonly workAreaLabel = workAreaLabel;
  readonly correctionTypeOptions = CORRECTION_TYPE_OPTIONS;

  /**
   * Per-activation dedupe key for the team-loading effect below. A plain component field (never a signal), read and
   * written only inside that effect, so the effect's decision to fetch never depends on anything the fetch itself
   * writes back to the store - that reactive read-your-own-write shape is what caused a runaway covered-history
   * request loop before this guard was added. It resets only when Team view is no longer active, so at most one
   * request is issued per distinct range activation. Attendance requests are reviewed in the Inbox, not here.
   */
  private teamAttendanceRangeKey: string | null = null;

  constructor() {
    effect(() => {
      if (this.viewMode() !== 'team') {
        this.teamAttendanceRangeKey = null;
        return;
      }

      if (this.canViewCoveredEmployees()) {
        const employeeId = this.deepLinkEmployeeId();
        const range = this.deepLinkRange() ?? untracked(() => this.store.selectedHistoryRange()) ?? this.currentWeekRange;
        const key = `${range.from}:${range.to}:${employeeId ?? ''}`;
        if (this.teamAttendanceRangeKey !== key) {
          this.teamAttendanceRangeKey = key;
          void this.store.loadCoveredHistory(range, employeeId ?? undefined);
        }
      } else {
        this.teamAttendanceRangeKey = null;
      }
    });
  }

  ngOnInit(): void {
    const range = this.deepLinkRange() ?? this.currentWeekRange;
    this.historyFrom.set(range.from);
    this.historyTo.set(range.to);
    if (this.hasSelfServiceAccess() || this.hasCoveredAccess()) {
      void this.store.loadToday().then(() => {
        const today = this.store.today();
        if (today) {
          if (this.historyTo() > today.workDate) {
            this.historyTo.set(today.workDate);
            if (this.historyFrom() > today.workDate) {
              this.historyFrom.set(today.workDate);
            }
          }
          void this.store.loadTodayTimeline(today.employeeId, today.workDate);
        }
        if (today && this.hasSelfServiceAccess() && this.queryParams().get('openCorrection') === 'today') {
          this.openTodayCorrection();
        }
      });
    }
    if (this.hasSelfServiceAccess()) {
      void this.store.loadMyHistory(range);
    }
  }

  /** Entry point for Overview's "New request"/"Request correction" links, which have no
   * specific day-row to click - opens the same correction form pre-set to today. */
  openTodayCorrection(): void {
    const workDate = this.store.today()?.workDate;
    if (!workDate) return;
    const syntheticRow: AttendanceHistoryRow = {
      attendanceRecordId: '',
      workDate,
      employee: null,
      clockInAt: null,
      clockOutAt: null,
      isActive: true,
      breakMinutes: 0,
      totalWorkedMinutes: 0,
      expectedWorkMode: null,
      attendanceSource: null,
      status: '',
      canViewDetails: false,
      canRequestCorrection: true,
      canRequestWorkAreaChange: false,
      canCorrect: false
    };
    this.openCorrection(syntheticRow);
  }



  onRangeSelected(range: TimeTrackingRange): void {
    const max = this.todayDateString();
    let { from, to } = range;
    if (max && to > max) to = max;
    if (max && from > max) from = max;
    if (from > to) from = to;
    const safeRange = { from, to };
    this.historyFrom.set(safeRange.from);
    this.historyTo.set(safeRange.to);
    this.loadForCurrentView(safeRange);
  }

  private loadForCurrentView(range: TimeTrackingRange): void {
    if (this.viewMode() === 'team') {
      if (this.canViewCoveredEmployees()) {
        void this.store.loadCoveredHistory(range, this.deepLinkEmployeeId() ?? undefined);
      }
      return;
    }

    void this.store.loadMyHistory(range);
  }

  selectViewMode(mode: AttendanceViewMode): void {
    if (mode === 'my') {
      this.navigateState({ view: null, type: null, requestId: null });
      return;
    }
    this.navigateState({ view: 'team', type: null, requestId: null });
  }

  /** Drops the profile deep-link's employee filter, keeping whatever range is currently picked. */
  clearEmployeeFilter(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { employeeId: null, from: this.historyFrom() || null, to: this.historyTo() || null },
      queryParamsHandling: 'merge'
    });
  }

  private navigateState(params: { view: string | null; type: string | null; requestId: string | null }): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge' });
  }

  retryToday(): void {
    void this.store.loadToday();
  }

  retryHistory(): void {
    this.loadForCurrentView({ from: this.historyFrom(), to: this.historyTo() });
  }

  goToHistoryPage(page: number): void {
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    void this.store.loadMyHistory(range, page);
  }

    goToCoveredHistoryPage(page: number): void {
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    void this.store.loadCoveredHistory(range, this.store.selectedCoveredEmployeeId() ?? undefined, page);
  }

  onMyRowSelected(row: AttendanceHistoryRow): void {
    const employeeId = this.store.today()?.employeeId;
    if (!employeeId) return;
    this.selectedDetailSummary.set(row);
    this.selectedDetail.set({ employeeId, workDate: row.workDate });
  }

  onTeamRowSelected(row: AttendanceHistoryRow): void {
    if (!row.employee) return;
    this.selectedDetailSummary.set(row);
    this.selectedDetail.set({ employeeId: row.employee.employeeId, workDate: row.workDate });
  }

  closeDetailDrawer(): void {
    this.selectedDetail.set(null);
    this.selectedDetailSummary.set(null);
    this.store.clearDayDetail();
  }



  readonly requestDropdownOpen = signal(false);

  toggleRequestDropdown(): void {
    this.requestDropdownOpen.update((open) => !open);
  }

  closeRequestDropdown(): void {
    this.requestDropdownOpen.set(false);
  }

  selectAttendanceCorrection(): void {
    this.closeRequestDropdown();
    this.openTodayCorrection();
  }

  selectWorkAreaChange(): void {
    this.closeRequestDropdown();
    this.openWorkAreaChange();
  }

  openWorkAreaChange(): void {
    this.workAreaFormOpen.set(true);
    this.workAreaReviewReady.set(false);
    this.workAreaDate.set(this.store.today()?.workDate ?? '');
    this.workAreaRequestedArea.set('remote');
    this.workAreaReason.set('');
    this.workAreaFieldErrors.set({});
    this.workAreaFormMessage.set('');
    this.store.clearWorkAreaPreview?.();
  }

  closeWorkAreaChange(): void {
    if (this.store.workAreaPreviewLoading?.() || this.store.workAreaActionLoading?.()) return;
    this.workAreaFormOpen.set(false);
    this.workAreaReviewReady.set(false);
    this.workAreaFieldErrors.set({});
    this.workAreaFormMessage.set('');
    this.store.clearWorkAreaPreview?.();
  }

  resetWorkAreaReview(): void {
    this.workAreaReviewReady.set(false);
    this.store.clearWorkAreaPreview?.();
  }

  async previewOrSubmitWorkAreaChange(): Promise<void> {
    const payload = this.buildWorkAreaRequest();
    if (!payload) return;
    if (!this.workAreaReviewReady()) {
      const preview = await this.store.previewWorkAreaChange(payload);
      if (!preview) {
        this.workAreaFormMessage.set(this.store.workAreaPreviewError() || 'We could not review this request. Try again.');
        return;
      }
      this.workAreaReviewReady.set(true);
      this.workAreaFormMessage.set('Review the request details before sending.');
      return;
    }

    const result = await this.store.submitWorkAreaChangeRequest(payload);
    if (!result) {
      this.workAreaFormMessage.set(this.store.workAreaCreateError() || 'Could not send the work-area change request. Try again.');
      return;
    }
    this.closeWorkAreaChange();
    void this.store.loadMyWorkAreaRequests({ pageNumber: 1 });
    void this.store.loadToday();
  }



  formatWorkAreaDate(value: string, timezone: string | null | undefined): string {
    return formatWorkAreaDateShared(value, timezone);
  }

  private buildWorkAreaRequest(): WorkAreaChangeRequestPayload | null {
    const date = this.workAreaDate().trim();
    const reason = this.workAreaReason().trim();
    const errors: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors['date'] = 'Choose a request date.';
    const today = this.store.today?.();
    if (today && date && date < today.workDate) errors['date'] = 'Choose today or a future date.';
    if (!this.workAreaRequestedArea()) errors['requestedWorkArea'] = 'Choose On-site or Remote.';
    if (!reason) errors['reason'] = 'Enter a reason for the request.';
    this.workAreaFieldErrors.set(errors);
    this.workAreaFormMessage.set(Object.keys(errors).length ? 'Please correct the highlighted fields.' : '');
    if (Object.keys(errors).length) return null;
    return { date, requestedWorkArea: this.workAreaRequestedArea(), reason };
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

  onCorrectionSubmitted(): void {
    this.closeCorrection();
    this.closeDetailDrawer();
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    void this.store.loadToday();
    void this.store.loadMyHistory(range);
    void this.store.loadMyCorrections();
  }

  /**
   * One-click entry point from the missing-clock-out banner: opens the same correction
   * form used everywhere else, pre-set to a clock-out correction for the specific stale day
   * (that day has no attendance history row on screen to click "Request correction" from -
   * it's surfaced only via Today's attention fields).
   */
  openMissingClockOutCorrection(workDate: string): void {
    const syntheticRow: AttendanceHistoryRow = {
      attendanceRecordId: '',
      workDate,
      employee: null,
      clockInAt: null,
      clockOutAt: null,
      isActive: true,
      breakMinutes: 0,
      totalWorkedMinutes: 0,
      expectedWorkMode: null,
      attendanceSource: null,
      status: 'missing_clock_out',
      canViewDetails: false,
      canRequestCorrection: true,
      canRequestWorkAreaChange: false,
      canCorrect: false
    };
    this.openCorrection(syntheticRow);
    this.correctionType.set('clock_out');
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
    this.closeDetailDrawer();
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    void this.store.loadToday();
    void this.store.loadMyHistory(range);
    void this.store.loadMyCorrections();
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
    if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
    try {
      const timezone = validDisplayTimezoneShared(this.displayTimezone()) ?? SHARED_DISPLAY_TIMEZONE_FALLBACK;
      const iso = localDateTimeToIso(workDate, value, timezone);
      return iso && dateOnlyForZone(iso, timezone) === workDate ? iso : null;
    } catch {
      return null;
    }
  }

  private localTimeForInput(value: string): string {
    try {
      const timezone = validDisplayTimezoneShared(this.displayTimezone()) ?? SHARED_DISPLAY_TIMEZONE_FALLBACK;
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(value));
      return `${parts.find((part) => part.type === 'hour')?.value ?? '00'}:${parts.find((part) => part.type === 'minute')?.value ?? '00'}`;
    } catch {
      return '';
    }
  }

  retryCoveredHistory(): void {
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    if (this.canViewCoveredEmployees()) {
      void this.store.loadCoveredHistory(range, this.store.selectedCoveredEmployeeId() ?? undefined);
    }
  }

  workModeLabel(value: string | null): string {
    return workModeLabelShared(value);
  }

  sourceLabel(value: string | null): string {
    return sourceLabelShared(value);
  }

  formatDate(value: string): string {
    return formatDateShared(value);
  }

  formatDateTime(value: string | null, timezone?: string | null): string {
    return formatDateTimeShared(value, timezone);
  }

  formatMinutes(value: number | null): string {
    return formatMinutesShared(value);
  }

  remainingWorkLabel(today: AttendanceTodayResponse): string {
    if (!today.requiredWorkMinutes) return 'Not scheduled';
    return formatMinutesShared(Math.max(0, today.requiredWorkMinutes - today.totalWorkedMinutes));
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

  hasAttention(todayOrLabel: AttendanceTodayResponse | string | null | undefined): boolean {
    if (!todayOrLabel) {
      return false;
    }
    if (typeof todayOrLabel === 'string') {
      const trimmed = todayOrLabel.trim();
      if (!trimmed) return false;
      return !trimmed.toLowerCase().includes('break');
    }
    const today = todayOrLabel;
    if (!today.attentionLabel?.trim()) {
      return false;
    }
    // Break overage is already alerted directly above in the status card meta
    // (with overage minutes, allowance/used metrics, and status pill).
    if (
      today.attentionType === 'over_break' ||
      !!today.isOverBreakAllowance ||
      (today.breakOverageMinutes ?? 0) > 0 ||
      today.attentionLabel.toLowerCase().includes('break')
    ) {
      return false;
    }
    return true;
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

function currentWeekRange(reference = new Date(), maxDate?: string): TimeTrackingRange {
  const referenceDay = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const dayOfWeek = referenceDay.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(referenceDay.getTime() + mondayOffset * DAY_IN_MILLISECONDS);
  const sunday = new Date(monday.getTime() + 6 * DAY_IN_MILLISECONDS);
  let from = toDateOnly(monday);
  let to = toDateOnly(sunday);
  const effectiveMax = maxDate || toDateOnly(referenceDay);
  if (to > effectiveMax) {
    to = effectiveMax;
  }
  if (from > to) {
    from = to;
  }
  return { from, to };
}

function toDateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
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

