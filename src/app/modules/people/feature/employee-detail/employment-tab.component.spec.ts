import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { EmployeeWorkGraphResponse } from '../../models/work-graph.model';
import { WorkModeStore } from '../../../settings/state/work-mode.store';
import { EmployeeDirectoryStore } from '../../../work/state/employee-directory.store';
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
      workModeId: 'wm-1',
      reportingManagerId: 'mgr-1'
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

  const reportsPage = {
    items: [
      { id: 'r-1', fullName: 'Alan Turing', positionName: 'Engineer', departmentName: 'Engineering', avatarFileId: null },
      { id: 'r-2', fullName: 'Barbara Liskov', positionName: 'Engineer', departmentName: 'Engineering', avatarFileId: null }
    ],
    totalCount: 2,
    page: 1,
    pageSize: 3
  };

  const person = (id: string, fullName: string, managerId: string | null, positionName: string) => ({
    id, fullName, positionName, departmentName: 'Engineering', avatarFileId: null, status: 'active',
    reportingManagerId: managerId, reportingManagerName: null
  });
  const everyonePage = {
    items: [
      person('ceo', 'Chief Person', null, 'Chief Executive Officer'),
      person('mgr-1', 'Grace Hopper', 'ceo', 'Team Lead'),
      person('emp-1', 'Ada Lovelace', 'mgr-1', 'Software Engineer'),
      person('peer', 'Peer Person', 'mgr-1', 'Other Engineer'),
      person('ops', 'Ops Person', 'ceo', 'Operations'),
      person('r-1', 'Alan Turing', 'emp-1', 'Junior Engineer'),
      person('r-2', 'Intern Person', 'r-1', 'Intern')
    ],
    totalCount: 7,
    page: 1,
    pageSize: 100
  };
  const listEmployeesMock = () =>
    vi.fn((params: { managerId?: string }) => of(params.managerId ? reportsPage : everyonePage));

  function setup(getWorkGraph: ReturnType<typeof vi.fn>, listEmployees: ReturnType<typeof vi.fn> = listEmployeesMock()) {
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
        { provide: PeopleApiService, useValue: { getWorkGraph, listEmployees } },
        { provide: WorkModeStore, useValue: workModeStoreStub },
        { provide: EmployeeDirectoryStore, useValue: { get: vi.fn(), ensureLoaded: vi.fn().mockResolvedValue(undefined), seed: vi.fn() } }
      ]
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(EmployeeEmploymentTabComponent);
    fixture.componentRef.setInput('employee', employee);
    return { fixture, navigate, listEmployees, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the employment KPI strip from the employee record', () => {
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(fullGraph)));
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="employment-kpi-type"]')?.textContent).toContain('Full time');
    expect(el.querySelector('[data-testid="employment-kpi-mode"]')?.textContent).toContain('Remote');
    expect(el.querySelector('[data-testid="employment-kpi-joined"]')?.textContent).toContain('Jan 15, 2024');
    expect(el.querySelector('[data-testid="employment-kpi-department"]')?.textContent).toContain('Acme Corp');
  });

  it('shows the manager and asks only for the direct-report count', () => {
    const { fixture, el, listEmployees } = setup(vi.fn().mockReturnValue(of(fullGraph)));
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="reporting-manager"]')?.textContent).toContain('Grace Hopper');
    expect(el.querySelector('[data-testid="reporting-direct-reports"]')?.textContent).toContain('Direct Reports (2)');
    expect(listEmployees).toHaveBeenCalledTimes(1);
    expect(listEmployees).toHaveBeenCalledWith(expect.objectContaining({ managerId: 'emp-1', pageSize: 1 }));
    expect(el.querySelector('[data-testid="direct-report"]')).toBeFalsy();
  });

  it('hides the direct reports row when the list is forbidden', () => {
    const forbidden = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(fullGraph)), forbidden);
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="reporting-direct-reports"]')).toBeFalsy();
    expect(el.querySelector('[data-testid="reporting-self"]')?.textContent).toContain('Ada Lovelace');
  });

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

  it('opens the reporting structure by people: managers above and every report below, nothing beside it', () => {
    const { fixture, listEmployees } = setup(vi.fn().mockReturnValue(of(fullGraph)));
    fixture.detectChanges();
    expect(listEmployees).toHaveBeenCalledTimes(1);

    (document.querySelector('[data-testid="reporting-structure-card"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(listEmployees).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
    const tree = document.querySelector('[data-testid="reporting-hierarchy"]') as HTMLElement;
    const text = tree.textContent ?? '';
    expect(text).toContain('Chief Person');
    expect(text).toContain('Grace Hopper');
    expect(text).toContain('Alan Turing');
    expect(text).toContain('Intern Person');
    expect(text).not.toContain('Peer Person');
    expect(text).not.toContain('Ops Person');
    expect(tree.querySelector('.rh-card--self')?.textContent).toContain('Ada Lovelace');
  });

  it('opens the full work network from a click anywhere on the card, and closing it does not reopen it', () => {
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(fullGraph)));
    fixture.detectChanges();

    (el.querySelector('[data-testid="work-network-card"] header') as HTMLElement).click();
    fixture.detectChanges();
    const overlay = document.querySelector('[data-testid="work-network-overlay"]') as HTMLElement;
    expect(overlay).toBeTruthy();

    (overlay.querySelector('button[aria-label="Close"], button[aria-label*="lose"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(document.querySelector('[data-testid="work-network-overlay"]')).toBeNull();
  });

  it('refreshes the work network from the card header without blanking it', () => {
    const getWorkGraph = vi.fn().mockReturnValue(of(fullGraph));
    const { fixture, el } = setup(getWorkGraph);
    fixture.detectChanges();

    (el.querySelector('[data-testid="work-network-card"] [data-testid="popout-refresh"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(getWorkGraph).toHaveBeenCalledTimes(2);
    expect(el.querySelector('app-work-network-graph')).toBeTruthy();
  });
});
