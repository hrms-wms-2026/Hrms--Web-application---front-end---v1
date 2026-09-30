/**
 * Response shapes for the employee-scoped period aggregates planned in Phase 3 of
 * docs/superpowers/plans/next/2026-09-30-employee-detail-tabs.md. These endpoints do not exist
 * yet; EmployeeInsightsApiService serves same-shaped mock data in development only.
 */

export type AttendanceDayStatus = 'present' | 'late' | 'missing_clock_out' | 'leave' | 'none';

export interface EmployeeAttendanceMonthSummary {
  readonly present: number;
  readonly late: number;
  readonly missingClockOut: number;
  readonly leave: number;
  readonly days: readonly { readonly date: string; readonly status: AttendanceDayStatus }[];
}

export interface EmployeeWorkMonthSummary {
  readonly assigned: number;
  readonly completed: number;
  readonly inProgress: number;
  readonly overdue: number;
  readonly completionRate: number;
  readonly onTimeRate: number;
}

export interface EmployeeTimeOffSummary {
  readonly balances: readonly { readonly leaveTypeName: string; readonly remainingDays: number }[];
  readonly upcoming: { readonly startDate: string; readonly endDate: string; readonly status: string } | null;
}

export type InsightStatus = 'pending' | 'approved' | 'rejected';

export interface EmployeeApprovalItem {
  readonly requestType: string;
  readonly status: InsightStatus;
  readonly note: string | null;
}

export interface EmployeeActivityFeedItem {
  readonly occurredAt: string;
  readonly action: string;
  readonly subject: string;
}

export interface EmployeeProductivitySummary {
  readonly index: number;
  readonly deltaVsPrevious: number;
  readonly trend: readonly { readonly month: string; readonly value: number }[];
  readonly activity: { readonly score: number; readonly activeMinutes: number; readonly idleMinutes: number; readonly meetingMinutes: number };
  readonly discipline: { readonly score: number; readonly lateClockIns: number; readonly earlyClockOuts: number; readonly missingClockOuts: number };
  readonly delivery: {
    readonly score: number;
    readonly tasksCompleted: number;
    readonly tasksTotal: number;
    readonly onTimeCompleted: number;
    readonly onTimeTotal: number;
    readonly storyPointsCompleted: number;
    readonly storyPointsTotal: number;
  };
}

export interface EmployeeUpcomingItem {
  readonly date: string;
  readonly title: string;
  readonly kind: 'leave' | 'calendar';
  readonly status: string;
}

export interface EmployeeChecklistProgress {
  readonly name: string;
  readonly completed: number;
  readonly total: number;
}

export interface EmployeeOverviewInsightsResponse {
  readonly attendance: EmployeeAttendanceMonthSummary;
  readonly work: EmployeeWorkMonthSummary;
  readonly timeOff: EmployeeTimeOffSummary;
  readonly approvals: readonly EmployeeApprovalItem[];
  readonly recentActivity: readonly EmployeeActivityFeedItem[];
  readonly productivity: EmployeeProductivitySummary;
  readonly upcomingItems: readonly EmployeeUpcomingItem[];
  readonly checklists: readonly EmployeeChecklistProgress[];
}

export type TaskStatus = 'to_do' | 'in_progress' | 'review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface EmployeeAttentionTask {
  readonly taskId: string;
  readonly taskName: string;
  readonly projectName: string;
  readonly issue: string;
  readonly issueSeverity: 'critical' | 'warning' | 'info';
  readonly status: TaskStatus;
  readonly storyPoints: number;
}

export interface EmployeeRecentTask {
  readonly taskId: string;
  readonly taskName: string;
  readonly projectName: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly dueDate: string;
  readonly storyPoints: number;
}

export interface EmployeeWorkActivityInsightsResponse {
  readonly summary: {
    readonly assigned: number;
    readonly completed: number;
    readonly inProgress: number;
    readonly overdue: number;
    readonly storyPointsCompleted: number;
    readonly storyPointsTotal: number;
  };
  readonly needsAttention: readonly EmployeeAttentionTask[];
  readonly delivery: {
    readonly completionRate: number;
    readonly onTimeRate: number;
    readonly tasksCompleted: number;
    readonly tasksTotal: number;
    readonly storyPointsCompleted: number;
    readonly storyPointsTotal: number;
    readonly monthly: readonly { readonly month: string; readonly completed: number }[];
  };
  readonly recordedActivity: {
    readonly activeMinutes: number;
    readonly idleMinutes: number;
    readonly meetingMinutes: number;
    readonly lastActivityAt: string | null;
    readonly hourly: readonly { readonly hour: string; readonly activeMinutes: number }[];
  };
  readonly recentTasks: readonly EmployeeRecentTask[];
  readonly appUsage: readonly {
    readonly application: string;
    readonly activeMinutes: number;
    readonly sessions: number;
    readonly lastUsedAt: string;
  }[];
  readonly workPattern: {
    readonly focusedBlocks: number;
    readonly topApplication: string | null;
    readonly topApplicationMinutes: number;
    readonly longestIdleMinutes: number;
    readonly longestIdleFrom: string | null;
    readonly longestIdleTo: string | null;
  };
}
