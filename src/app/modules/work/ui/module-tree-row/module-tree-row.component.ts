import { Component, ElementRef, OnDestroy, OnInit, input, output, signal, viewChild } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { MonitorAlertDto } from '../../models/dto/monitor.dto';
import { TreeAlertMarkComponent } from '../tree-alert-mark/tree-alert-mark.component';
import { isLeafObjective } from '../../utils/project.mapper';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-module-tree-row',
  standalone: true,
  imports: [AvatarComponent, TreeAlertMarkComponent],
  template: `
    @if (!compact()) {
      <div
        class="grid grid-cols-[1fr_112px_40px_88px_140px] items-center gap-3 rounded-md px-2 py-1.5 cursor-pointer tree-row {{ selected() ? 'bg-[var(--color-accent)]' : '' }}"
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
          <app-tree-alert-mark [alerts]="alerts()" />
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

        <span class="relative flex items-center justify-end gap-px" data-testid="row-actions" #actionsCell>
          @if (node().isOwner) {
            <button type="button" class="{{ iconClass() }}" data-testid="create-sub-button" aria-label="Create sub Module" (click)="emit($event, createRequested)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              type="button"
              class="{{ iconClass() }}"
              data-testid="shortcut-menu-button"
              aria-label="Show all shortcuts"
              [attr.aria-expanded]="actionsOpen()"
              (click)="toggleActions($event)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                <circle cx="5" cy="12" r="1" fill="currentColor" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
                <circle cx="19" cy="12" r="1" fill="currentColor" />
              </svg>
            </button>
            @if (actionsOpen()) {
              <div class="absolute right-0 top-7 z-30 min-w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-lg" data-testid="shortcut-menu">
                <button type="button" class="{{ menuItemClass() }}" data-testid="menu-create-sub-button" (click)="emit($event, createRequested)">
                  <span class="{{ menuIconClass() }}" aria-hidden="true">+</span><span>Sub module</span>
                </button>
                <button type="button" class="{{ menuItemClass() }}" data-testid="menu-edit-button" (click)="emit($event, editRequested)">
                  <span class="{{ menuIconClass() }}" aria-hidden="true">✎</span><span>Edit</span>
                </button>
                <button type="button" class="{{ menuItemClass() }}" data-testid="menu-members-button" (click)="emit($event, membersRequested)">
                  <span class="{{ menuIconClass() }}" aria-hidden="true">♙</span><span>Members</span>
                </button>
                <button type="button" class="{{ menuItemClass() }}" data-testid="menu-create-task-button" (click)="emit($event, createTaskRequested)">
                  <span class="{{ menuIconClass() }}" aria-hidden="true">+</span><span>Create work item</span>
                </button>
                @if (isLeaf()) {
                  <button type="button" class="{{ menuItemClass() }}" data-testid="menu-create-sprint-button" (click)="emit($event, createSprintRequested)">
                    <span class="{{ menuIconClass() }}" aria-hidden="true">□</span><span>Create sprint</span>
                  </button>
                }
                <button type="button" class="{{ menuItemClass() }}" data-testid="menu-achieve-button" (click)="emit($event, achieveRequested)">
                  <span class="{{ menuIconClass() }}" aria-hidden="true">★</span><span>{{ node().isAchieved ? 'Unachieve module' : 'Achieve module' }}</span>
                </button>
              </div>
            }
          }
        </span>
      </div>
    } @else {
      <div
        class="flex items-center gap-2 min-w-0 flex-1 rounded-md px-2 cursor-pointer tree-row {{ selected() ? 'bg-[var(--color-accent)]' : '' }}"
        data-testid="tree-row"
        (click)="selectedRow.emit(node())"
      >
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
        <span class="min-w-0 flex-1">
          <span data-testid="title-text" class="block min-w-0 truncate text-sm {{ selected() ? 'text-white' : 'text-[var(--color-text-primary)]' }}">{{ node().title }}</span>
        </span>
        @if (progressLabel(); as label) {
          <span data-testid="compact-progress-label" class="shrink-0 text-xs font-medium {{ selected() ? 'text-white' : 'text-[var(--color-text-secondary)]' }}">{{ label }}</span>
        }
      </div>
    }
  `
})
export class ModuleTreeRowComponent implements OnInit, OnDestroy {
  node = input.required<MilestoneTreeNode>();
  selected = input(false);
  depth = input(0);
  /** Open project-monitor alerts on this row's module/sprint/task (red mark). */
  alerts = input<readonly MonitorAlertDto[]>([]);
  showChevron = input(false);
    expanded = input(false);
  compact = input(false);
  /** Compact-mode caller's own progress text (e.g. "40%" or "—"), since MilestoneTreeNode's
   *  `progress` is a non-nullable number with no "no data" state. */
  progressLabel = input<string | null>(null);
  actionsOpen = signal(false);

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
      ? 'flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors text-white hover:bg-white/20'
      : 'flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]';
  }

  // A capture-phase listener (not Angular's bubble-phase @HostListener('document:click'),
  // which every other button here would silently block): this popover is tall enough
  // (6 items) to visually overlap several rows below it in the tree, so if the user's
  // next click lands on, say, a lower row's own "Edit task" button while this menu is
  // still open, that button's own click handler calls event.stopPropagation() before the
  // click ever bubbles to document - a bubble-phase listener would never see it, and this
  // popover would still be open (and still overlapping) at the moment that click's target
  // was resolved, so it silently swallows the click and opens THIS module's edit form
  // instead of the task's. Capture phase runs top-down before any target handler executes,
  // so it isn't affected by stopPropagation() called later during bubbling: it closes this
  // popover in reaction to that same click, so by the time the user's very next click
  // happens, the overlap is already gone.
  private readonly actionsCell = viewChild<ElementRef<HTMLElement>>('actionsCell');

  private readonly onDocumentClickCapture = (event: Event): void => {
    const target = event.target as Node | null;
    const cell = this.actionsCell()?.nativeElement;
    // A click on the trigger button or a menu item is already handled by its own
    // (click) binding (toggleActions/emit) - closing here too would race with that
    // handler (e.g. re-opening a menu the trigger click just closed).
    if (cell && target && cell.contains(target)) return;
    this.actionsOpen.set(false);
  };

  ngOnInit(): void {
    document.addEventListener('click', this.onDocumentClickCapture, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.onDocumentClickCapture, true);
  }

  toggleActions(event: Event): void {
    event.stopPropagation();
    this.actionsOpen.update((open) => !open);
  }

  menuItemClass(): string {
    return 'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus-ring)]';
  }

  menuIconClass(): string {
    return 'flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-secondary)] text-sm font-semibold text-[var(--color-text-secondary)]';
  }

  emit(event: Event, channel: { emit: (node: MilestoneTreeNode) => void }): void {
    event.stopPropagation();
    this.actionsOpen.set(false);
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
