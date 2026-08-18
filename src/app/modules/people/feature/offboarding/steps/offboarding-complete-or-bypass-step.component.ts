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
    <div class="space-y-2">
      @for (task of store.tasks(); track task.id) {
        <div class="p-3 border border-[var(--color-border)] rounded-lg">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{{ task.taskTitle }}</span>
            <span class="text-xs text-[var(--color-text-secondary)]">{{ task.status }}</span>
          </div>
          @if (task.status === 'pending' || task.status === 'in_progress') {
            <div class="flex gap-2 mt-2">
              <app-button variant="secondary" [loading]="store.saving()" (pressed)="complete(task.id)">Complete</app-button>
              @if (task.isBypassable) {
                <app-button variant="secondary" (pressed)="openBypass(task)">Bypass</app-button>
              }
            </div>
          }
          @if (bypassingTaskId() === task.id) {
            <div class="mt-2 space-y-2 p-2 border-t border-[var(--color-border)]">
              <app-input label="Bypass reason *" [value]="bypassReason()" (valueChange)="bypassReason.set($event)" />
              <app-input label="Penalty (if approved)" [value]="penaltyDescription()" (valueChange)="penaltyDescription.set($event)" />
              <app-input label="Approver user id *" [value]="approverId()" (valueChange)="approverId.set($event)" />
              <app-button variant="primary" [loading]="store.saving()" [disabled]="!bypassReason() || !approverId()" (pressed)="submitBypass(task.id)">
                Send for Approval
              </app-button>
            </div>
          }
        </div>
      }
    </div>
    <app-button variant="primary" class="mt-4" (pressed)="store.goToStep('complete_exit')">
      Continue
    </app-button>
  `,
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
