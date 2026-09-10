/** Quiet Operations Desk: personal and team leave positions on one Balances surface. */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveRequestStore } from '../../state/leave-request.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { CancelLeaveRequestRequest, LeaveRequestListItemResponse, LeaveUploadedDocument, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveBalanceListTableComponent } from '../../ui/leave-balance-list-table/leave-balance-list-table.component';
import { LeaveCancelConfirmDialogComponent } from '../../ui/leave-cancel-confirm-dialog/leave-cancel-confirm-dialog.component';
import { LeaveRequestHistoryTableComponent } from '../../ui/leave-request-history-table/leave-request-history-table.component';
import { NewLeaveRequestWizardComponent } from '../../ui/new-leave-request-wizard/new-leave-request-wizard.component';
import { balancesToCsv, downloadCsv } from '../../utils/leave-balance-csv';

export type BalanceViewMode = 'my' | 'team';

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
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly yearOptions: SelectOption[] = yearOptions();
  readonly selectedYear = computed(() => String(this.store.year()));
  readonly wizardOpen = signal(false);
  readonly uploadedDocuments = signal<LeaveUploadedDocument[]>([]);
  readonly cancelTarget = signal<LeaveRequestListItemResponse | null>(null);
  readonly viewMode = signal<BalanceViewMode>('my');

  readonly canShowMyView = computed(() => this.permissionService.hasAnyPermission(['leave:read-own']));
  readonly canShowTeamView = computed(() => this.permissionService.hasPermission('leave:read-team'));
  readonly canShowViewToggle = computed(() => this.canShowMyView() && this.canShowTeamView());

  readonly pageSubtitle = computed(() =>
    this.viewMode() === 'team'
      ? 'Leave positions for your direct and indirect reports.'
      : 'Your leave entitlement and remaining days for the selected year.'
  );

  readonly mySummary = computed(() => summarizeBalances(this.store.my()));
  readonly expiringCarryForward = computed(() =>
    this.store.my().filter((balance) => balance.carriedForwardDays > 0 && !!balance.carryForwardExpiresOn)
  );

  constructor() {
    this.viewMode.set(this.resolveInitialView());
    this.ensureViewLoaded(this.viewMode());
  }

  selectViewMode(mode: BalanceViewMode): void {
    if (mode === 'team' && !this.canShowTeamView()) return;
    if (mode === 'my' && !this.canShowMyView()) return;
    this.viewMode.set(mode);
    void this.router.navigate(['/time-off'], {
      queryParams: { view: mode === 'team' ? 'team' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.ensureViewLoaded(mode);
  }

  onYearChange(year: string): void {
    const selected = Number(year);
    if (this.viewMode() === 'team') {
      void this.store.loadTeam(selected);
      return;
    }
    void this.store.loadMy(selected);
  }

  onSearchInput(event: Event): void {
    const search = (event.target as HTMLInputElement).value;
    this.store.setTeamFilters({ ...this.store.teamFilters(), search: search || undefined });
  }

  canExportCsv(): boolean {
    return this.viewMode() === 'team' ? this.store.team().length > 0 : this.store.my().length > 0;
  }

  onExportCsv(): void {
    const rows = this.viewMode() === 'team' ? this.store.team() : this.store.my();
    if (rows.length === 0) return;
    downloadCsv(balancesToCsv(rows), `leave-balances-${this.viewMode()}-${this.store.year()}.csv`);
  }

  openWizard(): void {
    this.wizardOpen.set(true);
  }

  closeWizard(): void {
    this.wizardOpen.set(false);
    this.uploadedDocuments.set([]);
    this.requestStore.clearPreview();
  }

  async onDocumentSelected(file: File): Promise<void> {
    const uploaded = await this.requestStore.uploadDocument(file);
    if (uploaded) this.uploadedDocuments.update((docs) => [...docs, uploaded]);
  }

  onDocumentRemoved(id: string): void {
    this.uploadedDocuments.update((docs) => docs.filter((doc) => doc.id !== id));
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

  formatDays(value: number): string {
    return value.toFixed(1);
  }

  barShare(part: number, balance: LeaveBalanceResponse): number {
    const total = Math.max(balance.entitledDays, balance.usedDays + balance.pendingDays + Math.max(balance.remainingDays, 0), 1);
    return Math.max(0, Math.min(100, (Math.max(part, 0) / total) * 100));
  }

  private resolveInitialView(): BalanceViewMode {
    const requested = this.route.snapshot.queryParamMap.get('view');
    if (requested === 'team' && this.canShowTeamView()) return 'team';
    if (requested === 'my' && this.canShowMyView()) return 'my';
    if (this.canShowMyView()) return 'my';
    if (this.canShowTeamView()) return 'team';
    return 'my';
  }

  private ensureViewLoaded(mode: BalanceViewMode): void {
    if (mode === 'team') {
      if (this.canShowTeamView()) void this.store.loadTeam(this.store.year());
      return;
    }
    if (!this.canShowMyView()) return;
    void this.store.loadMy(this.store.year());
    void this.requestStore.loadMine();
    void this.leaveTypeStore.load();
  }
}

export function yearOptions(): SelectOption[] {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1].map((year) => ({ value: String(year), label: String(year) }));
}

export function summarizeBalances(rows: readonly LeaveBalanceResponse[]): {
  remaining: number;
  pending: number;
  used: number;
  entitled: number;
  types: number;
} {
  return rows.reduce(
    (summary, row) => ({
      remaining: summary.remaining + row.remainingDays,
      pending: summary.pending + row.pendingDays,
      used: summary.used + row.usedDays,
      entitled: summary.entitled + row.entitledDays,
      types: summary.types + 1
    }),
    { remaining: 0, pending: 0, used: 0, entitled: 0, types: 0 }
  );
}
