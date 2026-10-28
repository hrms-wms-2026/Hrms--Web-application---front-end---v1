import { TeamTodayMember, TeamTodaySummary } from '../models/my-team-today.model';

/** Working / Break / Leave colours (My Team widgets design 2026-10-29). Everything else is a neutral line, never a 4th colour. */
export const PRESENCE_COLORS = { working: '#3b82f6', break: '#f59e0b', leave: '#ef4444' } as const;

export type PresenceState = 'working' | 'break' | 'leave';

/** The Team Status status for each of the three states; any other status is neutral. */
const STATE_OF: Record<string, PresenceState | undefined> = {
  working: 'working',
  on_break: 'break',
  on_leave: 'leave',
};

export const PRESENCE_LABELS: Record<PresenceState, string> = {
  working: 'Working',
  break: 'Break',
  leave: 'Leave',
};

export function presenceState(status: string): PresenceState | null {
  return STATE_OF[status] ?? null;
}

/** The neutral statuses, kept apart in data and joined in copy. A leave the viewer may not see arrives as absent. */
export interface NeutralCounts {
  readonly notClockedIn: number;
  readonly clockedOut: number;
  readonly absent: number;
  readonly notScheduled: number;
}

export interface PresenceGroups {
  readonly working: number;
  readonly onBreak: number;
  readonly onLeave: number;
  readonly neutral: NeutralCounts;
}

/** Counts over the given members: only working, on_break and on_leave reach the three states. */
export function groupPresence(members: readonly TeamTodayMember[]): PresenceGroups {
  const count = (status: string) => members.filter((m) => m.status === status).length;
  return {
    working: count('working'),
    onBreak: count('on_break'),
    onLeave: count('on_leave'),
    neutral: {
      notClockedIn: count('not_started'),
      clockedOut: count('clocked_out'),
      absent: count('absent'),
      notScheduled: count('not_scheduled'),
    },
  };
}

/** The same counts for the whole team, from the summary (the member list is capped). */
export function presenceFromSummary(summary: TeamTodaySummary): PresenceGroups {
  return {
    working: summary.working,
    onBreak: summary.onBreak,
    onLeave: summary.onLeave,
    neutral: {
      notClockedIn: summary.notStarted,
      clockedOut: summary.clockedOut,
      absent: summary.absent,
      notScheduled: summary.notScheduled,
    },
  };
}

/** "4 not clocked in · 2 clocked out · 1 absent"; zero counts are left out; '' when there are none. */
export function neutralLine(neutral: NeutralCounts): string {
  return [
    [neutral.notClockedIn, 'not clocked in'],
    [neutral.clockedOut, 'clocked out'],
    [neutral.absent, 'absent'],
    [neutral.notScheduled, 'not scheduled'],
  ]
    .filter(([n]) => (n as number) > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(' · ');
}

const STATE_ORDER: Record<PresenceState, number> = { working: 0, break: 1, leave: 2 };

/** Working, then break, then leave, then everyone else; by name inside each. */
export function orderPresence(members: readonly TeamTodayMember[]): TeamTodayMember[] {
  const rank = (m: TeamTodayMember) => {
    const state = presenceState(m.status);
    return state ? STATE_ORDER[state] : 3;
  };
  return [...members].sort(
    (a, b) => rank(a) - rank(b) || a.displayName.localeCompare(b.displayName),
  );
}

/** "3h 20m", "45m", "0m". */
export function minutesText(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

/** Whole minutes from an ISO instant to now (never negative). */
export function minutesSince(iso: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** What is left of the current state, with the share already used for the time-left bar; null when there is no
 * denominator (no break allowance, no scheduled end) - the card then shows no bar and "—". */
export function timeLeft(
  member: TeamTodayMember,
  now: Date,
): { text: string; usedPercent: number } | null {
  if (member.status === 'on_break' && member.breakRemainingMinutes !== null) {
    const used = member.stateSince ? minutesSince(member.stateSince, now) : 0;
    const total = used + member.breakRemainingMinutes;
    return {
      text: `${minutesText(member.breakRemainingMinutes)} break left`,
      usedPercent: total > 0 ? Math.min(100, (used * 100) / total) : 100,
    };
  }
  if (member.status === 'working' && member.shiftEndsAt && member.stateSince) {
    const end = new Date(member.shiftEndsAt).getTime();
    const start = new Date(member.stateSince).getTime();
    const left = Math.max(0, Math.round((end - now.getTime()) / 60_000));
    const span = end - start;
    return {
      text: `${minutesText(left)} of shift left`,
      usedPercent:
        span > 0 ? Math.min(100, Math.max(0, ((now.getTime() - start) * 100) / span)) : 100,
    };
  }
  return null;
}
