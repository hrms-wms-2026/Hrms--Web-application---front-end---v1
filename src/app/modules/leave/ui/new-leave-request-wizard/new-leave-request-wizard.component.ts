/**
 * New leave request: one form (type chips, From/To, Full Day / Half Day / Custom Hours, reason, document) whose
 * hours, balance after, and policy warnings preview as soon as the dates are valid.
 */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, effect, signal, untracked, OnChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { TimePickerComponent } from '../../../../shared/ui/time-picker/time-picker.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { PersonPickerDialogComponent } from '../../../../shared/ui/person-picker-dialog/person-picker-dialog.component';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveRequestResponse, LeaveUploadedDocument, SubmitLeaveRequestOnBehalfRequest, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { toLeaveSubmitDateTimes } from '../../utils/leave-request-datetime';
import { formatHours as hoursLabel } from '../../utils/leave-amount';
import { LeaveTypeIconComponent } from '../leave-type-icon/leave-type-icon.component';
import { dateRange, validationMessage } from '../../../../shared/utils/validators';
import { LEAVE_REQUEST_LIMITS } from '../../utils/leave-limits';

/** Full Day uses the work window, Half Day one half of it on a single date, Custom Hours the times picked. */
export type LeaveDurationMode = 'full' | 'half' | 'custom';
export type LeaveHalf = 'first' | 'second';

/**
 * The two halves of a work day, each half of the working hours: "09:00"-"18:00" with a 60 min break gives
 * 09:00-13:00 and 14:00-18:00, so the break sits between them. Leave is charged by the hours a request
 * covers, so splitting at the clock midpoint (13:30) would charge 4.5 h for each half of an 8 h day.
 */
export function halfDayWindows(start: string, end: string, breakMinutes: number | null): { first: [string, string]; second: [string, string] } {
  const toMinutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  };
  const toTime = (minutes: number) => {
    const day = ((minutes % 1440) + 1440) % 1440;
    return `${String(Math.floor(day / 60)).padStart(2, '0')}:${String(day % 60).padStart(2, '0')}`;
  };
  const from = toMinutes(start);
  let to = toMinutes(end);
  if (to <= from) to += 24 * 60;
  const half = Math.round(Math.max(0, to - from - (breakMinutes ?? 0)) / 2);
  return { first: [start, toTime(from + half)], second: [toTime(to - half), end] };
}

/** Chips shown for leave types before the rest go into the "more" dropdown. */
const TYPE_CHIP_LIMIT = 3;

export interface LeaveRequestDraft {
  leaveTypeId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  reason: string | null;
}

function emptyDraft(): LeaveRequestDraft {
  return { leaveTypeId: '', startDate: '', startTime: '', endDate: '', endTime: '', reason: null };
}

@Component({
  selector: 'app-new-leave-request-wizard',
  standalone: true,
  imports: [CommonModule, LeaveTypeIconComponent, ModalComponent, DatePickerComponent, TimePickerComponent, PersonPickerDialogComponent, SelectComponent, InputComponent, ButtonComponent],
  templateUrl: './new-leave-request-wizard.component.html',
  styleUrl: './new-leave-request-wizard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewLeaveRequestWizardComponent implements OnChanges, OnInit {
  @Input({ required: true }) open = false;
  @Input({ required: true }) leaveTypes: readonly LeaveTypeResponse[] = [];
  @Input({ required: true }) balances: readonly LeaveBalanceResponse[] = [];
  @Input() initialStartDate = '';
  /** Planner create popover ("More options" on the Time off tab): the rest of what the tab held. */
  @Input() initialLeaveTypeId = '';
  @Input() initialStartTime = '';
  @Input() initialEndTime = '';
  @Input() initialReason = '';
  @Input() initialEndDate = '';
  @Input() workStartTime: string | null = null;
  @Input() workEndTime: string | null = null;
  @Input() timezone: string | null = null;
  /** The work day's break, so Half Day leaves it between the two halves. */
  @Input() breakMinutes: number | null = null;
  @Input() onBehalf = false;
  @Input() previewing = false;
  @Input() previewResult: LeaveRequestResponse | null = null;
  @Input() previewError: string | null = null;
  @Input() submitting = false;
  @Input() submitError: string | null = null;
  @Input() uploadedDocuments: readonly LeaveUploadedDocument[] = [];
  @Input() uploadingDocument = false;
  @Input() documentUploadError: string | null = null;
  @Output() previewRequested = new EventEmitter<SubmitLeaveRequestRequest>();
  @Output() submitRequested = new EventEmitter<SubmitLeaveRequestRequest | SubmitLeaveRequestOnBehalfRequest>();
  @Output() documentSelected = new EventEmitter<File>();
  @Output() documentRemoved = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  readonly draft = signal<LeaveRequestDraft>(emptyDraft());
  readonly duration = signal<LeaveDurationMode>('full');
  readonly half = signal<LeaveHalf>('first');
  readonly employeeId = signal<string | null>(null);
  readonly pickerOpen = signal(false);
  /** "24 h" for the over-balance warning. */
  readonly hoursLabel = hoursLabel;

  readonly reasonMaxLength = LEAVE_REQUEST_LIMITS.reasonMax;

  /** Type + range + documents last sent for preview, so editing the reason doesn't re-run it. */
  private lastPreviewKey = '';
  /** The attached file ids as a signal: the preview effect can't see an @Input, and a required document fails preview until one is attached. */
  private readonly documentKey = signal('');

  constructor() {
    // Preview (total, balance, notice and conflict warnings) as soon as the type and dates are valid.
    effect(() => {
      const d = this.draft();
      const documents = this.documentKey();
      if (!d.leaveTypeId || this.dateRangeHint() !== null) return;
      const payload = this.toSubmitPayload();
      if (!payload) return;
      const key = `${payload.leaveTypeId}|${payload.startAt}|${payload.endAt}|${documents}`;
      if (key === this.lastPreviewKey) return;
      this.lastPreviewKey = key;
      untracked(() => this.previewRequested.emit(payload));
    });
  }

  /** Leave type dropdown options with each type's remaining balance; rebuilt when the inputs change. */
  leaveTypeOptions: readonly SelectOption[] = [];

  ngOnChanges(): void {
    this.documentKey.set(this.uploadedDocuments.map((doc) => doc.id).join(','));
    this.leaveTypeOptions = [
      ...this.activeLeaveTypes()
        .slice(TYPE_CHIP_LIMIT)
        .map((type) => {
          const remaining = this.remainingHoursFor(type.id);
          return { value: type.id, label: remaining == null ? type.name : `${type.name} - ${remaining} hours remaining` };
        })
    ];
  }

  ngOnInit(): void {
    this.draft.update((d) => ({
      ...d,
      leaveTypeId: this.initialLeaveTypeId || d.leaveTypeId,
      startDate: this.initialStartDate || d.startDate,
      startTime: this.initialStartTime || d.startTime,
      endDate: this.initialEndDate || d.endDate,
      endTime: this.initialEndTime || d.endTime,
      reason: this.initialReason || d.reason
    }));
  }

  // Plain methods, not computed(): these read @Input()s, which a computed would cache at their first (empty) value.
  activeLeaveTypes(): LeaveTypeResponse[] {
    return (this.leaveTypes as LeaveTypeResponse[]).filter((type) => type.isActive);
  }

  /** The first few types, as chips; the rest are in the dropdown next to them. */
  chipLeaveTypes(): LeaveTypeResponse[] {
    return this.activeLeaveTypes().slice(0, TYPE_CHIP_LIMIT);
  }

  /** Full and Half Day are worked out from the work window, so they need it; Custom Hours does not. */
  workWindowMissing(): boolean {
    return this.duration() !== 'custom' && (!this.workStartTime || !this.workEndTime);
  }

  halfWindows(): { first: [string, string]; second: [string, string] } | null {
    return this.workStartTime && this.workEndTime ? halfDayWindows(this.workStartTime, this.workEndTime, this.breakMinutes) : null;
  }

  /** Who decides: the first approver from the preview, once known. */
  approverNote(): string {
    const first = this.previewResult?.approvers.find((approver) => approver.sequenceOrder === 1) ?? this.previewResult?.approvers[0];
    return first ? `This request will be sent to ${first.approverName} for approval.` : 'This request will be sent to your manager for approval.';
  }

  onDurationChange(mode: LeaveDurationMode): void {
    this.duration.set(mode);
    // Half Day is half of one day: the leave ends on the date it starts.
    if (mode === 'half') this.draft.update((d) => ({ ...d, endDate: d.startDate }));
  }

  /** The draft with the times the duration mode stands for. */
  private resolvedDraft(): LeaveRequestDraft {
    const d = this.draft();
    const mode = this.duration();
    if (mode === 'custom') return d;
    const start = this.workStartTime ?? '';
    const end = this.workEndTime ?? '';
    if (mode === 'full' || !start || !end) return { ...d, startTime: start, endTime: end };
    const halves = halfDayWindows(start, end, this.breakMinutes);
    const [startTime, endTime] = this.half() === 'first' ? halves.first : halves.second;
    return { ...d, endDate: d.startDate, startTime, endTime };
  }

  remainingHoursFor(leaveTypeId: string): number | null {
    const balance = (this.balances as LeaveBalanceResponse[]).find((b) => b.leaveTypeId === leaveTypeId);
    return balance ? balance.remainingHours : null;
  }

  selectedLeaveType(): LeaveTypeResponse | undefined {
    return this.activeLeaveTypes().find((type) => type.id === this.draft().leaveTypeId);
  }

  selectedLeaveTypeName(): string {
    return this.selectedLeaveType()?.name ?? '';
  }

  /** The leave type's document rule. With an hours limit it stays required until the preview shows the request is within it. */
  documentRequired(): boolean {
    const type = this.selectedLeaveType();
    if (!type?.requiresDocument) return false;
    const after = type.documentRequiredAfterHours;
    return after == null || !this.previewResult || this.previewResult.totalHours > after;
  }

  onLeaveTypeChange(leaveTypeId: string): void {
    this.draft.update((d) => ({ ...d, leaveTypeId }));
  }

  onEmployeePicked(id: string): void {
    this.employeeId.set(id);
    this.pickerOpen.set(false);
  }

  /** Why Submit is disabled by the dates, so the user isn't left guessing. */
  dateRangeHint(): string | null {
    const d = this.draft();
    if (this.workWindowMissing()) return null;
    if (!d.startDate) return 'Choose the date your leave starts.';
    if (!d.endDate) return 'Choose the date your leave ends.';
    const rangeError = dateRange(d.startDate, d.endDate);
    if (rangeError) return validationMessage(rangeError, 'Dates');
    const payload = this.toSubmitPayload();
    if (!payload) return 'Choose valid start and end times.';
    if (payload.endAt <= payload.startAt) return 'The end must be after the start.';
    return null;
  }

  onStartDateChange(startDate: string): void {
    // Most leave is a single day or a forward range: keep To in step so it's never left behind.
    const halfDay = this.duration() === 'half';
    this.draft.update((d) => ({ ...d, startDate, endDate: halfDay || !d.endDate || d.endDate < startDate ? startDate : d.endDate }));
  }

  /** Submit needs a complete form and a clean preview of the current range. */
  canSubmit(): boolean {
    const d = this.draft();
    if (!d.leaveTypeId || (this.onBehalf && this.employeeId() === null)) return false;
    if (this.toSubmitPayload() === null || this.dateRangeHint() !== null) return false;
    if (this.documentRequired() && this.uploadedDocuments.length === 0) return false;
    return !this.submitting && !this.uploadingDocument && !this.previewing && !this.previewError;
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;
    const request = this.toSubmitPayload();
    if (!request) return;
    if (this.onBehalf) {
      const employeeId = this.employeeId();
      if (!employeeId) return;
      this.submitRequested.emit({ ...request, employeeId } as SubmitLeaveRequestOnBehalfRequest);
    } else {
      this.submitRequested.emit(request);
    }
  }

  onClose(): void {
    this.closed.emit();
  }

  onDocumentPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.documentSelected.emit(file);
  }

  toSubmitPayload(): SubmitLeaveRequestRequest | null {
    const d = this.resolvedDraft();
    const range = toLeaveSubmitDateTimes(d, this.workStartTime, this.workEndTime, this.timezone ?? '');
    if (!range) return null;
    return {
      leaveTypeId: d.leaveTypeId,
      startAt: range.startAt,
      endAt: range.endAt,
      reason: d.reason,
      fileRecordIds: this.uploadedDocuments.map((doc) => doc.id)
    };
  }
}
