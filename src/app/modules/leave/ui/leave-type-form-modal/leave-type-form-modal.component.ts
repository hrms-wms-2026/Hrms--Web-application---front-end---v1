/** Quiet Operations Desk: a deliberate, compact form with immutable-code clarity. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { CreateLeaveTypeRequest, LeaveTypeResponse } from '../../models/leave-type.model';
export type LeaveTypeFormValue = CreateLeaveTypeRequest;
@Component({ selector: 'app-leave-type-form-modal', standalone: true, imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent], templateUrl: './leave-type-form-modal.component.html', styleUrl: './leave-type-form-modal.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveTypeFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  @Input() leaveType: LeaveTypeResponse | null = null;
  @Input() loading = false;
  @Output() save = new EventEmitter<LeaveTypeFormValue>();
  @Output() cancel = new EventEmitter<void>();
  readonly categoryOptions = [{ value: 'annual', label: 'Annual' }, { value: 'sick', label: 'Sick' }, { value: 'maternity', label: 'Maternity' }, { value: 'paternity', label: 'Paternity' }, { value: 'compassionate', label: 'Compassionate' }, { value: 'unpaid', label: 'Unpaid' }, { value: 'custom', label: 'Custom' }];
  readonly genderOptions = [{ value: 'all', label: 'All employees' }, { value: 'male', label: 'Male employees' }, { value: 'female', label: 'Female employees' }];
  readonly form = this.fb.group({ name: ['', [Validators.required, Validators.maxLength(100)]], code: ['', [Validators.required, Validators.maxLength(20)]], description: [''], category: ['custom', Validators.required], isPaid: [true], requiresApproval: [true], requiresDocument: [false], documentRequiredAfterDays: [null as number | null], defaultDaysPerYear: [0, [Validators.required, Validators.min(0.5)]], carryForwardAllowed: [false], maxCarryForwardDays: [null as number | null], carryForwardExpiryMonths: [null as number | null], proRataForNewJoiners: [false], applicableGender: ['all', Validators.required], minimumNoticeDays: [0, Validators.min(0)], maxConsecutiveDays: [null as number | null] });
  get isEdit(): boolean { return !!this.leaveType; }
  ngOnInit(): void { if (!this.leaveType) return; this.form.patchValue({ name: this.leaveType.name, code: this.leaveType.code, description: this.leaveType.description ?? '', category: this.leaveType.category, isPaid: this.leaveType.isPaid, requiresApproval: this.leaveType.requiresApproval, requiresDocument: this.leaveType.requiresDocument, documentRequiredAfterDays: this.leaveType.documentRequiredAfterDays, defaultDaysPerYear: this.leaveType.defaultDaysPerYear, carryForwardAllowed: this.leaveType.carryForwardAllowed, maxCarryForwardDays: this.leaveType.maxCarryForwardDays, carryForwardExpiryMonths: this.leaveType.carryForwardExpiryMonths, proRataForNewJoiners: this.leaveType.proRataForNewJoiners, applicableGender: this.leaveType.applicableGender, minimumNoticeDays: this.leaveType.minimumNoticeDays, maxConsecutiveDays: this.leaveType.maxConsecutiveDays }); this.form.controls.code.disable(); }
  onSubmit(): void { if (this.form.invalid) { this.form.markAllAsTouched(); return; } const value = this.form.getRawValue(); this.save.emit({ name: (value.name ?? '').trim(), code: (value.code ?? '').trim().toUpperCase(), description: value.description?.trim() || null, category: value.category as LeaveTypeFormValue['category'], isPaid: !!value.isPaid, requiresApproval: !!value.requiresApproval, requiresDocument: !!value.requiresDocument, documentRequiredAfterDays: value.requiresDocument ? value.documentRequiredAfterDays : null, acceptedDocumentTypes: value.requiresDocument ? ['pdf', 'image'] : [], maxConsecutiveDays: value.maxConsecutiveDays, defaultDaysPerYear: value.defaultDaysPerYear ?? 0, carryForwardAllowed: !!value.carryForwardAllowed, maxCarryForwardDays: value.carryForwardAllowed ? value.maxCarryForwardDays : null, carryForwardExpiryMonths: value.carryForwardAllowed ? value.carryForwardExpiryMonths : null, proRataForNewJoiners: !!value.proRataForNewJoiners, applicableGender: value.applicableGender as LeaveTypeFormValue['applicableGender'], minimumNoticeDays: value.minimumNoticeDays ?? 0 }); }
}
