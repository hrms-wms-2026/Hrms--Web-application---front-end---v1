import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import {
  WidgetCardComponent,
  WidgetState,
} from '../../../../shared/ui/widget-card/widget-card.component';
import { TeamWorkTaskHoursResponse, TeamWorkTaskPeriod } from '../../models/team-work-task.model';
import { TeamWorkTaskStore } from '../../state/team-work-task.store';
import { WorkTaskDayChartComponent } from '../../ui/work-task-day-chart/work-task-day-chart.component';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { DonutArc, donutArcs } from '../../utils/status-donut.util';
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
  TEAM_WORK_TASK_BREAKPOINTS,
  TEAM_WORK_TASK_CARD_CHROME,
  TEAM_WORK_TASK_HERO_LEGEND_WIDTH_PX,
  TeamWorkTaskPlan,
  TeamWorkTaskView,
  planTeamWorkTaskLayout,
  resolveTeamWorkTaskView,
} from '../../utils/team-work-task-layout.util';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';
import { TeamWorkTaskDetailDialogComponent } from '../team-work-task-detail-dialog/team-work-task-detail-dialog.component';

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
@Component({
  selector: 'app-team-work-task-card',
  standalone: true,
  imports: [
    StopClickPropagationDirective,
    NgTemplateOutlet,
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly visibilityHandler = (): void => this.onVisibilityChange();
  private resizeObserver: ResizeObserver | null = null;
  private frameId: number | null = null;
  private pendingSize: { width: number; height: number } | null = null;
  private measured = false;

  readonly view = signal<TeamWorkTaskView>('standard');
  readonly plan = signal<TeamWorkTaskPlan>(EMPTY_TEAM_WORK_TASK_PLAN);
  readonly heroLegend = signal(false);
  readonly miniBar = signal(false);
  readonly miniFigure = signal(false);
  readonly detailOpen = signal(false);

  protected readonly donutPx = DASHBOARD_DONUT_PX;
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
        color: '#8b5cf6',
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

  ngOnInit(): void {
    this.feed.start();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.observeSize();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopObservingSize();
    });
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  /** Bar width for a utilization: capped at 100% of the track. */
  protected barWidth(value: number | null): number {
    return value === null ? 0 : Math.min(100, Math.max(0, value));
  }

  onPeriodSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'day' || value === 'week' || value === 'month')
      this.store.setPeriod(value as TeamWorkTaskPeriod);
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
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
  }

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

  /** Public so a spec can drive a size without a ResizeObserver. */
  applySize(size: { width: number; height: number } | null = this.pendingSize): void {
    if (!size) return;
    this.pendingSize = null;
    const view = resolveTeamWorkTaskView(
      size.width,
      size.height,
      this.measured ? this.view() : null,
    );
    if (size.width > 0 && size.height > 0) this.measured = true;
    if (view !== this.view()) this.view.set(view);
    const plan = planTeamWorkTaskLayout(view, size.width, size.height);
    const current = this.plan();
    if (
      plan.heroTrend !== current.heroTrend ||
      plan.legend !== current.legend ||
      plan.figure !== current.figure ||
      plan.tiles !== current.tiles ||
      plan.tileColumns !== current.tileColumns ||
      plan.trend !== current.trend ||
      plan.rankingRows !== current.rankingRows
    ) {
      this.plan.set(plan);
    }
    this.heroLegend.set(
      size.width - TEAM_WORK_TASK_CARD_CHROME.width >= TEAM_WORK_TASK_HERO_LEGEND_WIDTH_PX,
    );
    this.miniBar.set(size.width >= TEAM_WORK_TASK_BREAKPOINTS.miniBarWidth);
    this.miniFigure.set(size.width >= TEAM_WORK_TASK_BREAKPOINTS.miniFigureWidth);
  }

  private stopObservingSize(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.frameId !== null && typeof cancelAnimationFrame === 'function')
      cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.feed.reload();
    }
  }
}
