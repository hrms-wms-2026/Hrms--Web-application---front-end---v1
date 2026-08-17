import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
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
  imports: [CdkDropList, CdkDrag, ButtonComponent],
  template: `
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

    <app-button variant="primary" [loading]="saving()" (pressed)="save()">Save</app-button>
  `,
  styles: [`
    .board-structure__list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .board-structure__row { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
    .board-structure__drag-handle { cursor: grab; color: var(--color-text-secondary); }
    .board-structure__name { flex: 1; font-size: 13px; color: var(--color-text-primary); }
    .board-structure__toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-secondary); }
    .board-structure__error { color: var(--color-danger-text); font-size: 12px; margin-bottom: 8px; }
  `]
})
export class BoardStructureEditorComponent implements OnInit {
  private readonly taskApi = inject(TaskApiService);

  objectiveId = input.required<string>();
  statuses = input.required<readonly TaskStatusColumn[]>();
  saved = output<void>();

  protected readonly rows = signal<DraftRow[]>([]);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.rows.set(
      [...this.statuses()]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((s) => ({ id: s.id, name: s.name, visibility: s.visibility, marksTaskComplete: s.marksTaskComplete }))
    );
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
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.errorMessage.set(detail || 'Failed to save. Make sure exactly one status is marked complete.');
    } finally {
      this.saving.set(false);
    }
  }
}
