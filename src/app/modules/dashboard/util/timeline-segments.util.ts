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
  break: 'var(--color-warning)',
  focus: '#6366f1',
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

  return applyMinimumVisibleWidth(
    rawTimelineSegments(start, end, breaks, activity).map((s) => ({ type: s.type, widthPercent: ((s.end - s.start) / totalMs) * 100 }))
  );
}

/** Whole minutes of each kind over [start, end) - the same carve-up the timeline draws (breaks
 * first, then focus / idle from activity data, the rest working), as durations instead of widths. */
export function timelineMinutes(
  start: number,
  end: number,
  breaks: BreakInterval[],
  activity: ActivityTimelineSegment[]
): Record<TimelineSegment['type'], number> {
  const ms: Record<TimelineSegment['type'], number> = { working: 0, focus: 0, break: 0, idle: 0 };
  if (end > start) {
    for (const s of rawTimelineSegments(start, end, breaks, activity)) ms[s.type] += s.end - s.start;
  }
  return {
    working: Math.round(ms.working / 60_000),
    focus: Math.round(ms.focus / 60_000),
    break: Math.round(ms.break / 60_000),
    idle: Math.round(ms.idle / 60_000)
  };
}

function rawTimelineSegments(
  start: number,
  end: number,
  breaks: BreakInterval[],
  activity: ActivityTimelineSegment[]
): { type: TimelineSegment['type']; start: number; end: number }[] {
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
  return segments;
}

/** Below this width a segment renders as a sliver too thin to see (or to pick a color out of) in
 * the ~2px strip both timeline views use - real time that occurred still deserves a visible dab
 * of color instead of silently vanishing into its neighbor. Someone who starts and stops a break
 * a handful of times in quick succession (exactly what happens while manually testing the clock
 * in/break flow) previously rendered as one solid block of whichever type happened to end up
 * widest, because every in-between "working" gap was a fraction of a percent wide. */
const MIN_VISIBLE_WIDTH_PERCENT = 1.5;

/** Bumps every non-zero-duration segment up to `MIN_VISIBLE_WIDTH_PERCENT`, taking the extra
 * width proportionally from segments that have width to spare so the row still sums to 100%. */
function applyMinimumVisibleWidth(
  segments: { type: TimelineSegment['type']; widthPercent: number }[]
): TimelineSegment[] {
  const tooThin = segments.filter((s) => s.widthPercent > 0 && s.widthPercent < MIN_VISIBLE_WIDTH_PERCENT);
  if (tooThin.length === 0) {
    return segments;
  }

  const deficit = tooThin.reduce((sum, s) => sum + (MIN_VISIBLE_WIDTH_PERCENT - s.widthPercent), 0);
  const donorPool = segments
    .filter((s) => s.widthPercent >= MIN_VISIBLE_WIDTH_PERCENT)
    .reduce((sum, s) => sum + s.widthPercent, 0);

  // Every segment is already below the floor (e.g. a burst of very short activity blips) -
  // nothing to borrow width from, so leave the proportions as computed rather than distorting
  // them further.
  if (donorPool <= 0) {
    return segments;
  }

  return segments.map((s) => {
    if (s.widthPercent > 0 && s.widthPercent < MIN_VISIBLE_WIDTH_PERCENT) {
      return { type: s.type, widthPercent: MIN_VISIBLE_WIDTH_PERCENT };
    }
    if (s.widthPercent >= MIN_VISIBLE_WIDTH_PERCENT) {
      return { type: s.type, widthPercent: s.widthPercent - deficit * (s.widthPercent / donorPool) };
    }
    return s;
  });
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
