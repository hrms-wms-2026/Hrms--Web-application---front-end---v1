import { buildCalendarTreeOrder } from './calendar-tree.utils';
import { ProjectCalendarModuleDto } from '../models/dto/calendar.dto';

const item = (overrides: Partial<ProjectCalendarModuleDto> = {}): ProjectCalendarModuleDto => ({
  objectiveId: 'o', projectId: 'p1', parentObjectiveId: null, title: 'Objective',
  startDate: '2026-01-01', endDate: '2026-02-01', isActive: true, isAchieved: false,
  canEdit: true, events: [], ...overrides
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

  it('flags hasChildren only for objectives that have at least one child', () => {
    const root = item({ objectiveId: 'root' });
    const child = item({ objectiveId: 'child', parentObjectiveId: 'root' });

    const rows = buildCalendarTreeOrder([root, child]);

    expect(rows.find((r) => r.item.objectiveId === 'root')?.hasChildren).toBe(true);
    expect(rows.find((r) => r.item.objectiveId === 'child')?.hasChildren).toBe(false);
  });

  it('skips the descendants of a collapsed objective but keeps the row itself', () => {
    const root = item({ objectiveId: 'root' });
    const child = item({ objectiveId: 'child', parentObjectiveId: 'root' });
    const grandchild = item({ objectiveId: 'grandchild', parentObjectiveId: 'child' });
    const otherRoot = item({ objectiveId: 'otherRoot' });

    const rows = buildCalendarTreeOrder([root, child, grandchild, otherRoot], new Set(['child']));

    expect(rows.map((r) => r.item.objectiveId)).toEqual(['root', 'child', 'otherRoot']);
  });

  it('gives every depth-1 module its own branch, inherited by everything nested under it', () => {
    const root = item({ objectiveId: 'root' });
    const moduleA = item({ objectiveId: 'moduleA', parentObjectiveId: 'root' });
    const subA = item({ objectiveId: 'subA', parentObjectiveId: 'moduleA' });
    const moduleB = item({ objectiveId: 'moduleB', parentObjectiveId: 'root' });

    const rows = buildCalendarTreeOrder([root, moduleA, subA, moduleB]);
    const byId = (id: string) => rows.find((r) => r.item.objectiveId === id)!;

    expect(byId('root').branchRootId).toBe('root');
    expect(byId('moduleA').branchRootId).toBe('moduleA');
    expect(byId('subA').branchRootId).toBe('moduleA');
    expect(byId('moduleB').branchRootId).toBe('moduleB');
  });

  describe('ancestorLines - connector-line continuity across rows', () => {
    // root -> moduleA (has a following sibling moduleB) -> subA (moduleA's only child) -> moduleB
    const root = item({ objectiveId: 'root' });
    const moduleA = item({ objectiveId: 'moduleA', parentObjectiveId: 'root' });
    const subA = item({ objectiveId: 'subA', parentObjectiveId: 'moduleA' });
    const moduleB = item({ objectiveId: 'moduleB', parentObjectiveId: 'root' });
    const rows = buildCalendarTreeOrder([root, moduleA, subA, moduleB]);
    const byId = (id: string) => rows.find((r) => r.item.objectiveId === id)!;

    it('gives the root row no guide columns at all (it has no ancestor of its own)', () => {
      expect(byId('root').ancestorLines).toEqual([]);
    });

    it('gives a depth-1 row no pass-through columns - only its own elbow', () => {
      expect(byId('moduleA').ancestorLines).toEqual([]);
      expect(byId('moduleA').isLast).toBe(false); // moduleB still follows
    });

    it("carries the parent's own continuation flag into its child's first pass-through column, not a stale grandparent flag", () => {
      // subA is moduleA's child. Its one pass-through column must reflect moduleA's own
      // "more siblings below" flag (true, because moduleB follows) - not root's (root is an
      // only child and never gets a visible column at all). Getting this backwards is what
      // breaks the connector line's continuity between moduleA's row and moduleB's row.
      expect(byId('subA').ancestorLines).toEqual([true]);
      expect(byId('subA').isLast).toBe(true); // subA has no siblings of its own
    });
  });
});
