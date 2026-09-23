import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProfileStore } from './profile.store';
import { ProfileApiService } from '../data-access/profile-api.service';
import { MyProfile } from '../models/profile.model';
import { FileApiService } from '../../../shared/data-access/file-api.service';

const sampleProfile: MyProfile = {
  personalInformation: {
    firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: null,
    dateOfBirth: null, gender: null, nationalityId: null, countryName: null,
    displayTimezone: null, legalEntityTimezone: null, avatarFileId: null, addresses: [], version: '1'
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
  let apiMock: { getMyProfile: ReturnType<typeof vi.fn>; linkAvatar: ReturnType<typeof vi.fn> };
  let fileApiMock: { upload: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = { getMyProfile: vi.fn(), linkAvatar: vi.fn() };
    fileApiMock = { upload: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        ProfileStore,
        { provide: ProfileApiService, useValue: apiMock },
        { provide: FileApiService, useValue: fileApiMock }
      ]
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

  it('uploads the avatar then refetches the profile so the resolved avatarFileId is used', async () => {
    apiMock.getMyProfile.mockReturnValueOnce(of(sampleProfile));
    await store.loadProfile();

    const updatedProfile = {
      ...sampleProfile,
      personalInformation: { ...sampleProfile.personalInformation, avatarFileId: 'new-file-id' }
    };
    fileApiMock.upload.mockReturnValue(of({
      fileId: 'new-file-id', originalFileName: 'avatar.png', fileSizeBytes: 1, contentType: 'image/png'
    }));
    apiMock.linkAvatar.mockReturnValue(of({ avatarFileId: 'new-file-id' }));
    apiMock.getMyProfile.mockReturnValueOnce(of(updatedProfile));

    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    const result = await store.uploadAvatar(file);

    expect(result).toBe(true);
    expect(fileApiMock.upload).toHaveBeenCalledWith(file, 'employee_avatar');
    expect(apiMock.linkAvatar).toHaveBeenCalledWith('new-file-id');
    expect(apiMock.getMyProfile).toHaveBeenCalledTimes(2);
    expect(store.profile()?.personalInformation.avatarFileId).toBe('new-file-id');
    expect(store.saving()).toBe(false);
  });

  it('sets saveError and does not refetch when the avatar upload fails', async () => {
    apiMock.getMyProfile.mockReturnValueOnce(of(sampleProfile));
    await store.loadProfile();

    fileApiMock.upload.mockReturnValue(throwError(() => new Error('Upload failed')));

    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    const result = await store.uploadAvatar(file);

    expect(result).toBe(false);
    expect(store.saveError()).toBe('Upload failed');
    expect(apiMock.linkAvatar).not.toHaveBeenCalled();
    expect(apiMock.getMyProfile).toHaveBeenCalledTimes(1);
  });
});
