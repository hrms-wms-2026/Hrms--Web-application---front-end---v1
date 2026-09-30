import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { ExceptionAlertsApiService } from '../data-access/exception-alerts-api.service';
import {
  ExceptionAlertAction,
  ExceptionAlertResponse,
  ExceptionAlertStatus,
  ExceptionAlertType
} from '../models/exception-alert.model';

interface ExceptionAlertsState {
  readonly items: readonly ExceptionAlertResponse[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly statusFilter: ExceptionAlertStatus | null;
  readonly typeFilter: ExceptionAlertType | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly actionLoading: boolean;
  readonly activeAction: ExceptionAlertAction | null;
  readonly actionError: string | null;
}

const initialState: ExceptionAlertsState = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 20,
  statusFilter: null,
  typeFilter: null,
  loading: false,
  error: null,
  actionLoading: false,
  activeAction: null,
  actionError: null
};

export const ExceptionAlertsStore = signalStore(
  { providedIn: 'root' },
  withState<ExceptionAlertsState>(initialState),
  withMethods((store, api = inject(ExceptionAlertsApiService)) => ({
    async load(page = store.page()): Promise<void> {
      patchState(store, { loading: true, error: null, page });
      try {
        const result = await firstValueFrom(api.list({
          status: store.statusFilter(),
          type: store.typeFilter(),
          page,
          pageSize: store.pageSize()
        }));
        patchState(store, { items: result.items, totalCount: result.totalCount, loading: false });
      } catch (error) {
        patchState(store, { loading: false, error: toSafeErrorMessage(error, 'Could not load alerts. Try again.') });
      }
    },

    async setFilters(status: ExceptionAlertStatus | null, type: ExceptionAlertType | null): Promise<void> {
      patchState(store, { statusFilter: status, typeFilter: type });
      await this.load(1);
    },

    /** Returns false when the action failed; actionError then holds the reason. The list is
     * reloaded either way so a case someone else already moved shows its real status. */
    async act(id: string, action: ExceptionAlertAction, note: string | null = null): Promise<boolean> {
      if (store.actionLoading()) return false;
      patchState(store, { actionLoading: true, activeAction: action, actionError: null });
      try {
        const trimmed = note?.trim() || null;
        const request = action === 'acknowledge'
          ? api.acknowledge(id)
          : action === 'resolve'
            ? api.resolve(id, trimmed)
            : api.escalate(id, trimmed);
        await firstValueFrom(request);
        patchState(store, { actionLoading: false, activeAction: null });
        await this.load();
        return true;
      } catch (error) {
        patchState(store, {
          actionLoading: false,
          activeAction: null,
          actionError: toSafeErrorMessage(error, 'Could not update this alert. Try again.')
        });
        await this.load();
        return false;
      }
    }
  }))
);
