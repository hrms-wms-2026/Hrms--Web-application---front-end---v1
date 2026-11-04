import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveApprovalApiService } from '../data-access/leave-approval-api.service';
import { LeavePendingApprovalListItemResponse } from '../models/leave-approval.model';

interface LeavePendingApprovalsState {
  readonly items: readonly LeavePendingApprovalListItemResponse[];
  readonly loading: boolean;
  readonly error: string | null;
}

/** Leave requests waiting on the signed-in approver - the hub's Upcoming Time Off card. */
export const LeavePendingApprovalsStore = signalStore(
  { providedIn: 'root' },
  withState<LeavePendingApprovalsState>({ items: [], loading: false, error: null }),
  withMethods((store, api = inject(LeaveApprovalApiService)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const items = await firstValueFrom(api.listPendingApprovals());
        patchState(store, { items, loading: false });
      } catch (err) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load requests waiting for you.') });
      }
    }
  }))
);
