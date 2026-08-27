import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CurrentEmployeeStore } from '../../state/current-employee.store';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { SprintListStore } from '../../state/sprint-list.store';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { toWorkTask } from '../../utils/task.mapper';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';
import { TaskTableComponent } from '../../ui/task-table/task-table.component';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskDetailModalComponent } from '../../ui/task-detail-modal/task-detail-modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';

@Component({
  selector: 'app-my-task',
  standalone: true,
  imports: [TaskBoardColumnComponent, TaskTableComponent, TaskCreateModalComponent, TaskDetailModalComponent, ButtonComponent, ErrorStateComponent, SelectComponent],
  template: `
    <div class="my-task__toolbar">
      <div class="my-task__view-toggle">
        <button data-testid="my-task-view-toggle-board" type="button" [class.my-task__view-toggle--active]="view() === 'board'" (click)="view.set('board')">Board</button>
        <button data-testid="my-task-view-toggle-list" type="button" [class.my-task__view-toggle--active]="view() === 'list'" (click)="view.set('list')">List</button>
      </div>
      <app-select [options]="sprintOptions()" [value]="sprintFilter() ?? 'all'" ariaLabel="Sprint filter" [icon]="'sprint'" (valueChange)="setSprintFilter($event === 'all' ? null : $event)" />
      <input data-testid="my-task-search" type="text" placeholder="Search my tasks" (input)="search.set($any($event.target).value)" />
      <app-button variant="primary" (pressed)="createOpen.set(true)">Create task</app-button>
    </div>

    @if (loading()) {
      <p>Loading…</p>
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="reload()" />
    } @else if (filteredTasks().length === 0) {
      <p class="my-task__empty">{{ tasks().length === 0 ? 'No tasks assigned to you in this project.' : 'No tasks match your search.' }}</p>
    } @else if (view() === 'board') {
      <div data-testid="my-task-board-view" class="my-task__board">
        @for (column of columnsWithTasks(); track column.status.id) {
          <app-task-board-column
            [status]="column.status"
            [tasks]="column.tasks"
            [connectedListIds]="statuses().map(s => s.id)"
            [allStatuses]="statuses()"
            [employeeNames]="{}"
            [currentEmployeeId]="currentEmployeeId()"
            (taskDropped)="onTaskDropped($event)"
            (taskViewed)="onTaskViewed($event)"
            (taskChanged)="reload()"
          />
        }
      </div>
    } @else {
      <div data-testid="my-task-list-view">
        <app-task-table
          [tasks]="filteredTasks()"
          [statuses]="statuses()"
          [currentEmployeeId]="currentEmployeeId()"
          (viewed)="onTaskViewed($event)"
          (taskChanged)="reload()"
        />
      </div>
    }

    @if (createOpen()) {
      <app-task-create-modal [open]="createOpen()" [projectId]="projectId()" (closed)="createOpen.set(false)" (created)="onTaskCreated()" />
    }

    <app-task-detail-modal
      [open]="detailOpen()"
      [task]="selectedTask()"
      [projectId]="projectId()"
      [isObjectiveOwner]="selectedTask() ? (objectiveOwners()[selectedTask()!.objectiveId] || false) : false"
      [isAssignee]="selectedTask() ? selectedTask()!.assigneeEmployeeIds.includes(currentEmployeeId()) : false"
      [currentEmployeeId]="currentEmployeeId()"
      [statuses]="statuses()"
      (closed)="detailOpen.set(false)"
      (saved)="onTaskSaved()"
    />
  `,
  styles: [`
    .my-task__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
    .my-task__view-toggle { display: flex; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
    .my-task__view-toggle button { padding: 6px 12px; background: var(--color-surface); border: none; font-size: 13px; }
    .my-task__view-toggle--active { background: var(--color-focus-ring); color: white; }
    .my-task__board { display: flex; gap: 12px; overflow-x: auto; }
    .my-task__empty { color: var(--color-text-secondary); font-size: 13px; }
  `]
})
export class MyTaskComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly taskApi = inject(TaskApiService);
  private readonly sprintStore = inject(SprintListStore);
  private readonly projectStore = inject(ProjectDetailStore);
  private readonly currentEmployee = inject(CurrentEmployeeStore);

  view = signal<'board' | 'list'>('board');
  search = signal('');
  sprintFilter = signal<string | null>(null);
  tasks = signal<WorkTask[]>([]);
  statuses = signal<TaskStatusColumn[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  createOpen = signal(false);
  detailOpen = signal(false);
  selectedTask = signal<WorkTask | null>(null);

  projectId = computed(() => this.route.parent?.snapshot.paramMap.get('id') ?? '');
  currentEmployeeId = computed(() => this.currentEmployee.id());

  objectiveOwners = computed(() =>
    Object.fromEntries(this.projectStore.milestones().map((module) => [module.objectiveId, module.isOwner]))
  );

  filteredTasks = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.tasks();
    return this.tasks().filter((task) => task.title.toLowerCase().includes(term) || task.shortId.toLowerCase().includes(term));
  });

  columnsWithTasks = computed(() =>
    this.statuses().map((status) => ({
      status,
      tasks: this.filteredTasks().filter((task) => task.statusId === status.id)
    }))
  );

  sprintOptions = computed<SelectOption[]>(() => [
    { value: 'all', label: 'All Sprints' },
    ...this.sprintStore.sprints().map((sprint) => ({ value: sprint.id, label: sprint.name }))
  ]);

  async ngOnInit(): Promise<void> {
    void this.currentEmployee.ensureLoaded();
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [taskDtos, statusDtos] = await Promise.all([
        firstValueFrom(this.taskApi.getMyTasks(this.projectId(), this.sprintFilter() ?? undefined)),
        firstValueFrom(this.taskApi.getStatuses(this.projectId()))
      ]);
      this.tasks.set(taskDtos.map(toWorkTask));
      this.statuses.set(statusDtos);
    } catch {
      this.error.set('Failed to load your tasks.');
    } finally {
      this.loading.set(false);
    }
  }

  setSprintFilter(sprintId: string | null): void {
    this.sprintFilter.set(sprintId);
    void this.load();
  }

  reload(): void {
    void this.load();
  }

  onTaskViewed(task: WorkTask): void {
    this.selectedTask.set(task);
    this.detailOpen.set(true);
  }

  async onTaskDropped(event: { taskId: string; newStatusId: string }): Promise<void> {
    try {
      await firstValueFrom(this.taskApi.moveTaskStatus(event.taskId, event.newStatusId));
    } catch {
      this.error.set('Failed to move the task.');
    }
    await this.load();
  }

  onTaskCreated(): void {
    this.createOpen.set(false);
    void this.load();
  }

  onTaskSaved(): void {
    this.detailOpen.set(false);
    void this.load();
  }
}
