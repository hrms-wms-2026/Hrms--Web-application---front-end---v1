import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { EmployeeWorkGraphResponse } from '../../models/work-graph.model';
import { WorkModeStore } from '../../../settings/state/work-mode.store';
import { EmployeeEmploymentTabComponent } from './employment-tab.component';

describe('EmployeeEmploymentTabComponent', () => {
  const employee: EmployeeDetailResponse = {
    id: 'emp-1',
    jobInformation: {
      employeeNumber: 'E-001',
      legalEntityId: 'le-1',
      legalEntityName: 'Acme Corp',
      departmentName: 'Engineering',
      positionName: 'Software Engineer',
      positionId: 'pos-1',
      reportingManagerName: 'Grace Hopper',
      employmentTypeLabel: 'Full time',
      status: 'active',
      hireDate: '2024-01-15',
      probationEndDate: null,
      workModeLabel: 'Remote',
      employmentTypeCode: 'full_time',
      workModeId: 'wm-1'
    },
    personalInformation: {
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@test.dev', phone: null,
      dateOfBirth: null, gender: null, nationalityId: null, addresses: []
    },
    emergencyContacts: [],
    payroll: null,
    invitationStatus: null,
    invitationExpiresAt: null,
    trayAppAccessEnabled: false
  };

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
    // EmployeeJobInfoComponent injects the root WorkModeStore (-> HttpClient), which this spec
    // does not provide; stub it exactly as employee-detail.component.spec.ts does.
    const workModeStoreStub = {
      items: signal([]) as any, atCap: signal(false) as any, loading: signal(false) as any,
      saving: signal(false) as any, error: signal(null) as any,
      load: vi.fn() as any, create: vi.fn() as any, update: vi.fn() as any, deactivate: vi.fn() as any
    };
    TestBed.configureTestingModule({
      imports: [EmployeeEmploymentTabComponent],
      providers: [
        { provide: PeopleApiService, useValue: { getWorkGraph } },
        { provide: WorkModeStore, useValue: workModeStoreStub }
      ]
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(EmployeeEmploymentTabComponent);
    fixture.componentRef.setInput('employee', employee);
    return { fixture, navigate, el: fixture.nativeElement as HTMLElement };
  }

  it('renders job details and history without duplicate arrangement and employment record cards', () => {
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(fullGraph)));
    fixture.detectChanges();

    expect(el.querySelector('app-employee-job-info')).toBeTruthy();
    expect(el.querySelector('app-employee-work-arrangement')).toBeFalsy();
    expect(el.querySelector('app-employee-employment-record')).toBeFalsy();
    expect(el.querySelector('app-employee-job-journey')).toBeTruthy();
  });

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

  it('shows the forbidden state on a 403 without breaking the rest of the tab', () => {
    const { fixture, el } = setup(
      vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })))
    );
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
    expect(el.querySelector('app-employee-job-info')).toBeTruthy();
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
    const tab = fixture.componentInstance;

    tab.onNodeSelected(fullGraph.nodes[1]);
    tab.onNodeSelected(fullGraph.nodes[2]);
    tab.onNodeSelected(fullGraph.nodes[3]);

    expect(navigate).toHaveBeenNthCalledWith(1, ['/work', 'p1', 'board']);
    expect(navigate).toHaveBeenNthCalledWith(2, ['/work', 'p1', 'milestones', 'm1', 'tree']);
    expect(navigate).toHaveBeenNthCalledWith(3, ['/work', 'p1', 'board']);
  });

  it('does not reload the graph when the parent re-emits the same employee id', () => {
    const getWorkGraph = vi.fn().mockReturnValue(of(fullGraph));
    const { fixture } = setup(getWorkGraph);
    fixture.detectChanges();

    fixture.componentRef.setInput('employee', { ...employee });
    fixture.detectChanges();

    expect(getWorkGraph).toHaveBeenCalledTimes(1);
  });
});
