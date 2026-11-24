/** Quiet Operations Desk: an HR administration canvas centred on policy clarity. */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { KpiTile, KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeaveTypeResponse, UpdateLeaveTypeRequest } from '../../models/leave-type.model';
import { LeaveTypeListTableComponent } from '../../ui/leave-type-list-table/leave-type-list-table.component';
import { LeaveTypeFormModalComponent, LeaveTypeFormValue } from '../../ui/leave-type-form-modal/leave-type-form-modal.component';

import { TimeOffSettingsTabsComponent } from '../../ui/time-off-settings-tabs/time-off-settings-tabs.component';
import { failedSaveToast } from '../../../../shared/utils/validators';
@Component({
  selector: 'app-leave-types-management',
  standalone: true,
  imports: [CommonModule, TimeOffSettingsTabsComponent, BreadcrumbHeaderComponent, LoaderComponent, KpiTilesComponent, ButtonComponent, EmptyStateComponent, ErrorStateComponent, ModalComponent, LeaveTypeListTableComponent, LeaveTypeFormModalComponent],
  templateUrl: './leave-types-management.component.html',
  styleUrls: ['../../ui/time-off-chrome.css', './leave-types-management.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveTypesManagementComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
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
  readonly typeKpiTiles = computed<readonly KpiTile[]>(() => {
    const s = this.typeSummary();
    return [
      { label: 'Types', value: s.total, icon: 'layers' },
      { label: 'Active', value: s.active, icon: 'check-circle', tone: 'success' },
      { label: 'Paid', value: s.paid, icon: 'clipboard-list' }
    ];
  });
  readonly formModalOpen = signal(false);
  readonly editingType = signal<LeaveTypeResponse | null>(null);
  readonly pendingDeactivateType = signal<LeaveTypeResponse | null>(null);

  constructor() {
    void this.store.load();
    // ?new=1 (the hub's "Create Leave Type" shortcut) opens the create form; drop it so Back or reload don't reopen it.
    if (this.route.snapshot.queryParamMap.has('new') && this.hasManageAccess()) {
      this.openCreateModal();
      void this.router.navigate([], { relativeTo: this.route, queryParams: { new: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

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
      const toast = failedSaveToast(this.store.actionApiError(), 'Failed to save leave type.');
      if (toast) this.notificationService.error(toast);
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

  /** Leave Policies, filtered to this type. */
  viewPolicies(type: LeaveTypeResponse): void { void this.router.navigate(['/settings/time-off/policies'], { queryParams: { type: type.id } }); }
  /** Leave Policies, filtered to this type, with the policy wizard open and the type picked. */
  addPolicy(type: LeaveTypeResponse): void { void this.router.navigate(['/settings/time-off/policies'], { queryParams: { type: type.id, new: 1 } }); }
}
