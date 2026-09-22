import { Component, effect, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { Sprint } from '../../models/sprint.model';

export interface SprintMoveTarget {
  sprint: Sprint;
  currentTaskCount: number;
  currentHours: number;
}

@Component({
  selector: 'app-move-tasks-to-sprint-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Move tasks to sprint" (closed)="cancelled.emit()">
      <div class="move-tasks-dialog">
        <p class="move-tasks-dialog__summary">
          {{ taskCount() }} task{{ taskCount() === 1 ? '' : 's' }} selected
          @if (totalEstimatedHours() > 0) {
            <span> &middot; {{ totalEstimatedHours() }}h estimated</span>
          }
        </p>

        @if (blockedReason(); as reason) {
          <p class="move-tasks-dialog__blocked" role="alert">{{ reason }}</p>
        } @else if (targets().length === 0) {
          <p class="move-tasks-dialog__empty">No draft sprints available in this module yet. Create one first.</p>
        } @else {
          <div class="move-tasks-dialog__list" role="radiogroup" aria-label="Select a sprint">
            @for (target of targets(); track target.sprint.id) {
              <label
                class="move-tasks-dialog__option"
                [class.move-tasks-dialog__option--selected]="selectedSprintId() === target.sprint.id"
              >
                <input
                  type="radio"
                  name="moveTargetSprint"
                  [attr.data-testid]="'move-target-' + target.sprint.id"
                  [checked]="selectedSprintId() === target.sprint.id"
                  (change)="selectedSprintId.set(target.sprint.id)"
                />
                <div class="move-tasks-dialog__option-body">
                  <div class="move-tasks-dialog__option-header">
                    <span class="move-tasks-dialog__option-name">{{ target.sprint.name }}</span>
                    <span class="move-tasks-dialog__option-badge">DRAFT</span>
                  </div>
                  @if (target.sprint.goal) {
                    <p class="move-tasks-dialog__option-goal">{{ target.sprint.goal }}</p>
                  }
                  <p class="move-tasks-dialog__option-meta">
                    {{ target.currentTaskCount }} task{{ target.currentTaskCount === 1 ? '' : 's' }} &middot; {{ target.currentHours }}h planned
                  </p>
                  @if (selectedSprintId() === target.sprint.id && totalEstimatedHours() > 0) {
                    <div class="move-tasks-dialog__workload">
                      <span>Current {{ target.currentHours }}h</span>
                      <span>Adding +{{ totalEstimatedHours() }}h</span>
                      <span class="move-tasks-dialog__workload-after">After {{ target.currentHours + totalEstimatedHours() }}h</span>
                    </div>
                  }
                </div>
              </label>
            }
          </div>
        }

        @if (error()) {
          <p class="move-tasks-dialog__error" role="alert">{{ error() }}</p>
        }

        <div class="move-tasks-dialog__actions">
          <app-button variant="secondary" [disabled]="submitting()" (pressed)="cancelled.emit()">Cancel</app-button>
          <app-button
            variant="primary"
            [disabled]="!selectedSprintId()"
            [loading]="submitting()"
            (pressed)="confirm()"
          >
            Move {{ taskCount() }} task{{ taskCount() === 1 ? '' : 's' }}
          </app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .move-tasks-dialog { display: flex; flex-direction: column; gap: 10px; }
    .move-tasks-dialog__summary { font-size: 12px; color: var(--color-text-secondary); margin: 0; }
    .move-tasks-dialog__blocked, .move-tasks-dialog__empty { font-size: 12px; color: var(--color-text-secondary); margin: 0; }
    .move-tasks-dialog__blocked { color: var(--color-danger-text, var(--color-danger)); }
    .move-tasks-dialog__list { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
    .move-tasks-dialog__option { display: flex; align-items: flex-start; gap: 10px; border: 1px solid var(--color-border); border-radius: 10px; padding: 10px 12px; cursor: pointer; transition: border-color 160ms ease, background-color 160ms ease; }
    .move-tasks-dialog__option:hover { border-color: var(--color-accent); background: var(--color-surface-secondary); }
    .move-tasks-dialog__option--selected { border-color: var(--color-accent); background: var(--color-surface-secondary); }
    .move-tasks-dialog__option input[type="radio"] { margin-top: 2px; accent-color: var(--color-accent); cursor: pointer; }
    .move-tasks-dialog__option-body { flex: 1; min-width: 0; }
    .move-tasks-dialog__option-header { display: flex; align-items: center; gap: 8px; }
    .move-tasks-dialog__option-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .move-tasks-dialog__option-badge { font-size: 10px; font-weight: 700; letter-spacing: .04em; color: var(--color-text-secondary); border: 1px solid var(--color-border); border-radius: 999px; padding: 1px 7px; }
    .move-tasks-dialog__option-goal { font-size: 12px; color: var(--color-text-secondary); margin: 2px 0 0; }
    .move-tasks-dialog__option-meta { font-size: 11px; color: var(--color-text-secondary); margin: 4px 0 0; }
    .move-tasks-dialog__workload { display: flex; gap: 10px; font-size: 11px; color: var(--color-text-secondary); margin: 6px 0 0; }
    .move-tasks-dialog__workload-after { font-weight: 600; color: var(--color-text-primary); }
    .move-tasks-dialog__error { color: var(--color-danger-text, var(--color-danger)); font-size: 12px; margin: 0; }
    .move-tasks-dialog__actions { display: flex; justify-content: flex-end; gap: 8px; }
  `]
})
export class MoveTasksToSprintDialogComponent {
  open = input(false);
  taskCount = input(0);
  totalEstimatedHours = input(0);
  targets = input<readonly SprintMoveTarget[]>([]);
  blockedReason = input<string | null>(null);
  submitting = input(false);
  error = input<string | null>(null);

  moved = output<string>();
  cancelled = output<void>();

  protected readonly selectedSprintId = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.open();
      this.selectedSprintId.set(null);
    });
  }

  confirm(): void {
    const id = this.selectedSprintId();
    if (id) this.moved.emit(id);
  }
}
