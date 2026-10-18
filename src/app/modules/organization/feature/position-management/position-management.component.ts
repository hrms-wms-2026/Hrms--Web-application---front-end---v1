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
  ReportingLineMoveImpact,
  ReportingLineMoveRequest,
  SetPositionAccessRequest
} from '../../models/position.model';
import {
  POSITION_CARD_HEIGHT,
  POSITION_CARD_WIDTH,
  PositionTreeNodeComponent,
  ReparentPositionEvent,
  TemplateDropOnPositionEvent,
  positionChildren,
  positionKey
} from '../../ui/position-tree-node/position-tree-node.component';
import {
  PEOPLE_CARD_HEIGHT,
  PEOPLE_CARD_WIDTH,
  PeopleCardDragEvent,
  PeopleCardSelectionEvent,
  PeopleChartNodeComponent
} from '../../ui/people-chart-node/people-chart-node.component';
import { TidyTreeComponent } from '../../../../shared/ui/tidy-tree/tidy-tree.component';
import { ReportingLineReviewModalComponent } from '../../ui/reporting-line-review-modal/reporting-line-review-modal.component';
import { PositionApiService } from '../../data-access/position-api.service';
import { PeopleChartTreeNode, PositionPeopleChartNode } from '../../models/position.model';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { PositionListTableComponent } from '../../ui/position-list-table/position-list-table.component';
import { PositionFormModalComponent, PositionFormSubmitValue } from '../../ui/position-form-modal/position-form-modal.component';
import { PositionArchiveModalComponent } from '../../ui/position-archive-modal/position-archive-modal.component';
import { PositionCoverageModalComponent, TargetOccupancyRequest, UpdateCoverageEvent } from '../../ui/position-coverage-modal/position-coverage-modal.component';
import { PositionAccessModalComponent } from '../../ui/position-access-modal/position-access-modal.component';
import { PositionTemplateDrawerComponent, TemplatePositionSelectedEvent } from '../../ui/position-template-drawer/position-template-drawer.component';

import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { PanZoomCanvasComponent } from '../../../../shared/ui/pan-zoom-canvas/pan-zoom-canvas.component';

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
    PeopleChartNodeComponent,
    PositionListTableComponent,
    PositionFormModalComponent,
    PositionArchiveModalComponent,
    PositionCoverageModalComponent,
    PositionAccessModalComponent,
    PositionTemplateDrawerComponent,
    ReportingLineReviewModalComponent,
    PanZoomCanvasComponent,
    TidyTreeComponent
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
  private readonly positionApi = inject(PositionApiService);

  /** Tree view sub-mode: the position structure editor, or one card per person holding it. */
  readonly chartMode = signal<'positions' | 'people'>('positions');
  readonly peopleNodes = signal<readonly PositionPeopleChartNode[] | null>(null);
  readonly peopleLoading = signal(false);
  readonly peopleError = signal<string | null>(null);
  readonly selectedPeopleIds = signal<ReadonlySet<string>>(new Set<string>());
  readonly draggingPeople = signal(false);
  readonly choosingReportingManager = signal(false);
  readonly reportingMovePreview = signal<ReportingLineMoveImpact | null>(null);
  readonly reportingMoveRequest = signal<ReportingLineMoveRequest | null>(null);
  readonly reportingMovePreviewLoading = signal(false);
  readonly reportingMoveSaving = signal(false);
  private peopleRequestKey: string | null = null;
  private selectionAnchorEmployeeId: string | null = null;

  /** Flat nodes (parentId links) -> forest; people first by position then name, vacant last. */
  readonly peopleTree = computed<readonly PeopleChartTreeNode[]>(() => {
    const nodes = this.peopleNodes() ?? [];
    const childrenOf = new Map<string | null, PositionPeopleChartNode[]>();
    for (const node of nodes) {
      const key = node.parentId && nodes.some((n) => n.id === node.parentId) ? node.parentId : null;
      const list = childrenOf.get(key) ?? [];
      list.push(node);
      childrenOf.set(key, list);
    }
    const order = (a: PositionPeopleChartNode, b: PositionPeopleChartNode): number =>
      (a.kind === b.kind ? 0 : a.kind === 'vacant' ? 1 : -1) ||
      a.positionName.localeCompare(b.positionName) ||
      `${a.firstName ?? ''} ${a.lastName ?? ''}`.localeCompare(`${b.firstName ?? ''} ${b.lastName ?? ''}`);
    const build = (parentId: string | null): PeopleChartTreeNode[] =>
      (childrenOf.get(parentId) ?? [])
        .slice()
        .sort(order)
        .map((node) => ({ ...node, children: build(node.id) }));
    return build(null);
  });

  readonly peopleFlatOrder = computed<readonly PeopleChartTreeNode[]>(() => {
    const result: PeopleChartTreeNode[] = [];
    const visit = (nodes: readonly PeopleChartTreeNode[]): void => {
      for (const node of nodes) {
        if (node.kind === 'person' && !node.isPending && node.employeeId) result.push(node);
        visit(node.children);
      }
    };
    visit(this.peopleTree());
    return result;
  });

  readonly selectedBranchRootIds = computed<ReadonlySet<string>>(() => {
    const selected = this.selectedPeopleIds();
    const nodesById = new Map(this.peopleFlatOrder().map((node) => [node.employeeId!, node]));
    const roots = new Set<string>();
    for (const node of this.peopleFlatOrder()) {
      if (!node.employeeId || !selected.has(node.employeeId)) continue;
      const seen = new Set<string>();
      let parentEmployeeId = node.parentId?.startsWith('e:') ? node.parentId.slice(2) : null;
      let hasSelectedAncestor = false;
      while (parentEmployeeId && !seen.has(parentEmployeeId)) {
        if (selected.has(parentEmployeeId)) {
          hasSelectedAncestor = true;
          break;
        }
        seen.add(parentEmployeeId);
        const parent = nodesById.get(parentEmployeeId);
        parentEmployeeId = parent?.parentId?.startsWith('e:') ? parent.parentId.slice(2) : null;
      }
      if (!hasSelectedAncestor) roots.add(node.employeeId);
    }
    return roots;
  });

  /**
   * Direct reports by manager, following person-to-person lines only ("e:" parents) - the same
   * structure the move endpoint works on. A vacant seat breaks the line, so people under it are
   * never pulled into a selection.
   */
  private readonly directReportIds = computed<ReadonlyMap<string, readonly string[]>>(() => {
    const map = new Map<string, string[]>();
    for (const node of this.peopleFlatOrder()) {
      const managerId = node.parentId?.startsWith('e:') ? node.parentId.slice(2) : null;
      if (!managerId) continue;
      map.set(managerId, [...(map.get(managerId) ?? []), node.employeeId!]);
    }
    return map;
  });

  /** The person plus everyone who reports to them, directly or further down. */
  private withReports(employeeIds: Iterable<string>): Set<string> {
    const result = new Set<string>();
    const pending = [...employeeIds];
    while (pending.length > 0) {
      const id = pending.pop()!;
      if (result.has(id)) continue;
      result.add(id);
      pending.push(...(this.directReportIds().get(id) ?? []));
    }
    return result;
  }

  /** Unchecked people reporting to someone who is checked: they stay, with the nearest manager not moving. */
  readonly stayingPeopleIds = computed<ReadonlySet<string>>(() => {
    const selected = this.selectedPeopleIds();
    const staying = new Set<string>();
    for (const [managerId, reports] of this.directReportIds()) {
      if (!selected.has(managerId)) continue;
      for (const id of reports) if (!selected.has(id)) staying.add(id);
    }
    return staying;
  });

  /** Everyone whose manager changes or who moves with their team: the checked people plus those staying behind. */
  readonly affectedPeopleIds = computed<ReadonlySet<string>>(
    () => new Set([...this.selectedPeopleIds(), ...this.stayingPeopleIds()])
  );

  readonly peopleSelectionActive = computed(() => this.selectedPeopleIds().size > 0);
  readonly peopleAvatarFileIds = computed<ReadonlyMap<string, string | null>>(() =>
    new Map(
      (this.peopleNodes() ?? [])
        .filter((node): node is PositionPeopleChartNode & { employeeId: string } => !!node.employeeId)
        .map((node) => [node.employeeId, node.avatarFileId] as const)
    )
  );
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

  // ── Chart layout (app-tidy-tree) ─────────────────────────────────────────
  readonly positionCardWidth = POSITION_CARD_WIDTH;
  readonly positionCardHeight = POSITION_CARD_HEIGHT;
  readonly positionChildren = positionChildren;
  readonly positionKey = positionKey;
  readonly peopleCardWidth = PEOPLE_CARD_WIDTH;
  readonly peopleCardHeight = PEOPLE_CARD_HEIGHT;
  readonly peopleChildren = (node: PeopleChartTreeNode): readonly PeopleChartTreeNode[] => node.children;
  readonly peopleKey = (node: PeopleChartTreeNode): string => node.id;
  /** A one-off manager draws the line into the card dashed amber. */
  readonly isCustomReportingLine = (node: PeopleChartTreeNode): boolean => node.reportingLine === 'custom';

  /** The hover card's "Reports to" line: the person above, or null under a vacant seat / at the top. */
  peopleManagerName(parent: PeopleChartTreeNode | null): string | null {
    if (!parent || parent.kind !== 'person') return null;
    return `${parent.firstName ?? ''} ${parent.lastName ?? ''}`.trim();
  }

  /** The People chart has data to draw (not loading, failed or empty). */
  readonly peopleChartReady = computed(
    () => !(this.peopleLoading() && !this.peopleNodes()) && !this.peopleError() && this.peopleTree().length > 0
  );

  /** A press on empty chart space (pan/zoom live in app-pan-zoom-canvas) clears the people selection. */
  onCanvasBackgroundPressed(): void {
    if (this.chartMode() === 'people' && this.peopleSelectionActive() && !this.choosingReportingManager()) {
      this.clearPeopleSelection();
    }
  }


  constructor() {
    effect(() => {
      const le = this.selectedLegalEntity();
      if (le && this.hasReadAccess()) {
        this.positionStore.load(le.id);
        this.departmentStore.load(le.id);
      }
    });

    // People data follows the company and every reload of the position structure while the
    // People chart is active. The Positions chart does not need person-level reporting data.
    effect(() => {
      const le = this.selectedLegalEntity();
      this.positionStore.treeData();
      if (le && this.hasReadAccess() && this.positionStore.viewMode() === 'tree' && this.chartMode() === 'people') {
        void this.loadPeopleChart(le.id);
      }
    });
  }

  setChartMode(mode: 'positions' | 'people'): void {
    this.chartMode.set(mode);
    if (mode !== 'people') this.clearPeopleSelection();
  }

  async loadPeopleChart(legalEntityId: string): Promise<void> {
    this.peopleRequestKey = legalEntityId;
    this.peopleLoading.set(true);
    this.peopleError.set(null);
    try {
      const nodes = await firstValueFrom(this.positionApi.getPeopleChart(legalEntityId));
      if (this.peopleRequestKey === legalEntityId) {
        this.peopleNodes.set(nodes);
      }
    } catch (err: unknown) {
      if (this.peopleRequestKey === legalEntityId) {
        this.peopleError.set(toSafeErrorMessage(err, 'Could not load the people chart.'));
      }
    } finally {
      if (this.peopleRequestKey === legalEntityId) {
        this.peopleLoading.set(false);
      }
    }
  }

  onPeopleSelected(event: PeopleCardSelectionEvent): void {
    if (!this.hasManageAccess() || !event.node.employeeId || event.node.isPending) return;

    const employeeId = event.node.employeeId;
    const current = this.selectedPeopleIds();
    const additive = event.ctrlKey || event.metaKey;

    // Checking someone checks everyone below them; unchecking does the same in reverse. Untick
    // individual reports afterwards to leave them where they are - only checked people move.
    if (event.shiftKey && this.selectionAnchorEmployeeId) {
      const order = this.peopleFlatOrder().map((node) => node.employeeId!);
      const anchorIndex = order.indexOf(this.selectionAnchorEmployeeId);
      const currentIndex = order.indexOf(employeeId);
      if (anchorIndex >= 0 && currentIndex >= 0) {
        const range = this.withReports(order.slice(Math.min(anchorIndex, currentIndex), Math.max(anchorIndex, currentIndex) + 1));
        this.selectedPeopleIds.set(new Set(additive ? [...current, ...range] : range));
        return;
      }
    }

    // The checkbox always toggles; a plain click on the card starts a new selection.
    if (additive || event.fromCheckbox) {
      const next = new Set(current);
      const branch = this.withReports([employeeId]);
      if (next.has(employeeId)) for (const id of branch) next.delete(id);
      else for (const id of branch) next.add(id);
      this.selectedPeopleIds.set(next);
    } else {
      this.selectedPeopleIds.set(this.withReports([employeeId]));
    }
    this.selectionAnchorEmployeeId = employeeId;
  }

  clearPeopleSelection(): void {
    this.selectedPeopleIds.set(new Set<string>());
    this.selectionAnchorEmployeeId = null;
    this.draggingPeople.set(false);
    this.choosingReportingManager.set(false);
  }

  beginManagerSelection(): void {
    if (!this.hasManageAccess() || !this.peopleSelectionActive()) return;
    this.choosingReportingManager.set(true);
  }

  cancelManagerSelection(): void {
    this.choosingReportingManager.set(false);
  }

  onPeopleDragStarted({ node, event }: PeopleCardDragEvent): void {
    if (!this.hasManageAccess() || !node.employeeId) {
      event.preventDefault();
      return;
    }
    if (!this.selectedPeopleIds().has(node.employeeId)) {
      // Dragging an unchecked manager takes their whole team, like checking them would.
      this.selectedPeopleIds.set(this.withReports([node.employeeId]));
      this.selectionAnchorEmployeeId = node.employeeId;
    }
    this.draggingPeople.set(true);
    this.choosingReportingManager.set(false);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(
        'application/x-onevo-reporting-branches',
        JSON.stringify([...this.selectedPeopleIds()])
      );
    }
  }

  onPeopleDragEnded(): void {
    this.draggingPeople.set(false);
  }

  onPeopleDropped({ node }: PeopleCardDragEvent): void {
    this.draggingPeople.set(false);
    if (node.employeeId) void this.previewReportingMove(node.employeeId);
  }

  onReportingManagerChosen(node: PeopleChartTreeNode): void {
    if (!node.employeeId) return;
    void this.previewReportingMove(node.employeeId);
  }

  private async previewReportingMove(newManagerEmployeeId: string): Promise<void> {
    const legalEntity = this.selectedLegalEntity();
    if (!legalEntity || !this.hasManageAccess() || this.selectedPeopleIds().size === 0) return;
    if (this.selectedPeopleIds().has(newManagerEmployeeId)) {
      this.notificationService.error('Choose a manager who is not one of the people being moved.');
      return;
    }

    const request: ReportingLineMoveRequest = {
      selectedEmployeeIds: [...this.selectedPeopleIds()],
      newManagerEmployeeId
    };
    this.choosingReportingManager.set(false);
    this.reportingMovePreviewLoading.set(true);
    try {
      const impact = await firstValueFrom(this.positionApi.previewReportingLineMove(legalEntity.id, request));
      this.reportingMoveRequest.set(request);
      this.reportingMovePreview.set(impact);
    } catch (err: unknown) {
      this.notificationService.error(toSafeErrorMessage(err, 'Could not validate this reporting change.'));
    } finally {
      this.reportingMovePreviewLoading.set(false);
    }
  }

  closeReportingMoveReview(): void {
    if (this.reportingMoveSaving()) return;
    this.reportingMovePreview.set(null);
    this.reportingMoveRequest.set(null);
  }

  async confirmReportingMove(reason: string | null): Promise<void> {
    const legalEntity = this.selectedLegalEntity();
    const request = this.reportingMoveRequest();
    if (!legalEntity || !request || this.reportingMoveSaving()) return;

    this.reportingMoveSaving.set(true);
    try {
      const impact = await firstValueFrom(this.positionApi.moveReportingLines(
        legalEntity.id,
        { ...request, reason }
      ));
      this.notificationService.success(
        `${impact.directRelationshipsChanged} reporting ${impact.directRelationshipsChanged === 1 ? 'line' : 'lines'} updated. Internal team relationships were preserved.`
      );
      this.reportingMovePreview.set(null);
      this.reportingMoveRequest.set(null);
      this.clearPeopleSelection();
      await this.loadPeopleChart(legalEntity.id);
    } catch (err: unknown) {
      this.notificationService.error(toSafeErrorMessage(err, 'Could not update the reporting lines.'));
    } finally {
      this.reportingMoveSaving.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.reportingMovePreview() && !this.reportingMoveSaving()) {
      this.closeReportingMoveReview();
    } else if (this.choosingReportingManager()) {
      this.cancelManagerSelection();
    } else if (this.peopleSelectionActive()) {
      this.clearPeopleSelection();
    }
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
    await Promise.all([
      this.positionStore.loadCoverage(le.id, pos),
      this.positionStore.loadCoverageOwnerHolders(le.id, pos.id)
    ]);
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

  async onTargetOccupancyRequested(req: TargetOccupancyRequest): Promise<void> {
    const le = this.selectedLegalEntity();
    if (!le) return;

    await this.positionStore.loadTargetOccupancy(
      le.id,
      req.coveredTargetType,
      req.coveredPositionId,
      req.coveredDepartmentId,
      req.excludingRecordId
    );
  }
}
