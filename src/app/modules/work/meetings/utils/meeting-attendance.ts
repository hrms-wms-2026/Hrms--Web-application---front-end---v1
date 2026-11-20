import { MeetingAttendanceOutcome, MeetingAttendanceSyncStatus } from '../models/meeting.models';

/**
 * Attendance wording (spec D21, D16): "No join recorded" only once attendance has synced; anything not yet known reads
 * "Unknown". The UI never says "absent" - absence is never inferred.
 */
export function attendanceOutcomeLabel(outcome: MeetingAttendanceOutcome | null, status: MeetingAttendanceSyncStatus): string {
  if (outcome === 'joined') return 'Joined';
  if (status === 'synced' && (outcome === 'no_join_recorded' || outcome == null)) return 'No join recorded';
  return 'Unknown';
}

/** Seconds attended as "1h 5m" / "25m"; nothing for an unknown time. */
export function formatAttended(seconds: number | null): string {
  if (seconds == null) return '—';
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
