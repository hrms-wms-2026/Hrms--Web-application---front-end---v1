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
  readonly loadError: string | null;
  readonly saveError: string | null;
}

const initialState: GeneralSettingsState = {
  legalEntityId: null,
  settings: null,
  loading: false,
  saving: false,
  loadError: null,
  saveError: null
};

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const body = (err as { error?: { detail?: string; title?: string; message?: string; errors?: Record<string, string[] | string> } }).error;
    if (body?.detail) return body.detail;
    if (body?.message) return body.message;
    if (body?.title && body.title !== 'One or more validation errors occurred.') return body.title;
    if (body?.errors) {
      const firstKey = Object.keys(body.errors)[0];
      if (firstKey && body.errors[firstKey]) {
        const val = body.errors[firstKey];
        return Array.isArray(val) ? val[0] : val;
      }
    }
  }
  return fallback;
}

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
        patchState(store, { loading: false, loadError: extractErrorMessage(err, 'Failed to load General Settings.') });
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
        patchState(store, { saving: false, saveError: extractErrorMessage(err, 'Failed to save General Settings.') });
        return null;
      }
    }
  }))
);
