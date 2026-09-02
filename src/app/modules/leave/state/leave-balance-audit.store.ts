import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveEntitlementApiService } from '../data-access/leave-entitlement-api.service';
import { LeaveBalanceAuditListFilter, LeaveBalanceAuditResponse } from '../models/leave-entitlement.model';

const PAGE_SIZE = 25;

export interface LeaveBalanceAuditState {
  readonly rows: readonly LeaveBalanceAuditResponse[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly filter: LeaveBalanceAuditListFilter;
  readonly page: number;
  readonly hasMore: boolean;
  readonly exporting: boolean;
  readonly exportError: string | null;
}

const initialState: LeaveBalanceAuditState = {
  rows: [],
  loading: false,
  error: null,
  filter: {},
  page: 1,
  hasMore: false,
  exporting: false,
  exportError: null
};

export const LeaveBalanceAuditStore = signalStore(
  { providedIn: 'root' },
  withState<LeaveBalanceAuditState>(initialState),
  withMethods((store, api = inject(LeaveEntitlementApiService)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const rows = await firstValueFrom(api.listBalanceAudit(store.filter(), 1, PAGE_SIZE));
        patchState(store, { rows, loading: false, page: 1, hasMore: rows.length === PAGE_SIZE });
      } catch (err) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load the balance audit trail.') });
      }
    },
    async loadMore(): Promise<void> {
      if (!store.hasMore() || store.loading()) return;
      const nextPage = store.page() + 1;
      patchState(store, { loading: true, error: null });
      try {
        const rows = await firstValueFrom(api.listBalanceAudit(store.filter(), nextPage, PAGE_SIZE));
        patchState(store, { rows: [...store.rows(), ...rows], loading: false, page: nextPage, hasMore: rows.length === PAGE_SIZE });
      } catch (err) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load more audit rows.') });
      }
    },
    setFilter(filter: LeaveBalanceAuditListFilter): void {
      patchState(store, { filter });
      void this.load();
    },
    async exportCsv(): Promise<Blob | null> {
      patchState(store, { exporting: true, exportError: null });
      try {
        const blob = await firstValueFrom(api.exportBalanceAudit(store.filter()));
        patchState(store, { exporting: false });
        return blob;
      } catch (err) {
        patchState(store, { exporting: false, exportError: toSafeErrorMessage(err, 'Failed to export the audit trail.') });
        return null;
      }
    }
  }))
);
