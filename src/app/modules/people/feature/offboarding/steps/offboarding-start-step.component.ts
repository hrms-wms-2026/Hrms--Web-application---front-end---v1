import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../../shared/ui/select/select.component';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-start-step',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4 max-w-xl">
      <app-select
        label="Exit reason *"
        [options]="[
          { value: 'resignation', label: 'Resignation' },
          { value: 'termination', label: 'Termination' },
          { value: 'retirement', label: 'Retirement' },
          { value: 'contract_end', label: 'Contract End' }
        ]"
        [value]="form.controls.reason.value || ''"
        (valueChange)="form.controls.reason.setValue($any($event))"
      />
      <app-input
        label="Last working day *"
        type="date"
        [value]="form.controls.lastWorkingDate.value || ''"
        (valueChange)="form.controls.lastWorkingDate.setValue($event)"
      />
      <app-select
        label="Knowledge risk level *"
        [options]="[
          { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }
        ]"
        [value]="form.controls.knowledgeRiskLevel.value || ''"
        (valueChange)="form.controls.knowledgeRiskLevel.setValue($any($event))"
      />
      <app-select
        label="Rehire eligibility"
        [options]="[
          { value: 'eligible', label: 'Eligible' }, { value: 'not_eligible', label: 'Not Eligible' },
          { value: 'conditional', label: 'Conditional' }
        ]"
        [value]="form.controls.rehireEligibility.value || ''"
        (valueChange)="form.controls.rehireEligibility.setValue($any($event) || null)"
      />
      <app-input
        label="Notes"
        [value]="form.controls.notes.value || ''"
        (valueChange)="form.controls.notes.setValue($event || null)"
      />
      <app-button variant="primary" type="submit" [loading]="store.saving()" [disabled]="form.invalid">
        Start Offboarding
      </app-button>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingStartStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    reason: ['resignation' as const, Validators.required],
    lastWorkingDate: ['', Validators.required],
    knowledgeRiskLevel: ['medium' as const, Validators.required],
    rehireEligibility: [null as 'eligible' | 'not_eligible' | 'conditional' | null],
    notes: [null as string | null]
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    await this.store.startOffboarding(this.employeeId(), {
      reason: value.reason!,
      lastWorkingDate: value.lastWorkingDate!,
      knowledgeRiskLevel: value.knowledgeRiskLevel!,
      rehireEligibility: value.rehireEligibility,
      notes: value.notes
    });
  }
}
