import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LegalEntityStore } from '../../state/legal-entity.store';
import { DepartmentStore } from '../../state/department.store';
import { DepartmentListItemResponse, DepartmentTreeNodeResponse } from '../../models/department.model';
import { DepartmentTreeNodeComponent } from '../../ui/department-tree-node/department-tree-node.component';
import { DepartmentListTableComponent } from '../../ui/department-list-table/department-list-table.component';
import { DepartmentFormModalComponent, DepartmentFormValue } from '../../ui/department-form-modal/department-form-modal.component';
import { DepartmentArchiveModalComponent } from '../../ui/department-archive-modal/department-archive-modal.component';

@Component({
  selector: 'app-department-management',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
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

  readonly legalEntityStore = inject(LegalEntityStore);
  readonly departmentStore = inject(DepartmentStore);

  readonly hasReadAccess = computed(() => this.permissionService.hasPermission('org:read'));
  readonly hasManageAccess = computed(() => this.permissionService.hasPermission('org:manage'));
  readonly selectedLegalEntity = this.legalEntityStore.selectedLegalEntity;

  // Modal signals
  readonly formModalOpen = signal(false);
  readonly editingDepartment = signal<DepartmentListItemResponse | DepartmentTreeNodeResponse | null>(null);
  readonly parentPreset = signal<DepartmentTreeNodeResponse | null>(null);

  readonly archiveModalOpen = signal(false);
  readonly archivingDepartment = signal<DepartmentListItemResponse | DepartmentTreeNodeResponse | null>(null);
  readonly filterMenuOpen = signal(false);

  onFilterToggle(): void {
    this.filterMenuOpen.update((v) => !v);
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

  onViewModeToggle(mode: 'tree' | 'list'): void {
    this.departmentStore.setViewMode(mode);
  }

  onIncludeInactiveToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.departmentStore.setIncludeInactive(checked);
  }

  openCreateModal(parentPreset?: DepartmentTreeNodeResponse): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to create departments.");
      return;
    }
    this.editingDepartment.set(null);
    this.parentPreset.set(parentPreset || null);
    this.formModalOpen.set(true);
  }

  openEditModal(dept: DepartmentListItemResponse | DepartmentTreeNodeResponse): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to edit departments.");
      return;
    }
    this.editingDepartment.set(dept);
    this.parentPreset.set(null);
    this.formModalOpen.set(true);
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
        parentDepartmentId: val.parentDepartmentId
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
