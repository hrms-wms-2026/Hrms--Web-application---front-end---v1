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
});
