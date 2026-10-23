import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  CdkDropListGroup,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskStatusChangeRequestApiService } from '../../data-access/task-status-change-request-api.service';
import { TaskStatusChangeRequestDto } from '../../models/dto/task-status-change-request.dto';
import {
  buildStatusChangeSet,
  describeStatusChangeSet,
  isEmptyChangeSet,
  NEW_STATUS_PREFIX,
} from '../../utils/task-status-change-set';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ColorSwatchPickerComponent } from '../color-swatch-picker/color-swatch-picker.component';
import { TaskStatusCategory, TaskStatusColumn } from '../../models/task.model';
import { safeServerDetail } from '../../../../core/services/error-handler.service';

/**
 * direct: top (default) module owner/member - saves immediately, as before.
 * request: a member/owner of another module - edits are collected locally and sent as one
 *          change request for the top module to approve.
 * readonly: no module role in this project.
 */
type EditorMode = 'loading' | 'direct' | 'request' | 'readonly';

interface DraftRow {
  id: string;
  name: string;
  visibility: 'public' | 'private';
  category: TaskStatusCategory;
  color: string;
}
const groups: TaskStatusCategory[] = ['not_started', 'active', 'done'];
const labels = { not_started: 'Not Started', active: 'Active', done: 'Done' };
const colors = { not_started: '#94A3B8', active: '#2563EB', done: '#16A34A' };

@Component({
  selector: 'app-board-structure-editor',
  standalone: true,
  imports: [
    ModalComponent,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    ButtonComponent,
    ColorSwatchPickerComponent,
  ],
  template: `
    <app-modal [open]="open()" title="Edit task statuses" (closed)="close()" customMaxWidth="max-w-lg">
      @if (mode() === 'request') {
        <div class="board-structure__notice" data-testid="status-request-notice">
          Changes you make here are sent as a request to the project's top module owner and members.
          They take effect once one of them approves.
        </div>
      } @else if (mode() === 'readonly') {
        <div class="board-structure__notice" data-testid="status-readonly-notice">
          Only members of this project's modules can change task statuses.
        </div>
      } @else if (mode() === 'direct' && pendingRequests().length) {
        <div class="board-structure__notice" data-testid="status-pending-review-notice">
          {{ pendingRequests().length }} task status change
          {{ pendingRequests().length === 1 ? 'request is' : 'requests are' }} waiting for review in Approvals.
        </div>
      }
      @if (requestSent()) {
        <div class="board-structure__notice board-structure__notice--success" role="status" data-testid="status-request-sent">
          Request sent for approval.
        </div>
      }
      @if (mode() === 'request' && pendingRequests().length) {
        <div class="board-structure__pending" data-testid="status-my-pending-requests">
          <b>Your pending requests</b>
          @for (req of pendingRequests(); track req.id) {
            <div class="board-structure__pending-item">
              <span>{{ describe(req) }}</span>
              <button type="button" class="board-structure__btn-cancel" [disabled]="busy()" (click)="cancelRequest(req.id)">
                Withdraw
              </button>
            </div>
          }
        </div>
      }
      <div cdkDropListGroup class="board-structure__container">
        @for (group of groups; track group) {
          <section class="board-structure__group">
            <header class="board-structure__group-header">
              <div class="board-structure__group-title">
                <b>{{ label(group) }}</b>
                <span class="board-structure__group-badge">{{ rowsFor(group)().length }}</span>
              </div>
              @if (group !== 'done' || rowsFor('done')().length === 0) {
                <button
                  type="button"
                  class="board-structure__add-icon-btn"
                  [disabled]="locked()"
                  [attr.aria-label]="'Add ' + label(group) + ' status'"
                  (click)="startAdd(group)"
                  title="Add status"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              }
            </header>
            <div
              cdkDropList
              [id]="'board-structure-drop-' + group"
              [cdkDropListData]="rowsFor(group)()"
              [cdkDropListDisabled]="locked() || (group === 'done' && rowsFor('done')().length >= 1)"
              (cdkDropListDropped)="onDrop($event, group)"
              class="board-structure__list"
            >
              @for (row of rowsFor(group)(); track row.id) {
                <div
                  cdkDrag
                  [cdkDragDisabled]="locked()"
                  class="board-structure__row"
                >
                  <span class="board-structure__drag-handle" cdkDragHandle aria-hidden="true" title="Drag to reorder">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none" aria-hidden="true">
                      <circle cx="9" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" />
                      <circle cx="15" cy="6" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </span>
                  <button
                    type="button"
                    class="board-structure__color"
                    [style.background]="row.color"
                    [disabled]="locked()"
                    [attr.aria-label]="'Change color for ' + row.name"
                    title="Change status color"
                    (click)="toggleColorPicker(row.id)"
                  ></button>
                  <input
                    class="board-structure__name"
                    aria-label="Status name"
                    maxlength="100"
                    placeholder="Status name"
                    [disabled]="locked()"
                    [value]="row.name"
                    (input)="rename(row.id, $any($event.target).value)"
                  />
                  <button
                    type="button"
                    class="board-structure__visibility-btn"
                    [class.board-structure__visibility-btn--private]="row.visibility === 'private'"
                    [disabled]="locked()"
                    [attr.aria-label]="'Private status: ' + row.name"
                    [attr.aria-pressed]="row.visibility === 'private'"
                    [title]="row.visibility === 'private' ? 'Private status: visible to assignees and project managers' : 'Public status: visible to everyone'"
                    (click)="toggleVisibility(row.id)"
                  >
                    @if (row.visibility === 'private') {
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    } @else {
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                      </svg>
                    }
                  </button>
                  <details class="board-structure__actions">
                    <summary class="board-structure__actions-trigger" aria-label="Status actions" title="More options">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="1.75" />
                        <circle cx="19" cy="12" r="1.75" />
                        <circle cx="5" cy="12" r="1.75" />
                      </svg>
                    </summary>
                    <div class="board-structure__menu">
                      <button
                        type="button"
                        class="board-structure__menu-item"
                        [disabled]="locked() || !canDelete(row)"
                        (click)="deleteRow(row.id)"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M3 6h18" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  </details>
                </div>
                @if (colorPickerFor() === row.id) {
                  <div class="board-structure__color-picker-wrapper">
                    <app-color-swatch-picker
                      [presets]="presets"
                      [selected]="row.color"
                      (colorChange)="setColor(row.id, $event)"
                    />
                  </div>
                }
              }
            </div>
            @if (addingTo() === group) {
              <div class="board-structure__add">
                <button
                  type="button"
                  class="board-structure__color"
                  [style.background]="newStatusColor()"
                  [disabled]="busy()"
                  aria-label="Change color for new status"
                  title="Change status color"
                  (click)="toggleAddColorPicker()"
                ></button>
                <input
                  class="board-structure__add-input"
                  aria-label="New status name"
                  placeholder="Status name"
                  maxlength="100"
                  [disabled]="busy()"
                  [value]="newStatusName()"
                  (input)="newStatusName.set($any($event.target).value)"
                  (keydown.enter)="confirmAdd()"
                  (keydown.escape)="cancelAdd()"
                  autofocus
                />
                <div class="board-structure__add-buttons">
                  <button
                    type="button"
                    class="board-structure__btn-confirm"
                    [disabled]="busy() || !newStatusName().trim()"
                    (click)="confirmAdd()"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    class="board-structure__btn-cancel"
                    [disabled]="busy()"
                    (click)="cancelAdd()"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              @if (colorPickerFor() === 'new') {
                <div class="board-structure__color-picker-wrapper">
                  <app-color-swatch-picker
                    [presets]="presets"
                    [selected]="newStatusColor()"
                    (colorChange)="setNewColor($event)"
                  />
                </div>
              }
            }
          </section>
        }
      </div>
      @if (errorMessage()) {
        <p class="board-structure__error" role="alert">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{{ errorMessage() }}</span>
        </p>
      }
      @if (mode() === 'request') {
        <textarea
          class="board-structure__note"
          aria-label="Note for approvers"
          placeholder="Add a note for the approvers (optional)"
          maxlength="1000"
          rows="2"
          [disabled]="busy()"
          [value]="requestNote()"
          (input)="requestNote.set($any($event.target).value)"
        ></textarea>
      }
      <footer class="board-structure__footer">
        <app-button variant="secondary" [disabled]="busy()" (pressed)="close()">Cancel</app-button>
        @if (mode() !== 'readonly') {
          <app-button variant="primary" [disabled]="locked()" [loading]="saving()" (pressed)="save()"
            >{{ mode() === 'request' ? 'Send for approval' : 'Update' }}</app-button
          >
        }
      </footer>
    </app-modal>
  `,
  styles: [
    `
      .board-structure__container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .board-structure__group {
        display: flex;
        flex-direction: column;
      }
      .board-structure__group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        padding-inline: 2px;
      }
      .board-structure__group-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--color-text-primary);
      }
      .board-structure__group-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 9999px;
        background: color-mix(in srgb, var(--color-text-secondary) 14%, transparent);
        color: var(--color-text-secondary);
        font-size: 11px;
        font-weight: 600;
        line-height: 1;
      }
      .board-structure__add-icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition: all 120ms ease;
        padding: 0;
      }
      .board-structure__add-icon-btn:hover:not(:disabled) {
        background: color-mix(in srgb, var(--color-border) 35%, transparent);
        color: var(--color-text-primary);
        border-color: var(--color-border);
      }
      .board-structure__list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-height: 28px;
        padding: 2px;
        border-radius: 8px;
      }
      .board-structure__row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: var(--color-surface);
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
      }
      .board-structure__row:hover {
        border-color: color-mix(in srgb, var(--color-border) 60%, var(--color-accent, #2563eb));
      }
      .board-structure__row:focus-within {
        border-color: var(--color-accent, #2563eb);
        box-shadow: 0 0 0 1px var(--color-accent, #2563eb);
      }
      .board-structure__drag-handle {
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        color: var(--color-text-secondary);
        opacity: 0.6;
        transition: opacity 120ms ease, color 120ms ease;
        padding: 2px;
        flex-shrink: 0;
      }
      .board-structure__drag-handle:hover {
        opacity: 1;
        color: var(--color-text-primary);
      }
      .board-structure__drag-handle:active {
        cursor: grabbing;
      }
      .board-structure__color {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid var(--color-surface);
        box-shadow: 0 0 0 1px var(--color-border), 0 1px 2px rgba(0, 0, 0, 0.08);
        flex-shrink: 0;
        cursor: pointer;
        padding: 0;
        transition: transform 120ms ease, box-shadow 120ms ease;
      }
      .board-structure__color:hover:not(:disabled) {
        transform: scale(1.18);
        box-shadow: 0 0 0 2px var(--color-accent, #2563eb), 0 2px 4px rgba(0, 0, 0, 0.15);
      }
      .board-structure__name {
        flex: 1;
        min-width: 0;
        background: transparent;
        color: var(--color-text-primary);
        font-size: 13.5px;
        font-weight: 500;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 3px 6px;
        outline: none;
        transition: border-color 120ms ease, background 120ms ease;
      }
      .board-structure__name:hover:not(:disabled) {
        border-color: var(--color-border);
      }
      .board-structure__name:focus {
        border-color: var(--color-accent, #2563eb);
        background: color-mix(in srgb, var(--color-accent, #2563eb) 4%, transparent);
      }
      .board-structure__visibility-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--color-text-secondary);
        flex-shrink: 0;
        cursor: pointer;
        transition: all 120ms ease;
        padding: 0;
      }
      .board-structure__visibility-btn:hover:not(:disabled) {
        background: color-mix(in srgb, var(--color-border) 35%, transparent);
        color: var(--color-text-primary);
      }
      .board-structure__visibility-btn--private {
        color: #d97706;
        background: color-mix(in srgb, #f59e0b 12%, transparent);
        border-color: color-mix(in srgb, #f59e0b 24%, transparent);
      }
      .board-structure__visibility-btn--private:hover:not(:disabled) {
        background: color-mix(in srgb, #f59e0b 20%, transparent);
        color: #b45309;
      }
      .board-structure__actions {
        position: relative;
        flex-shrink: 0;
      }
      .board-structure__actions-trigger {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        list-style: none;
        transition: all 120ms ease;
      }
      .board-structure__actions-trigger::-webkit-details-marker {
        display: none;
      }
      .board-structure__actions-trigger:hover {
        background: color-mix(in srgb, var(--color-border) 35%, transparent);
        color: var(--color-text-primary);
      }
      .board-structure__menu {
        position: absolute;
        right: 0;
        top: calc(100% + 4px);
        z-index: 30;
        min-width: 120px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 4px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
      }
      .board-structure__menu-item {
        display: flex;
        width: 100%;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border: none;
        border-radius: 5px;
        background: transparent;
        color: var(--color-danger-text, #ef4444);
        font-size: 12.5px;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        transition: background 120ms ease;
      }
      .board-structure__menu-item:hover:not(:disabled) {
        background: color-mix(in srgb, #ef4444 10%, transparent);
      }
      .board-structure__menu-item:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .board-structure__color-picker-wrapper {
        margin: 4px 0 8px 30px;
        padding: 8px 12px;
        background: color-mix(in srgb, var(--color-border) 15%, transparent);
        border: 1px solid var(--color-border);
        border-radius: 8px;
      }
      .board-structure__add {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 4px;
        padding: 6px 10px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: var(--color-surface);
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      }
      .board-structure__add-input {
        flex: 1;
        min-width: 0;
        background: transparent;
        color: var(--color-text-primary);
        font-size: 13.5px;
        font-weight: 500;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 3px 6px;
        outline: none;
        transition: border-color 120ms ease, background 120ms ease;
      }
      .board-structure__add-input:focus {
        border-color: var(--color-accent, #2563eb);
        background: color-mix(in srgb, var(--color-accent, #2563eb) 4%, transparent);
      }
      .board-structure__add-buttons {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .board-structure__btn-confirm {
        padding: 5px 12px;
        border-radius: 6px;
        border: none;
        background: var(--color-accent, #2563eb);
        color: #fff;
        font-size: 12.5px;
        font-weight: 500;
        cursor: pointer;
        transition: opacity 120ms ease;
      }
      .board-structure__btn-confirm:hover:not(:disabled) {
        opacity: 0.9;
      }
      .board-structure__btn-cancel {
        padding: 5px 10px;
        border-radius: 6px;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-secondary);
        font-size: 12.5px;
        font-weight: 500;
        cursor: pointer;
        transition: all 120ms ease;
      }
      .board-structure__btn-cancel:hover:not(:disabled) {
        background: color-mix(in srgb, var(--color-border) 25%, transparent);
        color: var(--color-text-primary);
      }
      .board-structure__error {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        padding: 8px 12px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--color-danger-text, #ef4444) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--color-danger-text, #ef4444) 30%, transparent);
        color: var(--color-danger-text, #ef4444);
        font-size: 12.5px;
      }
      .board-structure__notice {
        margin-bottom: 14px;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid color-mix(in srgb, var(--color-accent, #2563eb) 30%, transparent);
        background: color-mix(in srgb, var(--color-accent, #2563eb) 8%, transparent);
        color: var(--color-text-primary);
        font-size: 12.5px;
        line-height: 1.45;
      }
      .board-structure__notice--success {
        border-color: color-mix(in srgb, #16a34a 35%, transparent);
        background: color-mix(in srgb, #16a34a 10%, transparent);
      }
      .board-structure__pending {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 14px;
        font-size: 12.5px;
        color: var(--color-text-primary);
      }
      .board-structure__pending-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 6px 10px;
        border: 1px dashed var(--color-border);
        border-radius: 8px;
        color: var(--color-text-secondary);
      }
      .board-structure__note {
        width: 100%;
        box-sizing: border-box;
        margin-top: 14px;
        padding: 8px 10px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: var(--color-surface);
        color: var(--color-text-primary);
        font: inherit;
        font-size: 13px;
        resize: vertical;
      }
      .board-structure__footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 20px;
        padding-top: 14px;
        border-top: 1px solid var(--color-border);
      }
      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .cdk-drag-preview {
        box-sizing: border-box;
        border-radius: 8px;
        box-shadow: 0 14px 28px -4px rgba(0, 0, 0, 0.18), 0 6px 10px -2px rgba(0, 0, 0, 0.1);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        z-index: 1300;
      }
      .cdk-drag-placeholder {
        opacity: 0.35;
        border: 1.5px dashed var(--color-accent, #2563eb);
        background: color-mix(in srgb, var(--color-accent, #2563eb) 6%, transparent);
        border-radius: 8px;
      }
      .cdk-drag-animating {
        transition: transform 180ms cubic-bezier(0, 0, 0.2, 1);
      }
      .board-structure__list.cdk-drop-list-dragging .board-structure__row:not(.cdk-drag-placeholder) {
        transition: transform 180ms cubic-bezier(0, 0, 0.2, 1);
      }
    `,
  ],
})
export class BoardStructureEditorComponent {
  private readonly taskApi = inject(TaskApiService);
  private readonly changeRequestApi = inject(TaskStatusChangeRequestApiService);
  readonly groups = groups;
  readonly categoryColors = colors;
  readonly presets = [
    { value: '#94a3b8', label: 'Gray' },
    { value: '#16a34a', label: 'Green' },
    { value: '#2563eb', label: 'Blue' },
    { value: '#dc2626', label: 'Red' },
  ];
  open = input(false);
  projectId = input.required<string>();
  statuses = input.required<readonly TaskStatusColumn[]>();
  saved = output<void>();
  closed = output<void>();
  protected readonly notStarted = signal<DraftRow[]>([]);
  protected readonly active = signal<DraftRow[]>([]);
  protected readonly done = signal<DraftRow[]>([]);
  protected readonly saving = signal(false);
  protected readonly mutating = signal(false);
  protected readonly busy = computed(() => this.saving() || this.mutating());
  protected readonly mode = signal<EditorMode>('loading');
  protected readonly locked = computed(
    () => this.busy() || this.mode() === 'loading' || this.mode() === 'readonly',
  );
  /** Pending requests visible to the caller: all of them for approvers, only their own otherwise. */
  protected readonly pendingRequests = signal<TaskStatusChangeRequestDto[]>([]);
  protected readonly requestNote = signal('');
  protected readonly requestSent = signal(false);
  private openedWith: readonly TaskStatusColumn[] = [];
  private nextNewId = 0;
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly addingTo = signal<TaskStatusCategory | null>(null);
  protected readonly newStatusName = signal('');
  protected readonly newStatusColor = signal<string>('#94A3B8');
  protected readonly colorPickerFor = signal<string | null>(null);
  private originals = new Map<string, TaskStatusColumn>();
  private editingProject: string | null = null;

  constructor() {
    effect(() => {
      const open = this.open(),
        project = this.projectId(),
        statuses = this.statuses();
      // Input refreshes after immediate add/delete must not overwrite the other unsaved edits.
      untracked(() => {
        if (!open) {
          this.editingProject = null;
          this.cancelAdd();
          this.colorPickerFor.set(null);
          this.requestSent.set(false);
          this.requestNote.set('');
          return;
        }
        if (this.editingProject === project) return;
        if (!statuses.length) return;
        this.editingProject = project;
        this.resetRows(statuses);
        this.errorMessage.set(null);
        this.loadAccess(project);
      });
    });
  }
  private resetRows(statuses: readonly TaskStatusColumn[]) {
    this.openedWith = statuses.map((row) => ({ ...row }));
    this.originals = new Map(statuses.map((row) => [row.id, row]));
    const sorted = [...statuses].sort((a, b) => a.displayOrder - b.displayOrder);
    for (const group of groups)
      this.rowsFor(group).set(
        sorted.filter((row) => row.category === group).map((row) => ({ ...row })),
      );
  }
  private loadAccess(project: string) {
    this.mode.set('loading');
    this.changeRequestApi.getForProject(project).subscribe({
      next: (access) => {
        if (this.editingProject !== project) return;
        this.mode.set(access.canEditDirectly ? 'direct' : access.canRequest ? 'request' : 'readonly');
        this.pendingRequests.set(access.requests);
      },
      // The status endpoints still enforce access server-side; fall back to the original editor.
      error: () => {
        if (this.editingProject === project) this.mode.set('direct');
      },
    });
  }
  protected describe(request: TaskStatusChangeRequestDto) {
    return describeStatusChangeSet(request.changes).join('; ');
  }
  async cancelRequest(id: string) {
    if (this.busy()) return;
    this.mutating.set(true);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.changeRequestApi.cancel(id));
      this.pendingRequests.update((list) => list.filter((r) => r.id !== id));
    } catch (error) {
      this.showError(error, 'Failed to withdraw the request.');
    } finally {
      this.mutating.set(false);
    }
  }
  label(group: TaskStatusCategory) {
    return labels[group];
  }
  rowsFor(group: TaskStatusCategory): WritableSignal<DraftRow[]> {
    return group === 'not_started' ? this.notStarted : group === 'active' ? this.active : this.done;
  }
  canDelete(row: DraftRow) {
    return row.category !== 'done' && !(row.category === 'active' && this.active().length <= 1);
  }
  close() {
    if (!this.busy()) this.closed.emit();
  }
  onDrop(event: CdkDragDrop<DraftRow[]>, target: TaskStatusCategory) {
    if (this.locked()) return;
    const source = event.previousContainer.id.replace(
      'board-structure-drop-',
      '',
    ) as TaskStatusCategory;
    if (!groups.includes(source)) return;
    if (target === 'done' && source !== 'done' && this.done().length >= 1) return;
    if (source === 'done' && target !== 'done' && this.done().length <= 1) return;
    const sourceRows = [...event.previousContainer.data],
      targetRows = [...event.container.data];
    if (event.previousContainer === event.container) {
      moveItemInArray(targetRows, event.previousIndex, event.currentIndex);
    } else {
      if (source === 'active' && sourceRows.length <= 1) {
        this.errorMessage.set('A project must always have at least one Active status.');
        return;
      }
      transferArrayItem(sourceRows, targetRows, event.previousIndex, event.currentIndex);
      targetRows[event.currentIndex] = { ...targetRows[event.currentIndex], category: target };
      this.rowsFor(source).set(sourceRows);
    }
    this.rowsFor(target).set(targetRows);
  }
  private update(id: string, fn: (row: DraftRow) => DraftRow) {
    if (this.locked()) return;
    for (const group of groups)
      this.rowsFor(group).update((rows) => rows.map((row) => (row.id === id ? fn(row) : row)));
  }
  rename(id: string, name: string) {
    this.update(id, (row) => ({ ...row, name }));
  }
  toggleVisibility(id: string) {
    this.update(id, (row) => ({
      ...row,
      visibility: row.visibility === 'private' ? 'public' : 'private',
    }));
  }
  toggleColorPicker(id: string) {
    this.colorPickerFor.update((value) => (value === id ? null : id));
  }
  setColor(id: string, color: string) {
    this.update(id, (row) => ({ ...row, color }));
  }
  startAdd(group: TaskStatusCategory) {
    if ((group === 'done' && this.done().length >= 1) || this.locked()) return;
    this.addingTo.set(group);
    this.newStatusName.set('');
    this.newStatusColor.set(colors[group]);
    if (this.colorPickerFor() === 'new') {
      this.colorPickerFor.set(null);
    }
  }
  cancelAdd() {
    this.addingTo.set(null);
    this.newStatusName.set('');
    if (this.colorPickerFor() === 'new') {
      this.colorPickerFor.set(null);
    }
  }
  toggleAddColorPicker() {
    this.colorPickerFor.update((value) => (value === 'new' ? null : 'new'));
  }
  setNewColor(color: string) {
    this.newStatusColor.set(color);
  }
  async confirmAdd() {
    const group = this.addingTo(),
      name = this.newStatusName().trim();
    if (!group || (group === 'done' && this.done().length >= 1) || !name || this.locked()) return;
    if (this.mode() === 'request') {
      // Held locally until "Send for approval"; the temp id marks it as an addition in the diff.
      const id = `${NEW_STATUS_PREFIX}${++this.nextNewId}`;
      const color = this.newStatusColor() || colors[group];
      this.rowsFor(group).update((rows) => [
        ...rows,
        { id, name, visibility: 'public', category: group, color },
      ]);
      this.cancelAdd();
      return;
    }
    this.mutating.set(true);
    this.errorMessage.set(null);
    try {
      const row = await firstValueFrom(
        this.taskApi.createStatus(this.projectId(), {
          name,
          displayOrder: this.flatten().length,
          visibility: 'public',
          category: group,
          color: this.newStatusColor() || colors[group],
          requiresApproval: false,
        }),
      );
      this.originals.set(row.id, row);
      this.rowsFor(group).update((rows) => [...rows, { ...row }]);
      this.cancelAdd();
      this.saved.emit();
    } catch (error) {
      this.showError(error, 'Failed to add the status.');
    } finally {
      this.mutating.set(false);
    }
  }
  async deleteRow(id: string) {
    const row = this.flatten().find((row) => row.id === id);
    if (!row || !this.canDelete(row) || this.locked()) return;
    if (this.mode() === 'request') {
      this.rowsFor(row.category).update((rows) => rows.filter((r) => r.id !== id));
      return;
    }
    this.mutating.set(true);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.taskApi.deleteStatus(id));
      this.rowsFor(row.category).update((rows) => rows.filter((row) => row.id !== id));
      this.originals.delete(id);
      this.saved.emit();
    } catch (error) {
      this.showError(error, 'Move all tasks out of this status before deleting it.');
    } finally {
      this.mutating.set(false);
    }
  }
  private flatten() {
    return [...this.notStarted(), ...this.active(), ...this.done()];
  }
  async save() {
    if (this.locked()) return;
    const rows = this.flatten().map((row) => ({ ...row, name: row.name.trim() }));
    if (
      rows.some((row) => !row.name) ||
      new Set(rows.map((row) => row.name.toLowerCase())).size !== rows.length
    ) {
      this.errorMessage.set('Status names must be non-empty and unique.');
      return;
    }
    if (this.done().length !== 1 || !this.active().length) {
      this.errorMessage.set('Keep exactly one Done status and at least one Active status.');
      return;
    }
    if (this.mode() === 'request') {
      await this.submitRequest(rows);
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      // Rename using persisted metadata first; reorder applies all category changes atomically.
      for (const row of rows) {
        const original = this.originals.get(row.id)!;
        if (row.name !== original.name) {
          await firstValueFrom(
            this.taskApi.editStatus(this.projectId(), row.id, {
              name: row.name,
              displayOrder: original.displayOrder,
              requiresApproval: original.requiresApproval,
              approverId: original.approverId ?? undefined,
              visibility: original.visibility,
              category: original.category,
              color: original.color,
            }),
          );
          this.originals.set(row.id, { ...original, name: row.name });
        }
      }
      await firstValueFrom(
        this.taskApi.reorderTaskStatuses(
          this.projectId(),
          rows.map((row, displayOrder) => ({
            statusId: row.id,
            displayOrder,
            visibility: row.visibility,
            category: row.category,
            color: row.color,
          })),
        ),
      );
      this.saved.emit();
      this.closed.emit();
    } catch (error) {
      this.showError(
        error,
        'Failed to save the statuses. Some renames may already have been saved; retry to finish.',
      );
    } finally {
      this.saving.set(false);
    }
  }
  private async submitRequest(rows: DraftRow[]) {
    const changes = buildStatusChangeSet(this.openedWith, rows);
    if (isEmptyChangeSet(changes)) {
      this.errorMessage.set('There are no changes to send for approval.');
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.requestSent.set(false);
    try {
      const note = this.requestNote().trim() || null;
      const created = await firstValueFrom(this.changeRequestApi.create(this.projectId(), changes, note));
      this.pendingRequests.update((list) => [...list, created]);
      // Nothing changed yet - show the live statuses again until the request is approved.
      this.resetRows(this.openedWith);
      this.requestNote.set('');
      this.requestSent.set(true);
    } catch (error) {
      this.showError(error, 'Failed to send the request.');
    } finally {
      this.saving.set(false);
    }
  }
  private showError(error: unknown, fallback: string) {
    this.errorMessage.set(safeServerDetail(error) || fallback);
  }
}
