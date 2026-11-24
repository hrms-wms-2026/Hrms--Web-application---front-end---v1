import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { AddEmployeeWizardComponent } from '../../../people/feature/add-employee-wizard/add-employee-wizard.component';
import { SelfPrefill } from '../../../people/models/onboarding-draft.model';
import { SelfSetupApiService } from '../../data-access/self-setup-api.service';
import { SelfSetupStatusDto } from '../../models/self-setup-status.model';

/**
 * My Work for an account with no employee profile (e.g. a company owner): one calm panel instead of widgets that
 * would all fail. When the company has a legal entity and a position it offers "Add yourself as an employee",
 * which opens the Add Employee wizard prefilled with the signed-in user's own name and email.
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
        }
      </app-empty-state>
    </div>
    @if (wizardOpen() && prefill(); as identity) {
      <app-add-employee-wizard [isModal]="true" [selfPrefill]="identity" (closed)="wizardOpen.set(false)" (saved)="onSaved($event)" />
    }
  `
})
export class NoEmployeeProfilePanelComponent {
  /** The profile now exists and the session knows it: the host can load the normal dashboard. */
  readonly profileCreated = output<void>();

  private readonly api = inject(SelfSetupApiService);
  private readonly auth = inject(AuthStore);

  protected readonly status = signal<SelfSetupStatusDto | null>(null);
  protected readonly wizardOpen = signal(false);

  protected readonly description = computed(() => {
    const status = this.status();
    if (!status) return '';
    return status.can_add_self ? 'Add yourself as an employee to see your work here.' : 'Add a legal entity and a position first.';
  });

  protected readonly prefill = computed<SelfPrefill | null>(() => {
    const status = this.status();
    return status ? { firstName: status.first_name, lastName: status.last_name, workEmail: status.work_email } : null;
  });

  constructor() {
    void this.loadStatus();
  }

  protected async onSaved(event: { finalized: boolean; self?: boolean }): Promise<void> {
    if (!event.finalized || !event.self) return;
    this.wizardOpen.set(false);
    await this.auth.checkSession();
    this.profileCreated.emit();
  }

  private async loadStatus(): Promise<void> {
    try {
      this.status.set(await firstValueFrom(this.api.getStatus()));
    } catch {
      // No permission or unreachable: the title alone still explains the empty home screen.
      this.status.set(null);
    }
  }
}
