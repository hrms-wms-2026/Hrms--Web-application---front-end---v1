import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../../shared/ui/loader/loader.component';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-review-tasks-step',
  standalone: true,
  imports: [ButtonComponent, LoaderComponent],
  template: `
    @if (store.loading()) {
      <app-loader label="Loading tasks…" />
    } @else {
      <div class="space-y-2">
        @for (task of store.tasks(); track task.id) {
          <div class="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-lg">
            <div>
              <p class="text-sm font-medium">{{ task.taskTitle }}</p>
              <p class="text-xs text-[var(--color-text-secondary)]">Due {{ task.dueDate }} · {{ task.isRequired ? 'Required' : 'Optional' }}</p>
            </div>
            <label class="flex items-center gap-1.5 text-xs">
              <input type="checkbox" [checked]="task.isRequired" (change)="toggleRequired(task.id, task.isRequired, $any($event.target).checked)" />
              Required
            </label>
          </div>
        }
      </div>
      <app-button variant="primary" class="mt-4" (pressed)="store.goToStep('track_exit_work')">
        Continue
      </app-button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingReviewTasksStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);

  constructor() {
    effect(() => {
      const id = this.employeeId();
      if (id) void this.store.loadTasks(id);
    });
  }

  async toggleRequired(taskId: string, currentIsRequired: boolean, checked: boolean): Promise<void> {
    if (currentIsRequired === checked) return;
    const task = this.store.tasks().find((t) => t.id === taskId);
    if (!task) return;
    await this.store.updateTask(this.employeeId(), taskId, { assignedToId: task.assignedToId, dueDate: task.dueDate, isRequired: checked });
  }
}
