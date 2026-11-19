import { MeetingCreatedResponse } from '../models/meeting.models';

/** What the meeting form emits after a create: the server's answer plus the start it sent. */
export type MeetingCreatedEvent = MeetingCreatedResponse & { originalStart: string };

/**
 * The drawer to open once a meeting is created: its first occurrence, by series and the start that was sent.
 * A request sent for approval has no meeting yet, so nothing opens.
 */
export function drawerKeyForCreated(event: MeetingCreatedEvent): { seriesId: string; originalStart: string } | null {
  return event.outcome === 'created' && event.seriesId ? { seriesId: event.seriesId, originalStart: event.originalStart } : null;
}
