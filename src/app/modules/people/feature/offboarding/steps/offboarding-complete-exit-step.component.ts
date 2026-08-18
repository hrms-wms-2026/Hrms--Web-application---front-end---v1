import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-complete-exit-step',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    @if (store.record()?.status === 'completed') {
      <p class="text-sm font-medium text-[var(--color-text-primary)]">This employee's exit is complete. The record is now read-only.</p>
      <app-button variant="secondary" class="mt-4" (pressed)="backToProfile()">Back to Profile</app-button>
    } @else {
      <p class="text-sm text-[var(--color-text-secondary)] mb-4">
        Review complete. {{ allRequiredResolved() ? 'All required tasks are resolved.' : 'Some required tasks are still open.' }}
      </p>
      <app-button variant="primary" [loading]="store.saving()" [disabled]="!allRequiredResolved()" (pressed)="complete()">
        Complete Employee Exit
      </app-button>
    }
  `,
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
