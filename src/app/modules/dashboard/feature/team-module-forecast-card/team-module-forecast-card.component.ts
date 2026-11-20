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
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import {
  WidgetCardComponent,
  WidgetState,
} from '../../../../shared/ui/widget-card/widget-card.component';
import { SummaryCardModel } from '../../models/summary-card.model';
import {
  ModuleForecastItem,
  ModuleForecastResponse,
  ModuleForecastTotals,
} from '../../models/team-module-forecast.model';
import { TeamModuleForecastStore } from '../../state/team-module-forecast.store';
import {
  DashboardDonutComponent,
  DashboardDonutSlice,
} from '../../../../shared/ui/charts/dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../../../../shared/ui/charts/dashboard-donut/donut-key.component';
import { DashboardSummaryRowComponent } from '../../ui/dashboard-summary-row/dashboard-summary-row.component';
import { DashboardSummaryStripComponent } from '../../ui/dashboard-summary-strip/dashboard-summary-strip.component';
import { ModuleForecastProjectChartComponent } from '../../ui/module-forecast-project-chart/module-forecast-project-chart.component';
import { dashboardDonutPx } from '../../../../shared/ui/charts/utils/dashboard-donut.util';
import {
  FORECAST_STATUS_META,
  ForecastTileRow,
  forecastDonutLabel,
  forecastHeroCaption,
  forecastHeroSub,
  forecastHeroText,
  forecastSlices,
  overtimeChipText,
  rateBarPercent,
  rateText,
  windowLabel,
} from '../../utils/overtime-forecast-format.util';
import { FORECAST_CARD_CHROME, sameForecastPlan } from '../../utils/overtime-forecast-layout.util';
import { chartFit } from '../../ui/module-forecast-project-chart/module-forecast-project-chart.component';
import { summaryRowCount, withSummaryRow } from '../../utils/summary-row.util';
import {
  moduleForecastTiles,
  moduleRowRateText,
  modulesAtRisk,
} from '../../utils/team-module-forecast-format.util';
import {
  EMPTY_MODULE_FORECAST_PLAN,
  MODULE_FORECAST_CARD_CHROME,
  MODULE_FORECAST_HERO_LEGEND_WIDTH_PX,
  MODULE_FORECAST_NARROW_BODY_PX,
  ModuleForecastPlan,
  ModuleForecastView,
  planModuleForecastLayout,
  resolveModuleForecastView,
  shownModuleForecastCards,
} from '../../utils/team-module-forecast-layout.util';
import { teamModuleForecastSummaryCards } from '../../utils/team-module-forecast-summary-cards.util';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';
import { TeamModuleForecastDetailDialogComponent } from '../team-module-forecast-detail-dialog/team-module-forecast-detail-dialog.component';
import { injectHostSize } from '../../utils/host-size.util';

/**
 * My Team "Module overtime forecast" (design 2026-11-08). Predicts, from the team's task rate over the last 4 weeks,
 * whether the open modules can finish their remaining hours before their deadlines, need a higher rate, or need
 * overtime. The layout comes from the card's own rendered size: a 2-row card shows the shared summary strip; taller
 * cards keep the donut and add KPI tiles, the project chart and the modules-at-risk ranking. The popup has the full
 * module table.
 */
@Component({
  selector: 'app-team-module-forecast-card',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    WidgetCardComponent,
    PopoutHeaderActionsComponent,
    DashboardDonutComponent,
    DonutKeyComponent,
    DashboardSummaryStripComponent,
    DashboardSummaryRowComponent,
    ModuleForecastProjectChartComponent,
    TeamModuleForecastDetailDialogComponent,
  ],
  templateUrl: './team-module-forecast-card.component.html',
  styleUrl: './team-module-forecast-card.component.css',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamModuleForecastCardComponent implements OnInit {
  protected readonly store = inject(TeamModuleForecastStore);
  private readonly feed = injectWidgetDataFeed<ModuleForecastResponse>({
    apply: (data) => this.store.seed(data),
    fetch: () => this.store.load(),
    refreshing: () => this.store.markLoading(),
  });
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostSize = injectHostSize();

  private readonly visibilityHandler = (): void => this.onVisibilityChange();
  private measured = false;

  readonly view = signal<ModuleForecastView>('standard');
  private readonly size = signal<{ width: number; height: number } | null>(null);
  readonly heroLegend = signal(false);
  readonly detailOpen = signal(false);
  readonly detailSection = signal<string | null>(null);

  /** How many rows the ranking has to show (the plan gives the chart any height it can't use). */
  private readonly atRiskCount = computed(
    () => modulesAtRisk(this.store.data()?.items ?? []).length,
  );

  protected readonly summaryCards = computed<SummaryCardModel[]>(() => {
    const data = this.store.data();
    return data ? teamModuleForecastSummaryCards(data) : [];
  });

  /** The sections at the current size; a taller view swaps the tiles for two summary cards it is not showing. */
  private readonly layout = computed(() => {
    const size = this.size();
    const view = this.view();
    if (!size) return { plan: EMPTY_MODULE_FORECAST_PLAN, cards: [] as SummaryCardModel[] };
    return withSummaryRow(
      (rowPx) => planModuleForecastLayout(view, size.width, size.height, rowPx, this.atRiskCount()),
      this.summaryCards(),
      (plan) => shownModuleForecastCards(view, plan),
      summaryRowCount(size.width - MODULE_FORECAST_CARD_CHROME.width),
    );
  });
  readonly plan = computed<ModuleForecastPlan>(() => this.layout().plan, {
    equal: sameForecastPlan,
  });
  protected readonly rowCards = computed(() => this.layout().cards);

  protected readonly donutPx = computed(() => dashboardDonutPx(this.view()));
  /** The card body's width. */
  private readonly bodyWidth = computed(
    () => (this.size()?.width ?? 0) - FORECAST_CARD_CHROME.width,
  );
  /** A narrow body (under 360px): the chart's title and figure on two lines, fewer and wider bars. */
  protected readonly narrowChart = computed(
    () => this.bodyWidth() > 0 && this.bodyWidth() < MODULE_FORECAST_NARROW_BODY_PX,
  );
  /**
   * How many bars the card's chart shows and how long their labels can be (the hero chart is never narrow). A narrow
   * chart has no axis, so its bars get the full body width.
   */
  protected readonly chartFit = computed(() => {
    const width = this.bodyWidth();
    if (!(width > 0) || this.plan().heroChart) return chartFit(480);
    return this.narrowChart() ? chartFit(width, 64, 8, 0) : chartFit(width);
  });
  protected readonly rate = rateText;
  protected readonly statusMeta = FORECAST_STATUS_META;
  protected readonly chip = overtimeChipText;
  protected readonly rowRate = (m: ModuleForecastItem, t: ModuleForecastTotals): string =>
    moduleRowRateText(m, t, true);
  protected readonly bar = rateBarPercent;

  protected readonly widgetState = computed<WidgetState>(() => {
    const data = this.store.data();
    if (!data) return this.store.error() ? 'error' : 'loading';
    return data.totals.modules === 0 ? 'empty' : 'ready';
  });

  protected readonly refreshing = computed(() => this.store.loading() && !!this.store.data());

  protected readonly donutSlices = computed<DashboardDonutSlice[]>(() => {
    const t = this.store.data()?.totals;
    return t ? forecastSlices(t, t.maxTaskRate) : [];
  });

  protected readonly hovered = signal<string | null>(null);

  protected readonly donutLabel = computed(() =>
    forecastDonutLabel(this.store.data()?.totals.teamRate ?? null, this.donutSlices()),
  );

  protected readonly hero = computed(() =>
    forecastHeroText(this.store.data()?.totals.overtimeHours ?? 0),
  );

  protected readonly heroSub = computed(() =>
    forecastHeroSub(this.store.data()?.totals.overtimeHours ?? 0),
  );

  protected readonly caption = computed(() => {
    const t = this.store.data()?.totals;
    return t ? forecastHeroCaption(t.teamRate, t.requiredRate) : '';
  });

  protected readonly window = computed(() => {
    const data = this.store.data();
    return data ? `Rate from ${windowLabel(data.windowStart, data.windowEnd)}` : '';
  });

  protected readonly tiles = computed<ForecastTileRow[]>(() => {
    const t = this.store.data()?.totals;
    return t ? moduleForecastTiles(t) : [];
  });

  protected readonly ranking = computed(() =>
    modulesAtRisk(this.store.data()?.items ?? []).slice(0, this.plan().rankingRows),
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
    const view = resolveModuleForecastView(
      size.width,
      size.height,
      this.measured ? this.view() : null,
    );
    if (size.width > 0 && size.height > 0) this.measured = true;
    if (view !== this.view()) this.view.set(view);
    this.size.set({ width: size.width, height: size.height });
    this.heroLegend.set(
      size.width - MODULE_FORECAST_CARD_CHROME.width >= MODULE_FORECAST_HERO_LEGEND_WIDTH_PX,
    );
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') this.feed.reload();
  }
}
