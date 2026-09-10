/** Screen 5, 5 steps per the product spec: type -> dates -> live total/warnings -> reason -> review & submit. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { EmployeePickerComponent } from '../../../work/ui/employee-picker/employee-picker.component';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveRequestResponse, SubmitLeaveRequestOnBehalfRequest, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';

export interface LeaveRequestDraft {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  halfDayPeriod: 'am' | 'pm' | null;
  reason: string | null;
}

function emptyDraft(): LeaveRequestDraft {
  return { leaveTypeId: '', startDate: '', endDate: '', halfDayPeriod: null, reason: null };
}

@Component({
  selector: 'app-new-leave-request-wizard',
  standalone: true,
  imports: [CommonModule, ModalComponent, DatePickerComponent, EmployeePickerComponent],
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
  @Input() onBehalf = false;
  @Input() previewing = false;
  @Input() previewResult: LeaveRequestResponse | null = null;
  @Input() previewError: string | null = null;
  @Input() submitting = false;
  @Input() submitError: string | null = null;
  @Output() previewRequested = new EventEmitter<SubmitLeaveRequestRequest>();
  @Output() submitRequested = new EventEmitter<SubmitLeaveRequestRequest | SubmitLeaveRequestOnBehalfRequest>();
  @Output() closed = new EventEmitter<void>();

  readonly step = signal(1);
  readonly draft = signal<LeaveRequestDraft>(emptyDraft());
  readonly employeeId = signal<string | null>(null);
  readonly pickerOpen = signal(false);

  readonly steps = ['Leave type', 'Dates', 'Total & warnings', 'Reason', 'Review'];
  readonly activeLeaveTypes = computed(() => (this.leaveTypes as LeaveTypeResponse[]).filter((type) => type.isActive));

  ngOnInit(): void {
    if (!this.initialStartDate && !this.initialEndDate) return;
    this.draft.update((d) => ({
      ...d,
      startDate: this.initialStartDate || d.startDate,
      endDate: this.initialEndDate || d.endDate
    }));
  }

  remainingDaysFor(leaveTypeId: string): number | null {
    const balance = (this.balances as LeaveBalanceResponse[]).find((b) => b.leaveTypeId === leaveTypeId);
    return balance ? balance.remainingDays : null;
  }

  selectedLeaveType(): LeaveTypeResponse | undefined {
    return this.activeLeaveTypes().find((type) => type.id === this.draft().leaveTypeId);
  }

  selectedLeaveTypeName(): string {
    return this.selectedLeaveType()?.name ?? '';
  }

  halfDayLabel(): string {
    const period = this.draft().halfDayPeriod;
    if (period === 'am') return 'AM';
    if (period === 'pm') return 'PM';
    return 'Full day(s)';
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
    if (step === 2) return !!d.startDate && !!d.endDate && d.endDate >= d.startDate;
    return true;
  }

  onNext(): void {
    if (!this.canLeaveStep(this.step())) return;
    if (this.step() === 2) this.previewRequested.emit(this.toRequest());
    this.step.update((s) => Math.min(5, s + 1));
  }

  onBack(): void {
    this.step.update((s) => Math.max(1, s - 1));
  }

  onSubmit(): void {
    const request = this.toRequest();
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

  private toRequest(): SubmitLeaveRequestRequest {
    const d = this.draft();
    return {
      leaveTypeId: d.leaveTypeId,
      startDate: d.startDate,
      endDate: d.endDate,
      halfDayPeriod: d.halfDayPeriod,
      reason: d.reason,
      fileRecordIds: []
    };
  }
}
