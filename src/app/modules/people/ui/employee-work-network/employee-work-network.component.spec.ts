import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeWorkGraphResponse } from '../../models/work-graph.model';
import { EmployeeWorkNetworkComponent } from './employee-work-network.component';

describe('EmployeeWorkNetworkComponent', () => {
  const fullGraph: EmployeeWorkGraphResponse = {
    nodes: [
      { id: 'employee:emp-1', kind: 'employee', label: 'Ada Lovelace', sublabel: 'Software Engineer' },
      { id: 'project:p1', kind: 'project', label: 'Website', projectId: 'p1' },
      { id: 'module:m1', kind: 'module', label: 'Checkout', role: 'owner', projectId: 'p1', objectiveId: 'm1' },
      { id: 'task:t1', kind: 'task', label: 'Fix cart', sublabel: 'WEB-1', status: 'active', projectId: 'p1', objectiveId: 'm1', taskId: 't1' }
    ],
    links: [
      { source: 'employee:emp-1', target: 'project:p1', kind: 'works_on' },
      { source: 'project:p1', target: 'module:m1', kind: 'contains' },
      { source: 'module:m1', target: 'task:t1', kind: 'has_task' }
    ],
    hiddenTaskCount: 0
  };

  function setup(getWorkGraph: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [EmployeeWorkNetworkComponent],
      providers: [{ provide: PeopleApiService, useValue: { getWorkGraph } }]
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(EmployeeWorkNetworkComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    return { fixture, navigate, el: fixture.nativeElement as HTMLElement };
  }

  it('loads the work graph for the employee and renders it', () => {
    const getWorkGraph = vi.fn().mockReturnValue(of(fullGraph));
    const { fixture, el } = setup(getWorkGraph);
    fixture.detectChanges();

    expect(getWorkGraph).toHaveBeenCalledWith('emp-1');
    expect(el.querySelector('app-work-network-graph')).toBeTruthy();
  });

  it('shows a loading state until the graph responds', () => {
    const subject = new Subject<EmployeeWorkGraphResponse>();
    const { fixture, el } = setup(vi.fn().mockReturnValue(subject.asObservable()));
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="widget-loading"]')).toBeTruthy();

    subject.next(fullGraph);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="widget-loading"]')).toBeFalsy();
  });

  it('shows the empty state when the employee has no project work (only the centre node)', () => {
    const onlyMe: EmployeeWorkGraphResponse = { nodes: [fullGraph.nodes[0]], links: [], hiddenTaskCount: 0 };
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(onlyMe)));
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="widget-empty"]')?.textContent).toContain('not part of any project');
    expect(el.querySelector('app-work-network-graph')).toBeFalsy();
  });

  it('shows the forbidden state on a 403', () => {
    const { fixture, el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });

  it('shows an error state and retries the load', () => {
    const getWorkGraph = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValueOnce(of(fullGraph));
    const { fixture, el } = setup(getWorkGraph);
    fixture.detectChanges();

    (el.querySelector('app-error-state button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(getWorkGraph).toHaveBeenCalledTimes(2);
    expect(el.querySelector('app-work-network-graph')).toBeTruthy();
  });

  it('navigates to the project board, module tree and (for tasks) the project board on node click', () => {
    const { fixture, navigate } = setup(vi.fn().mockReturnValue(of(fullGraph)));
    fixture.detectChanges();
    const card = fixture.componentInstance;

    card.onNodeSelected(fullGraph.nodes[1]);
    card.onNodeSelected(fullGraph.nodes[2]);
    card.onNodeSelected(fullGraph.nodes[3]);

    expect(navigate).toHaveBeenNthCalledWith(1, ['/work', 'p1', 'board']);
    expect(navigate).toHaveBeenNthCalledWith(2, ['/work', 'p1', 'milestones', 'm1', 'tree']);
    expect(navigate).toHaveBeenNthCalledWith(3, ['/work', 'p1', 'board']);
  });

  it('does not reload the graph when the parent re-emits the same employee id', () => {
    const getWorkGraph = vi.fn().mockReturnValue(of(fullGraph));
    const { fixture } = setup(getWorkGraph);
    fixture.detectChanges();

    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();

    expect(getWorkGraph).toHaveBeenCalledTimes(1);
  });
});
