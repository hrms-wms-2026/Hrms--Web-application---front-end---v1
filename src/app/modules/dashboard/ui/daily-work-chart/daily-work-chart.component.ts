import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { WeekDayProgress } from '../../models/weekly-work-progress.model';

interface DayColumn {
  key: string;
  name: string;
  /** "6h / 5h": scheduled / worked, or worked / expected without the planner. */
  hoursText: string;
  scheduledHeight: number;
  workedHeight: number;
  tooltip: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The axis used when nothing was expected, scheduled or worked all week. */
const EMPTY_AXIS_MINUTES = 8 * 60;

/** Day name and "26 Oct" from a yyyy-MM-dd date, without going through UTC (no time-zone shift). */
function describeDate(isoDate: string): { name: string; short: string } {
  const [y, m, d] = isoDate.split('-').map(Number);
  return { name: DAY_NAMES[new Date(y, m - 1, d).getDay()], short: `${d} ${MONTHS[m - 1] ?? ''}`.trim() };
}

/** "6h" or "5.5h" from minutes. */
export function formatDayHours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

/**
 * Daily Work vs Schedule (Weekly Work Progress card and popup): per day a Scheduled bar and a Worked bar, and the
 * Expected hours as a dashed line. The axis is the week's largest figure rounded up to an even number of hours.
 * Without the planner the Scheduled series is left out and the labels read worked / expected.
 */
@Component({
  selector: 'app-daily-work-chart',
  standalone: true,
  templateUrl: './daily-work-chart.component.html',
  styleUrl: './daily-work-chart.component.css',
  host: { class: 'flex flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DailyWorkChartComponent {
  readonly days = input.required<readonly WeekDayProgress[]>();
  readonly showScheduled = input(true);
  /** Hides the hour axis and the per-day hours line where space is tight. */
  readonly compact = input(false);

  protected readonly axisMinutes = computed(() => {
    const max = Math.max(
      0,
      ...this.days().map((d) => Math.max(d.expectedMinutes, d.workedMinutes, this.showScheduled() ? d.scheduledMinutes : 0))
    );
    if (max === 0) return EMPTY_AXIS_MINUTES;
    return Math.ceil(max / 120) * 120;
  });

  protected readonly axisLabels = computed(() => {
    const axis = this.axisMinutes();
    return [axis, axis / 2, 0].map(formatDayHours);
  });

  protected readonly columns = computed<DayColumn[]>(() => {
    const axis = this.axisMinutes();
    const scheduled = this.showScheduled();
    return this.days().map((d) => {
      const { name, short } = describeDate(d.date);
      const parts = [
        scheduled ? `scheduled ${formatDayHours(d.scheduledMinutes)}` : null,
        `worked ${formatDayHours(d.workedMinutes)}`,
        `expected ${formatDayHours(d.expectedMinutes)}`
      ].filter((p): p is string => p !== null);
      return {
        key: d.date,
        name,
        hoursText: scheduled
          ? `${formatDayHours(d.scheduledMinutes)} / ${formatDayHours(d.workedMinutes)}`
          : `${formatDayHours(d.workedMinutes)} / ${formatDayHours(d.expectedMinutes)}`,
        scheduledHeight: (d.scheduledMinutes / axis) * 100,
        workedHeight: (d.workedMinutes / axis) * 100,
        tooltip: `${name} ${short}: ${parts.join(', ')}`
      };
    });
  });

  /** Points of the Expected line in a 0-100 box: one per day, at the centre of its column. */
  protected readonly expectedPoints = computed(() => {
    const days = this.days();
    const axis = this.axisMinutes();
    return days
      .map((d, i) => `${(((i + 0.5) / days.length) * 100).toFixed(2)},${(100 - (d.expectedMinutes / axis) * 100).toFixed(2)}`)
      .join(' ');
  });

  protected readonly summary = computed(() =>
    `Daily work against schedule: ${this.columns().map((c) => c.tooltip).join('; ')}`
  );
}
