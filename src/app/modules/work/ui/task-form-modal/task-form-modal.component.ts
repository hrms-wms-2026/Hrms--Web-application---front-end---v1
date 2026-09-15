import { Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { Sprint } from '../../models/sprint.model';
import { CreateTaskRequestDto, InsufficientAllocationErrorDto } from '../../models/dto/task.dto';
import { toTaskCategoryColumn } from '../../utils/task-category.mapper';
import { toWorkTask } from '../../utils/task.mapper';
import { toSprint } from '../../utils/sprint.mapper';
import { TaskApiService } from '../../data-access/task-api.service';
import { ProjectApiService } from '../../data-access/project-api.service';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { CurrentEmployeeStore } from '../../state/current-employee.store';
import { TaskHistoryFeedComponent } from '../task-history-feed/task-history-feed.component';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { TaskAttachmentListComponent, AttachmentPill } from '../task-attachment-list/task-attachment-list.component';
import { ColorSwatchPopoverComponent } from '../color-swatch-popover/color-swatch-popover.component';
import { TaskHistoryEntryDto } from '../../models/dto/task-history.dto';

export type TaskFormMode = 'create' | 'edit';

@Component({
  selector: 'app-task-form-modal',
  standalone: true,
  imports: [InputComponent, ButtonComponent, WorkDropdownComponent, TaskHistoryFeedComponent, TaskClockWidgetComponent, TaskAttachmentListComponent, ColorSwatchPopoverComponent],
  template: `
    @if (open()) {
      <div class="tfm-scrim" (click)="onBackdrop()">
        <div
          #tfm
          class="tfm"
          [class.tfm--create]="currentEffectiveMode() === 'create'"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          [attr.aria-label]="currentEffectiveMode() === 'create' ? 'Create task' : task()?.title"
          (click)="$event.stopPropagation()"
          (keydown.escape)="onEscape()"
        >

          <header class="tfm__head">
            @if (currentEffectiveMode() === 'create') {
              <div class="tfm__title">
                <h2>Create task</h2>
              </div>
            } @else if (task(); as t) {
              <div class="tfm__title">
                <span class="tfm__short-id">{{ t.shortId }}</span>
                <h2>{{ t.title }}</h2>
              </div>
            } @else {
              <div class="tfm__title"><h2>Task</h2></div>
            }
            <button type="button" class="tfm__x" aria-label="Close" (click)="onCancel()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </header>

          <div class="tfm__body" (click)="closePopover()">
            @if (loading()) {
              <div class="tfm-loading">
                <span class="tfm-spinner"></span>
                <span>Loading…</span>
              </div>
            } @else if (loadError()) {
              <p class="tfm__error" role="alert">{{ loadError() }}</p>
            } @else if (currentEffectiveMode() === 'create') {
              @if (successToastMessage()) {
                <div class="tfm-success-toast" role="status">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                  <span>{{ successToastMessage() }}</span>
                  <button type="button" class="tfm-toast-dismiss" aria-label="Dismiss message" (click)="successToastMessage.set(null)">×</button>
                </div>
              }

              <!-- Level 1: Task Title & Description -->
              <div class="tfm-level1">
                <div class="tfm-title-block">
                  <input
                    #taskTitleInput
                    type="text"
                    class="tfm-title-input"
                    [class.tfm-title-input--error]="errors()['title']"
                    placeholder="Task title"
                    [value]="title()"
                    (input)="title.set($any($event.target).value)"
                    aria-label="Task title"
                  />
                  @if (errors()['title']) {
                    <span class="tfm__error tfm-title-error" role="alert">{{ errors()['title'] }}</span>
                  }
                </div>

                <!-- Rich text formatted description editor -->
                <div class="tfm-editor">
                  <div class="tfm-editor__toolbar" (click)="$event.stopPropagation()">
                    <div class="tfm-editor__tools-left">
                      <button type="button" class="tfm-editor__tool" title="Bold (Ctrl+B)" (mousedown)="$event.preventDefault()" (click)="formatDoc('bold')">
                        <strong>B</strong>
                      </button>
                      <button type="button" class="tfm-editor__tool" title="Italic (Ctrl+I)" (mousedown)="$event.preventDefault()" (click)="formatDoc('italic')">
                        <em>I</em>
                      </button>
                      <button type="button" class="tfm-editor__tool" title="Underline (Ctrl+U)" (mousedown)="$event.preventDefault()" (click)="formatDoc('underline')">
                        <u>U</u>
                      </button>
                      <div class="tfm-link-anchor">
                        <button
                          type="button"
                          class="tfm-editor__tool"
                          [class.tfm-editor__tool--active]="showTextColorPopover()"
                          title="Text color"
                          (mousedown)="$event.preventDefault()"
                          (click)="toggleTextColorPopover($event)"
                        >
                          <strong style="text-decoration: underline; text-decoration-color: #e03131;">A</strong>
                        </button>
                        @if (showTextColorPopover()) {
                          <app-color-swatch-popover
                            label="Remove color"
                            [swatches]="swatchPalette"
                            (colorSelected)="applyTextColor($event)"
                          />
                        }
                      </div>

                      <div class="tfm-link-anchor">
                        <button
                          type="button"
                          class="tfm-editor__tool"
                          [class.tfm-editor__tool--active]="showHighlightPopover()"
                          title="Highlight"
                          (mousedown)="$event.preventDefault()"
                          (click)="toggleHighlightPopover($event)"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 11 6-6 4 4-6 6H9v-4Z" /><path d="M3 21h6" /></svg>
                        </button>
                        @if (showHighlightPopover()) {
                          <app-color-swatch-popover
                            label="Remove highlight"
                            [swatches]="highlightPalette"
                            (colorSelected)="applyHighlight($event)"
                          />
                        }
                      </div>
                      <span class="tfm-editor__divider"></span>
                      <button type="button" class="tfm-editor__tool" title="Code" (mousedown)="$event.preventDefault()" (click)="formatCode()">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></svg>
                      </button>
                      <button type="button" class="tfm-editor__tool" title="Bullet list" (mousedown)="$event.preventDefault()" (click)="formatList('unordered')">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                      </button>
                      <button type="button" class="tfm-editor__tool" title="Numbered list" (mousedown)="$event.preventDefault()" (click)="formatList('ordered')">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M3 18h3L4 15.5a1.5 1.5 0 0 1 2-1.5" /></svg>
                      </button>
                      <button type="button" class="tfm-editor__tool" title="Checklist" (mousedown)="$event.preventDefault()" (click)="formatChecklist()">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="2" /><path d="m7 12 3 3 7-7" /></svg>
                      </button>
                      <span class="tfm-editor__divider"></span>
                      <div class="tfm-link-anchor">
                        <button
                          type="button"
                          class="tfm-editor__tool"
                          [class.tfm-editor__tool--active]="showLinkPopover()"
                          title="Insert link"
                          (mousedown)="$event.preventDefault()"
                          (click)="toggleLinkPopover($event)"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                        </button>

                        @if (showLinkPopover()) {
                          <div class="tfm-link-popover" (click)="$event.stopPropagation()">
                            <div class="tfm-link-popover__row">
                              <input
                                type="text"
                                class="tfm-link-input"
                                placeholder="Paste link (https://...)"
                                [value]="linkUrlInput()"
                                (input)="linkUrlInput.set($any($event.target).value)"
                                (keydown.enter)="applyLink()"
                              />
                            </div>
                            <div class="tfm-link-popover__row">
                              <input
                                type="text"
                                class="tfm-link-input tfm-link-input--secondary"
                                placeholder="Display text (optional)"
                                [value]="linkTextInput()"
                                (input)="linkTextInput.set($any($event.target).value)"
                                (keydown.enter)="applyLink()"
                              />
                            </div>
                            <div class="tfm-link-popover__actions">
                              <button type="button" class="tfm-link-btn tfm-link-btn--cancel" (click)="showLinkPopover.set(false)">Cancel</button>
                              <button type="button" class="tfm-link-btn tfm-link-btn--apply" (click)="applyLink()" [disabled]="!linkUrlInput().trim()">Insert link</button>
                            </div>
                          </div>
                        }
                      </div>

                      <input #imageFileInput type="file" accept="image/png,image/jpeg,image/webp" class="tfm-image-input-hidden" (change)="onImageFileSelected($event)" />
                      <button
                        type="button"
                        class="tfm-editor__tool"
                        title="Insert image"
                        (mousedown)="$event.preventDefault()"
                        (click)="imageFileInput.click()"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                      </button>
                    </div>

                    <div class="tfm-editor__tabs">
                      <button
                        type="button"
                        class="tfm-editor__tab"
                        [class.tfm-editor__tab--active]="descTab() === 'write'"
                        (click)="setDescTab('write')"
                      >
                        Write
                      </button>
                      <button
                        type="button"
                        class="tfm-editor__tab"
                        [class.tfm-editor__tab--active]="descTab() === 'preview'"
                        (click)="setDescTab('preview')"
                      >
                        Preview
                      </button>
                    </div>
                  </div>

                  <div
                    #descEditor
                    contenteditable="true"
                    class="tfm-editor__content"
                    [style.display]="descTab() === 'write' ? 'block' : 'none'"
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Description"
                    [attr.data-placeholder]="'Create a login screen with modern water drop UI style...'"
                    (input)="onEditorInput()"
                    (blur)="onEditorInput()"
                  ></div>

                  <div
                    class="tfm-editor__preview"
                    [style.display]="descTab() === 'preview' ? 'block' : 'none'"
                    [innerHTML]="renderedDescriptionPreview()"
                  ></div>
                </div>
              </div>

              <!-- Level 2: Interactive Property Chips -->
              <div class="tfm-level2">
                <div class="tfm-chips-row">
                  <!-- Assignee Chip -->
                  <div class="tfm-chip-anchor">
                    <button
                      type="button"
                      class="tfm-chip"
                      [class.tfm-chip--active]="assigneeEmployeeId()"
                      [attr.aria-expanded]="activePopover() === 'assignee'"
                      (click)="togglePopover('assignee', $event)"
                    >
                      <svg class="tfm-chip-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                      <span class="tfm-chip-label">{{ selectedAssigneeName() }}</span>
                    </button>
                    @if (activePopover() === 'assignee') {
                      <div class="tfm-popover" role="dialog" (click)="$event.stopPropagation()">
                        <div class="tfm-popover__search-box">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                          <input
                            type="text"
                            placeholder="Search people..."
                            [value]="assigneeSearchQuery()"
                            (input)="assigneeSearchQuery.set($any($event.target).value)"
                          />
                        </div>
                        <div class="tfm-popover__list">
                          <button
                            type="button"
                            class="tfm-popover__item"
                            [class.tfm-popover__item--selected]="!assigneeEmployeeId()"
                            (click)="assigneeEmployeeId.set(''); activePopover.set(null)"
                          >
                            <span class="tfm-popover__avatar tfm-popover__avatar--unassigned">
                              <svg class="tfm-chip-svg" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </span>
                            <span>Unassigned</span>
                          </button>
                          @for (member of filteredAssignees(); track member.employeeId) {
                            <button
                              type="button"
                              class="tfm-popover__item"
                              [class.tfm-popover__item--selected]="assigneeEmployeeId() === member.employeeId"
                              (click)="assigneeEmployeeId.set(member.employeeId); activePopover.set(null)"
                            >
                              <span class="tfm-popover__avatar">{{ getInitials(member.name) }}</span>
                              <span class="tfm-popover__name">{{ member.name }}</span>
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Priority Chip -->
                  <div class="tfm-chip-anchor">
                    <button
                      type="button"
                      class="tfm-chip"
                      [attr.aria-expanded]="activePopover() === 'priority'"
                      (click)="togglePopover('priority', $event)"
                    >
                      <span class="tfm-dot" [class]="priorityDetails().dotClass"></span>
                      <span class="tfm-chip-label">{{ priorityDetails().label }}</span>
                    </button>
                    @if (activePopover() === 'priority') {
                      <div class="tfm-popover" role="dialog" (click)="$event.stopPropagation()">
                        <div class="tfm-popover__list">
                          @for (opt of priorityOptionsList; track opt.value) {
                            <button
                              type="button"
                              class="tfm-popover__item"
                              [class.tfm-popover__item--selected]="priority() === opt.value"
                              (click)="setPriority(opt.value); activePopover.set(null)"
                            >
                              <span class="tfm-dot" [class]="opt.dotClass"></span>
                              <span class="tfm-popover__name">{{ opt.label }}</span>
                              @if (priority() === opt.value) {
                                <svg class="tfm-popover__check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 7" /></svg>
                              }
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Due Date Chip -->
                  <div class="tfm-chip-anchor">
                    <button
                      type="button"
                      class="tfm-chip"
                      [class.tfm-chip--active]="dueDate()"
                      [attr.aria-expanded]="activePopover() === 'dueDate'"
                      (click)="togglePopover('dueDate', $event)"
                    >
                      <svg class="tfm-chip-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                      <span class="tfm-chip-label">{{ formattedDueDate() }}</span>
                    </button>
                    @if (activePopover() === 'dueDate') {
                      <div class="tfm-popover tfm-popover--date" role="dialog" (click)="$event.stopPropagation()">
                        <div class="tfm-date-presets">
                          <button type="button" class="tfm-date-preset-btn" (click)="setQuickDueDate(0)">Today</button>
                          <button type="button" class="tfm-date-preset-btn" (click)="setQuickDueDate(1)">Tomorrow</button>
                          <button type="button" class="tfm-date-preset-btn" (click)="setQuickDueDate(7)">Next week</button>
                        </div>
                        <div class="tfm-date-input-wrap">
                          <input
                            type="date"
                            class="tfm-date-input"
                            [value]="dueDate()"
                            (change)="dueDate.set($any($event.target).value); activePopover.set(null)"
                          />
                        </div>
                        @if (dueDate()) {
                          <button type="button" class="tfm-date-clear-btn" (click)="dueDate.set(''); activePopover.set(null)">Clear date</button>
                        }
                      </div>
                    }
                  </div>

                  <!-- Module Chip -->
                  <div class="tfm-chip-anchor">
                    <button
                      type="button"
                      class="tfm-chip"
                      [class.tfm-chip--error]="errors()['objectiveId']"
                      [class.tfm-chip--active]="selectedObjectiveId()"
                      [attr.aria-expanded]="activePopover() === 'module'"
                      (click)="togglePopover('module', $event)"
                      [title]="errors()['objectiveId'] || selectedModuleTitle()"
                    >
                      <svg class="tfm-chip-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" /></svg>
                      <span class="tfm-chip-label">{{ selectedModuleTitle() }}</span>
                    </button>
                    @if (activePopover() === 'module') {
                      <div class="tfm-popover" role="dialog" (click)="$event.stopPropagation()">
                        @if (modules().length > 4) {
                          <div class="tfm-popover__search-box">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                            <input
                              type="text"
                              placeholder="Search modules..."
                              [value]="moduleSearchQuery()"
                              (input)="moduleSearchQuery.set($any($event.target).value)"
                            />
                          </div>
                        }
                        <div class="tfm-popover__list">
                          @for (m of filteredModules(); track m.objectiveId) {
                            <button
                              type="button"
                              class="tfm-popover__item"
                              [class.tfm-popover__item--selected]="selectedObjectiveId() === m.objectiveId"
                              (click)="selectedObjectiveId.set(m.objectiveId); clearError('objectiveId'); activePopover.set(null)"
                            >
                              <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" /></svg>
                              <span class="tfm-popover__name">{{ m.title }}</span>
                              @if (m.isOwner) {
                                <span class="tfm-popover__badge">Owner</span>
                              }
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Sprint Chip -->
                  <div class="tfm-chip-anchor">
                    <button
                      type="button"
                      class="tfm-chip"
                      [class.tfm-chip--active]="sprintId()"
                      [attr.aria-expanded]="activePopover() === 'sprint'"
                      (click)="togglePopover('sprint', $event)"
                    >
                      <svg class="tfm-chip-svg" viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                      <span class="tfm-chip-label">{{ selectedSprintTitle() }}</span>
                    </button>
                    @if (activePopover() === 'sprint') {
                      <div class="tfm-popover" role="dialog" (click)="$event.stopPropagation()">
                        <div class="tfm-popover__list">
                          <button
                            type="button"
                            class="tfm-popover__item"
                            [class.tfm-popover__item--selected]="!sprintId()"
                            (click)="sprintId.set(''); activePopover.set(null)"
                          >
                            <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                            <span class="tfm-popover__name">No sprint</span>
                          </button>
                          @for (s of availableSprints(); track s.id) {
                            <button
                              type="button"
                              class="tfm-popover__item"
                              [class.tfm-popover__item--selected]="sprintId() === s.id"
                              (click)="sprintId.set(s.id); activePopover.set(null)"
                            >
                              <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                              <span class="tfm-popover__name">{{ s.name }}</span>
                              @if (s.status === 'active') {
                                <span class="tfm-popover__badge tfm-popover__badge--active">Active</span>
                              }
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Category Chip -->
                  <div class="tfm-chip-anchor">
                    <button
                      type="button"
                      class="tfm-chip"
                      [class.tfm-chip--error]="errors()['categoryId']"
                      [class.tfm-chip--active]="categoryId()"
                      [attr.aria-expanded]="activePopover() === 'category'"
                      (click)="togglePopover('category', $event)"
                      [title]="errors()['categoryId'] || selectedCategoryTitle()"
                    >
                      <svg class="tfm-chip-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></svg>
                      <span class="tfm-chip-label">{{ selectedCategoryTitle() }}</span>
                    </button>
                    @if (activePopover() === 'category') {
                      <div class="tfm-popover tfm-popover--up" role="dialog" (click)="$event.stopPropagation()">
                        <div class="tfm-popover__list">
                          @for (c of categories(); track c.id) {
                            <button
                              type="button"
                              class="tfm-popover__item"
                              [class.tfm-popover__item--selected]="categoryId() === c.id"
                              (click)="categoryId.set(c.id); clearError('categoryId'); activePopover.set(null)"
                            >
                              <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></svg>
                              <span class="tfm-popover__name">{{ c.name }}</span>
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>

                @if (errors()['objectiveId']) {
                  <span class="tfm__error tfm-field-error" role="alert">{{ errors()['objectiveId'] }}</span>
                }
                @if (errors()['categoryId']) {
                  <span class="tfm__error tfm-field-error" role="alert">{{ errors()['categoryId'] }}</span>
                }
              </div>

              <!-- Level 3: More Fields (Estimated, Story Points, Attachments) -->
              <div class="tfm-level3">
                <div class="tfm-more-divider">
                  <button
                    type="button"
                    class="tfm-more-toggle"
                    (click)="showMoreFields.set(!showMoreFields())"
                    [attr.aria-expanded]="showMoreFields()"
                    [title]="showMoreFields() ? 'Hide planning & details' : 'Show planning & details'"
                  >
                    <span class="tfm-more-title">Planning & Details</span>
                    <svg
                      class="tfm-more-chevron"
                      [class.tfm-more-chevron--collapsed]="!showMoreFields()"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                  <div class="tfm-more-line"></div>
                  <button
                    type="button"
                    class="tfm-more-action"
                    (click)="showMoreFields.set(!showMoreFields())"
                  >
                    {{ showMoreFields() ? 'Hide' : 'Show' }}
                  </button>
                </div>

                @if (showMoreFields()) {
                  <div class="tfm-inline-fields">
                    <!-- Estimated hours -->
                    <div class="tfm-inline-field">
                      <label class="tfm-inline-label" for="tfm-est-hours">Estimated</label>
                      <div class="tfm-inline-box">
                        <input
                          id="tfm-est-hours"
                          type="number"
                          min="0"
                          step="0.5"
                          class="tfm-inline-input"
                          placeholder="0"
                          [value]="estimatedHoursDisplay()"
                          (input)="onEstimatedHoursChange($any($event.target).value)"
                        />
                        <span class="tfm-inline-unit">h</span>
                      </div>
                    </div>

                    <!-- Story points -->
                    <div class="tfm-inline-field">
                      <label class="tfm-inline-label" for="tfm-story-points">Story points</label>
                      <div class="tfm-inline-box">
                        <input
                          id="tfm-story-points"
                          type="number"
                          min="0"
                          step="1"
                          class="tfm-inline-input"
                          placeholder="0"
                          [value]="storyPointsDisplay()"
                          (input)="onStoryPointsChange($any($event.target).value)"
                        />
                        <span class="tfm-inline-unit">pts</span>
                      </div>
                    </div>

                    <!-- Attachments -->
                    <div class="tfm-inline-field">
                      <span class="tfm-inline-label">Attachments</span>
                      <app-task-attachment-list
                        [files]="attachedFiles()"
                        (fileSelected)="onAttachmentFilesSelected($event)"
                        (removed)="removeAttachedFile($event)"
                      />
                    </div>
                  </div>
                }
              </div>

              @if (allocationHint()) {
                <p class="tfm__error tfm-banner-error" role="alert" data-testid="allocation-hint">
                  Not enough allocation ({{ allocationHint()!.availableSlackHours }}h available). Edit the module's allocated hours, then try again.
                </p>
              } @else if (errorMessage()) {
                <p class="tfm__error tfm-banner-error" role="alert">{{ errorMessage() }}</p>
              }
            } @else if (task(); as t) {
              <div class="tfm__panes">
                <section class="tfm__section tfm__pane-main">
                  <span class="tfm__eyebrow">Edit fields</span>
                  <app-input label="Title" [value]="title()" [error]="errors()['title'] || ''" (valueChange)="title.set($event)" />
                  <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
                  <div class="tfm__grid tfm__grid--2">
                    <app-work-dropdown [options]="priorityOptions" [selected]="priority()" fieldLabel="Priority" accessibleLabel="Priority"
                      [fullWidth]="true" leadingIcon="filter" (selectionChanged)="setPriority($event)" />
                    <app-input label="Due date" type="date" [value]="dueDate()" (valueChange)="dueDate.set($event)" />
                    <app-input label="Estimated hours" type="number" [value]="estimatedHoursDisplay()" (valueChange)="onEstimatedHoursChange($event)" />
                    <app-input label="Story points" type="number" [value]="storyPointsDisplay()" (valueChange)="onStoryPointsChange($event)" />
                    <app-input label="Progress %" type="number" [value]="progressPercentDisplay()" (valueChange)="onProgressPercentChange($event)" />
                    <app-input label="Reason (optional)" [value]="reason()" (valueChange)="reason.set($event)" />
                  </div>
                  @if (errorMessage()) {
                    <p class="tfm__error" role="alert">{{ errorMessage() }}</p>
                  }
                </section>

                <aside class="tfm__pane-side">
                  <section class="tfm__card">
                    <div class="tfm__card-head">
                      <span class="tfm__card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></svg></span>
                      <div><h3>Task details</h3><p>Current workflow information</p></div>
                    </div>
                    <app-work-dropdown [options]="statusOptions()" [selected]="statusId()" fieldLabel="Status" accessibleLabel="Task status"
                      [fullWidth]="true" leadingIcon="status" (selectionChanged)="statusId.set($event)" />
                    @if (isObjectiveOwner()) {
                      <app-work-dropdown [options]="assigneeOptions()" [selected]="assigneeEmployeeId()" fieldLabel="Assigned to" accessibleLabel="Assignee"
                        [fullWidth]="true" leadingIcon="people" (selectionChanged)="assigneeEmployeeId.set($event)" />
                    } @else {
                      <dl class="tfm__meta"><dt>Assigned to</dt><dd>{{ assigneeName() }}</dd></dl>
                    }
                    <dl class="tfm__meta">
                      <dt>Category</dt><dd>{{ categoryName() }}</dd>
                      <dt>Completed hours</dt><dd>{{ t.completedHours }}</dd>
                    </dl>
                  </section>

                  <section class="tfm__card">
                    <div class="tfm__card-head">
                      <span class="tfm__card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg></span>
                      <div><h3>Attachments</h3><p>Files attached to this task</p></div>
                    </div>
                    <app-task-attachment-list
                      [files]="attachedFiles()"
                      (fileSelected)="onAttachmentFilesSelected($event)"
                      (removed)="removeAttachedFile($event)"
                    />
                  </section>

                  @if (isAssignee()) {
                    <section class="tfm__card">
                      <div class="tfm__card-head">
                        <span class="tfm__card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg></span>
                        <div><h3>Time tracking</h3><p>Track time spent on this task</p></div>
                      </div>
                      <app-task-clock-widget
                        [task]="widgetTask()!"
                        [isAssignee]="isAssignee()"
                        [hasOpenSessionMine]="hasOpenSessionMine()"
                        [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee()"
                        (clockedIn)="reloadHistory()"
                        (pushed)="onTaskPushed($event)"
                      />
                    </section>
                  }

                  <section class="tfm__card">
                    <div class="tfm__card-head tfm__card-head--between">
                      <div class="tfm__card-head">
                        <span class="tfm__card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h10M5 18h7" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg></span>
                        <div><h3>Activity log</h3><p>Recent task changes</p></div>
                      </div>
                      <span class="tfm__count">{{ history().length }}</span>
                    </div>
                    <app-task-history-feed [entries]="history()" (reasonSaved)="reloadHistory()" />
                  </section>
                </aside>
              </div>
            }
          </div>

          <footer class="tfm__foot">
            <button type="button" class="tfm__cancel" (click)="onCancel()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg><span>Cancel</span>
            </button>

            @if (currentEffectiveMode() === 'create') {
              <div class="tfm-split-action" (click)="$event.stopPropagation()">
                <div class="tfm-split-btn">
                  <button
                    type="button"
                    class="tfm-split-btn__main"
                    [disabled]="submitting()"
                    (click)="submit()"
                  >
                    @if (submitting()) {
                      <span class="tfm-spinner"></span>
                    }
                    <span>{{ primaryLabel() }}</span>
                  </button>
                  <button
                    type="button"
                    class="tfm-split-btn__arrow"
                    [disabled]="submitting()"
                    [attr.aria-expanded]="activePopover() === 'splitMenu'"
                    aria-label="More create actions"
                    (click)="togglePopover('splitMenu', $event)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                </div>

                @if (activePopover() === 'splitMenu') {
                  <div class="tfm-split-dropdown" role="menu">
                    <button type="button" class="tfm-split-dropdown__item" (click)="submitCreateWithAction('create_and_close')">
                      <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
                      <div>
                        <strong>Create task</strong>
                        <span>Save and close</span>
                      </div>
                    </button>
                    <button type="button" class="tfm-split-dropdown__item" (click)="submitCreateWithAction('create_and_add_another')">
                      <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                      <div>
                        <strong>Create & add another</strong>
                        <span>Save and enter next task</span>
                      </div>
                    </button>
                    <button type="button" class="tfm-split-dropdown__item" (click)="submitCreateWithAction('create_and_open')">
                      <svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" /></svg>
                      <div>
                        <strong>Create & open</strong>
                        <span>Save and view details</span>
                      </div>
                    </button>
                  </div>
                }
              </div>
            } @else {
              <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">{{ primaryLabel() }}</app-button>
            }
          </footer>

        </div>
      </div>
    }
  `,
  styles: [`
    .tfm-scrim { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: flex-start; justify-content: center; padding: 40px 24px; background: rgba(0,0,0,.5); overflow-y: auto; }
    .tfm { display: flex; flex-direction: column; width: 100%; max-width: 1152px; max-height: calc(100vh - 80px); border-radius: 12px; background: var(--color-surface); box-shadow: 0 20px 45px rgb(15 23 42 / .28); overflow: hidden; }
    .tfm--create { max-width: 820px; max-height: none; overflow: visible; }
    .tfm__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 28px 16px; border-bottom: 1px solid var(--color-border); }
    .tfm--create .tfm__head { border-top-left-radius: 12px; border-top-right-radius: 12px; }
    .tfm__title { display: flex; flex-direction: column; gap: 3px; }
    .tfm__title h2 { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -.02em; color: var(--color-text-primary); }
    .tfm__title p { margin: 0; font-size: 13px; color: var(--color-text-secondary); }
    .tfm__short-id { font-size: 12px; color: var(--color-text-secondary); }
    .tfm__x { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex: 0 0 auto; border: 0; border-radius: 7px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .tfm__x:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .tfm__x svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .tfm__body { display: flex; flex-direction: column; gap: 20px; padding: 20px 28px 24px; overflow-y: auto; }
    .tfm--create .tfm__body { overflow: visible; padding: 22px 28px 24px; }
    .tfm__section { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
    .tfm__eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--color-text-secondary); }
    .tfm__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 20px; }
    .tfm__grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .tfm__grid > * { min-width: 0; }
    .tfm__panes { display: grid; grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr); gap: 24px; }
    .tfm__pane-main, .tfm__pane-side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
    .tfm__card { display: flex; flex-direction: column; gap: 14px; border: 1px solid var(--color-border); border-radius: 12px; padding: 16px; background: var(--color-surface); box-shadow: 0 3px 12px rgb(15 23 42 / .04); }
    .tfm__card-head { display: flex; align-items: center; gap: 10px; }
    .tfm__card-head--between { justify-content: space-between; }
    .tfm__card-head h3 { margin: 0; font-size: 14px; font-weight: 650; color: var(--color-text-primary); }
    .tfm__card-head p { margin: 2px 0 0; font-size: 11px; color: var(--color-text-secondary); }
    .tfm__card-icon { display: inline-flex; width: 30px; height: 30px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 8px; background: color-mix(in srgb, var(--color-accent) 11%, var(--color-surface)); color: var(--color-accent); }
    .tfm__card-icon svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .tfm__meta { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; padding: 12px 0 2px; border-top: 1px solid var(--color-border); font-size: 13px; }
    .tfm__meta dt { color: var(--color-text-secondary); }
    .tfm__meta dd { margin: 0; color: var(--color-text-primary); font-weight: 600; text-align: right; }
    .tfm__count { display: inline-flex; min-width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0 7px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; font-weight: 650; }
    .tfm__error { margin: 0; font-size: 13px; color: var(--color-danger-text, var(--color-danger)); }
    .tfm__foot { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 16px 28px; border-top: 1px solid var(--color-border); background: var(--color-surface); }
    .tfm--create .tfm__foot { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; position: relative; z-index: 10; }
    .tfm__foot app-button { display: flex; }
    .tfm__cancel { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; transition: border-color 160ms ease, background-color 160ms ease; }
    .tfm__cancel:hover { border-color: var(--color-accent); background: var(--color-surface-secondary); }
    .tfm__cancel svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }

    /* Task Editor - Level 1: Title & Description */
    .tfm-level1 { display: flex; flex-direction: column; gap: 14px; }
    .tfm-title-block { display: flex; flex-direction: column; gap: 4px; }
    .tfm-title-input { width: 100%; border: 1px solid var(--color-border); border-radius: 8px; padding: 10px 14px; font-size: 18px; font-weight: 650; color: var(--color-text-primary); background: var(--color-surface); outline: none; transition: border-color 150ms ease, box-shadow 150ms ease; }
    .tfm-title-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 25%, transparent); }
    .tfm-title-input--error { border-color: var(--color-danger); }
    .tfm-title-error { font-size: 12px; }

    /* Description Editor with Toolbar & Live Preview */
    .tfm-editor { display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: 9px; overflow: hidden; background: var(--color-surface); min-height: 140px; transition: border-color 150ms ease, box-shadow 150ms ease; }
    .tfm-editor:focus-within { border-color: var(--color-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 25%, transparent); }
    .tfm-editor__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; background: var(--color-surface-secondary); border-bottom: 1px solid var(--color-border); user-select: none; }
    .tfm-editor__tool { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; border-radius: 5px; background: transparent; color: var(--color-text-secondary); font-size: 13px; cursor: pointer; transition: background-color 120ms ease, color 120ms ease; }
    .tfm-editor__tool:hover { background: var(--color-surface); color: var(--color-text-primary); }
    .tfm-editor__tool--active { background: color-mix(in srgb, var(--color-accent) 15%, var(--color-surface)) !important; color: var(--color-accent) !important; }
    .tfm-editor__tool svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .tfm-link-anchor { position: relative; display: inline-flex; }
    .tfm-image-input-hidden { display: none; }
    .tfm-link-popover { position: absolute; top: calc(100% + 6px); left: 0; z-index: 1050; width: 250px; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: 0 12px 28px rgb(15 23 42 / .18); display: flex; flex-direction: column; gap: 8px; animation: tfm-popover-in 120ms ease-out; }
    .tfm-link-popover__row { display: flex; width: 100%; }
    .tfm-link-input { width: 100%; height: 30px; padding: 0 8px; border: 1px solid var(--color-border); border-radius: 5px; background: var(--color-surface-secondary); font: inherit; font-size: 12px; color: var(--color-text-primary); outline: none; }
    .tfm-link-input:focus { border-color: var(--color-accent); background: var(--color-surface); }
    .tfm-link-input--secondary { font-size: 11.5px; opacity: 0.85; }
    .tfm-link-popover__actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
    .tfm-link-btn { border: 0; padding: 4px 10px; border-radius: 5px; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 120ms ease; }
    .tfm-link-btn--cancel { background: transparent; color: var(--color-text-secondary); }
    .tfm-link-btn--cancel:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .tfm-link-btn--apply { background: var(--color-accent); color: #fff; }
    .tfm-link-btn--apply:hover { opacity: 0.9; }
    .tfm-link-btn--apply:disabled { opacity: 0.4; cursor: not-allowed; }
    .tfm-editor__divider { width: 1px; height: 16px; background: var(--color-border); margin: 0 4px; }
    .tfm-editor__tabs { display: inline-flex; align-items: center; background: color-mix(in srgb, var(--color-border) 40%, var(--color-surface-secondary)); padding: 2px; border-radius: 6px; gap: 2px; }
    .tfm-editor__tab { border: 0; border-radius: 4px; padding: 3px 9px; font-size: 11px; font-weight: 600; background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: all 120ms ease; }
    .tfm-editor__tab:hover { color: var(--color-text-primary); }
    .tfm-editor__tab--active { background: var(--color-surface); color: var(--color-text-primary); box-shadow: 0 1px 2px rgb(15 23 42 / .08); }
    .tfm-editor__content { width: 100%; min-height: 96px; padding: 12px 14px; outline: none; font: inherit; font-size: 14px; line-height: 1.6; color: var(--color-text-primary); overflow-y: auto; word-break: break-word; }
    .tfm-editor__content:empty::before { content: attr(data-placeholder); color: var(--color-text-secondary); opacity: 0.65; pointer-events: none; }
    .tfm-editor__content strong, .tfm-editor__content b { font-weight: 700; }
    .tfm-editor__content em, .tfm-editor__content i { font-style: italic; }
    .tfm-editor__content u { text-decoration: underline; }
    .tfm-editor__content ul { margin: 6px 0; padding-left: 20px; list-style-type: disc; }
    .tfm-editor__content ol { margin: 6px 0; padding-left: 20px; list-style-type: decimal; }
    .tfm-editor__content li { margin-bottom: 2px; }
    .tfm-editor__content code, .tfm-inline-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12.5px; background: var(--color-surface-secondary); border: 1px solid var(--color-border); padding: 1px 5px; border-radius: 4px; color: var(--color-accent); }
    .tfm-editor__content pre { margin: 6px 0; padding: 8px 12px; border-radius: 6px; background: var(--color-surface-secondary); border: 1px solid var(--color-border); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12.5px; overflow-x: auto; }
    .tfm-editor-check-item, .tfm-preview-check { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
    .tfm-editor-check-item input[type="checkbox"], .tfm-preview-check input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--color-accent); cursor: pointer; flex-shrink: 0; }
    .tfm-editor-check-item input[type="checkbox"]:checked + .tfm-check-text { text-decoration: line-through; opacity: 0.6; }
    .tfm-check-text { font-size: 14px; color: var(--color-text-primary); }
    .tfm-editor__preview { padding: 12px 14px; min-height: 96px; font-size: 14px; line-height: 1.6; color: var(--color-text-primary); background: var(--color-surface); }
    .tfm-preview-empty { color: var(--color-text-secondary); font-style: italic; opacity: 0.7; }
    .tfm-preview-link { color: var(--color-accent); text-decoration: underline; }
    .tfm-preview-code { margin: 6px 0; padding: 8px 12px; border-radius: 6px; background: var(--color-surface-secondary); border: 1px solid var(--color-border); font-family: ui-monospace, monospace; font-size: 12.5px; overflow-x: auto; }
    .tfm-preview-inline-code { font-family: ui-monospace, monospace; font-size: 12.5px; background: var(--color-surface-secondary); border: 1px solid var(--color-border); padding: 1px 5px; border-radius: 4px; color: var(--color-accent); }
    .tfm-preview-bullet, .tfm-preview-num { margin: 3px 0 3px 6px; }

    /* Level 2: Interactive Property Chips */
    .tfm-level2 { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
    .tfm-chips-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
    .tfm-chip-anchor { position: relative; display: inline-flex; }
    .tfm-chip { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 9999px; border: 1px solid var(--color-border); background: var(--color-surface-secondary); color: var(--color-text-primary); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 140ms ease; white-space: nowrap; user-select: none; }
    .tfm-chip:hover { background: var(--color-surface); border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border)); box-shadow: 0 1px 3px rgb(15 23 42 / .06); }
    .tfm-chip--active { border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border)); background: var(--color-surface); }
    .tfm-chip--error { border-color: var(--color-danger); background: var(--color-danger-subtle); color: var(--color-danger-text); }
    .tfm-chip-svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
    .tfm-popover-item-icon { width: 15px; height: 15px; stroke: var(--color-text-secondary); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
    .tfm-chip-label { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tfm-field-error { font-size: 12px; margin-top: 2px; }

    /* Popovers */
    .tfm-popover { position: absolute; top: calc(100% + 6px); left: 0; z-index: 1000; min-width: 220px; max-width: 320px; max-height: 280px; overflow-y: auto; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-surface); padding: 6px; box-shadow: 0 14px 34px rgb(15 23 42 / .18); animation: tfm-popover-in 120ms ease-out; }
    .tfm-popover--up { top: auto; bottom: calc(100% + 6px); box-shadow: 0 -10px 30px rgb(15 23 42 / .16); animation: tfm-popover-in-up 120ms ease-out; }
    @keyframes tfm-popover-in-up { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    .tfm-popover--date { padding: 12px; min-width: 240px; }
    .tfm-popover__search-box { display: flex; align-items: center; gap: 6px; padding: 6px 8px; margin-bottom: 4px; border-bottom: 1px solid var(--color-border); }
    .tfm-popover__search-box svg { width: 14px; height: 14px; stroke: var(--color-text-secondary); fill: none; stroke-width: 2; flex-shrink: 0; }
    .tfm-popover__search-box input { width: 100%; border: 0; outline: none; background: transparent; font: inherit; font-size: 12px; color: var(--color-text-primary); }
    .tfm-popover__list { display: flex; flex-direction: column; gap: 2px; }
    .tfm-popover__item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 9px; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; text-align: left; transition: background-color 120ms ease; }
    .tfm-popover__item:hover { background: var(--color-surface-secondary); }
    .tfm-popover__item--selected { background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); color: var(--color-accent); font-weight: 600; }
    .tfm-popover__name { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tfm-popover__avatar { width: 24px; height: 24px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; background: color-mix(in srgb, var(--color-accent) 18%, transparent); color: var(--color-accent); flex-shrink: 0; }
    .tfm-popover__avatar--unassigned { background: var(--color-surface-secondary); color: var(--color-text-secondary); }
    .tfm-popover__badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-weight: 600; margin-left: auto; }
    .tfm-popover__badge--active { background: color-mix(in srgb, var(--color-success) 15%, transparent); color: var(--color-success); }
    .tfm-popover__check { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2.2; margin-left: auto; }

    /* Priority Dots */
    .tfm-dot { width: 9px; height: 9px; border-radius: 9999px; flex-shrink: 0; }
    .tfm-dot--low { background: #3b82f6; }
    .tfm-dot--med { background: #eab308; }
    .tfm-dot--high { background: #f97316; }
    .tfm-dot--crit { background: #ef4444; }

    /* Date Popover */
    .tfm-date-presets { display: flex; gap: 6px; margin-bottom: 10px; }
    .tfm-date-preset-btn { flex: 1; height: 28px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface-secondary); font-size: 12px; font-weight: 500; cursor: pointer; color: var(--color-text-primary); transition: all 120ms ease; }
    .tfm-date-preset-btn:hover { background: var(--color-surface); border-color: var(--color-accent); }
    .tfm-date-input-wrap { display: flex; width: 100%; }
    .tfm-date-input { width: 100%; height: 34px; border: 1px solid var(--color-border); border-radius: 6px; padding: 0 10px; font: inherit; font-size: 13px; background: var(--color-surface); color: var(--color-text-primary); }
    .tfm-date-clear-btn { width: 100%; margin-top: 8px; border: 0; background: transparent; color: var(--color-danger); font-size: 12px; font-weight: 600; cursor: pointer; text-align: center; }

    /* Level 3: More Fields */
    .tfm-level3 { display: flex; flex-direction: column; gap: 12px; margin-top: 10px; padding-top: 14px; }
    .tfm-more-divider { display: flex; align-items: center; gap: 12px; }
    .tfm-more-toggle { display: inline-flex; align-items: center; gap: 6px; background: transparent; border: 0; padding: 0; cursor: pointer; color: var(--color-text-secondary); }
    .tfm-more-toggle:hover .tfm-more-title, .tfm-more-toggle:hover .tfm-more-chevron { color: var(--color-text-primary); stroke: var(--color-text-primary); }
    .tfm-more-title { font-size: 11px; font-weight: 700; color: inherit; text-transform: uppercase; letter-spacing: .06em; }
    .tfm-more-chevron { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2.2; transition: transform 140ms ease; }
    .tfm-more-chevron--collapsed { transform: rotate(-90deg); }
    .tfm-more-line { flex: 1; height: 1px; background: var(--color-border); }
    .tfm-more-action { background: transparent; border: 0; padding: 2px 6px; font-size: 11px; font-weight: 600; color: var(--color-text-secondary); cursor: pointer; border-radius: 4px; transition: all 120ms ease; }
    .tfm-more-action:hover { color: var(--color-text-primary); background: var(--color-surface-secondary); }
    .tfm-inline-fields { display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: flex-end; animation: tfm-popover-in 140ms ease-out; }
    .tfm-inline-field { display: flex; flex-direction: column; gap: 4px; }
    .tfm-inline-label { font-size: 11px; font-weight: 600; color: var(--color-text-secondary); }
    .tfm-inline-box { display: inline-flex; align-items: center; gap: 4px; height: 34px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-surface); }
    .tfm-inline-input { width: 56px; border: 0; outline: none; background: transparent; font: inherit; font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .tfm-inline-unit { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }

    /* Success / Feedback Toast & Errors */
    .tfm-success-toast { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface)); border: 1px solid color-mix(in srgb, var(--color-success) 30%, transparent); color: var(--color-success); font-size: 13px; font-weight: 500; animation: tfm-popover-in 140ms ease-out; }
    .tfm-success-toast svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2.2; flex-shrink: 0; }
    .tfm-toast-dismiss { margin-left: auto; border: 0; background: transparent; color: currentColor; cursor: pointer; font-size: 16px; }
    .tfm-banner-error { margin: 0; padding: 10px 14px; border-radius: 8px; background: color-mix(in srgb, var(--color-danger-subtle) 60%, var(--color-surface)); border: 1px solid var(--color-danger-subtle); color: var(--color-danger-text); font-size: 13px; }

    /* Split Button */
    .tfm-split-action { position: relative; display: inline-flex; }
    .tfm-split-btn { display: inline-flex; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 2px rgb(15 23 42 / .06); }
    .tfm-split-btn__main { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; border: 0; background: var(--color-accent); color: var(--color-accent-contrast); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 140ms ease; }
    .tfm-split-btn__main:hover { filter: brightness(0.95); }
    .tfm-split-btn__main:disabled { opacity: .6; cursor: not-allowed; }
    .tfm-split-btn__arrow { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 36px; border: 0; border-left: 1px solid color-mix(in srgb, var(--color-accent-contrast) 25%, transparent); background: var(--color-accent); color: var(--color-accent-contrast); cursor: pointer; transition: opacity 140ms ease; }
    .tfm-split-btn__arrow:hover { filter: brightness(0.95); }
    .tfm-split-btn__arrow svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; }
    .tfm-split-dropdown { position: absolute; bottom: calc(100% + 8px); right: 0; z-index: 110; width: 250px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-surface); padding: 6px; box-shadow: 0 14px 34px rgb(15 23 42 / .2); animation: tfm-popover-in 120ms ease-out; }
    .tfm-split-dropdown__item { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 8px 10px; border: 0; border-radius: 7px; background: transparent; color: var(--color-text-primary); font: inherit; cursor: pointer; text-align: left; transition: background-color 120ms ease; }
    .tfm-split-dropdown__item:hover { background: var(--color-surface-secondary); }
    .tfm-split-dropdown__item svg { width: 16px; height: 16px; stroke: var(--color-accent); fill: none; stroke-width: 2; flex-shrink: 0; margin-top: 2px; }
    .tfm-split-dropdown__item strong { display: block; font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .tfm-split-dropdown__item span { display: block; font-size: 11px; color: var(--color-text-secondary); margin-top: 1px; }

    /* Loading & Spinner */
    .tfm-loading { display: flex; align-items: center; gap: 8px; color: var(--color-text-secondary); font-size: 13px; }
    .tfm-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 9999px; animation: tfm-spin 600ms linear infinite; flex-shrink: 0; }
    @keyframes tfm-spin { to { transform: rotate(360deg); } }
    @keyframes tfm-popover-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 900px) { .tfm__panes { grid-template-columns: 1fr; } .tfm__grid, .tfm__grid--2 { grid-template-columns: 1fr; } }
  `]
})
export class TaskFormModalComponent {
  private readonly taskApi = inject(TaskApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly sprintApi = inject(SprintApiService);
  private readonly projectStore = inject(ProjectDetailStore);
  private readonly boardStore = inject(TaskBoardStore);
  private readonly currentEmployee = inject(CurrentEmployeeStore);

  readonly open = input(false);
  readonly mode = input<TaskFormMode>('create');
  readonly projectId = input.required<string>();
  readonly taskId = input<string>('');
  readonly prefillModuleId = input<string>('');
  readonly prefillSprintId = input<string>('');

  readonly closed = output<void>();
  readonly created = output<string>();
  readonly saved = output<void>();

  internalMode = signal<TaskFormMode | null>(null);
  currentEffectiveMode = computed(() => this.internalMode() ?? this.mode());

  task = signal<WorkTask | null>(null);
  statuses = signal<TaskStatusColumn[]>([]);
  categories = signal<TaskCategoryColumn[]>([]);
  history = signal<TaskHistoryEntryDto[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);

  title = signal('');
  description = signal('');
  priority = signal<WorkTask['priority']>('medium');
  dueDate = signal('');
  estimatedHours = signal<number | null>(null);
  storyPoints = signal<number | null>(null);
  progressPercent = signal<number | null>(null);
  reason = signal('');
  statusId = signal('');

  modules = signal<readonly { objectiveId: string; title: string; isOwner: boolean }[]>([]);
  selectedObjectiveId = signal('');
  sprints = signal<readonly Sprint[]>([]);
  sprintId = signal('');
  assignableMembers = signal<readonly { employeeId: string; name: string }[]>([]);
  assigneeEmployeeId = signal('');
  private originalAssigneeId = signal('');
  categoryId = signal('');
  allocationHint = signal<InsufficientAllocationErrorDto | null>(null);

  submitting = signal(false);
  errors = signal<Record<string, string>>({});
  errorMessage = signal<string | null>(null);

  activePopover = signal<'assignee' | 'priority' | 'dueDate' | 'module' | 'sprint' | 'category' | 'splitMenu' | null>(null);
  showMoreFields = signal(true);
  assigneeSearchQuery = signal('');
  moduleSearchQuery = signal('');
  successToastMessage = signal<string | null>(null);
  attachedFiles = signal<AttachmentPill[]>([]);
  descTab = signal<'write' | 'preview'>('write');

  showLinkPopover = signal(false);
  linkUrlInput = signal('');
  linkTextInput = signal('');
  savedLinkRange: Range | null = null;

  showTextColorPopover = signal(false);
  showHighlightPopover = signal(false);
  private savedColorRange: Range | null = null;

  readonly swatchPalette = [
    { name: 'Red', hex: '#e03131' }, { name: 'Orange', hex: '#f08c00' },
    { name: 'Yellow', hex: '#f2c400' }, { name: 'Green', hex: '#2f9e44' },
    { name: 'Blue', hex: '#1971c2' }, { name: 'Purple', hex: '#9c36b5' },
    { name: 'Pink', hex: '#e64980' }, { name: 'Default', hex: '#1e293b' }
  ];

  readonly highlightPalette = [
    { name: 'Red', hex: '#ffc9c9' }, { name: 'Orange', hex: '#ffe0b2' },
    { name: 'Yellow', hex: '#fff3bf' }, { name: 'Green', hex: '#d3f9d8' },
    { name: 'Blue', hex: '#d0ebff' }, { name: 'Purple', hex: '#eebefa' },
    { name: 'Pink', hex: '#ffd6e8' }, { name: 'Grey', hex: '#e9ecef' }
  ];

  private loadedKey = '';
  private readonly dialogRef = viewChild<ElementRef<HTMLElement>>('tfm');
  readonly taskTitleInput = viewChild<ElementRef<HTMLInputElement>>('taskTitleInput');
  readonly descEditor = viewChild<ElementRef<HTMLDivElement>>('descEditor');
  readonly imageFileInput = viewChild<ElementRef<HTMLInputElement>>('imageFileInput');
  private previouslyFocused: HTMLElement | null = null;

  assigneeOptions = computed<WorkDropdownOption[]>(() => [
    { value: '', label: 'Unassigned' },
    ...this.assignableMembers().map((m) => ({ value: m.employeeId, label: m.name }))
  ]);
  selectedModuleIsOwner = computed(() =>
    this.modules().find((m) => m.objectiveId === this.selectedObjectiveId())?.isOwner ?? false
  );
  priorityOptions: readonly WorkDropdownOption[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' }
  ];
  readonly priorityOptionsList = [
    { value: 'low' as const, label: 'Low', dotClass: 'tfm-dot--low' },
    { value: 'medium' as const, label: 'Medium', dotClass: 'tfm-dot--med' },
    { value: 'high' as const, label: 'High', dotClass: 'tfm-dot--high' },
    { value: 'critical' as const, label: 'Critical', dotClass: 'tfm-dot--crit' }
  ];
  statusOptions = computed<WorkDropdownOption[]>(() => this.availableStatuses().map((status) => ({ value: status.id, label: status.name })));
  primaryLabel = computed(() => {
    if (this.currentEffectiveMode() === 'create') return this.selectedModuleIsOwner() ? 'Create task' : 'Create request';
    return this.isObjectiveOwner() ? 'Save changes' : 'Request changes';
  });

  currentEmployeeId = computed(() => this.currentEmployee.id());
  isObjectiveOwner = computed(() => {
    const t = this.task();
    if (!t) return false;
    return this.projectStore.milestones().find((m) => m.objectiveId === t.objectiveId)?.isOwner ?? false;
  });
  isAssignee = computed(() => {
    const t = this.task();
    return !!t && t.assigneeEmployeeIds.includes(this.currentEmployeeId());
  });
  assigneeName = computed(() => {
    const id = this.assigneeEmployeeId();
    return this.assignableMembers().find((m) => m.employeeId === id)?.name ?? (id ? id : 'Unassigned');
  });

  priorityDetails = computed(() => {
    const p = this.priority();
    switch (p) {
      case 'low': return { label: 'Low', dotClass: 'tfm-dot--low' };
      case 'medium': return { label: 'Medium', dotClass: 'tfm-dot--med' };
      case 'high': return { label: 'High', dotClass: 'tfm-dot--high' };
      case 'critical': return { label: 'Critical', dotClass: 'tfm-dot--crit' };
      default: return { label: 'Medium', dotClass: 'tfm-dot--med' };
    }
  });

  formattedDueDate = computed(() => {
    const d = this.dueDate();
    if (!d) return 'Due date';
    try {
      const [y, m, day] = d.split('-').map(Number);
      if (!y || !m || !day) return d;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[m - 1]} ${day}`;
    } catch {
      return d;
    }
  });

  selectedAssigneeName = computed(() => {
    const id = this.assigneeEmployeeId();
    if (!id) return 'Assignee';
    return this.assignableMembers().find((m) => m.employeeId === id)?.name ?? (id ? id : 'Assignee');
  });

  selectedModuleTitle = computed(() => {
    const id = this.selectedObjectiveId();
    if (!id) return 'Select module';
    return this.modules().find((m) => m.objectiveId === id)?.title ?? 'Select module';
  });

  selectedSprintTitle = computed(() => {
    const id = this.sprintId();
    if (!id) return 'No sprint';
    return this.sprints().find((s) => s.id === id)?.name ?? 'No sprint';
  });

  selectedCategoryTitle = computed(() => {
    const id = this.categoryId();
    if (!id) return 'Select category';
    return this.categories().find((c) => c.id === id)?.name ?? 'Select category';
  });

  filteredAssignees = computed(() => {
    const q = this.assigneeSearchQuery().toLowerCase().trim();
    const list = this.assignableMembers();
    if (!q) return list;
    return list.filter((m) => m.name.toLowerCase().includes(q));
  });

  filteredModules = computed(() => {
    const q = this.moduleSearchQuery().toLowerCase().trim();
    const list = this.modules();
    if (!q) return list;
    return list.filter((m) => m.title.toLowerCase().includes(q));
  });

  availableSprints = computed(() => {
    const objId = this.selectedObjectiveId();
    return objId ? this.sprints().filter((s) => s.objectiveId === objId) : this.sprints();
  });

  private readonly openSessionEntry = computed(() =>
    this.history().find((e) => e.type === 'clock_session' && e.clockSession?.clockOutAt === null) ?? null
  );
  hasOpenSessionMine = computed(() => this.openSessionEntry()?.employeeId === this.currentEmployeeId());
  hasOpenSessionOtherEmployee = computed(() => {
    const e = this.openSessionEntry();
    return e !== null && e.employeeId !== this.currentEmployeeId();
  });
  private readonly totalLoggedMinutesFromHistory = computed(() =>
    this.history()
      .filter((e) => e.type === 'clock_session' && e.clockSession?.durationMinutes != null)
      .reduce((sum, e) => sum + (e.clockSession!.durationMinutes ?? 0), 0)
  );
  widgetTask = computed<WorkTask | null>(() => {
    const t = this.task();
    if (!t) return null;
    const entry = this.openSessionEntry();
    return {
      ...t,
      openClockSessionEmployeeId: entry?.employeeId ?? null,
      openClockSessionClockInAt: entry?.clockSession ? new Date(entry.clockSession.clockInAt) : null,
      totalLoggedMinutes: Math.max(t.totalLoggedMinutes, this.totalLoggedMinutesFromHistory())
    };
  });

  categoryName = computed(() => {
    const t = this.task();
    if (!t) return '';
    return this.categories().find((c) => c.id === t.categoryId)?.name ?? t.categoryId;
  });
  availableStatuses = computed(() =>
    [...this.statuses()]
      .filter((s) => s.visibility === 'public' || this.isObjectiveOwner())
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  constructor() {
    void this.currentEmployee.ensureLoaded();
    effect(() => {
      const isOpen = this.open();
      const key = `${this.mode()}:${this.taskId()}:${isOpen}`;
      if (!isOpen) { this.loadedKey = ''; return; }
      if (key === this.loadedKey) return;
      this.loadedKey = key;
      untracked(() => {
        this.resetForm();
        if (this.mode() === 'create') void this.loadCreateContext();
        else void this.load();
      });
    });
    effect(() => {
      if (this.open()) {
        this.previouslyFocused = document.activeElement as HTMLElement;
        this.dialogRef()?.nativeElement.focus();
      } else if (this.previouslyFocused) {
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    });
    effect(() => {
      const desc = this.description();
      const el = this.descEditor()?.nativeElement;
      if (el && !el.innerHTML && desc) {
        el.innerHTML = desc;
      }
    });
  }

  private resetForm(): void {
    this.task.set(null);
    this.title.set('');
    this.description.set('');
    this.descTab.set('write');
    const editorEl = this.descEditor()?.nativeElement;
    if (editorEl) editorEl.innerHTML = '';
    this.priority.set('medium');
    this.dueDate.set('');
    this.estimatedHours.set(null);
    this.storyPoints.set(null);
    this.progressPercent.set(null);
    this.reason.set('');
    this.statusId.set('');
    this.selectedObjectiveId.set('');
    this.sprintId.set('');
    this.assigneeEmployeeId.set('');
    this.originalAssigneeId.set('');
    this.categoryId.set('');
    this.allocationHint.set(null);
    this.errors.set({});
    this.errorMessage.set(null);
    this.internalMode.set(null);
    this.activePopover.set(null);
    this.successToastMessage.set(null);
    this.attachedFiles.set([]);
    this.assigneeSearchQuery.set('');
    this.moduleSearchQuery.set('');
    this.showMoreFields.set(true);
    this.showLinkPopover.set(false);
    this.linkUrlInput.set('');
    this.linkTextInput.set('');
    this.savedLinkRange = null;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [taskDto, statusDtos, categoryDtos, historyEntries] = await Promise.all([
        firstValueFrom(this.taskApi.getTaskById(this.taskId())),
        firstValueFrom(this.taskApi.getStatuses(this.projectId())),
        firstValueFrom(this.taskApi.getCategories(this.projectId())),
        firstValueFrom(this.taskApi.getTaskHistory(this.taskId()))
      ]);
      const t = toWorkTask(taskDto);
      this.task.set(t);
      this.statuses.set(statusDtos);
      this.categories.set(categoryDtos.map(toTaskCategoryColumn));
      this.history.set(historyEntries);
      this.seedForm(t);
      await this.loadMembers();
    } catch {
      this.loadError.set('Failed to load this task.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadForTaskId(taskId: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [taskDto, statusDtos, categoryDtos, historyEntries] = await Promise.all([
        firstValueFrom(this.taskApi.getTaskById(taskId)),
        firstValueFrom(this.taskApi.getStatuses(this.projectId())),
        firstValueFrom(this.taskApi.getCategories(this.projectId())),
        firstValueFrom(this.taskApi.getTaskHistory(taskId))
      ]);
      const t = toWorkTask(taskDto);
      this.task.set(t);
      this.statuses.set(statusDtos);
      this.categories.set(categoryDtos.map(toTaskCategoryColumn));
      this.history.set(historyEntries);
      this.seedForm(t);
      await this.loadMembers();
    } catch {
      this.loadError.set('Failed to load this task.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadCreateContext(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [milestones, sprintDtos, categoryDtos] = await Promise.all([
        firstValueFrom(this.projectApi.getMyMilestones(this.projectId())),
        firstValueFrom(this.sprintApi.getByProject(this.projectId())),
        firstValueFrom(this.taskApi.getCategories(this.projectId()))
      ]);
      this.modules.set(milestones.map((m) => ({ objectiveId: m.objectiveId, title: m.title, isOwner: m.isOwner })));
      this.sprints.set(sprintDtos.map(toSprint));
      this.categories.set(categoryDtos.map(toTaskCategoryColumn));
      this.categoryId.set(this.categories()[0]?.id ?? '');

      // Smart Module Inheritance:
      if (this.prefillModuleId() && this.modules().some((m) => m.objectiveId === this.prefillModuleId())) {
        this.selectedObjectiveId.set(this.prefillModuleId());
      } else if (this.modules().length === 1) {
        this.selectedObjectiveId.set(this.modules()[0].objectiveId);
      }

      // Smart Sprint Inheritance:
      if (this.prefillSprintId()) {
        this.sprintId.set(this.prefillSprintId());
      } else {
        const objId = this.selectedObjectiveId();
        const activeSprints = this.sprints().filter((s) => s.status === 'active' && (!objId || s.objectiveId === objId));
        if (activeSprints.length === 1) {
          this.sprintId.set(activeSprints[0].id);
        }
      }

      await this.loadMembers();
    } catch {
      this.loadError.set('Failed to load the task form.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadMembers(): Promise<void> {
    await this.projectStore.loadProjectMembers(this.projectId());
    this.assignableMembers.set(
      this.projectStore.projectMembers().map((m) => ({ employeeId: m.employeeId, name: m.name ?? 'Unknown employee' }))
    );
  }

  private seedForm(t: WorkTask): void {
    this.title.set(t.title);
    this.description.set(t.description ?? '');
    const editorEl = this.descEditor()?.nativeElement;
    if (editorEl) editorEl.innerHTML = t.description ?? '';
    this.priority.set(t.priority);
    this.dueDate.set(t.dueDate ? t.dueDate.toISOString().slice(0, 10) : '');
    this.estimatedHours.set(t.estimatedHours);
    this.storyPoints.set(t.storyPoints);
    this.progressPercent.set(t.progressPercent);
    this.reason.set('');
    this.statusId.set(t.statusId);
    const currentAssignee = t.assigneeEmployeeIds[0] ?? '';
    this.assigneeEmployeeId.set(currentAssignee);
    this.originalAssigneeId.set(currentAssignee);
    this.attachedFiles.set(t.attachments.map((a) => ({ fileId: a.fileId, name: a.name, sizeBytes: a.sizeBytes })));
    this.errors.set({});
    this.errorMessage.set(null);
  }

  async reloadHistory(): Promise<void> {
    try {
      this.history.set(await firstValueFrom(this.taskApi.getTaskHistory(this.taskId())));
    } catch {
      /* keep the current feed */
    }
  }

  async onTaskPushed(updated: WorkTask): Promise<void> {
    this.task.set(updated);
    await this.reloadHistory();
  }

  estimatedHoursDisplay(): string { return this.estimatedHours() == null ? '' : String(this.estimatedHours()); }
  storyPointsDisplay(): string { return this.storyPoints() == null ? '' : String(this.storyPoints()); }
  progressPercentDisplay(): string { return this.progressPercent() == null ? '' : String(this.progressPercent()); }
  onEstimatedHoursChange(v: string): void { this.estimatedHours.set(v === '' ? null : Number(v)); }
  onStoryPointsChange(v: string): void { this.storyPoints.set(v === '' ? null : Number(v)); }
  onProgressPercentChange(v: string): void { this.progressPercent.set(v === '' ? null : Number(v)); }
  setPriority(value: string): void { this.priority.set(value as WorkTask['priority']); }

  onBackdrop(): void {
    if (this.activePopover()) {
      this.activePopover.set(null);
    } else {
      this.cleanupUnsavedAttachments();
      this.closed.emit();
    }
  }

  onEscape(): void {
    if (this.activePopover()) {
      this.activePopover.set(null);
    } else {
      this.cleanupUnsavedAttachments();
      this.closed.emit();
    }
  }

  togglePopover(name: 'assignee' | 'priority' | 'dueDate' | 'module' | 'sprint' | 'category' | 'splitMenu', event: MouseEvent): void {
    event.stopPropagation();
    this.activePopover.update((curr) => (curr === name ? null : name));
  }

  closePopover(): void {
    this.activePopover.set(null);
    this.showLinkPopover.set(false);
    this.showTextColorPopover.set(false);
    this.showHighlightPopover.set(false);
  }

  clearError(field: string): void {
    this.errors.update((curr) => {
      if (!curr[field]) return curr;
      const next = { ...curr };
      delete next[field];
      return next;
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  setQuickDueDate(daysFromNow: number): void {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.dueDate.set(`${year}-${month}-${day}`);
    this.activePopover.set(null);
  }

  setDescTab(tab: 'write' | 'preview'): void {
    this.descTab.set(tab);
    if (tab === 'write') {
      setTimeout(() => {
        const el = this.descEditor()?.nativeElement;
        if (el) {
          if (!el.innerHTML && this.description()) {
            el.innerHTML = this.description();
          }
          el.focus();
        }
      });
    }
  }

  formatDoc(command: string, value: string | undefined = undefined): void {
    if (this.descTab() !== 'write') this.descTab.set('write');
    const el = this.descEditor()?.nativeElement;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, value);
    this.onEditorInput();
  }

  formatCode(): void {
    if (this.descTab() !== 'write') this.descTab.set('write');
    const el = this.descEditor()?.nativeElement;
    if (!el) return;
    el.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && el.contains(selection.anchorNode) && !selection.isCollapsed) {
      const code = document.createElement('code');
      code.className = 'tfm-inline-code';
      code.textContent = selection.toString();
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(code);

      const space = document.createTextNode('\u00A0');
      code.after(space);
      const nextRange = document.createRange();
      nextRange.setStartAfter(space);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    } else {
      const code = document.createElement('code');
      code.className = 'tfm-inline-code';
      code.textContent = 'code';

      let range: Range;
      if (selection && selection.rangeCount > 0 && el.contains(selection.anchorNode)) {
        range = selection.getRangeAt(0);
      } else {
        range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
      }
      range.deleteContents();
      range.insertNode(code);

      const selectRange = document.createRange();
      selectRange.selectNodeContents(code);
      selection?.removeAllRanges();
      selection?.addRange(selectRange);
    }
    this.onEditorInput();
  }

  formatList(type: 'unordered' | 'ordered'): void {
    if (this.descTab() !== 'write') this.descTab.set('write');
    const el = this.descEditor()?.nativeElement;
    if (!el) return;
    el.focus();

    const sel = window.getSelection();
    let range: Range;
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    const command = type === 'unordered' ? 'insertUnorderedList' : 'insertOrderedList';
    const executed = document.execCommand(command, false);

    const listTag = type === 'unordered' ? 'ul' : 'ol';
    if (!executed || !el.querySelector(listTag)) {
      const list = document.createElement(listTag);
      const li = document.createElement('li');
      li.textContent = 'List item';
      list.appendChild(li);

      range.deleteContents();
      range.insertNode(list);

      const itemRange = document.createRange();
      itemRange.selectNodeContents(li);
      sel?.removeAllRanges();
      sel?.addRange(itemRange);
    }
    this.onEditorInput();
  }

  formatChecklist(): void {
    if (this.descTab() !== 'write') this.descTab.set('write');
    const el = this.descEditor()?.nativeElement;
    if (!el) return;
    el.focus();

    const sel = window.getSelection();
    let range: Range;
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    const selectedText = range.toString().trim() || 'Task item';
    range.deleteContents();

    const item = document.createElement('div');
    item.className = 'tfm-editor-check-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('contenteditable', 'false');

    const label = document.createElement('span');
    label.className = 'tfm-check-text';
    label.textContent = selectedText;

    item.appendChild(checkbox);
    item.appendChild(document.createTextNode(' '));
    item.appendChild(label);

    range.insertNode(item);

    const textRange = document.createRange();
    textRange.selectNodeContents(label);
    sel?.removeAllRanges();
    sel?.addRange(textRange);

    this.onEditorInput();
  }

  toggleLinkPopover(event: MouseEvent): void {
    event.stopPropagation();
    if (this.showLinkPopover()) {
      this.showLinkPopover.set(false);
      return;
    }
    this.closePopover();
    const el = this.descEditor()?.nativeElement;
    const sel = window.getSelection();
    if (el && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      this.savedLinkRange = sel.getRangeAt(0).cloneRange();
      const text = this.savedLinkRange.toString().trim();
      this.linkTextInput.set(text);
    } else {
      this.savedLinkRange = null;
      this.linkTextInput.set('');
    }
    this.linkUrlInput.set('');
    this.showLinkPopover.set(true);
  }

  applyLink(): void {
    const url = this.linkUrlInput().trim();
    if (!url) return;
    const href = /^(?:f|ht)tps?:\/\//i.test(url) || url.startsWith('mailto:') ? url : `https://${url}`;
    const displayText = this.linkTextInput().trim() || url;

    const el = this.descEditor()?.nativeElement;
    if (!el) return;
    el.focus();

    const sel = window.getSelection();
    const a = document.createElement('a');
    a.href = href;
    a.textContent = displayText;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'tfm-preview-link';

    if (this.savedLinkRange && el.contains(this.savedLinkRange.commonAncestorContainer)) {
      this.savedLinkRange.deleteContents();
      this.savedLinkRange.insertNode(a);
    } else {
      el.appendChild(a);
    }

    const space = document.createTextNode('\u00A0');
    a.after(space);

    const newRange = document.createRange();
    newRange.setStartAfter(space);
    newRange.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(newRange);

    this.showLinkPopover.set(false);
    this.onEditorInput();
  }

  toggleTextColorPopover(event: MouseEvent): void {
    event.stopPropagation();
    if (this.showTextColorPopover()) {
      this.showTextColorPopover.set(false);
      return;
    }
    this.closePopover();
    this.saveColorSelectionRange();
    this.showTextColorPopover.set(true);
  }

  toggleHighlightPopover(event: MouseEvent): void {
    event.stopPropagation();
    if (this.showHighlightPopover()) {
      this.showHighlightPopover.set(false);
      return;
    }
    this.closePopover();
    this.saveColorSelectionRange();
    this.showHighlightPopover.set(true);
  }

  private saveColorSelectionRange(): void {
    const el = this.descEditor()?.nativeElement;
    const sel = window.getSelection();
    this.savedColorRange = el && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)
      ? sel.getRangeAt(0).cloneRange()
      : null;
  }

  private restoreColorSelectionRange(): void {
    const el = this.descEditor()?.nativeElement;
    if (!el) return;
    el.focus();
    if (this.savedColorRange && el.contains(this.savedColorRange.commonAncestorContainer)) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(this.savedColorRange);
    }
  }

  applyTextColor(hex: string | null): void {
    this.restoreColorSelectionRange();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, hex ?? 'inherit');
    this.showTextColorPopover.set(false);
    this.onEditorInput();
  }

  applyHighlight(hex: string | null): void {
    this.restoreColorSelectionRange();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('hiliteColor', false, hex ?? 'transparent');
    this.showHighlightPopover.set(false);
    this.onEditorInput();
  }

  async onImageFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const selection = window.getSelection();
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;

    try {
      const uploaded = await firstValueFrom(this.taskApi.uploadPendingFile(file, 'task_description_image'));

      if (selection && savedRange) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
      document.execCommand('insertImage', false, this.taskApi.getFileUrl(uploaded.fileId));
      this.onEditorInput();
    } catch {
      this.errorMessage.set(`Failed to insert ${file.name}.`);
    } finally {
      input.value = '';
    }
  }

  onEditorInput(): void {
    const el = this.descEditor()?.nativeElement;
    if (!el) return;
    const raw = el.innerHTML.trim();
    if (!raw || raw === '<br>' || raw === '<div><br></div>') {
      this.description.set('');
    } else {
      this.description.set(raw);
    }
  }

  readonly renderedDescriptionPreview = computed(() => {
    const raw = this.description().trim();
    if (!raw) {
      return '<span class="tfm-preview-empty">Nothing to preview. Type or format your description in Write mode.</span>';
    }
    return this.renderMarkdownOrHtml(raw);
  });

  renderMarkdownOrHtml(raw: string): string {
    if (!raw) return '';
    let html = raw;

    // Code blocks: ```code```
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="tfm-preview-code"><code>$1</code></pre>');
    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code class="tfm-preview-inline-code">$1</code>');
    // Bold + Italic: ***text***
    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold: **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* (avoid matching alone asterisks)
    html = html.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
    // Checklists: - [ ] item, - [] item, - [x] item
    html = html.replace(/(?:^|\n)-\s*\[\s*\]\s*(.*)/gi, '<div class="tfm-preview-check"><input type="checkbox" disabled /> <span>$1</span></div>');
    html = html.replace(/(?:^|\n)-\s*\[x\]\s*(.*)/gi, '<div class="tfm-preview-check"><input type="checkbox" checked disabled /> <span>$1</span></div>');
    // Markdown links: [title](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="tfm-preview-link">$1</a>');
    // Bullet lists: - item
    html = html.replace(/(?:^|\n)-\s+(.*)/g, '<div class="tfm-preview-bullet">• $1</div>');
    // Numbered lists: 1. item
    html = html.replace(/(?:^|\n)(\d+)\.\s+(.*)/g, '<div class="tfm-preview-num">$1. $2</div>');
    // Newlines to <br> if not preceded/followed by HTML block tags
    html = html.replace(/([^>])\n/g, '$1<br>');

    return html;
  }

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    await this.uploadAttachmentFiles(input.files);
  }

  async onAttachmentFilesSelected(files: FileList): Promise<void> {
    await this.uploadAttachmentFiles(files);
  }

  private async uploadAttachmentFiles(files: FileList): Promise<void> {
    for (const file of Array.from(files)) {
      try {
        const uploaded = await firstValueFrom(this.taskApi.uploadPendingFile(file, 'task_attachment'));
        this.attachedFiles.update((curr) => [
          ...curr,
          { fileId: uploaded.fileId, name: uploaded.originalFileName, sizeBytes: uploaded.fileSizeBytes }
        ]);
      } catch {
        this.errorMessage.set(`Failed to upload ${file.name}.`);
      }
    }
  }

  async removeAttachedFile(fileId: string): Promise<void> {
    this.attachedFiles.update((curr) => curr.filter((f) => f.fileId !== fileId));
    try {
      await firstValueFrom(this.taskApi.deletePendingFile(fileId));
    } catch {
      // Best-effort: the pill is already gone from the UI either way. In edit mode a file that's
      // already linked to the task returns 409 here (Task 6's semantics) - that's expected; the
      // real unlink+quota-release happens on Save via TaskAssetLinker resyncing to the reduced
      // attachmentFileIds list.
    }
  }

  private cleanupUnsavedAttachments(): void {
    if (this.currentEffectiveMode() !== 'create') return;
    for (const file of this.attachedFiles()) {
      firstValueFrom(this.taskApi.deletePendingFile(file.fileId)).catch(() => {});
    }
  }

  onCancel(): void {
    this.cleanupUnsavedAttachments();
    this.closed.emit();
  }

  async submit(): Promise<void> {
    if (this.currentEffectiveMode() === 'create') {
      await this.submitCreateWithAction('create_and_close');
      return;
    }

    const fieldErrors: Record<string, string> = {};
    if (!this.title().trim()) fieldErrors['title'] = 'Title is required.';
    this.errors.set(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    const newStatusId = this.statusId();
    const fields = {
      title: this.title().trim(),
      description: this.description() || undefined,
      priority: this.priority(),
      dueDate: this.dueDate() || undefined,
      estimatedHours: this.estimatedHours() ?? undefined,
      storyPoints: this.storyPoints() ?? undefined,
      progressPercent: this.progressPercent() ?? undefined,
      reason: this.reason().trim() || undefined
    };

    try {
      if (newStatusId && newStatusId !== this.task()?.statusId) {
        await firstValueFrom(this.taskApi.moveTaskStatus(this.taskId(), newStatusId));
      }
      if (this.isObjectiveOwner()) {
        await firstValueFrom(this.taskApi.editTask(this.taskId(), {
          ...fields,
          attachmentFileIds: this.attachedFiles().map((f) => f.fileId)
        }));
        await this.applyReassignment();
      } else {
        await firstValueFrom(this.taskApi.createTaskEditRequest(this.taskId(), fields));
      }
      this.saved.emit();
      this.closed.emit();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.errorMessage.set(detail || 'Failed to save.');
    } finally {
      this.submitting.set(false);
    }
  }

  private async applyReassignment(): Promise<void> {
    const next = this.assigneeEmployeeId();
    const previous = this.originalAssigneeId();
    if (next === previous) return;
    if (previous) await firstValueFrom(this.taskApi.unassignTask(this.taskId(), previous));
    if (next) await firstValueFrom(this.taskApi.assignTask(this.taskId(), next));
  }

  async submitCreateWithAction(action: 'create_and_close' | 'create_and_add_another' | 'create_and_open' = 'create_and_close'): Promise<void> {
    const errs: Record<string, string> = {};
    if (!this.title().trim()) errs['title'] = 'Title is required.';
    if (!this.selectedObjectiveId()) errs['objectiveId'] = 'Module is required.';
    if (!this.categoryId()) errs['categoryId'] = 'Category is required.';
    this.errors.set(errs);
    if (Object.keys(errs).length > 0) return;

    const request: CreateTaskRequestDto = {
      title: this.title().trim(),
      description: this.description() || undefined,
      categoryId: this.categoryId(),
      priority: this.priority(),
      dueDate: this.dueDate() || undefined,
      estimatedHours: this.estimatedHours() ?? undefined,
      storyPoints: this.storyPoints() ?? undefined,
      sprintId: this.sprintId() || null,
      attachmentFileIds: this.attachedFiles().map((f) => f.fileId)
    };

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.allocationHint.set(null);
    this.successToastMessage.set(null);
    this.activePopover.set(null);

    try {
      const objectiveId = this.selectedObjectiveId();
      if (!this.selectedModuleIsOwner()) {
        try {
          await firstValueFrom(this.taskApi.createTaskCreationRequest(objectiveId, request));
          this.created.emit('');
          if (action === 'create_and_add_another') {
            this.title.set('');
            this.description.set('');
            const ed = this.descEditor()?.nativeElement;
            if (ed) ed.innerHTML = '';
            this.attachedFiles.set([]);
            this.successToastMessage.set('Creation request submitted! You can enter another task below.');
            setTimeout(() => this.taskTitleInput()?.nativeElement?.focus());
          } else {
            this.closed.emit();
          }
        } catch (err: unknown) {
          const detail = (err as { error?: { detail?: string } })?.error?.detail;
          this.errorMessage.set(detail || 'Failed to send the request.');
        }
        return;
      }

      const result = await this.boardStore.createTask(objectiveId, request);
      if (result && 'availableSlackHours' in result) {
        this.allocationHint.set(result);
        return;
      }
      if (result) {
        if (this.assigneeEmployeeId()) {
          await firstValueFrom(this.taskApi.assignTask(result.id, this.assigneeEmployeeId()));
        }
        this.created.emit(result.id);
        if (action === 'create_and_add_another') {
          this.title.set('');
          this.description.set('');
          const ed = this.descEditor()?.nativeElement;
          if (ed) ed.innerHTML = '';
          this.attachedFiles.set([]);
          this.successToastMessage.set('Task created! You can enter another task below.');
          setTimeout(() => this.taskTitleInput()?.nativeElement?.focus());
        } else if (action === 'create_and_open') {
          this.internalMode.set('edit');
          await this.loadForTaskId(result.id);
        } else {
          this.closed.emit();
        }
        return;
      }
      this.errorMessage.set(this.boardStore.error() ?? 'Failed to create the task.');
    } finally {
      this.submitting.set(false);
    }
  }
}
