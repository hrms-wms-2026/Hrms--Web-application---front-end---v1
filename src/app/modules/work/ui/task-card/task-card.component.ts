import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { firstValueFrom } from 'rxjs';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { TaskAssigneeDropdownComponent } from '../task-assignee-dropdown/task-assignee-dropdown.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { isPendingApproval } from '../../models/dto/work-approval.dto';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { toEditTaskRequest } from '../../utils/task.mapper';
import { getTaskDueDateInfo } from '../../utils/task-date.util';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';

const ASSIGNEE_POPOVER_POSITIONS: ConnectionPositionPair[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 }
];

export interface TaskCardAssignableMember {
  employeeId: string;
  name: string;
  avatarUrl?: string | null;
}

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [KeyboardClickDirective, StopClickPropagationDirective, TaskClockWidgetComponent, EmployeeAvatarComponent, AvatarComponent, OverlayModule, DatePickerComponent, TaskAssigneeDropdownComponent],
  template: `
      <div role="button" tabindex="0" appKeyboardClick class="task-card" [attr.data-testid]="'task-card-' + task().id" (click)="viewed.emit(task())">
        <div class="task-card__header">
          <span class="task-card__short-id">{{ task().shortId }}</span>
          @if (task().hasPendingApproval) {
            <span class="task-card__pending-badge" data-testid="task-card-pending-approval" title="Awaiting approval">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path d="M12 7v5l3 2" /></svg>
              Pending
            </span>
          }
        </div>
        <p class="task-card__title">
          <span class="task-card__title-text" [title]="task().title">{{ task().title }}</span>
        </p>

        <div class="task-card__meta">
          <div class="task-card__assignee-anchor">
            <button
              type="button"
              class="task-card__assignee-btn"
              data-testid="task-card-assignee-btn"
              cdkOverlayOrigin
              #assigneeOrigin="cdkOverlayOrigin"
              [attr.aria-expanded]="assigneePopoverOpen()"
              [attr.aria-label]="assigneeTooltip()"
              [title]="assigneeTooltip()"
              (click)="toggleAssigneePopover($event)"
            >
              @if (task().assigneeEmployeeIds.length > 0) {
                @for (employeeId of task().assigneeEmployeeIds; track employeeId) {
                  @if (resolvedAssigneeAvatars()[employeeId]; as identity) {
                    <app-avatar class="task-card__assignee-avatar" size="sm" shape="circle" [avatarUrl]="identity.avatarUrl" [userName]="identity.name" />
                  } @else {
                    <app-employee-avatar class="task-card__assignee-avatar" [employeeId]="employeeId" [showName]="false" />
                  }
                }
              } @else {
                <span class="task-card__assignee-placeholder" aria-hidden="true">
                  <app-avatar size="sm" shape="circle" [unassigned]="true" />
                </span>
              }
            </button>

            <ng-template
              cdkConnectedOverlay
              [cdkConnectedOverlayOrigin]="assigneeOrigin"
              [cdkConnectedOverlayOpen]="assigneePopoverOpen()"
              [cdkConnectedOverlayPositions]="assigneePopoverPositions"
              [cdkConnectedOverlayHasBackdrop]="true"
              cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
              (backdropClick)="assigneePopoverOpen.set(false)"
              (detach)="assigneePopoverOpen.set(false)"
            >
              <app-task-assignee-dropdown
                [members]="assignableMembers()"
                [selectedId]="task().assigneeEmployeeIds[0]"
                [allowUnassigned]="task().taskKind !== 'employee_checklist'"
                (selected)="selectAssignee($event)"
                (closed)="assigneePopoverOpen.set(false)"
              />
            </ng-template>
          </div>

          <button
            type="button"
            class="task-card__priority task-card__meta-btn"
            [attr.data-priority]="task().priority"
            data-testid="task-card-priority-btn"
            cdkOverlayOrigin
            #priorityOrigin="cdkOverlayOrigin"
            [attr.aria-expanded]="priorityPopoverOpen()"
            title="Change priority"
            (click)="togglePriorityPopover($event)"
          >
            <svg class="task-card__priority-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            <span>{{ task().priority }}</span>
          </button>

          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="priorityOrigin"
            [cdkConnectedOverlayOpen]="priorityPopoverOpen()"
            [cdkConnectedOverlayPositions]="assigneePopoverPositions"
            [cdkConnectedOverlayHasBackdrop]="true"
            cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
            (backdropClick)="priorityPopoverOpen.set(false)"
            (detach)="priorityPopoverOpen.set(false)"
          >
            <div class="task-card__popover task-card__priority-popover" role="dialog" aria-label="Change priority" appStopClickPropagation>
              <div class="task-card__popover-title">Priority</div>
              <div class="task-card__popover-list">
                @for (opt of priorityOptions; track opt.value) {
                  <button
                    type="button"
                    class="task-card__popover-option"
                    [class.task-card__popover-option--selected]="task().priority === opt.value"
                    (click)="selectPriority(opt.value)"
                  >
                    <svg class="task-card__priority-icon" [attr.data-priority]="opt.value" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                    <span>{{ opt.label }}</span>
                    @if (task().priority === opt.value) {
                      <svg class="task-card__popover-check" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                    }
                  </button>
                }
              </div>
            </div>
          </ng-template>

          <app-date-picker
            variant="chip"
            [value]="taskDueDateIso()"
            [isCompleted]="isTaskCompleted()"
            (valueChange)="onDateChange($event)"
          />

          @if (isAssignee()) {
            <div class="task-card__clock" appStopClickPropagation>
              <app-task-clock-widget
                [task]="task()"
                [isAssignee]="isAssignee()"
                [compact]="true"
                [hasOpenSessionMine]="hasOpenSessionMine()"
                [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee()"
                (clockedIn)="taskChanged.emit()"
                (pushed)="taskChanged.emit()"
              />
            </div>
          }
        </div>

        @if (task().subtaskTotalCount > 0) {
          <div role="button" tabindex="0" appKeyboardClick
            class="task-card__subtask-bar"
            data-testid="task-card-subtask-bar"
            (click)="toggleSubtasks($event)"
          >
            <button
              type="button"
              class="task-card__subtask-toggle"
              data-testid="task-card-subtask-toggle"
              [attr.aria-expanded]="subtasksExpanded()"
              (click)="toggleSubtasks($event)"
            >
              <svg class="task-card__subtask-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="3.5" cy="4.5" r="1.75"/>
                <circle cx="11.5" cy="11.5" r="1.75"/>
                <path d="M3.5 6.25v2.25a2.5 2.5 0 0 0 2.5 2.5h3.75"/>
              </svg>
              <span class="task-card__subtask-label">{{ task().subtaskTotalCount === 1 ? 'subtask' : 'subtasks' }}</span>
              <span class="task-card__subtask-count">{{ task().subtaskCompletedCount }}/{{ task().subtaskTotalCount }}</span>
            </button>
          </div>
        }
      </div>

      @if (subtasksExpanded()) {
        <div class="task-card__subtask-cards" data-testid="task-card-subtasks">
          @for (subtask of subtasks(); track subtask.id) {
            <div role="button" tabindex="0" appKeyboardClick
              class="task-card task-card--subtask"
              [attr.data-testid]="'task-card-subtask-' + subtask.id"
              (click)="onSubtaskRowClick($event, subtask)"
            >
              @if (subtask.shortId) {
                <div class="task-card__header">
                  <span class="task-card__short-id">{{ subtask.shortId }}</span>
                </div>
              }
              <p class="task-card__title">
                <span class="task-card__title-text" [title]="subtask.title">{{ subtask.title }}</span>
              </p>
              <div class="task-card__meta">
                @if (subtask.assigneeEmployeeIds.length > 0) {
                  <div class="task-card__assignee-anchor">
                    @for (employeeId of subtask.assigneeEmployeeIds; track employeeId) {
                      @if (resolveSubtaskAssignee(employeeId, subtask); as identity) {
                        <app-avatar class="task-card__assignee-avatar" size="sm" [avatarUrl]="identity.avatarUrl" [userName]="identity.name" />
                      } @else {
                        <app-employee-avatar class="task-card__assignee-avatar" [employeeId]="employeeId" [showName]="false" />
                      }
                    }
                  </div>
                }
                @if (subtask.dueDate) {
                  <span
                    class="task-card__due-date"
                    [class.task-card__due-date--overdue]="isSubtaskOverdue(subtask)"
                    [class.task-card__due-date--today]="isSubtaskToday(subtask)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                    <span>{{ formatSubtaskDueDate(subtask.dueDate) }}</span>
                  </span>
                }
                <span class="task-card__priority" [attr.data-priority]="subtask.priority">
                  <svg class="task-card__priority-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  <span>{{ subtask.priority }}</span>
                </span>
                @if (subtask.estimatedHours) {
                  <span class="task-card__hours">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    <span>{{ subtask.estimatedHours }}h</span>
                  </span>
                }
                @if (isSubtaskAssignee(subtask)) {
                  <div class="task-card__clock" appStopClickPropagation>
                    <app-task-clock-widget
                      [task]="subtask"
                      [isAssignee]="true"
                      [compact]="true"
                      [hasOpenSessionMine]="hasOpenSessionMineForSubtask(subtask)"
                      [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployeeForSubtask(subtask)"
                      (clockedIn)="onSubtaskClockChanged()"
                      (pushed)="onSubtaskClockChanged()"
                    />
                  </div>
                }
              </div>
            </div>
          } @empty {
            <div class="task-card__subtask-loading">Loading subtasks…</div>
          }
        </div>
      }
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }
    .task-card {
      min-width: 0;
      max-width: 100%;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 12px 14px;
      cursor: pointer;
      box-shadow: var(--shadow-card);
      transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
    }
    .task-card:hover {
      border-color: color-mix(in srgb, var(--color-accent) 38%, var(--color-border));
      box-shadow: var(--shadow-popover);
      transform: translateY(-1px);
    }
    .task-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .task-card__short-id { font-size: 11px; color: var(--color-text-secondary); }
    .task-card__pending-badge {
      display: inline-flex; flex: 0 0 auto; align-items: center; gap: 3px;
      padding: 2px 7px; border-radius: 999px;
      background: color-mix(in srgb, var(--color-warning, #d97706) 14%, transparent);
      color: var(--color-warning, #b45309);
      font-size: 10px; font-weight: 650; text-transform: uppercase; letter-spacing: .03em;
      white-space: nowrap;
    }
    .task-card__pending-badge svg { width: 11px; height: 11px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .task-card__title { min-width: 0; margin: 5px 0 7px; font-size: 13px; font-weight: 500; color: var(--color-text-primary); line-height: 1.4; }
    .task-card__title-text { display: block; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .task-card__meta { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--color-text-secondary); }
    .task-card__meta-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      border-radius: 6px;
      padding: 2px 7px;
      font: inherit;
      font-size: 11.5px;
      font-weight: 500;
      color: var(--color-text-primary);
      cursor: pointer;
      line-height: 1.3;
      transition: all 120ms ease;
      box-shadow: var(--shadow-card);
    }
    .task-card__meta-btn:hover,
    .task-card__meta-btn[aria-expanded="true"] {
      background: var(--color-surface-secondary);
      border-color: var(--color-accent);
      color: var(--color-text-primary);
      box-shadow: var(--shadow-card);
    }
    .task-card__meta-btn--icon-only {
      width: 26px;
      height: 24px;
      min-width: 26px;
      padding: 0;
      justify-content: center;
      background: transparent;
      border-style: dashed;
      color: var(--color-text-secondary);
      box-shadow: none;
    }
    .task-card__meta-btn--icon-only:hover,
    .task-card__meta-btn--icon-only[aria-expanded="true"] {
      background: var(--color-surface-secondary);
      border-style: solid;
      border-color: var(--color-accent);
      color: var(--color-accent);
    }
    .task-card__meta-btn--icon-only:hover svg,
    .task-card__meta-btn--icon-only[aria-expanded="true"] svg {
      color: var(--color-accent);
    }
    .task-card__meta-btn--icon-only svg {
      width: 16px;
      height: 16px;
      stroke-width: 2;
    }
    .task-card__due-date svg, .task-card__hours svg { width: 14px; height: 14px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; color: var(--color-text-secondary); }
    .task-card__due-date, .task-card__hours { display: inline-flex; align-items: center; gap: 4px; color: var(--color-text-primary); }
    .task-card__due-date--overdue {
      color: var(--color-danger, #ef4444);
      border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
      background: color-mix(in srgb, var(--color-danger) 5%, var(--color-surface));
    }
    .task-card__due-date--overdue svg { color: var(--color-danger, #ef4444); }
    .task-card__due-date--today {
      color: var(--color-warning-text, #d97706);
      border-color: color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
      background: color-mix(in srgb, var(--color-warning) 5%, var(--color-surface));
    }
    .task-card__due-date--today svg { color: var(--color-warning-text, #d97706); }
    .task-card__priority { display: inline-flex; align-items: center; gap: 4px; text-transform: capitalize; color: var(--color-text-primary); }
    .task-card__priority-icon { width: 12px; height: 12px; fill: currentColor; stroke: currentColor; stroke-width: 1.2; flex-shrink: 0; }
    .task-card__priority[data-priority="critical"] .task-card__priority-icon,
    .task-card__priority-icon[data-priority="critical"] { color: var(--color-danger); fill: var(--color-danger); }
    .task-card__priority[data-priority="high"] .task-card__priority-icon,
    .task-card__priority-icon[data-priority="high"] { color: var(--color-warning); fill: var(--color-warning); }
    .task-card__priority[data-priority="medium"] .task-card__priority-icon,
    .task-card__priority-icon[data-priority="medium"] { color: var(--color-accent); fill: var(--color-accent); }
    .task-card__priority[data-priority="low"] .task-card__priority-icon,
    .task-card__priority-icon[data-priority="low"] { color: var(--color-text-muted); fill: var(--color-text-muted); }
    .task-card__clock { min-width: 0; margin-left: auto; flex-shrink: 0; }

    .task-card__popover {
      min-width: 175px;
      border-radius: 8px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      padding: 8px;
      box-shadow: var(--shadow-popover);
      cursor: default;
      font-size: 12px;
      color: var(--color-text-primary);
    }
    .task-card__popover-title {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 6px;
      padding: 0 4px;
    }
    .task-card__popover-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .task-card__popover-option {
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
      transition: background-color 100ms ease;
    }
    .task-card__popover-option:hover {
      background: var(--color-surface-secondary);
    }
    .task-card__popover-option--selected {
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
      color: var(--color-accent);
      font-weight: 600;
    }
    .task-card__popover-check {
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
    .task-card__quick-row {
      display: flex;
      gap: 4px;
      margin-bottom: 6px;
    }
    .task-card__quick-btn {
      flex: 1;
      padding: 3px 4px;
      font-size: 10px;
      font-weight: 500;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
      cursor: pointer;
      text-align: center;
      transition: all 120ms ease;
    }
    .task-card__quick-btn:hover {
      border-color: var(--color-accent);
      background: var(--color-surface);
      color: var(--color-accent);
    }
    .task-card__due-date-popover {
      width: 275px;
      padding: 10px;
    }
    .task-card__date-picker-row {
      margin-top: 4px;
    }
    .task-card__date-input {
      width: 100%;
      padding: 4px 6px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      background: var(--color-surface);
      font: inherit;
      font-size: 11.5px;
      color: var(--color-text-primary);
      outline: none;
      box-sizing: border-box;
    }
    .task-card__date-input:focus {
      border-color: var(--color-accent);
    }
    .task-card__popover-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid var(--color-border);
    }
    .task-card__popover-clear-btn {
      border: 0;
      background: transparent;
      padding: 3px 6px;
      font: inherit;
      font-size: 11px;
      color: var(--color-danger);
      cursor: pointer;
      border-radius: 4px;
      margin-right: auto;
    }
    .task-card__popover-clear-btn:hover {
      background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    }
    .task-card__popover-save-btn {
      border: 0;
      background: var(--color-accent);
      color: var(--color-text-on-solid);
      padding: 3px 10px;
      font: inherit;
      font-size: 11px;
      font-weight: 500;
      border-radius: 4px;
      cursor: pointer;
      transition: opacity 120ms ease;
    }
    .task-card__popover-save-btn:hover {
      opacity: 0.9;
    }


    .task-card__subtask-bar {
      margin-top: 9px;
      padding-top: 5px;
      border-top: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
      cursor: pointer;
    }
    .task-card__subtask-toggle {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      margin: 0;
      border: 0;
      background: transparent;
      border-radius: 5px;
      color: var(--color-text-secondary);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      line-height: 1.35;
      box-sizing: border-box;
      transition: color 120ms ease, background-color 120ms ease;
    }
    .task-card__subtask-toggle:hover,
    .task-card__subtask-bar:hover .task-card__subtask-toggle {
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
    }
    .task-card__subtask-icon {
      width: 15px;
      height: 15px;
      stroke: currentColor;
      flex-shrink: 0;
    }
    .task-card__subtask-label {
      font-size: 13px;
      font-weight: 500;
    }
    .task-card__subtask-count {
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-secondary);
    }
    .task-card__subtask-toggle:hover .task-card__subtask-count,
    .task-card__subtask-bar:hover .task-card__subtask-count {
      color: var(--color-text-primary);
    }

    .task-card__subtask-cards {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
      margin-left: 12px;
    }
    .task-card--subtask {
      border-radius: 10px;
      padding: 9px 12px;
    }
    .task-card--subtask .task-card__title {
      margin: 2px 0 5px;
      font-size: 12.5px;
      font-weight: 500;
    }
    .task-card--subtask .task-card__meta {
      gap: 6px;
      font-size: 10.5px;
    }
    .task-card__subtask-loading {
      padding: 6px 10px;
      font-size: 11px;
      color: var(--color-text-secondary);
      font-style: italic;
    }
    .task-card__clock { min-width: 0; margin-left: auto; }

    .task-card__assignee-anchor { display: inline-flex; }
    .task-card__assignee-btn {
      display: inline-flex;
      align-items: center;
      border: 0;
      background: transparent;
      padding: 0;
      margin: 0 2px 0 0;
      cursor: pointer;
      border-radius: 999px;
    }
    .task-card__assignee-avatar { margin-left: -6px; border-radius: 999px; box-shadow: 0 0 0 2px var(--color-surface); }
    .task-card__assignee-avatar:first-child { margin-left: 0; }
    .task-card__assignee-placeholder {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 9999px;
      border: 1.5px dashed var(--color-border);
      color: var(--color-text-secondary);
      background: transparent;
      transition: border-color 120ms ease, color 120ms ease, background-color 120ms ease;
    }
    .task-card__assignee-btn:hover .task-card__assignee-placeholder {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }
    .task-card__assignee-placeholder svg { width: 13px; height: 13px; fill: currentColor; }

  `]
})
export class TaskCardComponent {
  private readonly taskApi = inject(TaskApiService);
  private readonly notificationService = inject(NotificationService);
  private readonly directory = inject(EmployeeDirectoryStore);
  private readonly store = inject(TaskBoardStore);

  task = input.required<WorkTask>();
  statuses = input<readonly TaskStatusColumn[]>([]);
  currentEmployeeId = input('');
  assignableMembers = input<readonly TaskCardAssignableMember[]>([]);

  viewed = output<WorkTask>();
  taskChanged = output<void>();

  protected readonly assigneePopoverOpen = signal(false);
  protected readonly assigneePopoverPositions = ASSIGNEE_POPOVER_POSITIONS;

  protected readonly subtasksExpanded = signal(false);
  protected readonly subtasks = computed(() => this.store.subtasksByParentId()[this.task().id] ?? []);

  protected readonly isAssignee = computed(() => this.task().assigneeEmployeeIds.includes(this.currentEmployeeId()));
  protected readonly hasOpenSessionMine = computed(() =>
    this.task().openClockSessionEmployeeId === this.currentEmployeeId() && this.currentEmployeeId() !== ''
  );
  protected readonly hasOpenSessionOtherEmployee = computed(() => {
    const openBy = this.task().openClockSessionEmployeeId;
    return openBy != null && openBy !== this.currentEmployeeId();
  });

  protected readonly statusName = computed(() =>
    this.statuses().find((s) => s.id === this.task().statusId)?.name ?? this.task().statusId
  );

  // Resolves each assignee's display name + real avatar photo. Preferred source is the task's
  // own server-resolved `assignees` (coverage-free, and the only source with an actual photo
  // URL); falls back to the project-members list (name only, still coverage-free) for anyone
  // that source somehow missed. Both bypass the management-coverage-scoped GET /employees/{id}
  // that app-employee-avatar's own directory lookup uses, which 403s (falling back to "Unknown
  // employee") for most assignees outside the viewer's coverage.
  protected readonly resolvedAssigneeAvatars = computed(() => {
    const map: Record<string, { name: string; avatarUrl: string | null }> = {};
    for (const member of this.assignableMembers()) map[member.employeeId] = { name: member.name, avatarUrl: member.avatarUrl ?? null };
    for (const assignee of this.task().assignees ?? []) map[assignee.employeeId] = { name: assignee.name, avatarUrl: assignee.avatarUrl };
    return map;
  });

  protected readonly assigneeTooltip = computed(() => {
    const ids = this.task().assigneeEmployeeIds;
    if (!ids || ids.length === 0) {
      return 'Add assignee';
    }
    const resolved = this.resolvedAssigneeAvatars();
    const names = ids
      .map((id) => resolved[id]?.name?.trim() || this.directory.get(id)?.name?.trim())
      .filter((name): name is string => Boolean(name));

    if (names.length > 0) {
      return names.join(', ');
    }
    return 'Assigned';
  });

  protected isAssigned(employeeId: string): boolean {
    return this.task().assigneeEmployeeIds.includes(employeeId);
  }

  protected readonly priorityPopoverOpen = signal(false);

  protected readonly priorityOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ] as const;

  protected readonly isTaskCompleted = computed(() => {
    const status = this.statuses().find((s) => s.id === this.task().statusId);
    return Boolean(status && (status.marksTaskComplete || status.category === 'done'));
  });

  protected readonly dueDateInfo = computed(() =>
    getTaskDueDateInfo(this.task().dueDate, this.isTaskCompleted())
  );

  protected formatSubtaskDueDate(dueDate: Date | string | null | undefined): string {
    return getTaskDueDateInfo(dueDate, false)?.label ?? '';
  }

  protected isSubtaskOverdue(subtask: WorkTask): boolean {
    const status = this.statuses().find((s) => s.id === subtask.statusId);
    const completed = Boolean(status && (status.marksTaskComplete || status.category === 'done'));
    return getTaskDueDateInfo(subtask.dueDate, completed)?.isOverdue ?? false;
  }

  protected isSubtaskToday(subtask: WorkTask): boolean {
    return getTaskDueDateInfo(subtask.dueDate, false)?.isToday ?? false;
  }

  protected readonly taskDueDateIso = computed(() => {
    const d = this.task().dueDate;
    if (!d) return '';
    return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  });

  protected toggleAssigneePopover(event: MouseEvent): void {
    event.stopPropagation();
    this.priorityPopoverOpen.set(false);
    this.assigneePopoverOpen.update((open) => !open);
  }

  protected togglePriorityPopover(event: MouseEvent): void {
    event.stopPropagation();
    this.assigneePopoverOpen.set(false);
    this.priorityPopoverOpen.update((v) => !v);
  }

  protected async selectPriority(priority: WorkTask['priority']): Promise<void> {
    this.priorityPopoverOpen.set(false);
    if (this.task().priority === priority) return;
    await this.applyTaskEdit({ priority });
  }

  protected onDateChange(value: string): void {
    void this.applyTaskEdit({ dueDate: value || undefined });
  }

  private async applyTaskEdit(overrides: Partial<{ priority: WorkTask['priority']; dueDate: string; estimatedHours: number }>): Promise<void> {
    const currentTask = this.task();
    const req = toEditTaskRequest(currentTask, overrides);
    try {
      if (typeof this.store.editTask === 'function') {
        const outcome = await this.store.editTask(currentTask.id, req);
        if (outcome === 'pending') this.notificationService.info('Task edit sent for approval.');
      } else {
        const res = await firstValueFrom(this.taskApi.editTask(currentTask.id, req));
        if (isPendingApproval(res)) this.notificationService.info('Task edit sent for approval.');
      }
      this.taskChanged.emit();
    } catch {
      // Swallowed: reopening lets user retry
    }
  }

  private subtasksLoaded = false;

  protected toggleSubtasks(event: MouseEvent): void {
    event.stopPropagation();
    const wasExpanded = this.subtasksExpanded();
    this.subtasksExpanded.set(!wasExpanded);
    if (!wasExpanded && !this.subtasksLoaded && this.subtasks().length === 0) {
      this.subtasksLoaded = true;
      void this.store.loadSubtasks(this.task().id);
    }
  }

  protected onSubtaskRowClick(event: MouseEvent, subtask: WorkTask): void {
    event.stopPropagation();
    this.viewed.emit(subtask);
  }

  protected isSubtaskAssignee(subtask: WorkTask): boolean {
    return subtask.assigneeEmployeeIds.includes(this.currentEmployeeId());
  }

  protected hasOpenSessionMineForSubtask(subtask: WorkTask): boolean {
    return subtask.openClockSessionEmployeeId === this.currentEmployeeId() && this.currentEmployeeId() !== '';
  }

  protected hasOpenSessionOtherEmployeeForSubtask(subtask: WorkTask): boolean {
    const openBy = subtask.openClockSessionEmployeeId;
    return openBy != null && openBy !== this.currentEmployeeId();
  }

  protected async onSubtaskClockChanged(): Promise<void> {
    await this.store.loadSubtasks(this.task().id);
    this.taskChanged.emit();
  }

  protected resolveSubtaskAssignee(employeeId: string, subtask: WorkTask): { name: string; avatarUrl: string | null } | null {
    const fromSubtask = subtask.assignees?.find((a) => a.employeeId === employeeId);
    if (fromSubtask && fromSubtask.avatarUrl) return { name: fromSubtask.name, avatarUrl: fromSubtask.avatarUrl };
    const fromParent = this.resolvedAssigneeAvatars()[employeeId];
    if (fromParent && fromParent.avatarUrl) return fromParent;
    if (fromSubtask) return { name: fromSubtask.name, avatarUrl: fromSubtask.avatarUrl };
    if (fromParent) return fromParent;
    const fromMembers = this.assignableMembers().find((m) => m.employeeId === employeeId);
    if (fromMembers) return { name: fromMembers.name, avatarUrl: fromMembers.avatarUrl ?? null };
    const fromDir = this.directory.get(employeeId);
    if (fromDir) return { name: fromDir.name, avatarUrl: fromDir.avatarUrl ?? null };
    return null;
  }

  protected async selectAssignee(employeeId: string | null): Promise<void> {
    const taskId = this.task().id;
    const current = this.task().assigneeEmployeeIds;
    this.assigneePopoverOpen.set(false);

    // Single-assignee model, matching the task detail modal: picking someone replaces
    // whoever was previously assigned rather than adding a second assignee.
    if (current.length === (employeeId ? 1 : 0) && (employeeId == null || current[0] === employeeId)) {
      return;
    }
    try {
      if (this.task().taskKind === 'employee_checklist') {
        if (employeeId) await firstValueFrom(this.taskApi.assignTask(taskId, employeeId));
        this.taskChanged.emit();
        return;
      }
      for (const previousId of current) {
        await firstValueFrom(this.taskApi.unassignTask(taskId, previousId));
      }
      if (employeeId) {
        await firstValueFrom(this.taskApi.assignTask(taskId, employeeId));
      }
      this.taskChanged.emit();
    } catch {
      // Swallowed: reopening the popover lets the user retry.
    }
  }
}
