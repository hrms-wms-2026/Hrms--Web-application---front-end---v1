import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDragPreview, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, ElementRef, HostListener, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { TaskApiService } from '../../data-access/task-api.service';
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
  host: {
    '[class.task-board-column-host--collapsed]': 'isCollapsed()'
  },
  template: `
    @if (isCollapsed()) {
      <div
        class="task-board-column task-board-column--collapsed"
        [style.--status-color]="status().color || '#94a3b8'"
        (click)="toggleCollapse()"
        (keydown.enter)="toggleCollapse()"
        (keydown.space)="toggleCollapse(); $event.preventDefault()"
        tabindex="0"
        role="button"
        [attr.aria-label]="'Expand ' + status().name + ' column'"
        title="Expand group"
      >
        <div class="task-board-column__collapsed-strip">
          <button
            type="button"
            class="task-board-column__expand-btn"
            title="Expand group"
            aria-label="Expand group"
            (click)="toggleCollapse(); $event.stopPropagation()"
          >
            <span
              class="task-board-column__collapsed-dot"
              [class.task-board-column__collapsed-dot--not-started]="status().category === 'not_started'"
              [class.task-board-column__collapsed-dot--done]="status().category === 'done'"
              aria-hidden="true"
            >
              @if (status().category === 'done') {
                <svg viewBox="0 0 12 12"><path d="m3 6 2 2 4-4" fill="none" stroke="white" stroke-width="2" /></svg>
              }
            </span>
            <svg class="task-board-column__expand-chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          <span class="task-board-column__collapsed-title">{{ status().name }}</span>

          <span class="task-board-column__collapsed-count">{{ tasks().length }}</span>
        </div>
      </div>
    } @else {
      <div class="task-board-column" [style.--status-color]="status().color || '#94a3b8'">
        <!-- Status Header with hover '<' collapse, '...' menu, and '+' add button -->
        <div class="task-board-column__header">
          @if (isRenaming()) {
            <div class="task-board-column__rename-wrap" (click)="$event.stopPropagation()">
              <div class="task-board-column__rename-box">
                <!-- Color Swatch Button -->
                <button
                  type="button"
                  class="task-board-column__rename-color-btn"
                  [style.background]="renameColor()"
                  (click)="toggleRenameColorPicker($event)"
                  title="Change color"
                  aria-label="Change status color"
                ></button>

                <!-- Color Picker Popover -->
                @if (isRenameColorPickerOpen()) {
                  <div class="task-board-column__color-popover" role="dialog" (click)="$event.stopPropagation()">
                    <span class="task-board-column__color-popover-title">Status color</span>
                    <div class="task-board-column__color-palette">
                      @for (preset of baseColorPresets; track preset.value) {
                        <button
                          type="button"
                          class="task-board-column__color-swatch"
                          [class.task-board-column__color-swatch--active]="renameColor().toLowerCase() === preset.value.toLowerCase()"
                          [style.background]="preset.value"
                          [title]="preset.label"
                          [attr.aria-label]="preset.label"
                          (click)="selectRenameColor(preset.value)"
                        ></button>
                      }
                    </div>
                  </div>
                }

                <!-- Name Input -->
                <input
                  #renameInput
                  type="text"
                  class="task-board-column__rename-input"
                  [value]="renameName()"
                  (input)="renameName.set($any($event.target).value)"
                  (keydown.enter)="saveRename()"
                  (keydown.escape)="cancelRename()"
                  placeholder="Status name..."
                />

                <!-- Confirm Save Button -->
                <button
                  type="button"
                  class="task-board-column__rename-save-btn"
                  [disabled]="!renameName().trim() || savingRename()"
                  (click)="saveRename()"
                  title="Save rename"
                  aria-label="Save rename"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          } @else {
            <h3 class="task-board-column__title">
              <span class="task-board-column__status-badge" [style.background]="status().color || '#94a3b8'">
                <span class="task-board-column__status-dot" [style.color]="status().color" [class.task-board-column__status-dot--not-started]="status().category === 'not_started'"
                  [class.task-board-column__status-dot--done]="status().category === 'done'" aria-hidden="true">@if(status().category === 'done'){<svg viewBox="0 0 12 12"><path d="m3 6 2 2 4-4" fill="none" stroke="white" stroke-width="2" /></svg>}</span>
                <span class="task-board-column__title-text">{{ status().name }}</span>
              </span>
              <span class="task-board-column__count">{{ tasks().length }}</span>
            </h3>
          }

          <div class="task-board-column__actions">
            <button
              type="button"
              class="task-board-column__collapse-btn"
              title="Collapse group"
              aria-label="Collapse group"
              (click)="toggleCollapse()"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>

            @if (isProjectMember()) {
              <div class="task-board-column__menu-anchor">
                <button
                  type="button"
                  class="task-board-column__menu-btn"
                  [class.task-board-column__menu-btn--active]="isMenuOpen()"
                  title="Group options"
                  aria-label="Group options"
                  [attr.aria-expanded]="isMenuOpen()"
                  (click)="toggleMenu($event)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.75" />
                    <circle cx="12" cy="12" r="1.75" />
                    <circle cx="19" cy="12" r="1.75" />
                  </svg>
                </button>

                @if (isMenuOpen()) {
                  <div class="task-board-column__menu" role="menu" (click)="$event.stopPropagation()">
                    <div class="task-board-column__menu-heading">Group options</div>
                    <button
                      type="button"
                      class="task-board-column__menu-item"
                      role="menuitem"
                      (click)="onMenuCollapse()"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 4v16M9 12h11M14 7l-5 5 5 5" />
                      </svg>
                      <span>Collapse group</span>
                    </button>
                    <button
                      type="button"
                      class="task-board-column__menu-item"
                      role="menuitem"
                      (click)="startRename()"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                      <span>Rename</span>
                    </button>
                    <button
                      type="button"
                      class="task-board-column__menu-item"
                      role="menuitem"
                      (click)="onMenuEditStatuses()"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8v8M8 12h8" />
                      </svg>
                      <span>Edit statuses</span>
                    </button>
                  </div>
                }
              </div>
            }

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
  }
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1 1 0;
      min-width: 280px;
      align-self: flex-start;
      transition: flex 160ms ease, min-width 160ms ease, max-width 160ms ease;
    }
    :host(.task-board-column-host--collapsed) {
      flex: 0 0 38px;
      min-width: 38px;
      max-width: 38px;
    }
    .task-board-column {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: fit-content;
      background: color-mix(in srgb, var(--status-color, #94a3b8) 4.5%, var(--color-surface, #ffffff));
      border: none;
      border-radius: 12px;
      padding: 12px;
      scroll-snap-align: start;
      transition: background-color 150ms ease;
      box-sizing: border-box;
    }
    .task-board-column--collapsed {
      width: 38px;
      min-width: 38px;
      max-width: 38px;
      padding: 10px 4px;
      align-items: center;
      cursor: pointer;
      min-height: 180px;
      outline: none;
    }
    .task-board-column--collapsed:hover {
      background: color-mix(in srgb, var(--status-color, #94a3b8) 8.5%, var(--color-surface, #ffffff));
    }
    .task-board-column--collapsed:focus-visible {
      outline: 2px solid var(--color-accent, #3b82f6);
      outline-offset: 1px;
    }
    .task-board-column__collapsed-strip {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      gap: 10px;
    }
    .task-board-column__expand-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      cursor: pointer;
      position: relative;
      transition: all 140ms ease;
    }
    .task-board-column__expand-btn:hover {
      background: var(--color-surface);
      border-color: var(--color-border);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
    }
    .task-board-column__collapsed-dot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;
      border-radius: 999px;
      background: var(--status-color, #94a3b8);
      border: 1.5px solid var(--status-color, #94a3b8);
      box-sizing: border-box;
      flex-shrink: 0;
      transition: opacity 120ms ease;
    }
    .task-board-column__collapsed-dot--not-started {
      background: transparent !important;
      border: 1.5px solid var(--status-color, #94a3b8) !important;
    }
    .task-board-column__collapsed-dot--done {
      background: var(--status-color, #16a34a) !important;
      border-color: var(--status-color, #16a34a) !important;
    }
    .task-board-column__collapsed-dot svg {
      width: 9px;
      height: 9px;
    }
    .task-board-column__expand-chevron {
      position: absolute;
      width: 14px;
      height: 14px;
      stroke: var(--color-text-primary);
      stroke-width: 2.2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .task-board-column--collapsed:hover .task-board-column__collapsed-dot {
      opacity: 0;
    }
    .task-board-column--collapsed:hover .task-board-column__expand-chevron {
      opacity: 1;
    }
    .task-board-column__collapsed-title {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      text-transform: uppercase;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--color-text-secondary);
      user-select: none;
      white-space: nowrap;
      transition: color 140ms ease;
    }
    .task-board-column--collapsed:hover .task-board-column__collapsed-title {
      color: var(--color-text-primary);
    }
    .task-board-column__collapsed-count {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--color-text-secondary);
      user-select: none;
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
      gap: 7px;
      margin: 0;
    }
    .task-board-column__status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 9px 3px 7px;
      border-radius: 6px;
      color: #ffffff;
      line-height: 1.2;
    }
    .task-board-column__status-dot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 11px;
      height: 11px;
      border-radius: 999px;
      background: #ffffff;
      border: 1.5px solid #ffffff;
      box-sizing: border-box;
      flex-shrink: 0;
    }
    .task-board-column__status-dot--not-started {
      background: transparent;
      border: 1.5px solid #ffffff;
    }
    .task-board-column__status-dot--done {
      background: transparent;
      border: 0;
    }
    .task-board-column__status-dot svg {
      width: 11px;
      height: 11px;
    }
    .task-board-column__title-text {
      font-size: 11px;
      font-weight: 700;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      white-space: nowrap;
    }
    .task-board-column__count {
      font-size: 12px;
      font-weight: 600;
      color: var(--status-color, var(--color-text-secondary));
    }
    .task-board-column__actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    /* The hover collapse, menu, and add buttons */
    .task-board-column__collapse-btn,
    .task-board-column__menu-btn,
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
    .task-board-column__header:hover .task-board-column__collapse-btn,
    .task-board-column__header:hover .task-board-column__menu-btn,
    .task-board-column__header:hover .task-board-column__add-btn,
    .task-board-column:hover .task-board-column__collapse-btn,
    .task-board-column:hover .task-board-column__menu-btn,
    .task-board-column:hover .task-board-column__add-btn,
    .task-board-column__menu-btn--active,
    .task-board-column__add-btn--active {
      opacity: 1;
      pointer-events: auto;
    }
    .task-board-column__collapse-btn:hover,
    .task-board-column__menu-btn:hover,
    .task-board-column__add-btn:hover,
    .task-board-column__menu-btn--active,
    .task-board-column__add-btn--active {
      background: var(--color-surface);
      border-color: var(--color-border);
      color: var(--color-text-primary);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
    }
    .task-board-column__collapse-btn:focus-visible,
    .task-board-column__menu-btn:focus-visible,
    .task-board-column__add-btn:focus-visible {
      opacity: 1;
      pointer-events: auto;
      outline: 2px solid var(--color-accent);
      outline-offset: 1px;
    }
    .task-board-column__collapse-btn svg,
    .task-board-column__add-btn svg {
      width: 15px;
      height: 15px;
      stroke: currentColor;
      stroke-width: 2.2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .task-board-column__menu-btn svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    /* 3-Dot Dropdown Menu */
    .task-board-column__menu-anchor {
      position: relative;
      display: inline-flex;
    }
    .task-board-column__menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      z-index: 50;
      min-width: 170px;
      padding: 4px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12);
      display: flex;
      flex-direction: column;
      gap: 2px;
      animation: menu-appear 120ms ease-out;
    }
    @keyframes menu-appear {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .task-board-column__menu-heading {
      font-size: 11px;
      font-weight: 600;
      color: var(--color-text-secondary);
      padding: 4px 8px 2px;
      user-select: none;
    }
    .task-board-column__menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 8px;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--color-text-primary);
      border: none;
      border-radius: 5px;
      background: transparent;
      cursor: pointer;
      text-align: left;
      transition: background-color 100ms ease;
    }
    .task-board-column__menu-item:hover {
      background: var(--color-surface-secondary, #f1f5f9);
    }
    .task-board-column__menu-item svg {
      width: 14px;
      height: 14px;
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
      flex-shrink: 0;
      color: var(--color-text-secondary);
    }

    /* Rename Inline Controls */
    .task-board-column__rename-wrap {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;
      margin-right: 6px;
    }
    .task-board-column__rename-box {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      height: 28px;
      padding: 2px 6px 2px 5px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      box-sizing: border-box;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
      position: relative;
    }
    .task-board-column__rename-box:focus-within {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 20%, transparent);
    }
    .task-board-column__rename-color-btn {
      width: 15px;
      height: 15px;
      border-radius: 4px;
      border: 1.5px solid rgba(0, 0, 0, 0.15);
      cursor: pointer;
      flex-shrink: 0;
      padding: 0;
      transition: transform 100ms ease;
    }
    .task-board-column__rename-color-btn:hover {
      transform: scale(1.1);
    }
    .task-board-column__rename-input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      outline: none;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-primary);
      padding: 0;
    }
    .task-board-column__rename-save-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--color-accent);
      cursor: pointer;
      flex-shrink: 0;
      transition: background-color 100ms ease;
    }
    .task-board-column__rename-save-btn:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    }
    .task-board-column__rename-save-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .task-board-column__rename-save-btn svg {
      width: 14px;
      height: 14px;
    }
    .task-board-column__color-popover {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      z-index: 60;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 8px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .task-board-column__color-popover-title {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--color-text-secondary);
      user-select: none;
    }
    .task-board-column__color-palette {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .task-board-column__color-swatch {
      width: 20px;
      height: 20px;
      border-radius: 999px;
      border: 2px solid transparent;
      cursor: pointer;
      padding: 0;
      transition: transform 100ms ease, border-color 100ms ease;
    }
    .task-board-column__color-swatch:hover {
      transform: scale(1.15);
    }
    .task-board-column__color-swatch--active {
      border-color: var(--color-text-primary);
      transform: scale(1.15);
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
      border: 1px dashed color-mix(in srgb, var(--status-color, var(--color-accent)) 55%, var(--color-border));
      border-radius: 12px;
      background: color-mix(in srgb, var(--status-color, var(--color-accent)) 8%, transparent);
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
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--status-color, var(--color-accent, #3b82f6));
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: all 140ms ease;
    }
    .task-board-column__always-add-btn:hover {
      background: color-mix(in srgb, var(--status-color, #94a3b8) 10%, transparent);
      box-shadow: none;
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
  projectId = input('');
  isProjectMember = input(false);

  taskDropped = output<{ taskId: string; newStatusId: string }>();
  taskViewed = output<WorkTask>();
  taskChanged = output<void>();
  quickTaskCreated = output<QuickTaskCreatedEvent>();
  editStatusesClicked = output<void>();
  statusUpdated = output<void>();

  private readonly taskApi = inject(TaskApiService);

  // 3-dot Menu & Rename state
  isMenuOpen = signal(false);
  isRenaming = signal(false);
  renameName = signal('');
  renameColor = signal('');
  isRenameColorPickerOpen = signal(false);
  savingRename = signal(false);

  readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');

  readonly baseColorPresets = [
    { value: '#94A3B8', label: 'Gray' },
    { value: '#16A34A', label: 'Green' },
    { value: '#2563EB', label: 'Blue' },
    { value: '#DC2626', label: 'Red' }
  ];

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

  // Column collapse state
  isCollapsed = signal(false);

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
    if (this.isMenuOpen()) {
      this.isMenuOpen.set(false);
    }
    if (this.isRenameColorPickerOpen()) {
      this.isRenameColorPickerOpen.set(false);
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

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuOpen.update((v) => !v);
  }

  onMenuCollapse(): void {
    this.isMenuOpen.set(false);
    this.toggleCollapse();
  }

  startRename(): void {
    this.isMenuOpen.set(false);
    this.renameName.set(this.status().name);
    this.renameColor.set(this.status().color || '#94a3b8');
    this.isRenameColorPickerOpen.set(false);
    this.isRenaming.set(true);
    setTimeout(() => {
      this.renameInput()?.nativeElement?.select();
    }, 50);
  }

  cancelRename(): void {
    this.isRenaming.set(false);
    this.isRenameColorPickerOpen.set(false);
  }

  toggleRenameColorPicker(event: MouseEvent): void {
    event.stopPropagation();
    this.isRenameColorPickerOpen.update((v) => !v);
  }

  selectRenameColor(color: string): void {
    this.renameColor.set(color);
    this.isRenameColorPickerOpen.set(false);
  }

  async saveRename(): Promise<void> {
    const newName = this.renameName().trim();
    if (!newName || this.savingRename()) return;
    const newColor = this.renameColor() || this.status().color || '#94a3b8';
    if (newName === this.status().name && newColor === this.status().color) {
      this.isRenaming.set(false);
      return;
    }

    this.savingRename.set(true);
    try {
      const s = this.status();
      await firstValueFrom(
        this.taskApi.editStatus(this.projectId(), s.id, {
          name: newName,
          displayOrder: s.displayOrder,
          requiresApproval: s.requiresApproval,
          approverId: s.approverId ?? undefined,
          visibility: s.visibility,
          category: s.category,
          color: newColor
        })
      );
      this.isRenaming.set(false);
      this.isRenameColorPickerOpen.set(false);
      this.statusUpdated.emit();
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      this.savingRename.set(false);
    }
  }

  onMenuEditStatuses(): void {
    this.isMenuOpen.set(false);
    this.editStatusesClicked.emit();
  }

  toggleCollapse(): void {
    this.isCollapsed.update((v) => !v);
    if (this.isCollapsed()) {
      this.closeQuickCreate();
      this.cancelRename();
      this.isMenuOpen.set(false);
    }
  }

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
    if (this.isRenameColorPickerOpen()) {
      this.isRenameColorPickerOpen.set(false);
    } else if (this.isRenaming()) {
      this.cancelRename();
    } else if (this.isMenuOpen()) {
      this.isMenuOpen.set(false);
    } else if (this.activePopover()) {
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

