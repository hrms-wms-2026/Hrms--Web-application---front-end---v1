import { LedTimeProgress, LedWorkloadRow } from '../models/team-progress-detail.model';

export function workloadRow(overrides: Partial<LedWorkloadRow> = {}): LedWorkloadRow {
  return {
    employeeId: `emp-${overrides.displayName ?? 'x'}`,
    displayName: 'Ada',
    rank: 1,
    plannedMinutes: 0,
    clockedMinutes: 0,
    unscheduledMinutes: 0,
    expectedMinutes: null,
    utilizationPercent: null,
    ...overrides,
  };
}

export function ledTime(overrides: Partial<LedTimeProgress> = {}): LedTimeProgress {
  return {
    period: 'week',
    from: '2026-10-26',
    to: '2026-11-01',
    plannerEnabled: true,
    asOf: '2026-10-29T06:00:00Z',
    plannedMinutes: 0,
    clockedMinutes: 0,
    scheduledMinutes: 0,
    outsideSlotMinutes: 0,
    noPlanMinutes: 0,
    coveragePercent: null,
    peopleWithUnscheduledWork: 0,
    previous: { plannedMinutes: 0, clockedMinutes: 0, coveragePercent: null },
    buckets: [],
    workload: [],
    unscheduled: [],
    unscheduledTotal: 0,
    ...overrides,
  };
}
