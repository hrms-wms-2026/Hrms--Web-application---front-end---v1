/** Quiet Operations Desk: the employee's own leave position, request history, and the New Request entry point. */
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { GeneralSettingsStore } from '../../../organization/state/general-settings.store';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveRequestStore } from '../../state/leave-request.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { CancelLeaveRequestRequest, LeaveRequestListItemResponse, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveBalanceListTableComponent } from '../../ui/leave-balance-list-table/leave-balance-list-table.component';
import { LeaveCancelConfirmDialogComponent } from '../../ui/leave-cancel-confirm-dialog/leave-cancel-confirm-dialog.component';
import { LeaveRequestHistoryTableComponent } from '../../ui/leave-request-history-table/leave-request-history-table.component';
import { NewLeaveRequestWizardComponent } from '../../ui/new-leave-request-wizard/new-leave-request-wizard.component';

@Component({
  selector: 'app-my-balances',
  standalone: true,
  imports: [CommonModule, ButtonComponent, EmptyStateComponent, ErrorStateComponent, SelectComponent, LeaveBalanceListTableComponent, LeaveCancelConfirmDialogComponent, LeaveRequestHistoryTableComponent, NewLeaveRequestWizardComponent],
  templateUrl: './my-balances.component.html',
  styleUrl: './my-balances.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyBalancesComponent {
  readonly store = inject(LeaveBalanceStore);
  readonly requestStore = inject(LeaveRequestStore);
  readonly leaveTypeStore = inject(LeaveTypeStore);
  readonly settingsStore = inject(GeneralSettingsStore);
  private readonly legalEntityStore = inject(LegalEntityStore);
  private readonly notificationService = inject(NotificationService);
  readonly yearOptions: SelectOption[] = yearOptions();
  readonly selectedYear = computed(() => String(this.store.year()));
  readonly wizardOpen = signal(false);
  readonly cancelTarget = signal<LeaveRequestListItemResponse | null>(null);

  constructor() {
    void this.store.loadMy(new Date().getFullYear());
    void this.requestStore.loadMine();
    void this.leaveTypeStore.load();
    effect(() => {
      const id = this.legalEntityStore.selectedLegalEntityId();
      if (!id || this.settingsStore.legalEntityId() === id) return;
      void this.settingsStore.load(id);
    });
  }

  onYearChange(year: string): void {
    void this.store.loadMy(Number(year));
  }

  openWizard(): void {
    this.wizardOpen.set(true);
  }

  closeWizard(): void {
    this.wizardOpen.set(false);
    this.requestStore.clearPreview();
  }

  onPreviewRequested(payload: SubmitLeaveRequestRequest): void {
    void this.requestStore.preview(payload);
  }

  async onSubmitRequested(payload: SubmitLeaveRequestRequest): Promise<void> {
    const result = await this.requestStore.submit(payload);
    if (result) {
      this.closeWizard();
      void this.store.loadMy(this.store.year());
    }
  }

  onCancelRequested(request: LeaveRequestListItemResponse): void {
    this.cancelTarget.set(request);
  }

  closeCancelDialog(): void {
    this.cancelTarget.set(null);
  }

  async onConfirmCancel(payload: CancelLeaveRequestRequest): Promise<void> {
    const target = this.cancelTarget();
    if (!target) return;
    const result = await this.requestStore.cancel(target.id, payload);
    if (result) {
      this.notificationService.success('Leave request cancelled.');
      this.closeCancelDialog();
    } else {
      this.notificationService.error(this.requestStore.cancelError() ?? 'Failed to cancel this request.');
    }
  }
}

export function yearOptions(): SelectOption[] {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1].map((year) => ({ value: String(year), label: String(year) }));
}
