import { EmployeeDetailAddress, EmployeeListAttendanceSummaryResponse } from '../models/employee.model';
import { getInitials } from '../../../shared/utils/avatar.utils';

/** Anything carrying an attendance summary - list rows and the full employee detail read alike. */
export interface HasAttendanceSummary {
  readonly attendanceSummary?: EmployeeListAttendanceSummaryResponse | null;
}

export function avatarInitials(name: string): string {
  return getInitials(name) || 'E';
}

export function isOverBreak(employee: HasAttendanceSummary): boolean {
  const summary = employee.attendanceSummary;
  if (!summary) return false;
  return summary.isOverBreakAllowance === true
    || summary.attendanceStatus === 'over_break'
    || summary.attentionType === 'over_break'
    || summary.attendanceStatusLabel?.toLowerCase().includes('over break') === true
    || (summary.attentionLabel?.toLowerCase().includes('break') === true && summary.attentionLabel?.toLowerCase().includes('exceed') === true);
}

export function attendanceWarningLabel(employee: HasAttendanceSummary): string | null {
  const summary = employee.attendanceSummary;
  if (!summary) return null;
  if (isOverBreak(employee)) {
    return 'Over break';
  }
  if (summary.showNotClockedInWarning !== true) return null;
  return summary.warningLabel?.trim() || summary.attentionLabel?.trim() || 'Still has not clocked in';
}

export function attendanceSeverityClass(employee: HasAttendanceSummary): string {
  const severity = employee.attendanceSummary?.attentionSeverity?.trim().toLowerCase();
  if (severity === 'critical' || severity === 'error') return 'emp-attention--critical';
  if (severity === 'warning') return 'emp-attention--warning';
  return 'emp-attention--neutral';
}

export function attendanceAttentionLabel(employee: HasAttendanceSummary): string | null {
  const summary = employee.attendanceSummary;
  if (!summary) return null;
  if (summary.showNotClockedInWarning === true || isOverBreak(employee)) return null;
  return summary.attentionLabel?.trim() || null;
}

export function attendanceStatusLabel(employee: HasAttendanceSummary): string | null {
  const summary = employee.attendanceSummary;
  if (!summary) return null;
  const raw = summary.attendanceStatusLabel?.trim();
  if (raw) {
    if (raw.toLowerCase() === 'over break allowance') return 'Over break';
    return raw.replace(/over break allowance/gi, 'Over break');
  }
  if (isOverBreak(employee)) {
    return 'Over break';
  }
  return null;
}

export function breakOverageLabel(employee: HasAttendanceSummary): string | null {
  const summary = employee.attendanceSummary;
  const overageMinutes = summary?.breakOverageMinutes;
  if (!summary || (summary.isOverBreakAllowance !== true && !(typeof overageMinutes === 'number' && overageMinutes > 0))) {
    return null;
  }
  if (summary.attentionLabel?.toLowerCase().includes('break') && summary.attentionLabel.toLowerCase().includes('exceed')) {
    return null;
  }
  if (typeof overageMinutes !== 'number' || overageMinutes <= 0) return null;
  return `Break exceeded by ${overageMinutes} min`;
}

export function formatTenure(hireDate: string | null | undefined, now: Date = new Date()): string {
  if (!hireDate) return '—';
  const hired = new Date(hireDate);
  if (isNaN(hired.getTime())) return '—';

  let years = now.getFullYear() - hired.getFullYear();
  let months = now.getMonth() - hired.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0 && months <= 0) return 'New Joiner';

  const yearPart = years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : '';
  const monthPart = months > 0 ? `${months} mo${months > 1 ? 's' : ''}` : '';
  if (yearPart && monthPart) return `${yearPart} ${monthPart}`;
  return yearPart || monthPart || 'New Joiner';
}

export function primaryLocationLabel(addresses: readonly EmployeeDetailAddress[] | undefined): string {
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
