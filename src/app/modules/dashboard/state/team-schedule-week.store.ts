import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Subscription } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { TeamScheduleApiService } from '../data-access/team-schedule-api.service';
import { TeamScheduleWeekResponse } from '../models/team-schedule.model';

interface TeamScheduleWeekState {
  /** The Monday shown (yyyy-MM-dd); null = the viewer's current week. */
  readonly weekStart: string | null;
  /** The viewer's current Monday as the backend answered it for a request without weekStart; the next-week limit. */
  readonly currentWeek: string | null;
  readonly data: TeamScheduleWeekResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: TeamScheduleWeekState = {
  weekStart: null,
  currentWeek: null,
  data: null,
  loading: false,
  error: null,
};

/** The team week (planned vs actual), the same shape as TeamScheduleStore. Lazy: nothing loads until load is called. */
export const TeamScheduleWeekStore = signalStore(
  { providedIn: 'root' },
  withState<TeamScheduleWeekState>(initialState),
  withMethods((store, api = inject(TeamScheduleApiService)) => {
    // Only the latest request may land: a newer week cancels the one in flight.
    let inFlight: Subscription | null = null;

    const fetch = (weekStart: string | null): void => {
      inFlight?.unsubscribe();
      patchState(store, { weekStart, loading: true, error: null });
      inFlight = api.getTeamWeek(weekStart).subscribe({
        next: (data) =>
          patchState(store, {
            data,
            loading: false,
            ...(weekStart === null ? { currentWeek: data.weekStart } : {}),
          }),
        error: (err) =>
          patchState(store, {
            error: toSafeErrorMessage(err, "Failed to load the team's week."),
            loading: false,
          }),
      });
    };

    return {
      load(weekStart: string | null): void {
        fetch(weekStart);
      },
      /** The shown week plus or minus seven days; reaching the current week goes back to "current" (no weekStart). */
      shiftWeek(step: -1 | 1): void {
        const shown = store.weekStart() ?? store.currentWeek();
        if (!shown) return;
        const [y, m, d] = shown.split('-').map(Number);
        const next = new Date(Date.UTC(y, m - 1, d + 7 * step)).toISOString().slice(0, 10);
        const current = store.currentWeek();
        fetch(current !== null && next >= current ? null : next);
      },
      retry(): void {
        fetch(store.weekStart());
      },
    };
  }),
);
