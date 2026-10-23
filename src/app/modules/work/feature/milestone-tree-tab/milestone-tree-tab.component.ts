import { MeetingFormModalComponent } from '../../meetings/ui/meeting-form-modal/meeting-form-modal.component';
import { AfterViewInit, Component, OnDestroy, TemplateRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CurrentEmployeeStore } from '../../state/current-employee.store';

import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNodeComponent, TreeExpandCommand } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { WorkDropdownOption } from '../../ui/work-dropdown/work-dropdown.component';
import { HIGHLIGHT_SWATCHES, FilterBarComponent, FilterFieldConfig } from '../../../../shared/ui/filter-bar/filter-bar.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { collectNodes, computeTreeHighlight, hasActiveHighlight } from '../../utils/tree-highlight.utils';
import { TaskFormModalComponent } from '../../ui/task-form-modal/task-form-modal.component';
import { TreeExplanationPanelComponent } from '../../ui/tree-explanation-panel/tree-explanation-panel.component';
import { AllocationRequestModalComponent } from '../../ui/allocation-request-modal/allocation-request-modal.component';
import { SubModuleFormComponent } from '../../ui/sub-module-form/sub-module-form.component';
import { MemberManagementPopupComponent } from '../../ui/member-management-popup/member-management-popup.component';
import { SprintFormComponent, SprintFormModuleOption } from '../../ui/sprint-form/sprint-form.component';
import { WorkApprovalsApiService } from '../../data-access/work-approvals-api.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { SprintCompleteDialogComponent } from '../../ui/sprint-complete-dialog/sprint-complete-dialog.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ProjectNetworkViewComponent } from '../project-network-view/project-network-view.component';
import { WorkGraphNode } from '../../../people/models/work-graph.model';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { MilestoneTreeNode, ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto, CreateObjectiveRequestDto } from '../../models/dto/milestone.dto';
import { findTreeNode, isLeafObjective, collectObjectiveOptions, moduleStructureKey } from '../../utils/project.mapper';
import { Sprint, SprintStatus } from '../../models/sprint.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProjectMonitorStore } from '../../state/project-monitor.store';
import { WorkPageToolbarStore } from '../../state/work-page-toolbar.store';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { TaskAssigneeAvatarFilterComponent, TaskAssigneeAvatarMember } from '../../ui/task-assignee-avatar-filter/task-assignee-avatar-filter.component';
import { FileApiService } from '../../../../shared/data-access/file-api.service';

const ACTIVE_STATUS_OPTIONS: readonly WorkDropdownOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'achieved', label: 'Achieved' }
];
const DUE_DATE_OPTIONS: readonly WorkDropdownOption[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'due7', label: 'Due in 7 days' },
  { value: 'due30', label: 'Due in 30 days' },
  { value: 'none', label: 'No due date' }
];
const DURATION_OPTIONS: readonly WorkDropdownOption[] = [
  { value: 'lt2w', label: 'Under 2 weeks' },
  { value: '2w1m', label: '2 weeks - 1 month' },
  { value: '1m3m', label: '1 - 3 months' },
  { value: 'gt3m', label: 'Over 3 months' }
];
const ITEM_TYPE_OPTIONS: readonly WorkDropdownOption[] = [
  { value: 'objective', label: 'Module' },
  { value: 'sprint', label: 'Sprint' },
  { value: 'task', label: 'Task' }
];
const PRIORITY_OPTIONS: readonly WorkDropdownOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' }
];
const PROGRESS_OPTIONS: readonly WorkDropdownOption[] = [
  { value: '0', label: 'Not started (0%)' },
  { value: '1-50', label: '1 - 50%' },
  { value: '51-99', label: '51 - 99%' },
  { value: '100', label: 'Done (100%)' }
];

@Component({
  selector: 'app-milestone-tree-tab',
  standalone: true,
  imports: [
    MilestoneTreeNodeComponent, FilterBarComponent, TreeExplanationPanelComponent, SubModuleFormComponent,
    MemberManagementPopupComponent, SprintFormComponent, SprintCompleteDialogComponent, TaskFormModalComponent,
    LoaderComponent, ErrorStateComponent, EmptyStateComponent, ConfirmModalComponent, ButtonComponent, MeetingFormModalComponent,
    TaskAssigneeAvatarFilterComponent, AllocationRequestModalComponent, ProjectNetworkViewComponent
  ],
  templateUrl: './milestone-tree-tab.component.html'
})
export class MilestoneTreeTabComponent implements AfterViewInit, OnDestroy {
  readonly store = inject(ProjectDetailStore);
    private readonly route = inject(ActivatedRoute);
  protected readonly currentEmployee = inject(CurrentEmployeeStore);
  private readonly approvalsApi = inject(WorkApprovalsApiService);
  private readonly directory = inject(EmployeeDirectoryStore);
  private readonly taskApi = inject(TaskApiService);
  private readonly notificationService = inject(NotificationService);
  private readonly fileApi = inject(FileApiService, { optional: true });
  protected readonly monitor = inject(ProjectMonitorStore);
  private readonly toolbarStore = inject(WorkPageToolbarStore);
  private readonly toolbarTpl = viewChild.required<TemplateRef<unknown>>('toolbarTpl');

  /** The module "Request more hours" was opened for (null = closed). */
  readonly allocationNode = signal<MilestoneTreeNode | null>(null);
  readonly taskModalOpen = signal(false);
  readonly taskModalMode = signal<'create' | 'edit'>('create');
  readonly taskModalTaskId = signal('');
  readonly taskModalPrefillModule = signal('');
  readonly taskModalPrefillSprint = signal('');

  private currentMilestoneId = '';
  private currentProjectId = '';
  protected readonly projectId = signal('');
  protected readonly meetingFormOpen = signal(false);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);
  protected readonly projectRosterMembers = computed<TaskAssigneeAvatarMember[]>(() =>
    (this.store.project()?.members ?? []).map((member) => ({
      employeeId: member.userId,
      name: member.displayName,
      avatarUrl: member.avatarFileId ? this.fileApi?.getFileUrl(member.avatarFileId) ?? null : null
    }))
  );
  private loadedProjectId: string | null = null;
  private loadedMembersForProjectId: string | null = null;

  // Highlight mode: every member always sees the FULL tree - filters never prune, they only
  // tint the matching rows (and auto-expand the branches that contain them).
  readonly filterValues = signal<Record<string, string[]>>({});
  readonly ownerFilter = computed(() => this.filterValues()['owner'] ?? []);
  readonly highlightColor = signal<string>(HIGHLIGHT_SWATCHES[0]);
  readonly allExpanded = signal(false);
  readonly expandCommand = signal<TreeExpandCommand | null>(null);
  private expandSeq = 0;
  private readonly taskStatusOptions = signal<WorkDropdownOption[]>([]);
  private readonly categoryOptions = signal<WorkDropdownOption[]>([]);

  /**
   * Which view fills the tree area. The explanation card, the tabs and everything else on the page
   * are untouched by this: only the list itself gives way to the network canvas.
   */
  readonly viewMode = signal<'tree' | 'network'>('tree');

  renderedTree = computed(() => this.store.selectedSubtree());
  /** Reloads the network only when modules are added or removed - see moduleStructureKey. */
  readonly networkReloadKey = computed(() => {
    const tree = this.renderedTree();
    return tree ? moduleStructureKey(tree) : '';
  });

  readonly filterFields = computed<FilterFieldConfig[]>(() => {
    const tree = this.store.selectedSubtree();
    const modules = tree ? collectObjectiveOptions(tree).map((o) => ({ value: o.id, label: o.title })) : [];
    const sprints = tree ? collectNodes(tree, (n) => n.kind === 'sprint').map((n) => ({ value: n.id, label: n.title })) : [];
    const sprintOptions = [...new Map(sprints.map((s) => [s.value, s])).values()];
    const people = this.assignableMembers().map((m) => ({ value: m.employeeId, label: m.name }));
    return [
      { key: 'module', label: 'Module', icon: 'module', kind: 'multi', options: modules },
      { key: 'owner', label: 'Owner', icon: 'people', kind: 'multi', options: people },
      { key: 'activeStatus', label: 'Active', icon: 'status', kind: 'multi', options: ACTIVE_STATUS_OPTIONS },
      { key: 'dueDate', label: 'Due date', icon: 'calendar', kind: 'multi', options: DUE_DATE_OPTIONS },
      { key: 'duration', label: 'Duration', icon: 'calendar', kind: 'multi', options: DURATION_OPTIONS },
      { key: 'itemType', label: 'Item type', icon: 'category', kind: 'multi', options: ITEM_TYPE_OPTIONS },
      { key: 'sprint', label: 'Sprint', icon: 'sprint', kind: 'multi', options: sprintOptions },
      { key: 'taskStatus', label: 'Task status', icon: 'status', kind: 'multi', options: this.taskStatusOptions() },
      { key: 'priority', label: 'Priority', icon: 'priority', kind: 'multi', options: PRIORITY_OPTIONS },
      { key: 'category', label: 'Category', icon: 'category', kind: 'multi', options: this.categoryOptions() },
      { key: 'progress', label: 'Progress', icon: 'status', kind: 'multi', options: PROGRESS_OPTIONS }
    ];
  });

  readonly searchTerm = signal('');
  readonly searchExpanded = signal(false);
  // Search is just one more highlight criterion (title contains), ANDed with the filter bar.
  private readonly highlightValues = computed(() => ({ ...this.filterValues(), search: [this.searchTerm()] }));
  readonly highlightActive = computed(() => hasActiveHighlight(this.highlightValues()));
  readonly highlight = computed(() => {
    const tree = this.renderedTree();
    if (!tree) return { matchedKeys: new Set<string>(), ancestorKeys: new Set<string>() };
    return computeTreeHighlight(tree, this.highlightValues(), new Date());
  });
  readonly matchCount = computed(() => this.highlight().matchedKeys.size);
  readonly canCreateModule = computed(() => this.renderedTree()?.isOwner ?? false);

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
  // Not modal-scoped: onCreateModalCreated can close the create dialog and still need to
  // warn about partial asset-upload failures, so this renders inline in the tab itself
  // rather than inside any modal (which would already be closed by then).
  createAssetWarning = signal<string | null>(null);

  membersPopupOpen = signal(false);

  createSprintOpen = signal(false);
  createSprintNode = signal<MilestoneTreeNode | null>(null);
  deleteConfirmOpen = signal(false);
  pendingDeleteNode = signal<MilestoneTreeNode | null>(null);
  /** The shared delete confirm is showing for a sprint (not a task). */
  protected readonly deletingSprint = computed(() => this.pendingDeleteNode()?.kind === 'sprint');
  editSprintOpen = signal(false);
  editSprintNode = signal<MilestoneTreeNode | null>(null);
  completingSprintNode = signal<MilestoneTreeNode | null>(null);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((paramMap) => {
      const milestoneId = paramMap.get('milestoneId');
      if (!milestoneId) return;
      this.currentMilestoneId = milestoneId;
      this.currentProjectId = paramMap.get('id') ?? this.resolveProjectId() ?? '';
      this.projectId.set(this.currentProjectId);
      // Every active project member sees the FULL objective tree. The routed milestone only
      // preselects a node for the detail panel - it does NOT scope what the tree shows. The
      // per-node isOwner flag still gates the editing tools.
      this.selectedNodeId.set(milestoneId);
      const openMembersOnLoad = this.route.snapshot.queryParamMap.get('openMembers') === '1';
      void this.loadTree().then(() => {
        if (openMembersOnLoad) this.onMembersRequested();
      });
      void this.currentEmployee.ensureLoaded();
      if (this.currentProjectId && this.loadedMembersForProjectId !== this.currentProjectId) {
        this.loadedMembersForProjectId = this.currentProjectId;
        void this.loadAssignableMembers(this.currentProjectId);
        void this.loadFilterOptions(this.currentProjectId);
      }
    });

    // Reveal matches hidden in collapsed branches. Skipped while "Expand all" is on - everything is open anyway.
    effect(() => {
      const { matchedKeys, ancestorKeys } = this.highlight();
      if (matchedKeys.size === 0) return;
      untracked(() => {
        if (this.allExpanded()) return;
        this.expandCommand.set({ seq: ++this.expandSeq, mode: 'keys', keys: ancestorKeys });
      });
    });
  }

  ngAfterViewInit(): void {
    this.toolbarStore.setTemplate(this.toolbarTpl());
  }

  ngOnDestroy(): void {
    this.toolbarStore.setTemplate(null);
  }

  private async loadAssignableMembers(projectId: string): Promise<void> {
    try {
      await this.store.loadProjectMembers(projectId);
      const members = this.store.projectMembers();
      // Pre-warms the shared EmployeeDirectoryStore cache with these server-resolved (coverage-safe)
      // names so task-assignee avatars in the tree (<app-employee-avatar>, which otherwise falls back
      // to the management-coverage-scoped GET /employees/{id}) resolve without 403-ing for assignees
      // outside the viewer's reporting chain. Same fix as TaskBoardComponent's employeeNames/directory
      // pre-warm - see project_hrms_board_backlog_project_wide memory, bug #5.
      await this.directory.ensureLoaded(members.map((member) => member.employeeId));
      this.assignableMembers.set(members.map((member) => ({
        employeeId: member.employeeId,
        name: member.name ?? 'Unknown employee'
      })));
    } catch {
      this.assignableMembers.set([]);
    }
  }

  onFilterFieldChanged(event: { key: string; values: string[] }): void {
    this.filterValues.update((current) => ({ ...current, [event.key]: event.values }));
    // Sprints/tasks are lazy-loaded per leaf; task-level fields (status, priority, assignee...)
    // can only match what's loaded, so an active filter pulls the whole tree in once.
    if (this.highlightActive()) void this.loadWholeTree();
  }

  setOwnerFilter(employeeIds: string[]): void {
    this.onFilterFieldChanged({ key: 'owner', values: employeeIds });
  }

  toggleSearch(): void {
    this.searchExpanded.update((expanded) => !expanded);
    if (!this.searchExpanded()) this.onSearchChanged('');
  }

  onSearchChanged(term: string): void {
    this.searchTerm.set(term);
    if (this.highlightActive()) void this.loadWholeTree();
  }

  onHighlightColorChanged(color: string): void {
    this.highlightColor.set(color);
  }

  toggleExpandAll(): void {
    const expand = !this.allExpanded();
    this.allExpanded.set(expand);
    this.expandCommand.set({ seq: ++this.expandSeq, mode: expand ? 'all' : 'none' });
    if (expand) void this.loadWholeTree();
  }

  private async loadWholeTree(): Promise<void> {
    const tree = this.store.selectedSubtree();
    if (!tree) return;
    await Promise.all(collectNodes(tree, isLeafObjective).map((leaf) => this.store.loadSprintsAndTasksForLeaf(leaf.id)));
    const loaded = this.store.selectedSubtree();
    if (!loaded) return;
    await Promise.all(collectNodes(loaded, (n) => n.kind === 'sprint').map((sprint) => this.store.loadTasksForSprint(sprint.id)));
  }

  private async loadFilterOptions(projectId: string): Promise<void> {
    try {
      const [statuses, categories] = await Promise.all([
        firstValueFrom(this.taskApi.getStatuses(projectId)),
        firstValueFrom(this.taskApi.getCategories(projectId))
      ]);
      this.taskStatusOptions.set(statuses.map((s) => ({ value: s.id, label: s.name })));
      this.categoryOptions.set(categories.map((c) => ({ value: c.id, label: c.name })));
    } catch {
      this.taskStatusOptions.set([]);
      this.categoryOptions.set([]);
    }
  }

  onNodeSelected(node: MilestoneTreeNode): void {
    this.selectedNodeId.set(node.id);
  }

  /**
   * A module, sprint or task clicked in the network: the explanation card beside it shows that
   * node, the same card the tree list uses. Graph ids are "<kind>:<id>"; tree ids are the bare id.
   * Sprints and tasks are lazy-loaded into the tree, so one that is not there yet pulls the whole
   * tree in first (falling back to its module if it still cannot be found).
   */
  async onNetworkNodeSelected(node: WorkGraphNode): Promise<void> {
    const id = node.id.slice(node.id.indexOf(':') + 1);
    const inTree = () => {
      const tree = this.store.selectedSubtree();
      return tree ? findTreeNode(tree, id) !== null : false;
    };
    if (!inTree() && node.kind !== 'module') await this.loadWholeTree();
    if (inTree()) this.selectedNodeId.set(id);
    else if (node.objectiveId) this.selectedNodeId.set(node.objectiveId);
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
    // Project monitor alerts (red marks) are advisory; load them alongside the tree without waiting.
    void this.monitor.load(projectId);
    await this.store.loadProjectTree(projectId);
    this.loadedProjectId = projectId;
    const tree = this.store.selectedSubtree();
    // Fall back to the root only when the routed milestone isn't in this project's tree.
    if (tree && !findTreeNode(tree, this.selectedNodeId() ?? '')) this.selectedNodeId.set(tree.id);
  }

  onCreateSubRequested(node: MilestoneTreeNode): void {
    this.createModalParentId.set(node.id);
    this.createModalOpen.set(true);
    // Clear any leftover warning from a previous create flow so it can't leak onto
    // this unrelated dialog.
    this.createAssetWarning.set(null);
  }

  onCreateModuleRequested(): void {
    const root = this.renderedTree();
    if (!root?.isOwner) return;
    this.onCreateSubRequested(root);
  }

  dismissCreateAssetWarning(): void {
    this.createAssetWarning.set(null);
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

  /** In-place edit inside the still-open task modal (e.g. a subtask change): refresh, keep it open. */
  async onTaskModalChanged(): Promise<void> {
    await this.loadTree({ force: true });
  }

  // Sprints are now project-level (Independent Sprints), so <app-sprint-form> no longer takes
  // a single objectiveId/isObjectiveOwner pair - it takes a `modules` list for its task picker
  // to know which module(s) are pickable/owned. For create, node is the module (leaf objective)
  // the sprint is being created under. For edit, node is the sprint itself, so we resolve its
  // owning module via parentObjectiveId and look up that module's real title/ownership in the
  // tree (falling back to the sprint node's own fields if the module can't be found).
  sprintFormModules(node: MilestoneTreeNode): SprintFormModuleOption[] {
    const objectiveId = node.kind === 'sprint' ? (node.parentObjectiveId ?? '') : node.id;
    const tree = this.store.selectedSubtree();
    const moduleNode = tree ? findTreeNode(tree, objectiveId) : null;
    return [{
      objectiveId,
      title: moduleNode?.title ?? node.title,
      isEffectiveOwner: (moduleNode?.isOwner ?? node.isOwner) ?? false
    }];
  }

  // `sprintFormModules`/`sprintFromNode` build a NEW array/object every call, so binding
  // them directly in the template (e.g. `[modules]="sprintFormModules(sprintNode)"`) makes
  // <app-sprint-form> see a new `sprint`/`modules` reference on every change-detection pass.
  // In edit mode, SprintFormComponent's constructor effect resets its form and re-fetches
  // current tasks whenever `sprint()` changes identity - so every CD tick was discarding
  // in-progress form edits. These computeds only recompute when the underlying node signal
  // actually changes identity, keeping the bound value referentially stable across CD passes.
  createSprintModules = computed<SprintFormModuleOption[]>(() => {
    const node = this.createSprintNode();
    return node ? this.sprintFormModules(node) : [];
  });

  editSprintModel = computed<Sprint | null>(() => {
    const node = this.editSprintNode();
    return node ? this.sprintFromNode(node) : null;
  });

  editSprintModules = computed<SprintFormModuleOption[]>(() => {
    const node = this.editSprintNode();
    return node ? this.sprintFormModules(node) : [];
  });

  sprintFromNode(node: MilestoneTreeNode): Sprint {
    return {
      id: node.id,
      projectId: this.projectId(),
      name: node.title,
      goal: null,
      startDate: node.startDate ? new Date(node.startDate) : null,
      endDate: node.endDate ? new Date(node.endDate) : null,
      status: (node.status as SprintStatus) ?? 'active',
      completedAt: null,
      achievedAt: null,
      canManage: node.isOwner ?? false
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
        // milestoneActionError only has render surfaces inside modals, and the create
        // modal is closing right now — use the non-modal-scoped signal instead so the
        // warning is actually visible, and doesn't leak into a later, unrelated dialog.
        this.createAssetWarning.set(
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
    if (editResult.pending) {
      this.notificationService.info('Request submitted.');
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
    const result = await this.store.achieveSprint(node.id);
    if (result.pending) this.notificationService.info('Sprint change sent for approval.');
  }

  onCompleteSprintRequested(node: MilestoneTreeNode): void {
    this.completingSprintNode.set(node);
  }

  onSprintCompleteDialogClosed(): void {
    this.completingSprintNode.set(null);
  }

  async onSprintCompleteDialogCompleted(): Promise<void> {
    this.completingSprintNode.set(null);
    await this.loadTree({ force: true });
  }

  onDeleteRequested(node: MilestoneTreeNode): void {
    this.pendingDeleteNode.set(node);
    this.deleteConfirmOpen.set(true);
  }

  async onDeleteConfirmed(): Promise<void> {
    const node = this.pendingDeleteNode();
    if (!node) return;
    if (node.kind === 'sprint') {
      const sprintResult = await this.store.deleteSprint(node.id);
      if (!sprintResult.success) return;
      if (sprintResult.pending) this.notificationService.info('Sprint deletion sent for approval.');
      else if (this.selectedNodeId() === node.id) this.selectedNodeId.set(null);
      this.deleteConfirmOpen.set(false);
      this.pendingDeleteNode.set(null);
      return;
    }
    const result = await this.store.deleteTask(node.id);
    if (!result.success) return;
    if (result.pendingApproval) {
      this.notificationService.info('Task deletion sent for approval.');
      this.deleteConfirmOpen.set(false);
      this.pendingDeleteNode.set(null);
      return;
    }
    if (this.selectedNodeId() === node.id) this.selectedNodeId.set(null);
    this.deleteConfirmOpen.set(false);
    this.pendingDeleteNode.set(null);
  }

  onDeleteCancelled(): void {
    this.deleteConfirmOpen.set(false);
    this.pendingDeleteNode.set(null);
  }

  onAllocationRequested(node: MilestoneTreeNode): void {
    this.allocationNode.set(node);
  }

  async onAllocationSubmitted(): Promise<void> {
    this.allocationNode.set(null);
    this.notificationService.success('Request sent');
    await this.loadTree({ force: true });
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
    const result = await this.store.addObjectiveMember(node.id, employeeId);
    if (result.pending) this.notificationService.info('Member add sent for approval.');
    await this.store.loadObjectiveMembers(node.id);
  }

  async onRemoveMemberRequested(employeeId: string): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    const result = await this.store.removeObjectiveMember(node.id, employeeId);
    if (result.pending) this.notificationService.info('Member removal sent for approval.');
    await this.store.loadObjectiveMembers(node.id);
  }

  async onTransferRequested(employeeId: string): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    await this.store.transferObjectiveHead(node.id, employeeId);
    await this.store.loadObjectiveMembers(node.id);
  }

  async onInvitationAcceptRequested(invitationId: string): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    await firstValueFrom(this.approvalsApi.acceptObjectiveInvitation(invitationId));
    await this.store.loadObjectiveMembers(node.id);
  }

  async onInvitationDeclineRequested(invitationId: string): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    await firstValueFrom(this.approvalsApi.rejectObjectiveInvitation(invitationId));
    await this.store.loadObjectiveMembers(node.id);
  }
}
