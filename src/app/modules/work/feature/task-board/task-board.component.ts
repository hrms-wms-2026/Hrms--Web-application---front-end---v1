import { AfterViewChecked, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TaskBoardStore } from '../../state/task-board.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskDetailModalComponent } from '../../ui/task-detail-modal/task-detail-modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { TaskApiService } from '../../data-access/task-api.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { toSprint } from '../../utils/sprint.mapper';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { toTaskCategoryColumn } from '../../utils/task-category.mapper';
import { WorkDropdownComponent, WorkDropdownOption } from '../../ui/work-dropdown/work-dropdown.component';

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [TaskBoardColumnComponent, TaskCreateModalComponent, TaskDetailModalComponent, ButtonComponent, ErrorStateComponent, WorkDropdownComponent],
  template: `
    <div class="task-board__toolbar">
      <app-work-dropdown [options]="objectiveOptions()" [selected]="objectiveFilter()" ariaLabel="Module filter" icon="module" (selectionChanged)="setObjectiveFilter($event)" />
      <app-work-dropdown [options]="sprintOptions()" [selected]="sprintFilter()" ariaLabel="Sprint filter" icon="sprint" (selectionChanged)="setSprintFilter($event)" />
      <app-work-dropdown [options]="categoryOptions()" [selected]="categoryFilter()" ariaLabel="Category filter" icon="category" (selectionChanged)="setCategoryFilter($event)" />
      @if (modules().length > 0) {
        <app-button variant="primary" (pressed)="createOpen.set(true)">Create task</app-button>
      }
    </div>

    @if (store.loading()) {
      <p>Loading board…</p>
    } @else if (store.error()) {
      <app-error-state [message]="store.error()!" [retryable]="true" (retry)="reload()" />
    } @else {
      <div class="task-board">
        @for (column of columnsWithTasks(); track column.status.id) {
          <app-task-board-column
            [status]="column.status"
            [tasks]="column.tasks"
            [connectedListIds]="columnIds()"
            [allStatuses]="store.statuses()"
            [employeeNames]="employeeNames()"
            (taskDropped)="onTaskDropped($event)"
            (taskViewed)="onTaskViewed($event)"
          />
        }
      </div>
    }

    @if (createOpen()) {
      <app-task-create-modal
        [open]="createOpen()"
        [projectId]="projectId()"
        [modules]="moduleOptions()"
        [activeSprints]="sprints()"
        [assignableMembers]="assignableMembers()"
        (closed)="createOpen.set(false)"
        (created)="onTaskCreated()"
      />
    }

    <app-task-detail-modal
      [open]="detailOpen()"
      [task]="selectedTask()"
      [projectId]="projectId()"
      [isObjectiveOwner]="selectedTask() ? (objectiveOwners()[selectedTask()!.objectiveId] ?? false) : false"
      [statuses]="store.statuses()"
      (closed)="detailOpen.set(false)"
      (saved)="onTaskSaved()"
      (statusChangeRequested)="onStatusChangeRequested($event)"
    />
  `,
  styles: [`
    .task-board__toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: flex-end; gap: 8px; margin-bottom: 16px; }
    .task-board__toolbar app-work-dropdown { flex: 1 1 180px; max-width: 220px; }
    .task-board { display: flex; gap: 16px; overflow-x: auto; padding: 0 0 10px; scroll-snap-type: x proximity; }
    @media (max-width: 720px) { .task-board__toolbar { justify-content: stretch; } .task-board__toolbar app-work-dropdown { flex: 1 1 180px; max-width: none; } .task-board__toolbar app-button { flex: 1 1 100%; } }
    :host ::ng-deep .task-card--highlighted { outline: 2px solid var(--color-focus-ring, var(--color-danger)); outline-offset: 2px; }
  `]
})
export class TaskBoardComponent implements OnInit, AfterViewChecked {
  protected readonly store = inject(TaskBoardStore);
  private readonly projectStore = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly sprintApi = inject(SprintApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly directory = inject(EmployeeDirectoryStore);

  protected readonly createOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly selectedTask = signal<WorkTask | null>(null);
  protected readonly projectId = signal('');
  protected readonly sprints = signal<Sprint[]>([]);
  protected readonly categories = signal<TaskCategoryColumn[]>([]);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);
  protected readonly objectiveFilter = signal('all');
  protected readonly sprintFilter = signal('active');
  protected readonly categoryFilter = signal('all');
  private highlightTaskId: string | null = null;
  private didScrollToHighlight = false;

  protected readonly modules = computed(() => this.projectStore.milestones());
  protected readonly objectiveOwners = computed(() =>
    Object.fromEntries(this.modules().map((module) => [module.objectiveId, module.isOwner]))
  );
  protected readonly moduleOptions = computed(() =>
    this.modules().map((m) => ({ objectiveId: m.objectiveId, title: m.title, isOwner: m.isOwner }))
  );
  protected readonly objectiveOptions = computed<WorkDropdownOption[]>(() => [
    { value: 'all', label: 'All modules' },
    ...this.modules().map((module) => ({ value: module.objectiveId, label: module.title }))
  ]);
  protected readonly sprintOptions = computed<WorkDropdownOption[]>(() => [
    { value: 'active', label: 'Active sprints' },
    { value: 'all', label: 'All sprints' },
    { value: 'individual', label: 'Individual task' },
    ...this.sprints().map((sprint) => ({ value: sprint.id, label: sprint.name }))
  ]);
  protected readonly categoryOptions = computed<WorkDropdownOption[]>(() => [
    { value: 'all', label: 'All categories' },
    ...this.categories().map((category) => ({ value: category.id, label: category.name }))
  ]);
  protected readonly columnsWithTasks = computed(() =>
    this.store.columnsWithTasks().map((column) => ({
      status: column.status,
      tasks: column.tasks.filter((task) => this.matchesFilters(task))
    }))
  );
  protected readonly employeeNames = computed(() =>
    Object.fromEntries(
      this.store.tasks()
        .flatMap((task) => task.assigneeEmployeeIds)
        .filter((id, index, all) => all.indexOf(id) === index)
        .map((id) => [id, this.directory.get(id)?.name ?? 'Unknown employee'])
    )
  );

  protected setObjectiveFilter(value: string): void { this.objectiveFilter.set(value); }
  protected setSprintFilter(value: string): void { this.sprintFilter.set(value); }
  protected setCategoryFilter(value: string): void { this.categoryFilter.set(value); }

  columnIds(): string[] {
    return this.columnsWithTasks().map((column) => column.status.id);
  }

  ngOnInit(): void {
    const projectId = this.route.snapshot?.paramMap?.get('id') ?? '';
    this.projectId.set(projectId);
    this.highlightTaskId = this.route.snapshot?.queryParamMap?.get('highlightTaskId') ?? null;
    if (!projectId) return;

    // No loadMyMilestones() call here - ProjectDetailComponent (the parent route) already
    // awaits it and gates rendering of this component's outlet until it resolves, so modules()
    // is already populated by the time this component exists. A second call here would just be
    // a redundant request for data this component can already read reactively off the shared
    // ProjectDetailStore.
    void this.loadAssignableMembers(projectId);
    this.reload();
  }

  protected reload(): void {
    const projectId = this.projectId();
    if (!projectId) return;
    void this.store.loadBoard(projectId);
    void this.loadSprints(projectId);
    void this.loadCategories(projectId);
  }

  ngAfterViewChecked(): void {
    if (!this.highlightTaskId || this.didScrollToHighlight || this.store.loading()) return;
    const el = document.querySelector(`[data-testid="task-card-${this.highlightTaskId}"]`) as HTMLElement | null;
    if (!el) return;
    this.didScrollToHighlight = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    el.classList.add('task-card--highlighted');
  }

  private matchesFilters(task: WorkTask): boolean {
    const objectiveMatches = this.objectiveFilter() === 'all' || task.objectiveId === this.objectiveFilter();
    const sprintFilter = this.sprintFilter();
    const activeSprintIds = new Set(this.sprints().filter((sprint) => sprint.status === 'active').map((sprint) => sprint.id));
    const sprintMatches = sprintFilter === 'all'
      ? true
      : sprintFilter === 'active'
        ? activeSprintIds.has(task.sprintId ?? '')
        : sprintFilter === 'individual'
          ? task.sprintId == null
          : task.sprintId === sprintFilter;
    const categoryMatches = this.categoryFilter() === 'all' || task.categoryId === this.categoryFilter();
    return objectiveMatches && sprintMatches && categoryMatches;
  }

  private async loadSprints(projectId: string): Promise<void> {
    try {
      const sprints = (await firstValueFrom(this.sprintApi.getByProject(projectId))).map(toSprint);
      this.sprints.set(sprints);
      const active = sprints.filter((sprint) => sprint.status === 'active');
      this.sprintFilter.set(active.length === 1 ? active[0].id : 'all');
    } catch {
      this.sprints.set([]);
    }
  }

  private async loadCategories(projectId: string): Promise<void> {
    try {
      this.categories.set((await firstValueFrom(this.taskApi.getCategories(projectId))).map(toTaskCategoryColumn));
    } catch {
      this.categories.set([]);
    }
  }

  private async loadAssignableMembers(projectId: string): Promise<void> {
    try {
      await this.projectStore.loadProjectMembers(projectId);
      const members = this.projectStore.projectMembers();
      // Still needed here even though the dropdown itself now uses member.name directly
      // (server-resolved): employeeNames above resolves *existing task* assignees, which
      // WorkTaskResponse only carries as raw EmployeeId GUIDs, and this is the only call in
      // this component that populates the shared directory cache those names come from.
      await this.directory.ensureLoaded(members.map((member) => member.employeeId));
      this.assignableMembers.set(members.map((member) => ({
        employeeId: member.employeeId,
        name: member.name ?? 'Unknown employee'
      })));
    } catch {
      this.assignableMembers.set([]);
    }
  }

  onTaskDropped(event: { taskId: string; newStatusId: string }): void {
    void this.store.moveTask(event.taskId, event.newStatusId);
  }

  onTaskViewed(task: WorkTask): void {
    this.selectedTask.set(task);
    this.detailOpen.set(true);
  }

  protected onStatusChangeRequested(newStatusId: string): void {
    const taskId = this.selectedTask()?.id;
    if (taskId) void this.store.moveTask(taskId, newStatusId);
  }

  protected onTaskCreated(): void {
    this.createOpen.set(false);
    void this.store.loadBoard(this.projectId());
  }

  protected onTaskSaved(): void {
    void this.store.loadBoard(this.projectId());
  }
}
