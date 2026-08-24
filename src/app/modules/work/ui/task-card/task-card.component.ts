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

      <span class="task-card__status" data-testid="task-card-status">{{ statusName() }}</span>
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
    .task-card__status { display: inline-block; font-size: 11px; color: var(--color-text-secondary); }
  `]
})
export class TaskCardComponent {
  task = input.required<WorkTask>();
  statuses = input<readonly TaskStatusColumn[]>([]);
  employeeNames = input<Record<string, string>>({});

  viewed = output<WorkTask>();

  protected readonly statusName = computed(() =>
    this.statuses().find((s) => s.id === this.task().statusId)?.name ?? this.task().statusId
  );

  protected readonly assigneeNames = computed(() => {
    const names = this.employeeNames();
    return this.task().assigneeEmployeeIds.map((id) => names[id] ?? 'Unknown employee');
  });
}
