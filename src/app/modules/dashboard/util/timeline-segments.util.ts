import { ActivityTimelineSegment } from '../models/activity-timeline.model';
import { BreakInterval } from '../../attendance/models/time-tracking.model';

export interface TimelineSegment {
  readonly type: 'working' | 'break' | 'focus' | 'idle';
  readonly widthPercent: number;
}

export const SEGMENT_LABELS: Record<TimelineSegment['type'], string> = {
  working: 'Working',
  break: 'Break',
  focus: 'Focus work',
  idle: 'Idle time'
};

/** Single source of truth for timeline segment colors, shared by the compact Today at a
 * Glance strip and the full Activity Timeline page so the two never visually disagree. */
export const SEGMENT_COLORS: Record<TimelineSegment['type'], string> = {
  working: 'var(--color-accent)',
  break: 'var(--color-border)',
  focus: 'var(--color-accent)',
  idle: 'var(--color-border)'
};

export const SEGMENT_OPACITY: Record<TimelineSegment['type'], number> = {
  working: 1,
  break: 1,
  focus: 1,
  idle: 0.4
};

interface Interval {
  start: number;
  end: number;
}

/** Builds a proportional working/break/focus/idle timeline for [start, end), by carving out
 * break intervals first and then subdividing the remaining working time with activity data. */
export function buildTimelineSegments(
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

export function formatTime(date: Date): string | null {
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function formatMinutes(value: number | null): string {
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
