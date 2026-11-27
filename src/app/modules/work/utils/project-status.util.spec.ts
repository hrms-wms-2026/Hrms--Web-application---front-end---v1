import { describe, expect, it } from 'vitest';
import { projectHoursProgress, projectStatus } from './project-status.util';

describe('projectStatus', () => {
  const today = new Date(2026, 10, 27);

  it('is completed once achieved, even past its target date', () => {
    expect(projectStatus({ isAchieved: true, targetDate: '2026-11-01' }, today)).toBe('completed');
  });

  it('is overdue when the target date has passed', () => {
    expect(projectStatus({ isAchieved: false, targetDate: '2026-11-12' }, today)).toBe('overdue');
  });

  it('is in progress on or before the target date', () => {
    expect(projectStatus({ isAchieved: false, targetDate: '2026-11-27' }, today)).toBe('in_progress');
    expect(projectStatus({ isAchieved: false, targetDate: '2026-12-31' }, today)).toBe('in_progress');
  });
});

describe('projectHoursProgress', () => {
  it('rounds the worked share of allocated hours', () => {
    expect(projectHoursProgress({ allocatedHours: 40, completedHours: 10 })).toBe(25);
  });

  it('is 0 when no hours are allocated', () => {
    expect(projectHoursProgress({ allocatedHours: 0, completedHours: 5 })).toBe(0);
  });
});
