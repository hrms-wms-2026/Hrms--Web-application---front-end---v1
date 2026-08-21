import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { ModuleFilterSelectComponent } from '../../ui/module-filter-select/module-filter-select.component';
import { TreeExplanationPanelComponent } from '../../ui/tree-explanation-panel/tree-explanation-panel.component';
import { MilestoneSettingsModalComponent } from '../../ui/milestone-settings-modal/milestone-settings-modal.component';
import { CreateSubModuleModalComponent } from '../../ui/create-sub-module-modal/create-sub-module-modal.component';
import { ObjectiveMembersPopupComponent } from '../../ui/objective-members-popup/objective-members-popup.component';
import { SprintCreateFormComponent } from '../../ui/sprint-create-form/sprint-create-form.component';
import { SprintEditFormComponent } from '../../ui/sprint-edit-form/sprint-edit-form.component';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskDetailModalComponent } from '../../ui/task-detail-modal/task-detail-modal.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { MilestoneTreeNode, ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto, CreateObjectiveRequestDto } from '../../models/dto/milestone.dto';
import { findTreeNode, isLeafObjective, collectObjectiveOptions, pruneTreeToModule } from '../../utils/project.mapper';
import { Sprint, SprintStatus } from '../../models/sprint.model';

@Component({
  selector: 'app-milestone-tree-tab',
  standalone: true,
  imports: [
    MilestoneTreeNodeComponent, ModuleFilterSelectComponent, TreeExplanationPanelComponent, MilestoneSettingsModalComponent,
    CreateSubModuleModalComponent, ObjectiveMembersPopupComponent, SprintCreateFormComponent,
    SprintEditFormComponent, TaskCreateModalComponent, TaskDetailModalComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent, ConfirmModalComponent
  ],
  templateUrl: './milestone-tree-tab.component.html'
})
export class MilestoneTreeTabComponent {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private currentMilestoneId = '';
  private currentProjectId = '';
  private loadedProjectId: string | null = null;

  selectedModuleFilter = signal<string>('all');
  moduleFilterOptions = computed(() => {
    const tree = this.store.selectedSubtree();
    return tree ? collectObjectiveOptions(tree) : [];
  });
  renderedTree = computed(() => {
    const tree = this.store.selectedSubtree();
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
  createTaskOpen = signal(false);
  createTaskSprint = signal<MilestoneTreeNode | null>(null);
  createTaskModule = signal<MilestoneTreeNode | null>(null);
  deleteConfirmOpen = signal(false);
  pendingDeleteNode = signal<MilestoneTreeNode | null>(null);
  editSprintOpen = signal(false);
  editSprintNode = signal<MilestoneTreeNode | null>(null);
  editTaskOpen = signal(false);
  editTaskNode = signal<MilestoneTreeNode | null>(null);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((paramMap) => {
      const milestoneId = paramMap.get('milestoneId');
      if (!milestoneId) return;
      this.currentMilestoneId = milestoneId;
      this.currentProjectId = paramMap.get('id') ?? this.resolveProjectId() ?? '';
      this.selectedModuleFilter.set(milestoneId);
      this.selectedNodeId.set(null);
      void this.loadTree();
    });
  }

  onModuleFilterChanged(moduleId: string): void {
    this.selectedModuleFilter.set(moduleId);
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
      if (tree && !this.selectedNodeId()) this.selectedNodeId.set(tree.id);
      return;
    }
    await this.store.loadProjectTree(projectId);
    this.loadedProjectId = projectId;
    const tree = this.store.selectedSubtree();
    if (tree) this.selectedNodeId.set(tree.id);
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
    if ((node.kind ?? 'objective') === 'objective') {
      this.createTaskModule.set(node);
      this.createTaskSprint.set(null);
    } else {
      this.createTaskSprint.set(node);
      this.createTaskModule.set(null);
    }
    this.createTaskOpen.set(true);
  }

  async onTaskCreated(): Promise<void> {
    const sprint = this.createTaskSprint();
    const module = this.createTaskModule();
    this.createTaskOpen.set(false);
    if (sprint) {
      await this.store.loadTasksForSprint(sprint.id, { force: true });
      return;
    }
    if (module) await this.store.loadSprintsAndTasksForLeaf(module.id, { force: true });
  }

  onTaskCreateClosed(): void {
    this.createTaskOpen.set(false);
    this.createTaskSprint.set(null);
    this.createTaskModule.set(null);
  }

  createTaskObjectiveId(): string {
    return this.createTaskSprint()?.parentObjectiveId ?? this.createTaskModule()?.id ?? '';
  }

  createTaskIsOwner(): boolean {
    return this.createTaskSprint()?.isOwner ?? this.createTaskModule()?.isOwner ?? false;
  }

  createTaskSprints(): Sprint[] {
    const node = this.createTaskSprint();
    return node ? [this.sprintFromNode(node)] : [];
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
      this.editTaskNode.set(target);
      this.editTaskOpen.set(true);
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

  async onTaskSaved(): Promise<void> {
    const node = this.editTaskNode();
    this.editTaskOpen.set(false);
    this.editTaskNode.set(null);
    if (!node) return;
    const sprintId = node.taskSource?.sprintId ?? null;
    if (sprintId) {
      await this.store.loadTasksForSprint(sprintId, { force: true });
      return;
    }
    const objectiveId = node.taskSource?.objectiveId ?? node.parentObjectiveId;
    if (objectiveId) await this.store.loadSprintsAndTasksForLeaf(objectiveId, { force: true });
  }

  onTaskEditClosed(): void {
    this.editTaskOpen.set(false);
    this.editTaskNode.set(null);
  }

  async onCreateModalCreated(payload: CreateObjectiveRequestDto): Promise<void> {
    this.createModalSubmitting.set(true);
    const result = await this.store.createSubModule(payload);
    this.createModalSubmitting.set(false);
    if (result.success) {
      this.createModalOpen.set(false);
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
