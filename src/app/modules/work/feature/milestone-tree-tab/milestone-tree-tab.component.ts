import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { MilestoneDetailPanelComponent } from '../../ui/milestone-detail-panel/milestone-detail-panel.component';
import { MilestoneSettingsModalComponent } from '../../ui/milestone-settings-modal/milestone-settings-modal.component';
import { CreateSubModuleModalComponent } from '../../ui/create-sub-module-modal/create-sub-module-modal.component';
import { ObjectiveMembersPopupComponent } from '../../ui/objective-members-popup/objective-members-popup.component';
import { SprintCreateFormComponent } from '../../ui/sprint-create-form/sprint-create-form.component';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { MilestoneTreeNode, ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto, CreateObjectiveRequestDto } from '../../models/dto/milestone.dto';
import { findTreeNode, isLeafObjective } from '../../utils/project.mapper';
import { Sprint, SprintStatus } from '../../models/sprint.model';

@Component({
  selector: 'app-milestone-tree-tab',
  standalone: true,
  imports: [
    MilestoneTreeNodeComponent, MilestoneDetailPanelComponent, MilestoneSettingsModalComponent,
    CreateSubModuleModalComponent, ObjectiveMembersPopupComponent, SprintCreateFormComponent,
    TaskCreateModalComponent, LoaderComponent, ErrorStateComponent
  ],
  templateUrl: './milestone-tree-tab.component.html'
})
export class MilestoneTreeTabComponent {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private currentMilestoneId = '';

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

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((paramMap) => {
      const milestoneId = paramMap.get('milestoneId');
      if (!milestoneId) return;
      this.currentMilestoneId = milestoneId;
      this.selectedNodeId.set(null);
      this.loadSubtreeAndSelectRoot(milestoneId);
    });
  }

  onNodeSelected(node: MilestoneTreeNode): void {
    this.selectedNodeId.set(node.id);
  }

  async retryTree(): Promise<void> {
    if (this.currentMilestoneId) await this.loadSubtreeAndSelectRoot(this.currentMilestoneId);
  }

  private async loadSubtreeAndSelectRoot(milestoneId: string): Promise<void> {
    await this.store.loadMilestoneSubtree(milestoneId);
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
    this.createTaskSprint.set(node);
    this.createTaskOpen.set(true);
  }

  async onTaskCreated(): Promise<void> {
    const sprint = this.createTaskSprint();
    this.createTaskOpen.set(false);
    if (sprint) await this.store.loadTasksForSprint(sprint.id, { force: true });
  }

  onTaskCreateClosed(): void {
    this.createTaskOpen.set(false);
    this.createTaskSprint.set(null);
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

  async onCreateModalCreated(payload: CreateObjectiveRequestDto): Promise<void> {
    this.createModalSubmitting.set(true);
    const result = await this.store.createSubModule(payload);
    this.createModalSubmitting.set(false);
    if (result.success) {
      this.createModalOpen.set(false);
      await this.store.loadMilestoneSubtree(this.currentMilestoneId);
    }
  }

  async onAchieveToggleRequested(): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    const result = node.isAchieved
      ? await this.store.unachieveMilestone(node.id)
      : await this.store.achieveMilestone(node.id);
    if (result.success) {
      await this.store.loadMilestoneSubtree(this.currentMilestoneId);
    }
  }

  async onEditRequested(): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    this.settingsOpen.set(true);
    const detail = await this.store.getMilestoneDetail(node.id);
    if (detail && this.selectedNode()?.id === node.id) {
      this.settingsInitialValue.set(detail);
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
    await this.store.loadMilestoneSubtree(this.currentMilestoneId);
  }

  onMembersRequested(): void {
    const node = this.selectedNode();
    if (!node) return;
    this.membersPopupOpen.set(true);
    this.store.loadObjectiveMembers(node.id);
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
