import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EmployeeWorkTaskItem } from '../../models/employee-overview.model';
import { formatDateWithYear } from '../../utils/employee-overview.utils';

const PRIORITY_CLASSES: Record<string, string | undefined> = {
  critical: 'bg-[var(--color-danger-subtle)] text-[var(--color-danger-text)]',
  high: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning-text)]',
  medium: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning-text)]',
  low: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
};

/** One employee work task as a clickable row: id + title, project › module, priority, status and due date.
 *  Shared by the Overview Work card's task list and the offboarding Track Exit Work step. */
@Component({
  selector: 'app-work-task-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--color-accent-subtle)] hover:bg-[var(--color-accent-subtle)]/40 cursor-pointer"
      data-testid="work-task"
      [attr.aria-label]="'Open task ' + task().title"
      (click)="onClick($event)"
    >
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-[var(--color-text-primary)]">
          @if (task().shortId) { <span class="mr-1.5 font-medium text-[var(--color-text-muted)]">{{ task().shortId }}</span> }{{ task().title }}
        </p>
        <p class="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]" data-testid="work-task-where">
          {{ task().projectName }}@if (task().moduleName) { <span class="text-[var(--color-text-muted)]"> › </span>{{ task().moduleName }} }
        </p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <span class="rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize" [class]="priorityClass()" data-testid="work-task-priority">{{ task().priority }}</span>
        <span class="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-surface-secondary)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-primary)]" data-testid="work-task-status">
          <span class="h-2 w-2 rounded-full" [style.background]="task().statusColor || '#94a3b8'"></span>{{ task().statusName }}
        </span>
        <span [class]="task().bucket === 'overdue' ? 'min-w-24 text-right text-xs font-semibold text-[var(--color-danger)]' : 'min-w-24 text-right text-xs text-[var(--color-text-secondary)]'" data-testid="work-task-due">
          @if (task().dueDate; as due) {
            Due {{ shortDate(due) }}@if (task().daysOverdue > 0) { · {{ task().daysOverdue }}d late }
          } @else {
            No due date
          }
        </span>
        <svg class="h-4 w-4 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </div>
    </button>
  `
})
export class WorkTaskRowComponent {
  readonly task = input.required<EmployeeWorkTaskItem>();
  readonly opened = output<EmployeeWorkTaskItem>();

  shortDate = formatDateWithYear;

  priorityClass(): string {
    return PRIORITY_CLASSES[this.task().priority] ?? PRIORITY_CLASSES['medium']!;
  }

  onClick(event: Event): void {
    // The Work card itself is clickable; a row click must not also toggle it.
    event.stopPropagation();
    this.opened.emit(this.task());
  }
}
