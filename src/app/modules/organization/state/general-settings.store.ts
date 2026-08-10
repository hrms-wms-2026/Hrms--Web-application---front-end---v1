import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { LegalEntityApiService } from '../data-access/legal-entity-api.service';
import { LegalEntityGeneralSettings, UpdateLegalEntityGeneralSettingsRequest } from '../models/legal-entity.model';

export interface GeneralSettingsState {
  readonly legalEntityId: string | null;
  readonly settings: LegalEntityGeneralSettings | null;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly uploadingLogo: boolean;
  readonly removingLogo: boolean;
  readonly loadError: string | null;
  readonly saveError: string | null;
}

const initialState: GeneralSettingsState = {
  legalEntityId: null,
  settings: null,
  loading: false,
  saving: false,
  uploadingLogo: false,
  removingLogo: false,
  loadError: null,
  saveError: null
};

import { toSafeErrorMessage } from '../../../core/services/error-handler.service';

/**
 * Holds the loaded General Settings detail for one company at a time, kept
 * deliberately separate from LegalEntityStore's selection/list state so a
 * company switch can clear form-related state without touching the selector.
 */
export const GeneralSettingsStore = signalStore(
  { providedIn: 'root' },
  withState<GeneralSettingsState>(initialState),
  withMethods((store, api = inject(LegalEntityApiService)) => ({
    async load(legalEntityId: string): Promise<void> {
      // Reset immediately so a prior company's fields never render while the new company loads.
      patchState(store, { ...initialState, legalEntityId, loading: true });
      try {
        const settings = await firstValueFrom(api.getGeneralSettings(legalEntityId));
        if (store.legalEntityId() !== legalEntityId) {
          return; // selection moved on again before this resolved - drop it
        }
        patchState(store, { settings, loading: false });
      } catch (err) {
        if (store.legalEntityId() !== legalEntityId) {
          return;
        }
        patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load General Settings.') });
      }
    },

    clear(): void {
      patchState(store, initialState);
    },

    async save(
      legalEntityId: string,
      payload: UpdateLegalEntityGeneralSettingsRequest
    ): Promise<LegalEntityGeneralSettings | null> {
      patchState(store, { saving: true, saveError: null });
      try {
        const settings = await firstValueFrom(api.updateGeneralSettings(legalEntityId, payload));
        if (store.legalEntityId() === legalEntityId) {
          patchState(store, { settings, saving: false });
        }
        return settings;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to save General Settings.') });
        return null;
      }
    },

    async uploadLogo(legalEntityId: string, file: File): Promise<boolean> {
      patchState(store, { uploadingLogo: true, saveError: null });
      try {
        const result = await firstValueFrom(api.uploadLogo(legalEntityId, file));
        const current = store.settings();
        if (current && store.legalEntityId() === legalEntityId) {
          patchState(store, { settings: { ...current, logoFileId: result.logoFileId }, uploadingLogo: false });
        } else {
          patchState(store, { uploadingLogo: false });
        }
        return true;
      } catch (err) {
        patchState(store, { uploadingLogo: false, saveError: toSafeErrorMessage(err, 'Failed to upload logo.') });
        return false;
      }
    },

    async removeLogo(legalEntityId: string): Promise<boolean> {
      patchState(store, { removingLogo: true, saveError: null });
      try {
        await firstValueFrom(api.removeLogo(legalEntityId));
        const current = store.settings();
        if (current && store.legalEntityId() === legalEntityId) {
          patchState(store, { settings: { ...current, logoFileId: null }, removingLogo: false });
        } else {
          patchState(store, { removingLogo: false });
        }
        return true;
      } catch (err) {
        patchState(store, { removingLogo: false, saveError: toSafeErrorMessage(err, 'Failed to remove logo.') });
        return false;
      }
    }
  }))
);
