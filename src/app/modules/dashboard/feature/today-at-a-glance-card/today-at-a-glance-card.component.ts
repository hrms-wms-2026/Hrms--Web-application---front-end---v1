import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { BreakInterval } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';

const STATUS_LABELS: Record<string, string> = {
  not_clocked_in: 'Not clocked in',
  clocked_in: 'Clocked in',
  on_break: 'On break',
  clocked_out: 'Clocked out'
};

export interface TimelineSegment {
  readonly type: 'working' | 'break';
  readonly widthPercent: number;
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

  protected readonly today = this.store.today;
  protected readonly loading = this.store.todayLoading;

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
    return buildTimelineSegments(start, end, today.breaks);
  });

  protected readonly timelineEndLabel = computed(() => {
    const today = this.today();
    if (!today?.clockInAt) {
      return null;
    }
    return formatTime(today.clockOutAt ? new Date(today.clockOutAt) : new Date());
  });

  ngOnInit(): void {
    void this.store.loadToday();
  }
}

function buildTimelineSegments(start: number, end: number, breaks: BreakInterval[]): TimelineSegment[] {
  const totalMs = end - start;
  const clippedBreaks = breaks
    .map((b) => ({
      start: Math.max(start, new Date(b.startedAt).getTime()),
      end: Math.min(end, b.endedAt ? new Date(b.endedAt).getTime() : end)
    }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
    .sort((a, b) => a.start - b.start);

  const segments: TimelineSegment[] = [];
  let cursor = start;
  for (const b of clippedBreaks) {
    if (b.start > cursor) {
      segments.push({ type: 'working', widthPercent: ((b.start - cursor) / totalMs) * 100 });
    }
    segments.push({ type: 'break', widthPercent: ((b.end - b.start) / totalMs) * 100 });
    cursor = b.end;
  }
  if (cursor < end) {
    segments.push({ type: 'working', widthPercent: ((end - cursor) / totalMs) * 100 });
  }
  return segments;
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
