export interface AllowedClockInMethods {
  web: boolean;
  desktopTray: boolean;
  biometric: boolean;
  photoRequired: boolean;
  locationRequired: boolean;
  allowedRadiusMeters: number | null;
}

export interface AttendanceTodayResponse {
  employeeId: string;
  legalEntityId: string;
  workDate: string;
  timezone: string;
  scheduleStatus: string;
  policyStatus: string;
  isWorkingDay: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  requiredWorkMinutes: number | null;
  breakAllowanceMinutes: number | null;
  breakUsedMinutes: number;
  breakRemainingMinutes: number | null;
  breakState: string;
  expectedWorkMode: string | null;
  attendanceStatus: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  totalWorkedMinutes: number;
  attendanceSource: string | null;
  canClockIn: boolean;
  canClockOut: boolean;
  canStartBreak: boolean;
  canEndBreak: boolean;
  shouldHaveClockedIn: boolean;
  canViewCoveredEmployees: boolean;
  allowedClockInMethods: AllowedClockInMethods;
  messages: string[];
  attendanceStatusLabel?: string | null;
  attentionType?: string | null;
  attentionLabel?: string | null;
  attentionSeverity?: string | null;
  breakOverageMinutes?: number;
  isOverBreakAllowance?: boolean;
}

export interface AttendanceHistoryEmployee {
  employeeId: string;
  displayName: string;
  employeeNumber: string;
  position: string | null;
  department: string | null;
  avatarFileId: string | null;
}

export interface AttendanceHistoryRow {
  attendanceRecordId: string;
  workDate: string;
  employee: AttendanceHistoryEmployee | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  isActive: boolean;
  breakMinutes: number;
  totalWorkedMinutes: number;
  expectedWorkMode: string | null;
  attendanceSource: string | null;
  status: string;
  canViewDetails: boolean;
  canRequestCorrection: boolean;
  canRequestWorkAreaChange: boolean;
  canCorrect: boolean;
  statusLabel?: string | null;
  attentionType?: string | null;
  attentionLabel?: string | null;
  attentionSeverity?: string | null;
  breakOverageMinutes?: number;
  isOverBreakAllowance?: boolean;
}

export interface ClockInRequest {
  source: 'web';
}

export type TimeTrackingRange = {
  from: string;
  to: string;
};
