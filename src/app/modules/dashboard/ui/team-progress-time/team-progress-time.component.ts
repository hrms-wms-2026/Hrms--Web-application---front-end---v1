import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LedTimeProgress } from '../../models/team-progress-detail.model';
import {
  bandShares,
  bucketChart,
  comparisonText,
  coverageTooltip,
  hoursText,
  localToday,
  minutesText,
} from '../../utils/team-progress-time-format.util';
import { PlannedActualWeekChartComponent } from '../planned-actual-week-chart/planned-actual-week-chart.component';

/** People the unscheduled-work panel lists. */
const UNSCHEDULED_TOP = 3;

/**
 * Team Progress's planned-vs-worked sections on the card (My Team widgets design 2026-10-29, section 6.1): the band
 * (scheduled shade 1, outside-slot shade 3, no-plan shade-3 stripes against the planned marker, coverage beside it), the
 * unscheduled-work callout and the top of the workload ranking. Minutes only: nothing here is an estimate hour or sits on
 * the allocation's axis. Which sections show is the card's layout plan.
 */
@Component({
  selector: 'app-team-progress-time',
  standalone: true,
  imports: [PlannedActualWeekChartComponent],
  templateUrl: './team-progress-time.component.html',
  styleUrl: './team-progress-time.component.css',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamProgressTimeComponent {
  readonly time = input<LedTimeProgress | null>(null);
  readonly error = input(false);
  readonly band = input(false);
  /** The bucket chart in the band's place (tall / large / maximum cards with room for it). */
  readonly chart = input(false);
  readonly callout = input(false);
  readonly workloadRows = input(0);

  protected readonly periodLabel = computed(() =>
    this.time()?.period === 'month' ? 'this month' : 'this week',
  );
  protected readonly shares = computed(() => {
    const time = this.time();
    return time ? bandShares(time) : null;
  });
  protected readonly unscheduledMinutes = computed(() => {
    const time = this.time();
    return time ? time.outsideSlotMinutes + time.noPlanMinutes : 0;
  });
  protected readonly comparison = computed(() => {
    const time = this.time();
    return time
      ? comparisonText(time.coveragePercent, time.previous.coveragePercent, time.period)
      : null;
  });
  protected readonly tooltip = computed(() => {
    const time = this.time();
    return time ? coverageTooltip(time) : '';
  });
  protected readonly chartData = computed(() => {
    const time = this.time();
    return time ? bucketChart(time, localToday()) : null;
  });
  /** The unscheduled panel: the people with the most unscheduled time, bars against the top one. */
  protected readonly unscheduledTop = computed(() => {
    const rows = (this.time()?.workload ?? [])
      .filter((w) => w.unscheduledMinutes > 0)
      .sort((a, b) => b.unscheduledMinutes - a.unscheduledMinutes || a.displayName.localeCompare(b.displayName))
      .slice(0, UNSCHEDULED_TOP);
    const max = Math.max(1, ...rows.map((w) => w.unscheduledMinutes));
    return rows.map((w) => ({ row: w, share: (w.unscheduledMinutes * 100) / max }));
  });
  protected readonly workload = computed(() =>
    (this.time()?.workload ?? []).slice(0, this.workloadRows()),
  );
  protected readonly workloadScale = computed(() =>
    Math.max(0, ...this.workload().map((w) => w.plannedMinutes)),
  );

  protected minutes(m: number): string {
    return minutesText(m);
  }

  protected hours(m: number): string {
    return hoursText(m);
  }

  protected percentText(value: number | null): string {
    return value === null ? '—' : `${value}%`;
  }
}
