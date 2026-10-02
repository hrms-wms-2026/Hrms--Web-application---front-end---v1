import { Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
import { TaskAssigneeIdentity, TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { Sprint } from '../../models/sprint.model';
import { CreateSubtaskRequestDto, CreateTaskRequestDto, InsufficientAllocationErrorDto } from '../../models/dto/task.dto';
import { isPendingApproval } from '../../models/dto/work-approval.dto';
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
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { FileApiService } from '../../../../shared/data-access/file-api.service';
import { TaskHistoryEntryDto } from '../../models/dto/task-history.dto';
import { TaskCommentsComponent } from '../task-comments/task-comments.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { TaskDuplicateDialogComponent, TaskDuplicatePayload } from '../task-duplicate-dialog/task-duplicate-dialog.component';
import { TaskConvertToSubtaskDialogComponent, TaskConvertToSubtaskCandidate, TaskConvertToSubtaskPayload } from '../task-convert-to-subtask-dialog/task-convert-to-subtask-dialog.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { buildTaskDeepLink, copyTextToClipboard } from '../../utils/task-deep-link.util';
import { TaskAssigneeDropdownComponent } from '../task-assignee-dropdown/task-assignee-dropdown.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProjectMonitorApiService } from '../../data-access/project-monitor-api.service';
import { MonitorWarningDto } from '../../models/dto/monitor.dto';
import { MonitorWarningCalloutComponent } from '../monitor-warning-callout/monitor-warning-callout.component';
import { MONITOR_CHECK_DEBOUNCE_MS } from '../sub-module-form/sub-module-form.component';
import { DirtyFormHandle, UnsavedChangesService } from '../../../../shared/services/unsaved-changes.service';
import { DraftsStore } from '../../../../shared/state/drafts.store';
import { TaskDraftApiService } from '../../data-access/task-draft-api.service';
import { TaskDraft, TaskDraftPayload } from '../../models/task-draft.model';

export type TaskFormMode = 'create' | 'edit';

@Component({
  selector: 'app-task-form-modal',
  standalone: true,
  imports: [NgTemplateOutlet, ButtonComponent, DatePickerComponent, TaskHistoryFeedComponent, TaskClockWidgetComponent, TaskAttachmentListComponent, RichTextEditorComponent, AvatarComponent, TaskCommentsComponent, ConfirmModalComponent, TaskDuplicateDialogComponent, TaskConvertToSubtaskDialogComponent, TaskAssigneeDropdownComponent, MonitorWarningCalloutComponent],
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
          [attr.aria-label]="currentEffectiveMode() === 'create' ? 'Create work item' : task()?.title"
          (click)="$event.stopPropagation()"
          (keydown.escape)="onEscape()"
        >

          <header class="tfm__head" [class.tfm__head--doc]="currentEffectiveMode() === 'edit'">
            @if (currentEffectiveMode() === 'create') {
              <div class="tfm__title">
                <h2>Create work item</h2>
              </div>
            } @else if (task(); as t) {
              <div class="tfm-breadcrumbs">
                <span class="tfm-breadcrumb-proj">{{ projectTitle() || 'Project' }}</span>
                <span class="tfm-breadcrumb-sep">/</span>
                <div class="tfm-chip-anchor">
                  <button
                    type="button"
                    class="tfm-header-module-btn"
                    data-testid="header-module-button"
                    (click)="togglePopover('headerModule', $event)"
                    [title]="'Module: ' + selectedModuleTitle()"
                  >
                    <svg class="tfm-subtask-module-cube-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                      <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                    <span data-testid="header-module-name">{{ selectedModuleTitle() }}</span>
                  </button>
                  @if (activePopover() === 'headerModule') {
                    <div class="tfm-popover" role="dialog" aria-label="Select module" (click)="$event.stopPropagation()">
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
                            <span class="tfm-popover__name">{{ m.title }}</span>
                            @if (selectedObjectiveId() === m.objectiveId) {
                              <svg class="tfm-popover__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                            }
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
                <span class="tfm-breadcrumb-sep">/</span>
                @if (t.parentTaskId) {
                  @if (parentTask(); as p) {
                    <button
                      type="button"
                      class="tfm-breadcrumb-link"
                      (click)="openSubtask(p.id)"
                      [title]="'Back to parent: ' + (p.title || p.id)"
                      data-testid="breadcrumb-parent-task"
                    >
                      {{ p.shortId || p.title || p.id }}
                    </button>
                  } @else {
                    <button
                      type="button"
                      class="tfm-breadcrumb-link"
                      (click)="openSubtask(t.parentTaskId)"
                      data-testid="breadcrumb-parent-task"
                    >
                      Task
                    </button>
                  }
                  <span class="tfm-breadcrumb-sep">/</span>
                }
                <span class="tfm-breadcrumb-id">{{ t.shortId || t.id }}</span>
                @if (t.parentTaskId) {
                  <div class="tfm-type-pill tfm-type-pill--subtask">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <circle cx="3.5" cy="4.5" r="1.75"/>
                      <circle cx="11.5" cy="11.5" r="1.75"/>
                      <path d="M3.5 6.25v2.25a2.5 2.5 0 0 0 2.5 2.5h3.75"/>
                    </svg>
                    <span>Subtask</span>
                  </div>
                } @else {
                  <div class="tfm-chip-anchor">
                    <button
                      type="button"
                      class="tfm-type-pill tfm-type-pill--interactive"
                      data-testid="header-work-item-type-button"
                      (click)="togglePopover('headerCategory', $event)"
                      [title]="'Work item type: ' + (categoryName() || 'Task')"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></svg>
                      <span>{{ categoryName() || 'Task' }}</span>
                    </button>
                    @if (activePopover() === 'headerCategory') {
                      <div class="tfm-popover" role="dialog" aria-label="Select work item type" (click)="$event.stopPropagation()">
                        <div class="tfm-popover__list">
                          @for (c of categories(); track c.id) {
                            <button
                              type="button"
                              class="tfm-popover__item"
                              [class.tfm-popover__item--selected]="categoryId() === c.id"
                              (click)="selectCategory(c.id)"
                            >
                              <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></svg>
                              <span class="tfm-popover__name">{{ c.name }}</span>
                              @if (categoryId() === c.id) {
                                <svg class="tfm-popover__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                              }
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            } @else {
              <div class="tfm__title"><h2>Work item</h2></div>
            }
            @if (currentEffectiveMode() === 'edit' && task(); as headerTask) {
              <div class="tfm-header-actions">
                <span class="tfm-created-at" data-testid="task-created-at">{{ createdAtLabel() }}</span>
                <button type="button" class="tfm-header-share-btn" aria-label="Share task" (click)="shareTask()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  <span>Share</span>
                </button>
                <div class="tfm-chip-anchor">
                  <button
                    type="button"
                    class="tfm-header-module-btn"
                    aria-label="More actions"
                    data-testid="task-more-actions-button"
                    (click)="togglePopover('headerMore', $event)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" />
                    </svg>
                  </button>
                  @if (activePopover() === 'headerMore') {
                    <div class="tfm-popover tfm-popover--right" role="menu" aria-label="Task actions" (click)="$event.stopPropagation()">
                      <div class="tfm-popover__list">
                        <button type="button" class="tfm-popover__item" data-testid="task-duplicate-action" (click)="openDuplicateDialog()">
                          <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>
                          <span class="tfm-popover__name">Duplicate</span>
                        </button>
                        @if (!headerTask.parentTaskId) {
                          <button type="button" class="tfm-popover__item" data-testid="task-convert-to-subtask-action" (click)="openConvertToSubtaskDialog()">
                            <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>
                            <span class="tfm-popover__name">Convert to subtask</span>
                          </button>
                        }
                        <button type="button" class="tfm-popover__item tfm-popover__item--danger" data-testid="task-delete-action" (click)="openDeleteConfirm()">
                          <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                          <span class="tfm-popover__name">Delete</span>
                        </button>
                      </div>
                    </div>
                  }
                </div>
                <button type="button" class="tfm__x" aria-label="Close" (click)="onCancel()">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
            }
            @if (currentEffectiveMode() !== 'edit') {
              <button type="button" class="tfm__x" aria-label="Close" (click)="onCancel()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            }
          </header>

          <div class="tfm__body" (click)="closePopover()">
            <ng-template #descriptionEditorTpl>
              <app-rich-text-editor
                #descRte
                [initialHtml]="description()"
                [cssStyles]="false"
                (htmlChange)="description.set($event)"
                (filesAttached)="onAttachmentFilesSelected($event)"
                (uploadFailed)="errorMessage.set($event)"
              />
            </ng-template>
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
                    placeholder="Work item title"
                    [value]="title()"
                    (input)="title.set($any($event.target).value)"
                    aria-label="Work item title"
                  />
                  @if (errors()['title']) {
                    <span class="tfm__error tfm-title-error" role="alert">{{ errors()['title'] }}</span>
                  }
                </div>

                <ng-container [ngTemplateOutlet]="descriptionEditorTpl" />
              </div>

              <!-- Subtasks Section (Create Mode) -->
              @if (displayedSubtasks().length > 0) {
                <ng-container [ngTemplateOutlet]="subtasksSectionTpl" [ngTemplateOutletContext]="{ isCreateMode: true, parentTaskId: '' }" />
              } @else if (addingSubtask()) {
                <div class="tfm-subtasks-section">
                  <div class="tfm-subtask-header">
                    <div class="tfm-subtask-header-left">
                      <button type="button" class="tfm-subtask-collapse-btn" (click)="cancelAddSubtask()">
                        <svg class="tfm-subtask-chevron-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M7 10l5 5 5-5z" />
                        </svg>
                        <span class="tfm-subtask-header-title">Add subtask</span>
                      </button>
                    </div>
                  </div>
                  <ng-container [ngTemplateOutlet]="subtaskCreateRowTpl" [ngTemplateOutletContext]="{ parentTaskId: '' }" />
                </div>
              } @else {
                <div class="tfm-actions-list" style="margin-top: 4px;">
                  <button
                    type="button"
                    class="tfm-action-row"
                    data-testid="add-subtask-button"
                    (click)="startAddSubtask()"
                  >
                    <span class="tfm-action-icon">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="3.5" cy="4.5" r="1.75"/>
                        <circle cx="11.5" cy="11.5" r="1.75"/>
                        <path d="M3.5 6.25v2.25a2.5 2.5 0 0 0 2.5 2.5h3.75"/>
                      </svg>
                    </span>
                    <span>Add subtask</span>
                  </button>
                </div>
              }

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
                      <div class="tfm-popover-container" (click)="$event.stopPropagation()">
                        <app-task-assignee-dropdown
                          [members]="assignableMembers()"
                          [selectedId]="assigneeEmployeeId()"
                          (selected)="assigneeEmployeeId.set($event ?? ''); activePopover.set(null)"
                          (closed)="activePopover.set(null)"
                        />
                      </div>
                    }
                  </div>

                  <!-- Priority Chip -->
                  <div class="tfm-chip-anchor">
                    <button
                      type="button"
                      class="tfm-chip"
                      [class.tfm-chip--error]="errors()['priority']"
                      [class.tfm-chip--active]="priority()"
                      [attr.aria-expanded]="activePopover() === 'priority'"
                      (click)="togglePopover('priority', $event)"
                      [title]="errors()['priority'] || priorityDetails().label"
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
                              (click)="setPriority(opt.value); clearError('priority'); activePopover.set(null)"
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
                  <app-date-picker
                    variant="chip"
                    chipClass="tfm-chip"
                    btnTestId="tfm-due-date-chip"
                    emptyLabel="Due date"
                    [value]="dueDate()"
                    (valueChange)="dueDate.set($event)"
                  />

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
                            (click)="selectSprint('')"
                          >
                            <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                            <span class="tfm-popover__name">No sprint</span>
                          </button>
                          @for (s of availableSprints(); track s.id) {
                            <button
                              type="button"
                              class="tfm-popover__item"
                              [class.tfm-popover__item--selected]="sprintId() === s.id"
                              (click)="selectSprint(s.id)"
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
                        (downloadRequested)="downloadAttachment($event)"
                      />
                    </div>
                  </div>
                }
              </div>

              <app-monitor-warning-callout [warnings]="loadWarnings()" />

              @if (allocationHint()) {
                <p class="tfm__error tfm-banner-error" role="alert" data-testid="allocation-hint">
                  Not enough allocation ({{ allocationHint()!.availableSlackHours }}h available). Edit the module's allocated hours, then try again.
                </p>
              } @else if (errorMessage()) {
                <p class="tfm__error tfm-banner-error" role="alert">{{ errorMessage() }}</p>
              }
            } @else if (task(); as t) {
              <div class="tfm-doc-layout">
                <!-- Big Editable Document Title -->
                <div class="tfm-doc-title-block">
                  <input
                    #taskTitleInput
                    type="text"
                    class="tfm-doc-title-input"
                    [class.tfm-doc-title-input--error]="errors()['title']"
                    [value]="title()"
                    (input)="title.set($any($event.target).value)"
                    placeholder="Work item title"
                    aria-label="Work item title"
                  />
                  @if (errors()['title']) {
                    <span class="tfm__error tfm-title-error" role="alert">{{ errors()['title'] }}</span>
                  }
                </div>

                <!-- ClickUp 2-Column Property Grid -->
                <div class="tfm-prop-grid">
                  <!-- LEFT COLUMN -->
                  <div class="tfm-prop-col">
                    <!-- 1. Status -->
                    <div class="tfm-prop-row">
                      <span class="tfm-prop-label">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
                        <span>Status</span>
                      </span>
                      <div class="tfm-prop-value tfm-chip-anchor">
                        <button
                          type="button"
                          class="tfm-status-pill"
                          [attr.aria-expanded]="activePopover() === 'status'"
                          (click)="togglePopover('status', $event)"
                        >
                          <span class="tfm-status-pill__text">{{ currentStatusName() }}</span>
                        </button>
                        @if (activePopover() === 'status') {
                          <div class="tfm-popover" role="dialog" (click)="$event.stopPropagation()">
                            <div class="tfm-popover__list">
                              @for (s of availableStatuses(); track s.id) {
                                <button
                                  type="button"
                                  class="tfm-popover__item"
                                  [class.tfm-popover__item--selected]="statusId() === s.id"
                                  (click)="selectStatus(s.id)"
                                >
                                  <span class="tfm-popover__name">{{ s.name }}</span>
                                  @if (statusId() === s.id) {
                                    <svg class="tfm-popover__check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 7" /></svg>
                                  }
                                </button>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- 2. Dates -->
                    <div class="tfm-prop-row">
                      <span class="tfm-prop-label">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                        <span>Dates</span>
                      </span>
                      <div class="tfm-prop-value">
                        <app-date-picker
                          variant="chip"
                          chipClass="tfm-chip tfm-chip--clean"
                          btnTestId="tfm-due-date-edit-chip"
                          emptyLabel="Empty"
                          [value]="dueDate()"
                          (valueChange)="dueDate.set($event)"
                        />
                      </div>
                    </div>

                    <!-- 3. Sprint -->
                    <div class="tfm-prop-row">
                      <span class="tfm-prop-label">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                        <span>Sprint</span>
                      </span>
                      <div class="tfm-prop-value tfm-chip-anchor">
                        <button
                          type="button"
                          class="tfm-chip tfm-chip--clean"
                          [class.tfm-chip--empty]="!sprintId()"
                          [attr.aria-expanded]="activePopover() === 'sprint'"
                          (click)="togglePopover('sprint', $event)"
                        >
                          <span class="tfm-chip-label">{{ sprintId() ? selectedSprintTitle() : 'Empty' }}</span>
                        </button>
                        @if (activePopover() === 'sprint') {
                          <div class="tfm-popover" role="dialog" (click)="$event.stopPropagation()">
                            <div class="tfm-popover__list">
                              <button
                                type="button"
                                class="tfm-popover__item"
                                [class.tfm-popover__item--selected]="!sprintId()"
                                (click)="selectSprint(''); activePopover.set(null)"
                              >
                                <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                                <span class="tfm-popover__name">No sprint</span>
                              </button>
                              @for (s of availableSprints(); track s.id) {
                                <button
                                  type="button"
                                  class="tfm-popover__item"
                                  [class.tfm-popover__item--selected]="sprintId() === s.id"
                                  (click)="selectSprint(s.id); activePopover.set(null)"
                                >
                                  <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                                  <span class="tfm-popover__name">{{ s.name }}</span>
                                  @if (s.status === 'active') {
                                    <span class="tfm-popover__badge tfm-popover__badge--active">Active</span>
                                  }
                                  @if (sprintId() === s.id) {
                                    <svg class="tfm-popover__check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 7" /></svg>
                                  }
                                </button>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- 4. Time estimate -->
                    <div class="tfm-prop-row">
                      <span class="tfm-prop-label">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" /></svg>
                        <span>Time estimate</span>
                      </span>
                      <div class="tfm-prop-value">
                        <div class="tfm-inline-prop-box" (click)="timeEstimateInput.focus()">
                          <input
                            #timeEstimateInput
                            type="number"
                            min="0"
                            step="0.5"
                            class="tfm-inline-prop-input"
                            placeholder="Empty"
                            [value]="estimatedHoursDisplay()"
                            (input)="onEstimatedHoursChange($any($event.target).value)"
                          />
                          @if (estimatedHours() != null) {
                            <span class="tfm-inline-prop-unit">h</span>
                          }
                        </div>
                      </div>
                    </div>

                    <!-- 4. Track time -->
                    <div class="tfm-prop-row">
                      <span class="tfm-prop-label">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>
                        <span>Track time</span>
                      </span>
                      <div class="tfm-prop-value tfm-prop-value--clock">
                        @if (isAssignee()) {
                          <app-task-clock-widget
                            [task]="widgetTask()!"
                            [isAssignee]="isAssignee()"
                            [compact]="true"
                            [hasOpenSessionMine]="hasOpenSessionMine()"
                            [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee()"
                            (clockedIn)="onTaskClockedIn()"
                            (pushed)="onTaskPushed($event)"
                          />
                        } @else {
                          <div class="tfm-clock-readonly">
                            <span class="tfm-clock-readonly__timer">
                              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>
                              <span>{{ totalTimeLabelForReadonly() }}</span>
                            </span>
                            <span class="tfm-clock-readonly__badge" title="Only the assigned employee can clock in on this task">Not assigned to you</span>
                          </div>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- RIGHT COLUMN -->
                  <div class="tfm-prop-col">
                    <!-- 1. Assignees -->
                    <div class="tfm-prop-row">
                      <span class="tfm-prop-label">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        <span>Assignees</span>
                      </span>
                      <div class="tfm-prop-value tfm-chip-anchor">
                        @if (isObjectiveOwner()) {
                          <button
                            type="button"
                            class="tfm-chip tfm-chip--clean"
                            [class.tfm-chip--empty]="!assigneeEmployeeId()"
                            [attr.aria-expanded]="activePopover() === 'assignee'"
                            (click)="togglePopover('assignee', $event)"
                          >
                            @if (assigneeEmployeeId()) {
                              <app-avatar class="tfm-avatar-circle" [avatarUrl]="assigneeAvatarUrl()" [userName]="assigneeName()" size="sm" />
                              <span class="tfm-chip-label">{{ assigneeName() }}</span>
                            } @else {
                              <span class="tfm-chip-label">Empty</span>
                            }
                          </button>
                          @if (activePopover() === 'assignee') {
                            <div class="tfm-popover-container" (click)="$event.stopPropagation()">
                              <app-task-assignee-dropdown
                                [members]="assignableMembers()"
                                [selectedId]="assigneeEmployeeId()"
                                (selected)="assigneeEmployeeId.set($event ?? ''); activePopover.set(null)"
                                (closed)="activePopover.set(null)"
                              />
                            </div>
                          }
                        } @else {
                          <div class="tfm-chip tfm-chip--clean tfm-chip--readonly" [title]="'Only objective owners can reassign this task'">
                            @if (assigneeEmployeeId()) {
                              <app-avatar class="tfm-avatar-circle" [avatarUrl]="assigneeAvatarUrl()" [userName]="assigneeName()" size="sm" />
                              <span class="tfm-chip-label">{{ assigneeName() }}</span>
                            } @else {
                              <span class="tfm-chip-label">Unassigned</span>
                            }
                          </div>
                        }
                      </div>
                    </div>

                    <!-- 2. Priority -->
                    <div class="tfm-prop-row">
                      <span class="tfm-prop-label">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" /></svg>
                        <span>Priority</span>
                      </span>
                      <div class="tfm-prop-value tfm-chip-anchor">
                        <button
                          type="button"
                          class="tfm-chip tfm-chip--clean"
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
                    </div>

                    <!-- 3. Story points -->
                    <div class="tfm-prop-row">
                      <span class="tfm-prop-label">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
                        <span>Story points</span>
                      </span>
                      <div class="tfm-prop-value">
                        <div class="tfm-inline-prop-box" (click)="storyPointsInput.focus()">
                          <input
                            #storyPointsInput
                            type="number"
                            min="0"
                            step="1"
                            class="tfm-inline-prop-input"
                            placeholder="Empty"
                            [value]="storyPointsDisplay()"
                            (input)="onStoryPointsChange($any($event.target).value)"
                          />
                          @if (storyPoints() != null) {
                            <span class="tfm-inline-prop-unit">pts</span>
                          }
                        </div>
                      </div>
                    </div>

                    <!-- 4. Category / Tags -->
                    <div class="tfm-prop-row">
                      <span class="tfm-prop-label">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></svg>
                        <span>Tags</span>
                      </span>
                      <div class="tfm-prop-value tfm-chip-anchor">
                        <button
                          type="button"
                          class="tfm-chip tfm-chip--clean"
                          [attr.aria-expanded]="activePopover() === 'category'"
                          (click)="togglePopover('category', $event)"
                        >
                          <span class="tfm-chip-label">{{ categoryName() || 'Empty' }}</span>
                        </button>
                        @if (activePopover() === 'category') {
                          <div class="tfm-popover" role="dialog" (click)="$event.stopPropagation()">
                            <div class="tfm-popover__list">
                              @for (c of categories(); track c.id) {
                                <button
                                  type="button"
                                  class="tfm-popover__item"
                                  [class.tfm-popover__item--selected]="categoryId() === c.id"
                                  (click)="selectCategory(c.id)"
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

                    <!-- 5. Progress -->
                    <div class="tfm-prop-row">
                      <span class="tfm-prop-label">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                        <span>Progress</span>
                      </span>
                      <div class="tfm-prop-value">
                        <div class="tfm-inline-prop-box" (click)="progressPercentInput.focus()">
                          <input
                            #progressPercentInput
                            type="number"
                            min="0"
                            max="100"
                            class="tfm-inline-prop-input tfm-inline-prop-input--progress"
                            placeholder="0"
                            [value]="progressPercentDisplay()"
                            (input)="onProgressPercentChange($any($event.target).value)"
                          />
                          <span class="tfm-inline-prop-unit">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Subtle Divider -->
                <div class="tfm-doc-divider"></div>

                <!-- Description Area: read mode until the user clicks into it -->
                <div
                  class="tfm-doc-section tfm-description-section"
                  data-testid="task-description-section"
                >
                  <app-rich-text-editor
                    #descRte
                    [initialHtml]="description()"
                    [cssStyles]="false"
                    placeholder="Add description"
                    (htmlChange)="description.set($event)"
                    (filesAttached)="onAttachmentFilesSelected($event)"
                    (uploadFailed)="errorMessage.set($event)"
                  />
                </div>

                <!-- Subtasks Section (Edit Mode) -->
                @if (currentEffectiveMode() === 'edit' && task(); as t) {
                  @if (!t.parentTaskId) {
                    @if (displayedSubtasks().length > 0) {
                      <ng-container [ngTemplateOutlet]="subtasksSectionTpl" [ngTemplateOutletContext]="{ isCreateMode: false, parentTaskId: t.id }" />
                    } @else if (addingSubtask()) {
                      <div class="tfm-subtasks-section">
                        <div class="tfm-subtask-header">
                          <div class="tfm-subtask-header-left">
                            <button type="button" class="tfm-subtask-collapse-btn" (click)="cancelAddSubtask()">
                              <svg class="tfm-subtask-chevron-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M7 10l5 5 5-5z" />
                              </svg>
                              <span class="tfm-subtask-header-title">Add subtask</span>
                            </button>
                          </div>
                        </div>
                        <ng-container [ngTemplateOutlet]="subtaskCreateRowTpl" [ngTemplateOutletContext]="{ parentTaskId: t.id }" />
                      </div>
                    }
                  }
                }

                <!-- Quick Actions List (Add subtask when 0 subtasks, Attach File when empty) -->
                <div class="tfm-actions-list">
                  @if (currentEffectiveMode() === 'edit' && task() && !task()?.parentTaskId && displayedSubtasks().length === 0 && !addingSubtask()) {
                    <button
                      type="button"
                      class="tfm-action-row"
                      data-testid="add-subtask-button"
                      (click)="startAddSubtask()"
                    >
                      <span class="tfm-action-icon">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <circle cx="3.5" cy="4.5" r="1.75"/>
                          <circle cx="11.5" cy="11.5" r="1.75"/>
                          <path d="M3.5 6.25v2.25a2.5 2.5 0 0 0 2.5 2.5h3.75"/>
                        </svg>
                      </span>
                      <span>Add subtask</span>
                    </button>
                  }
                  @if (attachedFiles().length === 0) {
                    <app-task-attachment-list
                      [files]="attachedFiles()"
                      (fileSelected)="onAttachmentFilesSelected($event)"
                      (removed)="removeAttachedFile($event)"
                      (downloadRequested)="downloadAttachment($event)"
                    />
                  }
                </div>

                <!-- Attachments Section (when files exist) -->
                @if (attachedFiles().length > 0) {
                  <div class="tfm-doc-section">
                    <div class="tfm-doc-section-head">
                      <span class="tfm-doc-section-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                      </span>
                      <span class="tfm-doc-section-title">Attachments</span>
                      <span class="tfm-doc-count">{{ attachedFiles().length }}</span>
                    </div>
                    <app-task-attachment-list
                      [files]="attachedFiles()"
                      (fileSelected)="onAttachmentFilesSelected($event)"
                      (removed)="removeAttachedFile($event)"
                      (downloadRequested)="downloadAttachment($event)"
                    />
                  </div>
                }

                <!-- Unified Activity Hub (matching image reference) -->
                @if (currentEffectiveMode() === 'edit' && taskId(); as tid) {
                  <div class="tfm-activity-section" data-testid="task-activity-section">
                    <!-- Activity Header & Tabs -->
                    <div class="tfm-activity-header">
                      <h3 class="tfm-activity-title">Activity</h3>
                      <div class="tfm-activity-controls">
                        <div class="tfm-activity-tabs" role="tablist" aria-label="Activity views">
                          <button
                            type="button"
                            class="tfm-activity-tab"
                            [class.tfm-activity-tab--active]="activityTab() === 'all'"
                            (click)="setActivityTab('all')"
                            data-testid="tab-all"
                          >
                            All
                          </button>
                          <button
                            type="button"
                            class="tfm-activity-tab"
                            [class.tfm-activity-tab--active]="activityTab() === 'comments'"
                            (click)="setActivityTab('comments')"
                            data-testid="tab-comments"
                          >
                            Comments
                          </button>
                          <button
                            type="button"
                            class="tfm-activity-tab"
                            [class.tfm-activity-tab--active]="activityTab() === 'history'"
                            (click)="setActivityTab('history')"
                            data-testid="tab-history"
                          >
                            History
                          </button>
                          <button
                            type="button"
                            class="tfm-activity-tab"
                            [class.tfm-activity-tab--active]="activityTab() === 'work_log'"
                            (click)="setActivityTab('work_log')"
                            data-testid="tab-work-log"
                          >
                            Work log
                          </button>
                        </div>

                        <button
                          type="button"
                          class="tfm-activity-sort-btn"
                          [attr.aria-label]="activitySortOrder() === 'desc' ? 'Sort: Newest first' : 'Sort: Oldest first'"
                          [title]="activitySortOrder() === 'desc' ? 'Newest first (click for oldest)' : 'Oldest first (click for newest)'"
                          (click)="toggleActivitySort()"
                          data-testid="sort-activity-btn"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <line x1="3" y1="6" x2="13" y2="6"></line>
                            <line x1="3" y1="12" x2="9" y2="12"></line>
                            @if (activitySortOrder() === 'desc') {
                              <polyline points="15 15 18 18 21 15"></polyline>
                              <line x1="18" y1="6" x2="18" y2="18"></line>
                            } @else {
                              <polyline points="15 9 18 6 21 9"></polyline>
                              <line x1="18" y1="6" x2="18" y2="18"></line>
                            }
                          </svg>
                        </button>
                      </div>
                    </div>

                    <!-- Comments component: always mounted for test compatibility and state retention, visible on Comments & All tabs -->
                    <div [hidden]="activityTab() !== 'comments' && activityTab() !== 'all'">
                      <app-task-comments [taskId]="tid" [projectId]="projectId()" [sortOrder]="activitySortOrder()" />
                    </div>

                    @if (activityTab() === 'history' || activityTab() === 'all') {
                      <div class="tfm-activity-feed-wrap">
                        @if (activityTab() === 'all') {
                          <div class="tfm-activity-feed-divider">
                            <span>History & Changes</span>
                          </div>
                        }
                        <app-task-history-feed [entries]="sortedHistoryEntries()" (reasonSaved)="reloadHistory()" />
                      </div>
                    }

                    @if (activityTab() === 'work_log') {
                      <div class="tfm-activity-feed-wrap">
                        @if (workLogEntries().length === 0) {
                          <p class="tfm-activity-empty">No work logged yet</p>
                        } @else {
                          <app-task-history-feed [entries]="workLogEntries()" (reasonSaved)="reloadHistory()" />
                        }
                      </div>
                    }
                  </div>
                }

                <app-monitor-warning-callout [warnings]="loadWarnings()" />

                @if (errorMessage()) {
                  <p class="tfm__error tfm-banner-error" role="alert">{{ errorMessage() }}</p>
                }
              </div>
            }
          </div>

          <footer class="tfm__foot">
            <app-button variant="secondary" (pressed)="onCancel()">Cancel</app-button>

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
                        <strong>Create work item</strong>
                        <span>Save and close</span>
                      </div>
                    </button>
                    <button type="button" class="tfm-split-dropdown__item" (click)="submitCreateWithAction('create_and_add_another')">
                      <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                      <div>
                        <strong>Create & add another</strong>
                        <span>Save and enter next work item</span>
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
            <!-- Subtasks Section Template (Used in both Create and Edit modes) -->
            <ng-template #subtasksSectionTpl let-isCreateMode="isCreateMode" let-parentTaskId="parentTaskId">
              <div class="tfm-subtasks-section">
                <!-- Section Header: ▼ Subtasks X open [progressBar] X for me -->
                <div class="tfm-subtask-header">
                  <div class="tfm-subtask-header-left">
                    <button
                      type="button"
                      class="tfm-subtask-collapse-btn"
                      (click)="toggleSubtasksCollapsed()"
                      [attr.aria-expanded]="!subtasksCollapsed()"
                    >
                      <svg class="tfm-subtask-chevron-icon" [class.tfm-subtask-chevron-icon--collapsed]="subtasksCollapsed()" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                      <span class="tfm-subtask-header-title">Subtasks</span>
                    </button>

                    <div class="tfm-subtask-header-meta">
                      <span class="tfm-subtask-status-pill">{{ openSubtasksCount() }} open</span>
                      <div class="tfm-subtask-progress" [title]="subtaskCompletedCount() + '/' + displayedSubtasks().length + ' completed'">
                        <div class="tfm-subtask-progress-bar">
                          <div class="tfm-subtask-progress-fill" [style.width.%]="subtaskProgressPercent()"></div>
                        </div>
                      </div>
                      @if (forMeSubtasksCount() > 0) {
                        <span class="tfm-subtask-for-me-pill">{{ forMeSubtasksCount() }} for me</span>
                      }
                    </div>
                  </div>
                </div>

                <!-- Subtasks Table Content (shown when expanded) -->
                @if (!subtasksCollapsed()) {
                  <div class="tfm-subtask-table-head">
                    <div class="tfm-subtask-col-name">Name</div>
                    <div class="tfm-subtask-col-assignee">Assignee</div>
                    <div class="tfm-subtask-col-priority">Priority</div>
                    <div class="tfm-subtask-col-status">Status</div>
                    <div class="tfm-subtask-col-actions">
                      <button
                        type="button"
                        class="tfm-subtask-head-add-btn"
                        (click)="startAddSubtask()"
                        title="Add subtask"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/>
                        </svg>
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  <div class="tfm-subtask-list">
                    @for (subtask of displayedSubtasks(); track subtask.id) {
                      <div
                        class="tfm-subtask-row"
                        role="button"
                        tabindex="0"
                        [attr.data-testid]="'subtask-row-' + subtask.id"
                        (click)="!isCreateMode && openSubtask(subtask.id)"
                        (keydown.enter)="!isCreateMode && openSubtask(subtask.id)"
                        (keydown.space)="$event.preventDefault(); !isCreateMode && openSubtask(subtask.id)"
                      >
                        <div class="tfm-subtask-cell-name">
                          <button
                            type="button"
                            class="tfm-subtask-status-btn"
                            (click)="toggleSubtaskStatus(subtask, $event)"
                            [title]="isSubtaskComplete(subtask) ? 'Mark incomplete' : 'Mark complete'"
                          >
                            @if (isSubtaskComplete(subtask)) {
                              <svg class="tfm-subtask-check-circle" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.99-4.99a.75.75 0 0 0-.01-1.05z"/>
                              </svg>
                            } @else {
                              <svg class="tfm-subtask-dashed-circle" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2" aria-hidden="true">
                                <circle cx="8" cy="8" r="6"/>
                              </svg>
                            }
                          </button>
                          <span class="tfm-subtask-title" [class.tfm-subtask-title--completed]="isSubtaskComplete(subtask)">{{ subtask.title }}</span>
                        </div>

                        <div class="tfm-subtask-cell-assignee tfm-subtask-anchor">
                          <button
                            type="button"
                            class="tfm-subtask-cell-btn tfm-subtask-assignee-btn"
                            [attr.data-testid]="'subtask-assignee-' + subtask.id"
                            (click)="toggleSubtaskPopover(subtask.id, 'assignee', $event)"
                            [title]="subtask.assigneeEmployeeIds.length > 0 ? getSubtaskAssigneeName(subtask.assigneeEmployeeIds[0]) : 'Add assignee'"
                          >
                            @if (subtask.assigneeEmployeeIds.length > 0) {
                              <app-avatar
                                [avatarUrl]="getSubtaskAssigneeAvatarUrl(subtask.assigneeEmployeeIds[0])"
                                [userName]="getSubtaskAssigneeName(subtask.assigneeEmployeeIds[0])"
                                size="sm"
                              />
                            } @else {
                              <app-avatar size="sm" shape="circle" [unassigned]="true" />
                            }
                          </button>
                          @if (activeSubtaskPopover()?.id === subtask.id && activeSubtaskPopover()?.type === 'assignee') {
                            <div class="tfm-popover-container" (click)="$event.stopPropagation()">
                              <app-task-assignee-dropdown
                                [members]="assignableMembers()"
                                [selectedId]="subtask.assigneeEmployeeIds[0]"
                                (selected)="changeSubtaskAssignee(subtask, $event ?? '')"
                                (closed)="activeSubtaskPopover.set(null)"
                              />
                            </div>
                          }
                        </div>

                        <div class="tfm-subtask-cell-priority tfm-subtask-anchor">
                          <button
                            type="button"
                            class="tfm-subtask-cell-btn tfm-subtask-priority-btn"
                            [attr.data-testid]="'subtask-priority-' + subtask.id"
                            (click)="toggleSubtaskPopover(subtask.id, 'priority', $event)"
                            [title]="subtask.priority ? formatSubtaskPriority(subtask.priority) : 'Priority'"
                          >
                            @if (subtask.priority) {
                              <span class="tfm-subtask-priority-tag" [attr.data-priority]="subtask.priority">
                                <svg class="tfm-subtask-flag-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                  <path d="M3 2v12h1.5V9.5h6l.5 1.5h4V4h-4.5L10 2.5H3z"/>
                                </svg>
                                <span>{{ formatSubtaskPriority(subtask.priority) }}</span>
                              </span>
                            } @else {
                              <span class="tfm-subtask-priority-tag tfm-subtask-priority-tag--none">
                                <svg class="tfm-subtask-flag-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                  <path d="M3 2v12h1.5V9.5h6l.5 1.5h4V4h-4.5L10 2.5H3z"/>
                                </svg>
                                <span>—</span>
                              </span>
                            }
                          </button>
                          @if (activeSubtaskPopover()?.id === subtask.id && activeSubtaskPopover()?.type === 'priority') {
                            <div class="tfm-popover" role="dialog" aria-label="Change priority" (click)="$event.stopPropagation()">
                              <div class="tfm-popover__list">
                                @for (opt of priorityOptionsList; track opt.value) {
                                  <button
                                    type="button"
                                    class="tfm-popover__item"
                                    [class.tfm-popover__item--selected]="subtask.priority === opt.value"
                                    (click)="changeSubtaskPriority(subtask, opt.value)"
                                  >
                                    <span class="tfm-dot" [class]="opt.dotClass"></span>
                                    <span class="tfm-popover__name">{{ opt.label }}</span>
                                    @if (subtask.priority === opt.value) {
                                      <svg class="tfm-popover__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                                    }
                                  </button>
                                }
                              </div>
                            </div>
                          }
                        </div>

                        <div class="tfm-subtask-cell-status tfm-subtask-anchor">
                          <button
                            type="button"
                            class="tfm-subtask-cell-btn tfm-subtask-status-pill-btn"
                            [attr.data-testid]="'subtask-status-' + subtask.id"
                            (click)="toggleSubtaskPopover(subtask.id, 'status', $event)"
                            [title]="getSubtaskStatusName(subtask.statusId)"
                          >
                            <span class="tfm-subtask-status-dot" [style.background-color]="getSubtaskStatusColor(subtask.statusId)"></span>
                            <span class="tfm-subtask-status-text">{{ getSubtaskStatusName(subtask.statusId) }}</span>
                            <svg class="tfm-subtask-caret" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                              <path d="M3 4.5l3 3 3-3z"/>
                            </svg>
                          </button>
                          @if (activeSubtaskPopover()?.id === subtask.id && activeSubtaskPopover()?.type === 'status') {
                            <div class="tfm-popover tfm-popover--right" role="dialog" aria-label="Change status" (click)="$event.stopPropagation()">
                              <div class="tfm-popover__list">
                                @for (s of availableStatuses(); track s.id) {
                                  <button
                                    type="button"
                                    class="tfm-popover__item"
                                    [class.tfm-popover__item--selected]="subtask.statusId === s.id"
                                    (click)="changeSubtaskStatus(subtask, s.id)"
                                  >
                                    <span class="tfm-subtask-status-dot" [style.background-color]="s.color || '#64748b'"></span>
                                    <span class="tfm-popover__name">{{ s.name }}</span>
                                    @if (subtask.statusId === s.id) {
                                      <svg class="tfm-popover__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                                    }
                                  </button>
                                }
                              </div>
                            </div>
                          }
                        </div>

                        <div class="tfm-subtask-cell-actions">
                          @if (isCreateMode) {
                            <button
                              type="button"
                              class="tfm-subtask-remove-draft-btn"
                              title="Remove subtask"
                              (click)="removeDraftSubtask(subtask.id, $event)"
                            >
                              <svg viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/></svg>
                            </button>
                          } @else {
                            <span class="tfm-subtask-chevron" aria-hidden="true">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </span>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Add Task Row (ClickUp style) -->
                  @if (addingSubtask()) {
                    <ng-container [ngTemplateOutlet]="subtaskCreateRowTpl" [ngTemplateOutletContext]="{ parentTaskId: parentTaskId }" />
                  } @else {
                    <button
                      type="button"
                      class="tfm-subtask-add-trigger"
                      data-testid="add-subtask-button"
                      (click)="startAddSubtask()"
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/>
                      </svg>
                      <span>Add Task</span>
                    </button>
                  }

                  <div class="tfm-subtask-divider"></div>
                }
              </div>
            </ng-template>

            <!-- ClickUp Inline Subtask Creation Row (Single row) -->
            <ng-template #subtaskCreateRowTpl let-parentTaskId="parentTaskId">
              <div class="tfm-subtask-inline-create" (click)="$event.stopPropagation()">
                <div class="tfm-subtask-create-left">
                  <span class="tfm-subtask-create-status-icon" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 2" class="tfm-subtask-dashed-circle">
                      <circle cx="8" cy="8" r="6"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    class="tfm-subtask-inline-title"
                    placeholder="Task Name or type '/' for commands"
                    data-testid="subtask-add-title"
                    [value]="newSubtaskTitle()"
                    (input)="newSubtaskTitle.set($any($event.target).value)"
                    (keydown.enter)="newSubtaskTitle().trim() && saveNewSubtask(parentTaskId)"
                    (keydown.escape)="cancelAddSubtask()"
                  />
                </div>

                <div class="tfm-subtask-create-right">
                  <!-- Module Picker (Inherits parent module, icon only - no text name) -->
                  <div class="tfm-chip-anchor">
                    <button
                      type="button"
                      class="tfm-subtask-icon-btn"
                      data-testid="subtask-add-module-button"
                      (click)="toggleSubtaskPopover('new', 'module', $event)"
                      [title]="newSubtaskModuleId() ? ('Module: ' + getSubtaskModuleName(newSubtaskModuleId())) : 'Module'"
                      [class.tfm-subtask-icon-btn--active]="newSubtaskModuleId()"
                    >
                      <svg class="tfm-subtask-module-cube-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                      </svg>
                    </button>
                    @if (activeSubtaskPopover()?.id === 'new' && activeSubtaskPopover()?.type === 'module') {
                      <div class="tfm-popover tfm-popover--up" role="dialog" aria-label="Choose module" (click)="$event.stopPropagation()">
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
                              [class.tfm-popover__item--selected]="newSubtaskModuleId() === m.objectiveId"
                              (click)="selectSubtaskModule(m.objectiveId)"
                            >
                              <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                                <line x1="12" y1="22.08" x2="12" y2="12"/>
                              </svg>
                              <span class="tfm-popover__name">{{ m.title }}</span>
                              @if (newSubtaskModuleId() === m.objectiveId) {
                                <svg class="tfm-popover__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                              }
                            </button>
                          } @empty {
                            <p style="margin: 6px 0 2px; color: var(--color-text-secondary); font-size: 12px; text-align: center;">No matching modules</p>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Tag / Work Item Type Picker -->
                  <div class="tfm-chip-anchor">
                    <button
                      type="button"
                      class="tfm-subtask-icon-btn"
                      [class.tfm-subtask-icon-btn--active]="newSubtaskCategoryId()"
                      data-testid="subtask-add-tag-button"
                      (click)="toggleSubtaskPopover('new', 'tag', $event)"
                      [title]="newSubtaskCategoryId() ? ('Work item type / Tag: ' + getSubtaskCategoryName(newSubtaskCategoryId())) : 'Tag'"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <circle cx="7" cy="7" r="1.5" />
                      </svg>
                    </button>
                    @if (activeSubtaskPopover()?.id === 'new' && (activeSubtaskPopover()?.type === 'tag' || activeSubtaskPopover()?.type === 'category')) {
                      <div class="tfm-popover tfm-popover--up" role="dialog" aria-label="Select work item type" (click)="$event.stopPropagation()">
                        <div class="tfm-popover__list">
                          @for (c of categories(); track c.id) {
                            <button
                              type="button"
                              class="tfm-popover__item"
                              [class.tfm-popover__item--selected]="newSubtaskCategoryId() === c.id"
                              (click)="selectSubtaskCategory(c.id)"
                            >
                              <svg class="tfm-chip-svg tfm-popover-item-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.5" /></svg>
                              <span class="tfm-popover__name">{{ c.name }}</span>
                              @if (newSubtaskCategoryId() === c.id) {
                                <svg class="tfm-popover__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                              }
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <div class="tfm-subtask-inline-divider"></div>

                  <!-- Assignee Picker -->
                  <div class="tfm-chip-anchor">
                    <button
                      type="button"
                      class="tfm-subtask-icon-btn"
                      data-testid="subtask-add-assignee-button"
                      (click)="toggleSubtaskPopover('new', 'assignee', $event)"
                      [title]="newSubtaskAssigneeId() ? getSubtaskAssigneeName(newSubtaskAssigneeId()!) : 'Assignee'"
                    >
                      @if (newSubtaskAssigneeId(); as assigneeId) {
                        <app-avatar [avatarUrl]="getSubtaskAssigneeAvatarUrl(assigneeId)" [userName]="getSubtaskAssigneeName(assigneeId)" size="sm" />
                      } @else {
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M5.5 13.5v-1a2.5 2.5 0 0 1 2.5-2.5h1a2.5 2.5 0 0 1 2.5 2.5v1"/>
                          <circle cx="8" cy="5.5" r="2.5"/>
                          <path d="M12.5 7.5h3M14 6v3"/>
                        </svg>
                      }
                    </button>
                    @if (activeSubtaskPopover()?.id === 'new' && activeSubtaskPopover()?.type === 'assignee') {
                      <div class="tfm-popover-container tfm-popover-container--up" (click)="$event.stopPropagation()">
                        <app-task-assignee-dropdown
                          [members]="assignableMembers()"
                          [selectedId]="newSubtaskAssigneeId()"
                          (selected)="selectNewSubtaskAssignee($event); activeSubtaskPopover.set(null)"
                          (closed)="activeSubtaskPopover.set(null)"
                        />
                      </div>
                    }
                  </div>

                  <!-- Date Picker -->
                  <app-date-picker
                    variant="chip"
                    btnTestId="subtask-add-date-button"
                    chipClass="tfm-subtask-icon-btn"
                    [value]="newSubtaskDueDate()"
                    (valueChange)="newSubtaskDueDate.set($event)"
                  />

                  <!-- Priority Picker -->
                  <div class="tfm-chip-anchor">
                    <button
                      type="button"
                      class="tfm-subtask-icon-btn"
                      data-testid="subtask-add-priority-button"
                      (click)="toggleSubtaskPopover('new', 'priority', $event)"
                      [title]="newSubtaskPriority() ? formatSubtaskPriority(newSubtaskPriority()) : 'Priority'"
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3 2v12h1.5V9.5h6l.5 1.5h4V4h-4.5L10 2.5H3z"/>
                      </svg>
                    </button>
                    @if (activeSubtaskPopover()?.id === 'new' && activeSubtaskPopover()?.type === 'priority') {
                      <div class="tfm-popover tfm-popover--up" role="dialog" aria-label="Change priority" (click)="$event.stopPropagation()">
                        <div class="tfm-popover__list">
                          @for (opt of priorityOptionsList; track opt.value) {
                            <button
                              type="button"
                              class="tfm-popover__item"
                              [class.tfm-popover__item--selected]="newSubtaskPriority() === opt.value"
                              (click)="selectSubtaskPriority(opt.value)"
                            >
                              <span class="tfm-dot" [class]="opt.dotClass"></span>
                              <span class="tfm-popover__name">{{ opt.label }}</span>
                              @if (newSubtaskPriority() === opt.value) {
                                <svg class="tfm-popover__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                              }
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Actions: Cancel and Save -->
                  <app-button
                    size="sm"
                    variant="secondary"
                    data-testid="subtask-add-cancel"
                    (pressed)="cancelAddSubtask()"
                    (click)="cancelAddSubtask()"
                    title="Cancel (Esc)"
                  >
                    Cancel
                  </app-button>

                  <app-button
                    size="sm"
                    variant="primary"
                    data-testid="subtask-add-save"
                    [disabled]="!newSubtaskTitle().trim()"
                    (pressed)="saveNewSubtask(parentTaskId)"
                    (click)="saveNewSubtask(parentTaskId)"
                    title="Save task (Enter)"
                  >
                    Save <span class="tfm-subtask-enter-symbol">↵</span>
                  </app-button>
                </div>
              </div>
            </ng-template>

          </footer>

        </div>
      </div>
    }

    <app-confirm-modal
      [open]="deleteConfirmOpen()"
      title="Delete task?"
      [message]="deleteConfirmMessage()"
      confirmLabel="Delete"
      [loading]="deleteLoading()"
      [errorMessage]="deleteError()"
      (confirmed)="onDeleteConfirmed()"
      (cancelled)="onDeleteCancelled()"
    />

    <app-task-duplicate-dialog
      [open]="duplicateDialogOpen()"
      [taskTitle]="task()?.title || ''"
      [currentObjectiveId]="task()?.objectiveId || ''"
      [modules]="duplicateModuleOptions()"
      [submitting]="duplicateLoading()"
      [error]="duplicateError()"
      (duplicated)="onDuplicateConfirmed($event)"
      (cancelled)="onDuplicateCancelled()"
    />

    <app-task-convert-to-subtask-dialog
      [open]="convertToSubtaskDialogOpen()"
      [taskTitle]="task()?.title || ''"
      [candidates]="convertToSubtaskCandidates()"
      [hasOwnSubtasks]="displayedSubtasks().length > 0"
      [submitting]="convertToSubtaskLoading()"
      [error]="convertToSubtaskError()"
      (converted)="onConvertToSubtaskConfirmed($event)"
      (cancelled)="onConvertToSubtaskCancelled()"
    />
  `,
  styles: [`
    .tfm-scrim { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: flex-start; justify-content: center; padding: 40px 24px; background: rgba(0,0,0,.5); overflow-y: auto; }
    .tfm { display: flex; flex-direction: column; width: 100%; max-width: 1180px; max-height: calc(100vh - 80px); border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08); overflow: hidden; }
    .tfm--create { max-width: 820px; max-height: none; overflow: visible; }
    .tfm__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 30px 16px; border-bottom: 1px solid var(--color-border); }
    .tfm__head--doc { align-items: center; padding: 14px 30px; }
    .tfm--create .tfm__head { border-top-left-radius: 8px; border-top-right-radius: 8px; }
    .tfm__title { display: flex; flex-direction: column; gap: 3px; }
    .tfm__title h2 { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -.02em; color: var(--color-text-primary); }
    .tfm__title p { margin: 0; font-size: 13px; color: var(--color-text-secondary); }
    .tfm-breadcrumbs { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-secondary); font-weight: 500; }
    .tfm-breadcrumb-proj { color: var(--color-text-secondary); }
    .tfm-breadcrumb-sep { opacity: 0.45; }
    .tfm-breadcrumb-id { color: var(--color-text-primary); font-weight: 600; }
    .tfm-breadcrumb-link { display: inline-flex; align-items: center; background: none; border: none; padding: 0; margin: 0; font: inherit; color: var(--color-text-secondary); font-weight: 500; cursor: pointer; text-decoration: underline; text-decoration-color: transparent; transition: color 140ms ease, text-decoration-color 140ms ease; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tfm-breadcrumb-link:hover { color: var(--color-accent); text-decoration-color: currentColor; }
    .tfm__x { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex: 0 0 auto; border: 0; border-radius: 7px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .tfm__x:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .tfm__x svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .tfm__body { display: flex; flex-direction: column; gap: 20px; padding: 20px 28px 24px; overflow-y: auto; }
    .tfm--create .tfm__body { overflow: visible; padding: 22px 28px 24px; }

    /* ClickUp Document Layout */
    .tfm-doc-layout { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .tfm-type-pill { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 7px; border-radius: 4px; background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); color: var(--color-accent); font-size: 11.5px; font-weight: 600; }
    .tfm-type-pill svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2; }
    .tfm-type-pill--subtask { background: color-mix(in srgb, #8b5cf6 15%, var(--color-surface)) !important; color: #8b5cf6 !important; }
    .tfm-type-pill--interactive { border: none; cursor: pointer; font-family: inherit; transition: filter 120ms ease, background-color 120ms ease; }
    .tfm-type-pill--interactive:hover { filter: brightness(0.95); }
    .tfm-created-at { flex: 0 0 auto; color: var(--color-text-secondary); font-size: 12px; white-space: nowrap; }
    .tfm-header-actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
    .tfm-header-share-btn { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 7px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: all 120ms ease; }
    .tfm-header-share-btn:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border)); }
    .tfm-header-share-btn svg { width: 13px; height: 13px; flex-shrink: 0; }
    .tfm-header-module-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: auto; height: 26px; border: none; border-radius: 5px; background: transparent; color: var(--color-text-secondary); cursor: pointer; padding: 0 6px; font: inherit; font-size: 12.5px; font-weight: 500; white-space: nowrap; transition: background-color 120ms ease, color 120ms ease; }
    .tfm-header-module-btn:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .tfm-header-module-btn svg { width: 15px; height: 15px; flex: 0 0 auto; }

    .tfm-doc-title-block { display: flex; flex-direction: column; gap: 4px; }
    .tfm-doc-title-input { width: 100%; font-size: 24px; font-weight: 700; line-height: 1.3; color: var(--color-text-primary); border: 1px solid transparent; border-radius: 6px; padding: 4px 8px; background: transparent; outline: none; transition: background-color 140ms ease, border-color 140ms ease; font-family: inherit; }
    .tfm-doc-title-input:hover:not(:focus) { background: var(--color-surface-secondary); border-color: transparent; }
    .tfm-doc-title-input:focus { background: transparent; border-color: var(--color-border); box-shadow: none; outline: none; }
    .tfm-doc-title-input--error { border-color: var(--color-danger) !important; background: var(--color-danger-subtle) !important; }

    /* ClickUp Property Grid */
    .tfm-prop-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 36px; padding: 4px 0 10px; }
    @media (max-width: 768px) { .tfm-prop-grid { grid-template-columns: 1fr; gap: 8px; } }
    .tfm-prop-col { display: flex; flex-direction: column; gap: 8px; }
    .tfm-prop-row { display: flex; align-items: center; min-height: 36px; gap: 12px; }
    .tfm-prop-label { display: inline-flex; align-items: center; gap: 8px; width: 120px; flex-shrink: 0; font-size: 13px; font-weight: 500; color: var(--color-text-secondary); }
    .tfm-prop-label svg { width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 1.8; opacity: 0.85; flex-shrink: 0; }
    .tfm-prop-value { display: flex; align-items: center; min-width: 0; flex: 1; width: 100%; position: relative; }
    .tfm-prop-value--clock { flex-wrap: wrap; }
    .tfm-prop-grid .tfm-chip-anchor { position: relative; display: flex; width: 100%; }

    /* 1. Status */
    .tfm-status-pill { display: flex; align-items: center; justify-content: flex-start; width: 100%; height: 32px; padding: 0 8px; border-radius: 6px; border: 1px solid transparent; background: transparent; color: var(--color-text-primary); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; cursor: pointer; box-sizing: border-box; transition: all 140ms ease; }
    .tfm-status-pill:hover, .tfm-status-pill[aria-expanded="true"] { background: var(--color-surface-secondary); border-color: transparent; box-shadow: none; outline: none; }
    .tfm-chevron-svg { width: 13px; height: 13px; stroke: var(--color-text-secondary); fill: none; stroke-width: 2.2; transition: transform 140ms ease; flex-shrink: 0; }
    .tfm-chevron-svg--open { transform: rotate(180deg); }

    /* 2. Dates (DatePicker integration in property grid) */
    .tfm-prop-grid app-date-picker,
    .tfm-prop-grid ::ng-deep app-date-picker { display: flex !important; width: 100% !important; }
    .tfm-prop-grid ::ng-deep .dp-container--chip { display: flex !important; width: 100% !important; }
    .tfm-prop-grid ::ng-deep .dp-chip.tfm-chip { display: flex !important; align-items: center !important; justify-content: flex-start !important; width: 100% !important; height: 32px !important; padding: 0 8px !important; border-radius: 6px !important; border: 1px solid transparent !important; background: transparent !important; color: var(--color-text-primary) !important; font-size: 13px !important; font-weight: 500 !important; box-shadow: none !important; gap: 8px !important; cursor: pointer !important; box-sizing: border-box !important; transition: all 140ms ease !important; }
    .tfm-prop-grid ::ng-deep .dp-chip.tfm-chip:hover:not(:disabled),
    .tfm-prop-grid ::ng-deep .dp-chip.tfm-chip[aria-expanded="true"] { background: var(--color-surface-secondary) !important; border-color: transparent !important; box-shadow: none !important; outline: none !important; }
    .tfm-prop-grid ::ng-deep .dp-chip.tfm-chip svg { width: 15px !important; height: 15px !important; stroke: var(--color-text-secondary) !important; fill: none !important; stroke-width: 1.8 !important; flex-shrink: 0 !important; }
    .tfm-prop-grid ::ng-deep .dp-chip:not(.dp-chip--active) .tfm-chip-label { color: var(--color-text-secondary) !important; }

    /* 3. Chips (Sprint, Assignees, Priority, Tags) */
    .tfm-prop-grid .tfm-chip, .tfm-chip.tfm-chip--clean, .tfm-chip--clean { display: flex !important; align-items: center !important; justify-content: flex-start !important; width: 100% !important; height: 32px !important; padding: 0 8px !important; border-radius: 6px !important; border: 1px solid transparent !important; background: transparent !important; box-shadow: none !important; font-weight: 500; font-size: 13px; color: var(--color-text-primary); gap: 8px; cursor: pointer; box-sizing: border-box !important; transition: all 140ms ease; }
    .tfm-prop-grid .tfm-chip:hover, .tfm-chip.tfm-chip--clean:hover, .tfm-chip--clean:hover, .tfm-prop-grid .tfm-chip[aria-expanded="true"], .tfm-chip.tfm-chip--clean[aria-expanded="true"], .tfm-chip--clean[aria-expanded="true"] { background: var(--color-surface-secondary) !important; border-color: transparent !important; box-shadow: none !important; outline: none !important; }
    .tfm-chip--empty { color: var(--color-text-secondary) !important; }
    .tfm-chip--readonly { cursor: default !important; }
    .tfm-chip--readonly:hover { background: var(--color-surface-secondary) !important; border-color: transparent !important; box-shadow: none !important; }
    .tfm-avatar-circle { width: 22px; height: 22px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; background: color-mix(in srgb, var(--color-accent) 18%, transparent); color: var(--color-accent); flex-shrink: 0; }
    .tfm-prop-grid .tfm-chip-label { max-width: none !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; text-align: left !important; }

    /* 4. Inline inputs (Time estimate, Story points, Progress) */
    .tfm-inline-prop-box { display: flex; align-items: center; justify-content: flex-start; gap: 4px; width: 100%; height: 32px; padding: 0 8px; border: 1px solid transparent; border-radius: 6px; background: transparent; cursor: text; box-sizing: border-box; transition: all 140ms ease; }
    .tfm-inline-prop-box:hover, .tfm-inline-prop-box:focus-within { background: var(--color-surface-secondary); border-color: transparent; box-shadow: none; outline: none; }
    .tfm-inline-prop-input { min-width: 44px; width: auto; max-width: 70px; border: 0; outline: none; background: transparent; font: inherit; font-size: 13px; font-weight: 500; color: var(--color-text-primary); -moz-appearance: textfield; padding: 0; }
    .tfm-inline-prop-input::-webkit-inner-spin-button, .tfm-inline-prop-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    .tfm-inline-prop-input::placeholder { color: var(--color-text-secondary); font-weight: 500; opacity: 1; }
    .tfm-inline-prop-input--progress { min-width: 36px; max-width: 48px; }
    .tfm-inline-prop-unit { font-size: 12px; font-weight: 500; color: var(--color-text-secondary); }

    /* 5. Track time (Clock widget & Readonly timer) */
    .tfm-prop-grid app-task-clock-widget,
    .tfm-prop-grid ::ng-deep app-task-clock-widget { display: flex !important; width: 100% !important; }
    .tfm-prop-grid ::ng-deep .task-clock-widget,
    .tfm-prop-grid ::ng-deep .task-clock-widget--compact { display: flex !important; width: 100% !important; }
    .tfm-prop-grid ::ng-deep .task-clock-widget__button { display: flex !important; align-items: center !important; justify-content: flex-start !important; gap: 6px !important; width: 100% !important; height: 32px !important; padding: 0 8px !important; border-radius: 6px !important; border: 1px solid transparent !important; background: transparent !important; font-size: 13px !important; font-weight: 500 !important; color: var(--color-text-primary) !important; box-shadow: none !important; cursor: pointer !important; box-sizing: border-box !important; transition: all 140ms ease !important; }
    .tfm-prop-grid ::ng-deep .task-clock-widget__button:hover:not(:disabled) { background: var(--color-surface-secondary) !important; border-color: transparent !important; color: var(--color-text-primary) !important; box-shadow: none !important; }
    .tfm-prop-grid ::ng-deep .task-clock-widget__button--active { background: color-mix(in srgb, var(--color-accent) 10%, transparent) !important; border-color: transparent !important; }
    .tfm-prop-grid ::ng-deep .task-clock-widget__button--active:hover:not(:disabled) { background: color-mix(in srgb, var(--color-accent) 16%, transparent) !important; border-color: transparent !important; }
    .tfm-clock-readonly { display: flex; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; height: 32px; padding: 0 8px; border-radius: 6px; border: 1px solid transparent; background: transparent; cursor: default; box-sizing: border-box; transition: all 140ms ease; }
    .tfm-clock-readonly:hover { background: var(--color-surface-secondary); border-color: transparent; box-shadow: none; }
    .tfm-clock-readonly__timer { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }
    .tfm-clock-readonly__timer svg { width: 14px; height: 14px; stroke: var(--color-text-secondary); fill: none; stroke-width: 2; }
    .tfm-clock-readonly__badge { font-size: 11.5px; color: var(--color-text-secondary); }

    .tfm-doc-divider { height: 1px; background: var(--color-border); margin: 6px 0 10px; }
    .tfm-doc-section { display: flex; flex-direction: column; gap: 8px; }
    .tfm-doc-section-title { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
    .tfm-doc-section-head { display: flex; align-items: center; gap: 8px; }
    .tfm-doc-section-icon { display: inline-flex; align-items: center; justify-content: center; }
    .tfm-doc-section-icon svg { width: 15px; height: 15px; stroke: var(--color-text-secondary); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .tfm-description-section { min-height: 88px; }
    .tfm-doc-count { display: inline-flex; min-width: 18px; height: 18px; align-items: center; justify-content: center; padding: 0 5px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
    .tfm-doc-section--collapsible { border: 1px solid var(--color-border); border-radius: 8px; padding: 12px 14px; background: var(--color-surface); }
    .tfm-doc-section-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; border: 0; background: transparent; padding: 0; cursor: pointer; color: var(--color-text-primary); }
    .tfm-doc-activity-body { padding-top: 12px; margin-top: 8px; border-top: 1px solid var(--color-border); }

    /* Unified Activity Hub */
    .tfm-activity-section { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--color-border); }
    .tfm-activity-header { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .tfm-activity-title { margin: 0; font-size: 17px; font-weight: 700; color: var(--color-text-primary); letter-spacing: -0.01em; }
    .tfm-activity-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .tfm-activity-tabs { display: inline-flex; align-items: center; border: 1px solid var(--color-border); border-radius: 6px; padding: 2px; background: var(--color-surface); gap: 2px; }
    .tfm-activity-tab { border: 1px solid transparent; background: transparent; padding: 5px 12px; font-size: 13px; font-weight: 500; color: var(--color-text-secondary); border-radius: 4px; cursor: pointer; transition: all 120ms ease; line-height: 1.3; font-family: inherit; }
    .tfm-activity-tab:hover { color: var(--color-text-primary); background: var(--color-surface-secondary); }
    .tfm-activity-tab--active {
      border-color: var(--color-accent);
      color: var(--color-accent);
      background: var(--color-accent-subtle, color-mix(in srgb, var(--color-accent) 14%, var(--color-surface)));
      font-weight: 600;
    }
    .tfm-activity-sort-btn { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 1px solid transparent; background: transparent; color: var(--color-text-secondary); border-radius: 6px; cursor: pointer; transition: background 120ms ease, color 120ms ease; }
    .tfm-activity-sort-btn:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .tfm-activity-feed-wrap { margin-top: 12px; }
    .tfm-activity-feed-divider { display: flex; align-items: center; margin: 20px 0 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary); }
    .tfm-activity-feed-divider::after { content: ''; flex: 1; height: 1px; background: var(--color-border); margin-left: 10px; }
    .tfm-activity-empty { margin: 0; padding: 16px; border: 1px dashed var(--color-border); border-radius: 8px; font-size: 13px; color: var(--color-text-secondary); text-align: center; }
    .tfm-actions-list { display: flex; flex-direction: column; gap: 2px; }
    .tfm-action-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      margin: 0;
      padding: 6px 10px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--color-text-secondary);
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      box-sizing: border-box;
      text-align: left;
      transition: background-color 140ms ease, color 140ms ease;
    }
    .tfm-action-row:hover {
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
    }
    .tfm-action-icon {
      width: 15px;
      height: 15px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: inherit;
    }
    .tfm-action-icon svg {
      width: 15px;
      height: 15px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    /* ==========================================================================
       ClickUp-Style Subtasks Table Section (No curved borders)
       ========================================================================== */
    .tfm-subtasks-section { display: flex; flex-direction: column; margin: 8px 0 4px; }
    .tfm-subtask-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 0 6px; }
    .tfm-subtask-header-left { display: flex; align-items: center; gap: 8px; }
    .tfm-subtask-collapse-btn { display: inline-flex; align-items: center; gap: 5px; border: none; background: transparent; padding: 3px 6px 3px 2px; border-radius: 4px; cursor: pointer; color: var(--color-text-primary); font-family: inherit; font-size: 13px; font-weight: 600; transition: background-color 120ms ease; }
    .tfm-subtask-collapse-btn:hover { background: var(--color-surface-secondary); }
    .tfm-subtask-chevron-icon { width: 12px; height: 12px; fill: currentColor; color: var(--color-text-secondary); transition: transform 160ms ease; }
    .tfm-subtask-chevron-icon--collapsed { transform: rotate(-90deg); }
    .tfm-subtask-header-title { color: var(--color-text-primary); font-size: 13px; font-weight: 600; }
    .tfm-subtask-header-meta { display: inline-flex; align-items: center; gap: 8px; font-size: 11.5px; }
    .tfm-subtask-status-pill { color: var(--color-text-secondary); font-size: 11.5px; font-weight: 500; }
    .tfm-subtask-progress { display: inline-flex; align-items: center; }
    .tfm-subtask-progress-bar { width: 50px; height: 4px; background: color-mix(in srgb, var(--color-border) 70%, transparent); border-radius: 999px; overflow: hidden; }
    .tfm-subtask-progress-fill { height: 100%; background: #22c55e; border-radius: 999px; transition: width 160ms ease; }
    .tfm-subtask-for-me-pill { background: var(--color-surface-secondary); color: var(--color-text-secondary); padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 500; }

    /* Table Header */
    .tfm-subtask-table-head { display: grid; grid-template-columns: 1fr 100px 105px 120px 36px; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--color-border); color: var(--color-text-secondary); font-size: 11px; font-weight: 500; user-select: none; }
    .tfm-subtask-col-name { padding-left: 28px; }
    .tfm-subtask-col-assignee { text-align: left; }
    .tfm-subtask-col-priority { text-align: left; }
    .tfm-subtask-col-status { text-align: left; }
    .tfm-subtask-col-actions { display: flex; justify-content: flex-end; }
    .tfm-subtask-head-add-btn { display: inline-flex; align-items: center; gap: 3px; border: none; background: transparent; padding: 2px 6px; border-radius: 4px; color: var(--color-text-secondary); font-family: inherit; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 120ms ease; }
    .tfm-subtask-head-add-btn:hover { color: var(--color-accent); background: var(--color-surface-secondary); }
    .tfm-subtask-head-add-btn svg { width: 12px; height: 12px; }

    /* Subtask Rows - Flat, ClickUp Style */
    .tfm-subtask-list { display: flex; flex-direction: column; }
    .tfm-subtask-row { display: grid; grid-template-columns: 1fr 100px 105px 120px 36px; align-items: center; gap: 8px; padding: 7px 8px; border: none; border-bottom: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent); border-radius: 0; background: transparent; cursor: pointer; user-select: none; transition: background-color 120ms ease; }
    .tfm-subtask-row:hover { background: var(--color-surface-secondary); }
    .tfm-subtask-row:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -1px; }
    .tfm-subtask-cell-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .tfm-subtask-status-btn { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: none; background: transparent; padding: 0; border-radius: 4px; cursor: pointer; flex-shrink: 0; transition: transform 120ms ease; }
    .tfm-subtask-status-btn:hover { transform: scale(1.1); }
    .tfm-subtask-dashed-circle { width: 15px; height: 15px; color: var(--color-text-secondary); opacity: 0.65; stroke: currentColor; }
    .tfm-subtask-check-circle { width: 15px; height: 15px; color: #22c55e; fill: currentColor; }
    .tfm-subtask-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 450; color: var(--color-text-primary); }
    .tfm-subtask-title--completed { text-decoration: line-through; color: var(--color-text-secondary); opacity: 0.7; }
    .tfm-subtask-cell-assignee { display: flex; align-items: center; min-width: 0; }
    .tfm-subtask-cell-priority { display: flex; align-items: center; min-width: 0; }
    .tfm-subtask-cell-status { display: flex; align-items: center; min-width: 0; }
    .tfm-subtask-anchor { position: relative; display: flex; align-items: center; }
    .tfm-subtask-cell-btn { display: inline-flex; align-items: center; border: none; background: transparent; padding: 2px 4px; border-radius: 4px; cursor: pointer; font-family: inherit; transition: background-color 120ms ease, border-color 120ms ease; max-width: 100%; }
    .tfm-subtask-cell-btn:hover { background: color-mix(in srgb, var(--color-border) 40%, transparent); }
    .tfm-subtask-assignee-btn { padding: 2px; }
    .tfm-subtask-priority-btn { padding: 2px 4px; }
    .tfm-subtask-priority-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; }
    .tfm-subtask-priority-tag[data-priority="critical"] { color: #ef4444; }
    .tfm-subtask-priority-tag[data-priority="high"] { color: #f59e0b; }
    .tfm-subtask-priority-tag[data-priority="medium"] { color: #3b82f6; }
    .tfm-subtask-priority-tag[data-priority="low"] { color: #94a3b8; }
    .tfm-subtask-priority-tag--none { color: var(--color-text-secondary); opacity: 0.5; }
    .tfm-subtask-flag-icon { width: 12px; height: 12px; flex-shrink: 0; }
    .tfm-subtask-flag-icon[data-priority="critical"] { color: #ef4444; }
    .tfm-subtask-flag-icon[data-priority="high"] { color: #f59e0b; }
    .tfm-subtask-flag-icon[data-priority="medium"] { color: #3b82f6; }
    .tfm-subtask-flag-icon[data-priority="low"] { color: #94a3b8; }
    .tfm-subtask-status-pill-btn { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 2px 6px; border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent); border-radius: 4px; background: var(--color-surface); cursor: pointer; transition: all 120ms ease; max-width: 110px; }
    .tfm-subtask-status-pill-btn:hover { background: var(--color-surface-secondary); border-color: var(--color-border); }
    .tfm-subtask-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .tfm-subtask-status-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; font-weight: 500; color: var(--color-text-secondary); }
    .tfm-subtask-caret { width: 9px; height: 9px; color: var(--color-text-secondary); opacity: 0.7; flex-shrink: 0; }
    .tfm-subtask-cell-actions { display: flex; align-items: center; justify-content: flex-end; }
    .tfm-subtask-remove-draft-btn { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: none; background: transparent; color: var(--color-text-secondary); opacity: 0; cursor: pointer; border-radius: 4px; transition: opacity 120ms ease, color 120ms ease, background-color 120ms ease; }
    .tfm-subtask-row:hover .tfm-subtask-remove-draft-btn { opacity: 0.7; }
    .tfm-subtask-remove-draft-btn:hover { opacity: 1 !important; color: #ef4444; background: var(--color-surface-secondary); }
    .tfm-subtask-remove-draft-btn svg { width: 14px; height: 14px; }
    .tfm-subtask-chevron { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; color: var(--color-text-secondary); opacity: 0; transition: opacity 120ms ease, transform 120ms ease; }
    .tfm-subtask-chevron svg { width: 14px; height: 14px; }
    .tfm-subtask-row:hover .tfm-subtask-chevron { opacity: 0.8; transform: translateX(2px); }

    /* Add Task Trigger Row */
    .tfm-subtask-add-trigger { display: flex; align-items: center; gap: 6px; width: 100%; border: none; background: transparent; padding: 8px 8px; color: var(--color-text-secondary); font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; text-align: left; border-radius: 4px; transition: color 120ms ease, background-color 120ms ease; }
    .tfm-subtask-add-trigger:hover { color: var(--color-accent); background: var(--color-surface-secondary); }
    .tfm-subtask-add-trigger svg { width: 13px; height: 13px; flex-shrink: 0; }

    /* Inline Subtask Creation Row (ClickUp Style single row) */
    .tfm-subtask-inline-create { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 38px; padding: 4px 10px; background: var(--color-surface, #ffffff); border: 1px solid var(--color-border, #e2e8f0); border-radius: 6px; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); margin: 4px 0 6px; box-sizing: border-box; }
    .tfm-subtask-create-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .tfm-subtask-create-status-icon { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; color: var(--color-text-secondary); opacity: 0.65; flex-shrink: 0; }
    .tfm-subtask-inline-title { flex: 1; min-width: 0; border: none; outline: none; background: transparent; font-family: inherit; font-size: 13px; color: var(--color-text-primary); padding: 2px 0; }
    .tfm-subtask-inline-title::placeholder { color: var(--color-text-secondary); opacity: 0.7; }
    .tfm-subtask-create-right { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
    .tfm-subtask-module-cube-icon { width: 15px; height: 15px; }
    .tfm-subtask-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: none; background: transparent; border-radius: 4px; color: var(--color-text-secondary); cursor: pointer; padding: 0; transition: background-color 120ms ease, color 120ms ease; }
    .tfm-subtask-icon-btn:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .tfm-subtask-icon-btn--active { color: var(--color-accent, #3b82f6); }
    .tfm-subtask-icon-btn svg { width: 15px; height: 15px; }
    .tfm-subtask-inline-divider { width: 1px; height: 16px; background: var(--color-border); margin: 0 3px; }
    .tfm-subtask-date-label { display: inline-flex; align-items: center; height: 26px; padding: 0 6px; font-size: 12px; font-weight: 500; white-space: nowrap; }
    .tfm-subtask-btn-cancel { height: 26px; padding: 0 8px; border: none; background: transparent; color: var(--color-text-secondary); font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer; border-radius: 4px; transition: background-color 120ms ease, color 120ms ease; }
    .tfm-subtask-btn-cancel:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .tfm-subtask-btn-save { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border: none; border-radius: 6px; background: #1e293b; color: #ffffff; font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer; transition: opacity 120ms ease, background-color 120ms ease; }
    .tfm-subtask-btn-save:hover:not(:disabled) { background: #0f172a; }
    .tfm-subtask-btn-save:disabled { opacity: 0.45; cursor: not-allowed; }
    .tfm-subtask-enter-symbol { font-size: 11px; opacity: 0.8; }
    .tfm-subtask-divider { height: 1px; background: var(--color-border); margin: 8px 0 12px; }
    .tfm__error { margin: 0; font-size: 13px; color: var(--color-danger-text, var(--color-danger)); }
    .tfm__foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 14px 30px; border-top: 1px solid var(--color-border); background: var(--color-surface); }
    .tfm--create .tfm__foot { border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; position: relative; z-index: 10; }
    .tfm__foot app-button { display: flex; }
    .tfm__foot ::ng-deep app-button > button {
      width: auto;
      height: 30px;
      padding: 0 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }

    /* Task Editor - Level 1: Title & Description */
    .tfm-level1 { display: flex; flex-direction: column; gap: 14px; }
    .tfm-title-block { display: flex; flex-direction: column; gap: 4px; }
    .tfm-title-input { width: 100%; border: 1px solid transparent; border-radius: 8px; padding: 10px 8px; font-size: 18px; font-weight: 650; color: var(--color-text-primary); background: transparent; outline: none; transition: background-color 140ms ease, border-color 150ms ease; }
    .tfm-title-input:hover:not(:focus) { background: var(--color-surface-secondary); border-color: transparent; }
    .tfm-title-input:focus { background: transparent; border-color: var(--color-border); box-shadow: none; }
    .tfm-title-input--error { border-color: var(--color-danger); }
    .tfm-title-error { font-size: 12px; }

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
    .tfm-popover-container { position: absolute; top: calc(100% + 6px); left: 0; z-index: 1000; animation: tfm-popover-in 120ms ease-out; }
    .tfm-popover-container--up { top: auto; bottom: calc(100% + 6px); animation: tfm-popover-in-up 120ms ease-out; }
    .tfm-popover { position: absolute; top: calc(100% + 6px); left: 0; z-index: 1000; min-width: 220px; max-width: 320px; max-height: 280px; overflow-y: auto; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-surface); padding: 6px; box-shadow: 0 14px 34px rgb(15 23 42 / .18); animation: tfm-popover-in 120ms ease-out; }
    .tfm-popover--up { top: auto; bottom: calc(100% + 6px); box-shadow: 0 -10px 30px rgb(15 23 42 / .16); animation: tfm-popover-in-up 120ms ease-out; }
    .tfm-popover--right { left: auto; right: 0; }
    .tfm-popover__list { display: flex; flex-direction: column; gap: 2px; }
    .tfm-popover__item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: 0; border-radius: 7px; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; cursor: pointer; text-align: left; transition: background-color 120ms ease; white-space: nowrap; }
    .tfm-popover__item:hover { background: var(--color-surface-secondary); }
    .tfm-popover__item--selected { background: color-mix(in srgb, var(--color-accent) 8%, transparent); color: var(--color-accent); }
    .tfm-popover__item--selected:hover { background: color-mix(in srgb, var(--color-accent) 14%, transparent); }
    .tfm-popover__item--danger { color: var(--color-danger-text); }
    .tfm-popover__item--danger:hover { background: color-mix(in srgb, var(--color-danger) 8%, transparent); }
    .tfm-popover__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tfm-popover__check { width: 14px; height: 14px; stroke: var(--color-accent); fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; margin-left: auto; }
    .tfm-popover__search-box { display: flex; align-items: center; gap: 6px; padding: 6px 10px; margin-bottom: 4px; border-bottom: 1px solid var(--color-border); }
    .tfm-popover__search-box svg { width: 14px; height: 14px; stroke: var(--color-text-secondary); fill: none; stroke-width: 2; flex-shrink: 0; }
    .tfm-popover__search-box input { flex: 1; border: 0; outline: none; background: transparent; font: inherit; font-size: 13px; color: var(--color-text-primary); }
    /* Priority Dots */
    .tfm-dot { width: 9px; height: 9px; border-radius: 9999px; flex-shrink: 0; }
    .tfm-dot--low { background: #3b82f6; }
    .tfm-dot--med { background: #eab308; }
    .tfm-dot--high { background: #f97316; }
    .tfm-dot--crit { background: #ef4444; }
    .tfm-dot--unset { background: transparent; border: 1.5px solid var(--color-border, #94a3b8); }

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
    .tfm-split-btn { display: inline-flex; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgb(15 23 42 / .06); }
    .tfm-split-btn__main { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border: 0; background: var(--color-accent); color: var(--color-accent-contrast); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: opacity 140ms ease; }
    .tfm-split-btn__main:hover { filter: brightness(0.95); }
    .tfm-split-btn__main:disabled { opacity: .6; cursor: not-allowed; }
    .tfm-split-btn__arrow { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 30px; border: 0; border-left: 1px solid color-mix(in srgb, var(--color-accent-contrast) 25%, transparent); background: var(--color-accent); color: var(--color-accent-contrast); cursor: pointer; transition: opacity 140ms ease; }
    .tfm-split-btn__arrow:hover { filter: brightness(0.95); }
    .tfm-split-btn__arrow svg { width: 13px; height: 13px; stroke: currentColor; fill: none; stroke-width: 2; }
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
  private readonly fileApi = inject(FileApiService, { optional: true });
  private readonly notificationService = inject(NotificationService);
  private readonly unsaved = inject(UnsavedChangesService);
  private readonly taskDraftApi = inject(TaskDraftApiService);
  private readonly draftsStore = inject(DraftsStore);

  readonly open = input(false);
  readonly mode = input<TaskFormMode>('create');
  readonly projectId = input.required<string>();
  readonly taskId = input<string>('');
  readonly prefillModuleId = input<string>('');
  readonly prefillSprintId = input<string>('');
  /** Create mode only: resume this saved draft instead of starting from a blank form. */
  readonly draftId = input<string>('');

  readonly closed = output<void>();
  readonly created = output<string>();
  readonly saved = output<void>();
  /**
   * An in-place change made while the modal stays open (subtask edits, clock-in). Hosts should
   * refresh their data but keep the modal open - unlike `saved`, which hosts treat as "done".
   */
  readonly changed = output<void>();
  readonly taskSelected = output<string>();

  internalMode = signal<TaskFormMode | null>(null);
  currentEffectiveMode = computed(() => this.internalMode() ?? this.mode());

  activeTaskId = signal<string>('');
  currentTaskId = computed(() => this.activeTaskId() || this.taskId());
  parentTask = signal<WorkTask | null>(null);
  private lastInputTaskId = '';

  task = signal<WorkTask | null>(null);
  currentEmployeeId = computed(() => this.currentEmployee.id());
  draftSubtasks = signal<{ id: string; title: string; priority?: WorkTask['priority']; dueDate?: string; assigneeEmployeeId?: string; objectiveId?: string; categoryId?: string }[]>([]);
  subtasks = computed(() => {
    const map = this.boardStore.subtasksByParentId?.();
    const id = this.task()?.id;
    return map && id ? (map[id] ?? []) : [];
  });
  displayedSubtasks = computed<readonly WorkTask[]>(() => {
    if (this.currentEffectiveMode() === 'create') {
      const defaultStatusId = this.statuses()[0]?.id ?? '';
      return this.draftSubtasks().map((ds) => ({
        id: ds.id,
        objectiveId: ds.objectiveId || this.selectedObjectiveId(),
        shortId: '',
        title: ds.title,
        description: null,
        categoryId: ds.categoryId || this.categoryId() || this.task()?.categoryId || '',
        statusId: defaultStatusId,
        priority: (ds.priority || 'medium') as WorkTask['priority'],
        storyPoints: null,
        dueDate: ds.dueDate ? new Date(ds.dueDate) : null,
        estimatedHours: null,
        completedHours: 0,
        progressPercent: 0,
        sprintId: null,
        assigneeEmployeeIds: ds.assigneeEmployeeId ? [ds.assigneeEmployeeId] : [],
        openClockSessionEmployeeId: null,
        openClockSessionClockInAt: null,
        totalLoggedMinutes: 0,
        attachments: [],
        assignees: ds.assigneeEmployeeId ? [{
          employeeId: ds.assigneeEmployeeId,
          name: this.getSubtaskAssigneeName(ds.assigneeEmployeeId),
          avatarUrl: this.getSubtaskAssigneeAvatarUrl(ds.assigneeEmployeeId)
        }] : [],
        parentTaskId: null,
        subtaskTotalCount: 0,
        subtaskCompletedCount: 0,
        subtaskAssigneeEmployeeIds: ds.assigneeEmployeeId ? [ds.assigneeEmployeeId] : [],
        createdAt: new Date(),
        hasPendingApproval: false
      }));
    }
    return this.subtasks();
  });
  subtaskCompletedCount = computed(() =>
    this.displayedSubtasks().filter((s) => this.statuses().find((st) => st.id === s.statusId)?.marksTaskComplete).length
  );
  subtasksCollapsed = signal(false);
  openSubtasksCount = computed(() => this.displayedSubtasks().length - this.subtaskCompletedCount());
  subtaskProgressPercent = computed(() => {
    const total = this.displayedSubtasks().length;
    return total === 0 ? 0 : Math.round((this.subtaskCompletedCount() / total) * 100);
  });
  forMeSubtasksCount = computed(() => {
    const me = this.currentEmployeeId();
    if (!me) return 0;
    return this.displayedSubtasks().filter((s) => s.assigneeEmployeeIds.includes(me)).length;
  });

  addingSubtask = signal(false);
  newSubtaskTitle = signal('');
  newSubtaskDueDate = signal('');
  newSubtaskAssigneeId = signal<string | null>(null);
  newSubtaskPriority = signal<WorkTask['priority'] | null>(null);
  newSubtaskModuleId = signal<string>('');
  newSubtaskCategoryId = signal<string>('');
  activeSubtaskPopover = signal<{ id: string; type: 'assignee' | 'priority' | 'status' | 'module' | 'category' | 'tag' | 'date' } | null>(null);

  statuses = signal<TaskStatusColumn[]>([]);
  categories = signal<TaskCategoryColumn[]>([]);
  history = signal<TaskHistoryEntryDto[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);

  title = signal('');
  description = signal('');
  priority = signal<WorkTask['priority'] | null>(null);
  dueDate = signal('');
  estimatedHours = signal<number | null>(null);
  storyPoints = signal<number | null>(null);
  progressPercent = signal<number | null>(null);
  reason = signal('');
  statusId = signal('');

  modules = signal<readonly { objectiveId: string; title: string; isOwner: boolean }[]>([]);
  selectedObjectiveId = signal('');
  // Edit mode never populates `modules` (that's create-mode-only, see loadCreateContext) -
  // projectStore.milestones() is this component's edit-mode source of truth for which modules
  // the caller can reach, already used by isObjectiveOwner/canEditTaskDirectly above. Guarded on
  // task() first, same as those two, so this stays inert (and never touches the store) before a
  // task has loaded or in create mode - this binding is evaluated on every render regardless of
  // whether the duplicate dialog is open, unlike those two which only feed conditionally-rendered UI.
  duplicateModuleOptions = computed(() => {
    if (!this.task()) return [];
    return this.projectStore.milestones().filter((m) => m.isOwner).map((m) => ({ objectiveId: m.objectiveId, title: m.title }));
  });
  deleteConfirmMessage = computed(() =>
    `"${this.task()?.title || 'This task'}" will be permanently deleted. This can't be undone.`
  );
  createdAtLabel = computed(() => {
    const t = this.task();
    if (!t) return '';
    return `Created ${t.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  });
  deleteConfirmOpen = signal(false);
  deleteLoading = signal(false);
  deleteError = signal('');
  duplicateDialogOpen = signal(false);
  duplicateLoading = signal(false);
  duplicateError = signal<string | null>(null);
  convertToSubtaskDialogOpen = signal(false);
  convertToSubtaskLoading = signal(false);
  convertToSubtaskError = signal<string | null>(null);
  // Only top-level tasks can be picked as the new parent (one-level nesting rule - see
  // ConvertTaskToSubtaskCommandHandler) - boardStore.tasks() already excludes subtasks, since
  // GetProjectTasksQuery only returns tasks with no ParentTaskId. Completed tasks are excluded too -
  // converting into a task that's already done isn't a useful target.
  convertToSubtaskCandidates = computed<readonly TaskConvertToSubtaskCandidate[]>(() => {
    const currentTaskId = this.task()?.id;
    const statuses = this.statuses();
    return (this.boardStore.tasks?.() ?? [])
      .filter((t) => t.id !== currentTaskId && !statuses.find((st) => st.id === t.statusId)?.marksTaskComplete)
      .map((t) => ({ id: t.id, shortId: t.shortId, title: t.title }));
  });
  sprints = signal<readonly Sprint[]>([]);
  sprintId = signal('');
  assignableMembers = signal<readonly { employeeId: string; name: string; avatarUrl: string | null }[]>([]);
  assigneeEmployeeId = signal('');
  private originalAssigneeId = signal('');
  // The task's own server-resolved assignee identities (name/avatar) - always correct regardless
  // of the viewer's milestone scope, unlike assignableMembers() which is scoped for the picker.
  private taskAssigneeIdentities = signal<readonly TaskAssigneeIdentity[]>([]);
  categoryId = signal('');
  allocationHint = signal<InsufficientAllocationErrorDto | null>(null);

  submitting = signal(false);
  errors = signal<Record<string, string>>({});

  // Project monitor: "can the assignee still finish everything due by this date?" Advisory only -
  // it never disables saving.
  private readonly monitorApi = inject(ProjectMonitorApiService);
  readonly loadWarnings = signal<readonly MonitorWarningDto[]>([]);
  private loadCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private loadCheckVersion = 0;
  private readonly loadCheckEffect = effect(() => {
    const projectId = this.open() ? this.projectId() : '';
    const request = {
      taskId: this.mode() === 'create' ? null : this.activeTaskId() || null,
      assigneeEmployeeIds: this.assigneeEmployeeId() ? [this.assigneeEmployeeId()] : [],
      dueDate: this.dueDate() || null,
      estimatedHours: this.estimatedHours()
    };
    untracked(() => this.scheduleLoadCheck(projectId, request));
  });
  private readonly loadCheckCleanup = inject(DestroyRef).onDestroy(() => this.clearLoadCheckTimer());

  private scheduleLoadCheck(projectId: string, request: {
    taskId: string | null; assigneeEmployeeIds: string[]; dueDate: string | null; estimatedHours: number | null;
  }): void {
    this.clearLoadCheckTimer();
    const version = ++this.loadCheckVersion;
    if (!projectId || request.assigneeEmployeeIds.length === 0 || !request.dueDate || !(Number(request.estimatedHours) > 0)) {
      this.loadWarnings.set([]);
      return;
    }
    this.loadCheckTimer = setTimeout(async () => {
      try {
        const result = await firstValueFrom(this.monitorApi.checkTask(projectId, request));
        if (version === this.loadCheckVersion) this.loadWarnings.set(result.warnings ?? []);
      } catch {
        if (version === this.loadCheckVersion) this.loadWarnings.set([]);
      }
    }, MONITOR_CHECK_DEBOUNCE_MS);
  }

  private clearLoadCheckTimer(): void {
    if (this.loadCheckTimer !== null) clearTimeout(this.loadCheckTimer);
    this.loadCheckTimer = null;
  }
  errorMessage = signal<string | null>(null);

  activePopover = signal<'assignee' | 'priority' | 'dueDate' | 'module' | 'sprint' | 'category' | 'splitMenu' | 'status' | 'headerCategory' | 'headerModule' | 'headerMore' | null>(null);
  showActivityLog = signal(true);
  showComments = signal(true);
  activityTab = signal<'all' | 'comments' | 'history' | 'work_log'>('comments');
  activitySortOrder = signal<'desc' | 'asc'>('desc');

  setActivityTab(tab: 'all' | 'comments' | 'history' | 'work_log'): void {
    this.activityTab.set(tab);
  }

  toggleActivitySort(): void {
    this.activitySortOrder.update((curr) => (curr === 'desc' ? 'asc' : 'desc'));
  }

  sortedHistoryEntries = computed(() => {
    const list = [...this.history()];
    const order = this.activitySortOrder();
    return list.sort((a, b) => {
      const timeA = new Date(a.occurredAt).getTime();
      const timeB = new Date(b.occurredAt).getTime();
      return order === 'desc' ? timeB - timeA : timeA - timeB;
    });
  });

  workLogEntries = computed(() => {
    return this.sortedHistoryEntries().filter((e) => e.type === 'clock_session');
  });

  showMoreFields = signal(true);
  moduleSearchQuery = signal('');
  successToastMessage = signal<string | null>(null);
  attachedFiles = signal<AttachmentPill[]>([]);

  private loadedKey = '';
  private readonly dialogRef = viewChild<ElementRef<HTMLElement>>('tfm');
  readonly taskTitleInput = viewChild<ElementRef<HTMLInputElement>>('taskTitleInput');
  readonly descRte = viewChild<RichTextEditorComponent>('descRte');
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
    if (this.currentEffectiveMode() === 'create') return this.selectedModuleIsOwner() ? 'Create work item' : 'Create request';
    return this.canEditTaskDirectly() ? 'Save changes' : 'Request changes';
  });

  isObjectiveOwner = computed(() => {
    const t = this.task();
    if (!t) return false;
    return this.projectStore.milestones().find((m) => m.objectiveId === t.objectiveId)?.isOwner ?? false;
  });
  // Label hint only ("Save changes" vs "Request changes"): the backend's approval engine decides
  // whether an edit applies now or needs approval, and the save always calls editTask.
  canEditTaskDirectly = computed(() => {
    const t = this.task();
    if (!t) return false;
    return this.projectStore.milestones().find((m) => m.objectiveId === t.objectiveId)?.isEffectiveOwner ?? false;
  });
  isAssignee = computed(() => {
    const t = this.task();
    return !!t && t.assigneeEmployeeIds.includes(this.currentEmployeeId());
  });
  // The current assignee may sit in a milestone outside what the viewer's assignableMembers()
  // scope reaches (e.g. assigned by someone with broader access), so the picker's option list
  // alone can't be trusted to resolve the display name. Prefer the task's own server-resolved
  // identity (always correct, whoever is viewing) and fall back to the full, unscoped project
  // roster before giving up and showing the raw employeeId.
  private readonly rosterAssignee = computed(() => {
    const id = this.assigneeEmployeeId();
    if (!id) return null;
    return this.projectStore.project()?.members.find((m) => m.userId === id) ?? null;
  });
  assigneeName = computed(() => {
    const id = this.assigneeEmployeeId();
    if (!id) return 'Unassigned';
    return (
      this.assignableMembers().find((m) => m.employeeId === id)?.name ??
      this.taskAssigneeIdentities().find((a) => a.employeeId === id)?.name ??
      this.rosterAssignee()?.displayName ??
      id
    );
  });
  assigneeAvatarUrl = computed(() => {
    const id = this.assigneeEmployeeId();
    if (!id) return null;
    const scopedUrl = this.assignableMembers().find((m) => m.employeeId === id)?.avatarUrl;
    if (scopedUrl) return scopedUrl;
    const taskUrl = this.taskAssigneeIdentities().find((a) => a.employeeId === id)?.avatarUrl;
    if (taskUrl) return taskUrl;
    const rosterFileId = this.rosterAssignee()?.avatarFileId;
    return rosterFileId && this.fileApi ? this.fileApi.getFileUrl(rosterFileId) : null;
  });

  priorityDetails = computed(() => {
    const p = this.priority();
    switch (p) {
      case 'low': return { label: 'Low', dotClass: 'tfm-dot--low' };
      case 'medium': return { label: 'Medium', dotClass: 'tfm-dot--med' };
      case 'high': return { label: 'High', dotClass: 'tfm-dot--high' };
      case 'critical': return { label: 'Critical', dotClass: 'tfm-dot--crit' };
      default: return { label: 'Priority', dotClass: 'tfm-dot--unset' };
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

  formattedSubtaskDueDate = computed(() => {
    const d = this.newSubtaskDueDate();
    if (!d) return '';
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

  filteredModules = computed(() => {
    const q = this.moduleSearchQuery().toLowerCase().trim();
    const list = this.modules();
    if (!q) return list;
    return list.filter((m) => m.title.toLowerCase().includes(q));
  });

  availableSprints = computed(() => this.sprints().filter((s) => s.status === 'draft' || s.status === 'active'));

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
    const id = this.categoryId() || this.task()?.categoryId;
    if (!id) return '';
    return this.categories().find((c) => c.id === id)?.name ?? id;
  });
  availableStatuses = computed(() =>
    [...this.statuses()]
      .filter((s) => s.visibility === 'public' || this.isObjectiveOwner())
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  projectTitle = computed(() => this.projectStore.project?.()?.name || '');
  currentStatus = computed(() => this.statuses().find((s) => s.id === this.statusId()) ?? null);
  currentStatusName = computed(() => this.currentStatus()?.name ?? 'Status');

  totalTimeLabelForReadonly = computed(() => {
    const t = this.task();
    if (!t) return '00:00';
    const totalSeconds = (t.totalLoggedMinutes || 0) * 60;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value: number) => value.toString().padStart(2, '0');
    return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  });

  selectStatus(statusId: string): void {
    this.statusId.set(statusId);
    this.activePopover.set(null);
  }

  selectSprint(sprintId: string): void {
    this.sprintId.set(sprintId);
    this.activePopover.set(null);
  }

  selectCategory(categoryId: string): void {
    this.categoryId.set(categoryId);
    this.activePopover.set(null);
  }

  constructor() {
    void this.currentEmployee.ensureLoaded();
    effect(() => {
      const isOpen = this.open();
      const inputId = this.taskId();
      if (!isOpen) {
        this.loadedKey = '';
        this.activeTaskId.set('');
        this.parentTask.set(null);
        this.lastInputTaskId = '';
        return;
      }
      if (inputId !== this.lastInputTaskId) {
        this.lastInputTaskId = inputId;
        if (inputId && inputId !== this.activeTaskId()) {
          this.activeTaskId.set(inputId);
        }
      }
      const effectiveId = this.activeTaskId() || inputId;
      const key = `${this.mode()}:${effectiveId}:${this.draftId()}:${isOpen}`;
      if (key === this.loadedKey) return;
      this.loadedKey = key;
      untracked(() => {
        this.resetForm();
        if (this.mode() === 'create') void this.loadCreateContext();
        else void this.loadForTaskId(effectiveId);
      });
    });
    effect(() => {
      const shouldGuard = this.open() && this.mode() === 'create';
      untracked(() => {
        if (shouldGuard && !this.unregisterGuard) this.unregisterGuard = this.unsaved.register(this.guardHandle);
        if (!shouldGuard && this.unregisterGuard) {
          this.unregisterGuard();
          this.unregisterGuard = null;
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.unregisterGuard?.());
    effect(() => {
      if (this.open()) {
        this.previouslyFocused = document.activeElement as HTMLElement;
        this.dialogRef()?.nativeElement.focus();
      } else if (this.previouslyFocused) {
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    });
    // Edit mode never runs loadCreateContext (the only place that used to populate `modules`),
    // so the header module-switcher always looked empty/unselected here. Keep it in sync from
    // projectStore.milestones() instead - the same edit-mode source of truth already used by
    // isObjectiveOwner/canEditTaskDirectly/duplicateModuleOptions above - reactively, so it also
    // self-corrects if milestones finishes loading after this modal has already opened.
    effect(() => {
      if (this.currentEffectiveMode() !== 'edit') return;
      const milestones = this.projectStore.milestones();
      this.modules.set(milestones.map((m) => ({ objectiveId: m.objectiveId, title: m.title, isOwner: m.isOwner })));
    });
  }

  private resetForm(): void {
    this.task.set(null);
    this.title.set('');
    this.description.set('');
    this.descRte()?.clear();
    this.priority.set(null);
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
    this.taskAssigneeIdentities.set([]);
    this.categoryId.set('');
    this.allocationHint.set(null);
    this.errors.set({});
    this.errorMessage.set(null);
    this.internalMode.set(null);
    this.activePopover.set(null);
    this.successToastMessage.set(null);
    this.attachedFiles.set([]);
    this.moduleSearchQuery.set('');
    this.showMoreFields.set(true);
    this.draftSubtasks.set([]);
    this.cancelAddSubtask();
    this.activeDraftId.set(null);
    this.savedDraftAttachmentIds = new Set();
    this.baseline = null;
  }

  private async load(): Promise<void> {
    await this.loadForTaskId(this.currentTaskId());
  }

  async loadForTaskId(taskId: string): Promise<void> {
    if (!taskId) return;
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [taskDto, statusDtos, categoryDtos, sprintDtos, historyEntries] = await Promise.all([
        firstValueFrom(this.taskApi.getTaskById(taskId)),
        firstValueFrom(this.taskApi.getStatuses(this.projectId())),
        firstValueFrom(this.taskApi.getCategories(this.projectId())),
        firstValueFrom(this.sprintApi.getByProject(this.projectId())),
        firstValueFrom(this.taskApi.getTaskHistory(taskId))
      ]);
      const t = toWorkTask(taskDto);
      this.task.set(t);

      if (t.parentTaskId) {
        const parentFromStore = this.boardStore.tasks?.().find((task) => task.id === t.parentTaskId);
        if (parentFromStore) {
          this.parentTask.set(parentFromStore);
        } else if (!this.parentTask() || this.parentTask()?.id !== t.parentTaskId) {
          try {
            const parentDto = await firstValueFrom(this.taskApi.getTaskById(t.parentTaskId));
            this.parentTask.set(toWorkTask(parentDto));
          } catch {
            this.parentTask.set(null);
          }
        }
      } else {
        this.parentTask.set(null);
      }

      if (this.boardStore.loadSubtasks && !t.parentTaskId) {
        void this.boardStore.loadSubtasks(t.id);
      }
      this.statuses.set(statusDtos);
      this.categories.set(categoryDtos.map(toTaskCategoryColumn));
      this.sprints.set(sprintDtos.map(toSprint));
      this.history.set(historyEntries);
      this.seedForm(t);
      await this.loadMembers();
    } catch {
      this.loadError.set('Failed to load this task.');
    } finally {
      this.loading.set(false);
    }
  }

  async shareTask(): Promise<void> {
    const taskId = this.currentTaskId();
    const projectId = this.projectId();
    if (!taskId || !projectId) {
      this.notificationService.error('Unable to create a task link.');
      return;
    }

    const copied = await copyTextToClipboard(buildTaskDeepLink(window.location.origin, projectId, taskId));
    if (copied) this.notificationService.success('Task link copied to clipboard.');
    else this.notificationService.error('Unable to copy the task link.');
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
      const knownModules = new Map<string, { objectiveId: string; title: string; isOwner: boolean }>();
      for (const m of milestones) {
        knownModules.set(m.objectiveId, { objectiveId: m.objectiveId, title: m.title, isOwner: m.isOwner });
      }
      for (const m of this.projectStore.milestones()) {
        if (!knownModules.has(m.objectiveId)) {
          knownModules.set(m.objectiveId, { objectiveId: m.objectiveId, title: m.title, isOwner: m.isOwner });
        }
      }
      this.modules.set(Array.from(knownModules.values()));
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
        const activeSprints = this.sprints().filter((s) => s.status === 'active');
        if (activeSprints.length === 1) {
          this.sprintId.set(activeSprints[0].id);
        }
      }

      await this.loadMembers();

      const draftId = this.draftId();
      if (draftId) {
        try {
          this.applyDraft(await firstValueFrom(this.taskDraftApi.get(draftId)));
        } catch {
          this.errorMessage.set('This draft could not be loaded. It may have been deleted.');
        }
      }
    } catch {
      this.loadError.set('Failed to load the task form.');
    } finally {
      this.loading.set(false);
      this.markClean();
    }
  }

  private applyDraft(draft: TaskDraft): void {
    const p = draft.payload;
    this.activeDraftId.set(draft.id);
    this.title.set(draft.title);
    this.description.set(p.description ?? '');
    this.descRte()?.setHtml(p.description ?? '');
    if (p.objectiveId) this.selectedObjectiveId.set(p.objectiveId);
    this.sprintId.set(p.sprintId ?? '');
    if (p.categoryId) this.categoryId.set(p.categoryId);
    this.statusId.set(p.statusId ?? '');
    this.priority.set(p.priority ?? null);
    this.dueDate.set(p.dueDate ?? '');
    this.estimatedHours.set(p.estimatedHours ?? null);
    this.storyPoints.set(p.storyPoints ?? null);
    this.assigneeEmployeeId.set(p.assigneeEmployeeId ?? '');
    this.draftSubtasks.set([...(p.subtasks ?? [])]);
    this.attachedFiles.set((p.attachments ?? []).map((a) => ({ ...a })));
    this.savedDraftAttachmentIds = new Set(p.attachmentFileIds ?? []);
  }

  // ---- Drafts + unsaved-changes guard (create mode) ----

  private readonly activeDraftId = signal<string | null>(null);
  private savedDraftAttachmentIds = new Set<string>();
  private baseline: string | null = null;
  private unregisterGuard: (() => void) | null = null;

  /** The rich-text editor can leave empty markup behind; treat that as no description. */
  private normalizeDescription(html: string): string {
    if (/<(img|video|iframe|table)\b/i.test(html)) return html;
    const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
    return text ? html : '';
  }

  private buildDraftPayload(): TaskDraftPayload {
    const settled = this.attachedFiles().filter((f) => !f.uploading);
    return {
      version: 1,
      description: this.normalizeDescription(this.description()),
      objectiveId: this.selectedObjectiveId(),
      sprintId: this.sprintId(),
      categoryId: this.categoryId(),
      statusId: this.statusId(),
      priority: this.priority(),
      dueDate: this.dueDate(),
      estimatedHours: this.estimatedHours(),
      storyPoints: this.storyPoints(),
      assigneeEmployeeId: this.assigneeEmployeeId(),
      subtasks: this.draftSubtasks(),
      attachments: settled.map(({ fileId, name, sizeBytes }) => ({ fileId, name, sizeBytes })),
      attachmentFileIds: settled.map((f) => f.fileId)
    };
  }

  private snapshot(): string {
    return JSON.stringify([this.title().trim(), this.buildDraftPayload()]);
  }

  private markClean(): void {
    this.baseline = this.snapshot();
  }

  private readonly guardHandle: DirtyFormHandle = {
    isDirty: () => this.currentEffectiveMode() === 'create' && this.baseline !== null && this.snapshot() !== this.baseline,
    canSaveDraft: () => this.currentEffectiveMode() === 'create',
    saveDraft: () => this.saveAsDraft(),
    discard: () => this.cleanupUnsavedAttachments()
  };

  private async saveAsDraft(): Promise<boolean> {
    const payload = this.buildDraftPayload();
    const title = this.title().trim();
    try {
      const id = this.activeDraftId();
      const saved = await firstValueFrom(id
        ? this.taskDraftApi.update(id, this.projectId(), title, payload)
        : this.taskDraftApi.create(this.projectId(), title, payload));
      this.activeDraftId.set(saved.id);
      this.savedDraftAttachmentIds = new Set(payload.attachmentFileIds);
      this.markClean();
      void this.draftsStore.load();
      return true;
    } catch {
      return false;
    }
  }

  private async attemptClose(): Promise<void> {
    const dirty = this.guardHandle.isDirty();
    if (!(await this.unsaved.requestClose(this.guardHandle))) return;
    if (!dirty) this.cleanupUnsavedAttachments(); // dirty paths already discarded or saved the files into a draft
    this.closed.emit();
  }

  /** After a successful create the draft it came from is obsolete. Best effort, never blocks the create. */
  private async finishDraftAfterCreate(detachFiles: boolean): Promise<void> {
    const id = this.activeDraftId();
    if (!id) return;
    const detached: TaskDraftPayload = { ...this.buildDraftPayload(), attachments: [], attachmentFileIds: [] };
    const title = this.title().trim();
    this.activeDraftId.set(null);
    this.savedDraftAttachmentIds = new Set();
    try {
      // A creation *request* has no task yet, so its files are still plain pending uploads; deleting the
      // draft would delete them. Detach them from the draft first.
      if (detachFiles) await firstValueFrom(this.taskDraftApi.update(id, this.projectId(), title, detached));
      await firstValueFrom(this.taskDraftApi.remove(id));
    } catch {
      /* the draft lingers in the bar; the user can delete it there */
    }
    void this.draftsStore.load();
  }

  private async loadMembers(): Promise<void> {
    await this.projectStore.loadProjectMembers(this.projectId());
    this.assignableMembers.set(
      this.projectStore.projectMembers().map((m) => ({
        employeeId: m.employeeId,
        name: m.name ?? 'Unknown employee',
        avatarUrl: (m as { avatarUrl?: string | null; avatarFileId?: string | null }).avatarUrl ?? (m.avatarFileId && this.fileApi ? this.fileApi.getFileUrl(m.avatarFileId) : null)
      }))
    );
  }

  private seedForm(t: WorkTask): void {
    this.title.set(t.title);
    this.description.set(t.description ?? '');
    this.descRte()?.setHtml(t.description ?? '');
    this.priority.set(t.priority);
    this.dueDate.set(t.dueDate ? t.dueDate.toISOString().slice(0, 10) : '');
    this.estimatedHours.set(t.estimatedHours);
    this.storyPoints.set(t.storyPoints);
    this.progressPercent.set(t.progressPercent);
    this.reason.set('');
    this.statusId.set(t.statusId);
    this.selectedObjectiveId.set(t.objectiveId);
    this.categoryId.set(t.categoryId ?? '');
    this.sprintId.set(t.sprintId ?? '');
    const currentAssignee = t.assigneeEmployeeIds[0] ?? '';
    this.assigneeEmployeeId.set(currentAssignee);
    this.originalAssigneeId.set(currentAssignee);
    this.taskAssigneeIdentities.set(t.assignees ?? []);
    this.attachedFiles.set(t.attachments.map((a) => ({ fileId: a.fileId, name: a.name, sizeBytes: a.sizeBytes })));
    this.errors.set({});
    this.errorMessage.set(null);
  }

  async reloadHistory(): Promise<void> {
    const id = this.currentTaskId();
    if (!id) return;
    try {
      this.history.set(await firstValueFrom(this.taskApi.getTaskHistory(id)));
    } catch {
      /* keep the current feed */
    }
  }

  async onTaskClockedIn(): Promise<void> {
    this.changed.emit();
    const id = this.currentTaskId();
    if (!id) return;
    try {
      this.task.set(toWorkTask(await firstValueFrom(this.taskApi.getTaskById(id))));
    } catch {
      this.errorMessage.set('Time tracking started, but the task could not be refreshed. Reopen it to see the latest status.');
    }
    await this.reloadHistory();
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
    if (this.activePopover() || this.activeSubtaskPopover()) {
      this.activePopover.set(null);
      this.activeSubtaskPopover.set(null);
    } else {
      void this.attemptClose();
    }
  }

  onEscape(): void {
    if (this.activePopover() || this.activeSubtaskPopover()) {
      this.activePopover.set(null);
      this.activeSubtaskPopover.set(null);
    } else {
      void this.attemptClose();
    }
  }

  togglePopover(name: 'assignee' | 'priority' | 'dueDate' | 'module' | 'sprint' | 'category' | 'splitMenu' | 'status' | 'headerCategory' | 'headerModule' | 'headerMore', event: MouseEvent): void {
    event.stopPropagation();
    this.activeSubtaskPopover.set(null);
    this.activePopover.update((curr) => (curr === name ? null : name));
  }

  closePopover(): void {
    this.activePopover.set(null);
    this.activeSubtaskPopover.set(null);
    this.descRte()?.closePopovers();
  }

  openDeleteConfirm(): void {
    this.activePopover.set(null);
    this.deleteError.set('');
    this.deleteConfirmOpen.set(true);
  }

  onDeleteCancelled(): void {
    this.deleteConfirmOpen.set(false);
  }

  async onDeleteConfirmed(): Promise<void> {
    const t = this.task();
    if (!t) return;
    this.deleteLoading.set(true);
    this.deleteError.set('');
    try {
      const res = await firstValueFrom(this.taskApi.deleteTask(t.id));
      this.deleteLoading.set(false);
      this.deleteConfirmOpen.set(false);
      if (isPendingApproval(res)) {
        // 202: the task stays until the approver says yes, so keep the modal open.
        this.notificationService.info('Task deletion sent for approval.');
        return;
      }
      this.notificationService.success('Task deleted successfully.');
      this.saved.emit();
      this.closed.emit();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      const msg = detail || 'Failed to delete the task.';
      this.deleteLoading.set(false);
      this.deleteError.set(msg);
      this.notificationService.error(msg);
    }
  }

  openDuplicateDialog(): void {
    this.activePopover.set(null);
    this.duplicateError.set(null);
    this.duplicateDialogOpen.set(true);
  }

  onDuplicateCancelled(): void {
    this.duplicateDialogOpen.set(false);
  }

  async onDuplicateConfirmed(payload: TaskDuplicatePayload): Promise<void> {
    const t = this.task();
    if (!t) return;
    this.duplicateLoading.set(true);
    this.duplicateError.set(null);
    try {
      await firstValueFrom(this.taskApi.duplicateTask(t.id, payload));
      this.duplicateLoading.set(false);
      this.duplicateDialogOpen.set(false);
      this.notificationService.success('Task duplicated successfully.');
      this.saved.emit();
      this.closed.emit();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      const msg = detail || 'Failed to duplicate the task.';
      this.duplicateLoading.set(false);
      this.duplicateError.set(msg);
      this.notificationService.error(msg);
    }
  }

  openConvertToSubtaskDialog(): void {
    this.activePopover.set(null);
    this.convertToSubtaskError.set(null);
    this.convertToSubtaskDialogOpen.set(true);
  }

  onConvertToSubtaskCancelled(): void {
    this.convertToSubtaskDialogOpen.set(false);
  }

  async onConvertToSubtaskConfirmed(payload: TaskConvertToSubtaskPayload): Promise<void> {
    const t = this.task();
    if (!t) return;
    this.convertToSubtaskLoading.set(true);
    this.convertToSubtaskError.set(null);
    try {
      await firstValueFrom(this.taskApi.convertToSubtask(t.id, payload));
      this.convertToSubtaskLoading.set(false);
      this.convertToSubtaskDialogOpen.set(false);
      this.notificationService.success('Task converted to subtask successfully.');
      this.saved.emit();
      this.closed.emit();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      const msg = detail || 'Failed to convert the task into a subtask.';
      this.convertToSubtaskLoading.set(false);
      this.convertToSubtaskError.set(msg);
      this.notificationService.error(msg);
    }
  }

  clearError(field: string): void {
    this.errors.update((curr) => {
      if (!curr[field]) return curr;
      const next = { ...curr };
      delete next[field];
      return next;
    });
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

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    await this.uploadAttachmentFiles(input.files);
  }

  async onAttachmentFilesSelected(files: FileList | File[]): Promise<void> {
    await this.uploadAttachmentFiles(files);
  }

  async downloadAttachment(file: AttachmentPill): Promise<void> {
    try {
      const blob = await firstValueFrom(this.taskApi.downloadFile(file.fileId));
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = file.name || 'attachment';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      this.errorMessage.set(`Failed to download ${file.name}.`);
    }
  }

  private async uploadAttachmentFiles(files: FileList | File[]): Promise<void> {
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
      if (this.savedDraftAttachmentIds.has(file.fileId)) continue;
      firstValueFrom(this.taskApi.deletePendingFile(file.fileId)).catch(() => {});
    }
  }

  toggleSubtasksCollapsed(): void {
    this.subtasksCollapsed.update((v) => !v);
  }

  isSubtaskComplete(subtask: WorkTask): boolean {
    return !!this.statuses().find((st) => st.id === subtask.statusId)?.marksTaskComplete;
  }

  formatSubtaskPriority(priority: WorkTask['priority'] | null | undefined): string {
    switch (priority) {
      case 'critical': return 'Critical';
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      default: return 'Priority';
    }
  }

  selectSubtaskPriority(p: WorkTask['priority']): void {
    if (this.newSubtaskPriority() === p) {
      this.newSubtaskPriority.set(null);
    } else {
      this.newSubtaskPriority.set(p);
    }
    this.activeSubtaskPopover.set(null);
  }

  getSubtaskAssigneeName(employeeId: string): string {
    const member = this.assignableMembers().find((m) => m.employeeId === employeeId);
    return member?.name ?? 'Assigned';
  }

  getSubtaskAssigneeAvatarUrl(employeeId: string): string | null {
    return this.assignableMembers().find((m) => m.employeeId === employeeId)?.avatarUrl ?? null;
  }

  selectSubtaskModule(objectiveId: string): void {
    this.newSubtaskModuleId.set(objectiveId);
    this.activeSubtaskPopover.set(null);
  }

  getSubtaskModuleName(objectiveId: string): string {
    if (!objectiveId) return '';
    return this.modules().find((m) => m.objectiveId === objectiveId)?.title ?? '';
  }

  selectSubtaskCategory(categoryId: string): void {
    this.newSubtaskCategoryId.set(categoryId);
    this.activeSubtaskPopover.set(null);
  }

  getSubtaskCategoryName(categoryId: string): string {
    if (!categoryId) return '';
    return this.categories().find((c) => c.id === categoryId)?.name ?? '';
  }

  toggleSubtaskPopover(subtaskId: string, type: 'assignee' | 'priority' | 'status' | 'module' | 'category' | 'tag' | 'date', event: MouseEvent): void {
    event.stopPropagation();
    const current = this.activeSubtaskPopover();
    if (current && current.id === subtaskId && current.type === type) {
      this.activeSubtaskPopover.set(null);
    } else {
      if (type === 'module') {
        this.moduleSearchQuery.set('');
      }
      this.activePopover.set(null);
      this.activeSubtaskPopover.set({ id: subtaskId, type });
    }
  }

  getSubtaskStatusName(statusId: string): string {
    return this.statuses().find((s) => s.id === statusId)?.name ?? 'Status';
  }

  getSubtaskStatusColor(statusId: string): string {
    return this.statuses().find((s) => s.id === statusId)?.color || '#64748b';
  }

  async changeSubtaskAssignee(subtask: WorkTask, newEmployeeId: string): Promise<void> {
    this.activeSubtaskPopover.set(null);
    if (this.currentEffectiveMode() === 'create' || subtask.id.startsWith('draft-')) {
      this.draftSubtasks.update((list) =>
        list.map((ds) => ds.id === subtask.id ? { ...ds, assigneeEmployeeId: newEmployeeId || undefined } : ds)
      );
      return;
    }
    const currentAssignees = subtask.assigneeEmployeeIds;
    const currentPrimary = currentAssignees[0] ?? '';
    if (currentPrimary === newEmployeeId) return;

    try {
      for (const prevId of currentAssignees) {
        if (prevId !== newEmployeeId) {
          await firstValueFrom(this.taskApi.unassignTask(subtask.id, prevId));
        }
      }
      if (newEmployeeId && !currentAssignees.includes(newEmployeeId)) {
        await firstValueFrom(this.taskApi.assignTask(subtask.id, newEmployeeId));
      }
      if (this.task()) {
        void this.boardStore.loadSubtasks(this.task()!.id);
      }
      this.changed.emit();
    } catch {
      // ignore error
    }
  }

  async changeSubtaskPriority(subtask: WorkTask, priority: WorkTask['priority']): Promise<void> {
    this.activeSubtaskPopover.set(null);
    if (!priority || subtask.priority === priority) return;
    if (this.currentEffectiveMode() === 'create' || subtask.id.startsWith('draft-')) {
      this.draftSubtasks.update((list) =>
        list.map((ds) => ds.id === subtask.id ? { ...ds, priority } : ds)
      );
      return;
    }
    let dueDateStr: string | undefined = undefined;
    if (subtask.dueDate) {
      dueDateStr = subtask.dueDate instanceof Date
        ? subtask.dueDate.toISOString().slice(0, 10)
        : String(subtask.dueDate).slice(0, 10);
    }
    try {
      await firstValueFrom(this.taskApi.editTask(subtask.id, {
        title: subtask.title,
        description: subtask.description || undefined,
        priority,
        dueDate: dueDateStr,
        estimatedHours: subtask.estimatedHours ?? undefined,
        storyPoints: subtask.storyPoints ?? undefined,
        sprintId: subtask.sprintId ?? undefined
      }));
      if (this.task()) {
        void this.boardStore.loadSubtasks(this.task()!.id);
      }
      this.changed.emit();
    } catch {
      // ignore error
    }
  }

  async changeSubtaskStatus(subtask: WorkTask, newStatusId: string): Promise<void> {
    this.activeSubtaskPopover.set(null);
    if (this.currentEffectiveMode() === 'create' || subtask.id.startsWith('draft-')) {
      return;
    }
    if (subtask.statusId === newStatusId) return;
    try {
      await firstValueFrom(this.taskApi.moveTaskStatus(subtask.id, newStatusId));
      if (this.task()) {
        void this.boardStore.loadSubtasks(this.task()!.id);
      }
      this.changed.emit();
    } catch {
      // ignore error
    }
  }

  async toggleSubtaskStatus(subtask: WorkTask, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.activeSubtaskPopover.set(null);
    if (this.currentEffectiveMode() === 'create' || subtask.id.startsWith('draft-')) {
      return;
    }
    const isDone = this.isSubtaskComplete(subtask);
    const targetStatus = this.statuses().find((st) => isDone ? !st.marksTaskComplete : st.marksTaskComplete);
    if (!targetStatus) return;
    try {
      await firstValueFrom(this.taskApi.moveTaskStatus(subtask.id, targetStatus.id));
      if (this.task()) void this.boardStore.loadSubtasks(this.task()!.id);
      this.changed.emit();
    } catch {
      // ignore status toggle error
    }
  }

  removeDraftSubtask(subtaskId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.draftSubtasks.update((list) => list.filter((ds) => ds.id !== subtaskId));
  }

  startAddSubtask(): void {
    this.activeSubtaskPopover.set(null);
    this.addingSubtask.set(true);
    this.newSubtaskPriority.set(null);
    this.newSubtaskModuleId.set(this.task()?.objectiveId || this.selectedObjectiveId() || '');
    this.newSubtaskCategoryId.set(this.task()?.categoryId || this.categoryId() || (this.categories()[0]?.id ?? ''));
  }

  cancelAddSubtask(): void {
    this.addingSubtask.set(false);
    this.newSubtaskTitle.set('');
    this.newSubtaskDueDate.set('');
    this.newSubtaskAssigneeId.set(null);
    this.newSubtaskPriority.set(null);
    this.newSubtaskModuleId.set(this.task()?.objectiveId || this.selectedObjectiveId() || '');
    this.newSubtaskCategoryId.set(this.task()?.categoryId || this.categoryId() || (this.categories()[0]?.id ?? ''));
  }

  selectNewSubtaskAssignee(employeeId: string | null): void {
    this.newSubtaskAssigneeId.set(employeeId);
    this.activeSubtaskPopover.set(null);
  }

  async openSubtask(subtaskId: string): Promise<void> {
    if (!subtaskId) return;
    this.activeSubtaskPopover.set(null);
    const current = this.task();
    if (current && current.id !== subtaskId) {
      if (!current.parentTaskId) {
        this.parentTask.set(current);
      } else if (current.parentTaskId === subtaskId) {
        this.parentTask.set(null);
      }
    }
    this.activeTaskId.set(subtaskId);
    this.loadedKey = `${this.mode()}:${subtaskId}:${this.open()}`;
    this.resetForm();
    this.taskSelected.emit(subtaskId);
    await this.loadForTaskId(subtaskId);
  }

  async saveNewSubtask(parentTaskId?: string): Promise<void> {
    const title = this.newSubtaskTitle().trim();
    if (!title) return;

    const objectiveId = this.newSubtaskModuleId() || this.task()?.objectiveId || this.selectedObjectiveId() || undefined;
    const categoryId = this.newSubtaskCategoryId() || this.task()?.categoryId || this.categoryId() || undefined;

    if (this.currentEffectiveMode() === 'create' || !parentTaskId) {
      const newDraft = {
        id: 'draft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        title,
        dueDate: this.newSubtaskDueDate() || undefined,
        assigneeEmployeeId: this.newSubtaskAssigneeId() ?? undefined,
        priority: this.newSubtaskPriority() ?? undefined,
        objectiveId,
        categoryId
      };
      this.draftSubtasks.update((prev) => [...prev, newDraft]);
      this.cancelAddSubtask();
      return;
    }

    const request: CreateSubtaskRequestDto = {
      title,
      ...(this.newSubtaskDueDate() ? { dueDate: this.newSubtaskDueDate() } : {}),
      ...(this.newSubtaskAssigneeId() ? { assigneeEmployeeId: this.newSubtaskAssigneeId()! } : {}),
      ...(this.newSubtaskPriority() ? { priority: this.newSubtaskPriority()! } : {}),
      ...(objectiveId ? { objectiveId } : {}),
      ...(categoryId ? { categoryId } : {})
    };
    const created = await this.boardStore.createSubtask(parentTaskId, request);
    if (created) {
      this.notificationService.success('Subtask created successfully.');
      this.cancelAddSubtask();
    } else {
      this.notificationService.error(this.boardStore.error() ?? 'Failed to create subtask.');
    }
  }

  onCancel(): void {
    void this.attemptClose();
  }

  async submit(): Promise<void> {
    if (this.currentEffectiveMode() === 'create') {
      await this.submitCreateWithAction('create_and_close');
      return;
    }

    const fieldErrors: Record<string, string> = {};
    if (!this.title().trim()) fieldErrors['title'] = 'Title is required.';
    this.errors.set(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      this.notificationService.warning('Please enter a work item title.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const newStatusId = this.statusId();
    const fields = {
      title: this.title().trim(),
      description: this.description() || undefined,
      priority: this.priority() ?? 'medium',
      dueDate: this.dueDate() || undefined,
      estimatedHours: this.estimatedHours() ?? undefined,
      storyPoints: this.storyPoints() ?? undefined,
      progressPercent: this.progressPercent() ?? undefined,
      reason: this.reason().trim() || undefined,
      sprintId: this.sprintId() || null,
      categoryId: this.categoryId() || undefined,
      objectiveId: this.selectedObjectiveId() || undefined
    };

    const taskId = this.currentTaskId();
    try {
      if (newStatusId && newStatusId !== this.task()?.statusId) {
        await firstValueFrom(this.taskApi.moveTaskStatus(taskId, newStatusId));
      }
      // Always the normal endpoint: the backend's approval engine decides whether the edit
      // applies now (200) or goes out for approval (202).
      const edited = await firstValueFrom(this.taskApi.editTask(taskId, {
        ...fields,
        attachmentFileIds: this.attachedFiles().map((f) => f.fileId)
      }));
      if (isPendingApproval(edited)) {
        this.notificationService.info('Task edit sent for approval.');
      } else {
        this.notificationService.success('Task updated successfully.');
      }
      // Reassignment is its own broadly-permitted action (AssignTask/UnassignTask use the
      // effective-manager check, not the edit approval), so it applies regardless of whether
      // the field edits above saved directly or went out for approval.
      await this.applyReassignment();
      this.saved.emit();
      this.closed.emit();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      const msg = detail || 'Failed to save.';
      this.errorMessage.set(msg);
      this.notificationService.error(msg);
    } finally {
      this.submitting.set(false);
    }
  }

  private async applyReassignment(): Promise<void> {
    const next = this.assigneeEmployeeId();
    const previous = this.originalAssigneeId();
    if (next === previous) return;
    const taskId = this.currentTaskId();
    if (previous) await firstValueFrom(this.taskApi.unassignTask(taskId, previous));
    if (next) await firstValueFrom(this.taskApi.assignTask(taskId, next));
  }

  async submitCreateWithAction(action: 'create_and_close' | 'create_and_add_another' | 'create_and_open' = 'create_and_close'): Promise<void> {
    const errs: Record<string, string> = {};
    if (!this.title().trim()) errs['title'] = 'Title is required.';
    if (!this.selectedObjectiveId()) errs['objectiveId'] = 'Module is required.';
    if (!this.categoryId()) errs['categoryId'] = 'Category is required.';
    if (!this.priority()) errs['priority'] = 'Priority is required.';
    this.errors.set(errs);
    if (Object.keys(errs).length > 0) {
      this.notificationService.warning('Please fill in all required fields.');
      return;
    }

    const request: CreateTaskRequestDto = {
      title: this.title().trim(),
      description: this.description() || undefined,
      categoryId: this.categoryId(),
      priority: this.priority()!,
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
      // Always the normal endpoint: owners get the task now (201), members a 202 "sent for approval".
      const result = await this.boardStore.createTask(objectiveId, request);
      if (isPendingApproval(result)) {
        void this.finishDraftAfterCreate(true);
        this.created.emit('');
        this.notificationService.info('Task sent for approval.');
        if (action === 'create_and_add_another') {
          this.title.set('');
          this.description.set('');
          this.descRte()?.clear();
          this.attachedFiles.set([]);
          this.draftSubtasks.set([]);
          this.cancelAddSubtask();
          this.markClean();
          this.successToastMessage.set('Sent for approval! You can enter another task below.');
          setTimeout(() => this.taskTitleInput()?.nativeElement?.focus());
        } else {
          this.closed.emit();
        }
        return;
      }
      if (result && 'availableSlackHours' in result) {
        this.allocationHint.set(result);
        this.notificationService.warning(`Insufficient allocation hours. Available slack: ${result.availableSlackHours ?? 0} hrs.`);
        return;
      }
      if (result) {
        if (this.assigneeEmployeeId()) {
          try {
            await firstValueFrom(this.taskApi.assignTask(result.id, this.assigneeEmployeeId()));
          } catch {
            this.notificationService.warning('Task created, but failed to assign employee.');
          }
        }
        const drafts = this.draftSubtasks();
        if (drafts.length > 0) {
          for (const ds of drafts) {
            await this.boardStore.createSubtask(result.id, {
              title: ds.title,
              dueDate: ds.dueDate || undefined,
              assigneeEmployeeId: ds.assigneeEmployeeId || undefined,
              ...(ds.priority ? { priority: ds.priority } : {}),
              ...(ds.objectiveId ? { objectiveId: ds.objectiveId } : {}),
              ...(ds.categoryId ? { categoryId: ds.categoryId } : {})
            });
          }
          this.draftSubtasks.set([]);
        }
        void this.finishDraftAfterCreate(false);
        this.created.emit(result.id);
        this.notificationService.success('Task created successfully.');
        if (action === 'create_and_add_another') {
          this.title.set('');
          this.description.set('');
          this.descRte()?.clear();
          this.attachedFiles.set([]);
          this.draftSubtasks.set([]);
          this.cancelAddSubtask();
          this.markClean();
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
      const errMsg = this.boardStore.error() ?? 'Failed to create the task.';
      this.errorMessage.set(errMsg);
      this.notificationService.error(errMsg);
    } finally {
      this.submitting.set(false);
    }
  }
}
