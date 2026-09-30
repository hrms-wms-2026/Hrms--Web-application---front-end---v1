import { inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PeopleApiService } from '../data-access/people-api.service';
import { EmployeeDetailResponse, UpdateEmployeeJobDetailsRequest } from '../models/employee.model';
import { PositionHistoryEntryResponse } from '../models/position-history.model';
import { toPeriodMonth } from '../utils/employee-detail.utils';

export interface EmployeeDetailState {
  readonly employeeId: string | null;
  readonly employee: EmployeeDetailResponse | null;
  readonly jobJourney: readonly PositionHistoryEntryResponse[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly savingJobDetails: boolean;
  /** Reporting period (`YYYY-MM`) for the period-based tabs (Overview, Attendance, Work & Activity). */
  readonly periodMonth: string;
}

const initialState: EmployeeDetailState = {
  employeeId: null,
  employee: null,
  jobJourney: [],
  loading: false,
  error: null,
  savingJobDetails: false,
  periodMonth: toPeriodMonth(new Date())
};

/**
 * Per-page state for the tabbed employee detail screen. Not providedIn root: the
 * EmployeeDetailComponent shell provides it, so each detail page gets a fresh instance and the
 * routed tab components resolve the same instance through the shell's router-outlet.
 */
export const EmployeeDetailStore = signalStore(
  withState<EmployeeDetailState>(initialState),
  withComputed(({ employee }) => ({
    fullName: () => {
      const info = employee()?.personalInformation;
      return info ? `${info.firstName} ${info.lastName}`.trim() : '';
    }
  })),
  withMethods((store, api = inject(PeopleApiService), notifications = inject(NotificationService)) => ({
    async load(employeeId: string): Promise<void> {
      const switching = store.employeeId() !== employeeId;
      patchState(store, {
        employeeId,
        loading: true,
        error: null,
        ...(switching ? { employee: null, jobJourney: [] } : {})
      });

      void firstValueFrom(api.getJobJourney(employeeId))
        .then((jobJourney) => {
          if (store.employeeId() === employeeId) patchState(store, { jobJourney });
        })
        .catch(() => {
          if (store.employeeId() === employeeId) patchState(store, { jobJourney: [] });
        });

      try {
        const employee = await firstValueFrom(api.getEmployeeDetail(employeeId));
        if (store.employeeId() !== employeeId) return;
        patchState(store, { employee, loading: false });
      } catch (err: unknown) {
        if (store.employeeId() !== employeeId) return;
        patchState(store, {
          loading: false,
          error: toSafeErrorMessage(err, 'The employee or selected organization record could not be found.')
        });
      }
    },

    async reload(): Promise<void> {
      const id = store.employeeId();
      if (id) await this.load(id);
    },

    async saveJobDetails(payload: UpdateEmployeeJobDetailsRequest): Promise<boolean> {
      const id = store.employeeId();
      if (!id) return false;
      patchState(store, { savingJobDetails: true });
      try {
        await firstValueFrom(api.updateJobDetails(id, payload));
        patchState(store, { savingJobDetails: false });
        notifications.success('Job details updated.');
        await this.load(id);
        return true;
      } catch (err: unknown) {
        patchState(store, { savingJobDetails: false });
        notifications.error(toSafeErrorMessage(err, 'Could not update job details.'));
        return false;
      }
    },

    setPeriodMonth(periodMonth: string): void {
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) {
        patchState(store, { periodMonth });
      }
    }
  }))
);
