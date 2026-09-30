import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { SelectOption } from '../../../../shared/ui/select/select.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailStore } from '../../state/employee-detail.store';
import { EmployeeInsightsStore } from '../../state/employee-insights.store';
import { DetailIconComponent, DetailIconName } from '../../ui/detail-kit/detail-icon.component';
import { OffboardingWizardStore } from '../../state/offboarding-wizard.store';
import { ChangePositionModalComponent } from '../../ui/change-position-modal/change-position-modal.component';
import { EmployeeProfileHeaderComponent } from '../../ui/employee-profile-header/employee-profile-header.component';
import { shiftPeriodMonth, toPeriodMonth } from '../../utils/employee-detail.utils';

export interface EmployeeDetailTab {
  readonly path: string;
  readonly label: string;
  readonly icon: DetailIconName;
  /** Tabs whose content depends on the reporting period show the period filter. */
  readonly usesPeriod: boolean;
}

export const EMPLOYEE_DETAIL_TABS: readonly EmployeeDetailTab[] = [
  { path: 'overview', label: 'Overview', icon: 'overview', usesPeriod: true },
  { path: 'employment', label: 'Employment', icon: 'document', usesPeriod: false },
  { path: 'attendance', label: 'Attendance', icon: 'clock', usesPeriod: true },
  { path: 'work-activity', label: 'Work & Activity', icon: 'chart', usesPeriod: true },
  { path: 'personal', label: 'Personal', icon: 'user', usesPeriod: false }
];

const PERIOD_OPTIONS: readonly SelectOption[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'custom', label: 'Custom' }
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
    ErrorStateComponent,
    LoaderComponent,
    ChangePositionModalComponent,
    PopoverComponent,
    EmployeeProfileHeaderComponent,
    DetailIconComponent
  ],
  providers: [EmployeeDetailStore, EmployeeInsightsStore],
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
          @if (canEditEmployee()) {
            <a class="hdr-btn hdr-btn--primary" routerLink="employment" [queryParams]="{ edit: 'job' }" data-testid="edit-employee">
              <app-detail-icon name="pencil" [size]="18" />Edit Employee
            </a>
          }
          @if (canManageLifecycle() && canChangePosition()) {
            <app-popover [open]="changePositionMenuOpen()" ariaLabel="Transfer or promote" align="right" (closed)="changePositionMenuOpen.set(false)">
              <button popover-trigger type="button" class="hdr-btn hdr-btn--outline" data-testid="change-position-trigger"
                      [attr.aria-expanded]="changePositionMenuOpen()" (click)="changePositionMenuOpen.set(!changePositionMenuOpen())">
                <app-detail-icon name="transfer" [size]="18" />Transfer / Promote
              </button>
              <div popover-panel class="action-menu">
                <button type="button" class="action-menu__item" (click)="openChangePosition('Promotion')">Promotion</button>
                <button type="button" class="action-menu__item" (click)="openChangePosition('Transfer')">Transfer</button>
              </div>
            </app-popover>
          }
          @if (showOffboardingAction() || employee.invitationStatus === 'expired') {
            <app-popover [open]="moreMenuOpen()" ariaLabel="More actions" align="right" (closed)="moreMenuOpen.set(false)">
              <button popover-trigger type="button" class="hdr-btn hdr-btn--outline hdr-btn--icon" data-testid="more-actions-trigger"
                      aria-label="More actions" [attr.aria-expanded]="moreMenuOpen()" (click)="moreMenuOpen.set(!moreMenuOpen())">
                <app-detail-icon name="dots" [size]="22" [strokeWidth]="3" />
              </button>
              <div popover-panel class="action-menu">
                @if (showOffboardingAction()) {
                  <button type="button" class="action-menu__item" data-testid="offboarding-menu-item" (click)="navigateToOffboarding(employee.id)">
                    {{ offboardingStatus() && offboardingStatus() !== 'cancelled' ? (isReadOnly() ? 'View Offboarding' : 'Continue Offboarding') : 'Offboarding' }}
                  </button>
                }
                @if (employee.invitationStatus === 'expired') {
                  <button type="button" class="action-menu__item" data-testid="resend-invitation" [disabled]="resending()" (click)="resendInvitation(employee.id)">
                    {{ resending() ? 'Resending…' : 'Resend invitation' }}
                  </button>
                }
              </div>
            </app-popover>
          }
        </ng-container>
      </app-employee-profile-header>

      <div class="tabbar">
        <nav class="tabs" aria-label="Employee detail sections">
          @for (tab of tabs; track tab.path) {
            <a
              class="tab"
              [routerLink]="tab.path"
              routerLinkActive="tab--active"
              ariaCurrentWhenActive="page"
              [attr.data-testid]="'employee-tab-' + tab.path"
            ><app-detail-icon [name]="tab.icon" [size]="22" />{{ tab.label }}</a>
          }
        </nav>

        @if (activeTab()?.usesPeriod) {
          <div class="period" data-testid="employee-period-filter">
            <label class="period__select">
              <span class="sr-only">Reporting period</span>
              <select (change)="onPeriodPresetChange($any($event.target).value)">
                @for (option of periodOptions; track option.value) {
                  <option [value]="option.value" [selected]="option.value === periodPreset()">{{ option.label }}</option>
                }
              </select>
              <app-detail-icon name="chevron-down" [size]="16" />
            </label>
            <div class="period__month">
              <button type="button" class="period__month-btn" (click)="openMonthPicker(monthInput)">
                <app-detail-icon name="calendar" [size]="18" />{{ periodLabel() }}
              </button>
              <input
                #monthInput
                type="month"
                class="period__month-input"
                aria-label="Reporting month"
                [value]="store.periodMonth()"
                (change)="onPeriodMonthChange($event)"
              />
            </div>
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

    .hdr-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.625rem;
      height: 2.75rem; padding: 0 1.25rem; border-radius: 0.5rem;
      font: inherit; font-size: 0.9375rem; font-weight: 600; white-space: nowrap;
      text-decoration: none; cursor: pointer; transition: background-color 120ms ease, border-color 120ms ease;
    }
    .hdr-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .hdr-btn--primary { background: #1f5eea; color: #fff; border: 1px solid #1f5eea; }
    .hdr-btn--primary:hover { background: #1a4fc4; }
    .hdr-btn--outline { background: var(--color-surface); color: #1f5eea; border: 1px solid #c9d3e3; }
    .hdr-btn--outline:hover { background: #f3f6fb; }
    .hdr-btn--icon { width: 3rem; padding: 0; }

    .action-menu { display: flex; flex-direction: column; min-width: 12rem; padding: 0.25rem; }
    .action-menu__item {
      width: 100%; padding: 0.625rem 0.75rem; border: none; border-radius: 0.375rem; background: transparent;
      color: var(--color-text-primary); font-size: 0.875rem; font-weight: 500; text-align: left; cursor: pointer;
    }
    .action-menu__item:hover:not(:disabled) { background: var(--color-surface-secondary); color: var(--color-accent); }
    .action-menu__item:disabled { cursor: not-allowed; opacity: 0.5; }

    .tabbar {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem;
      padding: 0 0.75rem 0 0; border: 1px solid var(--color-border); border-radius: 0.875rem; background: var(--color-surface);
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
    }
    .tabs { display: flex; gap: 0.5rem; overflow-x: auto; max-width: 100%; }
    .tab {
      display: inline-flex; align-items: center; gap: 0.75rem; padding: 1rem 1.5rem;
      border-bottom: 3px solid transparent; color: #4b5b76; font-size: 1rem; font-weight: 500;
      text-decoration: none; white-space: nowrap;
    }
    .tab:hover { color: var(--color-text-primary); }
    .tab:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: -2px; }
    .tab--active { border-bottom-color: #1f5eea; color: #1f5eea; font-weight: 600; }

    .period { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0; }
    .period__select { position: relative; display: inline-flex; align-items: center; }
    .period__select select {
      appearance: none; height: 2.5rem; padding: 0 2.25rem 0 0.875rem; border: 1px solid #d5dce8; border-radius: 0.5rem;
      background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 0.875rem; cursor: pointer;
    }
    .period__select app-detail-icon { position: absolute; right: 0.75rem; pointer-events: none; color: var(--color-text-secondary); }
    .period__month { position: relative; }
    .period__month-btn {
      display: inline-flex; align-items: center; gap: 0.5rem; height: 2.5rem; padding: 0 0.875rem;
      border: 1px solid #d5dce8; border-radius: 0.5rem; background: var(--color-surface);
      color: var(--color-text-primary); font: inherit; font-size: 0.875rem; cursor: pointer;
    }
    .period__month-btn app-detail-icon { color: var(--color-text-secondary); }
    .period__month-input { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
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
  readonly moreMenuOpen = signal(false);
  readonly changePositionOpen = signal(false);
  readonly changePositionReason = signal<'Promotion' | 'Transfer'>('Promotion');

  readonly canChangePosition = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly canOffboard = computed(() => this.permissionService.hasPermission('employees:offboard'));
  readonly isOwnRecord = computed(() => this.employee()?.id === this.authStore.employeeId());
  readonly offboardingStatus = computed(() => this.offboardingStore.record()?.status ?? null);
  readonly isReadOnly = computed(() => this.offboardingStatus() === 'completed');

  /** Lifecycle actions (transfer/promote, offboarding) apply to another, fully onboarded employee in a company. */
  readonly canManageLifecycle = computed(() => {
    const employee = this.employee();
    return !!employee
      && !this.isOwnRecord()
      && !!employee.jobInformation.legalEntityId
      && !this.isReadOnly()
      && employee.invitationStatus !== 'pending'
      && employee.invitationStatus !== 'expired';
  });
  readonly showOffboardingAction = computed(() => this.canManageLifecycle() && this.canOffboard());
  /** Same rule as the Employment tab's inline job-details edit. */
  readonly canEditEmployee = computed(() => this.canChangePosition() && !this.isReadOnly());
  readonly periodLabel = computed(() => {
    const [year, month] = this.store.periodMonth().split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });

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

  openMonthPicker(input: HTMLInputElement): void {
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  onPeriodMonthChange(event: Event): void {
    this.store.setPeriodMonth((event.target as HTMLInputElement).value);
  }

  resendInvitation(employeeId: string): void {
    this.moreMenuOpen.set(false);
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
    this.moreMenuOpen.set(false);
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
