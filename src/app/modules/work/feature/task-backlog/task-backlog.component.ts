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
import { TaskAssigneeAvatarFilterComponent } from '../../ui/task-assignee-avatar-filter/task-assignee-avatar-filter.component';
import { TaskFormModalComponent } from '../../ui/task-form-modal/task-form-modal.component';

@Component({
  selector: 'app-task-backlog',
  standalone: true,
  imports: [SprintTabComponent, SprintFormComponent, TaskTableComponent, ButtonComponent, ErrorStateComponent, TaskFilterBarComponent, TaskAssigneeAvatarFilterComponent, TaskFormModalComponent],
  template: `
    <ng-template #toolbarTpl>
      <div class="task-backlog__toolbar">
        <app-task-assignee-avatar-filter
          [members]="assignableMembers()"
          [currentEmployeeId]="currentEmployee.id()"
          [selected]="assigneeFilter()"
          (selectionChanged)="setAssigneeFilter($event)"
        />
        <app-task-filter-bar [fields]="filterFields()" [values]="filterValues()" (fieldChanged)="onFilterFieldChanged($event)" />
        @if (modules().length > 0) {
          <app-button variant="secondary" (pressed)="openCreateTask()">Create task</app-button>
        }
        @if (ownedModuleOptions().length > 0) {
          <app-button variant="primary" (pressed)="createSprintOpen.set(true)">Create Sprint</app-button>
        }
      </div>
    </ng-template>

    @if (createSprintOpen() && ownedModuleOptions().length > 0) {
        <app-sprint-form
          mode="create"
          [open]="createSprintOpen()"
          [modules]="ownedModuleOptions()"
          (created)="onSprintCreated()"
          (cancelled)="createSprintOpen.set(false)"
        />
    }
    @if (editingSprint(); as sprint) {
      <app-sprint-form
        mode="edit"
        [open]="true"
        [objectiveId]="sprint.objectiveId"
        [sprint]="sprint"
        (saved)="onSprintEdited()"
        (cancelled)="editingSprint.set(null)"
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
              [isObjectiveOwner]="objectiveOwners()[sprint.objectiveId] ?? false"
              [tasks]="tasksForSprint(sprint.id)"
              [statusNames]="statusNames()"
              [statuses]="store.statuses()"
              [objectiveOwners]="objectiveOwners()"
              [currentEmployeeId]="currentEmployee.id()"
              [expanded]="expandedSprintId() === sprint.id"
              (toggled)="toggleExpanded(sprint.id)"
              (editRequested)="editingSprint.set(sprint)"
              (statusChangeRequested)="onSprintStatusChangeRequested(sprint, $event)"
              (createTaskRequested)="openCreateTask()"
              (taskViewed)="onTaskViewed($event)"
              (taskStatusChangeRequested)="onTaskStatusChangeRequested($event)"
              (taskChanged)="reloadTasks()"
            />
          }
        </div>
      }

      @if (unsortedTasks().length > 0) {
        <div class="task-backlog__unsorted">
          <h3 class="task-backlog__unsorted-title">Unsorted</h3>
          <app-task-table
            [tasks]="unsortedTasks()"
            [statusNames]="statusNames()"
            [statuses]="store.statuses()"
            [objectiveOwners]="objectiveOwners()"
            [currentEmployeeId]="currentEmployee.id()"
            (viewed)="onTaskViewed($event)"
            (taskChanged)="reloadTasks()"
            (statusChangeRequested)="onTaskStatusChangeRequested($event)"
          />
        </div>
      }
    }

    <app-task-form-modal
      [open]="taskModalOpen()"
      [mode]="taskModalMode()"
      [projectId]="projectId()"
      [taskId]="taskModalTaskId()"
      [prefillModuleId]="modalPrefillModuleId()"
      [prefillSprintId]="modalPrefillSprintId()"
      (created)="onTaskModalDone()"
      (saved)="onTaskModalDone()"
      (closed)="taskModalOpen.set(false)"
    />
  `,
  styles: [`
    .task-backlog__toolbar { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; }
    .task-backlog__toolbar ::ng-deep app-button > button { width: auto; }
    .task-backlog__sprint-message { color: var(--color-danger-text, var(--color-danger)); font-size: 12px; margin-bottom: 8px; }
    .task-backlog__sprints { margin-top: 4px; }
    .task-backlog__sprints-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 10px; }
    .task-backlog__unsorted { margin-top: 18px; }
    .task-backlog__unsorted-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 10px; }
  `]
})
export class TaskBacklogComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly store = inject(TaskBoardStore);
  protected readonly sprintStore = inject(SprintListStore);
  protected readonly projectStore = inject(ProjectDetailStore);
  private readonly toolbarStore = inject(WorkPageToolbarStore);
  private readonly toolbarTpl = viewChild.required<TemplateRef<unknown>>('toolbarTpl');
  private readonly taskApi = inject(TaskApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly currentEmployee = inject(CurrentEmployeeStore);

  protected readonly createSprintOpen = signal(false);
  protected readonly editingSprint = signal<Sprint | null>(null);
  protected readonly projectId = signal('');
  protected readonly expandedSprintId = signal<string | null>(null);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);
  protected readonly sprintStatusFilter = signal<'all' | SprintStatus>('all');
  protected readonly objectiveFilter = signal<string[]>([]);
  protected readonly categoryFilter = signal<string[]>([]);
  protected readonly assigneeFilter = signal<string[]>([]);
  protected readonly statusFilter = signal<string[]>([]);
  protected readonly priorityFilter = signal<string[]>([]);
  protected readonly categories = signal<TaskCategoryColumn[]>([]);
  protected readonly sprintStatusOptions: readonly WorkDropdownOption[] = [
    { value: 'all', label: 'All sprint statuses' },
    { value: 'future', label: 'Future' },
    { value: 'active', label: 'Active' },
    { value: 'complete', label: 'Complete' },
    { value: 'incomplete', label: 'Incomplete' },
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
  protected readonly moduleOptions = computed(() =>
    this.modules().map((m) => ({ objectiveId: m.objectiveId, title: m.title, isOwner: m.isOwner }))
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
  // Sprint creation has no pending/request path (unlike tasks) - only modules the user owns may
  // ever be offered here, or SprintApiService.create would just fail for a non-owner's pick.
  protected readonly ownedModuleOptions = computed(() => this.moduleOptions().filter((m) => m.isOwner));
  protected readonly statusNames = computed(() => Object.fromEntries(this.store.statuses().map((status) => [status.id, status.name])));
  protected readonly filteredSprints = computed(() => {
    const filter = this.sprintStatusFilter();
    return filter === 'all' ? this.sprintStore.sprints() : this.sprintStore.sprints().filter((sprint) => sprint.status === filter);
  });
  protected readonly unsortedTasks = computed(() => {
    const knownSprintIds = new Set(this.sprintStore.sprints().map((sprint) => sprint.id));
    return this.filteredTasks().filter((task) => task.sprintId == null || !knownSprintIds.has(task.sprintId));
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

  protected readonly modalPrefillModuleId = computed(() => {
    const filter = this.objectiveFilter();
    return filter.length === 1 ? filter[0] : '';
  });

  protected readonly modalPrefillSprintId = computed(() => {
    return this.expandedSprintId() ?? '';
  });

  protected openCreateTask(): void {
    this.taskModalMode.set('create');
    this.taskModalTaskId.set('');
    this.taskModalOpen.set(true);
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
    this.taskModalOpen.set(false);
    void this.reloadTasks();
  }

  async onSprintStatusChangeRequested(sprintOrId: Sprint | string, newStatus: string): Promise<void> {
    const sprint = typeof sprintOrId === 'string'
      ? this.sprintStore.sprints().find((item) => item.id === sprintOrId)
      : sprintOrId;
    if (!sprint || !(this.objectiveOwners()[sprint.objectiveId] ?? false)) return;
    if (this.projectId()) {
      await this.sprintStore.setStatus(sprint.id, newStatus as SprintStatus, sprint.objectiveId, false, this.projectId());
    } else {
      await this.sprintStore.setStatus(sprint.id, newStatus as SprintStatus, sprint.objectiveId, false);
    }
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
        name: member.name ?? 'Unknown employee'
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
