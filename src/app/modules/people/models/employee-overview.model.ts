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
  readonly absent?: number;
  readonly shortHours?: number;
  readonly workedOnNonWorkingDay?: number;
  readonly workedDuringTimeOff?: number;
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
  /** Present when compare=previous was requested. */
  readonly previous?: EmployeeAttendanceDisciplineMetrics | null;
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

/** Mirrors HRMS-Backend-v1 EmployeeWorkOverviewResponse. onTimeRatePercent is null when no completed task has both dates. */
export interface EmployeeWorkOverviewResponse {
  readonly from: string;
  readonly to: string;
  readonly assigned: number;
  readonly completed: number;
  readonly inProgress: number;
  readonly overdue: number;
  readonly notStarted: number;
  readonly completionRatePercent: number;
  readonly onTimeRatePercent: number | null;
}

export interface EmployeeDeliveryMetrics {
  readonly tasksAssigned: number;
  readonly tasksCompleted: number;
  readonly onTimeCompleted: number;
  readonly completedWithDueDate: number;
  readonly storyPointsAssigned: number;
  readonly storyPointsCompleted: number;
}

/** Flat current-period metrics plus previous-period metrics when compare=previous was requested. */
export interface EmployeeDeliveryResponse extends EmployeeDeliveryMetrics {
  readonly from: string;
  readonly to: string;
  readonly previous: EmployeeDeliveryMetrics | null;
}

export interface EmployeeActivityMetrics {
  readonly activeMinutes: number;
  readonly idleMinutes: number;
  readonly meetingMinutes: number;
  readonly daysWithData: number;
}

/** When activityMonitoringEnabled is false every figure is 0 and previous is null. */
export interface EmployeeActivityOverviewResponse extends EmployeeActivityMetrics {
  readonly from: string;
  readonly to: string;
  readonly activityMonitoringEnabled: boolean;
  readonly previous: EmployeeActivityMetrics | null;
}

export interface EmployeeAttendanceDisciplineMetrics {
  readonly lateClockIns: number;
  readonly earlyClockOuts: number;
  readonly missingClockOuts: number;
  readonly overBreakDays: number;
  readonly overBreakMinutes: number;
  readonly locationViolations: number | null;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface EmployeeApprovalItem {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly detail: string | null;
  readonly status: ApprovalStatus;
  readonly requestedAt: string;
  readonly decidedAt: string | null;
  /** Only known for Work Management requests. */
  readonly approverName: string | null;
}

/** Mirrors EmployeeApprovalActivityResponse: newest 10 items, counts cover every match. */
export interface EmployeeApprovalActivityResponse {
  readonly from: string;
  readonly to: string;
  readonly pending: number;
  readonly approved: number;
  readonly rejected: number;
  readonly total: number;
  readonly items: readonly EmployeeApprovalItem[];
}

export type EmployeeSignalSeverity = 'critical' | 'warning' | 'info';

export type EmployeeSignalCategory = 'attendance' | 'work' | 'approvals' | 'monitoring';

export interface EmployeeSignal {
  readonly key: string;
  readonly rank: number;
  readonly severity: EmployeeSignalSeverity;
  readonly category: EmployeeSignalCategory;
  readonly value: number;
  readonly unit: 'days' | 'minutes' | 'count' | 'percent';
  readonly denominator: number | null;
  readonly label: string;
  readonly detail: string;
}

export interface EmployeeOverviewSignalsResponse {
  readonly from: string;
  readonly to: string;
  readonly signals: readonly EmployeeSignal[];
}
