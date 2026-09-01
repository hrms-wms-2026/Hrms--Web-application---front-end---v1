import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { MonitoringApiService } from '../data-access/monitoring-api.service';
import {
  MonitoringFeatureToggles,
  MonitoringFeatureTogglesRequest,
  MonitoringPolicyOverride,
  MonitoringPolicyOverrideRequest,
  MonitoringScopeType
} from '../models/monitoring.model';

interface MonitoringState {
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
  readonly saveError: string | null;
  readonly companyDefault: MonitoringFeatureToggles | null;
  readonly overrides: readonly MonitoringPolicyOverride[];
  readonly hasActiveCompanyContext: boolean;
  readonly selectedScope: MonitoringScopeType;
}

const initialState: MonitoringState = {
  loading: false,
  saving: false,
  error: null,
  saveError: null,
  companyDefault: null,
  overrides: [],
  hasActiveCompanyContext: true,
  selectedScope: 'department'
};

export const MonitoringStore = signalStore(
  { providedIn: 'root' },
  withState<MonitoringState>(initialState),
  withMethods((store, api = inject(MonitoringApiService)) => ({
    selectScope(selectedScope: MonitoringScopeType): void {
      patchState(store, { selectedScope });
    },

    async loadFresh(): Promise<void> {
      const policy = await firstValueFrom(api.getPolicy());
      patchState(store, {
        companyDefault: policy.companyDefault,
        overrides: policy.overrides,
        hasActiveCompanyContext: policy.hasActiveCompanyContext
      });
    },

    async load(): Promise<void> {
      if (store.loading()) return;
      patchState(store, { loading: true, error: null });
      try {
        await this.loadFresh();
        patchState(store, { loading: false, error: null });
      } catch (error) {
        patchState(store, {
          loading: false,
          error: toSafeErrorMessage(error, 'Could not load monitoring configuration. Try again.')
        });
      }
    },

    async saveCompany(payload: MonitoringFeatureTogglesRequest): Promise<boolean> {
      if (store.saving()) return false;
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.updateCompany(payload));
        await this.loadFresh();
        patchState(store, { saving: false, saveError: null });
        return true;
      } catch (error) {
        patchState(store, {
          saving: false,
          saveError: toSafeErrorMessage(error, 'Could not save monitoring defaults. Try again.')
        });
        return false;
      }
    },

    async saveOverride(scope: MonitoringScopeType, targetId: string, payload: MonitoringPolicyOverrideRequest): Promise<boolean> {
      if (store.saving()) return false;
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.upsertOverride(scope, targetId, payload));
        await this.loadFresh();
        patchState(store, { saving: false, saveError: null });
        return true;
      } catch (error) {
        patchState(store, {
          saving: false,
          saveError: toSafeErrorMessage(error, 'Could not save this monitoring override. Try again.')
        });
        return false;
      }
    },

    async removeOverride(scope: MonitoringScopeType, targetId: string): Promise<boolean> {
      if (store.saving()) return false;
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.deleteOverride(scope, targetId));
        await this.loadFresh();
        patchState(store, { saving: false, saveError: null });
        return true;
      } catch (error) {
        patchState(store, {
          saving: false,
          saveError: toSafeErrorMessage(error, 'Could not remove this monitoring override. Try again.')
        });
        return false;
      }
    },

    clearErrors(): void {
      patchState(store, { error: null, saveError: null });
    }
  }))
);

