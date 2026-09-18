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
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ColorSwatchPickerComponent } from '../color-swatch-picker/color-swatch-picker.component';
import { TaskStatusCategory, TaskStatusColumn } from '../../models/task.model';

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
    <app-modal [open]="open()" title="Edit task statuses" (closed)="close()">
      <div cdkDropListGroup>
        @for (group of groups; track group) {
          <section class="board-structure__group">
            <header>
              <b>{{ label(group) }}</b
              ><span>{{ rowsFor(group)().length }}</span>
              @if (group !== 'done' || rowsFor('done')().length === 0) {
                <button
                  type="button"
                  [disabled]="busy()"
                  [attr.aria-label]="'Add ' + label(group) + ' status'"
                  (click)="startAdd(group)"
                >
                  +
                </button>
              }
            </header>
            <div
              cdkDropList
              [id]="'board-structure-drop-' + group"
              [cdkDropListData]="rowsFor(group)()"
              [cdkDropListDisabled]="busy() || (group === 'done' && rowsFor('done')().length >= 1)"
              (cdkDropListDropped)="onDrop($event, group)"
              class="board-structure__list"
            >
              @for (row of rowsFor(group)(); track row.id) {
                <div
                  cdkDrag
                  [cdkDragDisabled]="busy()"
                  class="board-structure__row"
                >
                  <span cdkDragHandle aria-hidden="true">⠿</span>
                  <button
                    type="button"
                    class="board-structure__color"
                    [style.background]="row.color"
                    [disabled]="busy()"
                    [attr.aria-label]="'Change color for ' + row.name"
                    (click)="toggleColorPicker(row.id)"
                  ></button>
                  <input
                    class="board-structure__name"
                    aria-label="Status name"
                    maxlength="100"
                    [disabled]="busy()"
                    [value]="row.name"
                    (input)="rename(row.id, $any($event.target).value)"
                  />
                  <button
                    type="button"
                    [disabled]="busy()"
                    [attr.aria-label]="'Private status: ' + row.name"
                    [attr.aria-pressed]="row.visibility === 'private'"
                    (click)="toggleVisibility(row.id)"
                  >
                    {{ row.visibility === 'private' ? '🔒' : '🔓' }}
                  </button>
                  <details>
                    <summary aria-label="Status actions">⋯</summary>
                    <button
                      type="button"
                      [disabled]="busy() || !canDelete(row)"
                      (click)="deleteRow(row.id)"
                    >
                      Delete
                    </button>
                  </details>
                </div>
                @if (colorPickerFor() === row.id) {
                  <app-color-swatch-picker
                    [presets]="presets"
                    [selected]="row.color"
                    (colorChange)="setColor(row.id, $event)"
                  />
                }
              }
            </div>
            @if (addingTo() === group) {
              <div class="board-structure__add">
                <input
                  aria-label="New status name"
                  maxlength="100"
                  [disabled]="busy()"
                  [value]="newStatusName()"
                  (input)="newStatusName.set($any($event.target).value)"
                  (keydown.enter)="confirmAdd()"
                /><button
                  type="button"
                  [disabled]="busy() || !newStatusName().trim()"
                  (click)="confirmAdd()"
                >
                  Add</button
                ><button type="button" [disabled]="busy()" (click)="cancelAdd()">Cancel</button>
              </div>
            }
          </section>
        }
      </div>
      @if (errorMessage()) {
        <p role="alert">{{ errorMessage() }}</p>
      }
      <footer>
        <app-button variant="secondary" [disabled]="busy()" (pressed)="close()">Cancel</app-button
        ><app-button variant="primary" [disabled]="busy()" [loading]="saving()" (pressed)="save()"
          >Update</app-button
        >
      </footer>
    </app-modal>
  `,
  styles: [
    `
      .board-structure__group {
        margin-bottom: 18px;
      }
      header,
      footer,
      .board-structure__add {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      header {
        margin-bottom: 8px;
      }
      header button {
        margin-left: auto;
      }
      .board-structure__list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-height: 24px;
      }
      .board-structure__row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        border: 1px solid var(--color-border);
        border-radius: 7px;
      }
      .board-structure__name {
        flex: 1;
        min-width: 0;
        background: transparent;
        color: inherit;
        border: 0;
        padding: 4px;
      }
      .board-structure__color {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 0;
        flex-shrink: 0;
      }
      button,
      summary {
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      details {
        position: relative;
      }
      details button {
        position: absolute;
        right: 0;
        z-index: 1;
        background: var(--color-surface);
        padding: 8px;
        border: 1px solid var(--color-border);
      }
      summary {
        list-style: none;
      }
      footer {
        justify-content: flex-end;
      }
      p {
        color: var(--color-danger-text);
      }
    `,
  ],
})
export class BoardStructureEditorComponent {
  private readonly taskApi = inject(TaskApiService);
  readonly groups = groups;
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
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly addingTo = signal<TaskStatusCategory | null>(null);
  protected readonly newStatusName = signal('');
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
          return;
        }
        if (this.editingProject === project) return;
        if (!statuses.length) return;
        this.editingProject = project;
        this.originals = new Map(statuses.map((row) => [row.id, row]));
        const sorted = [...statuses].sort((a, b) => a.displayOrder - b.displayOrder);
        for (const group of groups)
          this.rowsFor(group).set(
            sorted.filter((row) => row.category === group).map((row) => ({ ...row })),
          );
        this.errorMessage.set(null);
      });
    });
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
    if (this.busy()) return;
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
    if (this.busy()) return;
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
    if ((group === 'done' && this.done().length >= 1) || this.busy()) return;
    this.addingTo.set(group);
    this.newStatusName.set('');
  }
  cancelAdd() {
    this.addingTo.set(null);
    this.newStatusName.set('');
  }
  async confirmAdd() {
    const group = this.addingTo(),
      name = this.newStatusName().trim();
    if (!group || (group === 'done' && this.done().length >= 1) || !name || this.busy()) return;
    this.mutating.set(true);
    this.errorMessage.set(null);
    try {
      const row = await firstValueFrom(
        this.taskApi.createStatus(this.projectId(), {
          name,
          displayOrder: this.flatten().length,
          visibility: 'public',
          category: group,
          color: colors[group],
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
    if (!row || !this.canDelete(row) || this.busy()) return;
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
    if (this.busy()) return;
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
  private showError(error: unknown, fallback: string) {
    this.errorMessage.set((error as { error?: { detail?: string } })?.error?.detail || fallback);
  }
}
