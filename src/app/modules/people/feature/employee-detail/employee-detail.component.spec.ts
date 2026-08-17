import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { EmployeeDetailComponent } from './employee-detail.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { PositionApiService } from '../../../organization/data-access/position-api.service';

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
      probationEndDate: null
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
    invitationExpiresAt: null
  };

  function setup(employee: EmployeeDetailResponse, apiOverrides: Partial<PeopleApiService> = {}) {
    const apiStub = {
      getEmployeeDetail: vi.fn().mockReturnValue(of(employee)),
      resendInvitation: vi.fn().mockReturnValue(of({ expiresAt: '2026-08-25T00:00:00Z' })),
      changePosition: vi.fn().mockReturnValue(of(undefined)),
      ...apiOverrides
    };
    const notificationsStub = { success: vi.fn(), error: vi.fn() };
    // The Change Position modal (Task 4) fetches positions for the legal entity as soon as it
    // opens; stub it out so opening the modal in these tests never issues a real HTTP request.
    const positionApiStub = { listFlat: vi.fn().mockReturnValue(of({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 })) };

    TestBed.configureTestingModule({
      imports: [EmployeeDetailComponent],
      providers: [
        provideRouter([]),
        { provide: PeopleApiService, useValue: apiStub },
        { provide: NotificationService, useValue: notificationsStub },
        { provide: PositionApiService, useValue: positionApiStub },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'emp-1' } } } }
      ]
    });

    const fixture = TestBed.createComponent(EmployeeDetailComponent);
    return { fixture, apiStub, notificationsStub };
  }

  it('shows the loader while the employee is loading', () => {
    const subject = new Subject<EmployeeDetailResponse>();
    const { fixture } = setup(detailFixture, { getEmployeeDetail: vi.fn().mockReturnValue(subject.asObservable()) });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading employee');

    subject.next(detailFixture);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Loading employee');
  });

  it('shows the error state with a retry action that reissues the request', () => {
    const getEmployeeDetail = vi.fn()
      .mockReturnValueOnce(throwError(() => new Error('boom')))
      .mockReturnValueOnce(of(detailFixture));
    const { fixture } = setup(detailFixture, { getEmployeeDetail });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('boom');

    const retryButton: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
    retryButton?.click();
    fixture.detectChanges();

    expect(getEmployeeDetail).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
  });

  it('renders the Job Information, Personal Information, and Emergency Contacts sections once loaded', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-employee-job-info')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-personal-info')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-emergency-contacts')).toBeTruthy();
  });

  it('renders the Payroll section when the response includes it', () => {
    const { fixture } = setup({
      ...detailFixture,
      payroll: { hasBankDetailsOnFile: true, bankName: 'Test Bank', maskedAccountNumber: '****1234', accountType: 'checking' }
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-employee-payroll')).toBeTruthy();
  });

  it('omits the Payroll section when the response does not include it', () => {
    const { fixture } = setup({ ...detailFixture, payroll: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-employee-payroll')).toBeFalsy();
  });

  it('shows a Change Position button and opens the modal when the employee has a legal entity', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const changePositionButton = buttons.find((b) => b.textContent?.includes('Change Position'));
    expect(changePositionButton).toBeTruthy();

    expect(fixture.componentInstance.changePositionOpen()).toBe(false);
    changePositionButton?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.changePositionOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('app-change-position-modal')).toBeTruthy();
  });

  it('does not render a Change Position control when the employee has no legal entity', () => {
    const { fixture } = setup({
      ...detailFixture,
      jobInformation: { ...detailFixture.jobInformation, legalEntityId: null }
    });
    fixture.detectChanges();

    const buttons: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const changePositionButton = buttons.find((b) => b.textContent?.includes('Change Position'));
    expect(changePositionButton).toBeFalsy();
  });

  it('reloads and shows a success toast when the position is changed', () => {
    const { fixture, apiStub, notificationsStub } = setup(detailFixture);
    fixture.detectChanges();
    fixture.componentInstance.changePositionOpen.set(true);
    fixture.detectChanges();

    fixture.componentInstance.onPositionChanged();

    expect(fixture.componentInstance.changePositionOpen()).toBe(false);
    expect(notificationsStub.success).toHaveBeenCalledWith('Position updated.');
    expect(apiStub.getEmployeeDetail).toHaveBeenCalledTimes(2);
  });

  it('does not show the resend button when the invitation is pending', () => {
    const { fixture } = setup({ ...detailFixture, invitationStatus: 'pending' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Resend invitation');
  });

  it('does not show the resend button when the invitation was accepted', () => {
    const { fixture } = setup({ ...detailFixture, invitationStatus: 'accepted' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Resend invitation');
  });

  it('does not show the resend button when no invitation was ever issued', () => {
    const { fixture } = setup({ ...detailFixture, invitationStatus: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Resend invitation');
  });

  it('shows the resend button only when the invitation expired unaccepted', () => {
    const { fixture } = setup({ ...detailFixture, invitationStatus: 'expired' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Resend invitation');
  });

  it('resends the invitation, shows a success toast, and reloads the employee', async () => {
    const { fixture, apiStub, notificationsStub } = setup({ ...detailFixture, invitationStatus: 'expired' });
    fixture.detectChanges();

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
    fixture.detectChanges();

    fixture.componentInstance.resendInvitation('emp-1');
    await fixture.whenStable();

    expect(notificationsStub.error).toHaveBeenCalled();
    expect(fixture.componentInstance.resending()).toBe(false);
  });
});
