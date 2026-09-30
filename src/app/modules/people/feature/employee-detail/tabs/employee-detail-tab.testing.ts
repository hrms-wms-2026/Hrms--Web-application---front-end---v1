import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotificationService } from '../../../../../core/services/notification.service';
import { PeopleApiService } from '../../../data-access/people-api.service';
import { EmployeeDetailResponse } from '../../../models/employee.model';
import { EmployeeDetailStore } from '../../../state/employee-detail.store';
import { EmployeeInsightsStore } from '../../../state/employee-insights.store';

export const detailFixture: EmployeeDetailResponse = {
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

/**
 * Configures TestBed with a real EmployeeDetailStore over the given PeopleApiService stub and
 * loads the fixture employee. Stubs are created by the caller (this file is also part of the
 * app compilation, so it cannot reference Vitest globals).
 */
export async function setupTabTestBed(
  employeeId: string,
  apiStub: Partial<Record<keyof PeopleApiService, unknown>>,
  notificationsStub: Partial<Record<keyof NotificationService, unknown>>,
  providers: unknown[] = []
): Promise<InstanceType<typeof EmployeeDetailStore>> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      EmployeeDetailStore,
      EmployeeInsightsStore,
      { provide: PeopleApiService, useValue: apiStub },
      { provide: NotificationService, useValue: notificationsStub },
      ...(providers as never[])
    ]
  });

  const store = TestBed.inject(EmployeeDetailStore);
  await store.load(employeeId);
  return store;
}
