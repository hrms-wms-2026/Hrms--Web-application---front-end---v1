/** Quiet Operations Desk: HR's home for entitlement bookkeeping and the organization-wide balance ledger. */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LegalEntityApiService } from '../../../organization/data-access/legal-entity-api.service';
import { LegalEntityListItem } from '../../../organization/models/legal-entity.model';
import { LeaveEntitlementApiService } from '../../data-access/leave-entitlement-api.service';
import { LeaveEntitlementStore } from '../../state/leave-entitlement.store';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeaveRequestStore } from '../../state/leave-request.store';
import { LeaveBalanceAuditStore } from '../../state/leave-balance-audit.store';
import { AdjustEntitlementRequest, CreateManualEntitlementRequest, GenerateEntitlementsRequest, LeaveEntitlementResponse, RecalculateEntitlementRequest } from '../../models/leave-entitlement.model';
import { LeaveUploadedDocument, SubmitLeaveRequestOnBehalfRequest, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveEntitlementListTableComponent } from '../../ui/leave-entitlement-list-table/leave-entitlement-list-table.component';
import { LeaveEntitlementGenerateModalComponent } from '../../ui/leave-entitlement-generate-modal/leave-entitlement-generate-modal.component';
import { LeaveEntitlementManualFormModalComponent } from '../../ui/leave-entitlement-manual-form-modal/leave-entitlement-manual-form-modal.component';
import { LeaveEntitlementAdjustModalComponent } from '../../ui/leave-entitlement-adjust-modal/leave-entitlement-adjust-modal.component';
import { LeaveBalanceListTableComponent } from '../../ui/leave-balance-list-table/leave-balance-list-table.component';
import { LeaveBalanceAuditTableComponent } from '../../ui/leave-balance-audit-table/leave-balance-audit-table.component';
import { NewLeaveRequestWizardComponent } from '../../ui/new-leave-request-wizard/new-leave-request-wizard.component';
import { balancesToCsv, downloadCsv } from '../../utils/leave-balance-csv';

type Tab = 'entitlements' | 'all-balances' | 'audit';

@Component({
  selector: 'app-entitlements-management',
  standalone: true,
  imports: [CommonModule, ButtonComponent, EmptyStateComponent, ErrorStateComponent, InputComponent, SelectComponent, LeaveEntitlementListTableComponent, LeaveEntitlementGenerateModalComponent, LeaveEntitlementManualFormModalComponent, LeaveEntitlementAdjustModalComponent, LeaveBalanceListTableComponent, LeaveBalanceAuditTableComponent, NewLeaveRequestWizardComponent],
  templateUrl: './entitlements-management.component.html',
  styleUrls: ['../../ui/time-off-chrome.css', './entitlements-management.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntitlementsManagementComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly legalEntityApi = inject(LegalEntityApiService);
  private readonly entitlementApi = inject(LeaveEntitlementApiService);
  readonly entitlementStore = inject(LeaveEntitlementStore);
  readonly balanceStore = inject(LeaveBalanceStore);
  readonly leaveTypeStore = inject(LeaveTypeStore);
  readonly requestStore = inject(LeaveRequestStore);
  readonly auditStore = inject(LeaveBalanceAuditStore);
  readonly canManage = computed(() => this.permissionService.hasPermission('leave:manage'));
  readonly canReadAllBalances = computed(() => this.permissionService.hasAnyPermission(['leave:read', 'leave:manage']));
  readonly activeTab = signal<Tab>('entitlements');
  readonly legalEntities = signal<readonly LegalEntityListItem[]>([]);
  readonly generateModalOpen = signal(false);
  readonly manualModalOpen = signal(false);
  readonly adjustTarget = signal<LeaveEntitlementResponse | null>(null);
  readonly adjustNeedsConfirmation = signal(false);
  readonly requestWizardOpen = signal(false);
  readonly uploadedDocuments = signal<LeaveUploadedDocument[]>([]);
  readonly yearOptions: SelectOption[] = yearOptions();
  readonly selectedYear = computed(() => String(this.entitlementStore.year()));
  readonly entitlementSummary = computed(() => summarizeEntitlements(this.entitlementStore.items()));
  private allBalancesLoaded = false;
  private auditLoaded = false;

  constructor() {
    void this.entitlementStore.load();
    void this.leaveTypeStore.load();
    void this.loadLegalEntities();
  }

  private async loadLegalEntities(): Promise<void> {
    try {
      this.legalEntities.set(await firstValueFrom(this.legalEntityApi.getLegalEntities(false)));
    } catch {
      this.notificationService.error('Failed to load legal entities.');
    }
  }

  onYearChange(year: string): void {
    this.entitlementStore.setYear(Number(year));
    if (this.activeTab() === 'all-balances') void this.balanceStore.loadAll(Number(year));
  }

  onSearchChange(search: string): void {
    this.entitlementStore.setFilters({ ...this.entitlementStore.filters(), search: search || undefined });
  }

  onSearchInput(event: Event): void {
    const search = (event.target as HTMLInputElement).value;
    this.entitlementStore.setFilters({ ...this.entitlementStore.filters(), search: search || undefined });
  }

  formatHours(value: number): string {
    return value.toFixed(2);
  }

  selectTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab === 'all-balances' && !this.allBalancesLoaded) {
      this.allBalancesLoaded = true;
      void this.balanceStore.loadAll(this.entitlementStore.year());
    }
    if (tab === 'audit' && !this.auditLoaded) {
      this.auditLoaded = true;
      void this.auditStore.load();
    }
  }

  onExportAllBalances(): void {
    const rows = this.balanceStore.all();
    if (rows.length === 0) return;
    downloadCsv(balancesToCsv(rows), `leave-balances-all-${this.entitlementStore.year()}.csv`);
  }

  async onExportAudit(): Promise<void> {
    const blob = await this.auditStore.exportCsv();
    if (!blob) { this.notificationService.error(this.auditStore.exportError() ?? 'Failed to export the audit trail.'); return; }
    this.downloadBlob(blob, 'leave-balance-audit.csv');
  }

  async onExportGeneratePreview(payload: GenerateEntitlementsRequest): Promise<void> {
    try {
      const blob = await firstValueFrom(this.entitlementApi.exportGeneratePreview(payload));
      this.downloadBlob(blob, `leave-entitlement-generate-preview-${payload.year}.csv`);
    } catch {
      this.notificationService.error('Failed to export the generation preview.');
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  openGenerateModal(): void { this.generateModalOpen.set(true); }
  closeGenerateModal(): void { this.generateModalOpen.set(false); this.entitlementStore.clearGenerationPreview(); }

  async onPreviewGenerate(payload: { year: number; legalEntityId: string | null }): Promise<void> {
    await this.entitlementStore.previewGenerate(payload);
  }

  async onConfirmGenerate(payload: { year: number; legalEntityId: string | null }): Promise<void> {
    if (await this.entitlementStore.generate(payload)) {
      this.notificationService.success('Entitlements generated.');
      this.closeGenerateModal();
    }
  }

  openManualModal(): void { this.manualModalOpen.set(true); }
  closeManualModal(): void { this.manualModalOpen.set(false); }

  async onSaveManual(payload: CreateManualEntitlementRequest): Promise<void> {
    if (await this.entitlementStore.createManual(payload)) {
      this.notificationService.success('Manual entitlement created.');
      this.closeManualModal();
    } else {
      this.notificationService.error(this.entitlementStore.actionError() ?? 'Failed to create manual entitlement.');
    }
  }

  openAdjustModal(value: LeaveEntitlementResponse): void {
    this.adjustTarget.set(value);
    this.adjustNeedsConfirmation.set(false);
  }

  closeAdjustModal(): void {
    this.adjustTarget.set(null);
    this.adjustNeedsConfirmation.set(false);
  }

  async onSaveAdjust(payload: AdjustEntitlementRequest): Promise<void> {
    const target = this.adjustTarget();
    if (!target) return;
    const outcome = await this.entitlementStore.adjust(target.id, payload);
    if (outcome === 'success') {
      this.notificationService.success('Entitlement adjusted.');
      this.closeAdjustModal();
    } else if (outcome === 'confirm') {
      this.adjustNeedsConfirmation.set(true);
    } else {
      this.notificationService.error(this.entitlementStore.actionError() ?? 'Failed to adjust entitlement.');
    }
  }

  async onRecalculate(value: LeaveEntitlementResponse): Promise<void> {
    const outcome = await this.entitlementStore.recalculate(value.id, { confirmNegativeRemaining: false });
    if (outcome === 'success') {
      this.notificationService.success('Entitlement recalculated.');
    } else if (outcome === 'confirm') {
      const proceed = window.confirm('This recalculation would leave a negative remaining balance. Continue anyway?');
      if (proceed) {
        const forced = await this.entitlementStore.recalculate(value.id, { confirmNegativeRemaining: true } satisfies RecalculateEntitlementRequest);
        if (forced === 'success') {
          this.notificationService.success('Entitlement recalculated.');
        } else {
          this.notificationService.error(this.entitlementStore.actionError() ?? 'Failed to recalculate entitlement.');
        }
      }
    } else {
      this.notificationService.error(this.entitlementStore.actionError() ?? 'Failed to recalculate entitlement.');
    }
  }

  openRequestWizard(): void {
    this.requestWizardOpen.set(true);
    void this.balanceStore.loadWorkWindow();
  }
  closeRequestWizard(): void { this.requestWizardOpen.set(false); this.uploadedDocuments.set([]); this.requestStore.clearPreview(); }
  async onDocumentSelected(file: File): Promise<void> {
    const uploaded = await this.requestStore.uploadDocument(file);
    if (uploaded) this.uploadedDocuments.update((docs) => [...docs, uploaded]);
  }
  onDocumentRemoved(id: string): void {
    this.uploadedDocuments.update((docs) => docs.filter((doc) => doc.id !== id));
  }
  onRequestPreview(payload: SubmitLeaveRequestRequest): void { void this.requestStore.preview(payload); }

  async onRequestSubmit(payload: SubmitLeaveRequestRequest | SubmitLeaveRequestOnBehalfRequest): Promise<void> {
    const result = await this.requestStore.submitOnBehalf(payload as SubmitLeaveRequestOnBehalfRequest);
    if (result) {
      this.notificationService.success('Leave request submitted on behalf of the employee.');
      this.closeRequestWizard();
    } else {
      this.notificationService.error(this.requestStore.submitError() ?? 'Failed to submit the request.');
    }
  }
}

function yearOptions(): SelectOption[] {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1].map((year) => ({ value: String(year), label: String(year) }));
}

function summarizeEntitlements(items: readonly LeaveEntitlementResponse[]): {
  lines: number;
  employees: number;
  remaining: number;
  overUtilized: number;
} {
  const employees = new Set(items.map((item) => item.employeeId));
  return {
    lines: items.length,
    employees: employees.size,
    remaining: items.reduce((sum, item) => sum + item.remainingHours, 0),
    overUtilized: items.filter((item) => item.isOverUtilized || item.remainingHours < 0).length
  };
}
