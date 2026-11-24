import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProfileStore } from './profile.store';
import { ProfileApiService } from '../data-access/profile-api.service';
import { EmployeeDocument, MyProfile } from '../models/profile.model';
import { FileApiService } from '../../../shared/data-access/file-api.service';
import { HttpErrorResponse } from '@angular/common/http';

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
  let apiMock: {
    getMyProfile: ReturnType<typeof vi.fn>;
    linkAvatar: ReturnType<typeof vi.fn>;
    removeAvatar: ReturnType<typeof vi.fn>;
    listDocuments: ReturnType<typeof vi.fn>;
    addDocument: ReturnType<typeof vi.fn>;
    deleteDocument: ReturnType<typeof vi.fn>;
  };
  let fileApiMock: { upload: ReturnType<typeof vi.fn>; download: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = { getMyProfile: vi.fn(), linkAvatar: vi.fn(), removeAvatar: vi.fn(), listDocuments: vi.fn(), addDocument: vi.fn(), deleteDocument: vi.fn(), addDependent: vi.fn(), addEmergencyContact: vi.fn() } as typeof apiMock;
    fileApiMock = { upload: vi.fn(), download: vi.fn() };
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

  it('removes the avatar then refetches the profile', async () => {
    const withAvatar = {
      ...sampleProfile,
      personalInformation: { ...sampleProfile.personalInformation, avatarFileId: 'old-file-id' }
    };
    apiMock.getMyProfile.mockReturnValueOnce(of(withAvatar));
    await store.loadProfile();

    apiMock.removeAvatar.mockReturnValue(of(undefined));
    apiMock.getMyProfile.mockReturnValueOnce(of(sampleProfile));

    const result = await store.removeAvatar();

    expect(result).toBe(true);
    expect(apiMock.removeAvatar).toHaveBeenCalled();
    expect(store.profile()?.personalInformation.avatarFileId).toBeNull();
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

  describe('documents', () => {
    const doc = (id: string, name = 'My Resume'): EmployeeDocument => ({
      id, fileId: `file-${id}`, name, documentType: 'cv', fileName: `${name}.pdf`,
      contentType: 'application/pdf', fileSizeBytes: 1000, uploadedAt: '2026-10-15T00:00:00Z'
    });

    it('loads documents', async () => {
      apiMock.listDocuments.mockReturnValue(of([doc('a')]));
      await store.loadDocuments();

      expect(store.documents().map((d) => d.id)).toEqual(['a']);
      expect(store.documentsLoading()).toBe(false);
    });

    it('uploads with the employee_document purpose, links it, and prepends the result', async () => {
      apiMock.listDocuments.mockReturnValue(of([doc('a')]));
      await store.loadDocuments();
      fileApiMock.upload.mockReturnValue(of({ fileId: 'f1', originalFileName: 'cv.pdf', fileSizeBytes: 1, contentType: 'application/pdf' }));
      apiMock.addDocument.mockReturnValue(of(doc('b', 'New CV')));

      const file = new File(['x'], 'cv.pdf', { type: 'application/pdf' });
      const ok = await store.uploadDocument({ file, type: 'cv', name: 'New CV' });

      expect(ok).toBe(true);
      expect(fileApiMock.upload).toHaveBeenCalledWith(file, 'employee_document');
      expect(apiMock.addDocument).toHaveBeenCalledWith('f1', 'cv', 'New CV');
      expect(store.documents().map((d) => d.id)).toEqual(['b', 'a']);
      expect(store.uploadingDocument()).toBe(false);
    });

    it('keeps the list and reports an error when linking fails', async () => {
      fileApiMock.upload.mockReturnValue(of({ fileId: 'f1', originalFileName: 'cv.pdf', fileSizeBytes: 1, contentType: 'application/pdf' }));
      apiMock.addDocument.mockReturnValue(throwError(() => new Error('Nope')));

      const ok = await store.uploadDocument({ file: new File(['x'], 'cv.pdf'), type: 'cv', name: '' });

      expect(ok).toBe(false);
      expect(store.documentError()).toBe('Nope');
      expect(store.documents()).toEqual([]);
    });

    it('removes a deleted document from the list', async () => {
      apiMock.listDocuments.mockReturnValue(of([doc('a'), doc('b')]));
      await store.loadDocuments();
      apiMock.deleteDocument.mockReturnValue(of(undefined));

      await store.deleteDocument('a');

      expect(apiMock.deleteDocument).toHaveBeenCalledWith('a');
      expect(store.documents().map((d) => d.id)).toEqual(['b']);
    });
  });

  describe('server errors for the panels (task 20 follow-up)', () => {
    const badRequest = (errors: Record<string, string[]>) =>
      throwError(() => new HttpErrorResponse({ status: 400, error: { title: 'Validation Error', errors } }));

    it('keeps a refused save as an ApiError tagged with the panel that saved', async () => {
      (apiMock as unknown as { addDependent: ReturnType<typeof vi.fn> }).addDependent.mockReturnValue(badRequest({ Name: ['Name is too long.'] }));
      await store.addDependent({ name: 'x', relationship: 'child', dateOfBirth: '2020-01-01', phone: null } as never);
      expect(store.saveErrors().dependent?.fieldErrors).toEqual({ Name: ['Name is too long.'] });
      expect(store.saveErrors().emergencyContact).toBeUndefined();
    });

    it('keeps both errors when the emergency footer saves a contact and a dependent and both are refused', async () => {
      const mocks = apiMock as unknown as { addDependent: ReturnType<typeof vi.fn>; addEmergencyContact: ReturnType<typeof vi.fn> };
      mocks.addDependent.mockReturnValue(badRequest({ Name: ['Dependent name is too long.'] }));
      mocks.addEmergencyContact.mockReturnValue(badRequest({ Phone: ['Phone is too long.'] }));
      await Promise.all([
        store.addEmergencyContact({ name: 'a', relationship: 'b', phone: '1', email: null, isPrimary: true } as never),
        store.addDependent({ name: 'x', relationship: 'child', dateOfBirth: '2020-01-01', phone: null } as never),
      ]);
      expect(store.saveErrors().emergencyContact?.fieldErrors).toEqual({ Phone: ['Phone is too long.'] });
      expect(store.saveErrors().dependent?.fieldErrors).toEqual({ Name: ['Dependent name is too long.'] });
    });

    it('files a failed avatar change under personal, so the personal banner shows it', async () => {
      fileApiMock.upload.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'Only JPG or PNG images are allowed.' } })));
      await store.uploadAvatar(new File(['x'], 'a.gif', { type: 'image/gif' }));
      expect(store.saveErrors().personal?.message).toBe('Only JPG or PNG images are allowed.');
    });

    it('clears it when the next save starts and on clearSaveError', async () => {
      const mocks = apiMock as unknown as { addDependent: ReturnType<typeof vi.fn>; addEmergencyContact: ReturnType<typeof vi.fn> };
      mocks.addDependent.mockReturnValue(badRequest({ Name: ['Name is too long.'] }));
      await store.addDependent({ name: 'x', relationship: 'child', dateOfBirth: '2020-01-01', phone: null } as never);
      store.clearSaveError();
      expect(store.saveErrors()).toEqual({});
    });
  });
});
