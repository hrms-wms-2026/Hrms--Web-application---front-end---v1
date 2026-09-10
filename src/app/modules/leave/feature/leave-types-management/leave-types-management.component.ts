/** Quiet Operations Desk: an HR administration canvas centred on policy clarity. */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeaveTypeResponse, UpdateLeaveTypeRequest } from '../../models/leave-type.model';
import { LeaveTypeListTableComponent } from '../../ui/leave-type-list-table/leave-type-list-table.component';
import { LeaveTypeFormModalComponent, LeaveTypeFormValue } from '../../ui/leave-type-form-modal/leave-type-form-modal.component';

@Component({
  selector: 'app-leave-types-management',
  standalone: true,
  imports: [CommonModule, ButtonComponent, ErrorStateComponent, LeaveTypeListTableComponent, LeaveTypeFormModalComponent],
  templateUrl: './leave-types-management.component.html',
  styleUrl: './leave-types-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveTypesManagementComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  readonly store = inject(LeaveTypeStore);
  readonly hasManageAccess = computed(() => this.permissionService.hasPermission('leave:manage'));
  readonly typeSummary = computed(() => {
    const items = this.store.items();
    return {
      total: items.length,
      active: items.filter((item) => item.isActive).length,
      paid: items.filter((item) => item.isPaid).length
    };
  });
  readonly formModalOpen = signal(false);
  readonly editingType = signal<LeaveTypeResponse | null>(null);
  readonly pendingDeactivateType = signal<LeaveTypeResponse | null>(null);

  constructor() { void this.store.load(); }

  openCreateModal(): void {
    if (!this.hasManageAccess()) { this.notificationService.error("You don't have permission to create leave types."); return; }
    this.editingType.set(null);
    this.formModalOpen.set(true);
  }

  openEditModal(type: LeaveTypeResponse): void {
    if (!this.hasManageAccess()) { this.notificationService.error("You don't have permission to edit leave types."); return; }
    this.editingType.set(type);
    this.formModalOpen.set(true);
  }

  closeFormModal(): void { this.formModalOpen.set(false); this.editingType.set(null); }

  async onSave(value: LeaveTypeFormValue): Promise<void> {
    const editing = this.editingType();
    const success = editing ? await this.store.updateLeaveType(editing.id, this.toUpdateRequest(value)) : await this.store.createLeaveType(value);
    if (success) {
      this.notificationService.success(`Leave type '${value.name}' ${editing ? 'updated' : 'created'} successfully.`);
      this.closeFormModal();
    } else {
      this.notificationService.error(this.store.actionError() ?? 'Failed to save leave type.');
    }
  }

  async onDeactivateRequest(type: LeaveTypeResponse): Promise<void> {
    if (!this.hasManageAccess()) { this.notificationService.error("You don't have permission to deactivate leave types."); return; }
    const outcome = await this.store.deactivateLeaveType(type.id, false);
    if (outcome === 'success') this.notificationService.success(`Leave type '${type.name}' deactivated.`);
    else if (outcome === 'confirm') this.pendingDeactivateType.set(type);
    else this.notificationService.error(this.store.actionError() ?? 'Failed to deactivate leave type.');
  }

  async onConfirmDeactivate(): Promise<void> {
    const type = this.pendingDeactivateType();
    if (!type) return;
    const outcome = await this.store.deactivateLeaveType(type.id, true);
    this.pendingDeactivateType.set(null);
    if (outcome === 'success') this.notificationService.success(`Leave type '${type.name}' deactivated. Pending requests were cancelled.`);
    else this.notificationService.error(this.store.actionError() ?? 'Failed to deactivate leave type.');
  }

  cancelDeactivate(): void { this.pendingDeactivateType.set(null); }

  private toUpdateRequest(value: LeaveTypeFormValue): UpdateLeaveTypeRequest {
    const { code: _code, ...update } = value;
    return update;
  }
}
