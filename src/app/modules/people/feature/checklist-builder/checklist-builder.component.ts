import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectionPositionPair } from '@angular/cdk/overlay';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { PeopleApiService } from '../../data-access/people-api.service';
import { ChecklistAssignee } from '../../models/checklist-template.model';
import {
  ChecklistTaskAssignmentType,
  ChecklistTaskOwnerType,
  ChecklistTaskPriority,
  ChecklistTemplateScopeLevel,
  ChecklistTemplateTaskAttachment,
  ChecklistTemplateTaskRequest,
  ChecklistTemplateType,
  CreateChecklistTemplateRequest,
  UpdateChecklistTemplateRequest
} from '../../models/checklist-template.model';
import { ChecklistTaskCategory } from '../../models/offboarding.model';
import { ChecklistTemplateStore } from '../../state/checklist-template.store';
import { ChecklistTaskDetailDialogComponent } from '../../ui/checklist-task-detail-dialog/checklist-task-detail-dialog.component';
import { TaskApiService } from '../../../work/data-access/task-api.service';
import { AttachmentPill } from '../../../work/ui/task-attachment-list/task-attachment-list.component';

const TASK_PLACEHOLDERS: readonly string[] = [
  'Collect signed contract',
  'Prepare company laptop',
  'Review company policies',
  'Schedule team orientation',
  'Set up system access & email'
];

/** Backend ownerType for position-resolved non-employee tasks (see ChecklistTemplateTaskInputResolver). */
const POSITION_ASSIGNEE_OWNER_TYPE: ChecklistTaskOwnerType = 'custom_user';

function nonNegativeIntegerValidator(control: AbstractControl): ValidationErrors | null {
  if (control.value === null || control.value === undefined || control.value === '') {
    return null;
  }
  const numeric = Number(control.value);
  return Number.isInteger(numeric) && numeric >= 0 ? null : { notNonNegativeInteger: true };
}

export interface ChecklistTaskFormValue {
  title: string;
  assignmentType: ChecklistTaskAssignmentType;
  assigneePositionId: string;
  selectedAssigneeUserId?: string;
  /** Assignee user id carried through unchanged from a loaded template task whose
   *  ownerType was resolved server-side from a position. Backend never returns the
   *  original assigneePositionId, so re-saving an untouched row must resend this
   *  instead of forcing HR to re-pick a position. */
  originalAssignedToId?: string;
  dueOffsetDays: number;
  isRequired: boolean;
  isBypassable: boolean;
  bypassPenaltyDescription: string;
  category: ChecklistTaskCategory | '';
  description?: string;
  priority?: ChecklistTaskPriority;
  attachments?: AttachmentPill[];
  /** Attachments uploaded in this builder session, not yet saved on the template. */
  pendingFileIds?: string[];
}

@Component({
  selector: 'app-checklist-builder',
  host: { '[animate.leave]': "open() ? 'ui-popup-leave' : ''" },
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    InputComponent,
    LoaderComponent,
    SelectComponent,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    ChecklistTaskDetailDialogComponent
  ],
  templateUrl: './checklist-builder.component.html',
  styleUrl: './checklist-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChecklistBuilderComponent {
  readonly taskCategoryOptions: readonly SelectOption[] = [
    { value: '', label: 'No category' },
    { value: 'asset_return', label: 'Asset Return' },
    { value: 'access_removal', label: 'Access Removal' },
    { value: 'document_handover', label: 'Document Handover' },
    { value: 'final_settlement', label: 'Final Settlement' },
    { value: 'knowledge_handover', label: 'Knowledge Handover' },
    { value: 'other', label: 'Other' }
  ];

  readonly open = input<boolean>(true);
  // Aliased because `templateId` is the internal signal that also tracks the route parameter.
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly templateIdInput = input<string | null>(null, { alias: 'templateId' });

  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly store = inject(ChecklistTemplateStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly elRef = inject(ElementRef);
  private readonly legalEntityStore = inject(LegalEntityStore);
  private readonly departmentApi = inject(DepartmentApiService);
  private readonly positionApi = inject(PositionApiService);
  private readonly peopleApi = inject(PeopleApiService);
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);
  private readonly taskApi = inject(TaskApiService);

  readonly canWrite = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly selectedCompany = this.legalEntityStore.selectedLegalEntity;
  readonly isEdit = signal(false);
  readonly templateId = signal<string | null>(null);
  readonly initialLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly submitAttempted = signal(false);
  readonly pickerPositions: ConnectionPositionPair[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 }
  ];
  readonly openTaskDetailIndex = signal<number | null>(null);
  readonly openAssignmentPickerIndex = signal<number | null>(null);
  readonly openPositionPickerIndex = signal<number | null>(null);
  readonly openEmployeePickerIndex = signal<number | null>(null);
  readonly positionSearch = signal('');
  readonly employeeSearch = signal('');
  readonly assigneesByPosition = signal<Readonly<Record<string, readonly ChecklistAssignee[]>>>({});
  readonly loadingAssigneesByPosition = signal<Readonly<Record<string, boolean>>>({});

  readonly scopeLevel = signal<ChecklistTemplateScopeLevel>('company');

  readonly departments = signal<readonly SelectOption[]>([]);
  /** Positions filtered for checklist applicability (scope) selection. */
  readonly positions = signal<readonly SelectOption[]>([]);
  /** All company positions for task assignee selection. */
  readonly assigneePositions = signal<readonly SelectOption[]>([]);
  readonly loadingDepartments = signal(false);
  readonly loadingPositions = signal(false);
  readonly loadingAssigneePositions = signal(false);
  readonly selectedCompanyId = computed(() => this.selectedCompany()?.id ?? null);
  readonly filteredAssigneePositions = computed(() => {
    const term = this.positionSearch().trim().toLowerCase();
    if (!term) {
      return this.assigneePositions();
    }
    return this.assigneePositions().filter((pos) => pos.label.toLowerCase().includes(term));
  });
  readonly activeEmployeePickerTask = linkedSignal(() => {
    const index = this.openEmployeePickerIndex();
    return index === null ? null : this.tasksArray.at(index);
  });
  readonly filteredEmployeeOptions = computed(() => {
    const taskGroup = this.activeEmployeePickerTask();
    const positionId = taskGroup?.get('assigneePositionId')?.value;
    if (!positionId) {
      return [];
    }
    const term = this.employeeSearch().trim().toLowerCase();
    const assignees = this.assigneesByPosition()[positionId] ?? [];
    if (!term) {
      return assignees;
    }
    return assignees.filter((person) =>
      `${person.displayName} ${person.workEmail}`.toLowerCase().includes(term)
    );
  });

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    templateType: ['onboarding' as ChecklistTemplateType, Validators.required],
    scopeLevel: ['company' as ChecklistTemplateScopeLevel, Validators.required],
    departmentId: [''],
    positionId: [''],
    tasks: this.fb.array<FormGroup>([])
  });

  get tasksArray(): FormArray<FormGroup> {
    return this.form.controls.tasks;
  }

  constructor() {
    this.form.controls.templateType.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.cdr.markForCheck();
    });

    effect(() => {
      const isOpen = this.open();
      const company = this.selectedCompany();
      if (isOpen && company) {
        void this.loadDepartments(company.id);
        void this.loadAssigneePositions(company.id);
        if (this.form.controls.departmentId.value) {
          void this.loadPositions(company.id, this.form.controls.departmentId.value);
        }
      }
    });

    effect(() => {
      const isOpen = this.open();
      const inputId = this.templateIdInput();
      if (!isOpen) {
        return;
      }

      const id = inputId ?? this.route.snapshot.paramMap.get('id');
      if (id) {
        this.isEdit.set(true);
        this.templateId.set(id);
        void this.loadTemplateForEdit(id);
      } else {
        this.isEdit.set(false);
        this.templateId.set(null);
        this.resetCreateForm();
      }
    });
  }

  private resetCreateForm(): void {
    this.submitAttempted.set(false);
    this.loadError.set(null);
    this.form.reset({
      name: '',
      templateType: 'onboarding',
      scopeLevel: 'company',
      departmentId: '',
      positionId: ''
    });
    this.scopeLevel.set('company');
    this.applyScopeValidators('company');
    this.tasksArray.clear();
    this.addTask();
    this.closeTaskPickers();
    this.cdr.markForCheck();
  }

  private async loadTemplateForEdit(id: string): Promise<void> {
    this.initialLoading.set(true);
    this.loadError.set(null);
    this.cdr.markForCheck();

    try {
      const detail = await this.store.getTemplate(id);
      if (!detail) {
        this.loadError.set('Checklist template not found or failed to load.');
        return;
      }

      let scope: ChecklistTemplateScopeLevel = 'company';
      if (detail.positionId) {
        scope = 'position';
      } else if (detail.departmentId) {
        scope = 'department';
      }

      this.scopeLevel.set(scope);
      this.applyScopeValidators(scope);
      this.form.patchValue({
        name: detail.name,
        templateType: detail.templateType,
        scopeLevel: scope,
        departmentId: detail.departmentId ?? '',
        positionId: detail.positionId ?? ''
      });

      this.tasksArray.clear();
      if (detail.tasks && detail.tasks.length > 0) {
        detail.tasks.forEach((t) =>
          this.addTask({
            title: t.title,
            ownerType: t.ownerType as ChecklistTaskOwnerType,
            assignedToId: t.assignedToId,
            dueOffsetDays: t.dueOffsetDays,
            isRequired: t.isRequired,
            isBypassable: t.isBypassable,
            bypassPenaltyDescription: t.bypassPenaltyDescription ?? '',
            category: t.category ?? '',
            description: t.description ?? '',
            priority: t.priority ?? 'medium',
            attachments: t.attachments ?? []
          })
        );
      } else {
        this.addTask();
      }

      const company = this.selectedCompany();
      if (company && detail.departmentId) {
        void this.loadPositions(company.id, detail.departmentId);
      }
    } catch {
      this.loadError.set('An error occurred while loading the checklist template.');
    } finally {
      this.initialLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  setTemplateType(type: ChecklistTemplateType): void {
    if (this.isEdit()) return;
    this.form.controls.templateType.setValue(type);
    this.cdr.markForCheck();
  }

  setScopeLevel(level: ChecklistTemplateScopeLevel): void {
    this.scopeLevel.set(level);
    this.form.controls.scopeLevel.setValue(level);
    this.applyScopeValidators(level);

    if (level === 'company') {
      this.form.controls.departmentId.setValue('');
      this.form.controls.positionId.setValue('');
      this.positions.set([]);
    } else if (level === 'department') {
      this.form.controls.positionId.setValue('');
      this.positions.set([]);
    } else if (level === 'position') {
      const company = this.selectedCompany();
      if (company && this.form.controls.departmentId.value) {
        void this.loadPositions(company.id, this.form.controls.departmentId.value);
      } else {
        this.positions.set([]);
      }
    }
    this.cdr.markForCheck();
  }

  onDepartmentChange(deptId: string): void {
    this.form.controls.departmentId.setValue(deptId);
    this.form.controls.positionId.setValue('');
    const company = this.selectedCompany();
    if (company) {
      void this.loadPositions(company.id, deptId || undefined);
    } else {
      this.positions.set([]);
    }
    this.cdr.markForCheck();
  }

  getTaskPlaceholder(index: number): string {
    return TASK_PLACEHOLDERS[index % TASK_PLACEHOLDERS.length];
  }

  isCompanyPositionAssignment(taskGroup: FormGroup): boolean {
    return taskGroup.get('assignmentType')?.value === 'company_position';
  }

  isUnassigned(taskGroup: FormGroup): boolean {
    return taskGroup.get('assignmentType')?.value === 'unassigned';
  }

  isOffboardingTemplate(): boolean {
    return this.form.controls.templateType.value === 'offboarding';
  }

  onAssignmentTypeChange(index: number, assignmentType: ChecklistTaskAssignmentType): void {
    const taskGroup = this.tasksArray.at(index);
    taskGroup.get('assignmentType')?.setValue(assignmentType);
    if (assignmentType === 'employee') {
      taskGroup.get('assigneePositionId')?.setValue('');
      taskGroup.get('selectedAssigneeUserId')?.setValue('');
      taskGroup.get('assigneePositionId')?.setErrors(null);
      this.closeTaskPickers();
    } else if (assignmentType === 'unassigned') {
      taskGroup.get('assigneePositionId')?.setValue('');
      taskGroup.get('selectedAssigneeUserId')?.setValue('');
      taskGroup.get('originalAssignedToId')?.setValue('');
      this.closeTaskPickers();
    }
    this.cdr.markForCheck();
  }

  addTask(
    existing?: Omit<Partial<ChecklistTemplateTaskRequest>, 'category'> & {
      ownerType?: ChecklistTaskOwnerType;
      category?: ChecklistTaskCategory | '' | null;
      attachments?: ChecklistTemplateTaskAttachment[] | null;
    }
  ): void {
    let assignmentType: ChecklistTaskAssignmentType = 'unassigned';
    let assigneePositionId = '';
    let selectedAssigneeUserId = '';
    let originalAssignedToId = '';

    if (existing?.ownerType && existing.ownerType !== 'employee') {
      assignmentType = 'company_position';
      assigneePositionId = existing.assigneePositionId ?? '';
      selectedAssigneeUserId = existing.assignedToId ?? '';
      originalAssignedToId = existing.assignedToId ?? '';
    } else if (existing?.ownerType === 'employee') {
      assignmentType = 'employee';
    }

    const taskForm = this.fb.group({
      title: [existing?.title ?? '', [Validators.required, Validators.maxLength(200)]],
      assignmentType: [assignmentType, Validators.required],
      assigneePositionId: [assigneePositionId],
      selectedAssigneeUserId: [selectedAssigneeUserId],
      originalAssignedToId: [originalAssignedToId],
      dueOffsetDays: [
        existing?.dueOffsetDays ?? 0,
        [Validators.required, nonNegativeIntegerValidator]
      ],
      isRequired: [existing?.isRequired ?? true],
      isBypassable: [existing?.isBypassable ?? false],
      bypassPenaltyDescription: [existing?.bypassPenaltyDescription ?? ''],
      category: [existing?.category ?? ''],
      description: [existing?.description ?? ''],
      priority: [(existing?.priority ?? 'medium') as ChecklistTaskPriority],
      attachments: [
        (existing?.attachments ?? []).map(
          (file): AttachmentPill => ({ fileId: file.fileId, name: file.fileName, sizeBytes: file.fileSizeBytes })
        )
      ],
      pendingFileIds: [[] as string[]]
    });

    this.tasksArray.push(taskForm);
    this.cdr.markForCheck();
  }

  removeTask(index: number): void {
    if (this.tasksArray.length > 1) {
      for (const fileId of (this.tasksArray.at(index).value as Partial<ChecklistTaskFormValue>).pendingFileIds ?? []) {
        firstValueFrom(this.taskApi.deletePendingFile(fileId)).catch(() => undefined);
      }
      this.tasksArray.removeAt(index);
      this.cdr.markForCheck();
    } else {
      this.notificationService.info('A checklist must have at least one task.');
    }
  }

  openTaskDetail(index: number): void {
    this.closeTaskPickers();
    this.openTaskDetailIndex.set(index);
  }

  closeTaskDetail(): void {
    this.openTaskDetailIndex.set(null);
    this.cdr.markForCheck();
  }

  /** One-line "who does it" summary for the task detail popup. */
  assigneeSummary(taskGroup: FormGroup): string {
    const type = taskGroup.get('assignmentType')?.value as ChecklistTaskAssignmentType;
    if (type === 'employee') return 'New employee';
    if (type !== 'company_position') return '';
    const position = this.assignmentPositionLabel(taskGroup);
    const hasEmployee = !!(taskGroup.value.selectedAssigneeUserId || taskGroup.value.originalAssignedToId);
    return hasEmployee ? `${position} · ${this.assignmentEmployeeLabel(taskGroup)}` : position;
  }

  taskHasDetails(taskGroup: FormGroup): boolean {
    const value = taskGroup.value as Partial<ChecklistTaskFormValue>;
    return !!(value.description?.trim() || (value.attachments?.length ?? 0) > 0);
  }

  /** Attachments uploaded while building but never saved: delete them so they don't linger. */
  private discardPendingUploads(): void {
    for (const grp of this.tasksArray.controls) {
      for (const fileId of (grp.value as Partial<ChecklistTaskFormValue>).pendingFileIds ?? []) {
        firstValueFrom(this.taskApi.deletePendingFile(fileId)).catch(() => undefined);
      }
    }
  }

  onDropTask(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const task = this.tasksArray.at(event.previousIndex);
    this.tasksArray.removeAt(event.previousIndex);
    this.tasksArray.insert(event.currentIndex, task);
    this.cdr.markForCheck();
  }

  onTaskTitleEnter(index: number, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const currentTask = this.tasksArray.at(index);
    if (!currentTask?.get('title')?.value?.trim()) {
      return;
    }

    if (index === this.tasksArray.length - 1) {
      this.addTask();
    }

    setTimeout(() => {
      this.focusTaskTitle(index + 1);
    }, 50);
  }

  focusTaskTitle(index: number): void {
    const el = this.elRef.nativeElement as HTMLElement;
    const inputs = el.querySelectorAll<HTMLInputElement>('.cb-task-row .cb-task-list__col-title input');
    if (inputs && inputs[index]) {
      inputs[index].focus();
    }
  }

  cancel(): void {
    this.closeTaskPickers();
    this.openTaskDetailIndex.set(null);
    this.discardPendingUploads();
    this.closed.emit();
    void this.router.navigate(['/people/checklists']);
  }

  onBackdrop(_event?: MouseEvent): void {
    // The task detail popup sits above the builder; it handles its own dismissal.
    if (this.openTaskDetailIndex() !== null) return;
    this.cancel();
  }

  onEscape(): void {
    if (this.openTaskDetailIndex() !== null) return;
    this.cancel();
  }

  async onSubmit(): Promise<void> {
    this.submitAttempted.set(true);
    this.validateTaskAssignees();
    this.cdr.markForCheck();

    if (this.form.invalid || this.tasksArray.length === 0) {
      if (!this.form.get('name')?.value?.trim()) {
        this.notificationService.warning('Please enter a checklist name.');
      } else if (this.tasksArray.length === 0) {
        this.notificationService.warning('Please add at least one task to the checklist.');
      } else {
        const invalidTask = this.tasksArray.controls.find((c) => c.invalid);
        if (invalidTask) {
          if (!invalidTask.get('title')?.value?.trim()) {
            this.notificationService.warning('Please enter a title for all tasks.');
          } else if (invalidTask.get('assigneePositionId')?.invalid) {
            this.notificationService.warning('Please choose who all tasks are assigned to.');
          } else if (invalidTask.get('dueOffsetDays')?.invalid) {
            this.notificationService.warning('Please enter a valid due offset (0 or more days).');
          } else {
            this.notificationService.warning('Please fill in all required checklist fields.');
          }
        } else {
          this.notificationService.warning('Please fill in all required checklist fields.');
        }
      }
      return;
    }

    const company = this.selectedCompany();
    if (!company) {
      this.notificationService.warning('Please select a company to create the checklist.');
      return;
    }

    const val = this.form.value;
    const scope = this.scopeLevel();

    const deptId = scope === 'department' || scope === 'position' ? (val.departmentId || null) : null;
    const posId = scope === 'position' ? (val.positionId || null) : null;

    const tasksPayload: ChecklistTemplateTaskRequest[] = this.tasksArray.controls.map((grp, idx) =>
      this.mapTaskFormToRequest(grp.value as ChecklistTaskFormValue, idx)
    );

    let success: boolean;
    if (this.isEdit() && this.templateId()) {
      const updatePayload: UpdateChecklistTemplateRequest = {
        name: val.name!,
        departmentId: deptId,
        positionId: posId,
        tasks: tasksPayload
      };
      success = await this.store.updateTemplate(this.templateId()!, updatePayload);
      if (success) {
        this.notificationService.success('Checklist updated successfully.');
      } else {
        this.notificationService.error(this.store.error() || 'Failed to update checklist.');
      }
    } else {
      const createPayload: CreateChecklistTemplateRequest = {
        name: val.name!,
        templateType: val.templateType as ChecklistTemplateType,
        legalEntityId: company.id,
        departmentId: deptId,
        positionId: posId,
        tasks: tasksPayload
      };
      success = await this.store.createTemplate(createPayload);
      if (success) {
        this.notificationService.success('Checklist created successfully.');
      } else {
        this.notificationService.error(this.store.error() || 'Failed to create checklist.');
      }
    }

    if (success) {
      this.closeTaskPickers();
      this.saved.emit();
      void this.router.navigate(['/people/checklists']);
    }
  }

  mapTaskFormToRequest(value: ChecklistTaskFormValue, index: number): ChecklistTemplateTaskRequest {
    if (value.assignmentType === 'employee') {
      return {
        title: value.title,
        ownerType: 'employee',
        assignedToId: null,
        assigneePositionId: null,
        dueOffsetDays: Number(value.dueOffsetDays) || 0,
        sequence: index + 1,
        isRequired: !!value.isRequired,
        isBypassable: !!value.isBypassable,
        bypassPenaltyDescription: value.bypassPenaltyDescription || null,
        category: (value.category || null) as ChecklistTaskCategory | null,
        ...this.taskDetailsPayload(value),
      };
    }

    // A freshly picked position takes priority. Otherwise fall back to the assignee
    // already resolved by the backend when this task was loaded for edit, so saving
    // an untouched row doesn't force HR to re-pick a position (see resolver-collapse
    // note on ChecklistTaskFormValue.originalAssignedToId).
    if (value.assigneePositionId) {
      return {
        title: value.title,
        ownerType: POSITION_ASSIGNEE_OWNER_TYPE,
        assignedToId: value.selectedAssigneeUserId || null,
        assigneePositionId: value.assigneePositionId,
        dueOffsetDays: Number(value.dueOffsetDays) || 0,
        sequence: index + 1,
        isRequired: !!value.isRequired,
        isBypassable: !!value.isBypassable,
        bypassPenaltyDescription: value.bypassPenaltyDescription || null,
        category: (value.category || null) as ChecklistTaskCategory | null,
        ...this.taskDetailsPayload(value),
      };
    }

    return {
      title: value.title,
      ownerType: POSITION_ASSIGNEE_OWNER_TYPE,
      assignedToId: value.selectedAssigneeUserId || value.originalAssignedToId || null,
      assigneePositionId: null,
      dueOffsetDays: Number(value.dueOffsetDays) || 0,
      sequence: index + 1,
      isRequired: !!value.isRequired,
      isBypassable: !!value.isBypassable,
      bypassPenaltyDescription: value.bypassPenaltyDescription || null,
      category: (value.category || null) as ChecklistTaskCategory | null,
      ...this.taskDetailsPayload(value),
    };
  }

  private taskDetailsPayload(
    value: ChecklistTaskFormValue
  ): Pick<ChecklistTemplateTaskRequest, 'description' | 'priority' | 'attachmentFileIds'> {
    const description = value.description?.trim() ? value.description : null;
    return {
      description,
      priority: value.priority || 'medium',
      attachmentFileIds: (value.attachments ?? []).map((file) => file.fileId)
    };
  }

  private validateTaskAssignees(): void {
    for (const grp of this.tasksArray.controls) {
      const assignmentType = grp.get('assignmentType')?.value;
      const assigneePositionId = grp.get('assigneePositionId');
      const selectedAssigneeUserId = grp.get('selectedAssigneeUserId')?.value;
      const originalAssignedToId = grp.get('originalAssignedToId')?.value;
      const missingAssignment = assignmentType === 'unassigned';
      const missingAssignee =
        assignmentType === 'company_position' && !assigneePositionId?.value && !originalAssignedToId;

      if (missingAssignment || missingAssignee) {
        assigneePositionId?.setErrors({ required: true });
      } else if (assigneePositionId?.hasError('required')) {
        assigneePositionId.setErrors(null);
      }
      if (assignmentType === 'company_position' && assigneePositionId?.value && !selectedAssigneeUserId) {
        grp.get('selectedAssigneeUserId')?.setErrors(null);
      }
    }
  }

  openAssignmentPicker(index: number): void {
    this.openAssignmentPickerIndex.set(index);
    this.openPositionPickerIndex.set(null);
    this.openEmployeePickerIndex.set(null);
    this.positionSearch.set('');
    this.employeeSearch.set('');
  }

  isTaskPickerOpen(index: number): boolean {
    return (
      this.openAssignmentPickerIndex() === index ||
      this.openPositionPickerIndex() === index ||
      (this.openEmployeePickerIndex() === index && !!this.tasksArray.at(index)?.value.assigneePositionId)
    );
  }

  closeTaskPickers(): void {
    this.openAssignmentPickerIndex.set(null);
    this.openPositionPickerIndex.set(null);
    this.openEmployeePickerIndex.set(null);
    this.positionSearch.set('');
    this.employeeSearch.set('');
  }

  chooseNewEmployee(index: number): void {
    this.onAssignmentTypeChange(index, 'employee');
  }

  async chooseExistingEmployee(index: number): Promise<void> {
    this.onAssignmentTypeChange(index, 'company_position');
    this.openAssignmentPickerIndex.set(null);
    this.openPositionPickerIndex.set(index);
    this.openEmployeePickerIndex.set(null);
    this.positionSearch.set('');
    this.employeeSearch.set('');
    await this.ensureAssigneePositionsLoaded();
  }

  async reopenPositionPicker(index: number): Promise<void> {
    this.openPositionPickerIndex.set(index);
    this.openAssignmentPickerIndex.set(null);
    this.openEmployeePickerIndex.set(null);
    this.positionSearch.set('');
    await this.ensureAssigneePositionsLoaded();
  }

  async selectTaskPosition(index: number, positionId: string): Promise<void> {
    const taskGroup = this.tasksArray.at(index);
    taskGroup.get('assignmentType')?.setValue('company_position');
    taskGroup.get('assigneePositionId')?.setValue(positionId);
    taskGroup.get('originalAssignedToId')?.setValue('');
    taskGroup.get('selectedAssigneeUserId')?.setValue('');
    taskGroup.get('assigneePositionId')?.setErrors(null);
    this.openPositionPickerIndex.set(null);
    this.openEmployeePickerIndex.set(index);
    this.employeeSearch.set('');
    await this.ensureAssigneesLoaded(positionId);
    this.cdr.markForCheck();
  }

  openEmployeePicker(index: number): void {
    const taskGroup = this.tasksArray.at(index);
    if (!taskGroup.get('assigneePositionId')?.value) {
      return;
    }
    this.openEmployeePickerIndex.set(index);
    this.openAssignmentPickerIndex.set(null);
    this.openPositionPickerIndex.set(null);
    this.employeeSearch.set('');
  }

  async selectTaskEmployee(index: number, userId: string): Promise<void> {
    const taskGroup = this.tasksArray.at(index);
    taskGroup.get('selectedAssigneeUserId')?.setValue(userId);
    taskGroup.get('originalAssignedToId')?.setValue(userId);
    this.openEmployeePickerIndex.set(null);
    this.employeeSearch.set('');
    this.cdr.markForCheck();
  }

  removeSelectedEmployee(index: number): void {
    const taskGroup = this.tasksArray.at(index);
    taskGroup.get('selectedAssigneeUserId')?.setValue('');
    taskGroup.get('originalAssignedToId')?.setValue('');
    this.cdr.markForCheck();
  }

  clearTaskAssignment(index: number): void {
    this.onAssignmentTypeChange(index, 'unassigned');
  }

  assignmentPositionLabel(taskGroup: FormGroup): string {
    const positionId = taskGroup.get('assigneePositionId')?.value;
    if (!positionId) {
      return '';
    }
    return this.assigneePositions().find((pos) => pos.value === positionId)?.label ?? 'Selected position';
  }

  assignmentEmployeeLabel(taskGroup: FormGroup): string {
    const userId = taskGroup.get('selectedAssigneeUserId')?.value || taskGroup.get('originalAssignedToId')?.value;
    const positionId = taskGroup.get('assigneePositionId')?.value;
    if (!userId) {
      return '';
    }
    const match = positionId ? (this.assigneesByPosition()[positionId] ?? []).find((person) => person.userId === userId) : null;
    return match?.displayName ?? 'Selected employee';
  }

  assigneeCountLabel(positionId: string): string {
    const count = (this.assigneesByPosition()[positionId] ?? []).length;
    if (count === 0) {
      return 'Choose a position';
    }
    return `${count} employee${count === 1 ? '' : 's'}`;
  }

  isLoadingAssignees(positionId: string): boolean {
    return !!this.loadingAssigneesByPosition()[positionId];
  }

  assigneesForPosition(positionId: string): readonly ChecklistAssignee[] {
    return this.assigneesByPosition()[positionId] ?? [];
  }

  private async ensureAssigneePositionsLoaded(): Promise<void> {
    const companyId = this.selectedCompany()?.id;
    if (!companyId || this.loadingAssigneePositions() || this.assigneePositions().length > 0) {
      return;
    }
    await this.loadAssigneePositions(companyId);
  }

  private async ensureAssigneesLoaded(positionId: string): Promise<void> {
    const companyId = this.selectedCompanyId();
    if (!companyId || !positionId || this.assigneesByPosition()[positionId] || this.isLoadingAssignees(positionId)) {
      return;
    }
    this.loadingAssigneesByPosition.update((state) => ({ ...state, [positionId]: true }));
    this.cdr.markForCheck();
    try {
      const assignees = await firstValueFrom(this.peopleApi.getChecklistAssignees(companyId, positionId));
      this.assigneesByPosition.update((state) => ({ ...state, [positionId]: assignees }));
    } catch {
      this.assigneesByPosition.update((state) => ({ ...state, [positionId]: [] }));
    } finally {
      this.loadingAssigneesByPosition.update((state) => ({ ...state, [positionId]: false }));
      this.cdr.markForCheck();
    }
  }

  private applyScopeValidators(level: ChecklistTemplateScopeLevel): void {
    if (level === 'department' || level === 'position') {
      this.form.controls.departmentId.setValidators([Validators.required]);
    } else {
      this.form.controls.departmentId.clearValidators();
    }

    if (level === 'position') {
      this.form.controls.positionId.setValidators([Validators.required]);
    } else {
      this.form.controls.positionId.clearValidators();
    }

    this.form.controls.departmentId.updateValueAndValidity({ emitEvent: false });
    this.form.controls.positionId.updateValueAndValidity({ emitEvent: false });
  }

  private async loadDepartments(companyId: string): Promise<void> {
    this.loadingDepartments.set(true);
    this.cdr.markForCheck();
    try {
      const page = await firstValueFrom(this.departmentApi.listFlat(companyId, { includeInactive: false }));
      this.departments.set(page.items.map((d) => ({ value: d.id, label: d.name })));
    } catch {
      this.departments.set([]);
    } finally {
      this.loadingDepartments.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadPositions(companyId: string, departmentId?: string): Promise<void> {
    this.loadingPositions.set(true);
    this.cdr.markForCheck();
    try {
      const page = await firstValueFrom(
        this.positionApi.listFlat(companyId, { departmentId, includeInactive: false })
      );
      this.positions.set(page.items.map((p) => ({ value: p.id, label: p.name })));
    } catch {
      this.positions.set([]);
    } finally {
      this.loadingPositions.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadAssigneePositions(companyId: string): Promise<void> {
    this.loadingAssigneePositions.set(true);
    this.cdr.markForCheck();
    try {
      const page = await firstValueFrom(
        this.positionApi.listFlat(companyId, { includeInactive: false })
      );
      this.assigneePositions.set(page.items.map((p) => ({ value: p.id, label: p.name })));
    } catch {
      this.assigneePositions.set([]);
    } finally {
      this.loadingAssigneePositions.set(false);
      this.cdr.markForCheck();
    }
  }
}
