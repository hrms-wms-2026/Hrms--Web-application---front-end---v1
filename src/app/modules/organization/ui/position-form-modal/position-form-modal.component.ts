import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PositionListItemResponse, PositionTreeNodeResponse } from '../../models/position.model';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';

export interface PositionFormSubmitValue {
  departmentId: string;
  name: string;
  code: string;
  positionType: 'unique' | 'pooled';
  maxOccupancy: number;
  reportsToPositionId: string | null;
}

@Component({
  selector: 'app-position-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent],
  templateUrl: './position-form-modal.component.html',
  styleUrl: './position-form-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  @Input() position: PositionListItemResponse | PositionTreeNodeResponse | null = null;
  @Input() reportsToPreset: PositionTreeNodeResponse | null = null;
  @Input({ required: true }) availableDepartments: readonly { id: string; name: string }[] = [];
  @Input({ required: true }) availablePositions: readonly { id: string; name: string }[] = [];
  @Input({ required: true }) companyName!: string;
  @Input() loading = false;
  @Input() actionError: string | null = null;

  @Output() save = new EventEmitter<PositionFormSubmitValue>();
  @Output() cancel = new EventEmitter<void>();

  readonly form = this.fb.group({
    departmentId: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    code: ['', [Validators.maxLength(40), Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    positionType: ['unique' as 'unique' | 'pooled', [Validators.required]],
    maxOccupancy: [1, [Validators.required, Validators.min(1)]],
    reportsToPositionId: ['' as string | null]
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
      { value: '', label: 'No Manager — Root Position' }
    ];
    for (const p of this.availablePositions) {
      if (this.isEdit && p.id === this.position?.id) {
        continue; // cannot report to self
      }
      opts.push({ value: p.id, label: p.name });
    }
    return opts;
  }

  get typeOptions(): readonly { value: 'unique' | 'pooled'; label: string }[] {
    return [
      { value: 'unique', label: 'Unique' },
      { value: 'pooled', label: 'Pooled' }
    ];
  }

  ngOnInit(): void {
    if (this.position) {
      const typeNorm = (this.position.positionType || '').toLowerCase() === 'pooled' ? 'pooled' : 'unique';
      this.form.patchValue({
        departmentId: this.position.departmentId || '',
        name: this.position.name,
        code: this.position.code || '',
        positionType: typeNorm,
        maxOccupancy: this.position.maxOccupancy,
        reportsToPositionId: this.position.reportsToPositionId || ''
      });
    } else if (this.reportsToPreset) {
      this.form.patchValue({
        reportsToPositionId: this.reportsToPreset.id,
        departmentId: this.reportsToPreset.departmentId || ''
      });
    }
  }

  onTypeChange(type: 'unique' | 'pooled'): void {
    this.form.controls.positionType.setValue(type);
    if (type === 'unique') {
      this.form.controls.maxOccupancy.setValue(1);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const val = this.form.getRawValue();
    const typeVal: 'unique' | 'pooled' = val.positionType === 'pooled' ? 'pooled' : 'unique';
    this.save.emit({
      departmentId: val.departmentId!,
      name: (val.name || '').trim(),
      code: (val.code || '').trim().toUpperCase(),
      positionType: typeVal,
      maxOccupancy: typeVal === 'unique' ? 1 : Number(val.maxOccupancy) || 1,
      reportsToPositionId: val.reportsToPositionId ? val.reportsToPositionId : null
    });
  }
}
