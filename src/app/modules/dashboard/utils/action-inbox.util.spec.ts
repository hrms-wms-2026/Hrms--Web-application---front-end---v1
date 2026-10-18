import { describe, expect, it } from 'vitest';
import { ActionItem, TeamActionItemsResponse } from '../models/my-team-action-items.model';
import { LedWorkProgressResponse } from '../models/my-team-led-progress.model';
import { buildActionInbox, filterInbox, inboxAgeClass, inboxCounts, isExceptionSource } from './action-inbox.util';

const NOW = new Date('2026-10-08T12:00:00Z');
const daysAgo = (d: number): string => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function item(sourceKey: string, id: string, age: number, overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    sourceKey, entityId: id, title: `T ${id}`, subjectEmployeeId: null, subjectName: `P ${id}`,
    createdAt: daysAgo(age), exceptionStatus: null, link: { kind: 'leave.approval', params: { requestId: id } },
    ...overrides
  };
}

function actionItems(sources: Partial<TeamActionItemsResponse['sources'][number]>[]): TeamActionItemsResponse {
  return {
    legalEntityId: 'le-1',
    sources: sources.map((s) => ({
      sourceKey: 'leave.approval', domain: 'people' as const, status: 'ok' as const, pendingCount: 0,
      inProgressCount: null, oldestPendingAt: null, topItems: [], ...s
    }))
  };
}

function led(overdueTasks: LedWorkProgressResponse['overdueTasks'], overdueTotal = overdueTasks.length): LedWorkProgressResponse {
  return { totals: { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: overdueTotal }, projects: [], overdueTasks, overdueTotal };
}

const task = (id: string, days: number, assignee = 'e1') => ({
  taskId: id, shortId: id.toUpperCase(), title: `Task ${id}`, projectId: 'p', objectiveId: 'o', dueDate: '2026-10-01',
  daysOverdue: days, assignees: [{ employeeId: assignee, displayName: `Name ${assignee}` }]
});

describe('buildActionInbox', () => {
  it('merges approvals, exceptions and overdue work into one list, oldest first, with type tags', () => {
    const inbox = buildActionInbox(
      actionItems([
        { pendingCount: 1, topItems: [item('leave.approval', 'l1', 2)] },
        { sourceKey: 'work.objective_change', domain: 'work', pendingCount: 1, topItems: [item('work.objective_change', 'o1', 6)] },
        { sourceKey: 'monitoring.exception', pendingCount: 1, topItems: [item('monitoring.exception', 'e1', 1, { exceptionStatus: 'Open' })] }
      ]),
      led([task('t1', 7)]),
      NOW
    );
    expect(inbox.map((i) => [i.tag, i.ageLabel])).toEqual([
      ['Overdue', '7d late'],
      ['Objective', '6d ago'],
      ['Leave', '2d ago'],
      ['Exception', '1d ago']
    ]);
    expect(inbox[0].subject).toBe('Name e1');
  });

  it('pins escalated exceptions on top whatever their age', () => {
    const inbox = buildActionInbox(
      actionItems([
        { pendingCount: 1, topItems: [item('leave.approval', 'l1', 9)] },
        { sourceKey: 'monitoring.exception', pendingCount: 1, topItems: [item('monitoring.exception', 'x', 0, { exceptionStatus: 'Escalated' })] }
      ]),
      null,
      NOW
    );
    expect(inbox.map((i) => i.key)).toEqual(['monitoring.exception:x', 'leave.approval:l1']);
  });

  it('skips sources that failed to load and the caller\'s own overdue tasks', () => {
    const inbox = buildActionInbox(
      actionItems([{ status: 'unavailable', topItems: [item('leave.approval', 'l1', 1)] }]),
      led([task('mine', 3, 'me'), task('theirs', 2)]),
      NOW,
      'me'
    );
    expect(inbox.map((i) => i.key)).toEqual(['work.overdue_task:theirs']);
  });
});

describe('inboxCounts', () => {
  it('uses the backend pending totals, not just the rows loaded', () => {
    const data = actionItems([
      { pendingCount: 2, topItems: [item('leave.approval', 'l1', 1)] },
      { sourceKey: 'work.task_creation', domain: 'work', pendingCount: 15 },
      { sourceKey: 'monitoring.exception', pendingCount: 4 },
      { sourceKey: 'attendance.correction', status: 'unavailable', pendingCount: 9 }
    ]);
    const progress = led([task('t1', 2)]);
    const counts = inboxCounts(data, progress, buildActionInbox(data, progress, NOW));
    expect(counts).toEqual({ all: 22, approval: 17, exception: 4, overdue: 1 });
  });

  it('counts the backend overdue total when not every overdue task was returned', () => {
    const progress = led([task('t1', 2)], 12);
    expect(inboxCounts(null, progress, buildActionInbox(null, progress, NOW)).overdue).toBe(12);
  });
});

describe('filters and tones', () => {
  it('filters by kind', () => {
    const inbox = buildActionInbox(
      actionItems([{ pendingCount: 1, topItems: [item('leave.approval', 'l1', 1)] }]),
      led([task('t1', 2)]),
      NOW
    );
    expect(filterInbox(inbox, 'overdue').map((i) => i.kind)).toEqual(['overdue']);
    expect(filterInbox(inbox, 'all').length).toBe(2);
  });

  it('reads red at 5d+ or overdue, amber at 3d+', () => {
    const [fresh] = buildActionInbox(actionItems([{ pendingCount: 1, topItems: [item('leave.approval', 'a', 1)] }]), null, NOW);
    const [soon] = buildActionInbox(actionItems([{ pendingCount: 1, topItems: [item('leave.approval', 'b', 3)] }]), null, NOW);
    const [late] = buildActionInbox(actionItems([{ pendingCount: 1, topItems: [item('leave.approval', 'c', 5)] }]), null, NOW);
    expect(inboxAgeClass(fresh)).toBe('text-slate-400');
    expect(inboxAgeClass(soon)).toContain('text-amber-600');
    expect(inboxAgeClass(late)).toContain('text-rose-600');
  });
});

describe('calendar meeting exceptions (FC)', () => {
  it('count and list as exceptions alongside monitoring ones', () => {
    const data = actionItems([
      { sourceKey: 'calendar.meeting_exception', pendingCount: 2, topItems: [item('calendar.meeting_exception', 'm1', 1, { exceptionStatus: 'Open' })] },
      { sourceKey: 'leave.approval', pendingCount: 1, topItems: [item('leave.approval', 'l1', 1)] }
    ]);

    expect(isExceptionSource('calendar.meeting_exception')).toBe(true);
    expect(isExceptionSource('monitoring.exception')).toBe(true);
    expect(isExceptionSource('leave.approval')).toBe(false);
    expect(buildActionInbox(data, null, NOW).find((i) => i.entityId === 'm1')?.kind).toBe('exception');
    expect(inboxCounts(data, null, buildActionInbox(data, null, NOW))).toMatchObject({ approval: 1, exception: 2 });
  });
});
