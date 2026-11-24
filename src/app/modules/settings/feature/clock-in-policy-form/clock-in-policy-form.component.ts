import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { ClockInPolicyStore } from '../../state/clock-in-policy.store';
import { LeaveTypeApiService } from '../../../leave/data-access/leave-type-api.service';
import { firstValueFrom } from 'rxjs';
import { WorkModeListComponent } from '../work-mode-list/work-mode-list.component';
import {
  ClockInPolicySettingsFormValue,
  createDefaultClockInPolicyFormModel,
  createEmptyLateDeductionRule,
  formModelFromPolicy,
  LATE_DEDUCTION_RULES_DISABLED_MESSAGE,
  LATE_DEDUCTION_RULES_EDITABLE,
  LateDeductionRuleFormRow,
  validateClockInPolicyForm
} from '../../utils/clock-in-policy-form.utils';

/**
 * Settings → Clock-in Policy — single company-wide settings screen.
 * Resolves one active full_company policy behind the scenes (POST or PUT).
 * Policy metadata, scope, corrections, and status are not exposed.
 * Clock-in method configuration (Onsite/Remote/Hybrid/Field toggles,
 * location verification) is delegated entirely to WorkModeListComponent,
 * which manages its own set of Work Modes via WorkModeStore.
 */
@Component({
  selector: 'app-clock-in-policy-form',
  standalone: true,
  imports: [
    BreadcrumbHeaderComponent,
    ButtonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    InputComponent,
    ModalComponent,
    SelectComponent,
    WorkModeListComponent
  ],
  templateUrl: './clock-in-policy-form.component.html',
  styleUrl: './clock-in-policy-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClockInPolicyFormComponent {
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);

  readonly legalEntityStore = inject(LegalEntityStore);
  readonly policyStore = inject(ClockInPolicyStore);
  private readonly leaveTypes = inject(LeaveTypeApiService);

  readonly hasReadAccess = computed(
    () =>
      this.permissionService.hasModule('time_attendance') &&
      this.permissionService.hasPermission('attendance:read')
  );
  readonly hasWriteAccess = computed(() => this.permissionService.hasPermission('attendance:write'));
  readonly selectedLegalEntity = this.legalEntityStore.selectedLegalEntity;

  /**
   * Late deduction editing requires a real Time Off Type lookup.
   * Default follows LATE_DEDUCTION_RULES_EDITABLE (false until API exists).
   * Tests may override this signal to exercise the editable UI path.
   */
  readonly lateRulesEditable = signal(LATE_DEDUCTION_RULES_EDITABLE);

  /** Populated only when a real Time Off Type lookup is wired. Never hardcode options. */
  readonly timeOffTypeOptions = signal<readonly SelectOption[]>([]);

  readonly lateDeductionDisabledMessage = LATE_DEDUCTION_RULES_DISABLED_MESSAGE;

  readonly canSave = computed(
    () =>
      this.hasReadAccess() &&
      this.hasWriteAccess() &&
      !!this.selectedLegalEntity() &&
      !this.policyStore.multipleCompanyPolicies() &&
      !this.policyStore.error()
  );

  readonly form = signal<ClockInPolicySettingsFormValue>(createDefaultClockInPolicyFormModel());
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly submitted = signal(false);
  readonly isDirty = signal(false);

  /** Modal state for adding/editing a late deduction rule in a popup. */
  readonly ruleModalOpen = signal(false);
  readonly editingRuleIndex = signal<number | null>(null);
  readonly ruleDraft = signal<LateDeductionRuleFormRow>(createEmptyLateDeductionRule());
  readonly ruleDraftErrors = signal<Record<string, string>>({});

  markDirty(): void {
    this.isDirty.set(true);
  }

  /** Prevents overlapping bootstrap from reloading the same company. */
  private bootstrapKey: string | null = null;

  constructor() {
    effect(() => {
      const le = this.selectedLegalEntity();
      if (!le || !this.hasReadAccess()) {
        return;
      }
      void this.bootstrap(le.id);
    });
  }

  private async bootstrap(legalEntityId: string): Promise<void> {
    if (this.bootstrapKey === legalEntityId) {
      return;
    }
    this.bootstrapKey = legalEntityId;

    this.form.set(createDefaultClockInPolicyFormModel());
    this.fieldErrors.set({});
    this.submitted.set(false);
    this.isDirty.set(false);
    this.closeRuleModal();

    // Both lookups in parallel; the form is filled once the types decided whether rules are editable.
    const types = this.loadTimeOffTypes();
    await this.policyStore.loadCompanyPolicy(legalEntityId);
    await types;

    if (this.bootstrapKey !== legalEntityId) {
      return;
    }

    const policy = this.policyStore.policy();
    if (policy) {
      this.form.set(formModelFromPolicy(policy, undefined, this.lateRulesEditable()));
    }
    this.isDirty.set(false);
  }

  /** The rules editor turns on once there is at least one active time-off type to charge; otherwise the "configure
   *  time off types first" message stays. A failed lookup leaves it off. */
  private async loadTimeOffTypes(): Promise<void> {
    try {
      const types = await firstValueFrom(this.leaveTypes.list(false));
      const options = types.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }));
      if (options.length === 0) return;
      this.timeOffTypeOptions.set(options);
      this.lateRulesEditable.set(true);
    } catch {
      // No lookup (e.g. no leave:read access): the editor stays off with its explanation.
    }
  }

  timeOffTypeLabel(id: string): string {
    if (!id) {
      return 'Not selected';
    }
    return this.timeOffTypeOptions().find((o) => o.value === id)?.label ?? id;
  }

  openAddRuleModal(): void {
    if (!this.hasWriteAccess() || !this.lateRulesEditable()) {
      return;
    }
    this.editingRuleIndex.set(null);
    this.ruleDraft.set(createEmptyLateDeductionRule());
    this.ruleDraftErrors.set({});
    this.ruleModalOpen.set(true);
  }

  openEditRuleModal(index: number): void {
    if (!this.hasWriteAccess() || !this.lateRulesEditable()) {
      return;
    }
    const existing = this.form().lateDeductionRules[index];
    if (!existing) {
      return;
    }
    this.editingRuleIndex.set(index);
    this.ruleDraft.set({ ...existing });
    this.ruleDraftErrors.set({});
    this.ruleModalOpen.set(true);
  }

  closeRuleModal(): void {
    this.ruleModalOpen.set(false);
    this.editingRuleIndex.set(null);
    this.ruleDraftErrors.set({});
  }

  patchRuleDraft(partial: Partial<LateDeductionRuleFormRow>): void {
    this.ruleDraft.update((current) => ({ ...current, ...partial }));
    const editIdx = this.editingRuleIndex();
    if (editIdx !== null && editIdx < this.form().lateDeductionRules.length) {
      this.patchLateRule(editIdx, partial);
    }
  }

  ruleDraftErrorFor(field: keyof LateDeductionRuleFormRow): string {
    return this.ruleDraftErrors()[field] ?? '';
  }

  async confirmRuleModal(): Promise<void> {
    if (!this.hasWriteAccess() || !this.lateRulesEditable()) {
      return;
    }
    const currentRules = this.form().lateDeductionRules;
    const editIdx = this.editingRuleIndex();
    const draft = this.ruleDraft();

    const targetIdx = editIdx !== null ? editIdx : currentRules.length;
    const candidateRules =
      editIdx !== null
        ? currentRules.map((r, i) => (i === editIdx ? { ...draft } : r))
        : [...currentRules, { ...draft }];

    const candidateModel: ClockInPolicySettingsFormValue = {
      ...this.form(),
      lateDeductionRules: candidateRules
    };

    const validation = validateClockInPolicyForm(candidateModel, this.lateRulesEditable());
    const prefix = `lateDeductionRules.${targetIdx}.`;
    const draftErrors: Record<string, string> = {};
    if (validation.errors[`${prefix}lateArrivalMinutes`]) {
      draftErrors['lateArrivalMinutes'] = validation.errors[`${prefix}lateArrivalMinutes`];
    }
    if (validation.errors[`${prefix}deductionAmount`]) {
      draftErrors['deductionAmount'] = validation.errors[`${prefix}deductionAmount`];
    }
    if (validation.errors[`${prefix}timeOffTypeId`]) {
      draftErrors['timeOffTypeId'] = validation.errors[`${prefix}timeOffTypeId`];
    }

    if (Object.keys(draftErrors).length > 0 || !validation.valid) {
      this.ruleDraftErrors.set(draftErrors);
      this.submitted.set(true);
      this.fieldErrors.set(validation.errors);
      return;
    }

    const previousRules = currentRules;
    this.form.set(candidateModel);
    this.ruleDraftErrors.set({});
    const saved = await this.savePolicyNow();
    if (saved) {
      this.closeRuleModal();
    } else {
      this.form.update((curr) => ({ ...curr, lateDeductionRules: previousRules }));
    }
  }

  async deleteLateRule(index: number): Promise<void> {
    if (!this.hasWriteAccess() || !this.lateRulesEditable()) {
      return;
    }
    const previousRules = this.form().lateDeductionRules;
    this.removeLateRule(index);
    const saved = await this.savePolicyNow();
    if (!saved) {
      this.form.update((curr) => ({ ...curr, lateDeductionRules: previousRules }));
    }
  }

  patchForm(partial: Partial<ClockInPolicySettingsFormValue>): void {
    if (!this.hasWriteAccess()) {
      return;
    }
    this.form.update((current) => ({ ...current, ...partial }));
    this.isDirty.set(true);
  }

  addLateRule(): void {
    if (!this.hasWriteAccess() || !this.lateRulesEditable()) {
      return;
    }
    const emptyRule = createEmptyLateDeductionRule();
    const newIndex = this.form().lateDeductionRules.length;
    this.patchForm({
      lateDeductionRules: [...this.form().lateDeductionRules, emptyRule]
    });
    this.editingRuleIndex.set(newIndex);
    this.ruleDraft.set({ ...emptyRule });
    this.ruleDraftErrors.set({});
    this.ruleModalOpen.set(true);
  }

  removeLateRule(index: number): void {
    if (!this.hasWriteAccess() || !this.lateRulesEditable()) {
      return;
    }
    this.patchForm({
      lateDeductionRules: this.form().lateDeductionRules.filter((_, i) => i !== index)
    });
    if (this.editingRuleIndex() === index) {
      this.closeRuleModal();
    }
  }

  patchLateRule(index: number, partial: Partial<LateDeductionRuleFormRow>): void {
    if (!this.hasWriteAccess() || !this.lateRulesEditable()) {
      return;
    }
    const rules = this.form().lateDeductionRules.map((rule, i) =>
      i === index ? { ...rule, ...partial } : rule
    );
    this.patchForm({ lateDeductionRules: rules });
  }

  errorFor(key: string): string {
    return this.submitted() ? (this.fieldErrors()[key] ?? '') : '';
  }

  async onSubmit(): Promise<void> {
    await this.savePolicyNow();
  }

  private async savePolicyNow(): Promise<boolean> {
    if (!this.hasWriteAccess() || this.policyStore.multipleCompanyPolicies()) {
      return false;
    }

    this.submitted.set(true);
    const model = this.form();
    const validation = validateClockInPolicyForm(model, this.lateRulesEditable());
    this.fieldErrors.set(validation.errors);
    if (!validation.valid) {
      return false;
    }

    const le = this.selectedLegalEntity();
    if (!le) {
      return false;
    }

    const saved = await this.policyStore.saveCompanyPolicy(le.id, model, this.lateRulesEditable());
    if (saved) {
      this.isDirty.set(false);
      this.form.set(formModelFromPolicy(saved, undefined, this.lateRulesEditable()));
      this.notificationService.success('Changes saved.');
      return true;
    } else {
      this.notificationService.error(
        this.policyStore.saveError() ?? 'Could not save clock-in policy. Try again.'
      );
      return false;
    }
  }

  onRetryLoad(): void {
    const le = this.selectedLegalEntity();
    if (le) {
      this.bootstrapKey = null;
      this.policyStore.clear();
      void this.bootstrap(le.id);
    }
  }
}
