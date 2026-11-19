import {
  TeamWorkTaskEmployeeRow,
  TeamWorkTaskHoursResponse,
  TeamWorkTaskTrendPoint,
} from '../models/team-work-task.model';

/** A fixed week (Mon 26 Oct – Sun 1 Nov 2026, today Wed 28) for the Work vs task hours specs. */
export function workTaskTrend(): TeamWorkTaskTrendPoint[] {
  return ['26', '27', '28', '29', '30', '31']
    .map((d) => `2026-10-${d}`)
    .concat('2026-11-01')
    .map((date, i) => ({
      date,
      workedMinutes: i < 3 ? 2400 : 0,
      breakMinutes: i < 3 ? 300 : 0,
      taskMinutes: i < 3 ? 1200 : 0,
      completedTasks: i < 3 ? 4 : 0,
      utilization: i < 3 ? 50 : null,
    }));
}

export function workTaskRow(
  name: string,
  rank: number | null,
  utilization: number | null,
  over: Partial<TeamWorkTaskEmployeeRow> = {},
): TeamWorkTaskEmployeeRow {
  return {
    employeeId: name,
    name,
    avatarFileId: null,
    department: 'Dev',
    workedMinutes: 480,
    breakMinutes: 60,
    taskMinutes: utilization === null ? 0 : Math.round((480 * utilization) / 100),
    completedTasks: 2,
    unestimatedTasks: 0,
    utilization,
    rank,
    ...over,
  };
}

export const WORK_TASK_ROWS = [
  'Ann',
  'Bob',
  'Cat',
  'Dan',
  'Eve',
  'Fay',
  'Gus',
  'Hal',
  'Ivy',
  'Jon',
].map((n, i) => workTaskRow(n, i + 1, 100 - i * 5));

export function workTaskResponse(
  over: Partial<TeamWorkTaskHoursResponse> = {},
): TeamWorkTaskHoursResponse {
  return {
    period: 'week',
    rangeStart: '2026-10-26',
    rangeEnd: '2026-11-01',
    today: '2026-10-28',
    isProvisional: true,
    teamSize: 10,
    totals: {
      workedMinutes: 7200,
      breakMinutes: 900,
      taskMinutes: 3600,
      completedTasks: 12,
      unestimatedTasks: 1,
      utilization: 50,
    },
    previous: {
      workedMinutes: 9000,
      breakMinutes: 1000,
      taskMinutes: 4050,
      completedTasks: 10,
      unestimatedTasks: 0,
      utilization: 45,
    },
    trendStart: '2026-10-26',
    trendEnd: '2026-11-01',
    trend: workTaskTrend(),
    employees: WORK_TASK_ROWS,
    calculatedAtUtc: '2026-10-28T10:00:00Z',
    ...over,
  };
}
