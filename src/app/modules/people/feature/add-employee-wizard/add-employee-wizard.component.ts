import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { AddEmployeeWizardStore } from '../../state/add-employee-wizard.store';
import { DRAFT_REASON_LABELS, WizardStep } from '../../models/onboarding-draft.model';

const EMPLOYMENT_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'intern', label: 'Intern' }
];

const STEP_ORDER: readonly WizardStep[] = ['employee_details', 'checklist_template', 'checklist_review', 'review_and_submit'];
const STEP_LABELS: Record<WizardStep, string> = {
  employee_details: 'Employee details',
  checklist_template: 'Checklist template',
  checklist_review: 'Checklist review',
  review_and_submit: 'Review & Submit'
};

@Component({
  selector: 'app-add-employee-wizard',
  standalone: true,
  imports: [
    RouterLink,
    ButtonComponent,
    EmptyStateComponent,
    InputComponent,
    LoaderComponent,
    PageHeaderComponent,
    SelectComponent
  ],
  templateUrl: './add-employee-wizard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddEmployeeWizardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  readonly store = inject(AddEmployeeWizardStore);
  readonly legalEntityStore = inject(LegalEntityStore);

  readonly employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS;
  readonly stepOrder = STEP_ORDER;
  readonly stepLabels = STEP_LABELS;
  readonly submitAttempted = signal(false);

  readonly form = this.fb.nonNullable.group({
    employeeName: ['', Validators.required],
    workEmail: ['', [Validators.required, Validators.email]],
    departmentId: ['', Validators.required],
    positionId: ['', Validators.required],
    employmentType: ['', Validators.required],
    startDate: ['', Validators.required],
    employeeNumber: ['']
  });

  readonly hasCompany = computed(() => !!this.legalEntityStore.selectedLegalEntity());
  readonly stepIndex = computed(() => this.stepOrder.indexOf(this.store.step()));

  readonly saveReasonMessage = computed(() => {
    const reason = this.store.lastSaveReason();
    if (!reason) {
      return null;
    }
    if (reason === 'waiting_for_seat') {
      return 'Saved as a draft: no seat is currently available. You can request a seat increase from your billing manager, and this draft will be rechecked once one is approved.';
    }
    if (reason === 'waiting_for_position_approval') {
      return 'Saved as a draft: the selected position requires approval before this employee can be finalized. It has been submitted for review.';
    }
    return 'Saved as a draft.';
  });

  constructor() {
    const company = this.legalEntityStore.selectedLegalEntity();
    if (company) {
      this.store.setCompany(company.id);
    }

    const draftId = this.route.snapshot.queryParamMap.get('draftId');
    if (draftId) {
      void this.resumeExistingDraft(draftId);
    }

    this.form.valueChanges.subscribe((value) => {
      this.store.updateFormValue({
        employeeName: value.employeeName ?? '',
        workEmail: value.workEmail ?? '',
        employmentType: value.employmentType ?? '',
        startDate: value.startDate ?? '',
        employeeNumber: value.employeeNumber ?? ''
      });
    });
  }

  private async resumeExistingDraft(draftId: string): Promise<void> {
    await this.store.resumeDraft(draftId);
    if (this.store.resumeError()) {
      this.notificationService.error(this.store.resumeError()!);
      return;
    }
    const formValue = this.store.formValue();
    this.form.patchValue({
      employeeName: formValue.employeeName,
      workEmail: formValue.workEmail,
      departmentId: this.store.departmentId() ?? '',
      positionId: this.store.positionId() ?? '',
      employmentType: formValue.employmentType,
      startDate: formValue.startDate,
      employeeNumber: formValue.employeeNumber
    });
  }

  onDepartmentChange(departmentId: string): void {
    this.form.controls.departmentId.setValue(departmentId);
    this.form.controls.positionId.setValue('');
    this.store.setDepartment(departmentId);
  }

  onPositionChange(positionId: string): void {
    this.form.controls.positionId.setValue(positionId);
    this.store.setPosition(positionId);
  }

  goToNextStep(): void {
    if (this.stepIndex() === 0) {
      this.submitAttempted.set(true);
      if (this.form.invalid) {
        return;
      }
    }
    const next = this.stepOrder[this.stepIndex() + 1];
    if (next) {
      this.store.goToStep(next);
    }
  }

  goToPreviousStep(): void {
    const prev = this.stepOrder[this.stepIndex() - 1];
    if (prev) {
      this.store.goToStep(prev);
    }
  }

  async onSaveDraft(): Promise<void> {
    if (this.store.saving()) {
      return;
    }
    const result = await this.store.saveDraft(this.store.step());
    if (result) {
      this.notificationService.success('Draft saved.');
    } else {
      this.notificationService.error(this.store.saveError() ?? 'Something went wrong while saving the employee.');
    }
  }

  onCancel(): void {
    this.router.navigate(['/people/employees']);
  }

  draftReasonLabel(reason: string): string {
    return DRAFT_REASON_LABELS[reason as keyof typeof DRAFT_REASON_LABELS] ?? reason;
  }

  stepChipClass(index: number): string {
    return index === this.stepIndex()
      ? 'bg-[var(--color-accent)] text-[var(--color-accent-contrast)]'
      : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]';
  }
}
