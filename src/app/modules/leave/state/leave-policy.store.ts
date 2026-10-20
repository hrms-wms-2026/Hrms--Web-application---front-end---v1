import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeavePolicyApiService } from '../data-access/leave-policy-api.service';
import {
  AddLeavePolicyVersionRequest,
  CreateLeavePolicyRequest,
  LeavePolicyAssignmentConflict,
  LeavePolicyAssignmentTarget,
  LeavePolicyConflictError,
  LeavePolicyDetail,
  LeavePolicyListItem,
  UpdateLeavePolicyDetailsRequest
} from '../models/leave-policy.model';

interface LeavePolicyState {
  readonly items: readonly LeavePolicyListItem[];
  readonly selectedPolicy: LeavePolicyDetail | null;
  readonly loading: boolean;
  readonly loadError: string | null;
  readonly saving: boolean;
  readonly actionError: string | null;
  /** Targets that already have another policy for this leave type; set when a save needs confirmation. */
  readonly conflicts: readonly LeavePolicyAssignmentConflict[];
}

export type LeavePolicySaveOutcome = 'saved' | 'conflicts' | 'failed';

/** An edit is saved as: details (if changed) + a new version (if rules changed) + assignments. */
export interface LeavePolicyEdit {
  readonly details: UpdateLeavePolicyDetailsRequest | null;
  readonly version: AddLeavePolicyVersionRequest | null;
  readonly assignments: readonly LeavePolicyAssignmentTarget[] | null;
  readonly replaceConflicts: boolean;
}

export const LeavePolicyStore = signalStore(
  { providedIn: 'root' },
  withState<LeavePolicyState>({
    items: [], selectedPolicy: null, loading: false, loadError: null, saving: false, actionError: null, conflicts: []
  }),
  withComputed(({ items }) => ({ activeItems: computed(() => items().filter((policy) => policy.isActive)) })),
  withMethods((store, api = inject(LeavePolicyApiService)) => {
    async function run(work: () => Promise<void>, fallback: string): Promise<LeavePolicySaveOutcome> {
      patchState(store, { saving: true, actionError: null, conflicts: [] });
      try {
        await work();
        patchState(store, { saving: false });
        return 'saved';
      } catch (err) {
        if (err instanceof LeavePolicyConflictError) {
          patchState(store, { saving: false, conflicts: err.conflicts });
          return 'conflicts';
        }
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, fallback) });
        return 'failed';
      }
    }

    async function loadPolicies(includeInactive = true): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const items = await firstValueFrom(api.list(includeInactive));
        patchState(store, { items, loading: false });
      } catch (err) {
        patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load leave policies.') });
      }
    }

    async function loadPolicy(policyId: string): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        patchState(store, { selectedPolicy: await firstValueFrom(api.get(policyId)), loading: false });
      } catch (err) {
        patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load leave policy.') });
      }
    }

    return {
      loadPolicies,
      loadPolicy,
      async create(payload: CreateLeavePolicyRequest): Promise<LeavePolicySaveOutcome> {
        const outcome = await run(async () => { await firstValueFrom(api.create(payload)); }, 'Failed to create leave policy.');
        if (outcome === 'saved') await loadPolicies();
        return outcome;
      },
      async saveEdit(policyId: string, edit: LeavePolicyEdit): Promise<LeavePolicySaveOutcome> {
        const outcome = await run(async () => {
          if (edit.assignments)
            await firstValueFrom(api.setAssignments(policyId, edit.assignments, edit.replaceConflicts));
          if (edit.details) await firstValueFrom(api.updateDetails(policyId, edit.details));
          if (edit.version) await firstValueFrom(api.addVersion(policyId, edit.version));
        }, 'Failed to save leave policy.');
        // A failure part-way (e.g. the version is rejected after assignments were saved) still
        // reloads, so the screen shows what was saved. A conflict stops before anything is written.
        if (outcome !== 'conflicts') await Promise.all([loadPolicies(), loadPolicy(policyId)]);
        return outcome;
      },
      async deleteVersion(policyId: string, versionId: string): Promise<LeavePolicySaveOutcome> {
        const outcome = await run(async () => { await firstValueFrom(api.deleteVersion(policyId, versionId)); }, 'Failed to cancel the scheduled change.');
        if (outcome === 'saved') await Promise.all([loadPolicies(), loadPolicy(policyId)]);
        return outcome;
      },
      async setActive(policyId: string, isActive: boolean): Promise<LeavePolicySaveOutcome> {
        const outcome = await run(async () => { await firstValueFrom(api.setActive(policyId, isActive)); }, 'Failed to update the policy.');
        if (outcome === 'saved') await loadPolicies();
        return outcome;
      },
      async clone(policyId: string, name: string): Promise<LeavePolicySaveOutcome> {
        const outcome = await run(async () => { await firstValueFrom(api.clone(policyId, name)); }, 'Failed to copy the policy.');
        if (outcome === 'saved') await loadPolicies();
        return outcome;
      },
      clearConflicts(): void {
        patchState(store, { conflicts: [] });
      }
    };
  })
);
