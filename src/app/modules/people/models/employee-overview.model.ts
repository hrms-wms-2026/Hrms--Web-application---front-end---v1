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

/** One day on the Attendance card's day list. Mirrors HRMS-Backend-v1 EmployeeAttendanceDayDetail. */
export interface EmployeeAttendanceDayDetail {
  readonly date: string;
  readonly status: AttendanceDayStatus;
  readonly expectedWorkingDay: boolean;
  readonly holidayName: string | null;
  /** 'HH:mm' in the employee's attendance timezone. */
  readonly scheduledStart: string | null;
  readonly scheduledEnd: string | null;
  readonly clockInAt: string | null;
  readonly clockOutAt: string | null;
  readonly clockInLocal: string | null;
  readonly clockOutLocal: string | null;
  readonly workedMinutes: number;
  readonly requiredWorkMinutes: number | null;
  readonly breakMinutes: number;
  readonly lateMinutes: number;
  readonly earlyLeaveMinutes: number;
  readonly shortHours: boolean;
  readonly overBreakMinutes: number;
  readonly workMode: string | null;
}

/** Days up to today, newest first. */
export interface EmployeeAttendanceDaysResponse {
  readonly from: string;
  readonly to: string;
  readonly timezone: string;
  readonly days: readonly EmployeeAttendanceDayDetail[];
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

export type EmployeeWorkTaskBucket = 'overdue' | 'not_started' | 'in_progress' | 'completed';

/** One task behind the Work card. Mirrors HRMS-Backend-v1 EmployeeWorkTaskItem. */
export interface EmployeeWorkTaskItem {
  readonly taskId: string;
  readonly shortId: string;
  readonly title: string;
  readonly bucket: EmployeeWorkTaskBucket;
  /** critical | high | medium | low */
  readonly priority: string;
  readonly statusName: string;
  readonly statusColor: string;
  readonly dueDate: string | null;
  readonly daysOverdue: number;
  readonly isCarriedOver: boolean;
  readonly projectId: string;
  readonly projectName: string;
  readonly objectiveId: string;
  readonly moduleName: string;
}

/** Already ordered: overdue, not started, in progress, completed; then priority; then due date. */
export interface EmployeeWorkTasksResponse {
  readonly from: string;
  readonly to: string;
  readonly items: readonly EmployeeWorkTaskItem[];
}

/** Mirrors HRMS-Backend-v1 EmployeeWorkOverviewResponse. onTimeRatePercent = on-time completed / (completed with a due date + overdue open tasks); null when no task has reached its due date. */
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

export type EmployeeSignalItemKind = 'attendance_day' | 'monitoring_alert' | 'exception_case' | 'task' | 'approval';

export interface EmployeeSignalItem {
  readonly kind: EmployeeSignalItemKind;
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly occurredAt: string | null;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly dueDate: string | null;
  readonly approvalKind: string | null;
  readonly requestedAt: string | null;
  readonly approverName: string | null;
  /** Task items only: due before the selected period and still unfinished when it began. */
  readonly carriedOver?: boolean | null;
  /** Task items only: whole days past due as of the period end (or today). */
  readonly daysOverdue?: number | null;
}

export interface EmployeeSignalItemsResponse {
  readonly key: string;
  readonly total: number;
  readonly timezone: string | null;
  readonly items: readonly EmployeeSignalItem[];
}

export type EmployeeUpcomingKind = 'calendar' | 'leave' | 'release';

/**
 * All-day items (leave, releases) carry UTC-based timestamps; calendar events are real instants.
 * The optional fields feed the item detail popup: calendar events fill description/meetingLink/
 * organizerName/timezone/participants (display names), approved leave fills hours.
 */
export interface EmployeeUpcomingItem {
  readonly kind: EmployeeUpcomingKind;
  readonly title: string;
  readonly start: string;
  readonly end: string | null;
  readonly isAllDay: boolean;
  readonly detail: string | null;
  readonly description?: string | null;
  readonly meetingLink?: string | null;
  readonly organizerName?: string | null;
  readonly timezone?: string | null;
  readonly hours?: number | null;
  readonly participants?: readonly string[] | null;
}

/** Mirrors HRMS-Backend-v1 EmployeeUpcomingResponse: the earliest `limit` items, and the window's total count. */
export interface EmployeeUpcomingResponse {
  readonly from: string;
  readonly to: string;
  readonly items: readonly EmployeeUpcomingItem[];
  readonly total: number;
}

/** Bypassed tasks count in total but not in completed. */
export interface EmployeeChecklistGroup {
  readonly name: string;
  readonly lifecycleType: string;
  readonly completed: number;
  readonly bypassed: number;
  readonly total: number;
  readonly tasks?: readonly EmployeeChecklistTaskOverviewItem[] | null;
}

export interface EmployeeChecklistTaskOverviewItem {
  readonly id: string;
  readonly title: string;
  readonly assignedToEmployeeId: string;
  readonly assigneeName: string;
  readonly dueDate: string;
  readonly status: string;
  readonly completedAt: string | null;
  readonly completedBy: string | null;
  readonly workTaskId: string | null;
  readonly workTaskShortId: string | null;
  readonly workProjectId: string | null;
  readonly canOpenTask: boolean;
}

export interface EmployeeChecklistOverviewResponse {
  readonly groups: readonly EmployeeChecklistGroup[];
}

/** kind: joined | probation_completed | position_changed | manager_changed | leave_approved | checklist_completed | terminated. date is a UTC YYYY-MM-DD. */
export interface EmployeeHistoryEvent {
  readonly kind: string;
  readonly title: string;
  readonly detail: string | null;
  readonly date: string;
}

export interface EmployeeHistoryResponse {
  readonly events: readonly EmployeeHistoryEvent[];
}

/** One thing the employee did. Never contains text the employee typed. */
export interface EmployeeActivityItem {
  readonly id: string;
  readonly kind: string;
  readonly action: string;
  readonly target: string | null;
  readonly detail: string | null;
  readonly at: string;
}

/** nextBefore is the cursor for the next (older) page; isPartial is true while the feed is a union over existing tables. */
export interface EmployeeRecentActivityResponse {
  readonly items: readonly EmployeeActivityItem[];
  readonly nextBefore: string | null;
  readonly isPartial: boolean;
}
