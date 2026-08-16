import { DatePipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { WorkTask } from '../../models/task.model';

type SortKey = 'title' | 'statusId' | 'dueDate' | 'estimatedHours';

@Component({
  selector: 'app-task-table',
  standalone: true,
  imports: [DatePipe],
  template: `
    <table class="task-table">
      <thead>
        <tr>
          <th>ID</th>
          <th (click)="toggleSort('title')">Title</th>
          <th (click)="toggleSort('statusId')">Status</th>
          <th (click)="toggleSort('dueDate')">Due</th>
          <th (click)="toggleSort('estimatedHours')">Est. hours</th>
          <th>Priority</th>
        </tr>
      </thead>
      <tbody>
        @for (task of sortedTasks(); track task.id) {
          <tr [attr.data-testid]="'task-row-' + task.id">
            <td>{{ task.shortId }}</td>
            <td>{{ task.title }}</td>
            <td>{{ statusName(task.statusId) }}</td>
            <td>{{ task.dueDate ? (task.dueDate | date: 'MMM d, y') : '—' }}</td>
            <td>{{ task.estimatedHours ?? '—' }}</td>
            <td>{{ task.priority }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: [`
    .task-table {
      width: 100%;
      border-collapse: collapse;
      color: var(--color-text-primary);
    }
    .task-table th,
    .task-table td {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid var(--color-border);
      font-size: 13px;
    }
    .task-table th {
      cursor: pointer;
      color: var(--color-text-secondary);
      font-weight: 600;
    }
    .task-table tbody tr:hover {
      background: var(--color-surface-secondary);
    }
  `]
})
export class TaskTableComponent {
  tasks = input.required<readonly WorkTask[]>();
  statusNames = input<Record<string, string>>({});

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
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sortBy.set(key);
    this.sortDirection.set('asc');
  }

  statusName(statusId: string): string {
    return this.statusNames()[statusId] ?? statusId;
  }
}
