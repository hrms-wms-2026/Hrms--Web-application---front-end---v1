import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveCalendarApiService } from '../data-access/leave-calendar-api.service';
import { LeaveCalendarMonthResponse } from '../models/leave-calendar.model';

export interface LeaveCalendarState {
  readonly month: LeaveCalendarMonthResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly year: number;
  readonly monthNumber: number;
  readonly departmentId: string | null;
}

function currentYearMonth(): { year: number; monthNumber: number } {
  const now = new Date();
  return { year: now.getFullYear(), monthNumber: now.getMonth() + 1 };
}

const initialState: LeaveCalendarState = {
  month: null,
  loading: false,
  error: null,
  ...currentYearMonth(),
  departmentId: null
};

export const LeaveCalendarStore = signalStore(
  { providedIn: 'root' },
  withState<LeaveCalendarState>(initialState),
  withMethods((store, api = inject(LeaveCalendarApiService)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const month = await firstValueFrom(api.getMonth({
          year: store.year(),
          month: store.monthNumber(),
          departmentId: store.departmentId() ?? undefined
        }));
        patchState(store, { month, loading: false });
      } catch (err) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load the team calendar.') });
      }
    },
    setState(year: number, monthNumber: number): void {
      patchState(store, { year, monthNumber });
    },
    async goToPreviousMonth(): Promise<void> {
      const monthNumber = store.monthNumber() === 1 ? 12 : store.monthNumber() - 1;
      const year = store.monthNumber() === 1 ? store.year() - 1 : store.year();
      patchState(store, { year, monthNumber });
      await this.load();
    },
    async goToNextMonth(): Promise<void> {
      const monthNumber = store.monthNumber() === 12 ? 1 : store.monthNumber() + 1;
      const year = store.monthNumber() === 12 ? store.year() + 1 : store.year();
      patchState(store, { year, monthNumber });
      await this.load();
    },
    async goToToday(): Promise<void> {
      patchState(store, currentYearMonth());
      await this.load();
    },
    async setDepartmentFilter(departmentId: string | null): Promise<void> {
      patchState(store, { departmentId });
      await this.load();
    }
  }))
);
