import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeavePolicyApiService } from '../data-access/leave-policy-api.service';
import { CloneLeavePolicyRequest, CreateLeavePolicyRequest, LeavePolicyListItemResponse, LeavePolicyResponse } from '../models/leave-policy.model';
interface LeavePolicyState { readonly items: readonly LeavePolicyListItemResponse[]; readonly selectedPolicy: LeavePolicyResponse | null; readonly loading: boolean; readonly loadError: string | null; readonly saving: boolean; readonly actionError: string | null; readonly replacementConfirmationMessage: string | null; }
type SaveOutcome = 'created' | 'confirm-replace' | 'failed';
export const LeavePolicyStore = signalStore(
  { providedIn: 'root' },
  withState<LeavePolicyState>({ items: [], selectedPolicy: null, loading: false, loadError: null, saving: false, actionError: null, replacementConfirmationMessage: null }),
  withComputed(({ items }) => ({ activeItems: computed(() => items().filter((policy) => policy.isActive)) })),
  withMethods((store, api = inject(LeavePolicyApiService)) => ({
    async loadPolicies(): Promise<void> { patchState(store, { loading: true, loadError: null }); try { const items = await firstValueFrom(api.list()); patchState(store, { items, loading: false }); } catch (err) { patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load leave policies.') }); } },
    async loadPolicy(policyId: string): Promise<void> { patchState(store, { loading: true, loadError: null }); try { const selectedPolicy = await firstValueFrom(api.get(policyId)); patchState(store, { selectedPolicy, loading: false }); } catch (err) { patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load leave policy details.') }); } },
    async createPolicy(payload: CreateLeavePolicyRequest): Promise<SaveOutcome> { patchState(store, { saving: true, actionError: null, replacementConfirmationMessage: null }); try { const created = await firstValueFrom(api.create(payload)); patchState(store, { saving: false, selectedPolicy: created, items: [created, ...store.items().filter((policy) => policy.id !== created.id)] }); return 'created'; } catch (err) { return handleSaveError(store, err, 'Failed to create leave policy.'); } },
    async clonePolicy(policyId: string, payload: CloneLeavePolicyRequest): Promise<SaveOutcome> { patchState(store, { saving: true, actionError: null, replacementConfirmationMessage: null }); try { const created = await firstValueFrom(api.clone(policyId, payload)); patchState(store, { saving: false, selectedPolicy: created, items: [created, ...store.items().filter((policy) => policy.id !== created.id)] }); return 'created'; } catch (err) { return handleSaveError(store, err, 'Failed to clone leave policy.'); } },
    clearReplacementConfirmation(): void { patchState(store, { replacementConfirmationMessage: null }); }
  }))
);
function handleSaveError(store: any, err: unknown, fallback: string): SaveOutcome { const message = toSafeErrorMessage(err, fallback); if (err instanceof HttpErrorResponse && err.status === 409) { patchState(store, { saving: false, replacementConfirmationMessage: message, actionError: null }); return 'confirm-replace'; } patchState(store, { saving: false, actionError: message }); return 'failed'; }
