import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveRequestApiService } from '../data-access/leave-request-api.service';
import {
  LeaveRequestListFilter,
  LeaveRequestListItemResponse,
  LeaveRequestResponse,
  SubmitLeaveRequestOnBehalfRequest,
  SubmitLeaveRequestRequest
} from '../models/leave-request.model';

export interface LeaveRequestState {
  readonly myRequests: readonly LeaveRequestListItemResponse[];
  readonly myRequestsLoading: boolean;
  readonly myRequestsError: string | null;
  readonly myRequestsFilter: LeaveRequestListFilter;
  readonly previewing: boolean;
  readonly previewResult: LeaveRequestResponse | null;
  readonly previewError: string | null;
  readonly submitting: boolean;
  readonly submitError: string | null;
}

const initialState: LeaveRequestState = {
  myRequests: [],
  myRequestsLoading: false,
  myRequestsError: null,
  myRequestsFilter: {},
  previewing: false,
  previewResult: null,
  previewError: null,
  submitting: false,
  submitError: null
};

export const LeaveRequestStore = signalStore(
  { providedIn: 'root' },
  withState<LeaveRequestState>(initialState),
  withMethods((store, api = inject(LeaveRequestApiService)) => ({
    setMyRequestsFilter(filter: LeaveRequestListFilter): void {
      patchState(store, { myRequestsFilter: filter });
      void this.loadMine();
    },
    async loadMine(): Promise<void> {
      patchState(store, { myRequestsLoading: true, myRequestsError: null });
      try {
        const myRequests = await firstValueFrom(api.listMine(store.myRequestsFilter()));
        patchState(store, { myRequests, myRequestsLoading: false });
      } catch (err) {
        patchState(store, { myRequestsLoading: false, myRequestsError: toSafeErrorMessage(err, 'Failed to load your requests.') });
      }
    },
    async preview(payload: SubmitLeaveRequestRequest): Promise<void> {
      patchState(store, { previewing: true, previewError: null, previewResult: null });
      try {
        const previewResult = await firstValueFrom(api.preview(payload));
        patchState(store, { previewing: false, previewResult });
      } catch (err) {
        patchState(store, { previewing: false, previewError: toSafeErrorMessage(err, 'Failed to preview this request.') });
      }
    },
    clearPreview(): void {
      patchState(store, { previewResult: null, previewError: null });
    },
    async submit(payload: SubmitLeaveRequestRequest): Promise<LeaveRequestResponse | null> {
      patchState(store, { submitting: true, submitError: null });
      try {
        const result = await firstValueFrom(api.submit(payload));
        patchState(store, { submitting: false, previewResult: null });
        await this.loadMine();
        return result;
      } catch (err) {
        patchState(store, { submitting: false, submitError: toSafeErrorMessage(err, 'Failed to submit this request.') });
        return null;
      }
    },
    async submitOnBehalf(payload: SubmitLeaveRequestOnBehalfRequest): Promise<LeaveRequestResponse | null> {
      patchState(store, { submitting: true, submitError: null });
      try {
        const result = await firstValueFrom(api.submitOnBehalf(payload));
        patchState(store, { submitting: false, previewResult: null });
        await this.loadMine();
        return result;
      } catch (err) {
        patchState(store, { submitting: false, submitError: toSafeErrorMessage(err, 'Failed to submit this request.') });
        return null;
      }
    }
  }))
);
