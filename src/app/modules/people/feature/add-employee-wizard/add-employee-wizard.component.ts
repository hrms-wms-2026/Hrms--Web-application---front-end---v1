import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, OnDestroy, output, signal, untracked } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, firstValueFrom, map, of, switchMap } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification.service';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { FileApiService, buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { PeopleApiService } from '../../data-access/people-api.service';
import { AddEmployeeWizardStore } from '../../state/add-employee-wizard.store';
import { EMPLOYMENT_TYPE_OPTIONS as ALL_EMPLOYMENT_TYPE_OPTIONS, SELECTABLE_EMPLOYMENT_TYPE_OPTIONS } from '../../models/employment-type-options';
import {
  FinalizeOnboardingDraftResponse,
  SELF_EMPLOYEE_CREATED,
  SelfPrefill,
  WizardStep,
  WorkModeOption
} from '../../models/onboarding-draft.model';
import { OnboardingApprovalPreview } from '../../models/access-grant-request.model';
import { ChecklistTemplateMatchLevel, ChecklistTemplateType, DraftChecklistTask } from '../../models/checklist-template.model';
import { UnsavedChangesService, DirtyFormHandle } from '../../../../shared/services/unsaved-changes.service';
import { DraftsStore } from '../../../../shared/state/drafts.store';
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
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

const MATCH_LEVEL_LABELS: Record<ChecklistTemplateMatchLevel, string> = {
  company: 'Company default',
  department: 'Department match',
  position: 'Position match'
};

const TEMPLATE_TYPE_LABELS: Record<ChecklistTemplateType, string> = {
  onboarding: 'Onboarding',
  offboarding: 'Offboarding'
};

const EMPLOYMENT_TYPE_OPTIONS: readonly SelectOption[] = SELECTABLE_EMPLOYMENT_TYPE_OPTIONS;

const STEP_ORDER: readonly WizardStep[] = ['employee_details', 'reporting', 'work_setup', 'checklist_template', 'review_and_submit'];
const STEP_LABELS: Record<WizardStep, string> = {
  employee_details: 'Identity',
  reporting: 'Reporting',
  work_setup: 'Work setup',
  checklist_template: 'Checklist',
  checklist_review: 'Checklist review',
  review_and_submit: 'Review'
};

/** Identity-step controls - workModeId belongs to the Work setup step and is validated there. */
const IDENTITY_CONTROLS = [
  'firstName',
  'lastName',
  'workEmail',
  'departmentId',
  'positionId',
  'employmentType',
  'startDate',
  'employeeNumber'
] as const;

@Component({
  selector: 'app-add-employee-wizard',
  host: { '[animate.leave]': "isModal() ? 'ui-popup-leave' : ''" },
  standalone: true,
  imports: [StopClickPropagationDirective, 
    HasPermissionDirective,
    RouterLink,
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
export class AddEmployeeWizardComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly peopleApi = inject(PeopleApiService);
  private readonly unsaved = inject(UnsavedChangesService);
  private readonly draftsStore = inject(DraftsStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fileApi = inject(FileApiService);

  readonly store = inject(AddEmployeeWizardStore);
  readonly legalEntityStore = inject(LegalEntityStore);

  readonly isModal = input<boolean>(true);
  readonly initialDraftId = input<string | null>(null);
  /** "Add yourself as an employee": prefills the signed-in user's name and email and locks the email,
   *  so the backend finalizes the draft onto their own login with no invitation. */
  readonly selfPrefill = input<SelfPrefill | null>(null);
  readonly closed = output<void>();
  readonly saved = output<{ finalized: boolean; draftId?: string; self?: boolean }>();

  private baseline: string | null = null;

  private snapshot(): string {
    return JSON.stringify([
      this.form.getRawValue(),
      this.store.companyId(),
      this.store.departmentId(),
      this.store.positionId(),
      this.store.selectedTemplateId(),
      this.store.selectedReportsToEmployeeId(),
      this.store.photoRequiredOverride(),
      this.store.locationCaptureOverride(),
      this.store.avatarFileId()
    ]);
  }

  private markClean(): void {
    this.baseline = this.snapshot();
    // Whatever photo is on the form now is saved (or is the starting state) - no longer ours to delete.
    this.sessionAvatarUploads?.clear();
  }

  private readonly guardHandle: DirtyFormHandle = {
    isDirty: () => this.baseline !== null && this.snapshot() !== this.baseline,
    canSaveDraft: () => !!this.store.companyId(),
    saveDraft: async () => {
      const res = await this.store.saveDraft(this.store.step(), { partial: true });
      if (res) {
        this.markClean();
        void this.draftsStore.load();
        return true;
      }
      return false;
    },
    discard: () => {
      for (const fileId of this.sessionAvatarUploads) {
        this.fileApi.delete(fileId).subscribe({ error: () => undefined });
      }
      this.sessionAvatarUploads.clear();
    },
    saveDraftError: () => this.store.saveError()
  };

  readonly employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS;
  readonly stepOrder = STEP_ORDER;
  readonly stepLabels = STEP_LABELS;
  readonly submitAttempted = signal(false);
  readonly reportingAttempted = signal(false);
  readonly workSetupAttempted = signal(false);
  readonly managerSearch = signal('');
  private readonly resumeInFlight = signal(false);

  /** Profile photo (Identity step). */
  readonly avatarUploading = signal(false);
  readonly avatarError = signal<string | null>(null);
  /** Object URL of a photo picked in this session - shown instantly, no round trip. */
  private readonly localAvatarUrl = signal<string | null>(null);
  /** An unlinked upload is only readable by whoever uploaded it, so another HR user resuming
   *  the draft gets a 404 - fall back to a "Photo attached" placeholder instead of a broken image. */
  private readonly avatarPreviewFailed = signal(false);
  /** Files uploaded by this wizard session and not yet saved - safe to delete when replaced. */
  private readonly sessionAvatarUploads = new Set<string>();

  readonly avatarPreviewUrl = computed(() => {
    const local = this.localAvatarUrl();
    if (local) return local;
    const fileId = this.store.avatarFileId();
    return fileId && !this.avatarPreviewFailed() ? buildFileUrl(fileId) : null;
  });
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
    startDate: [todayDateOnly(), Validators.required],
    employeeNumber: ['', [Validators.required, Validators.maxLength(EMPLOYEE_NUMBER_MAX_LENGTH)]],
    workModeId: ['', Validators.required]
  });

  readonly hasCompany = computed(() => !!this.legalEntityStore.selectedLegalEntity());
  readonly stepIndex = computed(() => this.stepOrder.indexOf(this.store.step()));

  /** True once a resumed draft turns out to be terminal - the backend rejects any further save/finalize call against it. */
  readonly resumedDraftIsFinalized = computed(() => isTerminalDraft(this.store.lastSaveStatus(), this.store.lastSaveReason()));

  readonly workModeOptions = computed<readonly { value: string; label: string }[]>(() =>
    this.store.workModes().map((wm) => ({ value: wm.id, label: wm.label }))
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
    // Full list, so a draft saved before "Intern" was retired still shows a readable label.
    const opt = ALL_EMPLOYMENT_TYPE_OPTIONS.find((o) => o.value === val);
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

  /** In-field availability marker for the employee number (replaces the old "Available" text). */
  readonly employeeNumberStatus = computed<'ok' | 'bad' | 'checking' | null>(() => {
    switch (this.employeeNumberAvailability()) {
      case 'available':
        return 'ok';
      case 'unavailable':
      case 'invalid':
        return 'bad';
      case 'checking':
        return 'checking';
      default:
        return null;
    }
  });

  readonly employeeNumberStatusLabel = computed(() => {
    switch (this.employeeNumberAvailability()) {
      case 'available':
        return 'Employee number is available';
      case 'unavailable':
        return EMPLOYEE_NUMBER_IN_USE_MESSAGE;
      case 'invalid':
        return EMPLOYEE_NUMBER_INVALID_FORMAT_MESSAGE;
      case 'checking':
        return 'Checking availability…';
      default:
        return null;
    }
  });

  /** Text under the field: only once Continue was pressed (the icon covers live feedback), or a
   *  failed auto-suggestion, which the icon can't express. */
  readonly employeeNumberInlineError = computed(() =>
    this.submitAttempted() ? this.employeeNumberFieldError() : (this.employeeNumberGenerateError() ?? '')
  );

  readonly employeeInitials = computed(() => {
    const fn = this.reviewFirstName();
    const ln = this.reviewLastName();
    const f = fn && fn !== '—' ? fn.charAt(0).toUpperCase() : '';
    const l = ln && ln !== '—' ? ln.charAt(0).toUpperCase() : '';
    return (f + l) || 'E';
  });

  readonly selectedReportingManagerName = computed(() =>
    this.selectedManagerSummary()?.name ?? this.store.savedReportingManagerName() ?? '—'
  );

  readonly selectedReportingManagerPositionName = computed(() =>
    this.selectedManagerSummary()?.positionName ??
    this.reportsToPositionName() ??
    this.store.savedReportingManagerPositionName() ??
    '—'
  );

  /** The picked manager is not a holder of the position above - a one-off line for this employee. */
  readonly isOutsideHierarchy = computed(() => {
    const managerId = this.store.selectedReportsToEmployeeId();
    return !!managerId
      && !this.store.loadingActiveHolders()
      && !this.store.activeHolders().some((h) => h.employeeId === managerId);
  });

  /** Card for a one-off manager: from the search pick, or (resumed draft) the preview's manager node. */
  readonly customManagerCard = computed(() => {
    if (!this.isOutsideHierarchy()) return null;
    const custom = this.store.customManager();
    if (custom) return custom;
    const managerId = this.store.selectedReportsToEmployeeId();
    const node = this.store.reportingChain().at(-1);
    return node && node.employeeId === managerId
      ? { employeeId: node.employeeId!, firstName: node.firstName ?? '', lastName: node.lastName ?? '', positionName: node.positionName ?? '', departmentName: node.departmentName }
      : null;
  });

  /** Name + "Position, Department" of whoever the employee will report to, from any source. */
  readonly selectedManagerSummary = computed<{ name: string; positionName: string | null; meta: string } | null>(() => {
    const managerId = this.store.effectiveManagerId();
    if (!managerId) return null;
    const holder = this.store.activeHolders().find((h) => h.employeeId === managerId);
    if (holder) {
      const positionName = this.reportsToPositionName();
      return { name: `${holder.firstName} ${holder.lastName}`, positionName, meta: this.joinMeta(positionName, holder.departmentName, ', ') };
    }
    const custom = this.customManagerCard();
    if (custom) {
      return {
        name: `${custom.firstName} ${custom.lastName}`,
        positionName: custom.positionName,
        meta: this.joinMeta(custom.positionName, custom.departmentName, ', ')
      };
    }
    return null;
  });

  /** Search hits that aren't already offered as a recommended manager. */
  readonly otherCandidates = computed(() => {
    const holderIds = new Set(this.store.activeHolders().map((h) => h.employeeId));
    return this.store.managerCandidates().filter((c) => !holderIds.has(c.employeeId));
  });

  readonly managerSearchHits = computed(() => this.otherCandidates().map((c) => c.employeeId));

  private readonly selectedPositionItem = computed(() => {
    const positionId = this.form.controls.positionId.value || this.store.positionId();
    return this.store.positionItems().find((p) => p.id === positionId) ?? null;
  });

  /** The position the new employee's position reports to (null = organisation root). */
  readonly reportsToPositionId = computed(() => this.selectedPositionItem()?.reportsToPositionId ?? null);

  readonly reportsToPositionName = computed(() =>
    this.selectedPositionItem()?.reportsToPositionName ?? this.store.savedReportingManagerPositionName() ?? null
  );

  readonly newEmployeeDisplayName = computed(() => {
    const firstName = (this.form.controls.firstName.value || this.store.formValue().firstName || '').trim();
    const lastName = (this.form.controls.lastName.value || this.store.formValue().lastName || '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'New employee';
  });

  /** Who will have to approve this person (position access / seat increase), loaded on the review step. */
  readonly approvalPreview = signal<OnboardingApprovalPreview | null>(null);

  /** One line per approval this person needs, naming who decides it. */
  readonly approvalLines = computed(() => {
    const preview = this.approvalPreview();
    if (!preview) {
      return [];
    }
    const names = (list: readonly { name: string }[]) => (list.length ? list.map((a) => a.name).join(', ') : 'nobody yet - ask an admin to grant the permission');
    const lines: { key: string; label: string; approvers: string }[] = [];
    if (preview.positionApprovalRequired && !preview.positionApprovalBypassed) {
      lines.push({ key: 'position', label: 'This position needs access approval from', approvers: names(preview.positionApprovers) });
    }
    if (preview.seatsAvailable === false) {
      lines.push({ key: 'seat', label: 'No seat is free - a seat increase will be requested from', approvers: names(preview.seatApprovers) });
    }
    return lines;
  });

  readonly saveReasonMessage = computed(() => {
    const reason = this.store.lastSaveReason();
    if (!reason) {
      return null;
    }
    if (reason === 'waiting_for_seat') {
      return 'Saved as a draft: no seat is currently available. A seat increase request was sent to the billing managers in their Inbox; finalize this draft again once it is approved.';
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

    effect(() => {
      const companyId = this.store.companyId();
      if (companyId) {
        void this.store.loadWorkModes(companyId);
      }
    });

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
        if (!this.form.dirty) {
          this.markClean();
        }
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

    // Work setup needs a selected work mode: pre-select the first one (the backend orders them
    // by DisplayOrder) the moment both the step and the mode list are ready. Never overwrites
    // an existing choice, so a resumed draft keeps its saved mode.
    effect(() => {
      // While a draft is resuming, the form is only patched once the whole resume chain finishes -
      // don't mistake that gap for "no choice". Tracked, so this re-runs when the resume settles.
      if (this.resumeInFlight() || this.store.step() !== 'work_setup' || this.store.workModes().length === 0) {
        return;
      }
      const firstModeId = this.store.workModes()[0].id;
      untracked(() => {
        const chosen = this.form.controls.workModeId.value || this.store.formValue().workModeId;
        if (!chosen) {
          const wasClean = !this.guardHandle.isDirty();
          this.form.controls.workModeId.setValue(firstModeId);
          if (wasClean) {
            this.markClean();
          }
        }
        void this.store.loadClockInDefaults(this.form.controls.workModeId.value || chosen);
      });
    });

    // Review step: who will have to approve this person (re-fetched when the position changes).
    effect((onCleanup) => {
      if (this.store.step() !== 'review_and_submit') {
        return;
      }
      const positionId = this.store.positionId();
      const sub = this.peopleApi.getOnboardingApprovalPreview(positionId ?? null).subscribe({
        next: (preview) => this.approvalPreview.set(preview),
        error: () => this.approvalPreview.set(null),
      });
      onCleanup(() => sub.unsubscribe());
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

    // "Add yourself as an employee": fill in the signed-in user's identity and lock the email, which is what
    // makes the backend finalize onto their own login (no invitation). getRawValue() still sends it.
    effect(() => {
      const prefill = this.selfPrefill();
      if (!prefill) return;
      untracked(() => {
        this.form.patchValue({ firstName: prefill.firstName, lastName: prefill.lastName, workEmail: prefill.workEmail });
        this.form.controls.workEmail.disable();
      });
    });

    this.form.valueChanges.subscribe(() => {
      // Mid-resume the store holds the draft and the still-empty form must not overwrite it
      // (e.g. the positionId sync effect emits the whole form); synced once the resume settles.
      // getRawValue(), not the emitted value: a disabled control (the locked email in self mode) is
      // left out of `value`, which would blank it in the saved draft.
      if (!this.resumeInFlight()) {
        this.syncFormToStore(this.form.getRawValue());
      }
    });
    if (!routeDraftId) {
      // Push the defaults (e.g. today's start date) into the store so a draft saved untouched keeps them.
      this.syncFormToStore(this.form.getRawValue());
    }

    this.markClean();
    const unregisterGuard = this.unsaved.register(this.guardHandle);
    this.destroyRef.onDestroy(() => unregisterGuard());
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;

    this.avatarError.set(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.avatarError.set('Use a JPG, PNG or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.avatarError.set('The photo must be 5MB or smaller.');
      return;
    }

    this.avatarUploading.set(true);
    try {
      const uploaded = await firstValueFrom(this.fileApi.upload(file, 'employee_avatar'));
      const previous = this.store.avatarFileId();
      this.sessionAvatarUploads.add(uploaded.fileId);
      this.store.setAvatarFileId(uploaded.fileId);
      this.setLocalAvatarUrl(URL.createObjectURL(file));
      this.discardSessionUpload(previous);
    } catch (err: unknown) {
      this.avatarError.set(toSafeErrorMessage(err, 'The photo could not be uploaded. Try again.'));
    } finally {
      this.avatarUploading.set(false);
    }
  }

  removeAvatar(): void {
    const previous = this.store.avatarFileId();
    this.store.setAvatarFileId(null);
    this.setLocalAvatarUrl(null);
    this.avatarError.set(null);
    this.discardSessionUpload(previous);
  }

  onAvatarPreviewError(): void {
    if (!this.localAvatarUrl()) {
      this.avatarPreviewFailed.set(true);
    }
  }

  private setLocalAvatarUrl(url: string | null): void {
    const old = this.localAvatarUrl();
    if (old) URL.revokeObjectURL(old);
    this.localAvatarUrl.set(url);
    this.avatarPreviewFailed.set(false);
  }

  /** Deletes a replaced/removed photo only if this session uploaded it - a photo already saved on
   *  the draft stays, since the user may still cancel without saving. */
  private discardSessionUpload(fileId: string | null): void {
    if (!fileId || !this.sessionAvatarUploads.has(fileId)) return;
    this.sessionAvatarUploads.delete(fileId);
    this.fileApi.delete(fileId).subscribe({ error: () => undefined });
  }

  ngOnDestroy(): void {
    this.setLocalAvatarUrl(null);
    if (this.managerSearchTimer) clearTimeout(this.managerSearchTimer);
    this.availabilitySub?.unsubscribe();
    this.employeeNumberEdits$.complete();
  }

  private async resumeExistingDraft(draftId: string): Promise<void> {
    this.resumeInFlight.set(true);
    try {
      await this.resumeExistingDraftCore(draftId);
    } finally {
      this.resumeInFlight.set(false);
    }
    if (!this.store.resumeError()) {
      this.syncFormToStore(this.form.getRawValue());
      this.markClean();
    }
  }

  private syncFormToStore(value: Partial<ReturnType<typeof this.form.getRawValue>>): void {
    this.store.updateFormValue({
      firstName: value.firstName ?? '',
      lastName: value.lastName ?? '',
      workEmail: value.workEmail ?? '',
      employmentType: value.employmentType ?? '',
      startDate: value.startDate ?? '',
      employeeNumber: value.employeeNumber ?? '',
      workModeId: value.workModeId || null
    });
  }

  private async resumeExistingDraftCore(draftId: string): Promise<void> {
    await this.store.resumeDraft(draftId);
    if (this.store.resumeError()) {
      this.notificationService.error(this.store.resumeError()!);
      return;
    }
    if (!this.stepOrder.includes(this.store.step())) {
      // Drafts saved by the older 3-step wizard (or the retired checklist_review step).
      this.store.goToStep('employee_details');
    }
    const formValue = this.store.formValue();
    this.form.patchValue({
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      workEmail: formValue.workEmail,
      departmentId: this.store.departmentId() ?? '',
      positionId: this.store.positionId() ?? '',
      employmentType: formValue.employmentType,
      startDate: formValue.startDate || todayDateOnly(),
      employeeNumber: formValue.employeeNumber,
      workModeId: formValue.workModeId ?? ''
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
    this.markClean();
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
      if (!this.form.dirty) {
        this.markClean();
      }
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
    if (this.form.controls.workModeId.value === workModeIdStr) {
      return;
    }
    this.form.controls.workModeId.setValue(workModeIdStr);
    // Overrides were relative to the previous mode's defaults - start fresh from the new mode.
    this.store.clearClockInOverrides();
    void this.store.loadClockInDefaults(workModeIdStr);
  }

  workModeKind(mode: WorkModeOption): 'daily' | 'self' | 'office' {
    if (mode.allowsDailyLocationChoice) return 'daily';
    if (mode.selfRegistersLocation) return 'self';
    return 'office';
  }

  workModeDescription(mode: WorkModeOption): string {
    switch (this.workModeKind(mode)) {
      case 'daily':
        return 'Chooses office, home or elsewhere each day';
      case 'self':
        return 'Works from their own registered location';
      default:
        return 'Works from the company office';
    }
  }

  initialsOf(firstName: string | null | undefined, lastName: string | null | undefined): string {
    const f = (firstName ?? '').trim().charAt(0).toUpperCase();
    const l = (lastName ?? '').trim().charAt(0).toUpperCase();
    return f + l || '?';
  }

  joinMeta(a: string | null | undefined, b: string | null | undefined, separator = ' · '): string {
    return [a, b].filter((part) => !!part && part.trim()).join(separator);
  }

  private managerSearchTimer: ReturnType<typeof setTimeout> | null = null;

  onManagerSearch(term: string): void {
    this.managerSearch.set(term);
    if (this.managerSearchTimer) clearTimeout(this.managerSearchTimer);
    this.managerSearchTimer = setTimeout(() => void this.store.searchManagers(term), 250);
  }

  retryLoadWorkModes(): void {
    const companyId = this.store.companyId();
    if (companyId) {
      void this.store.loadWorkModes(companyId);
    }
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

  private hasIdentityErrors(): boolean {
    return IDENTITY_CONTROLS.some((name) => this.form.controls[name].invalid);
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
    const step = this.store.step();
    if (step === 'employee_details') {
      this.submitAttempted.set(true);
      if (!this.validateSelectedPosition() || this.hasIdentityErrors() || this.hasBlockingEmployeeNumber()) {
        return;
      }
    }
    if (step === 'reporting') {
      this.reportingAttempted.set(true);
      if (this.store.loadingActiveHolders() || this.hasBlockingReportsToPick()) {
        return;
      }
    }
    if (step === 'work_setup') {
      this.workSetupAttempted.set(true);
      if (this.form.controls.workModeId.invalid) {
        return;
      }
    }
    if (step === 'checklist_template' && this.store.selectedTemplateId()) {
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

    const result = await this.store.saveDraft(this.store.step(), { partial: true });
    if (result) {
      this.notificationService.success('Draft saved.');
      this.saved.emit({ finalized: false, draftId: result.id });
      this.markClean();
      void this.draftsStore.load();
    } else {
      this.notificationService.error(this.store.saveError() ?? 'Something went wrong while saving the employee.');
    }
  }

  async onFinalize(): Promise<void> {
    if (this.store.finalizing() || this.store.saving()) {
      return;
    }
    this.submitAttempted.set(true);
    this.reportingAttempted.set(true);
    this.workSetupAttempted.set(true);
    if (!this.validateSelectedPosition() || this.hasIdentityErrors() || this.hasBlockingEmployeeNumber()) {
      this.store.goToStep('employee_details');
      return;
    }
    if (this.hasBlockingReportsToPick()) {
      this.store.goToStep('reporting');
      return;
    }
    if (this.form.controls.workModeId.invalid) {
      this.store.goToStep('work_setup');
      return;
    }
    if (this.store.selectedTemplateId()) {
      this.taskSubmitAttempted.set(true);
    }

    // Always flush the form via saveDraft() first, even when a draftId already exists (a resumed
    // or previously saved draft): finalize validates the persisted draft, so any field edited since
    // the last save (e.g. a start date added after "Save Draft") or checklist task edits would
    // otherwise be missing on the backend and finalize fails with a stale-data error.
    const saved = await this.store.saveDraft(this.store.step());
    if (!saved) {
      this.notificationService.error(this.store.saveError() ?? 'Failed to save draft before finalization.');
      return;
    }
    const draftId = saved.id;

    const response = await this.store.finalizeDraft(draftId);
    if (response) {
      await this.applyFinalizeResponse(response, draftId);
    } else {
      this.notificationService.error(this.store.finalizeError() ?? 'Failed to finalize employee.');
    }
  }

  /** What the wizard does with a successful finalize answer. Public so specs can drive it directly. */
  async applyFinalizeResponse(response: FinalizeOnboardingDraftResponse, draftId: string): Promise<void> {
    if (response.messageKey === SELF_EMPLOYEE_CREATED) {
      // Your own profile: no invitation, and you stay where you started (the home screen reloads).
      this.notificationService.success("You're set up as an employee");
      this.saved.emit({ finalized: true, draftId, self: true });
      this.closed.emit();
      void this.draftsStore.load();
      this.store.reset();
    } else if (response.invitationQueued && !response.positionApprovalPending) {
      this.notificationService.success('Employee onboarding invitation was queued.');
      this.saved.emit({ finalized: true, draftId });
      this.closed.emit();
      void this.draftsStore.load();
      await this.router.navigate(['/people/employees']);
      this.store.reset();
    } else if (response.positionApprovalPending) {
      this.notificationService.info('Position approval was requested before the invitation can be sent.');
      this.saved.emit({ finalized: true, draftId });
      this.closed.emit();
      void this.draftsStore.load();
      await this.router.navigate(['/people/employees']);
      this.store.reset();
    } else if (response.status === 'waiting_for_seat' || response.draftReason === 'waiting_for_seat') {
      this.notificationService.info('No seat is available. The draft was saved for follow-up.');
      this.saved.emit({ finalized: false, draftId });
      void this.draftsStore.load();
    } else if (response.draftReason === 'seat_configuration_required') {
      this.notificationService.warning('Seat policy is not configured. The draft was saved, but invitation cannot be sent yet.');
      this.saved.emit({ finalized: false, draftId });
      void this.draftsStore.load();
    } else if (response.draftReason === 'position_approval_rejected') {
      this.notificationService.error('Position approval was rejected.');
    } else {
      this.notificationService.success('Employee onboarding draft updated.');
      this.saved.emit({ finalized: true, draftId });
      this.closed.emit();
      void this.draftsStore.load();
      await this.router.navigate(['/people/employees']);
      this.store.reset();
    }
  }

  async onCancel(): Promise<void> {
    if (!(await this.unsaved.requestClose(this.guardHandle))) return;
    this.closed.emit();
    if (!this.isModal()) {
      void this.router.navigate(['/people/employees']);
    }
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
}

/** Today's date (browser-local) as YYYY-MM-DD - the default start date for a new employee. */
function todayDateOnly(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
