import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EmployeeWorkGraphResponse } from '../../../models/work-graph.model';
import { EmployeeDirectoryStore } from '../../../../work/state/employee-directory.store';
import { WorkNetworkExplorerCanvasComponent } from './work-network-explorer-canvas.component';

describe('WorkNetworkExplorerCanvasComponent', () => {
  const stats = (allocatedHours: number, completedHours: number) => ({
    totalTasks: 4, notStarted: 1, inProgress: 1, completed: 2, overdue: 0, allocatedHours, completedHours
  });

  /** A project-rooted graph: module root, two module children, no employee and no project node. */
  const projectGraph: EmployeeWorkGraphResponse = {
    nodes: [
      { id: 'module:root', kind: 'module', label: 'Portal', projectId: 'p1', objectiveId: 'root', stats: stats(2600, 390) },
      { id: 'module:a', kind: 'module', label: 'Connectivity', projectId: 'p1', objectiveId: 'a', stats: stats(100, 100) },
      { id: 'module:b', kind: 'module', label: 'Marketing', projectId: 'p1', objectiveId: 'b', stats: stats(0, 0) },
      {
        id: 'module:c', kind: 'module', label: 'Not started', projectId: 'p1', objectiveId: 'c',
        stats: { totalTasks: 0, notStarted: 0, inProgress: 0, completed: 0, overdue: 0, allocatedHours: 0, completedHours: 0 }
      }
    ],
    links: [
      { source: 'module:root', target: 'module:a', kind: 'contains' },
      { source: 'module:root', target: 'module:b', kind: 'contains' },
      { source: 'module:root', target: 'module:c', kind: 'contains' }
    ],
    hiddenTaskCount: 0
  };

  const employeeGraph: EmployeeWorkGraphResponse = {
    nodes: [
      { id: 'employee:e1', kind: 'employee', label: 'Kiru Balachandran' },
      { id: 'module:m1', kind: 'module', label: 'Adapters', role: 'owner', projectId: 'p1', objectiveId: 'o1', stats: stats(100, 40) }
    ],
    links: [{ source: 'employee:e1', target: 'module:m1', kind: 'contains' }],
    hiddenTaskCount: 0
  };

  const directory = {
    get: vi.fn(() => undefined),
    ensureLoaded: vi.fn().mockResolvedValue(undefined),
    seed: vi.fn()
  };

  let lastFixture: { detectChanges(): void };

  function setup(graph: EmployeeWorkGraphResponse, inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      imports: [WorkNetworkExplorerCanvasComponent],
      providers: [provideHttpClient(), { provide: EmployeeDirectoryStore, useValue: directory }]
    });
    const fixture = TestBed.createComponent(WorkNetworkExplorerCanvasComponent);
    fixture.componentRef.setInput('graph', graph);
    fixture.componentRef.setInput('animated', false);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    lastFixture = fixture;
    return fixture.nativeElement as HTMLElement;
  }

  const node = (el: HTMLElement, id: string) => el.querySelector(`[data-node-id="${id}"]`) as SVGGElement;
  const ring = (el: HTMLElement, id: string) => node(el, id).querySelector('.wgx-ring-fill') as SVGCircleElement | null;

  it('draws no ring and no alert fill when the new inputs are left at their defaults', () => {
    const el = setup(employeeGraph);

    expect(el.querySelectorAll('.wgx-ring-fill')).toHaveLength(0);
    expect(el.querySelectorAll('.wgx-node--alert')).toHaveLength(0);
    expect(node(el, 'module:m1').getAttribute('class')).toContain('wgx-node--module-owner');
  });

  it('draws a progress ring whose arc is completedHours / allocatedHours of the circumference', () => {
    const el = setup(projectGraph, { rootId: 'module:root', showProgressRing: true });

    const arc = ring(el, 'module:a')!;
    const r = Number(arc.getAttribute('r'));
    const circumference = 2 * Math.PI * r;
    const [drawn] = arc.getAttribute('stroke-dasharray')!.split(' ').map(Number);
    // module:a is 100/100 completed, so the arc covers the whole circle.
    expect(drawn).toBeCloseTo(circumference, 1);
  });

  it('draws an empty ring, with no NaN in stroke-dasharray, when there are no allocated hours and no tasks', () => {
    const el = setup(projectGraph, { rootId: 'module:root', showProgressRing: true });

    const dash = ring(el, 'module:c')!.getAttribute('stroke-dasharray')!;
    expect(dash).not.toContain('NaN');
    expect(Number(dash.split(' ')[0])).toBe(0);
  });

  it('falls back to completed tasks, without NaN, when allocatedHours is 0 but the module has tasks', () => {
    const el = setup(projectGraph, { rootId: 'module:root', showProgressRing: true });

    // module:b is 0 allocated hours with 2 of 4 tasks done: progressPercent falls back to 50%.
    const arc = ring(el, 'module:b')!;
    const circumference = 2 * Math.PI * Number(arc.getAttribute('r'));
    const dash = arc.getAttribute('stroke-dasharray')!;
    expect(dash).not.toContain('NaN');
    expect(Number(dash.split(' ')[0])).toBeCloseTo(circumference / 2, 1);
  });

  it('adds the alert class to the core circle of every id in alertNodeIds', () => {
    const el = setup(projectGraph, { rootId: 'module:root', alertNodeIds: new Set(['module:b']) });

    expect(node(el, 'module:b').getAttribute('class')).toContain('wgx-node--alert');
    expect(node(el, 'module:a').getAttribute('class')).not.toContain('wgx-node--alert');
  });

  it('uses the neutral module fill when neutralModuleFill is true and role is null', () => {
    const el = setup(projectGraph, { rootId: 'module:root', neutralModuleFill: true });

    expect(node(el, 'module:a').getAttribute('class')).toContain('wgx-node--module-neutral');
    expect(node(el, 'module:a').getAttribute('class')).not.toContain('wgx-node--module-contributor');
  });

  describe('sprints and task status dots', () => {
    const sprintGraph: EmployeeWorkGraphResponse = {
      nodes: [
        { id: 'module:root', kind: 'module', label: 'Portal', projectId: 'p1', objectiveId: 'root', stats: stats(10, 5) },
        { id: 'sprint:active', kind: 'sprint', label: 'Sprint 7', status: 'active', projectId: 'p1' },
        { id: 'sprint:draft', kind: 'sprint', label: 'Sprint 8', status: 'draft', projectId: 'p1' },
        { id: 'sprint:complete', kind: 'sprint', label: 'Sprint 6', status: 'complete', projectId: 'p1' },
        { id: 'sprint:achieved', kind: 'sprint', label: 'Sprint 5', status: 'achieved', projectId: 'p1' },
        { id: 'task:todo', kind: 'task', label: 'Todo', status: 'not_started', projectId: 'p1', objectiveId: 'root', taskId: 'todo' },
        { id: 'task:doing', kind: 'task', label: 'Doing', status: 'active', projectId: 'p1', objectiveId: 'root', taskId: 'doing' },
        { id: 'task:shipped', kind: 'task', label: 'Shipped', status: 'done', projectId: 'p1', objectiveId: 'root', taskId: 'shipped' }
      ],
      links: [
        { source: 'module:root', target: 'sprint:active', kind: 'contains' },
        { source: 'module:root', target: 'sprint:draft', kind: 'contains' },
        { source: 'module:root', target: 'sprint:complete', kind: 'contains' },
        { source: 'module:root', target: 'sprint:achieved', kind: 'contains' },
        { source: 'sprint:active', target: 'task:todo', kind: 'has_task' },
        { source: 'sprint:active', target: 'task:doing', kind: 'has_task' },
        { source: 'sprint:active', target: 'task:shipped', kind: 'has_task' }
      ],
      hiddenTaskCount: 0
    };
    const cls = (el: HTMLElement, id: string) => node(el, id).getAttribute('class') ?? '';
    const dot = (el: HTMLElement, taskId: string) =>
      el.querySelector(`[data-task-id="task:${taskId}"] .wgx-card__dot`)!.getAttribute('class') ?? '';

    it('classes each sprint by status: active, draft, and complete or achieved as done', () => {
      const el = setup(sprintGraph, { rootId: 'module:root' });

      expect(cls(el, 'sprint:active')).toContain('wgx-node--sprint-active');
      expect(cls(el, 'sprint:draft')).toContain('wgx-node--sprint-draft');
      expect(cls(el, 'sprint:complete')).toContain('wgx-node--sprint-done');
      expect(cls(el, 'sprint:achieved')).toContain('wgx-node--sprint-done');
    });

    it('reveals a sprint task cards when the sprint is hovered', () => {
      const el = setup(sprintGraph, { rootId: 'module:root' });
      node(el, 'sprint:active').dispatchEvent(new Event('pointerenter'));
      lastFixture.detectChanges();

      const ids = Array.from(el.querySelectorAll('[data-task-id]')).map((c) => c.getAttribute('data-task-id'));
      expect(ids.sort()).toEqual(['task:doing', 'task:shipped', 'task:todo']);
    });

    it('draws empty, filled and done status dots when taskDotStyle is status', () => {
      const el = setup(sprintGraph, { rootId: 'module:root', taskDotStyle: 'status' });
      node(el, 'sprint:active').dispatchEvent(new Event('pointerenter'));
      lastFixture.detectChanges();

      expect(dot(el, 'todo')).toContain('wgx-dot--empty');
      expect(dot(el, 'doing')).toContain('wgx-dot--filled');
      expect(dot(el, 'shipped')).toContain('wgx-dot--done');
    });

    it('keeps the tone dots when taskDotStyle is left at its default', () => {
      const el = setup(sprintGraph, { rootId: 'module:root' });
      node(el, 'sprint:active').dispatchEvent(new Event('pointerenter'));
      lastFixture.detectChanges();

      expect(dot(el, 'doing')).toContain('wgx-tone--progress');
      expect(dot(el, 'doing')).not.toContain('wgx-dot--');
    });
  });
});
