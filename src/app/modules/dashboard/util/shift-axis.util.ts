import { AttendanceTodayResponse } from '../../attendance/models/time-tracking.model';
import { localPartsToUtcIso } from '../../../shared/utils/timezone.util';

const HOUR_MS = 60 * 60_000;
const QUARTER_MS = 15 * 60_000;

export interface ShiftAxisTick {
  /** Position along the bar, 0-100. */
  readonly pct: number;
  /** "9:00 AM" in the employee's timezone. */
  readonly label: string;
}

export interface ShiftAxis {
  readonly start: number;
  readonly end: number;
  /** Where clock-in sits (0 when there is none yet); the stretch before it is time not worked. */
  readonly offsetPct: number;
  /** Clock-in to clock-out (or now) - the part the activity segments fill. */
  readonly workedPct: number;
  /** The "now" marker; null once clocked out or when now is off the bar. */
  readonly nowPct: number | null;
  readonly ticks: readonly ShiftAxisTick[];
}

type AxisSource = Pick<
  AttendanceTodayResponse,
  'workDate' | 'timezone' | 'scheduledStartTime' | 'scheduledEndTime' | 'requiredWorkMinutes' | 'clockInAt' | 'clockOutAt'
>;

function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/** The scheduled shift as epoch ms in the employee's timezone; an end before the start runs past midnight. */
function shiftWindow(source: AxisSource): { start: number; end: number } | null {
  const { workDate, timezone, scheduledStartTime, scheduledEndTime } = source;
  if (!workDate || !scheduledStartTime || !scheduledEndTime) return null;
  const tz = timezone || 'UTC';
  const start = toMs(localPartsToUtcIso(workDate, scheduledStartTime, tz));
  let end = toMs(localPartsToUtcIso(workDate, scheduledEndTime, tz));
  if (start === null || end === null) return null;
  if (end <= start) end += 24 * HOUR_MS;
  return { start, end };
}

/** Whole hours of `timezone` within [start, end], labelled "9:00 AM". */
function hourTicks(start: number, end: number, timezone: string): ShiftAxisTick[] {
  const minuteOf = new Intl.DateTimeFormat('en-US', { timeZone: timezone, minute: 'numeric' });
  const label = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' });
  const span = end - start;
  // Every timezone offset is a multiple of 15 minutes, so the first whole hour is on a quarter boundary.
  let t = Math.ceil(start / QUARTER_MS) * QUARTER_MS;
  while (t <= end && Number(minuteOf.format(t)) !== 0) t += QUARTER_MS;
  const ticks: ShiftAxisTick[] = [];
  for (; t <= end; t += HOUR_MS) {
    ticks.push({ pct: clampPct(((t - start) / span) * 100), label: label.format(t) });
  }
  return ticks;
}

/**
 * The Today's activity bar: from the scheduled shift start to its end, stretched to take in an early
 * clock-in and work past the end. Without a schedule it runs from clock-in to clock-in + the required
 * time (or now, if later). Null when there is neither a schedule nor a clock-in.
 */
export function buildShiftAxis(source: AxisSource, now: number): ShiftAxis | null {
  const shift = shiftWindow(source);
  const clockIn = toMs(source.clockInAt);
  const clockOut = clockIn === null ? null : toMs(source.clockOutAt);
  const workedEnd = clockIn === null ? null : (clockOut ?? Math.max(now, clockIn));

  let start: number;
  let end: number;
  if (shift) {
    start = Math.min(shift.start, clockIn ?? shift.start);
    end = Math.max(shift.end, workedEnd ?? shift.end);
  } else if (clockIn !== null && workedEnd !== null) {
    start = clockIn;
    end = Math.max(workedEnd, clockIn + Math.max(0, source.requiredWorkMinutes ?? 0) * 60_000);
  } else {
    return null;
  }
  const span = end - start;
  if (span <= 0) return null;

  const pct = (t: number) => clampPct(((t - start) / span) * 100);
  const offsetPct = clockIn === null ? 0 : pct(clockIn);
  const workedPct = clockIn === null || workedEnd === null ? 0 : pct(workedEnd) - offsetPct;
  const nowPct = clockOut === null && now >= start && now <= end ? pct(now) : null;

  return { start, end, offsetPct, workedPct, nowPct, ticks: hourTicks(start, end, source.timezone || 'UTC') };
}

export type DayBlockType = 'working' | 'break' | 'leave';

/** Narrowest a Break or Leave block is drawn (% of the bar), so a 2-minute break is still visible. */
export const MIN_BLOCK_PCT = 1.5;

export interface DayBlock {
  readonly type: DayBlockType;
  /** Start and width along the bar, 0-100. */
  readonly leftPct: number;
  readonly widthPct: number;
}

export interface TimeInterval {
  readonly start: string;
  readonly end: string | null;
}

interface Span {
  start: number;
  end: number;
}

/** `spans` minus every interval in `cuts`. */
function subtract(spans: Span[], cuts: Span[]): Span[] {
  return cuts.reduce(
    (rest, cut) =>
      rest.flatMap((s) =>
        cut.end <= s.start || cut.start >= s.end
          ? [s]
          : [
              ...(cut.start > s.start ? [{ start: s.start, end: cut.start }] : []),
              ...(cut.end < s.end ? [{ start: cut.end, end: s.end }] : [])
            ]
      ),
    spans
  );
}

/**
 * Solid blocks for the activity bar. Working is clock-in to clock-out (or now) less breaks and leave;
 * breaks are drawn within that span (an open break runs to now); approved leave is drawn wherever it
 * falls on the bar, before or after now. Everything is clipped to the axis; the rest is Upcoming.
 */
export function buildDayBlocks(
  axis: ShiftAxis,
  source: Pick<AttendanceTodayResponse, 'clockInAt' | 'clockOutAt'>,
  breaks: readonly TimeInterval[],
  leaves: readonly TimeInterval[],
  now: number
): DayBlock[] {
  const clip = (s: Span): Span | null => {
    const start = Math.max(s.start, axis.start);
    const end = Math.min(s.end, axis.end);
    return end > start ? { start, end } : null;
  };
  const toSpan = (i: TimeInterval, openEnd: number): Span | null => {
    const start = toMs(i.start);
    const end = i.end ? toMs(i.end) : openEnd;
    return start === null || end === null ? null : clip({ start, end });
  };

  const clockIn = toMs(source.clockInAt);
  const workedEnd = clockIn === null ? null : (toMs(source.clockOutAt) ?? Math.max(now, clockIn));
  const worked = clockIn !== null && workedEnd !== null ? clip({ start: clockIn, end: workedEnd }) : null;

  const leaveSpans = leaves.map((l) => toSpan(l, axis.end)).filter((s): s is Span => s !== null);
  const breakSpans = worked
    ? breaks
        .map((b) => toSpan(b, worked.end))
        .filter((s): s is Span => s !== null)
        .flatMap((b) => {
          const s = Math.max(b.start, worked.start);
          const e = Math.min(b.end, worked.end);
          return e > s ? subtract([{ start: s, end: e }], leaveSpans) : [];
        })
    : [];
  const span = axis.end - axis.start;
  // Short breaks and leave get the minimum width: one that ends at the bar's right edge or at now (a break
  // still running) grows to the left, so the "now" marker does not cover it; any other grows to the right.
  const minMs = (MIN_BLOCK_PCT / 100) * span;
  const widen = (s: Span, rightEdge: number): Span => {
    if (s.end - s.start >= minMs) return s;
    if (s.end >= rightEdge) return { start: Math.max(axis.start, s.end - minMs), end: s.end };
    const end = Math.min(axis.end, s.start + minMs);
    return { start: Math.max(axis.start, end - minMs), end };
  };
  const shownBreaks = breakSpans.map((b) => widen(b, worked ? worked.end : axis.end));
  const shownLeaves = leaveSpans.map((l) => widen(l, axis.end));
  const workingSpans = worked ? subtract([worked], [...shownBreaks, ...shownLeaves]) : [];

  const toBlock = (type: DayBlockType) => (s: Span): DayBlock => ({
    type,
    leftPct: clampPct(((s.start - axis.start) / span) * 100),
    widthPct: clampPct(((s.end - s.start) / span) * 100)
  });
  return [
    ...workingSpans.map(toBlock('working')),
    ...shownBreaks.map(toBlock('break')),
    ...shownLeaves.map(toBlock('leave'))
  ]
    .filter((b) => b.widthPct > 0)
    .sort((a, b) => a.leftPct - b.leftPct);
}
