import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  computed,
  effect,
  inject,
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
import { firstValueFrom } from 'rxjs';

import { PermissionService } from '../../../../core/auth/state/permission.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import {
  ChecklistTaskAssignmentType,
  ChecklistTaskOwnerType,
  ChecklistTemplateScopeLevel,
  ChecklistTemplateTaskRequest,
  ChecklistTemplateType,
  CreateChecklistTemplateRequest,
  UpdateChecklistTemplateRequest
} from '../../models/checklist-template.model';
import { ChecklistTemplateStore } from '../../state/checklist-template.store';

const TASK_PLACEHOLDERS: readonly string[] = [
  'Collect signed contract',
  'Prepare company laptop',
  'Review company policies',
  'Schedule team orientation',
  'Set up system access & email'
];

/** Backend ownerType for position-resolved non-employee tasks (see ChecklistTemplateTaskInputResolver). */
const POSITION_ASSIGNEE_OWNER_TYPE: ChecklistTaskOwnerType = 'custom_user';

const ASSIGNMENT_OPTIONS: readonly SelectOption[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'company_position', label: 'Company position' }
];

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
  dueOffsetDays: number;
  isRequired: boolean;
}

@Component({
  selector: 'app-checklist-builder',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    BreadcrumbHeaderComponent,
    ButtonComponent,
    InputComponent,
    LoaderComponent,
    SelectComponent
  ],
  templateUrl: './checklist-builder.component.html',
  styleUrl: './checklist-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChecklistBuilderComponent implements OnInit {
  readonly store = inject(ChecklistTemplateStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly legalEntityStore = inject(LegalEntityStore);
  private readonly departmentApi = inject(DepartmentApiService);
  private readonly positionApi = inject(PositionApiService);
  private readonly permissionService = inject(PermissionService);

  readonly canWrite = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly selectedCompany = this.legalEntityStore.selectedLegalEntity;
  readonly assignmentOptions = ASSIGNMENT_OPTIONS;

  readonly isEdit = signal(false);
  readonly templateId = signal<string | null>(null);
  readonly initialLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly submitAttempted = signal(false);

  readonly scopeLevel = signal<ChecklistTemplateScopeLevel>('company');

  readonly departments = signal<readonly SelectOption[]>([]);
  /** Positions filtered for checklist applicability (scope) selection. */
  readonly positions = signal<readonly SelectOption[]>([]);
  /** All company positions for task assignee selection. */
  readonly assigneePositions = signal<readonly SelectOption[]>([]);
  readonly loadingDepartments = signal(false);
  readonly loadingPositions = signal(false);
  readonly loadingAssigneePositions = signal(false);

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
    effect(() => {
      const company = this.selectedCompany();
      if (company) {
        void this.loadDepartments(company.id);
        void this.loadAssigneePositions(company.id);
        if (this.form.controls.departmentId.value) {
          void this.loadPositions(company.id, this.form.controls.departmentId.value);
        }
      }
    });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.templateId.set(id);
      await this.loadTemplateForEdit(id);
    } else {
      this.isEdit.set(false);
      this.templateId.set(null);
      this.applyScopeValidators('company');
      this.addTask();
    }
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
            isRequired: t.isRequired
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

  onAssignmentTypeChange(index: number, assignmentType: ChecklistTaskAssignmentType): void {
    const taskGroup = this.tasksArray.at(index);
    taskGroup.get('assignmentType')?.setValue(assignmentType);
    if (assignmentType === 'employee') {
      taskGroup.get('assigneePositionId')?.setValue('');
      taskGroup.get('assigneePositionId')?.setErrors(null);
    }
    this.cdr.markForCheck();
  }

  addTask(existing?: Partial<ChecklistTemplateTaskRequest> & { ownerType?: ChecklistTaskOwnerType }): void {
    let assignmentType: ChecklistTaskAssignmentType = 'employee';
    let assigneePositionId = '';

    if (existing?.ownerType && existing.ownerType !== 'employee') {
      assignmentType = 'company_position';
      assigneePositionId = existing.assigneePositionId ?? '';
    }

    const taskForm = this.fb.group({
      title: [existing?.title ?? '', [Validators.required, Validators.maxLength(200)]],
      assignmentType: [assignmentType, Validators.required],
      assigneePositionId: [assigneePositionId],
      dueOffsetDays: [
        existing?.dueOffsetDays ?? 0,
        [Validators.required, nonNegativeIntegerValidator]
      ],
      isRequired: [existing?.isRequired ?? true]
    });

    this.tasksArray.push(taskForm);
    this.cdr.markForCheck();
  }

  removeTask(index: number): void {
    if (this.tasksArray.length > 1) {
      this.tasksArray.removeAt(index);
      this.cdr.markForCheck();
    }
  }

  moveTaskUp(index: number): void {
    if (index > 0) {
      const task = this.tasksArray.at(index);
      this.tasksArray.removeAt(index);
      this.tasksArray.insert(index - 1, task);
      this.cdr.markForCheck();
    }
  }

  moveTaskDown(index: number): void {
    if (index < this.tasksArray.length - 1) {
      const task = this.tasksArray.at(index);
      this.tasksArray.removeAt(index);
      this.tasksArray.insert(index + 1, task);
      this.cdr.markForCheck();
    }
  }

  cancel(): void {
    void this.router.navigate(['/people/checklists']);
  }

  async onSubmit(): Promise<void> {
    this.submitAttempted.set(true);
    this.validateTaskAssignees();
    this.cdr.markForCheck();

    if (this.form.invalid || this.tasksArray.length === 0) {
      return;
    }

    const company = this.selectedCompany();
    if (!company) return;

    const val = this.form.value;
    const scope = this.scopeLevel();

    const deptId = scope === 'department' || scope === 'position' ? (val.departmentId || null) : null;
    const posId = scope === 'position' ? (val.positionId || null) : null;

    const tasksPayload: ChecklistTemplateTaskRequest[] = this.tasksArray.controls.map((grp, idx) =>
      this.mapTaskFormToRequest(grp.value as ChecklistTaskFormValue, idx)
    );

    let success = false;
    if (this.isEdit() && this.templateId()) {
      const updatePayload: UpdateChecklistTemplateRequest = {
        name: val.name!,
        departmentId: deptId,
        positionId: posId,
        tasks: tasksPayload
      };
      success = await this.store.updateTemplate(this.templateId()!, updatePayload);
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
    }

    if (success) {
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
        isRequired: !!value.isRequired
      };
    }

    return {
      title: value.title,
      ownerType: POSITION_ASSIGNEE_OWNER_TYPE,
      assignedToId: null,
      assigneePositionId: value.assigneePositionId || null,
      dueOffsetDays: Number(value.dueOffsetDays) || 0,
      sequence: index + 1,
      isRequired: !!value.isRequired
    };
  }

  private validateTaskAssignees(): void {
    for (const grp of this.tasksArray.controls) {
      const assignmentType = grp.get('assignmentType')?.value;
      const assigneePositionId = grp.get('assigneePositionId');
      if (assignmentType === 'company_position' && !assigneePositionId?.value) {
        assigneePositionId?.setErrors({ required: true });
      } else if (assigneePositionId?.hasError('required') && assignmentType === 'employee') {
        assigneePositionId.setErrors(null);
      }
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
