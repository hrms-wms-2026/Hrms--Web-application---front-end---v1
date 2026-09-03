import { Component, effect, inject, input, output, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { TaskStatusColumn } from '../../models/task.model';

interface DraftRow {
  id: string;
  name: string;
  visibility: 'public' | 'private';
  marksTaskComplete: boolean;
}

@Component({
  selector: 'app-board-structure-editor',
  standalone: true,
  imports: [ModalComponent, CdkDropList, CdkDrag, CdkDragHandle, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Edit task statuses" (closed)="closed.emit()">
      <div class="board-structure__toolbar">
        @if (addingNew()) {
          <input
            class="board-structure__new-input"
            placeholder="Status name"
            [value]="newStatusName()"
            (input)="newStatusName.set($any($event.target).value)"
            (keydown.enter)="confirmAdd()"
          />
          <app-button variant="primary" [loading]="adding()" (pressed)="confirmAdd()">Add</app-button>
          <app-button variant="secondary" [disabled]="adding()" (pressed)="cancelAdd()">Cancel</app-button>
        } @else {
          <button type="button" class="board-structure__add-icon" aria-label="Add status" (click)="addingNew.set(true)">+</button>
        }
      </div>

      <div cdkDropList (cdkDropListDropped)="onDrop($event)" class="board-structure__list">
        @for (row of rows(); track row.id) {
          <div cdkDrag class="board-structure__row">
            <span class="board-structure__drag-handle" cdkDragHandle>⠿</span>
            <span class="board-structure__name">{{ row.name }}</span>
            <label class="board-structure__toggle">
              <input type="checkbox" [checked]="row.visibility === 'private'" (change)="toggleVisibility(row.id)" />
              Private
            </label>
            <label class="board-structure__toggle">
              <input type="radio" name="marksComplete" [checked]="row.marksTaskComplete" (change)="setComplete(row.id)" />
              Marks complete
            </label>
            <button type="button" class="board-structure__delete-icon" aria-label="Delete status" (click)="deleteRow(row.id)">🗑</button>
          </div>
        }
      </div>

      @if (errorMessage()) {
        <p class="board-structure__error" role="alert">{{ errorMessage() }}</p>
      }

      <div class="board-structure__actions">
        <app-button variant="secondary" [disabled]="saving()" (pressed)="closed.emit()">Cancel</app-button>
        <app-button variant="primary" [loading]="saving()" (pressed)="save()">Update</app-button>
      </div>
    </app-modal>
  `,
  styles: [`
    .board-structure__toolbar { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 8px; }
    .board-structure__add-icon { width: 28px; height: 28px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; font-size: 16px; line-height: 1; }
    .board-structure__new-input { flex: 1; border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; background: var(--color-surface); color: var(--color-text-primary); }
    .board-structure__list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .board-structure__row { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
    .board-structure__drag-handle { cursor: grab; color: var(--color-text-secondary); }
    .board-structure__name { flex: 1; font-size: 13px; color: var(--color-text-primary); }
    .board-structure__toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-secondary); }
    .board-structure__delete-icon { background: none; border: none; cursor: pointer; font-size: 14px; line-height: 1; color: var(--color-text-secondary); }
    .board-structure__delete-icon:hover { color: var(--color-danger-text); }
    .board-structure__error { color: var(--color-danger-text); font-size: 12px; margin-bottom: 8px; }
    .board-structure__actions { display: flex; justify-content: flex-end; gap: 8px; }
  `]
})
export class BoardStructureEditorComponent {
  private readonly taskApi = inject(TaskApiService);

  open = input(false);
  projectId = input.required<string>();
  statuses = input.required<readonly TaskStatusColumn[]>();
  saved = output<void>();
  closed = output<void>();

  protected readonly rows = signal<DraftRow[]>([]);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly addingNew = signal(false);
  protected readonly newStatusName = signal('');
  protected readonly adding = signal(false);

  constructor() {
    // Resets the draft from the latest loaded statuses each time the modal opens - this instance
    // is always rendered (never re-created) once wired up in objective-settings, so ngOnInit would
    // only ever capture the first load and go stale on every reopen. Also re-syncs after a
    // create/delete round-trip below, since those emit `saved` which drives the parent's reload
    // back into the `statuses` input while the modal is still open.
    effect(() => {
      if (this.open()) {
        this.rows.set(
          [...this.statuses()]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((s) => ({ id: s.id, name: s.name, visibility: s.visibility, marksTaskComplete: s.marksTaskComplete }))
        );
        this.errorMessage.set(null);
      } else {
        this.addingNew.set(false);
        this.newStatusName.set('');
      }
    });
  }

  onDrop(event: CdkDragDrop<DraftRow[]>): void {
    const next = [...this.rows()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.rows.set(next);
  }

  toggleVisibility(id: string): void {
    this.rows.set(this.rows().map((r) => (r.id === id ? { ...r, visibility: r.visibility === 'private' ? 'public' : 'private' } : r)));
  }

  setComplete(id: string): void {
    this.rows.set(this.rows().map((r) => ({ ...r, marksTaskComplete: r.id === id })));
  }

  cancelAdd(): void {
    this.addingNew.set(false);
    this.newStatusName.set('');
  }

  async confirmAdd(): Promise<void> {
    const name = this.newStatusName().trim();
    if (!name) return;
    this.adding.set(true);
    this.errorMessage.set(null);
    try {
      const created = await firstValueFrom(this.taskApi.createStatus(this.projectId(), {
        name,
        displayOrder: this.rows().length,
        visibility: 'public',
        marksTaskComplete: false,
        requiresApproval: false
      }));
      this.rows.set([...this.rows(), { id: created.id, name: created.name, visibility: created.visibility, marksTaskComplete: created.marksTaskComplete }]);
      this.addingNew.set(false);
      this.newStatusName.set('');
      this.saved.emit();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.errorMessage.set(detail || 'Failed to add the status.');
    } finally {
      this.adding.set(false);
    }
  }

  async deleteRow(id: string): Promise<void> {
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.taskApi.deleteStatus(id));
      this.rows.set(this.rows().filter((r) => r.id !== id));
      this.saved.emit();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.errorMessage.set(detail || 'Move all tasks out of this status before deleting it.');
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.taskApi.reorderTaskStatuses(
        this.projectId(),
        this.rows().map((r, index) => ({ statusId: r.id, displayOrder: index, visibility: r.visibility, marksTaskComplete: r.marksTaskComplete }))
      ));
      this.saved.emit();
      this.closed.emit();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.errorMessage.set(detail || 'Failed to save. Make sure exactly one status is marked complete.');
    } finally {
      this.saving.set(false);
    }
  }
}
