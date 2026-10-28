import { CalendarEventResponse } from '../models/calendar-event.model';
import { PlannerRangeBlockView } from '../../work/planner/models/planner.models';

export interface PositionedEvent {
  readonly event: CalendarEventResponse;
  readonly top: number;    // 0-1 fraction of a 24h column's height
  readonly height: number; // 0-1 fraction
  readonly left: number;   // 0-1 fraction of the day-column width
  readonly width: number;  // 0-1 fraction
}

/** One thing in a day column: a calendar event or a planned task block (2026-10-27 Planner = Calendar design). */
export type GridItem =
  | { readonly kind: 'event'; readonly event: CalendarEventResponse; readonly start: string; readonly end: string }
  | { readonly kind: 'block'; readonly block: PlannerRangeBlockView; readonly start: string; readonly end: string };

export interface PositionedItem {
  readonly item: GridItem;
  readonly top: number;
  readonly height: number;
  readonly left: number;
  readonly width: number;
}

const MINUTES_PER_DAY = 24 * 60;
const MIN_HEIGHT_FRACTION = 15 / MINUTES_PER_DAY; // a floor so very short events stay clickable

function minutesSince(date: Date, referenceStart: Date): number {
  return (date.getTime() - referenceStart.getTime()) / (1000 * 60);
}

/** Timed (non-all-day) events for ONE day, laid out with the standard calendar column-packing
 * algorithm: events are sorted by start time and chained into overlap clusters (transitively -
 * if A overlaps B and B overlaps C, all three share a cluster even if A and C don't directly
 * overlap, matching how Google Calendar itself resolves this case). Within a cluster, each event
 * greedily reuses the first column whose most recent event has already ended, else opens a new
 * one; width/left are then divided evenly across the cluster's column count. */
export function layoutDayEvents(events: readonly CalendarEventResponse[], dayStart: Date): readonly PositionedEvent[] {
  const items = events.filter((e) => !e.isAllDay)
    .map((event): GridItem => ({ kind: 'event', event, start: event.startDate, end: event.endDate }));
  return layoutDayItems(items, dayStart).map((p) => ({
    event: (p.item as Extract<GridItem, { kind: 'event' }>).event, top: p.top, height: p.height, left: p.left, width: p.width,
  }));
}

/** The same column packing as {@link layoutDayEvents}, over events and planner blocks together, so a block that overlaps a
 * meeting sits beside it. All-day events are the caller's to leave out. */
export function layoutDayItems(items: readonly GridItem[], dayStart: Date): readonly PositionedItem[] {
  const sorted = [...items].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const clusters: GridItem[][] = [];
  let currentCluster: GridItem[] = [];
  let clusterEnd = -Infinity;
  for (const item of sorted) {
    const start = new Date(item.start).getTime();
    const end = new Date(item.end).getTime();
    if (currentCluster.length > 0 && start >= clusterEnd) {
      clusters.push(currentCluster);
      currentCluster = [];
      clusterEnd = -Infinity;
    }
    currentCluster.push(item);
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const positioned: PositionedItem[] = [];
  for (const cluster of clusters) {
    const columnEndTimes: number[] = [];
    const columnOf = new Map<GridItem, number>();
    for (const event of cluster) {
      const start = new Date(event.start).getTime();
      const end = new Date(event.end).getTime();
      let assigned = -1;
      for (let c = 0; c < columnEndTimes.length; c++) {
        if (columnEndTimes[c] <= start) { assigned = c; break; }
      }
      if (assigned === -1) {
        assigned = columnEndTimes.length;
        columnEndTimes.push(end);
      } else {
        columnEndTimes[assigned] = end;
      }
      columnOf.set(event, assigned);
    }
    const numColumns = columnEndTimes.length;
    for (const item of cluster) {
      const startMinutes = Math.min(MINUTES_PER_DAY, Math.max(0, minutesSince(new Date(item.start), dayStart)));
      const endMinutes = Math.min(MINUTES_PER_DAY, Math.max(0, minutesSince(new Date(item.end), dayStart)));
      const top = startMinutes / MINUTES_PER_DAY;
      const height = Math.max(MIN_HEIGHT_FRACTION, (endMinutes - startMinutes) / MINUTES_PER_DAY);
      const col = columnOf.get(item)!;
      positioned.push({ item, top, height, left: col / numColumns, width: 1 / numColumns });
    }
  }
  return positioned;
}
