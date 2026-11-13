import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmployeeForecastItem } from '../../models/team-employee-forecast.model';
import {
  DEFAULT_MAX_TASK_RATE,
  FORECAST_COLORS,
  FORECAST_STATUS_META,
  OVERLOAD_BADGE_TEXT,
  rateText,
  shortHoursText,
} from '../../utils/overtime-forecast-format.util';
import {
  DashboardBar,
  DashboardBarChartComponent,
  DashboardBarHeadline,
  DashboardBarLegendItem,
  DashboardBarVariant,
} from '../dashboard-bar-chart/dashboard-bar-chart.component';
import { shortBarLabel } from '../module-forecast-project-chart/module-forecast-project-chart.component';

/** The people the chart draws: the most overtime first, then the highest required rate. */
export function rateChartPeople(
  items: readonly EmployeeForecastItem[],
  limit: number,
): EmployeeForecastItem[] {
  return [...items]
    .sort(
      (a, b) =>
        b.overtimeHours - a.overtimeHours ||
        (b.requiredRate ?? 0) - (a.requiredRate ?? 0) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

const percent = (rate: number | null): number => (rate === null ? 0 : Math.round(rate * 1000) / 10);

/** The highest rate the chart plots: a required 853% would flatten every task-rate bar. Taller ones are drawn at the
 * cap; the hover reads the real figure. No badges over the bars: the red required bar already says overload. */
export const RATE_CHART_CAP_PERCENT = 200;

/**
 * Employee overtime forecast: each person's task rate over the last 4 weeks beside the rate they need to finish their
 * open tasks before the deadline (a `pair` stack, in percent). A required rate over 100% is drawn red: it can't fit in
 * normal hours. No badges or frames on the bars; the hover has the details. Drawn by the shared dashboard bar chart.
 */
@Component({
  selector: 'app-employee-forecast-rate-chart',
  standalone: true,
  imports: [DashboardBarChartComponent],
  template: `
    <app-dashboard-bar-chart
      class="min-h-0 flex-1"
      data-testid="employee-forecast-rate-chart"
      axisSuffix="%"
      emptyText="No task rates yet"
      [bars]="bars()"
      [headline]="headline()"
      [compactHeadline]="compactHeadline()"
      [legend]="legend()"
      [variant]="variant()"
      [ariaLabel]="summary()"
    />
  `,
  host: { class: 'flex min-h-0 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeForecastRateChartComponent {
  readonly items = input.required<readonly EmployeeForecastItem[]>();
  /** The team's pooled rate, for the resting headline. */
  readonly teamRate = input<number | null>(null);
  readonly heading = input('');
  readonly limit = input(8);
  /** The longest bar label (characters); the full name is in the hover. */
  readonly labelChars = input(8);
  readonly compactHeadline = input(true);
  readonly variant = input<DashboardBarVariant>('earnings');
  /** The realistic task-rate limit, drawn as the target dash on every bar; a required rate above it is overload. */
  readonly maxTaskRate = input(DEFAULT_MAX_TASK_RATE);

  protected readonly legend = computed<DashboardBarLegendItem[]>(() => [
    { label: 'Task rate', color: FORECAST_COLORS.covered },
    { label: 'Required', color: FORECAST_COLORS.raise },
    { label: 'Overload', color: FORECAST_COLORS.overload },
    {
      label: `${rateText(this.maxTaskRate())} limit`,
      color: 'var(--color-text-secondary)',
      marker: true,
    },
  ]);

  private readonly shown = computed(() => rateChartPeople(this.items(), this.limit()));

  protected readonly bars = computed<DashboardBar[]>(() => {
    const limit = this.maxTaskRate();
    return this.shown().map((e) => ({
      key: e.employeeId,
      label: shortBarLabel(e.name.split(' ')[0] ?? e.name, this.labelChars()),
      title: e.name,
      valueText: `${rateText(e.conversionRate)} rate`,
      chip:
        e.status === 'overload'
          ? `${OVERLOAD_BADGE_TEXT} · needs ${rateText(e.requiredRate)}`
          : `needs ${rateText(e.requiredRate)}`,
      sub:
        e.overtimeHours > 0
          ? `${shortHoursText(e.overtimeHours)} won't fit at today's rate`
          : FORECAST_STATUS_META[e.status].label,
      segments: [
        {
          key: 'rate',
          value: Math.min(RATE_CHART_CAP_PERCENT, percent(e.conversionRate)),
          color: FORECAST_COLORS.covered,
        },
      ],
      pair: [
        {
          key: 'required',
          value: Math.min(RATE_CHART_CAP_PERCENT, percent(e.requiredRate)),
          color:
            e.requiredRate !== null && e.requiredRate > limit
              ? FORECAST_COLORS.overload
              : FORECAST_COLORS.raise,
        },
      ],
      marker: Math.min(RATE_CHART_CAP_PERCENT, percent(limit)),
      tooltip: `${e.name}: task rate ${rateText(e.conversionRate)}, needs ${rateText(e.requiredRate)}${e.status === 'overload' ? ' (overload)' : ''}`,
    }));
  });

  protected readonly headline = computed<DashboardBarHeadline | null>(() => {
    if (!this.heading()) return null;
    return {
      label: this.heading(),
      value: `${rateText(this.teamRate())} team rate`,
      hint: "Each person's task rate over the last 4 weeks beside the rate needed to finish before their deadline",
      sub:
        this.variant() === 'orders'
          ? `${this.shown().length} people with the most hours that won't fit`
          : undefined,
    };
  });

  protected readonly summary = computed(
    () =>
      'Task rate against required rate by person. ' +
      this.shown()
        .map(
          (e) => `${e.name}: ${rateText(e.conversionRate)} rate, needs ${rateText(e.requiredRate)}`,
        )
        .join('; '),
  );
}
