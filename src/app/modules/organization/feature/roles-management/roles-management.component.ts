import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { RoleStore } from '../../state/role.store';
import { RoleDetailResponse, RoleSummaryResponse } from '../../models/role.model';
import { RoleListTableComponent } from '../../ui/role-list-table/role-list-table.component';
import { RoleFormModalComponent, RoleFormSubmitValue } from '../../ui/role-form-modal/role-form-modal.component';
import { RolePermissionsModalComponent } from '../../ui/role-permissions-modal/role-permissions-modal.component';
import { RoleArchiveModalComponent } from '../../ui/role-archive-modal/role-archive-modal.component';

import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';

@Component({
  selector: 'app-roles-management',
  standalone: true,
  imports: [
    CommonModule,
    BreadcrumbHeaderComponent,
    ButtonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    RoleListTableComponent,
    RoleFormModalComponent,
    RolePermissionsModalComponent,
    RoleArchiveModalComponent
  ],
  templateUrl: './roles-management.component.html',
  styleUrl: './roles-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RolesManagementComponent {
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);

  readonly roleStore = inject(RoleStore);

  readonly hasReadAccess = computed(() => this.permissionService.hasPermission('roles:read'));
  readonly hasManageAccess = computed(() => this.permissionService.hasPermission('roles:manage'));

  readonly searchQuery = signal('');
  readonly searchExpanded = signal(false);

  toggleSearch(): void {
    this.searchExpanded.update((v) => !v);
    if (!this.searchExpanded()) {
      this.searchQuery.set('');
    }
  }

  // Modals
  readonly formModalOpen = signal(false);
  readonly editingRole = signal<RoleSummaryResponse | RoleDetailResponse | null>(null);

  readonly permsModalOpen = signal(false);
  readonly managingPermsRole = signal<RoleSummaryResponse | null>(null);

  readonly archiveModalOpen = signal(false);
  readonly archivingRole = signal<RoleSummaryResponse | null>(null);

  readonly filteredRoles = computed(() => {
    const list = this.roleStore.roles();
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (r) => r.name.toLowerCase().includes(query) || (r.description && r.description.toLowerCase().includes(query))
    );
  });

  constructor() {
    if (this.hasReadAccess()) {
      this.roleStore.loadAll();
    }
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
  }

  openCreateModal(): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to create roles.");
      return;
    }
    this.editingRole.set(null);
    this.formModalOpen.set(true);
  }

  openEditModal(role: RoleSummaryResponse): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to edit roles.");
      return;
    }
    if (role.isSystem) {
      this.notificationService.error('System roles cannot be edited.');
      return;
    }
    this.editingRole.set(role);
    this.formModalOpen.set(true);
  }

  closeFormModal(): void {
    this.formModalOpen.set(false);
    this.editingRole.set(null);
  }

  async onSaveRole(val: RoleFormSubmitValue): Promise<void> {
    const editing = this.editingRole();
    let success = false;

    if (editing) {
      success = await this.roleStore.updateRole(editing.id, {
        name: val.name,
        description: val.description
      });
      if (success && val.selectedPermissionIds.length > 0) {
        await this.roleStore.assignPermissions(editing.id, { permissionIds: val.selectedPermissionIds });
      }
      if (success) {
        this.notificationService.success(`Role '${val.name}' updated successfully.`);
      }
    } else {
      success = await this.roleStore.createRole({
        name: val.name,
        description: val.description,
        permissionIds: val.selectedPermissionIds
      });
      if (success) {
        this.notificationService.success(`Role '${val.name}' created successfully.`);
      }
    }

    if (success) {
      this.closeFormModal();
    } else {
      this.notificationService.error(this.roleStore.actionError() ?? 'Failed to save role.');
    }
  }

  async openPermissionsModal(role: RoleSummaryResponse): Promise<void> {
    this.managingPermsRole.set(role);
    this.permsModalOpen.set(true);
    await this.roleStore.loadRoleDetail(role.id);
  }

  closePermissionsModal(): void {
    this.permsModalOpen.set(false);
    this.managingPermsRole.set(null);
  }

  async onSavePermissions(permissionIds: string[]): Promise<void> {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to manage role permissions.");
      return;
    }
    const role = this.managingPermsRole();
    if (!role) return;

    if (role.isSystem) {
      this.notificationService.error('System role permissions cannot be modified.');
      return;
    }

    const success = await this.roleStore.assignPermissions(role.id, { permissionIds });
    if (success) {
      this.notificationService.success(`Permissions for role '${role.name}' updated successfully.`);
      this.closePermissionsModal();
    } else {
      this.notificationService.error(this.roleStore.actionError() ?? 'Failed to update role permissions.');
    }
  }

  openArchiveModal(role: RoleSummaryResponse): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to archive roles.");
      return;
    }
    if (role.isSystem) {
      this.notificationService.error('System roles cannot be archived.');
      return;
    }
    this.archivingRole.set(role);
    this.archiveModalOpen.set(true);
  }

  closeArchiveModal(): void {
    this.archiveModalOpen.set(false);
    this.archivingRole.set(null);
  }

  async onConfirmArchive(): Promise<void> {
    const role = this.archivingRole();
    if (!role) return;

    const success = await this.roleStore.archiveRole(role.id);
    if (success) {
      this.notificationService.success(`Role '${role.name}' archived successfully.`);
      this.closeArchiveModal();
    } else {
      this.notificationService.error(this.roleStore.actionError() ?? 'Failed to archive role.');
    }
  }
}
