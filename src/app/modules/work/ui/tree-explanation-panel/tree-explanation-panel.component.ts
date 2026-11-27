import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { isLeafObjective } from '../../utils/project.mapper';
import { MonitorAlertDto } from '../../models/dto/monitor.dto';

const MENU_ICONS = {
  members: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  createTask: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 8v8M8 12h8',
  createSprint: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  requestHours: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3 2',
  completeSprint: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8 12l2.5 2.5L16 9',
  delete: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'
};

/**
 * Details of the node picked in the project tree (module, sprint or work item), styled like the project details
 * card: soft grey boxes for the facts, the hours and the quick actions. A module's less-used actions (members,
 * add work item, add sprint, request more hours) and a sprint's (complete, delete) live in the "..." menu at the top right.
 */
@Component({
  selector: 'app-tree-explanation-panel',
  standalone: true,
  imports: [CardComponent, EmployeeAvatarComponent, RouterLink, DropdownMenuComponent],
  template: `
    <app-card>
      <div data-testid="tree-explanation-panel" class="flex flex-col gap-4 p-4">
        <!-- Kind, title, status and the "..." menu -->
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="mb-1 flex items-center gap-2">
              <span class="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" aria-hidden="true"></span>
              <span class="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">{{ kindLabel() }} Details</span>
            </div>
            <h2 class="truncate text-base font-bold leading-tight text-[var(--color-text-primary)]">{{ node().title }}</h2>
            @if (kind() !== 'objective' && node().status; as status) {
              <span data-testid="panel-status" class="mt-2 inline-flex rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-0.5 text-xs font-semibold capitalize text-[var(--color-text-secondary)]">{{ status }}</span>
            }
            @if (kind() === 'objective' && node().isAchieved) {
              <span data-testid="panel-achieved" class="mt-2 inline-flex rounded-full bg-[color-mix(in_srgb,var(--color-success)_15%,var(--color-surface))] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-success)]">Achieved</span>
            }
          </div>
          @if (menuItems().length > 0) {
            <app-dropdown-menu [items]="menuItems()" ariaLabel="More actions" (selected)="onMenu($event)">
              <span menu-trigger data-testid="panel-more" aria-label="More actions"
                class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
              </span>
            </app-dropdown-menu>
          }
        </div>

        @if (alerts().length > 0) {
          <div data-testid="panel-alerts" role="status" [class.opacity-50]="alertsMuted()"
            class="flex flex-col gap-2 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-3 py-2.5">
            <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-danger)]">
              <span class="h-2 w-2 shrink-0 rounded-full bg-[var(--color-danger)]" aria-hidden="true"></span>
              {{ alerts().length === 1 ? 'Alert' : alerts().length + ' alerts' }}
            </div>
            @if (alertsMuted()) {
              <p data-testid="panel-alerts-muted" class="text-[11px] text-[var(--color-text-secondary)]">Achieved milestone - for information only, no action needed.</p>
            }
            <ul class="flex flex-col gap-1.5">
              @for (alert of alerts(); track alert.id) {
                <li data-testid="panel-alert-message" class="text-xs leading-relaxed text-[var(--color-text-primary)]">
                  {{ alert.message }}
                  <a data-testid="panel-alert-inbox-link" class="ml-1 font-semibold text-[var(--color-accent)] hover:underline"
                    [routerLink]="['/inbox', 'work', 'monitor_alert', alert.id]">Open in Inbox</a>
                </li>
              }
            </ul>
          </div>
        }

        @if (node().description; as description) {
          <p data-testid="panel-description" class="-mt-1 text-[13px] leading-snug text-[var(--color-text-secondary)]">{{ description }}</p>
        }

        <!-- Facts -->
        <div [class]="box">
          <h3 class="mb-3 text-sm font-bold text-[var(--color-text-primary)]">{{ kindLabel() }} Information</h3>
          <dl class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-2.5 text-sm">
            @if (kind() === 'objective') {
              <dt class="flex items-center gap-2.5 text-[var(--color-text-secondary)]">
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
                Owner
              </dt>
              <dd data-testid="panel-owner" class="truncate font-semibold text-[var(--color-text-primary)]">{{ node().ownerName ?? '—' }}</dd>
              <dt class="flex items-center gap-2.5 text-[var(--color-text-secondary)]">
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
                Start Date
              </dt>
              <dd class="font-semibold tabular-nums text-[var(--color-text-primary)]">{{ node().startDate }}</dd>
              <dt class="flex items-center gap-2.5 text-[var(--color-text-secondary)]">
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
                Target Date
              </dt>
              <dd class="font-semibold tabular-nums text-[var(--color-text-primary)]">{{ node().endDate }}</dd>
            }
            @if (kind() === 'sprint') {
              <dt class="flex items-center gap-2.5 text-[var(--color-text-secondary)]">
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>
                Window
              </dt>
              <dd class="font-semibold tabular-nums text-[var(--color-text-primary)]">{{ node().startDate }} – {{ node().endDate }}</dd>
            }
            @if (kind() === 'task') {
              <dt class="flex items-center gap-2.5 text-[var(--color-text-secondary)]">
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
                Assignee
              </dt>
              <dd data-testid="panel-assignee" class="min-w-0">
                @if (assigneeId(); as id) {
                  <app-employee-avatar [employeeId]="id" [showName]="true" />
                } @else {
                  <span class="font-semibold text-[var(--color-text-primary)]">Unassigned</span>
                }
              </dd>
            }
          </dl>
        </div>

        <!-- Hours at a glance -->
        @if (kind() !== 'task') {
          <div class="grid grid-cols-3 gap-2.5">
            <div [class]="tile">
              <p class="text-lg font-bold leading-tight tabular-nums text-[var(--color-text-primary)]">{{ node().allocatedHours }}h</p>
              <p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">Allocated</p>
            </div>
            <div [class]="tile">
              <p class="text-lg font-bold leading-tight tabular-nums text-[var(--color-text-primary)]">{{ node().completedHours }}h</p>
              <p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">Completed</p>
            </div>
            <div [class]="tile">
              <p class="text-lg font-bold leading-tight tabular-nums text-[var(--color-text-primary)]">{{ hoursProgress() }}%</p>
              <p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">Progress</p>
            </div>
          </div>
        }

        @if (kind() === 'sprint') {
          <span data-testid="panel-progress-track" class="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-widget-track)]">
            <span class="block h-full rounded-full bg-[var(--color-widget-shade-1)]" [style.width.%]="node().progress"></span>
          </span>
        }

        <!-- Quick actions -->
        @if (hasQuickActions()) {
          <div [class]="box">
            <h3 class="mb-3 text-sm font-bold text-[var(--color-text-primary)]">Quick Actions</h3>
            <div class="grid grid-cols-2 gap-2.5">
              @if (kind() === 'objective' && node().isOwner) {
                <button type="button" [class]="secondaryBtn" data-testid="panel-create-sub" (click)="createRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg><span>Sub milestone</span></button>
                <button type="button" [class]="secondaryBtn" data-testid="panel-edit" (click)="editRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg><span>Edit milestone</span></button>
                <button type="button" [class]="primaryBtn + ' col-span-2'" data-testid="panel-achieve" (click)="achieveRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 4h3v3a3 3 0 0 1-3 3M7 4H4v3a3 3 0 0 0 3 3" /></svg><span>{{ node().isAchieved ? 'Unachieve milestone' : 'Achieve milestone' }}</span></button>
              }
              @if (kind() === 'sprint' && node().isOwner) {
                <button type="button" [class]="secondaryBtn" data-testid="panel-create-task" (click)="createTaskRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8 12h8" /></svg><span>Create work item</span></button>
                <button type="button" [class]="secondaryBtn" data-testid="panel-edit" (click)="editRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg><span>Edit sprint</span></button>
                <button type="button" [class]="primaryBtn + ' col-span-2'" data-testid="panel-achieve-sprint" (click)="achieveSprintRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM17 4h3v3a3 3 0 0 1-3 3" /></svg><span>Achieve sprint</span></button>
              }
              @if (kind() === 'task') {
                <button type="button" [class]="secondaryBtn" [class.col-span-2]="!node().isOwner" data-testid="panel-edit" (click)="editRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg><span>Edit task</span></button>
                @if (node().isOwner) {
                  <button type="button" [class]="secondaryBtn" data-testid="panel-delete" (click)="deleteRequested.emit(node())"><svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg><span>Delete task</span></button>
                }
              }
            </div>
          </div>
        }
      </div>
    </app-card>
  `
})
export class TreeExplanationPanelComponent {
  node = input.required<MilestoneTreeNode>();
  /** Open project-monitor alerts on this node (e.g. overload), explained in full here. */
  alerts = input<readonly MonitorAlertDto[]>([]);
  readonly alertsMuted = computed(() => this.alerts().every((alert) => alert.inAchievedModule));

  editRequested = output<MilestoneTreeNode>();
  membersRequested = output<MilestoneTreeNode>();
  achieveRequested = output<MilestoneTreeNode>();
  createRequested = output<MilestoneTreeNode>();
  createSprintRequested = output<MilestoneTreeNode>();
  createTaskRequested = output<MilestoneTreeNode>();
  achieveSprintRequested = output<MilestoneTreeNode>();
  completeSprintRequested = output<MilestoneTreeNode>();
  /** Only offered for a complete or achieved sprint. */
  deleteSprintRequested = output<MilestoneTreeNode>();
  deleteRequested = output<MilestoneTreeNode>();
  /** Ask for more allocated hours on this module (sent for approval when needed). */
  allocationRequested = output<MilestoneTreeNode>();

  /** Same soft grey box as the project details card. */
  readonly box = 'rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text-primary)_2%,var(--color-surface))] px-3.5 py-3.5';
  readonly tile = 'rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-text-primary)_2%,var(--color-surface))] px-2 py-3 text-center';
  readonly primaryBtn = 'inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent-solid)] px-3 text-sm font-semibold text-[var(--color-text-on-solid)] shadow-sm transition-[filter,transform] hover:brightness-95 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';
  readonly secondaryBtn = 'inline-flex h-9 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[13px] [&>span]:truncate font-semibold text-[var(--color-text-primary)] shadow-xs transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';

  readonly kind = computed(() => this.node().kind ?? 'objective');
  readonly kindLabel = computed(() => {
    const kind = this.kind();
    if (kind === 'sprint') return 'Sprint';
    if (kind === 'task') return 'Task';
    return 'Milestone';
  });
  readonly hoursProgress = computed(() => {
    const allocated = this.node().allocatedHours;
    if (allocated <= 0) return 0;
    return Math.round((this.node().completedHours / allocated) * 100);
  });

  /** A module's secondary actions: members, work items and sprints for its owner; more hours for anyone while open. */
  readonly menuItems = computed<MenuItem[]>(() => {
    const node = this.node();
    if (this.kind() === 'sprint') {
      if (!node.isOwner) return [];
      const sprintItems: MenuItem[] = [{ id: 'complete-sprint', label: 'Complete sprint', iconPath: MENU_ICONS.completeSprint }];
      if (node.status === 'complete' || node.status === 'achieved') {
        sprintItems.push({ id: 'delete-sprint', label: 'Delete sprint', iconPath: MENU_ICONS.delete, danger: true, dividerBefore: true });
      }
      return sprintItems;
    }
    if (this.kind() !== 'objective') return [];
    const items: MenuItem[] = [];
    if (node.isOwner) {
      items.push({ id: 'members', label: 'Members', iconPath: MENU_ICONS.members });
      items.push({ id: 'create-task', label: 'Add work item', iconPath: MENU_ICONS.createTask });
      if (isLeafObjective(node)) items.push({ id: 'create-sprint', label: 'Add sprint', iconPath: MENU_ICONS.createSprint });
    }
    if (!node.isAchieved) {
      items.push({ id: 'request-hours', label: 'Request more hours', iconPath: MENU_ICONS.requestHours, dividerBefore: items.length > 0 });
    }
    return items;
  });

  readonly hasQuickActions = computed(() => this.kind() === 'task' || this.node().isOwner);

  protected onMenu(id: string): void {
    const node = this.node();
    if (id === 'members') this.membersRequested.emit(node);
    else if (id === 'create-task') this.createTaskRequested.emit(node);
    else if (id === 'create-sprint') this.createSprintRequested.emit(node);
    else if (id === 'request-hours') this.allocationRequested.emit(node);
    else if (id === 'complete-sprint') this.completeSprintRequested.emit(node);
    else if (id === 'delete-sprint') this.deleteSprintRequested.emit(node);
  }

  assigneeId(): string | null {
    return this.node().taskSource?.assigneeEmployeeIds[0] ?? null;
  }
}
