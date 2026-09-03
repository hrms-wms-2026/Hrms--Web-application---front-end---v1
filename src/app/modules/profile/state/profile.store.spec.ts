import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProfileStore } from './profile.store';
import { ProfileApiService } from '../data-access/profile-api.service';
import { MyProfile } from '../models/profile.model';

const sampleProfile: MyProfile = {
  personalInformation: {
    firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: null,
    dateOfBirth: null, gender: null, nationalityId: null, countryName: null,
    displayTimezone: null, legalEntityTimezone: null, avatarUrl: null, addresses: [], version: '1'
  },
  jobInformation: {
    employeeNumber: 'EMP-001', legalEntityName: 'Acme', departmentName: null, positionName: null,
    reportingManagerName: null, employmentTypeLabel: 'Full-time', employmentStatus: 'active',
    hireDate: '2024-01-01', probationEndDate: null, workMode: 'onsite'
  },
  emergencyContacts: [],
  dependents: [],
  payroll: { hasBankDetailsOnFile: false, bankName: null, maskedAccountNumber: null, accountType: null, canEdit: false },
  security: { mfaEnabled: false, lastPasswordChangedAt: null }
};

describe('ProfileStore', () => {
  let store: InstanceType<typeof ProfileStore>;
  let apiMock: { getMyProfile: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = { getMyProfile: vi.fn() };
    TestBed.configureTestingModule({
      providers: [ProfileStore, { provide: ProfileApiService, useValue: apiMock }]
    });
    store = TestBed.inject(ProfileStore);
  });

  it('loads the profile successfully', async () => {
    apiMock.getMyProfile.mockReturnValue(of(sampleProfile));
    await store.loadProfile();

    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.profile()?.personalInformation.firstName).toBe('Jane');
  });

  it('sets error state on load failure', async () => {
    apiMock.getMyProfile.mockReturnValue(throwError(() => new Error('Network error')));
    await store.loadProfile();

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Failed to load profile.');
    expect(store.profile()).toBeNull();
  });
});
