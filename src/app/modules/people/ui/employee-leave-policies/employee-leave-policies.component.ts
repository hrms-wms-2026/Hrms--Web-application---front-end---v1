/** Employment tab card: the leave policy each leave type resolves to for this employee and where it
 * comes from (Employee / Position / Department / Company). Users with leave:manage or leave:create
 * can give the employee their own policy for a type, or reset to the inherited one. */
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { EmployeeLeavePolicyApiService } from '../../../leave/data-access/employee-leave-policy-api.service';
import { LeavePolicyApiService } from '../../../leave/data-access/leave-policy-api.service';
import { EmployeeLeavePolicyRow, LEAVE_POLICY_SOURCE_LABELS, LeavePolicyListItem } from '../../../leave/models/leave-policy.model';
import { formatAmount } from '../../../leave/utils/leave-amount';

@Component({
  selector: 'app-employee-leave-policies',
  standalone: true,
  imports: [ButtonComponent, ConfirmModalComponent, ModalComponent, SelectComponent],
  templateUrl: './employee-leave-policies.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeLeavePoliciesComponent {
  private readonly api = inject(EmployeeLeavePolicyApiService);
  private readonly policyApi = inject(LeavePolicyApiService);
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationService);

  readonly employeeId = input.required<string>();

  readonly rows = signal<readonly EmployeeLeavePolicyRow[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly canChange = computed(() => this.permissions.hasAnyPermission(['leave:manage', 'leave:create']));

  readonly changeRow = signal<EmployeeLeavePolicyRow | null>(null);
  readonly selectedPolicyId = signal('');
  readonly saving = signal(false);
  readonly resetRow = signal<EmployeeLeavePolicyRow | null>(null);
  private readonly policies = signal<readonly LeavePolicyListItem[]>([]);
  /** Only the newest load may write rows, so a slow answer for a previous employee is dropped. */
  private loadSeq = 0;

  readonly policyOptions = computed<readonly SelectOption[]>(() => {
    const row = this.changeRow();
    if (!row) return [];
    return this.policies()
      .filter((p) => p.isActive && p.leaveTypeId === row.leaveTypeId)
      .map((p) => ({ value: p.id, label: `${p.name} — ${formatAmount(p.amountHours, p.amountPeriod)}` }));
  });

  constructor() {
    effect(() => {
      const id = this.employeeId();
      void this.load(id);
    });
  }

  sourceLabel(row: EmployeeLeavePolicyRow): string {
    return row.sourceKind ? LEAVE_POLICY_SOURCE_LABELS[row.sourceKind] : '';
  }

  amount(row: EmployeeLeavePolicyRow): string {
    return row.amountHours != null && row.amountPeriod ? formatAmount(row.amountHours, row.amountPeriod) : '';
  }

  async load(id = this.employeeId()): Promise<void> {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.loadError.set('');
    try {
      const rows = await firstValueFrom(this.api.list(id));
      if (seq === this.loadSeq) this.rows.set(rows);
    } catch (err) {
      if (seq === this.loadSeq) this.loadError.set(toSafeErrorMessage(err, 'Could not load leave policies.'));
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  async openChange(row: EmployeeLeavePolicyRow): Promise<void> {
    this.changeRow.set(row);
    this.selectedPolicyId.set(row.policyId ?? '');
    // Fetched on every open so policies created since the page loaded are offered.
    try {
      this.policies.set(await firstValueFrom(this.policyApi.list(false)));
    } catch (err) {
      this.notifications.error(toSafeErrorMessage(err, 'Could not load leave policies.'));
    }
  }

  closeChange(): void { this.changeRow.set(null); }

  async saveChange(): Promise<void> {
    const row = this.changeRow();
    const policyId = this.selectedPolicyId();
    if (!row || !policyId) return;
    if (policyId === row.policyId) { this.closeChange(); return; }
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.set(this.employeeId(), row.leaveTypeId, policyId));
      this.closeChange();
      this.notifications.success('Policy updated.');
      await this.load();
    } catch (err) {
      this.notifications.error(toSafeErrorMessage(err, 'Could not change the policy.'));
    } finally {
      this.saving.set(false);
    }
  }

  askReset(row: EmployeeLeavePolicyRow): void { this.resetRow.set(row); }
  cancelReset(): void { this.resetRow.set(null); }

  async confirmReset(): Promise<void> {
    const row = this.resetRow();
    if (!row) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.reset(this.employeeId(), row.leaveTypeId));
      this.resetRow.set(null);
      this.notifications.success('Back to the inherited policy.');
      await this.load();
    } catch (err) {
      this.notifications.error(toSafeErrorMessage(err, 'Could not reset the policy.'));
    } finally {
      this.saving.set(false);
    }
  }
}
