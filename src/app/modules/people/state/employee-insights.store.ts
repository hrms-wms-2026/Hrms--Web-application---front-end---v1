import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { EmployeeInsightsApiService } from '../data-access/employee-insights-api.service';
import { EmployeeOverviewInsightsResponse, EmployeeWorkActivityInsightsResponse } from '../models/employee-insights.model';

export interface EmployeeInsightsState {
  readonly overviewKey: string | null;
  readonly overview: EmployeeOverviewInsightsResponse | null;
  readonly overviewLoading: boolean;
  readonly workKey: string | null;
  readonly workActivity: EmployeeWorkActivityInsightsResponse | null;
  readonly workLoading: boolean;
  readonly error: string | null;
}

const initialState: EmployeeInsightsState = {
  overviewKey: null,
  overview: null,
  overviewLoading: false,
  workKey: null,
  workActivity: null,
  workLoading: false,
  error: null
};

const keyOf = (employeeId: string, month: string) => `${employeeId}|${month}`;

/**
 * Period aggregates for the Overview and Work & Activity tabs, keyed by employee + month so a
 * tab re-entry for the same period does not refetch and a stale response never overwrites a
 * newer period. Provided by the EmployeeDetailComponent shell alongside EmployeeDetailStore.
 */
export const EmployeeInsightsStore = signalStore(
  withState<EmployeeInsightsState>(initialState),
  withMethods((store, api = inject(EmployeeInsightsApiService)) => ({
    async loadOverview(employeeId: string, month: string): Promise<void> {
      const key = keyOf(employeeId, month);
      if (store.overviewKey() === key && (store.overview() || store.overviewLoading())) return;
      patchState(store, { overviewKey: key, overviewLoading: true, error: null });
      try {
        const overview = await firstValueFrom(api.getOverview(employeeId, month));
        if (store.overviewKey() === key) patchState(store, { overview, overviewLoading: false });
      } catch (err: unknown) {
        if (store.overviewKey() === key) {
          patchState(store, { overview: null, overviewLoading: false, error: toSafeErrorMessage(err, 'Could not load insights.') });
        }
      }
    },

    async loadWorkActivity(employeeId: string, month: string): Promise<void> {
      const key = keyOf(employeeId, month);
      if (store.workKey() === key && (store.workActivity() || store.workLoading())) return;
      patchState(store, { workKey: key, workLoading: true, error: null });
      try {
        const workActivity = await firstValueFrom(api.getWorkActivity(employeeId, month));
        if (store.workKey() === key) patchState(store, { workActivity, workLoading: false });
      } catch (err: unknown) {
        if (store.workKey() === key) {
          patchState(store, { workActivity: null, workLoading: false, error: toSafeErrorMessage(err, 'Could not load insights.') });
        }
      }
    }
  }))
);
