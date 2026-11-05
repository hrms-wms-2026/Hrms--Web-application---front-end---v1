import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../../shared/ui/input/input.component';
import { EmployeeChecklistTaskResponse } from '../../../models/offboarding.model';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-complete-or-bypass-step',
  standalone: true,
  imports: [ButtonComponent, InputComponent],
  template: `
    <div class="obs-step-container">
      <div class="obs-step-header">
        <h3 class="obs-step-title">Complete or Bypass Tasks</h3>
        <p class="obs-step-subtitle">Mark checklist items as completed or submit bypass approval requests for exceptions.</p>
      </div>

      <div class="obs-task-list">
        @for (task of store.tasks(); track task.id) {
          <div class="obs-task-card" [class.obs-task-card--resolved]="task.status === 'completed' || task.status === 'bypassed'">
            <div class="obs-task-card__header">
              <span class="obs-task-card__title">{{ task.taskTitle }}</span>
              <span class="obs-status-tag" [class.obs-status-tag--done]="task.status === 'completed' || task.status === 'bypassed'">
                {{ task.status }}
              </span>
            </div>

            @if (task.status === 'pending' || task.status === 'in_progress') {
              <div class="obs-task-card__actions">
                <app-button variant="secondary" size="sm" [loading]="store.saving()" (pressed)="complete(task.id)">
                  Complete Task
                </app-button>
                @if (task.isBypassable) {
                  <app-button variant="secondary" size="sm" (pressed)="openBypass(task)">
                    Request Bypass
                  </app-button>
                }
              </div>
            }

            @if (bypassingTaskId() === task.id) {
              <div class="obs-bypass-box">
                <h4 class="obs-bypass-box__title">Bypass Approval Request</h4>
                <div class="obs-bypass-box__grid">
                  <app-input label="Bypass reason *" [value]="bypassReason()" (valueChange)="bypassReason.set($event)" />
                  <app-input label="Penalty (if approved)" [value]="penaltyDescription()" (valueChange)="penaltyDescription.set($event)" />
                  <app-input label="Approver user id *" [value]="approverId()" (valueChange)="approverId.set($event)" />
                </div>
                <div class="obs-bypass-box__actions">
                  <app-button variant="primary" size="sm" [loading]="store.saving()" [disabled]="!bypassReason() || !approverId()" (pressed)="submitBypass(task.id)">
                    Send for Approval
                  </app-button>
                  <app-button variant="secondary" size="sm" (pressed)="bypassingTaskId.set(null)">
                    Cancel
                  </app-button>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <div class="obs-actions">
        <app-button variant="primary" (pressed)="store.goToStep('complete_exit')">
          Continue to Final Exit
        </app-button>
      </div>
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
      gap: 0.875rem;
      margin-bottom: 1.5rem;
    }
    .obs-task-card {
      padding: 1rem 1.15rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
    }
    .obs-task-card--resolved {
      background: color-mix(in srgb, var(--color-border) 10%, var(--color-surface));
    }
    .obs-task-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .obs-task-card__title {
      font-size: 0.875rem;
      font-weight: 650;
      color: var(--color-text-primary);
    }
    .obs-status-tag {
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      background: color-mix(in srgb, var(--color-border) 40%, transparent);
      color: var(--color-text-secondary);
      font-size: 0.725rem;
      font-weight: 600;
      text-transform: capitalize;
    }
    .obs-status-tag--done {
      background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));
      color: var(--color-success);
    }
    .obs-task-card__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    .obs-bypass-box {
      margin-top: 0.875rem;
      padding: 0.875rem 1rem;
      background: color-mix(in srgb, var(--color-border) 15%, var(--color-surface));
      border: 1px solid var(--color-border);
      border-radius: 10px;
    }
    .obs-bypass-box__title {
      margin: 0 0 0.625rem;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .obs-bypass-box__grid {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }
    .obs-bypass-box__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    .obs-actions {
      display: flex;
      justify-content: flex-end;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingCompleteOrBypassStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);

  readonly bypassingTaskId = signal<string | null>(null);
  readonly bypassReason = signal('');
  readonly penaltyDescription = signal('');
  readonly approverId = signal('');

  async complete(taskId: string): Promise<void> {
    await this.store.completeTask(this.employeeId(), taskId);
  }

  openBypass(task: EmployeeChecklistTaskResponse): void {
    this.bypassingTaskId.set(task.id);
    this.bypassReason.set('');
    this.penaltyDescription.set(task.bypassPenaltyDescription ?? '');
    this.approverId.set('');
  }

  async submitBypass(taskId: string): Promise<void> {
    const reason = this.bypassReason();
    const approver = this.approverId();
    if (!reason || !approver) return;
    const ok = await this.store.createBypassRequest(this.employeeId(), taskId, {
      approverId: approver, bypassReason: reason, penaltyDescription: this.penaltyDescription() || null
    });
    if (ok) this.bypassingTaskId.set(null);
  }
}
