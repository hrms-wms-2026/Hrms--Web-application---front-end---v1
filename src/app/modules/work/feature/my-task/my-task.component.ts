import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CurrentEmployeeStore } from '../../state/current-employee.store';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { SprintListStore } from '../../state/sprint-list.store';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { toWorkTask } from '../../utils/task.mapper';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';
import { TaskTableComponent } from '../../ui/task-table/task-table.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../../ui/work-dropdown/work-dropdown.component';

@Component({
  selector: 'app-my-task',
  standalone: true,
  imports: [TaskBoardColumnComponent, TaskTableComponent, ButtonComponent, ErrorStateComponent, WorkDropdownComponent],
  template: `
    <div class="my-task__toolbar">
      <div class="my-task__view-toggle" role="group" aria-label="Task view">
        <button data-testid="my-task-view-toggle-list" type="button" [class.my-task__view-toggle--active]="view() === 'list'" [attr.aria-pressed]="view() === 'list'" (click)="view.set('list')">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5h12M4 10h12M4 15h12" /></svg>
          <span>List</span>
        </button>
        <button data-testid="my-task-view-toggle-board" type="button" [class.my-task__view-toggle--active]="view() === 'board'" [attr.aria-pressed]="view() === 'board'" (click)="view.set('board')">
          <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="5" height="14" rx="1" /><rect x="10.5" y="3" width="6.5" height="6" rx="1" /><rect x="10.5" y="11" width="6.5" height="6" rx="1" /></svg>
          <span>Board</span>
        </button>
      </div>
      <label class="my-task__search">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.25" /><path d="m12.5 12.5 4 4" /></svg>
        <input data-testid="my-task-search" type="text" placeholder="Search my tasks" aria-label="Search my tasks" (input)="search.set($any($event.target).value)" />
      </label>
      <div class="my-task__toolbar-actions">
        <app-work-dropdown [options]="sprintOptions()" [selected]="sprintFilter() ?? 'all'" accessibleLabel="Sprint filter" leadingIcon="sprint" (selectionChanged)="setSprintFilter($event === 'all' ? null : $event)" />
        <app-button variant="primary" (pressed)="goToCreate()">Create task</app-button>
      </div>
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
  `,
  styles: [`
    .my-task__toolbar { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(240px, 320px) minmax(300px, 1fr); align-items: center; gap: 18px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--color-border); }
    .my-task__view-toggle { display: inline-flex; justify-self: start; gap: 2px; padding: 3px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-secondary); }
    .my-task__view-toggle button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 78px; height: 32px; padding: 0 12px; border: 0; border-radius: 7px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease; }
    .my-task__view-toggle button:hover { color: var(--color-text-primary); }
    .my-task__view-toggle button:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .my-task__view-toggle button svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .my-task__view-toggle button svg rect { fill: none; }
    .my-task__view-toggle--active { background: var(--color-surface); color: var(--color-accent); box-shadow: 0 1px 3px rgb(15 23 42 / .12); }
    .my-task__search { display: flex; align-items: center; justify-self: center; width: 100%; max-width: 320px; min-width: 0; height: 38px; gap: 8px; padding: 0 11px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-secondary); }
    .my-task__search:focus-within { border-color: var(--color-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-focus-ring) 28%, transparent); }
    .my-task__search svg { width: 15px; height: 15px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
    .my-task__search input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; }
    .my-task__search input::placeholder { color: var(--color-text-secondary); }
    .my-task__toolbar-actions { display: flex; align-items: center; justify-self: end; gap: 10px; min-width: 0; }
    .my-task__toolbar-actions app-work-dropdown { min-width: 142px; }
    .my-task__board { display: flex; gap: 12px; overflow-x: auto; }
    .my-task__empty { color: var(--color-text-secondary); font-size: 13px; }
    @media (max-width: 860px) { .my-task__toolbar { grid-template-columns: auto minmax(180px, 1fr) auto; gap: 12px; } .my-task__toolbar-actions { gap: 8px; } .my-task__toolbar-actions app-work-dropdown { min-width: 125px; } }
    @media (max-width: 760px) { .my-task__toolbar { display: flex; align-items: stretch; flex-direction: column; gap: 12px; } .my-task__view-toggle { align-self: flex-start; } .my-task__search { align-self: stretch; max-width: none; } .my-task__toolbar-actions { width: 100%; justify-content: space-between; } .my-task__toolbar-actions app-work-dropdown { flex: 1; } }
    @media (max-width: 460px) { .my-task__toolbar-actions { align-items: stretch; flex-direction: column; } .my-task__toolbar-controls app-work-dropdown { width: 100%; } .my-task__view-toggle { width: 100%; } .my-task__view-toggle button { flex: 1; } }
  `]
})
export class MyTaskComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taskApi = inject(TaskApiService);
  private readonly sprintStore = inject(SprintListStore);
  private readonly currentEmployee = inject(CurrentEmployeeStore);

  view = signal<'board' | 'list'>('board');
  search = signal('');
  sprintFilter = signal<string | null>(null);
  tasks = signal<WorkTask[]>([]);
  statuses = signal<TaskStatusColumn[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  projectId = computed(() => this.route.parent?.snapshot.paramMap.get('id') ?? '');
  currentEmployeeId = computed(() => this.currentEmployee.id());

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

  sprintOptions = computed<WorkDropdownOption[]>(() => [
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
    void this.router.navigate(['/work', this.projectId(), 'task', task.id]);
  }

  async onTaskDropped(event: { taskId: string; newStatusId: string }): Promise<void> {
    try {
      await firstValueFrom(this.taskApi.moveTaskStatus(event.taskId, event.newStatusId));
    } catch {
      this.error.set('Failed to move the task.');
    }
    await this.load();
  }

  goToCreate(): void {
    void this.router.navigate(['/work', this.projectId(), 'task', 'new']);
  }
}
