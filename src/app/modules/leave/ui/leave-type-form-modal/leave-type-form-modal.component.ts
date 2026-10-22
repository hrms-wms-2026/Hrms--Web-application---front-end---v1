/** The kind of leave only: name, colour, paid, who it is for and the document rule. Amounts and
 * every other rule are set on the leave type's policies. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { CreateLeaveTypeRequest, LEAVE_TYPE_COLORS, LeaveTypeResponse } from '../../models/leave-type.model';

export type LeaveTypeFormValue = CreateLeaveTypeRequest;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

@Component({ selector: 'app-leave-type-form-modal', host: { 'animate.leave': 'ui-popup-leave' }, standalone: true, imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent], templateUrl: './leave-type-form-modal.component.html', styleUrl: './leave-type-form-modal.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveTypeFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  @Input() leaveType: LeaveTypeResponse | null = null;
  @Input() loading = false;
  @Output() save = new EventEmitter<LeaveTypeFormValue>();
  @Output() cancel = new EventEmitter<void>();

  readonly colors = LEAVE_TYPE_COLORS;
  readonly genderOptions = [{ value: 'all', label: 'All employees' }, { value: 'male', label: 'Men only' }, { value: 'female', label: 'Women only' }];
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    code: ['', [Validators.required, Validators.maxLength(20)]],
    description: [''],
    color: [LEAVE_TYPE_COLORS[0] as string, [Validators.required, Validators.pattern(HEX_COLOR)]],
    isPaid: [true],
    applicableGender: ['all', Validators.required],
    requiresDocument: [false],
    documentRequiredAfterHours: [null as number | null, Validators.min(0.5)]
  });

  get isEdit(): boolean { return !!this.leaveType; }

  ngOnInit(): void {
    if (!this.leaveType) return;
    this.form.patchValue({
      name: this.leaveType.name,
      code: this.leaveType.code,
      description: this.leaveType.description ?? '',
      color: this.leaveType.color,
      isPaid: this.leaveType.isPaid,
      applicableGender: this.leaveType.applicableGender,
      requiresDocument: this.leaveType.requiresDocument,
      documentRequiredAfterHours: this.leaveType.documentRequiredAfterHours
    });
    this.form.controls.code.disable();
  }

  pickColor(color: string): void {
    this.form.controls.color.setValue(color);
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const requiresDocument = !!value.requiresDocument;
    const afterHours = value.documentRequiredAfterHours;
    this.save.emit({
      name: (value.name ?? '').trim(),
      code: (value.code ?? '').trim().toUpperCase(),
      description: value.description?.trim() || null,
      color: (value.color ?? LEAVE_TYPE_COLORS[0]).toUpperCase(),
      isPaid: !!value.isPaid,
      applicableGender: value.applicableGender as LeaveTypeFormValue['applicableGender'],
      requiresDocument,
      documentRequiredAfterHours: requiresDocument && afterHours != null && afterHours > 0 ? afterHours : null,
      acceptedDocumentTypes: requiresDocument ? ['pdf', 'image'] : []
    });
  }
}
