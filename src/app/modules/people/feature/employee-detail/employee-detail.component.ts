import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailAddress, EmployeeDetailResponse, UpdateEmployeeJobDetailsRequest } from '../../models/employee.model';
import { EmployeeJobInfoComponent } from '../../ui/employee-job-info/employee-job-info.component';
import { EmployeePersonalInfoComponent } from '../../ui/employee-personal-info/employee-personal-info.component';
import { EmployeeEmergencyContactsComponent } from '../../ui/employee-emergency-contacts/employee-emergency-contacts.component';
import { EmployeePayrollComponent } from '../../ui/employee-payroll/employee-payroll.component';
import { ChangePositionModalComponent } from '../../ui/change-position-modal/change-position-modal.component';
import { EmployeeJobJourneyComponent } from '../../ui/employee-job-journey/employee-job-journey.component';
import { PositionHistoryEntryResponse } from '../../models/position-history.model';
import { OffboardingWizardStore } from '../../state/offboarding-wizard.store';
import {
  attendanceWarningLabel,
  attendanceAttentionLabel,
  attendanceStatusLabel,
  attendanceSeverityClass,
  breakOverageLabel
} from '../../utils/employee-view.utils';

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
    BreadcrumbHeaderComponent,
    ButtonComponent,
    ErrorStateComponent,
    LoaderComponent,
    EmployeeJobInfoComponent,
    EmployeePersonalInfoComponent,
    EmployeeEmergencyContactsComponent,
    EmployeePayrollComponent,
    ChangePositionModalComponent,
    PopoverComponent,
    EmployeeJobJourneyComponent
  ],
  template: `
    @if (loading()) {
      <app-loader label="Loading employee…" />
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="load()" />
    } @else if (employee(); as employee) {
      <header class="emp-detail-header">
        <app-breadcrumb-header
          parentLabel="Employees"
          currentLabel="Employee Detail"
          parentUrl="/people/employees"
          icon="people"
        />
      </header>

      <!-- Hero Profile Banner -->
      <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 mb-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="flex items-center gap-5">
            <div class="relative flex-shrink-0">
              <div class="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl shadow-inner border border-blue-200">
                {{ getInitials(employee.personalInformation.firstName, employee.personalInformation.lastName) }}
              </div>
              <span class="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white"
                    [class.bg-green-500]="employee.jobInformation.status.toLowerCase() === 'active'"
                    [class.bg-red-500]="employee.jobInformation.status.toLowerCase() === 'inactive'"></span>
            </div>

            <div>
              <div class="flex items-center gap-3 flex-wrap">
                <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">
                  {{ employee.personalInformation.firstName }} {{ employee.personalInformation.lastName }}
                </h1>
                <span class="inline-flex items-center font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                  {{ employee.jobInformation.employeeNumber }}
                </span>
              </div>
              <p class="text-sm text-[var(--color-text-secondary)] mt-1 flex items-center gap-2 flex-wrap">
                <span>{{ employee.personalInformation.email }}</span>
                <span>•</span>
                <span class="font-medium text-[var(--color-text-primary)]">{{ employee.jobInformation.positionName || 'Unassigned Position' }}</span>
                <span>•</span>
                <span>{{ employee.jobInformation.legalEntityName || 'Company' }}</span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            @if ((canChangePosition() || canOffboard()) && !isOwnRecord() && employee.jobInformation.legalEntityId && !isReadOnly() && employee.invitationStatus !== 'pending' && employee.invitationStatus !== 'expired') {
              <app-popover [open]="changePositionMenuOpen()" ariaLabel="Change position actions" align="right" (closed)="changePositionMenuOpen.set(false)">
                <app-button popover-trigger data-testid="change-position-trigger" (pressed)="changePositionMenuOpen.set(!changePositionMenuOpen())">
                  {{ canChangePosition() ? 'Transfer / Promote' : 'Offboarding' }}
                </app-button>
                <div popover-panel class="change-position-menu">
                  @if (canChangePosition()) {
                    <button type="button" class="profile-action-btn" (click)="openChangePosition('Promotion')">Promotion</button>
                    <button type="button" class="profile-action-btn" (click)="openChangePosition('Transfer')">Transfer</button>
                  }
                  @if (canOffboard()) {
                    <button type="button" class="profile-action-btn" data-testid="offboarding-menu-item" (click)="navigateToOffboarding(employee.id)">
                      {{ offboardingStatus() && offboardingStatus() !== 'cancelled' ? (isReadOnly() ? 'View Offboarding' : 'Continue Offboarding') : 'Offboarding' }}
                    </button>
                  }
                </div>
              </app-popover>
            }
            @if (employee.invitationStatus === 'expired') {
              <app-button variant="secondary" [loading]="resending()" [disabled]="resending()" (pressed)="resendInvitation(employee.id)">
                Resend invitation
              </app-button>
            }
          </div>
        </div>
      </div>

      <!-- Non-Duplicate Insights Metric Cards Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span class="text-xs font-medium text-[var(--color-text-secondary)] block mb-1">Tenure</span>
          <span class="text-sm font-semibold text-[var(--color-text-primary)] block">
            {{ calculateTenure(employee.jobInformation.hireDate) }}
          </span>
        </div>

        <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span class="text-xs font-medium text-[var(--color-text-secondary)] block mb-1">Reporting Manager</span>
          <span class="text-sm font-semibold text-[var(--color-text-primary)] block truncate">
            {{ employee.jobInformation.reportingManagerName || 'Unassigned' }}
          </span>
        </div>

        <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span class="text-xs font-medium text-[var(--color-text-secondary)] block mb-1">Primary Location</span>
          <span class="text-sm font-semibold text-[var(--color-text-primary)] block truncate">
            {{ getPrimaryLocation(employee.personalInformation.addresses) }}
          </span>
        </div>

        @if (employee.attendanceSummary) {
          <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <span class="text-xs font-medium text-[var(--color-text-secondary)] block mb-1">Attendance today</span>
            @if (employee.attendanceSummary.showNotClockedInWarning && attendanceWarningLabel(employee); as warningLabel) {
              <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600">
                <span class="w-2 h-2 rounded-full bg-red-500"></span>
                {{ warningLabel }}
              </span>
            } @else {
              <span class="text-sm font-semibold text-[var(--color-text-primary)] block truncate">
                {{ attendanceStatusLabel(employee) || 'Not specified' }}
              </span>
              @if (attendanceAttentionLabel(employee); as attentionLabel) {
                <span class="mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full" [class]="severityBadgeClass(employee)">
                  {{ attentionLabel }}
                </span>
              }
            }
            @if (breakOverageLabel(employee); as breakLabel) {
              <span class="mt-1 block text-xs font-medium text-red-600">{{ breakLabel }}</span>
            }
          </div>
        }
      </div>

      <!-- Navigation Tabs -->
      <div class="border-b border-[var(--color-border)] mb-6">
        <nav class="flex gap-2" aria-label="Employee Detail Sections">
          <button
            type="button"
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap cursor-pointer"
            [class.border-[var(--color-accent)]]="activeTab() === 'job'"
            [class.text-[var(--color-accent)]]="activeTab() === 'job'"
            [class.font-semibold]="activeTab() === 'job'"
            [class.border-transparent]="activeTab() !== 'job'"
            [class.text-[var(--color-text-secondary)]]="activeTab() !== 'job'"
            (click)="activeTab.set('job')"
          >
            Job Information
          </button>
          <button
            type="button"
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap cursor-pointer"
            [class.border-[var(--color-accent)]]="activeTab() === 'personal'"
            [class.text-[var(--color-accent)]]="activeTab() === 'personal'"
            [class.font-semibold]="activeTab() === 'personal'"
            [class.border-transparent]="activeTab() !== 'personal'"
            [class.text-[var(--color-text-secondary)]]="activeTab() !== 'personal'"
            (click)="activeTab.set('personal')"
          >
            Personal Information
          </button>
          <button
            type="button"
            class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap cursor-pointer"
            [class.border-[var(--color-accent)]]="activeTab() === 'emergency'"
            [class.text-[var(--color-accent)]]="activeTab() === 'emergency'"
            [class.font-semibold]="activeTab() === 'emergency'"
            [class.border-transparent]="activeTab() !== 'emergency'"
            [class.text-[var(--color-text-secondary)]]="activeTab() !== 'emergency'"
            (click)="activeTab.set('emergency')"
          >
            Emergency Contacts
          </button>
          @if (employee.payroll) {
            <button
              type="button"
              class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap cursor-pointer"
              [class.border-[var(--color-accent)]]="activeTab() === 'payroll'"
              [class.text-[var(--color-accent)]]="activeTab() === 'payroll'"
              [class.font-semibold]="activeTab() === 'payroll'"
              [class.border-transparent]="activeTab() !== 'payroll'"
              [class.text-[var(--color-text-secondary)]]="activeTab() !== 'payroll'"
              (click)="activeTab.set('payroll')"
            >
              Payroll & Statutory
            </button>
          }
        </nav>
      </div>

      <!-- Tab Content Section -->
      @if (activeTab() === 'job') {
        <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-6">
          <app-employee-job-info
            [jobInformation]="employee.jobInformation"
            [employeeId]="employee.id"
            [canEdit]="canChangePosition() && !isReadOnly()"
            [saving]="savingJobDetails()"
            (save)="onJobDetailsSave($event)"
          />
          <app-employee-job-journey [entries]="jobJourney()" />
        </div>
      } @else if (activeTab() === 'personal') {
        <app-employee-personal-info [personalInformation]="employee.personalInformation" />
      } @else if (activeTab() === 'emergency') {
        <app-employee-emergency-contacts [emergencyContacts]="employee.emergencyContacts" />
      } @else if (activeTab() === 'payroll' && employee.payroll; as payroll) {
        <app-employee-payroll [payroll]="payroll" />
      }

      @if (employee.jobInformation.legalEntityId; as legalEntityId) {
        <app-change-position-modal
          [open]="changePositionOpen()"
          [employeeId]="employee.id"
          [legalEntityId]="legalEntityId"
          [currentPositionId]="employee.jobInformation.positionId"
          [changeReason]="changePositionReason()"
          (closed)="changePositionOpen.set(false)"
          (changed)="onPositionChanged()"
          (pendingApproval)="onPositionPendingApproval()"
        />
      }
    }
  `,
  styles: [`
    .emp-detail-header {
      margin-top: -1.25rem;
      margin-bottom: 1.25rem;
      padding-bottom: 0.625rem;
      border-bottom: 1px solid var(--color-border);
    }

    .change-position-menu {
      display: flex;
      flex-direction: column;
      min-width: 12rem;
      padding: 0.25rem;
    }

    .profile-action-btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.625rem 0.75rem;
      border: none;
      border-radius: 0.375rem;
      background: transparent;
      color: var(--color-text-primary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
    }

    .profile-action-btn:hover:not(:disabled) {
      background-color: var(--color-surface-secondary);
      color: var(--color-accent);
    }

    .profile-action-btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PeopleApiService);
  private readonly notifications = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly authStore = inject(AuthStore);
  private readonly offboardingStore = inject(OffboardingWizardStore);

  readonly employee = signal<EmployeeDetailResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly resending = signal(false);
  readonly savingJobDetails = signal(false);
  readonly changePositionMenuOpen = signal(false);
  readonly changePositionOpen = signal(false);
  readonly changePositionReason = signal<'Promotion' | 'Transfer'>('Promotion');
  readonly activeTab = signal<'job' | 'personal' | 'emergency' | 'payroll'>('job');
  readonly jobJourney = signal<readonly PositionHistoryEntryResponse[]>([]);

  readonly attendanceWarningLabel = attendanceWarningLabel;
  readonly attendanceAttentionLabel = attendanceAttentionLabel;
  readonly attendanceStatusLabel = attendanceStatusLabel;
  readonly breakOverageLabel = breakOverageLabel;

  readonly canChangePosition = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly canOffboard = computed(() => this.permissionService.hasPermission('employees:offboard'));
  readonly isOwnRecord = computed(() => this.employee()?.id === this.authStore.employeeId());
  readonly offboardingStatus = computed(() => this.offboardingStore.record()?.status ?? null);
  readonly isReadOnly = computed(() => this.offboardingStatus() === 'completed');

  constructor() {
    this.load();
  }

  getInitials(firstName?: string, lastName?: string): string {
    const f = firstName?.trim().charAt(0) || '';
    const l = lastName?.trim().charAt(0) || '';
    return (f + l).toUpperCase() || 'EM';
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
    this.api.getJobJourney(id).subscribe({
      next: (entries) => this.jobJourney.set(entries),
      error: () => this.jobJourney.set([])
    });
    void this.offboardingStore.loadOffboarding(id);
  }

  onJobDetailsSave(payload: UpdateEmployeeJobDetailsRequest): void {
    const id = this.employee()?.id;
    if (!id) return;
    this.savingJobDetails.set(true);
    this.api.updateJobDetails(id, payload).subscribe({
      next: () => {
        this.savingJobDetails.set(false);
        this.notifications.success('Job details updated.');
        this.load();
      },
      error: (err) => {
        this.savingJobDetails.set(false);
        this.notifications.error(toSafeErrorMessage(err, 'Could not update job details.'));
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

  openChangePosition(reason: 'Promotion' | 'Transfer'): void {
    this.changePositionReason.set(reason);
    this.changePositionMenuOpen.set(false);
    this.changePositionOpen.set(true);
  }

  navigateToOffboarding(employeeId: string): void {
    this.changePositionMenuOpen.set(false);
    void this.router.navigate(['/people/employees', employeeId, 'offboarding']);
  }

  onPositionPendingApproval(): void {
    this.changePositionOpen.set(false);
    this.notifications.success('Sent for approval.');
    this.load();
  }

  calculateTenure(hireDateStr?: string): string {
    if (!hireDateStr) return '—';
    const hireDate = new Date(hireDateStr);
    if (isNaN(hireDate.getTime())) return '—';

    const now = new Date();
    let years = now.getFullYear() - hireDate.getFullYear();
    let months = now.getMonth() - hireDate.getMonth();

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years <= 0 && months <= 0) {
      return 'New Joiner';
    }

    const yearPart = years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : '';
    const monthPart = months > 0 ? `${months} mo${months > 1 ? 's' : ''}` : '';

    if (yearPart && monthPart) return `${yearPart} ${monthPart}`;
    return yearPart || monthPart || 'New Joiner';
  }

  getPrimaryLocation(addresses?: readonly EmployeeDetailAddress[]): string {
    if (!addresses || addresses.length === 0) return 'Not specified';
    const primary = addresses.find(a => a.isPrimary) || addresses[0];
    if (!primary || !primary.addressJson) return 'Not specified';

    try {
      const parsed: unknown = JSON.parse(primary.addressJson);
      if (parsed && typeof parsed === 'object') {
        const p = parsed as Record<string, unknown>;
        const city = p['city'] || p['town'];
        const country = p['country'] || p['countryCode'];
        if (city && country) return `${city}, ${country}`;
        if (city) return String(city);
        if (country) return String(country);
        const firstVal = Object.values(p).find(v => typeof v === 'string' && v.trim().length > 0);
        if (firstVal) return String(firstVal);
      }
    } catch {
      return primary.addressJson.substring(0, 30);
    }
    return 'Not specified';
  }

  severityBadgeClass(employee: EmployeeDetailResponse): string {
    const severity = attendanceSeverityClass(employee);
    if (severity === 'emp-attention--critical') return 'bg-red-50 text-red-700';
    if (severity === 'emp-attention--warning') return 'bg-amber-50 text-amber-700';
    return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]';
  }

}
