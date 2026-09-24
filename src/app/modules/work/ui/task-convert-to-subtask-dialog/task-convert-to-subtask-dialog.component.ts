import { Component, computed, effect, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

export interface TaskConvertToSubtaskCandidate {
  id: string;
  shortId: string;
  title: string;
}

export interface TaskConvertToSubtaskPayload {
  newParentTaskId: string;
}

@Component({
  selector: 'app-task-convert-to-subtask-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Convert to subtask" (closed)="close()">
      <div class="tcsd">
        @if (!selected()) {
          <label class="tcsd__field">
            <span class="tcsd__label">Search for task name or ID</span>
            <input
              type="text"
              class="tcsd__input"
              data-testid="convert-subtask-search-input"
              placeholder="Search for task name or ID"
              [value]="searchTerm()"
              (input)="searchTerm.set($any($event.target).value)"
            />
          </label>

          <div class="tcsd__list" role="listbox" aria-label="Tasks to convert into">
            @for (candidate of filteredCandidates(); track candidate.id) {
              <button
                type="button"
                class="tcsd__item"
                data-testid="convert-subtask-candidate"
                (click)="selected.set(candidate)"
              >
                <span class="tcsd__item-id">{{ candidate.shortId }}</span>
                <span class="tcsd__item-title">{{ candidate.title }}</span>
              </button>
            } @empty {
              <p class="tcsd__empty">No matching tasks.</p>
            }
          </div>
        } @else {
          <p class="tcsd__confirm-message" data-testid="convert-subtask-confirm-message">
            @if (hasOwnSubtasks()) {
              "{{ taskTitle() }}"'s subtasks will become subtasks of "{{ selected()!.title }}".
            } @else {
              "{{ taskTitle() }}" will become a subtask of "{{ selected()!.title }}".
            }
          </p>
        }

        @if (error()) {
          <p class="tcsd__error" role="alert">{{ error() }}</p>
        }

        <div class="tcsd__actions">
          @if (selected()) {
            <app-button variant="secondary" data-testid="convert-subtask-back-button" [disabled]="submitting()" (pressed)="selected.set(null)">
              Back
            </app-button>
            <app-button variant="primary" data-testid="convert-subtask-confirm-button" [loading]="submitting()" (pressed)="confirm()">
              Confirm
            </app-button>
          } @else {
            <app-button variant="secondary" data-testid="convert-subtask-cancel-button" (pressed)="close()">Cancel</app-button>
          }
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .tcsd { display: flex; flex-direction: column; gap: 12px; }
    .tcsd__field { display: flex; flex-direction: column; gap: 5px; }
    .tcsd__label { font-size: 12px; font-weight: 500; color: var(--color-text-secondary); }
    .tcsd__input { height: 38px; border: 1px solid var(--color-border); border-radius: 8px; padding: 0 10px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; }
    .tcsd__input:focus { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .tcsd__list { display: flex; flex-direction: column; max-height: 260px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 8px; }
    .tcsd__item { display: flex; align-items: center; gap: 10px; width: 100%; border: none; border-bottom: 1px solid var(--color-border); background: transparent; padding: 9px 12px; text-align: left; cursor: pointer; font: inherit; color: var(--color-text-primary); }
    .tcsd__item:last-child { border-bottom: none; }
    .tcsd__item:hover { background: var(--color-surface-secondary); }
    .tcsd__item-id { flex: 0 0 auto; font-size: 12px; font-weight: 600; color: var(--color-text-secondary); }
    .tcsd__item-title { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tcsd__empty { margin: 0; padding: 16px 12px; font-size: 13px; color: var(--color-text-secondary); text-align: center; }
    .tcsd__confirm-message { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--color-text-primary); }
    .tcsd__error { color: var(--color-danger-text, var(--color-danger)); font-size: 12px; margin: 0; }
    .tcsd__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .tcsd__actions ::ng-deep app-button > button {
      width: auto;
      height: 30px;
      padding: 0 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
  `]
})
export class TaskConvertToSubtaskDialogComponent {
  open = input(false);
  taskTitle = input('');
  candidates = input<readonly TaskConvertToSubtaskCandidate[]>([]);
  hasOwnSubtasks = input(false);
  submitting = input(false);
  error = input<string | null>(null);

  converted = output<TaskConvertToSubtaskPayload>();
  cancelled = output<void>();

  protected readonly searchTerm = signal('');
  protected readonly selected = signal<TaskConvertToSubtaskCandidate | null>(null);

  protected readonly filteredCandidates = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.candidates();
    if (!term) return list;
    return list.filter((c) => c.title.toLowerCase().includes(term) || c.shortId.toLowerCase().includes(term));
  });

  constructor() {
    effect(() => {
      this.open();
      this.searchTerm.set('');
      this.selected.set(null);
    });
  }

  close(): void {
    this.cancelled.emit();
  }

  confirm(): void {
    const target = this.selected();
    if (!target) return;
    this.converted.emit({ newParentTaskId: target.id });
  }
}
