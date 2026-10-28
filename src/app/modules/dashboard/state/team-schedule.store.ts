import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Subscription } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { TeamScheduleApiService } from '../data-access/team-schedule-api.service';
import { TeamScheduleResponse } from '../models/team-schedule.model';

interface TeamScheduleState {
  /** The day shown (yyyy-MM-dd); null = today. Shared by the card and the popup's date navigator. */
  readonly date: string | null;
  /** The viewer's today as the backend answered it for a request without a date; the popup's next-day limit. */
  readonly today: string | null;
  readonly data: TeamScheduleResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** When the backend last answered successfully - drives the card's "Refreshed ..." label. */
  readonly loadedAt: Date | null;
}

const initialState: TeamScheduleState = { date: null, today: null, data: null, loading: false, error: null, loadedAt: null };

/** Today's Team Schedule, the same shape as TeamAttendanceStore. */
export const TeamScheduleStore = signalStore(
  { providedIn: 'root' },
  withState<TeamScheduleState>(initialState),
  withMethods((store, api = inject(TeamScheduleApiService)) => {
    // Only the latest request may land: a newer day cancels the one in flight.
    let inFlight: Subscription | null = null;

    const fetch = (date: string | null): void => {
      inFlight?.unsubscribe();
      patchState(store, { date, loading: true, error: null });
      inFlight = api.getTeamDay(date).subscribe({
        next: (data) => patchState(store, { data, loading: false, loadedAt: new Date(), ...(date === null ? { today: data.date } : {}) }),
        error: (err) => patchState(store, { error: toSafeErrorMessage(err, "Failed to load the team's schedule."), loading: false })
      });
    };

    return {
      /** Applies the dashboard bootstrap (today) when today is shown; otherwise reloads the shown day. */
      seed(data: TeamScheduleResponse): void {
        if (store.date() !== null) {
          fetch(store.date());
          return;
        }
        inFlight?.unsubscribe();
        patchState(store, { data, today: data.date, loading: false, error: null, loadedAt: new Date() });
      },
      markLoading(): void {
        patchState(store, { loading: true, error: null });
      },
      load(date?: string | null): void {
        fetch(date === undefined ? store.date() : date);
      },
      /** The shown day plus or minus one; reaching today goes back to "today" (no date), never past it. */
      shiftDay(step: -1 | 1): void {
        const shown = store.date() ?? store.today();
        if (!shown) return;
        const [y, m, d] = shown.split('-').map(Number);
        const next = new Date(Date.UTC(y, m - 1, d + step)).toISOString().slice(0, 10);
        const today = store.today();
        fetch(today !== null && next >= today ? null : next);
      },
      retry(): void {
        fetch(store.date());
      }
    };
  })
);
