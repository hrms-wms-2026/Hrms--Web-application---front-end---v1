/** Quiet Operations Desk: personal and team leave positions on one Balances surface. */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { KpiTile, KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveRequestStore } from '../../state/leave-request.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { CancelLeaveRequestRequest, LeaveRequestListItemResponse, LeaveUploadedDocument, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveBalanceListTableComponent } from '../../ui/leave-balance-list-table/leave-balance-list-table.component';
import { LeaveCancelConfirmDialogComponent } from '../../../../shared/ui/leave-cancel-confirm-dialog/leave-cancel-confirm-dialog.component';
import { LeaveRequestHistoryTableComponent } from '../../ui/leave-request-history-table/leave-request-history-table.component';
import { NewLeaveRequestWizardComponent } from '../../ui/new-leave-request-wizard/new-leave-request-wizard.component';
import { balancesToCsv, downloadCsv } from '../../utils/leave-balance-csv';

export type BalanceViewMode = 'my' | 'team';

@Component({
  selector: 'app-my-balances',
  standalone: true,
  imports: [CommonModule, BreadcrumbHeaderComponent, LoaderComponent, KpiTilesComponent, ButtonComponent, EmptyStateComponent, ErrorStateComponent, InputComponent, SelectComponent, LeaveBalanceListTableComponent, LeaveCancelConfirmDialogComponent, LeaveRequestHistoryTableComponent, NewLeaveRequestWizardComponent],
  templateUrl: './my-balances.component.html',
  styleUrls: ['../../ui/time-off-chrome.css', './my-balances.component.css'],
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

  readonly mySummary = computed(() => summarizeBalances(this.store.my()));
  readonly myKpiTiles = computed<readonly KpiTile[]>(() => {
    const s = this.mySummary();
    return [
      { label: 'Remaining', value: this.formatHours(s.remaining), hint: `across ${s.types} leave ${s.types === 1 ? 'type' : 'types'}`, icon: 'check-circle', tone: 'success', testId: 'summary-remaining' },
      { label: 'Pending', value: this.formatHours(s.pending), hint: 'awaiting approval', icon: 'clock', tone: 'warning' },
      { label: 'Used', value: this.formatHours(s.used), hint: `of ${this.formatHours(s.entitled)} entitled`, icon: 'layers' }
    ];
  });
  readonly expiringCarryForward = computed(() =>
    this.store.my().filter((balance) => balance.carriedForwardHours > 0 && !!balance.carryForwardExpiresOn)
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
    this.onSearchChange((event.target as HTMLInputElement).value);
  }

  onSearchChange(search: string): void {
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
    void this.store.loadWorkWindow();
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

  formatHours(value: number): string {
    return value.toFixed(2);
  }

  barShare(part: number, balance: LeaveBalanceResponse): number {
    const total = Math.max(balance.entitledHours, balance.usedHours + balance.pendingHours + Math.max(balance.remainingHours, 0), 1);
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
      remaining: summary.remaining + row.remainingHours,
      pending: summary.pending + row.pendingHours,
      used: summary.used + row.usedHours,
      entitled: summary.entitled + row.entitledHours,
      types: summary.types + 1
    }),
    { remaining: 0, pending: 0, used: 0, entitled: 0, types: 0 }
  );
}
