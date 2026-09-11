import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { EmployeeListComponent } from './employee-list.component';

describe('EmployeeListComponent', () => {
  let fixture: ComponentFixture<EmployeeListComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let permissionService: { hasPermission: (p: string) => boolean };

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
    permissionService = { hasPermission: (p) => (p === 'employees:write' ? hasWritePermission : true) };

    await TestBed.configureTestingModule({
      imports: [EmployeeListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PermissionService, useValue: permissionService },
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

    expect(fixture.nativeElement.querySelectorAll('.emp-name')[0]?.textContent).toContain('Zoe Warning');
    expect(fixture.nativeElement.querySelectorAll('.emp-name')[1]?.textContent).toContain('Ada Normal');
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

  it('toggles viewMode between table, list, and card and persists to localStorage', async () => {
    await setup(true);
    flushEmployeesAndDrafts();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.viewMode()).toBe('table');
    expect(fixture.nativeElement.querySelector('app-employee-table')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-employee-list-view')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-employee-card-view')).toBeNull();

    // Switch to List view
    fixture.componentInstance.setViewMode('list');
    fixture.detectChanges();

    expect(fixture.componentInstance.viewMode()).toBe('list');
    expect(fixture.nativeElement.querySelector('app-employee-table')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-employee-list-view')).not.toBeNull();
    expect(localStorage.getItem('employee_view_mode')).toBe('list');

    // Switch to Card view
    fixture.componentInstance.setViewMode('card');
    fixture.detectChanges();

    expect(fixture.componentInstance.viewMode()).toBe('card');
    expect(fixture.nativeElement.querySelector('app-employee-card-view')).not.toBeNull();
    expect(localStorage.getItem('employee_view_mode')).toBe('card');

    localStorage.removeItem('employee_view_mode');
  });

  it('cycles viewMode sequentially (table -> list -> card -> table) when clicking view cycle button', async () => {
    await setup(true);
    flushEmployeesAndDrafts();
    await fixture.whenStable();
    fixture.detectChanges();

    const cycleBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('[data-testid="emp-view-cycle-btn"]');
    expect(cycleBtn).toBeTruthy();
    expect(fixture.componentInstance.viewMode()).toBe('table');

    // 1st click: table -> list
    cycleBtn!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.viewMode()).toBe('list');
    expect(localStorage.getItem('employee_view_mode')).toBe('list');

    // 2nd click: list -> card
    cycleBtn!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.viewMode()).toBe('card');
    expect(localStorage.getItem('employee_view_mode')).toBe('card');

    // 3rd click: card -> table
    cycleBtn!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.viewMode()).toBe('table');
    expect(localStorage.getItem('employee_view_mode')).toBe('table');

    localStorage.removeItem('employee_view_mode');
  });
});

