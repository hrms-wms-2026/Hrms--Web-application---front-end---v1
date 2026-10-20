/** Policy builder for ONE leave type: basics, amount (hours + when they are given, carry-over,
 * new joiners), then rules and who it applies to. Editing saves the rules as a new dated version. */
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProgressBarComponent } from '../../../../shared/ui/progress-bar/progress-bar.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import {
  CreateLeavePolicyRequest,
  LEAVE_AMOUNT_PERIOD_OPTIONS,
  LEAVE_ELIGIBILITY_OPTIONS,
  LEAVE_POLICY_APPROVAL_MODE_OPTIONS,
  LeaveAmountPeriod,
  LeaveEligibility,
  LeavePolicyApprovalMode,
  LeavePolicyAssignmentConflict,
  LeavePolicyAssignmentTarget,
  LeavePolicyBlackout,
  LeavePolicyDetail,
  LeavePolicyRules,
  LeavePolicyVersion
} from '../../models/leave-policy.model';
import { LeavePolicyEdit } from '../../state/leave-policy.store';

export interface LeavePolicyWizardEntity { readonly id: string; readonly name: string; }
export interface LeavePolicyWizardEdit { readonly policyId: string; readonly edit: LeavePolicyEdit; }

const KIND_LABELS: Record<string, string> = { legal_entity: 'company', department: 'department', position: 'position', employee: 'employee' };

function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

function displayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

@Component({
  selector: 'app-leave-policy-form-wizard',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [CommonModule, FormsModule, ProgressBarComponent, DatePickerComponent, SelectComponent],
  templateUrl: './leave-policy-form-wizard.component.html',
  styleUrl: './leave-policy-form-wizard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeavePolicyFormWizardComponent {
  readonly leaveTypes = input<readonly LeaveTypeResponse[]>([]);
  readonly legalEntities = input<readonly LeavePolicyWizardEntity[]>([]);
  readonly departmentOptions = input<readonly SelectOption[]>([]);
  readonly positionOptions = input<readonly SelectOption[]>([]);
  /** Set to edit an existing policy; null creates a new one. */
  readonly policy = input<LeavePolicyDetail | null>(null);
  readonly conflicts = input<readonly LeavePolicyAssignmentConflict[]>([]);
  readonly saving = input(false);

  readonly create = output<CreateLeavePolicyRequest>();
  readonly saveEdit = output<LeavePolicyWizardEdit>();
  readonly cancel = output<void>();

  readonly steps = ['Basics', 'Amount', 'Rules & assignment'] as const;
  readonly totalSteps = 3;
  readonly step = signal(1);
  readonly stepProgress = computed(() => (this.step() / this.totalSteps) * 100);
  readonly validationErrors = signal<readonly string[]>([]);
  readonly today = localToday();

  readonly periodOptions: readonly SelectOption[] = LEAVE_AMOUNT_PERIOD_OPTIONS;
  readonly eligibilityOptions: readonly SelectOption[] = LEAVE_ELIGIBILITY_OPTIONS;
  readonly approvalOptions: readonly SelectOption[] = LEAVE_POLICY_APPROVAL_MODE_OPTIONS;

  // Basics
  readonly leaveTypeId = signal('');
  readonly name = signal('');
  readonly description = signal('');
  // Amount
  readonly amountHours = signal<number | null>(null);
  readonly amountPeriod = signal<LeaveAmountPeriod>('month');
  readonly carryMode = signal<'all' | 'cap'>('all');
  readonly carryCapHours = signal<number | null>(null);
  readonly carryExpires = signal(false);
  readonly carryExpiryMonths = signal<number | null>(3);
  readonly eligibleFrom = signal<LeaveEligibility>('immediately');
  readonly eligibleAfterMonths = signal<number | null>(null);
  // Rules
  readonly minimumNoticeDays = signal(0);
  readonly minRequestHours = signal<number | null>(1);
  readonly maxRequestHours = signal<number | null>(null);
  readonly maxTeamAbsencePercent = signal<number | null>(null);
  readonly approvalMode = signal<LeavePolicyApprovalMode>('any_one');
  readonly blackouts = signal<readonly LeavePolicyBlackout[]>([]);
  // Assignment
  readonly companyIds = signal<readonly string[]>([]);
  readonly departmentIds = signal<readonly string[]>([]);
  readonly positionIds = signal<readonly string[]>([]);
  // Edit
  readonly applyFrom = signal(this.today);
  private baseRules: LeavePolicyRules | null = null;
  private baseTargets = '';
  /** The targets the shown conflicts were found for; a Replace only applies to exactly these. */
  private readonly submittedTargets = signal<string | null>(null);

  readonly isEdit = computed(() => this.policy() !== null);
  readonly singleCompany = computed(() => this.legalEntities().length === 1);
  readonly leaveTypeOptions = computed<readonly SelectOption[]>(() =>
    this.leaveTypes().filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name })));
  readonly leaveTypeName = computed(() =>
    this.leaveTypes().find((t) => t.id === this.leaveTypeId())?.name ?? this.policy()?.leaveTypeName ?? 'this leave type');
  readonly availableDepartments = computed(() => this.departmentOptions().filter((o) => !this.departmentIds().includes(o.value)));
  readonly availablePositions = computed(() => this.positionOptions().filter((o) => !this.positionIds().includes(o.value)));
  readonly scheduledVersion = computed<LeavePolicyVersion | null>(() =>
    this.policy()?.versions.filter((v) => v.isFuture).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null);
  readonly scheduledNote = computed(() => {
    const scheduled = this.scheduledVersion();
    return scheduled ? `Editing the change scheduled for ${displayDate(scheduled.effectiveFrom)}.` : '';
  });
  /** A version that already started today is in force and cannot be replaced, so the earliest
   * new version is then tomorrow. */
  readonly minApplyFrom = computed(() =>
    this.policy()?.versions.some((v) => v.effectiveFrom === this.today) ? nextDay(this.today) : this.today);
  readonly applyFromError = computed(() => {
    if (!this.isEdit()) return '';
    if (!this.applyFrom() || this.applyFrom() < this.minApplyFrom())
      return this.minApplyFrom() === this.today
        ? 'Changes can apply from today or later.'
        : 'A version already started today. Changes can apply from tomorrow.';
    return '';
  });
  readonly canSubmit = computed(() => !this.saving() && !this.applyFromError());
  readonly conflictLines = computed(() => this.conflictsAreCurrent() ? this.conflicts().map((c) =>
    `${c.targetName} ${KIND_LABELS[c.targetKind] ?? ''} already uses '${c.existingPolicyName}' for ${this.leaveTypeName()}.`) : []);
  private readonly conflictsAreCurrent = computed(() =>
    this.submittedTargets() !== null && this.submittedTargets() === this.targetKey(this.targets()));

  constructor() {
    effect(() => {
      const entities = this.legalEntities();
      if (entities.length === 1 && !untracked(() => this.isEdit()))
        untracked(() => this.companyIds.set([entities[0].id]));
    });
    effect(() => {
      const policy = this.policy();
      if (policy) untracked(() => this.prefill(policy));
    });
  }

  departmentLabel(id: string): string { return this.departmentOptions().find((o) => o.value === id)?.label ?? id; }
  positionLabel(id: string): string { return this.positionOptions().find((o) => o.value === id)?.label ?? id; }

  setStep(step: number): void { this.step.set(Math.min(this.totalSteps, Math.max(1, step))); }
  back(): void { this.validationErrors.set([]); this.setStep(this.step() - 1); }

  next(): void {
    const errors = this.errorsForStep(this.step());
    this.validationErrors.set(errors);
    if (!errors.length) this.setStep(this.step() + 1);
  }

  toggleCompany(id: string, checked: boolean): void {
    this.companyIds.update((ids) => checked ? [...ids.filter((x) => x !== id), id] : ids.filter((x) => x !== id));
  }
  addDepartment(id: string): void { if (id) this.departmentIds.update((ids) => ids.includes(id) ? ids : [...ids, id]); }
  removeDepartment(id: string): void { this.departmentIds.update((ids) => ids.filter((x) => x !== id)); }
  addPosition(id: string): void { if (id) this.positionIds.update((ids) => ids.includes(id) ? ids : [...ids, id]); }
  removePosition(id: string): void { this.positionIds.update((ids) => ids.filter((x) => x !== id)); }

  addBlackout(): void { this.blackouts.update((list) => [...list, { startDate: '', endDate: '', reason: null }]); }
  removeBlackout(index: number): void { this.blackouts.update((list) => list.filter((_, i) => i !== index)); }
  updateBlackout(index: number, key: keyof LeavePolicyBlackout, value: string): void {
    this.blackouts.update((list) => list.map((b, i) => i === index ? { ...b, [key]: key === 'reason' ? (value.trim() || null) : value } : b));
  }

  /** Number inputs: blank means "not set". */
  num(value: string): number | null {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  submit(): void {
    if (!this.validateAll()) return;
    this.submittedTargets.set(this.targetKey(this.targets()));
    const policy = this.policy();
    if (policy) this.emitEdit(policy, false);
    else this.emitCreate(false);
  }

  /** Resends with replaceConflicts only for the targets whose conflicts are on screen, after the
   * same checks as a normal save. */
  confirmReplace(): void {
    if (!this.conflictsAreCurrent() || !this.validateAll()) return;
    const policy = this.policy();
    if (policy) this.emitEdit(policy, true);
    else this.emitCreate(true);
  }

  private validateAll(): boolean {
    const errors = [1, 2, 3].flatMap((s) => this.errorsForStep(s));
    this.validationErrors.set(errors);
    return !errors.length && this.canSubmit();
  }

  rules(): LeavePolicyRules {
    return {
      amountHours: this.amountHours() ?? 0,
      amountPeriod: this.amountPeriod(),
      carryForwardCapHours: this.carryMode() === 'cap' ? this.carryCapHours() : null,
      carryForwardExpiryMonths: this.carryExpires() ? this.carryExpiryMonths() : null,
      eligibleFrom: this.eligibleFrom(),
      eligibleAfterMonths: this.eligibleFrom() === 'after_months' ? this.eligibleAfterMonths() : null,
      minimumNoticeDays: this.minimumNoticeDays(),
      minRequestHours: this.minRequestHours() ?? 0,
      maxRequestHours: this.maxRequestHours(),
      maxTeamAbsencePercent: this.maxTeamAbsencePercent(),
      approvalMode: this.approvalMode(),
      blackouts: this.blackouts().filter((b) => b.startDate && b.endDate)
    };
  }

  targets(): readonly LeavePolicyAssignmentTarget[] {
    return [
      ...this.companyIds().map((targetId) => ({ targetKind: 'legal_entity' as const, targetId })),
      ...this.departmentIds().map((targetId) => ({ targetKind: 'department' as const, targetId })),
      ...this.positionIds().map((targetId) => ({ targetKind: 'position' as const, targetId }))
    ];
  }

  private emitCreate(replaceConflicts: boolean): void {
    this.create.emit({
      leaveTypeId: this.leaveTypeId(),
      name: this.name().trim(),
      description: this.description().trim() || null,
      rules: this.rules(),
      assignments: this.targets(),
      replaceConflicts
    });
  }

  private emitEdit(policy: LeavePolicyDetail, replaceConflicts: boolean): void {
    const name = this.name().trim();
    const description = this.description().trim() || null;
    const rules = this.rules();
    const targets = this.targets();
    this.saveEdit.emit({
      policyId: policy.id,
      edit: {
        details: name !== policy.name || description !== policy.description ? { name, description } : null,
        version: JSON.stringify(rules) !== JSON.stringify(this.baseRules) || this.applyFrom() !== this.defaultApplyFrom()
          ? { applyFrom: this.applyFrom(), rules }
          : null,
        assignments: this.targetKey(targets) !== this.baseTargets ? targets : null,
        replaceConflicts
      }
    });
  }

  private defaultApplyFrom(): string {
    const preferred = this.scheduledVersion()?.effectiveFrom ?? this.today;
    return preferred < this.minApplyFrom() ? this.minApplyFrom() : preferred;
  }

  private targetKey(targets: readonly LeavePolicyAssignmentTarget[]): string {
    return targets.map((t) => `${t.targetKind}:${t.targetId}`).sort().join('|');
  }

  private prefill(policy: LeavePolicyDetail): void {
    const base = this.scheduledVersion() ?? policy.current;
    this.leaveTypeId.set(policy.leaveTypeId);
    this.name.set(policy.name);
    this.description.set(policy.description ?? '');
    this.amountHours.set(base.amountHours);
    this.amountPeriod.set(base.amountPeriod);
    this.carryMode.set(base.carryForwardCapHours == null ? 'all' : 'cap');
    this.carryCapHours.set(base.carryForwardCapHours);
    this.carryExpires.set(base.carryForwardExpiryMonths != null);
    this.carryExpiryMonths.set(base.carryForwardExpiryMonths ?? 3);
    this.eligibleFrom.set(base.eligibleFrom);
    this.eligibleAfterMonths.set(base.eligibleAfterMonths);
    this.minimumNoticeDays.set(base.minimumNoticeDays);
    this.minRequestHours.set(base.minRequestHours);
    this.maxRequestHours.set(base.maxRequestHours);
    this.maxTeamAbsencePercent.set(base.maxTeamAbsencePercent);
    this.approvalMode.set(base.approvalMode);
    this.blackouts.set(base.blackouts);
    const own = policy.assignments.filter((a) => a.targetKind !== 'employee');
    this.companyIds.set(own.filter((a) => a.targetKind === 'legal_entity').map((a) => a.targetId));
    this.departmentIds.set(own.filter((a) => a.targetKind === 'department').map((a) => a.targetId));
    this.positionIds.set(own.filter((a) => a.targetKind === 'position').map((a) => a.targetId));
    this.applyFrom.set(this.defaultApplyFrom());
    this.baseRules = this.rules();
    this.baseTargets = this.targetKey(this.targets());
  }

  private errorsForStep(step: number): string[] {
    const errors: string[] = [];
    if (step === 1) {
      if (!this.leaveTypeId()) errors.push('Choose a leave type.');
      if (!this.name().trim()) errors.push('Enter a policy name.');
    }
    if (step === 2) {
      const hours = this.amountHours();
      if (hours == null || hours <= 0) errors.push('Enter how many hours are given.');
      if (this.carryMode() === 'cap' && (this.carryCapHours() == null || (this.carryCapHours() ?? 0) < 0))
        errors.push('Enter how many hours can be carried over.');
      const months = this.carryExpiryMonths();
      if (this.carryExpires() && (months == null || months < 1 || months > 24))
        errors.push('Carried hours expire after 1 to 24 months.');
      const after = this.eligibleAfterMonths();
      if (this.eligibleFrom() === 'after_months' && (after == null || after < 1 || after > 60))
        errors.push('Enter after how many months new joiners can use it (1 to 60).');
    }
    if (step === 3) {
      const min = this.minRequestHours();
      const max = this.maxRequestHours();
      const team = this.maxTeamAbsencePercent();
      if (min == null || min <= 0) errors.push('The shortest request must be more than 0 hours.');
      if (max != null && min != null && max < min) errors.push('The longest request cannot be shorter than the shortest.');
      if (team != null && (team < 1 || team > 100)) errors.push('Team absence must be between 1 and 100 percent.');
      if (this.minimumNoticeDays() < 0) errors.push('Notice cannot be negative.');
      if (this.blackouts().some((b) => b.startDate && b.endDate && b.endDate < b.startDate))
        errors.push('A blackout period cannot end before it starts.');
    }
    return errors;
  }
}
