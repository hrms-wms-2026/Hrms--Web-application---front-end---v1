import { CalendarEventResponse } from '../models/calendar-event.model';
import { PlannerRangeBlockView, PlannerWorkWindow } from '../../work/planner/models/planner.models';
import { utcIsoToLocalParts } from '../../../shared/utils/timezone.util';
import { TASK_KINDS, TaskKind, kindOf } from '../../work/utils/task-kind';

/**
 * Planner grid maths (2026-10-27 Planner = Calendar design, sections 4.3-4.5). Every minute is counted from local midnight
 * of the given date in the given zone; a range never leaves [0, 1440].
 */

export const DAY_MINUTES = 24 * 60;
export const SNAP_MINUTES = 15;
export const DEFAULT_DROP_MINUTES = 60;

export interface MinuteRange { start: number; end: number }
export interface BusyInterval extends MinuteRange { eventId: string; title: string }

/** Minutes after local midnight of `date`, clipped: an instant on an earlier day is 0, on a later day 1440. */
export function minuteOfDay(isoUtc: string, date: string, timezone: string): number {
  const local = utcIsoToLocalParts(isoUtc, timezone);
  if (local.date < date) return 0;
  if (local.date > date) return DAY_MINUTES;
  const [hour, minute] = local.time.split(':').map(Number);
  return (hour % 24) * 60 + minute;
}

/** The time on `date` that the user is busy with: timed events and task meetings, except all-day ones, cancelled ones,
 * and ones the employee declined (design calls C2/C3). */
export function busyIntervals(events: readonly CalendarEventResponse[], employeeId: string | null, date: string,
  timezone: string): BusyInterval[] {
  return events
    .filter((e) => !e.isAllDay && e.meetingStatus !== 'cancelled' && e.eventStatus !== 'cancelled'
      && !(employeeId && e.participants?.some((p) => p.employeeId === employeeId && p.responseStatus === 'declined')))
    .map((e) => ({
      eventId: e.id, title: e.title,
      start: minuteOfDay(e.startDate, date, timezone), end: minuteOfDay(e.endDate, date, timezone),
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
}

export function blockRange(block: Pick<PlannerRangeBlockView, 'startAt' | 'endAt'>, date: string, timezone: string): MinuteRange {
  return { start: minuteOfDay(block.startAt, date, timezone), end: minuteOfDay(block.endAt, date, timezone) };
}

/** The parts of `block` that busy items cover, one per item. */
export function overlapSegments(block: MinuteRange, busy: readonly BusyInterval[]): (MinuteRange & { eventId: string; title: string })[] {
  return busy
    .map((b) => ({ start: Math.max(block.start, b.start), end: Math.min(block.end, b.end), eventId: b.eventId, title: b.title }))
    .filter((s) => s.end > s.start);
}

/** A new block's length when dropped at `startMinute`: the remaining estimate (60 without one), cut at the next item or the
 * end of work when those come later, in 15-minute steps and never under 15. */
export function dropLength(remainingMinutes: number | null, startMinute: number, nextItemStart: number | null,
  workEnd: number | null): number {
  const limits = [nextItemStart, workEnd, DAY_MINUTES].filter((m): m is number => m !== null && m > startMinute);
  const room = Math.min(...limits) - startMinute;
  const wanted = Math.min(remainingMinutes ?? DEFAULT_DROP_MINUTES, room);
  return Math.max(SNAP_MINUTES, Math.floor(wanted / SNAP_MINUTES) * SNAP_MINUTES);
}

/** The first start at or after `afterMinute`, on a 15-minute step, where a block of `length` misses every taken range and
 * fits the work window (or the day); null when nothing fits. */
export function moveAfterSlot(length: number, afterMinute: number, taken: readonly MinuteRange[],
  window: { start: number; end: number } | null): number | null {
  const snapUp = (m: number) => Math.ceil(m / SNAP_MINUTES) * SNAP_MINUTES;
  const end = window?.end ?? DAY_MINUTES;
  let start = snapUp(Math.max(afterMinute, window?.start ?? 0));
  while (start + length <= end) {
    const clash = taken.find((r) => r.start < start + length && r.end > start);
    if (!clash) return start;
    start = snapUp(clash.end);
  }
  return null;
}

/** Planned time is the union of blocks and busy items, so an overlap counts once. */
export function dayLoad(blocks: readonly MinuteRange[], busy: readonly MinuteRange[], workingMinutes: number):
  { plannedMinutes: number; freeMinutes: number; over: boolean } {
  const ranges = [...blocks, ...busy].filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  let planned = 0;
  let current: MinuteRange | null = null;
  for (const r of ranges) {
    if (current && r.start <= current.end) {
      current.end = Math.max(current.end, r.end);
    } else {
      if (current) planned += current.end - current.start;
      current = { ...r };
    }
  }
  if (current) planned += current.end - current.start;
  return { plannedMinutes: planned, freeMinutes: Math.max(0, workingMinutes - planned), over: workingMinutes > 0 && planned > workingMinutes };
}

function clockMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function windowMinutes(w: PlannerWorkWindow): { start: number; end: number; breakStart: number | null; breakEnd: number | null } {
  const breakStart = w.breakStart && w.breakMinutes > 0 ? clockMinutes(w.breakStart) : null;
  return {
    start: clockMinutes(w.workStart), end: clockMinutes(w.workEnd),
    breakStart, breakEnd: breakStart === null ? null : breakStart + w.breakMinutes,
  };
}

/** A day's planned minutes by kind (redesign D17), in kind order; a block with no kind counts as a task. */
export function kindMinutes(blocks: readonly Pick<PlannerRangeBlockView, 'plannedMinutes' | 'categoryKind'>[]): ReadonlyMap<TaskKind, number> {
  const sums = new Map<TaskKind, number>();
  for (const block of blocks) {
    const kind = kindOf(block.categoryKind);
    sums.set(kind, (sums.get(kind) ?? 0) + block.plannedMinutes);
  }
  return new Map(TASK_KINDS.filter((kind) => sums.has(kind)).map((kind) => [kind, sums.get(kind)!]));
}

/** The load bar's segments: each kind's share of the working day, scaled down to a full bar when the day is over-full. */
export function kindSegments(minutes: ReadonlyMap<TaskKind, number>, workingMinutes: number): readonly { kind: TaskKind; widthPct: number }[] {
  if (workingMinutes <= 0) return [];
  const total = [...minutes.values()].reduce((sum, m) => sum + m, 0);
  const scale = total > workingMinutes ? workingMinutes / total : 1;
  return [...minutes.entries()].map(([kind, m]) => ({ kind, widthPct: (m / workingMinutes) * 100 * scale }));
}
