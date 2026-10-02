import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { DeviceChangeRequestApiService } from '../data-access/device-change-request-api.service';
import { DeviceChangeRequestQuery, DeviceChangeRequestResponse } from '../models/device-change-request.model';

const DEFAULT_PAGE_SIZE = 20;

export interface DeviceChangeRequestsState {
  readonly approvalInbox: readonly DeviceChangeRequestResponse[];
  readonly approvalInboxLoading: boolean;
  readonly approvalInboxLoaded: boolean;
  readonly approvalInboxError: string | null;
  readonly approvalInboxPage: number;
  readonly approvalInboxPageSize: number;
  readonly approvalInboxTotalCount: number;
  readonly actionLoading: boolean;
}

const initialState: DeviceChangeRequestsState = {
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
 * Dedicated store for the "Device changes" approval tab on the Time Tracking page - mirrors
 * LocationChangeRequestsStore's shape (its own small store rather than folded into
 * TimeTrackingStore, since this approval type is independent of the other three).
 */
export const DeviceChangeRequestsStore = signalStore(
  { providedIn: 'root' },
  withState<DeviceChangeRequestsState>(initialState),
  withMethods((store, api = inject(DeviceChangeRequestApiService)) => ({
    async loadApprovalInbox(pageNumber = 1, pageSize = store.approvalInboxPageSize()): Promise<void> {
      if (store.approvalInboxLoading()) return;
      const query: DeviceChangeRequestQuery = { pageNumber, pageSize };
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
          approvalInboxError: toSafeErrorMessage(err, 'Failed to load device change requests.')
        });
      }
    },

    async approve(id: string, reviewComment: string | null): Promise<DeviceChangeRequestResponse | null> {
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

    async reject(id: string, reviewComment: string): Promise<DeviceChangeRequestResponse | null> {
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
