import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LedWeeklyCompletionWeek } from '../../models/team-progress-detail.model';
import { formatHourValue, formatPercent } from '../../utils/team-progress-format.util';

interface WeekBar {
  key: string;
  label: string;
  hoursText: string;
  /** Bar height as a share of the tallest week (0-100). */
  height: number;
  tooltip: string;
  current: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "13 Oct" from a yyyy-MM-dd date, without going through Date (no time-zone shift). */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTHS[month - 1] ?? ''}`.trim();
}

/**
 * Completed task estimates per week as a bar chart, oldest week first and the current (partial)
 * week last. Fills its parent's height; bars scale against the busiest week, never a fixed axis.
 * Shared by the Team Progress card and its detail dialog.
 */
@Component({
  selector: 'app-weekly-completion-chart',
  standalone: true,
  templateUrl: './weekly-completion-chart.component.html',
  styleUrl: './weekly-completion-chart.component.css',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyCompletionChartComponent {
  readonly weeks = input.required<readonly LedWeeklyCompletionWeek[]>();
  /** Allocation the weeks are read against in the tooltips; 0 leaves the share out. */
  readonly allocatedHours = input(0);
  /** Hides the hour labels above the bars where space is tight. */
  readonly compact = input(false);
  /** A completion % line on a right 0-100% axis: hours completed so far in these weeks as a share of the allocation.
   * The payload has completed hours only (no per-status hours), so the bars stay completed and this line is added. */
  readonly percentLine = input(false);

  /** Cumulative completed / allocated per week, in a 0-100 box; none without an allocation. */
  protected readonly percentPoints = computed<{ x: number; y: number; percent: number }[]>(() => {
    const allocation = this.allocatedHours();
    const weeks = this.weeks();
    if (!this.percentLine() || !(allocation > 0)) return [];
    let done = 0;
    return weeks.map((w, i) => {
      done += w.completedHours;
      const percent = Math.min(100, (done * 100) / allocation);
      return { x: ((i + 0.5) * 100) / weeks.length, y: Math.round((100 - percent) * 10) / 10, percent };
    });
  });
  protected readonly percentPolyline = computed(() =>
    this.percentPoints()
      .map((p) => `${p.x},${p.y}`)
      .join(' ')
  );

  protected readonly bars = computed<WeekBar[]>(() => {
    const weeks = this.weeks();
    const max = Math.max(0, ...weeks.map((w) => w.completedHours));
    const allocation = this.allocatedHours();
    return weeks.map((week, index) => {
      const current = index === weeks.length - 1;
      const hoursText = `${formatHourValue(week.completedHours)} h`;
      const share = allocation > 0 ? `, ${formatPercent(week.completedHours, allocation)} of the allocation` : '';
      const tasks = `${week.completedTaskCount} ${week.completedTaskCount === 1 ? 'task' : 'tasks'}`;
      return {
        key: week.weekStart,
        label: current ? 'This wk' : shortDate(week.weekStart),
        hoursText,
        height: max > 0 ? (week.completedHours / max) * 100 : 0,
        tooltip: `Week of ${shortDate(week.weekStart)}${current ? ' (so far)' : ''}: ${hoursText} completed (${tasks}${share})`,
        current
      };
    });
  });

  protected readonly total = computed(() => this.weeks().reduce((sum, w) => sum + w.completedHours, 0));

  protected readonly summary = computed(() => {
    const parts = this.bars().map((bar) => `${bar.label} ${bar.hoursText}`);
    const points = this.percentPoints();
    const line =
      points.length > 0 ? `. Completed in these weeks: ${formatPercent(points[points.length - 1].percent, 100)} of the allocation` : '';
    return `Completed task hours per week, last ${parts.length} weeks: ${parts.join(', ')}${line}`;
  });

  protected readonly formatHourValue = formatHourValue;
}
