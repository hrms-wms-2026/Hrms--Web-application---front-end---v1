export type AttentionReason = 'overdue' | 'due_soon';

/** Mirrors HRMS-Backend-v1 EmployeeAttentionItem (Plan 4A). */
export interface EmployeeAttentionItem {
  readonly taskId: string;
  readonly shortId: string;
  readonly title: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly statusName: string;
  readonly statusColor: string;
  readonly storyPoints: number | null;
  readonly dueDate: string;
  readonly reason: AttentionReason;
  readonly overdueDays: number | null;
  readonly daysUntilDue: number | null;
}

/** Mirrors EmployeeNeedsAttentionResponse: top 5 items, totalCount is the uncapped total. */
export interface EmployeeNeedsAttentionResponse {
  readonly asOf: string;
  readonly totalCount: number;
  readonly items: readonly EmployeeAttentionItem[];
}

/** Mirrors EmployeeWorkTaskItem (Plan 4A). */
export interface EmployeeWorkTaskItem {
  readonly taskId: string;
  readonly shortId: string;
  readonly title: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly statusName: string;
  readonly statusColor: string;
  readonly priority: string;
  readonly storyPoints: number | null;
  readonly dueDate: string | null;
  readonly progressPercent: number;
}

export interface EmployeeRecentTasksResponse {
  readonly items: readonly EmployeeWorkTaskItem[];
}

export interface EmployeeDeliveryTrendMonth {
  /** 'YYYY-MM' */
  readonly month: string;
  readonly completed: number;
}

export interface EmployeeDeliveryTrendResponse {
  readonly months: readonly EmployeeDeliveryTrendMonth[];
}

export interface ActivityHourBucket {
  readonly hour: number;
  readonly activeMinutes: number;
}

/** Mirrors EmployeeActivityByHourResponse (Plan 4B). */
export interface EmployeeActivityByHourResponse {
  readonly from: string;
  readonly to: string;
  readonly activityMonitoringEnabled: boolean;
  readonly timezone: string;
  readonly lastActivityAt: string | null;
  readonly hours: readonly ActivityHourBucket[];
}

export interface EmployeeAppUsageItem {
  readonly appName: string;
  readonly activeMinutes: number;
  readonly sessions: number;
  readonly lastUsedAt: string;
}

/** Mirrors EmployeeAppUsageResponse (Plan 4B). */
export interface EmployeeAppUsageResponse {
  readonly from: string;
  readonly to: string;
  readonly applicationTrackingEnabled: boolean;
  readonly totalMinutes: number;
  readonly apps: readonly EmployeeAppUsageItem[];
}

export interface EmployeeIdlePeriod {
  readonly start: string;
  readonly end: string;
  readonly minutes: number;
}

/** Mirrors EmployeeWorkPatternSummaryResponse (Plan 4B). */
export interface EmployeeWorkPatternSummaryResponse {
  readonly from: string;
  readonly to: string;
  readonly activityMonitoringEnabled: boolean;
  readonly focusBlocks: number;
  readonly topApp: string | null;
  readonly topAppMinutes: number;
  readonly longestIdle: EmployeeIdlePeriod | null;
}
