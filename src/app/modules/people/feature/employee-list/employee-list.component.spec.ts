import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { EmployeeListItemResponse } from '../../models/employee.model';
import { EmployeeListComponent } from './employee-list.component';

describe('EmployeeListComponent', () => {
  let fixture: ComponentFixture<EmployeeListComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let permissionService: { hasPermission: (p: string) => boolean };
  let hasOffboardPermission = true;

  beforeEach(() => {
    hasOffboardPermission = true;
    localStorage.removeItem('employee_list_columns');
  });

  async function flushEmployees(items: Partial<EmployeeListItemResponse>[], totalCount = items.length): Promise<void> {
    const full = items.map((i, n) => ({
      id: `e${n}`, employeeNumber: `N${n}`, fullName: `Person ${n}`, email: `p${n}@x.com`, departmentId: null, departmentName: null,
      positionId: null, positionName: null, legalEntityId: 'le-1', legalEntityName: 'Co', employmentTypeLabel: 'Full-time',
      status: 'active', reportingManagerId: null, reportingManagerName: null, ...i
    }));
    httpMock.match((r) => r.url.includes('/employees') && !r.url.includes('/bulk')).forEach((r) => r.flush({ items: full, totalCount, page: 1, pageSize: 25 }));
    httpMock.match((r) => r.url.includes('/onboarding/drafts')).forEach((r) => r.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const q = <T extends HTMLElement = HTMLElement>(selector: string) => fixture.nativeElement.querySelector(selector) as T | null;

  function flushEmployeesAndDrafts(): void {
    httpMock.match(() => true).forEach((req) => {
      if (req.request.url.includes('/employees')) {
        req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
      } else if (req.request.url.includes('/onboarding/drafts')) {
        req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
      }
    });
  }

  async function setup(hasWritePermission: boolean, initialQuery: Record<string, string> = {}) {
    queryParams = new BehaviorSubject(convertToParamMap(initialQuery));
    permissionService = {
      hasPermission: (p) => (p === 'employees:write' ? hasWritePermission : p === 'employees:offboard' ? hasOffboardPermission : true)
    };

    await TestBed.configureTestingModule({
      imports: [EmployeeListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PermissionService, useValue: permissionService },
        { provide: LegalEntityStore, useValue: { selectedLegalEntityId: signal('le-1') } },
        { provide: AuthStore, useValue: { employeeId: signal('me') } },
        { provide: DepartmentApiService, useValue: { listFlat: () => of({ items: [] }) } },
        { provide: PositionApiService, useValue: { listFlat: () => of({ items: [] }) } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: queryParams.value },
            queryParamMap: queryParams.asObservable()
          }
        }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(EmployeeListComponent);
    fixture.detectChanges();
  }

  afterEach(() => httpMock.verify());

  it('shows the loader while employees are loading, then the table on success', async () => {
    await setup(true);
    expect(fixture.nativeElement.textContent).toContain('Loading employees');

    flushEmployeesAndDrafts();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No employees found');
  });

  it('uses the employee-list response directly without per-employee attendance requests', async () => {
    await setup(true);

    httpMock.expectOne((r) => r.url.includes('/employees')).flush({
      items: [
        {
          id: 'emp-warning',
          employeeNumber: 'E-001',
          fullName: 'Zoe Warning',
          email: 'zoe@test.dev',
          departmentId: null,
          departmentName: null,
          positionId: null,
          positionName: null,
          legalEntityId: 'le-1',
          legalEntityName: 'Acme Co',
          employmentTypeLabel: 'Full-time',
          status: 'active',
          reportingManagerId: null,
          reportingManagerName: null,
          attendanceSummary: {
            showNotClockedInWarning: true,
            shouldHaveClockedIn: true,
            hasClockedInToday: false,
            workDate: '2026-08-21',
            timezone: 'Asia/Colombo',
            scheduledStartTime: '09:00',
            warningLabel: 'Still has not clocked in'
          }
        },
        {
          id: 'emp-normal',
          employeeNumber: 'E-002',
          fullName: 'Ada Normal',
          email: 'ada@test.dev',
          departmentId: null,
          departmentName: null,
          positionId: null,
          positionName: null,
          legalEntityId: 'le-1',
          legalEntityName: 'Acme Co',
          employmentTypeLabel: 'Full-time',
          status: 'active',
          reportingManagerId: null,
          reportingManagerName: null
        }
      ],
      totalCount: 2,
      page: 1,
      pageSize: 25
    });
    httpMock.expectOne((r) => r.url.includes('/onboarding/drafts')).flush({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 25
    });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.edt__name')[0]?.textContent).toContain('Zoe Warning');
    expect(fixture.nativeElement.querySelectorAll('.edt__name')[1]?.textContent).toContain('Ada Normal');
    expect(httpMock.match((r) => /\/attendance|\/time-tracking/.test(r.url)).length).toBe(0);
  });

  it('shows the error state with a retry action that reissues the request', async () => {
    await setup(true);
    httpMock.expectOne((r) => r.url.includes('/employees')).flush('error', { status: 500, statusText: 'Server Error' });
    httpMock.expectOne((r) => r.url.includes('/onboarding/drafts')).flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Something went wrong');

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const retryButton = buttons.find((b) => b.textContent?.includes('Try again'));
    retryButton?.click();

    httpMock.expectOne((r) => r.url.includes('/employees')).flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No employees found');
  });

  it('hides the Add Employee button without employees:write permission', async () => {
    await setup(false);
    flushEmployeesAndDrafts();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Add Employee');
  });

  it('shows the Add Employee button with employees:write permission', async () => {
    await setup(true);
    flushEmployeesAndDrafts();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Add Employee');
  });

  it('synchronizes the search query param to the URL after debounce', async () => {
    vi.useFakeTimers();
    try {
      await setup(true);
      flushEmployeesAndDrafts();
      await fixture.whenStable();
      fixture.detectChanges();

      fixture.componentInstance.onSearchInput('ada');
      vi.advanceTimersByTime(299);
      expect(router.navigate).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { search: 'ada', page: 1 } })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('excludes finalized and invitation-sent drafts from the Onboarding Drafts count and table', async () => {
    await setup(true);
    httpMock.expectOne((r) => r.url.includes('/employees')).flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    httpMock.expectOne((r) => r.url.includes('/onboarding/drafts')).flush({
      items: [
        {
          id: 'd1',
          displayName: 'Active One',
          positionName: null,
          departmentName: null,
          status: 'draft',
          draftReason: 'saved_manually',
          lastSavedStep: 'employee_details',
          startedByName: 'HR Starter'
        },
        {
          id: 'd2',
          displayName: 'Finalized Two',
          positionName: null,
          departmentName: null,
          status: 'finalized',
          draftReason: 'invitation_sent',
          lastSavedStep: 'review_and_submit',
          startedByName: 'HR Starter'
        },
        {
          id: 'd3',
          displayName: 'Invited Three',
          positionName: null,
          departmentName: null,
          status: 'draft',
          draftReason: 'invitation_sent',
          lastSavedStep: 'review_and_submit',
          startedByName: 'HR Starter'
        }
      ],
      totalCount: 3,
      page: 1,
      pageSize: 25
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.emp-count-badge--amber');
    expect(badge?.textContent?.trim()).toBe('1');

    fixture.componentInstance.setTab('drafts');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Active One');
    expect(fixture.nativeElement.textContent).not.toContain('Finalized Two');
    expect(fixture.nativeElement.textContent).not.toContain('Invited Three');
  });

  it('the Add Employee link never carries a draftId query param', async () => {
    await setup(true);
    flushEmployeesAndDrafts();
    await fixture.whenStable();
    fixture.detectChanges();

    const addLink: HTMLAnchorElement | null = fixture.nativeElement.querySelector('a.no-underline');
    expect(addLink).toBeTruthy();
    expect(addLink?.getAttribute('href')).toBe('/people/employees/new');
  });

  it('reloads employees when the query param changes', async () => {
    await setup(true, { search: 'grace' });
    const req = httpMock.expectOne((r) => r.url.includes('/employees') && r.params.get('search') === 'grace');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    httpMock.expectOne((r) => r.url.includes('/onboarding/drafts')).flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    await fixture.whenStable();

    expect(req.request.params.get('search')).toBe('grace');
  });

  it('no longer renders the view-cycle button', async () => {
    await setup(true);
    await flushEmployees([{}]);
    expect(q('[data-testid="emp-view-cycle-btn"]')).toBeNull();
    expect(q('app-employee-directory-table')).not.toBeNull();
  });

  it('passes sort, page size and filters from the URL to the API', async () => {
    await setup(true);
    queryParams.next(convertToParamMap({ sortBy: 'department', sortDir: 'desc', pageSize: '50', employmentType: 'contract,intern', managerId: 'm1' }));
    const req = httpMock.match((r) => r.url.endsWith('/employees')).at(-1)!;
    expect(req.request.params.get('sortBy')).toBe('department');
    expect(req.request.params.get('sortDir')).toBe('desc');
    expect(req.request.params.get('pageSize')).toBe('50');
    expect(req.request.params.getAll('employmentType')).toEqual(['contract', 'intern']);
    expect(req.request.params.get('managerId')).toBe('m1');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 50 });
    flushEmployeesAndDrafts();
  });

  it('sorting from the table header writes sortBy/sortDir and resets to page 1', async () => {
    await setup(true);
    await flushEmployees([{}]);
    q('[data-testid="employee-sort-department"]')!.click();
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ sortBy: 'department', sortDir: 'asc', page: 1 }), queryParamsHandling: 'merge'
    }));
  });

  it('shows the bulk bar with actions gated by permission', async () => {
    hasOffboardPermission = false;
    await setup(true);
    await flushEmployees([{}, {}]);
    q<HTMLInputElement>('[data-testid="employee-select-e0"]')!.click();
    fixture.detectChanges();
    const bar = q('[data-testid="bulk-action-bar"]')!;
    expect(bar.textContent).toContain('1 employee selected');
    expect(bar.querySelector('[data-testid="bulk-action-promote"]')).not.toBeNull();
    (bar.querySelector('[data-testid="bulk-action-more"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(q('[data-testid="menu-item-export"]')).not.toBeNull();
    expect(q('[data-testid="menu-item-offboard"]')).toBeNull();
  });

  it('without employees:write only Export is offered', async () => {
    await setup(false);
    await flushEmployees([{}]);
    q<HTMLInputElement>('[data-testid="employee-select-e0"]')!.click();
    fixture.detectChanges();
    expect(q('[data-testid="bulk-action-bar"]')).not.toBeNull();
    expect(q('[data-testid="bulk-action-promote"]')).toBeNull();
  });

  it('Promote is disabled when the selection spans companies', async () => {
    await setup(true);
    await flushEmployees([{ legalEntityId: 'le-1' }, { legalEntityId: 'le-2' }]);
    q<HTMLInputElement>('[data-testid="employee-select-all"]')!.click();
    fixture.detectChanges();
    const promote = q<HTMLButtonElement>('[data-testid="bulk-action-promote"]')!;
    expect(promote.disabled).toBe(true);
    expect(promote.title).toContain('single company');
  });

  it('changing a filter clears the selection; changing page keeps it', async () => {
    await setup(true);
    await flushEmployees([{}]);
    q<HTMLInputElement>('[data-testid="employee-select-e0"]')!.click();
    queryParams.next(convertToParamMap({ page: '2' }));
    await flushEmployees([{ id: 'x' }]);
    expect(q('[data-testid="bulk-action-bar"]')).not.toBeNull();
    queryParams.next(convertToParamMap({ page: '2', departmentId: 'd1' }));
    await flushEmployees([{ id: 'x' }]);
    expect(q('[data-testid="bulk-action-bar"]')).toBeNull();
  });

  it('row menu hides Promote/Transfer on the caller\'s own row and offers Offboard to employees:offboard holders', async () => {
    await setup(true);
    await flushEmployees([{ id: 'me' }, { id: 'other' }]);
    expect(q('[data-testid="employee-row-menu-me"] button')).toBeNull();
    q('[data-testid="employee-row-menu-other"] button')!.click();
    fixture.detectChanges();
    expect(q('[data-testid="menu-item-promote"]')).not.toBeNull();
    q('[data-testid="menu-item-offboard"]')!.click();
    expect(router.navigate).toHaveBeenCalledWith(['/people/employees', 'other', 'offboarding']);
  });

  it('bulk result shows the summary, reloads and clears the selection', async () => {
    await setup(true);
    await flushEmployees([{}]);
    q<HTMLInputElement>('[data-testid="employee-select-e0"]')!.click();
    fixture.detectChanges();
    const inst = fixture.componentInstance;
    inst.onBulkCompleted('Change employment type', { items: [{ employeeId: 'e0', outcome: 'succeeded', reason: null }], succeeded: 1, pendingApproval: 0, failed: 0 });
    fixture.detectChanges();
    expect(inst.selection.count()).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('1 changed · 0 sent for approval · 0 skipped');
    expect(httpMock.match((r) => r.url.endsWith('/employees')).length).toBeGreaterThan(0);
  });
});
