import { Component, input, output } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { MonitorAlertDto } from '../../models/dto/monitor.dto';
import { TreeAlertMarkComponent } from '../tree-alert-mark/tree-alert-mark.component';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';

@Component({
  selector: 'app-task-tree-row',
  standalone: true,
  imports: [KeyboardClickDirective, EmployeeAvatarComponent, TreeAlertMarkComponent],
  template: `
    <div role="button" tabindex="0" appKeyboardClick
      class="grid grid-cols-[1fr_112px_40px_88px_140px] items-center gap-3 rounded-md px-2 py-1.5 cursor-pointer tree-row {{ selected() ? 'bg-[var(--color-accent)]' : '' }}"
      data-testid="tree-row"
      (click)="selectedRow.emit(node())"
    >
      <span class="flex items-center gap-1.5 min-w-0" [style.paddingLeft.px]="depth() * 20">
        <span class="h-4 w-4 shrink-0"></span>
        <svg data-testid="task-icon" class="h-4 w-4 shrink-0 {{ selected() ? 'text-[var(--color-text-on-solid)]' : 'text-[var(--color-accent)]' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 12l3 3 5-6" />
        </svg>
        <span data-testid="title-text" class="min-w-0 truncate text-sm {{ selected() ? 'text-[var(--color-text-on-solid)]' : 'text-[var(--color-text-primary)]' }}">{{ node().title }}</span>
        <app-tree-alert-mark [alerts]="alerts()" />
        @if (node().status; as status) {
          <span data-testid="status-badge" class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {{ selected() ? 'bg-[var(--color-text-on-solid)]/15 text-[var(--color-text-on-solid)]' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]' }}">{{ status }}</span>
        }
      </span>

      <span class="flex items-center gap-2 text-xs {{ selected() ? 'text-[var(--color-text-on-solid)]' : 'text-[var(--color-text-secondary)]' }}" data-testid="progress-cell">
        <span data-testid="progress-track" class="h-1.5 w-16 overflow-hidden rounded-full {{ selected() ? 'bg-[var(--color-text-on-solid)]/25' : 'bg-[var(--color-surface-secondary)]' }}">
          <span data-testid="progress-fill" class="block h-full rounded-full {{ selected() ? 'bg-[var(--color-text-on-solid)]' : 'bg-[var(--color-accent)]' }}" [style.width.%]="node().progress"></span>
        </span>
        {{ node().progress }}%
      </span>

      <span data-testid="assignee-cell" class="inline-flex shrink-0">
        @if (assigneeId(); as id) {
          <app-employee-avatar [employeeId]="id" />
        } @else {
          <span class="text-xs {{ selected() ? 'text-[var(--color-text-on-solid)]' : 'text-[var(--color-text-secondary)]' }}">—</span>
        }
      </span>

      <span class="text-xs {{ selected() ? 'text-[var(--color-text-on-solid)]' : 'text-[var(--color-text-secondary)]' }}" data-testid="due-date-cell">{{ node().endDate }}</span>

      <span class="flex items-center justify-end gap-px" data-testid="row-actions">
        <button type="button" class="{{ iconClass() }}" data-testid="view-button" aria-label="View task" (click)="emit($event, viewRequested)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <button type="button" class="{{ iconClass() }}" data-testid="edit-button" aria-label="Edit task" (click)="emit($event, editRequested)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        @if (node().isOwner) {
          <button type="button" class="{{ iconClass() }}" data-testid="delete-task-button" aria-label="Delete task" (click)="emit($event, deleteRequested)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        }
      </span>
    </div>
  `
})
export class TaskTreeRowComponent {
  node = input.required<MilestoneTreeNode>();
  selected = input(false);
  depth = input(0);
  /** Open project-monitor alerts on this row's module/sprint/task (red mark). */
  alerts = input<readonly MonitorAlertDto[]>([]);

  selectedRow = output<MilestoneTreeNode>();
  viewRequested = output<MilestoneTreeNode>();
  editRequested = output<MilestoneTreeNode>();
  deleteRequested = output<MilestoneTreeNode>();

  assigneeId(): string | null {
    return this.node().taskSource?.assigneeEmployeeIds[0] ?? null;
  }

  iconClass(): string {
    return this.selected()
      ? 'flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors text-[var(--color-text-on-solid)] hover:bg-[var(--color-text-on-solid)]/20'
      : 'flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]';
  }

  emit(event: Event, channel: { emit: (node: MilestoneTreeNode) => void }): void {
    event.stopPropagation();
    channel.emit(this.node());
  }
}
