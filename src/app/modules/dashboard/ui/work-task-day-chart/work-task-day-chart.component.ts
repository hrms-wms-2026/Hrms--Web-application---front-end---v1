import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TeamWorkTaskTrendPoint } from '../../models/team-work-task.model';
import {
  TEAM_WORK_TASK_COLORS,
  hoursText,
  trendLabel,
  utilizationText,
} from '../../utils/team-work-task-format.util';

interface DayBars {
  readonly date: string;
  readonly label: string;
  /** Shares (0-100) of the busiest day's larger figure. */
  readonly worked: number;
  readonly task: number;
  readonly tooltip: string;
  readonly highlighted: boolean;
}

/**
 * Working time against completed task hours per day, as two bars side by side (work blue, task green). Both bars
 * share one scale: the largest worked or task figure of the period. A month shows every day number; the label
 * thins out on narrow columns via CSS.
 */
@Component({
  selector: 'app-work-task-day-chart',
  standalone: true,
  templateUrl: './work-task-day-chart.component.html',
  styleUrl: './work-task-day-chart.component.css',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkTaskDayChartComponent {
  readonly points = input.required<readonly TeamWorkTaskTrendPoint[]>();
  /** A day to draw stronger (the selected day of a day period). */
  readonly highlight = input<string | null>(null);

  protected readonly colors = TEAM_WORK_TASK_COLORS;
  protected readonly monthly = computed(() => this.points().length > 7);

  protected readonly bars = computed<readonly DayBars[]>(() => {
    const points = this.points();
    const max = Math.max(0, ...points.map((p) => Math.max(p.workedMinutes, p.taskMinutes)));
    const share = (n: number) => (max > 0 ? Math.round((n * 1000) / max) / 10 : 0);
    const monthly = points.length > 7;
    const highlight = this.highlight();
    return points.map((p) => ({
      date: p.date,
      label: trendLabel(p.date, monthly),
      worked: share(p.workedMinutes),
      task: share(p.taskMinutes),
      highlighted: highlight !== null && p.date === highlight,
      tooltip:
        `${p.date}: ${hoursText(p.workedMinutes)} worked, ${hoursText(p.taskMinutes)} task hours` +
        ` (${utilizationText(p.utilization)}), ${p.completedTasks} completed`,
    }));
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
