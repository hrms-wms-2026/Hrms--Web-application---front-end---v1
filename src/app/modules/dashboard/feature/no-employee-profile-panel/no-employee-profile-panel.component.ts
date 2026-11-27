import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { AddEmployeeWizardComponent } from '../../../people/feature/add-employee-wizard/add-employee-wizard.component';
import { SelfPrefill } from '../../../people/models/onboarding-draft.model';
import { OwnerSetupGuideService } from '../../state/owner-setup-guide.service';

/**
 * My Work for an account with no employee profile (e.g. a company owner): one calm panel instead of widgets that
 * would all fail. When the company has a legal entity and a position it offers "Add yourself as an employee",
 * which opens the Add Employee wizard prefilled with the signed-in user's own name and email. Until then the floating
 * setup guide walks the owner through the steps; after "Skip for now" this panel offers "Resume setup".
 */
@Component({
  selector: 'app-no-employee-profile-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, ButtonComponent, AddEmployeeWizardComponent],
  template: `
    <div data-testid="no-employee-profile-panel">
      <app-empty-state title="Your employee profile isn't set up yet" [description]="description()">
        @if (status()?.can_add_self) {
          <div class="mt-2" data-testid="add-yourself">
            <app-button (pressed)="wizardOpen.set(true)">Add yourself as an employee</app-button>
          </div>
        } @else if (status() && guide.skipped()) {
          <div class="mt-2" data-testid="resume-setup">
            <app-button variant="secondary" (pressed)="guide.resume()">Resume setup</app-button>
          </div>
        }
      </app-empty-state>
    </div>
    @if (wizardOpen() && prefill(); as identity) {
      <app-add-employee-wizard
        [isModal]="true"
        [selfPrefill]="identity"
        (closed)="wizardOpen.set(false)"
        (saved)="onSaved($event)"
      />
    }
  `,
})
export class NoEmployeeProfilePanelComponent {
  protected readonly guide = inject(OwnerSetupGuideService);
  private readonly auth = inject(AuthStore);

  protected readonly status = this.guide.status;
  protected readonly wizardOpen = signal(false);

  protected readonly description = computed(() => {
    const status = this.status();
    if (!status) return '';
    return status.can_add_self
      ? 'Add yourself as an employee to see your work here.'
      : 'Finish setting up your company to add yourself as an employee.';
  });

  protected readonly prefill = computed<SelfPrefill | null>(() => {
    const status = this.status();
    return status
      ? { firstName: status.first_name, lastName: status.last_name, workEmail: status.work_email }
      : null;
  });

  constructor() {
    void this.guide.refresh();
  }

  protected async onSaved(event: { finalized: boolean; self?: boolean }): Promise<void> {
    if (!event.finalized || !event.self) return;
    this.wizardOpen.set(false);
    this.guide.markFinished();
    // The session now has an employee: the dashboard shell swaps this panel for the normal My Work.
    await this.auth.checkSession();
  }
}
