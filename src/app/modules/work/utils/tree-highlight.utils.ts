import { MilestoneTreeNode, MilestoneTreeNodeKind } from '../models/milestone.model';

/** Filter-bar values keyed by field key. Empty array = field not filtering. */
export type TreeHighlightValues = Readonly<Record<string, readonly string[]>>;

/**
 * Results are keyed by tree position (see treeNodeKey), not bare node id: a project-level sprint
 * renders under every module it holds tasks for, so one sprint/task id can be several rows -
 * each row must match, count and expand on its own.
 */
export interface TreeHighlightResult {
  /** Rows that satisfy every active field. */
  matchedKeys: ReadonlySet<string>;
  /** Ancestor rows of every match - expanded so the matches are visible without hunting. */
  ancestorKeys: ReadonlySet<string>;
}

/** A row's identity in the rendered tree: its ancestry path of ids, e.g. "root/moduleA/sprint1". */
export function treeNodeKey(parentKey: string, id: string): string {
  return parentKey ? `${parentKey}/${id}` : id;
}

const DAY_MS = 86_400_000;

export function collectNodes(root: MilestoneTreeNode, predicate: (node: MilestoneTreeNode) => boolean): MilestoneTreeNode[] {
  const found: MilestoneTreeNode[] = [];
  const walk = (node: MilestoneTreeNode): void => {
    if (predicate(node)) found.push(node);
    node.children.forEach(walk);
  };
  walk(root);
  return found;
}

export function hasActiveHighlight(values: TreeHighlightValues): boolean {
  return activeFields(values).length > 0;
}

/** Fields with at least one non-blank value (a whitespace-only search term is "not searching"). */
function activeFields(values: TreeHighlightValues): [string, string[]][] {
  return Object.entries(values)
    .map(([key, v]): [string, string[]] => [key, v.filter((x) => x.trim() !== '')])
    .filter(([, v]) => v.length > 0);
}

/**
 * Highlight-mode filtering for the objective tree: nothing is removed, the tree stays whole;
 * this only reports which nodes match. AND across fields, OR within a field. Module and Sprint
 * are scope filters (the node itself or any ancestor is selected) so they combine with task-level
 * fields; every other field only applies to the node kinds that carry that attribute.
 */
export function computeTreeHighlight(root: MilestoneTreeNode, values: TreeHighlightValues, today: Date): TreeHighlightResult {
  const matchedKeys = new Set<string>();
  const ancestorKeys = new Set<string>();
  const active = activeFields(values);
  if (active.length === 0) return { matchedKeys, ancestorKeys };

  const todayDay = dayNumber(today);
  const walk = (node: MilestoneTreeNode, ancestors: MilestoneTreeNode[], ancestorPath: string[]): void => {
    const key = treeNodeKey(ancestorPath[ancestorPath.length - 1] ?? '', node.id);
    if (active.every(([field, selected]) => matchesField(field, new Set(selected), node, ancestors, todayDay))) {
      matchedKeys.add(key);
      for (const ancestorKey of ancestorPath) ancestorKeys.add(ancestorKey);
    }
    for (const child of node.children) walk(child, [...ancestors, node], [...ancestorPath, key]);
  };
  walk(root, [], []);
  return { matchedKeys, ancestorKeys };
}

function kindOf(node: MilestoneTreeNode): MilestoneTreeNodeKind {
  return node.kind ?? 'objective';
}

function matchesField(key: string, selected: ReadonlySet<string>, node: MilestoneTreeNode, ancestors: MilestoneTreeNode[], today: number): boolean {
  const kind = kindOf(node);
  const task = node.taskSource;
  switch (key) {
    case 'search': {
      const title = node.title.toLowerCase();
      return [...selected].some((term) => title.includes(term.trim().toLowerCase()));
    }
    case 'module':
    case 'sprint':
      return selected.has(node.id) || ancestors.some((a) => selected.has(a.id));
    case 'owner':
      if (kind === 'objective') return !!node.ownerId && selected.has(node.ownerId);
      if (kind === 'task') return (task?.assigneeEmployeeIds ?? []).some((id) => selected.has(id));
      return false;
    case 'activeStatus':
      if (kind !== 'objective') return false;
      return (selected.has('active') && node.isActive && !node.isAchieved)
        || (selected.has('inactive') && !node.isActive)
        || (selected.has('achieved') && node.isAchieved);
    case 'dueDate':
      return [...selected].some((bucket) => inDueBucket(bucket, node, today));
    case 'duration':
      return kind !== 'task' && [...selected].some((bucket) => inDurationBucket(bucket, node));
    case 'itemType':
      return selected.has(kind);
    case 'taskStatus':
      return kind === 'task' && !!task && selected.has(task.statusId);
    case 'priority':
      return kind === 'task' && !!task && selected.has(task.priority);
    case 'category':
      return kind === 'task' && !!task && selected.has(task.categoryId);
    case 'progress':
      return [...selected].some((bucket) => inProgressBucket(bucket, node.progress));
    default:
      return true;
  }
}

function dueDay(node: MilestoneTreeNode): number | null {
  // Task nodes fall back to the parent's end date in endDate - use the task's own due date instead.
  if (kindOf(node) === 'task') return node.taskSource?.dueDate ? dayNumber(node.taskSource.dueDate) : null;
  return node.endDate ? dayNumber(node.endDate) : null;
}

function inDueBucket(bucket: string, node: MilestoneTreeNode, today: number): boolean {
  const due = dueDay(node);
  if (bucket === 'none') return due === null;
  if (due === null) return false;
  switch (bucket) {
    case 'overdue': return due < today && !node.isAchieved && node.progress < 100;
    case 'due7': return due >= today && due <= today + 7;
    case 'due30': return due >= today && due <= today + 30;
    default: return false;
  }
}

function inDurationBucket(bucket: string, node: MilestoneTreeNode): boolean {
  if (!node.startDate || !node.endDate) return false;
  const days = dayNumber(node.endDate) - dayNumber(node.startDate);
  switch (bucket) {
    case 'lt2w': return days < 14;
    case '2w1m': return days >= 14 && days <= 31;
    case '1m3m': return days > 31 && days <= 92;
    case 'gt3m': return days > 92;
    default: return false;
  }
}

function inProgressBucket(bucket: string, progress: number): boolean {
  switch (bucket) {
    case '0': return progress <= 0;
    case '1-50': return progress > 0 && progress <= 50;
    case '51-99': return progress > 50 && progress < 100;
    case '100': return progress >= 100;
    default: return false;
  }
}

/** Whole-day index in local calendar terms, so 'YYYY-MM-DD' strings and Date objects compare without TZ drift. */
function dayNumber(value: string | Date): number {
  if (typeof value === 'string') {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d) / DAY_MS;
  }
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_MS;
}
