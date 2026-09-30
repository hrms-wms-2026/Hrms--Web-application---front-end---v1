import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { firstValueFrom } from 'rxjs';
import { WorkTask, TaskStatusColumn } from '../../models/task.model';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { TaskBoardStore } from '../../state/task-board.store';
import { TaskApiService } from '../../data-access/task-api.service';
import { isPendingApproval } from '../../models/dto/work-approval.dto';
import { NotificationService } from '../../../../core/services/notification.service';
import { toEditTaskRequest } from '../../utils/task.mapper';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';

type SortKey = 'title' | 'statusId' | 'dueDate' | 'estimatedHours';

const TABLE_POPOVER_POSITIONS: ConnectionPositionPair[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 }
];

@Component({
  selector: 'app-task-table',
  standalone: true,
  imports: [OverlayModule, TaskClockWidgetComponent, AvatarComponent, DatePickerComponent],
  template: `
    <div class="task-table__scroll">
    <table class="task-table">
      <colgroup>
        @if (selectable()) { <col class="task-table__col-select" /> }
        <col class="task-table__col-module" />
        <col class="task-table__col-title" />
        <col class="task-table__col-assignee" />
        <col class="task-table__col-status" />
        <col class="task-table__col-priority" />
        <col class="task-table__col-due" />
        <col class="task-table__col-hours" />
        <col class="task-table__col-tracked" />
      </colgroup>
      <thead>
        <tr>
          @if (selectable()) {
            <th class="task-table__select-cell">
              <input
                type="checkbox"
                data-testid="task-table-select-all"
                [checked]="allSelected()"
                [indeterminate]="someSelected()"
                (click)="$event.stopPropagation()"
                (change)="onSelectAllChanged($event)"
              />
            </th>
          }
          <th>Module</th>
          <th (click)="toggleSort('title')">Title</th>
          <th>Assignee</th>
          <th (click)="toggleSort('statusId')">Status</th>
          <th>Priority</th>
          <th (click)="toggleSort('dueDate')">Due</th>
          <th (click)="toggleSort('estimatedHours')">Est. hours</th>
          <th>Tracked</th>
        </tr>
      </thead>
      <tbody>
        @for (task of sortedTasks(); track task.id) {
          <tr class="task-table__row-card" [attr.data-testid]="'task-row-' + task.id" [class.task-table__row--selected]="isSelected(task.id)" (click)="viewed.emit(task)">
            @if (selectable()) {
              <td class="task-table__select-cell" (click)="$event.stopPropagation()">
                @if (isRowSelectable(task)) {
                  <input
                    type="checkbox"
                    [attr.data-testid]="'task-select-' + task.id"
                    [checked]="isSelected(task.id)"
                    (change)="onRowSelectChanged(task.id, $event)"
                  />
                }
              </td>
            }
            <td [title]="moduleName(task.objectiveId)">{{ moduleName(task.objectiveId) }}</td>
            <td>
              <div class="task-table__title-cell">
                <span class="task-table__title-text" [title]="task.title">{{ task.title }}</span>
                @if (categoryName(task.categoryId); as catName) {
                  <span class="task-table__title-tag">{{ catName }}</span>
                }
              </div>
            </td>
            <td>
              @if (task.assignees.length > 0) {
                <div class="task-table__assignee" [title]="assigneeNames(task)">
                  <app-avatar [avatarUrl]="task.assignees[0].avatarUrl" [userName]="task.assignees[0].name" size="sm" />
                  @if (task.assignees.length > 1) {
                    <span class="task-table__assignee-more">+{{ task.assignees.length - 1 }}</span>
                  }
                </div>
              } @else {
                <span class="task-table__assignee-empty">—</span>
              }
            </td>
            <td class="task-table__status-cell" (click)="$event.stopPropagation()">
              @if (statuses().length > 0) {
                <button
                  type="button"
                  class="task-table__status-btn"
                  [style.background]="statusBgTint(task.statusId)"
                  [style.color]="statusColor(task.statusId)"
                  [attr.data-testid]="'task-status-btn-' + task.id"
                  cdkOverlayOrigin
                  #statusOrigin="cdkOverlayOrigin"
                  [attr.aria-expanded]="isStatusPopoverOpen(task.id)"
                  title="Change status"
                  (click)="toggleStatusPopover(task, $event)"
                >
                  <span class="task-table__status-dot" [style.background]="statusColor(task.statusId)"></span>
                  <span>{{ statusName(task.statusId) }}</span>
                </button>

                <ng-template
                  cdkConnectedOverlay
                  [cdkConnectedOverlayOrigin]="statusOrigin"
                  [cdkConnectedOverlayOpen]="isStatusPopoverOpen(task.id)"
                  [cdkConnectedOverlayPositions]="popoverPositions"
                  [cdkConnectedOverlayHasBackdrop]="true"
                  cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                  (backdropClick)="closePopovers()"
                  (detach)="closePopovers()"
                >
                  <div class="task-table__popover" role="dialog" aria-label="Change status" (click)="$event.stopPropagation()">
                    <div class="task-table__popover-title">Status</div>
                    <div class="task-table__popover-list">
                      @for (opt of availableStatuses(task); track opt.id) {
                        <button
                          type="button"
                          class="task-table__popover-option"
                          [class.task-table__popover-option--selected]="task.statusId === opt.id"
                          (click)="selectStatus(task, opt.id)"
                        >
                          <span class="task-table__status-dot" [style.background]="opt.color"></span>
                          <span>{{ opt.name }}</span>
                          @if (task.statusId === opt.id) {
                            <svg class="task-table__popover-check" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                          }
                        </button>
                      }
                    </div>
                  </div>
                </ng-template>
              } @else {
                {{ statusName(task.statusId) }}
              }
            </td>
            <td (click)="$event.stopPropagation()">
              <button
                type="button"
                class="task-table__priority-btn"
                [attr.data-priority]="task.priority"
                [attr.data-testid]="'task-priority-btn-' + task.id"
                cdkOverlayOrigin
                #priorityOrigin="cdkOverlayOrigin"
                [attr.aria-expanded]="isPriorityPopoverOpen(task.id)"
                title="Change priority"
                (click)="togglePriorityPopover(task, $event)"
              >
                <svg class="task-table__priority-icon" [attr.data-priority]="task.priority" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                <span>{{ task.priority }}</span>
              </button>

              <ng-template
                cdkConnectedOverlay
                [cdkConnectedOverlayOrigin]="priorityOrigin"
                [cdkConnectedOverlayOpen]="isPriorityPopoverOpen(task.id)"
                [cdkConnectedOverlayPositions]="popoverPositions"
                [cdkConnectedOverlayHasBackdrop]="true"
                cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                (backdropClick)="closePopovers()"
                (detach)="closePopovers()"
              >
                <div class="task-table__popover task-table__priority-popover" role="dialog" aria-label="Change priority" (click)="$event.stopPropagation()">
                  <div class="task-table__popover-title">Priority</div>
                  <div class="task-table__popover-list">
                    @for (opt of priorityOptions; track opt.value) {
                      <button
                        type="button"
                        class="task-table__popover-option"
                        [class.task-table__popover-option--selected]="task.priority === opt.value"
                        (click)="selectPriority(task, opt.value)"
                      >
                        <svg class="task-table__priority-icon" [attr.data-priority]="opt.value" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                        <span>{{ opt.label }}</span>
                        @if (task.priority === opt.value) {
                          <svg class="task-table__popover-check" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                        }
                      </button>
                    }
                  </div>
                </div>
              </ng-template>
            </td>
            <td (click)="$event.stopPropagation()">
              <app-date-picker
                variant="chip"
                [btnTestId]="'task-due-date-btn-' + task.id"
                chipClass="task-table__due-date-btn"
                emptyLabel="—"
                [value]="dueDateIso(task)"
                [isCompleted]="isTaskCompleted(task)"
                (valueChange)="onDateChange(task, $event)"
              />
            </td>
            <td>{{ task.estimatedHours ?? '—' }}</td>
            <td class="task-table__tracked-cell" (click)="$event.stopPropagation()">
              @if (isAssignee(task)) {
                <app-task-clock-widget
                  [task]="task"
                  [isAssignee]="isAssignee(task)"
                  [compact]="true"
                  [hasOpenSessionMine]="hasOpenSessionMine(task)"
                  [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee(task)"
                  (clockedIn)="taskChanged.emit()"
                  (pushed)="taskChanged.emit()"
                />
              } @else {
                <span class="task-table__tracked">{{ trackedLabel(task) }}</span>
              }
            </td>
          </tr>
          @if (task.subtaskTotalCount > 0) {
            <tr class="task-table__subtask-toggle-row">
              <td [attr.colspan]="selectable() ? 9 : 8">
                <button
                  type="button"
                  class="task-table__subtask-toggle"
                  [attr.data-testid]="'task-row-' + task.id + '-subtask-toggle'"
                  [attr.aria-expanded]="isExpanded(task.id)"
                  (click)="toggleSubtasks(task.id, $event)"
                >
                  <svg class="task-table__subtask-chevron" [class.task-table__subtask-chevron--open]="isExpanded(task.id)" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                  <span>{{ task.subtaskCompletedCount }}/{{ task.subtaskTotalCount }} subtasks</span>
                </button>
              </td>
            </tr>
            @if (isExpanded(task.id)) {
              @for (subtask of subtasksFor(task.id); track subtask.id) {
                <tr [attr.data-testid]="'task-row-' + subtask.id" class="task-table__subtask-row" (click)="viewed.emit(subtask)">
                  <td [attr.colspan]="selectable() ? 9 : 8" class="task-table__subtask-cell">
                    <span class="task-table__subtask-title">{{ subtask.title }}</span>
                    <span class="task-table__subtask-status">{{ statusName(subtask.statusId) }}</span>
                  </td>
                </tr>
              }
            }
          }
        }
      </tbody>
    </table>
    </div>
  `,
  styles: [`
    .task-table__scroll { overflow-x: auto; border-radius: 12px; background: var(--color-surface-secondary); padding: 2px 4px 6px; }
    .task-table { width: 100%; min-width: 986px; table-layout: fixed; border-collapse: separate; border-spacing: 0 5px; color: var(--color-text-primary); }
    .task-table__col-select { width: 3%; }
    .task-table__col-module { width: 16%; }
    .task-table__col-title { width: 28%; }
    .task-table__col-assignee { width: 8%; }
    .task-table__col-status { width: 11%; }
    .task-table__col-priority { width: 9%; }
    .task-table__col-due { width: 10%; }
    .task-table__col-hours { width: 8%; }
    .task-table__col-tracked { width: 7%; }
    .task-table th, .task-table td { text-align: left; white-space: nowrap; vertical-align: middle; }
    .task-table th:not(.task-table__select-cell) { overflow: hidden; text-overflow: ellipsis; }
    /* Ellipsis-truncate plain-text cells only - the Status and Tracked columns host popups
       (dropdown menu / clock push panel) that would get clipped by an overflow:hidden ancestor. */
    .task-table td:not(.task-table__select-cell) { overflow: hidden; text-overflow: ellipsis; }
    .task-table td.task-table__status-cell, .task-table td.task-table__tracked-cell { overflow: visible; text-overflow: clip; }
    .task-table thead tr { background: var(--color-surface-secondary); }
    .task-table th { padding: 13px 16px; cursor: pointer; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; transition: color 160ms ease; }
    .task-table th:hover { color: var(--color-accent); }
    .task-table thead th:first-child { border-top-left-radius: 8px; }
    .task-table thead th:last-child { border-top-right-radius: 8px; }
    .task-table tbody tr { cursor: pointer; }
    .task-table td { padding: 7px 14px; font-size: 13px; }

    /* Card-style rows: each data row renders as its own rounded, bordered card floating on the
       table's tinted background, separated by the table's own vertical border-spacing rather than
       horizontal rule lines. Cells share top/bottom borders but only the outer cells get left/right
       borders + corner radii, so adjacent columns read as one seamless card, not boxed cells. */
    .task-table__row-card td {
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      transition: background-color 150ms ease, border-color 150ms ease;
    }
    .task-table__row-card td:first-child { border-left: 1px solid var(--color-border); border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
    .task-table__row-card td:last-child { border-right: 1px solid var(--color-border); border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
    .task-table__row-card:hover td { border-color: color-mix(in srgb, var(--color-accent) 22%, var(--color-border)); }
    .task-table__row-card.task-table__row--selected td { background: color-mix(in srgb, var(--color-accent) 7%, var(--color-surface)); border-color: color-mix(in srgb, var(--color-accent) 38%, var(--color-border)); }
    .task-table__subtask-toggle-row td { padding: 4px 14px 4px 34px; }
    .task-table__subtask-toggle { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; padding: 0; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; cursor: pointer; }
    .task-table__subtask-chevron { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2; transition: transform 120ms ease; }
    .task-table__subtask-chevron--open { transform: rotate(180deg); }
    .task-table__subtask-row:hover { background: transparent; }
    .task-table__subtask-cell { padding: 8px 14px 8px 34px !important; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .task-table__subtask-title { font-size: 13px; color: var(--color-text-primary); }
    .task-table__subtask-status { font-size: 11px; color: var(--color-text-secondary); }
    .task-table__title-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; white-space: normal; }
    .task-table__title-text { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; line-height: 1.25; }
    .task-table__title-tag { align-self: flex-start; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; line-height: 1.2; padding: 1px 6px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); }
    .task-table__assignee { display: inline-flex; align-items: center; gap: 5px; }
    .task-table__assignee-more { font-size: 11px; font-weight: 600; color: var(--color-text-secondary); }
    .task-table__assignee-empty { color: var(--color-text-secondary); }
    .task-table__tracked { font-size: 12px; color: var(--color-text-secondary); }

    /* Status / Priority / Due-date trigger buttons - same interaction pattern as the Board card's
       popovers (task-card.component.ts), reused here so Backlog and Board behave identically. */
    .task-table__status-btn, .task-table__priority-btn, .task-table__due-date-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      max-width: 100%;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      border-radius: 6px;
      padding: 2px 7px;
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-primary);
      cursor: pointer;
      line-height: 1.25;
      transition: all 120ms ease;
    }
    .task-table__status-btn { border-color: transparent; text-transform: none; }
    .task-table__priority-btn { text-transform: capitalize; }
    .task-table__status-btn:hover, .task-table__status-btn[aria-expanded="true"],
    .task-table__priority-btn:hover, .task-table__priority-btn[aria-expanded="true"],
    .task-table__due-date-btn:hover, .task-table__due-date-btn[aria-expanded="true"] {
      border-color: var(--color-accent);
      box-shadow: 0 1px 3px rgb(15 23 42 / 0.08);
    }
    .task-table__status-dot { display: inline-block; width: 7px; height: 7px; border-radius: 999px; flex-shrink: 0; }
    .task-table__priority-icon { width: 11px; height: 11px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
    .task-table__priority-btn[data-priority="critical"], .task-table__priority-icon[data-priority="critical"] { color: var(--color-danger); }
    .task-table__priority-btn[data-priority="high"], .task-table__priority-icon[data-priority="high"] { color: var(--color-danger); }
    .task-table__priority-btn[data-priority="medium"], .task-table__priority-icon[data-priority="medium"] { color: var(--color-warning); }
    .task-table__priority-btn[data-priority="medium"] .task-table__priority-icon { transform: rotate(90deg); }
    .task-table__priority-btn[data-priority="low"], .task-table__priority-icon[data-priority="low"] { color: var(--color-text-secondary); }
    .task-table__priority-btn[data-priority="low"] .task-table__priority-icon { transform: rotate(180deg); }

    /* Popover content - copied from task-card.component.ts's .task-card__popover family so the
       Backlog table and the Board card render identical popovers. */
    .task-table__popover {
      min-width: 175px;
      border-radius: 8px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      padding: 8px;
      box-shadow: 0 10px 25px rgb(15 23 42 / 0.16);
      cursor: default;
      font-size: 12px;
      color: var(--color-text-primary);
    }
    .task-table__popover-title {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 6px;
      padding: 0 4px;
    }
    .task-table__popover-list { display: flex; flex-direction: column; gap: 2px; }
    .task-table__popover-option {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 5px 8px;
      border: 0;
      border-radius: 5px;
      background: transparent;
      color: var(--color-text-primary);
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      text-transform: capitalize;
      transition: background-color 100ms ease;
    }
    .task-table__popover-option:hover { background: var(--color-surface-secondary); }
    .task-table__popover-option--selected {
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
      color: var(--color-accent);
      font-weight: 600;
    }
    .task-table__popover-check {
      width: 13px;
      height: 13px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      margin-left: auto;
      flex-shrink: 0;
    }
    .task-table__select-cell { width: 1%; white-space: nowrap; }
    .task-table__select-cell input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; accent-color: var(--color-accent); }
  `]
})
export class TaskTableComponent {
  private readonly store = inject(TaskBoardStore);
  private readonly taskApi = inject(TaskApiService);
  private readonly notificationService = inject(NotificationService);

  protected readonly popoverPositions = TABLE_POPOVER_POSITIONS;
  protected readonly priorityOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ] as const;

  tasks = input.required<readonly WorkTask[]>();
  statusNames = input<Record<string, string>>({});
  categoryNames = input<Record<string, string>>({});
  moduleNames = input<Record<string, string>>({});
  statuses = input<readonly TaskStatusColumn[]>([]);
  objectiveOwners = input<Record<string, boolean>>({});
  currentEmployeeId = input('');
  // Opt-in: sprint-tab's task tables don't pass this, so they render unchanged with no checkbox column.
  selectable = input(false);
  selectedIds = input<ReadonlySet<string>>(new Set());
  viewed = output<WorkTask>();
  taskChanged = output<void>();
  statusChangeRequested = output<{ taskId: string; newStatusId: string }>();
  selectionChanged = output<{ taskId: string; selected: boolean }>();
  selectAllChanged = output<{ taskIds: string[]; selected: boolean }>();

  protected readonly expandedTaskIds = signal<ReadonlySet<string>>(new Set());
  private readonly loadedTaskIds = new Set<string>();

  protected readonly openPopover = signal<{ taskId: string; kind: 'priority' | 'status' } | null>(null);

  protected isPriorityPopoverOpen(taskId: string): boolean {
    const p = this.openPopover();
    return !!p && p.taskId === taskId && p.kind === 'priority';
  }

  protected isStatusPopoverOpen(taskId: string): boolean {
    const p = this.openPopover();
    return !!p && p.taskId === taskId && p.kind === 'status';
  }

  protected closePopovers(): void {
    this.openPopover.set(null);
  }

  private toggleOpenPopover(taskId: string, kind: 'priority' | 'status', event: MouseEvent): void {
    event.stopPropagation();
    const curr = this.openPopover();
    const isOpen = curr?.taskId === taskId && curr?.kind === kind;
    this.openPopover.set(isOpen ? null : { taskId, kind });
  }

  protected togglePriorityPopover(task: WorkTask, event: MouseEvent): void {
    this.toggleOpenPopover(task.id, 'priority', event);
  }

  protected toggleStatusPopover(task: WorkTask, event: MouseEvent): void {
    this.toggleOpenPopover(task.id, 'status', event);
  }

  protected statusColor(statusId: string): string {
    return this.statuses().find((s) => s.id === statusId)?.color || '#94a3b8';
  }

  protected statusBgTint(statusId: string): string {
    return `color-mix(in srgb, ${this.statusColor(statusId)} 14%, var(--color-surface))`;
  }

  protected isTaskCompleted(task: WorkTask): boolean {
    const status = this.statuses().find((s) => s.id === task.statusId);
    return Boolean(status && (status.marksTaskComplete || status.category === 'done'));
  }

  protected dueDateIso(task: WorkTask): string {
    const d = task.dueDate;
    if (!d) return '';
    return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  }

  protected async selectPriority(task: WorkTask, priority: WorkTask['priority']): Promise<void> {
    this.closePopovers();
    if (task.priority === priority) return;
    await this.applyTaskEdit(task, { priority });
  }

  protected selectStatus(task: WorkTask, statusId: string): void {
    this.closePopovers();
    this.onStatusPicked(task, statusId);
  }

  protected onDateChange(task: WorkTask, value: string): void {
    void this.applyTaskEdit(task, { dueDate: value || undefined });
  }

  private async applyTaskEdit(task: WorkTask, overrides: Partial<{ priority: WorkTask['priority']; dueDate: string | undefined }>): Promise<void> {
    const req = toEditTaskRequest(task, overrides);
    try {
      if (typeof this.store.editTask === 'function') {
        const outcome = await this.store.editTask(task.id, req);
        if (outcome === 'pending') this.notificationService.info('Task edit sent for approval.');
      } else {
        const res = await firstValueFrom(this.taskApi.editTask(task.id, req));
        if (isPendingApproval(res)) this.notificationService.info('Task edit sent for approval.');
      }
      this.taskChanged.emit();
    } catch {
      // Swallowed: reopening the popover lets the user retry.
    }
  }

  subtasksFor(taskId: string): readonly WorkTask[] {
    return this.store.subtasksByParentId()[taskId] ?? [];
  }

  isExpanded(taskId: string): boolean {
    return this.expandedTaskIds().has(taskId);
  }

  toggleSubtasks(taskId: string, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.expandedTaskIds());
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
      if (!this.loadedTaskIds.has(taskId) && this.subtasksFor(taskId).length === 0) {
        this.loadedTaskIds.add(taskId);
        void this.store.loadSubtasks(taskId);
      }
    }
    this.expandedTaskIds.set(next);
  }

  isSelected(taskId: string): boolean {
    return this.selectedIds().has(taskId);
  }

  // Moving a task requires owning its module (the same gate task-form-modal uses to route
  // between a direct edit and a request-for-approval) - a row for a module the caller doesn't
  // own gets no checkbox at all, rather than letting selection attempt a move that would fail.
  isRowSelectable(task: WorkTask): boolean {
    return this.objectiveOwners()[task.objectiveId] ?? false;
  }

  protected readonly selectableTasks = computed(() => this.tasks().filter((t) => this.isRowSelectable(t)));

  protected readonly allSelected = computed(() => {
    const tasks = this.selectableTasks();
    return tasks.length > 0 && tasks.every((t) => this.selectedIds().has(t.id));
  });

  protected readonly someSelected = computed(() => {
    const tasks = this.selectableTasks();
    const selected = this.selectedIds();
    return tasks.some((t) => selected.has(t.id)) && !this.allSelected();
  });

  onRowSelectChanged(taskId: string, event: Event): void {
    this.selectionChanged.emit({ taskId, selected: (event.target as HTMLInputElement).checked });
  }

  onSelectAllChanged(event: Event): void {
    const selected = (event.target as HTMLInputElement).checked;
    this.selectAllChanged.emit({ taskIds: this.selectableTasks().map((t) => t.id), selected });
  }

  isAssignee(task: WorkTask): boolean {
    return task.assigneeEmployeeIds.includes(this.currentEmployeeId());
  }

  hasOpenSessionMine(task: WorkTask): boolean {
    return task.openClockSessionEmployeeId === this.currentEmployeeId() && this.currentEmployeeId() !== '';
  }

  hasOpenSessionOtherEmployee(task: WorkTask): boolean {
    const openBy = task.openClockSessionEmployeeId;
    return openBy !== null && openBy !== this.currentEmployeeId();
  }

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
      this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    this.sortBy.set(key);
    this.sortDirection.set('asc');
  }

  statusName(statusId: string): string {
    return this.statusNames()[statusId] ?? statusId;
  }

  categoryName(categoryId: string): string | null {
    return this.categoryNames()[categoryId] ?? null;
  }

  moduleName(objectiveId: string): string {
    return this.moduleNames()[objectiveId] ?? '—';
  }

  assigneeNames(task: WorkTask): string {
    return task.assignees.map((a) => a.name).join(', ');
  }

  // Plain-text fallback for rows where the interactive clock widget is hidden (only the
  // assignee can clock in/out) - keeps the Tracked column populated for everyone else.
  trackedLabel(task: WorkTask): string {
    const minutes = task.totalLoggedMinutes;
    if (!minutes) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    return `${mins}m`;
  }

  availableStatuses(task: WorkTask): readonly TaskStatusColumn[] {
    const isOwner = this.objectiveOwners()[task.objectiveId] ?? false;
    return this.statuses().filter((status) => status.visibility === 'public' || isOwner);
  }

  onStatusPicked(task: WorkTask, newStatusId: string): void {
    this.statusChangeRequested.emit({ taskId: task.id, newStatusId });
  }
}
