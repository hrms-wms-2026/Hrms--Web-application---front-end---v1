import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="task-card" [attr.data-testid]="'task-card-' + task().id">
      <span class="task-card__short-id">{{ task().shortId }}</span>
      <p class="task-card__title">{{ task().title }}</p>
      <div class="task-card__meta">
        <span class="task-card__priority" [attr.data-priority]="task().priority">{{ task().priority }}</span>
        @if (task().dueDate) {
          <span class="task-card__due-date">{{ task().dueDate | date: 'MMM d' }}</span>
        }
        @if (task().estimatedHours) {
          <span class="task-card__hours">{{ task().estimatedHours }}h</span>
        }
      </div>
    </div>
  `,
  styles: [`
    .task-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 10px 12px;
      cursor: grab;
    }
    .task-card__short-id { font-size: 11px; color: var(--color-text-secondary); }
    .task-card__title { margin: 4px 0; font-size: 13px; color: var(--color-text-primary); }
    .task-card__meta { display: flex; gap: 8px; font-size: 11px; color: var(--color-text-secondary); }
    .task-card__priority[data-priority="critical"],
    .task-card__priority[data-priority="high"] { color: var(--color-danger); }
  `]
})
export class TaskCardComponent {
  task = input.required<WorkTask>();
}
