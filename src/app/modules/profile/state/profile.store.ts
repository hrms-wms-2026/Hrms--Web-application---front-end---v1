import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ProfileApiService } from '../data-access/profile-api.service';
import {
  EmployeeDocument,
  MyProfile,
  UploadEmployeeDocumentRequest,
  UpdateBankDetailsRequest,
  UpdatePersonalInformationRequest,
  UpsertDependentRequest,
  UpsertEmergencyContactRequest
} from '../models/profile.model';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { ApiError, toApiError } from '../../../core/errors/api-error';
import { FileApiService } from '../../../shared/data-access/file-api.service';

/** Which profile panel the last failed save came from, so only that panel shows its server error (task 20). */
export type ProfileSaveTarget = 'personal' | 'emergencyContact' | 'dependent' | 'payroll';

function withoutKey(errors: Partial<Record<ProfileSaveTarget, ApiError>>, key: ProfileSaveTarget): Partial<Record<ProfileSaveTarget, ApiError>> {
  const rest = { ...errors };
  delete rest[key];
  return rest;
}

export interface ProfileState {
  readonly profile: MyProfile | null;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
  readonly saveError: string | null;
  /** The last refused save of each panel, so two panels saving together keep both errors (task 20). */
  readonly saveErrors: Partial<Record<ProfileSaveTarget, ApiError>>;
  readonly documents: EmployeeDocument[];
  readonly documentsLoading: boolean;
  readonly documentsError: string | null;
  readonly uploadingDocument: boolean;
  readonly documentError: string | null;
}

const initialState: ProfileState = {
  profile: null,
  loading: false,
  saving: false,
  error: null,
  saveError: null,
  saveErrors: {},
  documents: [],
  documentsLoading: false,
  documentsError: null,
  uploadingDocument: false,
  documentError: null
};

export const ProfileStore = signalStore(
  { providedIn: 'root' },
  withState<ProfileState>(initialState),
  withMethods((store, api = inject(ProfileApiService), fileApi = inject(FileApiService)) => ({
    /** Drops the last failed save so a panel shown again starts clean. */
    clearSaveError(): void {
      patchState(store, { saveError: null, saveErrors: {} });
    },

    async loadProfile(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const profile = await firstValueFrom(api.getMyProfile());
        patchState(store, { profile, loading: false });
      } catch (err) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load profile.') });
      }
    },

    async savePersonalInformation(payload: UpdatePersonalInformationRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null, saveErrors: withoutKey(store.saveErrors(), 'personal') });
      try {
        await firstValueFrom(api.updatePersonalInformation(payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        const apiError = toApiError(err, 'Failed to save personal information.');
        patchState(store, { saving: false, saveError: apiError.message, saveErrors: { ...store.saveErrors(), personal: apiError } });
        return false;
      }
    },

    async uploadAvatar(file: File): Promise<boolean> {
      patchState(store, { saving: true, saveError: null, saveErrors: withoutKey(store.saveErrors(), 'personal') });
      try {
        const uploaded = await firstValueFrom(fileApi.upload(file, 'employee_avatar'));
        await firstValueFrom(api.linkAvatar(uploaded.fileId));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        const apiError = toApiError(err, 'Failed to upload avatar.');
        patchState(store, { saving: false, saveError: apiError.message, saveErrors: { ...store.saveErrors(), personal: apiError } });
        return false;
      }
    },

    async removeAvatar(): Promise<boolean> {
      patchState(store, { saving: true, saveError: null, saveErrors: withoutKey(store.saveErrors(), 'personal') });
      try {
        await firstValueFrom(api.removeAvatar());
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        const apiError = toApiError(err, 'Failed to remove photo.');
        patchState(store, { saving: false, saveError: apiError.message, saveErrors: { ...store.saveErrors(), personal: apiError } });
        return false;
      }
    },

    async addEmergencyContact(payload: UpsertEmergencyContactRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null, saveErrors: withoutKey(store.saveErrors(), 'emergencyContact') });
      try {
        await firstValueFrom(api.addEmergencyContact(payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        const apiError = toApiError(err, 'Failed to add emergency contact.');
        patchState(store, { saving: false, saveError: apiError.message, saveErrors: { ...store.saveErrors(), emergencyContact: apiError } });
        return false;
      }
    },

    async updateEmergencyContact(id: string, payload: UpsertEmergencyContactRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null, saveErrors: withoutKey(store.saveErrors(), 'emergencyContact') });
      try {
        await firstValueFrom(api.updateEmergencyContact(id, payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        const apiError = toApiError(err, 'Failed to update emergency contact.');
        patchState(store, { saving: false, saveError: apiError.message, saveErrors: { ...store.saveErrors(), emergencyContact: apiError } });
        return false;
      }
    },

    async removeEmergencyContact(id: string): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.deleteEmergencyContact(id));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to remove emergency contact.') });
        return false;
      }
    },

    async addDependent(payload: UpsertDependentRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null, saveErrors: withoutKey(store.saveErrors(), 'dependent') });
      try {
        await firstValueFrom(api.addDependent(payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        const apiError = toApiError(err, 'Failed to add dependent.');
        patchState(store, { saving: false, saveError: apiError.message, saveErrors: { ...store.saveErrors(), dependent: apiError } });
        return false;
      }
    },

    async updateDependent(id: string, payload: UpsertDependentRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null, saveErrors: withoutKey(store.saveErrors(), 'dependent') });
      try {
        await firstValueFrom(api.updateDependent(id, payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        const apiError = toApiError(err, 'Failed to update dependent.');
        patchState(store, { saving: false, saveError: apiError.message, saveErrors: { ...store.saveErrors(), dependent: apiError } });
        return false;
      }
    },

    async removeDependent(id: string): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.deleteDependent(id));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to remove dependent.') });
        return false;
      }
    },

    async savePayroll(payload: UpdateBankDetailsRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null, saveErrors: withoutKey(store.saveErrors(), 'payroll') });
      try {
        await firstValueFrom(api.updatePayroll(payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        const apiError = toApiError(err, 'Failed to save payroll details.');
        patchState(store, { saving: false, saveError: apiError.message, saveErrors: { ...store.saveErrors(), payroll: apiError } });
        return false;
      }
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.changePassword(currentPassword, newPassword));
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to change password.') });
        return false;
      }
    },

    async enableMfa(): Promise<{ secret: string; qrCodeUri: string } | null> {
      patchState(store, { saving: true, saveError: null });
      try {
        const result = await firstValueFrom(api.enableMfa());
        patchState(store, { saving: false });
        return result;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to start MFA setup.') });
        return null;
      }
    },

    async confirmMfaSetup(code: string): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.confirmMfaSetup(code));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Invalid verification code.') });
        return false;
      }
    },

    async loadDocuments(): Promise<void> {
      patchState(store, { documentsLoading: true, documentsError: null });
      try {
        const documents = await firstValueFrom(api.listDocuments());
        patchState(store, { documents, documentsLoading: false });
      } catch (err) {
        patchState(store, { documentsLoading: false, documentsError: toSafeErrorMessage(err, 'Failed to load documents.') });
      }
    },

    /** Two steps like the avatar: upload the file, then link it to the caller's documents. */
    async uploadDocument(request: UploadEmployeeDocumentRequest): Promise<boolean> {
      patchState(store, { uploadingDocument: true, documentError: null });
      try {
        const uploaded = await firstValueFrom(fileApi.upload(request.file, 'employee_document'));
        const document = await firstValueFrom(api.addDocument(uploaded.fileId, request.type, request.name));
        patchState(store, { uploadingDocument: false, documents: [document, ...store.documents()] });
        return true;
      } catch (err) {
        patchState(store, { uploadingDocument: false, documentError: toSafeErrorMessage(err, 'Failed to upload document.') });
        return false;
      }
    },

    async deleteDocument(id: string): Promise<boolean> {
      patchState(store, { documentError: null });
      try {
        await firstValueFrom(api.deleteDocument(id));
        patchState(store, { documents: store.documents().filter((d) => d.id !== id) });
        return true;
      } catch (err) {
        patchState(store, { documentError: toSafeErrorMessage(err, 'Failed to delete document.') });
        return false;
      }
    },

    async downloadDocument(document: EmployeeDocument): Promise<Blob | null> {
      patchState(store, { documentError: null });
      try {
        return await firstValueFrom(fileApi.download(document.fileId));
      } catch (err) {
        patchState(store, { documentError: toSafeErrorMessage(err, `Failed to open ${document.name}.`) });
        return null;
      }
    },

    clearDocumentError(): void {
      patchState(store, { documentError: null });
    },

    async disableMfa(currentPassword: string): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.disableMfa(currentPassword));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to disable MFA.') });
        return false;
      }
    }
  }))
);
