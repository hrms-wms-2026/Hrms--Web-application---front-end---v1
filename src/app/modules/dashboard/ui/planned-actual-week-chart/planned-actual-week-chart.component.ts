import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  PLANNED_ACTUAL_COLORS,
  PlannedActualDay,
  actualOf,
  plannedActualShare,
} from '../../utils/planned-actual-format.util';
import { minutesText } from '../../utils/team-presence-format.util';

interface WeekColumn {
  readonly date: string;
  readonly label: string;
  readonly today: boolean;
  readonly future: boolean;
  /** Shares (0-100) of the busiest column. */
  readonly planned: number;
  readonly scheduled: number;
  readonly outside: number;
  readonly noPlan: number;
  readonly tooltip: string;
}

interface CoveragePoint {
  readonly x: number;
  readonly y: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/**
 * Planned vs actual by day (2026-11-02 design match section 7.4): per column a light planned bar beside the actual bar
 * stacked in plan / outside slot / no plan, both against the busiest column; a coverage % line on its own 0-100% right
 * axis (days without coverage have no point); today marked; future days planned only. Team Progress passes week buckets
 * of a month with their own labels.
 */
@Component({
  selector: 'app-planned-actual-week-chart',
  standalone: true,
  templateUrl: './planned-actual-week-chart.component.html',
  styleUrl: './planned-actual-week-chart.component.css',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlannedActualWeekChartComponent {
  readonly days = input.required<readonly PlannedActualDay[]>();
  /** yyyy-MM-dd; later dates are future (planned only). Null = nothing is future. */
  readonly today = input<string | null>(null);
  readonly coverageLine = input(true);
  /** Column labels; the weekday names of the dates when unset. */
  readonly labels = input<readonly string[] | null>(null);

  protected readonly colors = PLANNED_ACTUAL_COLORS;

  protected readonly columns = computed<readonly WeekColumn[]>(() => {
    const days = this.days();
    const today = this.today();
    const labels = this.labels();
    const isFuture = (d: PlannedActualDay) => today !== null && d.date > today;
    const scale = Math.max(
      1,
      ...days.map((d) => Math.max(d.planned, isFuture(d) ? 0 : actualOf(d))),
    );
    return days.map((d, i) => {
      const future = isFuture(d);
      const label = labels?.[i] ?? weekday(d.date);
      return {
        date: d.date,
        label,
        today: d.date === today,
        future,
        planned: plannedActualShare(d.planned, scale),
        scheduled: future ? 0 : plannedActualShare(d.scheduled, scale),
        outside: future ? 0 : plannedActualShare(d.outside, scale),
        noPlan: future ? 0 : plannedActualShare(d.noPlan, scale),
        tooltip: future
          ? `${label}: planned ${minutesText(d.planned)}`
          : `${label}: planned ${minutesText(d.planned)}, actual ${minutesText(actualOf(d))} ` +
            `(${minutesText(d.scheduled)} in plan, ${minutesText(d.outside)} outside slot, ${minutesText(d.noPlan)} no plan)`,
      };
    });
  });

  protected readonly coveragePoints = computed<readonly CoveragePoint[]>(() => {
    if (!this.coverageLine()) return [];
    const days = this.days();
    return days.flatMap((d, i) =>
      d.coveragePercent === null
        ? []
        : [
            {
              x: ((i + 0.5) * 100) / days.length,
              y: 100 - Math.min(100, Math.max(0, d.coveragePercent)),
            },
          ],
    );
  });
  protected readonly coverageLinePoints = computed(() =>
    this.coveragePoints()
      .map((p) => `${p.x},${p.y}`)
      .join(' '),
  );

  protected readonly summary = computed(() => {
    const today = this.today();
    const labels = this.labels();
    return (
      'Planned vs actual by day. ' +
      this.days()
        .map((d, i) => {
          const label = labels?.[i] ?? weekday(d.date);
          if (today !== null && d.date > today)
            return `${label}: planned ${minutesText(d.planned)}`;
          const coverage = d.coveragePercent === null ? '' : `, coverage ${d.coveragePercent}%`;
          return `${label}: planned ${minutesText(d.planned)}, actual ${minutesText(actualOf(d))}${coverage}`;
        })
        .join('; ')
    );
  });
}
