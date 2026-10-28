import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { downloadCsv, toCsv } from '../../../../shared/utils/csv.util';
import { LedTimeProgress } from '../../models/team-progress-detail.model';
import { clockTime } from '../../utils/team-presence-format.util';
import {
  comparisonText,
  coverageTooltip,
  hoursText,
  minutesText,
} from '../../utils/team-progress-time-format.util';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The Team Progress popup's planned-vs-worked sections (My Team widgets design 2026-10-29, section 6.1): planned, in-plan
 * and unscheduled minutes per day (week) or ISO week (month), the unscheduled work list and the workload ranking, each
 * list with CSV export. Minutes of planned / worked time only - never estimate hours, never on the allocation's axis.
 */
@Component({
  selector: 'app-team-progress-time-detail',
  standalone: true,
  templateUrl: './team-progress-time-detail.component.html',
  styleUrl: './team-progress-time-detail.component.css',
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamProgressTimeDetailComponent {
  readonly time = input<LedTimeProgress | null>(null);
  readonly status = input<'loading' | 'ready' | 'error'>('loading');
  readonly retried = output<void>();

  /** The file download; a field so a test can stand in for the browser download. */
  downloadFile = downloadCsv;

  protected readonly periodLabel = computed(() =>
    this.time()?.period === 'month' ? 'This month' : 'This week',
  );
  protected readonly comparison = computed(() => {
    const t = this.time();
    return t ? comparisonText(t.coveragePercent, t.previous.coveragePercent, t.period) : null;
  });
  protected readonly tooltip = computed(() => {
    const t = this.time();
    return t ? coverageTooltip(t) : '';
  });

  /** One column per bucket; planned and worked bars scale against the busiest bucket. */
  protected readonly buckets = computed(() => {
    const t = this.time();
    if (!t) return [];
    const max = Math.max(
      0,
      ...t.buckets.map((b) =>
        Math.max(b.plannedMinutes, b.scheduledMinutes + b.unscheduledMinutes),
      ),
    );
    const share = (n: number) => (max > 0 ? (n * 100) / max : 0);
    return t.buckets.map((b) => ({
      key: b.from,
      label: this.bucketLabel(b.from, b.to),
      planned: share(b.plannedMinutes),
      scheduled: share(b.scheduledMinutes),
      unscheduled: share(b.unscheduledMinutes),
      tooltip: `${this.bucketLabel(b.from, b.to)}: planned ${minutesText(b.plannedMinutes)}, in plan ${minutesText(b.scheduledMinutes)}, unscheduled ${minutesText(b.unscheduledMinutes)}`,
    }));
  });

  protected minutes(m: number): string {
    return minutesText(m);
  }

  protected hours(m: number): string {
    return hoursText(m);
  }

  protected percentText(value: number | null): string {
    return value === null ? '—' : `${value}%`;
  }

  protected range(start: string, end: string): string {
    return `${new Date(start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${clockTime(start)}–${clockTime(end)}`;
  }

  exportUnscheduled(): void {
    const t = this.time();
    if (!t) return;
    const header = ['Person', 'Task', 'Title', 'Start', 'End', 'Minutes', 'Kind'];
    const lines = t.unscheduled.map((u) => [
      u.displayName,
      u.shortId,
      u.title,
      u.start,
      u.end,
      String(u.minutes),
      u.kind === 'no_plan' ? 'No plan' : 'Outside slot',
    ]);
    this.downloadFile(`team-unscheduled-work-${t.from}_${t.to}.csv`, toCsv([header, ...lines]));
  }

  exportWorkload(): void {
    const t = this.time();
    if (!t) return;
    const header = [
      'Rank',
      'Person',
      'Planned min',
      'Worked min',
      'Unscheduled min',
      'Expected min',
      'Utilization %',
    ];
    const lines = t.workload.map((w) => [
      String(w.rank),
      w.displayName,
      String(w.plannedMinutes),
      String(w.clockedMinutes),
      String(w.unscheduledMinutes),
      w.expectedMinutes === null ? '' : String(w.expectedMinutes),
      w.utilizationPercent === null ? '' : String(w.utilizationPercent),
    ]);
    this.downloadFile(`team-workload-${t.from}_${t.to}.csv`, toCsv([header, ...lines]));
  }

  private bucketLabel(from: string, to: string): string {
    const [y, m, d] = from.split('-').map(Number);
    if (from === to) return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${d}–${Number(to.split('-')[2])}`;
  }
}
