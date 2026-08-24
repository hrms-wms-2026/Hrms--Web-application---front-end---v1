import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { TaskCategoryColumn } from '../../models/task-category.model';

interface DraftRow {
  id: string;
  name: string;
}

@Component({
  selector: 'app-category-list-editor',
  standalone: true,
  imports: [ModalComponent, CdkDropList, CdkDrag, CdkDragHandle, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Edit task categories" (closed)="closed.emit()">
      <div class="category-list__toolbar">
        @if (addingNew()) {
          <input
            class="category-list__new-input"
            placeholder="Category name"
            [value]="newCategoryName()"
            (input)="newCategoryName.set($any($event.target).value)"
            (keydown.enter)="confirmAdd()"
          />
          <app-button variant="primary" [loading]="adding()" (pressed)="confirmAdd()">Add</app-button>
          <app-button variant="secondary" [disabled]="adding()" (pressed)="cancelAdd()">Cancel</app-button>
        } @else {
          <button type="button" class="category-list__add-icon" aria-label="Add category" (click)="addingNew.set(true)">+</button>
        }
      </div>

      <div cdkDropList (cdkDropListDropped)="onDrop($event)" class="category-list__list">
        @for (row of rows(); track row.id) {
          <div cdkDrag class="category-list__row">
            <span class="category-list__drag-handle" cdkDragHandle>⠿</span>
            <span class="category-list__name">{{ row.name }}</span>
            <button type="button" class="category-list__edit-icon" aria-label="Rename category" (click)="openRename(row)">Edit</button>
            <button type="button" class="category-list__delete-icon" aria-label="Delete category" (click)="deleteRow(row.id)">Delete</button>
          </div>
        }
      </div>

      @if (errorMessage()) {
        <p class="category-list__error" role="alert">{{ errorMessage() }}</p>
      }

      <div class="category-list__actions">
        <app-button variant="secondary" [disabled]="saving()" (pressed)="closed.emit()">Cancel</app-button>
        <app-button variant="primary" [loading]="saving()" (pressed)="save()">Update</app-button>
      </div>
    </app-modal>

    <app-modal [open]="editingId() !== null" title="Rename task category" (closed)="cancelRename()">
      <input
        class="category-list__rename-input"
        aria-label="Category name"
        [value]="editingName()"
        (input)="editingName.set($any($event.target).value)"
        (keydown.enter)="confirmRename()"
      />
      @if (renameError()) {
        <p class="category-list__error" role="alert">{{ renameError() }}</p>
      }
      <div class="category-list__actions">
        <app-button variant="secondary" (pressed)="cancelRename()">Cancel</app-button>
        <app-button variant="primary" [loading]="renaming()" (pressed)="confirmRename()">Save</app-button>
      </div>
    </app-modal>
  `,
  styles: [`
    .category-list__toolbar { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 8px; }
    .category-list__add-icon { width: 28px; height: 28px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; font-size: 16px; line-height: 1; }
    .category-list__new-input, .category-list__rename-input { width: 100%; border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; background: var(--color-surface); color: var(--color-text-primary); }
    .category-list__new-input { flex: 1; }
    .category-list__list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .category-list__row { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
    .category-list__drag-handle { cursor: grab; color: var(--color-text-secondary); }
    .category-list__name { flex: 1; font-size: 13px; color: var(--color-text-primary); }
    .category-list__edit-icon, .category-list__delete-icon { background: none; border: none; cursor: pointer; font-size: 12px; color: var(--color-text-secondary); }
    .category-list__edit-icon:hover, .category-list__delete-icon:hover { color: var(--color-text-primary); }
    .category-list__error { color: var(--color-danger-text); font-size: 12px; margin-bottom: 8px; }
    .category-list__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
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
            .map((category) => ({ id: category.id, name: category.name }))
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
      this.rows.set([...this.rows(), { id: created.id, name: created.name }]);
      this.cancelAdd();
      this.saved.emit();
    } catch (err: unknown) {
      this.errorMessage.set(this.getErrorDetail(err) || 'Failed to add the category.');
    } finally {
      this.adding.set(false);
    }
  }

  openRename(row: DraftRow): void {
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

  async deleteRow(id: string): Promise<void> {
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
    return (err as { error?: { detail?: string } })?.error?.detail ?? null;
  }
}

