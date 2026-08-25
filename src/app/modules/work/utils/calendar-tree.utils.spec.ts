import { buildCalendarTreeOrder } from './calendar-tree.utils';
import { ProjectCalendarItemDto } from '../models/dto/calendar.dto';

const item = (overrides: Partial<ProjectCalendarItemDto> = {}): ProjectCalendarItemDto => ({
  objectiveId: 'o', projectId: 'p1', parentObjectiveId: null, title: 'Objective',
  startDate: '2026-01-01', endDate: '2026-02-01', isActive: true, isAchieved: false,
  canEdit: true, calendarEventId: null, calendarEventColor: null, ...overrides
});

describe('buildCalendarTreeOrder', () => {
  it('orders each parent immediately before its own children, depth-first', () => {
    const root = item({ objectiveId: 'root' });
    const childB = item({ objectiveId: 'childB', parentObjectiveId: 'root' });
    const childA = item({ objectiveId: 'childA', parentObjectiveId: 'root' });
    const grandchild = item({ objectiveId: 'grandchild', parentObjectiveId: 'childA' });
    const otherRoot = item({ objectiveId: 'otherRoot' });

    // Deliberately out of tree order, as the API might return it. Siblings keep
    // their relative input order (root before childA/childB), but a whole
    // subtree (grandchild) still moves to sit right after its own parent
    // (childA) rather than staying at its original flat-list position.
    const rows = buildCalendarTreeOrder([root, grandchild, otherRoot, childB, childA]);

    expect(rows.map((r) => r.item.objectiveId)).toEqual(['root', 'childB', 'childA', 'grandchild', 'otherRoot']);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 2, 0]);
  });

  it('appends an item whose parent is missing from the list, at depth 0, instead of dropping it', () => {
    const orphan = item({ objectiveId: 'orphan', parentObjectiveId: 'does-not-exist' });
    const root = item({ objectiveId: 'root' });

    const rows = buildCalendarTreeOrder([orphan, root]);

    expect(rows.map((r) => r.item.objectiveId)).toEqual(['root', 'orphan']);
    expect(rows.find((r) => r.item.objectiveId === 'orphan')?.depth).toBe(0);
  });

  it('returns an empty list for no items', () => {
    expect(buildCalendarTreeOrder([])).toEqual([]);
  });
});
