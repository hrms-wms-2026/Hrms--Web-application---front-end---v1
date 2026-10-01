import { TestBed } from '@angular/core/testing';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { EmployeePersonalTabComponent } from './personal-tab.component';

describe('EmployeePersonalTabComponent', () => {
  const employee: EmployeeDetailResponse = {
    id: 'emp-1',
    jobInformation: {
      employeeNumber: 'E-001', legalEntityId: 'le-1', legalEntityName: 'Acme Corp', departmentName: null,
      positionName: null, positionId: null, reportingManagerName: null, employmentTypeLabel: 'Full time',
      status: 'active', hireDate: '2024-01-15', probationEndDate: null, workModeLabel: null,
      employmentTypeCode: 'full_time', workModeId: null
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

  function render(e: EmployeeDetailResponse) {
    TestBed.configureTestingModule({ imports: [EmployeePersonalTabComponent] });
    const fixture = TestBed.createComponent(EmployeePersonalTabComponent);
    fixture.componentRef.setInput('employee', e);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders personal information and emergency contacts', () => {
    const el = render(employee);

    expect(el.querySelector('app-employee-personal-info')).toBeTruthy();
    expect(el.querySelector('app-employee-emergency-contacts')).toBeTruthy();
  });

  it('renders payroll only when the response includes it', () => {
    expect(render(employee).querySelector('app-employee-payroll')).toBeFalsy();

    TestBed.resetTestingModule();
    const withPayroll = render({
      ...employee,
      payroll: { hasBankDetailsOnFile: true, bankName: 'Test Bank', maskedAccountNumber: '****1234', accountType: 'checking' }
    });
    expect(withPayroll.querySelector('app-employee-payroll')).toBeTruthy();
  });
});
