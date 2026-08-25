import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { SprintListStore } from '../../state/sprint-list.store';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskDetailModalComponent } from '../../ui/task-detail-modal/task-detail-modal.component';
import { SprintTabComponent } from '../../ui/sprint-tab/sprint-tab.component';
import { SprintCreateFormComponent } from '../../ui/sprint-create-form/sprint-create-form.component';
import { SprintEditFormComponent } from '../../ui/sprint-edit-form/sprint-edit-form.component';
import { TaskTableComponent } from '../../ui/task-table/task-table.component';
import { WorkTask } from '../../models/task.model';
import { Sprint, SprintStatus } from '../../models/sprint.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { toTaskCategoryColumn } from '../../utils/task-category.mapper';

@Component({
  selector: 'app-task-backlog',
  standalone: true,
  imports: [TaskCreateModalComponent, TaskDetailModalComponent, SprintTabComponent, SprintCreateFormComponent, SprintEditFormComponent, TaskTableComponent, ButtonComponent, ErrorStateComponent],
  template: `
    <div class="task-backlog__toolbar">
      <div class="task-backlog__filter-shell">
        <svg class="task-backlog__filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h18M6 7v10M18 7v10M9 17h6" /></svg>
        <select class="task-backlog__filter" aria-label="Module filter" [value]="objectiveFilter()" (change)="objectiveFilter.set($any($event.target).value)">
          <option value="all">All modules</option>
          @for (module of modules(); track module.objectiveId) {
            <option [value]="module.objectiveId">{{ module.title }}</option>
          }
        </select>
        <svg class="task-backlog__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </div>
      <div class="task-backlog__filter-shell">
        <svg class="task-backlog__filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        <select class="task-backlog__filter" aria-label="Category filter" [value]="categoryFilter()" (change)="categoryFilter.set($any($event.target).value)">
          <option value="all">All categories</option>
          @for (category of categories(); track category.id) {
            <option [value]="category.id">{{ category.name }}</option>
          }
        </select>
        <svg class="task-backlog__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </div>
      <div class="task-backlog__filter-shell task-backlog__filter-shell--wide">
        <svg class="task-backlog__filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg>
        <select
          class="task-backlog__status-filter"
          data-testid="sprint-status-filter"
          aria-label="Sprint status filter"
          [value]="sprintStatusFilter()"
          (change)="sprintStatusFilter.set($any($event.target).value)"
        >
          <option value="all">All sprint statuses</option>
          <option value="future">Future</option>
          <option value="active">Active</option>
          <option value="complete">Complete</option>
          <option value="incomplete">Incomplete</option>
          <option value="achieved">Achieved</option>
        </select>
        <svg class="task-backlog__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </div>
      @if (modules().length > 0) {
        <app-button variant="secondary" (pressed)="openCreateTask()">Create task</app-button>
      }
      @if (ownedModuleOptions().length > 0) {
        <app-button variant="primary" (pressed)="createSprintOpen.set(true)">Create Sprint</app-button>
      }
    </div>

    @if (createSprintOpen() && ownedModuleOptions().length > 0) {
      <app-sprint-create-form
        [open]="createSprintOpen()"
        [modules]="ownedModuleOptions()"
        (created)="onSprintCreated()"
        (cancelled)="createSprintOpen.set(false)"
      />
    }
    @if (editingSprint(); as sprint) {
      <app-sprint-edit-form
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
      @for (sprint of filteredSprints(); track sprint.id) {
        <app-sprint-tab
          [sprint]="sprint"
          [isObjectiveOwner]="objectiveOwners()[sprint.objectiveId] ?? false"
          [tasks]="tasksForSprint(sprint.id)"
          [statusNames]="statusNames()"
          [statuses]="store.statuses()"
          [objectiveOwners]="objectiveOwners()"
          [expanded]="expandedSprintId() === sprint.id"
          (toggled)="toggleExpanded(sprint.id)"
          (editRequested)="editingSprint.set(sprint)"
          (statusChangeRequested)="onSprintStatusChangeRequested(sprint, $event)"
          (createTaskRequested)="openCreateTask()"
          (taskViewed)="onTaskViewed($event)"
          (taskStatusChangeRequested)="onTaskStatusChangeRequested($event)"
        />
      }

      @if (unsortedTasks().length > 0) {
        <div class="task-backlog__unsorted">
          <h3 class="task-backlog__unsorted-title">Unsorted</h3>
          <app-task-table
            [tasks]="unsortedTasks()"
            [statusNames]="statusNames()"
            [statuses]="store.statuses()"
            [objectiveOwners]="objectiveOwners()"
            (viewed)="onTaskViewed($event)"
            (statusChangeRequested)="onTaskStatusChangeRequested($event)"
          />
        </div>
      }
    }

    @if (createOpen()) {
      <app-task-create-modal
        [open]="createOpen()"
        [projectId]="projectId()"
        [modules]="moduleOptions()"
        [sprintRequired]="false"
        [activeSprints]="sprintStore.sprints()"
        [assignableMembers]="assignableMembers()"
        (closed)="createOpen.set(false)"
        (created)="onTaskCreated()"
      />
    }
    @if (detailOpen()) {
      <app-task-detail-modal
        [open]="detailOpen()"
        [task]="selectedTask()"
        [projectId]="projectId()"
        [isObjectiveOwner]="selectedTask() ? (objectiveOwners()[selectedTask()!.objectiveId] ?? false) : false"
        [statuses]="store.statuses()"
        (closed)="detailOpen.set(false)"
        (saved)="reloadTasks()"
        (statusChangeRequested)="onTaskStatusChangeRequested({ taskId: selectedTask()?.id ?? '', newStatusId: $event })"
      />
    }
  `,
  styles: [`
    .task-backlog__toolbar { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 16px; }
    .task-backlog__filter-shell { position: relative; min-width: 180px; }
    .task-backlog__filter-shell--wide { min-width: 210px; }
    .task-backlog__filter, .task-backlog__status-filter { appearance: none; width: 100%; height: 44px; border: 1px solid var(--color-border); border-radius: 9px; padding: 0 34px 0 36px; background: var(--color-surface); color: var(--color-text-primary); font-size: 14px; font-weight: 500; box-shadow: 0 1px 2px rgb(15 23 42 / 0.04); transition: border-color 160ms ease, box-shadow 160ms ease; }
    .task-backlog__filter:hover, .task-backlog__status-filter:hover { border-color: var(--color-accent); }
    .task-backlog__filter:focus-visible, .task-backlog__status-filter:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .task-backlog__filter-icon, .task-backlog__chevron { pointer-events: none; position: absolute; top: 50%; width: 16px; height: 16px; transform: translateY(-50%); }
    .task-backlog__filter-icon { left: 12px; color: var(--color-accent); }
    .task-backlog__chevron { right: 12px; color: var(--color-text-secondary); transition: transform 160ms ease; }
    .task-backlog__filter:focus + .task-backlog__chevron, .task-backlog__status-filter:focus + .task-backlog__chevron { transform: translateY(-50%) rotate(180deg); }
    .task-backlog__sprint-message { color: var(--color-danger-text, var(--color-danger)); font-size: 12px; margin-bottom: 8px; }
    .task-backlog__unsorted { margin-top: 18px; }
    .task-backlog__unsorted-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 10px; }
    @media (max-width: 720px) { .task-backlog__toolbar { justify-content: stretch; } .task-backlog__filter-shell { flex: 1 1 180px; } .task-backlog__toolbar app-button { flex: 1 1 100%; } }
  `]
})
export class TaskBacklogComponent implements OnInit {
  protected readonly store = inject(TaskBoardStore);
  protected readonly sprintStore = inject(SprintListStore);
  protected readonly projectStore = inject(ProjectDetailStore);
  private readonly taskApi = inject(TaskApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly createOpen = signal(false);
  protected readonly createSprintOpen = signal(false);
  protected readonly editingSprint = signal<Sprint | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly selectedTask = signal<WorkTask | null>(null);
  protected readonly projectId = signal('');
  protected readonly expandedSprintId = signal<string | null>(null);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);
  protected readonly sprintStatusFilter = signal<'all' | SprintStatus>('all');
  protected readonly objectiveFilter = signal('all');
  protected readonly categoryFilter = signal('all');
  protected readonly categories = signal<TaskCategoryColumn[]>([]);

  protected readonly modules = computed(() => this.projectStore.milestones());
  protected readonly objectiveOwners = computed(() =>
    Object.fromEntries(this.modules().map((module) => [module.objectiveId, module.isOwner]))
  );
  protected readonly moduleOptions = computed(() =>
    this.modules().map((m) => ({ objectiveId: m.objectiveId, title: m.title, isOwner: m.isOwner }))
  );
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
    const projectId = this.route.snapshot?.paramMap?.get('id') ?? '';
    this.projectId.set(projectId);
    if (!projectId) return;

    void this.store.loadBoard(projectId);
    void this.sprintStore.loadForProject(projectId);
    void this.loadCategories(projectId);
    void this.loadAssignableMembers(projectId);
  }

  private filteredTasks(): WorkTask[] {
    return this.store.tasks().filter((task) =>
      (this.objectiveFilter() === 'all' || task.objectiveId === this.objectiveFilter()) &&
      (this.categoryFilter() === 'all' || task.categoryId === this.categoryFilter())
    );
  }

  tasksForSprint(sprintId: string): WorkTask[] {
    return this.filteredTasks().filter((task) => task.sprintId === sprintId);
  }

  toggleExpanded(sprintId: string): void {
    this.expandedSprintId.set(this.expandedSprintId() === sprintId ? null : sprintId);
  }

  protected openCreateTask(): void {
    this.createOpen.set(true);
  }

  protected onTaskCreated(): void {
    this.createOpen.set(false);
    void this.reloadTasks();
  }

  async reloadTasks(): Promise<void> {
    await this.store.loadBoard(this.projectId());
  }

  onTaskViewed(task: WorkTask): void {
    this.selectedTask.set(task);
    this.detailOpen.set(true);
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

  onTaskStatusChangeRequested(event: { taskId: string; newStatusId: string } | string): void {
    const taskId = typeof event === 'string' ? this.selectedTask()?.id ?? '' : event.taskId;
    const newStatusId = typeof event === 'string' ? event : event.newStatusId;
    if (taskId) void this.store.moveTask(taskId, newStatusId);
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
