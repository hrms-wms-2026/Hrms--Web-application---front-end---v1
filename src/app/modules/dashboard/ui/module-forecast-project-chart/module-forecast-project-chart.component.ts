import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ModuleForecastProject } from '../../models/team-module-forecast.model';
import {
  DEFAULT_MAX_TASK_RATE,
  FORECAST_COLORS,
  forecastHoursText,
  rateText,
  shortHoursText,
} from '../../utils/overtime-forecast-format.util';
import {
  DashboardBar,
  DashboardBarChartComponent,
  DashboardBarHeadline,
  DashboardBarLegendItem,
  DashboardBarVariant,
} from '../../../../shared/ui/charts/dashboard-bar-chart/dashboard-bar-chart.component';

/** A bar label short enough to sit under a narrow bar. */
export function shortBarLabel(name: string, max = 10): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/** Headroom over the tallest bar: a target dash above this is left out of the plot (the hover still reads it). */
export const MARKER_HEADROOM = 1.25;

/**
 * How many bars fit a plot this wide at a readable width (`slotPx` each, after the axis), and how many characters
 * their labels get. Used by narrow cards so labels never shrink to "E-p…".
 */
export function chartFit(
  bodyWidth: number,
  slotPx = 64,
  max = 8,
  axisPx = 40,
): { readonly bars: number; readonly labelChars: number } {
  const plot = Math.max(0, bodyWidth - axisPx);
  const bars = Math.max(2, Math.min(max, Math.floor(plot / slotPx)));
  return { bars, labelChars: Math.max(5, Math.floor(plot / bars / 7)) };
}

/**
 * Module overtime forecast, per project: the hours still to do beside the hours the team is predicted to complete
 * before the deadlines (a `pair` stack). The dash is the capacity at the rate limit; it is drawn only when it lands
 * within {@link MARKER_HEADROOM} of the tallest bar, so one huge project can't flatten the rest (the hover still reads
 * it). Bars carry no badges or red frames (the user asked for a clean plot, 2026-11-10); overload shows in the
 * ranking and the popup table. Narrow cards pass `limit` and `labelChars` from {@link chartFit} and `narrow`, which
 * drops the axis (its ticks overlapped at that width; the headline and hover read the hours) and shortens the legend
 * to one line; the rest show as "+N more". Drawn by the shared dashboard bar chart.
 */
@Component({
  selector: 'app-module-forecast-project-chart',
  standalone: true,
  imports: [DashboardBarChartComponent],
  template: `
    <app-dashboard-bar-chart
      class="min-h-0 flex-1"
      data-testid="module-forecast-project-chart"
      axisSuffix="h"
      emptyText="No hours left in any project"
      [bars]="bars()"
      [headline]="headline()"
      [compactHeadline]="compactHeadline()"
      [hideAxis]="narrow()"
      [legend]="legend()"
      [variant]="variant()"
      [ariaLabel]="summary()"
    />
    @if (hiddenCount() > 0) {
      <p
        class="mt-1 text-[0.6875rem] text-[var(--color-text-muted)]"
        data-testid="project-chart-more"
      >
        +{{ hiddenCount() }} more {{ hiddenCount() === 1 ? 'project' : 'projects' }} in the popup
      </p>
    }
  `,
  host: { class: 'flex min-h-0 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModuleForecastProjectChartComponent {
  readonly projects = input.required<readonly ModuleForecastProject[]>();
  /** The headline's label; empty leaves the headline out. */
  readonly heading = input('');
  /** The most projects to draw (the ones with the most hours left). */
  readonly limit = input(8);
  /** The longest bar label (characters); the full name is in the hover. */
  readonly labelChars = input(10);
  readonly compactHeadline = input(true);
  /** A narrow card (body under ~360px): no axis, a one-line legend. */
  readonly narrow = input(false);
  readonly variant = input<DashboardBarVariant>('earnings');

  /** The realistic task-rate limit: the dash is the most task hours the team can reach (capacity × limit). */
  readonly maxTaskRate = input(DEFAULT_MAX_TASK_RATE);

  protected readonly legend = computed<DashboardBarLegendItem[]>(() => [
    { label: 'Remaining', color: FORECAST_COLORS.remaining },
    { label: 'Predicted', color: FORECAST_COLORS.covered },
    {
      label: this.narrow()
        ? `${rateText(this.maxTaskRate())} cap`
        : `Capacity at ${rateText(this.maxTaskRate())}`,
      color: 'var(--color-text-secondary)',
      marker: true,
    },
  ]);

  private readonly shown = computed(() =>
    [...this.projects()]
      .sort((a, b) => b.overtimeHours - a.overtimeHours || b.remainingHours - a.remainingHours)
      .slice(0, this.limit()),
  );

  protected readonly hiddenCount = computed(() =>
    Math.max(0, this.projects().length - this.shown().length),
  );

  protected readonly bars = computed<DashboardBar[]>(() => {
    const shown = this.shown();
    const limit = this.maxTaskRate();
    const tallest = Math.max(0, ...shown.map((p) => Math.max(p.remainingHours, p.predictedHours)));
    return shown.map((p) => {
      const reachable = p.capacityHours * limit;
      return {
        key: p.projectId,
        label: shortBarLabel(p.name, this.labelChars()),
        title: p.name,
        valueText: `${forecastHoursText(p.remainingHours)} left`,
        chip: p.overtimeHours > 0 ? `${shortHoursText(p.overtimeHours)} won't fit` : 'On track',
        sub: `${forecastHoursText(p.predictedHours)} predicted · capacity at ${rateText(limit)}: ${forecastHoursText(reachable)}`,
        segments: [{ key: 'remaining', value: p.remainingHours, color: FORECAST_COLORS.remaining }],
        pair: [{ key: 'predicted', value: p.predictedHours, color: FORECAST_COLORS.covered }],
        marker: reachable > 0 && reachable <= tallest * MARKER_HEADROOM ? reachable : undefined,
        tooltip: `${p.name}: ${forecastHoursText(p.remainingHours)} left, ${forecastHoursText(p.predictedHours)} predicted, capacity at ${rateText(limit)} ${forecastHoursText(reachable)}`,
      };
    });
  });

  protected readonly headline = computed<DashboardBarHeadline | null>(() => {
    if (!this.heading()) return null;
    const overtime = this.projects().reduce((n, p) => n + p.overtimeHours, 0);
    const remaining = this.projects().reduce((n, p) => n + p.remainingHours, 0);
    return {
      label: this.heading(),
      value: overtime > 0 ? `${shortHoursText(overtime)} won't fit` : 'On track',
      hint: 'Remaining hours beside the predicted task hours before the deadlines; the dash is the working capacity',
      sub: this.variant() === 'orders' ? `${forecastHoursText(remaining)} still to do` : undefined,
    };
  });

  protected readonly summary = computed(
    () =>
      'Remaining against predicted hours by project. ' +
      this.shown()
        .map(
          (p) =>
            `${p.name}: ${forecastHoursText(p.remainingHours)} left, ${forecastHoursText(p.predictedHours)} predicted`,
        )
        .join('; '),
  );
}
