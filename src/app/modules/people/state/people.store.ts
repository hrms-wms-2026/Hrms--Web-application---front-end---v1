import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { PeopleApiService } from '../data-access/people-api.service';
import { EmployeeListItemResponse, EmployeeListParams } from '../models/employee.model';
import { DraftListItemResponse, DraftListParams } from '../models/onboarding-draft.model';
import { isTerminalDraft } from '../utils/draft-status.utils';

export interface PeopleState {
  readonly employees: readonly EmployeeListItemResponse[];
  readonly employeesTotalCount: number;
  readonly employeesPage: number;
  readonly employeesPageSize: number;
  readonly employeesLoading: boolean;
  readonly employeesError: string | null;

  readonly drafts: readonly DraftListItemResponse[];
  readonly draftsTotalCount: number;
  readonly draftsPage: number;
  readonly draftsPageSize: number;
  readonly draftsLoading: boolean;
  readonly draftsError: string | null;
}

const initialState: PeopleState = {
  employees: [],
  employeesTotalCount: 0,
  employeesPage: 1,
  employeesPageSize: 25,
  employeesLoading: false,
  employeesError: null,

  drafts: [],
  draftsTotalCount: 0,
  draftsPage: 1,
  draftsPageSize: 25,
  draftsLoading: false,
  draftsError: null
};

export const PeopleStore = signalStore(
  { providedIn: 'root' },
  withState<PeopleState>(initialState),
  withComputed(({ drafts }) => ({
    /** Excludes terminal (finalized / invitation-sent) drafts - see isTerminalDraft. */
    actionableDrafts: computed(() => drafts().filter((d) => !isTerminalDraft(d.status, d.draftReason)))
  })),
  withMethods((store, api = inject(PeopleApiService)) => {
    let employeesRequestId = 0;
    let draftsRequestId = 0;

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

      async loadDrafts(params: DraftListParams): Promise<void> {
        const requestId = ++draftsRequestId;
        patchState(store, { draftsLoading: true, draftsError: null });
        try {
          const page = await firstValueFrom(api.listDrafts(params));
          if (requestId !== draftsRequestId) {
            return;
          }
          patchState(store, {
            drafts: page.items,
            draftsTotalCount: page.totalCount,
            draftsPage: page.page,
            draftsPageSize: page.pageSize,
            draftsLoading: false
          });
        } catch (err: unknown) {
          if (requestId !== draftsRequestId) {
            return;
          }
          patchState(store, {
            draftsLoading: false,
            draftsError: toSafeErrorMessage(err, 'Something went wrong while loading drafts.')
          });
        }
      },

      clear(): void {
        patchState(store, initialState);
      }
    };
  })
);
