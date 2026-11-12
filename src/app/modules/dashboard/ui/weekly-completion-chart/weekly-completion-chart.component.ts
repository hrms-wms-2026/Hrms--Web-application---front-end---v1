import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LedWeeklyCompletionWeek } from '../../models/team-progress-detail.model';
import { formatHourValue, formatPercent } from '../../utils/team-progress-format.util';
import { WIDGET } from '../../utils/widget-palette';
import {
  DashboardBar,
  DashboardBarChartComponent,
  DashboardBarHeadline,
  DashboardBarState
} from '../dashboard-bar-chart/dashboard-bar-chart.component';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COMPLETED_COLOR = WIDGET.shade1;

/** "13 Oct" from a yyyy-MM-dd date, without going through Date (no time-zone shift). */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTHS[month - 1] ?? ''}`.trim();
}

/** "Mon" from a yyyy-MM-dd date (UTC, so the weekday never shifts). */
function weekday(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/** Today as yyyy-MM-dd in local time. */
function localToday(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Completed task estimates per week (or per day, `granularity`), oldest first, drawn by the shared dashboard bar
 * chart: the headline reads the total (with the last full week's change) until a bucket is hovered, then that
 * bucket. Buckets after today (the rest of this week or month) show as empty tracks. Fills its parent's height.
 * Used by the Team Progress card and its popup.
 */
@Component({
  selector: 'app-weekly-completion-chart',
  standalone: true,
  imports: [DashboardBarChartComponent],
  template: `
    <app-dashboard-bar-chart
      class="min-h-0 flex-1"
      [bars]="bars()"
      [headline]="headline()"
      [ariaLabel]="summary()"
      emptyText="No tasks completed in this range"
    />
  `,
  host: { class: 'flex min-h-0 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyCompletionChartComponent {
  readonly weeks = input.required<readonly LedWeeklyCompletionWeek[]>();
  /** Allocation the weeks are read against in the tooltips; 0 leaves the share out. */
  readonly allocatedHours = input(0);
  /** 'day' buckets (a week's days) or 'week' buckets. */
  readonly granularity = input<'week' | 'day'>('week');
  /** What the buckets cover ("Last 10 weeks", "This month"); empty for the card's "Weekly completion · last N weeks". */
  readonly rangeLabel = input('');
  /** yyyy-MM-dd; marks the current bucket and leaves later ones empty. Tests pass a fixed day. */
  readonly today = input(localToday());

  protected readonly bars = computed<DashboardBar[]>(() => {
    const weeks = this.weeks();
    const allocation = this.allocatedHours();
    const today = this.today();
    const day = this.granularity() === 'day';
    return weeks.map((week, index) => {
      const last = index === weeks.length - 1;
      const state: DashboardBarState =
        week.weekStart > today ? 'future' : week.weekEnd >= today || (last && !day) ? 'current' : 'done';
      const hoursText = `${formatHourValue(week.completedHours)} h`;
      const share = allocation > 0 ? `, ${formatPercent(week.completedHours, allocation)} of the allocation` : '';
      const tasksText = `${week.completedTaskCount} ${week.completedTaskCount === 1 ? 'task' : 'tasks'}`;
      const name = day ? `${weekday(week.weekStart)} ${shortDate(week.weekStart)}` : `Week of ${shortDate(week.weekStart)}`;
      const title = `${name}${state === 'current' ? ' (so far)' : ''}`;
      const currentLabel = day ? 'Today' : 'This wk';
      return {
        key: week.weekStart,
        label: state === 'current' ? currentLabel : day ? weekday(week.weekStart) : shortDate(week.weekStart),
        title,
        valueText: hoursText,
        chip: tasksText,
        segments: [{ key: 'completed', value: week.completedHours, color: COMPLETED_COLOR }],
        tooltip: state === 'future' ? `${name}: not yet` : `${title}: ${hoursText} completed (${tasksText}${share})`,
        state
      };
    });
  });

  private readonly total = computed(() => this.weeks().reduce((sum, w) => sum + w.completedHours, 0));

  protected readonly headline = computed<DashboardBarHeadline>(() => {
    const weeks = this.weeks();
    let chip: DashboardBarHeadline['chip'] = null;
    // Weeks only: the last full week (the running one is partial) against the week before it.
    const last = weeks[weeks.length - 2];
    const before = weeks[weeks.length - 3];
    if (this.granularity() === 'week' && !this.rangeLabel() && last && before && before.completedHours > 0) {
      const change = ((last.completedHours - before.completedHours) * 100) / before.completedHours;
      const rounded = Math.round(change * 10) / 10;
      chip = {
        text: `${rounded > 0 ? '+' : ''}${rounded}%`,
        tone: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'neutral',
        title: `Week of ${shortDate(last.weekStart)} against the week before`
      };
    }
    const label = this.rangeLabel() ? `Completed · ${this.rangeLabel()}` : `Weekly completion · last ${weeks.length} weeks`;
    return {
      label,
      value: `${formatHourValue(this.total())} h`,
      chip,
      hint: 'Estimated hours of tasks completed each week (task weightage, not time worked).'
    };
  });

  protected readonly summary = computed(() => {
    const parts = this.bars().map((bar) => `${bar.label} ${bar.valueText}`);
    const unit = this.granularity() === 'day' ? 'day' : 'week';
    const range = this.rangeLabel() || `last ${parts.length} weeks`;
    return `Completed task hours per ${unit}, ${range}: ${parts.join(', ')}`;
  });
}
