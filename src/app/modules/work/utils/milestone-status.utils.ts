export type MilestoneStatus = 'upcoming' | 'on_track' | 'at_risk' | 'completed';

/** Design §5: no stored status exists on CalendarEvent - derive it from dates plus whether any
 *  linked objective has an open ProjectMonitorStore alert, rather than add a new stored enum. */
export function deriveMilestoneStatus(
  event: { status: string; startDate: string; endDate: string },
  today: string,
  hasOpenAlert: boolean
): MilestoneStatus {
  if (event.status === 'archived') return 'completed';
  if (today < event.startDate) return 'upcoming';
  if (hasOpenAlert || today > event.endDate) return 'at_risk';
  return 'on_track';
}
