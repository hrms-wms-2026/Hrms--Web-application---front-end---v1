/** Screen 5, 5 steps per the product spec: type -> dates -> live total/warnings -> reason -> review & submit. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { TimePickerComponent } from '../../../../shared/ui/time-picker/time-picker.component';
import { localPartsToUtcIso } from '../../../../shared/utils/timezone.util';
import { EmployeePickerComponent } from '../../../work/ui/employee-picker/employee-picker.component';
import { GeneralSettingsStore } from '../../../organization/state/general-settings.store';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveRequestResponse, SubmitLeaveRequestOnBehalfRequest, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';

export interface LeaveRequestDraft {
  leaveTypeId: string;
  startDate: string; // yyyy-MM-dd
  startTime: string; // HH:mm, '' means default work start
  endDate: string;
  endTime: string;   // '' means default work end
  reason: string | null;
}

function emptyDraft(): LeaveRequestDraft {
  return { leaveTypeId: '', startDate: '', startTime: '', endDate: '', endTime: '', reason: null };
}

function addOneCalendarDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
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
  private readonly settingsStore = inject(GeneralSettingsStore);

  @Input({ required: true }) open = false;
  @Input({ required: true }) leaveTypes: readonly LeaveTypeResponse[] = [];
  @Input({ required: true }) balances: readonly LeaveBalanceResponse[] = [];
  @Input() onBehalf = false;
  @Input() previewing = false;
  @Input() previewResult: LeaveRequestResponse | null = null;
  @Input() previewError: string | null = null;
  @Input() submitting = false;
  @Input() submitError: string | null = null;
  @Input() workStartTime: string | null = null;
  @Input() workEndTime: string | null = null;
  @Input() timezone: string | null = null;
  @Output() previewRequested = new EventEmitter<SubmitLeaveRequestRequest>();
  @Output() submitRequested = new EventEmitter<SubmitLeaveRequestRequest | SubmitLeaveRequestOnBehalfRequest>();
  @Output() closed = new EventEmitter<void>();

  readonly step = signal(1);
  readonly draft = signal<LeaveRequestDraft>(emptyDraft());
  readonly employeeId = signal<string | null>(null);
  readonly pickerOpen = signal(false);

  readonly steps = ['Leave type', 'Dates', 'Total & warnings', 'Reason', 'Review'];
  readonly activeLeaveTypes = computed(() => (this.leaveTypes as LeaveTypeResponse[]).filter((type) => type.isActive));

  remainingHoursFor(leaveTypeId: string): number | null {
    const balance = (this.balances as LeaveBalanceResponse[]).find((b) => b.leaveTypeId === leaveTypeId);
    return balance ? balance.remainingHours : null;
  }

  hasWorkWindow(): boolean {
    return !!this.resolvedWorkStart() && !!this.resolvedWorkEnd();
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
    if (step === 2) return this.hasWorkWindow() && !!d.startDate && !!d.endDate && d.endDate >= d.startDate;
    return true;
  }

  onNext(): void {
    if (!this.canLeaveStep(this.step())) return;
    if (this.step() === 2) {
      const payload = this.toSubmitPayload();
      if (!payload) return;
      this.previewRequested.emit(payload);
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

  toSubmitPayload(): SubmitLeaveRequestRequest | null {
    const d = this.draft();
    const startTime = d.startTime || this.resolvedWorkStart();
    const endTime = d.endTime || this.resolvedWorkEnd();
    if (!d.startDate || !d.endDate || !startTime || !endTime) return null;
    // Same-day endTime <= startTime is an overnight window: end is the next calendar day.
    let endDate = d.endDate;
    if (endDate === d.startDate && endTime <= startTime) {
      endDate = addOneCalendarDay(endDate);
    }
    const timezone = this.resolvedTimezone();
    return {
      leaveTypeId: d.leaveTypeId,
      startAt: localPartsToUtcIso(d.startDate, startTime, timezone),
      endAt: localPartsToUtcIso(endDate, endTime, timezone),
      reason: d.reason,
      fileRecordIds: []
    };
  }

  private resolvedWorkStart(): string | null {
    return this.workStartTime || this.settingsStore.settings()?.workStartTime || null;
  }

  private resolvedWorkEnd(): string | null {
    return this.workEndTime || this.settingsStore.settings()?.workEndTime || null;
  }

  private resolvedTimezone(): string {
    return this.settingsStore.settings()?.timezone || this.timezone || 'UTC';
  }
}
