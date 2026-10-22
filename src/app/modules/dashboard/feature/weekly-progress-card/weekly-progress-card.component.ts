import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TimeTrackingApiService } from '../../../attendance/data-access/time-tracking-api.service';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { formatMinutes } from '../../util/timeline-segments.util';

/** Used per working day when today carries no required time (a weekend or a day without a schedule). */
const DEFAULT_DAY_MINUTES = 480;
/** Ring circumference for r = 50. */
const RING_LENGTH = 2 * Math.PI * 50;

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday to Sunday of the browser-local week containing `now`, plus today, as yyyy-MM-dd. */
export function weekRange(now: Date): { from: string; to: string; today: string } {
  const sinceMonday = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday);
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday + 6);
  return { from: isoDate(monday), to: isoDate(sunday), today: isoDate(now) };
}

function safeMinutes(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Small card: a ring of the hours worked this week (Monday to Sunday) against the week's target.
 * Past days come from the attendance history, today from the live today-summary (so it keeps up with
 * the other cards). The target is the week's working days (the expected-workday calendar behind
 * monthly-summary: legal-entity week, holidays) times today's required time, 8h when today has none.
 */
@Component({
  selector: 'app-weekly-progress-card',
  standalone: true,
  templateUrl: './weekly-progress-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyProgressCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);
  private readonly api = inject(TimeTrackingApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly today = this.store.today;
  /** Minutes worked this week before today. */
  private readonly earlierMinutes = signal(0);
  private readonly workingDays = signal<number | null>(null);
  protected readonly failed = signal(false);

  protected readonly workedMinutes = computed(() => this.earlierMinutes() + safeMinutes(this.today()?.totalWorkedMinutes));
  protected readonly targetMinutes = computed(() => {
    const days = this.workingDays();
    if (days === null) return 0;
    return days * (safeMinutes(this.today()?.requiredWorkMinutes) || DEFAULT_DAY_MINUTES);
  });

  protected readonly workedLabel = computed(() => formatMinutes(this.workedMinutes()));
  protected readonly targetLabel = computed(() => (this.targetMinutes() > 0 ? formatMinutes(this.targetMinutes()) : '—'));
  protected readonly percent = computed(() => {
    const target = this.targetMinutes();
    return target > 0 ? Math.round((this.workedMinutes() / target) * 100) : 0;
  });

  /** stroke-dasharray for the blue arc; a full week (or more) closes the ring. */
  protected readonly ringDash = computed(() => {
    const filled = (Math.min(100, this.percent()) / 100) * RING_LENGTH;
    return `${filled} ${RING_LENGTH}`;
  });

  ngOnInit(): void {
    void this.store.loadToday();

    const week = weekRange(new Date());
    forkJoin({
      history: this.api.getMyHistory(week.from, week.today, 1, 7),
      summary: this.api.getMyMonthlySummary(week.from, week.to)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ history, summary }) => {
          const earlier = (history.items ?? [])
            .filter((row) => row.workDate.slice(0, 10) !== week.today)
            .reduce((sum, row) => sum + safeMinutes(row.totalWorkedMinutes), 0);
          this.earlierMinutes.set(earlier);
          this.workingDays.set(safeMinutes(summary.workingDays));
        },
        error: () => this.failed.set(true)
      });
  }
}
