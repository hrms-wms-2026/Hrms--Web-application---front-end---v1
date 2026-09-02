import { AfterViewChecked, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrentEmployeeStore } from '../../state/current-employee.store';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TaskBoardStore } from '../../state/task-board.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';
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
import { TaskFormModalComponent } from '../../ui/task-form-modal/task-form-modal.component';

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [TaskBoardColumnComponent, ButtonComponent, ErrorStateComponent, WorkDropdownComponent, TaskFormModalComponent],
  template: `
    <div class="task-board__toolbar">
      <app-work-dropdown [options]="objectiveOptions()" [multiple]="true" [values]="objectiveFilter()" allLabel="All modules" size="sm" accessibleLabel="Module filter" leadingIcon="module" (valuesChanged)="setObjectiveFilter($event)" />
      <app-work-dropdown [options]="sprintOptions()" [selected]="sprintFilter()" size="sm" accessibleLabel="Sprint filter" leadingIcon="sprint" (selectionChanged)="setSprintFilter($event)" />
      <app-work-dropdown [options]="categoryOptions()" [multiple]="true" [values]="categoryFilter()" allLabel="All categories" size="sm" accessibleLabel="Category filter" leadingIcon="category" (valuesChanged)="setCategoryFilter($event)" />
      <app-work-dropdown [options]="assigneeFilterOptions()" [multiple]="true" [values]="assigneeFilter()" allLabel="All people" size="sm" accessibleLabel="Assignee filter" leadingIcon="people" (valuesChanged)="setAssigneeFilter($event)" />
      @if (modules().length > 0) {
        <app-button variant="primary" (pressed)="goToCreate()">Create task</app-button>
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
            [currentEmployeeId]="currentEmployee.id()"
            (taskDropped)="onTaskDropped($event)"
            (taskViewed)="onTaskViewed($event)"
            (taskChanged)="reload()"
          />
        }
      </div>
    }

    <app-task-form-modal
      [open]="taskModalOpen()"
      [mode]="taskModalMode()"
      [projectId]="projectId()"
      [taskId]="taskModalTaskId()"
      (created)="onTaskModalDone()"
      (saved)="onTaskModalDone()"
      (closed)="taskModalOpen.set(false)"
    />
  `,
  styles: [`
    .task-board__toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; margin-bottom: 16px; }
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
  protected readonly currentEmployee = inject(CurrentEmployeeStore);

  protected readonly projectId = signal('');
  protected readonly sprints = signal<Sprint[]>([]);
  protected readonly categories = signal<TaskCategoryColumn[]>([]);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);
  protected readonly objectiveFilter = signal<string[]>([]);
  protected readonly sprintFilter = signal('active');
  protected readonly categoryFilter = signal<string[]>([]);
  protected readonly assigneeFilter = signal<string[]>([]);
  private highlightTaskId: string | null = null;
  private didScrollToHighlight = false;

  protected readonly modules = computed(() => this.projectStore.milestones());
  protected readonly moduleOptions = computed(() =>
    this.modules().map((m) => ({ objectiveId: m.objectiveId, title: m.title, isOwner: m.isOwner }))
  );
  protected readonly objectiveOptions = computed<WorkDropdownOption[]>(() =>
    this.modules().map((module) => ({ value: module.objectiveId, label: module.title }))
  );
  protected readonly sprintOptions = computed<WorkDropdownOption[]>(() => [
    { value: 'active', label: 'Active sprints' },
    { value: 'all', label: 'All sprints' },
    { value: 'individual', label: 'Individual task' },
    ...this.sprints().map((sprint) => ({ value: sprint.id, label: sprint.name }))
  ]);
  protected readonly categoryOptions = computed<WorkDropdownOption[]>(() =>
    this.categories().map((category) => ({ value: category.id, label: category.name }))
  );
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

  protected readonly assigneeFilterOptions = computed<WorkDropdownOption[]>(() =>
    this.assignableMembers().map((member) => ({ value: member.employeeId, label: member.name }))
  );

  protected setObjectiveFilter(ids: string[]): void { this.objectiveFilter.set(ids); }
  protected setSprintFilter(value: string): void { this.sprintFilter.set(value); }
  protected setCategoryFilter(ids: string[]): void { this.categoryFilter.set(ids); }
  protected setAssigneeFilter(ids: string[]): void { this.assigneeFilter.set(ids); }

  columnIds(): string[] {
    return this.columnsWithTasks().map((column) => column.status.id);
  }

  ngOnInit(): void {
    const projectId = this.route.snapshot?.paramMap?.get('id') ?? '';
    this.projectId.set(projectId);
    this.highlightTaskId = this.route.snapshot?.queryParamMap?.get('highlightTaskId') ?? null;
    const assignee = this.route.snapshot?.queryParamMap?.get('assignee');
    if (assignee) this.assigneeFilter.set([assignee]);
    if (!projectId) return;

    // No loadMyMilestones() call here - ProjectDetailComponent (the parent route) already
    // awaits it and gates rendering of this component's outlet until it resolves, so modules()
    // is already populated by the time this component exists. A second call here would just be
    // a redundant request for data this component can already read reactively off the shared
    // ProjectDetailStore.
    void this.loadAssignableMembers(projectId);
    void this.currentEmployee.ensureLoaded();
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
    const objectiveFilter = this.objectiveFilter();
    const objectiveMatches = objectiveFilter.length === 0 || objectiveFilter.includes(task.objectiveId);
    const sprintFilter = this.sprintFilter();
    const activeSprintIds = new Set(this.sprints().filter((sprint) => sprint.status === 'active').map((sprint) => sprint.id));
    const sprintMatches = sprintFilter === 'all'
      ? true
      : sprintFilter === 'active'
        ? activeSprintIds.has(task.sprintId ?? '')
        : sprintFilter === 'individual'
          ? task.sprintId == null
          : task.sprintId === sprintFilter;
    const categoryFilter = this.categoryFilter();
    const categoryMatches = categoryFilter.length === 0 || categoryFilter.includes(task.categoryId);
    const assignees = this.assigneeFilter();
    const assigneeMatches = assignees.length === 0 || task.assigneeEmployeeIds.some((id) => assignees.includes(id));
    return objectiveMatches && sprintMatches && categoryMatches && assigneeMatches;
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

  protected readonly taskModalOpen = signal(false);
  protected readonly taskModalMode = signal<'create' | 'edit'>('create');
  protected readonly taskModalTaskId = signal('');

  onTaskViewed(task: WorkTask): void {
    this.taskModalMode.set('edit');
    this.taskModalTaskId.set(task.id);
    this.taskModalOpen.set(true);
  }

  protected goToCreate(): void {
    this.taskModalMode.set('create');
    this.taskModalTaskId.set('');
    this.taskModalOpen.set(true);
  }

  protected onTaskModalDone(): void {
    this.taskModalOpen.set(false);
    this.reload();
  }
}
