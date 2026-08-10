import { ChangeDetectionStrategy, Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { LegalEntityStore } from '../../state/legal-entity.store';
import { PositionStore } from '../../state/position.store';
import { DepartmentStore } from '../../state/department.store';
import { AddCoverageRecordRequest, PositionListItemResponse, PositionTreeNodeResponse } from '../../models/position.model';
import { PositionTreeNodeComponent, ReparentPositionEvent } from '../../ui/position-tree-node/position-tree-node.component';
import { PositionListTableComponent } from '../../ui/position-list-table/position-list-table.component';
import { PositionFormModalComponent, PositionFormSubmitValue } from '../../ui/position-form-modal/position-form-modal.component';
import { PositionArchiveModalComponent } from '../../ui/position-archive-modal/position-archive-modal.component';
import { PositionCoverageModalComponent, UpdateCoverageEvent } from '../../ui/position-coverage-modal/position-coverage-modal.component';

@Component({
  selector: 'app-position-management',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    SelectComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    PositionTreeNodeComponent,
    PositionListTableComponent,
    PositionFormModalComponent,
    PositionArchiveModalComponent,
    PositionCoverageModalComponent
  ],
  templateUrl: './position-management.component.html',
  styleUrl: './position-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionManagementComponent {
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);

  readonly legalEntityStore = inject(LegalEntityStore);
  readonly positionStore = inject(PositionStore);
  readonly departmentStore = inject(DepartmentStore);

  readonly hasReadAccess = computed(() => this.permissionService.hasPermission('org:read'));
  readonly hasManageAccess = computed(() => this.permissionService.hasPermission('org:manage'));
  readonly selectedLegalEntity = this.legalEntityStore.selectedLegalEntity;

  readonly filterMenuOpen = signal(false);

  // Modals
  readonly formModalOpen = signal(false);
  readonly editingPosition = signal<PositionListItemResponse | PositionTreeNodeResponse | null>(null);
  readonly reportsToPreset = signal<PositionTreeNodeResponse | null>(null);

  readonly archiveModalOpen = signal(false);
  readonly archivingPosition = signal<PositionListItemResponse | PositionTreeNodeResponse | null>(null);

  readonly coverageModalOpen = signal(false);

  readonly departmentOptions = computed(() => {
    const list = this.departmentStore.allFlatList();
    const opts: { value: string; label: string }[] = [
      { value: '', label: 'All departments' }
    ];
    for (const d of list) {
      opts.push({ value: d.id, label: d.name });
    }
    return opts;
  });

  readonly departmentNameMap = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const d of this.departmentStore.allFlatList()) {
      map[d.id] = d.name;
    }
    return map;
  });

  readonly positionNameMap = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of this.positionStore.allPositionsList()) {
      map[p.id] = p.name;
    }
    return map;
  });

  constructor() {
    effect(() => {
      const le = this.selectedLegalEntity();
      if (le && this.hasReadAccess()) {
        this.positionStore.load(le.id);
        this.departmentStore.load(le.id);
      }
    });
  }

  onDepartmentFilterChange(deptId: string): void {
    this.positionStore.setDepartmentFilter(deptId ? deptId : null);
  }

  onSearchChange(query: string): void {
    this.positionStore.setSearch(query);
  }

  onViewModeToggle(mode: 'tree' | 'list'): void {
    this.positionStore.setViewMode(mode);
  }

  onFilterToggle(event?: Event): void {
    if (event) event.stopPropagation();
    this.filterMenuOpen.update((v) => !v);
  }

  onIncludeInactiveToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.positionStore.setIncludeInactive(checked);
  }

  openCreateModal(reportsToPreset?: PositionTreeNodeResponse): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to create positions.");
      return;
    }
    this.editingPosition.set(null);
    this.reportsToPreset.set(reportsToPreset || null);
    this.formModalOpen.set(true);
  }

  openEditModal(pos: PositionListItemResponse | PositionTreeNodeResponse): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to edit positions.");
      return;
    }
    this.editingPosition.set(pos);
    this.reportsToPreset.set(null);
    this.formModalOpen.set(true);
  }

  closeFormModal(): void {
    this.formModalOpen.set(false);
    this.editingPosition.set(null);
    this.reportsToPreset.set(null);
  }

  async onSavePosition(val: PositionFormSubmitValue): Promise<void> {
    const le = this.selectedLegalEntity();
    if (!le) return;

    const editing = this.editingPosition();
    let success = false;

    if (editing) {
      success = await this.positionStore.updatePosition(le.id, editing.id, {
        departmentId: val.departmentId,
        name: val.name,
        code: val.code,
        positionType: val.positionType,
        maxOccupancy: val.maxOccupancy,
        reportsToPositionId: val.reportsToPositionId
      });
      if (success) {
        this.notificationService.success(`Position '${val.name}' updated successfully.`);
      }
    } else {
      success = await this.positionStore.createPosition(le.id, {
        departmentId: val.departmentId,
        name: val.name,
        code: val.code,
        positionType: val.positionType,
        maxOccupancy: val.maxOccupancy,
        reportsToPositionId: val.reportsToPositionId
      });
      if (success) {
        this.notificationService.success(`Position '${val.name}' created successfully.`);
      }
    }

    if (success) {
      this.closeFormModal();
    } else {
      this.notificationService.error(this.positionStore.actionError() ?? 'Failed to save position.');
    }
  }

  async onReparentPosition(event: ReparentPositionEvent): Promise<void> {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to move positions.");
      return;
    }
    const le = this.selectedLegalEntity();
    if (!le) return;

    // Find full position details from store
    const fullPos = this.positionStore.allPositionsList().find((p) => p.id === event.position.id);
    if (!fullPos) return;

    const typeNorm: 'unique' | 'pooled' = (fullPos.positionType || '').toLowerCase() === 'pooled' ? 'pooled' : 'unique';

    const success = await this.positionStore.updatePosition(le.id, fullPos.id, {
      departmentId: fullPos.departmentId || '',
      name: fullPos.name,
      code: fullPos.code || '',
      positionType: typeNorm,
      maxOccupancy: fullPos.maxOccupancy,
      reportsToPositionId: event.newReportsToPositionId
    });

    if (success) {
      const parentName = this.positionNameMap()[event.newReportsToPositionId || ''] || 'Root Position';
      this.notificationService.success(`Reporting line for '${fullPos.name}' updated to '${parentName}'.`);
    } else {
      this.notificationService.error(this.positionStore.actionError() ?? 'Failed to move position.');
    }
  }

  async openArchiveModal(pos: PositionListItemResponse | PositionTreeNodeResponse): Promise<void> {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to archive positions.");
      return;
    }
    const le = this.selectedLegalEntity();
    if (!le) return;

    this.archivingPosition.set(pos);
    this.archiveModalOpen.set(true);
    await this.positionStore.checkArchive(le.id, pos.id);
  }

  closeArchiveModal(): void {
    this.archiveModalOpen.set(false);
    this.archivingPosition.set(null);
  }

  async onConfirmArchive(): Promise<void> {
    const le = this.selectedLegalEntity();
    const pos = this.archivingPosition();
    if (!le || !pos) return;

    const success = await this.positionStore.archivePosition(le.id, pos.id);
    if (success) {
      this.notificationService.success(`Position '${pos.name}' archived successfully.`);
      this.closeArchiveModal();
    } else {
      this.notificationService.error(this.positionStore.actionError() ?? 'Failed to archive position.');
    }
  }

  async onRestorePosition(pos: PositionListItemResponse): Promise<void> {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to restore positions.");
      return;
    }
    const le = this.selectedLegalEntity();
    if (!le) return;

    const success = await this.positionStore.restorePosition(le.id, pos.id);
    if (success) {
      this.notificationService.success(`Position '${pos.name}' restored successfully.`);
    } else {
      this.notificationService.error(this.positionStore.actionError() ?? 'Failed to restore position.');
    }
  }

  async openCoverageModal(pos: PositionListItemResponse | PositionTreeNodeResponse): Promise<void> {
    const le = this.selectedLegalEntity();
    if (!le) return;

    this.coverageModalOpen.set(true);
    await this.positionStore.loadCoverage(le.id, pos);
  }

  closeCoverageModal(): void {
    this.coverageModalOpen.set(false);
    this.positionStore.clearCoverage();
  }

  async onAddCoverage(req: AddCoverageRecordRequest): Promise<void> {
    const le = this.selectedLegalEntity();
    const pos = this.positionStore.selectedCoveragePosition();
    if (!le || !pos) return;

    const success = await this.positionStore.addCoverage(le.id, pos.id, req);
    if (success) {
      this.notificationService.success('Management coverage rule added successfully.');
    } else {
      this.notificationService.error(this.positionStore.coverageError() ?? 'Failed to add management coverage rule.');
    }
  }

  async onUpdateCoverage(event: UpdateCoverageEvent): Promise<void> {
    const le = this.selectedLegalEntity();
    const pos = this.positionStore.selectedCoveragePosition();
    if (!le || !pos) return;

    const success = await this.positionStore.updateCoverage(le.id, pos.id, event.coverageId, event.payload);
    if (success) {
      this.notificationService.success('Management coverage level updated successfully.');
    } else {
      this.notificationService.error(this.positionStore.coverageError() ?? 'Failed to update management coverage level.');
    }
  }

  async onRemoveCoverage(coverageId: string): Promise<void> {
    const le = this.selectedLegalEntity();
    const pos = this.positionStore.selectedCoveragePosition();
    if (!le || !pos) return;

    const success = await this.positionStore.removeCoverage(le.id, pos.id, coverageId);
    if (success) {
      this.notificationService.success('Management coverage rule removed successfully.');
    } else {
      this.notificationService.error(this.positionStore.coverageError() ?? 'Failed to remove management coverage rule.');
    }
  }
}
