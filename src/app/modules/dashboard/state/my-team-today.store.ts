import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { MyTeamTodayApiService } from '../data-access/my-team-today-api.service';
import { TeamTodayResponse } from '../models/my-team-today.model';

interface MyTeamTodayState {
  readonly data: TeamTodayResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** When the backend last answered successfully - drives the card's "Refreshed ..." label. */
  readonly loadedAt: Date | null;
}

const initialState: MyTeamTodayState = {
  data: null,
  loading: false,
  error: null,
  loadedAt: null
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const MyTeamTodayStore = signalStore(
  { providedIn: 'root' },
  withState<MyTeamTodayState>(initialState),
  withMethods((store, api = inject(MyTeamTodayApiService)) => ({
    /** Applies a response the dashboard widget context already fetched, exactly as load() applies its own. */
    seed(data: TeamTodayResponse): void {
      patchState(store, { data, loading: false, error: null, loadedAt: new Date() });
    },
    /** A reload is running elsewhere (the dashboard refresh) - same state load() sets while in flight. */
    markLoading(): void {
      patchState(store, { loading: true, error: null });
    },
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const data = await firstValueFrom(api.getTeamToday());
        patchState(store, { data, loading: false, loadedAt: new Date() });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load team status.'), loading: false });
      }
    }
  }))
);
