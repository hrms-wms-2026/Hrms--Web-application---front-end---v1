import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { firstValueFrom } from 'rxjs';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { toEditTaskRequest } from '../../utils/task.mapper';

const ASSIGNEE_POPOVER_POSITIONS: ConnectionPositionPair[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 }
];

export interface TaskCardAssignableMember {
  employeeId: string;
  name: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [DatePipe, TaskClockWidgetComponent, EmployeeAvatarComponent, AvatarComponent, OverlayModule],
  template: `
      <div class="task-card" [attr.data-testid]="'task-card-' + task().id" (click)="viewed.emit(task())">
        <div class="task-card__header">
          <span class="task-card__short-id">{{ task().shortId }}</span>
        </div>
        <p class="task-card__title">
          <span>{{ task().title }}</span>
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
                    <app-avatar class="task-card__assignee-avatar" size="sm" [avatarUrl]="identity.avatarUrl" [userName]="identity.name" />
                  } @else {
                    <app-employee-avatar class="task-card__assignee-avatar" [employeeId]="employeeId" [showName]="false" />
                  }
                }
              } @else {
                <span class="task-card__assignee-placeholder" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
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
              <div class="task-card__assignee-popover" role="dialog" aria-label="Change assignee" (click)="$event.stopPropagation()">
                <div class="task-card__assignee-search">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                  <input
                    type="text"
                    placeholder="Search people…"
                    [value]="assigneeSearch()"
                    (input)="assigneeSearch.set($any($event.target).value)"
                  />
                </div>
                <div class="task-card__assignee-list">
                  <button
                    type="button"
                    class="task-card__assignee-option"
                    [class.task-card__assignee-option--selected]="task().assigneeEmployeeIds.length === 0"
                    (click)="selectAssignee(null)"
                  >
                    <span class="task-card__assignee-option-avatar task-card__assignee-option-avatar--unassigned" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </span>
                    <span class="task-card__assignee-option-name">Unassigned</span>
                    @if (task().assigneeEmployeeIds.length === 0) {
                      <svg class="task-card__assignee-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                    }
                  </button>
                  @for (member of filteredAssignableMembers(); track member.employeeId) {
                    <button
                      type="button"
                      class="task-card__assignee-option"
                      [class.task-card__assignee-option--selected]="isAssigned(member.employeeId)"
                      (click)="selectAssignee(member.employeeId)"
                    >
                      <span class="task-card__assignee-option-avatar">{{ initials(member.name) }}</span>
                      <span class="task-card__assignee-option-name">{{ member.name }}</span>
                      @if (isAssigned(member.employeeId)) {
                        <svg class="task-card__assignee-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                      }
                    </button>
                  } @empty {
                    <p class="task-card__assignee-empty">No matching people</p>
                  }
                </div>
              </div>
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
            <div class="task-card__popover task-card__priority-popover" role="dialog" aria-label="Change priority" (click)="$event.stopPropagation()">
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

          <button
            type="button"
            class="task-card__due-date task-card__meta-btn"
            [class.task-card__meta-btn--icon-only]="!task().dueDate"
            data-testid="task-card-due-date-btn"
            cdkOverlayOrigin
            #dueDateOrigin="cdkOverlayOrigin"
            [attr.aria-expanded]="dueDatePopoverOpen()"
            [title]="task().dueDate ? 'Change due date' : 'Set due date'"
            (click)="toggleDueDatePopover($event)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            @if (task().dueDate) {
              <span>{{ task().dueDate | date: 'MMM d' }}</span>
            }
          </button>

          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="dueDateOrigin"
            [cdkConnectedOverlayOpen]="dueDatePopoverOpen()"
            [cdkConnectedOverlayPositions]="assigneePopoverPositions"
            [cdkConnectedOverlayHasBackdrop]="true"
            cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
            (backdropClick)="dueDatePopoverOpen.set(false)"
            (detach)="dueDatePopoverOpen.set(false)"
          >
            <div class="task-card__popover task-card__due-date-popover" role="dialog" aria-label="Change due date" (click)="$event.stopPropagation()">
              <div class="task-card__popover-title">Due Date</div>
              <div class="task-card__quick-row">
                <button type="button" class="task-card__quick-btn" (click)="setQuickDueDate('today')">Today</button>
                <button type="button" class="task-card__quick-btn" (click)="setQuickDueDate('tomorrow')">Tomorrow</button>
                <button type="button" class="task-card__quick-btn" (click)="setQuickDueDate('nextWeek')">Next wk</button>
              </div>
              <div class="task-card__date-picker-row">
                <input
                  type="date"
                  class="task-card__date-input"
                  [value]="taskDueDateIso()"
                  (change)="onDateChange($any($event.target).value)"
                />
              </div>
              @if (task().dueDate) {
                <div class="task-card__popover-footer">
                  <button type="button" class="task-card__popover-clear-btn" (click)="clearDueDate()">
                    Remove date
                  </button>
                </div>
              }
            </div>
          </ng-template>

          @if (task().activeEventName) {
            <span class="task-card__event" data-testid="task-event-chip" [title]="'In milestone: ' + task().activeEventName">{{ task().activeEventName }}</span>
          }
          @if (isAssignee()) {
            <div class="task-card__clock" (click)="$event.stopPropagation()">
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
          <div class="task-card__subtask-bar">
            <button
              type="button"
              class="task-card__subtask-toggle"
              data-testid="task-card-subtask-toggle"
              [attr.aria-expanded]="subtasksExpanded()"
              (click)="toggleSubtasks($event)"
            >
              <svg class="task-card__subtask-chevron" [class.task-card__subtask-chevron--open]="subtasksExpanded()" viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              <span>{{ task().subtaskTotalCount === 1 ? '1 subtask' : task().subtaskTotalCount + ' subtasks' }}</span>
              <span class="task-card__subtask-count-pill">{{ task().subtaskCompletedCount }}/{{ task().subtaskTotalCount }}</span>
            </button>
          </div>
        }
      </div>

      @if (subtasksExpanded()) {
        <div class="task-card__subtask-cards" data-testid="task-card-subtasks">
          @for (subtask of subtasks(); track subtask.id) {
            <div
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
                <span>{{ subtask.title }}</span>
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
                  <span class="task-card__due-date">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                    <span>{{ subtask.dueDate | date: 'MMM d' }}</span>
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
    }
    .task-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 12px 14px;
      cursor: pointer;
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
      transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
    }
    .task-card:hover {
      border-color: color-mix(in srgb, var(--color-accent) 38%, var(--color-border));
      box-shadow: 0 5px 14px rgb(15 23 42 / 0.08);
      transform: translateY(-1px);
    }
    .task-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .task-card__short-id { font-size: 11px; color: var(--color-text-secondary); }
    .task-card__title { margin: 5px 0 7px; font-size: 13px; font-weight: 500; color: var(--color-text-primary); line-height: 1.4; }
    .task-card__meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--color-text-secondary); }
    .task-card__meta-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid var(--color-border);
      background: var(--color-surface-secondary);
      border-radius: 5px;
      padding: 1.5px 6px;
      font: inherit;
      font-size: 11px;
      color: var(--color-text-secondary);
      cursor: pointer;
      line-height: 1.3;
      transition: all 120ms ease;
    }
    .task-card__meta-btn:hover,
    .task-card__meta-btn[aria-expanded="true"] {
      background: var(--color-surface);
      border-color: var(--color-accent);
      color: var(--color-text-primary);
      box-shadow: 0 1px 3px rgb(15 23 42 / 0.08);
    }
    .task-card__meta-btn--icon-only {
      padding: 2px 5px;
      min-width: 22px;
      justify-content: center;
    }
    .task-card__due-date svg, .task-card__hours svg { width: 13px; height: 13px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .task-card__due-date, .task-card__hours { display: inline-flex; align-items: center; gap: 4px; }
    .task-card__priority { display: inline-flex; align-items: center; gap: 3.5px; text-transform: capitalize; }
    .task-card__priority-icon { width: 11px; height: 11px; fill: currentColor; stroke: currentColor; stroke-width: 1.2; flex-shrink: 0; }
    .task-card__priority[data-priority="critical"],
    .task-card__priority[data-priority="high"],
    .task-card__priority-icon[data-priority="critical"],
    .task-card__priority-icon[data-priority="high"] { color: var(--color-danger); }
    .task-card__priority[data-priority="medium"],
    .task-card__priority-icon[data-priority="medium"] { color: var(--color-warning, #d97706); }
    .task-card__priority[data-priority="low"],
    .task-card__priority-icon[data-priority="low"] { color: var(--color-text-secondary); }
    .task-card__event { overflow: hidden; max-width: 120px; border-radius: 999px; background: var(--color-surface-secondary); padding: 1px 8px; color: var(--color-text-secondary); font-size: 10px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .task-card__clock { min-width: 0; margin-left: auto; flex-shrink: 0; }

    .task-card__popover {
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
      color: #fff;
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
      padding-top: 7px;
      border-top: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
    }
    .task-card__subtask-toggle {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 4px;
      border: 0;
      background: transparent;
      border-radius: 4px;
      color: var(--color-text-secondary);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      line-height: 1.3;
      transition: color 120ms ease, background-color 120ms ease;
    }
    .task-card__subtask-toggle:hover {
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
    }
    .task-card__subtask-chevron {
      width: 10px;
      height: 10px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transform: rotate(-90deg);
      transition: transform 140ms ease;
    }
    .task-card__subtask-chevron--open {
      transform: rotate(0deg);
    }
    .task-card__subtask-count-pill {
      font-size: 10px;
      font-weight: 600;
      padding: 0 4px;
      border-radius: 999px;
      background: var(--color-surface-secondary);
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
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
      border-radius: 8px;
      border: 1.5px dashed var(--color-border);
      color: var(--color-text-secondary);
      background: var(--color-surface-secondary);
      transition: border-color 120ms ease, color 120ms ease;
    }
    .task-card__assignee-btn:hover .task-card__assignee-placeholder {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }
    .task-card__assignee-placeholder svg { width: 13px; height: 13px; fill: currentColor; }

    .task-card__assignee-popover {
      min-width: 190px;
      max-width: 250px;
      max-height: 240px;
      overflow-y: auto;
      border-radius: 8px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      padding: 6px;
      box-shadow: 0 10px 25px rgb(15 23 42 / 0.16);
      cursor: default;
    }
    .task-card__assignee-search {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      margin-bottom: 4px;
      border-bottom: 1px solid var(--color-border);
    }
    .task-card__assignee-search svg { width: 13px; height: 13px; stroke: var(--color-text-secondary); fill: none; stroke-width: 2; flex-shrink: 0; }
    .task-card__assignee-search input { width: 100%; border: 0; outline: none; background: transparent; font: inherit; font-size: 11.5px; color: var(--color-text-primary); }
    .task-card__assignee-list { display: flex; flex-direction: column; gap: 2px; }
    .task-card__assignee-option {
      display: flex;
      align-items: center;
      gap: 7px;
      width: 100%;
      padding: 5px 7px;
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
    .task-card__assignee-option:hover { background: var(--color-surface-secondary); }
    .task-card__assignee-option--selected { background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); color: var(--color-accent); font-weight: 600; }
    .task-card__assignee-option-avatar {
      width: 20px; height: 20px; border-radius: 9999px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 700;
      background: color-mix(in srgb, var(--color-accent) 18%, transparent);
      color: var(--color-accent);
      flex-shrink: 0;
    }
    .task-card__assignee-option-avatar--unassigned { background: var(--color-surface-secondary); color: var(--color-text-secondary); }
    .task-card__assignee-option-avatar--unassigned svg { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2; }
    .task-card__assignee-option-name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .task-card__assignee-check { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2.2; margin-left: auto; flex-shrink: 0; }
    .task-card__assignee-empty { margin: 6px 0 2px; color: var(--color-text-secondary); font-size: 12px; text-align: center; }
  `]
})
export class TaskCardComponent {
  private readonly taskApi = inject(TaskApiService);
  private readonly directory = inject(EmployeeDirectoryStore);
  private readonly store = inject(TaskBoardStore);

  task = input.required<WorkTask>();
  statuses = input<readonly TaskStatusColumn[]>([]);
  currentEmployeeId = input('');
  assignableMembers = input<readonly TaskCardAssignableMember[]>([]);

  viewed = output<WorkTask>();
  taskChanged = output<void>();

  protected readonly assigneePopoverOpen = signal(false);
  protected readonly assigneeSearch = signal('');
  protected readonly assigneePopoverPositions = ASSIGNEE_POPOVER_POSITIONS;

  protected readonly subtasksExpanded = signal(false);
  protected readonly subtasks = computed(() => this.store.subtasksByParentId()[this.task().id] ?? []);

  protected readonly isAssignee = computed(() => this.task().assigneeEmployeeIds.includes(this.currentEmployeeId()));
  protected readonly hasOpenSessionMine = computed(() =>
    this.task().openClockSessionEmployeeId === this.currentEmployeeId() && this.currentEmployeeId() !== ''
  );
  protected readonly hasOpenSessionOtherEmployee = computed(() => {
    const openBy = this.task().openClockSessionEmployeeId;
    return openBy !== null && openBy !== this.currentEmployeeId();
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
    for (const member of this.assignableMembers()) map[member.employeeId] = { name: member.name, avatarUrl: null };
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

  protected readonly filteredAssignableMembers = computed(() => {
    const q = this.assigneeSearch().trim().toLowerCase();
    const members = this.assignableMembers();
    if (!q) return members;
    return members.filter((m) => m.name.toLowerCase().includes(q));
  });

  protected initials(name: string): string {
    return initialsOf(name);
  }

  protected isAssigned(employeeId: string): boolean {
    return this.task().assigneeEmployeeIds.includes(employeeId);
  }

  protected readonly priorityPopoverOpen = signal(false);
  protected readonly dueDatePopoverOpen = signal(false);

  protected readonly priorityOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ] as const;

  protected readonly taskDueDateIso = computed(() => {
    const d = this.task().dueDate;
    if (!d) return '';
    return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  });

  protected toggleAssigneePopover(event: MouseEvent): void {
    event.stopPropagation();
    this.priorityPopoverOpen.set(false);
    this.dueDatePopoverOpen.set(false);
    this.assigneeSearch.set('');
    this.assigneePopoverOpen.update((open) => !open);
  }

  protected togglePriorityPopover(event: MouseEvent): void {
    event.stopPropagation();
    this.assigneePopoverOpen.set(false);
    this.dueDatePopoverOpen.set(false);
    this.priorityPopoverOpen.update((v) => !v);
  }

  protected toggleDueDatePopover(event: MouseEvent): void {
    event.stopPropagation();
    this.assigneePopoverOpen.set(false);
    this.priorityPopoverOpen.set(false);
    this.dueDatePopoverOpen.update((v) => !v);
  }

  protected async selectPriority(priority: WorkTask['priority']): Promise<void> {
    this.priorityPopoverOpen.set(false);
    if (this.task().priority === priority) return;
    await this.applyTaskEdit({ priority });
  }

  protected setQuickDueDate(preset: 'today' | 'tomorrow' | 'nextWeek'): void {
    const d = new Date();
    if (preset === 'tomorrow') d.setDate(d.getDate() + 1);
    if (preset === 'nextWeek') d.setDate(d.getDate() + 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    this.dueDatePopoverOpen.set(false);
    void this.applyTaskEdit({ dueDate: `${yyyy}-${mm}-${dd}` });
  }

  protected onDateChange(value: string): void {
    this.dueDatePopoverOpen.set(false);
    void this.applyTaskEdit({ dueDate: value || undefined });
  }

  protected clearDueDate(): void {
    this.dueDatePopoverOpen.set(false);
    void this.applyTaskEdit({ dueDate: undefined });
  }

  private async applyTaskEdit(overrides: Partial<{ priority: WorkTask['priority']; dueDate: string; estimatedHours: number }>): Promise<void> {
    const currentTask = this.task();
    const req = toEditTaskRequest(currentTask, overrides);
    try {
      if (typeof this.store.editTask === 'function') {
        await this.store.editTask(currentTask.id, req);
      } else {
        await firstValueFrom(this.taskApi.editTask(currentTask.id, req));
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

  protected resolveSubtaskAssignee(employeeId: string, subtask: WorkTask): { name: string; avatarUrl: string | null } | null {
    const fromParent = this.resolvedAssigneeAvatars()[employeeId];
    if (fromParent) return fromParent;
    const fromAssignees = subtask.assignees?.find((a) => a.employeeId === employeeId);
    if (fromAssignees) return { name: fromAssignees.name, avatarUrl: fromAssignees.avatarUrl };
    const fromMembers = this.assignableMembers().find((m) => m.employeeId === employeeId);
    if (fromMembers) return { name: fromMembers.name, avatarUrl: null };
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
    if (current.length === (employeeId ? 1 : 0) && (employeeId === null || current[0] === employeeId)) {
      return;
    }
    try {
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
