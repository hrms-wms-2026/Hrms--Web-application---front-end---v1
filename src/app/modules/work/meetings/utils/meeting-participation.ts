import { MeetingAttendanceResponse, MeetingAttendanceRow, MeetingAttendee } from '../models/meeting.models';

/**
 * How one invited person took part, for the ring around their photo:
 * - absent: attendance has synced and no join was recorded for them (recorded, never guessed - spec D21);
 * - left_early: they joined but were there for less than LEFT_EARLY_SHARE of the meeting;
 * - attended: they joined and stayed for most of it;
 * - unknown: no attendance yet (before or during the meeting, or the provider has none).
 */
export type MeetingParticipation = 'absent' | 'left_early' | 'attended' | 'unknown';

/** Joined for less than this share of the meeting's length counts as leaving early. */
export const LEFT_EARLY_SHARE = 0.9;

/** Absent first, then left early, then attended; unknown last. */
const ORDER: Record<MeetingParticipation, number> = { absent: 0, left_early: 1, attended: 2, unknown: 3 };

export const PARTICIPATION_LABELS: Record<MeetingParticipation, string> = {
  absent: 'No join recorded', left_early: 'Left early', attended: 'Attended', unknown: 'Attendance not known yet',
};

export interface MeetingParticipant {
  readonly attendee: MeetingAttendee;
  readonly participation: MeetingParticipation;
}

function rowFor(attendee: MeetingAttendee, rows: readonly MeetingAttendanceRow[]): MeetingAttendanceRow | undefined {
  const email = attendee.email?.toLowerCase();
  return rows.find((r) => (attendee.employeeId && r.employeeId === attendee.employeeId) || (!!email && r.email?.toLowerCase() === email));
}

export function participationOf(
  attendee: MeetingAttendee, attendance: MeetingAttendanceResponse | null, startUtc: string, endUtc: string,
): MeetingParticipation {
  if (!attendance) return 'unknown';
  const row = rowFor(attendee, attendance.rows);
  if (row?.outcome === 'joined') {
    const meetingSeconds = (Date.parse(endUtc) - Date.parse(startUtc)) / 1000;
    if (row.attendedSeconds !== null && meetingSeconds > 0 && row.attendedSeconds < meetingSeconds * LEFT_EARLY_SHARE) return 'left_early';
    return 'attended';
  }
  if (attendance.status === 'synced' && (!row || row.outcome === 'no_join_recorded')) return 'absent';
  return 'unknown';
}

/** Everyone invited, with how they took part, in ring order (a stable sort keeps the invite order within a group). */
export function orderedParticipants(
  attendees: readonly MeetingAttendee[], attendance: MeetingAttendanceResponse | null, startUtc: string, endUtc: string,
): MeetingParticipant[] {
  return attendees
    .map((attendee) => ({ attendee, participation: participationOf(attendee, attendance, startUtc, endUtc) }))
    .sort((a, b) => ORDER[a.participation] - ORDER[b.participation]);
}
