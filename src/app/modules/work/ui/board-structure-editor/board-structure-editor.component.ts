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
    .board-structure__list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .board-structure__row { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
    .board-structure__drag-handle { cursor: grab; color: var(--color-text-secondary); }
    .board-structure__name { flex: 1; font-size: 13px; color: var(--color-text-primary); }
    .board-structure__toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-secondary); }
    .board-structure__error { color: var(--color-danger-text); font-size: 12px; margin-bottom: 8px; }
    .board-structure__actions { display: flex; justify-content: flex-end; gap: 8px; }
  `]
})
export class BoardStructureEditorComponent {
  private readonly taskApi = inject(TaskApiService);

  open = input(false);
  objectiveId = input.required<string>();
  statuses = input.required<readonly TaskStatusColumn[]>();
  saved = output<void>();
  closed = output<void>();

  protected readonly rows = signal<DraftRow[]>([]);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    // Resets the draft from the latest loaded statuses each time the modal opens - this instance
    // is always rendered (never re-created) once wired up in objective-settings, so ngOnInit would
    // only ever capture the first load and go stale on every reopen.
    effect(() => {
      if (this.open()) {
        this.rows.set(
          [...this.statuses()]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((s) => ({ id: s.id, name: s.name, visibility: s.visibility, marksTaskComplete: s.marksTaskComplete }))
        );
        this.errorMessage.set(null);
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

  async save(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.taskApi.reorderTaskStatuses(
        this.objectiveId(),
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
