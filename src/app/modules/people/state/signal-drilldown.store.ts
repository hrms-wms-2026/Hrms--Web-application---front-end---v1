import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PeopleApiService } from '../data-access/people-api.service';
import { EmployeeSignalItem, EmployeeSignalItemsResponse } from '../models/employee-overview.model';
import { EmployeePeriodStore } from './employee-period.store';

interface SignalDrilldownState {
  readonly employeeId: string | null;
  readonly openKey: string | null;
  readonly cache: Readonly<Record<string, EmployeeSignalItemsResponse>>;
  readonly loadingKey: string | null;
  readonly errorKey: string | null;
  readonly selected: { readonly item: EmployeeSignalItem; readonly timezone: string | null } | null;
}

const cacheKey = (key: string, from: string, to: string) => `${key}|${from}|${to}`;

/** State for the one signal drill-down owned by an employee Overview tab. */
export const SignalDrilldownStore = signalStore(
  withState<SignalDrilldownState>({
    employeeId: null, openKey: null, cache: {}, loadingKey: null, errorKey: null, selected: null
  }),
  withComputed((store, period = inject(EmployeePeriodStore)) => ({
    openResponse: computed(() => {
      const key = store.openKey();
      return key ? store.cache()[cacheKey(key, period.from(), period.to())] ?? null : null;
    })
  })),
  withMethods((store, api = inject(PeopleApiService), period = inject(EmployeePeriodStore)) => {
    async function load(key: string): Promise<void> {
      const employeeId = store.employeeId();
      const from = period.from();
      const to = period.to();
      const ck = cacheKey(key, from, to);
      if (!employeeId || store.cache()[ck]) return;
      patchState(store, { loadingKey: key, errorKey: null });
      try {
        const response = await firstValueFrom(api.getOverviewSignalItems(employeeId, key, from, to));
        patchState(store, { cache: { ...store.cache(), [ck]: response } });
        if (store.loadingKey() === key) patchState(store, { loadingKey: null });
      } catch {
        if (store.loadingKey() === key) patchState(store, { loadingKey: null, errorKey: key });
      }
    }

    function open(key: string): void {
      patchState(store, { openKey: key, errorKey: null });
      void load(key);
    }

    function close(): void {
      patchState(store, { openKey: null, errorKey: null });
    }

    return {
      setEmployee(employeeId: string): void {
        patchState(store, { employeeId, openKey: null, cache: {}, loadingKey: null, errorKey: null, selected: null });
      },
      open,
      close,
      toggle(key: string): void {
        if (store.openKey() === key) close();
        else open(key);
      },
      /** Drops every cached item list and refetches the open row (the popup's refresh button). */
      refreshOpen(): void {
        patchState(store, { cache: {} });
        const key = store.openKey();
        if (key) void load(key);
      },
      retry(): void {
        const key = store.openKey();
        if (key) void load(key);
      },
      reset(): void {
        patchState(store, { openKey: null, cache: {}, loadingKey: null, errorKey: null, selected: null });
      },
      /** Timezone: pass it when the item did not come from the open drill-down list (e.g. the Attendance card). */
      select(item: EmployeeSignalItem, timezone?: string | null): void {
        patchState(store, { selected: { item, timezone: timezone ?? store.openResponse()?.timezone ?? null } });
      },
      clearSelection(): void {
        patchState(store, { selected: null });
      }
    };
  })
);
