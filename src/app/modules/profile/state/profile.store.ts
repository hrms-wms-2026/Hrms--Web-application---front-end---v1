import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ProfileApiService } from '../data-access/profile-api.service';
import {
  MyProfile,
  UpdateBankDetailsRequest,
  UpdatePersonalInformationRequest,
  UpsertDependentRequest,
  UpsertEmergencyContactRequest
} from '../models/profile.model';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';

export interface ProfileState {
  readonly profile: MyProfile | null;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
  readonly saveError: string | null;
}

const initialState: ProfileState = {
  profile: null,
  loading: false,
  saving: false,
  error: null,
  saveError: null
};

export const ProfileStore = signalStore(
  { providedIn: 'root' },
  withState<ProfileState>(initialState),
  withMethods((store, api = inject(ProfileApiService)) => ({
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
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.updatePersonalInformation(payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to save personal information.') });
        return false;
      }
    },

    async uploadAvatar(file: File): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.uploadAvatar(file));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to upload avatar.') });
        return false;
      }
    },

    async addEmergencyContact(payload: UpsertEmergencyContactRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.addEmergencyContact(payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to add emergency contact.') });
        return false;
      }
    },

    async updateEmergencyContact(id: string, payload: UpsertEmergencyContactRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.updateEmergencyContact(id, payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to update emergency contact.') });
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
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.addDependent(payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to add dependent.') });
        return false;
      }
    },

    async updateDependent(id: string, payload: UpsertDependentRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.updateDependent(id, payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to update dependent.') });
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
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.updatePayroll(payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to save payroll details.') });
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
