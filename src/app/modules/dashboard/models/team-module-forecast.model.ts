import { ForecastRateTrendPoint, ForecastStatus } from './overtime-forecast.model';

/**
 * My Team "Module overtime forecast": GET work/forecast/modules (design 2026-11-08, §4a). Hours are hours, rates are
 * fractions, member minutes are minutes. `requiredRate` may pass 1 and is null when there is no capacity left.
 */
export type ModuleForecastSort = 'overtime' | 'requiredRate' | 'endDate' | 'name';

export interface ModuleForecastQuery {
  readonly status: ForecastStatus | null;
  readonly projectId: string | null;
  /** Module title, path or project; empty = everything. */
  readonly search: string;
  readonly sort: ModuleForecastSort;
  readonly page: number;
  readonly pageSize: number;
}

export interface ModuleForecastTotals {
  readonly modules: number;
  readonly onTrack: number;
  readonly raiseRate: number;
  readonly overload: number;
  readonly noHistory: number;
  readonly allocatedHours: number;
  readonly completedHours: number;
  readonly remainingHours: number;
  readonly capacityHours: number;
  readonly predictedHours: number;
  readonly overtimeHours: number;
  readonly teamRate: number | null;
  readonly requiredRate: number | null;
  /** The highest task rate a team realistically reaches (tenant setting, default 0.9); above it is overload. */
  readonly maxTaskRate: number;
}

export interface ModuleForecastProject {
  readonly projectId: string;
  readonly name: string;
  readonly allocatedHours: number;
  readonly remainingHours: number;
  readonly predictedHours: number;
  readonly capacityHours: number;
  readonly overtimeHours: number;
  readonly modulesAtRisk: number;
}

export interface ModuleForecastMember {
  readonly employeeId: string;
  readonly name: string;
  readonly avatarFileId: string | null;
  readonly conversionRate: number | null;
  readonly workedMinutes: number;
  readonly taskMinutes: number;
}

export interface ModuleForecastItem {
  readonly moduleId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly title: string;
  /** "Parent › Child". */
  readonly path: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly workingDaysLeft: number;
  readonly allocatedHours: number;
  readonly completedHours: number;
  readonly remainingHours: number;
  readonly capacityHours: number;
  readonly conversionRate: number | null;
  readonly predictedHours: number;
  readonly requiredRate: number | null;
  readonly overtimeHours: number;
  readonly status: ForecastStatus;
  readonly memberCount: number;
  readonly members: readonly ModuleForecastMember[];
}

export interface ModuleForecastResponse {
  readonly asOf: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly totals: ModuleForecastTotals;
  readonly rateTrend: readonly ForecastRateTrendPoint[];
  readonly projects: readonly ModuleForecastProject[];
  readonly items: readonly ModuleForecastItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
