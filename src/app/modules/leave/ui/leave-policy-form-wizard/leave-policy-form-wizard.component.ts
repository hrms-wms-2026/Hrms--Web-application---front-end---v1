/** Quiet Operations Desk: seven deliberate steps keep policy decisions comprehensible and reviewable. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LegalEntityListItem } from '../../../organization/models/legal-entity.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { CreateLeavePolicyBlackoutPeriodRequest, CreateLeavePolicyTypeRuleRequest, LeavePolicyFormDraft } from '../../models/leave-policy.model';
import { createEmptyLeavePolicyFormDraft, validateLeavePolicyFormDraft } from '../../utils/leave-policy-form.mapper';

@Component({ selector: 'app-leave-policy-form-wizard', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './leave-policy-form-wizard.component.html', styleUrl: './leave-policy-form-wizard.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeavePolicyFormWizardComponent {
  @Input() leaveTypes: readonly LeaveTypeResponse[] = [];
  @Input() legalEntities: readonly LegalEntityListItem[] = [];
  @Input() saving = false;
  @Output() save = new EventEmitter<LeavePolicyFormDraft>();
  @Output() cancel = new EventEmitter<void>();

  readonly draft = signal<LeavePolicyFormDraft>(createEmptyLeavePolicyFormDraft());
  readonly validationErrors = signal<readonly string[]>([]);
  readonly step = signal(1);
  readonly steps = ['Policy details', 'Leave type rules', 'Accrual', 'Eligibility', 'Request rules', 'Blackout periods', 'Entities & review'];
  readonly activeLeaveTypes = computed(() => this.leaveTypes.filter((type) => type.isActive));

  setStep(step: number): void { this.step.set(Math.min(7, Math.max(1, step))); }
  next(): void { this.setStep(this.step() + 1); }
  back(): void { this.setStep(this.step() - 1); }
  setValue(key: keyof LeavePolicyFormDraft, value: unknown): void { this.draft.update((current) => ({ ...current, [key]: value } as LeavePolicyFormDraft)); }
  setNullableText(key: 'description' | 'jobLevel', value: string): void { this.setValue(key, value.trim() || null); }
  setNullableNumber(key: 'accrualAfterNMonths' | 'firstYearReducedPercent' | 'maxConsecutiveDays' | 'maxTeamAbsencePercent', value: string): void { this.setValue(key, value === '' ? null : +value); }
  addRule(): void { const available = this.activeLeaveTypes().find((type) => !this.draft().leaveTypes.some((rule) => rule.leaveTypeId === type.id)); if (!available) return; const next: CreateLeavePolicyTypeRuleRequest = { leaveTypeId: available.id, annualEntitlementDays: available.defaultDaysPerYear, monthlyAccrualDays: null, carryForwardMaxDays: null, carryForwardExpiryMonths: null }; this.draft.update((current) => ({ ...current, leaveTypes: [...current.leaveTypes, next] })); }
  removeRule(index: number): void { this.draft.update((current) => ({ ...current, leaveTypes: current.leaveTypes.filter((_, currentIndex) => currentIndex !== index) })); }
  updateRule(index: number, key: keyof CreateLeavePolicyTypeRuleRequest, raw: string): void { this.draft.update((current) => ({ ...current, leaveTypes: current.leaveTypes.map((rule, currentIndex) => currentIndex === index ? { ...rule, [key]: key === 'leaveTypeId' ? raw : raw === '' ? null : +raw } as CreateLeavePolicyTypeRuleRequest : rule) })); }
  addBlackout(): void { const period: CreateLeavePolicyBlackoutPeriodRequest = { startDate: '', endDate: '', reason: null }; this.draft.update((current) => ({ ...current, blackoutPeriods: [...current.blackoutPeriods, period] })); }
  removeBlackout(index: number): void { this.draft.update((current) => ({ ...current, blackoutPeriods: current.blackoutPeriods.filter((_, currentIndex) => currentIndex !== index) })); }
  updateBlackout(index: number, key: keyof CreateLeavePolicyBlackoutPeriodRequest, value: string): void { this.draft.update((current) => ({ ...current, blackoutPeriods: current.blackoutPeriods.map((period, currentIndex) => currentIndex === index ? { ...period, [key]: key === 'reason' ? value || null : value } : period) })); }
  toggleLegalEntity(id: string, checked: boolean): void { this.draft.update((current) => ({ ...current, legalEntityIds: checked ? [...current.legalEntityIds, id] : current.legalEntityIds.filter((currentId) => currentId !== id) })); }
  submit(): void { const errors = validateLeavePolicyFormDraft(this.draft()); this.validationErrors.set(errors); if (errors.length) { this.setStep(7); return; } this.save.emit(this.draft()); }
  patchDraftForTest(partial: Partial<LeavePolicyFormDraft>): void { this.draft.update((current) => ({ ...current, ...partial, leaveTypes: partial.leaveTypes ?? current.leaveTypes, blackoutPeriods: partial.blackoutPeriods ?? current.blackoutPeriods, legalEntityIds: partial.legalEntityIds ?? current.legalEntityIds })); }
}
