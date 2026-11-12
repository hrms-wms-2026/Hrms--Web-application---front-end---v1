import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TeamWorkTaskTrendPoint } from '../../models/team-work-task.model';
import {
  TEAM_WORK_TASK_COLORS,
  hoursText,
  trendLabel,
  utilizationText,
} from '../../utils/team-work-task-format.util';
import { barDayTitle, barHours } from '../dashboard-bar-chart/bar-chart-dates.util';
import {
  DashboardBar,
  DashboardBarChartComponent,
  DashboardBarChip,
  DashboardBarHeadline,
  DashboardBarLegendItem,
  DashboardBarVariant,
} from '../dashboard-bar-chart/dashboard-bar-chart.component';

/**
 * Working time against completed task hours per day, as two bars side by side (work, then task) on one axis, drawn
 * by the shared dashboard bar chart. With a `heading`, the headline reads the period's worked hours until a day is
 * hovered, then that day's worked and task hours. A month shows day numbers. `variant="orders"` (popup) draws the
 * BoardUI Orders chart card look: a larger headline with the task hours under it and the legend beside it.
 */
@Component({
  selector: 'app-work-task-day-chart',
  standalone: true,
  imports: [DashboardBarChartComponent],
  template: `
    <app-dashboard-bar-chart
      class="min-h-0 flex-1"
      data-testid="work-task-chart"
      axisSuffix="h"
      emptyText="No work or completed tasks in this period"
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
export class WorkTaskDayChartComponent {
  readonly points = input.required<readonly TeamWorkTaskTrendPoint[]>();
  /** A day to draw stronger (the selected day of a day period). */
  readonly highlight = input<string | null>(null);
  /** The headline's label; empty leaves the headline out. */
  readonly heading = input('');
  /** A pill beside the headline value (the change against the previous period). */
  readonly chip = input<DashboardBarChip | null>(null);
  /** The headline on one line (cards). */
  readonly compactHeadline = input(true);
  /** The shared chart's look (`orders` in the popup). */
  readonly variant = input<DashboardBarVariant>('earnings');

  protected readonly legend: DashboardBarLegendItem[] = [
    { label: 'Worked', color: TEAM_WORK_TASK_COLORS.other },
    { label: 'Task', color: TEAM_WORK_TASK_COLORS.task },
  ];

  protected readonly bars = computed<DashboardBar[]>(() => {
    const points = this.points();
    const monthly = points.length > 7;
    const highlight = this.highlight();
    const orders = this.variant() === 'orders';
    return points.map((p) => ({
      key: p.date,
      label: trendLabel(p.date, monthly),
      title: barDayTitle(p.date),
      valueText: `${barHours(p.workedMinutes)} worked`,
      chip: orders
        ? `${utilizationText(p.utilization)} task`
        : `${barHours(p.taskMinutes)} task · ${utilizationText(p.utilization)}`,
      sub: `${barHours(p.taskMinutes)} task hours · ${p.completedTasks} completed`,
      segments: [
        { key: 'worked', value: p.workedMinutes / 60, color: TEAM_WORK_TASK_COLORS.other },
      ],
      pair: [{ key: 'task', value: p.taskMinutes / 60, color: TEAM_WORK_TASK_COLORS.task }],
      dim: highlight !== null && p.date !== highlight,
      tooltip:
        `${p.date}: ${hoursText(p.workedMinutes)} worked, ${hoursText(p.taskMinutes)} task hours` +
        ` (${utilizationText(p.utilization)}), ${p.completedTasks} completed`,
    }));
  });

  protected readonly headline = computed<DashboardBarHeadline | null>(() => {
    if (!this.heading()) return null;
    const worked = this.points().reduce((n, p) => n + p.workedMinutes, 0);
    const task = this.points().reduce((n, p) => n + p.taskMinutes, 0);
    const completed = this.points().reduce((n, p) => n + p.completedTasks, 0);
    return {
      label: this.heading(),
      value: `${barHours(worked)} worked`,
      chip: this.chip(),
      sub:
        this.variant() === 'orders'
          ? `${barHours(task)} task hours · ${completed} completed`
          : undefined,
    };
  });

  protected readonly summary = computed(
    () =>
      'Working time and completed task hours by day. ' +
      this.points()
        .map(
          (p) =>
            `${p.date}: ${hoursText(p.workedMinutes)} worked, ${hoursText(p.taskMinutes)} task`,
        )
        .join('; '),
  );
}
