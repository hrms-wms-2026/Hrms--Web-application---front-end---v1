import { localPartsToUtcIso } from '../../../shared/utils/timezone.util';

export interface LeaveRequestDateTimeDraft {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(year, month - 1, day + days);
  const yyyy = String(next.getFullYear()).padStart(4, '0');
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function resolveLeaveTimes(
  draft: LeaveRequestDateTimeDraft,
  workStartTime: string | null,
  workEndTime: string | null
): { startTime: string; endTime: string } | null {
  const startTime = draft.startTime || workStartTime || '';
  const endTime = draft.endTime || workEndTime || '';
  if (!startTime || !endTime) return null;
  return { startTime, endTime };
}

/** Overnight same-calendar-day: if endTime <= startTime, the end is the next calendar day. */
export function resolveLeaveEndDate(startDate: string, endDate: string, startTime: string, endTime: string): string {
  if (startDate && endDate === startDate && endTime && startTime && endTime <= startTime) {
    return addCalendarDays(startDate, 1);
  }
  return endDate;
}

export function toLeaveSubmitDateTimes(
  draft: LeaveRequestDateTimeDraft,
  workStartTime: string | null,
  workEndTime: string | null,
  timezone: string
): { startAt: string; endAt: string } | null {
  if (!draft.startDate || !draft.endDate || !timezone) return null;
  const times = resolveLeaveTimes(draft, workStartTime, workEndTime);
  if (!times) return null;
  const endDate = resolveLeaveEndDate(draft.startDate, draft.endDate, times.startTime, times.endTime);
  return {
    startAt: localPartsToUtcIso(draft.startDate, times.startTime, timezone),
    endAt: localPartsToUtcIso(endDate, times.endTime, timezone)
  };
}

export function formatHours(value: number): string {
  return value.toFixed(2);
}
