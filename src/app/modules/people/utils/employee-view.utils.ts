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

export function attendanceWarningLabel(employee: HasAttendanceSummary): string | null {
  const summary = employee.attendanceSummary;
  if (summary?.showNotClockedInWarning !== true) return null;
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
  if (summary?.showNotClockedInWarning === true) return null;
  return summary?.attentionLabel?.trim() || null;
}

export function attendanceStatusLabel(employee: HasAttendanceSummary): string | null {
  return employee.attendanceSummary?.attendanceStatusLabel?.trim() || null;
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
