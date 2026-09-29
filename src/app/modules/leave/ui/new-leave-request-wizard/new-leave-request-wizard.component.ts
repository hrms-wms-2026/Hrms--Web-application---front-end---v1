/** Screen 5, 5 steps per the product spec: type -> From/To -> live total/warnings -> reason -> review & submit. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { TimePickerComponent } from '../../../../shared/ui/time-picker/time-picker.component';
import { EmployeePickerComponent } from '../../../work/ui/employee-picker/employee-picker.component';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveRequestResponse, LeaveUploadedDocument, SubmitLeaveRequestOnBehalfRequest, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { formatHours, toLeaveSubmitDateTimes } from '../../utils/leave-request-datetime';

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
  imports: [CommonModule, ModalComponent, DatePickerComponent, TimePickerComponent, EmployeePickerComponent],
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

  readonly steps = ['Leave type', 'From / To', 'Total & warnings', 'Reason', 'Review'];
  readonly activeLeaveTypes = computed(() => (this.leaveTypes as LeaveTypeResponse[]).filter((type) => type.isActive));
  readonly workWindowMissing = computed(() => !this.workStartTime || !this.workEndTime);

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

  canLeaveStep(step: number): boolean {
    const d = this.draft();
    if (step === 1) return this.onBehalf ? this.employeeId() !== null && !!d.leaveTypeId : !!d.leaveTypeId;
    if (step === 2) return this.toSubmitPayload() !== null;
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
