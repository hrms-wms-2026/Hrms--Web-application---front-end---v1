import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, Routes, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject, of, throwError, Subject } from 'rxjs';
import { EmployeeDetailComponent } from './employee-detail.component';
import { EmployeeOverviewTabComponent } from './tabs/employee-overview-tab.component';
import { EmployeePersonalTabComponent } from './tabs/employee-personal-tab.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';

describe('EmployeeDetailComponent', () => {
  const detailFixture: EmployeeDetailResponse = {
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
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@test.dev',
      phone: null,
      dateOfBirth: null,
      gender: null,
      nationalityId: null,
      addresses: []
    },
    emergencyContacts: [],
    payroll: null,
    invitationStatus: null,
    invitationExpiresAt: null,
    trayAppAccessEnabled: false
  };

  function setup(
    employee: EmployeeDetailResponse,
    apiOverrides: Partial<PeopleApiService> = {},
    hasWritePermission = true,
    currentEmployeeId: string | null = 'emp-99',
    hasOffboardPermission = true,
    childPath: string | null = null,
    routeStub?: object,
    routes: Routes = []
  ) {
    const apiStub = {
      getEmployeeDetail: vi.fn().mockReturnValue(of(employee)),
      resendInvitation: vi.fn().mockReturnValue(of({ expiresAt: '2026-08-25T00:00:00Z' })),
      changePosition: vi.fn().mockReturnValue(of({ pendingApproval: false })),
      getJobJourney: vi.fn().mockReturnValue(of([])),
      ...apiOverrides
    };
    const notificationsStub = { success: vi.fn(), error: vi.fn() };
    // The Change Position modal (Task 4) fetches positions for the legal entity as soon as it
    // opens; stub it out so opening the modal in these tests never issues a real HTTP request.
    const positionApiStub = { listFlat: vi.fn().mockReturnValue(of({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 })) };
    const permissionServiceStub = {
      hasPermission: (p: string) => (p === 'employees:write' ? hasWritePermission : p === 'employees:offboard' ? hasOffboardPermission : true)
    };
    TestBed.configureTestingModule({
      imports: [EmployeeDetailComponent],
      providers: [
        provideRouter(routes),
        { provide: PeopleApiService, useValue: apiStub },
        { provide: NotificationService, useValue: notificationsStub },
        { provide: PositionApiService, useValue: positionApiStub },
        { provide: PermissionService, useValue: permissionServiceStub },
        { provide: AuthStore, useValue: { employeeId: () => currentEmployeeId } },
        ...(routes.length
          ? []
          : [{
              provide: ActivatedRoute,
              useValue: routeStub ?? {
                paramMap: of(convertToParamMap({ id: 'emp-1' })),
                snapshot: { paramMap: convertToParamMap({ id: 'emp-1' }) },
                firstChild: childPath ? { snapshot: { url: [{ path: childPath }] } } : null
              }
            }]),
        { provide: OffboardingApiService, useValue: { getOffboarding: () => of(null) } }
      ]
    });

    const fixture = TestBed.createComponent(EmployeeDetailComponent);
    return { fixture, apiStub, notificationsStub };
  }

  /** The store loads via firstValueFrom, so let the microtasks settle before asserting. */
  async function render(fixture: ReturnType<typeof setup>['fixture']): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows the loader while the employee is loading', async () => {
    const subject = new Subject<EmployeeDetailResponse>();
    const { fixture } = setup(detailFixture, { getEmployeeDetail: vi.fn().mockReturnValue(subject.asObservable()) });
    await render(fixture);

    expect(fixture.nativeElement.textContent).toContain('Loading employee');

    subject.next(detailFixture);
    await render(fixture);

    expect(fixture.nativeElement.textContent).not.toContain('Loading employee');
  });

  it('shows the error state with a retry action that reissues the request', async () => {
    const getEmployeeDetail = vi.fn()
      .mockReturnValueOnce(throwError(() => new Error('boom')))
      .mockReturnValueOnce(of(detailFixture));
    const { fixture } = setup(detailFixture, { getEmployeeDetail });
    await render(fixture);

    expect(fixture.nativeElement.textContent).toContain('boom');

    const retryButton: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
    retryButton?.click();
    await render(fixture);

    expect(getEmployeeDetail).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
  });

  it('shows a Transfer / Promote button and opens the modal when the employee has a legal entity', async () => {
    const { fixture } = setup(detailFixture);
    await render(fixture);

    const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const changePositionButton = buttons.find((b) => b.textContent?.includes('Transfer / Promote'));
    expect(changePositionButton).toBeTruthy();

    expect(fixture.componentInstance.changePositionOpen()).toBe(false);
    changePositionButton?.click();
    await render(fixture);

    expect(fixture.componentInstance.changePositionMenuOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-change-position-modal')).toBeTruthy();
  });

  it('hides the Transfer / Promote button when employee invitationStatus is pending or expired', async () => {
    const { fixture } = setup({
      ...detailFixture,
      invitationStatus: 'pending'
    });
    await render(fixture);

    const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const changePositionButton = buttons.find((b) => b.textContent?.includes('Transfer / Promote'));
    expect(changePositionButton).toBeFalsy();
  });

  it('hides the Change Position menu entirely when viewing your own record', async () => {
    const { fixture } = setup(detailFixture, {}, true, 'emp-1');
    await render(fixture);
    expect(fixture.nativeElement.querySelector('[data-testid="change-position-trigger"]')).toBeFalsy();
  });

  it('shows Promotion/Transfer under Transfer / Promote and Offboarding under More actions for another employee', async () => {
    const { fixture } = setup(detailFixture, {}, true, 'emp-99');
    await render(fixture);
    fixture.componentInstance.changePositionMenuOpen.set(true);
    fixture.componentInstance.moreMenuOpen.set(true);
    await render(fixture);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Promotion');
    expect(text).toContain('Transfer');
    const offboardingButton = fixture.nativeElement.querySelector('[data-testid="offboarding-menu-item"]') as HTMLButtonElement | null;
    expect(offboardingButton?.disabled).toBe(false);
  });

  it('shows Edit Employee linking to the Employment tab edit form for a user with employees:write', async () => {
    const { fixture } = setup(detailFixture, {}, true, 'emp-1');
    await render(fixture);

    expect(fixture.nativeElement.querySelector('[data-testid="edit-employee"]')).toBeTruthy();
  });

  it('hides Edit Employee without employees:write', async () => {
    const { fixture } = setup(detailFixture, {}, false, 'emp-99');
    await render(fixture);

    expect(fixture.nativeElement.querySelector('[data-testid="edit-employee"]')).toBeNull();
  });

  it('hides the Offboarding item from a user with employees:write but not employees:offboard', async () => {
    const { fixture } = setup(detailFixture, {}, true, 'emp-99', false);
    await render(fixture);
    (fixture.nativeElement.querySelector('[data-testid="change-position-trigger"]') as HTMLButtonElement).click();
    await render(fixture);

    expect(fixture.nativeElement.querySelector('[data-testid="more-actions-trigger"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="offboarding-menu-item"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Promotion');
  });

  it('shows only the Offboarding item to a user with employees:offboard but not employees:write', async () => {
    const { fixture } = setup(detailFixture, {}, false, 'emp-99', true);
    await render(fixture);
    expect(fixture.nativeElement.querySelector('[data-testid="change-position-trigger"]')).toBeNull();
    (fixture.nativeElement.querySelector('[data-testid="more-actions-trigger"]') as HTMLButtonElement).click();
    await render(fixture);

    expect(fixture.nativeElement.querySelector('[data-testid="offboarding-menu-item"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Promotion');
  });

  it('enables the Offboarding menu item and navigates to the wizard on click', async () => {
    const { fixture } = setup(detailFixture, {}, true, 'emp-99');
    await render(fixture);
    fixture.componentInstance.moreMenuOpen.set(true);
    await render(fixture);

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const button = fixture.nativeElement.querySelector('[data-testid="offboarding-menu-item"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    button.click();
    await render(fixture);

    expect(navigateSpy).toHaveBeenCalledWith(['/people/employees', expect.any(String), 'offboarding']);
  });

  it('opens the modal with changeReason=Promotion when Promotion is clicked', async () => {
    const { fixture } = setup(detailFixture, {}, true, 'emp-99');
    await render(fixture);

    fixture.componentInstance.openChangePosition('Promotion');

    expect(fixture.componentInstance.changePositionOpen()).toBe(true);
    expect(fixture.componentInstance.changePositionReason()).toBe('Promotion');
  });

  it('does not render a Transfer / Promote button when the user lacks employees:write', async () => {
    const { fixture } = setup(detailFixture, {}, false);
    await render(fixture);

    const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const changePositionButton = buttons.find((b) => b.textContent?.includes('Transfer / Promote'));
    expect(changePositionButton).toBeFalsy();
    expect(fixture.componentInstance.canChangePosition()).toBe(false);
  });

  it('does not render a Transfer / Promote control when the employee has no legal entity', async () => {
    const { fixture } = setup({
      ...detailFixture,
      jobInformation: { ...detailFixture.jobInformation, legalEntityId: null }
    });
    await render(fixture);

    const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const changePositionButton = buttons.find((b) => b.textContent?.includes('Transfer / Promote'));
    expect(changePositionButton).toBeFalsy();
  });

  it('reloads and shows a success toast when the position is changed', async () => {
    const { fixture, apiStub, notificationsStub } = setup(detailFixture);
    await render(fixture);
    fixture.componentInstance.changePositionOpen.set(true);
    await render(fixture);

    fixture.componentInstance.onPositionChanged();

    expect(fixture.componentInstance.changePositionOpen()).toBe(false);
    expect(notificationsStub.success).toHaveBeenCalledWith('Position updated.');
    expect(apiStub.getEmployeeDetail).toHaveBeenCalledTimes(2);
  });

  it('does not show the resend button when the invitation is pending', async () => {
    const { fixture } = setup({ ...detailFixture, invitationStatus: 'pending' });
    await render(fixture);

    expect(fixture.nativeElement.textContent).not.toContain('Resend invitation');
  });

  it('does not show the resend button when the invitation was accepted', async () => {
    const { fixture } = setup({ ...detailFixture, invitationStatus: 'accepted' });
    await render(fixture);

    expect(fixture.nativeElement.textContent).not.toContain('Resend invitation');
  });

  it('does not show the resend button when no invitation was ever issued', async () => {
    const { fixture } = setup({ ...detailFixture, invitationStatus: null });
    await render(fixture);

    expect(fixture.nativeElement.textContent).not.toContain('Resend invitation');
  });

  it('shows the resend button only when the invitation expired unaccepted', async () => {
    const { fixture } = setup({ ...detailFixture, invitationStatus: 'expired' });
    await render(fixture);
    fixture.componentInstance.moreMenuOpen.set(true);
    await render(fixture);

    expect(fixture.nativeElement.querySelector('[data-testid="resend-invitation"]')?.textContent).toContain('Resend invitation');
  });

  it('resends the invitation, shows a success toast, and reloads the employee', async () => {
    const { fixture, apiStub, notificationsStub } = setup({ ...detailFixture, invitationStatus: 'expired' });
    await render(fixture);

    fixture.componentInstance.resendInvitation('emp-1');
    await fixture.whenStable();

    expect(apiStub.resendInvitation).toHaveBeenCalledWith('emp-1');
    expect(notificationsStub.success).toHaveBeenCalledWith('Invitation resent.');
    expect(apiStub.getEmployeeDetail).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.resending()).toBe(false);
  });

  it('shows an error toast and stops resending on failure', async () => {
    const { fixture, notificationsStub } = setup(
      { ...detailFixture, invitationStatus: 'expired' },
      { resendInvitation: vi.fn().mockReturnValue(throwError(() => new Error('failed'))) }
    );
    await render(fixture);

    fixture.componentInstance.resendInvitation('emp-1');
    await fixture.whenStable();

    expect(notificationsStub.error).toHaveBeenCalled();
    expect(fixture.componentInstance.resending()).toBe(false);
  });

  it('renders breadcrumb header and does not render Back to Employees link', async () => {
    const { fixture } = setup(detailFixture);
    await render(fixture);

    expect(fixture.nativeElement.querySelector('app-breadcrumb-header')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Back to Employees');
  });

  it('shows the employee name in the breadcrumb and profile header', async () => {
    const { fixture } = setup(detailFixture);
    await render(fixture);

    expect(fixture.nativeElement.querySelector('[data-testid="employee-name"]').textContent).toContain('Ada Lovelace');
    expect(fixture.nativeElement.textContent).toContain('Grace Hopper');
  });

  it('reloads the employee when the route id changes while the shell is reused', async () => {
    const params = new BehaviorSubject(convertToParamMap({ id: 'emp-1' }));
    const getEmployeeDetail = vi.fn((id: string) => of({ ...detailFixture, id }));
    const { fixture } = setup(detailFixture, { getEmployeeDetail }, true, 'emp-99', true, null, {
      paramMap: params.asObservable(),
      snapshot: { paramMap: params.value },
      firstChild: null
    });
    await render(fixture);

    params.next(convertToParamMap({ id: 'emp-2' }));
    await render(fixture);

    expect(getEmployeeDetail).toHaveBeenNthCalledWith(1, 'emp-1');
    expect(getEmployeeDetail).toHaveBeenNthCalledWith(2, 'emp-2');
    expect(fixture.componentInstance.employee()?.id).toBe('emp-2');
  });
  describe('with real child routes', () => {
    @Component({ standalone: true, template: 'tab content' })
    class TabStubComponent {}

    const routes: Routes = [
      {
        path: 'people/employees/:id',
        component: EmployeeDetailComponent,
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          { path: 'overview', component: EmployeeOverviewTabComponent },
          { path: 'personal', component: EmployeePersonalTabComponent },
          ...['employment', 'attendance', 'work-activity'].map((path) => ({ path, component: TabStubComponent }))
        ]
      }
    ];

    async function navigate(url: string) {
      setup(detailFixture, {}, true, 'emp-99', true, null, undefined, routes);
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url);
      await harness.fixture.whenStable();
      harness.detectChanges();
      return harness;
    }

    it('redirects to the Overview tab and links every tab under the employee route', async () => {
      const harness = await navigate('/people/employees/emp-1');

      expect(TestBed.inject(Router).url).toBe('/people/employees/emp-1/overview');
      const links = Array.from(harness.routeNativeElement!.querySelectorAll('[data-testid^="employee-tab-"]')) as HTMLAnchorElement[];
      expect(links.map((link) => link.textContent?.trim())).toEqual(['Overview', 'Employment', 'Attendance', 'Work & Activity', 'Personal']);
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/people/employees/emp-1/overview',
        '/people/employees/emp-1/employment',
        '/people/employees/emp-1/attendance',
        '/people/employees/emp-1/work-activity',
        '/people/employees/emp-1/personal'
      ]);
      expect(links[0].getAttribute('aria-current')).toBe('page');
      expect(harness.routeNativeElement!.querySelector('[data-testid="edit-employee"]')?.getAttribute('href'))
        .toBe('/people/employees/emp-1/employment?edit=job');
    });

    it('shows the period filter only on period-based tabs', async () => {
      const harness = await navigate('/people/employees/emp-1/overview');
      expect(harness.routeNativeElement!.querySelector('[data-testid="employee-period-filter"]')).toBeTruthy();

      await harness.navigateByUrl('/people/employees/emp-1/personal');
      harness.detectChanges();
      expect(harness.routeNativeElement!.querySelector('[data-testid="employee-period-filter"]')).toBeNull();
    });

    it('renders real tabs through the outlet with the shell-provided store', async () => {
      const harness = await navigate('/people/employees/emp-1/overview');
      const root = harness.routeNativeElement!;

      expect(root.textContent).toContain('Employment & Organization');
      const viewDetails = Array.from(root.querySelectorAll('a')).find((a) => a.textContent?.trim() === 'View details');
      expect(viewDetails?.getAttribute('href')).toBe('/people/employees/emp-1/employment');

      await harness.navigateByUrl('/people/employees/emp-1/personal');
      harness.detectChanges();
      expect(root.querySelector('app-employee-personal-info')).toBeTruthy();
      expect(root.querySelector('[data-testid="employee-tab-personal"]')?.getAttribute('aria-current')).toBe('page');
    });
  });
});
