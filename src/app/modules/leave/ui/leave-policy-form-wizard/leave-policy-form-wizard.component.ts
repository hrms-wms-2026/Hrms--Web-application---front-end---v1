/** Policy builder: three steps — details, entitlements, then rules. Leave-type defaults are copied, not re-asked. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ProgressBarComponent } from '../../../../shared/ui/progress-bar/progress-bar.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { LegalEntityListItem } from '../../../organization/models/legal-entity.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { CreateLeavePolicyBlackoutPeriodRequest, CreateLeavePolicyTypeRuleRequest, LeavePolicyFormDraft } from '../../models/leave-policy.model';
import { createEmptyLeavePolicyFormDraft, validateLeavePolicyFormDraft } from '../../utils/leave-policy-form.mapper';

@Component({
  selector: 'app-leave-policy-form-wizard',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, ProgressBarComponent, DatePickerComponent],
  templateUrl: './leave-policy-form-wizard.component.html',
  styleUrl: './leave-policy-form-wizard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeavePolicyFormWizardComponent {
  @Input() leaveTypes: readonly LeaveTypeResponse[] = [];
  @Input() legalEntities: readonly LegalEntityListItem[] = [];
  @Input() saving = false;
  @Output() save = new EventEmitter<LeavePolicyFormDraft>();
  @Output() cancel = new EventEmitter<void>();

  readonly draft = signal<LeavePolicyFormDraft>(createEmptyLeavePolicyFormDraft());
  readonly validationErrors = signal<readonly string[]>([]);
  readonly step = signal(1);
  readonly steps = ['Details', 'Entitlements', 'Rules'] as const;
  readonly totalSteps = 3;
  readonly stepProgress = computed(() => (this.step() / this.totalSteps) * 100);

  activeLeaveTypes(): readonly LeaveTypeResponse[] {
    return this.leaveTypes.filter((type) => type.isActive);
  }

  setStep(step: number): void {
    this.step.set(Math.min(this.totalSteps, Math.max(1, step)));
  }
  next(): void {
    const errors = this.errorsForCurrentStep();
    this.validationErrors.set(errors);
    if (errors.length) return;
    this.setStep(this.step() + 1);
  }
  back(): void { this.setStep(this.step() - 1); }
  setValue(key: keyof LeavePolicyFormDraft, value: unknown): void {
    this.draft.update((current) => ({ ...current, [key]: value } as LeavePolicyFormDraft));
  }
  setNullableText(key: 'description', value: string): void {
    this.setValue(key, value.trim() || null);
  }
  setNullableNumber(key: 'accrualAfterNMonths' | 'firstYearReducedPercent' | 'maxConsecutiveDays' | 'maxTeamAbsencePercent', value: string): void {
    this.setValue(key, value === '' ? null : +value);
  }

  leaveTypeFor(id: string): LeaveTypeResponse | undefined {
    return this.leaveTypes.find((type) => type.id === id);
  }
  allowsCarryForward(id: string): boolean {
    return !!this.leaveTypeFor(id)?.carryForwardAllowed;
  }

  addRule(): void {
    const available = this.activeLeaveTypes().find((type) => !this.draft().leaveTypes.some((rule) => rule.leaveTypeId === type.id));
    if (!available) return;
    this.draft.update((current) => ({ ...current, leaveTypes: [...current.leaveTypes, this.ruleFromLeaveType(available)] }));
  }
  removeRule(index: number): void {
    this.draft.update((current) => ({ ...current, leaveTypes: current.leaveTypes.filter((_, currentIndex) => currentIndex !== index) }));
  }
  updateRule(index: number, key: keyof CreateLeavePolicyTypeRuleRequest, raw: string): void {
    this.draft.update((current) => ({
      ...current,
      leaveTypes: current.leaveTypes.map((rule, currentIndex) => {
        if (currentIndex !== index) return rule;
        if (key === 'leaveTypeId') {
          const type = this.leaveTypeFor(raw);
          return type ? this.ruleFromLeaveType(type) : { ...rule, leaveTypeId: raw };
        }
        return { ...rule, [key]: raw === '' ? null : +raw } as CreateLeavePolicyTypeRuleRequest;
      })
    }));
  }

  addBlackout(): void {
    const period: CreateLeavePolicyBlackoutPeriodRequest = { startDate: '', endDate: '', reason: null };
    this.draft.update((current) => ({ ...current, blackoutPeriods: [...current.blackoutPeriods, period] }));
  }
  removeBlackout(index: number): void {
    this.draft.update((current) => ({ ...current, blackoutPeriods: current.blackoutPeriods.filter((_, currentIndex) => currentIndex !== index) }));
  }
  updateBlackout(index: number, key: keyof CreateLeavePolicyBlackoutPeriodRequest, value: string): void {
    this.draft.update((current) => ({
      ...current,
      blackoutPeriods: current.blackoutPeriods.map((period, currentIndex) =>
        currentIndex === index ? { ...period, [key]: key === 'reason' ? value || null : value } : period
      )
    }));
  }
  toggleLegalEntity(id: string, checked: boolean): void {
    this.draft.update((current) => ({
      ...current,
      legalEntityIds: checked ? [...current.legalEntityIds, id] : current.legalEntityIds.filter((currentId) => currentId !== id)
    }));
  }
  submit(): void {
    const errors = validateLeavePolicyFormDraft(this.draft());
    this.validationErrors.set(errors);
    if (errors.length) {
      if (!this.draft().name.trim() || !this.draft().effectiveFrom.trim() || this.draft().legalEntityIds.length === 0) this.setStep(1);
      else if (this.draft().leaveTypes.length === 0) this.setStep(2);
      else this.setStep(this.totalSteps);
      return;
    }
    this.save.emit(this.draft());
  }

  private errorsForCurrentStep(): readonly string[] {
    const draft = this.draft();
    if (this.step() === 1) {
      const errors: string[] = [];
      if (!draft.name.trim()) errors.push('Policy name is required.');
      if (!draft.effectiveFrom.trim()) errors.push('Effective date is required.');
      if (draft.legalEntityIds.length === 0) errors.push('Select at least one legal entity.');
      return errors;
    }
    if (this.step() === 2) {
      return validateLeavePolicyFormDraft({
        ...draft,
        name: draft.name.trim() || 'pending',
        effectiveFrom: draft.effectiveFrom.trim() || '2000-01-01',
        legalEntityIds: draft.legalEntityIds.length ? draft.legalEntityIds : ['pending']
      }).filter((error) =>
        error.includes('leave type')
        || error.includes('accrual')
        || error.includes('Annual')
        || error.includes('Monthly')
      );
    }
    return [];
  }
  patchDraftForTest(partial: Partial<LeavePolicyFormDraft>): void {
    this.draft.update((current) => ({
      ...current,
      ...partial,
      leaveTypes: partial.leaveTypes ?? current.leaveTypes,
      blackoutPeriods: partial.blackoutPeriods ?? current.blackoutPeriods,
      legalEntityIds: partial.legalEntityIds ?? current.legalEntityIds
    }));
  }

  private ruleFromLeaveType(type: LeaveTypeResponse): CreateLeavePolicyTypeRuleRequest {
    return {
      leaveTypeId: type.id,
      annualEntitlementDays: type.defaultDaysPerYear,
      monthlyAccrualDays: null,
      carryForwardMaxDays: type.carryForwardAllowed ? type.maxCarryForwardDays : null,
      carryForwardExpiryMonths: type.carryForwardAllowed ? type.carryForwardExpiryMonths : null
    };
  }
}
