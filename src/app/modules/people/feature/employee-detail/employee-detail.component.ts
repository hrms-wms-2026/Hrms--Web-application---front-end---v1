import { DatePipe } from '@angular/common';
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
 * Employee detail page shell backed by GET /api/v1/employees/{id}/detail: header (identity, key
 * facts, Transfer/Promote/Offboarding actions, resend-invitation), today's attendance strip, and
 * three tabs - Overview (per-widget attendance/discipline/time-off), Employment (job details,
 * Work Network, history) and Personal
 * (personal info, emergency contacts, payroll when the server includes it).
 */
@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    DatePipe,
    BreadcrumbHeaderComponent,
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

      <!-- Header card: identity, live attendance status, key facts, actions -->
      <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 mb-4">
        <div class="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          
          <!-- Identity block: Avatar, Name, Employee ID, Live Attendance Status, Title, Dept, Email -->
          <div class="flex items-start gap-4 sm:gap-5 min-w-0">
            <div class="relative flex-shrink-0">
              <div class="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl shadow-inner border border-blue-200">
                {{ getInitials(employee.personalInformation.firstName, employee.personalInformation.lastName) }}
              </div>
              <span
                class="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white"
                [class.bg-green-500]="employee.jobInformation.status.toLowerCase() === 'active'"
                [class.bg-red-500]="employee.jobInformation.status.toLowerCase() !== 'active'"
              ></span>
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-2.5 flex-wrap">
                <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">
                  {{ employee.personalInformation.firstName }} {{ employee.personalInformation.lastName }}
                </h1>
                <span class="inline-flex items-center font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                  {{ employee.jobInformation.employeeNumber }}
                </span>

                <!-- Live Attendance Status Alert Badge -->
                @if (employee.attendanceSummary) {
                  <div class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-medium border" [class]="todayStatusClass(employee)">
                    <span class="w-2 h-2 rounded-full" [class]="todayStatusDotClass(employee)"></span>
                    <span class="text-[var(--color-text-secondary)] font-normal">Attendance today ·</span>
                    @if (employee.attendanceSummary.showNotClockedInWarning && attendanceWarningLabel(employee); as warningLabel) {
                      <span class="font-semibold text-red-600">{{ warningLabel }}</span>
                    } @else {
                      <span class="font-semibold">{{ attendanceStatusLabel(employee) || 'Not specified' }}</span>
                      @if (attendanceAttentionLabel(employee); as attentionLabel) {
                        <span class="text-xs" [class]="severityBadgeClass(employee)">{{ attentionLabel }}</span>
                      }
                    }
                    @if (breakOverageLabel(employee); as breakLabel) {
                      <span class="font-semibold text-red-600">· {{ breakLabel }}</span>
                    }
                  </div>
                }
              </div>

              <p class="text-base font-medium text-[var(--color-text-primary)] mt-1">
                {{ employee.jobInformation.positionName || 'Unassigned Position' }}
              </p>

              <p class="text-sm text-[var(--color-text-secondary)] mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{{ employee.jobInformation.departmentName || 'No department' }}</span>
                <span>•</span>
                <span>{{ employee.jobInformation.legalEntityName || 'Company' }}</span>
              </p>

              <p class="text-sm text-[var(--color-text-secondary)] mt-0.5">{{ employee.personalInformation.email }}</p>
            </div>
          </div>

          <!-- Key Facts List with Icons -->
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm xl:mx-6 items-center" data-testid="employee-key-facts">
            <dt class="text-[var(--color-text-secondary)] flex items-center gap-1.5 font-medium">
              <svg class="w-4 h-4 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Reporting Manager</span>
            </dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">{{ employee.jobInformation.reportingManagerName || 'Unassigned' }}</dd>

            <dt class="text-[var(--color-text-secondary)] flex items-center gap-1.5 font-medium">
              <svg class="w-4 h-4 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
              </svg>
              <span>Employment Type</span>
            </dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">{{ employee.jobInformation.employmentTypeLabel }}</dd>

            <dt class="text-[var(--color-text-secondary)] flex items-center gap-1.5 font-medium">
              <svg class="w-4 h-4 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              <span>Work Mode</span>
            </dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">{{ employee.jobInformation.workModeLabel || '—' }}</dd>

            <dt class="text-[var(--color-text-secondary)] flex items-center gap-1.5 font-medium">
              <svg class="w-4 h-4 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span>Hire Date</span>
            </dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">{{ employee.jobInformation.hireDate | date: 'dd MMM yyyy' }}</dd>
          </dl>

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
        <app-employee-overview-tab [employeeId]="employee.id" />
      }
      <app-employee-employment-tab
        [hidden]="activeTab() !== 'employment'"
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

  severityBadgeClass(employee: EmployeeDetailResponse): string {
    const severity = attendanceSeverityClass(employee);
    if (severity === 'emp-attention--critical') return 'bg-red-50 text-red-700';
    if (severity === 'emp-attention--warning') return 'bg-amber-50 text-amber-700';
    return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]';
  }

  todayStatusClass(employee: EmployeeDetailResponse): string {
    const status = employee.attendanceSummary?.attendanceStatus?.toLowerCase() || '';
    const label = attendanceStatusLabel(employee)?.toLowerCase() || '';
    if (status === 'present' || status === 'working' || label.includes('present') || label.includes('clocked in') || label.includes('working')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (status === 'late' || label.includes('late')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    if (status === 'on_break' || label.includes('break')) {
      return 'bg-sky-50 text-sky-800 border-sky-200';
    }
    if (status === 'on_leave' || label.includes('leave')) {
      return 'bg-purple-50 text-purple-800 border-purple-200';
    }
    if (status === 'missing_clock_out' || status === 'absent' || label.includes('missing') || label.includes('absent')) {
      return 'bg-rose-50 text-rose-800 border-rose-200';
    }
    return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]';
  }

  todayStatusDotClass(employee: EmployeeDetailResponse): string {
    const status = employee.attendanceSummary?.attendanceStatus?.toLowerCase() || '';
    const label = attendanceStatusLabel(employee)?.toLowerCase() || '';
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
