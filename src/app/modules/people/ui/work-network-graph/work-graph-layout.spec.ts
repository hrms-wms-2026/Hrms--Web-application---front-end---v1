import { describe, it, expect } from 'vitest';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { filterWorkGraph, layoutWorkGraph, nodeClass, nodeRadius } from './work-graph-layout';

describe('work-graph-layout', () => {
  const graph: EmployeeWorkGraphResponse = {
    nodes: [
      { id: 'employee:e1', kind: 'employee', label: 'Saif Ahamed', sublabel: 'Watercraft Engineer' },
      { id: 'project:p1', kind: 'project', label: 'Website', projectId: 'p1' },
      { id: 'module:m1', kind: 'module', label: 'Checkout', role: 'owner', projectId: 'p1', objectiveId: 'm1' },
      { id: 'task:t1', kind: 'task', label: 'Fix cart', sublabel: 'WEB-1', status: 'active', projectId: 'p1', objectiveId: 'm1', taskId: 't1' }
    ],
    links: [
      { source: 'employee:e1', target: 'project:p1', kind: 'works_on' },
      { source: 'project:p1', target: 'module:m1', kind: 'contains' },
      { source: 'employee:e1', target: 'module:m1', kind: 'owns' },
      { source: 'module:m1', target: 'task:t1', kind: 'has_task' },
      { source: 'module:m1', target: 'task:missing', kind: 'has_task' }
    ],
    hiddenTaskCount: 0
  };

  it('pins the employee at the origin', () => {
    const layout = layoutWorkGraph(graph);
    const me = layout.nodes.find((n) => n.id === 'employee:e1')!;

    expect(me.x).toBe(0);
    expect(me.y).toBe(0);
    expect(me.fx).toBe(0);
    expect(me.fy).toBe(0);
  });

  it('assigns finite coordinates to every node', () => {
    const layout = layoutWorkGraph(graph);

    expect(layout.nodes).toHaveLength(4);
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it('resolves links to node objects and drops links with a missing endpoint', () => {
    const layout = layoutWorkGraph(graph);

    expect(layout.links).toHaveLength(4);
    for (const link of layout.links) {
      expect(layout.nodes).toContain(link.source);
      expect(layout.nodes).toContain(link.target);
    }
  });

  it('sizes nodes employee > project > module > task', () => {
    const r = (kind: WorkGraphNode['kind']) => nodeRadius({ id: 'x', kind, label: 'x' });

    expect(r('employee')).toBeGreaterThan(r('project'));
    expect(r('project')).toBeGreaterThan(r('module'));
    expect(r('module')).toBeGreaterThan(r('task'));
  });

  it('maps nodes to their style class', () => {
    const cls = (n: Partial<WorkGraphNode> & Pick<WorkGraphNode, 'kind'>) => nodeClass({ id: 'x', label: 'x', ...n });

    expect(cls({ kind: 'employee' })).toBe('wg-node--employee');
    expect(cls({ kind: 'project' })).toBe('wg-node--project');
    expect(cls({ kind: 'module', role: 'owner' })).toBe('wg-node--module-owner');
    expect(cls({ kind: 'module', role: 'member' })).toBe('wg-node--module-member');
    expect(cls({ kind: 'module', role: 'contributor' })).toBe('wg-node--module-contributor');
    expect(cls({ kind: 'task', status: 'active' })).toBe('wg-node--task-active');
    expect(cls({ kind: 'task', status: 'not_started' })).toBe('wg-node--task-not-started');
  });

  describe('filterWorkGraph', () => {
    const fullGraph: EmployeeWorkGraphResponse = {
      nodes: [
        { id: 'employee:e1', kind: 'employee', label: 'Saif' },
        { id: 'project:p1', kind: 'project', label: 'P1' },
        { id: 'module:m1', kind: 'module', label: 'M1', role: 'owner' },
        { id: 'module:m2', kind: 'module', label: 'M2', role: 'member' },
        { id: 'task:t1', kind: 'task', label: 'T1', objectiveId: 'm1' },
        { id: 'task:t2', kind: 'task', label: 'T2', objectiveId: 'm2' }
      ],
      links: [
        { source: 'employee:e1', target: 'project:p1', kind: 'works_on' },
        { source: 'project:p1', target: 'module:m1', kind: 'contains' },
        { source: 'project:p1', target: 'module:m2', kind: 'contains' },
        { source: 'module:m1', target: 'task:t1', kind: 'has_task' },
        { source: 'module:m2', target: 'task:t2', kind: 'has_task' }
      ],
      hiddenTaskCount: 2
    };

    it('filters up to modules (no tasks) when showTasks is false', () => {
      const res = filterWorkGraph(fullGraph, { moduleScope: 'all', showTasks: false });

      expect(res.nodes.map((n) => n.id)).toEqual(['employee:e1', 'project:p1', 'module:m1', 'module:m2']);
      expect(res.links.map((l) => `${l.source}->${l.target}`)).toEqual([
        'employee:e1->project:p1',
        'project:p1->module:m1',
        'project:p1->module:m2'
      ]);
    });

    it('filters to owner modules only (no tasks) when moduleScope is owner and showTasks is false', () => {
      const res = filterWorkGraph(fullGraph, { moduleScope: 'owner', showTasks: false });

      expect(res.nodes.map((n) => n.id)).toEqual(['employee:e1', 'project:p1', 'module:m1']);
      expect(res.links.map((l) => `${l.source}->${l.target}`)).toEqual([
        'employee:e1->project:p1',
        'project:p1->module:m1'
      ]);
    });

    it('includes tasks when showTasks is true and moduleScope is all', () => {
      const res = filterWorkGraph(fullGraph, { moduleScope: 'all', showTasks: true });

      expect(res.nodes.map((n) => n.id)).toEqual([
        'employee:e1',
        'project:p1',
        'module:m1',
        'module:m2',
        'task:t1',
        'task:t2'
      ]);
      expect(res.links).toHaveLength(5);
    });

    it('includes only owner module tasks when moduleScope is owner and showTasks is true', () => {
      const res = filterWorkGraph(fullGraph, { moduleScope: 'owner', showTasks: true });

      expect(res.nodes.map((n) => n.id)).toEqual([
        'employee:e1',
        'project:p1',
        'module:m1',
        'task:t1'
      ]);
      expect(res.links.map((l) => `${l.source}->${l.target}`)).toEqual([
        'employee:e1->project:p1',
        'project:p1->module:m1',
        'module:m1->task:t1'
      ]);
    });
  });
});
