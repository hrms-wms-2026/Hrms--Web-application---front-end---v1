import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { MyTeamLedProgressApiService } from '../data-access/my-team-led-progress-api.service';
import { LedWorkProgressResponse } from '../models/my-team-led-progress.model';

interface MyTeamLedProgressState {
  readonly data: LedWorkProgressResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: MyTeamLedProgressState = {
  data: null,
  loading: false,
  error: null
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const MyTeamLedProgressStore = signalStore(
  { providedIn: 'root' },
  withState<MyTeamLedProgressState>(initialState),
  withMethods((store, api = inject(MyTeamLedProgressApiService)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const data = await firstValueFrom(api.getLedProgress());
        patchState(store, { data, loading: false });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load team progress.'), loading: false });
      }
    }
  }))
);
