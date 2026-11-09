import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EmployeeForecastItem } from '../../models/team-employee-forecast.model';
import {
  FORECAST_COLORS,
  FORECAST_STATUS_META,
  forecastHoursText,
  rateText,
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

/**
 * Employee overtime forecast: each person's task rate over the last 4 weeks beside the rate they need to finish their
 * open tasks before the deadline (a `pair` stack, in percent). A required rate over 100% is drawn red: it can't fit in
 * normal hours. People who need overtime get the alert border. Drawn by the shared dashboard bar chart.
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
      [legend]="legend"
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
  readonly compactHeadline = input(true);
  readonly variant = input<DashboardBarVariant>('earnings');

  protected readonly legend: DashboardBarLegendItem[] = [
    { label: 'Task rate', color: FORECAST_COLORS.covered },
    { label: 'Required', color: FORECAST_COLORS.raise },
    { label: 'Required > 100%', color: FORECAST_COLORS.overtime },
  ];

  private readonly shown = computed(() => rateChartPeople(this.items(), this.limit()));

  protected readonly bars = computed<DashboardBar[]>(() =>
    this.shown().map((e) => ({
      key: e.employeeId,
      label: shortBarLabel(e.name.split(' ')[0] ?? e.name, 8),
      title: e.name,
      valueText: `${rateText(e.conversionRate)} rate`,
      chip: `needs ${rateText(e.requiredRate)}`,
      sub:
        e.overtimeHours > 0
          ? `~${forecastHoursText(e.overtimeHours)} overtime`
          : FORECAST_STATUS_META[e.status].label,
      segments: [{ key: 'rate', value: percent(e.conversionRate), color: FORECAST_COLORS.covered }],
      pair: [
        {
          key: 'required',
          value: percent(e.requiredRate),
          color:
            e.requiredRate !== null && e.requiredRate > 1
              ? FORECAST_COLORS.overtime
              : FORECAST_COLORS.raise,
        },
      ],
      alert:
        e.status === 'overtime'
          ? `Needs ~${forecastHoursText(e.overtimeHours)} overtime`
          : undefined,
      tooltip: `${e.name}: task rate ${rateText(e.conversionRate)}, needs ${rateText(e.requiredRate)}`,
    })),
  );

  protected readonly headline = computed<DashboardBarHeadline | null>(() => {
    if (!this.heading()) return null;
    return {
      label: this.heading(),
      value: `${rateText(this.teamRate())} team rate`,
      hint: "Each person's task rate over the last 4 weeks beside the rate needed to finish before their deadline",
      sub:
        this.variant() === 'orders'
          ? `${this.shown().length} people with the most overtime`
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
