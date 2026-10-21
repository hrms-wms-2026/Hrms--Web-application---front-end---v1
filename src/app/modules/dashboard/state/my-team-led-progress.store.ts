import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { MyTeamLedProgressApiService } from '../data-access/my-team-led-progress-api.service';
import { LedWorkProgressResponse } from '../models/my-team-led-progress.model';

interface MyTeamLedProgressState {
  readonly data: LedWorkProgressResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** When the backend last answered successfully - drives the card's "Refreshed ..." label. */
  readonly loadedAt: Date | null;
}

const initialState: MyTeamLedProgressState = {
  data: null,
  loading: false,
  error: null,
  loadedAt: null
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const MyTeamLedProgressStore = signalStore(
  { providedIn: 'root' },
  withState<MyTeamLedProgressState>(initialState),
  withMethods((store, api = inject(MyTeamLedProgressApiService)) => ({
    /** Applies a response the dashboard widget context already fetched, exactly as load() applies its own. */
    seed(data: LedWorkProgressResponse): void {
      patchState(store, { data, loading: false, error: null, loadedAt: new Date() });
    },
    /** A reload is running elsewhere (the dashboard refresh) - same state load() sets while in flight. */
    markLoading(): void {
      patchState(store, { loading: true, error: null });
    },
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const data = await firstValueFrom(api.getLedProgress());
        patchState(store, { data, loading: false, loadedAt: new Date() });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load team progress.'), loading: false });
      }
    }
  }))
);
