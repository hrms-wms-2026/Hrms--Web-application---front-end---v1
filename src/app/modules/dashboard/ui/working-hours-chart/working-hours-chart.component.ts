import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TeamWorkingHoursDay } from '../../models/my-team-today.model';
import { minutesText } from '../../utils/team-presence-format.util';

interface HoursBar {
  readonly date: string;
  readonly label: string;
  /** Shares of the busiest day's column (0-100). */
  readonly worked: number;
  readonly break: number;
  readonly tooltip: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/**
 * The team's attendance minutes per day of a week as stacked bars: worked at the bottom, break on top (the
 * Working / Break colours). Columns scale against the busiest day. Attendance time only: never task or planned time.
 * Styled like app-attendance-day-chart, which counts people and so cannot take minutes.
 */
@Component({
  selector: 'app-working-hours-chart',
  standalone: true,
  templateUrl: './working-hours-chart.component.html',
  styleUrl: './working-hours-chart.component.css',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkingHoursChartComponent {
  readonly days = input.required<readonly TeamWorkingHoursDay[]>();

  protected readonly bars = computed<readonly HoursBar[]>(() => {
    const days = this.days();
    const max = Math.max(0, ...days.map((d) => d.workedMinutes + d.breakMinutes));
    const share = (n: number) => (max > 0 ? Math.round((n * 1000) / max) / 10 : 0);
    return days.map((d) => ({
      date: d.date,
      label: weekday(d.date),
      worked: share(d.workedMinutes),
      break: share(d.breakMinutes),
      tooltip:
        `${weekday(d.date)} ${d.date}: ${minutesText(d.workedMinutes)} worked, ${minutesText(d.breakMinutes)} break` +
        `, ${d.peopleWithRecord} clocked in` +
        (d.onLeaveCount > 0 ? `, ${d.onLeaveCount} on leave` : ''),
    }));
  });

  protected readonly summary = computed(
    () =>
      'Team working hours by day. ' +
      this.days()
        .map(
          (d) =>
            `${weekday(d.date)}: ${minutesText(d.workedMinutes)} worked, ${minutesText(d.breakMinutes)} break`,
        )
        .join('; '),
  );
}
