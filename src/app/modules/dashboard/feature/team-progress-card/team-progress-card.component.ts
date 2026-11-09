import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TeamProgressDetailApiService } from '../../data-access/team-progress-detail-api.service';
import { LedEmployeeProgress, LedPeriodProgress, LedProgressPeriod, LedTimePeriod, LedWeeklyCompletion } from '../../models/team-progress-detail.model';
import { TeamProgressTimeComponent } from '../../ui/team-progress-time/team-progress-time.component';
import { timePeriodFor } from '../../utils/team-progress-time-format.util';
import { WeeklyCompletionChartComponent } from '../../ui/weekly-completion-chart/weekly-completion-chart.component';
import { Router } from '@angular/router';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { WidgetCardComponent, WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';
import { LedHourTotals, LedOverdueTask, LedWorkProgressResponse } from '../../models/my-team-led-progress.model';
import {
  PROGRESS_STATUSES,
  ProgressStatusKey,
  formatHourValue,
  formatPercent,
  percentOf
} from '../../utils/team-progress-format.util';
import {
  TEAM_PROGRESS_CARD_CHROME,
  TeamProgressMode,
  TeamProgressPlan,
  planTeamProgressLayout,
  resolveTeamProgressMode
} from '../../utils/team-progress-layout.util';
import { dashboardDonutPx } from '../../utils/dashboard-donut.util';
import { DashboardDonutComponent, DashboardDonutSlice } from '../../ui/dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../../ui/dashboard-donut/donut-key.component';
import { DashboardSummaryStripComponent } from '../../ui/dashboard-summary-strip/dashboard-summary-strip.component';
import { DashboardSummaryRowComponent } from '../../ui/dashboard-summary-row/dashboard-summary-row.component';
import { summaryRowCount, withSummaryRow } from '../../utils/summary-row.util';
import { SummaryCardModel } from '../../models/summary-card.model';
import { teamProgressSummaryCards } from '../../utils/team-progress-summary-cards.util';
import { SUMMARY_CARD_ROWS } from '../../utils/team-attendance-summary-cards.util';
import { ProjectHoursChartComponent } from '../../ui/project-hours-chart/project-hours-chart.component';
import { orderProjectsForChart } from '../../utils/project-hours-chart.util';
import { TeamProgressDetailDialogComponent } from '../team-progress-detail-dialog/team-progress-detail-dialog.component';
import { IconComponent, IconName } from '../../../../shared/ui/icon/icon.component';

/** Per-viewer memory of the period switch. A convenience only: when storage is blocked the card
 * simply starts on All time. */
export const TEAM_PROGRESS_PERIOD_STORAGE_KEY = 'crownus.teamProgress.period';

/** Width of one project bar in the card's chart, with its gap. */
const CHART_BAR_PX = 44;

type DatedPeriod = Exclude<LedProgressPeriod, 'all'>;
type TaskStatusKey = Exclude<ProgressStatusKey, 'untasked'>;

export type MetricTone = 'green' | 'blue' | 'gray' | 'amber' | 'rose';

/** One tinted metric tile. Every value is a real number from a payload, never estimated. */
export interface MetricTile {
  key: string;
  value: string;
  label: string;
  tone: MetricTone;
}

/** A KPI card of the small view: a metric tile with an icon badge, like the popup's Overview tiles. */
export interface KpiCard extends MetricTile {
  icon: IconName;
}

/** One of the hour states, ready for the donut, legends, tiles and bars. */
const STATUS_ICON: Record<ProgressStatusKey, IconName> = {
  completed: 'check-circle',
  inProgress: 'clock',
  notStarted: 'layers',
  untasked: 'alert-triangle'
};

export interface StatusRow {
  key: ProgressStatusKey;
  label: string;
  color: string;
  bgClass: string;
  hours: number;
  hoursText: string;
  /** Share of the base (allocation, task estimates when nothing is allocated, or the period total). */
  percentText: string;
  /** The same share as a 0-100 number for bar widths. */
  percentValue: number;
  /** Whole-number share for aria-valuenow. */
  percentRounded: number;
  /** Stable test id suffix, kept from the original legend. */
  testId: string;
  /** Tile tint in the medium layout. */
  tone: MetricTone;
}


interface DonutSegment {
  key: ProgressStatusKey;
  color: string;
  /** Arc length on a circle whose circumference is 100. */
  length: number;
  /** stroke-dashoffset that starts this arc where the previous one ended (12 o'clock first). */
  offset: number;
}



const LEGEND_TEST_IDS: Record<ProgressStatusKey, string> = {
  completed: 'completed',
  inProgress: 'in-progress',
  notStarted: 'not-started',
  untasked: 'untasked'
};

const TONE_BY_STATUS: Record<ProgressStatusKey, MetricTone> = {
  completed: 'green',
  inProgress: 'blue',
  notStarted: 'gray',
  untasked: 'amber'
};

const HOURS_BY_KEY: Record<ProgressStatusKey, (h: LedHourTotals) => number> = {
  completed: (h) => h.completedHours,
  inProgress: (h) => h.inProgressHours,
  notStarted: (h) => h.notStartedHours,
  untasked: (h) => h.untaskedHours
};

const PERIOD_HOURS_BY_KEY: Record<TaskStatusKey, (p: LedPeriodProgress) => number> = {
  completed: (p) => p.completedHours,
  inProgress: (p) => p.inProgressHours,
  notStarted: (p) => p.notStartedHours
};

function readStoredPeriod(): LedProgressPeriod {
  try {
    const value = localStorage.getItem(TEAM_PROGRESS_PERIOD_STORAGE_KEY);
    return value === 'month' || value === 'week' ? value : 'all';
  } catch {
    return 'all';
  }
}

function storePeriod(period: LedProgressPeriod): void {
  try {
    localStorage.setItem(TEAM_PROGRESS_PERIOD_STORAGE_KEY, period);
  } catch {
    // Storage blocked (private window, site policy): the choice is just not remembered.
  }
}

/** Views that show the weekly completion chart. */
const WEEKLY_MODES: ReadonlySet<TeamProgressMode> = new Set<TeamProgressMode>(['wide', 'tall', 'large', 'maximum']);
/** The 2-row strip's card positions that need their own data: weekly completion is the first, the members behind the fourth. */
const WEEKLY_CARD_POSITION = 1;
const BEHIND_CARD_POSITION = 4;

const EMPTY_PLAN: TeamProgressPlan = {
  miniLegend: 'none', miniFigure: false, legend: false, tileRows: 0, viewDetails: false, listRows: 0, weeklyFallbackRows: 0,
  timeBand: false, timeChart: false, timeCallout: false, workloadRows: 0
};

/**
 * Team Progress: the estimated-hours (task estimate weightage, not time worked) picture of the
 * modules the viewer leads. The card picks one of seven views from its own rendered size (see
 * team-progress-layout.util). Every component keeps one fixed size (the donut is always DASHBOARD_DONUT_PX, DASHBOARD_MINI_DONUT_PX in the 2x2 view, or absent where it does not fit): a
 * bigger card shows more sections and list rows, never bigger graphics. Resizing only re-lays out
 * what is loaded, it never fetches.
 * A period switch (All time / This month / This week) narrows the figures to tasks due in it.
 * The expand button, "View all" and a click anywhere on the card open the detail dialog.
 */
@Component({
  selector: 'app-team-progress-card',
  standalone: true,
  imports: [IconComponent, DashboardDonutComponent, DonutKeyComponent, DashboardSummaryStripComponent, DashboardSummaryRowComponent, TeamProgressTimeComponent, ProjectHoursChartComponent,
    NgTemplateOutlet,
    WidgetCardComponent,
    PopoutHeaderActionsComponent,
    TeamProgressDetailDialogComponent,
    WeeklyCompletionChartComponent
  ],
  templateUrl: './team-progress-card.component.html',
  styleUrl: './team-progress-card.component.css',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamProgressCardComponent implements OnInit {
  protected readonly store = inject(MyTeamLedProgressStore);
  /** Inside a dashboard frame the first payload comes from the bootstrap and reloads go through the
   * widget context; outside one (or when that data isn't available) the store fetches as before. */
  private readonly feed = injectWidgetDataFeed<LedWorkProgressResponse>({
    apply: (data) => this.store.seed(data),
    fetch: () => void this.store.load(),
    refreshing: () => this.store.markLoading()
  });
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly detailApi = inject(TeamProgressDetailApiService);

  private visibilityHandler = (): void => this.onVisibilityChange();

  private resizeObserver: ResizeObserver | null = null;
  private frameId: number | null = null;
  private pendingSize: { width: number; height: number } | null = null;

  /** Layout for the card's current size. 'small' until the first measurement (and without ResizeObserver). */
  readonly mode = signal<TeamProgressMode>('small');
  /** The donut slice (or legend row) under the pointer: the shared donut lights it and reads it in the centre. */
  protected readonly hoveredStatus = signal<string | null>(null);
  /** Optional sections and list rows the current view has room for. */
  /** The last measured host size: the layout below follows it and the loaded data. */
  private readonly size = signal<{ width: number; height: number } | null>(null);
  /** The sections at the current size. A taller small or medium view puts two summary cards of what it is not already
   * showing in its tiles' place, budgeted at the cards' height; without room or two such cards it keeps the tiles. */
  private readonly layout = computed(() => {
    const size = this.size();
    const mode = this.mode();
    if (!size) return { plan: EMPTY_PLAN, cards: [] as SummaryCardModel[] };
    const overdue = (this.store.data()?.overdueTotal ?? 0) > 0;
    return withSummaryRow(
      (rowPx) => {
        const plan = planTeamProgressLayout(mode, size.width, size.height, rowPx);
        return { ...plan, tiles: (mode === 'small' || mode === 'medium') && plan.tileRows > 0 };
      },
      this.summaryCards(),
      (plan) => shownProgressCards(mode, plan, overdue),
      summaryRowCount(size.width - TEAM_PROGRESS_CARD_CHROME.width)
    );
  });
  readonly plan = computed<TeamProgressPlan>(() => this.layout().plan, { equal: samePlan });
  /** Taller small / medium views: the summary cards in the tiles' place (empty: the tiles). */
  protected readonly rowCards = computed(() => this.layout().cards);
  /** Plain booleans for the data effects, so they re-run only when these change (not on every card list). */
  private readonly weeklyInRow = computed(() => this.rowCards().some((c) => c.id === 'tp-weekly'));
  private readonly behindInRow = computed(() => this.rowCards().some((c) => c.id === 'tp-behind'));
  /** Rendered card width, rounded to 100px steps so it only changes the layout at those steps. */
  protected readonly widthStep = signal(0);
  /** Placeholder bar heights (%) for the weekly chart skeleton. */
  protected readonly skeletonBars = [40, 65, 30, 80, 55, 70, 45, 85, 60, 35];
  readonly detailOpen = signal(false);
  /** The popup section a summary card asked for (null: the top). */
  readonly detailSection = signal<string | null>(null);
  /** mini: how many summary cards the 2-row strip shows. */
  protected readonly shownCards = signal(0);
  /** The members furthest behind (sort 'completionRate'), loaded once their summary card is shown. */
  private readonly behind = signal<{ for: LedWorkProgressResponse; period: LedProgressPeriod; rows: LedEmployeeProgress[] | null; error: boolean } | null>(null);
  private behindSub: Subscription | null = null;
  private timeRequestedFor: { data: LedWorkProgressResponse; period: LedTimePeriod } | null = null;

  /** The period switch: 'all' is the bootstrap led-progress payload; week / month use the period endpoint. */
  readonly period = signal<LedProgressPeriod>(readStoredPeriod());
  /** Period payloads, each with the led-progress load it was fetched for. A newer load (refresh or
   * tab return) refetches the selected period and keeps showing the older payload until the new one lands. */
  private readonly periodCache = signal<Partial<Record<DatedPeriod, { payload: LedPeriodProgress; for: LedWorkProgressResponse }>>>({});
  private readonly periodRequested = new Map<DatedPeriod, LedWorkProgressResponse>();
  protected readonly periodFailed = signal(false);

  /** Top 5 people by assigned task estimate. Only the large and maximum layouts show it, so it is
   * fetched lazily there, once per data load; resizing within those layouts never refetches. */
  protected readonly topMembers = signal<LedEmployeeProgress[]>([]);
  /** The data load and period the shown top members belong to; a new load or period refetches. */
  private topMembersFor: { data: LedWorkProgressResponse; period: LedProgressPeriod } | null = null;
  private topMembersSub: Subscription | null = null;
  protected readonly topMemberScale = computed(() => Math.max(0, ...this.topMembers().map((m) => m.totalHours)));

  /** Weekly completion (last 10 weeks) for the tall, large and maximum views. Fetched lazily the
   * first time one of them shows, once per data load (refresh / tab return reload it, resizing never does);
   * not tied to the period switch. A failure hides the section and gives its space to the lists. */
  private readonly weekly = signal<{ for: LedWorkProgressResponse; payload: LedWeeklyCompletion | null } | null>(null);
  private weeklyRequestedFor: LedWorkProgressResponse | null = null;
  /** Bumped by Try again on the weekly summary card, to fetch weekly completion again. */
  private readonly weeklyRetry = signal(0);
  private weeklySub: Subscription | null = null;

  /** The weekly payload for the current data load; null while loading or after a failure. */
  protected readonly weeklyData = computed(() => {
    const w = this.weekly();
    return w && w.for === this.store.data() ? w.payload : null;
  });

  /** 'loading' until the current load's weekly payload lands, 'ready' with it, 'hidden' on failure.
   * A reload keeps showing the previous load's chart until the new one lands. */
  protected readonly weeklyState = computed<'loading' | 'ready' | 'hidden'>(() => {
    const w = this.weekly();
    if (!w) return 'loading';
    if (w.for !== this.store.data()) return w.payload ? 'ready' : 'loading';
    return w.payload ? 'ready' : 'hidden';
  });

  /** The chart's payload: the current load's, else the previous one while a reload is in flight. */
  protected readonly weeklyShown = computed(() => this.weekly()?.payload ?? null);

  protected readonly undatedText = computed(() => {
    const undated = this.weeklyShown()?.undatedCompletedHours ?? 0;
    return undated > 0 ? `${formatHourValue(undated)} h completed without a date` : '';
  });

  constructor() {
    // The planned-vs-worked figures load with the card, for the switch's period (All time reads the week).
    effect(() => {
      const data = this.store.data();
      const period = timePeriodFor(this.period());
      if (!data || (this.timeRequestedFor?.data === data && this.timeRequestedFor.period === period)) return;
      this.timeRequestedFor = { data, period };
      untracked(() => this.store.loadTime(period));
    });

    effect(() => {
      const mode = this.mode();
      const data = this.store.data();
      this.weeklyRetry(); // Try again on the weekly card re-runs this effect.
      const wanted = WEEKLY_MODES.has(mode) || (mode === 'mini' && this.shownCards() >= WEEKLY_CARD_POSITION) || this.weeklyInRow();
      if (!wanted || !data || this.weeklyRequestedFor === data) return;
      this.weeklyRequestedFor = data;
      untracked(() => {
        this.weeklySub?.unsubscribe();
        this.weeklySub = this.detailApi
          .getWeeklyCompletion(10)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (payload) => this.weekly.set({ for: data, payload }),
            // Optional extra: on failure the section is hidden and the lists take its space.
            error: () => this.weekly.set({ for: data, payload: null })
          });
      });
    });

    effect(() => {
      const period = this.period();
      const data = this.store.data();
      if (period === 'all' || !data) return;
      const cached = untracked(() => this.periodCache()[period]);
      if (cached?.for === data || this.periodRequested.get(period) === data) return;
      this.periodRequested.set(period, data);
      untracked(() => this.fetchPeriod(period, data));
    });

    effect(() => {
      const mode = this.mode();
      const data = this.store.data();
      const period = this.period();
      if ((mode !== 'large' && mode !== 'maximum') || !data) return;
      if (this.topMembersFor?.data === data && this.topMembersFor.period === period) return;
      this.topMembersFor = { data, period };
      untracked(() => {
        // A newer period or load replaces the request in flight, so an old answer never lands last.
        this.topMembersSub?.unsubscribe();
        this.topMembersSub = this.detailApi
          .getEmployees({
            pageNumber: 1,
            pageSize: 5,
            sort: 'totalHours',
            direction: 'desc',
            ...(period === 'all' ? {} : { period })
          })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (page) => this.topMembers.set(page.items.filter((m) => m.totalHours > 0)),
            // Optional extra: on failure the layout simply keeps its other sections.
            error: () => this.topMembers.set([])
          });
      });
    });

    // The 2-row strip's fourth card: the members furthest behind, for the shown period.
    effect(() => {
      const data = this.store.data();
      const period = this.period();
      const inStrip = this.mode() === 'mini' && this.shownCards() >= BEHIND_CARD_POSITION;
      if (!data || (!inStrip && !this.behindInRow())) return;
      const current = untracked(this.behind);
      // Already loaded (or failed: Try again retries) for this data and period.
      if (current?.for === data && current.period === period) return;
      untracked(() => this.loadBehind(data, period));
    });
  }

  protected readonly formatHourValue = formatHourValue;

  /** The 2-row strip's cards, each summarising a section of the popup. */
  protected readonly summaryCards = computed<SummaryCardModel[]>(() => {
    const data = this.store.data();
    if (!data) return [];
    const behind = this.behind();
    const current = behind?.for === data && behind.period === this.period() ? behind : null;
    const weekly = this.weekly();
    const weeklyFailed = weekly?.for === data && weekly.payload === null;
    return teamProgressSummaryCards(
      data,
      this.weeklyData(),
      { rows: current?.rows ?? null, error: current?.error ?? false },
      weeklyFailed,
      this.period() === 'all'
    );
  });

  /** Try again on a failed summary card: weekly completion refetches through its effect; the members behind reload. */
  retryCard(id: string): void {
    const data = this.store.data();
    if (!data) return;
    if (id === 'tp-weekly') {
      this.weeklyRequestedFor = null;
      this.weekly.set(null);
      this.weeklyRetry.update((n) => n + 1);
      return;
    }
    this.loadBehind(data, this.period());
  }

  private loadBehind(data: LedWorkProgressResponse, period: LedProgressPeriod): void {
    this.behindSub?.unsubscribe();
    // A refresh of the same period keeps the shown list until the new one lands (no skeleton flash).
    const previous = untracked(this.behind);
    this.behind.set({ for: data, period, rows: previous?.period === period ? previous.rows : null, error: false });
    this.behindSub = this.detailApi
      .getEmployees({ pageNumber: 1, pageSize: SUMMARY_CARD_ROWS, sort: 'completionRate', direction: 'asc', ...(period === 'all' ? {} : { period }) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.behind.set({ for: data, period, rows: page.items, error: false }),
        error: () => this.behind.set({ for: data, period, rows: null, error: true })
      });
  }

  /** A reload sets `loading`; only a first load (no data yet) shows the skeleton. */
  protected readonly widgetState = computed<WidgetState>(() => {
    const data = this.store.data();
    if (!data) return this.store.error() ? 'error' : 'loading';
    const h = data.hours;
    return data.projects.length === 0 || (h.allocatedHours === 0 && h.taskCount === 0) ? 'empty' : 'ready';
  });

  protected readonly emptyMessage = computed(() =>
    (this.store.data()?.projects.length ?? 0) === 0
      ? "You don't lead any active modules"
      : 'No hours allocated or tasks in the modules you lead'
  );

  protected readonly refreshing = computed(() => this.store.loading() && !!this.store.data());

  /** The selected period's payload; null for All time and until its first fetch lands. */
  protected readonly periodData = computed<LedPeriodProgress | null>(() => {
    const period = this.period();
    return period === 'all' ? null : (this.periodCache()[period]?.payload ?? null);
  });

  /** 'ready' for All time; for a dated period, whether its payload is there yet. */
  protected readonly periodState = computed<'ready' | 'loading' | 'error'>(() => {
    if (this.period() === 'all' || this.periodData()) return 'ready';
    return this.periodFailed() ? 'error' : 'loading';
  });

  protected readonly periodCaption = computed(() => {
    const period = this.period();
    return period === 'week' ? 'Due this week' : period === 'month' ? 'Due this month' : 'Allocated';
  });

  protected readonly periodEmptyText = computed(() => (this.period() === 'week' ? 'No tasks due this week' : 'No tasks due this month'));

  /** A dated period with no estimated hours due in it. */
  protected readonly periodEmpty = computed(() => {
    const p = this.periodData();
    return !!p && !(p.totalHours > 0);
  });

  /** Four states for All time (a zero state still shows "0 h · 0%"); for a dated period the three
   * task states against the hours due in it ("not yet tasked" has no date). */
  /** The status tile's icon badge (2026-11-02 design match). */
  protected statusIcon(key: ProgressStatusKey): IconName {
    return STATUS_ICON[key];
  }

  protected readonly statusRows = computed<StatusRow[]>(() => {
    if (this.period() !== 'all') {
      const p = this.periodData();
      return p ? buildPeriodStatusRows(p) : [];
    }
    const h = this.store.data()?.hours;
    return h ? buildStatusRows(h) : [];
  });

  /** Donut arcs share the circle by the states' hours. A tiny state gets a tiny arc. */
  /** The donut's slices: each status's hours, with its share of the base (allocation or period total). */
  protected readonly donutSlices = computed<DashboardDonutSlice[]>(() =>
    this.statusRows().map((row) => ({
      key: row.key,
      label: row.label,
      value: Math.max(0, row.hours),
      valueText: `${row.hoursText} h`,
      percentText: row.percentText,
      color: row.color
    }))
  );

  protected readonly donutSegments = computed<DonutSegment[]>(() => {
    const rows = this.statusRows();
    const total = rows.reduce((sum, row) => sum + Math.max(0, row.hours), 0);
    if (total <= 0) return [];
    let start = 0;
    const segments: DonutSegment[] = [];
    for (const row of rows) {
      if (!(row.hours > 0)) continue;
      const length = (row.hours / total) * 100;
      // The circle starts at 3 o'clock; an offset of 25 moves the first arc to 12 o'clock.
      segments.push({ key: row.key, color: row.color, length, offset: 25 - start });
      start += length;
    }
    return segments;
  });

  /** Donut centre / headline: allocated weightage for All time, due task hours for a period. */
  protected readonly totalText = computed(() => {
    const total = this.period() === 'all' ? (this.store.data()?.hours.allocatedHours ?? 0) : (this.periodData()?.totalHours ?? 0);
    return `${formatHourValue(total)} h`;
  });

  /** Centre number size in px: fixed, one step smaller only for a long total, so it fits the ring. */
  /** Full size, or the mini size in the 2x2 view. */
  protected readonly donutPx = computed(() => dashboardDonutPx(this.mode()));

  protected readonly totalFontPx = computed(() => {
    const length = this.totalText().length;
    return length <= 8 ? 15 : length <= 10 ? 14 : 12;
  });

  protected readonly donutLabel = computed(() => {
    if (!this.store.data()) return '';
    const parts = this.statusRows().map((row) => `${row.label} ${row.hoursText} h (${row.percentText})`);
    return `Estimated hours, ${this.totalText()} ${this.periodCaption().toLowerCase()}: ${parts.join(', ')}`;
  });

  /** Completed hours against the allocation (task estimates when nothing is allocated), or against
   * the hours due in the selected period. */
  protected readonly completionText = computed(() => {
    if (this.period() !== 'all') {
      const p = this.periodData();
      return p ? formatPercent(p.completedHours, p.totalHours) : '0%';
    }
    const h = this.store.data()?.hours;
    return h ? formatPercent(h.completedHours, completionBase(h)) : '0%';
  });

  protected readonly untaskedText = computed(() => {
    const h = this.store.data()?.hours;
    return h ? formatPercent(h.untaskedHours, completionBase(h)) : '0%';
  });

  protected readonly modulesAtRisk = computed(() => this.store.data()?.modulesAtRisk ?? 0);

  /** Tinted metric tiles. Task counts by status only exist for a period, so All time shows the total
   * task count and modules at risk instead. */
  protected readonly metricTiles = computed<MetricTile[]>(() => {
    const data = this.store.data();
    if (!data) return [];
    const completed: MetricTile = { key: 'completion', value: this.completionText(), label: 'Hours completed', tone: 'green' };
    if (this.period() !== 'all') {
      const p = this.periodData();
      if (!p) return [];
      return [
        completed,
        { key: 'tasks', value: formatHourValue(p.taskCount), label: this.period() === 'week' ? 'Tasks due this week' : 'Tasks due this month', tone: 'gray' },
        { key: 'not-started-tasks', value: formatHourValue(p.notStartedTaskCount), label: 'Tasks not started', tone: 'gray' },
        { key: 'in-progress-tasks', value: formatHourValue(p.inProgressTaskCount), label: 'Tasks in progress', tone: 'blue' }
      ];
    }
    const atRisk = data.modulesAtRisk;
    return [
      completed,
      { key: 'tasks', value: formatHourValue(data.hours.taskCount), label: 'Total tasks', tone: 'gray' },
      { key: 'at-risk', value: String(atRisk), label: atRisk === 1 ? 'Module at risk' : 'Modules at risk', tone: atRisk > 0 ? 'rose' : 'gray' },
      { key: 'untasked', value: this.untaskedText(), label: 'Not yet tasked', tone: 'amber' }
    ];
  });

  private readonly overdueTile = computed<MetricTile>(() => {
    const overdue = this.store.data()?.overdueTotal ?? 0;
    return { key: 'overdue', value: String(overdue), label: 'Overdue tasks', tone: overdue > 0 ? 'rose' : 'gray' };
  });

  /** The maximum layout adds overdue tasks (not period-bound) and the led module count: six tiles, 3 x 2. */
  protected readonly maximumTiles = computed<MetricTile[]>(() => {
    const tiles = this.metricTiles();
    if (tiles.length === 0) return tiles;
    const modules = this.ledModuleCount();
    return [
      ...tiles,
      this.overdueTile(),
      { key: 'modules', value: String(modules), label: modules === 1 ? 'Led module' : 'Led modules', tone: 'gray' }
    ];
  });

  /** Extra tiles of the xs, small and medium views, which already show the completion figure: the
   * other metric tiles plus overdue tasks, two per row (four per row in medium). */
  protected readonly extraTiles = computed<MetricTile[]>(() => {
    const tiles = this.metricTiles();
    if (tiles.length === 0) return tiles;
    return [...tiles.slice(1), this.overdueTile()];
  });

  protected readonly visibleExtraTiles = computed(() =>
    this.extraTiles().slice(0, this.plan().tileRows * (this.mode() === 'medium' ? 4 : 2))
  );

  /** The small view's KPI cards, in the detail popup's Overview style (value, label, icon badge):
   * in progress and overdue first, then the task count and modules at risk (or, for a period, the
   * tasks due and not started). Two per row. */
  protected readonly kpiCards = computed<KpiCard[]>(() => {
    const data = this.store.data();
    if (!data) return [];
    const inProgress = this.statusRows().find((row) => row.key === 'inProgress');
    const overdue = data.overdueTotal;
    const cards: KpiCard[] = [];
    if (inProgress) {
      cards.push({ key: 'in-progress', value: `${inProgress.hoursText} h`, label: `In progress · ${inProgress.percentText}`, icon: 'clock', tone: 'blue' });
    }
    cards.push({
      key: 'overdue',
      value: `${formatHourValue(data.overdueHours)} h`,
      label: `Overdue · ${overdue} ${overdue === 1 ? 'task' : 'tasks'}`,
      icon: 'alert-triangle',
      tone: overdue > 0 ? 'rose' : 'gray'
    });
    if (this.period() !== 'all') {
      const p = this.periodData();
      if (p) {
        cards.push(
          { key: 'tasks', value: formatHourValue(p.taskCount), label: this.period() === 'week' ? 'Tasks due this week' : 'Tasks due this month', icon: 'clipboard-list', tone: 'gray' },
          { key: 'not-started-tasks', value: formatHourValue(p.notStartedTaskCount), label: 'Tasks not started', icon: 'layers', tone: 'gray' }
        );
      }
      return cards;
    }
    const atRisk = data.modulesAtRisk;
    cards.push(
      { key: 'tasks', value: formatHourValue(data.hours.taskCount), label: 'Total tasks', icon: 'clipboard-list', tone: 'gray' },
      { key: 'at-risk', value: String(atRisk), label: atRisk === 1 ? 'Module at risk' : 'Modules at risk', icon: 'layers', tone: atRisk > 0 ? 'rose' : 'gray' }
    );
    return cards;
  });

  protected readonly visibleKpiCards = computed(() => this.kpiCards().slice(0, this.plan().tileRows * 2));

  /** Over-tasked / unestimated notes only make sense against the allocation (All time). */
  protected readonly showNotes = computed(() => {
    const h = this.store.data()?.hours;
    return this.period() === 'all' && !!h && (h.overTaskedHours > 0 || h.unestimatedTaskCount > 0);
  });

  /** How many modules the viewer leads directly (depth 0), for the maximum layout's tile. */
  protected readonly ledModuleCount = computed(() =>
    (this.store.data()?.projects ?? []).reduce((n, p) => n + p.modules.filter((m) => m.depth === 0).length, 0)
  );


  /** List rows in the current view: the plan's rows, plus the weekly panel's space when it is hidden,
   * minus one for the over-tasked / unestimated note. */
  private readonly effectiveBudget = computed(() => {
    const plan = this.plan();
    let budget = plan.listRows + (this.weeklyState() === 'hidden' ? plan.weeklyFallbackRows : 0);
    if (budget > 1 && this.showNotes()) budget--;
    return budget;
  });

  /** Whether the current view has room for list panels. */
  protected readonly showLists = computed(() => this.effectiveBudget() > 0);

  /** Every led project for the chart: at-risk ones first, then the largest allocation. */
  protected readonly chartProjects = computed(() => orderProjectsForChart(this.store.data()?.projects ?? []));
  /** As many bars as the chart panel's width holds (about 44px each), never fewer than three. */
  protected readonly maxChartBars = computed(() => {
    const panels = (this.store.data()?.overdueTotal ?? 0) > 0 ? 2 : 1;
    const panelWidth = this.widthStep() / panels - 80;
    return Math.max(3, Math.floor(panelWidth / CHART_BAR_PX));
  });
  protected readonly visibleChartProjects = computed(() => this.chartProjects().slice(0, this.maxChartBars()));
  protected readonly hiddenChartProjectCount = computed(
    () => this.chartProjects().length - this.visibleChartProjects().length
  );
  protected readonly visibleOverdue = computed(() => (this.store.data()?.overdueTasks ?? []).slice(0, this.effectiveBudget()));
  protected readonly hiddenOverdueCount = computed(() =>
    Math.max(0, (this.store.data()?.overdueTotal ?? 0) - this.visibleOverdue().length)
  );
  /** Maximum layout list columns: the project chart and overdue tasks (when there are any). */
  protected readonly maximumPanelCount = computed(() => 1 + Number((this.store.data()?.overdueTotal ?? 0) > 0));

  ngOnInit(): void {
    this.feed.start();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.observeSize();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopObservingSize();
    });
  }

  setPeriod(period: LedProgressPeriod): void {
    if (period !== 'all' && period !== 'month' && period !== 'week') return;
    if (period === this.period()) return;
    this.periodFailed.set(false);
    this.period.set(period);
    storePeriod(period);
  }

  retryPeriod(event?: Event): void {
    event?.stopPropagation();
    const period = this.period();
    const data = this.store.data();
    if (period === 'all' || !data) return;
    this.periodFailed.set(false);
    this.periodRequested.set(period, data);
    this.fetchPeriod(period, data);
  }

  private fetchPeriod(period: DatedPeriod, data: LedWorkProgressResponse): void {
    this.detailApi
      .getPeriodProgress(period)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payload) => {
          this.periodCache.update((cache) => ({ ...cache, [period]: { payload, for: data } }));
          if (this.period() === period) this.periodFailed.set(false);
        },
        error: () => {
          this.periodRequested.delete(period);
          if (this.period() === period) this.periodFailed.set(true);
        }
      });
  }

  /** Layout follows the host's rendered size; a resize only changes signals, never the data. */
  private observeSize(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1]?.contentRect;
      if (!rect) return;
      this.pendingSize = { width: rect.width, height: rect.height };
      if (typeof requestAnimationFrame !== 'function') {
        this.applySize();
        return;
      }
      if (this.frameId !== null) return;
      this.frameId = requestAnimationFrame(() => {
        this.frameId = null;
        this.applySize();
      });
    });
    this.resizeObserver.observe(this.host.nativeElement);
  }

  private applySize(): void {
    const size = this.pendingSize;
    if (!size) return;
    this.pendingSize = null;
    const mode = resolveTeamProgressMode(size.width, size.height, this.mode());
    if (mode !== this.mode()) this.mode.set(mode);
    const widthStep = Math.floor(size.width / 100) * 100;
    if (widthStep !== this.widthStep()) this.widthStep.set(widthStep);
    if (!(size.height > 0)) return;
    this.size.set({ width: size.width, height: size.height });
  }

  private stopObservingSize(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.frameId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.feed.reload();
    }
  }

  retry(): void {
    this.feed.reload();
  }


  /** Expand, "View all", "+N more" and a click anywhere on a loaded card open the detail dialog. */
  openDetail(event?: Event): void {
    event?.stopPropagation();
    if (!this.store.data()) return;
    this.detailSection.set(null);
    this.detailOpen.set(true);
  }

  /** A summary card: open the popup at the section it summarises. */
  openSection(section: string): void {
    if (!this.store.data()) return;
    this.detailSection.set(section);
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.detailSection.set(null);
  }


  openOverdueTask(task: LedOverdueTask, event?: Event): void {
    event?.stopPropagation();
    void this.router.navigate(['/work', task.projectId, 'milestones', task.objectiveId, 'board'], {
      queryParams: { highlightTaskId: task.taskId }
    });
  }

  assigneeNames(task: LedOverdueTask): string {
    return task.assignees.map((a) => a.displayName).join(', ');
  }
}

/** The summary cards whose popup section a taller view already shows as its own section. */
function shownProgressCards(mode: TeamProgressMode, plan: TeamProgressPlan, overdue: boolean): ReadonlySet<string> {
  const shown = new Set<string>();
  if (WEEKLY_MODES.has(mode)) shown.add('tp-weekly');
  if (plan.listRows > 0) {
    shown.add('tp-projects');
    if (overdue) shown.add('tp-overdue');
  }
  if (mode === 'large' || mode === 'maximum') shown.add('tp-behind');
  return shown;
}

function samePlan(a: TeamProgressPlan, b: TeamProgressPlan): boolean {
  return (
    a.miniLegend === b.miniLegend &&
    a.miniFigure === b.miniFigure &&
    a.legend === b.legend &&
    a.tileRows === b.tileRows &&
    a.viewDetails === b.viewDetails &&
    a.listRows === b.listRows &&
    a.weeklyFallbackRows === b.weeklyFallbackRows &&
    a.timeBand === b.timeBand &&
    a.timeCallout === b.timeCallout &&
    a.workloadRows === b.workloadRows
  );
}

/** Percentages are taken against the allocation, or the task estimates when nothing is allocated. */
function completionBase(hours: LedHourTotals): number {
  return hours.allocatedHours > 0 ? hours.allocatedHours : hours.completedHours + hours.inProgressHours + hours.notStartedHours;
}

function statusRow(status: (typeof PROGRESS_STATUSES)[number], value: number, base: number): StatusRow {
  return {
    key: status.key,
    label: status.label,
    color: status.color,
    bgClass: status.bgClass,
    hours: value,
    hoursText: formatHourValue(value),
    percentText: formatPercent(value, base),
    percentValue: Math.min(100, percentOf(value, base)),
    percentRounded: Math.round(Math.min(100, percentOf(value, base))),
    testId: LEGEND_TEST_IDS[status.key],
    tone: TONE_BY_STATUS[status.key]
  };
}

export function buildStatusRows(hours: LedHourTotals): StatusRow[] {
  const base = completionBase(hours);
  return PROGRESS_STATUSES.map((status) => statusRow(status, HOURS_BY_KEY[status.key](hours), base));
}

/** A dated period's three task states, each a share of the hours due in it. */
export function buildPeriodStatusRows(p: LedPeriodProgress): StatusRow[] {
  return PROGRESS_STATUSES.filter((s) => s.key !== 'untasked').map((status) =>
    statusRow(status, PERIOD_HOURS_BY_KEY[status.key as TaskStatusKey](p), p.totalHours)
  );
}
