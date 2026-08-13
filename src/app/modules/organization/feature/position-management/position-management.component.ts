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
import { RoleStore } from '../../state/role.store';
import {
  AddCoverageRecordRequest,
  CreatePositionRequest,
  POSITION_TEMPLATE_DRAG_MIME_TYPE,
  PositionListItemResponse,
  PositionTemplatePackPositionResponse,
  PositionTemplatePreset,
  PositionTreeNodeResponse,
  SetPositionAccessRequest
} from '../../models/position.model';
import { PositionTreeNodeComponent, ReparentPositionEvent, TemplateDropOnPositionEvent } from '../../ui/position-tree-node/position-tree-node.component';
import { PositionListTableComponent } from '../../ui/position-list-table/position-list-table.component';
import { PositionFormModalComponent, PositionFormSubmitValue } from '../../ui/position-form-modal/position-form-modal.component';
import { PositionArchiveModalComponent } from '../../ui/position-archive-modal/position-archive-modal.component';
import { PositionCoverageModalComponent, UpdateCoverageEvent } from '../../ui/position-coverage-modal/position-coverage-modal.component';
import { PositionAccessModalComponent } from '../../ui/position-access-modal/position-access-modal.component';
import { PositionTemplateDrawerComponent, TemplatePositionSelectedEvent } from '../../ui/position-template-drawer/position-template-drawer.component';

import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';

@Component({
  selector: 'app-position-management',
  standalone: true,
  imports: [
    CommonModule,
    BreadcrumbHeaderComponent,
    ButtonComponent,
    SelectComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    PositionTreeNodeComponent,
    PositionListTableComponent,
    PositionFormModalComponent,
    PositionArchiveModalComponent,
    PositionCoverageModalComponent,
    PositionAccessModalComponent,
    PositionTemplateDrawerComponent
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
  readonly roleStore = inject(RoleStore);

  readonly hasReadAccess = computed(() => this.permissionService.hasPermission('org:read'));
  readonly hasManageAccess = computed(() => this.permissionService.hasPermission('org:manage'));
  readonly hasRoleReadAccess = computed(() => this.permissionService.hasPermission('roles:read'));
  readonly canConfigureAccess = computed(() => this.hasManageAccess() && this.hasRoleReadAccess());
  readonly selectedLegalEntity = this.legalEntityStore.selectedLegalEntity;

  readonly filterMenuOpen = signal(false);

  // Template Drawer
  readonly templateDrawerOpen = signal(false);
  readonly templatePreset = signal<PositionTemplatePreset | null>(null);
  readonly canvasDragOver = signal(false);

  // Modals
  readonly formModalOpen = signal(false);
  readonly editingPosition = signal<PositionListItemResponse | PositionTreeNodeResponse | null>(null);
  readonly reportsToPreset = signal<PositionTreeNodeResponse | null>(null);


  readonly archiveModalOpen = signal(false);
  readonly archivingPosition = signal<PositionListItemResponse | PositionTreeNodeResponse | null>(null);
  readonly coverageModalOpen = signal(false);
  readonly accessModalOpen = signal(false);

  readonly searchExpanded = signal(false);

  toggleSearch(): void {
    this.searchExpanded.update((v) => !v);
  }

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

  readonly treeZoom = signal(0.7);
  readonly treePanX = signal(0);
  readonly treePanY = signal(0);
  readonly isPanning = signal(false);

  private startPointerX = 0;
  private startPointerY = 0;
  private initialPanX = 0;
  private initialPanY = 0;
  private activePointerId: number | null = null;

  readonly zoomPercentage = computed(() => Math.round(this.treeZoom() * 100));
  readonly treeTransform = computed(
    () => `translate(${this.treePanX()}px, ${this.treePanY()}px) scale(${this.treeZoom()})`
  );

  zoomIn(): void {
    this.treeZoom.update((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10));
  }

  zoomOut(): void {
    this.treeZoom.update((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10));
  }

  resetZoom(): void {
    this.treeZoom.set(0.7);
    this.treePanX.set(0);
    this.treePanY.set(0);
  }

  // Smaller than the +/- button step (0.1) so a single wheel fling doesn't blow through the whole zoom range at once.
  private static readonly WHEEL_ZOOM_STEP = 0.02;

  onTreeWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.treeZoom.update((z) => Math.min(1.5, Math.round((z + PositionManagementComponent.WHEEL_ZOOM_STEP) * 100) / 100));
    } else if (event.deltaY > 0) {
      this.treeZoom.update((z) => Math.max(0.4, Math.round((z - PositionManagementComponent.WHEEL_ZOOM_STEP) * 100) / 100));
    }
  }

  onCanvasPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement | null;
    if (
      !target ||
      target.closest('.ptn-node-card') ||
      target.closest('.ptn-drop-target-box') ||
      target.closest('.pm-zoom-controls') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select')
    ) {
      return;
    }

    this.isPanning.set(true);
    this.startPointerX = event.clientX;
    this.startPointerY = event.clientY;
    this.initialPanX = this.treePanX();
    this.initialPanY = this.treePanY();
    this.activePointerId = event.pointerId;

    const container = event.currentTarget as HTMLElement;
    if (container && typeof container.setPointerCapture === 'function') {
      try {
        container.setPointerCapture(event.pointerId);
      } catch {
        // Safe catch for synthetic test events
      }
    }
  }

  onCanvasPointerMove(event: PointerEvent): void {
    if (!this.isPanning() || (this.activePointerId !== null && this.activePointerId !== event.pointerId)) {
      return;
    }

    const dx = event.clientX - this.startPointerX;
    const dy = event.clientY - this.startPointerY;
    this.treePanX.set(this.initialPanX + dx);
    this.treePanY.set(this.initialPanY + dy);
  }

  onCanvasPointerUp(event: PointerEvent): void {
    this.endPanning(event);
  }

  onCanvasPointerCancel(event: PointerEvent): void {
    this.endPanning(event);
  }

  private endPanning(event: PointerEvent): void {
    if (!this.isPanning()) return;

    this.isPanning.set(false);

    const container = event.currentTarget as HTMLElement;
    if (container && typeof container.releasePointerCapture === 'function') {
      try {
        if (this.activePointerId !== null && container.hasPointerCapture?.(this.activePointerId)) {
          container.releasePointerCapture(this.activePointerId);
        }
      } catch {
        // Safe catch for synthetic test events
      }
    }
    this.activePointerId = null;
  }


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

  openTemplateDrawer(): void {
    if (!this.hasReadAccess()) return;
    this.templateDrawerOpen.set(true);
    if (this.positionStore.templatePacks().length === 0 && !this.positionStore.templatePacksLoading()) {
      void this.positionStore.loadTemplatePacks();
    }
  }

  closeTemplateDrawer(): void {
    this.templateDrawerOpen.set(false);
  }

  private findMatchingDepartment(departmentName: string): { id: string } | undefined {
    return this.departmentStore.allFlatList().find(
      (d) => d.name.trim().toLowerCase() === departmentName.trim().toLowerCase()
    );
  }

  private openTemplatePreset(
    position: PositionTemplatePackPositionResponse,
    source: PositionTemplatePreset['source'],
    reportsToPositionId: string | null,
    reportsToPositionName: string | null,
    departmentId: string | null,
    suggestedDepartmentName: string | null,
    departmentMessage: string | null
  ): void {
    if (this.hasRoleReadAccess()) {
      void this.roleStore.loadRolesOnly();
    }

    this.editingPosition.set(null);
    this.reportsToPreset.set(null);
    this.templatePreset.set({
      source,
      positionName: position.positionName,
      positionKey: position.positionKey,
      departmentId,
      reportsToPositionId,
      reportsToPositionName,
      suggestedDepartmentName,
      departmentMessage
    });
    this.formModalOpen.set(true);
  }

  onSelectTemplatePosition(event: TemplatePositionSelectedEvent): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error('You need organization management access to create positions from templates.');
      return;
    }

    const deptMatch = this.findMatchingDepartment(event.position.departmentName);

    let posMatch: PositionListItemResponse | PositionTreeNodeResponse | undefined;
    if (event.position.reportsToPositionKey) {
      const targetKey = event.position.reportsToPositionKey.trim().toLowerCase();
      posMatch = this.positionStore.allPositionsList().find(
        (p) => (p.code && p.code.trim().toLowerCase() === targetKey) || p.name.trim().toLowerCase() === targetKey
      );
    }

    this.openTemplatePreset(
      event.position,
      'template-click',
      posMatch ? posMatch.id : null,
      posMatch ? posMatch.name : null,
      deptMatch ? deptMatch.id : null,
      deptMatch ? null : event.position.departmentName,
      null
    );
  }

  onCanvasDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes(POSITION_TEMPLATE_DRAG_MIME_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = this.hasManageAccess() ? 'copy' : 'none';
    if (this.hasManageAccess()) {
      this.canvasDragOver.set(true);
    }
  }

  onCanvasDragLeave(): void {
    this.canvasDragOver.set(false);
  }

  onCanvasDrop(event: DragEvent): void {
    const raw = event.dataTransfer?.getData(POSITION_TEMPLATE_DRAG_MIME_TYPE);
    this.canvasDragOver.set(false);
    if (!raw) return;
    event.preventDefault();

    if (!this.hasManageAccess()) {
      this.notificationService.error('You need organization management access to create positions from templates.');
      return;
    }

    try {
      const data = JSON.parse(raw);
      if (!data || !data.position) return;
      const position: PositionTemplatePackPositionResponse = data.position;
      const deptMatch = this.findMatchingDepartment(position.departmentName);

      this.openTemplatePreset(
        position,
        'template-drop-root',
        null,
        null,
        deptMatch ? deptMatch.id : null,
        deptMatch ? null : position.departmentName,
        null
      );
    } catch {
      // ignore invalid payload
    }
  }

  onTemplateDroppedOnPosition(event: TemplateDropOnPositionEvent): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error('You need organization management access to create positions from templates.');
      return;
    }

    const target = event.targetPosition;
    const departmentId = target.departmentId || null;
    const departmentName = departmentId
      ? target.departmentName || this.departmentNameMap()[departmentId] || null
      : null;

    this.openTemplatePreset(
      event.templatePosition,
      'template-drop-under-position',
      target.id,
      target.name,
      departmentId,
      null,
      departmentId ? `Inherited department "${departmentName}" from '${target.name}'.` : null
    );
  }


  openCreateModal(reportsToPreset?: PositionTreeNodeResponse): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to create positions.");
      return;
    }
    if (this.hasRoleReadAccess()) {
      void this.roleStore.loadRolesOnly();
    }
    this.editingPosition.set(null);
    this.templatePreset.set(null);
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
    this.templatePreset.set(null);
    this.formModalOpen.set(true);
  }

  closeFormModal(): void {
    this.formModalOpen.set(false);
    this.editingPosition.set(null);
    this.reportsToPreset.set(null);
    this.templatePreset.set(null);
  }

  async onSavePosition(val: PositionFormSubmitValue): Promise<void> {
    const le = this.selectedLegalEntity();
    if (!le) return;

    const editing = this.editingPosition();
    const isFromTemplate = !!this.templatePreset();

    if (editing) {
      const success = await this.positionStore.updatePosition(le.id, editing.id, {
        departmentId: val.departmentId,
        name: val.name,
        code: val.code,
        maxOccupancy: val.maxOccupancy,
        reportsToPositionId: val.reportsToPositionId
      });
      if (success) {
        this.notificationService.success(`Position '${val.name}' updated successfully.`);
        this.closeFormModal();
      } else {
        this.notificationService.error(this.positionStore.actionError() ?? 'Failed to update position.');
      }
      return;
    }

    // Step 1: Call Create Position with ONLY position fields
    const createPayload: CreatePositionRequest = {
      departmentId: val.departmentId,
      name: val.name,
      code: val.code,
      maxOccupancy: val.maxOccupancy,
      reportsToPositionId: val.reportsToPositionId
    };

    const createdPos = await this.positionStore.createPosition(le.id, createPayload);

    if (!createdPos) {
      this.notificationService.error(this.positionStore.actionError() ?? 'Failed to create position.');
      return;
    }

    // Step 2: Set Position Access if user selected system access role
    if (val.selectedAccessRoleId) {
      const accessSuccess = await this.positionStore.setPositionAccess(le.id, createdPos.id, {
        roleId: val.selectedAccessRoleId,
        requiresApproval: !!val.accessRequiresApproval
      });

      if (accessSuccess) {
        this.notificationService.success(
          isFromTemplate ? 'Position created from template.' : 'Position created with system access.'
        );
      } else {
        this.notificationService.warning(
          'Position was created, but system access was not saved. You can update access from Position Access.'
        );
      }
    } else {
      this.notificationService.success(isFromTemplate ? 'Position created from template.' : 'Position created.');
    }

    this.closeFormModal();
  }


  async openAccessModal(pos: PositionListItemResponse | PositionTreeNodeResponse): Promise<void> {
    if (!this.canConfigureAccess()) {
      this.notificationService.error("You don't have permission to configure position system access.");
      return;
    }
    const le = this.selectedLegalEntity();
    if (!le) return;

    void this.roleStore.loadRolesOnly();

    this.accessModalOpen.set(true);
    await this.positionStore.loadAccess(le.id, pos);
  }

  closeAccessModal(): void {
    this.accessModalOpen.set(false);
    this.positionStore.clearAccess();
  }

  async onSaveAccess(req: SetPositionAccessRequest): Promise<void> {
    if (!this.canConfigureAccess()) {
      this.notificationService.error("You don't have permission to configure position system access.");
      return;
    }
    const le = this.selectedLegalEntity();
    const pos = this.positionStore.selectedAccessPosition();
    if (!le || !pos) return;

    const success = await this.positionStore.setPositionAccess(le.id, pos.id, req);
    if (success) {
      this.notificationService.success(`System access template for '${pos.name}' updated successfully.`);
      this.closeAccessModal();
    } else {
      this.notificationService.error(this.positionStore.accessError() ?? 'Failed to update system access template.');
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

    const success = await this.positionStore.updatePosition(le.id, fullPos.id, {
      departmentId: fullPos.departmentId || '',
      name: fullPos.name,
      code: fullPos.code || '',
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
