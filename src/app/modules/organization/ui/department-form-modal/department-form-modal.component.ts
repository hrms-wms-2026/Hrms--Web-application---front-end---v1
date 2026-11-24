import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DepartmentListItemResponse, DepartmentTreeNodeResponse } from '../../models/department.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';
import { AppValidators, applyServerFieldErrors, fieldError } from '../../../../shared/utils/validators';
import { DEPARTMENT_LIMITS } from '../../utils/organization-limits';
import { ApiError } from '../../../../core/errors/api-error';
import { FieldErrorComponent } from '../../../../shared/ui/field-error/field-error.component';

export interface DepartmentFormValue {
  name: string;
  code: string;
  parentDepartmentId: string | null;
  headPositionId: string | null;
}

export interface HeadPositionOption {
  id: string;
  title: string;
  departmentName: string | null;
}

@Component({
  selector: 'app-department-form-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [FieldErrorComponent, StopClickPropagationDirective, CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent],
  templateUrl: './department-form-modal.component.html',
  styleUrl: './department-form-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  @Input() department: DepartmentListItemResponse | DepartmentTreeNodeResponse | null = null;
  @Input() parentPreset: DepartmentTreeNodeResponse | null = null;
  @Input() availableParents: readonly { id: string; name: string }[] = [];
  @Input() availableHeadPositions: readonly HeadPositionOption[] = [];
  @Input({ required: true }) companyName!: string;
  @Input() loading = false;
  /** A message from a refused save that matches no field, shown inside the modal (task 20). */
  protected readonly serverFormError = signal<string | null>(null);

  /** The store's ApiError for the last failed save: field messages go next to their fields. */
  @Input() set serverError(value: ApiError | null) {
    // Only the fields this template shows an error for; any other message is shown above the footer.
    this.serverFormError.set(value ? applyServerFieldErrors(this.form, value, ['name', 'code']) : null);
  }


  @Output() save = new EventEmitter<DepartmentFormValue>();
  @Output() cancelled = new EventEmitter<void>();

  protected readonly fieldError = fieldError;

  readonly form = this.fb.group({
    name: ['', AppValidators.name(DEPARTMENT_LIMITS.nameMax)],
    code: [
      '',
      [
        AppValidators.requiredText(),
        AppValidators.maxLength(DEPARTMENT_LIMITS.codeMax),
        AppValidators.pattern(DEPARTMENT_LIMITS.codePattern, 'code')
      ]
    ],
    parentDepartmentId: ['' as string | null],
    headPositionId: ['' as string | null]
  });

  get isEdit(): boolean {
    return !!this.department;
  }

  get parentOptions(): readonly { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [
      { value: '', label: 'Top-level department — no parent' }
    ];
    for (const p of this.availableParents) {
      if (this.isEdit && p.id === this.department?.id) {
        continue; // cannot select self as parent
      }
      opts.push({ value: p.id, label: p.name });
    }
    return opts;
  }

  get headPositionOptions(): readonly { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [
      { value: '', label: 'Select Head Position' }
    ];
    for (const pos of this.availableHeadPositions) {
      // On create every candidate lives in another department, so name it.
      const label = !this.isEdit && pos.departmentName ? `${pos.title} · ${pos.departmentName}` : pos.title;
      opts.push({ value: pos.id, label });
    }
    return opts;
  }

  /** The position picked on create, which will move out of its current department. */
  get movingHeadPosition(): HeadPositionOption | null {
    if (this.isEdit) return null;
    const id = this.form.controls.headPositionId.value;
    return this.availableHeadPositions.find((p) => p.id === id) ?? null;
  }

  ngOnInit(): void {
    if (this.department) {
      this.form.patchValue({
        name: this.department.name,
        code: this.department.code,
        parentDepartmentId: this.department.parentDepartmentId || '',
        headPositionId: this.department.headPositionId || ''
      });
    } else if (this.parentPreset) {
      this.form.patchValue({
        parentDepartmentId: this.parentPreset.id
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const val = this.form.getRawValue();
    this.save.emit({
      name: (val.name || '').trim(),
      code: (val.code || '').trim().toUpperCase(),
      parentDepartmentId: val.parentDepartmentId ? val.parentDepartmentId : null,
      headPositionId: val.headPositionId ? val.headPositionId : null
    });
  }
}
