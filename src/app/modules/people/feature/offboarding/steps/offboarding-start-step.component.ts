import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../../shared/ui/date-picker/date-picker.component';
import { InputComponent } from '../../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../../shared/ui/select/select.component';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { KnowledgeRiskLevel, OffboardingReason, RehireEligibility } from '../../../models/offboarding.model';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-start-step',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, DatePickerComponent, InputComponent, SelectComponent],
  template: `
    <div class="obs-step-container">
      <div class="obs-step-header">
        <h3 class="obs-step-title">Start Employee Offboarding</h3>
        <p class="obs-step-subtitle">Define the exit reason, last working day, and risk parameters to initiate the offboarding workflow.</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="obs-form-grid">
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
        <app-date-picker
          label="Last working day *"
          placeholder="YYYY-MM-DD"
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
        <div class="col-span-full">
          <app-input
            label="Notes"
            [value]="form.controls.notes.value || ''"
            (valueChange)="form.controls.notes.setValue($event || null)"
          />
        </div>
        <div class="col-span-full flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
          <app-button variant="primary" type="submit">
            Continue to Checklist
          </app-button>
        </div>
      </form>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingStartStepComponent {
  private readonly fb = inject(FormBuilder);
  private readonly offboardingApi = inject(OffboardingApiService);
  readonly store = inject(OffboardingWizardStore, { optional: true });

  readonly employeeId = input.required<string>();

  readonly form = this.fb.group({
    reason: ['resignation', Validators.required],
    lastWorkingDate: [new Date().toISOString().slice(0, 10), Validators.required],
    knowledgeRiskLevel: ['medium', Validators.required],
    rehireEligibility: ['eligible' as string | null],
    notes: ['' as string | null]
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.getRawValue();
    const empId = this.employeeId();
    if (!empId) return;

    await firstValueFrom(
      this.offboardingApi.startOffboarding(empId, {
        reason: val.reason as OffboardingReason,
        lastWorkingDate: val.lastWorkingDate!,
        knowledgeRiskLevel: val.knowledgeRiskLevel as KnowledgeRiskLevel,
        rehireEligibility: (val.rehireEligibility as RehireEligibility) || null,
        notes: val.notes || null
      })
    );

    if (this.store) {
      this.store.loadOffboarding(empId);
    }
  }
}
