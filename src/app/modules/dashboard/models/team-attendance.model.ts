/** Mirrors the backend's TeamAttendanceBuckets: one per employee-day. 'off' days are never counted. */
export type TeamAttendanceBucket = 'present' | 'late' | 'absent' | 'leave' | 'pending' | 'off';

export type TeamAttendancePeriodMode = 'week' | 'month';

/** The widget's one period state, shared by every view and the detail dialog. Dates are yyyy-MM-dd. */
export interface TeamAttendancePeriodQuery {
  readonly mode: TeamAttendancePeriodMode;
  /** Any date in the period; null = the period containing today. */
  readonly anchor: string | null;
  readonly departmentId: string | null;
}

export interface TeamAttendanceCounts {
  readonly present: number;
  readonly late: number;
  readonly absent: number;
  readonly onLeave: number;
  readonly pending: number;
}

export interface TeamAttendanceTrendPoint extends TeamAttendanceCounts {
  readonly date: string;
  /** (present + late) / (present + late + absent) as a percentage; null when nothing was expected. */
  readonly rate: number | null;
}

export interface TeamAttendancePreviewRow {
  readonly employeeId: string;
  readonly name: string;
  readonly avatarFileId: string | null;
  readonly department: string | null;
  readonly bucket: TeamAttendanceBucket;
  readonly clockInAt: string | null;
}

export interface TeamAttendanceDepartment {
  readonly id: string;
  readonly name: string;
}

/** One department over the period: attended = present + late days, expected = present + late + absent. id null = no
 * department. */
export interface TeamAttendanceDepartmentRate {
  readonly id: string | null;
  readonly name: string;
  readonly people: number;
  readonly attended: number;
  readonly expected: number;
  readonly rate: number | null;
}

/** GET attendance/time-tracking/team/attendance-summary. Today* is today's snapshot; period*, trend and the
 * comparison cover the selected range. deltaPp is in percentage points. */
export interface TeamAttendanceSummaryResponse {
  readonly mode: TeamAttendancePeriodMode;
  readonly rangeStart: string;
  readonly rangeEnd: string;
  readonly timezone: string;
  readonly today: string;
  readonly eligibleToday: number;
  readonly todayCounts: TeamAttendanceCounts;
  readonly todayRate: number | null;
  readonly periodCounts: TeamAttendanceCounts;
  readonly periodRate: number | null;
  readonly previousRate: number | null;
  readonly deltaPp: number | null;
  readonly trend: readonly TeamAttendanceTrendPoint[];
  readonly todayPreview: readonly TeamAttendancePreviewRow[];
  readonly departments: readonly TeamAttendanceDepartment[];
  readonly teamSize: number;
  readonly calculatedAtUtc: string;
  readonly isProvisional: boolean;
  /** The department comparison for the period, best rate first (no rate last), over the filtered team. */
  readonly departmentRates: readonly TeamAttendanceDepartmentRate[];
}

export interface TeamAttendanceDayCell {
  readonly date: string;
  readonly bucket: TeamAttendanceBucket;
}

export interface TeamAttendanceEmployeeRow {
  readonly employeeId: string;
  readonly name: string;
  readonly avatarFileId: string | null;
  readonly department: string | null;
  readonly days: readonly TeamAttendanceDayCell[];
  readonly attended: number;
  readonly eligibleDays: number;
  readonly rate: number | null;
  /** 1 = best rate in the team (ties share a rank); null with no eligible days. */
  readonly rank: number | null;
}

/** The backend's PagedResult<T> JSON. */
export interface TeamAttendancePage<T> {
  readonly items: readonly T[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

export interface TeamAttendanceEmployeesQuery extends TeamAttendancePeriodQuery {
  readonly search?: string | null;
  readonly page: number;
  readonly pageSize: number;
  /** 'rate': best attendance first (the ranking); 'attention': most late + absent + leave days first; the default is by name. */
  readonly sort?: 'name' | 'rate' | 'attention';
}
