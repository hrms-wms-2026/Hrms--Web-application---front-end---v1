import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { WorkTask, TaskStatusColumn } from '../../models/task.model';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
import { TaskBoardStore } from '../../state/task-board.store';

type SortKey = 'title' | 'statusId' | 'dueDate' | 'estimatedHours';

@Component({
  selector: 'app-task-table',
  standalone: true,
  imports: [DatePipe, WorkDropdownComponent, TaskClockWidgetComponent],
  template: `
    <div class="task-table__scroll">
    <table class="task-table">
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
          <th>ID</th>
          <th (click)="toggleSort('title')">Title</th>
          <th (click)="toggleSort('statusId')">Status</th>
          <th (click)="toggleSort('dueDate')">Due</th>
          <th (click)="toggleSort('estimatedHours')">Est. hours</th>
          <th>Priority</th>
          <th>Clock</th>
          <th>View</th>
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
            <td>{{ task.shortId }}</td>
            <td>{{ task.title }}</td>
            <td>
              @if (statuses().length > 0) {
                <app-work-dropdown
                  class="task-table__status-select"
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
            <td>{{ task.dueDate ? (task.dueDate | date: 'MMM d, y') : '—' }}</td>
            <td>{{ task.estimatedHours ?? '—' }}</td>
            <td><span class="task-table__priority" [attr.data-priority]="task.priority">{{ task.priority }}</span></td>
            <td (click)="$event.stopPropagation()">
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
              }
            </td>
            <td><button type="button" class="task-table__view-btn" aria-label="View task" title="View task" (click)="$event.stopPropagation(); viewed.emit(task)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.5" /></svg><span>View</span></button></td>
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
    .task-table { width: 100%; min-width: 760px; border-collapse: separate; border-spacing: 0; color: var(--color-text-primary); }
    .task-table th, .task-table td { text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--color-border); font-size: 13px; white-space: nowrap; }
    .task-table th { cursor: pointer; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; transition: color 160ms ease, background-color 160ms ease; }
    .task-table th:hover { color: var(--color-accent); background: var(--color-surface-secondary); }
    .task-table tbody tr { transition: background-color 160ms ease; }
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
    .task-table__status-select { display: inline-block; min-width: 108px; }
    .task-table__status-select:focus-visible, .task-table__view-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .task-table__priority { font-size: 12px; font-weight: 500; text-transform: capitalize; }
    .task-table__priority[data-priority="critical"], .task-table__priority[data-priority="high"] { color: var(--color-danger); }
    .task-table__view-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--color-border); border-radius: 8px; padding: 7px 10px; background: var(--color-surface); color: var(--color-text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease; }
    .task-table__view-btn:hover { border-color: var(--color-accent); background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .task-table__view-btn svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .task-table__select-cell { width: 1%; white-space: nowrap; }
    .task-table__select-cell input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; accent-color: var(--color-accent); }
    .task-table tbody tr.task-table__row--selected { background: var(--color-surface-secondary); }
  `]
})
export class TaskTableComponent {
  private readonly store = inject(TaskBoardStore);

  tasks = input.required<readonly WorkTask[]>();
  statusNames = input<Record<string, string>>({});
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
