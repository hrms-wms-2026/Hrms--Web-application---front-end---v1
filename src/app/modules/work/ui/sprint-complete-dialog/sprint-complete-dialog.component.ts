import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
import { SprintListStore } from '../../state/sprint-list.store';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-sprint-complete-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, WorkDropdownComponent],
  template: `
    <app-modal [open]="open()" [title]="'Complete ' + (sprint()?.name ?? 'sprint')" (closed)="cancelled.emit()">
      <div class="sprint-complete-dialog">
        <p class="sprint-complete-dialog__summary">
          {{ totalCount() }} tasks total · {{ completeCount() }} completed · {{ incompleteCount() }} incomplete
        </p>
        <p class="sprint-complete-dialog__summary">{{ totalEstimatedHours() }}h planned</p>

        @if (incompleteCount() > 0) {
          <p class="sprint-complete-dialog__label">What should happen to the {{ incompleteCount() }} incomplete task{{ incompleteCount() === 1 ? '' : 's' }}?</p>
          <label class="sprint-complete-dialog__radio">
            <input type="radio" name="disposition" [checked]="disposition() === 'backlog'" (change)="disposition.set('backlog')" />
            Move to Backlog
          </label>
          <label class="sprint-complete-dialog__radio">
            <input type="radio" name="disposition" [checked]="disposition() === 'sprint'" (change)="disposition.set('sprint')" />
            Move to another sprint
          </label>
          @if (disposition() === 'sprint') {
            <app-work-dropdown
              [options]="otherSprintOptions()"
              [selected]="targetSprintId()"
              placeholder="Select a sprint"
              leadingIcon="sprint"
              [fullWidth]="true"
              (selectionChanged)="targetSprintId.set($event)"
            />
          }
        }

        @if (targetError()) {
          <p class="sprint-complete-dialog__error" role="alert">{{ targetError() }}</p>
        }
        @if (store.error()) {
          <p class="sprint-complete-dialog__error" role="alert">{{ store.error() }}</p>
        }

        <div class="sprint-complete-dialog__actions">
          <app-button variant="secondary" [disabled]="submitting()" (pressed)="cancelled.emit()">Cancel</app-button>
          <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Complete sprint</app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .sprint-complete-dialog { display: flex; flex-direction: column; gap: 8px; }
    .sprint-complete-dialog__summary { font-size: 12px; color: var(--color-text-secondary); margin: 0; }
    .sprint-complete-dialog__label { font-size: 12px; font-weight: 600; color: var(--color-text-primary); margin: 6px 0 0; }
    .sprint-complete-dialog__radio { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-primary); }
    .sprint-complete-dialog__error { color: var(--color-danger-text); font-size: 12px; }
    .sprint-complete-dialog__actions { display: flex; justify-content: flex-end; gap: 8px; }
  `]
})
export class SprintCompleteDialogComponent {
  protected readonly store = inject(SprintListStore);

  open = input(false);
  sprint = input<Sprint | null>(null);
  tasks = input<readonly WorkTask[]>([]);
  otherSprints = input<readonly Sprint[]>([]);
  projectId = input.required<string>();
  completeStatusIds = input<ReadonlySet<string>>(new Set());

  completed = output<void>();
  cancelled = output<void>();

  protected readonly disposition = signal<'backlog' | 'sprint'>('backlog');
  protected readonly targetSprintId = signal('');
  protected readonly submitting = signal(false);
  protected readonly targetError = signal<string | null>(null);

  protected readonly totalCount = computed(() => this.tasks().length);
  protected readonly completeCount = computed(() =>
    this.tasks().filter((t) => this.completeStatusIds().has(t.statusId)).length
  );
  protected readonly incompleteCount = computed(() => this.totalCount() - this.completeCount());
  protected readonly totalEstimatedHours = computed(() =>
    this.tasks().reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0)
  );
  protected readonly otherSprintOptions = computed<WorkDropdownOption[]>(() =>
    this.otherSprints().map((s) => ({ value: s.id, label: s.name }))
  );

  constructor() {
    effect(() => {
      this.open();
      this.disposition.set('backlog');
      this.targetSprintId.set('');
      this.targetError.set(null);
    });
  }

  async submit(): Promise<void> {
    this.targetError.set(null);
    const current = this.sprint();
    if (!current) return;

    if (this.disposition() === 'sprint' && !this.targetSprintId()) {
      this.targetError.set('Select a target sprint.');
      return;
    }

    this.submitting.set(true);
    try {
      const ok = await this.store.complete(current.id, this.disposition() === 'sprint'
        ? { disposition: 'sprint', targetSprintId: this.targetSprintId() }
        : { disposition: 'backlog' },
        this.projectId());
      if (ok) this.completed.emit();
    } finally {
      this.submitting.set(false);
    }
  }
}
