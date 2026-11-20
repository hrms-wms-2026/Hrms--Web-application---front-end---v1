import { LeaveRequestListItemResponse } from '../models/leave-request.model';

/** When something last happened to a request: its last decision, or when it was sent. */
export function lastActivityAt(request: Pick<LeaveRequestListItemResponse, 'createdAt' | 'updatedAt'>): string {
  return request.updatedAt ?? request.createdAt;
}

/**
 * Recent Requests order: the request something last happened to comes first. An approval or rejection
 * moves a request back to the top until a newer request is sent or another one is decided.
 */
export function sortByLastActivity<T extends Pick<LeaveRequestListItemResponse, 'createdAt' | 'updatedAt'>>(requests: readonly T[]): T[] {
  return [...requests].sort((a, b) => Date.parse(lastActivityAt(b)) - Date.parse(lastActivityAt(a)));
}

/**
 * "1 of 2 approved" for a pending request with more than one approver, so a request that moved to the top
 * of Recent Requests after a first approval says why. Null when there is nothing to show.
 */
export function approvalProgressLabel(request: Pick<LeaveRequestListItemResponse, 'status' | 'approvedApproverCount' | 'approverCount'>): string | null {
  const total = request.approverCount ?? 0;
  if (request.status !== 'pending' || total < 2) return null;
  return `${request.approvedApproverCount ?? 0} of ${total} approved`;
}


function localDayNumber(iso: string): number {
  const date = new Date(iso);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/**
 * "1 day", "3 days", or hours for a part of a day. A request that covers less than one work day
 * (when the work day length is known) reads in hours: "4.00 h".
 */
export function leaveDurationLabel(startAt: string, endAt: string, totalHours: number, workdayHours: number | null): string {
  const days = Math.max(1, localDayNumber(endAt) - localDayNumber(startAt) + 1);
  if (days === 1 && workdayHours != null && workdayHours > 0 && totalHours < workdayHours) return `${totalHours.toFixed(2)} h`;
  return days === 1 ? '1 day' : `${days} days`;
}

/** "1 day", "½ day", "2.5 days": hours over the work day (rounded to halves), else the calendar days covered. */
export function leaveDayCountLabel(startAt: string, endAt: string, totalHours: number, workdayHours: number | null): string {
  const days = workdayHours != null && workdayHours > 0
    ? Math.max(0.5, Math.round((totalHours / workdayHours) * 2) / 2)
    : Math.max(1, localDayNumber(endAt) - localDayNumber(startAt) + 1);
  if (days === 0.5) return '½ day';
  return days === 1 ? '1 day' : `${days} days`;
}

/** "Oct 07, 2026 – Oct 09, 2026", or a single date when the leave is one day. */
export function leaveDateRangeLabel(startAt: string, endAt: string): string {
  const format = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  const start = format(startAt);
  const end = format(endAt);
  return start === end ? start : `${start} – ${end}`;
}

/** Hours between two "HH:mm" times, less the break: the length of one work day. */
export function workdayHours(start: string | null, end: string | null, breakMinutes: number | null): number | null {
  if (!start || !end) return null;
  const toMinutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  };
  let minutes = toMinutes(end) - toMinutes(start);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.max(0, minutes - (breakMinutes ?? 0)) / 60;
}

export type LeaveTypeIcon = 'palm' | 'sun' | 'heart' | 'baby' | 'family' | 'person' | 'calendar';

/** A picture for a leave type, guessed from its name and code (types have a colour, not an icon). */
export function leaveTypeIcon(name: string, code = ''): LeaveTypeIcon {
  const text = `${name} ${code}`.toLowerCase();
  if (/annual|vacation|holiday|\bal\b/.test(text)) return 'palm';
  if (/casual|\bcl\b/.test(text)) return 'sun';
  if (/sick|medical|\bsl\b/.test(text)) return 'heart';
  if (/maternity|baby/.test(text)) return 'baby';
  if (/paternity|parental|family/.test(text)) return 'family';
  if (/compassion|bereave|personal/.test(text)) return 'person';
  return 'calendar';
}

const DEFAULT_LUCIDE: Record<LeaveTypeIcon, string> = {
  palm: 'tree-palm', sun: 'sun', heart: 'heart-pulse', baby: 'baby', family: 'users-round', person: 'user-round', calendar: 'calendar-days'
};

/** The stored-icon value ("lucide:{name}") of the picture guessed from a leave type's name, shown until someone picks one. */
export function leaveTypeDefaultIcon(name: string, code = ''): string {
  return `lucide:${DEFAULT_LUCIDE[leaveTypeIcon(name, code)]}`;
}

/** The hub's rest note for each part of the day (the greeting itself comes from the dashboard's time-of-day util). */
export function restQuoteFor(timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'): string {
  switch (timeOfDay) {
    case 'morning':
      return 'A rested start makes for a better day.';
    case 'afternoon':
      return 'Rest today for a stronger tomorrow.';
    case 'evening':
      return 'Switch off for the evening. The work will keep.';
    case 'night':
      return 'Good sleep is part of good work.';
  }
}

/** The name the profile menu uses: the email's local part, word-cased. */
export function displayNameFromEmail(email: string | null): string | null {
  const mail = email?.trim();
  if (!mail) return null;
  const words = mail.split('@')[0].split(/[._-]/).filter(Boolean);
  if (words.length === 0) return null;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
