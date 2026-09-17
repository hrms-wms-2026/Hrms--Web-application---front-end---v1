import { ProjectCalendarModuleDto } from '../models/dto/calendar.dto';

export interface CalendarTreeRow {
  readonly item: ProjectCalendarModuleDto;
  readonly depth: number;
}

/**
 * Orders objectives depth-first (each parent immediately followed by its own
 * children) and tags each with its nesting depth, so the calendar can render
 * the parent/child tree via indentation alone - no collapse/expand widget,
 * every row always stays visible so every bar's timeline stays comparable.
 */
export function buildCalendarTreeOrder(items: readonly ProjectCalendarModuleDto[]): CalendarTreeRow[] {
  const childrenByParentId = new Map<string | null, ProjectCalendarModuleDto[]>();
  for (const item of items) {
    const siblings = childrenByParentId.get(item.parentObjectiveId);
    if (siblings) siblings.push(item);
    else childrenByParentId.set(item.parentObjectiveId, [item]);
  }

  const rows: CalendarTreeRow[] = [];
  const visited = new Set<string>();

  function visit(parentId: string | null, depth: number): void {
    for (const item of childrenByParentId.get(parentId) ?? []) {
      if (visited.has(item.objectiveId)) continue; // guards a malformed/cyclic parent chain
      visited.add(item.objectiveId);
      rows.push({ item, depth });
      visit(item.objectiveId, depth + 1);
    }
  }

  visit(null, 0);

  // An item whose parentObjectiveId doesn't match anything in this list (data
  // anomaly, not expected in normal operation) still has to render somewhere
  // rather than silently vanish - append it at depth 0.
  for (const item of items) {
    if (!visited.has(item.objectiveId)) {
      visited.add(item.objectiveId);
      rows.push({ item, depth: 0 });
    }
  }

  return rows;
}
