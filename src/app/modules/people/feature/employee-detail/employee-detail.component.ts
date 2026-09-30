import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailStore } from '../../state/employee-detail.store';
import { OffboardingWizardStore } from '../../state/offboarding-wizard.store';
import { ChangePositionModalComponent } from '../../ui/change-position-modal/change-position-modal.component';
import { EmployeeProfileHeaderComponent } from '../../ui/employee-profile-header/employee-profile-header.component';
import { shiftPeriodMonth, toPeriodMonth } from '../../utils/employee-detail.utils';

export interface EmployeeDetailTab {
  readonly path: string;
  readonly label: string;
  /** Tabs whose content depends on the reporting period show the period filter. */
  readonly usesPeriod: boolean;
}

export const EMPLOYEE_DETAIL_TABS: readonly EmployeeDetailTab[] = [
  { path: 'overview', label: 'Overview', usesPeriod: true },
  { path: 'employment', label: 'Employment', usesPeriod: false },
  { path: 'attendance', label: 'Attendance', usesPeriod: true },
  { path: 'work-activity', label: 'Work & Activity', usesPeriod: true },
  { path: 'personal', label: 'Personal', usesPeriod: false }
];

const PERIOD_OPTIONS: readonly SelectOption[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom month' }
];

/**
 * Tabbed employee detail shell backed by GET /api/v1/employees/{id}/detail (plus
 * GET /employees/{id}/position-history). Owns the profile header, header actions
 * (Transfer / Promote, Offboarding, resend invitation), the tab bar and the period filter;
 * each tab is a child route rendered through the outlet and reads the shared
 * EmployeeDetailStore provided here.
 */
@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    BreadcrumbHeaderComponent,
    ButtonComponent,
    ErrorStateComponent,
    LoaderComponent,
    SelectComponent,
    ChangePositionModalComponent,
    PopoverComponent,
    EmployeeProfileHeaderComponent
  ],
  providers: [EmployeeDetailStore],
  template: `
    @if (loading() && !employee()) {
      <app-loader label="Loading employee…" />
    } @else if (error() && !employee()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="load()" />
    } @else if (employee(); as employee) {
      <header class="emp-detail-header">
        <app-breadcrumb-header
          parentLabel="Employees"
          [currentLabel]="store.fullName() || 'Employee Detail'"
          parentUrl="/people/employees"
          icon="people"
        />
      </header>

      <app-employee-profile-header [employee]="employee">
        <ng-container header-actions>
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
        </ng-container>
      </app-employee-profile-header>

      <div class="emp-detail-tabbar">
        <nav class="emp-detail-tabs" aria-label="Employee detail sections">
          @for (tab of tabs; track tab.path) {
            <a
              class="emp-detail-tab"
              [routerLink]="tab.path"
              routerLinkActive="emp-detail-tab--active"
              ariaCurrentWhenActive="page"
              [attr.data-testid]="'employee-tab-' + tab.path"
            >{{ tab.label }}</a>
          }
        </nav>

        @if (activeTab()?.usesPeriod) {
          <div class="emp-detail-period" data-testid="employee-period-filter">
            <app-select
              ariaLabel="Reporting period"
              [options]="periodOptions"
              [value]="periodPreset()"
              (valueChange)="onPeriodPresetChange($event)"
            />
            <input
              type="month"
              class="emp-detail-month"
              aria-label="Reporting month"
              [value]="store.periodMonth()"
              (change)="onPeriodMonthChange($event)"
            />
          </div>
        }
      </div>

      <router-outlet />

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
    :host { display: flex; flex-direction: column; gap: 1rem; }

    .emp-detail-header {
      margin-top: -1.25rem;
      padding-bottom: 0.625rem;
      border-bottom: 1px solid var(--color-border);
    }

    .emp-detail-tabbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0 0.5rem;
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      background: var(--color-surface);
    }

    .emp-detail-tabs {
      display: flex;
      gap: 0.25rem;
      overflow-x: auto;
      max-width: 100%;
    }

    .emp-detail-tab {
      padding: 0.875rem 1rem;
      border-bottom: 2px solid transparent;
      color: var(--color-text-secondary);
      font-size: 0.9375rem;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
    }

    .emp-detail-tab:hover { color: var(--color-text-primary); }
    .emp-detail-tab:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: -2px; }

    .emp-detail-tab--active {
      border-bottom-color: var(--color-accent);
      color: var(--color-accent);
      font-weight: 600;
    }

    .emp-detail-period {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0;
    }

    .emp-detail-month {
      height: 2.25rem;
      padding: 0 0.625rem;
      border: 1px solid var(--color-border);
      border-radius: 0.5rem;
      background: var(--color-surface);
      color: var(--color-text-primary);
      font: inherit;
      font-size: 0.875rem;
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
  protected readonly store = inject(EmployeeDetailStore);

  readonly tabs = EMPLOYEE_DETAIL_TABS;
  readonly periodOptions = PERIOD_OPTIONS;

  readonly employee = this.store.employee;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly resending = signal(false);
  readonly changePositionMenuOpen = signal(false);
  readonly changePositionOpen = signal(false);
  readonly changePositionReason = signal<'Promotion' | 'Transfer'>('Promotion');

  readonly canChangePosition = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly canOffboard = computed(() => this.permissionService.hasPermission('employees:offboard'));
  readonly isOwnRecord = computed(() => this.employee()?.id === this.authStore.employeeId());
  readonly offboardingStatus = computed(() => this.offboardingStore.record()?.status ?? null);
  readonly isReadOnly = computed(() => this.offboardingStatus() === 'completed');

  private readonly activeTabPath = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.currentTabPath())
    ),
    { initialValue: this.currentTabPath() }
  );
  readonly activeTab = computed(() => this.tabs.find((tab) => tab.path === this.activeTabPath()) ?? null);

  readonly periodPreset = computed(() => {
    const month = this.store.periodMonth();
    const current = toPeriodMonth(new Date());
    if (month === current) return 'this_month';
    if (month === shiftPeriodMonth(current, -1)) return 'last_month';
    return 'custom';
  });

  constructor() {
    // Drive loading from the param stream, not the snapshot: moving between employees while on a
    // child tab (e.g. /employees/A/employment -> /employees/B/employment) reuses this shell.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) this.loadEmployee(id);
    });
  }

  load(): void {
    const id = this.store.employeeId() ?? this.route.snapshot?.paramMap.get('id');
    if (id) this.loadEmployee(id);
  }

  onPeriodPresetChange(preset: string): void {
    const current = toPeriodMonth(new Date());
    if (preset === 'this_month') this.store.setPeriodMonth(current);
    if (preset === 'last_month') this.store.setPeriodMonth(shiftPeriodMonth(current, -1));
  }

  onPeriodMonthChange(event: Event): void {
    this.store.setPeriodMonth((event.target as HTMLInputElement).value);
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

  private loadEmployee(id: string): void {
    void this.store.load(id);
    void this.offboardingStore.loadOffboarding(id);
  }

  private currentTabPath(): string | null {
    return this.route.firstChild?.snapshot?.url[0]?.path ?? null;
  }
}
