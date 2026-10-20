import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { ActivityTimelineApiService } from '../../data-access/activity-timeline-api.service';
import { ActivityTimelineSegment } from '../../models/activity-timeline.model';
import { SEGMENT_COLORS, SEGMENT_OPACITY, TimelineSegment, formatMinutes, timelineMinutes } from '../../util/timeline-segments.util';

/** Gap between gauge segments, in path-length units (the arc is 100 long). */
const GAUGE_GAP = 1.5;

export interface TimeBreakdownRow {
  readonly key: TimelineSegment['type'];
  readonly label: string;
  readonly color: string;
  readonly opacity: number;
  readonly minutes: number;
  /** Tile tint + icon colour (Tailwind classes). */
  readonly tileClass: string;
  readonly iconClass: string;
  readonly valueClass: string;
}

export interface GaugeSegment {
  readonly key: string;
  readonly color: string;
  readonly opacity: number;
  /** stroke-dasharray / -dashoffset on the 100-long arc. */
  readonly dashArray: string;
  readonly dashOffset: number;
}

const BREAKDOWN_ROWS: readonly Omit<TimeBreakdownRow, 'color' | 'opacity' | 'minutes'>[] = [
  { key: 'working', label: 'Working', tileClass: 'bg-blue-50/80', iconClass: 'text-blue-600', valueClass: 'text-blue-700' },
  { key: 'focus', label: 'Focus work', tileClass: 'bg-indigo-50/80', iconClass: 'text-indigo-600', valueClass: 'text-indigo-700' },
  { key: 'break', label: 'Breaks', tileClass: 'bg-amber-50/80', iconClass: 'text-amber-600', valueClass: 'text-amber-700' },
  { key: 'idle', label: 'Idle', tileClass: 'bg-slate-100/80', iconClass: 'text-slate-500', valueClass: 'text-slate-600' }
];

/** Minutes, or 0 for anything missing or not a number - the API can omit fields. */
function safeMinutes(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Small card: a half-circle gauge split into where today's time went - Working, Focus work, Breaks,
 * Idle, from clock-in until now (or clock-out) - with the rest of the day's required time in grey,
 * worked time against the required time in the middle ("5h 20m of 8h"), and one tile per kind. That split is the same data the Good morning activity bar draws: breaks from the
 * today-summary, focus / idle from the desktop agent's activity timeline (asked for only when the
 * desktop tray is an allowed clock-in method, as Good morning does), the rest working.
 */
@Component({
  selector: 'app-today-total-time-card',
  standalone: true,
  templateUrl: './today-total-time-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayTotalTimeCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);
  private readonly activityApi = inject(ActivityTimelineApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly today = this.store.today;
  protected readonly loading = this.store.todayLoading;
  private readonly activity = signal<ActivityTimelineSegment[]>([]);
  private activityRequested = false;
  /** Ticks every minute so a running day keeps counting. */
  private readonly now = signal(Date.now());

  protected readonly workedMinutes = computed(() => safeMinutes(this.today()?.totalWorkedMinutes));
  protected readonly requiredMinutes = computed(() => safeMinutes(this.today()?.requiredWorkMinutes));

  protected readonly workedLabel = computed(() => formatMinutes(this.workedMinutes()));
  protected readonly targetLabel = computed(() => (this.requiredMinutes() > 0 ? `of ${formatMinutes(this.requiredMinutes())}` : 'no target today'));

  /** 0-1 share of the required time; a day without a target shows a full ring once any time is worked. */
  protected readonly progress = computed(() => {
    const required = this.requiredMinutes();
    if (required === 0) return this.workedMinutes() > 0 ? 1 : 0;
    return Math.min(1, this.workedMinutes() / required);
  });

  protected readonly breakdown = computed<TimeBreakdownRow[]>(() => {
    const today = this.today();
    const start = today?.clockInAt ? new Date(today.clockInAt).getTime() : NaN;
    const end = today?.clockOutAt ? new Date(today.clockOutAt).getTime() : this.now();
    const minutes = Number.isFinite(start) && Number.isFinite(end)
      ? timelineMinutes(start, end, today?.breaks ?? [], this.activity())
      : { working: 0, focus: 0, break: 0, idle: 0 };
    return BREAKDOWN_ROWS.map((row) => ({
      ...row,
      color: SEGMENT_COLORS[row.key],
      opacity: SEGMENT_OPACITY[row.key],
      minutes: minutes[row.key]
    }));
  });

  /**
   * The gauge, left to right: each kind's share of the day, then the grey remainder up to the
   * required time. The scale is the required time, or the time tracked when that is longer (or
   * there is no target), so a long day fills the arc instead of overflowing it.
   */
  protected readonly gauge = computed<GaugeSegment[]>(() => {
    const rows = this.breakdown().filter((row) => row.minutes > 0);
    const tracked = rows.reduce((sum, row) => sum + row.minutes, 0);
    const scale = Math.max(this.requiredMinutes(), tracked);
    if (scale === 0) return [];
    const parts = [
      ...rows.map((row) => ({ key: row.key, color: row.color, opacity: row.opacity, minutes: row.minutes })),
      { key: 'remaining', color: '#e2e8f0', opacity: 1, minutes: scale - tracked }
    ].filter((part) => part.minutes > 0);

    let start = 0;
    return parts.map((part, i) => {
      const length = (part.minutes / scale) * 100;
      const gap = i < parts.length - 1 ? GAUGE_GAP : 0;
      const segment: GaugeSegment = {
        key: part.key,
        color: part.color,
        opacity: part.opacity,
        dashArray: `${Math.max(0.01, length - gap)} 100`,
        dashOffset: -start
      };
      start += length;
      return segment;
    });
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    effect(() => {
      const today = this.today();
      if (!today?.allowedClockInMethods?.desktopTray || this.activityRequested) return;
      this.activityRequested = true;
      this.activityApi.getMyTimeline().subscribe({
        next: (response) => this.activity.set(response.segments ?? []),
        error: () => this.activity.set([])
      });
    });
  }

  ngOnInit(): void {
    void this.store.loadToday();
  }

  protected format(minutes: number): string {
    return formatMinutes(minutes);
  }
}
