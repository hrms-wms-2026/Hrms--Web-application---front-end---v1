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
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { injectHostSize } from '../../utils/host-size.util';
import { DonutArc, donutArcs } from '../../utils/status-donut.util';
import {
  PRESENCE_COLORS,
  PRESENCE_LABELS,
  PresenceState,
  clockTime,
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

const REFRESH_INTERVAL_MS = 60_000;
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

  private pollId: ReturnType<typeof setInterval> | null = null;
  private tickId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler = (): void => this.onVisibilityChange();
  private lastView: PresenceView | null = null;
  private trendRequested = false;

  protected readonly donutPx = DASHBOARD_DONUT_PX;
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

  protected readonly donut = computed<DonutArc[]>(() => donutArcs(this.counters()));
  protected readonly donutLabel = computed(
    () => `${this.counters().map((c) => `${c.count} ${c.label.toLowerCase()}`).join(', ')} of ${this.store.data()?.totalMembers ?? 0}`
  );
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
    if (document.visibilityState === 'visible') this.startPolling();
    this.tickId = setInterval(() => this.now.set(new Date()), TICK_MS);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopPolling();
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
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  private startPolling(): void {
    if (this.pollId) return;
    this.pollId = setInterval(() => this.feed.reload(), REFRESH_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }
}
