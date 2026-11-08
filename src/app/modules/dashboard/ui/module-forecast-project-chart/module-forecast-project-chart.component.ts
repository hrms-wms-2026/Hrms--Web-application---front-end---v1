import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ModuleForecastProject } from '../../models/team-module-forecast.model';
import { FORECAST_COLORS, forecastHoursText } from '../../utils/overtime-forecast-format.util';
import {
  DashboardBar,
  DashboardBarChartComponent,
  DashboardBarHeadline,
  DashboardBarLegendItem,
  DashboardBarVariant,
} from '../dashboard-bar-chart/dashboard-bar-chart.component';

/** A bar label short enough to sit under a narrow bar. */
export function shortBarLabel(name: string, max = 10): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/**
 * Module overtime forecast, per project: the hours still to do beside the hours the team is predicted to complete
 * before the deadlines (a `pair` stack), with the normal working capacity as the target dash. A project that needs
 * overtime gets the red alert border. Drawn by the shared dashboard bar chart.
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
      [legend]="legend"
      [variant]="variant()"
      [ariaLabel]="summary()"
    />
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
  readonly compactHeadline = input(true);
  readonly variant = input<DashboardBarVariant>('earnings');

  protected readonly legend: DashboardBarLegendItem[] = [
    { label: 'Remaining', color: FORECAST_COLORS.remaining },
    { label: 'Predicted', color: FORECAST_COLORS.covered },
    { label: 'Capacity', color: 'var(--color-text-secondary)', marker: true },
  ];

  private readonly shown = computed(() =>
    [...this.projects()].sort((a, b) => b.overtimeHours - a.overtimeHours || b.remainingHours - a.remainingHours).slice(0, this.limit()),
  );

  protected readonly bars = computed<DashboardBar[]>(() =>
    this.shown().map((p) => ({
      key: p.projectId,
      label: shortBarLabel(p.name),
      title: p.name,
      valueText: `${forecastHoursText(p.remainingHours)} left`,
      chip: p.overtimeHours > 0 ? `~${forecastHoursText(p.overtimeHours)} overtime` : 'On track',
      sub: `${forecastHoursText(p.predictedHours)} predicted · ${forecastHoursText(p.capacityHours)} capacity`,
      segments: [{ key: 'remaining', value: p.remainingHours, color: FORECAST_COLORS.remaining }],
      pair: [{ key: 'predicted', value: p.predictedHours, color: FORECAST_COLORS.covered }],
      marker: p.capacityHours,
      alert: p.overtimeHours > 0 ? `${p.modulesAtRisk} module${p.modulesAtRisk === 1 ? '' : 's'} at risk · ~${forecastHoursText(p.overtimeHours)} overtime` : undefined,
      tooltip: `${p.name}: ${forecastHoursText(p.remainingHours)} left, ${forecastHoursText(p.predictedHours)} predicted, ${forecastHoursText(p.capacityHours)} capacity`,
    })),
  );

  protected readonly headline = computed<DashboardBarHeadline | null>(() => {
    if (!this.heading()) return null;
    const overtime = this.projects().reduce((n, p) => n + p.overtimeHours, 0);
    const remaining = this.projects().reduce((n, p) => n + p.remainingHours, 0);
    return {
      label: this.heading(),
      value: overtime > 0 ? `~${forecastHoursText(overtime)} overtime` : 'On track',
      hint: 'Remaining hours beside the predicted task hours before the deadlines; the dash is the working capacity',
      sub: this.variant() === 'orders' ? `${forecastHoursText(remaining)} still to do` : undefined,
    };
  });

  protected readonly summary = computed(
    () =>
      'Remaining against predicted hours by project. ' +
      this.shown()
        .map((p) => `${p.name}: ${forecastHoursText(p.remainingHours)} left, ${forecastHoursText(p.predictedHours)} predicted`)
        .join('; '),
  );
}
