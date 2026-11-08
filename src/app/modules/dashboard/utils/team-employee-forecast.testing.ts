import { ForecastStatus } from '../models/overtime-forecast.model';
import { EmployeeForecastItem, EmployeeForecastResponse } from '../models/team-employee-forecast.model';

/** A fixed forecast (as of Sun 8 Nov 2026, window 11 Oct – 7 Nov) for the Employee overtime forecast specs. */
export function employeeForecastItem(name: string, status: ForecastStatus, overtimeHours: number, over: Partial<EmployeeForecastItem> = {}): EmployeeForecastItem {
  return {
    employeeId: name,
    name,
    avatarFileId: null,
    department: 'Dev',
    workedMinutes: 9600,
    taskMinutes: 3648,
    conversionRate: 0.38,
    deadline: '2026-11-20',
    remainingHours: 50,
    capacityHours: 72,
    predictedHours: 27.4,
    requiredRate: 0.7,
    overtimeHours,
    status,
    modules: [
      { moduleId: `${name}-m1`, projectId: 'p1', projectName: 'Atlas', title: `${name} Billing`, endDate: '2026-11-20', remainingHours: 30, openTasks: 3 },
      { moduleId: `${name}-m2`, projectId: 'p2', projectName: 'Borealis', title: `${name} Search`, endDate: '2026-12-04', remainingHours: 20, openTasks: 1 },
    ],
    ...over,
  };
}

export const EMPLOYEE_FORECAST_ITEMS: EmployeeForecastItem[] = [
  employeeForecastItem('Ann', 'overtime', 40, { requiredRate: 1.3 }),
  employeeForecastItem('Bob', 'raise_rate', 12.5),
  employeeForecastItem('Cat', 'raise_rate', 4),
  employeeForecastItem('Dan', 'on_track', 0, { conversionRate: 0.6, requiredRate: 0.3 }),
  employeeForecastItem('Eve', 'no_history', 0, { conversionRate: null, workedMinutes: 0, taskMinutes: 0 }),
];

export function employeeForecastResponse(over: Partial<EmployeeForecastResponse> = {}): EmployeeForecastResponse {
  return {
    asOf: '2026-11-08',
    windowStart: '2026-10-11',
    windowEnd: '2026-11-07',
    totals: {
      people: 5,
      onTrack: 1,
      raiseRate: 2,
      overtime: 1,
      noHistory: 1,
      remainingHours: 250,
      capacityHours: 360,
      predictedHours: 140,
      overtimeHours: 56.5,
      teamRate: 0.4,
      requiredRate: 0.55,
    },
    rateTrend: [
      { weekStart: '2026-10-12', rate: 0.3 },
      { weekStart: '2026-10-19', rate: 0.35 },
      { weekStart: '2026-10-26', rate: null },
      { weekStart: '2026-11-02', rate: 0.4 },
    ],
    items: EMPLOYEE_FORECAST_ITEMS,
    total: 5,
    page: 1,
    pageSize: 10,
    ...over,
  };
}
