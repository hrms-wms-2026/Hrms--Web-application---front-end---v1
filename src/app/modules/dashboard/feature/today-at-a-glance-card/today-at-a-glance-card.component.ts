import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ActivityTimelineApiService } from '../../data-access/activity-timeline-api.service';
import { ActivityTimelineSegment } from '../../models/activity-timeline.model';
import { BreakInterval } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';

const STATUS_LABELS: Record<string, string> = {
  not_clocked_in: 'Not clocked in',
  clocked_in: 'Clocked in',
  on_break: 'On break',
  clocked_out: 'Clocked out'
};

export interface TimelineSegment {
  readonly type: 'working' | 'break' | 'focus' | 'idle';
  readonly widthPercent: number;
}

interface Interval {
  start: number;
  end: number;
}

@Component({
  selector: 'app-today-at-a-glance-card',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './today-at-a-glance-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayAtAGlanceCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);
  private readonly activityApi = inject(ActivityTimelineApiService);

  protected readonly today = this.store.today;
  protected readonly loading = this.store.todayLoading;

  private readonly activitySegments = signal<ActivityTimelineSegment[]>([]);
  private activityRequested = false;

  protected readonly statusLabel = computed(() => {
    const today = this.today();
    if (!today) {
      return '';
    }
    return today.attendanceStatusLabel?.trim() || STATUS_LABELS[today.attendanceStatus] || 'Not specified';
  });

  protected readonly clockInTimeLabel = computed(() => {
    const clockInAt = this.today()?.clockInAt;
    return clockInAt ? formatTime(new Date(clockInAt)) : null;
  });

  protected readonly workedTimeLabel = computed(() => formatMinutes(this.today()?.totalWorkedMinutes ?? null));

  protected readonly timelineSegments = computed<TimelineSegment[]>(() => {
    const today = this.today();
    if (!today?.clockInAt) {
      return [];
    }
    const start = new Date(today.clockInAt).getTime();
    const end = (today.clockOutAt ? new Date(today.clockOutAt) : new Date()).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return [];
    }
    return buildTimelineSegments(start, end, today.breaks, this.activitySegments());
  });

  protected readonly timelineEndLabel = computed(() => {
    const today = this.today();
    if (!today?.clockInAt) {
      return null;
    }
    return formatTime(today.clockOutAt ? new Date(today.clockOutAt) : new Date());
  });

  constructor() {
    effect(() => {
      const today = this.today();
      if (!today?.allowedClockInMethods.desktopTray || this.activityRequested) {
        return;
      }
      this.activityRequested = true;
      this.activityApi.getMyTimeline().subscribe({
        next: (response) => this.activitySegments.set(response.segments),
        error: () => this.activitySegments.set([])
      });
    });
  }

  ngOnInit(): void {
    void this.store.loadToday();
  }

  protected segmentLabel(type: TimelineSegment['type']): string {
    return SEGMENT_LABELS[type];
  }
}

const SEGMENT_LABELS: Record<TimelineSegment['type'], string> = {
  working: 'Working',
  break: 'Break',
  focus: 'Focus work',
  idle: 'Idle time'
};

function buildTimelineSegments(
  start: number,
  end: number,
  breaks: BreakInterval[],
  activity: ActivityTimelineSegment[]
): TimelineSegment[] {
  const totalMs = end - start;
  if (totalMs <= 0) {
    return [];
  }

  const breakIntervals = clip(
    breaks.map((b) => ({
      start: new Date(b.startedAt).getTime(),
      end: b.endedAt ? new Date(b.endedAt).getTime() : end
    })),
    start,
    end
  );
  const activityIntervals = clip(
    activity.map((a) => ({
      start: new Date(a.startedAt).getTime(),
      end: new Date(a.endedAt).getTime(),
      type: a.type
    })),
    start,
    end
  );

  const segments: { type: TimelineSegment['type']; start: number; end: number }[] = [];
  let cursor = start;
  for (const b of breakIntervals) {
    if (b.start > cursor) {
      segments.push(...subdivideWorking(cursor, b.start, activityIntervals));
    }
    segments.push({ type: 'break', start: b.start, end: b.end });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < end) {
    segments.push(...subdivideWorking(cursor, end, activityIntervals));
  }

  return segments.map((s) => ({ type: s.type, widthPercent: ((s.end - s.start) / totalMs) * 100 }));
}

/** Fills [rangeStart, rangeEnd) with focus/idle activity data where available, 'working' elsewhere. */
function subdivideWorking(
  rangeStart: number,
  rangeEnd: number,
  activity: (Interval & { type: 'focus' | 'idle' })[]
): { type: TimelineSegment['type']; start: number; end: number }[] {
  const clipped = clip(activity, rangeStart, rangeEnd);
  const result: { type: TimelineSegment['type']; start: number; end: number }[] = [];
  let cursor = rangeStart;
  for (const a of clipped) {
    if (a.start > cursor) {
      result.push({ type: 'working', start: cursor, end: a.start });
    }
    result.push({ type: a.type, start: a.start, end: a.end });
    cursor = Math.max(cursor, a.end);
  }
  if (cursor < rangeEnd) {
    result.push({ type: 'working', start: cursor, end: rangeEnd });
  }
  return result;
}

function clip<T extends Interval>(intervals: T[], start: number, end: number): T[] {
  return intervals
    .map((i) => ({ ...i, start: Math.max(start, i.start), end: Math.min(end, i.end) }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
}

function formatTime(date: Date): string | null {
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatMinutes(value: number | null): string {
  if (value === null || value < 0) {
    return '—';
  }
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
