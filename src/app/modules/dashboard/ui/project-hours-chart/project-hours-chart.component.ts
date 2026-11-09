import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LedHourTotals, LedOverdueProject, LedProjectProgress } from '../../models/my-team-led-progress.model';
import { PROGRESS_STATUSES, formatHourValue, formatPercent } from '../../utils/team-progress-format.util';
import { projectChartSummary, projectHourBars } from '../../utils/project-hours-chart.util';
import {
  DashboardBarChartComponent,
  DashboardBarHeadline,
  DashboardBarLegendItem
} from '../dashboard-bar-chart/dashboard-bar-chart.component';

/**
 * Hours by project as stacked bars (completed, in progress, not started, not yet tasked), drawn by the shared
 * dashboard bar chart. The headline reads the shown projects' allocation until a colour is hovered, then that
 * project's hours in that state; an at-risk project has a red border and says why. Replaces the Team Progress
 * card's Led modules list and the popup's Project breakdown (2026-11-06).
 */
@Component({
  selector: 'app-project-hours-chart',
  standalone: true,
  imports: [DashboardBarChartComponent],
  template: `
    <app-dashboard-bar-chart
      class="min-h-0 flex-1"
      data-testid="project-hours-chart"
      axisSuffix="h"
      emptyText="No hours allocated to these projects yet"
      [bars]="bars()"
      [headline]="headline()"
      [compactHeadline]="compactHeadline()"
      [legend]="showLegend() ? legend() : []"
      [ariaLabel]="summary()"
    />
  `,
  host: { class: 'flex min-h-0 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectHoursChartComponent {
  /** The projects to draw, in order (orderProjectsForChart). */
  readonly projects = input.required<readonly LedProjectProgress[]>();
  /** Overdue hours and tasks per project, for the at-risk text. */
  readonly overdueByProject = input<readonly LedOverdueProject[]>([]);
  /** The resting headline's label. */
  readonly heading = input('Allocated hours');
  /** The headline on one line (cards). */
  readonly compactHeadline = input(false);
  /** The colour key under the chart (a card whose donut key already names the colours leaves it out). */
  readonly showLegend = input(true);

  protected readonly bars = computed(() => projectHourBars(this.projects(), this.overdueByProject()));

  protected readonly legend = computed<DashboardBarLegendItem[]>(() => [
    ...PROGRESS_STATUSES.map((s) => ({ label: s.label, color: s.color })),
    ...(this.projects().some((p) => p.hours.overTaskedHours > 0 && p.hours.allocatedHours > 0)
      ? [{ label: 'Allocated', color: 'var(--color-text-secondary)', marker: true }]
      : [])
  ]);

  protected readonly headline = computed<DashboardBarHeadline>(() => {
    const total = this.projects().reduce<LedHourTotals>(
      (sum, p) => ({
        ...sum,
        allocatedHours: sum.allocatedHours + p.hours.allocatedHours,
        completedHours: sum.completedHours + p.hours.completedHours
      }),
      { allocatedHours: 0, completedHours: 0 } as LedHourTotals
    );
    return {
      label: this.heading(),
      value: `${formatHourValue(total.allocatedHours)} h`,
      chip:
        total.allocatedHours > 0
          ? { text: `${formatPercent(total.completedHours, total.allocatedHours)} completed`, tone: 'neutral' }
          : null,
      hint: 'Hover a colour on a bar to see that project\'s hours in that state'
    };
  });

  protected readonly summary = computed(() => projectChartSummary(this.projects(), this.overdueByProject()));
}
