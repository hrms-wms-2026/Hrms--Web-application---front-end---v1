import { EmployeeDetailAddress, EmployeeDetailResponse } from '../models/employee.model';

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
 * backend has no data for yet (documents, preferences) are deliberately not counted.
 */
export function profileCompletion(employee: EmployeeDetailResponse): ProfileCompletion {
  const info = employee.personalInformation;
  const items: ProfileCompletionItem[] = [
    { label: 'Basic Information', complete: !!(info.firstName && info.lastName && info.dateOfBirth && info.gender) },
    { label: 'Contact Information', complete: !!(info.email && info.phone) },
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
