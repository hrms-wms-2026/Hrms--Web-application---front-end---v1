import { AfterViewInit, Component, OnDestroy, OnInit, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { CurrentEmployeeStore } from '../../state/current-employee.store';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { WorkPageToolbarStore } from '../../state/work-page-toolbar.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { SprintListStore } from '../../state/sprint-list.store';
import { TaskApiService } from '../../data-access/task-api.service';
import { SprintTabComponent } from '../../ui/sprint-tab/sprint-tab.component';
import { SprintFormComponent } from '../../ui/sprint-form/sprint-form.component';
import { TaskTableComponent } from '../../ui/task-table/task-table.component';
import { WorkTask } from '../../models/task.model';
import { Sprint, SprintStatus } from '../../models/sprint.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { toTaskCategoryColumn } from '../../utils/task-category.mapper';
import { WorkDropdownOption } from '../../ui/work-dropdown/work-dropdown.component';
import { TaskFilterBarComponent, TaskFilterFieldConfig } from '../../ui/task-filter-bar/task-filter-bar.component';
import { TaskAssigneeAvatarFilterComponent, TaskAssigneeAvatarMember } from '../../ui/task-assignee-avatar-filter/task-assignee-avatar-filter.component';
import { FileApiService } from '../../../../shared/data-access/file-api.service';
import { TaskFormModalComponent } from '../../ui/task-form-modal/task-form-modal.component';
import { SprintStartDialogComponent } from '../../ui/sprint-start-dialog/sprint-start-dialog.component';
import { SprintCompleteDialogComponent } from '../../ui/sprint-complete-dialog/sprint-complete-dialog.component';
import { MoveTasksToSprintDialogComponent, SprintMoveTarget } from '../../ui/move-tasks-to-sprint-dialog/move-tasks-to-sprint-dialog.component';
import { toEditTaskRequest } from '../../utils/task.mapper';
import { isPendingApproval } from '../../models/dto/work-approval.dto';

@Component({
  selector: 'app-task-backlog',
  standalone: true,
  imports: [SprintTabComponent, SprintFormComponent, TaskTableComponent, ButtonComponent, ErrorStateComponent, TaskFilterBarComponent, TaskAssigneeAvatarFilterComponent, TaskFormModalComponent, SprintStartDialogComponent, SprintCompleteDialogComponent, MoveTasksToSprintDialogComponent],
  template: `
    <ng-template #toolbarTpl>
      <div class="task-backlog__toolbar">
        <app-task-assignee-avatar-filter
          [members]="projectRosterMembers()"
          [currentEmployeeId]="currentEmployee.id()"
          [selected]="assigneeFilter()"
          (selectionChanged)="setAssigneeFilter($event)"
        />
        <app-task-filter-bar [fields]="filterFields()" [values]="filterValues()" (fieldChanged)="onFilterFieldChanged($event)" />
        @if (modules().length > 0) {
          <app-button variant="secondary" (pressed)="openCreateTask()">Create work item</app-button>
        }
        @if (modules().length > 0) {
          <app-button variant="primary" (pressed)="createSprintOpen.set(true)">Create Sprint</app-button>
        }
      </div>
    </ng-template>

    @if (createSprintOpen() && modules().length > 0) {
        <app-sprint-form
          mode="create"
          [open]="createSprintOpen()"
          [projectId]="projectId()"
          [modules]="sprintFormModules()"
          [allSprints]="sprintStore.sprints()"
          (created)="onSprintCreated()"
          (cancelled)="createSprintOpen.set(false)"
        />
    }
    @if (editingSprint(); as sprint) {
      <app-sprint-form
        mode="edit"
        [open]="true"
        [projectId]="projectId()"
        [modules]="sprintFormModules()"
        [allSprints]="sprintStore.sprints()"
        [sprint]="sprint"
        (saved)="onSprintEdited()"
        (cancelled)="editingSprint.set(null)"
      />
    }
    @if (startingSprint(); as sprint) {
      <app-sprint-start-dialog
        [open]="true"
        [sprint]="sprint"
        [tasks]="tasksForSprint(sprint.id)"
        [projectId]="projectId()"
        (started)="onSprintStarted()"
        (cancelled)="startingSprint.set(null)"
      />
    }
    @if (completingSprint(); as sprint) {
      <app-sprint-complete-dialog
        [open]="true"
        [sprint]="sprint"
        [tasks]="tasksForSprint(sprint.id)"
        [otherSprints]="otherSprintsForCompleting()"
        [projectId]="projectId()"
        [completeStatusIds]="completeStatusIds()"
        (completed)="onSprintCompleted()"
        (cancelled)="completingSprint.set(null)"
      />
    }

    @if (sprintStore.error()) {
      <p class="task-backlog__sprint-message" role="alert">{{ sprintStore.error() }}</p>
    }

    @if (store.loading() || sprintStore.loading()) {
      <p>Loading…</p>
    } @else if (store.error()) {
      <app-error-state [message]="store.error()!" [retryable]="true" (retry)="reloadTasks()" />
    } @else {
      @if (filteredSprints().length > 0) {
        <div class="task-backlog__sprints">
          <h3 class="task-backlog__sprints-title">Sprint</h3>
          @for (sprint of filteredSprints(); track sprint.id) {
            <app-sprint-tab
              [sprint]="sprint"
              [canManage]="sprint.canManage"
              [tasks]="tasksForSprint(sprint.id)"
              [statusNames]="statusNames()"
              [categoryNames]="categoryNames()"
              [moduleNames]="moduleNames()"
              [statuses]="store.statuses()"
              [objectiveOwners]="objectiveOwners()"
              [currentEmployeeId]="currentEmployee.id()"
              [expanded]="expandedSprintId() === sprint.id"
              (toggled)="toggleExpanded(sprint.id)"
              (editRequested)="editingSprint.set(sprint)"
              (startRequested)="startingSprint.set(sprint)"
              (completeRequested)="completingSprint.set(sprint)"
              (createTaskRequested)="openCreateTask(sprint)"
              (taskViewed)="onTaskViewed($event)"
              (taskStatusChangeRequested)="onTaskStatusChangeRequested($event)"
              (taskChanged)="reloadTasks()"
            />
          }
        </div>
      }

      @if (unsortedTasks().length > 0) {
        <div class="task-backlog__unsorted">
          @if (selectedTaskIds().size > 0) {
            <div class="task-backlog__selection-toolbar">
              <span class="task-backlog__selection-count">{{ selectedTaskIds().size }} task{{ selectedTaskIds().size === 1 ? '' : 's' }} selected</span>
              <app-button variant="primary" (pressed)="moveDialogOpen.set(true)">Move selected to sprint</app-button>
              <button type="button" class="task-backlog__selection-clear" aria-label="Clear selection" title="Clear selection" (click)="clearSelection()">&#x2715;</button>
            </div>
          } @else {
            <div class="task-backlog__unsorted-header">
              <svg class="task-backlog__unsorted-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              <h3 class="task-backlog__unsorted-title">Backlog</h3>
              <span class="task-backlog__unsorted-summary">{{ unsortedTasks().length }} task{{ unsortedTasks().length === 1 ? '' : 's' }} · {{ unsortedTotalHours() }}h</span>            </div>
          }
          <app-task-table
            [tasks]="unsortedTasks()"
            [statusNames]="statusNames()"
            [categoryNames]="categoryNames()"
            [moduleNames]="moduleNames()"
            [statuses]="store.statuses()"
            [objectiveOwners]="objectiveOwners()"
            [currentEmployeeId]="currentEmployee.id()"
            [selectable]="true"
            [selectedIds]="selectedTaskIds()"
            (viewed)="onTaskViewed($event)"
            (taskChanged)="reloadTasks()"
            (statusChangeRequested)="onTaskStatusChangeRequested($event)"
            (selectionChanged)="onTaskSelectionChanged($event)"
            (selectAllChanged)="onSelectAllChanged($event)"
          />
        </div>
      }
    }

    @if (moveUndoBanner(); as banner) {
      <div class="task-backlog__undo-banner" role="status">
        <span>{{ banner.message }}</span>
        <button type="button" class="task-backlog__undo-action" (click)="undoMove()">Undo</button>
      </div>
    }

    <app-move-tasks-to-sprint-dialog
      [open]="moveDialogOpen()"
      [taskCount]="selectedTaskIds().size"
      [totalEstimatedHours]="selectedTasksTotalHours()"
      [targets]="moveTargets()"
      [blockedReason]="moveBlockedReason()"
      [submitting]="movingTasks()"
      [error]="moveError()"
      (moved)="onTasksMoved($event)"
      (cancelled)="moveDialogOpen.set(false)"
    />

    <app-task-form-modal
      [open]="taskModalOpen()"
      [mode]="taskModalMode()"
      [projectId]="projectId()"
      [taskId]="taskModalTaskId()"
      [prefillModuleId]="modalPrefillModuleId()"
      [prefillSprintId]="modalPrefillSprintId()"
      (created)="onTaskModalDone()"
      (saved)="onTaskModalDone()"
      (changed)="reloadTasks()"
      (closed)="closeTaskModal()"
    />
  `,
  styles: [`
    .task-backlog__toolbar { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; }
    /* Match the Filter trigger (30px tall, 8px radius) so the toolbar reads as one row. */
    .task-backlog__toolbar ::ng-deep app-button > button { width: auto; height: 30px; padding: 0 12px; border-radius: 8px; font-size: 13px; }
    .task-backlog__sprint-message { color: var(--color-danger-text, var(--color-danger)); font-size: 12px; margin-bottom: 8px; }
    .task-backlog__sprints { margin-top: 4px; }
    .task-backlog__sprints-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 10px; }
    .task-backlog__unsorted { margin-top: 18px; }
    .task-backlog__unsorted-header { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; }
    .task-backlog__unsorted-icon { width: 15px; height: 15px; flex: 0 0 auto; color: var(--color-text-secondary); fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .task-backlog__unsorted-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
    .task-backlog__unsorted-summary { font-size: 11px; color: var(--color-text-secondary); }    .task-backlog__selection-toolbar { display: flex; align-items: center; gap: 10px; margin: 0 0 10px; padding: 8px 12px; border: 1px solid var(--color-accent); border-radius: 10px; background: var(--color-surface-secondary); }
    .task-backlog__selection-toolbar ::ng-deep app-button > button { width: auto; }
    .task-backlog__selection-count { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .task-backlog__selection-clear { margin-left: auto; border: none; background: none; color: var(--color-text-secondary); cursor: pointer; font-size: 14px; line-height: 1; padding: 4px; }
    .task-backlog__selection-clear:hover { color: var(--color-text-primary); }
    .task-backlog__undo-banner { display: flex; align-items: center; gap: 12px; margin-top: 12px; padding: 10px 14px; border-radius: 10px; background: var(--color-text-primary); color: var(--color-surface); font-size: 13px; }
    .task-backlog__undo-action { border: none; background: none; color: var(--color-accent-light, var(--color-accent)); font-weight: 600; cursor: pointer; font-size: 13px; padding: 0; }
    .task-backlog__undo-action:hover { text-decoration: underline; }
  `]
})
export class TaskBacklogComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly store = inject(TaskBoardStore);
  protected readonly sprintStore = inject(SprintListStore);
  protected readonly projectStore = inject(ProjectDetailStore);
  private readonly fileApi = inject(FileApiService, { optional: true });
  private readonly toolbarStore = inject(WorkPageToolbarStore);
  private readonly toolbarTpl = viewChild.required<TemplateRef<unknown>>('toolbarTpl');
  private readonly taskApi = inject(TaskApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly currentEmployee = inject(CurrentEmployeeStore);

  protected readonly createSprintOpen = signal(false);
  protected readonly editingSprint = signal<Sprint | null>(null);
  protected readonly startingSprint = signal<Sprint | null>(null);
  protected readonly completingSprint = signal<Sprint | null>(null);
  protected readonly selectedTaskIds = signal<ReadonlySet<string>>(new Set());
  protected readonly moveDialogOpen = signal(false);
  protected readonly movingTasks = signal(false);
  protected readonly moveError = signal<string | null>(null);
  protected readonly moveUndoBanner = signal<{ message: string } | null>(null);
  private undoBannerTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMove: { taskId: string; previousSprintId: string | null }[] = [];
  protected readonly projectId = signal('');
  protected readonly expandedSprintId = signal<string | null>(null);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string; avatarUrl: string | null }[]>([]);
  // Everyone on the project, unscoped by which milestones the viewer can reach - the roster
  // shown in the toolbar avatar stack. Deliberately separate from assignableMembers above,
  // which stays scoped for the actual task-assignment flows.
  protected readonly projectRosterMembers = computed<TaskAssigneeAvatarMember[]>(() =>
    (this.projectStore.project()?.members ?? []).map((member) => ({
      employeeId: member.userId,
      name: member.displayName,
      avatarUrl: member.avatarFileId ? this.fileApi?.getFileUrl(member.avatarFileId) ?? null : null
    }))
  );
  protected readonly sprintStatusFilter = signal<'all' | SprintStatus>('all');
  protected readonly objectiveFilter = signal<string[]>([]);
  protected readonly categoryFilter = signal<string[]>([]);
  protected readonly assigneeFilter = signal<string[]>([]);
  protected readonly statusFilter = signal<string[]>([]);
  protected readonly priorityFilter = signal<string[]>([]);
  protected readonly categories = signal<TaskCategoryColumn[]>([]);
  protected readonly sprintStatusOptions: readonly WorkDropdownOption[] = [
    { value: 'all', label: 'All sprint statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'complete', label: 'Complete' },
    { value: 'achieved', label: 'Achieved' }
  ];

  constructor() {
    // Switching projects via the breadcrumb switcher navigates to a sibling route matching the
    // same path shape (/work/:id/backlog) - Angular reuses this component instance rather than
    // re-instantiating it, so the :id param must be watched reactively, not just read once.
    const paramMap$ = this.route.paramMap ?? of(this.route.snapshot?.paramMap);
    paramMap$
      .pipe(
        map((paramMap) => paramMap?.get('id') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe((projectId) => {
        this.projectId.set(projectId);
        if (!projectId) return;
        void this.store.loadBoard(projectId);
        void this.sprintStore.loadForProject(projectId);
        void this.loadCategories(projectId);
        void this.loadAssignableMembers(projectId);
      });
  }

  protected readonly modules = computed(() => this.projectStore.milestones());
  protected readonly objectiveOwners = computed(() =>
    Object.fromEntries(this.modules().map((module) => [module.objectiveId, module.isOwner]))
  );
  // Sprints are project-level, so any member may create one; the module picker inside the form
  // still restricts which modules' tasks can be added, per module ownership.
  protected readonly sprintFormModules = computed(() =>
    this.modules().map((m) => ({ objectiveId: m.objectiveId, title: m.title, isEffectiveOwner: m.isEffectiveOwner }))
  );
  protected readonly objectiveOptions = computed<WorkDropdownOption[]>(() =>
    this.modules().map((module) => ({ value: module.objectiveId, label: module.title }))
  );
  protected readonly categoryOptions = computed<WorkDropdownOption[]>(() =>
    this.categories().map((category) => ({ value: category.id, label: category.name }))
  );
  protected readonly statusOptions = computed<WorkDropdownOption[]>(() =>
    this.store.statuses().map((status) => ({ value: status.id, label: status.name }))
  );
  protected readonly priorityOptions: readonly WorkDropdownOption[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' }
  ];
  protected readonly filterFields = computed<TaskFilterFieldConfig[]>(() => [
    { key: 'module', label: 'Module', icon: 'module', kind: 'multi', options: this.objectiveOptions() },
    { key: 'category', label: 'Category', icon: 'category', kind: 'multi', options: this.categoryOptions() },
    { key: 'assignee', label: 'Assignee', icon: 'people', kind: 'multi', options: this.assigneeFilterOptions() },
    { key: 'sprintStatus', label: 'Sprint status', icon: 'sprint', kind: 'single', options: this.sprintStatusOptions, defaultValues: ['all'] },
    { key: 'status', label: 'Status', icon: 'status', kind: 'multi', options: this.statusOptions() },
    { key: 'priority', label: 'Priority', icon: 'priority', kind: 'multi', options: this.priorityOptions }
  ]);
  protected readonly filterValues = computed<Record<string, string[]>>(() => ({
    module: this.objectiveFilter(),
    category: this.categoryFilter(),
    assignee: this.assigneeFilter(),
    sprintStatus: [this.sprintStatusFilter()],
    status: this.statusFilter(),
    priority: this.priorityFilter()
  }));
  protected readonly statusNames = computed(() => Object.fromEntries(this.store.statuses().map((status) => [status.id, status.name])));
  protected readonly categoryNames = computed(() => Object.fromEntries(this.categories().map((category) => [category.id, category.name])));
  protected readonly moduleNames = computed(() => Object.fromEntries(this.modules().map((module) => [module.objectiveId, module.title])));
  protected readonly completeStatusIds = computed(() =>
    new Set(this.store.statuses().filter((s) => s.marksTaskComplete).map((s) => s.id))
  );
  protected readonly otherSprintsForCompleting = computed(() => {
    const target = this.completingSprint();
    if (!target) return [];
    return this.sprintStore.sprints().filter((s) =>
      s.id !== target.id && s.status !== 'complete' && s.status !== 'achieved'
    );
  });
  protected readonly filteredSprints = computed(() => {
    const filter = this.sprintStatusFilter();
    const statusOrder: Record<string, number> = { active: 0, draft: 1, complete: 2, achieved: 3 };
    const list = filter === 'all' ? this.sprintStore.sprints() : this.sprintStore.sprints().filter((sprint) => sprint.status === filter);
    return [...list].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
  });
  protected readonly unsortedTasks = computed(() => {
    const knownSprintIds = new Set(this.sprintStore.sprints().map((sprint) => sprint.id));
    return this.filteredTasks().filter((task) => task.sprintId == null || !knownSprintIds.has(task.sprintId));
  });
  protected readonly unsortedTotalHours = computed(() =>
    this.unsortedTasks().reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0)
  );

  protected readonly selectedTasks = computed(() => {
    const ids = this.selectedTaskIds();
    return this.unsortedTasks().filter((task) => ids.has(task.id));
  });
  protected readonly selectedTasksTotalHours = computed(() =>
    this.selectedTasks().reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0)
  );
  private readonly ownedObjectiveIds = computed(() =>
    new Set(this.modules().filter((m) => m.isEffectiveOwner).map((m) => m.objectiveId)));
  // Sprints are project-level: any Draft/Active sprint is a valid target, but only for tasks
  // whose module the user owns (backend SprintTaskAssignment/EditTask enforce the same rule).
  protected readonly moveBlockedReason = computed(() =>
    this.selectedTasks().some((task) => !this.ownedObjectiveIds().has(task.objectiveId))
      ? 'You can only move tasks from modules you own.' : null);
  protected readonly moveTargets = computed<SprintMoveTarget[]>(() => {
    if (this.selectedTasks().length === 0) return [];
    const order: Record<string, number> = { active: 0, draft: 1 };
    return this.sprintStore.sprints()
      .filter((sprint) => sprint.status === 'draft' || sprint.status === 'active')
      .sort((a, b) => (order[a.status] - order[b.status]) || ((a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity)))
      .map((sprint) => {
        const sprintTasks = this.tasksForSprint(sprint.id);
        return {
          sprint,
          currentTaskCount: sprintTasks.length,
          currentHours: sprintTasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0)
        };
      });
  });

  ngOnInit(): void {
    const assignee = this.route.snapshot?.queryParamMap?.get('assignee');
    if (assignee) this.assigneeFilter.set([assignee]);
    void this.currentEmployee.ensureLoaded();
  }

  ngAfterViewInit(): void {
    this.toolbarStore.setTemplate(this.toolbarTpl());
  }

  ngOnDestroy(): void {
    this.toolbarStore.setTemplate(null);
    if (this.undoBannerTimer) clearTimeout(this.undoBannerTimer);
  }

  private filteredTasks(): WorkTask[] {
    const assignees = this.assigneeFilter();
    const objectives = this.objectiveFilter();
    const categories = this.categoryFilter();
    const statuses = this.statusFilter();
    const priorities = this.priorityFilter();
    return this.store.tasks().filter((task) =>
      (objectives.length === 0 || objectives.includes(task.objectiveId)) &&
      (categories.length === 0 || categories.includes(task.categoryId)) &&
      (assignees.length === 0 || task.assigneeEmployeeIds.some((id) => assignees.includes(id))) &&
      (statuses.length === 0 || statuses.includes(task.statusId)) &&
      (priorities.length === 0 || priorities.includes(task.priority))
    );
  }

  tasksForSprint(sprintId: string): WorkTask[] {
    return this.filteredTasks().filter((task) => task.sprintId === sprintId);
  }

  toggleExpanded(sprintId: string): void {
    this.expandedSprintId.set(this.expandedSprintId() === sprintId ? null : sprintId);
  }

  protected onTaskSelectionChanged(event: { taskId: string; selected: boolean }): void {
    const next = new Set(this.selectedTaskIds());
    if (event.selected) next.add(event.taskId); else next.delete(event.taskId);
    this.selectedTaskIds.set(next);
  }

  protected onSelectAllChanged(event: { taskIds: string[]; selected: boolean }): void {
    const next = new Set(this.selectedTaskIds());
    for (const id of event.taskIds) {
      if (event.selected) next.add(id); else next.delete(id);
    }
    this.selectedTaskIds.set(next);
  }

  protected clearSelection(): void {
    this.selectedTaskIds.set(new Set());
  }

  protected async onTasksMoved(targetSprintId: string): Promise<void> {
    const tasks = this.selectedTasks();
    if (tasks.length === 0) return;

    this.movingTasks.set(true);
    this.moveError.set(null);
    try {
      const results = await Promise.all(tasks.map((task) =>
        firstValueFrom(this.taskApi.editTask(task.id, toEditTaskRequest(task, { sprintId: targetSprintId })))
      ));
      // A 202 means that task's move went out for approval instead of applying - it can't be undone here.
      const moved = tasks.filter((_, i) => !isPendingApproval(results[i]));
      const pendingCount = tasks.length - moved.length;
      this.lastMove = moved.map((task) => ({ taskId: task.id, previousSprintId: task.sprintId }));
      const targetName = this.sprintStore.sprints().find((s) => s.id === targetSprintId)?.name ?? 'the sprint';
      const parts: string[] = [];
      if (moved.length > 0) parts.push(`${moved.length} task${moved.length === 1 ? '' : 's'} moved to ${targetName}`);
      if (pendingCount > 0) parts.push(`${pendingCount} sent for approval`);
      this.showUndoBanner(parts.join(', '));
      this.moveDialogOpen.set(false);
      this.clearSelection();
      await this.reloadTasks();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.moveError.set(detail || 'Failed to move the selected tasks.');
    } finally {
      this.movingTasks.set(false);
    }
  }

  protected async undoMove(): Promise<void> {
    const moves = this.lastMove;
    if (moves.length === 0) return;
    this.lastMove = [];
    this.moveUndoBanner.set(null);
    if (this.undoBannerTimer) clearTimeout(this.undoBannerTimer);

    const currentTasks = this.store.tasks();
    await Promise.all(moves.map((move) => {
      const task = currentTasks.find((t) => t.id === move.taskId);
      if (!task) return Promise.resolve();
      return firstValueFrom(this.taskApi.editTask(task.id, toEditTaskRequest(task, { sprintId: move.previousSprintId })));
    }));
    await this.reloadTasks();
  }

  private showUndoBanner(message: string): void {
    if (this.undoBannerTimer) clearTimeout(this.undoBannerTimer);
    this.moveUndoBanner.set({ message });
    this.undoBannerTimer = setTimeout(() => {
      this.moveUndoBanner.set(null);
      this.lastMove = [];
    }, 8000);
  }

  protected readonly assigneeFilterOptions = computed<WorkDropdownOption[]>(() =>
    this.assignableMembers().map((member) => ({ value: member.employeeId, label: member.name }))
  );

  protected setObjectiveFilter(ids: string[]): void { this.objectiveFilter.set(ids); }
  protected setCategoryFilter(ids: string[]): void { this.categoryFilter.set(ids); }
  protected setAssigneeFilter(ids: string[]): void { this.assigneeFilter.set(ids); }
  protected setSprintStatusFilter(value: string): void { this.sprintStatusFilter.set(value as 'all' | SprintStatus); }

  protected onFilterFieldChanged(event: { key: string; values: string[] }): void {
    switch (event.key) {
      case 'module': this.setObjectiveFilter(event.values); break;
      case 'category': this.setCategoryFilter(event.values); break;
      case 'assignee': this.setAssigneeFilter(event.values); break;
      case 'sprintStatus': this.setSprintStatusFilter(event.values[0] ?? 'all'); break;
      case 'status': this.statusFilter.set(event.values); break;
      case 'priority': this.priorityFilter.set(event.values); break;
    }
  }

  protected readonly taskModalOpen = signal(false);
  protected readonly taskModalMode = signal<'create' | 'edit'>('create');
  protected readonly taskModalTaskId = signal('');
  protected readonly targetSprintForCreate = signal<Sprint | null>(null);

  protected readonly modalPrefillModuleId = computed(() => {
    const filter = this.objectiveFilter();
    return filter.length === 1 ? filter[0] : '';
  });

  protected readonly modalPrefillSprintId = computed(() => {
    const target = this.targetSprintForCreate();
    if (target) return target.id;
    return this.expandedSprintId() ?? '';
  });

  protected openCreateTask(sprint?: Sprint): void {
    this.targetSprintForCreate.set(sprint ?? null);
    this.taskModalMode.set('create');
    this.taskModalTaskId.set('');
    this.taskModalOpen.set(true);
  }

  protected closeTaskModal(): void {
    this.targetSprintForCreate.set(null);
    this.taskModalOpen.set(false);
  }

  async reloadTasks(): Promise<void> {
    await this.store.loadBoard(this.projectId());
  }

  onTaskViewed(task: WorkTask): void {
    this.taskModalMode.set('edit');
    this.taskModalTaskId.set(task.id);
    this.taskModalOpen.set(true);
  }

  protected onTaskModalDone(): void {
    this.targetSprintForCreate.set(null);
    this.taskModalOpen.set(false);
    void this.reloadTasks();
  }

  protected onSprintStarted(): void {
    this.startingSprint.set(null);
    void this.sprintStore.loadForProject(this.projectId());
  }

  protected onSprintCompleted(): void {
    this.completingSprint.set(null);
    void this.sprintStore.loadForProject(this.projectId());
  }

  onTaskStatusChangeRequested(event: { taskId: string; newStatusId: string }): void {
    if (event.taskId) void this.store.moveTask(event.taskId, event.newStatusId);
  }

  protected onSprintCreated(): void {
    this.createSprintOpen.set(false);
    void this.sprintStore.loadForProject(this.projectId());
  }

  protected onSprintEdited(): void {
    this.editingSprint.set(null);
    void this.sprintStore.loadForProject(this.projectId());
  }

  private async loadAssignableMembers(projectId: string): Promise<void> {
    try {
      await this.projectStore.loadProjectMembers(projectId);
      const members = this.projectStore.projectMembers();
      this.assignableMembers.set(members.map((member) => ({
        employeeId: member.employeeId,
        name: member.name ?? 'Unknown employee',
        avatarUrl: (member as { avatarUrl?: string | null }).avatarUrl ?? null
      })));
    } catch {
      this.assignableMembers.set([]);
    }
  }

  private async loadCategories(projectId: string): Promise<void> {
    try {
      this.categories.set((await firstValueFrom(this.taskApi.getCategories(projectId))).map(toTaskCategoryColumn));
    } catch {
      this.categories.set([]);
    }
  }
}
