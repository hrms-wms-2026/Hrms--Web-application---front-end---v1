import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { WorkTask, TaskStatusColumn } from '../../models/task.model';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
import { TaskBoardStore } from '../../state/task-board.store';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';

type SortKey = 'title' | 'statusId' | 'dueDate' | 'estimatedHours';

@Component({
  selector: 'app-task-table',
  standalone: true,
  imports: [DatePipe, WorkDropdownComponent, TaskClockWidgetComponent, AvatarComponent],
  template: `
    <div class="task-table__scroll">
    <table class="task-table">
      <colgroup>
        @if (selectable()) { <col class="task-table__col-select" /> }
        <col class="task-table__col-module" />
        <col class="task-table__col-title" />
        <col class="task-table__col-assignee" />
        <col class="task-table__col-status" />
        <col class="task-table__col-priority" />
        <col class="task-table__col-due" />
        <col class="task-table__col-hours" />
        <col class="task-table__col-tracked" />
      </colgroup>
      <thead>
        <tr>
          @if (selectable()) {
            <th class="task-table__select-cell">
              <input
                type="checkbox"
                data-testid="task-table-select-all"
                [checked]="allSelected()"
                [indeterminate]="someSelected()"
                (click)="$event.stopPropagation()"
                (change)="onSelectAllChanged($event)"
              />
            </th>
          }
          <th>Module</th>
          <th (click)="toggleSort('title')">Title</th>
          <th>Assignee</th>
          <th (click)="toggleSort('statusId')">Status</th>
          <th>Priority</th>
          <th (click)="toggleSort('dueDate')">Due</th>
          <th (click)="toggleSort('estimatedHours')">Est. hours</th>
          <th>Tracked</th>
        </tr>
      </thead>
      <tbody>
        @for (task of sortedTasks(); track task.id) {
          <tr [attr.data-testid]="'task-row-' + task.id" [class.task-table__row--selected]="isSelected(task.id)" (click)="viewed.emit(task)">
            @if (selectable()) {
              <td class="task-table__select-cell" (click)="$event.stopPropagation()">
                @if (isRowSelectable(task)) {
                  <input
                    type="checkbox"
                    [attr.data-testid]="'task-select-' + task.id"
                    [checked]="isSelected(task.id)"
                    (change)="onRowSelectChanged(task.id, $event)"
                  />
                }
              </td>
            }
            <td [title]="moduleName(task.objectiveId)">{{ moduleName(task.objectiveId) }}</td>
            <td>
              <div class="task-table__title-cell">
                <span class="task-table__title-text" [title]="task.title">{{ task.title }}</span>
                @if (categoryName(task.categoryId); as catName) {
                  <span class="task-table__title-tag">{{ catName }}</span>
                }
              </div>
            </td>
            <td>
              @if (task.assignees.length > 0) {
                <div class="task-table__assignee" [title]="assigneeNames(task)">
                  <app-avatar [avatarUrl]="task.assignees[0].avatarUrl" [userName]="task.assignees[0].name" size="sm" />
                  @if (task.assignees.length > 1) {
                    <span class="task-table__assignee-more">+{{ task.assignees.length - 1 }}</span>
                  }
                </div>
              } @else {
                <span class="task-table__assignee-empty">—</span>
              }
            </td>
            <td class="task-table__status-cell">
              @if (statuses().length > 0) {
                <app-work-dropdown
                  class="task-table__status-select"
                  size="sm"
                  [options]="statusOptions(task)"
                  [selected]="task.statusId"
                  accessibleLabel="Task status"
                  leadingIcon="status"
                  (selectionChanged)="onStatusPicked(task, $event)"
                />
              } @else {
                {{ statusName(task.statusId) }}
              }
            </td>
            <td>
              <span class="task-table__priority" [attr.data-priority]="task.priority">
                <svg class="task-table__priority-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                {{ task.priority }}
              </span>
            </td>
            <td>{{ task.dueDate ? (task.dueDate | date: 'MMM d, y') : '—' }}</td>
            <td>{{ task.estimatedHours ?? '—' }}</td>
            <td class="task-table__tracked-cell" (click)="$event.stopPropagation()">
              @if (isAssignee(task)) {
                <app-task-clock-widget
                  [task]="task"
                  [isAssignee]="isAssignee(task)"
                  [compact]="true"
                  [hasOpenSessionMine]="hasOpenSessionMine(task)"
                  [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee(task)"
                  (clockedIn)="taskChanged.emit()"
                  (pushed)="taskChanged.emit()"
                />
              } @else {
                <span class="task-table__tracked">{{ trackedLabel(task) }}</span>
              }
            </td>
          </tr>
          @if (task.subtaskTotalCount > 0) {
            <tr class="task-table__subtask-toggle-row">
              <td [attr.colspan]="selectable() ? 9 : 8">
                <button
                  type="button"
                  class="task-table__subtask-toggle"
                  [attr.data-testid]="'task-row-' + task.id + '-subtask-toggle'"
                  [attr.aria-expanded]="isExpanded(task.id)"
                  (click)="toggleSubtasks(task.id, $event)"
                >
                  <svg class="task-table__subtask-chevron" [class.task-table__subtask-chevron--open]="isExpanded(task.id)" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                  <span>{{ task.subtaskCompletedCount }}/{{ task.subtaskTotalCount }} subtasks</span>
                </button>
              </td>
            </tr>
            @if (isExpanded(task.id)) {
              @for (subtask of subtasksFor(task.id); track subtask.id) {
                <tr [attr.data-testid]="'task-row-' + subtask.id" class="task-table__subtask-row" (click)="viewed.emit(subtask)">
                  <td [attr.colspan]="selectable() ? 9 : 8" class="task-table__subtask-cell">
                    <span class="task-table__subtask-title">{{ subtask.title }}</span>
                    <span class="task-table__subtask-status">{{ statusName(subtask.statusId) }}</span>
                  </td>
                </tr>
              }
            }
          }
        }
      </tbody>
    </table>
    </div>
  `,
  styles: [`
    .task-table__scroll { overflow-x: auto; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); }
    .task-table { width: 100%; min-width: 986px; table-layout: fixed; border-collapse: separate; border-spacing: 0; color: var(--color-text-primary); }
    .task-table__col-select { width: 3%; }
    .task-table__col-module { width: 16%; }
    .task-table__col-title { width: 28%; }
    .task-table__col-assignee { width: 8%; }
    .task-table__col-status { width: 11%; }
    .task-table__col-priority { width: 9%; }
    .task-table__col-due { width: 10%; }
    .task-table__col-hours { width: 8%; }
    .task-table__col-tracked { width: 7%; }
    .task-table th, .task-table td { text-align: left; padding: 14px; border-bottom: 1px solid var(--color-border); font-size: 13px; white-space: nowrap; vertical-align: middle; }
    .task-table th:not(.task-table__select-cell) { overflow: hidden; text-overflow: ellipsis; }
    /* Ellipsis-truncate plain-text cells only - the Status and Tracked columns host popups
       (dropdown menu / clock push panel) that would get clipped by an overflow:hidden ancestor. */
    .task-table td:not(.task-table__select-cell) { overflow: hidden; text-overflow: ellipsis; }
    .task-table td.task-table__status-cell, .task-table td.task-table__tracked-cell { overflow: visible; text-overflow: clip; }
    .task-table thead tr { background: var(--color-surface-secondary); }
    .task-table th { cursor: pointer; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; transition: color 160ms ease, background-color 160ms ease; }
    .task-table th:hover { color: var(--color-accent); }
    .task-table tbody tr { cursor: pointer; transition: background-color 160ms ease; }
    .task-table tbody tr:last-child td { border-bottom: 0; }
    .task-table tbody tr:hover { background: var(--color-surface-secondary); }
    .task-table__subtask-toggle-row td { padding: 4px 14px 4px 34px; border-bottom: 0; }
    .task-table__subtask-toggle { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; padding: 0; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; cursor: pointer; }
    .task-table__subtask-chevron { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2; transition: transform 120ms ease; }
    .task-table__subtask-chevron--open { transform: rotate(180deg); }
    .task-table__subtask-row:hover { background: var(--color-surface-secondary); }
    .task-table__subtask-cell { padding: 8px 14px 8px 34px !important; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .task-table__subtask-title { font-size: 13px; color: var(--color-text-primary); }
    .task-table__subtask-status { font-size: 11px; color: var(--color-text-secondary); }
    .task-table__status-select { display: inline-block; max-width: 100%; min-width: 0; }
    .task-table__status-select:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    /* work-dropdown hard-codes a 180px min-width for its default free-standing use - inside this
       narrow table column that forces it wider than the cell, spilling into Priority. Capping it
       here keeps the trigger hugging its "In Process"-length content instead of stretching.
       !important: the shared component's own rule has matching specificity, so cascade order
       (not specificity) would otherwise decide the winner - pin it explicitly instead. */
    ::ng-deep .task-table__status-select .work-dropdown { min-width: 0 !important; width: fit-content !important; max-width: 100% !important; }
    ::ng-deep .task-table__status-select .work-dropdown__trigger { width: auto !important; }
    .task-table__title-cell { display: flex; flex-direction: column; gap: 3px; min-width: 0; white-space: normal; }
    .task-table__title-text { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
    .task-table__title-tag { align-self: flex-start; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; padding: 2px 7px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); }
    .task-table__assignee { display: inline-flex; align-items: center; gap: 5px; }
    .task-table__assignee-more { font-size: 11px; font-weight: 600; color: var(--color-text-secondary); }
    .task-table__assignee-empty { color: var(--color-text-secondary); }
    .task-table__priority { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 500; text-transform: capitalize; color: var(--color-text-secondary); }
    .task-table__priority-icon { width: 11px; height: 11px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .task-table__priority[data-priority="critical"], .task-table__priority[data-priority="high"] { color: var(--color-danger); }
    .task-table__priority[data-priority="medium"] { color: var(--color-warning); }
    .task-table__priority[data-priority="medium"] .task-table__priority-icon { transform: rotate(90deg); }
    .task-table__priority[data-priority="low"] { color: var(--color-text-secondary); }
    .task-table__priority[data-priority="low"] .task-table__priority-icon { transform: rotate(180deg); }
    .task-table__tracked { font-size: 12px; color: var(--color-text-secondary); }
    .task-table__select-cell { width: 1%; white-space: nowrap; }
    .task-table__select-cell input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; accent-color: var(--color-accent); }
    .task-table tbody tr.task-table__row--selected { background: var(--color-surface-secondary); }
  `]
})
export class TaskTableComponent {
  private readonly store = inject(TaskBoardStore);

  tasks = input.required<readonly WorkTask[]>();
  statusNames = input<Record<string, string>>({});
  categoryNames = input<Record<string, string>>({});
  moduleNames = input<Record<string, string>>({});
  statuses = input<readonly TaskStatusColumn[]>([]);
  objectiveOwners = input<Record<string, boolean>>({});
  currentEmployeeId = input('');
  // Opt-in: sprint-tab's task tables don't pass this, so they render unchanged with no checkbox column.
  selectable = input(false);
  selectedIds = input<ReadonlySet<string>>(new Set());
  viewed = output<WorkTask>();
  taskChanged = output<void>();
  statusChangeRequested = output<{ taskId: string; newStatusId: string }>();
  selectionChanged = output<{ taskId: string; selected: boolean }>();
  selectAllChanged = output<{ taskIds: string[]; selected: boolean }>();

  protected readonly expandedTaskIds = signal<ReadonlySet<string>>(new Set());
  private readonly loadedTaskIds = new Set<string>();

  subtasksFor(taskId: string): readonly WorkTask[] {
    return this.store.subtasksByParentId()[taskId] ?? [];
  }

  isExpanded(taskId: string): boolean {
    return this.expandedTaskIds().has(taskId);
  }

  toggleSubtasks(taskId: string, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.expandedTaskIds());
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
      if (!this.loadedTaskIds.has(taskId) && this.subtasksFor(taskId).length === 0) {
        this.loadedTaskIds.add(taskId);
        void this.store.loadSubtasks(taskId);
      }
    }
    this.expandedTaskIds.set(next);
  }

  isSelected(taskId: string): boolean {
    return this.selectedIds().has(taskId);
  }

  // Moving a task requires owning its module (the same gate task-form-modal uses to route
  // between a direct edit and a request-for-approval) - a row for a module the caller doesn't
  // own gets no checkbox at all, rather than letting selection attempt a move that would fail.
  isRowSelectable(task: WorkTask): boolean {
    return this.objectiveOwners()[task.objectiveId] ?? false;
  }

  protected readonly selectableTasks = computed(() => this.tasks().filter((t) => this.isRowSelectable(t)));

  protected readonly allSelected = computed(() => {
    const tasks = this.selectableTasks();
    return tasks.length > 0 && tasks.every((t) => this.selectedIds().has(t.id));
  });

  protected readonly someSelected = computed(() => {
    const tasks = this.selectableTasks();
    const selected = this.selectedIds();
    return tasks.some((t) => selected.has(t.id)) && !this.allSelected();
  });

  onRowSelectChanged(taskId: string, event: Event): void {
    this.selectionChanged.emit({ taskId, selected: (event.target as HTMLInputElement).checked });
  }

  onSelectAllChanged(event: Event): void {
    const selected = (event.target as HTMLInputElement).checked;
    this.selectAllChanged.emit({ taskIds: this.selectableTasks().map((t) => t.id), selected });
  }

  isAssignee(task: WorkTask): boolean {
    return task.assigneeEmployeeIds.includes(this.currentEmployeeId());
  }

  hasOpenSessionMine(task: WorkTask): boolean {
    return task.openClockSessionEmployeeId === this.currentEmployeeId() && this.currentEmployeeId() !== '';
  }

  hasOpenSessionOtherEmployee(task: WorkTask): boolean {
    const openBy = task.openClockSessionEmployeeId;
    return openBy !== null && openBy !== this.currentEmployeeId();
  }

  private readonly sortBy = signal<SortKey>('title');
  private readonly sortDirection = signal<'asc' | 'desc'>('asc');

  readonly sortedTasks = computed(() => {
    const key = this.sortBy();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    return [...this.tasks()].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av instanceof Date && bv instanceof Date) return (av.getTime() - bv.getTime()) * direction;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
      return String(av).localeCompare(String(bv)) * direction;
    });
  });

  toggleSort(key: SortKey): void {
    if (this.sortBy() === key) {
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sortBy.set(key);
    this.sortDirection.set('asc');
  }

  statusName(statusId: string): string {
    return this.statusNames()[statusId] ?? statusId;
  }

  categoryName(categoryId: string): string | null {
    return this.categoryNames()[categoryId] ?? null;
  }

  moduleName(objectiveId: string): string {
    return this.moduleNames()[objectiveId] ?? '—';
  }

  assigneeNames(task: WorkTask): string {
    return task.assignees.map((a) => a.name).join(', ');
  }

  // Plain-text fallback for rows where the interactive clock widget is hidden (only the
  // assignee can clock in/out) - keeps the Tracked column populated for everyone else.
  trackedLabel(task: WorkTask): string {
    const minutes = task.totalLoggedMinutes;
    if (!minutes) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    return `${mins}m`;
  }

  availableStatuses(task: WorkTask): readonly TaskStatusColumn[] {
    const isOwner = this.objectiveOwners()[task.objectiveId] ?? false;
    return this.statuses().filter((status) => status.visibility === 'public' || isOwner);
  }

  statusOptions(task: WorkTask): WorkDropdownOption[] {
    return this.availableStatuses(task).map((status) => ({ value: status.id, label: status.name }));
  }

  onStatusPicked(task: WorkTask, newStatusId: string): void {
    this.statusChangeRequested.emit({ taskId: task.id, newStatusId });
  }
}
