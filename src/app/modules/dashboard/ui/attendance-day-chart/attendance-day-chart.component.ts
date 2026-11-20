import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TeamAttendanceTrendPoint } from '../../models/team-attendance.model';
import { TEAM_ATTENDANCE_COLORS } from '../../utils/team-attendance-format.util';
import {
  DashboardBar,
  DashboardBarChartComponent,
  DashboardBarChip,
  DashboardBarHeadline
} from '../../../../shared/ui/charts/dashboard-bar-chart/dashboard-bar-chart.component';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Weekday, day and month of a yyyy-MM-dd date, read in UTC so no time zone can shift it. */
function parts(iso: string): { weekday: string; day: number; month: string } {
  const [year, month, day] = iso.split('-').map(Number);
  return { weekday: WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()], day, month: MONTHS[month - 1] ?? '' };
}

/**
 * Employee-days per date as stacked bars (present at the bottom, then late, absent and on leave), drawn by the
 * shared dashboard bar chart. A week is labelled by weekday, a month by day number (every 5th when compact).
 * With a `heading`, the headline reads the title and the period's rate until a day is hovered, then that day's
 * rate and how many came in. Shared by the Team attendance card and its detail dialog.
 */
@Component({
  selector: 'app-attendance-day-chart',
  standalone: true,
  imports: [DashboardBarChartComponent],
  template: `
    <app-dashboard-bar-chart
      class="min-h-0 flex-1"
      data-testid="attendance-day-chart"
      [bars]="bars()"
      [headline]="headline()"
      [compactHeadline]="compact()"
      [ariaLabel]="summary()"
      emptyText="No attendance in this period"
    />
  `,
  host: { class: 'flex min-h-0 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceDayChartComponent {
  readonly points = input.required<readonly TeamAttendanceTrendPoint[]>();
  /** Thins the month labels and puts the headline on one line, where space is tight. */
  readonly compact = input(false);
  /** The headline's label ("Trend", "Daily attendance"); empty leaves the headline out. */
  readonly heading = input('');
  /** The period's rate for the headline ("95%"). */
  readonly rate = input('');
  /** A pill beside the rate (the change against the previous period). */
  readonly chip = input<DashboardBarChip | null>(null);

  protected readonly bars = computed<DashboardBar[]>(() => {
    const points = this.points();
    const isWeek = points.length <= 7;
    return points.map((p) => {
      const { weekday, day, month } = parts(p.date);
      const label = isWeek ? weekday : !this.compact() || day === 1 || day % 5 === 0 ? String(day) : '';
      const expected = p.present + p.late + p.absent;
      return {
        key: p.date,
        label,
        title: `${weekday} ${day} ${month}`,
        valueText: p.rate == null ? '—' : `${p.rate}%`,
        chip: expected > 0 ? `${p.present + p.late} of ${expected} in` : undefined,
        segments: [
          { key: 'present', value: p.present, color: TEAM_ATTENDANCE_COLORS.present },
          { key: 'late', value: p.late, color: TEAM_ATTENDANCE_COLORS.late },
          { key: 'absent', value: p.absent, color: TEAM_ATTENDANCE_COLORS.absent },
          { key: 'leave', value: p.onLeave, color: TEAM_ATTENDANCE_COLORS.leave }
        ],
        tooltip:
          `${weekday} ${day} ${month}: ${p.present} present, ${p.late} late, ${p.absent} absent, ${p.onLeave} on leave` +
          (p.rate == null ? '' : ` (${p.rate}%)`)
      };
    });
  });

  protected readonly headline = computed<DashboardBarHeadline | null>(() =>
    this.heading() ? { label: this.heading(), value: this.rate(), chip: this.chip() } : null
  );

  protected readonly summary = computed(() =>
    'Attendance by day. ' +
    this.points()
      .map((p) => {
        const { weekday, day, month } = parts(p.date);
        return `${weekday} ${day} ${month}: ${p.rate == null ? 'no data' : `${p.rate}%`}`;
      })
      .join('; ')
  );
}
