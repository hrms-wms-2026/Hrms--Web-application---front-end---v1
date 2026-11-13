/**
 * Time Off hub (2026-10-29 redesign): the one Time Off page. It answers "how much leave do I have, what
 * happened to my requests, who is out, what is coming up" and links to the three screens behind it
 * (All my leave types, Leave Requests, Team Availability). Admin screens live in Settings → Time Off.
 */
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { MANAGES_PEOPLE, PermissionService } from '../../../../core/auth/state/permission.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { DashboardDonutComponent, DashboardDonutSlice } from '../../../../shared/ui/charts/dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../../../../shared/ui/charts/dashboard-donut/donut-key.component';
import { formatPercent } from '../../../../shared/utils/format-percent.util';
import { WIDGET } from '../../../../shared/utils/widget-palette';
import { MyTeamTodayStore } from '../../../dashboard/state/my-team-today.store';
import { TimeOfDayInfo, getTimeOfDayInfo } from '../../../dashboard/util/time-of-day.util';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveCalendarStore } from '../../state/leave-calendar.store';
import { LeavePendingApprovalsStore } from '../../state/leave-pending-approvals.store';
import { LeaveRequestStore } from '../../state/leave-request.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeaveTypeIconComponent } from '../../ui/leave-type-icon/leave-type-icon.component';
import { NewLeaveRequestHostComponent } from '../../ui/new-leave-request-host/new-leave-request-host.component';
import { remainingShare } from '../../utils/leave-balance-notes';
import {
  approvalProgressLabel,
  displayNameFromEmail,
  restQuoteFor,
  leaveDateRangeLabel,
  leaveDayCountLabel,
  sortByLastActivity,
  workdayHours
} from '../../utils/leave-hub.util';
import { TEAM_AVAILABILITY_PERMISSIONS } from '../../leave-permissions';

/** Balance cards shown before "More (n)". */
const BALANCE_CARD_LIMIT = 3;
const RECENT_LIMIT = 3;
const UPCOMING_LIMIT = 3;

/** Monochrome slice colours of the Team Availability donut (WIDGET_CREATION_RULES §7a). */
const AVAILABILITY_COLORS: Readonly<Record<AvailabilitySlice['key'], string>> = {
  work: WIDGET.shade1,
  leave: WIDGET.shade2,
  'not-in': WIDGET.shade4,
  out: WIDGET.maroon
};

/** The balance card's small remaining-share ring. */
const BALANCE_RING_PX = 61;

export interface AvailabilitySlice {
  key: 'work' | 'leave' | 'not-in' | 'out';
  label: string;
  count: number;
}

/** One row of the Upcoming Time Off card: a request waiting on the signed-in approver. */
export interface UpcomingRow {
  id: string;
  personName: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startAt: string;
  endAt: string;
  totalHours: number;
  status: 'pending';
  link: readonly string[];
}

@Component({
  selector: 'app-time-off-hub',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, AvatarComponent, BreadcrumbHeaderComponent, ButtonComponent, DashboardDonutComponent, DonutKeyComponent, ErrorStateComponent, LoaderComponent, LeaveTypeIconComponent, NewLeaveRequestHostComponent],
  templateUrl: './time-off-hub.component.html',
  styleUrls: ['../../ui/time-off-chrome.css', './time-off-hub.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeOffHubComponent {
  readonly balanceStore = inject(LeaveBalanceStore);
  readonly requestStore = inject(LeaveRequestStore);
  readonly leaveTypeStore = inject(LeaveTypeStore);
  readonly approvalsStore = inject(LeavePendingApprovalsStore);
  readonly calendarStore = inject(LeaveCalendarStore);
  readonly teamTodayStore = inject(MyTeamTodayStore);
  private readonly authStore = inject(AuthStore);
  private readonly permissions = inject(PermissionService);

  readonly now = signal(new Date());
  readonly approvalProgress = approvalProgressLabel;
  readonly wizardOpen = signal(false);

  readonly canRequest = computed(() => this.permissions.hasPermission('leave:read-own'));
  readonly canApprove = computed(() => this.permissions.hasPermission('leave:approve'));
  readonly canManage = computed(() => this.permissions.hasPermission('leave:manage'));
  /** Has anyone under them (or sees the whole organisation). Team cards are pointless without people. */
  readonly managesPeople = computed(() => this.permissions.hasPermission(MANAGES_PEOPLE));
  readonly canSeeTeam = computed(
    () => this.managesPeople() && this.permissions.hasAnyPermission(TEAM_AVAILABILITY_PERMISSIONS)
  );
  /** Upcoming Time Off lists the requests of people under the approver, so it needs people too. */
  readonly showUpcoming = computed(() => this.managesPeople() && this.canApprove());
  /** Live attendance (at work / not in yet) needs the Attendance module; without it the card counts leave only. */
  readonly hasLiveAttendance = computed(
    () => this.authStore.activeModules().includes('time_attendance') && this.permissions.hasPermission('attendance:read')
  );

  /** Time Off is not set up until it has a leave type. Admins get the 3-step setup, everyone else a note. */
  readonly needsSetup = computed(
    () => this.leaveTypeStore.loaded() && !this.leaveTypeStore.loadError() && this.leaveTypeStore.items().length === 0
  );

  /** Same greeting, illustration and card background as the dashboard's greeting card. */
  readonly timeOfDay = computed<TimeOfDayInfo>(() => getTimeOfDayInfo(this.now()));
  readonly restQuote = computed(() => restQuoteFor(this.timeOfDay().timeOfDay));
  readonly displayName = computed(() => displayNameFromEmail(this.authStore.email()));

  private readonly typeById = computed(() => new Map(this.leaveTypeStore.items().map((type) => [type.id, type])));
  private readonly workday = computed(() => {
    const window = this.balanceStore.workWindow();
    return window ? workdayHours(window.workStartTime, window.workEndTime, window.breakDurationMinutes) : null;
  });

  /** The balance the greeting quotes: Annual Leave when there is one, else the first. */
  readonly headlineBalance = computed<LeaveBalanceResponse | null>(() => {
    const balances = this.balanceStore.my();
    return balances.find((balance) => /annual/i.test(balance.leaveTypeName)) ?? balances[0] ?? null;
  });
  readonly balanceCards = computed(() => this.balanceStore.my().slice(0, BALANCE_CARD_LIMIT));
  readonly moreBalances = computed(() => Math.max(0, this.balanceStore.my().length - BALANCE_CARD_LIMIT));

  readonly recentRequests = computed(() => sortByLastActivity(this.requestStore.myRequests()).slice(0, RECENT_LIMIT));

  /**
   * Approvers only: the requests waiting on them that have not ended yet, soonest first (the caller's own
   * leave is in Recent Requests). A request whose dates have passed is not upcoming; it stays in the Inbox.
   */
  private readonly upcomingRequests = computed(() => {
    const now = this.now().getTime();
    return this.approvalsStore
      .items()
      .filter((item) => Date.parse(item.endAt) >= now)
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  });
  readonly upcomingCount = computed(() => this.upcomingRequests().length);

  readonly upcomingRows = computed<UpcomingRow[]>(() =>
    this.upcomingRequests()
      .slice(0, UPCOMING_LIMIT)
      .map((item) => ({
        id: item.requestId,
        personName: item.employeeName,
        leaveTypeName: item.leaveTypeName,
        leaveTypeCode: item.leaveTypeCode,
        startAt: item.startAt,
        endAt: item.endAt,
        totalHours: item.totalHours,
        status: 'pending' as const,
        link: ['/inbox', 'leave', 'request', item.requestId]
      }))
  );

  /** Quick Actions holds only the leave type / policy shortcuts; New Request is in the breadcrumb bar. */
  readonly hasQuickActions = computed(() => this.canManage());

  /** People on leave today, from the leave calendar (used when there is no live attendance). */
  private readonly onLeaveToday = computed(() => {
    const today = isoDate(this.now());
    const day = this.calendarStore.month()?.days.find((d) => d.date === today);
    return new Set(day?.absences.map((absence) => absence.employeeId) ?? []).size;
  });

  readonly availability = computed<{ total: number; slices: AvailabilitySlice[] } | null>(() => {
    if (this.hasLiveAttendance()) {
      const data = this.teamTodayStore.data();
      if (!data) return null;
      const s = data.summary;
      return {
        total: s.total,
        slices: [
          { key: 'work', label: 'At work', count: s.working + s.onBreak },
          { key: 'leave', label: 'On leave', count: s.onLeave },
          { key: 'not-in', label: 'Not in yet', count: s.notStarted },
          { key: 'out', label: 'Out', count: s.absent + s.clockedOut }
        ]
      };
    }
    if (!this.calendarStore.month()) return null;
    const onLeave = this.onLeaveToday();
    return { total: onLeave, slices: [{ key: 'leave', label: 'On leave today', count: onLeave }] };
  });

  /** Team Availability donut slices: count per slice, share of the whole team. */
  readonly teamSlices = computed<DashboardDonutSlice[]>(() => {
    const availability = this.availability();
    if (!availability) return [];
    return availability.slices.map((slice) => ({
      key: slice.key,
      label: slice.label,
      value: slice.count,
      percentText: formatPercent(slice.count, availability.total),
      color: AVAILABILITY_COLORS[slice.key]
    }));
  });
  /** The slice lit by the donut or its key. */
  readonly teamActive = signal<string | null>(null);

  readonly balanceRingPx = BALANCE_RING_PX;

  /** Each balance card's ring: the remaining share filled (maroon when negative), the rest drawn as track. */
  private readonly balanceRings = computed(
    () =>
      new Map(
        this.balanceCards().map((balance) => {
          const share = remainingShare(balance);
          const slices: DashboardDonutSlice[] = [
            { key: 'remaining', label: 'Remaining', value: share, color: balance.isNegative ? WIDGET.maroon : WIDGET.shade1 },
            { key: 'used', label: 'Used', value: 100 - share, color: 'transparent' }
          ];
          return [balance.leaveTypeId, slices] as const;
        })
      )
  );

  constructor() {
    // Re-check every minute so the greeting, picture and quote move on at "Good afternoon" and the rest.
    const tick = setInterval(() => this.now.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));

    void this.leaveTypeStore.load();
    if (this.canRequest()) {
      void this.balanceStore.loadMy(this.now().getFullYear());
      void this.balanceStore.loadWorkWindow();
      void this.requestStore.loadMine();
    }
    if (this.showUpcoming()) void this.approvalsStore.load();
    if (this.canSeeTeam()) {
      if (this.hasLiveAttendance()) void this.teamTodayStore.load();
      else void this.calendarStore.openCurrentMonth(false);
    }
  }

  typeIcon(leaveTypeId: string): string | null {
    return this.typeById().get(leaveTypeId)?.icon ?? null;
  }

  balanceColor(leaveTypeId: string): string {
    return this.typeById().get(leaveTypeId)?.color ?? 'var(--color-accent)';
  }

  ringSlices(balance: LeaveBalanceResponse): readonly DashboardDonutSlice[] {
    return this.balanceRings().get(balance.leaveTypeId) ?? [];
  }

  /** The remaining share as the ring's centre shows it ("86%"). */
  share(balance: LeaveBalanceResponse): string {
    return formatPercent(remainingShare(balance), 100);
  }

  dateRange(startAt: string, endAt: string): string {
    return leaveDateRangeLabel(startAt, endAt);
  }

  /** "1 day", "½ day", "2.5 days": hours over the work day, else the calendar days the leave covers. */
  dayCount(startAt: string, endAt: string, totalHours: number): string {
    return leaveDayCountLabel(startAt, endAt, totalHours, this.workday());
  }

  /** "Jan 01, 2027": from the API, or 1 January after the balance's (calendar) leave year. */
  resetDate(balance: LeaveBalanceResponse): string {
    const iso = balance.resetsOn ?? `${balance.year + 1}-01-01`;
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  monthShort(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short' });
  }

  dayOfMonth(iso: string): string {
    return String(new Date(iso).getDate());
  }

  hours(value: number): string {
    return value.toFixed(2);
  }

  openWizard(): void {
    this.wizardOpen.set(true);
  }
}

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
