import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ClockInPolicyApiService } from '../data-access/clock-in-policy-api.service';
import { ClockInPolicyResponse } from '../models/clock-in-policy.model';
import {
  ClockInPolicySettingsFormValue,
  LATE_DEDUCTION_RULES_EDITABLE,
  toUpsertRequest
} from '../utils/clock-in-policy-form.utils';

export const CLOCK_IN_POLICY_LOAD_ERROR = 'Could not load clock-in policy. Try again.';
export const CLOCK_IN_POLICY_SAVE_ERROR = 'Could not save clock-in policy. Try again.';
export const CLOCK_IN_POLICY_COMPANY_WIDE_CONFLICT =
  'Clock-in policy needs admin review because more than one company-wide policy exists.';

export interface ClockInPolicyState {
  /** Active company-wide policy detail, or null when none exists yet. */
  readonly policy: ClockInPolicyResponse | null;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
  readonly saveError: string | null;
  /** True when more than one active full_company policy exists — block save. */
  readonly multipleCompanyPolicies: boolean;
  readonly legalEntityId: string | null;
  /** In-flight load key to dedupe concurrent loads. */
  readonly inFlightKey: string | null;
  /** Last successfully loaded key — skips redundant effect re-entry loads. */
  readonly loadedKey: string | null;
}

const initialState: ClockInPolicyState = {
  policy: null,
  loading: false,
  saving: false,
  error: null,
  saveError: null,
  multipleCompanyPolicies: false,
  legalEntityId: null,
  inFlightKey: null,
  loadedKey: null
};

function loadKey(legalEntityId: string): string {
  return legalEntityId;
}

export const ClockInPolicyStore = signalStore(
  { providedIn: 'root' },
  withState<ClockInPolicyState>(initialState),
  withMethods((store, api = inject(ClockInPolicyApiService)) => ({
    clear(): void {
      patchState(store, { ...initialState });
    },

    /**
     * Resolve the single active full_company policy for the settings screen.
     * - 0 matches → policy null (form uses defaults; save will POST)
     * - 1 match → load detail into policy (save will PUT)
     * - 2+ matches → multipleCompanyPolicies + conflict error; do not guess which to update
     */
    async loadCompanyPolicy(legalEntityId: string): Promise<void> {
      const trimmedId = legalEntityId?.trim() ?? '';
      if (!trimmedId) {
        return;
      }

      const key = loadKey(trimmedId);
      if (store.loading() && store.inFlightKey() === key) {
        return;
      }

      if (
        store.loadedKey() === key &&
        store.error() === null &&
        !store.loading() &&
        !store.multipleCompanyPolicies()
      ) {
        return;
      }

      patchState(store, {
        legalEntityId: trimmedId,
        loading: true,
        error: null,
        saveError: null,
        multipleCompanyPolicies: false,
        inFlightKey: key,
        policy: null
      });

      try {
        const policies = await firstValueFrom(api.list(trimmedId, false));
        if (store.inFlightKey() !== key) {
          return;
        }

        const companyWide = policies.filter(
          (p) => p.scopeType === 'full_company' && p.isActive
        );

        if (companyWide.length > 1) {
          patchState(store, {
            policy: null,
            loading: false,
            error: CLOCK_IN_POLICY_COMPANY_WIDE_CONFLICT,
            multipleCompanyPolicies: true,
            inFlightKey: null,
            loadedKey: null
          });
          return;
        }

        if (companyWide.length === 0) {
          patchState(store, {
            policy: null,
            loading: false,
            error: null,
            multipleCompanyPolicies: false,
            inFlightKey: null,
            loadedKey: key
          });
          return;
        }

        const policy = await firstValueFrom(api.get(trimmedId, companyWide[0].id));
        if (store.inFlightKey() !== key) {
          return;
        }

        patchState(store, {
          policy,
          loading: false,
          error: null,
          multipleCompanyPolicies: false,
          inFlightKey: null,
          loadedKey: key
        });
      } catch {
        if (store.inFlightKey() !== key) {
          return;
        }
        patchState(store, {
          policy: null,
          loading: false,
          error: CLOCK_IN_POLICY_LOAD_ERROR,
          multipleCompanyPolicies: false,
          inFlightKey: null,
          loadedKey: null
        });
      }
    },

    /**
     * Persist company-wide settings: POST when no policy exists, PUT when one exists.
     * No-ops when legalEntityId is missing or multiple company-wide policies are present.
     * @param lateRulesEditable When false (default until Time Off Type lookup exists),
     *   create sends [] and update preserves existing backend lateDeductionRules.
     */
    async saveCompanyPolicy(
      legalEntityId: string,
      formValue: ClockInPolicySettingsFormValue,
      lateRulesEditable = LATE_DEDUCTION_RULES_EDITABLE
    ): Promise<ClockInPolicyResponse | null> {
      const trimmedId = legalEntityId?.trim() ?? '';
      if (!trimmedId || store.multipleCompanyPolicies()) {
        return null;
      }

      const existing = store.policy();
      const payload = toUpsertRequest(
        formValue,
        existing?.lateDeductionRules ?? null,
        undefined,
        lateRulesEditable
      );

      patchState(store, { saving: true, saveError: null });

      try {
        const saved = existing
          ? await firstValueFrom(api.update(trimmedId, existing.id, payload))
          : await firstValueFrom(api.create(trimmedId, payload));

        patchState(store, {
          saving: false,
          saveError: null,
          policy: saved,
          loadedKey: loadKey(trimmedId),
          error: null,
          multipleCompanyPolicies: false
        });
        return saved;
      } catch {
        patchState(store, {
          saving: false,
          saveError: CLOCK_IN_POLICY_SAVE_ERROR
        });
        return null;
      }
    }
  }))
);
