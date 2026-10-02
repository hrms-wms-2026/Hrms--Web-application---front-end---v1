import { Simulation, SimulationNodeDatum, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import { EmployeeWorkGraphResponse, WorkGraphNode, WorkGraphStats } from '../../../models/work-graph.model';

/** Task cards drawn beside a revealed module/project. */
export const CARD_WIDTH = 176;
export const CARD_HEIGHT = 42;
const CARD_GAP = 10;
/** Cards shown per parent before a "+N more" card. */
export const MAX_CARDS = 8;

export type TaskTone = 'progress' | 'not-started' | 'overdue';

export interface ExplorerNode extends SimulationNodeDatum {
  readonly id: string;
  readonly data: WorkGraphNode;
  readonly radius: number;
  /** Collision radius: the circle plus room for the label block underneath. */
  readonly collide: number;
  /** Short code shown inside the circle: P1, M3, or the employee's initials. */
  readonly code: string;
  /** True for invisible spacer nodes that push neighbours away from expanded task cards. */
  readonly spacer?: boolean;
}

export interface ExplorerLink {
  readonly source: ExplorerNode;
  readonly target: ExplorerNode;
  readonly kind: 'works_on' | 'contains';
}

export interface ExplorerLayout {
  readonly nodes: ExplorerNode[];
  readonly links: ExplorerLink[];
}

export interface CardPlacement {
  readonly x: number;
  readonly y: number;
  /** Which side of the parent the column sits on (connectors attach to the near edge). */
  readonly side: 1 | -1;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase() || 'EM';
}

function radiusOf(node: WorkGraphNode): number {
  return node.kind === 'employee' ? 38 : node.kind === 'project' ? 30 : 21;
}

function collideOf(node: WorkGraphNode): number {
  return node.kind === 'employee' ? 96 : node.kind === 'project' ? 84 : 62;
}

/**
 * Employee, projects and modules only - tasks are never part of the force layout, they are drawn as
 * cards next to whichever module is revealed. Modules hang off their project (owner/member is shown
 * by the module's fill, not by an extra line to the employee), which keeps the picture readable.
 */
export function buildExplorerLayout(graph: EmployeeWorkGraphResponse): ExplorerLayout {
  const projectCodes = new Map<string, string>();
  const moduleCounters = new Map<string, number>();
  const nodes: ExplorerNode[] = [];

  for (const data of graph.nodes) {
    if (data.kind === 'task') continue;
    let code: string;
    if (data.kind === 'employee') code = initialsOf(data.label);
    else if (data.kind === 'project') {
      code = `P${projectCodes.size + 1}`;
      projectCodes.set(data.id, code);
    } else {
      const key = data.projectId ?? '';
      const next = (moduleCounters.get(key) ?? 0) + 1;
      moduleCounters.set(key, next);
      code = `M${next}`;
    }
    nodes.push({
      id: data.id,
      data,
      radius: radiusOf(data),
      collide: collideOf(data),
      code,
      ...(data.kind === 'employee' ? { x: 0, y: 0, fx: 0, fy: 0 } : {})
    });
  }

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const links: ExplorerLink[] = [];
  for (const link of graph.links) {
    if (link.kind !== 'works_on' && link.kind !== 'contains') continue;
    const source = byId.get(link.source);
    const target = byId.get(link.target);
    if (source && target) links.push({ source, target, kind: link.kind });
  }
  // A module whose project is not in the graph still needs an anchor: tie it to the employee.
  const employee = nodes.find((n) => n.data.kind === 'employee');
  for (const node of nodes) {
    if (node.data.kind !== 'module' || !employee) continue;
    if (!links.some((l) => l.target === node)) links.push({ source: employee, target: node, kind: 'works_on' });
  }
  return { nodes, links };
}

export function createExplorerSimulation(layout: ExplorerLayout): Simulation<ExplorerNode, ExplorerLink> {
  return forceSimulation<ExplorerNode>(layout.nodes)
    .force(
      'link',
      forceLink<ExplorerNode, ExplorerLink>(layout.links)
        .id((n) => n.id)
        .distance((l) => (l.kind === 'works_on' ? 230 : 135))
        .strength(0.8)
    )
    .force('charge', forceManyBody<ExplorerNode>().strength((n) => (n.spacer ? 0 : -420)))
    .force('collide', forceCollide<ExplorerNode>().radius((n) => n.collide).strength(1).iterations(2))
    .force('x', forceX<ExplorerNode>(0).strength(0.035))
    .force('y', forceY<ExplorerNode>(0).strength(0.035));
}

/** Settles a layout synchronously (tests, reduced motion). */
export function settleExplorerLayout(layout: ExplorerLayout, ticks = 300): ExplorerLayout {
  createExplorerSimulation(layout).stop().tick(ticks);
  return layout;
}

/**
 * Open tasks grouped by the node they hang off (a module, or the project for tasks in its default
 * objective). Falls back to matching a module by objective when there is no has_task link.
 */
export function tasksByParent(graph: EmployeeWorkGraphResponse): ReadonlyMap<string, readonly WorkGraphNode[]> {
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n] as const));
  const modules = graph.nodes.filter((n) => n.kind === 'module');
  const map = new Map<string, WorkGraphNode[]>();
  const add = (parent: string, task: WorkGraphNode) => {
    const list = map.get(parent) ?? [];
    list.push(task);
    map.set(parent, list);
  };
  const placed = new Set<string>();
  for (const link of graph.links) {
    if (link.kind !== 'has_task') continue;
    const task = nodesById.get(link.target);
    if (task?.kind === 'task' && nodesById.has(link.source)) {
      add(link.source, task);
      placed.add(task.id);
    }
  }
  for (const node of graph.nodes) {
    if (node.kind !== 'task' || placed.has(node.id) || node.objectiveId == null) continue;
    const owner = modules.find((m) => m.objectiveId === node.objectiveId);
    if (owner) add(owner.id, node);
  }
  return map;
}

/**
 * A column of task cards on the outer side of the parent (away from the employee at the origin),
 * centred on the parent vertically.
 */
export function placeCards(parent: { x: number; y: number; radius: number }, count: number): CardPlacement[] {
  const side: 1 | -1 = parent.x < 0 ? -1 : 1;
  const x = parent.x + side * (parent.radius + 70 + CARD_WIDTH / 2);
  const step = CARD_HEIGHT + CARD_GAP;
  const top = parent.y - ((count - 1) * step) / 2;
  return Array.from({ length: count }, (_, i) => ({ x, y: top + i * step, side }));
}

/** Work Management's progress: completed / allocated hours; task completion when no hours are planned. */
export function progressPercent(stats: WorkGraphStats | null | undefined): number {
  if (!stats) return 0;
  if (stats.allocatedHours > 0) return Math.min(100, Math.round((stats.completedHours / stats.allocatedHours) * 100));
  return stats.totalTasks > 0 ? Math.round((stats.completed / stats.totalTasks) * 100) : 0;
}

export function taskTone(task: WorkGraphNode): TaskTone {
  if (task.task?.isOverdue) return 'overdue';
  return task.status === 'active' ? 'progress' : 'not-started';
}

export const TASK_TONE_LABELS: Record<TaskTone, string> = {
  progress: 'In progress',
  'not-started': 'Not started',
  overdue: 'Overdue'
};

export interface SearchHit {
  readonly node: WorkGraphNode;
  readonly kindLabel: string;
}

/** Projects, modules and tasks whose name or code contains the query (case-insensitive). */
export function searchGraph(graph: EmployeeWorkGraphResponse, query: string, limit = 8): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const order = { project: 0, module: 1, task: 2, employee: 3 } as const;
  return graph.nodes
    .filter((n) => n.kind !== 'employee')
    .filter((n) => n.label.toLowerCase().includes(q) || (n.sublabel ?? '').toLowerCase().includes(q))
    .sort((a, b) => order[a.kind] - order[b.kind] || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((node) => ({ node, kindLabel: node.kind === 'project' ? 'Project' : node.kind === 'module' ? 'Module' : 'Task' }));
}

export function shorten(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}
