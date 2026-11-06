/** The server refuses a block shorter than this (PlannerService.MinimumBlockMinutes). */
export const MIN_BLOCK_MINUTES = 15;

/** Minutes after local midnight. */
export interface MinuteRange { start: number; end: number; }

/** A working day that can still be planned: its work window, and what already takes up time in it. */
export interface PlanDay {
  date: string;
  window: MinuteRange;
  busy: readonly MinuteRange[];
}

export interface PlanPart { date: string; startMinutes: number; endMinutes: number; }

/** The stretches of the window not taken by `busy`, in order, long enough to hold a block. */
export function freeGaps(day: PlanDay): MinuteRange[] {
  const gaps: MinuteRange[] = [];
  let cursor = day.window.start;
  for (const taken of [...day.busy].sort((a, b) => a.start - b.start)) {
    if (taken.start > cursor) gaps.push({ start: cursor, end: Math.min(taken.start, day.window.end) });
    cursor = Math.max(cursor, taken.end);
  }
  if (cursor < day.window.end) gaps.push({ start: cursor, end: day.window.end });
  return gaps.filter((gap) => gap.end - gap.start >= MIN_BLOCK_MINUTES);
}

/**
 * Fills the free working time of `days`, in order, with `minutes` of work: the rest of a task carried over from the
 * day it was planned on. What doesn't fit comes back as `unplaced`. A last sliver is rounded up to the shortest block.
 */
export function placeMinutes(days: readonly PlanDay[], minutes: number): { parts: PlanPart[]; unplaced: number } {
  const parts: PlanPart[] = [];
  let left = minutes;
  for (const day of days) {
    for (const gap of freeGaps(day)) {
      if (left <= 0) return { parts, unplaced: 0 };
      const take = Math.max(Math.min(left, gap.end - gap.start), MIN_BLOCK_MINUTES);
      parts.push({ date: day.date, startMinutes: gap.start, endMinutes: gap.start + take });
      left -= take;
    }
  }
  return { parts, unplaced: Math.max(left, 0) };
}
