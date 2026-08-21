import { Component, input, output } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';

@Component({
  selector: 'app-sprint-tree-row',
  standalone: true,
  template: `
    <div
      class="grid grid-cols-[1fr_112px_40px_88px_72px] items-center gap-3 rounded-md px-2 py-1.5 cursor-pointer {{ selected() ? 'bg-[var(--color-accent)]' : 'hover:bg-[var(--color-surface-secondary)]' }}"
      data-testid="tree-row"
      (click)="selectedRow.emit(node())"
    >
      <span class="flex items-center gap-1.5 min-w-0" [style.paddingLeft.px]="depth() * 20">
        @if (showChevron()) {
          <button
            type="button"
            class="flex h-4 w-4 shrink-0 items-center justify-center transition-transform {{ selected() ? 'text-white' : 'text-[var(--color-text-secondary)]' }}"
            [style.transform]="expanded() ? 'rotate(90deg)' : 'rotate(0deg)'"
            data-testid="chevron"
            [attr.aria-label]="expanded() ? 'Collapse' : 'Expand'"
            (click)="onChevron($event)"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        } @else {
          <span class="h-4 w-4 shrink-0"></span>
        }
        <svg data-testid="sprint-icon" class="h-4 w-4 shrink-0 {{ selected() ? 'text-white' : 'text-[var(--color-accent)]' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="M8 14l2 2 4-4" />
        </svg>
        <span data-testid="title-text" class="truncate text-sm {{ selected() ? 'text-white' : 'text-[var(--color-text-primary)]' }}">{{ node().title }}</span>
        @if (node().status; as status) {
          <span data-testid="status-badge" class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {{ selected() ? 'bg-white/15 text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]' }}">{{ status }}</span>
        }
        @if (node().sprintTaskLoadState === 'error') {
          <button
            type="button"
            class="shrink-0 rounded-md px-1.5 py-0.5 text-xs {{ selected() ? 'text-white hover:bg-white/20' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]' }}"
            data-testid="retry-sprint-task-load"
            (click)="onRetry($event)"
          >Retry</button>
        }
      </span>

      <span class="flex items-center gap-2 text-xs {{ selected() ? 'text-white' : 'text-[var(--color-text-secondary)]' }}" data-testid="progress-cell">
        <span data-testid="progress-track" class="h-1.5 w-16 overflow-hidden rounded-full {{ selected() ? 'bg-white/25' : 'bg-[var(--color-surface-secondary)]' }}">
          <span data-testid="progress-fill" class="block h-full rounded-full {{ selected() ? 'bg-white' : 'bg-[var(--color-accent)]' }}" [style.width.%]="node().progress"></span>
        </span>
        {{ node().progress }}%
      </span>

      <span data-testid="owner-cell"></span>
      <span class="text-xs {{ selected() ? 'text-white' : 'text-[var(--color-text-secondary)]' }}" data-testid="due-date-cell">{{ node().endDate }}</span>

      <span class="flex items-center justify-end gap-0.5" data-testid="row-actions">
        @if (node().isOwner) {
          <button type="button" class="{{ iconClass() }}" data-testid="create-task-button" aria-label="Create task" (click)="emit($event, createTaskRequested)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button type="button" class="{{ iconClass() }}" data-testid="edit-button" aria-label="Edit sprint" (click)="emit($event, editRequested)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button type="button" class="{{ iconClass() }}" data-testid="achieve-sprint-button" aria-label="Achieve sprint" (click)="emit($event, achieveSprintRequested)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
            </svg>
          </button>
          <button type="button" class="{{ iconClass() }}" data-testid="complete-sprint-button" aria-label="Complete sprint" (click)="emit($event, completeSprintRequested)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </button>
        }
      </span>
    </div>
  `
})
export class SprintTreeRowComponent {
  node = input.required<MilestoneTreeNode>();
  selected = input(false);
  depth = input(0);
  showChevron = input(false);
  expanded = input(false);

  selectedRow = output<MilestoneTreeNode>();
  chevronClicked = output<Event>();
  retryClicked = output<Event>();
  createTaskRequested = output<MilestoneTreeNode>();
  editRequested = output<MilestoneTreeNode>();
  achieveSprintRequested = output<MilestoneTreeNode>();
  completeSprintRequested = output<MilestoneTreeNode>();

  iconClass(): string {
    return this.selected()
      ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors text-white hover:bg-white/20'
      : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]';
  }

  emit(event: Event, channel: { emit: (node: MilestoneTreeNode) => void }): void {
    event.stopPropagation();
    channel.emit(this.node());
  }

  onChevron(event: Event): void {
    event.stopPropagation();
    this.chevronClicked.emit(event);
  }

  onRetry(event: Event): void {
    event.stopPropagation();
    this.retryClicked.emit(event);
  }
}
