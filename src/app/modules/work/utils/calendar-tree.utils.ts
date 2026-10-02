import { ProjectCalendarModuleDto } from '../models/dto/calendar.dto';

export interface CalendarTreeRow {
  readonly item: ProjectCalendarModuleDto;
  readonly depth: number;
  readonly hasChildren: boolean;
  /** Whether this row is the last child among its own siblings - the connector line stops here instead of continuing to a sibling below. */
  readonly isLast: boolean;
  /**
   * One entry per strict ancestor at depth 1..depth-1 (length === depth-1, empty for a
   * depth-0 or depth-1 row), true when that ancestor still has a later sibling below - i.e.
   * whether the tree's vertical guide line passes through this row at that column. Every
   * entry is a pass-through column; this row's own connector to its immediate parent is a
   * separate elbow column, rendered from `isLast` rather than from this array.
   */
  readonly ancestorLines: readonly boolean[];
  /**
   * The id of the depth-1 objective this row's branch descends from (a depth-1
   * item is its own branchRootId; a depth-0 root's is its own id too). Lets the
   * calendar give every top-level module - and everything nested under it - a
   * shared bar color, so the connector lines and the color agree on "one branch".
   */
  readonly branchRootId: string;
}

/**
 * Orders objectives depth-first (each parent immediately followed by its own
 * children) and tags each with its nesting depth, matching the Tree tab's
 * layout. A row whose objectiveId is in `collapsedIds` still renders, but its
 * descendants are skipped - same collapse semantics as the Tree tab's chevron.
 */
export function buildCalendarTreeOrder(
  items: readonly ProjectCalendarModuleDto[],
  collapsedIds: ReadonlySet<string> = new Set()
): CalendarTreeRow[] {
  const childrenByParentId = new Map<string | null, ProjectCalendarModuleDto[]>();
  for (const item of items) {
    const siblings = childrenByParentId.get(item.parentObjectiveId);
    if (siblings) siblings.push(item);
    else childrenByParentId.set(item.parentObjectiveId, [item]);
  }

  // Reachability from a root, ignoring collapse - lets the orphan fallback below tell
  // a genuinely parentless item apart from one that's merely hidden under a collapsed
  // ancestor (which must stay out of the rows, not get re-appended as an "orphan").
  const attached = new Set<string>();
  function markAttached(parentId: string | null): void {
    for (const item of childrenByParentId.get(parentId) ?? []) {
      if (attached.has(item.objectiveId)) continue; // guards a malformed/cyclic parent chain
      attached.add(item.objectiveId);
      markAttached(item.objectiveId);
    }
  }
  markAttached(null);

  const rows: CalendarTreeRow[] = [];
  const visited = new Set<string>();

  function visit(parentId: string | null, depth: number, ancestorLines: readonly boolean[], inheritedBranchRootId: string | null): void {
    const siblings = childrenByParentId.get(parentId) ?? [];
    siblings.forEach((item, index) => {
      if (visited.has(item.objectiveId)) return; // guards a malformed/cyclic parent chain
      visited.add(item.objectiveId);
      const isLast = index === siblings.length - 1;
      const hasChildren = (childrenByParentId.get(item.objectiveId)?.length ?? 0) > 0;
      // depth-0 (the project root) and each of its direct depth-1 children start their own
      // branch; anything deeper just inherits the branch it was already handed.
      const branchRootId = inheritedBranchRootId ?? item.objectiveId;
      rows.push({ item, depth, hasChildren, isLast, ancestorLines, branchRootId });
      if (hasChildren && !collapsedIds.has(item.objectiveId)) {
        const childBranchRootId = depth === 0 ? null : branchRootId;
        // The root (depth 0) never renders a guide column of its own, so it contributes
        // nothing to its children's pass-through columns - they start a fresh array. Every
        // other row appends its own continuation flag for its children to read back as
        // their own left-most-so-far pass-through column.
        const childAncestorLines = depth === 0 ? [] : [...ancestorLines, !isLast];
        visit(item.objectiveId, depth + 1, childAncestorLines, childBranchRootId);
      }
    });
  }

  visit(null, 0, [], null);

  // An item whose parentObjectiveId doesn't match anything in this list (data
  // anomaly, not expected in normal operation) still has to render somewhere
  // rather than silently vanish - append it at depth 0.
  for (const item of items) {
    if (!attached.has(item.objectiveId) && !visited.has(item.objectiveId)) {
      visited.add(item.objectiveId);
      rows.push({ item, depth: 0, hasChildren: false, isLast: true, ancestorLines: [], branchRootId: item.objectiveId });
    }
  }

  return rows;
}
