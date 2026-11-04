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
  readonly onLeave: number;
}

interface AveragePoint {
  readonly x: number;
  readonly y: number;
}

/** Worked minutes per person with a record that day; 0 without one. */
function perPerson(d: TeamWorkingHoursDay): number {
  return d.peopleWithRecord > 0 ? d.workedMinutes / d.peopleWithRecord : 0;
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
  /** A dashed line through each day's worked minutes per person with a record (its own scale: per person, not team
   * totals). Days without a record have no point. */
  readonly teamAverage = input(false);
  /** A red mark over each day with people on approved leave, showing the count (people, never minutes). */
  readonly showLeave = input(false);

  /** Points in a 0-100 box: x at each column's centre, y against the busiest day's per-person average. */
  protected readonly averagePoints = computed<readonly AveragePoint[]>(() => {
    const days = this.days();
    const max = Math.max(0, ...days.map(perPerson));
    if (max <= 0) return [];
    return days.flatMap((d, i) =>
      d.peopleWithRecord > 0
        ? [{ x: ((i + 0.5) * 100) / days.length, y: 100 - (perPerson(d) * 100) / max }]
        : [],
    );
  });
  protected readonly averageLine = computed(() =>
    this.averagePoints()
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  );

  protected readonly bars = computed<readonly HoursBar[]>(() => {
    const days = this.days();
    const max = Math.max(0, ...days.map((d) => d.workedMinutes + d.breakMinutes));
    const share = (n: number) => (max > 0 ? Math.round((n * 1000) / max) / 10 : 0);
    return days.map((d) => ({
      date: d.date,
      label: weekday(d.date),
      worked: share(d.workedMinutes),
      break: share(d.breakMinutes),
      onLeave: d.onLeaveCount,
      tooltip:
        `${weekday(d.date)} ${d.date}: ${minutesText(d.workedMinutes)} worked, ${minutesText(d.breakMinutes)} break` +
        `, ${d.peopleWithRecord} clocked in` +
        (d.onLeaveCount > 0 ? `, ${d.onLeaveCount} on leave` : ''),
    }));
  });

  protected readonly summary = computed(() => {
    const days = this.days();
    const byDay = days
      .map((d) => `${weekday(d.date)}: ${minutesText(d.workedMinutes)} worked, ${minutesText(d.breakMinutes)} break`)
      .join('; ');
    if (!this.teamAverage()) return `Team working hours by day. ${byDay}`;
    const records = days.reduce((n, d) => n + d.peopleWithRecord, 0);
    const worked = days.reduce((n, d) => n + d.workedMinutes, 0);
    const average = records > 0 ? `${minutesText(worked / records)} average per person` : 'no average yet';
    return `Team working hours by day, ${average}. ${byDay}`;
  });
}
