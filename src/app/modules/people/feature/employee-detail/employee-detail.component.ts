import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { EmployeeJobInfoComponent } from '../../ui/employee-job-info/employee-job-info.component';
import { EmployeePersonalInfoComponent } from '../../ui/employee-personal-info/employee-personal-info.component';
import { EmployeeEmergencyContactsComponent } from '../../ui/employee-emergency-contacts/employee-emergency-contacts.component';
import { EmployeePayrollComponent } from '../../ui/employee-payroll/employee-payroll.component';
import { ChangePositionModalComponent } from '../../ui/change-position-modal/change-position-modal.component';

/**
 * Full section-by-section employee detail view backed by GET /api/v1/employees/{id}/detail.
 * Composes the Task 2 presentational sections (Job Information, Personal Information,
 * Emergency Contacts, Payroll & Statutory) and offers a Change Position action that opens
 * the Task 4 modal. Also preserves the resend-invitation flow for employees whose onboarding
 * invitation expired before they accepted it.
 */
@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    RouterLink,
    ButtonComponent,
    ErrorStateComponent,
    LoaderComponent,
    PageHeaderComponent,
    EmployeeJobInfoComponent,
    EmployeePersonalInfoComponent,
    EmployeeEmergencyContactsComponent,
    EmployeePayrollComponent,
    ChangePositionModalComponent
  ],
  template: `
    @if (loading()) {
      <app-loader label="Loading employee…" />
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="load()" />
    } @else if (employee(); as employee) {
      <app-page-header
        [title]="employee.personalInformation.firstName + ' ' + employee.personalInformation.lastName"
        [subtitle]="employee.personalInformation.email"
      >
        <a routerLink="/people/employees">
          <span class="text-sm font-medium text-[var(--color-accent)] hover:underline">Back to Employees</span>
        </a>
      </app-page-header>

      <div class="mt-4 flex flex-col gap-6">
        <div>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">Job Information</h3>
            @if (canChangePosition() && employee.jobInformation.legalEntityId) {
              <app-button (pressed)="changePositionOpen.set(true)">Change Position</app-button>
            }
          </div>
          <app-employee-job-info [jobInformation]="employee.jobInformation" />
        </div>

        <div>
          <h3 class="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Personal Information</h3>
          <app-employee-personal-info [personalInformation]="employee.personalInformation" />
        </div>

        <div>
          <h3 class="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Emergency Contacts</h3>
          <app-employee-emergency-contacts [emergencyContacts]="employee.emergencyContacts" />
        </div>

        @if (employee.payroll; as payroll) {
          <div>
            <h3 class="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Payroll & Statutory</h3>
            <app-employee-payroll [payroll]="payroll" />
          </div>
        }
      </div>

      @if (employee.invitationStatus === 'expired') {
        <div class="mt-4 max-w-2xl rounded-lg border border-[var(--color-border)] p-4 text-sm">
          <p class="mb-3 text-[var(--color-text-secondary)]">
            This employee's onboarding invitation expired before they set up their account.
          </p>
          <app-button [loading]="resending()" [disabled]="resending()" (pressed)="resendInvitation(employee.id)">
            Resend invitation
          </app-button>
        </div>
      }

      @if (employee.jobInformation.legalEntityId; as legalEntityId) {
        <app-change-position-modal
          [open]="changePositionOpen()"
          [employeeId]="employee.id"
          [legalEntityId]="legalEntityId"
          [currentPositionId]="employee.jobInformation.positionId"
          (closed)="changePositionOpen.set(false)"
          (changed)="onPositionChanged()"
        />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PeopleApiService);
  private readonly notifications = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);

  readonly employee = signal<EmployeeDetailResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly resending = signal(false);
  readonly changePositionOpen = signal(false);
  readonly canChangePosition = computed(() => this.permissionService.hasPermission('employees:write'));

  constructor() {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.api.getEmployeeDetail(id).subscribe({
      next: (employee) => {
        this.employee.set(employee);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(toSafeErrorMessage(err, 'The employee or selected organization record could not be found.'));
      }
    });
  }

  resendInvitation(employeeId: string): void {
    this.resending.set(true);
    this.api.resendInvitation(employeeId).subscribe({
      next: () => {
        this.resending.set(false);
        this.notifications.success('Invitation resent.');
        this.load();
      },
      error: (err) => {
        this.resending.set(false);
        this.notifications.error(toSafeErrorMessage(err, 'Could not resend the invitation.'));
      }
    });
  }

  onPositionChanged(): void {
    this.changePositionOpen.set(false);
    this.notifications.success('Position updated.');
    this.load();
  }
}
