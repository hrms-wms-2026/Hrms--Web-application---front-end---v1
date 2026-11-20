import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PLANNED_ACTUAL_COLORS, PlannedActualDay, actualOf } from '../../utils/planned-actual-format.util';
import { minutesText } from '../../utils/team-presence-format.util';
import { barDayTitle, barHours, barWeekday } from '../../../../shared/ui/charts/dashboard-bar-chart/bar-chart-dates.util';
import {
  DashboardBar,
  DashboardBarChartComponent,
  DashboardBarHeadline,
  DashboardBarLegendItem
} from '../../../../shared/ui/charts/dashboard-bar-chart/dashboard-bar-chart.component';

/**
 * Planned vs actual by day, drawn by the shared dashboard bar chart: per column a light planned bar beside the actual
 * bar stacked in plan / outside slot / no plan. Today is the running column; future days are planned only. Each day's
 * coverage % is in its hover readout (and tooltip). Team Progress passes week buckets of a month with their own
 * labels. With a `heading`, the headline reads the actual time against the plan until a day is hovered.
 */
@Component({
  selector: 'app-planned-actual-week-chart',
  standalone: true,
  imports: [DashboardBarChartComponent],
  template: `
    <app-dashboard-bar-chart
      class="min-h-0 flex-1"
      data-testid="planned-actual-week-chart"
      axisSuffix="h"
      emptyText="Nothing planned or worked yet"
      [bars]="bars()"
      [headline]="headline()"
      [compactHeadline]="compactHeadline()"
      [legend]="legend"
      [ariaLabel]="summary()"
    />
  `,
  host: { class: 'flex min-h-0 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlannedActualWeekChartComponent {
  readonly days = input.required<readonly PlannedActualDay[]>();
  /** yyyy-MM-dd; later dates are future (planned only). Null = nothing is future. */
  readonly today = input<string | null>(null);
  /** Puts each day's coverage % in its readout and tooltip. */
  readonly coverageLine = input(true);
  /** Column labels; the weekday names of the dates when unset. */
  readonly labels = input<readonly string[] | null>(null);
  /** The headline's label; empty leaves the headline out. */
  readonly heading = input('');
  /** The headline on one line (cards). */
  readonly compactHeadline = input(true);

  protected readonly legend: DashboardBarLegendItem[] = [
    { label: 'Planned', color: PLANNED_ACTUAL_COLORS.planned },
    { label: 'In plan', color: PLANNED_ACTUAL_COLORS.scheduled },
    { label: 'Outside slot', color: PLANNED_ACTUAL_COLORS.outside },
    { label: 'No plan', color: PLANNED_ACTUAL_COLORS.noPlan }
  ];

  private label(d: PlannedActualDay, i: number): string {
    return this.labels()?.[i] ?? barWeekday(d.date);
  }

  private isFuture(d: PlannedActualDay): boolean {
    const today = this.today();
    return today != null && d.date > today;
  }

  protected readonly bars = computed<DashboardBar[]>(() => {
    const today = this.today();
    const coverage = this.coverageLine();
    return this.days().map((d, i) => {
      const future = this.isFuture(d);
      const label = this.label(d, i);
      const actual = actualOf(d);
      const coverageText = coverage && d.coveragePercent != null ? ` · coverage ${d.coveragePercent}%` : '';
      return {
        key: d.date,
        label,
        title: this.labels() ? label : barDayTitle(d.date),
        valueText: future ? `${barHours(d.planned)} planned` : `${barHours(actual)} actual`,
        chip: future ? undefined : `of ${barHours(d.planned)} planned${coverageText}`,
        segments: [{ key: 'planned', value: d.planned / 60, color: PLANNED_ACTUAL_COLORS.planned }],
        pair: future
          ? []
          : [
              { key: 'scheduled', value: d.scheduled / 60, color: PLANNED_ACTUAL_COLORS.scheduled },
              { key: 'outside', value: d.outside / 60, color: PLANNED_ACTUAL_COLORS.outside },
              { key: 'noPlan', value: d.noPlan / 60, color: PLANNED_ACTUAL_COLORS.noPlan }
            ],
        state: d.date === today ? 'current' : 'done',
        tooltip: future
          ? `${label}: planned ${minutesText(d.planned)}`
          : `${label}: planned ${minutesText(d.planned)}, actual ${minutesText(actual)} ` +
            `(${minutesText(d.scheduled)} in plan, ${minutesText(d.outside)} outside slot, ${minutesText(d.noPlan)} no plan)` +
            (coverage && d.coveragePercent != null ? `, coverage ${d.coveragePercent}%` : '')
      };
    });
  });

  protected readonly headline = computed<DashboardBarHeadline | null>(() => {
    if (!this.heading()) return null;
    const days = this.days().filter((d) => !this.isFuture(d));
    const actual = days.reduce((n, d) => n + actualOf(d), 0);
    const planned = this.days().reduce((n, d) => n + d.planned, 0);
    return {
      label: this.heading(),
      value: `${barHours(actual)} actual`,
      chip: planned > 0 ? { text: `of ${barHours(planned)} planned`, tone: 'neutral' } : null
    };
  });

  protected readonly summary = computed(
    () =>
      'Planned vs actual by day. ' +
      this.days()
        .map((d, i) => {
          const label = this.label(d, i);
          if (this.isFuture(d)) return `${label}: planned ${minutesText(d.planned)}`;
          const coverage = d.coveragePercent == null ? '' : `, coverage ${d.coveragePercent}%`;
          return `${label}: planned ${minutesText(d.planned)}, actual ${minutesText(actualOf(d))}${coverage}`;
        })
        .join('; ')
  );
}
