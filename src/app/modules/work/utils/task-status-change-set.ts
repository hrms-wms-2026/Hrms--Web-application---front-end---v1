import { TaskStatusCategory, TaskStatusColumn } from '../models/task.model';
import { TaskStatusChangeSetDto, TaskStatusSnapshotDto } from '../models/dto/task-status-change-request.dto';

/** A row as edited in the status editor; ids starting with NEW_STATUS_PREFIX are unsaved additions. */
export interface EditedStatusRow {
  id: string;
  name: string;
  visibility: 'public' | 'private';
  category: TaskStatusCategory;
  color: string;
}

export const NEW_STATUS_PREFIX = 'new-';

const snapshot = (row: EditedStatusRow | TaskStatusColumn): TaskStatusSnapshotDto => ({
  name: row.name,
  category: row.category,
  color: row.color,
  visibility: row.visibility,
});

const sameSnapshot = (a: TaskStatusSnapshotDto, b: TaskStatusSnapshotDto) =>
  a.name === b.name && a.category === b.category && a.color === b.color && a.visibility === b.visibility;

/**
 * Diffs the editor's final rows (in their on-screen order) against the statuses it was opened with,
 * producing the change set a status change request carries. Rows missing from `rows` are deletes.
 */
export function buildStatusChangeSet(
  originals: readonly TaskStatusColumn[],
  rows: readonly EditedStatusRow[],
): TaskStatusChangeSetDto {
  const base = [...originals].sort((a, b) => a.displayOrder - b.displayOrder);
  const byId = new Map(base.map((s) => [s.id, s]));
  const kept = new Set(rows.map((r) => r.id));

  const adds = rows
    .filter((r) => r.id.startsWith(NEW_STATUS_PREFIX))
    .map((r) => ({ tempKey: r.id, ...snapshot(r) }));

  const updates = rows
    .filter((r) => byId.has(r.id))
    .map((r) => ({ statusId: r.id, from: snapshot(byId.get(r.id)!), to: snapshot(r) }))
    .filter((u) => !sameSnapshot(u.from, u.to));

  const deletes = base.filter((s) => !kept.has(s.id)).map((s) => ({ statusId: s.id, name: s.name }));

  return {
    adds,
    updates,
    deletes,
    baseOrder: base.map((s) => s.id),
    order: rows.map((r) => r.id),
  };
}

/** Mirrors the backend's TaskStatusChangeSet.ReordersExisting. */
export function reordersExisting(set: TaskStatusChangeSetDto): boolean {
  const deleted = new Set(set.deletes.map((d) => d.statusId));
  const baseSurvivors = set.baseOrder.filter((id) => !deleted.has(id));
  const baseSet = new Set(baseSurvivors);
  const intended = set.order.filter((key) => baseSet.has(key));
  return baseSurvivors.some((id, i) => intended[i] !== id);
}

export function isEmptyChangeSet(set: TaskStatusChangeSetDto): boolean {
  return !set.adds.length && !set.updates.length && !set.deletes.length && !reordersExisting(set);
}

/** Human-readable lines describing a change set, for request previews. */
export function describeStatusChangeSet(set: TaskStatusChangeSetDto): string[] {
  const lines: string[] = [];
  for (const add of set.adds) lines.push(`Add "${add.name}" (${categoryLabel(add.category)})`);
  for (const u of set.updates) {
    const parts: string[] = [];
    if (u.from.name !== u.to.name) parts.push(`rename to "${u.to.name}"`);
    if (u.from.category !== u.to.category) parts.push(`move to ${categoryLabel(u.to.category)}`);
    if (u.from.color.toLowerCase() !== u.to.color.toLowerCase()) parts.push('change color');
    if (u.from.visibility !== u.to.visibility) parts.push(`make ${u.to.visibility}`);
    lines.push(`"${u.from.name}": ${parts.join(', ')}`);
  }
  for (const d of set.deletes) lines.push(`Delete "${d.name}"`);
  if (reordersExisting(set)) lines.push('Reorder statuses');
  return lines;
}

export function categoryLabel(category: TaskStatusCategory): string {
  return category === 'not_started' ? 'Not Started' : category === 'active' ? 'Active' : 'Done';
}
