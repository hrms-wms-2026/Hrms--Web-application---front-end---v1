import { Component, OnInit, input, output, signal } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { isLeafObjective } from '../../utils/project.mapper';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-milestone-tree-node',
  standalone: true,
  imports: [MilestoneTreeNodeComponent, AvatarComponent],
  template: `
    <div>
      <div
        class="grid grid-cols-[1fr_112px_40px_88px_32px] items-center gap-3 rounded-md px-2 py-1.5 cursor-pointer {{ isSelected() ? 'bg-[var(--color-accent)]' : 'hover:bg-[var(--color-surface-secondary)]' }}"
        data-testid="tree-row"
        (click)="selected.emit(node())"
      >
        <span class="flex items-center gap-1.5 min-w-0" [style.paddingLeft.px]="depth() * 20">
          @if (showChevron()) {
            <button
              type="button"
              class="flex h-4 w-4 shrink-0 items-center justify-center transition-transform {{ isSelected() ? 'text-white' : 'text-[var(--color-text-secondary)]' }}"
              [style.transform]="expanded() ? 'rotate(90deg)' : 'rotate(0deg)'"
              data-testid="chevron"
              [attr.aria-label]="expanded() ? 'Collapse' : 'Expand'"
              (click)="toggleExpanded($event)"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          } @else {
            <span class="h-4 w-4 shrink-0"></span>
          }
          <svg data-testid="folder-icon" class="h-4 w-4 shrink-0 {{ isSelected() ? 'text-white' : 'text-[var(--color-accent)]' }}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />
          </svg>
          <span data-testid="title-text" class="truncate text-sm {{ isSelected() ? 'text-white' : 'text-[var(--color-text-primary)]' }}">{{ node().title }}</span>
          @if (node().isAchieved) {
            <span data-testid="achieved-badge" class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {{ isSelected() ? 'bg-white/15 text-white' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]' }}">Achieved</span>
          }
          @if (node().sprintTaskLoadState === 'error') {
            <button
              type="button"
              class="shrink-0 rounded-md px-1.5 py-0.5 text-xs {{ isSelected() ? 'text-white hover:bg-white/20' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]' }}"
              data-testid="retry-sprint-task-load"
              (click)="onRetryLoad($event)"
            >Retry</button>
          }
        </span>

        <span class="flex items-center gap-2 text-xs {{ isSelected() ? 'text-white' : 'text-[var(--color-text-secondary)]' }}" data-testid="progress-cell">
          <span data-testid="progress-track" class="h-1.5 w-16 overflow-hidden rounded-full {{ isSelected() ? 'bg-white/25' : 'bg-[var(--color-surface-secondary)]' }}">
            <span data-testid="progress-fill" class="block h-full rounded-full {{ isSelected() ? 'bg-white' : 'bg-[var(--color-accent)]' }}" [style.width.%]="node().progress"></span>
          </span>
          {{ node().progress }}%
        </span>

        <span
          data-testid="owner-cell"
          class="inline-flex shrink-0"
          style="--color-profile-bg: var(--color-accent); --color-profile-text: #ffffff; --color-text-primary: #ffffff; --color-border: #ffffff;"
        >
          <app-avatar [userName]="node().ownerName" size="sm" />
        </span>

        <span class="text-xs {{ isSelected() ? 'text-white' : 'text-[var(--color-text-secondary)]' }}" data-testid="due-date-cell">{{ node().endDate }}</span>

        @if (node().isOwner) {
          <button
            type="button"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors {{ isSelected() ? 'text-white hover:bg-white/20' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]' }}"
            data-testid="create-sub-button"
            aria-label="Create sub Module"
            (click)="onCreateClick($event)"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        }
      </div>

      @if (node().children.length > 0 && expanded()) {
        <div class="flex flex-col gap-0.5">
          @for (child of node().children; track child.id) {
            <app-milestone-tree-node
              [node]="child"
              [selectedId]="selectedId()"
              [expandedByDefault]="false"
              [depth]="depth() + 1"
              (selected)="selected.emit($event)"
              (createRequested)="createRequested.emit($event)"
              (expandLeafRequested)="expandLeafRequested.emit($event)"
              (createSprintRequested)="createSprintRequested.emit($event)"
              (createTaskRequested)="createTaskRequested.emit($event)"
              (editRequested)="editRequested.emit($event)"
              (membersRequested)="membersRequested.emit($event)"
            />
          }
        </div>
      }
    </div>
  `
})
export class MilestoneTreeNodeComponent implements OnInit {
  node = input.required<MilestoneTreeNode>();
  selectedId = input<string | null>(null);
  expandedByDefault = input(true);
  depth = input(0);
  selected = output<MilestoneTreeNode>();
  createRequested = output<MilestoneTreeNode>();
  expandLeafRequested = output<MilestoneTreeNode>();
  createSprintRequested = output<MilestoneTreeNode>();
  createTaskRequested = output<MilestoneTreeNode>();
  editRequested = output<MilestoneTreeNode>();
  membersRequested = output<MilestoneTreeNode>();

  expanded = signal(true);

  ngOnInit(): void {
    this.expanded.set(this.expandedByDefault());
  }

  isSelected(): boolean {
    return this.node().id === this.selectedId();
  }

  showChevron(): boolean {
    return this.node().children.length > 0 || this.canLazyExpand();
  }

  canLazyExpand(): boolean {
    const n = this.node();
    const state = n.sprintTaskLoadState;
    const needsFetch = state === undefined || state === 'unloaded' || state === 'error';
    return needsFetch && (isLeafObjective(n) || n.kind === 'sprint');
  }

  toggleExpanded(event: Event): void {
    event.stopPropagation();
    this.expanded.set(!this.expanded());
    if (this.canLazyExpand()) {
      this.expandLeafRequested.emit(this.node());
    }
  }

  onCreateClick(event: Event): void {
    event.stopPropagation();
    this.createRequested.emit(this.node());
  }

  onRetryLoad(event: Event): void {
    event.stopPropagation();
    this.expandLeafRequested.emit(this.node());
  }
}
