import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { PositionListItemResponse, PositionTemplatePreset, PositionTreeNodeResponse } from '../../models/position.model';
import { RoleSummaryResponse } from '../../models/role.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

export interface PositionFormSubmitValue {
  departmentId: string;
  name: string;
  code: string;
  maxOccupancy: number;
  reportsToPositionId: string | null;
  selectedAccessRoleId?: string | null;
  accessRequiresApproval?: boolean;
}

export function generateShortCode(titleOrKey?: string | null): string {
  if (!titleOrKey) return '';
  const cleaned = titleOrKey.trim();
  if (!cleaned) return '';

  const words = cleaned.split(/[\s\-_/]+/).filter((w) => w.length > 0);
  if (words.length > 1) {
    const initials = words.map((w) => w[0].toUpperCase()).join('');
    return initials.slice(0, 5);
  }

  return words[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 5);
}

function integerValidator(control: AbstractControl): ValidationErrors | null {
  if (control.value === null || control.value === undefined || control.value === '') {
    return null;
  }
  const num = Number(control.value);
  if (isNaN(num) || !Number.isInteger(num)) {
    return { integer: true };
  }
  return null;
}

@Component({
  selector: 'app-position-form-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [StopClickPropagationDirective, CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent],
  templateUrl: './position-form-modal.component.html',
  styleUrl: './position-form-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  @Input() position: PositionListItemResponse | PositionTreeNodeResponse | null = null;
  @Input() reportsToPreset: PositionTreeNodeResponse | null = null;
  @Input() templatePreset: PositionTemplatePreset | null = null;
  @Input({ required: true }) availableDepartments: readonly { id: string; name: string }[] = [];
  @Input({ required: true }) availablePositions: readonly { id: string; name: string }[] = [];
  @Input() availableRoles: readonly RoleSummaryResponse[] = [];
  @Input() hasRoleReadAccess = false;
  @Input() canConfigureAccess = false;
  @Input({ required: true }) companyName!: string;
  @Input() loading = false;
  @Input() actionError: string | null = null;

  @Output() save = new EventEmitter<PositionFormSubmitValue>();
  @Output() cancelled = new EventEmitter<void>();

  readonly form = this.fb.group({
    departmentId: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    code: ['', [Validators.maxLength(5), Validators.pattern(/^[A-Za-z0-9_-]{1,5}$/)]],
    maxOccupancy: [1, [Validators.required, Validators.min(1), integerValidator]],
    reportsToPositionId: ['' as string | null],
    selectedAccessRoleId: [''],
    accessRequiresApproval: [false]
  });

  get isEdit(): boolean {
    return !!this.position;
  }

  get departmentOptions(): readonly { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [
      { value: '', label: 'Select Department *' }
    ];
    for (const d of this.availableDepartments) {
      opts.push({ value: d.id, label: d.name });
    }
    return opts;
  }

  get reportsToOptions(): readonly { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [
      { value: '', label: 'Root Position' }
    ];
    for (const p of this.availablePositions) {
      if (this.isEdit && p.id === this.position?.id) {
        continue; // cannot report to self
      }
      opts.push({ value: p.id, label: p.name });
    }
    return opts;
  }

  get roleOptions(): readonly { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [
      { value: '', label: 'No system role' }
    ];
    for (const r of this.availableRoles) {
      opts.push({ value: r.id, label: r.name });
    }
    return opts;
  }

  ngOnInit(): void {
    if (this.position) {
      this.form.patchValue({
        departmentId: this.position.departmentId || '',
        name: this.position.name,
        code: this.position.code || '',
        maxOccupancy: this.position.maxOccupancy,
        reportsToPositionId: this.position.reportsToPositionId || ''
      });
    } else if (this.templatePreset) {
      const safeCode = generateShortCode(this.templatePreset.positionName || this.templatePreset.positionKey);
      this.form.patchValue({
        name: this.templatePreset.positionName,
        code: safeCode,
        departmentId: this.templatePreset.departmentId || '',
        reportsToPositionId: this.templatePreset.reportsToPositionId || '',
        maxOccupancy: 1
      });
    } else if (this.reportsToPreset) {
      this.form.patchValue({
        reportsToPositionId: this.reportsToPreset.id,
        departmentId: this.reportsToPreset.departmentId || '',
        maxOccupancy: 1
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
      departmentId: val.departmentId!,
      name: (val.name || '').trim(),
      code: (val.code || '').trim().toUpperCase(),
      maxOccupancy: Number(val.maxOccupancy) || 1,
      reportsToPositionId: val.reportsToPositionId ? val.reportsToPositionId : null,
      selectedAccessRoleId: val.selectedAccessRoleId ? val.selectedAccessRoleId : null,
      accessRequiresApproval: !!val.accessRequiresApproval
    });
  }
}
