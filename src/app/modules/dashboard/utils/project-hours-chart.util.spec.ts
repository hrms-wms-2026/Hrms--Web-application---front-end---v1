import { describe, expect, it } from 'vitest';
import { LedHourTotals, LedModuleProgress, LedProjectProgress } from '../models/my-team-led-progress.model';
import { atRiskModuleNames, orderProjectsForChart, projectHourBars, projectRiskText } from './project-hours-chart.util';

const hours = (allocated: number, completed: number, inProgress: number, notStarted: number): LedHourTotals => {
  const tasked = completed + inProgress + notStarted;
  return {
    allocatedHours: allocated,
    completedHours: completed,
    inProgressHours: inProgress,
    notStartedHours: notStarted,
    untaskedHours: Math.max(0, allocated - tasked),
    overTaskedHours: Math.max(0, tasked - allocated),
    taskCount: 1,
    unestimatedTaskCount: 0
  };
};

const mod = (title: string, extra: Partial<LedModuleProgress> = {}): LedModuleProgress => ({
  objectiveId: title,
  title,
  isRootModule: false,
  endDate: '2026-12-01',
  parentObjectiveId: null,
  depth: 0,
  atRisk: false,
  hours: hours(0, 0, 0, 0),
  ...extra
});

const project = (id: string, h: LedHourTotals, modules: LedModuleProgress[] = []): LedProjectProgress => ({
  projectId: id,
  projectName: id,
  identifier: '',
  hours: h,
  modules
});

describe('project hours chart util', () => {
  it('names the led modules at risk, or deeper ones when no led module carries it', () => {
    expect(atRiskModuleNames(project('a', hours(1, 0, 0, 0), [mod('A', { atRisk: true }), mod('A1', { depth: 1, atRisk: true })]))).toEqual(['A']);
    expect(atRiskModuleNames(project('b', hours(1, 0, 0, 0), [mod('B'), mod('B1', { depth: 1, atRisk: true })]))).toEqual(['B1']);
    expect(atRiskModuleNames(project('c', hours(1, 0, 0, 0), [mod('C')]))).toEqual([]);
  });

  it('orders at-risk projects first, then the largest hours, then by name', () => {
    const order = orderProjectsForChart([
      project('small', hours(10, 0, 0, 0)),
      project('big', hours(100, 0, 0, 0)),
      project('late', hours(5, 0, 0, 0), [mod('L', { atRisk: true })]),
      project('also-big', hours(100, 0, 0, 0))
    ]).map((p) => p.projectId);
    expect(order).toEqual(['late', 'also-big', 'big', 'small']);
  });

  it('explains the risk with the overdue count and hours when known', () => {
    const late = project('late', hours(5, 0, 0, 0), [mod('Payments', { atRisk: true })]);
    expect(projectRiskText(late, { projectId: 'late', projectName: 'late', hours: 1, taskCount: 1, unestimatedTaskCount: 0 })).toBe(
      'At risk: 1 overdue task (1 h) in Payments'
    );
    expect(projectRiskText(late)).toBe('At risk: unfinished work in Payments is past its due date');
    expect(projectRiskText(project('ok', hours(5, 0, 0, 0), [mod('Ok')]))).toBeUndefined();
  });

  it('stacks the four states, reads each part against the allocation, and marks an over-tasked allocation', () => {
    const [bar] = projectHourBars([project('EXOR', hours(2000, 300, 700, 500))]);
    expect(bar.segments.map((s) => [s.key, s.value])).toEqual([
      ['completed', 300],
      ['inProgress', 700],
      ['notStarted', 500],
      ['untasked', 500]
    ]);
    expect(bar.segments[1].hover).toEqual({ label: 'EXOR · In progress', value: '700 h', chip: '35% of 2,000 h allocated' });
    expect(bar.marker).toBeUndefined();
    expect(bar.alert).toBeUndefined();

    const [over] = projectHourBars([project('Over', hours(100, 80, 40, 0))]);
    expect(over.marker).toBe(100);
    // Nothing allocated: shares are of the task estimates.
    const [none] = projectHourBars([project('None', hours(0, 10, 30, 0))]);
    expect(none.segments[1].hover?.chip).toBe('75% of 40 h in tasks');
  });
});
