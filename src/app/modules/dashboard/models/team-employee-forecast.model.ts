import { ForecastRateTrendPoint, ForecastStatus } from './overtime-forecast.model';

/**
 * My Team "Employee overtime forecast": GET work/forecast/employees (design 2026-11-08, §4b). Each person's figures
 * come from their worst deadline window (the one needing the most overtime). Hours are hours, rates fractions.
 */
export type EmployeeForecastSort = 'overtime' | 'requiredRate' | 'rate' | 'name';

export interface EmployeeForecastQuery {
  readonly status: ForecastStatus | null;
  /** Name or department; empty = everyone. */
  readonly search: string;
  readonly sort: EmployeeForecastSort;
  readonly page: number;
  readonly pageSize: number;
}

export interface EmployeeForecastTotals {
  readonly people: number;
  readonly onTrack: number;
  readonly raiseRate: number;
  readonly overload: number;
  readonly noHistory: number;
  readonly remainingHours: number;
  readonly capacityHours: number;
  readonly predictedHours: number;
  readonly overtimeHours: number;
  readonly teamRate: number | null;
  readonly requiredRate: number | null;
  /** The highest task rate a team realistically reaches (tenant setting, default 0.9); above it is overload. */
  readonly maxTaskRate: number;
}

/** A module the person has open assigned tasks in, or is a member of. */
export interface EmployeeForecastModule {
  readonly moduleId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly title: string;
  readonly endDate: string;
  readonly remainingHours: number;
  readonly openTasks: number;
}

export interface EmployeeForecastItem {
  readonly employeeId: string;
  readonly name: string;
  readonly avatarFileId: string | null;
  readonly department: string | null;
  readonly workedMinutes: number;
  readonly taskMinutes: number;
  readonly conversionRate: number | null;
  /** The worst window's deadline; null with no open estimated tasks. */
  readonly deadline: string | null;
  readonly remainingHours: number;
  readonly capacityHours: number;
  readonly predictedHours: number;
  readonly requiredRate: number | null;
  readonly overtimeHours: number;
  readonly status: ForecastStatus;
  readonly modules: readonly EmployeeForecastModule[];
}

export interface EmployeeForecastResponse {
  readonly asOf: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly totals: EmployeeForecastTotals;
  readonly rateTrend: readonly ForecastRateTrendPoint[];
  readonly items: readonly EmployeeForecastItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
