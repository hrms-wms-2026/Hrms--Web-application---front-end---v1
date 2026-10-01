import { EmployeeSignalItem } from '../models/employee-overview.model';
import { approvalReviewUrl, signalFullListUrl, taskBoardUrl } from './signal-item-links';

const item = (over: Partial<EmployeeSignalItem>): EmployeeSignalItem => ({
  kind: 'approval', id: 'r-1', date: '2026-09-28', title: 'Leave request', subtitle: null, occurredAt: null,
  projectId: null, projectName: null, dueDate: null, approvalKind: 'leave', requestedAt: '2026-09-28T05:00:00Z',
  approverName: null, ...over
});

describe('signal item links', () => {
  it.each([
    ['leave', '/time-off/team-approvals'],
    ['attendance_correction', '/attendance/time-tracking?view=team&type=corrections&requestId=r-1'],
    ['work_area_change', '/attendance/time-tracking?view=team&type=work-area&requestId=r-1'],
    ['location_change', '/attendance/time-tracking?view=team&type=location&requestId=r-1'],
    ['task_edit', '/work']
  ])('routes a %s approval to its inbox', (approvalKind, url) => {
    expect(approvalReviewUrl(item({ approvalKind }))).toBe(url);
  });

  it('routes attendance and location keys to the filtered Time Tracking team view', () => {
    expect(signalFullListUrl('late_clock_ins', 'emp-1', '2026-09-01', '2026-09-30'))
      .toBe('/attendance/time-tracking?view=team&employeeId=emp-1&from=2026-09-01&to=2026-09-30');
    expect(signalFullListUrl('location_violations', 'emp-1', '2026-09-01', '2026-09-30'))
      .toBe('/attendance/time-tracking?view=team&employeeId=emp-1&from=2026-09-01&to=2026-09-30');
  });

  it('routes monitoring keys to Alerts, overdue tasks to Work, and has no list for approvals', () => {
    expect(signalFullListUrl('idle_activity_alerts', 'emp-1', 'a', 'b')).toBe('/attendance/alerts');
    expect(signalFullListUrl('monitoring_exceptions', 'emp-1', 'a', 'b')).toBe('/attendance/alerts');
    expect(signalFullListUrl('overdue_tasks', 'emp-1', 'a', 'b')).toBe('/work');
    expect(signalFullListUrl('pending_approvals', 'emp-1', 'a', 'b')).toBeNull();
  });

  it('links a task to its board with the task modal open', () => {
    expect(taskBoardUrl(item({ kind: 'task', id: 't-9', projectId: 'p-2' }))).toBe('/work/p-2/board?taskId=t-9');
  });
});
