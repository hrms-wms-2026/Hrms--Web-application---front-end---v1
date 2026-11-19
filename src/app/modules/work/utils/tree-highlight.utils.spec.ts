import { MilestoneTreeNode } from '../models/milestone.model';
import { WorkTask } from '../models/task.model';
import { computeTreeHighlight, hasActiveHighlight } from './tree-highlight.utils';

const TODAY = new Date(2026, 8, 24); // 2026-09-24, local

function objective(id: string, overrides: Partial<MilestoneTreeNode> = {}): MilestoneTreeNode {
  return {
    id, title: id, description: null, startDate: '2026-09-01', endDate: '2026-12-31', progress: 0,
    allocatedHours: 0, completedHours: 0, isActive: true, isAchieved: false, ownerName: null, ownerId: null,
    isOwner: false, children: [], kind: 'objective', ...overrides
  };
}

function sprint(id: string, overrides: Partial<MilestoneTreeNode> = {}): MilestoneTreeNode {
  return objective(id, { kind: 'sprint', startDate: '2026-09-20', endDate: '2026-10-03', ...overrides });
}

function task(id: string, source: Partial<WorkTask> = {}, overrides: Partial<MilestoneTreeNode> = {}): MilestoneTreeNode {
  const taskSource = {
    id, statusId: 'st-todo', categoryId: 'cat-a', priority: 'medium', dueDate: null,
    assigneeEmployeeIds: [], progressPercent: 0, ...source
  } as unknown as WorkTask;
  return objective(id, { kind: 'task', progress: taskSource.progressPercent, taskSource, ...overrides });
}

/**
 * root
 * ├── m1 (owner e1, active, ends 2026-09-20 -> overdue)
 * │   ├── s1 (sprint)
 * │   │   └── t1 (high, st-review, assignee e2, due 2026-09-28)
 * │   └── t2 (low, st-todo, no due date)
 * └── m2 (owner e2, inactive, 2026-10-01..2026-11-15)
 *     └── m3 (achieved, progress 100)
 */
function buildTree(): MilestoneTreeNode {
  const t1 = task('t1', { priority: 'high', statusId: 'st-review', assigneeEmployeeIds: ['e2'], dueDate: new Date(2026, 8, 28), progressPercent: 40 });
  const t2 = task('t2', { priority: 'low', categoryId: 'cat-b' });
  const s1 = sprint('s1', { children: [t1] });
  const m1 = objective('m1', { ownerId: 'e1', endDate: '2026-09-20', progress: 30, children: [s1, t2] });
  const m3 = objective('m3', { isAchieved: true, progress: 100, startDate: '2026-10-01', endDate: '2026-10-10' });
  const m2 = objective('m2', { ownerId: 'e2', isActive: false, startDate: '2026-10-01', endDate: '2026-11-15', children: [m3] });
  return objective('root', { startDate: '2026-01-01', endDate: '2026-12-31', progress: 15, children: [m1, m2] });
}

function lastSegment(key: string): string {
  return key.split('/').pop()!;
}

function matched(values: Record<string, string[]>): string[] {
  return [...computeTreeHighlight(buildTree(), values, TODAY).matchedKeys].map(lastSegment).sort();
}

describe('tree-highlight.utils', () => {
  describe('hasActiveHighlight', () => {
    it('is false when every field is empty', () => {
      expect(hasActiveHighlight({})).toBe(false);
      expect(hasActiveHighlight({ module: [], owner: [] })).toBe(false);
    });

    it('is true when any field has a value', () => {
      expect(hasActiveHighlight({ module: [], priority: ['high'] })).toBe(true);
    });
  });

  it('matches nothing when no filter is active', () => {
    const result = computeTreeHighlight(buildTree(), {}, TODAY);
    expect(result.matchedKeys.size).toBe(0);
    expect(result.ancestorKeys.size).toBe(0);
  });

  it('module scopes the selected module and everything beneath it', () => {
    expect(matched({ module: ['m1'] })).toEqual(['m1', 's1', 't1', 't2']);
  });

  it('sprint scopes the sprint and its tasks', () => {
    expect(matched({ sprint: ['s1'] })).toEqual(['s1', 't1']);
  });

  it('owner matches module owners and task assignees, never sprints', () => {
    expect(matched({ owner: ['e2'] })).toEqual(['m2', 't1']);
  });

  it('active status applies to modules only', () => {
    expect(matched({ activeStatus: ['inactive'] })).toEqual(['m2']);
    expect(matched({ activeStatus: ['achieved'] })).toEqual(['m3']);
    expect(matched({ activeStatus: ['active'] })).toEqual(['m1', 'root']);
  });

  it('due date buckets use module/sprint end date and task due date', () => {
    expect(matched({ dueDate: ['overdue'] })).toEqual(['m1']);
    expect(matched({ dueDate: ['due7'] })).toEqual(['t1']);
    expect(matched({ dueDate: ['due30'] })).toEqual(['m3', 's1', 't1']);
    expect(matched({ dueDate: ['none'] })).toEqual(['t2']);
  });

  it('does not treat a completed item as overdue', () => {
    const tree = objective('root', { children: [objective('done', { endDate: '2026-09-01', isAchieved: true })] });
    expect(computeTreeHighlight(tree, { dueDate: ['overdue'] }, TODAY).matchedKeys.has('root/done')).toBe(false);
  });

  it('duration buckets apply to modules and sprints only', () => {
    expect(matched({ duration: ['lt2w'] })).toEqual(['m3', 's1']);
    expect(matched({ duration: ['1m3m'] })).toEqual(['m2']);
    expect(matched({ duration: ['2w1m'] })).toEqual(['m1']);
    expect(matched({ duration: ['gt3m'] })).toEqual(['root']);
  });

  it('item type matches by node kind', () => {
    expect(matched({ itemType: ['sprint', 'task'] })).toEqual(['s1', 't1', 't2']);
  });

  it('task status, priority and category apply to tasks only', () => {
    expect(matched({ taskStatus: ['st-review'] })).toEqual(['t1']);
    expect(matched({ priority: ['low', 'high'] })).toEqual(['t1', 't2']);
    expect(matched({ category: ['cat-b'] })).toEqual(['t2']);
  });

  it('progress buckets', () => {
    expect(matched({ progress: ['0'] })).toEqual(['m2', 's1', 't2']);
    expect(matched({ progress: ['1-50'] })).toEqual(['m1', 'root', 't1']);
    expect(matched({ progress: ['100'] })).toEqual(['m3']);
  });

  it('search matches titles of modules, sprints and tasks case-insensitively', () => {
    expect(matched({ search: ['T1'] })).toEqual(['t1']);
    expect(matched({ search: ['  m  '] })).toEqual(['m1', 'm2', 'm3']);
    expect(matched({ search: ['s1'], itemType: ['sprint'] })).toEqual(['s1']);
  });

  it('ignores a blank search term', () => {
    expect(hasActiveHighlight({ search: ['   '] })).toBe(false);
    expect(matched({ search: ['   '] })).toEqual([]);
  });

  it('ANDs across fields and ORs within a field', () => {
    expect(matched({ module: ['m1'], priority: ['high', 'low'] })).toEqual(['t1', 't2']);
    expect(matched({ module: ['m1'], itemType: ['task'], taskStatus: ['st-review'] })).toEqual(['t1']);
  });

  it('keys matches by tree position, so a project-level sprint shown under two modules counts (and scopes) per row', () => {
    const shared = () => sprint('s-shared', { children: [task('t-shared', { priority: 'high' })] });
    const tree = objective('root', {
      children: [objective('a', { children: [shared()] }), objective('b', { children: [shared()] })]
    });

    const all = computeTreeHighlight(tree, { priority: ['high'] }, TODAY);
    expect([...all.matchedKeys].sort()).toEqual(['root/a/s-shared/t-shared', 'root/b/s-shared/t-shared']);

    // Module scope must only light up the copy under the chosen module, not its twin.
    const scoped = computeTreeHighlight(tree, { module: ['a'], itemType: ['sprint'] }, TODAY);
    expect([...scoped.matchedKeys]).toEqual(['root/a/s-shared']);
  });

  it('collects ancestors of every match so their branches can auto-expand', () => {
    const result = computeTreeHighlight(buildTree(), { taskStatus: ['st-review'] }, TODAY);
    expect([...result.ancestorKeys].sort()).toEqual(['root', 'root/m1', 'root/m1/s1']);
  });
});
