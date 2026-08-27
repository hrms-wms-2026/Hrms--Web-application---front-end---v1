import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { CorrectionApprovalsComponent } from '../correction-approvals/correction-approvals.component';
import { WorkAreaApprovalsComponent } from '../work-area-approvals/work-area-approvals.component';
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
import { TimeTrackingAction, TimeTrackingStore } from '../../state/time-tracking.store';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DISPLAY_TIMEZONE_FALLBACK = 'UTC';
type AttendanceViewMode = 'my' | 'team';
type PersonalRequestTab = 'corrections' | 'work-area';

@Component({
  selector: 'app-time-tracking',
  standalone: true,
  imports: [BreadcrumbHeaderComponent, ButtonComponent, CorrectionApprovalsComponent, DateRangePickerComponent, FormsModule, ModalComponent, WorkAreaApprovalsComponent],
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

  readonly approvalType = computed<'corrections' | 'work-area'>(() =>
    this.queryParams().get('type') === 'work-area' ? 'work-area' : 'corrections'
  );

  readonly deepLinkRequestId = computed(() => this.queryParams().get('requestId'));
  readonly approvalBadgeCorrections = computed(() => this.store.approvalInbox().length);
  readonly approvalBadgeWorkArea = computed(() => this.store.workAreaApprovalInboxTotalCount());

  readonly selectedRequestTab = signal<PersonalRequestTab>('corrections');
  readonly historyFrom = signal('');
  readonly historyTo = signal('');
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
  readonly workAreaFormOpen = signal(false);
  readonly workAreaReviewReady = signal(false);
  readonly workAreaDate = signal('');
  readonly workAreaRequestedArea = signal<WorkArea>('remote');
  readonly workAreaReason = signal('');
  readonly workAreaFieldErrors = signal<Record<string, string>>({});
  readonly workAreaFormMessage = signal('');
  readonly workAreaCancelRequestId = signal<string | null>(null);
  readonly workAreaOptions = WORK_AREA_OPTIONS;
  readonly workAreaChangeStatusLabel = workAreaChangeStatusLabel;
  readonly workAreaLabel = workAreaLabel;
  readonly correctionTypeOptions = CORRECTION_TYPE_OPTIONS;
  readonly correctionTypeLabel = correctionTypeLabel;
  readonly correctionStatusLabel = correctionStatusLabel;

  /**
   * Per-activation dedupe keys for the team-loading effect below. These are plain
   * component fields (never signals), read and written only inside that effect, so the
   * effect's decision to fetch never depends on anything the fetch itself writes back to
   * the store - that reactive read-your-own-write shape is what caused a runaway
   * covered-history request loop before this guard was added. Each key resets only when
   * Team view is no longer active, so at most one request is issued per distinct
   * range/type activation, no matter how many unrelated signal changes cause this effect
   * to re-run. Team attendance and Approvals load independently of each other - both are
   * shown together (see the template), never behind a toggle - but only the active
   * approval type (corrections vs work-area) loads within Approvals.
   */
  private teamAttendanceRangeKey: string | null = null;
  private attemptedApprovalType: 'corrections' | 'work-area' | null = null;

  constructor() {
    effect(() => {
      if (this.viewMode() !== 'team') {
        this.teamAttendanceRangeKey = null;
        this.attemptedApprovalType = null;
        return;
      }

      if (this.canViewCoveredEmployees()) {
        const range = untracked(() => this.store.selectedHistoryRange()) ?? this.currentWeekRange;
        const key = `${range.from}:${range.to}`;
        if (this.teamAttendanceRangeKey !== key) {
          this.teamAttendanceRangeKey = key;
          void this.store.loadCoveredHistory(range);
        }
      } else {
        this.teamAttendanceRangeKey = null;
      }

      if (this.hasApproveAccess()) {
        const type = this.approvalType();
        if (this.attemptedApprovalType !== type) {
          this.attemptedApprovalType = type;
          if (type === 'corrections' && !this.store.approvalInboxLoaded()) {
            void this.store.loadApprovalInbox();
          }
          if (type === 'work-area' && !this.store.workAreaApprovalInboxLoaded()) {
            void this.store.loadWorkAreaApprovalInbox({ status: 'pending', pageNumber: 1 });
          }
        }
      } else {
        this.attemptedApprovalType = null;
      }
    });
  }

  ngOnInit(): void {
    const range = this.currentWeekRange;
    this.historyFrom.set(range.from);
    this.historyTo.set(range.to);
    if (this.hasSelfServiceAccess() || this.hasCoveredAccess()) {
      void this.store.loadToday();
    }
    if (this.hasSelfServiceAccess()) {
      void this.store.loadMyHistory(range);
      this.ensureRequestTabLoaded(this.selectedRequestTab());
    }
  }

  selectRequestTab(tab: PersonalRequestTab): void {
    this.selectedRequestTab.set(tab);
    this.ensureRequestTabLoaded(tab);
  }

  private ensureRequestTabLoaded(tab: PersonalRequestTab): void {
    if (tab === 'corrections') {
      if (!this.store.myCorrectionsLoaded?.() && this.store.loadMyCorrections) {
        void this.store.loadMyCorrections();
      }
      return;
    }
    if (!this.store.myWorkAreaRequestsLoaded()) {
      void this.store.loadMyWorkAreaRequests({ pageNumber: 1 });
    }
  }

  onRangeSelected(range: TimeTrackingRange): void {
    this.historyFrom.set(range.from);
    this.historyTo.set(range.to);
    this.loadForCurrentView(range);
  }

  private loadForCurrentView(range: TimeTrackingRange): void {
    if (this.viewMode() === 'team') {
      if (this.canViewCoveredEmployees()) {
        void this.store.loadCoveredHistory(range);
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
    this.navigateState({ view: 'team', type: this.hasApproveAccess() ? this.approvalType() : null, requestId: null });
  }

  selectApprovalType(type: 'corrections' | 'work-area'): void {
    this.navigateState({ view: 'team', type, requestId: null });
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

  goToCorrectionsPage(page: number): void {
    void this.store.loadMyCorrections(page);
  }

  goToWorkAreaRequestsPage(page: number): void {
    void this.store.loadMyWorkAreaRequests({ pageNumber: page });
  }

  openWorkAreaChange(): void {
    this.workAreaFormOpen.set(true);
    this.workAreaReviewReady.set(false);
    this.workAreaDate.set(this.store.today()?.workDate ?? '');
    this.workAreaRequestedArea.set('remote');
    this.workAreaReason.set('');
    this.workAreaFieldErrors.set({});
    this.workAreaFormMessage.set('');
    this.store.clearWorkAreaPreview();
  }

  closeWorkAreaChange(): void {
    if (this.store.workAreaPreviewLoading() || this.store.workAreaActionLoading()) return;
    this.workAreaFormOpen.set(false);
    this.workAreaReviewReady.set(false);
    this.workAreaFieldErrors.set({});
    this.workAreaFormMessage.set('');
    this.store.clearWorkAreaPreview();
  }

  resetWorkAreaReview(): void {
    this.workAreaReviewReady.set(false);
    this.store.clearWorkAreaPreview();
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

  requestCancelWorkArea(id: string): void {
    if (this.store.myWorkAreaRequests().find((request) => request.id === id)?.status === 'pending') {
      this.workAreaCancelRequestId.set(id);
    }
  }

  closeCancelWorkArea(): void {
    if (!this.store.workAreaActionLoading()) this.workAreaCancelRequestId.set(null);
  }

  async confirmCancelWorkArea(): Promise<void> {
    const id = this.workAreaCancelRequestId();
    if (!id) return;
    const result = await this.store.cancelWorkAreaChangeRequest(id);
    if (result) {
      this.workAreaCancelRequestId.set(null);
      void this.store.loadMyWorkAreaRequests({ pageNumber: this.store.myWorkAreaRequestsPage() });
    }
  }

  workAreaActionIsLoading(id: string): boolean {
    return this.store.activeWorkAreaRequestId() === id;
  }

  formatWorkAreaDate(value: string, timezone: string | null | undefined): string {
    const displayTimezone = validDisplayTimezone(timezone);
    if (!displayTimezone || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return this.formatDate(value);
    const [year, month, day] = value.split('-').map(Number);
    try {
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: displayTimezone }).format(new Date(Date.UTC(year, month - 1, day, 12)));
    } catch {
      return this.formatDate(value);
    }
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
    if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
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
    if (this.canViewCoveredEmployees()) {
      void this.store.loadCoveredHistory(range, this.store.selectedCoveredEmployeeId() ?? undefined);
    }
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Date unavailable';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return 'Date unavailable';
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
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
