import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../../models/work-graph.model';
import { WorkNetworkDetailPanelComponent } from './work-network-detail-panel.component';

describe('WorkNetworkDetailPanelComponent', () => {
  const stats = { totalTasks: 4, notStarted: 1, inProgress: 1, completed: 2, overdue: 0, allocatedHours: 100, completedHours: 40 };
  const moduleDetails = {
    owner: { employeeId: 'e1', name: 'Kiru Balachandran', avatarFileId: null },
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    members: [{ employeeId: 'e1', name: 'Kiru Balachandran', avatarFileId: null }],
    memberCount: 1
  };

  const employeeGraph: EmployeeWorkGraphResponse = {
    nodes: [
      { id: 'employee:e1', kind: 'employee', label: 'Kiru Balachandran' },
      { id: 'project:p1', kind: 'project', label: 'Hardware Integration', projectId: 'p1' },
      {
        id: 'module:m1', kind: 'module', label: 'Protocol Adapters', role: 'owner',
        projectId: 'p1', objectiveId: 'o1', stats, module: moduleDetails
      }
    ],
    links: [
      { source: 'employee:e1', target: 'project:p1', kind: 'works_on' },
      { source: 'project:p1', target: 'module:m1', kind: 'contains' }
    ],
    hiddenTaskCount: 0
  };

  /** No employee node and no project node: the shape Work Management sends. */
  const projectGraph: EmployeeWorkGraphResponse = {
    nodes: [
      { id: 'module:root', kind: 'module', label: 'Hardware integration portal', projectId: 'p1', objectiveId: 'root', stats, module: moduleDetails },
      { id: 'module:m1', kind: 'module', label: 'Protocol Adapters', projectId: 'p1', objectiveId: 'o1', stats, module: moduleDetails }
    ],
    links: [{ source: 'module:root', target: 'module:m1', kind: 'contains' }],
    hiddenTaskCount: 0
  };

  function setup(graph: EmployeeWorkGraphResponse, selected: WorkGraphNode, projectMode?: boolean) {
    TestBed.configureTestingModule({
      imports: [WorkNetworkDetailPanelComponent],
      providers: [provideHttpClient()]
    });
    const fixture = TestBed.createComponent(WorkNetworkDetailPanelComponent);
    fixture.componentRef.setInput('graph', graph);
    fixture.componentRef.setInput('selected', selected);
    if (projectMode !== undefined) fixture.componentRef.setInput('projectMode', projectMode);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const kind = (el: HTMLElement) => el.querySelector('.wgp-kind')!.textContent!.trim();
  const tasksTab = (el: HTMLElement) => el.querySelector('[data-testid="panel-tab-tasks"]')!.textContent!.trim();

  it('renders the employee-relative kind line and tasks heading when projectMode is false', () => {
    const { el } = setup(employeeGraph, employeeGraph.nodes[2]);

    expect(kind(el)).toBe('Milestone • Hardware Integration • You own');
    expect(tasksTab(el)).toContain('Tasks');
  });

  it('renders Module with the parent module name and no role word when projectMode is true', () => {
    const { el } = setup(projectGraph, projectGraph.nodes[1], true);

    expect(kind(el)).toBe('Milestone • Hardware integration portal');
  });

  it('heads the tasks tab as the module tasks, not the employee tasks, when projectMode is true', () => {
    const { fixture, el } = setup(projectGraph, projectGraph.nodes[1], true);
    el.querySelector<HTMLButtonElement>('[data-testid="panel-tab-tasks"]')!.click();
    fixture.detectChanges();

    expect(el.textContent).not.toContain("'s open tasks");
    expect(el.textContent).toContain('Open tasks in this milestone');
  });

  it('renders without an employee node present in the graph when projectMode is true', () => {
    const { el } = setup(projectGraph, projectGraph.nodes[0], true);

    // The root module has no parent, so the kind line carries the project-less label alone.
    expect(kind(el)).toBe('Milestone');
    expect(el.textContent).not.toContain('Employee');
  });

  it('names a sprint and the module it hangs off when projectMode is true', () => {
    const sprint: WorkGraphNode = { id: 'sprint:s1', kind: 'sprint', label: 'Sprint 7', status: 'active', projectId: 'p1' };
    const graph: EmployeeWorkGraphResponse = {
      ...projectGraph,
      nodes: [...projectGraph.nodes, sprint],
      links: [...projectGraph.links, { source: 'module:m1', target: 'sprint:s1', kind: 'contains' }]
    };
    const { el } = setup(graph, sprint, true);

    expect(kind(el)).toBe('Sprint • Protocol Adapters');
  });

  describe('sprint selected in project mode', () => {
    const sprint: WorkGraphNode = { id: 'sprint:s1', kind: 'sprint', label: 'Sprint 7', status: 'active', projectId: 'p1' };
    const task: WorkGraphNode = {
      id: 'task:t1', kind: 'task', label: 'Pair over BLE', sublabel: 'HIP-1', status: 'active',
      projectId: 'p1', objectiveId: 'o1', taskId: 't1'
    };
    const graph: EmployeeWorkGraphResponse = {
      ...projectGraph,
      nodes: [...projectGraph.nodes, sprint, task],
      links: [
        ...projectGraph.links,
        { source: 'module:m1', target: 'sprint:s1', kind: 'contains' },
        { source: 'sprint:s1', target: 'task:t1', kind: 'has_task' }
      ]
    };

    it('lists the sprint tasks, not the project modules, on the overview and the tasks tab', () => {
      const { fixture, el } = setup(graph, sprint, true);

      expect(el.textContent).toContain('Pair over BLE');
      expect(el.querySelector('.wgp-section-head h4')!.textContent).not.toBe('Milestones');

      el.querySelector<HTMLButtonElement>('[data-testid="panel-tab-tasks"]')!.click();
      fixture.detectChanges();
      expect(el.textContent).toContain('Pair over BLE');
      expect(el.textContent).not.toContain('Hardware integration portal');
    });

    it('offers no open-in-Work-Management button for a sprint', () => {
      const { el } = setup(graph, sprint, true);

      expect(el.querySelector('[data-testid="panel-open"]')).toBeNull();
    });
  });
});
