export type AttendanceDayStatus =
  | 'present'
  | 'late'
  | 'missing_clock_out'
  | 'leave'
  | 'off'
  | 'absent'
  | 'none';

export interface EmployeeAttendanceDay {
  readonly date: string;
  readonly status: AttendanceDayStatus;
}

/** Mirrors HRMS-Backend-v1 EmployeeAttendanceOverviewResponse. */
export interface EmployeeAttendanceOverviewResponse {
  readonly from: string;
  readonly to: string;
  readonly workingDays: number;
  readonly present: number;
  readonly late: number;
  readonly missingClockOuts: number;
  readonly leaveDays: number;
  readonly days: readonly EmployeeAttendanceDay[];
}

/** Mirrors EmployeeAttendanceDisciplineResponse. locationViolations is null when tracking is off. */
export interface EmployeeAttendanceDisciplineResponse {
  readonly from: string;
  readonly to: string;
  readonly lateClockIns: number;
  readonly earlyClockOuts: number;
  readonly missingClockOuts: number;
  readonly overBreakDays: number;
  readonly overBreakMinutes: number;
  readonly locationTrackingEnabled: boolean;
  readonly locationViolations: number | null;
}

export interface EmployeeTimeOffBalance {
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly leaveTypeCode: string;
  readonly entitledHours: number;
  readonly usedHours: number;
  readonly pendingHours: number;
  readonly remainingHours: number;
  readonly isNegative: boolean;
}

export interface EmployeeUpcomingLeave {
  readonly leaveTypeId: string;
  readonly leaveTypeName: string | null;
  readonly startDate: string;
  readonly endDate: string;
  readonly totalHours: number;
}

/** Mirrors EmployeeTimeOffResponse. Balances are in hours. */
export interface EmployeeTimeOffResponse {
  readonly year: number;
  readonly balances: readonly EmployeeTimeOffBalance[];
  readonly nextLeave: EmployeeUpcomingLeave | null;
}
