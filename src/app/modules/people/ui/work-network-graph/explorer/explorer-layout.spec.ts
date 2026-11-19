import { EmployeeWorkGraphResponse } from '../../../models/work-graph.model';
import { buildExplorerLayout, placeCards, progressPercent, searchGraph, settleExplorerLayout, taskStatusDot, taskTone, tasksByParent } from './explorer-layout';

describe('explorer-layout', () => {
  const graph: EmployeeWorkGraphResponse = {
    nodes: [
      { id: 'employee:e1', kind: 'employee', label: 'Kiru Balachandran' },
      { id: 'project:p1', kind: 'project', label: 'Hardware', projectId: 'p1' },
      { id: 'project:p2', kind: 'project', label: 'Watercraft', projectId: 'p2' },
      { id: 'module:a', kind: 'module', label: 'Adapters', role: 'owner', projectId: 'p1', objectiveId: 'oa' },
      { id: 'module:b', kind: 'module', label: 'Pairing', role: 'member', projectId: 'p1', objectiveId: 'ob' },
      { id: 'module:c', kind: 'module', label: 'Hull', role: 'member', projectId: 'p2', objectiveId: 'oc' },
      { id: 'task:1', kind: 'task', label: 'Fix timeout', sublabel: 'ONX-1', status: 'active', projectId: 'p1', objectiveId: 'oa' },
      { id: 'task:2', kind: 'task', label: 'Docs', status: 'not_started', projectId: 'p1', objectiveId: 'ob' },
      { id: 'task:3', kind: 'task', label: 'Default work', status: 'active', projectId: 'p2', objectiveId: 'default' }
    ],
    links: [
      { source: 'employee:e1', target: 'project:p1', kind: 'works_on' },
      { source: 'employee:e1', target: 'project:p2', kind: 'works_on' },
      { source: 'project:p1', target: 'module:a', kind: 'contains' },
      { source: 'project:p1', target: 'module:b', kind: 'contains' },
      { source: 'project:p2', target: 'module:c', kind: 'contains' },
      { source: 'employee:e1', target: 'module:a', kind: 'owns' },
      { source: 'module:a', target: 'task:1', kind: 'has_task' },
      // task:2 has no has_task link: matched to module:b by objective.
      { source: 'project:p2', target: 'task:3', kind: 'has_task' }
    ],
    hiddenTaskCount: 0
  };

  it('lays out employee, projects and modules only, with P/M codes and project→module links', () => {
    const layout = buildExplorerLayout(graph);

    expect(layout.nodes.map((n) => n.id)).not.toContain('task:1');
    expect(layout.nodes.find((n) => n.id === 'employee:e1')!.code).toBe('KB');
    expect(layout.nodes.find((n) => n.id === 'project:p2')!.code).toBe('P2');
    expect(layout.nodes.find((n) => n.id === 'module:b')!.code).toBe('M2');
    expect(layout.nodes.find((n) => n.id === 'module:c')!.code).toBe('M1');
    // The owns link is not drawn; ownership shows in the module's fill.
    expect(layout.links.some((l) => l.source.id === 'employee:e1' && l.target.id === 'module:a')).toBe(false);
  });

  it('keeps every pair of nodes at least their collision distance apart once settled', () => {
    const layout = settleExplorerLayout(buildExplorerLayout(graph), 400);
    for (const a of layout.nodes) {
      for (const b of layout.nodes) {
        if (a === b) continue;
        const d = Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0));
        expect(d).toBeGreaterThan(Math.max(a.collide, b.collide));
      }
    }
  });

  it('groups tasks under their module, by link or objective, and project-level tasks under the project', () => {
    const map = tasksByParent(graph);
    expect(map.get('module:a')!.map((t) => t.id)).toEqual(['task:1']);
    expect(map.get('module:b')!.map((t) => t.id)).toEqual(['task:2']);
    expect(map.get('project:p2')!.map((t) => t.id)).toEqual(['task:3']);
  });

  it('places cards in a column on the side away from the employee', () => {
    const left = placeCards({ x: -200, y: 0, radius: 20 }, 3);
    expect(left.every((c) => c.x < -200 && c.side === -1)).toBe(true);
    expect(left.map((c) => c.y)).toEqual([-52, 0, 52]);
    expect(placeCards({ x: 200, y: 10, radius: 20 }, 1)[0]).toEqual(expect.objectContaining({ side: 1, y: 10 }));
  });

  it('uses Work Management hours for progress, task completion when no hours are planned', () => {
    const base = { totalTasks: 10, notStarted: 2, inProgress: 3, completed: 5, overdue: 0 };
    expect(progressPercent({ ...base, allocatedHours: 120, completedHours: 48 })).toBe(40);
    expect(progressPercent({ ...base, allocatedHours: 0, completedHours: 0 })).toBe(50);
    expect(progressPercent(null)).toBe(0);
  });

  it('tones tasks: overdue beats status', () => {
    expect(taskTone({ id: 't', kind: 'task', label: 'x', status: 'active', task: { dueDate: null, statusName: null, priority: null, isOverdue: true } })).toBe('overdue');
    expect(taskTone({ id: 't', kind: 'task', label: 'x', status: 'active' })).toBe('progress');
    expect(taskTone({ id: 't', kind: 'task', label: 'x', status: 'not_started' })).toBe('not-started');
  });

  it('searches names and codes, projects first', () => {
    expect(searchGraph(graph, 'onx-1').map((h) => h.node.id)).toEqual(['task:1']);
    expect(searchGraph(graph, 'a').map((h) => h.kindLabel)[0]).toBe('Project');
    expect(searchGraph(graph, '   ')).toEqual([]);
  });

  describe('rootId', () => {
    const projectGraph: EmployeeWorkGraphResponse = {
      nodes: [
        { id: 'module:root', kind: 'module', label: 'Portal', projectId: 'p1', objectiveId: 'root' },
        { id: 'module:kid', kind: 'module', label: 'Connectivity', projectId: 'p1', objectiveId: 'kid' }
      ],
      links: [{ source: 'module:root', target: 'module:kid', kind: 'contains' }],
      hiddenTaskCount: 0
    };

    it('pins the node named by rootId at the origin', () => {
      const layout = buildExplorerLayout(projectGraph, 'module:root');
      const root = layout.nodes.find((n) => n.id === 'module:root')!;
      expect(root.fx).toBe(0);
      expect(root.fy).toBe(0);
      expect(root.isRoot).toBe(true);
    });

    it('gives the root the centre radius and collision, and its links the long distance', () => {
      const layout = buildExplorerLayout(projectGraph, 'module:root');
      const root = layout.nodes.find((n) => n.id === 'module:root')!;
      const kid = layout.nodes.find((n) => n.id === 'module:kid')!;
      expect(root.radius).toBe(38);
      expect(root.collide).toBe(96);
      expect(kid.radius).toBe(21);
      expect(layout.links[0].kind).toBe('works_on');
    });

    it('is unchanged when rootId is omitted: the employee node is still the pinned centre', () => {
      const layout = buildExplorerLayout(graph);
      const employee = layout.nodes.find((n) => n.id === 'employee:e1')!;
      expect(employee.fx).toBe(0);
      expect(employee.fy).toBe(0);
      expect(employee.radius).toBe(38);
      expect(employee.isRoot).toBeUndefined();
      expect(layout.nodes.find((n) => n.id === 'module:a')!.radius).toBe(21);
      expect(layout.links.map((l) => l.kind)).toEqual(['works_on', 'works_on', 'contains', 'contains', 'contains']);
    });

    it('lays out a graph of one node and no links', () => {
      const layout = buildExplorerLayout(
        { nodes: [projectGraph.nodes[0]], links: [], hiddenTaskCount: 0 },
        'module:root'
      );
      expect(layout.nodes).toHaveLength(1);
      expect(layout.links).toHaveLength(0);
      expect(() => settleExplorerLayout(layout)).not.toThrow();
    });
  });

  describe('sprints and task status dots', () => {
    it('codes sprint nodes S1, S2 in graph order', () => {
      const layout = buildExplorerLayout({
        nodes: [
          { id: 'module:root', kind: 'module', label: 'Portal', projectId: 'p1', objectiveId: 'root' },
          { id: 'sprint:a', kind: 'sprint', label: 'Sprint A', status: 'active', projectId: 'p1' },
          { id: 'sprint:b', kind: 'sprint', label: 'Sprint B', status: 'draft', projectId: 'p1' }
        ],
        links: [
          { source: 'module:root', target: 'sprint:a', kind: 'contains' },
          { source: 'module:root', target: 'sprint:b', kind: 'contains' }
        ],
        hiddenTaskCount: 0
      }, 'module:root');

      expect(layout.nodes.find((n) => n.id === 'sprint:a')!.code).toBe('S1');
      expect(layout.nodes.find((n) => n.id === 'sprint:b')!.code).toBe('S2');
    });

    it('maps a task status to an empty, filled or done dot', () => {
      const task = (status: 'not_started' | 'active' | 'done') =>
        ({ id: 't', kind: 'task', label: 't', status } as const);
      expect(taskStatusDot(task('not_started'))).toBe('empty');
      expect(taskStatusDot(task('active'))).toBe('filled');
      expect(taskStatusDot(task('done'))).toBe('done');
    });
  });
});
