import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-complete-exit-step',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="obs-step-container">
      <div class="obs-step-header">
        <h3 class="obs-step-title">Finalize Employee Exit</h3>
        <p class="obs-step-subtitle">Ensure all required offboarding tasks are completed or bypassed to finalize this employee's exit.</p>
      </div>

      @if (store.record()?.status === 'completed') {
        <div class="obs-completed-box">
          <div class="obs-completed-box__icon">✓</div>
          <h4 class="obs-completed-box__title">Offboarding Exit Complete</h4>
          <p class="obs-completed-box__desc">This employee's offboarding record is fully finalized and read-only.</p>
          <app-button variant="secondary" (pressed)="backToProfile()">Back to Employee Profile</app-button>
        </div>
      } @else {
        <div class="obs-summary-box" [class.obs-summary-box--ready]="allRequiredResolved()">
          <div class="obs-summary-box__header">
            <span class="obs-summary-box__title">Task Readiness Status</span>
            <span class="obs-readiness-chip" [class.obs-readiness-chip--ready]="allRequiredResolved()">
              {{ allRequiredResolved() ? 'Ready to Complete' : 'Tasks Pending' }}
            </span>
          </div>
          <p class="obs-summary-box__copy">
            {{ allRequiredResolved() ? 'All required exit tasks have been completed or bypassed.' : 'Some required exit tasks are still open. Resolve them before completing exit.' }}
          </p>
        </div>

        <div class="obs-actions">
          <app-button variant="primary" [loading]="store.saving()" [disabled]="!allRequiredResolved()" (pressed)="complete()">
            Complete Employee Exit
          </app-button>
        </div>
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
      background: color-mix(in srgb, #16a34a 4%, var(--color-surface));
      border: 1px solid color-mix(in srgb, #16a34a 30%, var(--color-border));
      border-radius: 14px;
    }
    .obs-completed-box__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      background: color-mix(in srgb, #16a34a 15%, var(--color-surface));
      color: #16a34a;
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
    .obs-summary-box {
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
    }
    .obs-summary-box--ready {
      background: color-mix(in srgb, #16a34a 4%, var(--color-surface));
      border-color: color-mix(in srgb, #16a34a 30%, var(--color-border));
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
      background: color-mix(in srgb, #16a34a 12%, var(--color-surface));
      color: #16a34a;
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

  async complete(): Promise<void> {
    if (!this.allRequiredResolved()) return;
    await this.store.completeOffboarding(this.employeeId());
  }

  backToProfile(): void {
    void this.router.navigate(['/people/employees', this.employeeId()]);
  }
}
