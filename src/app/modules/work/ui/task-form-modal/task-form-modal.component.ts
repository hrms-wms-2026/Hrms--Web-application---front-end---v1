import { Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { Sprint } from '../../models/sprint.model';
import { CreateSubtaskRequestDto, CreateTaskRequestDto, InsufficientAllocationErrorDto } from '../../models/dto/task.dto';
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
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { FileApiService } from '../../../../shared/data-access/file-api.service';
import { TaskHistoryEntryDto } from '../../models/dto/task-history.dto';

export type TaskFormMode = 'create' | 'edit';

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  category: 'SUGGESTIONS' | 'TEXT' | 'MEDIA & EMBEDS';
  keywords: string[];
}

export const ALL_SLASH_COMMANDS: SlashCommandItem[] = [
  { id: 'bold', label: 'Bold', description: 'Make text bold', category: 'SUGGESTIONS', keywords: ['bold', 'strong', 'b'] },
  { id: 'bullet', label: 'Bulleted list', description: 'Create a simple bulleted list', category: 'SUGGESTIONS', keywords: ['bullet', 'list', 'ul', 'unordered'] },
  { id: 'numbered', label: 'Numbered list', description: 'Create a list with numbering', category: 'SUGGESTIONS', keywords: ['numbered', 'order', 'ol', '1'] },
  { id: 'checklist', label: 'To-do / Checklist', description: 'Track tasks with a todo list', category: 'SUGGESTIONS', keywords: ['check', 'todo', 'task', 'checkbox', 'checklist'] },
  { id: 'h1', label: 'Heading 1', description: 'Large section heading', category: 'TEXT', keywords: ['h1', 'heading', 'title', 'large'] },
  { id: 'h2', label: 'Heading 2', description: 'Medium section heading', category: 'TEXT', keywords: ['h2', 'heading', 'subtitle', 'medium'] },
  { id: 'p', label: 'Normal text', description: 'Start writing with plain text', category: 'TEXT', keywords: ['normal', 'paragraph', 'text', 'p'] },
  { id: 'italic', label: 'Italic', description: 'Emphasize your text', category: 'TEXT', keywords: ['italic', 'em', 'i'] },
  { id: 'underline', label: 'Underline', description: 'Underline selected text', category: 'TEXT', keywords: ['underline', 'u'] },
  { id: 'highlight', label: 'Highlight text', description: 'Add yellow highlight color', category: 'TEXT', keywords: ['highlight', 'color', 'background', 'mark'] },
  { id: 'code', label: 'Code', description: 'Format inline snippet or block', category: 'TEXT', keywords: ['code', 'inline', 'snippet'] },
  { id: 'divider', label: 'Divider', description: 'Separate content with a horizontal line', category: 'TEXT', keywords: ['divider', 'hr', 'line', 'separator'] },
  { id: 'image', label: 'Image', description: 'Upload or insert an image', category: 'MEDIA & EMBEDS', keywords: ['image', 'photo', 'picture', 'upload', 'img'] },
  { id: 'link', label: 'Link', description: 'Add an external hyperlink', category: 'MEDIA & EMBEDS', keywords: ['link', 'url', 'href', 'hyperlink'] },
  { id: 'attach', label: 'Attach file', description: 'Upload a file attachment to task', category: 'MEDIA & EMBEDS', keywords: ['attach', 'file', 'document', 'pdf'] }
];

@Component({
  selector: 'app-task-form-modal',
  standalone: true,
  imports: [NgTemplateOutlet, ButtonComponent, TaskHistoryFeedComponent, TaskClockWidgetComponent, TaskAttachmentListComponent, ColorSwatchPopoverComponent, AvatarComponent],
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

          <header class="tfm__head" [class.tfm__head--doc]="currentEffectiveMode() === 'edit'">
            @if (currentEffectiveMode() === 'create') {
              <div class="tfm__title">
                <h2>Create task</h2>
              </div>
            } @else if (task(); as t) {
              <div class="tfm-breadcrumbs">
                <span class="tfm-breadcrumb-proj">{{ projectTitle() || 'Project' }}</span>
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
                  <div class="tfm-type-pill">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m9 12 2 2 4-4" /></svg>
                    <span>Task</span>
                  </div>
                }
              </div>
            } @else {
              <div class="tfm__title"><h2>Task</h2></div>
            }
            <button type="button" class="tfm__x" aria-label="Close" (click)="onCancel()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </header>

          <div class="tfm__body" (click)="closePopover()">
            <ng-template #descriptionEditorTpl>
              <!-- Rich text formatted description editor -->
              <div class="tfm-editor">
                <div class="tfm-editor__toolbar" (click)="$event.stopPropagation()">
                  <div class="tfm-editor__tools-left">
                    <button
                      type="button"
                      class="tfm-editor__tool tfm-editor__tool--text"
                      [class.tfm-editor__tool--active]="activeFormats().h1"
                      title="Heading 1 (22px) - Click to toggle on/off"
                      (mousedown)="$event.preventDefault()"
                      (click)="toggleHeading('h1')"
                    >
                      <span class="tfm-tool-h-label">H1</span>
                    </button>
                    <button
                      type="button"
                      class="tfm-editor__tool tfm-editor__tool--text"
                      [class.tfm-editor__tool--active]="activeFormats().h2"
                      title="Heading 2 (18px) - Click to toggle on/off"
                      (mousedown)="$event.preventDefault()"
                      (click)="toggleHeading('h2')"
                    >
                      <span class="tfm-tool-h-label">H2</span>
                    </button>
                    <span class="tfm-editor__divider"></span>
                    <button
                      type="button"
                      class="tfm-editor__tool"
                      [class.tfm-editor__tool--active]="activeFormats().bold"
                      title="Bold (Ctrl+B) - Click to toggle on/off"
                      (mousedown)="$event.preventDefault()"
                      (click)="formatDoc('bold')"
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      type="button"
                      class="tfm-editor__tool"
                      [class.tfm-editor__tool--active]="activeFormats().italic"
                      title="Italic (Ctrl+I) - Click to toggle on/off"
                      (mousedown)="$event.preventDefault()"
                      (click)="formatDoc('italic')"
                    >
                      <em>I</em>
                    </button>
                    <button
                      type="button"
                      class="tfm-editor__tool"
                      [class.tfm-editor__tool--active]="activeFormats().underline"
                      title="Underline (Ctrl+U) - Click to toggle on/off"
                      (mousedown)="$event.preventDefault()"
                      (click)="formatDoc('underline')"
                    >
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
                        [class.tfm-editor__tool--active]="showHighlightPopover() || activeFormats().highlight"
                        title="Highlight - Click to select color or remove"
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
                    <button
                      type="button"
                      class="tfm-editor__tool"
                      [class.tfm-editor__tool--active]="activeFormats().code"
                      title="Code - Click to toggle on/off"
                      (mousedown)="$event.preventDefault()"
                      (click)="toggleCode()"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></svg>
                    </button>
                    <button
                      type="button"
                      class="tfm-editor__tool"
                      [class.tfm-editor__tool--active]="activeFormats().bullet"
                      title="Bullet list - Click to toggle on/off"
                      (mousedown)="$event.preventDefault()"
                      (click)="formatList('unordered')"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                    </button>
                    <button
                      type="button"
                      class="tfm-editor__tool"
                      [class.tfm-editor__tool--active]="activeFormats().numbered"
                      title="Numbered list - Click to toggle on/off"
                      (mousedown)="$event.preventDefault()"
                      (click)="formatList('ordered')"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M3 18h3L4 15.5a1.5 1.5 0 0 1 2-1.5" /></svg>
                    </button>
                    <button
                      type="button"
                      class="tfm-editor__tool"
                      [class.tfm-editor__tool--active]="activeFormats().checklist"
                      title="Checklist - Click to toggle on/off"
                      (mousedown)="$event.preventDefault()"
                      (click)="toggleChecklist()"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="2" /><path d="m7 12 3 3 7-7" /></svg>
                    </button>
                    <span class="tfm-editor__divider"></span>
                    <div class="tfm-link-anchor">
                      <button
                        type="button"
                        class="tfm-editor__tool"
                        [class.tfm-editor__tool--active]="showLinkPopover() || activeFormats().link"
                        title="Link (Click to add or edit link)"
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
                            @if (activeFormats().link) {
                              <button type="button" class="tfm-link-btn tfm-link-btn--remove" (click)="removeLink()">Remove</button>
                            }
                            <button type="button" class="tfm-link-btn tfm-link-btn--cancel" (click)="showLinkPopover.set(false)">Cancel</button>
                            <button type="button" class="tfm-link-btn tfm-link-btn--apply" (click)="applyLink()" [disabled]="!linkUrlInput().trim()">
                              {{ activeFormats().link ? 'Update' : 'Insert link' }}
                            </button>
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
                </div>

                <input #attachmentFileInput type="file" multiple class="tfm-image-input-hidden" (change)="onAttachmentFileInputChange($event)" />

                <div
                  #descEditor
                  contenteditable="true"
                  class="tfm-editor__content"
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Description"
                  data-placeholder="Write description or press '/' for commands..."
                  (focus)="onEditorFocus()"
                  (change)="onEditorChange($event)"
                  (keydown)="onEditorKeydown($event)"
                  (keyup)="onEditorKeyup()"
                  (mouseup)="onEditorMouseup()"
                  (input)="onEditorInput()"
                  (blur)="onEditorBlur()"
                  (click)="onEditorClick($event)"
                ></div>

                @if (showSlashMenu() && filteredSlashCommands().length > 0) {
                  <div
                    #slashMenuRef
                    class="tfm-slash-menu"
                    [style.top.px]="slashMenuCoords()?.top ?? 36"
                    [style.left.px]="slashMenuCoords()?.left ?? 12"
                    (mousedown)="$event.preventDefault()"
                  >
                    <div class="tfm-slash-menu__head">
                      <span>{{ filteredSlashCommands()[0]?.category ?? 'SUGGESTIONS' }}</span>
                      <span class="tfm-slash-hint">↑↓ navigate · ↵ select</span>
                    </div>

                    <div class="tfm-slash-menu__list">
                      @for (cmd of filteredSlashCommands(); track cmd.id; let idx = $index) {
                        @if (idx > 0 && cmd.category !== filteredSlashCommands()[idx - 1].category) {
                          <div class="tfm-slash-group-label">{{ cmd.category }}</div>
                        }
                        <button
                          type="button"
                          class="tfm-slash-item"
                          [class.tfm-slash-item--active]="slashSelectedIndex() === idx"
                          [class.tfm-slash-item--current]="isSlashCommandActive(cmd.id)"
                          (mouseenter)="slashSelectedIndex.set(idx)"
                          (click)="executeSlashCommand(cmd.id)"
                        >
                          <div class="tfm-slash-icon">
                            @switch (cmd.id) {
                              @case ('h1') { <strong>H1</strong> }
                              @case ('h2') { <strong>H2</strong> }
                              @case ('p') { <span>T</span> }
                              @case ('bold') { <strong>B</strong> }
                              @case ('italic') { <em>I</em> }
                              @case ('underline') { <u>U</u> }
                              @case ('highlight') {
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 11 6-6 4 4-6 6H9v-4Z" /><path d="M3 21h6" /></svg>
                              }
                              @case ('bullet') {
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                              }
                              @case ('numbered') {
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M3 18h3L4 15.5a1.5 1.5 0 0 1 2-1.5" /></svg>
                              }
                              @case ('checklist') {
                                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="2" /><path d="m7 12 3 3 7-7" /></svg>
                              }
                              @case ('code') {
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></svg>
                              }
                              @case ('divider') {
                                <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12" stroke-width="2" /></svg>
                              }
                              @case ('image') {
                                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                              }
                              @case ('link') {
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                              }
                              @case ('attach') {
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                              }
                            }
                          </div>
                          <div class="tfm-slash-text">
                            <div class="tfm-slash-name-row">
                              <span class="tfm-slash-name">{{ cmd.label }}</span>
                              @if (isSlashCommandActive(cmd.id)) {
                                <span class="tfm-slash-active-badge">Active</span>
                              }
                            </div>
                            <span class="tfm-slash-desc">{{ cmd.description }}</span>
                          </div>
                          @if (isSlashCommandActive(cmd.id)) {
                            <div class="tfm-slash-check-icon" title="Active format">
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          }
                        </button>
                      }
                    </div>
                  </div>
                } @else if (showSlashMenu() && filteredSlashCommands().length === 0) {
                  <div
                    class="tfm-slash-menu tfm-slash-menu--empty"
                    [style.top.px]="slashMenuCoords()?.top ?? 36"
                    [style.left.px]="slashMenuCoords()?.left ?? 12"
                    (mousedown)="$event.preventDefault()"
                  >
                    <span class="tfm-slash-empty-text">No matching commands</span>
                  </div>
                }
              </div>
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
                    placeholder="Task title"
                    [value]="title()"
                    (input)="title.set($any($event.target).value)"
                    aria-label="Task title"
                  />
                  @if (errors()['title']) {
                    <span class="tfm__error tfm-title-error" role="alert">{{ errors()['title'] }}</span>
                  }
                </div>

                <ng-container [ngTemplateOutlet]="descriptionEditorTpl" />
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
                              <app-avatar class="tfm-popover__avatar" [avatarUrl]="member.avatarUrl" [userName]="member.name" size="sm" />
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
                    placeholder="Task title"
                    aria-label="Task title"
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
                      <div class="tfm-prop-value tfm-chip-anchor">
                        <button
                          type="button"
                          class="tfm-chip tfm-chip--clean"
                          [class.tfm-chip--empty]="!dueDate()"
                          [attr.aria-expanded]="activePopover() === 'dueDate'"
                          (click)="togglePopover('dueDate', $event)"
                        >
                          <span class="tfm-chip-label">{{ dueDate() ? formattedDueDate() : 'Empty' }}</span>
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
                        <div class="tfm-inline-prop-box">
                          <input
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
                                    <app-avatar class="tfm-popover__avatar" [avatarUrl]="member.avatarUrl" [userName]="member.name" size="sm" />
                                    <span class="tfm-popover__name">{{ member.name }}</span>
                                  </button>
                                }
                              </div>
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
                        <div class="tfm-inline-prop-box">
                          <input
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
                        <div class="tfm-inline-prop-box">
                          <input
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
                        <span class="tfm-completed-hours">({{ t.completedHours }}h completed)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Subtle Divider -->
                <div class="tfm-doc-divider"></div>

                <!-- Description Area -->
                <div class="tfm-doc-section">
                  <span class="tfm-doc-section-title">Description</span>
                  <ng-container [ngTemplateOutlet]="descriptionEditorTpl" />
                </div>

                <!-- Subtasks Section -->
                @if (currentEffectiveMode() === 'edit' && task(); as t) {
                  @if (!t.parentTaskId) {
                    <!-- When subtasks exist OR user is adding a subtask: show the ClickUp table view -->
                    @if (subtasks().length > 0 || addingSubtask()) {
                      <div class="tfm-subtasks-section">
                        <!-- Section Header: ▼ Subtasks  X open  [progressBar]  X for me -->
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
                              <div class="tfm-subtask-progress" [title]="subtaskCompletedCount() + '/' + subtasks().length + ' completed'">
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
                            @for (subtask of subtasks(); track subtask.id) {
                              <div
                                class="tfm-subtask-row"
                                role="button"
                                tabindex="0"
                                [attr.data-testid]="'subtask-row-' + subtask.id"
                                (click)="openSubtask(subtask.id)"
                                (keydown.enter)="openSubtask(subtask.id)"
                                (keydown.space)="$event.preventDefault(); openSubtask(subtask.id)"
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
                                      <span class="tfm-subtask-unassigned-icon" title="Unassigned">
                                        <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                                      </span>
                                    }
                                  </button>
                                  @if (activeSubtaskPopover()?.id === subtask.id && activeSubtaskPopover()?.type === 'assignee') {
                                    <div class="tfm-popover" role="dialog" aria-label="Change assignee" (click)="$event.stopPropagation()">
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
                                          [class.tfm-popover__item--selected]="subtask.assigneeEmployeeIds.length === 0"
                                          (click)="changeSubtaskAssignee(subtask, '')"
                                        >
                                          <span class="tfm-popover__avatar tfm-popover__avatar--unassigned" aria-hidden="true">
                                            <svg class="tfm-chip-svg" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                          </span>
                                          <span class="tfm-popover__name">Unassigned</span>
                                          @if (subtask.assigneeEmployeeIds.length === 0) {
                                            <svg class="tfm-popover__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                                          }
                                        </button>
                                        @for (member of filteredAssignees(); track member.employeeId) {
                                          <button
                                            type="button"
                                            class="tfm-popover__item"
                                            [class.tfm-popover__item--selected]="subtask.assigneeEmployeeIds.includes(member.employeeId)"
                                            (click)="changeSubtaskAssignee(subtask, member.employeeId)"
                                          >
                                            <app-avatar class="tfm-popover__avatar" [avatarUrl]="member.avatarUrl" [userName]="member.name" size="sm" />
                                            <span class="tfm-popover__name">{{ member.name }}</span>
                                            @if (subtask.assigneeEmployeeIds.includes(member.employeeId)) {
                                              <svg class="tfm-popover__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                                            }
                                          </button>
                                        } @empty {
                                          <p style="margin: 6px 0 2px; color: var(--color-text-secondary); font-size: 12px; text-align: center;">No matching people</p>
                                        }
                                      </div>
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
                                  <span class="tfm-subtask-chevron" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                  </span>
                                </div>
                              </div>
                            }
                          </div>

                          <!-- Add Task Row (Inside table when subtasks exist) -->
                          @if (addingSubtask()) {
                            <ng-container [ngTemplateOutlet]="subtaskCreateRowTpl" [ngTemplateOutletContext]="{ taskId: t.id }" />
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
                    }

                    <!-- Reusable Subtask Creation Row (ClickUp Style) -->
                    <ng-template #subtaskCreateRowTpl let-taskId="taskId">
                      <div class="tfm-subtask-inline-create">
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
                            (keydown.enter)="newSubtaskTitle().trim() && saveNewSubtask(taskId)"
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
                                      @if (m.isOwner) {
                                        <span class="tfm-popover__badge">Owner</span>
                                      }
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

                          <div class="tfm-subtask-inline-divider"></div>

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
                              <div class="tfm-popover tfm-popover--up" role="dialog" aria-label="Change assignee" (click)="$event.stopPropagation()">
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
                                    [class.tfm-popover__item--selected]="!newSubtaskAssigneeId()"
                                    (click)="selectNewSubtaskAssignee(null)"
                                  >
                                    <span class="tfm-popover__avatar tfm-popover__avatar--unassigned" aria-hidden="true">
                                      <svg class="tfm-chip-svg" viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </span>
                                    <span class="tfm-popover__name">Unassigned</span>
                                    @if (!newSubtaskAssigneeId()) {
                                      <svg class="tfm-popover__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                                    }
                                  </button>
                                  @for (member of filteredAssignees(); track member.employeeId) {
                                    <button
                                      type="button"
                                      class="tfm-popover__item"
                                      [class.tfm-popover__item--selected]="newSubtaskAssigneeId() === member.employeeId"
                                      (click)="selectNewSubtaskAssignee(member.employeeId)"
                                    >
                                      <app-avatar class="tfm-popover__avatar" [avatarUrl]="member.avatarUrl" [userName]="member.name" size="sm" />
                                      <span class="tfm-popover__name">{{ member.name }}</span>
                                      @if (newSubtaskAssigneeId() === member.employeeId) {
                                        <svg class="tfm-popover__check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg>
                                      }
                                    </button>
                                  } @empty {
                                    <p style="margin: 6px 0 2px; color: var(--color-text-secondary); font-size: 12px; text-align: center;">No matching people</p>
                                  }
                                </div>
                              </div>
                            }
                          </div>

                          <div class="tfm-chip-anchor">
                            <button
                              type="button"
                              class="tfm-subtask-icon-btn"
                              data-testid="subtask-add-due-date-button"
                              (click)="openSubtaskDatePicker(subtaskDueDateInput)"
                              [title]="newSubtaskDueDate() ? ('Due: ' + newSubtaskDueDate()) : 'Set due date'"
                            >
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <rect x="2" y="3.5" width="12" height="10" rx="2"/>
                                <path d="M2 7h12M5 2v3M11 2v3"/>
                              </svg>
                            </button>
                            <input
                              #subtaskDueDateInput
                              type="date"
                              class="tfm-subtask-hidden-date"
                              data-testid="subtask-add-due-date"
                              [value]="newSubtaskDueDate()"
                              (input)="newSubtaskDueDate.set($any($event.target).value)"
                            />
                          </div>

                          <div class="tfm-chip-anchor">
                            <button
                              type="button"
                              class="tfm-subtask-icon-btn"
                              data-testid="subtask-add-priority-button"
                              (click)="toggleSubtaskPopover('new', 'priority', $event)"
                              [title]="newSubtaskPriority() ? ('Priority: ' + formatSubtaskPriority(newSubtaskPriority())) : 'Set priority'"
                            >
                              <svg class="tfm-subtask-flag-icon" [attr.data-priority]="newSubtaskPriority()" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                <path d="M3 2v12h1.5V9.5h6l.5 1.5h4V4h-4.5L10 2.5H3z"/>
                              </svg>
                            </button>
                            @if (activeSubtaskPopover()?.id === 'new' && activeSubtaskPopover()?.type === 'priority') {
                              <div class="tfm-popover tfm-popover--up" role="dialog" aria-label="Choose priority" (click)="$event.stopPropagation()">
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

                          <button type="button" class="tfm-subtask-icon-btn" title="Add tags">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                              <path d="M2.5 8.5L8.5 2.5H13.5V7.5L7.5 13.5L2.5 8.5Z"/>
                              <circle cx="10.5" cy="5.5" r="1" fill="currentColor"/>
                            </svg>
                          </button>

                          <button
                            type="button"
                            class="tfm-subtask-btn-cancel"
                            data-testid="subtask-add-cancel"
                            (click)="cancelAddSubtask()"
                            title="Cancel (Esc)"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            class="tfm-subtask-btn-save"
                            data-testid="subtask-add-save"
                            [disabled]="!newSubtaskTitle().trim()"
                            (click)="saveNewSubtask(taskId)"
                            title="Save task (Enter)"
                          >
                            <span>Save</span>
                            <span class="tfm-subtask-enter-symbol">↵</span>
                          </button>
                        </div>
                      </div>
                    </ng-template>
                  }
                }

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
                    />
                  </div>
                }

                <!-- Quick Actions List (Add Subtask when empty and Attach File when empty) -->
                @if (attachedFiles().length === 0 || (currentEffectiveMode() === 'edit' && task() && !task()!.parentTaskId && subtasks().length === 0 && !addingSubtask())) {
                  <div class="tfm-actions-list">
                    @if (currentEffectiveMode() === 'edit' && task(); as t) {
                      @if (!t.parentTaskId && subtasks().length === 0 && !addingSubtask()) {
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
                              <path d="M11.5 2.5v3.5M9.75 4.25h3.5"/>
                            </svg>
                          </span>
                          <span>Add subtask</span>
                        </button>
                      }
                    }

                    @if (attachedFiles().length === 0) {
                      <app-task-attachment-list
                        [files]="attachedFiles()"
                        (fileSelected)="onAttachmentFilesSelected($event)"
                        (removed)="removeAttachedFile($event)"
                      />
                    }
                  </div>
                }

                <!-- Activity Log Section -->
                <div class="tfm-doc-section tfm-doc-section--collapsible">
                  <button
                    type="button"
                    class="tfm-doc-section-toggle"
                    (click)="showActivityLog.set(!showActivityLog())"
                    [attr.aria-expanded]="showActivityLog()"
                  >
                    <div class="tfm-doc-section-head">
                      <span class="tfm-doc-section-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="9" /></svg>
                      </span>
                      <span class="tfm-doc-section-title">Activity log</span>
                      <span class="tfm-doc-count">{{ history().length }}</span>
                    </div>
                    <svg class="tfm-chevron-svg" [class.tfm-chevron-svg--open]="showActivityLog()" viewBox="0 0 24 24" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>

                  @if (showActivityLog()) {
                    <div class="tfm-doc-activity-body">
                      <app-task-history-feed [entries]="history()" (reasonSaved)="reloadHistory()" />
                    </div>
                  }
                </div>

                @if (errorMessage()) {
                  <p class="tfm__error tfm-banner-error" role="alert">{{ errorMessage() }}</p>
                }
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

    .tfm-doc-title-block { display: flex; flex-direction: column; gap: 4px; }
    .tfm-doc-title-input { width: 100%; font-size: 24px; font-weight: 700; line-height: 1.3; color: var(--color-text-primary); border: 1px solid transparent; border-radius: 6px; padding: 4px 8px; margin-left: -8px; background: transparent; outline: none; transition: all 140ms ease; font-family: inherit; }
    .tfm-doc-title-input:hover,
    .tfm-doc-title-input:focus { background: var(--color-surface-secondary); border-color: transparent; box-shadow: none; outline: none; }
    .tfm-doc-title-input--error { border-color: var(--color-danger) !important; background: var(--color-danger-subtle) !important; }

    /* ClickUp Property Grid */
    .tfm-prop-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 36px; padding: 4px 0 10px; }
    @media (max-width: 768px) { .tfm-prop-grid { grid-template-columns: 1fr; gap: 8px; } }
    .tfm-prop-col { display: flex; flex-direction: column; gap: 8px; }
    .tfm-prop-row { display: flex; align-items: center; min-height: 36px; gap: 12px; }
    .tfm-prop-label { display: inline-flex; align-items: center; gap: 8px; width: 120px; flex-shrink: 0; font-size: 13px; font-weight: 500; color: var(--color-text-secondary); }
    .tfm-prop-label svg { width: 15px; height: 15px; stroke: currentColor; fill: none; stroke-width: 1.8; opacity: 0.85; flex-shrink: 0; }
    .tfm-prop-value { display: inline-flex; align-items: center; min-width: 0; flex: 1; }
    .tfm-prop-value--clock { flex-wrap: wrap; }

    .tfm-status-pill { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 8px; border-radius: 6px; border: 1px solid transparent; background: transparent; color: var(--color-text-primary); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; cursor: pointer; transition: all 140ms ease; }
    .tfm-status-pill:hover, .tfm-status-pill[aria-expanded="true"] { background: var(--color-surface-secondary); border-color: var(--color-border); }
    .tfm-chevron-svg { width: 13px; height: 13px; stroke: var(--color-text-secondary); fill: none; stroke-width: 2.2; transition: transform 140ms ease; flex-shrink: 0; }
    .tfm-chevron-svg--open { transform: rotate(180deg); }

    .tfm-prop-grid .tfm-chip, .tfm-chip.tfm-chip--clean, .tfm-chip--clean { border: 1px solid transparent !important; background: transparent !important; height: 30px !important; padding: 0 8px !important; border-radius: 6px !important; box-shadow: none !important; font-weight: 500; color: var(--color-text-primary); }
    .tfm-prop-grid .tfm-chip:hover, .tfm-chip.tfm-chip--clean:hover, .tfm-chip--clean:hover, .tfm-prop-grid .tfm-chip[aria-expanded="true"], .tfm-chip.tfm-chip--clean[aria-expanded="true"], .tfm-chip--clean[aria-expanded="true"] { background: var(--color-surface-secondary) !important; border-color: var(--color-border) !important; }
    .tfm-chip--empty { color: var(--color-text-secondary) !important; }
    .tfm-chip--readonly { cursor: default; }
    .tfm-chip--readonly:hover { background: transparent !important; border-color: transparent !important; }
    .tfm-avatar-circle { width: 22px; height: 22px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; background: color-mix(in srgb, var(--color-accent) 18%, transparent); color: var(--color-accent); flex-shrink: 0; }

    .tfm-inline-prop-box { display: inline-flex; align-items: center; gap: 4px; height: 30px; padding: 0 8px; border: 1px solid transparent; border-radius: 6px; background: transparent; transition: all 140ms ease; }
    .tfm-inline-prop-box:hover { background: var(--color-surface-secondary); border-color: var(--color-border); }
    .tfm-inline-prop-box:focus-within { background: var(--color-surface); border-color: var(--color-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 20%, transparent); }
    .tfm-inline-prop-input { min-width: 58px; width: 68px; border: 0; outline: none; background: transparent; font: inherit; font-size: 13px; font-weight: 600; color: var(--color-text-primary); -moz-appearance: textfield; }
    .tfm-inline-prop-input::-webkit-inner-spin-button,
    .tfm-inline-prop-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    .tfm-inline-prop-input--progress { min-width: 40px; width: 44px; }
    .tfm-inline-prop-unit { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
    .tfm-completed-hours { font-size: 12px; color: var(--color-text-secondary); margin-left: 6px; white-space: nowrap; }

    .tfm-clock-readonly { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface-secondary); }
    .tfm-clock-readonly__timer { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }
    .tfm-clock-readonly__timer svg { width: 14px; height: 14px; stroke: var(--color-accent); fill: none; stroke-width: 2; }
    .tfm-clock-readonly__badge { font-size: 11px; color: var(--color-text-secondary); }

    .tfm-doc-divider { height: 1px; background: var(--color-border); margin: 6px 0 10px; }
    .tfm-doc-section { display: flex; flex-direction: column; gap: 8px; }
    .tfm-doc-section-title { font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
    .tfm-doc-section-head { display: flex; align-items: center; gap: 8px; }
    .tfm-doc-section-icon { display: inline-flex; align-items: center; justify-content: center; }
    .tfm-doc-section-icon svg { width: 15px; height: 15px; stroke: var(--color-text-secondary); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .tfm-doc-count { display: inline-flex; min-width: 18px; height: 18px; align-items: center; justify-content: center; padding: 0 5px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
    .tfm-doc-section--collapsible { border: 1px solid var(--color-border); border-radius: 8px; padding: 12px 14px; background: var(--color-surface); }
    .tfm-doc-section-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; border: 0; background: transparent; padding: 0; cursor: pointer; color: var(--color-text-primary); }
    .tfm-doc-activity-body { padding-top: 12px; margin-top: 8px; border-top: 1px solid var(--color-border); }
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
    .tfm-subtask-unassigned-icon { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; border: 1px dashed var(--color-border); color: var(--color-text-secondary); }
    .tfm-subtask-unassigned-icon svg { width: 12px; height: 12px; fill: currentColor; }
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
    .tfm-subtask-hidden-date { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; border: 0; padding: 0; margin: 0; }
    .tfm-subtask-btn-cancel { height: 26px; padding: 0 8px; border: none; background: transparent; color: var(--color-text-secondary); font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer; border-radius: 4px; transition: background-color 120ms ease, color 120ms ease; }
    .tfm-subtask-btn-cancel:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .tfm-subtask-btn-save { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px; border: none; border-radius: 6px; background: #1e293b; color: #ffffff; font-family: inherit; font-size: 12px; font-weight: 500; cursor: pointer; transition: opacity 120ms ease, background-color 120ms ease; }
    .tfm-subtask-btn-save:hover:not(:disabled) { background: #0f172a; }
    .tfm-subtask-btn-save:disabled { opacity: 0.45; cursor: not-allowed; }
    .tfm-subtask-enter-symbol { font-size: 11px; opacity: 0.8; }
    .tfm-subtask-divider { height: 1px; background: var(--color-border); margin: 8px 0 12px; }
    .tfm__save { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 16px; border: 0; border-radius: 6px; background: var(--color-accent); color: var(--color-primary-contrast, #fff); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; transition: opacity 160ms ease; }
    .tfm__save:disabled { opacity: 0.5; cursor: not-allowed; }
    .tfm__error { margin: 0; font-size: 13px; color: var(--color-danger-text, var(--color-danger)); }
    .tfm__foot { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 16px 30px; border-top: 1px solid var(--color-border); background: var(--color-surface); }
    .tfm--create .tfm__foot { border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; position: relative; z-index: 10; }
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
    .tfm-editor { position: relative; display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: 9px; overflow: visible; background: var(--color-surface); min-height: 140px; transition: border-color 150ms ease, box-shadow 150ms ease; }
    .tfm-editor:focus-within { border-color: var(--color-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 25%, transparent); }
    .tfm-editor__toolbar { border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; background: var(--color-surface-secondary); border-bottom: 1px solid var(--color-border); user-select: none; }
    .tfm-editor__tool { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; border-radius: 5px; background: transparent; color: var(--color-text-secondary); font-size: 13px; cursor: pointer; transition: background-color 120ms ease, color 120ms ease; }
    .tfm-editor__tool:hover { background: var(--color-surface); color: var(--color-text-primary); }
    .tfm-editor__tool--active { background: color-mix(in srgb, var(--color-accent) 18%, var(--color-surface)) !important; color: var(--color-accent) !important; font-weight: 700; }
    .tfm-tool-h-label { font-size: 11.5px; font-weight: 700; letter-spacing: -0.01em; line-height: 1; }
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
    .tfm-link-btn--remove { background: transparent; color: var(--color-danger); margin-right: auto; padding-left: 2px; }
    .tfm-link-btn--remove:hover { background: var(--color-danger-subtle); }
    .tfm-link-btn--apply { background: var(--color-accent); color: #fff; }
    .tfm-link-btn--apply:hover { opacity: 0.9; }
    .tfm-link-btn--apply:disabled { opacity: 0.4; cursor: not-allowed; }
    .tfm-editor__divider { width: 1px; height: 16px; background: var(--color-border); margin: 0 4px; }
    .tfm-editor__content { width: 100%; min-height: 96px; padding: 12px 14px; outline: none; font: inherit; font-size: 14px; line-height: 1.6; color: var(--color-text-primary); overflow-y: auto; word-break: break-word; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; }
    .tfm-editor__content:empty::before { content: attr(data-placeholder); color: var(--color-text-secondary); opacity: 0.65; pointer-events: none; }
    /*
     * The rules below style content that lands inside .tfm-editor__content and .tfm-editor__preview
     * via raw DOM APIs (execCommand/insertNode) or [innerHTML] - never through Angular's template
     * compiler. Angular's emulated view encapsulation stamps a scoping attribute only on elements it
     * renders itself, so a plain scoped selector like ".tfm-editor__content ul" silently never matches
     * these nodes. ::ng-deep drops that attribute requirement for the unscoped part of the selector.
     */
    .tfm-editor__content ::ng-deep h1 { display: block; font-size: 22px !important; font-weight: 750 !important; line-height: 1.3 !important; margin: 16px 0 6px !important; color: var(--color-text-primary); }
    .tfm-editor__content ::ng-deep h2 { display: block; font-size: 18px !important; font-weight: 700 !important; line-height: 1.35 !important; margin: 12px 0 4px !important; color: var(--color-text-primary); }
    .tfm-editor__content ::ng-deep h3 { display: block; font-size: 15px !important; font-weight: 650 !important; line-height: 1.4 !important; margin: 10px 0 4px !important; color: var(--color-text-primary); }
    .tfm-editor__content ::ng-deep p, .tfm-editor__content ::ng-deep div { font-size: 14px; line-height: 1.6; }
    .tfm-editor__content ::ng-deep strong, .tfm-editor__content ::ng-deep b { font-weight: 700 !important; font-size: inherit; }
    .tfm-editor__content ::ng-deep em, .tfm-editor__content ::ng-deep i { font-style: italic; }
    .tfm-editor__content ::ng-deep u { text-decoration: underline; }
    .tfm-editor__content ::ng-deep h3, ::ng-deep .tfm-preview-h2 { margin: 8px 0 4px; font-size: 15px; font-weight: 700; color: var(--color-text-primary); }
    .tfm-editor__content ::ng-deep hr, ::ng-deep .tfm-preview-hr { border: 0; height: 1px; background: var(--color-border); margin: 12px 0; }
    .tfm-editor__content ::ng-deep ul { margin: 6px 0; padding-left: 20px; list-style-type: disc; }
    .tfm-editor__content ::ng-deep ol { margin: 6px 0; padding-left: 20px; list-style-type: decimal; }
    .tfm-editor__content ::ng-deep li { margin-bottom: 2px; }
    .tfm-editor__content ::ng-deep code, ::ng-deep .tfm-inline-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12.5px; background: var(--color-surface-secondary); border: 1px solid var(--color-border); padding: 1px 5px; border-radius: 4px; color: var(--color-accent); }
    .tfm-editor__content ::ng-deep pre { margin: 6px 0; padding: 8px 12px; border-radius: 6px; background: var(--color-surface-secondary); border: 1px solid var(--color-border); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12.5px; overflow-x: auto; }
    .tfm-editor__content ::ng-deep .tfm-check-item,
    .tfm-editor__content ::ng-deep .tfm-editor-check-item {
      position: relative;
      display: block !important;
      padding-left: 26px;
      min-height: 24px;
      line-height: 1.6;
      margin: 3px 0;
      color: var(--color-text-primary);
    }
    .tfm-editor__content ::ng-deep .tfm-check-item > input[type="checkbox"],
    .tfm-editor__content ::ng-deep .tfm-editor-check-item > input[type="checkbox"] {
      position: absolute;
      left: 2px;
      top: 4px;
      width: 15px;
      height: 15px;
      accent-color: var(--color-accent);
      cursor: pointer;
      user-select: none;
      margin: 0;
    }
    .tfm-editor__content ::ng-deep .tfm-check-item > .tfm-check-text,
    .tfm-editor__content ::ng-deep .tfm-editor-check-item > .tfm-check-text {
      display: inline;
      font: inherit;
      color: inherit;
    }
    .tfm-editor__content ::ng-deep .tfm-check-item.is-checked > .tfm-check-text,
    .tfm-editor__content ::ng-deep .tfm-editor-check-item.is-checked > .tfm-check-text,
    .tfm-editor__content ::ng-deep .tfm-check-item:has(> input[type="checkbox"]:checked) > .tfm-check-text,
    .tfm-editor__content ::ng-deep .tfm-editor-check-item:has(> input[type="checkbox"]:checked) > .tfm-check-text {
      text-decoration: line-through;
      opacity: 0.6;
    }
    ::ng-deep .tfm-preview-link { color: var(--color-accent); text-decoration: underline; cursor: pointer; }

    /* Slash Command Palette */
    .tfm-slash-menu { position: absolute; z-index: 1100; width: 300px; max-height: 310px; overflow-y: auto; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: 0 16px 36px -4px rgba(15, 23, 42, 0.18), 0 4px 12px -2px rgba(15, 23, 42, 0.08); animation: tfm-popover-in 120ms ease-out; display: flex; flex-direction: column; padding: 4px; }
    .tfm-slash-menu--empty { padding: 14px; text-align: center; }
    .tfm-slash-empty-text { font-size: 12px; color: var(--color-text-secondary); font-style: italic; }
    .tfm-slash-menu__head { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px 4px; font-size: 10.5px; font-weight: 700; color: var(--color-text-secondary); letter-spacing: .06em; text-transform: uppercase; border-bottom: 1px solid var(--color-border); margin-bottom: 4px; }
    .tfm-slash-hint { font-size: 10px; font-weight: 500; text-transform: none; opacity: 0.8; }
    .tfm-slash-menu__list { display: flex; flex-direction: column; gap: 1px; }
    .tfm-slash-group-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary); padding: 8px 8px 3px; }
    .tfm-slash-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 8px; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-primary); font: inherit; cursor: pointer; text-align: left; transition: background-color 100ms ease; }
    .tfm-slash-item:hover, .tfm-slash-item--active { background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); color: var(--color-accent); }
    .tfm-slash-icon { width: 26px; height: 26px; border-radius: 5px; background: var(--color-surface-secondary); display: inline-flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 700; color: var(--color-text-primary); flex-shrink: 0; }
    .tfm-slash-item:hover .tfm-slash-icon, .tfm-slash-item--active .tfm-slash-icon { background: var(--color-surface); color: var(--color-accent); }
    .tfm-slash-icon svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .tfm-slash-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .tfm-slash-name-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .tfm-slash-name { font-size: 13px; font-weight: 600; color: inherit; line-height: 1.25; }
    .tfm-slash-active-badge { display: inline-flex; align-items: center; padding: 1px 5px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 4px; background: color-mix(in srgb, var(--color-accent) 14%, transparent); color: var(--color-accent); flex-shrink: 0; }
    .tfm-slash-check-icon { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin-left: auto; color: var(--color-accent); flex-shrink: 0; }
    .tfm-slash-check-icon svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 2.5; fill: none; }
    .tfm-slash-item--current { background: color-mix(in srgb, var(--color-accent) 5%, transparent); }
    .tfm-slash-item--current .tfm-slash-icon { background: color-mix(in srgb, var(--color-accent) 15%, var(--color-surface)); color: var(--color-accent); }
    .tfm-slash-desc { font-size: 11px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

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
    .tfm-popover--right { left: auto; right: 0; }
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
    .tfm-dot--unset { background: transparent; border: 1.5px solid var(--color-border, #94a3b8); }

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
  private readonly fileApi = inject(FileApiService, { optional: true });

  readonly open = input(false);
  readonly mode = input<TaskFormMode>('create');
  readonly projectId = input.required<string>();
  readonly taskId = input<string>('');
  readonly prefillModuleId = input<string>('');
  readonly prefillSprintId = input<string>('');

  readonly closed = output<void>();
  readonly created = output<string>();
  readonly saved = output<void>();
  readonly taskSelected = output<string>();

  internalMode = signal<TaskFormMode | null>(null);
  currentEffectiveMode = computed(() => this.internalMode() ?? this.mode());

  activeTaskId = signal<string>('');
  currentTaskId = computed(() => this.activeTaskId() || this.taskId());
  parentTask = signal<WorkTask | null>(null);
  private lastInputTaskId = '';

  task = signal<WorkTask | null>(null);
  currentEmployeeId = computed(() => this.currentEmployee.id());
  subtasks = computed(() => {
    const map = this.boardStore.subtasksByParentId?.();
    const id = this.task()?.id;
    return map && id ? (map[id] ?? []) : [];
  });
  subtaskCompletedCount = computed(() =>
    this.subtasks().filter((s) => this.statuses().find((st) => st.id === s.statusId)?.marksTaskComplete).length
  );
  subtasksCollapsed = signal(false);
  openSubtasksCount = computed(() => this.subtasks().length - this.subtaskCompletedCount());
  subtaskProgressPercent = computed(() => {
    const total = this.subtasks().length;
    return total === 0 ? 0 : Math.round((this.subtaskCompletedCount() / total) * 100);
  });
  forMeSubtasksCount = computed(() => {
    const me = this.currentEmployeeId();
    if (!me) return 0;
    return this.subtasks().filter((s) => s.assigneeEmployeeIds.includes(me)).length;
  });

  addingSubtask = signal(false);
  newSubtaskTitle = signal('');
  newSubtaskDueDate = signal('');
  newSubtaskAssigneeId = signal<string | null>(null);
  newSubtaskPriority = signal<WorkTask['priority'] | null>(null);
  newSubtaskModuleId = signal<string>('');
  newSubtaskPickerOpen = signal(false);
  subtaskPriorityPickerOpen = signal(false);
  activeSubtaskPopover = signal<{ id: string; type: 'assignee' | 'priority' | 'status' | 'module' } | null>(null);

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
  sprints = signal<readonly Sprint[]>([]);
  sprintId = signal('');
  assignableMembers = signal<readonly { employeeId: string; name: string; avatarUrl: string | null }[]>([]);
  assigneeEmployeeId = signal('');
  private originalAssigneeId = signal('');
  categoryId = signal('');
  allocationHint = signal<InsufficientAllocationErrorDto | null>(null);

  submitting = signal(false);
  errors = signal<Record<string, string>>({});
  errorMessage = signal<string | null>(null);

  activePopover = signal<'assignee' | 'priority' | 'dueDate' | 'module' | 'sprint' | 'category' | 'splitMenu' | 'status' | null>(null);
  showActivityLog = signal(true);
  showMoreFields = signal(true);
  assigneeSearchQuery = signal('');
  moduleSearchQuery = signal('');
  successToastMessage = signal<string | null>(null);
  attachedFiles = signal<AttachmentPill[]>([]);

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
  readonly attachmentFileInput = viewChild<ElementRef<HTMLInputElement>>('attachmentFileInput');
  private previouslyFocused: HTMLElement | null = null;

  readonly allSlashCommands = ALL_SLASH_COMMANDS;
  showSlashMenu = signal(false);
  slashQuery = signal('');
  slashSelectedIndex = signal(0);
  slashMenuCoords = signal<{ top: number; left: number } | null>(null);

  activeFormats = signal<{
    bold: boolean;
    italic: boolean;
    underline: boolean;
    h1: boolean;
    h2: boolean;
    code: boolean;
    bullet: boolean;
    numbered: boolean;
    checklist: boolean;
    highlight: boolean;
    link: boolean;
  }>({
    bold: false,
    italic: false,
    underline: false,
    h1: false,
    h2: false,
    code: false,
    bullet: false,
    numbered: false,
    checklist: false,
    highlight: false,
    link: false
  });

  filteredSlashCommands = computed(() => {
    const q = this.slashQuery().toLowerCase().trim();
    if (!q) return this.allSlashCommands;
    return this.allSlashCommands.filter((cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });

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
  assigneeAvatarUrl = computed(() => {
    const id = this.assigneeEmployeeId();
    return this.assignableMembers().find((m) => m.employeeId === id)?.avatarUrl ?? null;
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
    const objId = this.selectedObjectiveId() || this.task()?.objectiveId;
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
    if (sprintId) {
      const sp = this.sprints().find((s) => s.id === sprintId);
      if (sp?.objectiveId) {
        this.selectedObjectiveId.set(sp.objectiveId);
        this.clearError('objectiveId');
      }
    }
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
      const key = `${this.mode()}:${effectiveId}:${isOpen}`;
      if (key === this.loadedKey) return;
      this.loadedKey = key;
      untracked(() => {
        this.resetForm();
        if (this.mode() === 'create') void this.loadCreateContext();
        else void this.loadForTaskId(effectiveId);
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
        this.normalizeBlockLines(el);
      }
    });
  }

  private resetForm(): void {
    this.task.set(null);
    this.title.set('');
    this.description.set('');
    const editorEl = this.descEditor()?.nativeElement;
    if (editorEl) editorEl.innerHTML = '';
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
    this.closeSlashMenu();
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
        const objId = this.selectedObjectiveId();
        const activeSprints = this.sprints().filter((s) => s.status === 'active' && (!objId || s.objectiveId === objId));
        if (activeSprints.length === 1) {
          this.sprintId.set(activeSprints[0].id);
        }
      }

      // If sprint is selected (via prefill or auto active), ensure module is inherited
      if (this.sprintId()) {
        const matchingSprint = this.sprints().find((s) => s.id === this.sprintId());
        if (matchingSprint?.objectiveId && (!this.selectedObjectiveId() || !this.prefillModuleId())) {
          this.selectedObjectiveId.set(matchingSprint.objectiveId);
          this.clearError('objectiveId');
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
    const editorEl = this.descEditor()?.nativeElement;
    if (editorEl) {
      editorEl.innerHTML = t.description ?? '';
      this.normalizeBlockLines(editorEl);
    }
    this.priority.set(t.priority);
    this.dueDate.set(t.dueDate ? t.dueDate.toISOString().slice(0, 10) : '');
    this.estimatedHours.set(t.estimatedHours);
    this.storyPoints.set(t.storyPoints);
    this.progressPercent.set(t.progressPercent);
    this.reason.set('');
    this.statusId.set(t.statusId);
    this.selectedObjectiveId.set(t.objectiveId);
    this.sprintId.set(t.sprintId ?? '');
    const currentAssignee = t.assigneeEmployeeIds[0] ?? '';
    this.assigneeEmployeeId.set(currentAssignee);
    this.originalAssigneeId.set(currentAssignee);
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
    this.saved.emit();
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
      this.cleanupUnsavedAttachments();
      this.closed.emit();
    }
  }

  onEscape(): void {
    if (this.showSlashMenu()) {
      this.closeSlashMenu();
      return;
    }
    if (this.activePopover() || this.activeSubtaskPopover()) {
      this.activePopover.set(null);
      this.activeSubtaskPopover.set(null);
    } else {
      this.cleanupUnsavedAttachments();
      this.closed.emit();
    }
  }

  togglePopover(name: 'assignee' | 'priority' | 'dueDate' | 'module' | 'sprint' | 'category' | 'splitMenu' | 'status', event: MouseEvent): void {
    event.stopPropagation();
    this.activeSubtaskPopover.set(null);
    this.activePopover.update((curr) => (curr === name ? null : name));
  }

  closePopover(): void {
    this.activePopover.set(null);
    this.activeSubtaskPopover.set(null);
    this.showLinkPopover.set(false);
    this.showTextColorPopover.set(false);
    this.showHighlightPopover.set(false);
    this.closeSlashMenu();
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

  formatDoc(command: string, value: string | undefined = undefined): void {
    const el = this.descEditor()?.nativeElement;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, value);
    this.onEditorInput();
    this.updateActiveFormats();
  }

  private getEditorAnchorNode(el: HTMLElement, sel: Selection | null): Node | null {
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);

    if (sel.anchorNode && el.contains(sel.anchorNode) && sel.anchorNode !== el) {
      return sel.anchorNode;
    }

    if (range && el.contains(range.startContainer) && range.startContainer !== el) {
      return range.startContainer;
    }

    if (range && range.startContainer === el) {
      const child = el.childNodes[range.startOffset] ?? el.childNodes[Math.max(0, range.startOffset - 1)] ?? el.firstChild;
      if (child) return child;
    }

    if (sel.anchorNode === el) {
      const child = el.childNodes[sel.anchorOffset] ?? el.childNodes[Math.max(0, sel.anchorOffset - 1)] ?? el.firstChild;
      if (child) return child;
    }

    return null;
  }

  normalizeBlockLines(editor: HTMLElement): void {
    if (!editor) return;

    if (!editor.hasChildNodes()) {
      editor.innerHTML = '<div><br></div>';
      return;
    }

    const isBlockTag = (tag: string): boolean => {
      return ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'pre', 'hr', 'table'].includes(tag);
    };

    let needsNormalization = false;
    for (const child of Array.from(editor.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim()) {
        needsNormalization = true;
        break;
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (tag === 'br') {
          needsNormalization = true;
          break;
        }
        if (tag === 'div' || tag === 'p' || /^h[1-6]$/.test(tag)) {
          if (!el.classList.contains('tfm-check-item')) {
            const brs = el.querySelectorAll('br');
            const hasText = !!(el.textContent ?? '').trim();
            if (hasText && brs.length > 0) {
              needsNormalization = true;
              break;
            }
          }
        } else if (!isBlockTag(tag)) {
          needsNormalization = true;
          break;
        }
      }
    }

    if (!needsNormalization) {
      return;
    }

    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    let savedNode: Node | null = null;
    let savedOffset = 0;
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      if (editor.contains(r.startContainer)) {
        savedNode = r.startContainer;
        savedOffset = r.startOffset;
      }
    }

    const fragment = document.createDocumentFragment();
    let currentBucket: Node[] = [];

    const flushBucket = (tag = 'div') => {
      if (currentBucket.length === 0) return;
      const block = document.createElement(tag);
      for (const n of currentBucket) {
        block.appendChild(n);
      }
      if (!block.textContent?.trim() && !block.querySelector('img, a, input')) {
        block.innerHTML = '<br>';
      }
      fragment.appendChild(block);
      currentBucket = [];
    };

    for (const child of Array.from(editor.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        currentBucket.push(child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (tag === 'br') {
          flushBucket('div');
        } else if (!isBlockTag(tag)) {
          currentBucket.push(el);
        } else if (tag === 'div' || tag === 'p' || /^h[1-6]$/.test(tag)) {
          flushBucket('div');
          if (el.classList.contains('tfm-check-item')) {
            fragment.appendChild(el);
          } else {
            const brs = el.querySelectorAll('br');
            const hasText = !!(el.textContent ?? '').trim();
            if (hasText && brs.length > 0) {
              let subNodes: Node[] = [];
              let hadPreviousBr = false;
              for (const sub of Array.from(el.childNodes)) {
                if (sub.nodeType === Node.ELEMENT_NODE && (sub as Element).tagName.toLowerCase() === 'br') {
                  if (subNodes.length > 0) {
                    const subBlock = document.createElement(tag);
                    for (const sn of subNodes) subBlock.appendChild(sn);
                    if (!subBlock.textContent?.trim()) subBlock.innerHTML = '<br>';
                    fragment.appendChild(subBlock);
                    subNodes = [];
                  } else if (hadPreviousBr) {
                    const emptyBlock = document.createElement(tag);
                    emptyBlock.innerHTML = '<br>';
                    fragment.appendChild(emptyBlock);
                  }
                  hadPreviousBr = true;
                } else {
                  subNodes.push(sub);
                  hadPreviousBr = false;
                }
              }
              if (subNodes.length > 0) {
                const subBlock = document.createElement(tag);
                for (const sn of subNodes) subBlock.appendChild(sn);
                if (!subBlock.textContent?.trim()) subBlock.innerHTML = '<br>';
                fragment.appendChild(subBlock);
              }
            } else {
              fragment.appendChild(el);
            }
          }
        } else {
          flushBucket('div');
          fragment.appendChild(el);
        }
      }
    }
    flushBucket('div');

    editor.innerHTML = '';
    editor.appendChild(fragment);

    if (sel && savedNode && editor.contains(savedNode)) {
      try {
        const r = document.createRange();
        r.setStart(savedNode, Math.min(savedOffset, savedNode.textContent?.length ?? 0));
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      } catch {}
    }
  }

  private getTargetBlocks(editor: HTMLElement, sel: Selection): HTMLElement[] {
    if (!sel || sel.rangeCount === 0) return [];
    const range = sel.getRangeAt(0);

    const startAnchor = this.getEditorAnchorNode(editor, sel) ?? (range && editor.contains(range.startContainer) ? range.startContainer : null);
    const endAnchor = (sel.focusNode && editor.contains(sel.focusNode) && sel.focusNode !== editor)
      ? sel.focusNode
      : (range && editor.contains(range.endContainer) && range.endContainer !== editor
          ? range.endContainer
          : startAnchor);

    const startBlock = this.findClosestBlockElement(startAnchor);
    const endBlock = this.findClosestBlockElement(endAnchor);

    if (!startBlock && !endBlock) {
      const first = editor.firstElementChild as HTMLElement | null;
      return first ? [first] : [];
    }

    if (!startBlock) return endBlock ? [endBlock] : [];
    if (!endBlock || startBlock === endBlock) return [startBlock];

    const allChildren = Array.from(editor.children) as HTMLElement[];
    const startIdx = allChildren.indexOf(startBlock);
    const endIdx = allChildren.indexOf(endBlock);

    if (startIdx === -1 || endIdx === -1) return [startBlock];

    const low = Math.min(startIdx, endIdx);
    const high = Math.max(startIdx, endIdx);
    return allChildren.slice(low, high + 1);
  }

  isSlashCommandActive(cmdId: string): boolean {
    const af = this.activeFormats();
    switch (cmdId) {
      case 'h1':
        return af.h1;
      case 'h2':
        return af.h2;
      case 'p':
        return !af.h1 && !af.h2 && !af.checklist && !af.bullet && !af.numbered && !af.code;
      case 'checklist':
        return af.checklist;
      case 'bullet':
        return af.bullet;
      case 'numbered':
        return af.numbered;
      case 'code':
        return af.code;
      case 'bold':
        return af.bold;
      case 'italic':
        return af.italic;
      case 'underline':
        return af.underline;
      case 'highlight':
        return af.highlight;
      case 'link':
        return af.link;
      default:
        return false;
    }
  }

  toggleHeading(tag: 'h1' | 'h2'): void {
    const el = this.descEditor()?.nativeElement;
    if (!el) return;

    this.normalizeBlockLines(el);

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const blocks = this.getTargetBlocks(el, sel);
    if (blocks.length === 0) {
      const heading = document.createElement(tag);
      heading.appendChild(document.createElement('br'));
      el.appendChild(heading);
      const r = document.createRange();
      r.setStart(heading, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      this.onEditorInput();
      this.updateActiveFormats();
      return;
    }

    const allAlreadyThisHeading = blocks.every((b) => b.tagName.toLowerCase() === tag);
    let lastCreated: HTMLElement | null = null;

    for (const block of blocks) {
      if (allAlreadyThisHeading) {
        // Toggle OFF -> convert to normal <div>
        const div = document.createElement('div');
        while (block.firstChild) {
          div.appendChild(block.firstChild);
        }
        if (!div.textContent?.trim()) {
          div.appendChild(document.createElement('br'));
        }
        block.replaceWith(div);
        lastCreated = div;
      } else {
        if (block.tagName.toLowerCase() === tag) {
          lastCreated = block;
          continue;
        }
        const heading = document.createElement(tag);
        if (block.classList.contains('tfm-check-item')) {
          const text = (block.querySelector('.tfm-check-text')?.textContent ?? block.textContent ?? '').trim();
          if (text) heading.textContent = text;
          else heading.appendChild(document.createElement('br'));
        } else {
          while (block.firstChild) {
            heading.appendChild(block.firstChild);
          }
          if (!heading.textContent?.trim()) {
            heading.appendChild(document.createElement('br'));
          }
        }
        block.replaceWith(heading);
        lastCreated = heading;
      }
    }

    if (lastCreated) {
      const r = document.createRange();
      if (lastCreated.firstChild) {
        r.selectNodeContents(lastCreated);
        r.collapse(false);
      } else {
        r.setStart(lastCreated, 0);
        r.collapse(true);
      }
      sel.removeAllRanges();
      sel.addRange(r);
    }

    this.onEditorInput();
    this.updateActiveFormats();
  }

  formatNormalText(): void {
    const el = this.descEditor()?.nativeElement;
    if (!el) return;

    this.normalizeBlockLines(el);

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const blocks = this.getTargetBlocks(el, sel);
    let lastCreated: HTMLElement | null = null;

    for (const block of blocks) {
      if (block.tagName.toLowerCase() === 'div' && !block.classList.contains('tfm-check-item')) {
        lastCreated = block;
        continue;
      }

      const div = document.createElement('div');
      if (block.classList.contains('tfm-check-item')) {
        const text = (block.querySelector('.tfm-check-text')?.textContent ?? block.textContent ?? '').trim();
        if (text) div.textContent = text;
        else div.appendChild(document.createElement('br'));
      } else {
        while (block.firstChild) {
          div.appendChild(block.firstChild);
        }
        if (!div.textContent?.trim()) {
          div.appendChild(document.createElement('br'));
        }
      }
      block.replaceWith(div);
      lastCreated = div;
    }

    if (lastCreated) {
      const r = document.createRange();
      if (lastCreated.firstChild) {
        r.selectNodeContents(lastCreated);
        r.collapse(false);
      } else {
        r.setStart(lastCreated, 0);
        r.collapse(true);
      }
      sel.removeAllRanges();
      sel.addRange(r);
    }

    this.onEditorInput();
    this.updateActiveFormats();
  }

  toggleChecklist(): void {
    const el = this.descEditor()?.nativeElement;
    if (!el) return;

    this.normalizeBlockLines(el);

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const blocks = this.getTargetBlocks(el, sel);
    if (blocks.length === 0) {
      const item = this.createChecklistItem('');
      el.appendChild(item);
      const textSpan = item.querySelector('.tfm-check-text');
      const r = document.createRange();
      r.setStart(textSpan ?? item, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      this.onEditorInput();
      this.updateActiveFormats();
      return;
    }

    const allChecklist = blocks.every((b) => b.classList.contains('tfm-check-item'));
    let lastCreated: HTMLElement | null = null;

    for (const block of blocks) {
      if (allChecklist) {
        // Toggle OFF -> convert to normal <div>
        const text = (block.querySelector('.tfm-check-text')?.textContent ?? block.textContent ?? '').trim();
        const div = document.createElement('div');
        if (text) div.textContent = text;
        else div.appendChild(document.createElement('br'));
        block.replaceWith(div);
        lastCreated = div;
      } else {
        if (block.classList.contains('tfm-check-item')) {
          lastCreated = block;
          continue;
        }
        const text = (block.textContent ?? '').trim();
        const item = this.createChecklistItem(text);
        block.replaceWith(item);
        lastCreated = item;
      }
    }

    if (lastCreated) {
      const textSpan = lastCreated.querySelector('.tfm-check-text') ?? lastCreated;
      const r = document.createRange();
      if (textSpan.firstChild) {
        r.selectNodeContents(textSpan);
        r.collapse(false);
      } else {
        r.setStart(textSpan, 0);
        r.collapse(true);
      }
      sel.removeAllRanges();
      sel.addRange(r);
    }

    this.onEditorInput();
    this.updateActiveFormats();
  }

  toggleCode(): void {
    const el = this.descEditor()?.nativeElement;
    if (!el) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const anchor = this.getEditorAnchorNode(el, sel);
    if (!anchor) return;

    let curr: HTMLElement | null = anchor instanceof HTMLElement ? anchor : (anchor.parentElement ?? null);
    let codeEl: HTMLElement | null = null;
    while (curr && curr !== el) {
      if (curr.tagName.toLowerCase() === 'code' || curr.classList.contains('tfm-inline-code')) {
        codeEl = curr;
        break;
      }
      curr = curr.parentElement;
    }

    if (codeEl && codeEl.parentElement) {
      // Turn code OFF -> unwrap code element into plain text
      const text = codeEl.textContent ?? '';
      const textNode = document.createTextNode(text);
      codeEl.parentElement.replaceChild(textNode, codeEl);

      const r = document.createRange();
      r.setStartAfter(textNode);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      this.onEditorInput();
      this.updateActiveFormats();
      return;
    }

    this.formatCode();
    this.updateActiveFormats();
  }

  formatCode(): void {
    const el = this.descEditor()?.nativeElement;
    if (!el) return;

    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const anchor = this.getEditorAnchorNode(el, selection);

    if (selection && range && anchor && !selection.isCollapsed) {
      const code = document.createElement('code');
      code.className = 'tfm-inline-code';
      code.textContent = selection.toString();
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

      let r: Range;
      if (range && anchor) {
        r = range;
      } else {
        r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
      }
      r.deleteContents();
      r.insertNode(code);

      const selectRange = document.createRange();
      selectRange.selectNodeContents(code);
      selection?.removeAllRanges();
      selection?.addRange(selectRange);
    }
    this.onEditorInput();
    this.updateActiveFormats();
  }

  formatList(type: 'unordered' | 'ordered'): void {
    const el = this.descEditor()?.nativeElement;
    if (!el) return;

    this.normalizeBlockLines(el);

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const listTag = type === 'unordered' ? 'ul' : 'ol';
    const blocks = this.getTargetBlocks(el, sel);

    if (blocks.length === 0) {
      const list = document.createElement(listTag);
      const li = document.createElement('li');
      li.appendChild(document.createElement('br'));
      list.appendChild(li);
      el.appendChild(list);
      const r = document.createRange();
      r.setStart(li, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      this.onEditorInput();
      this.updateActiveFormats();
      return;
    }

    const allThisList = blocks.every((b) => b.tagName.toLowerCase() === listTag);
    let lastCreated: HTMLElement | null = null;

    for (const block of blocks) {
      if (allThisList) {
        const lis = Array.from(block.querySelectorAll('li'));
        if (lis.length > 0) {
          for (const li of lis) {
            const div = document.createElement('div');
            while (li.firstChild) div.appendChild(li.firstChild);
            if (!div.textContent?.trim()) div.appendChild(document.createElement('br'));
            block.before(div);
            lastCreated = div;
          }
          block.remove();
        } else {
          const div = document.createElement('div');
          div.appendChild(document.createElement('br'));
          block.replaceWith(div);
          lastCreated = div;
        }
      } else {
        const list = document.createElement(listTag);
        const li = document.createElement('li');
        if (block.classList.contains('tfm-check-item')) {
          const text = (block.querySelector('.tfm-check-text')?.textContent ?? block.textContent ?? '').trim();
          if (text) li.textContent = text;
          else li.appendChild(document.createElement('br'));
        } else {
          while (block.firstChild) li.appendChild(block.firstChild);
          if (!li.textContent?.trim()) li.appendChild(document.createElement('br'));
        }
        list.appendChild(li);
        block.replaceWith(list);
        lastCreated = li;
      }
    }

    if (lastCreated) {
      const r = document.createRange();
      if (lastCreated.firstChild) {
        r.selectNodeContents(lastCreated);
        r.collapse(false);
      } else {
        r.setStart(lastCreated, 0);
        r.collapse(true);
      }
      sel.removeAllRanges();
      sel.addRange(r);
    }

    this.onEditorInput();
    this.updateActiveFormats();
  }

  createChecklistItem(text: string): HTMLElement {
    const item = document.createElement('div');
    item.className = 'tfm-check-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('contenteditable', 'false');

    const span = document.createElement('span');
    span.className = 'tfm-check-text';
    if (text) {
      span.textContent = text;
    } else {
      span.appendChild(document.createElement('br'));
    }

    item.appendChild(checkbox);
    item.appendChild(span);
    return item;
  }

  toggleLinkPopover(event: MouseEvent): void {
    event.stopPropagation();
    if (this.showLinkPopover()) {
      this.showLinkPopover.set(false);
      return;
    }
    this.toggleLinkPopoverDirect();
  }

  toggleLinkPopoverDirect(): void {
    this.closePopover();
    const el = this.descEditor()?.nativeElement;
    const sel = window.getSelection();
    let existingAnchor: HTMLAnchorElement | null = null;

    if (el && sel && sel.rangeCount > 0) {
      const anchorNode = this.getEditorAnchorNode(el, sel);
      let curr: HTMLElement | null = anchorNode instanceof HTMLElement ? anchorNode : (anchorNode?.parentElement ?? null);
      while (curr && curr !== el) {
        if (curr.tagName.toLowerCase() === 'a') {
          existingAnchor = curr as HTMLAnchorElement;
          break;
        }
        curr = curr.parentElement;
      }
    }

    if (existingAnchor) {
      const r = document.createRange();
      r.selectNode(existingAnchor);
      sel?.removeAllRanges();
      sel?.addRange(r);
      this.savedLinkRange = r.cloneRange();
      this.linkTextInput.set(existingAnchor.textContent ?? '');
      this.linkUrlInput.set(existingAnchor.getAttribute('href') ?? existingAnchor.href ?? '');
    } else if (el && sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      this.savedLinkRange = sel.getRangeAt(0).cloneRange();
      const text = this.savedLinkRange.toString().trim();
      this.linkTextInput.set(text);
      this.linkUrlInput.set('');
    } else {
      this.savedLinkRange = null;
      this.linkTextInput.set('');
      this.linkUrlInput.set('');
    }
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
    a.title = `Ctrl+Click to open link (${href})`;

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
    this.updateActiveFormats();
  }

  removeLink(): void {
    const el = this.descEditor()?.nativeElement;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;

    const anchorNode = this.getEditorAnchorNode(el, sel);
    let curr: HTMLElement | null = anchorNode instanceof HTMLElement ? anchorNode : (anchorNode?.parentElement ?? null);
    let existingAnchor: HTMLAnchorElement | null = null;
    while (curr && curr !== el) {
      if (curr.tagName.toLowerCase() === 'a') {
        existingAnchor = curr as HTMLAnchorElement;
        break;
      }
      curr = curr.parentElement;
    }

    if (existingAnchor && existingAnchor.parentElement) {
      const text = existingAnchor.textContent ?? '';
      const textNode = document.createTextNode(text);
      existingAnchor.parentElement.replaceChild(textNode, existingAnchor);

      const r = document.createRange();
      r.setStartAfter(textNode);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }

    this.showLinkPopover.set(false);
    this.onEditorInput();
    this.updateActiveFormats();
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
    this.checkSlashMenuTrigger();
  }

  onEditorFocus(): void {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'div');
    } catch {}
  }

  onEditorChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target && target.type === 'checkbox') {
      const parent = target.closest('.tfm-check-item, .tfm-editor-check-item') as HTMLElement | null;
      if (parent) {
        if (target.checked) {
          target.setAttribute('checked', 'checked');
          parent.classList.add('is-checked');
        } else {
          target.removeAttribute('checked');
          parent.classList.remove('is-checked');
        }
      }
      this.onEditorInput();
    }
  }

  onEditorKeydown(event: KeyboardEvent): void {
    if (this.showSlashMenu()) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const items = this.filteredSlashCommands();
        if (items.length > 0) {
          this.slashSelectedIndex.update((idx) => (idx + 1) % items.length);
          this.scrollActiveSlashItemIntoView();
        }
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const items = this.filteredSlashCommands();
        if (items.length > 0) {
          this.slashSelectedIndex.update((idx) => (idx - 1 + items.length) % items.length);
          this.scrollActiveSlashItemIntoView();
        }
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const items = this.filteredSlashCommands();
        if (items.length > 0) {
          event.preventDefault();
          const selected = items[this.slashSelectedIndex()] ?? items[0];
          this.executeSlashCommand(selected.id);
          return;
        }
        this.closeSlashMenu();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.closeSlashMenu();
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      if (this.handleEnterKey(event)) {
        return;
      }
    }

    if (event.key === 'Backspace') {
      if (this.handleBackspaceKey(event)) {
        return;
      }
    }
  }

  private findClosestCheckItem(node: Node | null): HTMLElement | null {
    const editor = this.descEditor()?.nativeElement;
    if (!editor || !node || !editor.contains(node) || node === editor) return null;
    let curr: HTMLElement | null = node instanceof HTMLElement ? node : (node.parentElement ?? null);
    while (curr && curr !== editor) {
      if (curr.classList.contains('tfm-check-item') || curr.classList.contains('tfm-editor-check-item')) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  private findClosestHeading(node: Node | null): HTMLElement | null {
    const editor = this.descEditor()?.nativeElement;
    if (!editor || !node || !editor.contains(node) || node === editor) return null;
    let curr: HTMLElement | null = node instanceof HTMLElement ? node : (node.parentElement ?? null);
    while (curr && curr !== editor) {
      if (/^H[1-6]$/i.test(curr.tagName)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  private findClosestBlockElement(node: Node | null): HTMLElement | null {
    const editor = this.descEditor()?.nativeElement;
    if (!editor || !node || !editor.contains(node) || node === editor) return null;
    let curr: HTMLElement | null = node instanceof HTMLElement ? node : (node.parentElement ?? null);
    if (!curr || curr === editor) return null;
    while (curr && curr.parentElement && curr.parentElement !== editor) {
      curr = curr.parentElement;
    }
    return curr;
  }

  private handleEnterKey(event: KeyboardEvent): boolean {
    const editorEl = this.descEditor()?.nativeElement;
    if (!editorEl) return false;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    const range = sel.getRangeAt(0);
    const anchorNode = (sel.anchorNode && editorEl.contains(sel.anchorNode))
      ? sel.anchorNode
      : (range && editorEl.contains(range.startContainer) ? range.startContainer : null);

    if (!anchorNode) return false;

    const checkItem = this.findClosestCheckItem(anchorNode);
    if (checkItem) {
      event.preventDefault();
      this.handleChecklistEnter(checkItem, sel);
      return true;
    }

    const heading = this.findClosestHeading(anchorNode);
    if (heading) {
      event.preventDefault();
      this.handleHeadingEnter(heading, sel);
      return true;
    }

    return false;
  }

  private handleChecklistEnter(checkItem: HTMLElement, sel: Selection): void {
    const textSpan = checkItem.querySelector('.tfm-check-text') as HTMLElement | null;
    const itemText = (textSpan ? textSpan.textContent : checkItem.textContent)?.replace(/\s+/g, ' ').trim() ?? '';

    if (!itemText) {
      const normalLine = document.createElement('div');
      normalLine.appendChild(document.createElement('br'));
      checkItem.replaceWith(normalLine);

      const r = document.createRange();
      r.setStart(normalLine, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      this.onEditorInput();
      return;
    }

    const newItem = this.createChecklistItem('');
    checkItem.after(newItem);

    const range = sel.getRangeAt(0);
    if (textSpan && textSpan.contains(range.startContainer)) {
      const fullText = textSpan.textContent ?? '';
      const offset = range.startOffset;
      if (offset < fullText.length) {
        const remaining = fullText.slice(offset);
        textSpan.textContent = fullText.slice(0, offset);
        const newSpan = newItem.querySelector('.tfm-check-text');
        if (newSpan) {
          newSpan.textContent = remaining;
        }
      }
    }

    const targetSpan = newItem.querySelector('.tfm-check-text') ?? newItem;
    const newRange = document.createRange();
    if (targetSpan.firstChild) {
      newRange.setStart(targetSpan.firstChild, 0);
    } else {
      newRange.setStart(targetSpan, 0);
    }
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    this.onEditorInput();
  }

  private handleHeadingEnter(heading: HTMLElement, sel: Selection): void {
    const range = sel.getRangeAt(0);
    const isAtEnd = (range.startContainer === heading.lastChild || range.startContainer === heading) &&
                    range.startOffset >= (range.startContainer.textContent?.length ?? 0);

    const normalLine = document.createElement('div');
    normalLine.appendChild(document.createElement('br'));

    if (isAtEnd || !(heading.textContent ?? '').trim()) {
      heading.after(normalLine);
    } else {
      const headingRange = document.createRange();
      headingRange.setStart(range.startContainer, range.startOffset);
      headingRange.setEndAfter(heading.lastChild ?? heading);
      const afterContent = headingRange.extractContents();
      normalLine.innerHTML = '';
      normalLine.appendChild(afterContent);
      if (!normalLine.textContent?.trim()) {
        normalLine.appendChild(document.createElement('br'));
      }
      heading.after(normalLine);
    }

    const newRange = document.createRange();
    newRange.setStart(normalLine, 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    this.onEditorInput();
  }

  private handleBackspaceKey(event: KeyboardEvent): boolean {
    const editorEl = this.descEditor()?.nativeElement;
    if (!editorEl) return false;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;

    const range = sel.getRangeAt(0);
    const anchorNode = (sel.anchorNode && editorEl.contains(sel.anchorNode))
      ? sel.anchorNode
      : (range && editorEl.contains(range.startContainer) ? range.startContainer : null);

    if (!anchorNode) return false;

    const checkItem = this.findClosestCheckItem(anchorNode);
    if (checkItem) {
      const textSpan = checkItem.querySelector('.tfm-check-text');
      const text = (textSpan?.textContent ?? checkItem.textContent ?? '').replace(/\s+/g, ' ').trim();

      if (!text || (range.startOffset === 0 && (range.startContainer === textSpan || range.startContainer === textSpan?.firstChild))) {
        event.preventDefault();
        const normalLine = document.createElement('div');
        if (text) {
          normalLine.textContent = text;
        } else {
          normalLine.appendChild(document.createElement('br'));
        }
        checkItem.replaceWith(normalLine);

        const r = document.createRange();
        r.setStart(normalLine, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        this.onEditorInput();
        return true;
      }
    }

    return false;
  }

  onEditorBlur(): void {
    setTimeout(() => {
      this.closeSlashMenu();
    }, 200);
  }

  onEditorClick(event?: MouseEvent): void {
    if (event) {
      const target = event.target as HTMLElement | null;
      const link = target?.closest('a') as HTMLAnchorElement | null;
      if (link && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        const href = link.getAttribute('href') || link.href;
        if (href) {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
        return;
      }
    }
    this.checkSlashMenuTrigger();
    this.updateActiveFormats();
  }

  onEditorKeyup(): void {
    this.updateActiveFormats();
  }

  onEditorMouseup(): void {
    this.updateActiveFormats();
  }

  updateActiveFormats(): void {
    const el = this.descEditor()?.nativeElement;
    if (!el) return;

    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!sel || sel.rangeCount === 0) {
      this.activeFormats.set({
        bold: false,
        italic: false,
        underline: false,
        h1: false,
        h2: false,
        code: false,
        bullet: false,
        numbered: false,
        checklist: false,
        highlight: false,
        link: false
      });
      return;
    }

    const anchor = this.getEditorAnchorNode(el, sel);

    if (!anchor) {
      this.activeFormats.set({
        bold: false,
        italic: false,
        underline: false,
        h1: false,
        h2: false,
        code: false,
        bullet: false,
        numbered: false,
        checklist: false,
        highlight: false,
        link: false
      });
      return;
    }

    let isBold = false;
    let isItalic = false;
    let isUnderline = false;
    let isBullet = false;
    let isNumbered = false;

    try {
      if (typeof document !== 'undefined' && typeof document.queryCommandState === 'function') {
        isBold = document.queryCommandState('bold');
        isItalic = document.queryCommandState('italic');
        isUnderline = document.queryCommandState('underline');
        isBullet = document.queryCommandState('insertUnorderedList');
        isNumbered = document.queryCommandState('insertOrderedList');
      }
    } catch {}

    const checkItem = this.findClosestCheckItem(anchor);
    const heading = this.findClosestHeading(anchor);
    const isH1 = heading?.tagName.toLowerCase() === 'h1';
    const isH2 = heading?.tagName.toLowerCase() === 'h2';

    let curr: HTMLElement | null = anchor instanceof HTMLElement ? anchor : (anchor?.parentElement ?? null);
    let isCode = false;
    let isHighlight = false;
    let isLink = false;
    let hasExplicitUnderline = false;

    while (curr && curr !== el) {
      const tag = curr.tagName.toLowerCase();
      if (tag === 'a') isLink = true;
      if (tag === 'u') hasExplicitUnderline = true;
      if (tag !== 'a' && curr.style.textDecoration?.includes('underline')) hasExplicitUnderline = true;
      if (tag === 'code' || tag === 'pre' || curr.classList.contains('tfm-inline-code')) isCode = true;
      if (tag === 'b' || tag === 'strong' || curr.style.fontWeight === 'bold' || curr.style.fontWeight === '700') isBold = true;
      if (tag === 'i' || tag === 'em' || curr.style.fontStyle === 'italic') isItalic = true;
      if (tag === 'ul') isBullet = true;
      if (tag === 'ol') isNumbered = true;
      if (tag === 'mark' || (curr.style.backgroundColor && curr.style.backgroundColor !== 'transparent' && curr.style.backgroundColor !== 'inherit')) {
        isHighlight = true;
      }
      curr = curr.parentElement;
    }

    // Browsers natively return queryCommandState('underline') = true for <a> because links have default CSS underline.
    // Text in a link is only user-underlined if wrapped in <u> or having explicit inline text-decoration: underline.
    if (isLink && !hasExplicitUnderline) {
      isUnderline = false;
    } else if (hasExplicitUnderline) {
      isUnderline = true;
    }

    this.activeFormats.set({
      bold: isBold,
      italic: isItalic,
      underline: isUnderline,
      h1: isH1,
      h2: isH2,
      code: isCode,
      bullet: isBullet,
      numbered: isNumbered,
      checklist: !!checkItem,
      highlight: isHighlight,
      link: isLink
    });
  }

  getSlashTriggerContext(): { query: string; range: Range; textNode: Node; slashOffset: number } | null {
    const el = this.descEditor()?.nativeElement;
    if (!el) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;

    const anchorNode = sel.anchorNode;
    if (!anchorNode || !el.contains(anchorNode)) return null;

    if (anchorNode.nodeType !== Node.TEXT_NODE) return null;

    const text = anchorNode.textContent ?? '';
    const cursorPos = sel.anchorOffset;
    const textBeforeCursor = text.slice(0, cursorPos);

    const lastSlashIdx = textBeforeCursor.lastIndexOf('/');
    if (lastSlashIdx === -1) return null;

    if (lastSlashIdx > 0 && !/\s/.test(textBeforeCursor[lastSlashIdx - 1])) {
      return null;
    }

    const query = textBeforeCursor.slice(lastSlashIdx + 1);
    if (/\s/.test(query)) {
      return null;
    }

    return {
      query,
      range: sel.getRangeAt(0),
      textNode: anchorNode,
      slashOffset: lastSlashIdx
    };
  }

  updateSlashMenuPosition(range: Range): void {
    const editorEl = this.descEditor()?.nativeElement;
    if (!editorEl) return;

    try {
      const editorRect = editorEl.getBoundingClientRect();
      const rangeRect = range.getBoundingClientRect();

      let top = 36;
      let left = 12;

      if (rangeRect.width || rangeRect.height || rangeRect.top || rangeRect.bottom) {
        top = rangeRect.bottom - editorRect.top + editorEl.scrollTop + 6;
        left = Math.max(8, rangeRect.left - editorRect.left + editorEl.scrollLeft);
        const maxLeft = Math.max(8, editorRect.width - 300);
        if (left > maxLeft) {
          left = maxLeft;
        }
      }

      this.slashMenuCoords.set({ top, left });
    } catch {
      this.slashMenuCoords.set({ top: 36, left: 12 });
    }
  }

  removeSlashToken(): void {
    const el = this.descEditor()?.nativeElement;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const ctx = this.getSlashTriggerContext();
    if (ctx && ctx.textNode) {
      const text = ctx.textNode.textContent ?? '';
      const beforeSlash = text.slice(0, ctx.slashOffset);
      const afterCursor = text.slice(ctx.slashOffset + 1 + ctx.query.length);
      ctx.textNode.textContent = beforeSlash + afterCursor;

      const newRange = document.createRange();
      newRange.setStart(ctx.textNode, ctx.slashOffset);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  }

  checkSlashMenuTrigger(): void {
    const ctx = this.getSlashTriggerContext();
    if (!ctx) {
      this.closeSlashMenu();
      return;
    }

    this.updateActiveFormats();
    this.slashQuery.set(ctx.query);
    this.slashSelectedIndex.set(0);
    this.updateSlashMenuPosition(ctx.range);
    this.showSlashMenu.set(true);
  }

  closeSlashMenu(): void {
    this.showSlashMenu.set(false);
    this.slashQuery.set('');
    this.slashSelectedIndex.set(0);
  }

  scrollActiveSlashItemIntoView(): void {
    setTimeout(() => {
      const activeEl = document.querySelector('.tfm-slash-item--active') as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  executeSlashCommand(cmdId: string): void {
    this.removeSlashToken();
    this.closeSlashMenu();

    const el = this.descEditor()?.nativeElement;
    if (el) el.focus();

    switch (cmdId) {
      case 'bold':
        this.formatDoc('bold');
        break;
      case 'italic':
        this.formatDoc('italic');
        break;
      case 'underline':
        this.formatDoc('underline');
        break;
      case 'highlight':
        this.applyHighlight('#fff3bf');
        break;
      case 'h1':
        this.toggleHeading('h1');
        break;
      case 'h2':
        this.toggleHeading('h2');
        break;
      case 'p':
        this.formatNormalText();
        break;
      case 'bullet':
        this.formatList('unordered');
        break;
      case 'numbered':
        this.formatList('ordered');
        break;
      case 'checklist':
        this.toggleChecklist();
        break;
      case 'code':
        this.toggleCode();
        break;
      case 'divider':
        this.formatDoc('insertHorizontalRule');
        break;
      case 'image':
        this.imageFileInput()?.nativeElement.click();
        break;
      case 'link':
        this.toggleLinkPopoverDirect();
        break;
      case 'attach':
        this.attachmentFileInput()?.nativeElement.click();
        break;
    }
    this.onEditorInput();
  }

  async onAttachmentFileInputChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.uploadAttachmentFiles(input.files);
    }
    input.value = '';
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

  openSubtaskDatePicker(input: HTMLInputElement): void {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.click();
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

  toggleSubtaskPopover(subtaskId: string, type: 'assignee' | 'priority' | 'status' | 'module', event: MouseEvent): void {
    event.stopPropagation();
    const current = this.activeSubtaskPopover();
    if (current && current.id === subtaskId && current.type === type) {
      this.activeSubtaskPopover.set(null);
    } else {
      if (type === 'assignee') {
        this.assigneeSearchQuery.set('');
      } else if (type === 'module') {
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
      this.saved.emit();
    } catch {
      // ignore error
    }
  }

  async changeSubtaskPriority(subtask: WorkTask, priority: WorkTask['priority']): Promise<void> {
    this.activeSubtaskPopover.set(null);
    if (!priority || subtask.priority === priority) return;
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
      this.saved.emit();
    } catch {
      // ignore error
    }
  }

  async changeSubtaskStatus(subtask: WorkTask, newStatusId: string): Promise<void> {
    this.activeSubtaskPopover.set(null);
    if (subtask.statusId === newStatusId) return;
    try {
      await firstValueFrom(this.taskApi.moveTaskStatus(subtask.id, newStatusId));
      if (this.task()) {
        void this.boardStore.loadSubtasks(this.task()!.id);
      }
      this.saved.emit();
    } catch {
      // ignore error
    }
  }

  async toggleSubtaskStatus(subtask: WorkTask, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.activeSubtaskPopover.set(null);
    const isDone = this.isSubtaskComplete(subtask);
    const targetStatus = this.statuses().find((st) => isDone ? !st.marksTaskComplete : st.marksTaskComplete);
    if (!targetStatus) return;
    try {
      await firstValueFrom(this.taskApi.moveTaskStatus(subtask.id, targetStatus.id));
      if (this.task()) void this.boardStore.loadSubtasks(this.task()!.id);
      this.saved.emit();
    } catch {
      // ignore status toggle error
    }
  }

  startAddSubtask(): void {
    this.activeSubtaskPopover.set(null);
    this.addingSubtask.set(true);
    this.newSubtaskPriority.set(null);
    this.newSubtaskModuleId.set(this.task()?.objectiveId || this.selectedObjectiveId() || '');
  }

  cancelAddSubtask(): void {
    this.addingSubtask.set(false);
    this.newSubtaskTitle.set('');
    this.newSubtaskDueDate.set('');
    this.newSubtaskAssigneeId.set(null);
    this.newSubtaskPriority.set(null);
    this.newSubtaskModuleId.set(this.task()?.objectiveId || this.selectedObjectiveId() || '');
    this.newSubtaskPickerOpen.set(false);
    this.subtaskPriorityPickerOpen.set(false);
  }

  onNewSubtaskAssigneeSelected(employeeId: string): void {
    this.newSubtaskAssigneeId.set(employeeId);
    this.newSubtaskPickerOpen.set(false);
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

  async saveNewSubtask(parentTaskId: string): Promise<void> {
    const title = this.newSubtaskTitle().trim();
    if (!title) return;
    const request: CreateSubtaskRequestDto = {
      title,
      dueDate: this.newSubtaskDueDate() || undefined,
      assigneeEmployeeId: this.newSubtaskAssigneeId() ?? undefined,
      ...(this.newSubtaskPriority() ? { priority: this.newSubtaskPriority()! } : {}),
      ...(this.newSubtaskModuleId() ? { objectiveId: this.newSubtaskModuleId() } : {})
    };
    const created = await this.boardStore.createSubtask(parentTaskId, request);
    if (created) {
      this.cancelAddSubtask();
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
      priority: this.priority() ?? 'medium',
      dueDate: this.dueDate() || undefined,
      estimatedHours: this.estimatedHours() ?? undefined,
      storyPoints: this.storyPoints() ?? undefined,
      progressPercent: this.progressPercent() ?? undefined,
      reason: this.reason().trim() || undefined,
      sprintId: this.sprintId() || null
    };

    const taskId = this.currentTaskId();
    try {
      if (newStatusId && newStatusId !== this.task()?.statusId) {
        await firstValueFrom(this.taskApi.moveTaskStatus(taskId, newStatusId));
      }
      if (this.isObjectiveOwner()) {
        await firstValueFrom(this.taskApi.editTask(taskId, {
          ...fields,
          attachmentFileIds: this.attachedFiles().map((f) => f.fileId)
        }));
        await this.applyReassignment();
      } else {
        await firstValueFrom(this.taskApi.createTaskEditRequest(taskId, fields));
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
    if (Object.keys(errs).length > 0) return;

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
