import { Component, effect, input, output, signal, untracked } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

export interface TaskDuplicateModuleOption {
  objectiveId: string;
  title: string;
}

export interface TaskDuplicatePayload {
  title: string;
  destinationObjectiveId: string;
  copyAttachments: boolean;
  copyAssignees: boolean;
  copyComments: boolean;
  copyDueDate: boolean;
}

@Component({
  selector: 'app-task-duplicate-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Duplicate task" (closed)="cancelled.emit()">
      <div class="task-duplicate-dialog">
        <label class="task-duplicate-dialog__field">
          <span class="task-duplicate-dialog__label">Name</span>
          <input
            type="text"
            class="task-duplicate-dialog__input"
            data-testid="duplicate-title-input"
            [value]="title()"
            (input)="title.set($any($event.target).value)"
          />
        </label>

        <label class="task-duplicate-dialog__field">
          <span class="task-duplicate-dialog__label">Duplicate to</span>
          <select
            class="task-duplicate-dialog__select"
            data-testid="duplicate-module-select"
            [value]="destinationObjectiveId()"
            (change)="destinationObjectiveId.set($any($event.target).value)"
          >
            @for (m of modules(); track m.objectiveId) {
              <option [value]="m.objectiveId">{{ m.title }}</option>
            }
          </select>
        </label>

        <div class="task-duplicate-dialog__toggles">
          <label class="task-duplicate-dialog__toggle">
            <input type="checkbox" data-testid="duplicate-copy-attachments" [checked]="copyAttachments()" (change)="copyAttachments.set($any($event.target).checked)" />
            <span>Attachments</span>
          </label>
          <label class="task-duplicate-dialog__toggle">
            <input type="checkbox" data-testid="duplicate-copy-assignees" [checked]="copyAssignees()" (change)="copyAssignees.set($any($event.target).checked)" />
            <span>Assignees</span>
          </label>
          <label class="task-duplicate-dialog__toggle">
            <input type="checkbox" data-testid="duplicate-copy-comments" [checked]="copyComments()" (change)="copyComments.set($any($event.target).checked)" />
            <span>Comments</span>
          </label>
          <label class="task-duplicate-dialog__toggle">
            <input type="checkbox" data-testid="duplicate-copy-due-date" [checked]="copyDueDate()" (change)="copyDueDate.set($any($event.target).checked)" />
            <span>Due date</span>
          </label>
        </div>

        @if (error()) {
          <p class="task-duplicate-dialog__error" role="alert">{{ error() }}</p>
        }

        <div class="task-duplicate-dialog__actions">
          <app-button variant="secondary" data-testid="duplicate-cancel-button" [disabled]="submitting()" (pressed)="cancelled.emit()">Cancel</app-button>
          <app-button
            variant="primary"
            data-testid="duplicate-confirm-button"
            [disabled]="!title().trim() || !destinationObjectiveId()"
            [loading]="submitting()"
            (pressed)="confirm()"
          >
            Duplicate
          </app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .task-duplicate-dialog { display: flex; flex-direction: column; gap: 12px; }
    .task-duplicate-dialog__field { display: flex; flex-direction: column; gap: 5px; }
    .task-duplicate-dialog__label { font-size: 12px; font-weight: 500; color: var(--color-text-secondary); }
    .task-duplicate-dialog__input, .task-duplicate-dialog__select { height: 38px; border: 1px solid var(--color-border); border-radius: 8px; padding: 0 10px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; }
    .task-duplicate-dialog__input:focus, .task-duplicate-dialog__select:focus { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .task-duplicate-dialog__toggles { display: flex; flex-wrap: wrap; gap: 12px; }
    .task-duplicate-dialog__toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-primary); cursor: pointer; }
    .task-duplicate-dialog__toggle input { accent-color: var(--color-accent); cursor: pointer; }
    .task-duplicate-dialog__error { color: var(--color-danger-text, var(--color-danger)); font-size: 12px; margin: 0; }
    .task-duplicate-dialog__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .task-duplicate-dialog__actions ::ng-deep app-button > button {
      width: auto;
      height: 30px;
      padding: 0 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
  `]
})
export class TaskDuplicateDialogComponent {
  open = input(false);
  taskTitle = input('');
  currentObjectiveId = input('');
  modules = input<readonly TaskDuplicateModuleOption[]>([]);
  submitting = input(false);
  error = input<string | null>(null);

  duplicated = output<TaskDuplicatePayload>();
  cancelled = output<void>();

  protected readonly title = signal('');
  protected readonly destinationObjectiveId = signal('');
  protected readonly copyAttachments = signal(true);
  protected readonly copyAssignees = signal(true);
  protected readonly copyComments = signal(false);
  protected readonly copyDueDate = signal(true);

  constructor() {
    effect(() => {
      this.open();
      const taskTitle = untracked(this.taskTitle);
      const modules = untracked(this.modules);
      const currentObjectiveId = untracked(this.currentObjectiveId);

      this.title.set(taskTitle ? `${taskTitle} (copy)` : '');
      this.destinationObjectiveId.set(
        modules.some((m) => m.objectiveId === currentObjectiveId) ? currentObjectiveId : (modules[0]?.objectiveId ?? '')
      );
      this.copyAttachments.set(true);
      this.copyAssignees.set(true);
      this.copyComments.set(false);
      this.copyDueDate.set(true);
    });
  }

  confirm(): void {
    const title = this.title().trim();
    const destinationObjectiveId = this.destinationObjectiveId();
    if (!title || !destinationObjectiveId) return;

    this.duplicated.emit({
      title, destinationObjectiveId,
      copyAttachments: this.copyAttachments(), copyAssignees: this.copyAssignees(),
      copyComments: this.copyComments(), copyDueDate: this.copyDueDate()
    });
  }
}
