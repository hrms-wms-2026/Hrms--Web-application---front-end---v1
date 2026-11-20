import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import {
  WidgetCardComponent,
  WidgetState,
} from '../../../../shared/ui/widget-card/widget-card.component';
import { TeamWorkTaskHoursResponse } from '../../models/team-work-task.model';
import { TeamWorkTaskStore } from '../../state/team-work-task.store';
import { WorkTaskDayChartComponent } from '../../ui/work-task-day-chart/work-task-day-chart.component';
import { dashboardDonutPx } from '../../../../shared/ui/charts/utils/dashboard-donut.util';
import { DashboardDonutComponent, DashboardDonutSlice } from '../../../../shared/ui/charts/dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../../../../shared/ui/charts/dashboard-donut/donut-key.component';
import { DashboardSummaryStripComponent } from '../../ui/dashboard-summary-strip/dashboard-summary-strip.component';
import { DashboardSummaryRowComponent } from '../../ui/dashboard-summary-row/dashboard-summary-row.component';
import { summaryRowCount, withSummaryRow } from '../../utils/summary-row.util';
import { SummaryCardModel } from '../../models/summary-card.model';
import { teamWorkTaskSummaryCards } from '../../utils/team-work-task-summary-cards.util';
import { DonutArc, donutArcs } from '../../../../shared/ui/charts/utils/status-donut.util';
import {
  TEAM_WORK_TASK_COLORS,
  compactHoursText,
  hoursText,
  teamWorkTaskCaption,
  teamWorkTaskDelta,
  teamWorkTaskRangeLabel,
  teamWorkTaskSlices,
  utilizationText,
} from '../../utils/team-work-task-format.util';
import {
  EMPTY_TEAM_WORK_TASK_PLAN,
  TEAM_WORK_TASK_CARD_CHROME,
  TEAM_WORK_TASK_HERO_LEGEND_WIDTH_PX,
  TeamWorkTaskPlan,
  TeamWorkTaskView,
  planTeamWorkTaskLayout,
  resolveTeamWorkTaskView,
} from '../../utils/team-work-task-layout.util';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';
import { TeamWorkTaskDetailDialogComponent } from '../team-work-task-detail-dialog/team-work-task-detail-dialog.component';
import { injectHostSize } from '../../utils/host-size.util';

interface KpiTileRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  /** The exact figure, as the tile's tooltip (the tile itself may show a rounded value). */
  readonly title: string;
  readonly color: string;
}

/**
 * My Team "Work vs task hours". Compares the team's attendance working time (clocked time less breaks) with the
 * estimated hours of the tasks they completed, for a day, week or month. One card whose layout comes from its own
 * rendered size, like Team attendance: a 2-row card shows the donut (or, wide, a stacked bar); taller cards keep the
 * donut in place and add KPI tiles, then the daily work-vs-task chart, then the employee ranking. The expand button
 * opens the popup with the full table. The period and ‹ › navigation live in the store, so a resize or the dialog
 * never resets them.
 */
/** The summary cards whose popup section a taller view already shows as its own section. */
function shownWorkTaskCards(view: string, plan: TeamWorkTaskPlan): ReadonlySet<string> {
  const shown = new Set<string>();
  if (view === 'standard' || plan.figure) shown.add('wt-share');
  if (plan.trend || plan.heroTrend) shown.add('wt-days');
  if (plan.rankingRows > 0) shown.add('wt-gap');
  return shown;
}

function samePlan(a: TeamWorkTaskPlan, b: TeamWorkTaskPlan): boolean {
  return (
    a.heroTrend === b.heroTrend &&
    a.legend === b.legend &&
    a.figure === b.figure &&
    a.tiles === b.tiles &&
    a.tileColumns === b.tileColumns &&
    a.trend === b.trend &&
    a.rankingRows === b.rankingRows
  );
}

@Component({
  selector: 'app-team-work-task-card',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    DashboardDonutComponent,
    DonutKeyComponent,
    DashboardSummaryStripComponent,
    DashboardSummaryRowComponent,
    WidgetCardComponent,
    PopoutHeaderActionsComponent,
    AvatarComponent,
    WorkTaskDayChartComponent,
    TeamWorkTaskDetailDialogComponent,
  ],
  templateUrl: './team-work-task-card.component.html',
  styleUrl: './team-work-task-card.component.css',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamWorkTaskCardComponent implements OnInit {
  protected readonly store = inject(TeamWorkTaskStore);
  private readonly feed = injectWidgetDataFeed<TeamWorkTaskHoursResponse>({
    apply: (data) => this.store.seed(data),
    fetch: () => this.store.load(),
    refreshing: () => this.store.markLoading(),
  });
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostSize = injectHostSize();

  private readonly visibilityHandler = (): void => this.onVisibilityChange();
  private measured = false;

  readonly view = signal<TeamWorkTaskView>('standard');
  /** The last measured host size: the layout below follows it and the loaded data. */
  private readonly size = signal<{ width: number; height: number } | null>(null);
  /** The sections at the current size. A taller view puts two summary cards of what it is not already showing in the
   * tiles' place, budgeted at the cards' height; without room or two such cards it keeps the tiles. */
  private readonly layout = computed(() => {
    const size = this.size();
    const view = this.view();
    if (!size) return { plan: EMPTY_TEAM_WORK_TASK_PLAN, cards: [] as SummaryCardModel[] };
    return withSummaryRow(
      (rowPx) => planTeamWorkTaskLayout(view, size.width, size.height, rowPx),
      this.summaryCards(),
      (plan) => shownWorkTaskCards(view, plan),
      summaryRowCount(size.width - TEAM_WORK_TASK_CARD_CHROME.width),
    );
  });
  readonly plan = computed<TeamWorkTaskPlan>(() => this.layout().plan, { equal: samePlan });
  /** Taller views: the summary cards in the tiles' place (empty: the tiles). */
  protected readonly rowCards = computed(() => this.layout().cards);
  readonly heroLegend = signal(false);
  readonly detailOpen = signal(false);
  /** The popup section a summary card asked for (null: the top). */
  readonly detailSection = signal<string | null>(null);
  /** The 2-row strip's cards, all from the response the card already has. */
  protected readonly summaryCards = computed<SummaryCardModel[]>(() => {
    const data = this.store.data();
    return data ? teamWorkTaskSummaryCards(data) : [];
  });

  /** Full size, or the mini size in the 2x2 view. */
  protected readonly donutPx = computed(() => dashboardDonutPx(this.view()));
  protected readonly colors = TEAM_WORK_TASK_COLORS;
  protected readonly hours = hoursText;
  protected readonly util = utilizationText;

  protected readonly widgetState = computed<WidgetState>(() => {
    const data = this.store.data();
    if (!data) return this.store.error() ? 'error' : 'loading';
    return data.teamSize === 0 ? 'empty' : 'ready';
  });

  protected readonly refreshing = computed(() => this.store.loading() && !!this.store.data());

  protected readonly rangeLabel = computed(() => {
    const data = this.store.data();
    return data ? teamWorkTaskRangeLabel(data.period, data.rangeStart, data.rangeEnd) : '';
  });

  protected readonly caption = computed(() =>
    teamWorkTaskCaption(this.store.data()?.period ?? 'week'),
  );

  protected readonly delta = computed(() => {
    const data = this.store.data();
    return data
      ? teamWorkTaskDelta(data.totals.utilization, data.previous.utilization, data.period)
      : null;
  });

  protected readonly slices = computed(() => {
    const data = this.store.data();
    return data ? teamWorkTaskSlices(data.totals) : [];
  });

  protected readonly donut = computed<DonutArc[]>(() =>
    donutArcs(this.slices().map((s) => ({ key: s.key, count: s.minutes, color: s.color }))),
  );

  /** The donut and its key: task, other work and break time, each with its share of the time. */
  protected readonly donutSlices = computed<DashboardDonutSlice[]>(() =>
    this.slices().map((s) => ({
      key: s.key,
      label: s.label,
      value: s.minutes,
      valueText: hoursText(s.minutes),
      percentText: `${s.percent}%`,
      color: s.color,
    })),
  );

  /** The slice the donut lights (hovered there or on a key row). */
  protected readonly hovered = signal<string | null>(null);

  protected readonly donutLabel = computed(() => {
    const data = this.store.data();
    if (!data) return '';
    return (
      `${utilizationText(data.totals.utilization)} of work time went to completed tasks: ` +
      this.slices()
        .map((s) => `${s.label} ${hoursText(s.minutes)}`)
        .join(', ')
    );
  });

  protected readonly tiles = computed<KpiTileRow[]>(() => {
    const t = this.store.data()?.totals;
    if (!t) return [];
    return [
      {
        key: 'worked',
        label: 'Worked',
        value: compactHoursText(t.workedMinutes),
        title: hoursText(t.workedMinutes),
        color: TEAM_WORK_TASK_COLORS.other,
      },
      {
        key: 'task',
        label: 'Task hours',
        value: compactHoursText(t.taskMinutes),
        title: hoursText(t.taskMinutes),
        color: TEAM_WORK_TASK_COLORS.task,
      },
      {
        key: 'break',
        label: 'Break',
        value: compactHoursText(t.breakMinutes),
        title: hoursText(t.breakMinutes),
        color: TEAM_WORK_TASK_COLORS.break,
      },
      {
        key: 'completed',
        label: 'Tasks done',
        value: String(t.completedTasks),
        title: `${t.completedTasks} completed`,
        color: 'var(--color-widget-shade-2b)',
      },
    ];
  });

  protected readonly rankingShown = computed(() =>
    (this.store.data()?.employees ?? []).slice(0, this.plan().rankingRows),
  );

  /** True when nobody clocked or completed anything on any chart day: the chart would be empty. */
  protected readonly emptyTrend = computed(() =>
    (this.store.data()?.trend ?? []).every((p) => p.workedMinutes === 0 && p.taskMinutes === 0),
  );

  constructor() {
    // The host size feeds the layout. 0x0 = not measured yet (never measured under tests, where specs call applySize).
    effect(() => {
      const size = this.hostSize();
      if (size.width === 0 && size.height === 0) return;
      untracked(() => this.applySize(size));
    });
  }

  ngOnInit(): void {
    this.feed.start();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    });
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  /** Bar width for a utilization: capped at 100% of the track. */
  protected barWidth(value: number | null): number {
    return value === null ? 0 : Math.min(100, Math.max(0, value));
  }

  shift(step: -1 | 1, event?: Event): void {
    event?.stopPropagation();
    this.store.shift(step);
  }

  retry(): void {
    this.feed.reload();
  }

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

  /** Public so a spec can drive a size without a ResizeObserver. */
  applySize(size: { width: number; height: number }): void {
    const view = resolveTeamWorkTaskView(
      size.width,
      size.height,
      this.measured ? this.view() : null,
    );
    if (size.width > 0 && size.height > 0) this.measured = true;
    if (view !== this.view()) this.view.set(view);
    this.size.set({ width: size.width, height: size.height });
    this.heroLegend.set(
      size.width - TEAM_WORK_TASK_CARD_CHROME.width >= TEAM_WORK_TASK_HERO_LEGEND_WIDTH_PX,
    );
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.feed.reload();
    }
  }
}
