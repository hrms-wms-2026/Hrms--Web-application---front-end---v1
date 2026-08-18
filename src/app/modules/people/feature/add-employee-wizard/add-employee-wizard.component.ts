import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NotificationService } from '../../../../core/services/notification.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { AddEmployeeWizardStore } from '../../state/add-employee-wizard.store';
import { DRAFT_REASON_LABELS, WizardStep } from '../../models/onboarding-draft.model';
import { ChecklistTemplateMatchLevel, ChecklistTemplateType, DraftChecklistTask } from '../../models/checklist-template.model';
import { isTerminalDraft } from '../../utils/draft-status.utils';
import { validateDraftTasks } from '../../utils/draft-checklist-task.utils';

const MATCH_LEVEL_LABELS: Record<ChecklistTemplateMatchLevel, string> = {
  company: 'Company default',
  department: 'Department match',
  position: 'Position match'
};

const TEMPLATE_TYPE_LABELS: Record<ChecklistTemplateType, string> = {
  onboarding: 'Onboarding',
  offboarding: 'Offboarding'
};

const EMPLOYMENT_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'intern', label: 'Intern' }
];

const STEP_ORDER: readonly WizardStep[] = ['employee_details', 'checklist_template', 'review_and_submit'];
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
    HasPermissionDirective,
    RouterLink,
    BreadcrumbHeaderComponent,
    ButtonComponent,
    DatePickerComponent,
    EmptyStateComponent,
    InputComponent,
    LoaderComponent,
    SelectComponent
  ],
  templateUrl: './add-employee-wizard.component.html',
  styleUrl: './add-employee-wizard.component.css',
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
  /** Mirrors submitAttempted, but scoped to the checklist task editor - set on the first blocked
   *  Continue/Save Draft attempt while a checklist is selected, so per-row errors only appear
   *  after the user has tried to move on, not while they're still filling tasks in. */
  readonly taskSubmitAttempted = signal(false);
  /** Per-row "rejected input" messages for the due-days field, keyed by task clientId - kept out
   *  of the store because it's transient keystroke feedback, not domain state. */
  readonly dueDaysRowErrors = signal<Readonly<Record<string, string>>>({});

  /** Dedup key for the last-issued checklist-matches request, so re-rendering Step 2 doesn't re-fire it. */
  private checklistMatchesRequestKey: string | null = null;

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    workEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    departmentId: ['', Validators.required],
    positionId: ['', Validators.required],
    employmentType: ['', Validators.required],
    startDate: ['', Validators.required],
    employeeNumber: ['', Validators.maxLength(20)],
    workModeId: ['', Validators.required]
  });

  readonly hasCompany = computed(() => !!this.legalEntityStore.selectedLegalEntity());
  readonly stepIndex = computed(() => this.stepOrder.indexOf(this.store.step()));

  /** True once a resumed draft turns out to be terminal - the backend rejects any further save/finalize call against it. */
  readonly resumedDraftIsFinalized = computed(() => isTerminalDraft(this.store.lastSaveStatus(), this.store.lastSaveReason()));

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
    const draftId = this.route.snapshot.queryParamMap.get('draftId');

    // The store is providedIn: 'root' and survives route navigation, so a fresh "+ Add Employee"
    // visit (no draftId) must clear out whatever an earlier finalized/in-progress draft left
    // behind - otherwise stale finalizeResult/lastSaveReason/draftId leak into the new wizard.
    if (!draftId) {
      this.store.reset();
    }

    void this.store.loadWorkModes();

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
    // The store itself clears selectedTemplateId/selectedTemplateDetail as part of setDepartment().
    this.store.setDepartment(departmentId);
    if (this.store.step() === 'checklist_template') {
      this.maybeLoadChecklistMatches();
    }
  }

  onPositionChange(positionId: string): void {
    this.form.controls.positionId.setValue(positionId);
    // The store itself clears selectedTemplateId/selectedTemplateDetail as part of setPosition().
    this.store.setPosition(positionId);
    if (this.store.step() === 'checklist_template') {
      this.maybeLoadChecklistMatches();
    }
  }

  matchLevelLabel(level: ChecklistTemplateMatchLevel): string {
    return MATCH_LEVEL_LABELS[level] ?? level;
  }

  selectChecklistTemplate(templateId: string): void {
    this.store.selectChecklistTemplate(templateId);
  }

  retrySelectedTemplateDetail(): void {
    const templateId = this.store.selectedTemplateId();
    if (templateId) {
      void this.store.loadSelectedTemplateDetail(templateId);
    }
  }

  readonly previewTemplateTypeLabel = computed(() => {
    const detail = this.store.selectedTemplateDetail();
    return detail ? (TEMPLATE_TYPE_LABELS[detail.templateType] ?? detail.templateType) : '';
  });

  readonly previewApplicabilityLabel = computed(() => {
    const detail = this.store.selectedTemplateDetail();
    if (!detail) {
      return '';
    }
    if (detail.positionId) {
      return `Position — ${detail.positionName ?? 'Unnamed position'}`;
    }
    if (detail.departmentId) {
      return `Department — ${detail.departmentName ?? 'Unnamed department'}`;
    }
    return 'Company default';
  });

  onTaskTitleChange(clientId: string, value: string): void {
    this.store.updateDraftTask(clientId, { title: value });
  }

  onTaskRequiredChange(clientId: string, checked: boolean): void {
    this.store.updateDraftTask(clientId, { isRequired: checked });
  }

  /** "Another person" has no picker behind it (see store/utils), so this is the only assignee
   *  transition the UI ever offers - switching a preserved non-employee task back to the employee. */
  setTaskAssigneeToEmployee(clientId: string): void {
    this.store.updateDraftTask(clientId, { assignee: 'employee' });
  }

  onTaskDueDaysChange(clientId: string, rawValue: string): void {
    const trimmed = rawValue.trim();
    const numeric = Number(trimmed);
    if (trimmed === '' || !Number.isInteger(numeric) || numeric < 0) {
      this.dueDaysRowErrors.update((errors) => ({ ...errors, [clientId]: 'Enter a whole number of days, 0 or more.' }));
      return;
    }
    this.dueDaysRowErrors.update((errors) => {
      const next = { ...errors };
      delete next[clientId];
      return next;
    });
    this.store.updateDraftTask(clientId, { dueDays: numeric });
  }

  addTask(): void {
    this.store.addDraftTask();
  }

  removeTask(clientId: string): void {
    this.store.removeDraftTask(clientId);
    this.dueDaysRowErrors.update((errors) => {
      const next = { ...errors };
      delete next[clientId];
      return next;
    });
  }

  moveTaskUp(clientId: string): void {
    this.store.moveDraftTaskUp(clientId);
  }

  moveTaskDown(clientId: string): void {
    this.store.moveDraftTaskDown(clientId);
  }

  taskTitleError(task: DraftChecklistTask): string {
    return this.taskSubmitAttempted() && !task.title.trim() ? 'A title is required.' : '';
  }

  taskDueDaysError(task: DraftChecklistTask): string {
    const rejected = this.dueDaysRowErrors()[task.clientId];
    if (rejected) {
      return rejected;
    }
    if (this.taskSubmitAttempted() && (!Number.isInteger(task.dueDays) || task.dueDays < 0)) {
      return 'Enter a whole number of days, 0 or more.';
    }
    return '';
  }

  /** Gates Continue/Save Draft/Finalize: true when a checklist is selected and its draft-local
   *  tasks currently fail validation (mirrors the store's own saveDraft() check). */
  private hasBlockingTaskErrors(): boolean {
    return !!this.store.selectedTemplateId() && validateDraftTasks(this.store.draftTasks()).length > 0;
  }

  /** Issues a checklist-matches request only when the (company, department, position) triple actually changed - prevents re-firing on every re-render of Step 2. */
  private maybeLoadChecklistMatches(): void {
    const companyId = this.store.companyId();
    if (!companyId) {
      return;
    }
    const key = `${companyId}|${this.store.departmentId() ?? ''}|${this.store.positionId() ?? ''}`;
    if (key === this.checklistMatchesRequestKey) {
      return;
    }
    this.checklistMatchesRequestKey = key;
    void this.store.loadChecklistTemplateMatches();
  }

  goToNextStep(): void {
    if (this.stepIndex() === 0) {
      this.submitAttempted.set(true);
      if (this.form.invalid) {
        return;
      }
    }
    if (this.store.step() === 'checklist_template' && this.store.selectedTemplateId()) {
      this.taskSubmitAttempted.set(true);
      if (this.hasBlockingTaskErrors()) {
        return;
      }
    }
    const next = this.stepOrder[this.stepIndex() + 1];
    if (next) {
      this.store.goToStep(next);
      if (next === 'checklist_template') {
        this.maybeLoadChecklistMatches();
      }
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
    if (this.store.selectedTemplateId()) {
      this.taskSubmitAttempted.set(true);
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
    if (this.store.selectedTemplateId()) {
      this.taskSubmitAttempted.set(true);
    }

    let draftId = this.store.draftId();
    // A checklist selection must always be flushed via saveDraft() first, even when a draftId
    // already exists (a resumed draft) - otherwise task edits made on this screen this session
    // (or a freshly-made selection) would never reach selectedTemplateId/editedTasksJson on the
    // backend before finalize reads them.
    if (!draftId || this.store.selectedTemplateId()) {
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
        // Navigate first, then reset - this component (and its company-selection effect) is
        // still live until navigation completes, and reset() nulling companyId would otherwise
        // make that effect re-fire setCompany()/loadDepartmentsForCompany() on a component
        // that's mid-teardown.
        await this.router.navigate(['/people/employees']);
        this.store.reset();
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
