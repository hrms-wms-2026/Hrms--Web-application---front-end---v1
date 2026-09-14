import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { ClockInPolicyStore } from '../../state/clock-in-policy.store';
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

    await this.policyStore.loadCompanyPolicy(legalEntityId);

    if (this.bootstrapKey !== legalEntityId) {
      return;
    }

    const policy = this.policyStore.policy();
    if (policy) {
      this.form.set(formModelFromPolicy(policy, undefined, this.lateRulesEditable()));
    }
  }

  patchForm(partial: Partial<ClockInPolicySettingsFormValue>): void {
    if (!this.hasWriteAccess()) {
      return;
    }
    this.form.update((current) => ({ ...current, ...partial }));
  }

  addLateRule(): void {
    if (!this.hasWriteAccess() || !this.lateRulesEditable()) {
      return;
    }
    this.patchForm({
      lateDeductionRules: [...this.form().lateDeductionRules, createEmptyLateDeductionRule()]
    });
  }

  removeLateRule(index: number): void {
    if (!this.hasWriteAccess() || !this.lateRulesEditable()) {
      return;
    }
    this.patchForm({
      lateDeductionRules: this.form().lateDeductionRules.filter((_, i) => i !== index)
    });
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
    if (!this.hasWriteAccess() || this.policyStore.multipleCompanyPolicies()) {
      return;
    }

    this.submitted.set(true);
    const model = this.form();
    const validation = validateClockInPolicyForm(model, this.lateRulesEditable());
    this.fieldErrors.set(validation.errors);
    if (!validation.valid) {
      return;
    }

    const le = this.selectedLegalEntity();
    if (!le) {
      return;
    }

    const saved = await this.policyStore.saveCompanyPolicy(le.id, model, this.lateRulesEditable());
    if (saved) {
      this.form.set(formModelFromPolicy(saved, undefined, this.lateRulesEditable()));
      this.notificationService.success('Changes saved.');
    } else {
      this.notificationService.error(
        this.policyStore.saveError() ?? 'Could not save clock-in policy. Try again.'
      );
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
