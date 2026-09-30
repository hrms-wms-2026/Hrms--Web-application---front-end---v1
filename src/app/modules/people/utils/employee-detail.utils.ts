import { EmployeeDetailAddress } from '../models/employee.model';

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
