import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LegalEntityStore } from '../../state/legal-entity.store';
import { DepartmentStore } from '../../state/department.store';
import { DepartmentListItemResponse, DepartmentTreeNodeResponse } from '../../models/department.model';
import { PositionListItemResponse } from '../../models/position.model';
import { PositionApiService } from '../../data-access/position-api.service';
import { DepartmentTreeNodeComponent } from '../../ui/department-tree-node/department-tree-node.component';
import { DepartmentListTableComponent } from '../../ui/department-list-table/department-list-table.component';
import { DepartmentFormModalComponent, DepartmentFormValue, HeadPositionOption } from '../../ui/department-form-modal/department-form-modal.component';
import { DepartmentArchiveModalComponent } from '../../ui/department-archive-modal/department-archive-modal.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { FilterBarComponent, FilterFieldConfig } from '../../../../shared/ui/filter-bar/filter-bar.component';
import { ViewModeOption, ViewModeToggleComponent } from '../../../../shared/ui/view-mode-toggle/view-mode-toggle.component';

@Component({
  selector: 'app-department-management',
  standalone: true,
  imports: [
    CommonModule,
    BreadcrumbHeaderComponent,
    ButtonComponent,
    FilterBarComponent,
    ViewModeToggleComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    DepartmentTreeNodeComponent,
    DepartmentListTableComponent,
    DepartmentFormModalComponent,
    DepartmentArchiveModalComponent
  ],
  templateUrl: './department-management.component.html',
  styleUrl: './department-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentManagementComponent {
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);
  private readonly positionApi = inject(PositionApiService);

  readonly legalEntityStore = inject(LegalEntityStore);
  readonly departmentStore = inject(DepartmentStore);

  readonly hasReadAccess = computed(() => this.permissionService.hasPermission('org:read'));
  readonly hasManageAccess = computed(() => this.permissionService.hasPermission('org:manage'));
  readonly selectedLegalEntity = this.legalEntityStore.selectedLegalEntity;

  // Modal signals
  readonly formModalOpen = signal(false);
  readonly editingDepartment = signal<DepartmentListItemResponse | DepartmentTreeNodeResponse | null>(null);
  readonly parentPreset = signal<DepartmentTreeNodeResponse | null>(null);
  private readonly companyPositions = signal<readonly PositionListItemResponse[]>([]);

  /**
   * Head candidates: active single-occupancy positions. Edit offers the department's own
   * positions (the backend requires the head to belong to it); create offers any position not
   * already heading another department, which then moves into the new department.
   */
  readonly headPositionOptions = computed<readonly HeadPositionOption[]>(() => {
    const editing = this.editingDepartment();
    const takenHeads = new Set(
      this.departmentStore.allFlatList()
        .filter((d) => d.id !== editing?.id && d.headPositionId)
        .map((d) => d.headPositionId as string)
    );
    return this.companyPositions()
      .filter((p) => p.isActive && p.positionType.toLowerCase() === 'unique')
      .filter((p) => (editing ? p.departmentId === editing.id : !takenHeads.has(p.id)))
      .map((p) => ({ id: p.id, title: p.name, departmentName: p.departmentName ?? null }));
  });

  /** Phone summary card. Each department's counts are its own (the API groups by department id), so they add up. */
  readonly companyTotals = computed(() => {
    const active = this.departmentStore.allFlatList().filter((d) => d.isActive);
    return {
      employees: active.reduce((sum, d) => sum + (d.employeeCount ?? 0), 0),
      positions: active.reduce((sum, d) => sum + (d.positionCount ?? 0), 0),
      departments: active.length
    };
  });

  readonly archiveModalOpen = signal(false);
  readonly archivingDepartment = signal<DepartmentListItemResponse | DepartmentTreeNodeResponse | null>(null);
  readonly searchExpanded = signal(false);

  readonly viewModes: readonly ViewModeOption[] = [
    { value: 'tree', label: 'Tree', icon: 'tree' },
    { value: 'list', label: 'List', icon: 'list' }
  ];

  readonly filterFields: readonly FilterFieldConfig[] = [
    {
      key: 'status',
      label: 'Status',
      icon: 'status',
      kind: 'single',
      options: [
        { value: 'active', label: 'Active only' },
        { value: 'all', label: 'Include archived' }
      ],
      defaultValues: ['active']
    }
  ];

  readonly filterValues = computed<Record<string, string[]>>(() => ({
    status: [this.departmentStore.includeInactive() ? 'all' : 'active']
  }));

  toggleSearch(): void {
    this.searchExpanded.update((v) => !v);
    if (!this.searchExpanded()) {
      this.departmentStore.setSearch('');
    }
  }

  constructor() {
    effect(() => {
      const le = this.selectedLegalEntity();
      if (le && this.hasReadAccess()) {
        this.departmentStore.load(le.id);
      }
    });
  }

  onSearchChange(query: string): void {
    this.departmentStore.setSearch(query);
  }

  onViewModeToggle(mode: string): void {
    this.departmentStore.setViewMode(mode === 'list' ? 'list' : 'tree');
  }

  onFilterFieldChanged(event: { key: string; values: string[] }): void {
    if (event.key === 'status') {
      this.departmentStore.setIncludeInactive(event.values[0] === 'all');
    }
  }

  openCreateModal(parentPreset?: DepartmentTreeNodeResponse): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to create departments.");
      return;
    }
    this.editingDepartment.set(null);
    this.parentPreset.set(parentPreset || null);
    this.formModalOpen.set(true);
    void this.loadCompanyPositions();
  }

  openEditModal(dept: DepartmentListItemResponse | DepartmentTreeNodeResponse): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to edit departments.");
      return;
    }
    this.editingDepartment.set(dept);
    this.parentPreset.set(null);
    this.formModalOpen.set(true);
    void this.loadCompanyPositions();
  }

  private async loadCompanyPositions(): Promise<void> {
    const le = this.selectedLegalEntity();
    if (!le) return;
    try {
      const page = await firstValueFrom(this.positionApi.listFlat(le.id, { pageSize: 100 }));
      this.companyPositions.set(page.items);
    } catch {
      this.companyPositions.set([]);
    }
  }

  closeFormModal(): void {
    this.formModalOpen.set(false);
    this.editingDepartment.set(null);
    this.parentPreset.set(null);
  }

  async onSaveDepartment(val: DepartmentFormValue): Promise<void> {
    const le = this.selectedLegalEntity();
    if (!le) return;

    const editing = this.editingDepartment();
    let success = false;

    if (editing) {
      success = await this.departmentStore.updateDepartment(le.id, editing.id, {
        name: val.name,
        code: val.code,
        parentDepartmentId: val.parentDepartmentId,
        headPositionId: val.headPositionId
      });
      if (success) {
        this.notificationService.success(`Department '${val.name}' updated successfully.`);
      }
    } else {
      success = await this.departmentStore.createDepartment(le.id, {
        name: val.name,
        code: val.code,
        parentDepartmentId: val.parentDepartmentId,
        headPositionId: val.headPositionId
      });
      if (success) {
        this.notificationService.success(`Department '${val.name}' created successfully.`);
      }
    }

    if (success) {
      this.closeFormModal();
    } else {
      this.notificationService.error(this.departmentStore.actionError() ?? 'Failed to save department.');
    }
  }

  async openArchiveModal(dept: DepartmentListItemResponse | DepartmentTreeNodeResponse): Promise<void> {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to archive departments.");
      return;
    }
    const le = this.selectedLegalEntity();
    if (!le) return;

    this.archivingDepartment.set(dept);
    this.archiveModalOpen.set(true);
    await this.departmentStore.checkArchive(le.id, dept.id);
  }

  closeArchiveModal(): void {
    this.archiveModalOpen.set(false);
    this.archivingDepartment.set(null);
  }

  async onConfirmArchive(): Promise<void> {
    const le = this.selectedLegalEntity();
    const dept = this.archivingDepartment();
    if (!le || !dept) return;

    const success = await this.departmentStore.archiveDepartment(le.id, dept.id);
    if (success) {
      this.notificationService.success(`Department '${dept.name}' archived successfully.`);
      this.closeArchiveModal();
    } else {
      this.notificationService.error(this.departmentStore.actionError() ?? 'Failed to archive department.');
    }
  }

  async onRestoreDepartment(dept: DepartmentListItemResponse): Promise<void> {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to restore departments.");
      return;
    }
    const le = this.selectedLegalEntity();
    if (!le) return;

    const success = await this.departmentStore.restoreDepartment(le.id, dept.id);
    if (success) {
      this.notificationService.success(`Department '${dept.name}' restored successfully.`);
    } else {
      this.notificationService.error(this.departmentStore.actionError() ?? 'Failed to restore department.');
    }
  }
}
