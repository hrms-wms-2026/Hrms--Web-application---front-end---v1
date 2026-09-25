import { TaskStatusColumn } from '../models/task.model';
import {
  buildStatusChangeSet,
  describeStatusChangeSet,
  isEmptyChangeSet,
  reordersExisting,
} from './task-status-change-set';

describe('task-status-change-set', () => {
  const col = (id: string, name: string, displayOrder: number, category: TaskStatusColumn['category']): TaskStatusColumn => ({
    id, name, displayOrder, category, color: '#94A3B8', visibility: 'public', requiresApproval: false, marksTaskComplete: category === 'done',
  });
  const originals = [col('a', 'To Do', 0, 'not_started'), col('b', 'Doing', 1, 'active'), col('c', 'Done', 2, 'done')];
  const rows = (list: TaskStatusColumn[]) => list.map(({ id, name, visibility, category, color }) => ({ id, name, visibility, category, color }));

  it('produces an empty change set when nothing changed', () => {
    const set = buildStatusChangeSet(originals, rows(originals));
    expect(isEmptyChangeSet(set)).toBe(true);
  });

  it('diffs adds, updates, deletes and order', () => {
    const edited = [
      { ...rows(originals)[0], name: 'Backlog' },
      { id: 'new-1', name: 'Blocked', visibility: 'public' as const, category: 'active' as const, color: '#DC2626' },
      rows(originals)[2],
    ];
    const set = buildStatusChangeSet(originals, edited);

    expect(set.adds).toEqual([{ tempKey: 'new-1', name: 'Blocked', category: 'active', color: '#DC2626', visibility: 'public' }]);
    expect(set.updates.map((u) => [u.statusId, u.from.name, u.to.name])).toEqual([['a', 'To Do', 'Backlog']]);
    expect(set.deletes).toEqual([{ statusId: 'b', name: 'Doing' }]);
    expect(reordersExisting(set)).toBe(false);
    expect(describeStatusChangeSet(set)).toEqual([
      'Add "Blocked" (Active)',
      '"To Do": rename to "Backlog"',
      'Delete "Doing"',
    ]);
  });

  it('flags a change in the relative order of existing statuses as a reorder', () => {
    const [a, b, c] = rows(originals);
    const set = buildStatusChangeSet(originals, [b, a, c]);
    expect(reordersExisting(set)).toBe(true);
    expect(isEmptyChangeSet(set)).toBe(false);
    expect(describeStatusChangeSet(set)).toEqual(['Reorder statuses']);
  });
});
