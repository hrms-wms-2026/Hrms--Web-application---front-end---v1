import { ForecastStatus } from '../models/overtime-forecast.model';
import { ModuleForecastItem, ModuleForecastResponse } from '../models/team-module-forecast.model';

/** A fixed forecast (as of Sun 8 Nov 2026, window 11 Oct – 7 Nov) for the Module overtime forecast specs. */
export function moduleForecastItem(
  title: string,
  status: ForecastStatus,
  overtimeHours: number,
  over: Partial<ModuleForecastItem> = {},
): ModuleForecastItem {
  return {
    moduleId: title,
    projectId: 'p1',
    projectName: 'Atlas',
    title,
    path: `Atlas › ${title}`,
    startDate: '2026-10-01',
    endDate: '2026-11-20',
    workingDaysLeft: 9,
    allocatedHours: 200,
    completedHours: 80,
    remainingHours: 120,
    capacityHours: 144,
    conversionRate: 0.42,
    predictedHours: 60,
    requiredRate: 0.83,
    overtimeHours,
    status,
    memberCount: 2,
    members: [
      {
        employeeId: `${title}-a`,
        name: `${title} Ann`,
        avatarFileId: null,
        conversionRate: 0.5,
        workedMinutes: 4800,
        taskMinutes: 2400,
      },
      {
        employeeId: `${title}-b`,
        name: `${title} Bob`,
        avatarFileId: null,
        conversionRate: 0.34,
        workedMinutes: 6000,
        taskMinutes: 2040,
      },
    ],
    ...over,
  };
}

export const MODULE_FORECAST_ITEMS: ModuleForecastItem[] = [
  moduleForecastItem('Billing', 'overtime', 140, { projectId: 'p2', projectName: 'Borealis' }),
  moduleForecastItem('Search', 'raise_rate', 60),
  moduleForecastItem('Reports', 'raise_rate', 20),
  moduleForecastItem('Login', 'on_track', 0, {
    remainingHours: 30,
    predictedHours: 60,
    requiredRate: 0.21,
  }),
  moduleForecastItem('Import', 'no_history', 0, { conversionRate: null }),
];

export function moduleForecastResponse(
  over: Partial<ModuleForecastResponse> = {},
): ModuleForecastResponse {
  return {
    asOf: '2026-11-08',
    windowStart: '2026-10-11',
    windowEnd: '2026-11-07',
    totals: {
      modules: 5,
      onTrack: 1,
      raiseRate: 2,
      overtime: 1,
      noHistory: 1,
      allocatedHours: 2400,
      completedHours: 900,
      remainingHours: 1500,
      capacityHours: 2600,
      predictedHours: 1100,
      overtimeHours: 950,
      teamRate: 0.42,
      requiredRate: 0.58,
    },
    rateTrend: [
      { weekStart: '2026-10-12', rate: 0.31 },
      { weekStart: '2026-10-19', rate: 0.38 },
      { weekStart: '2026-10-26', rate: 0.45 },
      { weekStart: '2026-11-02', rate: 0.42 },
    ],
    projects: [
      {
        projectId: 'p1',
        name: 'Atlas',
        allocatedHours: 1600,
        remainingHours: 900,
        predictedHours: 700,
        capacityHours: 1600,
        overtimeHours: 480,
        modulesAtRisk: 2,
      },
      {
        projectId: 'p2',
        name: 'Borealis',
        allocatedHours: 800,
        remainingHours: 600,
        predictedHours: 400,
        capacityHours: 1000,
        overtimeHours: 470,
        modulesAtRisk: 1,
      },
    ],
    items: MODULE_FORECAST_ITEMS,
    total: 5,
    page: 1,
    pageSize: 10,
    ...over,
  };
}
