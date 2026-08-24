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

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [TaskBoardColumnComponent, TaskCreateModalComponent, TaskDetailModalComponent, ButtonComponent, ErrorStateComponent],
  template: `
    <div class="task-board__toolbar">
      <select class="task-board__filter" aria-label="Module filter" [value]="objectiveFilter()" (change)="objectiveFilter.set($any($event.target).value)">
        <option value="all">All modules</option>
        @for (module of modules(); track module.objectiveId) {
          <option [value]="module.objectiveId">{{ module.title }}</option>
        }
      </select>
      <select class="task-board__filter" aria-label="Sprint filter" [value]="sprintFilter()" (change)="sprintFilter.set($any($event.target).value)">
        <option value="active">Active sprints</option>
        <option value="all">All sprints</option>
        @for (sprint of sprints(); track sprint.id) {
          <option [value]="sprint.id">{{ sprint.name }}</option>
        }
      </select>
      <select class="task-board__filter" aria-label="Category filter" [value]="categoryFilter()" (change)="categoryFilter.set($any($event.target).value)">
        <option value="all">All categories</option>
        @for (category of categories(); track category.id) {
          <option [value]="category.id">{{ category.name }}</option>
        }
      </select>
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
    .task-board__toolbar { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-bottom: 12px; }
    .task-board__filter { border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; background: var(--color-surface); color: var(--color-text-primary); }
    .task-board { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
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

  columnIds(): string[] {
    return this.columnsWithTasks().map((column) => column.status.id);
  }

  ngOnInit(): void {
    const projectId = this.route.snapshot?.paramMap?.get('id') ?? '';
    this.projectId.set(projectId);
    this.highlightTaskId = this.route.snapshot?.queryParamMap?.get('highlightTaskId') ?? null;
    if (!projectId) return;

    void this.projectStore.loadMyMilestones(projectId);
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
      await this.directory.ensureLoaded(members.map((member) => member.employeeId));
      this.assignableMembers.set(members.map((member) => ({
        employeeId: member.employeeId,
        name: this.directory.get(member.employeeId)?.name ?? 'Unknown employee'
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
