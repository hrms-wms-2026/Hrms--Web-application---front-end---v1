import { CalendarEventResponse } from '../models/calendar-event.model';

export interface PositionedEvent {
  readonly event: CalendarEventResponse;
  readonly top: number;    // 0-1 fraction of a 24h column's height
  readonly height: number; // 0-1 fraction
  readonly left: number;   // 0-1 fraction of the day-column width
  readonly width: number;  // 0-1 fraction
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
  const timed = events.filter((e) => !e.isAllDay);
  const sorted = [...timed].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const clusters: CalendarEventResponse[][] = [];
  let currentCluster: CalendarEventResponse[] = [];
  let clusterEnd = -Infinity;
  for (const event of sorted) {
    const start = new Date(event.startDate).getTime();
    const end = new Date(event.endDate).getTime();
    if (currentCluster.length > 0 && start >= clusterEnd) {
      clusters.push(currentCluster);
      currentCluster = [];
      clusterEnd = -Infinity;
    }
    currentCluster.push(event);
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const positioned: PositionedEvent[] = [];
  for (const cluster of clusters) {
    const columnEndTimes: number[] = [];
    const columnOf = new Map<CalendarEventResponse, number>();
    for (const event of cluster) {
      const start = new Date(event.startDate).getTime();
      const end = new Date(event.endDate).getTime();
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
    for (const event of cluster) {
      const startMinutes = Math.min(MINUTES_PER_DAY, Math.max(0, minutesSince(new Date(event.startDate), dayStart)));
      const endMinutes = Math.min(MINUTES_PER_DAY, Math.max(0, minutesSince(new Date(event.endDate), dayStart)));
      const top = startMinutes / MINUTES_PER_DAY;
      const height = Math.max(MIN_HEIGHT_FRACTION, (endMinutes - startMinutes) / MINUTES_PER_DAY);
      const col = columnOf.get(event)!;
      positioned.push({ event, top, height, left: col / numColumns, width: 1 / numColumns });
    }
  }
  return positioned;
}
