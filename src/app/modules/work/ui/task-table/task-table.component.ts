import { DatePipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { WorkTask, TaskStatusColumn } from '../../models/task.model';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';

type SortKey = 'title' | 'statusId' | 'dueDate' | 'estimatedHours';

@Component({
  selector: 'app-task-table',
  standalone: true,
  imports: [DatePipe, SelectComponent, TaskClockWidgetComponent],
  template: `
    <div class="task-table__scroll">
    <table class="task-table">
      <thead>
        <tr>
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
          <tr [attr.data-testid]="'task-row-' + task.id" (click)="viewed.emit(task)">
            <td>{{ task.shortId }}</td>
            <td>{{ task.title }}</td>
            <td>
              @if (statuses().length > 0) {
                <app-select
                  class="task-table__status-select"
                  [options]="statusOptions(task)"
                  [value]="task.statusId"
                  ariaLabel="Task status"
                  [icon]="'status'"
                  (valueChange)="onStatusPicked(task, $event)"
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
                  [hasOpenSessionMine]="hasOpenSessionMine(task)"
                  [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee(task)"
                  (clockedIn)="taskChanged.emit()"
                  (pushed)="taskChanged.emit()"
                />
              }
            </td>
            <td><button type="button" class="task-table__view-btn" aria-label="View task" title="View task" (click)="$event.stopPropagation(); viewed.emit(task)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.5" /></svg><span>View</span></button></td>
          </tr>
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
    .task-table__status-select { display: inline-block; min-width: 108px; }
    .task-table__status-select:focus-visible, .task-table__view-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .task-table__priority { font-size: 12px; font-weight: 500; text-transform: capitalize; }
    .task-table__priority[data-priority="critical"], .task-table__priority[data-priority="high"] { color: var(--color-danger); }
    .task-table__view-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--color-border); border-radius: 8px; padding: 7px 10px; background: var(--color-surface); color: var(--color-text-secondary); font-size: 12px; font-weight: 500; cursor: pointer; transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease; }
    .task-table__view-btn:hover { border-color: var(--color-accent); background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .task-table__view-btn svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  `]
})
export class TaskTableComponent {
  tasks = input.required<readonly WorkTask[]>();
  statusNames = input<Record<string, string>>({});
  statuses = input<readonly TaskStatusColumn[]>([]);
  objectiveOwners = input<Record<string, boolean>>({});
  currentEmployeeId = input('');
  viewed = output<WorkTask>();
  taskChanged = output<void>();
  statusChangeRequested = output<{ taskId: string; newStatusId: string }>();

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

  statusOptions(task: WorkTask): SelectOption[] {
    return this.availableStatuses(task).map((status) => ({ value: status.id, label: status.name }));
  }

  onStatusPicked(task: WorkTask, newStatusId: string): void {
    this.statusChangeRequested.emit({ taskId: task.id, newStatusId });
  }
}
