import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveCalendarApiService } from '../data-access/leave-calendar-api.service';
import { CreateLeaveHolidayRequest, LeaveCalendarMonthResponse, LeaveHolidayResponse } from '../models/leave-calendar.model';

export interface LeaveCalendarState {
  readonly month: LeaveCalendarMonthResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly year: number;
  readonly monthNumber: number;
  readonly departmentId: string | null;
  readonly includeTentative: boolean;
  readonly holidays: readonly LeaveHolidayResponse[];
  readonly holidaysError: string | null;
  /** Settings → Time Off → Holidays lists a whole year; the calendar lists the month it shows. */
  readonly holidayYear: number | null;
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
  departmentId: null,
  includeTentative: false,
  holidays: [],
  holidaysError: null,
  holidayYear: null
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
          departmentId: store.departmentId() ?? undefined,
          includeTentative: store.includeTentative() || undefined
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
    /** Opens this month, unfiltered, in one request (Team Availability shows pending leave too). */
    async openCurrentMonth(includeTentative: boolean): Promise<void> {
      patchState(store, { ...currentYearMonth(), departmentId: null, includeTentative });
      await this.load();
    },
    async goToToday(): Promise<void> {
      patchState(store, currentYearMonth());
      await this.load();
    },
    async setDepartmentFilter(departmentId: string | null): Promise<void> {
      patchState(store, { departmentId });
      await this.load();
    },
    async setIncludeTentative(includeTentative: boolean): Promise<void> {
      patchState(store, { includeTentative });
      await this.load();
    },
    monthRange(): { from: string; to: string } {
      const year = store.year();
      const month = store.monthNumber();
      const last = new Date(year, month, 0).getDate();
      const pad = (n: number) => String(n).padStart(2, '0');
      return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
    },
    async loadHolidaysForYear(year: number): Promise<void> {
      patchState(store, { holidayYear: year });
      await this.loadHolidays();
    },
    async loadHolidays(): Promise<void> {
      const holidayYear = store.holidayYear();
      const { from, to } = holidayYear === null ? this.monthRange() : { from: `${holidayYear}-01-01`, to: `${holidayYear}-12-31` };
      try {
        const holidays = await firstValueFrom(api.listHolidays(from, to));
        patchState(store, { holidays, holidaysError: null });
      } catch (err) {
        patchState(store, { holidaysError: toSafeErrorMessage(err, 'Failed to load holidays.') });
      }
    },
    async createHoliday(payload: CreateLeaveHolidayRequest): Promise<LeaveHolidayResponse | null> {
      try {
        const created = await firstValueFrom(api.createHoliday(payload));
        await this.loadHolidays();
        await this.load();
        return created;
      } catch (err) {
        patchState(store, { holidaysError: toSafeErrorMessage(err, 'Failed to save this holiday.') });
        return null;
      }
    },
    async deleteHoliday(id: string): Promise<boolean> {
      try {
        await firstValueFrom(api.deleteHoliday(id));
        await this.loadHolidays();
        await this.load();
        return true;
      } catch (err) {
        patchState(store, { holidaysError: toSafeErrorMessage(err, 'Failed to remove this holiday.') });
        return false;
      }
    }
  }))
);
