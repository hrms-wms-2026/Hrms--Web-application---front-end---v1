/** Quiet Operations Desk: policy administration combines a ledger, read-only review panel, and guided creation. */
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LegalEntityApiService } from '../../../organization/data-access/legal-entity-api.service';
import { LegalEntityListItem } from '../../../organization/models/legal-entity.model';
import { GeneralSettingsStore } from '../../../organization/state/general-settings.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeavePolicyStore } from '../../state/leave-policy.store';
import { CloneLeavePolicyRequest, LeavePolicyFormDraft, LeavePolicyListItemResponse } from '../../models/leave-policy.model';
import { toCreateLeavePolicyRequest } from '../../utils/leave-policy-form.mapper';
import { LeavePolicyListTableComponent } from '../../ui/leave-policy-list-table/leave-policy-list-table.component';
import { LeavePolicyDetailPanelComponent } from '../../ui/leave-policy-detail-panel/leave-policy-detail-panel.component';
import { LeavePolicyFormWizardComponent } from '../../ui/leave-policy-form-wizard/leave-policy-form-wizard.component';

@Component({ selector: 'app-policy-management', standalone: true, imports: [CommonModule, ButtonComponent, ErrorStateComponent, LeavePolicyListTableComponent, LeavePolicyDetailPanelComponent, LeavePolicyFormWizardComponent], templateUrl: './policy-management.component.html', styleUrl: './policy-management.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class PolicyManagementComponent implements OnInit {
  private readonly permissionService = inject(PermissionService); private readonly notificationService = inject(NotificationService); private readonly legalEntityApi = inject(LegalEntityApiService);
  private readonly generalSettingsStore = inject(GeneralSettingsStore);
  readonly policyStore = inject(LeavePolicyStore); readonly leaveTypeStore = inject(LeaveTypeStore);
  readonly hasManageAccess = computed(() => this.permissionService.hasPermission('leave:manage'));
  readonly policySummary = computed(() => {
    const items = this.policyStore.items();
    const entities = new Set(items.flatMap((policy) => policy.legalEntities.map((entity) => entity.legalEntityId)));
    return { total: items.length, active: items.filter((policy) => policy.isActive).length, entities: entities.size };
  });
  readonly legalEntities = signal<readonly LegalEntityListItem[]>([]); readonly wizardOpen = signal(false); readonly detailOpen = signal(false); readonly latestDraft = signal<LeavePolicyFormDraft | null>(null); readonly replaceConfirmOpen = signal(false); readonly cloneSource = signal<LeavePolicyListItemResponse | null>(null); readonly cloneName = signal(''); readonly cloneEffectiveFrom = signal(''); readonly cloneLegalEntityIds = signal<readonly string[]>([]);
  ngOnInit(): void { if (this.hasManageAccess()) void this.loadInitialData(); }
  async loadInitialData(): Promise<void> { await Promise.all([this.policyStore.loadPolicies(), this.leaveTypeStore.load(), this.loadLegalEntities()]); }
  private async loadLegalEntities(): Promise<void> { try { this.legalEntities.set(await firstValueFrom(this.legalEntityApi.getLegalEntities(false))); } catch { this.notificationService.error('Failed to load legal entities.'); } }
  openWizard(): void { this.latestDraft.set(null); this.wizardOpen.set(true); }
  closeWizard(): void { this.wizardOpen.set(false); }
  async viewPolicy(policy: LeavePolicyListItemResponse): Promise<void> { this.detailOpen.set(true); await this.policyStore.loadPolicy(policy.id); }
  closeDetail(): void { this.detailOpen.set(false); }
  async onSavePolicy(draft: LeavePolicyFormDraft): Promise<void> {
    const country = this.generalSettingsStore.settings()?.countryCode?.trim().toUpperCase() || draft.country?.trim().toUpperCase() || 'NA';
    const ready = { ...draft, country, jobLevel: null };
    this.latestDraft.set(ready);
    const outcome = await this.policyStore.createPolicy(toCreateLeavePolicyRequest(ready, false));
    await this.handleCreateOutcome(outcome, ready.name);
  }
  private async handleCreateOutcome(outcome: 'created' | 'confirm-replace' | 'failed', name: string): Promise<void> { if (outcome === 'created') { this.closeWizard(); this.replaceConfirmOpen.set(false); this.policyStore.clearReplacementConfirmation(); this.notificationService.success(`Leave policy '${name}' created successfully.`); return; } if (outcome === 'confirm-replace') { this.replaceConfirmOpen.set(true); return; } this.notificationService.error(this.policyStore.actionError() ?? 'Failed to save leave policy.'); }
  async confirmReplacement(): Promise<void> { const clone = this.cloneSource(); if (clone) { const payload = this.clonePayload(true); if (!payload) return; const outcome = await this.policyStore.clonePolicy(clone.id, payload); if (outcome === 'created') { this.closeClone(); this.replaceConfirmOpen.set(false); this.notificationService.success(`Leave policy '${payload.name}' cloned successfully.`); } else if (outcome === 'failed') this.notificationService.error(this.policyStore.actionError() ?? 'Failed to clone leave policy.'); return; } const draft = this.latestDraft(); if (!draft) return; const outcome = await this.policyStore.createPolicy(toCreateLeavePolicyRequest(draft, true)); await this.handleCreateOutcome(outcome, draft.name); }
  cancelReplacement(): void { this.replaceConfirmOpen.set(false); this.policyStore.clearReplacementConfirmation(); }
  openClone(policy: LeavePolicyListItemResponse): void { this.cloneSource.set(policy); this.cloneName.set(''); this.cloneEffectiveFrom.set(''); this.cloneLegalEntityIds.set([]); }
  closeClone(): void { this.cloneSource.set(null); }
  toggleCloneEntity(id: string, checked: boolean): void { this.cloneLegalEntityIds.update((ids) => checked ? [...ids, id] : ids.filter((current) => current !== id)); }
  private clonePayload(confirmReplaceExistingLegalEntityAssignments: boolean): CloneLeavePolicyRequest | null {
    const source = this.cloneSource();
    if (!this.cloneName().trim() || !this.cloneEffectiveFrom() || !this.cloneLegalEntityIds().length) {
      this.notificationService.error('Provide a name, effective date, and legal entity for the clone.');
      return null;
    }
    const country = (source?.country || this.generalSettingsStore.settings()?.countryCode || 'NA').trim().toUpperCase();
    return { name: this.cloneName().trim(), country, effectiveFrom: this.cloneEffectiveFrom(), legalEntityIds: [...this.cloneLegalEntityIds()], confirmReplaceExistingLegalEntityAssignments };
  }

  async submitClone(): Promise<void> { const source = this.cloneSource(); const payload = this.clonePayload(false); if (!source || !payload) return; const outcome = await this.policyStore.clonePolicy(source.id, payload); if (outcome === 'created') { this.closeClone(); this.notificationService.success(`Leave policy '${payload.name}' cloned successfully.`); } else if (outcome === 'confirm-replace') this.replaceConfirmOpen.set(true); else this.notificationService.error(this.policyStore.actionError() ?? 'Failed to clone leave policy.'); }
}
