/** Leave policies: one policy per leave type, assigned to the company, departments and positions;
 * edits are saved as dated versions. */
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { KpiTile, KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectOption } from '../../../../shared/ui/select/select.component';
import { LegalEntityApiService } from '../../../organization/data-access/legal-entity-api.service';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeavePolicyStore } from '../../state/leave-policy.store';
import { CreateLeavePolicyRequest, LeavePolicyListItem } from '../../models/leave-policy.model';
import { LeavePolicyListTableComponent } from '../../ui/leave-policy-list-table/leave-policy-list-table.component';
import { LeavePolicyDetailPanelComponent } from '../../ui/leave-policy-detail-panel/leave-policy-detail-panel.component';
import {
  LeavePolicyFormWizardComponent,
  LeavePolicyWizardEdit,
  LeavePolicyWizardEntity
} from '../../ui/leave-policy-form-wizard/leave-policy-form-wizard.component';

/** The org list endpoints accept at most 100 per page. */
const PAGE_SIZE = 100;

async function loadAll<T>(page: (n: number) => Promise<{ readonly items: readonly T[] }>): Promise<T[]> {
  const all: T[] = [];
  for (let n = 1; ; n++) {
    const { items } = await page(n);
    all.push(...items);
    if (items.length < PAGE_SIZE) return all;
  }
}

@Component({ selector: 'app-policy-management', standalone: true, imports: [CommonModule, BreadcrumbHeaderComponent, LoaderComponent, KpiTilesComponent, ButtonComponent, EmptyStateComponent, ErrorStateComponent, InputComponent, ModalComponent, LeavePolicyListTableComponent, LeavePolicyDetailPanelComponent, LeavePolicyFormWizardComponent], templateUrl: './policy-management.component.html', styleUrls: ['../../ui/time-off-chrome.css', './policy-management.component.css'], changeDetection: ChangeDetectionStrategy.OnPush })
export class PolicyManagementComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);
  private readonly legalEntityApi = inject(LegalEntityApiService);
  private readonly departmentApi = inject(DepartmentApiService);
  private readonly positionApi = inject(PositionApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly policyStore = inject(LeavePolicyStore);
  readonly leaveTypeStore = inject(LeaveTypeStore);

  readonly hasManageAccess = computed(() => this.permissionService.hasPermission('leave:manage'));
  readonly legalEntities = signal<readonly LeavePolicyWizardEntity[]>([]);
  readonly departmentOptions = signal<readonly SelectOption[]>([]);
  readonly positionOptions = signal<readonly SelectOption[]>([]);
  readonly wizardMode = signal<'create' | 'edit' | null>(null);
  readonly detailOpen = signal(false);
  readonly cloneSource = signal<LeavePolicyListItem | null>(null);
  readonly cloneName = signal('');
  /** Set from ?type= (a leave type card's View / Add policy); null lists every policy. */
  readonly leaveTypeFilter = signal<string | null>(null);
  readonly visiblePolicies = computed(() => {
    const type = this.leaveTypeFilter();
    const items = this.policyStore.items();
    return type ? items.filter((p) => p.leaveTypeId === type) : items;
  });
  readonly leaveTypeFilterName = computed(() => {
    const type = this.leaveTypeFilter();
    if (!type) return '';
    return this.leaveTypeStore.items().find((t) => t.id === type)?.name
      ?? this.policyStore.items().find((p) => p.leaveTypeId === type)?.leaveTypeName
      ?? 'this leave type';
  });
  /** The policy the user clicked; the panel and Edit only use the loaded policy once it is this one. */
  private readonly viewingId = signal<string | null>(null);
  readonly viewedPolicy = computed(() => {
    const selected = this.policyStore.selectedPolicy();
    return selected && selected.id === this.viewingId() ? selected : null;
  });

  readonly policyKpiTiles = computed<readonly KpiTile[]>(() => {
    const items = this.visiblePolicies();
    return [
      { label: 'Policies', value: items.length, icon: 'clipboard-list' },
      { label: 'Active', value: items.filter((p) => p.isActive).length, icon: 'check-circle', tone: 'success' },
      { label: 'Not assigned', value: items.filter((p) => p.isActive && p.assignmentCount === 0).length, icon: 'layers' }
    ];
  });

  ngOnInit(): void {
    if (!this.hasManageAccess()) return;
    const params = this.route.snapshot.queryParamMap;
    this.leaveTypeFilter.set(params.get('type'));
    if (params.has('new')) {
      this.openCreate();
      // Drop ?new so a reload or Back does not open the wizard again.
      void this.router.navigate([], { relativeTo: this.route, queryParams: { new: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    void this.loadInitialData();
  }

  clearLeaveTypeFilter(): void {
    this.leaveTypeFilter.set(null);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { type: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  async loadInitialData(): Promise<void> {
    await Promise.all([this.policyStore.loadPolicies(), this.leaveTypeStore.load(), this.loadOrg()]);
  }

  private async loadOrg(): Promise<void> {
    try {
      const entities = await firstValueFrom(this.legalEntityApi.getLegalEntities(false));
      this.legalEntities.set(entities.map((e) => ({ id: e.id, name: e.name })));
      const several = entities.length > 1;
      const perEntity = await Promise.all(entities.map(async (e) => {
        const [departments, positions] = await Promise.all([
          loadAll((page) => firstValueFrom(this.departmentApi.listFlat(e.id, { page, pageSize: PAGE_SIZE }))),
          loadAll((page) => firstValueFrom(this.positionApi.listFlat(e.id, { page, pageSize: PAGE_SIZE })))
        ]);
        const suffix = several ? ` · ${e.name}` : '';
        return {
          departments: departments.map((d) => ({ value: d.id, label: `${d.name}${suffix}` })),
          positions: positions.map((p) => ({ value: p.id, label: `${p.name}${suffix}` }))
        };
      }));
      this.departmentOptions.set(perEntity.flatMap((x) => x.departments));
      this.positionOptions.set(perEntity.flatMap((x) => x.positions));
    } catch {
      this.notificationService.error('Failed to load companies, departments and positions.');
    }
  }

  openCreate(): void { this.policyStore.clearConflicts(); this.wizardMode.set('create'); }
  openEdit(): void {
    if (!this.viewedPolicy()) return;
    this.policyStore.clearConflicts();
    this.wizardMode.set('edit');
  }
  closeWizard(): void { this.wizardMode.set(null); this.policyStore.clearConflicts(); }

  async viewPolicy(policy: LeavePolicyListItem): Promise<void> {
    this.detailOpen.set(true);
    this.viewingId.set(policy.id);
    await this.policyStore.loadPolicy(policy.id);
  }
  closeDetail(): void { this.detailOpen.set(false); }

  async onCreate(request: CreateLeavePolicyRequest): Promise<void> {
    const outcome = await this.policyStore.create(request);
    if (outcome === 'saved') {
      this.closeWizard();
      this.notificationService.success(`Leave policy '${request.name}' created.`);
    } else if (outcome === 'failed') {
      this.notificationService.error(this.policyStore.actionError() ?? 'Failed to create leave policy.');
    }
  }

  async onSaveEdit(change: LeavePolicyWizardEdit): Promise<void> {
    const { details, version, assignments } = change.edit;
    if (!details && !version && !assignments) { this.closeWizard(); return; }
    const outcome = await this.policyStore.saveEdit(change.policyId, change.edit);
    if (outcome === 'saved') {
      this.closeWizard();
      this.notificationService.success('Leave policy saved.');
    } else if (outcome === 'failed') {
      this.notificationService.error(this.policyStore.actionError() ?? 'Failed to save leave policy.');
    }
  }

  async onDeleteVersion(versionId: string): Promise<void> {
    const policy = this.viewedPolicy();
    if (!policy) return;
    const outcome = await this.policyStore.deleteVersion(policy.id, versionId);
    if (outcome === 'saved') this.notificationService.success('Scheduled change cancelled.');
    else this.notificationService.error(this.policyStore.actionError() ?? 'Failed to cancel the scheduled change.');
  }

  async onSetActive(isActive: boolean): Promise<void> {
    const policy = this.viewedPolicy();
    if (!policy) return;
    const outcome = await this.policyStore.setActive(policy.id, isActive);
    if (outcome === 'saved') {
      await this.policyStore.loadPolicy(policy.id);
      this.notificationService.success(isActive ? 'Policy turned on.' : 'Policy turned off.');
    } else {
      this.notificationService.error(this.policyStore.actionError() ?? 'Failed to update the policy.');
    }
  }

  openClone(policy: LeavePolicyListItem): void { this.cloneSource.set(policy); this.cloneName.set(`${policy.name} (copy)`); }
  closeClone(): void { this.cloneSource.set(null); }

  async submitClone(): Promise<void> {
    const source = this.cloneSource();
    const name = this.cloneName().trim();
    if (!source || !name) return;
    const outcome = await this.policyStore.clone(source.id, name);
    if (outcome === 'saved') {
      this.closeClone();
      this.notificationService.success(`Copied as '${name}'. Assign it before anyone gets it.`);
    } else {
      this.notificationService.error(this.policyStore.actionError() ?? 'Failed to copy the policy.');
    }
  }
}
