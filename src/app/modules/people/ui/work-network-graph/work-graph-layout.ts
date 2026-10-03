import { Simulation, SimulationNodeDatum, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import { EmployeeWorkGraphResponse, WorkGraphLinkKind, WorkGraphNode } from '../../models/work-graph.model';

export interface GraphNode extends SimulationNodeDatum {
  readonly id: string;
  readonly data: WorkGraphNode;
  readonly radius: number;
}

export interface GraphLink {
  readonly source: GraphNode;
  readonly target: GraphNode;
  readonly kind: WorkGraphLinkKind;
}

export interface GraphLayout {
  readonly nodes: readonly GraphNode[];
  readonly links: readonly GraphLink[];
}

export function nodeRadius(node: WorkGraphNode): number {
  switch (node.kind) {
    case 'employee':
      return 34;
    case 'project':
      return 24;
    case 'module':
      return 16;
    default:
      return 8;
  }
}

export function nodeClass(node: WorkGraphNode): string {
  switch (node.kind) {
    case 'employee':
      return 'wg-node--employee';
    case 'project':
      return 'wg-node--project';
    case 'module':
      return `wg-node--module-${node.role ?? 'contributor'}`;
    default:
      return node.status === 'active' ? 'wg-node--task-active' : 'wg-node--task-not-started';
  }
}

function linkDistance(kind: WorkGraphLinkKind): number {
  switch (kind) {
    case 'works_on':
      return 150;
    case 'owns':
    case 'member_of':
      return 130;
    case 'contains':
      return 90;
    default:
      return 55;
  }
}

export function createWorkGraphSimulation(layout: GraphLayout): Simulation<GraphNode, GraphLink> {
  return forceSimulation<GraphNode>(layout.nodes as GraphNode[])
    .force(
      'link',
      forceLink<GraphNode, GraphLink>(layout.links as GraphLink[])
        .id((node) => node.id)
        .distance((link) => linkDistance(link.kind))
        .strength(0.9)
    )
    .force('charge', forceManyBody<GraphNode>().strength(-260))
    .force('collide', forceCollide<GraphNode>().radius((node) => node.radius + 8))
    .force('x', forceX<GraphNode>(0).strength(0.03))
    .force('y', forceY<GraphNode>(0).strength(0.03));
}

/**
 * Settles a force-directed layout synchronously (no animation loop), so rendering is
 * deterministic-enough for tests and needs no running simulation afterwards. The employee node
 * is pinned at the origin so everything radiates from him.
 */
export function layoutWorkGraph(graph: EmployeeWorkGraphResponse, ticks = 300): GraphLayout {
  const nodes: GraphNode[] = graph.nodes.map((data) => ({
    id: data.id,
    data,
    radius: nodeRadius(data),
    ...(data.kind === 'employee' ? { x: 0, y: 0, fx: 0, fy: 0 } : {})
  }));
  const byId = new Map(nodes.map((n) => [n.id, n] as const));

  const links: GraphLink[] = graph.links.flatMap((l) => {
    const source = byId.get(l.source);
    const target = byId.get(l.target);
    return source && target ? [{ source, target, kind: l.kind }] : [];
  });

  createWorkGraphSimulation({ nodes, links }).stop().tick(ticks);

  return { nodes, links };
}

export type WorkGraphModuleScope = 'all' | 'owner';

export interface WorkGraphFilterOptions {
  readonly moduleScope: WorkGraphModuleScope;
  readonly showTasks: boolean;
}

export function filterWorkGraph(
  graph: EmployeeWorkGraphResponse,
  options: WorkGraphFilterOptions
): EmployeeWorkGraphResponse {
  const { moduleScope, showTasks } = options;

  const keptNodes: WorkGraphNode[] = [];
  const keptModuleIds = new Set<string>();

  for (const node of graph.nodes) {
    if (node.kind === 'employee' || node.kind === 'project') {
      keptNodes.push(node);
    } else if (node.kind === 'module') {
      if (moduleScope === 'all' || node.role === 'owner') {
        keptNodes.push(node);
        keptModuleIds.add(node.id);
      }
    }
  }

  if (showTasks) {
    for (const node of graph.nodes) {
      if (node.kind === 'task') {
        const isLinkedToKeptModule = graph.links.some(
          (l) => l.kind === 'has_task' && ((l.target === node.id && keptModuleIds.has(l.source)) || (l.source === node.id && keptModuleIds.has(l.target)))
        );
        const matchesObjective =
          node.objectiveId != null &&
          graph.nodes.some((m) => m.kind === 'module' && keptModuleIds.has(m.id) && m.objectiveId === node.objectiveId);

        if (isLinkedToKeptModule || matchesObjective) {
          keptNodes.push(node);
        }
      }
    }
  }

  const keptIds = new Set(keptNodes.map((n) => n.id));

  const keptLinks = graph.links.filter(
    (l) => keptIds.has(l.source) && keptIds.has(l.target)
  );

  return {
    nodes: keptNodes,
    links: keptLinks,
    hiddenTaskCount: graph.hiddenTaskCount
  };
}
