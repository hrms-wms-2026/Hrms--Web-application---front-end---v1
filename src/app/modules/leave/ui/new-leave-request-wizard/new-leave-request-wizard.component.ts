/** Screen 5, 5 steps per the product spec: type -> From/To -> live total/warnings -> reason -> review & submit. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { TimePickerComponent } from '../../../../shared/ui/time-picker/time-picker.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { EmployeePickerComponent } from '../../../work/ui/employee-picker/employee-picker.component';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveRequestResponse, LeaveUploadedDocument, SubmitLeaveRequestOnBehalfRequest, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { formatHours, toLeaveSubmitDateTimes } from '../../utils/leave-request-datetime';
import { formatHours as hoursLabel } from '../../utils/leave-amount';

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
  imports: [CommonModule, ModalComponent, DatePickerComponent, TimePickerComponent, EmployeePickerComponent, SelectComponent],
  templateUrl: './new-leave-request-wizard.component.html',
  styleUrl: './new-leave-request-wizard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewLeaveRequestWizardComponent {
  @Input({ required: true }) open = false;
  @Input({ required: true }) leaveTypes: readonly LeaveTypeResponse[] = [];
  @Input({ required: true }) balances: readonly LeaveBalanceResponse[] = [];
  @Input() initialStartDate = '';
  @Input() initialEndDate = '';
  @Input() workStartTime: string | null = null;
  @Input() workEndTime: string | null = null;
  @Input() timezone: string | null = null;
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

  readonly step = signal(1);
  readonly draft = signal<LeaveRequestDraft>(emptyDraft());
  readonly employeeId = signal<string | null>(null);
  readonly pickerOpen = signal(false);
  readonly formatHours = formatHours;
  /** "24 h" for the over-balance warning. */
  readonly hoursLabel = hoursLabel;

  readonly steps = ['Leave type', 'From / To', 'Total & warnings', 'Reason', 'Review'];
  readonly activeLeaveTypes = computed(() => (this.leaveTypes as LeaveTypeResponse[]).filter((type) => type.isActive));
  readonly workWindowMissing = computed(() => !this.workStartTime || !this.workEndTime);
  readonly reasonMaxLength = 2000;

  /** Leave type dropdown options with each type's remaining balance; rebuilt when the inputs change. */
  leaveTypeOptions: readonly SelectOption[] = [];

  ngOnChanges(): void {
    this.leaveTypeOptions = [
      { value: '', label: 'Select a leave type' },
      ...this.leaveTypes
        .filter((type) => type.isActive)
        .map((type) => {
          const remaining = this.remainingHoursFor(type.id);
          return { value: type.id, label: remaining === null ? type.name : `${type.name} - ${remaining} hours remaining` };
        })
    ];
  }

  ngOnInit(): void {
    if (!this.initialStartDate && !this.initialEndDate) return;
    this.draft.update((d) => ({
      ...d,
      startDate: this.initialStartDate || d.startDate,
      endDate: this.initialEndDate || d.endDate
    }));
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

  stepLabel(): string {
    return this.steps[this.step() - 1] ?? '';
  }

  onLeaveTypeChange(leaveTypeId: string): void {
    this.draft.update((d) => ({ ...d, leaveTypeId }));
  }

  onEmployeePicked(id: string): void {
    this.employeeId.set(id);
    this.pickerOpen.set(false);
  }

  /** Why Continue is disabled on the From/To step, so the user isn't left guessing. */
  dateRangeHint(): string | null {
    const d = this.draft();
    if (this.workWindowMissing()) return null;
    if (!d.startDate) return 'Choose the date your leave starts.';
    if (!d.endDate) return 'Choose the date your leave ends.';
    if (d.endDate < d.startDate) return 'The end date must be on or after the start date.';
    const payload = this.toSubmitPayload();
    if (!payload) return 'Choose valid start and end times.';
    if (payload.endAt <= payload.startAt) return 'The end must be after the start.';
    return null;
  }

  onStartDateChange(startDate: string): void {
    // Most leave is a single day or a forward range: keep To in step so it's never left behind.
    this.draft.update((d) => ({ ...d, startDate, endDate: !d.endDate || d.endDate < startDate ? startDate : d.endDate }));
  }

  approverNames(): string[] {
    return (this.previewResult?.approvers ?? [])
      .slice()
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
      .map((a) => a.approverName)
      .filter((name) => !!name);
  }

  formatDay(date: string): string {
    if (!date) return '';
    const [year, month, day] = date.split('-').map(Number);
    const weekday = new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short' });
    return `${date} (${weekday})`;
  }

  canLeaveStep(step: number): boolean {
    const d = this.draft();
    if (step === 1) return this.onBehalf ? this.employeeId() !== null && !!d.leaveTypeId : !!d.leaveTypeId;
    if (step === 2) return this.toSubmitPayload() !== null && this.dateRangeHint() === null;
    // Submit needs a successful preview, so don't let a blocking preview error lead the user
    // through steps 4-5 to a Submit button that can never be enabled.
    if (step === 3) return !this.previewing && !this.previewError && this.previewResult !== null;
    return true;
  }

  onNext(): void {
    if (!this.canLeaveStep(this.step())) return;
    if (this.step() === 2) {
      const payload = this.toSubmitPayload();
      if (payload) this.previewRequested.emit(payload);
    }
    this.step.update((s) => Math.min(5, s + 1));
  }

  onBack(): void {
    this.step.update((s) => Math.max(1, s - 1));
  }

  onSubmit(): void {
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
    const d = this.draft();
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
