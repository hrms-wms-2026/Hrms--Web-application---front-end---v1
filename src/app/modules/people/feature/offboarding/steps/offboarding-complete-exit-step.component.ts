import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { ConfirmModalComponent } from '../../../../../shared/ui/confirm-modal/confirm-modal.component';
import { OffboardingReason, RehireEligibility } from '../../../models/offboarding.model';
import { formatDateWithYear } from '../../../utils/employee-overview.utils';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

const REASON_LABELS: Record<OffboardingReason, string> = {
  resignation: 'Resignation', termination: 'Termination', retirement: 'Retirement', contract_end: 'Contract End'
};
const REHIRE_LABELS: Record<RehireEligibility, string> = {
  eligible: 'Eligible', not_eligible: 'Not Eligible', conditional: 'Conditional'
};

@Component({
  selector: 'app-offboarding-complete-exit-step',
  standalone: true,
  imports: [ButtonComponent, ConfirmModalComponent],
  template: `
    <div class="obs-step-container">
      <div class="obs-step-header">
        <h3 class="obs-step-title">Finalize Employee Exit</h3>
        <p class="obs-step-subtitle">Check the exit details, then complete the exit. This ends their employment.</p>
      </div>

      @if (store.record()?.status === 'completed') {
        <div class="obs-completed-box">
          <div class="obs-completed-box__icon">✓</div>
          <h4 class="obs-completed-box__title">Offboarding Exit Complete</h4>
          <p class="obs-completed-box__desc">This employee's offboarding record is fully finalized and read-only.</p>
          <app-button variant="secondary" (pressed)="backToProfile()">Back to Employee Profile</app-button>
        </div>
      } @else {
        @if (store.record(); as record) {
          <dl class="obs-exit-summary" data-testid="exit-summary">
            <div><dt>Exit reason</dt><dd>{{ reasonLabel(record.reason) }}</dd></div>
            <div><dt>Last working day</dt><dd>{{ formatDate(record.lastWorkingDate) }}</dd></div>
            <div><dt>Knowledge risk</dt><dd class="capitalize">{{ record.knowledgeRiskLevel }}</dd></div>
            <div><dt>Rehire eligibility</dt><dd>{{ rehireLabel(record.rehireEligibility) }}</dd></div>
          </dl>
        }

        @if (store.tasks().length > 0) {
          <div class="obs-summary-box" data-testid="task-readiness" [class.obs-summary-box--ready]="allRequiredResolved()">
            <div class="obs-summary-box__header">
              <span class="obs-summary-box__title">Exit checklist</span>
              <span class="obs-readiness-chip" [class.obs-readiness-chip--ready]="allRequiredResolved()">
                {{ allRequiredResolved() ? 'Ready to Complete' : 'Tasks Pending' }}
              </span>
            </div>
            <p class="obs-summary-box__copy">
              {{ allRequiredResolved() ? 'All required exit tasks have been completed or bypassed.' : 'Some required exit tasks are still open. Resolve them before completing exit.' }}
            </p>
          </div>
        }

        <div class="obs-actions">
          <app-button variant="danger" data-testid="complete-exit" [disabled]="!allRequiredResolved()" (pressed)="confirmOpen.set(true)">
            Complete Employee Exit
          </app-button>
        </div>

        <app-confirm-modal
          [open]="confirmOpen()"
          title="Complete employee exit?"
          [message]="confirmMessage()"
          confirmLabel="Complete exit"
          cancelLabel="Cancel"
          [loading]="store.saving()"
          (confirmed)="complete()"
          (cancelled)="confirmOpen.set(false)"
        />
      }
    </div>
  `,
  styles: [`
    .obs-step-container {
      max-width: 42rem;
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
    .obs-completed-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 2.5rem 1.5rem;
      background: color-mix(in srgb, var(--color-success) 4%, var(--color-surface));
      border: 1px solid color-mix(in srgb, var(--color-success) 30%, var(--color-border));
      border-radius: 14px;
    }
    .obs-completed-box__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      background: color-mix(in srgb, var(--color-success) 15%, var(--color-surface));
      color: var(--color-success);
      font-size: 1.25rem;
      font-weight: 800;
      margin-bottom: 1rem;
    }
    .obs-completed-box__title {
      margin: 0 0 0.35rem;
      font-size: 1.1rem;
      font-weight: 750;
      color: var(--color-text-primary);
    }
    .obs-completed-box__desc {
      margin: 0 0 1.25rem;
      font-size: 0.85rem;
      color: var(--color-text-secondary);
    }
    .obs-exit-summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem 1.5rem;
      margin: 0 0 1.25rem;
      padding: 1.25rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-content);
      background: var(--color-surface);
    }
    .obs-exit-summary dt {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--color-text-secondary);
    }
    .obs-exit-summary dd {
      margin: 0.125rem 0 0;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .obs-summary-box {
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
    }
    .obs-summary-box--ready {
      background: color-mix(in srgb, var(--color-success) 4%, var(--color-surface));
      border-color: color-mix(in srgb, var(--color-success) 30%, var(--color-border));
    }
    .obs-summary-box__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .obs-summary-box__title {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .obs-readiness-chip {
      padding: 0.15rem 0.55rem;
      border-radius: 6px;
      background: color-mix(in srgb, var(--color-border) 40%, transparent);
      color: var(--color-text-secondary);
      font-size: 0.75rem;
      font-weight: 650;
    }
    .obs-readiness-chip--ready {
      background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));
      color: var(--color-success);
    }
    .obs-summary-box__copy {
      margin: 0;
      font-size: 0.825rem;
      color: var(--color-text-secondary);
    }
    .obs-actions {
      display: flex;
      justify-content: flex-end;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingCompleteExitStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);
  private readonly router = inject(Router);

  readonly allRequiredResolved = computed(() =>
    this.store.tasks().filter((t) => t.isRequired).every((t) => t.status === 'completed' || t.status === 'bypassed'));

  readonly confirmOpen = signal(false);
  readonly confirmMessage = computed(() => {
    const record = this.store.record();
    const lastDay = record ? ` Their last working day is ${formatDateWithYear(record.lastWorkingDate)}.` : '';
    return `This finalizes the offboarding and ends their employment.${lastDay} It can't be undone.`;
  });

  formatDate = formatDateWithYear;

  reasonLabel(reason: OffboardingReason): string {
    return REASON_LABELS[reason];
  }

  rehireLabel(value: RehireEligibility | null): string {
    return value ? REHIRE_LABELS[value] : 'Not set';
  }

  async complete(): Promise<void> {
    if (!this.allRequiredResolved()) return;
    await this.store.completeOffboarding(this.employeeId());
    this.confirmOpen.set(false);
  }

  backToProfile(): void {
    void this.router.navigate(['/people/employees', this.employeeId()]);
  }
}
