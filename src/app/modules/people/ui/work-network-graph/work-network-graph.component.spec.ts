import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { WorkNetworkCanvasComponent } from './work-network-canvas.component';
import { WorkNetworkGraphComponent } from './work-network-graph.component';

describe('WorkNetworkGraphComponent', () => {
  const graph: EmployeeWorkGraphResponse = {
    nodes: [
      { id: 'employee:e1', kind: 'employee', label: 'Saif Ahamed', sublabel: 'Watercraft Engineer' },
      { id: 'project:p1', kind: 'project', label: 'Website', projectId: 'p1' },
      { id: 'project:p2', kind: 'project', label: 'Mobile app', projectId: 'p2' },
      { id: 'module:m1', kind: 'module', label: 'Checkout', role: 'owner', projectId: 'p1', objectiveId: 'm1' },
      { id: 'task:t1', kind: 'task', label: 'Fix cart', sublabel: 'WEB-1', status: 'active', projectId: 'p1', objectiveId: 'm1', taskId: 't1' }
    ],
    links: [
      { source: 'employee:e1', target: 'project:p1', kind: 'works_on' },
      { source: 'employee:e1', target: 'project:p2', kind: 'works_on' },
      { source: 'project:p1', target: 'module:m1', kind: 'contains' },
      { source: 'employee:e1', target: 'module:m1', kind: 'owns' },
      { source: 'module:m1', target: 'task:t1', kind: 'has_task' }
    ],
    hiddenTaskCount: 0
  };

  function setup(g: EmployeeWorkGraphResponse = graph) {
    TestBed.configureTestingModule({ imports: [WorkNetworkGraphComponent] });
    const fixture = TestBed.createComponent(WorkNetworkGraphComponent);
    fixture.componentRef.setInput('graph', g);
    const selected: WorkGraphNode[] = [];
    fixture.componentInstance.nodeSelected.subscribe((n) => selected.push(n));
    fixture.detectChanges();
    return { fixture, selected, el: fixture.nativeElement as HTMLElement };
  }

  const node = (el: HTMLElement, id: string) => el.querySelector(`[data-node-id="${id}"]`) as SVGGElement;

  it('renders one static preview node per graph node when the graph is already small', () => {
    const { el } = setup();

    expect(el.querySelectorAll('.wg-node')).toHaveLength(5);
    expect(el.querySelectorAll('line.wg-link')).toHaveLength(5);
    expect(el.querySelector('[role="dialog"]')).toBeFalsy();
    expect(el.querySelector('.wgc-svg--animated')).toBeFalsy();
  });

  it('shows the employee name and current position at the centre', () => {
    const { el } = setup();
    const centre = node(el, 'employee:e1');

    expect(centre.textContent).toContain('Saif Ahamed');
    expect(centre.textContent).toContain('Watercraft Engineer');
  });

  it('applies the role/status style class to modules and tasks', () => {
    const { el } = setup();

    expect(node(el, 'module:m1').classList.contains('wg-node--module-owner')).toBe(true);
    expect(node(el, 'task:t1').classList.contains('wg-node--task-active')).toBe(true);
  });

  it('opens the full animated graph and emits nodeSelected from it', () => {
    const { fixture, el, selected } = setup();

    (el.querySelector('[data-testid="work-network-preview"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const dialog = el.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.querySelector('.wgc-svg--animated')).toBeTruthy();

    node(dialog, 'project:p1').dispatchEvent(new Event('click'));

    expect(selected.map((n) => n.id)).toEqual(['project:p1']);
  });

  it('does not emit when the employee node in the full graph is clicked', () => {
    const { fixture, el, selected } = setup();

    (el.querySelector('[data-testid="work-network-preview"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const dialog = el.querySelector('[role="dialog"]') as HTMLElement;

    node(dialog, 'employee:e1').dispatchEvent(new Event('click'));

    expect(selected).toEqual([]);
  });

  it('dims nodes that are not neighbours of the hovered node', () => {
    const { fixture, el } = setup();

    node(el, 'task:t1').dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();

    // task:t1's only neighbour is module:m1; project:p2 is unrelated.
    expect(node(el, 'project:p2').classList.contains('wg-node--dim')).toBe(true);
    expect(node(el, 'module:m1').classList.contains('wg-node--dim')).toBe(false);
    expect(node(el, 'task:t1').classList.contains('wg-node--dim')).toBe(false);

    node(el, 'task:t1').dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(node(el, 'project:p2').classList.contains('wg-node--dim')).toBe(false);
  });

  it('tells the user in the full graph when more tasks exist than are drawn', () => {
    const { fixture, el } = setup({ ...graph, hiddenTaskCount: 7 });

    (el.querySelector('[data-testid="work-network-preview"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('[role="dialog"]')?.textContent).toContain('+7 more tasks are not included');
  });

  it('does not show the hidden-tasks note when nothing is hidden', () => {
    const { el } = setup();

    expect(el.textContent).not.toContain('more task');
  });

  it('limits a large preview but renders every node in the full graph', () => {
    const extraNodes: WorkGraphNode[] = Array.from({ length: 8 }, (_, index) => ({
      id: `task:extra-${index}`,
      kind: 'task',
      label: `Extra task ${index}`,
      projectId: 'p1',
      objectiveId: 'm1',
      taskId: `extra-${index}`
    }));
    const largeGraph: EmployeeWorkGraphResponse = {
      ...graph,
      nodes: [...graph.nodes, ...extraNodes],
      links: [
        ...graph.links,
        ...extraNodes.map((item) => ({ source: 'module:m1', target: item.id, kind: 'has_task' as const }))
      ]
    };
    const { fixture, el } = setup(largeGraph);

    expect(el.querySelectorAll('[data-testid="work-network-preview"] .wg-node')).toHaveLength(8);
    expect(el.textContent).toContain('8 of 13 nodes shown');

    (el.querySelector('[data-testid="work-network-preview"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('[role="dialog"] .wg-node')).toHaveLength(13);
  });

  it('closes the full graph with its close button', () => {
    const { fixture, el } = setup();
    (el.querySelector('[data-testid="work-network-preview"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    (el.querySelector('[aria-label="Close full work network"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('zooms and resets the full graph with the toolbar controls', () => {
    const { fixture, el } = setup();
    (el.querySelector('[data-testid="work-network-preview"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const canvases = fixture.debugElement.queryAll(By.directive(WorkNetworkCanvasComponent));
    const fullCanvas = canvases[1].componentInstance as WorkNetworkCanvasComponent;

    expect(fullCanvas.camera().scale).toBe(1);
    (el.querySelector('[aria-label="Zoom in"]') as HTMLButtonElement).click();
    expect(fullCanvas.camera().scale).toBeGreaterThan(1);
    (el.querySelector('[aria-label="Reset graph view"]') as HTMLButtonElement).click();
    expect(fullCanvas.camera()).toEqual({ x: 0, y: 0, scale: 1 });
  });
});
