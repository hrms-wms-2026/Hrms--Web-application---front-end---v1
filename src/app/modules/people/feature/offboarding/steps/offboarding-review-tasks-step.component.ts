import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../../shared/ui/loader/loader.component';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-review-tasks-step',
  standalone: true,
  imports: [ButtonComponent, LoaderComponent],
  template: `
    <div class="obs-step-container">
      <div class="obs-step-header">
        <h3 class="obs-step-title">Review Checklist Tasks</h3>
        <p class="obs-step-subtitle">Review required vs optional tasks for this employee's exit workflow before starting tracking.</p>
      </div>

      @if (store.loading()) {
        <app-loader label="Loading tasks…" />
      } @else {
        <div class="obs-task-list">
          @for (task of store.tasks(); track task.id) {
            <div class="obs-task-card">
              <div class="obs-task-card__info">
                <h4 class="obs-task-card__title">{{ task.taskTitle }}</h4>
                <div class="obs-task-card__meta">
                  <span class="obs-meta-chip">Due: {{ task.dueDate }}</span>
                  <span class="obs-meta-chip" [class.obs-meta-chip--req]="task.isRequired">
                    {{ task.isRequired ? 'Required Task' : 'Optional Task' }}
                  </span>
                </div>
              </div>
              <label class="obs-toggle-label">
                <input
                  type="checkbox"
                  [checked]="task.isRequired"
                  (change)="toggleRequired(task.id, task.isRequired, $any($event.target).checked)"
                  class="obs-checkbox"
                />
                <span class="obs-toggle-text">Required</span>
              </label>
            </div>
          }
        </div>
        <div class="obs-actions">
          <app-button variant="primary" (pressed)="store.goToStep('track_exit_work')">
            Continue to Track Work
          </app-button>
        </div>
      }
    </div>
  `,
  styles: [`
    .obs-step-container {
      max-width: 44rem;
    }
    .obs-step-header {
      margin-bottom: 1.25rem;
    }
    .obs-step-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .obs-step-subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.825rem;
      color: var(--color-text-secondary);
    }
    .obs-task-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .obs-task-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.875rem 1.15rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
    }
    .obs-task-card__info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .obs-task-card__title {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 650;
      color: var(--color-text-primary);
    }
    .obs-task-card__meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .obs-meta-chip {
      padding: 0.1rem 0.45rem;
      border-radius: 6px;
      background: color-mix(in srgb, var(--color-border) 40%, transparent);
      color: var(--color-text-secondary);
      font-size: 0.725rem;
      font-weight: 600;
    }
    .obs-meta-chip--req {
      background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
      color: var(--color-primary);
    }
    .obs-toggle-label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      cursor: pointer;
    }
    .obs-checkbox {
      accent-color: var(--color-primary);
      width: 1rem;
      height: 1rem;
      cursor: pointer;
    }
    .obs-toggle-text {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .obs-actions {
      display: flex;
      justify-content: flex-end;
    }
  `],
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
