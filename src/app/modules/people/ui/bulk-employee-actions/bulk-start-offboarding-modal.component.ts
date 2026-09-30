import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { BulkEmployeeActionResponse } from '../../models/employee.model';

// Same option lists as the offboarding overview's start-offboarding form.
const EXIT_REASONS = [
  { value: 'resignation', label: 'Resignation' }, { value: 'termination', label: 'Termination' },
  { value: 'retirement', label: 'Retirement' }, { value: 'contract_end', label: 'Contract End' }
];
const RISK_LEVELS = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }
];
const REHIRE = [
  { value: 'eligible', label: 'Eligible' }, { value: 'not_eligible', label: 'Not Eligible' }, { value: 'conditional', label: 'Conditional' }
];

@Component({
  selector: 'app-bulk-start-offboarding-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, SelectComponent, DatePickerComponent, InputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" title="Start offboarding" (closed)="close()">
      <div class="flex flex-col gap-4">
        <p class="text-sm text-[var(--color-text-secondary)]">
          Starts offboarding for {{ employeeIds().length }} selected employee{{ employeeIds().length === 1 ? '' : 's' }} with the same exit details.
          Each person's checklist is chosen afterwards from their offboarding page.
        </p>
        <app-select label="Exit reason *" [options]="reasons" [value]="reason()" (valueChange)="reason.set($event)" />
        <app-date-picker label="Last working day *" [value]="lastWorkingDate()" (valueChange)="lastWorkingDate.set($event)" />
        <app-select label="Knowledge risk level *" [options]="riskLevels" [value]="knowledgeRiskLevel()" (valueChange)="knowledgeRiskLevel.set($event)" />
        <app-select label="Rehire eligibility" [options]="rehire" [value]="rehireEligibility() ?? ''" (valueChange)="rehireEligibility.set($event || null)" />
        <app-input label="Notes" [value]="notes() ?? ''" (valueChange)="notes.set($event || null)" />
        @if (error(); as message) { <p class="text-xs text-[var(--color-danger-text)]">{{ message }}</p> }
        <div class="flex justify-end gap-2">
          <app-button variant="secondary" (pressed)="close()">Cancel</app-button>
          <app-button variant="danger" data-testid="bulk-offboard-submit" [loading]="submitting()" [disabled]="!canSubmit()" (pressed)="submit()">Start offboarding</app-button>
        </div>
      </div>
    </app-modal>
  `
})
export class BulkStartOffboardingModalComponent {
  private readonly peopleApi = inject(PeopleApiService);

  readonly open = input.required<boolean>();
  readonly employeeIds = input.required<readonly string[]>();
  readonly closed = output<void>();
  readonly completed = output<BulkEmployeeActionResponse>();

  readonly reasons = EXIT_REASONS;
  readonly riskLevels = RISK_LEVELS;
  readonly rehire = REHIRE;
  readonly reason = signal('resignation');
  readonly lastWorkingDate = signal('');
  readonly knowledgeRiskLevel = signal('medium');
  readonly rehireEligibility = signal<string | null>(null);
  readonly notes = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly canSubmit = computed(() =>
    !!this.reason() && !!this.lastWorkingDate() && !!this.knowledgeRiskLevel() && this.employeeIds().length > 0 && !this.submitting());

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.peopleApi.bulkStartOffboarding({
      employeeIds: [...this.employeeIds()],
      reason: this.reason(),
      lastWorkingDate: this.lastWorkingDate(),
      knowledgeRiskLevel: this.knowledgeRiskLevel(),
      rehireEligibility: this.rehireEligibility(),
      notes: this.notes()
    }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.completed.emit(res);
        this.close();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(toSafeErrorMessage(err, 'Failed to start offboarding.'));
      }
    });
  }

  close(): void {
    this.reason.set('resignation');
    this.lastWorkingDate.set('');
    this.knowledgeRiskLevel.set('medium');
    this.rehireEligibility.set(null);
    this.notes.set(null);
    this.error.set(null);
    this.closed.emit();
  }
}
