import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnDestroy, output, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, firstValueFrom, map, of, switchMap } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { CustomSelectComponent } from '../../../../shared/ui/custom-select/custom-select.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { PeopleApiService } from '../../data-access/people-api.service';
import { AddEmployeeWizardStore } from '../../state/add-employee-wizard.store';
import { ReportsToPickerComponent } from '../../ui/reports-to-picker/reports-to-picker.component';
import { DRAFT_REASON_LABELS, WizardStep } from '../../models/onboarding-draft.model';
import { ChecklistTemplateMatchLevel, ChecklistTemplateType, DraftChecklistTask } from '../../models/checklist-template.model';
import { isTerminalDraft } from '../../utils/draft-status.utils';
import { validateDraftTaskFields, validateDraftTasks } from '../../utils/draft-checklist-task.utils';
import {
  EMPLOYEE_NUMBER_GENERATE_FAILED_MESSAGE,
  EMPLOYEE_NUMBER_INVALID_FORMAT_MESSAGE,
  EMPLOYEE_NUMBER_IN_USE_MESSAGE,
  EMPLOYEE_NUMBER_MAX_LENGTH,
  isValidEmployeeNumberFormat,
  normalizeEmployeeNumber
} from '../../utils/employee-number.utils';

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
  { value: 'contract', label: 'Contract' },
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
    SelectComponent,
    CustomSelectComponent,
    ReportsToPickerComponent
  ],
  templateUrl: './add-employee-wizard.component.html',
  styleUrl: './add-employee-wizard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddEmployeeWizardComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly peopleApi = inject(PeopleApiService);

  readonly store = inject(AddEmployeeWizardStore);
  readonly legalEntityStore = inject(LegalEntityStore);

  readonly isModal = input<boolean>(true);
  readonly initialDraftId = input<string | null>(null);
  readonly closed = output<void>();
  readonly saved = output<{ finalized: boolean; draftId?: string }>();

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
  readonly openAssignmentPickerId = signal<string | null>(null);
  readonly openPositionPickerId = signal<string | null>(null);
  readonly openEmployeePickerId = signal<string | null>(null);
  readonly positionSearch = signal('');
  readonly employeeSearch = signal('');

  /** Dedup key for the last-issued checklist-matches request, so re-rendering Step 2 doesn't re-fire it. */
  private checklistMatchesRequestKey: string | null = null;

  /** Last backend-suggested employee number — used to decide whether company changes may overwrite. */
  private lastSuggestedEmployeeNumber: string | null = null;
  private employeeNumberSuggestionRequestKey: string | null = null;
  private readonly employeeNumberEdits$ = new Subject<string>();
  private availabilitySub: Subscription | null = null;

  /** Live availability hint for the Employee number field (not a reservation). */
  readonly employeeNumberAvailability = signal<'idle' | 'checking' | 'available' | 'unavailable' | 'invalid' | 'error'>('idle');
  readonly employeeNumberGenerateError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    workEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    departmentId: ['', Validators.required],
    positionId: ['', Validators.required],
    employmentType: ['', Validators.required],
    startDate: ['', Validators.required],
    employeeNumber: ['', [Validators.required, Validators.maxLength(EMPLOYEE_NUMBER_MAX_LENGTH)]],
    workModeId: ['', Validators.required]
  });

  readonly hasCompany = computed(() => !!this.legalEntityStore.selectedLegalEntity());
  readonly stepIndex = computed(() => this.stepOrder.indexOf(this.store.step()));

  /** True once a resumed draft turns out to be terminal - the backend rejects any further save/finalize call against it. */
  readonly resumedDraftIsFinalized = computed(() => isTerminalDraft(this.store.lastSaveStatus(), this.store.lastSaveReason()));

  readonly workModeOptions = computed<readonly { value: string; label: string; code: string }[]>(() =>
    this.store.workModes().map((wm) => ({ value: String(wm.id), label: wm.label, code: wm.code }))
  );

  readonly selectedWorkModeLabel = computed(() => {
    const val = this.form.controls.workModeId.value;
    if (!val) return this.store.savedWorkModeLabel() ?? '—';
    const opt = this.workModeOptions().find((o) => o.value === val);
    return opt?.label ?? this.store.savedWorkModeLabel() ?? val;
  });

  readonly selectedDepartmentLabel = computed(() => {
    const val = this.form.controls.departmentId.value;
    if (!val) return this.store.savedDepartmentName() ?? '—';
    const opt = this.store.departments().find((o) => o.value === val);
    return opt?.label ?? this.store.savedDepartmentName() ?? val;
  });

  readonly selectedPositionLabel = computed(() => {
    const val = this.form.controls.positionId.value;
    if (!val) return this.store.savedPositionName() ?? '—';
    const opt = this.store.positions().find((o) => o.value === val);
    return opt?.label ?? this.store.savedPositionName() ?? val;
  });

  readonly positionFieldError = computed(() => {
    const vacancyMessage = this.store.positionValidationMessage();
    if (vacancyMessage) {
      return vacancyMessage;
    }
    return this.submitAttempted() && this.form.controls.positionId.invalid ? 'Position is required.' : '';
  });

  readonly selectedEmploymentTypeLabel = computed(() => {
    const val = this.form.controls.employmentType.value || this.store.formValue().employmentType;
    if (!val) return '—';
    const opt = this.employmentTypeOptions.find((o) => o.value === val);
    return opt ? opt.label : val;
  });

  readonly reviewFirstName = computed(() =>
    this.form.controls.firstName.value || this.store.formValue().firstName || '—'
  );

  readonly reviewLastName = computed(() =>
    this.form.controls.lastName.value || this.store.formValue().lastName || '—'
  );

  readonly reviewWorkEmail = computed(() =>
    this.form.controls.workEmail.value || this.store.formValue().workEmail || '—'
  );

  readonly reviewStartDate = computed(() =>
    this.form.controls.startDate.value || this.store.formValue().startDate || '—'
  );

  readonly reviewEmployeeNumber = computed(() =>
    this.form.controls.employeeNumber.value || this.store.formValue().employeeNumber || ''
  );

  readonly employeeNumberFieldError = computed(() => {
    const availability = this.employeeNumberAvailability();
    if (availability === 'invalid') {
      return EMPLOYEE_NUMBER_INVALID_FORMAT_MESSAGE;
    }
    if (availability === 'unavailable') {
      return EMPLOYEE_NUMBER_IN_USE_MESSAGE;
    }
    if (this.submitAttempted()) {
      const control = this.form.controls.employeeNumber;
      if (control.hasError('required') || !normalizeEmployeeNumber(control.value)) {
        return 'Employee number is required.';
      }
      if (control.hasError('maxlength')) {
        return 'Employee number must be 20 characters or fewer.';
      }
      if (availability === 'checking') {
        return 'Checking…';
      }
      if (availability === 'error') {
        return EMPLOYEE_NUMBER_GENERATE_FAILED_MESSAGE;
      }
    }
    return this.employeeNumberGenerateError() ?? '';
  });

  readonly employeeNumberFieldHint = computed(() => {
    if (this.employeeNumberFieldError()) {
      return '';
    }
    const availability = this.employeeNumberAvailability();
    if (availability === 'checking') {
      return 'Checking…';
    }
    if (availability === 'available') {
      return 'Available';
    }
    return '';
  });

  readonly employeeInitials = computed(() => {
    const fn = this.reviewFirstName();
    const ln = this.reviewLastName();
    const f = fn && fn !== '—' ? fn.charAt(0).toUpperCase() : '';
    const l = ln && ln !== '—' ? ln.charAt(0).toUpperCase() : '';
    return (f + l) || 'E';
  });

  readonly selectedReportingManagerName = computed(() => {
    const selectedId = this.store.selectedReportsToEmployeeId();
    if (selectedId) {
      const match = this.store.activeHolders().find((holder) => holder.employeeId === selectedId);
      if (match) {
        return `${match.firstName} ${match.lastName}`;
      }
    }
    return this.store.savedReportingManagerName() ?? '—';
  });

  readonly selectedReportingManagerPositionName = computed(() =>
    this.store.savedReportingManagerPositionName() ?? '—'
  );
  readonly newEmployeeDisplayName = computed(() => {
    const firstName = (this.form.controls.firstName.value || this.store.formValue().firstName || '').trim();
    const lastName = (this.form.controls.lastName.value || this.store.formValue().lastName || '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'New employee';
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
    if (reason === 'saved_manually') {
      return null;
    }
    return null;
  });

  constructor() {
    const routeDraftId = this.route.snapshot.queryParamMap.get('draftId');

    // The store is providedIn: 'root' and survives route navigation, so a fresh "+ Add Employee"
    // visit (no draftId) must clear out whatever an earlier finalized/in-progress draft left
    // behind - otherwise stale finalizeResult/lastSaveReason/draftId leak into the new wizard.
    if (!routeDraftId && !this.initialDraftId()) {
      this.store.reset();
      this.lastSuggestedEmployeeNumber = null;
      this.employeeNumberSuggestionRequestKey = null;
      this.employeeNumberAvailability.set('idle');
      this.employeeNumberGenerateError.set(null);
    }

    void this.store.loadWorkModes();

    this.availabilitySub = this.employeeNumberEdits$
      .pipe(
        debounceTime(350),
        map((value) => normalizeEmployeeNumber(value)),
        distinctUntilChanged(),
        switchMap((employeeNumber) => {
          if (!employeeNumber) {
            this.employeeNumberAvailability.set('idle');
            return of(null);
          }
          if (!isValidEmployeeNumberFormat(employeeNumber)) {
            this.employeeNumberAvailability.set('invalid');
            return of(null);
          }
          this.employeeNumberAvailability.set('checking');
          return this.peopleApi.checkEmployeeNumberAvailability(employeeNumber).pipe(
            catchError(() => {
              this.employeeNumberAvailability.set('error');
              return of(null);
            })
          );
        })
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }
        this.employeeNumberAvailability.set(result.available ? 'available' : 'unavailable');
      });

    // legalEntityStore.selectedLegalEntity() populates asynchronously (loadCompanies() resolves
    // after this component is constructed), so a one-time read here would miss it on a fresh
    // page load - this must stay reactive. Skipped entirely while resuming a draft, since
    // resumeExistingDraft() below sets the wizard's companyId from the draft's own
    // legalEntityId, which must not be clobbered by whatever company happens to be selected now.
    effect(() => {
      if (routeDraftId || this.initialDraftId()) {
        return;
      }
      const company = this.legalEntityStore.selectedLegalEntity();
      if (company && this.store.companyId() !== company.id) {
        this.store.setCompany(company.id);
      }
    });

    effect(() => {
      if (routeDraftId || this.initialDraftId()) {
        return;
      }
      const companyId = this.store.companyId();
      if (companyId) {
        void this.maybeSuggestEmployeeNumber(companyId);
      }
    });

    effect(() => {
      const storePositionId = this.store.positionId() ?? '';
      if (this.form.controls.positionId.value !== storePositionId) {
        this.form.controls.positionId.setValue(storePositionId);
      }
    });

    effect(() => {
      const inputDraftId = this.initialDraftId();
      if (inputDraftId && inputDraftId !== this.store.draftId()) {
        void this.resumeExistingDraft(inputDraftId);
      }
    });

    if (routeDraftId) {
      void this.resumeExistingDraft(routeDraftId);
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

  ngOnDestroy(): void {
    this.availabilitySub?.unsubscribe();
    this.employeeNumberEdits$.complete();
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
    this.lastSuggestedEmployeeNumber = null;
    if (formValue.employeeNumber) {
      this.employeeNumberSuggestionRequestKey = this.store.companyId();
      // Previously saved on the draft — treat as provisional available; finalize still re-checks.
      this.employeeNumberAvailability.set('available');
    } else if (this.store.companyId()) {
      this.employeeNumberSuggestionRequestKey = null;
      await this.maybeSuggestEmployeeNumber(this.store.companyId()!);
    }
  }

  onEmployeeNumberChange(value: string): void {
    this.form.controls.employeeNumber.setValue(value);
    this.employeeNumberGenerateError.set(null);
    this.employeeNumberEdits$.next(value);
  }

  /**
   * Auto-fills only when the field is empty/pristine or still equal to the prior suggestion.
   * Manual edits are never overwritten when the company/legal entity changes.
   */
  private async maybeSuggestEmployeeNumber(legalEntityId: string): Promise<void> {
    if (this.employeeNumberSuggestionRequestKey === legalEntityId) {
      return;
    }

    const current = normalizeEmployeeNumber(this.form.controls.employeeNumber.value);
    const canOverwrite =
      !current ||
      (this.lastSuggestedEmployeeNumber !== null && current === this.lastSuggestedEmployeeNumber);

    if (!canOverwrite) {
      this.employeeNumberSuggestionRequestKey = legalEntityId;
      return;
    }

    this.employeeNumberSuggestionRequestKey = legalEntityId;
    this.employeeNumberGenerateError.set(null);

    try {
      const suggestion = await firstValueFrom(this.peopleApi.getEmployeeNumberSuggestion(legalEntityId));
      const latest = normalizeEmployeeNumber(this.form.controls.employeeNumber.value);
      const stillSafe =
        !latest ||
        (this.lastSuggestedEmployeeNumber !== null && latest === this.lastSuggestedEmployeeNumber);
      if (!stillSafe) {
        return;
      }

      this.lastSuggestedEmployeeNumber = suggestion.employeeNumber;
      this.form.controls.employeeNumber.setValue(suggestion.employeeNumber);
      this.employeeNumberAvailability.set('available');
    } catch {
      if (!normalizeEmployeeNumber(this.form.controls.employeeNumber.value)) {
        this.employeeNumberGenerateError.set(EMPLOYEE_NUMBER_GENERATE_FAILED_MESSAGE);
        this.employeeNumberAvailability.set('error');
      }
    }
  }

  private hasBlockingEmployeeNumber(): boolean {
    const value = normalizeEmployeeNumber(this.form.controls.employeeNumber.value);
    if (!value || !isValidEmployeeNumberFormat(value)) {
      return true;
    }
    const availability = this.employeeNumberAvailability();
    return availability === 'unavailable' || availability === 'checking' || availability === 'invalid';
  }

  onWorkModeChange(workModeIdStr: string): void {
    this.form.controls.workModeId.setValue(workModeIdStr);
  }

  onDepartmentChange(departmentId: string): void {
    this.form.controls.departmentId.setValue(departmentId);
    this.form.controls.positionId.setValue('');
    // The store itself clears selectedTemplateId/selectedTemplateDetail as part of setDepartment().
    this.store.setPositionValidationMessage(null);
    this.store.setDepartment(departmentId);
    if (this.store.step() === 'checklist_template') {
      this.maybeLoadChecklistMatches();
    }
  }

  onPositionChange(positionId: string): void {
    this.form.controls.positionId.setValue(positionId);
    const reportsToPositionId = this.store.positionItems().find((p) => p.id === positionId)?.reportsToPositionId ?? null;
    void this.store.setPosition(positionId, reportsToPositionId);
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

  /** Switch a task between the new hire and another person. */
  async setTaskAssignee(clientId: string, assignee: 'employee' | 'another'): Promise<void> {
    this.store.updateDraftTask(clientId, { assignee });
    if (assignee === 'another') {
      this.openAssignmentPickerId.set(null);
      this.openPositionPickerId.set(clientId);
      this.openEmployeePickerId.set(null);
      this.positionSearch.set('');
      await this.store.ensureChecklistAssigneePositionsLoaded(true);
    } else {
      this.closeTaskPickers();
    }
  }

  onTaskPositionChange(clientId: string, positionId: string): void {
    this.store.updateDraftTask(clientId, { assigneePositionId: positionId || null, selectedAssigneeUserId: null });
    if (positionId) {
      this.openPositionPickerId.set(null);
      this.openEmployeePickerId.set(clientId);
      this.employeeSearch.set('');
    }
  }

  onTaskAssigneeUserChange(clientId: string, userId: string): void {
    this.store.updateDraftTask(clientId, { selectedAssigneeUserId: userId || null });
  }

  assigneesFor(positionId: string | null): readonly { userId: string; displayName: string }[] {
    if (!positionId) {
      return [];
    }
    return this.store.checklistAssigneesByPosition()[positionId] ?? [];
  }

  isLoadingAssignees(positionId: string | null): boolean {
    if (!positionId) {
      return false;
    }
    return !!this.store.loadingChecklistAssigneesByPosition()[positionId];
  }

  positionLabel(positionId: string | null): string {
    if (!positionId) {
      return '';
    }
    return this.store.checklistAssigneePositions().find((p) => p.value === positionId)?.label ?? '';
  }

  openTaskAssignmentPicker(clientId: string): void {
    this.openAssignmentPickerId.set(clientId);
    this.openPositionPickerId.set(null);
    this.openEmployeePickerId.set(null);
    this.positionSearch.set('');
    this.employeeSearch.set('');
  }

  async openTaskPositionPicker(clientId: string): Promise<void> {
    this.openAssignmentPickerId.set(null);
    this.openPositionPickerId.set(clientId);
    this.openEmployeePickerId.set(null);
    this.positionSearch.set('');
    await this.store.ensureChecklistAssigneePositionsLoaded(true);
  }

  openTaskEmployeePicker(clientId: string): void {
    this.openAssignmentPickerId.set(null);
    this.openPositionPickerId.set(null);
    this.openEmployeePickerId.set(clientId);
    this.employeeSearch.set('');
  }

  closeTaskPickers(): void {
    this.openAssignmentPickerId.set(null);
    this.openPositionPickerId.set(null);
    this.openEmployeePickerId.set(null);
    this.positionSearch.set('');
    this.employeeSearch.set('');
  }

  clearTaskAssignment(task: DraftChecklistTask): void {
    this.store.updateDraftTask(task.clientId, {
      assignee: 'another',
      assigneePositionId: null,
      selectedAssigneeUserId: null
    });
    this.openTaskAssignmentPicker(task.clientId);
  }

  clearTaskEmployee(task: DraftChecklistTask): void {
    this.store.updateDraftTask(task.clientId, { selectedAssigneeUserId: null });
  }

  filteredTaskPositions(): readonly SelectOption[] {
    const term = this.positionSearch().trim().toLowerCase();
    const positions = this.store.checklistAssigneePositions();
    if (!term) {
      return positions;
    }
    return positions.filter((pos) => pos.label.toLowerCase().includes(term));
  }

  filteredTaskAssignees(task: DraftChecklistTask): readonly { userId: string; displayName: string }[] {
    if (!task.assigneePositionId) {
      return [];
    }
    const term = this.employeeSearch().trim().toLowerCase();
    const assignees = this.assigneesFor(task.assigneePositionId);
    if (!term) {
      return assignees;
    }
    return assignees.filter((person) => person.displayName.toLowerCase().includes(term));
  }

  selectedTaskAssigneeName(task: DraftChecklistTask): string {
    if (!task.assigneePositionId || !task.selectedAssigneeUserId) {
      return '';
    }
    return this.assigneesFor(task.assigneePositionId).find((p) => p.userId === task.selectedAssigneeUserId)?.displayName ?? 'Selected employee';
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

  taskPositionError(task: DraftChecklistTask): string {
    return this.taskSubmitAttempted() ? (validateDraftTaskFields(task).position ?? '') : '';
  }

  taskAssigneeError(task: DraftChecklistTask): string {
    return this.taskSubmitAttempted() ? (validateDraftTaskFields(task).assignee ?? '') : '';
  }

  private hasBlockingReportsToPick(): boolean {
    return this.store.needsReportsToPick() && !this.store.selectedReportsToEmployeeId();
  }

  /** Gates Continue/Save Draft/Finalize: true when a checklist is selected and its draft-local
   *  tasks currently fail validation (mirrors the store's own saveDraft() check). */
  private hasBlockingTaskErrors(): boolean {
    return !!this.store.selectedTemplateId() && validateDraftTasks(this.store.draftTasks()).length > 0;
  }

  private validateSelectedPosition(): boolean {
    this.store.syncSelectionFromForm(
      this.form.controls.departmentId.value || null,
      this.form.controls.positionId.value || null
    );
    const issue = this.store.getPositionSelectionIssue(this.form.controls.positionId.value || this.store.positionId());
    if (!issue) {
      this.store.setPositionValidationMessage(null);
      return true;
    }

    if (issue === 'required') {
      this.store.setPositionValidationMessage('Position is required.');
      return false;
    }

    const message =
      issue === 'full'
        ? 'The selected position no longer has a vacancy. Choose another position.'
        : 'The selected position is no longer available. Choose another position.';
    this.store.clearInvalidPositionSelection(message);
    return false;
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
      if (!this.validateSelectedPosition() || this.form.invalid || this.hasBlockingReportsToPick() || this.hasBlockingEmployeeNumber()) {
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
    if (!this.validateSelectedPosition() || this.form.invalid || this.hasBlockingReportsToPick() || this.hasBlockingEmployeeNumber()) {
      return;
    }
    if (this.store.selectedTemplateId()) {
      this.taskSubmitAttempted.set(true);
    }

    const result = await this.store.saveDraft(this.store.step());
    if (result) {
      this.notificationService.success('Draft saved.');
      this.saved.emit({ finalized: false, draftId: result.id });
    } else {
      this.notificationService.error(this.store.saveError() ?? 'Something went wrong while saving the employee.');
    }
  }

  async onFinalize(): Promise<void> {
    if (this.store.finalizing() || this.store.saving()) {
      return;
    }
    this.submitAttempted.set(true);
    if (!this.validateSelectedPosition() || this.form.invalid || this.hasBlockingReportsToPick() || this.hasBlockingEmployeeNumber()) {
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
        this.saved.emit({ finalized: true, draftId });
        this.closed.emit();
        await this.router.navigate(['/people/employees']);
        this.store.reset();
      } else if (response.positionApprovalPending) {
        this.notificationService.info('Position approval was requested before the invitation can be sent.');
        this.saved.emit({ finalized: true, draftId });
        this.closed.emit();
        await this.router.navigate(['/people/employees']);
        this.store.reset();
      } else if (response.status === 'waiting_for_seat' || response.draftReason === 'waiting_for_seat') {
        this.notificationService.info('No seat is available. The draft was saved for follow-up.');
        this.saved.emit({ finalized: false, draftId });
      } else if (response.draftReason === 'seat_configuration_required') {
        this.notificationService.warning('Seat policy is not configured. The draft was saved, but invitation cannot be sent yet.');
        this.saved.emit({ finalized: false, draftId });
      } else if (response.draftReason === 'position_approval_rejected') {
        this.notificationService.error('Position approval was rejected.');
      } else {
        this.notificationService.success('Employee onboarding draft updated.');
        this.saved.emit({ finalized: true, draftId });
        this.closed.emit();
        await this.router.navigate(['/people/employees']);
        this.store.reset();
      }
    } else {
      this.notificationService.error(this.store.finalizeError() ?? 'Failed to finalize employee.');
    }
  }

  onCancel(): void {
    this.closed.emit();
    this.router.navigate(['/people/employees']);
  }

  canJumpToStep(targetIndex: number): boolean {
    return targetIndex < this.stepIndex();
  }

  jumpToStep(targetIndex: number): void {
    if (this.canJumpToStep(targetIndex)) {
      const targetStep = this.stepOrder[targetIndex];
      if (targetStep) {
        this.store.goToStep(targetStep);
      }
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement)?.classList.contains('add-emp-modal-backdrop')) {
      this.onCancel();
    }
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
