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
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { EmployeeDirectoryStore } from '../../../work/state/employee-directory.store';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailResponse, UpdateEmployeeJobDetailsRequest } from '../../models/employee.model';
import { ChangePositionModalComponent } from '../../ui/change-position-modal/change-position-modal.component';
import { PositionHistoryEntryResponse } from '../../models/position-history.model';
import { OffboardingWizardStore } from '../../state/offboarding-wizard.store';
import {
  attendanceWarningLabel,
  attendanceAttentionLabel,
  attendanceStatusLabel,
  attendanceSeverityClass,
  breakOverageLabel,
  formatTenure
} from '../../utils/employee-view.utils';
import { EmployeeEmploymentTabComponent } from './employment-tab.component';
import { EmployeePersonalTabComponent } from './personal-tab.component';
import { EmployeeOverviewTabComponent } from './overview-tab.component';

type DetailTab = 'overview' | 'employment' | 'personal';

/**
 * Employee detail page shell backed by GET /api/v1/employees/{id}/detail: header (identity,
 * Transfer/Promote/Offboarding actions, resend-invitation), today's attendance strip, and
 * three tabs - Overview (per-widget attendance/discipline/time-off), Employment (job details,
 * Work Network, history) and Personal
 * (personal info, emergency contacts, payroll when the server includes it).
 */
@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    BreadcrumbHeaderComponent,
    AvatarComponent,
    ButtonComponent,
    ErrorStateComponent,
    LoaderComponent,
    ChangePositionModalComponent,
    PopoverComponent,
    EmployeeEmploymentTabComponent,
    EmployeePersonalTabComponent,
    EmployeeOverviewTabComponent
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

      <!-- Header: identity, live attendance status, actions -->
      <div class="rounded-2xl bg-[var(--color-surface)] p-6 mb-4" data-testid="employee-profile-header">
        <div class="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          
          <!-- Identity and live attendance status -->
          <div class="min-w-0" data-testid="employee-profile-content">
            <div class="flex min-w-0 items-start gap-4 sm:gap-5" data-testid="employee-identity">
              <div class="relative flex-shrink-0">
                <app-avatar
                  class="employee-detail-avatar"
                  data-testid="employee-avatar"
                  [avatarUrl]="employeeAvatarUrl()"
                  [userName]="employee.personalInformation.firstName + ' ' + employee.personalInformation.lastName"
                  [email]="employee.personalInformation.email"
                  size="xl"
                  shape="circle"
                />
                <span
                  class="absolute bottom-0 right-0 h-5 w-5 rounded-full border-2 border-white"
                  [class.bg-green-500]="employee.jobInformation.status.toLowerCase() === 'active'"
                  [class.bg-red-500]="employee.jobInformation.status.toLowerCase() !== 'active'"
                ></span>
              </div>

              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-x-5 gap-y-3" data-testid="employee-primary-row">
                  <div class="min-w-0 max-w-full" data-testid="employee-primary-details">
                    <h1
                      class="text-2xl font-bold text-[var(--color-text-primary)]"
                      data-testid="employee-name"
                    >
                      {{ employee.personalInformation.firstName }} {{ employee.personalInformation.lastName }}
                    </h1>

                    <p
                      class="mt-0.5 break-all text-sm text-[var(--color-text-secondary)]"
                      data-testid="employee-email"
                    >
                      {{ employee.personalInformation.email }}
                    </p>
                  </div>

                  @if (employee.attendanceSummary) {
                    <div
                      class="inline-flex max-w-full flex-shrink-0 items-start gap-3 rounded-xl px-3 py-2.5"
                      [class]="todayStatusClass(employee)"
                      data-testid="employee-attendance-status"
                    >
                      <span class="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full" [class]="todayStatusDotClass(employee)"></span>
                      <div class="min-w-0">
                        <span class="block text-[11px] font-semibold uppercase tracking-wider opacity-70">Attendance today</span>
                        <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                        @if (employee.attendanceSummary.showNotClockedInWarning && attendanceWarningLabel(employee); as warningLabel) {
                            <span class="font-semibold">{{ warningLabel }}</span>
                        } @else {
                          <span class="font-semibold">{{ attendanceStatusLabel(employee) || 'Not specified' }}</span>
                          @if (attendanceAttentionLabel(employee); as attentionLabel) {
                            <span class="text-xs" [class]="severityBadgeClass(employee)">{{ attentionLabel }}</span>
                          }
                        }
                        @if (breakOverageLabel(employee); as breakLabel) {
                            <span class="font-medium">{{ breakLabel }}</span>
                        }
                        </div>
                      </div>
                    </div>
                  }
                </div>

                <div
                  class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                  data-testid="employee-role-context"
                >
                  <span class="font-semibold text-[var(--color-text-primary)]">
                    {{ employee.jobInformation.positionName || 'Unassigned Position' }}
                  </span>
                  <span class="h-1 w-1 rounded-full bg-[var(--color-text-secondary)] opacity-60" aria-hidden="true"></span>
                  <span class="text-[var(--color-text-secondary)]">
                    {{ employee.jobInformation.departmentName || 'No department' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 xl:self-start">
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

              <!-- Overflow Menu Button (⋮) -->
              <button
                type="button"
                class="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                title="More actions"
                (click)="changePositionMenuOpen.set(!changePositionMenuOpen())"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </button>
            }
            @if (employee.invitationStatus === 'expired') {
              <app-button variant="secondary" [loading]="resending()" [disabled]="resending()" (pressed)="resendInvitation(employee.id)">
                Resend invitation
              </app-button>
            }
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="border-b border-[var(--color-border)] mb-4">
        <nav class="flex gap-2" aria-label="Employee Detail Sections">
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap cursor-pointer"
              [class.border-[var(--color-accent)]]="activeTab() === tab.id"
              [class.text-[var(--color-accent)]]="activeTab() === tab.id"
              [class.font-semibold]="activeTab() === tab.id"
              [class.border-transparent]="activeTab() !== tab.id"
              [class.text-[var(--color-text-secondary)]]="activeTab() !== tab.id"
              (click)="activeTab.set(tab.id)"
            >
              {{ tab.label }}
            </button>
          }
        </nav>
      </div>

      @if (activeTab() === 'overview') {
        <app-employee-overview-tab
          [employeeId]="employee.id"
          [hireDate]="employee.jobInformation.hireDate"
          [terminationDate]="employee.jobInformation.terminationDate ?? null"
        />
      }
      <app-employee-employment-tab
        [hidden]="activeTab() !== 'employment'"
        [class.hidden]="activeTab() !== 'employment'"
        [employee]="employee"
        [jobJourney]="jobJourney()"
        [canEdit]="canChangePosition() && !isReadOnly()"
        [saving]="savingJobDetails()"
        (save)="onJobDetailsSave($event)"
      />
      @if (activeTab() === 'personal') {
        <app-employee-personal-tab [employee]="employee" />
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
      position: sticky;
      top: -1.75rem;
      z-index: 50;
      background: var(--color-surface);
    }

    :host ::ng-deep app-avatar.employee-detail-avatar .avatar--xl {
      width: 5rem;
      height: 5rem;
      font-size: 1.5rem;
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
  private readonly employeeDirectory = inject(EmployeeDirectoryStore);

  readonly employee = signal<EmployeeDetailResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly resending = signal(false);
  readonly savingJobDetails = signal(false);
  readonly changePositionMenuOpen = signal(false);
  readonly changePositionOpen = signal(false);
  readonly changePositionReason = signal<'Promotion' | 'Transfer'>('Promotion');
  readonly tabs: readonly { readonly id: DetailTab; readonly label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'employment', label: 'Employment' },
    { id: 'personal', label: 'Personal' }
  ];
  readonly activeTab = signal<DetailTab>('overview');
  readonly jobJourney = signal<readonly PositionHistoryEntryResponse[]>([]);

  readonly attendanceWarningLabel = attendanceWarningLabel;
  readonly attendanceAttentionLabel = attendanceAttentionLabel;
  readonly attendanceStatusLabel = attendanceStatusLabel;
  readonly breakOverageLabel = breakOverageLabel;
  readonly formatTenure = formatTenure;

  readonly canChangePosition = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly canOffboard = computed(() => this.permissionService.hasPermission('employees:offboard'));
  readonly isOwnRecord = computed(() => this.employee()?.id === this.authStore.employeeId());
  readonly offboardingStatus = computed(() => this.offboardingStore.record()?.status ?? null);
  readonly isReadOnly = computed(() => this.offboardingStatus() === 'completed');
  readonly employeeAvatarUrl = computed(() => {
    const employeeId = this.employee()?.id;
    return employeeId ? this.employeeDirectory.get(employeeId)?.avatarUrl ?? null : null;
  });

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
    void this.employeeDirectory.ensureLoaded([id]);
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

  severityBadgeClass(employee: EmployeeDetailResponse): string {
    const severity = attendanceSeverityClass(employee);
    if (severity === 'emp-attention--critical') return 'bg-red-50 text-red-700';
    if (severity === 'emp-attention--warning') return 'bg-amber-50 text-amber-700';
    return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]';
  }

  todayStatusClass(employee: EmployeeDetailResponse): string {
    const status = employee.attendanceSummary?.attendanceStatus?.toLowerCase() || '';
    const label = attendanceStatusLabel(employee)?.toLowerCase() || '';
    if (employee.attendanceSummary?.showNotClockedInWarning || status === 'not_clocked_in' || label.includes('not clocked in')) {
      return 'bg-rose-50 text-rose-800';
    }
    if (status === 'present' || status === 'working' || label.includes('present') || label.includes('clocked in') || label.includes('working')) {
      return 'bg-emerald-50 text-emerald-800';
    }
    if (status === 'late' || label.includes('late')) {
      return 'bg-amber-50 text-amber-800';
    }
    if (status === 'on_break' || label.includes('break')) {
      return 'bg-sky-50 text-sky-800';
    }
    if (status === 'on_leave' || label.includes('leave')) {
      return 'bg-purple-50 text-purple-800';
    }
    if (status === 'missing_clock_out' || status === 'absent' || label.includes('missing') || label.includes('absent')) {
      return 'bg-rose-50 text-rose-800';
    }
    return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]';
  }

  todayStatusDotClass(employee: EmployeeDetailResponse): string {
    const status = employee.attendanceSummary?.attendanceStatus?.toLowerCase() || '';
    const label = attendanceStatusLabel(employee)?.toLowerCase() || '';
    if (employee.attendanceSummary?.showNotClockedInWarning || status === 'not_clocked_in' || label.includes('not clocked in')) {
      return 'bg-rose-500';
    }
    if (status === 'present' || status === 'working' || label.includes('present') || label.includes('clocked in') || label.includes('working')) {
      return 'bg-emerald-500';
    }
    if (status === 'late' || label.includes('late')) {
      return 'bg-amber-500';
    }
    if (status === 'on_break' || label.includes('break')) {
      return 'bg-sky-500';
    }
    if (status === 'on_leave' || label.includes('leave')) {
      return 'bg-purple-500';
    }
    if (status === 'missing_clock_out' || status === 'absent' || label.includes('missing') || label.includes('absent')) {
      return 'bg-rose-500';
    }
    return 'bg-[var(--color-text-secondary)]';
  }
}
