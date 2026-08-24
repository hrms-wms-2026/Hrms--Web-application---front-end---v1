import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { BulkOnboardingApiService } from '../data-access/bulk-onboarding-api.service';
import {
  BulkOnboardingBatchDetailResponse,
  BulkOnboardingBatchResponse,
  BulkOnboardingColumnMapping,
  BulkOnboardingSystemField,
  ResolveBulkOnboardingIssuesPayload,
  RowPreviewResponse,
  UploadBulkOnboardingBatchPayload,
  ValidateBulkOnboardingBatchResponse
} from '../models/bulk-onboarding.model';

export interface BulkOnboardingState {
  readonly batch: BulkOnboardingBatchResponse | null;
  readonly mapping: BulkOnboardingColumnMapping;
  readonly preview: RowPreviewResponse | null;
  readonly validationResult: ValidateBulkOnboardingBatchResponse | null;
  readonly detail: BulkOnboardingBatchDetailResponse | null;
  readonly selectedDraftIds: readonly string[];
  readonly loading: boolean;
  readonly polling: boolean;
  readonly error: string | null;
}

const TERMINAL_STATUSES = new Set(['drafts_created', 'finalize_completed']);
const POLL_INTERVAL_MS = 2000;

const initialState: BulkOnboardingState = {
  batch: null, mapping: {}, preview: null, validationResult: null, detail: null,
  selectedDraftIds: [], loading: false, polling: false, error: null
};

export const BulkOnboardingStore = signalStore(
  { providedIn: 'root' },
  withState<BulkOnboardingState>(initialState),
  withMethods((store, api = inject(BulkOnboardingApiService)) => ({
    async upload(payload: UploadBulkOnboardingBatchPayload): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const batch = await firstValueFrom(api.upload(payload));
        patchState(store, { batch, mapping: { ...batch.suggestedMapping }, loading: false });
      } catch (err: unknown) {
        patchState(store, { error: toSafeErrorMessage(err, 'Failed to upload the file.'), loading: false });
      }
    },

    updateMapping(field: BulkOnboardingSystemField, csvColumn: string | null): void {
      patchState(store, (state) => ({ mapping: { ...state.mapping, [field]: csvColumn } }));
      void this.refreshPreview();
    },

    async refreshPreview(): Promise<void> {
      const batch = store.batch();
      if (!batch) return;
      try {
        const preview = await firstValueFrom(api.preview(batch.id, store.mapping()));
        patchState(store, { preview });
      } catch (err: unknown) {
        patchState(store, { error: toSafeErrorMessage(err, 'Failed to preview the mapping.') });
      }
    },

    async validate(): Promise<void> {
      const batch = store.batch();
      if (!batch) return;
      patchState(store, { loading: true, error: null });
      try {
        const validationResult = await firstValueFrom(api.validate(batch.id, store.mapping()));
        patchState(store, { validationResult, loading: false });
      } catch (err: unknown) {
        patchState(store, { error: toSafeErrorMessage(err, 'Failed to validate the batch.'), loading: false });
      }
    },

    async resolveIssue(payload: ResolveBulkOnboardingIssuesPayload): Promise<boolean> {
      const batch = store.batch();
      if (!batch) return false;
      patchState(store, { loading: true, error: null });
      try {
        const validationResult = await firstValueFrom(api.resolveIssues(batch.id, payload));
        patchState(store, { validationResult, loading: false });
        return true;
      } catch (err: unknown) {
        const message =
          err instanceof HttpErrorResponse && err.status === 403
            ? 'You do not have permission to create or update organization setup.'
            : toSafeErrorMessage(err, 'Could not apply this fix. Try again.');
        patchState(store, { error: message, loading: false });
        return false;
      }
    },

    async createDrafts(): Promise<void> {
      const batch = store.batch();
      if (!batch) return;
      patchState(store, { loading: true, error: null });
      try {
        await firstValueFrom(api.requestCreateDrafts(batch.id));
        await this.pollUntilTerminal(batch.id);
      } catch (err: unknown) {
        patchState(store, { error: toSafeErrorMessage(err, 'Failed to start draft creation.'), loading: false });
      }
    },

    toggleRowSelection(onboardingDraftId: string): void {
      patchState(store, (state) => ({
        selectedDraftIds: state.selectedDraftIds.includes(onboardingDraftId)
          ? state.selectedDraftIds.filter((id) => id !== onboardingDraftId)
          : [...state.selectedDraftIds, onboardingDraftId]
      }));
    },

    async finalizeSelected(): Promise<void> {
      const batch = store.batch();
      if (!batch || store.selectedDraftIds().length === 0) return;
      patchState(store, { loading: true, error: null });
      try {
        await firstValueFrom(api.requestFinalize(batch.id, store.selectedDraftIds()));
        await this.pollUntilTerminal(batch.id);
      } catch (err: unknown) {
        patchState(store, { error: toSafeErrorMessage(err, 'Failed to start finalize.'), loading: false });
      }
    },

    async pollUntilTerminal(batchId: string): Promise<void> {
      patchState(store, { polling: true });
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const detail = await firstValueFrom(api.getBatch(batchId));
        patchState(store, { detail });
        if (TERMINAL_STATUSES.has(detail.status)) break;
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      patchState(store, { polling: false, loading: false });
    },

    reset(): void {
      patchState(store, initialState);
    }
  }))
);
