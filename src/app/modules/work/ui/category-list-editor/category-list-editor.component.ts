import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { safeServerDetail } from '../../../../core/services/error-handler.service';
import { KIND_META, TaskKind, USER_SELECTABLE_KINDS, kindOf } from '../../utils/task-kind';

interface DraftRow {
  id: string;
  name: string;
  isSystem: boolean;
  kind: TaskKind;
}

@Component({
  selector: 'app-category-list-editor',
  standalone: true,
  imports: [ModalComponent, CdkDropList, CdkDrag, CdkDragHandle, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Edit task categories" (closed)="closed.emit()" customMaxWidth="max-w-md">
      <div class="category-list__toolbar">
        @if (addingNew()) {
          <div class="category-list__add-form">
            <input
              class="ui-input ui-input--sm"
              placeholder="Category name"
              [value]="newCategoryName()"
              (input)="newCategoryName.set($any($event.target).value)"
              (keydown.enter)="confirmAdd()"
              (keydown.escape)="cancelAdd()"
             
            />
            <div class="category-list__add-buttons">
              <app-button variant="primary" [loading]="adding()" (pressed)="confirmAdd()">Add</app-button>
              <app-button variant="secondary" [disabled]="adding()" (pressed)="cancelAdd()">Cancel</app-button>
            </div>
          </div>
        } @else {
          <button type="button" class="category-list__add-icon" aria-label="Add category" title="Add category" (click)="addingNew.set(true)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add category</span>
          </button>
        }
      </div>

      <div cdkDropList (cdkDropListDropped)="onDrop($event)" class="category-list__list">
        @for (row of rows(); track row.id) {
          <div cdkDrag class="category-list__row">
            <span class="category-list__drag-handle" cdkDragHandle aria-hidden="true" title="Drag to reorder">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none" aria-hidden="true">
                <circle cx="9" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" />
                <circle cx="15" cy="6" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="15" cy="18" r="1.5" />
              </svg>
            </span>
            <span class="category-list__name">{{ row.name }}</span>
            <!-- The type drives colours, icons and grouping in the Planner; a system category's type is fixed. -->
            @if (row.isSystem) {
              <span data-testid="category-kind-readonly" class="category-list__kind">{{ kindLabel(row.kind) }}</span>
            } @else {
              <select data-testid="category-kind-select" class="category-list__kind" aria-label="Type"
                [value]="row.kind" (change)="changeKind(row, $any($event.target).value)">
                @for (kind of kinds; track kind) {
                  <option [value]="kind" [selected]="kind === row.kind">{{ kindLabel(kind) }}</option>
                }
              </select>
            }
            <div class="category-list__row-actions">
              @if (row.isSystem) {
                <span class="category-list__system-badge" title="System category: can't be renamed or deleted." aria-label="System category: can't be renamed or deleted.">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  <span>System</span>
                </span>
              } @else {
                <button type="button" class="category-list__edit-icon" aria-label="Rename category" title="Rename" (click)="openRename(row)">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                  <span>Edit</span>
                </button>
                <button type="button" class="category-list__delete-icon" aria-label="Delete category" title="Delete" (click)="deleteRow(row.id)">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>Delete</span>
                </button>
              }
            </div>
          </div>
        }
      </div>

      @if (errorMessage()) {
        <p class="category-list__error" role="alert">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{{ errorMessage() }}</span>
        </p>
      }

      <div class="category-list__actions">
        <app-button variant="secondary" [disabled]="saving()" (pressed)="closed.emit()">Cancel</app-button>
        <app-button variant="primary" [loading]="saving()" (pressed)="save()">Update</app-button>
      </div>
    </app-modal>

    <app-modal [open]="editingId() !== null" title="Rename task category" (closed)="cancelRename()" customMaxWidth="max-w-sm">
      <div class="category-list__rename-container">
        <input
          class="category-list__rename-input"
          aria-label="Category name"
          [value]="editingName()"
          (input)="editingName.set($any($event.target).value)"
          (keydown.enter)="confirmRename()"
         
        />
        @if (renameError()) {
          <p class="category-list__error" role="alert">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{{ renameError() }}</span>
          </p>
        }
        <div class="category-list__actions">
          <app-button variant="secondary" (pressed)="cancelRename()">Cancel</app-button>
          <app-button variant="primary" [loading]="renaming()" (pressed)="confirmRename()">Save</app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .category-list__toolbar { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 12px; }
    .category-list__add-form { display: flex; width: 100%; align-items: center; gap: 8px; }
    .category-list__add-buttons { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .category-list__add-icon {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 6px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-primary);
      cursor: pointer;
      font-size: 12.5px;
      font-weight: 500;
      transition: all 120ms ease;
    }
    .category-list__add-icon:hover {
      background: color-mix(in srgb, var(--color-border) 25%, transparent);
      border-color: color-mix(in srgb, var(--color-border) 50%, var(--color-accent, #2563eb));
    }
    .category-list__kind {
      margin-left: auto;
      margin-right: 8px;
      font-size: 12px;
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      padding: 2px 4px;
      background: var(--color-surface);
    }

    .category-list__rename-input {
      width: 100%;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      padding: 7px 10px;
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-size: 13px;
      outline: none;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .category-list__rename-input:focus {
      border-color: var(--color-accent, #2563eb);
      box-shadow: 0 0 0 1px var(--color-accent, #2563eb);
    }

    .category-list__rename-container { display: flex; flex-direction: column; gap: 10px; }
    .category-list__list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; min-height: 28px; }
    .category-list__row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 10px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .category-list__row:hover {
      border-color: color-mix(in srgb, var(--color-border) 60%, var(--color-accent, #2563eb));
    }
    .category-list__drag-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
      color: var(--color-text-secondary);
      opacity: 0.6;
      transition: opacity 120ms ease, color 120ms ease;
      flex-shrink: 0;
      padding: 2px;
    }
    .category-list__drag-handle:hover {
      opacity: 1;
      color: var(--color-text-primary);
    }
    .category-list__drag-handle:active {
      cursor: grabbing;
    }
    .category-list__name {
      flex: 1;
      min-width: 0;
      font-size: 13.5px;
      font-weight: 500;
      color: var(--color-text-primary);
    }
    .category-list__row-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .category-list__edit-icon, .category-list__delete-icon {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 5px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: var(--color-text-secondary);
      transition: all 120ms ease;
    }
    .category-list__edit-icon:hover {
      color: var(--color-text-primary);
      background: color-mix(in srgb, var(--color-border) 25%, transparent);
    }
    .category-list__delete-icon:hover {
      color: var(--color-danger-text, #ef4444);
      background: color-mix(in srgb, #ef4444 10%, transparent);
    }
    .category-list__system-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 500;
      color: var(--color-text-secondary);
      background: color-mix(in srgb, var(--color-border) 30%, transparent);
    }
    .category-list__error {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--color-danger-text, #ef4444);
      background: color-mix(in srgb, var(--color-danger-text, #ef4444) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-danger-text, #ef4444) 25%, transparent);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      margin-bottom: 10px;
    }
    .category-list__actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--color-border);
    }
    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 8px;
      box-shadow: 0 14px 28px -4px rgba(0, 0, 0, 0.18), 0 6px 10px -2px rgba(0, 0, 0, 0.1);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 10px;
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
    .category-list__list.cdk-drop-list-dragging .category-list__row:not(.cdk-drag-placeholder) {
      transition: transform 180ms cubic-bezier(0, 0, 0.2, 1);
    }
  `]
})
export class CategoryListEditorComponent {
  private readonly taskApi = inject(TaskApiService);

  readonly open = input(false);
  readonly projectId = input.required<string>();
  readonly categories = input.required<readonly TaskCategoryColumn[]>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly rows = signal<DraftRow[]>([]);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly addingNew = signal(false);
  protected readonly newCategoryName = signal('');
  protected readonly adding = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingName = signal('');
  protected readonly renaming = signal(false);
  protected readonly renameError = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.rows.set(
          [...this.categories()]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((category) => ({ id: category.id, name: category.name, isSystem: category.isSystem ?? false, kind: kindOf(category.kind) }))
        );
        this.errorMessage.set(null);
      } else {
        this.addingNew.set(false);
        this.newCategoryName.set('');
        this.cancelRename();
      }
    });
  }

  onDrop(event: CdkDragDrop<DraftRow[]>): void {
    const next = [...this.rows()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.rows.set(next);
  }

  cancelAdd(): void {
    this.addingNew.set(false);
    this.newCategoryName.set('');
  }

  async confirmAdd(): Promise<void> {
    const name = this.newCategoryName().trim();
    if (!name) return;
    this.adding.set(true);
    this.errorMessage.set(null);
    try {
      const created = await firstValueFrom(this.taskApi.createCategory(this.projectId(), {
        name,
        displayOrder: this.rows().length
      }));
      this.rows.set([...this.rows(), { id: created.id, name: created.name, isSystem: created.isSystem ?? false, kind: kindOf(created.kind) }]);
      this.cancelAdd();
      this.saved.emit();
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrorDetail(err) || 'Failed to add the category.');
    } finally {
      this.adding.set(false);
    }
  }

  openRename(row: DraftRow): void {
    if (row.isSystem) return;
    this.editingId.set(row.id);
    this.editingName.set(row.name);
    this.renameError.set(null);
  }

  cancelRename(): void {
    this.editingId.set(null);
    this.editingName.set('');
    this.renameError.set(null);
  }

  async confirmRename(): Promise<void> {
    const id = this.editingId();
    const name = this.editingName().trim();
    if (!id || !name) return;
    const rowIndex = this.rows().findIndex((row) => row.id === id);
    if (rowIndex < 0) return;
    this.renaming.set(true);
    this.renameError.set(null);
    try {
      await firstValueFrom(this.taskApi.editCategory(id, { name, displayOrder: rowIndex }));
      const next = [...this.rows()];
      next[rowIndex] = { ...next[rowIndex], name };
      this.rows.set(next);
      this.cancelRename();
      this.saved.emit();
    } catch (err: unknown) {
      this.renameError.set(this.getErrorDetail(err) || 'Failed to rename the category.');
    } finally {
      this.renaming.set(false);
    }
  }

  protected readonly kinds = USER_SELECTABLE_KINDS;

  protected kindLabel(kind: string): string {
    return KIND_META[kindOf(kind)].label;
  }

  /** Saves a row's new type right away, like a rename. */
  async changeKind(row: DraftRow, kind: string): Promise<void> {
    if (row.isSystem || kind === row.kind) return;
    const rowIndex = this.rows().findIndex((r) => r.id === row.id);
    if (rowIndex < 0) return;
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.taskApi.editCategory(row.id, { name: row.name, displayOrder: rowIndex, kind }));
      const next = [...this.rows()];
      next[rowIndex] = { ...next[rowIndex], kind: kindOf(kind) };
      this.rows.set(next);
      this.saved.emit();
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrorDetail(err) || 'Failed to change the type.');
    }
  }

  async deleteRow(id: string): Promise<void> {
    if (this.rows().find((row) => row.id === id)?.isSystem) return;
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.taskApi.deleteCategory(id));
      this.rows.set(this.rows().filter((row) => row.id !== id));
      this.saved.emit();
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrorDetail(err) || 'Failed to delete the category.');
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.taskApi.reorderTaskCategories(
        this.projectId(),
        this.rows().map((row, index) => ({ categoryId: row.id, displayOrder: index }))
      ));
      this.saved.emit();
      this.closed.emit();
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrorDetail(err) || 'Failed to save the category order.');
    } finally {
      this.saving.set(false);
    }
  }

  private getErrorDetail(err: unknown): string | null {
    return safeServerDetail(err) ?? null;
  }
}

