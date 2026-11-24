import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { OffboardingWizardStore } from '../../state/offboarding-wizard.store';
import { AppValidators, validationMessage } from '../../../../shared/utils/validators';
import { OFFBOARDING_LIMITS } from '../../utils/people-limits';

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

/** The one place an offboarding is started: exit reason, last working day and risk, in the shared popup.
 *  Pass `employeeId` (+ `employeeName`) to start it for a known person, or `employeeOptions` to let the user pick. */
@Component({
  selector: 'app-start-offboarding-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, DatePickerComponent, InputComponent, ModalComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" title="Start offboarding" [subtitle]="subtitle()" size="lg" (closed)="close()">
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
        @if (!employeeId()) {
          <app-select
            label="Employee *"
            placeholder="Select an employee"
            [options]="employeeOptions()"
            [value]="form.controls.employeeId.value || ''"
            (valueChange)="form.controls.employeeId.setValue($event)"
          />
        }
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <app-select
            label="Exit reason *"
            [options]="reasons"
            [value]="form.controls.reason.value || ''"
            (valueChange)="form.controls.reason.setValue($any($event))"
          />
          <app-date-picker
            label="Last working day *"
            [value]="form.controls.lastWorkingDate.value || ''"
            (valueChange)="form.controls.lastWorkingDate.setValue($event)"
          />
          <app-select
            label="Knowledge risk level *"
            [options]="riskLevels"
            [value]="form.controls.knowledgeRiskLevel.value || ''"
            (valueChange)="form.controls.knowledgeRiskLevel.setValue($any($event))"
          />
          <app-select
            label="Rehire eligibility"
            [options]="rehire"
            [value]="form.controls.rehireEligibility.value || ''"
            (valueChange)="form.controls.rehireEligibility.setValue($any($event) || null)"
          />
        </div>
        <app-input
          label="Notes"
          [value]="form.controls.notes.value || ''"
          (valueChange)="form.controls.notes.setValue($event || null)"
          [error]="validationMessage(form.controls.notes.errors, 'Notes')"
        />
        <div class="flex justify-end gap-2">
          <app-button variant="secondary" type="button" (pressed)="close()">Cancel</app-button>
          <app-button variant="danger" type="submit" data-testid="start-offboarding-submit" [loading]="submitting()" [disabled]="form.invalid">
            Start offboarding
          </app-button>
        </div>
      </form>
    </app-modal>
  `
})
export class StartOffboardingModalComponent {
  private readonly wizardStore = inject(OffboardingWizardStore);
  private readonly fb = inject(FormBuilder);

  protected readonly validationMessage = validationMessage;

  readonly open = input.required<boolean>();
  /** Fixed employee; hides the picker. */
  readonly employeeId = input<string | null>(null);
  readonly employeeName = input<string | null>(null);
  /** Picker choices when no employee is fixed. */
  readonly employeeOptions = input<readonly SelectOption[]>([]);
  readonly closed = output<void>();
  /** Emits the employee id once the offboarding exists. */
  readonly started = output<string>();

  readonly reasons = EXIT_REASONS;
  readonly riskLevels = RISK_LEVELS;
  readonly rehire = REHIRE;
  readonly submitting = signal(false);

  readonly subtitle = computed(() => {
    const name = this.employeeName();
    return name ? `Begin the exit workflow for ${name}.` : 'Begin the exit workflow for someone in your reporting line.';
  });

  readonly form = this.fb.group({
    employeeId: ['', Validators.required],
    reason: ['resignation' as const, Validators.required],
    lastWorkingDate: ['', Validators.required],
    knowledgeRiskLevel: ['medium' as const, Validators.required],
    rehireEligibility: [null as 'eligible' | 'not_eligible' | 'conditional' | null],
    notes: [null as string | null, AppValidators.maxLength(OFFBOARDING_LIMITS.notesMax)]
  });

  constructor() {
    // Fresh form every time the popup opens.
    effect(() => {
      if (!this.open()) return;
      this.form.reset({
        employeeId: this.employeeId() ?? '', reason: 'resignation', lastWorkingDate: '', knowledgeRiskLevel: 'medium',
        rehireEligibility: null, notes: null
      });
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    const value = this.form.getRawValue();
    const employeeId = value.employeeId!;
    this.submitting.set(true);
    const ok = await this.wizardStore.startOffboarding(employeeId, {
      reason: value.reason!,
      lastWorkingDate: value.lastWorkingDate!,
      knowledgeRiskLevel: value.knowledgeRiskLevel!,
      rehireEligibility: value.rehireEligibility,
      notes: value.notes
    });
    this.submitting.set(false);
    if (ok) {
      this.started.emit(employeeId);
      this.closed.emit();
    }
  }

  close(): void {
    this.closed.emit();
  }
}
