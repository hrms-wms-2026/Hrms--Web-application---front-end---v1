import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TeamAttendanceTrendPoint } from '../../models/team-attendance.model';

type SegmentKind = 'present' | 'late' | 'absent' | 'leave';

interface DaySegment {
  readonly kind: SegmentKind;
  /** Share of the busiest day's column (0-100). */
  readonly height: number;
}

interface DayBar {
  readonly date: string;
  readonly label: string;
  readonly segments: readonly DaySegment[];
  readonly tooltip: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Weekday, day and month of a yyyy-MM-dd date, read in UTC so no time zone can shift it. */
function parts(iso: string): { weekday: string; day: number; month: string } {
  const [year, month, day] = iso.split('-').map(Number);
  return { weekday: WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()], day, month: MONTHS[month - 1] ?? '' };
}

function percent(value: number, max: number): number {
  return max > 0 ? Math.round((value * 1000) / max) / 10 : 0;
}

/**
 * Employee-days per date as stacked bars: present at the bottom, then late, absent and on leave. Columns scale
 * against the busiest day, so a quiet week still reads. A week is labelled by weekday, a month by day number
 * (every 5th when compact). Shared by the Team attendance card and its detail dialog.
 */
@Component({
  selector: 'app-attendance-day-chart',
  standalone: true,
  templateUrl: './attendance-day-chart.component.html',
  styleUrl: './attendance-day-chart.component.css',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceDayChartComponent {
  readonly points = input.required<readonly TeamAttendanceTrendPoint[]>();
  /** Thins the month labels where space is tight. */
  readonly compact = input(false);

  protected readonly bars = computed<readonly DayBar[]>(() => {
    const points = this.points();
    const max = Math.max(0, ...points.map((p) => p.present + p.late + p.absent + p.onLeave));
    const isWeek = points.length <= 7;
    return points.map((p) => {
      const { weekday, day, month } = parts(p.date);
      const label = isWeek ? weekday : !this.compact() || day === 1 || day % 5 === 0 ? String(day) : '';
      const segments: DaySegment[] = (
        [
          ['present', p.present],
          ['late', p.late],
          ['absent', p.absent],
          ['leave', p.onLeave]
        ] as const
      )
        .filter(([, count]) => count > 0)
        .map(([kind, count]) => ({ kind, height: percent(count, max) }));
      const tooltip =
        `${weekday} ${day} ${month}: ${p.present} present, ${p.late} late, ${p.absent} absent, ${p.onLeave} on leave` +
        (p.rate === null ? '' : ` (${p.rate}%)`);
      return { date: p.date, label, segments, tooltip };
    });
  });

  protected readonly summary = computed(() =>
    'Attendance by day. ' +
    this.points()
      .map((p) => {
        const { weekday, day, month } = parts(p.date);
        return `${weekday} ${day} ${month}: ${p.rate === null ? 'no data' : `${p.rate}%`}`;
      })
      .join('; ')
  );
}
