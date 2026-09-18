import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDragPreview, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, ElementRef, HostListener, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { TaskCardComponent } from '../task-card/task-card.component';

export interface QuickTaskCreatedEvent {
  title: string;
  statusId: string;
  priority: WorkTask['priority'];
  assigneeId?: string;
  dueDate?: string;
  objectiveId: string;
  categoryId: string;
  sprintId?: string | null;
  resolve: (ok: boolean) => void;
}

@Component({
  selector: 'app-task-board-column',
  standalone: true,
  imports: [CdkDropList, CdkDrag, CdkDragPlaceholder, CdkDragPreview, TaskCardComponent],
  template: `
    <div class="task-board-column">
      <!-- Status Header with hover '+' button -->
      <div class="task-board-column__header">
        <h3 class="task-board-column__title">
          <span class="task-board-column__status-dot" [style.color]="status().color" [class.task-board-column__status-dot--not-started]="status().category === 'not_started'"
            [class.task-board-column__status-dot--done]="status().category === 'done'" aria-hidden="true">@if(status().category === 'done'){<svg viewBox="0 0 12 12"><path d="m3 6 2 2 4-4" fill="none" stroke="white" stroke-width="1.5" /></svg>}</span>
          <span class="task-board-column__title-text">{{ status().name }}</span>
          <span class="task-board-column__count">{{ tasks().length }}</span>
        </h3>
        <div class="task-board-column__actions">
          <button
            type="button"
            class="task-board-column__add-btn"
            [class.task-board-column__add-btn--active]="isQuickCreateOpen()"
            title="Add Task"
            aria-label="Add Task"
            (click)="toggleQuickCreate()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Quick Task Creation Card -->
      @if (isQuickCreateOpen()) {
        <div class="quick-task-card" (click)="$event.stopPropagation()">
          <div class="quick-task-card__top">
            <input
              #quickTitleInput
              type="text"
              class="quick-task-card__input"
              placeholder="Task Name..."
              [value]="quickTitle()"
              (input)="quickTitle.set($any($event.target).value)"
              (keydown.enter)="submitQuickTask()"
              (keydown.escape)="onEscape()"
            />
            <button
              type="button"
              class="quick-task-card__save-btn"
              [disabled]="!quickTitle().trim() || submitting()"
              (click)="submitQuickTask()"
              title="Save (Enter)"
            >
              <span>Save</span>
              <span class="quick-task-card__enter-icon">↵</span>
            </button>
          </div>

          <div class="quick-task-card__chips">
            <!-- 1. Assignee Chip -->
            <div class="quick-task-chip-anchor">
              <button
                type="button"
                class="quick-task-chip"
                [class.quick-task-chip--active]="quickAssigneeId()"
                [attr.aria-expanded]="activePopover() === 'assignee'"
                (click)="togglePopover('assignee', $event)"
                title="Assignee"
              >
                <span class="quick-task-chip__icon">@</span>
                <span class="quick-task-chip__label">
                  {{ selectedAssigneeName() }}
                </span>
              </button>

              @if (activePopover() === 'assignee') {
                <div class="quick-popover" role="dialog" (click)="$event.stopPropagation()">
                  <div class="quick-popover__search">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    <input
                      type="text"
                      placeholder="Search people..."
                      [value]="assigneeSearch()"
                      (input)="assigneeSearch.set($any($event.target).value)"
                    />
                  </div>
                  <div class="quick-popover__list">
                    <button
                      type="button"
                      class="quick-popover__item"
                      [class.quick-popover__item--selected]="!quickAssigneeId()"
                      (click)="selectAssignee('')"
                    >
                      <span class="quick-popover__avatar quick-popover__avatar--unassigned">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </span>
                      <span>Unassigned</span>
                    </button>
                    @for (member of filteredAssignees(); track member.employeeId) {
                      <button
                        type="button"
                        class="quick-popover__item"
                        [class.quick-popover__item--selected]="quickAssigneeId() === member.employeeId"
                        (click)="selectAssignee(member.employeeId)"
                      >
                        <span class="quick-popover__avatar">{{ getInitials(member.name) }}</span>
                        <span class="quick-popover__name">{{ member.name }}</span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- 2. Dates Chip -->
            <div class="quick-task-chip-anchor">
              <button
                type="button"
                class="quick-task-chip"
                [class.quick-task-chip--active]="quickDueDate()"
                [attr.aria-expanded]="activePopover() === 'dueDate'"
                (click)="togglePopover('dueDate', $event)"
                title="Due date"
              >
                <svg class="quick-task-chip__svg" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="17" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <span class="quick-task-chip__label">
                  {{ formattedDueDate() }}
                </span>
              </button>

              @if (activePopover() === 'dueDate') {
                <div class="quick-popover quick-popover--date" role="dialog" (click)="$event.stopPropagation()">
                  <div class="quick-date-presets">
                    <button type="button" class="quick-date-preset-btn" (click)="setQuickDueDate(0)">Today</button>
                    <button type="button" class="quick-date-preset-btn" (click)="setQuickDueDate(1)">Tomorrow</button>
                    <button type="button" class="quick-date-preset-btn" (click)="setQuickDueDate(7)">Next week</button>
                  </div>
                  <div class="quick-date-input-wrap">
                    <input
                      type="date"
                      class="quick-date-input"
                      [value]="quickDueDate()"
                      (change)="setDueDate($any($event.target).value)"
                    />
                  </div>
                  @if (quickDueDate()) {
                    <button type="button" class="quick-date-clear-btn" (click)="setDueDate('')">Clear date</button>
                  }
                </div>
              }
            </div>

            <!-- 3. Priority Chip -->
            <div class="quick-task-chip-anchor">
              <button
                type="button"
                class="quick-task-chip"
                [class.quick-task-chip--active]="quickPriority() !== 'medium' || priorityUserChosen()"
                [attr.aria-expanded]="activePopover() === 'priority'"
                (click)="togglePopover('priority', $event)"
                title="Priority"
              >
                <svg class="quick-task-chip__svg quick-task-chip__svg--flag" [style.color]="priorityDetails().color" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
                </svg>
                <span class="quick-task-chip__label">
                  {{ priorityDetails().label }}
                </span>
              </button>

              @if (activePopover() === 'priority') {
                <div class="quick-popover" role="dialog" (click)="$event.stopPropagation()">
                  <div class="quick-popover__list">
                    @for (opt of priorityOptions; track opt.value) {
                      <button
                        type="button"
                        class="quick-popover__item"
                        [class.quick-popover__item--selected]="quickPriority() === opt.value"
                        (click)="setPriority(opt.value)"
                      >
                        <svg class="quick-popover__flag-icon" [style.color]="opt.color" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
                        </svg>
                        <span class="quick-popover__name">{{ opt.label }}</span>
                        @if (quickPriority() === opt.value) {
                          <svg class="quick-popover__check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 7" /></svg>
                        }
                      </button>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- 4. Module Chip (if >1 module available) -->
            @if (modules().length > 1) {
              <div class="quick-task-chip-anchor">
                <button
                  type="button"
                  class="quick-task-chip"
                  [attr.aria-expanded]="activePopover() === 'module'"
                  (click)="togglePopover('module', $event)"
                  title="Module"
                >
                  <svg class="quick-task-chip__svg" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
                  </svg>
                  <span class="quick-task-chip__label">{{ selectedModuleTitle() }}</span>
                </button>

                @if (activePopover() === 'module') {
                  <div class="quick-popover" role="dialog" (click)="$event.stopPropagation()">
                    <div class="quick-popover__list">
                      @for (m of modules(); track m.objectiveId) {
                        <button
                          type="button"
                          class="quick-popover__item"
                          [class.quick-popover__item--selected]="selectedModuleId() === m.objectiveId"
                          (click)="selectedModuleId.set(m.objectiveId); activePopover.set(null)"
                        >
                          <span class="quick-popover__name">{{ m.title }}</span>
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          @if (errorMessage()) {
            <p class="quick-task-card__error">{{ errorMessage() }}</p>
          }
        </div>
      }

      <!-- Tasks List Droppable -->
      <div
        cdkDropList
        [id]="status().id"
        [cdkDropListData]="tasks()"
        [cdkDropListConnectedTo]="connectedListIds()"
        (cdkDropListDropped)="onDrop($event)"
        class="task-board-column__list"
      >
        @for (task of tasks(); track task.id) {
          <div cdkDrag [cdkDragData]="task" class="task-board-column__drag-item">
            <app-task-card
              [task]="task"
              [statuses]="allStatuses()"
              [employeeNames]="employeeNames()"
              [currentEmployeeId]="currentEmployeeId()"
              (viewed)="taskViewed.emit($event)"
              (taskChanged)="taskChanged.emit()"
            />
            <div *cdkDragPreview class="task-board-column__drag-preview">
              <span class="task-board-column__drag-preview-id">{{ task.shortId }}</span>
              <span class="task-board-column__drag-preview-title">{{ task.title }}</span>
            </div>
            <div *cdkDragPlaceholder class="task-board-column__drag-placeholder"></div>
          </div>
        }
      </div>

      <!-- Always visible '+ Add Task' button at the bottom of the column -->
      <button
        type="button"
        class="task-board-column__always-add-btn"
        (click)="openQuickCreate()"
      >
        <span class="task-board-column__always-add-icon">+</span>
        <span>Add Task</span>
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1 1 0;
      min-width: 280px;
      align-self: flex-start;
    }
    .task-board-column {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: fit-content;
      background: var(--color-surface-secondary);
      border: none;
      border-radius: 12px;
      padding: 12px;
      scroll-snap-align: start;
    }
    .task-board-column__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 28px;
      margin: 0 0 10px;
    }
    .task-board-column__title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-primary);
      margin: 0;
    }
    .task-board-column__status-dot { display: inline-flex; width: 12px; height: 12px; border-radius: 999px; margin-right: 4px; background: currentColor; border: 2px solid currentColor; box-sizing: border-box; flex-shrink: 0; }
    .task-board-column__status-dot--not-started { background: transparent; }
    .task-board-column__status-dot--done { border: 0; }
    .task-board-column__status-dot svg { width: 12px; height: 12px; }
    .task-board-column__count {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-secondary);
    }
    .task-board-column__actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    /* The '+' button only needs to appear when hovering the status header / column */
    .task-board-column__add-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity 140ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease;
    }
    .task-board-column__header:hover .task-board-column__add-btn,
    .task-board-column:hover .task-board-column__add-btn,
    .task-board-column__add-btn--active {
      opacity: 1;
      pointer-events: auto;
    }
    .task-board-column__add-btn:hover,
    .task-board-column__add-btn--active {
      background: var(--color-surface);
      border-color: var(--color-border);
      color: var(--color-text-primary);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
    }
    .task-board-column__add-btn svg {
      width: 15px;
      height: 15px;
      stroke: currentColor;
      stroke-width: 2.2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Quick Task Card */
    .quick-task-card {
      display: flex;
      flex-direction: column;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 10px;
      box-shadow: 0 2px 8px rgb(15 23 42 / 0.06);
      transition: border-color 140ms ease, box-shadow 140ms ease;
    }
    .quick-task-card:focus-within {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 20%, transparent), 0 2px 8px rgb(15 23 42 / 0.08);
    }
    .quick-task-card__top {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .quick-task-card__input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      font-size: 13.5px;
      font-weight: 500;
      color: var(--color-text-primary);
      padding: 2px 0;
    }
    .quick-task-card__input::placeholder {
      color: var(--color-text-secondary);
      opacity: 0.7;
    }
    .quick-task-card__save-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 26px;
      padding: 0 8px;
      border: 0;
      border-radius: 5px;
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
      font: inherit;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 120ms ease, color 120ms ease;
      flex-shrink: 0;
    }
    .quick-task-card__save-btn:hover:not(:disabled) {
      background: var(--color-accent);
      color: #fff;
    }
    .quick-task-card__save-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .quick-task-card__enter-icon {
      font-size: 12px;
      font-weight: 700;
      opacity: 0.75;
    }
    .quick-task-card__chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
    }
    .quick-task-chip-anchor {
      position: relative;
      display: inline-flex;
    }
    .quick-task-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 24px;
      padding: 0 8px;
      border-radius: 5px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--color-text-secondary);
      font: inherit;
      font-size: 11.5px;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
      transition: all 120ms ease;
      white-space: nowrap;
    }
    .quick-task-chip:hover {
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
    }
    .quick-task-chip--active {
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
      font-weight: 600;
    }
    .quick-task-chip__icon {
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
    }
    .quick-task-chip__svg {
      width: 13px;
      height: 13px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      flex-shrink: 0;
    }
    .quick-task-chip__svg--flag {
      fill: currentColor;
      stroke: none;
    }
    .quick-task-chip__label {
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .quick-task-card__error {
      margin: 6px 0 0;
      font-size: 11.5px;
      color: var(--color-danger, #ef4444);
    }

    /* Inline Popovers */
    .quick-popover {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      z-index: 1000;
      min-width: 190px;
      max-width: 260px;
      max-height: 240px;
      overflow-y: auto;
      border-radius: 8px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      padding: 6px;
      box-shadow: 0 10px 25px rgb(15 23 42 / 0.16);
    }
    .quick-popover--date {
      padding: 10px;
      min-width: 210px;
    }
    .quick-popover__search {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      margin-bottom: 4px;
      border-bottom: 1px solid var(--color-border);
    }
    .quick-popover__search svg {
      width: 13px;
      height: 13px;
      stroke: var(--color-text-secondary);
      fill: none;
      stroke-width: 2;
      flex-shrink: 0;
    }
    .quick-popover__search input {
      width: 100%;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      font-size: 11.5px;
      color: var(--color-text-primary);
    }
    .quick-popover__list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .quick-popover__item {
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
    .quick-popover__item:hover {
      background: var(--color-surface-secondary);
    }
    .quick-popover__item--selected {
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
      color: var(--color-accent);
      font-weight: 600;
    }
    .quick-popover__name {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .quick-popover__avatar {
      width: 20px;
      height: 20px;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      background: color-mix(in srgb, var(--color-accent) 18%, transparent);
      color: var(--color-accent);
      flex-shrink: 0;
    }
    .quick-popover__avatar--unassigned {
      background: var(--color-surface-secondary);
      color: var(--color-text-secondary);
    }
    .quick-popover__avatar--unassigned svg {
      width: 12px;
      height: 12px;
      stroke: currentColor;
      stroke-width: 2;
    }
    .quick-popover__flag-icon {
      width: 14px;
      height: 14px;
      fill: currentColor;
      flex-shrink: 0;
    }
    .quick-popover__check {
      width: 13px;
      height: 13px;
      stroke: currentColor;
      fill: none;
      stroke-width: 2.2;
      margin-left: auto;
    }
    .quick-date-presets {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    }
    .quick-date-preset-btn {
      flex: 1;
      padding: 4px 6px;
      font: inherit;
      font-size: 11px;
      font-weight: 500;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
      cursor: pointer;
      transition: all 120ms ease;
    }
    .quick-date-preset-btn:hover {
      border-color: var(--color-accent);
      background: var(--color-surface);
      color: var(--color-accent);
    }
    .quick-date-input-wrap {
      margin-bottom: 6px;
    }
    .quick-date-input {
      width: 100%;
      height: 28px;
      padding: 0 6px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      font: inherit;
      font-size: 11.5px;
      color: var(--color-text-primary);
      background: var(--color-surface-secondary);
      outline: none;
    }
    .quick-date-input:focus {
      border-color: var(--color-accent);
      background: var(--color-surface);
    }
    .quick-date-clear-btn {
      width: 100%;
      padding: 4px;
      border: 0;
      border-radius: 4px;
      font: inherit;
      font-size: 11px;
      color: var(--color-danger, #ef4444);
      background: transparent;
      cursor: pointer;
      text-align: center;
    }
    .quick-date-clear-btn:hover {
      background: color-mix(in srgb, var(--color-danger, #ef4444) 10%, transparent);
    }

    /* Tasks list */
    .task-board-column__list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 8px;
    }
    .task-board-column__drag-item { display: block; }
    .task-board-column__drag-preview {
      display: flex;
      width: 260px;
      flex-direction: column;
      gap: 6px;
      border: 1px solid var(--color-accent);
      border-radius: 12px;
      padding: 12px 14px;
      background: var(--color-surface);
      box-shadow: 0 14px 30px rgb(15 23 42 / 0.18);
      transform: rotate(1deg) scale(1.02);
      cursor: grabbing;
    }
    .task-board-column__drag-preview-id { font-size: 10px; color: var(--color-text-secondary); }
    .task-board-column__drag-preview-title { overflow: hidden; color: var(--color-text-primary); font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
    .task-board-column__drag-placeholder {
      min-height: 78px;
      border: 1px dashed color-mix(in srgb, var(--color-accent) 55%, var(--color-border));
      border-radius: 12px;
      background: color-mix(in srgb, var(--color-accent) 8%, transparent);
      animation: task-drop-placeholder-in 180ms ease-out;
    }
    :host ::ng-deep .task-board-column__list.cdk-drop-list-dragging .task-board-column__drag-item:not(.cdk-drag-placeholder) {
      transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    :host ::ng-deep .task-board-column__drag-item.cdk-drag-animating {
      transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes task-drop-placeholder-in {
      from { opacity: 0; transform: scaleY(0.82); }
      to { opacity: 1; transform: scaleY(1); }
    }

    /* Always-visible '+ Add Task' button at bottom of status */
    .task-board-column__always-add-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      padding: 7px 10px;
      margin-top: 8px;
      border: 1px dashed transparent;
      border-radius: 8px;
      background: transparent;
      color: var(--color-accent, #3b82f6);
      font: inherit;
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: all 140ms ease;
    }
    .task-board-column__always-add-btn:hover {
      background: var(--color-surface);
      border-color: color-mix(in srgb, var(--color-accent, #3b82f6) 30%, var(--color-border));
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
    }
    .task-board-column__always-add-icon {
      font-size: 15px;
      line-height: 1;
      font-weight: 600;
    }

    @media (prefers-reduced-motion: reduce) {
      .task-board-column__drag-preview, .task-board-column__drag-placeholder { animation: none; transform: none; }
      :host ::ng-deep .task-board-column__list.cdk-drop-list-dragging .task-board-column__drag-item:not(.cdk-drag-placeholder),
      :host ::ng-deep .task-board-column__drag-item.cdk-drag-animating { transition: none; }
    }
  `]
})
export class TaskBoardColumnComponent {
  status = input.required<TaskStatusColumn>();
  tasks = input.required<WorkTask[]>();
  connectedListIds = input<string[]>([]);
  allStatuses = input<readonly TaskStatusColumn[]>([]);
  employeeNames = input<Record<string, string>>({});
  currentEmployeeId = input('');

  // Context passed from parent for task creation
  assignableMembers = input<readonly { employeeId: string; name: string }[]>([]);
  modules = input<readonly { objectiveId: string; title: string; isOwner: boolean }[]>([]);
  categories = input<readonly TaskCategoryColumn[]>([]);
  defaultObjectiveId = input('');
  defaultSprintId = input('');

  taskDropped = output<{ taskId: string; newStatusId: string }>();
  taskViewed = output<WorkTask>();
  taskChanged = output<void>();
  quickTaskCreated = output<QuickTaskCreatedEvent>();

  // Quick create state
  isQuickCreateOpen = signal(false);
  quickTitle = signal('');
  quickAssigneeId = signal('');
  quickDueDate = signal('');
  quickPriority = signal<WorkTask['priority']>('medium');
  priorityUserChosen = signal(false);
  selectedModuleId = signal('');
  submitting = signal(false);
  errorMessage = signal<string | null>(null);
  activePopover = signal<'assignee' | 'dueDate' | 'priority' | 'module' | null>(null);
  assigneeSearch = signal('');

  readonly quickTitleInput = viewChild<ElementRef<HTMLInputElement>>('quickTitleInput');

  readonly priorityOptions = [
    { value: 'low' as const, label: 'Low', color: '#3b82f6' },
    { value: 'medium' as const, label: 'Medium', color: '#eab308' },
    { value: 'high' as const, label: 'High', color: '#f97316' },
    { value: 'critical' as const, label: 'Critical', color: '#ef4444' }
  ];

  constructor() {
    effect(() => {
      const def = this.defaultObjectiveId();
      if (def) {
        this.selectedModuleId.set(def);
      } else if (this.modules().length > 0 && !this.selectedModuleId()) {
        this.selectedModuleId.set(this.modules()[0].objectiveId);
      }
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.activePopover()) {
      this.activePopover.set(null);
    }
  }

  selectedAssigneeName = computed(() => {
    const id = this.quickAssigneeId();
    if (!id) return 'Add assignee';
    return this.assignableMembers().find((m) => m.employeeId === id)?.name ?? 'Add assignee';
  });

  filteredAssignees = computed(() => {
    const q = this.assigneeSearch().toLowerCase().trim();
    const list = this.assignableMembers();
    if (!q) return list;
    return list.filter((m) => m.name.toLowerCase().includes(q));
  });

  formattedDueDate = computed(() => {
    const d = this.quickDueDate();
    if (!d) return 'Add dates';
    try {
      const [y, m, day] = d.split('-').map(Number);
      if (!y || !m || !day) return d;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[m - 1]} ${day}`;
    } catch {
      return d;
    }
  });

  priorityDetails = computed(() => {
    const p = this.quickPriority();
    const match = this.priorityOptions.find((o) => o.value === p);
    if (p === 'medium' && !this.priorityUserChosen()) {
      return { label: 'Add priority', color: 'var(--color-text-secondary)' };
    }
    return match ?? { label: 'Add priority', color: 'var(--color-text-secondary)' };
  });

  selectedModuleTitle = computed(() => {
    const id = this.selectedModuleId();
    return this.modules().find((m) => m.objectiveId === id)?.title ?? 'Module';
  });

  toggleQuickCreate(): void {
    if (this.isQuickCreateOpen()) {
      this.closeQuickCreate();
    } else {
      this.openQuickCreate();
    }
  }

  openQuickCreate(): void {
    this.isQuickCreateOpen.set(true);
    this.activePopover.set(null);
    this.errorMessage.set(null);
    setTimeout(() => {
      this.quickTitleInput()?.nativeElement?.focus();
    }, 50);
  }

  closeQuickCreate(): void {
    this.isQuickCreateOpen.set(false);
    this.activePopover.set(null);
    this.errorMessage.set(null);
    this.quickTitle.set('');
    this.quickAssigneeId.set('');
    this.quickDueDate.set('');
    this.quickPriority.set('medium');
    this.priorityUserChosen.set(false);
  }

  onEscape(): void {
    if (this.activePopover()) {
      this.activePopover.set(null);
    } else {
      this.closeQuickCreate();
    }
  }

  togglePopover(kind: 'assignee' | 'dueDate' | 'priority' | 'module', event: MouseEvent): void {
    event.stopPropagation();
    this.activePopover.update((curr) => (curr === kind ? null : kind));
  }

  selectAssignee(id: string): void {
    this.quickAssigneeId.set(id);
    this.activePopover.set(null);
  }

  setDueDate(val: string): void {
    this.quickDueDate.set(val);
    this.activePopover.set(null);
  }

  setQuickDueDate(daysFromNow: number): void {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    this.quickDueDate.set(`${year}-${month}-${day}`);
    this.activePopover.set(null);
  }

  setPriority(val: WorkTask['priority']): void {
    this.quickPriority.set(val);
    this.priorityUserChosen.set(true);
    this.activePopover.set(null);
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  async submitQuickTask(): Promise<void> {
    const title = this.quickTitle().trim();
    if (!title || this.submitting()) return;

    const objId = this.selectedModuleId() || this.defaultObjectiveId() || this.modules()[0]?.objectiveId;
    if (!objId) {
      this.errorMessage.set('Please select or create a milestone/module first.');
      return;
    }

    const catId = this.categories()[0]?.id ?? '';
    if (!catId) {
      this.errorMessage.set('No task category found for this project.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const ok = await new Promise<boolean>((resolve) => {
      this.quickTaskCreated.emit({
        title,
        statusId: this.status().id,
        priority: this.quickPriority(),
        assigneeId: this.quickAssigneeId() || undefined,
        dueDate: this.quickDueDate() || undefined,
        objectiveId: objId,
        categoryId: catId,
        sprintId: this.defaultSprintId() || null,
        resolve
      });
    });

    this.submitting.set(false);

    if (ok) {
      this.quickTitle.set('');
      this.quickAssigneeId.set('');
      this.quickDueDate.set('');
      this.quickPriority.set('medium');
      this.priorityUserChosen.set(false);
      setTimeout(() => {
        this.quickTitleInput()?.nativeElement?.focus();
      }, 50);
    }
  }

  onDrop(event: CdkDragDrop<WorkTask[]>): void {
    if (event.previousContainer === event.container) return;
    const task = event.item.data as WorkTask;
    this.taskDropped.emit({ taskId: task.id, newStatusId: event.container.id });
  }
}

