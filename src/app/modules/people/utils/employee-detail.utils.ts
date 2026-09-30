import { EmployeeDetailAddress, EmployeeDetailResponse } from '../models/employee.model';
import { PositionHistoryEntryResponse } from '../models/position-history.model';

export function employeeInitials(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.trim().charAt(0) || '';
  const l = lastName?.trim().charAt(0) || '';
  return (f + l).toUpperCase() || 'EM';
}

export function calculateTenure(hireDateStr?: string | null, now: Date = new Date()): string {
  if (!hireDateStr) return '—';
  const hireDate = new Date(hireDateStr);
  if (isNaN(hireDate.getTime())) return '—';

  let years = now.getFullYear() - hireDate.getFullYear();
  let months = now.getMonth() - hireDate.getMonth();

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0 && months <= 0) {
    return 'New Joiner';
  }

  const yearPart = years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : '';
  const monthPart = months > 0 ? `${months} mo${months > 1 ? 's' : ''}` : '';

  if (yearPart && monthPart) return `${yearPart} ${monthPart}`;
  return yearPart || monthPart || 'New Joiner';
}

export function primaryLocation(addresses?: readonly EmployeeDetailAddress[] | null): string {
  if (!addresses || addresses.length === 0) return 'Not specified';
  const primary = addresses.find((a) => a.isPrimary) || addresses[0];
  if (!primary || !primary.addressJson) return 'Not specified';

  try {
    const parsed: unknown = JSON.parse(primary.addressJson);
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>;
      const city = p['city'] || p['town'];
      const country = p['country'] || p['countryCode'];
      if (city && country) return `${city}, ${country}`;
      if (city) return String(city);
      if (country) return String(country);
      const firstVal = Object.values(p).find((v) => typeof v === 'string' && v.trim().length > 0);
      if (firstVal) return String(firstVal);
    }
  } catch {
    return primary.addressJson.substring(0, 30);
  }
  return 'Not specified';
}

/** `YYYY-MM` for the month containing `date`, in local time. */
export function toPeriodMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** `YYYY-MM` shifted by `delta` months. */
export function shiftPeriodMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  return toPeriodMonth(new Date(year, m - 1 + delta, 1));
}

export interface ProfileCompletionItem {
  readonly label: string;
  readonly complete: boolean;
}

export interface ProfileCompletion {
  readonly percent: number;
  readonly items: readonly ProfileCompletionItem[];
}

/**
 * Completion across the profile sections the detail response actually carries. Sections the
 * backend has no data for yet (documents, preferences) are deliberately not counted. As in the
 * design, basic = name on file and contact = at least one way to reach the employee.
 */
export function profileCompletion(employee: EmployeeDetailResponse): ProfileCompletion {
  const info = employee.personalInformation;
  const items: ProfileCompletionItem[] = [
    { label: 'Basic Information', complete: !!(info.firstName && info.lastName) },
    { label: 'Contact Information', complete: !!(info.email || info.phone) },
    { label: 'Address Information', complete: info.addresses.length > 0 },
    { label: 'Emergency Contact', complete: employee.emergencyContacts.length > 0 }
  ];
  const done = items.filter((item) => item.complete).length;
  return { percent: Math.round((done / items.length) * 100), items };
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Next anniversary of the hire date strictly after today, with the whole days until it. */
export function nextWorkAnniversary(
  hireDateStr: string | null | undefined,
  now: Date = new Date()
): { readonly date: Date; readonly daysUntil: number; readonly years: number } | null {
  const hire = hireDateStr ? parseDateOnly(hireDateStr) : null;
  if (!hire) return null;
  const today = startOfDay(now);
  let years = Math.max(1, today.getFullYear() - hire.getFullYear());
  let next = new Date(hire.getFullYear() + years, hire.getMonth(), hire.getDate());
  while (next <= today) {
    years += 1;
    next = new Date(hire.getFullYear() + years, hire.getMonth(), hire.getDate());
  }
  return { date: next, daysUntil: Math.round((next.getTime() - today.getTime()) / DAY_MS), years };
}

export type ProbationStatus = 'completed' | 'in_progress' | 'none';

export function probationStatus(probationEndDate: string | null | undefined, now: Date = new Date()): ProbationStatus {
  const end = probationEndDate ? parseDateOnly(probationEndDate) : null;
  if (!end) return 'none';
  return end < startOfDay(now) ? 'completed' : 'in_progress';
}

/** "1 Sep" / "10 Sep 2025" (en-GB's short month is "Sept", which the design does not use). */
export function formatDayMonth(value: string, withYear = false): string {
  const date = parseDateOnly(value);
  if (!date) return '';
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = String(date.getDate()).padStart(withYear ? 2 : 1, '0');
  return withYear ? `${day} ${month} ${date.getFullYear()}` : `${day} ${month}`;
}

/** 150 -> "2h 30m", 65 -> "1h 05m", 12 -> "12m". */
export function formatMinutes(total: number): string {
  const minutes = Math.max(0, Math.round(total));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Local wall-clock time, e.g. "2:41 PM". */
export function formatClock(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "Today, 2:41 PM" / "Yesterday, 6:12 PM" / "Sep 16, 4:32 PM". */
export function formatRelativeDayTime(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  const dayDiff = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS);
  const clock = formatClock(date);
  if (dayDiff === 0) return `Today, ${clock}`;
  if (dayDiff === 1) return `Yesterday, ${clock}`;
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${clock}`;
}

/** "Sep 23 – 25" within a month, "Sep 30 – Oct 2" across months. */
export function formatDateRange(start: string, end: string): string {
  const a = parseDateOnly(start);
  const b = parseDateOnly(end);
  if (!a || !b) return '';
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
  if (a.getTime() === b.getTime()) return `${month(a)} ${a.getDate()}`;
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${month(a)} ${a.getDate()} – ${b.getDate()}`;
  return `${month(a)} ${a.getDate()} – ${month(b)} ${b.getDate()}`;
}

export interface HistoryEvent {
  readonly date: string;
  readonly title: string;
  readonly description: string | null;
}

const CHANGE_REASON_TITLES: Record<string, string> = {
  Promotion: 'Promoted',
  Transfer: 'Transferred',
  LateralMove: 'Position changed'
};

/**
 * Employment history built only from real records: position history entries (the earliest,
 * reason-less entry is the joining event) plus probation completion once its end date has passed.
 * Newest first.
 */
export function employmentHistory(
  entries: readonly PositionHistoryEntryResponse[],
  probationEndDate: string | null | undefined,
  now: Date = new Date()
): HistoryEvent[] {
  const ordered = [...entries].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const events: HistoryEvent[] = ordered.map((entry, index) => {
    const where = [entry.positionName, entry.departmentName].filter(Boolean).join(' · ');
    if (index === 0 && !entry.changeReason) {
      return { date: entry.effectiveFrom, title: 'Joined company', description: `Joined as ${where}.` };
    }
    const previous = ordered[index - 1];
    const title = entry.changeReason ? CHANGE_REASON_TITLES[entry.changeReason] ?? 'Position changed' : 'Position changed';
    const description = previous && previous.positionName !== entry.positionName
      ? `${previous.positionName} → ${entry.positionName}`
      : where;
    return { date: entry.effectiveFrom, title, description };
  });
  if (probationStatus(probationEndDate, now) === 'completed' && probationEndDate) {
    events.push({ date: probationEndDate, title: 'Probation completed', description: 'Probation period completed.' });
  }
  return events.sort((a, b) => b.date.localeCompare(a.date));
}
