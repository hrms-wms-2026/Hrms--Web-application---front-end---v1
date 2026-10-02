import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
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
    TestBed.configureTestingModule({ imports: [WorkNetworkGraphComponent], providers: [provideHttpClient()] });
    const fixture = TestBed.createComponent(WorkNetworkGraphComponent);
    fixture.componentRef.setInput('graph', g);
    const selected: WorkGraphNode[] = [];
    fixture.componentInstance.nodeSelected.subscribe((n) => selected.push(n));
    fixture.detectChanges();
    return { fixture, selected, el: fixture.nativeElement as HTMLElement };
  }

  const node = (el: HTMLElement, id: string) => el.querySelector(`[data-node-id="${id}"]`) as SVGGElement;
  const open = (fixture: ReturnType<typeof setup>['fixture'], el: HTMLElement) => {
    (el.querySelector('[data-testid="work-network-preview"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    return el.querySelector('[role="dialog"]') as HTMLElement;
  };

  it('renders a static preview of projects and modules only (no tasks)', () => {
    const { el } = setup();

    expect(el.querySelectorAll('.wg-node')).toHaveLength(4);
    expect(el.querySelectorAll('line.wg-link')).toHaveLength(4);
    expect(node(el, 'task:t1')).toBeNull();
    expect(el.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('shows the employee name and current position at the centre', () => {
    const { el } = setup();
    const centre = node(el, 'employee:e1');

    expect(centre.textContent).toContain('Saif Ahamed');
    expect(centre.textContent).toContain('Watercraft Engineer');
  });

  it('dims nodes that are not neighbours of the hovered node', () => {
    const { fixture, el } = setup();

    node(el, 'module:m1').dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();

    expect(node(el, 'project:p2').classList.contains('wg-node--dim')).toBe(true);
    expect(node(el, 'project:p1').classList.contains('wg-node--dim')).toBe(false);

    node(el, 'module:m1').dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(node(el, 'project:p2').classList.contains('wg-node--dim')).toBe(false);
  });

  it('opens the full Work Network explorer from the preview', () => {
    const { fixture, el } = setup();
    const dialog = open(fixture, el);

    expect(dialog).toBeTruthy();
    expect(dialog.querySelector('app-work-network-explorer')).toBeTruthy();
    expect(dialog.textContent).toContain('Work Network');
  });

  it('tells the user in the full graph when more tasks exist than are drawn', () => {
    const { fixture, el } = setup({ ...graph, hiddenTaskCount: 7 });
    const dialog = open(fixture, el);

    expect(dialog.textContent).toContain('+7 more tasks not drawn');
  });

  it('closes the full graph with its close button', () => {
    const { fixture, el } = setup();
    open(fixture, el);

    (el.querySelector('[aria-label="Close full work network"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('Esc unlocks a selected module first, then closes the dialog', () => {
    const { fixture, el } = setup();
    const dialog = open(fixture, el);

    (dialog.querySelector('[data-node-id="module:m1"]') as SVGGElement).dispatchEvent(new Event('click'));
    fixture.detectChanges();
    expect(dialog.querySelector('[data-testid="work-network-panel"]')).toBeTruthy();

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="work-network-panel"]')).toBeFalsy();

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('closes and emits the task when a task card is clicked', () => {
    const { fixture, el, selected } = setup();
    const dialog = open(fixture, el);

    (dialog.querySelector('[data-node-id="module:m1"]') as SVGGElement).dispatchEvent(new Event('click'));
    fixture.detectChanges();
    (dialog.querySelector('[data-task-id="task:t1"]') as SVGGElement).dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(selected.map((n) => n.id)).toEqual(['task:t1']);
    expect(el.querySelector('[role="dialog"]')).toBeFalsy();
  });
});
