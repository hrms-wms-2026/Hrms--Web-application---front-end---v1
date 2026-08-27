import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { TimeTrackingRange } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { WorkPatternApiService } from '../../data-access/work-pattern-api.service';
import { WorkPatternDay } from '../../models/work-pattern.model';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export type WorkPatternSegmentType = 'focus' | 'meeting' | 'admin' | 'idle';

export interface WorkPatternSegment {
  readonly type: WorkPatternSegmentType;
  readonly minutes: number;
  readonly widthPercent: number;
}

@Component({
  selector: 'app-work-pattern-card',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './work-pattern-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkPatternCardComponent implements OnInit {
  private readonly api = inject(WorkPatternApiService);
  private readonly store = inject(TimeTrackingStore);

  private readonly rawDays = signal<WorkPatternDay[]>([]);
  protected readonly loading = signal(true);

  private readonly focusMinutes = computed(() => sumBy(this.rawDays(), (d) => d.focusMinutes));
  private readonly meetingMinutes = computed(() => sumBy(this.rawDays(), (d) => d.meetingMinutes));
  private readonly adminMinutes = computed(() => sumBy(this.rawDays(), (d) => d.adminMinutes));
  private readonly idleMinutes = computed(() => sumBy(this.rawDays(), (d) => d.idleMinutes));

  protected readonly weeklyWorkedMinutes = computed(() =>
    this.store.history().reduce((sum, row) => sum + row.totalWorkedMinutes, 0)
  );

  protected readonly productiveMinutes = computed(
    () => this.focusMinutes() + this.meetingMinutes() + this.adminMinutes()
  );

  protected readonly weeklyWorkedLabel = computed(() => formatHours(this.weeklyWorkedMinutes()));
  protected readonly productiveLabel = computed(() => formatHours(this.productiveMinutes()));
  protected readonly focusLabel = computed(() => formatHours(this.focusMinutes()));
  protected readonly meetingLabel = computed(() => formatHours(this.meetingMinutes()));
  protected readonly adminLabel = computed(() => formatHours(this.adminMinutes()));
  protected readonly idleLabel = computed(() => formatHours(this.idleMinutes()));

  // Percentages are relative to weekly worked hours (attendance clock-in time), not to the sum
  // of the monitoring categories - tray-app coverage rarely spans 100% of worked time, so the
  // bar intentionally doesn't fill the full container in that gap.
  protected readonly segments = computed<WorkPatternSegment[]>(() => {
    const denominator = this.weeklyWorkedMinutes();
    if (denominator <= 0) {
      return [];
    }
    const raw: { type: WorkPatternSegmentType; minutes: number }[] = [
      { type: 'focus', minutes: this.focusMinutes() },
      { type: 'meeting', minutes: this.meetingMinutes() },
      { type: 'admin', minutes: this.adminMinutes() },
      { type: 'idle', minutes: this.idleMinutes() }
    ];
    const total = raw.reduce((sum, s) => sum + s.minutes, 0);
    const scale = total > denominator ? denominator / total : 1; // never overflow the bar
    return raw
      .filter((s) => s.minutes > 0)
      .map((s) => ({ ...s, widthPercent: ((s.minutes * scale) / denominator) * 100 }));
  });

  ngOnInit(): void {
    const range = currentWeekRange();
    void this.store.loadMyHistory(range);
    this.api.getMyWorkPattern(range.from, range.to).subscribe({
      next: (response) => {
        this.rawDays.set(response.days);
        this.loading.set(false);
      },
      error: () => {
        this.rawDays.set([]);
        this.loading.set(false);
      }
    });
  }

  protected segmentPercentLabel(segment: WorkPatternSegment): string {
    return `${segment.widthPercent.toFixed(1)}%`;
  }

  protected segmentLabel(type: WorkPatternSegmentType): string {
    return SEGMENT_LABELS[type];
  }
}

const SEGMENT_LABELS: Record<WorkPatternSegmentType, string> = {
  focus: 'Focus work',
  meeting: 'Meeting time',
  admin: 'Admin / other work',
  idle: 'Idle time'
};

function sumBy<T>(items: readonly T[], selector: (item: T) => number): number {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

function currentWeekRange(reference = new Date()): TimeTrackingRange {
  const referenceDay = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const dayOfWeek = referenceDay.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(referenceDay.getTime() + mondayOffset * DAY_IN_MILLISECONDS);
  const sunday = new Date(monday.getTime() + 6 * DAY_IN_MILLISECONDS);
  return { from: toDateOnly(monday), to: toDateOnly(sunday) };
}

function toDateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatHours(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
