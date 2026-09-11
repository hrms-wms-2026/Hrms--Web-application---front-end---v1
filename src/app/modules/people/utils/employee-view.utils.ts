import { EmployeeListAttendanceSummaryResponse } from '../models/employee.model';

/** Anything carrying an attendance summary - list rows and the full employee detail read alike. */
export interface HasAttendanceSummary {
  readonly attendanceSummary?: EmployeeListAttendanceSummaryResponse | null;
}

export function avatarInitials(name: string): string {
  if (!name) return 'E';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
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
