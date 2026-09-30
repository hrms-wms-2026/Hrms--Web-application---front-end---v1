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
    TestBed.configureTestingModule({ imports: [WorkNetworkGraphComponent] });
    const fixture = TestBed.createComponent(WorkNetworkGraphComponent);
    fixture.componentRef.setInput('graph', g);
    const selected: WorkGraphNode[] = [];
    fixture.componentInstance.nodeSelected.subscribe((n) => selected.push(n));
    fixture.detectChanges();
    return { fixture, selected, el: fixture.nativeElement as HTMLElement };
  }

  const node = (el: HTMLElement, id: string) => el.querySelector(`[data-node-id="${id}"]`) as SVGGElement;

  it('renders one SVG node per graph node and one line per link', () => {
    const { el } = setup();

    expect(el.querySelectorAll('.wg-node')).toHaveLength(5);
    expect(el.querySelectorAll('line.wg-link')).toHaveLength(5);
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

  it('emits nodeSelected when a project, module or task is clicked', () => {
    const { el, selected } = setup();

    node(el, 'project:p1').dispatchEvent(new Event('click'));
    node(el, 'module:m1').dispatchEvent(new Event('click'));
    node(el, 'task:t1').dispatchEvent(new Event('click'));

    expect(selected.map((n) => n.id)).toEqual(['project:p1', 'module:m1', 'task:t1']);
  });

  it('does not emit when the employee node is clicked', () => {
    const { el, selected } = setup();

    node(el, 'employee:e1').dispatchEvent(new Event('click'));

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

  it('tells the user when more tasks exist than are drawn', () => {
    const { el } = setup({ ...graph, hiddenTaskCount: 7 });

    expect(el.textContent).toContain('+7 more tasks not shown');
  });

  it('does not show the hidden-tasks note when nothing is hidden', () => {
    const { el } = setup();

    expect(el.textContent).not.toContain('more task');
  });
});
