import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="task-card" [attr.data-testid]="'task-card-' + task().id" (click)="viewed.emit(task())">
      <div class="task-card__header">
        <span class="task-card__short-id">{{ task().shortId }}</span>
        <button type="button" class="task-card__view-btn" aria-label="View task" (click)="viewed.emit(task()); $event.stopPropagation()">👁</button>
      </div>
      <p class="task-card__title">{{ task().title }}</p>

      @if (assigneeNames().length > 0) {
        <p class="task-card__assignees">👤 {{ assigneeNames().join(', ') }}</p>
      }

      <div class="task-card__meta">
        <span class="task-card__priority" [attr.data-priority]="task().priority">{{ task().priority }}</span>
        @if (task().dueDate) {
          <span class="task-card__due-date">{{ task().dueDate | date: 'MMM d' }}</span>
        }
        @if (task().estimatedHours) {
          <span class="task-card__hours">{{ task().estimatedHours }}h</span>
        }
      </div>

      <select
        #statusSelect
        class="task-card__status-select"
        [value]="task().statusId"
        (click)="$event.stopPropagation()"
        (change)="statusChangeRequested.emit($any($event.target).value); $event.stopPropagation()"
      >
        @for (status of availableStatuses(); track status.id) {
          <option [value]="status.id">{{ status.name }}</option>
        }
      </select>
    </div>
  `,
  styles: [`
    .task-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 10px 12px;
      cursor: pointer;
    }
    .task-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .task-card__view-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .task-card__short-id { font-size: 11px; color: var(--color-text-secondary); }
    .task-card__title { margin: 4px 0; font-size: 13px; color: var(--color-text-primary); }
    .task-card__assignees { margin: 0 0 4px; font-size: 11px; color: var(--color-text-secondary); }
    .task-card__meta { display: flex; gap: 8px; font-size: 11px; color: var(--color-text-secondary); margin-bottom: 6px; }
    .task-card__priority[data-priority="critical"],
    .task-card__priority[data-priority="high"] { color: var(--color-danger); }
    .task-card__status-select { width: 100%; border: 1px solid var(--color-border); border-radius: 6px; padding: 4px 6px; background: var(--color-surface); color: var(--color-text-primary); font-size: 11px; cursor: pointer; }
  `]
})
export class TaskCardComponent {
  task = input.required<WorkTask>();
  statuses = input<readonly TaskStatusColumn[]>([]);
  isObjectiveOwner = input(false);
  employeeNames = input<Record<string, string>>({});

  viewed = output<WorkTask>();
  statusChangeRequested = output<string>();

  // Private statuses are only pickable by the objective owner - mirrors
  // TaskDetailModalComponent.availableStatuses.
  protected readonly availableStatuses = computed(() =>
    [...this.statuses()]
      .filter((s) => s.visibility === 'public' || this.isObjectiveOwner())
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  protected readonly assigneeNames = computed(() => {
    const names = this.employeeNames();
    return this.task().assigneeEmployeeIds.map((id) => names[id] ?? 'Unknown employee');
  });
}
