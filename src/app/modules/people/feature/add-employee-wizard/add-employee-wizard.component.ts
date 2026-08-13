import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NotificationService } from '../../../../core/services/notification.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
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
    HasPermissionDirective,
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
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    workEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    departmentId: ['', Validators.required],
    positionId: ['', Validators.required],
    employmentType: ['', Validators.required],
    startDate: ['', Validators.required],
    employeeNumber: [''],
    workModeId: ['', Validators.required]
  });

  readonly hasCompany = computed(() => !!this.legalEntityStore.selectedLegalEntity());
  readonly stepIndex = computed(() => this.stepOrder.indexOf(this.store.step()));

  readonly workModeOptions = computed<readonly SelectOption[]>(() =>
    this.store.workModes().map((wm) => ({ value: String(wm.id), label: wm.label }))
  );

  readonly selectedWorkModeLabel = computed(() => {
    const val = this.form.controls.workModeId.value;
    if (!val) return '—';
    const opt = this.workModeOptions().find((o) => o.value === val);
    return opt ? opt.label : val;
  });

  readonly selectedDepartmentLabel = computed(() => {
    const val = this.form.controls.departmentId.value;
    if (!val) return '—';
    const opt = this.store.departments().find((o) => o.value === val);
    return opt ? opt.label : val;
  });

  readonly selectedPositionLabel = computed(() => {
    const val = this.form.controls.positionId.value;
    if (!val) return '—';
    const opt = this.store.positions().find((o) => o.value === val);
    return opt ? opt.label : val;
  });

  readonly selectedEmploymentTypeLabel = computed(() => {
    const val = this.form.controls.employmentType.value;
    if (!val) return '—';
    const opt = this.employmentTypeOptions.find((o) => o.value === val);
    return opt ? opt.label : val;
  });

  readonly saveReasonMessage = computed(() => {
    const reason = this.store.lastSaveReason();
    if (!reason) {
      return null;
    }
    if (reason === 'waiting_for_seat') {
      return 'Saved as a draft: no seat is currently available. You can request a seat increase from your billing manager, and this draft will be rechecked once one is approved.';
    }
    if (reason === 'seat_configuration_required') {
      return 'Seat policy is not configured. The draft was saved, but invitation cannot be sent yet.';
    }
    if (reason === 'waiting_for_position_approval') {
      return 'Saved as a draft: the selected position requires approval before this employee can be finalized. It has been submitted for review.';
    }
    if (reason === 'position_approval_rejected') {
      return 'Position approval was rejected. You can edit the details or select a different position to resubmit.';
    }
    if (reason === 'invitation_sent') {
      return 'Finalized and invitation queued.';
    }
    return 'Saved as a draft.';
  });

  constructor() {
    void this.store.loadWorkModes();
    const draftId = this.route.snapshot.queryParamMap.get('draftId');

    // legalEntityStore.selectedLegalEntity() populates asynchronously (loadCompanies() resolves
    // after this component is constructed), so a one-time read here would miss it on a fresh
    // page load - this must stay reactive. Skipped entirely while resuming a draft, since
    // resumeExistingDraft() below sets the wizard's companyId from the draft's own
    // legalEntityId, which must not be clobbered by whatever company happens to be selected now.
    effect(() => {
      if (draftId) {
        return;
      }
      const company = this.legalEntityStore.selectedLegalEntity();
      if (company && this.store.companyId() !== company.id) {
        this.store.setCompany(company.id);
      }
    });

    if (draftId) {
      void this.resumeExistingDraft(draftId);
    }

    this.form.valueChanges.subscribe((value) => {
      this.store.updateFormValue({
        firstName: value.firstName ?? '',
        lastName: value.lastName ?? '',
        workEmail: value.workEmail ?? '',
        employmentType: value.employmentType ?? '',
        startDate: value.startDate ?? '',
        employeeNumber: value.employeeNumber ?? '',
        workModeId: value.workModeId ? Number(value.workModeId) : null
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
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      workEmail: formValue.workEmail,
      departmentId: this.store.departmentId() ?? '',
      positionId: this.store.positionId() ?? '',
      employmentType: formValue.employmentType,
      startDate: formValue.startDate,
      employeeNumber: formValue.employeeNumber,
      workModeId: formValue.workModeId ? String(formValue.workModeId) : ''
    });
  }

  onWorkModeChange(workModeIdStr: string): void {
    this.form.controls.workModeId.setValue(workModeIdStr);
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
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      return;
    }

    const result = await this.store.saveDraft(this.store.step());
    if (result) {
      this.notificationService.success('Draft saved.');
    } else {
      this.notificationService.error(this.store.saveError() ?? 'Something went wrong while saving the employee.');
    }
  }

  async onFinalize(): Promise<void> {
    if (this.store.finalizing() || this.store.saving()) {
      return;
    }
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      return;
    }

    let draftId = this.store.draftId();
    if (!draftId) {
      const saved = await this.store.saveDraft(this.store.step());
      if (!saved) {
        this.notificationService.error(this.store.saveError() ?? 'Failed to save draft before finalization.');
        return;
      }
      draftId = saved.id;
    }

    const response = await this.store.finalizeDraft(draftId);
    if (response) {
      if (response.invitationQueued && !response.positionApprovalPending) {
        this.notificationService.success('Employee onboarding invitation was queued.');
        this.router.navigate(['/people/employees']);
      } else if (response.positionApprovalPending) {
        this.notificationService.info('Position approval was requested before the invitation can be sent.');
        this.router.navigate(['/people/employees']);
      } else if (response.status === 'waiting_for_seat' || response.draftReason === 'waiting_for_seat') {
        this.notificationService.info('No seat is available. The draft was saved for follow-up.');
      } else if (response.draftReason === 'seat_configuration_required') {
        this.notificationService.warning('Seat policy is not configured. The draft was saved, but invitation cannot be sent yet.');
      } else if (response.draftReason === 'position_approval_rejected') {
        this.notificationService.error('Position approval was rejected.');
      } else {
        this.notificationService.success('Employee onboarding draft updated.');
        this.router.navigate(['/people/employees']);
      }
    } else {
      this.notificationService.error(this.store.finalizeError() ?? 'Failed to finalize employee.');
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
