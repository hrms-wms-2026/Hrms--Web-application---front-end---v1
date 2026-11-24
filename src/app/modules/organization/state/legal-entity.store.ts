import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { LegalEntityApiService } from '../data-access/legal-entity-api.service';
import { CreateLegalEntityRequest, LegalEntityListItem } from '../models/legal-entity.model';

export const SELECTED_LEGAL_ENTITY_STORAGE_KEY = 'crownus.selected_legal_entity_id';

export interface LegalEntityState {
  readonly companies: readonly LegalEntityListItem[];
  readonly selectedLegalEntityId: string | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly loaded: boolean;
  readonly saving: boolean;
  readonly createError: string | null;
  /** The last failed create/update as an ApiError, so the form can show field errors (task 20). */
  readonly createApiError: ApiError | null;
  readonly switchError: string | null;
}

import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { ApiError, toApiError } from '../../../core/errors/api-error';

export const LegalEntityStore = signalStore(
  { providedIn: 'root' },
  withState<LegalEntityState>({
    companies: [],
    selectedLegalEntityId: null,
    loading: false,
    error: null,
    loaded: false,
    saving: false,
    createError: null, createApiError: null,
    switchError: null
  }),
  withComputed(({ companies, selectedLegalEntityId }) => ({
    selectedLegalEntity: computed(() => {
      const id = selectedLegalEntityId();
      if (!id) {
        return null;
      }
      return companies().find((c) => c.id === id) ?? null;
    }),
    activeCompanies: computed(() => companies().filter((c) => c.isActive)),
    otherCompanies: computed(() => {
      const selectedId = selectedLegalEntityId();
      return companies().filter((c) => c.id !== selectedId);
    })
  })),
  withMethods((store, api = inject(LegalEntityApiService), authStore = inject(AuthStore)) => ({
    async loadCompanies(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const companies = await firstValueFrom(api.getAccessibleCompanies());

        let validId: string | null = null;
        const savedId = localStorage.getItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY);

        if (savedId && companies.some((c) => c.id === savedId)) {
          validId = savedId;
        } else if (companies.length > 0) {
          const primary = companies.find((c) => c.isPrimary);
          validId = primary ? primary.id : companies[0].id;
        }

        if (validId) {
          localStorage.setItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY, validId);
        } else {
          localStorage.removeItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY);
        }

        patchState(store, {
          companies,
          selectedLegalEntityId: validId,
          loading: false,
          loaded: true
        });
      } catch (err: unknown) {
        const trayLocked = err instanceof HttpErrorResponse && err.status === 428;
        patchState(store, {
          error: trayLocked ? null : toSafeErrorMessage(err, 'Failed to load companies list.'),
          loading: false,
          loaded: trayLocked ? false : true
        });
      }
    },

    async selectCompany(legalEntityId: string): Promise<boolean> {
      const company = store.companies().find((c) => c.id === legalEntityId);
      if (!company) {
        patchState(store, { switchError: 'The selected company is not available.' });
        return false;
      }

      patchState(store, { switchError: null });
      try {
        await firstValueFrom(api.switchActiveCompany(legalEntityId));
        await authStore.checkSession();
      } catch (err: unknown) {
        patchState(store, { switchError: toSafeErrorMessage(err, 'Unable to switch company.') });
        return false;
      }

      localStorage.setItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY, legalEntityId);
      patchState(store, { selectedLegalEntityId: legalEntityId });
      return true;
    },

    updateCompanyDisplay(
      legalEntityId: string,
      changes: { name: string; companyCode: string | null; isActive: boolean }
    ): void {
      patchState(store, {
        companies: store.companies().map((c) => (c.id === legalEntityId ? { ...c, ...changes } : c))
      });
    },

    async createCompany(payload: CreateLegalEntityRequest): Promise<boolean> {
      if (store.saving()) {
        return false;
      }
      patchState(store, { saving: true, createError: null, createApiError: null });
      try {
        await firstValueFrom(api.createLegalEntity(payload));
        patchState(store, { saving: false });
        await this.loadCompanies();
        return true;
      } catch (err) {
        const apiError = toApiError(err, 'Failed to create company.');
        patchState(store, { saving: false, createError: apiError.message, createApiError: apiError });
        return false;
      }
    }
  }))
);
