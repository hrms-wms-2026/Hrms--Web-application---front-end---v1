import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LocationChangeRequestApiService } from '../data-access/location-change-request-api.service';
import { LocationChangeRequestQuery, LocationChangeRequestResponse } from '../models/location-change-request.model';

const DEFAULT_PAGE_SIZE = 20;

export interface LocationChangeRequestsState {
  readonly approvalInbox: readonly LocationChangeRequestResponse[];
  readonly approvalInboxLoading: boolean;
  readonly approvalInboxLoaded: boolean;
  readonly approvalInboxError: string | null;
  readonly approvalInboxPage: number;
  readonly approvalInboxPageSize: number;
  readonly approvalInboxTotalCount: number;
  readonly actionLoading: boolean;
}

const initialState: LocationChangeRequestsState = {
  approvalInbox: [],
  approvalInboxLoading: false,
  approvalInboxLoaded: false,
  approvalInboxError: null,
  approvalInboxPage: 1,
  approvalInboxPageSize: DEFAULT_PAGE_SIZE,
  approvalInboxTotalCount: 0,
  actionLoading: false
};

/**
 * Dedicated store for the "Location changes" approval tab on the Time Tracking page.
 * Kept separate from TimeTrackingStore (which already owns corrections + work-area-change
 * approvals) to avoid growing that already-large store further for a third, independent
 * approval type - mirrors GeneralSettingsStore's simplicity, not TimeTrackingStore's rxMethod use.
 */
export const LocationChangeRequestsStore = signalStore(
  { providedIn: 'root' },
  withState<LocationChangeRequestsState>(initialState),
  withMethods((store, api = inject(LocationChangeRequestApiService)) => ({
    async loadApprovalInbox(pageNumber = 1, pageSize = store.approvalInboxPageSize()): Promise<void> {
      if (store.approvalInboxLoading()) return;
      const query: LocationChangeRequestQuery = { status: 'pending', pageNumber, pageSize };
      patchState(store, { approvalInboxLoading: true, approvalInboxError: null });
      try {
        const result = await firstValueFrom(api.getApprovalInbox(query));
        patchState(store, {
          approvalInbox: result.items,
          approvalInboxPage: result.pageNumber,
          approvalInboxPageSize: result.pageSize,
          approvalInboxTotalCount: result.totalCount,
          approvalInboxLoading: false,
          approvalInboxLoaded: true
        });
      } catch (err) {
        patchState(store, {
          approvalInboxLoading: false,
          approvalInboxError: toSafeErrorMessage(err, 'Failed to load location change requests.')
        });
      }
    },

    async approve(id: string, reviewComment: string | null): Promise<LocationChangeRequestResponse | null> {
      patchState(store, { actionLoading: true });
      try {
        const result = await firstValueFrom(api.approve(id, reviewComment));
        patchState(store, { actionLoading: false });
        return result;
      } catch {
        patchState(store, { actionLoading: false });
        return null;
      }
    },

    async reject(id: string, reviewComment: string): Promise<LocationChangeRequestResponse | null> {
      patchState(store, { actionLoading: true });
      try {
        const result = await firstValueFrom(api.reject(id, reviewComment));
        patchState(store, { actionLoading: false });
        return result;
      } catch {
        patchState(store, { actionLoading: false });
        return null;
      }
    }
  }))
);
