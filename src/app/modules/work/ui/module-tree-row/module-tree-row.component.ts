import { Component, input, output } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { isLeafObjective } from '../../utils/project.mapper';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-module-tree-row',
  standalone: true,
  imports: [AvatarComponent],
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
        <svg data-testid="folder-icon" class="h-4 w-4 shrink-0 {{ selected() ? 'text-white' : 'text-[var(--color-accent)]' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a4 4 0 0 1-2-2V6Z" />
        </svg>
        <span data-testid="title-text" class="min-w-0 truncate text-sm {{ selected() ? 'text-white' : 'text-[var(--color-text-primary)]' }}">{{ node().title }}</span>
        @if (node().isAchieved) {
          <span data-testid="achieved-badge" class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {{ selected() ? 'bg-white/15 text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]' }}">Achieved</span>
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

      <span
        data-testid="owner-cell"
        class="inline-flex shrink-0"
        style="--color-profile-bg: var(--color-accent); --color-profile-text: #ffffff; --color-border: #ffffff;"
      >
        <app-avatar [userName]="node().ownerName" size="sm" />
      </span>

      <span class="text-xs {{ selected() ? 'text-white' : 'text-[var(--color-text-secondary)]' }}" data-testid="due-date-cell">{{ node().endDate }}</span>

      <span class="flex items-center justify-end gap-0.5" data-testid="row-actions">
        @if (node().isOwner) {
          <button type="button" class="{{ iconClass() }}" data-testid="create-sub-button" aria-label="Create sub Module" (click)="emit($event, createRequested)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button type="button" class="{{ iconClass() }}" data-testid="edit-button" aria-label="Edit" (click)="emit($event, editRequested)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button type="button" class="{{ iconClass() }}" data-testid="members-button" aria-label="Members" (click)="emit($event, membersRequested)">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
          <button type="button" class="{{ iconClass() }}" data-testid="create-task-button" aria-label="Create task" (click)="emit($event, createTaskRequested)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </button>
          @if (isLeaf()) {
            <button type="button" class="{{ iconClass() }}" data-testid="create-sprint-button" aria-label="Create sprint" (click)="emit($event, createSprintRequested)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="8" y1="3" x2="8" y2="7" />
                <line x1="16" y1="3" x2="16" y2="7" />
              </svg>
            </button>
          }
          <button
            type="button"
            class="{{ iconClass() }}"
            data-testid="achieve-button"
            [attr.aria-label]="node().isAchieved ? 'Unachieve module' : 'Achieve module'"
            (click)="emit($event, achieveRequested)"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
              <path d="M17 4h3v3a3 3 0 0 1-3 3" />
              <path d="M7 4H4v3a3 3 0 0 0 3 3" />
            </svg>
          </button>
        }
      </span>
    </div>
  `
})
export class ModuleTreeRowComponent {
  node = input.required<MilestoneTreeNode>();
  selected = input(false);
  depth = input(0);
  showChevron = input(false);
  expanded = input(false);

  selectedRow = output<MilestoneTreeNode>();
  chevronClicked = output<Event>();
  retryClicked = output<Event>();
  createRequested = output<MilestoneTreeNode>();
  editRequested = output<MilestoneTreeNode>();
  membersRequested = output<MilestoneTreeNode>();
  createTaskRequested = output<MilestoneTreeNode>();
  createSprintRequested = output<MilestoneTreeNode>();
  achieveRequested = output<MilestoneTreeNode>();

  isLeaf(): boolean {
    return isLeafObjective(this.node());
  }

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
