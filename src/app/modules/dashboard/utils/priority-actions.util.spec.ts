import { ActionItem, ActionSourceSummary, TeamActionItemsResponse } from '../models/my-team-action-items.model';
import { LedOverdueTask, LedWorkProgressResponse } from '../models/my-team-led-progress.model';
import { buildPriorityActions } from './priority-actions.util';

const NOW = new Date('2026-09-30T12:00:00Z');

function item(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    sourceKey: 'leave.approval', entityId: 'i1', title: 'Leave request', subjectEmployeeId: null,
    subjectName: 'Priya K', createdAt: '2026-09-29T00:00:00Z', exceptionStatus: null,
    link: { kind: 'leave.approval', params: { requestId: 'i1' } },
    ...overrides
  };
}

function source(overrides: Partial<ActionSourceSummary> = {}): ActionSourceSummary {
  return {
    sourceKey: 'leave.approval', domain: 'people', status: 'ok', pendingCount: 1,
    inProgressCount: null, oldestPendingAt: null, topItems: [item()],
    ...overrides
  };
}

function actionItems(sources: ActionSourceSummary[]): TeamActionItemsResponse {
  return { legalEntityId: 'le-1', sources };
}

function overdueTask(overrides: Partial<LedOverdueTask> = {}): LedOverdueTask {
  return {
    taskId: 't1', shortId: 'CP-1', title: 'Fix bug', projectId: 'p1', objectiveId: 'o1',
    dueDate: '2026-09-20', daysOverdue: 5, assignees: [],
    ...overrides
  };
}

function ledProgress(overdueTasks: LedOverdueTask[]): LedWorkProgressResponse {
  return {
    hours: { allocatedHours: 0, completedHours: 0, inProgressHours: 0, notStartedHours: 0, untaskedHours: 0, overTaskedHours: 0, taskCount: 0, unestimatedTaskCount: 0 }, modulesAtRisk: 0,
    projects: [], overdueTasks, overdueTotal: overdueTasks.length
  };
}

describe('buildPriorityActions', () => {
  it('returns an empty list when both inputs are null', () => {
    expect(buildPriorityActions(null, null, NOW)).toEqual([]);
  });

  it('orders groups: escalated exceptions, open exceptions, pending approvals, overdue work', () => {
    const escalatedItem = item({ sourceKey: 'monitoring.exception', entityId: 'e1', exceptionStatus: 'Escalated' });
    const openItem = item({ sourceKey: 'monitoring.exception', entityId: 'e2', exceptionStatus: 'Open' });
    const leaveItem = item({ sourceKey: 'leave.approval', entityId: 'l1' });
    const data = actionItems([
      source({ sourceKey: 'monitoring.exception', topItems: [escalatedItem, openItem] }),
      source({ sourceKey: 'leave.approval', topItems: [leaveItem] })
    ]);
    const result = buildPriorityActions(data, ledProgress([overdueTask()]), NOW);

    expect(result.map((r) => r.group)).toEqual([
      'escalated_exception', 'open_exception', 'pending_approval', 'overdue_work'
    ]);
    expect(result[0].entityId).toBe('e1');
    expect(result[1].entityId).toBe('e2');
    expect(result[2].entityId).toBe('l1');
    expect(result[3].entityId).toBe('t1');
  });

  it('merges all approval sources oldest-first, excluding the exception source', () => {
    const older = item({ sourceKey: 'leave.approval', entityId: 'older', createdAt: '2026-09-01T00:00:00Z' });
    const newer = item({ sourceKey: 'attendance.correction', entityId: 'newer', createdAt: '2026-09-10T00:00:00Z' });
    const exceptionItem = item({ sourceKey: 'monitoring.exception', entityId: 'should-not-appear', exceptionStatus: 'Open', createdAt: '2026-08-01T00:00:00Z' });
    const data = actionItems([
      source({ sourceKey: 'leave.approval', topItems: [newer] }),
      source({ sourceKey: 'attendance.correction', domain: 'people', topItems: [older] }),
      source({ sourceKey: 'monitoring.exception', topItems: [exceptionItem] })
    ]);
    const result = buildPriorityActions(data, null, NOW);
    const approvals = result.filter((r) => r.group === 'pending_approval');

    expect(approvals.map((r) => r.entityId)).toEqual(['older', 'newer']);
    // The exception item legitimately lands in the open_exception group (it's a real open
    // exception) - it must simply never be merged into the pending_approval group.
    expect(approvals.some((r) => r.entityId === 'should-not-appear')).toBe(false);
    expect(result.find((r) => r.entityId === 'should-not-appear')?.group).toBe('open_exception');
  });

  it('breaks createdAt ties by sourceKey then entityId', () => {
    const sameTime = '2026-09-01T00:00:00Z';
    const a = item({ sourceKey: 'work.task_edit', entityId: 'b', createdAt: sameTime });
    const b = item({ sourceKey: 'leave.approval', entityId: 'a', createdAt: sameTime });
    const data = actionItems([
      source({ sourceKey: 'work.task_edit', domain: 'work', topItems: [a] }),
      source({ sourceKey: 'leave.approval', domain: 'people', topItems: [b] })
    ]);
    const result = buildPriorityActions(data, null, NOW);

    expect(result.map((r) => r.sourceKey)).toEqual(['leave.approval', 'work.task_edit']);
  });

  it('excludes an unavailable source entirely', () => {
    const data = actionItems([source({ status: 'unavailable', topItems: [item()] })]);
    expect(buildPriorityActions(data, null, NOW)).toEqual([]);
  });

  it('caps each group at 5 items even when more are available', () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      item({ entityId: `i${i}`, createdAt: `2026-09-0${i + 1}T00:00:00Z` })
    );
    const data = actionItems([source({ topItems: items })]);
    const result = buildPriorityActions(data, null, NOW);
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.entityId)).toEqual(['i0', 'i1', 'i2', 'i3', 'i4']);
  });

  it('sorts overdue work by most days overdue first, then shortId', () => {
    const data = ledProgress([
      overdueTask({ taskId: 't1', shortId: 'CP-2', daysOverdue: 3 }),
      overdueTask({ taskId: 't2', shortId: 'CP-1', daysOverdue: 7 }),
      overdueTask({ taskId: 't3', shortId: 'CP-1', daysOverdue: 7 })
    ]);
    const result = buildPriorityActions(null, data, NOW);
    expect(result.map((r) => r.entityId)).toEqual(['t2', 't3', 't1']);
  });

  it('builds a route-ready overdueTask payload with no link', () => {
    const data = ledProgress([overdueTask({ taskId: 't1', projectId: 'p9', objectiveId: 'o9' })]);
    const result = buildPriorityActions(null, data, NOW);
    expect(result[0].link).toBeNull();
    expect(result[0].overdueTask).toEqual({ projectId: 'p9', objectiveId: 'o9', taskId: 't1' });
  });

  it('excludes the caller\'s own personal overdue tasks (D7)', () => {
    const data = ledProgress([
      overdueTask({ taskId: 'mine', assignees: [{ employeeId: 'caller-1', displayName: 'Me' }] }),
      overdueTask({ taskId: 'theirs', shortId: 'CP-2', assignees: [{ employeeId: 'someone-else', displayName: 'Arjun' }] })
    ]);
    const result = buildPriorityActions(null, data, NOW, 'caller-1');
    expect(result.map((r) => r.entityId)).toEqual(['theirs']);
  });

  it('formats the age caption in compact hours/days', () => {
    const data = actionItems([source({ topItems: [item({ createdAt: '2026-09-30T09:00:00Z' })] })]);
    const result = buildPriorityActions(data, null, NOW);
    expect(result[0].captionLabel).toBe('3h ago');
  });
});
