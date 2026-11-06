import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, linkedSignal, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';
import { KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { WidgetCardComponent, WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import { WeeklyWorkProgressApiService } from '../../data-access/weekly-work-progress-api.service';
import { WeekProgress, WeeklyWorkProgressResponse } from '../../models/weekly-work-progress.model';
import { DailyWorkChartComponent } from '../../ui/daily-work-chart/daily-work-chart.component';
import { dashboardDonutPx } from '../../utils/dashboard-donut.util';
import { DashboardDonutComponent, DashboardDonutSlice } from '../../ui/dashboard-donut/dashboard-donut.component';
import { injectHostSize } from '../../utils/host-size.util';
import { progressDeltaPoints } from '../../utils/weekly-work-progress-insights.util';
import {
  WEEKLY_PROGRESS_CARD_CHROME,
  WeeklyProgressView,
  planWeeklyProgressSections,
  resolveWeeklyProgressView
} from '../../utils/weekly-work-progress-layout.util';
import {
  WEEKLY_STATUS_LABELS,
  WeeklyDelta,
  changeAgainst,
  deltaOf,
  formatWeekHours,
  mondayBefore,
  weeklyTiles
} from '../../utils/weekly-work-progress-format.util';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';
import { WeeklyWorkProgressDetailDialogComponent } from '../weekly-work-progress-detail-dialog/weekly-work-progress-detail-dialog.component';

/**
 * My Work "Weekly Work Progress". One card whose layout follows its own rendered size (the dashboard widget
 * standard): a 2x2 card shows the fixed-size donut; a wide 2-row card the figure beside this week / last week bars
 * (and tiles once wide enough); a narrow tall card stacks the tiles under the donut; a large card adds the Daily Work
 * vs Schedule chart and then the weekly comparison. Data comes from the dashboard bootstrap; the card only calls the
 * API outside a dashboard, when the bootstrap had none, or for last week.
 */
@Component({
  selector: 'app-weekly-progress-card',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    DashboardDonutComponent,
    WidgetCardComponent,
    PopoutHeaderActionsComponent,
    KpiTilesComponent,
    DailyWorkChartComponent,
    KeyboardClickDirective,
    StopClickPropagationDirective,
    WeeklyWorkProgressDetailDialogComponent
  ],
  templateUrl: './weekly-progress-card.component.html',
  styleUrl: './weekly-progress-card.component.css',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyProgressCardComponent implements OnInit {
  private readonly api = inject(WeeklyWorkProgressApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly size = injectHostSize();
  private readonly feed = injectWidgetDataFeed<WeeklyWorkProgressResponse>({
    apply: (data) => this.apply(data),
    fetch: () => this.fetch(),
    refreshing: () => this.loading.set(true)
  });

  protected readonly current = signal<WeeklyWorkProgressResponse | null>(null);
  private readonly previous = signal<WeeklyWorkProgressResponse | null>(null);
  private readonly failed = signal(false);
  protected readonly loading = signal(false);
  protected readonly selectedWeek = signal<'this' | 'last'>('this');
  readonly detailOpen = signal(false);

  /** The view for the card's current size, keeping the previous one inside the hysteresis band; 'standard' until the
   * first measurement. Derived (not set from an effect) so a resize re-renders the card straight away. */
  readonly view = linkedSignal<{ width: number; height: number }, WeeklyProgressView>({
    source: this.size,
    computation: (size, previous) => resolveWeeklyProgressView(size.width, size.height, previous?.value ?? null)
  });
  protected readonly sections = computed(() => {
    const { width, height } = this.size();
    return planWeeklyProgressSections(
      this.view(),
      width - WEEKLY_PROGRESS_CARD_CHROME.width,
      height - WEEKLY_PROGRESS_CARD_CHROME.height
    );
  });

  /** Full size, or the mini size in the 2x2 view. */
  protected readonly donutPx = computed(() => dashboardDonutPx(this.view()));
  protected readonly statusLabels = WEEKLY_STATUS_LABELS;
  protected readonly formatMinutes = formatWeekHours;

  /** The week on show: this week, or last week once picked and loaded. */
  protected readonly shown = computed(() => (this.selectedWeek() === 'last' ? this.previous() : this.current()));

  protected readonly widgetState = computed<WidgetState>(() => {
    if (this.shown()) return 'ready';
    return this.failed() ? 'error' : 'loading';
  });

  protected readonly refreshing = computed(() => this.loading() && !!this.shown());

  protected readonly tiles = computed(() => {
    const data = this.shown();
    return data ? weeklyTiles(data.thisWeek, data.plannerEnabled) : [];
  });

  /** mini-wide: three tiles beside the bars (Expected, Scheduled or Remaining without the planner, Worked). */
  protected readonly miniTiles = computed(() => this.tiles().filter((t) => t.key !== 'remaining').slice(0, 3));

  protected readonly stackedTiles = computed(() => this.tiles().slice(0, this.sections().stackedTiles));

  protected readonly delta = computed<WeeklyDelta | null>(() => {
    const data = this.shown();
    const points = data ? progressDeltaPoints(data) : null;
    if (points === null) return null;
    return deltaOf(Math.round(points));
  });

  protected readonly workedChange = computed(() => {
    const data = this.shown();
    return data ? changeAgainst(data.thisWeek.workedMinutes, data.lastWeek.workedMinutes) : null;
  });

  protected readonly scheduledChange = computed(() => {
    const data = this.shown();
    return data ? changeAgainst(data.thisWeek.scheduledMinutes, data.lastWeek.scheduledMinutes) : null;
  });

  /** Arc length of the progress ring out of 100; a week at or past its target closes the ring. */
  protected readonly ring = computed(() => Math.min(100, Math.max(0, this.shown()?.thisWeek.progressPercent ?? 0)));

  /** The ring as the shared donut's two slices: worked, then what is left of the week's expected hours. */
  protected readonly ringSlices = computed<DashboardDonutSlice[]>(() => {
    const week = this.shown()?.thisWeek;
    if (!week) return [];
    const ring = this.ring();
    const left = Math.max(0, week.expectedMinutes - week.workedMinutes);
    return [
      { key: 'worked', label: 'Worked', value: week.workedMinutes, valueText: formatWeekHours(week.workedMinutes), percentText: `${Math.round(ring)}%`, color: 'var(--color-cat-blue)' },
      { key: 'left', label: 'Left', value: left, valueText: formatWeekHours(left), percentText: `${Math.round(100 - ring)}%`, color: 'transparent' }
    ];
  });
  protected readonly ringLabel = computed(() => {
    const week = this.shown()?.thisWeek;
    return week ? `This week: ${formatWeekHours(week.workedMinutes)} worked of ${formatWeekHours(week.expectedMinutes)} expected` : '';
  });
  /** The slice the ring lights while hovered. */
  protected readonly hovered = signal<string | null>(null);

  protected readonly weekSelectShown = computed(() => {
    const view = this.view();
    return view === 'standard' || (view === 'mini-wide' && this.sections().miniTiles);
  });

  private readonly visibilityHandler = (): void => this.onVisibilityChange();

  ngOnInit(): void {
    this.feed.start();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    });
  }

  protected percentText(week: WeekProgress): string {
    return `${Math.round(week.progressPercent)}%`;
  }

  protected barWidth(week: WeekProgress): number {
    return Math.min(100, Math.max(0, week.progressPercent));
  }

  onWeekSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value === 'last' ? 'last' : 'this';
    this.selectedWeek.set(value);
    if (value === 'last' && !this.previous()) this.loadLastWeek();
  }

  retry(): void {
    this.failed.set(false);
    if (this.selectedWeek() === 'last') this.loadLastWeek();
    else this.feed.reload();
  }

  openDetail(): void {
    this.detailOpen.set(true);
  }

  private apply(data: WeeklyWorkProgressResponse): void {
    this.current.set(data);
    this.failed.set(false);
    this.loading.set(false);
  }

  private fetch(): void {
    this.loading.set(true);
    this.api
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.apply(data),
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        }
      });
  }

  private loadLastWeek(): void {
    const data = this.current();
    if (!data) return;
    this.loading.set(true);
    this.api
      .get(mondayBefore(data.weekStart))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (week) => {
          this.previous.set(week);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        }
      });
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.feed.reload();
    }
  }
}
