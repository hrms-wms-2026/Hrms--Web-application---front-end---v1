import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { IconComponent, IconName } from '../../../../shared/ui/icon/icon.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { WidgetCardComponent, WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import { TeamWorkingHoursApiService } from '../../data-access/team-working-hours-api.service';
import { TeamTodayMember, TeamTodayResponse, TeamWorkingHoursDay } from '../../models/my-team-today.model';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { WorkingHoursChartComponent } from '../../ui/working-hours-chart/working-hours-chart.component';
import { dashboardDonutPx, donutValueFontPx } from '../../../../shared/ui/charts/utils/dashboard-donut.util';
import { DashboardDonutComponent, DashboardDonutSlice } from '../../../../shared/ui/charts/dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../../../../shared/ui/charts/dashboard-donut/donut-key.component';
import { injectHostSize } from '../../utils/host-size.util';
import { DonutArc, donutArcs } from '../../../../shared/ui/charts/utils/status-donut.util';
import {
  PRESENCE_COLORS,
  PRESENCE_LABELS,
  PresenceState,
  breakMinutes,
  clockTime,
  hoursBreakdown,
  minutesLeft,
  minutesSince,
  minutesText,
  orderPresence,
  presenceFromSummary,
  presencePill,
  presenceState,
  todayHoursText,
  todayProgress
} from '../../utils/team-presence-format.util';
import { EMPTY_PRESENCE_PLAN, PresencePlan, PresenceView, planPresenceLayout, resolvePresenceView } from '../../utils/team-presence-layout.util';
import { formatPercent } from '../../utils/team-progress-format.util';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';
import { TeamStatusDetailDialogComponent } from '../team-status-detail-dialog/team-status-detail-dialog.component';

/** Elapsed times tick between refreshes; the counts only change when the data reloads. */
const TICK_MS = 30_000;

interface Counter {
  readonly key: PresenceState;
  readonly label: string;
  /** The tile's label: "Working", "On break", "On leave". */
  readonly tileLabel: string;
  readonly icon: IconName;
  readonly count: number;
  readonly percent: string;
  readonly color: string;
}

/**
 * My Team "Working / Break / Leave" (key team-status; 2026-11-02 design match section 6). Who is working, on a break or
 * on approved leave right now, since when and for how long. The population, the statuses and the leave masking are Team
 * Status's own: a person whose leave the viewer may not see arrives as absent and is never counted as Leave. A schedule
 * never makes anyone Working. The view comes from the card's own size and grows by detail, never by stretching: mini =
 * the donut (or a stacked bar) and the counts; xs = the donut over its legend, the pill and rows; standard = the KPI
 * tiles, person rows (a table on a wide card) and, on a tall card, the week's working-hours trend. The card never scrolls:
 * rows that do not fit are behind "View all", which opens the popup.
 */
@Component({
  selector: 'app-team-status-card',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    DashboardDonutComponent,
    DonutKeyComponent,
    AvatarComponent,
    IconComponent,
    WidgetCardComponent,
    PopoutHeaderActionsComponent,
    TeamStatusDetailDialogComponent,
    WorkingHoursChartComponent
  ],
  templateUrl: './team-status-card.component.html',
  styleUrl: './team-status-card.component.css',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamStatusCardComponent implements OnInit {
  protected readonly store = inject(MyTeamTodayStore);
  /** Inside a dashboard frame the first payload comes from the bootstrap and reloads go through the
   * widget context; outside one (or when that data isn't available) the store fetches as before. */
  private readonly feed = injectWidgetDataFeed<TeamTodayResponse>({
    apply: (data) => this.store.seed(data),
    fetch: () => void this.store.load(),
    refreshing: () => this.store.markLoading()
  });
  private readonly hoursApi = inject(TeamWorkingHoursApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly size = injectHostSize();

  private tickId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler = (): void => this.onVisibilityChange();
  private lastView: PresenceView | null = null;
  private trendRequested = false;

  /** Full size, or the mini size in the 2x2 view. */
  protected readonly donutPx = computed(() => dashboardDonutPx(this.view()));
  protected readonly valueFontPx = donutValueFontPx;
  protected readonly colors = PRESENCE_COLORS;
  protected readonly now = signal(new Date());
  /** This week's working hours for the trend panel; loaded once, the first time a view has room for it. */
  protected readonly trendDays = signal<readonly TeamWorkingHoursDay[] | null>(null);
  protected readonly trendFailed = signal(false);
  readonly detailOpen = signal(false);

  /** The view for the card's current size, with ~20px hysteresis; 'standard' until the first measurement. */
  readonly view = computed<PresenceView>(() => {
    const { width, height } = this.size();
    this.lastView = resolvePresenceView(width, height, this.lastView);
    return this.lastView;
  });

  protected readonly ordered = computed(() => orderPresence(this.store.data()?.members ?? []));

  protected readonly plan = computed<PresencePlan>(() => {
    const { width, height } = this.size();
    return width > 0 && height > 0 ? planPresenceLayout(this.view(), width, height, this.ordered().length) : EMPTY_PRESENCE_PLAN;
  });

  protected readonly widgetState = computed<WidgetState>(() => {
    const data = this.store.data();
    if (!data) return this.store.error() ? 'error' : 'loading';
    return data.totalMembers === 0 ? 'empty' : 'ready';
  });
  protected readonly refreshing = computed(() => this.store.loading() && !!this.store.data());

  protected readonly groups = computed(() => {
    const summary = this.store.data()?.summary;
    return summary ? presenceFromSummary(summary) : null;
  });

  protected readonly counters = computed<Counter[]>(() => {
    const g = this.groups();
    const total = this.store.data()?.totalMembers ?? 0;
    if (!g) return [];
    const counter = (key: PresenceState, tileLabel: string, icon: IconName, count: number): Counter => ({
      key,
      label: PRESENCE_LABELS[key],
      tileLabel,
      icon,
      count,
      percent: formatPercent(count, total),
      color: PRESENCE_COLORS[key]
    });
    return [
      counter('working', 'Working', 'users', g.working),
      counter('break', 'On break', 'clock', g.onBreak),
      counter('leave', 'On leave', 'alert-triangle', g.onLeave)
    ];
  });

  /** The team's time today: worked, break and leave minutes (the donut, its legend and the hours rows). */
  protected readonly hours = computed(() => hoursBreakdown(this.store.data()?.members ?? [], this.now()));
  protected readonly hourLegend = computed(() => {
    const h = this.hours();
    return [
      { key: 'working' as const, label: PRESENCE_LABELS.working, minutes: h.worked, color: PRESENCE_COLORS.working },
      { key: 'break' as const, label: PRESENCE_LABELS.break, minutes: h.break, color: PRESENCE_COLORS.break },
      { key: 'leave' as const, label: PRESENCE_LABELS.leave, minutes: h.leave, color: PRESENCE_COLORS.leave }
    ];
  });
  protected readonly donut = computed<DonutArc[]>(() =>
    donutArcs(this.hourLegend().map((row) => ({ key: row.key, count: row.minutes, color: row.color })))
  );
  /** The donut and its key: worked, break and leave time, with each one's share of the day's total. */
  protected readonly hourSlices = computed<DashboardDonutSlice[]>(() =>
    this.hourLegend().map((row) => ({ key: row.key, label: row.label, value: row.minutes, valueText: minutesText(row.minutes), color: row.color }))
  );
  /** The slice the donut lights (hovered there or on a key row). */
  protected readonly hovered = signal<string | null>(null);
  protected readonly donutLabel = computed(
    () =>
      `Team time today: ${this.hourLegend()
        .map((row) => `${minutesText(row.minutes)} ${row.label.toLowerCase()}`)
        .join(', ')}`
  );
  /** Each employee's time today, most worked first: the bars share the largest worked + break + leave. */
  protected readonly hourRows = computed(() => {
    const now = this.now();
    const rows = (this.store.data()?.members ?? []).map((m) => ({
      member: m,
      worked: m.attendanceMinutes,
      break: breakMinutes(m, now),
      leave: m.leaveMinutes
    }));
    rows.sort((a, b) => b.worked - a.worked || b.leave - a.leave || a.member.displayName.localeCompare(b.member.displayName));
    const scale = Math.max(1, ...rows.map((r) => r.worked + r.break + r.leave));
    const share = (n: number) => Math.round((n * 1000) / scale) / 10;
    return rows.map((r) => ({
      ...r,
      workedShare: share(r.worked),
      breakShare: share(r.break),
      leaveShare: share(r.leave),
      total: r.worked === 0 && r.leave > 0 ? `Leave ${minutesText(r.leave)}` : minutesText(r.worked)
    }));
  });
  protected readonly visibleHourRows = computed(() => this.hourRows().slice(0, this.plan().rows));
  protected readonly pill = computed(() => {
    const g = this.groups();
    return g ? presencePill(g) : '';
  });

  protected readonly rows = computed(() => this.ordered().slice(0, this.plan().rows));
  protected readonly hasColumn = computed(() => new Set(this.plan().columns));

  constructor() {
    // The trend costs a request, so it loads only once a view first has room for it.
    effect(() => {
      if (!this.plan().trend || this.trendRequested) return;
      this.trendRequested = true;
      untracked(() => this.loadTrend());
    });
  }

  ngOnInit(): void {
    this.feed.start();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.tickId = setInterval(() => this.now.set(new Date()), TICK_MS);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      if (this.tickId) clearInterval(this.tickId);
    });
  }

  protected state(member: TeamTodayMember): PresenceState | null {
    return presenceState(member.status);
  }

  protected stateLabel(member: TeamTodayMember): string {
    const state = presenceState(member.status);
    if (state === 'break') return 'On break';
    if (state === 'leave') return 'On leave';
    return state ? PRESENCE_LABELS[state] : member.statusLabel;
  }

  protected stateColor(member: TeamTodayMember): string | null {
    const state = presenceState(member.status);
    return state ? PRESENCE_COLORS[state] : null;
  }

  /** Clock-in time; a whole-day leave reads "All day"; otherwise "—". */
  protected startText(member: TeamTodayMember): string {
    if (member.clockInAt) return clockTime(member.clockInAt);
    return presenceState(member.status) === 'leave' ? 'All day' : '—';
  }

  protected minutes(m: number): string {
    return minutesText(m);
  }

  protected elapsedText(member: TeamTodayMember): string {
    return member.stateSince ? minutesText(minutesSince(member.stateSince, this.now())) : '—';
  }

  /** "2h 30m left" of the break allowance or the shift; null without a denominator (no guessed figure). */
  protected leftText(member: TeamTodayMember): string | null {
    const left = minutesLeft(member, this.now());
    return left === null ? null : `${minutesText(left)} left`;
  }

  protected todayHours(member: TeamTodayMember): string {
    return todayHoursText(member);
  }

  protected progress(member: TeamTodayMember): number | null {
    return todayProgress(member);
  }

  protected progressText(member: TeamTodayMember): string {
    return member.expectedMinutes ? formatPercent(member.attendanceMinutes, member.expectedMinutes) : '—';
  }

  /** Leave never counts down: its type and end only where Team Status shows them (leave-authorized viewers). */
  protected leaveText(member: TeamTodayMember): string {
    return member.leave ? `${member.leave.leaveTypeName} · until ${member.leave.endsOn}` : 'Leave';
  }

  protected avatarUrl(member: TeamTodayMember): string | null {
    return member.avatarFileId ? buildFileUrl(member.avatarFileId) : null;
  }

  retry(): void {
    this.feed.reload();
  }

  openDetail(event?: Event): void {
    event?.stopPropagation();
    if (this.store.data()) this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
  }

  private loadTrend(): void {
    this.hoursApi.getWeek(null).subscribe({
      next: (week) => this.trendDays.set(week.days),
      error: () => this.trendFailed.set(true)
    });
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.feed.reload();
    }
  }
}
