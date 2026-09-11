import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { TimeTrackingRange } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { WorkPatternApiService } from '../../data-access/work-pattern-api.service';
import { WorkPatternDay } from '../../models/work-pattern.model';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export type WorkPatternPeriod = 'this-week' | 'last-week' | 'this-month' | 'last-month';

export const WORK_PATTERN_PERIOD_OPTIONS: ReadonlyArray<{ value: WorkPatternPeriod; label: string }> = [
  { value: 'this-week', label: 'This Week' },
  { value: 'last-week', label: 'Last Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' }
];

export type WorkPatternSegmentType = 'focus' | 'meeting' | 'admin' | 'idle';

export interface WorkPatternSegment {
  readonly type: WorkPatternSegmentType;
  readonly minutes: number;
  readonly widthPercent: number;
}

@Component({
  selector: 'app-work-pattern-card',
  standalone: true,
  imports: [],
  templateUrl: './work-pattern-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkPatternCardComponent implements OnInit {
  private readonly api = inject(WorkPatternApiService);
  private readonly store = inject(TimeTrackingStore);

  private readonly rawDays = signal<WorkPatternDay[]>([]);
  protected readonly loading = signal(true);
  protected readonly lastUpdated = signal<Date | null>(null);
  protected readonly selectedPeriod = signal<WorkPatternPeriod>('this-week');
  protected readonly periodDropdownOpen = signal(false);
  protected readonly periodOptions = WORK_PATTERN_PERIOD_OPTIONS;

  // Label shown on the trigger pill
  protected readonly selectedPeriodLabel = computed(
    () => WORK_PATTERN_PERIOD_OPTIONS.find((o) => o.value === this.selectedPeriod())!.label
  );

  // "Total this week" / "Total this month" etc. - lowercased since it's used mid-sentence.
  protected readonly periodLabelLower = computed(
    () => WORK_PATTERN_PERIOD_OPTIONS.find((o) => o.value === this.selectedPeriod())!.label.toLowerCase()
  );

  private readonly focusMinutes = computed(() => sumBy(this.rawDays(), (d) => d.focusMinutes));
  private readonly meetingMinutes = computed(() => sumBy(this.rawDays(), (d) => d.meetingMinutes));
  private readonly adminMinutes = computed(() => sumBy(this.rawDays(), (d) => d.adminMinutes));
  private readonly idleMinutes = computed(() => sumBy(this.rawDays(), (d) => d.idleMinutes));

  protected readonly weeklyWorkedMinutes = computed(() =>
    this.store.history().reduce((sum, row) => sum + row.totalWorkedMinutes, 0)
  );

  // Six 0h tiles read as broken, not empty - show an intentional empty state instead
  // once we know there's genuinely nothing to report (has attendance history loaded, all zero).
  protected readonly hasActivity = computed(() => this.weeklyWorkedMinutes() > 0);

  protected readonly productiveMinutes = computed(
    () => this.focusMinutes() + this.meetingMinutes() + this.adminMinutes()
  );

  protected readonly weeklyWorkedLabel = computed(() => formatHours(this.weeklyWorkedMinutes()));
  protected readonly productiveLabel = computed(() => formatHours(this.productiveMinutes()));
  protected readonly focusLabel = computed(() => formatHours(this.focusMinutes()));
  protected readonly meetingLabel = computed(() => formatHours(this.meetingMinutes()));
  protected readonly adminLabel = computed(() => formatHours(this.adminMinutes()));
  protected readonly idleLabel = computed(() => formatHours(this.idleMinutes()));

  // Same denominator as the segment bar below - weekly worked minutes, not the monitoring total.
  protected readonly productivePercentLabel = computed(() => {
    const denominator = this.weeklyWorkedMinutes();
    if (denominator <= 0) return '—';
    const percent = Math.min(100, (this.productiveMinutes() / denominator) * 100);
    return `${Math.round(percent)}%`;
  });

  protected readonly lastUpdatedLabel = computed(() => {
    const d = this.lastUpdated();
    return d
      ? new Intl.DateTimeFormat(undefined, {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          day: 'numeric',
          month: 'short'
        }).format(d)
      : '';
  });

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
    this.loadForPeriod(this.selectedPeriod());
  }

  protected onPeriodChange(value: string): void {
    const period = value as WorkPatternPeriod;
    this.selectedPeriod.set(period);
    this.loadForPeriod(period);
  }

  protected togglePeriodDropdown(event: Event): void {
    event.stopPropagation();
    this.periodDropdownOpen.update((v) => !v);
  }

  protected selectPeriod(value: WorkPatternPeriod): void {
    this.periodDropdownOpen.set(false);
    if (value !== this.selectedPeriod()) {
      this.onPeriodChange(value);
    }
  }

  protected closePeriodDropdown(): void {
    this.periodDropdownOpen.set(false);
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.periodDropdownOpen()) {
      this.periodDropdownOpen.set(false);
    }
  }

  private loadForPeriod(period: WorkPatternPeriod): void {
    this.loading.set(true);
    const range = rangeForPeriod(period);
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
    this.lastUpdated.set(new Date());
  }

  protected segmentPercentLabel(segment: WorkPatternSegment): string {
    return `${segment.widthPercent.toFixed(1)}%`;
  }

  protected segmentLabel(type: WorkPatternSegmentType): string {
    return SEGMENT_LABELS[type];
  }

  protected segmentColor(type: WorkPatternSegmentType): string {
    switch (type) {
      case 'focus':
        return '#2563eb';
      case 'meeting':
        return '#60a5fa';
      case 'admin':
        return '#94a3b8';
      case 'idle':
        return '#f59e0b';
    }
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

function rangeForPeriod(period: WorkPatternPeriod, reference = new Date()): TimeTrackingRange {
  switch (period) {
    case 'this-week':
      return currentWeekRange(reference);
    case 'last-week':
      return currentWeekRange(new Date(reference.getTime() - 7 * DAY_IN_MILLISECONDS));
    case 'this-month':
      return monthRange(reference.getFullYear(), reference.getMonth());
    case 'last-month': {
      const lastMonthReference = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
      return monthRange(lastMonthReference.getFullYear(), lastMonthReference.getMonth());
    }
  }
}

function currentWeekRange(reference = new Date()): TimeTrackingRange {
  const referenceDay = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const dayOfWeek = referenceDay.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(referenceDay.getTime() + mondayOffset * DAY_IN_MILLISECONDS);
  const sunday = new Date(monday.getTime() + 6 * DAY_IN_MILLISECONDS);
  return { from: toDateOnly(monday), to: toDateOnly(sunday) };
}

function monthRange(year: number, month: number): TimeTrackingRange {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return { from: toDateOnly(firstDay), to: toDateOnly(lastDay) };
}

function toDateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatHours(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
