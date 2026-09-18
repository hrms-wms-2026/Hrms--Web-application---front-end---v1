import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SprintListStore } from '../../state/sprint-list.store';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-sprint-start-dialog',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" [title]="'Start ' + (sprint()?.name ?? 'sprint')" (closed)="cancelled.emit()">
      <div class="sprint-start-dialog">
        <p class="sprint-start-dialog__summary">
          {{ taskCount() }} task{{ taskCount() === 1 ? '' : 's' }} ·
          {{ totalEstimatedHours() }}h estimated ·
          {{ assigneeCount() }} member{{ assigneeCount() === 1 ? '' : 's' }} assigned
        </p>

        <app-input label="Start date" type="date" [value]="startDate()" (valueChange)="startDate.set($event)" />
        <app-input label="End date" type="date" [value]="endDate()" (valueChange)="endDate.set($event)" />
        <app-input label="Sprint goal (optional)" [value]="goal()" (valueChange)="goal.set($event)" />

        @if (hasUnestimatedTasks()) {
          <p class="sprint-start-dialog__warning">⚠ Some tasks have no estimate.</p>
        }
        @if (hasUnassignedTasks()) {
          <p class="sprint-start-dialog__warning">⚠ Some tasks have no assignee.</p>
        }
        <p class="sprint-start-dialog__hint">You can still start the sprint.</p>

        @if (dateError()) {
          <p class="sprint-start-dialog__error" role="alert">{{ dateError() }}</p>
        }
        @if (store.error()) {
          <p class="sprint-start-dialog__error" role="alert">{{ store.error() }}</p>
        }

        <div class="sprint-start-dialog__actions">
          <app-button variant="secondary" [disabled]="submitting()" (pressed)="cancelled.emit()">Cancel</app-button>
          <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Start sprint</app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .sprint-start-dialog { display: flex; flex-direction: column; gap: 8px; }
    .sprint-start-dialog__summary { font-size: 12px; color: var(--color-text-secondary); margin: 0 0 4px; }
    .sprint-start-dialog__warning { color: var(--color-warning-text, #92400e); font-size: 12px; margin: 0; }
    .sprint-start-dialog__hint { font-size: 12px; color: var(--color-text-secondary); margin: 0; }
    .sprint-start-dialog__error { color: var(--color-danger-text); font-size: 12px; }
    .sprint-start-dialog__actions { display: flex; justify-content: flex-end; gap: 8px; }
  `]
})
export class SprintStartDialogComponent {
  protected readonly store = inject(SprintListStore);

  open = input(false);
  sprint = input<Sprint | null>(null);
  tasks = input<readonly WorkTask[]>([]);
  objectiveId = input<string>('');
  activeOnly = input(false);
  projectId = input<string | undefined>(undefined);

  started = output<void>();
  cancelled = output<void>();

  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly goal = signal('');
  protected readonly submitting = signal(false);
  protected readonly dateError = signal<string | null>(null);

  protected readonly taskCount = computed(() => this.tasks().length);
  protected readonly totalEstimatedHours = computed(() =>
    this.tasks().reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0)
  );
  protected readonly assigneeCount = computed(() =>
    new Set(this.tasks().flatMap((t) => t.assigneeEmployeeIds)).size
  );
  protected readonly hasUnestimatedTasks = computed(() =>
    this.tasks().some((t) => t.estimatedHours == null)
  );
  protected readonly hasUnassignedTasks = computed(() =>
    this.tasks().some((t) => t.assigneeEmployeeIds.length === 0)
  );

  constructor() {
    effect(() => {
      this.open();
      this.goal.set(this.sprint()?.goal ?? '');
      this.startDate.set('');
      this.endDate.set('');
      this.dateError.set(null);
    });
  }

  async submit(): Promise<void> {
    this.dateError.set(null);
    const current = this.sprint();
    if (!current || !this.startDate() || !this.endDate()) {
      this.dateError.set('Start and end dates are required.');
      return;
    }

    this.submitting.set(true);
    try {
      const ok = await this.store.start(current.id, {
        startDate: this.startDate(),
        endDate: this.endDate(),
        goal: this.goal().trim() || undefined
      }, this.objectiveId(), this.activeOnly(), this.projectId());
      if (ok) this.started.emit();
    } finally {
      this.submitting.set(false);
    }
  }
}
