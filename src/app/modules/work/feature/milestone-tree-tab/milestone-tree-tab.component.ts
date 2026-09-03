import { Component, computed, inject, signal } from '@angular/core';
import { CurrentEmployeeStore } from '../../state/current-employee.store';

import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../../ui/work-dropdown/work-dropdown.component';
import { TaskFormModalComponent } from '../../ui/task-form-modal/task-form-modal.component';
import { TreeExplanationPanelComponent } from '../../ui/tree-explanation-panel/tree-explanation-panel.component';
import { SubModuleFormComponent } from '../../ui/sub-module-form/sub-module-form.component';
import { MemberManagementPopupComponent } from '../../ui/member-management-popup/member-management-popup.component';
import { SprintFormComponent } from '../../ui/sprint-form/sprint-form.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { MilestoneTreeNode, ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto, CreateObjectiveRequestDto } from '../../models/dto/milestone.dto';
import {
  findTreeNode, isLeafObjective, collectObjectiveOptions, pruneTreeToModule, filterTreeByActivity, ActivityFilter
} from '../../utils/project.mapper';
import { Sprint, SprintStatus } from '../../models/sprint.model';

@Component({
  selector: 'app-milestone-tree-tab',
  standalone: true,
  imports: [
    MilestoneTreeNodeComponent, WorkDropdownComponent, TreeExplanationPanelComponent, SubModuleFormComponent,
    MemberManagementPopupComponent, SprintFormComponent, TaskFormModalComponent,
    LoaderComponent, ErrorStateComponent, EmptyStateComponent, ConfirmModalComponent
  ],
  templateUrl: './milestone-tree-tab.component.html'
})
export class MilestoneTreeTabComponent {
  readonly store = inject(ProjectDetailStore);
    private readonly route = inject(ActivatedRoute);
  protected readonly currentEmployee = inject(CurrentEmployeeStore);

  readonly taskModalOpen = signal(false);
  readonly taskModalMode = signal<'create' | 'edit'>('create');
  readonly taskModalTaskId = signal('');
  readonly taskModalPrefillModule = signal('');
  readonly taskModalPrefillSprint = signal('');

  private currentMilestoneId = '';
  private currentProjectId = '';
  protected readonly projectId = signal('');
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);
  private loadedProjectId: string | null = null;
  private loadedMembersForProjectId: string | null = null;

  selectedModuleFilter = signal<string>('all');
  selectedActivityFilter = signal<ActivityFilter>('all');

  private activityFilteredTree = computed(() => {
    const tree = this.store.selectedSubtree();
    if (!tree) return null;
    return filterTreeByActivity(tree, this.selectedActivityFilter());
  });

  // Intentionally independent of activityFilteredTree: the dropdown is a flat list, so it filters
  // directly by isActive rather than inheriting the tree's ancestor-path-preservation semantics
  // (which legitimately keep a non-matching ancestor visible in the tree for connectivity).
  moduleFilterOptions = computed(() => {
    const tree = this.store.selectedSubtree();
    if (!tree) return [];
    return this.filterOptionsByActivity(collectObjectiveOptions(tree), this.selectedActivityFilter());
  });

  // Adapts moduleFilterOptions to the shared dropdown's { value, label } shape, with the
  // synthetic "all" entry the tree-prune filter needs. Single-select by design: it drives
  // pruneTreeToModule (one subtree). Defaults to "all" - the routed milestone never scopes it.
  moduleDropdownOptions = computed<WorkDropdownOption[]>(() => [
    { value: 'all', label: 'All modules' },
    ...this.moduleFilterOptions().map((option) => ({ value: option.id, label: option.title }))
  ]);
  readonly activityFilterOptions: readonly WorkDropdownOption[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  renderedTree = computed(() => {
    const tree = this.activityFilteredTree();
    if (!tree) return null;
    return pruneTreeToModule(tree, this.selectedModuleFilter()) ?? tree;
  });

  selectedNodeId = signal<string | null>(null);
  selectedNode = computed<MilestoneTreeNode | null>(() => {
    const tree = this.store.selectedSubtree();
    const id = this.selectedNodeId();
    if (!tree || !id) return null;
    return findTreeNode(tree, id);
  });

  settingsOpen = signal(false);
  settingsInitialValue = signal<ObjectiveDetail | null>(null);
  settingsSubmitting = signal(false);

  createModalOpen = signal(false);
  createModalParentId = signal('');
  createModalSubmitting = signal(false);

  membersPopupOpen = signal(false);

  createSprintOpen = signal(false);
  createSprintNode = signal<MilestoneTreeNode | null>(null);
  deleteConfirmOpen = signal(false);
  pendingDeleteNode = signal<MilestoneTreeNode | null>(null);
  editSprintOpen = signal(false);
  editSprintNode = signal<MilestoneTreeNode | null>(null);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((paramMap) => {
      const milestoneId = paramMap.get('milestoneId');
      if (!milestoneId) return;
      this.currentMilestoneId = milestoneId;
      this.currentProjectId = paramMap.get('id') ?? this.resolveProjectId() ?? '';
      this.projectId.set(this.currentProjectId);
      // Every active project member sees the FULL objective tree. The routed milestone only
      // preselects a node for the detail panel - it does NOT scope what the tree shows. The
      // per-node isOwner flag still gates the editing tools; the module dropdown stays
      // available for voluntary narrowing.
      this.selectedModuleFilter.set('all');
      this.selectedNodeId.set(milestoneId);
      void this.loadTree();
      void this.currentEmployee.ensureLoaded();
      if (this.currentProjectId && this.loadedMembersForProjectId !== this.currentProjectId) {
        this.loadedMembersForProjectId = this.currentProjectId;
        void this.loadAssignableMembers(this.currentProjectId);
      }
    });
  }

  private async loadAssignableMembers(projectId: string): Promise<void> {
    try {
      await this.store.loadProjectMembers(projectId);
      const members = this.store.projectMembers();
      this.assignableMembers.set(members.map((member) => ({
        employeeId: member.employeeId,
        name: member.name ?? 'Unknown employee'
      })));
    } catch {
      this.assignableMembers.set([]);
    }
  }

  onModuleFilterChanged(moduleId: string): void {
    this.selectedModuleFilter.set(moduleId);
  }

  onActivityFilterChanged(value: string): void {
    const filter = value as ActivityFilter;
    this.selectedActivityFilter.set(filter);

    const currentModuleId = this.selectedModuleFilter();
    if (currentModuleId === 'all') return;
    const tree = this.store.selectedSubtree();
    const options = tree ? this.filterOptionsByActivity(collectObjectiveOptions(tree), filter) : [];
    if (!options.some((option) => option.id === currentModuleId)) {
      this.selectedModuleFilter.set('all');
    }
  }

  private filterOptionsByActivity(
    options: { id: string; title: string; isActive: boolean }[],
    filter: ActivityFilter
  ): { id: string; title: string; isActive: boolean }[] {
    if (filter === 'all') return options;
    const wantActive = filter === 'active';
    return options.filter((option) => option.isActive === wantActive);
  }

  onNodeSelected(node: MilestoneTreeNode): void {
    this.selectedNodeId.set(node.id);
  }

  async retryTree(): Promise<void> {
    await this.loadTree({ force: true });
  }

  private resolveProjectId(): string | null {
    let current: ActivatedRoute | null = this.route;
    while (current) {
      const id = current.snapshot.paramMap.get('id');
      if (id) return id;
      current = current.parent;
    }
    return this.store.project()?.id ?? null;
  }

  private async loadTree(options?: { force?: boolean }): Promise<void> {
    const projectId = this.currentProjectId || this.resolveProjectId();
    if (!projectId) return;
    this.currentProjectId = projectId;
    if (!options?.force && this.loadedProjectId === projectId && this.store.selectedSubtree()) {
      const tree = this.store.selectedSubtree();
      if (tree && !findTreeNode(tree, this.selectedNodeId() ?? '')) this.selectedNodeId.set(tree.id);
      return;
    }
    await this.store.loadProjectTree(projectId);
    this.loadedProjectId = projectId;
    const tree = this.store.selectedSubtree();
    // Fall back to the root only when the routed milestone isn't in this project's tree.
    if (tree && !findTreeNode(tree, this.selectedNodeId() ?? '')) this.selectedNodeId.set(tree.id);
  }

  onCreateSubRequested(node: MilestoneTreeNode): void {
    this.createModalParentId.set(node.id);
    this.createModalOpen.set(true);
  }

  onExpandLeafRequested(node: MilestoneTreeNode): void {
    if (isLeafObjective(node)) {
      void this.store.loadSprintsAndTasksForLeaf(node.id);
    } else if (node.kind === 'sprint') {
      void this.store.loadTasksForSprint(node.id);
    }
  }

  onCreateSprintRequested(node: MilestoneTreeNode): void {
    this.createSprintNode.set(node);
    this.createSprintOpen.set(true);
  }

  async onSprintCreated(): Promise<void> {
    const node = this.createSprintNode();
    this.createSprintOpen.set(false);
    if (node) await this.store.loadSprintsAndTasksForLeaf(node.id, { force: true });
  }

  onSprintCreateCancelled(): void {
    this.createSprintOpen.set(false);
    this.createSprintNode.set(null);
  }

  onCreateTaskRequested(node: MilestoneTreeNode): void {
    const isSprint = (node.kind ?? 'objective') === 'sprint';
    this.taskModalPrefillModule.set(isSprint ? (node.parentObjectiveId ?? '') : node.id);
    this.taskModalPrefillSprint.set(isSprint ? node.id : '');
    this.taskModalMode.set('create');
    this.taskModalTaskId.set('');
    this.taskModalOpen.set(true);
  }

  private openTaskModalForEdit(taskId: string): void {
    this.taskModalPrefillModule.set('');
    this.taskModalPrefillSprint.set('');
    this.taskModalMode.set('edit');
    this.taskModalTaskId.set(taskId);
    this.taskModalOpen.set(true);
  }

  onTaskModalClosed(): void {
    this.taskModalOpen.set(false);
  }

  async onTaskModalDone(): Promise<void> {
    this.taskModalOpen.set(false);
    await this.loadTree({ force: true });
  }

  sprintFromNode(node: MilestoneTreeNode): Sprint {
    return {
      id: node.id,
      objectiveId: node.parentObjectiveId ?? '',
      name: node.title,
      startDate: new Date(node.startDate),
      endDate: new Date(node.endDate),
      status: (node.status as SprintStatus) ?? 'active',
      completedAt: null,
      achievedAt: null
    };
  }

  onViewRequested(node: MilestoneTreeNode): void {
    this.selectedNodeId.set(node.id);
    this.openTaskModalForEdit(node.taskSource?.id ?? node.id);
  }

  async onEditRequested(node?: MilestoneTreeNode): Promise<void> {
    const target = node ?? this.selectedNode();
    if (!target) return;
    this.selectedNodeId.set(target.id);

    const kind = target.kind ?? 'objective';
    if (kind === 'sprint') {
      this.editSprintNode.set(target);
      this.editSprintOpen.set(true);
      return;
    }
    if (kind === 'task') {
      this.openTaskModalForEdit(target.taskSource?.id ?? target.id);
      return;
    }

    this.settingsOpen.set(true);
    const detail = await this.store.getMilestoneDetail(target.id);
    if (detail && this.selectedNode()?.id === target.id) {
      this.settingsInitialValue.set(detail);
    }
  }

  async onSprintSaved(): Promise<void> {
    const node = this.editSprintNode();
    this.editSprintOpen.set(false);
    this.editSprintNode.set(null);
    if (node?.parentObjectiveId) {
      await this.store.loadSprintsAndTasksForLeaf(node.parentObjectiveId, { force: true });
    }
  }

  onSprintEditCancelled(): void {
    this.editSprintOpen.set(false);
    this.editSprintNode.set(null);
  }

  async onCreateModalCreated(event: { payload: CreateObjectiveRequestDto; assetFiles: readonly File[] }): Promise<void> {
    this.createModalSubmitting.set(true);
    const result = await this.store.createSubModule(event.payload);
    let failedFileCount = 0;
    if (result.success && result.objectiveId) {
      for (const file of event.assetFiles) {
        const uploadResult = await this.store.uploadMilestoneAsset(result.objectiveId, file);
        if (!uploadResult.success) {
          failedFileCount++;
        }
      }
    }
    this.createModalSubmitting.set(false);
    if (result.success) {
      this.createModalOpen.set(false);
      if (failedFileCount > 0) {
        this.store.setMilestoneActionError(
          `"${event.payload.title}" was created, but ${failedFileCount} file(s) failed to upload — open Module settings on it to retry.`
        );
      }
      await this.loadTree({ force: true });
    }
  }

  async onSettingsSaved(event: { fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    this.settingsSubmitting.set(true);

    if (event.achievedChanged && !event.achieved) {
      const unachieveResult = await this.store.unachieveMilestone(node.id);
      if (!unachieveResult.success) {
        this.settingsSubmitting.set(false);
        return;
      }
    }

    const editResult = await this.store.editMilestone(node.id, event.fields);
    if (!editResult.success) {
      this.settingsSubmitting.set(false);
      return;
    }

    if (event.achievedChanged && event.achieved) {
      const achieveResult = await this.store.achieveMilestone(node.id);
      if (!achieveResult.success) {
        this.settingsSubmitting.set(false);
        return;
      }
    }

    this.settingsSubmitting.set(false);
    this.settingsOpen.set(false);
    await this.loadTree({ force: true });
  }

  async onAchieveRequested(node: MilestoneTreeNode): Promise<void> {
    const result = node.isAchieved
      ? await this.store.unachieveMilestone(node.id)
      : await this.store.achieveMilestone(node.id);
    if (result.success) await this.loadTree({ force: true });
  }

  async onAchieveSprintRequested(node: MilestoneTreeNode): Promise<void> {
    await this.store.achieveSprint(node.id);
  }

  async onCompleteSprintRequested(node: MilestoneTreeNode): Promise<void> {
    await this.store.completeSprint(node.id);
  }

  onDeleteRequested(node: MilestoneTreeNode): void {
    this.pendingDeleteNode.set(node);
    this.deleteConfirmOpen.set(true);
  }

  async onDeleteConfirmed(): Promise<void> {
    const node = this.pendingDeleteNode();
    if (!node) return;
    const result = await this.store.deleteTask(node.id);
    if (!result.success) return;
    if (this.selectedNodeId() === node.id) this.selectedNodeId.set(null);
    this.deleteConfirmOpen.set(false);
    this.pendingDeleteNode.set(null);
  }

  onDeleteCancelled(): void {
    this.deleteConfirmOpen.set(false);
    this.pendingDeleteNode.set(null);
  }

  onMembersRequested(node?: MilestoneTreeNode): void {
    const target = node ?? this.selectedNode();
    if (!target) return;
    this.selectedNodeId.set(target.id);
    this.membersPopupOpen.set(true);
    this.store.loadObjectiveMembers(target.id);
  }

  onMembersPopupClosed(): void {
    this.membersPopupOpen.set(false);
  }

  // addRequested now emits a real employeeId from EmployeePickerComponent (Task 7).
  async onAddMemberRequested(employeeId: string): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    await this.store.addObjectiveMember(node.id, employeeId);
    await this.store.loadObjectiveMembers(node.id);
  }

  async onRemoveMemberRequested(employeeId: string): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    await this.store.removeObjectiveMember(node.id, employeeId);
    await this.store.loadObjectiveMembers(node.id);
  }

  async onTransferRequested(employeeId: string): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    await this.store.transferObjectiveHead(node.id, employeeId);
    await this.store.loadObjectiveMembers(node.id);
  }
}
