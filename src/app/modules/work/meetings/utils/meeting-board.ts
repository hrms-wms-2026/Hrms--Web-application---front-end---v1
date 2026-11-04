import { TaskStatusCategory, TaskStatusColumn } from '../../models/task.model';
import { MeetingListItem, MeetingStatus } from '../models/meeting.models';

// A meeting sits with the tasks on the board and in the Work Tree, but its status is never set by hand (D10): it follows
// the clock. Cancelled meetings are not shown there at all; the Calendar still lists them.

const CATEGORY_BY_STATUS: Partial<Record<MeetingStatus, TaskStatusCategory>> = {
  scheduled: 'not_started', in_progress: 'active', completed: 'done',
};

/** The status at `now`: scheduled before the start, in progress until the end, then completed. Cancelled stays cancelled. */
export function liveMeetingStatus(item: MeetingListItem, now: Date): MeetingStatus {
  if (item.status === 'cancelled') return 'cancelled';
  const t = now.getTime();
  if (t < Date.parse(item.startAt)) return 'scheduled';
  return t < Date.parse(item.endAt) ? 'in_progress' : 'completed';
}

/** The meetings to show with the tasks: not cancelled, status taken from the clock, in start order. */
export function visibleMeetings(items: readonly MeetingListItem[], now: Date): MeetingListItem[] {
  return items
    .filter((item) => item.status !== 'cancelled')
    .map((item) => ({ ...item, status: liveMeetingStatus(item, now) }))
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

/**
 * Board placement by status category: each meeting goes to the first column (by display order) of its category. A meeting
 * whose category has no column, or that is cancelled, is left out.
 */
export function meetingsByStatusColumn(
  items: readonly MeetingListItem[], columns: readonly TaskStatusColumn[],
): Map<string, MeetingListItem[]> {
  const ordered = [...columns].sort((a, b) => a.displayOrder - b.displayOrder);
  const byColumn = new Map<string, MeetingListItem[]>();
  for (const item of items) {
    const category = CATEGORY_BY_STATUS[item.status];
    const target = category ? ordered.find((c) => c.category === category) : undefined;
    if (!target) continue;
    byColumn.set(target.id, [...(byColumn.get(target.id) ?? []), item]);
  }
  return byColumn;
}
