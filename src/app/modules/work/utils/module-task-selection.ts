export type ModuleCheckState = 'checked' | 'indeterminate' | 'unchecked';
export interface PickerModule { objectiveId: string; title: string; isAchieved?: boolean; }
export interface PickerTask { id: string; title: string; objectiveId: string; sprintId: string | null; shortId?: string; }

export function toggleId(ids: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

export function toggleModuleLive(
  objectiveId: string, tasks: readonly PickerTask[] | undefined,
  selectedTaskIds: ReadonlySet<string>, selectedObjectiveIds: ReadonlySet<string>
): { taskIds: Set<string>; objectiveIds: Set<string> } {
  const objectiveIds = new Set(selectedObjectiveIds);
  const taskIds = new Set(selectedTaskIds);
  if (objectiveIds.has(objectiveId)) {
    objectiveIds.delete(objectiveId);
  } else {
    objectiveIds.add(objectiveId);
    // whole module supersedes individual task ticks for that module
    for (const task of tasks ?? []) taskIds.delete(task.id);
  }
  return { taskIds, objectiveIds };
}

export function toggleModuleBulk(
  tasks: readonly PickerTask[], selectedTaskIds: ReadonlySet<string>, isPickable: (t: PickerTask) => boolean
): Set<string> {
  const pickable = tasks.filter(isPickable);
  const next = new Set(selectedTaskIds);
  const allSelected = pickable.length > 0 && pickable.every((task) => next.has(task.id));
  for (const task of pickable) {
    if (allSelected) next.delete(task.id); else next.add(task.id);
  }
  return next;
}

export function moduleCheckState(
  mode: 'live' | 'bulk', objectiveId: string, tasks: readonly PickerTask[] | undefined,
  selectedTaskIds: ReadonlySet<string>, selectedObjectiveIds: ReadonlySet<string>, isPickable: (t: PickerTask) => boolean
): ModuleCheckState {
  if (mode === 'live' && selectedObjectiveIds.has(objectiveId)) return 'checked';
  const list = (tasks ?? []).filter(isPickable);
  const picked = list.filter((task) => selectedTaskIds.has(task.id)).length;
  if (picked === 0) return 'unchecked';
  if (mode === 'bulk' && picked === list.length) return 'checked';
  return 'indeterminate';
}
