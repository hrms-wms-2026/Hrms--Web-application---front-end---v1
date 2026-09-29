import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { PeopleApiService } from '../data-access/people-api.service';
import { EmployeeListItemResponse, EmployeeListParams } from '../models/employee.model';

export interface PeopleState {
  readonly employees: readonly EmployeeListItemResponse[];
  readonly employeesTotalCount: number;
  readonly employeesPage: number;
  readonly employeesPageSize: number;
  readonly employeesLoading: boolean;
  readonly employeesError: string | null;
}

const initialState: PeopleState = {
  employees: [],
  employeesTotalCount: 0,
  employeesPage: 1,
  employeesPageSize: 25,
  employeesLoading: false,
  employeesError: null
};

export const PeopleStore = signalStore(
  { providedIn: 'root' },
  withState<PeopleState>(initialState),
  withMethods((store, api = inject(PeopleApiService)) => {
    let employeesRequestId = 0;

    return {
      async loadEmployees(params: EmployeeListParams): Promise<void> {
        const requestId = ++employeesRequestId;
        patchState(store, { employeesLoading: true, employeesError: null });
        try {
          const page = await firstValueFrom(api.listEmployees(params));
          if (requestId !== employeesRequestId) {
            return;
          }
          patchState(store, {
            employees: page.items,
            employeesTotalCount: page.totalCount,
            employeesPage: page.page,
            employeesPageSize: page.pageSize,
            employeesLoading: false
          });
        } catch (err: unknown) {
          if (requestId !== employeesRequestId) {
            return;
          }
          patchState(store, {
            employeesLoading: false,
            employeesError: toSafeErrorMessage(err, 'Something went wrong while loading employees.')
          });
        }
      },

      clear(): void {
        patchState(store, initialState);
      }
    };
  })
);
