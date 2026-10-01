import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { MyTeamTodayApiService } from '../data-access/my-team-today-api.service';
import { TeamTodayResponse } from '../models/my-team-today.model';

interface MyTeamTodayState {
  readonly data: TeamTodayResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: MyTeamTodayState = {
  data: null,
  loading: false,
  error: null
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const MyTeamTodayStore = signalStore(
  { providedIn: 'root' },
  withState<MyTeamTodayState>(initialState),
  withMethods((store, api = inject(MyTeamTodayApiService)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const data = await firstValueFrom(api.getTeamToday());
        patchState(store, { data, loading: false });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load team status.'), loading: false });
      }
    }
  }))
);
